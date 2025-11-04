/**
 * BSC Transaction Queue Service
 * Advanced transaction queue and management system for BSC trading
 */

import { ethers } from 'ethers';
import logger from '../../../utils/logger.js';
import type {
  SwapTransaction,
  SwapRequest,
  SwapQuote,
  TransactionStatus,
  SwapExecutionDetails
} from './types.js';
import { SwapService } from './swap-service.js';
import { BSCProviderManager } from '../../utils/ethers-provider.js';
import { BSCCacheManager } from '../cache/cache-manager.js';

/**
 * Queue Item
 */
export interface QueueItem {
  id: string;
  type: 'swap' | 'approval' | 'custom';
  priority: number; // 1-10, higher = more urgent
  request: SwapRequest;
  quote?: SwapQuote;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'retrying';
  attempts: number;
  maxAttempts: number;
  delayUntil?: number;
  createdAt: number;
  updatedAt: number;
  scheduledFor?: number;
  transaction?: SwapTransaction;
  error?: string;
  metadata: Record<string, any>;
}

/**
 * Queue Configuration
 */
export interface QueueConfig {
  maxSize: number;
  processingConcurrency: number;
  retryPolicy: {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
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
  };
}

/**
 * Queue Statistics
 */
export interface QueueStatistics {
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
}

/**
 * Transaction Queue Service Interface
 */
export interface ITransactionQueueService {
  // Queue management
  enqueue(request: SwapRequest, priority?: number): Promise<string>;
  dequeue(): Promise<QueueItem | null>;
  getItem(itemId: string): Promise<QueueItem | null>;
  updateItem(itemId: string, updates: Partial<QueueItem>): Promise<void>;
  cancelItem(itemId: string): Promise<boolean>;

  // Processing
  startProcessing(): Promise<void>;
  stopProcessing(): Promise<void>;
  pauseProcessing(): Promise<void>;
  resumeProcessing(): Promise<void>;

  // Monitoring and analytics
  getStatistics(): Promise<QueueStatistics>;
  getQueueStatus(): Promise<any>;
  getItemHistory(limit?: number): Promise<QueueItem[]>;

  // Configuration
  updateConfig(config: Partial<QueueConfig>): Promise<void>;
  getConfig(): Promise<QueueConfig>;

  // Cleanup
  cleanupCompletedItems(olderThan?: number): Promise<number>;
  cleanupFailedItems(olderThan?: number): Promise<number>;
}

/**
 * Transaction Queue Service Implementation
 */
export class TransactionQueueService implements ITransactionQueueService {
  private config: QueueConfig;
  private provider: BSCProviderManager;
  private cache: BSCCacheManager;
  private swapService: SwapService;

  // Queue storage
  private queue: Map<string, QueueItem> = new Map();
  private processing: Set<string> = new Set();

  // Processing state
  private isProcessing: boolean = false;
  private isPaused: boolean = false;
  private processingInterval?: NodeJS.Timeout;

  // Statistics
  private statistics: QueueStatistics = {
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
    oldestItemAge: 0
  };

  constructor(config?: Partial<QueueConfig>) {
    this.config = {
      maxSize: 1000,
      processingConcurrency: 5,
      retryPolicy: {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2.0
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
        batchDelayMs: 500
      },
      ...config
    };

    this.provider = new BSCProviderManager();
    this.cache = new BSCCacheManager();
    this.swapService = new SwapService();
  }

  /**
   * Add item to queue
   */
  async enqueue(request: SwapRequest, priority: number = this.config.priorities.normal): Promise<string> {
    logger.debug({
      tokenIn: request.tokenIn,
      tokenOut: request.tokenOut,
      priority
    }, 'Adding item to transaction queue');

    try {
      // Check queue size limit
      if (this.queue.size >= this.config.maxSize) {
        throw new Error('Queue is full');
      }

      const itemId = this.generateItemId();
      const now = Date.now();

      const queueItem: QueueItem = {
        id: itemId,
        type: 'swap',
        priority,
        request,
        status: 'pending',
        attempts: 0,
        maxAttempts: this.config.retryPolicy.maxAttempts,
        createdAt: now,
        updatedAt: now,
        metadata: {
          urgency: this.determineUrgency(request),
          estimatedGasCost: await this.estimateGasCost(request)
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
        queueLength: this.queue.size
      }, 'Item added to queue successfully');

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
   * Get next item from queue
   */
  async dequeue(): Promise<QueueItem | null> {
    logger.debug('Dequeuing next item');

    try {
      // Find highest priority item that's ready to process
      let bestItem: QueueItem | null = null;
      let bestScore = -1;

      for (const item of this.queue.values()) {
        if (item.status !== 'pending' && item.status !== 'retrying') continue;

        // Check if item is delayed
        if (item.delayUntil && Date.now() < item.delayUntil) continue;

        // Calculate priority score
        const score = this.calculatePriorityScore(item);
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
          queueLength: this.queue.size - this.processing.size
        }, 'Item dequeued successfully');

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
  async getItem(itemId: string): Promise<QueueItem | null> {
    return this.queue.get(itemId) || null;
  }

  /**
   * Update item
   */
  async updateItem(itemId: string, updates: Partial<QueueItem>): Promise<void> {
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
   * Start processing queue
   */
  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      logger.debug('Queue processing is already running');
      return;
    }

    logger.info('Starting transaction queue processing');

    this.isProcessing = true;
    this.isPaused = false;

    // Start processing loop
    this.processingInterval = setInterval(async () => {
      if (!this.isPaused && this.processing.size < this.config.processingConcurrency) {
        await this.processBatch();
      }
    }, 1000);

    // Start gas price monitoring for dynamic scheduling
    if (this.config.scheduling.enabled) {
      this.startGasPriceMonitoring();
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
   * Get queue statistics
   */
  async getStatistics(): Promise<QueueStatistics> {
    this.updateStatistics();
    return { ...this.statistics };
  }

  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<any> {
    const gasMarket = await this.swapService['gasOptimizationService'].analyzeGasMarket();

    return {
      isProcessing: this.isProcessing,
      isPaused: this.isPaused,
      config: this.config,
      statistics: this.statistics,
      gasMarket: {
        gasPrice: gasMarket.gasPriceGwei,
        congestion: gasMarket.networkCongestion,
        blockTime: gasMarket.blockTime
      },
      oldestItemAge: this.statistics.oldestItemAge,
      nextProcessingIn: this.getNextProcessingDelay()
    };
  }

  /**
   * Get item history
   */
  async getItemHistory(limit: number = 100): Promise<QueueItem[]> {
    const allItems = Array.from(this.queue.values());

    return allItems
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  /**
   * Update queue configuration
   */
  async updateConfig(config: Partial<QueueConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await this.cache.set('queue_config', this.config, 86400000); // 24 hours
    logger.info('Queue configuration updated');
  }

  /**
   * Get current configuration
   */
  async getConfig(): Promise<QueueConfig> {
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

  // Private helper methods

  private generateItemId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineUrgency(request: SwapRequest): 'low' | 'medium' | 'high' | 'urgent' {
    // Determine urgency based on request parameters
    const amountNum = parseFloat(request.amountIn || request.amountOut || '0');

    if (amountNum > 100000) return 'urgent';
    if (amountNum > 10000) return 'high';
    if (amountNum > 1000) return 'medium';
    return 'low';
  }

  private async estimateGasCost(request: SwapRequest): Promise<string> {
    try {
      const quote = await this.swapService.getQuote(request);
      return quote.gasEstimate.estimatedCostBNB;
    } catch (error) {
      return '0';
    }
  }

  private calculatePriorityScore(item: QueueItem): number {
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
        } as SwapTransaction;

        const processingTime = Date.now() - startTime;
        item.metadata.processingTime = processingTime;

        logger.info({
          itemId: item.id,
          processingTime
        }, 'Item processed successfully');

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

  private async processItem(item: QueueItem): Promise<void> {
    // This would contain the actual processing logic
    // For now, simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private async handleProcessingError(item: QueueItem, error: any, startTime: number): Promise<void> {
    const processingTime = Date.now() - startTime;
    item.metadata.processingTime = processingTime;
    item.error = error instanceof Error ? error.message : 'Unknown error';

    item.attempts++;

    if (item.attempts < item.maxAttempts) {
      // Schedule retry
      item.status = 'retrying';
      const delay = this.calculateRetryDelay(item.attempts);
      item.delayUntil = Date.now() + delay;

      logger.warn({
        itemId: item.id,
        attempt: item.attempts,
        maxAttempts: item.maxAttempts,
        retryDelay: delay,
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
  }

  private getNextProcessingDelay(): number {
    const gasMarket = await this.swapService['gasOptimizationService'].analyzeGasMarket();

    // Delay processing during high gas prices
    if (gasMarket.networkCongestion === 'critical') {
      return 5000; // 5 seconds
    } else if (gasMarket.networkCongestion === 'high') {
      return 2000; // 2 seconds
    }

    return 0;
  }

  private startGasPriceMonitoring(): Promise<void> {
    // Monitor gas prices and adjust processing strategy
    const monitor = async () => {
      try {
        const gasMarket = await this.swapService['gasOptimizationService'].analyzeGasMarket();

        // Adjust processing based on gas market conditions
        if (gasMarket.networkCongestion === 'critical' && !this.isPaused) {
          await this.pauseProcessing();
          logger.info('Auto-pausing queue due to critical network congestion');
        } else if (gasMarket.networkCongestion === 'medium' && this.isPaused) {
          await this.resumeProcessing();
          logger.info('Auto-resuming queue as network congestion improved');
        }

      } catch (error) {
        logger.debug({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Gas price monitoring error');
      }
    };

    // Monitor every 10 seconds
    setInterval(monitor, 10000);
  }

  private async persistQueue(): Promise<void> {
    // Persist queue to cache/database
    const queueData = {
      items: Array.from(this.queue.entries()),
      statistics: this.statistics,
      timestamp: Date.now()
    };

    await this.cache.set('transaction_queue', queueData, 300000); // 5 minutes
  }

  private async loadPersistedQueue(): Promise<void> {
    try {
      const cached = await this.cache.get('transaction_queue');
      if (cached) {
        this.queue = new Map(cached.items);
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
          statistics: this.statistics
        }, 'Queue loaded from cache');
      }
    } catch (error) {
      logger.debug({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to load persisted queue');
    }
  }
}

// Export singleton instance
export const transactionQueueService = new TransactionQueueService();