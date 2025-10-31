import { TradingBotService } from '../services/trading-bots';
import { getDatabase } from '../config/database';

// Mock the database module
jest.mock('../config/database');
const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

// Mock the background services to prevent intervals from starting
jest.mock('../services/stop-loss', () => ({
  StopLossOrderService: jest.fn().mockImplementation(() => ({
    checkAndTriggerOrders: jest.fn(),
    updateTrailingStops: jest.fn(),
    cleanup: jest.fn()
  }))
}));

jest.mock('../services/limit-orders', () => ({
  LimitOrderService: jest.fn().mockImplementation(() => ({
    checkExpiredOrders: jest.fn(),
    matchOrders: jest.fn(),
    cleanup: jest.fn()
  }))
}));

describe('TradingBotService', () => {
  let botService: TradingBotService;
  let mockDb: any;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    botService = new TradingBotService();

    // Mock database methods
    mockDb = {
      tradingBot: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      botTrade: {
        findMany: jest.fn(),
        create: jest.fn()
      }
    };

    mockGetDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('createBot', () => {
    it('should create a grid trading bot successfully', async () => {
      const userId = 'user-1';
      const name = 'Grid Bot ETH/USDC';
      const type = 'grid' as const;
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
      const parameters = {
        upperPrice: '2100',
        lowerPrice: '1900',
        gridCount: 10,
        totalInvestment: '1000'
      };

      const mockBot = {
        id: 'bot-1',
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
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.tradingBot.create.mockResolvedValue(mockBot);

      const result = await botService.createBot(userId, name, type, tokenIn, tokenOut, parameters);

      expect(result.success).toBe(true);
      expect(result.bot).toBeDefined();
      expect(result.bot?.name).toBe(name);
      expect(result.bot?.type).toBe('grid');
      expect(result.bot?.isActive).toBe(true);
    });

    it('should create a DCA bot successfully', async () => {
      const userId = 'user-1';
      const name = 'DCA Bot ETH/USDC';
      const type = 'dca' as const;
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
      const parameters = {
        totalInvestment: '1000',
        purchaseInterval: 24, // 24 hours
        purchaseAmount: '100'
      };

      const mockBot = {
        id: 'bot-1',
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
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.tradingBot.create.mockResolvedValue(mockBot);

      const result = await botService.createBot(userId, name, type, tokenIn, tokenOut, parameters);

      expect(result.success).toBe(true);
      expect(result.bot?.type).toBe('dca');
      expect(result.bot?.parameters.purchaseInterval).toBe(24);
    });

    it('should create a momentum bot successfully', async () => {
      const userId = 'user-1';
      const name = 'Momentum Bot ETH/USDC';
      const type = 'momentum' as const;
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
      const parameters = {
        rsiPeriod: 14,
        rsiOverbought: 70,
        rsiOversold: 30,
        investmentAmount: '1000'
      };

      const mockBot = {
        id: 'bot-1',
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
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.tradingBot.create.mockResolvedValue(mockBot);

      const result = await botService.createBot(userId, name, type, tokenIn, tokenOut, parameters);

      expect(result.success).toBe(true);
      expect(result.bot?.type).toBe('momentum');
      expect(result.bot?.parameters.rsiPeriod).toBe(14);
    });

    it('should fail if token addresses are the same', async () => {
      const userId = 'user-1';
      const name = 'Test Bot';
      const type = 'grid' as const;
      const tokenIn = {
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'ETH',
        decimals: 18
      };
      const tokenOut = {
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'ETH',
        decimals: 18
      };
      const parameters = {
        upperPrice: '2100',
        lowerPrice: '1900',
        gridCount: 10,
        totalInvestment: '1000'
      };

      const result = await botService.createBot(userId, name, type, tokenIn, tokenOut, parameters);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token addresses must be different');
    });

    it('should fail if grid parameters are invalid', async () => {
      const userId = 'user-1';
      const name = 'Test Bot';
      const type = 'grid' as const;
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
      const parameters = {
        upperPrice: '1900', // Upper price less than lower price
        lowerPrice: '2100',
        gridCount: 10,
        totalInvestment: '1000'
      };

      const result = await botService.createBot(userId, name, type, tokenIn, tokenOut, parameters);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Upper price must be greater than lower price');
    });

    it('should fail if DCA parameters are invalid', async () => {
      const userId = 'user-1';
      const name = 'Test Bot';
      const type = 'dca' as const;
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
      const parameters = {
        totalInvestment: '1000',
        purchaseInterval: -24, // Invalid interval
        purchaseAmount: '100'
      };

      const result = await botService.createBot(userId, name, type, tokenIn, tokenOut, parameters);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Purchase interval must be greater than 0');
    });

    it('should fail if momentum parameters are invalid', async () => {
      const userId = 'user-1';
      const name = 'Test Bot';
      const type = 'momentum' as const;
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
      const parameters = {
        rsiPeriod: 14,
        rsiOverbought: 30, // Overbought less than oversold
        rsiOversold: 70,
        investmentAmount: '1000'
      };

      const result = await botService.createBot(userId, name, type, tokenIn, tokenOut, parameters);

      expect(result.success).toBe(false);
      expect(result.error).toBe('RSI overbought level must be greater than oversold level');
    });
  });

  describe('stopBot', () => {
    it('should stop a bot successfully', async () => {
      const botId = 'bot-1';
      const userId = 'user-1';

      const mockBot = {
        id: botId,
        userId,
        name: 'Test Bot',
        type: 'grid',
        isActive: true
      };

      mockDb.tradingBot.findUnique.mockResolvedValue(mockBot);
      mockDb.tradingBot.update.mockResolvedValue({
        ...mockBot,
        isActive: false,
        updatedAt: new Date()
      });

      const result = await botService.stopBot(botId, userId);

      expect(result.success).toBe(true);
    });

    it('should fail if bot not found', async () => {
      const botId = 'non-existent-bot';
      const userId = 'user-1';

      mockDb.tradingBot.findUnique.mockResolvedValue(null);

      const result = await botService.stopBot(botId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bot not found');
    });

    it('should fail if bot does not belong to user', async () => {
      const botId = 'bot-1';
      const userId = 'user-1';

      const mockBot = {
        id: botId,
        userId: 'user-2', // Different user
        name: 'Test Bot',
        type: 'grid',
        isActive: true
      };

      mockDb.tradingBot.findUnique.mockResolvedValue(mockBot);

      const result = await botService.stopBot(botId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bot does not belong to user');
    });
  });

  describe('getUserBots', () => {
    it('should return user bots', async () => {
      const userId = 'user-1';

      const mockBots = [
        {
          id: 'bot-1',
          userId,
          name: 'Grid Bot',
          type: 'grid',
          tokenInAddress: '0x123',
          tokenInSymbol: 'ETH',
          tokenInDecimals: 18,
          tokenOutAddress: '0x456',
          tokenOutSymbol: 'USDC',
          tokenOutDecimals: 6,
          isActive: true,
          parameters: JSON.stringify({ upperPrice: '2100', lowerPrice: '1900' }),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'bot-2',
          userId,
          name: 'DCA Bot',
          type: 'dca',
          tokenInAddress: '0x123',
          tokenInSymbol: 'ETH',
          tokenInDecimals: 18,
          tokenOutAddress: '0x456',
          tokenOutSymbol: 'USDC',
          tokenOutDecimals: 6,
          isActive: false,
          parameters: JSON.stringify({ totalInvestment: '1000', purchaseInterval: 24 }),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockDb.tradingBot.findMany.mockResolvedValue(mockBots);

      const bots = await botService.getUserBots(userId);

      expect(bots).toHaveLength(2);
      expect(bots[0].name).toBe('Grid Bot');
      expect(bots[0].type).toBe('grid');
      expect(bots[0].isActive).toBe(true);
      expect(bots[1].name).toBe('DCA Bot');
      expect(bots[1].type).toBe('dca');
      expect(bots[1].isActive).toBe(false);
    });

    it('should return empty array if no bots', async () => {
      const userId = 'user-1';

      mockDb.tradingBot.findMany.mockResolvedValue([]);

      const bots = await botService.getUserBots(userId);

      expect(bots).toHaveLength(0);
    });
  });

  describe('getBotPerformance', () => {
    it('should return bot performance metrics', async () => {
      const botId = 'bot-1';
      const userId = 'user-1';

      const mockBot = {
        id: botId,
        userId,
        name: 'Test Bot',
        type: 'grid'
      };

      const mockTrades = [
        {
          id: 'trade-1',
          botId,
          type: 'buy',
          amountIn: '1.0',
          amountOut: '2000',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
        },
        {
          id: 'trade-2',
          botId,
          type: 'sell',
          amountIn: '1.0',
          amountOut: '2100',
          timestamp: new Date()
        }
      ];

      mockDb.tradingBot.findUnique.mockResolvedValue(mockBot);
      mockDb.botTrade.findMany.mockResolvedValue(mockTrades);

      const performance = await botService.getBotPerformance(botId, userId);

      expect(performance).toBeDefined();
      expect(performance?.totalTrades).toBe(2);
      expect(performance?.successfulTrades).toBe(1);
      expect(performance?.totalInvested).toBe('2000');
      expect(performance?.currentValue).toBe('2100');
      expect(performance?.profitLoss).toBe('100');
    });

    it('should return null if bot not found', async () => {
      const botId = 'non-existent-bot';
      const userId = 'user-1';

      mockDb.tradingBot.findUnique.mockResolvedValue(null);

      const performance = await botService.getBotPerformance(botId, userId);

      expect(performance).toBeNull();
    });

    it('should return zero metrics if no trades', async () => {
      const botId = 'bot-1';
      const userId = 'user-1';

      const mockBot = {
        id: botId,
        userId,
        name: 'Test Bot',
        type: 'grid'
      };

      mockDb.tradingBot.findUnique.mockResolvedValue(mockBot);
      mockDb.botTrade.findMany.mockResolvedValue([]);

      const performance = await botService.getBotPerformance(botId, userId);

      expect(performance).toBeDefined();
      expect(performance?.totalTrades).toBe(0);
      expect(performance?.successfulTrades).toBe(0);
      expect(performance?.totalInvested).toBe('0');
      expect(performance?.currentValue).toBe('0');
      expect(performance?.profitLoss).toBe('0');
    });
  });

  describe('parameter validation', () => {
    it('should validate grid trading parameters', async () => {
      const userId = 'user-1';
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

      // Mock successful bot creation for valid parameters
      const mockBot = {
        id: 'bot-1',
        userId,
        name: 'Test Bot',
        type: 'grid',
        tokenInAddress: tokenIn.address,
        tokenInSymbol: tokenIn.symbol,
        tokenInDecimals: tokenIn.decimals,
        tokenOutAddress: tokenOut.address,
        tokenOutSymbol: tokenOut.symbol,
        tokenOutDecimals: tokenOut.decimals,
        isActive: true,
        parameters: JSON.stringify({
          upperPrice: '2100',
          lowerPrice: '1900',
          gridCount: 10,
          totalInvestment: '1000'
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.tradingBot.create.mockResolvedValue(mockBot);

      // Test valid grid count
      const result1 = await botService.createBot(
        userId,
        'Test Bot',
        'grid',
        tokenIn,
        tokenOut,
        {
          upperPrice: '2100',
          lowerPrice: '1900',
          gridCount: 10, // Valid
          totalInvestment: '1000'
        }
      );

      expect(result1.success).toBe(true);

      // Test invalid grid count
      const result2 = await botService.createBot(
        userId,
        'Test Bot',
        'grid',
        tokenIn,
        tokenOut,
        {
          upperPrice: '2100',
          lowerPrice: '1900',
          gridCount: 0, // Invalid
          totalInvestment: '1000'
        }
      );

      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Grid count must be greater than 0');
    });

    it('should validate DCA parameters', async () => {
      const userId = 'user-1';
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

      // Invalid DCA parameters - provide invalid purchase interval
      const result1 = await botService.createBot(
        userId,
        'Test Bot',
        'dca',
        tokenIn,
        tokenOut,
        {
          totalInvestment: '1000',
          purchaseInterval: -24, // Invalid negative interval
          purchaseAmount: '100'
        }
      );

      expect(result1.success).toBe(false);
      expect(result1.error).toBe('Purchase interval must be greater than 0');
    });

    it('should validate momentum parameters', async () => {
      const userId = 'user-1';
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

      // Invalid RSI levels
      const result1 = await botService.createBot(
        userId,
        'Test Bot',
        'momentum',
        tokenIn,
        tokenOut,
        {
          rsiPeriod: 14,
          rsiOverbought: 30,
          rsiOversold: 70, // Overbought should be > oversold
          investmentAmount: '1000'
        }
      );

      expect(result1.success).toBe(false);
      expect(result1.error).toBe('RSI overbought level must be greater than oversold level');
    });
  });
});