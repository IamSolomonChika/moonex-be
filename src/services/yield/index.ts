import { getDatabase } from '../../config/database';
import logger from '../../utils/logger';
import type { YieldFarm as DbYieldFarm, FarmPosition as DbFarmPosition, LiquidityPool as DbLiquidityPool } from '../../generated/prisma';

/**
 * Yield farm interface
 */
export interface YieldFarm {
  id: string;
  name: string;
  description?: string;
  poolId: string;
  pool: {
    id: string;
    token0Symbol: string;
    token1Symbol: string;
    fee: string;
  };
  rewardToken: {
    address: string;
    symbol: string;
    decimals: number;
  };
  rewardRate: string; // Rewards per second
  totalStaked: string;
  apr: string;
  isActive: boolean;
  startsAt: Date;
  endsAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Farm position interface
 */
export interface FarmPosition {
  id: string;
  farmId: string;
  farm: YieldFarm;
  amountStaked: string;
  pendingRewards: string;
  aprAtStake: string;
  createdAt: Date;
  updatedAt: Date;
  rewardsHistory: RewardHistory[];
}

/**
 * Reward history interface
 */
export interface RewardHistory {
  id: string;
  amount: string;
  timestamp: Date;
  type: 'earned' | 'claimed';
}

/**
 * Create farm request interface
 */
export interface CreateFarmRequest {
  name: string;
  description?: string;
  poolId: string;
  rewardToken: {
    address: string;
    symbol: string;
    decimals: number;
  };
  rewardRate: string;
  totalRewards?: string;
  durationDays?: number;
  startsAt?: Date;
  endsAt?: Date;
}

/**
 * Stake request interface
 */
export interface StakeRequest {
  farmId: string;
  amount: string;
  userAddress: string;
}

/**
 * Unstake request interface
 */
export interface UnstakeRequest {
  farmId: string;
  amount: string;
  userAddress: string;
}

/**
 * Claim rewards request interface
 */
export interface ClaimRewardsRequest {
  farmId: string;
  userAddress: string;
}

/**
 * Farm operation result interface
 */
export interface FarmOperationResult {
  success: boolean;
  farm?: YieldFarm;
  position?: FarmPosition;
  rewardsClaimed?: string;
  amount?: string;
  error?: string;
  warnings?: string[];
}

/**
 * Yield Farming Service class
 */
export class YieldFarmingService {
  private readonly SECONDS_PER_YEAR = 31536000; // 365 * 24 * 60 * 60

  constructor() {}

  /**
   * Create a new yield farm
   */
  async createFarm(request: CreateFarmRequest): Promise<FarmOperationResult> {
    try {
      const {
        name,
        description,
        poolId,
        rewardToken,
        rewardRate,
        totalRewards,
        durationDays,
        startsAt,
        endsAt
      } = request;

      // Validate pool exists
      const pool = await this.getPoolById(poolId);
      if (!pool) {
        return {
          success: false,
          error: 'Pool not found'
        };
      }

      // Check if farm already exists for this pool
      const existingFarm = await this.getFarmByPool(poolId);
      if (existingFarm) {
        return {
          success: false,
          error: 'Farm already exists for this pool'
        };
      }

      // Calculate duration
      const now = new Date();
      const farmStartsAt = startsAt || now;
      const farmEndsAt = endsAt || (
        durationDays
          ? new Date(farmStartsAt.getTime() + durationDays * 24 * 60 * 60 * 1000)
          : undefined
      );

      // Calculate total rewards if not provided
      const farmDuration = farmEndsAt
        ? (farmEndsAt.getTime() - farmStartsAt.getTime()) / 1000 // seconds
        : durationDays ? durationDays * 24 * 60 * 60 : 365 * 24 * 60 * 60; // default 1 year

      const calculatedTotalRewards = totalRewards || (parseFloat(rewardRate) * farmDuration).toString();

      // Create farm in database
      const db = getDatabase();
      const farm = await db.yieldFarm.create({
        data: {
          name,
          description,
          poolId,
          rewardTokenAddress: rewardToken.address,
          rewardTokenSymbol: rewardToken.symbol,
          rewardRate,
          totalStaked: '0',
          apr: this.calculateAPY(rewardRate, '0'), // Will be updated when staking occurs
          isActive: true,
          startsAt: farmStartsAt,
          endsAt: farmEndsAt,
          createdAt: now,
          updatedAt: now
        }
      });

      logger.info(`Created yield farm: ${name} for pool ${poolId}`);

      return {
        success: true,
        farm: await this.mapDbFarmToFarm(farm)
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to create farm');
      return {
        success: false,
        error: 'Failed to create farm'
      };
    }
  }

  /**
   * Stake LP tokens in a farm
   */
  async stake(request: StakeRequest): Promise<FarmOperationResult> {
    try {
      const { farmId, amount, userAddress } = request;

      // Validate farm exists and is active
      const farm = await this.getFarmById(farmId);
      if (!farm) {
        return {
          success: false,
          error: 'Farm not found'
        };
      }

      if (!farm.isActive) {
        return {
          success: false,
          error: 'Farm is not active'
        };
      }

      // Check if farm has ended
      if (farm.endsAt && new Date() > farm.endsAt) {
        return {
          success: false,
          error: 'Farm has ended'
        };
      }

      // Get or create user position
      const db = getDatabase();
      let position = await db.farmPosition.findUnique({
        where: { userId_farmId: { userId: userAddress, farmId } }
      });

      if (position) {
        // Update existing position
        position = await db.farmPosition.update({
          where: { userId_farmId: { userId: userAddress, farmId } },
          data: {
            amountStaked: (parseFloat(position.amountStaked) + parseFloat(amount)).toString(),
            updatedAt: new Date()
          }
        });
      } else {
        // Create new position
        position = await db.farmPosition.create({
          data: {
            userId: userAddress,
            farmId,
            amountStaked: amount,
            pendingRewards: '0',
            aprAtStake: farm.apr,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Update farm total staked and recalculate rewards
      const newTotalStaked = (parseFloat(farm.totalStaked) + parseFloat(amount)).toString();
      await this.updateFarmRewards(farmId, newTotalStaked);

      logger.info(`User ${userAddress} staked ${amount} LP tokens in farm ${farmId}`);

      const farmData = await this.getFarmById(farmId);
      if (!farmData) {
        return {
          success: false,
          error: 'Farm not found'
        };
      }

      return {
        success: true,
        position: await this.mapDbPositionToPosition(position, farmData)
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to stake');
      return {
        success: false,
        error: 'Failed to stake tokens'
      };
    }
  }

  /**
   * Unstake LP tokens from a farm
   */
  async unstake(request: UnstakeRequest): Promise<FarmOperationResult> {
    try {
      const { farmId, amount, userAddress } = request;

      // Validate farm exists
      const farm = await this.getFarmById(farmId);
      if (!farm) {
        return {
          success: false,
          error: 'Farm not found'
        };
      }

      // Get user position
      const db = getDatabase();
      const position = await db.farmPosition.findUnique({
        where: { userId_farmId: { userId: userAddress, farmId } }
      });

      if (!position) {
        return {
          success: false,
          error: 'No position found'
        };
      }

      if (parseFloat(position.amountStaked) < parseFloat(amount)) {
        return {
          success: false,
          error: 'Insufficient staked amount'
        };
      }

      // Calculate and add pending rewards before unstaking
      const dbFarm = await db.yieldFarm.findUnique({ where: { id: farmId } });
      if (!dbFarm) {
        return {
          success: false,
          error: 'Farm not found'
        };
      }
      const pendingRewards = await this.calculatePendingRewards(position, dbFarm);
      const totalPendingRewards = (parseFloat(position.pendingRewards) + parseFloat(pendingRewards)).toString();

      // Update position
      const newAmountStaked = (parseFloat(position.amountStaked) - parseFloat(amount)).toString();
      let updatedPosition;

      if (parseFloat(newAmountStaked) <= 0) {
        // Remove position entirely
        await db.farmPosition.delete({
          where: { userId_farmId: { userId: userAddress, farmId } }
        });
        updatedPosition = null;
      } else {
        // Update position
        updatedPosition = await db.farmPosition.update({
          where: { userId_farmId: { userId: userAddress, farmId } },
          data: {
            amountStaked: newAmountStaked,
            pendingRewards: totalPendingRewards,
            updatedAt: new Date()
          }
        });
      }

      // Update farm total staked and recalculate rewards
      const newTotalStaked = (parseFloat(farm.totalStaked) - parseFloat(amount)).toString();
      await this.updateFarmRewards(farmId, newTotalStaked);

      logger.info(`User ${userAddress} unstaked ${amount} LP tokens from farm ${farmId}`);

      if (updatedPosition) {
        const farmData = await this.getFarmById(farmId);
        if (!farmData) {
          return {
            success: false,
            error: 'Farm not found'
          };
        }
        return {
          success: true,
          position: await this.mapDbPositionToPosition(updatedPosition, farmData),
          amount
        };
      }

      return {
        success: true,
        position: undefined,
        amount
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to unstake');
      return {
        success: false,
        error: 'Failed to unstake tokens'
      };
    }
  }

  /**
   * Claim rewards from a farm
   */
  async claimRewards(request: ClaimRewardsRequest): Promise<FarmOperationResult> {
    try {
      const { farmId, userAddress } = request;

      // Validate farm exists
      const farm = await this.getFarmById(farmId);
      if (!farm) {
        return {
          success: false,
          error: 'Farm not found'
        };
      }

      // Get user position
      const db = getDatabase();
      const position = await db.farmPosition.findUnique({
        where: { userId_farmId: { userId: userAddress, farmId } }
      });

      if (!position) {
        return {
          success: false,
          error: 'No position found'
        };
      }

      // Calculate total pending rewards
      const dbFarm = await db.yieldFarm.findUnique({ where: { id: farmId } });
      if (!dbFarm) {
        return {
          success: false,
          error: 'Farm not found'
        };
      }
      const calculatedRewards = await this.calculatePendingRewards(position, dbFarm);
      const totalRewards = (parseFloat(position.pendingRewards) + parseFloat(calculatedRewards)).toString();

      if (parseFloat(totalRewards) <= 0) {
        return {
          success: false,
          error: 'No rewards to claim'
        };
      }

      // Update position (reset pending rewards)
      const updatedPosition = await db.farmPosition.update({
        where: { userId_farmId: { userId: userAddress, farmId } },
        data: {
          pendingRewards: '0',
          updatedAt: new Date()
        }
      });

      // In a real implementation, this would transfer the reward tokens
      // For now, we just record the claim
      logger.info(`User ${userAddress} claimed ${totalRewards} rewards from farm ${farmId}`);

      const farmData = await this.getFarmById(farmId);
      if (!farmData) {
        return {
          success: false,
          error: 'Farm not found'
        };
      }

      return {
        success: true,
        position: await this.mapDbPositionToPosition(updatedPosition, farmData),
        rewardsClaimed: totalRewards
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to claim rewards');
      return {
        success: false,
        error: 'Failed to claim rewards'
      };
    }
  }

  /**
   * Get all active farms
   */
  async getAllFarms(): Promise<YieldFarm[]> {
    try {
      const db = getDatabase();
      const farms = await db.yieldFarm.findMany({
        where: { isActive: true },
        orderBy: { apr: 'desc' }
      });

      return Promise.all(farms.map(async (farm) => {
        const pool = await db.liquidityPool.findUnique({
          where: { id: farm.poolId }
        });
        return this.mapDbFarmToFarm(farm, pool || undefined);
      }));

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get farms');
      return [];
    }
  }

  /**
   * Get farm by ID
   */
  async getFarmById(farmId: string): Promise<YieldFarm | null> {
    try {
      const db = getDatabase();
      const farm = await db.yieldFarm.findUnique({
        where: { id: farmId, isActive: true }
      });

      if (!farm) {
        return null;
      }

      const pool = await db.liquidityPool.findUnique({
        where: { id: farm.poolId }
      });

      return this.mapDbFarmToFarm(farm, pool || undefined);

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get farm by ID');
      return null;
    }
  }

  /**
   * Get user's farm positions
   */
  async getUserPositions(userAddress: string): Promise<FarmPosition[]> {
    try {
      const db = getDatabase();
      const positions = await db.farmPosition.findMany({
        where: { userId: userAddress },
        orderBy: { createdAt: 'desc' }
      });

      return Promise.all(positions.map(async (position) => {
        const farm = await db.yieldFarm.findUnique({
          where: { id: position.farmId }
        });

        if (!farm) {
          throw new Error(`Farm not found for position ${position.id}`);
        }

        const pool = await db.liquidityPool.findUnique({
          where: { id: farm.poolId }
        });

        const farmData = await this.mapDbFarmToFarm(farm, pool || undefined);
        return this.mapDbPositionToPosition(position, farmData);
      }));

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get user positions');
      return [];
    }
  }

  /**
   * Update farm rewards (recalculate APR based on total staked)
   */
  private async updateFarmRewards(farmId: string, totalStaked: string): Promise<void> {
    const db = getDatabase();
    const farm = await db.yieldFarm.findUnique({ where: { id: farmId } });

    if (!farm) {
      return;
    }

    const newAPR = this.calculateAPY(farm.rewardRate, totalStaked);

    await db.yieldFarm.update({
      where: { id: farmId },
      data: {
        totalStaked,
        apr: newAPR,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Calculate pending rewards for a position
   */
  private async calculatePendingRewards(
    position: DbFarmPosition,
    farm: DbYieldFarm & { pool?: DbLiquidityPool }
  ): Promise<string> {
    const now = new Date();
    const lastUpdate = position.updatedAt;
    const timeDiff = (now.getTime() - lastUpdate.getTime()) / 1000; // seconds

    const rewardRate = parseFloat(farm.rewardRate);
    const totalStaked = parseFloat(farm.totalStaked);
    const userStaked = parseFloat(position.amountStaked);

    if (totalStaked === 0) {
      return '0';
    }

    // Calculate user's share of rewards
    const userShare = userStaked / totalStaked;
    const rewards = rewardRate * timeDiff * userShare;

    return rewards.toString();
  }

  /**
   * Calculate APY (Annual Percentage Yield)
   */
  private calculateAPY(rewardRate: string, totalStaked: string): string {
    const annualRewards = parseFloat(rewardRate) * this.SECONDS_PER_YEAR;
    const stakedAmount = parseFloat(totalStaked);

    if (stakedAmount === 0) {
      return '0';
    }

    const apy = (annualRewards / stakedAmount) * 100;
    return apy.toFixed(2);
  }

  /**
   * Get farm by pool ID
   */
  private async getFarmByPool(poolId: string): Promise<DbYieldFarm | null> {
    const db = getDatabase();
    return await db.yieldFarm.findFirst({
      where: { poolId, isActive: true }
    });
  }

  /**
   * Get pool by ID
   */
  private async getPoolById(poolId: string): Promise<DbLiquidityPool | null> {
    const db = getDatabase();
    return await db.liquidityPool.findUnique({
      where: { id: poolId, isActive: true }
    });
  }

  /**
   * Map database farm to Farm interface
   */
  private async mapDbFarmToFarm(dbFarm: DbYieldFarm, pool?: DbLiquidityPool): Promise<YieldFarm> {
    return {
      id: dbFarm.id,
      name: dbFarm.name,
      description: dbFarm.description || undefined,
      poolId: dbFarm.poolId,
      pool: {
        id: dbFarm.poolId,
        token0Symbol: pool?.token0Symbol || 'UNKNOWN',
        token1Symbol: pool?.token1Symbol || 'UNKNOWN',
        fee: pool?.fee || '0'
      },
      rewardToken: {
        address: dbFarm.rewardTokenAddress,
        symbol: dbFarm.rewardTokenSymbol,
        decimals: 18 // Default, should be stored in DB in production
      },
      rewardRate: dbFarm.rewardRate,
      totalStaked: dbFarm.totalStaked,
      apr: dbFarm.apr,
      isActive: dbFarm.isActive,
      startsAt: dbFarm.startsAt,
      endsAt: dbFarm.endsAt || undefined,
      createdAt: dbFarm.createdAt,
      updatedAt: dbFarm.updatedAt
    };
  }

  /**
   * Map database position to Position interface
   */
  private async mapDbPositionToPosition(
    dbPosition: DbFarmPosition,
    farm: YieldFarm
  ): Promise<FarmPosition> {
    return {
      id: dbPosition.id,
      farmId: dbPosition.farmId,
      farm,
      amountStaked: dbPosition.amountStaked,
      pendingRewards: dbPosition.pendingRewards,
      aprAtStake: dbPosition.aprAtStake,
      createdAt: dbPosition.createdAt,
      updatedAt: dbPosition.updatedAt,
      rewardsHistory: [] // TODO: Implement reward history tracking
    };
  }
}