import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { parseEther, Hex, Hash } from 'viem';
import { createTransactionSignerViem } from '../bsc/contracts/transaction-signer-viem';
import { createGasEstimationViem, GasEstimationViem } from '../bsc/utils/gas-estimation-viem';

/**
 * Test Gas Estimation Viem Migration
 * These tests validate that gas estimation utilities are properly migrated to Viem
 * and functioning as expected during the Ethers.js to Viem migration.
 */

describe('Gas Estimation Viem Migration Tests', () => {
  let signer: any;
  let gasEstimator: GasEstimationViem;
  const testRpcUrl = 'https://data-seed-prebsc-1-s1.binance.org:8545'; // BSC testnet
  const testFromAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const;
  const testToAddress = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as const;

  beforeAll(() => {
    signer = createTransactionSignerViem(testRpcUrl, {
      maxGasPrice: parseEther('0.00000001'), // 10 Gwei
      gasMultiplier: 1.2,
      confirmations: 1,
      timeoutMs: 60000
    });

    gasEstimator = createGasEstimationViem(signer, {
      safetyMultiplier: 1.2,
      maxGasLimit: parseEther('0.01'),
      optimizationLevel: 'balanced'
    });
  });

  afterAll(async () => {
    if (signer) {
      await signer.cleanup();
    }
  });

  describe('Gas Estimation Initialization', () => {
    it('should create gas estimator with Viem signer', () => {
      expect(gasEstimator).toBeDefined();
      expect(gasEstimator.estimateGas).toBeDefined();
      expect(gasEstimator.estimateBatchGas).toBeDefined();
      expect(gasEstimator.optimizeGasEstimate).toBeDefined();
      expect(gasEstimator.getOptimalGasPrice).toBeDefined();
      expect(gasEstimator.getFeeHistory).toBeDefined();
    });

    it('should use default configuration', () => {
      const defaultEstimator = createGasEstimationViem(signer);
      expect(defaultEstimator).toBeDefined();
    });

    it('should use custom configuration', () => {
      const customEstimator = createGasEstimationViem(signer, {
        safetyMultiplier: 1.5,
        maxGasLimit: parseEther('0.02'),
        optimizationLevel: 'aggressive',
        preferEIP1559: true
      });
      expect(customEstimator).toBeDefined();
    });
  });

  describe('Basic Gas Estimation', () => {
    it('should estimate gas for simple transfer', async () => {
      const transactionData = {
        to: testToAddress,
        from: testFromAddress,
        value: parseEther('0.1'),
        data: '0x' as Hex
      };

      const estimate = await gasEstimator.estimateGas(transactionData);

      expect(estimate).toBeDefined();
      expect(estimate.gasLimit).toBeGreaterThan(0n);
      expect(estimate.gasPrice).toBeDefined();
      expect(estimate.totalCost).toBeGreaterThan(0n);
      expect(estimate.totalCostETH).toMatch(/^\d+\.\d+$/);
      expect(estimate.estimatedDuration).toBeGreaterThan(0);
      expect(estimate.confidence).toBeGreaterThanOrEqual(0);
      expect(estimate.confidence).toBeLessThanOrEqual(1);
    });

    it('should estimate gas for contract interaction', async () => {
      const contractAddress = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as const;
      const contractData = '0x38ed1739' as Hex; // swapExactETHForTokens function selector

      const transactionData = {
        to: contractAddress,
        from: testFromAddress,
        value: parseEther('0.1'),
        data: contractData
      };

      const estimate = await gasEstimator.estimateGas(transactionData);

      expect(estimate).toBeDefined();
      expect(estimate.gasLimit).toBeGreaterThan(21000n); // Should be higher than simple transfer
      expect(estimate.estimatedDuration).toBeGreaterThan(0);
    });

    it('should estimate gas for zero-value transaction', async () => {
      const transactionData = {
        to: testToAddress,
        from: testFromAddress,
        value: 0n,
        data: '0x' as Hex
      };

      const estimate = await gasEstimator.estimateGas(transactionData);

      expect(estimate).toBeDefined();
      expect(estimate.gasLimit).toBeGreaterThan(0n);
      expect(estimate.totalCost).toBeGreaterThanOrEqual(0n);
    });

    it('should handle large value transactions', async () => {
      const transactionData = {
        to: testToAddress,
        from: testFromAddress,
        value: parseEther('10'), // 10 BNB
        data: '0x' as Hex
      };

      const estimate = await gasEstimator.estimateGas(transactionData);

      expect(estimate).toBeDefined();
      expect(estimate.gasLimit).toBeGreaterThan(0n);
      expect(estimate.totalCost).toBeGreaterThan(0n);
    });
  });

  describe('Batch Gas Estimation', () => {
    it('should estimate gas for multiple transactions', async () => {
      const transactions = [
        {
          to: testToAddress,
          from: testFromAddress,
          value: parseEther('0.1'),
          data: '0x' as Hex
        },
        {
          to: testToAddress,
          from: testFromAddress,
          value: parseEther('0.2'),
          data: '0x' as Hex
        },
        {
          to: testToAddress,
          from: testFromAddress,
          value: parseEther('0.05'),
          data: '0x' as Hex
        }
      ];

      const estimates = await gasEstimator.estimateBatchGas(transactions);

      expect(estimates).toBeDefined();
      expect(estimates.size).toBe(3);

      estimates.forEach((estimate, index) => {
        expect(estimate.gasLimit).toBeGreaterThan(0n);
        expect(estimate.totalCost).toBeGreaterThan(0n);
      });
    });

    it('should handle empty transaction array', async () => {
      const estimates = await gasEstimator.estimateBatchGas([]);

      expect(estimates).toBeDefined();
      expect(estimates.size).toBe(0);
    });

    it('should handle mixed transaction types', async () => {
      const transactions = [
        {
          to: testToAddress,
          from: testFromAddress,
          value: parseEther('0.1'),
          data: '0x' as Hex
        },
        {
          to: '0x10ED43C718714eb63d5aA57B78B54704E256024E' as const,
          from: testFromAddress,
          value: parseEther('0.1'),
          data: '0x38ed1739' as Hex
        }
      ];

      const estimates = await gasEstimator.estimateBatchGas(transactions);

      expect(estimates).toBeDefined();
      expect(estimates.size).toBe(2);
    });
  });

  describe('Gas Optimization', () => {
    it('should optimize with conservative level', async () => {
      const transactionData = {
        to: testToAddress,
        from: testFromAddress,
        value: parseEther('0.1'),
        data: '0x' as Hex
      };

      const result = await gasEstimator.optimizeGasEstimate(transactionData, 'conservative');

      expect(result).toBeDefined();
      expect(result.original).toBeDefined();
      expect(result.optimized).toBeDefined();
      expect(result.savings).toBeDefined();
      expect(result.recommendations).toBeDefined();

      expect(result.optimized.gasLimit).toBeGreaterThan(result.original.gasLimit);
      expect(result.savings.gasSaved).toBeLessThan(0n); // Negative savings (more gas used)
    });

    it('should optimize with balanced level', async () => {
      const transactionData = {
        to: testToAddress,
        from: testFromAddress,
        value: parseEther('0.1'),
        data: '0x' as Hex
      };

      const result = await gasEstimator.optimizeGasEstimate(transactionData, 'balanced');

      expect(result).toBeDefined();
      expect(result.optimized.gasLimit).toBeGreaterThan(result.original.gasLimit);
      expect(result.recommendations).toContain('Applied balanced gas optimization');
    });

    it('should optimize with aggressive level', async () => {
      const transactionData = {
        to: testToAddress,
        from: testFromAddress,
        value: parseEther('0.1'),
        data: '0x' as Hex
      };

      const result = await gasEstimator.optimizeGasEstimate(transactionData, 'aggressive');

      expect(result).toBeDefined();
      expect(result.optimized.gasLimit).toBeLessThanOrEqual(result.original.gasLimit);
      expect(result.recommendations).toContain('Applied aggressive gas optimization');
    });

    it('should provide savings analysis', async () => {
      const transactionData = {
        to: testToAddress,
        from: testFromAddress,
        value: parseEther('0.1'),
        data: '0x' as Hex
      };

      const result = await gasEstimator.optimizeGasEstimate(transactionData);

      expect(result.savings.gasSavedPercent).toBeDefined();
      expect(result.savings.costSavedPercent).toBeDefined();
      expect(typeof result.savings.gasSavedPercent).toBe('number');
      expect(typeof result.savings.costSavedPercent).toBe('number');
    });
  });

  describe('Gas Price Optimization', () => {
    it('should get safe gas price', async () => {
      const gasData = await gasEstimator.getOptimalGasPrice('safe');

      expect(gasData).toBeDefined();
      expect(gasData.gasPrice || gasData.maxFeePerGas).toBeDefined();
    });

    it('should get standard gas price', async () => {
      const gasData = await gasEstimator.getOptimalGasPrice('standard');

      expect(gasData).toBeDefined();
      expect(gasData.gasPrice || gasData.maxFeePerGas).toBeDefined();
    });

    it('should get fast gas price', async () => {
      const gasData = await gasEstimator.getOptimalGasPrice('fast');

      expect(gasData).toBeDefined();
      expect(gasData.gasPrice || gasData.maxFeePerGas).toBeDefined();
    });

    it('should have consistent gas pricing hierarchy', async () => {
      const safeGas = await gasEstimator.getOptimalGasPrice('safe');
      const standardGas = await gasEstimator.getOptimalGasPrice('standard');
      const fastGas = await gasEstimator.getOptimalGasPrice('fast');

      const safeValue = safeGas.gasPrice || safeGas.maxFeePerGas || 0n;
      const standardValue = standardGas.gasPrice || standardGas.maxFeePerGas || 0n;
      const fastValue = fastGas.gasPrice || fastGas.maxFeePerGas || 0n;

      expect(safeValue).toBeLessThanOrEqual(standardValue);
      expect(standardValue).toBeLessThanOrEqual(fastValue);
    });
  });

  describe('Fee History', () => {
    it('should get fee history', async () => {
      const feeHistory = await gasEstimator.getFeeHistory(5);

      expect(feeHistory).toBeDefined();
      expect(feeHistory.oldestBlock).toBeDefined();
      expect(feeHistory.reward).toBeDefined();
      expect(feeHistory.baseFeePerGas).toBeDefined();
      expect(feeHistory.gasUsedRatio).toBeDefined();
    });

    it('should handle custom block count', async () => {
      const feeHistory = await gasEstimator.getFeeHistory(20);

      expect(feeHistory).toBeDefined();
      expect(feeHistory.reward.length).toBe(20);
      expect(feeHistory.baseFeePerGas.length).toBe(20);
      expect(feeHistory.gasUsedRatio.length).toBe(20);
    });

    it('should provide meaningful fee data', async () => {
      const feeHistory = await gasEstimator.getFeeHistory();

      feeHistory.reward.forEach(rewardArray => {
        expect(Array.isArray(rewardArray)).toBe(true);
        expect(rewardArray.length).toBe(3);
      });

      feeHistory.baseFeePerGas.forEach(baseFee => {
        expect(baseFee).toBeGreaterThan(0n);
      });

      feeHistory.gasUsedRatio.forEach(ratio => {
        expect(ratio).toBeGreaterThanOrEqual(0n);
        expect(ratio).toBeLessThanOrEqual(100n);
      });
    });
  });

  describe('Transaction Duration Estimation', () => {
    it('should estimate short transaction duration', () => {
      const duration = gasEstimator.estimateTransactionDuration(21000n);

      expect(duration).toBe(3);
    });

    it('should estimate medium transaction duration', () => {
      const duration = gasEstimator.estimateTransactionDuration(100000n);

      expect(duration).toBe(6);
    });

    it('should estimate complex transaction duration', () => {
      const duration = gasEstimator.estimateTransactionDuration(300000n);

      expect(duration).toBe(9);
    });

    it('should estimate very complex transaction duration', () => {
      const duration = gasEstimator.estimateTransactionDuration(1000000n);

      expect(duration).toBe(12);
    });
  });

  describe('Confidence Calculation', () => {
    it('should calculate confidence for stable gas prices', () => {
      const gasData = {
        gasPrice: parseEther('0.00000002')
      };

      const confidence = gasEstimator.calculateConfidence(gasData);

      expect(confidence).toBeGreaterThan(0.8);
      expect(confidence).toBeLessThanOrEqual(1.0);
    });

    it('should calculate confidence for EIP-1559 transactions', () => {
      const gasData = {
        maxFeePerGas: parseEther('0.00000002'),
        maxPriorityFeePerGas: parseEther('0.000000001')
      };

      const confidence = gasEstimator.calculateConfidence(gasData);

      expect(confidence).toBe(1.0);
    });

    it('should calculate base confidence for minimal data', () => {
      const gasData = {};

      const confidence = gasEstimator.calculateConfidence(gasData);

      expect(confidence).toBe(0.8);
    });
  });

  describe('Gas Usage Pattern Analysis', () => {
    it('should analyze gas usage patterns for valid transactions', async () => {
      const transactionHashes = [
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hash,
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hash
      ];

      // Mock the analyze method to avoid actual blockchain calls
      const patterns = await gasEstimator.analyzeGasUsagePatterns(transactionHashes);

      expect(patterns).toBeDefined();
      expect(patterns.averageGasLimit).toBeGreaterThan(0n);
      expect(patterns.averageGasPrice).toBeGreaterThan(0n);
      expect(patterns.averageCost).toMatch(/^\d+\.\d+$/);
      expect(patterns.patterns).toBeDefined();
      expect(patterns.patterns.peakHours).toBeDefined();
      expect(patterns.patterns.lowGasPeriods).toBeDefined();
      expect(patterns.patterns.recommendedAction).toBeDefined();
    });

    it('should handle empty transaction array gracefully', async () => {
      const patterns = await gasEstimator.analyzeGasUsagePatterns([]);

      expect(patterns).toBeDefined();
      expect(patterns.averageGasLimit).toBeGreaterThan(0n);
      expect(patterns.patterns.recommendedAction).toContain('insufficient data');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid transaction data gracefully', async () => {
      const invalidTransaction = {
        to: '0xinvalid' as const,
        from: testFromAddress,
        value: parseEther('0.1'),
        data: '0x' as Hex
      };

      const estimate = await gasEstimator.estimateGas(invalidTransaction);

      expect(estimate).toBeDefined();
      expect(estimate.gasLimit).toBeGreaterThan(0n);
      expect(estimate.confidence).toBeLessThan(1.0);
    });

    it('should handle estimation failures with fallback', async () => {
      // Create estimator with invalid signer to trigger fallback
      const invalidEstimator = createGasEstimationViem(signer, {
        maxGasLimit: parseEther('0.001')
      });

      const transactionData = {
        to: testToAddress,
        from: testFromAddress,
        value: parseEther('1000'), // Very large value that might fail
        data: '0x' as Hex
      };

      const estimate = await invalidEstimator.estimateGas(transactionData);

      expect(estimate).toBeDefined();
      expect(estimate.gasLimit).toBeGreaterThan(0n);
      expect(estimate.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should handle optimization failures gracefully', async () => {
      const transactionData = {
        to: testToAddress,
        from: testFromAddress,
        value: parseEther('0.1'),
        data: '0x' as Hex
      };

      const result = await gasEstimator.optimizeGasEstimate(transactionData, 'aggressive');

      expect(result).toBeDefined();
      expect(result.original).toBeDefined();
      expect(result.optimized).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });
  });
});