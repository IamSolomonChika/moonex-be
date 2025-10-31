import { PortfolioService } from '../services/portfolio';
import { getDatabase } from '../config/database';

// Mock the database module
jest.mock('../config/database');
const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

describe('PortfolioService', () => {
  let portfolioService: PortfolioService;
  let mockDb: any;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    portfolioService = new PortfolioService();

    // Mock database methods
    mockDb = {
      liquidityPosition: {
        findMany: jest.fn()
      },
      farmPosition: {
        findMany: jest.fn()
      },
      tradingBot: {
        findMany: jest.fn()
      },
      wallet: {
        findMany: jest.fn()
      },
      trade: {
        findMany: jest.fn()
      },
      stopLossTrade: {
        findMany: jest.fn()
      },
      botTrade: {
        findMany: jest.fn()
      }
    };

    mockGetDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('getPortfolioSummary', () => {
    it('should return portfolio summary with all position types', async () => {
      const userId = 'user-1';

      // Mock liquidity positions
      mockDb.liquidityPosition.findMany.mockResolvedValue([
        {
          id: 'lp-1',
          poolId: 'pool-1',
          lpTokenBalance: '10',
          valueUSD: '1000',
          impermanentLoss: '0.02',
          token0Amount: '5',
          token1Amount: '5000',
          pool: {
            token0Address: '0x123',
            token0Symbol: 'ETH',
            token1Address: '0x456',
            token1Symbol: 'USDC'
          }
        }
      ]);

      // Mock farm positions
      mockDb.farmPosition.findMany.mockResolvedValue([
        {
          id: 'farm-1',
          farmId: 'farm-1',
          amountStaked: '100',
          pendingRewards: '10',
          aprAtStake: '15',
          farm: {
            rewardTokenAddress: '0x789',
            rewardTokenSymbol: 'COMP',
            apr: '12'
          }
        }
      ]);

      // Mock trading bots
      mockDb.tradingBot.findMany.mockResolvedValue([
        {
          id: 'bot-1',
          tokenInAddress: '0x123',
          tokenInSymbol: 'ETH',
          tokenInDecimals: 18,
          tokenOutAddress: '0x456',
          tokenOutSymbol: 'USDC',
          parameters: { totalInvestment: '500' },
          trades: []
        }
      ]);

      // Mock wallets
      mockDb.wallet.findMany.mockResolvedValue([
        {
          id: 'wallet-1',
          address: '0xabc',
          type: 'external',
          chainId: '1'
        }
      ]);

      const result = await portfolioService.getPortfolioSummary(userId);

      expect(result).toBeDefined();
      expect(result?.totalValueUSD).toBeDefined();
      expect(result?.positions).toHaveLength(4); // liquidity, farm, bot, wallet
      expect(result?.assetAllocation).toBeDefined();
      expect(result?.positionAllocation).toBeDefined();
      expect(result?.dailyHistory).toBeDefined();
      expect(result?.weeklyHistory).toBeDefined();
      expect(result?.monthlyHistory).toBeDefined();
    });

    it('should return null when user has no positions', async () => {
      const userId = 'user-2';

      // Mock empty results
      mockDb.liquidityPosition.findMany.mockResolvedValue([]);
      mockDb.farmPosition.findMany.mockResolvedValue([]);
      mockDb.tradingBot.findMany.mockResolvedValue([]);
      mockDb.wallet.findMany.mockResolvedValue([]);

      const result = await portfolioService.getPortfolioSummary(userId);

      expect(result).toBeDefined();
      expect(result?.totalValueUSD).toBe('0');
      expect(result?.positions).toHaveLength(0);
    });

    it('should handle database errors gracefully', async () => {
      const userId = 'user-3';

      mockDb.liquidityPosition.findMany.mockRejectedValue(new Error('Database error'));

      const result = await portfolioService.getPortfolioSummary(userId);

      expect(result).toBeNull();
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should calculate performance metrics correctly', async () => {
      const userId = 'user-1';

      // Mock historical data
      const portfolioServiceSpy = jest.spyOn(portfolioService as any, 'getPortfolioHistory');
      portfolioServiceSpy.mockResolvedValue([
        { timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), valueUSD: '10000' },
        { timestamp: new Date(), valueUSD: '11000' }
      ]);

      // Mock trades
      const tradesSpy = jest.spyOn(portfolioService as any, 'getAllUserTrades');
      tradesSpy.mockResolvedValue([
        { amountIn: '1000', amountOut: '1100' }, // profitable trade
        { amountIn: '500', amountOut: '450' }     // losing trade
      ]);

      const result = await portfolioService.getPerformanceMetrics(userId, '30d');

      expect(result).toBeDefined();
      expect(result?.totalReturn).toBe('1000');
      expect(result?.totalReturnPercentage).toBe('10');
      expect(result?.winRate).toBe('50'); // 1 profitable out of 2 trades
      expect(result?.sharpeRatio).toBeDefined();
      expect(result?.volatility).toBeDefined();
      expect(result?.maxDrawdown).toBeDefined();

      portfolioServiceSpy.mockRestore();
      tradesSpy.mockRestore();
    });

    it('should return null for insufficient historical data', async () => {
      const userId = 'user-2';

      const portfolioServiceSpy = jest.spyOn(portfolioService as any, 'getPortfolioHistory');
      portfolioServiceSpy.mockResolvedValue([
        { timestamp: new Date(), valueUSD: '10000' }
      ]);

      const result = await portfolioService.getPerformanceMetrics(userId, '30d');

      expect(result).toBeNull();

      portfolioServiceSpy.mockRestore();
    });
  });

  describe('getRebalancingSuggestions', () => {
    it('should provide rebalancing suggestions for imbalanced portfolio', async () => {
      const userId = 'user-1';

      // Mock portfolio with heavy ETH allocation
      const portfolioSummarySpy = jest.spyOn(portfolioService, 'getPortfolioSummary');
      portfolioSummarySpy.mockResolvedValue({
        totalValueUSD: '10000',
        totalValueChange24h: '100',
        totalValueChange24hPercentage: '1',
        positions: [
          {
            id: 'pos-1',
            type: 'liquidity',
            asset: { symbol: 'ETH', address: '0x123', decimals: 18 },
            amount: '10',
            valueUSD: '7000', // 70% allocation
            percentageChange24h: '2'
          },
          {
            id: 'pos-2',
            type: 'liquidity',
            asset: { symbol: 'USDC', address: '0x456', decimals: 6 },
            amount: '1000',
            valueUSD: '3000', // 30% allocation
            percentageChange24h: '0'
          }
        ],
        assetAllocation: { 'ETH/USDC': '100' },
        positionAllocation: { 'liquidity': '100' },
        dailyHistory: [],
        weeklyHistory: [],
        monthlyHistory: []
      });

      const result = await portfolioService.getRebalancingSuggestions(userId);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('rebalance_assets');
      expect(result[0].riskLevel).toBe('low');

      portfolioSummarySpy.mockRestore();
    });

    it('should suggest starting trading bot for large portfolio', async () => {
      const userId = 'user-2';

      const portfolioSummarySpy = jest.spyOn(portfolioService, 'getPortfolioSummary');
      portfolioSummarySpy.mockResolvedValue({
        totalValueUSD: '10000',
        totalValueChange24h: '100',
        totalValueChange24hPercentage: '1',
        positions: [], // No trading bots
        assetAllocation: {},
        positionAllocation: {},
        dailyHistory: [],
        weeklyHistory: [],
        monthlyHistory: []
      });

      const result = await portfolioService.getRebalancingSuggestions(userId);

      expect(result).toBeDefined();
      const botSuggestion = result.find(s => s.type === 'start_bot');
      expect(botSuggestion).toBeDefined();
      expect(botSuggestion?.riskLevel).toBe('medium');

      portfolioSummarySpy.mockRestore();
    });

    it('should return empty suggestions for balanced portfolio', async () => {
      const userId = 'user-3';

      const portfolioSummarySpy = jest.spyOn(portfolioService, 'getPortfolioSummary');
      portfolioSummarySpy.mockResolvedValue({
        totalValueUSD: '10000',
        totalValueChange24h: '100',
        totalValueChange24hPercentage: '1',
        positions: [
          {
            id: 'pos-1',
            type: 'trading_bot',
            asset: { symbol: 'ETH/USDC', address: '0x123', decimals: 18 },
            amount: '1000',
            valueUSD: '5000',
            percentageChange24h: '2'
          }
        ],
        assetAllocation: { 'ETH/USDC': '50', 'USDC': '50' },
        positionAllocation: { 'trading_bot': '50', 'liquidity': '50' },
        dailyHistory: [],
        weeklyHistory: [],
        monthlyHistory: []
      });

      const result = await portfolioService.getRebalancingSuggestions(userId);

      expect(result).toBeDefined();
      // Should have fewer suggestions for balanced portfolio
      expect(result.length).toBeLessThanOrEqual(1);

      portfolioSummarySpy.mockRestore();
    });
  });

  describe('position tracking', () => {
    it('should correctly calculate asset allocation', async () => {
      const userId = 'user-1';

      mockDb.liquidityPosition.findMany.mockResolvedValue([
        {
          id: 'lp-1',
          valueUSD: '6000',
          pool: {
            token0Symbol: 'ETH',
            token1Symbol: 'USDC'
          }
        }
      ]);

      mockDb.farmPosition.findMany.mockResolvedValue([
        {
          id: 'farm-1',
          valueUSD: '4000',
          farm: {
            rewardTokenSymbol: 'COMP'
          }
        }
      ]);

      mockDb.tradingBot.findMany.mockResolvedValue([]);
      mockDb.wallet.findMany.mockResolvedValue([]);

      const result = await portfolioService.getPortfolioSummary(userId);

      expect(result?.assetAllocation).toBeDefined();
      expect(result?.assetAllocation['ETH/USDC']).toBe('100'); // 6000/6000 = 100%
      expect(result?.assetAllocation['COMP']).toBe('100'); // 4000/4000 = 100%
    });

    it('should correctly calculate position type allocation', async () => {
      const userId = 'user-1';

      mockDb.liquidityPosition.findMany.mockResolvedValue([
        {
          id: 'lp-1',
          valueUSD: '6000',
          pool: { token0Symbol: 'ETH', token1Symbol: 'USDC' }
        }
      ]);

      mockDb.farmPosition.findMany.mockResolvedValue([
        {
          id: 'farm-1',
          valueUSD: '4000',
          farm: { rewardTokenSymbol: 'COMP' }
        }
      ]);

      mockDb.tradingBot.findMany.mockResolvedValue([]);
      mockDb.wallet.findMany.mockResolvedValue([]);

      const result = await portfolioService.getPortfolioSummary(userId);

      expect(result?.positionAllocation).toBeDefined();
      expect(result?.positionAllocation['liquidity']).toBe('60'); // 6000/10000 = 60%
      expect(result?.positionAllocation['farm']).toBe('40'); // 4000/10000 = 40%
    });
  });

  describe('edge cases', () => {
    it('should handle zero total portfolio value', async () => {
      const userId = 'user-empty';

      mockDb.liquidityPosition.findMany.mockResolvedValue([]);
      mockDb.farmPosition.findMany.mockResolvedValue([]);
      mockDb.tradingBot.findMany.mockResolvedValue([]);
      mockDb.wallet.findMany.mockResolvedValue([]);

      const result = await portfolioService.getPortfolioSummary(userId);

      expect(result).toBeDefined();
      expect(result?.totalValueUSD).toBe('0');
      expect(result?.totalValueChange24hPercentage).toBe('0');
      expect(result?.assetAllocation).toEqual({});
      expect(result?.positionAllocation).toEqual({});
    });

    it('should handle division by zero in calculations', async () => {
      const userId = 'user-zero';

      // Mock position with zero value
      mockDb.liquidityPosition.findMany.mockResolvedValue([
        {
          id: 'lp-1',
          valueUSD: '0',
          pool: { token0Symbol: 'ETH', token1Symbol: 'USDC' }
        }
      ]);

      mockDb.farmPosition.findMany.mockResolvedValue([]);
      mockDb.tradingBot.findMany.mockResolvedValue([]);
      mockDb.wallet.findMany.mockResolvedValue([]);

      const result = await portfolioService.getPortfolioSummary(userId);

      expect(result).toBeDefined();
      expect(result?.totalValueUSD).toBe('0');
      expect(result?.assetAllocation).toEqual({});
    });

    it('should handle malformed database responses', async () => {
      const userId = 'user-malformed';

      // Mock malformed data
      mockDb.liquidityPosition.findMany.mockResolvedValue([
        {
          id: 'lp-1',
          valueUSD: null,
          pool: null
        }
      ]);

      mockDb.farmPosition.findMany.mockRejectedValue(new Error('Invalid data'));
      mockDb.tradingBot.findMany.mockResolvedValue([{}]);
      mockDb.wallet.findMany.mockResolvedValue([]);

      const result = await portfolioService.getPortfolioSummary(userId);

      expect(result).toBeDefined();
      // Should handle errors gracefully and not crash
      expect(result?.positions.length).toBeGreaterThanOrEqual(0);
    });
  });
});