import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Address, parseEther, Hex } from 'viem';
import { SwapServiceViem, swapServiceViem } from '../../bsc/services/trading/swap-service-viem';
import type { SwapRequest, SwapQuote, SwapTransaction } from '../../bsc/services/trading/swap-service-viem';

/**
 * Test Suite for Viem Swap Service
 * Tests the comprehensive swap service functionality migrated from Ethers.js to Viem
 */

describe('SwapServiceViem', () => {
  let swapService: SwapServiceViem;
  const testPrivateKey = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' as Hex;
  const testAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as Address;
  const wbnbAddress = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address;
  const busdAddress = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address;

  beforeEach(() => {
    swapService = new SwapServiceViem({
      mevProtection: {
        enabled: true,
        strategy: 'hybrid',
        delayExecution: false, // Disable for tests
      },
      gasOptimization: {
        enableDynamicGas: true,
        gasPriceMultiplier: 1.1,
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(swapService).toBeDefined();
      expect(swapServiceViem).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customService = new SwapServiceViem({
        mevProtection: {
          enabled: false,
          strategy: 'standard',
        },
        gasOptimization: {
          enableDynamicGas: false,
          gasPriceMultiplier: 1.2,
        },
      });

      expect(customService).toBeDefined();
    });
  });

  describe('Quote Generation', () => {
    const validSwapRequest: SwapRequest = {
      tokenIn: wbnbAddress,
      tokenOut: busdAddress,
      amountIn: parseEther('1').toString(),
      recipient: testAddress,
      slippageTolerance: 0.005, // 0.5%
      deadline: Math.floor(Date.now() / 1000) + 300,
    };

    it('should generate a valid swap quote', async () => {
      const quote = await swapService.getQuote(validSwapRequest);

      expect(quote).toBeDefined();
      expect(quote.amountIn).toBe(validSwapRequest.amountIn);
      expect(quote.amountOut).toBeDefined();
      expect(quote.tokenIn.address).toBe(validSwapRequest.tokenIn);
      expect(quote.tokenOut.address).toBe(validSwapRequest.tokenOut);
      expect(quote.path).toHaveLength(2);
      expect(quote.path[0]).toBe(validSwapRequest.tokenIn);
      expect(quote.path[1]).toBe(validSwapRequest.tokenOut);
      expect(quote.gasEstimate).toBeDefined();
      expect(quote.deadline).toBeGreaterThan(Date.now() / 1000);
      expect(quote.riskLevel).toBeDefined();
      expect(quote.confidence).toBeGreaterThan(0);
    });

    it('should handle exact input swaps', async () => {
      const exactInRequest: SwapRequest = {
        ...validSwapRequest,
        amountIn: parseEther('2').toString(),
      };

      const quote = await swapService.getQuote(exactInRequest);

      expect(quote.amountIn).toBe(exactInRequest.amountIn);
      expect(quote.amountOutMin).toBeDefined();
      expect(quote.amountInMax).toBeUndefined();
    });

    it('should handle exact output swaps', async () => {
      const exactOutRequest: SwapRequest = {
        ...validSwapRequest,
        amountIn: undefined,
        amountOut: parseEther('1000').toString(),
      };

      const quote = await swapService.getQuote(exactOutRequest);

      expect(quote.amountOut).toBe(exactOutRequest.amountOut);
      expect(quote.amountInMax).toBeDefined();
      expect(quote.amountOutMin).toBeDefined();
    });

    it('should calculate price impact correctly', async () => {
      const quote = await swapService.getQuote(validSwapRequest);

      expect(quote.priceImpact).toBeGreaterThanOrEqual(0);
      expect(typeof quote.priceImpact).toBe('number');
    });

    it('should assess risk level based on price impact', async () => {
      const quote = await swapService.getQuote(validSwapRequest);

      expect(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']).toContain(quote.riskLevel);
    });

    it('should apply MEV protection when enabled', async () => {
      const mevProtectedService = new SwapServiceViem({
        mevProtection: {
          enabled: true,
          delayExecution: false,
        },
      });

      const quote = await mevProtectedService.getQuote(validSwapRequest);

      expect(quote.warnings).toContain('MEV_RISK');
    });

    it('should estimate gas costs correctly', async () => {
      const quote = await swapService.getQuote(validSwapRequest);

      expect(quote.gasEstimate.gasLimit).toBeDefined();
      expect(quote.gasEstimate.gasPrice).toBeDefined();
      expect(quote.gasEstimate.estimatedCostBNB).toBeDefined();
      expect(quote.gasEstimate.estimatedCostUSD).toBeDefined();
    });

    it('should handle invalid requests', async () => {
      const invalidRequest: SwapRequest = {
        tokenIn: '0xinvalid' as Address,
        tokenOut: busdAddress,
        amountIn: parseEther('1').toString(),
        recipient: testAddress,
      };

      await expect(swapService.getQuote(invalidRequest)).rejects.toThrow();
    });

    it('should handle high slippage tolerance', async () => {
      const highSlippageRequest: SwapRequest = {
        ...validSwapRequest,
        slippageTolerance: 0.6, // 60%
      };

      await expect(swapService.getQuote(highSlippageRequest)).rejects.toThrow('Slippage tolerance too high');
    });

    it('should require either amountIn or amountOut', async () => {
      const invalidRequest: SwapRequest = {
        tokenIn: wbnbAddress,
        tokenOut: busdAddress,
        recipient: testAddress,
      };

      await expect(swapService.getQuote(invalidRequest)).rejects.toThrow('Either amountIn or amountOut must be specified');
    });
  });

  describe('Transaction Execution', () => {
    const validSwapRequest: SwapRequest = {
      tokenIn: wbnbAddress,
      tokenOut: busdAddress,
      amountIn: parseEther('1').toString(),
      recipient: testAddress,
      slippageTolerance: 0.005,
    };

    it('should execute a swap transaction', async () => {
      // Mock the transaction to avoid actual blockchain calls
      const mockBuildSwapTransaction = jest.spyOn(swapService as any, 'buildSwapTransaction');
      mockBuildSwapTransaction.mockResolvedValue({
        to: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
        data: '0x38ed17390000000000000000000000000000000000000000000000000000000000000001',
        value: parseEther('1').toString(),
        gasLimit: '200000',
        gasPrice: '5000000000',
        maxFeePerGas: '5000000000',
        maxPriorityFeePerGas: '5000000000',
      });

      // Mock public client methods
      const mockGetTransaction = jest.spyOn(swapService['publicClient'], 'getTransaction');
      const mockGetTransactionReceipt = jest.spyOn(swapService['publicClient'], 'getTransactionReceipt');

      mockGetTransaction.mockResolvedValue({
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex,
        from: testAddress,
        to: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
        input: '0x38ed17390000000000000000000000000000000000000000000000000000000000000001',
        value: parseEther('1'),
        gas: 200000n,
        gasPrice: 5000000000n,
        nonce: 1,
      });

      mockGetTransactionReceipt.mockResolvedValue({
        transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex,
        transactionIndex: 0,
        blockHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hex,
        blockNumber: 12345n,
        from: testAddress,
        to: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
        gasUsed: 180000n,
        effectiveGasPrice: 5000000000n,
        logs: [],
        status: 'success',
      });

      const transaction = await swapService.executeSwap(validSwapRequest, testPrivateKey);

      expect(transaction).toBeDefined();
      expect(transaction.from).toBe(testAddress);
      expect(transaction.to).toBe('0x10ed43c718714eb63d5aa57b78b54704e256024e');
      expect(transaction.status).toBe('PENDING');
      expect(transaction.swapDetails).toBeDefined();
    });

    it('should handle insufficient balance errors', async () => {
      // Mock a transaction that fails due to insufficient funds
      const mockBuildSwapTransaction = jest.spyOn(swapService as any, 'buildSwapTransaction');
      mockBuildSwapTransaction.mockRejectedValue(new Error('insufficient funds'));

      await expect(swapService.executeSwap(validSwapRequest, testPrivateKey))
        .rejects.toThrow('Insufficient balance for transaction');
    });

    it('should apply MEV protection delay when enabled', async () => {
      const mevDelayedService = new SwapServiceViem({
        mevProtection: {
          enabled: true,
          delayExecution: true,
        },
      });

      const mockBuildSwapTransaction = jest.spyOn(mevDelayedService as any, 'buildSwapTransaction');
      mockBuildSwapTransaction.mockRejectedValue(new Error('Transaction failed'));

      const startTime = Date.now();

      try {
        await mevDelayedService.executeSwap(validSwapRequest, testPrivateKey);
      } catch (error) {
        // Expected to fail
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should have delayed for at least 100ms
      expect(duration).toBeGreaterThan(100);
    });
  });

  describe('Transaction Management', () => {
    const mockTransactionHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    it('should get transaction details', async () => {
      // Mock blockchain responses
      const mockGetTransaction = jest.spyOn(swapService['publicClient'], 'getTransaction');
      const mockGetTransactionReceipt = jest.spyOn(swapService['publicClient'], 'getTransactionReceipt');

      mockGetTransaction.mockResolvedValue({
        hash: mockTransactionHash as Hex,
        from: testAddress,
        to: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
        input: '0x38ed17390000000000000000000000000000000000000000000000000000000000000001',
        value: parseEther('1'),
        gas: 200000n,
        gasPrice: 5000000000n,
        nonce: 1,
        type: 'legacy',
      } as any);

      mockGetTransactionReceipt.mockResolvedValue({
        transactionHash: mockTransactionHash as Hex,
        transactionIndex: 0,
        blockHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hex,
        blockNumber: 12345n,
        from: testAddress,
        to: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
        gasUsed: 180000n,
        effectiveGasPrice: 5000000000n,
        cumulativeGasUsed: 180000n,
        logs: [],
        logsBloom: '0x0',
        status: 'success',
        contractAddress: null,
        type: 'eip1559',
      } as any);

      const transaction = await swapService.getTransaction(mockTransactionHash);

      expect(transaction).toBeDefined();
      expect(transaction.hash).toBe(mockTransactionHash);
      expect(transaction.from).toBe(testAddress);
      expect(transaction.status).toBe('CONFIRMED');
    });

    it('should return null for non-existent transaction', async () => {
      const mockGetTransaction = jest.spyOn(swapService['publicClient'], 'getTransaction');
      mockGetTransaction.mockResolvedValue(null);

      const transaction = await swapService.getTransaction('0xnonexistent');

      expect(transaction).toBeNull();
    });

    it('should wait for transaction confirmation', async () => {
      const mockGetTransaction = jest.spyOn(swapService, 'getTransaction');

      // First call returns pending transaction
      mockGetTransaction.mockResolvedValueOnce({
        hash: mockTransactionHash,
        from: testAddress,
        to: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
        data: '0x38ed1739',
        value: '1000000000000000000',
        gasLimit: '200000',
        gasPrice: '5000000000',
        maxFeePerGas: '5000000000',
        maxPriorityFeePerGas: '5000000000',
        nonce: 1,
        status: 'PENDING',
        timestamp: Date.now(),
        confirmations: 0,
        actualCostBNB: '0',
        actualCostUSD: '0',
        swapDetails: {
          quote: {} as SwapQuote,
          actualAmountIn: '1000000000000000000',
          actualAmountOut: '0',
          actualSlippage: 0,
          priceImpact: 0,
          tradingFee: '0',
          executionTime: 0,
          confirmationTime: 0,
        },
      });

      // Second call returns confirmed transaction
      mockGetTransaction.mockResolvedValueOnce({
        hash: mockTransactionHash,
        from: testAddress,
        to: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
        data: '0x38ed1739',
        value: '1000000000000000000',
        gasLimit: '200000',
        gasPrice: '5000000000',
        maxFeePerGas: '5000000000',
        maxPriorityFeePerGas: '5000000000',
        nonce: 1,
        status: 'CONFIRMED',
        timestamp: Date.now(),
        confirmations: 1,
        actualCostBNB: '900000000000000000',
        actualCostUSD: '270',
        swapDetails: {
          quote: {} as SwapQuote,
          actualAmountIn: '1000000000000000000',
          actualAmountOut: '250000000000000000000',
          actualSlippage: 0.5,
          priceImpact: 1.2,
          tradingFee: '250000000000000',
          executionTime: 5000,
          confirmationTime: 5000,
        },
      });

      const transaction = await swapService.waitForTransaction(mockTransactionHash, 1);

      expect(transaction).toBeDefined();
      expect(transaction.status).toBe('CONFIRMED');
      expect(transaction.confirmations).toBe(1);
    });

    it('should cancel pending transaction', async () => {
      // Create a pending transaction
      const pendingTransaction: SwapTransaction = {
        hash: mockTransactionHash,
        from: testAddress,
        to: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
        data: '0x38ed1739',
        value: '1000000000000000000',
        gasLimit: '200000',
        gasPrice: '5000000000',
        maxFeePerGas: '5000000000',
        maxPriorityFeePerGas: '5000000000',
        nonce: 1,
        status: 'PENDING',
        timestamp: Date.now(),
        confirmations: 0,
        actualCostBNB: '0',
        actualCostUSD: '0',
        swapDetails: {
          quote: {} as SwapQuote,
          actualAmountIn: '1000000000000000000',
          actualAmountOut: '0',
          actualSlippage: 0,
          priceImpact: 0,
          tradingFee: '0',
          executionTime: 0,
          confirmationTime: 0,
        },
      };

      // Add to pending transactions
      (swapService as any).pendingTransactions.set(mockTransactionHash, pendingTransaction);

      const result = await swapService.cancelTransaction(mockTransactionHash);

      expect(result).toBe(true);

      // Verify transaction was updated
      const cancelledTransaction = (swapService as any).pendingTransactions.get(mockTransactionHash);
      expect(cancelledTransaction.status).toBe('CANCELLED');
    });

    it('should return false when cancelling non-existent transaction', async () => {
      const result = await swapService.cancelTransaction('0xnonexistent');

      expect(result).toBe(false);
    });
  });

  describe('Queue Operations', () => {
    const validSwapRequest: SwapRequest = {
      tokenIn: wbnbAddress,
      tokenOut: busdAddress,
      amountIn: parseEther('1').toString(),
      recipient: testAddress,
    };

    it('should queue a swap transaction', async () => {
      const queueId = await swapService.queueSwap(validSwapRequest, 1);

      expect(queueId).toBeDefined();
      expect(queueId).toMatch(/^queue_\d+_[a-z0-9]+$/);
    });

    it('should get queue status', async () => {
      const status = await swapService.getQueueStatus();

      expect(status).toBeDefined();
      expect(status.queueSize).toBe(0);
      expect(status.processingCount).toBe(0);
      expect(status.completedCount).toBe(0);
      expect(status.failedCount).toBe(0);
    });

    it('should cancel queued swap', async () => {
      const queueId = await swapService.queueSwap(validSwapRequest);
      const result = await swapService.cancelQueuedSwap(queueId);

      expect(result).toBe(true);
    });
  });

  describe('Batch Operations', () => {
    const validSwapRequest: SwapRequest = {
      tokenIn: wbnbAddress,
      tokenOut: busdAddress,
      amountIn: parseEther('1').toString(),
      recipient: testAddress,
    };

    it('should generate batch quotes', async () => {
      const requests = [
        { ...validSwapRequest, amountIn: parseEther('1').toString() },
        { ...validSwapRequest, amountIn: parseEther('2').toString() },
        { ...validSwapRequest, amountIn: parseEther('3').toString() },
      ];

      const quotes = await swapService.batchQuotes(requests);

      expect(quotes).toHaveLength(3);
      quotes.forEach((quote, index) => {
        expect(quote.amountIn).toBe(requests[index].amountIn);
        expect(quote.tokenIn.address).toBe(requests[index].tokenIn);
        expect(quote.tokenOut.address).toBe(requests[index].tokenOut);
      });
    });

    it('should handle partial failures in batch quotes', async () => {
      const requests = [
        validSwapRequest,
        { ...validSwapRequest, tokenIn: '0xinvalid' as Address }, // Invalid request
        validSwapRequest,
      ];

      const quotes = await swapService.batchQuotes(requests);

      // Should only return successful quotes
      expect(quotes).toHaveLength(2);
    });

    it('should execute batch swaps', async () => {
      const requests = [
        { ...validSwapRequest, amountIn: parseEther('1').toString() },
        { ...validSwapRequest, amountIn: parseEther('2').toString() },
      ];

      // Mock transaction building to avoid actual blockchain calls
      const mockBuildSwapTransaction = jest.spyOn(swapService as any, 'buildSwapTransaction');
      mockBuildSwapTransaction.mockResolvedValue({
        to: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
        data: '0x38ed1739',
        value: parseEther('1').toString(),
        gasLimit: '200000',
        gasPrice: '5000000000',
        maxFeePerGas: '5000000000',
        maxPriorityFeePerGas: '5000000000',
      });

      // Mock blockchain responses
      const mockGetTransaction = jest.spyOn(swapService['publicClient'], 'getTransaction');
      mockGetTransaction.mockResolvedValue({
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex,
        from: testAddress,
        to: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
        input: '0x38ed1739',
        value: parseEther('1'),
        gas: 200000n,
        gasPrice: 5000000000n,
        nonce: 1,
      });

      const mockGetTransactionReceipt = jest.spyOn(swapService['publicClient'], 'getTransactionReceipt');
      mockGetTransactionReceipt.mockResolvedValue({
        transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex,
        transactionIndex: 0,
        blockHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hex,
        blockNumber: 12345n,
        from: testAddress,
        to: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
        gasUsed: 180000n,
        effectiveGasPrice: 5000000000n,
        logs: [],
        status: 'success',
      });

      const transactions = await swapService.batchSwaps(requests, testPrivateKey);

      expect(transactions).toHaveLength(2);
      transactions.forEach(transaction => {
        expect(transaction.status).toBe('PENDING');
        expect(transaction.from).toBe(testAddress);
      });
    });
  });

  describe('Analytics and History', () => {
    it('should get swap history', async () => {
      const history = await swapService.getSwapHistory(testAddress, 50);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
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
  });

  describe('Routing Operations', () => {
    it('should get routing options', async () => {
      const routingOptions = await swapService.getRoutingOptions(
        wbnbAddress,
        busdAddress,
        parseEther('1').toString()
      );

      expect(routingOptions).toBeDefined();
      expect(routingOptions.totalOptions).toBeDefined();
      expect(routingOptions.bestRoute).toBeDefined();
      expect(routingOptions.calculationTime).toBeDefined();
    });

    it('should find best routes', async () => {
      const routes = await swapService.findBestRoutes(
        wbnbAddress,
        busdAddress,
        parseEther('1').toString(),
        3
      );

      expect(routes).toBeDefined();
      expect(Array.isArray(routes)).toBe(true);
    });
  });

  describe('Health and Status', () => {
    it('should perform health check', async () => {
      // Mock router info
      const mockGetRouterInfo = jest.spyOn(swapService['router'], 'getRouterInfo');
      mockGetRouterInfo.mockResolvedValue({
        factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as Address,
        WETH: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
      });

      const isHealthy = await swapService.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockGetRouterInfo).toHaveBeenCalled();
    });

    it('should get service status', async () => {
      // Mock health check
      const mockHealthCheck = jest.spyOn(swapService, 'healthCheck');
      mockHealthCheck.mockResolvedValue(true);

      const status = await swapService.getServiceStatus();

      expect(status).toBeDefined();
      expect(status.healthy).toBe(true);
      expect(status.pendingTransactions).toBeDefined();
      expect(status.mevProtection).toBeDefined();
      expect(status.gasOptimization).toBeDefined();
      expect(status.timestamp).toBeDefined();
    });

    it('should handle health check failures', async () => {
      const mockGetRouterInfo = jest.spyOn(swapService['router'], 'getRouterInfo');
      mockGetRouterInfo.mockRejectedValue(new Error('Router unavailable'));

      const isHealthy = await swapService.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network error
      const mockGetAmountsOut = jest.spyOn(swapService['router'], 'getAmountsOut');
      mockGetAmountsOut.mockRejectedValue(new Error('Network error'));

      const validSwapRequest: SwapRequest = {
        tokenIn: wbnbAddress,
        tokenOut: busdAddress,
        amountIn: parseEther('1').toString(),
        recipient: testAddress,
      };

      await expect(swapService.getQuote(validSwapRequest)).rejects.toThrow();
    });

    it('should handle insufficient liquidity', async () => {
      // Mock zero amounts returned (insufficient liquidity)
      const mockGetAmountsOut = jest.spyOn(swapService['router'], 'getAmountsOut');
      mockGetAmountsOut.mockResolvedValue([0n]);

      const validSwapRequest: SwapRequest = {
        tokenIn: wbnbAddress,
        tokenOut: busdAddress,
        amountIn: parseEther('1').toString(),
        recipient: testAddress,
      };

      const quote = await swapService.getQuote(validSwapRequest);

      expect(quote.amountOut).toBe('0');
      expect(quote.priceImpact).toBeGreaterThanOrEqual(0);
    });

    it('should handle invalid token addresses', async () => {
      const invalidSwapRequest: SwapRequest = {
        tokenIn: '0xinvalid' as Address,
        tokenOut: busdAddress,
        amountIn: parseEther('1').toString(),
        recipient: testAddress,
      };

      await expect(swapService.getQuote(invalidSwapRequest)).rejects.toThrow();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate MEV protection configuration', () => {
      const serviceWithInvalidMEV = new SwapServiceViem({
        mevProtection: {
          enabled: true,
          strategy: 'invalid' as any, // Invalid strategy
        },
      });

      expect(serviceWithInvalidMEV).toBeDefined();
      // Should fallback to default strategy
    });

    it('should validate gas optimization configuration', () => {
      const serviceWithInvalidGas = new SwapServiceViem({
        gasOptimization: {
          enableDynamicGas: true,
          gasPriceMultiplier: -1, // Invalid multiplier
        },
      });

      expect(serviceWithInvalidGas).toBeDefined();
      // Should handle invalid values gracefully
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle very large amounts', async () => {
      const largeAmountRequest: SwapRequest = {
        tokenIn: wbnbAddress,
        tokenOut: busdAddress,
        amountIn: parseEther('1000000').toString(), // 1M tokens
        recipient: testAddress,
      };

      const quote = await swapService.getQuote(largeAmountRequest);

      expect(quote).toBeDefined();
      expect(quote.amountIn).toBe(largeAmountRequest.amountIn);
    });

    it('should handle very small amounts', async () => {
      const smallAmountRequest: SwapRequest = {
        tokenIn: wbnbAddress,
        tokenOut: busdAddress,
        amountIn: '1', // 1 wei
        recipient: testAddress,
      };

      const quote = await swapService.getQuote(smallAmountRequest);

      expect(quote).toBeDefined();
      expect(quote.amountIn).toBe('1');
    });

    it('should handle zero slippage tolerance', async () => {
      const zeroSlippageRequest: SwapRequest = {
        tokenIn: wbnbAddress,
        tokenOut: busdAddress,
        amountIn: parseEther('1').toString(),
        recipient: testAddress,
        slippageTolerance: 0,
      };

      const quote = await swapService.getQuote(zeroSlippageRequest);

      expect(quote).toBeDefined();
      expect(quote.slippageTolerance).toBe(0);
    });

    it('should handle expired quotes', async () => {
      const expiredRequest: SwapRequest = {
        tokenIn: wbnbAddress,
        tokenOut: busdAddress,
        amountIn: parseEther('1').toString(),
        recipient: testAddress,
        deadline: Math.floor(Date.now() / 1000) - 1, // Expired 1 second ago
      };

      // Quote generation should still work, but execution would fail
      const quote = await swapService.getQuote(expiredRequest);

      expect(quote).toBeDefined();
      expect(quote.deadline).toBeLessThan(Date.now() / 1000);
    });
  });

  describe('Integration with Viem Components', () => {
    it('should integrate with Viem public client', async () => {
      const validSwapRequest: SwapRequest = {
        tokenIn: wbnbAddress,
        tokenOut: busdAddress,
        amountIn: parseEther('1').toString(),
        recipient: testAddress,
      };

      const quote = await swapService.getQuote(validSwapRequest);

      expect(quote).toBeDefined();
      expect(quote.blockNumber).toBeDefined();
      expect(typeof quote.blockNumber).toBe('number');
    });

    it('should integrate with Viem gas estimation', async () => {
      const validSwapRequest: SwapRequest = {
        tokenIn: wbnbAddress,
        tokenOut: busdAddress,
        amountIn: parseEther('1').toString(),
        recipient: testAddress,
      };

      const quote = await swapService.getQuote(validSwapRequest);

      expect(quote.gasEstimate).toBeDefined();
      expect(quote.gasEstimate.gasLimit).toMatch(/^\d+$/);
      expect(quote.gasEstimate.gasPrice).toMatch(/^\d+$/);
    });

    it('should integrate with Viem wallet client for transactions', async () => {
      const validSwapRequest: SwapRequest = {
        tokenIn: wbnbAddress,
        tokenOut: busdAddress,
        amountIn: parseEther('1').toString(),
        recipient: testAddress,
      };

      // Mock the buildSwapTransaction to test wallet client integration
      const mockBuildSwapTransaction = jest.spyOn(swapService as any, 'buildSwapTransaction');
      mockBuildSwapTransaction.mockResolvedValue({
        to: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
        data: '0x38ed1739',
        value: parseEther('1').toString(),
        gasLimit: '200000',
        gasPrice: '5000000000',
        maxFeePerGas: '5000000000',
        maxPriorityFeePerGas: '5000000000',
      });

      // Mock sendTransaction to avoid actual blockchain calls
      const mockSendTransaction = jest.fn().mockResolvedValue({
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex,
      });

      // Mock wallet client
      const mockCreateViemWalletClient = jest.fn().mockReturnValue({
        account: { address: testAddress },
        sendTransaction: mockSendTransaction,
      });

      // Replace the wallet client creation method
      (swapService as any).createViemWalletClient = mockCreateViemWalletClient;

      const transaction = await swapService.executeSwap(validSwapRequest, testPrivateKey);

      expect(transaction).toBeDefined();
      expect(transaction.hash).toBe('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      expect(mockCreateViemWalletClient).toHaveBeenCalledWith(testPrivateKey);
      expect(mockSendTransaction).toHaveBeenCalled();
    });
  });
});