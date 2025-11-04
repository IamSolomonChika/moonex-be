import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { parseEther, Hex } from 'viem';
import { createTransactionSignerViem } from '../bsc/contracts/transaction-signer-viem';
import { createTransactionBuilderViem, TransactionBuilderViem } from '../bsc/utils/transaction-builder-viem';

/**
 * Test Transaction Builder Viem Migration
 * These tests validate that transaction building patterns are properly migrated to Viem
 * and functioning as expected during the Ethers.js to Viem migration.
 */

describe('Transaction Builder Viem Migration Tests', () => {
  let signer: any;
  let builder: TransactionBuilderViem;
  const testRpcUrl = 'https://data-seed-prebsc-1-s1.binance.org:8545'; // BSC testnet
  const testSignerAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const;

  beforeAll(() => {
    signer = createTransactionSignerViem(testRpcUrl, {
      maxGasPrice: parseEther('0.00000001'), // 10 Gwei
      gasMultiplier: 1.2,
      confirmations: 1,
      timeoutMs: 60000 // 1 minute for tests
    });

    builder = createTransactionBuilderViem(signer, {
      defaultGasLimit: BigInt(200000),
      slippageTolerance: 0.5,
      defaultDeadline: 1200
    });
  });

  afterAll(async () => {
    if (signer) {
      await signer.cleanup();
    }
  });

  describe('Transaction Builder Initialization', () => {
    it('should create transaction builder with Viem signer', () => {
      expect(builder).toBeDefined();
      expect(builder.buildSwapTransaction).toBeDefined();
      expect(builder.buildLiquidityTransaction).toBeDefined();
      expect(builder.buildFarmingTransaction).toBeDefined();
      expect(builder.buildApprovalTransaction).toBeDefined();
      expect(builder.buildBatchTransaction).toBeDefined();
      expect(builder.buildCustomTransaction).toBeDefined();
      expect(builder.optimizeGasSettings).toBeDefined();
      expect(builder.validateTransaction).toBeDefined();
    });

    it('should use default configuration', () => {
      const defaultBuilder = createTransactionBuilderViem(signer);
      expect(defaultBuilder).toBeDefined();
    });

    it('should use custom configuration', () => {
      const customBuilder = createTransactionBuilderViem(signer, {
        defaultGasLimit: BigInt(300000),
        slippageTolerance: 1.0,
        defaultDeadline: 1800,
        maxSlippage: 10
      });
      expect(customBuilder).toBeDefined();
    });
  });

  describe('Swap Transaction Building', () => {
    const tokenIn = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as const; // WBNB
    const tokenOut = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as const; // BUSD
    const amountIn = parseEther('1');

    it('should build basic swap transaction', async () => {
      const transaction = await builder.buildSwapTransaction({
        tokenIn,
        tokenOut,
        amountIn
      }, testSignerAddress);

      expect(transaction).toBeDefined();
      expect(transaction.to).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(transaction.value).toBe(amountIn); // WBNB is native token
      expect(transaction.metadata?.type).toBe('swap');
      expect(transaction.metadata?.tags).toContain('swap');
      expect(transaction.optimization?.simulateBeforeSend).toBe(true);
    });

    it('should build swap transaction with custom parameters', async () => {
      const amountOutMin = parseEther('950'); // 5% slippage
      const recipient = '0x1234567890123456789012345678901234567890' as const;
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

      const transaction = await builder.buildSwapTransaction({
        tokenIn,
        tokenOut,
        amountIn,
        amountOutMin,
        recipient,
        deadline
      }, testSignerAddress, {
        slippageTolerance: 5.0,
        exactInput: true
      });

      expect(transaction.metadata?.maxSlippage).toBe(5.0);
      expect(transaction.metadata?.description).toContain('Swap');
    });

    it('should build swap transaction with custom router', async () => {
      const customRouter = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as const;

      const transaction = await builder.buildSwapTransaction({
        tokenIn,
        tokenOut,
        amountIn
      }, testSignerAddress, {
        routerAddress: customRouter
      });

      expect(transaction.to).toBe(customRouter);
    });

    it('should handle different token types', async () => {
      const erc20Token = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' as const; // CAKE

      const transaction = await builder.buildSwapTransaction({
        tokenIn: erc20Token,
        tokenOut,
        amountIn
      }, testSignerAddress);

      expect(transaction.value).toBe(0n); // ERC20 tokens don't send native value
    });
  });

  describe('Liquidity Transaction Building', () => {
    const tokenA = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as const; // WBNB
    const tokenB = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as const; // BUSD
    const amountA = parseEther('1');
    const amountB = parseEther('1000');

    it('should build add liquidity transaction', async () => {
      const transaction = await builder.buildLiquidityTransaction({
        tokenA,
        tokenB,
        amountADesired: amountA,
        amountBDesired: amountB
      }, testSignerAddress);

      expect(transaction).toBeDefined();
      expect(transaction.metadata?.type).toBe('liquidity');
      expect(transaction.metadata?.description).toContain('Add');
      expect(transaction.metadata?.tags).toContain('liquidity');
      expect(transaction.optimization?.simulateBeforeSend).toBe(true);
    });

    it('should build remove liquidity transaction', async () => {
      const transaction = await builder.buildLiquidityTransaction({
        tokenA,
        tokenB,
        amountADesired: amountA,
        amountBDesired: amountB
      }, testSignerAddress, {
        action: 'remove'
      });

      expect(transaction.metadata?.description).toContain('Remove');
    });

    it('should build liquidity transaction with minimum amounts', async () => {
      const amountAMin = parseEther('0.95');
      const amountBMin = parseEther('950');

      const transaction = await builder.buildLiquidityTransaction({
        tokenA,
        tokenB,
        amountADesired: amountA,
        amountBDesired: amountB,
        amountAMin,
        amountBMin
      }, testSignerAddress);

      expect(transaction.metadata?.maxSlippage).toBeGreaterThan(0);
    });

    it('should build liquidity transaction with custom recipient', async () => {
      const recipient = '0x1234567890123456789012345678901234567890' as const;

      const transaction = await builder.buildLiquidityTransaction({
        tokenA,
        tokenB,
        amountADesired: amountA,
        amountBDesired: amountB,
        recipient
      }, testSignerAddress);

      expect(transaction).toBeDefined();
    });
  });

  describe('Farming Transaction Building', () => {
    const poolId = 0n;
    const amount = parseEther('100');

    it('should build deposit farming transaction', async () => {
      const transaction = await builder.buildFarmingTransaction({
        poolId,
        amount,
        action: 'deposit'
      }, testSignerAddress);

      expect(transaction).toBeDefined();
      expect(transaction.metadata?.type).toBe('farming');
      expect(transaction.metadata?.description).toContain('deposit');
      expect(transaction.metadata?.tags).toContain('farming');
      expect(transaction.metadata?.tags).toContain('deposit');
    });

    it('should build withdraw farming transaction', async () => {
      const transaction = await builder.buildFarmingTransaction({
        poolId,
        amount,
        action: 'withdraw'
      }, testSignerAddress);

      expect(transaction.metadata?.description).toContain('withdraw');
      expect(transaction.metadata?.tags).toContain('withdraw');
    });

    it('should build harvest farming transaction', async () => {
      const transaction = await builder.buildFarmingTransaction({
        poolId,
        amount: 0n,
        action: 'harvest'
      }, testSignerAddress);

      expect(transaction.metadata?.description).toContain('harvest');
      expect(transaction.metadata?.tags).toContain('harvest');
    });

    it('should build farming transaction with custom MasterChef', async () => {
      const customMasterChef = '0x73feaa1eE314F8c655E354234017bE2193C9E24E' as const;

      const transaction = await builder.buildFarmingTransaction({
        poolId,
        amount,
        action: 'deposit'
      }, testSignerAddress, {
        masterChefAddress: customMasterChef
      });

      expect(transaction.to).toBe(customMasterChef);
    });
  });

  describe('Approval Transaction Building', () => {
    const token = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' as const; // CAKE
    const spender = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as const; // PancakeSwap Router
    const amount = parseEther('1000');

    it('should build approval transaction', async () => {
      const transaction = await builder.buildApprovalTransaction({
        token,
        spender,
        amount
      }, testSignerAddress);

      expect(transaction).toBeDefined();
      expect(transaction.to).toBe(token);
      expect(transaction.value).toBe(0n);
      expect(transaction.metadata?.type).toBe('approval');
      expect(transaction.metadata?.priority).toBe('high');
      expect(transaction.metadata?.tags).toContain('approval');
      expect(transaction.optimization?.simulateBeforeSend).toBe(false);
    });

    it('should build max approval transaction', async () => {
      const maxAmount = 115792089237316195423570985008687907853269984665640564039457584007913129639935n; // 2^256 - 1

      const transaction = await builder.buildApprovalTransaction({
        token,
        spender,
        amount: maxAmount
      }, testSignerAddress);

      expect(transaction).toBeDefined();
      expect(transaction.metadata?.estimatedValue).toBe(maxAmount);
    });

    it('should build approval with custom owner', async () => {
      const owner = '0x1234567890123456789012345678901234567890' as const;

      const transaction = await builder.buildApprovalTransaction({
        token,
        spender,
        amount,
        owner
      }, testSignerAddress);

      expect(transaction).toBeDefined();
    });
  });

  describe('Batch Transaction Building', () => {
    it('should build batch transaction', async () => {
      const transactions = [
        {
          to: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' as const,
          data: '0x095ea7b3' as Hex,
          value: 0n
        },
        {
          to: '0x10ED43C718714eb63d5aA57B78B54704E256024E' as const,
          data: '0x38ed1739' as Hex,
          value: parseEther('1')
        }
      ];

      const transaction = await builder.buildBatchTransaction({
        transactions
      }, testSignerAddress);

      expect(transaction).toBeDefined();
      expect(transaction.metadata?.type).toBe('batch');
      expect(transaction.metadata?.description).toContain('2 operations');
      expect(transaction.metadata?.tags).toContain('batch');
      expect(transaction.value).toBe(parseEther('1')); // Sum of values
    });

    it('should build batch transaction with revert on failure', async () => {
      const transactions = [
        {
          to: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' as const,
          data: '0x095ea7b3' as Hex,
          value: 0n
        }
      ];

      const transaction = await builder.buildBatchTransaction({
        transactions,
        revertOnFailure: true
      }, testSignerAddress);

      expect(transaction).toBeDefined();
    });

    it('should build batch transaction with custom multicall', async () => {
      const customMulticall = '0xca11bde05977b3631167028862be2a173976ca11' as const;
      const transactions = [
        {
          to: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' as const,
          data: '0x095ea7b3' as Hex,
          value: 0n
        }
      ];

      const transaction = await builder.buildBatchTransaction({
        transactions
      }, testSignerAddress, {
        multicallAddress: customMulticall
      });

      expect(transaction.to).toBe(customMulticall);
    });
  });

  describe('Custom Transaction Building', () => {
    it('should build custom transaction with metadata', async () => {
      const recipient = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const;
      const value = parseEther('0.1');

      const transaction = await builder.buildCustomTransaction({
        to: recipient,
        value,
        data: '0x' as Hex
      }, testSignerAddress, {
        type: 'custom',
        description: 'Custom transfer',
        tags: ['transfer', 'custom'],
        priority: 'high',
        estimatedValue: value
      });

      expect(transaction).toBeDefined();
      expect(transaction.to).toBe(recipient);
      expect(transaction.value).toBe(value);
      expect(transaction.metadata?.type).toBe('custom');
      expect(transaction.metadata?.description).toBe('Custom transfer');
      expect(transaction.metadata?.priority).toBe('high');
      expect(transaction.optimization?.simulateBeforeSend).toBe(true);
    });

    it('should build custom transaction with custom optimization', async () => {
      const recipient = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const;

      const transaction = await builder.buildCustomTransaction({
        to: recipient,
        value: parseEther('0.1'),
        data: '0x' as Hex
      }, testSignerAddress, {
        type: 'custom',
        description: 'Custom transaction'
      }, {
        simulateBeforeSend: false,
        retryOnFailure: false,
        maxRetries: 1,
        retryDelay: 1000
      });

      expect(transaction.optimization?.simulateBeforeSend).toBe(false);
      expect(transaction.optimization?.retryOnFailure).toBe(false);
      expect(transaction.optimization?.maxRetries).toBe(1);
    });
  });

  describe('Gas Optimization', () => {
    it('should optimize gas settings for slow priority', async () => {
      const recipient = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const;
      const baseTransaction = await builder.buildCustomTransaction({
        to: recipient,
        value: parseEther('0.1'),
        data: '0x' as Hex
      }, testSignerAddress, {
        type: 'custom',
        description: 'Test transaction'
      });

      const optimizedTransaction = await builder.optimizeGasSettings(baseTransaction, 'slow');

      expect(optimizedTransaction.metadata?.priority).toBe('slow');
      expect(optimizedTransaction.gasPrice || optimizedTransaction.maxFeePerGas).toBeDefined();
    });

    it('should optimize gas settings for urgent priority', async () => {
      const recipient = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const;
      const baseTransaction = await builder.buildCustomTransaction({
        to: recipient,
        value: parseEther('0.1'),
        data: '0x' as Hex,
        gasLimit: BigInt(21000)
      }, testSignerAddress, {
        type: 'custom',
        description: 'Test transaction'
      });

      const optimizedTransaction = await builder.optimizeGasSettings(baseTransaction, 'urgent');

      expect(optimizedTransaction.metadata?.priority).toBe('urgent');
      expect(optimizedTransaction.gasLimit).toBeGreaterThan(BigInt(21000)); // Should be multiplied
    });

    it('should optimize gas settings for standard priority', async () => {
      const recipient = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const;
      const baseTransaction = await builder.buildCustomTransaction({
        to: recipient,
        value: parseEther('0.1'),
        data: '0x' as Hex
      }, testSignerAddress, {
        type: 'custom',
        description: 'Test transaction'
      });

      const optimizedTransaction = await builder.optimizeGasSettings(baseTransaction, 'standard');

      expect(optimizedTransaction.metadata?.priority).toBe('standard');
    });
  });

  describe('Transaction Validation', () => {
    it('should validate correct transaction', async () => {
      const recipient = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const;
      const transaction = await builder.buildCustomTransaction({
        to: recipient,
        value: parseEther('0.1'),
        data: '0x' as Hex
      }, testSignerAddress, {
        type: 'custom',
        description: 'Valid transaction'
      });

      const validation = builder.validateTransaction(transaction);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid address', async () => {
      const invalidTransaction = {
        to: '0xinvalid' as const,
        value: parseEther('0.1'),
        data: '0x' as Hex,
        metadata: {
          type: 'custom' as const,
          description: 'Invalid transaction',
          tags: ['custom']
        },
        optimization: {
          simulateBeforeSend: true,
          retryOnFailure: true,
          maxRetries: 2,
          retryDelay: 2000
        }
      };

      const validation = builder.validateTransaction(invalidTransaction);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid recipient address');
    });

    it('should detect negative value', async () => {
      const recipient = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const;
      const invalidTransaction = {
        to: recipient,
        value: -1n,
        data: '0x' as Hex,
        metadata: {
          type: 'custom' as const,
          description: 'Invalid transaction',
          tags: ['custom']
        },
        optimization: {
          simulateBeforeSend: true,
          retryOnFailure: true,
          maxRetries: 2,
          retryDelay: 2000
        }
      };

      const validation = builder.validateTransaction(invalidTransaction);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Transaction value cannot be negative');
    });

    it('should detect high gas price warning', async () => {
      const recipient = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const;
      const highGasPriceTransaction = {
        to: recipient,
        value: parseEther('0.1'),
        data: '0x' as Hex,
        gasPrice: parseEther('0.01'), // Very high gas price
        metadata: {
          type: 'custom' as const,
          description: 'High gas price transaction',
          tags: ['custom']
        },
        optimization: {
          simulateBeforeSend: true,
          retryOnFailure: true,
          maxRetries: 2,
          retryDelay: 2000
        }
      };

      const validation = builder.validateTransaction(highGasPriceTransaction);

      expect(validation.valid).toBe(true);
      expect(validation.warnings).toContain('Very high gas price detected');
    });

    it('should detect high slippage warning', async () => {
      const recipient = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const;
      const highSlippageTransaction = {
        to: recipient,
        value: parseEther('0.1'),
        data: '0x' as Hex,
        metadata: {
          type: 'custom' as const,
          description: 'High slippage transaction',
          tags: ['custom'],
          maxSlippage: 15 // 15% slippage
        },
        optimization: {
          simulateBeforeSend: true,
          retryOnFailure: true,
          maxRetries: 2,
          retryDelay: 2000
        }
      };

      const validation = builder.validateTransaction(highSlippageTransaction);

      expect(validation.valid).toBe(true);
      expect(validation.warnings).toContain('High slippage tolerance may result in unfavorable trades');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid swap parameters gracefully', async () => {
      const invalidTokenIn = '0xinvalid' as const;
      const validTokenOut = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as const;

      await expect(
        builder.buildSwapTransaction({
          tokenIn: invalidTokenIn,
          tokenOut: validTokenOut,
          amountIn: parseEther('1')
        }, testSignerAddress)
      ).rejects.toThrow();
    });

    it('should handle invalid liquidity parameters gracefully', async () => {
      const validTokenA = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as const;
      const invalidTokenB = '0xinvalid' as const;

      await expect(
        builder.buildLiquidityTransaction({
          tokenA: validTokenA,
          tokenB: invalidTokenB,
          amountADesired: parseEther('1'),
          amountBDesired: parseEther('1000')
        }, testSignerAddress)
      ).rejects.toThrow();
    });
  });
});