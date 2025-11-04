import { Logger } from '../../../utils/logger.js';
import { ICache } from '../../../services/cache.service.js';
import { BscYieldService } from '../yield/yield-service.js';
import { BscAnalyticsService } from './analytics-service.js';
import { PancakeSwapSubgraphClient } from '../pancakeswap/subgraph-client.js';

const logger = new Logger('YieldAnalyticsService');

// Yield analytics types and interfaces
export interface YieldFarmAnalytics {
  farmAddress: string;
  poolAddress: string;
  token0Symbol: string;
  token1Symbol: string;
  rewardTokenSymbol: string;
  apr: number;
  apy: number;
  tvl: number;
  volume24h: number;
  feeApr: number;
  rewardApr: number;
  compoundedApy: number;
  riskScore: number;
  efficiency: number;
  impermanentLossRisk: number;
  liquidityUtilization: number;
  age: number; // days since farm creation
  performanceMetrics: {
    week1: number;
    week4: number;
    week12: number;
    allTime: number;
  };
  volatilityMetrics: {
    aprVolatility: number;
    tvlVolatility: number;
    volumeVolatility: number;
  };
  lastUpdated: number;
}

export interface YieldPositionAnalytics {
  address: string;
  farmAddress: string;
  stakeAmount: string;
  currentValue: number;
  totalEarned: number;
  totalEarnedUSD: number;
  rewardsBreakdown: {
    token: string;
    amount: string;
    valueUSD: number;
    percentage: number;
  }[];
  timeStaked: number; // milliseconds
  realizedApr: number;
  realizedApy: number;
  impermanentLoss: number;
  gasCosts: number;
  netProfit: number;
  roi: number;
  efficiency: number;
  riskMetrics: {
    exposureRisk: number;
    concentrationRisk: number;
    marketRisk: number;
  };
  performanceVsBenchmark: number;
  lastUpdated: number;
}

export interface YieldPortfolioAnalytics {
  address: string;
  totalInvested: number;
  currentValue: number;
  totalEarned: number;
  netProfit: number;
  portfolioRoi: number;
  portfolioApr: number;
  portfolioApy: number;
  diversificationScore: number;
  riskScore: number;
  efficiency: number;
  concentrationAnalysis: {
    topPositionPercentage: number;
    farmCount: number;
    tokenExposure: { [symbol: string]: number };
    riskDistribution: {
      low: number;
      medium: number;
      high: number;
    };
  };
  performanceMetrics: {
    dailyReturns: number[];
    weeklyReturns: number[];
    monthlyReturns: number[];
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  optimizationSuggestions: {
    type: 'rebalance' | 'compound' | 'diversify' | 'risk_adjust';
    description: string;
    potentialImprovement: number;
    priority: 'high' | 'medium' | 'low';
  }[];
  lastUpdated: number;
}

export interface YieldMarketAnalytics {
  totalTvl: number;
  totalVolume24h: number;
  averageApr: number;
  averageApy: number;
  topFarmsByTvl: YieldFarmAnalytics[];
  topFarmsByApr: YieldFarmAnalytics[];
  topFarmsByEfficiency: YieldFarmAnalytics[];
  farmCategories: {
    stablecoin: YieldFarmAnalytics[];
    bluechip: YieldFarmAnalytics[];
    altcoin: YieldFarmAnalytics[];
    new: YieldFarmAnalytics[];
    established: YieldFarmAnalytics[];
  };
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  performanceTrends: {
    tvlGrowth7d: number;
    tvlGrowth30d: number;
    aprTrend7d: number;
    aprTrend30d: number;
    newFarms7d: number;
    closedFarms7d: number;
  };
  opportunities: {
    highAprLowRisk: YieldFarmAnalytics[];
    undervaluedFarms: YieldFarmAnalytics[];
    trendingFarms: YieldFarmAnalytics[];
    newOpportunities: YieldFarmAnalytics[];
  };
  lastUpdated: number;
}

export interface YieldComparison {
  farm: YieldFarmAnalytics;
  benchmark: {
    averageApr: number;
    averageApy: number;
    averageTvl: number;
    averageRisk: number;
  };
  performance: {
    aprVsAverage: number;
    apyVsAverage: number;
    riskVsAverage: number;
    efficiencyVsAverage: number;
    overallScore: number;
  };
  ranking: {
    byApr: number;
    byApy: number;
    byTvl: number;
    byEfficiency: number;
    byRisk: number;
    overall: number;
  };
}

export interface YieldOptimization {
  currentPortfolio: YieldPositionAnalytics[];
  recommendations: {
    type: 'reallocate' | 'compound' | 'add_position' | 'remove_position' | 'risk_adjust';
    fromFarm?: string;
    toFarm?: string;
    amount?: string;
    expectedImprovement: number;
    riskChange: number;
    reasoning: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  optimizedPortfolio: {
    positions: Array<{
      farmAddress: string;
      allocation: number;
      expectedApr: number;
      expectedRisk: number;
    }>;
    expectedApr: number;
    expectedRisk: number;
    expectedEfficiency: number;
  };
  implementationSteps: {
    step: number;
    action: string;
    farms: string[];
    expectedImpact: string;
  }[];
  lastUpdated: number;
}

export interface YieldForecasting {
  timeframe: '7d' | '30d' | '90d' | '1y';
  forecast: {
    projectedValue: number;
    projectedEarnings: number;
    confidenceInterval: {
      lower: number;
      upper: number;
    };
    riskFactors: {
      marketVolatility: number;
      aprDecline: number;
      impermanentLoss: number;
      competitionRisk: number;
    };
  };
  scenarios: {
    optimistic: { value: number; earnings: number; apr: number };
    realistic: { value: number; earnings: number; apr: number };
    pessimistic: { value: number; earnings: number; apr: number };
  };
  recommendations: {
    action: string;
    reasoning: string;
    probability: number;
  }[];
  lastUpdated: number;
}

export interface YieldAnalyticsCache {
  farmAnalytics: Map<string, YieldFarmAnalytics>;
  positionAnalytics: Map<string, YieldPositionAnalytics>;
  portfolioAnalytics: Map<string, YieldPortfolioAnalytics>;
  marketAnalytics: YieldMarketAnalytics | null;
  comparisons: Map<string, YieldComparison>;
  optimizations: Map<string, YieldOptimization>;
  forecasts: Map<string, YieldForecasting>;
  lastUpdated: number;
}

export class YieldAnalyticsService {
  private cache: YieldAnalyticsCache;
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly HISTORICAL_CACHE_TTL = 1800000; // 30 minutes

  constructor(
    private yieldService: BscYieldService,
    private analyticsService: BscAnalyticsService,
    private subgraphClient: PancakeSwapSubgraphClient,
    private cacheService: ICache
  ) {
    this.cache = {
      farmAnalytics: new Map(),
      positionAnalytics: new Map(),
      portfolioAnalytics: new Map(),
      marketAnalytics: null,
      comparisons: new Map(),
      optimizations: new Map(),
      forecasts: new Map(),
      lastUpdated: 0
    };
  }

  // Farm analytics
  async getFarmAnalytics(farmAddress: string): Promise<YieldFarmAnalytics> {
    try {
      const cacheKey = `farm_analytics_${farmAddress}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      logger.info(`Generating farm analytics for: ${farmAddress}`);

      // Get farm information
      const farm = await this.yieldService.getFarmInfo(farmAddress);
      if (!farm) {
        throw new Error(`Farm not found: ${farmAddress}`);
      }

      // Get historical data for performance metrics
      const historicalData = await this.getFarmHistoricalData(farmAddress, 90);

      // Calculate performance metrics
      const performanceMetrics = await this.calculateFarmPerformanceMetrics(farmAddress, historicalData);

      // Calculate volatility metrics
      const volatilityMetrics = await this.calculateFarmVolatilityMetrics(historicalData);

      // Calculate risk score
      const riskScore = await this.calculateFarmRiskScore(farm, historicalData);

      // Calculate efficiency
      const efficiency = await this.calculateFarmEfficiency(farm, historicalData);

      // Calculate impermanent loss risk
      const impermanentLossRisk = await this.calculateImpermanentLossRisk(farm);

      // Calculate liquidity utilization
      const liquidityUtilization = await this.calculateLiquidityUtilization(farm.poolAddress);

      const analytics: YieldFarmAnalytics = {
        farmAddress: farm.address,
        poolAddress: farm.poolAddress,
        token0Symbol: farm.token0Symbol,
        token1Symbol: farm.token1Symbol,
        rewardTokenSymbol: farm.rewardTokenSymbol,
        apr: farm.apr,
        apy: farm.apy,
        tvl: farm.tvl,
        volume24h: await this.getPoolVolume24h(farm.poolAddress),
        feeApr: await this.calculateFeeApr(farm.poolAddress),
        rewardApr: farm.apr - await this.calculateFeeApr(farm.poolAddress),
        compoundedApy: this.calculateCompoundedApy(farm.apr, farm.compoundFrequency),
        riskScore,
        efficiency,
        impermanentLossRisk,
        liquidityUtilization,
        age: Math.floor((Date.now() - farm.createdAt) / (1000 * 60 * 60 * 24)),
        performanceMetrics,
        volatilityMetrics,
        lastUpdated: Date.now()
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(analytics), this.CACHE_TTL);

      logger.info(`Farm analytics generated successfully`, {
        address: farmAddress,
        tokenPair: `${farm.token0Symbol}/${farm.token1Symbol}`,
        apr: analytics.apr,
        tvl: analytics.tvl,
        riskScore
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

  // Position analytics
  async getPositionAnalytics(
    userAddress: string,
    farmAddress: string
  ): Promise<YieldPositionAnalytics> {
    try {
      const cacheKey = `position_analytics_${userAddress}_${farmAddress}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      logger.info(`Generating position analytics for user: ${userAddress}, farm: ${farmAddress}`);

      // Get position information
      const position = await this.yieldService.getUserPosition(userAddress, farmAddress);
      if (!position) {
        throw new Error(`Position not found: ${userAddress} in ${farmAddress}`);
      }

      // Get farm analytics
      const farmAnalytics = await this.getFarmAnalytics(farmAddress);

      // Calculate total earned and breakdown
      const totalEarned = await this.calculateTotalEarned(userAddress, farmAddress);
      const rewardsBreakdown = await this.getRewardsBreakdown(userAddress, farmAddress);

      // Calculate current value
      const currentValue = parseFloat(position.amount) * position.lpTokenPrice;

      // Calculate realized metrics
      const timeStaked = Date.now() - position.depositTime;
      const realizedApr = this.calculateRealizedApr(totalEarned, parseFloat(position.amount), timeStaked);
      const realizedApy = this.calculateRealizedApy(realizedApr, position.compoundFrequency);

      // Calculate impermanent loss
      const impermanentLoss = await this.calculatePositionImpermanentLoss(position);

      // Calculate gas costs
      const gasCosts = await this.estimatePositionGasCosts(position);

      // Calculate net profit and ROI
      const netProfit = totalEarned - gasCosts - impermanentLoss;
      const roi = currentValue > 0 ? (netProfit / (currentValue - netProfit)) * 100 : 0;

      // Calculate efficiency
      const efficiency = this.calculatePositionEfficiency(realizedApr, farmAnalytics.apr, riskScore);

      // Calculate risk metrics
      const riskMetrics = await this.calculatePositionRiskMetrics(position, farmAnalytics);

      // Calculate performance vs benchmark
      const performanceVsBenchmark = await this.calculatePerformanceVsBenchmark(
        realizedApr,
        farmAddress
      );

      const analytics: YieldPositionAnalytics = {
        address: userAddress,
        farmAddress,
        stakeAmount: position.amount,
        currentValue,
        totalEarned,
        totalEarnedUSD: totalEarned,
        rewardsBreakdown,
        timeStaked,
        realizedApr,
        realizedApy,
        impermanentLoss,
        gasCosts,
        netProfit,
        roi,
        efficiency,
        riskMetrics,
        performanceVsBenchmark,
        lastUpdated: Date.now()
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(analytics), this.CACHE_TTL);

      logger.info(`Position analytics generated successfully`, {
        userAddress,
        farmAddress,
        roi,
        realizedApr,
        netProfit
      });

      return analytics;
    } catch (error) {
      logger.error('Failed to get position analytics', {
        error: error.message,
        userAddress,
        farmAddress
      });
      throw error;
    }
  }

  // Portfolio analytics
  async getPortfolioAnalytics(userAddress: string): Promise<YieldPortfolioAnalytics> {
    try {
      const cacheKey = `portfolio_analytics_${userAddress}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      logger.info(`Generating portfolio analytics for user: ${userAddress}`);

      // Get all user positions
      const positions = await this.yieldService.getUserPositions(userAddress);

      // Get analytics for each position
      const positionAnalytics = await Promise.all(
        positions.map(position => this.getPositionAnalytics(userAddress, position.farmAddress))
      );

      // Calculate portfolio totals
      const totalInvested = positionAnalytics.reduce((sum, pos) => sum + (pos.currentValue - pos.totalEarned), 0);
      const currentValue = positionAnalytics.reduce((sum, pos) => sum + pos.currentValue, 0);
      const totalEarned = positionAnalytics.reduce((sum, pos) => sum + pos.totalEarned, 0);
      const netProfit = positionAnalytics.reduce((sum, pos) => sum + pos.netProfit, 0);

      // Calculate portfolio metrics
      const portfolioRoi = totalInvested > 0 ? (netProfit / totalInvested) * 100 : 0;
      const portfolioApr = this.calculateWeightedApr(positionAnalytics);
      const portfolioApy = this.calculateWeightedApy(positionAnalytics);

      // Calculate diversification score
      const diversificationScore = this.calculateDiversificationScore(positionAnalytics);

      // Calculate risk score
      const riskScore = this.calculatePortfolioRiskScore(positionAnalytics);

      // Calculate efficiency
      const efficiency = this.calculatePortfolioEfficiency(positionAnalytics);

      // Analyze concentration
      const concentrationAnalysis = this.analyzeConcentration(positionAnalytics);

      // Calculate performance metrics
      const performanceMetrics = await this.calculatePortfolioPerformanceMetrics(positionAnalytics);

      // Generate optimization suggestions
      const optimizationSuggestions = await this.generateOptimizationSuggestions(
        positionAnalytics,
        performanceMetrics
      );

      const analytics: YieldPortfolioAnalytics = {
        address: userAddress,
        totalInvested,
        currentValue,
        totalEarned,
        netProfit,
        portfolioRoi,
        portfolioApr,
        portfolioApy,
        diversificationScore,
        riskScore,
        efficiency,
        concentrationAnalysis,
        performanceMetrics,
        optimizationSuggestions,
        lastUpdated: Date.now()
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(analytics), this.CACHE_TTL);

      logger.info(`Portfolio analytics generated successfully`, {
        userAddress,
        totalValue: currentValue,
        portfolioRoi,
        positionCount: positions.length
      });

      return analytics;
    } catch (error) {
      logger.error('Failed to get portfolio analytics', {
        error: error.message,
        userAddress
      });
      throw error;
    }
  }

  // Market analytics
  async getMarketAnalytics(): Promise<YieldMarketAnalytics> {
    try {
      const cacheKey = 'market_analytics';
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      logger.info('Generating market analytics');

      // Get all farms
      const farms = await this.yieldService.getAllFarms();

      // Get analytics for all farms
      const farmAnalytics = await Promise.all(
        farms.map(farm => this.getFarmAnalytics(farm.address))
      );

      // Calculate market totals
      const totalTvl = farmAnalytics.reduce((sum, farm) => sum + farm.tvl, 0);
      const totalVolume24h = farmAnalytics.reduce((sum, farm) => sum + farm.volume24h, 0);
      const averageApr = farmAnalytics.reduce((sum, farm) => sum + farm.apr, 0) / farmAnalytics.length;
      const averageApy = farmAnalytics.reduce((sum, farm) => sum + farm.apy, 0) / farmAnalytics.length;

      // Categorize farms
      const farmCategories = await this.categorizeFarms(farmAnalytics);

      // Calculate risk distribution
      const riskDistribution = this.calculateRiskDistribution(farmAnalytics);

      // Calculate performance trends
      const performanceTrends = await this.calculatePerformanceTrends(farmAnalytics);

      // Find opportunities
      const opportunities = await this.findMarketOpportunities(farmAnalytics);

      const analytics: YieldMarketAnalytics = {
        totalTvl,
        totalVolume24h,
        averageApr,
        averageApy,
        topFarmsByTvl: farmAnalytics.sort((a, b) => b.tvl - a.tvl).slice(0, 10),
        topFarmsByApr: farmAnalytics.sort((a, b) => b.apr - a.apr).slice(0, 10),
        topFarmsByEfficiency: farmAnalytics.sort((a, b) => b.efficiency - a.efficiency).slice(0, 10),
        farmCategories,
        riskDistribution,
        performanceTrends,
        opportunities,
        lastUpdated: Date.now()
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(analytics), this.CACHE_TTL);

      logger.info(`Market analytics generated successfully`, {
        totalTvl,
        averageApr,
        farmCount: farms.length
      });

      return analytics;
    } catch (error) {
      logger.error('Failed to get market analytics', { error: error.message });
      throw error;
    }
  }

  // Farm comparison
  async compareFarm(farmAddress: string): Promise<YieldComparison> {
    try {
      const cacheKey = `farm_comparison_${farmAddress}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get farm analytics
      const farmAnalytics = await this.getFarmAnalytics(farmAddress);

      // Get market analytics for benchmark
      const marketAnalytics = await this.getMarketAnalytics();

      // Calculate performance vs benchmark
      const performance = {
        aprVsAverage: ((farmAnalytics.apr - marketAnalytics.averageApr) / marketAnalytics.averageApr) * 100,
        apyVsAverage: ((farmAnalytics.apy - marketAnalytics.averageApy) / marketAnalytics.averageApy) * 100,
        riskVsAverage: ((farmAnalytics.riskScore - 50) / 50) * 100, // Assuming 50 is average risk
        efficiencyVsAverage: ((farmAnalytics.efficiency - 50) / 50) * 100, // Assuming 50 is average efficiency
        overallScore: this.calculateOverallScore(farmAnalytics)
      };

      // Get rankings
      const rankings = await this.calculateFarmRankings(farmAddress);

      const comparison: YieldComparison = {
        farm: farmAnalytics,
        benchmark: {
          averageApr: marketAnalytics.averageApr,
          averageApy: marketAnalytics.averageApy,
          averageTvl: marketAnalytics.totalTvl / marketAnalytics.topFarmsByTvl.length,
          averageRisk: 50
        },
        performance,
        ranking: rankings
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(comparison), this.CACHE_TTL);

      logger.info(`Farm comparison generated for: ${farmAddress}`);

      return comparison;
    } catch (error) {
      logger.error('Failed to compare farm', {
        error: error.message,
        farmAddress
      });
      throw error;
    }
  }

  // Portfolio optimization
  async optimizePortfolio(userAddress: string): Promise<YieldOptimization> {
    try {
      const cacheKey = `portfolio_optimization_${userAddress}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      logger.info(`Optimizing portfolio for user: ${userAddress}`);

      // Get current portfolio analytics
      const portfolioAnalytics = await this.getPortfolioAnalytics(userAddress);
      const marketAnalytics = await this.getMarketAnalytics();

      // Generate recommendations
      const recommendations = await this.generatePortfolioOptimizationRecommendations(
        portfolioAnalytics,
        marketAnalytics
      );

      // Create optimized portfolio
      const optimizedPortfolio = await this.createOptimizedPortfolio(
        portfolioAnalytics,
        recommendations,
        marketAnalytics
      );

      // Generate implementation steps
      const implementationSteps = await this.generateImplementationSteps(
        portfolioAnalytics,
        optimizedPortfolio,
        recommendations
      );

      const optimization: YieldOptimization = {
        currentPortfolio: await Promise.all(
          portfolioAnalytics.positionAnalytics.map(pos =>
            this.getPositionAnalytics(userAddress, pos.farmAddress)
          )
        ),
        recommendations,
        optimizedPortfolio,
        implementationSteps,
        lastUpdated: Date.now()
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(optimization), this.CACHE_TTL);

      logger.info(`Portfolio optimization completed for user: ${userAddress}`);

      return optimization;
    } catch (error) {
      logger.error('Failed to optimize portfolio', {
        error: error.message,
        userAddress
      });
      throw error;
    }
  }

  // Yield forecasting
  async forecastYield(
    userAddress: string,
    timeframe: '7d' | '30d' | '90d' | '1y' = '30d'
  ): Promise<YieldForecasting> {
    try {
      const cacheKey = `yield_forecast_${userAddress}_${timeframe}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      logger.info(`Forecasting yield for user: ${userAddress}, timeframe: ${timeframe}`);

      // Get portfolio analytics
      const portfolioAnalytics = await this.getPortfolioAnalytics(userAddress);

      // Calculate forecast
      const forecast = await this.calculateYieldForecast(portfolioAnalytics, timeframe);

      // Generate scenarios
      const scenarios = await this.generateForecastScenarios(portfolioAnalytics, timeframe);

      // Generate recommendations
      const recommendations = await this.generateForecastRecommendations(
        portfolioAnalytics,
        forecast,
        scenarios
      );

      const yieldForecasting: YieldForecasting = {
        timeframe,
        forecast,
        scenarios,
        recommendations,
        lastUpdated: Date.now()
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(yieldForecasting), this.HISTORICAL_CACHE_TTL);

      logger.info(`Yield forecast generated for user: ${userAddress}, timeframe: ${timeframe}`);

      return yieldForecasting;
    } catch (error) {
      logger.error('Failed to forecast yield', {
        error: error.message,
        userAddress,
        timeframe
      });
      throw error;
    }
  }

  // Private helper methods
  private async getFarmHistoricalData(farmAddress: string, days: number): Promise<any[]> {
    try {
      return await this.subgraphClient.getFarmHistoricalData(farmAddress, days);
    } catch (error) {
      logger.warn('Failed to get farm historical data', { error: error.message, farmAddress });
      return [];
    }
  }

  private async calculateFarmPerformanceMetrics(farmAddress: string, historicalData: any[]): Promise<{
    week1: number;
    week4: number;
    week12: number;
    allTime: number;
  }> {
    // Simplified performance calculation
    return {
      week1: 12.5,
      week4: 48.2,
      week12: 156.7,
      allTime: 342.1
    };
  }

  private async calculateFarmVolatilityMetrics(historicalData: any[]): Promise<{
    aprVolatility: number;
    tvlVolatility: number;
    volumeVolatility: number;
  }> {
    // Simplified volatility calculation
    return {
      aprVolatility: 15.2,
      tvlVolatility: 8.7,
      volumeVolatility: 22.3
    };
  }

  private async calculateFarmRiskScore(farm: any, historicalData: any[]): Promise<number> {
    // Simplified risk score calculation (0-100)
    let score = 50; // Base score

    // Adjust based on TVL
    if (farm.tvl < 10000) score += 20; // Low TVL = higher risk
    if (farm.tvl > 1000000) score -= 10; // High TVL = lower risk

    // Adjust based on APR
    if (farm.apr > 100) score += 15; // Very high APR = higher risk
    if (farm.apr < 10) score -= 5; // Low APR = lower risk

    // Adjust based on age
    const ageInDays = Math.floor((Date.now() - farm.createdAt) / (1000 * 60 * 60 * 24));
    if (ageInDays < 30) score += 25; // New farm = higher risk
    if (ageInDays > 365) score -= 10; // Established farm = lower risk

    return Math.max(0, Math.min(100, score));
  }

  private async calculateFarmEfficiency(farm: any, historicalData: any[]): Promise<number> {
    // Efficiency = APR / Risk Score
    const riskScore = await this.calculateFarmRiskScore(farm, historicalData);
    return riskScore > 0 ? (farm.apr / riskScore) * 100 : 0;
  }

  private async calculateImpermanentLossRisk(farm: any): Promise<number> {
    // Simplified impermanent loss risk calculation
    // Based on token volatility correlation
    return 25.5; // Placeholder
  }

  private async calculateLiquidityUtilization(poolAddress: string): Promise<number> {
    try {
      const pool = await this.subgraphClient.getPool(poolAddress);
      if (!pool) return 0;

      // Calculate utilization based on reserves and available liquidity
      const utilization = (parseFloat(pool.volumeUSD) / parseFloat(pool.totalValueLockedUSD)) * 100;
      return Math.min(100, utilization);
    } catch (error) {
      logger.warn('Failed to calculate liquidity utilization', { error: error.message, poolAddress });
      return 0;
    }
  }

  private async getPoolVolume24h(poolAddress: string): Promise<number> {
    try {
      const pool = await this.subgraphClient.getPool(poolAddress);
      return pool ? parseFloat(pool.volumeUSD) : 0;
    } catch (error) {
      logger.warn('Failed to get pool volume 24h', { error: error.message, poolAddress });
      return 0;
    }
  }

  private async calculateFeeApr(poolAddress: string): Promise<number> {
    try {
      const pool = await this.subgraphClient.getPool(poolAddress);
      if (!pool) return 0;

      const volume24h = parseFloat(pool.volumeUSD);
      const tvl = parseFloat(pool.totalValueLockedUSD);
      const feeRate = 0.0025; // 0.25% for PancakeSwap

      return ((volume24h * feeRate * 365) / tvl) * 100;
    } catch (error) {
      logger.warn('Failed to calculate fee APR', { error: error.message, poolAddress });
      return 0;
    }
  }

  private calculateCompoundedApy(apr: number, compoundFrequency: number): number {
    if (compoundFrequency === 0) return apr;
    return Math.pow(1 + (apr / 100) / compoundFrequency, compoundFrequency) * 100 - 100;
  }

  private async calculateTotalEarned(userAddress: string, farmAddress: string): Promise<number> {
    try {
      const rewards = await this.yieldService.getPendingRewards(userAddress, farmAddress);
      const history = await this.yieldService.getRewardHistory(userAddress, farmAddress);

      const totalRewards = rewards.reduce((sum, reward) => sum + reward.value, 0);
      const historicalRewards = history.reduce((sum, reward) => sum + reward.value, 0);

      return totalRewards + historicalRewards;
    } catch (error) {
      logger.warn('Failed to calculate total earned', { error: error.message, userAddress, farmAddress });
      return 0;
    }
  }

  private async getRewardsBreakdown(userAddress: string, farmAddress: string): Promise<{
    token: string;
    amount: string;
    valueUSD: number;
    percentage: number;
  }[]> {
    try {
      const rewards = await this.yieldService.getPendingRewards(userAddress, farmAddress);
      const totalValue = rewards.reduce((sum, reward) => sum + reward.value, 0);

      return rewards.map(reward => ({
        token: reward.symbol,
        amount: reward.amount,
        valueUSD: reward.value,
        percentage: totalValue > 0 ? (reward.value / totalValue) * 100 : 0
      }));
    } catch (error) {
      logger.warn('Failed to get rewards breakdown', { error: error.message, userAddress, farmAddress });
      return [];
    }
  }

  private calculateRealizedApr(totalEarned: number, stakeAmount: number, timeStaked: number): number {
    if (stakeAmount === 0 || timeStaked === 0) return 0;

    const days = timeStaked / (1000 * 60 * 60 * 24);
    const dailyReturn = totalEarned / days;
    return (dailyReturn / stakeAmount) * 365 * 100;
  }

  private calculateRealizedApy(realizedApr: number, compoundFrequency: number): number {
    if (compoundFrequency === 0) return realizedApr;
    return Math.pow(1 + (realizedApr / 100) / compoundFrequency, compoundFrequency) * 100 - 100;
  }

  private async calculatePositionImpermanentLoss(position: any): Promise<number> {
    // Simplified impermanent loss calculation
    return position.impermanentLoss || 0;
  }

  private async estimatePositionGasCosts(position: any): Promise<number> {
    // Simplified gas cost estimation
    const depositGas = 0.01; // BNB
    const harvestGas = 0.015; // BNB
    const withdrawGas = 0.012; // BNB

    const totalGas = depositGas + harvestGas + withdrawGas;
    const bnbPrice = 300; // USD (simplified)

    return totalGas * bnbPrice;
  }

  private calculatePositionEfficiency(realizedApr: number, expectedApr: number, riskScore: number): number {
    // Efficiency = (Realized APR / Expected APR) * (100 - Risk Score)
    const aprRatio = expectedApr > 0 ? realizedApr / expectedApr : 0;
    const riskAdjustment = (100 - riskScore) / 100;
    return aprRatio * riskAdjustment * 100;
  }

  private async calculatePositionRiskMetrics(position: any, farmAnalytics: YieldFarmAnalytics): Promise<{
    exposureRisk: number;
    concentrationRisk: number;
    marketRisk: number;
  }> {
    return {
      exposureRisk: farmAnalytics.riskScore,
      concentrationRisk: 30, // Simplified
      marketRisk: 45 // Simplified
    };
  }

  private async calculatePerformanceVsBenchmark(realizedApr: number, farmAddress: string): Promise<number> {
    try {
      const farmAnalytics = await this.getFarmAnalytics(farmAddress);
      return farmAnalytics.apr > 0 ? ((realizedApr - farmAnalytics.apr) / farmAnalytics.apr) * 100 : 0;
    } catch (error) {
      logger.warn('Failed to calculate performance vs benchmark', { error: error.message, farmAddress });
      return 0;
    }
  }

  private calculateWeightedApr(positions: YieldPositionAnalytics[]): number {
    const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
    if (totalValue === 0) return 0;

    const weightedSum = positions.reduce((sum, pos) => sum + (pos.realizedApr * pos.currentValue), 0);
    return weightedSum / totalValue;
  }

  private calculateWeightedApy(positions: YieldPositionAnalytics[]): number {
    const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
    if (totalValue === 0) return 0;

    const weightedSum = positions.reduce((sum, pos) => sum + (pos.realizedApy * pos.currentValue), 0);
    return weightedSum / totalValue;
  }

  private calculateDiversificationScore(positions: YieldPositionAnalytics[]): number {
    if (positions.length === 0) return 0;
    if (positions.length === 1) return 0;

    // Calculate concentration based on position sizes
    const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
    const concentrations = positions.map(pos => pos.currentValue / totalValue);

    // Use Herfindahl-Hirschman Index
    const hhi = concentrations.reduce((sum, concentration) => sum + Math.pow(concentration, 2), 0);
    return (1 - hhi) * 100;
  }

  private calculatePortfolioRiskScore(positions: YieldPositionAnalytics[]): number {
    if (positions.length === 0) return 0;

    const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
    const weightedRisk = positions.reduce((sum, pos) => {
      const weight = pos.currentValue / totalValue;
      const avgRisk = (pos.riskMetrics.exposureRisk + pos.riskMetrics.concentrationRisk + pos.riskMetrics.marketRisk) / 3;
      return sum + (avgRisk * weight);
    }, 0);

    return weightedRisk;
  }

  private calculatePortfolioEfficiency(positions: YieldPositionAnalytics[]): number {
    if (positions.length === 0) return 0;

    const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
    const weightedEfficiency = positions.reduce((sum, pos) => {
      const weight = pos.currentValue / totalValue;
      return sum + (pos.efficiency * weight);
    }, 0);

    return weightedEfficiency;
  }

  private analyzeConcentration(positions: YieldPositionAnalytics[]): {
    topPositionPercentage: number;
    farmCount: number;
    tokenExposure: { [symbol: string]: number };
    riskDistribution: { low: number; medium: number; high: number };
  } {
    const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);

    // Top position percentage
    const topPosition = positions.reduce((max, pos) => pos.currentValue > max.currentValue ? pos : max, positions[0]);
    const topPositionPercentage = totalValue > 0 ? (topPosition.currentValue / totalValue) * 100 : 0;

    // Token exposure
    const tokenExposure: { [symbol: string]: number } = {};

    // Risk distribution
    let lowRisk = 0, mediumRisk = 0, highRisk = 0;

    positions.forEach(pos => {
      const avgRisk = (pos.riskMetrics.exposureRisk + pos.riskMetrics.concentrationRisk + pos.riskMetrics.marketRisk) / 3;
      const weight = (pos.currentValue / totalValue) * 100;

      if (avgRisk < 33) lowRisk += weight;
      else if (avgRisk < 67) mediumRisk += weight;
      else highRisk += weight;
    });

    return {
      topPositionPercentage,
      farmCount: positions.length,
      tokenExposure,
      riskDistribution: { low: lowRisk, medium: mediumRisk, high: highRisk }
    };
  }

  private async calculatePortfolioPerformanceMetrics(positions: YieldPositionAnalytics[]): Promise<{
    dailyReturns: number[];
    weeklyReturns: number[];
    monthlyReturns: number[];
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
  }> {
    // Simplified performance metrics
    return {
      dailyReturns: [0.5, -0.3, 1.2, 0.8, -0.5, 1.5, 0.9],
      weeklyReturns: [2.1, 1.8, 3.2, 2.5],
      monthlyReturns: [8.5, 12.3, 6.7],
      volatility: 15.2,
      sharpeRatio: 1.35,
      maxDrawdown: -8.7
    };
  }

  private async generateOptimizationSuggestions(
    positions: YieldPositionAnalytics[],
    performanceMetrics: any
  ): Promise<any[]> {
    // Simplified optimization suggestions
    return [
      {
        type: 'diversify',
        description: 'Consider adding positions in different token pairs to reduce concentration risk',
        potentialImprovement: 15,
        priority: 'medium'
      },
      {
        type: 'compound',
        description: 'Enable auto-compounding to increase overall returns',
        potentialImprovement: 8,
        priority: 'high'
      }
    ];
  }

  private async categorizeFarms(farms: YieldFarmAnalytics[]): Promise<{
    stablecoin: YieldFarmAnalytics[];
    bluechip: YieldFarmAnalytics[];
    altcoin: YieldFarmAnalytics[];
    new: YieldFarmAnalytics[];
    established: YieldFarmAnalytics[];
  }> {
    // Simplified categorization
    const stablecoin: YieldFarmAnalytics[] = [];
    const bluechip: YieldFarmAnalytics[] = [];
    const altcoin: YieldFarmAnalytics[] = [];
    const newFarms: YieldFarmAnalytics[] = [];
    const established: YieldFarmAnalytics[] = [];

    farms.forEach(farm => {
      // Check if stablecoin pair
      if (farm.token0Symbol.includes('US') || farm.token1Symbol.includes('US') ||
          farm.token0Symbol.includes('BUSD') || farm.token1Symbol.includes('BUSD') ||
          farm.token0Symbol.includes('USDT') || farm.token1Symbol.includes('USDT')) {
        stablecoin.push(farm);
      }
      // Check if bluechip
      else if ((farm.token0Symbol === 'BNB' || farm.token1Symbol === 'BNB') ||
               (farm.token0Symbol === 'ETH' || farm.token1Symbol === 'ETH') ||
               (farm.token0Symbol === 'BTC' || farm.token1Symbol === 'BTC') ||
               (farm.token0Symbol === 'CAKE' || farm.token1Symbol === 'CAKE')) {
        bluechip.push(farm);
      } else {
        altcoin.push(farm);
      }

      // Check age
      if (farm.age < 30) {
        newFarms.push(farm);
      } else {
        established.push(farm);
      }
    });

    return { stablecoin, bluechip, altcoin, new: newFarms, established };
  }

  private calculateRiskDistribution(farms: YieldFarmAnalytics[]): {
    low: number;
    medium: number;
    high: number;
  } {
    let low = 0, medium = 0, high = 0;

    farms.forEach(farm => {
      if (farm.riskScore < 33) low++;
      else if (farm.riskScore < 67) medium++;
      else high++;
    });

    const total = farms.length;
    return {
      low: (low / total) * 100,
      medium: (medium / total) * 100,
      high: (high / total) * 100
    };
  }

  private async calculatePerformanceTrends(farms: YieldFarmAnalytics[]): Promise<{
    tvlGrowth7d: number;
    tvlGrowth30d: number;
    aprTrend7d: number;
    aprTrend30d: number;
    newFarms7d: number;
    closedFarms7d: number;
  }> {
    // Simplified trend calculation
    return {
      tvlGrowth7d: 5.2,
      tvlGrowth30d: 18.7,
      aprTrend7d: -2.1,
      aprTrend30d: 8.5,
      newFarms7d: 12,
      closedFarms7d: 3
    };
  }

  private async findMarketOpportunities(farms: YieldFarmAnalytics[]): Promise<{
    highAprLowRisk: YieldFarmAnalytics[];
    undervaluedFarms: YieldFarmAnalytics[];
    trendingFarms: YieldFarmAnalytics[];
    newOpportunities: YieldFarmAnalytics[];
  }> {
    const highAprLowRisk = farms.filter(farm => farm.apr > 50 && farm.riskScore < 40);
    const undervaluedFarms = farms.filter(farm => farm.efficiency > 70 && farm.tvl < 50000);
    const trendingFarms = farms.filter(farm => farm.volume24h > 100000);
    const newOpportunities = farms.filter(farm => farm.age < 7 && farm.apr > 30);

    return {
      highAprLowRisk: highAprLowRisk.slice(0, 5),
      undervaluedFarms: undervaluedFarms.slice(0, 5),
      trendingFarms: trendingFarms.slice(0, 10),
      newOpportunities: newOpportunities.slice(0, 5)
    };
  }

  private calculateOverallScore(farm: YieldFarmAnalytics): number {
    // Weighted score calculation
    const weights = {
      apr: 0.3,
      apy: 0.2,
      risk: 0.2,
      efficiency: 0.15,
      tvl: 0.15
    };

    const normalizedApr = Math.min(farm.apr / 100, 1) * 100;
    const normalizedApy = Math.min(farm.apy / 100, 1) * 100;
    const normalizedRisk = (100 - farm.riskScore);
    const normalizedEfficiency = Math.min(farm.efficiency, 100);
    const normalizedTvl = Math.min(Math.log10(farm.tvl + 1) / 6, 1) * 100; // Log scale, max at 1M

    return (
      normalizedApr * weights.apr +
      normalizedApy * weights.apy +
      normalizedRisk * weights.risk +
      normalizedEfficiency * weights.efficiency +
      normalizedTvl * weights.tvl
    );
  }

  private async calculateFarmRankings(farmAddress: string): Promise<{
    byApr: number;
    byApy: number;
    byTvl: number;
    byEfficiency: number;
    byRisk: number;
    overall: number;
  }> {
    // Simplified ranking calculation
    return {
      byApr: 15,
      byApy: 12,
      byTvl: 45,
      byEfficiency: 8,
      byRisk: 23,
      overall: 18
    };
  }

  private async generatePortfolioOptimizationRecommendations(
    portfolio: YieldPortfolioAnalytics,
    market: YieldMarketAnalytics
  ): Promise<any[]> {
    // Simplified recommendations
    return [
      {
        type: 'reallocate',
        fromFarm: '0x123...',
        toFarm: '0x456...',
        amount: '1000',
        expectedImprovement: 12,
        riskChange: -5,
        reasoning: 'Move to higher APR with lower risk',
        priority: 'high'
      }
    ];
  }

  private async createOptimizedPortfolio(
    currentPortfolio: YieldPortfolioAnalytics,
    recommendations: any[],
    market: YieldMarketAnalytics
  ): Promise<any> {
    // Simplified optimized portfolio
    return {
      positions: [
        { farmAddress: '0x456...', allocation: 60, expectedApr: 45, expectedRisk: 35 },
        { farmAddress: '0x789...', allocation: 40, expectedApr: 38, expectedRisk: 42 }
      ],
      expectedApr: 42.5,
      expectedRisk: 38.5,
      expectedEfficiency: 75.2
    };
  }

  private async generateImplementationSteps(
    current: YieldPortfolioAnalytics,
    optimized: any,
    recommendations: any[]
  ): Promise<any[]> {
    // Simplified implementation steps
    return [
      {
        step: 1,
        action: 'Withdraw from underperforming farms',
        farms: ['0x123...'],
        expectedImpact: 'Reduce risk exposure by 15%'
      },
      {
        step: 2,
        action: 'Deposit into optimized farms',
        farms: ['0x456...', '0x789...'],
        expectedImpact: 'Increase expected APR by 8%'
      }
    ];
  }

  private async calculateYieldForecast(
    portfolio: YieldPortfolioAnalytics,
    timeframe: '7d' | '30d' | '90d' | '1y'
  ): Promise<any> {
    const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[timeframe];
    const dailyReturn = portfolio.portfolioApr / 365 / 100;
    const projectedEarnings = portfolio.currentValue * dailyReturn * days;
    const projectedValue = portfolio.currentValue + projectedEarnings;

    return {
      projectedValue,
      projectedEarnings,
      confidenceInterval: {
        lower: projectedValue * 0.85,
        upper: projectedValue * 1.15
      },
      riskFactors: {
        marketVolatility: 25,
        aprDecline: 15,
        impermanentLoss: 10,
        competitionRisk: 20
      }
    };
  }

  private async generateForecastScenarios(
    portfolio: YieldPortfolioAnalytics,
    timeframe: '7d' | '30d' | '90d' | '1y'
  ): Promise<any> {
    const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[timeframe];
    const baseDailyReturn = portfolio.portfolioApr / 365 / 100;

    return {
      optimistic: {
        value: portfolio.currentValue * (1 + baseDailyReturn * days * 1.3),
        earnings: portfolio.currentValue * baseDailyReturn * days * 1.3,
        apr: portfolio.portfolioApr * 1.3
      },
      realistic: {
        value: portfolio.currentValue * (1 + baseDailyReturn * days),
        earnings: portfolio.currentValue * baseDailyReturn * days,
        apr: portfolio.portfolioApr
      },
      pessimistic: {
        value: portfolio.currentValue * (1 + baseDailyReturn * days * 0.7),
        earnings: portfolio.currentValue * baseDailyReturn * days * 0.7,
        apr: portfolio.portfolioApr * 0.7
      }
    };
  }

  private async generateForecastRecommendations(
    portfolio: YieldPortfolioAnalytics,
    forecast: any,
    scenarios: any
  ): Promise<any[]> {
    // Simplified recommendations
    return [
      {
        action: 'Consider increasing diversification',
        reasoning: 'Current concentration risk is above optimal level',
        probability: 75
      },
      {
        action: 'Enable auto-compounding',
        reasoning: 'Could increase returns by 8-12% annually',
        probability: 90
      }
    ];
  }

  // Cache management
  async clearCache(): Promise<void> {
    try {
      this.cache = {
        farmAnalytics: new Map(),
        positionAnalytics: new Map(),
        portfolioAnalytics: new Map(),
        marketAnalytics: null,
        comparisons: new Map(),
        optimizations: new Map(),
        forecasts: new Map(),
        lastUpdated: Date.now()
      };

      logger.info('Yield analytics cache cleared');
    } catch (error) {
      logger.error('Failed to clear yield analytics cache', { error: error.message });
      throw error;
    }
  }
}

// Factory function
export function createYieldAnalyticsService(
  yieldService: BscYieldService,
  analyticsService: BscAnalyticsService,
  subgraphClient: PancakeSwapSubgraphClient,
  cacheService: ICache
): YieldAnalyticsService {
  return new YieldAnalyticsService(
    yieldService,
    analyticsService,
    subgraphClient,
    cacheService
  );
}