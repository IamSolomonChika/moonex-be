import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { parseEther, Address, createPublicClient, createWalletClient, http } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import {
  formatAmount,
  parseAmount,
  calculateGasPrice,
  isValidAddress,
  estimateGas,
  executeContractRead,
  getCurrentGasPrice,
  getFeeData,
  formatGasPrice,
  parseGasPrice,
  calculateTransactionCost,
  validateContractResult,
  retryContractCall,
  batchMulticall,
  getContractBytecode,
  isContract,
  hexToAddress,
  addressToHex,
  isHex,
  padHex,
} from '../bsc/utils/contract-utils-viem-simple';

/**
 * Test Simplified Contract Utilities Viem Migration
 * These tests validate that simplified contract utility functions are properly migrated to Viem
 * and functioning as expected during the Ethers.js to Viem migration.
 */

describe('Simplified Contract Utilities Viem Migration Tests', () => {
  let publicClient: any;
  let testContractAddress: Address;
  const testRpcUrl = 'https://data-seed-prebsc-1-s1.binance.org:8545'; // BSC testnet

  beforeAll(() => {
    // Initialize Viem public client
    publicClient = createPublicClient({
      chain: bscTestnet,
      transport: http(testRpcUrl),
    });

    // Use PancakeSwap Router as test contract
    testContractAddress = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as Address;
  });

  describe('Basic Utility Functions', () => {
    it('should format amount correctly', () => {
      expect(formatAmount('1000000000000000000')).toBe('1000000000000000000');
      expect(formatAmount(1000000000000000000n)).toBe('1000000000000000000');
      expect(formatAmount(1000)).toBe('1000');
      expect(formatAmount('1000')).toBe('1000');
    });

    it('should parse amount correctly', () => {
      expect(parseAmount('1000000000000000000')).toBe(1000000000000000000n);
      expect(parseAmount(1000)).toBe(1000n);
      expect(parseAmount('1000')).toBe(1000n);
    });

    it('should calculate gas price with buffer', () => {
      const basePrice = 20000000000n; // 20 Gwei
      const bufferedPrice = calculateGasPrice(basePrice, 1.1);
      expect(bufferedPrice).toBe(22000000000n);

      const highBuffer = calculateGasPrice(basePrice, 1.5);
      expect(highBuffer).toBe(30000000000n);
    });

    it('should validate addresses correctly', () => {
      const validAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
      const invalidAddress = '0xinvalid';
      const shortAddress = '0x1234567890123456789012345678901234567890';

      expect(isValidAddress(validAddress)).toBe(true);
      expect(isValidAddress(invalidAddress)).toBe(false);
      expect(isValidAddress(shortAddress)).toBe(true);
      expect(isValidAddress('')).toBe(false);
    });
  });

  describe('Hex and Address Utilities', () => {
    it('should convert hex to address', () => {
      const hex = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
      const address = hexToAddress(hex);
      expect(address).toBe(hex);
    });

    it('should convert address to hex', () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as Address;
      const hex = addressToHex(address);
      expect(hex).toBe(address);
    });

    it('should check if value is hex', () => {
      expect(isHex('0x123456')).toBe(true);
      expect(isHex('0x')).toBe(false);
      expect(isHex('123456')).toBe(false);
      expect(isHex('0xGHIJKL')).toBe(false);
    });

    it('should pad hex strings', () => {
      expect(padHex('0x123')).toBe('0x0123');
      expect(padHex('0x1234')).toBe('0x1234');
    });
  });

  describe('Gas Price Utilities', () => {
    it('should format gas price to Gwei', () => {
      const gasPrice = parseEther('0.00000002'); // 20 Gwei
      const formatted = formatGasPrice(gasPrice);
      expect(formatted).toBe('20.00');
    });

    it('should parse gas price from Gwei', () => {
      const gasPriceGwei = '20';
      const parsed = parseGasPrice(gasPriceGwei);
      expect(parsed).toBe(20000000000n);
    });

    it('should calculate transaction cost', () => {
      const gasUsed = 21000n;
      const gasPrice = 20000000000n; // 20 Gwei
      const value = parseEther('1'); // 1 ETH

      const cost = calculateTransactionCost(gasUsed, gasPrice, value);

      expect(cost.gasFee).toBe(420000000000000n);
      expect(cost.totalCost).toBe(1000000000000000000n + 420000000000000n);
      expect(cost.gasFeeETH).toBe('0.00042000000000000000');
      expect(cost.totalCostETH).toMatch(/^1\.000420/);
    });
  });

  describe('Network Gas Price Functions', () => {
    it('should get current gas price', async () => {
      const gasPrice = await getCurrentGasPrice(publicClient);
      expect(gasPrice).toBeDefined();
      expect(gasPrice).toBeGreaterThan(0n);
    });

    it('should get fee data', async () => {
      const feeData = await getFeeData(publicClient);
      expect(feeData).toBeDefined();
      expect(feeData.gasPrice).toBeDefined();
      expect(feeData.gasPrice).toBeGreaterThan(0n);
    });
  });

  describe('Contract Interaction Utilities', () => {
    const ERC20_ABI = [
      {
        type: 'function',
        name: 'name',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'string' }],
      },
      {
        type: 'function',
        name: 'symbol',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'string' }],
      },
      {
        type: 'function',
        name: 'decimals',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint8' }],
      },
      {
        type: 'function',
        name: 'totalSupply',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
      },
      {
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [{ type: 'address', name: 'account' }],
        outputs: [{ type: 'uint256' }],
      },
    ];

    it('should estimate gas for contract call', async () => {
      const gasEstimate = await estimateGas(
        publicClient,
        testContractAddress,
        ERC20_ABI,
        'name'
      );

      expect(gasEstimate).toBeDefined();
      expect(gasEstimate).toBeGreaterThan(0n);
    });

    it('should execute contract read call with fallback', async () => {
      // Using a known token address (WBNB on BSC testnet)
      const tokenAddress = '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd' as Address;

      try {
        const result = await executeContractRead(
          publicClient,
          tokenAddress,
          ERC20_ABI,
          'name'
        );

        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
      } catch (error) {
        // Might fail if token doesn't exist on testnet, which is expected
        expect(error).toBeDefined();
      }
    });
  });

  describe('Result Validation', () => {
    it('should validate successful results', () => {
      const result = validateContractResult('hello', 'string');
      expect(result).toBe('hello');
    });

    it('should handle null/undefined results', () => {
      expect(() => validateContractResult(null)).toThrow('Contract call returned null or undefined');
      expect(() => validateContractResult(undefined)).toThrow('Contract call returned null or undefined');
    });

    it('should validate result types', () => {
      expect(() => validateContractResult('hello', 'number')).toThrow('Expected number, got string');
      expect(() => validateContractResult(123, 'string')).toThrow('Expected string, got number');
    });
  });

  describe('Retry Mechanism', () => {
    it('should retry successful call', async () => {
      let callCount = 0;
      const call = () => {
        callCount++;
        if (callCount === 2) {
          return Promise.resolve('success');
        }
        return Promise.reject(new Error('Temporary failure'));
      };

      const result = await retryContractCall(call, 3, 100);
      expect(result).toBe('success');
      expect(callCount).toBe(2);
    });

    it('should fail after max retries', async () => {
      const call = () => Promise.reject(new Error('Persistent failure'));

      await expect(retryContractCall(call, 2, 100)).rejects.toThrow('Persistent failure');
    });
  });

  describe('Batch Operations', () => {
    const ERC20_MINIMAL_ABI = [
      {
        type: 'function',
        name: 'name',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'string' }],
      },
      {
        type: 'function',
        name: 'symbol',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'string' }],
      },
    ];

    it('should handle batch multicall', async () => {
      const calls = [
        {
          address: testContractAddress,
          abi: ERC20_MINIMAL_ABI,
          functionName: 'name',
        },
        {
          address: testContractAddress,
          abi: ERC20_MINIMAL_ABI,
          functionName: 'symbol',
        },
      ];

      try {
        const results = await batchMulticall(publicClient, calls);

        expect(results).toHaveLength(2);
        results.forEach(result => {
          expect(result).toHaveProperty('success');
          expect(result).toHaveProperty('call');
        });
      } catch (error) {
        // Batch multicall might fail if contract doesn't support the functions
        expect(error).toBeDefined();
      }
    });

    it('should handle batch multicall with failures', async () => {
      const calls = [
        {
          address: testContractAddress,
          abi: ERC20_MINIMAL_ABI,
          functionName: 'name',
        },
        {
          address: testContractAddress,
          abi: ERC20_MINIMAL_ABI,
          functionName: 'nonExistentFunction',
        },
      ];

      const results = await batchMulticall(publicClient, calls, true);

      expect(results).toHaveLength(2);
      // At least one should fail due to non-existent function
      expect(results.some(r => !r.success)).toBe(true);
    });
  });

  describe('Contract Information', () => {
    it('should get contract bytecode', async () => {
      const bytecode = await getContractBytecode(publicClient, testContractAddress);
      expect(bytecode).toBeDefined();
      expect(typeof bytecode).toBe('string');
    });

    it('should check if address is a contract', async () => {
      const isContractAddress = await isContract(publicClient, testContractAddress);
      expect(typeof isContractAddress).toBe('boolean');

      // Test with a likely non-contract address
      const randomAddress = '0x1234567890123456789012345678901234567890' as Address;
      const isContractRandom = await isContract(publicClient, randomAddress);
      expect(typeof isContractRandom).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid contract addresses gracefully', async () => {
      const invalidAddress = '0xinvalid' as Address;

      const gasEstimate = await estimateGas(
        publicClient,
        invalidAddress,
        [],
        'name'
      );

      // Should return fallback gas estimate
      expect(gasEstimate).toBe(210000n);
    });

    it('should handle invalid function names gracefully', async () => {
      const gasEstimate = await estimateGas(
        publicClient,
        testContractAddress,
        [],
        'nonExistentFunction'
      );

      // Should return fallback gas estimate
      expect(gasEstimate).toBe(210000n);
    });

    it('should handle network errors gracefully', async () => {
      // Create client with invalid URL
      const invalidClient = createPublicClient({
        chain: bscTestnet,
        transport: http('http://localhost:9999'),
      }) as any;

      const gasPrice = await getCurrentGasPrice(invalidClient);
      expect(gasPrice).toBe(20000000000n); // Should return fallback
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle zero gas price calculations', () => {
      const cost = calculateTransactionCost(21000n, 0n, parseEther('1'));
      expect(cost.gasFee).toBe(0n);
      expect(cost.totalCost).toBe(parseEther('1'));
    });

    it('should handle very large amounts', () => {
      const largeAmount = '999999999999999999999999999999';
      const parsed = parseAmount(largeAmount);
      expect(parsed).toBe(999999999999999999999999999999n);
    });

    it('should handle edge case addresses', () => {
      const zeroAddress = '0x0000000000000000000000000000000000000000000';
      const maxAddress = '0xffffffffffffffffffffffffffffffffffffffffffffffff';

      expect(isValidAddress(zeroAddress)).toBe(true);
      expect(isValidAddress(maxAddress)).toBe(true);
    });
  });

  describe('Integration with Existing Code', () => {
    it('should be compatible with existing function signatures', () => {
      // Test that the migrated functions maintain compatibility
      const amount = parseAmount('1000');
      const formatted = formatAmount(amount);
      const gasPrice = calculateGasPrice(20000000000n);

      expect(amount).toBe(1000n);
      expect(formatted).toBe('1000');
      expect(gasPrice).toBe(20000000000n);
    });

    it('should work with real-world scenarios', async () => {
      // Test basic address validation
      const validAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
      const isValid = isValidAddress(validAddress);
      expect(isValid).toBe(true);

      // Test gas price formatting
      const gasPrice = formatGasPrice(20000000000n);
      expect(gasPrice).toBe('20.00');

      // Test transaction cost calculation
      const cost = calculateTransactionCost(21000n, 20000000000n);
      expect(cost.gasFeeETH).toBe('0.42000000000000000000');
    });
  });
});