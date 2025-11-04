/**
 * Basic Performance Tests for Viem Integration
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
import { RealTimeUpdaterViem } from '../../bsc/services/performance/realtime-updater-viem.js';
import { AdvancedBatchProcessorViem, BatchOperationTypeViem } from '../../bsc/services/performance/batch-processor-viem.js';
import { BSCTransactionOptimizerViem } from '../../bsc/services/performance/transaction-optimizer-viem.js';

// Mock logger to avoid console noise during tests
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('Performance Optimization - Viem Integration (Basic)', () => {
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

    // Initialize services with minimal configuration
    realTimeUpdater = new RealTimeUpdaterViem(
      publicClient
    );

    batchProcessor = new AdvancedBatchProcessorViem(
      publicClient,
      undefined,
      undefined,
      walletClient
    );

    transactionOptimizer = new BSCTransactionOptimizerViem(
      publicClient,
      undefined,
      undefined,
      walletClient
    );
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

  describe('Real-time Updater', () => {
    test('should provide metrics', () => {
      const metrics = realTimeUpdater.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('totalSubscriptions');
      expect(metrics).toHaveProperty('successfulUpdates');
      expect(metrics).toHaveProperty('failedUpdates');
      expect(metrics).toHaveProperty('viemSpecific');
      expect(metrics).toHaveProperty('bscSpecific');
    });

    test('should subscribe to updates', () => {
      const callback = jest.fn();
      const subscriptionId = realTimeUpdater.subscribe('block', callback);

      expect(typeof subscriptionId).toBe('string');

      // Should be able to unsubscribe
      const unsubscribed = realTimeUpdater.unsubscribe(subscriptionId);
      expect(unsubscribed).toBe(true);
    });

    test('should handle invalid unsubscribe', () => {
      const result = realTimeUpdater.unsubscribe('invalid-id');
      expect(result).toBe(false);
    });
  });

  describe('Batch Processor', () => {
    test('should provide metrics', () => {
      const metrics = batchProcessor.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('totalBatches');
      expect(metrics).toHaveProperty('successfulBatches');
      expect(metrics).toHaveProperty('failedBatches');
      expect(metrics).toHaveProperty('viemSpecific');
      expect(metrics).toHaveProperty('bscSpecific');
    });

    test('should get processing stats', () => {
      const stats = batchProcessor.getProcessingStats();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('pendingOperations');
      expect(stats).toHaveProperty('processingBatches');
      expect(stats).toHaveProperty('queueLength');
      expect(stats).toHaveProperty('bscSpecific');
    });

    test('should submit operations', async () => {
      const operationId = await batchProcessor.submitOperation(
        BatchOperationTypeViem.APPROVE,
        {
          token: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf',
          spender: testAccount.address,
          amount: parseEther('1')
        },
        {
          priority: 1,
          account: testAccount.address
        }
      );

      expect(typeof operationId).toBe('string');
      expect(operationId).toMatch(/^op_\d+_[a-z0-9]+$/);
    });

    test('should cancel operations', async () => {
      const operationId = await batchProcessor.submitOperation(
        BatchOperationTypeViem.APPROVE,
        {
          token: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf',
          spender: testAccount.address,
          amount: parseEther('1')
        }
      );

      const cancelled = await batchProcessor.cancelOperation(operationId);
      expect(cancelled).toBe(true);

      const cancelledAgain = await batchProcessor.cancelOperation(operationId);
      expect(cancelledAgain).toBe(false);
    });

    test('should clear pending operations', () => {
      const clearedCount = batchProcessor.clearPending();
      expect(typeof clearedCount).toBe('number');
      expect(clearedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Transaction Optimizer', () => {
    test('should provide metrics', () => {
      const metrics = transactionOptimizer.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('totalTransactions');
      expect(metrics).toHaveProperty('successfulTransactions');
      expect(metrics).toHaveProperty('failedTransactions');
      expect(metrics).toHaveProperty('viemSpecific');
      expect(metrics).toHaveProperty('bscSpecific');
    });

    test('should get network stats', () => {
      const networkStats = transactionOptimizer.getNetworkStats();
      expect(networkStats).toBeDefined();
      expect(networkStats).toHaveProperty('averageBlockTime');
      expect(networkStats).toHaveProperty('averageGasPrice');
      expect(networkStats).toHaveProperty('congestionLevel');
    });

    test('should get pending transaction count', () => {
      const count = transactionOptimizer.getPendingTransactionCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should cancel transactions', () => {
      const result = transactionOptimizer.cancelTransaction('non-existent-id');
      expect(result).toBe(false);
    });

    test('should clear pending transactions', () => {
      const clearedCount = transactionOptimizer.clearPendingTransactions();
      expect(typeof clearedCount).toBe('number');
      expect(clearedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Viem Integration Features', () => {
    test('should handle BSC-specific configurations', () => {
      const batchMetrics = batchProcessor.getMetrics();
      expect(batchMetrics.bscSpecific).toBeDefined();
      expect(batchMetrics.bscSpecific).toHaveProperty('totalBnbSpent');
      expect(batchMetrics.bscSpecific).toHaveProperty('pancakeSwapOptimizations');

      const txMetrics = transactionOptimizer.getMetrics();
      expect(txMetrics.bscSpecific).toBeDefined();
      expect(txMetrics.bscSpecific).toHaveProperty('fastLaneUtilizations');
      expect(txMetrics.bscSpecific).toHaveProperty('networkUtilizationAverage');
    });

    test('should provide Viem-specific metrics', () => {
      const batchMetrics = batchProcessor.getMetrics();
      expect(batchMetrics.viemSpecific).toBeDefined();
      expect(batchMetrics.viemSpecific).toHaveProperty('simulationSuccessRate');
      expect(batchMetrics.viemSpecific).toHaveProperty('multicallOptimization');

      const txMetrics = transactionOptimizer.getMetrics();
      expect(txMetrics.viemSpecific).toBeDefined();
      expect(txMetrics.viemSpecific).toHaveProperty('simulationSuccessRate');
      expect(txMetrics.viemSpecific).toHaveProperty('gasEstimationAccuracy');
    });
  });

  describe('Error Handling', () => {
    test('should handle service shutdown gracefully', async () => {
      // Create a new service to test shutdown
      const testUpdater = new RealTimeUpdaterViem(publicClient);

      // Should not throw during shutdown
      await expect(testUpdater.shutdown()).resolves.toBeUndefined();
    });

    test('should handle invalid subscription types', () => {
      const callback = jest.fn();

      // Should handle unknown subscription types gracefully
      expect(() => {
        const subscriptionId = realTimeUpdater.subscribe('unknown-type', callback);
        expect(typeof subscriptionId).toBe('string');
      }).not.toThrow();
    });
  });

  describe('Performance Characteristics', () => {
    test('should track metrics properly', () => {
      const initialBatchMetrics = batchProcessor.getMetrics();
      const initialTxMetrics = transactionOptimizer.getMetrics();
      const initialRealTimeMetrics = realTimeUpdater.getMetrics();

      // Metrics should be properly initialized
      expect(initialBatchMetrics.totalBatches).toBeGreaterThanOrEqual(0);
      expect(initialTxMetrics.totalTransactions).toBeGreaterThanOrEqual(0);
      expect(initialRealTimeMetrics.totalUpdates).toBeGreaterThanOrEqual(0);

      // Metrics should be numbers
      expect(typeof initialBatchMetrics.efficiency).toBe('number');
      expect(typeof initialTxMetrics.throughput).toBe('number');
      expect(typeof initialRealTimeMetrics.averageUpdateRate).toBe('number');
    });

    test('should handle concurrent operations', async () => {
      const startTime = Date.now();
      const operations = [];

      // Submit multiple operations concurrently
      for (let i = 0; i < 3; i++) {
        operations.push(
          batchProcessor.submitOperation(
            BatchOperationTypeViem.APPROVE,
            {
              token: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf',
              spender: testAccount.address,
              amount: parseEther('1')
            },
            { priority: i, account: testAccount.address }
          )
        );
      }

      await Promise.all(operations);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds

      // Verify operations were queued
      const stats = batchProcessor.getProcessingStats();
      expect(stats.pendingOperations).toBeGreaterThan(0);
    });
  });
});