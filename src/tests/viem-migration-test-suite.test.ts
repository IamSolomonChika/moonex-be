/**
 * Viem Migration Test Suite
 * Comprehensive test suite to validate Ethers.js to Viem migration
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  Address,
  Hash,
  Chain,
  Account
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';

// Import Viem-based services
import { PancakeSwapRouterViem } from '../bsc/services/trading/pancakeSwap-router-viem.js';
import { SwapServiceViem } from '../bsc/services/trading/swap-service-viem.js';
import { LiquidityServiceViem } from '../bsc/services/liquidity/liquidity-service-viem.js';
import { TokenServiceViem } from '../bsc/services/tokens/token-service-viem.js';
import { YieldFarmingServiceViem } from '../bsc/services/yield/farming-service-viem.js';
import { GovernanceServiceViem } from '../bsc/services/governance/cake-governance-viem.js';

// Mock logger to avoid console noise during tests
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('Viem Migration Test Suite', () => {
  let publicClient: any;
  let walletClient: any;
  let testAccount: Account;

  beforeAll(async () => {
    // Create test account
    testAccount = mnemonicToAccount('test test test test test test test test test test test junk');

    // Create Viem clients for BSC testnet
    publicClient = createPublicClient({
      chain: bscTestnet,
      transport: http('https://data-seed-prebsc-1-s1.binance.org:8545/')
    });

    walletClient = createWalletClient({
      chain: bscTestnet,
      transport: http('https://data-seed-prebsc-1-s1.binance.org:8545/'),
      account: testAccount
    });
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('Core Viem Integration Tests', () => {
    test('should initialize Viem clients successfully', () => {
      expect(publicClient).toBeDefined();
      expect(walletClient).toBeDefined();
      expect(testAccount.address).toBeDefined();
    });

    test('should connect to BSC testnet', async () => {
      const blockNumber = await publicClient.getBlockNumber();
      expect(typeof blockNumber).toBe('bigint');
      expect(blockNumber).toBeGreaterThan(0n);
    });

    test('should get account information', () => {
      expect(testAccount.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(testAccount.type).toBe('mnemonic');
    });
  });

  describe('Trading Service Viem Migration', () => {
    let swapService: SwapServiceViem;
    let pancakeSwapRouter: PancakeSwapRouterViem;

    beforeAll(() => {
      pancakeSwapRouter = new PancakeSwapRouterViem(publicClient, walletClient);
      swapService = new SwapServiceViem(publicClient, walletClient, pancakeSwapRouter);
    });

    test('should initialize Viem-based trading services', () => {
      expect(swapService).toBeDefined();
      expect(pancakeSwapRouter).toBeDefined();
    });

    test('should provide swap quote', async () => {
      const quote = await swapService.getSwapQuote({
        tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address, // WBNB
        tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address, // BUSD
        amountIn: parseEther('1'),
        slippageTolerancePercent: 0.5
      });

      expect(quote).toBeDefined();
      expect(quote.amountOut).toBeDefined();
      expect(quote.route).toBeDefined();
    });

    test('should handle invalid parameters gracefully', async () => {
      await expect(
        swapService.getSwapQuote({
          tokenIn: '0xinvalid' as Address,
          tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
          amountIn: parseEther('1'),
          slippageTolerancePercent: 0.5
        })
      ).rejects.toThrow();
    });
  });

  describe('Liquidity Service Viem Migration', () => {
    let liquidityService: LiquidityServiceViem;

    beforeAll(() => {
      liquidityService = new LiquidityServiceViem(publicClient, walletClient);
    });

    test('should initialize Viem-based liquidity service', () => {
      expect(liquidityService).toBeDefined();
    });

    test('should get pool information', async () => {
      const poolInfo = await liquidityService.getPoolInfo({
        tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address, // WBNB
        tokenB: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address  // BUSD
      });

      expect(poolInfo).toBeDefined();
      expect(poolInfo.reserve0).toBeDefined();
      expect(poolInfo.reserve1).toBeDefined();
    });

    test('should calculate liquidity amounts', () => {
      const amounts = liquidityService.calculateLiquidityAmounts({
        amountADesired: parseEther('1'),
        amountBDesired: parseEther('100'),
        reserveA: parseEther('10'),
        reserveB: parseEther('1000')
      });

      expect(amounts.amountA).toBeDefined();
      expect(amounts.amountB).toBeDefined();
    });
  });

  describe('Token Service Viem Migration', () => {
    let tokenService: TokenServiceViem;

    beforeAll(() => {
      tokenService = new TokenServiceViem(publicClient);
    });

    test('should initialize Viem-based token service', () => {
      expect(tokenService).toBeDefined();
    });

    test('should get token information', async () => {
      const tokenInfo = await tokenService.getTokenInfo(
        '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address // BUSD
      );

      expect(tokenInfo).toBeDefined();
      expect(tokenInfo.symbol).toBe('BUSD');
      expect(tokenInfo.decimals).toBe(18);
    });

    test('should get token balance', async () => {
      const balance = await tokenService.getBalance(
        testAccount.address,
        '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address // WBNB
      );

      expect(typeof balance).toBe('bigint');
    });

    test('should handle invalid token address', async () => {
      await expect(
        tokenService.getTokenInfo('0xinvalid' as Address)
      ).rejects.toThrow();
    });
  });

  describe('Yield Farming Service Viem Migration', () => {
    let yieldService: YieldFarmingServiceViem;

    beforeAll(() => {
      yieldService = new YieldFarmingServiceViem(publicClient, walletClient);
    });

    test('should initialize Viem-based yield service', () => {
      expect(yieldService).toBeDefined();
    });

    test('should get farm information', async () => {
      const farms = await yieldService.getFarms();
      expect(Array.isArray(farms)).toBe(true);
    });

    test('should calculate APR', () => {
      const apr = yieldService.calculateAPR({
        rewardPerBlock: parseEther('0.1'),
        totalStaked: parseEther('1000'),
        tokenPrice: 1
      });

      expect(typeof apr).toBe('number');
      expect(apr).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Governance Service Viem Migration', () => {
    let governanceService: GovernanceServiceViem;

    beforeAll(() => {
      governanceService = new GovernanceServiceViem(publicClient, walletClient);
    });

    test('should initialize Viem-based governance service', () => {
      expect(governanceService).toBeDefined();
    });

    test('should get voting power', async () => {
      const votingPower = await governanceService.getVotingPower(testAccount.address);
      expect(typeof votingPower).toBe('bigint');
      expect(votingPower).toBeGreaterThanOrEqual(0n);
    });

    test('should get proposal information', async () => {
      const proposals = await governanceService.getProposals();
      expect(Array.isArray(proposals)).toBe(true);
    });

    test('should handle delegation operations', async () => {
      // Test delegation (this would normally require actual tokens)
      const delegateAddress = testAccount.address;

      // Mock delegation check since we don't have actual CAKE tokens
      const canDelegate = await governanceService.canDelegate(testAccount.address);
      expect(typeof canDelegate).toBe('boolean');
    });
  });

  describe('Cross-Service Integration Tests', () => {
    test('should handle complex trading workflow', async () => {
      // Initialize services
      const tokenService = new TokenServiceViem(publicClient);
      const swapService = new SwapServiceViem(publicClient, walletClient);
      const liquidityService = new LiquidityServiceViem(publicClient, walletClient);

      // Get token info
      const bnbInfo = await tokenService.getTokenInfo(
        '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address
      );
      const busdInfo = await tokenService.getTokenInfo(
        '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address
      );

      expect(bnbInfo.symbol).toBe('WBNB');
      expect(busdInfo.symbol).toBe('BUSD');

      // Get swap quote
      const swapQuote = await swapService.getSwapQuote({
        tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
        tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
        amountIn: parseEther('0.1'),
        slippageTolerancePercent: 0.5
      });

      expect(swapQuote.amountOut).toBeGreaterThan(0n);

      // Get pool info
      const poolInfo = await liquidityService.getPoolInfo({
        tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
        tokenB: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address
      });

      expect(poolInfo.reserve0).toBeGreaterThanOrEqual(0n);
      expect(poolInfo.reserve1).toBeGreaterThanOrEqual(0n);
    });

    test('should handle concurrent operations', async () => {
      const tokenService = new TokenServiceViem(publicClient);

      const operations = [
        tokenService.getTokenInfo('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address),
        tokenService.getTokenInfo('0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address),
        tokenService.getBalance(testAccount.address, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address),
        tokenService.getBalance(testAccount.address, '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address)
      ];

      const results = await Promise.allSettled(operations);

      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value).toBeDefined();
        }
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async () => {
      // Create client with invalid URL
      const invalidClient = createPublicClient({
        chain: bscTestnet,
        transport: http('http://invalid-url')
      });

      const tokenService = new TokenServiceViem(invalidClient);

      await expect(
        tokenService.getTokenInfo('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address)
      ).rejects.toThrow();
    });

    test('should handle invalid addresses', async () => {
      const tokenService = new TokenServiceViem(publicClient);

      await expect(
        tokenService.getTokenInfo('0xinvalid' as Address)
      ).rejects.toThrow();

      await expect(
        tokenService.getBalance('0xinvalid' as Address, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address)
      ).rejects.toThrow();
    });

    test('should handle zero amounts', async () => {
      const swapService = new SwapServiceViem(publicClient, walletClient);

      await expect(
        swapService.getSwapQuote({
          tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
          tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
          amountIn: 0n,
          slippageTolerancePercent: 0.5
        })
      ).rejects.toThrow();
    });
  });

  describe('Performance Benchmarks', () => {
    test('should complete operations within acceptable time limits', async () => {
      const tokenService = new TokenServiceViem(publicClient);

      const startTime = Date.now();

      // Perform multiple operations
      await tokenService.getTokenInfo('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address);
      await tokenService.getBalance(testAccount.address, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    test('should handle batch operations efficiently', async () => {
      const tokenService = new TokenServiceViem(publicClient);

      const tokens = [
        '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
        '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // BUSD
        '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82'  // CAKE
      ] as Address[];

      const startTime = Date.now();

      const results = await Promise.all(
        tokens.map(token => tokenService.getTokenInfo(token))
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(3);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.symbol).toBeDefined();
        expect(result.decimals).toBeDefined();
      });
    });
  });
});