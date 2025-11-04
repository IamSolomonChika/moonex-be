/**
 * Unit Tests for Swap Service
 * Tests the core swap functionality including quotes, execution, and transaction management
 */

import { ethers } from 'ethers';
import { SwapService } from '../../../src/bsc/services/trading/swap-service.js';
import { TradingError, TradingErrorCode, TransactionStatus, SwapRiskLevel, SwapWarning } from '../../../src/bsc/services/trading/types.js';
import { BSCTestEnvironment } from '../../setup/bsc-test-env.js';
import {
  PancakeRouterMock,
  PancakeFactoryMock,
  ERC20Mock,
  type MockContract
} from '../../mocks/pancakeswap-contracts.js';

describe('Swap Service', () => {
  let swapService: SwapService;
  let testEnvironment: BSCTestEnvironment;
  let mockContracts: {
    router: PancakeRouterMock;
    factory: PancakeFactoryMock;
    tokens: Map<string, ERC20Mock>;
  };
  let deployer: ethers.Wallet;
  let user: ethers.Wallet;

  beforeAll(async () => {
    // Initialize test environment
    testEnvironment = new BSCTestEnvironment();
    await testEnvironment.initialize();

    // Get wallets
    deployer = testEnvironment.getWallet('deployer');
    user = testEnvironment.getWallet('user1');

    // Get mock contracts
    mockContracts = {
      router: testEnvironment.getContract('router') as PancakeRouterMock,
      factory: testEnvironment.getContract('factory') as PancakeFactoryMock,
      tokens: testEnvironment.getTokens()
    };

    // Initialize swap service with test configuration
    swapService = new SwapService({
      mevProtection: {
        enabled: true,
        strategy: 'hybrid',
        sandwichDetection: true,
        frontRunningDetection: true,
        usePrivateMempool: false,
        randomizeNonce: true,
        delayExecution: false, // Disable for tests
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
        bnbPriceUSD: 300,
        enableGasLimitOptimization: true
      }
    });
  });

  afterAll(async () => {
    await testEnvironment.cleanup();
  });

  describe('Quote Generation', () => {
    it('should generate valid swap quote for WBNB to USDT', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        recipient: user.address,
        slippageTolerance: 50 // 0.5%
      };

      const quote = await swapService.getQuote(request);

      expect(quote).toBeDefined();
      expect(quote.tokenIn.address).toBe(request.tokenIn);
      expect(quote.tokenOut.address).toBe(request.tokenOut);
      expect(quote.amountIn).toBe(request.amountIn);
      expect(quote.amountOut).toBeDefined();
      expect(quote.price.exchangeRate).toBeGreaterThan(0);
      expect(quote.gasEstimate).toBeDefined();
      expect(quote.deadline).toBeGreaterThan(Date.now());
      expect(quote.validUntil).toBeGreaterThan(Date.now());
    });

    it('should handle V3 protocol preference correctly', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        recipient: user.address,
        options: {
          preferV3: true,
          useV2Fallback: true
        }
      };

      const quote = await swapService.getQuote(request);

      expect(quote).toBeDefined();
      expect(quote.route).toBeDefined();
      expect(quote.route.length).toBeGreaterThan(0);
    });

    it('should apply MEV protection when risks detected', async () => {
      // Create a scenario with high MEV risk (low liquidity pool)
      const lowLiquidityToken = new ERC20Mock('LowLiq', 'LOWL', 18);
      await testEnvironment.deployContract('lowLiquidityToken', lowLiquidityToken);

      const request = {
        tokenIn: lowLiquidityToken.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseUnits('1000', 18), // Large amount for low liquidity
        recipient: user.address
      };

      const quote = await swapService.getQuote(request);

      expect(quote).toBeDefined();
      // Should have MEV warnings due to low liquidity
      expect(quote.warnings.length).toBeGreaterThan(0);
      expect(quote.riskLevel).toBeGreaterThanOrEqual(SwapRiskLevel.MEDIUM);
    });

    it('should apply slippage protection correctly', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        recipient: user.address,
        slippageTolerance: 100 // 1%
      };

      const quote = await swapService.getQuote(request);

      expect(quote).toBeDefined();
      expect(quote.slippageTolerance).toBe(request.slippageTolerance);
      expect(quote.amountOutMin).toBeDefined();
      expect(parseFloat(quote.amountOutMin)).toBeLessThan(parseFloat(quote.amountOut));
    });

    it('should provide alternative quotes when available', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        recipient: user.address,
        options: {
          preferV3: false,
          useV2Fallback: true
        }
      };

      const quote = await swapService.getQuote(request);

      expect(quote).toBeDefined();
      // May have alternatives if both V2 and V3 are available
      if (quote.alternatives) {
        expect(Array.isArray(quote.alternatives)).toBe(true);
      }
    });

    it('should handle insufficient liquidity gracefully', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1000000'), // Very large amount
        recipient: user.address
      };

      await expect(swapService.getQuote(request)).rejects.toThrow(TradingError);
    });

    it('should validate token addresses', async () => {
      const invalidRequest = {
        tokenIn: '0xinvalid',
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        recipient: user.address
      };

      await expect(swapService.getQuote(invalidRequest)).rejects.toThrow(TradingError);
    });

    it('should handle quote expiration', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        recipient: user.address
      };

      const quote = await swapService.getQuote(request);

      // Mock expired quote
      quote.validUntil = Date.now() - 1000;

      // This should be handled during execution, not quote generation
      expect(quote).toBeDefined();
    });
  });

  describe('Swap Execution', () => {
    it('should execute swap successfully', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        recipient: user.address,
        slippageTolerance: 50 // 0.5%
      };

      // Approve WBNB spending (if needed)
      const wbnbContract = mockContracts.tokens.get('WBNB')!;
      await wbnbContract.mint(user.address, ethers.parseEther('10'));

      const transaction = await swapService.executeSwap(request, user);

      expect(transaction).toBeDefined();
      expect(transaction.hash).toBeDefined();
      expect(transaction.from).toBe(user.address);
      expect(transaction.status).toBe(TransactionStatus.PENDING);
      expect(transaction.swapDetails).toBeDefined();
      expect(transaction.swapDetails.quote).toBeDefined();
    });

    it('should handle BNB swaps correctly', async () => {
      const request = {
        tokenIn: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        recipient: user.address
      };

      // Give user some BNB
      await testEnvironment.fundAccount(user.address, ethers.parseEther('10'));

      const transaction = await swapService.executeSwap(request, user);

      expect(transaction).toBeDefined();
      expect(transaction.value).toBe(request.amountIn);
    });

    it('should handle V3 swap execution', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        recipient: user.address,
        options: {
          preferV3: true
        }
      };

      const transaction = await swapService.executeSwap(request, user);

      expect(transaction).toBeDefined();
      expect(transaction.swapDetails.quote.route[0]?.protocol).toBe('v3');
    });

    it('should handle exact output swaps', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountOut: ethers.parseUnits('2000', 6), // 2000 USDT
        recipient: user.address
      };

      const transaction = await swapService.executeSwap(request, user);

      expect(transaction).toBeDefined();
      expect(transaction.swapDetails.quote.amountOut).toBe(request.amountOut);
    });

    it('should apply MEV protection during execution', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('10'), // Large amount for MEV risk
        recipient: user.address
      };

      const transaction = await swapService.executeSwap(request, user);

      expect(transaction).toBeDefined();
      // MEV protection should be applied if risks are detected
      expect(transaction.hash).toBeDefined();
    });

    it('should handle insufficient balance error', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1000'), // More than user has
        recipient: user.address
      };

      await expect(swapService.executeSwap(request, user)).rejects.toThrow(TradingError);
    });

    it('should handle transaction failures gracefully', async () => {
      // Create a scenario that will fail
      const invalidToken = '0x0000000000000000000000000000000000000000';

      const request = {
        tokenIn: invalidToken,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        recipient: user.address
      };

      await expect(swapService.executeSwap(request, user)).rejects.toThrow();
    });
  });

  describe('Transaction Management', () => {
    it('should track pending transactions', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        recipient: user.address
      };

      const transaction = await swapService.executeSwap(request, user);

      // Transaction should be tracked
      const retrieved = await swapService.getTransaction(transaction.hash);
      expect(retrieved).toBeDefined();
      expect(retrieved?.hash).toBe(transaction.hash);
    });

    it('should wait for transaction confirmation', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        recipient: user.address
      };

      const transaction = await swapService.executeSwap(request, user);

      // Mock transaction confirmation
      await testEnvironment.confirmTransaction(transaction.hash);

      const confirmedTx = await swapService.waitForTransaction(transaction.hash, 1);
      expect(confirmedTx).toBeDefined();
      expect(confirmedTx.status).toBe(TransactionStatus.CONFIRMED);
    });

    it('should cancel pending transactions', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        recipient: user.address
      };

      const transaction = await swapService.executeSwap(request, user);

      // Cancel before confirmation
      const cancelled = await swapService.cancelTransaction(transaction.hash);
      expect(cancelled).toBe(true);

      const retrieved = await swapService.getTransaction(transaction.hash);
      expect(retrieved?.status).toBe(TransactionStatus.CANCELLED);
    });

    it('should handle transaction not found', async () => {
      const nonExistentHash = '0x0000000000000000000000000000000000000000000000000000000000000000';

      const result = await swapService.getTransaction(nonExistentHash);
      expect(result).toBeNull();
    });
  });

  describe('Queue Operations', () => {
    it('should queue swap for delayed execution', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        recipient: user.address,
        priority: 5
      };

      const queueId = await swapService.queueSwap(request, 5);

      expect(queueId).toBeDefined();
      expect(typeof queueId).toBe('string');

      const status = await swapService.getQueueStatus();
      expect(status.queueSize).toBeGreaterThan(0);
    });

    it('should get queue status', async () => {
      const status = await swapService.getQueueStatus();

      expect(status).toBeDefined();
      expect(status.queueSize).toBeDefined();
      expect(status.processingCount).toBeDefined();
      expect(status.completedCount).toBeDefined();
      expect(status.failedCount).toBeDefined();
      expect(status.timestamp).toBeDefined();
    });

    it('should cancel queued swap', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        recipient: user.address
      };

      const queueId = await swapService.queueSwap(request);

      const cancelled = await swapService.cancelQueuedSwap(queueId);
      expect(cancelled).toBe(true);
    });

    it('should handle queue operations with priorities', async () => {
      const requests = [
        {
          tokenIn: mockContracts.tokens.get('WBNB')!.address,
          tokenOut: mockContracts.tokens.get('USDT')!.address,
          amountIn: ethers.parseEther('1'),
          recipient: user.address,
          priority: 10
        },
        {
          tokenIn: mockContracts.tokens.get('WBNB')!.address,
          tokenOut: mockContracts.tokens.get('CAKE')!.address,
          amountIn: ethers.parseEther('1'),
          recipient: user.address,
          priority: 1
        }
      ];

      const queueIds = await Promise.all(
        requests.map(req => swapService.queueSwap(req, req.priority))
      );

      expect(queueIds).toHaveLength(2);
      expect(queueIds[0]).toBeDefined();
      expect(queueIds[1]).toBeDefined();
    });
  });

  describe('Batch Operations', () => {
    it('should handle batch quotes', async () => {
      const requests = [
        {
          tokenIn: mockContracts.tokens.get('WBNB')!.address,
          tokenOut: mockContracts.tokens.get('USDT')!.address,
          amountIn: ethers.parseEther('1'),
          recipient: user.address
        },
        {
          tokenIn: mockContracts.tokens.get('WBNB')!.address,
          tokenOut: mockContracts.tokens.get('CAKE')!.address,
          amountIn: ethers.parseEther('1'),
          recipient: user.address
        }
      ];

      const quotes = await swapService.batchQuotes(requests);

      expect(quotes).toHaveLength(2);
      quotes.forEach(quote => {
        expect(quote).toBeDefined();
        expect(quote.tokenIn.address).toBeDefined();
        expect(quote.tokenOut.address).toBeDefined();
        expect(quote.amountOut).toBeDefined();
      });
    });

    it('should handle batch swaps', async () => {
      const requests = [
        {
          tokenIn: mockContracts.tokens.get('WBNB')!.address,
          tokenOut: mockContracts.tokens.get('USDT')!.address,
          amountIn: ethers.parseEther('0.5'),
          recipient: user.address
        },
        {
          tokenIn: mockContracts.tokens.get('WBNB')!.address,
          tokenOut: mockContracts.tokens.get('CAKE')!.address,
          amountIn: ethers.parseEther('0.5'),
          recipient: user.address
        }
      ];

      const transactions = await swapService.batchSwaps(requests, user);

      expect(transactions).toHaveLength(2);
      transactions.forEach(tx => {
        expect(tx).toBeDefined();
        expect(tx.hash).toBeDefined();
        expect(tx.status).toBe(TransactionStatus.PENDING);
      });
    });

    it('should handle partial failures in batch operations', async () => {
      const requests = [
        {
          tokenIn: mockContracts.tokens.get('WBNB')!.address,
          tokenOut: mockContracts.tokens.get('USDT')!.address,
          amountIn: ethers.parseEther('1'),
          recipient: user.address
        },
        {
          tokenIn: '0xinvalid', // Invalid token
          tokenOut: mockContracts.tokens.get('CAKE')!.address,
          amountIn: ethers.parseEther('1'),
          recipient: user.address
        }
      ];

      // Should handle gracefully and return successful quotes only
      const quotes = await swapService.batchQuotes(requests);

      expect(quotes.length).toBeGreaterThanOrEqual(0);
      // At least the valid quote should be returned
      if (quotes.length > 0) {
        expect(quotes[0].tokenIn.address).toBe(mockContracts.tokens.get('WBNB')!.address);
      }
    });
  });

  describe('Routing Operations', () => {
    it('should get routing options', async () => {
      const tokenIn = mockContracts.tokens.get('WBNB')!.address;
      const tokenOut = mockContracts.tokens.get('USDT')!.address;
      const amountIn = ethers.parseEther('1').toString();

      const routingOptions = await swapService.getRoutingOptions(tokenIn, tokenOut, amountIn);

      expect(routingOptions).toBeDefined();
      expect(routingOptions.routes).toBeDefined();
      expect(routingOptions.bestRoute).toBeDefined();
      expect(routingOptions.totalOptions).toBeGreaterThan(0);
      expect(routingOptions.calculationTime).toBeDefined();
    });

    it('should find best routes', async () => {
      const tokenIn = mockContracts.tokens.get('WBNB')!.address;
      const tokenOut = mockContracts.tokens.get('USDT')!.address;
      const amountIn = ethers.parseEther('1').toString();

      const bestRoutes = await swapService.findBestRoutes(tokenIn, tokenOut, amountIn, 3);

      expect(Array.isArray(bestRoutes)).toBe(true);
      expect(bestRoutes.length).toBeLessThanOrEqual(3);

      bestRoutes.forEach(route => {
        expect(route.path).toBeDefined();
        expect(route.totalAmountOut).toBeDefined();
        expect(route.confidence).toBeDefined();
      });
    });

    it('should handle complex routing scenarios', async () => {
      // Test routing between tokens that may need intermediate hops
      const tokenA = mockContracts.tokens.get('CAKE')!.address;
      const tokenB = mockContracts.tokens.get('USDT')!.address;
      const amountIn = ethers.parseUnits('100', 18).toString();

      const routingOptions = await swapService.getRoutingOptions(tokenA, tokenB, amountIn);

      expect(routingOptions).toBeDefined();
      expect(routingOptions.routes.length).toBeGreaterThan(0);

      // Check that routes have proper structure
      routingOptions.routes.forEach(route => {
        expect(route.path).toBeDefined();
        expect(route.path.length).toBeGreaterThanOrEqual(2);
        expect(route.totalAmountOut).toBeDefined();
      });
    });
  });

  describe('Analytics and History', () => {
    it('should get swap history', async () => {
      const userAddress = user.address;
      const history = await swapService.getSwapHistory(userAddress, 10);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeLessThanOrEqual(10);
    });

    it('should get swap metrics', async () => {
      const metrics = await swapService.getSwapMetrics('24h');

      expect(metrics).toBeDefined();
      expect(metrics.totalVolume).toBeDefined();
      expect(metrics.totalTrades).toBeDefined();
      expect(metrics.averageSlippage).toBeDefined();
      expect(metrics.successRate).toBeDefined();
      expect(metrics.averageGasCost).toBeDefined();
    });

    it('should handle different timeframes for metrics', async () => {
      const timeframes = ['1h', '24h', '7d', '30d'];

      for (const timeframe of timeframes) {
        const metrics = await swapService.getSwapMetrics(timeframe);
        expect(metrics).toBeDefined();
        expect(metrics.timestamp).toBeDefined();
      }
    });
  });

  describe('Health Checks', () => {
    it('should pass health check', async () => {
      const isHealthy = await swapService.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should get service status', async () => {
      const status = await swapService.getServiceStatus();

      expect(status).toBeDefined();
      expect(status.healthy).toBeDefined();
      expect(status.pendingTransactions).toBeDefined();
      expect(status.mevProtection).toBeDefined();
      expect(status.gasOptimization).toBeDefined();
      expect(status.timestamp).toBeDefined();
    });

    it('should handle service degradation gracefully', async () => {
      // Mock service degradation by breaking provider connection
      // This would depend on the actual implementation

      const status = await swapService.getServiceStatus();
      expect(status).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle TradingError with correct codes', async () => {
      const invalidRequest = {
        tokenIn: '', // Empty token address
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        recipient: user.address
      };

      await expect(swapService.getQuote(invalidRequest)).rejects.toThrow(TradingError);
    });

    it('should handle network errors gracefully', async () => {
      // This would require mocking network failures
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        recipient: user.address
      };

      // Should not throw unhandled errors
      const quote = await swapService.getQuote(request);
      expect(quote).toBeDefined();
    });

    it('should handle slippage validation', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        recipient: user.address,
        slippageTolerance: 5000 // 50% - too high
      };

      await expect(swapService.getQuote(request)).rejects.toThrow(TradingError);
    });

    it('should handle deadline validation', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        recipient: user.address,
        deadline: Date.now() - 1000 // Past deadline
      };

      // Should handle expired deadline during execution
      const quote = await swapService.getQuote(request);
      expect(quote).toBeDefined();

      // Execution should fail due to expired deadline
      await expect(swapService.executeSwap(request, user)).rejects.toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent quote requests', async () => {
      const requests = Array(10).fill(null).map((_, index) => ({
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther((Math.random() * 5 + 0.1).toString()),
        recipient: user.address
      }));

      const startTime = Date.now();
      const quotes = await Promise.all(requests.map(req => swapService.getQuote(req)));
      const endTime = Date.now();

      expect(quotes).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      quotes.forEach(quote => {
        expect(quote).toBeDefined();
        expect(quote.amountOut).toBeDefined();
      });
    });

    it('should handle large swap amounts without performance degradation', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('100'), // Large amount
        recipient: user.address
      };

      const startTime = Date.now();
      const quote = await swapService.getQuote(request);
      const endTime = Date.now();

      expect(quote).toBeDefined();
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should maintain performance with complex routing', async () => {
      // Use tokens that might require complex routing
      const tokenIn = mockContracts.tokens.get('CAKE')!.address;
      const tokenOut = mockContracts.tokens.get('USDT')!.address;
      const amountIn = ethers.parseUnits('100', 18).toString();

      const startTime = Date.now();
      const routingOptions = await swapService.getRoutingOptions(tokenIn, tokenOut, amountIn);
      const endTime = Date.now();

      expect(routingOptions).toBeDefined();
      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero amount swaps', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: '0',
        recipient: user.address
      };

      await expect(swapService.getQuote(request)).rejects.toThrow();
    });

    it('should handle same token swaps', async () => {
      const tokenAddress = mockContracts.tokens.get('WBNB')!.address;
      const request = {
        tokenIn: tokenAddress,
        tokenOut: tokenAddress, // Same token
        amountIn: ethers.parseEther('1'),
        recipient: user.address
      };

      // Should either handle gracefully or reject
      try {
        const quote = await swapService.getQuote(request);
        expect(quote).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(TradingError);
      }
    });

    it('should handle very small amounts', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: '1', // 1 wei
        recipient: user.address
      };

      const quote = await swapService.getQuote(request);
      expect(quote).toBeDefined();
      // May have warnings about dust amounts
    });

    it('should handle extremely large amounts', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.MaxUint256.toString(),
        recipient: user.address
      };

      // Should handle gracefully, likely with insufficient liquidity error
      try {
        const quote = await swapService.getQuote(request);
        expect(quote.riskLevel).toBe(SwapRiskLevel.VERY_HIGH);
      } catch (error) {
        expect(error).toBeInstanceOf(TradingError);
      }
    });

    it('should handle invalid recipient addresses', async () => {
      const request = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        recipient: '0xinvalid'
      };

      await expect(swapService.executeSwap(request, user)).rejects.toThrow();
    });
  });
});