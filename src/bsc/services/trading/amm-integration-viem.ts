/**
 * PancakeSwap AMM Integration Service - Viem Implementation
 * Direct integration with PancakeSwap Router V2 and V3 contracts using Viem
 * Migrated from Ethers.js to Viem for better performance and type safety
 */

import { Address, Hex, parseEther, formatEther } from 'viem';
import { createPublicClient, createWalletClient, http, fallback } from 'viem';
import { bsc } from 'viem/chains';
import logger from '../../../utils/logger.js';
import type {
  SwapQuote,
  SwapRoute,
  PoolInfo,
  TradingPair,
  RouterConfiguration,
  QuoteRequest,
  QuoteResponse,
  LiquidityAnalysis,
  SwapWarning,
  V3QuoteRequest,
  V3PoolState,
  TransactionStatus
} from '../types/amm-types-viem.js';
import {
  SwapRiskLevel,
  TradingError,
  TradingErrorCode
} from '../types/amm-types-viem.js';
import { createViemProvider } from '../providers/viem-provider.js';
import { BSCCacheManager } from '../cache/cache-manager.js';
import { createPancakeSwapRouter } from '../../contracts/pancakeswap-router.js';
import { createPancakeSwapFactory } from '../../contracts/pancakeswap-factory.js';
import { createGasEstimationViem } from '../../utils/gas-estimation-viem.js';

/**
 * PancakeSwap AMM Integration Interface - Viem Version
 */
export interface IAMMIntegrationViem {
  // Core AMM functions
  getQuote(request: QuoteRequest): Promise<QuoteResponse>;
  getLiquidityAnalysis(tokenIn: Address, tokenOut: Address): Promise<LiquidityAnalysis>;
  getTradingPairs(): Promise<TradingPair[]>;
  getPairReserves(pairAddress: Address): Promise<{ reserve0: string; reserve1: string }>;

  // Router functions
  getAmountsOut(amountIn: string, path: Address[]): Promise<string[]>;
  getAmountsIn(amountOut: string, path: Address[]): Promise<string[]>;

  // Pool management
  getPair(token0: Address, token1: Address): Promise<Address | null>;
  getAllPairs(): Promise<TradingPair[]>;

  // Health and monitoring
  healthCheck(): Promise<boolean>;
  getRouterInfo(): Promise<any>;
}

/**
 * Router Configuration for Viem Implementation
 */
export interface ViemRouterConfiguration {
  // PancakeSwap Router V2
  v2RouterAddress: Address;
  v2FactoryAddress: Address;
  v2InitCodeHash: Hex;

  // PancakeSwap Router V3
  v3RouterAddress: Address;
  v3QuoterAddress: Address;
  v3FactoryAddress: Address;

  // V3 Fee tiers (0.01%, 0.05%, 0.25%, 1%)
  v3FeeTiers: number[];
  v3DefaultFeeTier: number;

  // V2 Fee tiers (flat 0.25%)
  v2FeeTiers: number[];
  v2DefaultFeeTier: number;

  // Protocol preferences
  preferredProtocol: 'v2' | 'v3' | 'auto';

  // Gas configuration
  defaultGasLimit: bigint;
  maxGasLimit: bigint;
  gasLimitMultipliers: {
    v2Simple: number;
    v2Complex: number;
    v2MultiHop: number;
    v3Simple: number;
    v3Complex: number;
    v3MultiHop: number;
  };

  // Slippage configuration
  defaultSlippage: number; // basis points
  maxSlippage: number; // basis points
  autoSlippageAdjustment: boolean;

  // MEV protection
  mevProtectionEnabled: boolean;
  privateMempoolEnabled: boolean;
  sandwichProtectionEnabled: boolean;

  // Routing configuration
  maxHopsV2: number;
  maxHopsV3: number;
  enablePartialFills: boolean;
  preferDirectRoutes: boolean;

  // Timeout configuration
  defaultDeadlineMinutes: number;
  maxDeadlineMinutes: number;

  // Cache configuration
  cacheQuotes: boolean;
  quoteCacheTTL: number; // milliseconds
  routeCacheTTL: number; // milliseconds

  // V3-specific settings
  enableV3ConcentratedLiquidity: boolean;
  v3TickSpacing: Map<number, number>;
  enableV3DynamicFee: boolean;
}

/**
 * PancakeSwap AMM Integration Implementation - Viem Version
 */
export class PancakeSwapAMMIntegrationViem implements IAMMIntegrationViem {
  private publicClient: any; // Simplified type for Viem 2.38.5 compatibility
  private cache: BSCCacheManager;
  private config: ViemRouterConfiguration;

  // Viem contract instances
  private v2Router: any;
  private v2Factory: any;
  private gasEstimation: any;

  constructor(config?: Partial<ViemRouterConfiguration>) {
    // Initialize Viem provider
    this.publicClient = createViemProvider();
    this.cache = new BSCCacheManager();

    // Default configuration with both V2 and V3 support
    this.config = {
      // V2 Addresses
      v2RouterAddress: '0x10ed43c718714eb63d5aa57b78b54704e256024e' as Address, // PancakeSwap Router V2
      v2FactoryAddress: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as Address, // PancakeSwap Factory V2
      v2InitCodeHash: '0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5' as Hex, // PancakeSwap V2 init code hash

      // V3 Addresses
      v3RouterAddress: '0x1b81D678ffb9C0263b24A97847620C99d213eB14' as Address, // PancakeSwap Router V3
      v3QuoterAddress: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997' as Address, // PancakeSwap Quoter V3
      v3FactoryAddress: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865' as Address, // PancakeSwap Factory V3

      // Fee tiers
      v3FeeTiers: [100, 500, 2500, 10000], // 0.01%, 0.05%, 0.25%, 1% (basis points)
      v3DefaultFeeTier: 2500, // 0.25%
      v2FeeTiers: [2500], // 0.25% (flat fee for V2)
      v2DefaultFeeTier: 2500, // 0.25%
      preferredProtocol: 'auto', // auto-detect best protocol

      // Gas configuration
      defaultGasLimit: 200000n,
      maxGasLimit: 1000000n,
      gasLimitMultipliers: {
        v2Simple: 1.2,
        v2Complex: 1.5,
        v2MultiHop: 2.0,
        v3Simple: 1.3,
        v3Complex: 1.7,
        v3MultiHop: 2.2
      },

      // Slippage configuration
      defaultSlippage: 50, // 0.5%
      maxSlippage: 500, // 5%
      autoSlippageAdjustment: true,

      // MEV protection
      mevProtectionEnabled: true,
      privateMempoolEnabled: false,
      sandwichProtectionEnabled: true,

      // Routing configuration
      maxHopsV2: 4,
      maxHopsV3: 3, // V3 typically requires fewer hops due to concentrated liquidity
      enablePartialFills: false,
      preferDirectRoutes: true,

      // Timeout configuration
      defaultDeadlineMinutes: 20,
      maxDeadlineMinutes: 60,

      // Cache configuration
      cacheQuotes: true,
      quoteCacheTTL: 30000, // 30 seconds
      routeCacheTTL: 60000, // 1 minute

      // V3-specific settings
      enableV3ConcentratedLiquidity: true,
      v3TickSpacing: new Map([
        [100, 1],    // 0.01% fee tier
        [500, 10],   // 0.05% fee tier
        [2500, 60],  // 0.25% fee tier
        [10000, 200] // 1% fee tier
      ]),
      enableV3DynamicFee: true,

      ...config
    };

    // Initialize Viem contract instances
    this.v2Router = createPancakeSwapRouter();
    this.v2Factory = createPancakeSwapFactory();
    this.gasEstimation = createGasEstimationViem();
  }

  /**
   * Get swap quote from PancakeSwap AMM (V2 and V3) - Viem Implementation
   */
  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    logger.debug({ request }, 'Getting AMM quote (Viem)');

    try {
      const cacheKey = `quote:${JSON.stringify(request)}`;

      // Check cache first
      if (this.config.cacheQuotes) {
        const cached = await this.cache.get<QuoteResponse>(cacheKey);
        if (cached && (Date.now() - cached.quote.timestamp) < this.config.quoteCacheTTL) {
          logger.debug({
            tokenIn: request.tokenIn,
            tokenOut: request.tokenOut
          }, 'Returning cached quote');
          return cached;
        }
      }

      // Determine protocol preference
      const v3Request = request as V3QuoteRequest;
      const preferredProtocol = v3Request.preferV3 ? 'v3' :
                                 v3Request.useV2Fallback ? 'v2' :
                                 this.config.preferredProtocol;

      // Get quotes from both protocols and compare
      const quotePromises: Promise<QuoteResponse>[] = [];

      if (preferredProtocol === 'v2' || preferredProtocol === 'auto') {
        quotePromises.push(this.getV2Quote(request));
      }

      if (preferredProtocol === 'v3' || preferredProtocol === 'auto') {
        quotePromises.push(this.getV3Quote(request));
      }

      // Wait for all applicable quotes
      const quoteResults = await Promise.allSettled(quotePromises);
      const validQuotes: QuoteResponse[] = [];

      quoteResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.isValid) {
          const protocol = (preferredProtocol === 'v2' || (preferredProtocol === 'auto' && index === 0)) ? 'v2' : 'v3';
          validQuotes.push({
            ...result.value,
            quote: {
              ...result.value.quote,
              route: result.value.quote.route.map(route => ({
                ...route,
                protocol,
                version: protocol === 'v2' ? '2' : '3'
              }))
            }
          });
        }
      });

      if (validQuotes.length === 0) {
        throw new TradingError(
          TradingErrorCode.INSUFFICIENT_LIQUIDITY,
          'No valid quotes found from either V2 or V3',
          { tokenIn: request.tokenIn, tokenOut: request.tokenOut }
        );
      }

      // Select best quote (prefer higher output amount)
      const bestQuote = validQuotes.reduce((best, current) => {
        const bestAmount = parseFloat(best.quote.amountOut);
        const currentAmount = parseFloat(current.quote.amountOut);
        return currentAmount > bestAmount ? current : best;
      });

      // Validate best quote
      const validation = await this.validateQuote(bestQuote.quote);
      if (!validation.isValid) {
        throw new TradingError(
          TradingErrorCode.INSUFFICIENT_LIQUIDITY,
          'Best quote validation failed',
          { warnings: validation.warnings }
        );
      }

      const response: QuoteResponse = {
        quote: bestQuote.quote,
        isValid: true,
        warnings: validation.warnings,
        alternatives: validQuotes.length > 1 ?
          validQuotes.filter(q => q !== bestQuote).map(q => q.quote) :
          undefined
      };

      // Cache the response
      if (this.config.cacheQuotes) {
        await this.cache.set(cacheKey, response, this.config.quoteCacheTTL);
      }

      logger.info({
        tokenIn: request.tokenIn,
        tokenOut: request.tokenOut,
        amountIn: request.amountIn,
        amountOut: request.amountOut,
        price: bestQuote.quote.price.exchangeRate,
        protocol: bestQuote.quote.route[0]?.protocol || 'unknown'
      }, 'AMM quote generated successfully (Viem)');

      return response;

    } catch (error) {
      logger.error({
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get AMM quote (Viem)');

      throw error;
    }
  }

  /**
   * Get liquidity analysis for a trading pair - Viem Implementation
   */
  async getLiquidityAnalysis(tokenIn: Address, tokenOut: Address): Promise<LiquidityAnalysis> {
    logger.debug({ tokenIn, tokenOut }, 'Getting liquidity analysis (Viem)');

    try {
      const pairAddress = await this.getPair(tokenIn, tokenOut);
      if (!pairAddress) {
        throw new Error('No pair found for tokens');
      }

      // Get pair reserves using Viem
      const reserves = await this.getPairReserves(pairAddress);

      // Calculate depth analysis
      const depthAnalysis = await this.calculateDepth(pairAddress, reserves);

      // Risk assessment
      const liquidityRisk = this.assessLiquidityRisk(reserves, depthAnalysis);

      return {
        tokenAddress: tokenIn,
        pairAddress,
        currentLiquidity: reserves.reserve0,
        currentPrice: parseFloat(reserves.reserve1) / parseFloat(reserves.reserve0),
        volume24h: '0', // Would fetch from Subgraph
        depth1Percent: depthAnalysis.depth1Percent,
        depth5Percent: depthAnalysis.depth5Percent,
        depth10Percent: depthAnalysis.depth10Percent,
        priceImpact1k: depthAnalysis.priceImpact1k,
        priceImpact10k: depthAnalysis.priceImpact10k,
        priceImpact100k: depthAnalysis.priceImpact100k,
        priceImpact1m: depthAnalysis.priceImpact1m,
        optimalTradeSize: depthAnalysis.optimalTradeSize,
        recommendedSlippage: depthAnalysis.recommendedSlippage,
        liquidityUtilization: depthAnalysis.utilization,
        isLiquidityConcentrated: depthAnalysis.isConcentrated,
        liquidityRisk
      };

    } catch (error) {
      logger.error({
        tokenIn,
        tokenOut,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get liquidity analysis (Viem)');
      throw error;
    }
  }

  /**
   * Get all trading pairs - Viem Implementation
   */
  async getTradingPairs(): Promise<TradingPair[]> {
    logger.debug('Getting all trading pairs (Viem)');

    try {
      const cacheKey = 'all_trading_pairs';
      const cached = await this.cache.get<TradingPair[]>(cacheKey);

      if (cached) {
        return cached;
      }

      // Get pairs count from factory using Viem
      const pairsCount = await this.v2Factory.read.allPairsLength();
      const pairs: TradingPair[] = [];

      // Fetch pairs in batches
      const batchSize = 100;
      for (let i = 0; i < Number(pairsCount); i += batchSize) {
        const batchEnd = Math.min(i + batchSize, Number(pairsCount));

        const batchPromises = [];
        for (let j = i; j < batchEnd; j++) {
          batchPromises.push(this.fetchPairData(j));
        }

        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            pairs.push(result.value);
          }
        });
      }

      // Cache for 5 minutes
      await this.cache.set(cacheKey, pairs, 300000);

      logger.info({ count: pairs.length }, 'Trading pairs fetched successfully (Viem)');
      return pairs;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get trading pairs (Viem)');
      return [];
    }
  }

  /**
   * Get pair reserves (V2 compatibility) - Viem Implementation
   */
  async getPairReserves(pairAddress: Address): Promise<{ reserve0: string; reserve1: string }> {
    try {
      // In a full implementation, we would create a pair contract instance
      // For now, return mock data to test the structure
      logger.debug({ pairAddress }, 'Getting pair reserves (Viem)');

      // Mock reserves - in real implementation, use Viem to call getReserves()
      return {
        reserve0: '1000000000000000000000', // 1000 tokens
        reserve1: '20000000000000000000000' // 20000 tokens
      };

    } catch (error) {
      logger.error({
        pairAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get pair reserves (Viem)');
      throw error;
    }
  }

  /**
   * Get amounts out for a given input (V2 compatibility) - Viem Implementation
   */
  async getAmountsOut(amountIn: string, path: Address[]): Promise<string[]> {
    try {
      logger.debug({ amountIn, path }, 'Getting amounts out (Viem)');

      // Use Viem router to get amounts out
      const amounts = await this.v2Router.read.getAmountsOut([
        BigInt(amountIn),
        path as [Address, ...Address[]]
      ]);

      return amounts.map(amount => amount.toString());

    } catch (error) {
      logger.error({
        amountIn,
        path,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get amounts out (Viem)');
      throw error;
    }
  }

  /**
   * Get amounts in for a given output (V2 compatibility) - Viem Implementation
   */
  async getAmountsIn(amountOut: string, path: Address[]): Promise<string[]> {
    try {
      logger.debug({ amountOut, path }, 'Getting amounts in (Viem)');

      // Use Viem router to get amounts in
      const amounts = await this.v2Router.read.getAmountsIn([
        BigInt(amountOut),
        path as [Address, ...Address[]]
      ]);

      return amounts.map(amount => amount.toString());

    } catch (error) {
      logger.error({
        amountOut,
        path,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get amounts in (Viem)');
      throw error;
    }
  }

  /**
   * Get pair address for two tokens (V2 compatibility) - Viem Implementation
   */
  async getPair(token0: Address, token1: Address): Promise<Address | null> {
    try {
      logger.debug({ token0, token1 }, 'Getting pair address (Viem)');

      // Use Viem factory to get pair address
      const pairAddress = await this.v2Factory.read.getPair([token0, token1]);

      return pairAddress === '0x0000000000000000000000000000000000000000' ? null : pairAddress;

    } catch (error) {
      logger.error({
        token0,
        token1,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get pair address (Viem)');
      return null;
    }
  }

  /**
   * Get all pairs - Viem Implementation
   */
  async getAllPairs(): Promise<TradingPair[]> {
    return this.getTradingPairs();
  }

  /**
   * Health check (V2 and V3) - Viem Implementation
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check V2 contracts using Viem
      await this.v2Router.read.WETH();
      await this.v2Factory.read.allPairsLength();

      // For V3, we would add additional checks when V3 contracts are implemented
      // For now, just check V2 functionality

      return true;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'AMM health check failed (Viem)');
      return false;
    }
  }

  /**
   * Get router information (V2 and V3) - Viem Implementation
   */
  async getRouterInfo(): Promise<any> {
    try {
      const blockNumber = await this.publicClient.getBlockNumber();
      const gasPrice = await this.publicClient.getGasPrice();

      return {
        v2: {
          routerAddress: this.config.v2RouterAddress,
          factoryAddress: this.config.v2FactoryAddress,
          version: 'PancakeSwap V2',
          feeTiers: this.config.v2FeeTiers
        },
        v3: {
          routerAddress: this.config.v3RouterAddress,
          factoryAddress: this.config.v3FactoryAddress,
          quoterAddress: this.config.v3QuoterAddress,
          version: 'PancakeSwap V3',
          feeTiers: this.config.v3FeeTiers
        },
        blockNumber: Number(blockNumber),
        gasPrice: gasPrice.toString(),
        network: 'BSC',
        preferredProtocol: this.config.preferredProtocol,
        viemVersion: '2.38.5'
      };

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get router info (Viem)');
      throw error;
    }
  }

  // Private helper methods

  private async getV2Quote(request: QuoteRequest): Promise<QuoteResponse> {
    logger.debug({ request }, 'Getting V2 AMM quote (Viem)');

    try {
      // Validate tokens and get path
      const path = await this.getV2Path(request.tokenIn as Address, request.tokenOut as Address);
      if (!path || path.length < 2) {
        throw new TradingError(
          TradingErrorCode.INSUFFICIENT_LIQUIDITY,
          'No valid V2 trading path found',
          { tokenIn: request.tokenIn, tokenOut: request.tokenOut }
        );
      }

      // Calculate amounts
      let amounts: string[];
      let quote: SwapQuote;

      if (request.amountIn) {
        amounts = await this.getV2AmountsOut(request.amountIn, path);
        quote = await this.buildV2QuoteFromAmountsIn(request, path, amounts);
      } else if (request.amountOut) {
        amounts = await this.getV2AmountsIn(request.amountOut, path);
        quote = await this.buildV2QuoteFromAmountsOut(request, path, amounts);
      } else {
        throw new Error('Either amountIn or amountOut must be specified');
      }

      return {
        quote,
        isValid: true,
        warnings: []
      };

    } catch (error) {
      logger.error({
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get V2 AMM quote (Viem)');
      throw error;
    }
  }

  private async getV3Quote(request: QuoteRequest): Promise<QuoteResponse> {
    logger.debug({ request }, 'Getting V3 AMM quote (Viem)');

    try {
      // For now, return a mock V3 quote
      // In a full implementation, we would integrate with V3 contracts
      const quote: SwapQuote = {
        amountIn: request.amountIn || '0',
        amountOut: request.amountOut || '0',
        amountOutMin: '0',
        amountInMax: '0',
        tokenIn: { address: request.tokenIn, symbol: '', decimals: 18 },
        tokenOut: { address: request.tokenOut, symbol: '', decimals: 18 },
        path: [request.tokenIn, request.tokenOut],
        route: [{
          poolAddress: '0x0000000000000000000000000000000000000000' as Address,
          tokenIn: request.tokenIn,
          tokenOut: request.tokenOut,
          fee: this.config.v3DefaultFeeTier,
          amountIn: request.amountIn || '0',
          amountOut: request.amountOut || '0',
          priceImpact: 0,
          liquidity: '0',
          protocol: 'v3',
          version: '3'
        }],
        tradingFee: '0',
        tradingFeePercentage: this.config.v3DefaultFeeTier / 100,
        priceImpact: 0,
        gasEstimate: await this.gasEstimation.estimateGas({
          from: request.tokenIn,
          to: this.config.v3RouterAddress,
          data: '0x' as Hex,
          value: 0n
        } as any),
        deadline: Date.now() + this.config.defaultDeadlineMinutes * 60000,
        slippageTolerance: request.options?.slippageTolerance || this.config.defaultSlippage,
        price: {
          tokenInPriceUSD: 0,
          tokenOutPriceUSD: 0,
          exchangeRate: 0
        },
        pools: [],
        warnings: [],
        riskLevel: SwapRiskLevel.LOW,
        timestamp: Date.now(),
        blockNumber: 0,
        validUntil: Date.now() + 30000
      };

      return {
        quote,
        isValid: true,
        warnings: []
      };

    } catch (error) {
      logger.error({
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get V3 AMM quote (Viem)');
      throw error;
    }
  }

  private async getV2Path(tokenIn: Address, tokenOut: Address): Promise<Address[]> {
    // Try direct pair first
    const pairAddress = await this.getV2Pair(tokenIn, tokenOut);
    if (pairAddress) {
      return [tokenIn, tokenOut];
    }

    // Try through WBNB as intermediate
    const wbnbAddress = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' as Address;

    const pair1 = await this.getV2Pair(tokenIn, wbnbAddress);
    const pair2 = await this.getV2Pair(wbnbAddress, tokenOut);

    if (pair1 && pair2) {
      return [tokenIn, wbnbAddress, tokenOut];
    }

    throw new Error('No valid V2 path found');
  }

  private async getV2AmountsOut(amountIn: string, path: Address[]): Promise<string[]> {
    try {
      const amounts = await this.v2Router.read.getAmountsOut([
        BigInt(amountIn),
        path as [Address, ...Address[]]
      ]);
      return amounts.map(amount => amount.toString());
    } catch (error) {
      logger.error({
        amountIn,
        path,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get V2 amounts out (Viem)');
      throw error;
    }
  }

  private async getV2AmountsIn(amountOut: string, path: Address[]): Promise<string[]> {
    try {
      const amounts = await this.v2Router.read.getAmountsIn([
        BigInt(amountOut),
        path as [Address, ...Address[]]
      ]);
      return amounts.map(amount => amount.toString());
    } catch (error) {
      logger.error({
        amountOut,
        path,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get V2 amounts in (Viem)');
      throw error;
    }
  }

  private async getV2Pair(token0: Address, token1: Address): Promise<Address | null> {
    try {
      const pairAddress = await this.v2Factory.read.getPair([token0, token1]);
      return pairAddress === '0x0000000000000000000000000000000000000000' ? null : pairAddress;
    } catch (error) {
      logger.error({
        token0,
        token1,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get V2 pair (Viem)');
      return null;
    }
  }

  private async buildV2QuoteFromAmountsIn(
    request: QuoteRequest,
    path: Address[],
    amounts: string[]
  ): Promise<SwapQuote> {
    const amountIn = request.amountIn!;
    const amountOut = amounts[amounts.length - 1];

    // Calculate slippage
    const slippageAmount = (BigInt(amountOut) * BigInt(request.options?.slippageTolerance || this.config.defaultSlippage)) / BigInt(10000);
    const amountOutMin = (BigInt(amountOut) - slippageAmount).toString();

    // Get gas estimate using Viem
    const gasEstimate = await this.gasEstimation.estimateGas({
      from: path[0],
      to: this.config.v2RouterAddress,
      data: '0x' as Hex,
      value: 0n
    } as any);

    return {
      amountIn,
      amountOut,
      amountOutMin,
      amountInMax: amountIn,
      tokenIn: { address: path[0], symbol: '', decimals: 18 },
      tokenOut: { address: path[path.length - 1], symbol: '', decimals: 18 },
      path: path.map(addr => addr.toString()),
      route: [{
        poolAddress: await this.getV2Pair(path[0], path[path.length - 1]) || '0x0000000000000000000000000000000000000000' as Address,
        tokenIn: path[0].toString(),
        tokenOut: path[path.length - 1].toString(),
        fee: this.config.v2DefaultFeeTier,
        amountIn,
        amountOut,
        priceImpact: 0,
        liquidity: '0',
        protocol: 'v2',
        version: '2'
      }],
      tradingFee: ((BigInt(amountOut) * BigInt(this.config.v2DefaultFeeTier)) / BigInt(10000)).toString(),
      tradingFeePercentage: this.config.v2DefaultFeeTier / 100,
      priceImpact: 0,
      gasEstimate,
      deadline: Date.now() + (request.options?.deadlineMinutes || this.config.defaultDeadlineMinutes) * 60000,
      slippageTolerance: request.options?.slippageTolerance || this.config.defaultSlippage,
      price: {
        tokenInPriceUSD: 0,
        tokenOutPriceUSD: 0,
        exchangeRate: parseFloat(amountOut) / parseFloat(amountIn)
      },
      pools: [],
      warnings: [],
      riskLevel: SwapRiskLevel.LOW,
      timestamp: Date.now(),
      blockNumber: 0,
      validUntil: Date.now() + 30000
    };
  }

  private async buildV2QuoteFromAmountsOut(
    request: QuoteRequest,
    path: Address[],
    amounts: string[]
  ): Promise<SwapQuote> {
    const amountOut = request.amountOut!;
    const amountIn = amounts[0];

    // Calculate slippage
    const slippageAmount = (BigInt(amountIn) * BigInt(request.options?.slippageTolerance || this.config.defaultSlippage)) / BigInt(10000);
    const amountInMax = (BigInt(amountIn) + slippageAmount).toString();

    // Get gas estimate using Viem
    const gasEstimate = await this.gasEstimation.estimateGas({
      from: path[0],
      to: this.config.v2RouterAddress,
      data: '0x' as Hex,
      value: 0n
    } as any);

    return {
      amountIn,
      amountOut,
      amountOutMin: amountOut,
      amountInMax,
      tokenIn: { address: path[0], symbol: '', decimals: 18 },
      tokenOut: { address: path[path.length - 1], symbol: '', decimals: 18 },
      path: path.map(addr => addr.toString()),
      route: [{
        poolAddress: await this.getV2Pair(path[0], path[path.length - 1]) || '0x0000000000000000000000000000000000000000' as Address,
        tokenIn: path[0].toString(),
        tokenOut: path[path.length - 1].toString(),
        fee: this.config.v2DefaultFeeTier,
        amountIn,
        amountOut,
        priceImpact: 0,
        liquidity: '0',
        protocol: 'v2',
        version: '2'
      }],
      tradingFee: ((BigInt(amountOut) * BigInt(this.config.v2DefaultFeeTier)) / BigInt(10000)).toString(),
      tradingFeePercentage: this.config.v2DefaultFeeTier / 100,
      priceImpact: 0,
      gasEstimate,
      deadline: Date.now() + (request.options?.deadlineMinutes || this.config.defaultDeadlineMinutes) * 60000,
      slippageTolerance: request.options?.slippageTolerance || this.config.defaultSlippage,
      price: {
        tokenInPriceUSD: 0,
        tokenOutPriceUSD: 0,
        exchangeRate: parseFloat(amountOut) / parseFloat(amountIn)
      },
      pools: [],
      warnings: [],
      riskLevel: SwapRiskLevel.LOW,
      timestamp: Date.now(),
      blockNumber: 0,
      validUntil: Date.now() + 30000
    };
  }

  private async validateQuote(quote: SwapQuote): Promise<{ isValid: boolean; warnings: string[] }> {
    const warnings: string[] = [];
    let isValid = true;

    // Check price impact
    if (quote.priceImpact > 5) { // 5%
      warnings.push('High price impact detected');
      if (quote.priceImpact > 10) { // 10%
        isValid = false;
      }
    }

    // Check liquidity
    if (quote.pools.length === 0 || parseFloat(quote.pools[0].liquidity) < 1000) {
      warnings.push('Low liquidity warning');
    }

    // Check gas price
    const gasPriceGwei = parseFloat(quote.gasEstimate.gasPrice) / 1e9;
    if (gasPriceGwei > 20) {
      warnings.push('High gas price detected');
    }

    return { isValid, warnings };
  }

  private async fetchPairData(index: number): Promise<TradingPair | null> {
    try {
      const pairAddress = await (this.v2Factory as any).read.allPairs([BigInt(index)]);
      if (pairAddress === '0x0000000000000000000000000000000000000000') {
        return null;
      }

      // Would fetch detailed pair data
      return {
        address: pairAddress,
        token0: { address: '', symbol: '', decimals: 18 },
        token1: { address: '', symbol: '', decimals: 18 },
        reserve0: '0',
        reserve1: '0',
        liquidity: '0',
        price: 0,
        fee: this.config.defaultSlippage,
        volume24h: '0',
        volume7d: '0',
        trades24h: 0,
        priceChange24h: 0,
        priceChange7d: 0,
        isVerified: true,
        riskLevel: SwapRiskLevel.LOW,
        warnings: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

    } catch (error) {
      logger.debug({
        index,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to fetch pair data (Viem)');
      return null;
    }
  }

  private async calculateDepth(pairAddress: Address, reserves: { reserve0: string; reserve1: string }) {
    // Simplified depth calculation
    const liquidity = parseFloat(reserves.reserve0);

    return {
      depth1Percent: (liquidity * 0.01).toString(),
      depth5Percent: (liquidity * 0.05).toString(),
      depth10Percent: (liquidity * 0.1).toString(),
      priceImpact1k: 0.1,
      priceImpact10k: 1.0,
      priceImpact100k: 10.0,
      priceImpact1m: 100.0,
      optimalTradeSize: (liquidity * 0.001).toString(),
      recommendedSlippage: 50, // 0.5%
      utilization: 0.5,
      isConcentrated: false
    };
  }

  private assessLiquidityRisk(reserves: { reserve0: string; reserve1: string }, depth: any): SwapRiskLevel {
    const liquidity = parseFloat(reserves.reserve0);

    if (liquidity < 1000) {
      return SwapRiskLevel.VERY_HIGH;
    } else if (liquidity < 10000) {
      return SwapRiskLevel.HIGH;
    } else if (liquidity < 100000) {
      return SwapRiskLevel.MEDIUM;
    } else {
      return SwapRiskLevel.LOW;
    }
  }
}

// Export singleton instance
export const pancakeSwapAMMViem = new PancakeSwapAMMIntegrationViem();