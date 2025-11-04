import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { WebSocketProvider, JsonRpcProvider } from '@ethersproject/providers';
import WebSocket from 'ws';

export interface RPCConnectionConfig {
  /** List of RPC endpoint URLs */
  endpoints: string[];
  /** Maximum connections per endpoint */
  maxConnectionsPerEndpoint: number;
  /** Connection timeout in milliseconds */
  connectionTimeout: number;
  /** Health check interval in milliseconds */
  healthCheckInterval: number;
  /** Maximum request timeout in milliseconds */
  requestTimeout: number;
  /** Retry attempts for failed requests */
  maxRetries: number;
  /** Backoff multiplier for retries */
  retryBackoffMultiplier: number;
  /** Load balancing strategy */
  loadBalancingStrategy: 'round-robin' | 'weighted' | 'least-connections';
  /** Failover strategy */
  failoverStrategy: 'immediate' | 'delayed' | 'circuit-breaker';
  /** Circuit breaker threshold (failure percentage) */
  circuitBreakerThreshold: number;
  /** Circuit breaker timeout in milliseconds */
  circuitBreakerTimeout: number;
  /** Enable connection metrics collection */
  enableMetrics: boolean;
  /** WebSocket specific configuration */
  websocketConfig: {
    /** Reconnect interval in milliseconds */
    reconnectInterval: number;
    /** Maximum reconnection attempts */
    maxReconnectAttempts: number;
    /** Ping interval in milliseconds */
    pingInterval: number;
  };
}

export interface ConnectionStats {
  endpoint: string;
  activeConnections: number;
  totalRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastUsed: number;
  isHealthy: boolean;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  failureRate: number;
}

export interface ConnectionMetrics {
  totalRequests: number;
  totalFailures: number;
  averageResponseTime: number;
  requestsPerSecond: number;
  endpointStats: Map<string, ConnectionStats>;
  timestamp: number;
}

export interface RPCConnection {
  id: string;
  endpoint: string;
  provider: ethers.providers.JsonRpcProvider | ethers.providers.WebSocketProvider;
  isActive: boolean;
  createdAt: number;
  lastUsed: number;
  requestCount: number;
  failureCount: number;
  totalResponseTime: number;
  isWebSocket: boolean;
}

export interface PendingRequest {
  id: string;
  method: string;
  params: any[];
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timestamp: number;
  timeout: NodeJS.Timeout;
  retries: number;
  preferredEndpoint?: string;
}

/**
 * Advanced RPC Connection Pool for BSC providers
 * Provides intelligent connection management, load balancing, and failover capabilities
 */
export class RPCConnectionPool extends EventEmitter {
  private config: RPCConnectionConfig;
  private connections: Map<string, RPCConnection> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private endpointStats: Map<string, ConnectionStats> = new Map();
  private loadBalancerIndex = 0;
  private metrics: ConnectionMetrics;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;

  constructor(config: Partial<RPCConnectionConfig> = {}) {
    super();

    this.config = {
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
      retryBackoffMultiplier: 2,
      loadBalancingStrategy: 'least-connections',
      failoverStrategy: 'circuit-breaker',
      circuitBreakerThreshold: 0.5,
      circuitBreakerTimeout: 60000,
      enableMetrics: true,
      websocketConfig: {
        reconnectInterval: 2000,
        maxReconnectAttempts: 5,
        pingInterval: 30000
      },
      ...config
    };

    this.metrics = {
      totalRequests: 0,
      totalFailures: 0,
      averageResponseTime: 0,
      requestsPerSecond: 0,
      endpointStats: new Map(),
      timestamp: Date.now()
    };

    this.initializeEndpointStats();
    this.startHealthChecks();
    this.startMetricsCollection();
  }

  /**
   * Initialize endpoint statistics
   */
  private initializeEndpointStats(): void {
    for (const endpoint of this.config.endpoints) {
      this.endpointStats.set(endpoint, {
        endpoint,
        activeConnections: 0,
        totalRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastUsed: 0,
        isHealthy: true,
        circuitBreakerState: 'closed',
        failureRate: 0
      });
    }
  }

  /**
   * Get or create a connection to an endpoint
   */
  private async getConnection(endpoint?: string): Promise<RPCConnection> {
    const targetEndpoint = endpoint || this.selectOptimalEndpoint();

    if (!targetEndpoint) {
      throw new Error('No healthy endpoints available');
    }

    const stats = this.endpointStats.get(targetEndpoint);
    if (!stats || stats.circuitBreakerState === 'open') {
      throw new Error(`Endpoint ${targetEndpoint} is not available`);
    }

    // Check if we can reuse an existing connection
    const existingConnection = this.findAvailableConnection(targetEndpoint);
    if (existingConnection) {
      return existingConnection;
    }

    // Create new connection if we haven't reached the limit
    if (stats.activeConnections < this.config.maxConnectionsPerEndpoint) {
      return await this.createConnection(targetEndpoint);
    }

    // Wait for an available connection or failover to another endpoint
    return await this.waitForAvailableConnection(targetEndpoint);
  }

  /**
   * Find an available connection for the endpoint
   */
  private findAvailableConnection(endpoint: string): RPCConnection | null {
    for (const connection of this.connections.values()) {
      if (connection.endpoint === endpoint && connection.isActive) {
        return connection;
      }
    }
    return null;
  }

  /**
   * Create a new connection to the specified endpoint
   */
  private async createConnection(endpoint: string): Promise<RPCConnection> {
    const connectionId = this.generateConnectionId();
    const isWebSocket = endpoint.startsWith('wss://') || endpoint.startsWith('ws://');

    try {
      const connectionTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), this.config.connectionTimeout);
      });

      const providerPromise = isWebSocket
        ? this.createWebSocketProvider(endpoint)
        : this.createHttpProvider(endpoint);

      const provider = await Promise.race([providerPromise, connectionTimeout]) as
        ethers.providers.JsonRpcProvider | ethers.providers.WebSocketProvider;

      const connection: RPCConnection = {
        id: connectionId,
        endpoint,
        provider,
        isActive: true,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        requestCount: 0,
        failureCount: 0,
        totalResponseTime: 0,
        isWebSocket
      };

      this.connections.set(connectionId, connection);

      const stats = this.endpointStats.get(endpoint);
      if (stats) {
        stats.activeConnections++;
        stats.isHealthy = true;
        stats.circuitBreakerState = 'closed';
      }

      this.emit('connectionCreated', { connectionId, endpoint });
      return connection;

    } catch (error) {
      this.handleConnectionFailure(endpoint, error as Error);
      throw error;
    }
  }

  /**
   * Create WebSocket provider
   */
  private createWebSocketProvider(endpoint: string): Promise<WebSocketProvider> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(endpoint);

      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error('WebSocket connection timeout'));
      }, this.config.connectionTimeout);

      ws.on('open', () => {
        clearTimeout(timeout);
        const provider = new WebSocketProvider(endpoint);
        resolve(provider);
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Create HTTP provider
   */
  private async createHttpProvider(endpoint: string): Promise<JsonRpcProvider> {
    return new JsonRpcProvider(endpoint, {
      name: 'bsc',
      chainId: 56
    });
  }

  /**
   * Wait for an available connection
   */
  private async waitForAvailableConnection(endpoint: string): Promise<RPCConnection> {
    const maxWaitTime = this.config.requestTimeout;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const connection = this.findAvailableConnection(endpoint);
      if (connection) {
        return connection;
      }

      // Try to find connection from another endpoint
      const alternativeEndpoint = this.selectOptimalEndpoint([endpoint]);
      if (alternativeEndpoint) {
        return await this.getConnection(alternativeEndpoint);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('No available connections within timeout period');
  }

  /**
   * Select optimal endpoint based on load balancing strategy
   */
  private selectOptimalEndpoint(excludeEndpoints?: string[]): string | null {
    const availableEndpoints = this.config.endpoints.filter(endpoint => {
      const stats = this.endpointStats.get(endpoint);
      return stats &&
             stats.isHealthy &&
             stats.circuitBreakerState !== 'open' &&
             !excludeEndpoints?.includes(endpoint);
    });

    if (availableEndpoints.length === 0) {
      return null;
    }

    switch (this.config.loadBalancingStrategy) {
      case 'round-robin':
        return this.selectRoundRobin(availableEndpoints);

      case 'weighted':
        return this.selectWeighted(availableEndpoints);

      case 'least-connections':
        return this.selectLeastConnections(availableEndpoints);

      default:
        return availableEndpoints[0];
    }
  }

  /**
   * Round-robin endpoint selection
   */
  private selectRoundRobin(endpoints: string[]): string {
    const endpoint = endpoints[this.loadBalancerIndex % endpoints.length];
    this.loadBalancerIndex++;
    return endpoint;
  }

  /**
   * Weighted endpoint selection based on performance
   */
  private selectWeighted(endpoints: string[]): string {
    const weights = endpoints.map(endpoint => {
      const stats = this.endpointStats.get(endpoint);
      if (!stats) return 0;

      // Calculate weight based on success rate and response time
      const successRate = 1 - stats.failureRate;
      const responseTimeWeight = Math.max(0, 1000 - stats.averageResponseTime) / 1000;
      return successRate * responseTimeWeight;
    });

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight === 0) {
      return endpoints[0];
    }

    const random = Math.random() * totalWeight;
    let cumulativeWeight = 0;

    for (let i = 0; i < endpoints.length; i++) {
      cumulativeWeight += weights[i];
      if (random <= cumulativeWeight) {
        return endpoints[i];
      }
    }

    return endpoints[0];
  }

  /**
   * Least connections endpoint selection
   */
  private selectLeastConnections(endpoints: string[]): string {
    return endpoints.reduce((best, current) => {
      const bestStats = this.endpointStats.get(best);
      const currentStats = this.endpointStats.get(current);

      if (!bestStats) return current;
      if (!currentStats) return best;

      return currentStats.activeConnections < bestStats.activeConnections ? current : best;
    });
  }

  /**
   * Execute RPC request with connection pooling
   */
  async request(method: string, params: any[] = [], options: {
    endpoint?: string;
    timeout?: number;
    retries?: number;
  } = {}): Promise<any> {
    const requestId = this.generateRequestId();
    const timeout = options.timeout || this.config.requestTimeout;
    const maxRetries = options.retries || this.config.maxRetries;

    return new Promise(async (resolve, reject) => {
      try {
        const connection = await this.getConnection(options.endpoint);
        const requestTimeout = setTimeout(() => {
          this.handleRequestTimeout(requestId);
        }, timeout);

        const pendingRequest: PendingRequest = {
          id: requestId,
          method,
          params,
          resolve,
          reject,
          timestamp: Date.now(),
          timeout: requestTimeout,
          retries: 0,
          preferredEndpoint: options.endpoint
        };

        this.pendingRequests.set(requestId, pendingRequest);
        this.metrics.totalRequests++;

        const startTime = Date.now();

        try {
          const result = await connection.provider.send(method, params);
          const responseTime = Date.now() - startTime;

          this.handleRequestSuccess(requestId, connection, responseTime, result);

        } catch (error) {
          const responseTime = Date.now() - startTime;
          this.handleRequestFailure(requestId, connection, responseTime, error as Error);
        }

      } catch (error) {
        this.metrics.totalFailures++;
        reject(error);
      }
    });
  }

  /**
   * Handle successful request
   */
  private handleRequestSuccess(requestId: string, connection: RPCConnection, responseTime: number, result: any): void {
    const request = this.pendingRequests.get(requestId);
    if (!request) return;

    clearTimeout(request.timeout);
    this.pendingRequests.delete(requestId);

    // Update connection stats
    connection.lastUsed = Date.now();
    connection.requestCount++;
    connection.totalResponseTime += responseTime;

    // Update endpoint stats
    const stats = this.endpointStats.get(connection.endpoint);
    if (stats) {
      stats.totalRequests++;
      stats.lastUsed = Date.now();
      stats.averageResponseTime = (stats.averageResponseTime + responseTime) / 2;
      stats.failureRate = stats.failedRequests / stats.totalRequests;
    }

    request.resolve(result);
    this.emit('requestSuccess', { requestId, connectionId: connection.id, responseTime, result });
  }

  /**
   * Handle failed request
   */
  private handleRequestFailure(requestId: string, connection: RPCConnection, responseTime: number, error: Error): void {
    const request = this.pendingRequests.get(requestId);
    if (!request) return;

    connection.failureCount++;
    connection.lastUsed = Date.now();

    const stats = this.endpointStats.get(connection.endpoint);
    if (stats) {
      stats.totalRequests++;
      stats.failedRequests++;
      stats.failureRate = stats.failedRequests / stats.totalRequests;

      // Update circuit breaker state
      if (stats.failureRate >= this.config.circuitBreakerThreshold) {
        stats.circuitBreakerState = 'open';
        this.scheduleCircuitBreakerReset(connection.endpoint);
      }
    }

    // Retry logic
    if (request.retries < this.config.maxRetries) {
      request.retries++;
      clearTimeout(request.timeout);

      const backoffDelay = this.config.retryBackoffMultiplier ** request.retries * 1000;

      setTimeout(async () => {
        try {
          const newConnection = await this.getConnection(request.preferredEndpoint);
          const startTime = Date.now();

          try {
            const result = await newConnection.provider.send(request.method, request.params);
            const retryResponseTime = Date.now() - startTime;
            this.handleRequestSuccess(requestId, newConnection, retryResponseTime, result);
          } catch (retryError) {
            const retryResponseTime = Date.now() - startTime;
            this.handleRequestFailure(requestId, newConnection, retryResponseTime, retryError as Error);
          }
        } catch (retryError) {
          this.handleRequestFailure(requestId, connection, responseTime, error);
        }
      }, backoffDelay);

      return;
    }

    // Max retries exceeded
    clearTimeout(request.timeout);
    this.pendingRequests.delete(requestId);
    this.metrics.totalFailures++;

    request.reject(error);
    this.emit('requestFailure', { requestId, connectionId: connection.id, error, retries: request.retries });
  }

  /**
   * Handle request timeout
   */
  private handleRequestTimeout(requestId: string): void {
    const request = this.pendingRequests.get(requestId);
    if (!request) return;

    this.pendingRequests.delete(requestId);
    this.metrics.totalFailures++;

    const timeoutError = new Error(`Request timeout after ${this.config.requestTimeout}ms`);
    request.reject(timeoutError);

    this.emit('requestTimeout', { requestId });
  }

  /**
   * Handle connection failure
   */
  private handleConnectionFailure(endpoint: string, error: Error): void {
    const stats = this.endpointStats.get(endpoint);
    if (stats) {
      stats.isHealthy = false;
      stats.failedRequests++;

      if (stats.totalRequests > 0) {
        stats.failureRate = stats.failedRequests / stats.totalRequests;
      }

      if (stats.failureRate >= this.config.circuitBreakerThreshold) {
        stats.circuitBreakerState = 'open';
        this.scheduleCircuitBreakerReset(endpoint);
      }
    }

    this.emit('connectionFailure', { endpoint, error });
  }

  /**
   * Schedule circuit breaker reset
   */
  private scheduleCircuitBreakerReset(endpoint: string): void {
    setTimeout(() => {
      const stats = this.endpointStats.get(endpoint);
      if (stats && stats.circuitBreakerState === 'open') {
        stats.circuitBreakerState = 'half-open';
        this.emit('circuitBreakerHalfOpen', { endpoint });
      }
    }, this.config.circuitBreakerTimeout);
  }

  /**
   * Start health check interval
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const endpoint of this.config.endpoints) {
        await this.checkEndpointHealth(endpoint);
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Check health of an endpoint
   */
  private async checkEndpointHealth(endpoint: string): Promise<void> {
    const stats = this.endpointStats.get(endpoint);
    if (!stats) return;

    try {
      const startTime = Date.now();
      const connection = await this.getConnection(endpoint);
      await connection.provider.send('eth_blockNumber', []);
      const responseTime = Date.now() - startTime;

      stats.isHealthy = true;
      stats.averageResponseTime = (stats.averageResponseTime + responseTime) / 2;

      if (stats.circuitBreakerState === 'half-open') {
        stats.circuitBreakerState = 'closed';
        this.emit('circuitBreakerClosed', { endpoint });
      }

    } catch (error) {
      stats.isHealthy = false;
      stats.failedRequests++;

      if (stats.totalRequests > 0) {
        stats.failureRate = stats.failedRequests / stats.totalRequests;
      }
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    if (!this.config.enableMetrics) return;

    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
    }, 1000);
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    const now = Date.now();
    const timeDiff = (now - this.metrics.timestamp) / 1000;

    this.metrics.requestsPerSecond = this.metrics.totalRequests / Math.max(timeDiff, 1);
    this.metrics.timestamp = now;
    this.metrics.endpointStats = new Map(this.endpointStats);
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  /**
   * Get endpoint statistics
   */
  getEndpointStats(): Map<string, ConnectionStats> {
    return new Map(this.endpointStats);
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Close all connections and cleanup resources
   */
  async shutdown(): Promise<void> {
    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Cancel pending requests
    for (const [requestId, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection pool shutdown'));
    }
    this.pendingRequests.clear();

    // Close all connections
    for (const connection of this.connections.values()) {
      try {
        if (connection.isWebSocket && 'destroy' in connection.provider) {
          (connection.provider as any).destroy();
        }
      } catch (error) {
        console.error('Error closing connection:', error);
      }
    }
    this.connections.clear();

    this.emit('shutdown');
    this.removeAllListeners();
  }

  /**
   * Get pool status and health information
   */
  getStatus(): {
    totalConnections: number;
    activeConnections: number;
    pendingRequests: number;
    healthyEndpoints: number;
    circuitBreakerOpenEndpoints: number;
    metrics: ConnectionMetrics;
  } {
    const totalConnections = this.connections.size;
    const activeConnections = Array.from(this.connections.values()).filter(c => c.isActive).length;
    const pendingRequests = this.pendingRequests.size;
    const healthyEndpoints = Array.from(this.endpointStats.values()).filter(s => s.isHealthy).length;
    const circuitBreakerOpenEndpoints = Array.from(this.endpointStats.values())
      .filter(s => s.circuitBreakerState === 'open').length;

    return {
      totalConnections,
      activeConnections,
      pendingRequests,
      healthyEndpoints,
      circuitBreakerOpenEndpoints,
      metrics: this.getMetrics()
    };
  }
}