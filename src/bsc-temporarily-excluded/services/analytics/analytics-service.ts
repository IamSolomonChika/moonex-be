import { Logger } from '../../../utils/logger.js';
import { ICache } from '../../../services/cache.service.js';
import { BscTokenService } from '../tokens/token-service.js';
import { BscTradingService } from '../trading/trading-service.js';
import { BscLiquidityService } from '../liquidity/liquidity-service.js';
import { BscYieldService } from '../yield/yield-service.js';
import { PancakeSwapSubgraphClient } from '../pancakeswap/subgraph-client.js';

const logger = new Logger('BscAnalyticsService');

// Analytics types and interfaces
export interface TokenAnalytics {
  symbol: string;
  address: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  holders: number;
  transactions24h: number;
  createdAt: number;
  lastUpdated: number;
}

export interface PoolAnalytics {
  address: string;
  token0Symbol: string;
  token1Symbol: string;
  token0Address: string;
  token1Address: string;
  fee: number;
  reserve0: number;
  reserve1: number;
  totalSupply: number;
  volume24h: number;
  apr: number;
  price0: number;
  price1: number;
  tvl: number;
  transactions24h: number;
  createdAt: number;
  lastUpdated: number;
}

export interface FarmAnalytics {
  address: string;
  poolAddress: string;
  token0Symbol: string;
  token1Symbol: string;
  rewardTokenSymbol: string;
  apr: number;
  apy: number;
  tvl: number;
  rewardPerBlock: number;
  multiplier: string;
  allocationPoints: number;
  totalAllocationPoints: number;
  createdAt: number;
  lastUpdated: number;
}

export interface MarketOverview {
  totalVolume24h: number;
  totalTvl: number;
  totalTransactions24h: number;
  topGainers: TokenAnalytics[];
  topLosers: TokenAnalytics[];
  topVolumeTokens: TokenAnalytics[];
  topPoolsByTvl: PoolAnalytics[];
  topFarmsByApr: FarmAnalytics[];
  timestamp: number;
}

export interface TrendingData {
  tokens: TokenAnalytics[];
  pools: PoolAnalytics[];
  farms: FarmAnalytics[];
  timestamp: number;
  timeframe: '1h' | '24h' | '7d' | '30d';
}

export interface AnalyticsQuery {
  type: 'token' | 'pool' | 'farm' | 'market';
  address?: string;
  symbol?: string;
  timeframe?: '1h' | '24h' | '7d' | '30d';
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface HistoricalData {
  timestamp: number;
  value: number;
  volume?: number;
  transactions?: number;
}

export interface PriceHistory {
  tokenAddress: string;
  symbol: string;
  data: HistoricalData[];
  timeframe: '1h' | '24h' | '7d' | '30d';
}

export interface VolumeHistory {
  tokenAddress: string;
  symbol: string;
  data: HistoricalData[];
  timeframe: '1h' | '24h' | '7d' | '30d';
}

export interface TvlHistory {
  poolAddress: string;
  token0Symbol: string;
  token1Symbol: string;
  data: HistoricalData[];
  timeframe: '1h' | '24h' | '7d' | '30d';
}

export interface AnalyticsCache {
  tokenAnalytics: Map<string, TokenAnalytics>;
  poolAnalytics: Map<string, PoolAnalytics>;
  farmAnalytics: Map<string, FarmAnalytics>;
  marketOverview: MarketOverview | null;
  trendingData: Map<string, TrendingData>;
  priceHistory: Map<string, PriceHistory>;
  volumeHistory: Map<string, VolumeHistory>;
  tvlHistory: Map<string, TvlHistory>;
  lastUpdated: number;
}

export class BscAnalyticsService {
  private cache: AnalyticsCache;
  private readonly CACHE_TTL = 60000; // 1 minute
  private readonly HISTORICAL_CACHE_TTL = 300000; // 5 minutes

  constructor(
    private tokenService: BscTokenService,
    private tradingService: BscTradingService,
    private liquidityService: BscLiquidityService,
    private yieldService: BscYieldService,
    private subgraphClient: PancakeSwapSubgraphClient,
    private cacheService: ICache
  ) {
    this.cache = {
      tokenAnalytics: new Map(),
      poolAnalytics: new Map(),
      farmAnalytics: new Map(),
      marketOverview: null,
      trendingData: new Map(),
      priceHistory: new Map(),
      volumeHistory: new Map(),
      tvlHistory: new Map(),
      lastUpdated: 0
    };
  }

  // Token analytics
  async getTokenAnalytics(tokenAddress: string): Promise<TokenAnalytics> {
    try {
      // Check cache first
      const cacheKey = `token_analytics_${tokenAddress}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get token information
      const token = await this.tokenService.getTokenInfo(tokenAddress);
      if (!token) {
        throw new Error(`Token not found: ${tokenAddress}`);
      }

      // Get price and market data
      const price = await this.tokenService.getTokenPrice(tokenAddress);
      const volume24h = await this.getTokenVolume24h(tokenAddress);
      const liquidity = await this.getTokenLiquidity(tokenAddress);
      const transactions24h = await this.getTokenTransactions24h(tokenAddress);
      const priceChange24h = await this.getTokenPriceChange24h(tokenAddress);

      const analytics: TokenAnalytics = {
        symbol: token.symbol,
        address: token.address,
        price,
        priceChange24h,
        volume24h,
        marketCap: this.calculateMarketCap(price, token.totalSupply),
        liquidity,
        holders: token.holderCount || 0,
        transactions24h,
        createdAt: Date.now(),
        lastUpdated: Date.now()
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(analytics), this.CACHE_TTL);

      logger.info(`Token analytics retrieved: ${token.symbol}`, {
        address: tokenAddress,
        price,
        volume24h
      });

      return analytics;
    } catch (error) {
      logger.error('Failed to get token analytics', {
        error: error.message,
        tokenAddress
      });
      throw error;
    }
  }

  async getMultipleTokenAnalytics(tokenAddresses: string[]): Promise<TokenAnalytics[]> {
    try {
      const results = await Promise.allSettled(
        tokenAddresses.map(address => this.getTokenAnalytics(address))
      );

      const analytics: TokenAnalytics[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          analytics.push(result.value);
        } else {
          logger.warn('Failed to get token analytics for address', {
            error: result.reason.message
          });
        }
      }

      return analytics;
    } catch (error) {
      logger.error('Failed to get multiple token analytics', { error: error.message });
      throw error;
    }
  }

  // Pool analytics
  async getPoolAnalytics(poolAddress: string): Promise<PoolAnalytics> {
    try {
      // Check cache first
      const cacheKey = `pool_analytics_${poolAddress}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get pool information from subgraph
      const pool = await this.subgraphClient.getPool(poolAddress);
      if (!pool) {
        throw new Error(`Pool not found: ${poolAddress}`);
      }

      // Calculate current prices
      const price0 = parseFloat(pool.token0.derivedETH) * parseFloat(pool.bundle.ethPriceUSD);
      const price1 = parseFloat(pool.token1.derivedETH) * parseFloat(pool.bundle.ethPriceUSD);

      const analytics: PoolAnalytics = {
        address: pool.id,
        token0Symbol: pool.token0.symbol,
        token1Symbol: pool.token1.symbol,
        token0Address: pool.token0.id,
        token1Address: pool.token1.id,
        fee: pool.feeTier,
        reserve0: parseFloat(pool.reserve0),
        reserve1: parseFloat(pool.reserve1),
        totalSupply: parseFloat(pool.liquidity),
        volume24h: parseFloat(pool.volumeUSD),
        apr: await this.calculatePoolApr(pool),
        price0,
        price1,
        tvl: parseFloat(pool.totalValueLockedUSD),
        transactions24h: parseInt(pool.txCount),
        createdAt: parseInt(pool.createdAtTimestamp) * 1000,
        lastUpdated: Date.now()
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(analytics), this.CACHE_TTL);

      logger.info(`Pool analytics retrieved: ${pool.token0Symbol}/${pool.token1Symbol}`, {
        address: poolAddress,
        tvl: analytics.tvl,
        volume24h: analytics.volume24h
      });

      return analytics;
    } catch (error) {
      logger.error('Failed to get pool analytics', {
        error: error.message,
        poolAddress
      });
      throw error;
    }
  }

  // Farm analytics
  async getFarmAnalytics(farmAddress: string): Promise<FarmAnalytics> {
    try {
      // Check cache first
      const cacheKey = `farm_analytics_${farmAddress}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get farm information
      const farm = await this.yieldService.getFarmInfo(farmAddress);
      if (!farm) {
        throw new Error(`Farm not found: ${farmAddress}`);
      }

      const analytics: FarmAnalytics = {
        address: farm.address,
        poolAddress: farm.lpTokenAddress,
        token0Symbol: farm.token0Symbol,
        token1Symbol: farm.token1Symbol,
        rewardTokenSymbol: farm.rewardTokenSymbol,
        apr: farm.apr,
        apy: farm.apy,
        tvl: farm.tvl,
        rewardPerBlock: farm.rewardPerBlock,
        multiplier: farm.multiplier,
        allocationPoints: farm.allocationPoints,
        totalAllocationPoints: farm.totalAllocationPoints,
        createdAt: farm.createdAt,
        lastUpdated: Date.now()
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(analytics), this.CACHE_TTL);

      logger.info(`Farm analytics retrieved: ${farm.token0Symbol}/${farm.token1Symbol}`, {
        address: farmAddress,
        apr: analytics.apr,
        tvl: analytics.tvl
      });

      return analytics;
    } catch (error) {
      logger.error('Failed to get farm analytics', {
        error: error.message,
        farmAddress
      });
      throw error;
    }
  }

  // Market overview
  async getMarketOverview(): Promise<MarketOverview> {
    try {
      // Check cache first
      const cacheKey = 'market_overview';
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get top tokens by volume
      const topVolumeTokens = await this.getTopTokensByVolume(10);

      // Get top pools by TVL
      const topPoolsByTvl = await this.getTopPoolsByTvl(10);

      // Get top farms by APR
      const topFarmsByApr = await this.getTopFarmsByApr(10);

      // Calculate market totals
      const totalVolume24h = topVolumeTokens.reduce((sum, token) => sum + token.volume24h, 0);
      const totalTvl = topPoolsByTvl.reduce((sum, pool) => sum + pool.tvl, 0);
      const totalTransactions24h = topVolumeTokens.reduce((sum, token) => sum + token.transactions24h, 0);

      // Get top gainers and losers
      const topGainers = topVolumeTokens
        .filter(token => token.priceChange24h > 0)
        .sort((a, b) => b.priceChange24h - a.priceChange24h)
        .slice(0, 5);

      const topLosers = topVolumeTokens
        .filter(token => token.priceChange24h < 0)
        .sort((a, b) => a.priceChange24h - b.priceChange24h)
        .slice(0, 5);

      const overview: MarketOverview = {
        totalVolume24h,
        totalTvl,
        totalTransactions24h,
        topGainers,
        topLosers,
        topVolumeTokens,
        topPoolsByTvl,
        topFarmsByApr,
        timestamp: Date.now()
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(overview), this.CACHE_TTL);

      logger.info('Market overview generated', {
        totalVolume24h,
        totalTvl,
        totalTransactions24h
      });

      return overview;
    } catch (error) {
      logger.error('Failed to get market overview', { error: error.message });
      throw error;
    }
  }

  // Trending data
  async getTrendingData(timeframe: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<TrendingData> {
    try {
      const cacheKey = `trending_${timeframe}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get trending tokens (high volume and price change)
      const trendingTokens = await this.getTrendingTokens(timeframe);

      // Get trending pools (high volume and TVL growth)
      const trendingPools = await this.getTrendingPools(timeframe);

      // Get trending farms (high APR and TVL growth)
      const trendingFarms = await this.getTrendingFarms(timeframe);

      const trendingData: TrendingData = {
        tokens: trendingTokens,
        pools: trendingPools,
        farms: trendingFarms,
        timestamp: Date.now(),
        timeframe
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(trendingData), this.CACHE_TTL);

      logger.info(`Trending data retrieved for timeframe: ${timeframe}`);

      return trendingData;
    } catch (error) {
      logger.error('Failed to get trending data', { error: error.message, timeframe });
      throw error;
    }
  }

  // Price history
  async getPriceHistory(
    tokenAddress: string,
    timeframe: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<PriceHistory> {
    try {
      const cacheKey = `price_history_${tokenAddress}_${timeframe}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get historical price data from subgraph
      const historicalData = await this.subgraphClient.getTokenPriceHistory(tokenAddress, timeframe);

      const token = await this.tokenService.getTokenInfo(tokenAddress);
      if (!token) {
        throw new Error(`Token not found: ${tokenAddress}`);
      }

      const priceHistory: PriceHistory = {
        tokenAddress,
        symbol: token.symbol,
        data: historicalData.map(item => ({
          timestamp: item.timestamp * 1000,
          value: parseFloat(item.priceUSD),
          volume: parseFloat(item.volumeUSD)
        })),
        timeframe
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(priceHistory), this.HISTORICAL_CACHE_TTL);

      logger.info(`Price history retrieved: ${token.symbol}`, {
        address: tokenAddress,
        timeframe,
        dataPoints: priceHistory.data.length
      });

      return priceHistory;
    } catch (error) {
      logger.error('Failed to get price history', {
        error: error.message,
        tokenAddress,
        timeframe
      });
      throw error;
    }
  }

  // Volume history
  async getVolumeHistory(
    tokenAddress: string,
    timeframe: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<VolumeHistory> {
    try {
      const cacheKey = `volume_history_${tokenAddress}_${timeframe}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get historical volume data
      const historicalData = await this.subgraphClient.getTokenVolumeHistory(tokenAddress, timeframe);

      const token = await this.tokenService.getTokenInfo(tokenAddress);
      if (!token) {
        throw new Error(`Token not found: ${tokenAddress}`);
      }

      const volumeHistory: VolumeHistory = {
        tokenAddress,
        symbol: token.symbol,
        data: historicalData.map(item => ({
          timestamp: item.timestamp * 1000,
          value: parseFloat(item.volumeUSD),
          transactions: parseInt(item.txCount)
        })),
        timeframe
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(volumeHistory), this.HISTORICAL_CACHE_TTL);

      logger.info(`Volume history retrieved: ${token.symbol}`, {
        address: tokenAddress,
        timeframe,
        dataPoints: volumeHistory.data.length
      });

      return volumeHistory;
    } catch (error) {
      logger.error('Failed to get volume history', {
        error: error.message,
        tokenAddress,
        timeframe
      });
      throw error;
    }
  }

  // TVL history for pools
  async getTvlHistory(
    poolAddress: string,
    timeframe: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<TvlHistory> {
    try {
      const cacheKey = `tvl_history_${poolAddress}_${timeframe}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get pool information
      const pool = await this.subgraphClient.getPool(poolAddress);
      if (!pool) {
        throw new Error(`Pool not found: ${poolAddress}`);
      }

      // Get historical TVL data
      const historicalData = await this.subgraphClient.getPoolTvlHistory(poolAddress, timeframe);

      const tvlHistory: TvlHistory = {
        poolAddress,
        token0Symbol: pool.token0.symbol,
        token1Symbol: pool.token1.symbol,
        data: historicalData.map(item => ({
          timestamp: item.timestamp * 1000,
          value: parseFloat(item.totalValueLockedUSD),
          volume: parseFloat(item.volumeUSD)
        })),
        timeframe
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(tvlHistory), this.HISTORICAL_CACHE_TTL);

      logger.info(`TVL history retrieved: ${pool.token0Symbol}/${pool.token1Symbol}`, {
        address: poolAddress,
        timeframe,
        dataPoints: tvlHistory.data.length
      });

      return tvlHistory;
    } catch (error) {
      logger.error('Failed to get TVL history', {
        error: error.message,
        poolAddress,
        timeframe
      });
      throw error;
    }
  }

  // Search and filter analytics
  async searchAnalytics(query: AnalyticsQuery): Promise<{
    tokens?: TokenAnalytics[];
    pools?: PoolAnalytics[];
    farms?: FarmAnalytics[];
    total: number;
  }> {
    try {
      switch (query.type) {
        case 'token':
          return await this.searchTokenAnalytics(query);
        case 'pool':
          return await this.searchPoolAnalytics(query);
        case 'farm':
          return await this.searchFarmAnalytics(query);
        case 'market':
          return await this.searchMarketAnalytics(query);
        default:
          throw new Error(`Invalid query type: ${query.type}`);
      }
    } catch (error) {
      logger.error('Failed to search analytics', { error: error.message, query });
      throw error;
    }
  }

  // Analytics aggregation
  async getAggregatedAnalytics(
    type: 'token' | 'pool' | 'farm',
    aggregation: 'total' | 'average' | 'sum',
    field: string,
    timeframe?: '1h' | '24h' | '7d' | '30d'
  ): Promise<{
    value: number;
    count: number;
    timestamp: number;
  }> {
    try {
      // This would implement aggregation logic for specific fields
      // For now, return a placeholder implementation
      return {
        value: 0,
        count: 0,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('Failed to get aggregated analytics', {
        error: error.message,
        type,
        aggregation,
        field,
        timeframe
      });
      throw error;
    }
  }

  // Private helper methods
  private async getTokenVolume24h(tokenAddress: string): Promise<number> {
    try {
      const volumeData = await this.subgraphClient.getTokenVolumeHistory(tokenAddress, '24h');
      return volumeData.reduce((sum, item) => sum + parseFloat(item.volumeUSD), 0);
    } catch (error) {
      logger.warn('Failed to get token 24h volume', { error: error.message, tokenAddress });
      return 0;
    }
  }

  private async getTokenLiquidity(tokenAddress: string): Promise<number> {
    try {
      const pools = await this.subgraphClient.getTokenPools(tokenAddress);
      return pools.reduce((sum, pool) => sum + parseFloat(pool.totalValueLockedUSD), 0);
    } catch (error) {
      logger.warn('Failed to get token liquidity', { error: error.message, tokenAddress });
      return 0;
    }
  }

  private async getTokenTransactions24h(tokenAddress: string): Promise<number> {
    try {
      const volumeData = await this.subgraphClient.getTokenVolumeHistory(tokenAddress, '24h');
      return volumeData.reduce((sum, item) => sum + parseInt(item.txCount), 0);
    } catch (error) {
      logger.warn('Failed to get token 24h transactions', { error: error.message, tokenAddress });
      return 0;
    }
  }

  private async getTokenPriceChange24h(tokenAddress: string): Promise<number> {
    try {
      const priceHistory = await this.subgraphClient.getTokenPriceHistory(tokenAddress, '24h');
      if (priceHistory.length < 2) return 0;

      const currentPrice = parseFloat(priceHistory[priceHistory.length - 1].priceUSD);
      const previousPrice = parseFloat(priceHistory[0].priceUSD);

      return ((currentPrice - previousPrice) / previousPrice) * 100;
    } catch (error) {
      logger.warn('Failed to get token 24h price change', { error: error.message, tokenAddress });
      return 0;
    }
  }

  private calculateMarketCap(price: number, totalSupply: string): number {
    return price * parseFloat(totalSupply || '0');
  }

  private async calculatePoolApr(pool: any): Promise<number> {
    try {
      // This would calculate APR based on pool fees and rewards
      // For now, return a placeholder calculation
      const apr = (parseFloat(pool.volumeUSD) * 0.0025 * 365) / parseFloat(pool.totalValueLockedUSD);
      return apr * 100; // Convert to percentage
    } catch (error) {
      logger.warn('Failed to calculate pool APR', { error: error.message });
      return 0;
    }
  }

  private async getTopTokensByVolume(limit: number): Promise<TokenAnalytics[]> {
    try {
      const topTokens = await this.subgraphClient.getTopTokensByVolume(limit);
      const analytics: TokenAnalytics[] = [];

      for (const token of topTokens) {
        const tokenAnalytics = await this.getTokenAnalytics(token.id);
        analytics.push(tokenAnalytics);
      }

      return analytics.sort((a, b) => b.volume24h - a.volume24h);
    } catch (error) {
      logger.error('Failed to get top tokens by volume', { error: error.message });
      return [];
    }
  }

  private async getTopPoolsByTvl(limit: number): Promise<PoolAnalytics[]> {
    try {
      const topPools = await this.subgraphClient.getTopPoolsByTvl(limit);
      const analytics: PoolAnalytics[] = [];

      for (const pool of topPools) {
        const poolAnalytics = await this.getPoolAnalytics(pool.id);
        analytics.push(poolAnalytics);
      }

      return analytics.sort((a, b) => b.tvl - a.tvl);
    } catch (error) {
      logger.error('Failed to get top pools by TVL', { error: error.message });
      return [];
    }
  }

  private async getTopFarmsByApr(limit: number): Promise<FarmAnalytics[]> {
    try {
      const topFarms = await this.yieldService.getTopFarmsByApr(limit);
      const analytics: FarmAnalytics[] = [];

      for (const farm of topFarms) {
        const farmAnalytics = await this.getFarmAnalytics(farm.address);
        analytics.push(farmAnalytics);
      }

      return analytics.sort((a, b) => b.apr - a.apr);
    } catch (error) {
      logger.error('Failed to get top farms by APR', { error: error.message });
      return [];
    }
  }

  private async getTrendingTokens(timeframe: string): Promise<TokenAnalytics[]> {
    try {
      // This would implement trending logic based on volume and price changes
      const tokens = await this.getTopTokensByVolume(50);

      return tokens
        .filter(token => Math.abs(token.priceChange24h) > 5) // At least 5% change
        .filter(token => token.volume24h > 10000) // Minimum volume
        .sort((a, b) => (b.volume24h * Math.abs(b.priceChange24h)) - (a.volume24h * Math.abs(a.priceChange24h)))
        .slice(0, 10);
    } catch (error) {
      logger.error('Failed to get trending tokens', { error: error.message });
      return [];
    }
  }

  private async getTrendingPools(timeframe: string): Promise<PoolAnalytics[]> {
    try {
      const pools = await this.getTopPoolsByTvl(50);

      return pools
        .filter(pool => pool.volume24h > 5000) // Minimum volume
        .sort((a, b) => b.volume24h - a.volume24h)
        .slice(0, 10);
    } catch (error) {
      logger.error('Failed to get trending pools', { error: error.message });
      return [];
    }
  }

  private async getTrendingFarms(timeframe: string): Promise<FarmAnalytics[]> {
    try {
      const farms = await this.getTopFarmsByApr(50);

      return farms
        .filter(farm => farm.apr > 10) // Minimum APR
        .filter(farm => farm.tvl > 1000) // Minimum TVL
        .sort((a, b) => (b.apr * b.tvl) - (a.apr * a.tvl))
        .slice(0, 10);
    } catch (error) {
      logger.error('Failed to get trending farms', { error: error.message });
      return [];
    }
  }

  private async searchTokenAnalytics(query: AnalyticsQuery): Promise<{
    tokens: TokenAnalytics[];
    total: number;
  }> {
    try {
      // This would implement token search logic
      const tokens = await this.getTopTokensByVolume(100);

      let filteredTokens = tokens;

      if (query.symbol) {
        filteredTokens = tokens.filter(token =>
          token.symbol.toLowerCase().includes(query.symbol!.toLowerCase())
        );
      }

      if (query.sortBy) {
        filteredTokens.sort((a, b) => {
          const aValue = a[query.sortBy as keyof TokenAnalytics];
          const bValue = b[query.sortBy as keyof TokenAnalytics];

          if (query.sortOrder === 'desc') {
            return (bValue as number) - (aValue as number);
          }
          return (aValue as number) - (bValue as number);
        });
      }

      const total = filteredTokens.length;
      const offset = query.offset || 0;
      const limit = query.limit || 20;

      return {
        tokens: filteredTokens.slice(offset, offset + limit),
        total
      };
    } catch (error) {
      logger.error('Failed to search token analytics', { error: error.message });
      return { tokens: [], total: 0 };
    }
  }

  private async searchPoolAnalytics(query: AnalyticsQuery): Promise<{
    pools: PoolAnalytics[];
    total: number;
  }> {
    try {
      const pools = await this.getTopPoolsByTvl(100);

      let filteredPools = pools;

      if (query.address) {
        filteredPools = pools.filter(pool =>
          pool.address.toLowerCase() === query.address!.toLowerCase()
        );
      }

      const total = filteredPools.length;
      const offset = query.offset || 0;
      const limit = query.limit || 20;

      return {
        pools: filteredPools.slice(offset, offset + limit),
        total
      };
    } catch (error) {
      logger.error('Failed to search pool analytics', { error: error.message });
      return { pools: [], total: 0 };
    }
  }

  private async searchFarmAnalytics(query: AnalyticsQuery): Promise<{
    farms: FarmAnalytics[];
    total: number;
  }> {
    try {
      const farms = await this.getTopFarmsByApr(100);

      let filteredFarms = farms;

      if (query.address) {
        filteredFarms = farms.filter(farm =>
          farm.address.toLowerCase() === query.address!.toLowerCase()
        );
      }

      const total = filteredFarms.length;
      const offset = query.offset || 0;
      const limit = query.limit || 20;

      return {
        farms: filteredFarms.slice(offset, offset + limit),
        total
      };
    } catch (error) {
      logger.error('Failed to search farm analytics', { error: error.message });
      return { farms: [], total: 0 };
    }
  }

  private async searchMarketAnalytics(query: AnalyticsQuery): Promise<{
    tokens: TokenAnalytics[];
    pools: PoolAnalytics[];
    farms: FarmAnalytics[];
    total: number;
  }> {
    try {
      const [tokens, pools, farms] = await Promise.all([
        this.searchTokenAnalytics({ ...query, type: 'token' }),
        this.searchPoolAnalytics({ ...query, type: 'pool' }),
        this.searchFarmAnalytics({ ...query, type: 'farm' })
      ]);

      return {
        tokens: tokens.tokens,
        pools: pools.pools,
        farms: farms.farms,
        total: tokens.total + pools.total + farms.total
      };
    } catch (error) {
      logger.error('Failed to search market analytics', { error: error.message });
      return { tokens: [], pools: [], farms: [], total: 0 };
    }
  }

  // Cache management
  async clearCache(): Promise<void> {
    try {
      this.cache = {
        tokenAnalytics: new Map(),
        poolAnalytics: new Map(),
        farmAnalytics: new Map(),
        marketOverview: null,
        trendingData: new Map(),
        priceHistory: new Map(),
        volumeHistory: new Map(),
        tvlHistory: new Map(),
        lastUpdated: 0
      };

      logger.info('Analytics cache cleared');
    } catch (error) {
      logger.error('Failed to clear analytics cache', { error: error.message });
      throw error;
    }
  }

  async refreshCache(): Promise<void> {
    try {
      await this.clearCache();

      // Pre-warm cache with common data
      await this.getMarketOverview();
      await this.getTrendingData('24h');

      logger.info('Analytics cache refreshed');
    } catch (error) {
      logger.error('Failed to refresh analytics cache', { error: error.message });
      throw error;
    }
  }
}

// Factory function
export function createBscAnalyticsService(
  tokenService: BscTokenService,
  tradingService: BscTradingService,
  liquidityService: BscLiquidityService,
  yieldService: BscYieldService,
  subgraphClient: PancakeSwapSubgraphClient,
  cacheService: ICache
): BscAnalyticsService {
  return new BscAnalyticsService(
    tokenService,
    tradingService,
    liquidityService,
    yieldService,
    subgraphClient,
    cacheService
  );
}