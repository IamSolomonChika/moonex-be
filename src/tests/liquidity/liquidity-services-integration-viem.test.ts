/**
 * Comprehensive Liquidity Services Integration Tests (Viem)
 * Tests all liquidity services working together seamlessly
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Address } from 'viem';

// Import all Viem liquidity services
import { LiquidityServiceViem } from '../../bsc/services/liquidity/liquidity-service-viem.js';
import { LPTokenManagementViem } from '../../bsc/services/liquidity/lp-token-management-viem.js';
import { LiquidityPoolIntegrationViem } from '../../bsc/services/liquidity/pool-integration-viem.js';
import { ImpermanentLossServiceViem } from '../../bsc/services/liquidity/impermanent-loss-viem-simple.js';
import { APRCalculatorServiceViem } from '../../bsc/services/liquidity/apr-calculator-viem.js';

// Mock logger to avoid import issues
jest.mock('../../utils/logger.js', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('Liquidity Services Integration (Viem)', () => {
  let liquidityService: LiquidityServiceViem;
  let lpTokenManagement: LPTokenManagementViem;
  let poolIntegration: LiquidityPoolIntegrationViem;
  let impermanentLossService: ImpermanentLossServiceViem;
  let aprCalculator: APRCalculatorServiceViem;

  const testPoolAddress = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
  const testUserAddress = '0x1234567890123456789012345678901234567890' as Address;
  const testTokenA = '0xcafe000000000000000000000000000000000000' as Address;
  const testTokenB = '0xbeef000000000000000000000000000000000000' as Address;

  beforeEach(() => {
    liquidityService = new LiquidityServiceViem();
    lpTokenManagement = new LPTokenManagementViem();
    poolIntegration = new LiquidityPoolIntegrationViem();
    impermanentLossService = new ImpermanentLossServiceViem();
    aprCalculator = new APRCalculatorServiceViem();
  });

  describe('Complete Liquidity Flow Integration', () => {
    it('should handle complete add liquidity workflow', async () => {
      // 1. Get pool information
      const pool = await poolIntegration.getPool(testPoolAddress);
      expect(pool).toBeDefined();
      expect(pool.address).toBe(testPoolAddress);

      // 2. Check LP token balance
      const lpBalance = await lpTokenManagement.getLPBalance(testUserAddress, testPoolAddress);
      expect(lpBalance).toBeDefined();
      expect(lpBalance.userAddress).toBe(testUserAddress);
      expect(lpBalance.poolAddress).toBe(testPoolAddress);

      // 3. Get liquidity quote
      const quoteRequest = {
        tokenA: testTokenA,
        tokenB: testTokenB,
        amountA: '1000',
        amountB: '2000',
        isETH: false,
        recipient: testUserAddress,
        slippageTolerance: 50, // 0.5%
        deadlineMinutes: 20
      };

      const quote = await liquidityService.getAddLiquidityQuote(quoteRequest);
      expect(quote).toBeDefined();
      expect(quote.liquidityOut).toBeDefined();
      expect(quote.priceImpact).toBeDefined();
      expect(quote.shareOfPool).toBeDefined();

      // 4. Calculate impermanent loss for the position
      const ilInput = {
        initialAmounts: { amount0: '1000', amount1: '2000' },
        initialPrices: { price0: 1, price1: 0.5 },
        currentAmounts: { amount0: '1000', amount1: '2000' },
        currentPrices: { price0: 1.2, price1: 0.5 } // 20% price increase
      };

      const ilCalculation = await impermanentLossService.calculateImpermanentLoss(ilInput);
      expect(ilCalculation).toBeDefined();
      expect(ilCalculation.impermanentLoss).toBeGreaterThan(0);
      expect(ilCalculation.riskLevel).toBeDefined();

      // 5. Calculate APR for the pool
      const aprInput = {
        poolAddress: testPoolAddress,
        liquidity: quote.liquidityOut,
        timeframe: '30d',
        volume24h: '1500000'
      };

      const aprResult = await aprCalculator.calculatePoolAPR(aprInput);
      expect(aprResult).toBeDefined();
      expect(aprResult.apr).toBeGreaterThan(0);
      expect(aprResult.apy).toBeGreaterThanOrEqual(aprResult.apr);

      // 6. Track position performance
      const positionInput = {
        positionId: 'test-position-1',
        userAddress: testUserAddress,
        poolAddress: testPoolAddress,
        amount0: '1000',
        amount1: '2000'
      };

      const positionHistory = await impermanentLossService.trackPosition(positionInput);
      expect(positionHistory).toBeDefined();
      expect(positionHistory.positionId).toBe('test-position-1');
      expect(positionHistory.calculations.length).toBeGreaterThan(0);

      // Verify all services are healthy
      const healthChecks = await Promise.all([
        liquidityService.healthCheck(),
        lpTokenManagement.healthCheck(),
        poolIntegration.healthCheck(),
        impermanentLossService.healthCheck(),
        aprCalculator.healthCheck()
      ]);

      healthChecks.forEach((healthy, index) => {
        expect(healthy).toBe(true);
      });
    });

    it('should handle complete remove liquidity workflow', async () => {
      // 1. Get current LP balance
      const lpBalance = await lpTokenManagement.getLPBalance(testUserAddress, testPoolAddress);
      expect(lpBalance).toBeDefined();

      // 2. Get remove liquidity quote
      const removeQuoteRequest = {
        tokenA: testTokenA,
        tokenB: testTokenB,
        liquidity: lpBalance.balance,
        isETH: false,
        recipient: testUserAddress,
        slippageTolerance: 100, // 1%
        deadlineMinutes: 20
      };

      const removeQuote = await liquidityService.getRemoveLiquidityQuote(removeQuoteRequest);
      expect(removeQuote).toBeDefined();
      expect(removeQuote.amountAOut).toBeDefined();
      expect(removeQuote.amountBOut).toBeDefined();

      // 3. Calculate final impermanent loss
      const finalIL = await impermanentLossService.calculateImpermanentLoss({
        initialAmounts: { amount0: '1000', amount1: '2000' },
        initialPrices: { price0: 1, price1: 0.5 },
        currentAmounts: { amount0: removeQuote.amountAOut, amount1: removeQuote.amountBOut },
        currentPrices: { price0: 1.5, price1: 0.4 } // Final prices
      });

      expect(finalIL).toBeDefined();
      expect(finalIL.impermanentLoss).toBeGreaterThan(0);
    });
  });

  describe('Risk Assessment Integration', () => {
    it('should provide comprehensive risk analysis', async () => {
      // 1. Assess IL risk
      const ilRiskInput = {
        poolAddress: testPoolAddress,
        positionSize: 50000,
        timeframe: '30d'
      };

      const ilRisk = await impermanentLossService.assessILRisk(ilRiskInput);
      expect(ilRisk).toBeDefined();
      expect(ilRisk.riskLevel).toBeDefined();
      expect(ilRisk.maxIL).toBeGreaterThanOrEqual(0);
      expect(ilRisk.probability).toBeGreaterThanOrEqual(0);
      expect(ilRisk.recommendations.length).toBeGreaterThan(0);

      // 2. Get pool analytics for additional risk metrics
      const poolAnalytics = await poolIntegration.getPoolAnalytics(testPoolAddress, '30d');
      expect(poolAnalytics).toBeDefined();
      expect(poolAnalytics.volatility).toBeGreaterThanOrEqual(0);
      expect(poolAnalytics.apr).toBeGreaterThanOrEqual(0);

      // 3. Calculate APR risk-adjusted returns
      const aprRiskInput = {
        poolAddress: testPoolAddress,
        liquidity: '50000',
        timeframe: '30d',
        volume24h: '500000',
        impermanentLoss: ilRisk.maxIL
      };

      const aprWithRisk = await aprCalculator.calculatePoolAPR(aprRiskInput);
      expect(aprWithRisk).toBeDefined();
      expect(aprWithRisk.riskAdjustedAPR).toBeDefined();
      expect(aprWithRisk.riskAdjustedAPR).toBeLessThanOrEqual(aprWithRisk.apr);

      // 4. Generate risk recommendations
      const riskRecommendations = [];

      if (ilRisk.riskLevel === 'very_high') {
        riskRecommendations.push('Consider reducing position size due to high IL risk');
      }

      if (aprWithRisk.volatility > 30) {
        riskRecommendations.push('High volatility detected - monitor closely');
      }

      if (aprWithRisk.confidence < 70) {
        riskRecommendations.push('Low confidence in APR calculations - use caution');
      }

      expect(riskRecommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Analytics Integration', () => {
    it('should provide comprehensive performance metrics', async () => {
      // 1. Get pool performance metrics
      const poolMetrics = await poolIntegration.getPoolAnalytics(testPoolAddress, '30d');
      expect(poolMetrics).toBeDefined();
      expect(poolMetrics.apr).toBeGreaterThan(0);
      expect(poolMetrics.volume24h).toBeDefined();
      expect(poolMetrics.liquidity).toBeDefined();

      // 2. Calculate compound returns
      const compoundInput = {
        principalAmount: '10000',
        baseAPR: poolMetrics.apr,
        compoundFrequency: 'daily' as const,
        timeframe: '1y'
      };

      const compoundReturns = await aprCalculator.calculateCompoundAPR(compoundInput);
      expect(compoundReturns).toBeDefined();
      expect(compoundReturns.effectiveAPY).toBeGreaterThan(poolMetrics.apr);
      expect(compoundReturns.growthCurve.length).toBeGreaterThan(0);

      // 3. Track position performance over time
      const positionInput = {
        positionId: 'performance-test',
        userAddress: testUserAddress,
        poolAddress: testPoolAddress,
        amount0: '10000',
        amount1: '20000'
      };

      // Simulate multiple tracking events
      const trackingResults = [];
      for (let i = 0; i < 3; i++) {
        const result = await impermanentLossService.trackPosition(positionInput);
        trackingResults.push(result);
      }

      expect(trackingResults.length).toBe(3);
      expect(trackingResults[2].calculations.length).toBeGreaterThan(trackingResults[0].calculations.length);

      // 4. Generate performance summary
      const performanceSummary = {
        poolAPR: poolMetrics.apr,
        effectiveAPY: compoundReturns.effectiveAPY,
        positionIL: trackingResults[2].summary.currentIL,
        riskLevel: trackingResults[2].calculations[trackingResults[2].calculations.length - 1]?.riskLevel || 'low',
        totalReturns: compoundReturns.totalReturns,
        riskAdjustedReturns: compoundReturns.totalReturns,
        recommendations: []
      };

      if (performanceSummary.positionIL > 10) {
        performanceSummary.recommendations.push('High impermanent loss detected - consider reducing position');
      }

      if (performanceSummary.effectiveAPY > 50) {
        performanceSummary.recommendations.push('High returns achieved - consider taking profits');
      }

      expect(performanceSummary).toBeDefined();
      expect(performanceSummary.recommendations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Multi-Pool Strategy Integration', () => {
    it('should handle multiple pool analysis and comparison', async () => {
      const poolAddresses = [
        '0x1111111111111111111111111111111111111111' as Address,
        '0x2222222222222222222222222222222222222222' as Address,
        '0x3333333333333333333333333333333333333333' as Address
      ];

      // 1. Compare APRs across multiple pools
      const aprComparison = await aprCalculator.comparePoolAPRs(poolAddresses);
      expect(aprComparison).toBeDefined();
      expect(aprComparison.pools.length).toBe(3);
      expect(aprComparison.recommended).toBeDefined();

      // 2. Get analytics for all pools
      const poolAnalyticsPromises = poolAddresses.map(address =>
        poolIntegration.getPoolAnalytics(address, '30d')
      );

      const poolAnalytics = await Promise.all(poolAnalyticsPromises);
      expect(poolAnalytics.length).toBe(3);

      poolAnalytics.forEach(analytics => {
        expect(analytics).toBeDefined();
        expect(analytics.apr).toBeGreaterThan(0);
        expect(poolAddresses).toContain(analytics.address);
      });

      // 3. Validate pool health
      const poolValidations = await Promise.all(
        poolAddresses.map(address =>
          poolIntegration.validatePool(address)
        )
      );

      poolValidations.forEach(validation => {
        expect(validation).toBeDefined();
        expect(typeof validation.isValid).toBe('boolean');
        expect(Array.isArray(validation.issues)).toBe(true);
      });

      // 4. Generate multi-pool strategy recommendations
      const strategyRecommendations = {
        bestAPRPool: aprComparison.recommended.poolAddress,
        highestLiquidityPool: poolAnalytics.reduce((best, current) =>
          parseFloat(current.liquidity) > parseFloat(best.liquidity) ? current : best
        ).address,
        lowestRiskPool: poolAnalytics.reduce((safest, current) =>
          current.volatility < safest.volatility ? current : safest
        ).address,
        recommendations: []
      };

      if (aprComparison.analysis.bestAPR > 30) {
        strategyRecommendations.recommendations.push(
          `High APR opportunity in pool ${aprComparison.recommended.poolAddress.slice(0, 10)}...`
        );
      }

      const avgVolatility = poolAnalytics.reduce((sum, a) => sum + a.volatility, 0) / poolAnalytics.length;
      if (avgVolatility > 25) {
        strategyRecommendations.recommendations.push('High volatility across pools - consider diversification');
      }

      expect(strategyRecommendations).toBeDefined();
      expect(strategyRecommendations.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle service failures gracefully', async () => {
      // Test invalid pool address
      const invalidPool = '0x0000000000000000000000000000000000000000' as Address;

      const poolResult = await poolIntegration.getPool(invalidPool);
      expect(poolResult).toBeNull();

      // Test invalid amounts
      const invalidQuoteRequest = {
        tokenA: testTokenA,
        tokenB: testTokenB,
        amountA: '0', // Invalid amount
        amountB: '2000',
        isETH: false,
        recipient: testUserAddress,
        slippageTolerance: 50,
        deadlineMinutes: 20
      };

      await expect(liquidityService.getAddLiquidityQuote(invalidQuoteRequest)).rejects.toThrow();

      // Test invalid IL calculation input
      const invalidILInput = {
        initialAmounts: { amount0: '-1000', amount1: '2000' }, // Negative amount
        initialPrices: { price0: 1, price1: 0.5 },
        currentAmounts: { amount0: '1000', amount1: '2000' },
        currentPrices: { price0: 1.2, price1: 0.5 }
      };

      const ilResult = await impermanentLossService.calculateImpermanentLoss(invalidILInput);
      expect(ilResult).toBeDefined(); // Should handle gracefully

      // Test service health during errors
      const healthStatuses = await Promise.all([
        liquidityService.getServiceStatus(),
        poolIntegration.getServiceStatus(),
        impermanentLossService.getServiceStatus(),
        aprCalculator.getServiceStatus()
      ]);

      healthStatuses.forEach(status => {
        expect(status).toBeDefined();
        expect(status.healthy).toBeDefined();
      });
    });
  });

  describe('Service Health Monitoring', () => {
    it('should provide comprehensive health metrics', async () => {
      // Get health status from all services
      const serviceStatuses = await Promise.all([
        liquidityService.getServiceStatus(),
        lpTokenManagement.getServiceStatus(),
        poolIntegration.getServiceStatus(),
        impermanentLossService.getServiceStatus(),
        aprCalculator.getServiceStatus()
      ]);

      serviceStatuses.forEach((status, index) => {
        expect(status).toBeDefined();
        expect(status.healthy).toBeDefined();
        expect(status.timestamp).toBeDefined();

        const serviceNames = ['LiquidityService', 'LPTokenManagement', 'PoolIntegration', 'ImpermanentLossService', 'APRCalculator'];
        expect(serviceNames[index]).toBeDefined();
      });

      // Perform health checks
      const healthChecks = await Promise.all([
        liquidityService.healthCheck(),
        lpTokenManagement.healthCheck(),
        poolIntegration.healthCheck(),
        impermanentLossService.healthCheck(),
        aprCalculator.healthCheck()
      ]);

      healthChecks.forEach(healthy => {
        expect(typeof healthy).toBe('boolean');
      });

      // Overall system health
      const allHealthy = healthChecks.every(check => check === true);
      const servicesWithIssues = healthChecks.map((healthy, index) => ({
        service: ['LiquidityService', 'LPTokenManagement', 'PoolIntegration', 'ImpermanentLossService', 'APRCalculator'][index],
        healthy
      })).filter(service => !service.healthy);

      expect(allHealthy).toBe(true);
      expect(servicesWithIssues.length).toBe(0);
    });
  });

  describe('Data Consistency Validation', () => {
    it('should maintain data consistency across services', async () => {
      // 1. Get consistent pool information
      const poolFromIntegration = await poolIntegration.getPool(testPoolAddress);
      const poolFromLiquidityService = await liquidityService.getPool(testPoolAddress);

      if (poolFromIntegration && poolFromLiquidityService) {
        expect(poolFromIntegration.address).toBe(poolFromLiquidityService.address);
        expect(poolFromIntegration.token0.address).toBe(poolFromLiquidityService.token0.address);
        expect(poolFromIntegration.token1.address).toBe(poolFromLiquidityService.token1.address);
      }

      // 2. Validate LP balance consistency
      const lpBalance = await lpTokenManagement.getLPBalance(testUserAddress, testPoolAddress);
      const userLiquidityPositions = await liquidityService.getUserLiquidityPositions(testUserAddress);

      if (lpBalance.balance !== '0') {
        const matchingPosition = userLiquidityPositions.positions.find(
          pos => pos.poolAddress === testPoolAddress
        );
        expect(matchingPosition).toBeDefined();
      }

      // 3. Validate APR calculation consistency
      const aprInput = {
        poolAddress: testPoolAddress,
        liquidity: '1000000',
        timeframe: '30d',
        volume24h: '1500000'
      };

      const aprResult1 = await aprCalculator.calculatePoolAPR(aprInput);
      const aprResult2 = await aprCalculator.calculatePoolAPR(aprInput);

      expect(aprResult1.apr).toBe(aprResult2.apr);
      expect(aprResult1.apy).toBe(aprResult2.apy);
      expect(aprResult1.confidence).toBe(aprResult2.confidence);

      // 4. Validate impermanent loss calculation consistency
      const ilInput = {
        initialAmounts: { amount0: '1000', amount1: '2000' },
        initialPrices: { price0: 1, price1: 0.5 },
        currentAmounts: { amount0: '1000', amount1: '2000' },
        currentPrices: { price0: 1.2, price1: 0.5 }
      };

      const ilResult1 = await impermanentLossService.calculateImpermanentLoss(ilInput);
      const ilResult2 = await impermanentLossService.calculateImpermanentLoss(ilInput);

      expect(ilResult1.impermanentLoss).toBe(ilResult2.impermanentLoss);
      expect(ilResult1.riskLevel).toBe(ilResult2.riskLevel);
    });
  });
});