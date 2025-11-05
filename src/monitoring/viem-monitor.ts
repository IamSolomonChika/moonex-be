/**
 * 📊 Viem Monitoring System
 *
 * Comprehensive monitoring and metrics collection for Viem 2.38.5 deployment
 * Tracks performance, health, and operational metrics
 */

import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';
import { EventEmitter } from 'events';

// Monitoring configuration
interface MonitoringConfig {
  enabled: boolean;
  interval: number;
  metricsRetention: number;
  alertThresholds: {
    responseTime: number;
    errorRate: number;
    memoryUsage: number;
    bscLatency: number;
  };
}

// Metric types
interface Metric {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
}

interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: number;
  responseTime: number;
  details?: any;
}

/**
 * Viem Monitoring Class
 */
export class ViemMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private publicClient: any;
  private metrics: Map<string, Metric[]> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;

    // Initialize Viem client for monitoring
    this.publicClient = createPublicClient({
      chain: bsc,
      transport: http(process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org')
    });
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (!this.config.enabled) {
      console.log('📊 Viem monitoring is disabled');
      return;
    }

    console.log('📊 Starting Viem monitoring system...');

    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.interval);

    // Collect initial metrics
    this.collectMetrics();

    console.log('✅ Viem monitoring system started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('📊 Viem monitoring system stopped');
  }

  /**
   * Collect metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = Date.now();

      // Collect application metrics
      await this.collectApplicationMetrics(timestamp);

      // Collect BSC metrics
      await this.collectBSCMetrics(timestamp);

      // Collect performance metrics
      await this.collectPerformanceMetrics(timestamp);

      // Perform health checks
      await this.performHealthChecks(timestamp);

      // Clean up old metrics
      this.cleanupOldMetrics();

      // Emit metrics update event
      this.emit('metrics-updated', this.getLatestMetrics());

    } catch (error) {
      console.error('❌ Error collecting metrics:', error);
      this.emit('metrics-error', error);
    }
  }

  /**
   * Collect application metrics
   */
  private async collectApplicationMetrics(timestamp: number): Promise<void> {
    const memUsage = process.memoryUsage();

    // Memory usage metrics
    this.recordMetric('memory.heap_used', memUsage.heapUsed, timestamp, {
      unit: 'bytes'
    });

    this.recordMetric('memory.heap_total', memUsage.heapTotal, timestamp, {
      unit: 'bytes'
    });

    this.recordMetric('memory.external', memUsage.external, timestamp, {
      unit: 'bytes'
    });

    this.recordMetric('memory.rss', memUsage.rss, timestamp, {
      unit: 'bytes'
    });

    // CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    this.recordMetric('cpu.user', cpuUsage.user, timestamp, {
      unit: 'microseconds'
    });

    this.recordMetric('cpu.system', cpuUsage.system, timestamp, {
      unit: 'microseconds'
    });

    // Uptime
    this.recordMetric('process.uptime', process.uptime(), timestamp, {
      unit: 'seconds'
    });
  }

  /**
   * Collect BSC-specific metrics
   */
  private async collectBSCMetrics(timestamp: number): Promise<void> {
    try {
      // BSC block number
      const startTime = performance.now();
      const blockNumber = await this.publicClient.getBlockNumber();
      const bscLatency = performance.now() - startTime;

      this.recordMetric('bsc.block_number', Number(blockNumber), timestamp);
      this.recordMetric('bsc.latency', bscLatency, timestamp, {
        unit: 'milliseconds'
      });

      // Gas price
      const gasPrice = await this.publicClient.getGasPrice();
      this.recordMetric('bsc.gas_price', Number(gasPrice), timestamp, {
        unit: 'wei'
      });

      // Latest block info
      const latestBlock = await this.publicClient.getBlock();
      if (latestBlock) {
        this.recordMetric('bsc.block_size', latestBlock.size || 0, timestamp);
        this.recordMetric('bsc.gas_limit', Number(latestBlock.gasLimit), timestamp);
        this.recordMetric('bsc.gas_used', Number(latestBlock.gasUsed), timestamp);
        this.recordMetric('bsc.transaction_count', latestBlock.transactions.length, timestamp);
      }

    } catch (error) {
      console.error('❌ Error collecting BSC metrics:', error);
      this.recordMetric('bsc.errors', 1, timestamp);
    }
  }

  /**
   * Collect performance metrics
   */
  private async collectPerformanceMetrics(timestamp: number): Promise<void> {
    // Event loop lag
    const lag = await this.measureEventLoopLag();
    this.recordMetric('performance.event_loop_lag', lag, timestamp, {
      unit: 'milliseconds'
    });

    // Active handles
    this.recordMetric('performance.active_handles', process.getActiveHandles().length, timestamp);

    // Active requests
    this.recordMetric('performance.active_requests', process.getActiveRequests().length, timestamp);
  }

  /**
   * Perform health checks
   */
  private async performHealthChecks(timestamp: number): Promise<void> {
    // BSC connectivity check
    await this.checkBSCHealth(timestamp);

    // Memory health check
    await this.checkMemoryHealth(timestamp);

    // Performance health check
    await this.checkPerformanceHealth(timestamp);
  }

  /**
   * Check BSC health
   */
  private async checkBSCHealth(timestamp: number): Promise<void> {
    const startTime = performance.now();
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

    try {
      // Test basic connectivity
      await this.publicClient.getBlockNumber();
      const responseTime = performance.now() - startTime;

      if (responseTime > this.config.alertThresholds.bscLatency) {
        status = 'degraded';
      }

      this.updateHealthCheck('bsc', {
        service: 'bsc',
        status,
        lastCheck: timestamp,
        responseTime,
        details: {
          latency: responseTime,
          threshold: this.config.alertThresholds.bscLatency
        }
      });

    } catch (error) {
      status = 'unhealthy';

      this.updateHealthCheck('bsc', {
        service: 'bsc',
        status,
        lastCheck: timestamp,
        responseTime: performance.now() - startTime,
        details: {
          error: error.message
        }
      });
    }
  }

  /**
   * Check memory health
   */
  private async checkMemoryHealth(timestamp: number): Promise<void> {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

    if (heapUsedMB > this.config.alertThresholds.memoryUsage) {
      status = 'degraded';
    }

    if (heapUsedMB > this.config.alertThresholds.memoryUsage * 1.5) {
      status = 'unhealthy';
    }

    this.updateHealthCheck('memory', {
      service: 'memory',
      status,
      lastCheck: timestamp,
      responseTime: 0,
      details: {
        heapUsed: heapUsedMB,
        threshold: this.config.alertThresholds.memoryUsage
      }
    });
  }

  /**
   * Check performance health
   */
  private async checkPerformanceHealth(timestamp: number): Promise<void> {
    const eventLoopLag = await this.measureEventLoopLag();
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

    if (eventLoopLag > 100) { // 100ms threshold
      status = 'degraded';
    }

    if (eventLoopLag > 500) { // 500ms threshold
      status = 'unhealthy';
    }

    this.updateHealthCheck('performance', {
      service: 'performance',
      status,
      lastCheck: timestamp,
      responseTime: 0,
      details: {
        eventLoopLag,
        threshold: 100
      }
    });
  }

  /**
   * Measure event loop lag
   */
  private measureEventLoopLag(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
        resolve(lag);
      });
    });
  }

  /**
   * Record a metric
   */
  private recordMetric(name: string, value: number, timestamp: number, tags: Record<string, string> = {}): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metric: Metric = {
      name,
      value,
      timestamp,
      tags
    };

    this.metrics.get(name)!.push(metric);

    // Emit metric event
    this.emit('metric', metric);
  }

  /**
   * Update health check
   */
  private updateHealthCheck(service: string, healthCheck: HealthCheck): void {
    const previousStatus = this.healthChecks.get(service)?.status;
    this.healthChecks.set(service, healthCheck);

    // Emit health change event
    if (previousStatus !== healthCheck.status) {
      this.emit('health-change', {
        service,
        previousStatus,
        currentStatus: healthCheck.status,
        healthCheck
      });
    }

    // Emit health check event
    this.emit('health-check', healthCheck);
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - this.config.metricsRetention;

    for (const [name, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter(metric => metric.timestamp > cutoffTime);
      this.metrics.set(name, filteredMetrics);
    }
  }

  /**
   * Get latest metrics
   */
  getLatestMetrics(): Record<string, Metric> {
    const latest: Record<string, Metric> = {};

    for (const [name, metrics] of this.metrics.entries()) {
      if (metrics.length > 0) {
        latest[name] = metrics[metrics.length - 1];
      }
    }

    return latest;
  }

  /**
   * Get health status
   */
  getHealthStatus(): Record<string, HealthCheck> {
    const status: Record<string, HealthCheck> = {};

    for (const [service, healthCheck] of this.healthChecks.entries()) {
      status[service] = healthCheck;
    }

    return status;
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): any {
    const latest = this.getLatestMetrics();
    const health = this.getHealthStatus();

    return {
      timestamp: Date.now(),
      health: Object.values(health).some(check => check.status === 'unhealthy') ? 'unhealthy' :
             Object.values(health).some(check => check.status === 'degraded') ? 'degraded' : 'healthy',
      services: Object.keys(health).length,
      metrics: Object.keys(latest).length,
      memory: {
        heapUsed: latest['memory.heap_used']?.value || 0,
        heapTotal: latest['memory.heap_total']?.value || 0
      },
      bsc: {
        blockNumber: latest['bsc.block_number']?.value || 0,
        gasPrice: latest['bsc.gas_price']?.value || 0,
        latency: latest['bsc.latency']?.value || 0
      },
      performance: {
        eventLoopLag: latest['performance.event_loop_lag']?.value || 0,
        activeHandles: latest['performance.active_handles']?.value || 0
      }
    };
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): string {
    const latest = this.getLatestMetrics();
    const health = this.getHealthStatus();

    return JSON.stringify({
      timestamp: Date.now(),
      metrics: latest,
      health: health,
      summary: this.getMetricsSummary()
    }, null, 2);
  }
}

// Default monitoring configuration
export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  enabled: true,
  interval: 30000, // 30 seconds
  metricsRetention: 3600000, // 1 hour
  alertThresholds: {
    responseTime: 5000, // 5 seconds
    errorRate: 5, // 5%
    memoryUsage: 1024, // 1GB
    bscLatency: 2000 // 2 seconds
  }
};

// Create singleton instance
let monitorInstance: ViemMonitor | null = null;

export function getViemMonitor(config?: Partial<MonitoringConfig>): ViemMonitor {
  if (!monitorInstance) {
    const finalConfig = {
      ...DEFAULT_MONITORING_CONFIG,
      ...(config || {})
    };

    monitorInstance = new ViemMonitor(finalConfig);
  }

  return monitorInstance;
}

export function startViemMonitoring(config?: Partial<MonitoringConfig>): ViemMonitor {
  const monitor = getViemMonitor(config);
  monitor.start();
  return monitor;
}

export function stopViemMonitoring(): void {
  if (monitorInstance) {
    monitorInstance.stop();
  }
}