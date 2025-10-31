import { LimitOrderService } from '../services/limit-orders';
import { getDatabase } from '../config/database';

// Mock the database module
jest.mock('../config/database');
const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

describe('LimitOrderService', () => {
  let limitOrderService: LimitOrderService;
  let mockDb: any;

  beforeEach(() => {
    limitOrderService = new LimitOrderService();

    // Mock database methods
    mockDb = {
      limitOrder: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn()
      },
      trade: {
        findMany: jest.fn(),
        create: jest.fn()
      }
    };

    mockGetDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createLimitOrder', () => {
    it('should create a new limit order successfully', async () => {
      const request = {
        tokenIn: {
          address: '0x1234567890123456789012345678901234567890',
          symbol: 'ETH',
          decimals: 18
        },
        tokenOut: {
          address: '0x0987654321098765432109876543210987654321',
          symbol: 'USDC',
          decimals: 6
        },
        amountIn: '1.0',
        amountOutMin: '2000',
        price: '2000',
        type: 'sell' as const,
        gasPrice: '20000000000',
        gasLimit: '100000',
        slippageTolerance: '0.005',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      };

      const mockOrder = {
        id: 'order-1',
        userId: 'user-1',
        tokenInAddress: request.tokenIn.address,
        tokenInSymbol: request.tokenIn.symbol,
        tokenInDecimals: request.tokenIn.decimals,
        tokenOutAddress: request.tokenOut.address,
        tokenOutSymbol: request.tokenOut.symbol,
        tokenOutDecimals: request.tokenOut.decimals,
        amountIn: request.amountIn,
        amountOutMin: request.amountOutMin,
        price: request.price,
        type: request.type,
        status: 'pending',
        filledAmountIn: '0',
        filledAmountOut: '0',
        gasPrice: request.gasPrice,
        gasLimit: request.gasLimit,
        slippageTolerance: request.slippageTolerance,
        expiresAt: request.expiresAt,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.limitOrder.create.mockResolvedValue(mockOrder);
      mockDb.trade.findMany.mockResolvedValue([]);

      const result = await limitOrderService.createLimitOrder(request, 'user-1');

      expect(result.success).toBe(true);
      expect(result.order).toBeDefined();
      expect(result.order?.tokenIn.symbol).toBe('ETH');
      expect(result.order?.tokenOut.symbol).toBe('USDC');
      expect(result.order?.type).toBe('sell');
      expect(result.order?.status).toBe('pending');
    });

    it('should fail if token addresses are the same', async () => {
      const request = {
        tokenIn: {
          address: '0x1234567890123456789012345678901234567890',
          symbol: 'ETH',
          decimals: 18
        },
        tokenOut: {
          address: '0x1234567890123456789012345678901234567890',
          symbol: 'ETH',
          decimals: 18
        },
        amountIn: '1.0',
        amountOutMin: '1',
        price: '1',
        type: 'buy' as const,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const result = await limitOrderService.createLimitOrder(request, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token addresses must be different');
    });

    it('should fail if amount in is zero or negative', async () => {
      const request = {
        tokenIn: {
          address: '0x1234567890123456789012345678901234567890',
          symbol: 'ETH',
          decimals: 18
        },
        tokenOut: {
          address: '0x0987654321098765432109876543210987654321',
          symbol: 'USDC',
          decimals: 6
        },
        amountIn: '0',
        amountOutMin: '0',
        price: '2000',
        type: 'sell' as const,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const result = await limitOrderService.createLimitOrder(request, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Amount in must be greater than 0');
    });

    it('should fail if expiration time is in the past', async () => {
      const request = {
        tokenIn: {
          address: '0x1234567890123456789012345678901234567890',
          symbol: 'ETH',
          decimals: 18
        },
        tokenOut: {
          address: '0x0987654321098765432109876543210987654321',
          symbol: 'USDC',
          decimals: 6
        },
        amountIn: '1.0',
        amountOutMin: '2000',
        price: '2000',
        type: 'sell' as const,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
      };

      const result = await limitOrderService.createLimitOrder(request, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Expiration time must be in the future');
    });

    it('should fail if amount out minimum is higher than expected', async () => {
      const request = {
        tokenIn: {
          address: '0x1234567890123456789012345678901234567890',
          symbol: 'ETH',
          decimals: 18
        },
        tokenOut: {
          address: '0x0987654321098765432109876543210987654321',
          symbol: 'USDC',
          decimals: 6
        },
        amountIn: '1.0',
        amountOutMin: '3000', // Higher than expected (1.0 * 2000 = 2000)
        price: '2000',
        type: 'sell' as const,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const result = await limitOrderService.createLimitOrder(request, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Amount out minimum is higher than expected based on price');
    });
  });

  describe('cancelLimitOrder', () => {
    it('should cancel a limit order successfully', async () => {
      const orderId = 'order-1';
      const userId = 'user-1';

      const mockOrder = {
        id: orderId,
        userId,
        status: 'pending'
      };

      const updatedOrder = {
        ...mockOrder,
        status: 'cancelled',
        updatedAt: new Date()
      };

      mockDb.limitOrder.findUnique.mockResolvedValue(mockOrder);
      mockDb.limitOrder.update.mockResolvedValue(updatedOrder);
      mockDb.trade.findMany.mockResolvedValue([]);

      const result = await limitOrderService.cancelLimitOrder(orderId, userId);

      expect(result.success).toBe(true);
      expect(result.order?.status).toBe('cancelled');
    });

    it('should fail if order not found', async () => {
      const orderId = 'non-existent-order';
      const userId = 'user-1';

      mockDb.limitOrder.findUnique.mockResolvedValue(null);

      const result = await limitOrderService.cancelLimitOrder(orderId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');
    });

    it('should fail if order does not belong to user', async () => {
      const orderId = 'order-1';
      const userId = 'user-1';

      const mockOrder = {
        id: orderId,
        userId: 'user-2', // Different user
        status: 'pending'
      };

      mockDb.limitOrder.findUnique.mockResolvedValue(mockOrder);

      const result = await limitOrderService.cancelLimitOrder(orderId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order does not belong to user');
    });

    it('should fail if order is not pending', async () => {
      const orderId = 'order-1';
      const userId = 'user-1';

      const mockOrder = {
        id: orderId,
        userId,
        status: 'filled' // Already filled
      };

      mockDb.limitOrder.findUnique.mockResolvedValue(mockOrder);

      const result = await limitOrderService.cancelLimitOrder(orderId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order cannot be cancelled');
    });
  });

  describe('getUserLimitOrders', () => {
    it('should return user orders', async () => {
      const userId = 'user-1';
      const status = 'pending';

      const mockOrders = [
        {
          id: 'order-1',
          userId,
          tokenInAddress: '0x123',
          tokenInSymbol: 'ETH',
          tokenInDecimals: 18,
          tokenOutAddress: '0x456',
          tokenOutSymbol: 'USDC',
          tokenOutDecimals: 6,
          amountIn: '1.0',
          amountOutMin: '2000',
          price: '2000',
          type: 'sell',
          status: 'pending',
          filledAmountIn: '0',
          filledAmountOut: '0',
          slippageTolerance: '0.005',
          expiresAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockDb.limitOrder.findMany.mockResolvedValue(mockOrders);
      mockDb.trade.findMany.mockResolvedValue([]);

      const orders = await limitOrderService.getUserLimitOrders(userId, status);

      expect(orders).toHaveLength(1);
      expect(orders[0].userId).toBe(userId);
      expect(orders[0].status).toBe('pending');
    });

    it('should return all user orders if no status specified', async () => {
      const userId = 'user-1';

      const mockOrders = [
        {
          id: 'order-1',
          userId,
          status: 'pending'
        },
        {
          id: 'order-2',
          userId,
          status: 'filled'
        }
      ];

      mockDb.limitOrder.findMany.mockResolvedValue(mockOrders);
      mockDb.trade.findMany.mockResolvedValue([]);

      const orders = await limitOrderService.getUserLimitOrders(userId);

      expect(orders).toHaveLength(2);
    });
  });

  describe('getOrderBook', () => {
    it('should return order book for token pair', async () => {
      const tokenIn = {
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'ETH',
        decimals: 18
      };

      const tokenOut = {
        address: '0x0987654321098765432109876543210987654321',
        symbol: 'USDC',
        decimals: 6
      };

      const mockOrders = [
        // Buy orders (ETH for USDC)
        {
          id: 'buy-order-1',
          tokenInAddress: tokenIn.address,
          tokenOutAddress: tokenOut.address,
          price: '1950',
          amountIn: '1.0',
          filledAmountIn: '0',
          status: 'pending',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        },
        // Sell orders (USDC for ETH)
        {
          id: 'sell-order-1',
          tokenInAddress: tokenOut.address,
          tokenOutAddress: tokenIn.address,
          price: '2050',
          amountIn: '2000',
          filledAmountIn: '0',
          status: 'pending',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      ];

      mockDb.limitOrder.findMany.mockResolvedValue(mockOrders);

      const orderBook = await limitOrderService.getOrderBook(tokenIn, tokenOut);

      expect(orderBook).toBeDefined();
      expect(orderBook?.tokenIn.symbol).toBe('ETH');
      expect(orderBook?.tokenOut.symbol).toBe('USDC');
      expect(orderBook?.bids).toHaveLength(1); // Buy orders
      expect(orderBook?.asks).toHaveLength(1); // Sell orders
      expect(orderBook?.bids[0].price).toBe('1950');
      expect(orderBook?.asks[0].price).toBe('2050');
    });

    it('should return order book with empty arrays if no orders found', async () => {
      const tokenIn = {
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'ETH',
        decimals: 18
      };

      const tokenOut = {
        address: '0x0987654321098765432109876543210987654321',
        symbol: 'USDC',
        decimals: 6
      };

      mockDb.limitOrder.findMany.mockResolvedValue([]);

      const orderBook = await limitOrderService.getOrderBook(tokenIn, tokenOut);

      expect(orderBook).toBeDefined();
      expect(orderBook?.bids).toHaveLength(0);
      expect(orderBook?.asks).toHaveLength(0);
      expect(orderBook?.spread).toBe('0');
    });

    it('should calculate spread correctly', async () => {
      const tokenIn = {
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'ETH',
        decimals: 18
      };

      const tokenOut = {
        address: '0x0987654321098765432109876543210987654321',
        symbol: 'USDC',
        decimals: 6
      };

      const mockOrders = [
        // Best bid (highest buy price)
        {
          id: 'buy-order-1',
          tokenInAddress: tokenIn.address,
          tokenOutAddress: tokenOut.address,
          price: '1990',
          amountIn: '1.0',
          filledAmountIn: '0',
          status: 'pending',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        },
        // Best ask (lowest sell price)
        {
          id: 'sell-order-1',
          tokenInAddress: tokenOut.address,
          tokenOutAddress: tokenIn.address,
          price: '2010',
          amountIn: '2000',
          filledAmountIn: '0',
          status: 'pending',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      ];

      mockDb.limitOrder.findMany.mockResolvedValue(mockOrders);

      const orderBook = await limitOrderService.getOrderBook(tokenIn, tokenOut);

      expect(orderBook?.spread).toBe('20'); // 2010 - 1990 = 20
    });
  });

  describe('checkExpiredOrders', () => {
    it('should expire pending orders past their expiration time', async () => {
      const expiredOrdersCount = 5;
      const mockResult = { count: expiredOrdersCount };

      mockDb.limitOrder.updateMany.mockResolvedValue(mockResult);

      await limitOrderService.checkExpiredOrders();

      expect(mockDb.limitOrder.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'pending',
          expiresAt: { lt: expect.any(Date) }
        },
        data: {
          status: 'expired',
          updatedAt: expect.any(Date)
        }
      });
    });
  });

  describe('order book entry building', () => {
    it('should group orders by price and calculate totals', async () => {
      const tokenIn = {
        address: '0x123',
        symbol: 'ETH',
        decimals: 18
      };

      const tokenOut = {
        address: '0x456',
        symbol: 'USDC',
        decimals: 6
      };

      const mockOrders = [
        {
          id: 'order-1',
          tokenInAddress: tokenIn.address,
          tokenOutAddress: tokenOut.address,
          price: '2000',
          amountIn: '1.0',
          filledAmountIn: '0',
          status: 'pending'
        },
        {
          id: 'order-2',
          tokenInAddress: tokenIn.address,
          tokenOutAddress: tokenOut.address,
          price: '2000',
          amountIn: '0.5',
          filledAmountIn: '0',
          status: 'pending'
        },
        {
          id: 'order-3',
          tokenInAddress: tokenIn.address,
          tokenOutAddress: tokenOut.address,
          price: '2100',
          amountIn: '1.0',
          filledAmountIn: '0.2',
          status: 'pending'
        }
      ];

      mockDb.limitOrder.findMany.mockResolvedValue(mockOrders);

      const orderBook = await limitOrderService.getOrderBook(tokenIn, tokenOut);

      // Should have two price levels: 2000 and 2100
      expect(orderBook?.bids).toHaveLength(2);

      // Price 2000 should have total amount of 1.5 (1.0 + 0.5)
      const price2000Entry = orderBook?.bids.find(entry => entry.price === '2000');
      expect(price2000Entry?.amount).toBe('1.5');
      expect(price2000Entry?.total).toBe('3000'); // 2000 * 1.5
      expect(price2000Entry?.orderCount).toBe(2);

      // Price 2100 should have remaining amount of 0.8 (1.0 - 0.2)
      const price2100Entry = orderBook?.bids.find(entry => entry.price === '2100');
      expect(price2100Entry?.amount).toBe('0.8');
      expect(price2100Entry?.total).toBe('1680'); // 2100 * 0.8
      expect(price2100Entry?.orderCount).toBe(1);
    });

    it('should sort bids by price descending', async () => {
      const tokenIn = {
        address: '0x123',
        symbol: 'ETH',
        decimals: 18
      };

      const tokenOut = {
        address: '0x456',
        symbol: 'USDC',
        decimals: 6
      };

      const mockOrders = [
        {
          id: 'order-1',
          tokenInAddress: tokenIn.address,
          tokenOutAddress: tokenOut.address,
          price: '1900',
          amountIn: '1.0',
          filledAmountIn: '0',
          status: 'pending'
        },
        {
          id: 'order-2',
          tokenInAddress: tokenIn.address,
          tokenOutAddress: tokenOut.address,
          price: '2000',
          amountIn: '1.0',
          filledAmountIn: '0',
          status: 'pending'
        },
        {
          id: 'order-3',
          tokenInAddress: tokenIn.address,
          tokenOutAddress: tokenOut.address,
          price: '2100',
          amountIn: '1.0',
          filledAmountIn: '0',
          status: 'pending'
        }
      ];

      mockDb.limitOrder.findMany.mockResolvedValue(mockOrders);

      const orderBook = await limitOrderService.getOrderBook(tokenIn, tokenOut);

      // Bids should be sorted by price descending
      expect(orderBook?.bids[0].price).toBe('2100');
      expect(orderBook?.bids[1].price).toBe('2000');
      expect(orderBook?.bids[2].price).toBe('1900');
    });
  });
});