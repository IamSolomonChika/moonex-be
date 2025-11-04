import { Logger } from '../../../utils/logger.js';
import { ICache } from '../../../services/cache.service.js';
import { BscTokenService } from '../tokens/token-service.js';
import { BscAnalyticsService } from './analytics-service.js';
import { PancakeSwapSubgraphClient } from '../pancakeswap/subgraph-client.js';
import { EventEmitter } from 'events';

const logger = new Logger('ChartingService');

// Charting types and interfaces
export interface ChartDataPoint {
  timestamp: number;
  value: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  close?: number;
}

export interface PriceChartData {
  tokenAddress: string;
  symbol: string;
  data: ChartDataPoint[];
  timeframe: ChartTimeframe;
  lastUpdated: number;
}

export interface PoolChartData {
  poolAddress: string;
  token0Symbol: string;
  token1Symbol: string;
  data: ChartDataPoint[];
  timeframe: ChartTimeframe;
  lastUpdated: number;
}

export interface VolumeChartData {
  tokenAddress: string;
  symbol: string;
  data: ChartDataPoint[];
  timeframe: ChartTimeframe;
  lastUpdated: number;
}

export interface TvlChartData {
  poolAddress: string;
  token0Symbol: string;
  token1Symbol: string;
  data: ChartDataPoint[];
  timeframe: ChartTimeframe;
  lastUpdated: number;
}

export interface LiquidityChartData {
  poolAddress: string;
  token0Symbol: string;
  token1Symbol: string;
  data: ChartDataPoint[];
  timeframe: ChartTimeframe;
  lastUpdated: number;
}

export type ChartTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

export interface ChartConfig {
  type: 'line' | 'candlestick' | 'bar' | 'area';
  timeframe: ChartTimeframe;
  showVolume: boolean;
  showMA: boolean[];
  showRSI: boolean;
  showMACD: boolean;
  showBollingerBands: boolean;
  colors: {
    primary: string;
    secondary: string;
    volume: string;
    ma: string[];
    rsi: string;
    macd: string;
    bollinger: string;
  };
}

export interface TechnicalIndicators {
  sma: { period: number; data: ChartDataPoint[] }[];
  ema: { period: number; data: ChartDataPoint[] }[];
  rsi: { period: number; data: ChartDataPoint[] }[];
  macd: {
    macd: ChartDataPoint[];
    signal: ChartDataPoint[];
    histogram: ChartDataPoint[];
  };
  bollingerBands: {
    upper: ChartDataPoint[];
    middle: ChartDataPoint[];
    lower: ChartDataPoint[];
  };
  stochastic: {
    k: ChartDataPoint[];
    d: ChartDataPoint[];
  };
}

export interface RealTimeUpdate {
  type: 'price' | 'volume' | 'tvl' | 'liquidity';
  identifier: string; // token or pool address
  data: ChartDataPoint;
  timestamp: number;
}

export interface ChartSubscription {
  id: string;
  type: 'token' | 'pool';
  address: string;
  timeframes: ChartTimeframe[];
  config: ChartConfig;
  callbacks: ((update: RealTimeUpdate) => void)[];
  active: boolean;
  lastUpdate: number;
}

export interface ChartCache {
  priceCharts: Map<string, PriceChartData>;
  volumeCharts: Map<string, VolumeChartData>;
  tvlCharts: Map<string, TvlChartData>;
  liquidityCharts: Map<string, LiquidityChartData>;
  technicalIndicators: Map<string, TechnicalIndicators>;
  lastUpdated: number;
}

export class ChartingService extends EventEmitter {
  private cache: ChartCache;
  private subscriptions: Map<string, ChartSubscription> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute
  private readonly REAL_TIME_INTERVAL = 5000; // 5 seconds

  constructor(
    private tokenService: BscTokenService,
    private analyticsService: BscAnalyticsService,
    private subgraphClient: PancakeSwapSubgraphClient,
    private cacheService: ICache
  ) {
    super();
    this.cache = {
      priceCharts: new Map(),
      volumeCharts: new Map(),
      tvlCharts: new Map(),
      liquidityCharts: new Map(),
      technicalIndicators: new Map(),
      lastUpdated: Date.now()
    };
  }

  // Price charting
  async getPriceChart(
    tokenAddress: string,
    timeframe: ChartTimeframe,
    limit: number = 200
  ): Promise<PriceChartData> {
    try {
      const cacheKey = `price_chart_${tokenAddress}_${timeframe}_${limit}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        const chartData = JSON.parse(cached);
        if (Date.now() - chartData.lastUpdated < this.CACHE_TTL) {
          return chartData;
        }
      }

      logger.info(`Generating price chart for token: ${tokenAddress}, timeframe: ${timeframe}`);

      // Get historical price data
      const historicalData = await this.subgraphClient.getTokenPriceHistory(
        tokenAddress,
        this.convertTimeframeToSubgraphFormat(timeframe),
        limit
      );

      const token = await this.tokenService.getTokenInfo(tokenAddress);
      if (!token) {
        throw new Error(`Token not found: ${tokenAddress}`);
      }

      // Transform data for charting
      const data: ChartDataPoint[] = historicalData.map(item => ({
        timestamp: item.timestamp * 1000,
        value: parseFloat(item.priceUSD),
        volume: parseFloat(item.volumeUSD),
        open: parseFloat(item.openPriceUSD || item.priceUSD),
        high: parseFloat(item.highPriceUSD || item.priceUSD),
        low: parseFloat(item.lowPriceUSD || item.priceUSD),
        close: parseFloat(item.priceUSD)
      }));

      const chartData: PriceChartData = {
        tokenAddress,
        symbol: token.symbol,
        data,
        timeframe,
        lastUpdated: Date.now()
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(chartData), this.CACHE_TTL);

      logger.info(`Price chart generated successfully`, {
        address: tokenAddress,
        symbol: token.symbol,
        dataPoints: data.length,
        timeframe
      });

      return chartData;
    } catch (error) {
      logger.error('Failed to get price chart', {
        error: error.message,
        tokenAddress,
        timeframe
      });
      throw error;
    }
  }

  // Volume charting
  async getVolumeChart(
    tokenAddress: string,
    timeframe: ChartTimeframe,
    limit: number = 200
  ): Promise<VolumeChartData> {
    try {
      const cacheKey = `volume_chart_${tokenAddress}_${timeframe}_${limit}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        const chartData = JSON.parse(cached);
        if (Date.now() - chartData.lastUpdated < this.CACHE_TTL) {
          return chartData;
        }
      }

      // Get historical volume data
      const historicalData = await this.subgraphClient.getTokenVolumeHistory(
        tokenAddress,
        this.convertTimeframeToSubgraphFormat(timeframe),
        limit
      );

      const token = await this.tokenService.getTokenInfo(tokenAddress);
      if (!token) {
        throw new Error(`Token not found: ${tokenAddress}`);
      }

      const data: ChartDataPoint[] = historicalData.map(item => ({
        timestamp: item.timestamp * 1000,
        value: parseFloat(item.volumeUSD),
        volume: parseFloat(item.volumeUSD)
      }));

      const chartData: VolumeChartData = {
        tokenAddress,
        symbol: token.symbol,
        data,
        timeframe,
        lastUpdated: Date.now()
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(chartData), this.CACHE_TTL);

      logger.info(`Volume chart generated successfully`, {
        address: tokenAddress,
        symbol: token.symbol,
        dataPoints: data.length,
        timeframe
      });

      return chartData;
    } catch (error) {
      logger.error('Failed to get volume chart', {
        error: error.message,
        tokenAddress,
        timeframe
      });
      throw error;
    }
  }

  // TVL charting for pools
  async getTvlChart(
    poolAddress: string,
    timeframe: ChartTimeframe,
    limit: number = 200
  ): Promise<TvlChartData> {
    try {
      const cacheKey = `tvl_chart_${poolAddress}_${timeframe}_${limit}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        const chartData = JSON.parse(cached);
        if (Date.now() - chartData.lastUpdated < this.CACHE_TTL) {
          return chartData;
        }
      }

      // Get pool information
      const pool = await this.subgraphClient.getPool(poolAddress);
      if (!pool) {
        throw new Error(`Pool not found: ${poolAddress}`);
      }

      // Get historical TVL data
      const historicalData = await this.subgraphClient.getPoolTvlHistory(
        poolAddress,
        this.convertTimeframeToSubgraphFormat(timeframe),
        limit
      );

      const data: ChartDataPoint[] = historicalData.map(item => ({
        timestamp: item.timestamp * 1000,
        value: parseFloat(item.totalValueLockedUSD),
        volume: parseFloat(item.volumeUSD)
      }));

      const chartData: TvlChartData = {
        poolAddress,
        token0Symbol: pool.token0.symbol,
        token1Symbol: pool.token1.symbol,
        data,
        timeframe,
        lastUpdated: Date.now()
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(chartData), this.CACHE_TTL);

      logger.info(`TVL chart generated successfully`, {
        address: poolAddress,
        tokenPair: `${pool.token0.symbol}/${pool.token1.symbol}`,
        dataPoints: data.length,
        timeframe
      });

      return chartData;
    } catch (error) {
      logger.error('Failed to get TVL chart', {
        error: error.message,
        poolAddress,
        timeframe
      });
      throw error;
    }
  }

  // Liquidity charting
  async getLiquidityChart(
    poolAddress: string,
    timeframe: ChartTimeframe,
    limit: number = 200
  ): Promise<LiquidityChartData> {
    try {
      const cacheKey = `liquidity_chart_${poolAddress}_${timeframe}_${limit}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        const chartData = JSON.parse(cached);
        if (Date.now() - chartData.lastUpdated < this.CACHE_TTL) {
          return chartData;
        }
      }

      // Get pool information
      const pool = await this.subgraphClient.getPool(poolAddress);
      if (!pool) {
        throw new Error(`Pool not found: ${poolAddress}`);
      }

      // Get historical liquidity data
      const historicalData = await this.subgraphClient.getPoolLiquidityHistory(
        poolAddress,
        this.convertTimeframeToSubgraphFormat(timeframe),
        limit
      );

      const data: ChartDataPoint[] = historicalData.map(item => ({
        timestamp: item.timestamp * 1000,
        value: parseFloat(item.liquidity),
        volume: parseFloat(item.volumeUSD)
      }));

      const chartData: LiquidityChartData = {
        poolAddress,
        token0Symbol: pool.token0.symbol,
        token1Symbol: pool.token1.symbol,
        data,
        timeframe,
        lastUpdated: Date.now()
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(chartData), this.CACHE_TTL);

      logger.info(`Liquidity chart generated successfully`, {
        address: poolAddress,
        tokenPair: `${pool.token0.symbol}/${pool.token1.symbol}`,
        dataPoints: data.length,
        timeframe
      });

      return chartData;
    } catch (error) {
      logger.error('Failed to get liquidity chart', {
        error: error.message,
        poolAddress,
        timeframe
      });
      throw error;
    }
  }

  // Technical indicators
  async getTechnicalIndicators(
    tokenAddress: string,
    timeframe: ChartTimeframe,
    indicators: string[] = ['sma', 'ema', 'rsi', 'macd', 'bollinger']
  ): Promise<TechnicalIndicators> {
    try {
      const cacheKey = `technical_indicators_${tokenAddress}_${timeframe}_${indicators.join(',')}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get price data first
      const priceChart = await this.getPriceChart(tokenAddress, timeframe, 500);
      const prices = priceChart.data.map(point => point.value);

      const technicalIndicators: TechnicalIndicators = {
        sma: [],
        ema: [],
        rsi: [],
        macd: { macd: [], signal: [], histogram: [] },
        bollingerBands: { upper: [], middle: [], lower: [] },
        stochastic: { k: [], d: [] }
      };

      // Calculate SMA
      if (indicators.includes('sma')) {
        for (const period of [20, 50, 200]) {
          const smaData = this.calculateSMA(prices, period);
          technicalIndicators.sma.push({
            period,
            data: smaData.map((value, index) => ({
              timestamp: priceChart.data[index + period - 1].timestamp,
              value
            }))
          });
        }
      }

      // Calculate EMA
      if (indicators.includes('ema')) {
        for (const period of [12, 26]) {
          const emaData = this.calculateEMA(prices, period);
          technicalIndicators.ema.push({
            period,
            data: emaData.map((value, index) => ({
              timestamp: priceChart.data[index].timestamp,
              value
            }))
          });
        }
      }

      // Calculate RSI
      if (indicators.includes('rsi')) {
        const rsiData = this.calculateRSI(prices, 14);
        technicalIndicators.rsi.push({
          period: 14,
          data: rsiData.map((value, index) => ({
            timestamp: priceChart.data[index + 13].timestamp,
            value
          }))
        });
      }

      // Calculate MACD
      if (indicators.includes('macd')) {
        const ema12 = this.calculateEMA(prices, 12);
        const ema26 = this.calculateEMA(prices, 26);
        const macdLine = ema12.map((val, index) => val - ema26[index]);
        const signalLine = this.calculateEMA(macdLine, 9);
        const histogram = macdLine.map((val, index) => val - signalLine[index]);

        technicalIndicators.macd = {
          macd: macdLine.slice(26).map((value, index) => ({
            timestamp: priceChart.data[index + 26].timestamp,
            value
          })),
          signal: signalLine.slice(26).map((value, index) => ({
            timestamp: priceChart.data[index + 26].timestamp,
            value
          })),
          histogram: histogram.slice(26).map((value, index) => ({
            timestamp: priceChart.data[index + 26].timestamp,
            value
          }))
        };
      }

      // Calculate Bollinger Bands
      if (indicators.includes('bollinger')) {
        const period = 20;
        const stdDev = 2;
        const sma = this.calculateSMA(prices, period);
        const upperBand: number[] = [];
        const lowerBand: number[] = [];

        for (let i = period - 1; i < prices.length; i++) {
          const slice = prices.slice(i - period + 1, i + 1);
          const mean = sma[i - period + 1];
          const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
          const standardDeviation = Math.sqrt(variance);

          upperBand.push(mean + (standardDeviation * stdDev));
          lowerBand.push(mean - (standardDeviation * stdDev));
        }

        technicalIndicators.bollingerBands = {
          upper: upperBand.map((value, index) => ({
            timestamp: priceChart.data[index + period - 1].timestamp,
            value
          })),
          middle: sma.map((value, index) => ({
            timestamp: priceChart.data[index + period - 1].timestamp,
            value
          })),
          lower: lowerBand.map((value, index) => ({
            timestamp: priceChart.data[index + period - 1].timestamp,
            value
          }))
        };
      }

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(technicalIndicators), this.CACHE_TTL);

      logger.info(`Technical indicators calculated for token: ${tokenAddress}`);

      return technicalIndicators;
    } catch (error) {
      logger.error('Failed to calculate technical indicators', {
        error: error.message,
        tokenAddress,
        timeframe
      });
      throw error;
    }
  }

  // Real-time subscriptions
  async subscribeToRealTimeUpdates(
    subscription: Omit<ChartSubscription, 'id' | 'callbacks' | 'active' | 'lastUpdate'>,
    callback: (update: RealTimeUpdate) => void
  ): Promise<string> {
    try {
      const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const fullSubscription: ChartSubscription = {
        ...subscription,
        id,
        callbacks: [callback],
        active: true,
        lastUpdate: Date.now()
      };

      this.subscriptions.set(id, fullSubscription);

      // Start real-time updates
      this.startRealTimeUpdates(id);

      logger.info(`Real-time subscription created: ${id}`, {
        type: subscription.type,
        address: subscription.address,
        timeframes: subscription.timeframes
      });

      return id;
    } catch (error) {
      logger.error('Failed to create real-time subscription', {
        error: error.message,
        subscription
      });
      throw error;
    }
  }

  async unsubscribeFromRealTimeUpdates(subscriptionId: string): Promise<void> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      subscription.active = false;

      // Clear update interval
      const interval = this.updateIntervals.get(subscriptionId);
      if (interval) {
        clearInterval(interval);
        this.updateIntervals.delete(subscriptionId);
      }

      // Remove subscription
      this.subscriptions.delete(subscriptionId);

      logger.info(`Real-time subscription removed: ${subscriptionId}`);
    } catch (error) {
      logger.error('Failed to remove real-time subscription', {
        error: error.message,
        subscriptionId
      });
      throw error;
    }
  }

  // Advanced charting features
  async getComparisonChart(
    tokenAddresses: string[],
    timeframe: ChartTimeframe,
    normalized: boolean = true
  ): Promise<{
    tokens: Array<{
      address: string;
      symbol: string;
      data: ChartDataPoint[];
    }>;
    timeframe: ChartTimeframe;
    normalized: boolean;
    lastUpdated: number;
  }> {
    try {
      const tokenCharts = await Promise.all(
        tokenAddresses.map(address => this.getPriceChart(address, timeframe))
      );

      let tokens = tokenCharts.map(chart => ({
        address: chart.tokenAddress,
        symbol: chart.symbol,
        data: chart.data
      }));

      // Normalize data if requested
      if (normalized) {
        const maxValue = Math.max(...tokens.flatMap(token => token.data.map(point => point.value)));

        tokens = tokens.map(token => ({
          ...token,
          data: token.data.map(point => ({
            ...point,
            value: (point.value / maxValue) * 100
          }))
        }));
      }

      return {
        tokens,
        timeframe,
        normalized,
        lastUpdated: Date.now()
      };
    } catch (error) {
      logger.error('Failed to get comparison chart', {
        error: error.message,
        tokenAddresses,
        timeframe,
        normalized
      });
      throw error;
    }
  }

  async getCorrelationMatrix(
    tokenAddresses: string[],
    timeframe: ChartTimeframe,
    period: number = 30
  ): Promise<{
    matrix: number[][];
    tokens: Array<{ address: string; symbol: string }>;
    period: number;
    timeframe: ChartTimeframe;
    lastUpdated: number;
  }> {
    try {
      const tokenCharts = await Promise.all(
        tokenAddresses.map(address => this.getPriceChart(address, timeframe, period))
      );

      const returns: number[][] = tokenCharts.map(chart => {
        const prices = chart.data.map(point => point.value);
        const tokenReturns: number[] = [];

        for (let i = 1; i < prices.length; i++) {
          tokenReturns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
        }

        return tokenReturns;
      });

      const matrix: number[][] = [];
      for (let i = 0; i < returns.length; i++) {
        matrix[i] = [];
        for (let j = 0; j < returns.length; j++) {
          matrix[i][j] = this.calculateCorrelation(returns[i], returns[j]);
        }
      }

      return {
        matrix,
        tokens: tokenCharts.map(chart => ({
          address: chart.tokenAddress,
          symbol: chart.symbol
        })),
        period,
        timeframe,
        lastUpdated: Date.now()
      };
    } catch (error) {
      logger.error('Failed to get correlation matrix', {
        error: error.message,
        tokenAddresses,
        timeframe,
        period
      });
      throw error;
    }
  }

  // Private helper methods
  private convertTimeframeToSubgraphFormat(timeframe: ChartTimeframe): string {
    const mapping: { [key in ChartTimeframe]: string } = {
      '1m': '1',
      '5m': '5',
      '15m': '15',
      '1h': '60',
      '4h': '240',
      '1d': '1440',
      '1w': '10080'
    };

    return mapping[timeframe] || '60';
  }

  private calculateSMA(prices: number[], period: number): number[] {
    const sma: number[] = [];

    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }

    return sma;
  }

  private calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // Start with SMA
    const firstValue = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    ema.push(firstValue);

    for (let i = period; i < prices.length; i++) {
      const value = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(value);
    }

    return ema;
  }

  private calculateRSI(prices: number[], period: number = 14): number[] {
    const rsi: number[] = [];
    let gains = 0;
    let losses = 0;

    // Calculate initial gains and losses
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change >= 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];

      if (change >= 0) {
        avgGain = (avgGain * (period - 1) + change) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) - change) / period;
      }

      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }

    return rsi;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) {
      return 0;
    }

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private startRealTimeUpdates(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription || !subscription.active) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        await this.fetchRealTimeUpdate(subscriptionId);
      } catch (error) {
        logger.error('Real-time update failed', {
          error: error.message,
          subscriptionId
        });
      }
    }, this.REAL_TIME_INTERVAL);

    this.updateIntervals.set(subscriptionId, interval);
  }

  private async fetchRealTimeUpdate(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription || !subscription.active) {
      return;
    }

    try {
      let update: RealTimeUpdate | null = null;

      if (subscription.type === 'token') {
        // Get latest price for token
        const currentPrice = await this.tokenService.getTokenPrice(subscription.address);

        update = {
          type: 'price',
          identifier: subscription.address,
          data: {
            timestamp: Date.now(),
            value: currentPrice
          },
          timestamp: Date.now()
        };
      } else if (subscription.type === 'pool') {
        // Get latest TVL for pool
        const pool = await this.subgraphClient.getPool(subscription.address);

        if (pool) {
          update = {
            type: 'tvl',
            identifier: subscription.address,
            data: {
              timestamp: Date.now(),
              value: parseFloat(pool.totalValueLockedUSD)
            },
            timestamp: Date.now()
          };
        }
      }

      if (update) {
        // Notify all callbacks
        subscription.callbacks.forEach(callback => {
          try {
            callback(update!);
          } catch (error) {
            logger.error('Callback error in real-time update', {
              error: error.message,
              subscriptionId
            });
          }
        });

        // Emit event
        this.emit('realTimeUpdate', update);

        subscription.lastUpdate = Date.now();
      }
    } catch (error) {
      logger.error('Failed to fetch real-time update', {
        error: error.message,
        subscriptionId
      });
    }
  }

  // Cache management
  async clearCache(): Promise<void> {
    try {
      this.cache = {
        priceCharts: new Map(),
        volumeCharts: new Map(),
        tvlCharts: new Map(),
        liquidityCharts: new Map(),
        technicalIndicators: new Map(),
        lastUpdated: Date.now()
      };

      // Stop all real-time subscriptions
      this.subscriptions.forEach((subscription, id) => {
        subscription.active = false;
        const interval = this.updateIntervals.get(id);
        if (interval) {
          clearInterval(interval);
        }
      });

      this.subscriptions.clear();
      this.updateIntervals.clear();

      logger.info('Charting service cache cleared');
    } catch (error) {
      logger.error('Failed to clear charting cache', { error: error.message });
      throw error;
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    await this.clearCache();
    this.removeAllListeners();
    logger.info('Charting service cleaned up');
  }
}

// Factory function
export function createChartingService(
  tokenService: BscTokenService,
  analyticsService: BscAnalyticsService,
  subgraphClient: PancakeSwapSubgraphClient,
  cacheService: ICache
): ChartingService {
  return new ChartingService(
    tokenService,
    analyticsService,
    subgraphClient,
    cacheService
  );
}