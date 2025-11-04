/**
 * BSC Gas Optimization Service
 * Advanced gas estimation and optimization specifically for BSC network
 */

import { ethers } from 'ethers';
import logger from '../../../utils/logger.js';
import type {
  GasOptimization,
  SwapQuote
} from './types.js';
import { BSCProviderManager } from '../../utils/ethers-provider.js';
import { BSCCacheManager } from '../cache/cache-manager.js';

/**
 * BSC Gas Market Analysis
 */
export interface BSCGasMarket {
  currentGasPrice: string;
  baseFee: string;
  priorityFee: string;
  maxFeePerGas: string;
  gasPriceGwei: number;
  networkCongestion: 'low' | 'medium' | 'high' | 'critical';
  blockTime: number;
  blockUtilization: number;
  pendingTransactions: number;
  nextBlockBaseFee: string;
}

/**
 * Gas Estimation Result
 */
export interface GasEstimation {
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  estimatedCostBNB: string;
  estimatedCostUSD: string;
  confidence: number; // 0-100
  optimizationStrategy: string;
  recommendations: string[];
}

/**
 * Transaction Type Gas Requirements
 */
export interface TransactionGasProfile {
  type: 'simple_swap' | 'multi_hop_swap' | 'complex_swap' | 'v3_swap' | 'v2_swap';
  baseGasLimit: number;
  variableGasFactor: number;
  protocolMultiplier: number;
  networkMultiplier: number;
}

/**
 * Gas Optimization Strategy
 */
export interface GasOptimizationStrategy {
  name: string;
  priority: 'speed' | 'cost' | 'balanced';
  targetBlockTime: number; // seconds
  maxWaitTime: number; // seconds
  gasMultiplier: number;
  useEIP1559: boolean;
  dynamicPricing: boolean;
}

/**
 * BSC Gas Optimization Service Interface
 */
export interface IBSCGasOptimizationService {
  // Gas market analysis
  analyzeGasMarket(): Promise<BSCGasMarket>;
  getGasPriceForecast(blocks?: number): Promise<any>;
  getNetworkCongestion(): Promise<number>;

  // Gas estimation
  estimateGasForSwap(quote: SwapQuote, strategy?: GasOptimizationStrategy): Promise<GasEstimation>;
  estimateGasForTransaction(txData: any, strategy?: GasOptimizationStrategy): Promise<GasEstimation>;

  // Optimization strategies
  getOptimalStrategy(urgency: 'low' | 'medium' | 'high'): Promise<GasOptimizationStrategy>;
  optimizeGasSettings(currentSettings: any, strategy: GasOptimizationStrategy): Promise<any>;

  // Historical analysis
  getGasHistory(timeframe?: string): Promise<any>;
  getGasPriceTrends(): Promise<any>;

  // Real-time monitoring
  monitorGasPrices(): Promise<void>;
  getGasPriceAlerts(): Promise<any>;
}

/**
 * BSC Gas Optimization Service Implementation
 */
export class BSCGasOptimizationService implements IBSCGasOptimizationService {
  private provider: BSCProviderManager;
  private cache: BSCCacheManager;

  // BSC-specific constants
  private readonly BSC_MAINNET = {
    CHAIN_ID: 56,
    BLOCK_TIME: 3, // 3 seconds average
    BASE_FEE_BURNING: true,
    EIP1559_SUPPORTED: true
  };

  // Gas price thresholds (gwei)
  private readonly GAS_THRESHOLDS = {
    LOW: 5,      // 5 gwei
    MEDIUM: 15,   // 15 gwei
    HIGH: 30,     // 30 gwei
    CRITICAL: 50  // 50 gwei
  };

  // Transaction type profiles
  private readonly TX_PROFILES: Map<string, TransactionGasProfile> = new Map([
    ['simple_swap', { type: 'simple_swap', baseGasLimit: 150000, variableGasFactor: 0.1, protocolMultiplier: 1.0, networkMultiplier: 1.0 }],
    ['multi_hop_swap', { type: 'multi_hop_swap', baseGasLimit: 250000, variableGasFactor: 0.15, protocolMultiplier: 1.2, networkMultiplier: 1.1 }],
    ['complex_swap', { type: 'complex_swap', baseGasLimit: 350000, variableGasFactor: 0.2, protocolMultiplier: 1.3, networkMultiplier: 1.15 }],
    ['v2_swap', { type: 'v2_swap', baseGasLimit: 180000, variableGasFactor: 0.12, protocolMultiplier: 1.0, networkMultiplier: 1.0 }],
    ['v3_swap', { type: 'v3_swap', baseGasLimit: 200000, variableGasFactor: 0.14, protocolMultiplier: 1.1, networkMultiplier: 1.05 }]
  ]);

  constructor() {
    this.provider = new BSCProviderManager();
    this.cache = new BSCCacheManager();
  }

  /**
   * Analyze current BSC gas market conditions
   */
  async analyzeGasMarket(): Promise<BSCGasMarket> {
    logger.debug('Analyzing BSC gas market conditions');

    try {
      const provider = await this.provider.getProvider();
      const feeData = await provider.getFeeData();
      const latestBlock = await provider.getBlock('latest');
      const pendingBlock = await provider.send('eth_getBlockByNumber', ['pending', false]);

      // Get current gas prices
      const gasPrice = feeData.gasPrice || ethers.parseUnits('10', 'gwei');
      const baseFee = feeData.maxFeePerGas ? feeData.maxFeePerGas - (feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei')) : gasPrice;
      const priorityFee = feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei');
      const maxFeePerGas = feeData.maxFeePerGas || gasPrice;

      // Calculate network congestion
      const blockUtilization = latestBlock ? (latestBlock.gasUsed / latestBlock.gasLimit) * 100 : 0;
      const gasPriceGwei = parseFloat(ethers.formatUnits(gasPrice, 'gwei'));

      // Determine congestion level
      let networkCongestion: 'low' | 'medium' | 'high' | 'critical';
      if (gasPriceGwei >= this.GAS_THRESHOLDS.CRITICAL) {
        networkCongestion = 'critical';
      } else if (gasPriceGwei >= this.GAS_THRESHOLDS.HIGH) {
        networkCongestion = 'high';
      } else if (gasPriceGwei >= this.GAS_THRESHOLDS.MEDIUM) {
        networkCongestion = 'medium';
      } else {
        networkCongestion = 'low';
      }

      // Calculate next block base fee (EIP1559)
      const nextBlockBaseFee = this.calculateNextBlockBaseFee(blockUtilization, baseFee);

      const gasMarket: BSCGasMarket = {
        currentGasPrice: gasPrice.toString(),
        baseFee: baseFee.toString(),
        priorityFee: priorityFee.toString(),
        maxFeePerGas: maxFeePerGas.toString(),
        gasPriceGwei,
        networkCongestion,
        blockTime: this.BSC_MAINNET.BLOCK_TIME,
        blockUtilization,
        pendingTransactions: pendingBlock.transactions.length,
        nextBlockBaseFee: nextBlockBaseFee.toString()
      };

      // Cache for 30 seconds
      await this.cache.set('gas_market', gasMarket, 30000);

      return gasMarket;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to analyze gas market');

      // Return fallback values
      return {
        currentGasPrice: ethers.parseUnits('10', 'gwei').toString(),
        baseFee: ethers.parseUnits('8', 'gwei').toString(),
        priorityFee: ethers.parseUnits('2', 'gwei').toString(),
        maxFeePerGas: ethers.parseUnits('12', 'gwei').toString(),
        gasPriceGwei: 10,
        networkCongestion: 'medium',
        blockTime: this.BSC_MAINNET.BLOCK_TIME,
        blockUtilization: 50,
        pendingTransactions: 100,
        nextBlockBaseFee: ethers.parseUnits('8.2', 'gwei').toString()
      };
    }
  }

  /**
   * Get gas price forecast for future blocks
   */
  async getGasPriceForecast(blocks: number = 10): Promise<any> {
    logger.debug({ blocks }, 'Getting gas price forecast');

    try {
      // This would use historical data and prediction models
      // For now, return a simple forecast based on current conditions
      const gasMarket = await this.analyzeGasMarket();
      const forecast = [];

      for (let i = 1; i <= blocks; i++) {
        const projectedGasPrice = parseFloat(gasMarket.currentGasPrice) * (1 + (i * 0.02)); // 2% increase per block
        const projectedCongestion = this.projectCongestion(gasMarket.networkCongestion, i);

        forecast.push({
          blockNumber: (await this.provider.getProvider()).getBlockNumber() + i,
          estimatedGasPrice: projectedGasPrice.toString(),
          estimatedCongestion: projectedCongestion,
          estimatedWaitTime: i * this.BSC_MAINNET.BLOCK_TIME
        });
      }

      return forecast;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get gas price forecast');
      throw error;
    }
  }

  /**
   * Get current network congestion level
   */
  async getNetworkCongestion(): Promise<number> {
    try {
      const gasMarket = await this.analyzeGasMarket();
      return gasMarket.blockUtilization;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get network congestion');
      return 50; // Default to 50%
    }
  }

  /**
   * Estimate gas for a swap transaction
   */
  async estimateGasForSwap(quote: SwapQuote, strategy?: GasOptimizationStrategy): Promise<GasEstimation> {
    logger.debug({
      tokenIn: quote.tokenIn.address,
      tokenOut: quote.tokenOut.address,
      protocol: quote.route[0]?.protocol
    }, 'Estimating gas for swap');

    try {
      const gasMarket = await this.analyzeGasMarket();
      const selectedStrategy = strategy || await this.getOptimalStrategy('medium');

      // Determine transaction type and get profile
      const txType = this.determineTransactionType(quote);
      const profile = this.TX_PROFILES.get(txType);

      if (!profile) {
        throw new Error(`Unknown transaction type: ${txType}`);
      }

      // Calculate base gas limit
      let gasLimit = profile.baseGasLimit;

      // Add variable gas based on trade complexity
      const tradeComplexity = this.calculateTradeComplexity(quote);
      gasLimit += gasLimit * (profile.variableGasFactor * tradeComplexity);

      // Apply protocol and network multipliers
      gasLimit *= profile.protocolMultiplier;
      gasLimit *= profile.networkMultiplier;

      // Add buffer for safety
      gasLimit *= 1.1;

      // Round up to nearest 1000
      gasLimit = Math.ceil(gasLimit / 1000) * 1000;

      // Calculate gas prices based on strategy
      const gasPrices = this.calculateGasPrices(gasMarket, selectedStrategy);

      // Calculate costs
      const estimatedCostBNB = (BigInt(gasLimit) * BigInt(gasPrices.gasPrice)).toString();
      const estimatedCostUSD = this.calculateCostUSD(estimatedCostBNB);

      // Generate recommendations
      const recommendations = this.generateGasRecommendations(gasMarket, selectedStrategy, gasLimit);

      // Calculate confidence level
      const confidence = this.calculateConfidence(gasMarket, selectedStrategy);

      const estimation: GasEstimation = {
        gasLimit: gasLimit.toString(),
        gasPrice: gasPrices.gasPrice,
        maxFeePerGas: gasPrices.maxFeePerGas,
        maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
        estimatedCostBNB,
        estimatedCostUSD,
        confidence,
        optimizationStrategy: selectedStrategy.name,
        recommendations
      };

      logger.info({
        gasLimit: estimation.gasLimit,
        gasPriceGwei: parseFloat(ethers.formatUnits(estimation.gasPrice, 'gwei')),
        estimatedCostBNB,
        strategy: selectedStrategy.name
      }, 'Gas estimation completed');

      return estimation;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to estimate gas for swap');
      throw error;
    }
  }

  /**
   * Estimate gas for a generic transaction
   */
  async estimateGasForTransaction(txData: any, strategy?: GasOptimizationStrategy): Promise<GasEstimation> {
    logger.debug('Estimating gas for transaction');

    try {
      const provider = await this.provider.getProvider();
      const gasMarket = await this.analyzeGasMarket();
      const selectedStrategy = strategy || await this.getOptimalStrategy('medium');

      // Basic gas estimation
      let gasLimit = 21000; // Base ETH transfer

      // Add complexity based on transaction data
      if (txData.data) {
        gasLimit += txData.data.length * 16; // 16 gas per byte of data
      }

      // Use provider for more accurate estimation if possible
      try {
        const estimatedGas = await provider.estimateGas({
          to: txData.to,
          data: txData.data,
          value: txData.value || '0x0'
        });
        gasLimit = Number(estimatedGas);
      } catch (error) {
        logger.debug({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Provider gas estimation failed, using fallback');
      }

      // Add buffer
      gasLimit = Math.ceil(gasLimit * 1.2);

      // Calculate gas prices
      const gasPrices = this.calculateGasPrices(gasMarket, selectedStrategy);

      // Calculate costs
      const estimatedCostBNB = (BigInt(gasLimit) * BigInt(gasPrices.gasPrice)).toString();
      const estimatedCostUSD = this.calculateCostUSD(estimatedCostBNB);

      const estimation: GasEstimation = {
        gasLimit: gasLimit.toString(),
        gasPrice: gasPrices.gasPrice,
        maxFeePerGas: gasPrices.maxFeePerGas,
        maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
        estimatedCostBNB,
        estimatedCostUSD,
        confidence: 85,
        optimizationStrategy: selectedStrategy.name,
        recommendations: ['Consider using EIP1559 for better cost control']
      };

      return estimation;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to estimate gas for transaction');
      throw error;
    }
  }

  /**
   * Get optimal gas strategy based on urgency
   */
  async getOptimalStrategy(urgency: 'low' | 'medium' | 'high'): Promise<GasOptimizationStrategy> {
    const gasMarket = await this.analyzeGasMarket();

    switch (urgency) {
      case 'high':
        return {
          name: 'urgent',
          priority: 'speed',
          targetBlockTime: 1,
          maxWaitTime: 6,
          gasMultiplier: 1.5,
          useEIP1559: this.BSC_MAINNET.EIP1559_SUPPORTED,
          dynamicPricing: true
        };

      case 'medium':
        return {
          name: 'balanced',
          priority: 'balanced',
          targetBlockTime: 2,
          maxWaitTime: 10,
          gasMultiplier: 1.2,
          useEIP1559: this.BSC_MAINNET.EIP1559_SUPPORTED,
          dynamicPricing: true
        };

      case 'low':
      default:
        return {
          name: 'economy',
          priority: 'cost',
          targetBlockTime: 3,
          maxWaitTime: 15,
          gasMultiplier: 1.0,
          useEIP1559: this.BSC_MAINNET.EIP1559_SUPPORTED,
          dynamicPricing: true
        };
    }
  }

  /**
   * Optimize gas settings based on strategy
   */
  async optimizeGasSettings(currentSettings: any, strategy: GasOptimizationStrategy): Promise<any> {
    const gasMarket = await this.analyzeGasMarket();
    const optimizedSettings = { ...currentSettings };

    if (strategy.useEIP1559 && this.BSC_MAINNET.EIP1559_SUPPORTED) {
      // Use EIP1559 pricing
      optimizedSettings.maxFeePerGas = this.calculateOptimalMaxFee(gasMarket, strategy);
      optimizedSettings.maxPriorityFeePerGas = this.calculateOptimalPriorityFee(gasMarket, strategy);
    } else {
      // Use legacy gas pricing
      optimizedSettings.gasPrice = this.calculateOptimalGasPrice(gasMarket, strategy);
    }

    return optimizedSettings;
  }

  /**
   * Get gas price history
   */
  async getGasHistory(timeframe?: string): Promise<any> {
    logger.debug({ timeframe }, 'Getting gas price history');

    try {
      // This would query historical gas price data
      return {
        timeframe: timeframe || '24h',
        data: [],
        averageGasPrice: 0,
        minGasPrice: 0,
        maxGasPrice: 0,
        volatility: 0
      };

    } catch (error) {
      logger.error({
        timeframe,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get gas history');
      throw error;
    }
  }

  /**
   * Get gas price trends
   */
  async getGasPriceTrends(): Promise<any> {
    logger.debug('Getting gas price trends');

    try {
      const gasMarket = await this.analyzeGasMarket();
      const history = await this.getGasHistory('1h');

      return {
        currentGasPrice: gasMarket.gasPriceGwei,
        trend: 'stable', // Would calculate based on historical data
        direction: 'neutral',
        change24h: 0,
        volatility: 'low',
        forecast: await this.getGasPriceForecast(5)
      };

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get gas price trends');
      throw error;
    }
  }

  /**
   * Monitor gas prices in real-time
   */
  async monitorGasPrices(): Promise<void> {
    logger.debug('Starting gas price monitoring');

    const monitor = async () => {
      try {
        const gasMarket = await this.analyzeGasMarket();

        // Check for alerts
        if (gasMarket.gasPriceGwei > this.GAS_THRESHOLDS.CRITICAL) {
          logger.warn({
            gasPrice: gasMarket.gasPriceGwei,
            congestion: gasMarket.networkCongestion
          }, 'Critical gas price detected');
        }

        // Store in cache for monitoring
        await this.cache.set('gas_price_monitor', {
          timestamp: Date.now(),
          gasPrice: gasMarket.gasPriceGwei,
          congestion: gasMarket.networkCongestion
        }, 60000); // 1 minute

      } catch (error) {
        logger.debug({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Gas monitoring error');
      }
    };

    // Monitor every 30 seconds
    setInterval(monitor, 30000);
    monitor(); // Initial call
  }

  /**
   * Get gas price alerts
   */
  async getGasPriceAlerts(): Promise<any> {
    try {
      const gasMarket = await this.analyzeGasMarket();
      const alerts = [];

      if (gasMarket.gasPriceGwei > this.GAS_THRESHOLDS.CRITICAL) {
        alerts.push({
          type: 'critical',
          message: `Critical gas price: ${gasMarket.gasPriceGwei} gwei`,
          recommendation: 'Consider waiting for gas prices to decrease'
        });
      }

      if (gasMarket.networkCongestion === 'critical') {
        alerts.push({
          type: 'congestion',
          message: 'Network is critically congested',
          recommendation: 'Consider using premium gas strategy'
        });
      }

      return alerts;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get gas price alerts');
      return [];
    }
  }

  // Private helper methods

  private calculateNextBlockBaseFee(blockUtilization: number, currentBaseFee: bigint): bigint {
    // BSC EIP1559 base fee calculation
    const targetUtilization = 50; // 50% target
    const maxChangeDenominator = 8; // From EIP-1559
    const baseFeePerGasDelta = currentBaseFee * BigInt(Math.floor(blockUtilization - targetUtilization)) / BigInt(maxChangeDenominator * 100);

    return currentBaseFee + baseFeePerGasDelta;
  }

  private projectCongestion(currentCongestion: 'low' | 'medium' | 'high' | 'critical', blocksAhead: number): 'low' | 'medium' | 'high' | 'critical' {
    // Simple congestion projection - would be more sophisticated in production
    const congestionValues = { low: 25, medium: 50, high: 75, critical: 95 };
    const currentValue = congestionValues[currentCongestion];
    const projectedValue = Math.min(100, currentValue + (blocksAhead * 2)); // Increase by 2% per block

    if (projectedValue > 85) return 'critical';
    if (projectedValue > 65) return 'high';
    if (projectedValue > 35) return 'medium';
    return 'low';
  }

  private determineTransactionType(quote: SwapQuote): string {
    const protocol = quote.route[0]?.protocol || 'v2';
    const hopCount = quote.path.length - 1;

    if (protocol === 'v3') {
      return 'v3_swap';
    } else if (protocol === 'v2') {
      return 'v2_swap';
    } else if (hopCount > 2) {
      return 'multi_hop_swap';
    } else if (quote.route.length > 1) {
      return 'complex_swap';
    } else {
      return 'simple_swap';
    }
  }

  private calculateTradeComplexity(quote: SwapQuote): number {
    let complexity = 1.0;

    // Adjust for hop count
    const hopCount = quote.path.length - 1;
    complexity += hopCount * 0.2;

    // Adjust for price impact
    complexity += quote.priceImpact * 0.1;

    // Adjust for warnings
    complexity += quote.warnings.length * 0.15;

    return Math.min(complexity, 3.0); // Cap at 3x complexity
  }

  private calculateGasPrices(gasMarket: BSCGasMarket, strategy: GasOptimizationStrategy): {
    gasPrice: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
  } {
    const baseGasPrice = BigInt(gasMarket.currentGasPrice);
    const multiplier = BigInt(Math.floor(strategy.gasMultiplier * 100)) / BigInt(100);

    const adjustedGasPrice = baseGasPrice * multiplier;

    if (strategy.useEIP1559 && this.BSC_MAINNET.EIP1559_SUPPORTED) {
      const priorityFee = baseGasPrice * BigInt(20) / BigInt(100); // 20% of base fee
      const maxFee = adjustedGasPrice + priorityFee;

      return {
        gasPrice: adjustedGasPrice.toString(),
        maxFeePerGas: maxFee.toString(),
        maxPriorityFeePerGas: priorityFee.toString()
      };
    } else {
      return {
        gasPrice: adjustedGasPrice.toString(),
        maxFeePerGas: adjustedGasPrice.toString(),
        maxPriorityFeePerGas: '0'
      };
    }
  }

  private calculateOptimalMaxFee(gasMarket: BSCGasMarket, strategy: GasOptimizationStrategy): string {
    const baseFee = BigInt(gasMarket.baseFee);
    const priorityFee = BigInt(gasMarket.priorityFee);
    const multiplier = BigInt(Math.floor(strategy.gasMultiplier * 100)) / BigInt(100);

    return (baseFee + priorityFee) * multiplier;
  }

  private calculateOptimalPriorityFee(gasMarket: BSCGasMarket, strategy: GasOptimizationStrategy): string {
    const basePriorityFee = BigInt(gasMarket.priorityFee);
    const multiplier = BigInt(Math.floor(strategy.gasMultiplier * 100)) / BigInt(100);

    return basePriorityFee * multiplier;
  }

  private calculateOptimalGasPrice(gasMarket: BSCGasMarket, strategy: GasOptimizationStrategy): string {
    const baseGasPrice = BigInt(gasMarket.currentGasPrice);
    const multiplier = BigInt(Math.floor(strategy.gasMultiplier * 100)) / BigInt(100);

    return baseGasPrice * multiplier;
  }

  private calculateCostUSD(costBNB: string): string {
    // This would fetch current BNB price from price oracle
    const bnbPriceUSD = 300; // Placeholder
    const costBNBNum = parseFloat(costBNB) / 1e18;
    return (costBNBNum * bnbPriceUSD).toFixed(2);
  }

  private generateGasRecommendations(gasMarket: BSCGasMarket, strategy: GasOptimizationStrategy, gasLimit: number): string[] {
    const recommendations: string[] = [];

    if (gasMarket.networkCongestion === 'critical') {
      recommendations.push('Consider waiting for network congestion to decrease');
    }

    if (gasMarket.gasPriceGwei > this.GAS_THRESHOLDS.HIGH) {
      recommendations.push('Gas prices are high, consider using economy strategy');
    }

    if (gasLimit > 300000) {
      recommendations.push('Large transaction detected, consider breaking into smaller transactions');
    }

    if (!strategy.useEIP1559 && this.BSC_MAINNET.EIP1559_SUPPORTED) {
      recommendations.push('Consider using EIP1559 for better gas price control');
    }

    return recommendations;
  }

  private calculateConfidence(gasMarket: BSCGasMarket, strategy: GasOptimizationStrategy): number {
    let confidence = 85; // Base confidence

    // Adjust based on network conditions
    if (gasMarket.networkCongestion === 'critical') {
      confidence -= 20;
    } else if (gasMarket.networkCongestion === 'high') {
      confidence -= 10;
    }

    // Adjust based on strategy
    if (strategy.dynamicPricing) {
      confidence += 10;
    }

    return Math.max(0, Math.min(100, confidence));
  }
}

// Export singleton instance
export const bscGasOptimizationService = new BSCGasOptimizationService();