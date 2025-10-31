import { getDatabase } from '../../config/database';
import logger from '../../utils/logger';
import { Decimal } from 'decimal.js';
import type { LimitOrder as DbLimitOrder, Trade as DbTrade } from '../../generated/prisma';

/**
 * Token interface
 */
export interface Token {
  address: string;
  symbol: string;
  decimals: number;
}

/**
 * Limit order interface
 */
export interface LimitOrder {
  id: string;
  userId: string;
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  amountOutMin: string;
  price: string; // tokenOut/tokenIn
  type: 'buy' | 'sell';
  status: 'pending' | 'filled' | 'cancelled' | 'expired';
  filledAmountIn: string;
  filledAmountOut: string;
  gasPrice?: string;
  gasLimit?: string;
  slippageTolerance: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  filledAt?: Date;
  trades?: Trade[];
}

/**
 * Trade interface
 */
export interface Trade {
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
 * Create limit order request interface
 */
export interface CreateLimitOrderRequest {
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  amountOutMin: string;
  price: string;
  type: 'buy' | 'sell';
  gasPrice?: string;
  gasLimit?: string;
  slippageTolerance?: string;
  expiresAt: Date;
}

/**
 * Limit order operation result interface
 */
export interface LimitOrderOperationResult {
  success: boolean;
  order?: LimitOrder;
  trade?: Trade;
  error?: string;
  warnings?: string[];
}

/**
 * Order book entry interface
 */
export interface OrderBookEntry {
  price: string;
  amount: string;
  total: string; // price * amount
  orderCount: number;
}

/**
 * Order book interface
 */
export interface OrderBook {
  tokenIn: Token;
  tokenOut: Token;
  bids: OrderBookEntry[]; // Buy orders (sorted by price descending)
  asks: OrderBookEntry[]; // Sell orders (sorted by price ascending)
  spread: string; // Difference between best bid and ask
  lastUpdated: Date;
}

/**
 * Limit Order Service class
 */
export class LimitOrderService {
  /**
   * Create a new limit order
   */
  async createLimitOrder(request: CreateLimitOrderRequest, userId: string): Promise<LimitOrderOperationResult> {
    try {
      const {
        tokenIn,
        tokenOut,
        amountIn,
        amountOutMin,
        price,
        type,
        gasPrice,
        gasLimit,
        slippageTolerance,
        expiresAt
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

      // Validate expiration
      if (expiresAt <= new Date()) {
        return {
          success: false,
          error: 'Expiration time must be in the future'
        };
      }

      // Calculate expected amount out based on price
      const expectedAmountOut = new Decimal(amountIn).mul(new Decimal(price));
      if (expectedAmountOut.lt(new Decimal(amountOutMin))) {
        return {
          success: false,
          error: 'Amount out minimum is higher than expected based on price'
        };
      }

      // Create order in database
      const db = getDatabase();
      const now = new Date();

      const order = await db.limitOrder.create({
        data: {
          userId,
          tokenInAddress: tokenIn.address,
          tokenInSymbol: tokenIn.symbol,
          tokenInDecimals: tokenIn.decimals,
          tokenOutAddress: tokenOut.address,
          tokenOutSymbol: tokenOut.symbol,
          tokenOutDecimals: tokenOut.decimals,
          amountIn,
          amountOutMin,
          price,
          type,
          status: 'pending',
          filledAmountIn: '0',
          filledAmountOut: '0',
          gasPrice,
          gasLimit,
          slippageTolerance: slippageTolerance || '0.005',
          expiresAt,
          createdAt: now,
          updatedAt: now
        }
      });

      logger.info(`Limit order created: ${type} ${amountIn} ${tokenIn.symbol} for ${tokenOut.symbol} at ${price} by user ${userId}`);

      return {
        success: true,
        order: await this.mapDbOrderToOrder(order)
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to create limit order');
      return {
        success: false,
        error: 'Failed to create limit order'
      };
    }
  }

  /**
   * Cancel a limit order
   */
  async cancelLimitOrder(orderId: string, userId: string): Promise<LimitOrderOperationResult> {
    try {
      const db = getDatabase();

      // Get the order
      const order = await db.limitOrder.findUnique({
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

      if (order.status !== 'pending') {
        return {
          success: false,
          error: 'Order cannot be cancelled'
        };
      }

      // Update order status
      const updatedOrder = await db.limitOrder.update({
        where: { id: orderId },
        data: {
          status: 'cancelled',
          updatedAt: new Date()
        }
      });

      logger.info(`Limit order cancelled: ${orderId} by user ${userId}`);

      return {
        success: true,
        order: await this.mapDbOrderToOrder(updatedOrder)
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to cancel limit order');
      return {
        success: false,
        error: 'Failed to cancel limit order'
      };
    }
  }

  /**
   * Get user's limit orders
   */
  async getUserLimitOrders(userId: string, status?: string): Promise<LimitOrder[]> {
    try {
      const db = getDatabase();
      const whereClause: any = { userId };

      if (status) {
        whereClause.status = status;
      }

      const orders = await db.limitOrder.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' }
      });

      return Promise.all(orders.map(async (order) => {
        return this.mapDbOrderToOrder(order);
      }));

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get user limit orders');
      return [];
    }
  }

  /**
   * Get order book for a token pair
   */
  async getOrderBook(tokenIn: Token, tokenOut: Token): Promise<OrderBook | null> {
    try {
      const db = getDatabase();

      // Get all pending orders for this token pair
      const orders = await db.limitOrder.findMany({
        where: {
          status: 'pending',
          expiresAt: { gt: new Date() },
          OR: [
            {
              tokenInAddress: tokenIn.address,
              tokenOutAddress: tokenOut.address
            },
            {
              tokenInAddress: tokenOut.address,
              tokenOutAddress: tokenIn.address
            }
          ]
        },
        orderBy: { price: 'desc' }
      });

      // Separate buy and sell orders
      const buyOrders = orders.filter(order =>
        order.tokenInAddress === tokenIn.address &&
        order.tokenOutAddress === tokenOut.address
      );

      const sellOrders = orders.filter(order =>
        order.tokenInAddress === tokenOut.address &&
        order.tokenOutAddress === tokenIn.address
      );

      // Build order book entries
      const bids = this.buildOrderBookEntries(buyOrders, true);
      const asks = this.buildOrderBookEntries(sellOrders, false);

      // Calculate spread
      const spread = bids.length > 0 && asks.length > 0
        ? new Decimal(asks[0].price).sub(new Decimal(bids[0].price)).toString()
        : '0';

      return {
        tokenIn,
        tokenOut,
        bids,
        asks,
        spread,
        lastUpdated: new Date()
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get order book');
      return null;
    }
  }

  /**
   * Check and expire pending orders
   */
  async checkExpiredOrders(): Promise<void> {
    try {
      const db = getDatabase();

      const expiredOrders = await db.limitOrder.updateMany({
        where: {
          status: 'pending',
          expiresAt: { lt: new Date() }
        },
        data: {
          status: 'expired',
          updatedAt: new Date()
        }
      });

      if (expiredOrders.count > 0) {
        logger.info(`Expired ${expiredOrders.count} limit orders`);
      }

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to check expired orders');
    }
  }

  /**
   * Build order book entries from orders
   */
  private buildOrderBookEntries(orders: DbLimitOrder[], isBid: boolean): OrderBookEntry[] {
    const grouped: { [price: string]: OrderBookEntry } = {};

    for (const order of orders) {
      if (!grouped[order.price]) {
        grouped[order.price] = {
          price: order.price,
          amount: '0',
          total: '0',
          orderCount: 0
        };
      }

      const remainingAmount = new Decimal(order.amountIn).sub(new Decimal(order.filledAmountIn));
      grouped[order.price].amount = new Decimal(grouped[order.price].amount).add(remainingAmount).toString();
      grouped[order.price].total = new Decimal(grouped[order.price].price).mul(new Decimal(grouped[order.price].amount)).toString();
      grouped[order.price].orderCount += 1;
    }

    const entries = Object.values(grouped);

    // Sort: bids by price descending, asks by price ascending
    return entries.sort((a, b) => {
      const priceA = new Decimal(a.price);
      const priceB = new Decimal(b.price);
      return isBid ? priceB.minus(priceA).toNumber() : priceA.minus(priceB).toNumber();
    });
  }

  /**
   * Map database order to Order interface
   */
  private async mapDbOrderToOrder(dbOrder: DbLimitOrder): Promise<LimitOrder> {
    const db = getDatabase();
    const trades = await db.trade.findMany({
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
      amountOutMin: dbOrder.amountOutMin,
      price: dbOrder.price,
      type: dbOrder.type as any,
      status: dbOrder.status as any,
      filledAmountIn: dbOrder.filledAmountIn,
      filledAmountOut: dbOrder.filledAmountOut,
      gasPrice: dbOrder.gasPrice || undefined,
      gasLimit: dbOrder.gasLimit || undefined,
      slippageTolerance: dbOrder.slippageTolerance,
      expiresAt: dbOrder.expiresAt,
      createdAt: dbOrder.createdAt,
      updatedAt: dbOrder.updatedAt,
      filledAt: dbOrder.filledAt || undefined,
      trades: trades.map(trade => this.mapDbTradeToTrade(trade))
    };
  }

  /**
   * Map database trade to Trade interface
   */
  private mapDbTradeToTrade(dbTrade: DbTrade): Trade {
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
}