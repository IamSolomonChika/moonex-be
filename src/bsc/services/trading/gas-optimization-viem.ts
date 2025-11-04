/**
 * BSC Gas Optimization Service - Viem Implementation
 * Advanced gas estimation and optimization specifically for BSC network using Viem
 * Migrated from Ethers.js to Viem for better performance and type safety
 */

import { Address, Hex, parseUnits, formatUnits } from 'viem';
import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';
import logger from '../../../utils/logger.js';
import type {
  GasOptimization,
  SwapQuote
} from '../types/amm-types-viem.js';
import { createViemProvider } from '../../providers/viem-provider.js';
import { BSCCacheManager } from '../cache/cache-manager.js';

/**
 * BSC Gas Market Analysis - Viem Version
 */
export interface BSCGasMarketViem {
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
 * Gas Estimation Result - Viem Version
 */
export interface GasEstimationViem {
  gas: bigint;
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  totalCost: bigint;
  estimatedCostBNB: string;
  estimatedCostUSD: string;
  confidence: number; // 0-100
  optimizationStrategy: string;
  recommendations: string[];
}

/**
 * Transaction Type Gas Requirements - Viem Version
 */
export interface TransactionGasProfileViem {
  type: 'simple_swap' | 'multi_hop_swap' | 'complex_swap' | 'v3_swap' | 'v2_swap';
  baseGasLimit: bigint;
  variableGasFactor: number;
  protocolMultiplier: number;
  networkMultiplier: number;
}

/**
 * Gas Optimization Strategy - Viem Version
 */
export interface GasOptimizationStrategyViem {
  name: string;
  priority: 'speed' | 'cost' | 'balanced';
  targetBlockTime: number; // seconds
  maxWaitTime: number; // seconds
  gasMultiplier: number;
  useEIP1559: boolean;
  dynamicPricing: boolean;
}

/**
 * BSC Gas Optimization Service Interface - Viem Version
 */
export interface IBSCGasOptimizationServiceViem {
  // Gas market analysis
  analyzeGasMarket(): Promise<BSCGasMarketViem>;
  getGasPriceForecast(blocks?: number): Promise<any>;
  getNetworkCongestion(): Promise<number>;

  // Gas estimation
  estimateGasForSwap(quote: SwapQuote, strategy?: GasOptimizationStrategyViem): Promise<GasEstimationViem>;
  estimateGasForTransaction(txData: any, strategy?: GasOptimizationStrategyViem): Promise<GasEstimationViem>;

  // Optimization strategies
  getOptimalStrategy(urgency: 'low' | 'medium' | 'high'): Promise<GasOptimizationStrategyViem>;
  optimizeGasSettings(currentSettings: any, strategy: GasOptimizationStrategyViem): Promise<any>;

  // Historical analysis
  getGasHistory(timeframe?: string): Promise<any>;
  getGasPriceTrends(): Promise<any>;

  // Real-time monitoring
  monitorGasPrices(): Promise<void>;
  getGasPriceAlerts(): Promise<any>;
}

/**
 * BSC Gas Optimization Service Implementation - Viem Version
 */
export class BSCGasOptimizationServiceViem implements IBSCGasOptimizationServiceViem {
  private publicClient: any; // Simplified type for Viem 2.38.5 compatibility
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
  private readonly TX_PROFILES: Map<string, TransactionGasProfileViem> = new Map([
    ['simple_swap', { type: 'simple_swap', baseGasLimit: 150000n, variableGasFactor: 0.1, protocolMultiplier: 1.0, networkMultiplier: 1.0 }],
    ['multi_hop_swap', { type: 'multi_hop_swap', baseGasLimit: 250000n, variableGasFactor: 0.15, protocolMultiplier: 1.2, networkMultiplier: 1.1 }],
    ['complex_swap', { type: 'complex_swap', baseGasLimit: 350000n, variableGasFactor: 0.2, protocolMultiplier: 1.3, networkMultiplier: 1.15 }],
    ['v2_swap', { type: 'v2_swap', baseGasLimit: 180000n, variableGasFactor: 0.12, protocolMultiplier: 1.0, networkMultiplier: 1.0 }],
    ['v3_swap', { type: 'v3_swap', baseGasLimit: 200000n, variableGasFactor: 0.14, protocolMultiplier: 1.1, networkMultiplier: 1.05 }]
  ]);

  constructor() {
    this.publicClient = createViemProvider();
    this.cache = new BSCCacheManager();
  }

  /**
   * Analyze current BSC gas market conditions - Viem Implementation
   */
  async analyzeGasMarket(): Promise<BSCGasMarketViem> {
    logger.debug('Analyzing BSC gas market conditions (Viem)');

    try {
      // Use Viem to get fee data
      const feeData = await this.publicClient.getFeeData();
      const latestBlock = await this.publicClient.getBlock('latest');

      // Get pending block for transaction count
      let pendingTransactions = 0;
      try {
        const pendingBlock = await this.publicClient.getBlock({ blockTag: 'pending' });
        pendingTransactions = pendingBlock.transactions.length;
      } catch (error) {
        logger.debug('Could not fetch pending block', error);
        pendingTransactions = 100; // Fallback value
      }

      // Get current gas prices using Viem
      const gasPrice = feeData.gasPrice || parseUnits('10', 'gwei');
      const baseFee = feeData.maxFeePerGas && feeData.maxPriorityFeePerGas
        ? feeData.maxFeePerGas - feeData.maxPriorityFeePerGas
        : gasPrice;
      const priorityFee = feeData.maxPriorityFeePerGas || parseUnits('2', 'gwei');
      const maxFeePerGas = feeData.maxFeePerGas || gasPrice;

      // Calculate network congestion
      const blockUtilization = latestBlock ? (Number(latestBlock.gasUsed) / Number(latestBlock.gasLimit)) * 100 : 0;
      const gasPriceGwei = parseFloat(formatUnits(gasPrice, 'gwei'));

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

      const gasMarket: BSCGasMarketViem = {
        currentGasPrice: gasPrice.toString(),
        baseFee: baseFee.toString(),
        priorityFee: priorityFee.toString(),
        maxFeePerGas: maxFeePerGas.toString(),
        gasPriceGwei,
        networkCongestion,
        blockTime: this.BSC_MAINNET.BLOCK_TIME,
        blockUtilization,
        pendingTransactions,
        nextBlockBaseFee: nextBlockBaseFee.toString()
      };

      // Cache for 30 seconds
      await this.cache.set('gas_market', gasMarket, 30000);

      return gasMarket;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to analyze gas market (Viem)');

      // Return fallback values
      return {
        currentGasPrice: parseUnits('10', 'gwei').toString(),
        baseFee: parseUnits('8', 'gwei').toString(),
        priorityFee: parseUnits('2', 'gwei').toString(),
        maxFeePerGas: parseUnits('12', 'gwei').toString(),
        gasPriceGwei: 10,
        networkCongestion: 'medium',
        blockTime: this.BSC_MAINNET.BLOCK_TIME,
        blockUtilization: 50,
        pendingTransactions: 100,
        nextBlockBaseFee: parseUnits('8.2', 'gwei').toString()
      };
    }
  }

  /**
   * Get gas price forecast for future blocks - Viem Implementation
   */
  async getGasPriceForecast(blocks: number = 10): Promise<any> {
    logger.debug({ blocks }, 'Getting gas price forecast (Viem)');

    try {
      // This would use historical data and prediction models
      // For now, return a simple forecast based on current conditions
      const gasMarket = await this.analyzeGasMarket();
      const forecast = [];

      const currentBlockNumber = await this.publicClient.getBlockNumber();

      for (let i = 1; i <= blocks; i++) {
        const projectedGasPrice = parseFloat(gasMarket.currentGasPrice) * (1 + (i * 0.02)); // 2% increase per block
        const projectedCongestion = this.projectCongestion(gasMarket.networkCongestion, i);

        forecast.push({
          blockNumber: Number(currentBlockNumber) + i,
          estimatedGasPrice: projectedGasPrice.toString(),
          estimatedCongestion: projectedCongestion,
          estimatedWaitTime: i * this.BSC_MAINNET.BLOCK_TIME
        });
      }

      return forecast;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get gas price forecast (Viem)');
      throw error;
    }
  }

  /**
   * Get current network congestion level - Viem Implementation
   */
  async getNetworkCongestion(): Promise<number> {
    try {
      const gasMarket = await this.analyzeGasMarket();
      return gasMarket.blockUtilization;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get network congestion (Viem)');
      return 50; // Default to 50%
    }
  }

  /**
   * Estimate gas for a swap transaction - Viem Implementation
   */
  async estimateGasForSwap(quote: SwapQuote, strategy?: GasOptimizationStrategyViem): Promise<GasEstimationViem> {
    logger.debug({
      tokenIn: quote.tokenIn.address,
      tokenOut: quote.tokenOut.address,
      protocol: quote.route[0]?.protocol
    }, 'Estimating gas for swap (Viem)');

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
      gasLimit += gasLimit * BigInt(Math.floor(profile.variableGasFactor * tradeComplexity * 100)) / BigInt(100);

      // Apply protocol and network multipliers
      gasLimit = gasLimit * BigInt(Math.floor(profile.protocolMultiplier * 100)) / BigInt(100);
      gasLimit = gasLimit * BigInt(Math.floor(profile.networkMultiplier * 100)) / BigInt(100);

      // Add buffer for safety
      gasLimit = gasLimit * BigInt(110) / BigInt(100);

      // Round up to nearest 1000
      gasLimit = ((gasLimit + 999n) / 1000n) * 1000n;

      // Calculate gas prices based on strategy
      const gasPrices = this.calculateGasPrices(gasMarket, selectedStrategy);

      // Calculate costs using Viem bigint arithmetic
      const totalCost = gasLimit * BigInt(gasPrices.gasPrice);
      const estimatedCostBNB = totalCost.toString();
      const estimatedCostUSD = this.calculateCostUSD(estimatedCostBNB);

      // Generate recommendations
      const recommendations = this.generateGasRecommendations(gasMarket, selectedStrategy, Number(gasLimit));

      // Calculate confidence level
      const confidence = this.calculateConfidence(gasMarket, selectedStrategy);

      const estimation: GasEstimationViem = {
        gas: gasLimit,
        gasLimit: gasLimit.toString(),
        gasPrice: gasPrices.gasPrice,
        maxFeePerGas: gasPrices.maxFeePerGas,
        maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
        totalCost,
        estimatedCostBNB,
        estimatedCostUSD,
        confidence,
        optimizationStrategy: selectedStrategy.name,
        recommendations
      };

      logger.info({
        gasLimit: estimation.gasLimit,
        gasPriceGwei: parseFloat(formatUnits(BigInt(estimation.gasPrice), 'gwei')),
        estimatedCostBNB,
        strategy: selectedStrategy.name
      }, 'Gas estimation completed (Viem)');

      return estimation;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to estimate gas for swap (Viem)');
      throw error;
    }
  }

  /**
   * Estimate gas for a generic transaction - Viem Implementation
   */
  async estimateGasForTransaction(txData: any, strategy?: GasOptimizationStrategyViem): Promise<GasEstimationViem> {
    logger.debug('Estimating gas for transaction (Viem)');

    try {
      const gasMarket = await this.analyzeGasMarket();
      const selectedStrategy = strategy || await this.getOptimalStrategy('medium');

      // Basic gas estimation
      let gasLimit = 21000n; // Base ETH transfer

      // Add complexity based on transaction data
      if (txData.data) {
        const dataLength = (txData.data as string).replace('0x', '').length / 2;
        gasLimit += BigInt(Math.ceil(dataLength * 16)); // 16 gas per byte of data
      }

      // Use Viem for more accurate estimation if possible
      try {
        const estimatedGas = await this.publicClient.estimateGas({
          to: txData.to as Address,
          data: txData.data as Hex,
          value: txData.value ? BigInt(txData.value) : 0n,
          account: txData.from as Address,
        } as any);
        gasLimit = estimatedGas;
      } catch (error) {
        logger.debug({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Viem gas estimation failed, using fallback');
      }

      // Add buffer
      gasLimit = gasLimit * BigInt(120) / BigInt(100);

      // Calculate gas prices
      const gasPrices = this.calculateGasPrices(gasMarket, selectedStrategy);

      // Calculate costs
      const totalCost = gasLimit * BigInt(gasPrices.gasPrice);
      const estimatedCostBNB = totalCost.toString();
      const estimatedCostUSD = this.calculateCostUSD(estimatedCostBNB);

      const estimation: GasEstimationViem = {
        gas: gasLimit,
        gasLimit: gasLimit.toString(),
        gasPrice: gasPrices.gasPrice,
        maxFeePerGas: gasPrices.maxFeePerGas,
        maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
        totalCost,
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
      }, 'Failed to estimate gas for transaction (Viem)');
      throw error;
    }
  }

  /**
   * Get optimal gas strategy based on urgency - Viem Implementation
   */
  async getOptimalStrategy(urgency: 'low' | 'medium' | 'high'): Promise<GasOptimizationStrategyViem> {
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
   * Optimize gas settings based on strategy - Viem Implementation
   */
  async optimizeGasSettings(currentSettings: any, strategy: GasOptimizationStrategyViem): Promise<any> {
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
   * Get gas price history - Viem Implementation
   */
  async getGasHistory(timeframe?: string): Promise<any> {
    logger.debug({ timeframe }, 'Getting gas price history (Viem)');

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
      }, 'Failed to get gas history (Viem)');
      throw error;
    }
  }

  /**
   * Get gas price trends - Viem Implementation
   */
  async getGasPriceTrends(): Promise<any> {
    logger.debug('Getting gas price trends (Viem)');

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
      }, 'Failed to get gas price trends (Viem)');
      throw error;
    }
  }

  /**
   * Monitor gas prices in real-time - Viem Implementation
   */
  async monitorGasPrices(): Promise<void> {
    logger.debug('Starting gas price monitoring (Viem)');

    const monitor = async () => {
      try {
        const gasMarket = await this.analyzeGasMarket();

        // Check for alerts
        if (gasMarket.gasPriceGwei > this.GAS_THRESHOLDS.CRITICAL) {
          logger.warn({
            gasPrice: gasMarket.gasPriceGwei,
            congestion: gasMarket.networkCongestion
          }, 'Critical gas price detected (Viem)');
        }

        // Store in cache for monitoring
        await this.cache.set('gas_price_monitor', {
          timestamp: Date.now(),
          gasPrice: gasMarket.gasPriceGwei,
          congestion: gasMarket.networkCongestion
        }, 60000); // 1 minute

      } catch (error) {
        logger.debug({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Gas monitoring error (Viem)');
      }
    };

    // Monitor every 30 seconds
    if (typeof setInterval !== 'undefined') {
      setInterval(monitor, 30000);
    }
    monitor(); // Initial call
  }

  /**
   * Get gas price alerts - Viem Implementation
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
      }, 'Failed to get gas price alerts (Viem)');
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

  private calculateGasPrices(gasMarket: BSCGasMarketViem, strategy: GasOptimizationStrategyViem): {
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

  private calculateOptimalMaxFee(gasMarket: BSCGasMarketViem, strategy: GasOptimizationStrategyViem): string {
    const baseFee = BigInt(gasMarket.baseFee);
    const priorityFee = BigInt(gasMarket.priorityFee);
    const multiplier = BigInt(Math.floor(strategy.gasMultiplier * 100)) / BigInt(100);

    return (baseFee + priorityFee) * multiplier;
  }

  private calculateOptimalPriorityFee(gasMarket: BSCGasMarketViem, strategy: GasOptimizationStrategyViem): string {
    const basePriorityFee = BigInt(gasMarket.priorityFee);
    const multiplier = BigInt(Math.floor(strategy.gasMultiplier * 100)) / BigInt(100);

    return basePriorityFee * multiplier;
  }

  private calculateOptimalGasPrice(gasMarket: BSCGasMarketViem, strategy: GasOptimizationStrategyViem): string {
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

  private generateGasRecommendations(gasMarket: BSCGasMarketViem, strategy: GasOptimizationStrategyViem, gasLimit: number): string[] {
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

  private calculateConfidence(gasMarket: BSCGasMarketViem, strategy: GasOptimizationStrategyViem): number {
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
export const bscGasOptimizationServiceViem = new BSCGasOptimizationServiceViem();