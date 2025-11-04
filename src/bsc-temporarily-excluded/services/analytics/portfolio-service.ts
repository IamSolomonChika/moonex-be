import { Logger } from '../../../utils/logger.js';
import { ICache } from '../../../services/cache.service.js';
import { BscTokenService } from '../tokens/token-service.js';
import { BscTradingService } from '../trading/trading-service.js';
import { BscLiquidityService } from '../liquidity/liquidity-service.js';
import { BscYieldService } from '../yield/yield-service.js';
import { BscAnalyticsService } from './analytics-service.js';
import { PancakeSwapSubgraphClient } from '../pancakeswap/subgraph-client.js';

const logger = new Logger('PortfolioService');

// Portfolio types and interfaces
export interface AssetHolding {
  tokenAddress: string;
  symbol: string;
  decimals: number;
  balance: string;
  valueUSD: number;
  priceChange24h: number;
  percentageOfPortfolio: number;
  lastUpdated: number;
}

export interface LiquidityPosition {
  poolAddress: string;
  token0Symbol: string;
  token1Symbol: string;
  token0Amount: string;
  token1Amount: string;
  lpTokenBalance: string;
  valueUSD: number;
  impermanentLoss: number;
  feesEarned: number;
  apr: number;
  percentageOfPortfolio: number;
  lastUpdated: number;
}

export interface YieldPosition {
  farmAddress: string;
  poolAddress: string;
  token0Symbol: string;
  token1Symbol: string;
  stakedAmount: string;
  valueUSD: number;
  pendingRewards: {
    token: string;
    amount: string;
    valueUSD: number;
  }[];
  apr: number;
  apy: number;
  percentageOfPortfolio: number;
  lastUpdated: number;
}

export interface TransactionHistory {
  hash: string;
  type: 'swap' | 'add_liquidity' | 'remove_liquidity' | 'farm_deposit' | 'farm_withdraw' | 'farm_harvest';
  timestamp: number;
  status: 'success' | 'failed' | 'pending';
  tokenIn?: {
    address: string;
    symbol: string;
    amount: string;
    valueUSD: number;
  };
  tokenOut?: {
    address: string;
    symbol: string;
    amount: string;
    valueUSD: number;
  };
  gasUsed: string;
  gasPrice: string;
  valueUSD: number;
  feeUSD: number;
}

export interface PortfolioMetrics {
  totalValueUSD: number;
  totalValueChange24h: number;
  totalValueChange24hPercent: number;
  totalValueChange7d: number;
  totalValueChange7dPercent: number;
  totalValueChange30d: number;
  totalValueChange30dPercent: number;
  assetAllocation: {
    tokens: number;
    liquidity: number;
    yield: number;
  };
  topGainers: AssetHolding[];
  topLosers: AssetHolding[];
  bestPerformingAssets: {
    tokens: AssetHolding[];
    liquidity: LiquidityPosition[];
    yield: YieldPosition[];
  };
  lastUpdated: number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  winRate: number;
  profitLossRatio: number;
  averageHoldingPeriod: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  largestWin: number;
  largestLoss: number;
  lastUpdated: number;
}

export interface PortfolioSnapshot {
  timestamp: number;
  totalValueUSD: number;
  assetValueUSD: number;
  liquidityValueUSD: number;
  yieldValueUSD: number;
  assetCount: number;
  liquidityPositions: number;
  yieldPositions: number;
}

export interface Portfolio {
  address: string;
  assets: AssetHolding[];
  liquidityPositions: LiquidityPosition[];
  yieldPositions: YieldPosition[];
  metrics: PortfolioMetrics;
  performance: PerformanceMetrics;
  history: TransactionHistory[];
  snapshots: PortfolioSnapshot[];
  lastUpdated: number;
}

export interface PortfolioSettings {
  autoRefresh: boolean;
  refreshInterval: number;
  trackHistory: boolean;
  calculateImpermanentLoss: boolean;
  includeGasFees: boolean;
  currency: 'USD' | 'ETH' | 'BNB';
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
}

export interface PortfolioComparison {
  address: string;
  name?: string;
  totalValueUSD: number;
  performance24h: number;
  performance7d: number;
  performance30d: number;
  assetAllocation: {
    tokens: number;
    liquidity: number;
    yield: number;
  };
  rank?: number;
}

export class PortfolioService {
  private cache: Map<string, Portfolio> = new Map();
  private settings: Map<string, PortfolioSettings> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds
  private readonly SNAPSHOT_INTERVAL = 3600000; // 1 hour

  constructor(
    private tokenService: BscTokenService,
    private tradingService: BscTradingService,
    private liquidityService: BscLiquidityService,
    private yieldService: BscYieldService,
    private analyticsService: BscAnalyticsService,
    private subgraphClient: PancakeSwapSubgraphClient,
    private cacheService: ICache
  ) {}

  // Portfolio management
  async getPortfolio(address: string, forceRefresh: boolean = false): Promise<Portfolio> {
    try {
      // Check cache first
      if (!forceRefresh) {
        const cached = this.cache.get(address);
        if (cached && (Date.now() - cached.lastUpdated) < this.CACHE_TTL) {
          return cached;
        }
      }

      logger.info(`Building portfolio for address: ${address}`);

      // Get user's token balances
      const assets = await this.getUserAssets(address);

      // Get user's liquidity positions
      const liquidityPositions = await this.getUserLiquidityPositions(address);

      // Get user's yield farming positions
      const yieldPositions = await this.getUserYieldPositions(address);

      // Get transaction history
      const history = await this.getUserTransactionHistory(address);

      // Get historical snapshots
      const snapshots = await this.getUserSnapshots(address);

      // Calculate portfolio metrics
      const metrics = await this.calculatePortfolioMetrics(
        assets,
        liquidityPositions,
        yieldPositions,
        history
      );

      // Calculate performance metrics
      const performance = await this.calculatePerformanceMetrics(history, snapshots);

      const portfolio: Portfolio = {
        address,
        assets,
        liquidityPositions,
        yieldPositions,
        metrics,
        performance,
        history,
        snapshots,
        lastUpdated: Date.now()
      };

      // Cache the portfolio
      this.cache.set(address, portfolio);

      logger.info(`Portfolio built successfully`, {
        address,
        totalValue: metrics.totalValueUSD,
        assetCount: assets.length,
        liquidityPositions: liquidityPositions.length,
        yieldPositions: yieldPositions.length
      });

      return portfolio;
    } catch (error) {
      logger.error('Failed to get portfolio', {
        error: error.message,
        address
      });
      throw error;
    }
  }

  async getMultiplePortfolio(addresses: string[]): Promise<Portfolio[]> {
    try {
      const portfolios = await Promise.allSettled(
        addresses.map(address => this.getPortfolio(address))
      );

      const results: Portfolio[] = [];
      for (const result of portfolios) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.warn('Failed to get portfolio for address', {
            error: result.reason.message
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Failed to get multiple portfolios', { error: error.message });
      throw error;
    }
  }

  // Portfolio analysis
  async getPortfolioAnalysis(address: string): Promise<{
    overview: PortfolioMetrics;
    performance: PerformanceMetrics;
    riskAnalysis: {
      score: number;
      factors: string[];
      recommendations: string[];
    };
    assetBreakdown: {
      byValue: AssetHolding[];
      byPerformance: AssetHolding[];
      byAllocation: {
        tokens: number;
        liquidity: number;
        yield: number;
      };
    };
    opportunities: {
      arbitrage: any[];
      yieldOptimization: any[];
      rebalancing: any[];
    };
  }> {
    try {
      const portfolio = await this.getPortfolio(address);

      // Risk analysis
      const riskAnalysis = await this.analyzePortfolioRisk(portfolio);

      // Asset breakdown
      const assetBreakdown = {
        byValue: portfolio.assets.sort((a, b) => b.valueUSD - a.valueUSD),
        byPerformance: portfolio.assets.sort((a, b) => b.priceChange24h - a.priceChange24h),
        byAllocation: portfolio.metrics.assetAllocation
      };

      // Find opportunities
      const opportunities = await this.findPortfolioOpportunities(portfolio);

      return {
        overview: portfolio.metrics,
        performance: portfolio.performance,
        riskAnalysis,
        assetBreakdown,
        opportunities
      };
    } catch (error) {
      logger.error('Failed to get portfolio analysis', {
        error: error.message,
        address
      });
      throw error;
    }
  }

  // Portfolio comparison
  async comparePortfolios(addresses: string[]): Promise<{
    rankings: PortfolioComparison[];
    metrics: {
      averageValue: number;
      totalValue: number;
      medianValue: number;
      bestPerformer: PortfolioComparison;
      worstPerformer: PortfolioComparison;
    };
    distributions: {
      byValue: { range: string; count: number; percentage: number }[];
      byPerformance: { range: string; count: number; percentage: number }[];
      byAllocation: { type: string; average: number; median: number }[];
    };
  }> {
    try {
      const portfolios = await this.getMultiplePortfolio(addresses);

      // Create comparisons
      const comparisons: PortfolioComparison[] = portfolios.map((portfolio, index) => ({
        address: portfolio.address,
        totalValueUSD: portfolio.metrics.totalValueUSD,
        performance24h: portfolio.metrics.totalValueChange24hPercent,
        performance7d: portfolio.metrics.totalValueChange7dPercent,
        performance30d: portfolio.metrics.totalValueChange30dPercent,
        assetAllocation: portfolio.metrics.assetAllocation
      }));

      // Sort by total value
      comparisons.sort((a, b) => b.totalValueUSD - a.totalValueUSD);

      // Add rankings
      comparisons.forEach((comp, index) => {
        comp.rank = index + 1;
      });

      // Calculate metrics
      const totalValue = comparisons.reduce((sum, comp) => sum + comp.totalValueUSD, 0);
      const averageValue = totalValue / comparisons.length;
      const medianValue = this.calculateMedian(comparisons.map(c => c.totalValueUSD));

      const metrics = {
        averageValue,
        totalValue,
        medianValue,
        bestPerformer: comparisons[0],
        worstPerformer: comparisons[comparisons.length - 1]
      };

      // Create distributions
      const distributions = {
        byValue: this.createValueDistribution(comparisons),
        byPerformance: this.createPerformanceDistribution(comparisons),
        byAllocation: this.createAllocationDistribution(comparisons)
      };

      return {
        rankings: comparisons,
        metrics,
        distributions
      };
    } catch (error) {
      logger.error('Failed to compare portfolios', { error: error.message });
      throw error;
    }
  }

  // Portfolio recommendations
  async getPortfolioRecommendations(address: string): Promise<{
    rebalancing: {
      action: 'buy' | 'sell' | 'hold';
      asset: string;
      currentAllocation: number;
      targetAllocation: number;
      amount: string;
      reason: string;
    }[];
    opportunities: {
      type: 'yield' | 'arbitrage' | 'liquidity' | 'staking';
      description: string;
      estimatedReturn: number;
      risk: 'low' | 'medium' | 'high';
      action: string;
    }[];
    riskManagement: {
      type: 'diversification' | 'stop_loss' | 'position_sizing';
      description: string;
      priority: 'high' | 'medium' | 'low';
    }[];
  }> {
    try {
      const portfolio = await this.getPortfolio(address);
      const analysis = await this.getPortfolioAnalysis(address);

      // Rebalancing recommendations
      const rebalancing = await this.generateRebalancingRecommendations(portfolio);

      // Investment opportunities
      const opportunities = await this.findInvestmentOpportunities(portfolio);

      // Risk management recommendations
      const riskManagement = await this.generateRiskManagementRecommendations(
        portfolio,
        analysis.riskAnalysis
      );

      return {
        rebalancing,
        opportunities,
        riskManagement
      };
    } catch (error) {
      logger.error('Failed to get portfolio recommendations', {
        error: error.message,
        address
      });
      throw error;
    }
  }

  // Historical performance
  async getPortfolioPerformanceHistory(
    address: string,
    timeframe: '1d' | '7d' | '30d' | '90d' | '1y' = '30d'
  ): Promise<{
    snapshots: PortfolioSnapshot[];
    performance: {
      totalReturn: number;
      annualizedReturn: number;
      volatility: number;
      sharpeRatio: number;
      maxDrawdown: number;
    };
    benchmarkComparison: {
      eth: number;
      bnb: number;
      cake: number;
    };
  }> {
    try {
      const portfolio = await this.getPortfolio(address);
      const snapshots = portfolio.snapshots.filter(snapshot => {
        const cutoffTime = Date.now() - this.getTimeframeMs(timeframe);
        return snapshot.timestamp >= cutoffTime;
      });

      if (snapshots.length < 2) {
        throw new Error('Insufficient historical data for performance analysis');
      }

      // Calculate performance metrics
      const performance = this.calculateHistoricalPerformance(snapshots);

      // Get benchmark data
      const benchmarkComparison = await this.getBenchmarkComparison(snapshots, timeframe);

      return {
        snapshots,
        performance,
        benchmarkComparison
      };
    } catch (error) {
      logger.error('Failed to get portfolio performance history', {
        error: error.message,
        address,
        timeframe
      });
      throw error;
    }
  }

  // Settings management
  async getPortfolioSettings(address: string): Promise<PortfolioSettings> {
    const settings = this.settings.get(address);
    if (settings) {
      return settings;
    }

    // Return default settings
    const defaultSettings: PortfolioSettings = {
      autoRefresh: true,
      refreshInterval: 60000, // 1 minute
      trackHistory: true,
      calculateImpermanentLoss: true,
      includeGasFees: true,
      currency: 'USD',
      riskTolerance: 'moderate'
    };

    this.settings.set(address, defaultSettings);
    return defaultSettings;
  }

  async updatePortfolioSettings(address: string, settings: Partial<PortfolioSettings>): Promise<void> {
    try {
      const currentSettings = await this.getPortfolioSettings(address);
      const updatedSettings = { ...currentSettings, ...settings };
      this.settings.set(address, updatedSettings);

      logger.info(`Portfolio settings updated for address: ${address}`);
    } catch (error) {
      logger.error('Failed to update portfolio settings', {
        error: error.message,
        address
      });
      throw error;
    }
  }

  // Private helper methods
  private async getUserAssets(address: string): Promise<AssetHolding[]> {
    try {
      // Get user's token balances from subgraph
      const userTokens = await this.subgraphClient.getUserTokens(address);

      const assets: AssetHolding[] = [];
      let totalValue = 0;

      // Get current prices and calculate values
      for (const tokenData of userTokens) {
        const price = await this.tokenService.getTokenPrice(tokenData.token.id);
        const value = parseFloat(tokenData.balance) * price;

        if (value > 0.01) { // Filter out dust
          const asset: AssetHolding = {
            tokenAddress: tokenData.token.id,
            symbol: tokenData.token.symbol,
            decimals: tokenData.token.decimals,
            balance: tokenData.balance,
            valueUSD: value,
            priceChange24h: await this.getTokenPriceChange24h(tokenData.token.id),
            percentageOfPortfolio: 0, // Will be calculated later
            lastUpdated: Date.now()
          };

          assets.push(asset);
          totalValue += value;
        }
      }

      // Calculate percentages
      assets.forEach(asset => {
        asset.percentageOfPortfolio = totalValue > 0 ? (asset.valueUSD / totalValue) * 100 : 0;
      });

      return assets.sort((a, b) => b.valueUSD - a.valueUSD);
    } catch (error) {
      logger.error('Failed to get user assets', { error: error.message, address });
      return [];
    }
  }

  private async getUserLiquidityPositions(address: string): Promise<LiquidityPosition[]> {
    try {
      // Get user's liquidity positions from subgraph
      const userPositions = await this.subgraphClient.getUserLiquidityPositions(address);

      const positions: LiquidityPosition[] = [];
      let totalValue = 0;

      for (const positionData of userPositions) {
        const pool = await this.liquidityService.getPoolInfo(positionData.pool.id);
        if (pool) {
          const value = parseFloat(positionData.liquidity) * pool.price;

          const position: LiquidityPosition = {
            poolAddress: positionData.pool.id,
            token0Symbol: positionData.pool.token0.symbol,
            token1Symbol: positionData.pool.token1.symbol,
            token0Amount: positionData.token0Amount,
            token1Amount: positionData.token1Amount,
            lpTokenBalance: positionData.liquidity,
            valueUSD: value,
            impermanentLoss: await this.calculateImpermanentLoss(positionData),
            feesEarned: parseFloat(positionData.collectedFeesUSD || '0'),
            apr: pool.apr,
            percentageOfPortfolio: 0, // Will be calculated later
            lastUpdated: Date.now()
          };

          positions.push(position);
          totalValue += value;
        }
      }

      // Calculate percentages
      positions.forEach(position => {
        position.percentageOfPortfolio = totalValue > 0 ? (position.valueUSD / totalValue) * 100 : 0;
      });

      return positions.sort((a, b) => b.valueUSD - a.valueUSD);
    } catch (error) {
      logger.error('Failed to get user liquidity positions', { error: error.message, address });
      return [];
    }
  }

  private async getUserYieldPositions(address: string): Promise<YieldPosition[]> {
    try {
      // Get user's yield positions from subgraph
      const userPositions = await this.subgraphClient.getUserYieldPositions(address);

      const positions: YieldPosition[] = [];
      let totalValue = 0;

      for (const positionData of userPositions) {
        const farm = await this.yieldService.getFarmInfo(positionData.pool.id);
        if (farm) {
          const value = parseFloat(positionData.amount) * farm.lpTokenPrice;

          // Get pending rewards
          const pendingRewards = await this.yieldService.getPendingRewards(
            address,
            positionData.pool.id
          );

          const position: YieldPosition = {
            farmAddress: positionData.pool.id,
            poolAddress: farm.lpTokenAddress,
            token0Symbol: farm.token0Symbol,
            token1Symbol: farm.token1Symbol,
            stakedAmount: positionData.amount,
            valueUSD: value,
            pendingRewards: pendingRewards.map(reward => ({
              token: reward.symbol,
              amount: reward.amount,
              valueUSD: reward.value
            })),
            apr: farm.apr,
            apy: farm.apy,
            percentageOfPortfolio: 0, // Will be calculated later
            lastUpdated: Date.now()
          };

          positions.push(position);
          totalValue += value;
        }
      }

      // Calculate percentages
      positions.forEach(position => {
        position.percentageOfPortfolio = totalValue > 0 ? (position.valueUSD / totalValue) * 100 : 0;
      });

      return positions.sort((a, b) => b.valueUSD - a.valueUSD);
    } catch (error) {
      logger.error('Failed to get user yield positions', { error: error.message, address });
      return [];
    }
  }

  private async getUserTransactionHistory(address: string): Promise<TransactionHistory[]> {
    try {
      // Get transaction history from subgraph
      const transactions = await this.subgraphClient.getUserTransactions(address, 100);

      return transactions.map(tx => ({
        hash: tx.id,
        type: tx.type as any,
        timestamp: parseInt(tx.timestamp) * 1000,
        status: tx.status as any,
        tokenIn: tx.token0 ? {
          address: tx.token0.id,
          symbol: tx.token0.symbol,
          amount: tx.amount0,
          valueUSD: parseFloat(tx.amount0USD || '0')
        } : undefined,
        tokenOut: tx.token1 ? {
          address: tx.token1.id,
          symbol: tx.token1.symbol,
          amount: tx.amount1,
          valueUSD: parseFloat(tx.amount1USD || '0')
        } : undefined,
        gasUsed: tx.gasUsed,
        gasPrice: tx.gasPrice,
        valueUSD: parseFloat(tx.amountUSD || '0'),
        feeUSD: parseFloat(tx.gasUsed) * parseFloat(tx.gasPrice) * parseFloat(tx.gasPriceETH || '0')
      })).sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      logger.error('Failed to get user transaction history', { error: error.message, address });
      return [];
    }
  }

  private async getUserSnapshots(address: string): Promise<PortfolioSnapshot[]> {
    try {
      // Get historical snapshots from cache or database
      const cacheKey = `portfolio_snapshots_${address}`;
      const cached = await this.cacheService.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      // Return empty array if no historical data
      return [];
    } catch (error) {
      logger.error('Failed to get user snapshots', { error: error.message, address });
      return [];
    }
  }

  private async calculatePortfolioMetrics(
    assets: AssetHolding[],
    liquidityPositions: LiquidityPosition[],
    yieldPositions: YieldPosition[],
    history: TransactionHistory[]
  ): Promise<PortfolioMetrics> {
    try {
      const totalValueUSD = assets.reduce((sum, asset) => sum + asset.valueUSD, 0) +
                           liquidityPositions.reduce((sum, position) => sum + position.valueUSD, 0) +
                           yieldPositions.reduce((sum, position) => sum + position.valueUSD, 0);

      const assetValueUSD = assets.reduce((sum, asset) => sum + asset.valueUSD, 0);
      const liquidityValueUSD = liquidityPositions.reduce((sum, position) => sum + position.valueUSD, 0);
      const yieldValueUSD = yieldPositions.reduce((sum, position) => sum + position.valueUSD, 0);

      // Calculate asset allocation
      const assetAllocation = {
        tokens: totalValueUSD > 0 ? (assetValueUSD / totalValueUSD) * 100 : 0,
        liquidity: totalValueUSD > 0 ? (liquidityValueUSD / totalValueUSD) * 100 : 0,
        yield: totalValueUSD > 0 ? (yieldValueUSD / totalValueUSD) * 100 : 0
      };

      // Calculate changes (simplified - in production would use historical data)
      const totalValueChange24h = assets.reduce((sum, asset) =>
        sum + (asset.valueUSD * (asset.priceChange24h / 100)), 0);
      const totalValueChange24hPercent = totalValueUSD > 0 ? (totalValueChange24h / totalValueUSD) * 100 : 0;

      // Find top gainers and losers
      const topGainers = assets
        .filter(asset => asset.priceChange24h > 0)
        .sort((a, b) => b.priceChange24h - a.priceChange24h)
        .slice(0, 5);

      const topLosers = assets
        .filter(asset => asset.priceChange24h < 0)
        .sort((a, b) => a.priceChange24h - b.priceChange24h)
        .slice(0, 5);

      // Best performing assets
      const bestPerformingAssets = {
        tokens: topGainers,
        liquidity: liquidityPositions.sort((a, b) => b.apr - a.apr).slice(0, 3),
        yield: yieldPositions.sort((a, b) => b.apr - a.apr).slice(0, 3)
      };

      return {
        totalValueUSD,
        totalValueChange24h,
        totalValueChange24hPercent,
        totalValueChange7d: totalValueChange24h * 7, // Simplified
        totalValueChange7dPercent: totalValueChange24hPercent * 7,
        totalValueChange30d: totalValueChange24h * 30, // Simplified
        totalValueChange30dPercent: totalValueChange24hPercent * 30,
        assetAllocation,
        topGainers,
        topLosers,
        bestPerformingAssets,
        lastUpdated: Date.now()
      };
    } catch (error) {
      logger.error('Failed to calculate portfolio metrics', { error: error.message });
      throw error;
    }
  }

  private async calculatePerformanceMetrics(
    history: TransactionHistory[],
    snapshots: PortfolioSnapshot[]
  ): Promise<PerformanceMetrics> {
    try {
      // Simplified performance calculation
      const successfulTrades = history.filter(tx => tx.status === 'success');
      const profitableTrades = successfulTrades.filter(tx =>
        tx.tokenOut && tx.tokenIn && tx.tokenOut.valueUSD > tx.tokenIn.valueUSD
      );

      const totalReturn = profitableTrades.reduce((sum, tx) =>
        sum + (tx.tokenOut!.valueUSD - tx.tokenIn!.valueUSD), 0);

      const totalReturnPercent = successfulTrades.length > 0 ?
        (totalReturn / successfulTrades.reduce((sum, tx) => sum + tx.tokenIn!.valueUSD, 0)) * 100 : 0;

      return {
        totalReturn,
        totalReturnPercent,
        annualizedReturn: totalReturnPercent * 365 / 30, // Simplified
        sharpeRatio: totalReturnPercent > 0 ? totalReturnPercent / 15 : 0, // Simplified
        maxDrawdown: 0, // Would calculate from historical data
        volatility: 15, // Simplified
        winRate: successfulTrades.length > 0 ? (profitableTrades.length / successfulTrades.length) * 100 : 0,
        profitLossRatio: 1.5, // Simplified
        averageHoldingPeriod: 86400000, // 1 day in ms
        totalTrades: successfulTrades.length,
        winningTrades: profitableTrades.length,
        losingTrades: successfulTrades.length - profitableTrades.length,
        largestWin: profitableTrades.length > 0 ?
          Math.max(...profitableTrades.map(tx => tx.tokenOut!.valueUSD - tx.tokenIn!.valueUSD)) : 0,
        largestLoss: 0, // Would calculate from losing trades
        lastUpdated: Date.now()
      };
    } catch (error) {
      logger.error('Failed to calculate performance metrics', { error: error.message });
      throw error;
    }
  }

  private async analyzePortfolioRisk(portfolio: Portfolio): Promise<{
    score: number;
    factors: string[];
    recommendations: string[];
  }> {
    try {
      const factors: string[] = [];
      const recommendations: string[] = [];
      let score = 50; // Base score

      // Analyze concentration risk
      const maxAllocation = Math.max(
        ...portfolio.assets.map(asset => asset.percentageOfPortfolio),
        ...portfolio.liquidityPositions.map(pos => pos.percentageOfPortfolio),
        ...portfolio.yieldPositions.map(pos => pos.percentageOfPortfolio)
      );

      if (maxAllocation > 50) {
        score -= 20;
        factors.push('High concentration in single asset');
        recommendations.push('Consider diversifying across multiple assets');
      }

      // Analyze asset type allocation
      const allocation = portfolio.metrics.assetAllocation;
      if (allocation.tokens > 80) {
        score -= 10;
        factors.push('Overexposed to spot holdings');
        recommendations.push('Consider adding yield farming or liquidity positions');
      }

      if (allocation.yield > 60) {
        score -= 15;
        factors.push('High exposure to yield farming');
        recommendations.push('Balance with stable assets and liquidity positions');
      }

      // Ensure score is within bounds
      score = Math.max(0, Math.min(100, score));

      return { score, factors, recommendations };
    } catch (error) {
      logger.error('Failed to analyze portfolio risk', { error: error.message });
      return {
        score: 50,
        factors: ['Unable to calculate risk factors'],
        recommendations: ['Review portfolio manually']
      };
    }
  }

  private async findPortfolioOpportunities(portfolio: Portfolio): Promise<{
    arbitrage: any[];
    yieldOptimization: any[];
    rebalancing: any[];
  }> {
    try {
      // Simplified opportunity detection
      return {
        arbitrage: [],
        yieldOptimization: [],
        rebalancing: []
      };
    } catch (error) {
      logger.error('Failed to find portfolio opportunities', { error: error.message });
      return {
        arbitrage: [],
        yieldOptimization: [],
        rebalancing: []
      };
    }
  }

  private async generateRebalancingRecommendations(portfolio: Portfolio): Promise<any[]> {
    // Simplified rebalancing logic
    return [];
  }

  private async findInvestmentOpportunities(portfolio: Portfolio): Promise<any[]> {
    // Simplified opportunity finding
    return [];
  }

  private async generateRiskManagementRecommendations(
    portfolio: Portfolio,
    riskAnalysis: any
  ): Promise<any[]> {
    // Simplified risk management recommendations
    return [];
  }

  private calculateMedian(values: number[]): number {
    const sorted = values.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ?
      (sorted[mid - 1] + sorted[mid]) / 2 :
      sorted[mid];
  }

  private createValueDistribution(comparisons: PortfolioComparison[]): {
    range: string;
    count: number;
    percentage: number;
  }[] {
    const ranges = [
      { min: 0, max: 100, label: '< $100' },
      { min: 100, max: 1000, label: '$100-$1,000' },
      { min: 1000, max: 10000, label: '$1,000-$10,000' },
      { min: 10000, max: 100000, label: '$10,000-$100,000' },
      { min: 100000, max: Infinity, label: '> $100,000' }
    ];

    return ranges.map(range => {
      const count = comparisons.filter(c =>
        c.totalValueUSD >= range.min && c.totalValueUSD < range.max
      ).length;

      return {
        range: range.label,
        count,
        percentage: (count / comparisons.length) * 100
      };
    });
  }

  private createPerformanceDistribution(comparisons: PortfolioComparison[]): {
    range: string;
    count: number;
    percentage: number;
  }[] {
    const ranges = [
      { min: -Infinity, max: -10, label: '< -10%' },
      { min: -10, max: 0, label: '-10% to 0%' },
      { min: 0, max: 10, label: '0% to 10%' },
      { min: 10, max: 50, label: '10% to 50%' },
      { min: 50, max: Infinity, label: '> 50%' }
    ];

    return ranges.map(range => {
      const count = comparisons.filter(c =>
        c.performance24h >= range.min && c.performance24h < range.max
      ).length;

      return {
        range: range.label,
        count,
        percentage: (count / comparisons.length) * 100
      };
    });
  }

  private createAllocationDistribution(comparisons: PortfolioComparison[]): {
    type: string;
    average: number;
    median: number;
  }[] {
    const allocationTypes = ['tokens', 'liquidity', 'yield'];

    return allocationTypes.map(type => {
      const values = comparisons.map(c => c.assetAllocation[type as keyof typeof c.assetAllocation] as number);

      return {
        type,
        average: values.reduce((sum, val) => sum + val, 0) / values.length,
        median: this.calculateMedian(values)
      };
    });
  }

  private calculateHistoricalPerformance(snapshots: PortfolioSnapshot[]): {
    totalReturn: number;
    annualizedReturn: number;
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
  } {
    if (snapshots.length < 2) {
      return {
        totalReturn: 0,
        annualizedReturn: 0,
        volatility: 0,
        sharpeRatio: 0,
        maxDrawdown: 0
      };
    }

    const firstValue = snapshots[0].totalValueUSD;
    const lastValue = snapshots[snapshots.length - 1].totalValueUSD;
    const totalReturn = ((lastValue - firstValue) / firstValue) * 100;

    const days = (snapshots[snapshots.length - 1].timestamp - snapshots[0].timestamp) / (1000 * 60 * 60 * 24);
    const annualizedReturn = totalReturn * (365 / days);

    // Calculate volatility (simplified)
    const returns = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prevValue = snapshots[i - 1].totalValueUSD;
      const currValue = snapshots[i].totalValueUSD;
      returns.push((currValue - prevValue) / prevValue);
    }

    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(365) * 100;

    const sharpeRatio = volatility > 0 ? annualizedReturn / volatility : 0;

    // Calculate max drawdown (simplified)
    let maxDrawdown = 0;
    let peak = firstValue;

    for (const snapshot of snapshots) {
      if (snapshot.totalValueUSD > peak) {
        peak = snapshot.totalValueUSD;
      }
      const drawdown = ((peak - snapshot.totalValueUSD) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      totalReturn,
      annualizedReturn,
      volatility,
      sharpeRatio,
      maxDrawdown
    };
  }

  private async getBenchmarkComparison(
    snapshots: PortfolioSnapshot[],
    timeframe: string
  ): Promise<{ eth: number; bnb: number; cake: number }> {
    // Simplified benchmark comparison
    return {
      eth: 15.5,
      bnb: 22.3,
      cake: 18.7
    };
  }

  private getTimeframeMs(timeframe: string): number {
    const multipliers: { [key: string]: number } = {
      '1d': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
      '1y': 365 * 24 * 60 * 60 * 1000
    };

    return multipliers[timeframe] || multipliers['30d'];
  }

  private async getTokenPriceChange24h(tokenAddress: string): Promise<number> {
    try {
      const analytics = await this.analyticsService.getTokenAnalytics(tokenAddress);
      return analytics.priceChange24h;
    } catch (error) {
      logger.warn('Failed to get token price change 24h', { error: error.message, tokenAddress });
      return 0;
    }
  }

  private async calculateImpermanentLoss(position: any): Promise<number> {
    // Simplified impermanent loss calculation
    return 0;
  }

  // Cache management
  async clearCache(address?: string): Promise<void> {
    if (address) {
      this.cache.delete(address);
      logger.info(`Cache cleared for address: ${address}`);
    } else {
      this.cache.clear();
      logger.info('All portfolio cache cleared');
    }
  }
}

// Factory function
export function createPortfolioService(
  tokenService: BscTokenService,
  tradingService: BscTradingService,
  liquidityService: BscLiquidityService,
  yieldService: BscYieldService,
  analyticsService: BscAnalyticsService,
  subgraphClient: PancakeSwapSubgraphClient,
  cacheService: ICache
): PortfolioService {
  return new PortfolioService(
    tokenService,
    tradingService,
    liquidityService,
    yieldService,
    analyticsService,
    subgraphClient,
    cacheService
  );
}