import { Address, Hash, PublicClient, WalletClient } from 'viem';
import { MASTERCHEF_V1_ABI } from '../abis/masterchef';
import { getViemProvider } from '../providers/viem-provider';
import { getContractHelpers } from '../utils/contract-helpers';
import logger from '../../utils/logger';

/**
 * MasterChef V1 Contract (Viem Implementation)
 * Provides type-safe MasterChef V1 interactions using Viem
 */

// MasterChef V1 address on BSC
export const MASTERCHEF_V1_ADDRESS = '0x73feaa1eE314F8c655E354234017bE2193C9E24E' as Address;

// MasterChef V1 contract types
export interface MasterChefV1Viem {
  // Base contract methods will be added dynamically
  deposit: (pid: bigint, amount: bigint, privateKey: string) => Promise<void>;
  withdraw: (pid: bigint, amount: bigint, privateKey: string) => Promise<void>;
  enterStaking: (amount: bigint, privateKey: string) => Promise<void>;
  leaveStaking: (amount: bigint, privateKey: string) => Promise<void>;
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
  }>;
  totalAllocPoint: () => Promise<bigint>;
  poolLength: () => Promise<bigint>;
  cakePerBlock: () => Promise<bigint>;
  // Utility methods
  getStakedBalance: (user: Address) => Promise<bigint>;
  getPendingRewards: (user: Address) => Promise<bigint>;
  getMultiplePoolInfos: (pids: bigint[]) => Promise<Array<{
    lpToken: Address;
    allocPoint: bigint;
    lastRewardBlock: bigint;
    accCakePerShare: bigint;
  }>>;
  watchDeposit: (callback: (user: Address, pid: bigint, amount: bigint) => void) => (() => void);
  watchWithdraw: (callback: (user: Address, pid: bigint, amount: bigint) => void) => (() => void);
  // Add other methods as needed
}

/**
 * Create MasterChef V1 contract instance with Viem
 */
export function createMasterChefV1(): MasterChefV1Viem {
  const provider = getViemProvider();
  const contractHelpers = getContractHelpers();

  // Create the base contract
  const contract = contractHelpers.createContract(
    MASTERCHEF_V1_ADDRESS,
    MASTERCHEF_V1_ABI,
    'read'
  );

  return {
    ...contract,

    // Staking operations
    enterStaking: async (amount: bigint, privateKey: string): Promise<void> => {
      try {
        logger.info('Entering staking with amount: %s', amount.toString());

        await contractHelpers.callWriteFunction(
          MASTERCHEF_V1_ADDRESS,
          MASTERCHEF_V1_ABI,
          'enterStaking',
          [amount],
          privateKey
        );

        logger.info('Successfully entered staking');
      } catch (error) {
        logger.error('Failed to enter staking: %O', error);
        throw new Error(`Enter staking failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    leaveStaking: async (amount: bigint, privateKey: string): Promise<void> => {
      try {
        logger.info('Leaving staking with amount: %s', amount.toString());

        await contractHelpers.callWriteFunction(
          MASTERCHEF_V1_ADDRESS,
          MASTERCHEF_V1_ABI,
          'leaveStaking',
          [amount],
          privateKey
        );

        logger.info('Successfully left staking');
      } catch (error) {
        logger.error('Failed to leave staking: %O', error);
        throw new Error(`Leave staking failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Pool operations
    deposit: async (pid: bigint, amount: bigint, privateKey: string): Promise<void> => {
      try {
        logger.info('Depositing to pool %s with amount: %s', pid.toString(), amount.toString());

        await contractHelpers.callWriteFunction(
          MASTERCHEF_V1_ADDRESS,
          MASTERCHEF_V1_ABI,
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
          MASTERCHEF_V1_ADDRESS,
          MASTERCHEF_V1_ABI,
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

    cakePerBlock: async (): Promise<bigint> => {
      try {
        logger.debug('Getting CAKE per block');
        const cakePerBlock = await contract.read.cakePerBlock();
        logger.debug('CAKE per block: %s', cakePerBlock.toString());
        return cakePerBlock;
      } catch (error) {
        logger.error('Failed to get CAKE per block: %O', error);
        throw new Error(`Failed to get CAKE per block: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Utility methods
    getStakedBalance: async (user: Address): Promise<bigint> => {
      try {
        logger.debug('Getting staked balance for user: %s', user);
        const userInfo = await this.userInfo(0n, user); // Pool 0 is CAKE staking
        logger.debug('Staked balance: %s', userInfo.amount.toString());
        return userInfo.amount;
      } catch (error) {
        logger.error('Failed to get staked balance: %O', error);
        throw new Error(`Failed to get staked balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    getPendingRewards: async (user: Address): Promise<bigint> => {
      try {
        logger.debug('Getting pending rewards for user: %s', user);
        const pending = await this.pendingCake(0n, user); // Pool 0 is CAKE staking
        logger.debug('Pending rewards: %s', pending.toString());
        return pending;
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
    }>> => {
      try {
        logger.debug('Getting %d pool infos in batch', pids.length);
        const client = provider.getHttpClient();

        const results = await client.multicall({
          contracts: pids.map(pid => ({
            address: MASTERCHEF_V1_ADDRESS,
            abi: MASTERCHEF_V1_ABI,
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
          address: MASTERCHEF_V1_ADDRESS,
          abi: MASTERCHEF_V1_ABI,
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
          address: MASTERCHEF_V1_ADDRESS,
          abi: MASTERCHEF_V1_ABI,
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
 * MasterChef V1 Factory Class
 */
export class MasterChefV1Factory {
  private static instances: Map<Address, MasterChefV1Viem> = new Map();

  /**
   * Get or create MasterChef V1 instance (singleton pattern)
   */
  static getMasterChef(address?: Address): MasterChefV1Viem {
    const masterChefAddress = address || MASTERCHEF_V1_ADDRESS;

    if (!this.instances.has(masterChefAddress)) {
      const masterChef = createMasterChefV1();
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

export default createMasterChefV1;