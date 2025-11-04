/**
 * BSC Real-time Data Streamer - Viem Integration
 * Advanced real-time data streaming with Viem 2.38.5 and WebSocket integration
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
  formatEther,
  formatUnits,
  Hex,
  Log,
  Block,
  Transaction,
  TransactionReceipt,
  Abi,
  AbiEvent,
  AbiParameter,
  WatchEventReturnType
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { EventEmitter } from 'events';
import logger from '../../../utils/logger.js';
import { WebSocketManagerViem, SubscriptionConfig } from './websocket-manager-viem.js';

/**
 * Data stream configuration
 */
export interface DataStreamConfig {
  // Stream settings
  streamName: string;
  bufferSize: number;
  bufferTimeout: number;
  enableCompression: boolean;
  enableEncryption: boolean;

  // Performance settings
  enableBatching: boolean;
  batchSize: number;
  batchTimeout: number;
  enableDeduplication: boolean;
  deduplicationWindow: number;

  // Reliability settings
  enablePersistence: boolean;
  persistencePath?: string;
  enableReplay: boolean;
  maxRetries: number;
  retryDelay: number;

  // Quality settings
  enableDataValidation: boolean;
  validationSchema?: any;
  enableRateLimiting: boolean;
  maxMessagesPerSecond: number;
}

/**
 * Stream data types
 */
export enum StreamDataType {
  BLOCK = 'block',
  TRANSACTION = 'transaction',
  LOG = 'log',
  CONTRACT_EVENT = 'contract_event',
  PRICE_UPDATE = 'price_update',
  BALANCE_UPDATE = 'balance_update',
  TOKEN_TRANSFER = 'token_transfer',
  SWAP_EVENT = 'swap_event',
  LIQUIDITY_EVENT = 'liquidity_event',
  CUSTOM = 'custom'
}

/**
 * Streamed data item
 */
export interface StreamedData {
  id: string;
  type: StreamDataType;
  timestamp: number;
  blockNumber?: bigint;
  transactionHash?: Address;
  data: any;
  metadata?: Record<string, any>;
  source?: string;
  validated?: boolean;
  retryCount?: number;
}

/**
 * Stream buffer item
 */
interface StreamBufferItem {
  data: StreamedData;
  timestamp: number;
  processed: boolean;
}

/**
 * Data validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  cleaned?: any;
}

/**
 * BSC-specific data configuration
 */
interface BscStreamConfig {
  chainId: number;
  blockTime: number;
  supportedTokens: {
    [symbol: string]: {
      address: Address;
      decimals: number;
      symbol: string;
    };
  };
  pancakeSwapConfig: {
    factory: Address;
    router: Address;
    masterChef: Address;
    pools: Address[];
  };
  dexConfigs: {
    [name: string]: {
      factory: Address;
      router: Address;
      quoteToken: Address;
    };
  };
}

/**
 * Advanced Real-time Data Streamer with Viem 2.38.5 Integration
 */
export class DataStreamerViem extends EventEmitter {
  private config: DataStreamConfig;
  private bscConfig: BscStreamConfig;
  private publicClient: PublicClient<Transport, Chain>;
  private wsManager: WebSocketManagerViem;

  // Buffer management
  private buffer: StreamBufferItem[] = [];
  private bufferProcessingTimer: NodeJS.Timeout | null = null;

  // Stream management
  private activeStreams = new Map<string, any>(); // Viem subscription handles
  private streamSubscriptions = new Map<string, SubscriptionConfig>();
  private isStreaming = false;

  // Data processing
  private processedData = new Map<string, Set<string>>(); // Deduplication tracking
  private persistenceQueue: StreamedData[] = [];
  private retryQueue = StreamedData[] = [];

  // Metrics
  private metrics = {
    totalMessages: 0,
    successfulMessages: 0,
    failedMessages: 0,
    duplicateMessages: 0,
    validationErrors: 0,
    averageLatency: 0,
    bufferUtilization: 0,
    messageRate: 0,
    streamCount: 0,
    bscSpecific: {
      blockMessages: 0,
      transactionMessages: 0,
      logMessages: 0,
      contractEventMessages: 0,
      priceUpdateMessages: 0,
      pancakeSwapMessages: 0,
      tokenTransferMessages: 0
    }
  };

  // Rate limiting
  private messageTimestamps: number[] = [];

  constructor(
    config: Partial<DataStreamConfig> = {},
    bscConfig?: Partial<BscStreamConfig>,
    publicClient?: PublicClient<Transport, Chain>,
    wsManager?: WebSocketManagerViem
  ) {
    super();

    this.publicClient = publicClient || createPublicClient({
      chain: bscConfig?.chainId === 97 ? bscTestnet : bsc,
      transport: http('https://bsc-dataseed1.binance.org/')
    });

    this.wsManager = wsManager || new WebSocketManagerViem();

    this.bscConfig = {
      chainId: bsc?.chainId || 56,
      blockTime: 3000, // 3 seconds for BSC
      supportedTokens: {
        'BNB': {
          address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
          decimals: 18,
          symbol: 'BNB'
        },
        'BUSD': {
          address: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
          decimals: 18,
          symbol: 'BUSD'
        },
        'CAKE': {
          address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
          decimals: 18,
          symbol: 'CAKE'
        },
        'USDT': {
          address: '0x55d398326f99059ff775485246999027b3197955',
          decimals: 18,
          symbol: 'USDT'
        }
      },
      pancakeSwapConfig: {
        factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
        router: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
        masterChef: '0x73feaa1eE314F8c655E354234017bE2193C9E24E',
        pools: [
          '0x0eD7905E3D64c722e237b79636c2986571f9eac7'
        ]
      },
      dexConfigs: {
        pancakeswap: {
          factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
          router: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
          quoteToken: '0xe9e7cea3dedca5984780bafc599bd69add087d56'
        }
      },
      ...bscConfig
    };

    this.config = {
      streamName: 'default',
      bufferSize: 1000,
      bufferTimeout: 30000, // 30 seconds
      enableCompression: false,
      enableEncryption: false,
      enableBatching: true,
      batchSize: 50,
      batchTimeout: 1000,
      enableDeduplication: true,
      deduplicationWindow: 60000, // 1 minute
      enablePersistence: false,
      enableReplay: false,
      maxRetries: 3,
      retryDelay: 1000,
      enableDataValidation: false,
      enableRateLimiting: false,
      maxMessagesPerSecond: 100,
      ...config
    };

    this.initializeStreamer();
  }

  /**
   * Initialize data streamer
   */
  private initializeStreamer(): void {
    // Set up WebSocket manager event handlers
    this.wsManager.on('connected', () => {
      logger.info('WebSocket manager connected, ready for streaming');
      this.emit('ready');
    });

    this.wsManager.on('disconnected', () => {
      logger.warn('WebSocket manager disconnected, pausing streaming');
      this.pauseStreaming();
    });

    this.wsManager.on('error', (error: Error) => {
      logger.error({ error: error.message }, 'WebSocket manager error');
      this.emit('error', error);
    });

    // Start buffer processing
    this.startBufferProcessing();

    logger.info('Data Streamer initialized', {
      streamName: this.config.streamName,
      bufferSize: this.config.bufferSize,
      enableBatching: this.config.enableBatching,
      enableDeduplication: this.config.enableDeduplication
    });
  }

  /**
   * Start streaming data
   */
  async startStreaming(): Promise<void> {
    if (this.isStreaming) {
      logger.warn('Streaming is already active');
      return;
    }

    try {
      this.isStreaming = true;

      // Set up default subscriptions
      await this.setupDefaultSubscriptions();

      logger.info('Data streaming started', {
        streamName: this.config.streamName,
        activeStreams: this.activeStreams.size
      });

      this.emit('streamingStarted');

    } catch (error) {
      this.isStreaming = false;
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to start data streaming');

      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop streaming data
   */
  async stopStreaming(): Promise<void> {
    if (!this.isStreaming) {
      return;
    }

    try {
      this.isStreaming = false;

      // Unsubscribe from all streams
      for (const [streamId, subscriptionId] of this.streamSubscriptions.entries()) {
        this.wsManager.removeSubscription(subscriptionId);
        this.activeStreams.delete(streamId);
      }

      this.streamSubscriptions.clear();
      this.activeStreams.clear();

      // Clear retry queue
      this.retryQueue = [];

      logger.info('Data streaming stopped', {
        streamName: this.config.streamName
      });

      this.emit('streamingStopped');

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to stop data streaming');

      this.emit('error', error);
    }
  }

  /**
   * Pause streaming (temporary)
   */
  pauseStreaming(): void {
    if (!this.isStreaming) return;

    this.isStreaming = false;
    logger.info('Data streaming paused');
    this.emit('streamingPaused');
  }

  /**
   * Resume streaming
   */
  async resumeStreaming(): Promise<void> {
    if (this.isStreaming) return;

    this.isStreaming = true;
    logger.info('Data streaming resumed');
    this.emit('streamingResumed');
  }

  /**
   * Setup default subscriptions
   */
  private async setupDefaultSubscriptions(): Promise<void> {
    // Subscribe to new blocks
    await this.addStream({
      type: StreamDataType.BLOCK,
      callback: (data) => this.handleBlockData(data)
    });

    // Subscribe to pending transactions
    await this.addStream({
      type: StreamDataType.TRANSACTION,
      callback: (data) => this.handleTransactionData(data)
    });

    // Subscribe to PancakeSwap events
    await this.addPancakeSwapStreams();

    // Subscribe to major token transfers
    await this.addTokenTransferStreams();
  }

  /**
   * Add PancakeSwap event streams
   */
  private async addPancakeSwapStreams(): Promise<void> {
    try {
      // Swap events
      const swapSubscription = this.wsManager.addSubscription({
        id: `${this.config.streamName}_pancakeswap_swaps`,
        type: 'contractEvents',
        filters: {
          address: this.bscConfig.pancakeSwapConfig.router
        },
        abi: this.getPancakeSwapRouterABI(),
        eventName: 'Swap',
        callback: (data) => this.handlePancakeSwapData(data)
      });

      this.streamSubscriptions.set('pancakeswap_swaps', swapSubscription);

      // Sync events (for reserves)
      const syncSubscription = this.wsManager.addSubscription({
        id: `${this.config.streamName}_pancakeswap_sync`,
        type: 'contractEvents',
        filters: {
          address: this.bscConfig.pancakeSwapConfig.factory
        },
        abi: this.getPancakeSwapFactoryABI(),
        eventName: 'Sync',
        callback: (data) => this.handlePancakeSyncData(data)
      });

      this.streamSubscriptions.set('pancakeswap_sync', syncSubscription);

      logger.info('PancakeSwap streams added');

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to add PancakeSwap streams');
    }
  }

  /**
   * Add token transfer streams
   */
  private async addTokenTransferStreams(): Promise<void> {
    for (const [symbol, tokenConfig] of Object.entries(this.bscConfig.supportedTokens)) {
      try {
        const subscription = this.wsManager.addSubscription({
          id: `${this.config.streamName}_transfer_${symbol}`,
          type: 'contractEvents',
          filters: {
            address: tokenConfig.address
          },
          abi: this.getERC20ABI(),
          eventName: 'Transfer',
          callback: (data) => this.handleTokenTransferData(data, symbol, tokenConfig)
        });

        this.streamSubscriptions.set(`transfer_${symbol}`, subscription);

        logger.debug(`Token transfer stream added for ${symbol}`);

      } catch (error) {
        logger.error({
          symbol,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, `Failed to add transfer stream for ${symbol}`);
      }
    }
  }

  /**
   * Add custom data stream
   */
  async addStream(config: {
    type: StreamDataType;
    filters?: any;
    abi?: any[];
    eventName?: string;
    callback: (data: StreamedData) => void | Promise<void>;
    priority?: number;
  }): Promise<string> {
    const streamId = this.generateStreamId();

    try {
      // Validate configuration
      this.validateStreamConfig(config);

      // Create WebSocket subscription
      const wsConfig: SubscriptionConfig = {
        id: streamId,
        type: this.mapStreamTypeToWebSocket(config.type),
        filters: config.filters,
        abi: config.abi,
        eventName: config.eventName,
        callback: async (data: any) => {
          const streamedData: StreamedData = {
            id: this.generateDataId(),
            type: config.type,
            timestamp: Date.now(),
            data: data,
            source: streamId,
            validated: this.config.enableDataValidation
          };

          await this.processStreamedData(streamedData, config.callback);
        },
        onError: (error: Error) => {
          logger.error({
            streamId,
            type: config.type,
            error: error.message
          }, 'Stream error occurred');

          this.metrics.failedMessages++;
          this.emit('streamError', { streamId, type: config.type, error });
        }
      };

      const subscriptionId = this.wsManager.addSubscription(wsConfig);
      this.streamSubscriptions.set(streamId, subscriptionId);
      this.activeStreams.set(streamId, wsConfig);

      this.metrics.streamCount++;

      logger.info('Stream added', {
        streamId,
        type: config.type,
        priority: config.priority || 0
      });

      return streamId;

    } catch (error) {
      logger.error({
        streamId,
        type: config.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to add stream');

      throw error;
    }
  }

  /**
   * Remove data stream
   */
  removeStream(streamId: string): boolean {
    try {
      const subscriptionId = this.streamSubscriptions.get(streamId);
      if (!subscriptionId) return false;

      // Remove WebSocket subscription
      const removed = this.wsManager.removeSubscription(subscriptionId);

      // Clean up local references
      this.streamSubscriptions.delete(streamId);
      this.activeStreams.delete(streamId);
      this.metrics.streamCount--;

      if (removed) {
        logger.info('Stream removed', { streamId });
        this.emit('streamRemoved', { streamId });
      }

      return removed;

    } catch (error) {
      logger.error({
        streamId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to remove stream');

      return false;
    }
  }

  /**
   * Process streamed data
   */
  private async processStreamedData(
    data: StreamedData,
    callback: (data: StreamedData) => void | Promise<void>
  ): Promise<void> {
    try {
      // Rate limiting check
      if (this.config.enableRateLimiting && !this.checkRateLimit()) {
        logger.debug('Rate limit exceeded, dropping message');
        return;
      }

      // Deduplication check
      if (this.config.enableDeduplication && this.isDuplicate(data)) {
        this.metrics.duplicateMessages++;
        return;
      }

      // Validation check
      if (this.config.enableDataValidation) {
        const validation = this.validateData(data);
        if (!validation.valid) {
          this.metrics.validationErrors++;
          logger.warn({
            dataId: data.id,
            errors: validation.errors
          }, 'Data validation failed');

          if (validation.cleaned) {
            data.data = validation.cleaned;
          } else {
            return;
          }
        }
      }

      // Update metrics
      this.metrics.totalMessages++;
      this.metrics.successfulMessages++;
      this.updateMetricsByType(data.type);

      // Add to buffer
      this.addToBuffer(data);

      // Update deduplication tracking
      if (this.config.enableDeduplication) {
        this.updateDeduplicationTracking(data);
      }

    } catch (error) {
      this.metrics.failedMessages++;
      logger.error({
        dataId: data.id,
        type: data.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to process streamed data');

      // Add to retry queue if retries are enabled
      if (this.config.maxRetries > 0 && (data.retryCount || 0) < this.config.maxRetries) {
        data.retryCount = (data.retryCount || 0) + 1;
        this.retryQueue.push(data);
      }
    }
  }

  /**
   * Add data to buffer
   */
  private addToBuffer(data: StreamedData): void {
    const bufferItem: StreamBufferItem = {
      data,
      timestamp: Date.now(),
      processed: false
    };

    this.buffer.push(bufferItem);

    // Check buffer size
    if (this.buffer.length > this.config.bufferSize) {
      // Remove oldest items
      const removed = this.buffer.splice(0, this.buffer.length - this.config.bufferSize);
      logger.debug(`Buffer overflow, removed ${removed.length} items`);
    }

    // Update buffer utilization
    this.metrics.bufferUtilization = this.buffer.length / this.config.bufferSize;
  }

  /**
   * Start buffer processing
   */
  private startBufferProcessing(): void {
    const processBuffer = () => {
      const now = Date.now();
      const unprocessed = this.buffer.filter(item => !item.processed);

      // Process expired items
      const expired = unprocessed.filter(item =>
        now - item.timestamp > this.config.bufferTimeout
      );

      if (expired.length > 0) {
        logger.debug(`Processing ${expired.length} expired buffer items`);
        expired.forEach(item => {
          this.processBufferItem(item);
          item.processed = true;
        });
      }

      // Remove processed items
      this.buffer = this.buffer.filter(item => !item.processed);
    };

    if (this.config.enableBatching) {
      this.bufferProcessingTimer = setInterval(processBuffer, this.config.batchTimeout);
    } else {
      this.bufferProcessingTimer = setInterval(processBuffer, 1000);
    }
  }

  /**
   * Process individual buffer item
   */
  private processBufferItem(item: StreamBufferItem): void {
    try {
      // Find and execute callback for this stream
      for (const [streamId, streamConfig] of this.activeStreams.entries()) {
        if (item.data.source === streamId || this.matchesStreamType(item.data.type, streamConfig.type)) {
          // Execute callback asynchronously
          (streamConfig as any).callback(item.data).catch(error => {
            logger.error({
              dataId: item.data.id,
              streamId,
              error: error instanceof Error ? error.message : 'Unknown error'
            }, 'Error in stream callback');
          });

          break;
        }
      }

      // Emit generic data event
      this.emit('data', item.data);

    } catch (error) {
      logger.error({
        dataId: item.data.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Error processing buffer item');
    }
  }

  /**
   * Process retry queue
   */
  private processRetryQueue(): void {
    if (this.retryQueue.length === 0) return;

    const now = Date.now();
    const readyToRetry = this.retryQueue.filter(data =>
      now - data.timestamp > this.config.retryDelay
    );

    if (readyToRetry.length > 0) {
      logger.debug(`Processing ${readyToRetry.length} retry items`);

      readyToRetry.forEach(data => {
        // Remove from retry queue
        const index = this.retryQueue.indexOf(data);
        if (index !== -1) {
          this.retryQueue.splice(index, 1);
        }

        // Re-process data
        this.processStreamedData(data, () => {
          // Generic retry callback
        });
      });
    }
  }

  /**
   * Handle block data
   */
  private handleBlockData(data: any): void {
    try {
      const blockData: StreamedData = {
        id: this.generateDataId(),
        type: StreamDataType.BLOCK,
        timestamp: Date.now(),
        blockNumber: data.block.number,
        data: {
          number: data.block.number,
          hash: data.block.hash,
          parentHash: data.block.parentHash,
          timestamp: data.block.timestamp,
          gasLimit: data.block.gasLimit,
          gasUsed: data.block.gasUsed,
          baseFeePerGas: data.block.baseFeePerGas,
          difficulty: data.block.difficulty,
          miner: data.block.miner,
          transactions: data.block.transactions?.length || 0
        },
        source: 'block_stream'
      };

      this.addToBuffer(blockData);

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Error handling block data');
    }
  }

  /**
   * Handle transaction data
   */
  private handleTransactionData(data: any): void {
    try {
      const transactions = Array.isArray(data.transactions) ? data.transactions : [data];

      transactions.forEach((transaction: Transaction) => {
        const transactionData: StreamedData = {
          id: this.generateDataId(),
          type: StreamDataType.TRANSACTION,
          timestamp: Date.now(),
          blockNumber: transaction.blockNumber,
          transactionHash: transaction.hash,
          data: {
            hash: transaction.hash,
            blockNumber: transaction.blockNumber,
            blockHash: transaction.blockHash,
            transactionIndex: transaction.transactionIndex,
            from: transaction.from,
            to: transaction.to,
            value: transaction.value,
            gas: transaction.gas,
            gasPrice: transaction.gasPrice,
            maxFeePerGas: transaction.maxFeePerGas,
            maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
            input: transaction.input,
            type: transaction.type
          },
          source: 'transaction_stream'
        };

        this.addToBuffer(transactionData);
      });

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Error handling transaction data');
    }
  }

  /**
   * Handle PancakeSwap swap data
   */
  private handlePancakeSwapData(data: any): void {
    try {
      const swapData: StreamedData = {
        id: this.generateDataId(),
        type: StreamDataType.SWAP_EVENT,
        timestamp: Date.now(),
        blockNumber: data.blockNumber,
        transactionHash: data.transactionHash,
        data: {
          ...data,
          dex: 'pancakeswap',
          platform: 'BSC',
          parsedArgs: this.parsePancakeSwapArgs(data.args)
        },
        source: 'pancakeswap_stream'
      };

      this.addToBuffer(swapData);

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Error handling PancakeSwap data');
    }
  }

  /**
   * Handle PancakeSync data
   */
  private handlePancakeSyncData(data: any): void {
    try {
      const syncData: StreamedData = {
        id: this.generateDataId(),
        type: StreamDataType.LIQUIDITY_EVENT,
        timestamp: Date.now(),
        blockNumber: data.blockNumber,
        transactionHash: data.transactionHash,
        data: {
          ...data,
          dex: 'pancakeswap',
          platform: 'BSC',
          parsedArgs: this.parsePancakeSyncArgs(data.args)
        },
        source: 'pancakeswap_stream'
      };

      this.addToBuffer(syncData);

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Error handling PancakeSync data');
    }
  }

  /**
   * Handle token transfer data
   */
  private handleTokenTransferData(data: any, symbol: string, tokenConfig: any): void {
    try {
      const transferData: StreamedData = {
        id: this.generateDataId(),
        type: StreamDataType.TOKEN_TRANSFER,
        timestamp: Date.now(),
        blockNumber: data.blockNumber,
        transactionHash: data.transactionHash,
        data: {
          ...data,
          token: {
            address: tokenConfig.address,
            symbol: symbol,
            decimals: tokenConfig.decimals
          },
          amount: this.formatTokenAmount(data.args.value, tokenConfig.decimals),
          formattedAmount: this.formatTokenAmount(data.args.value, tokenConfig.decimals, true)
        },
        source: 'token_transfer_stream'
      };

      this.addToBuffer(transferData);

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Error handling token transfer data');
    }
  }

  /**
   * Map stream type to WebSocket type
   */
  private mapStreamTypeToWebSocket(type: StreamDataType): string {
    switch (type) {
      case StreamDataType.BLOCK:
        return 'newBlocks';
      case StreamDataType.TRANSACTION:
        return 'newPendingTransactions';
      case StreamDataType.LOG:
        return 'logs';
      case StreamDataType.CONTRACT_EVENT:
        return 'contractEvents';
      default:
        return 'logs';
    }
  }

  /**
   * Check if data matches stream type
   */
  private matchesStreamType(dataType: StreamDataType, streamType: string): boolean {
    switch (streamType) {
      case 'newBlocks':
        return dataType === StreamDataType.BLOCK;
      case 'newPendingTransactions':
        return dataType === StreamDataType.TRANSACTION;
      case 'logs':
        return dataType === StreamDataType.LOG;
      case 'contractEvents':
        return dataType === StreamDataType.CONTRACT_EVENT;
      default:
        return false;
    }
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(): boolean {
    const now = Date.now();

    // Remove old timestamps
    this.messageTimestamps = this.messageTimestamps.filter(
      timestamp => now - timestamp < 1000 // 1 second window
    );

    // Check if under limit
    return this.messageTimestamps.length < this.config.maxMessagesPerSecond;
  }

  /**
   * Check if data is duplicate
   */
  private isDuplicate(data: StreamedData): boolean {
    const key = this.generateDeduplicationKey(data);
    const existing = this.processedData.get(key);

    if (existing) {
      const now = Date.now();
      for (const timestamp of existing) {
        if (now - timestamp < this.config.deduplicationWindow) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Update deduplication tracking
   */
  private updateDeduplicationTracking(data: StreamedData): void {
    const key = this.generateDeduplicationKey(data);
    const now = Date.now();

    if (!this.processedData.has(key)) {
      this.processedData.set(key, new Set());
    }

    const timestamps = this.processedData.get(key)!;
    timestamps.add(now);

    // Clean old timestamps
    for (const timestamp of timestamps) {
      if (now - timestamp > this.config.deduplicationWindow) {
        timestamps.delete(timestamp);
      }
    }

    // Remove empty sets
    if (timestamps.size === 0) {
      this.processedData.delete(key);
    }
  }

  /**
   * Generate deduplication key
   */
  private generateDeduplicationKey(data: StreamData): string {
    if (data.transactionHash) {
      return `${data.type}_${data.transactionHash}`;
    }
    if (data.blockNumber) {
      return `${data.type}_${data.blockNumber.toString()}`;
    }
    return `${data.type}_${JSON.stringify(data.data)}`;
  }

  /**
   * Validate data
   */
  private validateData(data: StreamedData): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    try {
      // Basic validation
      if (!data.id) {
        result.errors.push('Missing data ID');
        result.valid = false;
      }

      if (!data.type) {
        result.errors.push('Missing data type');
        result.valid = false;
      }

      if (!data.timestamp) {
        result.errors.push('Missing timestamp');
        result.valid = false;
      }

      // Custom validation if schema is provided
      if (this.config.validationSchema) {
        // Implement custom validation logic here
        // This would integrate with a validation library like Joi or Zod
      }

    } catch (error) {
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.valid = false;
    }

    return result;
  }

  /**
   * Format token amount
   */
  private formatTokenAmount(amount: bigint, decimals: number, formatted = false): string | number {
    if (formatted) {
      return Number(formatUnits(amount, decimals));
    }
    return formatUnits(amount, decimals);
  }

  /**
   * Parse PancakeSwap swap arguments
   */
  private parsePancakeSwapSwapArgs(args: any[]): any {
    try {
      return {
        amount0In: args[0] ? formatEther(args[0]) : '0',
        amount1In: args[1] ? formatEther(args[1]) : '0',
        amount0Out: args[2] ? formatEther(args[2]) : '0',
        amount1Out: args[3] ? formatEther(args[3]) : '0',
        to: args[4],
        from: args[5]
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Parse PancakeSwap sync arguments
   */
  private parsePancakeSyncArgs(args: any[]): any {
    try {
      return {
        reserve0: args[0] ? formatEther(args[0]) : '0',
        reserve1: args[1] ? formatEther(args[1]) : '0'
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Update metrics by data type
   */
  private updateMetricsByType(type: StreamDataType): void {
    switch (type) {
      case StreamDataType.BLOCK:
        this.metrics.bscSpecific.blockMessages++;
        break;
      case StreamDataType.TRANSACTION:
        this.metrics.bscSpecific.transactionMessages++;
        break;
      case StreamDataType.LOG:
        this.metrics.bscSpecific.logMessages++;
        break;
      case StreamDataType.CONTRACT_EVENT:
        this.metrics.bscSpecific.contractEventMessages++;
        break;
      case StreamDataType.SWAP_EVENT:
        this.metrics.bscSpecific.pancakeSwapMessages++;
        break;
      case StreamDataType.TOKEN_TRANSFER:
        this.metrics.bscSpecific.tokenTransferMessages++;
        break;
    }
  }

  /**
   * Validate stream configuration
   */
  private validateStreamConfig(config: any): void {
    if (!config.type) {
      throw new Error('Stream type is required');
    }

    if (!config.callback) {
      throw new Error('Stream callback is required');
    }

    if (config.type === StreamDataType.CONTRACT_EVENT && (!config.abi || !config.eventName)) {
      throw new Error('Contract events require ABI and eventName');
    }
  }

  /**
   * Get PancakeSwap router ABI (simplified)
   */
  private getPancakeSwapRouterABI(): Abi {
    return [
      {
        type: 'event',
        name: 'Swap',
        inputs: [
          { indexed: true, name: 'sender', type: 'address' },
          { indexed: true, name: 'amount0In', type: 'uint256' },
          { indexed: true, name: 'amount1In', type: 'uint256' },
          { indexed: false, name: 'amounts', type: 'uint256[]' },
          { indexed: false, name: 'to', type: 'address' }
        ]
      },
      {
        type: 'event',
        name: 'Sync',
        inputs: [
          { indexed: true, name: 'reserve0', type: 'uint112' },
          { indexed: true, name: 'reserve1', type: 'uint112' }
        ]
      }
    ];
  }

  /**
   * Get PancakeSwap factory ABI (simplified)
   */
  private getPancakeSwapFactoryABI(): Abi {
    return [
      {
        type: 'event',
        name: 'PairCreated',
        inputs: [
          { indexed: true, name: 'token0', type: 'address' },
          { indexed: true, name: 'token1', type: 'address' },
          { indexed: false, name: 'pair', type: 'address' }
        ]
      },
      {
        type: 'event',
        name: 'Sync',
        inputs: [
          { indexed: true, name: 'reserve0', type: 'uint112' },
          { indexed: true, name: 'reserve1', type: 'uint112' }
        ]
      }
    ];
  }

  /**
   * Get ERC20 ABI (simplified)
   */
  private getERC20ABI(): Abi {
    return [
      {
        type: 'event',
        name: 'Transfer',
        inputs: [
          { indexed: true, name: 'from', type: 'address' },
          { indexed: true, name: 'to', type: 'address' },
          { indexed: false, name: 'value', type: 'uint256' }
        ]
      },
      {
        type: 'event',
        name: 'Approval',
        inputs: [
          { indexed: true, name: 'owner', type: 'address' },
          { indexed: true, name: 'spender', type: 'address' },
          { indexed: false, name: 'value', type: 'uint256' }
        ]
      }
    ];
  }

  /**
   * Generate stream ID
   */
  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate data ID
   */
  private generateDataId(): string {
    return `data_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get metrics
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Get stream statistics
   */
  getStreamStats(): {
    activeStreams: this.activeStreams.size,
    bufferUtilization: this.metrics.bufferUtilization,
    messageRate: this.metrics.messageRate,
    isStreaming: this.isStreaming,
    queueLength: this.retryQueue.length,
    bscSpecific: this.metrics.bscSpecific
  }

  /**
   * Get active streams
   */
  getActiveStreams(): Array<{ id: string; type: string; config: any }> {
    return Array.from(this.activeStreams.entries()).map(([id, config]) => ({
      id,
      type: this.mapWebSocketTypeToStream(config.type as any),
      config
    }));
  }

  /**
   * Update stream configuration
   */
  updateConfig(updates: Partial<DataStreamConfig>): void {
    Object.assign(this.config, updates);

    logger.info('Stream configuration updated', { updates });
  }

  /**
   * Clear buffer
   */
  clearBuffer(): number {
    const count = this.buffer.length;
    this.buffer = [];
    this.metrics.bufferUtilization = 0;
    logger.debug('Buffer cleared', { count });
    return count;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check WebSocket manager health
      const wsHealthy = await this.wsManager.healthCheck();

      // Check buffer utilization
      const bufferHealthy = this.metrics.bufferUtilization < 0.9;

      // Check error rate
      const errorRate = this.metrics.totalMessages > 0
        ? this.metrics.failedMessages / this.metrics.totalMessages
        : 0;
      const errorRateHealthy = errorRate < 0.05; // 5% error rate threshold

      return wsHealthy && bufferHealthy && errorRateHealthy;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Health check failed');
      return false;
    }
  }

  /**
   * Shutdown data streamer
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down data streamer');

    // Stop streaming
    await this.stopStreaming();

    // Clear buffer
    this.clearBuffer();

    // Clear queues
    this.retryQueue = [];

    // Clear timers
    if (this.bufferProcessingTimer) {
      clearInterval(this.bufferProcessingTimer);
      this.bufferProcessingTimer = null;
    }

    // Shutdown WebSocket manager
    await this.wsManager.shutdown();

    // Reset metrics
    this.metrics = {
      totalMessages: 0,
      successfulMessages: 0,
      failedMessages: 0,
      duplicateMessages: 0,
      validationErrors: 0,
      averageLatency: 0,
      bufferUtilization: 0,
      messageRate: 0,
      streamCount: 0,
      bscSpecific: {
        blockMessages: 0,
        transactionMessages: 0,
        logMessages: 0,
        contractEventMessages: 0,
        priceUpdateMessages: 0,
        pancakeSwapMessages: 0,
        tokenTransferMessages: 0
      }
    };

    this.emit('shutdown');

    logger.info('Data streamer shutdown completed');
  }
}

// Export singleton factory
export function createDataStreamerViem(
  config?: Partial<DataStreamConfig>,
  bscConfig?: Partial<BscStreamConfig>,
  publicClient?: PublicClient<Transport, Chain>,
  wsManager?: WebSocketManagerViem
): DataStreamerViem {
  return new DataStreamerViem(config, bscConfig, publicClient, wsManager);
}

// Export default instance
export const dataStreamerViem = createDataStreamerViem();