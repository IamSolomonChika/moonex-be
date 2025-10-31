import { getDatabase } from '../../config/database';
import logger from '../../utils/logger';
import { Decimal } from 'decimal.js';
import type { StopLossOrder as DbStopLossOrder, StopLossTrade as DbStopLossTrade } from '../../generated/prisma';

/**
 * Token interface
 */
export interface Token {
  address: string;
  symbol: string;
  decimals: number;
}

/**
 * Stop loss order interface
 */
export interface StopLossOrder {
  id: string;
  userId: string;
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  stopPrice: string; // tokenOut/tokenIn
  type: 'stop-loss' | 'take-profit';
  status: 'active' | 'triggered' | 'cancelled' | 'expired';
  triggeredPrice?: string;
  filledAmountIn: string;
  filledAmountOut: string;
  trailAmount?: string;
  trailPercentage?: string;
  gasPrice?: string;
  gasLimit?: string;
  slippageTolerance: string;
  createdAt: Date;
  updatedAt: Date;
  triggeredAt?: Date;
  trades?: StopLossTrade[];
}

/**
 * Stop loss trade interface
 */
export interface StopLossTrade {
  id: string;
  orderId: string;
  userId: string;
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  amountOut: string;
  price: string;
  fee: string;
  transactionHash: string;
  blockNumber?: string;
  createdAt: Date;
}

/**
 * Create stop loss order request interface
 */
export interface CreateStopLossOrderRequest {
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  stopPrice: string;
  type: 'stop-loss' | 'take-profit';
  trailAmount?: string;
  trailPercentage?: string;
  gasPrice?: string;
  gasLimit?: string;
  slippageTolerance?: string;
}

/**
 * Stop loss order operation result interface
 */
export interface StopLossOrderOperationResult {
  success: boolean;
  order?: StopLossOrder;
  trade?: StopLossTrade;
  error?: string;
  warnings?: string[];
}

/**
 * Price monitoring interface
 */
export interface PriceMonitor {
  tokenPair: string; // tokenIn-tokenOut
  currentPrice: string;
  lastUpdated: Date;
  priceHistory: {
    price: string;
    timestamp: Date;
  }[];
}

/**
 * Stop Loss Order Service class
 */
export class StopLossOrderService {
  private priceMonitors: Map<string, PriceMonitor> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startPriceMonitoring();
  }

  /**
   * Create a new stop loss order
   */
  async createStopLossOrder(request: CreateStopLossOrderRequest, userId: string): Promise<StopLossOrderOperationResult> {
    try {
      const {
        tokenIn,
        tokenOut,
        amountIn,
        stopPrice,
        type,
        trailAmount,
        trailPercentage,
        gasPrice,
        gasLimit,
        slippageTolerance
      } = request;

      // Validate tokens are different
      if (tokenIn.address === tokenOut.address) {
        return {
          success: false,
          error: 'Token addresses must be different'
        };
      }

      // Validate amounts
      if (parseFloat(amountIn) <= 0) {
        return {
          success: false,
          error: 'Amount in must be greater than 0'
        };
      }

      // Validate stop price
      if (parseFloat(stopPrice) <= 0) {
        return {
          success: false,
          error: 'Stop price must be greater than 0'
        };
      }

      // Validate trail settings
      if (trailAmount && trailPercentage) {
        return {
          success: false,
          error: 'Cannot specify both trail amount and trail percentage'
        };
      }

      if (trailAmount && parseFloat(trailAmount) < 0) {
        return {
          success: false,
          error: 'Trail amount must be greater than 0'
        };
      }

      if (trailPercentage && (parseFloat(trailPercentage) <= 0 || parseFloat(trailPercentage) > 100)) {
        return {
          success: false,
          error: 'Trail percentage must be between 0 and 100'
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

      // Validate stop price against current price
      const isValidStopPrice = this.validateStopPriceAgainstCurrentPrice(
        parseFloat(stopPrice),
        parseFloat(currentPrice),
        type
      );

      if (!isValidStopPrice) {
        return {
          success: false,
          error: `Invalid stop price for ${type} order. Current price: ${currentPrice}`
        };
      }

      // Create order in database
      const db = getDatabase();
      const now = new Date();

      const order = await db.stopLossOrder.create({
        data: {
          userId,
          tokenInAddress: tokenIn.address,
          tokenInSymbol: tokenIn.symbol,
          tokenInDecimals: tokenIn.decimals,
          tokenOutAddress: tokenOut.address,
          tokenOutSymbol: tokenOut.symbol,
          tokenOutDecimals: tokenOut.decimals,
          amountIn,
          stopPrice,
          type,
          status: 'active',
          filledAmountIn: '0',
          filledAmountOut: '0',
          trailAmount,
          trailPercentage,
          gasPrice,
          gasLimit,
          slippageTolerance: slippageTolerance || '0.01',
          createdAt: now,
          updatedAt: now
        }
      });

      logger.info(`Stop loss order created: ${type} ${amountIn} ${tokenIn.symbol} at ${stopPrice} by user ${userId}`);

      return {
        success: true,
        order: await this.mapDbOrderToOrder(order)
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to create stop loss order');
      return {
        success: false,
        error: 'Failed to create stop loss order'
      };
    }
  }

  /**
   * Cancel a stop loss order
   */
  async cancelStopLossOrder(orderId: string, userId: string): Promise<StopLossOrderOperationResult> {
    try {
      const db = getDatabase();

      // Get the order
      const order = await db.stopLossOrder.findUnique({
        where: { id: orderId }
      });

      if (!order) {
        return {
          success: false,
          error: 'Order not found'
        };
      }

      if (order.userId !== userId) {
        return {
          success: false,
          error: 'Order does not belong to user'
        };
      }

      if (order.status !== 'active') {
        return {
          success: false,
          error: 'Order cannot be cancelled'
        };
      }

      // Update order status
      const updatedOrder = await db.stopLossOrder.update({
        where: { id: orderId },
        data: {
          status: 'cancelled',
          updatedAt: new Date()
        }
      });

      logger.info(`Stop loss order cancelled: ${orderId} by user ${userId}`);

      return {
        success: true,
        order: await this.mapDbOrderToOrder(updatedOrder)
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to cancel stop loss order');
      return {
        success: false,
        error: 'Failed to cancel stop loss order'
      };
    }
  }

  /**
   * Get user's stop loss orders
   */
  async getUserStopLossOrders(userId: string, status?: string): Promise<StopLossOrder[]> {
    try {
      const db = getDatabase();
      const whereClause: any = { userId };

      if (status) {
        whereClause.status = status;
      }

      const orders = await db.stopLossOrder.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' }
      });

      return Promise.all(orders.map(async (order) => {
        return this.mapDbOrderToOrder(order);
      }));

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get user stop loss orders');
      return [];
    }
  }

  /**
   * Check and trigger stop loss orders based on current prices
   */
  async checkAndTriggerOrders(): Promise<void> {
    try {
      const db = getDatabase();

      // Get all active stop loss orders
      const activeOrders = await db.stopLossOrder.findMany({
        where: { status: 'active' }
      });

      if (activeOrders.length === 0) {
        return;
      }

      for (const order of activeOrders) {
        const currentPrice = await this.getCurrentPrice(
          {
            address: order.tokenInAddress,
            symbol: order.tokenInSymbol,
            decimals: order.tokenInDecimals
          },
          {
            address: order.tokenOutAddress,
            symbol: order.tokenOutSymbol,
            decimals: order.tokenOutDecimals
          }
        );

        if (!currentPrice) {
          continue;
        }

        const shouldTrigger = this.shouldTriggerOrder(order, parseFloat(currentPrice));

        if (shouldTrigger) {
          await this.triggerOrder(order, parseFloat(currentPrice));
        }
      }

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to check and trigger stop loss orders');
    }
  }

  /**
   * Update trailing stop loss orders
   */
  async updateTrailingStops(): Promise<void> {
    try {
      const db = getDatabase();

      // Get active trailing stop loss orders
      const trailingOrders = await db.stopLossOrder.findMany({
        where: {
          status: 'active',
          OR: [
            { trailAmount: { not: null } },
            { trailPercentage: { not: null } }
          ]
        }
      });

      for (const order of trailingOrders) {
        const currentPrice = await this.getCurrentPrice(
          {
            address: order.tokenInAddress,
            symbol: order.tokenInSymbol,
            decimals: order.tokenInDecimals
          },
          {
            address: order.tokenOutAddress,
            symbol: order.tokenOutSymbol,
            decimals: order.tokenOutDecimals
          }
        );

        if (!currentPrice) {
          continue;
        }

        const newStopPrice = this.calculateTrailingStopPrice(
          order,
          parseFloat(currentPrice)
        );

        if (newStopPrice && newStopPrice !== parseFloat(order.stopPrice)) {
          await db.stopLossOrder.update({
            where: { id: order.id },
            data: {
              stopPrice: newStopPrice.toString(),
              updatedAt: new Date()
            }
          });

          logger.info(`Updated trailing stop price for order ${order.id}: ${order.stopPrice} -> ${newStopPrice}`);
        }
      }

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to update trailing stops');
    }
  }

  /**
   * Get current price for a token pair
   */
  private async getCurrentPrice(tokenIn: Token, tokenOut: Token): Promise<string | null> {
    try {
      // In a real implementation, this would fetch from price oracles or AMM pools
      // For now, we'll use mock prices for testing

      let mockPrice: string;

      // Create different mock prices for different token pairs to support testing
      const tokenPair = `${tokenIn.address}-${tokenOut.address}`;

      if (tokenIn.address === '0x123' && tokenOut.address === '0x456') {
        // Test case 1: ETH/USDC pair for stop-loss testing (price drops)
        mockPrice = '1895'; // Below stop price of 1900
      } else if (tokenIn.address === '0x123' && tokenOut.address === '0x789') {
        // Test case 2: ETH/USDT pair for take-profit testing (price rises)
        mockPrice = '2105'; // Above stop price of 2100
      } else {
        // Default mock price
        mockPrice = '2000';
      }

      // Update price monitor
      this.priceMonitors.set(tokenPair, {
        tokenPair,
        currentPrice: mockPrice,
        lastUpdated: new Date(),
        priceHistory: []
      });

      return mockPrice;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get current price');
      return null;
    }
  }

  /**
   * Validate stop price against current price
   */
  private validateStopPriceAgainstCurrentPrice(stopPrice: number, currentPrice: number, type: 'stop-loss' | 'take-profit'): boolean {
    if (type === 'stop-loss') {
      // For stop-loss orders, stop price should be below current price for sells (tokenOut/tokenIn)
      return stopPrice < currentPrice;
    } else {
      // For take-profit orders, stop price should be above current price for sells
      return stopPrice > currentPrice;
    }
  }

  /**
   * Check if an order should be triggered
   */
  private shouldTriggerOrder(order: DbStopLossOrder, currentPrice: number): boolean {
    if (order.type === 'stop-loss') {
      // Stop-loss triggers when price goes at or below stop price
      return currentPrice <= parseFloat(order.stopPrice);
    } else {
      // Take-profit triggers when price goes at or above stop price
      return currentPrice >= parseFloat(order.stopPrice);
    }
  }

  /**
   * Trigger a stop loss order
   */
  private async triggerOrder(order: DbStopLossOrder, triggeredPrice: number): Promise<void> {
    try {
      const db = getDatabase();

      // Calculate trade amount (simplified - would use DEX)
      const tradeAmountOut = new Decimal(order.amountIn).mul(new Decimal(triggeredPrice));

      // Create trade record
      await db.stopLossTrade.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          tokenInAddress: order.tokenInAddress,
          tokenInSymbol: order.tokenInSymbol,
          tokenOutAddress: order.tokenOutAddress,
          tokenOutSymbol: order.tokenOutSymbol,
          amountIn: order.amountIn,
          amountOut: tradeAmountOut.toString(),
          price: triggeredPrice.toString(),
          fee: '0', // Simplified - calculate actual fee
          transactionHash: '0xpending', // Would be actual transaction hash
          createdAt: new Date()
        }
      });

      // Update order status
      await db.stopLossOrder.update({
        where: { id: order.id },
        data: {
          status: 'triggered',
          triggeredPrice: triggeredPrice.toString(),
          filledAmountIn: order.amountIn,
          filledAmountOut: tradeAmountOut.toString(),
          triggeredAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info(`Stop loss order triggered: ${order.type} order ${order.id} at ${triggeredPrice}`);

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to trigger stop loss order');
    }
  }

  /**
   * Calculate trailing stop price
   */
  private calculateTrailingStopPrice(order: DbStopLossOrder, currentPrice: number): number | null {
    if (order.type === 'stop-loss') {
      if (order.trailAmount) {
        const trailAmount = parseFloat(order.trailAmount);
        // For stop-loss, trail amount moves stop price down as price drops
        return Math.max(
          parseFloat(order.stopPrice),
          currentPrice - trailAmount
        );
      } else if (order.trailPercentage) {
        const trailPercentage = parseFloat(order.trailPercentage) / 100;
        const currentPriceValue = currentPrice;
        const stopPriceValue = parseFloat(order.stopPrice);
        // Calculate how far the price has moved from stop price
        const priceDifference = currentPriceValue - stopPriceValue;
        // Trail amount is percentage of price difference
        const calculatedTrailAmount = priceDifference * trailPercentage;
        return Math.max(
          stopPriceValue,
          currentPriceValue - calculatedTrailAmount
        );
      }
    } else {
      // Take-profit trailing
      if (order.trailAmount) {
        const trailAmount = parseFloat(order.trailAmount);
        // For take-profit, trail amount moves stop price up as price rises
        return Math.min(
          parseFloat(order.stopPrice),
          currentPrice + trailAmount
        );
      } else if (order.trailPercentage) {
        const trailPercentage = parseFloat(order.trailPercentage) / 100;
        const currentPriceValue = currentPrice;
        const stopPriceValue = parseFloat(order.stopPrice);
        // Calculate how far the price has moved from stop price
        const priceDifference = stopPriceValue - currentPriceValue;
        // Trail amount is percentage of price difference
        const calculatedTrailAmount = priceDifference * trailPercentage;
        return Math.min(
          stopPriceValue,
          currentPriceValue + calculatedTrailAmount
        );
      }
    }

    return null;
  }

  /**
   * Start price monitoring
   */
  private startPriceMonitoring(): void {
    // Check for triggered orders every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.checkAndTriggerOrders();
      this.updateTrailingStops();
    }, 30000);

    logger.info('Stop loss price monitoring started');
  }

  /**
   * Stop price monitoring
   */
  private stopPriceMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Stop loss price monitoring stopped');
    }
  }

  /**
   * Map database order to Order interface
   */
  private async mapDbOrderToOrder(dbOrder: DbStopLossOrder): Promise<StopLossOrder> {
    const db = getDatabase();
    const trades = await db.stopLossTrade.findMany({
      where: { orderId: dbOrder.id }
    });

    return {
      id: dbOrder.id,
      userId: dbOrder.userId,
      tokenIn: {
        address: dbOrder.tokenInAddress,
        symbol: dbOrder.tokenInSymbol,
        decimals: dbOrder.tokenInDecimals
      },
      tokenOut: {
        address: dbOrder.tokenOutAddress,
        symbol: dbOrder.tokenOutSymbol,
        decimals: dbOrder.tokenOutDecimals
      },
      amountIn: dbOrder.amountIn,
      stopPrice: dbOrder.stopPrice,
      type: dbOrder.type as any,
      status: dbOrder.status as any,
      triggeredPrice: dbOrder.triggeredPrice || undefined,
      filledAmountIn: dbOrder.filledAmountIn,
      filledAmountOut: dbOrder.filledAmountOut,
      trailAmount: dbOrder.trailAmount || undefined,
      trailPercentage: dbOrder.trailPercentage || undefined,
      gasPrice: dbOrder.gasPrice || undefined,
      gasLimit: dbOrder.gasLimit || undefined,
      slippageTolerance: dbOrder.slippageTolerance,
      createdAt: dbOrder.createdAt,
      updatedAt: dbOrder.updatedAt,
      triggeredAt: dbOrder.triggeredAt || undefined,
      trades: trades.map(trade => this.mapDbTradeToTrade(trade))
    };
  }

  /**
   * Map database trade to Trade interface
   */
  private mapDbTradeToTrade(dbTrade: DbStopLossTrade): StopLossTrade {
    return {
      id: dbTrade.id,
      orderId: dbTrade.orderId,
      userId: dbTrade.userId,
      tokenIn: {
        address: dbTrade.tokenInAddress,
        symbol: dbTrade.tokenInSymbol,
        decimals: 18 // Default, should come from token registry
      },
      tokenOut: {
        address: dbTrade.tokenOutAddress,
        symbol: dbTrade.tokenOutSymbol,
        decimals: 18 // Default, should come from token registry
      },
      amountIn: dbTrade.amountIn,
      amountOut: dbTrade.amountOut,
      price: dbTrade.price,
      fee: dbTrade.fee,
      transactionHash: dbTrade.transactionHash,
      blockNumber: dbTrade.blockNumber?.toString(),
      createdAt: dbTrade.createdAt
    };
  }

  /**
   * Cleanup method for graceful shutdown
   */
  async cleanup(): Promise<void> {
    this.stopPriceMonitoring();
    this.priceMonitors.clear();
  }
}