/**
 * PancakeSwap Farm Integration Service
 * Handles integration with PancakeSwap farming contracts (MasterChef V1/V2)
 */

import { ethers } from 'ethers';
import logger from '../../../utils/logger.js';
import type {
  YieldFarm,
  YieldPosition,
  YieldOperation,
  YieldOperationType,
  FarmCategory,
  YieldConfig,
  YieldError,
  YieldErrorCode,
  TokenInfo
} from './types.js';
import { BSCProviderManager } from '../../utils/ethers-provider.js';
import { BSCCacheManager } from '../cache/cache-manager.js';
import { BSCGasOptimizationService, bscGasOptimizationService } from '../trading/gas-optimization.js';
import {
  MASTERCHEF_V2_ABI,
  MASTERCHEF_V1_ABI
} from './types.js';

/**
 * Farm Integration Interface
 */
export interface IFarmIntegration {
  // Farm information
  getFarm(pid: number): Promise<YieldFarm | null>;
  getFarms(category?: FarmCategory): Promise<YieldFarm[]>;
  getFarmByAddress(lpTokenAddress: string): Promise<YieldFarm | null>;

  // User positions
  getUserPosition(userAddress: string, pid: number): Promise<YieldPosition | null>;
  getUserPositions(userAddress: string): Promise<YieldPosition[]>;

  // Farm operations
  deposit(userAddress: string, pid: number, amount: string): Promise<YieldOperation>;
  withdraw(userAddress: string, pid: number, amount: string): Promise<YieldOperation>;
  harvest(userAddress: string, pid: number): Promise<YieldOperation>;
  withdrawAndHarvest(userAddress: string, pid: number, amount: string): Promise<YieldOperation>;
  emergencyWithdraw(userAddress: string, pid: number): Promise<YieldOperation>;

  // Farm discovery
  discoverFarms(): Promise<YieldFarm[]>;
  validateFarm(pid: number): Promise<{ isValid: boolean; issues: string[] }>;

  // Analytics
  getFarmPerformance(pid: number, period: string): Promise<any>;
  getTopFarms(limit: number, sortBy?: string): Promise<YieldFarm[]>;
}

/**
 * Farm Integration Implementation
 */
export class FarmIntegration implements IFarmIntegration {
  private provider: BSCProviderManager;
  private cache: BSCCacheManager;
  private gasOptimization: BSCGasOptimizationService;
  private config: YieldConfig;

  // Contract instances
  private masterChefV2Contract?: ethers.Contract;
  private masterChefV1Contract?: ethers.Contract;

  // Known addresses
  private readonly CAKE_ADDRESS = '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82';
  private readonly WBNB_ADDRESS = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
  private readonly MASTERCHEF_V2 = '0xa5f8c5dbd5f286960e9d8e7e8b15ae934c6c5d83';
  private readonly MASTERCHEF_V1 = '0x73feaa1ee314f8c655e354234017be2193c9e24e';
  private readonly PANCAKESWAP_FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';

  constructor(config?: Partial<YieldConfig>) {
    this.provider = new BSCProviderManager();
    this.cache = new BSCCacheManager();
    this.gasOptimization = new BSCGasOptimizationService();

    // Default configuration
    this.config = {
      masterChefV2: this.MASTERCHEF_V2,
      masterChefV1: this.MASTERCHEF_V1,
      rewardToken: this.CAKE_ADDRESS,
      defaultGasLimit: {
        deposit: 200000,
        withdraw: 200000,
        harvest: 200000,
        compound: 250000,
        approve: 50000
      },
      performanceFee: 0,
      compoundFee: 0.1, // 0.1%
      withdrawalFee: 0,
      autoCompound: false,
      compoundThreshold: '100000000000000000', // 0.1 CAKE
      compoundFrequency: 86400, // 24 hours
      cacheFarmData: true,
      farmDataCacheTTL: 30000, // 30 seconds
      cacheUserData: true,
      userDataCacheTTL: 60000, // 1 minute
      enableAnalytics: true,
      analyticsRetentionDays: 30,
      maxConcentration: 0.8, // 80%
      minFarmAge: 100, // 100 blocks
      maxFarmAge: 0, // No limit
      requireVerification: true,
      defaultRiskTolerance: 'moderate' as any,
      defaultLiquidityPreference: 'medium' as any,
      maxPositionsPerUser: 50,
      ...config
    };

    // Initialize contracts
    this.initializeContracts();
  }

  private async initializeContracts(): Promise<void> {
    const provider = await this.provider.getProvider();

    // MasterChef V2 contract
    if (this.config.masterChefV2) {
      this.masterChefV2Contract = new ethers.Contract(
        this.config.masterChefV2,
        MASTERCHEF_V2_ABI,
        provider
      );
    }

    // MasterChef V1 contract (for legacy farms)
    if (this.config.masterChefV1) {
      this.masterChefV1Contract = new ethers.Contract(
        this.config.masterChefV1,
        MASTERCHEF_V1_ABI,
        provider
      );
    }
  }

  /**
   * Get farm information by PID
   */
  async getFarm(pid: number): Promise<YieldFarm | null> {
    logger.debug({ pid }, 'Getting farm information');

    try {
      // Check cache first
      const cacheKey = `farm:${pid}`;
      if (this.config.cacheFarmData) {
        const cached = await this.cache.get<YieldFarm>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      if (!this.masterChefV2Contract) {
        throw new Error('MasterChef V2 contract not initialized');
      }

      // Get pool information from MasterChef
      const poolInfo = await this.masterChefV2Contract.poolInfo(pid);
      const totalAllocPoint = await this.masterChefV2Contract.totalAllocPoint();

      // Get additional pool data
      const [farm] = await Promise.all([
        this.enrichFarmData(pid, poolInfo, totalAllocPoint)
      ]);

      // Cache farm data
      if (this.config.cacheFarmData) {
        await this.cache.set(cacheKey, farm, this.config.farmDataCacheTTL);
      }

      return farm;

    } catch (error) {
      logger.error({
        pid,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get farm information');

      const yieldError: YieldError = {
        code: YieldErrorCode.FARM_NOT_FOUND,
        message: `Failed to get farm information: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { pid }
      };

      throw yieldError;
    }
  }

  /**
   * Get all farms, optionally filtered by category
   */
  async getFarms(category?: FarmCategory): Promise<YieldFarm[]> {
    logger.debug({ category }, 'Getting farms');

    try {
      if (!this.masterChefV2Contract) {
        throw new Error('MasterChef V2 contract not initialized');
      }

      // Get total number of pools
      const poolLength = await this.masterChefV2Contract.poolLength();
      const poolCount = Number(poolLength);

      // Get all pools
      const farms: YieldFarm[] = [];
      const batchSize = 20; // Process in batches to avoid rate limiting

      for (let i = 0; i < poolCount; i += batchSize) {
        const batch = Math.min(batchSize, poolCount - i);
        const batchPromises = [];

        for (let j = 0; j < batch; j++) {
          const pid = i + j;
          batchPromises.push(this.getFarm(pid).catch(error => {
            logger.warn({ pid, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get farm, skipping');
            return null;
          }));
        }

        const batchResults = await Promise.all(batchPromises);
        farms.push(...batchResults.filter((farm): farm is YieldFarm => farm !== null));
      }

      // Filter by category if specified
      const filteredFarms = category
        ? farms.filter(farm => farm.category === category)
        : farms;

      // Sort by APR (descending)
      filteredFarms.sort((a, b) => b.apr - a.apr);

      return filteredFarms;

    } catch (error) {
      logger.error({
        category,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get farms');

      return [];
    }
  }

  /**
   * Get farm by LP token address
   */
  async getFarmByAddress(lpTokenAddress: string): Promise<YieldFarm | null> {
    logger.debug({ lpTokenAddress }, 'Getting farm by LP token address');

    try {
      // Get all farms and find matching one
      const farms = await this.getFarms();
      const farm = farms.find(f => f.lpToken.toLowerCase() === lpTokenAddress.toLowerCase());

      return farm || null;

    } catch (error) {
      logger.error({
        lpTokenAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get farm by address');

      return null;
    }
  }

  /**
   * Get user position in a farm
   */
  async getUserPosition(userAddress: string, pid: number): Promise<YieldPosition | null> {
    logger.debug({ userAddress, pid }, 'Getting user position');

    try {
      // Check cache first
      const cacheKey = `position:${userAddress}:${pid}`;
      if (this.config.cacheUserData) {
        const cached = await this.cache.get<YieldPosition>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      if (!this.masterChefV2Contract) {
        throw new Error('MasterChef V2 contract not initialized');
      }

      // Get farm information
      const farm = await this.getFarm(pid);
      if (!farm) {
        return null;
      }

      // Get user information from MasterChef
      const userInfo = await this.masterChefV2Contract.userInfo(pid, userAddress);
      const pendingRewards = await this.masterChefV2Contract.pendingCake(pid, userAddress);

      // Calculate position value
      const userStaked = userInfo.amount.toString();
      const userValueUSD = parseFloat(userStaked) * (farm.tvl / parseFloat(farm.totalLiquidity));

      const position: YieldPosition = {
        id: `${userAddress}_${pid}`,
        userAddress,
        farmId: farm.id,
        poolId: pid.toString(),
        amount: userStaked,
        valueUSD: userValueUSD,
        totalEarned: pendingRewards.toString(),
        rewardEarned: pendingRewards.toString(),
        feeEarned: '0',
        compoundEarned: '0',
        apr: farm.apr,
        apy: farm.apy,
        roi: 0, // Would calculate from historical data
        impermanentLoss: 0, // Would calculate from price changes
        createdAt: Date.now(), // Would fetch from deposit event
        updatedAt: Date.now(),
        lastHarvestAt: Date.now(), // Would fetch from last harvest
        duration: 0, // Would calculate from creation time
        isActive: parseFloat(userStaked) > 0,
        isAutoCompounding: false,
        isLocked: false,
        farmType: 'regular',
        farm
      };

      // Cache position data
      if (this.config.cacheUserData) {
        await this.cache.set(cacheKey, position, this.config.userDataCacheTTL);
      }

      return position;

    } catch (error) {
      logger.error({
        userAddress,
        pid,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get user position');

      const yieldError: YieldError = {
        code: YieldErrorCode.POSITION_NOT_FOUND,
        message: `Failed to get user position: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, pid }
      };

      throw yieldError;
    }
  }

  /**
   * Get all user positions
   */
  async getUserPositions(userAddress: string): Promise<YieldPosition[]> {
    logger.debug({ userAddress }, 'Getting user positions');

    try {
      // Get all farms
      const farms = await this.getFarms();

      // Get positions for each farm
      const positions = await Promise.all(
        farms.map(async farm => {
          try {
            const position = await this.getUserPosition(userAddress, farm.pid);
            return position;
          } catch (error) {
            logger.warn({
              userAddress,
              farmId: farm.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            }, 'Failed to get user position for farm');
            return null;
          }
        })
      );

      // Filter out null positions and inactive ones
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
      }, 'Failed to get user positions');

      return [];
    }
  }

  /**
   * Deposit into farm
   */
  async deposit(userAddress: string, pid: number, amount: string): Promise<YieldOperation> {
    logger.debug({ userAddress, pid, amount }, 'Depositing into farm');

    try {
      const farm = await this.getFarm(pid);
      if (!farm) {
        throw new Error('Farm not found');
      }

      if (farm.isFinished) {
        throw new Error('Farm is finished');
      }

      // Get gas estimate
      const gasEstimate = await this.gasOptimizationService.estimateGasForTransaction({
        to: this.config.masterChefV2,
        data: this.masterChefV2Contract?.interface.encodeFunctionData('deposit', [pid, amount]) || '0x',
        value: '0'
      });

      const operation: YieldOperation = {
        id: `deposit_${Date.now()}_${Math.random()}`,
        type: YieldOperationType.DEPOSIT,
        userAddress,
        farmId: farm.id,
        poolId: pid.toString(),
        amount,
        valueUSD: parseFloat(amount) * (farm.tvl / parseFloat(farm.totalLiquidity)),
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
      await this.invalidateUserPositionCache(userAddress, pid);

      logger.info({
        operationId: operation.id,
        userAddress,
        farmId: farm.id,
        pid,
        amount
      }, 'Farm deposit prepared');

      return operation;

    } catch (error) {
      logger.error({
        userAddress,
        pid,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to prepare farm deposit');

      const yieldError: YieldError = {
        code: YieldErrorCode.DEPOSIT_FAILED,
        message: `Failed to prepare deposit: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, pid, amount }
      };

      throw yieldError;
    }
  }

  /**
   * Withdraw from farm
   */
  async withdraw(userAddress: string, pid: number, amount: string): Promise<YieldOperation> {
    logger.debug({ userAddress, pid, amount }, 'Withdrawing from farm');

    try {
      const farm = await this.getFarm(pid);
      if (!farm) {
        throw new Error('Farm not found');
      }

      // Get user position to validate withdrawal
      const position = await this.getUserPosition(userAddress, pid);
      if (!position) {
        throw new Error('User position not found');
      }

      if (parseFloat(position.amount) < parseFloat(amount)) {
        throw new Error('Insufficient balance');
      }

      // Get gas estimate
      const gasEstimate = await this.gasOptimizationService.estimateGasForTransaction({
        to: this.config.masterChefV2,
        data: this.masterChefV2Contract?.interface.encodeFunctionData('withdraw', [pid, amount]) || '0x',
        value: '0'
      });

      const operation: YieldOperation = {
        id: `withdraw_${Date.now()}_${Math.random()}`,
        type: YieldOperationType.WITHDRAW,
        userAddress,
        farmId: farm.id,
        poolId: pid.toString(),
        amount,
        valueUSD: parseFloat(amount) * (farm.tvl / parseFloat(farm.totalLiquidity)),
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
      await this.invalidateUserPositionCache(userAddress, pid);

      logger.info({
        operationId: operation.id,
        userAddress,
        farmId: farm.id,
        pid,
        amount
      }, 'Farm withdrawal prepared');

      return operation;

    } catch (error) {
      logger.error({
        userAddress,
        pid,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to prepare farm withdrawal');

      const yieldError: YieldError = {
        code: YieldErrorCode.WITHDRAWAL_FAILED,
        message: `Failed to prepare withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, pid, amount }
      };

      throw yieldError;
    }
  }

  /**
   * Harvest rewards from farm
   */
  async harvest(userAddress: string, pid: number): Promise<YieldOperation> {
    logger.debug({ userAddress, pid }, 'Harvesting from farm');

    try {
      const farm = await this.getFarm(pid);
      if (!farm) {
        throw new Error('Farm not found');
      }

      // Get user position to check rewards
      const position = await this.getUserPosition(userAddress, pid);
      if (!position) {
        throw new Error('User position not found');
      }

      if (parseFloat(position.rewardEarned) === 0) {
        throw new Error('No rewards to harvest');
      }

      // Get gas estimate
      const gasEstimate = await this.gasOptimizationService.estimateGasForTransaction({
        to: this.config.masterChefV2,
        data: this.masterChefV2Contract?.interface.encodeFunctionData('harvest', [pid, userAddress]) || '0x',
        value: '0'
      });

      const operation: YieldOperation = {
        id: `harvest_${Date.now()}_${Math.random()}`,
        type: YieldOperationType.HARVEST,
        userAddress,
        farmId: farm.id,
        poolId: pid.toString(),
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
      await this.invalidateUserPositionCache(userAddress, pid);

      logger.info({
        operationId: operation.id,
        userAddress,
        farmId: farm.id,
        pid,
        rewards: position.rewardEarned
      }, 'Farm harvest prepared');

      return operation;

    } catch (error) {
      logger.error({
        userAddress,
        pid,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to prepare farm harvest');

      const yieldError: YieldError = {
        code: YieldErrorCode.HARVEST_FAILED,
        message: `Failed to prepare harvest: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, pid }
      };

      throw yieldError;
    }
  }

  /**
   * Withdraw and harvest in single transaction
   */
  async withdrawAndHarvest(userAddress: string, pid: number, amount: string): Promise<YieldOperation> {
    logger.debug({ userAddress, pid, amount }, 'Withdrawing and harvesting from farm');

    try {
      const farm = await this.getFarm(pid);
      if (!farm) {
        throw new Error('Farm not found');
      }

      // Get user position to validate
      const position = await this.getUserPosition(userAddress, pid);
      if (!position) {
        throw new Error('User position not found');
      }

      if (parseFloat(position.amount) < parseFloat(amount)) {
        throw new Error('Insufficient balance');
      }

      // Get gas estimate
      const gasEstimate = await this.gasOptimizationService.estimateGasForTransaction({
        to: this.config.masterChefV2,
        data: this.masterChefV2Contract?.interface.encodeFunctionData('withdrawAndHarvest', [pid, amount]) || '0x',
        value: '0'
      });

      const operation: YieldOperation = {
        id: `withdraw_and_harvest_${Date.now()}_${Math.random()}`,
        type: YieldOperationType.WITHDRAW,
        userAddress,
        farmId: farm.id,
        poolId: pid.toString(),
        amount,
        valueUSD: parseFloat(amount) * (farm.tvl / parseFloat(farm.totalLiquidity)),
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
      await this.invalidateUserPositionCache(userAddress, pid);

      logger.info({
        operationId: operation.id,
        userAddress,
        farmId: farm.id,
        pid,
        amount,
        rewards: position.rewardEarned
      }, 'Farm withdraw and harvest prepared');

      return operation;

    } catch (error) {
      logger.error({
        userAddress,
        pid,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to prepare withdraw and harvest');

      const yieldError: YieldError = {
        code: YieldErrorCode.WITHDRAWAL_FAILED,
        message: `Failed to prepare withdraw and harvest: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, pid, amount }
      };

      throw yieldError;
    }
  }

  /**
   * Emergency withdraw from farm
   */
  async emergencyWithdraw(userAddress: string, pid: number): Promise<YieldOperation> {
    logger.debug({ userAddress, pid }, 'Emergency withdrawing from farm');

    try {
      const farm = await this.getFarm(pid);
      if (!farm) {
        throw new Error('Farm not found');
      }

      // Get user position
      const position = await this.getUserPosition(userAddress, pid);
      if (!position) {
        throw new Error('User position not found');
      }

      // Get gas estimate
      const gasEstimate = await this.gasOptimizationService.estimateGasForTransaction({
        to: this.config.masterChefV2,
        data: this.masterChefV2Contract?.interface.encodeFunctionData('emergencyWithdraw', [pid]) || '0x',
        value: '0'
      });

      const operation: YieldOperation = {
        id: `emergency_withdraw_${Date.now()}_${Math.random()}`,
        type: YieldOperationType.EMERGENCY_WITHDRAW,
        userAddress,
        farmId: farm.id,
        poolId: pid.toString(),
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
      await this.invalidateUserPositionCache(userAddress, pid);

      logger.info({
        operationId: operation.id,
        userAddress,
        farmId: farm.id,
        pid,
        amount: position.amount
      }, 'Farm emergency withdraw prepared');

      return operation;

    } catch (error) {
      logger.error({
        userAddress,
        pid,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to prepare emergency withdraw');

      const yieldError: YieldError = {
        code: YieldErrorCode.WITHDRAWAL_FAILED,
        message: `Failed to prepare emergency withdraw: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, pid }
      };

      throw yieldError;
    }
  }

  /**
   * Discover new farms
   */
  async discoverFarms(): Promise<YieldFarm[]> {
    logger.debug('Discovering farms');

    try {
      // Get all farms from MasterChef
      const farms = await this.getFarms();

      // Additional discovery logic could include:
      // - Checking for new pools in factory
      // - Analyzing token prices and volumes
      // - Cross-referencing with external data sources
      // - Identifying high-potential new farms

      const discoveredFarms = farms.map(farm => ({
        ...farm,
        category: this.categorizeFarm(farm),
        isHot: this.isHotFarm(farm),
        isVerified: this.isVerifiedFarm(farm)
      }));

      return discoveredFarms;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to discover farms');

      return [];
    }
  }

  /**
   * Validate farm
   */
  async validateFarm(pid: number): Promise<{ isValid: boolean; issues: string[] }> {
    logger.debug({ pid }, 'Validating farm');

    try {
      const issues: string[] = [];
      let isValid = true;

      const farm = await this.getFarm(pid);
      if (!farm) {
        issues.push('Farm not found');
        return { isValid: false, issues };
      }

      // Check liquidity
      if (farm.tvl < 10000) {
        issues.push('Very low liquidity (< $10,000)');
        isValid = false;
      } else if (farm.tvl < 100000) {
        issues.push('Low liquidity (< $100,000)');
      }

      // Check APR
      if (farm.apr > 1000) {
        issues.push('Unusually high APR (> 1000%) - potential risk');
      } else if (farm.apr < 1) {
        issues.push('Very low APR (< 1%)');
      }

      // Check farm age
      const farmAge = Date.now() - farm.createdAt;
      if (farmAge < 86400000) { // Less than 1 day
        issues.push('Farm is very new - exercise caution');
      }

      // Check token verification
      if (!this.isVerifiedFarm(farm)) {
        issues.push('Farm contains unverified tokens');
        if (this.config.requireVerification) {
          isValid = false;
        }
      }

      // Check if farm is finished
      if (farm.isFinished) {
        issues.push('Farm has finished - no more rewards');
        isValid = false;
      }

      return { isValid, issues };

    } catch (error) {
      logger.error({
        pid,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to validate farm');

      return { isValid: false, issues: ['Validation failed'] };
    }
  }

  /**
   * Get farm performance metrics
   */
  async getFarmPerformance(pid: number, period: string = '24h'): Promise<any> {
    logger.debug({ pid, period }, 'Getting farm performance');

    try {
      const farm = await this.getFarm(pid);
      if (!farm) {
        throw new Error('Farm not found');
      }

      // This would typically fetch from analytics service
      // For now, return basic performance data
      const performance = {
        farmId: farm.id,
        period,
        totalReturn: farm.apr / 100, // Convert to decimal
        annualizedReturn: farm.apr / 100,
        volatility: 0.2, // Placeholder
        sharpeRatio: (farm.apr / 100) / 0.2, // Simple calculation
        maxDrawdown: 0.1, // Placeholder
        farmRewards: farm.apr / 100,
        tradingFees: 0, // Would calculate from pool fees
        compoundReturns: 0, // Would calculate from compounding
        impermanentLoss: 0, // Would calculate from price changes
        totalVolume: farm.totalLiquidity,
        averageLiquidity: farm.tvl,
        liquidityUtilization: 0.5, // Placeholder
        totalUsers: 0, // Would fetch from analytics
        activeUsers: 0,
        newUsers: 0,
        averagePositionSize: farm.tvl / 100, // Placeholder
        concentrationRisk: this.calculateConcentrationRisk(farm),
        smartContractRisk: 0.1, // Low for established farms
        tokenRisk: this.calculateTokenRisk(farm),
        calculatedAt: Date.now(),
        periodStart: Date.now() - this.parsePeriod(period),
        periodEnd: Date.now()
      };

      return performance;

    } catch (error) {
      logger.error({
        pid,
        period,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get farm performance');

      const yieldError: YieldError = {
        code: YieldErrorCode.NETWORK_ERROR,
        message: `Failed to get farm performance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { pid, period }
      };

      throw yieldError;
    }
  }

  /**
   * Get top farms by specified metric
   */
  async getTopFarms(limit: number = 10, sortBy: string = 'apr'): Promise<YieldFarm[]> {
    logger.debug({ limit, sortBy }, 'Getting top farms');

    try {
      const farms = await this.getFarms();

      // Sort farms by specified metric
      const sortedFarms = farms.sort((a, b) => {
        const aValue = (a as any)[sortBy] || 0;
        const bValue = (b as any)[sortBy] || 0;
        return bValue - aValue;
      });

      return sortedFarms.slice(0, limit);

    } catch (error) {
      logger.error({
        limit,
        sortBy,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get top farms');

      return [];
    }
  }

  // Private helper methods

  private async enrichFarmData(pid: number, poolInfo: any, totalAllocPoint: any): Promise<YieldFarm> {
    // Get LP token information
    const lpTokenAddress = poolInfo.lpToken;
    const [token0Info, token1Info, rewardTokenInfo] = await Promise.all([
      this.getTokenInfo(lpTokenAddress, 'token0'),
      this.getTokenInfo(lpTokenAddress, 'token1'),
      this.getTokenInfo(this.config.rewardToken)
    ]);

    // Calculate APR and other metrics
    const apr = await this.calculateFarmAPR(pid, poolInfo, totalAllocPoint);
    const apy = this.calculateAPYFromAPR(apr);
    const multiplier = ((poolInfo.allocPoint * 100) / totalAllocPoint).toFixed(2);

    // Get pool liquidity information
    const tvl = await this.calculateFarmTVL(lpTokenAddress);
    const totalLiquidity = (tvl * 1e18).toString(); // Convert to wei

    const farm: YieldFarm = {
      id: `farm_${pid}`,
      pid,
      name: `${token0Info.symbol}-${token1Info.symbol} Farm`,
      description: `Farm ${token0Info.symbol}-${token1Info.symbol} tokens`,
      category: this.categorizeFarmByTokens(token0Info, token1Info),
      version: 'v2',
      lpToken: lpTokenAddress,
      masterChef: this.config.masterChefV2,
      rewardToken: this.config.rewardToken,
      token0: token0Info,
      token1: token1Info,
      rewardTokenInfo,
      allocPoint: Number(poolInfo.allocPoint),
      totalAllocPoint: Number(totalAllocPoint),
      lastRewardBlock: Number(poolInfo.lastRewardBlock),
      accCakePerShare: poolInfo.accCakePerShare.toString(),
      cakePerBlock: '40', // PancakeSwap block reward
      apr,
      apy,
      rewardApr: apr * 0.8, // 80% from rewards
      feeApr: apr * 0.2, // 20% from fees
      multiplier,
      totalLiquidity,
      totalLiquidityUSD: tvl,
      tvl,
      totalStaked: totalLiquidity,
      isActive: true,
      isFinished: false,
      isStable: this.isStableFarm(token0Info, token1Info),
      isHot: false, // Would determine from activity metrics
      isCAKEPool: token0Info.address === this.CAKE_ADDRESS || token1Info.address === this.CAKE_ADDRESS,
      startBlock: 0, // Would fetch from contract deployment
      createdAt: Date.now() - 86400000 * 30, // Assume 30 days ago
      updatedAt: Date.now(),
      project: 'PancakeSwap'
    };

    return farm;
  }

  private async getTokenInfo(tokenAddress: string, type?: 'token0' | 'token1'): Promise<TokenInfo> {
    // Simplified token info - in real implementation would fetch from token service
    const isCake = tokenAddress.toLowerCase() === this.CAKE_ADDRESS.toLowerCase();
    const isWBNB = tokenAddress.toLowerCase() === this.WBNB_ADDRESS.toLowerCase();

    return {
      address: tokenAddress,
      symbol: isCake ? 'CAKE' : isWBNB ? 'WBNB' : 'TOKEN',
      name: isCake ? 'PancakeSwap Token' : isWBNB ? 'Wrapped BNB' : 'Token',
      decimals: 18,
      priceUSD: isCake ? 2.5 : isWBNB ? 300 : 1 // Placeholder prices
    };
  }

  private async calculateFarmAPR(pid: number, poolInfo: any, totalAllocPoint: any): Promise<number> {
    // Simplified APR calculation - in real implementation would:
    // 1. Get CAKE price
    // 2. Calculate rewards per year
    // 3. Calculate farm TVL
    // 4. APR = (Rewards * Price) / TVL

    const allocPoint = Number(poolInfo.allocPoint);
    const totalAlloc = Number(totalAllocPoint);
    const cakePerBlock = 40; // CAKE per block
    const bnbBlocksPerYear = 10512000; // ~3-second blocks
    const cakePriceUSD = 2.5; // Placeholder price

    const farmCakePerYear = (allocPoint / totalAlloc) * cakePerBlock * bnbBlocksPerYear;
    const farmRewardValueUSD = farmCakePerYear * cakePriceUSD;

    const tvl = await this.calculateFarmTVL(poolInfo.lpToken);

    return tvl > 0 ? (farmRewardValueUSD / tvl) * 100 : 0;
  }

  private calculateAPYFromAPR(apr: number): number {
    // Compound daily
    return Math.pow(1 + apr / 36500, 365) - 1;
  }

  private async calculateFarmTVL(lpTokenAddress: string): Promise<number> {
    // Simplified TVL calculation - in real implementation would:
    // 1. Get LP token total supply
    // 2. Get pool reserves
    // 3. Calculate token values
    // 4. TVL = token0_value + token1_value

    return 1000000; // $1M placeholder
  }

  private categorizeFarm(farm: YieldFarm): FarmCategory {
    return this.categorizeFarmByTokens(farm.token0, farm.token1);
  }

  private categorizeFarmByTokens(token0: TokenInfo, token1: TokenInfo): FarmCategory {
    const isStable = this.isStableFarm(token0, token1);
    const isCake = token0.address === this.CAKE_ADDRESS || token1.address === this.CAKE_ADDRESS;
    const isWBNB = token0.address === this.WBNB_ADDRESS || token1.address === this.WBNB_ADDRESS;

    if (isStable) return FarmCategory.STABLE;
    if (isCake && isWBNB) return FarmCategory.BLUECHIP;
    if (isCake || isWBNB) return FarmCategory.DEFI;

    return FarmCategory.VOLATILE;
  }

  private isStableFarm(token0: TokenInfo, token1: TokenInfo): boolean {
    // Simplified stable farm detection
    const stableCoins = ['USDT', 'USDC', 'BUSD', 'DAI'];
    return stableCoins.includes(token0.symbol) && stableCoins.includes(token1.symbol);
  }

  private isHotFarm(farm: YieldFarm): boolean {
    // Hot farm criteria - would use real metrics
    return farm.apr > 50 && farm.tvl > 100000;
  }

  private isVerifiedFarm(farm: YieldFarm): boolean {
    // Verification criteria
    const blueChips = ['CAKE', 'WBNB', 'ETH', 'BTC', 'USDT', 'USDC', 'BUSD'];
    return blueChips.includes(farm.token0.symbol) && blueChips.includes(farm.token1.symbol);
  }

  private calculateConcentrationRisk(farm: YieldFarm): number {
    // Calculate concentration risk based on top holders
    return 0.2; // Placeholder
  }

  private calculateTokenRisk(farm: YieldFarm): number {
    // Calculate token risk based on volatility and other factors
    return farm.isStable ? 0.05 : 0.3;
  }

  private parsePeriod(period: string): number {
    // Parse period string to milliseconds
    switch (period) {
      case '1h': return 3600000;
      case '24h': return 86400000;
      case '7d': return 604800000;
      case '30d': return 2592000000;
      default: return 86400000;
    }
  }

  private async invalidateUserPositionCache(userAddress: string, pid: number): Promise<void> {
    if (this.config.cacheUserData) {
      const cacheKey = `position:${userAddress}:${pid}`;
      await this.cache.delete(cacheKey);
    }
  }
}

// Export singleton instance
export const farmIntegration = new FarmIntegration();