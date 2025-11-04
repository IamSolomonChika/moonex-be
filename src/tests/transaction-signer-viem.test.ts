import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { parseEther, Hex } from 'viem';
import { createTransactionSignerViem, TransactionSignerViem } from '../bsc/contracts/transaction-signer-viem';

/**
 * Test Transaction Signer Migration to Viem
 * These tests validate that transaction signing functionality is properly migrated to Viem
 * and functioning as expected during the Ethers.js to Viem migration.
 */

describe('Transaction Signer Viem Migration Tests', () => {
  let signer: TransactionSignerViem;
  const testRpcUrl = 'https://data-seed-prebsc-1-s1.binance.org:8545'; // BSC testnet

  beforeAll(() => {
    signer = createTransactionSignerViem(testRpcUrl, {
      maxGasPrice: parseEther('0.00000001'), // 10 Gwei
      gasMultiplier: 1.2,
      confirmations: 1,
      timeoutMs: 60000 // 1 minute for tests
    });
  });

  afterAll(async () => {
    if (signer) {
      await signer.cleanup();
    }
  });

  describe('Transaction Signer Initialization', () => {
    it('should create transaction signer with Viem', () => {
      expect(signer).toBeDefined();
      expect(signer.getOptimalGasPrice).toBeDefined();
      expect(signer.prepareTransaction).toBeDefined();
      expect(signer.signTransaction).toBeDefined();
      expect(signer.executeTransaction).toBeDefined();
    });

    it('should perform health check successfully', async () => {
      const health = await signer.healthCheck();
      expect(health).toBeDefined();
      expect(health.status).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.details.providerConnected).toBeDefined();
      expect(health.details.walletCount).toBe(0); // No wallets added yet
      expect(health.details.networkId).toBe(97); // BSC testnet
    });
  });

  describe('Wallet Management', () => {
    const testPrivateKey = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' as Hex;
    const testAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const;

    it('should add wallet successfully', async () => {
      await signer.addWallet({
        privateKey: testPrivateKey,
        address: testAddress,
        index: 0,
        name: 'Test Wallet'
      });

      const wallet = signer.getWallet(testAddress);
      expect(wallet).toBeDefined();
      expect(signer.getWallets()).toContain(testAddress);
    });

    it('should reject wallet with mismatched address', async () => {
      const wrongAddress = '0x1234567890123456789012345678901234567890' as const;

      await expect(
        signer.addWallet({
          privateKey: testPrivateKey,
          address: wrongAddress,
          index: 1,
          name: 'Wrong Wallet'
        })
      ).rejects.toThrow('Private key does not match provided address');
    });

    it('should remove wallet successfully', async () => {
      await signer.removeWallet(testAddress);
      const wallet = signer.getWallet(testAddress);
      expect(wallet).toBeUndefined();
      expect(signer.getWallets()).not.toContain(testAddress);
    });
  });

  describe('Transaction Preparation', () => {
    const testRecipient = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const;
    const testValue = parseEther('0.1');

    it('should prepare basic transaction', async () => {
      const transaction = await signer.prepareTransaction({
        to: testRecipient,
        value: testValue,
        data: '0x'
      });

      expect(transaction).toBeDefined();
      expect(transaction.to).toBe(testRecipient);
      expect(transaction.value).toBe(testValue);
      expect(transaction.type).toMatch(/^(legacy|eip1559)$/);
    });

    it('should prepare transaction with gas limit', async () => {
      const gasLimit = BigInt(21000);
      const transaction = await signer.prepareTransaction({
        to: testRecipient,
        value: testValue,
        gasLimit
      });

      expect(transaction.gasLimit).toBe(gasLimit);
    });

    it('should prepare transaction with custom gas settings', async () => {
      const gasPrice = parseEther('0.00000002'); // 20 Gwei
      const transaction = await signer.prepareTransaction({
        to: testRecipient,
        value: testValue,
        gasPrice
      });

      expect(transaction.gasPrice).toBe(gasPrice);
    });

    it('should estimate gas when not provided', async () => {
      const transaction = await signer.prepareTransaction({
        to: testRecipient,
        value: testValue
      });

      expect(transaction.gasLimit).toBeDefined();
      expect(transaction.gasLimit).toBeGreaterThan(0n);
    });
  });

  describe('Transaction Simulation', () => {
    const testRecipient = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const;
    const testValue = parseEther('0.1');

    it('should simulate transaction successfully', async () => {
      const transaction = await signer.prepareTransaction({
        to: testRecipient,
        value: testValue
      });

      const simulation = await signer.simulateTransaction(transaction, testRecipient);
      expect(simulation).toBeDefined();
      expect(simulation.gasUsed).toBeGreaterThanOrEqual(0n);
      expect(simulation.status).toBe(1);
      expect(Array.isArray(simulation.logs)).toBe(true);
    });

    it('should handle simulation failures gracefully', async () => {
      // Create a transaction that would fail (e.g., invalid contract call)
      const transaction = await signer.prepareTransaction({
        to: testRecipient,
        value: testValue,
        data: '0x12345678' // Invalid function selector
      });

      const simulation = await signer.simulateTransaction(transaction, testRecipient);
      expect(simulation).toBeDefined();
      expect(simulation.success).toBe(false);
      expect(simulation.error).toBeDefined();
    });
  });

  describe('Gas Price Optimization', () => {
    it('should get standard gas price', async () => {
      const gasData = await signer.getOptimalGasPrice('standard');
      expect(gasData).toBeDefined();
      expect(gasData.gasPrice || gasData.maxFeePerGas).toBeDefined();
    });

    it('should get safe gas price', async () => {
      const gasData = await signer.getOptimalGasPrice('safe');
      expect(gasData).toBeDefined();
      expect(gasData.gasPrice || gasData.maxFeePerGas).toBeDefined();
    });

    it('should get fast gas price', async () => {
      const gasData = await signer.getOptimalGasPrice('fast');
      expect(gasData).toBeDefined();
      expect(gasData.gasPrice || gasData.maxFeePerGas).toBeDefined();
    });

    it('should have consistent gas pricing across types', async () => {
      const safeGas = await signer.getOptimalGasPrice('safe');
      const standardGas = await signer.getOptimalGasPrice('standard');
      const fastGas = await signer.getOptimalGasPrice('fast');

      // Safe should be <= Standard <= Fast
      const safeValue = safeGas.gasPrice || safeGas.maxFeePerGas || 0n;
      const standardValue = standardGas.gasPrice || standardGas.maxFeePerGas || 0n;
      const fastValue = fastGas.gasPrice || fastGas.maxFeePerGas || 0n;

      expect(safeValue).toBeLessThanOrEqual(standardValue);
      expect(standardValue).toBeLessThanOrEqual(fastValue);
    });
  });

  describe('Transaction Queue Management', () => {
    const testRecipient = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const;
    const testValue = parseEther('0.1');

    it('should create transaction queue', async () => {
      const transactions = [
        {
          to: testRecipient,
          value: testValue
        },
        {
          to: testRecipient,
          value: parseEther('0.05')
        }
      ];

      const queueId = await signer.createTransactionQueue(transactions, {
        name: 'test-queue',
        batch: true,
        maxGasPerBatch: parseEther('0.1')
      });

      expect(queueId).toBeDefined();
      expect(queueId).toBe('test-queue');
    });

    it('should handle queue execution with missing wallet gracefully', async () => {
      const transactions = [
        {
          to: testRecipient,
          value: testValue
        }
      ];

      const queueId = await signer.createTransactionQueue(transactions, {
        name: 'test-queue-fail'
      });

      const invalidSigner = '0x1234567890123456789012345678901234567890' as const;

      await expect(
        signer.executeTransactionQueue(queueId, invalidSigner)
      ).rejects.toThrow('Wallet not found');
    });
  });

  describe('Type Safety', () => {
    it('should validate transaction parameters at compile time', async () => {
      const validAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const;
      const validValue = parseEther('0.1');
      const validPrivateKey = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' as Hex;

      // These should work with proper types
      const transaction = await signer.prepareTransaction({
        to: validAddress,
        value: validValue,
        data: '0x' as Hex
      });

      expect(transaction.to).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(typeof transaction.value).toBe('bigint');
      expect(transaction.gasLimit).toBeDefined();

      // Test wallet addition with proper types
      await signer.addWallet({
        privateKey: validPrivateKey,
        address: validAddress,
        index: 0,
        name: 'Type Safe Wallet'
      });

      expect(signer.getWallet(validAddress)).toBeDefined();
    });

    it('should validate hex values', () => {
      const validHex = '0x1234567890abcdef1234567890abcdef12345678' as Hex;
      const invalidHex = '1234567890abcdef1234567890abcdef12345678';

      expect(validHex).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(invalidHex).not.toMatch(/^0x[a-fA-F0-9]+$/);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid RPC URL gracefully', () => {
      const invalidSigner = createTransactionSignerViem('http://invalid-url');

      // Should not throw during creation, but health check should fail
      expect(invalidSigner).toBeDefined();
    });

    it('should handle invalid transaction parameters', async () => {
      const invalidAddress = '0xinvalid' as const;
      const validValue = parseEther('0.1');

      // TypeScript should catch this, but runtime should handle gracefully
      await expect(
        signer.prepareTransaction({
          to: invalidAddress,
          value: validValue
        } as any) // Force type bypass for testing
      ).rejects.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      // Create signer with invalid URL to test error handling
      const errorSigner = createTransactionSignerViem('http://localhost:9999');

      const health = await errorSigner.healthCheck();
      expect(health.status).toBe('unhealthy');
      expect(health.details.providerConnected).toBe(false);

      await errorSigner.cleanup();
    });
  });

  describe('Configuration Management', () => {
    it('should use custom configuration', () => {
      const customConfig = {
        maxGasPrice: parseEther('0.0000001'),
        gasMultiplier: 1.5,
        confirmations: 2,
        timeoutMs: 120000
      };

      const customSigner = createTransactionSignerViem(testRpcUrl, customConfig);
      expect(customSigner).toBeDefined();

      return customSigner.cleanup();
    });

    it('should handle empty configuration', () => {
      const defaultSigner = createTransactionSignerViem(testRpcUrl);
      expect(defaultSigner).toBeDefined();

      return defaultSigner.cleanup();
    });
  });
});

describe('Default Signer Instance', () => {
  it('should create default signer instance', () => {
    const testRpcUrl = 'https://data-seed-prebsc-1-s1.binance.org:8545';

    // Import the functions to test default instance behavior
    const {
      initializeDefaultSignerViem,
      getDefaultTransactionSignerViem,
      clearDefaultSignerViem
    } = require('../bsc/contracts/transaction-signer-viem');

    initializeDefaultSignerViem(testRpcUrl);

    const defaultSigner = getDefaultTransactionSignerViem();
    expect(defaultSigner).toBeDefined();

    clearDefaultSignerViem();
  });

  it('should throw error when default signer not initialized', () => {
    const { getDefaultTransactionSignerViem, clearDefaultSignerViem } = require('../bsc/contracts/transaction-signer-viem');

    // Clear any existing default signer
    clearDefaultSignerViem();

    expect(() => getDefaultTransactionSignerViem()).toThrow('Default transaction signer not initialized');
  });
});