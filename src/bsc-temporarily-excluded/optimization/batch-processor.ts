/**
 * Advanced Batch Processor for BSC Operations
 * High-performance batch processing with intelligent grouping and optimization
 */

import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import logger from '../../../utils/logger.js';

/**
 * Batch operation types
 */
export enum BatchOperationType {
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
 * Batch operation configuration
 */
export interface BatchOperation {
  id: string;
  type: BatchOperationType;
  data: any;
  priority: number;
  dependencies?: string[]; // Operation IDs that must complete first
  maxGasPrice?: string;
  gasLimit?: string;
  metadata?: Record<string, any>;
  timeout?: number;
  retryAttempts?: number;
  createdAt: number;
}

/**
 * Batch processing configuration
 */
export interface BatchProcessorConfig {
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
}

/**
 * Batch execution result
 */
export interface BatchResult {
  batchId: string;
  operationResults: Array<{
    operationId: string;
    success: boolean;
    result?: any;
    error?: Error;
    gasUsed?: string;
    transactionHash?: string;
    executionTime: number;
  }>;
  totalGasUsed: string;
  totalCostUSD: number;
  executionTime: number;
  successRate: number;
}

/**
 * Batch processing metrics
 */
export interface BatchMetrics {
  totalBatches: number;
  successfulBatches: number;
  failedBatches: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageBatchSize: number;
  averageExecutionTime: number;
  averageGasUsed: string;
  averageCostUSD: number;
  throughput: number; // operations per second
  efficiency: number;
  gasOptimizationSavings: number;
}

/**
 * Batch group for optimization
 */
interface BatchGroup {
  type: BatchOperationType;
  operations: BatchOperation[];
  priority: number;
  estimatedGasCost: string;
  createdAt: number;
}

/**
 * Advanced Batch Processor
 */
export class AdvancedBatchProcessor extends EventEmitter {
  private config: BatchProcessorConfig;
  private signer: ethers.Signer;
  private provider: ethers.JsonRpcProvider;

  // Queues and processing
  private pendingOperations: Map<string, BatchOperation> = new Map();
  private operationQueue: BatchOperation[] = [];
  private processingBatches: Map<string, BatchOperation[]> = new Map();
  private completedOperations: Map<string, any> = new Map();

  // Metrics
  private metrics: BatchMetrics = {
    totalBatches: 0,
    successfulBatches: 0,
    failedBatches: 0,
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageBatchSize: 0,
    averageExecutionTime: 0,
    averageGasUsed: '0',
    averageCostUSD: 0,
    throughput: 0,
    efficiency: 0,
    gasOptimizationSavings: 0
  };

  // Timers and intervals
  private batchTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;

  // Network and gas optimization
  private currentGasPrice: string = '0';
  private bnbPrice: number = 300; // Default BNB price in USD

  constructor(
    signer: ethers.Signer,
    provider: ethers.JsonRpcProvider,
    config: Partial<BatchProcessorConfig> = {}
  ) {
    super();
    this.signer = signer;
    this.provider = provider;

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

    logger.info('Advanced Batch Processor initialized', {
      maxBatchSize: this.config.maxBatchSize,
      maxConcurrentBatches: this.config.maxConcurrentBatches,
      optimizationEnabled: this.config.enableOptimalGrouping
    });
  }

  /**
   * Submit operation for batch processing
   */
  async submitOperation(
    type: BatchOperationType,
    data: any,
    options: {
      priority?: number;
      dependencies?: string[];
      maxGasPrice?: string;
      gasLimit?: string;
      metadata?: Record<string, any>;
      timeout?: number;
    } = {}
  ): Promise<string> {
    const operationId = this.generateOperationId();
    const now = Date.now();

    const operation: BatchOperation = {
      id: operationId,
      type,
      data,
      priority: options.priority || 0,
      dependencies: options.dependencies,
      maxGasPrice: options.maxGasPrice,
      gasLimit: options.gasLimit,
      metadata: options.metadata,
      timeout: options.timeout || this.config.operationTimeout,
      retryAttempts: 0,
      createdAt: now
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
      queueSize: this.operationQueue.length
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
      type: BatchOperationType;
      data: any;
      priority?: number;
      dependencies?: string[];
      metadata?: Record<string, any>;
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

      const operation: BatchOperation = {
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
        createdAt: now
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
  getMetrics(): BatchMetrics {
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
  private addToQueue(operation: BatchOperation): void {
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

    if (batchOperations.length === 0) return;

    const batchId = this.generateBatchId();
    this.processingBatches.set(batchId, batchOperations);

    logger.info('Processing batch', {
      batchId,
      operationCount: batchOperations.length,
      types: this.getBatchTypes(batchOperations)
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
   * Execute a batch of operations
   */
  private async executeBatch(batchId: string, operations: BatchOperation[]): Promise<BatchResult> {
    const startTime = Date.now();
    const results: BatchResult['operationResults'] = [];
    let totalGasUsed = BigInt(0);

    try {
      // Group operations by type for optimal execution
      const groupedOps = this.groupOperationsByType(operations);

      for (const [type, ops] of groupedOps.entries()) {
        const groupResults = await this.executeOperationGroup(type, ops);
        results.push(...groupResults);

        // Sum gas used
        groupResults.forEach(result => {
          if (result.gasUsed) {
            totalGasUsed += BigInt(result.gasUsed);
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
      this.metrics.averageGasUsed = totalGasUsed.toString();

      const result: BatchResult = {
        batchId,
        operationResults: results,
        totalGasUsed: totalGasUsed.toString(),
        totalCostUSD,
        executionTime,
        successRate: successfulCount / results.length
      };

      // Store results for completed operations
      results.forEach(result => {
        this.completedOperations.set(result.operationId, result.success ? result.result : result.error);
      });

      logger.info('Batch execution completed', {
        batchId,
        successful: successfulCount,
        failed: results.length - successfulCount,
        totalGasUsed: result.totalGasUsed,
        totalCostUSD: result.totalCostUSD,
        executionTime: result.executionTime,
        successRate: (result.successRate * 100).toFixed(2) + '%'
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
        totalGasUsed: '0',
        totalCostUSD: 0,
        executionTime: Date.now() - startTime,
        successRate: 0
      };
    }
  }

  /**
   * Execute a group of operations of the same type
   */
  private async executeOperationGroup(
    type: BatchOperationType,
    operations: BatchOperation[]
  ): Promise<BatchResult['operationResults']> {
    const results: BatchResult['operationResults'] = [];

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
            executionTime
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
  private async executeSingleOperation(operation: BatchOperation): Promise<any> {
    switch (operation.type) {
      case BatchOperationType.SWAP:
        return this.executeSwapOperation(operation);
      case BatchOperationType.LIQUIDITY_ADD:
        return this.executeLiquidityAddOperation(operation);
      case BatchOperationType.LIQUIDITY_REMOVE:
        return this.executeLiquidityRemoveOperation(operation);
      case BatchOperationType.APPROVE:
        return this.executeApproveOperation(operation);
      case BatchOperationType.CLAIM_REWARDS:
        return this.executeClaimRewardsOperation(operation);
      case BatchOperationType.STAKE:
        return this.executeStakeOperation(operation);
      case BatchOperationType.UNSTAKE:
        return this.executeUnstakeOperation(operation);
      case BatchOperationType.CUSTOM:
        return this.executeCustomOperation(operation);
      default:
        throw new Error(`Unsupported operation type: ${operation.type}`);
    }
  }

  /**
   * Execute swap operation
   */
  private async executeSwapOperation(operation: BatchOperation): Promise<any> {
    // Implementation would depend on your swap service
    // This is a placeholder for the actual implementation
    const { tokenIn, tokenOut, amountIn, recipient } = operation.data;

    // Get optimized gas price
    const gasPrice = await this.getOptimizedGasPrice(operation.maxGasPrice);
    const gasLimit = this.calculateGasLimit(operation, 200000); // Default for swaps

    // Execute swap
    const tx = await this.signer.sendTransaction({
      to: '0x10ed43c718714eb63d5aa57b78b54704e256024e', // PancakeSwap Router
      data: '0x38ed1739', // swapExactTokensForTokens selector
      gasLimit,
      gasPrice,
      value: tokenIn === '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' ? amountIn : '0',
      // ... other transaction parameters
    });

    const receipt = await tx.wait(1);

    return {
      transactionHash: tx.hash,
      gasUsed: receipt.gasUsed?.toString() || '0',
      // ... other result data
    };
  }

  /**
   * Execute liquidity add operation
   */
  private async executeLiquidityAddOperation(operation: BatchOperation): Promise<any> {
    // Placeholder implementation
    const tx = await this.signer.sendTransaction({
      to: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
      data: '0xe8e33700', // addLiquidity selector
      gasLimit: this.calculateGasLimit(operation, 250000),
      gasPrice: await this.getOptimizedGasPrice(operation.maxGasPrice)
    });

    const receipt = await tx.wait(1);

    return {
      transactionHash: tx.hash,
      gasUsed: receipt.gasUsed?.toString() || '0'
    };
  }

  /**
   * Execute liquidity remove operation
   */
  private async executeLiquidityRemoveOperation(operation: BatchOperation): Promise<any> {
    // Placeholder implementation
    const tx = await this.signer.sendTransaction({
      to: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
      data: '0xbaa2abde', // removeLiquidity selector
      gasLimit: this.calculateGasLimit(operation, 200000),
      gasPrice: await this.getOptimizedGasPrice(operation.maxGasPrice)
    });

    const receipt = await tx.wait(1);

    return {
      transactionHash: tx.hash,
      gasUsed: receipt.gasUsed?.toString() || '0'
    };
  }

  /**
   * Execute approve operation
   */
  private async executeApproveOperation(operation: BatchOperation): Promise<any> {
    // Placeholder implementation
    const { token, spender, amount } = operation.data;

    const tx = await this.signer.sendTransaction({
      to: token,
      data: '0x095ea7b3', // approve selector
      args: [spender, amount],
      gasLimit: this.calculateGasLimit(operation, 50000),
      gasPrice: await this.getOptimizedGasPrice(operation.maxGasPrice)
    });

    const receipt = await tx.wait(1);

    return {
      transactionHash: tx.hash,
      gasUsed: receipt.gasUsed?.toString() || '0'
    };
  }

  /**
   * Execute claim rewards operation
   */
  private async executeClaimRewardsOperation(operation: BatchOperation): Promise<any> {
    // Placeholder implementation
    const tx = await this.signer.sendTransaction({
      to: '0x73feaa1eE314F8c655E354234017bE2193C9E24E', // MasterChef
      data: '0x3d18d036', // harvest selector
      gasLimit: this.calculateGasLimit(operation, 100000),
      gasPrice: await this.getOptimizedGasPrice(operation.maxGasPrice)
    });

    const receipt = await tx.wait(1);

    return {
      transactionHash: tx.hash,
      gasUsed: receipt.gasUsed?.toString() || '0'
    };
  }

  /**
   * Execute stake operation
   */
  private async executeStakeOperation(operation: BatchOperation): Promise<any> {
    // Placeholder implementation
    const { pid, amount } = operation.data;

    const tx = await this.signer.sendTransaction({
      to: '0x73feaa1eE314F8c655E354234017bE2193C9E24E',
      data: '0x441a3e70', // deposit selector
      args: [pid, amount],
      gasLimit: this.calculateGasLimit(operation, 150000),
      gasPrice: await this.getOptimizedGasPrice(operation.maxGasPrice)
    });

    const receipt = await tx.wait(1);

    return {
      transactionHash: tx.hash,
      gasUsed: receipt.gasUsed?.toString() || '0'
    };
  }

  /**
   * Execute unstake operation
   */
  private async executeUnstakeOperation(operation: BatchOperation): Promise<any> {
    // Placeholder implementation
    const { pid, amount } = operation.data;

    const tx = await this.signer.sendTransaction({
      to: '0x73feaa1eE314F8c655E354234017bE2193C9E24E',
      data: '0x441a3e70', // withdraw selector
      args: [pid, amount],
      gasLimit: this.calculateGasLimit(operation, 150000),
      gasPrice: await this.getOptimizedGasPrice(operation.maxGasPrice)
    });

    const receipt = await tx.wait(1);

    return {
      transactionHash: tx.hash,
      gasUsed: receipt.gasUsed?.toString() || '0'
    };
  }

  /**
   * Execute custom operation
   */
  private async executeCustomOperation(operation: BatchOperation): Promise<any> {
    const { to, data, gasLimit: customGasLimit } = operation.data;

    const tx = await this.signer.sendTransaction({
      to,
      data,
      gasLimit: this.calculateGasLimit(operation, customGasLimit || 200000),
      gasPrice: await this.getOptimizedGasPrice(operation.maxGasPrice)
    });

    const receipt = await tx.wait(1);

    return {
      transactionHash: tx.hash,
      gasUsed: receipt.gasUsed?.toString() || '0'
    };
  }

  /**
   * Optimize batch grouping
   */
  private optimizeBatchGrouping(operations: BatchOperation[]): BatchOperation[] {
    // Group operations by type for optimal execution
    const grouped: Map<BatchOperationType, BatchOperation[]> = new Map();

    for (const operation of operations) {
      if (!grouped.has(operation.type)) {
        grouped.set(operation.type, []);
      }
      grouped.get(operation.type)!.push(operation);
    }

    // Sort operations within each group by priority
    for (const groupOps of grouped.values()) {
      groupOps.sort((a, b) => b.priority - a.priority);
    }

    // Flatten back to array while maintaining optimal ordering
    const optimized: BatchOperation[] = [];
    const typeOrder = [
      BatchOperationType.APPROVE, // Approvals first
      BatchOperationType.SWAP, // Then swaps
      BatchOperationType.LIQUIDITY_ADD, // Then liquidity operations
      BatchOperationType.STAKE,
      BatchOperationType.CLAIM_REWARDS,
      BatchOperationType.UNSTAKE,
      BatchOperationType.LIQUIDITY_REMOVE,
      BatchOperationType.CUSTOM
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
  private resolveDependencies(operations: BatchOperation[]): BatchOperation[] {
    if (!this.config.enableDependencyResolution || operations.length === 0) {
      return operations;
    }

    const resolved: BatchOperation[] = [];
    const processed = new Set<string>();
    const processing = new Set<string>();

    // Topological sort based on dependencies
    const resolveOperation = (op: BatchOperation): boolean => {
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
   * Group operations by type
   */
  private groupOperationsByType(operations: BatchOperation[]): Map<BatchOperationType, BatchOperation[]> {
    const grouped = new Map<BatchOperationType, BatchOperation[]>();

    for (const operation of operations) {
      if (!grouped.has(operation.type)) {
        grouped.set(operation.type, []);
      }
      grouped.get(operation.type)!.push(operation);
    }

    return grouped;
  }

  /**
   * Get types present in batch
   */
  private getBatchTypes(operations: BatchOperation[]): string[] {
    const types = new Set<BatchOperationType>();
    operations.forEach(op => types.add(op.type));
    return Array.from(types);
  }

  /**
   * Get optimized gas price
   */
  private async getOptimizedGasPrice(maxGasPrice?: string): Promise<string> {
    try {
      const feeData = await this.provider.getFeeData();
      let gasPrice = feeData.gasPrice || BigInt('5000000000'); // 5 gwei default

      // Apply buffer
      gasPrice = (gasPrice * BigInt(Math.floor(this.config.gasPriceBuffer * 100))) / BigInt(100);

      // Apply max limit
      if (maxGasPrice) {
        const maxPrice = BigInt(maxGasPrice);
        if (gasPrice > maxPrice) {
          gasPrice = maxPrice;
        }
      }

      this.currentGasPrice = gasPrice.toString();
      return this.currentGasPrice;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get gas price');
      return this.currentGasPrice || '5000000000';
    }
  }

  /**
   * Calculate gas limit with buffer
   */
  private calculateGasLimit(operation: BatchOperation, defaultLimit: number): string {
    if (operation.gasLimit) {
      const buffer = BigInt(Math.floor(this.config.gasLimitBuffer * 100));
      return (BigInt(operation.gasLimit) * buffer) / BigInt(100);
    }

    return defaultLimit.toString();
  }

  /**
   * Calculate gas cost in USD
   */
  private calculateGasCostUSD(gasUsed: bigint): number {
    const gasPrice = BigInt(this.currentGasPrice || '5000000000');
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
      'nonce too high'
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

    logger.info('Batch Processor Metrics', {
      totalBatches: metrics.totalBatches,
      successfulBatches: metrics.successfulBatches,
      failedBatches: metrics.failedBatches,
      successRate: (metrics.efficiency * 100).toFixed(2) + '%',
      throughput: metrics.throughput.toFixed(2) + ' ops/sec',
      averageBatchSize: metrics.averageBatchSize.toFixed(1),
      averageExecutionTime: metrics.averageExecutionTime.toFixed(2) + 'ms',
      averageGasUsed: metrics.averageGasUsed,
      averageCostUSD: metrics.averageCostUSD.toFixed(4)
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
  private checkPerformanceAlerts(metrics: BatchMetrics): void {
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
    // Update BNB price periodically (in a real implementation, you'd fetch from an oracle)
    setInterval(async () => {
      try {
        // Placeholder for BNB price fetching
        // this.bnbPrice = await fetchBNBPrice();
        this.bnbPrice = 300; // Default
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to update BNB price');
      }
    }, 60000); // Every minute
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
  } {
    return {
      pendingOperations: this.pendingOperations.size,
      processingBatches: this.processingBatches.size,
      queueLength: this.operationQueue.length
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

    logger.info('Advanced Batch Processor shutdown completed');
  }
}

// Export singleton instance factory
export function createAdvancedBatchProcessor(
  signer: ethers.Signer,
  provider: ethers.JsonRpcProvider,
  config?: Partial<BatchProcessorConfig>
): AdvancedBatchProcessor {
  return new AdvancedBatchProcessor(signer, provider, config);
}