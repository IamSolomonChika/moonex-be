/**
 * Syrup Pool Management Service
 * Handles single-token staking pools (Syrup Pools) on PancakeSwap
 */

import { ethers } from 'ethers';
import logger from '../../../utils/logger.js';
import type {
  SyrupPool,
  YieldPosition,
  YieldOperation,
  YieldOperationType,
  StakingCategory,
  YieldConfig,
  YieldError,
  YieldErrorCode,
  TokenInfo
} from './types.js';
import { BSCProviderManager } from '../../utils/ethers-provider.js';
import { BSCCacheManager } from '../cache/cache-manager.js';
import { BSCGasOptimizationService, bscGasOptimizationService } from '../trading/gas-optimization.js';
import {
  SYRUP_POOL_ABI
} from './types.js';

/**
 * Syrup Pool Management Interface
 */
export interface ISyrupPoolService {
  // Pool information
  getSyrupPool(address: string): Promise<SyrupPool | null>;
  getSyrupPools(category?: StakingCategory): Promise<SyrupPool[]>;
  getActiveSyrupPools(): Promise<SyrupPool[]>;
  getFinishedSyrupPools(): Promise<SyrupPool[]>;

  // User positions
  getUserSyrupPosition(userAddress: string, poolAddress: string): Promise<YieldPosition | null>;
  getUserSyrupPositions(userAddress: string): Promise<YieldPosition[]>;

  // Staking operations
  stakeSyrup(userAddress: string, poolAddress: string, amount: string): Promise<YieldOperation>;
  unstakeSyrup(userAddress: string, poolAddress: string, amount: string): Promise<YieldOperation>;
  claimSyrupRewards(userAddress: string, poolAddress: string): Promise<YieldOperation>;
  emergencyWithdrawSyrup(userAddress: string, poolAddress: string): Promise<YieldOperation>;

  // Pool discovery
  discoverSyrupPools(): Promise<SyrupPool[]>;
  validateSyrupPool(poolAddress: string): Promise<{ isValid: boolean; issues: string[] }>;

  // Analytics
  getSyrupPoolPerformance(poolAddress: string, period: string): Promise<any>;
  getSyrupPoolTrends(period: string): Promise<SyrupPoolTrend[]>;
  getTopSyrupPools(limit: number, sortBy?: string): Promise<SyrupPool[]>;

  // Rewards calculation
  calculatePendingRewards(userAddress: string, poolAddress: string): Promise<string>;
  calculateRewardRate(poolAddress: string): Promise<string>;
  estimateRewards(userAddress: string, poolAddress: string, days: number): Promise<RewardEstimate>;

  // Lock management
  getLockInfo(userAddress: string, poolAddress: string): Promise<LockInfo>;
  extendLockPeriod(userAddress: string, poolAddress: string, additionalDays: number): Promise<YieldOperation>;
  calculateEarlyWithdrawalFee(userAddress: string, poolAddress: string, amount: string): Promise<string>;
}

export interface SyrupPoolTrend {
  poolAddress: string;
  apr: number;
  apy: number;
  tvl: number;
  stakers: number;
  change24h: number;
  change7d: number;
  change30d: number;
  trend: 'up' | 'down' | 'stable';
  prediction: number;
}

export interface RewardEstimate {
  daily: string;
  weekly: string;
  monthly: string;
  yearly: string;
  currentAPR: number;
  projectedValue: number;
  assumptions: string[];
}

export interface LockInfo {
  userAddress: string;
  poolAddress: string;
  lockedAmount: string;
  lockedUntil: number;
  remainingDays: number;
  earlyWithdrawalFee: number;
  canWithdraw: boolean;
  lockDuration: number;
  rewardsWhileLocked: string;
}

/**
 * Syrup Pool Service Implementation
 */
export class SyrupPoolService implements ISyrupPoolService {
  private provider: BSCProviderManager;
  private cache: BSCCacheManager;
  private gasOptimization: BSCGasOptimizationService;
  private config: YieldConfig;

  // Known addresses
  private readonly CAKE_ADDRESS = '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82';
  private readonly WBNB_ADDRESS = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
  private readonly SYRUP_POOLS = [
    '0x73feaa1ee314f8c655e354234017be2193c9e24e', // CAKE Syrup Pool
    '0xa8Bb69Ae7e3e0e0B775B1a1a8b6397276F7797e5', // CAKE-BNB LP Syrup Pool
    '0x...' // Additional Syrup Pool addresses
  ];

  constructor(config?: Partial<YieldConfig>) {
    this.provider = new BSCProviderManager();
    this.cache = new BSCCacheManager();
    this.gasOptimization = new BSCGasOptimizationService();

    // Default configuration
    this.config = {
      cacheFarmData: true,
      farmDataCacheTTL: 30000, // 30 seconds
      cacheUserData: true,
      userDataCacheTTL: 60000, // 1 minute
      enableAnalytics: true,
      analyticsRetentionDays: 30,
      defaultGasLimit: {
        deposit: 200000,
        withdraw: 200000,
        harvest: 200000,
        compound: 250000,
        approve: 50000
      },
      performanceFee: 0,
      compoundFee: 0,
      withdrawalFee: 0,
      masterChefV2: '0xa5f8c5dbd5f286960e9d8e7e8b15ae934c6c5d83',
      rewardToken: this.CAKE_ADDRESS,
      ...config
    };
  }

  /**
   * Get Syrup Pool information by address
   */
  async getSyrupPool(address: string): Promise<SyrupPool | null> {
    logger.debug({ address }, 'Getting Syrup Pool information');

    try {
      // Check cache first
      const cacheKey = `syrup_pool:${address}`;
      if (this.config.cacheFarmData) {
        const cached = await this.cache.get<SyrupPool>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get pool contract
      const poolContract = new ethers.Contract(
        address,
        SYRUP_POOL_ABI,
        await this.provider.getProvider()
      );

      // Get pool data
      const [
        stakingToken,
        rewardsToken,
        rewardRate,
        rewardPerTokenStored,
        lastUpdateTime,
        periodFinish,
        balance,
        totalSupply
      ] = await Promise.all([
        poolContract.stakingToken(),
        poolContract.rewardsToken(),
        poolContract.rewardRate(),
        poolContract.rewardPerTokenStored(),
        poolContract.lastUpdateTime(),
        poolContract.periodFinish(),
        poolContract.balanceOf(address),
        poolContract.totalSupply()
      ]);

      // Get token information
      const [stakingTokenInfo, rewardsTokenInfo] = await Promise.all([
        this.getTokenInfo(stakingToken),
        this.getTokenInfo(rewardsToken)
      ]);

      // Calculate performance metrics
      const apr = await this.calculateSyrupPoolAPR(rewardRate, totalSupply, rewardsTokenInfo);
      const apy = this.calculateAPYFromAPR(apr);

      // Determine pool status
      const now = Math.floor(Date.now() / 1000);
      const isFinished = periodFinish.toNumber() < now;
      const isActive = !isFinished && parseFloat(totalSupply.toString()) > 0;

      // Determine category
      const category = this.determineSyrupPoolCategory(stakingTokenInfo, rewardsTokenInfo);

      const syrupPool: SyrupPool = {
        id: `syrup_${address.slice(-8)}`,
        address,
        name: `${stakingTokenInfo.symbol} Staking Pool`,
        description: `Stake ${stakingTokenInfo.name} and earn ${rewardsTokenInfo.name}`,
        category,
        stakingToken: stakingTokenInfo,
        rewardToken: rewardsTokenInfo,
        rewardRate: rewardRate.toString(),
        rewardPerTokenStored: rewardPerTokenStored.toString(),
        lastUpdateTime: lastUpdateTime.toNumber() * 1000,
        periodFinish: periodFinish.toNumber() * 1000,
        apr,
        apy,
        tvl: parseFloat(ethers.formatEther(totalSupply)) * (stakingTokenInfo.priceUSD || 1),
        totalStaked: totalSupply.toString(),
        isActive,
        isFinished,
        isLocked: false, // Would check pool-specific settings
        flexible: true, // Default to flexible
        createdAt: Date.now() - 86400000 * 30, // Assume 30 days ago
        updatedAt: Date.now(),
        logoURI: stakingTokenInfo.logoURI
      };

      // Cache pool data
      if (this.config.cacheFarmData) {
        await this.cache.set(cacheKey, syrupPool, this.config.farmDataCacheTTL);
      }

      return syrupPool;

    } catch (error) {
      logger.error({
        address,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get Syrup Pool information');

      return null;
    }
  }

  /**
   * Get all Syrup Pools, optionally filtered by category
   */
  async getSyrupPools(category?: StakingCategory): Promise<SyrupPool[]> {
    logger.debug({ category }, 'Getting Syrup Pools');

    try {
      // Get all known Syrup Pools
      const poolPromises = this.SYRUP_POOLS.map(address =>
        this.getSyrupPool(address).catch(error => {
          logger.warn({
            address,
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Failed to get Syrup Pool, skipping');
          return null;
        })
      );

      const pools = await Promise.all(poolPromises);
      const validPools = pools.filter((pool): pool is SyrupPool => pool !== null);

      // Filter by category if specified
      const filteredPools = category
        ? validPools.filter(pool => pool.category === category)
        : validPools;

      // Sort by APR (descending)
      filteredPools.sort((a, b) => b.apr - a.apr);

      return filteredPools;

    } catch (error) {
      logger.error({
        category,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get Syrup Pools');

      return [];
    }
  }

  /**
   * Get active Syrup Pools
   */
  async getActiveSyrupPools(): Promise<SyrupPool[]> {
    logger.debug('Getting active Syrup Pools');

    try {
      const allPools = await this.getSyrupPools();
      const activePools = allPools.filter(pool => pool.isActive && !pool.isFinished);

      return activePools;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get active Syrup Pools');

      return [];
    }
  }

  /**
   * Get finished Syrup Pools
   */
  async getFinishedSyrupPools(): Promise<SyrupPool[]> {
    logger.debug('Getting finished Syrup Pools');

    try {
      const allPools = await this.getSyrupPools();
      const finishedPools = allPools.filter(pool => pool.isFinished);

      // Sort by finish time (most recent first)
      finishedPools.sort((a, b) => b.periodFinish - a.periodFinish);

      return finishedPools;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get finished Syrup Pools');

      return [];
    }
  }

  /**
   * Get user's position in a Syrup Pool
   */
  async getUserSyrupPosition(userAddress: string, poolAddress: string): Promise<YieldPosition | null> {
    logger.debug({ userAddress, poolAddress }, 'Getting user Syrup Pool position');

    try {
      // Check cache first
      const cacheKey = `syrup_position:${userAddress}:${poolAddress}`;
      if (this.config.cacheUserData) {
        const cached = await this.cache.get<YieldPosition>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get pool information
      const pool = await this.getSyrupPool(poolAddress);
      if (!pool) {
        return null;
      }

      // Get pool contract
      const poolContract = new ethers.Contract(
        poolAddress,
        SYRUP_POOL_ABI,
        await this.provider.getProvider()
      );

      // Get user data
      const [balance, earned] = await Promise.all([
        poolContract.balanceOf(userAddress),
        poolContract.earned(userAddress)
      ]);

      const userStaked = balance.toString();
      const userRewards = earned.toString();

      if (parseFloat(userStaked) === 0) {
        return null;
      }

      // Calculate position value
      const userValueUSD = parseFloat(userStaked) * pool.stakingToken.priceUSD!;

      const position: YieldPosition = {
        id: `${userAddress}_${poolAddress}`,
        userAddress,
        farmId: pool.id,
        poolId: poolAddress,
        amount: userStaked,
        valueUSD: userValueUSD,
        totalEarned: userRewards,
        rewardEarned: userRewards,
        feeEarned: '0',
        compoundEarned: '0',
        apr: pool.apr,
        apy: pool.apy,
        roi: 0, // Would calculate from historical data
        impermanentLoss: 0, // No impermanent loss for single-sided staking
        createdAt: Date.now(), // Would fetch from deposit event
        updatedAt: Date.now(),
        lastHarvestAt: Date.now(), // Would fetch from last harvest
        duration: 0, // Would calculate from creation time
        isActive: true,
        isAutoCompounding: false,
        isLocked: pool.isLocked,
        farmType: 'syrup',
        syrupPool: pool
      };

      // Cache position data
      if (this.config.cacheUserData) {
        await this.cache.set(cacheKey, position, this.config.userDataCacheTTL);
      }

      return position;

    } catch (error) {
      logger.error({
        userAddress,
        poolAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get user Syrup Pool position');

      return null;
    }
  }

  /**
   * Get all user's Syrup Pool positions
   */
  async getUserSyrupPositions(userAddress: string): Promise<YieldPosition[]> {
    logger.debug({ userAddress }, 'Getting user Syrup Pool positions');

    try {
      // Get all Syrup Pools
      const pools = await this.getSyrupPools();

      // Get positions for each pool
      const positions = await Promise.all(
        pools.map(async pool => {
          try {
            const position = await this.getUserSyrupPosition(userAddress, pool.address);
            return position;
          } catch (error) {
            logger.warn({
              userAddress,
              poolAddress: pool.address,
              error: error instanceof Error ? error.message : 'Unknown error'
            }, 'Failed to get user Syrup Pool position');
            return null;
          }
        })
      );

      // Filter out null positions
      const activePositions = positions.filter((position): position is YieldPosition =>
        position !== null && position.isActive
      );

      // Sort by value (descending)
      activePositions.sort((a, b) => b.valueUSD - a.valueUSD);

      return activePositions;

    } catch (error) {
      logger.error({
        userAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get user Syrup Pool positions');

      return [];
    }
  }

  /**
   * Stake tokens in a Syrup Pool
   */
  async stakeSyrup(userAddress: string, poolAddress: string, amount: string): Promise<YieldOperation> {
    logger.debug({ userAddress, poolAddress, amount }, 'Staking in Syrup Pool');

    try {
      // Get pool information
      const pool = await this.getSyrupPool(poolAddress);
      if (!pool) {
        throw new Error('Syrup Pool not found');
      }

      if (!pool.isActive) {
        throw new Error('Syrup Pool is not active');
      }

      // Get gas estimate
      const gasEstimate = await this.gasOptimizationService.estimateGasForTransaction({
        to: poolAddress,
        data: '0x', // Will be populated with actual deposit data
        value: '0'
      });

      const operation: YieldOperation = {
        id: `syrup_stake_${Date.now()}_${Math.random()}`,
        type: YieldOperationType.DEPOSIT,
        userAddress,
        farmId: pool.id,
        poolId: poolAddress,
        amount,
        valueUSD: parseFloat(amount) * pool.stakingToken.priceUSD!,
        rewards: '0',
        fees: '0',
        transactionHash: '',
        blockNumber: 0,
        timestamp: Date.now(),
        gasUsed: gasEstimate.gasLimit,
        gasCostUSD: parseFloat(gasEstimate.estimatedCostUSD),
        status: 'pending',
        confirmations: 0
      };

      // Invalidate user position cache
      await this.invalidateSyrupPositionCache(userAddress, poolAddress);

      logger.info({
        operationId: operation.id,
        userAddress,
        poolId: pool.id,
        poolAddress,
        amount
      }, 'Syrup Pool stake prepared');

      return operation;

    } catch (error) {
      logger.error({
        userAddress,
        poolAddress,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to prepare Syrup Pool stake');

      const yieldError: YieldError = {
        code: YieldErrorCode.DEPOSIT_FAILED,
        message: `Failed to prepare Syrup Pool stake: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, poolAddress, amount }
      };

      throw yieldError;
    }
  }

  /**
   * Unstake tokens from a Syrup Pool
   */
  async unstakeSyrup(userAddress: string, poolAddress: string, amount: string): Promise<YieldOperation> {
    logger.debug({ userAddress, poolAddress, amount }, 'Unstaking from Syrup Pool');

    try {
      // Get pool information
      const pool = await this.getSyrupPool(poolAddress);
      if (!pool) {
        throw new Error('Syrup Pool not found');
      }

      // Get user position
      const position = await this.getUserSyrupPosition(userAddress, poolAddress);
      if (!position) {
        throw new Error('User position not found');
      }

      if (parseFloat(position.amount) < parseFloat(amount)) {
        throw new Error('Insufficient balance');
      }

      // Check for early withdrawal fee
      const earlyWithdrawalFee = await this.calculateEarlyWithdrawalFee(userAddress, poolAddress, amount);

      // Get gas estimate
      const gasEstimate = await this.gasOptimizationService.estimateGasForTransaction({
        to: poolAddress,
        data: '0x', // Will be populated with actual withdraw data
        value: '0'
      });

      const operation: YieldOperation = {
        id: `syrup_unstake_${Date.now()}_${Math.random()}`,
        type: YieldOperationType.WITHDRAW,
        userAddress,
        farmId: pool.id,
        poolId: poolAddress,
        amount,
        valueUSD: parseFloat(amount) * pool.stakingToken.priceUSD!,
        rewards: position.rewardEarned,
        fees: earlyWithdrawalFee,
        transactionHash: '',
        blockNumber: 0,
        timestamp: Date.now(),
        gasUsed: gasEstimate.gasLimit,
        gasCostUSD: parseFloat(gasEstimate.estimatedCostUSD),
        status: 'pending',
        confirmations: 0
      };

      // Invalidate user position cache
      await this.invalidateSyrupPositionCache(userAddress, poolAddress);

      logger.info({
        operationId: operation.id,
        userAddress,
        poolId: pool.id,
        poolAddress,
        amount,
        earlyWithdrawalFee
      }, 'Syrup Pool unstake prepared');

      return operation;

    } catch (error) {
      logger.error({
        userAddress,
        poolAddress,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to prepare Syrup Pool unstake');

      const yieldError: YieldError = {
        code: YieldErrorCode.WITHDRAWAL_FAILED,
        message: `Failed to prepare Syrup Pool unstake: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, poolAddress, amount }
      };

      throw yieldError;
    }
  }

  /**
   * Claim rewards from a Syrup Pool
   */
  async claimSyrupRewards(userAddress: string, poolAddress: string): Promise<YieldOperation> {
    logger.debug({ userAddress, poolAddress }, 'Claiming Syrup Pool rewards');

    try {
      // Get pool information
      const pool = await this.getSyrupPool(poolAddress);
      if (!pool) {
        throw new Error('Syrup Pool not found');
      }

      // Get user position to check rewards
      const position = await this.getUserSyrupPosition(userAddress, poolAddress);
      if (!position) {
        throw new Error('User position not found');
      }

      if (parseFloat(position.rewardEarned) === 0) {
        throw new Error('No rewards to claim');
      }

      // Get gas estimate
      const gasEstimate = await this.gasOptimizationService.estimateGasForTransaction({
        to: poolAddress,
        data: '0x', // Will be populated with actual claim data
        value: '0'
      });

      const operation: YieldOperation = {
        id: `syrup_claim_${Date.now()}_${Math.random()}`,
        type: YieldOperationType.CLAIM,
        userAddress,
        farmId: pool.id,
        poolId: poolAddress,
        amount: '0',
        valueUSD: 0,
        rewards: position.rewardEarned,
        fees: '0',
        transactionHash: '',
        blockNumber: 0,
        timestamp: Date.now(),
        gasUsed: gasEstimate.gasLimit,
        gasCostUSD: parseFloat(gasEstimate.estimatedCostUSD),
        status: 'pending',
        confirmations: 0
      };

      // Invalidate user position cache
      await this.invalidateSyrupPositionCache(userAddress, poolAddress);

      logger.info({
        operationId: operation.id,
        userAddress,
        poolId: pool.id,
        poolAddress,
        rewards: position.rewardEarned
      }, 'Syrup Pool claim prepared');

      return operation;

    } catch (error) {
      logger.error({
        userAddress,
        poolAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to prepare Syrup Pool claim');

      const yieldError: YieldError = {
        code: YieldErrorCode.HARVEST_FAILED,
        message: `Failed to prepare Syrup Pool claim: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, poolAddress }
      };

      throw yieldError;
    }
  }

  /**
   * Emergency withdraw from a Syrup Pool
   */
  async emergencyWithdrawSyrup(userAddress: string, poolAddress: string): Promise<YieldOperation> {
    logger.debug({ userAddress, poolAddress }, 'Emergency withdrawing from Syrup Pool');

    try {
      // Get pool information
      const pool = await this.getSyrupPool(poolAddress);
      if (!pool) {
        throw new Error('Syrup Pool not found');
      }

      // Get user position
      const position = await this.getUserSyrupPosition(userAddress, poolAddress);
      if (!position) {
        throw new Error('User position not found');
      }

      // Get gas estimate
      const gasEstimate = await this.gasOptimizationService.estimateGasForTransaction({
        to: poolAddress,
        data: '0x', // Will be populated with actual emergency withdraw data
        value: '0'
      });

      const operation: YieldOperation = {
        id: `syrup_emergency_${Date.now()}_${Math.random()}`,
        type: YieldOperationType.EMERGENCY_WITHDRAW,
        userAddress,
        farmId: pool.id,
        poolId: poolAddress,
        amount: position.amount,
        valueUSD: position.valueUSD,
        rewards: '0', // Emergency withdraw forfeits rewards
        fees: '0',
        transactionHash: '',
        blockNumber: 0,
        timestamp: Date.now(),
        gasUsed: gasEstimate.gasLimit,
        gasCostUSD: parseFloat(gasEstimate.estimatedCostUSD),
        status: 'pending',
        confirmations: 0
      };

      // Invalidate user position cache
      await this.invalidateSyrupPositionCache(userAddress, poolAddress);

      logger.info({
        operationId: operation.id,
        userAddress,
        poolId: pool.id,
        poolAddress,
        amount: position.amount
      }, 'Syrup Pool emergency withdraw prepared');

      return operation;

    } catch (error) {
      logger.error({
        userAddress,
        poolAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to prepare Syrup Pool emergency withdraw');

      const yieldError: YieldError = {
        code: YieldErrorCode.WITHDRAWAL_FAILED,
        message: `Failed to prepare Syrup Pool emergency withdraw: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, poolAddress }
      };

      throw yieldError;
    }
  }

  /**
   * Discover new Syrup Pools
   */
  async discoverSyrupPools(): Promise<SyrupPool[]> {
    logger.debug('Discovering Syrup Pools');

    try {
      // In a real implementation, this would:
      // 1. Query the blockchain for new staking pool contracts
      // 2. Check PancakeSwap API for new pools
      // 3. Monitor events for new pool deployments
      // 4. Cross-reference with external data sources

      // For now, return existing pools
      const pools = await this.getSyrupPools();

      const discoveredPools = pools.map(pool => ({
        ...pool,
        isHot: this.isHotSyrupPool(pool),
        isVerified: this.isVerifiedSyrupPool(pool)
      }));

      return discoveredPools;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to discover Syrup Pools');

      return [];
    }
  }

  /**
   * Validate a Syrup Pool
   */
  async validateSyrupPool(poolAddress: string): Promise<{ isValid: boolean; issues: string[] }> {
    logger.debug({ poolAddress }, 'Validating Syrup Pool');

    try {
      const issues: string[] = [];
      let isValid = true;

      const pool = await this.getSyrupPool(poolAddress);
      if (!pool) {
        issues.push('Syrup Pool not found');
        return { isValid: false, issues };
      }

      // Check TVL
      if (pool.tvl < 10000) {
        issues.push('Very low TVL (< $10,000)');
        isValid = false;
      } else if (pool.tvl < 100000) {
        issues.push('Low TVL (< $100,000)');
      }

      // Check APR
      if (pool.apr > 500) {
        issues.push('Unusually high APR (> 500%) - potential risk');
      } else if (pool.apr < 1) {
        issues.push('Very low APR (< 1%)');
      }

      // Check if pool is finished
      if (pool.isFinished) {
        issues.push('Pool has finished - no more rewards');
        isValid = false;
      }

      // Check token verification
      if (!this.isVerifiedSyrupPool(pool)) {
        issues.push('Pool contains unverified tokens');
        if (this.config.requireVerification) {
          isValid = false;
        }
      }

      return { isValid, issues };

    } catch (error) {
      logger.error({
        poolAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to validate Syrup Pool');

      return { isValid: false, issues: ['Validation failed'] };
    }
  }

  /**
   * Get Syrup Pool performance
   */
  async getSyrupPoolPerformance(poolAddress: string, period: string = '24h'): Promise<any> {
    logger.debug({ poolAddress, period }, 'Getting Syrup Pool performance');

    try {
      const pool = await this.getSyrupPool(poolAddress);
      if (!pool) {
        throw new Error('Syrup Pool not found');
      }

      // This would typically fetch from analytics service
      // For now, return basic performance data
      const performance = {
        poolId: pool.id,
        period,
        totalReturn: pool.apr / 100,
        annualizedReturn: pool.apr / 100,
        volatility: 0.1, // Lower volatility for single-sided staking
        sharpeRatio: (pool.apr / 100) / 0.1,
        maxDrawdown: 0.05, // Lower drawdown for single-sided staking
        totalStakers: 0, // Would fetch from analytics
        activeStakers: 0,
        newStakers: 0,
        averageStakeSize: pool.tvl / 100, // Placeholder
        concentrationRisk: this.calculateSyrupConcentrationRisk(pool),
        smartContractRisk: 0.1, // Low for established pools
        tokenRisk: this.calculateSyrupTokenRisk(pool),
        calculatedAt: Date.now(),
        periodStart: Date.now() - this.parsePeriod(period),
        periodEnd: Date.now()
      };

      return performance;

    } catch (error) {
      logger.error({
        poolAddress,
        period,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get Syrup Pool performance');

      const yieldError: YieldError = {
        code: YieldErrorCode.NETWORK_ERROR,
        message: `Failed to get Syrup Pool performance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { poolAddress, period }
      };

      throw yieldError;
    }
  }

  /**
   * Get Syrup Pool trends
   */
  async getSyrupPoolTrends(period: string = '7d'): Promise<SyrupPoolTrend[]> {
    logger.debug({ period }, 'Getting Syrup Pool trends');

    try {
      const pools = await this.getActiveSyrupPools();

      const trends: SyrupPoolTrend[] = await Promise.all(
        pools.map(async pool => {
          // Historical data (simplified)
          const change24h = await this.calculateHistoricalChange(pool, '1d');
          const change7d = await this.calculateHistoricalChange(pool, '7d');
          const change30d = await this.calculateHistoricalChange(pool, '30d');

          // Predictions (simplified)
          const prediction = pool.apr * (1 + (change7d / 100));

          return {
            poolAddress: pool.address,
            apr: pool.apr,
            apy: pool.apy,
            tvl: pool.tvl,
            stakers: 0, // Would fetch from analytics
            change24h,
            change7d,
            change30d,
            trend: change7d > 5 ? 'up' : change7d < -5 ? 'down' : 'stable',
            prediction
          };
        })
      );

      // Sort by TVL (descending)
      trends.sort((a, b) => b.tvl - a.tvl);

      return trends;

    } catch (error) {
      logger.error({
        period,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get Syrup Pool trends');

      return [];
    }
  }

  /**
   * Get top Syrup Pools by specified metric
   */
  async getTopSyrupPools(limit: number = 10, sortBy: string = 'apr'): Promise<SyrupPool[]> {
    logger.debug({ limit, sortBy }, 'Getting top Syrup Pools');

    try {
      const pools = await this.getActiveSyrupPools();

      // Sort pools by specified metric
      const sortedPools = pools.sort((a, b) => {
        const aValue = (a as any)[sortBy] || 0;
        const bValue = (b as any)[sortBy] || 0;
        return bValue - aValue;
      });

      return sortedPools.slice(0, limit);

    } catch (error) {
      logger.error({
        limit,
        sortBy,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get top Syrup Pools');

      return [];
    }
  }

  /**
   * Calculate pending rewards for a user
   */
  async calculatePendingRewards(userAddress: string, poolAddress: string): Promise<string> {
    logger.debug({ userAddress, poolAddress }, 'Calculating pending rewards');

    try {
      // Get user position
      const position = await this.getUserSyrupPosition(userAddress, poolAddress);
      if (!position) {
        return '0';
      }

      return position.rewardEarned;

    } catch (error) {
      logger.error({
        userAddress,
        poolAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to calculate pending rewards');

      return '0';
    }
  }

  /**
   * Calculate reward rate for a pool
   */
  async calculateRewardRate(poolAddress: string): Promise<string> {
    logger.debug({ poolAddress }, 'Calculating reward rate');

    try {
      const pool = await this.getSyrupPool(poolAddress);
      if (!pool) {
        return '0';
      }

      return pool.rewardRate;

    } catch (error) {
      logger.error({
        poolAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to calculate reward rate');

      return '0';
    }
  }

  /**
   * Estimate rewards for a given period
   */
  async estimateRewards(userAddress: string, poolAddress: string, days: number): Promise<RewardEstimate> {
    logger.debug({ userAddress, poolAddress, days }, 'Estimating rewards');

    try {
      // Get pool and position
      const [pool, position] = await Promise.all([
        this.getSyrupPool(poolAddress),
        this.getUserSyrupPosition(userAddress, poolAddress)
      ]);

      if (!pool || !position) {
        throw new Error('Pool or position not found');
      }

      const dailyRate = pool.apr / 36500;
      const dailyRewards = position.valueUSD * dailyRate;
      const currentValue = position.valueUSD + parseFloat(position.rewardEarned);

      const estimate: RewardEstimate = {
        daily: (dailyRewards * (pool.rewardTokenInfo.priceUSD || 2.5)).toString(),
        weekly: (dailyRewards * 7 * (pool.rewardTokenInfo.priceUSD || 2.5)).toString(),
        monthly: (dailyRewards * 30 * (pool.rewardTokenInfo.priceUSD || 2.5)).toString(),
        yearly: (dailyRewards * 365 * (pool.rewardTokenInfo.priceUSD || 2.5)).toString(),
        currentAPR: pool.apr,
        projectedValue: currentValue * (1 + pool.apr / 100 * days / 365),
        assumptions: [
          'APR remains constant',
          'No additional deposits or withdrawals',
          'No protocol changes',
          'Token prices remain stable'
        ]
      };

      return estimate;

    } catch (error) {
      logger.error({
        userAddress,
        poolAddress,
        days,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to estimate rewards');

      // Return conservative estimate
      return {
        daily: '0',
        weekly: '0',
        monthly: '0',
        yearly: '0',
        currentAPR: 0,
        projectedValue: 0,
        assumptions: ['Error in calculation']
      };
    }
  }

  /**
   * Get lock information for a user position
   */
  async getLockInfo(userAddress: string, poolAddress: string): Promise<LockInfo> {
    logger.debug({ userAddress, poolAddress }, 'Getting lock information');

    try {
      // Get position
      const position = await this.getUserSyrupPosition(userAddress, poolAddress);
      if (!position) {
        throw new Error('Position not found');
      }

      const pool = await this.getSyrupPool(poolAddress);
      if (!pool) {
        throw new Error('Pool not found');
      }

      // In a real implementation, this would fetch actual lock data
      const lockInfo: LockInfo = {
        userAddress,
        poolAddress,
        lockedAmount: position.amount,
        lockedUntil: pool.isLocked ? Date.now() + 30 * 24 * 60 * 60 * 1000 : 0, // 30 days if locked
        remainingDays: pool.isLocked ? 30 : 0,
        earlyWithdrawalFee: pool.isLocked ? 0.1 : 0, // 10% if locked
        canWithdraw: !pool.isLocked,
        lockDuration: pool.isLocked ? 30 * 24 * 60 * 60 * 1000 : 0,
        rewardsWhileLocked: position.rewardEarned
      };

      return lockInfo;

    } catch (error) {
      logger.error({
        userAddress,
        poolAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get lock information');

      // Return default lock info
      return {
        userAddress,
        poolAddress,
        lockedAmount: '0',
        lockedUntil: 0,
        remainingDays: 0,
        earlyWithdrawalFee: 0,
        canWithdraw: true,
        lockDuration: 0,
        rewardsWhileLocked: '0'
      };
    }
  }

  /**
   * Extend lock period
   */
  async extendLockPeriod(userAddress: string, poolAddress: string, additionalDays: number): Promise<YieldOperation> {
    logger.debug({ userAddress, poolAddress, additionalDays }, 'Extending lock period');

    try {
      // Get lock info
      const lockInfo = await this.getLockInfo(userAddress, poolAddress);
      if (!lockInfo.lockDuration) {
        throw new Error('Pool does not support locking');
      }

      // Get pool information
      const pool = await this.getSyrupPool(poolAddress);
      if (!pool) {
        throw new Error('Syrup Pool not found');
      }

      // Get gas estimate
      const gasEstimate = await this.gasOptimizationService.estimateGasForTransaction({
        to: poolAddress,
        data: '0x', // Would be populated with actual extend lock data
        value: '0'
      });

      const operation: YieldOperation = {
        id: `extend_lock_${Date.now()}_${Math.random()}`,
        type: YieldOperationType.DEPOSIT,
        userAddress,
        farmId: pool.id,
        poolId: poolAddress,
        amount: '0',
        valueUSD: 0,
        rewards: '0',
        fees: '0',
        transactionHash: '',
        blockNumber: 0,
        timestamp: Date.now(),
        gasUsed: gasEstimate.gasLimit,
        gasCostUSD: parseFloat(gasEstimate.estimatedCostUSD),
        status: 'pending',
        confirmations: 0
      };

      logger.info({
        operationId: operation.id,
        userAddress,
        poolId: pool.id,
        poolAddress,
        additionalDays
      }, 'Lock period extension prepared');

      return operation;

    } catch (error) {
      logger.error({
        userAddress,
        poolAddress,
        additionalDays,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to prepare lock period extension');

      const yieldError: YieldError = {
        code: YieldErrorCode.DEPOSIT_FAILED,
        message: `Failed to prepare lock extension: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, poolAddress, additionalDays }
      };

      throw yieldError;
    }
  }

  /**
   * Calculate early withdrawal fee
   */
  async calculateEarlyWithdrawalFee(userAddress: string, poolAddress: string, amount: string): Promise<string> {
    logger.debug({ userAddress, poolAddress, amount }, 'Calculating early withdrawal fee');

    try {
      // Get lock info
      const lockInfo = await this.getLockInfo(userAddress, poolAddress);

      if (!lockInfo.lockDuration || lockInfo.canWithdraw) {
        return '0'; // No fee if not locked or can withdraw
      }

      // Calculate fee based on remaining lock time
      const remainingPercentage = lockInfo.remainingDays / 30; // Assume 30-day lock period
      const feeRate = lockInfo.earlyWithdrawalFee * remainingPercentage;
      const feeAmount = parseFloat(amount) * feeRate;

      return feeAmount.toString();

    } catch (error) {
      logger.error({
        userAddress,
        poolAddress,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to calculate early withdrawal fee');

      return '0';
    }
  }

  // Private helper methods

  private calculateAPYFromAPR(apr: number): number {
    // Compound daily
    return Math.pow(1 + apr / 36500, 365) - 1;
  }

  private async calculateSyrupPoolAPR(rewardRate: bigint, totalSupply: bigint, rewardToken: TokenInfo): Promise<number> {
    const rewardRatePerYear = Number(rewardRate) * 365 * 86400;
    const totalSupplyValue = Number(ethers.formatEther(totalSupply)) * (rewardToken.priceUSD || 2.5);

    return totalSupplyValue > 0 ? (rewardRatePerYear * (rewardToken.priceUSD || 2.5)) / totalSupplyValue * 100 : 0;
  }

  private determineSyrupPoolCategory(stakingToken: TokenInfo, rewardsToken: TokenInfo): StakingCategory {
    // Single token staking
    if (stakingToken.address === rewardsToken.address) {
      return StakingCategory.SINGLE_STAKING;
    }

    // LP token staking
    if (stakingToken.symbol.includes('LP') || stakingToken.name.includes('Liquidity')) {
      return StakingCategory.LIQUIDITY_MINING;
    }

    // Governance token
    if (stakingToken.symbol === 'CAKE' || stakingToken.symbol === 'UNI') {
      return StakingCategory.GOVERNANCE;
    }

    // Flexible staking (default)
    return StakingCategory.FLEXIBLE;
  }

  private async getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
    // Simplified token info - would fetch from token service
    const isCake = tokenAddress.toLowerCase() === this.CAKE_ADDRESS.toLowerCase();
    const isWBNB = tokenAddress.toLowerCase() === this.WBNB_ADDRESS.toLowerCase();

    return {
      address: tokenAddress,
      symbol: isCake ? 'CAKE' : isWBNB ? 'WBNB' : 'TOKEN',
      name: isCake ? 'PancakeSwap Token' : isWBNB ? 'Wrapped BNB' : 'Token',
      decimals: 18,
      priceUSD: isCake ? 2.5 : isWBNB ? 300 : 1,
      logoURI: undefined
    };
  }

  private isHotSyrupPool(pool: SyrupPool): boolean {
    // Hot pool criteria
    return pool.apr > 30 && pool.tvl > 100000;
  }

  private isVerifiedSyrupPool(pool: SyrupPool): boolean {
    // Verification criteria
    const blueChips = ['CAKE', 'WBNB', 'ETH', 'BTC', 'USDT', 'USDC', 'BUSD', 'DAI'];
    return blueChips.includes(pool.stakingToken.symbol) ||
           blueChips.includes(pool.rewardToken.symbol);
  }

  private calculateSyrupConcentrationRisk(pool: SyrupPool): number {
    // Single token staking has no impermanent loss risk
    return 0.1; // Lower concentration risk
  }

  private calculateSyrupTokenRisk(pool: SyrupPool): number {
    // Single token staking has lower risk than LP staking
    if (this.isVerifiedSyrupPool(pool)) {
      return 0.05;
    }
    return 0.15;
  }

  private parsePeriod(period: string): number {
    switch (period) {
      case '1h': return 3600000;
      case '24h': return 86400000;
      case '7d': return 604800000;
      case '30d': return 2592000000;
      default: return 86400000;
    }
  }

  private async calculateHistoricalChange(pool: SyrupPool, period: string): Promise<number> {
    // Simplified historical change calculation
    // In reality, would fetch historical data
    const multiplier = {
      '1d': Math.random() * 2 - 1,
      '7d': Math.random() * 4 - 2,
      '30d': Math.random() * 6 - 3
    }[period] || 0;

    return multiplier * pool.apr * 0.1; // Small percentage of APR
  }

  private async invalidateSyrupPositionCache(userAddress: string, poolAddress: string): Promise<void> {
    const cacheKey = `syrup_position:${userAddress}:${poolAddress}`;
    await this.cache.delete(cacheKey);
  }
}

// Export singleton instance
export const syrupPoolService = new SyrupPoolService();