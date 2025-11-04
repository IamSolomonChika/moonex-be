/**
 * BSC Transaction Queue Service (Viem)
 * Advanced transaction queue and management system for BSC trading using Viem
 */

import { formatUnits, parseUnits, Hex, Address } from 'viem';
import logger from '../../../utils/logger.js';
import type {
  SwapTransactionViem,
  SwapRequestViem,
  SwapQuoteViem,
  TransactionStatus,
  SwapExecutionDetailsViem
} from '../types/trading-types-viem.js';
import { SwapServiceViem } from './swap-service-viem.js';
import { createPublicClient, createWalletClient, http } from 'viem';
import { bsc } from 'viem/chains';
import { BSCCacheManager } from '../cache/cache-manager.js';

/**
 * Queue Item (Viem)
 */
export interface QueueItemViem {
  id: string;
  type: 'swap' | 'approval' | 'custom' | 'batch_swap' | 'multicall';
  priority: number; // 1-10, higher = more urgent
  request: SwapRequestViem;
  quote?: SwapQuoteViem;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'retrying' | 'gas_optimizing';
  attempts: number;
  maxAttempts: number;
  delayUntil?: number;
  createdAt: number;
  updatedAt: number;
  scheduledFor?: number;
  transaction?: SwapTransactionViem;
  error?: string;
  metadata: Record<string, any>;
  gasStrategy?: {
    type: 'economy' | 'standard' | 'fast' | 'instant' | 'dynamic';
    maxGasPrice?: bigint;
    maxPriorityFee?: bigint;
  };
  mevProtection?: {
    enabled: boolean;
    strategy: 'delay' | 'flashbots' | 'private_mempool' | 'commit_reveal';
    parameters: Record<string, any>;
  };
}

/**
 * Queue Configuration (Viem)
 */
export interface QueueConfigViem {
  maxSize: number;
  processingConcurrency: number;
  retryPolicy: {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    jitterMs: number;
  };
  priorities: {
    urgent: number;
    high: number;
    normal: number;
    low: number;
  };
  scheduling: {
    enabled: boolean;
    batchProcessing: boolean;
    batchSize: number;
    batchDelayMs: number;
    smartScheduling: boolean;
    gasThresholdGwei: number;
  };
  viem: {
    chainId: number;
    rpcUrls: string[];
    blockTimeMs: number;
    gasMultiplier: number;
  };
  optimization: {
    enabled: boolean;
    multicall: boolean;
    bundleTransactions: boolean;
    maxBundleSize: number;
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    healthCheckInterval: number;
  };
}

/**
 * Queue Statistics (Viem)
 */
export interface QueueStatisticsViem {
  totalItems: number;
  pendingItems: number;
  processingItems: number;
  completedItems: number;
  failedItems: number;
  cancelledItems: number;
  averageProcessingTime: number;
  successRate: number;
  throughputPerSecond: number;
  queueLength: number;
  oldestItemAge: number;
  gasOptimizationSavings: string; // in BNB
  mevProtectionSuccess: number;
  bundleEfficiency: number;
  networkLatency: number;
}

/**
 * Gas Market Analysis (Viem)
 */
export interface GasMarketAnalysisViem {
  currentGasPrice: bigint;
  suggestedGasPrice: bigint;
  networkCongestion: 'low' | 'medium' | 'high' | 'critical';
  blockTime: number;
  baseFee: bigint;
  priorityFee: bigint;
  nextBlockFee: bigint;
}

/**
 * Transaction Queue Service Interface (Viem)
 */
export interface ITransactionQueueServiceViem {
  // Queue management
  enqueue(request: SwapRequestViem, priority?: number, options?: QueueItemOptionsViem): Promise<string>;
  dequeue(): Promise<QueueItemViem | null>;
  getItem(itemId: string): Promise<QueueItemViem | null>;
  updateItem(itemId: string, updates: Partial<QueueItemViem>): Promise<void>;
  cancelItem(itemId: string): Promise<boolean>;
  cancelItems(itemIds: string[]): Promise<number>;

  // Batch operations
  enqueueBatch(requests: SwapRequestViem[], priority?: number): Promise<string[]>;
  createBundle(items: string[]): Promise<string>;

  // Processing
  startProcessing(): Promise<void>;
  stopProcessing(): Promise<void>;
  pauseProcessing(): Promise<void>;
  resumeProcessing(): Promise<void>;
  forceProcessing(itemId?: string): Promise<void>;

  // Gas optimization
  optimizeGas(): Promise<void>;
  setGasStrategy(strategy: QueueItemViem['gasStrategy']): Promise<void>;

  // Monitoring and analytics
  getStatistics(): Promise<QueueStatisticsViem>;
  getQueueStatus(): Promise<any>;
  getItemHistory(limit?: number): Promise<QueueItemViem[]>;
  getGasMarket(): Promise<GasMarketAnalysisViem>;
  getPerformanceMetrics(): Promise<any>;

  // Configuration
  updateConfig(config: Partial<QueueConfigViem>): Promise<void>;
  getConfig(): Promise<QueueConfigViem>;

  // Cleanup and maintenance
  cleanupCompletedItems(olderThan?: number): Promise<number>;
  cleanupFailedItems(olderThan?: number): Promise<number>;
  reoptimizeQueue(): Promise<void>;
  validateQueue(): Promise<{ valid: boolean; issues: string[] }>;
}

/**
 * Queue Item Options (Viem)
 */
export interface QueueItemOptionsViem {
  gasStrategy?: QueueItemViem['gasStrategy'];
  mevProtection?: QueueItemViem['mevProtection'];
  scheduledFor?: number;
  maxAttempts?: number;
  metadata?: Record<string, any>;
}

/**
 * Transaction Queue Service Implementation (Viem)
 */
export class TransactionQueueServiceViem implements ITransactionQueueServiceViem {
  private config: QueueConfigViem;
  private publicClient: any; // Simplified type for Viem 2.38.5 compatibility
  private cache: BSCCacheManager;
  private swapService: SwapServiceViem;

  // Queue storage
  private queue: Map<string, QueueItemViem> = new Map();
  private processing: Set<string> = new Set();
  private bundles: Map<string, string[]> = new Map(); // bundleId -> itemIds

  // Processing state
  private isProcessing: boolean = false;
  private isPaused: boolean = false;
  private processingInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;

  // Statistics
  private statistics: QueueStatisticsViem = {
    totalItems: 0,
    pendingItems: 0,
    processingItems: 0,
    completedItems: 0,
    failedItems: 0,
    cancelledItems: 0,
    averageProcessingTime: 0,
    successRate: 0,
    throughputPerSecond: 0,
    queueLength: 0,
    oldestItemAge: 0,
    gasOptimizationSavings: '0',
    mevProtectionSuccess: 0,
    bundleEfficiency: 0,
    networkLatency: 0
  };

  // Performance tracking
  private performanceMetrics = {
    processingTimes: [] as number[],
    gasPrices: [] as bigint[],
    throughputMeasurements: [] as number[],
    errors: [] as { timestamp: number; error: string; itemId: string }[]
  };

  constructor(config?: Partial<QueueConfigViem>) {
    this.config = {
      maxSize: 1000,
      processingConcurrency: 5,
      retryPolicy: {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2.0,
        jitterMs: 500
      },
      priorities: {
        urgent: 10,
        high: 7,
        normal: 5,
        low: 3
      },
      scheduling: {
        enabled: true,
        batchProcessing: true,
        batchSize: 3,
        batchDelayMs: 500,
        smartScheduling: true,
        gasThresholdGwei: 20
      },
      viem: {
        chainId: bsc.id,
        rpcUrls: ['https://bsc-dataseed1.binance.org'],
        blockTimeMs: 3000,
        gasMultiplier: 1.1
      },
      optimization: {
        enabled: true,
        multicall: true,
        bundleTransactions: true,
        maxBundleSize: 5
      },
      monitoring: {
        enabled: true,
        metricsInterval: 10000, // 10 seconds
        healthCheckInterval: 30000 // 30 seconds
      },
      ...config
    };

    this.publicClient = createPublicClient({
      chain: bsc,
      transport: http()
    });

    this.cache = new BSCCacheManager();
    this.swapService = new SwapServiceViem();

    // Load persisted queue on startup
    this.loadPersistedQueue().catch(error => {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to load persisted queue');
    });
  }

  /**
   * Add item to queue using Viem
   */
  async enqueue(request: SwapRequestViem, priority: number = this.config.priorities.normal, options: QueueItemOptionsViem = {}): Promise<string> {
    logger.debug({
      tokenIn: request.tokenIn,
      tokenOut: request.tokenOut,
      priority,
      options
    }, 'Adding item to transaction queue (Viem)');

    try {
      // Check queue size limit
      if (this.queue.size >= this.config.maxSize) {
        throw new Error('Queue is full');
      }

      const itemId = this.generateItemId();
      const now = Date.now();

      const queueItem: QueueItemViem = {
        id: itemId,
        type: 'swap',
        priority,
        request,
        status: 'pending',
        attempts: 0,
        maxAttempts: options.maxAttempts || this.config.retryPolicy.maxAttempts,
        createdAt: now,
        updatedAt: now,
        scheduledFor: options.scheduledFor,
        gasStrategy: options.gasStrategy || {
          type: 'dynamic',
          maxGasPrice: parseUnits('20', 'gwei'),
          maxPriorityFee: parseUnits('1', 'gwei')
        },
        mevProtection: options.mevProtection || {
          enabled: true,
          strategy: 'delay',
          parameters: { delayMs: 2000 }
        },
        metadata: {
          urgency: this.determineUrgency(request),
          estimatedGasCost: await this.estimateGasCost(request),
          networkLatency: await this.measureNetworkLatency(),
          ...options.metadata
        }
      };

      this.queue.set(itemId, queueItem);
      this.statistics.totalItems++;
      this.statistics.pendingItems++;

      // Cache the queue
      await this.persistQueue();

      logger.info({
        itemId,
        priority,
        queueLength: this.queue.size,
        gasStrategy: queueItem.gasStrategy?.type,
        mevProtection: queueItem.mevProtection?.enabled
      }, 'Item added to queue successfully (Viem)');

      return itemId;

    } catch (error) {
      logger.error({
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to enqueue item');
      throw error;
    }
  }

  /**
   * Get next item from queue using Viem
   */
  async dequeue(): Promise<QueueItemViem | null> {
    logger.debug('Dequeuing next item (Viem)');

    try {
      // Get current gas market conditions using Viem
      const gasMarket = await this.getGasMarket();

      // Find highest priority item that's ready to process
      let bestItem: QueueItemViem | null = null;
      let bestScore = -1;

      for (const item of this.queue.values()) {
        if (item.status !== 'pending' && item.status !== 'retrying' && item.status !== 'gas_optimizing') continue;

        // Check if item is delayed
        if (item.delayUntil && Date.now() < item.delayUntil) continue;

        // Check if item is scheduled for future
        if (item.scheduledFor && Date.now() < item.scheduledFor) continue;

        // Check gas threshold for smart scheduling
        if (this.config.scheduling.smartScheduling && this.config.scheduling.gasThresholdGwei > 0) {
          const currentGasPrice = Number(formatUnits(gasMarket.currentGasPrice, 'gwei'));
          if (currentGasPrice > this.config.scheduling.gasThresholdGwei) {
            // Only process high-priority items during high gas
            if (item.priority < this.config.priorities.high) {
              item.status = 'gas_optimizing';
              continue;
            }
          }
        }

        // Calculate priority score with gas consideration
        const score = this.calculatePriorityScore(item, gasMarket);
        if (score > bestScore) {
          bestScore = score;
          bestItem = item;
        }
      }

      if (bestItem) {
        // Update item status
        bestItem.status = 'processing';
        bestItem.updatedAt = Date.now();
        this.processing.add(bestItem.id);
        this.statistics.pendingItems--;
        this.statistics.processingItems++;

        await this.persistQueue();

        logger.info({
          itemId: bestItem.id,
          priority: bestItem.priority,
          queueLength: this.queue.size - this.processing.size,
          gasPrice: formatUnits(gasMarket.currentGasPrice, 'gwei')
        }, 'Item dequeued successfully (Viem)');

        return bestItem;
      }

      return null;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to dequeue item');
      return null;
    }
  }

  /**
   * Get item by ID
   */
  async getItem(itemId: string): Promise<QueueItemViem | null> {
    return this.queue.get(itemId) || null;
  }

  /**
   * Update item
   */
  async updateItem(itemId: string, updates: Partial<QueueItemViem>): Promise<void> {
    const item = this.queue.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }

    Object.assign(item, updates);
    item.updatedAt = Date.now();

    // Update statistics
    this.updateStatistics();

    await this.persistQueue();
  }

  /**
   * Cancel item
   */
  async cancelItem(itemId: string): Promise<boolean> {
    const item = this.queue.get(itemId);
    if (!item) {
      return false;
    }

    if (item.status === 'processing') {
      throw new Error('Cannot cancel item that is currently processing');
    }

    item.status = 'cancelled';
    item.updatedAt = Date.now();

    this.statistics.pendingItems--;
    this.statistics.cancelledItems++;

    await this.persistQueue();

    logger.info({
      itemId,
      queueLength: this.queue.size
    }, 'Item cancelled successfully');

    return true;
  }

  /**
   * Cancel multiple items
   */
  async cancelItems(itemIds: string[]): Promise<number> {
    let cancelledCount = 0;

    for (const itemId of itemIds) {
      try {
        if (await this.cancelItem(itemId)) {
          cancelledCount++;
        }
      } catch (error) {
        logger.debug({ itemId, error }, 'Failed to cancel item');
      }
    }

    logger.info({ cancelledCount, totalRequested: itemIds.length }, 'Batch cancellation completed');
    return cancelledCount;
  }

  /**
   * Add multiple items to queue
   */
  async enqueueBatch(requests: SwapRequestViem[], priority: number = this.config.priorities.normal): Promise<string[]> {
    const itemIds: string[] = [];

    try {
      for (const request of requests) {
        const itemId = await this.enqueue(request, priority, {
          gasStrategy: {
            type: 'economy',
            maxGasPrice: parseUnits('15', 'gwei')
          }
        });
        itemIds.push(itemId);
      }

      // Consider creating a bundle if optimization is enabled
      if (this.config.optimization.bundleTransactions && itemIds.length > 1) {
        await this.createBundle(itemIds);
      }

      logger.info({ itemCount: itemIds.length }, 'Batch enqueue completed');
      return itemIds;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Batch enqueue failed');
      throw error;
    }
  }

  /**
   * Create transaction bundle
   */
  async createBundle(itemIds: string[]): Promise<string> {
    const bundleId = this.generateBundleId();
    this.bundles.set(bundleId, itemIds);

    // Update items to reference the bundle
    for (const itemId of itemIds) {
      const item = this.queue.get(itemId);
      if (item) {
        item.metadata.bundleId = bundleId;
        item.type = 'batch_swap';
      }
    }

    logger.info({ bundleId, itemCount: itemIds.length }, 'Transaction bundle created');
    return bundleId;
  }

  /**
   * Start processing queue with Viem integration
   */
  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      logger.debug('Queue processing is already running');
      return;
    }

    logger.info('Starting transaction queue processing (Viem)');

    this.isProcessing = true;
    this.isPaused = false;

    // Start processing loop
    this.processingInterval = setInterval(async () => {
      if (!this.isPaused && this.processing.size < this.config.processingConcurrency) {
        await this.processBatch();
      }
    }, 1000);

    // Start monitoring if enabled
    if (this.config.monitoring.enabled) {
      this.startMonitoring();
    }

    // Start gas price optimization if enabled
    if (this.config.scheduling.enabled) {
      this.startGasOptimization();
    }
  }

  /**
   * Stop processing queue
   */
  async stopProcessing(): Promise<void> {
    if (!this.isProcessing) {
      logger.debug('Queue processing is not running');
      return;
    }

    logger.info('Stopping transaction queue processing');

    this.isProcessing = false;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Pause processing
   */
  async pauseProcessing(): Promise<void> {
    logger.info('Pausing transaction queue processing');
    this.isPaused = true;
  }

  /**
   * Resume processing
   */
  async resumeProcessing(): Promise<void> {
    logger.info('Resuming transaction queue processing');
    this.isPaused = false;
  }

  /**
   * Force processing of specific item or next in queue
   */
  async forceProcessing(itemId?: string): Promise<void> {
    try {
      if (itemId) {
        const item = this.queue.get(itemId);
        if (item && (item.status === 'pending' || item.status === 'retrying')) {
          await this.processItem(item);
        }
      } else {
        await this.processNextItem();
      }
    } catch (error) {
      logger.error({
        itemId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Force processing failed');
    }
  }

  /**
   * Optimize gas for all pending items
   */
  async optimizeGas(): Promise<void> {
    logger.debug('Optimizing gas for pending items');

    try {
      const gasMarket = await this.getGasMarket();
      const pendingItems = Array.from(this.queue.values()).filter(
        item => item.status === 'pending' || item.status === 'retrying'
      );

      for (const item of pendingItems) {
        if (item.gasStrategy?.type === 'dynamic') {
          // Update gas strategy based on current market
          item.gasStrategy.maxGasPrice = gasMarket.suggestedGasPrice;
          item.gasStrategy.maxPriorityFee = gasMarket.priorityFee;
        }
      }

      await this.persistQueue();
      logger.info({ optimizedItems: pendingItems.length }, 'Gas optimization completed');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Gas optimization failed');
    }
  }

  /**
   * Set gas strategy for all items
   */
  async setGasStrategy(strategy: QueueItemViem['gasStrategy']): Promise<void> {
    logger.debug({ strategy: strategy.type }, 'Setting gas strategy');

    for (const item of this.queue.values()) {
      item.gasStrategy = { ...strategy };
    }

    await this.persistQueue();
  }

  /**
   * Get queue statistics
   */
  async getStatistics(): Promise<QueueStatisticsViem> {
    this.updateStatistics();
    return { ...this.statistics };
  }

  /**
   * Get detailed queue status
   */
  async getQueueStatus(): Promise<any> {
    const gasMarket = await this.getGasMarket();

    return {
      isProcessing: this.isProcessing,
      isPaused: this.isPaused,
      config: this.config,
      statistics: this.statistics,
      gasMarket: {
        currentGasPrice: formatUnits(gasMarket.currentGasPrice, 'gwei'),
        suggestedGasPrice: formatUnits(gasMarket.suggestedGasPrice, 'gwei'),
        congestion: gasMarket.networkCongestion,
        blockTime: gasMarket.blockTime
      },
      bundles: this.bundles.size,
      oldestItemAge: this.statistics.oldestItemAge,
      nextProcessingIn: this.getNextProcessingDelay(),
      performanceMetrics: this.performanceMetrics
    };
  }

  /**
   * Get item history
   */
  async getItemHistory(limit: number = 100): Promise<QueueItemViem[]> {
    const allItems = Array.from(this.queue.values());

    return allItems
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  /**
   * Get gas market analysis using Viem
   */
  async getGasMarket(): Promise<GasMarketAnalysisViem> {
    try {
      const feeData = await this.publicClient.getFeeData();
      const latestBlock = await this.publicClient.getBlock();

      const currentGasPrice = feeData.gasPrice || parseUnits('20', 'gwei');
      const baseFee = feeData.baseFeePerGas || parseUnits('10', 'gwei');
      const priorityFee = feeData.maxPriorityFeePerGas || parseUnits('1', 'gwei');

      // Determine network congestion
      let congestion: 'low' | 'medium' | 'high' | 'critical' = 'low';
      const gasPriceGwei = Number(formatUnits(currentGasPrice, 'gwei'));

      if (gasPriceGwei > 50) congestion = 'critical';
      else if (gasPriceGwei > 30) congestion = 'high';
      else if (gasPriceGwei > 15) congestion = 'medium';

      // Suggest optimal gas price
      const suggestedGasPrice = currentGasPrice * BigInt(Math.floor(this.config.viem.gasMultiplier * 100)) / BigInt(100);

      return {
        currentGasPrice,
        suggestedGasPrice,
        networkCongestion: congestion,
        blockTime: this.config.viem.blockTimeMs,
        baseFee,
        priorityFee,
        nextBlockFee: suggestedGasPrice
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get gas market');

      // Return safe defaults
      return {
        currentGasPrice: parseUnits('20', 'gwei'),
        suggestedGasPrice: parseUnits('22', 'gwei'),
        networkCongestion: 'medium',
        blockTime: this.config.viem.blockTimeMs,
        baseFee: parseUnits('10', 'gwei'),
        priorityFee: parseUnits('1', 'gwei'),
        nextBlockFee: parseUnits('22', 'gwei')
      };
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<any> {
    return {
      ...this.performanceMetrics,
      averageProcessingTime: this.calculateAverageProcessingTime(),
      gasOptimizationSavings: this.calculateGasSavings(),
      queueEfficiency: this.calculateQueueEfficiency(),
      errorRate: this.calculateErrorRate()
    };
  }

  /**
   * Update queue configuration
   */
  async updateConfig(config: Partial<QueueConfigViem>): Promise<void> {
    this.config = { ...this.config, ...config };
    await this.cache.set('queue_config_viem', this.config, 86400000); // 24 hours
    logger.info('Queue configuration updated');
  }

  /**
   * Get current configuration
   */
  async getConfig(): Promise<QueueConfigViem> {
    return this.config;
  }

  /**
   * Cleanup completed items
   */
  async cleanupCompletedItems(olderThan: number = 3600000): Promise<number> { // 1 hour default
    const cutoffTime = Date.now() - olderThan;
    let cleanedCount = 0;

    for (const [id, item] of this.queue.entries()) {
      if ((item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled') &&
          item.updatedAt < cutoffTime) {
        this.queue.delete(id);
        cleanedCount++;
      }
    }

    await this.persistQueue();

    logger.info({
      cleanedCount,
      olderThan,
      remainingItems: this.queue.size
    }, 'Completed items cleaned up');

    return cleanedCount;
  }

  /**
   * Cleanup failed items
   */
  async cleanupFailedItems(olderThan: number = 1800000): Promise<number> { // 30 minutes default
    const cutoffTime = Date.now() - olderThan;
    let cleanedCount = 0;

    for (const [id, item] of this.queue.entries()) {
      if (item.status === 'failed' && item.updatedAt < cutoffTime) {
        this.queue.delete(id);
        cleanedCount++;
      }
    }

    await this.persistQueue();

    logger.info({
      cleanedCount,
      olderThan,
      remainingItems: this.queue.size
    }, 'Failed items cleaned up');

    return cleanedCount;
  }

  /**
   * Reoptimize queue based on current conditions
   */
  async reoptimizeQueue(): Promise<void> {
    logger.info('Reoptimizing queue');

    try {
      await this.optimizeGas();

      // Reorder items based on updated priorities
      const gasMarket = await this.getGasMarket();

      for (const item of this.queue.values()) {
        if (item.status === 'pending' || item.status === 'retrying') {
          // Update priority scores
          item.metadata.currentScore = this.calculatePriorityScore(item, gasMarket);
        }
      }

      await this.persistQueue();
      logger.info('Queue reoptimization completed');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Queue reoptimization failed');
    }
  }

  /**
   * Validate queue integrity
   */
  async validateQueue(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check for orphaned processing items
      for (const itemId of this.processing) {
        if (!this.queue.has(itemId)) {
          issues.push(`Orphaned processing item: ${itemId}`);
        }
      }

      // Check for invalid timestamps
      const now = Date.now();
      for (const [id, item] of this.queue.entries()) {
        if (item.createdAt > now) {
          issues.push(`Invalid creation time for item ${id}: ${item.createdAt}`);
        }
        if (item.updatedAt > now) {
          issues.push(`Invalid update time for item ${id}: ${item.updatedAt}`);
        }
      }

      // Check for inconsistent statistics
      const actualPending = Array.from(this.queue.values()).filter(
        item => item.status === 'pending' || item.status === 'retrying'
      ).length;

      if (actualPending !== this.statistics.pendingItems) {
        issues.push(`Statistics mismatch: actual pending ${actualPending}, recorded ${this.statistics.pendingItems}`);
      }

      logger.info({ valid: issues.length === 0, issueCount: issues.length }, 'Queue validation completed');
      return { valid: issues.length === 0, issues };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Queue validation failed');
      return { valid: false, issues: ['Validation failed due to error'] };
    }
  }

  // Private helper methods

  private generateItemId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBundleId(): string {
    return `bundle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineUrgency(request: SwapRequestViem): 'low' | 'medium' | 'high' | 'urgent' {
    try {
      const amountNum = parseFloat(request.amountIn || request.amountOut || '0');

      if (amountNum > 100000) return 'urgent';
      if (amountNum > 10000) return 'high';
      if (amountNum > 1000) return 'medium';
      return 'low';
    } catch (error) {
      return 'medium';
    }
  }

  private async estimateGasCost(request: SwapRequestViem): Promise<string> {
    try {
      const quote = await this.swapService.getQuote(request);
      return quote.gasEstimate.estimatedCostBNB || '0';
    } catch (error) {
      return '0';
    }
  }

  private async measureNetworkLatency(): Promise<number> {
    try {
      const startTime = Date.now();
      await this.publicClient.getBlockNumber();
      return Date.now() - startTime;
    } catch (error) {
      return 1000; // Default 1 second
    }
  }

  private calculatePriorityScore(item: QueueItemViem, gasMarket: GasMarketAnalysisViem): number {
    let score = item.priority * 10;

    // Add urgency bonus
    if (item.metadata.urgency === 'urgent') score += 50;
    else if (item.metadata.urgency === 'high') score += 30;
    else if (item.metadata.urgency === 'medium') score += 15;

    // Add age penalty (older items get higher priority to prevent starvation)
    const age = Date.now() - item.createdAt;
    score += Math.min(age / 10000, 20); // Max 20 points for age

    // Add retry penalty (failed items get lower priority)
    if (item.status === 'retrying') {
      score -= item.attempts * 5;
    }

    // Gas optimization bonus during low congestion
    if (gasMarket.networkCongestion === 'low' && item.gasStrategy?.type === 'economy') {
      score += 10;
    }

    return score;
  }

  private async processBatch(): Promise<void> {
    if (this.config.scheduling.batchProcessing) {
      // Process multiple items in batch
      const batchSize = Math.min(
        this.config.scheduling.batchSize,
        this.config.processingConcurrency - this.processing.size
      );

      const promises = [];
      for (let i = 0; i < batchSize; i++) {
        promises.push(this.processNextItem());
      }

      await Promise.allSettled(promises);

      // Add delay between batches
      if (this.config.scheduling.batchDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, this.config.scheduling.batchDelayMs));
      }
    } else {
      // Process single item
      await this.processNextItem();
    }
  }

  private async processNextItem(): Promise<void> {
    try {
      const item = await this.dequeue();
      if (!item) return;

      const startTime = Date.now();

      try {
        // Process the item
        await this.processItem(item);

        // Mark as completed
        item.status = 'completed';
        item.transaction = {
          // Would be populated during processing
          hash: '0x' as Hex,
          from: '0x' as Address,
          value: '0',
          data: '0x' as Hex,
          gasLimit: '0',
          status: 'success'
        } as SwapTransactionViem;

        const processingTime = Date.now() - startTime;
        item.metadata.processingTime = processingTime;

        // Track performance metrics
        this.performanceMetrics.processingTimes.push(processingTime);
        if (this.performanceMetrics.processingTimes.length > 100) {
          this.performanceMetrics.processingTimes = this.performanceMetrics.processingTimes.slice(-50);
        }

        logger.info({
          itemId: item.id,
          processingTime
        }, 'Item processed successfully (Viem)');

      } catch (error) {
        await this.handleProcessingError(item, error, startTime);
      }

      // Remove from processing set
      this.processing.delete(item.id);
      this.statistics.processingItems--;

      // Update statistics
      if (item.status === 'completed') {
        this.statistics.completedItems++;
      } else if (item.status === 'failed') {
        this.statistics.failedItems++;
      }

      await this.updateItem(item.id, item);

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Error processing queue item');
    }
  }

  private async processItem(item: QueueItemViem): Promise<void> {
    // This would contain the actual processing logic using Viem
    // For now, simulate processing with realistic delays
    const processingTime = 1000 + Math.random() * 2000; // 1-3 seconds

    await new Promise(resolve => setTimeout(resolve, processingTime));

    // Simulate occasional failures
    if (Math.random() < 0.1) { // 10% failure rate
      throw new Error('Simulated processing failure');
    }
  }

  private async handleProcessingError(item: QueueItemViem, error: any, startTime: number): Promise<void> {
    const processingTime = Date.now() - startTime;
    item.metadata.processingTime = processingTime;
    item.error = error instanceof Error ? error.message : 'Unknown error';

    // Track error metrics
    this.performanceMetrics.errors.push({
      timestamp: Date.now(),
      error: item.error,
      itemId: item.id
    });

    // Keep only recent errors
    if (this.performanceMetrics.errors.length > 50) {
      this.performanceMetrics.errors = this.performanceMetrics.errors.slice(-25);
    }

    item.attempts++;

    if (item.attempts < item.maxAttempts) {
      // Schedule retry with jitter
      item.status = 'retrying';
      const baseDelay = this.calculateRetryDelay(item.attempts);
      const jitter = Math.random() * this.config.retryPolicy.jitterMs;
      item.delayUntil = Date.now() + baseDelay + jitter;

      logger.warn({
        itemId: item.id,
        attempt: item.attempts,
        maxAttempts: item.maxAttempts,
        retryDelay: baseDelay + jitter,
        error: item.error
      }, 'Item failed, scheduling retry');

    } else {
      // Mark as failed
      item.status = 'failed';

      logger.error({
        itemId: item.id,
        attempts: item.attempts,
        error: item.error
      }, 'Item failed after maximum attempts');
    }
  }

  private calculateRetryDelay(attempt: number): number {
    const { baseDelayMs, maxDelayMs, backoffMultiplier } = this.config.retryPolicy;
    return Math.min(
      baseDelayMs * Math.pow(backoffMultiplier, attempt - 1),
      maxDelayMs
    );
  }

  private updateStatistics(): void {
    this.statistics.queueLength = this.queue.size;
    this.statistics.pendingItems = Array.from(this.queue.values()).filter(
      item => item.status === 'pending' || item.status === 'retrying'
    ).length;
    this.statistics.processingItems = this.processing.size;

    // Calculate success rate
    const totalProcessed = this.statistics.completedItems + this.statistics.failedItems;
    if (totalProcessed > 0) {
      this.statistics.successRate = (this.statistics.completedItems / totalProcessed) * 100;
    }

    // Calculate oldest item age
    const pendingItems = Array.from(this.queue.values()).filter(
      item => item.status === 'pending' || item.status === 'retrying'
    );
    if (pendingItems.length > 0) {
      const oldestItem = pendingItems.reduce((oldest, item) =>
        item.createdAt < oldest.createdAt ? item : oldest
      );
      this.statistics.oldestItemAge = Date.now() - oldestItem.createdAt;
    } else {
      this.statistics.oldestItemAge = 0;
    }

    // Calculate throughput (items per second over last minute)
    const recentItems = Array.from(this.queue.values()).filter(
      item => item.status === 'completed' && (Date.now() - item.updatedAt) < 60000
    );
    this.statistics.throughputPerSecond = recentItems.length / 60;
  }

  private getNextProcessingDelay(): number {
    return this.config.scheduling.batchDelayMs || 0;
  }

  private startMonitoring(): void {
    // Metrics collection
    this.metricsInterval = setInterval(async () => {
      try {
        const gasMarket = await this.getGasMarket();
        this.performanceMetrics.gasPrices.push(gasMarket.currentGasPrice);

        if (this.performanceMetrics.gasPrices.length > 50) {
          this.performanceMetrics.gasPrices = this.performanceMetrics.gasPrices.slice(-25);
        }

        // Calculate throughput
        this.performanceMetrics.throughputMeasurements.push(this.statistics.throughputPerSecond);
        if (this.performanceMetrics.throughputMeasurements.length > 50) {
          this.performanceMetrics.throughputMeasurements = this.performanceMetrics.throughputMeasurements.slice(-25);
        }
      } catch (error) {
        logger.debug({ error }, 'Metrics collection error');
      }
    }, this.config.monitoring.metricsInterval);

    // Health checks
    this.healthCheckInterval = setInterval(async () => {
      try {
        const validation = await this.validateQueue();
        if (!validation.valid) {
          logger.warn({ issues: validation.issues }, 'Queue health check failed');
        }
      } catch (error) {
        logger.debug({ error }, 'Health check error');
      }
    }, this.config.monitoring.healthCheckInterval);
  }

  private startGasOptimization(): Promise<void> {
    // Monitor gas prices and optimize queue
    const optimizer = async () => {
      try {
        const gasMarket = await this.getGasMarket();

        // Auto-optimize during low congestion
        if (gasMarket.networkCongestion === 'low') {
          await this.optimizeGas();
        }

        // Auto-pause during critical congestion
        if (gasMarket.networkCongestion === 'critical' && !this.isPaused) {
          await this.pauseProcessing();
          logger.info('Auto-pausing queue due to critical network congestion');
        } else if (gasMarket.networkCongestion === 'medium' && this.isPaused) {
          await this.resumeProcessing();
          logger.info('Auto-resuming queue as network congestion improved');
        }

      } catch (error) {
        logger.debug({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Gas optimization error');
      }
    };

    // Optimize every 15 seconds
    setInterval(optimizer, 15000);
    return Promise.resolve();
  }

  private calculateAverageProcessingTime(): number {
    if (this.performanceMetrics.processingTimes.length === 0) return 0;
    const sum = this.performanceMetrics.processingTimes.reduce((a, b) => a + b, 0);
    return sum / this.performanceMetrics.processingTimes.length;
  }

  private calculateGasSavings(): string {
    // Calculate gas savings from optimization strategies
    return formatUnits(BigInt(Math.floor(Math.random() * 1000000)), 'gwei'); // Placeholder
  }

  private calculateQueueEfficiency(): number {
    const total = this.statistics.totalItems;
    if (total === 0) return 100;
    return (this.statistics.completedItems / total) * 100;
  }

  private calculateErrorRate(): number {
    const total = this.statistics.completedItems + this.statistics.failedItems;
    if (total === 0) return 0;
    return (this.statistics.failedItems / total) * 100;
  }

  private async persistQueue(): Promise<void> {
    // Persist queue to cache/database
    const queueData = {
      items: Array.from(this.queue.entries()),
      bundles: Array.from(this.bundles.entries()),
      statistics: this.statistics,
      timestamp: Date.now()
    };

    await this.cache.set('transaction_queue_viem', queueData, 300000); // 5 minutes
  }

  private async loadPersistedQueue(): Promise<void> {
    try {
      const cached = await this.cache.get('transaction_queue_viem');
      if (cached) {
        this.queue = new Map(cached.items);
        this.bundles = new Map(cached.bundles);
        this.statistics = cached.statistics;

        // Reset processing state
        for (const [id, item] of this.queue.entries()) {
          if (item.status === 'processing') {
            item.status = 'pending';
            this.statistics.pendingItems++;
            this.statistics.processingItems--;
          }
        }

        logger.info({
          loadedItems: this.queue.size,
          loadedBundles: this.bundles.size,
          statistics: this.statistics
        }, 'Queue loaded from cache');
      }
    } catch (error) {
      logger.debug({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to load persisted queue');
    }
  }
}

// Export singleton instance
export const transactionQueueServiceViem = new TransactionQueueServiceViem();