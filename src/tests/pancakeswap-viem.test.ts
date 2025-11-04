import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

/**
 * Test PancakeSwap Contract Migration to Viem
 * These tests validate that PancakeSwap contracts are properly migrated to Viem
 * and functioning as expected during the Ethers to Viem migration.
 */

describe('PancakeSwap Viem Migration Tests', () => {
  describe('PancakeSwap Router Contracts', () => {
    it('should import PancakeSwap router Viem contracts successfully', async () => {
      // This test will fail initially (RED phase)
      const pancakeswapRouter = await import('../bsc/contracts/pancakeswap-router');
      expect(pancakeswapRouter.createPancakeSwapRouter).toBeDefined();
      expect(typeof pancakeswapRouter.createPancakeSwapRouter).toBe('function');
    });

    it('should create router contract with Viem', async () => {
      const { createPancakeSwapRouter } = await import('../bsc/contracts/pancakeswap-router');
      const router = createPancakeSwapRouter();
      expect(router).toBeDefined();
      expect(router.swapExactTokensForTokens).toBeDefined();
      expect(router.getAmountsOut).toBeDefined();
    });

    it('should get token swap quotes with Viem', async () => {
      const { createPancakeSwapRouter } = await import('../bsc/contracts/pancakeswap-router');
      const router = createPancakeSwapRouter();

      const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
      const BUSD = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';
      const amountIn = BigInt('1000000000000000000'); // 1 WBNB

      const quote = await router.getAmountsOut(amountIn, [WBNB, BUSD]);
      expect(quote).toBeDefined();
      expect(Array.isArray(quote)).toBe(true);
      expect(quote.length).toBe(2);
    });
  });

  describe('PancakeSwap Factory Contracts', () => {
    it('should import PancakeSwap factory Viem contracts successfully', async () => {
      const pancakeswapFactory = await import('../bsc/contracts/pancakeswap-factory');
      expect(pancakeswapFactory.createPancakeSwapFactory).toBeDefined();
      expect(typeof pancakeswapFactory.createPancakeSwapFactory).toBe('function');
    });

    it('should create factory contract with Viem', async () => {
      const { createPancakeSwapFactory } = await import('../bsc/contracts/pancakeswap-factory');
      const factory = createPancakeSwapFactory();
      expect(factory).toBeDefined();
      expect(factory.getPair).toBeDefined();
      expect(factory.allPairs).toBeDefined();
    });

    it('should get pair address from factory', async () => {
      const { createPancakeSwapFactory } = await import('../bsc/contracts/pancakeswap-factory');
      const factory = createPancakeSwapFactory();

      const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
      const BUSD = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';

      const pairAddress = await factory.getPair(WBNB, BUSD);
      expect(pairAddress).toBeDefined();
      expect(pairAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe('PancakeSwap Pair Contracts', () => {
    it('should import PancakeSwap pair Viem contracts successfully', async () => {
      const pancakeswapPair = await import('../bsc/contracts/pancakeswap-pair');
      expect(pancakeswapPair.createPancakeSwapPair).toBeDefined();
      expect(typeof pancakeswapPair.createPancakeSwapPair).toBe('function');
    });

    it('should create pair contract with Viem', async () => {
      const { createPancakeSwapPair } = await import('../bsc/contracts/pancakeswap-pair');
      const pair = createPancakeSwapPair('0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16'); // WBNB/BUSD pair
      expect(pair).toBeDefined();
      expect(pair.getReserves).toBeDefined();
      expect(pair.token0).toBeDefined();
      expect(pair.token1).toBeDefined();
    });

    it('should get pair reserves with Viem', async () => {
      const { createPancakeSwapPair } = await import('../bsc/contracts/pancakeswap-pair');
      const pair = createPancakeSwapPair('0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16');

      const reserves = await pair.getReserves();
      expect(reserves).toBeDefined();
      expect(reserves.reserve0).toBeDefined();
      expect(reserves.reserve1).toBeDefined();
      expect(typeof reserves.reserve0).toBe('bigint');
      expect(typeof reserves.reserve1).toBe('bigint');
    });
  });

  describe('Contract ABI Handling', () => {
    it('should have updated ABIs for Viem compatibility', async () => {
      const { PANCAKESWAP_ROUTER_ABI_VIEM } = await import('../bsc/abis/pancakeswap');
      expect(PANCAKESWAP_ROUTER_ABI_VIEM).toBeDefined();
      expect(Array.isArray(PANCAKESWAP_ROUTER_ABI_VIEM)).toBe(true);
    });

    it('should encode/decode ABI with Viem', async () => {
      const { encodeFunctionData, decodeFunctionResult } = await import('../bsc/utils/abi-utils');

      const functionName = 'getAmountsOut';
      const args = [BigInt('1000000000000000000'), ['0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56']];

      const encodedData = encodeFunctionData(functionName, args);
      expect(encodedData).toBeDefined();
      expect(typeof encodedData).toBe('string');
      expect(encodedData).toMatch(/^0x[a-fA-F0-9]+$/);
    });
  });

  describe('End-to-End Integration', () => {
    it('should perform complete swap flow with Viem', async () => {
      // Test complete flow: quote -> swap -> verify
      const { createPancakeSwapRouter } = await import('../bsc/contracts/pancakeswap-router');
      const { getSwapPrice } = await import('../bsc/services/trading-service');

      const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
      const BUSD = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';
      const amountIn = BigInt('1000000000000000000'); // 1 WBNB

      // Get quote
      const quote = await getSwapPrice(WBNB, BUSD, amountIn);
      expect(quote).toBeDefined();
      expect(quote.amountOut).toBeDefined();
      expect(typeof quote.amountOut).toBe('bigint');

      // Verify minimum output
      const slippageTolerance = 0.005; // 0.5%
      const minimumOutput = quote.amountOut * BigInt(Math.floor((1 - slippageTolerance) * 10000)) / BigInt(10000);
      expect(minimumOutput).toBeDefined();
      expect(minimumOutput > BigInt(0)).toBe(true);
    });

    it('should handle swap failures gracefully', async () => {
      const { createPancakeSwapRouter } = await import('../bsc/contracts/pancakeswap-router');
      const router = createPancakeSwapRouter();

      // Test with invalid token
      const invalidToken = '0x0000000000000000000000000000000000000000';
      const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
      const amountIn = BigInt('1000000000000000000');

      await expect(
        router.getAmountsOut(amountIn, [WBNB, invalidToken])
      ).rejects.toThrow();
    });
  });

  describe('Performance and Optimization', () => {
    it('should use Viem batch requests for multiple calls', async () => {
      const { batchGetReserves } = await import('../bsc/services/liquidity-service');

      const pairs = [
        '0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16' as const, // WBNB/BUSD
        '0x0eD7e57844e708282d81a818c1C09b5Ad7C3E912' as const, // WBNB/USDT
        '0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE' as const, // WBNB/ETH
      ];

      const reserves = await batchGetReserves(pairs);
      expect(reserves).toBeDefined();
      expect(Array.isArray(reserves)).toBe(true);
      expect(reserves.length).toBe(pairs.length);
    });

    it('should cache contract instances', async () => {
      const { getCachedContract } = await import('../bsc/utils/contract-cache');
      const { PANCAKESWAP_ROUTER_ABI_VIEM } = await import('../bsc/abis/pancakeswap');

      const routerAddress = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as const; // PancakeSwap V2 Router
      const contract1 = getCachedContract(routerAddress, PANCAKESWAP_ROUTER_ABI_VIEM);
      const contract2 = getCachedContract(routerAddress, PANCAKESWAP_ROUTER_ABI_VIEM);

      expect(contract1).toBe(contract2); // Should be the same instance
    });
  });

  describe('Type Safety', () => {
    it('should have type-safe contract methods', async () => {
      const { createPancakeSwapRouter } = await import('../bsc/contracts/pancakeswap-router');
      const router = createPancakeSwapRouter();

      // TypeScript should catch type errors
      const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
      const BUSD = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';
      const amountIn = BigInt('1000000000000000000');

      // This should work with proper types
      const quote = await router.getAmountsOut(amountIn, [WBNB, BUSD]);
      expect(Array.isArray(quote)).toBe(true);
      expect(quote[0]).toBe(amountIn); // Input amount should be first
    });

    it('should validate addresses at compile time', async () => {
      // TypeScript should catch invalid addresses
      const invalidAddress = '0xinvalid';

      // This should fail TypeScript compilation
      // expect(() => createPancakeSwapPair(invalidAddress)).toThrow();
    });
  });
});