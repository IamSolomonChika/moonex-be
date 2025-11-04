import { EventEmitter } from 'events';
import {
  PublicClient,
  WalletClient,
  Transport,
  Chain,
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  fallback,
  type Account
} from 'viem';
import { mainnet, bsc, bscTestnet } from 'viem/chains';

export interface RPCConnectionConfigViem {
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
  loadBalancingStrategy: 'round-robin' | 'weighted' | 'least-connections' | 'viem-fallback';
  /** Failover strategy */
  failoverStrategy: 'immediate' | 'delayed' | 'circuit-breaker';
  /** Circuit breaker threshold (failure percentage) */
  circuitBreakerThreshold: number;
  /** Circuit breaker timeout in milliseconds */
  circuitBreakerTimeout: number;
  /** Enable connection metrics collection */
  enableMetrics: boolean;
  /** Viem client configuration */
  viemConfig: {
    /** Chain to use for clients */
    chain: Chain;
    /** Enable batch requests */
    batch: {
      enabled: boolean;
      multicall: boolean;
      maxWaitTime: number;
    };
    /** Polling configuration */
    polling: {
      enabled: boolean;
      interval: number;
    };
    /** WebSocket specific configuration */
    websocketConfig: {
      /** Reconnect interval in milliseconds */
      reconnectInterval: number;
      /** Maximum reconnection attempts */
      maxReconnectAttempts: number;
      /** Ping interval in milliseconds */
      pingInterval: number;
    };
  };
}

export interface ConnectionStatsViem {
  endpoint: string;
  activeConnections: number;
  totalRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastUsed: number;
  isHealthy: boolean;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  failureRate: number;
  viemSpecific: {
    clientType: 'public' | 'wallet';
    supportsWebSocket: boolean;
    supportsBatch: boolean;
    supportsMulticall: boolean;
    lastBlockNumber?: bigint;
  };
}

export interface ConnectionMetricsViem {
  totalRequests: number;
  totalFailures: number;
  averageResponseTime: number;
  requestsPerSecond: number;
  endpointStats: Map<string, ConnectionStatsViem>;
  timestamp: number;
  viemSpecific: {
    totalClientsCreated: number;
    fallbackUtilization: number;
    batchRequestSuccess: number;
    multicallRequests: number;
    chainId: number;
  };
}

export interface RPCConnectionViem {
  id: string;
  endpoint: string;
  client: PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account>;
  clientType: 'public' | 'wallet';
  isActive: boolean;
  createdAt: number;
  lastUsed: number;
  requestCount: number;
  failureCount: number;
  totalResponseTime: number;
  isWebSocket: boolean;
  supportsBatch: boolean;
  supportsMulticall: boolean;
}

export interface PendingRequestViem {
  id: string;
  method: string;
  params: any[];
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timestamp: number;
  timeout: NodeJS.Timeout;
  retries: number;
  preferredEndpoint?: string;
  clientType?: 'public' | 'wallet';
  useBatch?: boolean;
  useMulticall?: boolean;
}

export interface BscSpecificConfig {
  /** BSC-specific endpoints */
  bscMainnetEndpoints: string[];
  bscTestnetEndpoints: string[];
  /** PancakeSwap specific optimizations */
  pancakeSwapOptimizations: {
    /** Enable PancakeSwap specific RPC endpoints */
    enabled: boolean;
    /** Custom PancakeSwap endpoints */
    endpoints: string[];
    /** Prioritize PancakeSwap calls */
    prioritizeCalls: boolean;
  };
  /** BSC-specific performance settings */
  bscPerformanceSettings: {
    /** Optimize for BSC block time */
    blockTimeOptimization: boolean;
    /** BSC gas optimization */
    gasOptimization: boolean;
    /** Cache BSC-specific data */
    enableCaching: boolean;
  };
}

/**
 * Advanced RPC Connection Pool for BSC providers using Viem 2.38.5
 * Provides intelligent connection management, load balancing, and failover capabilities
 * with full Viem integration and BSC-specific optimizations
 */
export class RPCConnectionPoolViem extends EventEmitter {
  private config: RPCConnectionConfigViem;
  private bscConfig: BscSpecificConfig;
  private connections: Map<string, RPCConnectionViem> = new Map();
  private pendingRequests: Map<string, PendingRequestViem> = new Map();
  private endpointStats: Map<string, ConnectionStatsViem> = new Map();
  private loadBalancerIndex = 0;
  private metrics: ConnectionMetricsViem;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private fallbackClient?: PublicClient<Transport, Chain>;
  private cachedClients: Map<string, PublicClient<Transport, Chain>> = new Map();

  constructor(config: Partial<RPCConnectionConfigViem> = {}, bscConfig: Partial<BscSpecificConfig> = {}) {
    super();

    // Default configuration with BSC endpoints
    this.config = {
      endpoints: [
        'https://bsc-dataseed1.binance.org',
        'https://bsc-dataseed2.binance.org',
        'https://bsc-dataseed3.binance.org',
        'https://bsc-dataseed4.binance.org',
        'https://bsc-rpc.publicnode.com',
        'https://bsc-dataseed1.defibit.io',
        'https://bsc-dataseed1.ninicoin.io'
      ],
      maxConnectionsPerEndpoint: 5,
      connectionTimeout: 5000,
      healthCheckInterval: 30000,
      requestTimeout: 10000,
      maxRetries: 3,
      retryBackoffMultiplier: 2,
      loadBalancingStrategy: 'viem-fallback',
      failoverStrategy: 'circuit-breaker',
      circuitBreakerThreshold: 0.5,
      circuitBreakerTimeout: 60000,
      enableMetrics: true,
      viemConfig: {
        chain: bsc, // Default to BSC mainnet
        batch: {
          enabled: true,
          multicall: true,
          maxWaitTime: 1000
        },
        polling: {
          enabled: false,
          interval: 4000 // BSC block time is ~3 seconds
        },
        websocketConfig: {
          reconnectInterval: 2000,
          maxReconnectAttempts: 5,
          pingInterval: 30000
        }
      },
      ...config
    };

    // BSC-specific configuration
    this.bscConfig = {
      bscMainnetEndpoints: [
        'https://bsc-dataseed1.binance.org',
        'https://bsc-dataseed2.binance.org',
        'https://bsc-dataseed3.binance.org',
        'https://bsc-dataseed4.binance.org'
      ],
      bscTestnetEndpoints: [
        'https://data-seed-prebsc-1-s1.binance.org:8545',
        'https://data-seed-prebsc-2-s1.binance.org:8545',
        'https://data-seed-prebsc-1-s2.binance.org:8545'
      ],
      pancakeSwapOptimizations: {
        enabled: true,
        endpoints: [
          'https://bsc-dataseed1.binance.org', // Primary for PancakeSwap
          'https://bsc-dataseed2.binance.org'
        ],
        prioritizeCalls: true
      },
      bscPerformanceSettings: {
        blockTimeOptimization: true,
        gasOptimization: true,
        enableCaching: true
      },
      ...bscConfig
    };

    this.metrics = {
      totalRequests: 0,
      totalFailures: 0,
      averageResponseTime: 0,
      requestsPerSecond: 0,
      endpointStats: new Map(),
      timestamp: Date.now(),
      viemSpecific: {
        totalClientsCreated: 0,
        fallbackUtilization: 0,
        batchRequestSuccess: 0,
        multicallRequests: 0,
        chainId: this.config.viemConfig.chain.id
      }
    };

    this.initializeEndpointStats();
    this.initializeViemFallback();
    this.startHealthChecks();
    this.startMetricsCollection();
  }

  /**
   * Initialize endpoint statistics with Viem-specific data
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
        failureRate: 0,
        viemSpecific: {
          clientType: 'public',
          supportsWebSocket: endpoint.startsWith('wss://') || endpoint.startsWith('ws://'),
          supportsBatch: true,
          supportsMulticall: true
        }
      });
    }
  }

  /**
   * Initialize Viem fallback client for high availability
   */
  private initializeViemFallback(): void {
    if (this.config.loadBalancingStrategy === 'viem-fallback') {
      const transports = this.config.endpoints.map(endpoint => {
        const isWebSocket = endpoint.startsWith('wss://') || endpoint.startsWith('ws://');
        return isWebSocket ? webSocket(endpoint) : http(endpoint, {
          timeout: this.config.connectionTimeout,
          retryCount: this.config.maxRetries
        });
      });

      this.fallbackClient = createPublicClient({
        chain: this.config.viemConfig.chain,
        transport: fallback(transports, {
          rank: false // Use custom ranking logic
        }),
        batch: this.config.viemConfig.batch,
        polling: this.config.viemConfig.polling
      });

      this.metrics.viemSpecific.totalClientsCreated++;
    }
  }

  /**
   * Get or create a Viem client for an endpoint
   */
  private async getConnection(
    endpoint?: string,
    clientType: 'public' | 'wallet' = 'public',
    account?: Account
  ): Promise<RPCConnectionViem> {
    const targetEndpoint = endpoint || this.selectOptimalEndpoint();

    if (!targetEndpoint) {
      throw new Error('No healthy endpoints available');
    }

    const stats = this.endpointStats.get(targetEndpoint);
    if (!stats || stats.circuitBreakerState === 'open') {
      throw new Error(`Endpoint ${targetEndpoint} is not available`);
    }

    // Create cache key for client reuse
    const cacheKey = `${targetEndpoint}-${clientType}`;

    // For public clients, try to reuse cached client
    if (clientType === 'public' && this.cachedClients.has(cacheKey)) {
      const cachedClient = this.cachedClients.get(cacheKey)!;
      const connectionId = this.generateConnectionId();

      const connection: RPCConnectionViem = {
        id: connectionId,
        endpoint: targetEndpoint,
        client: cachedClient,
        clientType,
        isActive: true,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        requestCount: 0,
        failureCount: 0,
        totalResponseTime: 0,
        isWebSocket: targetEndpoint.startsWith('wss://') || targetEndpoint.startsWith('ws://'),
        supportsBatch: true,
        supportsMulticall: true
      };

      return connection;
    }

    // Check connection limits
    if (stats.activeConnections >= this.config.maxConnectionsPerEndpoint) {
      return await this.waitForAvailableConnection(targetEndpoint, clientType, account);
    }

    // Create new client
    return await this.createConnection(targetEndpoint, clientType, account);
  }

  /**
   * Create a new Viem client connection
   */
  private async createConnection(
    endpoint: string,
    clientType: 'public' | 'wallet' = 'public',
    account?: Account
  ): Promise<RPCConnectionViem> {
    const connectionId = this.generateConnectionId();
    const isWebSocket = endpoint.startsWith('wss://') || endpoint.startsWith('ws://');

    try {
      const connectionTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), this.config.connectionTimeout);
      });

      const clientPromise = isWebSocket
        ? this.createWebSocketClient(endpoint, clientType, account)
        : this.createHttpClient(endpoint, clientType, account);

      const client = await Promise.race([clientPromise, connectionTimeout]);

      const connection: RPCConnectionViem = {
        id: connectionId,
        endpoint,
        client,
        clientType,
        isActive: true,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        requestCount: 0,
        failureCount: 0,
        totalResponseTime: 0,
        isWebSocket,
        supportsBatch: this.config.viemConfig.batch.enabled,
        supportsMulticall: this.config.viemConfig.batch.multicall
      };

      // Cache public clients for reuse
      if (clientType === 'public') {
        const cacheKey = `${endpoint}-${clientType}`;
        this.cachedClients.set(cacheKey, client as PublicClient<Transport, Chain>);
      }

      // Update stats
      const stats = this.endpointStats.get(endpoint);
      if (stats) {
        stats.activeConnections++;
        stats.isHealthy = true;
        stats.circuitBreakerState = 'closed';
        stats.viemSpecific.clientType = clientType;
      }

      this.metrics.viemSpecific.totalClientsCreated++;
      this.emit('connectionCreated', { connectionId, endpoint, clientType });
      return connection;

    } catch (error) {
      this.handleConnectionFailure(endpoint, error as Error);
      throw error;
    }
  }

  /**
   * Create WebSocket client using Viem
   */
  private async createWebSocketClient(
    endpoint: string,
    clientType: 'public' | 'wallet',
    account?: Account
  ): Promise<PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account>> {
    const wsTransport = webSocket(endpoint, {
      retryCount: this.config.maxRetries,
      timeout: this.config.connectionTimeout,
      keepAlive: this.config.viemConfig.websocketConfig.pingInterval
    });

    if (clientType === 'public') {
      return createPublicClient({
        chain: this.config.viemConfig.chain,
        transport: wsTransport,
        batch: this.config.viemConfig.batch,
        polling: this.config.viemConfig.polling
      });
    } else {
      if (!account) {
        throw new Error('Account is required for wallet client');
      }

      return createWalletClient({
        account,
        chain: this.config.viemConfig.chain,
        transport: wsTransport,
        polling: this.config.viemConfig.polling
      });
    }
  }

  /**
   * Create HTTP client using Viem
   */
  private async createHttpClient(
    endpoint: string,
    clientType: 'public' | 'wallet',
    account?: Account
  ): Promise<PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account>> {
    const httpTransport = http(endpoint, {
      timeout: this.config.connectionTimeout,
      retryCount: this.config.maxRetries,
      batch: this.config.viemConfig.batch.enabled
    });

    if (clientType === 'public') {
      return createPublicClient({
        chain: this.config.viemConfig.chain,
        transport: httpTransport,
        batch: this.config.viemConfig.batch,
        polling: this.config.viemConfig.polling
      });
    } else {
      if (!account) {
        throw new Error('Account is required for wallet client');
      }

      return createWalletClient({
        account,
        chain: this.config.viemConfig.chain,
        transport: httpTransport,
        polling: this.config.viemConfig.polling
      });
    }
  }

  /**
   * Wait for an available connection
   */
  private async waitForAvailableConnection(
    endpoint: string,
    clientType: 'public' | 'wallet',
    account?: Account
  ): Promise<RPCConnectionViem> {
    const maxWaitTime = this.config.requestTimeout;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const stats = this.endpointStats.get(endpoint);
      if (stats && stats.activeConnections < this.config.maxConnectionsPerEndpoint) {
        return await this.createConnection(endpoint, clientType, account);
      }

      // Try alternative endpoint
      const alternativeEndpoint = this.selectOptimalEndpoint([endpoint]);
      if (alternativeEndpoint) {
        return await this.getConnection(alternativeEndpoint, clientType, account);
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

    // BSC-specific endpoint prioritization
    if (this.bscConfig.pancakeSwapOptimizations.enabled) {
      const pancakeEndpoint = this.selectPancakeSwapOptimalEndpoint(availableEndpoints);
      if (pancakeEndpoint) {
        return pancakeEndpoint;
      }
    }

    switch (this.config.loadBalancingStrategy) {
      case 'round-robin':
        return this.selectRoundRobin(availableEndpoints);

      case 'weighted':
        return this.selectWeighted(availableEndpoints);

      case 'least-connections':
        return this.selectLeastConnections(availableEndpoints);

      case 'viem-fallback':
        return this.selectViemOptimal(availableEndpoints);

      default:
        return availableEndpoints[0];
    }
  }

  /**
   * Select optimal endpoint for PancakeSwap operations
   */
  private selectPancakeSwapOptimalEndpoint(endpoints: string[]): string | null {
    const pancakeEndpoints = this.bscConfig.pancakeSwapOptimizations.endpoints.filter(
      endpoint => endpoints.includes(endpoint)
    );

    if (pancakeEndpoints.length === 0) {
      return null;
    }

    // Select the PancakeSwap endpoint with best performance
    return pancakeEndpoints.reduce((best, current) => {
      const bestStats = this.endpointStats.get(best);
      const currentStats = this.endpointStats.get(current);

      if (!bestStats) return current;
      if (!currentStats) return best;

      return currentStats.averageResponseTime < bestStats.averageResponseTime ? current : best;
    });
  }

  /**
   * Viem-specific optimal endpoint selection
   */
  private selectViemOptimal(endpoints: string[]): string {
    // Prioritize endpoints that support Viem features best
    const weights = endpoints.map(endpoint => {
      const stats = this.endpointStats.get(endpoint);
      if (!stats) return 0;

      let weight = 1;

      // Prioritize lower response time
      weight *= Math.max(0, 1000 - stats.averageResponseTime) / 1000;

      // Prioritize higher success rate
      weight *= (1 - stats.failureRate);

      // Prioritize WebSocket for real-time features
      if (stats.viemSpecific.supportsWebSocket) {
        weight *= 1.2;
      }

      // Prioritize batch/multicall support
      if (stats.viemSpecific.supportsBatch && stats.viemSpecific.supportsMulticall) {
        weight *= 1.1;
      }

      return weight;
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
   * Execute RPC request with Viem connection pooling
   */
  async request<T = any>(
    method: string,
    params: any[] = [],
    options: {
      endpoint?: string;
      timeout?: number;
      retries?: number;
      clientType?: 'public' | 'wallet';
      account?: Account;
      useBatch?: boolean;
      useMulticall?: boolean;
      pancakeSwapOptimized?: boolean;
    } = {}
  ): Promise<T> {
    const requestId = this.generateRequestId();
    const timeout = options.timeout || this.config.requestTimeout;
    const maxRetries = options.retries || this.config.maxRetries;
    const clientType = options.clientType || 'public';

    return new Promise(async (resolve, reject) => {
      try {
        // Use PancakeSwap optimized endpoint if requested
        const targetEndpoint = options.pancakeSwapOptimized && this.bscConfig.pancakeSwapOptimizations.enabled
          ? this.selectPancakeSwapOptimalEndpoint(this.config.endpoints) || options.endpoint
          : options.endpoint;

        const connection = await this.getConnection(targetEndpoint, clientType, options.account);
        const requestTimeout = setTimeout(() => {
          this.handleRequestTimeout(requestId);
        }, timeout);

        const pendingRequest: PendingRequestViem = {
          id: requestId,
          method,
          params,
          resolve,
          reject,
          timestamp: Date.now(),
          timeout: requestTimeout,
          retries: 0,
          preferredEndpoint: targetEndpoint,
          clientType,
          useBatch: options.useBatch,
          useMulticall: options.useMulticall
        };

        this.pendingRequests.set(requestId, pendingRequest);
        this.metrics.totalRequests++;

        const startTime = Date.now();

        try {
          let result: any;

          // Use Viem client methods
          if (clientType === 'public') {
            const publicClient = connection.client as PublicClient<Transport, Chain>;

            switch (method) {
              case 'eth_blockNumber':
                result = await publicClient.getBlockNumber();
                break;
              case 'eth_getBalance':
                result = await publicClient.getBalance({
                  address: params[0] as `0x${string}`,
                  blockTag: params[1] || 'latest'
                });
                break;
              case 'eth_call':
                result = await publicClient.call({
                  to: params[0].to,
                  data: params[0].data,
                  value: params[0].value,
                  from: params[0].from,
                  gas: params[0].gas,
                  gasPrice: params[0].gasPrice
                });
                break;
              case 'eth_estimateGas':
                result = await publicClient.estimateGas({
                  to: params[0].to,
                  data: params[0].data,
                  value: params[0].value,
                  from: params[0].from
                });
                break;
              case 'eth_gasPrice':
                result = await publicClient.getGasPrice();
                break;
              case 'eth_getTransactionCount':
                result = await publicClient.getTransactionCount({
                  address: params[0] as `0x${string}`,
                  blockTag: params[1] || 'latest'
                });
                break;
              case 'eth_getCode':
                result = await publicClient.getCode({
                  address: params[0] as `0x${string}`,
                  blockTag: params[1] || 'latest'
                });
                break;
              default:
                // Fallback to raw provider method for unsupported calls
                result = await (publicClient as any).transport.request({
                  method,
                  params
                });
            }
          } else {
            // Wallet client - use raw provider method
            const walletClient = connection.client as WalletClient<Transport, Chain, Account>;
            result = await (walletClient as any).transport.request({
              method,
              params
            });
          }

          const responseTime = Date.now() - startTime;

          // Track Viem-specific metrics
          if (options.useBatch) {
            this.metrics.viemSpecific.batchRequestSuccess++;
          }
          if (options.useMulticall) {
            this.metrics.viemSpecific.multicallRequests++;
          }

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
  private handleRequestSuccess(requestId: string, connection: RPCConnectionViem, responseTime: number, result: any): void {
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
      stats.viemSpecific.lastBlockNumber = typeof result === 'bigint' ? result : undefined;
    }

    request.resolve(result);
    this.emit('requestSuccess', {
      requestId,
      connectionId: connection.id,
      responseTime,
      result,
      clientType: connection.clientType
    });
  }

  /**
   * Handle failed request
   */
  private handleRequestFailure(requestId: string, connection: RPCConnectionViem, responseTime: number, error: Error): void {
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
          const newConnection = await this.getConnection(request.preferredEndpoint, request.clientType);
          const startTime = Date.now();

          try {
            let result: any;

            if (request.clientType === 'public') {
              const publicClient = newConnection.client as PublicClient<Transport, Chain>;

              // Retry with Viem methods
              switch (request.method) {
                case 'eth_blockNumber':
                  result = await publicClient.getBlockNumber();
                  break;
                default:
                  result = await (publicClient as any).transport.request({
                    method: request.method,
                    params: request.params
                  });
              }
            } else {
              const walletClient = newConnection.client as WalletClient<Transport, Chain, Account>;
              result = await (walletClient as any).transport.request({
                method: request.method,
                params: request.params
              });
            }

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
    this.emit('requestFailure', {
      requestId,
      connectionId: connection.id,
      error,
      retries: request.retries,
      clientType: connection.clientType
    });
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
      const publicClient = connection.client as PublicClient<Transport, Chain>;

      // Use Viem method for health check
      await publicClient.getBlockNumber();

      const responseTime = Date.now() - startTime;

      stats.isHealthy = true;
      stats.averageResponseTime = (stats.averageResponseTime + responseTime) / 2;
      stats.viemSpecific.lastBlockNumber = await publicClient.getBlockNumber();

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

    // Update Viem-specific metrics
    if (this.fallbackClient) {
      this.metrics.viemSpecific.fallbackUtilization =
        this.metrics.totalFailures / Math.max(this.metrics.totalRequests, 1);
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): ConnectionMetricsViem {
    return { ...this.metrics };
  }

  /**
   * Get endpoint statistics
   */
  getEndpointStats(): Map<string, ConnectionStatsViem> {
    return new Map(this.endpointStats);
  }

  /**
   * Get Viem fallback client
   */
  getFallbackClient(): PublicClient<Transport, Chain> | undefined {
    return this.fallbackClient;
  }

  /**
   * Create optimized client for specific use case
   */
  createOptimizedClient(options: {
    clientType: 'public' | 'wallet';
    useBatch?: boolean;
    useMulticall?: boolean;
    pancakeSwapOptimized?: boolean;
    account?: Account;
  }): PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account> {
    const endpoint = options.pancakeSwapOptimized && this.bscConfig.pancakeSwapOptimizations.enabled
      ? this.selectPancakeSwapOptimalEndpoint(this.config.endpoints) || this.config.endpoints[0]
      : this.config.endpoints[0];

    const isWebSocket = endpoint.startsWith('wss://') || endpoint.startsWith('ws://');
    const transport = isWebSocket ? webSocket(endpoint) : http(endpoint);

    if (options.clientType === 'public') {
      return createPublicClient({
        chain: this.config.viemConfig.chain,
        transport,
        batch: options.useBatch ? this.config.viemConfig.batch : false,
        multicall: options.useMulticall
      });
    } else {
      if (!options.account) {
        throw new Error('Account is required for wallet client');
      }

      return createWalletClient({
        account: options.account,
        chain: this.config.viemConfig.chain,
        transport,
        polling: this.config.viemConfig.polling
      });
    }
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

    // Clear cached clients
    this.cachedClients.clear();

    // Close all connections
    for (const connection of this.connections.values()) {
      try {
        if (connection.client && 'transport' in connection.client) {
          const transport = (connection.client as any).transport;
          if (transport && 'close' in transport) {
            await transport.close();
          }
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
    viemSpecific: {
      cachedClients: number;
      fallbackClientAvailable: boolean;
      batchEnabled: boolean;
      multicallEnabled: boolean;
      chainId: number;
    };
    metrics: ConnectionMetricsViem;
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
      viemSpecific: {
        cachedClients: this.cachedClients.size,
        fallbackClientAvailable: !!this.fallbackClient,
        batchEnabled: this.config.viemConfig.batch.enabled,
        multicallEnabled: this.config.viemConfig.batch.multicall,
        chainId: this.config.viemConfig.chain.id
      },
      metrics: this.getMetrics()
    };
  }
}

// Factory function for easy instantiation
export function createRPCConnectionPoolViem(
  config?: Partial<RPCConnectionConfigViem>,
  bscConfig?: Partial<BscSpecificConfig>
): RPCConnectionPoolViem {
  return new RPCConnectionPoolViem(config, bscConfig);
}