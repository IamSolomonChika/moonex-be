/**
 * BSC Integration Tests - Updated for Viem Migration
 * Tests BSC-specific functionality with Viem-based services
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

// Viem imports for BSC integration testing
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  Address,
  Hash,
  Chain,
  Account,
  PublicClient,
  WalletClient
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';

// Viem-based BSC services
import { BSCTokenServiceViem } from '../bsc/services/tokens/token-service-viem.js';
import { SwapServiceViem } from '../bsc/services/trading/swap-service-viem.js';
import { LiquidityServiceViem } from '../bsc/services/liquidity/liquidity-service-viem.js';
import { YieldFarmingServiceViem } from '../bsc/services/yield/farming-service-viem.js';
import { CakeGovernanceServiceViem } from '../bsc/services/governance/cake-governance-viem.js';

// Performance and real-time services
import { RealTimeUpdaterViem } from '../bsc/services/performance/realtime-updater-viem.js';
import { AdvancedBatchProcessorViem } from '../bsc/services/performance/batch-processor-viem.js';
import { BSCTransactionOptimizerViem } from '../bsc/services/performance/transaction-optimizer-viem.js';

// BSC configuration
import { BSC_CONFIG } from '../config/bsc.js';

describe('BSC Integration Tests - Viem Migration', () => {
  let publicClient: PublicClient<any, Chain>;
  let walletClient: WalletClient<any, Chain>;
  let testAccount: Account;

  // Viem-based BSC services
  let tokenService: BSCTokenServiceViem;
  let swapService: SwapServiceViem;
  let liquidityService: LiquidityServiceViem;
  let yieldService: YieldFarmingServiceViem;
  let governanceService: CakeGovernanceServiceViem;

  // Performance services
  let realTimeUpdater: RealTimeUpdaterViem;
  let batchProcessor: AdvancedBatchProcessorViem;
  let txOptimizer: BSCTransactionOptimizerViem;

  beforeAll(async () => {
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

    // Initialize Viem-based BSC services
    tokenService = new BSCTokenServiceViem(publicClient);
    swapService = new SwapServiceViem(publicClient, walletClient);
    liquidityService = new LiquidityServiceViem(publicClient, walletClient);
    yieldService = new YieldFarmingServiceViem(publicClient, walletClient);
    governanceService = new CakeGovernanceServiceViem(publicClient, walletClient);

    // Initialize performance services
    realTimeUpdater = new RealTimeUpdaterViem(publicClient);
    batchProcessor = new AdvancedBatchProcessorViem(publicClient);
    txOptimizer = new BSCTransactionOptimizerViem(publicClient);
  });

  afterAll(async () => {
    // Cleanup services if needed
    await realTimeUpdater.shutdown();
    await batchProcessor.shutdown();
    await txOptimizer.shutdown();
  });

  describe('BSC Infrastructure Integration', () => {
    test('should have BSC route structure available', async () => {
      const bscRoutesModule = await import('../routes/bsc/index.js');
      expect(bscRoutesModule.bscRoutes).toBeDefined();
      expect(typeof bscRoutesModule.bscRoutes).toBe('function');
    });

    test('should have basic BSC endpoints defined', async () => {
      const tokenRoutesExist = await import('../routes/bsc/tokens.js').catch(() => null);
      const tradingRoutesExist = await import('../routes/bsc/trading.js').catch(() => null);
      const liquidityRoutesExist = await import('../routes/bsc/liquidity.js').catch(() => null);
      const portfolioRoutesExist = await import('../routes/bsc/portfolio.js').catch(() => null);

      expect(tokenRoutesExist || tradingRoutesExist || liquidityRoutesExist || portfolioRoutesExist).toBeTruthy();
    });

    test('should validate BSC config structure', () => {
      expect(BSC_CONFIG).toBeDefined();
      expect(BSC_CONFIG.BSC_CHAIN_ID).toBe(56);
      expect(BSC_CONFIG.BSC_RPC_URL).toBeDefined();
      expect(BSC_CONFIG.BSC_TESTNET_CHAIN_ID).toBe(97);
    });

    test('should initialize Viem clients for BSC', () => {
      expect(publicClient).toBeDefined();
      expect(walletClient).toBeDefined();
      expect(testAccount.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    test('should connect to BSC testnet', async () => {
      const blockNumber = await publicClient.getBlockNumber();
      expect(typeof blockNumber).toBe('bigint');
      expect(blockNumber).toBeGreaterThan(0n);

      const chainId = await publicClient.getChainId();
      expect(chainId).toBe(97); // BSC testnet
    });
  });

  describe('BSC Token Service Integration', () => {
    test('should initialize BSC token service', () => {
      expect(tokenService).toBeDefined();
      expect(tokenService).toBeInstanceOf(BSCTokenServiceViem);
    });

    test('should get BSC token information', async () => {
      const wbnbAddress = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address;
      const busdAddress = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address;

      const wbnbInfo = await tokenService.getTokenInfo(wbnbAddress);
      const busdInfo = await tokenService.getTokenInfo(busdAddress);

      expect(wbnbInfo.symbol).toBe('WBNB');
      expect(busdInfo.symbol).toBe('BUSD');
      expect(typeof wbnbInfo.decimals).toBe('number');
      expect(typeof busdInfo.decimals).toBe('number');
    });

    test('should get token balances on BSC', async () => {
      const balance = await tokenService.getBalance(
        testAccount.address,
        '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address
      );

      expect(typeof balance).toBe('bigint');
      expect(balance).toBeGreaterThanOrEqual(0n);
    });

    test('should handle BSC-specific token operations', async () => {
      const tokens = [
        '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
        '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // BUSD
        '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82'  // CAKE
      ] as Address[];

      const results = await Promise.allSettled(
        tokens.map(token => tokenService.getTokenInfo(token))
      );

      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.symbol).toBeDefined();
        }
      });
    });
  });

  describe('BSC Trading Service Integration', () => {
    test('should initialize BSC trading service', () => {
      expect(swapService).toBeDefined();
      expect(swapService).toBeInstanceOf(SwapServiceViem);
    });

    test('should get BSC swap quotes', async () => {
      const quote = await swapService.getSwapQuote({
        tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address, // WBNB
        tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address, // BUSD
        amountIn: parseEther('0.1'),
        slippageTolerancePercent: 0.5
      });

      expect(quote).toBeDefined();
      expect(quote.amountOut).toBeGreaterThan(0n);
      expect(quote.route).toBeDefined();
    });

    test('should handle BSC gas optimization', async () => {
      const gasPrice = await publicClient.getGasPrice();
      expect(typeof gasPrice).toBe('bigint');
      expect(gasPrice).toBeGreaterThan(0n);

      const networkStats = txOptimizer.getNetworkStats();
      expect(networkStats).toBeDefined();
      expect(networkStats.averageGasPrice).toBeDefined();
      expect(networkStats.congestionLevel).toBeDefined();
    });
  });

  describe('BSC Liquidity Service Integration', () => {
    test('should initialize BSC liquidity service', () => {
      expect(liquidityService).toBeDefined();
      expect(liquidityService).toBeInstanceOf(LiquidityServiceViem);
    });

    test('should get BSC pool information', async () => {
      const poolInfo = await liquidityService.getPoolInfo({
        tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address, // WBNB
        tokenB: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address  // BUSD
      });

      expect(poolInfo).toBeDefined();
      expect(poolInfo.reserve0).toBeGreaterThanOrEqual(0n);
      expect(poolInfo.reserve1).toBeGreaterThanOrEqual(0n);
    });

    test('should calculate BSC liquidity amounts', () => {
      const amounts = liquidityService.calculateLiquidityAmounts({
        amountADesired: parseEther('1'),
        amountBDesired: parseEther('100'),
        reserveA: parseEther('10'),
        reserveB: parseEther('1000')
      });

      expect(amounts.amountA).toBeDefined();
      expect(amounts.amountB).toBeDefined();
      expect(typeof amounts.amountA).toBe('bigint');
      expect(typeof amounts.amountB).toBe('bigint');
    });
  });

  describe('BSC Yield Farming Integration', () => {
    test('should initialize BSC yield farming service', () => {
      expect(yieldService).toBeDefined();
      expect(yieldService).toBeInstanceOf(YieldFarmingServiceViem);
    });

    test('should get BSC farm information', async () => {
      const farms = await yieldService.getFarms();
      expect(Array.isArray(farms)).toBe(true);
    });

    test('should calculate BSC APR', () => {
      const apr = yieldService.calculateAPR({
        rewardPerBlock: parseEther('0.1'),
        totalStaked: parseEther('1000'),
        tokenPrice: 1
      });

      expect(typeof apr).toBe('number');
      expect(apr).toBeGreaterThanOrEqual(0);
    });
  });

  describe('BSC Governance Integration', () => {
    test('should initialize BSC governance service', () => {
      expect(governanceService).toBeDefined();
      expect(governanceService).toBeInstanceOf(CakeGovernanceServiceViem);
    });

    test('should get BSC voting power', async () => {
      const votingPower = await governanceService.getVotingPower(testAccount.address);
      expect(typeof votingPower).toBe('bigint');
      expect(votingPower).toBeGreaterThanOrEqual(0n);
    });

    test('should get BSC proposals', async () => {
      const proposals = await governanceService.getProposals();
      expect(Array.isArray(proposals)).toBe(true);
    });
  });

  describe('BSC Performance Services Integration', () => {
    test('should initialize BSC performance services', () => {
      expect(realTimeUpdater).toBeDefined();
      expect(batchProcessor).toBeDefined();
      expect(txOptimizer).toBeDefined();
    });

    test('should provide BSC-specific metrics', () => {
      const realTimeMetrics = realTimeUpdater.getMetrics();
      const batchMetrics = batchProcessor.getMetrics();
      const txMetrics = txOptimizer.getMetrics();

      expect(realTimeMetrics.bscSpecific).toBeDefined();
      expect(batchMetrics.bscSpecific).toBeDefined();
      expect(txMetrics.bscSpecific).toBeDefined();
    });

    test('should handle BSC real-time updates', () => {
      const callback = jest.fn();
      const subscriptionId = realTimeUpdater.subscribe('block', callback);
      expect(typeof subscriptionId).toBe('string');

      const unsubscribed = realTimeUpdater.unsubscribe(subscriptionId);
      expect(unsubscribed).toBe(true);
    });

    test('should handle BSC batch operations', async () => {
      const operationId = await batchProcessor.submitOperation(
        'APPROVE' as any,
        {
          token: '0xed24FC36d5Ee211Ee25886D8Db84E67dA1fc0EFf' as Address,
          spender: testAccount.address,
          amount: parseEther('1')
        }
      );

      expect(typeof operationId).toBe('string');
      expect(operationId).toMatch(/^op_\d+_[a-z0-9]+$/);

      const cancelled = await batchProcessor.cancelOperation(operationId);
      expect(cancelled).toBe(true);
    });
  });

  describe('BSC Cross-Service Integration', () => {
    test('should handle complex BSC workflows', async () => {
      // Get token info
      const bnbInfo = await tokenService.getTokenInfo('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address);
      expect(bnbInfo.symbol).toBe('WBNB');

      // Get swap quote
      const swapQuote = await swapService.getSwapQuote({
        tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
        tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
        amountIn: parseEther('0.05'),
        slippageTolerancePercent: 0.5
      });

      expect(swapQuote.amountOut).toBeGreaterThan(0n);

      // Get pool info
      const poolInfo = await liquidityService.getPoolInfo({
        tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
        tokenB: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address
      });

      expect(poolInfo.reserve0).toBeGreaterThanOrEqual(0n);
    });

    test('should handle concurrent BSC operations', async () => {
      const operations = [
        tokenService.getTokenInfo('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address),
        swapService.getSwapQuote({
          tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
          tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
          amountIn: parseEther('0.1'),
          slippageTolerancePercent: 0.5
        }),
        liquidityService.getPoolInfo({
          tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
          tokenB: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address
        }),
        yieldService.getFarms()
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

  describe('BSC Error Handling Integration', () => {
    test('should handle BSC network errors gracefully', async () => {
      const invalidClient = createPublicClient({
        chain: bscTestnet,
        transport: http('http://invalid-url')
      });

      const invalidTokenService = new BSCTokenServiceViem(invalidClient);

      await expect(
        invalidTokenService.getTokenInfo('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address)
      ).rejects.toThrow();
    });

    test('should handle invalid BSC addresses', async () => {
      await expect(
        tokenService.getTokenInfo('0xinvalid' as Address)
      ).rejects.toThrow();
    });
  });

  describe('BSC Performance Integration', () => {
    test('should complete BSC operations efficiently', async () => {
      const startTime = Date.now();

      await tokenService.getTokenInfo('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address);
      await tokenService.getBalance(testAccount.address, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000);
    });

    test('should maintain BSC metrics consistency', () => {
      const batchMetrics = batchProcessor.getMetrics();
      const txMetrics = txOptimizer.getMetrics();
      const realTimeMetrics = realTimeUpdater.getMetrics();

      expect(typeof batchMetrics.totalBatches).toBe('number');
      expect(typeof txMetrics.totalTransactions).toBe('number');
      expect(typeof realTimeMetrics.totalUpdates).toBe('number');

      expect(batchMetrics.efficiency).toBeGreaterThanOrEqual(0);
      expect(batchMetrics.efficiency).toBeLessThanOrEqual(1);

      expect(txMetrics.throughput).toBeGreaterThanOrEqual(0);
      expect(realTimeMetrics.averageUpdateRate).toBeGreaterThanOrEqual(0);
    });
  });
});