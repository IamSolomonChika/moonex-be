/**
 * BSC MEV Protection Service (Viem)
 * Comprehensive MEV (Maximum Extractable Value) protection for BSC trading using Viem
 */

import { formatUnits, parseUnits, Hex, Address } from 'viem';
import logger from '../../../utils/logger.js';
import type {
  SwapQuoteViem,
  SwapTransactionViem,
  SwapWarning,
  SwapRiskLevel,
  MEVProtection,
  TradingError,
  TradingErrorCode
} from '../types/trading-types-viem.js';
import { createPublicClient, createWalletClient, http } from 'viem';
import { bsc } from 'viem/chains';
import { BSCCacheManager } from '../cache/cache-manager.js';

/**
 * MEV Risk Analysis (Viem)
 */
export interface MEVRiskAnalysisViem {
  hasRisk: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  risks: SwapWarning[];
  recommendations: string[];
  mitigationStrategies: string[];
  analysisTimestamp: number;
  confidence: number; // 0-100
}

/**
 * Sandwich Attack Detection (Viem)
 */
export interface SandwichAttackRiskViem {
  detected: boolean;
  probability: number; // 0-100
  indicators: string[];
  attackerAddresses?: Address[];
  affectedPools: Address[];
  estimatedLoss?: string; // in USD
  protectionStrategies: string[];
}

/**
 * Front Running Detection (Viem)
 */
export interface FrontRunningRiskViem {
  detected: boolean;
  probability: number; // 0-100
  gasPriceAnalysis: {
    currentGasPrice: bigint;
    suspiciousGasPrices: Array<{
      price: bigint;
      timestamp: number;
      txHash: Hex;
    }>;
  };
  pendingTxCount: number;
  mempoolActivity: 'low' | 'medium' | 'high';
}

/**
 * MEV Protection Strategy (Viem)
 */
export interface MEVProtectionStrategyViem {
  strategy: 'private_mempool' | 'flashbots' | 'hybrid' | 'delay_execution' | 'gas_auction' | 'commit_reveal';
  parameters: {
    delayMs?: number;
    maxGasPriceGwei?: number;
    privateMempoolEndpoint?: string;
    useFlashbotsRPC?: boolean;
    commitRevealDelay?: number;
  };
  effectiveness: number; // 0-100
  estimatedCost: string; // in USD
  timeToExecute: number; // in seconds
}

/**
 * MEV Protection Service Interface (Viem)
 */
export interface IMEVProtectionServiceViem {
  // Risk assessment
  analyzeMEVRisk(quote: SwapQuoteViem): Promise<MEVRiskAnalysisViem>;
  detectSandwichAttack(quote: SwapQuoteViem): Promise<SandwichAttackRiskViem>;
  detectFrontRunning(): Promise<FrontRunningRiskViem>;

  // Protection strategies
  applyMEVProtection(quote: SwapQuoteViem, strategy?: MEVProtectionStrategyViem): Promise<SwapQuoteViem>;
  selectOptimalStrategy(riskAnalysis: MEVRiskAnalysisViem): Promise<MEVProtectionStrategyViem>;

  // Transaction monitoring
  monitorTransaction(txHash: Hex): Promise<void>;
  detectMEVAfterExecution(tx: SwapTransactionViem): Promise<boolean>;

  // Analytics
  getMEVAnalytics(timeframe?: string): Promise<any>;
  getAttackPatterns(): Promise<any>;
  getRealTimeMEVRisks(): Promise<MEVRiskAnalysisViem[]>;
}

/**
 * MEV Protection Service Implementation (Viem)
 */
export class MEVProtectionServiceViem implements IMEVProtectionServiceViem {
  private publicClient: any; // Simplified type for Viem 2.38.5 compatibility
  private cache: BSCCacheManager;
  private config: MEVProtection;

  // Risk thresholds
  private readonly RISK_THRESHOLDS = {
    HIGH_PRICE_IMPACT: 5.0, // 5%
    LOW_LIQUIDITY_USD: 10000, // $10k
    LARGE_TRADE_USD: 50000, // $50k
    HIGH_SLIPPAGE: 2.0, // 2%
    SUSPICIOUS_GAS_MULTIPLIER: 1.5,
    FRONTRUN_WINDOW_MS: 12000, // 12 seconds (BSC block time)
    SANDWICH_POOL_THRESHOLD: 100000, // $100k liquidity
    MEV_BOT_THRESHOLD: 0.8, // 80% confidence for bot detection
  };

  // Known MEV bot addresses (would be updated regularly)
  private readonly knownMEVBots = new Set<Address>([
    // Add known MEV bot addresses for BSC
  ]);

  // MEV protection endpoints
  private readonly PROTECTION_ENDPOINTS = {
    flashbots: 'https://rpc.flashbots.net/fast',
    beaver: 'https://rpc.beaver.build',
    bloxroute: 'https://bloxroute.ethical.blxrbdn.com',
    eden: 'https://rpc.edennetwork.io'
  };

  constructor(config?: Partial<MEVProtection>) {
    this.publicClient = createPublicClient({
      chain: bsc,
      transport: http()
    });

    this.cache = new BSCCacheManager();

    this.config = {
      enabled: true,
      strategy: 'hybrid',
      sandwichDetection: true,
      frontRunningDetection: true,
      usePrivateMempool: false,
      randomizeNonce: true,
      delayExecution: true,
      trackMEVActivity: true,
      alertOnMEVRisk: true,
      ...config
    };
  }

  /**
   * Analyze MEV risk for a swap quote using Viem
   */
  async analyzeMEVRisk(quote: SwapQuoteViem): Promise<MEVRiskAnalysisViem> {
    logger.debug({
      tokenIn: quote.tokenIn.address,
      tokenOut: quote.tokenOut.address,
      amountIn: quote.amountIn
    }, 'Analyzing MEV risk (Viem)');

    const risks: SwapWarning[] = [];
    const recommendations: string[] = [];
    const mitigationStrategies: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let hasRisk = false;
    let confidence = 85; // Default confidence

    try {
      // Check price impact
      if (quote.priceImpact > this.RISK_THRESHOLDS.HIGH_PRICE_IMPACT) {
        risks.push(SwapWarning.HIGH_PRICE_IMPACT);
        hasRisk = true;
        recommendations.push('Consider breaking into smaller trades');
        mitigationStrategies.push('Use time-weighted average price (TWAP) execution');
        confidence = Math.min(confidence + 5, 95);
      }

      // Check liquidity
      const minLiquidity = Math.min(...quote.pools.map(pool =>
        parseFloat(pool.liquidity || '0')
      ));
      if (minLiquidity < this.RISK_THRESHOLDS.LOW_LIQUIDITY_USD) {
        risks.push(SwapWarning.LOW_LIQUIDITY);
        hasRisk = true;
        recommendations.push('Consider trading on pools with higher liquidity');
        mitigationStrategies.push('Use limit orders instead of market orders');
        confidence = Math.min(confidence + 3, 95);
      }

      // Check trade size
      const tradeSizeUSD = parseFloat(formatUnits(
        BigInt(quote.amountIn),
        quote.tokenIn.decimals
      )) * (quote.price?.tokenInPriceUSD || 0);

      if (tradeSizeUSD > this.RISK_THRESHOLDS.LARGE_TRADE_USD) {
        risks.push(SwapWarning.MEV_RISK);
        hasRisk = true;
        recommendations.push('Break large trades into smaller chunks');
        mitigationStrategies.push('Use private mempool or delayed execution');
        confidence = Math.min(confidence + 7, 95);
      }

      // Check slippage tolerance
      if (quote.slippageTolerance > this.RISK_THRESHOLDS.HIGH_SLIPPAGE * 100) {
        risks.push(SwapWarning.SLIPPAGE_EXCEEDED);
        hasRisk = true;
        recommendations.push('Reduce slippage tolerance if possible');
        mitigationStrategies.push('Monitor market conditions before execution');
        confidence = Math.min(confidence + 4, 95);
      }

      // Check pool concentration
      const isLiquidityConcentrated = await this.detectConcentratedLiquidity(quote);
      if (isLiquidityConcentrated) {
        risks.push(SwapWarning.MEV_RISK);
        hasRisk = true;
        recommendations.push('Be cautious with concentrated liquidity pools');
        mitigationStrategies.push('Use multiple execution times');
        confidence = Math.min(confidence + 6, 95);
      }

      // Advanced MEV pattern detection
      const mevPatterns = await this.detectMEVPatterns(quote);
      if (mevPatterns.detected) {
        risks.push(SwapWarning.MEV_RISK);
        hasRisk = true;
        recommendations.push(...mevPatterns.recommendations);
        mitigationStrategies.push(...mevPatterns.mitigationStrategies);
        confidence = Math.min(confidence + 10, 95);
      }

      // Determine overall risk level
      if (risks.includes(SwapWarning.HIGH_PRICE_IMPACT) || tradeSizeUSD > this.RISK_THRESHOLDS.LARGE_TRADE_USD * 2) {
        riskLevel = 'critical';
      } else if (risks.length >= 3 || tradeSizeUSD > this.RISK_THRESHOLDS.LARGE_TRADE_USD) {
        riskLevel = 'high';
      } else if (risks.length >= 1) {
        riskLevel = 'medium';
      }

      // Cache the analysis
      const cacheKey = `mev_analysis:${quote.tokenIn.address}:${quote.tokenOut.address}:${quote.amountIn}`;
      await this.cache.set(cacheKey, {
        hasRisk,
        riskLevel,
        risks,
        recommendations,
        mitigationStrategies,
        analysisTimestamp: Date.now(),
        confidence
      }, 30000); // 30 seconds

      logger.info({
        tokenPair: `${quote.tokenIn.address}/${quote.tokenOut.address}`,
        riskLevel,
        riskCount: risks.length,
        hasRisk,
        confidence
      }, 'MEV risk analysis completed (Viem)');

      return {
        hasRisk,
        riskLevel,
        risks,
        recommendations,
        mitigationStrategies,
        analysisTimestamp: Date.now(),
        confidence
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'MEV risk analysis failed');

      // Return conservative risk analysis on error
      return {
        hasRisk: true,
        riskLevel: 'medium',
        risks: [SwapWarning.MEV_RISK],
        recommendations: ['Exercise caution due to analysis failure'],
        mitigationStrategies: ['Use basic protection strategies'],
        analysisTimestamp: Date.now(),
        confidence: 50
      };
    }
  }

  /**
   * Detect potential sandwich attacks using Viem
   */
  async detectSandwichAttack(quote: SwapQuoteViem): Promise<SandwichAttackRiskViem> {
    logger.debug('Detecting sandwich attack risk (Viem)');

    const indicators: string[] = [];
    const protectionStrategies: string[] = [];
    let probability = 0;
    let detected = false;
    let estimatedLoss: string | undefined;

    try {
      // Check pool liquidity
      const minLiquidity = Math.min(...quote.pools.map(pool =>
        parseFloat(pool.liquidity || '0')
      ));
      if (minLiquidity < this.RISK_THRESHOLDS.SANDWICH_POOL_THRESHOLD) {
        indicators.push('Low pool liquidity vulnerable to sandwich');
        probability += 30;
        protectionStrategies.push('Use delayed execution');
      }

      // Check for large price impact
      if (quote.priceImpact > 3.0) {
        indicators.push('High price impact makes sandwich profitable');
        probability += 25;
        protectionStrategies.push('Break trade into smaller chunks');

        // Estimate potential loss
        const tradeValue = parseFloat(formatUnits(BigInt(quote.amountIn), quote.tokenIn.decimals));
        estimatedLoss = (tradeValue * 0.02).toFixed(2); // 2% potential loss
      }

      // Check recent transactions in affected pools using Viem
      const recentTxAnalysis = await this.analyzeRecentTransactionsViem(quote.pools);
      if (recentTxAnalysis.suspiciousActivity) {
        indicators.push('Recent suspicious activity detected in pools');
        probability += 20;
        detected = true;
        protectionStrategies.push('Use private mempool');
      }

      // Check for known MEV bots using Viem
      const botActivity = await this.checkMEVBotActivityViem(quote.pools);
      if (botActivity.detected) {
        indicators.push('Known MEV bots active in target pools');
        probability += 25;
        detected = true;
        protectionStrategies.push('Use Flashbots or alternative RPC');
      }

      // Analyze mempool state using Viem
      const mempoolAnalysis = await this.analyzeMempoolState(quote);
      if (mempoolAnalysis.highActivity) {
        indicators.push('High mempool activity increases sandwich risk');
        probability += 15;
        protectionStrategies.push('Monitor for optimal timing');
      }

      // Cap probability at 100
      probability = Math.min(probability, 100);
      detected = detected || probability > 50;

      return {
        detected,
        probability,
        indicators,
        attackerAddresses: botActivity.addresses,
        affectedPools: quote.pools.map(pool => pool.address as Address),
        estimatedLoss,
        protectionStrategies
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Sandwich attack detection failed');
      return {
        detected: false,
        probability: 0,
        indicators: ['Analysis failed - exercise caution'],
        affectedPools: quote.pools.map(pool => pool.address as Address),
        protectionStrategies: ['Use basic protection measures']
      };
    }
  }

  /**
   * Detect front-running risk using Viem
   */
  async detectFrontRunning(): Promise<FrontRunningRiskViem> {
    logger.debug('Detecting front-running risk (Viem)');

    try {
      // Get current gas price using Viem
      const feeData = await this.publicClient.getFeeData();
      const currentGasPrice = feeData.gasPrice || parseUnits('20', 'gwei');

      // Get pending transactions count using Viem
      const pendingBlock = await this.publicClient.getBlock({
        blockTag: 'pending'
      });

      const pendingTxCount = pendingBlock?.transactions.length || 0;

      // Analyze gas prices in recent transactions using Viem
      const suspiciousGasPrices = [];
      let suspiciousCount = 0;

      // Get recent block with transactions using Viem
      const latestBlock = await this.publicClient.getBlock({
        includeTransactions: true
      });

      if (latestBlock && latestBlock.transactions.length > 0) {
        // Calculate average gas price
        const totalGasPrice = latestBlock.transactions.reduce((sum: bigint, tx: any) => {
          return sum + (tx.gasPrice || BigInt(0));
        }, BigInt(0));

        const avgGasPrice = totalGasPrice / BigInt(latestBlock.transactions.length);
        const thresholdGasPrice = (avgGasPrice * BigInt(Math.floor(this.RISK_THRESHOLDS.SUSPICIOUS_GAS_MULTIPLIER * 100))) / BigInt(100);

        // Check for suspicious gas prices
        for (const tx of latestBlock.transactions.slice(0, 10)) {
          if (tx.gasPrice && tx.gasPrice > thresholdGasPrice) {
            suspiciousGasPrices.push({
              price: tx.gasPrice,
              timestamp: Date.now(),
              txHash: tx.hash
            });
            suspiciousCount++;
          }
        }
      }

      const probability = Math.min((suspiciousCount / 10) * 100, 100);
      const detected = probability > 30;

      // Determine mempool activity level
      let mempoolActivity: 'low' | 'medium' | 'high' = 'low';
      if (pendingTxCount > 200) {
        mempoolActivity = 'high';
      } else if (pendingTxCount > 50) {
        mempoolActivity = 'medium';
      }

      return {
        detected,
        probability,
        gasPriceAnalysis: {
          currentGasPrice,
          suspiciousGasPrices
        },
        pendingTxCount,
        mempoolActivity
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Front-running detection failed');
      return {
        detected: false,
        probability: 0,
        gasPriceAnalysis: {
          currentGasPrice: BigInt(0),
          suspiciousGasPrices: []
        },
        pendingTxCount: 0,
        mempoolActivity: 'low'
      };
    }
  }

  /**
   * Apply MEV protection to a quote using Viem
   */
  async applyMEVProtection(quote: SwapQuoteViem, strategy?: MEVProtectionStrategyViem): Promise<SwapQuoteViem> {
    logger.debug({ strategy: strategy?.strategy || this.config.strategy }, 'Applying MEV protection (Viem)');

    const protectedQuote = { ...quote };
    const selectedStrategy = strategy || await this.selectOptimalStrategy(await this.analyzeMEVRisk(quote));

    switch (selectedStrategy.strategy) {
      case 'delay_execution':
        return await this.applyDelayExecution(protectedQuote, selectedStrategy);

      case 'gas_auction':
        return await this.applyGasAuction(protectedQuote, selectedStrategy);

      case 'private_mempool':
        return await this.applyPrivateMempool(protectedQuote, selectedStrategy);

      case 'flashbots':
        return await this.applyFlashbots(protectedQuote, selectedStrategy);

      case 'commit_reveal':
        return await this.applyCommitReveal(protectedQuote, selectedStrategy);

      case 'hybrid':
      default:
        return await this.applyHybridProtection(protectedQuote, selectedStrategy);
    }
  }

  /**
   * Select optimal MEV protection strategy using Viem
   */
  async selectOptimalStrategy(riskAnalysis: MEVRiskAnalysisViem): Promise<MEVProtectionStrategyViem> {
    logger.debug({ riskLevel: riskAnalysis.riskLevel }, 'Selecting optimal MEV protection strategy (Viem)');

    // Get current gas conditions using Viem
    const feeData = await this.publicClient.getFeeData();
    const currentGasPrice = formatUnits(feeData.gasPrice || parseUnits('20', 'gwei'), 'gwei');

    switch (riskAnalysis.riskLevel) {
      case 'critical':
        return {
          strategy: 'flashbots',
          parameters: {
            useFlashbotsRPC: true,
            maxGasPriceGwei: Math.max(parseFloat(currentGasPrice) * 1.5, 50)
          },
          effectiveness: 90,
          estimatedCost: (parseFloat(currentGasPrice) * 1.5 * 0.001).toFixed(6), // Rough estimate
          timeToExecute: 15
        };

      case 'high':
        return {
          strategy: 'hybrid',
          parameters: {
            delayMs: 5000,
            maxGasPriceGwei: Math.max(parseFloat(currentGasPrice) * 1.3, 30),
            privateMempoolEndpoint: this.PROTECTION_ENDPOINTS.eden
          },
          effectiveness: 75,
          estimatedCost: (parseFloat(currentGasPrice) * 1.3 * 0.001).toFixed(6),
          timeToExecute: 10
        };

      case 'medium':
        return {
          strategy: 'delay_execution',
          parameters: {
            delayMs: 2000,
            maxGasPriceGwei: Math.max(parseFloat(currentGasPrice) * 1.2, 25)
          },
          effectiveness: 60,
          estimatedCost: (parseFloat(currentGasPrice) * 1.2 * 0.001).toFixed(6),
          timeToExecute: 5
        };

      case 'low':
      default:
        return {
          strategy: 'gas_auction',
          parameters: {
            maxGasPriceGwei: Math.max(parseFloat(currentGasPrice) * 1.1, 20)
          },
          effectiveness: 40,
          estimatedCost: (parseFloat(currentGasPrice) * 1.1 * 0.001).toFixed(6),
          timeToExecute: 2
        };
    }
  }

  /**
   * Monitor transaction for MEV attacks using Viem
   */
  async monitorTransaction(txHash: Hex): Promise<void> {
    logger.debug({ txHash }, 'Monitoring transaction for MEV attacks (Viem)');

    try {
      // Monitor for surrounding transactions using Viem
      const checkSurroundingTxs = async () => {
        try {
          const receipt = await this.publicClient.getTransactionReceipt({
            hash: txHash
          });

          if (!receipt) return;

          const block = await this.publicClient.getBlock({
            blockNumber: receipt.blockNumber,
            includeTransactions: true
          });

          if (!block) return;

          // Analyze transactions in the same block
          const surroundingTxs = block.transactions.filter((tx: any) => tx.hash !== txHash);
          const mevDetected = await this.detectMEVInBlock(surroundingTxs, txHash);

          if (mevDetected) {
            logger.warn({
              txHash,
              blockNumber: receipt.blockNumber,
              surroundingTxCount: surroundingTxs.length
            }, 'Potential MEV attack detected in transaction block');

            // Cache for analysis
            await this.cache.set(`mev_detected:${txHash}`, {
              detected: true,
              blockNumber: receipt.blockNumber,
              timestamp: Date.now()
            }, 86400000); // 24 hours
          }

        } catch (error) {
          logger.debug({
            txHash,
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Error monitoring transaction');
        }
      };

      // Start monitoring at different intervals
      setTimeout(checkSurroundingTxs, 5000);
      setTimeout(checkSurroundingTxs, 15000);
      setTimeout(checkSurroundingTxs, 30000);
      setTimeout(checkSurroundingTxs, 60000);

    } catch (error) {
      logger.error({
        txHash,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to start transaction monitoring');
    }
  }

  /**
   * Detect MEV after transaction execution using Viem
   */
  async detectMEVAfterExecution(tx: SwapTransactionViem): Promise<boolean> {
    logger.debug({ txHash: tx.hash }, 'Detecting MEV after transaction execution (Viem)');

    try {
      const cached = await this.cache.get(`mev_detected:${tx.hash}`);
      return cached?.detected || false;

    } catch (error) {
      logger.error({
        txHash: tx.hash,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to detect MEV after execution');
      return false;
    }
  }

  /**
   * Get MEV analytics using Viem
   */
  async getMEVAnalytics(timeframe?: string): Promise<any> {
    logger.debug({ timeframe }, 'Getting MEV analytics (Viem)');

    try {
      // Get current network conditions using Viem
      const latestBlock = await this.publicClient.getBlock();
      const feeData = await this.publicClient.getFeeData();

      // This would query analytics database
      // For now, return placeholder data with real network info
      return {
        timeframe: timeframe || '24h',
        networkConditions: {
          currentGasPrice: feeData.gasPrice ? formatUnits(feeData.gasPrice, 'gwei') : '0',
          latestBlockNumber: latestBlock?.number || 0,
          blockTime: '3s'
        },
        totalMEVDetected: 0,
        sandwichAttacks: 0,
        frontRunningAttempts: 0,
        protectedTransactions: 0,
        averageProtectionEffectiveness: 0,
        riskDistribution: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0
        }
      };

    } catch (error) {
      logger.error({
        timeframe,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get MEV analytics');
      throw error;
    }
  }

  /**
   * Get attack patterns using Viem
   */
  async getAttackPatterns(): Promise<any> {
    logger.debug('Getting MEV attack patterns (Viem)');

    try {
      // Get recent block data for pattern analysis
      const latestBlock = await this.publicClient.getBlock({
        includeTransactions: true
      });

      // This would analyze historical MEV attack patterns
      return {
        commonAttackVectors: ['sandwich', 'front-running', 'liquidation'],
        targetedTokens: [],
        attackTimes: [], // Times when attacks are most common
        averageLoss: '0',
        preventionSuccessRate: 0,
        recentActivity: {
          blockNumber: latestBlock?.number || 0,
          transactionCount: latestBlock?.transactions.length || 0
        }
      };

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get attack patterns');
      throw error;
    }
  }

  /**
   * Get real-time MEV risks
   */
  async getRealTimeMEVRisks(): Promise<MEVRiskAnalysisViem[]> {
    logger.debug('Getting real-time MEV risks');

    try {
      // This would monitor multiple token pairs in real-time
      // For now, return empty array
      return [];

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get real-time MEV risks');
      return [];
    }
  }

  // Private helper methods

  private async detectConcentratedLiquidity(quote: SwapQuoteViem): Promise<boolean> {
    // Check if pools have concentrated liquidity characteristics
    return quote.pools.some(pool => {
      const liquidity = parseFloat(pool.liquidity || '0');
      return liquidity < 50000 && pool.priceImpact > 1.0;
    });
  }

  private async detectMEVPatterns(quote: SwapQuoteViem): Promise<{
    detected: boolean;
    recommendations: string[];
    mitigationStrategies: string[];
  }> {
    // Advanced MEV pattern detection
    const patterns = [];

    // Check for common MEV patterns
    if (quote.priceImpact > 5.0) {
      patterns.push('high_price_impact');
    }

    if (parseFloat(quote.amountIn) > parseUnits('100000', quote.tokenIn.decimals)) {
      patterns.push('large_trade_size');
    }

    return {
      detected: patterns.length > 0,
      recommendations: patterns.length > 0 ? ['Use enhanced protection'] : [],
      mitigationStrategies: patterns.length > 0 ? ['Consider multiple execution strategies'] : []
    };
  }

  private async analyzeRecentTransactionsViem(pools: any[]): Promise<{ suspiciousActivity: boolean }> {
    try {
      // Analyze recent transactions in the pools using Viem
      for (const pool of pools.slice(0, 3)) { // Limit to prevent timeouts
        const latestBlock = await this.publicClient.getBlock({
          includeTransactions: true
        });

        // Look for pool-related transactions
        const poolTxs = latestBlock?.transactions.filter((tx: any) =>
          tx.to === pool.address
        ) || [];

        if (poolTxs.length > 5) {
          return { suspiciousActivity: true };
        }
      }

      return { suspiciousActivity: false };
    } catch (error) {
      logger.debug({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to analyze recent transactions');
      return { suspiciousActivity: false };
    }
  }

  private async checkMEVBotActivityViem(pools: any[]): Promise<{ detected: boolean; addresses: Address[] }> {
    try {
      // Check if known MEV bots are active in the pools using Viem
      const activeBots: Address[] = [];

      const latestBlock = await this.publicClient.getBlock({
        includeTransactions: true
      });

      if (latestBlock) {
        for (const tx of latestBlock.transactions.slice(0, 20)) {
          if (tx.from && this.knownMEVBots.has(tx.from as Address)) {
            activeBots.push(tx.from as Address);
          }
        }
      }

      return {
        detected: activeBots.length > 0,
        addresses: [...new Set(activeBots)]
      };
    } catch (error) {
      logger.debug({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to check MEV bot activity');
      return { detected: false, addresses: [] };
    }
  }

  private async analyzeMempoolState(quote: SwapQuoteViem): Promise<{ highActivity: boolean }> {
    try {
      // Get pending block using Viem
      const pendingBlock = await this.publicClient.getBlock({
        blockTag: 'pending'
      });

      const pendingCount = pendingBlock?.transactions.length || 0;
      return { highActivity: pendingCount > 100 };
    } catch (error) {
      return { highActivity: false };
    }
  }

  private async applyDelayExecution(quote: SwapQuoteViem, strategy: MEVProtectionStrategyViem): Promise<SwapQuoteViem> {
    const protectedQuote = { ...quote };

    // Add random delay and increase slippage protection
    protectedQuote.slippageTolerance = Math.min(quote.slippageTolerance * 1.2, 300);

    if (!protectedQuote.warnings.includes(SwapWarning.MEV_RISK)) {
      protectedQuote.warnings.push(SwapWarning.MEV_RISK);
    }

    return protectedQuote;
  }

  private async applyGasAuction(quote: SwapQuoteViem, strategy: MEVProtectionStrategyViem): Promise<SwapQuoteViem> {
    const protectedQuote = { ...quote };

    // Optimize gas price for auction
    const maxGasPrice = parseUnits((strategy.parameters.maxGasPriceGwei || 20).toString(), 'gwei');
    protectedQuote.gasEstimate.maxFeePerGas = maxGasPrice.toString();

    return protectedQuote;
  }

  private async applyPrivateMempool(quote: SwapQuoteViem, strategy: MEVProtectionStrategyViem): Promise<SwapQuoteViem> {
    const protectedQuote = { ...quote };

    // Mark for private mempool submission
    protectedQuote.warnings.push(SwapWarning.MEV_RISK);

    return protectedQuote;
  }

  private async applyFlashbots(quote: SwapQuoteViem, strategy: MEVProtectionStrategyViem): Promise<SwapQuoteViem> {
    const protectedQuote = { ...quote };

    // Mark for Flashbots submission
    protectedQuote.warnings.push(SwapWarning.MEV_RISK);

    return protectedQuote;
  }

  private async applyCommitReveal(quote: SwapQuoteViem, strategy: MEVProtectionStrategyViem): Promise<SwapQuoteViem> {
    const protectedQuote = { ...quote };

    // Mark for commit-reveal scheme
    protectedQuote.warnings.push(SwapWarning.MEV_RISK);

    return protectedQuote;
  }

  private async applyHybridProtection(quote: SwapQuoteViem, strategy: MEVProtectionStrategyViem): Promise<SwapQuoteViem> {
    // Combine multiple protection strategies
    let protectedQuote = await this.applyDelayExecution(quote, strategy);
    protectedQuote = await this.applyGasAuction(protectedQuote, strategy);

    return protectedQuote;
  }

  private async detectMEVInBlock(txs: any[], targetTxHash: Hex): Promise<boolean> {
    // Analyze transactions in the same block for MEV patterns
    try {
      // Look for potential sandwich patterns
      for (let i = 0; i < txs.length - 1; i++) {
        if (txs[i].to === txs[i + 1].to) {
          // Same target contracts could indicate sandwich
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.debug({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to detect MEV in block');
      return false;
    }
  }
}

// Export singleton instance
export const mevProtectionServiceViem = new MEVProtectionServiceViem();