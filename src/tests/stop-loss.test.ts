import { StopLossOrderService } from '../services/stop-loss';
import { getDatabase } from '../config/database';

// Mock the database module
jest.mock('../config/database');
const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

describe('StopLossOrderService', () => {
  let stopLossService: StopLossOrderService;
  let mockDb: any;

  beforeEach(() => {
    stopLossService = new StopLossOrderService();

    // Mock database methods
    mockDb = {
      stopLossOrder: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn()
      },
      stopLossTrade: {
        findMany: jest.fn(),
        create: jest.fn()
      }
    };

    mockGetDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createStopLossOrder', () => {
    it('should create a new stop loss order successfully', async () => {
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
        stopPrice: '1900',
        type: 'stop-loss' as const,
        gasPrice: '20000000000',
        gasLimit: '100000',
        slippageTolerance: '0.01'
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
        stopPrice: request.stopPrice,
        type: request.type,
        status: 'active',
        filledAmountIn: '0',
        filledAmountOut: '0',
        gasPrice: request.gasPrice,
        gasLimit: request.gasLimit,
        slippageTolerance: request.slippageTolerance,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.stopLossOrder.create.mockResolvedValue(mockOrder);
      mockDb.stopLossTrade.findMany.mockResolvedValue([]);

      const result = await stopLossService.createStopLossOrder(request, 'user-1');

      expect(result.success).toBe(true);
      expect(result.order).toBeDefined();
      expect(result.order?.tokenIn.symbol).toBe('ETH');
      expect(result.order?.tokenOut.symbol).toBe('USDC');
      expect(result.order?.type).toBe('stop-loss');
      expect(result.order?.status).toBe('active');
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
        stopPrice: '1',
        type: 'stop-loss' as const
      };

      const result = await stopLossService.createStopLossOrder(request, 'user-1');

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
        stopPrice: '1900',
        type: 'stop-loss' as const
      };

      const result = await stopLossService.createStopLossOrder(request, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Amount in must be greater than 0');
    });

    it('should fail if stop price is zero or negative', async () => {
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
        stopPrice: '0',
        type: 'stop-loss' as const
      };

      const result = await stopLossService.createStopLossOrder(request, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Stop price must be greater than 0');
    });

    it('should fail if both trail amount and trail percentage are specified', async () => {
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
        stopPrice: '1900',
        type: 'stop-loss' as const,
        trailAmount: '100',
        trailPercentage: '5'
      };

      const result = await stopLossService.createStopLossOrder(request, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot specify both trail amount and trail percentage');
    });

    it('should fail if trail percentage is out of range', async () => {
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
        stopPrice: '1900',
        type: 'stop-loss' as const,
        trailPercentage: '150' // > 100%
      };

      const result = await stopLossService.createStopLossOrder(request, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Trail percentage must be between 0 and 100');
    });
  });

  describe('cancelStopLossOrder', () => {
    it('should cancel a stop loss order successfully', async () => {
      const orderId = 'order-1';
      const userId = 'user-1';

      const mockOrder = {
        id: orderId,
        userId,
        status: 'active'
      };

      const updatedOrder = {
        ...mockOrder,
        status: 'cancelled',
        updatedAt: new Date()
      };

      mockDb.stopLossOrder.findUnique.mockResolvedValue(mockOrder);
      mockDb.stopLossOrder.update.mockResolvedValue(updatedOrder);
      mockDb.stopLossTrade.findMany.mockResolvedValue([]);

      const result = await stopLossService.cancelStopLossOrder(orderId, userId);

      expect(result.success).toBe(true);
      expect(result.order?.status).toBe('cancelled');
    });

    it('should fail if order not found', async () => {
      const orderId = 'non-existent-order';
      const userId = 'user-1';

      mockDb.stopLossOrder.findUnique.mockResolvedValue(null);

      const result = await stopLossService.cancelStopLossOrder(orderId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');
    });

    it('should fail if order does not belong to user', async () => {
      const orderId = 'order-1';
      const userId = 'user-1';

      const mockOrder = {
        id: orderId,
        userId: 'user-2', // Different user
        status: 'active'
      };

      mockDb.stopLossOrder.findUnique.mockResolvedValue(mockOrder);

      const result = await stopLossService.cancelStopLossOrder(orderId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order does not belong to user');
    });

    it('should fail if order is not active', async () => {
      const orderId = 'order-1';
      const userId = 'user-1';

      const mockOrder = {
        id: orderId,
        userId,
        status: 'triggered' // Already triggered
      };

      mockDb.stopLossOrder.findUnique.mockResolvedValue(mockOrder);

      const result = await stopLossService.cancelStopLossOrder(orderId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order cannot be cancelled');
    });
  });

  describe('getUserStopLossOrders', () => {
    it('should return user orders with status filter', async () => {
      const userId = 'user-1';
      const status = 'active';

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
          stopPrice: '1900',
          type: 'stop-loss',
          status: 'active',
          filledAmountIn: '0',
          filledAmountOut: '0',
          slippageTolerance: '0.01',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockDb.stopLossOrder.findMany.mockResolvedValue(mockOrders);
      mockDb.stopLossTrade.findMany.mockResolvedValue([]);

      const orders = await stopLossService.getUserStopLossOrders(userId, status);

      expect(orders).toHaveLength(1);
      expect(orders[0].userId).toBe(userId);
      expect(orders[0].status).toBe('active');
    });

    it('should return all user orders if no status specified', async () => {
      const userId = 'user-1';

      const mockOrders = [
        {
          id: 'order-1',
          userId,
          status: 'active'
        },
        {
          id: 'order-2',
          userId,
          status: 'triggered'
        }
      ];

      mockDb.stopLossOrder.findMany.mockResolvedValue(mockOrders);
      mockDb.stopLossTrade.findMany.mockResolvedValue([]);

      const orders = await stopLossService.getUserStopLossOrders(userId);

      expect(orders).toHaveLength(2);
    });
  });

  describe('checkAndTriggerOrders', () => {
    it('should trigger stop loss order when price drops below stop price', async () => {
      const mockOrder = {
        id: 'order-1',
        userId: 'user-1',
        tokenInAddress: '0x123',
        tokenOutAddress: '0x456',
        tokenInSymbol: 'ETH',
        tokenInDecimals: 18,
        tokenOutSymbol: 'USDC',
        tokenOutDecimals: 6,
        amountIn: '1.0',
        stopPrice: '1900',
        type: 'stop-loss',
        status: 'active',
        filledAmountIn: '0',
        filledAmountOut: '0',
        slippageTolerance: '0.01',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockTrade = {
        id: 'trade-1',
        orderId: mockOrder.id,
        userId: mockOrder.userId,
        tokenInAddress: mockOrder.tokenInAddress,
        tokenInSymbol: mockOrder.tokenInSymbol,
        tokenOutAddress: mockOrder.tokenOutAddress,
        tokenOutSymbol: mockOrder.tokenOutSymbol,
        amountIn: mockOrder.amountIn,
        amountOut: '1895',
        price: '1895',
        fee: '0',
        transactionHash: '0xpending',
        createdAt: new Date()
      };

      mockDb.stopLossOrder.findMany.mockResolvedValue([mockOrder]);
      mockDb.stopLossTrade.create.mockResolvedValue(mockTrade);
      mockDb.stopLossOrder.update.mockResolvedValue({
        ...mockOrder,
        status: 'triggered',
        triggeredPrice: '1895'
      });

      await stopLossService.checkAndTriggerOrders();

      expect(mockDb.stopLossTrade.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: mockOrder.id,
          userId: mockOrder.userId,
          amountOut: expect.any(String),
          price: expect.any(String)
        })
      });

      expect(mockDb.stopLossOrder.update).toHaveBeenCalledWith({
        where: { id: mockOrder.id },
        data: expect.objectContaining({
          status: 'triggered',
          triggeredPrice: expect.any(String)
        })
      });
    });

    it('should trigger take profit order when price rises above stop price', async () => {
      const mockOrder = {
        id: 'order-1',
        userId: 'user-1',
        tokenInAddress: '0x123',
        tokenOutAddress: '0x789',
        tokenInSymbol: 'ETH',
        tokenInDecimals: 18,
        tokenOutSymbol: 'USDT',
        tokenOutDecimals: 6,
        amountIn: '1.0',
        stopPrice: '2100',
        type: 'take-profit',
        status: 'active',
        filledAmountIn: '0',
        filledAmountOut: '0',
        slippageTolerance: '0.01',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockTrade = {
        id: 'trade-1',
        orderId: mockOrder.id,
        userId: mockOrder.userId,
        tokenInAddress: mockOrder.tokenInAddress,
        tokenInSymbol: mockOrder.tokenInSymbol,
        tokenOutAddress: mockOrder.tokenOutAddress,
        tokenOutSymbol: mockOrder.tokenOutSymbol,
        amountIn: mockOrder.amountIn,
        amountOut: '2105',
        price: '2105',
        fee: '0',
        transactionHash: '0xpending',
        createdAt: new Date()
      };

      mockDb.stopLossOrder.findMany.mockResolvedValue([mockOrder]);
      mockDb.stopLossTrade.create.mockResolvedValue(mockTrade);
      mockDb.stopLossOrder.update.mockResolvedValue({
        ...mockOrder,
        status: 'triggered',
        triggeredPrice: '2105'
      });

      await stopLossService.checkAndTriggerOrders();

      expect(mockDb.stopLossTrade.create).toHaveBeenCalled();
      expect(mockDb.stopLossOrder.update).toHaveBeenCalledWith({
        where: { id: mockOrder.id },
        data: expect.objectContaining({
          status: 'triggered'
        })
      });
    });

    it('should not trigger order if price condition is not met', async () => {
      const mockOrder = {
        id: 'order-1',
        stopPrice: '1900',
        type: 'stop-loss',
        status: 'active'
      };

      mockDb.stopLossOrder.findMany.mockResolvedValue([mockOrder]);

      await stopLossService.checkAndTriggerOrders();

      expect(mockDb.stopLossTrade.create).not.toHaveBeenCalled();
      expect(mockDb.stopLossOrder.update).not.toHaveBeenCalled();
    });
  });

  describe('updateTrailingStops', () => {
    it('should update trailing stop price for stop-loss order with trail amount', async () => {
      const mockOrder = {
        id: 'order-1',
        tokenInAddress: '0x123',
        tokenOutAddress: '0x456',
        tokenInSymbol: 'ETH',
        tokenInDecimals: 18,
        tokenOutSymbol: 'USDC',
        tokenOutDecimals: 6,
        stopPrice: '1700', // Lower than calculated trailing price
        type: 'stop-loss',
        status: 'active',
        trailAmount: '100',
        filledAmountIn: '0',
        filledAmountOut: '0',
        slippageTolerance: '0.01',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.stopLossOrder.findMany.mockResolvedValue([mockOrder]);
      mockDb.stopLossOrder.update.mockResolvedValue({
        ...mockOrder,
        stopPrice: '1795' // Updated trailing price (1895 - 100)
      });

      await stopLossService.updateTrailingStops();

      expect(mockDb.stopLossOrder.update).toHaveBeenCalledWith({
        where: { id: mockOrder.id },
        data: expect.objectContaining({
          stopPrice: '1795'
        })
      });
    });

    it('should update trailing stop price for take-profit order with trail percentage', async () => {
      const mockOrder = {
        id: 'order-1',
        tokenInAddress: '0x123',
        tokenOutAddress: '0x789',
        tokenInSymbol: 'ETH',
        tokenInDecimals: 18,
        tokenOutSymbol: 'USDT',
        tokenOutDecimals: 6,
        stopPrice: '2150', // Higher than current price 2105
        type: 'take-profit',
        status: 'active',
        trailPercentage: '5',
        filledAmountIn: '0',
        filledAmountOut: '0',
        slippageTolerance: '0.01',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.stopLossOrder.findMany.mockResolvedValue([mockOrder]);
      mockDb.stopLossOrder.update.mockResolvedValue({
        ...mockOrder,
        stopPrice: '2109.5' // Updated trailing price
      });

      await stopLossService.updateTrailingStops();

      expect(mockDb.stopLossOrder.update).toHaveBeenCalledWith({
        where: { id: mockOrder.id },
        data: expect.objectContaining({
          stopPrice: '2107.25'
        })
      });
    });

    it('should not update trailing stop if new price is worse for user', async () => {
      const mockOrder = {
        id: 'order-1',
        tokenInAddress: '0x123',
        tokenOutAddress: '0x456',
        tokenInSymbol: 'ETH',
        tokenInDecimals: 18,
        tokenOutSymbol: 'USDC',
        tokenOutDecimals: 6,
        stopPrice: '1950', // Higher than calculated trailing price
        type: 'stop-loss',
        status: 'active',
        trailAmount: '100',
        filledAmountIn: '0',
        filledAmountOut: '0',
        slippageTolerance: '0.01',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.stopLossOrder.findMany.mockResolvedValue([mockOrder]);

      await stopLossService.updateTrailingStops();

      // Should not call update if trailing stop doesn't improve
      expect(mockDb.stopLossOrder.update).not.toHaveBeenCalled();
    });
  });

  describe('trailing stop calculations', () => {
    it('should calculate correct trailing stop for stop-loss with trail amount', async () => {
      const mockOrder = {
        id: 'order-1',
        tokenInAddress: '0x123',
        tokenOutAddress: '0x456',
        tokenInSymbol: 'ETH',
        tokenInDecimals: 18,
        tokenOutSymbol: 'USDC',
        tokenOutDecimals: 6,
        stopPrice: '1790', // Lower than calculated trailing price of 1795
        type: 'stop-loss',
        status: 'active',
        trailAmount: '100',
        filledAmountIn: '0',
        filledAmountOut: '0',
        slippageTolerance: '0.01',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.stopLossOrder.findMany.mockResolvedValue([mockOrder]);

      // When price is 1895 and trail amount is 100, calculated stop is 1795 (1895 - 100)
      // Since current stop is 1790, it should be updated to 1795
      await stopLossService.updateTrailingStops();

      expect(mockDb.stopLossOrder.update).toHaveBeenCalled();
    });

    it('should calculate correct trailing stop for take-profit with trail percentage', async () => {
      const mockOrder = {
        id: 'order-1',
        tokenInAddress: '0x123',
        tokenOutAddress: '0x789',
        tokenInSymbol: 'ETH',
        tokenInDecimals: 18,
        tokenOutSymbol: 'USDT',
        tokenOutDecimals: 6,
        stopPrice: '2050', // Lower than current price 2105
        type: 'take-profit',
        status: 'active',
        trailPercentage: '10',
        filledAmountIn: '0',
        filledAmountOut: '0',
        slippageTolerance: '0.01',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.stopLossOrder.findMany.mockResolvedValue([mockOrder]);

      await stopLossService.updateTrailingStops();

      // Take-profit with trail percentage when current price > stop price
      // priceDifference = 2050 - 2105 = -55 (negative), so no update
      expect(mockDb.stopLossOrder.update).not.toHaveBeenCalled();
    });
  });
});