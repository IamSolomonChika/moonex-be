import { Address, Hash, Hex } from 'viem';
import { TransactionSignerViem, TransactionResult } from '../contracts/transaction-signer-viem';
import logger from '../../utils/logger';

/**
 * Transaction Confirmation Utilities for Viem
 * Provides enhanced transaction confirmation patterns and monitoring
 */

export interface ConfirmationConfig {
  confirmations?: number;
  timeoutMs?: number;
  pollInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  enableEventMonitoring?: boolean;
  enableGasBoost?: boolean;
  gasBoostMultiplier?: number;
}

export interface TransactionStatus {
  hash: Hash;
  status: 'pending' | 'confirmed' | 'failed' | 'replaced' | 'cancelled';
  blockNumber?: bigint;
  blockHash?: Hash;
  gasUsed?: bigint;
  effectiveGasPrice?: bigint;
  confirmations: number;
  timestamp?: number;
  error?: string;
}

export interface ConfirmationResult {
  success: boolean;
  transaction: TransactionStatus;
  confirmations: number;
  finalityLevel: 'safe' | 'finalized' | 'confirmed' | 'pending';
  monitoringStopped: boolean;
  error?: string;
}

export interface EventFilter {
  address?: Address;
  topics?: (string | string[] | null)[];
  fromBlock?: bigint | 'latest' | 'earliest';
  toBlock?: bigint | 'latest' | 'earliest';
}

export interface TransactionMonitor {
  start: (transactionHash: Hash) => void;
  stop: () => void;
  getStatus: () => TransactionStatus;
  onConfirmation: (callback: (status: TransactionStatus) => void) => void;
  onFailure: (callback: (error: string) => void) => void;
}

/**
 * Enhanced Transaction Confirmation using Viem
 */
export class TransactionConfirmationViem {
  private signer: TransactionSignerViem;
  private config: ConfirmationConfig;
  private activeMonitors: Map<Hash, TransactionMonitor> = new Map();

  constructor(
    signer: TransactionSignerViem,
    config: ConfirmationConfig = {}
  ) {
    this.signer = signer;
    this.config = {
      confirmations: config.confirmations || 1,
      timeoutMs: config.timeoutMs || 300000, // 5 minutes
      pollInterval: config.pollInterval || 2000, // 2 seconds
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5000,
      enableEventMonitoring: config.enableEventMonitoring || false,
      enableGasBoost: config.enableGasBoost || false,
      gasBoostMultiplier: config.gasBoostMultiplier || 1.2,
      ...config
    };
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(
    transactionHash: Hash,
    options: {
      confirmations?: number;
      timeoutMs?: number;
      pollInterval?: number;
    } = {}
  ): Promise<ConfirmationResult> {
    try {
      const confirmations = options.confirmations || this.config.confirmations;
      const timeoutMs = options.timeoutMs || this.config.timeoutMs;
      const pollInterval = options.pollInterval || this.config.pollInterval;

      logger.info('Waiting for transaction confirmation', {
        hash: transactionHash,
        confirmations,
        timeoutMs
      });

      const result = await this.signer.waitForTransaction(
        transactionHash,
        confirmations,
        timeoutMs
      );

      const status: TransactionStatus = {
        hash: transactionHash,
        status: result.status === 'success' ? 'confirmed' : 'failed',
        blockNumber: result.blockNumber,
        blockHash: result.blockHash,
        gasUsed: result.gasUsed,
        effectiveGasPrice: result.effectiveGasPrice,
        confirmations,
        timestamp: result.timestamp
      };

      const finalityLevel = this.determineFinalityLevel(status, confirmations);

      const confirmationResult: ConfirmationResult = {
        success: result.status === 'success',
        transaction: status,
        confirmations,
        finalityLevel,
        monitoringStopped: true
      };

      logger.info('Transaction confirmation completed', {
        hash: transactionHash,
        success: confirmationResult.success,
        confirmations: confirmationResult.confirmations,
        finalityLevel: confirmationResult.finalityLevel
      });

      return confirmationResult;
    } catch (error) {
      logger.error({
        error: (error as Error).message,
        transactionHash
      }, 'Transaction confirmation failed');

      const failedStatus: TransactionStatus = {
        hash: transactionHash,
        status: 'failed',
        confirmations: 0,
        error: (error as Error).message
      };

      return {
        success: false,
        transaction: failedStatus,
        confirmations: 0,
        finalityLevel: 'pending',
        monitoringStopped: true,
        error: (error as Error).message
      };
    }
  }

  /**
   * Monitor transaction with enhanced features
   */
  createTransactionMonitor(transactionHash: Hash): TransactionMonitor {
    let status: TransactionStatus = {
      hash: transactionHash,
      status: 'pending',
      confirmations: 0
    };

    let monitoring = false;
    let confirmationCallbacks: ((status: TransactionStatus) => void)[] = [];
    let failureCallbacks: ((error: string) => void)[] = [];

    const monitor: TransactionMonitor = {
      start: (hash: Hash) => {
        if (monitoring) return;

        monitoring = true;
        status.hash = hash;

        this.activeMonitors.set(hash, monitor);

        logger.info('Starting transaction monitoring', { hash });

        this.pollTransactionStatus(hash, pollInterval => {
          if (!monitoring) return;

          this.signer.getTransactionStatus(hash)
            .then(txStatus => {
              const newStatus: TransactionStatus = {
                hash,
                status: txStatus.found && txStatus.confirmed ? 'confirmed' : 'pending',
                confirmations: txStatus.confirmations,
                blockNumber: txStatus.blockNumber
              };

              if (newStatus.status !== status.status || newStatus.confirmations !== status.confirmations) {
                status = newStatus;
                confirmationCallbacks.forEach(callback => callback(status));
              }

              // Stop monitoring if confirmed
              if (txStatus.confirmed && txStatus.confirmations >= this.config.confirmations) {
                monitor.stop();
              }
            })
            .catch(error => {
              logger.error({ error: error.message, hash }, 'Transaction monitoring error');
              failureCallbacks.forEach(callback => callback(error.message));
              monitor.stop();
            });
        });
      },

      stop: () => {
        if (!monitoring) return;

        monitoring = false;
        this.activeMonitors.delete(status.hash);

        logger.info('Transaction monitoring stopped', { hash: status.hash });
      },

      getStatus: () => ({ ...status }),

      onConfirmation: (callback: (status: TransactionStatus) => void) => {
        confirmationCallbacks.push(callback);
      },

      onFailure: (callback: (error: string) => void) => {
        failureCallbacks.push(callback);
      }
    };

    return monitor;
  }

  /**
   * Batch confirmation for multiple transactions
   */
  async waitForBatchConfirmation(
    transactionHashes: Hash[],
    options: {
      confirmations?: number;
      timeoutMs?: number;
      failFast?: boolean;
    } = {}
  ): Promise<Map<Hash, ConfirmationResult>> {
    try {
      const results = new Map<Hash, ConfirmationResult>();
      const confirmations = options.confirmations || this.config.confirmations;
      const timeoutMs = options.timeoutMs || this.config.timeoutMs;
      const failFast = options.failFast || false;

      logger.info('Starting batch transaction confirmation', {
        transactionCount: transactionHashes.length,
        confirmations,
        timeoutMs,
        failFast
      });

      const promises = transactionHashes.map(async (hash) => {
        try {
          const result = await this.waitForConfirmation(hash, {
            confirmations,
            timeoutMs
          });
          results.set(hash, result);

          if (!result.success && failFast) {
            throw new Error(`Transaction ${hash} failed: ${result.error}`);
          }

          return { hash, result };
        } catch (error) {
          const failedResult: ConfirmationResult = {
            success: false,
            transaction: {
              hash,
              status: 'failed',
              confirmations: 0,
              error: (error as Error).message
            },
            confirmations: 0,
            finalityLevel: 'pending',
            monitoringStopped: true,
            error: (error as Error).message
          };

          results.set(hash, failedResult);

          if (failFast) {
            throw error;
          }

          return { hash, result: failedResult };
        }
      });

      await Promise.allSettled(promises);

      const successCount = Array.from(results.values()).filter(r => r.success).length;
      const failureCount = results.size - successCount;

      logger.info('Batch transaction confirmation completed', {
        total: transactionHashes.length,
        success: successCount,
        failures: failureCount
      });

      return results;
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Batch confirmation failed');
      throw error;
    }
  }

  /**
   * Get transaction status with enhanced information
   */
  async getEnhancedTransactionStatus(transactionHash: Hash): Promise<TransactionStatus> {
    try {
      const basicStatus = await this.signer.getTransactionStatus(transactionHash);

      const status: TransactionStatus = {
        hash: transactionHash,
        status: basicStatus.found && basicStatus.confirmed ? 'confirmed' : 'pending',
        confirmations: basicStatus.confirmations,
        blockNumber: basicStatus.blockNumber
      };

      return status;
    } catch (error) {
      logger.error({
        error: (error as Error).message,
        transactionHash
      }, 'Failed to get enhanced transaction status');

      return {
        hash: transactionHash,
        status: 'failed',
        confirmations: 0,
        error: (error as Error).message
      };
    }
  }

  /**
   * Estimate confirmation time
   */
  async estimateConfirmationTime(
    transactionHash: Hash,
    options: {
      confirmations?: number;
    } = {}
  ): Promise<{
    estimatedSeconds: number;
    confidence: number;
    factors: string[];
  }> {
    try {
      const confirmations = options.confirmations || this.config.confirmations;
      const status = await this.getEnhancedTransactionStatus(transactionHash);

      // BSC has ~3 second block time
      const blockTime = 3;
      const remainingConfirmations = Math.max(0, confirmations - status.confirmations);
      const baseEstimate = remainingConfirmations * blockTime;

      // Add factors that might affect confirmation time
      const factors: string[] = [];
      let confidence = 0.8;

      if (status.confirmations === 0) {
        factors.push('Transaction not yet included in block');
        confidence = 0.6;
      }

      if (status.confirmations > 0) {
        factors.push('Transaction included in block');
        confidence = 0.9;
      }

      const estimatedSeconds = baseEstimate + (1 - confidence) * baseEstimate;

      return {
        estimatedSeconds,
        confidence,
        factors
      };
    } catch (error) {
      logger.error({
        error: (error as Error).message,
        transactionHash
      }, 'Failed to estimate confirmation time');

      return {
        estimatedSeconds: 60,
        confidence: 0.1,
        factors: ['Error occurred during estimation']
      };
    }
  }

  /**
   * Check if transaction can be replaced (higher gas price)
   */
  async canReplaceTransaction(transactionHash: Hash): Promise<{
    replaceable: boolean;
    suggestedGasPrice?: bigint;
    reason?: string;
  }> {
    try {
      const status = await this.getEnhancedTransactionStatus(transactionHash);

      if (status.status !== 'pending') {
        return {
          replaceable: false,
          reason: 'Transaction is no longer pending'
        };
      }

      // Get current gas price
      const gasData = await this.signer.getOptimalGasPrice('standard');
      const currentGasPrice = gasData.gasPrice || gasData.maxFeePerGas;

      if (!currentGasPrice) {
        return {
          replaceable: false,
          reason: 'Could not determine current gas price'
        };
      }

      const suggestedGasPrice = currentGasPrice * BigInt(Math.floor(this.config.gasBoostMultiplier! * 100)) / 100n;

      return {
        replaceable: true,
        suggestedGasPrice
      };
    } catch (error) {
      logger.error({
        error: (error as Error).message,
        transactionHash
      }, 'Failed to check transaction replaceability');

      return {
        replaceable: false,
        reason: 'Error occurred while checking replaceability'
      };
    }
  }

  /**
   * Clean up active monitors
   */
  cleanup(): void {
    logger.info('Cleaning up transaction monitors', {
      activeMonitors: this.activeMonitors.size
    });

    this.activeMonitors.forEach(monitor => monitor.stop());
    this.activeMonitors.clear();
  }

  // Private helper methods
  private determineFinalityLevel(status: TransactionStatus, requiredConfirmations: number): 'safe' | 'finalized' | 'confirmed' | 'pending' {
    if (status.status !== 'confirmed') {
      return 'pending';
    }

    if (status.confirmations >= requiredConfirmations) {
      if (status.confirmations >= 12) {
        return 'finalized';
      }
      if (status.confirmations >= 6) {
        return 'safe';
      }
      return 'confirmed';
    }

    return 'pending';
  }

  private pollTransactionStatus(transactionHash: Hash, callback: (interval: number) => void): void {
    const poll = () => {
      callback(this.config.pollInterval!);
      setTimeout(poll, this.config.pollInterval!);
    };

    poll();
  }
}

// Factory function
export function createTransactionConfirmationViem(
  signer: TransactionSignerViem,
  config?: ConfirmationConfig
): TransactionConfirmationViem {
  return new TransactionConfirmationViem(signer, config);
}

export default createTransactionConfirmationViem;