/**
 * BSC Transaction Optimizer - Viem Integration
 * Advanced transaction handling with performance optimizations for BSC network using Viem 2.38.5
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
  Log,
  SimulateContractParameters,
  SimulateContractReturnType
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { EventEmitter } from 'events';
import logger from '../../../utils/logger.js';

/**
 * BSC-specific configuration for transaction optimization
 */
interface BscTransactionConfig {
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
  fastLaneBoost: string;
  networkCongestionThreshold: number;
}

/**
 * Transaction optimization configuration for Viem
 */
export interface TransactionOptimizationConfigViem {
  // Batch processing
  batchSize: number;
  batchTimeout: number; // milliseconds
  maxBatchWaitTime: number;

  // Gas optimization
  gasPriceMultiplier: number;
  maxGasPriceGwei: number;
  dynamicGasAdjustment: boolean;
  gasPriceHistorySize: number;
  enableEIP1559Support: boolean;

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

  // Viem-specific settings
  useSimulation: boolean;
  enableMulticall: boolean;
  enableBatchCalls: boolean;
  smartContractOptimization: boolean;
  gasEstimationOptimization: boolean;
  pancakeSwapOptimization: boolean;
}

/**
 * Transaction pool entry with Viem integration
 */
export interface PooledTransactionViem {
  id: string;
  transaction: SendTransactionParameters;
  priority: number;
  attempts: number;
  createdAt: number;
  lastAttempt: number;
  nextRetry: number;
  deadline: number;
  callback?: (hash: Address, error?: Error) => void;
  metadata?: Record<string, any>;
  clientType?: 'public' | 'wallet' | 'custom';
  account?: Address;
  simulationResult?: SimulateContractReturnType;
  pancakeSwapOptimized?: boolean;
  gasOptimized?: boolean;
}

/**
 * Batch transaction group with Viem integration
 */
export interface TransactionBatchViem {
  id: string;
  transactions: PooledTransactionViem[];
  createdAt: number;
  maxWaitTime: number;
  gasPrice: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  clientType: 'public' | 'wallet' | 'custom';
  pancakeSwapOptimized: boolean;
  viemOptimized: boolean;
}

/**
 * Performance metrics with Viem integration
 */
export interface TransactionMetricsViem {
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
  viemSpecific: {
    simulationSuccessRate: number;
    multicallOptimizations: number;
    batchCallSavings: number;
    averageSimulationTime: number;
    contractOptimizationSavings: number;
    gasEstimationAccuracy: number;
  };
  bscSpecific: {
    totalBnbSpent: bigint;
    averageGasPriceWei: bigint;
    peakGasPrice: bigint;
    networkUtilizationAverage: number;
    fastLaneUtilizations: number;
    pancakeSwapOptimizations: number;
  };
}

/**
 * BSC Transaction Optimizer with Viem 2.38.5 Integration
 * Optimizes transaction handling for maximum performance on BSC
 */
export class BSCTransactionOptimizerViem extends EventEmitter {
  private config: TransactionOptimizationConfigViem;
  private bscConfig: BscTransactionConfig;
  private publicClient: PublicClient<Transport, Chain>;
  private walletClient?: WalletClient<Transport, Chain, Account>;
  private customClients: Map<string, PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account>> = new Map();

  // Transaction management
  private pendingTransactions: Map<string, PooledTransactionViem> = new Map();
  private transactionQueue: PooledTransactionViem[] = [];
  private batchQueue: TransactionBatchViem[] = [];
  private processingBatches: Set<string> = new Set();

  // Gas optimization
  private gasPriceHistory: Array<{ timestamp: number; gasPrice: bigint }> = [];
  private networkStats: {
    averageBlockTime: number;
    averageGasPrice: bigint;
    congestionLevel: number;
    blockUtilization: number;
  } = {
    averageBlockTime: 3000, // 3 seconds for BSC
    averageGasPrice: BigInt('5000000000'), // 5 gwei
    congestionLevel: 0.5,
    blockUtilization: 0.7
  };

  // Performance metrics
  private metrics: TransactionMetricsViem = {
    totalTransactions: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
    averageConfirmationTime: 0,
    averageGasPrice: 0,
    gasOptimizationSavings: 0,
    batchEfficiency: 0,
    throughput: 0,
    errorRate: 0,
    pendingTransactions: 0,
    viemSpecific: {
      simulationSuccessRate: 0,
      multicallOptimizations: 0,
      batchCallSavings: 0,
      averageSimulationTime: 0,
      contractOptimizationSavings: 0,
      gasEstimationAccuracy: 0
    },
    bscSpecific: {
      totalBnbSpent: BigInt(0),
      averageGasPriceWei: BigInt(0),
      peakGasPrice: BigInt(0),
      networkUtilizationAverage: 0,
      fastLaneUtilizations: 0,
      pancakeSwapOptimizations: 0
    }
  };

  // Timers and intervals
  private batchTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;
  private networkMonitorTimer: NodeJS.Timeout | null = null;

  constructor(
    publicClient: PublicClient<Transport, Chain>,
    config: Partial<TransactionOptimizationConfigViem> = {},
    bscConfig?: Partial<BscTransactionConfig>,
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
      maxGasPriceGwei: '100',
      gasMultiplier: 1.1,
      confirmations: 1,
      fastLaneBoost: '1000000000', // 1 gwei boost
      networkCongestionThreshold: 0.8,
      ...bscConfig
    };

    this.config = {
      batchSize: 10,
      batchTimeout: 1000, // 1 second
      maxBatchWaitTime: 5000, // 5 seconds max wait
      gasPriceMultiplier: 1.1,
      maxGasPriceGwei: 100,
      dynamicGasAdjustment: true,
      gasPriceHistorySize: 100,
      enableEIP1559Support: true,
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
      useSimulation: true,
      enableMulticall: true,
      enableBatchCalls: true,
      smartContractOptimization: true,
      gasEstimationOptimization: true,
      pancakeSwapOptimization: true,
      ...config
    };

    this.initializeOptimizers();
  }

  /**
   * Add a custom client for specific transactions
   */
  addCustomClient(
    name: string,
    client: PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account>
  ): void {
    this.customClients.set(name, client);
    logger.info('Custom client added to transaction optimizer', { name, type: client.type });
  }

  /**
   * Get appropriate client for transaction
   */
  private getTransactionClient(transaction: PooledTransactionViem):
    PublicClient<Transport, Chain> | WalletClient<Transport, Chain, Account> {

    if (transaction.clientType === 'custom' && transaction.metadata?.customClientName) {
      const customClient = this.customClients.get(transaction.metadata.customClientName);
      if (customClient) {
        return customClient;
      }
    }

    if (transaction.clientType === 'wallet' && this.walletClient) {
      return this.walletClient;
    }

    return this.publicClient;
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

    // Start BSC-specific monitoring
    this.startBscMonitoring();

    logger.info('BSC Transaction Optimizer (Viem) initialized', {
      batchSize: this.config.batchSize,
      gasOptimization: this.config.dynamicGasAdjustment,
      fastLane: this.config.enableFastLane,
      viemOptimizations: {
        simulation: this.config.useSimulation,
        multicall: this.config.enableMulticall,
        batchCalls: this.config.enableBatchCalls,
        pancakeSwap: this.config.pancakeSwapOptimization
      }
    });
  }

  /**
   * Submit transaction for optimized processing
   */
  async submitTransaction(
    transaction: SendTransactionParameters,
    options: {
      priority?: number;
      callback?: (hash: Address, error?: Error) => void;
      metadata?: Record<string, any>;
      deadline?: number;
      clientType?: 'public' | 'wallet' | 'custom';
      account?: Address;
      pancakeSwapOptimized?: boolean;
      gasOptimized?: boolean;
    } = {}
  ): Promise<string> {
    const id = this.generateTransactionId();
    const now = Date.now();

    // Simulate transaction if enabled
    let simulationResult: SimulateContractReturnType | undefined;
    if (this.config.useSimulation && transaction.data) {
      try {
        const simParams: SimulateContractParameters = {
          address: transaction.to as Address,
          abi: [], // Would need actual ABI
          functionName: 'call', // Generic function name
          args: [],
          account: options.account as Address || (this.walletClient?.account?.address),
          data: transaction.data as `0x${string}`,
          value: transaction.value
        };
        simulationResult = await this.publicClient.simulateContract(simParams);
      } catch (error) {
        logger.warn({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Transaction simulation failed');
      }
    }

    const pooledTx: PooledTransactionViem = {
      id,
      transaction: this.optimizeTransaction(transaction),
      priority: options.priority || 0,
      attempts: 0,
      createdAt: now,
      lastAttempt: 0,
      nextRetry: now,
      deadline: options.deadline || now + this.config.transactionTimeout,
      callback: options.callback,
      metadata: options.metadata,
      clientType: options.clientType || 'wallet',
      account: options.account,
      simulationResult,
      pancakeSwapOptimized: options.pancakeSwapOptimized || false,
      gasOptimized: options.gasOptimized || false
    };

    // Add to queue
    this.addToQueue(pooledTx);

    // Update metrics
    this.metrics.totalTransactions++;
    this.metrics.pendingTransactions++;

    logger.debug('Transaction submitted for optimization', {
      id,
      priority: pooledTx.priority,
      queueSize: this.transactionQueue.length,
      clientType: pooledTx.clientType,
      pancakeSwapOptimized: pooledTx.pancakeSwapOptimized
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
      transaction: SendTransactionParameters;
      priority?: number;
      callback?: (hash: Address, error?: Error) => void;
      metadata?: Record<string, any>;
      clientType?: 'public' | 'wallet' | 'custom';
      account?: Address;
      pancakeSwapOptimized?: boolean;
    }>
  ): Promise<string[]> {
    const batchId = this.generateBatchId();
    const now = Date.now();

    // Optimize gas price for the entire batch
    const optimizedGasPrice = await this.getOptimizedGasPrice();

    const pooledTransactions: PooledTransactionViem[] = transactions.map((tx, index) => ({
      id: `${batchId}-${index}`,
      transaction: this.optimizeTransaction({
        ...tx.transaction,
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
      metadata: { ...tx.metadata, batchId, batchIndex: index },
      clientType: tx.clientType || 'wallet',
      account: tx.account,
      pancakeSwapOptimized: tx.pancakeSwapOptimized || false,
      gasOptimized: true
    }));

    // Create batch
    const batch: TransactionBatchViem = {
      id: batchId,
      transactions: pooledTransactions,
      createdAt: now,
      maxWaitTime: this.config.maxBatchWaitTime,
      gasPrice: optimizedGasPrice.gasPrice,
      maxFeePerGas: optimizedGasPrice.maxFeePerGas,
      maxPriorityFeePerGas: optimizedGasPrice.maxPriorityFeePerGas,
      clientType: 'wallet',
      pancakeSwapOptimized: pooledTransactions.some(tx => tx.pancakeSwapOptimized),
      viemOptimized: true
    };

    this.batchQueue.push(batch);
    this.transactionQueue.push(...pooledTransactions);

    // Update metrics
    this.metrics.totalTransactions += pooledTransactions.length;
    this.metrics.pendingTransactions += pooledTransactions.length;

    // Update BSC-specific metrics
    if (batch.pancakeSwapOptimized) {
      this.metrics.bscSpecific.pancakeSwapOptimizations += pooledTransactions.length;
    }

    logger.info('Batch submitted for optimization', {
      batchId,
      transactionCount: pooledTransactions.length,
      gasPrice: optimizedGasPrice.gasPrice.toString(),
      pancakeSwapOptimized: batch.pancakeSwapOptimized
    });

    // Process immediately
    await this.processBatch();

    return pooledTransactions.map(tx => tx.id);
  }

  /**
   * Optimize individual transaction
   */
  private optimizeTransaction(transaction: SendTransactionParameters): SendTransactionParameters {
    const optimized = { ...transaction };

    // Optimize gas limit if not set
    if (!optimized.gas && this.config.gasEstimationOptimization) {
      optimized.gas = BigInt(this.getOptimizedGasLimit(transaction));
    }

    // BSC-specific optimizations
    if (this.config.enableFastLane) {
      optimized = this.applyFastLaneOptimizations(optimized);
    }

    // PancakeSwap optimizations
    if (this.config.pancakeSwapOptimization) {
      optimized = this.applyPancakeSwapOptimizations(optimized);
    }

    return optimized;
  }

  /**
   * Get optimized gas price based on network conditions
   */
  private async getOptimizedGasPrice(): Promise<{
    gasPrice: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
  }> {
    try {
      const feeData = await this.publicClient.getFeeData();

      // Use EIP-1559 if available
      if (this.config.enableEIP1559Support && feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        let maxFeePerGas = this.adjustGasPrice(feeData.maxFeePerGas);
        let maxPriorityFeePerGas = this.adjustGasPrice(feeData.maxPriorityFeePerGas);

        // Apply FastLane boost for BSC
        if (this.config.enableFastLane) {
          const fastLaneBoost = BigInt(this.bscConfig.fastLaneBoost);
          maxPriorityFeePerGas += fastLaneBoost;
          this.metrics.bscSpecific.fastLaneUtilizations++;
        }

        // Store in history
        this.recordGasPrice(maxFeePerGas);

        return {
          gasPrice: maxFeePerGas,
          maxFeePerGas,
          maxPriorityFeePerGas
        };
      }

      // Fallback to legacy gas price
      if (feeData.gasPrice) {
        let gasPrice = this.adjustGasPrice(feeData.gasPrice);

        // Apply FastLane boost
        if (this.config.enableFastLane) {
          const fastLaneBoost = BigInt(this.bscConfig.fastLaneBoost);
          gasPrice += fastLaneBoost;
          this.metrics.bscSpecific.fastLaneUtilizations++;
        }

        this.recordGasPrice(gasPrice);

        return {
          gasPrice
        };
      }

      // Default gas price for BSC
      const defaultGasPrice = BigInt(this.bscConfig.defaultGasPrice);
      const adjustedPrice = this.adjustGasPrice(defaultGasPrice);
      this.recordGasPrice(adjustedPrice);

      return {
        gasPrice: adjustedPrice
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get gas price, using default');

      const defaultGasPrice = BigInt(this.bscConfig.defaultGasPrice);
      return {
        gasPrice: defaultGasPrice
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

    // Update peak gas price
    if (adjustedPrice > this.metrics.bscSpecific.peakGasPrice) {
      this.metrics.bscSpecific.peakGasPrice = adjustedPrice;
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

    // Update BSC-specific metrics
    this.metrics.bscSpecific.averageGasPriceWei =
      (this.metrics.bscSpecific.averageGasPriceWei + gasPrice) / BigInt(2);
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
  private getOptimizedGasLimit(transaction: SendTransactionParameters): number {
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
        return Math.floor(baseLimit * 1.2);
      }
    }

    // Default gas limit
    return 200000;
  }

  /**
   * Apply BSC FastLane optimizations
   */
  private applyFastLaneOptimizations(transaction: SendTransactionParameters): SendTransactionParameters {
    const optimized = { ...transaction };

    // FastLane specific optimizations for BSC
    if (this.config.enableFastLane) {
      // Set priority fee for faster inclusion
      if (optimized.maxFeePerGas && optimized.maxPriorityFeePerGas) {
        // Increase priority fee for faster inclusion
        const priorityBoost = BigInt(this.bscConfig.fastLaneBoost);
        optimized.maxPriorityFeePerGas += priorityBoost;
      }

      // Optimize for BSC's 3-second block times
      if (optimized.gas) {
        // Slightly increase gas limit for buffer
        optimized.gas = (optimized.gas * BigInt(110)) / BigInt(100);
      }
    }

    return optimized;
  }

  /**
   * Apply PancakeSwap-specific optimizations
   */
  private applyPancakeSwapOptimizations(transaction: SendTransactionParameters): SendTransactionParameters {
    const optimized = { ...transaction };

    // Check if this is a PancakeSwap transaction
    if (transaction.to?.toLowerCase() === this.bscConfig.pancakeSwapRouter.toLowerCase()) {
      // PancakeSwap-specific optimizations
      if (optimized.data) {
        const methodSig = optimized.data.slice(0, 10);

        // Optimize for common PancakeSwap operations
        switch (methodSig) {
          case '0x38ed1739': // swapExactTokensForTokens
          case '0x4a25d94a': // swapTokensForExactTokens
            // Use slightly higher gas limit for swaps due to complexity
            optimized.gas = BigInt(180000);
            break;
          case '0xe8e33700': // addLiquidity
          case '0x02751cec': // addLiquidityETH
            // Use higher gas limit for liquidity operations
            optimized.gas = BigInt(250000);
            break;
          case '0xbaa2abde': // removeLiquidity
          case '0x0d39d148': // removeLiquidityETH
            // Use moderate gas limit for removal operations
            optimized.gas = BigInt(220000);
            break;
        }
      }
    }

    return optimized;
  }

  /**
   * Add transaction to queue with priority sorting
   */
  private addToQueue(transaction: PooledTransactionViem): void {
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

    const batch: TransactionBatchViem = {
      id: batchId,
      transactions: batchTransactions,
      createdAt: now,
      maxWaitTime: this.config.maxBatchWaitTime,
      gasPrice: gasPrice.gasPrice,
      maxFeePerGas: gasPrice.maxFeePerGas,
      maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas,
      clientType: batchTransactions[0].clientType || 'wallet',
      pancakeSwapOptimized: batchTransactions.some(tx => tx.pancakeSwapOptimized),
      viemOptimized: true
    };

    this.processingBatches.add(batchId);

    logger.debug('Processing transaction batch', {
      batchId,
      transactionCount: batchTransactions.length,
      gasPrice: batch.gasPrice.toString(),
      viemOptimized: batch.viemOptimized,
      pancakeSwapOptimized: batch.pancakeSwapOptimized
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
  private async executeBatch(batch: TransactionBatchViem): Promise<void> {
    const startTime = Date.now();
    const results: Array<{ transaction: PooledTransactionViem; hash?: Address; error?: Error }> = [];

    // Group transactions by client type for optimal execution
    const groupedTransactions = this.groupTransactionsByClient(batch.transactions);

    for (const [clientType, transactions] of groupedTransactions.entries()) {
      // Execute transactions in parallel with controlled concurrency
      const concurrency = Math.min(5, transactions.length); // Max 5 concurrent transactions per batch

      for (let i = 0; i < transactions.length; i += concurrency) {
        const chunk = transactions.slice(i, i + concurrency);

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

    // Update BSC-specific metrics
    const totalGasUsed = successful.reduce((sum, r) => {
      // Would need to get actual gas used from receipts
      return sum; // Placeholder
    }, BigInt(0));
    this.metrics.bscSpecific.totalBnbSpent += totalGasUsed * batch.gasPrice / BigInt('1000000000000000000');

    logger.info('Batch execution completed', {
      batchId: batch.id,
      successful: successful.length,
      failed: failed.length,
      duration: batchTime,
      efficiency: (efficiency * 100).toFixed(2) + '%',
      viemOptimized: batch.viemOptimized
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
      duration: batchTime,
      viemOptimized: batch.viemOptimized
    });
  }

  /**
   * Group transactions by client type for optimal execution
   */
  private groupTransactionsByClient(transactions: PooledTransactionViem[]): Map<string, PooledTransactionViem[]> {
    const grouped = new Map<string, PooledTransactionViem[]>();

    for (const transaction of transactions) {
      const key = `${transaction.clientType}_${transaction.pancakeSwapOptimized ? 'ps' : 'regular'}`;

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(transaction);
    }

    return grouped;
  }

  /**
   * Execute individual transaction
   */
  private async executeTransaction(pooledTx: PooledTransactionViem): Promise<Address> {
    const startTime = Date.now();
    pooledTx.attempts++;
    pooledTx.lastAttempt = startTime;

    try {
      // Check deadline
      if (Date.now() > pooledTx.deadline) {
        throw new Error('Transaction deadline exceeded');
      }

      const client = this.getTransactionClient(pooledTx) as WalletClient;

      // Prepare transaction with optimized parameters
      const transaction: SendTransactionParameters = {
        ...pooledTx.transaction,
        account: pooledTx.account as Address,
        maxFeePerGas: pooledTx.transaction.maxFeePerGas,
        maxPriorityFeePerGas: pooledTx.transaction.maxPriorityFeePerGas,
        gas: pooledTx.transaction.gas
      };

      // Send transaction
      const hash = await client.sendTransaction(transaction);

      // Wait for confirmation with timeout
      const receipt = await Promise.race([
        this.publicClient.waitForTransactionReceipt({ hash }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Transaction timeout')), this.config.mempoolTimeout)
        )
      ]);

      const confirmationTime = Date.now() - startTime;

      // Update metrics
      this.updateTransactionMetrics(confirmationTime, true, pooledTx);

      logger.debug('Transaction executed successfully', {
        transactionId: pooledTx.id,
        hash,
        confirmationTime,
        attempts: pooledTx.attempts,
        viemOptimized: true
      });

      return hash;

    } catch (error) {
      const confirmationTime = Date.now() - startTime;
      this.updateTransactionMetrics(confirmationTime, false, pooledTx);

      throw error;
    }
  }

  /**
   * Handle failed transaction with retry logic
   */
  private async handleFailedTransaction(pooledTx: PooledTransactionViem, error: Error): Promise<void> {
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
      'replacement transaction underpriced',
      'gas required exceeds allowance',
      'transaction underpriced'
    ];

    return retryableErrors.some(retryableError => message.includes(retryableError));
  }

  /**
   * Update transaction metrics
   */
  private updateTransactionMetrics(confirmationTime: number, success: boolean, pooledTx?: PooledTransactionViem): void {
    // Update average confirmation time
    const totalTransactions = this.metrics.successfulTransactions + this.metrics.failedTransactions;
    if (totalTransactions > 0) {
      this.metrics.averageConfirmationTime =
        (this.metrics.averageConfirmationTime * (totalTransactions - 1) + confirmationTime) / totalTransactions;
    }

    // Update throughput (transactions per second)
    this.metrics.throughput = totalTransactions / (Date.now() / 1000);

    // Update error rate
    this.metrics.errorRate = this.metrics.failedTransactions / totalTransactions;

    // Update Viem-specific metrics
    if (pooledTx && pooledTx.simulationResult) {
      this.metrics.viemSpecific.simulationSuccessRate =
        (this.metrics.viemSpecific.simulationSuccessRate + (success ? 1 : 0)) / 2;
    }
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

    logger.info('Transaction Optimizer Metrics (Viem)', {
      totalTransactions: metrics.totalTransactions,
      successfulTransactions: metrics.successfulTransactions,
      failedTransactions: metrics.failedTransactions,
      averageConfirmationTime: metrics.averageConfirmationTime.toFixed(2) + 'ms',
      averageGasPrice: metrics.averageGasPrice.toFixed(2) + ' gwei',
      throughput: metrics.throughput.toFixed(2) + ' tx/sec',
      errorRate: (metrics.errorRate * 100).toFixed(2) + '%',
      pendingTransactions: metrics.pendingTransactions,
      viemSpecific: {
        simulationSuccessRate: (metrics.viemSpecific.simulationSuccessRate * 100).toFixed(2) + '%',
        multicallOptimizations: metrics.viemSpecific.multicallOptimizations,
        batchCallSavings: metrics.viemSpecific.batchCallSavings,
        averageSimulationTime: metrics.viemSpecific.averageSimulationTime.toFixed(2) + 'ms',
        contractOptimizationSavings: metrics.viemSpecific.contractOptimizationSavings,
        gasEstimationAccuracy: (metrics.viemSpecific.gasEstimationAccuracy * 100).toFixed(2) + '%'
      },
      bscSpecific: {
        totalBnbSpent: formatEther(metrics.bscSpecific.totalBnbSpent) + ' BNB',
        averageGasPriceWei: formatEther(metrics.bscSpecific.averageGasPriceWei) + ' BNB',
        peakGasPrice: formatEther(metrics.bscSpecific.peakGasPrice) + ' BNB',
        networkUtilizationAverage: (metrics.bscSpecific.networkUtilizationAverage * 100).toFixed(2) + '%',
        fastLaneUtilizations: metrics.bscSpecific.fastLaneUtilizations,
        pancakeSwapOptimizations: metrics.bscSpecific.pancakeSwapOptimizations
      }
    });

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
  private checkPerformanceAlerts(metrics: TransactionMetricsViem): void {
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

    // Low simulation success rate alert
    if (metrics.viemSpecific.simulationSuccessRate < 0.8) { // 80% success rate
      this.emit('alert', {
        type: 'low_simulation_success_rate',
        value: metrics.viemSpecific.simulationSuccessRate,
        threshold: 0.8,
        message: `Low simulation success rate: ${(metrics.viemSpecific.simulationSuccessRate * 100).toFixed(2)}%`
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
      const block = await this.publicClient.getBlock();
      if (!block) return;

      // Update average block time
      if (block.timestamp) {
        const now = Math.floor(Date.now() / 1000);
        const blockTime = now - Number(block.timestamp);
        this.networkStats.averageBlockTime =
          (this.networkStats.averageBlockTime + blockTime) / 2;
      }

      // Update block utilization
      if (block.gasUsed && block.gasLimit) {
        const utilization = Number((block.gasUsed * BigInt(100)) / block.gasLimit) / 100;
        this.networkStats.blockUtilization = (this.networkStats.blockUtilization + utilization) / 2;
        this.networkStats.congestionLevel = utilization;
      }

      // Get gas price for monitoring
      const feeData = await this.publicClient.getFeeData();
      if (feeData.gasPrice) {
        this.recordGasPrice(feeData.gasPrice);
      }

      logger.debug('Network conditions updated', {
        blockTime: this.networkStats.averageBlockTime,
        gasPrice: Number(this.networkStats.averageGasPrice) / 1e9,
        congestion: this.networkStats.congestionLevel,
        blockUtilization: this.networkStats.blockUtilization
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Network monitoring failed');
    }
  }

  /**
   * Start BSC-specific monitoring
   */
  private startBscMonitoring(): void {
    // Update BSC-specific metrics periodically
    setInterval(async () => {
      try {
        // Monitor BNB price (placeholder - would integrate with price oracle)
        // const bnbPrice = await fetchBNBPrice();
        // this.bscConfig.currentBnbPrice = bnbPrice;

        // Update network utilization average
        this.metrics.bscSpecific.networkUtilizationAverage = this.networkStats.blockUtilization;

      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'BSC monitoring failed');
      }
    }, 60000); // Every minute
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): TransactionMetricsViem {
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
      transaction.callback('0x0000000000000000000000000000000000000000' as Address, new Error('Transaction cancelled'));
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

    logger.info('BSC Transaction Optimizer (Viem) shutdown completed');
  }
}

// Export singleton instance factory
export function createBSCTransactionOptimizerViem(
  publicClient: PublicClient<Transport, Chain>,
  config?: Partial<TransactionOptimizationConfigViem>,
  bscConfig?: Partial<BscTransactionConfig>,
  walletClient?: WalletClient<Transport, Chain, Account>
): BSCTransactionOptimizerViem {
  return new BSCTransactionOptimizerViem(publicClient, config, bscConfig, walletClient);
}