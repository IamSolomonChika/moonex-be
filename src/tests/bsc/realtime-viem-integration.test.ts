/**
 * Integration Tests for Real-time Features - Viem Integration
 * Tests WebSocket connections, data streaming, and cache invalidation
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

describe('Real-time Features Integration - Viem', () => {
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

    // Initialize services with test configuration
    wsManager = new WebSocketManagerViem({
      maxReconnectAttempts: 3,
      reconnectInterval: 1000,
      heartbeatInterval: 5000
    }, undefined, publicClient);

    dataStreamer = new DataStreamerViem({
      bufferSize: 100,
      batchSize: 10,
      processingInterval: 1000
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
    if (dataStreamer) await dataStreamer.shutdown();
    if (cacheInvalidator) await cacheInvalidator.shutdown();
  });

  describe('WebSocket Manager Integration', () => {
    test('should initialize WebSocket manager', () => {
      expect(wsManager).toBeDefined();
      expect(wsManager.getStatus().connected).toBe(false);
    });

    test('should add and remove subscriptions', () => {
      const callback = jest.fn();
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
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

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

    test('should provide WebSocket metrics', () => {
      const metrics = wsManager.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('totalSubscriptions');
      expect(metrics).toHaveProperty('activeSubscriptions');
      expect(metrics).toHaveProperty('connectionAttempts');
      expect(metrics).toHaveProperty('reconnectionCount');
      expect(metrics).toHaveProperty('bscSpecific');
      expect(metrics).toHaveProperty('viemSpecific');
    });

    test('should get WebSocket status', () => {
      const status = wsManager.getStatus();
      expect(status).toBeDefined();
      expect(status).toHaveProperty('isConnected');
      expect(status).toHaveProperty('isConnecting');
      expect(status).toHaveProperty('lastError');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('subscriptionCount');
    });

    test('should handle invalid subscription removal', () => {
      const result = wsManager.removeSubscription('invalid-id');
      expect(result).toBe(false);
    });
  });

  describe('Data Streamer Integration', () => {
    test('should initialize data streamer', () => {
      expect(dataStreamer).toBeDefined();
      expect(dataStreamer.getMetrics().isStreaming).toBe(false);
    });

    test('should add and remove data streams', async () => {
      const callback = jest.fn();
      const streamId = await dataStreamer.addStream({
        type: 'blocks',
        callback
      });

      expect(typeof streamId).toBe('string');
      expect(dataStreamer.getMetrics().activeStreams).toBe(1);

      const removed = dataStreamer.removeStream(streamId);
      expect(removed).toBe(true);
      expect(dataStreamer.getMetrics().activeStreams).toBe(0);
    });

    test('should handle multiple data streams', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      const stream1 = await dataStreamer.addStream({ type: 'blocks', callback: callback1 });
      const stream2 = await dataStreamer.addStream({ type: 'logs', callback: callback2 });
      const stream3 = await dataStreamer.addStream({ type: 'transactions', callback: callback3 });

      expect(dataStreamer.getMetrics().activeStreams).toBe(3);

      // Remove streams
      dataStreamer.removeStream(stream1);
      dataStreamer.removeStream(stream2);
      dataStreamer.removeStream(stream3);

      expect(dataStreamer.getMetrics().activeStreams).toBe(0);
    });

    test('should provide data streamer metrics', () => {
      const metrics = dataStreamer.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('isStreaming');
      expect(metrics).toHaveProperty('activeStreams');
      expect(metrics).toHaveProperty('totalDataProcessed');
      expect(metrics).toHaveProperty('bufferSize');
      expect(metrics).toHaveProperty('bscSpecific');
      expect(metrics).toHaveProperty('viemSpecific');
    });

    test('should handle stream data processing', async () => {
      const processedData: any[] = [];
      const callback = jest.fn((data) => {
        processedData.push(data);
      });

      const streamId = await dataStreamer.addStream({
        type: 'blocks',
        callback,
        priority: 1
      });

      // Simulate data processing
      expect(dataStreamer.getMetrics().activeStreams).toBe(1);

      dataStreamer.removeStream(streamId);
      expect(dataStreamer.getMetrics().activeStreams).toBe(0);
    });

    test('should handle invalid stream removal', () => {
      const result = dataStreamer.removeStream('invalid-id');
      expect(result).toBe(false);
    });
  });

  describe('Cache Invalidation Integration', () => {
    test('should initialize cache invalidator', () => {
      expect(cacheInvalidator).toBeDefined();
      expect(cacheInvalidator.getHealthStatus().monitoring).toBe(false);
    });

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

    test('should provide cache invalidation metrics', () => {
      const metrics = cacheInvalidator.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('totalInvalidations');
      expect(metrics).toHaveProperty('successfulInvalidations');
      expect(metrics).toHaveProperty('failedInvalidations');
      expect(metrics).toHaveProperty('bscSpecific');
      expect(metrics).toHaveProperty('viemSpecific');
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

  describe('Service Integration Tests', () => {
    test('should handle cross-service communication', async () => {
      // Set up event listeners for cross-service communication
      const invalidationEvents: any[] = [];
      const streamEvents: any[] = [];

      cacheInvalidator.on('invalidate', (event) => {
        invalidationEvents.push(event);
      });

      dataStreamer.on('data', (event) => {
        streamEvents.push(event);
      });

      // Trigger manual invalidation
      await cacheInvalidator.invalidate('price', {
        pattern: 'price:*',
        data: { source: 'integration-test' }
      });

      // Verify event propagation
      expect(invalidationEvents.length).toBeGreaterThan(0);
      expect(invalidationEvents[0]).toHaveProperty('type');
      expect(invalidationEvents[0]).toHaveProperty('data');
    });

    test('should handle concurrent operations', async () => {
      const operations = [];

      // Start multiple concurrent operations
      for (let i = 0; i < 5; i++) {
        operations.push(
          cacheInvalidator.invalidate('price', {
            pattern: `price:test${i}`,
            data: { index: i }
          })
        );

        operations.push(
          dataStreamer.addStream({
            type: 'blocks',
            callback: jest.fn(),
            priority: i
          })
        );
      }

      const results = await Promise.all(operations);

      // Verify all operations completed successfully
      const invalidationResults = results.slice(0, 5);
      const streamResults = results.slice(5);

      invalidationResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      streamResults.forEach(streamId => {
        expect(typeof streamId).toBe('string');
      });
    });

    test('should handle service shutdown gracefully', async () => {
      // Start some operations
      await cacheInvalidator.invalidate('price', { pattern: 'price:*' });
      await dataStreamer.addStream({ type: 'blocks', callback: jest.fn() });

      // Shutdown all services
      await expect(cacheInvalidator.shutdown()).resolves.toBeUndefined();
      await expect(dataStreamer.shutdown()).resolves.toBeUndefined();
      await expect(wsManager.shutdown()).resolves.toBeUndefined();

      // Verify services are shut down
      expect(cacheInvalidator.getHealthStatus().monitoring).toBe(false);
      expect(dataStreamer.getMetrics().isStreaming).toBe(false);
      expect(wsManager.getStatus().isConnected).toBe(false);
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
      expect(typeof streamMetrics.totalDataProcessed).toBe('number');
      expect(typeof cacheMetrics.totalInvalidations).toBe('number');
    });

    test('should handle error recovery across services', async () => {
      // Simulate error conditions
      const invalidCallback = () => {
        throw new Error('Test error');
      };

      // Add subscription with error-prone callback
      const subscriptionId = wsManager.addSubscription({
        type: 'newBlocks',
        callback: invalidCallback
      });

      // Add stream with error-prone callback
      const streamId = await dataStreamer.addStream({
        type: 'blocks',
        callback: invalidCallback
      });

      // Services should handle errors gracefully
      expect(() => {
        wsManager.getStatus();
      }).not.toThrow();

      expect(() => {
        dataStreamer.getMetrics();
      }).not.toThrow();

      expect(() => {
        cacheInvalidator.getHealthStatus();
      }).not.toThrow();

      // Cleanup
      wsManager.removeSubscription(subscriptionId);
      dataStreamer.removeStream(streamId);
    });
  });

  describe('Performance Tests', () => {
    test('should handle high-frequency operations efficiently', async () => {
      const startTime = Date.now();
      const operations = [];

      // Perform many operations quickly
      for (let i = 0; i < 20; i++) {
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
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds

      // Verify all operations succeeded
      const metrics = cacheInvalidator.getMetrics();
      expect(metrics.successfulInvalidations).toBeGreaterThanOrEqual(20);
    });

    test('should maintain performance under load', async () => {
      const metricsBefore = {
        cache: cacheInvalidator.getMetrics(),
        streamer: dataStreamer.getMetrics(),
        ws: wsManager.getMetrics()
      };

      // Add load
      const loadOperations = [];
      for (let i = 0; i < 10; i++) {
        loadOperations.push(
          cacheInvalidator.invalidate('price', { pattern: `price:load${i}` })
        );
        loadOperations.push(
          dataStreamer.addStream({
            type: 'blocks',
            callback: jest.fn(),
            priority: i
          })
        );
      }

      await Promise.all(loadOperations);

      const metricsAfter = {
        cache: cacheInvalidator.getMetrics(),
        streamer: dataStreamer.getMetrics(),
        ws: wsManager.getMetrics()
      };

      // Verify metrics updated correctly
      expect(metricsAfter.cache.totalInvalidations).toBeGreaterThan(metricsBefore.cache.totalInvalidations);
      expect(metricsAfter.streamer.activeStreams).toBeGreaterThan(metricsBefore.streamer.activeStreams);

      // Verify performance metrics are reasonable
      expect(metricsAfter.cache.averageProcessingTime).toBeGreaterThan(0);
      expect(metricsAfter.cache.errorRate).toBeLessThanOrEqual(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid parameters gracefully', async () => {
      // Test invalid invalidation type
      const result = await cacheInvalidator.invalidate('invalid' as any, {
        pattern: 'test:*'
      });

      expect(result).toBeDefined();

      // Test empty pattern
      const emptyResult = await cacheInvalidator.invalidate('price', {
        pattern: '',
        data: null
      });

      expect(emptyResult).toBeDefined();
    });

    test('should handle service errors without crashing', async () => {
      // Test with null callbacks
      const subscriptionId = wsManager.addSubscription({
        type: 'newBlocks',
        callback: null as any
      });

      expect(typeof subscriptionId).toBe('string');

      // Test with invalid stream types
      const streamId = await dataStreamer.addStream({
        type: 'invalid' as any,
        callback: jest.fn()
      });

      expect(typeof streamId).toBe('string');

      // Cleanup
      wsManager.removeSubscription(subscriptionId);
      dataStreamer.removeStream(streamId);
    });

    test('should maintain functionality after errors', async () => {
      // Trigger an error
      try {
        await cacheInvalidator.invalidate('price', {
          pattern: null as any
        });
      } catch (error) {
        // Expected
      }

      // Service should still work
      const result = await cacheInvalidator.invalidate('price', {
        pattern: 'price:recovery-test'
      });

      expect(result.success).toBe(true);
    });
  });
});