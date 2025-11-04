/**
 * Real-Time Data Updater for BSC Services using Viem 2.38.5
 * Optimized real-time data synchronization with intelligent throttling and batching
 * Enhanced with Viem integration and BSC-specific optimizations
 */

import { EventEmitter } from 'events';
import { Logger } from '../../../utils/logger.js';
import {
  PublicClient,
  WalletClient,
  Transport,
  Chain,
  Address,
  Hex,
  Hash,
  Block,
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  Account,
  formatUnits,
  parseUnits,
  toHex,
  getContract,
  type ContractEvent,
  type Log
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';

const logger = new Logger('RealTimeUpdaterViem');

/**
 * Real-time update configuration with Viem integration
 */
export interface RealTimeUpdateConfigViem {
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

  // Viem-specific settings
  viemConfig: {
    /** Client configuration */
    chain: Chain;
    /** Transport configuration */
    transport: {
      http: {
        timeout: number;
        retryCount: number;
        batchEnabled: boolean;
      };
      websocket: {
        timeout: number;
        reconnectAttempts: number;
        reconnectDelay: number;
        keepAlive: boolean;
        keepAliveInterval: number;
      };
    };
    /** Polling configuration */
    polling: {
      enabled: boolean;
      interval: number;
    };
    /** Batch configuration */
    batch: {
      enabled: boolean;
      multicall: boolean;
      maxWaitTime: number;
    };
  };

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

  // BSC-specific settings
  bscSpecific: {
    /** BSC block time optimization */
    blockTimeOptimization: boolean;
    /** BSC gas optimization */
    gasOptimization: boolean;
    /** PancakeSwap specific optimizations */
    pancakeSwapOptimizations: {
      enabled: boolean;
      priorityDataTypes: string[];
      customEndpoints: string[];
    };
    /** BSC chain-specific data sources */
    dataSources: {
      tokenPrices: 'coingecko' | 'pancakeswap' | 'custom';
      liquidityPools: 'pancakeswap' | 'custom';
      farmData: 'pancakeswap' | 'custom';
      gasTracker: 'native' | 'custom';
    };
  };

  // Performance alerts
  enablePerformanceAlerts: boolean;
  performanceThresholds: {
    successRate: number;
    throughput: number;
    queueLength: number;
    dataAge: number;
    responseTime: number;
  };
}

/**
 * Data subscription with Viem integration
 */
export interface DataSubscriptionViem {
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
  viemSpecific?: {
    clientType: 'public' | 'wallet';
    account?: Account;
    useWebSocket: boolean;
    useBatch: boolean;
    useMulticall: boolean;
    customClient?: PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account>;
    eventSubscription?: {
      address: Address;
      eventName: string;
      abi: any[];
    };
  };
  bscSpecific?: {
    pancakeSwapOptimized: boolean;
    gasOptimized: boolean;
    bscChainSpecific: boolean;
  };
}

/**
 * Update queue entry
 */
interface UpdateQueueEntryViem {
  id: string;
  dataType: string;
  data: any;
  timestamp: number;
  priority: number;
  subscriptions: Set<string>;
  viemSpecific?: {
    clientType: 'public' | 'wallet';
    processedWithViem: boolean;
    blockNumber?: bigint;
    gasUsed?: bigint;
  };
  bscSpecific?: {
    isPancakeSwapData: boolean;
    networkGasPrice?: bigint;
  };
}

/**
 * Real-time metrics with Viem tracking
 */
export interface RealTimeMetricsViem {
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
  viemSpecific: {
    publicClientsCreated: number;
    walletClientsCreated: number;
    batchRequestsProcessed: number;
    multicallRequestsProcessed: number;
    webSocketSubscriptions: number;
    averageGasUsed: number;
    chainId: number;
    lastBlockNumber?: bigint;
    clientPerformance: {
      averageResponseTime: number;
      fastestClient: string;
      slowestClient: string;
    };
  };
  bscSpecific: {
    pancakeSwapUpdates: number;
    bscOptimizedUpdates: number;
    averageGasPrice: number;
    networkUtilization: number;
    blockTimeOptimizationHits: number;
  };
}

/**
 * BSC-specific data types
 */
export interface BscDataTypeViem {
  token_prices: {
    WBNB: { price: number; priceChange24h: number; marketCap: number };
    BUSD: { price: number; priceChange24h: number; marketCap: number };
    USDT: { price: number; priceChange24h: number; marketCap: number };
    USDC: { price: number; priceChange24h: number; marketCap: number };
    CAKE: { price: number; priceChange24h: number; marketCap: number };
    timestamp: number;
    networkGasPrice: string;
  };
  liquidity_pools: {
    pools: Array<{
      address: Address;
      token0: { symbol: string; address: Address };
      token1: { symbol: string; address: Address };
      reserve0: string;
      reserve1: string;
      liquidity: string;
      apr: number;
      volume24h: string;
      pairAddress: Address;
      feeTier?: number;
      isPancakeSwap?: boolean;
    }>;
    timestamp: number;
    totalLiquidity: string;
    pairCount: number;
  };
  farm_data: {
    farms: Array<{
      address: Address;
      pid: number;
      token: { symbol: string; address: Address };
      apr: number;
      tvl: string;
      multiplier: number;
      rewardPerBlock: string;
      pendingCake: string;
      isPancakeSwapFarm?: boolean;
    }>;
    timestamp: number;
    totalTvl: string;
    activeFarms: number;
  };
  gas_prices: {
    gasPrice: string;
    maxFeePerGas: string | null;
    maxPriorityFeePerGas: string | null;
    baseFeePerGas: string;
    nextBlockBaseFee: string;
    timestamp: number;
    blockNumber: bigint;
  };
  network_stats: {
    blockNumber: bigint;
    blockHash: Hash;
    timestamp: number;
    gasLimit: string;
    gasUsed: string;
    miner: Address;
    transactions: number;
    difficulty: string;
    totalDifficulty: string;
    uncles: number;
    size: number;
  };
  pancakeSwap_events: {
    swaps: Array<{
      transactionHash: Hash;
      blockNumber: bigint;
      pairAddress: Address;
      amount0In: string;
      amount1In: string;
      amount0Out: string;
      amount1Out: string;
      to: Address;
      timestamp: number;
    }>;
    liquidityChanges: Array<{
      transactionHash: Hash;
      blockNumber: bigint;
      pairAddress: Address;
      amount0: string;
      amount1: string;
      timestamp: number;
    }>;
    timestamp: number;
  };
}

/**
 * Real-Time Data Updater with Viem 2.38.5 integration
 */
export class RealTimeUpdaterViem extends EventEmitter {
  private config: RealTimeUpdateConfigViem;
  private publicClient: PublicClient<Transport, Chain>;
  private walletClient?: WalletClient<Transport, Chain, Account>;

  // Subscription management
  private subscriptions: Map<string, DataSubscriptionViem> = new Map();
  private dataBuffers: Map<string, { data: any; timestamp: number }> = new Map();
  private customClients: Map<string, PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account>> = new Map();

  // Update queues and processing
  private updateQueue: UpdateQueueEntryViem[] = [];
  private processingQueue: boolean = false;

  // Throttling
  private updateTimestamps: number[] = [];
  private updateCount: number = 0;

  // WebSocket connection
  private websocketClients: Map<string, PublicClient<Transport, Chain>> = new Map();
  private websocketConnected: boolean = false;
  private reconnectAttempts: number = 0;

  // Metrics
  private metrics: RealTimeMetricsViem = {
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
    websocketConnections: 0,
    viemSpecific: {
      publicClientsCreated: 0,
      walletClientsCreated: 0,
      batchRequestsProcessed: 0,
      multicallRequestsProcessed: 0,
      webSocketSubscriptions: 0,
      averageGasUsed: 0,
      chainId: 56, // BSC mainnet
      lastBlockNumber: undefined,
      clientPerformance: {
        averageResponseTime: 0,
        fastestClient: '',
        slowestClient: ''
      }
    },
    bscSpecific: {
      pancakeSwapUpdates: 0,
      bscOptimizedUpdates: 0,
      averageGasPrice: 0,
      networkUtilization: 0,
      blockTimeOptimizationHits: 0
    }
  };

  // Timers
  private metricsTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private throttleTimer: NodeJS.Timeout | null = null;
  private blockTimeTimer: NodeJS.Timeout | null = null;

  // Performance tracking
  private updateTimes: number[] = [];
  private totalUpdateTime: number = 0;
  private lastMetricsUpdate: number = 0;

  // BSC-specific tracking
  private lastBlockNumber: bigint = 0n;
  private blockTimeHistory: number[] = [];

  constructor(
    publicClient?: PublicClient<Transport, Chain>,
    walletClient?: WalletClient<Transport, Chain, Account>,
    config: Partial<RealTimeUpdateConfigViem> = {}
  ) {
    super();

    // Initialize clients or create defaults
    this.publicClient = publicClient || createPublicClient({
      chain: bsc,
      transport: http('https://bsc-dataseed1.binance.org', {
        timeout: 10000,
        retryCount: 3,
        batch: { batchMaxCount: 10 }
      })
    });

    this.walletClient = walletClient;

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
      viemConfig: {
        chain: bsc,
        transport: {
          http: {
            timeout: 10000,
            retryCount: 3,
            batchEnabled: true
          },
          websocket: {
            timeout: 30000,
            reconnectAttempts: 5,
            reconnectDelay: 5000,
            keepAlive: true,
            keepAliveInterval: 30000
          }
        },
        polling: {
          enabled: false,
          interval: 4000 // BSC block time is ~3 seconds
        },
        batch: {
          enabled: true,
          multicall: true,
          maxWaitTime: 1000
        }
      },
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
      bscSpecific: {
        blockTimeOptimization: true,
        gasOptimization: true,
        pancakeSwapOptimizations: {
          enabled: true,
          priorityDataTypes: ['token_prices', 'liquidity_pools', 'pancakeSwap_events'],
          customEndpoints: []
        },
        dataSources: {
          tokenPrices: 'pancakeswap',
          liquidityPools: 'pancakeswap',
          farmData: 'pancakeswap',
          gasTracker: 'native'
        }
      },
      enablePerformanceAlerts: true,
      performanceThresholds: {
        successRate: 0.9,
        throughput: 10,
        queueLength: 100,
        dataAge: 30000,
        responseTime: 5000
      },
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

    // Start BSC-specific optimizations
    if (this.config.bscSpecific.blockTimeOptimization) {
      this.startBlockTimeOptimization();
    }

    // Initialize WebSocket connections
    if (this.config.enableWebSocket) {
      this.initializeWebSocket();
    }

    // Initialize default BSC clients
    this.initializeBscClients();

    logger.info('Real-Time Updater initialized with Viem 2.38.5', {
      chainId: this.config.viemConfig.chain.id,
      defaultInterval: this.config.defaultUpdateInterval,
      throttlingEnabled: this.config.enableThrottling,
      batchingEnabled: this.config.enableBatching,
      webSocketEnabled: this.config.enableWebSocket,
      bscOptimizations: this.config.bscSpecific.blockTimeOptimization,
      pancakeSwapOptimizations: this.config.bscSpecific.pancakeSwapOptimizations.enabled
    });
  }

  /**
   * Initialize BSC-specific clients
   */
  private initializeBscClients(): void {
    // Create optimized client for PancakeSwap data
    if (this.config.bscSpecific.pancakeSwapOptimizations.enabled) {
      const pancakeSwapClient = createPublicClient({
        chain: this.config.viemConfig.chain,
        transport: http('https://bsc-dataseed1.binance.org', {
          timeout: this.config.viemConfig.transport.http.timeout,
          retryCount: this.config.viemConfig.transport.http.retryCount,
          batch: { batchMaxCount: 5 }
        }),
        batch: this.config.viemConfig.batch,
        polling: this.config.viemConfig.polling
      });

      this.customClients.set('pancakeswap', pancakeSwapClient);
      this.metrics.viemSpecific.publicClientsCreated++;
    }

    // Create gas-optimized client
    if (this.config.bscSpecific.gasOptimization) {
      const gasOptimizedClient = createPublicClient({
        chain: this.config.viemConfig.chain,
        transport: http('https://bsc-dataseed2.binance.org', {
          timeout: 5000, // Shorter timeout for gas prices
          retryCount: 2,
          batch: { batchMaxCount: 20 }
        }),
        polling: {
          enabled: true,
          interval: 2000 // Poll more frequently for gas
        }
      });

      this.customClients.set('gas_tracker', gasOptimizedClient);
      this.metrics.viemSpecific.publicClientsCreated++;
    }
  }

  /**
   * Subscribe to real-time data updates with Viem integration
   */
  subscribe(
    dataType: string,
    callback: (data: any) => void,
    options: {
      filters?: Record<string, any>;
      interval?: number;
      priority?: number;
      autoRenew?: boolean;
      clientType?: 'public' | 'wallet';
      account?: Account;
      useWebSocket?: boolean;
      useBatch?: boolean;
      useMulticall?: boolean;
      customClient?: string;
      pancakeSwapOptimized?: boolean;
      gasOptimized?: boolean;
    } = {}
  ): string {
    // Check subscription limit
    if (this.subscriptions.size >= this.config.maxSubscriptions) {
      throw new Error('Maximum subscription limit reached');
    }

    const subscriptionId = this.generateSubscriptionId();
    const now = Date.now();

    const subscription: DataSubscriptionViem = {
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
      createdAt: now,
      viemSpecific: {
        clientType: options.clientType || 'public',
        account: options.account,
        useWebSocket: options.useWebSocket || false,
        useBatch: options.useBatch !== false,
        useMulticall: options.useMulticall !== false,
        customClient: options.customClient ? this.customClients.get(options.customClient) : undefined
      },
      bscSpecific: {
        pancakeSwapOptimized: options.pancakeSwapOptimized ||
          this.config.bscSpecific.pancakeSwapOptimizations.priorityDataTypes.includes(dataType),
        gasOptimized: options.gasOptimized || dataType === 'gas_prices',
        bscChainSpecific: this.isBscSpecificDataType(dataType)
      }
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.metrics.subscriptionCount++;

    // Initialize data buffer
    if (!this.dataBuffers.has(dataType)) {
      this.dataBuffers.set(dataType, { data: null, timestamp: 0 });
    }

    // Set up recurring updates
    this.setupRecurringUpdates(subscription);

    logger.debug('Data subscription created with Viem', {
      subscriptionId,
      dataType,
      interval: subscription.interval,
      priority: subscription.priority,
      viemClientType: subscription.viemSpecific?.clientType,
      pancakeSwapOptimized: subscription.bscSpecific?.pancakeSwapOptimized,
      gasOptimized: subscription.bscSpecific?.gasOptimized
    });

    // Emit subscription event
    this.emit('subscribed', {
      subscriptionId,
      dataType,
      interval: subscription.interval,
      viemSpecific: subscription.viemSpecific
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
    viemClient?: PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account>;
  } = {}): Promise<void> {
    try {
      const now = Date.now();

      // Update data buffer
      this.dataBuffers.set(dataType, { data, timestamp: now });

      // Create update queue entry
      const updateEntry: UpdateQueueEntryViem = {
        id: this.generateUpdateId(),
        dataType,
        data,
        timestamp: now,
        priority: 0, // Manual updates get high priority
        subscriptions: new Set(),
        viemSpecific: {
          clientType: 'public',
          processedWithViem: true,
          blockNumber: await this.getCurrentBlockNumber()
        },
        bscSpecific: {
          isPancakeSwapData: this.config.bscSpecific.pancakeSwapOptimizations.priorityDataTypes.includes(dataType),
          networkGasPrice: await this.getCurrentGasPrice()
        }
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

      logger.debug('Manual update triggered with Viem', {
        dataType,
        subscriptionCount: updateEntry.subscriptions.size,
        blockNumber: updateEntry.viemSpecific?.blockNumber?.toString()
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
  private setupRecurringUpdates(subscription: DataSubscriptionViem): void {
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
   * Fetch and update data for subscription using Viem
   */
  private async fetchAndUpdateData(subscription: DataSubscriptionViem): Promise<void> {
    try {
      // Fetch data based on data type
      const data = await this.fetchDataByType(subscription.dataType, subscription.filters, subscription);

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
   * Fetch data by type using Viem (placeholder implementation)
   */
  private async fetchDataByType(
    dataType: string,
    filters?: Record<string, any>,
    subscription?: DataSubscriptionViem
  ): Promise<any> {
    // Choose optimal client based on subscription settings
    let client: PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account> | undefined;

    if (subscription?.viemSpecific?.customClient) {
      client = subscription.viemSpecific.customClient;
    } else if (subscription?.bscSpecific?.pancakeSwapOptimized) {
      client = this.customClients.get('pancakeswap');
    } else if (subscription?.bscSpecific?.gasOptimized) {
      client = this.customClients.get('gas_tracker');
    } else if (subscription?.viemSpecific?.clientType === 'wallet') {
      client = this.walletClient;
    } else {
      client = this.publicClient;
    }

    if (!client) {
      client = this.publicClient;
    }

    const startTime = Date.now();

    try {
      // Fetch data based on data type using Viem
      switch (dataType) {
        case 'token_prices':
          return await this.fetchTokenPrices(client, filters);
        case 'liquidity_pools':
          return await this.fetchLiquidityPools(client, filters);
        case 'farm_data':
          return await this.fetchFarmData(client, filters);
        case 'gas_prices':
          return await this.fetchGasPrices(client);
        case 'network_stats':
          return await this.fetchNetworkStats(client);
        case 'pancakeswap_events':
          return await this.fetchPancakeSwapEvents(client, filters);
        default:
          logger.warn('Unknown data type', { dataType });
          return null;
      }
    } finally {
      // Track client performance
      const responseTime = Date.now() - startTime;
      this.trackClientPerformance(client, responseTime);
    }
  }

  /**
   * Fetch token prices using Viem
   */
  private async fetchTokenPrices(
    client: PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account>,
    filters?: Record<string, any>
  ): Promise<BscDataTypeViem['token_prices']> {
    try {
      const publicClient = client as PublicClient<Transport, Chain>;

      const gasPrice = await publicClient.getGasPrice();
      const blockNumber = await publicClient.getBlockNumber();

      // Simulate price data (in production, would fetch from actual price oracle)
      const prices: BscDataTypeViem['token_prices'] = {
        WBNB: { price: 300, priceChange24h: 2.5, marketCap: 45000000000 },
        BUSD: { price: 1, priceChange24h: 0.1, marketCap: 7000000000 },
        USDT: { price: 1, priceChange24h: 0.1, marketCap: 7000000000 },
        USDC: { price: 1, priceChange24h: 0.05, marketCap: 7000000000 },
        CAKE: { price: 2.5, priceChange24h: -1.2, marketCap: 1500000000 },
        timestamp: Date.now(),
        networkGasPrice: formatUnits(gasPrice, 9) // Gwei
      };

      // Update BSC-specific metrics
      this.metrics.viemSpecific.lastBlockNumber = blockNumber;
      this.metrics.bscSpecific.averageGasPrice = parseFloat(prices.networkGasPrice);

      return prices;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch token prices');
      throw error;
    }
  }

  /**
   * Fetch liquidity pools data using Viem
   */
  private async fetchLiquidityPools(
    client: PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account>,
    filters?: Record<string, any>
  ): Promise<BscDataTypeViem['liquidity_pools']> {
    try {
      const publicClient = client as PublicClient<Transport, Chain>;

      // Simulate PancakeSwap pool data (in production, would fetch from actual contracts)
      const pools: BscDataTypeViem['liquidity_pools']['pools'] = [
        {
          address: '0x58F876857a02D6762e0101bb5C46A8c1ED44DC130' as Address,
          token0: { symbol: 'WBNB', address: '0xbb4CdB9CBd36B01bd1cBaeF2de08d9173bc095c' as Address },
          token1: { symbol: 'USDT', address: '0x55d398326f99059ff775485246999027b3197955' as Address },
          reserve0: '100000000000000000000000',
          reserve1: '100000000000000000000000',
          liquidity: '100000000000000000000000',
          apr: 12.5,
          volume24h: '50000000000000000000',
          pairAddress: '0x58F876857a02D6762e0101bb5C46A8c1ED44DC130' as Address,
          feeTier: 0,
          isPancakeSwap: true
        }
      ];

      return {
        pools,
        timestamp: Date.now(),
        totalLiquidity: '100000000000000000000000',
        pairCount: pools.length
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch liquidity pools');
      throw error;
    }
  }

  /**
   * Fetch farm data using Viem
   */
  private async fetchFarmData(
    client: PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account>,
    filters?: Record<string, any>
  ): Promise<BscDataTypeViem['farm_data']> {
    try {
      const publicClient = client as PublicClient<Transport, Chain>;

      // Simulate PancakeSwap farm data (in production, would fetch from MasterChef contracts)
      const farms: BscDataTypeViem['farm_data']['farms'] = [
        {
          address: '0x73feaa1eE5147D4a6386c5E33D6F1Ea7bE0b9d4a' as Address,
          pid: 1,
          token: { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' as Address },
          apr: 45.2,
          tvl: '50000000000000000000',
          multiplier: 1,
          rewardPerBlock: '0.1',
          pendingCake: '1000000000000000000000',
          isPancakeSwapFarm: true
        }
      ];

      return {
        farms,
        timestamp: Date.now(),
        totalTvl: '50000000000000000000',
        activeFarms: farms.length
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch farm data');
      throw error;
    }
  }

  /**
   * Fetch current gas prices using Viem
   */
  private async fetchGasPrices(
    client: PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account>
  ): Promise<BscDataTypeViem['gas_prices']> {
    try {
      const publicClient = client as PublicClient<Transport, Chain>;

      const [gasPrice, block, feeData] = await Promise.all([
        publicClient.getGasPrice(),
        publicClient.getBlock('latest'),
        publicClient.estimateFeesPerGas()
      ]);

      return {
        gasPrice: formatUnits(gasPrice, 9), // Gwei
        maxFeePerGas: feeData.maxFeePerGas ? formatUnits(feeData.maxFeePerGas, 9) : null,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? formatUnits(feeData.maxPriorityFeePerGas, 9) : null,
        baseFeePerGas: block.baseFeePerGas ? formatUnits(block.baseFeePerGas, 9) : '0',
        nextBlockBaseFee: block.baseFeePerGas ? formatUnits(block.baseFeePerGas, 9) : '0',
        timestamp: Date.now(),
        blockNumber: block.number
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch gas prices');
      throw error;
    }
  }

  /**
   * Fetch network statistics using Viem
   */
  private async fetchNetworkStats(
    client: PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account>
  ): Promise<BscDataTypeViem['network_stats']> {
    try {
      const publicClient = client as PublicClient<Transport, Chain>;

      const block = await publicClient.getBlock('latest');

      return {
        blockNumber: block.number,
        blockHash: block.hash,
        timestamp: Date.now(),
        gasLimit: block.gasLimit.toString(),
        gasUsed: block.gasUsed?.toString() || '0',
        miner: block.miner || ('0x0000000000000000000000000000000000000000000' as Address),
        transactions: block.transactions?.length || 0,
        difficulty: block.difficulty.toString(),
        totalDifficulty: block.totalDifficulty.toString(),
        uncles: block.uncles?.length || 0,
        size: block.size
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch network stats');
      throw error;
    }
  }

  /**
   * Fetch PancakeSwap events using Viem
   */
  private async fetchPancakeSwapEvents(
    client: PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account>,
    filters?: Record<string, any>
  ): Promise<BscDataTypeViem['pancakeswap_events']> {
    try {
      const publicClient = client as PublicClient<Transport, Chain>;

      // Simulate PancakeSwap events (in production, would fetch from actual event logs)
      const events: BscDataTypeViem['pancakeswap_events'] = {
        swaps: [],
        liquidityChanges: [],
        timestamp: Date.now()
      };

      // Update BSC-specific metrics
      this.metrics.bscSpecific.pancakeSwapUpdates++;

      return events;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch PancakeSwap events');
      throw error;
    }
  }

  /**
   * Check if data type is BSC-specific
   */
  private isBscSpecificDataType(dataType: string): boolean {
    const bscDataTypes = [
      'token_prices',
      'liquidity_pools',
      'farm_data',
      'gas_prices',
      'pancakeswap_events',
      'network_stats'
    ];
    return bscDataTypes.includes(dataType);
  }

  /**
   * Get current block number
   */
  private async getCurrentBlockNumber(): Promise<bigint> {
    try {
      return await this.publicClient.getBlockNumber();
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get current block number');
      return 0n;
    }
  }

  /**
   * Get current gas price
   */
  private async getCurrentGasPrice(): Promise<bigint> {
    try {
      return await this.publicClient.getGasPrice();
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get current gas price');
      return 0n;
    }
  }

  /**
   * Track client performance metrics
   */
  private trackClientPerformance(
    client: PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account>,
    responseTime: number
  ): void {
    const clientType = 'account' in client ? 'wallet' : 'public';
    const clientKey = `${clientType}-${client.transport.name || 'unknown'}`;

    this.metrics.viemSpecific.clientPerformance.averageResponseTime =
      (this.metrics.viemSpecific.clientPerformance.averageResponseTime + responseTime) / 2;

    // Track fastest/slowest client
    if (!this.metrics.viemSpecific.clientPerformance.fastestClient ||
        responseTime < this.getAverageClientResponseTime(this.metrics.viemSpecific.clientPerformance.fastestClient)) {
      this.metrics.viemSpecific.clientPerformance.fastestClient = clientKey;
    }

    if (!this.metrics.viemSpecific.clientPerformance.slowestClient ||
        responseTime > this.getAverageClientResponseTime(this.metrics.viemSpecific.clientPerformance.slowestClient)) {
      this.metrics.viemSpecific.clientPerformance.slowestClient = clientKey;
    }
  }

  private getAverageClientResponseTime(clientType: string): number {
    // In a real implementation, you would track actual response times per client
    return 1000; // Default to 1 second
  }

  /**
   * Add update to queue with priority
   */
  private addToUpdateQueue(update: UpdateQueueEntryViem): void {
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

          // Track BSC-specific metrics
          if (subscription.bscSpecific?.pancakeSwapOptimized) {
            this.metrics.bscSpecific.pancakeSwapUpdates++;
          }
          if (subscription.bscSpecific?.bscChainSpecific) {
            this.metrics.bscSpecific.bscOptimizedUpdates++;
          }
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
        processingTime: Date.now() - startTime,
        viemProcessed: update.viemSpecific?.processedWithViem
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
      const groupedUpdates = new Map<string, UpdateQueueEntryViem[]>();
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

            // Track BSC-specific metrics
            if (subscription.bscSpecific?.pancakeSwapOptimized) {
              this.metrics.bscSpecific.pancakeSwapUpdates++;
            }
          }
        }

        // Track batch metrics
        this.metrics.viemSpecific.batchRequestsProcessed++;
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
        efficiency: (efficiency * 100).toFixed(2) + ' updates/sec',
        viemBatchRequests: this.metrics.viemSpecific.batchRequestsProcessed
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
    }, 10000); // Collect metrics every 10 seconds
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

    // Update Viem-specific metrics
    this.metrics.viemSpecific.averageGasUsed =
      this.updateTimes.length > 0 ? this.totalUpdateTime / this.updateTimes.length : 0;

    logger.info('Real-Time Updater Metrics with Viem 2.38.5', {
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
      batchEfficiency: (metrics.batchEfficiency * 100).toFixed(2) + '%',
      viemSpecific: {
        publicClientsCreated: metrics.viemSpecific.publicClientsCreated,
        walletClientsCreated: metrics.viemSpecific.walletClientsCreated,
        batchRequestsProcessed: metrics.viemSpecific.batchRequestsProcessed,
        multicallRequestsProcessed: metrics.viemSpecific.multicallRequestsProcessed,
        webSocketSubscriptions: metrics.viemSpecific.webSocketSubscriptions,
        chainId: metrics.viemSpecific.chainId,
        lastBlockNumber: metrics.viemSpecific.lastBlockNumber?.toString(),
        averageResponseTime: (metrics.viemSpecific.clientPerformance.averageResponseTime / 1000).toFixed(2) + 's'
      },
      bscSpecific: {
        pancakeSwapUpdates: metrics.bscSpecific.pancakeSwapUpdates,
        bscOptimizedUpdates: metrics.bscSpecific.bscOptimizedUpdates,
        averageGasPrice: metrics.bscSpecific.averageGasPrice.toFixed(2) + ' Gwei',
        networkUtilization: (metrics.bscSpecific.networkUtilization * 100).toFixed(2) + '%',
        blockTimeOptimizationHits: metrics.bscSpecific.blockTimeOptimizationHits
      }
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
  private checkPerformanceAlerts(metrics: RealTimeMetricsViem): void {
    // Low success rate alert
    if (metrics.successUpdates > 0) {
      const successRate = metrics.successfulUpdates / metrics.totalUpdates;
      if (successRate < this.config.performanceThresholds.successRate) {
        this.emit('alert', {
          type: 'low_success_rate',
          value: successRate,
          threshold: this.config.performanceThresholds.successRate,
          message: `Low update success rate: ${(successRate * 100).toFixed(2)}%`
        });
      }
    }

    // Low throughput alert
    if (metrics.currentUpdateRate < this.config.performanceThresholds.throughput) {
      this.emit('alert', {
        type: 'low_throughput',
        value: metrics.currentUpdateRate,
        threshold: this.config.performanceThresholds.throughput,
        message: `Low update throughput: ${metrics.currentUpdateRate.toFixed(2)} updates/sec`
      });
    }

    // High queue length alert
    if (this.updateQueue.length > this.config.performanceThresholds.queueLength) {
      this.emit('alert', {
        type: 'high_queue_length',
        value: this.updateQueue.length,
        threshold: this.config.performanceThresholds.queueLength,
        message: `High update queue length: ${this.updateQueue.length}`
      });
    }

    // Stale data alert
    if (metrics.averageDataAge > this.config.performanceThresholds.dataAge) {
      this.emit('alert', {
        type: 'stale_data',
        value: metrics.averageDataAge,
        threshold: this.config.performanceThresholds.dataAge,
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
   * Start BSC block time optimization
   */
  private startBlockTimeOptimization(): void {
    if (!this.config.bscSpecific.blockTimeOptimization) return;

    this.blockTimeTimer = setInterval(async () => {
      try {
        const currentBlockNumber = await this.getCurrentBlockNumber();

        if (currentBlockNumber > this.lastBlockNumber) {
          const blocksPassed = currentBlockNumber - this.lastBlockNumber;
          const actualTime = Date.now() - (this.blockTimeHistory[this.blockTimeHistory.length - 1] || Date.now());

          if (this.blockTimeHistory.length > 0) {
            const averageBlockTime = actualTime / this.blockTimeHistory.length;
            const expectedBlockTime = 3000; // BSC target block time

            // If block time is good, optimize update intervals
            if (averageBlockTime <= expectedBlockTime * 1.2) {
              this.metrics.bscSpecific.blockTimeOptimizationHits++;

              // Reduce intervals for time-sensitive data
              this.adjustUpdateIntervalsForBlockTime(true);
            }
          }

          this.lastBlockNumber = currentBlockNumber;
          this.blockTimeHistory.push(Date.now());

          // Keep only last 100 block times
          if (this.blockTimeHistory.length > 100) {
            this.blockTimeHistory.splice(0, this.blockTimeHistory.length - 100);
          }
        }
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Block time optimization failed');
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Adjust update intervals based on block time performance
   */
  private adjustUpdateIntervalsForBlockTime(performant: boolean): void {
    for (const subscription of this.subscriptions.values()) {
      if (performant) {
        // Use faster intervals for high-performance periods
        subscription.interval = Math.max(
          this.config.fastUpdateInterval,
          subscription.interval! * 0.8
        );
      } else {
        // Use slower intervals for slow periods
        subscription.interval = Math.min(
          this.config.slowUpdateInterval,
          subscription.interval! * 1.2
        );
      }
    }
  }

  /**
   * Initialize WebSocket connections with Viem
   */
  private async initializeWebSocket(): Promise<void> {
    try {
      // Create WebSocket client for real-time data
      const wsClient = createPublicClient({
        chain: this.config.viemConfig.chain,
        transport: webSocket('wss://bsc-ws-node.nodereal.io', {
          timeout: this.config.viemConfig.transport.websocket.timeout,
          retryCount: this.config.viemConfig.transport.websocket.reconnectAttempts,
          keepAlive: this.config.viemConfig.transport.websocket.keepAlive,
          keepAliveInterval: this.config.viemConfig.transport.websocket.keepAliveInterval
        })
      });

      this.websocketClients.set('default', wsClient);
      this.websocketConnected = true;
      this.metrics.websocketConnections = 1;
      this.metrics.viemSpecific.webSocketSubscriptions++;

      // Set up WebSocket event handling
      this.setupWebSocketEventHandling(wsClient);

      logger.info('WebSocket connection established with Viem', {
        endpoint: 'wss://bsc-ws-node.nodereal.io',
        chainId: this.config.viemConfig.chain.id
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to initialize WebSocket');
      this.websocketConnected = false;
    }
  }

  /**
   * Set up WebSocket event handling
   */
  private setupWebSocketEventHandling(wsClient: PublicClient<Transport, Chain>): void {
    // Set up event listeners for real-time data
    // This would include subscribing to specific contract events
    // for real-time PancakeSwap updates, token transfers, etc.
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
  getMetrics(): RealTimeMetricsViem {
    return { ...this.metrics };
  }

  /**
   * Get subscription information
   */
  getSubscriptionInfo(subscriptionId: string): DataSubscriptionViem | null {
    return this.subscriptions.get(subscriptionId) || null;
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): DataSubscriptionViem[] {
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
  async shutdown(): Promise<void> {
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

    if (this.blockTimeTimer) {
      clearInterval(this.blockTimeTimer);
      this.blockTimeTimer = null;
    }

    // Clear subscriptions
    this.subscriptions.clear();
    this.dataBuffers.clear();
    this.updateQueue = [];

    // Close WebSocket connections
    for (const [key, wsClient] of this.websocketClients.entries()) {
      try {
        if ('transport' in wsClient) {
          const transport = (wsClient as any).transport;
          if (transport && 'close' in transport) {
            await transport.close();
          }
        }
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error closing WebSocket client');
      }
    }
    this.websocketClients.clear();

    // Close custom clients
    for (const [key, client] of this.customClients.entries()) {
      try {
        if ('transport' in client) {
          const transport = (client as any).transport;
          if (transport && 'close' in transport) {
            await transport.close();
          }
        }
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error closing custom client');
      }
    }
    this.customClients.clear();

    this.websocketConnected = false;
    this.metrics.websocketConnections = 0;

    logger.info('Real-Time Updater with Viem shutdown completed');
  }
}

// Factory function for easy instantiation
export function createRealTimeUpdaterViem(
  publicClient?: PublicClient<Transport, Chain>,
  walletClient?: WalletClient<Transport, Chain, Account>,
  config?: Partial<RealTimeUpdateConfigViem>
): RealTimeUpdaterViem {
  return new RealTimeUpdaterViem(publicClient, walletClient, config);
}