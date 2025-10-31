import { getDatabase } from '../../config/database';
import logger from '../../utils/logger';
import { Decimal } from 'decimal.js';
import { StopLossOrderService } from '../stop-loss';
import { LimitOrderService } from '../limit-orders';

/**
 * Token interface
 */
export interface Token {
  address: string;
  symbol: string;
  decimals: number;
}

/**
 * Trading Bot Configuration interface
 */
export interface BotConfiguration {
  id: string;
  userId: string;
  name: string;
  type: 'grid' | 'dca' | 'momentum';
  tokenIn: Token;
  tokenOut: Token;
  isActive: boolean;
  parameters: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Grid Trading Configuration
 */
export interface GridTradingConfig {
  upperPrice: string;
  lowerPrice: string;
  gridCount: number;
  totalInvestment: string;
  takeProfit?: string;
  stopLoss?: string;
}

/**
 * DCA (Dollar Cost Averaging) Configuration
 */
export interface DCAConfig {
  totalInvestment: string;
  purchaseInterval: number; // in hours
  purchaseAmount: string;
  maxPrice?: string;
  minPrice?: string;
  takeProfit?: string;
  stopLoss?: string;
}

/**
 * Momentum Trading Configuration
 */
export interface MomentumConfig {
  rsiPeriod: number;
  rsiOverbought: number;
  rsiOversold: number;
  investmentAmount: string;
  takeProfit?: string;
  stopLoss?: string;
}

/**
 * Bot Performance Metrics
 */
export interface BotPerformance {
  totalInvested: string;
  currentValue: string;
  profitLoss: string;
  profitLossPercentage: string;
  totalTrades: number;
  successfulTrades: number;
  winRate: string;
  averageHoldingTime: number; // in hours
  lastTradeAt?: Date;
}

/**
 * Bot Trade History
 */
export interface BotTrade {
  id: string;
  botId: string;
  userId: string;
  type: 'buy' | 'sell';
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  amountOut: string;
  price: string;
  fee: string;
  timestamp: Date;
  strategy: string;
}

/**
 * Trading Bot Service class
 */
export class TradingBotService {
  private stopLossService: StopLossOrderService;
  private limitOrderService: LimitOrderService;
  private activeBots: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.stopLossService = new StopLossOrderService();
    this.limitOrderService = new LimitOrderService();
  }

  /**
   * Create a new trading bot
   */
  async createBot(
    userId: string,
    name: string,
    type: 'grid' | 'dca' | 'momentum',
    tokenIn: Token,
    tokenOut: Token,
    parameters: GridTradingConfig | DCAConfig | MomentumConfig
  ): Promise<{ success: boolean; bot?: BotConfiguration; error?: string }> {
    try {
      // Validate parameters based on bot type
      const validationError = this.validateBotParameters(type, parameters);
      if (validationError) {
        return {
          success: false,
          error: validationError
        };
      }

      // Validate tokens are different
      if (tokenIn.address === tokenOut.address) {
        return {
          success: false,
          error: 'Token addresses must be different'
        };
      }

      // Get current price for validation
      const currentPrice = await this.getCurrentPrice(tokenIn, tokenOut);
      if (!currentPrice) {
        return {
          success: false,
          error: 'Unable to determine current price'
        };
      }

      // Additional price validation based on bot type
      const priceValidationError = this.validatePriceConstraints(type, parameters, parseFloat(currentPrice));
      if (priceValidationError) {
        return {
          success: false,
          error: priceValidationError
        };
      }

      // Create bot in database
      const db = getDatabase();
      const now = new Date();

      const bot = await db.tradingBot.create({
        data: {
          userId,
          name,
          type,
          tokenInAddress: tokenIn.address,
          tokenInSymbol: tokenIn.symbol,
          tokenInDecimals: tokenIn.decimals,
          tokenOutAddress: tokenOut.address,
          tokenOutSymbol: tokenOut.symbol,
          tokenOutDecimals: tokenOut.decimals,
          isActive: true,
          parameters: JSON.stringify(parameters),
          createdAt: now,
          updatedAt: now
        }
      });

      const botConfig: BotConfiguration = {
        id: bot.id,
        userId: bot.userId,
        name: bot.name,
        type: bot.type as any,
        tokenIn: {
          address: bot.tokenInAddress,
          symbol: bot.tokenInSymbol,
          decimals: bot.tokenInDecimals
        },
        tokenOut: {
          address: bot.tokenOutAddress,
          symbol: bot.tokenOutSymbol,
          decimals: bot.tokenOutDecimals
        },
        isActive: bot.isActive,
        parameters: JSON.parse(bot.parameters as string),
        createdAt: bot.createdAt,
        updatedAt: bot.updatedAt
      };

      // Start the bot
      await this.startBot(botConfig);

      logger.info(`Trading bot created: ${type} bot '${name}' by user ${userId}`);

      return {
        success: true,
        bot: botConfig
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to create trading bot');
      return {
        success: false,
        error: 'Failed to create trading bot'
      };
    }
  }

  /**
   * Stop a trading bot
   */
  async stopBot(botId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getDatabase();

      // Get the bot
      const bot = await db.tradingBot.findUnique({
        where: { id: botId }
      });

      if (!bot) {
        return {
          success: false,
          error: 'Bot not found'
        };
      }

      if (bot.userId !== userId) {
        return {
          success: false,
          error: 'Bot does not belong to user'
        };
      }

      // Stop the bot execution
      this.stopBotExecution(botId);

      // Update bot status
      await db.tradingBot.update({
        where: { id: botId },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });

      logger.info(`Trading bot stopped: ${botId} by user ${userId}`);

      return {
        success: true
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to stop trading bot');
      return {
        success: false,
        error: 'Failed to stop trading bot'
      };
    }
  }

  /**
   * Start a trading bot
   */
  async startBot(bot: BotConfiguration): Promise<void> {
    try {
      // Stop any existing execution for this bot
      this.stopBotExecution(bot.id);

      // Create appropriate interval based on bot type
      let interval: NodeJS.Timeout;

      switch (bot.type) {
        case 'grid':
          // Grid trading runs every minute
          interval = setInterval(() => this.executeGridBot(bot), 60000);
          break;
        case 'dca':
          // DCA runs based on purchase interval
          const dcaConfig = bot.parameters as DCAConfig;
          interval = setInterval(() => this.executeDCABot(bot), dcaConfig.purchaseInterval * 60 * 60 * 1000);
          break;
        case 'momentum':
          // Momentum trading runs every 5 minutes
          interval = setInterval(() => this.executeMomentumBot(bot), 300000);
          break;
        default:
          throw new Error(`Unknown bot type: ${bot.type}`);
      }

      this.activeBots.set(bot.id, interval);
      logger.info(`Started ${bot.type} bot: ${bot.id}`);

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, `Failed to start bot ${bot.id}`);
    }
  }

  /**
   * Stop bot execution
   */
  private stopBotExecution(botId: string): void {
    const interval = this.activeBots.get(botId);
    if (interval) {
      clearInterval(interval);
      this.activeBots.delete(botId);
      logger.info(`Stopped bot execution: ${botId}`);
    }
  }

  /**
   * Execute grid trading bot logic
   */
  private async executeGridBot(bot: BotConfiguration): Promise<void> {
    try {
      const config = bot.parameters as GridTradingConfig;
      const currentPrice = await this.getCurrentPrice(bot.tokenIn, bot.tokenOut);

      if (!currentPrice) {
        return;
      }

      const price = parseFloat(currentPrice);
      const upperPrice = parseFloat(config.upperPrice);
      const lowerPrice = parseFloat(config.lowerPrice);

      // Check if price is within grid range
      if (price < lowerPrice || price > upperPrice) {
        return;
      }

      // Calculate grid spacing
      const gridSpacing = (upperPrice - lowerPrice) / config.gridCount;
      const gridLevel = Math.floor((price - lowerPrice) / gridSpacing);
      const targetPrice = lowerPrice + (gridLevel * gridSpacing);

      // Determine if we should buy or sell
      const gridPrice = lowerPrice + (gridLevel * gridSpacing) + (gridSpacing / 2);
      const shouldBuy = price < gridPrice;

      // Calculate trade amount
      const investmentPerGrid = new Decimal(config.totalInvestment).div(config.gridCount);
      const tradeAmount = shouldBuy
        ? investmentPerGrid.div(price).toString()
        : investmentPerGrid.toString();

      // Execute trade
      if (shouldBuy) {
        await this.executeTrade(bot, 'buy', tradeAmount, price.toString());
      } else {
        await this.executeTrade(bot, 'sell', tradeAmount, price.toString());
      }

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, `Grid bot execution failed: ${bot.id}`);
    }
  }

  /**
   * Execute DCA bot logic
   */
  private async executeDCABot(bot: BotConfiguration): Promise<void> {
    try {
      const config = bot.parameters as DCAConfig;
      const currentPrice = await this.getCurrentPrice(bot.tokenIn, bot.tokenOut);

      if (!currentPrice) {
        return;
      }

      const price = parseFloat(currentPrice);

      // Check price constraints
      if (config.maxPrice && price > parseFloat(config.maxPrice)) {
        return;
      }
      if (config.minPrice && price < parseFloat(config.minPrice)) {
        return;
      }

      // Execute DCA purchase
      const purchaseAmount = new Decimal(config.purchaseAmount).div(price).toString();
      await this.executeTrade(bot, 'buy', purchaseAmount, currentPrice);

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, `DCA bot execution failed: ${bot.id}`);
    }
  }

  /**
   * Execute momentum trading bot logic
   */
  private async executeMomentumBot(bot: BotConfiguration): Promise<void> {
    try {
      const config = bot.parameters as MomentumConfig;

      // Calculate RSI (simplified version - in production would use proper technical analysis)
      const rsi = await this.calculateRSI(bot.tokenIn, bot.tokenOut, config.rsiPeriod);

      if (rsi === null) {
        return;
      }

      // Trading logic based on RSI
      if (rsi < config.rsiOversold) {
        // Oversold - buy signal
        const currentPrice = await this.getCurrentPrice(bot.tokenIn, bot.tokenOut);
        if (currentPrice) {
          const tradeAmount = new Decimal(config.investmentAmount).div(parseFloat(currentPrice)).toString();
          await this.executeTrade(bot, 'buy', tradeAmount, currentPrice);
        }
      } else if (rsi > config.rsiOverbought) {
        // Overbought - sell signal
        const currentPrice = await this.getCurrentPrice(bot.tokenIn, bot.tokenOut);
        if (currentPrice) {
          // Sell all holdings (simplified)
          const tradeAmount = config.investmentAmount; // Would track actual holdings
          await this.executeTrade(bot, 'sell', tradeAmount, currentPrice);
        }
      }

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, `Momentum bot execution failed: ${bot.id}`);
    }
  }

  /**
   * Execute a trade for the bot
   */
  private async executeTrade(
    bot: BotConfiguration,
    type: 'buy' | 'sell',
    amount: string,
    price: string
  ): Promise<void> {
    try {
      const db = getDatabase();

      // Create trade record
      await db.botTrade.create({
        data: {
          botId: bot.id,
          userId: bot.userId,
          type,
          tokenInAddress: bot.tokenIn.address,
          tokenInSymbol: bot.tokenIn.symbol,
          tokenInDecimals: bot.tokenIn.decimals,
          tokenOutAddress: bot.tokenOut.address,
          tokenOutSymbol: bot.tokenOut.symbol,
          tokenOutDecimals: bot.tokenOut.decimals,
          amountIn: amount,
          amountOut: new Decimal(amount).mul(price).toString(),
          price,
          fee: '0', // Simplified - calculate actual fee
          timestamp: new Date(),
          strategy: bot.type
        }
      });

      logger.info(`Bot trade executed: ${bot.type} ${bot.id} - ${type} ${amount} tokens at ${price}`);

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to execute bot trade');
    }
  }

  /**
   * Get user's trading bots
   */
  async getUserBots(userId: string): Promise<BotConfiguration[]> {
    try {
      const db = getDatabase();
      const bots = await db.tradingBot.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      return bots.map(bot => ({
        id: bot.id,
        userId: bot.userId,
        name: bot.name,
        type: bot.type as any,
        tokenIn: {
          address: bot.tokenInAddress,
          symbol: bot.tokenInSymbol,
          decimals: bot.tokenInDecimals
        },
        tokenOut: {
          address: bot.tokenOutAddress,
          symbol: bot.tokenOutSymbol,
          decimals: bot.tokenOutDecimals
        },
        isActive: bot.isActive,
        parameters: JSON.parse(bot.parameters as string),
        createdAt: bot.createdAt,
        updatedAt: bot.updatedAt
      }));

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get user bots');
      return [];
    }
  }

  /**
   * Get bot performance metrics
   */
  async getBotPerformance(botId: string, userId: string): Promise<BotPerformance | null> {
    try {
      const db = getDatabase();

      // Verify bot ownership
      const bot = await db.tradingBot.findUnique({
        where: { id: botId, userId }
      });

      if (!bot) {
        return null;
      }

      // Get all trades for this bot
      const trades = await db.botTrade.findMany({
        where: { botId },
        orderBy: { timestamp: 'asc' }
      });

      if (trades.length === 0) {
        return {
          totalInvested: '0',
          currentValue: '0',
          profitLoss: '0',
          profitLossPercentage: '0',
          totalTrades: 0,
          successfulTrades: 0,
          winRate: '0',
          averageHoldingTime: 0
        };
      }

      // Calculate performance metrics
      let totalInvested = new Decimal(0);
      let currentValue = new Decimal(0);
      let successfulTrades = 0;
      let totalHoldingTime = 0;

      trades.forEach(trade => {
        if (trade.type === 'buy') {
          totalInvested = totalInvested.add(new Decimal(trade.amountOut));
        } else {
          currentValue = currentValue.add(new Decimal(trade.amountOut));
          if (parseFloat(trade.amountOut) > parseFloat(trade.amountIn)) {
            successfulTrades++;
          }
        }
      });

      const profitLoss = currentValue.sub(totalInvested);
      const profitLossPercentage = totalInvested.gt(0)
        ? profitLoss.div(totalInvested).mul(100).toString()
        : '0';

      const winRate = trades.length > 0
        ? (successfulTrades / trades.length * 100).toString()
        : '0';

      return {
        totalInvested: totalInvested.toString(),
        currentValue: currentValue.toString(),
        profitLoss: profitLoss.toString(),
        profitLossPercentage,
        totalTrades: trades.length,
        successfulTrades,
        winRate,
        averageHoldingTime: totalHoldingTime / trades.length,
        lastTradeAt: trades[trades.length - 1]?.timestamp
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get bot performance');
      return null;
    }
  }

  /**
   * Get current price for a token pair (mock implementation)
   */
  private async getCurrentPrice(tokenIn: Token, tokenOut: Token): Promise<string | null> {
    try {
      // Mock price implementation
      // In production, this would fetch from price oracles or AMM pools
      return '2000'; // Mock USDC price for ETH

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get current price');
      return null;
    }
  }

  /**
   * Calculate RSI (simplified implementation)
   */
  private async calculateRSI(tokenIn: Token, tokenOut: Token, period: number): Promise<number | null> {
    try {
      // Simplified RSI calculation
      // In production, would use actual price history and proper RSI formula
      const mockRSI = Math.random() * 100; // Random RSI between 0-100
      return mockRSI;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to calculate RSI');
      return null;
    }
  }

  /**
   * Validate bot parameters based on type
   */
  private validateBotParameters(type: string, parameters: any): string | null {
    switch (type) {
      case 'grid':
        const gridConfig = parameters as GridTradingConfig;
        if (gridConfig.upperPrice === undefined || gridConfig.lowerPrice === undefined || gridConfig.gridCount === undefined || gridConfig.totalInvestment === undefined) {
          return 'Missing required grid trading parameters';
        }
        if (parseFloat(gridConfig.upperPrice) <= parseFloat(gridConfig.lowerPrice)) {
          return 'Upper price must be greater than lower price';
        }
        if (gridConfig.gridCount <= 0) {
          return 'Grid count must be greater than 0';
        }
        break;

      case 'dca':
        const dcaConfig = parameters as DCAConfig;
        if (!dcaConfig.totalInvestment || !dcaConfig.purchaseInterval || !dcaConfig.purchaseAmount) {
          return 'Missing required DCA parameters';
        }
        if (dcaConfig.purchaseInterval <= 0) {
          return 'Purchase interval must be greater than 0';
        }
        break;

      case 'momentum':
        const momentumConfig = parameters as MomentumConfig;
        if (!momentumConfig.rsiPeriod || !momentumConfig.rsiOverbought || !momentumConfig.rsiOversold || !momentumConfig.investmentAmount) {
          return 'Missing required momentum trading parameters';
        }
        if (momentumConfig.rsiOverbought <= momentumConfig.rsiOversold) {
          return 'RSI overbought level must be greater than oversold level';
        }
        break;

      default:
        return 'Unknown bot type';
    }

    return null;
  }

  /**
   * Validate price constraints based on bot type
   */
  private validatePriceConstraints(type: string, parameters: any, currentPrice: number): string | null {
    switch (type) {
      case 'grid':
        const gridConfig = parameters as GridTradingConfig;
        const upperPrice = parseFloat(gridConfig.upperPrice);
        const lowerPrice = parseFloat(gridConfig.lowerPrice);

        if (currentPrice < lowerPrice) {
          return `Current price (${currentPrice}) is below grid lower bound (${lowerPrice})`;
        }
        if (currentPrice > upperPrice) {
          return `Current price (${currentPrice}) is above grid upper bound (${upperPrice})`;
        }
        break;

      case 'dca':
        const dcaConfig = parameters as DCAConfig;
        if (dcaConfig.maxPrice && currentPrice > parseFloat(dcaConfig.maxPrice)) {
          return `Current price (${currentPrice}) is above maximum price (${dcaConfig.maxPrice})`;
        }
        if (dcaConfig.minPrice && currentPrice < parseFloat(dcaConfig.minPrice)) {
          return `Current price (${currentPrice}) is below minimum price (${dcaConfig.minPrice})`;
        }
        break;

      default:
        break;
    }

    return null;
  }

  /**
   * Cleanup method for graceful shutdown
   */
  async cleanup(): Promise<void> {
    // Stop all active bots
    for (const [botId, interval] of this.activeBots) {
      clearInterval(interval);
      logger.info(`Stopped bot during cleanup: ${botId}`);
    }
    this.activeBots.clear();
  }
}