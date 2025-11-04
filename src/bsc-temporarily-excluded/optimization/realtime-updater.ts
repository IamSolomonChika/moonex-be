/**
 * Real-Time Data Updater for BSC Services
 * Optimized real-time data synchronization with intelligent throttling and batching
 */

import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import logger from '../../../utils/logger.js';

/**
 * Real-time update configuration
 */
export interface RealTimeUpdateConfig {
  // Update frequency settings
  defaultUpdateInterval: number;
  fastUpdateInterval: number;
  slowUpdateInterval: number;

  // Throttling settings
  enableThrottling: boolean;
  maxUpdatesPerSecond: number;
  throttleWindow: number;

  // Batching settings
  enableBatching: boolean;
  maxBatchSize: number;
  batchTimeout: number;

  // Performance settings
  enableOptimization: boolean;
  enableCaching: boolean;
  enableCompression: boolean;
  enableMetrics: boolean;

  // WebSocket settings
  enableWebSocket: boolean;
  websocketTimeout: number;
  reconnectAttempts: number;
  reconnectDelay: number;

  // Data freshness
  maxDataAge: number;
  enableStaleDataDetection: boolean;
  dataValidationEnabled: boolean;

  // Subscription management
  maxSubscriptions: number;
  subscriptionTimeout: number;
  enableAutoRenewal: boolean;
}

/**
 * Data subscription
 */
export interface DataSubscription {
  id: string;
  dataType: string;
  filters?: Record<string, any>;
  callback: (data: any) => void;
  interval?: number;
  priority: number;
  lastUpdate: number;
  updateCount: number;
  errorCount: number;
  isActive: boolean;
  createdAt: number;
}

/**
 * Update queue entry
 */
interface UpdateQueueEntry {
  id: string;
  dataType: string;
  data: any;
  timestamp: number;
  priority: number;
  subscriptions: Set<string>;
}

/**
 * Real-time metrics
 */
export interface RealTimeMetrics {
  totalUpdates: number;
  successfulUpdates: number;
  failedUpdates: number;
  averageUpdateRate: number;
  peakUpdateRate: number;
  currentUpdateRate: number;
  subscriptionCount: number;
  averageDataAge: number;
  cacheHitRate: number;
  throttleRate: number;
  batchEfficiency: number;
  websocketConnections: number;
}

/**
 * Real-Time Data Updater
 */
export class RealTimeUpdater extends EventEmitter {
  private config: RealTimeUpdateConfig;
  private provider: ethers.JsonRpcProvider;

  // Subscription management
  private subscriptions: Map<string, DataSubscription> = new Map();
  private dataBuffers: Map<string, { data: any; timestamp: number }> = new Map();

  // Update queues and processing
  private updateQueue: UpdateQueueEntry[] = [];
  private processingQueue: boolean = false;

  // Throttling
  private updateTimestamps: number[] = [];
  private updateCount: number = 0;

  // WebSocket connection
  private websocket: any | null = null;
  private websocketConnected: boolean = false;
  private reconnectAttempts: number = 0;

  // Metrics
  private metrics: RealTimeMetrics = {
    totalUpdates: 0,
    successfulUpdates: 0,
    failedUpdates: 0,
    averageUpdateRate: 0,
    peakUpdateRate: 0,
    currentUpdateRate: 0,
    subscriptionCount: 0,
    averageDataAge: 0,
    cacheHitRate: 0,
    throttleRate: 0,
    batchEfficiency: 0,
    websocketConnections: 0
  };

  // Timers
  private metricsTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private throttleTimer: NodeJS.Timeout | null = null;

  // Performance tracking
  private updateTimes: number[] = [];
  private totalUpdateTime: number = 0;
  private lastMetricsUpdate: number = 0;

  constructor(
    provider: ethers.JsonRpcProvider,
    config: Partial<RealTimeUpdateConfig> = {}
  ) {
    super();
    this.provider = provider;

    this.config = {
      defaultUpdateInterval: 5000, // 5 seconds
      fastUpdateInterval: 1000, // 1 second
      slowUpdateInterval: 30000, // 30 seconds
      enableThrottling: true,
      maxUpdatesPerSecond: 100,
      throttleWindow: 1000, // 1 second
      enableBatching: true,
      maxBatchSize: 50,
      batchTimeout: 500, // 500ms
      enableOptimization: true,
      enableCaching: true,
      enableCompression: false,
      enableMetrics: true,
      enableWebSocket: true,
      websocketTimeout: 30000, // 30 seconds
      reconnectAttempts: 5,
      reconnectDelay: 5000, // 5 seconds
      maxDataAge: 60000, // 1 minute
      enableStaleDataDetection: true,
      dataValidationEnabled: true,
      maxSubscriptions: 1000,
      subscriptionTimeout: 300000, // 5 minutes
      enableAutoRenewal: true,
      ...config
    };

    this.initializeUpdater();
  }

  /**
   * Initialize real-time updater
   */
  private initializeUpdater(): void {
    // Start metrics collection
    if (this.config.enableMetrics) {
      this.startMetricsCollection();
    }

    // Start cleanup process
    this.startCleanupProcess();

    // Start throttling mechanism
    if (this.config.enableThrottling) {
      this.startThrottling();
    }

    // Initialize WebSocket connection
    if (this.config.enableWebSocket) {
      this.initializeWebSocket();
    }

    logger.info('Real-Time Updater initialized', {
      defaultInterval: this.config.defaultUpdateInterval,
      throttlingEnabled: this.config.enableThrottling,
      batchingEnabled: this.config.enableBatching,
      webSocketEnabled: this.config.enableWebSocket
    });
  }

  /**
   * Subscribe to real-time data updates
   */
  subscribe(
    dataType: string,
    callback: (data: any) => void,
    options: {
      filters?: Record<string, any>;
      interval?: number;
      priority?: number;
      autoRenew?: boolean;
    } = {}
  ): string {
    // Check subscription limit
    if (this.subscriptions.size >= this.config.maxSubscriptions) {
      throw new Error('Maximum subscription limit reached');
    }

    const subscriptionId = this.generateSubscriptionId();
    const now = Date.now();

    const subscription: DataSubscription = {
      id: subscriptionId,
      dataType,
      filters: options.filters,
      callback,
      interval: options.interval || this.config.defaultUpdateInterval,
      priority: options.priority || 0,
      lastUpdate: 0,
      updateCount: 0,
      errorCount: 0,
      isActive: true,
      createdAt: now
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.metrics.subscriptionCount++;

    // Initialize data buffer
    if (!this.dataBuffers.has(dataType)) {
      this.dataBuffers.set(dataType, { data: null, timestamp: 0 });
    }

    // Set up recurring updates
    this.setupRecurringUpdates(subscription);

    logger.debug('Data subscription created', {
      subscriptionId,
      dataType,
      interval: subscription.interval,
      priority: subscription.priority
    });

    // Emit subscription event
    this.emit('subscribed', {
      subscriptionId,
      dataType,
      interval: subscription.interval
    });

    return subscriptionId;
  }

  /**
   * Unsubscribe from data updates
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    // Mark as inactive
    subscription.isActive = false;

    // Remove from subscriptions
    this.subscriptions.delete(subscriptionId);
    this.metrics.subscriptionCount--;

    logger.debug('Data subscription removed', {
      subscriptionId,
      dataType: subscription.dataType,
      updateCount: subscription.updateCount
    });

    // Emit unsubscription event
    this.emit('unsubscribed', {
      subscriptionId,
      dataType: subscription.dataType,
      updateCount: subscription.updateCount
    });

    return true;
  }

  /**
   * Manually trigger data update
   */
  async triggerUpdate(dataType: string, data: any, options: {
    force?: boolean;
    metadata?: Record<string, any>;
  } = {}): Promise<void> {
    try {
      const now = Date.now();

      // Update data buffer
      this.dataBuffers.set(dataType, { data, timestamp: now });

      // Create update queue entry
      const updateEntry: UpdateQueueEntry = {
        id: this.generateUpdateId(),
        dataType,
        data,
        timestamp: now,
        priority: 0, // Manual updates get high priority
        subscriptions: new Set()
      };

      // Find relevant subscriptions
      for (const [subId, subscription] of this.subscriptions.entries()) {
        if (subscription.isActive && subscription.dataType === dataType) {
          if (this.matchesFilters(data, subscription.filters)) {
            updateEntry.subscriptions.add(subId);
          }
        }
      }

      // Add to update queue
      this.addToUpdateQueue(updateEntry);

      // Process immediately if forced or high priority
      if (options.force || updateEntry.priority > 5) {
        await this.processUpdateQueue();
      }

      logger.debug('Manual update triggered', {
        dataType,
        subscriptionCount: updateEntry.subscriptions.size
      });

    } catch (error) {
      logger.error({
        dataType,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to trigger manual update');
      throw error;
    }
  }

  /**
   * Get cached data
   */
  getCachedData(dataType: string): any | null {
    const buffer = this.dataBuffers.get(dataType);
    if (!buffer) return null;

    // Check if data is stale
    if (this.config.enableStaleDataDetection) {
      const age = Date.now() - buffer.timestamp;
      if (age > this.config.maxDataAge) {
        logger.debug('Cached data is stale', {
          dataType,
          age,
          maxAge: this.config.maxDataAge
        });
        return null;
      }
    }

    // Update metrics
    this.metrics.cacheHitRate = (this.metrics.cacheHitRate + 1) / (this.metrics.cacheHitRate + 2);

    return buffer.data;
  }

  /**
   * Set up recurring updates for subscription
   */
  private setupRecurringUpdates(subscription: DataSubscription): void {
    if (!this.config.enableAutoRenewal) return;

    const updateInterval = setInterval(async () => {
      if (!subscription.isActive) {
        clearInterval(updateInterval);
        return;
      }

      try {
        await this.fetchAndUpdateData(subscription);
      } catch (error) {
        subscription.errorCount++;
        logger.error({
          subscriptionId: subscription.id,
          dataType: subscription.dataType,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'Recurring update failed');

        // Disable subscription after too many errors
        if (subscription.errorCount > 5) {
          subscription.isActive = false;
          logger.warn('Subscription disabled due to errors', {
            subscriptionId: subscription.id,
            errorCount: subscription.errorCount
          });
        }
      }
    }, subscription.interval);

    // Store interval reference for cleanup
    (subscription as any)._interval = updateInterval;
  }

  /**
   * Fetch and update data for subscription
   */
  private async fetchAndUpdateData(subscription: DataSubscription): Promise<void> {
    try {
      // Fetch data based on data type
      const data = await this.fetchDataByType(subscription.dataType, subscription.filters);

      if (data) {
        await this.triggerUpdate(subscription.dataType, data);
        subscription.lastUpdate = Date.now();
        subscription.updateCount++;
      }

    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch data by type (placeholder implementation)
   */
  private async fetchDataByType(dataType: string, filters?: Record<string, any>): Promise<any> {
    // This would be implemented based on specific data sources
    switch (dataType) {
      case 'token_prices':
        return this.fetchTokenPrices(filters);
      case 'liquidity_pools':
        return this.fetchLiquidityPools(filters);
      case 'farm_data':
        return this.fetchFarmData(filters);
      case 'gas_prices':
        return this.fetchGasPrices();
      case 'network_stats':
        return this.fetchNetworkStats();
      default:
        logger.warn('Unknown data type', { dataType });
        return null;
    }
  }

  /**
   * Fetch token prices
   */
  private async fetchTokenPrices(filters?: Record<string, any>): Promise<any> {
    try {
      // Implementation would fetch from price oracle or DEX
      const gasPrice = await this.provider.getGasPrice();
      const prices = {
        WBN: { price: 300, priceChange24h: 2.5 },
        USDT: { price: 1, priceChange24h: 0.1 },
        CAKE: { price: 2.5, priceChange24h: -1.2 },
        BUSD: { price: 1, priceChange24h: 0.05 },
        timestamp: Date.now(),
        gasPrice: ethers.formatUnits(gasPrice, 'gwei')
      };

      return prices;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch token prices');
      return null;
    }
  }

  /**
   * Fetch liquidity pools data
   */
  private async fetchLiquidityPools(filters?: Record<string, any>): Promise<any> {
    try {
      // Implementation would fetch from PancakeSwap or other DEX
      return {
        pools: [
          {
            address: '0x...',
            token0: { symbol: 'WBNB', address: '0xbb4CdB9cBD36b01bd1cBaeF2de08d9173bc095c' },
            token1: { symbol: 'USDT', address: '0x55d398326f99059ff775485246999027b3197955' },
            reserve0: '100000000000000000000000',
            reserve1: '100000000000000000000000',
            liquidity: '100000000000000000000000',
            apr: 12.5,
            volume24h: '50000000000000000000'
          }
        ],
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch liquidity pools');
      return null;
    }
  }

  /**
   * Fetch farm data
   */
  private async fetchFarmData(filters?: Record<string, any>): Promise<any> {
    try {
      // Implementation would fetch from MasterChef contracts
      return {
        farms: [
          {
            address: '0x...',
            pid: 1,
            token: { symbol: 'CAKE', address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82' },
            apr: 45.2,
            tvl: '50000000000000000000',
            multiplier: 1,
            rewardPerBlock: '0.1',
            pendingCake: '1000000000000000000000'
          }
        ],
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch farm data');
      return null;
    }
  }

  /**
   * Fetch current gas prices
   */
  private async fetchGasPrices(): Promise<any> {
    try {
      const feeData = await this.provider.getFeeData();
      return {
        gasPrice: ethers.formatUnits(feeData.gasPrice || BigInt('5000000000'), 'gwei'),
        maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') : null,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : null,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch gas prices');
      return null;
    }
  }

  /**
   * Fetch network statistics
   */
  private async fetchNetworkStats(): Promise<any> {
    try {
      const block = await this.provider.getBlock('latest');
      return {
        blockNumber: block.number,
        blockHash: block.hash,
        timestamp: Date.now(),
        gasLimit: block.gasLimit.toString(),
        gasUsed: block.gasUsed?.toString() || '0',
        miner: block.miner || 'unknown',
        transactions: block.transactions?.length || 0
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch network stats');
      return null;
    }
  }

  /**
   * Add update to queue with priority
   */
  private addToUpdateQueue(update: UpdateQueueEntry): void {
    // Check throttling
    if (this.config.enableThrottling && !this.canProcessUpdate()) {
      logger.debug('Update throttled', {
        dataType: update.dataType,
        currentRate: this.getCurrentUpdateRate(),
        maxRate: this.config.maxUpdatesPerSecond
      });
      return;
    }

    // Insert based on priority
    let insertIndex = this.updateQueue.length;
    for (let i = 0; i < this.updateQueue.length; i++) {
      if (update.priority > this.updateQueue[i].priority) {
        insertIndex = i;
        break;
      }
    }

    this.updateQueue.splice(insertIndex, 0, update);
    this.updateTimestamps.push(Date.now());

    // Maintain timestamp array size
    if (this.updateTimestamps.length > 1000) {
      this.updateTimestamps.splice(0, this.updateTimestamps.length - 1000);
    }

    // Trigger processing if not already processing
    if (!this.processingQueue) {
      this.processUpdateQueue();
    }
  }

  /**
   * Process update queue
   */
  private async processUpdateQueue(): Promise<void> {
    if (this.processingQueue || this.updateQueue.length === 0) return;

    this.processingQueue = true;

    try {
      // Check if batching is enabled
      if (this.config.enableBatching && this.updateQueue.length > 1) {
        await this.processBatchedUpdates();
      } else {
        await this.processSingleUpdate();
      }
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Update queue processing failed');
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Process single update
   */
  private async processSingleUpdate(): Promise<void> {
    if (this.updateQueue.length === 0) return;

    const update = this.updateQueue.shift()!;
    const startTime = Date.now();

    try {
      // Update data buffer
      this.dataBuffers.set(update.dataType, {
        data: update.data,
        timestamp: update.timestamp
      });

      // Notify subscribers
      for (const subscriptionId of update.subscriptions) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (subscription && subscription.isActive) {
          subscription.callback(update.data);
          subscription.lastUpdate = Date.now();
          subscription.updateCount++;
        }
      }

      // Update metrics
      this.metrics.totalUpdates++;
      this.metrics.successfulUpdates++;
      this.updateUpdateRate();

      this.updateTimes.push(Date.now() - startTime);
      this.totalUpdateTime += (Date.now() - startTime);

      // Maintain update times array
      if (this.updateTimes.length > 1000) {
        this.updateTimes.splice(0, this.updateTimes.length - 1000);
      }

      logger.debug('Single update processed', {
        updateId: update.id,
        dataType: update.dataType,
        subscriptionCount: update.subscriptions.size,
        processingTime: Date.now() - startTime
      });

    } catch (error) {
      this.metrics.totalUpdates++;
      this.metrics.failedUpdates++;

      logger.error({
        updateId: update.id,
        dataType: update.dataType,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Single update processing failed');
    }
  }

  /**
   * Process batched updates
   */
  private async processBatchedUpdates(): Promise<void> {
    const batchSize = Math.min(this.config.maxBatchSize, this.updateQueue.length);
    const batch = this.updateQueue.splice(0, batchSize);
    const startTime = Date.now();

    try {
      // Group updates by data type
      const groupedUpdates = new Map<string, UpdateQueueEntry[]>();
      for (const update of batch) {
        if (!groupedUpdates.has(update.dataType)) {
          groupedUpdates.set(update.dataType, []);
        }
        groupedUpdates.get(update.dataType)!.push(update);
      }

      // Process each data type group
      for (const [dataType, updates] of groupedUpdates.entries()) {
        // Use the most recent data
        const latestUpdate = updates[updates.length - 1];

        // Update data buffer
        this.dataBuffers.set(dataType, {
          data: latestUpdate.data,
          timestamp: latestUpdate.timestamp
        });

        // Collect all subscribers for this data type
        const subscribers = new Set<string>();
        updates.forEach(update => {
          update.subscriptions.forEach(subId => subscribers.add(subId));
        });

        // Notify all subscribers
        for (const subscriptionId of subscribers) {
          const subscription = this.subscriptions.get(subscriptionId);
          if (subscription && subscription.isActive) {
            subscription.callback(latestUpdate.data);
            subscription.lastUpdate = Date.now();
            subscription.updateCount++;
          }
        }
      }

      // Update metrics
      this.metrics.totalUpdates += batch.length;
      this.metrics.successfulUpdates += batch.length;
      this.updateUpdateRate();

      // Calculate batch efficiency
      const batchTime = Date.now() - startTime;
      const efficiency = batch.length / (batchTime / 1000); // Updates per second
      this.metrics.batchEfficiency = (this.metrics.batchEfficiency + efficiency) / 2;

      this.updateTimes.push(batchTime);
      this.totalUpdateTime += batchTime;

      // Maintain update times array
      if (this.updateTimes.length > 1000) {
        this.updateTimes.splice(0, this.updateTimes.length - 1000);
      }

      logger.debug('Batch updates processed', {
        batchSize: batch.length,
        dataTypes: Array.from(groupedUpdates.keys()),
        subscriptionCount: Array.from(subscribers.values()).reduce((sum, set) => sum + set.size, 0),
        processingTime: batchTime,
        efficiency: (efficiency * 100).toFixed(2) + ' updates/sec'
      });

    } catch (error) {
      this.metrics.totalUpdates += batch.length;
      this.metrics.failedUpdates += batch.length;

      logger.error({
        batchSize: batch.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Batch updates processing failed');
    }
  }

  /**
   * Check if update can be processed (throttling)
   */
  private canProcessUpdate(): boolean {
    if (!this.config.enableThrottling) return true;

    const currentRate = this.getCurrentUpdateRate();
    return currentRate < this.config.maxUpdatesPerSecond;
  }

  /**
   * Get current update rate
   */
  private getCurrentUpdateRate(): number {
    const now = Date.now();
    const recentTimestamps = this.updateTimestamps.filter(
      timestamp => now - timestamp < this.config.throttleWindow
    );

    return recentTimestamps.length / (this.config.throttleWindow / 1000);
  }

  /**
   * Update update rate metrics
   */
  private updateUpdateRate(): void {
    const now = Date.now();
    const window = 60000; // 1 minute window

    const recentUpdates = this.updateTimestamps.filter(
      timestamp => now - timestamp < window
    );

    this.metrics.currentUpdateRate = recentUpdates.length / (window / 1000);

    // Update peak rate
    if (this.metrics.currentUpdateRate > this.metrics.peakUpdateRate) {
      this.metrics.peakUpdateRate = this.metrics.currentUpdateRate;
    }

    // Update average rate
    this.metrics.averageUpdateRate = this.metrics.totalUpdates / (now / 1000);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsInterval);
  }

  /**
   * Collect and report metrics
   */
  private collectMetrics(): void {
    const metrics = this.getMetrics();

    // Calculate average data age
    let totalAge = 0;
    let dataCount = 0;
    for (const buffer of this.dataBuffers.values()) {
      if (buffer.data) {
        totalAge += Date.now() - buffer.timestamp;
        dataCount++;
      }
    }
    this.metrics.averageDataAge = dataCount > 0 ? totalAge / dataCount : 0;

    logger.info('Real-Time Updater Metrics', {
      totalUpdates: metrics.totalUpdates,
      successfulUpdates: metrics.successfulUpdates,
      failedUpdates: metrics.failedUpdates,
      successRate: ((metrics.successfulUpdates / metrics.totalUpdates) * 100).toFixed(2) + '%',
      currentUpdateRate: metrics.currentUpdateRate.toFixed(2) + ' updates/sec',
      averageUpdateRate: metrics.averageUpdateRate.toFixed(2) + ' updates/sec',
      peakUpdateRate: metrics.peakUpdateRate.toFixed(2) + ' updates/sec',
      subscriptionCount: metrics.subscriptionCount,
      averageDataAge: (metrics.averageDataAge / 1000).toFixed(2) + 's',
      cacheHitRate: (metrics.cacheHitRate * 100).toFixed(2) + '%',
      queueLength: this.updateQueue.length,
      processingQueue: this.processingQueue,
      batchEfficiency: (metrics.batchEfficiency * 100).toFixed(2) + '%'
    });

    // Check for performance alerts
    if (this.config.enablePerformanceAlerts) {
      this.checkPerformanceAlerts(metrics);
    }

    // Emit metrics event
    this.emit('metrics', metrics);

    this.lastMetricsUpdate = Date.now();
  }

  /**
   * Check for performance alerts
   */
  private checkPerformanceAlerts(metrics: RealTimeMetrics): void {
    // Low success rate alert
    if (metrics.successUpdates > 0) {
      const successRate = metrics.successfulUpdates / metrics.totalUpdates;
      if (successRate < 0.9) { // 90% success rate
        this.emit('alert', {
          type: 'low_success_rate',
          value: successRate,
          threshold: 0.9,
          message: `Low update success rate: ${(successRate * 100).toFixed(2)}%`
        });
      }
    }

    // Low throughput alert
    if (metrics.currentUpdateRate < 1) { // Less than 1 update per second
      this.emit('alert', {
        type: 'low_throughput',
        value: metrics.currentUpdateRate,
        threshold: 1,
        message: `Low update throughput: ${metrics.currentUpdateRate.toFixed(2)} updates/sec`
      });
    }

    // High queue length alert
    if (this.updateQueue.length > 100) {
      this.emit('alert', {
        type: 'high_queue_length',
        value: this.updateQueue.length,
        threshold: 100,
        message: `High update queue length: ${this.updateQueue.length}`
      });
    }

    // Stale data alert
    if (metrics.averageDataAge > 30000) { // 30 seconds
      this.emit('alert', {
        type: 'stale_data',
        value: metrics.averageDataAge,
        threshold: 30000,
        message: `Data is stale: ${(metrics.averageDataAge / 1000).toFixed(2)}s average age`
      });
    }
  }

  /**
   * Start cleanup process
   */
  private startCleanupProcess(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, 60000); // Every minute
  }

  /**
   * Perform cleanup operations
   */
  private performCleanup(): void {
    try {
      const now = Date.now();
      let cleanedSubscriptions = 0;
      let cleanedBuffers = 0;

      // Clean up inactive subscriptions
      for (const [id, subscription] of this.subscriptions.entries()) {
        if (!subscription.isActive || now - subscription.lastUpdate > this.config.subscriptionTimeout) {
          this.subscriptions.delete(id);
          cleanedSubscriptions++;
        }
      }

      // Clean up stale data buffers
      for (const [dataType, buffer] of this.dataBuffers.entries()) {
        if (buffer.data && this.config.enableStaleDataDetection) {
          const age = now - buffer.timestamp;
          if (age > this.config.maxDataAge) {
            this.dataBuffers.set(dataType, { data: null, timestamp: 0 });
            cleanedBuffers++;
          }
        }
      }

      // Update metrics
      this.metrics.subscriptionCount = this.subscriptions.size;
      this.metrics.averageDataAge = this.calculateAverageDataAge();

      if (cleanedSubscriptions > 0 || cleanedBuffers > 0) {
        logger.debug('Cleanup completed', {
          cleanedSubscriptions,
          cleanedBuffers,
          totalSubscriptions: this.subscriptions.size,
          totalBuffers: this.dataBuffers.size
        });
      }

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Cleanup failed');
    }
  }

  /**
   * Start throttling mechanism
   */
  private startThrottling(): void {
    this.throttleTimer = setInterval(() => {
      // Clear old timestamps
      const now = Date.now();
      this.updateTimestamps = this.updateTimestamps.filter(
        timestamp => now - timestamp < this.config.throttleWindow
      );
    }, this.config.throttleWindow);
  }

  /**
   * Initialize WebSocket connection
   */
  private initializeWebSocket(): void {
    // This would implement WebSocket connection for real-time data
    // For now, we'll simulate the connection
    this.websocketConnected = true;
    this.metrics.websocketConnections = 1;

    logger.debug('WebSocket connection simulated (not implemented)');
  }

  /**
   * Calculate average data age
   */
  private calculateAverageDataAge(): number {
    let totalAge = 0;
    let count = 0;

    for (const buffer of this.dataBuffers.values()) {
      if (buffer.data) {
        totalAge += Date.now() - buffer.timestamp;
        count++;
      }
    }

    return count > 0 ? totalAge / count : 0;
  }

  /**
   * Check if data matches filters
   */
  private matchesFilters(data: any, filters?: Record<string, any>): boolean {
    if (!filters) return true;

    for (const [key, value] of Object.entries(filters)) {
      if (data[key] !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get current metrics
   */
  getMetrics(): RealTimeMetrics {
    return { ...this.metrics };
  }

  /**
   * Get subscription information
   */
  getSubscriptionInfo(subscriptionId: string): DataSubscription | null {
    return this.subscriptions.get(subscriptionId) || null;
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): DataSubscription[] {
    return Array.from(this.subscriptions.values()).filter(sub => sub.isActive);
  }

  /**
   * Get data buffer information
   */
  getDataBufferInfo(): Array<{ dataType: string; hasData: boolean; age: number; size: number }> {
    const now = Date.now();
    const info: Array<{ dataType: string; hasData: boolean; age: number; size: number }> = [];

    for (const [dataType, buffer] of this.dataBuffers.entries()) {
      info.push({
        dataType,
        hasData: buffer.data !== null,
        age: buffer.data ? now - buffer.timestamp : 0,
        size: buffer.data ? JSON.stringify(buffer.data).length : 0
      });
    }

    return info;
  }

  /**
   * Generate subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate update ID
   */
  private generateUpdateId(): string {
    return `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown real-time updater
   */
  shutdown(): void {
    // Clear timers
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.throttleTimer) {
      clearInterval(this.throttleTimer);
      this.throttleTimer = null;
    }

    // Clear subscriptions
    this.subscriptions.clear();
    this.dataBuffers.clear();
    this.updateQueue = [];

    // Close WebSocket connection
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    this.websocketConnected = false;
    this.metrics.websocketConnections = 0;

    logger.info('Real-Time Updater shutdown completed');
  }
}

// Export singleton instance factory
export function createRealTimeUpdater(
  provider: ethers.JsonRpcProvider,
  config?: Partial<RealTimeUpdateConfig>
): RealTimeUpdater {
  return new RealTimeUpdater(provider, config);
}