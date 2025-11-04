/**
 * BSC Transaction Optimizer
 * Advanced transaction handling with performance optimizations for BSC network
 */

import { ethers } from 'ethers';
import logger from '../../../utils/logger.js';
import { EventEmitter } from 'events';

/**
 * Transaction optimization configuration
 */
export interface TransactionOptimizationConfig {
  // Batch processing
  batchSize: number;
  batchTimeout: number; // milliseconds
  maxBatchWaitTime: number;

  // Gas optimization
  gasPriceMultiplier: number;
  maxGasPriceGwei: number;
  dynamicGasAdjustment: boolean;
  gasPriceHistorySize: number;

  // Transaction pooling
  maxPendingTransactions: number;
  transactionTimeout: number;
  retryAttempts: number;
  retryDelay: number;

  // Performance monitoring
  enableMetrics: boolean;
  metricsInterval: number;
  performanceAlerts: boolean;

  // Network optimization
  enableFastLane: boolean;
  preferPrivateMempool: boolean;
  mempoolTimeout: number;
}

/**
 * Transaction pool entry
 */
export interface PooledTransaction {
  id: string;
  transaction: ethers.TransactionRequest;
  priority: number;
  attempts: number;
  createdAt: number;
  lastAttempt: number;
  nextRetry: number;
  deadline: number;
  callback?: (hash: string, error?: Error) => void;
  metadata?: Record<string, any>;
}

/**
 * Batch transaction group
 */
export interface TransactionBatch {
  id: string;
  transactions: PooledTransaction[];
  createdAt: number;
  maxWaitTime: number;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

/**
 * Performance metrics
 */
export interface TransactionMetrics {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  averageConfirmationTime: number;
  averageGasPrice: number;
  gasOptimizationSavings: number;
  batchEfficiency: number;
  throughput: number; // transactions per second
  errorRate: number;
  pendingTransactions: number;
}

/**
 * BSC Transaction Optimizer
 * Optimizes transaction handling for maximum performance on BSC
 */
export class BSCTransactionOptimizer extends EventEmitter {
  private config: TransactionOptimizationConfig;
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Signer;

  // Transaction management
  private pendingTransactions: Map<string, PooledTransaction> = new Map();
  private transactionQueue: PooledTransaction[] = [];
  private batchQueue: TransactionBatch[] = [];
  private processingBatches: Set<string> = new Set();

  // Gas optimization
  private gasPriceHistory: Array<{ timestamp: number; gasPrice: bigint }> = [];
  private networkStats: {
    averageBlockTime: number;
    averageGasPrice: bigint;
    congestionLevel: number;
  } = {
    averageBlockTime: 3000, // 3 seconds for BSC
    averageGasPrice: BigInt('5000000000'), // 5 gwei
    congestionLevel: 0.5
  };

  // Performance metrics
  private metrics: TransactionMetrics = {
    totalTransactions: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
    averageConfirmationTime: 0,
    averageGasPrice: 0,
    gasOptimizationSavings: 0,
    batchEfficiency: 0,
    throughput: 0,
    errorRate: 0,
    pendingTransactions: 0
  };

  // Timers and intervals
  private batchTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;
  private networkMonitorTimer: NodeJS.Timeout | null = null;

  constructor(
    provider: ethers.JsonRpcProvider,
    signer: ethers.Signer,
    config: Partial<TransactionOptimizationConfig> = {}
  ) {
    super();
    this.provider = provider;
    this.signer = signer;

    this.config = {
      batchSize: 10,
      batchTimeout: 1000, // 1 second
      maxBatchWaitTime: 5000, // 5 seconds max wait
      gasPriceMultiplier: 1.1,
      maxGasPriceGwei: 100,
      dynamicGasAdjustment: true,
      gasPriceHistorySize: 100,
      maxPendingTransactions: 1000,
      transactionTimeout: 60000, // 1 minute
      retryAttempts: 3,
      retryDelay: 2000, // 2 seconds
      enableMetrics: true,
      metricsInterval: 30000, // 30 seconds
      performanceAlerts: true,
      enableFastLane: true,
      preferPrivateMempool: false,
      mempoolTimeout: 10000, // 10 seconds
      ...config
    };

    this.initializeOptimizers();
  }

  /**
   * Initialize optimization systems
   */
  private initializeOptimizers(): void {
    // Start batch processing
    this.startBatchProcessor();

    // Start metrics collection
    if (this.config.enableMetrics) {
      this.startMetricsCollection();
    }

    // Start network monitoring
    this.startNetworkMonitoring();

    logger.info('BSC Transaction Optimizer initialized', {
      batchSize: this.config.batchSize,
      gasOptimization: this.config.dynamicGasAdjustment,
      fastLane: this.config.enableFastLane
    });
  }

  /**
   * Submit transaction for optimized processing
   */
  async submitTransaction(
    transaction: ethers.TransactionRequest,
    options: {
      priority?: number;
      callback?: (hash: string, error?: Error) => void;
      metadata?: Record<string, any>;
      deadline?: number;
    } = {}
  ): Promise<string> {
    const id = this.generateTransactionId();
    const now = Date.now();

    const pooledTx: PooledTransaction = {
      id,
      transaction: this.optimizeTransaction(transaction),
      priority: options.priority || 0,
      attempts: 0,
      createdAt: now,
      lastAttempt: 0,
      nextRetry: now,
      deadline: options.deadline || now + this.config.transactionTimeout,
      callback: options.callback,
      metadata: options.metadata
    };

    // Add to queue
    this.addToQueue(pooledTx);

    // Update metrics
    this.metrics.totalTransactions++;
    this.metrics.pendingTransactions++;

    logger.debug('Transaction submitted for optimization', {
      id,
      priority: pooledTx.priority,
      queueSize: this.transactionQueue.length
    });

    // Trigger batch processing if needed
    this.processBatch();

    return id;
  }

  /**
   * Submit multiple transactions as a batch
   */
  async submitBatch(
    transactions: Array<{
      transaction: ethers.TransactionRequest;
      priority?: number;
      callback?: (hash: string, error?: Error) => void;
      metadata?: Record<string, any>;
    }>
  ): Promise<string[]> {
    const batchId = this.generateBatchId();
    const now = Date.now();

    // Optimize gas price for the entire batch
    const optimizedGasPrice = await this.getOptimizedGasPrice();

    const pooledTransactions: PooledTransaction[] = transactions.map((tx, index) => ({
      id: `${batchId}-${index}`,
      transaction: this.optimizeTransaction({
        ...tx.transaction,
        gasPrice: optimizedGasPrice.gasPrice,
        maxFeePerGas: optimizedGasPrice.maxFeePerGas,
        maxPriorityFeePerGas: optimizedGasPrice.maxPriorityFeePerGas
      }),
      priority: tx.priority || 0,
      attempts: 0,
      createdAt: now,
      lastAttempt: 0,
      nextRetry: now,
      deadline: now + this.config.transactionTimeout,
      callback: tx.callback,
      metadata: { ...tx.metadata, batchId, batchIndex: index }
    }));

    // Create batch
    const batch: TransactionBatch = {
      id: batchId,
      transactions: pooledTransactions,
      createdAt: now,
      maxWaitTime: this.config.maxBatchWaitTime,
      gasPrice: optimizedGasPrice.gasPrice,
      maxFeePerGas: optimizedGasPrice.maxFeePerGas,
      maxPriorityFeePerGas: optimizedGasPrice.maxPriorityFeePerGas
    };

    this.batchQueue.push(batch);
    this.transactionQueue.push(...pooledTransactions);

    // Update metrics
    this.metrics.totalTransactions += pooledTransactions.length;
    this.metrics.pendingTransactions += pooledTransactions.length;

    logger.info('Batch submitted for optimization', {
      batchId,
      transactionCount: pooledTransactions.length,
      gasPrice: optimizedGasPrice.gasPrice
    });

    // Process immediately
    await this.processBatch();

    return pooledTransactions.map(tx => tx.id);
  }

  /**
   * Optimize individual transaction
   */
  private optimizeTransaction(transaction: ethers.TransactionRequest): ethers.TransactionRequest {
    const optimized = { ...transaction };

    // Optimize gas limit if not set
    if (!optimized.gasLimit) {
      optimized.gasLimit = this.getOptimizedGasLimit(transaction);
    }

    // Optimize nonce if not set
    if (!optimized.nonce) {
      // Will be set by signer
    }

    // BSC-specific optimizations
    if (this.config.enableFastLane) {
      optimized = this.applyFastLaneOptimizations(optimized);
    }

    return optimized;
  }

  /**
   * Get optimized gas price based on network conditions
   */
  private async getOptimizedGasPrice(): Promise<{
    gasPrice: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  }> {
    try {
      const feeData = await this.provider.getFeeData();

      // Use EIP-1559 if available
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        const maxFeePerGas = this.adjustGasPrice(feeData.maxFeePerGas);
        const maxPriorityFeePerGas = this.adjustGasPrice(feeData.maxPriorityFeePerGas);

        // Store in history
        this.recordGasPrice(maxFeePerGas);

        return {
          gasPrice: maxFeePerGas.toString(),
          maxFeePerGas: maxFeePerGas.toString(),
          maxPriorityFeePerGas: maxPriorityFeePerGas.toString()
        };
      }

      // Fallback to legacy gas price
      if (feeData.gasPrice) {
        const gasPrice = this.adjustGasPrice(feeData.gasPrice);
        this.recordGasPrice(gasPrice);

        return {
          gasPrice: gasPrice.toString()
        };
      }

      // Default gas price for BSC
      const defaultGasPrice = BigInt('5000000000'); // 5 gwei
      const adjustedPrice = this.adjustGasPrice(defaultGasPrice);
      this.recordGasPrice(adjustedPrice);

      return {
        gasPrice: adjustedPrice.toString()
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get gas price, using default');

      const defaultGasPrice = BigInt('5000000000'); // 5 gwei
      return {
        gasPrice: defaultGasPrice.toString()
      };
    }
  }

  /**
   * Adjust gas price based on optimization strategy
   */
  private adjustGasPrice(baseGasPrice: bigint): bigint {
    let adjustedPrice = baseGasPrice;

    // Apply multiplier
    adjustedPrice = (adjustedPrice * BigInt(Math.floor(this.config.gasPriceMultiplier * 100))) / BigInt(100);

    // Dynamic adjustment based on network congestion
    if (this.config.dynamicGasAdjustment) {
      const congestionMultiplier = 1 + (this.networkStats.congestionLevel * 0.5);
      adjustedPrice = (adjustedPrice * BigInt(Math.floor(congestionMultiplier * 100))) / BigInt(100);
    }

    // Apply maximum limit
    const maxGasPrice = BigInt(this.config.maxGasPriceGwei) * BigInt('1000000000');
    if (adjustedPrice > maxGasPrice) {
      adjustedPrice = maxGasPrice;
    }

    return adjustedPrice;
  }

  /**
   * Record gas price for history and optimization
   */
  private recordGasPrice(gasPrice: bigint): void {
    const now = Date.now();
    this.gasPriceHistory.push({ timestamp: now, gasPrice });

    // Maintain history size
    if (this.gasPriceHistory.length > this.config.gasPriceHistorySize) {
      this.gasPriceHistory.shift();
    }

    // Update network stats
    this.updateNetworkStats();
  }

  /**
   * Update network statistics
   */
  private updateNetworkStats(): void {
    if (this.gasPriceHistory.length === 0) return;

    // Calculate average gas price
    const totalGasPrice = this.gasPriceHistory.reduce((sum, entry) => sum + entry.gasPrice, BigInt(0));
    this.networkStats.averageGasPrice = totalGasPrice / BigInt(this.gasPriceHistory.length);

    // Calculate congestion level based on gas price variance
    const recentPrices = this.gasPriceHistory.slice(-10); // Last 10 entries
    if (recentPrices.length > 1) {
      const prices = recentPrices.map(entry => Number(entry.gasPrice));
      const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const variance = prices.reduce((sum, price) => sum + Math.pow(price - avg, 2), 0) / prices.length;
      this.networkStats.congestionLevel = Math.min(variance / (avg * avg), 1);
    }
  }

  /**
   * Get optimized gas limit for transaction type
   */
  private getOptimizedGasLimit(transaction: ethers.TransactionRequest): string {
    // BSC has predictable gas limits for common operations
    const baseLimits: Record<string, number> = {
      '0xa9059cbb': 50000, // transfer
      '0x095ea7b3': 50000, // approve
      '0x18cbafe5': 200000, // exactInputSingle (V3)
      '0x414bf389': 200000, // exactOutputSingle (V3)
      '0x38ed1739': 150000, // swapExactTokensForTokens (V2)
      '0x4a25d94a': 150000, // swapTokensForExactTokens (V2)
      '0xe8e33700': 200000, // addLiquidity (V2)
      '0x02751cec': 200000, // addLiquidityETH (V2)
      '0xbaa2abde': 200000, // removeLiquidity (V2)
      '0x0d39d148': 200000, // removeLiquidityETH (V2)
    };

    if (transaction.data) {
      const methodSig = transaction.data.slice(0, 10);
      const baseLimit = baseLimits[methodSig];

      if (baseLimit) {
        // Add buffer for complex transactions
        return (baseLimit * 1.2).toFixed(0);
      }
    }

    // Default gas limit
    return '200000';
  }

  /**
   * Apply BSC FastLane optimizations
   */
  private applyFastLaneOptimizations(transaction: ethers.TransactionRequest): ethers.TransactionRequest {
    const optimized = { ...transaction };

    // FastLane specific optimizations for BSC
    if (this.config.enableFastLane) {
      // Set priority fee for faster inclusion
      if (optimized.maxFeePerGas && optimized.maxPriorityFeePerGas) {
        // Increase priority fee for faster inclusion
        const priorityBoost = BigInt('1000000000'); // 1 gwei boost
        optimized.maxPriorityFeePerGas = (BigInt(optimized.maxPriorityFeePerGas) + priorityBoost).toString();
      }

      // Optimize for BSC's 3-second block times
      if (optimized.gasPrice) {
        // Slightly increase gas price for faster inclusion
        optimized.gasPrice = (BigInt(optimized.gasPrice) * BigInt(110)) / BigInt(100);
      }
    }

    return optimized;
  }

  /**
   * Add transaction to queue with priority sorting
   */
  private addToQueue(transaction: PooledTransaction): void {
    // Insert based on priority (higher priority first)
    let insertIndex = this.transactionQueue.length;
    for (let i = 0; i < this.transactionQueue.length; i++) {
      if (transaction.priority > this.transactionQueue[i].priority) {
        insertIndex = i;
        break;
      }
    }

    this.transactionQueue.splice(insertIndex, 0, transaction);
    this.pendingTransactions.set(transaction.id, transaction);
  }

  /**
   * Start batch processor
   */
  private startBatchProcessor(): void {
    const processBatch = () => {
      if (this.transactionQueue.length > 0) {
        this.processBatch();
      }
    };

    // Set up timer for batch processing
    this.batchTimer = setInterval(processBatch, this.config.batchTimeout);
  }

  /**
   * Process a batch of transactions
   */
  private async processBatch(): Promise<void> {
    if (this.transactionQueue.length === 0) return;

    // Check if we're already processing batches
    if (this.processingBatches.size >= 3) { // Max 3 concurrent batches
      return;
    }

    const batchSize = Math.min(this.config.batchSize, this.transactionQueue.length);
    const batchTransactions = this.transactionQueue.splice(0, batchSize);

    if (batchTransactions.length === 0) return;

    const batchId = this.generateBatchId();
    const now = Date.now();

    // Get optimized gas price for batch
    const gasPrice = await this.getOptimizedGasPrice();

    const batch: TransactionBatch = {
      id: batchId,
      transactions: batchTransactions,
      createdAt: now,
      maxWaitTime: this.config.maxBatchWaitTime,
      gasPrice: gasPrice.gasPrice,
      maxFeePerGas: gasPrice.maxFeePerGas,
      maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
    };

    this.processingBatches.add(batchId);

    logger.debug('Processing transaction batch', {
      batchId,
      transactionCount: batchTransactions.length,
      gasPrice: batch.gasPrice
    });

    // Process batch asynchronously
    this.executeBatch(batch).catch(error => {
      logger.error({
        batchId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Batch execution failed');
    }).finally(() => {
      this.processingBatches.delete(batchId);
    });
  }

  /**
   * Execute a batch of transactions
   */
  private async executeBatch(batch: TransactionBatch): Promise<void> {
    const startTime = Date.now();
    const results: Array<{ transaction: PooledTransaction; hash?: string; error?: Error }> = [];

    // Execute transactions in parallel with controlled concurrency
    const concurrency = Math.min(5, batch.transactions.length); // Max 5 concurrent transactions per batch

    for (let i = 0; i < batch.transactions.length; i += concurrency) {
      const chunk = batch.transactions.slice(i, i + concurrency);

      const chunkPromises = chunk.map(async (tx) => {
        try {
          const hash = await this.executeTransaction(tx);
          return { transaction: tx, hash };
        } catch (error) {
          return {
            transaction: tx,
            error: error instanceof Error ? error : new Error('Unknown error')
          };
        }
      });

      const chunkResults = await Promise.allSettled(chunkPromises);

      chunkResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.error({ error: result.reason }, 'Chunk execution failed');
        }
      });
    }

    // Process results
    const successful = results.filter(r => r.hash);
    const failed = results.filter(r => r.error);

    // Update metrics
    this.metrics.successfulTransactions += successful.length;
    this.metrics.failedTransactions += failed.length;
    this.metrics.pendingTransactions -= batch.transactions.length;

    // Calculate batch efficiency
    const batchTime = Date.now() - startTime;
    const efficiency = successful.length / batch.transactions.length;
    this.metrics.batchEfficiency = (this.metrics.batchEfficiency + efficiency) / 2;

    logger.info('Batch execution completed', {
      batchId: batch.id,
      successful: successful.length,
      failed: failed.length,
      duration: batchTime,
      efficiency: (efficiency * 100).toFixed(2) + '%'
    });

    // Handle failed transactions (retry if appropriate)
    for (const result of failed) {
      await this.handleFailedTransaction(result.transaction, result.error);
    }

    // Notify callbacks
    results.forEach(result => {
      if (result.transaction.callback) {
        result.transaction.callback(result.hash!, result.error);
      }
    });

    // Clean up
    batch.transactions.forEach(tx => {
      this.pendingTransactions.delete(tx.id);
    });

    // Emit batch completion event
    this.emit('batchCompleted', {
      batchId: batch.id,
      successful: successful.length,
      failed: failed.length,
      duration: batchTime
    });
  }

  /**
   * Execute individual transaction
   */
  private async executeTransaction(pooledTx: PooledTransaction): Promise<string> {
    const startTime = Date.now();
    pooledTx.attempts++;
    pooledTx.lastAttempt = startTime;

    try {
      // Check deadline
      if (Date.now() > pooledTx.deadline) {
        throw new Error('Transaction deadline exceeded');
      }

      // Prepare transaction
      const transaction = {
        ...pooledTx.transaction,
        nonce: await this.signer.getNonce('pending')
      };

      // Send transaction
      const txResponse = await this.signer.sendTransaction(transaction);

      // Wait for confirmation with timeout
      const receipt = await Promise.race([
        txResponse.wait(1),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Transaction timeout')), this.config.mempoolTimeout)
        )
      ]) as ethers.TransactionReceipt;

      const confirmationTime = Date.now() - startTime;

      // Update metrics
      this.updateTransactionMetrics(confirmationTime, true);

      logger.debug('Transaction executed successfully', {
        transactionId: pooledTx.id,
        hash: txResponse.hash,
        confirmationTime,
        attempts: pooledTx.attempts
      });

      return txResponse.hash;

    } catch (error) {
      const confirmationTime = Date.now() - startTime;
      this.updateTransactionMetrics(confirmationTime, false);

      throw error;
    }
  }

  /**
   * Handle failed transaction with retry logic
   */
  private async handleFailedTransaction(pooledTx: PooledTransaction, error: Error): Promise<void> {
    // Check if retry is appropriate
    if (pooledTx.attempts < this.config.retryAttempts &&
        this.shouldRetryTransaction(error)) {

      // Calculate next retry time
      const retryDelay = this.config.retryDelay * Math.pow(2, pooledTx.attempts - 1); // Exponential backoff
      pooledTx.nextRetry = Date.now() + retryDelay;

      // Re-queue for retry
      setTimeout(() => {
        this.addToQueue(pooledTx);
        this.metrics.pendingTransactions++;
      }, retryDelay);

      logger.debug('Transaction queued for retry', {
        transactionId: pooledTx.id,
        attempt: pooledTx.attempts,
        nextRetry: retryDelay,
        error: error.message
      });

    } else {
      // Final failure
      logger.error('Transaction failed permanently', {
        transactionId: pooledTx.id,
        attempts: pooledTx.attempts,
        error: error.message
      });

      // Remove from pending
      this.pendingTransactions.delete(pooledTx.id);
      this.metrics.pendingTransactions--;
    }
  }

  /**
   * Determine if transaction should be retried
   */
  private shouldRetryTransaction(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Retry for these errors
    const retryableErrors = [
      'timeout',
      'network error',
      'nonce too low',
      'nonce too high',
      'underpriced',
      'replacement transaction underpriced'
    ];

    return retryableErrors.some(retryableError => message.includes(retryableError));
  }

  /**
   * Update transaction metrics
   */
  private updateTransactionMetrics(confirmationTime: number, success: boolean): void {
    // Update average confirmation time
    const totalTransactions = this.metrics.successfulTransactions + this.metrics.failedTransactions;
    this.metrics.averageConfirmationTime =
      (this.metrics.averageConfirmationTime * (totalTransactions - 1) + confirmationTime) / totalTransactions;

    // Update throughput (transactions per second)
    this.metrics.throughput = totalTransactions / (Date.now() / 1000);

    // Update error rate
    this.metrics.errorRate = this.metrics.failedTransactions / totalTransactions;
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsInterval);
  }

  /**
   * Collect and report performance metrics
   */
  private collectMetrics(): void {
    const metrics = { ...this.metrics };

    // Calculate additional metrics
    metrics.pendingTransactions = this.pendingTransactions.size;
    metrics.averageGasPrice = Number(this.networkStats.averageGasPrice) / 1e9; // Convert to gwei

    logger.info('Transaction Optimizer Metrics', metrics);

    // Check for performance alerts
    if (this.config.performanceAlerts) {
      this.checkPerformanceAlerts(metrics);
    }

    // Emit metrics event
    this.emit('metrics', metrics);
  }

  /**
   * Check for performance alerts
   */
  private checkPerformanceAlerts(metrics: TransactionMetrics): void {
    // High error rate alert
    if (metrics.errorRate > 0.1) { // 10% error rate
      this.emit('alert', {
        type: 'high_error_rate',
        value: metrics.errorRate,
        threshold: 0.1,
        message: `High transaction error rate: ${(metrics.errorRate * 100).toFixed(2)}%`
      });
    }

    // Low throughput alert
    if (metrics.throughput < 0.5) { // Less than 0.5 tx/sec
      this.emit('alert', {
        type: 'low_throughput',
        value: metrics.throughput,
        threshold: 0.5,
        message: `Low transaction throughput: ${metrics.throughput.toFixed(2)} tx/sec`
      });
    }

    // High confirmation time alert
    if (metrics.averageConfirmationTime > 10000) { // More than 10 seconds
      this.emit('alert', {
        type: 'slow_confirmation',
        value: metrics.averageConfirmationTime,
        threshold: 10000,
        message: `Slow transaction confirmation: ${metrics.averageConfirmationTime.toFixed(0)}ms`
      });
    }

    // High pending transactions alert
    if (metrics.pendingTransactions > this.config.maxPendingTransactions * 0.8) {
      this.emit('alert', {
        type: 'high_pending_transactions',
        value: metrics.pendingTransactions,
        threshold: this.config.maxPendingTransactions * 0.8,
        message: `High pending transactions: ${metrics.pendingTransactions}`
      });
    }
  }

  /**
   * Start network monitoring
   */
  private startNetworkMonitoring(): void {
    this.networkMonitorTimer = setInterval(async () => {
      await this.monitorNetworkConditions();
    }, 30000); // Every 30 seconds
  }

  /**
   * Monitor network conditions and adjust strategy
   */
  private async monitorNetworkConditions(): Promise<void> {
    try {
      // Get latest block
      const block = await this.provider.getBlock('latest');
      if (!block) return;

      // Update average block time
      if (block.timestamp) {
        const now = Math.floor(Date.now() / 1000);
        const blockTime = now - Number(block.timestamp);
        this.networkStats.averageBlockTime =
          (this.networkStats.averageBlockTime + blockTime) / 2;
      }

      // Get gas price for monitoring
      const feeData = await this.provider.getFeeData();
      if (feeData.gasPrice) {
        this.recordGasPrice(feeData.gasPrice);
      }

      logger.debug('Network conditions updated', {
        blockTime: this.networkStats.averageBlockTime,
        gasPrice: Number(this.networkStats.averageGasPrice) / 1e9,
        congestion: this.networkStats.congestionLevel
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Network monitoring failed');
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): TransactionMetrics {
    return { ...this.metrics };
  }

  /**
   * Get network statistics
   */
  getNetworkStats(): typeof this.networkStats {
    return { ...this.networkStats };
  }

  /**
   * Get pending transaction count
   */
  getPendingTransactionCount(): number {
    return this.pendingTransactions.size;
  }

  /**
   * Cancel pending transaction
   */
  cancelTransaction(transactionId: string): boolean {
    const transaction = this.pendingTransactions.get(transactionId);
    if (!transaction) return false;

    // Remove from queue
    const queueIndex = this.transactionQueue.findIndex(tx => tx.id === transactionId);
    if (queueIndex !== -1) {
      this.transactionQueue.splice(queueIndex, 1);
    }

    // Remove from pending
    this.pendingTransactions.delete(transactionId);
    this.metrics.pendingTransactions--;

    // Call callback with cancellation
    if (transaction.callback) {
      transaction.callback('', new Error('Transaction cancelled'));
    }

    logger.debug('Transaction cancelled', { transactionId });
    return true;
  }

  /**
   * Clear all pending transactions
   */
  clearPendingTransactions(): number {
    const count = this.pendingTransactions.size;

    this.pendingTransactions.clear();
    this.transactionQueue = [];
    this.metrics.pendingTransactions = 0;

    logger.info('All pending transactions cleared', { count });
    return count;
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup and shutdown
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

    if (this.networkMonitorTimer) {
      clearInterval(this.networkMonitorTimer);
      this.networkMonitorTimer = null;
    }

    // Clear queues
    this.clearPendingTransactions();
    this.batchQueue = [];
    this.processingBatches.clear();

    logger.info('BSC Transaction Optimizer shutdown completed');
  }
}

// Export singleton instance factory
export function createBSCTransactionOptimizer(
  provider: ethers.JsonRpcProvider,
  signer: ethers.Signer,
  config?: Partial<TransactionOptimizationConfig>
): BSCTransactionOptimizer {
  return new BSCTransactionOptimizer(provider, signer, config);
}