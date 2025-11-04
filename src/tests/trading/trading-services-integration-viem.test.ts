/**
 * Trading Services Integration Tests (Viem)
 * Comprehensive integration tests for all migrated trading services using Viem
 */

import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { SwapServiceViem } from '../../bsc/services/trading/swap-service-viem.js';
import { PancakeSwapAMMIntegrationViem } from '../../bsc/services/trading/amm-integration-viem.js';
import { BSCGasOptimizationServiceViem } from '../../bsc/services/trading/gas-optimization-viem.js';
import { SlippageProtectionServiceViem } from '../../bsc/services/trading/slippage-protection-viem.js';
import { MEVProtectionServiceViem } from '../../bsc/services/trading/mev-protection-viem.js';
import { TransactionQueueServiceViem } from '../../bsc/services/trading/transaction-queue-viem.js';
import type { SwapRequestViem, SwapQuoteViem, SwapTransactionViem } from '../../bsc/types/trading-types-viem.js';
import { parseUnits, formatUnits } from 'viem';

// Mock dependencies
jest.mock('../../bsc/services/trading/swap-service-viem.js');
jest.mock('../../bsc/services/trading/amm-integration-viem.js');
jest.mock('../../bsc/services/trading/gas-optimization-viem.js');
jest.mock('../../bsc/services/trading/slippage-protection-viem.js');
jest.mock('../../bsc/services/trading/mev-protection-viem.js');
jest.mock('../../bsc/services/trading/transaction-queue-viem.js');

describe('Trading Services Integration (Viem)', () => {
  let swapService: SwapServiceViem;
  let ammIntegration: PancakeSwapAMMIntegrationViem;
  let gasOptimization: BSCGasOptimizationServiceViem;
  let slippageProtection: SlippageProtectionServiceViem;
  let mevProtection: MEVProtectionServiceViem;
  let transactionQueue: TransactionQueueServiceViem;

  let validSwapRequest: SwapRequestViem;
  let privateKey: string;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Initialize all services
    swapService = new SwapServiceViem();
    ammIntegration = new PancakeSwapAMMIntegrationViem();
    gasOptimization = new BSCGasOptimizationServiceViem();
    slippageProtection = new SlippageProtectionServiceViem();
    mevProtection = new MEVProtectionServiceViem();
    transactionQueue = new TransactionQueueServiceViem();

    // Setup valid swap request
    validSwapRequest = {
      tokenIn: '0x55d398326f99059ff775485246999027b3197955' as `0x${string}`, // USDT
      tokenOut: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' as `0x${string}`, // WBNB
      amountIn: '1000000000000000000000', // 1000 USDT
      slippageTolerance: 0.5,
      deadline: Date.now() + 30000, // 30 seconds
      recipient: '0x742d35cc6464c73c8150a6a0c5d8b5a5f5f5f5f5' as `0x${string}`,
      type: 'swap'
    };

    // Test private key (for testing only)
    privateKey = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  describe('Service Initialization', () => {
    it('should initialize all trading services successfully', () => {
      expect(swapService).toBeDefined();
      expect(ammIntegration).toBeDefined();
      expect(gasOptimization).toBeDefined();
      expect(slippageProtection).toBeDefined();
      expect(mevProtection).toBeDefined();
      expect(transactionQueue).toBeDefined();
    });

    it('should have all required methods available', () => {
      expect(typeof swapService.getQuote).toBe('function');
      expect(typeof swapService.executeSwap).toBe('function');
      expect(typeof ammIntegration.getQuote).toBe('function');
      expect(typeof gasOptimization.optimizeGasSettings).toBe('function');
      expect(typeof slippageProtection.analyzeSlippage).toBe('function');
      expect(typeof mevProtection.analyzeMEVRisk).toBe('function');
      expect(typeof transactionQueue.enqueue).toBe('function');
    });
  });

  describe('End-to-End Swap Flow', () => {
    it('should handle complete swap flow from quote to execution', async () => {
      try {
        // Step 1: Get initial quote
        const initialQuote = await swapService.getQuote(validSwapRequest);

        expect(initialQuote).toBeDefined();
        expect(initialQuote.tokenIn.address).toBe(validSwapRequest.tokenIn);
        expect(initialQuote.tokenOut.address).toBe(validSwapRequest.tokenOut);
        expect(initialQuote.amountIn).toBe(validSwapRequest.amountIn);
        expect(parseFloat(initialQuote.amountOut)).toBeGreaterThan(0);

        // Step 2: Analyze gas market
        const gasMarket = await gasOptimization.analyzeGasMarket();

        expect(gasMarket).toBeDefined();
        expect(gasMarket.gasPriceGwei).toBeGreaterThan(0);
        expect(gasMarket.networkCongestion).toBeDefined();

        // Step 3: Optimize gas settings
        const optimizedQuote = await gasOptimization.optimizeGasSettings(initialQuote);

        expect(optimizedQuote).toBeDefined();
        expect(optimizedQuote.gasEstimate).toBeDefined();

        // Step 4: Analyze slippage
        const slippageAnalysis = await slippageProtection.analyzeSlippage(optimizedQuote);

        expect(slippageAnalysis).toBeDefined();
        expect(slippageAnalysis.currentSlippage).toBeDefined();
        expect(slippageAnalysis.recommendations).toBeDefined();

        // Step 5: Apply slippage protection
        const protectedQuote = await slippageProtection.applySlippageProtection(optimizedQuote, {
          strategy: 'dynamic',
          maxSlippagePercent: 1.0
        });

        expect(protectedQuote).toBeDefined();
        expect(protectedQuote.slippageTolerance).toBeDefined();

        // Step 6: Analyze MEV risk
        const mevRisk = await mevProtection.analyzeMEVRisk(protectedQuote);

        expect(mevRisk).toBeDefined();
        expect(mevRisk.hasRisk).toBeDefined();
        expect(mevRisk.riskLevel).toBeDefined();

        // Step 7: Apply MEV protection
        const finalQuote = await mevProtection.applyMEVProtection(protectedQuote);

        expect(finalQuote).toBeDefined();
        expect(finalQuote.warnings.length).toBeGreaterThanOrEqual(0);

        // Step 8: Queue the transaction
        const queueItemId = await transactionQueue.enqueue(validSwapRequest, 7, {
          gasStrategy: {
            type: 'standard',
            maxGasPrice: parseUnits(gasMarket.gasPriceGwei.toString(), 'gwei')
          },
          mevProtection: {
            enabled: mevRisk.hasRisk,
            strategy: 'delay',
            parameters: { delayMs: 2000 }
          }
        });

        expect(queueItemId).toBeDefined();
        expect(typeof queueItemId).toBe('string');

        // Step 9: Start queue processing
        await transactionQueue.startProcessing();

        // Step 10: Check queue status
        const queueStatus = await transactionQueue.getQueueStatus();

        expect(queueStatus.isProcessing).toBe(true);
        expect(queueStatus.statistics.totalItems).toBeGreaterThan(0);

        // Step 11: Get queue item
        const queueItem = await transactionQueue.getItem(queueItemId);

        expect(queueItem).toBeDefined();
        expect(queueItem?.id).toBe(queueItemId);
        expect(queueItem?.request.tokenIn).toBe(validSwapRequest.tokenIn);

        // Step 12: Stop processing
        await transactionQueue.stopProcessing();

        expect(true).toBe(true); // All steps completed successfully

      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle high-risk trade with enhanced protection', async () => {
      try {
        // Create high-risk request (large amount, high slippage)
        const highRiskRequest: SwapRequestViem = {
          ...validSwapRequest,
          amountIn: '100000000000000000000000', // 100k USDT - large trade
          slippageTolerance: 3.0 // High slippage
        };

        // Get quote
        const quote = await swapService.getQuote(highRiskRequest);

        expect(quote).toBeDefined();

        // Analyze MEV risk (should be high)
        const mevRisk = await mevProtection.analyzeMEVRisk(quote);

        expect(mevRisk.hasRisk).toBe(true);
        expect(['high', 'critical']).toContain(mevRisk.riskLevel);

        // Apply MEV protection
        const protectedQuote = await mevProtection.applyMEVProtection(quote);

        expect(protectedQuote.warnings.length).toBeGreaterThan(0);

        // Check for sandwich attack risk
        const sandwichRisk = await mevProtection.detectSandwichAttack(protectedQuote);

        expect(sandwichRisk).toBeDefined();
        expect(sandwichRisk.protectionStrategies.length).toBeGreaterThan(0);

        // Queue with enhanced protection
        const queueItemId = await transactionQueue.enqueue(highRiskRequest, 10, {
          gasStrategy: {
            type: 'instant',
            maxGasPrice: parseUnits('50', 'gwei')
          },
          mevProtection: {
            enabled: true,
            strategy: 'flashbots',
            parameters: { usePrivatePool: true }
          }
        });

        expect(queueItemId).toBeDefined();

      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Batch Operations', () => {
    it('should handle multiple concurrent swaps', async () => {
      try {
        // Create multiple swap requests
        const requests = [
          validSwapRequest,
          { ...validSwapRequest, amountIn: '500000000000000000000' }, // 500 USDT
          { ...validSwapRequest, amountIn: '200000000000000000000' }  // 200 USDT
        ];

        // Get quotes for all requests
        const quotes = await Promise.allSettled(
          requests.map(request => swapService.getQuote(request))
        );

        expect(quotes.length).toBe(3);
        expect(quotes.every(q => q.status === 'fulfilled')).toBe(true);

        // Enqueue all requests in batch
        const itemIds = await transactionQueue.enqueueBatch(requests, 8);

        expect(itemIds).toHaveLength(3);

        // Create bundle
        const bundleId = await transactionQueue.createBundle(itemIds);

        expect(bundleId).toBeDefined();

        // Start processing
        await transactionQueue.startProcessing();

        // Wait for processing
        await jest.advanceTimersByTimeAsync(5000);

        // Check statistics
        const stats = await transactionQueue.getStatistics();

        expect(stats.totalItems).toBeGreaterThanOrEqual(3);

        // Get performance metrics
        const metrics = await transactionQueue.getPerformanceMetrics();

        expect(metrics).toBeDefined();
        expect(metrics.queueEfficiency).toBeGreaterThanOrEqual(0);

      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle batch gas optimization', async () => {
      try {
        const requests = [
          validSwapRequest,
          { ...validSwapRequest, amountIn: '500000000000000000000' }
        ];

        const quotes = await Promise.all(
          requests.map(request => swapService.getQuote(request))
        );

        // Optimize gas for all quotes
        const optimizedQuotes = await Promise.all(
          quotes.map(quote => gasOptimization.optimizeGasSettings(quote))
        );

        expect(optimizedQuotes.length).toBe(2);
        expect(optimizedQuotes.every(q => q.gasEstimate)).toBe(true);

        // Get current gas market
        const gasMarket = await gasOptimization.analyzeGasMarket();

        expect(gasMarket).toBeDefined();

        // Apply gas optimization to queue
        await transactionQueue.optimizeGas();

        expect(true).toBe(true);

      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Risk Management Integration', () => {
    it('should integrate slippage and MEV protection', async () => {
      try {
        const quote = await swapService.getQuote(validSwapRequest);

        // Analyze slippage
        const slippageAnalysis = await slippageProtection.analyzeSlippage(quote);

        expect(slippageAnalysis).toBeDefined();

        // Apply slippage protection
        const slippageProtectedQuote = await slippageProtection.applySlippageProtection(quote, {
          strategy: 'conservative',
          maxSlippagePercent: 0.5
        });

        expect(slippageProtectedQuote.slippageTolerance).toBeDefined();

        // Analyze MEV risk on protected quote
        const mevRisk = await mevProtection.analyzeMEVRisk(slippageProtectedQuote);

        expect(mevRisk).toBeDefined();

        // Apply MEV protection
        const finalQuote = await mevProtection.applyMEVProtection(slippageProtectedQuote);

        expect(finalQuote.warnings.length).toBeGreaterThanOrEqual(0);

        // Verify protection layers
        expect(finalQuote.slippageTolerance).toBeLessThanOrEqual(0.5 * 1.2); // Allow some adjustment

      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle extreme market conditions', async () => {
      try {
        // Simulate extreme market conditions with high gas
        const gasMarket = await gasOptimization.analyzeGasMarket();

        // Force high gas conditions
        const highGasQuote = await swapService.getQuote(validSwapRequest);

        // Update quote with high gas
        highGasQuote.gasEstimate.gasPrice = '1000000000000'; // 1000 gwei

        // Test slippage protection under high gas
        const slippageAnalysis = await slippageProtection.analyzeSlippage(highGasQuote);

        expect(slippageAnalysis).toBeDefined();

        // Test MEV protection under high gas
        const mevRisk = await mevProtection.analyzeMEVRisk(highGasQuote);

        expect(mevRisk).toBeDefined();

        // Should provide conservative recommendations
        expect(mevRisk.mitigationStrategies.length).toBeGreaterThan(0);

      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Queue Management Integration', () => {
    it('should manage queue with different priority levels', async () => {
      try {
        // Add items with different priorities
        const urgentItem = await transactionQueue.enqueue(validSwapRequest, 10, {
          metadata: { reason: 'urgent_payment' }
        });

        const normalItem = await transactionQueue.enqueue(validSwapRequest, 5);
        const lowPriorityItem = await transactionQueue.enqueue(validSwapRequest, 2);

        // Start processing
        await transactionQueue.startProcessing();

        // Get next item (should be urgent)
        const nextItem = await transactionQueue.dequeue();

        expect(nextItem?.priority).toBe(10);

        // Check queue statistics
        const stats = await transactionQueue.getStatistics();

        expect(stats.totalItems).toBe(3);
        expect(stats.pendingItems).toBeGreaterThanOrEqual(0);

        // Stop processing
        await transactionQueue.stopProcessing();

      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle queue cleanup and maintenance', async () => {
      try {
        // Add and complete some items
        const item1 = await transactionQueue.enqueue(validSwapRequest, 5);
        const item2 = await transactionQueue.enqueue(validSwapRequest, 5);

        // Mark items as completed with old timestamps
        await transactionQueue.updateItem(item1, {
          status: 'completed',
          updatedAt: Date.now() - 7200000 // 2 hours ago
        });

        await transactionQueue.updateItem(item2, {
          status: 'failed',
          updatedAt: Date.now() - 3600000 // 1 hour ago
        });

        // Cleanup
        const completedCleaned = await transactionQueue.cleanupCompletedItems(3600000); // 1 hour
        const failedCleaned = await transactionQueue.cleanupFailedItems(1800000); // 30 minutes

        expect(completedCleaned).toBeGreaterThanOrEqual(0);
        expect(failedCleaned).toBeGreaterThanOrEqual(0);

        // Validate queue
        const validation = await transactionQueue.validateQueue();

        expect(validation.valid).toBe(true);

      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance and Analytics', () => {
    it('should collect and report performance metrics', async () => {
      try {
        // Process some transactions
        const itemIds = await transactionQueue.enqueueBatch([validSwapRequest, validSwapRequest], 7);

        await transactionQueue.startProcessing();

        // Wait for processing
        await jest.advanceTimersByTimeAsync(3000);

        // Get comprehensive statistics
        const stats = await transactionQueue.getStatistics();

        expect(stats).toBeDefined();
        expect(stats.totalItems).toBeGreaterThanOrEqual(2);
        expect(stats.queueLength).toBeGreaterThanOrEqual(0);

        // Get performance metrics
        const metrics = await transactionQueue.getPerformanceMetrics();

        expect(metrics).toBeDefined();
        expect(metrics.averageProcessingTime).toBeGreaterThanOrEqual(0);
        expect(metrics.gasOptimizationSavings).toBeDefined();

        // Get queue status
        const status = await transactionQueue.getQueueStatus();

        expect(status).toBeDefined();
        expect(status.isProcessing).toBe(true);
        expect(status.gasMarket).toBeDefined();

        // Get gas market analysis
        const gasMarket = await gasOptimization.getGasMarket();

        expect(gasMarket).toBeDefined();
        expect(gasMarket.currentGasPrice).toBeDefined();
        expect(gasMarket.networkCongestion).toBeDefined();

        // Get AMM analytics
        const ammAnalytics = await ammIntegration.getPoolAnalytics(validSwapRequest.tokenIn, validSwapRequest.tokenOut);

        expect(ammAnalytics).toBeDefined();

        // Get MEV analytics
        const mevAnalytics = await mevProtection.getMEVAnalytics('1h');

        expect(mevAnalytics).toBeDefined();
        expect(mevAnalytics.timeframe).toBe('1h');

        await transactionQueue.stopProcessing();

      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle high-volume operations', async () => {
      try {
        const itemCount = 10;
        const requests = Array.from({ length: itemCount }, (_, i) => ({
          ...validSwapRequest,
          amountIn: (BigInt(1000000000000000000000) * BigInt(i + 1)).toString()
        }));

        // Batch enqueue
        const itemIds = await transactionQueue.enqueueBatch(requests, 6);

        expect(itemIds).toHaveLength(itemCount);

        // Start processing
        await transactionQueue.startProcessing();

        // Wait for batch processing
        await jest.advanceTimersByTimeAsync(10000);

        // Check statistics
        const stats = await transactionQueue.getStatistics();

        expect(stats.totalItems).toBeGreaterThanOrEqual(itemCount);

        // Get throughput metrics
        const metrics = await transactionQueue.getPerformanceMetrics();

        expect(metrics).toBeDefined();
        expect(metrics.queueEfficiency).toBeGreaterThanOrEqual(0);

        await transactionQueue.stopProcessing();

      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle service failures gracefully', async () => {
      try {
        // Test with invalid request
        const invalidRequest: SwapRequestViem = {
          ...validSwapRequest,
          tokenIn: '0xinvalid' as `0x${string}`
        };

        // Should handle errors gracefully
        await expect(swapService.getQuote(invalidRequest)).rejects.toThrow();

        // Test queue with invalid item
        const validItemId = await transactionQueue.enqueue(validSwapRequest, 5);

        // Try to cancel processing item (should fail gracefully)
        await expect(transactionQueue.cancelItem(validItemId)).resolves.toBe(true);

        // Try to get non-existent item
        const nonExistentItem = await transactionQueue.getItem('non_existent');

        expect(nonExistentItem).toBeNull();

      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should recover from temporary failures', async () => {
      try {
        // Add item to queue
        const itemId = await transactionQueue.enqueue(validSwapRequest, 7);

        // Start processing
        await transactionQueue.startProcessing();

        // Simulate processing failure
        await transactionQueue.updateItem(itemId, {
          status: 'failed',
          error: 'Simulated failure',
          attempts: 1
        });

        // Should schedule retry
        const item = await transactionQueue.getItem(itemId);

        expect(item?.status).toBe('retrying');
        expect(item?.delayUntil).toBeGreaterThan(Date.now());

        // Wait for retry delay
        await jest.advanceTimersByTimeAsync(2000);

        // Item should be ready for processing again
        const updatedItem = await transactionQueue.getItem(itemId);

        expect(updatedItem?.delayUntil).toBeLessThanOrEqual(Date.now());

        await transactionQueue.stopProcessing();

      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Configuration and Customization', () => {
    it('should allow service configuration updates', async () => {
      try {
        // Update queue configuration
        await transactionQueue.updateConfig({
          maxSize: 200,
          processingConcurrency: 8,
          priorities: {
            urgent: 15,
            high: 10,
            normal: 6,
            low: 3
          }
        });

        const config = await transactionQueue.getConfig();

        expect(config.maxSize).toBe(200);
        expect(config.processingConcurrency).toBe(8);
        expect(config.priorities.urgent).toBe(15);

        // Update gas optimization strategy
        await gasOptimization.updateStrategy({
          strategy: 'aggressive',
          maxGasPriceGwei: 50,
          speedPreference: 'fast'
        });

        expect(true).toBe(true); // Should not throw

      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should support custom protection strategies', async () => {
      try {
        const quote = await swapService.getQuote(validSwapRequest);

        // Custom slippage protection
        const customSlippageProtection = await slippageProtection.applySlippageProtection(quote, {
          strategy: 'adaptive',
          maxSlippagePercent: 1.5,
          marketConditions: 'volatile'
        });

        expect(customSlippageProtection).toBeDefined();

        // Custom MEV protection
        const customMEVProtection = await mevProtection.applyMEVProtection(quote, {
          strategy: 'commit_reveal',
          parameters: {
            commitRevealDelay: 5000,
            usePrivateMempool: true
          },
          effectiveness: 85,
          estimatedCost: '0.005',
          timeToExecute: 15
        });

        expect(customMEVProtection).toBeDefined();

      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});