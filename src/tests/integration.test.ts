/**
 * API Integration Tests - Updated for Viem Migration
 * Tests core API functionality with Viem-based services
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { createServer } from '../index';

// Viem imports for blockchain integration testing
import { createPublicClient, http, createWalletClient, parseEther, Address } from 'viem';
import { bscTestnet } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';

// Viem-based services for integration testing
import { BSCTokenServiceViem } from '../bsc/services/tokens/token-service-viem.js';
import { SwapServiceViem } from '../bsc/services/trading/swap-service-viem.js';
import { LiquidityServiceViem } from '../bsc/services/liquidity/liquidity-service-viem.js';

describe('API Integration Tests', () => {
  let server: FastifyInstance;
  let publicClient: any;
  let walletClient: any;
  let testAccount: any;

  // Viem-based services
  let tokenService: BSCTokenServiceViem;
  let swapService: SwapServiceViem;
  let liquidityService: LiquidityServiceViem;

  beforeAll(async () => {
    // Initialize server
    server = await createServer();
    await server.listen({ port: 0 });

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

    // Initialize Viem-based services
    tokenService = new BSCTokenServiceViem(publicClient);
    swapService = new SwapServiceViem(publicClient, walletClient);
    liquidityService = new LiquidityServiceViem(publicClient, walletClient);
  });

  afterAll(async () => {
    await server.close();
  });

  test('GET / should return health status', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.statusCode).toBe(200);
    const result = JSON.parse(response.payload);
    expect(result.status).toBe('ok');
    expect(result.message).toBe('MoonEx API is running');
  });

  test('POST /api/v1/auth/email should handle email authentication request', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/email',
      payload: {
        email: 'test@example.com',
      },
    });

    expect(response.statusCode).toBe(200);
    const result = JSON.parse(response.payload);
    expect(result.success).toBeDefined();
  });

  test('GET /api/v1/auth/me should require authentication', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });

    expect(response.statusCode).toBe(401);
    const result = JSON.parse(response.payload);
    expect(result.error).toBeDefined();
  });

  test('POST /api/v1/wallets should require authentication', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/wallets',
    });

    expect(response.statusCode).toBe(401);
    const result = JSON.parse(response.payload);
    expect(result.error).toBeDefined();
  });

  test('GET /api/v1/wallets/test/balance should require authentication', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/wallets/0x1234567890123456789012345678901234567890/balance',
    });

    expect(response.statusCode).toBe(401);
    const result = JSON.parse(response.payload);
    expect(result.error).toBeDefined();
  });

  test('POST /api/v1/wallets/send should require authentication', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/wallets/send',
      payload: {
        walletAddress: '0x1234567890123456789012345678901234567890',
        to: '0x9876543210987654321098765432109876543210',
        value: '0.1',
        token: 'ETH',
      },
    });

    expect(response.statusCode).toBe(401);
    const result = JSON.parse(response.payload);
    expect(result.error).toBeDefined();
  });

  // Viem Integration Tests
  describe('Viem Service Integration', () => {
    test('should initialize Viem clients successfully', () => {
      expect(publicClient).toBeDefined();
      expect(walletClient).toBeDefined();
      expect(testAccount.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    test('should connect to BSC testnet', async () => {
      const blockNumber = await publicClient.getBlockNumber();
      expect(typeof blockNumber).toBe('bigint');
      expect(blockNumber).toBeGreaterThan(0n);
    });

    test('should initialize Viem-based services', () => {
      expect(tokenService).toBeDefined();
      expect(swapService).toBeDefined();
      expect(liquidityService).toBeDefined();
    });
  });

  describe('Viem Token Service Integration', () => {
    test('should get token information using Viem', async () => {
      const tokenInfo = await tokenService.getTokenInfo(
        '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address // BUSD on BSC testnet
      );

      expect(tokenInfo).toBeDefined();
      expect(tokenInfo.symbol).toBeDefined();
      expect(tokenInfo.decimals).toBeDefined();
      expect(typeof tokenInfo.decimals).toBe('number');
    });

    test('should get token balance using Viem', async () => {
      const balance = await tokenService.getBalance(
        testAccount.address,
        '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address // WBNB on BSC testnet
      );

      expect(typeof balance).toBe('bigint');
      expect(balance).toBeGreaterThanOrEqual(0n);
    });
  });

  describe('Viem Trading Service Integration', () => {
    test('should get swap quote using Viem', async () => {
      const quote = await swapService.getSwapQuote({
        tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address, // WBNB
        tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address, // BUSD
        amountIn: parseEther('0.1'),
        slippageTolerancePercent: 0.5
      });

      expect(quote).toBeDefined();
      expect(quote.amountOut).toBeDefined();
      expect(quote.amountOut).toBeGreaterThan(0n);
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

  describe('Viem Liquidity Service Integration', () => {
    test('should get pool information using Viem', async () => {
      const poolInfo = await liquidityService.getPoolInfo({
        tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address, // WBNB
        tokenB: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address  // BUSD
      });

      expect(poolInfo).toBeDefined();
      expect(poolInfo.reserve0).toBeDefined();
      expect(poolInfo.reserve1).toBeDefined();
      expect(typeof poolInfo.reserve0).toBe('bigint');
      expect(typeof poolInfo.reserve1).toBe('bigint');
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
      expect(typeof amounts.amountA).toBe('bigint');
      expect(typeof amounts.amountB).toBe('bigint');
    });
  });

  describe('Cross-Service Integration', () => {
    test('should handle complex workflow across multiple Viem services', async () => {
      // Get token info
      const bnbInfo = await tokenService.getTokenInfo(
        '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address
      );
      const busdInfo = await tokenService.getTokenInfo(
        '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address
      );

      expect(bnbInfo.symbol).toBeDefined();
      expect(busdInfo.symbol).toBeDefined();

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
      expect(poolInfo.reserve1).toBeGreaterThanOrEqual(0n);
    });

    test('should handle concurrent operations across services', async () => {
      const operations = [
        tokenService.getTokenInfo('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address),
        tokenService.getTokenInfo('0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address),
        tokenService.getBalance(testAccount.address, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address),
        liquidityService.getPoolInfo({
          tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
          tokenB: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address
        })
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

  describe('Error Handling Integration', () => {
    test('should handle network errors gracefully', async () => {
      // Create client with invalid URL
      const invalidClient = createPublicClient({
        chain: bscTestnet,
        transport: http('http://invalid-url')
      });

      const invalidTokenService = new BSCTokenServiceViem(invalidClient);

      await expect(
        invalidTokenService.getTokenInfo('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address)
      ).rejects.toThrow();
    });

    test('should handle invalid addresses', async () => {
      await expect(
        tokenService.getTokenInfo('0xinvalid' as Address)
      ).rejects.toThrow();

      await expect(
        tokenService.getBalance('0xinvalid' as Address, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address)
      ).rejects.toThrow();
    });
  });

  describe('Performance Integration', () => {
    test('should complete operations within acceptable time limits', async () => {
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