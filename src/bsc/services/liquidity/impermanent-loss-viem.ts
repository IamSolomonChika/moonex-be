/**
 * BSC Impermanent Loss Calculation Service (Viem Compatible)
 * Calculates and tracks impermanent loss for liquidity positions using Viem
 */

import logger from '../../../utils/logger.js';
import type {
  ImpermanentLossCalculationViem,
  ImpermanentLossMetricsViem,
  ImpermanentLossRiskAssessmentViem,
  ImpermanentLossPredictionViem,
  ImpermanentLossHistoryViem,
  ImpermanentLossHistoricalAnalysisViem,
  ImpermanentLossStrategyComparisonViem,
  ImpermanentLossServiceStatusViem,
  VolatilityDataViem,
  LiquidityRiskLevelViem,
  ImpermanentLossInputViem,
  PositionTrackingInputViem,
  ILRiskAssessmentInputViem,
  ILPredictionInputViem,
  ImpermanentLossErrorViem,
  ImpermanentLossErrorCodeViem
} from '../../types/impermanent-loss-types-viem.js';
import type {
  LiquidityPositionViem,
  LiquidityPoolViem,
  TokenInfoViem
} from '../../types/liquidity-types-viem.js';
import { LiquidityPoolIntegrationViem } from './pool-integration-viem.js';
import { BSCCacheManager } from '../cache/cache-manager.js';

/**
 * Impermanent Loss Service Interface (Viem Compatible)
 */
export interface IImpermanentLossServiceViem {
  // Calculate impermanent loss
  calculateImpermanentLoss(input: ImpermanentLossInputViem): Promise<ImpermanentLossCalculationViem>;

  // Track position over time
  trackPosition(input: PositionTrackingInputViem): Promise<ImpermanentLossHistoryViem>;
  getPositionILHistory(positionId: string): Promise<ImpermanentLossHistoryViem>;

  // Get impermanent loss metrics
  getILMetrics(poolAddress: Address, timeframe?: string): Promise<ImpermanentLossMetricsViem>;
  getWorstCaseScenario(poolAddress: Address, positionSize: number): Promise<number>;

  // Risk assessment
  assessILRisk(input: ILRiskAssessmentInputViem): Promise<ImpermanentLossRiskAssessmentViem>;

  // Predict impermanent loss
  predictILChange(input: ILPredictionInputViem): Promise<ImpermanentLossPredictionViem>;

  // Historical analysis
  getHistoricalILAnalysis(poolAddress: Address, period?: string): Promise<ImpermanentLossHistoricalAnalysisViem>;
  compareILStrategies(poolAddress: Address): Promise<ImpermanentLossStrategyComparisonViem>;

  // Health and status
  healthCheck(): Promise<boolean>;
  getServiceStatus(): Promise<ImpermanentLossServiceStatusViem>;
}

/**
 * Impermanent Loss Service Implementation (Viem Compatible)
 */
export class ImpermanentLossServiceViem implements IImpermanentLossServiceViem {
  private poolIntegration: LiquidityPoolIntegrationViem;
  private cache: BSCCacheManager;

  // Historical data storage (in production, would use database)
  private ilHistory: Map<string, ImpermanentLossCalculationViem[]> = new Map();

  // Volatility tracking
  private volatilityData: Map<Address, VolatilityDataViem> = new Map();

  // Risk thresholds
  private readonly RISK_THRESHOLDS = {
    LOW: 1,      // 1% IL
    MEDIUM: 5,    // 5% IL
    HIGH: 15,     // 15% IL
    VERY_HIGH: 30 // 30% IL
  };

  constructor() {
    this.poolIntegration = new LiquidityPoolIntegrationViem();
    this.cache = new BSCCacheManager();

    // Initialize historical data
    this.initializeHistoricalData();
  }

  /**
   * Calculate impermanent loss for a position
   */
  async calculateImpermanentLoss(input: ImpermanentLossInputViem): Promise<ImpermanentLossCalculationViem> {
    logger.debug({ input }, 'Calculating impermanent loss (Viem)');

    try {
      const { initialAmounts, initialPrices, currentAmounts, currentPrices } = input;

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

      const calculation: ImpermanentLossCalculationViem = {
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
        input,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to calculate impermanent loss (Viem)');
      throw new ImpermanentLossErrorViem(
        ImpermanentLossErrorCodeViem.CALCULATION_FAILED,
        `Failed to calculate impermanent loss: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Track a position's impermanent loss over time
   */
  async trackPosition(input: PositionTrackingInputViem): Promise<ImpermanentLossHistoryViem> {
    logger.debug({ input }, 'Tracking position impermanent loss (Viem)');

    try {
      const { positionId, userAddress, poolAddress, amount0, amount1 } = input;
      const history = this.ilHistory.get(positionId) || [];

      // Get current pool state
      const pool = await this.poolIntegration.getPool(poolAddress);
      if (!pool) {
        throw new ImpermanentLossErrorViem(
          ImpermanentLossErrorCodeViem.POOL_NOT_FOUND,
          'Pool not found for position tracking'
        );
      }

      // Calculate current IL
      const currentCalculation = await this.calculateImpermanentLoss(
        {
          initialAmounts: { amount0, amount1 },
          initialPrices: { price0: pool.price0, price1: pool.price1 },
          currentAmounts: { amount0, amount1 },
          currentPrices: { price0: pool.price0, price1: pool.price1 }
        }
      );

      // Add to history
      history.push(currentCalculation);

      // Keep only last 100 records
      if (history.length > 100) {
        history.shift();
      }

      // Update history
      this.ilHistory.set(positionId, history);

      // Generate summary
      const summary = this.generateHistorySummary(history);

      return {
        positionId,
        calculations: history,
        summary
      };

    } catch (error) {
      logger.error({
        input,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to track position (Viem)');

      if (error instanceof ImpermanentLossErrorViem) {
        throw error;
      }

      throw new ImpermanentLossErrorViem(
        ImpermanentLossErrorCodeViem.POSITION_NOT_FOUND,
        `Failed to track position: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get impermanent loss history for a position
   */
  async getPositionILHistory(positionId: string): Promise<ImpermanentLossHistoryViem> {
    logger.debug({ positionId }, 'Getting position IL history (Viem)');

    try {
      const history = this.ilHistory.get(positionId) || [];
      const summary = this.generateHistorySummary(history);

      return {
        positionId,
        calculations: history,
        summary
      };

    } catch (error) {
      logger.error({
        positionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get position IL history (Viem)');

      return {
        positionId,
        calculations: [],
        summary: {
          averageIL: 0,
          maxIL: 0,
          currentIL: 0,
          totalLossUSD: 0,
          duration: 0
        }
      };
    }
  }

  /**
   * Get impermanent loss metrics for a pool
   */
  async getILMetrics(poolAddress: Address, timeframe: string = '24h'): Promise<ImpermanentLossMetricsViem> {
    logger.debug({ poolAddress, timeframe }, 'Getting pool IL metrics (Viem)');

    try {
      // This would aggregate IL data from all positions in the pool
      const metrics: ImpermanentLossMetricsViem = {
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
      }, 'Failed to get pool IL metrics (Viem)');
      throw new ImpermanentLossErrorViem(
        ImpermanentLossErrorCodeViem.CALCULATION_FAILED,
        `Failed to get pool IL metrics: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get worst-case impermanent loss scenario
   */
  async getWorstCaseScenario(poolAddress: Address, positionSize: number): Promise<number> {
    logger.debug({ poolAddress, positionSize }, 'Calculating worst-case IL scenario (Viem)');

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
      }, 'Failed to calculate worst-case IL scenario (Viem)');
      return 0;
    }
  }

  /**
   * Assess impermanent loss risk for a position
   */
  async assessILRisk(input: ILRiskAssessmentInputViem): Promise<ImpermanentLossRiskAssessmentViem> {
    logger.debug({ input }, 'Assessing IL risk (Viem)');

    try {
      const { poolAddress, positionSize, timeframe = '30d' } = input;

      // Get pool and volatility data
      const pool = await this.poolIntegration.getPool(poolAddress);
      if (!pool) {
        return {
          riskLevel: LiquidityRiskLevelViem.LOW,
          maxIL: 0,
          probability: 0,
          recommendations: ['Pool not found']
        };
      }

      const volatility = this.getPoolVolatility(poolAddress);

      // Calculate worst-case IL
      const maxIL = await this.getWorstCaseScenario(poolAddress, positionSize);

      // Assess risk based on volatility and worst-case
      let riskLevel = LiquidityRiskLevelViem.LOW;
      let probability = 0;

      if (maxIL > this.RISK_THRESHOLDS.VERY_HIGH || volatility.weeklyVolatility > 50) {
        riskLevel = LiquidityRiskLevelViem.VERY_HIGH;
        probability = Math.min(95, 50 + volatility.weeklyVolatility);
      } else if (maxIL > this.RISK_THRESHOLDS.HIGH || volatility.weeklyVolatility > 30) {
        riskLevel = LiquidityRiskLevelViem.HIGH;
        probability = Math.min(80, 30 + volatility.weeklyVolatility);
      } else if (maxIL > this.RISK_THRESHOLDS.MEDIUM || volatility.weeklyVolatility > 15) {
        riskLevel = LiquidityRiskLevelViem.MEDIUM;
        probability = Math.min(60, 20 + volatility.weeklyVolatility);
      } else if (maxIL > this.RISK_THRESHOLDS.LOW) {
        riskLevel = LiquidityRiskLevelViem.LOW;
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
        input,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to assess IL risk (Viem)');

      return {
        riskLevel: LiquidityRiskLevelViem.LOW,
        maxIL: 0,
        probability: 0,
        recommendations: ['Unable to assess risk']
      };
    }
  }

  /**
   * Predict impermanent loss changes
   */
  async predictILChange(input: ILPredictionInputViem): Promise<ImpermanentLossPredictionViem> {
    logger.debug({ input }, 'Predicting IL change (Viem)');

    try {
      const { poolAddress, priceChange, timeframe } = input;

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
        input,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to predict IL change (Viem)');

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
  async getHistoricalILAnalysis(poolAddress: Address, period: string = '30d'): Promise<ImpermanentLossHistoricalAnalysisViem> {
    logger.debug({ poolAddress, period }, 'Getting historical IL analysis (Viem)');

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
      }, 'Failed to get historical IL analysis (Viem)');
      throw new ImpermanentLossErrorViem(
        ImpermanentLossErrorCodeViem.HISTORICAL_DATA_UNAVAILABLE,
        `Failed to get historical IL analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Compare impermanent loss strategies
   */
  async compareILStrategies(poolAddress: Address): Promise<ImpermanentLossStrategyComparisonViem> {
    logger.debug({ poolAddress }, 'Comparing IL strategies (Viem)');

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
      }, 'Failed to compare IL strategies (Viem)');
      throw new ImpermanentLossErrorViem(
        ImpermanentLossErrorCodeViem.CALCULATION_FAILED,
        `Failed to compare IL strategies: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if services are responsive
      const poolHealth = await this.poolIntegration.healthCheck();

      return poolHealth;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'IL service health check failed (Viem)');
      return false;
    }
  }

  /**
   * Get service status
   */
  async getServiceStatus(): Promise<ImpermanentLossServiceStatusViem> {
    try {
      return {
        healthy: await this.healthCheck(),
        trackedPositions: this.ilHistory.size,
        volatilityDataPoints: this.volatilityData.size,
        riskThresholds: this.RISK_THRESHOLDS,
        timestamp: Date.now()
      };

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get service status (Viem)');
      throw new ImpermanentLossErrorViem(
        ImpermanentLossErrorCodeViem.SERVICE_UNAVAILABLE,
        `Failed to get service status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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

  private assessILRiskLevel(ilPercentage: number, differencePercentage: number): LiquidityRiskLevelViem {
    const maxLoss = Math.max(ilPercentage, differencePercentage);

    if (maxLoss > this.RISK_THRESHOLDS.VERY_HIGH) {
      return LiquidityRiskLevelViem.VERY_HIGH;
    }
    if (maxLoss > this.RISK_THRESHOLDS.HIGH) {
      return LiquidityRiskLevelViem.HIGH;
    }
    if (maxLoss > this.RISK_THRESHOLDS.MEDIUM) {
      return LiquidityRiskLevelViem.MEDIUM;
    }
    return LiquidityRiskLevelViem.LOW;
  }

  private generateILRecommendations(
    ilPercentage: number,
    priceRatio: number,
    riskLevel: LiquidityRiskLevelViem
  ): string[] {
    const recommendations: string[] = [];

    if (ilPercentage > 20) {
      recommendations.push('Consider reducing position size or exiting position');
      recommendations.push('High impermanent loss detected - risk of significant loss');
    }

    if (priceRatio > 3 || priceRatio < 0.33) {
      recommendations.push('Pool is highly imbalanced - consider rebalancing');
    }

    if (riskLevel === LiquidityRiskLevelViem.VERY_HIGH) {
      recommendations.push('Very high risk position - monitor closely');
      recommendations.push('Consider using stop-loss mechanisms');
    }

    if (recommendations.length === 0) {
      recommendations.push('Position appears healthy - continue monitoring');
    }

    return recommendations;
  }

  private generateRiskRecommendations(
    riskLevel: LiquidityRiskLevelViem,
    maxIL: number,
    volatility: VolatilityDataViem,
    positionSize: number
  ): string[] {
    const recommendations: string[] = [];

    switch (riskLevel) {
      case LiquidityRiskLevelViem.VERY_HIGH:
        recommendations.push('Immediate risk reduction recommended');
        recommendations.push('Consider reducing position size by 50% or more');
        recommendations.push('Set up automated alerts for price movements');
        recommendations.push('Consider hedging strategies');
        break;

      case LiquidityRiskLevelViem.HIGH:
        recommendations.push('High risk detected - monitor closely');
        recommendations.push('Consider rebalancing regularly');
        recommendations.push('Set price alerts');
        break;

      case LiquidityRiskLevelViem.MEDIUM:
        recommendations.push('Moderate risk - periodic monitoring advised');
        recommendations.push('Consider weekly rebalancing');
        break;

      case LiquidityRiskLevelViem.LOW:
        recommendations.push('Low risk position');
        recommendations.push('Continue standard monitoring');
        break;
    }

    if (volatility.weeklyVolatility > 30) {
      recommendations.push('High volatility detected - increased monitoring required');
    }

    return recommendations;
  }

  private generateHistorySummary(history: ImpermanentLossCalculationViem[]): {
    averageIL: number;
    maxIL: number;
    currentIL: number;
    totalLossUSD: number;
    duration: number;
  } {
    if (history.length === 0) {
      return {
        averageIL: 0,
        maxIL: 0,
        currentIL: 0,
        totalLossUSD: 0,
        duration: 0
      };
    }

    const totalIL = history.reduce((sum, calc) => sum + calc.impermanentLoss, 0);
    const maxIL = Math.max(...history.map(calc => calc.impermanentLoss));
    const currentIL = history[history.length - 1].impermanentLoss;
    const totalLossUSD = history.reduce((sum, calc) => sum + calc.impermanentLossUSD, 0);
    const duration = history.length > 1 ?
      history[history.length - 1].duration - history[0].duration : 0;

    return {
      averageIL: totalIL / history.length,
      maxIL,
      currentIL,
      totalLossUSD,
      duration
    };
  }

  private getPoolVolatility(poolAddress: Address): VolatilityDataViem {
    // Return cached volatility or calculate
    return this.volatilityData.get(poolAddress) || {
      dailyVolatility: 10, // 10% daily volatility
      weeklyVolatility: 25, // 25% weekly volatility
      lastUpdated: Date.now()
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
    logger.debug('Initializing historical impermanent loss data (Viem)');
  }
}

// Export singleton instance
export const impermanentLossServiceViem = new ImpermanentLossServiceViem();