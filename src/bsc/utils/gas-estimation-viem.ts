import { Address, Hash, Hex, Chain, parseEther, formatEther, BlockTag } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { TransactionSignerViem, TransactionParams } from '../contracts/transaction-signer-viem';
import logger from '../../utils/logger';

/**
 * Gas Estimation Utilities for Viem
 * Provides enhanced gas estimation and optimization features
 */

export interface GasEstimate {
  gasLimit: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  totalCost: bigint;
  totalCostETH: string;
  estimatedDuration: number; // seconds
  confidence: number; // 0-1
}

export interface GasEstimationConfig {
  safetyMultiplier?: number;
  maxGasLimit?: bigint;
  preferEIP1559?: boolean;
  optimizationLevel?: 'conservative' | 'balanced' | 'aggressive';
  includeFeeHistory?: boolean;
  feeHistoryBlocks?: number;
  rewardPercentiles?: number[];
}

export interface TransactionGasData {
  to: Address;
  data?: Hex;
  value: bigint;
  from: Address;
  gasLimit?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

export interface FeeHistory {
  oldestBlock: bigint;
  reward: bigint[][];
  baseFeePerGas: bigint[];
  gasUsedRatio: bigint[];
}

export interface GasOptimizationResult {
  original: GasEstimate;
  optimized: GasEstimate;
  savings: {
    gasSaved: bigint;
    gasSavedPercent: number;
    costSaved: bigint;
    costSavedPercent: number;
  };
  recommendations: string[];
}

/**
 * Enhanced Gas Estimation using Viem
 */
export class GasEstimationViem {
  private signer: TransactionSignerViem;
  private config: GasEstimationConfig;
  private chain: Chain;

  constructor(
    signer: TransactionSignerViem,
    config: GasEstimationConfig = {}
  ) {
    this.signer = signer;
    this.config = {
      safetyMultiplier: config.safetyMultiplier || 1.2,
      maxGasLimit: config.maxGasLimit || parseEther('0.01'), // 0.01 BNB
      preferEIP1559: config.preferEIP1559 !== false,
      optimizationLevel: config.optimizationLevel || 'balanced',
      includeFeeHistory: config.includeFeeHistory || true,
      feeHistoryBlocks: config.feeHistoryBlocks || 10,
      rewardPercentiles: config.rewardPercentiles || [25, 50, 75],
      ...config
    };
    this.chain = signer instanceof TransactionSignerViem ? bsc : bsc; // Default to BSC
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(transactionData: TransactionGasData): Promise<GasEstimate> {
    try {
      logger.debug(`Estimating gas for transaction: to=${transactionData.to}, from=${transactionData.from}, value=${transactionData.value.toString()}`);

      // Prepare transaction for estimation
      const txForEstimation = {
        to: transactionData.to,
        data: transactionData.data,
        value: transactionData.value,
        account: transactionData.from
      };

      // Get base gas estimate
      const gasEstimate = await (this.signer as any).publicClient.estimateGas(txForEstimation);

      // Apply safety multiplier
      const adjustedGasLimit = BigInt(Math.floor(Number(gasEstimate) * this.config.safetyMultiplier!));

      // Ensure we don't exceed max gas limit
      const finalGasLimit = adjustedGasLimit < this.config.maxGasLimit! ? adjustedGasLimit : this.config.maxGasLimit!;

      // Get gas price based on chain type
      const gasData = await this.getOptimalGasPrice();

      // Calculate total cost
      const gasPrice = gasData.gasPrice || gasData.maxFeePerGas || 0n;
      const totalCost = finalGasLimit * gasPrice;

      const estimate: GasEstimate = {
        gasLimit: finalGasLimit,
        gasPrice: gasData.gasPrice,
        maxFeePerGas: gasData.maxFeePerGas,
        maxPriorityFeePerGas: gasData.maxPriorityFeePerGas,
        totalCost,
        totalCostETH: formatEther(totalCost),
        estimatedDuration: this.estimateTransactionDuration(finalGasLimit),
        confidence: this.calculateConfidence(gasData)
      };

      logger.debug(`Gas estimation completed: gasLimit=${finalGasLimit.toString()}, gasPrice=${gasPrice?.toString()}, totalCostETH=${estimate.totalCostETH}`);

      return estimate;
    } catch (error) {
      logger.error({
        error: (error as Error).message,
        transactionData
      }, 'Failed to estimate gas');

      // Return fallback estimate
      return this.getFallbackGasEstimate(transactionData);
    }
  }

  /**
   * Estimate gas for multiple transactions
   */
  async estimateBatchGas(transactions: TransactionGasData[]): Promise<Map<number, GasEstimate>> {
    try {
      logger.debug(`Estimating gas for batch transactions: count=${transactions.length}`);

      const estimates = new Map<number, GasEstimate>();

      // Estimate gas for each transaction
      const promises = transactions.map(async (tx, index) => {
        try {
          const estimate = await this.estimateGas(tx);
          estimates.set(index, estimate);
          return { index, estimate, success: true };
        } catch (error) {
          logger.error({
            error: (error as Error).message,
            transactionIndex: index
          }, 'Failed to estimate gas for transaction in batch');

          const fallbackEstimate = this.getFallbackGasEstimate(tx);
          estimates.set(index, fallbackEstimate);
          return { index, estimate: fallbackEstimate, success: false };
        }
      });

      const results = await Promise.allSettled(promises);

      const successCount = results.filter(r =>
        r.status === 'fulfilled' && r.value.success
      ).length;

      logger.info(`Batch gas estimation completed: total=${transactions.length}, success=${successCount}, failures=${transactions.length - successCount}`);

      return estimates;
    } catch (error) {
      logger.error({
        error: (error as Error).message,
        transactionCount: transactions.length
      }, 'Failed to estimate batch gas');

      // Return fallback estimates for all transactions
      const fallbackEstimates = new Map<number, GasEstimate>();
      transactions.forEach((tx, index) => {
        fallbackEstimates.set(index, this.getFallbackGasEstimate(tx));
      });

      return fallbackEstimates;
    }
  }

  /**
   * Optimize gas estimation
   */
  async optimizeGasEstimate(
    transactionData: TransactionGasData,
    optimizationLevel?: 'conservative' | 'balanced' | 'aggressive'
  ): Promise<GasOptimizationResult> {
    try {
      const level = optimizationLevel || this.config.optimizationLevel!;

      logger.debug(`Optimizing gas estimation: level=${level}`);

      // Get original estimate
      const originalEstimate = await this.estimateGas(transactionData);

      // Apply optimization based on level
      let optimizedEstimate = { ...originalEstimate };
      const recommendations: string[] = [];

      switch (level) {
        case 'conservative':
          optimizedEstimate.gasLimit = originalEstimate.gasLimit * BigInt(11) / 10n; // +10%
          recommendations.push('Applied conservative gas limit increase');
          break;

        case 'balanced':
          optimizedEstimate.gasLimit = originalEstimate.gasLimit * BigInt(105) / 100n; // +5%
          recommendations.push('Applied balanced gas optimization');
          break;

        case 'aggressive':
          optimizedEstimate.gasLimit = originalEstimate.gasLimit; // No increase
          recommendations.push('Applied aggressive gas optimization');
          break;
      }

      // Optimize gas price if possible
      const optimizedGasData = await this.getOptimalGasPrice(
        level === 'aggressive' ? 'fast' : 'standard'
      );

      if (optimizedGasData.gasPrice && originalEstimate.gasPrice) {
        const gasPriceReduction = originalEstimate.gasPrice - optimizedGasData.gasPrice;
        if (gasPriceReduction > 0n) {
          optimizedEstimate.gasPrice = optimizedGasData.gasPrice;
          recommendations.push('Reduced gas price');
        }
      }

      // Recalculate total cost
      const finalGasPrice = optimizedEstimate.gasPrice || optimizedEstimate.maxFeePerGas || 0n;
      optimizedEstimate.totalCost = optimizedEstimate.gasLimit * finalGasPrice;
      optimizedEstimate.totalCostETH = formatEther(optimizedEstimate.totalCost);

      // Calculate savings
      const gasSaved = originalEstimate.gasLimit - optimizedEstimate.gasLimit;
      const gasSavedPercent = Number(gasSaved) / Number(originalEstimate.gasLimit) * 100;
      const costSaved = originalEstimate.totalCost - optimizedEstimate.totalCost;
      const costSavedPercent = Number(costSaved) / Number(originalEstimate.totalCost) * 100;

      const result: GasOptimizationResult = {
        original: originalEstimate,
        optimized: optimizedEstimate,
        savings: {
          gasSaved,
          gasSavedPercent,
          costSaved,
          costSavedPercent
        },
        recommendations
      };

      logger.info(`Gas optimization completed: gasSaved=${result.savings.gasSavedPercent.toFixed(2)}%, costSaved=${result.savings.costSavedPercent.toFixed(2)}%, recommendations=${recommendations.length}`);

      return result;
    } catch (error) {
      logger.error({
        error: (error as Error).message,
        transactionData
      }, 'Failed to optimize gas estimation');

      // Return unoptimized estimate
      const originalEstimate = await this.estimateGas(transactionData);
      return {
        original: originalEstimate,
        optimized: originalEstimate,
        savings: {
          gasSaved: 0n,
          gasSavedPercent: 0,
          costSaved: 0n,
          costSavedPercent: 0
        },
        recommendations: ['Optimization failed, using original estimate']
      };
    }
  }

  /**
   * Get optimal gas price
   */
  async getOptimalGasPrice(speed: 'safe' | 'standard' | 'fast' = 'standard'): Promise<{
    gasPrice?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
  }> {
    try {
      const gasData = await this.signer.getOptimalGasPrice(speed);
      return gasData;
    } catch (error) {
      logger.error(`Failed to get optimal gas price: ${(error as Error).message}`);

      // Return fallback gas price
      return {
        gasPrice: parseEther('0.00000002'), // 20 Gwei
      };
    }
  }

  /**
   * Get fee history for gas price analysis
   */
  async getFeeHistory(blockCount?: number): Promise<FeeHistory> {
    try {
      const blocks = blockCount || this.config.feeHistoryBlocks!;

      // For BSC, we'd typically use the provider's fee history
      // Since Viem doesn't have a direct equivalent, we'll use a simplified approach

      const currentBlock = await (this.signer as any).publicClient.getBlockNumber();
      const oldestBlock = currentBlock - BigInt(blocks);

      // Generate mock fee history (in real implementation, this would use provider-specific methods)
      const mockHistory: FeeHistory = {
        oldestBlock,
        reward: [],
        baseFeePerGas: [],
        gasUsedRatio: []
      };

      for (let i = 0; i < blocks; i++) {
        mockHistory.reward.push([
          parseEther('0.000000002'), // 2 Gwei
          parseEther('0.000000003'), // 3 Gwei
          parseEther('0.000000005')  // 5 Gwei
        ]);
        mockHistory.baseFeePerGas.push(parseEther('0.00000002')); // 20 Gwei
        mockHistory.gasUsedRatio.push(BigInt(Math.floor(Math.random() * 80 + 10))); // 10-90%
      }

      return mockHistory;
    } catch (error) {
      logger.error(`Failed to get fee history: ${(error as Error).message}`);

      return {
        oldestBlock: 0n,
        reward: [],
        baseFeePerGas: [],
        gasUsedRatio: []
      };
    }
  }

  /**
   * Estimate transaction duration
   */
  estimateTransactionDuration(gasLimit: bigint): number {
    // BSC block time is ~3 seconds
    // Complex transactions take multiple blocks

    if (gasLimit < 50000n) return 3; // Simple transaction
    if (gasLimit < 200000n) return 6; // Medium complexity
    if (gasLimit < 500000n) return 9; // Complex transaction
    return 12; // Very complex transaction
  }

  /**
   * Calculate confidence level for gas estimate
   */
  calculateConfidence(gasData: any): number {
    // Base confidence on gas price stability and other factors
    let confidence = 0.8;

    if (gasData.gasPrice) {
      confidence += 0.1; // Stable gas price increases confidence
    }

    if (gasData.maxFeePerGas && gasData.maxPriorityFeePerGas) {
      confidence += 0.1; // EIP-1559 support increases confidence
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Get fallback gas estimate
   */
  private getFallbackGasEstimate(transactionData: TransactionGasData): GasEstimate {
    const fallbackGasLimit = this.config.maxGasLimit! / 2n; // 50% of max
    const fallbackGasPrice = parseEther('0.00000002'); // 20 Gwei

    return {
      gasLimit: fallbackGasLimit,
      gasPrice: fallbackGasPrice,
      totalCost: fallbackGasLimit * fallbackGasPrice,
      totalCostETH: formatEther(fallbackGasLimit * fallbackGasPrice),
      estimatedDuration: 6,
      confidence: 0.5
    };
  }

  /**
   * Analyze gas usage patterns
   */
  async analyzeGasUsagePatterns(transactionHashes: Hash[]): Promise<{
    averageGasLimit: bigint;
    averageGasPrice: bigint;
    averageCost: string;
    patterns: {
      peakHours: number[];
      lowGasPeriods: number[];
      recommendedAction: string;
    };
  }> {
    try {
      logger.debug(`Analyzing gas usage patterns: count=${transactionHashes.length}`);

      let totalGasLimit = 0n;
      let totalGasPrice = 0n;
      let validTransactions = 0;

      for (const hash of transactionHashes) {
        try {
          const receipt = await (this.signer as any).publicClient.getTransactionReceipt({ hash });
          if (receipt && receipt.gasUsed) {
            totalGasLimit += receipt.gasUsed;
            validTransactions++;
          }
        } catch (error) {
          // Skip invalid transactions
        }
      }

      if (validTransactions === 0) {
        throw new Error('No valid transactions found for analysis');
      }

      const averageGasLimit = totalGasLimit / BigInt(validTransactions);
      const averageGasPrice = parseEther('0.00000002'); // Fallback to current gas price
      const averageCost = formatEther(averageGasLimit * averageGasPrice);

      const patterns = {
        peakHours: [14, 15, 16, 20, 21], // Typical peak hours
        lowGasPeriods: [2, 3, 4, 5, 6], // Typical low gas periods
        recommendedAction: 'Schedule transactions during off-peak hours for cost savings'
      };

      return {
        averageGasLimit,
        averageGasPrice,
        averageCost,
        patterns
      };
    } catch (error) {
      logger.error({
        error: (error as Error).message,
        transactionCount: transactionHashes.length
      }, 'Failed to analyze gas usage patterns');

      return {
        averageGasLimit: BigInt(100000),
        averageGasPrice: parseEther('0.00000002'),
        averageCost: '0.002',
        patterns: {
          peakHours: [],
          lowGasPeriods: [],
          recommendedAction: 'Unable to analyze patterns due to insufficient data'
        }
      };
    }
  }
}

// Factory function
export function createGasEstimationViem(
  signer: TransactionSignerViem,
  config?: GasEstimationConfig
): GasEstimationViem {
  return new GasEstimationViem(signer, config);
}

export default createGasEstimationViem;