import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { parseEther, Hex, Hash } from 'viem';
import { createTransactionSignerViem, TransactionSignerViem } from '../bsc/contracts/transaction-signer-viem';
import { createTransactionBuilderViem, TransactionBuilderViem } from '../bsc/utils/transaction-builder-viem';
import { createGasEstimationViem, GasEstimationViem } from '../bsc/utils/gas-estimation-viem';
import { createTransactionConfirmationViem, TransactionConfirmationViem } from '../bsc/utils/transaction-confirmation-viem';

/**
 * Test Transaction Execution Flows with Viem
 * These tests validate complete transaction execution flows from preparation to confirmation
 * during the Ethers.js to Viem migration.
 */

describe('Transaction Execution Flows Viem Tests', () => {
  let signer: TransactionSignerViem;
  let transactionBuilder: TransactionBuilderViem;
  let gasEstimator: GasEstimationViem;
  let confirmationService: TransactionConfirmationViem;
  const testRpcUrl = 'https://data-seed-prebsc-1-s1.binance.org:8545'; // BSC testnet
  const testPrivateKey = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' as Hex;
  const testAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const;
  const testRecipient = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as const;

  beforeAll(async () => {
    // Initialize signer
    signer = createTransactionSignerViem(testRpcUrl, {
      maxGasPrice: parseEther('0.00000001'), // 10 Gwei
      gasMultiplier: 1.2,
      confirmations: 1,
      timeoutMs: 60000
    });

    // Add test wallet
    await signer.addWallet({
      privateKey: testPrivateKey,
      address: testAddress,
      index: 0,
      name: 'Test Wallet'
    });

    // Initialize supporting services
    transactionBuilder = createTransactionBuilderViem(signer, {
      defaultGasLimit: BigInt(210000),
      gasMultiplier: 1.1,
      slippageTolerance: 0.5,
      maxSlippage: 5
    });

    gasEstimator = createGasEstimationViem(signer, {
      safetyMultiplier: 1.2,
      maxGasLimit: parseEther('0.01'),
      optimizationLevel: 'balanced'
    });

    confirmationService = createTransactionConfirmationViem(signer, {
      confirmations: 1,
      timeoutMs: 60000,
      enableEventMonitoring: true
    });
  });

  afterAll(async () => {
    if (signer) {
      await signer.cleanup();
    }
  });

  describe('Simple Transfer Flow', () => {
    it('should execute complete transfer flow', async () => {
      const transferAmount = parseEther('0.01'); // 0.01 BNB

      // Step 1: Prepare transaction
      const transaction = await signer.prepareTransaction({
        to: testRecipient,
        value: transferAmount,
        data: '0x' as Hex
      }, testAddress);

      expect(transaction).toBeDefined();
      expect(transaction.to).toBe(testRecipient);
      expect(transaction.value).toBe(transferAmount);
      expect(transaction.gasLimit).toBeGreaterThan(0n);

      // Step 2: Estimate gas
      const gasEstimate = await gasEstimator.estimateGas({
        to: testRecipient,
        from: testAddress,
        value: transferAmount,
        data: '0x' as Hex
      });

      expect(gasEstimate).toBeDefined();
      expect(gasEstimate.gasLimit).toBeGreaterThan(0n);
      expect(gasEstimate.totalCost).toBeGreaterThan(0n);

      // Step 3: Optimize gas settings
      const optimizedTransaction = await transactionBuilder.optimizeGasSettings(
        transaction as any,
        'standard'
      );

      expect(optimizedTransaction).toBeDefined();
      expect(optimizedTransaction.gasPrice || optimizedTransaction.maxFeePerGas).toBeDefined();

      // Step 4: Simulate transaction
      const simulation = await signer.simulateTransaction(optimizedTransaction, testAddress);

      expect(simulation).toBeDefined();
      expect(simulation.gasUsed).toBeGreaterThanOrEqual(0n);

      // Note: We won't actually execute the transaction to avoid spending real funds
      // But the flow up to simulation is validated
    });

    it('should handle zero-value transfer flow', async () => {
      // Prepare zero-value transaction
      const transaction = await signer.prepareTransaction({
        to: testRecipient,
        value: 0n,
        data: '0x' as Hex
      }, testAddress);

      expect(transaction.value).toBe(0n);

      // Estimate gas
      const gasEstimate = await gasEstimator.estimateGas({
        to: testRecipient,
        from: testAddress,
        value: 0n,
        data: '0x' as Hex
      });

      expect(gasEstimate.gasLimit).toBeGreaterThan(0n);
      expect(gasEstimate.totalCost).toBeGreaterThanOrEqual(0n);
    });
  });

  describe('Contract Interaction Flow', () => {
    const pancakeSwapRouter = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as const;
    const swapFunctionSelector = '0x38ed1739' as Hex; // swapExactETHForTokens

    it('should execute contract interaction flow', async () => {
      const valueAmount = parseEther('0.01');

      // Step 1: Prepare contract interaction
      const contractTransaction = await signer.prepareTransaction({
        to: pancakeSwapRouter,
        value: valueAmount,
        data: swapFunctionSelector
      }, testAddress);

      expect(contractTransaction.to).toBe(pancakeSwapRouter);
      expect(contractTransaction.data).toBe(swapFunctionSelector);

      // Step 2: Estimate gas for contract interaction
      const gasEstimate = await gasEstimator.estimateGas({
        to: pancakeSwapRouter,
        from: testAddress,
        value: valueAmount,
        data: swapFunctionSelector
      });

      expect(gasEstimate.gasLimit).toBeGreaterThan(21000n); // Should be higher than simple transfer

      // Step 3: Build enhanced transaction with metadata
      const enhancedTransaction = await transactionBuilder.buildCustomTransaction(
        {
          to: pancakeSwapRouter,
          value: valueAmount,
          data: swapFunctionSelector
        },
        testAddress,
        {
          type: 'swap',
          description: 'Swap ETH for tokens',
          tags: ['swap', 'defi', 'pancakeswap'],
          priority: 'medium',
          estimatedValue: valueAmount
        }
      );

      expect(enhancedTransaction.metadata).toBeDefined();
      expect(enhancedTransaction.metadata?.type).toBe('swap');

      // Step 4: Validate transaction parameters
      const validation = transactionBuilder.validateTransaction(enhancedTransaction);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should handle invalid contract interaction gracefully', async () => {
      const invalidData = '0x12345678' as Hex; // Invalid function selector

      // This should fail gracefully
      const gasEstimate = await gasEstimator.estimateGas({
        to: pancakeSwapRouter,
        from: testAddress,
        value: parseEther('0.01'),
        data: invalidData
      });

      // Even if estimation fails, it should return a fallback estimate
      expect(gasEstimate).toBeDefined();
      expect(gasEstimate.gasLimit).toBeGreaterThan(0n);
    });
  });

  describe('Batch Transaction Flow', () => {
    it('should handle batch transaction preparation', async () => {
      const transactions = [
        {
          to: testRecipient,
          value: parseEther('0.01'),
          data: '0x' as Hex
        },
        {
          to: testRecipient,
          value: parseEther('0.005'),
          data: '0x' as Hex
        }
      ];

      // Create transaction queue
      const queueId = await signer.createTransactionQueue(transactions, {
        name: 'test-batch-flow',
        batch: true,
        maxGasPerBatch: parseEther('0.1')
      });

      expect(queueId).toBeDefined();
      expect(queueId).toBe('test-batch-flow');

      // Note: Queue details retrieval would be implemented in actual signer
      // For now, we just validate that the queue was created successfully
    });

    it('should estimate gas for batch transactions', async () => {
      const transactions = [
        {
          to: testRecipient,
          from: testAddress,
          value: parseEther('0.01'),
          data: '0x' as Hex
        },
        {
          to: testRecipient,
          from: testAddress,
          value: parseEther('0.02'),
          data: '0x' as Hex
        },
        {
          to: testRecipient,
          from: testAddress,
          value: parseEther('0.005'),
          data: '0x' as Hex
        }
      ];

      // Batch gas estimation
      const batchEstimates = await gasEstimator.estimateBatchGas(transactions);

      expect(batchEstimates.size).toBe(3);

      batchEstimates.forEach((estimate, index) => {
        expect(estimate.gasLimit).toBeGreaterThan(0n);
        expect(estimate.totalCost).toBeGreaterThan(0n);
      });
    });
  });

  describe('Gas Optimization Flow', () => {
    it('should optimize gas for different priority levels', async () => {
      const baseTransaction = {
        to: testRecipient,
        value: parseEther('0.01'),
        data: '0x' as Hex
      };

      // Test safe gas optimization
      const safeGas = await gasEstimator.getOptimalGasPrice('safe');
      expect(safeGas.gasPrice || safeGas.maxFeePerGas).toBeDefined();

      // Test standard gas optimization
      const standardGas = await gasEstimator.getOptimalGasPrice('standard');
      expect(standardGas.gasPrice || standardGas.maxFeePerGas).toBeDefined();

      // Test fast gas optimization
      const fastGas = await gasEstimator.getOptimalGasPrice('fast');
      expect(fastGas.gasPrice || fastGas.maxFeePerGas).toBeDefined();

      // Verify gas price hierarchy
      const safeValue = safeGas.gasPrice || safeGas.maxFeePerGas || 0n;
      const standardValue = standardGas.gasPrice || standardGas.maxFeePerGas || 0n;
      const fastValue = fastGas.gasPrice || fastGas.maxFeePerGas || 0n;

      expect(safeValue).toBeLessThanOrEqual(standardValue);
      expect(standardValue).toBeLessThanOrEqual(fastValue);
    });

    it('should optimize gas estimates with different levels', async () => {
      const transactionData = {
        to: testRecipient,
        from: testAddress,
        value: parseEther('0.01'),
        data: '0x' as Hex
      };

      // Conservative optimization
      const conservativeResult = await gasEstimator.optimizeGasEstimate(transactionData, 'conservative');
      expect(conservativeResult.original).toBeDefined();
      expect(conservativeResult.optimized).toBeDefined();
      expect(conservativeResult.savings).toBeDefined();

      // Balanced optimization
      const balancedResult = await gasEstimator.optimizeGasEstimate(transactionData, 'balanced');
      expect(balancedResult.optimized.gasLimit).toBeGreaterThan(balancedResult.original.gasLimit);

      // Aggressive optimization
      const aggressiveResult = await gasEstimator.optimizeGasEstimate(transactionData, 'aggressive');
      expect(aggressiveResult.optimized.gasLimit).toBeLessThanOrEqual(aggressiveResult.original.gasLimit);
    });
  });

  describe('Transaction Monitoring Flow', () => {
    it('should monitor transaction confirmation flow', async () => {
      // Mock transaction hash for monitoring
      const mockTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hash;

      // Start monitoring (will timeout for mock hash, but tests the flow)
      const monitoringPromise = confirmationService.waitForConfirmation(mockTxHash, {
        confirmations: 1,
        timeoutMs: 1000 // Short timeout for testing
      });

      // Should timeout gracefully
      await expect(monitoringPromise).rejects.toThrow();
    });

    it('should handle batch confirmation monitoring', async () => {
      const mockTxHashes = [
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hash,
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hash
      ];

      // Batch monitoring (will timeout for mock hashes)
      const batchPromise = confirmationService.waitForBatchConfirmation(mockTxHashes, {
        confirmations: 1,
        timeoutMs: 1000 // Short timeout for testing
      });

      // Should timeout gracefully
      await expect(batchPromise).rejects.toThrow();
    });
  });

  describe('Error Handling Flow', () => {
    it('should handle insufficient funds gracefully', async () => {
      // Try to transfer more than balance
      const largeAmount = parseEther('1000'); // 1000 BNB

      const gasEstimate = await gasEstimator.estimateGas({
        to: testRecipient,
        from: testAddress,
        value: largeAmount,
        data: '0x' as Hex
      });

      // Should return fallback estimate even for large amounts
      expect(gasEstimate).toBeDefined();
      expect(gasEstimate.confidence).toBeLessThan(1.0);
    });

    it('should handle invalid addresses gracefully', async () => {
      const invalidAddress = '0xinvalid' as const;

      const gasEstimate = await gasEstimator.estimateGas({
        to: invalidAddress,
        from: testAddress,
        value: parseEther('0.01'),
        data: '0x' as Hex
      });

      // Should return fallback estimate for invalid addresses
      expect(gasEstimate).toBeDefined();
      expect(gasEstimate.confidence).toBeLessThan(1.0);
    });

    it('should handle network errors gracefully', async () => {
      // Create signer with invalid URL to test error handling
      const errorSigner = createTransactionSignerViem('http://localhost:9999');
      const errorGasEstimator = createGasEstimationViem(errorSigner);

      const gasEstimate = await errorGasEstimator.estimateGas({
        to: testRecipient,
        from: testAddress,
        value: parseEther('0.01'),
        data: '0x' as Hex
      });

      // Should return fallback estimate when network is unavailable
      expect(gasEstimate).toBeDefined();

      await errorSigner.cleanup();
    });
  });

  describe('Integration Flow Tests', () => {
    it('should integrate all services in complete flow', async () => {
      const transferAmount = parseEther('0.01');

      // Step 1: Build transaction with metadata
      const enhancedTransaction = await transactionBuilder.buildCustomTransaction(
        {
          to: testRecipient,
          value: transferAmount,
          data: '0x' as Hex
        },
        testAddress,
        {
          type: 'custom',
          description: 'Integration test transfer',
          tags: ['test', 'integration'],
          priority: 'medium',
          estimatedValue: transferAmount
        },
        {
          simulateBeforeSend: true,
          retryOnFailure: true,
          maxRetries: 2
        }
      );

      // Step 2: Validate transaction
      const validation = transactionBuilder.validateTransaction(enhancedTransaction);
      expect(validation.valid).toBe(true);

      // Step 3: Estimate gas
      const gasEstimate = await gasEstimator.estimateGas({
        to: testRecipient,
        from: testAddress,
        value: transferAmount,
        data: '0x' as Hex
      });

      // Step 4: Optimize transaction
      const optimizedTransaction = await transactionBuilder.optimizeGasSettings(
        enhancedTransaction,
        'standard'
      );

      // Step 5: Simulate transaction
      const simulation = await signer.simulateTransaction(optimizedTransaction, testAddress);
      expect(simulation).toBeDefined();

      // Step 6: Get fee history for analysis
      const feeHistory = await gasEstimator.getFeeHistory(5);
      expect(feeHistory).toBeDefined();
      expect(feeHistory.baseFeePerGas).toHaveLength(5);

      // Complete integration flow validated
      expect(true).toBe(true); // If we reach here, the flow succeeded
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent gas estimimations', async () => {
      const transactions = Array.from({ length: 10 }, (_, i) => ({
        to: testRecipient,
        from: testAddress,
        value: parseEther(`0.00${i + 1}`),
        data: '0x' as Hex
      }));

      // Run estimations concurrently
      const startTime = Date.now();
      const estimationPromises = transactions.map(tx => gasEstimator.estimateGas(tx));
      const results = await Promise.allSettled(estimationPromises);
      const endTime = Date.now();

      // All estimations should complete
      expect(results).toHaveLength(10);

      // Performance check (should complete within reasonable time)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10000); // 10 seconds max

      // All results should be valid estimates
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          expect(result.value.gasLimit).toBeGreaterThan(0n);
        } else {
          // Even failed estimations should provide fallbacks
          expect(result.reason).toBeDefined();
        }
      });
    });

    it('should handle large batch operations efficiently', async () => {
      const largeBatch = Array.from({ length: 50 }, (_, i) => ({
        to: testRecipient,
        from: testAddress,
        value: parseEther('0.001'),
        data: '0x' as Hex
      }));

      const startTime = Date.now();
      const batchEstimates = await gasEstimator.estimateBatchGas(largeBatch);
      const endTime = Date.now();

      expect(batchEstimates.size).toBe(50);

      // Performance check for batch operations
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(15000); // 15 seconds max for 50 transactions
    });
  });
});