import { YieldFarmingService } from '../services/yield';
import { getDatabase } from '../config/database';

// Mock the database module
jest.mock('../config/database');
const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

describe('YieldFarmingService', () => {
  let yieldFarmingService: YieldFarmingService;
  let mockDb: any;

  beforeEach(() => {
    yieldFarmingService = new YieldFarmingService();

    // Mock database methods
    mockDb = {
      yieldFarm: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      },
      farmPosition: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      },
      liquidityPool: {
        findUnique: jest.fn(),
        findFirst: jest.fn()
      }
    };

    mockGetDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createFarm', () => {
    it('should create a new farm successfully', async () => {
      const request = {
        name: 'ETH-USDC Farm',
        description: 'Farm for ETH-USDC liquidity pool',
        poolId: 'pool-1',
        rewardToken: {
          address: '0x1234567890123456789012345678901234567890',
          symbol: 'MAGIC',
          decimals: 18
        },
        rewardRate: '0.1',
        totalRewards: '10000',
        durationDays: 365
      };

      const mockPool = {
        id: 'pool-1',
        token0Symbol: 'ETH',
        token1Symbol: 'USDC',
        fee: '0.003',
        isActive: true
      };

      const mockFarm = {
        id: 'farm-1',
        name: request.name,
        description: request.description,
        poolId: request.poolId,
        rewardTokenAddress: request.rewardToken.address,
        rewardTokenSymbol: request.rewardToken.symbol,
        rewardRate: request.rewardRate,
        totalStaked: '0',
        apr: '0',
        isActive: true,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.liquidityPool.findUnique.mockResolvedValue(mockPool);
      mockDb.yieldFarm.findFirst.mockResolvedValue(null); // No existing farm
      mockDb.yieldFarm.create.mockResolvedValue(mockFarm);

      const result = await yieldFarmingService.createFarm(request);

      expect(result.success).toBe(true);
      expect(result.farm).toBeDefined();
      expect(result.farm?.name).toBe('ETH-USDC Farm');
      expect(result.farm?.rewardToken.symbol).toBe('MAGIC');
    });

    it('should fail if pool not found', async () => {
      const request = {
        name: 'ETH-USDC Farm',
        poolId: 'non-existent-pool',
        rewardToken: {
          address: '0x1234567890123456789012345678901234567890',
          symbol: 'MAGIC',
          decimals: 18
        },
        rewardRate: '0.1'
      };

      mockDb.liquidityPool.findUnique.mockResolvedValue(null);

      const result = await yieldFarmingService.createFarm(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pool not found');
    });

    it('should fail if farm already exists for pool', async () => {
      const request = {
        name: 'ETH-USDC Farm',
        poolId: 'pool-1',
        rewardToken: {
          address: '0x1234567890123456789012345678901234567890',
          symbol: 'MAGIC',
          decimals: 18
        },
        rewardRate: '0.1'
      };

      mockDb.liquidityPool.findUnique.mockResolvedValue({ id: 'pool-1' });
      mockDb.yieldFarm.findFirst.mockResolvedValue({ id: 'existing-farm' });

      const result = await yieldFarmingService.createFarm(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Farm already exists for this pool');
    });
  });

  describe('stake', () => {
    it('should stake LP tokens successfully', async () => {
      const request = {
        farmId: 'farm-1',
        amount: '100',
        userAddress: 'user-1'
      };

      const mockFarm = {
        id: 'farm-1',
        poolId: 'pool-1',
        rewardRate: '0.1',
        totalStaked: '1000',
        apr: '10',
        isActive: true,
        endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      };

      const mockPosition = {
        id: 'position-1',
        userId: 'user-1',
        farmId: 'farm-1',
        amountStaked: '100',
        pendingRewards: '0',
        aprAtStake: '10',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.yieldFarm.findUnique.mockResolvedValue(mockFarm);
      mockDb.farmPosition.findUnique.mockResolvedValue(null); // No existing position
      mockDb.farmPosition.create.mockResolvedValue(mockPosition);
      mockDb.yieldFarm.update.mockResolvedValue({ ...mockFarm, totalStaked: '1100' });

      const result = await yieldFarmingService.stake(request);

      expect(result.success).toBe(true);
      expect(result.position).toBeDefined();
      expect(result.position?.amountStaked).toBe('100');
    });

    it('should fail if farm not found', async () => {
      const request = {
        farmId: 'non-existent-farm',
        amount: '100',
        userAddress: 'user-1'
      };

      mockDb.yieldFarm.findUnique.mockResolvedValue(null);

      const result = await yieldFarmingService.stake(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Farm not found');
    });

    it('should fail if farm is not active', async () => {
      const request = {
        farmId: 'farm-1',
        amount: '100',
        userAddress: 'user-1'
      };

      const mockFarm = {
        id: 'farm-1',
        isActive: false
      };

      mockDb.yieldFarm.findUnique.mockResolvedValue(mockFarm);

      const result = await yieldFarmingService.stake(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Farm is not active');
    });

    it('should add to existing position', async () => {
      const request = {
        farmId: 'farm-1',
        amount: '50',
        userAddress: 'user-1'
      };

      const mockFarm = {
        id: 'farm-1',
        poolId: 'pool-1',
        rewardRate: '0.1',
        totalStaked: '1000',
        apr: '10',
        isActive: true
      };

      const existingPosition = {
        id: 'position-1',
        userId: 'user-1',
        farmId: 'farm-1',
        amountStaked: '100',
        pendingRewards: '5',
        aprAtStake: '10'
      };

      const updatedPosition = {
        ...existingPosition,
        amountStaked: '150',
        updatedAt: new Date()
      };

      mockDb.yieldFarm.findUnique.mockResolvedValue(mockFarm);
      mockDb.farmPosition.findUnique.mockResolvedValue(existingPosition);
      mockDb.farmPosition.update.mockResolvedValue(updatedPosition);
      mockDb.yieldFarm.update.mockResolvedValue({ ...mockFarm, totalStaked: '1050' });

      const result = await yieldFarmingService.stake(request);

      expect(result.success).toBe(true);
      expect(result.position?.amountStaked).toBe('150');
    });
  });

  describe('unstake', () => {
    it('should unstake LP tokens successfully', async () => {
      const request = {
        farmId: 'farm-1',
        amount: '50',
        userAddress: 'user-1'
      };

      const mockFarm = {
        id: 'farm-1',
        poolId: 'pool-1',
        rewardRate: '0.1',
        totalStaked: '1000'
      };

      const mockPosition = {
        id: 'position-1',
        userId: 'user-1',
        farmId: 'farm-1',
        amountStaked: '100',
        pendingRewards: '5',
        updatedAt: new Date(Date.now() - 3600000) // 1 hour ago
      };

      const updatedPosition = {
        ...mockPosition,
        amountStaked: '50',
        pendingRewards: '5.1', // With calculated rewards
        updatedAt: new Date()
      };

      mockDb.yieldFarm.findUnique.mockResolvedValue(mockFarm);
      mockDb.farmPosition.findUnique.mockResolvedValue(mockPosition);
      mockDb.farmPosition.update.mockResolvedValue(updatedPosition);
      mockDb.yieldFarm.update.mockResolvedValue({ ...mockFarm, totalStaked: '950' });

      const result = await yieldFarmingService.unstake(request);

      expect(result.success).toBe(true);
      expect(result.position).toBeDefined();
      expect(result.position?.amountStaked).toBe('50');
      expect(result.amount).toBe('50');
    });

    it('should remove position entirely if unstaking all', async () => {
      const request = {
        farmId: 'farm-1',
        amount: '100',
        userAddress: 'user-1'
      };

      const mockFarm = {
        id: 'farm-1',
        poolId: 'pool-1',
        rewardRate: '0.1',
        totalStaked: '1000',
        rewardTokenAddress: '0x123',
        rewardTokenSymbol: 'MAGIC',
        name: 'Test Farm',
        apr: '10',
        isActive: true,
        startsAt: new Date(),
        endsAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockPosition = {
        id: 'position-1',
        userId: 'user-1',
        farmId: 'farm-1',
        amountStaked: '100',
        pendingRewards: '5',
        aprAtStake: '10',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.yieldFarm.findUnique.mockResolvedValue(mockFarm);
      mockDb.farmPosition.findUnique.mockResolvedValue(mockPosition);
      mockDb.farmPosition.delete.mockResolvedValue(mockPosition);
      mockDb.yieldFarm.update.mockResolvedValue({ ...mockFarm, totalStaked: '900' });

      const result = await yieldFarmingService.unstake(request);

      expect(result.success).toBe(true);
      expect(result.position).toBeUndefined();
      expect(result.amount).toBe('100');
    });

    it('should fail if insufficient staked amount', async () => {
      const request = {
        farmId: 'farm-1',
        amount: '200',
        userAddress: 'user-1'
      };

      const mockFarm = {
        id: 'farm-1',
        poolId: 'pool-1'
      };

      const mockPosition = {
        id: 'position-1',
        userId: 'user-1',
        farmId: 'farm-1',
        amountStaked: '100'
      };

      mockDb.yieldFarm.findUnique.mockResolvedValue(mockFarm);
      mockDb.farmPosition.findUnique.mockResolvedValue(mockPosition);

      const result = await yieldFarmingService.unstake(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient staked amount');
    });
  });

  describe('claimRewards', () => {
    it('should claim rewards successfully', async () => {
      const request = {
        farmId: 'farm-1',
        userAddress: 'user-1'
      };

      const mockFarm = {
        id: 'farm-1',
        poolId: 'pool-1',
        rewardRate: '0.1',
        totalStaked: '1000'
      };

      const mockPosition = {
        id: 'position-1',
        userId: 'user-1',
        farmId: 'farm-1',
        amountStaked: '100',
        pendingRewards: '5',
        updatedAt: new Date(Date.now() - 3600000) // 1 hour ago
      };

      const updatedPosition = {
        ...mockPosition,
        pendingRewards: '0',
        updatedAt: new Date()
      };

      mockDb.yieldFarm.findUnique.mockResolvedValue(mockFarm);
      mockDb.farmPosition.findUnique.mockResolvedValue(mockPosition);
      mockDb.farmPosition.update.mockResolvedValue(updatedPosition);

      const result = await yieldFarmingService.claimRewards(request);

      expect(result.success).toBe(true);
      expect(result.position).toBeDefined();
      expect(result.position?.pendingRewards).toBe('0');
      expect(result.rewardsClaimed).toBeDefined();
      expect(parseFloat(result.rewardsClaimed!)).toBeGreaterThan(0);
    });

    it('should fail if no rewards to claim', async () => {
      const request = {
        farmId: 'farm-1',
        userAddress: 'user-1'
      };

      const mockFarm = {
        id: 'farm-1',
        poolId: 'pool-1',
        rewardRate: '0',
        totalStaked: '1000',
        rewardTokenAddress: '0x123',
        rewardTokenSymbol: 'MAGIC',
        name: 'Test Farm',
        apr: '0',
        isActive: true,
        startsAt: new Date(),
        endsAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockPosition = {
        id: 'position-1',
        userId: 'user-1',
        farmId: 'farm-1',
        amountStaked: '100',
        pendingRewards: '0',
        aprAtStake: '0',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.yieldFarm.findUnique.mockResolvedValue(mockFarm);
      mockDb.farmPosition.findUnique.mockResolvedValue(mockPosition);

      const result = await yieldFarmingService.claimRewards(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No rewards to claim');
    });
  });

  describe('getAllFarms', () => {
    it('should return all active farms', async () => {
      const mockFarms = [
        {
          id: 'farm-1',
          name: 'ETH-USDC Farm',
          poolId: 'pool-1',
          rewardTokenAddress: '0x123...',
          rewardTokenSymbol: 'MAGIC',
          rewardRate: '0.1',
          totalStaked: '1000',
          apr: '10',
          isActive: true,
          startsAt: new Date(),
          endsAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'farm-2',
          name: 'USDC-USDT Farm',
          poolId: 'pool-2',
          rewardTokenAddress: '0x456...',
          rewardTokenSymbol: 'MAGIC',
          rewardRate: '0.05',
          totalStaked: '500',
          apr: '5',
          isActive: true,
          startsAt: new Date(),
          endsAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const mockPools = [
        {
          id: 'pool-1',
          token0Symbol: 'ETH',
          token1Symbol: 'USDC',
          fee: '0.003'
        },
        {
          id: 'pool-2',
          token0Symbol: 'USDC',
          token1Symbol: 'USDT',
          fee: '0.001'
        }
      ];

      mockDb.yieldFarm.findMany.mockResolvedValue(mockFarms);
      mockDb.liquidityPool.findUnique
        .mockResolvedValueOnce(mockPools[0])
        .mockResolvedValueOnce(mockPools[1]);

      const farms = await yieldFarmingService.getAllFarms();

      expect(farms).toHaveLength(2);
      expect(farms[0].name).toBe('ETH-USDC Farm');
      expect(farms[0].pool.token0Symbol).toBe('ETH');
      expect(farms[1].name).toBe('USDC-USDT Farm');
      expect(farms[1].pool.token0Symbol).toBe('USDC');
    });
  });

  describe('getFarmById', () => {
    it('should return farm by ID', async () => {
      const farmId = 'farm-1';
      const mockFarm = {
        id: farmId,
        name: 'ETH-USDC Farm',
        poolId: 'pool-1',
        rewardTokenAddress: '0x123...',
        rewardTokenSymbol: 'MAGIC',
        rewardRate: '0.1',
        totalStaked: '1000',
        apr: '10',
        isActive: true,
        startsAt: new Date(),
        endsAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockPool = {
        id: 'pool-1',
        token0Symbol: 'ETH',
        token1Symbol: 'USDC',
        fee: '0.003'
      };

      mockDb.yieldFarm.findUnique.mockResolvedValue(mockFarm);
      mockDb.liquidityPool.findUnique.mockResolvedValue(mockPool);

      const farm = await yieldFarmingService.getFarmById(farmId);

      expect(farm).toBeDefined();
      expect(farm?.id).toBe(farmId);
      expect(farm?.name).toBe('ETH-USDC Farm');
      expect(farm?.pool.token0Symbol).toBe('ETH');
    });

    it('should return null if farm not found', async () => {
      const farmId = 'non-existent-farm';

      mockDb.yieldFarm.findUnique.mockResolvedValue(null);

      const farm = await yieldFarmingService.getFarmById(farmId);

      expect(farm).toBeNull();
    });
  });

  describe('getUserPositions', () => {
    it('should return user positions', async () => {
      const userAddress = 'user-1';
      const mockPositions = [
        {
          id: 'position-1',
          userId: userAddress,
          farmId: 'farm-1',
          amountStaked: '100',
          pendingRewards: '5',
          aprAtStake: '10',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const mockFarm = {
        id: 'farm-1',
        name: 'ETH-USDC Farm',
        poolId: 'pool-1',
        rewardTokenAddress: '0x123...',
        rewardTokenSymbol: 'MAGIC',
        rewardRate: '0.1',
        totalStaked: '1000',
        apr: '10',
        isActive: true,
        startsAt: new Date(),
        endsAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockPool = {
        id: 'pool-1',
        token0Symbol: 'ETH',
        token1Symbol: 'USDC',
        fee: '0.003'
      };

      mockDb.farmPosition.findMany.mockResolvedValue(mockPositions);
      mockDb.yieldFarm.findUnique.mockResolvedValue(mockFarm);
      mockDb.liquidityPool.findUnique.mockResolvedValue(mockPool);

      const positions = await yieldFarmingService.getUserPositions(userAddress);

      expect(positions).toHaveLength(1);
      expect(positions[0].amountStaked).toBe('100');
      expect(positions[0].farm.name).toBe('ETH-USDC Farm');
    });
  });
});