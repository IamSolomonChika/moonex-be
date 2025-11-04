/**
 * Basic Viem Migration Validation Test Suite
 * Validates core Viem integration functionality
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  Address,
  Hash,
  Chain,
  Account
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';

// Import Viem-based services that actually exist
import { SwapServiceViem } from '../bsc/services/trading/swap-service-viem.js';
import { BSCTokenServiceViem } from '../bsc/services/tokens/token-service-viem.js';
import { LiquidityServiceViem } from '../bsc/services/liquidity/liquidity-service-viem.js';
import { CakeGovernanceServiceViem } from '../bsc/services/governance/cake-governance-viem.js';
import { RealTimeUpdaterViem } from '../bsc/services/performance/realtime-updater-viem.js';
import { AdvancedBatchProcessorViem } from '../bsc/services/performance/batch-processor-viem.js';
import { BSCTransactionOptimizerViem } from '../bsc/services/performance/transaction-optimizer-viem.js';

// Mock logger to avoid console noise during tests
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('Basic Viem Migration Validation', () => {
  let publicClient: any;
  let walletClient: any;
  let testAccount: Account;

  beforeAll(async () => {
    // Create test account
    testAccount = mnemonicToAccount('test test test test test test test test test test test junk');

    // Create Viem clients for BSC testnet
    publicClient = createPublicClient({
      chain: bscTestnet,
      transport: http('https://data-seed-prebsc-1-s1.binance.org:8545/')
    });

    walletClient = createWalletClient({
      chain: bscTestnet,
      transport: http('https://data-seed-prebsc-1-s1.binance.org:8545/'),
      account: testAccount
    });
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('Core Viem Client Integration', () => {
    test('should initialize Viem clients successfully', () => {
      expect(publicClient).toBeDefined();
      expect(walletClient).toBeDefined();
      expect(testAccount.address).toBeDefined();
      expect(testAccount.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    test('should connect to BSC testnet', async () => {
      const blockNumber = await publicClient.getBlockNumber();
      expect(typeof blockNumber).toBe('bigint');
      expect(blockNumber).toBeGreaterThan(0n);
    });

    test('should get chain information', async () => {
      const chain = await publicClient.getChainId();
      expect(chain).toBe(97); // BSC testnet chain ID
    });

    test('should get block information', async () => {
      const block = await publicClient.getBlock();
      expect(block).toBeDefined();
      expect(block.number).toBeGreaterThan(0n);
      expect(block.timestamp).toBeGreaterThan(0n);
    });
  });

  describe('Viem Services Initialization', () => {
    test('should initialize SwapServiceViem', () => {
      const swapService = new SwapServiceViem();
      expect(swapService).toBeDefined();
    });

    test('should initialize BSCTokenServiceViem', () => {
      const tokenService = new BSCTokenServiceViem(publicClient);
      expect(tokenService).toBeDefined();
    });

    test('should initialize LiquidityServiceViem', () => {
      const liquidityService = new LiquidityServiceViem();
      expect(liquidityService).toBeDefined();
    });

    test('should initialize CakeGovernanceServiceViem', () => {
      const governanceService = new CakeGovernanceServiceViem();
      expect(governanceService).toBeDefined();
    });

    test('should initialize performance services', () => {
      const realTimeUpdater = new RealTimeUpdaterViem(publicClient);
      const batchProcessor = new AdvancedBatchProcessorViem(publicClient);
      const txOptimizer = new BSCTransactionOptimizerViem(publicClient);

      expect(realTimeUpdater).toBeDefined();
      expect(batchProcessor).toBeDefined();
      expect(txOptimizer).toBeDefined();
    });
  });

  describe('Viem Services Basic Functionality', () => {
    test('should provide metrics from real-time updater', () => {
      const realTimeUpdater = new RealTimeUpdaterViem(publicClient);
      const metrics = realTimeUpdater.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('totalUpdates');
      expect(metrics).toHaveProperty('successfulUpdates');
      expect(metrics).toHaveProperty('failedUpdates');
      expect(metrics).toHaveProperty('viemSpecific');
      expect(metrics).toHaveProperty('bscSpecific');
    });

    test('should provide metrics from batch processor', () => {
      const batchProcessor = new AdvancedBatchProcessorViem(publicClient);
      const metrics = batchProcessor.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('totalBatches');
      expect(metrics).toHaveProperty('successfulBatches');
      expect(metrics).toHaveProperty('failedBatches');
      expect(metrics).toHaveProperty('viemSpecific');
      expect(metrics).toHaveProperty('bscSpecific');
    });

    test('should provide metrics from transaction optimizer', () => {
      const txOptimizer = new BSCTransactionOptimizerViem(publicClient);
      const metrics = txOptimizer.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('totalTransactions');
      expect(metrics).toHaveProperty('successfulTransactions');
      expect(metrics).toHaveProperty('failedTransactions');
      expect(metrics).toHaveProperty('viemSpecific');
      expect(metrics).toHaveProperty('bscSpecific');
    });

    test('should handle subscription management in real-time updater', () => {
      const realTimeUpdater = new RealTimeUpdaterViem(publicClient);
      const callback = jest.fn();

      const subscriptionId = realTimeUpdater.subscribe('block', callback);
      expect(typeof subscriptionId).toBe('string');

      const unsubscribed = realTimeUpdater.unsubscribe(subscriptionId);
      expect(unsubscribed).toBe(true);

      // Should handle invalid unsubscribe
      const invalidResult = realTimeUpdater.unsubscribe('invalid-id');
      expect(invalidResult).toBe(false);
    });

    test('should handle batch operations', async () => {
      const batchProcessor = new AdvancedBatchProcessorViem(publicClient);
      const operationId = await batchProcessor.submitOperation(
        'APPROVE' as any,
        {
          token: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf' as Address,
          spender: testAccount.address,
          amount: parseEther('1')
        }
      );

      expect(typeof operationId).toBe('string');
      expect(operationId).toMatch(/^op_\d+_[a-z0-9]+$/);

      const cancelled = await batchProcessor.cancelOperation(operationId);
      expect(cancelled).toBe(true);
    });

    test('should provide network statistics', () => {
      const txOptimizer = new BSCTransactionOptimizerViem(publicClient);
      const networkStats = txOptimizer.getNetworkStats();

      expect(networkStats).toBeDefined();
      expect(networkStats).toHaveProperty('averageBlockTime');
      expect(networkStats).toHaveProperty('averageGasPrice');
      expect(networkStats).toHaveProperty('congestionLevel');
    });
  });

  describe('Viem Error Handling', () => {
    test('should handle invalid addresses gracefully', async () => {
      const tokenService = new BSCTokenServiceViem(publicClient);

      // This should not crash but may return null or throw a controlled error
      try {
        const balance = await tokenService.getBalance('0xinvalid' as Address);
        // If it doesn't throw, it might return null
        expect(balance === null || typeof balance === 'bigint').toBe(true);
      } catch (error) {
        // Expected behavior - controlled error
        expect(error).toBeInstanceOf(Error);
      }
    });

    test('should handle service shutdown gracefully', async () => {
      const realTimeUpdater = new RealTimeUpdaterViem(publicClient);
      const batchProcessor = new AdvancedBatchProcessorViem(publicClient);
      const txOptimizer = new BSCTransactionOptimizerViem(publicClient);

      // Should not throw during shutdown
      await expect(realTimeUpdater.shutdown()).resolves.toBeUndefined();
      await expect(batchProcessor.shutdown()).resolves.toBeUndefined();
      await expect(txOptimizer.shutdown()).resolves.toBeUndefined();
    });

    test('should handle invalid subscription types', () => {
      const realTimeUpdater = new RealTimeUpdaterViem(publicClient);
      const callback = jest.fn();

      // Should handle unknown subscription types gracefully
      expect(() => {
        const subscriptionId = realTimeUpdater.subscribe('unknown-type' as any, callback);
        expect(typeof subscriptionId).toBe('string');
      }).not.toThrow();
    });
  });

  describe('Viem Performance Characteristics', () => {
    test('should handle multiple operations quickly', async () => {
      const batchProcessor = new AdvancedBatchProcessorViem(publicClient);
      const startTime = Date.now();

      // Submit multiple operations
      const operations = [];
      for (let i = 0; i < 3; i++) {
        operations.push(
          batchProcessor.submitOperation(
            'APPROVE' as any,
            {
              token: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf' as Address,
              spender: testAccount.address,
              amount: parseEther('1')
            }
          )
        );
      }

      await Promise.all(operations);
      const endTime = Date.now();

      // Should complete in under 3 seconds
      expect(endTime - startTime).toBeLessThan(3000);
    });

    test('should maintain metrics consistency', () => {
      const batchMetrics = new AdvancedBatchProcessorViem(publicClient).getMetrics();
      const txMetrics = new BSCTransactionOptimizerViem(publicClient).getMetrics();
      const realTimeMetrics = new RealTimeUpdaterViem(publicClient).getMetrics();

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

  describe('Viem Type Safety', () => {
    test('should use proper Viem types', () => {
      expect(typeof testAccount.address).toBe('string');
      expect(testAccount.address).toMatch(/^0x[a-fA-F0-9]{40}$/);

      const amount = parseEther('1');
      expect(typeof amount).toBe('bigint');
      expect(amount).toBe(1000000000000000000n);
    });

    test('should handle type conversions correctly', () => {
      const amount = parseEther('1.5');
      const formatted = formatEther(amount);

      expect(formatted).toBe('1.5');
      expect(typeof formatted).toBe('string');
    });

    test('should validate address types', () => {
      const validAddress = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address;
      expect(validAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);

      // Type assertion should work
      const anotherAddress: Address = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';
      expect(anotherAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe('BSC-Specific Viem Integration', () => {
    test('should work with BSC testnet chain', () => {
      const client = createPublicClient({
        chain: bscTestnet,
        transport: http('https://data-seed-prebsc-1-s1.binance.org:8545/')
      });

      expect(client).toBeDefined();
      expect(client.chain.name).toBe('BNB Smart Chain Testnet');
    });

    test('should provide BSC-specific metrics', () => {
      const batchProcessor = new AdvancedBatchProcessorViem(publicClient);
      const metrics = batchProcessor.getMetrics();

      expect(metrics.bscSpecific).toBeDefined();
      expect(metrics.bscSpecific).toHaveProperty('totalBnbSpent');
      expect(metrics.bscSpecific).toHaveProperty('pancakeSwapOptimizations');
    });

    test('should handle BSC gas optimization', () => {
      const txOptimizer = new BSCTransactionOptimizerViem(publicClient);
      const networkStats = txOptimizer.getNetworkStats();

      expect(networkStats).toBeDefined();
      expect(networkStats).toHaveProperty('averageGasPrice');
      expect(networkStats).toHaveProperty('congestionLevel');
    });
  });
});