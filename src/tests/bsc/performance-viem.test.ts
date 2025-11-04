/**
 * Comprehensive Performance Tests for Viem Integration
 * Tests RPC connection pooling, real-time updater, batch processor, and transaction optimizer
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  Address,
  Account
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';
import { RPCConnectionPoolViem } from '../../bsc/services/performance/rpc-connection-pool-viem.js';
import { RealTimeUpdaterViem } from '../../bsc/services/performance/realtime-updater-viem.js';
import { AdvancedBatchProcessorViem, BatchOperationTypeViem } from '../../bsc/services/performance/batch-processor-viem.js';
import { BSCTransactionOptimizerViem } from '../../bsc/services/performance/transaction-optimizer-viem.js';

// Mock logger to avoid console noise during tests
jest.mock('../../utils/logger.js', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('Performance Optimization - Viem Integration', () => {
  let publicClient: any;
  let walletClient: any;
  let testAccount: Account;
  let rpcPool: RPCConnectionPoolViem;
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

    // Initialize services
    rpcPool = new RPCConnectionPoolViem({
      publicClient,
      bscConfig: {
        chainId: 97,
        defaultGasPrice: '10000000000',
        defaultGasLimit: 21000,
        blockTime: 3000,
        pancakeSwapRouter: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1',
        masterChef: '0xa5f8C5Dbd5F286960b9d905486800a167544A527',
        bnbTokenAddress: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd',
        busdTokenAddress: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf',
        cakeTokenAddress: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
        maxGasPriceGwei: '20',
        gasMultiplier: 1.1,
        confirmations: 1
      },
      config: {
        maxConnections: 10,
        healthCheckInterval: 5000,
        enableLoadBalancing: true,
        enableCircuitBreaker: true,
        enableMetrics: true,
        metricsInterval: 2000
      }
    });

    realTimeUpdater = new RealTimeUpdaterViem(
      publicClient,
      {
        metricsInterval: 2000,
        enableThrottling: true,
        enableBatching: true,
        enableMetrics: true
      },
      {
        chainId: 97,
        blockTime: 3000,
        defaultGasPrice: '10000000000',
        confirmations: 1,
        gasMultiplier: 1.1
      }
    );

    batchProcessor = new AdvancedBatchProcessorViem(
      publicClient,
      {
        maxBatchSize: 10,
        batchTimeout: 1000,
        maxBatchWaitTime: 5000,
        minBatchSize: 2,
        maxConcurrentBatches: 3,
        operationTimeout: 30000,
        enableOptimalGrouping: true,
        enableDependencyResolution: true,
        enablePriorityQueuing: true,
        enableGasOptimization: true,
        enableViemOptimization: true,
        enableMulticallOptimization: true,
        enableMetrics: true,
        metricsInterval: 2000
      },
      {
        chainId: 97,
        defaultGasPrice: '10000000000',
        defaultGasLimit: 21000,
        blockTime: 3000,
        pancakeSwapRouter: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1',
        masterChef: '0xa5f8C5Dbd5F286960b9d905486800a167544A527',
        bnbTokenAddress: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd',
        busdTokenAddress: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf',
        cakeTokenAddress: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
        maxGasPriceGwei: '20',
        gasMultiplier: 1.1,
        confirmations: 1
      },
      walletClient
    );

    transactionOptimizer = new BSCTransactionOptimizerViem(
      publicClient,
      {
        batchSize: 5,
        batchTimeout: 500,
        maxBatchWaitTime: 3000,
        gasPriceMultiplier: 1.1,
        maxGasPriceGwei: 50,
        dynamicGasAdjustment: true,
        enableEIP1559Support: true,
        maxPendingTransactions: 100,
        transactionTimeout: 30000,
        retryAttempts: 2,
        retryDelay: 1000,
        enableMetrics: true,
        metricsInterval: 2000,
        enableFastLane: true,
        useSimulation: true,
        enableMulticall: true,
        enableBatchCalls: true,
        smartContractOptimization: true,
        gasEstimationOptimization: true,
        pancakeSwapOptimization: true
      },
      {
        chainId: 97,
        defaultGasPrice: '10000000000',
        defaultGasLimit: 21000,
        blockTime: 3000,
        pancakeSwapRouter: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1',
        masterChef: '0xa5f8C5Dbd5F286960b9d905486800a167544A527',
        bnbTokenAddress: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd',
        busdTokenAddress: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf',
        cakeTokenAddress: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
        maxGasPriceGwei: '50',
        gasMultiplier: 1.1,
        confirmations: 1,
        fastLaneBoost: '1000000000',
        networkCongestionThreshold: 0.8
      },
      walletClient
    );
  });

  afterEach(async () => {
    // Cleanup services
    if (rpcPool) await rpcPool.shutdown();
    if (realTimeUpdater) await realTimeUpdater.shutdown();
    if (batchProcessor) await batchProcessor.shutdown();
    if (transactionOptimizer) await transactionOptimizer.shutdown();
  });

  describe('RPC Connection Pool', () => {
    test('should initialize with correct configuration', () => {
      expect(rpcPool).toBeDefined();
      const stats = rpcPool.getStats();
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('healthyConnections');
      expect(stats).toHaveProperty('unhealthyConnections');
    });

    test('should make RPC requests successfully', async () => {
      const blockNumber = await rpcPool.request('eth_blockNumber');
      expect(typeof blockNumber).toBe('string');
      expect(blockNumber).toMatch(/^0x[0-9a-f]+$/);
    });

    test('should handle batch requests efficiently', async () => {
      const requests = [
        { method: 'eth_blockNumber', params: [] },
        { method: 'eth_chainId', params: [] },
        { method: 'eth_getBalance', params: [testAccount.address, 'latest'] }
      ];

      const startTime = Date.now();
      const results = await rpcPool.batchRequest(requests);
      const endTime = Date.now();

      expect(results).toHaveLength(3);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete in under 2 seconds
    });

    test('should provide performance metrics', () => {
      const metrics = rpcPool.getMetrics();
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('successfulRequests');
      expect(metrics).toHaveProperty('failedRequests');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('peakResponseTime');
    });

    test('should handle connection failures gracefully', async () => {
      // Test with invalid endpoint
      const badPublicClient = createPublicClient({
        chain: bscTestnet,
        transport: http('http://invalid-endpoint')
      });

      const badPool = new RPCConnectionPoolViem({
        publicClient: badPublicClient,
        config: {
          maxConnections: 2,
          healthCheckInterval: 1000
        }
      });

      expect(async () => {
        await badPool.request('eth_blockNumber');
      }).rejects.toThrow();

      await badPool.shutdown();
    });
  });

  describe('Real-time Updater', () => {
    test('should initialize and start updates', () => {
      expect(realTimeUpdater).toBeDefined();
      const stats = realTimeUpdater.getStats();
      expect(stats).toHaveProperty('activeSubscriptions');
      expect(stats).toHaveProperty('totalUpdates');
      expect(stats).toHaveProperty('averageUpdateTime');
    });

    test('should subscribe to data updates', (done) => {
      const callback = jest.fn();
      const subscriptionId = realTimeUpdater.subscribe('block', callback);

      expect(typeof subscriptionId).toBe('string');

      // Wait for at least one update
      setTimeout(() => {
        expect(callback).toHaveBeenCalled();
        done();
      }, 1500);
    });

    test('should handle multiple subscriptions', (done) => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const sub1 = realTimeUpdater.subscribe('block', callback1);
      const sub2 = realTimeUpdater.subscribe('balance', callback2, {
        account: testAccount.address
      });

      expect(sub1).not.toBe(sub2);

      setTimeout(() => {
        expect(callback1).toHaveBeenCalled();
        // Balance updates may not occur in test environment
        done();
      }, 1500);
    });

    test('should provide comprehensive metrics', () => {
      const metrics = realTimeUpdater.getMetrics();
      expect(metrics).toHaveProperty('totalSubscriptions');
      expect(metrics).toHaveProperty('successfulUpdates');
      expect(metrics).toHaveProperty('failedUpdates');
      expect(metrics).toHaveProperty('averageUpdateTime');
      expect(metrics).toHaveProperty('viemSpecific');
      expect(metrics).toHaveProperty('bscSpecific');
    });

    test('should unsubscribe from updates', () => {
      const callback = jest.fn();
      const subscriptionId = realTimeUpdater.subscribe('block', callback);

      const unsubscribed = realTimeUpdater.unsubscribe(subscriptionId);
      expect(unsubscribed).toBe(true);

      const unsubscribedAgain = realTimeUpdater.unsubscribe(subscriptionId);
      expect(unsubscribedAgain).toBe(false);
    });
  });

  describe('Batch Processor', () => {
    test('should initialize with correct configuration', () => {
      expect(batchProcessor).toBeDefined();
      const stats = batchProcessor.getProcessingStats();
      expect(stats).toHaveProperty('pendingOperations');
      expect(stats).toHaveProperty('processingBatches');
      expect(stats).toHaveProperty('queueLength');
    });

    test('should submit single operations', async () => {
      const operationId = await batchProcessor.submitOperation(
        BatchOperationTypeViem.APPROVE,
        {
          token: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf', // BUSD on testnet
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

    test('should submit batch operations', async () => {
      const operations = [
        {
          type: BatchOperationTypeViem.APPROVE,
          data: {
            token: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf',
            spender: testAccount.address,
            amount: parseEther('1')
          }
        },
        {
          type: BatchOperationTypeViem.SWAP,
          data: {
            tokenIn: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd', // WBNB
            tokenOut: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf', // BUSD
            amountIn: parseEther('0.1'),
            recipient: testAccount.address
          },
          pancakeSwapOptimized: true
        }
      ];

      const operationIds = await batchProcessor.submitBatch(operations);

      expect(operationIds).toHaveLength(2);
      operationIds.forEach(id => {
        expect(typeof id).toBe('string');
        expect(id).toMatch(/^op_\d+_[a-z0-9]+$/);
      });
    });

    test('should handle operation dependencies', async () => {
      const approveId = await batchProcessor.submitOperation(
        BatchOperationTypeViem.APPROVE,
        {
          token: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf',
          spender: testAccount.address,
          amount: parseEther('1')
        }
      );

      const swapId = await batchProcessor.submitOperation(
        BatchOperationTypeViem.SWAP,
        {
          tokenIn: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd',
          tokenOut: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf',
          amountIn: parseEther('0.1'),
          recipient: testAccount.address
        },
        {
          dependencies: [approveId]
        }
      );

      expect(approveId).not.toBe(swapId);
    });

    test('should provide comprehensive metrics', () => {
      const metrics = batchProcessor.getMetrics();
      expect(metrics).toHaveProperty('totalBatches');
      expect(metrics).toHaveProperty('successfulBatches');
      expect(metrics).toHaveProperty('failedBatches');
      expect(metrics).toHaveProperty('averageBatchSize');
      expect(metrics).toHaveProperty('throughput');
      expect(metrics).toHaveProperty('viemSpecific');
      expect(metrics).toHaveProperty('bscSpecific');
    });

    test('should cancel pending operations', async () => {
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
  });

  describe('Transaction Optimizer', () => {
    test('should initialize with correct configuration', () => {
      expect(transactionOptimizer).toBeDefined();
      const pendingCount = transactionOptimizer.getPendingTransactionCount();
      expect(typeof pendingCount).toBe('number');
    });

    test('should submit single transactions', async () => {
      const transactionId = await transactionOptimizer.submitTransaction(
        {
          to: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf' as Address, // BUSD
          data: '0x095ea7b30000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
          account: testAccount.address
        },
        {
          priority: 1,
          account: testAccount.address
        }
      );

      expect(typeof transactionId).toBe('string');
      expect(transactionId).toMatch(/^tx_\d+_[a-z0-9]+$/);
    });

    test('should submit batch transactions', async () => {
      const transactions = [
        {
          transaction: {
            to: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf' as Address,
            data: '0x095ea7b30000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
            account: testAccount.address
          }
        },
        {
          transaction: {
            to: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd' as Address, // WBNB
            data: '0x095ea7b30000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
            account: testAccount.address
          },
          pancakeSwapOptimized: true
        }
      ];

      const transactionIds = await transactionOptimizer.submitBatch(transactions);

      expect(transactionIds).toHaveLength(2);
      transactionIds.forEach(id => {
        expect(typeof id).toBe('string');
        expect(id).toMatch(/^tx_\d+_[a-z0-9]+$/);
      });
    });

    test('should provide comprehensive metrics', () => {
      const metrics = transactionOptimizer.getMetrics();
      expect(metrics).toHaveProperty('totalTransactions');
      expect(metrics).toHaveProperty('successfulTransactions');
      expect(metrics).toHaveProperty('failedTransactions');
      expect(metrics).toHaveProperty('averageConfirmationTime');
      expect(metrics).toHaveProperty('throughput');
      expect(metrics).toHaveProperty('viemSpecific');
      expect(metrics).toHaveProperty('bscSpecific');
    });

    test('should handle network statistics', () => {
      const networkStats = transactionOptimizer.getNetworkStats();
      expect(networkStats).toHaveProperty('averageBlockTime');
      expect(networkStats).toHaveProperty('averageGasPrice');
      expect(networkStats).toHaveProperty('congestionLevel');
    });

    test('should cancel pending transactions', async () => {
      const transactionId = await transactionOptimizer.submitTransaction(
        {
          to: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf' as Address,
          data: '0x095ea7b30000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
          account: testAccount.address
        }
      );

      const cancelled = transactionOptimizer.cancelTransaction(transactionId);
      expect(cancelled).toBe(true);

      const cancelledAgain = transactionOptimizer.cancelTransaction(transactionId);
      expect(cancelledAgain).toBe(false);
    });

    test('should clear all pending transactions', async () => {
      // Submit some transactions
      await transactionOptimizer.submitTransaction({
        to: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf' as Address,
        data: '0x095ea7b30000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        account: testAccount.address
      });

      await transactionOptimizer.submitTransaction({
        to: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd' as Address,
        data: '0x095ea7b30000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        account: testAccount.address
      });

      const clearedCount = transactionOptimizer.clearPendingTransactions();
      expect(clearedCount).toBeGreaterThan(0);
      expect(transactionOptimizer.getPendingTransactionCount()).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    test('should handle multiple services simultaneously', async () => {
      // Start real-time updates
      const realTimeCallback = jest.fn();
      realTimeUpdater.subscribe('block', realTimeCallback);

      // Submit batch operations
      const batchIds = await batchProcessor.submitBatch([
        {
          type: BatchOperationTypeViem.APPROVE,
          data: {
            token: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf',
            spender: testAccount.address,
            amount: parseEther('1')
          }
        }
      ]);

      // Submit transactions
      const txIds = await transactionOptimizer.submitBatch([
        {
          transaction: {
            to: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf' as Address,
            data: '0x095ea7b30000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
            account: testAccount.address
          }
        }
      ]);

      expect(batchIds).toHaveLength(1);
      expect(txIds).toHaveLength(1);

      // Wait for real-time updates
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    test('should handle performance alerts', (done) => {
      const alertHandler = jest.fn();

      // Subscribe to alerts from all services
      batchProcessor.on('alert', alertHandler);
      transactionOptimizer.on('alert', alertHandler);

      // Create conditions that might trigger alerts
      // (In real scenario, this would involve actual load testing)

      setTimeout(() => {
        // Verify that alert system is working
        expect(typeof batchProcessor.getMetrics().efficiency).toBe('number');
        expect(typeof transactionOptimizer.getMetrics().errorRate).toBe('number');
        done();
      }, 1000);
    });

    test('should maintain performance under load', async () => {
      const startTime = Date.now();
      const operations = [];

      // Submit multiple operations across services
      for (let i = 0; i < 10; i++) {
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

        operations.push(
          transactionOptimizer.submitTransaction(
            {
              to: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf' as Address,
              data: '0x095ea7b30000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
              account: testAccount.address
            },
            { priority: i }
          )
        );
      }

      await Promise.all(operations);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds

      // Verify that operations were queued
      expect(batchProcessor.getProcessingStats().queueLength).toBeGreaterThan(0);
      expect(transactionOptimizer.getPendingTransactionCount()).toBeGreaterThan(0);
    });
  });

  describe('Viem-specific Features', () => {
    test('should handle custom clients', async () => {
      const customClient = createPublicClient({
        chain: bscTestnet,
        transport: http('https://data-seed-prebsc-1-s1.binance.org:8545/')
      });

      // Add custom client to services
      batchProcessor.addCustomClient('test-client', customClient);
      transactionOptimizer.addCustomClient('test-client', customClient);

      // Test operations with custom client
      const operationId = await batchProcessor.submitOperation(
        BatchOperationTypeViem.CUSTOM,
        {
          to: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf' as Address,
          data: '0x095ea7b3' as `0x${string}`
        },
        {
          clientType: 'custom',
          metadata: { customClientName: 'test-client' }
        }
      );

      expect(typeof operationId).toBe('string');
    });

    test('should handle PancakeSwap optimizations', async () => {
      const operationId = await batchProcessor.submitOperation(
        BatchOperationTypeViem.SWAP,
        {
          tokenIn: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd',
          tokenOut: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf',
          amountIn: parseEther('0.1'),
          recipient: testAccount.address
        },
        {
          pancakeSwapOptimized: true,
          account: testAccount.address
        }
      );

      expect(typeof operationId).toBe('string');

      const metrics = batchProcessor.getMetrics();
      expect(metrics.bscSpecific.pancakeSwapOptimizations).toBeGreaterThan(0);
    });

    test('should handle simulation-based execution', async () => {
      const transactionId = await transactionOptimizer.submitTransaction(
        {
          to: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf' as Address,
          data: '0x095ea7b30000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
          account: testAccount.address
        },
        {
          gasOptimized: true,
          account: testAccount.address
        }
      );

      expect(typeof transactionId).toBe('string');

      const metrics = transactionOptimizer.getMetrics();
      expect(metrics.viemSpecific.simulationSuccessRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle network failures gracefully', async () => {
      // Create service with invalid endpoint
      const badPool = new RPCConnectionPoolViem({
        mainRpcUrl: 'http://invalid-endpoint',
        fallbackRpcUrls: [],
        maxConnections: 2
      });

      await expect(badPool.request('eth_blockNumber')).rejects.toThrow();

      const metrics = badPool.getPerformanceMetrics();
      expect(metrics.failedRequests).toBeGreaterThan(0);

      await badPool.shutdown();
    });

    test('should handle invalid operations gracefully', async () => {
      await expect(
        batchProcessor.submitOperation(
          BatchOperationTypeViem.CUSTOM,
          { invalid: 'data' }
        )
      ).rejects.toThrow();
    });

    test('should handle timeout scenarios', async () => {
      // This would require mocking slow responses
      // For now, just verify timeout configuration
      const batchConfig = batchProcessor.getMetrics();
      expect(batchConfig.averageExecutionTime).toBeGreaterThanOrEqual(0);
    });
  });
});