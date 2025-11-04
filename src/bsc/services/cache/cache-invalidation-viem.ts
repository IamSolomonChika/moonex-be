/**
 * Advanced Cache Invalidation Manager for BSC Services - Viem Integration
 * Intelligent cache invalidation with real-time blockchain event monitoring
 */

import { EventEmitter } from 'events';
import {
  PublicClient,
  Transport,
  Chain,
  Address,
  Hash,
  Block,
  Transaction,
  Log
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import logger from '../../../utils/logger.js';

/**
 * BSC-specific cache invalidation configuration
 */
export interface BscCacheInvalidationConfig {
  // Chain configuration
  chainId: number;
  chainName: string;
  blockConfirmations: number;

  // PancakeSwap contracts for cache invalidation
  pancakeSwapRouter: Address;
  pancakeSwapFactory: Address;
  masterChef: Address;

  // Major tokens to monitor
  monitoredTokens: Address[];

  // Performance settings
  invalidationDelay: number; // Delay after block before invalidation
  batchSize: number; // Max events to process in batch
  maxQueueSize: number; // Max invalidation queue size

  // Retry configuration
  maxRetries: number;
  retryDelay: number;

  // Cache invalidation strategies
  enablePriceInvalidation: boolean;
  enableLiquidityInvalidation: boolean;
  enableTransactionInvalidation: boolean;
  enableBlockInvalidation: boolean;
}

/**
 * Cache invalidation trigger
 */
export interface CacheInvalidationTrigger {
  type: 'block' | 'transaction' | 'event' | 'price' | 'liquidity' | 'manual';
  key?: string;
  pattern?: string;
  tags?: string[];
  data: any;
  timestamp: number;
  blockNumber?: bigint;
  transactionHash?: Hash;
}

/**
 * Cache invalidation result
 */
export interface CacheInvalidationResult {
  success: boolean;
  invalidatedKeys: string[];
  invalidatedPatterns: string[];
  invalidatedTags: string[];
  processingTime: number;
  error?: string;
}

/**
 * Viem-specific cache invalidation metrics
 */
export interface ViemInvalidationMetrics {
  totalInvalidations: number;
  successfulInvalidations: number;
  failedInvalidations: number;
  averageProcessingTime: number;
  eventProcessingRate: number;

  // BSC-specific metrics
  priceInvalidations: number;
  liquidityInvalidations: number;
  transactionInvalidations: number;
  blockInvalidations: number;

  // Viem-specific metrics
  eventsProcessed: number;
  blocksMonitored: number;
  reorgHandling: number;
  webSocketReconnections: number;

  // Performance metrics
  queueSize: number;
  processingRate: number;
  errorRate: number;
}

/**
 * Event filter configuration
 */
export interface EventFilterConfig {
  address?: Address | Address[];
  topics?: (string | string[] | null)[];
  fromBlock?: bigint | 'latest' | 'earliest';
  toBlock?: bigint | 'latest' | 'earliest';
}

/**
 * Advanced Cache Invalidation Manager with Viem Integration
 */
export class CacheInvalidationManagerViem extends EventEmitter {
  private config: BscCacheInvalidationConfig;
  private publicClient: PublicClient<Transport, Chain>;
  private isMonitoring: boolean = false;
  private lastProcessedBlock: bigint | null = null;
  private invalidationQueue: CacheInvalidationTrigger[] = [];

  // Monitoring
  private blockMonitor: any = null;
  private eventMonitor: any = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  // Metrics
  private metrics: ViemInvalidationMetrics = {
    totalInvalidations: 0,
    successfulInvalidations: 0,
    failedInvalidations: 0,
    averageProcessingTime: 0,
    eventProcessingRate: 0,
    priceInvalidations: 0,
    liquidityInvalidations: 0,
    transactionInvalidations: 0,
    blockInvalidations: 0,
    eventsProcessed: 0,
    blocksMonitored: 0,
    reorgHandling: 0,
    webSocketReconnections: 0,
    queueSize: 0,
    processingRate: 0,
    errorRate: 0
  };

  // Performance tracking
  private processingTimes: number[] = [];
  private totalProcessingTime: number = 0;
  private lastMetricsUpdate: number = Date.now();

  constructor(
    config: Partial<BscCacheInvalidationConfig> = {},
    publicClient?: PublicClient<Transport, Chain>
  ) {
    super();

    this.config = {
      chainId: 56, // BSC Mainnet
      chainName: 'BSC',
      blockConfirmations: 3,
      pancakeSwapRouter: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
      pancakeSwapFactory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
      masterChef: '0x73feaa1eE314F8c655E354234017bE2193C9E24E',
      monitoredTokens: [
        '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
        '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // BUSD
        '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', // CAKE
        '0x55d398326f99059fF775485246999027B3197955' // USDT
      ],
      invalidationDelay: 2000, // 2 seconds
      batchSize: 50,
      maxQueueSize: 1000,
      maxRetries: 3,
      retryDelay: 1000,
      enablePriceInvalidation: true,
      enableLiquidityInvalidation: true,
      enableTransactionInvalidation: true,
      enableBlockInvalidation: true,
      ...config
    };

    this.publicClient = publicClient || this.createPublicClient();

    logger.info('Cache Invalidation Manager initialized', {
      chainId: this.config.chainId,
      chainName: this.config.chainName,
      monitoredTokens: this.config.monitoredTokens.length,
      invalidationDelay: this.config.invalidationDelay
    });
  }

  /**
   * Create Viem public client
   */
  private createPublicClient(): PublicClient<Transport, Chain> {
    const chain = this.config.chainId === 56 ? bsc : bscTestnet;

    return require('viem').createPublicClient({
      chain,
      transport: require('viem').http(`https://${chain.name.toLowerCase()}.publicnode.com`)
    });
  }

  /**
   * Start cache invalidation monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Cache invalidation monitoring already started');
      return;
    }

    try {
      logger.info('Starting cache invalidation monitoring');

      // Get current block number
      const currentBlock = await this.publicClient.getBlockNumber();
      this.lastProcessedBlock = currentBlock;

      // Start block monitoring
      await this.startBlockMonitoring();

      // Start event monitoring
      await this.startEventMonitoring();

      this.isMonitoring = true;

      this.emit('monitoringStarted');
      logger.info('Cache invalidation monitoring started', {
        fromBlock: this.lastProcessedBlock.toString(),
        chainId: this.config.chainId
      });

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to start cache invalidation monitoring');
      throw error;
    }
  }

  /**
   * Stop cache invalidation monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    try {
      logger.info('Stopping cache invalidation monitoring');

      this.isMonitoring = false;

      // Stop block monitoring
      if (this.blockMonitor) {
        await this.blockMonitor.unsubscribe();
        this.blockMonitor = null;
      }

      // Stop event monitoring
      if (this.eventMonitor) {
        await this.eventMonitor.unsubscribe();
        this.eventMonitor = null;
      }

      // Clear reconnect timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      // Process remaining queue
      await this.processRemainingQueue();

      this.emit('monitoringStopped');
      logger.info('Cache invalidation monitoring stopped');

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to stop cache invalidation monitoring');
      throw error;
    }
  }

  /**
   * Start block monitoring
   */
  private async startBlockMonitoring(): Promise<void> {
    try {
      this.blockMonitor = await this.publicClient.watchBlocks({
        onBlock: async (block: Block) => {
          await this.handleNewBlock(block);
        },
        onError: (error: Error) => {
          logger.error({ error: error.message }, 'Block monitoring error');
          this.handleMonitoringError('block', error);
        }
      });

      logger.debug('Block monitoring started');

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to start block monitoring');
      throw error;
    }
  }

  /**
   * Start event monitoring
   */
  private async startEventMonitoring(): Promise<void> {
    try {
      const filters: EventFilterConfig[] = [];

      // PancakeSwap Router events
      if (this.config.enablePriceInvalidation) {
        filters.push({
          address: this.config.pancakeSwapRouter,
          topics: [
            '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67', // Swap event
            '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1'  // Sync event
          ]
        });
      }

      // Master Chef events
      if (this.config.enableLiquidityInvalidation) {
        filters.push({
          address: this.config.masterChef,
          topics: [
            '0x8df3a4701ac36cfc3a9504a85c0c1c0400fa37e32c77f7ae28adc274b38b20d9', // Deposit event
            '0x7151b9d1ea861bc41722c4481af9d5cd73c90450c2eb6396888b4ec68434f9d9'  // Withdraw event
          ]
        });
      }

      // Token transfers for monitored tokens
      if (this.config.enableTransactionInvalidation) {
        const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
        filters.push({
          address: this.config.monitoredTokens,
          topics: [transferTopic]
        });
      }

      // Create event monitoring for each filter
      for (const filter of filters) {
        this.eventMonitor = await this.publicClient.watchEvent({
          address: filter.address,
          topics: filter.topics,
          onLogs: async (logs: Log[]) => {
            await this.handleEvents(logs);
          },
          onError: (error: Error) => {
            logger.error({ error: error.message }, 'Event monitoring error');
            this.handleMonitoringError('event', error);
          }
        });
      }

      logger.debug('Event monitoring started', {
        filtersCount: filters.length
      });

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to start event monitoring');
      throw error;
    }
  }

  /**
   * Handle new block
   */
  private async handleNewBlock(block: Block): Promise<void> {
    try {
      this.metrics.blocksMonitored++;

      // Add invalidation delay
      setTimeout(async () => {
        await this.processBlockInvalidation(block);
      }, this.config.invalidationDelay);

    } catch (error) {
      logger.error({
        blockNumber: block.number?.toString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to handle new block');
      this.metrics.failedInvalidations++;
    }
  }

  /**
   * Handle events
   */
  private async handleEvents(logs: Log[]): Promise<void> {
    try {
      this.metrics.eventsProcessed += logs.length;

      for (const log of logs) {
        await this.processEventInvalidation(log);
      }

    } catch (error) {
      logger.error({
        logsCount: logs.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to handle events');
      this.metrics.failedInvalidations++;
    }
  }

  /**
   * Process block invalidation
   */
  private async processBlockInvalidation(block: Block): Promise<void> {
    if (!this.config.enableBlockInvalidation) {
      return;
    }

    const startTime = Date.now();

    try {
      const trigger: CacheInvalidationTrigger = {
        type: 'block',
        pattern: 'block:*',
        data: {
          blockNumber: block.number,
          blockHash: block.hash,
          timestamp: block.timestamp
        },
        timestamp: Date.now(),
        blockNumber: block.number
      };

      await this.queueInvalidation(trigger);
      this.metrics.blockInvalidations++;

      this.updateProcessingTime(Date.now() - startTime);

    } catch (error) {
      logger.error({
        blockNumber: block.number?.toString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to process block invalidation');
    }
  }

  /**
   * Process event invalidation
   */
  private async processEventInvalidation(log: Log): Promise<void> {
    const startTime = Date.now();

    try {
      let trigger: CacheInvalidationTrigger | null = null;

      // Parse event based on address and topic
      if (log.address.toLowerCase() === this.config.pancakeSwapRouter.toLowerCase()) {
        // PancakeSwap Router event
        if (log.topics[0]?.startsWith('0xc42079f9')) {
          // Swap event - invalidate price caches
          trigger = {
            type: 'price',
            pattern: 'price:*',
            tags: ['price', 'swap'],
            data: {
              transactionHash: log.transactionHash,
              blockNumber: log.blockNumber,
              address: log.address,
              topics: log.topics,
              data: log.data
            },
            timestamp: Date.now(),
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash
          };
          this.metrics.priceInvalidations++;

        } else if (log.topics[0]?.startsWith('0x1c411e9a')) {
          // Sync event - invalidate liquidity caches
          trigger = {
            type: 'liquidity',
            pattern: 'liquidity:*',
            tags: ['liquidity', 'sync'],
            data: {
              transactionHash: log.transactionHash,
              blockNumber: log.blockNumber,
              address: log.address,
              topics: log.topics,
              data: log.data
            },
            timestamp: Date.now(),
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash
          };
          this.metrics.liquidityInvalidations++;
        }

      } else if (this.config.monitoredTokens.includes(log.address as Address)) {
        // Token transfer event
        trigger = {
          type: 'transaction',
          key: `token:${log.address}`,
          tags: ['token', 'transfer'],
          data: {
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            address: log.address,
            topics: log.topics,
            data: log.data
          },
          timestamp: Date.now(),
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash
        };
        this.metrics.transactionInvalidations++;
      }

      if (trigger) {
        await this.queueInvalidation(trigger);
        this.updateProcessingTime(Date.now() - startTime);
      }

    } catch (error) {
      logger.error({
        transactionHash: log.transactionHash,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to process event invalidation');
    }
  }

  /**
   * Queue invalidation
   */
  private async queueInvalidation(trigger: CacheInvalidationTrigger): Promise<void> {
    try {
      // Check queue size
      if (this.invalidationQueue.length >= this.config.maxQueueSize) {
        // Remove oldest triggers
        const removed = this.invalidationQueue.splice(0, this.config.batchSize);
        logger.warn('Invalidation queue full, removed oldest triggers', {
          removedCount: removed.length,
          queueSize: this.invalidationQueue.length
        });
      }

      this.invalidationQueue.push(trigger);
      this.metrics.queueSize = this.invalidationQueue.length;

      // Process batch if we have enough triggers
      if (this.invalidationQueue.length >= this.config.batchSize) {
        await this.processInvalidationBatch();
      }

    } catch (error) {
      logger.error({
        triggerType: trigger.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to queue invalidation');
    }
  }

  /**
   * Process invalidation batch
   */
  private async processInvalidationBatch(): Promise<void> {
    if (this.invalidationQueue.length === 0) {
      return;
    }

    const startTime = Date.now();
    const batch = this.invalidationQueue.splice(0, this.config.batchSize);
    this.metrics.queueSize = this.invalidationQueue.length;

    try {
      const results: CacheInvalidationResult[] = [];

      for (const trigger of batch) {
        const result = await this.processInvalidationTrigger(trigger);
        results.push(result);
      }

      // Update metrics
      this.updateMetrics(results, Date.now() - startTime);

      // Emit batch processed event
      this.emit('batchProcessed', {
        batchSize: batch.length,
        results,
        processingTime: Date.now() - startTime
      });

    } catch (error) {
      logger.error({
        batchSize: batch.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to process invalidation batch');

      // Re-queue failed triggers
      this.invalidationQueue.unshift(...batch);
      this.metrics.queueSize = this.invalidationQueue.length;
    }
  }

  /**
   * Process individual invalidation trigger
   */
  private async processInvalidationTrigger(trigger: CacheInvalidationTrigger): Promise<CacheInvalidationResult> {
    const startTime = Date.now();

    try {
      const invalidatedKeys: string[] = [];
      const invalidatedPatterns: string[] = [];
      const invalidatedTags: string[] = [];

      // Emit invalidation event for external cache managers to handle
      this.emit('invalidate', trigger);

      // Track what would be invalidated (for metrics)
      if (trigger.key) {
        invalidatedKeys.push(trigger.key);
      }
      if (trigger.pattern) {
        invalidatedPatterns.push(trigger.pattern);
      }
      if (trigger.tags) {
        invalidatedTags.push(...trigger.tags);
      }

      this.metrics.successfulInvalidations++;

      return {
        success: true,
        invalidatedKeys,
        invalidatedPatterns,
        invalidatedTags,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      this.metrics.failedInvalidations++;

      return {
        success: false,
        invalidatedKeys: [],
        invalidatedPatterns: [],
        invalidatedTags: [],
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle monitoring errors
   */
  private handleMonitoringError(type: 'block' | 'event', error: Error): Promise<void> | void {
    logger.error({
      type,
      error: error.message
    }, 'Monitoring error occurred');

    // Attempt to reconnect
    if (this.isMonitoring && !this.reconnectTimer) {
      this.reconnectTimer = setTimeout(async () => {
        try {
          logger.info('Attempting to reconnect monitoring');
          await this.reconnectMonitoring();
          this.metrics.webSocketReconnections++;
        } catch (reconnectError) {
          logger.error({
            error: reconnectError instanceof Error ? reconnectError.message : 'Unknown error'
          }, 'Failed to reconnect monitoring');
        }
      }, 5000);
    }
  }

  /**
   * Reconnect monitoring
   */
  private async reconnectMonitoring(): Promise<void> {
    try {
      // Stop current monitoring
      if (this.blockMonitor) {
        await this.blockMonitor.unsubscribe();
        this.blockMonitor = null;
      }
      if (this.eventMonitor) {
        await this.eventMonitor.unsubscribe();
        this.eventMonitor = null;
      }

      // Restart monitoring
      await this.startBlockMonitoring();
      await this.startEventMonitoring();

      logger.info('Monitoring reconnected successfully');

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to reconnect monitoring');
      throw error;
    }
  }

  /**
   * Process remaining queue
   */
  private async processRemainingQueue(): Promise<void> {
    if (this.invalidationQueue.length === 0) {
      return;
    }

    logger.info('Processing remaining invalidation queue', {
      queueSize: this.invalidationQueue.length
    });

    while (this.invalidationQueue.length > 0) {
      await this.processInvalidationBatch();

      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info('Remaining invalidation queue processed');
  }

  /**
   * Manual cache invalidation
   */
  async invalidate(
    type: CacheInvalidationTrigger['type'],
    target: {
      key?: string;
      pattern?: string;
      tags?: string[];
      data?: any;
    }
  ): Promise<CacheInvalidationResult> {
    const trigger: CacheInvalidationTrigger = {
      type,
      key: target.key,
      pattern: target.pattern,
      tags: target.tags,
      data: target.data || {},
      timestamp: Date.now()
    };

    return await this.processInvalidationTrigger(trigger);
  }

  /**
   * Update processing time metrics
   */
  private updateProcessingTime(processingTime: number): void {
    this.processingTimes.push(processingTime);
    this.totalProcessingTime += processingTime;

    // Keep only recent processing times
    if (this.processingTimes.length > 1000) {
      const excess = this.processingTimes.length - 1000;
      this.processingTimes.splice(0, excess);
    }

    // Update average
    this.metrics.averageProcessingTime = this.totalProcessingTime / this.processingTimes.length;
  }

  /**
   * Update metrics
   */
  private updateMetrics(results: CacheInvalidationResult[], batchProcessingTime: number): void {
    this.metrics.totalInvalidations += results.length;

    const now = Date.now();
    const timeDiff = now - this.lastMetricsUpdate;

    if (timeDiff > 0) {
      this.metrics.processingRate = (results.length / timeDiff) * 1000; // per second
      this.metrics.eventProcessingRate = (this.metrics.eventsProcessed / timeDiff) * 1000;
    }

    this.lastMetricsUpdate = now;

    // Calculate error rate
    const failedCount = results.filter(r => !r.success).length;
    this.metrics.errorRate = results.length > 0 ? failedCount / results.length : 0;
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics(): ViemInvalidationMetrics & {
    bscSpecific: {
      priceInvalidationsPerMinute: number;
      liquidityInvalidationsPerMinute: number;
      averageBlockProcessingDelay: number;
      reorgDetectionCount: number;
    };
    viemSpecific: {
      eventsPerSecond: number;
      averageEventProcessingTime: number;
      webSocketConnectionUptime: number;
      monitoringReliability: number;
    };
  } {
    const now = Date.now();
    const uptimeMinutes = (now - this.lastMetricsUpdate) / 60000 || 1;

    return {
      ...this.metrics,
      bscSpecific: {
        priceInvalidationsPerMinute: this.metrics.priceInvalidations / uptimeMinutes,
        liquidityInvalidationsPerMinute: this.metrics.liquidityInvalidations / uptimeMinutes,
        averageBlockProcessingDelay: this.config.invalidationDelay,
        reorgDetectionCount: this.metrics.reorgHandling
      },
      viemSpecific: {
        eventsPerSecond: this.metrics.eventProcessingRate,
        averageEventProcessingTime: this.metrics.averageProcessingTime,
        webSocketConnectionUptime: this.isMonitoring ? now - this.lastMetricsUpdate : 0,
        monitoringReliability: this.metrics.totalInvalidations > 0
          ? this.metrics.successfulInvalidations / this.metrics.totalInvalidations
          : 1
      }
    };
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    monitoring: boolean;
    queueSize: number;
    errorRate: number;
    processingRate: number;
    uptime: number;
    issues: string[];
  } {
    const issues: string[] = [];
    const metrics = this.getMetrics();

    // Check for issues
    if (!this.isMonitoring) {
      issues.push('Monitoring is not active');
    }

    if (metrics.queueSize > this.config.maxQueueSize * 0.8) {
      issues.push('High queue size (>80%)');
    }

    if (metrics.errorRate > 0.1) {
      issues.push('High error rate (>10%)');
    }

    if (metrics.processingRate < 1) {
      issues.push('Low processing rate (<1/sec)');
    }

    return {
      healthy: issues.length === 0,
      monitoring: this.isMonitoring,
      queueSize: metrics.queueSize,
      errorRate: metrics.errorRate,
      processingRate: metrics.processingRate,
      uptime: Date.now() - this.lastMetricsUpdate,
      issues
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): BscCacheInvalidationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<BscCacheInvalidationConfig>): void {
    this.config = { ...this.config, ...updates };

    logger.info('Cache invalidation configuration updated', {
      updates: Object.keys(updates),
      newConfig: this.config
    });

    this.emit('configUpdated', this.config);
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = {
      totalInvalidations: 0,
      successfulInvalidations: 0,
      failedInvalidations: 0,
      averageProcessingTime: 0,
      eventProcessingRate: 0,
      priceInvalidations: 0,
      liquidityInvalidations: 0,
      transactionInvalidations: 0,
      blockInvalidations: 0,
      eventsProcessed: 0,
      blocksMonitored: 0,
      reorgHandling: 0,
      webSocketReconnections: 0,
      queueSize: this.invalidationQueue.length,
      processingRate: 0,
      errorRate: 0
    };

    this.processingTimes = [];
    this.totalProcessingTime = 0;
    this.lastMetricsUpdate = Date.now();

    logger.info('Cache invalidation metrics cleared');
  }

  /**
   * Shutdown cache invalidation manager
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Cache Invalidation Manager');

      await this.stopMonitoring();

      this.clearMetrics();
      this.removeAllListeners();

      logger.info('Cache Invalidation Manager shutdown completed');

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to shutdown Cache Invalidation Manager');
      throw error;
    }
  }
}

// Export singleton instance factory
export function createCacheInvalidationManagerViem(
  config?: Partial<BscCacheInvalidationConfig>,
  publicClient?: PublicClient<Transport, Chain>
): CacheInvalidationManagerViem {
  return new CacheInvalidationManagerViem(config, publicClient);
}