import { Address, Hash, PublicClient, WalletClient } from 'viem';
import { MASTERCHEF_V2_ABI } from '../abis/masterchef';
import { getViemProvider } from '../providers/viem-provider';
import { getContractHelpers } from '../utils/contract-helpers';
import logger from '../../utils/logger';

/**
 * MasterChef V2 Contract (Viem Implementation)
 * Provides type-safe MasterChef V2 interactions using Viem
 */

// MasterChef V2 address on BSC
export const MASTERCHEF_V2_ADDRESS = '0xa5f8C5Dbd5F286960b9d9e4868417a7eA7B9E3b4' as Address;

// MasterChef V2 contract types
export interface MasterChefV2Viem {
  // Base contract methods will be added dynamically
  deposit: (pid: bigint, amount: bigint, privateKey: string) => Promise<void>;
  withdraw: (pid: bigint, amount: bigint, privateKey: string) => Promise<void>;
  harvest: (pid: bigint, privateKey: string) => Promise<void>;
  pendingCake: (pid: bigint, user: Address) => Promise<bigint>;
  userInfo: (pid: bigint, user: Address) => Promise<{
    amount: bigint;
    rewardDebt: bigint;
  }>;
  poolInfo: (pid: bigint) => Promise<{
    lpToken: Address;
    allocPoint: bigint;
    lastRewardBlock: bigint;
    accCakePerShare: bigint;
    rewarder: Address;
  }>;
  totalAllocPoint: () => Promise<bigint>;
  poolLength: () => Promise<bigint>;
  updatePool: (pid: bigint) => Promise<void>;
  massUpdatePools: (pids: bigint[]) => Promise<void>;
  // Utility methods
  getMultiplePoolInfos: (pids: bigint[]) => Promise<Array<{
    lpToken: Address;
    allocPoint: bigint;
    lastRewardBlock: bigint;
    accCakePerShare: bigint;
    rewarder: Address;
  }>>;
  getPoolBalance: (user: Address, pid: bigint) => Promise<bigint>;
  getPendingRewards: (user: Address, pids: bigint[]) => Promise<bigint[]>;
  watchDeposit: (callback: (user: Address, pid: bigint, amount: bigint) => void) => (() => void);
  watchWithdraw: (callback: (user: Address, pid: bigint, amount: bigint) => void) => (() => void);
  watchHarvest: (callback: (user: Address, pid: bigint) => void) => (() => void);
  // Add other methods as needed
}

/**
 * Create MasterChef V2 contract instance with Viem
 */
export function createMasterChefV2(): MasterChefV2Viem {
  const provider = getViemProvider();
  const contractHelpers = getContractHelpers();

  // Create the base contract
  const contract = contractHelpers.createContract(
    MASTERCHEF_V2_ADDRESS,
    MASTERCHEF_V2_ABI,
    'read'
  );

  return {
    ...contract,

    // Pool operations
    deposit: async (pid: bigint, amount: bigint, privateKey: string): Promise<void> => {
      try {
        logger.info('Depositing to pool %s with amount: %s', pid.toString(), amount.toString());

        await contractHelpers.callWriteFunction(
          MASTERCHEF_V2_ADDRESS,
          MASTERCHEF_V2_ABI,
          'deposit',
          [pid, amount],
          privateKey
        );

        logger.info('Successfully deposited to pool %s', pid.toString());
      } catch (error) {
        logger.error('Failed to deposit to pool: %O', error);
        throw new Error(`Deposit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    withdraw: async (pid: bigint, amount: bigint, privateKey: string): Promise<void> => {
      try {
        logger.info('Withdrawing from pool %s with amount: %s', pid.toString(), amount.toString());

        await contractHelpers.callWriteFunction(
          MASTERCHEF_V2_ADDRESS,
          MASTERCHEF_V2_ABI,
          'withdraw',
          [pid, amount],
          privateKey
        );

        logger.info('Successfully withdrew from pool %s', pid.toString());
      } catch (error) {
        logger.error('Failed to withdraw from pool: %O', error);
        throw new Error(`Withdraw failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    harvest: async (pid: bigint, privateKey: string): Promise<void> => {
      try {
        logger.info('Harvesting rewards from pool %s', pid.toString());

        await contractHelpers.callWriteFunction(
          MASTERCHEF_V2_ADDRESS,
          MASTERCHEF_V2_ABI,
          'harvest',
          [pid],
          privateKey
        );

        logger.info('Successfully harvested from pool %s', pid.toString());
      } catch (error) {
        logger.error('Failed to harvest from pool: %O', error);
        throw new Error(`Harvest failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // View functions
    pendingCake: async (pid: bigint, user: Address): Promise<bigint> => {
      try {
        logger.debug('Getting pending CAKE for pool %s, user %s', pid.toString(), user);
        const pending = await contract.read.pendingCake([pid, user]);
        logger.debug('Pending CAKE: %s', pending.toString());
        return pending;
      } catch (error) {
        logger.error('Failed to get pending CAKE: %O', error);
        throw new Error(`Failed to get pending CAKE: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    userInfo: async (pid: bigint, user: Address): Promise<{
      amount: bigint;
      rewardDebt: bigint;
    }> => {
      try {
        logger.debug('Getting user info for pool %s, user %s', pid.toString(), user);
        const info = await contract.read.userInfo([pid, user]);
        logger.debug('User info: %O', info);
        return {
          amount: info.amount,
          rewardDebt: info.rewardDebt,
        };
      } catch (error) {
        logger.error('Failed to get user info: %O', error);
        throw new Error(`Failed to get user info: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    poolInfo: async (pid: bigint): Promise<{
      lpToken: Address;
      allocPoint: bigint;
      lastRewardBlock: bigint;
      accCakePerShare: bigint;
      rewarder: Address;
    }> => {
      try {
        logger.debug('Getting pool info for pool %s', pid.toString());
        const info = await contract.read.poolInfo([pid]);
        logger.debug('Pool info: %O', info);
        return {
          lpToken: info.lpToken,
          allocPoint: info.allocPoint,
          lastRewardBlock: info.lastRewardBlock,
          accCakePerShare: info.accCakePerShare,
          rewarder: info.rewarder,
        };
      } catch (error) {
        logger.error('Failed to get pool info: %O', error);
        throw new Error(`Failed to get pool info: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    totalAllocPoint: async (): Promise<bigint> => {
      try {
        logger.debug('Getting total allocation point');
        const total = await contract.read.totalAllocPoint();
        logger.debug('Total allocation point: %s', total.toString());
        return total;
      } catch (error) {
        logger.error('Failed to get total allocation point: %O', error);
        throw new Error(`Failed to get total allocation point: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    poolLength: async (): Promise<bigint> => {
      try {
        logger.debug('Getting pool length');
        const length = await contract.read.poolLength();
        logger.debug('Pool length: %s', length.toString());
        return length;
      } catch (error) {
        logger.error('Failed to get pool length: %O', error);
        throw new Error(`Failed to get pool length: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Pool management
    updatePool: async (pid: bigint): Promise<void> => {
      try {
        logger.info('Updating pool %s', pid.toString());

        await contractHelpers.callWriteFunction(
          MASTERCHEF_V2_ADDRESS,
          MASTERCHEF_V2_ABI,
          'updatePool',
          [pid],
          '0x0' // Using default private key for read-only operations
        );

        logger.info('Successfully updated pool %s', pid.toString());
      } catch (error) {
        logger.error('Failed to update pool: %O', error);
        throw new Error(`Pool update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    massUpdatePools: async (pids: bigint[]): Promise<void> => {
      try {
        logger.info('Mass updating %d pools', pids.length);

        await contractHelpers.callWriteFunction(
          MASTERCHEF_V2_ADDRESS,
          MASTERCHEF_V2_ABI,
          'massUpdatePools',
          [pids],
          '0x0' // Using default private key for read-only operations
        );

        logger.info('Successfully mass updated pools');
      } catch (error) {
        logger.error('Failed to mass update pools: %O', error);
        throw new Error(`Mass update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Utility methods
    getPoolBalance: async (user: Address, pid: bigint): Promise<bigint> => {
      try {
        logger.debug('Getting pool balance for user: %s, pool: %s', user, pid.toString());
        const userInfo = await this.userInfo(pid, user);
        logger.debug('Pool balance: %s', userInfo.amount.toString());
        return userInfo.amount;
      } catch (error) {
        logger.error('Failed to get pool balance: %O', error);
        throw new Error(`Failed to get pool balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    getPendingRewards: async (user: Address, pids: bigint[]): Promise<bigint[]> => {
      try {
        logger.debug('Getting pending rewards for user: %s, pools: %O', user, pids);
        const rewards = await Promise.all(
          pids.map(pid => this.pendingCake(pid, user))
        );
        logger.debug('Pending rewards: %O', rewards);
        return rewards;
      } catch (error) {
        logger.error('Failed to get pending rewards: %O', error);
        throw new Error(`Failed to get pending rewards: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Batch operations
    getMultiplePoolInfos: async (pids: bigint[]): Promise<Array<{
      lpToken: Address;
      allocPoint: bigint;
      lastRewardBlock: bigint;
      accCakePerShare: bigint;
      rewarder: Address;
    }>> => {
      try {
        logger.debug('Getting %d pool infos in batch', pids.length);
        const client = provider.getHttpClient();

        const results = await client.multicall({
          contracts: pids.map(pid => ({
            address: MASTERCHEF_V2_ADDRESS,
            abi: MASTERCHEF_V2_ABI,
            functionName: 'poolInfo',
            args: [pid],
          })),
          allowFailure: true,
        });

        const poolInfos = results.map((result, index) => {
          if (result.status === 'success') {
            return result.result as {
              lpToken: Address;
              allocPoint: bigint;
              lastRewardBlock: bigint;
              accCakePerShare: bigint;
              rewarder: Address;
            };
          } else {
            logger.error('Failed to get pool info for pid %s: %O', pids[index], result.error);
            throw new Error(`Failed to get pool info for ${pids[index]}`);
          }
        });

        logger.debug('Retrieved %d pool infos', poolInfos.length);
        return poolInfos;
      } catch (error) {
        logger.error('Failed to get multiple pool infos: %O', error);
        throw new Error(`Batch get pool infos failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Event monitoring
    watchDeposit: (callback: (user: Address, pid: bigint, amount: bigint) => void): (() => void) => {
      try {
        const client = provider.getWebSocketClient();

        const unwatch = client.watchEvent({
          address: MASTERCHEF_V2_ADDRESS,
          abi: MASTERCHEF_V2_ABI,
          eventName: 'Deposit',
          onLogs: (logs) => {
            logs.forEach(log => {
              if (log.eventName === 'Deposit' && log.args) {
                const { user, pid, amount } = log.args;
                logger.info('Deposit event: user=%s, pid=%s, amount=%s', user, pid.toString(), amount.toString());
                callback(user, pid, amount);
              }
            });
          },
        });

        logger.info('Started watching Deposit events');
        return unwatch;
      } catch (error) {
        logger.error('Failed to watch Deposit events: %O', error);
        throw new Error(`Event watching failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    watchWithdraw: (callback: (user: Address, pid: bigint, amount: bigint) => void): (() => void) => {
      try {
        const client = provider.getWebSocketClient();

        const unwatch = client.watchEvent({
          address: MASTERCHEF_V2_ADDRESS,
          abi: MASTERCHEF_V2_ABI,
          eventName: 'Withdraw',
          onLogs: (logs) => {
            logs.forEach(log => {
              if (log.eventName === 'Withdraw' && log.args) {
                const { user, pid, amount } = log.args;
                logger.info('Withdraw event: user=%s, pid=%s, amount=%s', user, pid.toString(), amount.toString());
                callback(user, pid, amount);
              }
            });
          },
        });

        logger.info('Started watching Withdraw events');
        return unwatch;
      } catch (error) {
        logger.error('Failed to watch Withdraw events: %O', error);
        throw new Error(`Event watching failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  };
}

/**
 * MasterChef V2 Factory Class
 */
export class MasterChefV2Factory {
  private static instances: Map<Address, MasterChefV2Viem> = new Map();

  /**
   * Get or create MasterChef V2 instance (singleton pattern)
   */
  static getMasterChef(address?: Address): MasterChefV2Viem {
    const masterChefAddress = address || MASTERCHEF_V2_ADDRESS;

    if (!this.instances.has(masterChefAddress)) {
      const masterChef = createMasterChefV2();
      this.instances.set(masterChefAddress, masterChef);
    }

    return this.instances.get(masterChefAddress)!;
  }

  /**
   * Clear all instances
   */
  static clearInstances(): void {
    this.instances.clear();
  }

  /**
   * Get number of cached instances
   */
  static getInstanceCount(): number {
    return this.instances.size;
  }
}

export default createMasterChefV2;