import { AMMCalculator, SwapQuote } from './amm-calculator';
import { getDatabase } from '../../config/database';
import logger from '../../utils/logger';
import type { LiquidityPool as DbLiquidityPool, Swap as DbSwap } from '@prisma/client';

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
 * Swap request interface
 */
export interface SwapRequest {
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  slippageTolerance?: string; // Default 0.5%
  userAddress?: string;
}

/**
 * Swap result interface
 */
export interface SwapResult {
  success: boolean;
  quote?: SwapQuote;
  transactionHash?: string;
  error?: string;
  warnings?: string[];
}

/**
 * Liquidity pool data interface
 */
export interface PoolData {
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
}

/**
 * Route finding result interface
 */
export interface Route {
  pools: PoolData[];
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  amountOut: string;
  totalFee: string;
  totalSlippage: string;
  priceImpact: string;
}

/**
 * Gas estimation interface
 */
export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  totalCost: string;
  estimatedTime: string; // in seconds
}

/**
 * Main Trading Service class
 */
export class TradingService {
  private ammCalculator: AMMCalculator;

  constructor() {
    this.ammCalculator = new AMMCalculator();
  }

  /**
   * Get swap quote for a token pair
   */
  async getSwapQuote(request: SwapRequest): Promise<SwapResult> {
    try {
      // Find the appropriate pool for the token pair
      const pool = await this.findPool(request.tokenIn, request.tokenOut);

      if (!pool) {
        return {
          success: false,
          error: 'No pool found for this token pair'
        };
      }

      // Determine input and output reserves based on token order
      const { reserveIn, reserveOut, isInverted } = this.getReserves(
        pool,
        request.tokenIn,
        request.tokenOut
      );

      if (reserveIn === '0' || reserveOut === '0') {
        return {
          success: false,
          error: 'Insufficient liquidity in pool'
        };
      }

      // Generate quote using AMM calculator
      const quote = this.ammCalculator.generateSwapQuote(
        request.amountIn,
        reserveIn,
        reserveOut,
        pool.fee,
        request.slippageTolerance || '0.005'
      );

      // Validate quote for large price impacts
      const warnings: string[] = [];
      const priceImpact = parseFloat(quote.priceImpact);

      if (priceImpact > 5) {
        warnings.push(`High price impact: ${quote.priceImpact}%`);
      }

      if (priceImpact > 10) {
        return {
          success: false,
          error: 'Price impact too high. Consider reducing amount or waiting for better liquidity.'
        };
      }

      return {
        success: true,
        quote,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get swap quote');
      return {
        success: false,
        error: 'Failed to calculate swap quote'
      };
    }
  }

  /**
   * Execute a swap transaction
   */
  async executeSwap(request: SwapRequest): Promise<SwapResult> {
    try {
      // Get quote first
      const quoteResult = await this.getSwapQuote(request);

      if (!quoteResult.success || !quoteResult.quote) {
        return quoteResult;
      }

      // For this implementation, we'll simulate the swap
      // In a real implementation, this would interact with smart contracts

      const pool = await this.findPool(request.tokenIn, request.tokenOut);
      if (!pool) {
        return {
          success: false,
          error: 'Pool not found'
        };
      }

      // Simulate transaction execution
      const transactionHash = this.generateTransactionHash();

      // Update pool reserves (simulation)
      await this.updatePoolReserves(pool, request.tokenIn, request.tokenOut, quoteResult.quote);

      // Record swap in database
      await this.recordSwap({
        userId: request.userAddress || null,
        poolId: pool.id,
        transactionHash,
        tokenInAddress: request.tokenIn.address,
        tokenOutAddress: request.tokenOut.address,
        tokenInSymbol: request.tokenIn.symbol,
        tokenOutSymbol: request.tokenOut.symbol,
        tokenInAmount: request.amountIn,
        tokenOutAmount: quoteResult.quote.outputAmount,
        price: quoteResult.quote.price,
        fee: quoteResult.quote.fee,
        slippage: quoteResult.quote.priceImpact,
        status: 'completed'
      });

      logger.info(`Swap executed: ${request.amountIn} ${request.tokenIn.symbol} -> ${quoteResult.quote.outputAmount} ${request.tokenOut.symbol}`);

      return {
        success: true,
        quote: quoteResult.quote,
        transactionHash
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to execute swap');
      return {
        success: false,
        error: 'Failed to execute swap'
      };
    }
  }

  /**
   * Find best route for multi-hop swaps
   */
  async findBestRoute(
    tokenIn: Token,
    tokenOut: Token,
    amountIn: string,
    maxHops: number = 3
  ): Promise<Route | null> {
    try {
      // For now, implement simple direct swap routing
      // In a full implementation, this would use graph algorithms like Dijkstra

      const directPool = await this.findPool(tokenIn, tokenOut);
      if (directPool) {
        const quoteResult = await this.getSwapQuote({
          tokenIn,
          tokenOut,
          amountIn
        });

        if (quoteResult.success && quoteResult.quote) {
          return {
            pools: [await this.mapPoolToPoolData(directPool)],
            tokenIn,
            tokenOut,
            amountIn,
            amountOut: quoteResult.quote.outputAmount,
            totalFee: quoteResult.quote.fee,
            totalSlippage: quoteResult.quote.priceImpact,
            priceImpact: quoteResult.quote.priceImpact
          };
        }
      }

      // In a full implementation, this would search for multi-hop routes
      // For now, return null if no direct route found
      return null;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to find best route');
      return null;
    }
  }

  /**
   * Estimate gas costs for transactions
   */
  async estimateGasCosts(
    transactionType: 'swap' | 'addLiquidity' | 'removeLiquidity',
    params: any = {}
  ): Promise<GasEstimate> {
    try {
      // These are rough estimates - in production, you'd get real gas prices from the network
      const baseGas = {
        swap: '150000',
        addLiquidity: '200000',
        removeLiquidity: '180000'
      };

      const gasLimit = baseGas[transactionType];

      // Mock gas price - in production, get from network
      const gasPrice = '20000000000'; // 20 gwei
      const maxFeePerGas = '30000000000'; // 30 gwei
      const maxPriorityFeePerGas = '2000000000'; // 2 gwei

      const totalCost = (parseFloat(gasLimit) * parseFloat(gasPrice)).toString();

      return {
        gasLimit,
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
        totalCost,
        estimatedTime: '30' // seconds
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to estimate gas costs');
      throw new Error('Gas estimation failed');
    }
  }

  /**
   * Get all active liquidity pools
   */
  async getAllPools(): Promise<PoolData[]> {
    try {
      const db = getDatabase();
      const pools = await db.liquidityPool.findMany({
        where: { isActive: true },
        orderBy: { tvl: 'desc' }
      });

      return Promise.all(pools.map(pool => this.mapPoolToPoolData(pool)));

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get pools');
      return [];
    }
  }

  /**
   * Get pool by token pair
   */
  async getPoolByTokenPair(tokenA: Token, tokenB: Token): Promise<PoolData | null> {
    try {
      const pool = await this.findPool(tokenA, tokenB);
      return pool ? this.mapPoolToPoolData(pool) : null;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get pool by token pair');
      return null;
    }
  }

  // Private helper methods

  /**
   * Find pool for token pair
   */
  private async findPool(tokenA: Token, tokenB: Token): Promise<DbLiquidityPool | null> {
    const db = getDatabase();

    // Try both orderings since pool could have tokens in either order
    const pool = await db.liquidityPool.findFirst({
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

    return pool;
  }

  /**
   * Get reserves in correct order based on input tokens
   */
  private getReserves(
    pool: DbLiquidityPool,
    tokenIn: Token,
    tokenOut: Token
  ): { reserveIn: string; reserveOut: string; isInverted: boolean } {
    const isInverted = pool.token0Address !== tokenIn.address;

    return {
      reserveIn: isInverted ? pool.reserve1 : pool.reserve0,
      reserveOut: isInverted ? pool.reserve0 : pool.reserve1,
      isInverted
    };
  }

  /**
   * Update pool reserves after swap
   */
  private async updatePoolReserves(
    pool: DbLiquidityPool,
    tokenIn: Token,
    tokenOut: Token,
    quote: SwapQuote
  ): Promise<void> {
    const db = getDatabase();
    const { reserveIn, reserveOut, isInverted } = this.getReserves(pool, tokenIn, tokenOut);

    const newReserveIn = new Decimal(reserveIn).plus(quote.inputAmount).toString();
    const newReserveOut = new Decimal(reserveOut).minus(quote.outputAmount).toString();

    await db.liquidityPool.update({
      where: { id: pool.id },
      data: {
        reserve0: isInverted ? newReserveOut : newReserveIn,
        reserve1: isInverted ? newReserveIn : newReserveOut,
        volume24h: new Decimal(pool.volume24h).plus(quote.inputAmount).toString(),
        fee24h: new Decimal(pool.fee24h).plus(quote.fee).toString()
      }
    });
  }

  /**
   * Record swap transaction in database
   */
  private async recordSwap(swapData: {
    userId: string | null;
    poolId: string;
    transactionHash: string;
    tokenInAddress: string;
    tokenOutAddress: string;
    tokenInSymbol: string;
    tokenOutSymbol: string;
    tokenInAmount: string;
    tokenOutAmount: string;
    price: string;
    fee: string;
    slippage: string;
    status: string;
  }): Promise<void> {
    const db = getDatabase();
    await db.swap.create({
      data: {
        ...swapData,
        createdAt: new Date(),
        confirmedAt: new Date()
      }
    });
  }

  /**
   * Map database pool to PoolData interface
   */
  private async mapPoolToPoolData(pool: DbLiquidityPool): Promise<PoolData> {
    // Explicitly type the pool parameter to avoid implicit any
    const typedPool: DbLiquidityPool = pool;
    return {
      id: typedPool.id,
      address: typedPool.address,
      token0: {
        address: typedPool.token0Address,
        symbol: typedPool.token0Symbol,
        decimals: typedPool.token0Decimals
      },
      token1: {
        address: typedPool.token1Address,
        symbol: typedPool.token1Symbol,
        decimals: typedPool.token1Decimals
      },
      reserve0: typedPool.reserve0,
      reserve1: typedPool.reserve1,
      totalSupply: typedPool.totalSupply,
      fee: typedPool.fee,
      volume24h: typedPool.volume24h,
      fee24h: typedPool.fee24h,
      tvl: typedPool.tvl,
      apr: typedPool.apr,
      isActive: typedPool.isActive
    };
  }

  /**
   * Generate mock transaction hash (for simulation)
   */
  private generateTransactionHash(): string {
    return '0x' + Array.from({length: 64}, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }
}

// Import Decimal for the helper methods
import { Decimal } from 'decimal.js';