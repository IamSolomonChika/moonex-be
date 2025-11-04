/**
 * BSC Token Price Tracking Service
 * Real-time price tracking and analytics for BSC tokens
 */

import { ethers } from 'ethers';
import logger from '../../../utils/logger.js';
import type {
  BSCToken,
  TokenPriceData,
  TokenLiquidityData,
  TokenEvent
} from './types.js';
import { BSCProviderManager } from '../../utils/ethers-provider.js';
import { PancakeSwapSubgraphClient } from '../pancakeswap/subgraph-client.js';
import { PancakeSwapAPIClient } from '../pancakeswap/api-client.js';
import { BSCCacheManager } from '../cache/cache-manager.js';
import { BSCEventMonitor } from '../event-monitoring.js';

/**
 * Price tracking configuration
 */
export interface PriceTrackingConfig {
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
export interface PriceSubscription {
  id: string;
  tokenAddress: string;
  callback: (priceData: TokenPriceData) => void;
  lastUpdate: number;
  isActive: boolean;
  updateCount: number;
}

/**
 * Price history data point
 */
export interface PriceHistoryPoint {
  timestamp: number;
  blockNumber: number;
  priceUSD: number;
  priceBNB: number;
  volume24hUSD: number;
  liquidityUSD: number;
  priceChange24h: number;
}

/**
 * Price analytics data
 */
export interface PriceAnalytics {
  tokenAddress: string;
  currentPrice: TokenPriceData;
  priceHistory: PriceHistoryPoint[];

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
 * IPriceTracker interface
 */
export interface IPriceTracker {
  // Price fetching
  getTokenPrice(address: string): Promise<TokenPriceData | null>;
  getTokenPrices(addresses: string[]): Promise<TokenPriceData[]>;
  getHistoricalPrices(address: string, from: number, to: number): Promise<PriceHistoryPoint[]>;

  // Real-time tracking
  subscribeToPriceUpdates(address: string, callback: (price: TokenPriceData) => void): string;
  unsubscribeFromPriceUpdates(subscriptionId: string): void;

  // Analytics
  getPriceAnalytics(address: string, timeframe: string): Promise<PriceAnalytics>;
  getTopMovers(timeframe: string, limit: number): Promise<TokenPriceData[]>;

  // Liquidity tracking
  getTokenLiquidity(address: string): Promise<TokenLiquidityData | null>;
  getLiquidityHistory(address: string, from: number, to: number): Promise<TokenLiquidityData[]>;

  // Lifecycle
  start(config?: Partial<PriceTrackingConfig>): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<boolean>;
}

/**
 * Price Tracker Implementation
 */
export class TokenPriceTracker implements IPriceTracker {
  private config: PriceTrackingConfig;
  private provider: BSCProviderManager;
  private subgraphClient: PancakeSwapSubgraphClient;
  private apiClient: PancakeSwapAPIClient;
  private cache: BSCCacheManager;
  private eventMonitor: BSCEventMonitor;

  private isRunning: boolean = false;
  private subscriptions: Map<string, PriceSubscription> = new Map();
  private updateIntervals: NodeJS.Timeout[] = [];
  private lastPriceUpdate: number = 0;
  private lastBlockNumber: number = 0;
  private priceHistory: Map<string, PriceHistoryPoint[]> = new Map();

  constructor(config?: Partial<PriceTrackingConfig>) {
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

    this.provider = new BSCProviderManager();
    this.subgraphClient = new PancakeSwapSubgraphClient();
    this.apiClient = new PancakeSwapAPIClient();
    this.cache = new BSCCacheManager();
    this.eventMonitor = new BSCEventMonitor();
  }

  /**
   * Start the price tracker
   */
  async start(config?: Partial<PriceTrackingConfig>): Promise<void> {
    if (this.isRunning) {
      return;
    }

    if (config) {
      this.config = { ...this.config, ...config };
    }

    logger.info({ config: this.config }, 'Starting token price tracker');

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
      logger.info('Token price tracker started successfully');

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to start token price tracker');
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

    logger.info('Stopping token price tracker');

    // Clear all intervals
    this.updateIntervals.forEach(interval => clearInterval(interval));
    this.updateIntervals = [];

    // Clear all subscriptions
    this.subscriptions.clear();

    this.isRunning = false;
    logger.info('Token price tracker stopped');
  }

  /**
   * Get current token price
   */
  async getTokenPrice(address: string): Promise<TokenPriceData | null> {
    logger.debug({ address }, 'Getting token price');

    try {
      const cacheKey = `price:${address}`;
      const cached = await this.cache.get<TokenPriceData>(cacheKey);

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

        logger.debug({ address, priceUSD: priceData.priceUSD }, 'Token price fetched');
        return priceData;
      }

      return null;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get token price');
      return null;
    }
  }

  /**
   * Get prices for multiple tokens
   */
  async getTokenPrices(addresses: string[]): Promise<TokenPriceData[]> {
    logger.debug({ addresses }, 'Getting multiple token prices');

    try {
      const results: TokenPriceData[] = [];
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

      logger.debug({ requested: addresses.length, received: results.length }, 'Multiple token prices fetched');
      return results;

    } catch (error) {
      logger.error({ addresses, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get multiple token prices');
      return [];
    }
  }

  /**
   * Get historical price data
   */
  async getHistoricalPrices(address: string, from: number, to: number): Promise<PriceHistoryPoint[]> {
    logger.debug({ address, from, to }, 'Getting historical prices');

    try {
      const cacheKey = `price_history:${address}:${from}:${to}`;
      const cached = await this.cache.get<PriceHistoryPoint[]>(cacheKey);

      if (cached) {
        return cached;
      }

      // Fetch historical data from Subgraph
      const history = await this.fetchHistoricalPricesFromSubgraph(address, from, to);

      // Cache historical data
      await this.cache.set(cacheKey, history, this.config.cacheTTL * 10); // Cache longer

      return history;

    } catch (error) {
      logger.error({ address, from, to, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get historical prices');
      return [];
    }
  }

  /**
   * Subscribe to real-time price updates
   */
  subscribeToPriceUpdates(address: string, callback: (price: TokenPriceData) => void): string {
    if (this.subscriptions.size >= this.config.maxSubscriptions) {
      throw new Error('Maximum number of subscriptions reached');
    }

    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const subscription: PriceSubscription = {
      id: subscriptionId,
      tokenAddress: address.toLowerCase(),
      callback,
      lastUpdate: 0,
      isActive: true,
      updateCount: 0
    };

    this.subscriptions.set(subscriptionId, subscription);

    logger.debug({ subscriptionId, address }, 'Subscribed to price updates');
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
      logger.debug({ subscriptionId }, 'Unsubscribed from price updates');
    }
  }

  /**
   * Get price analytics
   */
  async getPriceAnalytics(address: string, timeframe: string): Promise<PriceAnalytics> {
    logger.debug({ address, timeframe }, 'Getting price analytics');

    try {
      // Get current price
      const currentPrice = await this.getTokenPrice(address);
      if (!currentPrice) {
        throw new Error('Unable to fetch current price');
      }

      // Get historical data based on timeframe
      const now = Date.now();
      let from: number;
      let points: PriceHistoryPoint[];

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

      logger.debug({ address, timeframe, pointsCount: points.length }, 'Price analytics calculated');
      return analytics;

    } catch (error) {
      logger.error({ address, timeframe, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get price analytics');
      throw error;
    }
  }

  /**
   * Get top moving tokens
   */
  async getTopMovers(timeframe: string, limit: number): Promise<TokenPriceData[]> {
    logger.debug({ timeframe, limit }, 'Getting top moving tokens');

    try {
      // This would fetch top movers from Subgraph or API
      // For now, return empty array as placeholder
      return [];

    } catch (error) {
      logger.error({ timeframe, limit, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get top movers');
      return [];
    }
  }

  /**
   * Get token liquidity data
   */
  async getTokenLiquidity(address: string): Promise<TokenLiquidityData | null> {
    logger.debug({ address }, 'Getting token liquidity');

    try {
      const cacheKey = `liquidity:${address}`;
      const cached = await this.cache.get<TokenLiquidityData>(cacheKey);

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
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get token liquidity');
      return null;
    }
  }

  /**
   * Get liquidity history
   */
  async getLiquidityHistory(address: string, from: number, to: number): Promise<TokenLiquidityData[]> {
    logger.debug({ address, from, to }, 'Getting liquidity history');

    try {
      // This would fetch liquidity history from Subgraph
      // For now, return empty array as placeholder
      return [];

    } catch (error) {
      logger.error({ address, from, to, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get liquidity history');
      return [];
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check provider connectivity
      await this.provider.getProvider().getBlockNumber();

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
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Health check failed');
      return false;
    }
  }

  // Private helper methods

  private startPeriodicUpdates(): void {
    logger.debug('Starting periodic price updates');

    // Price updates
    const priceInterval = setInterval(async () => {
      try {
        await this.updateAllPrices();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Periodic price update failed');
      }
    }, this.config.priceUpdateInterval);

    this.updateIntervals.push(priceInterval);

    // Liquidity updates
    const liquidityInterval = setInterval(async () => {
      try {
        await this.updateAllLiquidity();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Periodic liquidity update failed');
      }
    }, this.config.liquidityUpdateInterval);

    this.updateIntervals.push(liquidityInterval);
  }

  private async startBlockMonitoring(): Promise<void> {
    logger.debug('Starting block monitoring');

    this.eventMonitor.startMonitoring({
      contractAddress: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
      eventTopics: [], // Monitor all blocks
      fromBlock: 'latest'
    });
  }

  private async startEventMonitoring(): Promise<void> {
    logger.debug('Starting event monitoring for price updates');

    // Monitor PancakeSwap swap events
    await this.eventMonitor.startMonitoring({
      contractAddress: '0x10ed43c718714eb63d5aa57b78b54704e256024e', // PancakeSwap Router
      eventTopics: [
        '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822', // Swap signature
      ],
      fromBlock: 'latest'
    });
  }

  private async fetchPriceFromSources(address: string): Promise<TokenPriceData | null> {
    const sources = [];

    if (this.config.enableSubgraphPrices) {
      sources.push(() => this.fetchPriceFromSubgraph(address));
    }

    if (this.config.enableAPISources) {
      sources.push(() => this.fetchPriceFromAPI(address));
    }

    if (this.config.enableOnChainCalculations) {
      sources.push(() => this.calculatePriceOnChain(address));
    }

    for (const fetchPrice of sources) {
      try {
        const priceData = await fetchPrice();
        if (priceData) {
          return priceData;
        }
      } catch (error) {
        logger.debug({ address, source: fetchPrice.name, error: error instanceof Error ? error.message : 'Unknown error' }, 'Price source failed');
      }
    }

    return null;
  }

  private async fetchPriceFromSubgraph(address: string): Promise<TokenPriceData | null> {
    try {
      const tokens = await this.subgraphClient.getTokens();
      const tokenData = tokens.find(t => t.id.toLowerCase() === address.toLowerCase()) || null;
      if (!tokenData) return null;

      const currentBlock = await this.provider.getProvider().getBlockNumber();
      const ethPrice = await this.subgraphClient.getETHPrice();

      return {
        tokenAddress: address,
        priceUSD: parseFloat(tokenData.derivedUSD || '0'),
        priceBNB: parseFloat(tokenData.derivedBNB || '0'),
        priceChange24h: 0, // Would calculate from historical data
        priceChange7d: 0,
        priceChange30d: 0,
        volume24hUSD: parseFloat(tokenData.volumeUSD || '0'),
        marketCapUSD: 0,
        liquidityUSD: parseFloat(tokenData.liquidityUSD || '0'),
        timestamp: Date.now(),
        blockNumber: currentBlock
      };

    } catch (error) {
      logger.debug({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Subgraph price fetch failed');
      return null;
    }
  }

  private async fetchPriceFromAPI(address: string): Promise<TokenPriceData | null> {
    try {
      const tokens = await this.apiClient.getTokens();
      const tokenData = tokens.find(t => t.address?.toLowerCase() === address.toLowerCase()) || null;
      if (!tokenData) return null;

      const currentBlock = await this.provider.getProvider().getBlockNumber();

      return {
        tokenAddress: address,
        priceUSD: parseFloat(tokenData.price || '0'),
        priceBNB: 0, // Would need to calculate based on BNB price
        priceChange24h: parseFloat(tokenData.priceChange24h || '0'),
        priceChange7d: 0,
        priceChange30d: 0,
        volume24hUSD: parseFloat(tokenData.volume24hUSD || '0'),
        marketCapUSD: parseFloat(tokenData.marketCapUSD || '0'),
        liquidityUSD: parseFloat(tokenData.liquidityUSD || '0'),
        timestamp: Date.now(),
        blockNumber: currentBlock
      };

    } catch (error) {
      logger.debug({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'API price fetch failed');
      return null;
    }
  }

  private async calculatePriceOnChain(address: string): Promise<TokenPriceData | null> {
    try {
      // This would calculate price directly from reserves in PancakeSwap pairs
      // Complex implementation involving getting pair data and calculating from reserves
      // For now, return null as placeholder
      return null;

    } catch (error) {
      logger.debug({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'On-chain price calculation failed');
      return null;
    }
  }

  private async fetchHistoricalPricesFromSubgraph(address: string, from: number, to: number): Promise<PriceHistoryPoint[]> {
    // This would fetch historical price data from Subgraph
    // For now, return empty array as placeholder
    return [];
  }

  private async fetchLiquidityFromPancakeSwap(address: string): Promise<TokenLiquidityData | null> {
    // This would fetch current liquidity data from PancakeSwap
    // For now, return null as placeholder
    return null;
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
          logger.error({ subscriptionId: subscription.id, error: error instanceof Error ? error.message : 'Unknown error' }, 'Price callback failed');
        }
      });
    });
  }

  private async updateAllLiquidity(): Promise<void> {
    // Update liquidity for all tracked tokens
    // Implementation would be similar to updateAllPrices
  }

  private async handleNewBlock(): Promise<void> {
    const currentBlock = await this.provider.getProvider().getBlockNumber();

    if (currentBlock > this.lastBlockNumber) {
      this.lastBlockNumber = currentBlock;

      // Trigger price updates for subscribed tokens
      if (this.config.enableBlockBasedUpdates) {
        await this.updateAllPrices();
      }
    }
  }

  private async handleSwapEvents(events: any[]): Promise<void> {
    // Process swap events to update affected token prices immediately
    for (const event of events) {
      try {
        // Extract token addresses from swap event and update prices
        // This would provide real-time price updates based on actual swaps
      } catch (error) {
        logger.error({ event: JSON.stringify(event), error: error instanceof Error ? error.message : 'Unknown error' }, 'Swap event processing failed');
      }
    }
  }

  private async updatePriceHistory(address: string, priceData: TokenPriceData): Promise<void> {
    if (!this.config.enableHistoricalData) {
      return;
    }

    const historyPoint: PriceHistoryPoint = {
      timestamp: priceData.timestamp,
      blockNumber: priceData.blockNumber,
      priceUSD: priceData.priceUSD,
      priceBNB: priceData.priceBNB,
      volume24hUSD: priceData.volume24hUSD,
      liquidityUSD: priceData.liquidityUSD,
      priceChange24h: priceData.priceChange24h
    };

    if (!this.priceHistory.has(address)) {
      this.priceHistory.set(address, []);
    }

    const history = this.priceHistory.get(address)!;
    history.push(historyPoint);

    // Keep only last 1000 points to prevent memory issues
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }

  private async calculateAnalytics(address: string, currentPrice: TokenPriceData, history: PriceHistoryPoint[]): Promise<PriceAnalytics> {
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
export const tokenPriceTracker = new TokenPriceTracker();