/**
 * Farm Discovery and APY Calculation Service
 * Handles discovery of new farms and accurate APY calculations
 */

import logger from '../../../utils/logger.js';
import type {
  YieldFarm,
  FarmCategory,
  YieldConfig,
  YieldError,
  YieldErrorCode,
  FarmPerformance,
  TokenInfo
} from './types.js';
import { BSCCacheManager } from '../cache/cache-manager.js';
import { FarmIntegration, farmIntegration } from './farm-integration.js';
import { BSCProviderManager } from '../../utils/ethers-provider.js';

/**
 * Farm Discovery Service Interface
 */
export interface IFarmDiscoveryService {
  // Farm discovery
  discoverNewFarms(): Promise<YieldFarm[]>;
  discoverTrendingFarms(): Promise<YieldFarm[]>;
  discoverHighAPRFarms(): Promise<YieldFarm[]>;
  discoverStableFarms(): Promise<YieldFarm[]>;

  // APY calculation
  calculateAPY(farm: YieldFarm): Promise<number>;
  calculateRealAPY(farm: YieldFarm, userAddress?: string): Promise<number>;
  calculateRiskAdjustedAPY(farm: YieldFarm): Promise<number>;

  // Farm analysis
  analyzeFarmPotential(farm: YieldFarm): Promise<FarmAnalysis>;
  compareFarms(farms: YieldFarm[]): Promise<FarmComparison>;
  getFarmRecommendations(userProfile: UserProfile): Promise<YieldFarm[]>;

  // Market analysis
  getMarketOverview(): Promise<YieldMarketOverview>;
  getAPYTrends(period: string): Promise<APYTrend[]>;
  getYieldOpportunities(): Promise<YieldOpportunity[]>;

  // Risk assessment
  assessFarmRisk(farm: YieldFarm): Promise<RiskAssessment>;
  calculateRiskMetrics(farm: YieldFarm): Promise<RiskMetrics>;
}

export interface FarmAnalysis {
  farm: YieldFarm;
  potential: PotentialScore;
  risks: string[];
  opportunities: string[];
  recommendations: string[];
  expectedReturn: ExpectedReturn;
  timeHorizon: TimeHorizon;
}

export interface FarmComparison {
  farms: YieldFarm[];
  metrics: ComparisonMetrics;
  ranking: FarmRanking[];
  bestFor: { [key: string]: YieldFarm };
  summary: ComparisonSummary;
}

export interface UserProfile {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  investmentHorizon: number; // days
  preferredCategories: FarmCategory[];
  minAPR: number;
  maxRisk: number;
  liquidityPreference: 'high' | 'medium' | 'low';
}

export interface YieldMarketOverview {
  totalFarms: number;
  activeFarms: number;
  averageAPR: number;
  averageAPY: number;
  totalTVL: number;
  topCategories: CategoryStats[];
  trendingFarms: YieldFarm[];
  newFarms: YieldFarm[];
  riskDistribution: RiskDistribution;
  performanceMetrics: MarketPerformance;
}

export interface APYTrend {
  category: FarmCategory;
  apr: number;
  apy: number;
  change24h: number;
  change7d: number;
  change30d: number;
  prediction7d: number;
  prediction30d: number;
}

export interface YieldOpportunity {
  farm: YieldFarm;
  opportunityType: OpportunityType;
  expectedAPY: number;
  riskLevel: string;
  timeWindow: number;
  description: string;
  confidence: number;
}

export interface RiskAssessment {
  overallRisk: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  riskFactors: RiskFactor[];
  mitigationStrategies: string[];
  riskScore: number;
  worstCaseScenario: WorstCaseScenario;
}

export interface RiskMetrics {
  volatility: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  beta: number;
  alpha: number;
  valueAtRisk: number;
  expectedShortfall: number;
}

// Additional interfaces for comprehensive types
export interface PotentialScore {
  overall: number;
  growth: number;
  stability: number;
  profitability: number;
  sustainability: number;
}

export interface ExpectedReturn {
  daily: number;
  weekly: number;
  monthly: number;
  annual: number;
  riskAdjusted: number;
  afterFees: number;
}

export interface TimeHorizon {
  short: number; // 1-7 days
  medium: number; // 1-4 weeks
  long: number; // 1+ months
  optimal: string;
}

export interface ComparisonMetrics {
  avgAPR: number;
  avgAPY: number;
  avgTVL: number;
  avgRisk: number;
  volatility: number;
  concentration: number;
}

export interface FarmRanking {
  farm: YieldFarm;
  rank: number;
  score: number;
  strengths: string[];
  weaknesses: string[];
}

export interface ComparisonSummary {
  bestAPR: YieldFarm;
  bestAPY: YieldFarm;
  lowestRisk: YieldFarm;
  highestTVL: YieldFarm;
  mostStable: YieldFarm;
  recommendation: YieldFarm;
}

export interface CategoryStats {
  category: FarmCategory;
  count: number;
  avgAPR: number;
  avgTVL: number;
  trend: 'up' | 'down' | 'stable';
}

export interface RiskDistribution {
  veryLow: number;
  low: number;
  medium: number;
  high: number;
  veryHigh: number;
}

export interface MarketPerformance {
  totalReturns7d: number;
  totalReturns30d: number;
  volatility7d: number;
  volatility30d: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export enum OpportunityType {
  HIGH_APR = 'high_apr',
  NEW_FARM = 'new_farm',
  TRENDING = 'trending',
  STABLE_YIELD = 'stable_yield',
  FLASH_POOL = 'flash_pool',
  SPECIAL_EVENT = 'special_event'
}

export interface RiskFactor {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  probability: number;
}

export interface WorstCaseScenario {
  description: string;
  probability: number;
  potentialLoss: number;
  timeframe: string;
}

/**
 * Farm Discovery Service Implementation
 */
export class FarmDiscoveryService implements IFarmDiscoveryService {
  private cache: BSCCacheManager;
  private farmIntegration: FarmIntegration;
  private provider: BSCProviderManager;
  private config: YieldConfig;

  constructor(config?: Partial<YieldConfig>) {
    this.cache = new BSCCacheManager();
    this.farmIntegration = farmIntegration;
    this.provider = new BSCProviderManager();

    // Default configuration
    this.config = {
      cacheFarmData: true,
      farmDataCacheTTL: 300000, // 5 minutes
      enableAnalytics: true,
      minFarmAge: 100,
      maxFarmAge: 0,
      requireVerification: true,
      ...config
    };
  }

  /**
   * Discover new farms
   */
  async discoverNewFarms(): Promise<YieldFarm[]> {
    logger.debug('Discovering new farms');

    try {
      // Check cache first
      const cacheKey = 'new_farms';
      if (this.config.cacheFarmData) {
        const cached = await this.cache.get<YieldFarm[]>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get all farms
      const allFarms = await this.farmIntegration.getFarms();

      // Filter for new farms (created in last 7 days)
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const newFarms = allFarms.filter(farm => farm.createdAt > sevenDaysAgo);

      // Additional filtering criteria
      const filteredNewFarms = newFarms.filter(farm => {
        // Minimum TVL requirement
        if (farm.tvl < 50000) return false;

        // Maximum APR filter (avoid unrealistic APRs)
        if (farm.apr > 500) return false;

        // Verification requirement
        if (this.config.requireVerification && !this.isVerifiedFarm(farm)) return false;

        return true;
      });

      // Sort by creation time (newest first)
      filteredNewFarms.sort((a, b) => b.createdAt - a.createdAt);

      // Cache result
      if (this.config.cacheFarmData) {
        await this.cache.set(cacheKey, filteredNewFarms, this.config.farmDataCacheTTL);
      }

      logger.info({
        totalFarms: allFarms.length,
        newFarms: newFarms.length,
        filteredFarms: filteredNewFarms.length
      }, 'New farms discovered');

      return filteredNewFarms;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to discover new farms');

      return [];
    }
  }

  /**
   * Discover trending farms
   */
  async discoverTrendingFarms(): Promise<YieldFarm[]> {
    logger.debug('Discovering trending farms');

    try {
      // Check cache first
      const cacheKey = 'trending_farms';
      if (this.config.cacheFarmData) {
        const cached = await this.cache.get<YieldFarm[]>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get all farms
      const allFarms = await this.farmIntegration.getFarms();

      // Analyze trends (simplified - would use real metrics)
      const farmTrends = await Promise.all(
        allFarms.map(async farm => ({
          farm,
          trendScore: await this.calculateTrendScore(farm)
        }))
      );

      // Sort by trend score
      farmTrends.sort((a, b) => b.trendScore - a.trendScore);

      // Get top trending farms
      const trendingFarms = farmTrends
        .slice(0, 20)
        .map(item => item.farm)
        .filter(farm => {
          // Filter out very low TVL farms
          return farm.tvl > 10000;
        });

      // Cache result
      if (this.config.cacheFarmData) {
        await this.cache.set(cacheKey, trendingFarms, this.config.farmDataCacheTTL);
      }

      logger.info({
        totalFarms: allFarms.length,
        trendingFarms: trendingFarms.length
      }, 'Trending farms discovered');

      return trendingFarms;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to discover trending farms');

      return [];
    }
  }

  /**
   * Discover high APR farms
   */
  async discoverHighAPRFarms(): Promise<YieldFarm[]> {
    logger.debug('Discovering high APR farms');

    try {
      // Check cache first
      const cacheKey = 'high_apr_farms';
      if (this.config.cacheFarmData) {
        const cached = await this.cache.get<YieldFarm[]>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get all farms
      const allFarms = await this.farmIntegration.getFarms();

      // Filter and sort by APR
      const highAPRFarms = allFarms
        .filter(farm => {
          // APR must be above threshold
          if (farm.apr < 30) return false;

          // Minimum TVL to avoid very small/risky farms
          if (farm.tvl < 25000) return false;

          // Avoid extremely high APRs that are likely unsustainable
          if (farm.apr > 200) return false;

          return true;
        })
        .sort((a, b) => b.apr - a.apr)
        .slice(0, 15);

      // Cache result
      if (this.config.cacheFarmData) {
        await this.cache.set(cacheKey, highAPRFarms, this.config.farmDataCacheTTL);
      }

      logger.info({
        totalFarms: allFarms.length,
        highAPRFarms: highAPRFarms.length,
        avgAPR: highAPRFarms.reduce((sum, farm) => sum + farm.apr, 0) / highAPRFarms.length
      }, 'High APR farms discovered');

      return highAPRFarms;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to discover high APR farms');

      return [];
    }
  }

  /**
   * Discover stable farms
   */
  async discoverStableFarms(): Promise<YieldFarm[]> {
    logger.debug('Discovering stable farms');

    try {
      // Check cache first
      const cacheKey = 'stable_farms';
      if (this.config.cacheFarmData) {
        const cached = await this.cache.get<YieldFarm[]>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get all farms
      const allFarms = await this.farmIntegration.getFarms();

      // Filter for stable farms
      const stableFarms = allFarms
        .filter(farm => {
          // Must be marked as stable
          if (!farm.isStable) return false;

          // Must have reasonable APR (not too high)
          if (farm.apr > 50) return false;

          // Must have good TVL
          if (farm.tvl < 100000) return false;

          // Must use verified tokens
          if (!this.isVerifiedFarm(farm)) return false;

          return true;
        })
        .sort((a, b) => b.tvl - a.tvl); // Sort by TVL

      // Cache result
      if (this.config.cacheFarmData) {
        await this.cache.set(cacheKey, stableFarms, this.config.farmDataCacheTTL);
      }

      logger.info({
        totalFarms: allFarms.length,
        stableFarms: stableFarms.length,
        avgAPR: stableFarms.reduce((sum, farm) => sum + farm.apr, 0) / stableFarms.length
      }, 'Stable farms discovered');

      return stableFarms;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to discover stable farms');

      return [];
    }
  }

  /**
   * Calculate APY for a farm
   */
  async calculateAPY(farm: YieldFarm): Promise<number> {
    logger.debug({ farmId: farm.id }, 'Calculating APY');

    try {
      // Base APY from APR with compounding
      let apy = this.calculateAPYFromAPR(farm.apr);

      // Adjust for impermanent loss (if applicable)
      const impermanentLossAdjustment = await this.calculateImpermanentLossAdjustment(farm);
      apy *= (1 - impermanentLossAdjustment);

      // Adjust for fees
      const feeAdjustment = 0.001; // 0.1% typical fee
      apy *= (1 - feeAdjustment);

      // Risk adjustment
      const riskAdjustment = await this.calculateRiskAdjustment(farm);
      apy *= (1 - riskAdjustment);

      return Math.max(0, apy);

    } catch (error) {
      logger.error({
        farmId: farm.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to calculate APY');

      return farm.apy; // Fallback to provided APY
    }
  }

  /**
   * Calculate real APY for a user (accounting for their position)
   */
  async calculateRealAPY(farm: YieldFarm, userAddress?: string): Promise<number> {
    logger.debug({ farmId: farm.id, userAddress }, 'Calculating real APY');

    try {
      // Base APY
      const baseAPY = await this.calculateAPY(farm);

      if (!userAddress) {
        return baseAPY;
      }

      // Get user position for custom calculations
      const position = await this.farmIntegration.getUserPosition(userAddress, farm.pid);
      if (!position) {
        return baseAPY;
      }

      // Adjust based on user's actual performance
      let realAPY = baseAPY;

      // Account for user's actual impermanent loss
      if (position.impermanentLoss > 0) {
        realAPY *= (1 - position.impermanentLoss);
      }

      // Account for user's actual fees
      const userFees = parseFloat(position.feeEarned) / position.valueUSD;
      realAPY += userFees;

      // Account for compounding strategy
      if (position.isAutoCompounding) {
        realAPY *= 1.1; // 10% boost from auto-compounding
      }

      return Math.max(0, realAPY);

    } catch (error) {
      logger.error({
        farmId: farm.id,
        userAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to calculate real APY');

      return farm.apy; // Fallback
    }
  }

  /**
   * Calculate risk-adjusted APY
   */
  async calculateRiskAdjustedAPY(farm: YieldFarm): Promise<number> {
    logger.debug({ farmId: farm.id }, 'Calculating risk-adjusted APY');

    try {
      const baseAPY = await this.calculateAPY(farm);
      const riskMetrics = await this.calculateRiskMetrics(farm);

      // Calculate risk-adjusted return (Sharpe ratio-like)
      const riskFreeRate = 0.02; // 2% risk-free rate
      const riskAdjustedReturn = (baseAPY - riskFreeRate) / (riskMetrics.volatility || 0.1);

      return Math.max(0, riskAdjustedReturn + riskFreeRate);

    } catch (error) {
      logger.error({
        farmId: farm.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to calculate risk-adjusted APY');

      return farm.apy * 0.8; // Conservative fallback
    }
  }

  /**
   * Analyze farm potential
   */
  async analyzeFarmPotential(farm: YieldFarm): Promise<FarmAnalysis> {
    logger.debug({ farmId: farm.id }, 'Analyzing farm potential');

    try {
      // Calculate various metrics
      const [potentialScore, expectedReturn, timeHorizon] = await Promise.all([
        this.calculatePotentialScore(farm),
        this.calculateExpectedReturn(farm),
        this.calculateOptimalTimeHorizon(farm)
      ]);

      // Identify risks and opportunities
      const risks = await this.identifyFarmRisks(farm);
      const opportunities = await this.identifyFarmOpportunities(farm);
      const recommendations = this.generateFarmRecommendations(farm, risks, opportunities);

      const analysis: FarmAnalysis = {
        farm,
        potential: potentialScore,
        risks,
        opportunities,
        recommendations,
        expectedReturn,
        timeHorizon
      };

      return analysis;

    } catch (error) {
      logger.error({
        farmId: farm.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to analyze farm potential');

      const yieldError: YieldError = {
        code: YieldErrorCode.NETWORK_ERROR,
        message: `Failed to analyze farm potential: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { farmId: farm.id }
      };

      throw yieldError;
    }
  }

  /**
   * Compare multiple farms
   */
  async compareFarms(farms: YieldFarm[]): Promise<FarmComparison> {
    logger.debug({ farmCount: farms.length }, 'Comparing farms');

    try {
      if (farms.length < 2) {
        throw new Error('At least 2 farms required for comparison');
      }

      // Calculate comparison metrics
      const metrics = await this.calculateComparisonMetrics(farms);

      // Rank farms
      const ranking = await this.rankFarms(farms);

      // Find best farms for different criteria
      const bestFor = {
        highestAPR: farms.reduce((best, farm) => farm.apr > best.apr ? farm : best),
        lowestRisk: farms.reduce((best, farm) => this.getFarmRisk(farm) < this.getFarmRisk(best) ? farm : best),
        highestTVL: farms.reduce((best, farm) => farm.tvl > best.tvl ? farm : best),
        mostStable: farms.filter(f => f.isStable).sort((a, b) => b.tvl - a.tvl)[0] || farms[0],
        balanced: farms.reduce((best, farm) => {
          const bestScore = best.apr / this.getFarmRisk(best);
          const farmScore = farm.apr / this.getFarmRisk(farm);
          return farmScore > bestScore ? farm : best;
        })
      };

      // Generate summary
      const summary: ComparisonSummary = {
        bestAPR: bestFor.highestAPR,
        bestAPY: farms.reduce((best, farm) => farm.apy > best.apy ? farm : best),
        lowestRisk: bestFor.lowestRisk,
        highestTVL: bestFor.highestTVL,
        mostStable: bestFor.mostStable,
        recommendation: bestFor.balanced
      };

      const comparison: FarmComparison = {
        farms,
        metrics,
        ranking,
        bestFor,
        summary
      };

      return comparison;

    } catch (error) {
      logger.error({
        farmCount: farms.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to compare farms');

      const yieldError: YieldError = {
        code: YieldErrorCode.NETWORK_ERROR,
        message: `Failed to compare farms: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { farmCount: farms.length }
      };

      throw yieldError;
    }
  }

  /**
   * Get farm recommendations based on user profile
   */
  async getFarmRecommendations(userProfile: UserProfile): Promise<YieldFarm[]> {
    logger.debug({ userProfile }, 'Getting farm recommendations');

    try {
      // Get all farms
      const allFarms = await this.farmIntegration.getFarms();

      // Filter based on user preferences
      const candidateFarms = allFarms.filter(farm => {
        // Risk tolerance filter
        const farmRisk = this.getFarmRisk(farm);
        if (farmRisk > userProfile.maxRisk) return false;

        // APR filter
        if (farm.apr < userProfile.minAPR) return false;

        // Category filter
        if (userProfile.preferredCategories.length > 0 &&
            !userProfile.preferredCategories.includes(farm.category)) return false;

        // TVL filter (based on liquidity preference)
        const minTVL = userProfile.liquidityPreference === 'high' ? 500000 :
                       userProfile.liquidityPreference === 'medium' ? 100000 : 25000;
        if (farm.tvl < minTVL) return false;

        return true;
      });

      // Score farms based on user profile
      const scoredFarms = await Promise.all(
        candidateFarms.map(async farm => ({
          farm,
          score: await this.scoreFarmForUser(farm, userProfile)
        }))
      );

      // Sort by score and return top recommendations
      scoredFarms.sort((a, b) => b.score - a.score);

      return scoredFarms.slice(0, 10).map(item => item.farm);

    } catch (error) {
      logger.error({
        userProfile,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get farm recommendations');

      return [];
    }
  }

  /**
   * Get market overview
   */
  async getMarketOverview(): Promise<YieldMarketOverview> {
    logger.debug('Getting market overview');

    try {
      // Check cache first
      const cacheKey = 'market_overview';
      if (this.config.cacheFarmData) {
        const cached = await this.cache.get<YieldMarketOverview>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get all farms
      const allFarms = await this.farmIntegration.getFarms();

      // Calculate market metrics
      const activeFarms = allFarms.filter(f => f.isActive);
      const totalTVL = allFarms.reduce((sum, farm) => sum + farm.tvl, 0);
      const averageAPR = allFarms.reduce((sum, farm) => sum + farm.apr, 0) / allFarms.length;
      const averageAPY = allFarms.reduce((sum, farm) => sum + farm.apy, 0) / allFarms.length;

      // Category statistics
      const categoryStats = this.calculateCategoryStats(allFarms);

      // Risk distribution
      const riskDistribution = this.calculateRiskDistribution(allFarms);

      // Performance metrics
      const performanceMetrics = await this.calculateMarketPerformanceMetrics(allFarms);

      // Get special farm lists
      const [trendingFarms, newFarms] = await Promise.all([
        this.discoverTrendingFarms(),
        this.discoverNewFarms()
      ]);

      const overview: YieldMarketOverview = {
        totalFarms: allFarms.length,
        activeFarms: activeFarms.length,
        averageAPR,
        averageAPY,
        totalTVL,
        topCategories: categoryStats,
        trendingFarms: trendingFarms.slice(0, 5),
        newFarms: newFarms.slice(0, 5),
        riskDistribution,
        performanceMetrics
      };

      // Cache result
      if (this.config.cacheFarmData) {
        await this.cache.set(cacheKey, overview, this.config.farmDataCacheTTL);
      }

      return overview;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get market overview');

      const yieldError: YieldError = {
        code: YieldErrorCode.NETWORK_ERROR,
        message: `Failed to get market overview: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: {}
      };

      throw yieldError;
    }
  }

  /**
   * Get APY trends
   */
  async getAPYTrends(period: string = '7d'): Promise<APYTrend[]> {
    logger.debug({ period }, 'Getting APY trends');

    try {
      // Get all farms
      const allFarms = await this.farmIntegration.getFarms();

      // Group by category
      const farmsByCategory = allFarms.reduce((groups, farm) => {
        if (!groups[farm.category]) {
          groups[farm.category] = [];
        }
        groups[farm.category].push(farm);
        return groups;
      }, {} as Record<FarmCategory, YieldFarm[]>);

      // Calculate trends for each category
      const trends: APYTrend[] = await Promise.all(
        Object.entries(farmsByCategory).map(async ([category, farms]) => {
          const avgAPR = farms.reduce((sum, farm) => sum + farm.apr, 0) / farms.length;
          const avgAPY = farms.reduce((sum, farm) => sum + farm.apy, 0) / farms.length;

          // Historical data (simplified)
          const change24h = await this.calculateHistoricalChange(farms, '1d');
          const change7d = await this.calculateHistoricalChange(farms, '7d');
          const change30d = await this.calculateHistoricalChange(farms, '30d');

          // Predictions (simplified linear extrapolation)
          const prediction7d = avgAPY * (1 + (change7d / 100));
          const prediction30d = avgAPY * (1 + (change30d / 100));

          return {
            category: category as FarmCategory,
            apr: avgAPR,
            apy: avgAPY,
            change24h,
            change7d,
            change30d,
            prediction7d,
            prediction30d
          };
        })
      );

      return trends;

    } catch (error) {
      logger.error({
        period,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get APY trends');

      return [];
    }
  }

  /**
   * Get yield opportunities
   */
  async getYieldOpportunities(): Promise<YieldOpportunity[]> {
    logger.debug('Getting yield opportunities');

    try {
      const opportunities: YieldOpportunity[] = [];

      // High APR opportunities
      const highAPRFarms = await this.discoverHighAPRFarms();
      opportunities.push(...highAPRFarms.slice(0, 3).map(farm => ({
        farm,
        opportunityType: OpportunityType.HIGH_APR,
        expectedAPY: farm.apy,
        riskLevel: this.getFarmRiskLevel(farm),
        timeWindow: 7 * 24 * 60 * 60 * 1000, // 7 days
        description: `High APR opportunity in ${farm.name}`,
        confidence: 0.7
      })));

      // New farm opportunities
      const newFarms = await this.discoverNewFarms();
      opportunities.push(...newFarms.slice(0, 2).map(farm => ({
        farm,
        opportunityType: OpportunityType.NEW_FARM,
        expectedAPY: farm.apy,
        riskLevel: this.getFarmRiskLevel(farm),
        timeWindow: 3 * 24 * 60 * 60 * 1000, // 3 days
        description: `New farm opportunity in ${farm.name}`,
        confidence: 0.6
      })));

      // Stable yield opportunities
      const stableFarms = await this.discoverStableFarms();
      opportunities.push(...stableFarms.slice(0, 2).map(farm => ({
        farm,
        opportunityType: OpportunityType.STABLE_YIELD,
        expectedAPY: farm.apy,
        riskLevel: 'low',
        timeWindow: 30 * 24 * 60 * 60 * 1000, // 30 days
        description: `Stable yield opportunity in ${farm.name}`,
        confidence: 0.8
      })));

      // Sort by confidence and expected APY
      opportunities.sort((a, b) => {
        const scoreA = a.confidence * a.expectedAPY;
        const scoreB = b.confidence * b.expectedAPY;
        return scoreB - scoreA;
      });

      return opportunities.slice(0, 10);

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get yield opportunities');

      return [];
    }
  }

  /**
   * Assess farm risk
   */
  async assessFarmRisk(farm: YieldFarm): Promise<RiskAssessment> {
    logger.debug({ farmId: farm.id }, 'Assessing farm risk');

    try {
      const riskFactors = await this.identifyRiskFactors(farm);
      const riskScore = this.calculateOverallRiskScore(riskFactors);
      const overallRisk = this.getRiskLevelFromScore(riskScore);

      const mitigationStrategies = this.generateMitigationStrategies(riskFactors);
      const worstCaseScenario = this.calculateWorstCaseScenario(farm, riskFactors);

      const assessment: RiskAssessment = {
        overallRisk,
        riskFactors,
        mitigationStrategies,
        riskScore,
        worstCaseScenario
      };

      return assessment;

    } catch (error) {
      logger.error({
        farmId: farm.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to assess farm risk');

      // Return conservative assessment
      return {
        overallRisk: 'high',
        riskFactors: [{
          type: 'assessment_error',
          severity: 'high',
          description: 'Failed to assess farm risk',
          impact: 'Unknown risk level',
          probability: 0.5
        }],
        mitigationStrategies: ['Exercise extreme caution', 'Start with small investment'],
        riskScore: 0.7,
        worstCaseScenario: {
          description: 'Complete loss possible',
          probability: 0.1,
          potentialLoss: 1.0,
          timeframe: 'Unknown'
        }
      };
    }
  }

  /**
   * Calculate risk metrics
   */
  async calculateRiskMetrics(farm: YieldFarm): Promise<RiskMetrics> {
    logger.debug({ farmId: farm.id }, 'Calculating risk metrics');

    try {
      // Get historical performance data (simplified)
      const performanceData = await this.getFarmPerformanceData(farm);

      // Calculate metrics
      const returns = performanceData.dailyReturns || [];
      const volatility = this.calculateVolatility(returns);
      const maxDrawdown = this.calculateMaxDrawdown(performanceData.prices || []);
      const sharpeRatio = this.calculateSharpeRatio(returns);
      const sortinoRatio = this.calculateSortinoRatio(returns);

      const metrics: RiskMetrics = {
        volatility,
        maxDrawdown,
        sharpeRatio,
        sortinoRatio,
        beta: 1.0, // Would calculate relative to market
        alpha: 0.05, // Would calculate excess return
        valueAtRisk: this.calculateVaR(returns, 0.05),
        expectedShortfall: this.calculateExpectedShortfall(returns, 0.05)
      };

      return metrics;

    } catch (error) {
      logger.error({
        farmId: farm.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to calculate risk metrics');

      // Return conservative estimates
      return {
        volatility: 0.3,
        maxDrawdown: 0.2,
        sharpeRatio: 0.5,
        sortinoRatio: 0.7,
        beta: 1.0,
        alpha: 0,
        valueAtRisk: 0.05,
        expectedShortfall: 0.08
      };
    }
  }

  // Private helper methods

  private calculateAPYFromAPR(apr: number): number {
    // Compound daily
    return Math.pow(1 + apr / 36500, 365) - 1;
  }

  private async calculateImpermanentLossAdjustment(farm: YieldFarm): Promise<number> {
    // Simplified IL calculation based on farm characteristics
    if (farm.isStable) return 0.01; // 1% IL for stable farms
    if (farm.category === FarmCategory.BLUECHIP) return 0.03; // 3% IL for bluechip
    return 0.05; // 5% IL for regular farms
  }

  private async calculateRiskAdjustment(farm: YieldFarm): Promise<number> {
    // Risk adjustment based on farm characteristics
    let riskAdjustment = 0.02; // Base 2% adjustment

    if (farm.apr > 100) riskAdjustment += 0.03; // High APR farms
    if (farm.tvl < 100000) riskAdjustment += 0.02; // Low TVL farms
    if (!this.isVerifiedFarm(farm)) riskAdjustment += 0.05; // Unverified farms

    return Math.min(riskAdjustment, 0.2); // Max 20% adjustment
  }

  private async calculateTrendScore(farm: YieldFarm): Promise<number> {
    // Simplified trend calculation
    let score = 0;

    // Volume trend
    score += farm.tvl > 1000000 ? 30 : farm.tvl > 100000 ? 20 : 10;

    // APR trend
    score += farm.apr > 50 ? 25 : farm.apr > 20 ? 15 : 5;

    // Age factor (newer farms get higher trend score)
    const age = Date.now() - farm.createdAt;
    if (age < 7 * 24 * 60 * 60 * 1000) score += 20; // Less than 7 days
    else if (age < 30 * 24 * 60 * 60 * 1000) score += 10; // Less than 30 days

    // Verification bonus
    if (this.isVerifiedFarm(farm)) score += 15;

    // Category bonus
    if (farm.category === FarmCategory.HOT) score += 10;

    return score;
  }

  private isVerifiedFarm(farm: YieldFarm): boolean {
    // Simplified verification check
    const blueChips = ['CAKE', 'WBNB', 'ETH', 'BTC', 'USDT', 'USDC', 'BUSD', 'DAI'];
    return blueChips.includes(farm.token0.symbol) && blueChips.includes(farm.token1.symbol);
  }

  private async calculatePotentialScore(farm: YieldFarm): Promise<PotentialScore> {
    // Calculate various potential scores
    const growth = Math.min(farm.apr / 100, 1); // Growth potential
    const stability = farm.isStable ? 0.9 : 0.5; // Stability score
    const profitability = farm.apr / 200; // Profitability (normalized)
    const sustainability = farm.tvl > 500000 ? 0.8 : 0.4; // Sustainability

    return {
      overall: (growth + stability + profitability + sustainability) / 4,
      growth,
      stability,
      profitability,
      sustainability
    };
  }

  private async calculateExpectedReturn(farm: YieldFarm): Promise<ExpectedReturn> {
    const daily = farm.apr / 36500;
    const weekly = farm.apr / 5200;
    const monthly = farm.apr / 1200;
    const annual = farm.apr / 100;

    return {
      daily,
      weekly,
      monthly,
      annual,
      riskAdjusted: annual * 0.8, // 20% risk adjustment
      afterFees: annual * 0.99 // 1% fee adjustment
    };
  }

  private async calculateOptimalTimeHorizon(farm: YieldFarm): Promise<TimeHorizon> {
    const dailyReturn = farm.apr / 36500;
    const weeklyReturn = farm.apr / 5200;
    const monthlyReturn = farm.apr / 1200;

    return {
      short: dailyReturn * 7, // 1 week
      medium: weeklyReturn * 4, // 1 month
      long: monthlyReturn * 3, // 3 months
      optimal: farm.isStable ? 'long' : 'medium'
    };
  }

  private async identifyFarmRisks(farm: YieldFarm): Promise<string[]> {
    const risks: string[] = [];

    if (farm.apr > 200) risks.push('Extremely high APR may be unsustainable');
    if (farm.tvl < 50000) risks.push('Low liquidity increases exit risk');
    if (!this.isVerifiedFarm(farm)) risks.push('Unverified tokens present');
    if (!farm.isStable) risks.push('Exposure to impermanent loss');
    if (farm.category === FarmCategory.NEW) risks.push('New farm with limited track record');

    return risks;
  }

  private async identifyFarmOpportunities(farm: YieldFarm): Promise<string[]> {
    const opportunities: string[] = [];

    if (farm.apr > 50) opportunities.push('High yield opportunity');
    if (farm.tvl > 1000000) opportunities.push('High liquidity and stability');
    if (farm.isStable) opportunities.push('Stable returns with low impermanent loss');
    if (this.isVerifiedFarm(farm)) opportunities.push('Established tokens with good track record');
    if (farm.isHot) opportunities.push('Trending farm with growing interest');

    return opportunities;
  }

  private generateFarmRecommendations(farm: YieldFarm, risks: string[], opportunities: string[]): string[] {
    const recommendations: string[] = [];

    if (risks.length > opportunities.length) {
      recommendations.push('Exercise caution with this farm');
      recommendations.push('Consider starting with a small position');
    } else {
      recommendations.push('Strong opportunity worth considering');
      recommendations.push('Good risk/reward balance');
    }

    if (farm.isStable) {
      recommendations.push('Suitable for long-term holding');
    }

    if (farm.apr > 100) {
      recommendations.push('Monitor performance regularly');
      recommendations.push('Consider taking profits periodically');
    }

    return recommendations;
  }

  private async calculateComparisonMetrics(farms: YieldFarm[]): Promise<ComparisonMetrics> {
    const avgAPR = farms.reduce((sum, farm) => sum + farm.apr, 0) / farms.length;
    const avgAPY = farms.reduce((sum, farm) => sum + farm.apy, 0) / farms.length;
    const avgTVL = farms.reduce((sum, farm) => sum + farm.tvl, 0) / farms.length;
    const avgRisk = farms.reduce((sum, farm) => sum + this.getFarmRisk(farm), 0) / farms.length;

    return {
      avgAPR,
      avgAPY,
      avgTVL,
      avgRisk,
      volatility: 0.2, // Would calculate from historical data
      concentration: 0.3 // Would calculate from holder distribution
    };
  }

  private async rankFarms(farms: YieldFarm[]): Promise<FarmRanking[]> {
    const rankings = await Promise.all(
      farms.map(async farm => ({
        farm,
        rank: 0, // Will be set after sorting
        score: await this.calculateFarmScore(farm),
        strengths: this.identifyFarmStrengths(farm),
        weaknesses: this.identifyFarmWeaknesses(farm)
      }))
    );

    // Sort by score
    rankings.sort((a, b) => b.score - a.score);

    // Set ranks
    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1;
    });

    return rankings;
  }

  private async calculateFarmScore(farm: YieldFarm): Promise<number> {
    let score = 0;

    // APR component (40% weight)
    score += (farm.apr / 100) * 0.4;

    // TVL component (20% weight)
    score += Math.min(farm.tvl / 1000000, 1) * 0.2;

    // Stability component (20% weight)
    score += (farm.isStable ? 1 : 0.5) * 0.2;

    // Verification component (10% weight)
    score += (this.isVerifiedFarm(farm) ? 1 : 0.5) * 0.1;

    // Age component (10% weight)
    const age = Date.now() - farm.createdAt;
    const ageScore = Math.min(age / (30 * 24 * 60 * 60 * 1000), 1); // Max score at 30 days
    score += ageScore * 0.1;

    return score;
  }

  private identifyFarmStrengths(farm: YieldFarm): string[] {
    const strengths: string[] = [];

    if (farm.apr > 50) strengths.push('High APR');
    if (farm.tvl > 500000) strengths.push('High TVL and liquidity');
    if (farm.isStable) strengths.push('Stable returns');
    if (this.isVerifiedFarm(farm)) strengths.push('Verified tokens');
    if (farm.isHot) strengths.push('Trending popularity');

    return strengths;
  }

  private identifyFarmWeaknesses(farm: YieldFarm): string[] {
    const weaknesses: string[] = [];

    if (farm.apr < 10) weaknesses.push('Low APR');
    if (farm.tvl < 50000) weaknesses.push('Low liquidity');
    if (!farm.isStable) weaknesses.push('Impermanent loss risk');
    if (!this.isVerifiedFarm(farm)) weaknesses.push('Unverified tokens');

    return weaknesses;
  }

  private getFarmRisk(farm: YieldFarm): number {
    let risk = 0.1; // Base risk

    if (farm.apr > 100) risk += 0.2;
    if (farm.tvl < 100000) risk += 0.2;
    if (!farm.isStable) risk += 0.15;
    if (!this.isVerifiedFarm(farm)) risk += 0.25;

    return Math.min(risk, 0.8);
  }

  private getFarmRiskLevel(farm: YieldFarm): string {
    const risk = this.getFarmRisk(farm);
    if (risk < 0.2) return 'very_low';
    if (risk < 0.4) return 'low';
    if (risk < 0.6) return 'medium';
    if (risk < 0.8) return 'high';
    return 'very_high';
  }

  private async scoreFarmForUser(farm: YieldFarm, profile: UserProfile): Promise<number> {
    let score = 0;

    // APR preference
    if (farm.apr >= profile.minAPR) {
      score += (farm.apr / 100) * 0.3;
    }

    // Risk preference
    const farmRisk = this.getFarmRisk(farm);
    const riskScore = farmRisk <= profile.maxRisk ? (1 - farmRisk) * 0.3 : 0;
    score += riskScore;

    // Category preference
    if (profile.preferredCategories.includes(farm.category)) {
      score += 0.2;
    }

    // Liquidity preference
    const tvlScore = farm.tvl >= 1000000 ? 1 : farm.tvl >= 100000 ? 0.7 : 0.3;
    score += tvlScore * 0.2;

    return score;
  }

  private calculateCategoryStats(farms: YieldFarm[]): CategoryStats[] {
    const categories = [...new Set(farms.map(f => f.category))];

    return categories.map(category => {
      const categoryFarms = farms.filter(f => f.category === category);
      const avgAPR = categoryFarms.reduce((sum, f) => sum + f.apr, 0) / categoryFarms.length;
      const avgTVL = categoryFarms.reduce((sum, f) => sum + f.tvl, 0) / categoryFarms.length;

      return {
        category,
        count: categoryFarms.length,
        avgAPR,
        avgTVL,
        trend: 'stable' // Would calculate from historical data
      };
    }).sort((a, b) => b.avgTVL - a.avgTVL);
  }

  private calculateRiskDistribution(farms: YieldFarm[]): RiskDistribution {
    const distribution = {
      veryLow: 0,
      low: 0,
      medium: 0,
      high: 0,
      veryHigh: 0
    };

    farms.forEach(farm => {
      const riskLevel = this.getFarmRiskLevel(farm);
      distribution[riskLevel as keyof RiskDistribution]++;
    });

    return distribution;
  }

  private async calculateMarketPerformanceMetrics(farms: YieldFarm[]): Promise<MarketPerformance> {
    // Simplified market performance calculation
    return {
      totalReturns7d: 0.05, // 5%
      totalReturns30d: 0.15, // 15%
      volatility7d: 0.2,
      volatility30d: 0.25,
      sharpeRatio: 0.6,
      maxDrawdown: 0.1
    };
  }

  private async calculateHistoricalChange(farms: YieldFarm[], period: string): Promise<number> {
    // Simplified historical change calculation
    // In reality, would fetch historical data
    switch (period) {
      case '1d': return Math.random() * 4 - 2; // -2% to +2%
      case '7d': return Math.random() * 10 - 5; // -5% to +5%
      case '30d': return Math.random() * 20 - 10; // -10% to +10%
      default: return 0;
    }
  }

  private async identifyRiskFactors(farm: YieldFarm): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    if (farm.apr > 200) {
      factors.push({
        type: 'high_apr',
        severity: 'high',
        description: 'Extremely high APR may be unsustainable',
        impact: 'Potential drop in rewards',
        probability: 0.6
      });
    }

    if (farm.tvl < 50000) {
      factors.push({
        type: 'low_liquidity',
        severity: 'medium',
        description: 'Low total value locked',
        impact: 'Difficulty exiting position',
        probability: 0.4
      });
    }

    if (!this.isVerifiedFarm(farm)) {
      factors.push({
        type: 'unverified_tokens',
        severity: 'high',
        description: 'Farm contains unverified tokens',
        impact: 'Potential for token failure or scam',
        probability: 0.3
      });
    }

    if (!farm.isStable) {
      factors.push({
        type: 'impermanent_loss',
        severity: 'medium',
        description: 'Exposure to impermanent loss',
        impact: 'Reduced returns during volatility',
        probability: 0.8
      });
    }

    return factors;
  }

  private calculateOverallRiskScore(factors: RiskFactor[]): number {
    if (factors.length === 0) return 0.1;

    let totalRisk = 0;
    let totalWeight = 0;

    factors.forEach(factor => {
      const severityWeight = {
        low: 0.2,
        medium: 0.5,
        high: 0.8,
        critical: 1.0
      }[factor.severity];

      totalRisk += severityWeight * factor.probability;
      totalWeight += severityWeight;
    });

    return totalWeight > 0 ? totalRisk / totalWeight : 0.1;
  }

  private getRiskLevelFromScore(score: number): 'very_low' | 'low' | 'medium' | 'high' | 'very_high' {
    if (score < 0.2) return 'very_low';
    if (score < 0.4) return 'low';
    if (score < 0.6) return 'medium';
    if (score < 0.8) return 'high';
    return 'very_high';
  }

  private generateMitigationStrategies(factors: RiskFactor[]): string[] {
    const strategies: string[] = [];

    if (factors.some(f => f.type === 'high_apr')) {
      strategies.push('Monitor farm performance regularly');
      strategies.push('Consider taking profits periodically');
    }

    if (factors.some(f => f.type === 'low_liquidity')) {
      strategies.push('Start with smaller position');
      strategies.push('Be prepared for higher slippage');
    }

    if (factors.some(f => f.type === 'unverified_tokens')) {
      strategies.push('Conduct thorough token research');
      strategies.push('Diversify across verified farms');
    }

    if (factors.some(f => f.type === 'impermanent_loss')) {
      strategies.push('Consider stable farm alternatives');
      strategies.push('Monitor price ratios closely');
    }

    if (strategies.length === 0) {
      strategies.push('Regular monitoring recommended');
    }

    return strategies;
  }

  private calculateWorstCaseScenario(farm: YieldFarm, factors: RiskFactor[]): WorstCaseScenario {
    const highSeverityFactors = factors.filter(f => f.severity === 'high' || f.severity === 'critical');

    if (highSeverityFactors.length > 0) {
      return {
        description: 'Multiple high-risk factors present',
        probability: 0.15,
        potentialLoss: 0.8, // 80% potential loss
        timeframe: '1-3 months'
      };
    }

    return {
      description: 'Moderate risk exposure',
      probability: 0.05,
      potentialLoss: 0.3, // 30% potential loss
      timeframe: '3-6 months'
    };
  }

  private async getFarmPerformanceData(farm: YieldFarm): Promise<any> {
    // Simplified performance data - would fetch from analytics
    return {
      dailyReturns: Array.from({ length: 30 }, () => Math.random() * 0.02 - 0.01),
      prices: Array.from({ length: 30 }, (_, i) => 1 + Math.random() * 0.2 - 0.1)
    };
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length === 0) return 0.2;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    return Math.sqrt(variance * 365); // Annualized volatility
  }

  private calculateMaxDrawdown(prices: number[]): number {
    if (prices.length === 0) return 0.1;

    let maxDrawdown = 0;
    let peak = prices[0];

    for (const price of prices) {
      if (price > peak) peak = price;
      const drawdown = (peak - price) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return maxDrawdown;
  }

  private calculateSharpeRatio(returns: number[]): number {
    const volatility = this.calculateVolatility(returns);
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const riskFreeRate = 0.02 / 365; // Daily risk-free rate

    return volatility > 0 ? (meanReturn - riskFreeRate) / (volatility / Math.sqrt(365)) : 0.5;
  }

  private calculateSortinoRatio(returns: number[]): number {
    const negativeReturns = returns.filter(r => r < 0);
    if (negativeReturns.length === 0) return 1.0;

    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const downsideDeviation = Math.sqrt(
      negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
    );
    const riskFreeRate = 0.02 / 365;

    return downsideDeviation > 0 ? (meanReturn - riskFreeRate) / downsideDeviation : 0.7;
  }

  private calculateVaR(returns: number[], confidence: number): number {
    if (returns.length === 0) return 0.05;

    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor(returns.length * confidence);

    return Math.abs(sortedReturns[index] || 0);
  }

  private calculateExpectedShortfall(returns: number[], confidence: number): number {
    if (returns.length === 0) return 0.08;

    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor(returns.length * confidence);
    const tailReturns = sortedReturns.slice(0, index);

    if (tailReturns.length === 0) return 0.08;

    return Math.abs(tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length);
  }
}

// Export singleton instance
export const farmDiscoveryService = new FarmDiscoveryService();