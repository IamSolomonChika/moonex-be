import { LiquidityService } from '../services/liquidity';
import { getDatabase } from '../config/database';

// Mock the database module
jest.mock('../config/database');
const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

describe('LiquidityService', () => {
  let liquidityService: LiquidityService;
  let mockDb: any;

  beforeEach(() => {
    liquidityService = new LiquidityService();

    // Mock database methods
    mockDb = {
      liquidityPool: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      },
      liquidityPosition: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      }
    };

    mockGetDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPool', () => {
    it('should create a new pool successfully', async () => {
      const request = {
        token0: {
          address: '0x1234567890123456789012345678901234567890',
          symbol: 'ETH',
          decimals: 18
        },
        token1: {
          address: '0x0987654321098765432109876543210987654321',
          symbol: 'USDC',
          decimals: 6
        },
        fee: '0.003',
        initialAmount0: '1000',
        initialAmount1: '2000'
      };

      const mockPool = {
        id: 'pool-1',
        address: '0xpooladdress1234567890123456789012345678901234',
        token0Address: request.token0.address,
        token1Address: request.token1.address,
        token0Symbol: request.token0.symbol,
        token1Symbol: request.token1.symbol,
        token0Decimals: request.token0.decimals,
        token1Decimals: request.token1.decimals,
        reserve0: '1000',
        reserve1: '2000',
        totalSupply: '1414.21',
        fee: '0.003',
        isActive: true,
        volume24h: '0',
        fee24h: '0',
        tvl: '3000',
        apr: '0',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.liquidityPool.findFirst.mockResolvedValue(null); // No existing pool
      mockDb.liquidityPool.create.mockResolvedValue(mockPool);

      const result = await liquidityService.createPool(request);

      expect(result.success).toBe(true);
      expect(result.pool).toBeDefined();
      expect(result.pool?.token0.symbol).toBe('ETH');
      expect(result.pool?.token1.symbol).toBe('USDC');
      expect(result.lpTokens).toBe('1414.21');
    });

    it('should fail if tokens are the same', async () => {
      const request = {
        token0: {
          address: '0x1234567890123456789012345678901234567890',
          symbol: 'ETH',
          decimals: 18
        },
        token1: {
          address: '0x1234567890123456789012345678901234567890',
          symbol: 'ETH',
          decimals: 18
        }
      };

      const result = await liquidityService.createPool(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token addresses must be different');
    });

    it('should fail if pool already exists', async () => {
      const request = {
        token0: {
          address: '0x1234567890123456789012345678901234567890',
          symbol: 'ETH',
          decimals: 18
        },
        token1: {
          address: '0x0987654321098765432109876543210987654321',
          symbol: 'USDC',
          decimals: 6
        }
      };

      mockDb.liquidityPool.findFirst.mockResolvedValue({ id: 'existing-pool' });

      const result = await liquidityService.createPool(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pool already exists for this token pair');
    });
  });

  describe('addLiquidity', () => {
    it('should add liquidity successfully', async () => {
      const request = {
        poolId: 'pool-1',
        amount0: '100',
        amount1: '200',
        slippageTolerance: '0.005',
        minimumLPTokens: '140',
        userAddress: 'user-1'
      };

      const mockPool = {
        id: 'pool-1',
        token0Symbol: 'ETH',
        token1Symbol: 'USDC',
        reserve0: '1000',
        reserve1: '2000',
        totalSupply: '1414.21'
      };

      const mockUpdatedPool = {
        ...mockPool,
        reserve0: '1100',
        reserve1: '2200',
        totalSupply: '1555.63',
        tvl: '3300'
      };

      mockDb.liquidityPool.findUnique.mockResolvedValue(mockPool);
      mockDb.liquidityPool.update.mockResolvedValue(mockUpdatedPool);
      mockDb.liquidityPosition.findUnique.mockResolvedValue(null); // No existing position
      mockDb.liquidityPosition.create.mockResolvedValue({ id: 'position-1' });

      const result = await liquidityService.addLiquidity(request);

      expect(result.success).toBe(true);
      expect(result.pool).toBeDefined();
      expect(result.lpTokens).toBeDefined();
      expect(result.amounts).toBeDefined();
      expect(parseFloat(result.amounts!.token0)).toBeCloseTo(100, 0);
      expect(parseFloat(result.amounts!.token1)).toBeCloseTo(200, 0);
    });

    it('should fail if pool not found', async () => {
      const request = {
        poolId: 'non-existent-pool',
        amount0: '100',
        amount1: '200',
        userAddress: 'user-1'
      };

      mockDb.liquidityPool.findUnique.mockResolvedValue(null);

      const result = await liquidityService.addLiquidity(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pool not found');
    });
  });

  describe('removeLiquidity', () => {
    it('should remove liquidity successfully', async () => {
      const request = {
        poolId: 'pool-1',
        lpTokenAmount: '141.42',
        slippageTolerance: '0.005',
        minimumAmount0: '90',
        minimumAmount1: '180',
        userAddress: 'user-1'
      };

      const mockPool = {
        id: 'pool-1',
        token0Symbol: 'ETH',
        token1Symbol: 'USDC',
        reserve0: '1000',
        reserve1: '2000',
        totalSupply: '1414.21'
      };

      const mockUpdatedPool = {
        ...mockPool,
        reserve0: '900',
        reserve1: '1800',
        totalSupply: '1272.79',
        tvl: '2700'
      };

      mockDb.liquidityPool.findUnique.mockResolvedValue(mockPool);
      mockDb.liquidityPool.update.mockResolvedValue(mockUpdatedPool);
      mockDb.liquidityPosition.findUnique.mockResolvedValue({
        id: 'position-1',
        lpTokenBalance: '141.42'
      });
      mockDb.liquidityPosition.update.mockResolvedValue({});

      const result = await liquidityService.removeLiquidity(request);

      expect(result.success).toBe(true);
      expect(result.pool).toBeDefined();
      expect(result.amounts).toBeDefined();
      expect(parseFloat(result.amounts!.token0)).toBeCloseTo(100, 0);
      expect(parseFloat(result.amounts!.token1)).toBeCloseTo(200, 0);
      expect(result.impermanentLoss).toBeDefined();
    });

    it('should fail if LP token amount exceeds total supply', async () => {
      const request = {
        poolId: 'pool-1',
        lpTokenAmount: '2000',
        userAddress: 'user-1'
      };

      const mockPool = {
        totalSupply: '1414.21'
      };

      mockDb.liquidityPool.findUnique.mockResolvedValue(mockPool);

      const result = await liquidityService.removeLiquidity(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('LP token amount exceeds total supply');
    });
  });

  describe('getPoolByTokenPair', () => {
    it('should find pool by token pair', async () => {
      const tokenA = {
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'ETH',
        decimals: 18
      };

      const tokenB = {
        address: '0x0987654321098765432109876543210987654321',
        symbol: 'USDC',
        decimals: 6
      };

      const mockPool = {
        id: 'pool-1',
        token0Address: tokenA.address,
        token1Address: tokenB.address,
        token0Symbol: tokenA.symbol,
        token1Symbol: tokenB.symbol,
        token0Decimals: tokenA.decimals,
        token1Decimals: tokenB.decimals,
        reserve0: '1000',
        reserve1: '2000',
        totalSupply: '1414.21',
        fee: '0.003',
        isActive: true,
        volume24h: '10000',
        fee24h: '30',
        tvl: '3000',
        apr: '5.5',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.liquidityPool.findFirst.mockResolvedValue(mockPool);

      const result = await liquidityService.getPoolByTokenPair(tokenA, tokenB);

      expect(result).toBeDefined();
      expect(result?.token0.symbol).toBe('ETH');
      expect(result?.token1.symbol).toBe('USDC');
      expect(result?.reserve0).toBe('1000');
      expect(result?.reserve1).toBe('2000');
    });

    it('should return null if no pool found', async () => {
      const tokenA = {
        address: '0x1234567890123456789012345678901234567890',
        symbol: 'ETH',
        decimals: 18
      };

      const tokenB = {
        address: '0x0987654321098765432109876543210987654321',
        symbol: 'USDC',
        decimals: 6
      };

      mockDb.liquidityPool.findFirst.mockResolvedValue(null);

      const result = await liquidityService.getPoolByTokenPair(tokenA, tokenB);

      expect(result).toBeNull();
    });
  });

  describe('getPoolAnalytics', () => {
    it('should return pool analytics', async () => {
      const poolId = 'pool-1';

      const mockPool = {
        id: poolId,
        reserve0: '1000',
        reserve1: '2000',
        volume24h: '10000',
        fee24h: '30',
        tvl: '3000',
        apr: '5.5',
        totalSupply: '1414.21'
      };

      jest.spyOn(liquidityService, 'getPoolById').mockResolvedValue({
        id: poolId,
        address: '0xpooladdress',
        token0: { address: '0x0', symbol: 'ETH', decimals: 18 },
        token1: { address: '0x1', symbol: 'USDC', decimals: 6 },
        reserve0: '1000',
        reserve1: '2000',
        totalSupply: '1414.21',
        fee: '0.003',
        volume24h: '10000',
        fee24h: '30',
        tvl: '3000',
        apr: '5.5',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await liquidityService.getPoolAnalytics(poolId);

      expect(result).toBeDefined();
      expect(result?.volume24h).toBe('10000');
      expect(result?.tvl).toBe('3000');
      expect(result?.apr).toBe('5.5');
      expect(parseFloat(result?.price0 || '0')).toBeCloseTo(2, 1); // 2000/1000
      expect(parseFloat(result?.price1 || '0')).toBeCloseTo(0.5, 1); // 1000/2000
    });

    it('should return null if pool not found', async () => {
      const poolId = 'non-existent-pool';

      jest.spyOn(liquidityService, 'getPoolById').mockResolvedValue(null);

      const result = await liquidityService.getPoolAnalytics(poolId);

      expect(result).toBeNull();
    });
  });
});