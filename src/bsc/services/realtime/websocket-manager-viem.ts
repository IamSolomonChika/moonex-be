/**
 * BSC WebSocket Manager - Viem Integration
 * Advanced WebSocket connection management for real-time BSC data using Viem 2.38.5
 */

import {
  Account,
  Address,
  Chain,
  PublicClient,
  Transport,
  WalletClient,
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  parseAbi,
  decodeEventLog,
  getContract,
  getEventSelector,
  Hex,
  Log,
  Block,
  Transaction,
  TransactionReceipt
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { EventEmitter } from 'events';
import logger from '../../../utils/logger.js';

/**
 * WebSocket connection configuration for Viem
 */
export interface WebSocketConfigViem {
  // Connection settings
  wsUrl: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  connectionTimeout: number;

  // Heartbeat settings
  heartbeatInterval: number;
  heartbeatTimeout: number;

  // Subscription settings
  maxSubscriptions: number;
  subscriptionTimeout: number;

  // Performance settings
  enableBatching: boolean;
  batchSize: number;
  batchInterval: number;

  // Error handling
  enableErrorRecovery: boolean;
  maxErrorCount: number;
  errorCooldown: number;
}

/**
 * Subscription configuration
 */
export interface SubscriptionConfig {
  id: string;
  type: 'logs' | 'newBlocks' | 'newPendingTransactions' | 'contractEvents';
  filters?: {
    address?: Address | Address[];
    topics?: Hex[] | Hex[][];
    fromBlock?: bigint | 'latest' | 'earliest';
    toBlock?: bigint | 'latest' | 'earliest';
  };
  abi?: any[];
  eventName?: string;
  callback: (data: any) => void | Promise<void>;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

/**
 * WebSocket connection status
 */
export interface WebSocketStatus {
  connected: boolean;
  url: string;
  connectedAt?: number;
  lastHeartbeat?: number;
  reconnectCount: number;
  subscriptions: number;
  errorCount: number;
  lastError?: string;
  viemClientReady: boolean;
}

/**
 * BSC-specific WebSocket configuration
 */
interface BscWebSocketConfig {
  chainId: number;
  blockTime: number;
  defaultWsUrls: string[];
  pancakeSwapContracts: {
    router: Address;
    factory: Address;
    masterChef: Address;
    pair: Address;
  };
  knownEvents: Record<string, string>;
}

/**
 * Advanced WebSocket Manager with Viem 2.38.5 Integration
 */
export class WebSocketManagerViem extends EventEmitter {
  private config: WebSocketConfigViem;
  private bscConfig: BscWebSocketConfig;

  // Client management
  private publicClient: PublicClient<Transport, Chain> | null = null;
  private wsClient: PublicClient<WebSocketTransport, Chain> | null = null;

  // Connection management
  private isConnected = false;
  private reconnectAttempts = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatTimeoutTimer: NodeJS.Timeout | null = null;
  private errorCooldownTimer: NodeJS.Timeout | null = null;

  // Subscription management
  private subscriptions = new Map<string, SubscriptionConfig>();
  private activeSubscriptions = new Map<string, any>(); // Viem subscription handles
  private subscriptionQueue: SubscriptionConfig[] = [];

  // Performance tracking
  private metrics = {
    totalMessages: 0,
    totalErrors: 0,
    averageLatency: 0,
    connectionUptime: 0,
    subscriptionCount: 0,
    messageRate: 0,
    reconnectCount: 0
  };

  // Batching
  private messageQueue: any[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(
    config: Partial<WebSocketConfigViem> = {},
    bscConfig?: Partial<BscWebSocketConfig>,
    publicClient?: PublicClient<Transport, Chain>
  ) {
    super();

    this.publicClient = publicClient || null;

    this.bscConfig = {
      chainId: bsc?.id || 56,
      blockTime: 3000, // 3 seconds for BSC
      defaultWsUrls: [
        'wss://bsc-ws-node.nariox.org:443',
        'wss://bsc-dataseed1.binance.org:443',
        'wss://bsc-dataseed2.binance.org:443',
        'wss://bsc-dataseed3.binance.org:443',
        'wss://bsc-dataseed4.binance.org:443'
      ],
      pancakeSwapContracts: {
        router: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
        factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
        masterChef: '0x73feaa1eE314F8c655E354234017bE2193C9E24E',
        pair: '0xa527a61703d82139f8a06bc30097cc9caa2df8428'
      },
      knownEvents: {
        '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822': 'Transfer',
        '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1': 'Swap',
        '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c1f': 'Sync',
        '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8a7f3e4be': 'Approval',
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef': 'Transfer'
      },
      ...bscConfig
    };

    this.config = {
      wsUrl: this.bscConfig.defaultWsUrls[0],
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      connectionTimeout: 10000,
      heartbeatInterval: 30000,
      heartbeatTimeout: 5000,
      maxSubscriptions: 100,
      subscriptionTimeout: 10000,
      enableBatching: true,
      batchSize: 50,
      batchInterval: 1000,
      enableErrorRecovery: true,
      maxErrorCount: 5,
      errorCooldown: 30000,
      ...config
    };

    this.initializeWebSocket();
  }

  /**
   * Initialize WebSocket connection
   */
  private async initializeWebSocket(): Promise<void> {
    try {
      logger.info('Initializing WebSocket connection', {
        url: this.config.wsUrl,
        enableBatching: this.config.enableBatching
      });

      // Create WebSocket client with Viem
      this.wsClient = createPublicClient({
        chain: this.bscConfig.chainId === 56 ? bsc : bscTestnet,
        transport: webSocket(this.config.wsUrl, {
          retryCount: this.config.maxReconnectAttempts,
          timeout: this.config.connectionTimeout,
        }),
        batch: {
          multicall: true,
        },
        pollingInterval: this.bscConfig.blockTime,
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Connect to WebSocket
      await this.connect();

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        url: this.config.wsUrl
      }, 'Failed to initialize WebSocket connection');

      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Connect to WebSocket
   */
  private async connect(): Promise<void> {
    try {
      logger.info('Connecting to WebSocket', { url: this.config.wsUrl });

      // Test connection by getting latest block
      const block = await this.wsClient!.getBlock();

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.metrics.connectionUptime = Date.now();

      // Start heartbeat
      this.startHeartbeat();

      // Process queued subscriptions
      await this.processSubscriptionQueue();

      this.emit('connected', {
        url: this.config.wsUrl,
        blockNumber: block.number,
        timestamp: block.timestamp
      });

      logger.info('WebSocket connected successfully', {
        url: this.config.wsUrl,
        blockNumber: block.number.toString(),
        subscriptions: this.subscriptions.size
      });

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'WebSocket connection failed');

      this.isConnected = false;
      this.emit('error', error);

      // Attempt reconnection
      this.scheduleReconnect();
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.wsClient) return;

    // Note: Viem WebSocket client uses different event handling patterns
    // We'll use the client's built-in methods for subscriptions

    // Handle WebSocket errors
    this.wsClient.transport.on('error', (error: Error) => {
      this.handleWebSocketError(error);
    });

    // Handle WebSocket close
    this.wsClient.transport.on('close', () => {
      this.handleWebSocketClose();
    });

    // Handle WebSocket open
    this.wsClient.transport.on('open', () => {
      this.handleWebSocketOpen();
    });
  }

  /**
   * Handle WebSocket errors
   */
  private handleWebSocketError(error: Error): void {
    this.metrics.totalErrors++;

    logger.error({
      error: error.message,
      stack: error.stack,
      url: this.config.wsUrl,
      errorCount: this.metrics.totalErrors
    }, 'WebSocket error occurred');

    this.emit('error', error);

    // Check if we should initiate recovery
    if (this.config.enableErrorRecovery && this.metrics.totalErrors >= this.config.maxErrorCount) {
      this.initiateErrorRecovery();
    }
  }

  /**
   * Handle WebSocket close
   */
  private handleWebSocketClose(): void {
    this.isConnected = false;

    logger.warn('WebSocket connection closed', {
      url: this.config.wsUrl,
      subscriptions: this.subscriptions.size,
      uptime: Date.now() - this.metrics.connectionUptime
    });

    this.emit('disconnected');

    // Clear active subscriptions
    this.clearActiveSubscriptions();

    // Attempt reconnection
    this.scheduleReconnect();
  }

  /**
   * Handle WebSocket open
   */
  private handleWebSocketOpen(): void {
    logger.info('WebSocket connection opened', { url: this.config.wsUrl });
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    // Clear existing timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
    }

    // Start heartbeat interval
    this.heartbeatTimer = setInterval(async () => {
      try {
        if (!this.isConnected || !this.wsClient) return;

        const start = Date.now();
        await this.wsClient.getBlockNumber();
        const latency = Date.now() - start;

        // Update metrics
        this.metrics.averageLatency = (this.metrics.averageLatency + latency) / 2;
        this.metrics.lastHeartbeat = Date.now();

        logger.debug('WebSocket heartbeat successful', { latency });

        // Clear heartbeat timeout
        if (this.heartbeatTimeoutTimer) {
          clearTimeout(this.heartbeatTimeoutTimer);
          this.heartbeatTimeoutTimer = null;
        }

      } catch (error) {
        logger.error({
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'WebSocket heartbeat failed');

        // Handle heartbeat failure
        this.handleHeartbeatFailure();
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Handle heartbeat failure
   */
  private handleHeartbeatFailure(): void {
    logger.warn('WebSocket heartbeat failed, connection may be unstable');

    // Set heartbeat timeout to check if connection recovers
    this.heartbeatTimeoutTimer = setTimeout(() => {
      logger.error('WebSocket heartbeat timeout, forcing reconnection');
      this.forceReconnect();
    }, this.config.heartbeatTimeout);
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached, stopping reconnection');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    const delay = this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    this.metrics.reconnectCount++;

    logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}`, {
      delay,
      url: this.config.wsUrl
    });

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Force immediate reconnection
   */
  private forceReconnect(): void {
    logger.info('Forcing WebSocket reconnection');

    // Clear current connection
    this.isConnected = false;
    this.clearActiveSubscriptions();

    // Reset reconnect attempts for immediate reconnection
    this.reconnectAttempts = 0;

    // Attempt reconnection immediately
    this.connect();
  }

  /**
   * Initiate error recovery
   */
  private initiateErrorRecovery(): void {
    logger.warn('Initiating WebSocket error recovery', {
      errorCount: this.metrics.totalErrors,
      maxErrors: this.config.maxErrorCount,
      cooldown: this.config.errorCooldown
    });

    // Temporarily stop subscriptions
    this.clearActiveSubscriptions();

    // Set error cooldown
    if (this.errorCooldownTimer) {
      clearTimeout(this.errorCooldownTimer);
    }

    this.errorCooldownTimer = setTimeout(() => {
      logger.info('Error recovery cooldown ended, resuming operations');
      this.metrics.totalErrors = 0; // Reset error count

      // Attempt reconnection
      this.forceReconnect();
    }, this.config.errorCooldown);
  }

  /**
   * Add subscription
   */
  addSubscription(config: SubscriptionConfig): string {
    if (this.subscriptions.size >= this.config.maxSubscriptions) {
      throw new Error(`Maximum subscription limit reached: ${this.config.maxSubscriptions}`);
    }

    if (this.subscriptions.has(config.id)) {
      throw new Error(`Subscription with ID '${config.id}' already exists`);
    }

    this.subscriptions.set(config.id, { ...config, enabled: config.enabled !== false });

    if (this.isConnected && config.enabled !== false) {
      this.subscribeToEvent(config);
    }

    logger.debug('Subscription added', {
      id: config.id,
      type: config.type,
      enabled: config.enabled
    });

    return config.id;
  }

  /**
   * Remove subscription
   */
  removeSubscription(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    // Unsubscribe from active subscription
    const activeSubscription = this.activeSubscriptions.get(subscriptionId);
    if (activeSubscription) {
      this.unsubscribeFromEvent(subscriptionId, activeSubscription);
    }

    this.subscriptions.delete(subscriptionId);

    logger.debug('Subscription removed', {
      id: subscriptionId,
      type: subscription.type
    });

    return true;
  }

  /**
   * Subscribe to specific event type
   */
  private async subscribeToEvent(config: SubscriptionConfig): Promise<void> {
    if (!this.wsClient || !this.isConnected) {
      // Queue subscription for when connection is ready
      this.subscriptionQueue.push(config);
      return;
    }

    try {
      let subscription: any;

      switch (config.type) {
        case 'newBlocks':
          subscription = this.wsClient.watchBlock({
            onBlock: (block) => this.handleBlockData(block, config),
            onError: (error) => this.handleSubscriptionError(config.id, error)
          });
          break;

        case 'newPendingTransactions':
          subscription = this.wsClient.watchPendingTransactions({
            onTransactions: (transactions) => this.handlePendingTransactions(transactions, config),
            onError: (error) => this.handleSubscriptionError(config.id, error)
          });
          break;

        case 'logs':
          subscription = this.wsClient.watchEvent({
            address: config.filters?.address,
            events: config.eventName ? [config.eventName] : undefined,
            fromBlock: config.filters?.fromBlock,
            toBlock: config.filters?.toBlock,
            onLogs: (logs) => this.handleLogData(logs, config),
            onError: (error) => this.handleSubscriptionError(config.id, error)
          });
          break;

        case 'contractEvents':
          if (config.abi && config.eventName) {
            subscription = this.wsClient.watchContractEvent({
              address: config.filters?.address,
              abi: config.abi,
              eventName: config.eventName,
              fromBlock: config.filters?.fromBlock,
              toBlock: config.filters?.toBlock,
              onLogs: (logs) => this.handleContractEventData(logs, config),
              onError: (error) => this.handleSubscriptionError(config.id, error)
            });
          } else {
            throw new Error('Contract events subscription requires ABI and eventName');
          }
          break;

        default:
          throw new Error(`Unsupported subscription type: ${config.type}`);
      }

      this.activeSubscriptions.set(config.id, subscription);
      this.metrics.subscriptionCount++;

      logger.info('Subscription activated', {
        id: config.id,
        type: config.type,
        eventName: config.eventName
      });

      this.emit('subscriptionAdded', { id: config.id, type: config.type });

    } catch (error) {
      logger.error({
        subscriptionId: config.id,
        type: config.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to subscribe to event');

      if (config.onError) {
        config.onError(error instanceof Error ? error : new Error('Unknown error'));
      }

      throw error;
    }
  }

  /**
   * Unsubscribe from event
   */
  private async unsubscribeFromEvent(subscriptionId: string, subscription: any): Promise<void> {
    try {
      // Viem subscriptions are usually unwatched by calling the unwatch function
      // The exact method depends on the subscription type
      if (subscription && typeof subscription.unwatch === 'function') {
        await subscription.unwatch();
      }

      this.activeSubscriptions.delete(subscriptionId);
      this.metrics.subscriptionCount--;

      logger.debug('Subscription deactivated', { id: subscriptionId });

      this.emit('subscriptionRemoved', { id: subscriptionId });

    } catch (error) {
      logger.error({
        subscriptionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to unsubscribe from event');
    }
  }

  /**
   * Process subscription queue
   */
  private async processSubscriptionQueue(): Promise<void> {
    if (this.subscriptionQueue.length === 0) return;

    logger.info(`Processing ${this.subscriptionQueue.length} queued subscriptions`);

    const queue = [...this.subscriptionQueue];
    this.subscriptionQueue = [];

    for (const config of queue) {
      if (config.enabled !== false) {
        try {
          await this.subscribeToEvent(config);
        } catch (error) {
          logger.error({
            subscriptionId: config.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Failed to process queued subscription');
        }
      }
    }
  }

  /**
   * Clear all active subscriptions
   */
  private clearActiveSubscriptions(): void {
    for (const [subscriptionId, subscription] of this.activeSubscriptions.entries()) {
      this.unsubscribeFromEvent(subscriptionId, subscription).catch(error => {
        logger.error({
          subscriptionId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'Error clearing active subscription');
      });
    }

    this.activeSubscriptions.clear();
    this.metrics.subscriptionCount = 0;
  }

  /**
   * Handle block data
   */
  private handleBlockData(block: Block, config: SubscriptionConfig): void {
    try {
      const data = {
        type: 'block',
        block,
        timestamp: Date.now(),
        subscriptionId: config.id
      };

      if (this.config.enableBatching) {
        this.addToBatch(data);
      } else {
        this.processSubscriptionData(data, config);
      }

      this.metrics.totalMessages++;

    } catch (error) {
      logger.error({
        subscriptionId: config.id,
        blockNumber: block.number.toString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Error handling block data');

      this.handleSubscriptionError(config.id, error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * Handle pending transactions
   */
  private handlePendingTransactions(transactions: Transaction[], config: SubscriptionConfig): void {
    try {
      const data = {
        type: 'pendingTransactions',
        transactions,
        count: transactions.length,
        timestamp: Date.now(),
        subscriptionId: config.id
      };

      if (this.config.enableBatching) {
        this.addToBatch(data);
      } else {
        this.processSubscriptionData(data, config);
      }

      this.metrics.totalMessages += transactions.length;

    } catch (error) {
      logger.error({
        subscriptionId: config.id,
        transactionCount: transactions.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Error handling pending transactions');

      this.handleSubscriptionError(config.id, error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * Handle log data
   */
  private handleLogData(logs: Log[], config: SubscriptionConfig): void {
    try {
      // Enhanced log parsing with BSC-specific optimizations
      const parsedLogs = logs.map(log => this.parseLog(log));

      const data = {
        type: 'logs',
        logs: parsedLogs,
        count: logs.length,
        timestamp: Date.now(),
        subscriptionId: config.id
      };

      if (this.config.enableBatching) {
        this.addToBatch(data);
      } else {
        this.processSubscriptionData(data, config);
      }

      this.metrics.totalMessages += logs.length;

    } catch (error) {
      logger.error({
        subscriptionId: config.id,
        logCount: logs.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Error handling log data');

      this.handleSubscriptionError(config.id, error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * Handle contract event data
   */
  private handleContractEventData(logs: Log[], config: SubscriptionConfig): void {
    try {
      // Decode contract events using provided ABI
      const decodedLogs = logs.map(log => this.decodeContractEvent(log, config.abi!, config.eventName!));

      const data = {
        type: 'contractEvents',
        eventName: config.eventName,
        logs: decodedLogs,
        count: logs.length,
        timestamp: Date.now(),
        subscriptionId: config.id
      };

      if (this.config.enableBatching) {
        this.addToBatch(data);
      } else {
        this.processSubscriptionData(data, config);
      }

      this.metrics.totalMessages += logs.length;

    } catch (error) {
      logger.error({
        subscriptionId: config.id,
        eventName: config.eventName,
        logCount: logs.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Error handling contract event data');

      this.handleSubscriptionError(config.id, error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * Parse log with BSC-specific optimizations
   */
  private parseLog(log: Log): any {
    const parsedLog: any = {
      ...log,
      timestamp: Date.now()
    };

    // Try to identify known BSC events
    if (log.topics && log.topics.length > 0) {
      const eventSignature = log.topics[0];
      const knownEventName = this.bscConfig.knownEvents[eventSignature];

      if (knownEventName) {
        parsedLog.eventName = knownEventName;
        parsedLog.isKnownEvent = true;
      }

      // Check if it's a PancakeSwap event
      const pancakeSwapAddresses = Object.values(this.bscConfig.pancakeSwapContracts);
      if (pancakeSwapAddresses.includes(log.address.toLowerCase() as Address)) {
        parsedLog.isPancakeSwapEvent = true;
        parsedLog.pancakeSwapContract = Object.keys(this.bscConfig.pancakeSwapContracts).find(
          key => this.bscConfig.pancakeSwapContracts[key as keyof typeof this.bscConfig.pancakeSwapContracts].toLowerCase() === log.address.toLowerCase()
        );
      }
    }

    return parsedLog;
  }

  /**
   * Decode contract event using ABI
   */
  private decodeContractEvent(log: Log, abi: any[], eventName: string): any {
    try {
      // Create contract instance for event decoding
      const contract = getContract({
        address: log.address,
        abi,
        client: this.publicClient || this.wsClient!
      });

      // Use Viem's decodeEventLog if available, or manual decoding
      if (contract.events && contract.events[eventName]) {
        return {
          ...log,
          eventName,
          args: contract.events[eventName].decode(log)
        };
      }

      // Fallback to manual parsing
      return {
        ...log,
        eventName,
        args: this.parseEventData(log.data, log.topics)
      };

    } catch (error) {
      logger.error({
        logAddress: log.address,
        eventName,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to decode contract event');

      return {
        ...log,
        eventName,
        args: {},
        decodeError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Parse event data (fallback method)
   */
  private parseEventData(data: Hex, topics: Hex[]): Record<string, any> {
    const args: Record<string, any> = {};

    // Simple parsing for common event patterns
    if (topics.length > 1) {
      for (let i = 1; i < topics.length; i++) {
        args[`topic${i}`] = topics[i];
      }
    }

    if (data && data !== '0x') {
      args.data = data;
    }

    return args;
  }

  /**
   * Handle subscription error
   */
  private handleSubscriptionError(subscriptionId: string, error: Error): void {
    logger.error({
      subscriptionId,
      error: error.message
    }, 'Subscription error occurred');

    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription && subscription.onError) {
      subscription.onError(error);
    }

    this.emit('subscriptionError', { subscriptionId, error });
  }

  /**
   * Add data to batch
   */
  private addToBatch(data: any): void {
    this.messageQueue.push(data);

    if (this.messageQueue.length >= this.config.batchSize) {
      this.processBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.config.batchInterval);
    }
  }

  /**
   * Process batched messages
   */
  private processBatch(): void {
    if (this.messageQueue.length === 0) return;

    const batch = [...this.messageQueue];
    this.messageQueue = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    logger.debug('Processing batched messages', { count: batch.length });

    // Process each message in the batch
    for (const data of batch) {
      const config = this.subscriptions.get(data.subscriptionId);
      if (config) {
        this.processSubscriptionData(data, config);
      }
    }

    // Update message rate metrics
    this.metrics.messageRate = batch.length / (this.config.batchInterval / 1000);
  }

  /**
   * Process subscription data
   */
  private async processSubscriptionData(data: any, config: SubscriptionConfig): Promise<void> {
    try {
      await config.callback(data);
    } catch (error) {
      logger.error({
        subscriptionId: config.id,
        dataType: data.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Error in subscription callback');

      if (config.onError) {
        config.onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    }
  }

  /**
   * Get WebSocket status
   */
  getStatus(): WebSocketStatus {
    return {
      connected: this.isConnected,
      url: this.config.wsUrl,
      connectedAt: this.metrics.connectionUptime,
      lastHeartbeat: this.metrics.lastHeartbeat,
      reconnectCount: this.metrics.reconnectCount,
      subscriptions: this.subscriptions.size,
      errorCount: this.metrics.totalErrors,
      lastError: undefined, // Could track last error if needed
      viemClientReady: this.wsClient !== null
    };
  }

  /**
   * Get metrics
   */
  getMetrics(): typeof this.metrics & {
    bscSpecific: {
      knownEventsCount: number;
      pancakeSwapSubscriptions: number;
      chainId: number;
    };
  } {
    const pancakeSwapSubscriptions = Array.from(this.subscriptions.values()).filter(sub => {
      return sub.filters?.address && (
        Object.values(this.bscConfig.pancakeSwapContracts).includes(sub.filters.address as Address) ||
        (Array.isArray(sub.filters.address) && sub.filters.address.some(addr =>
          Object.values(this.bscConfig.pancakeSwapContracts).includes(addr as Address)
        ))
      );
    }).length;

    return {
      ...this.metrics,
      bscSpecific: {
        knownEventsCount: Object.keys(this.bscConfig.knownEvents).length,
        pancakeSwapSubscriptions,
        chainId: this.bscConfig.chainId
      }
    };
  }

  /**
   * Enable/disable subscription
   */
  setSubscriptionEnabled(subscriptionId: string, enabled: boolean): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    const wasEnabled = subscription.enabled;
    subscription.enabled = enabled;

    if (enabled && !wasEnabled && this.isConnected) {
      this.subscribeToEvent(subscription);
    } else if (!enabled && wasEnabled) {
      const activeSubscription = this.activeSubscriptions.get(subscriptionId);
      if (activeSubscription) {
        this.unsubscribeFromEvent(subscriptionId, activeSubscription);
      }
    }

    return true;
  }

  /**
   * Update subscription configuration
   */
  updateSubscription(subscriptionId: string, updates: Partial<SubscriptionConfig>): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    // Update subscription
    Object.assign(subscription, updates);

    // If subscription is active and connected, re-subscribe with new config
    if (subscription.enabled !== false && this.isConnected) {
      const activeSubscription = this.activeSubscriptions.get(subscriptionId);
      if (activeSubscription) {
        this.unsubscribeFromEvent(subscriptionId, activeSubscription);
      }
      this.subscribeToEvent(subscription);
    }

    return true;
  }

  /**
   * Get all subscriptions
   */
  getSubscriptions(): Array<SubscriptionConfig & { id: string }> {
    return Array.from(this.subscriptions.entries()).map(([id, config]) => ({
      id,
      ...config
    }));
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected || !this.wsClient) {
        return false;
      }

      // Test connection
      await this.wsClient.getBlockNumber();

      // Check heartbeat
      const now = Date.now();
      const heartbeatAge = this.metrics.lastHeartbeat ? now - this.metrics.lastHeartbeat : Infinity;
      const isHeartbeatHealthy = heartbeatAge < (this.config.heartbeatInterval + this.config.heartbeatTimeout);

      return isHeartbeatHealthy;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'WebSocket health check failed');
      return false;
    }
  }

  /**
   * Disconnect WebSocket
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting WebSocket');

    // Clear timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.errorCooldownTimer) {
      clearTimeout(this.errorCooldownTimer);
      this.errorCooldownTimer = null;
    }

    // Clear subscriptions
    this.clearActiveSubscriptions();

    // Close WebSocket connection
    this.isConnected = false;

    // Clear client
    this.wsClient = null;

    this.emit('disconnected');

    logger.info('WebSocket disconnected successfully');
  }

  /**
   * Shutdown WebSocket manager
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket manager');

    await this.disconnect();

    // Clear all data
    this.subscriptions.clear();
    this.subscriptionQueue = [];
    this.messageQueue = [];

    // Reset metrics
    this.metrics = {
      totalMessages: 0,
      totalErrors: 0,
      averageLatency: 0,
      connectionUptime: 0,
      subscriptionCount: 0,
      messageRate: 0,
      reconnectCount: 0
    };

    this.emit('shutdown');

    logger.info('WebSocket manager shutdown completed');
  }
}

// Export singleton factory
export function createWebSocketManagerViem(
  config?: Partial<WebSocketConfigViem>,
  bscConfig?: Partial<BscWebSocketConfig>,
  publicClient?: PublicClient<Transport, Chain>
): WebSocketManagerViem {
  return new WebSocketManagerViem(config, bscConfig, publicClient);
}

// Export default instance
export const webSocketManagerViem = createWebSocketManagerViem();