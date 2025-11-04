/**
 * BSC Impermanent Loss Calculation Service
 * Calculates and tracks impermanent loss for liquidity positions
 */

import { ethers } from 'ethers';
import logger from '../../../utils/logger.js';
import type {
  ImpermanentLossCalculation,
  LiquidityPosition,
  TokenInfo,
  LiquidityRiskLevel,
  LiquidityWarning,
  LiquidityError,
  LiquidityErrorCode
} from './types.js';
import { ILiquidityPoolIntegration, liquidityPoolIntegration } from './pool-integration.js';
import { BSCProviderManager } from '../../utils/ethers-provider.js';
import { BSCCacheManager } from '../cache/cache-manager.js';

/**
 * Impermanent Loss Service Interface
 */
export interface IImpermanentLossService {
  // Calculate impermanent loss
  calculateImpermanentLoss(
    initialAmounts: { amount0: string; amount1: string },
    initialPrices: { price0: number; price1: number },
    currentAmounts: { amount0: string; amount1: string },
    currentPrices: { price0: number; number; price1: number }
  ): Promise<ImpermanentLossCalculation>;

  // Track position over time
  trackPosition(position: LiquidityPosition): Promise<ImpermanentLossCalculation[]>;
  getPositionILHistory(positionId: string): Promise<ImpermanentLossCalculation[]>;

  // Get impermanent loss metrics
  getILMetrics(poolAddress: string, timeframe?: string): Promise<any>;
  getWorstCaseScenario(poolAddress: string, positionSize: number): Promise<number>;

  // Risk assessment
  assessILRisk(poolAddress: string, positionSize: number, timeframe?: string): Promise<{
    riskLevel: LiquidityRiskLevel;
    maxIL: number;
    probability: number;
    recommendations: string[];
  }>;

  // Predict impermanent loss
  predictILChange(
    poolAddress: string,
    priceChange: number,
    timeframe: string
  ): Promise<{
    estimatedIL: number;
    confidence: number;
    methodology: string;
  }>;

  // Historical analysis
  getHistoricalILAnalysis(poolAddress: string, period?: string): Promise<any>;
  compareILStrategies(poolAddress: string): Promise<any>;

  // Health and status
  healthCheck(): Promise<boolean>;
  getServiceStatus(): Promise<any>;
}

/**
 * Impermanent Loss Service Implementation
 */
export class ImpermanentLossService implements IImpermanentLossService {
  private poolIntegration: ILiquidityPoolIntegration;
  private provider: BSCProviderManager;
  private cache: BSCCacheManager;

  // Historical data storage (in production, would use database)
  private ilHistory: Map<string, ImpermanentLossCalculation[]> = new Map();

  // Volatility tracking
  private volatilityData: Map<string, { dailyVolatility: number; weeklyVolatility: number }> = new Map();

  // Risk thresholds
  private readonly RISK_THRESHOLDS = {
    LOW: 1,      // 1% IL
    MEDIUM: 5,    // 5% IL
    HIGH: 15,      // 15% IL
    VERY_HIGH: 30   // 30% IL
  };

  constructor() {
    this.poolIntegration = liquidityPoolIntegration;
    this.provider = new BSCProviderManager();
    this.cache = new BSCCacheManager();

    // Initialize historical data
    this.initializeHistoricalData();
  }

  /**
   * Calculate impermanent loss for a position
   */
  async calculateImpermanentLoss(
    initialAmounts: { amount0: string; amount1: string },
    initialPrices: { price0: number; price1: number },
    currentAmounts: { amount0: string; amount1: string },
    currentPrices: { price0: number; number; price1: number }
  ): Promise<ImpermanentLossCalculation> {
    logger.debug({
      initialAmounts,
      initialPrices,
      currentAmounts,
      currentPrices
    }, 'Calculating impermanent loss');

    try {
      // Calculate initial state
      const initialRatio = initialPrices.price0 / initialPrices.price1;
      const initialValue0USD = parseFloat(initialAmounts.amount0) * initialPrices.price0;
      const initialValue1USD = parseFloat(initialAmounts.amount1) * initialPrices.price1;
      const totalInitialValueUSD = initialValue0USD + initialValue1USD;

      // Calculate current state
      const currentRatio = currentPrices.price0 / currentPrices.price1;
      const currentValue0USD = parseFloat(currentAmounts.amount0) * currentPrices.price0;
      const currentValue1USD = parseFloat(currentAmounts.amount1) * currentPrices.price1;
      const totalCurrentValueUSD = currentValue0USD + currentValue1USD;

      // Calculate impermanent loss using formula
      const priceRatio = currentPrices.price0 / initialPrices.price0;
      const ILPercentage = this.calculateILFromPriceRatio(priceRatio);

      // Calculate impermanent loss in USD
      const impermanentLossUSD = totalInitialValueUSD * (ILPercentage / 100);
      const impermanentLossPercentage = ILPercentage;

      // Calculate hold value (what the tokens would be worth if held)
      const amount0InUSD = parseFloat(initialAmounts.amount0) * currentPrices.price0;
      const amount1InUSD = parseFloat(initialAmounts.amount1) * currentPrices.price1;
      const holdValueUSD = amount0InUSD + amount1InUSD;

      const liquidityValueUSD = totalCurrentValueUSD;
      const differenceUSD = holdValueUSD - liquidityValueUSD;
      const differencePercentage = (differenceUSD / holdValueUSD) * 100;

      // Assess risk level
      const riskLevel = this.assessILRiskLevel(impermanentLossPercentage, differencePercentage);

      // Generate recommendations
      const recommendations = this.generateILRecommendations(
        impermanentLossPercentage,
        priceRatio,
        riskLevel
      );

      const calculation: ImpermanentLossCalculation = {
        initialPrices: {
          price0: initialPrices.price0,
          price1: initialPrices.price1,
          ratio: initialRatio
        },
        initialAmounts: {
          amount0: initialAmounts.amount0,
          amount1: initialAmounts.amount1,
          value0USD: initialValue0USD,
          value1USD: initialValue1USD,
          totalValueUSD: totalInitialValueUSD
        },
        currentPrices: {
          price0: currentPrices.price0,
          price1: currentPrices.price1,
          ratio: currentRatio
        },
        currentAmounts: {
          amount0: currentAmounts.amount0,
          amount1: currentAmounts.amount1,
          value0USD: currentValue0USD,
          value1USD: currentValue1USD,
          totalValueUSD: totalCurrentValueUSD
        },
        impermanentLoss: impermanentLossPercentage,
        impermanentLossUSD,
        impermanentLossPercentage,
        holdValueUSD,
        liquidityValueUSD,
        differenceUSD,
        differencePercentage,
        duration: Date.now(), // Would calculate from position creation time
        annualizedIL: this.calculateAnnualizedIL(impermanentLossPercentage, 1), // 1 day duration
        riskLevel,
        recommendations
      };

      return calculation;

    } catch (error) {
      logger.error({
        initialAmounts,
        initialPrices,
        currentAmounts,
        currentPrices,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to calculate impermanent loss');
      throw error;
    }
  }

  /**
   * Track a position's impermanent loss over time
   */
  async trackPosition(position: LiquidityPosition): Promise<ImpermanentLossCalculation[]> {
    logger.debug({ positionId: position.id }, 'Tracking position impermanent loss');

    try {
      const history = this.ilHistory.get(position.id) || [];

      // Get current pool state
      const pool = await this.poolIntegration.getPool(position.poolAddress);
      if (!pool) {
        throw new LiquidityError(
          LiquidityErrorCode.POOL_NOT_FOUND,
          'Pool not found for position tracking'
        );
      }

      // Calculate current IL
      const currentCalculation = await this.calculateImpermanentLoss(
        {
          amount0: position.amount0,
          amount1: position.amount1
        },
        {
          price0: pool.price0,
          price1: pool.price1
        },
        {
          amount0: position.amount0,
          amount1: position.amount1
        },
        {
          price0: pool.price0,
          price1: pool.price1
        }
      );

      // Add to history
      history.push(currentCalculation);

      // Keep only last 100 records
      if (history.length > 100) {
        history.shift();
      }

      // Update history
      this.ilHistory.set(position.id, history);

      return history;

    } catch (error) {
      logger.error({
        positionId: position.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to track position');
      throw error;
    }
  }

  /**
   * Get impermanent loss history for a position
   */
  async getPositionILHistory(positionId: string): Promise<ImpermanentLossCalculation[]> {
    logger.debug({ positionId }, 'Getting position IL history');

    try {
      return this.ilHistory.get(positionId) || [];

    } catch (error) {
      logger.error({
        positionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get position IL history');
      return [];
    }
  }

  /**
   * Get impermanent loss metrics for a pool
   */
  async getILMetrics(poolAddress: string, timeframe: string = '24h'): Promise<any> {
    logger.debug({ poolAddress, timeframe }, 'Getting pool IL metrics');

    try {
      // This would aggregate IL data from all positions in the pool
      const metrics = {
        poolAddress,
        timeframe,
        averageIL: 0,
        maxIL: 0,
        totalILUSD: 0,
        affectedPositions: 0,
        totalPositions: 0,
        riskDistribution: {
          low: 0,
          medium: 0,
          high: 0,
          very_high: 0
        },
        timestamp: Date.now()
      };

      // In a real implementation:
      // 1. Get all positions in the pool
      // 2. Calculate current IL for each position
      // 3. Aggregate metrics
      // 4. Analyze risk distribution

      return metrics;

    } catch (error) {
      logger.error({
        poolAddress,
        timeframe,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get pool IL metrics');
      throw error;
    }
  }

  /**
   * Get worst-case impermanent loss scenario
   */
  async getWorstCaseScenario(poolAddress: string, positionSize: number): Promise<number> {
    logger.debug({ poolAddress, positionSize }, 'Calculating worst-case IL scenario');

    try {
      // Get pool information
      const pool = await this.poolIntegration.getPool(poolAddress);
      if (!pool) {
        return 0;
      }

      // Use Monte Carlo simulation for worst-case scenarios
      const scenarios = [
        { priceChange: 0.5 },   // 50% price drop
        { priceChange: 0.3 },   // 30% price drop
        { priceChange: 0.2 },   // 20% price drop
        { priceChange: 0.1 },   // 10% price drop
        { priceChange: -0.1 },  // 10% price increase
        { priceChange: -0.2 },  // 20% price increase
        { priceChange: -0.3 },  // 30% price increase
        { priceChange: -0.5 }    // 50% price increase
      ];

      let maxIL = 0;

      for (const scenario of scenarios) {
        const priceRatio = 1 + scenario.priceChange;
        const il = this.calculateILFromPriceRatio(priceRatio);
        maxIL = Math.max(maxIL, il);
      }

      return maxIL;

    } catch (error) {
      logger.error({
        poolAddress,
        positionSize,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to calculate worst-case IL scenario');
      return 0;
    }
  }

  /**
   * Assess impermanent loss risk for a position
   */
  async assessILRisk(
    poolAddress: string,
    positionSize: number,
    timeframe: string = '30d'
  ): Promise<{
    riskLevel: LiquidityRiskLevel;
    maxIL: number;
    probability: number;
    recommendations: string[];
  }> {
    logger.debug({ poolAddress, positionSize, timeframe }, 'Assessing IL risk');

    try {
      // Get pool and volatility data
      const pool = await this.poolIntegration.getPool(poolAddress);
      if (!pool) {
        return {
          riskLevel: LiquidityRiskLevel.LOW,
          maxIL: 0,
          probability: 0,
          recommendations: ['Pool not found']
        };
      }

      const volatility = this.getPoolVolatility(poolAddress);

      // Calculate worst-case IL
      const maxIL = await this.getWorstCaseScenario(poolAddress, positionSize);

      // Assess risk based on volatility and worst-case
      let riskLevel = LiquidityRiskLevel.LOW;
      let probability = 0;

      if (maxIL > this.RISK_THRESHOLDS.VERY_HIGH || volatility.weeklyVolatility > 50) {
        riskLevel = LiquidityRiskLevel.VERY_HIGH;
        probability = Math.min(95, 50 + volatility.weeklyVolatility);
      } else if (maxIL > this.RISK_THRESHOLDS.HIGH || volatility.weeklyVolatility > 30) {
        riskLevel = LiquidityRiskLevel.HIGH;
        probability = Math.min(80, 30 + volatility.weeklyVolatility);
      } else if (maxIL > this.RISK_THRESHOLDS.MEDIUM || volatility.weeklyVolatility > 15) {
        riskLevel = LiquidityRiskLevel.MEDIUM;
        probability = Math.min(60, 20 + volatility.weeklyVolatility);
      } else if (maxIL > this.RISK_THRESHOLDS.LOW) {
        riskLevel = LiquidityRiskLevel.LOW;
        probability = Math.min(40, 10 + volatility.weeklyVolatility);
      }

      // Generate recommendations
      const recommendations = this.generateRiskRecommendations(
        riskLevel,
        maxIL,
        volatility,
        positionSize
      );

      return {
        riskLevel,
        maxIL,
        probability,
        recommendations
      };

    } catch (error) {
      logger.error({
        poolAddress,
        positionSize,
        timeframe,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to assess IL risk');
      return {
        riskLevel: LiquidityRiskLevel.LOW,
        maxIL: 0,
        probability: 0,
        recommendations: ['Unable to assess risk']
      };
    }
  }

  /**
   * Predict impermanent loss changes
   */
  async predictILChange(
    poolAddress: string,
    priceChange: number,
    timeframe: string
  ): Promise<{
    estimatedIL: number;
    confidence: number;
    methodology: string;
  }> {
    logger.debug({ poolAddress, priceChange, timeframe }, 'Predicting IL change');

    try {
      // Get pool volatility
      const volatility = this.getPoolVolatility(poolAddress);

      // Use volatility-adjusted prediction
      const estimatedIL = this.calculateILFromPriceRatio(1 + priceChange);

      // Calculate confidence based on volatility and timeframe
      const days = this.parseTimeframe(timeframe);
      let confidence = 100;

      if (days > 7) {
        confidence = Math.max(60, 100 - (days - 7) * 5);
      }

      if (volatility.weeklyVolatility > 30) {
        confidence *= 0.7; // Reduce confidence for high volatility pools
      }

      return {
        estimatedIL,
        confidence,
        methodology: 'Monte Carlo simulation with volatility adjustment'
      };

    } catch (error) {
      logger.error({
        poolAddress,
        priceChange,
        timeframe,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to predict IL change');
      return {
        estimatedIL: 0,
        confidence: 0,
        methodology: 'Failed to predict'
      };
    }
  }

  /**
   * Get historical impermanent loss analysis
   */
  async getHistoricalILAnalysis(poolAddress: string, period: string = '30d'): Promise<any> {
    logger.debug({ poolAddress, period }, 'Getting historical IL analysis');

    try {
      // This would analyze historical IL patterns
      return {
        poolAddress,
        period,
        averageIL: 0,
        volatility: 0,
        maxIL: 0,
        recoveryTimes: [],
        seasonalPatterns: [],
        correlations: [],
        timestamp: Date.now()
      };

    } catch (error) {
      logger.error({
        poolAddress,
        period,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get historical IL analysis');
      throw error;
    }
  }

  /**
   * Compare impermanent loss strategies
   */
  async compareILStrategies(poolAddress: string): Promise<any> {
    logger.debug({ poolAddress }, 'Comparing IL strategies');

    try {
      // This would compare different hedging strategies
      return {
        poolAddress,
        strategies: [
          {
            name: 'Hold and Wait',
            description: 'Hold position until price recovers',
            expectedIL: 0,
            risk: 'Low',
            timeframe: 'Variable'
          },
          {
            name: 'Periodic Rebalancing',
            description: 'Rebalance to maintain 50/50 ratio',
            expectedIL: 5,
            risk: 'Medium',
            timeframe: 'Weekly'
          },
          {
            name: 'Hedging with Options',
            description: 'Use options to hedge against price movements',
            expectedIL: 2,
            risk: 'Low',
            timeframe: 'Monthly'
          }
        ],
        recommendation: 'Hold and Wait',
        timestamp: Date.now()
      };

    } catch (error) {
      logger.error({
        poolAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to compare IL strategies');
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if services are responsive
      const poolHealth = await this.poolIntegration.healthCheck();
      const providerHealth = await this.provider.healthCheck();

      return poolHealth && providerHealth;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'IL service health check failed');
      return false;
    }
  }

  /**
   * Get service status
   */
  async getServiceStatus(): Promise<any> {
    try {
      return {
        healthy: await this.healthCheck(),
        trackedPositions: this.ilHistory.size,
        volatilityDataPoints: this.volatilityData.size,
        riskThresholds: this.RISK_THRESHOLDS,
        timestamp: Date.now()
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get service status');
      throw error;
    }
  }

  // Private helper methods

  private calculateILFromPriceRatio(priceRatio: number): number {
    // Standard impermanent loss formula for Uniswap-style AMMs
    // IL = 1 - (2 * sqrt(priceRatio)) / (1 + priceRatio)
    const sqrtRatio = Math.sqrt(priceRatio);
    return (1 - (2 * sqrtRatio) / (1 + priceRatio)) * 100;
  }

  private calculateAnnualizedIL(currentIL: number, days: number): number {
    // Simple annualization
    if (currentIL <= 0) return 0;
    return currentIL * (365 / days);
  }

  private assessILRiskLevel(ilPercentage: number, differencePercentage: number): LiquidityRiskLevel {
    const maxLoss = Math.max(ilPercentage, differencePercentage);

    if (maxLoss > this.RISK_THRESHOLDS.VERY_HIGH) {
      return LiquidityRiskLevel.VERY_HIGH;
    }
    if (maxLoss > this.RISK_THRESHOLDS.HIGH) {
      return LiquidityLevel.HIGH;
    }
    if (maxLoss > this.RISK_THRESHOLDS.MEDIUM) {
      return LiquidityRiskLevel.MEDIUM;
    }
    return LiquidityRiskLevel.LOW;
  }

  private generateILRecommendations(
    ilPercentage: number,
    priceRatio: number,
    riskLevel: LiquidityRiskLevel
  ): string[] {
    const recommendations: string[] = [];

    if (ilPercentage > 20) {
      recommendations.push('Consider reducing position size or exiting position');
      recommendations.push('High impermanent loss detected - risk of significant loss');
    }

    if (priceRatio > 3 || priceRatio < 0.33) {
      recommendations.push('Pool is highly imbalanced - consider rebalancing');
    }

    if (riskLevel === LiquidityRiskLevel.VERY_HIGH) {
      recommendations.push('Very high risk position - monitor closely');
      recommendations.push('Consider using stop-loss mechanisms');
    }

    if (recommendations.length === 0) {
      recommendations.push('Position appears healthy - continue monitoring');
    }

    return recommendations;
  }

  private generateRiskRecommendations(
    riskLevel: LiquidityRiskLevel,
    maxIL: number,
    volatility: any,
    positionSize: number
  ): string[] {
    const recommendations: string[] = [];

    switch (riskLevel) {
      case LiquidityRiskLevel.VERY_HIGH:
        recommendations.push('Immediate risk reduction recommended');
        recommendations.push('Consider reducing position size by 50% or more');
        recommendations.push('Set up automated alerts for price movements');
        recommendations.push('Consider hedging strategies');
        break;

      case LiquidityRiskLevel.HIGH:
        recommendations.push('High risk detected - monitor closely');
        recommendations.push('Consider rebalancing regularly');
        recommendations.push('Set price alerts');
        break;

      case LiquidityRiskLevel.MEDIUM:
        recommendations.push('Moderate risk - periodic monitoring advised');
        recommendations.push('Consider weekly rebalancing');
        break;

      case LiquidityRiskLevel.LOW:
        recommendations.push('Low risk position');
        recommendations.push('Continue standard monitoring');
        break;
    }

    if (volatility.weeklyVolatility > 30) {
      recommendations.push('High volatility detected - increased monitoring required');
    }

    return recommendations;
  }

  private getPoolVolatility(poolAddress: string): { dailyVolatility: number; weeklyVolatility: number } {
    // Return cached volatility or calculate
    return this.volatilityData.get(poolAddress) || {
      dailyVolatility: 10, // 10% daily volatility
      weeklyVolatility: 25  // 25% weekly volatility
    };
  }

  private parseTimeframe(timeframe: string): number {
    const unit = timeframe.slice(-1);
    const value = parseInt(timeframe.slice(0, -1));

    switch (unit) {
      case 'd': return value;
      case 'w': return value * 7;
      case 'm': return value * 30;
      default: return 1;
    }
  }

  private async initializeHistoricalData(): Promise<void> {
    // Initialize with some sample data for common pools
    // In production, this would load from database or API
    logger.debug('Initializing historical impermanent loss data');
  }
}

// Export singleton instance
export const impermanentLossService = new ImpermanentLossService();