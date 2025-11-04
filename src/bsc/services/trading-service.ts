import { Address } from 'viem';
import { createPancakeSwapRouter } from '../contracts/pancakeswap-router';
import { createPancakeSwapFactory } from '../contracts/pancakeswap-factory';
import logger from '../../utils/logger';

/**
 * Trading Service for PancakeSwap (Viem Implementation)
 * Provides trading functionality using Viem contracts
 */

export interface SwapPrice {
  amountIn: bigint;
  amountOut: bigint;
  path: Address[];
  priceImpact: number;
  gasEstimate?: {
    gas: bigint;
    gasPrice: bigint;
    totalCost: bigint;
  };
}

export interface SwapQuote {
  amountIn: bigint;
  amountOut: bigint;
  path: Address[];
  priceImpact: number;
  validFor: number; // seconds
  timestamp: number;
}

/**
 * Get swap price from PancakeSwap
 */
export async function getSwapPrice(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  maxHops: number = 3
): Promise<SwapPrice> {
  try {
    logger.info('Getting swap price: %s -> %s, amount: %s', tokenIn, tokenOut, amountIn.toString());

    const router = createPancakeSwapRouter();
    const factory = createPancakeSwapFactory();

    // Simple direct swap path (for demo purposes)
    // In a real implementation, you'd use a routing algorithm
    const path = [tokenIn, tokenOut];

    // Get amounts out
    const amountsOut = await router.getAmountsOut(amountIn, path);
    const amountOut = amountsOut[amountsOut.length - 1];

    // Calculate price impact (simplified)
    const priceImpact = calculatePriceImpact(amountIn, amountOut);

    // Estimate gas
    const gasEstimate = await router.estimateSwapGas(
      amountIn,
      amountOut * BigInt(995) / BigInt(1000), // 0.5% slippage
      path,
      '0x0000000000000000000000000000000000000000000' as Address,
      BigInt(Math.floor(Date.now() / 1000) + 300), // 5 minute deadline
      '0x' // Private key placeholder
    );

    logger.info('Swap price calculated: %s -> %s', amountIn.toString(), amountOut.toString());

    return {
      amountIn,
      amountOut,
      path,
      priceImpact,
      gasEstimate,
    };
  } catch (error) {
    logger.error('Failed to get swap price: %O', error);
    throw new Error(`Swap price calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get multiple swap quotes
 */
export async function getSwapQuotes(
  tokenPairs: Array<{
    tokenIn: Address;
    tokenOut: Address;
    amountIn: bigint;
  }>
): Promise<SwapQuote[]> {
  try {
    logger.info('Getting %d swap quotes', tokenPairs.length);

    const quotes: SwapQuote[] = [];

    for (const pair of tokenPairs) {
      try {
        const price = await getSwapPrice(pair.tokenIn, pair.tokenOut, pair.amountIn);

        quotes.push({
          amountIn: price.amountIn,
          amountOut: price.amountOut,
          path: price.path,
          priceImpact: price.priceImpact,
          validFor: 30, // 30 seconds
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error('Failed to get quote for %s -> %s: %O', pair.tokenIn, pair.tokenOut, error);
        // Continue with other pairs
      }
    }

    logger.info('Generated %d swap quotes', quotes.length);
    return quotes;
  } catch (error) {
    logger.error('Failed to get swap quotes: %O', error);
    throw new Error(`Swap quotes failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Execute swap
 */
export async function executeSwap(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  amountOutMin: bigint,
  to: Address,
  privateKey: string,
  slippageTolerance: number = 0.005 // 0.5%
): Promise<{
  transactionHash: string;
  amountIn: bigint;
  amountOut: bigint;
  gasUsed?: bigint;
}> {
  try {
    logger.info('Executing swap: %s -> %s, amount: %s', tokenIn, tokenOut, amountIn.toString());

    const router = createPancakeSwapRouter();
    const factory = createPancakeSwapFactory();

    // Get path
    const path = [tokenIn, tokenOut];

    // Get amounts out to verify minimum
    const amountsOut = await router.getAmountsOut(amountIn, path);
    const expectedAmountOut = amountsOut[amountsOut.length - 1];

    if (expectedAmountOut < amountOutMin) {
      throw new Error('Insufficient output amount due to slippage');
    }

    // Set deadline (5 minutes from now)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

    // Execute swap
    const transactionHash = await router.swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      path,
      to,
      deadline,
      privateKey
    );

    logger.info('Swap executed: %s', transactionHash);

    return {
      transactionHash,
      amountIn,
      amountOut: expectedAmountOut,
    };
  } catch (error) {
    logger.error('Failed to execute swap: %O', error);
    throw new Error(`Swap execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate price impact
 */
function calculatePriceImpact(amountIn: bigint, amountOut: bigint): number {
  try {
    // Simplified price impact calculation
    // In a real implementation, you'd calculate this based on reserves
    const priceIn = Number(amountIn);
    const priceOut = Number(amountOut);

    // Basic price impact formula (simplified)
    const priceImpact = Math.abs(priceOut - priceIn) / priceIn;

    // Convert to percentage and cap at 100%
    return Math.min(priceImpact * 100, 100);
  } catch (error) {
    logger.error('Failed to calculate price impact: %O', error);
    return 0;
  }
}

/**
 * Get best swap route (simplified)
 */
export async function getBestSwapRoute(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint
): Promise<{
  path: Address[];
  amountOut: bigint;
  priceImpact: number;
}> {
  try {
    logger.info('Finding best swap route: %s -> %s', tokenIn, tokenOut);

    // For demo purposes, use direct route
    // In a real implementation, you'd check all possible routes
    const router = createPancakeSwapRouter();
    const path = [tokenIn, tokenOut];

    const amountsOut = await router.getAmountsOut(amountIn, path);
    const amountOut = amountsOut[amountsOut.length - 1];
    const priceImpact = calculatePriceImpact(amountIn, amountOut);

    logger.info('Best route found: %O', path);
    return {
      path,
      amountOut,
      priceImpact,
    };
  } catch (error) {
    logger.error('Failed to find best swap route: %O', error);
    throw new Error(`Route finding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if pair exists
 */
export async function checkPairExists(
  tokenA: Address,
  tokenB: Address
): Promise<boolean> {
  try {
    logger.debug('Checking if pair exists: %s <-> %s', tokenA, tokenB);
    const factory = createPancakeSwapFactory();
    const pairAddress = await factory.getPair(tokenA, tokenB);

    const exists = pairAddress !== '0x0000000000000000000000000000000000000000000' as Address;
    logger.debug('Pair exists: %s', exists);
    return exists;
  } catch (error) {
    logger.error('Failed to check pair existence: %O', error);
    return false;
  }
}

/**
 * Get trading statistics
 */
export async function getTradingStatistics(): Promise<{
  totalSwaps: number;
  totalVolume: bigint;
  averageGasPrice: bigint;
  popularPairs: Array<{
    token0: Address;
    token1: Address;
    volume24h: bigint;
  }>;
}> {
  try {
    logger.info('Getting trading statistics');

    // Mock data for demo purposes
    // In a real implementation, you'd query from database or blockchain
    return {
      totalSwaps: 1250,
      totalVolume: BigInt('100000000000000000000000'), // 100,000 tokens
      averageGasPrice: BigInt('5000000000'), // 5 Gwei
      popularPairs: [
        {
          token0: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address, // WBNB
          token1: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address, // BUSD
          volume24h: BigInt('50000000000000000000000'), // 50,000 tokens
        },
        {
          token0: '0x55d398326f99059fF775485246999027B3197955' as Address, // USDT
          token1: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address, // BUSD
          volume24h: BigInt('30000000000000000000000'), // 30,000 tokens
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to get trading statistics: %O', error);
    throw new Error(`Trading statistics failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate swap parameters
 */
export function validateSwapParams(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  amountOutMin: bigint,
  slippageTolerance: number
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate addresses
  if (tokenIn === tokenOut) {
    errors.push('Token addresses cannot be the same');
  }

  if (tokenIn === '0x0000000000000000000000000000000000000000000' as Address ||
      tokenOut === '0x0000000000000000000000000000000000000000000' as Address) {
    errors.push('Invalid token address (zero address)');
  }

  // Validate amounts
  if (amountIn <= 0n) {
    errors.push('Amount in must be greater than 0');
  }

  if (amountOutMin <= 0n) {
    errors.push('Minimum output amount must be greater than 0');
  }

  // Validate slippage tolerance
  if (slippageTolerance < 0 || slippageTolerance > 1) {
    errors.push('Slippage tolerance must be between 0 and 1');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default {
  getSwapPrice,
  getSwapQuotes,
  executeSwap,
  getBestSwapRoute,
  checkPairExists,
  getTradingStatistics,
  validateSwapParams,
};