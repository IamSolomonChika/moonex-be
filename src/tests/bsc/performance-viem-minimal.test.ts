/**
 * Minimal Performance Tests for Viem Integration
 * Tests basic instantiation and core functionality
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
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
import { RealTimeUpdaterViem } from '../../../bsc/services/performance/realtime-updater-viem.js';
import { AdvancedBatchProcessorViem, BatchOperationTypeViem } from '../../../bsc/services/performance/batch-processor-viem.js';
import { BSCTransactionOptimizerViem } from '../../../bsc/services/performance/transaction-optimizer-viem.js';

describe('Performance Optimization - Viem Integration (Minimal)', () => {
  let publicClient: any;
  let walletClient: any;
  let testAccount: Account;
  let realTimeUpdater: RealTimeUpdaterViem;
  let batchProcessor: AdvancedBatchProcessorViem;
  let transactionOptimizer: BSCTransactionOptimizerViem;

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

    // Initialize services with default configuration
    realTimeUpdater = new RealTimeUpdaterViem(publicClient);
    batchProcessor = new AdvancedBatchProcessorViem(publicClient, undefined, undefined, walletClient);
    transactionOptimizer = new BSCTransactionOptimizerViem(publicClient, undefined, undefined, walletClient);
  });

  afterEach(async () => {
    // Cleanup services
    if (realTimeUpdater) await realTimeUpdater.shutdown();
    if (batchProcessor) await batchProcessor.shutdown();
    if (transactionOptimizer) await transactionOptimizer.shutdown();
  });

  describe('Service Initialization', () => {
    test('should initialize real-time updater', () => {
      expect(realTimeUpdater).toBeDefined();
    });

    test('should initialize batch processor', () => {
      expect(batchProcessor).toBeDefined();
    });

    test('should initialize transaction optimizer', () => {
      expect(transactionOptimizer).toBeDefined();
    });
  });

  describe('Basic Functionality', () => {
    test('should provide metrics from real-time updater', () => {
      const metrics = realTimeUpdater.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('totalUpdates');
      expect(metrics).toHaveProperty('successfulUpdates');
      expect(metrics).toHaveProperty('failedUpdates');
      expect(metrics).toHaveProperty('viemSpecific');
      expect(metrics).toHaveProperty('bscSpecific');
    });

    test('should provide metrics from batch processor', () => {
      const metrics = batchProcessor.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('totalBatches');
      expect(metrics).toHaveProperty('successfulBatches');
      expect(metrics).toHaveProperty('failedBatches');
      expect(metrics).toHaveProperty('viemSpecific');
      expect(metrics).toHaveProperty('bscSpecific');
    });

    test('should provide metrics from transaction optimizer', () => {
      const metrics = transactionOptimizer.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('totalTransactions');
      expect(metrics).toHaveProperty('successfulTransactions');
      expect(metrics).toHaveProperty('failedTransactions');
      expect(metrics).toHaveProperty('viemSpecific');
      expect(metrics).toHaveProperty('bscSpecific');
    });

    test('should subscribe and unsubscribe from real-time updates', () => {
      const callback = () => {}; // Simple callback
      const subscriptionId = realTimeUpdater.subscribe('block', callback);

      expect(typeof subscriptionId).toBe('string');

      // Should be able to unsubscribe
      const unsubscribed = realTimeUpdater.unsubscribe(subscriptionId);
      expect(unsubscribed).toBe(true);
    });

    test('should submit operations to batch processor', async () => {
      const operationId = await batchProcessor.submitOperation(
        BatchOperationTypeViem.APPROVE,
        {
          token: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf',
          spender: testAccount.address,
          amount: parseEther('1')
        }
      );

      expect(typeof operationId).toBe('string');
      expect(operationId).toMatch(/^op_\d+_[a-z0-9]+$/);
    });

    test('should get processing stats from batch processor', () => {
      const stats = batchProcessor.getProcessingStats();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('pendingOperations');
      expect(stats).toHaveProperty('processingBatches');
      expect(stats).toHaveProperty('queueLength');
      expect(stats).toHaveProperty('bscSpecific');
    });

    test('should get network stats from transaction optimizer', () => {
      const networkStats = transactionOptimizer.getNetworkStats();
      expect(networkStats).toBeDefined();
      expect(networkStats).toHaveProperty('averageBlockTime');
      expect(networkStats).toHaveProperty('averageGasPrice');
      expect(networkStats).toHaveProperty('congestionLevel');
    });

    test('should get pending transaction count from transaction optimizer', () => {
      const count = transactionOptimizer.getPendingTransactionCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Viem Integration Features', () => {
    test('should have BSC-specific metrics', () => {
      const batchMetrics = batchProcessor.getMetrics();
      expect(batchMetrics.bscSpecific).toBeDefined();
      expect(batchMetrics.bscSpecific).toHaveProperty('totalBnbSpent');
      expect(batchMetrics.bscSpecific).toHaveProperty('pancakeSwapOptimizations');

      const txMetrics = transactionOptimizer.getMetrics();
      expect(txMetrics.bscSpecific).toBeDefined();
      expect(txMetrics.bscSpecific).toHaveProperty('fastLaneUtilizations');
      expect(txMetrics.bscSpecific).toHaveProperty('networkUtilizationAverage');

      const realTimeMetrics = realTimeUpdater.getMetrics();
      expect(realTimeMetrics.bscSpecific).toBeDefined();
      expect(realTimeMetrics.bscSpecific).toHaveProperty('gasOptimizations');
      expect(realTimeMetrics.bscSpecific).toHaveProperty('blockTimeOptimizations');
    });

    test('should have Viem-specific metrics', () => {
      const batchMetrics = batchProcessor.getMetrics();
      expect(batchMetrics.viemSpecific).toBeDefined();
      expect(batchMetrics.viemSpecific).toHaveProperty('simulationSuccessRate');
      expect(batchMetrics.viemSpecific).toHaveProperty('multicallOptimization');

      const txMetrics = transactionOptimizer.getMetrics();
      expect(txMetrics.viemSpecific).toBeDefined();
      expect(txMetrics.viemSpecific).toHaveProperty('simulationSuccessRate');
      expect(txMetrics.viemSpecific).toHaveProperty('gasEstimationAccuracy');

      const realTimeMetrics = realTimeUpdater.getMetrics();
      expect(realTimeMetrics.viemSpecific).toBeDefined();
      expect(realTimeMetrics.viemSpecific).toHaveProperty('batchCallOptimizations');
      expect(realTimeMetrics.viemSpecific).toHaveProperty('multicallUtilization');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid unsubscribe gracefully', () => {
      const result = realTimeUpdater.unsubscribe('invalid-id');
      expect(result).toBe(false);
    });

    test('should handle invalid operation cancellation gracefully', async () => {
      const result = await batchProcessor.cancelOperation('non-existent-id');
      expect(result).toBe(false);
    });

    test('should handle invalid transaction cancellation gracefully', () => {
      const result = transactionOptimizer.cancelTransaction('non-existent-id');
      expect(result).toBe(false);
    });

    test('should clear pending operations without errors', () => {
      expect(() => {
        const clearedCount = batchProcessor.clearPending();
        expect(typeof clearedCount).toBe('number');
      }).not.toThrow();
    });

    test('should clear pending transactions without errors', () => {
      expect(() => {
        const clearedCount = transactionOptimizer.clearPendingTransactions();
        expect(typeof clearedCount).toBe('number');
      }).not.toThrow();
    });
  });

  describe('Performance Characteristics', () => {
    test('should handle multiple operations quickly', async () => {
      const startTime = Date.now();
      const operations = [];

      // Submit multiple operations
      for (let i = 0; i < 3; i++) {
        operations.push(
          batchProcessor.submitOperation(
            BatchOperationTypeViem.APPROVE,
            {
              token: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf',
              spender: testAccount.address,
              amount: parseEther('1')
            },
            { priority: i }
          )
        );
      }

      await Promise.all(operations);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(3000); // Should complete in under 3 seconds
    });

    test('should maintain metrics consistency', () => {
      const batchMetrics = batchProcessor.getMetrics();
      const txMetrics = transactionOptimizer.getMetrics();
      const realTimeMetrics = realTimeUpdater.getMetrics();

      // Metrics should be numbers
      expect(typeof batchMetrics.totalBatches).toBe('number');
      expect(typeof txMetrics.totalTransactions).toBe('number');
      expect(typeof realTimeMetrics.totalUpdates).toBe('number');

      // Efficiency metrics should be numbers between 0 and 1
      expect(batchMetrics.efficiency).toBeGreaterThanOrEqual(0);
      expect(batchMetrics.efficiency).toBeLessThanOrEqual(1);

      // Throughput should be non-negative
      expect(txMetrics.throughput).toBeGreaterThanOrEqual(0);
      expect(realTimeMetrics.averageUpdateRate).toBeGreaterThanOrEqual(0);
    });
  });
});