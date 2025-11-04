/**
 * Advanced Batch Processor for BSC Operations - Viem Integration
 * High-performance batch processing with intelligent grouping and optimization using Viem 2.38.5
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
  parseEther,
  formatEther,
  maxUint256,
  maxInt256,
  numberToHex,
  hexToString,
  toHex,
  fromHex,
  encodeFunctionData,
  decodeFunctionResult,
  getContract,
  WriteContractParameters,
  WriteContractReturnType,
  ReadContractParameters,
  ReadContractReturnType,
  SendTransactionParameters,
  SendTransactionReturnType,
  WaitForTransactionReceiptReturnType,
  Block,
  Transaction,
  TransactionReceipt,
  Log
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { EventEmitter } from 'events';
import logger from '../../../utils/logger.js';

/**
 * BSC-specific configuration for batch processing
 */
interface BscBatchConfig {
  chainId: number;
  defaultGasPrice: string;
  defaultGasLimit: number;
  blockTime: number;
  pancakeSwapRouter: Address;
  masterChef: Address;
  bnbTokenAddress: Address;
  busdTokenAddress: Address;
  cakeTokenAddress: Address;
  maxGasPriceGwei: string;
  gasMultiplier: number;
  confirmations: number;
}

/**
 * Batch operation types
 */
export enum BatchOperationTypeViem {
  SWAP = 'swap',
  LIQUIDITY_ADD = 'liquidity_add',
  LIQUIDITY_REMOVE = 'liquidity_remove',
  APPROVE = 'approve',
  CLAIM_REWARDS = 'claim_rewards',
  STAKE = 'stake',
  UNSTAKE = 'unstake',
  CUSTOM = 'custom'
}

/**
 * Batch operation configuration with Viem integration
 */
export interface BatchOperationViem {
  id: string;
  type: BatchOperationTypeViem;
  data: any;
  priority: number;
  dependencies?: string[]; // Operation IDs that must complete first
  maxGasPrice?: bigint;
  gasLimit?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  metadata?: Record<string, any>;
  timeout?: number;
  retryAttempts?: number;
  createdAt: number;
  clientType?: 'public' | 'wallet' | 'custom';
  account?: Address;
  pancakeSwapOptimized?: boolean;
  gasOptimized?: boolean;
}

/**
 * Batch processing configuration for Viem
 */
export interface BatchProcessorConfigViem {
  // Batch settings
  maxBatchSize: number;
  batchTimeout: number; // milliseconds
  maxBatchWaitTime: number;
  minBatchSize: number;

  // Concurrency settings
  maxConcurrentBatches: number;
  maxOperationsPerBatch: number;
  operationTimeout: number;

  // Optimization settings
  enableOptimalGrouping: boolean;
  enableDependencyResolution: boolean;
  enablePriorityQueuing: boolean;
  enableGasOptimization: boolean;
  enableViemOptimization: boolean;
  enableMulticallOptimization: boolean;

  // Performance settings
  enableMetrics: boolean;
  metricsInterval: number;
  enablePerformanceAlerts: boolean;

  // Error handling
  enableRetryLogic: boolean;
  maxRetryAttempts: number;
  retryDelay: number;
  retryBackoffMultiplier: number;

  // Gas optimization
  gasPriceBuffer: number;
  gasLimitBuffer: number;
  enableDynamicGasAdjustment: boolean;
  enableEIP1559Support: boolean;

  // Viem-specific settings
  useSimulate: boolean;
  enableBatchCalls: boolean;
  enableContractBatching: boolean;
}

/**
 * Batch execution result with Viem integration
 */
export interface BatchResultViem {
  batchId: string;
  operationResults: Array<{
    operationId: string;
    success: boolean;
    result?: any;
    error?: Error;
    gasUsed?: bigint;
    transactionHash?: Address;
    blockNumber?: bigint;
    blockHash?: Address;
    logs?: Log[];
    executionTime: number;
    viemSpecific?: {
      simulationResult?: any;
      multicallResult?: any;
      batchCallResult?: any;
    };
  }>;
  totalGasUsed: bigint;
  totalCostUSD: number;
  executionTime: number;
  successRate: number;
  bscSpecific?: {
    bnbPrice: number;
    networkUtilization: number;
    blockNumber: bigint;
    gasOptimization: boolean;
  };
}

/**
 * Batch processing metrics with Viem integration
 */
export interface BatchMetricsViem {
  totalBatches: number;
  successfulBatches: number;
  failedBatches: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageBatchSize: number;
  averageExecutionTime: number;
  averageGasUsed: bigint;
  averageCostUSD: number;
  throughput: number; // operations per second
  efficiency: number;
  gasOptimizationSavings: number;
  viemSpecific: {
    simulationSuccessRate: number;
    multicallOptimization: number;
    batchCallSavings: number;
    averageSimulatedGas: bigint;
    contractBatchingEfficiency: number;
  };
  bscSpecific: {
    totalBnbSpent: bigint;
    averageGasPrice: bigint;
    peakGasPrice: bigint;
    networkUtilizationAverage: number;
    pancakeSwapOptimizations: number;
  };
}

/**
 * Batch group for optimization with Viem integration
 */
interface BatchGroupViem {
  type: BatchOperationTypeViem;
  operations: BatchOperationViem[];
  priority: number;
  estimatedGasCost: bigint;
  createdAt: number;
  clientType: 'public' | 'wallet' | 'custom';
  pancakeSwapOptimized: boolean;
  viemOptimized: boolean;
}

/**
 * Advanced Batch Processor with Viem 2.38.5 Integration
 */
export class AdvancedBatchProcessorViem extends EventEmitter {
  private config: BatchProcessorConfigViem;
  private bscConfig: BscBatchConfig;
  private publicClient: PublicClient<Transport, Chain>;
  private walletClient?: WalletClient<Transport, Chain, Account>;
  private customClients: Map<string, PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account>> = new Map();

  // Queues and processing
  private pendingOperations: Map<string, BatchOperationViem> = new Map();
  private operationQueue: BatchOperationViem[] = [];
  private processingBatches: Map<string, BatchOperationViem[]> = new Map();
  private completedOperations: Map<string, any> = new Map();

  // Metrics
  private metrics: BatchMetricsViem = {
    totalBatches: 0,
    successfulBatches: 0,
    failedBatches: 0,
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageBatchSize: 0,
    averageExecutionTime: 0,
    averageGasUsed: BigInt(0),
    averageCostUSD: 0,
    throughput: 0,
    efficiency: 0,
    gasOptimizationSavings: 0,
    viemSpecific: {
      simulationSuccessRate: 0,
      multicallOptimization: 0,
      batchCallSavings: 0,
      averageSimulatedGas: BigInt(0),
      contractBatchingEfficiency: 0
    },
    bscSpecific: {
      totalBnbSpent: BigInt(0),
      averageGasPrice: BigInt(0),
      peakGasPrice: BigInt(0),
      networkUtilizationAverage: 0,
      pancakeSwapOptimizations: 0
    }
  };

  // Timers and intervals
  private batchTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;

  // Network and gas optimization
  private currentGasPrice: bigint = BigInt('5000000000'); // 5 gwei
  private bnbPrice: number = 300; // Default BNB price in USD
  private networkUtilization: number = 0;

  constructor(
    publicClient: PublicClient<Transport, Chain>,
    config: Partial<BatchProcessorConfigViem> = {},
    bscConfig?: Partial<BscBatchConfig>,
    walletClient?: WalletClient<Transport, Chain, Account>
  ) {
    super();
    this.publicClient = publicClient;
    this.walletClient = walletClient;

    this.bscConfig = {
      chainId: bsc?.id || 56,
      defaultGasPrice: '5000000000', // 5 gwei
      defaultGasLimit: 21000,
      blockTime: 3000, // 3 seconds
      pancakeSwapRouter: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
      masterChef: '0x73feaa1eE314F8c655E354234017bE2193C9E24E',
      bnbTokenAddress: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
      busdTokenAddress: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
      cakeTokenAddress: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
      maxGasPriceGwei: '20',
      gasMultiplier: 1.1,
      confirmations: 1,
      ...bscConfig
    };

    this.config = {
      maxBatchSize: 20,
      batchTimeout: 2000, // 2 seconds
      maxBatchWaitTime: 10000, // 10 seconds
      minBatchSize: 2,
      maxConcurrentBatches: 5,
      maxOperationsPerBatch: 50,
      operationTimeout: 60000, // 1 minute
      enableOptimalGrouping: true,
      enableDependencyResolution: true,
      enablePriorityQueuing: true,
      enableGasOptimization: true,
      enableViemOptimization: true,
      enableMulticallOptimization: true,
      enableMetrics: true,
      metricsInterval: 30000, // 30 seconds
      enablePerformanceAlerts: true,
      enableRetryLogic: true,
      maxRetryAttempts: 3,
      retryDelay: 2000, // 2 seconds
      retryBackoffMultiplier: 2,
      gasPriceBuffer: 1.1, // 10% buffer
      gasLimitBuffer: 1.2, // 20% buffer
      enableDynamicGasAdjustment: true,
      enableEIP1559Support: true,
      useSimulate: true,
      enableBatchCalls: true,
      enableContractBatching: true,
      ...config
    };

    this.initializeProcessor();
  }

  /**
   * Initialize batch processor
   */
  private initializeProcessor(): void {
    // Start batch timer
    this.startBatchProcessor();

    // Start metrics collection
    if (this.config.enableMetrics) {
      this.startMetricsCollection();
    }

    // Start gas price monitoring
    this.startGasPriceMonitoring();

    // Start BSC-specific monitoring
    this.startBscMonitoring();

    logger.info('Advanced Batch Processor (Viem) initialized', {
      maxBatchSize: this.config.maxBatchSize,
      maxConcurrentBatches: this.config.maxConcurrentBatches,
      viemOptimization: this.config.enableViemOptimization,
      multicallOptimization: this.config.enableMulticallOptimization,
      bscChainId: this.bscConfig.chainId
    });
  }

  /**
   * Add a custom client for specific operations
   */
  addCustomClient(
    name: string,
    client: PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account>
  ): void {
    this.customClients.set(name, client);
    logger.info('Custom client added to batch processor', { name, type: client.type });
  }

  /**
   * Get appropriate client for operation
   */
  private getOperationClient(operation: BatchOperationViem):
    PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account> {

    if (operation.clientType === 'custom' && operation.metadata?.customClientName) {
      const customClient = this.customClients.get(operation.metadata.customClientName);
      if (customClient) {
        return customClient;
      }
    }

    if (operation.clientType === 'wallet' && this.walletClient) {
      return this.walletClient;
    }

    return this.publicClient;
  }

  /**
   * Submit operation for batch processing
   */
  async submitOperation(
    type: BatchOperationTypeViem,
    data: any,
    options: {
      priority?: number;
      dependencies?: string[];
      maxGasPrice?: bigint;
      gasLimit?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
      metadata?: Record<string, any>;
      timeout?: number;
      clientType?: 'public' | 'wallet' | 'custom';
      account?: Address;
      pancakeSwapOptimized?: boolean;
      gasOptimized?: boolean;
    } = {}
  ): Promise<string> {
    const operationId = this.generateOperationId();
    const now = Date.now();

    const operation: BatchOperationViem = {
      id: operationId,
      type,
      data,
      priority: options.priority || 0,
      dependencies: options.dependencies,
      maxGasPrice: options.maxGasPrice,
      gasLimit: options.gasLimit,
      maxFeePerGas: options.maxFeePerGas,
      maxPriorityFeePerGas: options.maxPriorityFeePerGas,
      metadata: options.metadata,
      timeout: options.timeout || this.config.operationTimeout,
      retryAttempts: 0,
      createdAt: now,
      clientType: options.clientType || 'public',
      account: options.account,
      pancakeSwapOptimized: options.pancakeSwapOptimized || false,
      gasOptimized: options.gasOptimized || false
    };

    // Add to pending operations
    this.pendingOperations.set(operationId, operation);

    // Add to queue based on priority
    this.addToQueue(operation);

    // Update metrics
    this.metrics.totalOperations++;

    logger.debug('Operation submitted for batch processing', {
      operationId,
      type,
      priority: operation.priority,
      queueSize: this.operationQueue.length,
      clientType: operation.clientType,
      pancakeSwapOptimized: operation.pancakeSwapOptimized
    });

    // Trigger batch processing
    this.processBatch();

    return operationId;
  }

  /**
   * Submit multiple operations for batch processing
   */
  async submitBatch(
    operations: Array<{
      type: BatchOperationTypeViem;
      data: any;
      priority?: number;
      dependencies?: string[];
      metadata?: Record<string, any>;
      clientType?: 'public' | 'wallet' | 'custom';
      account?: Address;
      pancakeSwapOptimized?: boolean;
    }>
  ): Promise<string[]> {
    const now = Date.now();
    const batchId = this.generateBatchId();
    const operationIds: string[] = [];

    logger.info('Submitting batch operations', {
      batchId,
      operationCount: operations.length
    });

    // Add operations with batch metadata
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const operationId = this.generateOperationId();

      const operation: BatchOperationViem = {
        id: operationId,
        type: op.type,
        data: op.data,
        priority: op.priority || 0,
        dependencies: op.dependencies,
        metadata: {
          ...op.metadata,
          batchId,
          batchIndex: i,
          totalInBatch: operations.length
        },
        retryAttempts: 0,
        createdAt: now,
        clientType: op.clientType || 'public',
        account: op.account,
        pancakeSwapOptimized: op.pancakeSwapOptimized || false,
        gasOptimized: false
      };

      this.pendingOperations.set(operationId, operation);
      this.addToQueue(operation);
      operationIds.push(operationId);
    }

    // Update metrics
    this.metrics.totalOperations += operations.length;

    // Process immediately for large batches
    if (operations.length >= this.config.minBatchSize) {
      await this.processBatch();
    }

    return operationIds;
  }

  /**
   * Get operation result
   */
  async getOperationResult(operationId: string): Promise<any> {
    const result = this.completedOperations.get(operationId);
    return result || null;
  }

  /**
   * Cancel pending operation
   */
  async cancelOperation(operationId: string): Promise<boolean> {
    const operation = this.pendingOperations.get(operationId);
    if (!operation) return false;

    // Remove from pending
    this.pendingOperations.delete(operationId);

    // Remove from queue
    const queueIndex = this.operationQueue.findIndex(op => op.id === operationId);
    if (queueIndex !== -1) {
      this.operationQueue.splice(queueIndex, 1);
    }

    // Remove from processing batches
    for (const [batchId, batchOps] of this.processingBatches.entries()) {
      const opIndex = batchOps.findIndex(op => op.id === operationId);
      if (opIndex !== -1) {
        batchOps.splice(opIndex, 1);
        if (batchOps.length === 0) {
          this.processingBatches.delete(batchId);
        }
      }
    }

    logger.debug('Operation cancelled', { operationId });
    return true;
  }

  /**
   * Get batch processing metrics
   */
  getMetrics(): BatchMetricsViem {
    // Calculate dynamic metrics
    const totalBatches = this.metrics.successfulBatches + this.metrics.failedBatches;
    const totalOps = this.metrics.successfulOperations + this.metrics.failedOperations;

    return {
      ...this.metrics,
      throughput: totalOps > 0 ? totalOps / (Date.now() / 1000) : 0,
      efficiency: totalBatches > 0 ? this.metrics.successfulBatches / totalBatches : 0
    };
  }

  /**
   * Add operation to priority queue
   */
  private addToQueue(operation: BatchOperationViem): void {
    if (!this.config.enablePriorityQueuing) {
      this.operationQueue.push(operation);
      return;
    }

    // Insert based on priority (higher priority first)
    let insertIndex = this.operationQueue.length;
    for (let i = 0; i < this.operationQueue.length; i++) {
      if (operation.priority > this.operationQueue[i].priority) {
        insertIndex = i;
        break;
      }
    }

    this.operationQueue.splice(insertIndex, 0, operation);
  }

  /**
   * Start batch processor
   */
  private startBatchProcessor(): void {
    const processBatch = () => {
      if (this.operationQueue.length > 0) {
        this.processBatch();
      }
    };

    this.batchTimer = setInterval(processBatch, this.config.batchTimeout);
  }

  /**
   * Process a batch of operations
   */
  private async processBatch(): Promise<void> {
    // Check if we're at maximum concurrent batches
    if (this.processingBatches.size >= this.config.maxConcurrentBatches) {
      return;
    }

    // Check if we have enough operations for a batch
    if (this.operationQueue.length < this.config.minBatchSize) {
      return;
    }

    // Create batch
    const batchSize = Math.min(
      this.config.maxBatchSize,
      this.config.maxOperationsPerBatch,
      this.operationQueue.length
    );

    let batchOperations = this.operationQueue.splice(0, batchSize);

    // Apply optimizations
    if (this.config.enableOptimalGrouping) {
      batchOperations = this.optimizeBatchGrouping(batchOperations);
    }

    if (this.config.enableDependencyResolution) {
      batchOperations = this.resolveDependencies(batchOperations);
    }

    // Apply Viem-specific optimizations
    if (this.config.enableViemOptimization) {
      batchOperations = this.applyViemOptimizations(batchOperations);
    }

    if (batchOperations.length === 0) return;

    const batchId = this.generateBatchId();
    this.processingBatches.set(batchId, batchOperations);

    logger.info('Processing batch', {
      batchId,
      operationCount: batchOperations.length,
      types: this.getBatchTypes(batchOperations),
      viemOptimized: this.config.enableViemOptimization,
      multicallOptimized: this.config.enableMulticallOptimization
    });

    // Execute batch
    this.executeBatch(batchId, batchOperations).catch(error => {
      logger.error({
        batchId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Batch execution failed');
    }).finally(() => {
      this.processingBatches.delete(batchId);
    });
  }

  /**
   * Apply Viem-specific optimizations
   */
  private applyViemOptimizations(operations: BatchOperationViem[]): BatchOperationViem[] {
    const optimized = [...operations];

    // Group operations by client type for optimal execution
    if (this.config.enableBatchCalls) {
      optimized.sort((a, b) => {
        // Group by client type
        if (a.clientType !== b.clientType) {
          const typeOrder = { 'wallet': 0, 'public': 1, 'custom': 2 };
          return (typeOrder[a.clientType!] || 99) - (typeOrder[b.clientType!] || 99);
        }
        // Then by pancakeSwap optimization
        if (a.pancakeSwapOptimized !== b.pancakeSwapOptimized) {
          return b.pancakeSwapOptimized ? 1 : -1;
        }
        return b.priority - a.priority;
      });
    }

    return optimized;
  }

  /**
   * Execute a batch of operations
   */
  private async executeBatch(batchId: string, operations: BatchOperationViem[]): Promise<BatchResultViem> {
    const startTime = Date.now();
    const results: BatchResultViem['operationResults'] = [];
    let totalGasUsed = BigInt(0);

    try {
      // Get current block for BSC-specific metrics
      const currentBlock = await this.publicClient.getBlock();
      const blockNumber = currentBlock.number;

      // Group operations by type and client for optimal execution
      const groupedOps = this.groupOperationsByTypeAndClient(operations);

      for (const [groupKey, ops] of groupedOps.entries()) {
        const groupResults = await this.executeOperationGroup(ops);
        results.push(...groupResults);

        // Sum gas used
        groupResults.forEach(result => {
          if (result.gasUsed) {
            totalGasUsed += result.gasUsed;
          }
        });
      }

      // Calculate batch metrics
      const executionTime = Date.now() - startTime;
      const successfulCount = results.filter(r => r.success).length;
      const totalCostUSD = this.calculateGasCostUSD(totalGasUsed);

      // Update metrics
      this.metrics.totalBatches++;
      this.metrics.successfulBatches++;
      this.metrics.successfulOperations += successfulCount;
      this.metrics.failedOperations += (results.length - successfulCount);
      this.metrics.averageBatchSize = (this.metrics.averageBatchSize + operations.length) / 2;
      this.metrics.averageExecutionTime = (this.metrics.averageExecutionTime + executionTime) / 2;
      this.metrics.averageGasUsed = (this.metrics.averageGasUsed + totalGasUsed) / BigInt(2);

      // Update BSC-specific metrics
      this.metrics.bscSpecific.totalBnbSpent += totalGasUsed * this.currentGasPrice / BigInt('1000000000000000000');

      const result: BatchResultViem = {
        batchId,
        operationResults: results,
        totalGasUsed,
        totalCostUSD,
        executionTime,
        successRate: successfulCount / results.length,
        bscSpecific: {
          bnbPrice: this.bnbPrice,
          networkUtilization: this.networkUtilization,
          blockNumber: blockNumber || BigInt(0),
          gasOptimization: this.config.enableGasOptimization
        }
      };

      // Store results for completed operations
      results.forEach(result => {
        this.completedOperations.set(result.operationId, result.success ? result.result : result.error);
      });

      logger.info('Batch execution completed', {
        batchId,
        successful: successfulCount,
        failed: results.length - successfulCount,
        totalGasUsed: result.totalGasUsed.toString(),
        totalCostUSD: result.totalCostUSD,
        executionTime: result.executionTime,
        successRate: (result.successRate * 100).toFixed(2) + '%',
        blockNumber: result.bscSpecific?.blockNumber?.toString()
      });

      // Emit completion event
      this.emit('batchCompleted', result);

      return result;

    } catch (error) {
      // Update metrics for failed batch
      this.metrics.totalBatches++;
      this.metrics.failedBatches++;
      this.metrics.failedOperations += operations.length;

      logger.error({
        batchId,
        error: error instanceof Error ? error.message : 'Unknown error',
        operationCount: operations.length
      }, 'Batch execution failed');

      // Return failed result
      return {
        batchId,
        operationResults: operations.map(op => ({
          operationId: op.id,
          success: false,
          error: error instanceof Error ? error : new Error('Unknown error'),
          executionTime: Date.now() - startTime
        })),
        totalGasUsed: BigInt(0),
        totalCostUSD: 0,
        executionTime: Date.now() - startTime,
        successRate: 0
      };
    }
  }

  /**
   * Execute a group of operations of the same type and client
   */
  private async executeOperationGroup(operations: BatchOperationViem[]): Promise<BatchResultViem['operationResults']> {
    const results: BatchResultViem['operationResults'] = [];

    // Execute operations with controlled concurrency
    const concurrency = Math.min(5, operations.length); // Max 5 concurrent operations

    for (let i = 0; i < operations.length; i += concurrency) {
      const chunk = operations.slice(i, i + concurrency);

      const chunkPromises = chunk.map(async (operation) => {
        const startTime = Date.now();
        operation.retryAttempts++;

        try {
          const result = await this.executeSingleOperation(operation);
          const executionTime = Date.now() - startTime;

          return {
            operationId: operation.id,
            success: true,
            result,
            gasUsed: result.gasUsed,
            transactionHash: result.transactionHash,
            blockNumber: result.blockNumber,
            blockHash: result.blockHash,
            logs: result.logs,
            executionTime,
            viemSpecific: {
              simulationResult: result.simulationResult,
              multicallResult: result.multicallResult,
              batchCallResult: result.batchCallResult
            }
          };

        } catch (error) {
          const executionTime = Date.now() - startTime;

          // Retry logic
          if (this.config.enableRetryLogic &&
              operation.retryAttempts < this.config.maxRetryAttempts &&
              this.shouldRetryOperation(error as Error)) {

            const retryDelay = this.config.retryDelay *
              Math.pow(this.config.retryBackoffMultiplier, operation.retryAttempts - 1);

            setTimeout(() => {
              // Re-queue for retry
              this.addToQueue(operation);
            }, retryDelay);

            return {
              operationId: operation.id,
              success: false,
              error: error instanceof Error ? error : new Error('Unknown error'),
              executionTime
            };
          }

          return {
            operationId: operation.id,
            success: false,
            error: error instanceof Error ? error : new Error('Unknown error'),
            executionTime
          };
        }
      });

      const chunkResults = await Promise.allSettled(chunkPromises);

      chunkResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      });
    }

    return results;
  }

  /**
   * Execute a single operation
   */
  private async executeSingleOperation(operation: BatchOperationViem): Promise<any> {
    const client = this.getOperationClient(operation);

    switch (operation.type) {
      case BatchOperationTypeViem.SWAP:
        return this.executeSwapOperation(operation, client);
      case BatchOperationTypeViem.LIQUIDITY_ADD:
        return this.executeLiquidityAddOperation(operation, client);
      case BatchOperationTypeViem.LIQUIDITY_REMOVE:
        return this.executeLiquidityRemoveOperation(operation, client);
      case BatchOperationTypeViem.APPROVE:
        return this.executeApproveOperation(operation, client);
      case BatchOperationTypeViem.CLAIM_REWARDS:
        return this.executeClaimRewardsOperation(operation, client);
      case BatchOperationTypeViem.STAKE:
        return this.executeStakeOperation(operation, client);
      case BatchOperationTypeViem.UNSTAKE:
        return this.executeUnstakeOperation(operation, client);
      case BatchOperationTypeViem.CUSTOM:
        return this.executeCustomOperation(operation, client);
      default:
        throw new Error(`Unsupported operation type: ${operation.type}`);
    }
  }

  /**
   * Execute swap operation
   */
  private async executeSwapOperation(operation: BatchOperationViem, client: any): Promise<any> {
    const { tokenIn, tokenOut, amountIn, recipient } = operation.data;

    // Get optimized gas price
    const gasPrice = await this.getOptimizedGasPrice(operation.maxGasPrice);
    const gasLimit = this.calculateGasLimit(operation, 200000); // Default for swaps

    // Use Viem's writeContract for token swap
    const writeParams: WriteContractParameters = {
      address: this.bscConfig.pancakeSwapRouter,
      abi: [/* PancakeSwap router ABI for swap */],
      functionName: 'swapExactTokensForTokens',
      args: [amountIn, 0, [tokenIn, tokenOut], recipient || operation.account, Date.now() + 1200000],
      gas: gasLimit,
      maxFeePerGas: operation.maxFeePerGas || gasPrice,
      maxPriorityFeePerGas: operation.maxPriorityFeePerGas,
      account: operation.account as Address
    };

    if (this.config.useSimulate) {
      const { request } = await this.publicClient.simulateContract(writeParams);
      const hash = await this.walletClient!.writeContract(request);
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      return {
        transactionHash: hash,
        gasUsed: receipt.gasUsed,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        logs: receipt.logs,
        simulationResult: true
      };
    }

    const hash = await (client as WalletClient).writeContract(writeParams);
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      transactionHash: hash,
      gasUsed: receipt.gasUsed,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      logs: receipt.logs
    };
  }

  /**
   * Execute liquidity add operation
   */
  private async executeLiquidityAddOperation(operation: BatchOperationViem, client: any): Promise<any> {
    const { tokenA, tokenB, amountA, amountB, to } = operation.data;

    const gasPrice = await this.getOptimizedGasPrice(operation.maxGasPrice);
    const gasLimit = this.calculateGasLimit(operation, 250000);

    const writeParams: WriteContractParameters = {
      address: this.bscConfig.pancakeSwapRouter,
      abi: [/* PancakeSwap router ABI for addLiquidity */],
      functionName: 'addLiquidity',
      args: [tokenA, tokenB, false, amountA, amountB, 0, 0, to || operation.account, Date.now() + 1200000],
      gas: gasLimit,
      maxFeePerGas: operation.maxFeePerGas || gasPrice,
      maxPriorityFeePerGas: operation.maxPriorityFeePerGas,
      account: operation.account as Address
    };

    const hash = await (client as WalletClient).writeContract(writeParams);
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      transactionHash: hash,
      gasUsed: receipt.gasUsed,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      logs: receipt.logs
    };
  }

  /**
   * Execute liquidity remove operation
   */
  private async executeLiquidityRemoveOperation(operation: BatchOperationViem, client: any): Promise<any> {
    const { tokenA, tokenB, liquidity, amountAMin, amountBMin, to } = operation.data;

    const gasPrice = await this.getOptimizedGasPrice(operation.maxGasPrice);
    const gasLimit = this.calculateGasLimit(operation, 200000);

    const writeParams: WriteContractParameters = {
      address: this.bscConfig.pancakeSwapRouter,
      abi: [/* PancakeSwap router ABI for removeLiquidity */],
      functionName: 'removeLiquidity',
      args: [tokenA, tokenB, false, liquidity, amountAMin || 0, amountBMin || 0, to || operation.account, Date.now() + 1200000],
      gas: gasLimit,
      maxFeePerGas: operation.maxFeePerGas || gasPrice,
      maxPriorityFeePerGas: operation.maxPriorityFeePerGas,
      account: operation.account as Address
    };

    const hash = await (client as WalletClient).writeContract(writeParams);
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      transactionHash: hash,
      gasUsed: receipt.gasUsed,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      logs: receipt.logs
    };
  }

  /**
   * Execute approve operation
   */
  private async executeApproveOperation(operation: BatchOperationViem, client: any): Promise<any> {
    const { token, spender, amount } = operation.data;

    const gasPrice = await this.getOptimizedGasPrice(operation.maxGasPrice);
    const gasLimit = this.calculateGasLimit(operation, 50000);

    const writeParams: WriteContractParameters = {
      address: token as Address,
      abi: [/* ERC20 ABI for approve */],
      functionName: 'approve',
      args: [spender as Address, amount || maxUint256],
      gas: gasLimit,
      maxFeePerGas: operation.maxFeePerGas || gasPrice,
      maxPriorityFeePerGas: operation.maxPriorityFeePerGas,
      account: operation.account as Address
    };

    const hash = await (client as WalletClient).writeContract(writeParams);
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      transactionHash: hash,
      gasUsed: receipt.gasUsed,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      logs: receipt.logs
    };
  }

  /**
   * Execute claim rewards operation
   */
  private async executeClaimRewardsOperation(operation: BatchOperationViem, client: any): Promise<any> {
    const { pid } = operation.data;

    const gasPrice = await this.getOptimizedGasPrice(operation.maxGasPrice);
    const gasLimit = this.calculateGasLimit(operation, 100000);

    const writeParams: WriteContractParameters = {
      address: this.bscConfig.masterChef,
      abi: [/* MasterChef ABI for harvest */],
      functionName: 'harvest',
      args: [pid, operation.account],
      gas: gasLimit,
      maxFeePerGas: operation.maxFeePerGas || gasPrice,
      maxPriorityFeePerGas: operation.maxPriorityFeePerGas,
      account: operation.account as Address
    };

    const hash = await (client as WalletClient).writeContract(writeParams);
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      transactionHash: hash,
      gasUsed: receipt.gasUsed,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      logs: receipt.logs
    };
  }

  /**
   * Execute stake operation
   */
  private async executeStakeOperation(operation: BatchOperationViem, client: any): Promise<any> {
    const { pid, amount } = operation.data;

    const gasPrice = await this.getOptimizedGasPrice(operation.maxGasPrice);
    const gasLimit = this.calculateGasLimit(operation, 150000);

    const writeParams: WriteContractParameters = {
      address: this.bscConfig.masterChef,
      abi: [/* MasterChef ABI for deposit */],
      functionName: 'deposit',
      args: [pid, amount],
      gas: gasLimit,
      maxFeePerGas: operation.maxFeePerGas || gasPrice,
      maxPriorityFeePerGas: operation.maxPriorityFeePerGas,
      account: operation.account as Address
    };

    const hash = await (client as WalletClient).writeContract(writeParams);
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      transactionHash: hash,
      gasUsed: receipt.gasUsed,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      logs: receipt.logs
    };
  }

  /**
   * Execute unstake operation
   */
  private async executeUnstakeOperation(operation: BatchOperationViem, client: any): Promise<any> {
    const { pid, amount } = operation.data;

    const gasPrice = await this.getOptimizedGasPrice(operation.maxGasPrice);
    const gasLimit = this.calculateGasLimit(operation, 150000);

    const writeParams: WriteContractParameters = {
      address: this.bscConfig.masterChef,
      abi: [/* MasterChef ABI for withdraw */],
      functionName: 'withdraw',
      args: [pid, amount],
      gas: gasLimit,
      maxFeePerGas: operation.maxFeePerGas || gasPrice,
      maxPriorityFeePerGas: operation.maxPriorityFeePerGas,
      account: operation.account as Address
    };

    const hash = await (client as WalletClient).writeContract(writeParams);
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      transactionHash: hash,
      gasUsed: receipt.gasUsed,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      logs: receipt.logs
    };
  }

  /**
   * Execute custom operation
   */
  private async executeCustomOperation(operation: BatchOperationViem, client: any): Promise<any> {
    const { to, data, gasLimit: customGasLimit } = operation.data;

    const gasPrice = await this.getOptimizedGasPrice(operation.maxGasPrice);
    const gasLimit = this.calculateGasLimit(operation, customGasLimit || 200000);

    const sendParams: SendTransactionParameters = {
      account: operation.account as Address,
      to: to as Address,
      data: data as `0x${string}`,
      gas: gasLimit,
      maxFeePerGas: operation.maxFeePerGas || gasPrice,
      maxPriorityFeePerGas: operation.maxPriorityFeePerGas
    };

    const hash = await (client as WalletClient).sendTransaction(sendParams);
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      transactionHash: hash,
      gasUsed: receipt.gasUsed,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      logs: receipt.logs
    };
  }

  /**
   * Optimize batch grouping with Viem and BSC optimizations
   */
  private optimizeBatchGrouping(operations: BatchOperationViem[]): BatchOperationViem[] {
    // Group operations by type for optimal execution
    const grouped: Map<BatchOperationTypeViem, BatchOperationViem[]> = new Map();

    for (const operation of operations) {
      if (!grouped.has(operation.type)) {
        grouped.set(operation.type, []);
      }
      grouped.get(operation.type)!.push(operation);
    }

    // Sort operations within each group by priority and client type
    for (const groupOps of grouped.values()) {
      groupOps.sort((a, b) => {
        // Priority first
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        // Then pancakeSwap optimization
        if (a.pancakeSwapOptimized !== b.pancakeSwapOptimized) {
          return b.pancakeSwapOptimized ? 1 : -1;
        }
        // Then client type
        if (a.clientType !== b.clientType) {
          const typeOrder = { 'wallet': 0, 'public': 1, 'custom': 2 };
          return (typeOrder[a.clientType!] || 99) - (typeOrder[b.clientType!] || 99);
        }
        return 0;
      });
    }

    // Flatten back to array while maintaining optimal ordering
    const optimized: BatchOperationViem[] = [];
    const typeOrder = [
      BatchOperationTypeViem.APPROVE, // Approvals first
      BatchOperationTypeViem.SWAP, // Then swaps
      BatchOperationTypeViem.LIQUIDITY_ADD, // Then liquidity operations
      BatchOperationTypeViem.STAKE,
      BatchOperationTypeViem.CLAIM_REWARDS,
      BatchOperationTypeViem.UNSTAKE,
      BatchOperationTypeViem.LIQUIDITY_REMOVE,
      BatchOperationTypeViem.CUSTOM
    ];

    for (const type of typeOrder) {
      const groupOps = grouped.get(type);
      if (groupOps) {
        optimized.push(...groupOps);
      }
    }

    return optimized;
  }

  /**
   * Resolve operation dependencies
   */
  private resolveDependencies(operations: BatchOperationViem[]): BatchOperationViem[] {
    if (!this.config.enableDependencyResolution || operations.length === 0) {
      return operations;
    }

    const resolved: BatchOperationViem[] = [];
    const processed = new Set<string>();
    const processing = new Set<string>();

    // Topological sort based on dependencies
    const resolveOperation = (op: BatchOperationViem): boolean => {
      if (processed.has(op.id)) {
        return true;
      }

      if (processing.has(op.id)) {
        // Circular dependency detected
        logger.warn('Circular dependency detected', { operationId: op.id });
        return false;
      }

      processing.add(op.id);

      // Resolve dependencies first
      if (op.dependencies) {
        for (const depId of op.dependencies) {
          const depOp = operations.find(o => o.id === depId);
          if (depOp && !resolveOperation(depOp)) {
            return false;
          }
        }
      }

      processing.delete(op.id);
      processed.add(op.id);
      resolved.push(op);
      return true;
    };

    for (const operation of operations) {
      resolveOperation(operation);
    }

    return resolved;
  }

  /**
   * Group operations by type and client for optimal execution
   */
  private groupOperationsByTypeAndClient(operations: BatchOperationViem[]): Map<string, BatchOperationViem[]> {
    const grouped = new Map<string, BatchOperationViem[]>();

    for (const operation of operations) {
      const groupKey = `${operation.type}_${operation.clientType}_${operation.pancakeSwapOptimized ? 'ps' : 'regular'}`;

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey)!.push(operation);
    }

    return grouped;
  }

  /**
   * Get types present in batch
   */
  private getBatchTypes(operations: BatchOperationViem[]): string[] {
    const types = new Set<BatchOperationTypeViem>();
    operations.forEach(op => types.add(op.type));
    return Array.from(types);
  }

  /**
   * Get optimized gas price
   */
  private async getOptimizedGasPrice(maxGasPrice?: bigint): Promise<bigint> {
    try {
      const feeData = await this.publicClient.getFeeData();
      let gasPrice = feeData.gasPrice || BigInt('5000000000'); // 5 gwei default

      // Apply buffer
      gasPrice = (gasPrice * BigInt(Math.floor(this.config.gasPriceBuffer * 100))) / BigInt(100);

      // Apply max limit
      if (maxGasPrice) {
        if (gasPrice > maxGasPrice) {
          gasPrice = maxGasPrice;
        }
      }

      this.currentGasPrice = gasPrice;
      return gasPrice;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get gas price');
      return this.currentGasPrice || BigInt('5000000000');
    }
  }

  /**
   * Calculate gas limit with buffer
   */
  private calculateGasLimit(operation: BatchOperationViem, defaultLimit: number): bigint {
    if (operation.gasLimit) {
      const buffer = BigInt(Math.floor(this.config.gasLimitBuffer * 100));
      return (operation.gasLimit * buffer) / BigInt(100);
    }

    return BigInt(defaultLimit);
  }

  /**
   * Calculate gas cost in USD
   */
  private calculateGasCostUSD(gasUsed: bigint): number {
    const gasPrice = this.currentGasPrice || BigInt('5000000000');
    const gasCostBNB = (gasUsed * gasPrice) / BigInt('1000000000000000000'); // Convert to BNB
    return Number(gasCostBNB) * this.bnbPrice;
  }

  /**
   * Check if operation should be retried
   */
  private shouldRetryOperation(error: Error): boolean {
    const message = error.message.toLowerCase();
    const retryableErrors = [
      'timeout',
      'network error',
      'underpriced',
      'replacement transaction underpriced',
      'nonce too low',
      'nonce too high',
      'gas required exceeds allowance',
      'transaction underpriced'
    ];

    return retryableErrors.some(retryableError => message.includes(retryableError));
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.updateMetrics();
    }, this.config.metricsInterval);
  }

  /**
   * Update and report metrics
   */
  private updateMetrics(): void {
    const metrics = this.getMetrics();

    logger.info('Batch Processor Metrics (Viem)', {
      totalBatches: metrics.totalBatches,
      successfulBatches: metrics.successfulBatches,
      failedBatches: metrics.failedBatches,
      successRate: (metrics.efficiency * 100).toFixed(2) + '%',
      throughput: metrics.throughput.toFixed(2) + ' ops/sec',
      averageBatchSize: metrics.averageBatchSize.toFixed(1),
      averageExecutionTime: metrics.averageExecutionTime.toFixed(2) + 'ms',
      averageGasUsed: metrics.averageGasUsed.toString(),
      averageCostUSD: metrics.averageCostUSD.toFixed(4),
      viemOptimizations: {
        simulationSuccessRate: (metrics.viemSpecific.simulationSuccessRate * 100).toFixed(2) + '%',
        multicallOptimization: metrics.viemSpecific.multicallOptimization.toFixed(2) + '%',
        batchCallSavings: metrics.viemSpecific.batchCallSavings.toFixed(2) + '%'
      },
      bscSpecific: {
        totalBnbSpent: formatEther(metrics.bscSpecific.totalBnbSpent) + ' BNB',
        averageGasPrice: formatEther(metrics.bscSpecific.averageGasPrice) + ' BNB',
        pancakeSwapOptimizations: metrics.bscSpecific.pancakeSwapOptimizations
      }
    });

    // Check for performance alerts
    if (this.config.enablePerformanceAlerts) {
      this.checkPerformanceAlerts(metrics);
    }

    // Emit metrics event
    this.emit('metrics', metrics);
  }

  /**
   * Check for performance alerts
   */
  private checkPerformanceAlerts(metrics: BatchMetricsViem): void {
    // Low efficiency alert
    if (metrics.efficiency < 0.8) { // 80% success rate
      this.emit('alert', {
        type: 'low_efficiency',
        value: metrics.efficiency,
        threshold: 0.8,
        message: `Low batch efficiency: ${(metrics.efficiency * 100).toFixed(2)}%`
      });
    }

    // Low throughput alert
    if (metrics.throughput < 1) { // Less than 1 op/sec
      this.emit('alert', {
        type: 'low_throughput',
        value: metrics.throughput,
        threshold: 1,
        message: `Low batch throughput: ${metrics.throughput.toFixed(2)} ops/sec`
      });
    }

    // High execution time alert
    if (metrics.averageExecutionTime > 30000) { // More than 30 seconds
      this.emit('alert', {
        type: 'slow_execution',
        value: metrics.averageExecutionTime,
        threshold: 30000,
        message: `Slow batch execution: ${metrics.averageExecutionTime.toFixed(0)}ms`
      });
    }
  }

  /**
   * Start gas price monitoring
   */
  private startGasPriceMonitoring(): void {
    // Update gas price periodically
    setInterval(async () => {
      try {
        const feeData = await this.publicClient.getFeeData();
        if (feeData.gasPrice) {
          this.currentGasPrice = feeData.gasPrice;

          // Update peak gas price
          if (feeData.gasPrice > this.metrics.bscSpecific.peakGasPrice) {
            this.metrics.bscSpecific.peakGasPrice = feeData.gasPrice;
          }

          // Update average gas price
          this.metrics.bscSpecific.averageGasPrice =
            (this.metrics.bscSpecific.averageGasPrice + feeData.gasPrice) / BigInt(2);
        }
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to update gas price');
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Start BSC-specific monitoring
   */
  private startBscMonitoring(): void {
    // Update BNB price periodically (in a real implementation, you'd fetch from an oracle)
    setInterval(async () => {
      try {
        // Placeholder for BNB price fetching
        // this.bnbPrice = await fetchBNBPrice();
        this.bnbPrice = 300; // Default

        // Update network utilization
        const block = await this.publicClient.getBlock();
        if (block) {
          // Simple network utilization calculation
          const gasLimit = block.gasLimit;
          const gasUsed = block.gasUsed;
          this.networkUtilization = Number((gasUsed * BigInt(100)) / gasLimit);

          // Update network utilization average
          this.metrics.bscSpecific.networkUtilizationAverage =
            (this.metrics.bscSpecific.networkUtilizationAverage + this.networkUtilization) / 2;
        }
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to update BSC monitoring');
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Generate operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): {
    pendingOperations: number;
    processingBatches: number;
    queueLength: number;
    bscSpecific: {
      currentGasPrice: string;
      networkUtilization: number;
      bnbPrice: number;
    };
  } {
    return {
      pendingOperations: this.pendingOperations.size,
      processingBatches: this.processingBatches.size,
      queueLength: this.operationQueue.length,
      bscSpecific: {
        currentGasPrice: this.currentGasPrice.toString(),
        networkUtilization: this.networkUtilization,
        bnbPrice: this.bnbPrice
      }
    };
  }

  /**
   * Clear all pending operations
   */
  clearPending(): number {
    const count = this.pendingOperations.size;
    this.pendingOperations.clear();
    this.operationQueue = [];
    this.processingBatches.clear();
    this.completedOperations.clear();
    return count;
  }

  /**
   * Shutdown batch processor
   */
  shutdown(): void {
    // Clear timers
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }

    // Clear all data
    this.clearPending();

    logger.info('Advanced Batch Processor (Viem) shutdown completed');
  }
}

// Export singleton instance factory
export function createAdvancedBatchProcessorViem(
  publicClient: PublicClient<Transport, Chain>,
  config?: Partial<BatchProcessorConfigViem>,
  bscConfig?: Partial<BscBatchConfig>,
  walletClient?: WalletClient<Transport, Chain, Account>
): AdvancedBatchProcessorViem {
  return new AdvancedBatchProcessorViem(publicClient, config, bscConfig, walletClient);
}