/**
 * Trading Integration Tests - Updated for Viem Migration
 * Tests trading functionality with Viem-based services
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

// Viem imports for trading integration testing
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  Address,
  Hash,
  Account,
  PublicClient,
  WalletClient
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';

// Legacy trading calculator (preserved for existing functionality)
import { AMMCalculator } from '../services/trading/amm-calculator';

// Viem-based trading services
import { SwapServiceViem } from '../bsc/services/trading/swap-service-viem.js';
import { PancakeSwapRouterViem } from '../bsc/services/trading/pancakeSwap-router-viem.js';
import { AMMIntegrationViem } from '../bsc/services/trading/amm-integration-viem.js';
import { RoutingServiceViem } from '../bsc/services/trading/routing-service-viem.js';
import { GasOptimizationServiceViem } from '../bsc/services/trading/gas-optimization-viem.js';
import { SlippageProtectionServiceViem } from '../bsc/services/trading/slippage-protection-viem.js';
import { MEVProtectionServiceViem } from '../bsc/services/trading/mev-protection-viem.js';
import { TransactionQueueServiceViem } from '../bsc/services/trading/transaction-queue-viem.js';

describe('Trading Integration Tests - Viem Migration', () => {
  let publicClient: PublicClient<any, any>;
  let walletClient: WalletClient<any, any>;
  let testAccount: Account;

  // Legacy calculator
  let calculator: AMMCalculator;

  // Viem-based trading services
  let swapService: SwapServiceViem;
  let pancakeSwapRouter: PancakeSwapRouterViem;
  let ammIntegration: AMMIntegrationViem;
  let routingService: RoutingServiceViem;
  let gasOptimizationService: GasOptimizationServiceViem;
  let slippageProtectionService: SlippageProtectionServiceViem;
  let mevProtectionService: MEVProtectionServiceViem;
  let transactionQueueService: TransactionQueueServiceViem;

  beforeAll(async () => {
    // Initialize legacy calculator
    calculator = new AMMCalculator();

    // Setup Viem clients for BSC testnet
    testAccount = mnemonicToAccount('test test test test test test test test test test test junk');

    publicClient = createPublicClient({
      chain: bscTestnet,
      transport: http('https://data-seed-prebsc-1-s1.binance.org:8545/')
    });

    walletClient = createWalletClient({
      chain: bscTestnet,
      transport: http('https://data-seed-prebsc-1-s1.binance.org:8545/'),
      account: testAccount
    });

    // Initialize Viem-based trading services
    pancakeSwapRouter = new PancakeSwapRouterViem(publicClient, walletClient);
    swapService = new SwapServiceViem(publicClient, walletClient, pancakeSwapRouter);
    ammIntegration = new AMMIntegrationViem(publicClient);
    routingService = new RoutingServiceViem(publicClient);
    gasOptimizationService = new GasOptimizationServiceViem(publicClient);
    slippageProtectionService = new SlippageProtectionServiceViem(publicClient);
    mevProtectionService = new MEVProtectionServiceViem(publicClient, walletClient);
    transactionQueueService = new TransactionQueueServiceViem(publicClient, walletClient);
  });

  afterAll(async () => {
    // Cleanup services if needed
    await transactionQueueService.shutdown();
  });

  describe('calculateSwapOutput', () => {
    it('should calculate correct swap output for simple case', () => {
      const inputAmount = '1000';
      const inputReserve = '10000';
      const outputReserve = '20000';
      const fee = '0.003'; // 0.3%

      const output = calculator.calculateSwapOutput(
        inputAmount,
        inputReserve,
        outputReserve,
        fee
      );

      expect(output).toBeDefined();
      expect(parseFloat(output)).toBeGreaterThan(0);
      expect(parseFloat(output)).toBeLessThan(parseFloat(outputReserve));
    });

    it('should handle zero input amount', () => {
      expect(() => {
        calculator.calculateSwapOutput('0', '1000', '2000', '0.003');
      }).toThrow('Input amount must be greater than 0');
    });

    it('should handle zero reserves', () => {
      expect(() => {
        calculator.calculateSwapOutput('100', '0', '2000', '0.003');
      }).toThrow('Reserves must be greater than 0');
    });

    it('should respect fee calculation', () => {
      const inputAmount = '1000';
      const inputReserve = '10000';
      const outputReserve = '20000';

      const outputWithFee = calculator.calculateSwapOutput(
        inputAmount,
        inputReserve,
        outputReserve,
        '0.01' // 1% fee
      );

      const outputNoFee = calculator.calculateSwapOutput(
        inputAmount,
        inputReserve,
        outputReserve,
        '0' // No fee
      );

      expect(parseFloat(outputWithFee)).toBeLessThan(parseFloat(outputNoFee));
    });
  });

  describe('generateSwapQuote', () => {
    it('should generate complete swap quote', () => {
      const quote = calculator.generateSwapQuote(
        '1000', // input amount
        '10000', // input reserve
        '20000', // output reserve
        '0.003', // fee
        '0.005' // slippage tolerance
      );

      expect(quote).toHaveProperty('inputAmount', '1000');
      expect(quote).toHaveProperty('outputAmount');
      expect(quote).toHaveProperty('price');
      expect(quote).toHaveProperty('priceImpact');
      expect(quote).toHaveProperty('fee');
      expect(quote).toHaveProperty('slippage', '0.005');
      expect(quote).toHaveProperty('minimumOutput');

      expect(parseFloat(quote.minimumOutput)).toBeLessThan(parseFloat(quote.outputAmount));
      expect(parseFloat(quote.priceImpact)).toBeGreaterThanOrEqual(0);
    });

    it('should calculate slippage protection correctly', () => {
      const quote = calculator.generateSwapQuote(
        '1000',
        '10000',
        '20000',
        '0.003',
        '0.01' // 1% slippage
      );

      const expectedMinimum = parseFloat(quote.outputAmount) * 0.99; // 1% less than output
      expect(parseFloat(quote.minimumOutput)).toBeCloseTo(expectedMinimum, 2);
    });
  });

  describe('calculateLiquidityAmounts', () => {
    it('should calculate optimal liquidity amounts', () => {
      const result = calculator.calculateLiquidityAmounts(
        '1000', // amount0
        '2000', // amount1
        '10000', // reserve0
        '20000'  // reserve1
      );

      expect(result).toHaveProperty('amount0');
      expect(result).toHaveProperty('amount1');
      expect(result.amount0).toBe('1000'); // Should keep amount0 as is
      expect(parseFloat(result.amount1)).toBeCloseTo(2000, 0); // Should adjust amount1
    });

    it('should handle first liquidity provider', () => {
      const result = calculator.calculateLiquidityAmounts(
        '1000',
        '2000',
        '0', // No existing reserves
        '0'
      );

      expect(result.amount0).toBe('1000');
      expect(result.amount1).toBe('2000');
    });
  });

  describe('calculateImpermanentLoss', () => {
    it('should calculate impermanent loss correctly', () => {
      // 2x price change should result in ~5.7% loss
      const loss = calculator.calculateImpermanentLoss('2', '1');
      const lossPercentage = parseFloat(loss);

      expect(lossPercentage).toBeGreaterThan(0);
      expect(lossPercentage).toBeLessThan(6); // Should be around 5.7%
    });

    it('should return zero loss for no price change', () => {
      const loss = calculator.calculateImpermanentLoss('1', '1');
      expect(parseFloat(loss)).toBeCloseTo(0, 5);
    });

    it('should handle price decrease', () => {
      const loss = calculator.calculateImpermanentLoss('0.5', '1');
      expect(parseFloat(loss)).toBeGreaterThan(0);
    });
  });

  // Viem Trading Service Integration Tests
  describe('Viem Trading Service Integration', () => {
    test('should initialize Viem-based trading services', () => {
      expect(swapService).toBeDefined();
      expect(pancakeSwapRouter).toBeDefined();
      expect(ammIntegration).toBeDefined();
      expect(routingService).toBeDefined();
      expect(gasOptimizationService).toBeDefined();
      expect(slippageProtectionService).toBeDefined();
      expect(mevProtectionService).toBeDefined();
      expect(transactionQueueService).toBeDefined();
    });

    test('should connect to BSC testnet for trading', async () => {
      const blockNumber = await publicClient.getBlockNumber();
      expect(typeof blockNumber).toBe('bigint');
      expect(blockNumber).toBeGreaterThan(0n);

      const gasPrice = await publicClient.getGasPrice();
      expect(typeof gasPrice).toBe('bigint');
      expect(gasPrice).toBeGreaterThan(0n);
    });
  });

  describe('Viem Swap Service Integration', () => {
    test('should get swap quotes using Viem', async () => {
      const quote = await swapService.getSwapQuote({
        tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address, // WBNB
        tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address, // BUSD
        amountIn: parseEther('0.1'),
        slippageTolerancePercent: 0.5
      });

      expect(quote).toBeDefined();
      expect(quote.amountOut).toBeGreaterThan(0n);
      expect(quote.route).toBeDefined();
      expect(quote.gasEstimate).toBeDefined();
    });

    test('should handle multiple token pairs', async () => {
      const pairs = [
        {
          tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address, // WBNB
          tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address, // BUSD
        },
        {
          tokenIn: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address, // BUSD
          tokenOut: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' as Address, // CAKE
        }
      ];

      const quotes = await Promise.allSettled(
        pairs.map(pair =>
          swapService.getSwapQuote({
            ...pair,
            amountIn: parseEther('0.1'),
            slippageTolerancePercent: 0.5
          })
        )
      );

      quotes.forEach(result => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.amountOut).toBeGreaterThan(0n);
        }
      });
    });

    test('should handle invalid swap parameters gracefully', async () => {
      await expect(
        swapService.getSwapQuote({
          tokenIn: '0xinvalid' as Address,
          tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
          amountIn: parseEther('0.1'),
          slippageTolerancePercent: 0.5
        })
      ).rejects.toThrow();
    });
  });

  describe('Viem AMM Integration', () => {
    test('should calculate swap output using Viem', async () => {
      const result = await ammIntegration.calculateSwapOutput({
        tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
        tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
        amountIn: parseEther('0.1'),
        fee: 0.0025 // 0.25% PancakeSwap fee
      });

      expect(result).toBeDefined();
      expect(result.amountOut).toBeGreaterThan(0n);
      expect(result.priceImpact).toBeGreaterThanOrEqual(0);
    });

    test('should get optimal route using Viem', async () => {
      const route = await routingService.getOptimalRoute({
        tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
        tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
        amountIn: parseEther('1')
      });

      expect(route).toBeDefined();
      expect(Array.isArray(route.path)).toBe(true);
      expect(route.path.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Viem Gas Optimization Integration', () => {
    test('should optimize gas parameters', async () => {
      const gasOptimization = await gasOptimizationService.optimizeGasParams({
        to: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
        value: parseEther('0.1'),
        data: '0x'
      });

      expect(gasOptimization).toBeDefined();
      expect(gasOptimization.gasPrice).toBeDefined();
      expect(gasOptimization.gasLimit).toBeDefined();
      expect(typeof gasOptimization.gasPrice).toBe('bigint');
      expect(typeof gasOptimization.gasLimit).toBe('bigint');
    });

    test('should provide gas estimates', async () => {
      const gasEstimate = await gasOptimizationService.estimateGas({
        to: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
        value: parseEther('0.1'),
        data: '0x'
      });

      expect(typeof gasEstimate).toBe('bigint');
      expect(gasEstimate).toBeGreaterThan(0n);
    });

    test('should track gas optimization metrics', () => {
      const metrics = gasOptimizationService.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalOptimizations).toBeGreaterThanOrEqual(0);
      expect(metrics.gasSaved).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Viem Slippage Protection Integration', () => {
    test('should calculate slippage tolerance', () => {
      const slippageCalc = slippageProtectionService.calculateSlippageTolerance(
        parseEther('100'),
        1.0 // 1% slippage
      );

      expect(slippageCalc).toBeDefined();
      expect(slippageCalc.minimumOut).toBeGreaterThan(0n);
      expect(slippageCalc.maximumIn).toBeGreaterThan(0n);
    });

    test('should validate slippage parameters', () => {
      const isValid = slippageProtectionService.validateSlippageParams({
        amountIn: parseEther('1'),
        amountOutMin: parseEther('0.95'),
        slippageTolerancePercent: 5.0
      });

      expect(isValid).toBe(true);
    });

    test('should detect excessive slippage', () => {
      const hasExcessiveSlippage = slippageProtectionService.hasExcessiveSlippage({
        expectedOut: parseEther('100'),
        actualOut: parseEther('90'), // 10% slippage
        tolerancePercent: 5.0
      });

      expect(hasExcessiveSlippage).toBe(true);
    });
  });

  describe('Viem MEV Protection Integration', () => {
    test('should analyze MEV risk', async () => {
      const riskAnalysis = await mevProtectionService.analyzeMEVRisk({
        tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
        tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
        amountIn: parseEther('1'),
        recipient: testAccount.address
      });

      expect(riskAnalysis).toBeDefined();
      expect(riskAnalysis.riskLevel).toBeDefined();
      expect(typeof riskAnalysis.riskScore).toBe('number');
    });

    test('should suggest MEV protection strategies', async () => {
      const strategies = await mevProtectionService.suggestProtectionStrategies({
        riskScore: 0.7,
        transactionType: 'swap'
      });

      expect(Array.isArray(strategies)).toBe(true);
      expect(strategies.length).toBeGreaterThan(0);
    });
  });

  describe('Viem Transaction Queue Integration', () => {
    test('should queue transactions', async () => {
      const transactionId = await transactionQueueService.queueTransaction({
        to: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
        value: parseEther('0.1'),
        data: '0x',
        priority: 'normal'
      });

      expect(typeof transactionId).toBe('string');
      expect(transactionId).toMatch(/^tx_\d+_[a-z0-9]+$/);
    });

    test('should get transaction status', async () => {
      const transactionId = await transactionQueueService.queueTransaction({
        to: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
        value: parseEther('0.1'),
        data: '0x',
        priority: 'normal'
      });

      const status = await transactionQueueService.getTransactionStatus(transactionId);
      expect(status).toBeDefined();
      expect(status.id).toBe(transactionId);
      expect(['queued', 'pending', 'executing', 'completed', 'failed']).toContain(status.status);
    });

    test('should handle transaction queue metrics', () => {
      const metrics = transactionQueueService.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalQueued).toBeGreaterThanOrEqual(0);
      expect(metrics.completed).toBeGreaterThanOrEqual(0);
      expect(metrics.failed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cross-Service Trading Integration', () => {
    test('should handle complete trading workflow', async () => {
      // 1. Get optimal route
      const route = await routingService.getOptimalRoute({
        tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
        tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
        amountIn: parseEther('0.1')
      });

      // 2. Get swap quote
      const quote = await swapService.getSwapQuote({
        tokenIn: route.path[0],
        tokenOut: route.path[route.path.length - 1],
        amountIn: parseEther('0.1'),
        slippageTolerancePercent: 0.5
      });

      // 3. Optimize gas
      const gasOptimization = await gasOptimizationService.optimizeGasParams({
        to: quote.router,
        value: quote.amountOut,
        data: quote.transactionData || '0x'
      });

      // 4. Check slippage protection
      const slippageValid = slippageProtectionService.validateSlippageParams({
        amountIn: parseEther('0.1'),
        amountOutMin: quote.amountOut,
        slippageTolerancePercent: 0.5
      });

      // 5. Analyze MEV risk
      const riskAnalysis = await mevProtectionService.analyzeMEVRisk({
        tokenIn: route.path[0],
        tokenOut: route.path[route.path.length - 1],
        amountIn: parseEther('0.1'),
        recipient: testAccount.address
      });

      expect(route).toBeDefined();
      expect(quote.amountOut).toBeGreaterThan(0n);
      expect(gasOptimization.gasPrice).toBeGreaterThan(0n);
      expect(slippageValid).toBe(true);
      expect(riskAnalysis.riskLevel).toBeDefined();
    });

    test('should handle concurrent trading operations', async () => {
      const operations = [
        swapService.getSwapQuote({
          tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
          tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
          amountIn: parseEther('0.1'),
          slippageTolerancePercent: 0.5
        }),
        gasOptimizationService.optimizeGasParams({
          to: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
          value: parseEther('0.1'),
          data: '0x'
        }),
        routingService.getOptimalRoute({
          tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
          tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
          amountIn: parseEther('0.1')
        })
      ];

      const results = await Promise.allSettled(operations);

      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value).toBeDefined();
        }
      });
    });
  });

  describe('Trading Error Handling Integration', () => {
    test('should handle network errors gracefully', async () => {
      const invalidClient = createPublicClient({
        chain: bscTestnet,
        transport: http('http://invalid-url')
      });

      const invalidSwapService = new SwapServiceViem(invalidClient, walletClient);

      await expect(
        invalidSwapService.getSwapQuote({
          tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
          tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
          amountIn: parseEther('0.1'),
          slippageTolerancePercent: 0.5
        })
      ).rejects.toThrow();
    });

    test('should handle invalid trading parameters', async () => {
      await expect(
        swapService.getSwapQuote({
          tokenIn: '0xinvalid' as Address,
          tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
          amountIn: parseEther('0.1'),
          slippageTolerancePercent: 0.5
        })
      ).rejects.toThrow();
    });
  });

  describe('Trading Performance Integration', () => {
    test('should complete trading operations efficiently', async () => {
      const startTime = Date.now();

      await swapService.getSwapQuote({
        tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
        tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
        amountIn: parseEther('0.1'),
        slippageTolerancePercent: 0.5
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000);
    });

    test('should maintain trading metrics consistency', () => {
      const gasMetrics = gasOptimizationService.getMetrics();
      const slippageMetrics = slippageProtectionService.getMetrics();
      const queueMetrics = transactionQueueService.getMetrics();

      expect(typeof gasMetrics.totalOptimizations).toBe('number');
      expect(typeof slippageMetrics.protectionsApplied).toBe('number');
      expect(typeof queueMetrics.totalQueued).toBe('number');
    });
  });
});