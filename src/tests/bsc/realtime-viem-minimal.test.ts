/**
 * Minimal Integration Tests for Real-time Features - Viem Integration
 * Tests basic instantiation and core functionality
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  Address,
  Account
} from 'viem';
import { bscTestnet } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';
import { WebSocketManagerViem } from '../../bsc/services/realtime/websocket-manager-viem.js';
import { DataStreamerViem } from '../../bsc/services/realtime/data-streamer-viem.js';
import { CacheInvalidationManagerViem } from '../../bsc/services/cache/cache-invalidation-viem.js';

// Mock logger to avoid console noise during tests
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('Real-time Features Minimal Integration - Viem', () => {
  let publicClient: any;
  let walletClient: any;
  let testAccount: Account;
  let wsManager: WebSocketManagerViem;
  let dataStreamer: DataStreamerViem;
  let cacheInvalidator: CacheInvalidationManagerViem;

  beforeEach(async () => {
    // Create test account
    testAccount = mnemonicToAccount('test test test test test test test test test test test junk');

    // Create clients
    publicClient = createPublicClient({
      chain: bscTestnet,
      transport: http('https://data-seed-prebsc-1-s1.binance.org:8545/')
    });

    walletClient = createWalletClient({
      chain: bscTestnet,
      transport: http('https://data-seed-prebsc-1-s1.binance.org:8545/'),
      account: testAccount
    });

    // Initialize services with minimal configuration
    wsManager = new WebSocketManagerViem({
      maxReconnectAttempts: 3,
      reconnectInterval: 1000,
      heartbeatInterval: 5000
    }, undefined, publicClient);

    dataStreamer = new DataStreamerViem({
      bufferSize: 100,
      batchSize: 10
    }, undefined, publicClient, wsManager);

    cacheInvalidator = new CacheInvalidationManagerViem({
      invalidationDelay: 500,
      batchSize: 5,
      maxQueueSize: 50,
      enablePriceInvalidation: true,
      enableLiquidityInvalidation: true,
      enableTransactionInvalidation: true,
      enableBlockInvalidation: true
    }, publicClient);
  });

  afterEach(async () => {
    // Cleanup services
    if (wsManager) await wsManager.shutdown();
    if (dataStreamer && typeof dataStreamer.shutdown === 'function') {
      await dataStreamer.shutdown();
    }
    if (cacheInvalidator) await cacheInvalidator.shutdown();
  });

  describe('Service Initialization', () => {
    test('should initialize WebSocket manager', () => {
      expect(wsManager).toBeDefined();
      const status = wsManager.getStatus();
      expect(status.connected).toBe(false);
    });

    test('should initialize data streamer', () => {
      expect(dataStreamer).toBeDefined();
      const metrics = dataStreamer.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalMessages).toBe(0);
    });

    test('should initialize cache invalidator', () => {
      expect(cacheInvalidator).toBeDefined();
      const health = cacheInvalidator.getHealthStatus();
      expect(health.monitoring).toBe(false);
    });

    test('should provide WebSocket metrics', () => {
      const metrics = wsManager.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('totalSubscriptions');
      expect(metrics).toHaveProperty('activeSubscriptions');
      expect(metrics).toHaveProperty('bscSpecific');
      expect(metrics).toHaveProperty('viemSpecific');
    });

    test('should provide data streamer metrics', () => {
      const metrics = dataStreamer.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('totalMessages');
      expect(metrics).toHaveProperty('successfulMessages');
      expect(metrics).toHaveProperty('bscSpecific');
      expect(metrics).toHaveProperty('viemSpecific');
    });

    test('should provide cache invalidation metrics', () => {
      const metrics = cacheInvalidator.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('totalInvalidations');
      expect(metrics).toHaveProperty('successfulInvalidations');
      expect(metrics).toHaveProperty('bscSpecific');
      expect(metrics).toHaveProperty('viemSpecific');
    });
  });

  describe('WebSocket Manager Functionality', () => {
    test('should add and remove subscriptions', () => {
      const callback = jest.fn().mockImplementation(() => Promise.resolve());
      const subscriptionId = wsManager.addSubscription({
        id: 'test-sub-1',
        type: 'newBlocks',
        callback
      });

      expect(typeof subscriptionId).toBe('string');
      expect(wsManager.getSubscriptions()).toHaveLength(1);

      const removed = wsManager.removeSubscription(subscriptionId);
      expect(removed).toBe(true);
      expect(wsManager.getSubscriptions()).toHaveLength(0);
    });

    test('should handle multiple subscriptions', () => {
      const callback1 = jest.fn().mockImplementation(() => Promise.resolve());
      const callback2 = jest.fn().mockImplementation(() => Promise.resolve());
      const callback3 = jest.fn().mockImplementation(() => Promise.resolve());

      const sub1 = wsManager.addSubscription({ id: 'test-sub-1', type: 'newBlocks', callback: callback1 });
      const sub2 = wsManager.addSubscription({ id: 'test-sub-2', type: 'logs', callback: callback2 });
      const sub3 = wsManager.addSubscription({ id: 'test-sub-3', type: 'newPendingTransactions', callback: callback3 });

      expect(wsManager.getSubscriptions()).toHaveLength(3);

      // Remove subscriptions
      wsManager.removeSubscription(sub1);
      wsManager.removeSubscription(sub2);
      wsManager.removeSubscription(sub3);

      expect(wsManager.getSubscriptions()).toHaveLength(0);
    });

    test('should provide WebSocket status', () => {
      const status = wsManager.getStatus();
      expect(status).toBeDefined();
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('reconnectCount');
      expect(status).toHaveProperty('subscriptions');
      expect(status).toHaveProperty('viemClientReady');
    });

    test('should handle invalid subscription removal', () => {
      const result = wsManager.removeSubscription('invalid-id');
      expect(result).toBe(false);
    });
  });

  describe('Data Streamer Functionality', () => {
    test('should add and remove data streams', async () => {
      // Import StreamDataType if needed for type checking
      const { StreamDataType } = await import('../../bsc/services/realtime/data-streamer-viem.js');

      const callback = jest.fn().mockImplementation(() => Promise.resolve());
      const streamId = await dataStreamer.addStream({
        type: StreamDataType.BLOCK,
        callback
      });

      expect(typeof streamId).toBe('string');

      const streamStats = dataStreamer.getStreamStats();
      expect(streamStats.activeStreams).toBe(1);

      const removed = dataStreamer.removeStream(streamId);
      expect(removed).toBe(true);

      const updatedStats = dataStreamer.getStreamStats();
      expect(updatedStats.activeStreams).toBe(0);
    });

    test('should provide stream statistics', () => {
      const streamStats = dataStreamer.getStreamStats();
      expect(streamStats).toBeDefined();
      expect(streamStats).toHaveProperty('activeStreams');
      expect(streamStats).toHaveProperty('bufferUtilization');
      expect(streamStats).toHaveProperty('messageRate');
      expect(streamStats).toHaveProperty('bscSpecific');
    });

    test('should handle invalid stream removal', () => {
      const result = dataStreamer.removeStream('invalid-id');
      expect(result).toBe(false);
    });
  });

  describe('Cache Invalidation Functionality', () => {
    test('should handle manual cache invalidation', async () => {
      const result = await cacheInvalidator.invalidate('price', {
        pattern: 'price:*',
        tags: ['price', 'update']
      });

      expect(result.success).toBe(true);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    test('should handle different invalidation types', async () => {
      const priceResult = await cacheInvalidator.invalidate('price', {
        pattern: 'price:*',
        data: { token: 'BNB' }
      });

      const liquidityResult = await cacheInvalidator.invalidate('liquidity', {
        pattern: 'liquidity:*',
        data: { pool: 'BNB/BUSD' }
      });

      const transactionResult = await cacheInvalidator.invalidate('transaction', {
        key: 'tx:0x123',
        data: { hash: '0x123' }
      });

      expect(priceResult.success).toBe(true);
      expect(liquidityResult.success).toBe(true);
      expect(transactionResult.success).toBe(true);
    });

    test('should provide health status', () => {
      const health = cacheInvalidator.getHealthStatus();
      expect(health).toBeDefined();
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('monitoring');
      expect(health).toHaveProperty('queueSize');
      expect(health).toHaveProperty('errorRate');
      expect(health).toHaveProperty('processingRate');
      expect(health).toHaveProperty('issues');
    });

    test('should handle configuration updates', () => {
      const originalConfig = cacheInvalidator.getConfig();

      cacheInvalidator.updateConfig({
        invalidationDelay: 1000,
        batchSize: 10
      });

      const updatedConfig = cacheInvalidator.getConfig();
      expect(updatedConfig.invalidationDelay).toBe(1000);
      expect(updatedConfig.batchSize).toBe(10);
      expect(updatedConfig.chainId).toBe(originalConfig.chainId); // Unchanged
    });
  });

  describe('Service Integration', () => {
    test('should handle concurrent operations across services', async () => {
      const operations = [];

      // WebSocket operations
      const wsSubId = wsManager.addSubscription({
        id: 'integration-test-1',
        type: 'newBlocks',
        callback: jest.fn().mockImplementation(() => Promise.resolve())
      });

      // Data streamer operations
      const { StreamDataType } = await import('../../bsc/services/realtime/data-streamer-viem.js');
      operations.push(
        dataStreamer.addStream({
          type: StreamDataType.BLOCK,
          callback: jest.fn().mockImplementation(() => Promise.resolve())
        })
      );

      // Cache invalidation operations
      for (let i = 0; i < 5; i++) {
        operations.push(
          cacheInvalidator.invalidate('price', {
            pattern: `price:integration${i}`,
            data: { index: i }
          })
        );
      }

      const results = await Promise.all(operations);

      // Verify operations completed successfully
      results.forEach(result => {
        if (typeof result === 'object' && result.success !== undefined) {
          expect(result.success).toBe(true);
        } else {
          expect(typeof result).toBe('string'); // Stream ID
        }
      });

      // Cleanup
      wsManager.removeSubscription(wsSubId);
    });

    test('should maintain metrics consistency across services', () => {
      const wsMetrics = wsManager.getMetrics();
      const streamMetrics = dataStreamer.getMetrics();
      const cacheMetrics = cacheInvalidator.getMetrics();

      // Verify metrics structure
      expect(wsMetrics).toHaveProperty('viemSpecific');
      expect(streamMetrics).toHaveProperty('viemSpecific');
      expect(cacheMetrics).toHaveProperty('viemSpecific');

      expect(wsMetrics).toHaveProperty('bscSpecific');
      expect(streamMetrics).toHaveProperty('bscSpecific');
      expect(cacheMetrics).toHaveProperty('bscSpecific');

      // Verify metrics are numbers where expected
      expect(typeof wsMetrics.totalSubscriptions).toBe('number');
      expect(typeof streamMetrics.totalMessages).toBe('number');
      expect(typeof cacheMetrics.totalInvalidations).toBe('number');
    });

    test('should handle service shutdown gracefully', async () => {
      // Start some operations
      await cacheInvalidator.invalidate('price', { pattern: 'price:*' });

      const { StreamDataType } = await import('../../bsc/services/realtime/data-streamer-viem.js');
      await dataStreamer.addStream({
        type: StreamDataType.BLOCK,
        callback: jest.fn().mockImplementation(() => Promise.resolve())
      });

      // Shutdown all services
      await expect(cacheInvalidator.shutdown()).resolves.toBeUndefined();
      if (typeof dataStreamer.shutdown === 'function') {
        await expect(dataStreamer.shutdown()).resolves.toBeUndefined();
      }
      await expect(wsManager.shutdown()).resolves.toBeUndefined();

      // Verify services are shut down
      expect(cacheInvalidator.getHealthStatus().monitoring).toBe(false);
      expect(wsManager.getStatus().connected).toBe(false);
    });
  });

  describe('Performance and Error Handling', () => {
    test('should handle high-frequency operations efficiently', async () => {
      const startTime = Date.now();
      const operations = [];

      // Perform many cache invalidations quickly
      for (let i = 0; i < 10; i++) {
        operations.push(
          cacheInvalidator.invalidate('price', {
            pattern: `price:perf${i}`,
            data: { index: i, timestamp: Date.now() }
          })
        );
      }

      await Promise.all(operations);
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(3000); // 3 seconds

      // Verify all operations succeeded
      const metrics = cacheInvalidator.getMetrics();
      expect(metrics.successfulInvalidations).toBeGreaterThanOrEqual(10);
    });

    test('should handle invalid parameters gracefully', async () => {
      // Test invalid invalidation type - should not crash
      try {
        await cacheInvalidator.invalidate('invalid' as any, {
          pattern: 'test:*'
        });
      } catch (error) {
        // Expected behavior
      }

      // Service should still work after error
      const result = await cacheInvalidator.invalidate('price', {
        pattern: 'price:recovery-test'
      });

      expect(result.success).toBe(true);
    });

    test('should handle error recovery', async () => {
      // Trigger an error scenario
      try {
        await cacheInvalidator.invalidate('price', {
          pattern: null as any
        });
      } catch (error) {
        // Expected
      }

      // Service should remain functional
      const health = cacheInvalidator.getHealthStatus();
      expect(health).toBeDefined();
      expect(typeof health.healthy).toBe('boolean');
    });
  });
});