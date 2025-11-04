import { Address, Hash, PrivateKeyAccount, createWalletClient, createPublicClient, http, parseEther, formatEther, Hex, Chain } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { getViemProvider } from '../providers/viem-provider';
import logger from '../../utils/logger';

// Simple cache interface
export interface ICache {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
}

// Transaction signing interfaces
export interface TransactionParams {
  to: Address;
  data?: Hex;
  value?: bigint;
  gasLimit?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  nonce?: number;
}

export interface TransactionRequest {
  to: Address;
  data?: Hex;
  value: bigint;
  gasLimit?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  nonce?: number;
  type?: 'legacy' | 'eip1559' | 'eip2930' | 'eip4844';
  chain?: Chain;
  account?: Address;
}

export interface SignedTransaction {
  signedTransaction: Hex;
  transactionHash: Hash;
  nonce: number;
  gasLimit: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  value: bigint;
  to: Address;
  data?: Hex;
}

export interface TransactionResult {
  transactionHash: Hash;
  blockNumber?: bigint;
  blockHash?: Hash;
  gasUsed: bigint;
  effectiveGasPrice?: bigint;
  status: 'success' | 'reverted';
  logs?: any[];
  timestamp?: number;
}

export interface TransactionConfig {
  maxGasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  gasMultiplier?: number;
  confirmations?: number;
  timeoutMs?: number;
  checkPending?: boolean;
}

export interface WalletConfig {
  privateKey: Hex;
  address: Address;
  index: number;
  name: string;
}

export interface MultiSigConfig {
  threshold: number;
  owners: Address[];
  nonce: number;
}

export interface SignatureRequest {
  transactionHash: Hash;
  signatures: Hex[];
  nonce: number;
  threshold: number;
  deadline?: number;
}

export interface SimulationResult {
  success: boolean;
  gasUsed: bigint;
  status: number;
  logs: any[];
  error?: string;
  revertReason?: string;
}

export interface TransactionQueue {
  queueId: string;
  transactions: TransactionParams[];
  batch: boolean;
  maxGasPerBatch: bigint;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

/**
 * Viem-based Transaction Signer
 * Provides transaction signing and management functionality using Viem
 */
export class TransactionSignerViem {
  private publicClient: any;
  private walletClients: Map<Address, any> = new Map();
  private accounts: Map<Address, any> = new Map();
  private pendingTransactions: Map<string, TransactionParams> = new Map();
  private transactionQueues: Map<string, TransactionQueue> = new Map();
  private config: TransactionConfig;
  private cache: ICache;
  private chain: Chain;

  constructor(
    private rpcUrl: string,
    config: TransactionConfig = {},
    cache?: ICache,
    chain: Chain = bsc
  ) {
    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl)
    });

    this.chain = chain;
    this.config = {
      maxGasPrice: config.maxGasPrice || parseEther('0.0000001'), // 100 Gwei
      maxFeePerGas: config.maxFeePerGas || parseEther('0.0000001'),
      maxPriorityFeePerGas: config.maxPriorityFeePerGas || parseEther('0.000000002'), // 2 Gwei
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
      const account = privateKeyToAccount(walletConfig.privateKey);

      // Verify address matches
      if (account.address.toLowerCase() !== walletConfig.address.toLowerCase()) {
        throw new Error('Private key does not match provided address');
      }

      const walletClient = createWalletClient({
        account,
        chain: this.chain,
        transport: http(this.rpcUrl)
      });

      this.walletClients.set(walletConfig.address, walletClient);
      this.accounts.set(walletConfig.address, account);

      logger.info(`Wallet added: ${walletConfig.address.substring(0, 6)}...`);
    } catch (error) {
      logger.error({ error: (error as Error).message, address: walletConfig.address }, 'Failed to add wallet');
      throw error;
    }
  }

  async removeWallet(address: Address): Promise<void> {
    const wallet = this.walletClients.get(address);
    if (wallet) {
      this.walletClients.delete(address);
      this.accounts.delete(address);
      logger.info(`Wallet removed: ${address.substring(0, 6)}...`);
    }
  }

  getWallet(address: Address): any | undefined {
    return this.walletClients.get(address as Address);
  }

  getWallets(): Address[] {
    return Array.from(this.walletClients.keys());
  }

  // Transaction preparation
  async prepareTransaction(
    params: TransactionParams,
    signerAddress?: Address
  ): Promise<TransactionRequest> {
    try {
      // Get nonce
      let nonce = params.nonce;
      if (nonce === undefined && signerAddress) {
        nonce = await this.publicClient.getTransactionCount({ address: signerAddress });
      }

      // Prepare gas settings
      const isEIP1559 = this.chain.id === bsc.id || this.chain.id === bscTestnet.id;

      let gasSettings: any = {};

      if (isEIP1559) {
        const feeData = await this.publicClient.estimateFeesPerGas();
        gasSettings = {
          type: 'eip1559',
          maxFeePerGas: params.maxFeePerGas || feeData.maxFeePerGas || parseEther('0.00000002'),
          maxPriorityFeePerGas: params.maxPriorityFeePerGas || feeData.maxPriorityFeePerGas || parseEther('0.000000002')
        };
      } else {
        const gasPrice = params.gasPrice || await this.publicClient.getGasPrice();
        gasSettings = {
          type: 'legacy',
          gasPrice
        };
      }

      // Prepare transaction
      const transaction: TransactionRequest = {
        to: params.to,
        data: params.data,
        value: params.value || 0n,
        nonce,
        chain: this.chain,
        ...gasSettings
      };

      // Estimate gas if not provided
      if (!params.gasLimit) {
        try {
          const estimatedGas = await this.publicClient.estimateGas({
            ...transaction,
            account: signerAddress
          });
          transaction.gasLimit = BigInt(Math.floor(Number(estimatedGas) * this.config.gasMultiplier));
        } catch (error) {
          logger.warn({ error: (error as Error).message }, 'Gas estimation failed, using default');
          transaction.gasLimit = BigInt(200000); // Default gas limit
        }
      } else {
        transaction.gasLimit = params.gasLimit;
      }

      return transaction;
    } catch (error) {
      logger.error({ error: (error as Error).message, params }, 'Failed to prepare transaction');
      throw error;
    }
  }

  // Transaction simulation
  async simulateTransaction(
    transaction: TransactionRequest,
    fromAddress: Address
  ): Promise<SimulationResult> {
    try {
      // Create transaction for simulation
      const simulationTx = {
        ...transaction,
        account: fromAddress
      };

      // Call the contract without executing
      const result = await this.publicClient.call(simulationTx);

      return {
        success: true,
        gasUsed: result.gasUsed || 0n,
        status: 1,
        logs: result.logs || []
      };
    } catch (error: any) {
      return {
        success: false,
        gasUsed: 0n,
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
    signerAddress: Address
  ): Promise<SignedTransaction> {
    try {
      const walletClient = this.getWallet(signerAddress);
      if (!walletClient) {
        throw new Error(`Wallet not found: ${signerAddress}`);
      }

      const account = this.accounts.get(signerAddress)!;

      // Prepare the transaction for signing
      const txToSign = {
        ...transaction,
        account
      };

      // Sign transaction
      const signedTx = await walletClient.signTransaction(txToSign);

      // Get transaction hash
      const transactionHash = await walletClient.sendRawTransaction({ serializedTransaction: signedTx });

      const signedTransaction: SignedTransaction = {
        signedTransaction: signedTx,
        transactionHash,
        nonce: transaction.nonce || 0,
        gasLimit: transaction.gasLimit || 0n,
        gasPrice: transaction.gasPrice,
        maxFeePerGas: transaction.maxFeePerGas,
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
        value: transaction.value || 0n,
        to: transaction.to,
        data: transaction.data
      };

      logger.info(`Transaction signed: ${signedTransaction.transactionHash}`);
      return signedTransaction;
    } catch (error) {
      logger.error({
        error: (error as Error).message,
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

      // Send transaction (already signed, just broadcast)
      const txHash = await this.publicClient.sendRawTransaction({
        serializedTransaction: signedTransaction.signedTransaction
      });

      // Wait for confirmations
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations
      });

      const result: TransactionResult = {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
        status: receipt.status === 'success' ? 'success' : 'reverted',
        logs: receipt.logs || []
      };

      // Get timestamp
      if (receipt.blockNumber) {
        const block = await this.publicClient.getBlock({ blockNumber: receipt.blockNumber });
        result.timestamp = Number(block.timestamp);
      }

      if (result.status === 'success') {
        logger.info(`Transaction executed successfully: ${result.transactionHash}`);
      } else {
        logger.error({ transactionHash: result.transactionHash }, 'Transaction failed');
      }

      return result;
    } catch (error) {
      logger.error({
        error: (error as Error).message,
        transactionHash: signedTransaction.transactionHash
      }, 'Failed to execute transaction');
      throw error;
    }
  }

  // Complete flow: prepare, simulate, sign, and execute
  async executeTransactionFlow(
    params: TransactionParams,
    signerAddress: Address,
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
        error: (error as Error).message,
        params,
        signerAddress
      }, 'Transaction flow failed');
      throw error;
    }
  }

  // Batch transaction support
  async createTransactionQueue(
    transactions: TransactionParams[],
    options: {
      batch?: boolean;
      maxGasPerBatch?: bigint;
      name?: string;
    } = {}
  ): Promise<string> {
    try {
      const queueId = options.name || `queue_${Date.now()}`;

      const queue: TransactionQueue = {
        queueId,
        transactions,
        batch: options.batch || false,
        maxGasPerBatch: options.maxGasPerBatch || parseEther('0.01'), // 0.01 BNB
        status: 'pending'
      };

      this.transactionQueues.set(queueId, queue);

      logger.info(`Transaction queue created: ${queueId} with ${transactions.length} transactions`);

      return queueId;
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Failed to create transaction queue');
      throw error;
    }
  }

  async executeTransactionQueue(
    queueId: string,
    signerAddress: Address,
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
        error: (error as Error).message,
        queueId
      }, 'Failed to execute transaction queue');
      throw error;
    }
  }

  // Transaction monitoring
  async getTransactionStatus(transactionHash: Hash): Promise<{
    found: boolean;
    confirmed: boolean;
    confirmations: number;
    blockNumber?: bigint;
    status?: 'success' | 'reverted';
  }> {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({ hash: transactionHash });

      if (!receipt) {
        return {
          found: false,
          confirmed: false,
          confirmations: 0
        };
      }

      const currentBlock = await this.publicClient.getBlockNumber();
      const confirmations = Number(currentBlock - (receipt.blockNumber || 0n));

      return {
        found: true,
        confirmed: confirmations >= this.config.confirmations,
        confirmations,
        blockNumber: receipt.blockNumber || undefined,
        status: receipt.status === 'success' ? 'success' : 'reverted'
      };
    } catch (error) {
      logger.error({
        error: (error as Error).message,
        transactionHash
      }, 'Failed to get transaction status');
      throw error;
    }
  }

  async waitForTransaction(
    transactionHash: Hash,
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
          const receipt = await this.publicClient.getTransactionReceipt({ hash: transactionHash });

          if (receipt) {
            const currentBlock = await this.publicClient.getBlockNumber();
            const confirmationsCount = Number(currentBlock - (receipt.blockNumber || 0n));

            if (confirmationsCount >= confirmations) {
              clearTimeout(timeout);

              const result: TransactionResult = {
                transactionHash,
                blockNumber: receipt.blockNumber || undefined,
                blockHash: receipt.blockHash || undefined,
                gasUsed: receipt.gasUsed,
                effectiveGasPrice: receipt.effectiveGasPrice,
                status: receipt.status === 'success' ? 'success' : 'reverted',
                logs: receipt.logs || []
              };

              // Get timestamp
              if (receipt.blockNumber) {
                const block = await this.publicClient.getBlock({ blockNumber: receipt.blockNumber });
                result.timestamp = Number(block.timestamp);
              }

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
    gasPrice?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
  }> {
    try {
      const isEIP1559 = this.chain.id === bsc.id || this.chain.id === bscTestnet.id;

      if (isEIP1559) {
        const feeData = await this.publicClient.estimateFeesPerGas();

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
          maxFeePerGas: (feeData.maxFeePerGas || parseEther('0.00000002')) * BigInt(Math.floor(multiplier * 100)) / 100n,
          maxPriorityFeePerGas: (feeData.maxPriorityFeePerGas || parseEther('0.000000002')) * BigInt(Math.floor(multiplier * 100)) / 100n
        };
      } else {
        const gasPrice = await this.publicClient.getGasPrice();

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
          gasPrice: gasPrice * BigInt(Math.floor(multiplier * 100)) / 100n
        };
      }
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Failed to get optimal gas price');
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      providerConnected: boolean;
      walletCount: number;
      gasPrice: string;
      blockNumber: bigint;
      networkId: number;
    };
  }> {
    try {
      // Check provider connection
      let providerConnected = false;
      let blockNumber = 0n;
      let networkId = 0;
      let gasPrice = '0';

      try {
        blockNumber = await this.publicClient.getBlockNumber();
        networkId = this.chain.id;
        const gasPriceData = await this.publicClient.getGasPrice();
        gasPrice = gasPriceData.toString();
        providerConnected = true;
      } catch (error) {
        logger.warn({ error: (error as Error).message }, 'Provider health check failed');
      }

      const walletCount = this.walletClients.size;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (!providerConnected || walletCount === 0) {
        status = 'unhealthy';
      } else if (walletCount === 1) {
        status = 'degraded';
      }

      return {
        status,
        details: {
          providerConnected,
          walletCount,
          gasPrice,
          blockNumber,
          networkId
        }
      };
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Transaction signer health check failed');
      return {
        status: 'unhealthy',
        details: {
          providerConnected: false,
          walletCount: 0,
          gasPrice: '0',
          blockNumber: 0n,
          networkId: 0
        }
      };
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    this.walletClients.clear();
    this.accounts.clear();
    this.pendingTransactions.clear();
    this.transactionQueues.clear();
    logger.info('Transaction signer cleaned up');
  }
}

// Factory function
export function createTransactionSignerViem(
  rpcUrl: string,
  config: TransactionConfig = {},
  cache?: ICache,
  chain: Chain = bsc
): TransactionSignerViem {
  return new TransactionSignerViem(rpcUrl, config, cache, chain);
}

// Default signer instance
let defaultSigner: TransactionSignerViem | null = null;

export function getDefaultTransactionSignerViem(
  rpcUrl?: string,
  config?: TransactionConfig,
  cache?: ICache,
  chain?: Chain
): TransactionSignerViem {
  if (!defaultSigner && rpcUrl) {
    defaultSigner = new TransactionSignerViem(rpcUrl, config, cache, chain);
  }

  if (!defaultSigner) {
    throw new Error('Default transaction signer not initialized. Call initializeDefaultSignerViem first.');
  }

  return defaultSigner;
}

export function initializeDefaultSignerViem(
  rpcUrl: string,
  config?: TransactionConfig,
  cache?: ICache,
  chain?: Chain
): void {
  defaultSigner = new TransactionSignerViem(rpcUrl, config, cache, chain);
}

export function clearDefaultSignerViem(): void {
  if (defaultSigner) {
    defaultSigner.cleanup();
    defaultSigner = null;
  }
}

// Helper function to create account from private key
function privateKeyToAccount(privateKey: Hex): PrivateKeyAccount {
  const { privateKeyToAccount: viemPrivateKeyToAccount } = require('viem/accounts');
  return viemPrivateKeyToAccount(privateKey);
}

export default createTransactionSignerViem;