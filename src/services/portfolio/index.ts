import { getDatabase } from '../../config/database';
import logger from '../../utils/logger';
import { Decimal } from 'decimal.js';

/**
 * Portfolio position types
 */
export interface Position {
  id: string;
  type: 'liquidity' | 'farm' | 'trading_bot' | 'wallet';
  asset: {
    address: string;
    symbol: string;
    decimals: number;
  };
  amount: string;
  valueUSD: string;
  percentageChange24h: string;
  apr?: string;
  rewards?: string;
  metadata?: Record<string, any>;
}

/**
 * Portfolio summary
 */
export interface PortfolioSummary {
  totalValueUSD: string;
  totalValueChange24h: string;
  totalValueChange24hPercentage: string;
  positions: Position[];
  assetAllocation: Record<string, string>; // percentage allocation by asset
  positionAllocation: Record<string, string>; // percentage allocation by position type
  dailyHistory: PortfolioHistoryPoint[];
  weeklyHistory: PortfolioHistoryPoint[];
  monthlyHistory: PortfolioHistoryPoint[];
}

/**
 * Portfolio history point
 */
export interface PortfolioHistoryPoint {
  timestamp: Date;
  valueUSD: string;
  change24h: string;
  change24hPercentage: string;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  totalReturn: string;
  totalReturnPercentage: string;
  annualizedReturn: string;
  sharpeRatio: string;
  maxDrawdown: string;
  volatility: string;
  winRate: string;
  profitFactor: string;
}

/**
 * Rebalancing suggestion
 */
export interface RebalancingSuggestion {
  id: string;
  type: 'add_liquidity' | 'remove_liquidity' | 'rebalance_assets' | 'start_bot' | 'stop_bot';
  description: string;
  expectedImpact: string;
  riskLevel: 'low' | 'medium' | 'high';
  estimatedGasCost: string;
  estimatedTime: string;
  actions: RebalancingAction[];
}

/**
 * Rebalancing action
 */
export interface RebalancingAction {
  type: string;
  parameters: Record<string, any>;
  expectedOutcome: string;
}

/**
 * Portfolio Service class
 */
export class PortfolioService {
  /**
   * Get user's complete portfolio summary
   */
  async getPortfolioSummary(userId: string): Promise<PortfolioSummary | null> {
    try {
      const db = getDatabase();

      // Get all user positions in parallel
      const [liquidityPositions, farmPositions, tradingBots, wallets] = await Promise.allSettled([
        this.getLiquidityPositions(userId),
        this.getFarmPositions(userId),
        this.getTradingBotPositions(userId),
        this.getWalletBalances(userId)
      ]);

      // Check if any of the calls failed critically
      if (liquidityPositions.status === 'rejected' ||
          farmPositions.status === 'rejected' ||
          tradingBots.status === 'rejected' ||
          wallets.status === 'rejected') {
        logger.error({ userId }, 'Critical error in portfolio data fetching');
        return null;
      }

      const allPositions = [
        ...liquidityPositions.value,
        ...farmPositions.value,
        ...tradingBots.value,
        ...wallets.value
      ];

      // Calculate portfolio totals
      const totalValueUSD = allPositions.reduce(
        (sum, position) => new Decimal(sum).add(position.valueUSD),
        new Decimal('0')
      );

      const totalChange24h = allPositions.reduce(
        (sum, position) => new Decimal(sum).add(
          new Decimal(position.valueUSD).mul(position.percentageChange24h).div('100')
        ),
        new Decimal('0')
      );

      const totalChange24hPercentage = totalValueUSD.gt('0')
        ? totalChange24h.mul('100').div(totalValueUSD).toString()
        : '0';

      // Calculate allocations
      const assetAllocation = this.calculateAssetAllocation(allPositions, totalValueUSD);
      const positionAllocation = this.calculatePositionAllocation(allPositions, totalValueUSD);

      // Get historical data
      const [dailyHistory, weeklyHistory, monthlyHistory] = await Promise.all([
        this.getPortfolioHistory(userId, '24h'),
        this.getPortfolioHistory(userId, '7d'),
        this.getPortfolioHistory(userId, '30d')
      ]);

      return {
        totalValueUSD: totalValueUSD.toString(),
        totalValueChange24h: totalChange24h.toString(),
        totalValueChange24hPercentage: totalChange24hPercentage,
        positions: allPositions,
        assetAllocation,
        positionAllocation,
        dailyHistory,
        weeklyHistory,
        monthlyHistory
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), userId }, 'Failed to get portfolio summary');
      return null;
    }
  }

  /**
   * Get portfolio performance metrics
   */
  async getPerformanceMetrics(userId: string, period: '7d' | '30d' | '90d' | '1y' = '30d'): Promise<PerformanceMetrics | null> {
    try {
      const db = getDatabase();

      // Get historical data for the period
      const history = await this.getPortfolioHistory(userId, period);
      if (history.length < 2) {
        return null;
      }

      const startValue = new Decimal(history[0].valueUSD);
      const endValue = new Decimal(history[history.length - 1].valueUSD);
      const totalReturn = endValue.sub(startValue);
      const totalReturnPercentage = startValue.gt('0') ? totalReturn.mul('100').div(startValue) : new Decimal('0');

      // Calculate annualized return
      const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
      const annualizedReturn = totalReturnPercentage.div(days).mul('365');

      // Calculate volatility (standard deviation of daily returns)
      const dailyReturns = history.slice(1).map((point, index) => {
        const prevValue = new Decimal(history[index].valueUSD);
        const currValue = new Decimal(point.valueUSD);
        return currValue.sub(prevValue).div(prevValue);
      });

      const meanReturn = dailyReturns.reduce((sum, ret) => sum.add(ret), new Decimal('0')).div(dailyReturns.length);
      const variance = dailyReturns.reduce((sum, ret) => {
        const diff = ret.sub(meanReturn);
        return sum.add(diff.mul(diff));
      }, new Decimal('0')).div(dailyReturns.length);
      const volatility = variance.sqrt().mul('100'); // Convert to percentage

      // Calculate Sharpe ratio (assuming 2% risk-free rate annualized)
      const riskFreeRateDaily = new Decimal('0.02').div('365');
      const sharpeRatio = volatility.gt('0')
        ? meanReturn.sub(riskFreeRateDaily).div(volatility.div('100'))
        : new Decimal('0');

      // Calculate max drawdown
      let maxDrawdown = new Decimal('0');
      let peak = startValue;

      for (const point of history) {
        const currentValue = new Decimal(point.valueUSD);
        if (currentValue.gt(peak)) {
          peak = currentValue;
        } else {
          const drawdown = peak.sub(currentValue).div(peak);
          if (drawdown.gt(maxDrawdown)) {
            maxDrawdown = drawdown;
          }
        }
      }

      // Calculate win rate and profit factor from trades
      const trades = await this.getAllUserTrades(userId);
      const profitableTrades = trades.filter(trade => this.isTradeProfitable(trade));
      const winRate = trades.length > 0
        ? new Decimal(profitableTrades.length).mul('100').div(trades.length)
        : new Decimal('0');

      const totalProfits = profitableTrades.reduce((sum, trade) => {
        return sum.add(this.calculateTradeProfit(trade));
      }, new Decimal('0'));

      const totalLosses = trades
        .filter(trade => !this.isTradeProfitable(trade))
        .reduce((sum, trade) => {
          return sum.add(this.calculateTradeProfit(trade).abs());
        }, new Decimal('0'));

      const profitFactor = totalLosses.gt('0') ? totalProfits.div(totalLosses) : new Decimal('0');

      return {
        totalReturn: totalReturn.toString(),
        totalReturnPercentage: totalReturnPercentage.toString(),
        annualizedReturn: annualizedReturn.toString(),
        sharpeRatio: sharpeRatio.toString(),
        maxDrawdown: maxDrawdown.mul('100').toString(),
        volatility: volatility.toString(),
        winRate: winRate.toString(),
        profitFactor: profitFactor.gt('0') ? profitFactor.toString() : '0'
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), userId, period }, 'Failed to get performance metrics');
      return null;
    }
  }

  /**
   * Get rebalancing suggestions
   */
  async getRebalancingSuggestions(userId: string): Promise<RebalancingSuggestion[]> {
    try {
      const db = getDatabase();
      const suggestions: RebalancingSuggestion[] = [];

      const portfolio = await this.getPortfolioSummary(userId);
      if (!portfolio) {
        return [];
      }

      // Analyze asset allocation
      const assetAllocation = portfolio.assetAllocation;
      const totalValue = new Decimal(portfolio.totalValueUSD);

      // Suggestion 1: Rebalance if any asset allocation is > 60% or < 5%
      for (const [asset, allocation] of Object.entries(assetAllocation)) {
        const allocationPercent = new Decimal(allocation);
        if (allocationPercent.gt('60')) {
          suggestions.push({
            id: `rebalance-${asset}-${Date.now()}`,
            type: 'rebalance_assets',
            description: `Consider reducing ${asset} allocation from ${allocation}% to a more balanced level`,
            expectedImpact: 'Reduce portfolio risk and improve diversification',
            riskLevel: 'low',
            estimatedGasCost: '0.01',
            estimatedTime: '15 minutes',
            actions: [
              {
                type: 'remove_liquidity',
                parameters: { asset, percentage: allocationPercent.sub('40').toString() },
                expectedOutcome: `Reduce ${asset} allocation to ~40%`
              }
            ]
          });
        } else if (allocationPercent.lt('5') && allocationPercent.gt('0')) {
          suggestions.push({
            id: `increase-${asset}-${Date.now()}`,
            type: 'add_liquidity',
            description: `Consider increasing ${asset} allocation from ${allocation}% to improve diversification`,
            expectedImpact: 'Better diversification and potentially higher returns',
            riskLevel: 'low',
            estimatedGasCost: '0.01',
            estimatedTime: '10 minutes',
            actions: [
              {
                type: 'add_liquidity',
                parameters: { asset, targetAllocation: '10' },
                expectedOutcome: `Increase ${asset} allocation to ~10%`
              }
            ]
          });
        }
      }

      // Suggestion 2: Start trading bot if portfolio value is high enough and no active bots
      const activeBots = portfolio.positions.filter(p => p.type === 'trading_bot');
      if (totalValue.gte('1000') && activeBots.length === 0) {
        suggestions.push({
          id: `start-trading-bot-${Date.now()}`,
          type: 'start_bot',
          description: 'Consider starting a trading bot to automate your investment strategy',
          expectedImpact: 'Automated trading and potentially higher returns',
          riskLevel: 'medium',
          estimatedGasCost: '0.05',
          estimatedTime: '30 minutes',
          actions: [
            {
              type: 'create_grid_bot',
              parameters: {
                totalInvestment: totalValue.mul('0.1').toString(), // 10% of portfolio
                pair: 'ETH/USDC',
                strategy: 'grid'
              },
              expectedOutcome: 'Start automated grid trading'
            }
          ]
        });
      }

      // Suggestion 3: Optimize farm positions
      const farmPositions = portfolio.positions.filter(p => p.type === 'farm');
      for (const position of farmPositions) {
        if (position.apr && new Decimal(position.apr).lt('5')) {
          suggestions.push({
            id: `optimize-farm-${position.id}`,
            type: 'rebalance_assets',
            description: `Consider moving funds from low-APR farm (${position.apr}% APR) to higher yield opportunities`,
            expectedImpact: 'Higher yield on idle assets',
            riskLevel: 'low',
            estimatedGasCost: '0.02',
            estimatedTime: '20 minutes',
            actions: [
              {
                type: 'unstake_and_restake',
                parameters: { farmId: position.id },
                expectedOutcome: 'Move to higher yield farming opportunity'
              }
            ]
          });
        }
      }

      // Sort suggestions by expected impact and risk level
      return suggestions.sort((a, b) => {
        const riskOrder = { low: 1, medium: 2, high: 3 };
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      });
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), userId }, 'Failed to get rebalancing suggestions');
      return [];
    }
  }

  /**
   * Get user's liquidity positions
   */
  private async getLiquidityPositions(userId: string): Promise<Position[]> {
    try {
      const db = getDatabase();
      const positions = await db.liquidityPosition.findMany({
        where: { userId },
        include: {
          pool: true
        }
      });

      return positions.map(position => ({
        id: position.id,
        type: 'liquidity' as const,
        asset: {
          address: position.pool.token0Address,
          symbol: `${position.pool.token0Symbol}/${position.pool.token1Symbol}`,
          decimals: 18
        },
        amount: position.lpTokenBalance,
        valueUSD: position.valueUSD,
        percentageChange24h: '0', // Would calculate based on pool price changes
        metadata: {
          poolId: position.poolId,
          token0Amount: position.token0Amount,
          token1Amount: position.token1Amount,
          impermanentLoss: position.impermanentLoss
        }
      }));
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), userId }, 'Failed to get liquidity positions');
      return [];
    }
  }

  /**
   * Get user's farm positions
   */
  private async getFarmPositions(userId: string): Promise<Position[]> {
    try {
      const db = getDatabase();
      const positions = await db.farmPosition.findMany({
        where: { userId },
        include: {
          farm: true
        }
      });

      return positions.map(position => ({
        id: position.id,
        type: 'farm' as const,
        asset: {
          address: position.farm.rewardTokenAddress,
          symbol: position.farm.rewardTokenSymbol,
          decimals: 18
        },
        amount: position.amountStaked,
        valueUSD: '0', // Would calculate based on current LP token value
        percentageChange24h: '0',
        apr: position.farm.apr,
        rewards: position.pendingRewards,
        metadata: {
          farmId: position.farmId,
          aprAtStake: position.aprAtStake
        }
      }));
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), userId }, 'Failed to get farm positions');
      return [];
    }
  }

  /**
   * Get user's trading bot positions
   */
  private async getTradingBotPositions(userId: string): Promise<Position[]> {
    try {
      const db = getDatabase();
      const bots = await db.tradingBot.findMany({
        where: { userId, isActive: true },
        include: {
          trades: true
        }
      });

      return bots.map(bot => {
        const parameters = bot.parameters as any;
        const totalInvested = parameters?.totalInvestment || '0';
        const currentValue = this.calculateBotCurrentValue(bot);

        return {
          id: bot.id,
          type: 'trading_bot' as const,
          asset: {
            address: bot.tokenInAddress,
            symbol: `${bot.tokenInSymbol}/${bot.tokenOutSymbol}`,
            decimals: bot.tokenInDecimals
          },
          amount: totalInvested,
          valueUSD: currentValue,
          percentageChange24h: '0', // Would calculate based on 24h performance
          metadata: {
            botType: bot.type,
            parameters: bot.parameters,
            activeTrades: bot.trades.length
          }
        };
      });
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), userId }, 'Failed to get trading bot positions');
      return [];
    }
  }

  /**
   * Get user's wallet balances
   */
  private async getWalletBalances(userId: string): Promise<Position[]> {
    try {
      const db = getDatabase();
      const wallets = await db.wallet.findMany({
        where: { userId, isActive: true }
      });

      // Mock token balances - in real implementation would query blockchain
      return wallets.map(wallet => ({
        id: wallet.id,
        type: 'wallet' as const,
        asset: {
          address: wallet.address,
          symbol: 'ETH', // Simplified - would have multiple tokens
          decimals: 18
        },
        amount: '0', // Would get from blockchain
        valueUSD: '0', // Would calculate based on current prices
        percentageChange24h: '0',
        metadata: {
          walletType: wallet.type,
          chainId: wallet.chainId
        }
      }));
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), userId }, 'Failed to get wallet balances');
      return [];
    }
  }

  /**
   * Calculate asset allocation
   */
  private calculateAssetAllocation(positions: Position[], totalValue: Decimal): Record<string, string> {
    const allocation: Record<string, string> = {};

    for (const position of positions) {
      const currentValue = new Decimal(position.valueUSD);
      if (currentValue.gt('0')) {
        const percentage = currentValue.mul('100').div(totalValue);
        const existingAllocation = allocation[position.asset.symbol] || '0';
        allocation[position.asset.symbol] = new Decimal(existingAllocation).add(percentage).toString();
      }
    }

    return allocation;
  }

  /**
   * Calculate position type allocation
   */
  private calculatePositionAllocation(positions: Position[], totalValue: Decimal): Record<string, string> {
    const allocation: Record<string, string> = {};

    for (const position of positions) {
      const currentValue = new Decimal(position.valueUSD);
      if (currentValue.gt('0')) {
        const percentage = currentValue.mul('100').div(totalValue);
        const existingAllocation = allocation[position.type] || '0';
        allocation[position.type] = new Decimal(existingAllocation).add(percentage).toString();
      }
    }

    return allocation;
  }

  /**
   * Get portfolio historical data
   */
  private async getPortfolioHistory(userId: string, period: string): Promise<PortfolioHistoryPoint[]> {
    // Mock historical data - in real implementation would query from time-series database
    const points: PortfolioHistoryPoint[] = [];
    const now = new Date();
    const intervals = period === '24h' ? 24 : period === '7d' ? 7 : period === '30d' ? 30 : 365;
    const intervalHours = 24;

    for (let i = intervals; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * intervalHours * 60 * 60 * 1000);
      // Mock data with some variation
      const baseValue = 10000;
      const variance = Math.sin(i / 5) * 500 + Math.random() * 200 - 100;
      const value = baseValue + variance + (intervals - i) * 10; // Upward trend

      points.push({
        timestamp,
        valueUSD: value.toString(),
        change24h: i > 0 ? (variance - (Math.sin((i+1) / 5) * 500 + Math.random() * 200 - 100)).toString() : '0',
        change24hPercentage: i > 0 ? ((variance - (Math.sin((i+1) / 5) * 500 + Math.random() * 200 - 100)) / baseValue * 100).toString() : '0'
      });
    }

    return points;
  }

  /**
   * Calculate current value of a trading bot
   */
  private calculateBotCurrentValue(bot: any): string {
    // Simplified calculation - would include current token values, unrealized PnL, etc.
    const parameters = bot.parameters as any;
    const totalInvested = new Decimal(parameters?.totalInvestment || '0');
    const mockReturn = new Decimal('0.05'); // 5% return mock
    return totalInvested.mul(mockReturn.add('1')).toString();
  }

  /**
   * Get all user trades for performance calculation
   */
  private async getAllUserTrades(userId: string): Promise<any[]> {
    const db = getDatabase();
    const [limitTrades, stopLossTrades, botTrades] = await Promise.all([
      db.trade.findMany({ where: { userId } }),
      db.stopLossTrade.findMany({ where: { userId } }),
      db.botTrade.findMany({ where: { userId } })
    ]);

    return [...limitTrades, ...stopLossTrades, ...botTrades];
  }

  /**
   * Check if a trade was profitable
   */
  private isTradeProfitable(trade: any): boolean {
    // Simplified profitability check
    return parseFloat(trade.amountOut || '0') > parseFloat(trade.amountIn || '0');
  }

  /**
   * Calculate trade profit
   */
  private calculateTradeProfit(trade: any): Decimal {
    const amountIn = new Decimal(trade.amountIn || '0');
    const amountOut = new Decimal(trade.amountOut || '0');
    return amountOut.sub(amountIn);
  }
}