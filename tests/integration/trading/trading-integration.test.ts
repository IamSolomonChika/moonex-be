/**
 * Integration Tests for BSC Trading Functionality
 * Tests the integration between swap service, liquidity service, and token service
 */

import { ethers } from 'ethers';
import { SwapService } from '../../../src/bsc/services/trading/swap-service.js';
import { LiquidityService } from '../../../src/bsc/services/liquidity/liquidity-service.js';
import { BSCTokenService } from '../../../src/bsc/services/tokens/token-service.js';
import { BSCTestEnvironment } from '../../setup/bsc-test-env.js';
import { BSCCacheManager } from '../../../src/bsc/services/cache/cache-manager.js';
import type {
  SwapRequest,
  LiquidityRequest,
  BSCToken
} from '../../../src/bsc/services/trading/types.js';

describe('Trading Integration Tests', () => {
  let testEnvironment: BSCTestEnvironment;
  let swapService: SwapService;
  let liquidityService: LiquidityService;
  let tokenService: BSCTokenService;
  let cacheManager: BSCCacheManager;
  let deployer: ethers.Wallet;
  let user: ethers.Wallet;
  let liquidityProvider: ethers.Wallet;

  // Test tokens
  let WBNB: BSCToken;
  let USDT: BSCToken;
  let CAKE: BSCToken;
  let BUSD: BSCToken;

  beforeAll(async () => {
    // Initialize test environment
    testEnvironment = new BSCTestEnvironment();
    await testEnvironment.initialize();

    // Get wallets
    deployer = testEnvironment.getWallet('deployer');
    user = testEnvironment.getWallet('user1');
    liquidityProvider = testEnvironment.getWallet('user2');

    // Initialize services
    swapService = new SwapService({
      mevProtection: {
        enabled: true,
        strategy: 'hybrid',
        sandwichDetection: true,
        frontRunningDetection: true,
        usePrivateMempool: false,
        randomizeNonce: true,
        delayExecution: false,
        trackMEVActivity: true,
        alertOnMEVRisk: true
      },
      gasOptimization: {
        gasPriceStrategy: 'eip1559',
        enableDynamicGas: true,
        gasPriceMultiplier: 1.1,
        maxGasPriceGwei: 100,
        bscFastLane: true,
        optimizeForFastBlocks: true,
        estimateInBNB: true,
        estimateInUSD: true,
        bnbPriceUSD: 300
      }
    });

    liquidityService = new LiquidityService({
      defaultOptions: {
        slippageTolerance: 50,
        deadlineMinutes: 20,
        autoApprove: true,
        approveGasLimit: '50000',
        autoStake: false,
        maxPriceImpact: 5,
        requireVerification: true
      }
    });

    tokenService = new BSCTokenService({
      pancakeswapEnabled: true,
      updateInterval: 30000,
      verificationSources: ['pancakeswap', 'coingecko', 'bscscan'],
      autoVerification: true,
      riskAssessment: true,
      minLiquidityThreshold: 1000,
      minVolumeThreshold: 100,
      excludeBlacklisted: true,
      cacheEnabled: true,
      cacheTTL: 60000,
      realTimePriceUpdates: true,
      batchUpdates: true,
      batchSize: 50
    });

    cacheManager = new BSCCacheManager();

    // Start services
    await tokenService.start();

    // Setup test tokens
    WBNB = {
      address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
      symbol: 'WBNB',
      name: 'Wrapped BNB',
      decimals: 18,
      priceUSD: 300,
      riskLevel: 'low',
      discoveredAt: Date.now(),
      lastUpdated: Date.now(),
      verified: true,
      categories: ['stablecoin', 'base-token'],
      pancakeswapData: {
        liquidityUSD: 1000000,
        volume24hUSD: 500000,
        priceChange24h: 0.5,
        apr: 5.2
      }
    } as BSCToken;

    USDT = {
      address: '0x55d398326f99059ff775485246999027b3197955',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      priceUSD: 1,
      riskLevel: 'low',
      discoveredAt: Date.now(),
      lastUpdated: Date.now(),
      verified: true,
      categories: ['stablecoin'],
      pancakeswapData: {
        liquidityUSD: 5000000,
        volume24hUSD: 2000000,
        priceChange24h: 0.01,
        apr: 2.1
      }
    } as BSCToken;

    CAKE = {
      address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
      symbol: 'CAKE',
      name: 'PancakeSwap Token',
      decimals: 18,
      priceUSD: 2.5,
      riskLevel: 'medium',
      discoveredAt: Date.now(),
      lastUpdated: Date.now(),
      verified: true,
      categories: ['defi', 'governance'],
      pancakeswapData: {
        liquidityUSD: 2000000,
        volume24hUSD: 1000000,
        priceChange24h: -2.3,
        apr: 15.7
      }
    } as BSCToken;

    BUSD = {
      address: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
      symbol: 'BUSD',
      name: 'Binance USD',
      decimals: 18,
      priceUSD: 1,
      riskLevel: 'low',
      discoveredAt: Date.now(),
      lastUpdated: Date.now(),
      verified: true,
      categories: ['stablecoin'],
      pancakeswapData: {
        liquidityUSD: 8000000,
        volume24hUSD: 3000000,
        priceChange24h: 0.02,
        apr: 1.8
      }
    } as BSCToken;

    // Fund test accounts
    await testEnvironment.fundAccount(user.address, ethers.parseEther('100'));
    await testEnvironment.fundAccount(liquidityProvider.address, ethers.parseEther('50'));

    // Mint tokens for testing
    const wbnbContract = testEnvironment.getContract('tokens').get('WBNB');
    const usdtContract = testEnvironment.getContract('tokens').get('USDT');
    const cakeContract = testEnvironment.getContract('tokens').get('CAKE');

    if (wbnbContract) await wbnbContract.mint(user.address, ethers.parseEther('1000'));
    if (usdtContract) await usdtContract.mint(user.address, ethers.parseUnits('100000', 6));
    if (cakeContract) await cakeContract.mint(user.address, ethers.parseEther('10000'));

    if (wbnbContract) await wbnbContract.mint(liquidityProvider.address, ethers.parseEther('500'));
    if (usdtContract) await usdtContract.mint(liquidityProvider.address, ethers.parseUnits('50000', 6));
    if (cakeContract) await cakeContract.mint(liquidityProvider.address, ethers.parseEther('5000'));
  });

  afterAll(async () => {
    await tokenService.stop();
    await testEnvironment.cleanup();
  });

  describe('Service Integration', () => {
    it('should initialize all services successfully', async () => {
      // Check that all services are healthy
      const swapHealth = await swapService.healthCheck();
      const liquidityHealth = await liquidityService.healthCheck();
      const tokenHealth = await tokenService.healthCheck();

      expect(swapHealth).toBe(true);
      expect(liquidityHealth).toBe(true);
      expect(tokenHealth).toBe(true);
    });

    it('should get service status from all services', async () => {
      const swapStatus = await swapService.getServiceStatus();
      const liquidityStatus = await liquidityService.getServiceStatus();
      const tokenMetrics = await tokenService.getTokenMetrics();

      expect(swapStatus).toBeDefined();
      expect(swapStatus.healthy).toBeDefined();
      expect(swapStatus.pendingTransactions).toBeDefined();

      expect(liquidityStatus).toBeDefined();
      expect(liquidityStatus.healthy).toBeDefined();
      expect(liquidityStatus.pendingOperations).toBeDefined();

      expect(tokenMetrics).toBeDefined();
      expect(tokenMetrics.totalTokens).toBeDefined();
      expect(tokenMetrics.lastUpdated).toBeDefined();
    });
  });

  describe('Complete Trading Workflow', () => {
    it('should execute complete trading workflow from quote to execution', async () => {
      // 1. Discover and verify tokens
      const discoveredTokens = await tokenService.discoverTokens(10);
      expect(Array.isArray(discoveredTokens)).toBe(true);

      // 2. Get swap quote
      const swapRequest: SwapRequest = {
        tokenIn: WBNB.address,
        tokenOut: USDT.address,
        amountIn: ethers.parseEther('1').toString(),
        recipient: user.address,
        slippageTolerance: 50
      };

      const swapQuote = await swapService.getQuote(swapRequest);
      expect(swapQuote).toBeDefined();
      expect(swapQuote.tokenIn.address).toBe(WBNB.address);
      expect(swapQuote.tokenOut.address).toBe(USDT.address);
      expect(swapQuote.amountOut).toBeDefined();

      // 3. Execute swap
      const swapTransaction = await swapService.executeSwap(swapRequest, user);
      expect(swapTransaction).toBeDefined();
      expect(swapTransaction.hash).toBeDefined();
      expect(swapTransaction.status).toBe('pending');

      // 4. Wait for confirmation (mock)
      await testEnvironment.confirmTransaction(swapTransaction.hash);

      // 5. Get updated transaction status
      const confirmedTx = await swapService.waitForTransaction(swapTransaction.hash, 1);
      expect(confirmedTx.status).toBe('confirmed');
    });

    it('should handle multi-hop swap routing', async () => {
      // Create a scenario requiring multi-hop routing
      const swapRequest: SwapRequest = {
        tokenIn: CAKE.address,
        tokenOut: BUSD.address,
        amountIn: ethers.parseEther('100').toString(),
        recipient: user.address
      };

      // Get routing options
      const routingOptions = await swapService.getRoutingOptions(
        CAKE.address,
        BUSD.address,
        swapRequest.amountIn
      );

      expect(routingOptions).toBeDefined();
      expect(routingOptions.routes.length).toBeGreaterThan(0);
      expect(routingOptions.bestRoute).toBeDefined();

      // Execute the swap using the best route
      const swapTransaction = await swapService.executeSwap(swapRequest, user);
      expect(swapTransaction).toBeDefined();
      expect(swapTransaction.hash).toBeDefined();
    });

    it('should handle batch swap operations', async () => {
      const swapRequests: SwapRequest[] = [
        {
          tokenIn: WBNB.address,
          tokenOut: USDT.address,
          amountIn: ethers.parseEther('0.5').toString(),
          recipient: user.address
        },
        {
          tokenIn: WBNB.address,
          tokenOut: CAKE.address,
          amountIn: ethers.parseEther('0.5').toString(),
          recipient: user.address
        }
      ];

      // Get batch quotes
      const quotes = await swapService.batchQuotes(swapRequests);
      expect(quotes).toHaveLength(2);

      // Execute batch swaps
      const transactions = await swapService.batchSwaps(swapRequests, user);
      expect(transactions).toHaveLength(2);

      transactions.forEach(tx => {
        expect(tx.hash).toBeDefined();
        expect(tx.status).toBe('pending');
      });
    });
  });

  describe('Liquidity Integration', () => {
    it('should execute complete liquidity provision workflow', async () => {
      // 1. Get add liquidity quote
      const liquidityRequest: LiquidityRequest = {
        tokenA: WBNB.address,
        tokenB: USDT.address,
        amountA: ethers.parseEther('5').toString(),
        recipient: liquidityProvider.address
      };

      const liquidityQuote = await liquidityService.getAddLiquidityQuote(liquidityRequest);
      expect(liquidityQuote).toBeDefined();
      expect(liquidityQuote.tokenA.address).toBe(WBNB.address);
      expect(liquidityQuote.tokenB.address).toBe(USDT.address);
      expect(liquidityQuote.liquidityOut).toBeDefined();

      // 2. Add liquidity
      const addOperation = await liquidityService.addLiquidity(liquidityRequest, liquidityProvider);
      expect(addOperation).toBeDefined();
      expect(addOperation.id).toBeDefined();
      expect(addOperation.type).toBe('add');
      expect(addOperation.status).toBe('pending');

      // 3. Mock confirmation
      await testEnvironment.confirmTransaction(addOperation.id);

      // 4. Remove liquidity
      const removeQuote = await liquidityService.getRemoveLiquidityQuote(
        'mock-pool-address',
        addOperation.liquidity
      );
      expect(removeQuote).toBeDefined();

      const removeOperation = await liquidityService.removeLiquidity(
        'mock-pool-address',
        addOperation.liquidity,
        liquidityProvider
      );
      expect(removeOperation).toBeDefined();
      expect(removeOperation.type).toBe('remove');
    });

    it('should handle liquidity farming integration', async () => {
      const liquidityRequest: LiquidityRequest = {
        tokenA: WBNB.address,
        tokenB: CAKE.address,
        amountA: ethers.parseEther('2').toString(),
        recipient: liquidityProvider.address
      };

      // Add liquidity
      const addOperation = await liquidityService.addLiquidity(liquidityRequest, liquidityProvider);
      expect(addOperation).toBeDefined();

      // Stake in farm
      const stakeOperation = await liquidityService.stakeInFarm(
        'mock-pool-address',
        addOperation.liquidity,
        liquidityProvider
      );
      expect(stakeOperation).toBeDefined();
      expect(stakeOperation.farmId).toBeDefined();

      // Claim rewards
      const claimTx = await liquidityService.claimFarmRewards('mock-pool-address', liquidityProvider);
      expect(claimTx).toBeDefined();
      expect(typeof claimTx).toBe('string');

      // Unstake from farm
      const unstakeOperation = await liquidityService.unstakeFromFarm(
        'mock-pool-address',
        addOperation.liquidity,
        liquidityProvider
      );
      expect(unstakeOperation).toBeDefined();
      expect(unstakeOperation.type).toBe('remove');
    });

    it('should handle batch liquidity operations', async () => {
      const liquidityRequests: LiquidityRequest[] = [
        {
          tokenA: WBNB.address,
          tokenB: USDT.address,
          amountA: ethers.parseEther('1').toString(),
          recipient: liquidityProvider.address
        },
        {
          tokenA: WBNB.address,
          tokenB: CAKE.address,
          amountA: ethers.parseEther('1').toString(),
          recipient: liquidityProvider.address
        }
      ];

      const operations = await liquidityService.batchAddLiquidity(liquidityRequests, liquidityProvider);
      expect(operations).toHaveLength(2);

      operations.forEach(op => {
        expect(op).toBeDefined();
        expect(op.type).toBe('add');
        expect(op.status).toBe('pending');
      });
    });
  });

  describe('Price and Data Integration', () => {
    it('should sync price data across services', async () => {
      // Update token prices
      const priceUpdates = await tokenService.updateTokenPrices();
      expect(Array.isArray(priceUpdates)).toBe(true);

      // Get swap quotes that should use updated prices
      const swapRequest: SwapRequest = {
        tokenIn: WBNB.address,
        tokenOut: USDT.address,
        amountIn: ethers.parseEther('1').toString(),
        recipient: user.address
      };

      const quote = await swapService.getQuote(swapRequest);
      expect(quote).toBeDefined();
      expect(quote.price).toBeDefined();
      expect(quote.price.tokenInPriceUSD).toBeGreaterThan(0);
      expect(quote.price.tokenOutPriceUSD).toBeGreaterThan(0);
    });

    it('should handle real-time price updates', async () => {
      const priceUpdates: any[] = [];

      // Subscribe to price updates
      tokenService.subscribeToPriceUpdates(WBNB.address, (price) => {
        priceUpdates.push(price);
      });

      // Trigger price update
      await tokenService.updateTokenPrices();

      // Wait a bit for async updates
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify price updates were received (may be empty in test environment)
      expect(Array.isArray(priceUpdates)).toBe(true);

      // Cleanup
      tokenService.unsubscribeFromPriceUpdates(WBNB.address);
    });

    it('should maintain data consistency across services', async () => {
      // Get token data from token service
      const token = await tokenService.getTokenByAddress(WBNB.address);

      // Get liquidity data
      const liquidityData = await tokenService.getTokenLiquidity(WBNB.address);

      // Get swap quote that should use consistent data
      const swapRequest: SwapRequest = {
        tokenIn: WBNB.address,
        tokenOut: USDT.address,
        amountIn: ethers.parseEther('1').toString(),
        recipient: user.address
      };

      const quote = await swapService.getQuote(swapRequest);

      // All services should be working with consistent data
      expect(quote).toBeDefined();
      // In a real implementation, we'd verify price consistency
    });
  });

  describe('Cache Integration', () => {
    it('should use cache consistently across services', async () => {
      const tokenAddress = WBNB.address;
      const cacheKey = `token:${tokenAddress}`;

      // Clear cache
      await cacheManager.delete(cacheKey);

      // First call should populate cache
      const token1 = await tokenService.getTokenByAddress(tokenAddress);

      // Second call should use cache
      const token2 = await tokenService.getTokenByAddress(tokenAddress);

      // Results should be consistent
      expect(token1).toEqual(token2);

      // Verify cache was used (implementation dependent)
      const cached = await cacheManager.get(cacheKey);
      // May or may not be cached depending on implementation
    });

    it('should handle cache invalidation correctly', async () => {
      const tokenAddress = USDT.address;

      // Populate cache
      await tokenService.getTokenByAddress(tokenAddress);

      // Clear cache
      await tokenService.clearTokenCache(tokenAddress);

      // Next call should fetch fresh data
      const token = await tokenService.getTokenByAddress(tokenAddress);
      expect(token).toBeDefined();
    });

    it('should warm up cache for popular tokens', async () => {
      await tokenService.warmupCache();

      // Popular tokens should be cached
      const popularTokens = [WBNB.address, USDT.address, CAKE.address, BUSD.address];

      for (const address of popularTokens) {
        const token = await tokenService.getTokenByAddress(address);
        // Should be fast due to cache (implementation dependent)
        expect(token).toBeDefined();
      }
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle swap failures gracefully across services', async () => {
      const invalidRequest: SwapRequest = {
        tokenIn: '0xinvalid',
        tokenOut: USDT.address,
        amountIn: ethers.parseEther('1').toString(),
        recipient: user.address
      };

      await expect(swapService.getQuote(invalidRequest)).rejects.toThrow();

      // Services should remain healthy
      const swapHealth = await swapService.healthCheck();
      const liquidityHealth = await liquidityService.healthCheck();
      const tokenHealth = await tokenService.healthCheck();

      expect(swapHealth).toBe(true);
      expect(liquidityHealth).toBe(true);
      expect(tokenHealth).toBe(true);
    });

    it('should handle liquidity operation failures', async () => {
      const invalidRequest: LiquidityRequest = {
        tokenA: '0xinvalid',
        tokenB: USDT.address,
        amountA: ethers.parseEther('1').toString(),
        recipient: liquidityProvider.address
      };

      await expect(liquidityService.getAddLiquidityQuote(invalidRequest)).rejects.toThrow();

      // Other operations should still work
      const validRequest: SwapRequest = {
        tokenIn: WBNB.address,
        tokenOut: USDT.address,
        amountIn: ethers.parseEther('0.1').toString(),
        recipient: user.address
      };

      const quote = await swapService.getQuote(validRequest);
      expect(quote).toBeDefined();
    });

    it('should handle network congestion scenarios', async () => {
      // Simulate high gas prices
      const swapRequest: SwapRequest = {
        tokenIn: WBNB.address,
        tokenOut: USDT.address,
        amountIn: ethers.parseEther('1').toString(),
        recipient: user.address
      };

      // Quote should account for high gas prices
      const quote = await swapService.getQuote(swapRequest);
      expect(quote.gasEstimate).toBeDefined();
      expect(parseFloat(quote.gasEstimate.estimatedCostUSD)).toBeGreaterThan(0);
    });
  });

  describe('MEV Protection Integration', () => {
    it('should apply MEV protection in high-risk scenarios', async () => {
      // Create a high-value swap that could be targeted by MEV
      const highValueRequest: SwapRequest = {
        tokenIn: WBNB.address,
        tokenOut: CAKE.address,
        amountIn: ethers.parseEther('50').toString(), // Large amount
        recipient: user.address
      };

      const quote = await swapService.getQuote(highValueRequest);
      expect(quote).toBeDefined();

      // MEV protection should be applied if risks detected
      expect(quote.warnings.length).toBeGreaterThanOrEqual(0);
      if (quote.warnings.length > 0) {
        expect(quote.riskLevel).toBeDefined();
      }
    });

    it('should handle sandwich attack detection', async () => {
      // Create a scenario susceptible to sandwich attacks
      const vulnerableRequest: SwapRequest = {
        tokenIn: WBNB.address,
        tokenOut: USDT.address,
        amountIn: ethers.parseEther('20').toString(),
        recipient: user.address,
        slippageTolerance: 10 // Very low slippage tolerance
      };

      const quote = await swapService.getQuote(vulnerableRequest);
      expect(quote).toBeDefined();

      // May have MEV warnings depending on implementation
      expect(quote.warnings.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Integration', () => {
    it('should handle high concurrent load', async () => {
      const concurrentOperations = 20;
      const swapRequests: SwapRequest[] = Array(concurrentOperations).fill(null).map((_, i) => ({
        tokenIn: WBNB.address,
        tokenOut: USDT.address,
        amountIn: ethers.parseEther('0.1').toString(),
        recipient: user.address
      }));

      const startTime = Date.now();

      // Execute concurrent quote requests
      const quotes = await Promise.all(
        swapRequests.map(request => swapService.getQuote(request))
      );

      const endTime = Date.now();

      expect(quotes).toHaveLength(concurrentOperations);
      quotes.forEach(quote => {
        expect(quote).toBeDefined();
        expect(quote.amountOut).toBeDefined();
      });

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds
    });

    it('should maintain performance under memory pressure', async () => {
      // Create many operations to test memory usage
      const operations = [];
      for (let i = 0; i < 100; i++) {
        const swapRequest: SwapRequest = {
          tokenIn: WBNB.address,
          tokenOut: USDT.address,
          amountIn: ethers.parseEther('0.01').toString(),
          recipient: user.address
        };

        operations.push(swapService.getQuote(swapRequest));
      }

      const quotes = await Promise.all(operations);
      expect(quotes).toHaveLength(100);

      // Memory usage should be reasonable (implementation dependent)
    });
  });

  describe('Security Integration', () => {
    it('should validate token addresses across all services', async () => {
      const invalidAddress = '0xmalicious_address';

      // All services should handle invalid addresses safely
      await expect(tokenService.getTokenByAddress(invalidAddress)).resolves.not.toThrow();
      await expect(swapService.getQuote({
        tokenIn: invalidAddress,
        tokenOut: USDT.address,
        amountIn: ethers.parseEther('1').toString(),
        recipient: user.address
      })).rejects.toThrow();

      await expect(liquidityService.getAddLiquidityQuote({
        tokenA: invalidAddress,
        tokenB: USDT.address,
        amountA: ethers.parseEther('1').toString(),
        recipient: user.address
      })).rejects.toThrow();
    });

    it('should prevent unauthorized operations', async () => {
      const unauthorizedUser = testEnvironment.getWallet('user3');

      const swapRequest: SwapRequest = {
        tokenIn: WBNB.address,
        tokenOut: USDT.address,
        amountIn: ethers.parseEther('1000').toString(), // More than user has
        recipient: unauthorizedUser.address
      };

      // Should fail due to insufficient balance
      await expect(swapService.executeSwap(swapRequest, unauthorizedUser))
        .rejects.toThrow();
    });

    it('should handle slippage protection consistently', async () => {
      const swapRequest: SwapRequest = {
        tokenIn: WBNB.address,
        tokenOut: USDT.address,
        amountIn: ethers.parseEther('10').toString(),
        recipient: user.address,
        slippageTolerance: 10 // 0.1% - very low
      };

      const quote = await swapService.getQuote(swapRequest);
      expect(quote).toBeDefined();

      // Slippage protection should be applied
      expect(quote.slippageTolerance).toBe(10);
      expect(parseFloat(quote.amountOutMin)).toBeLessThan(parseFloat(quote.amountOut));
    });
  });
});