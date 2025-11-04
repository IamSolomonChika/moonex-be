import { EventEmitter } from 'events';
import { BSCTransactionOptimizer, TransactionOptimizationConfig } from './transaction-optimizer';
import { AdvancedCacheManager, CacheConfig } from './cache-manager';
import { AdvancedBatchProcessor, BatchProcessorConfig } from './batch-processor';
import { RealTimeUpdater, RealTimeConfig } from './realtime-updater';
import { RPCConnectionPool, RPCConnectionConfig } from './rpc-connection-pool';

export interface BSCOptimizationConfig {
  /** Transaction optimization configuration */
  transactionConfig: TransactionOptimizationConfig;
  /** Cache management configuration */
  cacheConfig: CacheConfig;
  /** Batch processing configuration */
  batchConfig: BatchProcessorConfig;
  /** Real-time updates configuration */
  realtimeConfig: RealTimeConfig;
  /** RPC connection pool configuration */
  rpcConfig: RPCConnectionConfig;
  /** Global optimization settings */
  globalConfig: {
    /** Enable performance monitoring */
    enableMonitoring: boolean;
    /** Metrics collection interval in milliseconds */
    metricsInterval: number;
    /** Enable automatic optimization */
    enableAutoOptimization: boolean;
    /** Performance thresholds for auto-optimization */
    performanceThresholds: {
      maxResponseTime: number;
      maxFailureRate: number;
      minSuccessRate: number;
      maxMemoryUsage: number;
    };
  };
}

export interface OptimizationMetrics {
  /** Transaction optimization metrics */
  transactionMetrics: any;
  /** Cache performance metrics */
  cacheMetrics: any;
  /** Batch processing metrics */
  batchMetrics: any;
  /** Real-time update metrics */
  realtimeMetrics: any;
  /** RPC connection pool metrics */
  rpcMetrics: any;
  /** Overall system performance */
  overallPerformance: {
    totalRequests: number;
    averageResponseTime: number;
    successRate: number;
    throughput: number;
    memoryUsage: number;
    timestamp: number;
  };
}

/**
 * Main BSC Optimization Engine
 * Integrates all optimization systems for maximum performance
 */
export class BSCOptimizationEngine extends EventEmitter {
  private config: BSCOptimizationConfig;
  private transactionOptimizer: BSCTransactionOptimizer;
  private cacheManager: AdvancedCacheManager;
  private batchProcessor: AdvancedBatchProcessor;
  private realTimeUpdater: RealTimeUpdater;
  private rpcConnectionPool: RPCConnectionPool;
  private metricsInterval?: NodeJS.Timeout;
  private metrics: OptimizationMetrics;

  constructor(config: Partial<BSCOptimizationConfig> = {}) {
    super();

    this.config = {
      transactionConfig: {
        maxBatchSize: 50,
        maxWaitTime: 5000,
        gasOptimization: true,
        priorityLevels: 3,
        maxPendingTransactions: 1000
      },
      cacheConfig: {
        maxSize: 1000,
        ttl: 300000,
        cleanupInterval: 60000,
        compressionThreshold: 1024
      },
      batchConfig: {
        maxBatchSize: 100,
        maxWaitTime: 10000,
        maxConcurrentBatches: 5,
        retryAttempts: 3
      },
      realtimeConfig: {
        maxUpdateInterval: 5000,
        maxSubscriptions: 1000,
        bufferSize: 100
      },
      rpcConfig: {
        endpoints: [
          'https://bsc-dataseed1.binance.org',
          'https://bsc-dataseed2.binance.org',
          'https://bsc-dataseed3.binance.org',
          'https://bsc-dataseed4.binance.org'
        ],
        maxConnectionsPerEndpoint: 5,
        connectionTimeout: 5000,
        healthCheckInterval: 30000,
        requestTimeout: 10000,
        maxRetries: 3,
        loadBalancingStrategy: 'least-connections',
        failoverStrategy: 'circuit-breaker'
      },
      globalConfig: {
        enableMonitoring: true,
        metricsInterval: 5000,
        enableAutoOptimization: true,
        performanceThresholds: {
          maxResponseTime: 1000,
          maxFailureRate: 0.1,
          minSuccessRate: 0.9,
          maxMemoryUsage: 0.8
        }
      },
      ...config
    };

    this.initializeOptimizers();
    this.setupEventHandlers();
    this.startMetricsCollection();
  }

  /**
   * Initialize all optimization systems
   */
  private initializeOptimizers(): void {
    this.transactionOptimizer = new BSCTransactionOptimizer(this.config.transactionConfig);
    this.cacheManager = new AdvancedCacheManager(this.config.cacheConfig);
    this.batchProcessor = new AdvancedBatchProcessor(this.config.batchConfig);
    this.realTimeUpdater = new RealTimeUpdater(this.config.realtimeConfig);
    this.rpcConnectionPool = new RPCConnectionPool(this.config.rpcConfig);

    this.metrics = {
      transactionMetrics: this.transactionOptimizer.getMetrics(),
      cacheMetrics: this.cacheManager.getMetrics(),
      batchMetrics: this.batchProcessor.getMetrics(),
      realtimeMetrics: this.realTimeUpdater.getMetrics(),
      rpcMetrics: this.rpcConnectionPool.getMetrics(),
      overallPerformance: {
        totalRequests: 0,
        averageResponseTime: 0,
        successRate: 1,
        throughput: 0,
        memoryUsage: 0,
        timestamp: Date.now()
      }
    };
  }

  /**
   * Setup event handlers between optimization systems
   */
  private setupEventHandlers(): void {
    // Transaction optimizer events
    this.transactionOptimizer.on('batchProcessed', (data) => {
      this.emit('transactionBatchProcessed', data);
    });

    this.transactionOptimizer.on('transactionOptimized', (data) => {
      this.emit('transactionOptimized', data);
    });

    // Cache manager events
    this.cacheManager.on('cacheHit', (data) => {
      this.emit('cacheHit', data);
    });

    this.cacheManager.on('cacheMiss', (data) => {
      this.emit('cacheMiss', data);
    });

    // Batch processor events
    this.batchProcessor.on('batchCompleted', (data) => {
      this.emit('batchCompleted', data);
    });

    // Real-time updater events
    this.realTimeUpdater.on('dataUpdated', (data) => {
      this.emit('dataUpdated', data);
    });

    // RPC connection pool events
    this.rpcConnectionPool.on('requestSuccess', (data) => {
      this.emit('rpcRequestSuccess', data);
    });

    this.rpcConnectionPool.on('requestFailure', (data) => {
      this.emit('rpcRequestFailure', data);
    });

    this.rpcConnectionPool.on('connectionFailure', (data) => {
      this.emit('rpcConnectionFailure', data);
    });
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    if (!this.config.globalConfig.enableMonitoring) return;

    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
      this.checkPerformanceThresholds();
    }, this.config.globalConfig.metricsInterval);
  }

  /**
   * Update optimization metrics
   */
  private updateMetrics(): void {
    this.metrics.transactionMetrics = this.transactionOptimizer.getMetrics();
    this.metrics.cacheMetrics = this.cacheManager.getMetrics();
    this.metrics.batchMetrics = this.batchProcessor.getMetrics();
    this.metrics.realtimeMetrics = this.realTimeUpdater.getMetrics();
    this.metrics.rpcMetrics = this.rpcConnectionPool.getMetrics();

    // Calculate overall performance metrics
    const rpcMetrics = this.metrics.rpcMetrics;
    const cacheMetrics = this.metrics.cacheMetrics;

    this.metrics.overallPerformance = {
      totalRequests: rpcMetrics.totalRequests,
      averageResponseTime: rpcMetrics.averageResponseTime,
      successRate: rpcMetrics.totalRequests > 0 ?
        (rpcMetrics.totalRequests - rpcMetrics.totalFailures) / rpcMetrics.totalRequests : 1,
      throughput: rpcMetrics.requestsPerSecond,
      memoryUsage: this.calculateMemoryUsage(),
      timestamp: Date.now()
    };

    this.emit('metricsUpdated', this.metrics);
  }

  /**
   * Check performance thresholds and trigger auto-optimization
   */
  private checkPerformanceThresholds(): void {
    if (!this.config.globalConfig.enableAutoOptimization) return;

    const thresholds = this.config.globalConfig.performanceThresholds;
    const performance = this.metrics.overallPerformance;

    // Check response time threshold
    if (performance.averageResponseTime > thresholds.maxResponseTime) {
      this.triggerAutoOptimization('response_time', performance.averageResponseTime);
    }

    // Check failure rate threshold
    const failureRate = 1 - performance.successRate;
    if (failureRate > thresholds.maxFailureRate) {
      this.triggerAutoOptimization('failure_rate', failureRate);
    }

    // Check success rate threshold
    if (performance.successRate < thresholds.minSuccessRate) {
      this.triggerAutoOptimization('success_rate', performance.successRate);
    }

    // Check memory usage threshold
    if (performance.memoryUsage > thresholds.maxMemoryUsage) {
      this.triggerAutoOptimization('memory_usage', performance.memoryUsage);
    }
  }

  /**
   * Trigger automatic optimization based on performance metrics
   */
  private triggerAutoOptimization(metric: string, value: number): void {
    this.emit('autoOptimizationTriggered', { metric, value });

    switch (metric) {
      case 'response_time':
        // Optimize for faster response times
        this.optimizeForResponseTime();
        break;

      case 'failure_rate':
        // Optimize for better reliability
        this.optimizeForReliability();
        break;

      case 'success_rate':
        // Optimize for better success rates
        this.optimizeForReliability();
        break;

      case 'memory_usage':
        // Optimize memory usage
        this.optimizeMemoryUsage();
        break;
    }
  }

  /**
   * Optimize system for faster response times
   */
  private optimizeForResponseTime(): void {
    // Increase cache size for better hit rates
    const currentConfig = this.cacheManager.getConfig();
    const newConfig = {
      ...currentConfig,
      maxSize: Math.min(currentConfig.maxSize * 1.5, 5000),
      ttl: Math.min(currentConfig.ttl * 1.2, 600000)
    };
    this.cacheManager.updateConfig(newConfig);

    // Increase batch sizes for better throughput
    const batchConfig = this.batchProcessor.getConfig();
    this.batchProcessor.updateConfig({
      ...batchConfig,
      maxBatchSize: Math.min(batchConfig.maxBatchSize * 1.2, 200)
    });

    this.emit('optimizationApplied', { type: 'response_time', changes: ['cache_size', 'batch_size'] });
  }

  /**
   * Optimize system for better reliability
   */
  private optimizeForReliability(): void {
    // Increase retry attempts and timeouts
    const rpcConfig = this.rpcConnectionPool.getConfig();
    this.rpcConnectionPool.updateConfig({
      ...rpcConfig,
      maxRetries: Math.min(rpcConfig.maxRetries + 1, 5),
      requestTimeout: Math.min(rpcConfig.requestTimeout * 1.2, 30000)
    });

    // Reduce batch sizes for faster error detection
    const batchConfig = this.batchProcessor.getConfig();
    this.batchProcessor.updateConfig({
      ...batchConfig,
      maxBatchSize: Math.max(batchConfig.maxBatchSize * 0.8, 10)
    });

    this.emit('optimizationApplied', { type: 'reliability', changes: ['retry_attempts', 'batch_size'] });
  }

  /**
   * Optimize memory usage
   */
  private optimizeMemoryUsage(): void {
    // Reduce cache size and TTL
    const cacheConfig = this.cacheManager.getConfig();
    this.cacheManager.updateConfig({
      ...cacheConfig,
      maxSize: Math.max(cacheConfig.maxSize * 0.7, 100),
      ttl: Math.max(cacheConfig.ttl * 0.8, 60000),
      cleanupInterval: Math.max(cacheConfig.cleanupInterval * 0.5, 30000)
    });

    // Trigger garbage collection if available
    if (global.gc) {
      global.gc();
    }

    this.emit('optimizationApplied', { type: 'memory_usage', changes: ['cache_size', 'cleanup_interval'] });
  }

  /**
   * Calculate current memory usage
   */
  private calculateMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      const totalMemory = usage.heapTotal + usage.external;
      const heapUsed = usage.heapUsed + usage.external;
      return heapUsed / totalMemory;
    }
    return 0;
  }

  /**
   * Get transaction optimizer instance
   */
  getTransactionOptimizer(): BSCTransactionOptimizer {
    return this.transactionOptimizer;
  }

  /**
   * Get cache manager instance
   */
  getCacheManager(): AdvancedCacheManager {
    return this.cacheManager;
  }

  /**
   * Get batch processor instance
   */
  getBatchProcessor(): AdvancedBatchProcessor {
    return this.batchProcessor;
  }

  /**
   * Get real-time updater instance
   */
  getRealTimeUpdater(): RealTimeUpdater {
    return this.realTimeUpdater;
  }

  /**
   * Get RPC connection pool instance
   */
  getRPCConnectionPool(): RPCConnectionPool {
    return this.rpcConnectionPool;
  }

  /**
   * Get comprehensive optimization metrics
   */
  getMetrics(): OptimizationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get system status and health information
   */
  getStatus(): {
    isHealthy: boolean;
    totalOptimizers: number;
    activeOptimizers: number;
    performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    metrics: OptimizationMetrics;
    recommendations: string[];
  } {
    const performance = this.metrics.overallPerformance;
    const thresholds = this.config.globalConfig.performanceThresholds;

    // Calculate health status
    const isHealthy =
      performance.averageResponseTime <= thresholds.maxResponseTime &&
      performance.successRate >= thresholds.minSuccessRate &&
      performance.memoryUsage <= thresholds.maxMemoryUsage;

    // Calculate performance grade
    let performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F' = 'A';

    if (performance.averageResponseTime > thresholds.maxResponseTime * 2) performanceGrade = 'F';
    else if (performance.averageResponseTime > thresholds.maxResponseTime * 1.5) performanceGrade = 'D';
    else if (performance.averageResponseTime > thresholds.maxResponseTime * 1.2) performanceGrade = 'C';
    else if (performance.averageResponseTime > thresholds.maxResponseTime) performanceGrade = 'B';

    if (performance.successRate < thresholds.minSuccessRate * 0.8) performanceGrade = 'F';
    else if (performance.successRate < thresholds.minSuccessRate * 0.9) performanceGrade = 'D';
    else if (performance.successRate < thresholds.minSuccessRate) performanceGrade = 'C';

    // Generate recommendations
    const recommendations: string[] = [];

    if (performance.averageResponseTime > thresholds.maxResponseTime) {
      recommendations.push('Consider increasing cache size and optimizing batch processing');
    }

    if (performance.successRate < thresholds.minSuccessRate) {
      recommendations.push('Increase retry attempts and improve error handling');
    }

    if (performance.memoryUsage > thresholds.maxMemoryUsage) {
      recommendations.push('Reduce cache size and implement more aggressive cleanup');
    }

    return {
      isHealthy,
      totalOptimizers: 5,
      activeOptimizers: 5,
      performanceGrade,
      metrics: this.metrics,
      recommendations
    };
  }

  /**
   * Update optimization configuration
   */
  updateConfig(config: Partial<BSCOptimizationConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.transactionConfig) {
      this.transactionOptimizer.updateConfig(config.transactionConfig);
    }

    if (config.cacheConfig) {
      this.cacheManager.updateConfig(config.cacheConfig);
    }

    if (config.batchConfig) {
      this.batchProcessor.updateConfig(config.batchConfig);
    }

    if (config.realtimeConfig) {
      this.realTimeUpdater.updateConfig(config.realtimeConfig);
    }

    if (config.rpcConfig) {
      this.rpcConnectionPool.updateConfig(config.rpcConfig);
    }

    this.emit('configUpdated', config);
  }

  /**
   * Shutdown all optimization systems
   */
  async shutdown(): Promise<void> {
    // Clear metrics collection
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Shutdown all optimizers
    await Promise.all([
      this.transactionOptimizer.shutdown(),
      this.cacheManager.shutdown(),
      this.batchProcessor.shutdown(),
      this.realTimeUpdater.shutdown(),
      this.rpcConnectionPool.shutdown()
    ]);

    this.emit('shutdown');
    this.removeAllListeners();
  }

  /**
   * Force manual optimization of all systems
   */
  async optimizeAll(): Promise<void> {
    await Promise.all([
      this.transactionOptimizer.optimize(),
      this.cacheManager.optimize(),
      this.batchProcessor.optimize(),
      this.realTimeUpdater.optimize(),
      this.rpcConnectionPool.optimize()
    ]);

    this.emit('manualOptimizationCompleted');
  }
}

// Export all optimization components
export {
  BSCTransactionOptimizer,
  AdvancedCacheManager,
  AdvancedBatchProcessor,
  RealTimeUpdater,
  RPCConnectionPool
};

// Export types
export type {
  TransactionOptimizationConfig,
  CacheConfig,
  BatchProcessorConfig,
  RealTimeConfig,
  RPCConnectionConfig,
  OptimizationMetrics
};