import { Address } from 'viem';
import { createMasterChefV1, MasterChefV1Viem } from '../contracts/masterchef-v1';
import { createMasterChefV2, MasterChefV2Viem } from '../contracts/masterchef-v2';
import { createPancakeSwapRouter } from '../contracts/pancakeswap-router';
import logger from '../../utils/logger';

/**
 * Yield Farming Service for PancakeSwap (Viem Implementation)
 * Provides yield farming functionality using MasterChef contracts
 */

// Farming pool information
export interface FarmingPool {
  pid: bigint;
  lpToken: Address;
  allocPoint: bigint;
  lastRewardBlock: bigint;
  accCakePerShare: bigint;
  rewarder?: Address;
  isMasterChefV1?: boolean;
}

// User position in farming pool
export interface UserPosition {
  pid: bigint;
  amount: bigint;
  rewardDebt: bigint;
  pendingRewards: bigint;
  lpToken: Address;
}

// Farming operation result
export interface FarmingResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  newBalance?: bigint;
  pendingRewards?: bigint;
}

/**
 * Yield Farming Service Class
 */
export class YieldFarmingService {
  private masterChefV1: MasterChefV1Viem;
  private masterChefV2: MasterChefV2Viem;

  constructor() {
    this.masterChefV1 = createMasterChefV1();
    this.masterChefV2 = createMasterChefV2();
  }

  /**
   * Get all farming pools from both MasterChef V1 and V2
   */
  async getAllPools(): Promise<{
    masterChefV1Pools: FarmingPool[];
    masterChefV2Pools: FarmingPool[];
  }> {
    try {
      logger.info('Fetching all farming pools');

      // Get MasterChef V1 pools
      const v1PoolLength = await this.masterChefV1.poolLength();
      const v1Pids = Array.from({ length: Number(v1PoolLength) }, (_, i) => BigInt(i));
      const v1PoolInfos = await this.masterChefV1.getMultiplePoolInfos(v1Pids);

      const v1Pools: FarmingPool[] = v1PoolInfos.map((info, index) => ({
        pid: v1Pids[index],
        lpToken: info.lpToken,
        allocPoint: info.allocPoint,
        lastRewardBlock: info.lastRewardBlock,
        accCakePerShare: info.accCakePerShare,
        isMasterChefV1: true,
      }));

      // Get MasterChef V2 pools
      const v2PoolLength = await this.masterChefV2.poolLength();
      const v2Pids = Array.from({ length: Number(v2PoolLength) }, (_, i) => BigInt(i));
      const v2PoolInfos = await this.masterChefV2.getMultiplePoolInfos(v2Pids);

      const v2Pools: FarmingPool[] = v2PoolInfos.map((info, index) => ({
        pid: v2Pids[index],
        lpToken: info.lpToken,
        allocPoint: info.allocPoint,
        lastRewardBlock: info.lastRewardBlock,
        accCakePerShare: info.accCakePerShare,
        rewarder: info.rewarder,
        isMasterChefV1: false,
      }));

      logger.info('Retrieved %d V1 pools and %d V2 pools', v1Pools.length, v2Pools.length);
      return {
        masterChefV1Pools: v1Pools,
        masterChefV2Pools: v2Pools,
      };
    } catch (error) {
      logger.error('Failed to get all farming pools: %O', error);
      throw new Error(`Failed to get farming pools: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user's farming positions across all pools
   */
  async getUserPositions(user: Address): Promise<UserPosition[]> {
    try {
      logger.info('Getting farming positions for user: %s', user);

      const { masterChefV1Pools, masterChefV2Pools } = await this.getAllPools();
      const positions: UserPosition[] = [];

      // Get positions from MasterChef V1
      for (const pool of masterChefV1Pools) {
        try {
          const userInfo = await this.masterChefV1.userInfo(pool.pid, user);
          if (userInfo.amount > 0n) {
            const pendingRewards = await this.masterChefV1.pendingCake(pool.pid, user);
            positions.push({
              pid: pool.pid,
              amount: userInfo.amount,
              rewardDebt: userInfo.rewardDebt,
              pendingRewards,
              lpToken: pool.lpToken,
            });
          }
        } catch (error) {
          logger.error('Failed to get V1 position for pool %s: %O', pool.pid, error);
        }
      }

      // Get positions from MasterChef V2
      for (const pool of masterChefV2Pools) {
        try {
          const userInfo = await this.masterChefV2.userInfo(pool.pid, user);
          if (userInfo.amount > 0n) {
            const pendingRewards = await this.masterChefV2.pendingCake(pool.pid, user);
            positions.push({
              pid: pool.pid,
              amount: userInfo.amount,
              rewardDebt: userInfo.rewardDebt,
              pendingRewards,
              lpToken: pool.lpToken,
            });
          }
        } catch (error) {
          logger.error('Failed to get V2 position for pool %s: %O', pool.pid, error);
        }
      }

      logger.info('Retrieved %d farming positions for user: %s', positions.length, user);
      return positions;
    } catch (error) {
      logger.error('Failed to get user positions: %O', error);
      throw new Error(`Failed to get user positions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deposit LP tokens into farming pool
   */
  async deposit(
    pid: bigint,
    amount: bigint,
    privateKey: string,
    isMasterChefV1: boolean = false
  ): Promise<FarmingResult> {
    try {
      logger.info('Depositing %s tokens into pool %s (V1: %s)', amount.toString(), pid.toString(), isMasterChefV1);

      const masterChef = isMasterChefV1 ? this.masterChefV1 : this.masterChefV2;

      await masterChef.deposit(pid, amount, privateKey);

      logger.info('Successfully deposited %s tokens into pool %s', amount.toString(), pid.toString());
      return {
        success: true,
        newBalance: amount,
      };
    } catch (error) {
      logger.error('Failed to deposit into pool: %O', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Withdraw LP tokens from farming pool
   */
  async withdraw(
    pid: bigint,
    amount: bigint,
    privateKey: string,
    isMasterChefV1: boolean = false
  ): Promise<FarmingResult> {
    try {
      logger.info('Withdrawing %s tokens from pool %s (V1: %s)', amount.toString(), pid.toString(), isMasterChefV1);

      const masterChef = isMasterChefV1 ? this.masterChefV1 : this.masterChefV2;

      await masterChef.withdraw(pid, amount, privateKey);

      logger.info('Successfully withdrew %s tokens from pool %s', amount.toString(), pid.toString());
      return {
        success: true,
        newBalance: 0n, // After withdrawal, the new amount would need to be fetched again
      };
    } catch (error) {
      logger.error('Failed to withdraw from pool: %O', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Harvest rewards from farming pool
   */
  async harvest(
    pid: bigint,
    privateKey: string,
    isMasterChefV1: boolean = false
  ): Promise<FarmingResult> {
    try {
      logger.info('Harvesting rewards from pool %s (V1: %s)', pid.toString(), isMasterChefV1);

      if (isMasterChefV1) {
        // MasterChef V1 doesn't have a separate harvest function, rewards are claimed on withdraw
        throw new Error('MasterChef V1 harvest is done through withdraw operation');
      } else {
        await this.masterChefV2.harvest(pid, privateKey);
      }

      logger.info('Successfully harvested from pool %s', pid.toString());
      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to harvest from pool: %O', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Enter staking (CAKE staking in MasterChef V1)
   */
  async enterStaking(amount: bigint, privateKey: string): Promise<FarmingResult> {
    try {
      logger.info('Entering staking with amount: %s', amount.toString());

      await this.masterChefV1.enterStaking(amount, privateKey);

      logger.info('Successfully entered staking');
      return {
        success: true,
        newBalance: amount,
      };
    } catch (error) {
      logger.error('Failed to enter staking: %O', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Leave staking (CAKE staking in MasterChef V1)
   */
  async leaveStaking(amount: bigint, privateKey: string): Promise<FarmingResult> {
    try {
      logger.info('Leaving staking with amount: %s', amount.toString());

      await this.masterChefV1.leaveStaking(amount, privateKey);

      logger.info('Successfully left staking');
      return {
        success: true,
        newBalance: 0n,
      };
    } catch (error) {
      logger.error('Failed to leave staking: %O', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get pending rewards for user across all pools
   */
  async getPendingRewards(user: Address): Promise<{
    totalPending: bigint;
    pendingByPool: Array<{
      pid: bigint;
      pending: bigint;
      isMasterChefV1: boolean;
    }>;
  }> {
    try {
      logger.debug('Getting pending rewards for user: %s', user);

      const { masterChefV1Pools, masterChefV2Pools } = await this.getAllPools();
      let totalPending = 0n;
      const pendingByPool: Array<{
        pid: bigint;
        pending: bigint;
        isMasterChefV1: boolean;
      }> = [];

      // Get pending rewards from MasterChef V1
      for (const pool of masterChefV1Pools) {
        try {
          const pending = await this.masterChefV1.pendingCake(pool.pid, user);
          if (pending > 0n) {
            totalPending += pending;
            pendingByPool.push({
              pid: pool.pid,
              pending,
              isMasterChefV1: true,
            });
          }
        } catch (error) {
          logger.error('Failed to get V1 pending rewards for pool %s: %O', pool.pid, error);
        }
      }

      // Get pending rewards from MasterChef V2
      for (const pool of masterChefV2Pools) {
        try {
          const pending = await this.masterChefV2.pendingCake(pool.pid, user);
          if (pending > 0n) {
            totalPending += pending;
            pendingByPool.push({
              pid: pool.pid,
              pending,
              isMasterChefV1: false,
            });
          }
        } catch (error) {
          logger.error('Failed to get V2 pending rewards for pool %s: %O', pool.pid, error);
        }
      }

      logger.debug('Total pending rewards for user %s: %s', user, totalPending.toString());
      return {
        totalPending,
        pendingByPool,
      };
    } catch (error) {
      logger.error('Failed to get pending rewards: %O', error);
      throw new Error(`Failed to get pending rewards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate APY for a farming pool
   */
  async calculatePoolAPY(
    pid: bigint,
    lpTokenPrice: number,
    cakePrice: number,
    isMasterChefV1: boolean = false
  ): Promise<{
    apy: number;
    dailyApy: number;
    yearlyApy: number;
  }> {
    try {
      logger.debug('Calculating APY for pool %s', pid.toString());

      const masterChef = isMasterChefV1 ? this.masterChefV1 : this.masterChefV2;
      const poolInfo = await masterChef.poolInfo(pid);
      const totalAllocPoint = await masterChef.totalAllocPoint();

      // Get CAKE per block (simplified calculation)
      const cakePerBlock = isMasterChefV1
        ? await this.masterChefV1.cakePerBlock()
        : 40n; // Default value for MasterChef V2

      // Calculate blocks per day (BSC has ~3 second block time)
      const blocksPerDay = 86400 / 3;
      const cakePerDay = cakePerBlock * BigInt(blocksPerDay);

      // Calculate pool's share of rewards
      const poolCakePerDay = (cakePerDay * poolInfo.allocPoint) / totalAllocPoint;

      // Convert to USD
      const dailyRewardsUSD = Number(poolCakePerDay) * cakePrice;

      // Get total value locked in the pool (this would need to be calculated from reserves)
      // For now, return a simplified calculation
      const tvlUSD = 10000; // Placeholder - would need to calculate actual TVL

      const dailyApy = (dailyRewardsUSD / tvlUSD) * 100;
      const yearlyApy = dailyApy * 365;

      logger.debug('Pool %s APY - Daily: %.2f%%, Yearly: %.2f%%', pid.toString(), dailyApy.toFixed(2), yearlyApy.toFixed(2));

      return {
        apy: yearlyApy,
        dailyApy,
        yearlyApy,
      };
    } catch (error) {
      logger.error('Failed to calculate pool APY: %O', error);
      throw new Error(`Failed to calculate APY: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Get yield farming service instance
 */
export function getYieldFarmingService(): YieldFarmingService {
  return new YieldFarmingService();
}

export default YieldFarmingService;