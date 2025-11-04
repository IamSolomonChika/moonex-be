import { Address } from 'viem';
import { createPancakeSwapPair } from '../contracts/pancakeswap-pair';
import { createPancakeSwapFactory } from '../contracts/pancakeswap-factory';
import logger from '../../utils/logger';

/**
 * Liquidity Service for PancakeSwap (Viem Implementation)
 * Provides liquidity management functionality using Viem contracts
 */

export interface LiquidityPool {
  address: Address;
  token0: Address;
  token1: Address;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
  apr?: number;
  volume24h?: bigint;
  fee24h?: bigint;
}

export interface LiquidityPosition {
  user: Address;
  poolAddress: Address;
  amount0: bigint;
  amount1: bigint;
  lpTokens: bigint;
  valueUSD?: string;
  impermanentLoss?: string;
}

export interface LiquidityReserves {
  reserve0: bigint;
  reserve1: bigint;
  blockTimestampLast: bigint;
}

/**
 * Get reserves for a liquidity pool
 */
export async function getPoolReserves(pairAddress: Address): Promise<LiquidityReserves> {
  try {
    logger.debug('Getting reserves for pool: %s', pairAddress);
    const pair = createPancakeSwapPair(pairAddress);
    const reserves = await pair.getReserves();

    logger.debug('Pool reserves: reserve0=%s, reserve1=%s', reserves.reserve0.toString(), reserves.reserve1.toString());
    return reserves;
  } catch (error) {
    logger.error('Failed to get pool reserves: %O', error);
    throw new Error(`Pool reserves failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get multiple pool reserves in batch
 */
export async function batchGetReserves(pairAddresses: Address[]): Promise<Array<{
  address: Address;
  reserves?: LiquidityReserves;
  error?: string;
}>> {
  try {
    logger.debug('Getting reserves for %d pools in batch', pairAddresses.length);

    const results = await Promise.allSettled(
      pairAddresses.map(async (address) => {
        try {
          const reserves = await getPoolReserves(address);
          return { address, reserves };
        } catch (error) {
          logger.error('Failed to get reserves for %s: %O', address, error);
          return { address, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      })
    );

    return results.map(result => result.status === 'fulfilled' ? result.value : result.reason);
  } catch (error) {
    logger.error('Batch get reserves failed: %O', error);
    throw new Error(`Batch reserves failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all liquidity pools
 */
export async function getAllLiquidityPools(): Promise<LiquidityPool[]> {
  try {
    logger.info('Getting all liquidity pools');

    const factory = createPancakeSwapFactory();
    const totalPairs = await factory.allPairsLength();

    const pools: LiquidityPool[] = [];

    // Get pools in batches to avoid rate limiting
    const batchSize = 50;
    for (let i = 0n; i < totalPairs; i += BigInt(batchSize)) {
      const endIndex = Math.min(Number(i + BigInt(batchSize)), Number(totalPairs));
      const batchIndices = Array.from(
        { length: endIndex - Number(i) },
        (_, idx) => i + BigInt(idx)
      );

      const batchPairs = await factory.getPairs(batchIndices);

      for (let j = 0; j < batchPairs.length; j++) {
        try {
          const pairAddress = batchPairs[j];
          if (pairAddress === '0x0000000000000000000000000000000000000000000' as Address) {
            continue; // Skip empty pairs
          }

          const pair = createPancakeSwapPair(pairAddress);
          const [token0, token1, reserves, totalSupply] = await Promise.all([
            pair.token0(),
            pair.token1(),
            pair.getReserves(),
            pair.totalSupply(),
          ]);

          pools.push({
            address: pairAddress,
            token0,
            token1,
            reserve0: reserves.reserve0,
            reserve1: reserves.reserve1,
            totalSupply,
          });
        } catch (error) {
          logger.error('Failed to get pool details for index %s: %O', i + BigInt(j), error);
          // Continue with other pools
        }
      }
    }

    logger.info('Retrieved %d liquidity pools', pools.length);
    return pools;
  } catch (error) {
    logger.error('Failed to get all liquidity pools: %O', error);
    throw new Error(`Get all pools failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get user's liquidity positions
 */
export async function getUserLiquidityPositions(
  userAddress: Address
): Promise<LiquidityPosition[]> {
  try {
    logger.info('Getting liquidity positions for user: %s', userAddress);

    const pools = await getAllLiquidityPools();
    const positions: LiquidityPosition[] = [];

    // Check user's LP token balance in each pool
    for (const pool of pools) {
      try {
        const pair = createPancakeSwapPair(pool.address);
        const lpTokenBalance = await pair.balanceOf(userAddress);

        if (lpTokenBalance > 0n) {
          // Calculate user's share of reserves
          const userShare = (lpTokenBalance * 1000000n) / pool.totalSupply; // Basis points
          const amount0 = (pool.reserve0 * userShare) / 1000000n;
          const amount1 = (pool.reserve1 * userShare) / 1000000n;

          positions.push({
            user: userAddress,
            poolAddress: pool.address,
            amount0,
            amount1,
            lpTokens: lpTokenBalance,
          });
        }
      } catch (error) {
        logger.error('Failed to check position in pool %s: %O', pool.address, error);
        // Continue with other pools
      }
    }

    logger.info('Retrieved %d liquidity positions for user: %s', positions.length, userAddress);
    return positions;
  } catch (error) {
    logger.error('Failed to get user liquidity positions: %O', error);
    throw new Error(`Get user positions failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate impermanent loss
 */
export function calculateImpermanentLoss(
  initialReserve0: bigint,
  initialReserve1: bigint,
  currentReserve0: bigint,
  currentReserve1: bigint
): number {
  try {
    if (initialReserve0 === 0n || initialReserve1 === 0n) {
      return 0;
    }

    const initialPrice = Number(initialReserve1) / Number(initialReserve0);
    const currentPrice = Number(currentReserve1) / Number(currentReserve0);

    const priceChange = (currentPrice - initialPrice) / initialPrice;
    const impermanentLoss = priceChange * priceChange / (1 + priceChange);

    return Math.abs(impermanentLoss) * 100; // Return as percentage
  } catch (error) {
    logger.error('Failed to calculate impermanent loss: %O', error);
    return 0;
  }
}

/**
 * Calculate pool APR (simplified)
 */
export function calculatePoolAPR(
  pool: LiquidityPool,
  volume24h: bigint,
  fee24h: bigint
): number {
  try {
    if (pool.totalSupply === 0n) {
      return 0;
    }

    const yearlyFees = fee24h * BigInt(365); // Simplified calculation
    const apr = (yearlyFees * BigInt(100)) / pool.totalSupply;

    return Number(apr) / 100; // Convert to percentage
  } catch (error) {
    logger.error('Failed to calculate pool APR: %O', error);
    return 0;
  }
}

/**
 * Get pool statistics
 */
export async function getPoolStatistics(
  pairAddress: Address
): Promise<{
  reserves: LiquidityReserves;
  totalSupply: bigint;
  apr?: number;
  volume24h?: bigint;
  fee24h?: bigint;
  liquidityUSD?: string;
}> {
  try {
    logger.debug('Getting statistics for pool: %s', pairAddress);

    const pair = createPancakeSwapPair(pairAddress);
    const [reserves, totalSupply] = await Promise.all([
      pair.getReserves(),
      pair.totalSupply(),
    ]);

    // Mock data for demo purposes
    const volume24h = BigInt('1000000000000000000000'); // 1000 tokens
    const fee24h = volume24h * BigInt(3) / BigInt(10000); // 0.3%

    const apr = calculatePoolAPR({
      address: pairAddress,
      token0: '0x' as Address,
      token1: '0x' as Address,
      reserve0: reserves.reserve0,
      reserve1: reserves.reserve1,
      totalSupply,
    }, volume24h, fee24h);

    return {
      reserves,
      totalSupply,
      apr,
      volume24h,
      fee24h,
    };
  } catch (error) {
    logger.error('Failed to get pool statistics: %O', error);
    throw new Error(`Pool statistics failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get top liquidity pools by total value locked
 */
export async function getTopLiquidityPools(
  limit: number = 10
): Promise<Array<LiquidityPool & { rank: number }>> {
  try {
    logger.info('Getting top %d liquidity pools', limit);

    const pools = await getAllLiquidityPools();

    // Sort by total value locked (simplified calculation)
    pools.sort((a, b) => {
      const aValue = Number(a.reserve0) + Number(a.reserve1);
      const bValue = Number(b.reserve0) + Number(b.reserve1);
      return bValue - aValue;
    });

    const topPools = pools.slice(0, limit).map((pool, index) => ({
      ...pool,
      rank: index + 1,
    }));

    logger.info('Retrieved top %d liquidity pools', topPools.length);
    return topPools;
  } catch (error) {
    logger.error('Failed to get top liquidity pools: %O', error);
    throw new Error(`Top pools failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Search for liquidity pools by token
 */
export async function searchLiquidityPools(
  tokenAddress: Address
): Promise<LiquidityPool[]> {
  try {
    logger.info('Searching for pools containing token: %s', tokenAddress);

    const pools = await getAllLiquidityPools();
    const matchingPools = pools.filter(
      pool => pool.token0 === tokenAddress || pool.token1 === tokenAddress
    );

    logger.info('Found %d pools containing token: %s', matchingPools.length, tokenAddress);
    return matchingPools;
  } catch (error) {
    logger.error('Failed to search liquidity pools: %O', error);
    throw new Error(`Search pools failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate pool parameters
 */
export function validatePoolParameters(
  tokenA: Address,
  tokenB: Address,
  amountA: bigint,
  amountB: bigint
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate addresses
  if (tokenA === tokenB) {
    errors.push('Token addresses cannot be the same');
  }

  if (tokenA === '0x0000000000000000000000000000000000000000000' as Address ||
      tokenB === '0x0000000000000000000000000000000000000000000' as Address) {
    errors.push('Invalid token address (zero address)');
  }

  // Validate amounts
  if (amountA <= 0n) {
    errors.push('Amount A must be greater than 0');
  }

  if (amountB <= 0n) {
    errors.push('Amount B must be greater than 0');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Monitor pool reserves changes
 */
export function monitorPoolReserves(
  pairAddress: Address,
  callback: (reserves: LiquidityReserves) => void
): () => void {
  try {
    logger.info('Starting reserve monitoring for pool: %s', pairAddress);

    const pair = createPancakeSwapPair(pairAddress);

    // Set up event listener for Sync events
    const unwatch = pair.watchSync(() => {
      pair.getReserves().then(reserves => {
        logger.debug('Reserves updated for pool %s: %O', pairAddress, reserves);
        callback(reserves);
      });
    });

    logger.info('Reserve monitoring started for pool: %s', pairAddress);
    return unwatch;
  } catch (error) {
    logger.error('Failed to start reserve monitoring: %O', error);
    throw new Error(`Reserve monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export default {
  getPoolReserves,
  batchGetReserves,
  getAllLiquidityPools,
  getUserLiquidityPositions,
  calculateImpermanentLoss,
  calculatePoolAPR,
  getPoolStatistics,
  getTopLiquidityPools,
  searchLiquidityPools,
  validatePoolParameters,
  monitorPoolReserves,
};