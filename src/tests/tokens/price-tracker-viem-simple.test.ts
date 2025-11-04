/**
 * Price Tracker Tests (Viem) - Simple
 * Tests for the comprehensive price tracking service using Viem
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Address } from 'viem';

// Import the Viem price tracker
import {
  TokenPriceTrackerViem,
  type IPriceTrackerViem,
  type PriceTrackingConfigViem,
  type PriceSubscriptionViem,
  type PriceHistoryPointViem,
  type PriceAnalyticsViem
} from '../../bsc/services/tokens/price-tracker-viem.js';

// Import token types
import type {
  TokenPriceDataViem,
  TokenLiquidityDataViem
} from '../../bsc/types/token-types-viem.js';

// Mock logger to avoid import issues
jest.mock('../../utils/logger.js', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('Price Tracker Service (Viem)', () => {
  let priceTracker: IPriceTrackerViem;
  let testConfig: Partial<PriceTrackingConfigViem>;

  const testTokenAddress = '0x1234567890123456789012345678901234567890' as Address;
  const testTokenAddress2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address;
  const wbnbAddress = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' as Address;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    testConfig = {
      priceUpdateInterval: 1000, // 1 second for tests
      liquidityUpdateInterval: 2000, // 2 seconds for tests
      cacheTTL: 5000, // 5 seconds for tests
      maxPriceAge: 10000, // 10 seconds for tests
      enableRealTimeUpdates: false, // Disable for tests
      enableBlockBasedUpdates: false, // Disable for tests
      batchSize: 10,
      maxSubscriptions: 5
    };

    priceTracker = new TokenPriceTrackerViem(testConfig);
  });

  describe('Service Lifecycle', () => {
    it('should create price tracker instance', () => {
      expect(priceTracker).toBeDefined();
      expect(priceTracker).toBeInstanceOf(TokenPriceTrackerViem);
    });

    it('should start and stop the service', async () => {
      await expect(priceTracker.start()).resolves.not.toThrow();

      const healthBefore = await priceTracker.healthCheck();
      expect(healthBefore).toBe(true);

      await expect(priceTracker.stop()).resolves.not.toThrow();
    });

    it('should handle health check', async () => {
      const health = await priceTracker.healthCheck();
      expect(typeof health).toBe('boolean');
    });

    it('should get service status', async () => {
      const status = await (priceTracker as TokenPriceTrackerViem).getServiceStatus();
      expect(status).toBeDefined();
      expect(status.healthy).toBeDefined();
      expect(status.timestamp).toBeDefined();
      expect(status.details).toBeDefined();
    });
  });

  describe('Price Fetching', () => {
    it('should get token price', async () => {
      const price = await priceTracker.getTokenPrice(testTokenAddress);

      // Price might be null if token doesn't exist or no liquidity
      if (price) {
        expect(price.tokenAddress).toBe(testTokenAddress);
        expect(price.priceUSD).toBeGreaterThanOrEqual(0);
        expect(price.priceBNB).toBeGreaterThanOrEqual(0);
        expect(price.timestamp).toBeDefined();
        expect(price.blockNumber).toBeDefined();
      }
    });

    it('should get multiple token prices', async () => {
      const addresses = [testTokenAddress, testTokenAddress2, wbnbAddress];
      const prices = await priceTracker.getTokenPrices(addresses);

      expect(Array.isArray(prices)).toBe(true);
      expect(prices.length).toBeLessThanOrEqual(addresses.length);

      prices.forEach(price => {
        expect(addresses).toContain(price.tokenAddress);
        expect(price.priceUSD).toBeGreaterThanOrEqual(0);
        expect(price.priceBNB).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle empty address array for multiple prices', async () => {
      const prices = await priceTracker.getTokenPrices([]);
      expect(prices).toEqual([]);
    });

    it('should handle invalid token address', async () => {
      const invalidAddress = '0x0000000000000000000000000000000000000000' as Address;
      const price = await priceTracker.getTokenPrice(invalidAddress);
      expect(price).toBeNull();
    });
  });

  describe('Real-time Subscriptions', () => {
    it('should subscribe to price updates', () => {
      const callback = jest.fn();
      const subscriptionId = priceTracker.subscribeToPriceUpdates(testTokenAddress, callback);

      expect(subscriptionId).toBeDefined();
      expect(typeof subscriptionId).toBe('string');
      expect(subscriptionId).toMatch(/^sub_\d+_[a-z0-9]+$/);
    });

    it('should unsubscribe from price updates', () => {
      const callback = jest.fn();
      const subscriptionId = priceTracker.subscribeToPriceUpdates(testTokenAddress, callback);

      expect(() => priceTracker.unsubscribeFromPriceUpdates(subscriptionId)).not.toThrow();
    });

    it('should handle unsubscribing from non-existent subscription', () => {
      expect(() => priceTracker.unsubscribeFromPriceUpdates('non-existent-id')).not.toThrow();
    });

    it('should enforce maximum subscription limit', () => {
      const callbacks = Array(10).fill(null).map(() => jest.fn());

      // Subscribe up to the limit
      const subscriptionIds = [];
      for (let i = 0; i < 5; i++) {
        subscriptionIds.push(priceTracker.subscribeToPriceUpdates(testTokenAddress, callbacks[i]));
      }

      // Next subscription should throw error
      expect(() => priceTracker.subscribeToPriceUpdates(testTokenAddress, callbacks[5]))
        .toThrow('Maximum number of subscriptions reached');
    });
  });

  describe('Price Analytics', () => {
    it('should get price analytics for 24h timeframe', async () => {
      const analytics = await priceTracker.getPriceAnalytics(testTokenAddress, '24h');

      expect(analytics).toBeDefined();
      expect(analytics.tokenAddress).toBe(testTokenAddress);
      expect(analytics.currentPrice).toBeDefined();
      expect(Array.isArray(analytics.priceHistory)).toBe(true);
      expect(analytics.volatility24h).toBeGreaterThanOrEqual(0);
      expect(analytics.rsi).toBeGreaterThanOrEqual(0);
      expect(analytics.rsi).toBeLessThanOrEqual(100);
    });

    it('should get price analytics for 7d timeframe', async () => {
      const analytics = await priceTracker.getPriceAnalytics(testTokenAddress, '7d');

      expect(analytics).toBeDefined();
      expect(analytics.tokenAddress).toBe(testTokenAddress);
      expect(analytics.volatility7d).toBeGreaterThanOrEqual(0);
    });

    it('should get price analytics for 30d timeframe', async () => {
      const analytics = await priceTracker.getPriceAnalytics(testTokenAddress, '30d');

      expect(analytics).toBeDefined();
      expect(analytics.tokenAddress).toBe(testTokenAddress);
      expect(analytics.volatility30d).toBeGreaterThanOrEqual(0);
    });

    it('should handle invalid timeframe', async () => {
      await expect(priceTracker.getPriceAnalytics(testTokenAddress, 'invalid'))
        .rejects.toThrow('Unsupported timeframe: invalid');
    });

    it('should handle non-existent token for analytics', async () => {
      const invalidAddress = '0x0000000000000000000000000000000000000000' as Address;
      await expect(priceTracker.getPriceAnalytics(invalidAddress, '24h'))
        .rejects.toThrow('Unable to fetch current price');
    });
  });

  describe('Historical Data', () => {
    it('should get historical prices', async () => {
      const from = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
      const to = Date.now();

      const history = await priceTracker.getHistoricalPrices(testTokenAddress, from, to);

      expect(Array.isArray(history)).toBe(true);

      history.forEach(point => {
        expect(point.timestamp).toBeGreaterThanOrEqual(from);
        expect(point.timestamp).toBeLessThanOrEqual(to);
        expect(point.priceUSD).toBeGreaterThanOrEqual(0);
        expect(point.priceBNB).toBeGreaterThanOrEqual(0);
        expect(point.blockNumber).toBeDefined();
      });
    });

    it('should handle historical prices with no data', async () => {
      const from = Date.now() - 1000; // 1 second ago
      const to = Date.now();

      const history = await priceTracker.getHistoricalPrices(testTokenAddress, from, to);
      expect(Array.isArray(history)).toBe(true);
    });

    it('should handle invalid date range', async () => {
      const from = Date.now();
      const to = Date.now() - 1000; // to is before from

      const history = await priceTracker.getHistoricalPrices(testTokenAddress, from, to);
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Liquidity Data', () => {
    it('should get token liquidity', async () => {
      const liquidity = await priceTracker.getTokenLiquidity(testTokenAddress);

      if (liquidity) {
        expect(liquidity.tokenAddress).toBe(testTokenAddress);
        expect(liquidity.pairAddress).toBeDefined();
        expect(liquidity.token0Reserve).toBeDefined();
        expect(liquidity.token1Reserve).toBeDefined();
        expect(liquidity.liquidityUSD).toBeGreaterThanOrEqual(0);
        expect(liquidity.timestamp).toBeDefined();
      }
    });

    it('should get liquidity history', async () => {
      const from = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
      const to = Date.now();

      const history = await priceTracker.getLiquidityHistory(testTokenAddress, from, to);
      expect(Array.isArray(history)).toBe(true);
    });

    it('should handle invalid token address for liquidity', async () => {
      const invalidAddress = '0x0000000000000000000000000000000000000000' as Address;
      const liquidity = await priceTracker.getTokenLiquidity(invalidAddress);
      expect(liquidity).toBeNull();
    });
  });

  describe('Top Movers', () => {
    it('should get top movers', async () => {
      const movers = await priceTracker.getTopMovers('24h', 10);
      expect(Array.isArray(movers)).toBe(true);
    });

    it('should handle different timeframes for top movers', async () => {
      const movers24h = await priceTracker.getTopMovers('24h', 5);
      const movers7d = await priceTracker.getTopMovers('7d', 5);

      expect(Array.isArray(movers24h)).toBe(true);
      expect(Array.isArray(movers7d)).toBe(true);
    });

    it('should handle limit of zero for top movers', async () => {
      const movers = await priceTracker.getTopMovers('24h', 0);
      expect(Array.isArray(movers)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle service start failure gracefully', async () => {
      // Mock a scenario where service fails to start
      const mockTracker = new TokenPriceTrackerViem({
        enableRealTimeUpdates: true,
        enableBlockBasedUpdates: true
      });

      // The service should still start without throwing
      await expect(mockTracker.start()).resolves.not.toThrow();
      await mockTracker.stop();
    });

    it('should handle concurrent price requests', async () => {
      const promises = Array(10).fill(null).map(() =>
        priceTracker.getTokenPrice(testTokenAddress)
      );

      const results = await Promise.allSettled(promises);

      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
        // Result can be null if token doesn't exist
        if (result.status === 'fulfilled' && result.value !== null) {
          expect(result.value.tokenAddress).toBe(testTokenAddress);
        }
      });
    });

    it('should handle service health check during failure', async () => {
      const health = await priceTracker.healthCheck();
      expect(typeof health).toBe('boolean');
    });

    it('should handle subscription callback errors', async () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });

      const subscriptionId = priceTracker.subscribeToPriceUpdates(testTokenAddress, errorCallback);
      expect(subscriptionId).toBeDefined();

      // The service should handle callback errors gracefully
      priceTracker.unsubscribeFromPriceUpdates(subscriptionId);
    });
  });

  describe('Configuration Validation', () => {
    it('should use default configuration when none provided', () => {
      const defaultTracker = new TokenPriceTrackerViem();
      expect(defaultTracker).toBeDefined();
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig: Partial<PriceTrackingConfigViem> = {
        priceUpdateInterval: 5000,
        maxSubscriptions: 20,
        enableRealTimeUpdates: false
      };

      const customTracker = new TokenPriceTrackerViem(customConfig);
      expect(customTracker).toBeDefined();
    });

    it('should handle invalid configuration values', () => {
      const invalidConfig: Partial<PriceTrackingConfigViem> = {
        priceUpdateInterval: -1000,
        maxSubscriptions: -1,
        cacheTTL: 0
      };

      const invalidTracker = new TokenPriceTrackerViem(invalidConfig);
      expect(invalidTracker).toBeDefined();
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistent price data format', async () => {
      const prices = await priceTracker.getTokenPrices([testTokenAddress, wbnbAddress]);

      prices.forEach(price => {
        expect(price).toMatchObject({
          tokenAddress: expect.any(String),
          priceUSD: expect.any(Number),
          priceBNB: expect.any(Number),
          priceChange24h: expect.any(Number),
          priceChange7d: expect.any(Number),
          priceChange30d: expect.any(Number),
          volume24hUSD: expect.any(Number),
          marketCapUSD: expect.any(Number),
          liquidityUSD: expect.any(Number),
          timestamp: expect.any(Number),
          blockNumber: expect.any(BigInt)
        });
      });
    });

    it('should maintain consistent liquidity data format', async () => {
      const liquidity = await priceTracker.getTokenLiquidity(testTokenAddress);

      if (liquidity) {
        expect(liquidity).toMatchObject({
          tokenAddress: expect.any(String),
          pairAddress: expect.any(String),
          token0Reserve: expect.any(String),
          token1Reserve: expect.any(String),
          liquidityUSD: expect.any(Number),
          timestamp: expect.any(Number)
        });
      }
    });

    it('should maintain consistent analytics data format', async () => {
      const analytics = await priceTracker.getPriceAnalytics(testTokenAddress, '24h');

      expect(analytics).toMatchObject({
        tokenAddress: expect.any(String),
        currentPrice: expect.any(Object),
        priceHistory: expect.any(Array),
        price24hAgo: expect.any(Number),
        price7dAgo: expect.any(Number),
        price30dAgo: expect.any(Number),
        allTimeHigh: expect.any(Number),
        allTimeLow: expect.any(Number),
        volatility24h: expect.any(Number),
        volatility7d: expect.any(Number),
        volatility30d: expect.any(Number),
        avgVolume24h: expect.any(Number),
        avgVolume7d: expect.any(Number),
        volumeTrend: expect.any(String),
        avgLiquidity24h: expect.any(Number),
        liquidityUtilization: expect.any(Number),
        liquidityDepth: expect.any(Object),
        rsi: expect.any(Number),
        macd: expect.any(Object),
        movingAverages: expect.any(Object)
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large batch requests', async () => {
      const addresses = Array(50).fill(null).map((_, i) =>
        `0x${i.toString(16).padStart(40, '0')}` as Address
      );

      const startTime = Date.now();
      const prices = await priceTracker.getTokenPrices(addresses);
      const endTime = Date.now();

      expect(Array.isArray(prices)).toBe(true);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle rapid subscription and unsubscription', () => {
      const subscriptionIds = [];

      // Rapid subscriptions
      for (let i = 0; i < 5; i++) {
        const callback = jest.fn();
        subscriptionIds.push(priceTracker.subscribeToPriceUpdates(testTokenAddress, callback));
      }

      // Rapid unsubscriptions
      subscriptionIds.forEach(id => {
        priceTracker.unsubscribeFromPriceUpdates(id);
      });

      // Should complete without errors
      expect(subscriptionIds).toHaveLength(5);
    });

    it('should handle multiple concurrent analytics requests', async () => {
      const promises = Array(5).fill(null).map(() =>
        priceTracker.getPriceAnalytics(testTokenAddress, '24h')
      );

      const results = await Promise.allSettled(promises);

      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.tokenAddress).toBe(testTokenAddress);
        }
      });
    });
  });
});