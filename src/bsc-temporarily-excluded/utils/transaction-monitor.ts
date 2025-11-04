import { ethers, JsonRpcProvider, TransactionReceipt, TransactionResponse } from 'ethers';
import logger from '../../utils/logger';

/**
 * Transaction status
 */
export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  REPLACED = 'replaced',
  CANCELLED = 'cancelled',
}

/**
 * Transaction monitoring data
 */
export interface TransactionInfo {
  hash: string;
  status: TransactionStatus;
  from: string;
  to?: string;
  value: string;
  gasUsed?: number;
  gasLimit?: number;
  gasPrice?: string;
  blockNumber?: number;
  blockHash?: string;
  timestamp?: number;
  confirmations?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Transaction monitoring options
 */
export interface MonitoringOptions {
  timeout?: number; // in milliseconds
  confirmations?: number; // number of confirmations required
  pollingInterval?: number; // in milliseconds
  maxRetries?: number;
}

/**
 * BSC Transaction Monitor
 * Handles transaction monitoring, status tracking, and logging for BSC transactions
 */
export class BSCTransactionMonitor {
  private activeTransactions = new Map<string, TransactionInfo>();
  private monitoringPromises = new Map<string, Promise<TransactionInfo>>();

  /**
   * Start monitoring a transaction
   */
  public async monitorTransaction(
    hash: string,
    provider: JsonRpcProvider,
    options: MonitoringOptions = {}
  ): Promise<TransactionInfo> {
    // Check if already monitoring
    if (this.monitoringPromises.has(hash)) {
      return this.monitoringPromises.get(hash)!;
    }

    const {
      timeout = 30000, // 30 seconds default
      confirmations = 1, // BSC is fast, 1 confirmation is usually enough
      pollingInterval = 2000, // 2 seconds for BSC
      maxRetries = 15,
    } = options;

    const transactionInfo: TransactionInfo = {
      hash,
      status: TransactionStatus.PENDING,
      from: '',
      value: '0',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.activeTransactions.set(hash, transactionInfo);

    const monitoringPromise = this.monitorTransactionWithRetry(
      hash,
      provider,
      { timeout, confirmations, pollingInterval, maxRetries }
    );

    this.monitoringPromises.set(hash, monitoringPromise);

    try {
      const result = await monitoringPromise;
      return result;
    } finally {
      this.monitoringPromises.delete(hash);
      // Keep transaction info for a while for debugging
      setTimeout(() => {
        this.activeTransactions.delete(hash);
      }, 300000); // 5 minutes
    }
  }

  /**
   * Internal monitoring with retry logic
   */
  private async monitorTransactionWithRetry(
    hash: string,
    provider: JsonRpcProvider,
    options: Required<MonitoringOptions>
  ): Promise<TransactionInfo> {
    const { timeout, confirmations, pollingInterval, maxRetries } = options;
    const startTime = Date.now();
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        // Check timeout
        if (Date.now() - startTime > timeout) {
          throw new Error(`Transaction monitoring timeout after ${timeout}ms`);
        }

        const transactionInfo = this.activeTransactions.get(hash);
        if (!transactionInfo) {
          throw new Error('Transaction info not found');
        }

        // Get transaction receipt
        const receipt = await provider.getTransactionReceipt(hash);

        if (receipt) {
          return await this.handleConfirmedTransaction(hash, receipt, provider, confirmations);
        }

        // Transaction still pending, log and wait
        logger.debug({ hash, retry: retryCount + 1, maxRetries }, `Transaction ${hash} still pending`);

        await this.sleep(pollingInterval);
        retryCount++;

      } catch (error) {
        const transactionInfo = this.activeTransactions.get(hash);
        if (transactionInfo) {
          transactionInfo.status = TransactionStatus.FAILED;
          transactionInfo.error = error instanceof Error ? error.message : 'Unknown error';
          transactionInfo.updatedAt = new Date();
        }

        logger.error({ hash, error: error instanceof Error ? error.message : 'Unknown error' }, `Transaction monitoring failed`);
        throw error;
      }
    }

    throw new Error(`Transaction monitoring failed after ${maxRetries} retries`);
  }

  /**
   * Handle confirmed transaction
   */
  private async handleConfirmedTransaction(
    hash: string,
    receipt: TransactionReceipt,
    provider: JsonRpcProvider,
    requiredConfirmations: number
  ): Promise<TransactionInfo> {
    const transactionInfo = this.activeTransactions.get(hash);
    if (!transactionInfo) {
      throw new Error('Transaction info not found');
    }

    try {
      // Get transaction details
      const transaction = await provider.getTransaction(hash);

      // Update transaction info
      transactionInfo.status = receipt.status === 1 ? TransactionStatus.CONFIRMED : TransactionStatus.FAILED;
      transactionInfo.from = transaction.from;
      transactionInfo.to = transaction.to || undefined;
      transactionInfo.value = ethers.formatEther(transaction.value);
      transactionInfo.gasUsed = Number(receipt.gasUsed);
      transactionInfo.gasLimit = Number(transaction.gasLimit);
      transactionInfo.gasPrice = transaction.gasPrice ? ethers.formatUnits(transaction.gasPrice, 'gwei') : undefined;
      transactionInfo.blockNumber = receipt.blockNumber ? Number(receipt.blockNumber) : undefined;
      transactionInfo.blockHash = receipt.blockHash || undefined;
      transactionInfo.confirmations = Number(receipt.confirmations);
      transactionInfo.updatedAt = new Date();

      // Get block timestamp
      if (receipt.blockNumber) {
        const block = await provider.getBlock(receipt.blockNumber);
        if (block) {
          transactionInfo.timestamp = block.timestamp;
        }
      }

      // Check confirmations
      const currentBlock = await provider.getBlockNumber();
      const confirmations = currentBlock - Number(receipt.blockNumber || 0);

      if (confirmations >= requiredConfirmations) {
        this.logTransactionInfo(transactionInfo);
        return transactionInfo;
      }

      // Wait for more confirmations
      await this.waitForConfirmations(hash, provider, requiredConfirmations);
      return transactionInfo;

    } catch (error) {
      transactionInfo.status = TransactionStatus.FAILED;
      transactionInfo.error = error instanceof Error ? error.message : 'Unknown error';
      transactionInfo.updatedAt = new Date();
      throw error;
    }
  }

  /**
   * Wait for additional confirmations
   */
  private async waitForConfirmations(
    hash: string,
    provider: JsonRpcProvider,
    requiredConfirmations: number
  ): Promise<void> {
    const transactionInfo = this.activeTransactions.get(hash);
    if (!transactionInfo) return;

    const checkInterval = 2000; // 2 seconds
    const maxWaitTime = 60000; // 1 minute max wait for additional confirmations
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const receipt = await provider.getTransactionReceipt(hash);
        if (receipt && Number(receipt.confirmations) >= requiredConfirmations) {
          transactionInfo.confirmations = Number(receipt.confirmations);
          this.logTransactionInfo(transactionInfo);
          return;
        }

        await this.sleep(checkInterval);
      } catch (error) {
        logger.error({ hash, error: error instanceof Error ? error.message : 'Unknown error' }, `Error checking confirmations`);
        break;
      }
    }

    logger.warn(`Transaction ${hash} didn't reach required confirmations in time`);
  }

  /**
   * Log transaction information
   */
  private logTransactionInfo(transactionInfo: TransactionInfo): void {
    const statusEmoji = transactionInfo.status === TransactionStatus.CONFIRMED ? '✅' : '❌';

    logger.info({
      hash: transactionInfo.hash,
      status: transactionInfo.status,
      from: transactionInfo.from,
      to: transactionInfo.to,
      value: transactionInfo.value,
      gasUsed: transactionInfo.gasUsed,
      gasPrice: transactionInfo.gasPrice,
      blockNumber: transactionInfo.blockNumber,
      confirmations: transactionInfo.confirmations,
      duration: `${Date.now() - transactionInfo.createdAt.getTime()}ms`,
    }, `${statusEmoji} Transaction ${transactionInfo.hash} ${transactionInfo.status}`);
  }

  /**
   * Get transaction info
   */
  public getTransactionInfo(hash: string): TransactionInfo | undefined {
    return this.activeTransactions.get(hash);
  }

  /**
   * Get all active transactions
   */
  public getActiveTransactions(): TransactionInfo[] {
    return Array.from(this.activeTransactions.values());
  }

  /**
   * Get transactions by status
   */
  public getTransactionsByStatus(status: TransactionStatus): TransactionInfo[] {
    return this.getActiveTransactions().filter(tx => tx.status === status);
  }

  /**
   * Cancel transaction monitoring
   */
  public cancelMonitoring(hash: string): void {
    this.monitoringPromises.delete(hash);
    const transactionInfo = this.activeTransactions.get(hash);
    if (transactionInfo) {
      transactionInfo.status = TransactionStatus.CANCELLED;
      transactionInfo.updatedAt = new Date();
    }
  }

  /**
   * Get transaction statistics
   */
  public getStatistics(): {
    total: number;
    pending: number;
    confirmed: number;
    failed: number;
    cancelled: number;
  } {
    const transactions = this.getActiveTransactions();

    return {
      total: transactions.length,
      pending: transactions.filter(tx => tx.status === TransactionStatus.PENDING).length,
      confirmed: transactions.filter(tx => tx.status === TransactionStatus.CONFIRMED).length,
      failed: transactions.filter(tx => tx.status === TransactionStatus.FAILED).length,
      cancelled: transactions.filter(tx => tx.status === TransactionStatus.CANCELLED).length,
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const bscTransactionMonitor = new BSCTransactionMonitor();

// Export convenience functions
export const monitorTransaction = (
  hash: string,
  provider: JsonRpcProvider,
  options?: MonitoringOptions
) => bscTransactionMonitor.monitorTransaction(hash, provider, options);

export const getTransactionInfo = (hash: string) =>
  bscTransactionMonitor.getTransactionInfo(hash);

export const getTransactionStatistics = () => bscTransactionMonitor.getStatistics();