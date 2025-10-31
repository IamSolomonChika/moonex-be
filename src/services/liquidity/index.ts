import { AMMCalculator } from '../trading/amm-calculator';
import { getDatabase } from '../../config/database';
import logger from '../../utils/logger';
import type { LiquidityPool as DbLiquidityPool, LiquidityPosition as DbLiquidityPosition } from '../../generated/prisma';

/**
 * Token information interface
 */
export interface Token {
  address: string;
  symbol: string;
  decimals: number;
  name?: string;
}

/**
 * Liquidity pool interface
 */
export interface LiquidityPool {
  id: string;
  address: string;
  token0: Token;
  token1: Token;
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  fee: string;
  volume24h: string;
  fee24h: string;
  tvl: string;
  apr: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create pool request interface
 */
export interface CreatePoolRequest {
  token0: Token;
  token1: Token;
  fee?: string; // Default 0.3%
  initialAmount0?: string;
  initialAmount1?: string;
}

/**
 * Add liquidity request interface
 */
export interface AddLiquidityRequest {
  poolId: string;
  amount0: string;
  amount1: string;
  slippageTolerance?: string;
  minimumLPTokens?: string;
  userAddress: string;
}

/**
 * Remove liquidity request interface
 */
export interface RemoveLiquidityRequest {
  poolId: string;
  lpTokenAmount: string;
  slippageTolerance?: string;
  minimumAmount0?: string;
  minimumAmount1?: string;
  userAddress: string;
}

/**
 * Liquidity operation result interface
 */
export interface LiquidityResult {
  success: boolean;
  pool?: LiquidityPool;
  lpTokens?: string;
  amounts?: {
    token0: string;
    token1: string;
  };
  impermanentLoss?: string;
  error?: string;
  warnings?: string[];
}

/**
 * Liquidity position interface
 */
export interface LiquidityPosition {
  id: string;
  poolId: string;
  pool: LiquidityPool;
  lpTokenBalance: string;
  token0Amount: string;
  token1Amount: string;
  valueUSD: string;
  impermanentLoss: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Pool analytics interface
 */
export interface PoolAnalytics {
  volume24h: string;
  fee24h: string;
  tvl: string;
  apr: string;
  price0: string;
  price1: string;
  totalSupply: string;
  liquidityUtilization: string;
  feesGenerated: string;
}

/**
 * Liquidity Pool Service class
 */
export class LiquidityService {
  private ammCalculator: AMMCalculator;
  private readonly DEFAULT_FEE = '0.003'; // 0.3%
  private readonly MINIMUM_LIQUIDITY = '1000';

  constructor() {
    this.ammCalculator = new AMMCalculator();
  }

  /**
   * Create a new liquidity pool
   */
  async createPool(request: CreatePoolRequest): Promise<LiquidityResult> {
    try {
      const { token0, token1, fee = this.DEFAULT_FEE, initialAmount0, initialAmount1 } = request;

      // Validate tokens
      if (token0.address === token1.address) {
        return {
          success: false,
          error: 'Token addresses must be different'
        };
      }

      // Check if pool already exists
      const existingPool = await this.findPoolByTokens(token0, token1);
      if (existingPool) {
        return {
          success: false,
          error: 'Pool already exists for this token pair'
        };
      }

      // For initial liquidity, validate amounts if provided
      let calculatedAmount0 = '0';
      let calculatedAmount1 = '0';

      if (initialAmount0 && initialAmount1) {
        // Calculate optimal amounts based on initial ratio
        const amounts = this.ammCalculator.calculateLiquidityAmounts(
          initialAmount0,
          initialAmount1,
          '0', // No existing reserves
          '0'
        );
        calculatedAmount0 = amounts.amount0;
        calculatedAmount1 = amounts.amount1;
      }

      // Create pool in database
      const db = getDatabase();
      const pool = await db.liquidityPool.create({
        data: {
          address: this.generatePoolAddress(token0.address, token1.address),
          token0Address: token0.address,
          token1Address: token1.address,
          token0Symbol: token0.symbol,
          token1Symbol: token1.symbol,
          token0Decimals: token0.decimals,
          token1Decimals: token1.decimals,
          reserve0: calculatedAmount0,
          reserve1: calculatedAmount1,
          totalSupply: calculatedAmount0 && calculatedAmount1 ?
            this.ammCalculator.calculateLPTokens(
              calculatedAmount0,
              calculatedAmount1,
              '0', // No existing reserves
              '0',
              '0'  // No existing supply
            ) : '0',
          fee,
          isActive: true
        }
      });

      logger.info(`Created new pool: ${token0.symbol}/${token1.symbol} with fee ${fee}`);

      return {
        success: true,
        pool: await this.mapDbPoolToPool(pool),
        lpTokens: pool.totalSupply
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to create pool');
      return {
        success: false,
        error: 'Failed to create pool'
      };
    }
  }

  /**
   * Add liquidity to an existing pool
   */
  async addLiquidity(request: AddLiquidityRequest): Promise<LiquidityResult> {
    try {
      const { poolId, amount0, amount1, slippageTolerance = '0.005', minimumLPTokens, userAddress } = request;

      // Get pool
      const pool = await this.getPoolById(poolId);
      if (!pool) {
        return {
          success: false,
          error: 'Pool not found'
        };
      }

      // Calculate optimal amounts
      const optimalAmounts = this.ammCalculator.calculateLiquidityAmounts(
        amount0,
        amount1,
        pool.reserve0,
        pool.reserve1
      );

      // Calculate LP tokens to mint
      const lpTokens = this.ammCalculator.calculateLPTokens(
        optimalAmounts.amount0,
        optimalAmounts.amount1,
        pool.reserve0,
        pool.reserve1,
        pool.totalSupply
      );

      // Validate against minimum LP tokens if specified
      if (minimumLPTokens) {
        if (parseFloat(lpTokens) < parseFloat(minimumLPTokens)) {
          return {
            success: false,
            error: `LP tokens ${lpTokens} is below minimum ${minimumLPTokens}`
          };
        }
      }

      // Update pool reserves
      const db = getDatabase();
      const updatedPool = await db.liquidityPool.update({
        where: { id: poolId },
        data: {
          reserve0: (parseFloat(pool.reserve0) + parseFloat(optimalAmounts.amount0)).toString(),
          reserve1: (parseFloat(pool.reserve1) + parseFloat(optimalAmounts.amount1)).toString(),
          totalSupply: (parseFloat(pool.totalSupply) + parseFloat(lpTokens)).toString(),
          tvl: this.calculateTVL(
            (parseFloat(pool.reserve0) + parseFloat(optimalAmounts.amount0)).toString(),
            (parseFloat(pool.reserve1) + parseFloat(optimalAmounts.amount1)).toString()
          )
        }
      });

      // Create or update user position
      await this.updateUserPosition(userAddress, poolId, optimalAmounts.amount0, optimalAmounts.amount1);

      logger.info(`Added liquidity to pool ${poolId}: ${optimalAmounts.amount0} ${pool.token0.symbol} + ${optimalAmounts.amount1} ${pool.token1.symbol}`);

      return {
        success: true,
        pool: await this.mapDbPoolToPool(updatedPool),
        lpTokens,
        amounts: {
          token0: optimalAmounts.amount0,
          token1: optimalAmounts.amount1
        }
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to add liquidity');
      return {
        success: false,
        error: 'Failed to add liquidity'
      };
    }
  }

  /**
   * Remove liquidity from a pool
   */
  async removeLiquidity(request: RemoveLiquidityRequest): Promise<LiquidityResult> {
    try {
      const { poolId, lpTokenAmount, slippageTolerance = '0.005', minimumAmount0, minimumAmount1, userAddress } = request;

      // Get pool
      const pool = await this.getPoolById(poolId);
      if (!pool) {
        return {
          success: false,
          error: 'Pool not found'
        };
      }

      // Calculate token amounts to return
      const totalSupply = parseFloat(pool.totalSupply);
      const lpAmount = parseFloat(lpTokenAmount);

      if (lpAmount > totalSupply) {
        return {
          success: false,
          error: 'LP token amount exceeds total supply'
        };
      }

      const amount0 = (parseFloat(pool.reserve0) * lpAmount / totalSupply).toString();
      const amount1 = (parseFloat(pool.reserve1) * lpAmount / totalSupply).toString();

      // Validate against minimum amounts if specified
      if (minimumAmount0 && parseFloat(amount0) < parseFloat(minimumAmount0)) {
        return {
          success: false,
          error: `Token0 amount ${amount0} is below minimum ${minimumAmount0}`
        };
      }

      if (minimumAmount1 && parseFloat(amount1) < parseFloat(minimumAmount1)) {
        return {
          success: false,
          error: `Token1 amount ${amount1} is below minimum ${minimumAmount1}`
        };
      }

      // Update pool reserves
      const db = getDatabase();
      const updatedPool = await db.liquidityPool.update({
        where: { id: poolId },
        data: {
          reserve0: (parseFloat(pool.reserve0) - parseFloat(amount0)).toString(),
          reserve1: (parseFloat(pool.reserve1) - parseFloat(amount1)).toString(),
          totalSupply: (parseFloat(pool.totalSupply) - parseFloat(lpTokenAmount)).toString(),
          tvl: this.calculateTVL(
            (parseFloat(pool.reserve0) - parseFloat(amount0)).toString(),
            (parseFloat(pool.reserve1) - parseFloat(amount1)).toString()
          )
        }
      });

      // Update or remove user position
      await this.updateUserPositionAfterRemoval(userAddress, poolId, lpTokenAmount);

      // Calculate impermanent loss
      const currentPriceRatio = parseFloat(pool.reserve1) / parseFloat(pool.reserve0);
      const impermanentLoss = this.ammCalculator.calculateImpermanentLoss(
        currentPriceRatio.toString(),
        '1' // Assuming 1:1 initial ratio
      );

      logger.info(`Removed liquidity from pool ${poolId}: ${amount0} ${pool.token0.symbol} + ${amount1} ${pool.token1.symbol}`);

      return {
        success: true,
        pool: await this.mapDbPoolToPool(updatedPool),
        amounts: {
          token0: amount0,
          token1: amount1
        },
        impermanentLoss
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to remove liquidity');
      return {
        success: false,
        error: 'Failed to remove liquidity'
      };
    }
  }

  /**
   * Get all active pools
   */
  async getAllPools(): Promise<LiquidityPool[]> {
    try {
      const db = getDatabase();
      const pools = await db.liquidityPool.findMany({
        where: { isActive: true },
        orderBy: { tvl: 'desc' }
      });

      return Promise.all(pools.map(pool => this.mapDbPoolToPool(pool)));

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get all pools');
      return [];
    }
  }

  /**
   * Get pool by ID
   */
  async getPoolById(poolId: string): Promise<LiquidityPool | null> {
    try {
      const db = getDatabase();
      const pool = await db.liquidityPool.findUnique({
        where: { id: poolId, isActive: true }
      });

      return pool ? this.mapDbPoolToPool(pool) : null;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get pool by ID');
      return null;
    }
  }

  /**
   * Get pool by token pair
   */
  async getPoolByTokenPair(tokenA: Token, tokenB: Token): Promise<LiquidityPool | null> {
    try {
      const pool = await this.findPoolByTokens(tokenA, tokenB);
      return pool ? this.mapDbPoolToPool(pool) : null;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get pool by token pair');
      return null;
    }
  }

  /**
   * Get user's liquidity positions
   */
  async getUserPositions(userAddress: string): Promise<LiquidityPosition[]> {
    try {
      const db = getDatabase();
      const positions = await db.liquidityPosition.findMany({
        where: { userId: userAddress },
        include: { pool: true },
        orderBy: { createdAt: 'desc' }
      });

      return Promise.all(positions.map(position => this.mapDbPositionToPosition(position)));

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get user positions');
      return [];
    }
  }

  /**
   * Get pool analytics
   */
  async getPoolAnalytics(poolId: string): Promise<PoolAnalytics | null> {
    try {
      const pool = await this.getPoolById(poolId);
      if (!pool) {
        return null;
      }

      const price0 = parseFloat(pool.reserve1) / parseFloat(pool.reserve0);
      const price1 = parseFloat(pool.reserve0) / parseFloat(pool.reserve1);
      const totalReserveValue = parseFloat(pool.reserve0) * price0 + parseFloat(pool.reserve1);
      const liquidityUtilization = parseFloat(pool.volume24h) / totalReserveValue;

      return {
        volume24h: pool.volume24h,
        fee24h: pool.fee24h,
        tvl: pool.tvl,
        apr: pool.apr,
        price0: price0.toString(),
        price1: price1.toString(),
        totalSupply: pool.totalSupply,
        liquidityUtilization: liquidityUtilization.toString(),
        feesGenerated: pool.fee24h
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get pool analytics');
      return null;
    }
  }

  // Private helper methods

  /**
   * Find pool by tokens
   */
  private async findPoolByTokens(tokenA: Token, tokenB: Token): Promise<DbLiquidityPool | null> {
    const db = getDatabase();
    return await db.liquidityPool.findFirst({
      where: {
        OR: [
          {
            token0Address: tokenA.address,
            token1Address: tokenB.address
          },
          {
            token0Address: tokenB.address,
            token1Address: tokenA.address
          }
        ],
        isActive: true
      }
    });
  }

  /**
   * Update user position
   */
  private async updateUserPosition(
    userAddress: string,
    poolId: string,
    amount0: string,
    amount1: string
  ): Promise<void> {
    const db = getDatabase();
    const existingPosition = await db.liquidityPosition.findUnique({
      where: { userId_poolId: { userId: userAddress, poolId } }
    });

    if (existingPosition) {
      // Update existing position
      await db.liquidityPosition.update({
        where: { userId_poolId: { userId: userAddress, poolId } },
        data: {
          lpTokenBalance: (parseFloat(existingPosition.lpTokenBalance) +
            this.ammCalculator.calculateLPTokens(amount0, amount1, '0', '0', '0')).toString(),
          token0Amount: (parseFloat(existingPosition.token0Amount) + parseFloat(amount0)).toString(),
          token1Amount: (parseFloat(existingPosition.token1Amount) + parseFloat(amount1)).toString(),
          valueUSD: this.calculatePositionValue(amount0, amount1),
          updatedAt: new Date()
        }
      });
    } else {
      // Create new position
      const lpTokens = this.ammCalculator.calculateLPTokens(amount0, amount1, '0', '0', '0');
      await db.liquidityPosition.create({
        data: {
          userId: userAddress,
          poolId,
          lpTokenBalance: lpTokens,
          token0Amount: amount0,
          token1Amount: amount1,
          valueUSD: this.calculatePositionValue(amount0, amount1)
        }
      });
    }
  }

  /**
   * Update user position after liquidity removal
   */
  private async updateUserPositionAfterRemoval(
    userAddress: string,
    poolId: string,
    lpTokenAmount: string
  ): Promise<void> {
    const db = getDatabase();
    const position = await db.liquidityPosition.findUnique({
      where: { userId_poolId: { userId: userAddress, poolId } }
    });

    if (!position) {
      return; // Position not found, nothing to update
    }

    const newLpBalance = (parseFloat(position.lpTokenBalance) - parseFloat(lpTokenAmount)).toString();

    if (parseFloat(newLpBalance) <= 0) {
      // Remove position entirely
      await db.liquidityPosition.delete({
        where: { userId_poolId: { userId: userAddress, poolId } }
      });
    } else {
      // Update position proportionally
      const ratio = parseFloat(newLpBalance) / parseFloat(position.lpTokenBalance);
      const newToken0Amount = (parseFloat(position.token0Amount) * ratio).toString();
      const newToken1Amount = (parseFloat(position.token1Amount) * ratio).toString();

      await db.liquidityPosition.update({
        where: { userId_poolId: { userId: userAddress, poolId } },
        data: {
          lpTokenBalance: newLpBalance,
          token0Amount: newToken0Amount,
          token1Amount: newToken1Amount,
          valueUSD: this.calculatePositionValue(newToken0Amount, newToken1Amount),
          updatedAt: new Date()
        }
      });
    }
  }

  /**
   * Calculate Total Value Locked (TVL)
   */
  private calculateTVL(reserve0: string, reserve1: string): string {
    // This is a simplified calculation - in production, you'd use real price oracles
    const priceRatio = 1; // 1:1 ratio for simplicity
    return (parseFloat(reserve0) * priceRatio + parseFloat(reserve1)).toString();
  }

  /**
   * Calculate position value
   */
  private calculatePositionValue(amount0: string, amount1: string): string {
    // Simplified calculation - in production, use real prices
    return (parseFloat(amount0) + parseFloat(amount1)).toString();
  }

  /**
   * Map database pool to Pool interface
   */
  private async mapDbPoolToPool(dbPool: DbLiquidityPool): Promise<LiquidityPool> {
    return {
      id: dbPool.id,
      address: dbPool.address,
      token0: {
        address: dbPool.token0Address,
        symbol: dbPool.token0Symbol,
        decimals: dbPool.token0Decimals
      },
      token1: {
        address: dbPool.token1Address,
        symbol: dbPool.token1Symbol,
        decimals: dbPool.token1Decimals
      },
      reserve0: dbPool.reserve0,
      reserve1: dbPool.reserve1,
      totalSupply: dbPool.totalSupply,
      fee: dbPool.fee,
      volume24h: dbPool.volume24h,
      fee24h: dbPool.fee24h,
      tvl: dbPool.tvl,
      apr: dbPool.apr,
      isActive: dbPool.isActive,
      createdAt: dbPool.createdAt,
      updatedAt: dbPool.updatedAt
    };
  }

  /**
   * Map database position to Position interface
   */
  private async mapDbPositionToPosition(dbPosition: DbLiquidityPosition & { pool: DbLiquidityPool }): Promise<LiquidityPosition> {
    return {
      id: dbPosition.id,
      poolId: dbPosition.poolId,
      pool: await this.mapDbPoolToPool(dbPosition.pool),
      lpTokenBalance: dbPosition.lpTokenBalance,
      token0Amount: dbPosition.token0Amount,
      token1Amount: dbPosition.token1Amount,
      valueUSD: dbPosition.valueUSD,
      impermanentLoss: dbPosition.impermanentLoss,
      createdAt: dbPosition.createdAt,
      updatedAt: dbPosition.updatedAt
    };
  }

  /**
   * Generate mock pool address (for simulation)
   */
  private generatePoolAddress(token0Address: string, token1Address: string): string {
    // In production, this would be generated by a factory contract
    return '0x' + Array.from({length: 40}, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }
}