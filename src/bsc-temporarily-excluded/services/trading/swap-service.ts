/**
 * BSC Swap Service
 * Handles token swap execution with optimal routing on PancakeSwap
 */

import { ethers } from 'ethers';
import logger from '../../../utils/logger.js';
import type {
  SwapQuote,
  SwapTransaction,
  SwapRequest,
  SwapOptions,
  SwapRoute,
  TransactionStatus,
  SwapExecutionDetails,
  SwapRiskLevel,
  SwapWarning,
  TradingError,
  TradingErrorCode,
  MEVProtection,
  GasOptimization,
  V3QuoteRequest
} from './types.js';
import { IAMMIntegration } from './amm-integration.js';
import { PancakeSwapAMMIntegration } from './amm-integration.js';
import { BSCProviderManager } from '../../utils/ethers-provider.js';
import { BSCCacheManager } from '../cache/cache-manager.js';
import { BSCEventMonitor } from '../event-monitoring.js';
import { MEVProtectionService, mevProtectionService } from './mev-protection.js';
import { SlippageProtectionService, slippageProtectionService } from './slippage-protection.js';
import { BSCGasOptimizationService, bscGasOptimizationService } from './gas-optimization.js';
import { TransactionQueueService, transactionQueueService } from './transaction-queue.js';
import { RoutingService, routingService, type RouteCalculationResult, type CalculatedRoute } from './routing-service.js';

/**
 * Swap Service Interface
 */
export interface ISwapService {
  // Quote and execution
  getQuote(request: SwapRequest): Promise<SwapQuote>;
  executeSwap(request: SwapRequest, signer: ethers.Signer): Promise<SwapTransaction>;

  // Transaction management
  getTransaction(hash: string): Promise<SwapTransaction | null>;
  waitForTransaction(hash: string, confirmations?: number): Promise<SwapTransaction>;
  cancelTransaction(hash: string): Promise<boolean>;

  // Queue operations
  queueSwap(request: SwapRequest, priority?: number): Promise<string>;
  getQueueStatus(): Promise<any>;
  cancelQueuedSwap(itemId: string): Promise<boolean>;

  // Batch operations
  batchQuotes(requests: SwapRequest[]): Promise<SwapQuote[]>;
  batchSwaps(requests: SwapRequest[], signer: ethers.Signer): Promise<SwapTransaction[]>;

  // Analytics
  getSwapHistory(userAddress: string, limit?: number): Promise<SwapTransaction[]>;
  getSwapMetrics(timeframe?: string): Promise<any>;

  // Routing operations
  getRoutingOptions(tokenIn: string, tokenOut: string, amountIn: string): Promise<RouteCalculationResult>;
  findBestRoutes(tokenIn: string, tokenOut: string, amountIn: string, maxRoutes?: number): Promise<CalculatedRoute[]>;

  // Health and status
  healthCheck(): Promise<boolean>;
  getServiceStatus(): Promise<any>;
}

/**
 * Swap Service Implementation
 */
export class SwapService implements ISwapService {
  private ammIntegration: IAMMIntegration;
  private provider: BSCProviderManager;
  private cache: BSCCacheManager;
  private eventMonitor: BSCEventMonitor;
  private mevProtectionService: MEVProtectionService;
  private slippageProtectionService: SlippageProtectionService;
  private gasOptimizationService: BSCGasOptimizationService;
  private transactionQueueService: TransactionQueueService;
  private routingService: RoutingService;

  // Configuration
  private mevProtection: MEVProtection;
  private gasOptimization: GasOptimization;

  // Transaction tracking
  private pendingTransactions: Map<string, SwapTransaction> = new Map();
  private transactionCallbacks: Map<string, Set<(tx: SwapTransaction) => void>> = new Map();

  constructor(config?: {
    mevProtection?: Partial<MEVProtection>;
    gasOptimization?: Partial<GasOptimization>;
  }) {
    this.ammIntegration = new PancakeSwapAMMIntegration();
    this.provider = new BSCProviderManager();
    this.cache = new BSCCacheManager();
    this.eventMonitor = new BSCEventMonitor();
    this.mevProtectionService = new MEVProtectionService(config?.mevProtection);
    this.slippageProtectionService = new SlippageProtectionService();
    this.gasOptimizationService = new BSCGasOptimizationService();
    this.transactionQueueService = new TransactionQueueService();
    this.routingService = new RoutingService();

    // MEV Protection configuration
    this.mevProtection = {
      enabled: true,
      strategy: 'hybrid',
      sandwichDetection: true,
      frontRunningDetection: true,
      usePrivateMempool: false,
      randomizeNonce: true,
      delayExecution: false,
      trackMEVActivity: true,
      alertOnMEVRisk: true,
      ...config?.mevProtection
    };

    // Gas optimization configuration
    this.gasOptimization = {
      gasPriceStrategy: 'eip1559',
      enableDynamicGas: true,
      gasPriceMultiplier: 1.1,
      maxGasPriceGwei: 100,
      bscFastLane: true,
      optimizeForFastBlocks: true,
      estimateInBNB: true,
      estimateInUSD: true,
      bnbPriceUSD: 300, // Would fetch from price oracle
      enableGasLimitOptimization: true,
      historicGasData: new Map(),
      ...config?.gasOptimization
    };
  }

  /**
   * Get swap quote (V2 and V3 support)
   */
  async getQuote(request: SwapRequest): Promise<SwapQuote> {
    logger.debug({ request }, 'Getting swap quote');

    try {
      // Validate request
      this.validateSwapRequest(request);

      // Build quote request with V3 options
      const quoteRequest: V3QuoteRequest = {
        tokenIn: request.tokenIn,
        tokenOut: request.tokenOut,
        amountIn: request.amountIn,
        amountOut: request.amountOut,
        options: {
          ...request.options,
          preferV3: request.options?.preferV3 ?? false,
          useV2Fallback: request.options?.useV2Fallback ?? true
        }
      };

      // Get AMM quote with V2/V3 comparison
      const ammResponse = await this.ammIntegration.getQuote(quoteRequest);

      if (!ammResponse.isValid) {
        throw new TradingError(
          TradingErrorCode.INSUFFICIENT_LIQUIDITY,
          'Unable to generate valid quote',
          { warnings: ammResponse.warnings }
        );
      }

      let quote = ammResponse.quote;

      // Add alternative quotes if available
      if (ammResponse.alternatives && ammResponse.alternatives.length > 0) {
        quote.alternatives = ammResponse.alternatives;
      }

      // Apply comprehensive protection
      if (this.mevProtection.enabled) {
        // Analyze MEV risk
        const mevRiskAnalysis = await this.mevProtectionService.analyzeMEVRisk(quote);

        // Apply MEV protection if needed
        if (mevRiskAnalysis.hasRisk) {
          quote = await this.mevProtectionService.applyMEVProtection(quote);

          // Log MEV risk
          logger.warn({
            tokenIn: request.tokenIn,
            tokenOut: request.tokenOut,
            riskLevel: mevRiskAnalysis.riskLevel,
            risks: mevRiskAnalysis.risks
          }, 'MEV risk detected and protection applied');
        }

        // Monitor for MEV attacks after execution
        // This will be called when transaction is executed
      }

      // Apply slippage protection
      quote = await this.slippageProtectionService.applySlippageProtection(quote);

      // Optimize gas using BSC-specific gas optimization
      const gasEstimation = await this.gasOptimizationService.estimateGasForSwap(quote);
      quote.gasEstimate = {
        gasLimit: gasEstimation.gasLimit,
        gasPrice: gasEstimation.gasPrice,
        maxFeePerGas: gasEstimation.maxFeePerGas,
        maxPriorityFeePerGas: gasEstimation.maxPriorityFeePerGas,
        estimatedCostBNB: gasEstimation.estimatedCostBNB,
        estimatedCostUSD: gasEstimation.estimatedCostUSD,
        ...quote.gasEstimate // Preserve other existing fields
      };

      // Validate final quote
      this.validateFinalQuote(quote);

      // Log protocol selection
      const selectedProtocol = quote.route[0]?.protocol || 'unknown';

      logger.info({
        tokenIn: request.tokenIn,
        tokenOut: request.tokenOut,
        amountIn: request.amountIn,
        amountOut: request.amountOut,
        exchangeRate: quote.price.exchangeRate,
        protocol: selectedProtocol,
        alternativesAvailable: ammResponse.alternatives?.length || 0
      }, 'Swap quote generated successfully');

      return quote;

    } catch (error) {
      logger.error({
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get swap quote');
      throw error;
    }
  }

  /**
   * Execute swap transaction
   */
  async executeSwap(request: SwapRequest, signer: ethers.Signer): Promise<SwapTransaction> {
    logger.debug({ request }, 'Executing swap transaction');

    try {
      // Get quote
      const quote = await this.getQuote(request);

      // Build transaction
      const transaction = await this.buildSwapTransaction(quote, request);

      // Check MEV protection
      if (this.mevProtection.enabled && this.mevProtection.delayExecution) {
        await this.delayForMEVProtection();
      }

      // Sign and send transaction
      const txResponse = await signer.sendTransaction({
        to: transaction.to,
        data: transaction.data,
        value: transaction.value,
        gasLimit: transaction.gasLimit,
        maxFeePerGas: transaction.maxFeePerGas,
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
        nonce: transaction.nonce
      });

      // Create transaction record
      const swapTransaction: SwapTransaction = {
        hash: txResponse.hash,
        from: await signer.getAddress(),
        to: transaction.to,
        data: transaction.data,
        value: transaction.value,
        gasLimit: transaction.gasLimit,
        gasPrice: transaction.gasPrice,
        maxFeePerGas: transaction.maxFeePerGas,
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
        nonce: transaction.nonce,
        status: TransactionStatus.PENDING,
        timestamp: Date.now(),
        confirmations: 0,
        swapDetails: {
          quote,
          actualAmountIn: request.amountIn || quote.amountIn,
          actualAmountOut: '0', // Will be updated after confirmation
          actualSlippage: 0,
          priceImpact: quote.priceImpact,
          tradingFee: quote.tradingFee,
          executionTime: 0,
          confirmationTime: 0
        }
      };

      // Track transaction
      this.pendingTransactions.set(txResponse.hash, swapTransaction);

      // Start monitoring
      this.monitorTransaction(txResponse.hash);

      // Start MEV monitoring if enabled
      if (this.mevProtection.enabled) {
        this.mevProtectionService.monitorTransaction(txResponse.hash);
      }

      // Start slippage monitoring
      this.slippageProtectionService.monitorSlippage(txResponse.hash);

      logger.info({
        hash: txResponse.hash,
        from: swapTransaction.from,
        tokenIn: request.tokenIn,
        tokenOut: request.tokenOut,
        amountIn: request.amountIn,
        protectionEnabled: this.mevProtection.enabled
      }, 'Swap transaction submitted with protection');

      return swapTransaction;

    } catch (error) {
      logger.error({
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to execute swap');

      if (error instanceof Error && error.message.includes('insufficient funds')) {
        throw new TradingError(
          TradingErrorCode.INSUFFICIENT_BALANCE,
          'Insufficient balance for transaction',
          { originalError: error.message }
        );
      }

      throw error;
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(hash: string): Promise<SwapTransaction | null> {
    try {
      // Check pending transactions first
      const pending = this.pendingTransactions.get(hash);
      if (pending) {
        return pending;
      }

      // Check cache
      const cacheKey = `transaction:${hash}`;
      const cached = await this.cache.get<SwapTransaction>(cacheKey);
      if (cached) {
        return cached;
      }

      // Fetch from blockchain
      const provider = await this.provider.getProvider();
      const tx = await provider.getTransaction(hash);
      const receipt = await provider.getTransactionReceipt(hash);

      if (!tx) {
        return null;
      }

      const swapTransaction: SwapTransaction = {
        hash,
        from: tx.from || '',
        to: tx.to || '',
        data: tx.data || '',
        value: tx.value?.toString() || '0',
        gasLimit: tx.gasLimit?.toString() || '0',
        gasPrice: tx.gasPrice?.toString() || '0',
        maxFeePerGas: tx.maxFeePerGas?.toString() || '0',
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString() || '0',
        nonce: tx.nonce || 0,
        blockNumber: receipt?.blockNumber ? Number(receipt.blockNumber) : undefined,
        blockHash: receipt?.blockHash,
        transactionIndex: receipt?.index,
        status: receipt?.status === 1 ? TransactionStatus.CONFIRMED : TransactionStatus.FAILED,
        gasUsed: receipt?.gasUsed?.toString(),
        effectiveGasPrice: receipt?.effectiveGasPrice?.toString(),
        actualCostBNB: receipt?.gasUsed && tx.gasPrice
          ? (BigInt(receipt.gasUsed) * BigInt(tx.gasPrice)).toString()
          : '0',
        actualCostUSD: '0', // Would calculate
        timestamp: tx.timestamp ? Number(tx.timestamp) * 1000 : Date.now(),
        confirmations: 0,
        swapDetails: {
          quote: {} as SwapQuote,
          actualAmountIn: '0',
          actualAmountOut: '0',
          actualSlippage: 0,
          priceImpact: 0,
          tradingFee: '0',
          executionTime: 0,
          confirmationTime: 0
        }
      };

      // Cache for 1 hour
      await this.cache.set(cacheKey, swapTransaction, 3600000);

      return swapTransaction;

    } catch (error) {
      logger.error({
        hash,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get transaction');
      return null;
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(hash: string, confirmations: number = 1): Promise<SwapTransaction> {
    logger.debug({ hash, confirmations }, 'Waiting for transaction confirmation');

    return new Promise((resolve, reject) => {
      const checkTransaction = async () => {
        try {
          const tx = await this.getTransaction(hash);
          if (!tx) {
            reject(new Error('Transaction not found'));
            return;
          }

          if (tx.status === TransactionStatus.FAILED) {
            reject(new Error('Transaction failed'));
            return;
          }

          if (tx.confirmations >= confirmations) {
            resolve(tx);
            return;
          }

          // Check again in 2 seconds
          setTimeout(checkTransaction, 2000);

        } catch (error) {
          reject(error);
        }
      };

      checkTransaction();
    });
  }

  /**
   * Cancel transaction
   */
  async cancelTransaction(hash: string): Promise<boolean> {
    logger.debug({ hash }, 'Cancelling transaction');

    try {
      const tx = this.pendingTransactions.get(hash);
      if (!tx) {
        return false;
      }

      // Remove from pending
      this.pendingTransactions.delete(hash);

      // Update status
      tx.status = TransactionStatus.CANCELLED;

      // Notify callbacks
      const callbacks = this.transactionCallbacks.get(hash);
      if (callbacks) {
        callbacks.forEach(callback => callback(tx));
      }

      return true;

    } catch (error) {
      logger.error({
        hash,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to cancel transaction');
      return false;
    }
  }

  /**
   * Queue a swap for delayed execution
   */
  async queueSwap(request: SwapRequest, priority: number = 0): Promise<string> {
    logger.debug({ request, priority }, 'Queuing swap transaction');

    try {
      // Get quote first
      const quote = await this.getQuote(request);

      // Create queue item
      const queueId = await this.transactionQueueService.enqueue({
        id: '', // Will be generated by queue service
        type: 'swap',
        priority,
        request,
        quote,
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        attempts: 0,
        maxAttempts: 3,
        nextRetryAt: undefined,
        lastError: undefined,
        errorHistory: []
      });

      logger.info({
        queueId,
        tokenIn: request.tokenIn,
        tokenOut: request.tokenOut,
        amountIn: request.amountIn,
        priority
      }, 'Swap queued successfully');

      return queueId;

    } catch (error) {
      logger.error({
        request,
        priority,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to queue swap');
      throw error;
    }
  }

  /**
   * Get transaction queue status
   */
  async getQueueStatus(): Promise<any> {
    logger.debug('Getting transaction queue status');

    try {
      const status = await this.transactionQueueService.getQueueStatus();

      return {
        queueSize: status.queueSize,
        processingCount: status.processingCount,
        completedCount: status.completedCount,
        failedCount: status.failedCount,
        averageWaitTime: status.averageWaitTime,
        oldestItem: status.oldestItem,
        newestItem: status.newestItem,
        processingItems: status.processingItems,
        failedItems: status.failedItems,
        nextRetryAt: status.nextRetryAt,
        timestamp: Date.now()
      };

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get queue status');
      throw error;
    }
  }

  /**
   * Cancel a queued swap
   */
  async cancelQueuedSwap(itemId: string): Promise<boolean> {
    logger.debug({ itemId }, 'Cancelling queued swap');

    try {
      const success = await this.transactionQueueService.cancel(itemId);

      if (success) {
        logger.info({ itemId }, 'Queued swap cancelled successfully');
      } else {
        logger.warn({ itemId }, 'Queued swap not found or already processed');
      }

      return success;

    } catch (error) {
      logger.error({
        itemId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to cancel queued swap');
      return false;
    }
  }

  /**
   * Batch quote requests
   */
  async batchQuotes(requests: SwapRequest[]): Promise<SwapQuote[]> {
    logger.debug({ count: requests.length }, 'Getting batch quotes');

    try {
      const quotes = await Promise.allSettled(
        requests.map(request => this.getQuote(request))
      );

      return quotes
        .filter((result): result is PromiseFulfilledResult<SwapQuote> => result.status === 'fulfilled')
        .map(result => result.value);

    } catch (error) {
      logger.error({
        count: requests.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get batch quotes');
      throw error;
    }
  }

  /**
   * Batch swap executions
   */
  async batchSwaps(requests: SwapRequest[], signer: ethers.Signer): Promise<SwapTransaction[]> {
    logger.debug({ count: requests.length }, 'Executing batch swaps');

    try {
      const transactions = await Promise.allSettled(
        requests.map(request => this.executeSwap(request, signer))
      );

      return transactions
        .filter((result): result is PromiseFulfilledResult<SwapTransaction> => result.status === 'fulfilled')
        .map(result => result.value);

    } catch (error) {
      logger.error({
        count: requests.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to execute batch swaps');
      throw error;
    }
  }

  /**
   * Get swap history
   */
  async getSwapHistory(userAddress: string, limit: number = 100): Promise<SwapTransaction[]> {
    logger.debug({ userAddress, limit }, 'Getting swap history');

    try {
      // This would query database or blockchain for user's swap history
      // For now, return empty array as placeholder
      return [];

    } catch (error) {
      logger.error({
        userAddress,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get swap history');
      return [];
    }
  }

  /**
   * Get swap metrics
   */
  async getSwapMetrics(timeframe?: string): Promise<any> {
    logger.debug({ timeframe }, 'Getting swap metrics');

    try {
      // This would return analytics data
      // For now, return placeholder data
      return {
        totalVolume: '0',
        totalTrades: 0,
        averageSlippage: 0,
        successRate: 100,
        averageGasCost: '0'
      };

    } catch (error) {
      logger.error({
        timeframe,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get swap metrics');
      throw error;
    }
  }

  /**
   * Get routing options for token pair
   */
  async getRoutingOptions(tokenIn: string, tokenOut: string, amountIn: string): Promise<RouteCalculationResult> {
    logger.debug({ tokenIn, tokenOut, amountIn }, 'Getting routing options');

    try {
      // Use routing service to calculate best routes
      const routingResult = await this.routingService.calculateRoute(tokenIn, tokenOut, amountIn);

      // Convert routing result to swap quotes
      const routesWithQuotes: SwapQuote[] = [];

      for (const route of routingResult.routes) {
        const quote = await this.convertRouteToQuote(route, tokenIn, tokenOut, amountIn);
        routesWithQuotes.push(quote);
      }

      // Update best route with the best quote
      const bestQuote = await this.convertRouteToQuote(routingResult.bestRoute, tokenIn, tokenOut, amountIn);

      logger.info({
        tokenIn,
        tokenOut,
        amountIn,
        totalOptions: routingResult.totalOptions,
        bestRoute: {
          hops: routingResult.bestRoute.path.length,
          amountOut: routingResult.bestRoute.totalAmountOut,
          confidence: routingResult.bestRoute.confidence
        },
        calculationTime: routingResult.calculationTime
      }, 'Routing options calculated successfully');

      return {
        ...routingResult,
        routes: routesWithQuotes
      };

    } catch (error) {
      logger.error({
        tokenIn,
        tokenOut,
        amountIn,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get routing options');
      throw error;
    }
  }

  /**
   * Find best routes for token pair
   */
  async findBestRoutes(tokenIn: string, tokenOut: string, amountIn: string, maxRoutes: number = 5): Promise<CalculatedRoute[]> {
    logger.debug({ tokenIn, tokenOut, amountIn, maxRoutes }, 'Finding best routes');

    try {
      const routes = await this.routingService.findBestRoutes(tokenIn, tokenOut, amountIn, maxRoutes);

      logger.info({
        tokenIn,
        tokenOut,
        amountIn,
        routesFound: routes.length,
        maxRoutes
      }, 'Best routes found successfully');

      return routes;

    } catch (error) {
      logger.error({
        tokenIn,
        tokenOut,
        amountIn,
        maxRoutes,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to find best routes');
      return [];
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const ammHealth = await this.ammIntegration.healthCheck();
      const providerHealth = await this.provider.healthCheck();

      return ammHealth && providerHealth;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Swap service health check failed');
      return false;
    }
  }

  /**
   * Get service status
   */
  async getServiceStatus(): Promise<any> {
    try {
      return {
        healthy: await this.healthCheck(),
        pendingTransactions: this.pendingTransactions.size,
        mevProtection: this.mevProtection.enabled,
        gasOptimization: this.gasOptimization.enableDynamicGas,
        ammIntegration: await this.ammIntegration.getRouterInfo(),
        timestamp: Date.now()
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get service status');
      throw error;
    }
  }

  // Private helper methods

  private validateSwapRequest(request: SwapRequest): void {
    if (!request.tokenIn || !request.tokenOut) {
      throw new TradingError(
        TradingErrorCode.INVALID_TOKEN,
        'Token addresses are required'
      );
    }

    if (!request.amountIn && !request.amountOut) {
      throw new TradingError(
        TradingErrorCode.INVALID_TOKEN,
        'Either amountIn or amountOut must be specified'
      );
    }

    if (request.slippageTolerance && request.slippageTolerance > 5000) { // 50%
      throw new TradingError(
        TradingErrorCode.SLIPPAGE_TOO_HIGH,
        'Slippage tolerance too high'
      );
    }
  }

  private async checkMEVRisk(quote: SwapQuote): Promise<{ hasRisk: boolean; risk: SwapWarning[] }> {
    const risks: SwapWarning[] = [];
    let hasRisk = false;

    // Check for low liquidity
    if (quote.riskLevel === SwapRiskLevel.HIGH || quote.riskLevel === SwapRiskLevel.VERY_HIGH) {
      risks.push(SwapWarning.LOW_LIQUIDITY);
      hasRisk = true;
    }

    // Check for high price impact
    if (quote.priceImpact > 5) {
      risks.push(SwapWarning.HIGH_PRICE_IMPACT);
      hasRisk = true;
    }

    // Check for sandwich attack risk
    if (quote.pools.some(pool => parseFloat(pool.liquidity) < 10000)) {
      risks.push(SwapWarning.MEV_RISK);
      hasRisk = true;
    }

    return { hasRisk, risk: risks };
  }

  private async applyMEVProtection(quote: SwapQuote): Promise<SwapQuote> {
    // Increase slippage tolerance for MEV protection
    const protectedQuote = { ...quote };
    protectedQuote.slippageTolerance = Math.min(quote.slippageTolerance * 1.5, 200); // Max 2%

    // Add MEV warning
    if (!protectedQuote.warnings.includes(SwapWarning.MEV_RISK)) {
      protectedQuote.warnings.push(SwapWarning.MEV_RISK);
    }

    // Increase risk level
    if (protectedQuote.riskLevel === SwapRiskLevel.LOW) {
      protectedQuote.riskLevel = SwapRiskLevel.MEDIUM;
    }

    return protectedQuote;
  }

  
  private validateFinalQuote(quote: SwapQuote): void {
    // Check if quote has expired
    if (Date.now() > quote.validUntil) {
      throw new TradingError(
        TradingErrorCode.DEADLINE_EXPIRED,
        'Quote has expired'
      );
    }

    // Check if deadline is too far in the future
    const maxDeadline = Date.now() + (60 * 60 * 1000); // 1 hour
    if (quote.deadline > maxDeadline) {
      throw new TradingError(
        TradingErrorCode.DEADLINE_EXPIRED,
        'Deadline too far in the future'
      );
    }
  }

  private async buildSwapTransaction(quote: SwapQuote, request: SwapRequest): Promise<any> {
    const protocol = quote.route[0]?.protocol || 'v2';
    const wbnbAddress = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';

    // Get router address based on protocol
    let routerAddress: string;
    if (protocol === 'v3') {
      routerAddress = '0x1b81D678ffb9C0263b24A97847620C99d213eB14'; // PancakeSwap Router V3
    } else {
      routerAddress = '0x10ed43c718714eb63d5aa57b78b54704e256024e'; // PancakeSwap Router V2
    }

    let data: string;
    let value: string;

    if (protocol === 'v3') {
      // V3 swap implementation
      const fee = quote.route[0].fee;

      if (request.amountIn) {
        // exactInputSingle for V3
        const iface = new ethers.Interface([
          'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
        ]);

        data = iface.encodeFunctionData('exactInputSingle', [
          request.tokenIn,
          request.tokenOut,
          fee,
          request.recipient,
          quote.deadline,
          request.amountIn,
          quote.amountOutMin,
          0 // sqrtPriceLimitX96 (0 for no limit)
        ]);

        value = request.tokenIn === wbnbAddress ? request.amountIn : '0';
      } else {
        // exactOutputSingle for V3
        const iface = new ethers.Interface([
          'function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountIn)'
        ]);

        data = iface.encodeFunctionData('exactOutputSingle', [
          request.tokenIn,
          request.tokenOut,
          fee,
          request.recipient,
          quote.deadline,
          request.amountOut!,
          quote.amountInMax,
          0 // sqrtPriceLimitX96 (0 for no limit)
        ]);

        value = request.tokenIn === wbnbAddress ? quote.amountInMax : '0';
      }
    } else {
      // V2 swap implementation
      if (request.amountIn) {
        // swapExactTokensForTokens for V2
        const iface = new ethers.Interface([
          'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
        ]);

        data = iface.encodeFunctionData('swapExactTokensForTokens', [
          request.amountIn,
          quote.amountOutMin,
          quote.path,
          request.recipient,
          quote.deadline
        ]);

        value = quote.path[0] === wbnbAddress ? request.amountIn : '0';
      } else {
        // swapTokensForExactTokens for V2
        const iface = new ethers.Interface([
          'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
        ]);

        data = iface.encodeFunctionData('swapTokensForExactTokens', [
          request.amountOut!,
          quote.amountInMax,
          quote.path,
          request.recipient,
          quote.deadline
        ]);

        value = quote.path[0] === wbnbAddress ? quote.amountInMax : '0';
      }
    }

    return {
      to: routerAddress,
      data,
      value,
      gasLimit: quote.gasEstimate.gasLimit,
      gasPrice: quote.gasEstimate.gasPrice,
      maxFeePerGas: quote.gasEstimate.maxFeePerGas,
      maxPriorityFeePerGas: quote.gasEstimate.maxPriorityFeePerGas,
      nonce: undefined, // Will be set by signer
      protocol, // Include protocol for tracking
      routerInfo: {
        address: routerAddress,
        protocol,
        version: protocol === 'v3' ? '3' : '2'
      }
    };
  }

  private async delayForMEVProtection(): Promise<void> {
    if (!this.mevProtection.delayExecution) {
      return;
    }

    // Random delay between 100ms and 1s
    const delay = Math.random() * 900 + 100;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private async monitorTransaction(hash: string): Promise<void> {
    const checkTransaction = async () => {
      try {
        const tx = await this.getTransaction(hash);
        if (!tx) {
          return; // Transaction not found yet
        }

        if (tx.status !== TransactionStatus.PENDING) {
          // Transaction is no longer pending
          this.pendingTransactions.delete(hash);

          // Update execution details
          if (tx.status === TransactionStatus.CONFIRMED) {
            const executionTime = Date.now() - tx.timestamp;
            tx.swapDetails.executionTime = executionTime;
            tx.swapDetails.confirmationTime = executionTime;
          }

          // Notify callbacks
          const callbacks = this.transactionCallbacks.get(hash);
          if (callbacks) {
            callbacks.forEach(callback => callback(tx));
          }

          return;
        }

        // Continue monitoring
        setTimeout(checkTransaction, 2000);

      } catch (error) {
        logger.error({
          hash,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'Error monitoring transaction');
      }
    };

    // Start monitoring after a short delay
    setTimeout(checkTransaction, 1000);
  }

  /**
   * Convert calculated route to swap quote
   */
  private async convertRouteToQuote(
    route: CalculatedRoute,
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<SwapQuote> {
    try {
      // Get token information (simplified - would fetch from token service)
      const tokenInfo = {
        symbol: 'TOKEN', // Would fetch actual symbol
        decimals: 18 // Would fetch actual decimals
      };

      // Calculate gas estimate
      const gasEstimate = await this.gasOptimizationService.estimateGasForSwap({
        amountIn,
        amountOut: route.totalAmountOut,
        amountOutMin: route.totalAmountOut,
        amountInMax: amountIn,
        tokenIn: { address: tokenIn, symbol: tokenInfo.symbol, decimals: tokenInfo.decimals },
        tokenOut: { address: tokenOut, symbol: tokenInfo.symbol, decimals: tokenInfo.decimals },
        path: route.path,
        route: route.route,
        tradingFee: route.totalFee,
        tradingFeePercentage: parseFloat(route.totalFee) / parseFloat(amountIn) * 100,
        priceImpact: route.totalPriceImpact,
        gasEstimate: {
          gasLimit: route.totalGasEstimate,
          gasPrice: '0', // Would be populated by gas optimization
          maxFeePerGas: '0',
          maxPriorityFeePerGas: '0',
          estimatedCostBNB: '0',
          estimatedCostUSD: '0'
        },
        deadline: Date.now() + 300000, // 5 minutes
        slippageTolerance: route.totalSlippage,
        price: {
          tokenInPriceUSD: 0, // Would fetch from price oracle
          tokenOutPriceUSD: 0, // Would fetch from price oracle
          exchangeRate: parseFloat(route.totalAmountOut) / parseFloat(amountIn)
        },
        pools: route.route.map(swap => ({
          address: swap.poolAddress,
          token0: swap.tokenIn,
          token1: swap.tokenOut,
          reserve0: '0', // Would fetch from pool
          reserve1: '0', // Would fetch from pool
          liquidity: swap.liquidity,
          fee: swap.fee,
          volume24h: '0',
          price: 0,
          priceUSD: 0
        })),
        warnings: route.warnings,
        riskLevel: route.riskLevel,
        timestamp: Date.now(),
        blockNumber: 0, // Would fetch current block
        validUntil: Date.now() + 300000 // 5 minutes
      });

      return {
        ...gasEstimate,
        confidence: route.confidence,
        routeOptimization: {
          originalAmountOut: route.totalAmountOut,
          optimizedAmountOut: route.totalAmountOut,
          improvement: '0'
        }
      };

    } catch (error) {
      logger.error({
        route: route.path,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to convert route to quote');
      throw error;
    }
  }
}

// Export singleton instance
export const swapService = new SwapService();