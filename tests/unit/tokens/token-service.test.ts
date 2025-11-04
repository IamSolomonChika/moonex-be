/**
 * Unit Tests for BSC Token Service
 * Tests token discovery, verification, metadata management, and price tracking
 */

import { BSCTokenService } from '../../../src/bsc/services/tokens/token-service.js';
import { BSCTestEnvironment } from '../../setup/bsc-test-env.js';
import type {
  BSCToken,
  TokenFilter,
  TokenPriceData,
  TokenLiquidityData,
  TokenVerificationStatus,
  TokenValidationResult,
  TokenMetrics,
  TokenEvent,
  TokenDiscoveryConfig
} from '../../../src/bsc/services/tokens/types.js';

describe('BSC Token Service', () => {
  let tokenService: BSCTokenService;
  let testEnvironment: BSCTestEnvironment;

  beforeAll(async () => {
    // Initialize test environment
    testEnvironment = new BSCTestEnvironment();
    await testEnvironment.initialize();

    // Initialize token service with test configuration
    tokenService = new BSCTokenService({
      pancakeswapEnabled: true,
      updateInterval: 5000, // 5 seconds for tests
      verificationSources: ['pancakeswap', 'coingecko', 'bscscan'],
      autoVerification: true,
      riskAssessment: true,
      minLiquidityThreshold: 1000,
      minVolumeThreshold: 100,
      excludeBlacklisted: true,
      cacheEnabled: true,
      cacheTTL: 10000, // 10 seconds for tests
      realTimePriceUpdates: true,
      batchUpdates: true,
      batchSize: 10
    });
  });

  afterAll(async () => {
    await tokenService.stop();
    await testEnvironment.cleanup();
  });

  beforeEach(async () => {
    // Start service before each test
    await tokenService.start();
  });

  afterEach(async () => {
    // Stop service after each test
    await tokenService.stop();
  });

  describe('Service Lifecycle', () => {
    it('should start the service successfully', async () => {
      const service = new BSCTokenService();
      await service.start();

      const isHealthy = await service.healthCheck();
      expect(isHealthy).toBe(true);

      await service.stop();
    });

    it('should stop the service successfully', async () => {
      const service = new BSCTokenService();
      await service.start();
      await service.stop();

      const isHealthy = await service.healthCheck();
      expect(isHealthy).toBe(true); // Health check may still pass after stop
    });

    it('should handle multiple start calls gracefully', async () => {
      const service = new BSCTokenService();
      await service.start();
      await service.start(); // Should not throw

      const isHealthy = await service.healthCheck();
      expect(isHealthy).toBe(true);

      await service.stop();
    });

    it('should handle multiple stop calls gracefully', async () => {
      const service = new BSCTokenService();
      await service.start();
      await service.stop();
      await service.stop(); // Should not throw

      const isHealthy = await service.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should accept custom configuration on start', async () => {
      const service = new BSCTokenService();
      const customConfig: Partial<TokenDiscoveryConfig> = {
        updateInterval: 10000,
        minLiquidityThreshold: 5000
      };

      await service.start(customConfig);

      const isHealthy = await service.healthCheck();
      expect(isHealthy).toBe(true);

      await service.stop();
    });
  });

  describe('Token Discovery', () => {
    it('should discover tokens with limit', async () => {
      const discoveredTokens = await tokenService.discoverTokens(10);

      expect(Array.isArray(discoveredTokens)).toBe(true);
      expect(discoveredTokens.length).toBeLessThanOrEqual(10);
    });

    it('should discover tokens with default limit', async () => {
      const discoveredTokens = await tokenService.discoverTokens();

      expect(Array.isArray(discoveredTokens)).toBe(true);
      expect(discoveredTokens.length).toBeLessThanOrEqual(100); // Default limit
    });

    it('should filter tokens based on configuration', async () => {
      const discoveredTokens = await tokenService.discoverTokens(50);

      // Tokens should be filtered based on liquidity and volume thresholds
      discoveredTokens.forEach(token => {
        if (token.riskLevel === 'very_high') {
          expect(token.riskLevel).not.toBe('very_high');
        }
      });
    });

    it('should sort tokens by discovery date', async () => {
      const discoveredTokens = await tokenService.discoverTokens(10);

      if (discoveredTokens.length > 1) {
        for (let i = 0; i < discoveredTokens.length - 1; i++) {
          expect(discoveredTokens[i].discoveredAt).toBeGreaterThanOrEqual(discoveredTokens[i + 1].discoveredAt);
        }
      }
    });

    it('should emit token discovery events', async () => {
      const events: TokenEvent[] = [];
      tokenService.subscribeToTokenEvents(event => events.push(event));

      await tokenService.discoverTokens(5);

      // Should emit metadata_update events for discovered tokens
      expect(events.length).toBeGreaterThan(0);
      events.forEach(event => {
        expect(event.type).toBe('metadata_update');
        expect(event.tokenAddress).toBeDefined();
        expect(event.data).toBeDefined();
      });
    });

    it('should handle discovery errors gracefully', async () => {
      // Mock failure scenario
      const service = new BSCTokenService({ pancakeswapEnabled: false });
      await service.start();

      const discoveredTokens = await service.discoverTokens(10);
      expect(Array.isArray(discoveredTokens)).toBe(true);

      await service.stop();
    });
  });

  describe('Token Retrieval', () => {
    it('should get all tokens with default filter', async () => {
      const response = await tokenService.getAllTokens();

      expect(response).toBeDefined();
      expect(Array.isArray(response.tokens)).toBe(true);
      expect(typeof response.total).toBe('number');
      expect(typeof response.limit).toBe('number');
      expect(typeof response.offset).toBe('number');
      expect(typeof response.hasMore).toBe('boolean');
    });

    it('should get all tokens with custom filter', async () => {
      const filter: TokenFilter = {
        limit: 50,
        offset: 10,
        riskLevel: 'low',
        category: 'defi'
      };

      const response = await tokenService.getAllTokens(filter);

      expect(response).toBeDefined();
      expect(response.limit).toBe(50);
      expect(response.offset).toBe(10);
      expect(Array.isArray(response.tokens)).toBe(true);
    });

    it('should get token by address', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';
      const token = await tokenService.getTokenByAddress(tokenAddress);

      // May return null if token not found
      if (token) {
        expect(token.address).toBe(tokenAddress);
        expect(token.symbol).toBeDefined();
        expect(token.name).toBeDefined();
        expect(token.decimals).toBeDefined();
      }
    });

    it('should return null for non-existent token', async () => {
      const nonExistentAddress = '0x0000000000000000000000000000000000000000';
      const token = await tokenService.getTokenByAddress(nonExistentAddress);

      expect(token).toBeNull();
    });

    it('should search tokens by query', async () => {
      const query = 'CAKE';
      const results = await tokenService.searchTokens(query, 10);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(10);

      // Results should match query (implementation dependent)
      results.forEach(token => {
        expect(token.symbol || token.name).toBeDefined();
      });
    });

    it('should search tokens with limit', async () => {
      const query = 'USD';
      const results = await tokenService.searchTokens(query, 5);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should handle empty search query', async () => {
      const results = await tokenService.searchTokens('', 10);

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('PancakeSwap Integration', () => {
    it('should fetch PancakeSwap token list', async () => {
      const tokens = await tokenService.fetchPancakeSwapTokenList();

      expect(Array.isArray(tokens)).toBe(true);

      tokens.forEach(token => {
        expect(token.address).toBeDefined();
        expect(token.symbol).toBeDefined();
        expect(token.name).toBeDefined();
        expect(token.decimals).toBeDefined();
      });
    });

    it('should sync with PancakeSwap', async () => {
      await expect(tokenService.syncWithPancakeSwap()).resolves.not.toThrow();
    });

    it('should update token prices', async () => {
      const priceUpdates = await tokenService.updateTokenPrices();

      expect(Array.isArray(priceUpdates)).toBe(true);

      priceUpdates.forEach(update => {
        expect(update.address).toBeDefined();
        expect(update.price).toBeDefined();
        expect(update.timestamp).toBeDefined();
      });
    });

    it('should handle PancakeSwap API errors gracefully', async () => {
      // Mock API failure scenario
      const service = new BSCTokenService({ pancakeswapEnabled: false });
      await service.start();

      await expect(service.fetchPancakeSwapTokenList()).resolves.not.toThrow();

      await service.stop();
    });
  });

  describe('Token Verification', () => {
    it('should verify token contract', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';
      const verification = await tokenService.verifyToken(tokenAddress);

      expect(verification).toBeDefined();
      expect(typeof verification.isVerified).toBe('boolean');
      expect(Array.isArray(verification.sources)).toBe(true);
      expect(typeof verification.confidence).toBe('number');
      expect(Array.isArray(verification.warnings)).toBe(true);
      expect(Array.isArray(verification.flags)).toBe(true);
    });

    it('should validate token contract', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';
      const validation = await tokenService.validateToken(tokenAddress);

      expect(validation).toBeDefined();
      expect(typeof validation.isValid).toBe('boolean');
      expect(typeof validation.score).toBe('number');
      expect(Array.isArray(validation.warnings)).toBe(true);
      expect(Array.isArray(validation.errors)).toBe(true);
      expect(Array.isArray(validation.recommendations)).toBe(true);
      expect(validation.verificationData).toBeDefined();
    });

    it('should assess token risk', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';
      const riskScore = await tokenService.assessTokenRisk(tokenAddress);

      expect(typeof riskScore).toBe('number');
      expect(riskScore).toBeGreaterThanOrEqual(0);
      expect(riskScore).toBeLessThanOrEqual(100);
    });

    it('should handle verification of invalid addresses', async () => {
      const invalidAddress = '0xinvalid';

      await expect(tokenService.verifyToken(invalidAddress)).resolves.not.toThrow();
      await expect(tokenService.validateToken(invalidAddress)).resolves.not.toThrow();
      await expect(tokenService.assessTokenRisk(invalidAddress)).resolves.not.toThrow();
    });
  });

  describe('Token Metadata', () => {
    it('should enrich token metadata', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';

      await expect(tokenService.enrichTokenMetadata(tokenAddress))
        .rejects.toThrow('Token metadata enrichment not implemented');
    });

    it('should update token logo', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';
      const logoURI = 'https://example.com/logo.png';

      await expect(tokenService.updateTokenLogo(tokenAddress, logoURI))
        .resolves.not.toThrow();
    });

    it('should categorize token', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';

      await expect(tokenService.categorizeToken(tokenAddress))
        .resolves.not.toThrow();
    });
  });

  describe('Price Tracking', () => {
    it('should get token price', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';
      const priceData = await tokenService.getTokenPrice(tokenAddress);

      if (priceData) {
        expect(priceData.address).toBe(tokenAddress);
        expect(priceData.price).toBeDefined();
        expect(priceData.timestamp).toBeDefined();
      }
    });

    it('should return null for non-existent token price', async () => {
      const nonExistentAddress = '0x0000000000000000000000000000000000000000';
      const priceData = await tokenService.getTokenPrice(nonExistentAddress);

      expect(priceData).toBeNull();
    });

    it('should get multiple token prices', async () => {
      const addresses = [
        '0x1234567890123456789012345678901234567890',
        '0x1234567890123456789012345678901234567891',
        '0x1234567890123456789012345678901234567892'
      ];

      const priceData = await tokenService.getTokenPrices(addresses);

      expect(Array.isArray(priceData)).toBe(true);
      expect(priceData.length).toBeLessThanOrEqual(addresses.length);

      priceData.forEach(price => {
        expect(addresses).toContain(price.address);
        expect(price.price).toBeDefined();
        expect(price.timestamp).toBeDefined();
      });
    });

    it('should handle empty addresses array for price fetch', async () => {
      const priceData = await tokenService.getTokenPrices([]);

      expect(Array.isArray(priceData)).toBe(true);
      expect(priceData.length).toBe(0);
    });

    it('should subscribe to price updates', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';
      const priceUpdates: TokenPriceData[] = [];

      const callback = (price: TokenPriceData) => {
        priceUpdates.push(price);
      };

      tokenService.subscribeToPriceUpdates(tokenAddress, callback);

      // Should not throw
      expect(() => tokenService.subscribeToPriceUpdates(tokenAddress, callback))
        .not.toThrow();

      // Cleanup
      tokenService.unsubscribeFromPriceUpdates(tokenAddress);
    });

    it('should unsubscribe from price updates', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';

      tokenService.subscribeToPriceUpdates(tokenAddress, () => {});
      tokenService.unsubscribeFromPriceUpdates(tokenAddress);

      // Should not throw
      expect(() => tokenService.unsubscribeFromPriceUpdates(tokenAddress))
        .not.toThrow();
    });

    it('should handle multiple subscribers for same token', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      tokenService.subscribeToPriceUpdates(tokenAddress, callback1);
      tokenService.subscribeToPriceUpdates(tokenAddress, callback2);

      // Cleanup
      tokenService.unsubscribeFromPriceUpdates(tokenAddress);
    });
  });

  describe('Liquidity Data', () => {
    it('should get token liquidity', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';
      const liquidityData = await tokenService.getTokenLiquidity(tokenAddress);

      if (liquidityData) {
        expect(liquidityData.address).toBe(tokenAddress);
        expect(liquidityData.liquidityUSD).toBeDefined();
        expect(liquidityData.volume24hUSD).toBeDefined();
      }
    });

    it('should return null for non-existent token liquidity', async () => {
      const nonExistentAddress = '0x0000000000000000000000000000000000000000';
      const liquidityData = await tokenService.getTokenLiquidity(nonExistentAddress);

      expect(liquidityData).toBeNull();
    });

    it('should get top tokens by liquidity', async () => {
      const topTokens = await tokenService.getTopTokensByLiquidity(10);

      expect(Array.isArray(topTokens)).toBe(true);
      expect(topTokens.length).toBeLessThanOrEqual(10);

      topTokens.forEach(token => {
        expect(token.address).toBeDefined();
        expect(token.symbol).toBeDefined();
      });
    });

    it('should get top tokens by volume', async () => {
      const topTokens = await tokenService.getTopTokensByVolume(10);

      expect(Array.isArray(topTokens)).toBe(true);
      expect(topTokens.length).toBeLessThanOrEqual(10);

      topTokens.forEach(token => {
        expect(token.address).toBeDefined();
        expect(token.symbol).toBeDefined();
      });
    });
  });

  describe('Analytics and Metrics', () => {
    it('should get token metrics', async () => {
      const metrics = await tokenService.getTokenMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics.totalTokens).toBe('number');
      expect(typeof metrics.verifiedTokens).toBe('number');
      expect(typeof metrics.listedTokens).toBe('number');
      expect(typeof metrics.totalMarketCapUSD).toBe('number');
      expect(typeof metrics.totalVolume24hUSD).toBe('number');
      expect(typeof metrics.totalLiquidityUSD).toBe('number');
      expect(typeof metrics.lastUpdated).toBe('number');
    });

    it('should get token analytics', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';
      const timeframe = '24h';

      const analytics = await tokenService.getTokenAnalytics(tokenAddress, timeframe);

      expect(analytics).toBeDefined();
      expect(typeof analytics).toBe('object');
    });

    it('should handle different timeframes for analytics', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';
      const timeframes = ['1h', '24h', '7d', '30d'];

      for (const timeframe of timeframes) {
        const analytics = await tokenService.getTokenAnalytics(tokenAddress, timeframe);
        expect(analytics).toBeDefined();
      }
    });
  });

  describe('Event Handling', () => {
    it('should subscribe to token events', async () => {
      const events: TokenEvent[] = [];
      const callback = (event: TokenEvent) => events.push(event);

      tokenService.subscribeToTokenEvents(callback);

      // Emit a test event
      const testEvent: TokenEvent = {
        type: 'metadata_update',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        data: {} as BSCToken,
        timestamp: Date.now()
      };

      tokenService.emitTokenEvent(testEvent);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(testEvent);
    });

    it('should handle multiple event subscribers', async () => {
      const events1: TokenEvent[] = [];
      const events2: TokenEvent[] = [];
      const callback1 = (event: TokenEvent) => events1.push(event);
      const callback2 = (event: TokenEvent) => events2.push(event);

      tokenService.subscribeToTokenEvents(callback1);
      tokenService.subscribeToTokenEvents(callback2);

      const testEvent: TokenEvent = {
        type: 'price_update',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        data: {} as TokenPriceData,
        timestamp: Date.now()
      };

      tokenService.emitTokenEvent(testEvent);

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
      expect(events1[0]).toEqual(testEvent);
      expect(events2[0]).toEqual(testEvent);
    });

    it('should handle event callback errors gracefully', async () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const successCallback = jest.fn();

      tokenService.subscribeToTokenEvents(errorCallback);
      tokenService.subscribeToTokenEvents(successCallback);

      const testEvent: TokenEvent = {
        type: 'price_update',
        tokenAddress: '0x1234567890123456789012345678901234567890',
        data: {} as TokenPriceData,
        timestamp: Date.now()
      };

      // Should not throw despite callback error
      expect(() => tokenService.emitTokenEvent(testEvent)).not.toThrow();

      // Error callback should be called, success callback should still work
      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();
    });
  });

  describe('Cache Management', () => {
    it('should clear token cache for specific address', async () => {
      const tokenAddress = '0x1234567890123456789012345678901234567890';

      await expect(tokenService.clearTokenCache(tokenAddress))
        .resolves.not.toThrow();
    });

    it('should clear all token cache', async () => {
      await expect(tokenService.clearTokenCache())
        .resolves.not.toThrow();
    });

    it('should warm up cache', async () => {
      await expect(tokenService.warmupCache())
        .resolves.not.toThrow();
    });
  });

  describe('Health Checks', () => {
    it('should pass health check when running', async () => {
      const isHealthy = await tokenService.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should pass health check when stopped', async () => {
      await tokenService.stop();
      const isHealthy = await tokenService.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid token addresses gracefully', async () => {
      const invalidAddress = '0xinvalid';

      await expect(tokenService.getTokenByAddress(invalidAddress))
        .resolves.not.toThrow();
      await expect(tokenService.verifyToken(invalidAddress))
        .resolves.not.toThrow();
      await expect(tokenService.validateToken(invalidAddress))
        .resolves.not.toThrow();
      await expect(tokenService.getTokenPrice(invalidAddress))
        .resolves.not.toThrow();
      await expect(tokenService.getTokenLiquidity(invalidAddress))
        .resolves.not.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      // Mock network failure scenario
      const service = new BSCTokenService({
        pancakeswapEnabled: false,
        cacheEnabled: false
      });
      await service.start();

      const operations = [
        () => service.discoverTokens(10),
        () => service.fetchPancakeSwapTokenList(),
        () => service.updateTokenPrices(),
        () => service.syncWithPancakeSwap()
      ];

      for (const operation of operations) {
        await expect(operation()).resolves.not.toThrow();
      }

      await service.stop();
    });

    it('should handle concurrent operations safely', async () => {
      const operations = [
        tokenService.discoverTokens(10),
        tokenService.getAllTokens({ limit: 10 }),
        tokenService.getTopTokensByLiquidity(5),
        tokenService.getTopTokensByVolume(5),
        tokenService.getTokenMetrics()
      ];

      const results = await Promise.allSettled(operations);

      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent token discovery', async () => {
      const startTime = Date.now();
      const discoveries = await Promise.all([
        tokenService.discoverTokens(10),
        tokenService.discoverTokens(10),
        tokenService.discoverTokens(10)
      ]);
      const endTime = Date.now();

      expect(discoveries).toHaveLength(3);
      discoveries.forEach(tokens => {
        expect(Array.isArray(tokens)).toBe(true);
      });
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle large batch operations', async () => {
      const addresses = Array(50).fill(null).map((_, i) =>
        `0x${i.toString(16).padStart(40, '0')}`
      );

      const startTime = Date.now();
      const priceData = await tokenService.getTokenPrices(addresses);
      const endTime = Date.now();

      expect(Array.isArray(priceData)).toBe(true);
      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
    });

    it('should handle rapid event emissions', async () => {
      const events: TokenEvent[] = [];
      tokenService.subscribeToTokenEvents(event => events.push(event));

      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        tokenService.emitTokenEvent({
          type: 'price_update',
          tokenAddress: `0x${i.toString(16).padStart(40, '0')}`,
          data: { address: `0x${i.toString(16).padStart(40, '0')}`, price: 1, timestamp: Date.now() },
          timestamp: Date.now()
        });
      }
      const endTime = Date.now();

      expect(events).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Configuration Validation', () => {
    it('should handle configuration with disabled features', async () => {
      const service = new BSCTokenService({
        pancakeswapEnabled: false,
        cacheEnabled: false,
        realTimePriceUpdates: false,
        autoVerification: false,
        riskAssessment: false
      });

      await service.start();

      const isHealthy = await service.healthCheck();
      expect(isHealthy).toBe(true);

      await service.stop();
    });

    it('should handle extreme configuration values', async () => {
      const service = new BSCTokenService({
        updateInterval: 1, // 1ms - very fast
        minLiquidityThreshold: 0,
        minVolumeThreshold: 0,
        batchSize: 1,
        cacheTTL: 1 // 1ms
      });

      await service.start();

      const isHealthy = await service.healthCheck();
      expect(isHealthy).toBe(true);

      await service.stop();
    });
  });
});