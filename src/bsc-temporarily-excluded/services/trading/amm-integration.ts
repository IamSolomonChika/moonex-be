/**
 * PancakeSwap AMM Integration Service
 * Direct integration with PancakeSwap Router V2 and Factory contracts
 */

import { ethers } from 'ethers';
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
  SwapRiskLevel,
  TradingError,
  TradingErrorCode
} from './types.js';
import { BSCProviderManager } from '../../utils/ethers-provider.js';
import { BSCCacheManager } from '../cache/cache-manager.js';
import {
  PANCAKESWAP_ROUTER_V2_ABI,
  PANCAKESWAP_PAIR_V2_ABI,
  PANCAKESWAP_ROUTER_V3_ABI,
  PANCAKESWAP_POOL_V3_ABI,
  PANCAKESWAP_QUOTER_V3_ABI,
  V3PoolState,
  V3QuoteRequest
} from './types.js';

/**
 * PancakeSwap AMM Integration Interface
 */
export interface IAMMIntegration {
  // Core AMM functions
  getQuote(request: QuoteRequest): Promise<QuoteResponse>;
  getLiquidityAnalysis(tokenIn: string, tokenOut: string): Promise<LiquidityAnalysis>;
  getTradingPairs(): Promise<TradingPair[]>;
  getPairReserves(pairAddress: string): Promise<{ reserve0: string; reserve1: string }>;

  // Router functions
  getAmountsOut(amountIn: string, path: string[]): Promise<string[]>;
  getAmountsIn(amountOut: string, path: string[]): Promise<string[]>;

  // Pool management
  getPair(token0: string, token1: string): Promise<string | null>;
  getAllPairs(): Promise<TradingPair[]>;

  // Health and monitoring
  healthCheck(): Promise<boolean>;
  getRouterInfo(): Promise<any>;
}

/**
 * PancakeSwap AMM Integration Implementation
 */
export class PancakeSwapAMMIntegration implements IAMMIntegration {
  private provider: BSCProviderManager;
  private cache: BSCCacheManager;
  private config: RouterConfiguration;

  // V2 Contract instances
  private v2RouterContract: ethers.Contract;
  private v2FactoryContract: ethers.Contract;

  // V3 Contract instances
  private v3RouterContract: ethers.Contract;
  private v3QuoterContract: ethers.Contract;
  private v3FactoryContract: ethers.Contract;

  constructor(config?: Partial<RouterConfiguration>) {
    this.provider = new BSCProviderManager();
    this.cache = new BSCCacheManager();

    // Default configuration with both V2 and V3 support
    this.config = {
      // V2 Addresses
      v2RouterAddress: '0x10ed43c718714eb63d5aa57b78b54704e256024e', // PancakeSwap Router V2
      v2FactoryAddress: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', // PancakeSwap Factory V2
      v2InitCodeHash: '0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5', // PancakeSwap V2 init code hash

      // V3 Addresses
      v3RouterAddress: '0x1b81D678ffb9C0263b24A97847620C99d213eB14', // PancakeSwap Router V3
      v3QuoterAddress: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997', // PancakeSwap Quoter V3
      v3FactoryAddress: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865', // PancakeSwap Factory V3

      // Fee tiers
      v3FeeTiers: [100, 500, 2500, 10000], // 0.01%, 0.05%, 0.25%, 1% (basis points)
      v3DefaultFeeTier: 2500, // 0.25%
      v2FeeTiers: [2500], // 0.25% (flat fee for V2)
      v2DefaultFeeTier: 2500, // 0.25%
      preferredProtocol: 'auto', // auto-detect best protocol

      // Gas configuration
      defaultGasLimit: 200000,
      maxGasLimit: 1000000,
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

    // Initialize contracts
    const provider = this.provider.getProvider();

    // V2 Contracts
    this.v2RouterContract = new ethers.Contract(
      this.config.v2RouterAddress,
      PANCAKESWAP_ROUTER_V2_ABI,
      provider
    );

    // V2 Factory ABI (simplified)
    const v2FactoryABI = [
      'function getPair(address tokenA, address tokenB) external view returns (address pair)',
      'function allPairs(uint) external view returns (address pair)',
      'function allPairsLength() external view returns (uint)',
    ];

    this.v2FactoryContract = new ethers.Contract(
      this.config.v2FactoryAddress,
      v2FactoryABI,
      provider
    );

    // V3 Contracts
    this.v3RouterContract = new ethers.Contract(
      this.config.v3RouterAddress,
      PANCAKESWAP_ROUTER_V3_ABI,
      provider
    );

    this.v3QuoterContract = new ethers.Contract(
      this.config.v3QuoterAddress,
      PANCAKESWAP_QUOTER_V3_ABI,
      provider
    );

    // V3 Factory ABI (simplified)
    const v3FactoryABI = [
      'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',
      'function allPools(uint) external view returns (address pool)',
      'function allPoolsLength() external view returns (uint)',
    ];

    this.v3FactoryContract = new ethers.Contract(
      this.config.v3FactoryAddress,
      v3FactoryABI,
      provider
    );
  }

  /**
   * Get swap quote from PancakeSwap AMM (V2 and V3)
   */
  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    logger.debug({ request }, 'Getting AMM quote');

    try {
      const cacheKey = `quote:${JSON.stringify(request)}`;

      // Check cache first
      if (this.config.cacheQuotes) {
        const cached = await this.cache.get<QuoteResponse>(cacheKey);
        if (cached && (Date.now() - cached.quote.timestamp) < this.config.quoteCacheTTL) {
          logger.debug({ tokenIn: request.tokenIn, tokenOut: request.tokenOut }, 'Returning cached quote');
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
      }, 'AMM quote generated successfully');

      return response;

    } catch (error) {
      logger.error({
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get AMM quote');

      throw error;
    }
  }

  /**
   * Get liquidity analysis for a trading pair
   */
  async getLiquidityAnalysis(tokenIn: string, tokenOut: string): Promise<LiquidityAnalysis> {
    logger.debug({ tokenIn, tokenOut }, 'Getting liquidity analysis');

    try {
      const pairAddress = await this.getPair(tokenIn, tokenOut);
      if (!pairAddress) {
        throw new Error('No pair found for tokens');
      }

      // Get pair reserves
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
      }, 'Failed to get liquidity analysis');
      throw error;
    }
  }

  /**
   * Get all trading pairs
   */
  async getTradingPairs(): Promise<TradingPair[]> {
    logger.debug('Getting all trading pairs');

    try {
      const cacheKey = 'all_trading_pairs';
      const cached = await this.cache.get<TradingPair[]>(cacheKey);

      if (cached) {
        return cached;
      }

      const pairsCount = await this.factoryContract.allPairsLength();
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

      logger.info({ count: pairs.length }, 'Trading pairs fetched successfully');
      return pairs;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get trading pairs');
      return [];
    }
  }

  /**
   * Get pair reserves (V2 compatibility)
   */
  async getPairReserves(pairAddress: string): Promise<{ reserve0: string; reserve1: string }> {
    try {
      const pairContract = new ethers.Contract(pairAddress, PANCAKESWAP_PAIR_V2_ABI, await this.provider.getProvider());
      const reserves = await pairContract.getReserves();

      return {
        reserve0: reserves.reserve0.toString(),
        reserve1: reserves.reserve1.toString()
      };

    } catch (error) {
      logger.error({
        pairAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get pair reserves');
      throw error;
    }
  }

  /**
   * Get amounts out for a given input (V2 compatibility)
   */
  async getAmountsOut(amountIn: string, path: string[]): Promise<string[]> {
    return this.getV2AmountsOut(amountIn, path);
  }

  /**
   * Get amounts in for a given output (V2 compatibility)
   */
  async getAmountsIn(amountOut: string, path: string[]): Promise<string[]> {
    return this.getV2AmountsIn(amountOut, path);
  }

  /**
   * Get pair address for two tokens (V2 compatibility)
   */
  async getPair(token0: string, token1: string): Promise<string | null> {
    return this.getV2Pair(token0, token1);
  }

  /**
   * Get all pairs
   */
  async getAllPairs(): Promise<TradingPair[]> {
    return this.getTradingPairs();
  }

  /**
   * Health check (V2 and V3)
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check V2 contracts
      await this.v2RouterContract.WETH();
      await this.v2FactoryContract.allPairsLength();

      // Check V3 contracts
      await this.v3RouterContract.WETH9();
      await this.v3QuoterContract.quoteExactInputSingle(
        '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
        '0xe9e7cea3dedca5984780bafc599bd69add087d56', // BUSD
        2500, // 0.25% fee
        '1000000000000000000', // 1 token
        0
      );

      return true;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'AMM health check failed');
      return false;
    }
  }

  /**
   * Get router information (V2 and V3)
   */
  async getRouterInfo(): Promise<any> {
    try {
      const blockNumber = await this.provider.getProvider().getBlockNumber();
      const gasPrice = await this.provider.getProvider().getFeeData();

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
        blockNumber,
        gasPrice,
        network: 'BSC',
        preferredProtocol: this.config.preferredProtocol
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get router info');
      throw error;
    }
  }

  // Private helper methods

  private async getV2Quote(request: QuoteRequest): Promise<QuoteResponse> {
    logger.debug({ request }, 'Getting V2 AMM quote');

    try {
      // Validate tokens and get path
      const path = await this.getV2Path(request.tokenIn, request.tokenOut);
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
      }, 'Failed to get V2 AMM quote');
      throw error;
    }
  }

  private async getV3Quote(request: QuoteRequest): Promise<QuoteResponse> {
    logger.debug({ request }, 'Getting V3 AMM quote');

    try {
      const v3Request = request as V3QuoteRequest;
      const feeTiers = v3Request.feeTiers || this.config.v3FeeTiers;

      // Try different fee tiers and find the best one
      const quotePromises = feeTiers.map(fee => this.getV3QuoteForFee(request, fee));
      const quoteResults = await Promise.allSettled(quotePromises);

      const validQuotes: SwapQuote[] = [];
      quoteResults.forEach(result => {
        if (result.status === 'fulfilled') {
          validQuotes.push(result.value.quote);
        }
      });

      if (validQuotes.length === 0) {
        throw new TradingError(
          TradingErrorCode.INSUFFICIENT_LIQUIDITY,
          'No valid V3 quotes found for any fee tier',
          { tokenIn: request.tokenIn, tokenOut: request.tokenOut, feeTiers }
        );
      }

      // Select best quote (highest output)
      const bestQuote = validQuotes.reduce((best, current) => {
        const bestAmount = parseFloat(best.amountOut);
        const currentAmount = parseFloat(current.amountOut);
        return currentAmount > bestAmount ? current : best;
      });

      return {
        quote: bestQuote,
        isValid: true,
        warnings: []
      };

    } catch (error) {
      logger.error({
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get V3 AMM quote');
      throw error;
    }
  }

  private async getV3QuoteForFee(request: QuoteRequest, fee: number): Promise<QuoteResponse> {
    try {
      const poolAddress = await this.getV3Pool(request.tokenIn, request.tokenOut, fee);
      if (!poolAddress) {
        throw new Error(`No V3 pool found for fee tier ${fee}`);
      }

      let quote: SwapQuote;

      if (request.amountIn) {
        const amountOut = await this.v3QuoterContract.quoteExactInputSingle(
          request.tokenIn,
          request.tokenOut,
          fee,
          request.amountIn,
          0 // sqrtPriceLimitX96
        );

        quote = await this.buildV3QuoteFromAmountIn(request, fee, request.amountIn, amountOut.toString());
      } else if (request.amountOut) {
        const amountIn = await this.v3QuoterContract.quoteExactOutputSingle(
          request.tokenIn,
          request.tokenOut,
          fee,
          request.amountOut,
          0 // sqrtPriceLimitX96
        );

        quote = await this.buildV3QuoteFromAmountOut(request, fee, amountIn.toString(), request.amountOut);
      } else {
        throw new Error('Either amountIn or amountOut must be specified');
      }

      return {
        quote,
        isValid: true,
        warnings: []
      };

    } catch (error) {
      throw error;
    }
  }

  private async getV2Path(tokenIn: string, tokenOut: string): Promise<string[]> {
    // Try direct pair first
    const pairAddress = await this.getV2Pair(tokenIn, tokenOut);
    if (pairAddress) {
      return [tokenIn, tokenOut];
    }

    // Try through WBNB as intermediate
    const wbnbAddress = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';

    const pair1 = await this.getV2Pair(tokenIn, wbnbAddress);
    const pair2 = await this.getV2Pair(wbnbAddress, tokenOut);

    if (pair1 && pair2) {
      return [tokenIn, wbnbAddress, tokenOut];
    }

    throw new Error('No valid V2 path found');
  }

  private async getOptimalPath(tokenIn: string, tokenOut: string): Promise<string[]> {
    // This method is now used by getLiquidityAnalysis and other legacy methods
    // Use V2 path by default for backward compatibility
    return this.getV2Path(tokenIn, tokenOut);
  }

  private async buildQuoteFromAmountsIn(
    request: QuoteRequest,
    path: string[],
    amounts: string[]
  ): Promise<SwapQuote> {
    const amountIn = request.amountIn!;
    const amountOut = amounts[amounts.length - 1];

    // Calculate slippage
    const slippageAmount = (BigInt(amountOut) * BigInt(request.options?.slippageTolerance || this.config.defaultSlippage)) / BigInt(10000);
    const amountOutMin = (BigInt(amountOut) - slippageAmount).toString();

    // Get gas estimate
    const gasEstimate = await this.estimateGasCost(path.length);

    return {
      amountIn,
      amountOut,
      amountOutMin,
      amountInMax: amountIn,
      tokenIn: { address: path[0], symbol: '', decimals: 18 }, // Would fetch from token service
      tokenOut: { address: path[path.length - 1], symbol: '', decimals: 18 },
      path,
      route: [],
      tradingFee: '0',
      tradingFeePercentage: this.config.defaultFeeTier / 100,
      priceImpact: 0, // Would calculate
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
      blockNumber: 0, // Would fetch
      validUntil: Date.now() + 30000 // 30 seconds
    };
  }

  private async buildQuoteFromAmountsOut(
    request: QuoteRequest,
    path: string[],
    amounts: string[]
  ): Promise<SwapQuote> {
    const amountOut = request.amountOut!;
    const amountIn = amounts[0];

    // Calculate slippage
    const slippageAmount = (BigInt(amountIn) * BigInt(request.options?.slippageTolerance || this.config.defaultSlippage)) / BigInt(10000);
    const amountInMax = (BigInt(amountIn) + slippageAmount).toString();

    // Get gas estimate
    const gasEstimate = await this.estimateGasCost(path.length);

    return {
      amountIn,
      amountOut,
      amountOutMin: amountOut,
      amountInMax,
      tokenIn: { address: path[0], symbol: '', decimals: 18 },
      tokenOut: { address: path[path.length - 1], symbol: '', decimals: 18 },
      path,
      route: [],
      tradingFee: '0',
      tradingFeePercentage: this.config.defaultFeeTier / 100,
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
      const pairAddress = await this.factoryContract.allPairs(index);
      if (pairAddress === ethers.ZeroAddress) {
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
        fee: this.config.defaultFeeTier,
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
      logger.debug({ index, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch pair data');
      return null;
    }
  }

  private async calculateDepth(pairAddress: string, reserves: { reserve0: string; reserve1: string }) {
    // Simplified depth calculation
    // In a full implementation, this would calculate actual depth at different price levels

    const liquidity = parseFloat(reserves.reserve0);

    return {
      depth1Percent: (liquidity * 0.01).toString(),
      depth5Percent: (liquidity * 0.05).toString(),
      depth10Percent: (liquidity * 0.1).toString(),
      priceImpact1k: 0.1, // Would calculate based on actual reserves
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

  private async estimateGasCost(hops: number): Promise<any> {
    const baseGasLimit = this.config.defaultGasLimit;
    const multiplier = hops > 2 ? this.config.gasLimitMultipliers.multiHop :
                     hops > 1 ? this.config.gasLimitMultipliers.complex :
                     this.config.gasLimitMultipliers.simple;

    const gasLimit = Math.floor(baseGasLimit * multiplier);
    const feeData = await this.provider.getProvider().getFeeData();

    return {
      gasLimit: gasLimit.toString(),
      gasPrice: feeData.gasPrice?.toString() || '20000000000', // 20 gwei default
      maxFeePerGas: feeData.maxFeePerGas?.toString() || '30000000000', // 30 gwei
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString() || '2000000000', // 2 gwei
      estimatedCostBNB: (BigInt(gasLimit) * BigInt(feeData.gasPrice || 20000000000)).toString(),
      estimatedCostUSD: '0' // Would calculate based on BNB price
    };
  }

  // V2-specific methods
  private async getV2AmountsOut(amountIn: string, path: string[]): Promise<string[]> {
    try {
      const amounts = await this.v2RouterContract.getAmountsOut(amountIn, path);
      return amounts.map((amount: bigint) => amount.toString());
    } catch (error) {
      logger.error({
        amountIn,
        path,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get V2 amounts out');
      throw error;
    }
  }

  private async getV2AmountsIn(amountOut: string, path: string[]): Promise<string[]> {
    try {
      const amounts = await this.v2RouterContract.getAmountsIn(amountOut, path);
      return amounts.map((amount: bigint) => amount.toString());
    } catch (error) {
      logger.error({
        amountOut,
        path,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get V2 amounts in');
      throw error;
    }
  }

  private async buildV2QuoteFromAmountsIn(
    request: QuoteRequest,
    path: string[],
    amounts: string[]
  ): Promise<SwapQuote> {
    const amountIn = request.amountIn!;
    const amountOut = amounts[amounts.length - 1];

    // Calculate slippage
    const slippageAmount = (BigInt(amountOut) * BigInt(request.options?.slippageTolerance || this.config.defaultSlippage)) / BigInt(10000);
    const amountOutMin = (BigInt(amountOut) - slippageAmount).toString();

    // Get gas estimate
    const gasEstimate = await this.estimateV2GasCost(path.length);

    return {
      amountIn,
      amountOut,
      amountOutMin,
      amountInMax: amountIn,
      tokenIn: { address: path[0], symbol: '', decimals: 18 },
      tokenOut: { address: path[path.length - 1], symbol: '', decimals: 18 },
      path,
      route: [{
        poolAddress: await this.getV2Pair(path[0], path[path.length - 1]) || '',
        tokenIn: path[0],
        tokenOut: path[path.length - 1],
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
    path: string[],
    amounts: string[]
  ): Promise<SwapQuote> {
    const amountOut = request.amountOut!;
    const amountIn = amounts[0];

    // Calculate slippage
    const slippageAmount = (BigInt(amountIn) * BigInt(request.options?.slippageTolerance || this.config.defaultSlippage)) / BigInt(10000);
    const amountInMax = (BigInt(amountIn) + slippageAmount).toString();

    // Get gas estimate
    const gasEstimate = await this.estimateV2GasCost(path.length);

    return {
      amountIn,
      amountOut,
      amountOutMin: amountOut,
      amountInMax,
      tokenIn: { address: path[0], symbol: '', decimals: 18 },
      tokenOut: { address: path[path.length - 1], symbol: '', decimals: 18 },
      path,
      route: [{
        poolAddress: await this.getV2Pair(path[0], path[path.length - 1]) || '',
        tokenIn: path[0],
        tokenOut: path[path.length - 1],
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

  // V3-specific methods
  private async getV3Pool(token0: string, token1: string, fee: number): Promise<string | null> {
    try {
      const poolAddress = await this.v3FactoryContract.getPool(token0, token1, fee);
      return poolAddress !== ethers.ZeroAddress ? poolAddress : null;
    } catch (error) {
      logger.error({
        token0,
        token1,
        fee,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get V3 pool');
      return null;
    }
  }

  private async buildV3QuoteFromAmountIn(
    request: QuoteRequest,
    fee: number,
    amountIn: string,
    amountOut: string
  ): Promise<SwapQuote> {
    // Calculate slippage
    const slippageAmount = (BigInt(amountOut) * BigInt(request.options?.slippageTolerance || this.config.defaultSlippage)) / BigInt(10000);
    const amountOutMin = (BigInt(amountOut) - slippageAmount).toString();

    // Get gas estimate
    const gasEstimate = await this.estimateV3GasCost();

    return {
      amountIn,
      amountOut,
      amountOutMin,
      amountInMax: amountIn,
      tokenIn: { address: request.tokenIn, symbol: '', decimals: 18 },
      tokenOut: { address: request.tokenOut, symbol: '', decimals: 18 },
      path: [request.tokenIn, request.tokenOut],
      route: [{
        poolAddress: await this.getV3Pool(request.tokenIn, request.tokenOut, fee) || '',
        tokenIn: request.tokenIn,
        tokenOut: request.tokenOut,
        fee,
        amountIn,
        amountOut,
        priceImpact: 0,
        liquidity: '0',
        protocol: 'v3',
        version: '3'
      }],
      tradingFee: ((BigInt(amountOut) * BigInt(fee)) / BigInt(10000)).toString(),
      tradingFeePercentage: fee / 100,
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

  private async buildV3QuoteFromAmountOut(
    request: QuoteRequest,
    fee: number,
    amountIn: string,
    amountOut: string
  ): Promise<SwapQuote> {
    // Calculate slippage
    const slippageAmount = (BigInt(amountIn) * BigInt(request.options?.slippageTolerance || this.config.defaultSlippage)) / BigInt(10000);
    const amountInMax = (BigInt(amountIn) + slippageAmount).toString();

    // Get gas estimate
    const gasEstimate = await this.estimateV3GasCost();

    return {
      amountIn,
      amountOut,
      amountOutMin: amountOut,
      amountInMax,
      tokenIn: { address: request.tokenIn, symbol: '', decimals: 18 },
      tokenOut: { address: request.tokenOut, symbol: '', decimals: 18 },
      path: [request.tokenIn, request.tokenOut],
      route: [{
        poolAddress: await this.getV3Pool(request.tokenIn, request.tokenOut, fee) || '',
        tokenIn: request.tokenIn,
        tokenOut: request.tokenOut,
        fee,
        amountIn,
        amountOut,
        priceImpact: 0,
        liquidity: '0',
        protocol: 'v3',
        version: '3'
      }],
      tradingFee: ((BigInt(amountOut) * BigInt(fee)) / BigInt(10000)).toString(),
      tradingFeePercentage: fee / 100,
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

  private async getV2Pair(token0: string, token1: string): Promise<string | null> {
    try {
      const pairAddress = await this.v2FactoryContract.getPair(token0, token1);
      return pairAddress !== ethers.ZeroAddress ? pairAddress : null;
    } catch (error) {
      logger.error({
        token0,
        token1,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get V2 pair');
      return null;
    }
  }

  private async estimateV2GasCost(hops: number): Promise<any> {
    const baseGasLimit = this.config.defaultGasLimit;
    const multiplier = hops > 2 ? this.config.gasLimitMultipliers.v2MultiHop :
                     hops > 1 ? this.config.gasLimitMultipliers.v2Complex :
                     this.config.gasLimitMultipliers.v2Simple;

    const gasLimit = Math.floor(baseGasLimit * multiplier);
    const feeData = await this.provider.getProvider().getFeeData();

    return {
      gasLimit: gasLimit.toString(),
      gasPrice: feeData.gasPrice?.toString() || '20000000000',
      maxFeePerGas: feeData.maxFeePerGas?.toString() || '30000000000',
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString() || '2000000000',
      estimatedCostBNB: (BigInt(gasLimit) * BigInt(feeData.gasPrice || 20000000000)).toString(),
      estimatedCostUSD: '0'
    };
  }

  private async estimateV3GasCost(): Promise<any> {
    const gasLimit = this.config.defaultGasLimit * this.config.gasLimitMultipliers.v3Simple;
    const feeData = await this.provider.getProvider().getFeeData();

    return {
      gasLimit: gasLimit.toString(),
      gasPrice: feeData.gasPrice?.toString() || '20000000000',
      maxFeePerGas: feeData.maxFeePerGas?.toString() || '30000000000',
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString() || '2000000000',
      estimatedCostBNB: (BigInt(gasLimit) * BigInt(feeData.gasPrice || 20000000000)).toString(),
      estimatedCostUSD: '0'
    };
  }
}

// Custom error class
class TradingError extends Error {
  constructor(
    public code: TradingErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'TradingError';
  }
}

// Export singleton instance
export const pancakeSwapAMM = new PancakeSwapAMMIntegration();