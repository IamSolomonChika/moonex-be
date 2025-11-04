/**
 * BSC Slippage Protection Service
 * Advanced slippage protection and dynamic adjustment for BSC trading
 */

import { ethers } from 'ethers';
import logger from '../../../utils/logger.js';
import type {
  SwapQuote,
  SwapOptions,
  SwapWarning,
  SwapRiskLevel,
  TradingError,
  TradingErrorCode
} from './types.js';
import { BSCProviderManager } from '../../utils/ethers-provider.js';
import { BSCCacheManager } from '../cache/cache-manager.js';

/**
 * Slippage Analysis Result
 */
export interface SlippageAnalysis {
  currentSlippage: number;
  recommendedSlippage: number;
  maxAcceptableSlippage: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: SlippageFactor[];
  dynamicAdjustment: boolean;
  protectionStrategies: string[];
}

/**
 * Slippage Factor
 */
export interface SlippageFactor {
  name: string;
  impact: number; // How much this factor contributes to slippage risk
  severity: 'low' | 'medium' | 'high';
  description: string;
}

/**
 * Real-time Market Conditions
 */
export interface MarketConditions {
  volatility: 'low' | 'medium' | 'high';
  volume24h: string;
  priceChange24h: number;
  gasPriceLevel: 'low' | 'medium' | 'high';
  congestionLevel: number; // 0-100
  blockTime: number; // seconds
}

/**
 * Slippage Protection Strategy
 */
export interface SlippageProtectionStrategy {
  strategy: 'fixed' | 'dynamic' | 'adaptive' | 'conservative' | 'aggressive';
  baseSlippage: number;
  maxSlippage: number;
  adjustmentFactor: number;
  volatilityMultiplier: number;
  volumeMultiplier: number;
  congestionMultiplier: number;
}

/**
 * Slippage Protection Service Interface
 */
export interface ISlippageProtectionService {
  // Analysis and calculation
  analyzeSlippage(quote: SwapQuote): Promise<SlippageAnalysis>;
  calculateOptimalSlippage(tokenIn: string, tokenOut: string, amount: string): Promise<number>;
  getMarketConditions(tokenIn: string, tokenOut: string): Promise<MarketConditions>;

  // Protection strategies
  applySlippageProtection(quote: SwapQuote, strategy?: SlippageProtectionStrategy): Promise<SwapQuote>;
  selectOptimalStrategy(analysis: SlippageAnalysis, marketConditions: MarketConditions): Promise<SlippageProtectionStrategy>;

  // Monitoring and alerts
  monitorSlippage(txHash: string): Promise<void>;
  validateSlippage(quote: SwapQuote, actualSlippage: number): Promise<boolean>;

  // Analytics
  getSlippageAnalytics(timeframe?: string): Promise<any>;
  getSlippageHistory(tokenPair: string, timeframe?: string): Promise<any>;
}

/**
 * Slippage Protection Service Implementation
 */
export class SlippageProtectionService implements ISlippageProtectionService {
  private provider: BSCProviderManager;
  private cache: BSCCacheManager;

  // Configuration constants
  private readonly DEFAULT_SLIPPAGE = 50; // 0.5%
  private readonly MAX_SLIPPAGE = 500; // 5%
  private readonly CRITICAL_SLIPPAGE_THRESHOLD = 300; // 3%

  // Risk thresholds
  private readonly RISK_THRESHOLDS = {
    VOLATILITY_HIGH: 5.0, // 5% 24h price change
    VOLATILITY_MEDIUM: 2.0, // 2% 24h price change
    VOLUME_LOW: 10000, // $10k
    CONGESTION_HIGH: 80, // 80% network congestion
    GAS_PRICE_HIGH: 30, // 30 gwei
    BLOCK_TIME_SLOW: 6, // 6 seconds (BSC is usually 3s)
  };

  constructor() {
    this.provider = new BSCProviderManager();
    this.cache = new BSCCacheManager();
  }

  /**
   * Analyze slippage for a swap quote
   */
  async analyzeSlippage(quote: SwapQuote): Promise<SlippageAnalysis> {
    logger.debug({
      tokenIn: quote.tokenIn.address,
      tokenOut: quote.tokenOut.address,
      amountIn: quote.amountIn,
      currentSlippage: quote.slippageTolerance
    }, 'Analyzing slippage');

    const factors: SlippageFactor[] = [];
    let riskScore = 0;

    // Analyze liquidity factors
    const liquidityFactors = this.analyzeLiquidityFactors(quote);
    factors.push(...liquidityFactors);
    riskScore += liquidityFactors.reduce((sum, factor) => sum + factor.impact, 0);

    // Analyze market factors
    const marketConditions = await this.getMarketConditions(quote.tokenIn.address, quote.tokenOut.address);
    const marketFactors = this.analyzeMarketFactors(marketConditions);
    factors.push(...marketFactors);
    riskScore += marketFactors.reduce((sum, factor) => sum + factor.impact, 0);

    // Analyze trade size factors
    const tradeSizeFactors = this.analyzeTradeSizeFactors(quote);
    factors.push(...tradeSizeFactors);
    riskScore += tradeSizeFactors.reduce((sum, factor) => sum + factor.impact, 0);

    // Analyze timing factors
    const timingFactors = this.analyzeTimingFactors();
    factors.push(...timingFactors);
    riskScore += timingFactors.reduce((sum, factor) => sum + factor.impact, 0);

    // Calculate recommended slippage
    const recommendedSlippage = this.calculateRecommendedSlippage(riskScore, marketConditions);
    const maxAcceptableSlippage = Math.min(recommendedSlippage * 2, this.MAX_SLIPPAGE);

    // Determine risk level
    const riskLevel = this.determineRiskLevel(riskScore, recommendedSlippage);

    // Generate protection strategies
    const protectionStrategies = this.generateProtectionStrategies(riskLevel, factors);

    logger.info({
      currentSlippage: quote.slippageTolerance,
      recommendedSlippage,
      riskLevel,
      factorCount: factors.length
    }, 'Slippage analysis completed');

    return {
      currentSlippage: quote.slippageTolerance,
      recommendedSlippage,
      maxAcceptableSlippage,
      riskLevel,
      factors,
      dynamicAdjustment: riskScore > 30, // Enable dynamic adjustment for higher risk
      protectionStrategies
    };
  }

  /**
   * Calculate optimal slippage for a token pair and amount
   */
  async calculateOptimalSlippage(tokenIn: string, tokenOut: string, amount: string): Promise<number> {
    logger.debug({
      tokenIn,
      tokenOut,
      amount
    }, 'Calculating optimal slippage');

    try {
      const marketConditions = await this.getMarketConditions(tokenIn, tokenOut);

      // Base slippage calculation
      let baseSlippage = this.DEFAULT_SLIPPAGE;

      // Adjust for market conditions
      if (marketConditions.volatility === 'high') {
        baseSlippage *= 1.5;
      } else if (marketConditions.volatility === 'medium') {
        baseSlippage *= 1.2;
      }

      if (marketConditions.congestionLevel > 70) {
        baseSlippage *= 1.3;
      }

      // Adjust for trade size (would need price data for accurate calculation)
      const amountNum = parseFloat(amount);
      if (amountNum > 1000000) { // Large trade
        baseSlippage *= 1.4;
      } else if (amountNum > 100000) { // Medium trade
        baseSlippage *= 1.2;
      }

      // Apply bounds
      const optimalSlippage = Math.min(Math.max(baseSlippage, 10), this.MAX_SLIPPAGE);

      logger.info({
        tokenIn,
        tokenOut,
        optimalSlippage,
        marketConditions
      }, 'Optimal slippage calculated');

      return Math.round(optimalSlippage);

    } catch (error) {
      logger.error({
        tokenIn,
        tokenOut,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to calculate optimal slippage');
      return this.DEFAULT_SLIPPAGE;
    }
  }

  /**
   * Get current market conditions
   */
  async getMarketConditions(tokenIn: string, tokenOut: string): Promise<MarketConditions> {
    logger.debug({ tokenIn, tokenOut }, 'Getting market conditions');

    try {
      const provider = await this.provider.getProvider();
      const feeData = await provider.getFeeData();
      const currentBlock = await provider.getBlock('latest');

      // Analyze gas price
      const gasPriceGwei = parseFloat(ethers.formatUnits(feeData.gasPrice || 0, 'gwei'));
      let gasPriceLevel: 'low' | 'medium' | 'high' = 'low';
      if (gasPriceGwei > this.RISK_THRESHOLDS.GAS_PRICE_HIGH) {
        gasPriceLevel = 'high';
      } else if (gasPriceGwei > 15) {
        gasPriceLevel = 'medium';
      }

      // Calculate congestion level (simplified)
      const pendingBlock = await provider.send('eth_getBlockByNumber', ['pending', false]);
      const congestionLevel = Math.min((pendingBlock.transactions.length / 200) * 100, 100);

      // Estimate block time
      const blockTime = currentBlock ? 3 : 5; // BSC average is 3s, use 5s as fallback

      // For volume and volatility, would fetch from price oracle
      // For now, use placeholder values
      const volume24h = '1000000'; // $1M placeholder
      const priceChange24h = 2.5; // 2.5% placeholder

      let volatility: 'low' | 'medium' | 'high' = 'low';
      if (Math.abs(priceChange24h) > this.RISK_THRESHOLDS.VOLATILITY_HIGH) {
        volatility = 'high';
      } else if (Math.abs(priceChange24h) > this.RISK_THRESHOLDS.VOLATILITY_MEDIUM) {
        volatility = 'medium';
      }

      return {
        volatility,
        volume24h,
        priceChange24h,
        gasPriceLevel,
        congestionLevel,
        blockTime
      };

    } catch (error) {
      logger.error({
        tokenIn,
        tokenOut,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get market conditions');

      // Return conservative default conditions
      return {
        volatility: 'medium',
        volume24h: '500000',
        priceChange24h: 1.0,
        gasPriceLevel: 'medium',
        congestionLevel: 50,
        blockTime: 4
      };
    }
  }

  /**
   * Apply slippage protection to a quote
   */
  async applySlippageProtection(quote: SwapQuote, strategy?: SlippageProtectionStrategy): Promise<SwapQuote> {
    logger.debug({ strategy: strategy?.strategy || 'adaptive' }, 'Applying slippage protection');

    const protectedQuote = { ...quote };
    const analysis = await this.analyzeSlippage(quote);
    const marketConditions = await this.getMarketConditions(quote.tokenIn.address, quote.tokenOut.address);
    const selectedStrategy = strategy || await this.selectOptimalStrategy(analysis, marketConditions);

    switch (selectedStrategy.strategy) {
      case 'fixed':
        protectedQuote.slippageTolerance = selectedStrategy.baseSlippage;
        break;

      case 'dynamic':
        protectedQuote.slippageTolerance = await this.calculateDynamicSlippage(quote, marketConditions, selectedStrategy);
        break;

      case 'adaptive':
        protectedQuote.slippageTolerance = analysis.recommendedSlippage;
        break;

      case 'conservative':
        protectedQuote.slippageTolerance = Math.min(analysis.recommendedSlippage * 1.5, selectedStrategy.maxSlippage);
        break;

      case 'aggressive':
        protectedQuote.slippageTolerance = Math.min(analysis.recommendedSlippage * 0.7, selectedStrategy.maxSlippage);
        break;
    }

    // Update amountOutMin based on new slippage
    const slippageMultiplier = (100 - protectedQuote.slippageTolerance) / 100;
    protectedQuote.amountOutMin = (BigInt(protectedQuote.amountOut) * BigInt(Math.floor(slippageMultiplier * 10000))) / BigInt(10000);

    // Add warnings if necessary
    if (protectedQuote.slippageTolerance > this.CRITICAL_SLIPPAGE_THRESHOLD) {
      if (!protectedQuote.warnings.includes(SwapWarning.SLIPPAGE_EXCEEDED)) {
        protectedQuote.warnings.push(SwapWarning.SLIPPAGE_EXCEEDED);
      }
    }

    logger.info({
      originalSlippage: quote.slippageTolerance,
      newSlippage: protectedQuote.slippageTolerance,
      strategy: selectedStrategy.strategy
    }, 'Slippage protection applied');

    return protectedQuote;
  }

  /**
   * Select optimal slippage protection strategy
   */
  async selectOptimalStrategy(analysis: SlippageAnalysis, marketConditions: MarketConditions): Promise<SlippageProtectionStrategy> {
    logger.debug({ riskLevel: analysis.riskLevel, volatility: marketConditions.volatility }, 'Selecting optimal slippage strategy');

    switch (analysis.riskLevel) {
      case 'critical':
        return {
          strategy: 'conservative',
          baseSlippage: Math.min(analysis.recommendedSlippage * 2, this.MAX_SLIPPAGE),
          maxSlippage: this.MAX_SLIPPAGE,
          adjustmentFactor: 0.1,
          volatilityMultiplier: 2.0,
          volumeMultiplier: 1.5,
          congestionMultiplier: 1.8
        };

      case 'high':
        return {
          strategy: 'adaptive',
          baseSlippage: analysis.recommendedSlippage,
          maxSlippage: Math.min(analysis.recommendedSlippage * 1.8, this.MAX_SLIPPAGE),
          adjustmentFactor: 0.2,
          volatilityMultiplier: 1.8,
          volumeMultiplier: 1.3,
          congestionMultiplier: 1.5
        };

      case 'medium':
        return {
          strategy: 'dynamic',
          baseSlippage: analysis.recommendedSlippage,
          maxSlippage: Math.min(analysis.recommendedSlippage * 1.5, this.MAX_SLIPPAGE),
          adjustmentFactor: 0.3,
          volatilityMultiplier: 1.5,
          volumeMultiplier: 1.2,
          congestionMultiplier: 1.3
        };

      case 'low':
      default:
        return {
          strategy: 'fixed',
          baseSlippage: Math.max(analysis.recommendedSlippage, 20), // Minimum 0.2%
          maxSlippage: this.DEFAULT_SLIPPAGE * 2,
          adjustmentFactor: 0.1,
          volatilityMultiplier: 1.2,
          volumeMultiplier: 1.1,
          congestionMultiplier: 1.1
        };
    }
  }

  /**
   * Monitor slippage for a transaction
   */
  async monitorSlippage(txHash: string): Promise<void> {
    logger.debug({ txHash }, 'Monitoring transaction slippage');

    try {
      const provider = await this.provider.getProvider();

      const checkSlippage = async () => {
        try {
          const receipt = await provider.getTransactionReceipt(txHash);
          if (!receipt || receipt.status !== 1) return;

          const tx = await provider.getTransaction(txHash);
          if (!tx) return;

          // This would decode the transaction and calculate actual slippage
          // For now, just log the monitoring
          logger.info({
            txHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed?.toString()
          }, 'Slippage monitoring completed');

        } catch (error) {
          logger.debug({
            txHash,
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Error monitoring slippage');
        }
      };

      // Check after confirmation
      setTimeout(checkSlippage, 5000);
      setTimeout(checkSlippage, 15000);

    } catch (error) {
      logger.error({
        txHash,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to start slippage monitoring');
    }
  }

  /**
   * Validate actual slippage against quote
   */
  async validateSlippage(quote: SwapQuote, actualSlippage: number): Promise<boolean> {
    logger.debug({
      expectedSlippage: quote.slippageTolerance,
      actualSlippage
    }, 'Validating slippage');

    const isValid = actualSlippage <= quote.slippageTolerance;

    if (!isValid) {
      logger.warn({
        expectedSlippage: quote.slippageTolerance,
        actualSlippage,
        exceedBy: actualSlippage - quote.slippageTolerance
      }, 'Slippage exceeded tolerance');
    }

    return isValid;
  }

  /**
   * Get slippage analytics
   */
  async getSlippageAnalytics(timeframe?: string): Promise<any> {
    logger.debug({ timeframe }, 'Getting slippage analytics');

    try {
      // This would query analytics database
      return {
        timeframe: timeframe || '24h',
        averageSlippage: 0,
        maxSlippage: 0,
        minSlippage: 0,
        slippageDistribution: {
          under1pct: 0,
          between1and2pct: 0,
          between2and5pct: 0,
          over5pct: 0
        },
        protectedTransactions: 0,
        protectionSuccessRate: 0
      };

    } catch (error) {
      logger.error({
        timeframe,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get slippage analytics');
      throw error;
    }
  }

  /**
   * Get slippage history for a token pair
   */
  async getSlippageHistory(tokenPair: string, timeframe?: string): Promise<any> {
    logger.debug({ tokenPair, timeframe }, 'Getting slippage history');

    try {
      // This would query historical slippage data
      return {
        tokenPair,
        timeframe: timeframe || '24h',
        data: [],
        averageSlippage: 0,
        volatilityScore: 0
      };

    } catch (error) {
      logger.error({
        tokenPair,
        timeframe,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get slippage history');
      throw error;
    }
  }

  // Private helper methods

  private analyzeLiquidityFactors(quote: SwapQuote): SlippageFactor[] {
    const factors: SlippageFactor[] = [];

    const minLiquidity = Math.min(...quote.pools.map(pool => parseFloat(pool.liquidity)));

    if (minLiquidity < 10000) {
      factors.push({
        name: 'Very Low Liquidity',
        impact: 40,
        severity: 'high',
        description: 'Pool liquidity is extremely low, making trades vulnerable to high slippage'
      });
    } else if (minLiquidity < 50000) {
      factors.push({
        name: 'Low Liquidity',
        impact: 25,
        severity: 'medium',
        description: 'Pool liquidity is low, may experience higher slippage'
      });
    }

    const maxPriceImpact = Math.max(...quote.pools.map(pool => pool.priceImpact));
    if (maxPriceImpact > 2.0) {
      factors.push({
        name: 'High Price Impact',
        impact: 35,
        severity: 'high',
        description: 'Trade size is large relative to pool liquidity'
      });
    } else if (maxPriceImpact > 1.0) {
      factors.push({
        name: 'Moderate Price Impact',
        impact: 20,
        severity: 'medium',
        description: 'Trade may have noticeable impact on price'
      });
    }

    return factors;
  }

  private analyzeMarketFactors(marketConditions: MarketConditions): SlippageFactor[] {
    const factors: SlippageFactor[] = [];

    if (marketConditions.volatility === 'high') {
      factors.push({
        name: 'High Market Volatility',
        impact: 30,
        severity: 'high',
        description: 'Market conditions are volatile, prices may change rapidly'
      });
    } else if (marketConditions.volatility === 'medium') {
      factors.push({
        name: 'Moderate Market Volatility',
        impact: 15,
        severity: 'medium',
        description: 'Market shows moderate volatility'
      });
    }

    if (marketConditions.congestionLevel > 80) {
      factors.push({
        name: 'Network Congestion',
        impact: 25,
        severity: 'high',
        description: 'High network congestion may cause execution delays'
      });
    } else if (marketConditions.congestionLevel > 60) {
      factors.push({
        name: 'Moderate Network Congestion',
        impact: 15,
        severity: 'medium',
        description: 'Network is moderately congested'
      });
    }

    if (marketConditions.gasPriceLevel === 'high') {
      factors.push({
        name: 'High Gas Prices',
        impact: 10,
        severity: 'low',
        description: 'High gas prices indicate network stress'
      });
    }

    return factors;
  }

  private analyzeTradeSizeFactors(quote: SwapQuote): SlippageFactor[] {
    const factors: SlippageFactor[] = [];

    const amountNum = parseFloat(quote.amountIn);

    if (amountNum > 1000000) {
      factors.push({
        name: 'Large Trade Size',
        impact: 20,
        severity: 'medium',
        description: 'Large trades may experience significant slippage'
      });
    } else if (amountNum > 100000) {
      factors.push({
        name: 'Medium Trade Size',
        impact: 10,
        severity: 'low',
        description: 'Medium-sized trade, moderate slippage risk'
      });
    }

    return factors;
  }

  private analyzeTimingFactors(): SlippageFactor[] {
    const factors: SlippageFactor[] = [];

    const hour = new Date().getHours();

    // Check if it's during high volatility hours (would be based on historical data)
    if ((hour >= 8 && hour <= 10) || (hour >= 14 && hour <= 16)) {
      factors.push({
        name: 'High Activity Period',
        impact: 10,
        severity: 'low',
        description: 'Trading during high activity period'
      });
    }

    return factors;
  }

  private calculateRecommendedSlippage(riskScore: number, marketConditions: MarketConditions): number {
    let baseSlippage = this.DEFAULT_SLIPPAGE;

    // Adjust based on risk score
    if (riskScore > 80) {
      baseSlippage *= 2.0;
    } else if (riskScore > 60) {
      baseSlippage *= 1.6;
    } else if (riskScore > 40) {
      baseSlippage *= 1.3;
    } else if (riskScore > 20) {
      baseSlippage *= 1.1;
    }

    // Adjust for market conditions
    if (marketConditions.volatility === 'high') {
      baseSlippage *= 1.4;
    }

    if (marketConditions.congestionLevel > 70) {
      baseSlippage *= 1.2;
    }

    return Math.min(Math.round(baseSlippage), this.MAX_SLIPPAGE);
  }

  private determineRiskLevel(riskScore: number, recommendedSlippage: number): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore > 70 || recommendedSlippage > this.CRITICAL_SLIPPAGE_THRESHOLD) {
      return 'critical';
    } else if (riskScore > 50 || recommendedSlippage > 200) {
      return 'high';
    } else if (riskScore > 25 || recommendedSlippage > 100) {
      return 'medium';
    }
    return 'low';
  }

  private generateProtectionStrategies(riskLevel: 'low' | 'medium' | 'high' | 'critical', factors: SlippageFactor[]): string[] {
    const strategies: string[] = [];

    strategies.push('Set conservative slippage tolerance');

    if (riskLevel === 'high' || riskLevel === 'critical') {
      strategies.push('Consider breaking trade into smaller chunks');
      strategies.push('Use limit orders instead of market orders');
      strategies.push('Monitor market conditions closely');
    }

    if (factors.some(f => f.name.includes('Liquidity'))) {
      strategies.push('Trade during high liquidity periods');
    }

    if (factors.some(f => f.name.includes('Volatility'))) {
      strategies.push('Use dynamic slippage adjustment');
    }

    return strategies;
  }

  private async calculateDynamicSlippage(quote: SwapQuote, marketConditions: MarketConditions, strategy: SlippageProtectionStrategy): Promise<number> {
    let slippage = strategy.baseSlippage;

    // Adjust for volatility
    if (marketConditions.volatility === 'high') {
      slippage *= strategy.volatilityMultiplier;
    } else if (marketConditions.volatility === 'medium') {
      slippage *= (strategy.volatilityMultiplier + 1) / 2;
    }

    // Adjust for congestion
    if (marketConditions.congestionLevel > 70) {
      slippage *= strategy.congestionMultiplier;
    }

    // Apply adjustment factor
    slippage *= (1 + strategy.adjustmentFactor);

    return Math.min(Math.round(slippage), strategy.maxSlippage);
  }
}

// Export singleton instance
export const slippageProtectionService = new SlippageProtectionService();