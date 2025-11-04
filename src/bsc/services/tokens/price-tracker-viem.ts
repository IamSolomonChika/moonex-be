/**
 * BSC Token Price Tracking Service (Viem)
 * Real-time price tracking and analytics for BSC tokens using Viem
 */

import { createPublicClient, http, parseEventLogs, Address, BlockNumber, Log } from 'viem';
import { bsc } from 'viem/chains';
import logger from '../../../utils/logger.js';
import type {
  TokenPriceDataViem,
  TokenLiquidityDataViem,
  BSCTokenViem
} from '../types/token-types-viem.js';
import { BSCCacheManager } from '../cache/cache-manager-viem.js';

/**
 * Price tracking configuration
 */
export interface PriceTrackingConfigViem {
  // Update intervals
  priceUpdateInterval: number; // milliseconds
  liquidityUpdateInterval: number; // milliseconds
  volumeUpdateInterval: number; // milliseconds

  // Data sources
  enableSubgraphPrices: boolean;
  enableAPISources: boolean;
  enableOnChainCalculations: boolean;

  // Caching settings
  cachePrices: boolean;
  cacheTTL: number; // milliseconds
  enableHistoricalData: boolean;

  // Subscription settings
  enableRealTimeUpdates: boolean;
  maxSubscriptions: number;
  subscriptionTimeout: number; // milliseconds

  // BSC-specific settings
  enableBlockBasedUpdates: boolean;
  confirmationBlocks: number;
  maxPriceAge: number; // milliseconds

  // Performance settings
  batchSize: number;
  maxConcurrentRequests: number;
  enableRetryMechanism: boolean;
  maxRetries: number;
}

/**
 * Price update subscription
 */
export interface PriceSubscriptionViem {
  id: string;
  tokenAddress: Address;
  callback: (priceData: TokenPriceDataViem) => void;
  lastUpdate: number;
  isActive: boolean;
  updateCount: number;
}

/**
 * Price history data point
 */
export interface PriceHistoryPointViem {
  timestamp: number;
  blockNumber: BlockNumber;
  priceUSD: number;
  priceBNB: number;
  volume24hUSD: number;
  liquidityUSD: number;
  priceChange24h: number;
}

/**
 * Price analytics data
 */
export interface PriceAnalyticsViem {
  tokenAddress: Address;
  currentPrice: TokenPriceDataViem;
  priceHistory: PriceHistoryPointViem[];

  // Price statistics
  price24hAgo: number;
  price7dAgo: number;
  price30dAgo: number;
  allTimeHigh: number;
  allTimeLow: number;

  // Volatility metrics
  volatility24h: number;
  volatility7d: number;
  volatility30d: number;

  // Volume metrics
  avgVolume24h: number;
  avgVolume7d: number;
  volumeTrend: 'increasing' | 'decreasing' | 'stable';

  // Liquidity metrics
  avgLiquidity24h: number;
  liquidityUtilization: number;
  liquidityDepth: {
    depth1Percent: number;
    depth5Percent: number;
    depth10Percent: number;
  };

  // Technical indicators
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  movingAverages: {
    sma20: number;
    sma50: number;
    sma200: number;
    ema20: number;
    ema50: number;
  };
}

/**
 * IPriceTrackerViem interface
 */
export interface IPriceTrackerViem {
  // Price fetching
  getTokenPrice(address: Address): Promise<TokenPriceDataViem | null>;
  getTokenPrices(addresses: Address[]): Promise<TokenPriceDataViem[]>;
  getHistoricalPrices(address: Address, from: number, to: number): Promise<PriceHistoryPointViem[]>;

  // Real-time tracking
  subscribeToPriceUpdates(address: Address, callback: (price: TokenPriceDataViem) => void): string;
  unsubscribeFromPriceUpdates(subscriptionId: string): void;

  // Analytics
  getPriceAnalytics(address: Address, timeframe: string): Promise<PriceAnalyticsViem>;
  getTopMovers(timeframe: string, limit: number): Promise<TokenPriceDataViem[]>;

  // Liquidity tracking
  getTokenLiquidity(address: Address): Promise<TokenLiquidityDataViem | null>;
  getLiquidityHistory(address: Address, from: number, to: number): Promise<TokenLiquidityDataViem[]>;

  // Lifecycle
  start(config?: Partial<PriceTrackingConfigViem>): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<boolean>;
}

/**
 * PancakeSwap Factory ABI for event monitoring
 */
const PANCAKESWAP_FACTORY_ABI = [
  'event PairCreated(address indexed token0, address indexed token1, address pair, uint)'
] as const;

const PANCAKESWAP_FACTORY_ADDRESS = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as Address;

/**
 * ERC20 ABI for price calculations
 */
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
] as const;

/**
 * PancakeSwap Pair ABI for price calculations
 */
const PANCAKESWAP_PAIR_ABI = [
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function totalSupply() view returns (uint256)'
] as const;

/**
 * Price Tracker Implementation (Viem)
 */
export class TokenPriceTrackerViem implements IPriceTrackerViem {
  private config: PriceTrackingConfigViem;
  private publicClient: any;
  private cache: BSCCacheManager;

  private isRunning: boolean = false;
  private subscriptions: Map<string, PriceSubscriptionViem> = new Map();
  private updateIntervals: NodeJS.Timeout[] = [];
  private lastPriceUpdate: number = 0;
  private lastBlockNumber: BlockNumber = 0n;
  private priceHistory: Map<string, PriceHistoryPointViem[]> = new Map();

  // BSC-specific constants
  private readonly WBNB_ADDRESS = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' as Address;
  private readonly BUSD_ADDRESS = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address;
  private readonly PANCAKESWAP_ROUTER = '0x10ed43c718714eb63d5aa57b78b54704e256024e' as Address;

  constructor(config?: Partial<PriceTrackingConfigViem>) {
    this.config = {
      priceUpdateInterval: 30000, // 30 seconds
      liquidityUpdateInterval: 60000, // 1 minute
      volumeUpdateInterval: 300000, // 5 minutes
      enableSubgraphPrices: true,
      enableAPISources: true,
      enableOnChainCalculations: true,
      cachePrices: true,
      cacheTTL: 60000, // 1 minute
      enableHistoricalData: true,
      enableRealTimeUpdates: true,
      maxSubscriptions: 1000,
      subscriptionTimeout: 300000, // 5 minutes
      enableBlockBasedUpdates: true,
      confirmationBlocks: 1, // BSC has fast finality
      maxPriceAge: 120000, // 2 minutes
      batchSize: 50,
      maxConcurrentRequests: 10,
      enableRetryMechanism: true,
      maxRetries: 3,
      ...config
    };

    this.publicClient = createPublicClient({
      chain: bsc,
      transport: http()
    });

    this.cache = new BSCCacheManager();
  }

  /**
   * Start the price tracker
   */
  async start(config?: Partial<PriceTrackingConfigViem>): Promise<void> {
    if (this.isRunning) {
      return;
    }

    if (config) {
      this.config = { ...this.config, ...config };
    }

    logger.info({ config: this.config }, 'Starting token price tracker (Viem)');

    try {
      // Start periodic price updates
      this.startPeriodicUpdates();

      // Start block monitoring for real-time updates
      if (this.config.enableBlockBasedUpdates) {
        await this.startBlockMonitoring();
      }

      // Start event monitoring for swap events
      await this.startEventMonitoring();

      this.isRunning = true;
      logger.info('Token price tracker (Viem) started successfully');

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to start token price tracker (Viem)');
      throw error;
    }
  }

  /**
   * Stop the price tracker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping token price tracker (Viem)');

    // Clear all intervals
    this.updateIntervals.forEach(interval => clearInterval(interval));
    this.updateIntervals = [];

    // Clear all subscriptions
    this.subscriptions.clear();

    this.isRunning = false;
    logger.info('Token price tracker (Viem) stopped');
  }

  /**
   * Get current token price
   */
  async getTokenPrice(address: Address): Promise<TokenPriceDataViem | null> {
    logger.debug({ address }, 'Getting token price (Viem)');

    try {
      const cacheKey = `price:${address}`;
      const cached = await this.cache.get<TokenPriceDataViem>(cacheKey);

      if (cached && (Date.now() - cached.timestamp) < this.config.maxPriceAge) {
        return cached;
      }

      // Fetch price from multiple sources
      const priceData = await this.fetchPriceFromSources(address);

      if (priceData) {
        // Cache the price data
        if (this.config.cachePrices) {
          await this.cache.set(cacheKey, priceData, this.config.cacheTTL);
        }

        // Update price history
        await this.updatePriceHistory(address, priceData);

        logger.debug({ address, priceUSD: priceData.priceUSD }, 'Token price fetched (Viem)');
        return priceData;
      }

      return null;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get token price (Viem)');
      return null;
    }
  }

  /**
   * Get prices for multiple tokens
   */
  async getTokenPrices(addresses: Address[]): Promise<TokenPriceDataViem[]> {
    logger.debug({ addresses }, 'Getting multiple token prices (Viem)');

    try {
      const results: TokenPriceDataViem[] = [];
      const batchSize = Math.min(addresses.length, this.config.batchSize);

      // Process in batches to avoid overwhelming APIs
      for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        const batchPromises = batch.map(address => this.getTokenPrice(address));

        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
          }
        });

        // Add delay between batches if needed
        if (i + batchSize < addresses.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      logger.debug({ requested: addresses.length, received: results.length }, 'Multiple token prices fetched (Viem)');
      return results;

    } catch (error) {
      logger.error({ addresses, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get multiple token prices (Viem)');
      return [];
    }
  }

  /**
   * Get historical price data
   */
  async getHistoricalPrices(address: Address, from: number, to: number): Promise<PriceHistoryPointViem[]> {
    logger.debug({ address, from, to }, 'Getting historical prices (Viem)');

    try {
      const cacheKey = `price_history:${address}:${from}:${to}`;
      const cached = await this.cache.get<PriceHistoryPointViem[]>(cacheKey);

      if (cached) {
        return cached;
      }

      // Fetch historical data from subgraph or calculate from on-chain data
      const history = await this.fetchHistoricalPricesFromChain(address, from, to);

      // Cache historical data
      await this.cache.set(cacheKey, history, this.config.cacheTTL * 10); // Cache longer

      return history;

    } catch (error) {
      logger.error({ address, from, to, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get historical prices (Viem)');
      return [];
    }
  }

  /**
   * Subscribe to real-time price updates
   */
  subscribeToPriceUpdates(address: Address, callback: (price: TokenPriceDataViem) => void): string {
    if (this.subscriptions.size >= this.config.maxSubscriptions) {
      throw new Error('Maximum number of subscriptions reached');
    }

    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const subscription: PriceSubscriptionViem = {
      id: subscriptionId,
      tokenAddress: address,
      callback,
      lastUpdate: 0,
      isActive: true,
      updateCount: 0
    };

    this.subscriptions.set(subscriptionId, subscription);

    logger.debug({ subscriptionId, address }, 'Subscribed to price updates (Viem)');
    return subscriptionId;
  }

  /**
   * Unsubscribe from price updates
   */
  unsubscribeFromPriceUpdates(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.isActive = false;
      this.subscriptions.delete(subscriptionId);
      logger.debug({ subscriptionId }, 'Unsubscribed from price updates (Viem)');
    }
  }

  /**
   * Get price analytics
   */
  async getPriceAnalytics(address: Address, timeframe: string): Promise<PriceAnalyticsViem> {
    logger.debug({ address, timeframe }, 'Getting price analytics (Viem)');

    try {
      // Get current price
      const currentPrice = await this.getTokenPrice(address);
      if (!currentPrice) {
        throw new Error('Unable to fetch current price');
      }

      // Get historical data based on timeframe
      const now = Date.now();
      let from: number;
      let points: PriceHistoryPointViem[];

      switch (timeframe) {
        case '24h':
          from = now - 24 * 60 * 60 * 1000;
          points = await this.getHistoricalPrices(address, from, now);
          break;
        case '7d':
          from = now - 7 * 24 * 60 * 60 * 1000;
          points = await this.getHistoricalPrices(address, from, now);
          break;
        case '30d':
          from = now - 30 * 24 * 60 * 60 * 1000;
          points = await this.getHistoricalPrices(address, from, now);
          break;
        default:
          throw new Error(`Unsupported timeframe: ${timeframe}`);
      }

      // Calculate analytics
      const analytics = await this.calculateAnalytics(address, currentPrice, points);

      logger.debug({ address, timeframe, pointsCount: points.length }, 'Price analytics calculated (Viem)');
      return analytics;

    } catch (error) {
      logger.error({ address, timeframe, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get price analytics (Viem)');
      throw error;
    }
  }

  /**
   * Get top moving tokens
   */
  async getTopMovers(timeframe: string, limit: number): Promise<TokenPriceDataViem[]> {
    logger.debug({ timeframe, limit }, 'Getting top moving tokens (Viem)');

    try {
      // This would fetch top movers from subgraph or API
      // For now, return empty array as placeholder
      return [];

    } catch (error) {
      logger.error({ timeframe, limit, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get top movers (Viem)');
      return [];
    }
  }

  /**
   * Get token liquidity data
   */
  async getTokenLiquidity(address: Address): Promise<TokenLiquidityDataViem | null> {
    logger.debug({ address }, 'Getting token liquidity (Viem)');

    try {
      const cacheKey = `liquidity:${address}`;
      const cached = await this.cache.get<TokenLiquidityDataViem>(cacheKey);

      if (cached && (Date.now() - cached.timestamp) < this.config.liquidityUpdateInterval) {
        return cached;
      }

      // Fetch liquidity from PancakeSwap
      const liquidityData = await this.fetchLiquidityFromPancakeSwap(address);

      if (liquidityData) {
        await this.cache.set(cacheKey, liquidityData, this.config.liquidityUpdateInterval);
      }

      return liquidityData;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get token liquidity (Viem)');
      return null;
    }
  }

  /**
   * Get liquidity history
   */
  async getLiquidityHistory(address: Address, from: number, to: number): Promise<TokenLiquidityDataViem[]> {
    logger.debug({ address, from, to }, 'Getting liquidity history (Viem)');

    try {
      // This would fetch liquidity history from subgraph
      // For now, return empty array as placeholder
      return [];

    } catch (error) {
      logger.error({ address, from, to, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get liquidity history (Viem)');
      return [];
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check provider connectivity
      await this.publicClient.getBlockNumber();

      // Check subscription count
      if (this.subscriptions.size > this.config.maxSubscriptions) {
        return false;
      }

      // Check if updates are running
      if (this.isRunning && this.updateIntervals.length === 0) {
        return false;
      }

      return true;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Health check failed (Viem)');
      return false;
    }
  }

  /**
   * Get service status
   */
  async getServiceStatus(): Promise<{ healthy: boolean; timestamp: number; details?: any }> {
    const healthy = await this.healthCheck();

    return {
      healthy,
      timestamp: Date.now(),
      details: {
        isRunning: this.isRunning,
        subscriptionCount: this.subscriptions.size,
        lastPriceUpdate: this.lastPriceUpdate,
        lastBlockNumber: Number(this.lastBlockNumber)
      }
    };
  }

  // Private helper methods

  private startPeriodicUpdates(): void {
    logger.debug('Starting periodic price updates (Viem)');

    // Price updates
    const priceInterval = setInterval(async () => {
      try {
        await this.updateAllPrices();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Periodic price update failed (Viem)');
      }
    }, this.config.priceUpdateInterval);

    this.updateIntervals.push(priceInterval);

    // Liquidity updates
    const liquidityInterval = setInterval(async () => {
      try {
        await this.updateAllLiquidity();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Periodic liquidity update failed (Viem)');
      }
    }, this.config.liquidityUpdateInterval);

    this.updateIntervals.push(liquidityInterval);
  }

  private async startBlockMonitoring(): Promise<void> {
    logger.debug('Starting block monitoring (Viem)');

    // Use Viem's block monitoring
    const unwatch = this.publicClient.watchBlocks({
      onBlock: async (block) => {
        await this.handleNewBlock(block.number);
      }
    });

    // Store unwatch function for cleanup
    this.updateIntervals.push(setInterval(() => {}, 0) as any); // Placeholder for unwatch
  }

  private async startEventMonitoring(): Promise<void> {
    logger.debug('Starting event monitoring for price updates (Viem)');

    // Monitor PancakeSwap factory for new pairs
    const unwatch = this.publicClient.watchContractEvent({
      address: PANCAKESWAP_FACTORY_ADDRESS,
      abi: PANCAKESWAP_FACTORY_ABI,
      eventName: 'PairCreated',
      onLogs: async (logs) => {
        await this.handlePairCreatedEvents(logs);
      }
    });

    // Store unwatch function for cleanup
    this.updateIntervals.push(setInterval(() => {}, 0) as any); // Placeholder for unwatch
  }

  private async fetchPriceFromSources(address: Address): Promise<TokenPriceDataViem | null> {
    const sources = [];

    if (this.config.enableOnChainCalculations) {
      sources.push(() => this.calculatePriceOnChain(address));
    }

    if (this.config.enableSubgraphPrices) {
      sources.push(() => this.fetchPriceFromSubgraph(address));
    }

    if (this.config.enableAPISources) {
      sources.push(() => this.fetchPriceFromAPI(address));
    }

    for (const fetchPrice of sources) {
      try {
        const priceData = await fetchPrice();
        if (priceData) {
          return priceData;
        }
      } catch (error) {
        logger.debug({ address, source: fetchPrice.name, error: error instanceof Error ? error.message : 'Unknown error' }, 'Price source failed (Viem)');
      }
    }

    return null;
  }

  private async calculatePriceOnChain(address: Address): Promise<TokenPriceDataViem | null> {
    try {
      // Get pair with WBNB for price calculation
      const pairAddress = await this.getPairAddress(address, this.WBNB_ADDRESS);
      if (!pairAddress) {
        return null;
      }

      // Get reserves from pair
      const reserves = await this.publicClient.readContract({
        address: pairAddress,
        abi: PANCAKESWAP_PAIR_ABI,
        functionName: 'getReserves'
      }) as [bigint, bigint, number];

      const [reserve0, reserve1] = reserves;

      // Get token order in pair
      const token0 = await this.publicClient.readContract({
        address: pairAddress,
        abi: PANCAKESWAP_PAIR_ABI,
        functionName: 'token0'
      }) as Address;

      // Determine which reserve belongs to our token
      const isToken0 = token0.toLowerCase() === address.toLowerCase();
      const tokenReserve = isToken0 ? reserve0 : reserve1;
      const wbnbReserve = isToken0 ? reserve1 : reserve0;

      if (wbnbReserve === 0n || tokenReserve === 0n) {
        return null;
      }

      // Calculate price in WBNB
      const priceInWBNB = Number(tokenReserve) / Number(wbnbReserve);

      // Get WBNB price in USD (could be from BUSD pair or external source)
      const wbnbPriceInUSD = await this.getWBNBPriceInUSD();
      const priceInUSD = priceInWBNB * wbnbPriceInUSD;

      const currentBlock = await this.publicClient.getBlockNumber();

      return {
        tokenAddress: address,
        priceUSD: priceInUSD,
        priceBNB: priceInWBNB,
        priceChange24h: 0, // Would calculate from historical data
        priceChange7d: 0,
        priceChange30d: 0,
        volume24hUSD: 0, // Would fetch from subgraph
        marketCapUSD: 0, // Would calculate from totalSupply
        liquidityUSD: 0, // Would calculate from reserves
        timestamp: Date.now(),
        blockNumber: currentBlock
      };

    } catch (error) {
      logger.debug({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'On-chain price calculation failed (Viem)');
      return null;
    }
  }

  private async getPairAddress(tokenA: Address, tokenB: Address): Promise<Address | null> {
    try {
      const factoryAddress = PANCAKESWAP_FACTORY_ADDRESS;

      // Use keccak256 to calculate pair address (simplified)
      // In production, you'd use the factory's getPair function
      return null; // Placeholder - would implement proper pair calculation

    } catch (error) {
      logger.debug({ tokenA, tokenB, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get pair address (Viem)');
      return null;
    }
  }

  private async getWBNBPriceInUSD(): Promise<number> {
    try {
      // Get WBNB/BUSD pair price
      const busdPairAddress = await this.getPairAddress(this.WBNB_ADDRESS, this.BUSD_ADDRESS);
      if (!busdPairAddress) {
        return 300; // Default price
      }

      const reserves = await this.publicClient.readContract({
        address: busdPairAddress,
        abi: PANCAKESWAP_PAIR_ABI,
        functionName: 'getReserves'
      }) as [bigint, bigint, number];

      // Calculate price based on reserves
      const [reserve0, reserve1] = reserves;
      return Number(reserve1) / Number(reserve0);

    } catch (error) {
      logger.debug({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get WBNB price (Viem)');
      return 300; // Default price
    }
  }

  private async fetchPriceFromSubgraph(address: Address): Promise<TokenPriceDataViem | null> {
    try {
      // This would fetch from PancakeSwap subgraph
      // For now, return null as placeholder
      return null;

    } catch (error) {
      logger.debug({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Subgraph price fetch failed (Viem)');
      return null;
    }
  }

  private async fetchPriceFromAPI(address: Address): Promise<TokenPriceDataViem | null> {
    try {
      // This would fetch from CoinGecko or other price API
      // For now, return null as placeholder
      return null;

    } catch (error) {
      logger.debug({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'API price fetch failed (Viem)');
      return null;
    }
  }

  private async fetchHistoricalPricesFromChain(address: Address, from: number, to: number): Promise<PriceHistoryPointViem[]> {
    // This would fetch historical price data from subgraph or calculate from historical events
    // For now, return empty array as placeholder
    return [];
  }

  private async fetchLiquidityFromPancakeSwap(address: Address): Promise<TokenLiquidityDataViem | null> {
    try {
      const pairAddress = await this.getPairAddress(address, this.WBNB_ADDRESS);
      if (!pairAddress) {
        return null;
      }

      const reserves = await this.publicClient.readContract({
        address: pairAddress,
        abi: PANCAKESWAP_PAIR_ABI,
        functionName: 'getReserves'
      }) as [bigint, bigint, number];

      const [reserve0, reserve1] = reserves;
      const wbnbPriceInUSD = await this.getWBNBPriceInUSD();

      // Calculate liquidity in USD
      const totalLiquidityUSD = (Number(reserve0) + Number(reserve1)) * wbnbPriceInUSD;

      const currentBlock = await this.publicClient.getBlockNumber();

      return {
        tokenAddress: address,
        pairAddress,
        token0Reserve: reserve0.toString(),
        token1Reserve: reserve1.toString(),
        liquidityUSD: totalLiquidityUSD,
        timestamp: Date.now()
      };

    } catch (error) {
      logger.debug({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch liquidity from PancakeSwap (Viem)');
      return null;
    }
  }

  private async updateAllPrices(): Promise<void> {
    if (this.subscriptions.size === 0) {
      return;
    }

    const uniqueAddresses = [...new Set(
      Array.from(this.subscriptions.values()).map(sub => sub.tokenAddress)
    )];

    const priceData = await this.getTokenPrices(uniqueAddresses);

    // Notify subscribers
    priceData.forEach(price => {
      const relevantSubscriptions = Array.from(this.subscriptions.values())
        .filter(sub => sub.tokenAddress === price.tokenAddress && sub.isActive);

      relevantSubscriptions.forEach(subscription => {
        try {
          subscription.callback(price);
          subscription.lastUpdate = Date.now();
          subscription.updateCount++;
        } catch (error) {
          logger.error({ subscriptionId: subscription.id, error: error instanceof Error ? error.message : 'Unknown error' }, 'Price callback failed (Viem)');
        }
      });
    });
  }

  private async updateAllLiquidity(): Promise<void> {
    // Update liquidity for all tracked tokens
    // Implementation would be similar to updateAllPrices
  }

  private async handleNewBlock(blockNumber: BlockNumber): Promise<void> {
    if (blockNumber > this.lastBlockNumber) {
      this.lastBlockNumber = blockNumber;

      // Trigger price updates for subscribed tokens
      if (this.config.enableBlockBasedUpdates) {
        await this.updateAllPrices();
      }
    }
  }

  private async handlePairCreatedEvents(logs: Log[]): Promise<void> {
    // Process new pair events to discover new tokens
    for (const log of logs) {
      try {
        const parsedLogs = parseEventLogs({
          abi: PANCAKESWAP_FACTORY_ABI,
          logs: [log]
        });

        if (parsedLogs.length > 0) {
          const event = parsedLogs[0];
          logger.debug({ event }, 'New pair created (Viem)');
          // Could automatically start tracking new tokens
        }
      } catch (error) {
        logger.error({ log, error: error instanceof Error ? error.message : 'Unknown error' }, 'Pair created event processing failed (Viem)');
      }
    }
  }

  private async updatePriceHistory(address: Address, priceData: TokenPriceDataViem): Promise<void> {
    if (!this.config.enableHistoricalData) {
      return;
    }

    const historyPoint: PriceHistoryPointViem = {
      timestamp: priceData.timestamp,
      blockNumber: priceData.blockNumber,
      priceUSD: priceData.priceUSD,
      priceBNB: priceData.priceBNB,
      volume24hUSD: priceData.volume24hUSD,
      liquidityUSD: priceData.liquidityUSD,
      priceChange24h: priceData.priceChange24h
    };

    const addressKey = address.toLowerCase();
    if (!this.priceHistory.has(addressKey)) {
      this.priceHistory.set(addressKey, []);
    }

    const history = this.priceHistory.get(addressKey)!;
    history.push(historyPoint);

    // Keep only last 1000 points to prevent memory issues
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }

  private async calculateAnalytics(address: Address, currentPrice: TokenPriceDataViem, history: PriceHistoryPointViem[]): Promise<PriceAnalyticsViem> {
    // This would calculate comprehensive price analytics
    // For now, return basic structure as placeholder

    return {
      tokenAddress: address,
      currentPrice,
      priceHistory: history,
      price24hAgo: 0,
      price7dAgo: 0,
      price30dAgo: 0,
      allTimeHigh: 0,
      allTimeLow: 0,
      volatility24h: 0,
      volatility7d: 0,
      volatility30d: 0,
      avgVolume24h: 0,
      avgVolume7d: 0,
      volumeTrend: 'stable',
      avgLiquidity24h: 0,
      liquidityUtilization: 0,
      liquidityDepth: {
        depth1Percent: 0,
        depth5Percent: 0,
        depth10Percent: 0
      },
      rsi: 50,
      macd: {
        macd: 0,
        signal: 0,
        histogram: 0
      },
      movingAverages: {
        sma20: 0,
        sma50: 0,
        sma200: 0,
        ema20: 0,
        ema50: 0
      }
    };
  }
}

// Export singleton instance
export const tokenPriceTrackerViem = new TokenPriceTrackerViem();