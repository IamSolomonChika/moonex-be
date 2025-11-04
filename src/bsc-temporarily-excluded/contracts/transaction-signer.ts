import { ethers } from 'ethers';
import logger from '../../utils/logger.js';

// Simple cache interface
export interface ICache {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
}

// Transaction signing interfaces
export interface TransactionParams {
  to: string;
  data?: string;
  value?: string;
  gasLimit?: string | number;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
}

export interface TransactionRequest {
  to: string;
  data?: string;
  value?: string;
  gasLimit?: string | number;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
  type?: number;
}

export interface SignedTransaction {
  signedTransaction: string;
  transactionHash: string;
  nonce: number;
  gasLimit: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  value: string;
  to: string;
  data?: string;
}

export interface TransactionResult {
  transactionHash: string;
  blockNumber?: number;
  blockHash?: string;
  gasUsed: string;
  effectiveGasPrice?: string;
  status: number; // 1 = success, 0 = failure
  logs?: any[];
  timestamp?: number;
}

export interface TransactionConfig {
  maxGasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasMultiplier?: number;
  confirmations?: number;
  timeoutMs?: number;
  checkPending?: boolean;
}

export interface WalletConfig {
  privateKey: string;
  address: string;
  index: number;
  name: string;
}

export interface MultiSigConfig {
  threshold: number;
  owners: string[];
  nonce: number;
}

export interface SignatureRequest {
  transactionHash: string;
  signatures: string[];
  nonce: number;
  threshold: number;
  deadline?: number;
}

export interface SimulationResult {
  success: boolean;
  gasUsed: string;
  status: number;
  logs: any[];
  error?: string;
  revertReason?: string;
}

export interface TransactionQueue {
  queueId: string;
  transactions: TransactionParams[];
  batch: boolean;
  maxGasPerBatch: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

export class TransactionSigner {
  private provider: ethers.JsonRpcProvider;
  private wallets: Map<string, ethers.Wallet> = new Map();
  private multiSigContracts: Map<string, ethers.Contract> = new Map();
  private pendingTransactions: Map<string, TransactionParams> = new Map();
  private transactionQueues: Map<string, TransactionQueue> = new Map();
  private config: TransactionConfig;
  private cache: ICache;

  constructor(
    private rpcUrl: string,
    config: TransactionConfig = {},
    cache?: ICache
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.config = {
      maxGasPrice: config.maxGasPrice || '100000000000', // 100 Gwei
      maxFeePerGas: config.maxFeePerGas || '100000000000',
      maxPriorityFeePerGas: config.maxPriorityFeePerGas || '2000000000', // 2 Gwei
      gasMultiplier: config.gasMultiplier || 1.1,
      confirmations: config.confirmations || 1,
      timeoutMs: config.timeoutMs || 300000, // 5 minutes
      checkPending: config.checkPending !== false,
      ...config
    };
    this.cache = cache || {
      get: async () => null,
      set: async () => {},
      del: async () => {},
      has: async () => false
    };
  }

  // Wallet management
  async addWallet(walletConfig: WalletConfig): Promise<void> {
    try {
      const wallet = new ethers.Wallet(walletConfig.privateKey, this.provider);

      // Verify address matches
      if (wallet.address.toLowerCase() !== walletConfig.address.toLowerCase()) {
        throw new Error('Private key does not match provided address');
      }

      this.wallets.set(walletConfig.address, wallet);

      logger.info(`Wallet added: ${walletConfig.address.substring(0, 6)}...`);
    } catch (error) {
      logger.error({ error: error.message, address: walletConfig.address }, 'Failed to add wallet');
      throw error;
    }
  }

  async removeWallet(address: string): Promise<void> {
    const wallet = this.wallets.get(address);
    if (wallet) {
      this.wallets.delete(address);
      logger.info(`Wallet removed: ${address.substring(0, 6)}...`);
    }
  }

  getWallet(address: string): ethers.Wallet | undefined {
    return this.wallets.get(address.toLowerCase());
  }

  getWallets(): string[] {
    return Array.from(this.wallets.keys());
  }

  // Multi-signature contract setup
  async setupMultiSig(
    contractAddress: string,
    config: MultiSigConfig,
    abi: any[]
  ): Promise<void> {
    try {
      const multiSig = new ethers.Contract(contractAddress, abi, this.provider);

      // Verify contract configuration
      const threshold = await multiSig.threshold();
      const owners = await multiSig.getOwners();

      if (Number(threshold) !== config.threshold) {
        throw new Error('Threshold mismatch');
      }

      if (owners.length !== config.owners.length) {
        throw new Error('Owners count mismatch');
      }

      this.multiSigContracts.set(contractAddress, multiSig);

      logger.info(`MultiSig contract configured: ${contractAddress}`);
    } catch (error) {
      logger.error({
        error: error.message,
        contractAddress
      }, 'Failed to setup multi-sig contract');
      throw error;
    }
  }

  // Transaction preparation
  async prepareTransaction(
    params: TransactionParams,
    signerAddress?: string
  ): Promise<TransactionRequest> {
    try {
      // Get network info
      const network = await this.provider.getNetwork();
      const isEIP1559 = Number(network.chainId) === 56 || Number(network.chainId) === 97; // BSC mainnet/testnet

      // Get nonce
      let nonce = params.nonce;
      if (nonce === undefined && signerAddress) {
        nonce = await this.provider.getTransactionCount(signerAddress, 'pending');
      }

      // Prepare gas settings
      let gasSettings: any = {};

      if (isEIP1559) {
        const feeData = await this.provider.getFeeData();
        gasSettings = {
          type: 2,
          maxFeePerGas: params.maxFeePerGas || feeData.maxFeePerGas?.toString() || '20000000000',
          maxPriorityFeePerGas: params.maxPriorityFeePerGas || feeData.maxPriorityFeePerGas?.toString() || '2000000000'
        };
      } else {
        const feeData = await this.provider.getFeeData();
        const gasPrice = params.gasPrice || feeData.gasPrice?.toString() || '20000000000';
        gasSettings = {
          type: 0,
          gasPrice: ethers.parseUnits(gasPrice, 'gwei').toString()
        };
      }

      // Prepare transaction
      const transaction: TransactionRequest = {
        to: params.to,
        data: params.data,
        value: params.value || '0',
        nonce,
        ...gasSettings
      };

      // Estimate gas if not provided
      if (!params.gasLimit) {
        try {
          const estimatedGas = await this.provider.estimateGas(transaction);
          transaction.gasLimit = Math.floor(Number(estimatedGas) * this.config.gasMultiplier);
        } catch (error) {
          logger.warn({ error: error.message }, 'Gas estimation failed, using default');
          transaction.gasLimit = 200000; // Default gas limit
        }
      } else {
        transaction.gasLimit = params.gasLimit;
      }

      return transaction;
    } catch (error) {
      logger.error({ error: error.message, params }, 'Failed to prepare transaction');
      throw error;
    }
  }

  // Transaction simulation
  async simulateTransaction(
    transaction: TransactionRequest,
    fromAddress: string
  ): Promise<SimulationResult> {
    try {
      // Create transaction for simulation
      const simulationTx = {
        ...transaction,
        from: fromAddress
      };

      // Call the contract without executing
      const result = await this.provider.call(simulationTx);

      // Decode result if there's data
      if (result === '0x') {
        return {
          success: true,
          gasUsed: '0',
          status: 1,
          logs: []
        };
      }

      // Try to estimate gas
      let gasUsed = '0';
      try {
        gasUsed = (await this.provider.estimateGas(simulationTx)).toString();
      } catch (error) {
        // Gas estimation failed but call succeeded
        logger.warn({ error: error.message }, 'Gas estimation failed during simulation');
      }

      return {
        success: true,
        gasUsed,
        status: 1,
        logs: []
      };
    } catch (error: any) {
      return {
        success: false,
        gasUsed: '0',
        status: 0,
        logs: [],
        error: error.message,
        revertReason: error.data ? error.data : 'Unknown error'
      };
    }
  }

  // Single signature transaction
  async signTransaction(
    transaction: TransactionRequest,
    signerAddress: string
  ): Promise<SignedTransaction> {
    try {
      const wallet = this.getWallet(signerAddress);
      if (!wallet) {
        throw new Error(`Wallet not found: ${signerAddress}`);
      }

      // Sign transaction
      const signedTx = await wallet.signTransaction(transaction);
      const parsedTx = ethers.Transaction.from(signedTx);

      const signedTransaction: SignedTransaction = {
        signedTransaction: signedTx,
        transactionHash: parsedTx.hash!,
        nonce: parsedTx.nonce,
        gasLimit: parsedTx.gasLimit?.toString() || '0',
        gasPrice: parsedTx.gasPrice?.toString(),
        maxFeePerGas: parsedTx.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: parsedTx.maxPriorityFeePerGas?.toString(),
        value: parsedTx.value?.toString() || '0',
        to: parsedTx.to || '',
        data: parsedTx.data
      };

      logger.info(`Transaction signed: ${signedTransaction.transactionHash}`);
      return signedTransaction;
    } catch (error) {
      logger.error({
        error: error.message,
        signerAddress,
        transaction
      }, 'Failed to sign transaction');
      throw error;
    }
  }

  // Execute signed transaction
  async executeTransaction(
    signedTransaction: SignedTransaction,
    confirmations: number = this.config.confirmations
  ): Promise<TransactionResult> {
    try {
      logger.info(`Executing transaction: ${signedTransaction.transactionHash}`);

      // Send transaction
      const txResponse = await this.provider.broadcastTransaction(signedTransaction.signedTransaction);

      // Wait for confirmations
      const receipt = await txResponse.wait(confirmations);

      const result: TransactionResult = {
        transactionHash: txResponse.hash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.gasPrice?.toString(),
        status: receipt.status || 0,
        logs: [...receipt.logs],
        timestamp: (await this.provider.getBlock(receipt.blockNumber!)).timestamp
      };

      if (result.status === 1) {
        logger.info(`Transaction executed successfully: ${result.transactionHash}`);
      } else {
        logger.error({ transactionHash: result.transactionHash }, 'Transaction failed');
      }

      return result;
    } catch (error: any) {
      logger.error({
        error: error.message,
        transactionHash: signedTransaction.transactionHash
      }, 'Failed to execute transaction');
      throw error;
    }
  }

  // Complete flow: prepare, simulate, sign, and execute
  async executeTransactionFlow(
    params: TransactionParams,
    signerAddress: string,
    options: {
      simulate?: boolean;
      confirmations?: number;
    } = {}
  ): Promise<TransactionResult> {
    try {
      // Prepare transaction
      const transaction = await this.prepareTransaction(params, signerAddress);

      // Optional simulation
      if (options.simulate) {
        const simulation = await this.simulateTransaction(transaction, signerAddress);
        if (!simulation.success) {
          throw new Error(`Transaction simulation failed: ${simulation.revertReason}`);
        }
        logger.info(`Transaction simulation successful, gas used: ${simulation.gasUsed}`);
      }

      // Sign transaction
      const signedTransaction = await this.signTransaction(transaction, signerAddress);

      // Execute transaction
      return await this.executeTransaction(signedTransaction, options.confirmations);
    } catch (error) {
      logger.error({
        error: error.message,
        params,
        signerAddress
      }, 'Transaction flow failed');
      throw error;
    }
  }

  // Multi-signature transaction (simplified for now)
  async submitMultiSigTransaction(
    multiSigAddress: string,
    params: TransactionParams,
    submitterAddress: string
  ): Promise<{ transactionHash: string; confirmationCount: number }> {
    // For now, just execute as regular transaction
    // Multi-sig functionality would require specific contract ABI
    return this.executeTransactionFlow(params, submitterAddress).then(result => ({
      transactionHash: result.transactionHash,
      confirmationCount: 1
    }));
  }

  async confirmMultiSigTransaction(
    multiSigAddress: string,
    transactionHash: string,
    confirmerAddress: string
  ): Promise<{ confirmed: boolean; confirmationCount: number }> {
    // Placeholder implementation
    return {
      confirmed: true,
      confirmationCount: 1
    };
  }

  async executeMultiSigTransaction(
    multiSigAddress: string,
    transactionHash: string,
    executorAddress: string
  ): Promise<TransactionResult> {
    // Placeholder implementation - in reality would interact with multi-sig contract
    throw new Error('Multi-sig execution not implemented yet');
  }

  // Batch transaction support
  async createTransactionQueue(
    transactions: TransactionParams[],
    options: {
      batch?: boolean;
      maxGasPerBatch?: string;
      name?: string;
    } = {}
  ): Promise<string> {
    try {
      const queueId = options.name || `queue_${Date.now()}`;

      const queue: TransactionQueue = {
        queueId,
        transactions,
        batch: options.batch || false,
        maxGasPerBatch: options.maxGasPerBatch || '10000000', // 10 million gas
        status: 'pending'
      };

      this.transactionQueues.set(queueId, queue);

      logger.info(`Transaction queue created: ${queueId} with ${transactions.length} transactions`);

      return queueId;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create transaction queue');
      throw error;
    }
  }

  async executeTransactionQueue(
    queueId: string,
    signerAddress: string,
    options: {
      simulate?: boolean;
      confirmations?: number;
    } = {}
  ): Promise<TransactionResult[]> {
    try {
      const queue = this.transactionQueues.get(queueId);
      if (!queue) {
        throw new Error(`Transaction queue not found: ${queueId}`);
      }

      if (queue.status !== 'pending') {
        throw new Error(`Transaction queue is not pending: ${queue.status}`);
      }

      queue.status = 'executing';
      const results: TransactionResult[] = [];

      logger.info(`Executing transaction queue: ${queueId}`);

      for (let i = 0; i < queue.transactions.length; i++) {
        const tx = queue.transactions[i];

        try {
          logger.info(`Executing transaction ${i + 1}/${queue.transactions.length} in queue ${queueId}`);

          const result = await this.executeTransactionFlow(tx, signerAddress, options);
          results.push(result);

        } catch (error: any) {
          logger.error({ error: error.message, transactionNumber: i + 1, queueId }, `Transaction ${i + 1} failed in queue ${queueId}`);

          // Mark queue as failed
          queue.status = 'failed';
          throw new Error(`Transaction ${i + 1} failed: ${error.message}`);
        }
      }

      queue.status = 'completed';
      logger.info(`Transaction queue completed: ${queueId}`);

      return results;
    } catch (error) {
      logger.error({
        error: error.message,
        queueId
      }, 'Failed to execute transaction queue');
      throw error;
    }
  }

  // Transaction monitoring
  async getTransactionStatus(transactionHash: string): Promise<{
    found: boolean;
    confirmed: boolean;
    confirmations: number;
    blockNumber?: number;
    status?: number;
  }> {
    try {
      const receipt = await this.provider.getTransactionReceipt(transactionHash);

      if (!receipt) {
        return {
          found: false,
          confirmed: false,
          confirmations: 0
        };
      }

      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;

      return {
        found: true,
        confirmed: confirmations >= this.config.confirmations,
        confirmations,
        blockNumber: receipt.blockNumber,
        status: receipt.status
      };
    } catch (error) {
      logger.error({
        error: error.message,
        transactionHash
      }, 'Failed to get transaction status');
      throw error;
    }
  }

  async waitForTransaction(
    transactionHash: string,
    confirmations: number = this.config.confirmations,
    timeoutMs: number = this.config.timeoutMs
  ): Promise<TransactionResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const timeout = setTimeout(() => {
        reject(new Error(`Transaction confirmation timeout: ${transactionHash}`));
      }, timeoutMs);

      const checkTransaction = async () => {
        try {
          const receipt = await this.provider.getTransactionReceipt(transactionHash);

          if (receipt) {
            const currentBlock = await this.provider.getBlockNumber();
            const confirmationsCount = currentBlock - receipt.blockNumber;

            if (confirmationsCount >= confirmations) {
              clearTimeout(timeout);

              const result: TransactionResult = {
                transactionHash,
                blockNumber: receipt.blockNumber,
                blockHash: receipt.blockHash,
                gasUsed: receipt.gasUsed.toString(),
                effectiveGasPrice: receipt.gasPrice?.toString(),
                status: receipt.status || 0,
                logs: [...receipt.logs],
                timestamp: (await this.provider.getBlock(receipt.blockNumber!)).timestamp
              };

              resolve(result);
              return;
            }
          }

          // Check timeout
          if (Date.now() - startTime > timeoutMs) {
            clearTimeout(timeout);
            reject(new Error(`Transaction confirmation timeout: ${transactionHash}`));
            return;
          }

          // Check again after 2 seconds
          setTimeout(checkTransaction, 2000);
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      checkTransaction();
    });
  }

  // Gas optimization
  async getOptimalGasPrice(type: 'safe' | 'standard' | 'fast' = 'standard'): Promise<{
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  }> {
    try {
      const network = await this.provider.getNetwork();
      const isEIP1559 = Number(network.chainId) === 56 || Number(network.chainId) === 97; // BSC mainnet/testnet

      if (isEIP1559) {
        const feeData = await this.provider.getFeeData();

        let multiplier = 1;
        switch (type) {
          case 'safe':
            multiplier = 0.9;
            break;
          case 'standard':
            multiplier = 1;
            break;
          case 'fast':
            multiplier = 1.2;
            break;
        }

        return {
          maxFeePerGas: Math.floor(Number(feeData.maxFeePerGas || 20000000000) * multiplier).toString(),
          maxPriorityFeePerGas: Math.floor(Number(feeData.maxPriorityFeePerGas || 2000000000) * multiplier).toString()
        };
      } else {
        const feeData = await this.provider.getFeeData();
        const gasPrice = feeData.gasPrice?.toString() || '20000000000';

        let multiplier = 1;
        switch (type) {
          case 'safe':
            multiplier = 0.9;
            break;
          case 'standard':
            multiplier = 1;
            break;
          case 'fast':
            multiplier = 1.2;
            break;
        }

        return {
          gasPrice: Math.floor(Number(gasPrice) * multiplier).toString()
        };
      }
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get optimal gas price');
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      providerConnected: boolean;
      walletCount: number;
      multiSigCount: number;
      gasPrice: string;
      blockNumber: number;
      networkId: number;
    };
  }> {
    try {
      // Check provider connection
      let providerConnected = false;
      let blockNumber = 0;
      let networkId = 0;
      let gasPrice = '0';

      try {
        blockNumber = await this.provider.getBlockNumber();
        const network = await this.provider.getNetwork();
        networkId = Number(network.chainId);
        const feeData = await this.provider.getFeeData();
        gasPrice = feeData.gasPrice?.toString() || '20000000000';
        providerConnected = true;
      } catch (error) {
        logger.warn({ error: error.message }, 'Provider health check failed');
      }

      const walletCount = this.wallets.size;
      const multiSigCount = this.multiSigContracts.size;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (!providerConnected || walletCount === 0) {
        status = 'unhealthy';
      } else if (walletCount === 1 || multiSigCount === 0) {
        status = 'degraded';
      }

      return {
        status,
        details: {
          providerConnected,
          walletCount,
          multiSigCount,
          gasPrice,
          blockNumber,
          networkId
        }
      };
    } catch (error) {
      logger.error({ error: error.message }, 'Transaction signer health check failed');
      return {
        status: 'unhealthy',
        details: {
          providerConnected: false,
          walletCount: 0,
          multiSigCount: 0,
          gasPrice: '0',
          blockNumber: 0,
          networkId: 0
        }
      };
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    this.wallets.clear();
    this.multiSigContracts.clear();
    this.pendingTransactions.clear();
    this.transactionQueues.clear();
    logger.info('Transaction signer cleaned up');
  }
}

// Factory function
export function createTransactionSigner(
  rpcUrl: string,
  config: TransactionConfig = {},
  cache?: ICache
): TransactionSigner {
  return new TransactionSigner(rpcUrl, config, cache);
}

// Default signer instance
let defaultSigner: TransactionSigner | null = null;

export function getDefaultTransactionSigner(
  rpcUrl?: string,
  config?: TransactionConfig,
  cache?: ICache
): TransactionSigner {
  if (!defaultSigner && rpcUrl) {
    defaultSigner = new TransactionSigner(rpcUrl, config, cache);
  }

  if (!defaultSigner) {
    throw new Error('Default transaction signer not initialized. Call initializeDefaultSigner first.');
  }

  return defaultSigner;
}

export function initializeDefaultSigner(
  rpcUrl: string,
  config: TransactionConfig = {},
  cache?: ICache
): void {
  defaultSigner = new TransactionSigner(rpcUrl, config, cache);
}

export function clearDefaultSigner(): void {
  if (defaultSigner) {
    defaultSigner.cleanup();
    defaultSigner = null;
  }
}