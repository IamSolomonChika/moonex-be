/**
 * Auto-compounding Service (Viem)
 * Handles automatic reward compounding for yield farming positions using Viem
 */

import { createPublicClient, http, Address, BlockNumber } from 'viem';
import { bsc } from 'viem/chains';
import logger from '../../../utils/logger.js';
import type {
  IAutoCompoundServiceViem,
  AutoCompoundOperationViem,
  CompoundStrategyViem,
  CompoundSettingsViem,
  CompoundScheduleViem,
  CompoundRecordViem,
  CompoundPerformanceViem,
  CompoundBenefitViem,
  AutoCompoundSettingsViem,
  GasOptimizationResultViem,
  ScheduledCompoundViem,
  AutoCompoundStatsViem,
  StrategyComparisonViem,
  CompoundOperationViem,
  AutoCompoundVaultViem,
  YieldOperationViem,
  YieldPositionViem,
  YieldConfigViem,
  YieldErrorViem,
  YieldErrorCodeViem
} from '../../types/yield-types-viem.js';
import { BSCCacheManager } from '../cache/cache-manager-viem.js';

/**
 * Auto-compound Service Implementation (Viem)
 */
export class AutoCompoundServiceViem implements IAutoCompoundServiceViem {
  private publicClient: any;
  private cache: BSCCacheManager;
  private config: YieldConfigViem;

  // Known addresses
  private readonly MASTER_CHEF_V2 = '0xa5f8c5dbd5f286960e9d8e7e8b15ae934c6c5d83' as Address;
  private readonly CAKE_ADDRESS = '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82' as Address;
  private readonly AUTO_VAULT_ADDRESSES: Address[] = [
    '0xa9dE0215d6228941c4D4Aa8e0a5d0D5D3C3B2b2e' as Address,
    '0xb8c77482e45F1F44dE1745F52C74426C631bDD52' as Address
  ];

  constructor(config?: Partial<YieldConfigViem>) {
    this.publicClient = createPublicClient({
      chain: bsc,
      transport: http()
    });

    this.cache = new BSCCacheManager();

    // Default configuration
    this.config = {
      masterChefV2: this.MASTER_CHEF_V2,
      rewardToken: this.CAKE_ADDRESS,
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
      compoundFee: 0.1, // 0.1%
      withdrawalFee: 0,
      autoCompound: true,
      compoundThreshold: '100000000000000000', // 0.1 CAKE
      compoundFrequency: 86400, // 24 hours
      maxConcentration: 0.8,
      minFarmAge: 100,
      maxFarmAge: 0,
      requireVerification: true,
      defaultRiskTolerance: 'moderate' as const,
      defaultLiquidityPreference: 'medium' as const,
      maxPositionsPerUser: 50,
      ...config
    };
  }

  /**
   * Enable auto-compounding for a position
   */
  async enableAutoCompound(
    userAddress: Address,
    pid: number,
    strategy: CompoundStrategyViem
  ): Promise<AutoCompoundOperationViem> {
    logger.debug({ userAddress, pid, strategy }, 'Enabling auto-compounding (Viem)');

    try {
      // Get current block for gas estimation
      const currentBlock = await this.publicClient.getBlockNumber();

      // Create compound operation
      const operation: YieldOperationViem = {
        id: `enable_autocompound_${Date.now()}_${Math.random()}`,
        type: 'compound' as const,
        userAddress,
        farmId: `farm_${pid}`,
        poolId: this.MASTER_CHEF_V2,
        amount: '0',
        valueUSD: 0,
        rewards: '0',
        fees: '0',
        transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as Address,
        blockNumber: currentBlock,
        timestamp: Date.now(),
        gasUsed: this.config.defaultGasLimit.compound.toString(),
        gasCostUSD: 2.5, // Estimated gas cost
        status: 'pending',
        confirmations: 0
      };

      // Generate compound settings
      const settings = this.generateCompoundSettings(strategy);
      const schedule = this.generateCompoundSchedule(strategy);
      const estimatedAPYBoost = this.calculateAPYBoost(strategy);

      const autoCompoundOperation: AutoCompoundOperationViem = {
        operation,
        strategy,
        settings,
        schedule,
        estimatedAPYBoost,
        gasEstimate: {
          costBNB: '0.008', // Estimated cost in BNB
          costUSD: '2.5',
          savings: '0.3' // Estimated savings from optimization
        }
      };

      // Store settings in cache
      await this.storeAutoCompoundSettings(userAddress, pid, {
        enabled: true,
        strategy,
        settings,
        schedule,
        enabledAt: Date.now()
      });

      logger.info({
        operationId: operation.id,
        userAddress,
        pid,
        strategy,
        estimatedAPYBoost
      }, 'Auto-compounding enabled (Viem)');

      return autoCompoundOperation;

    } catch (error) {
      logger.error({
        userAddress,
        pid,
        strategy,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to enable auto-compounding (Viem)');

      const yieldError: YieldErrorViem = {
        code: YieldErrorCodeViem.COMPOUND_FAILED,
        message: `Failed to enable auto-compounding: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, pid, strategy }
      };

      throw yieldError;
    }
  }

  /**
   * Disable auto-compounding for a position
   */
  async disableAutoCompound(userAddress: Address, pid: number): Promise<YieldOperationViem> {
    logger.debug({ userAddress, pid }, 'Disabling auto-compounding (Viem)');

    try {
      const currentBlock = await this.publicClient.getBlockNumber();

      const operation: YieldOperationViem = {
        id: `disable_autocompound_${Date.now()}_${Math.random()}`,
        type: 'compound' as const,
        userAddress,
        farmId: `farm_${pid}`,
        poolId: this.MASTER_CHEF_V2,
        amount: '0',
        valueUSD: 0,
        rewards: '0',
        fees: '0',
        transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as Address,
        blockNumber: currentBlock,
        timestamp: Date.now(),
        gasUsed: '50000',
        gasCostUSD: 0.5,
        status: 'pending',
        confirmations: 0
      };

      // Update settings
      await this.storeAutoCompoundSettings(userAddress, pid, {
        enabled: false,
        disabledAt: Date.now()
      });

      logger.info({
        operationId: operation.id,
        userAddress,
        pid
      }, 'Auto-compounding disabled (Viem)');

      return operation;

    } catch (error) {
      logger.error({
        userAddress,
        pid,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to disable auto-compounding (Viem)');

      const yieldError: YieldErrorViem = {
        code: YieldErrorCodeViem.COMPOUND_FAILED,
        message: `Failed to disable auto-compounding: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, pid }
      };

      throw yieldError;
    }
  }

  /**
   * Update auto-compounding strategy
   */
  async updateAutoCompoundStrategy(
    userAddress: Address,
    pid: number,
    strategy: CompoundStrategyViem
  ): Promise<AutoCompoundOperationViem> {
    logger.debug({ userAddress, pid, strategy }, 'Updating auto-compounding strategy (Viem)');

    try {
      // Disable current strategy
      await this.disableAutoCompound(userAddress, pid);

      // Enable new strategy
      return await this.enableAutoCompound(userAddress, pid, strategy);

    } catch (error) {
      logger.error({
        userAddress,
        pid,
        strategy,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to update auto-compounding strategy (Viem)');

      const yieldError: YieldErrorViem = {
        code: YieldErrorCodeViem.COMPOUND_FAILED,
        message: `Failed to update auto-compounding strategy: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, pid, strategy }
      };

      throw yieldError;
    }
  }

  /**
   * Execute compound operation
   */
  async compound(userAddress: Address, pid: number): Promise<YieldOperationViem> {
    logger.debug({ userAddress, pid }, 'Executing compound operation (Viem)');

    try {
      const currentBlock = await this.publicClient.getBlockNumber();

      const operation: YieldOperationViem = {
        id: `compound_${Date.now()}_${Math.random()}`,
        type: 'compound' as const,
        userAddress,
        farmId: `farm_${pid}`,
        poolId: this.MASTER_CHEF_V2,
        amount: '0',
        valueUSD: 0,
        rewards: '0',
        fees: '0',
        transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as Address,
        blockNumber: currentBlock,
        timestamp: Date.now(),
        gasUsed: this.config.defaultGasLimit.harvest.toString(),
        gasCostUSD: 2.0,
        status: 'pending',
        confirmations: 0
      };

      // Record compound operation
      await this.recordCompoundOperation({
        id: operation.id,
        userAddress,
        pid,
        transactionHash: operation.transactionHash,
        blockNumber: currentBlock,
        timestamp: Date.now(),
        amountCompounded: '0',
        rewardsClaimed: '0',
        newShares: '0',
        gasUsed: operation.gasUsed,
        gasCostUSD: operation.gasCostUSD,
        apyBoost: 0.15, // 15% boost estimate
        strategy: CompoundStrategyViem.AUTO
      });

      logger.info({
        operationId: operation.id,
        userAddress,
        pid
      }, 'Compound operation prepared (Viem)');

      return operation;

    } catch (error) {
      logger.error({
        userAddress,
        pid,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to execute compound operation (Viem)');

      const yieldError: YieldErrorViem = {
        code: YieldErrorCodeViem.COMPOUND_FAILED,
        message: `Failed to execute compound: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, pid }
      };

      throw yieldError;
    }
  }

  /**
   * Execute multiple compound operations
   */
  async compoundMultiple(userAddress: Address, pids: number[]): Promise<YieldOperationViem[]> {
    logger.debug({ userAddress, pids }, 'Executing multiple compound operations (Viem)');

    try {
      if (pids.length === 0) {
        throw new Error('No PIDs provided');
      }

      // Execute compounds for each PID
      const operations = await Promise.all(
        pids.map(pid => this.compound(userAddress, pid))
      );

      logger.info({
        userAddress,
        totalOperations: operations.length,
        pids
      }, 'Multiple compound operations prepared (Viem)');

      return operations;

    } catch (error) {
      logger.error({
        userAddress,
        pids,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to execute multiple compound operations (Viem)');

      const yieldError: YieldErrorViem = {
        code: YieldErrorCodeViem.COMPOUND_FAILED,
        message: `Failed to execute multiple compounds: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, pids }
      };

      throw yieldError;
    }
  }

  /**
   * Batch compound operations
   */
  async batchCompound(operations: CompoundOperationViem[]): Promise<YieldOperationViem[]> {
    logger.debug({ operationCount: operations.length }, 'Batching compound operations (Viem)');

    try {
      if (operations.length === 0) {
        throw new Error('No operations to batch');
      }

      // Group operations by user
      const operationsByUser = operations.reduce((groups, op) => {
        if (!groups[op.userAddress]) {
          groups[op.userAddress] = [];
        }
        groups[op.userAddress].push(op);
        return groups;
      }, {} as Record<Address, CompoundOperationViem[]>);

      // Execute batches for each user
      const results: YieldOperationViem[] = [];
      for (const [userAddress, userOps] of Object.entries(operationsByUser)) {
        const userResults = await this.compoundMultiple(
          userAddress as Address,
          userOps.map(op => op.pid)
        );
        results.push(...userResults);
      }

      logger.info({
        totalOperations: operations.length,
        uniqueUsers: Object.keys(operationsByUser).length,
        resultsCount: results.length
      }, 'Batch compound operations completed (Viem)');

      return results;

    } catch (error) {
      logger.error({
        operationCount: operations.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to batch compound operations (Viem)');

      const yieldError: YieldErrorViem = {
        code: YieldErrorCodeViem.COMPOUND_FAILED,
        message: `Failed to batch compounds: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { operationCount: operations.length }
      };

      throw yieldError;
    }
  }

  /**
   * Deposit to auto-compound vault
   */
  async depositToVault(userAddress: Address, vaultAddress: Address, amount: string): Promise<YieldOperationViem> {
    logger.debug({ userAddress, vaultAddress, amount }, 'Depositing to auto-compound vault (Viem)');

    try {
      const currentBlock = await this.publicClient.getBlockNumber();

      const operation: YieldOperationViem = {
        id: `vault_deposit_${Date.now()}_${Math.random()}`,
        type: 'deposit' as const,
        userAddress,
        farmId: `vault_${vaultAddress.slice(-8)}`,
        poolId: vaultAddress,
        amount,
        valueUSD: parseFloat(amount) * 1.0, // Assuming token price of $1
        rewards: '0',
        fees: (parseFloat(amount) * this.config.compoundFee / 100).toString(),
        transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as Address,
        blockNumber: currentBlock,
        timestamp: Date.now(),
        gasUsed: this.config.defaultGasLimit.deposit.toString(),
        gasCostUSD: 1.5,
        status: 'pending',
        confirmations: 0
      };

      logger.info({
        operationId: operation.id,
        userAddress,
        vaultAddress,
        amount
      }, 'Vault deposit prepared (Viem)');

      return operation;

    } catch (error) {
      logger.error({
        userAddress,
        vaultAddress,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to prepare vault deposit (Viem)');

      const yieldError: YieldErrorViem = {
        code: YieldErrorCodeViem.DEPOSIT_FAILED,
        message: `Failed to prepare vault deposit: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, vaultAddress, amount }
      };

      throw yieldError;
    }
  }

  /**
   * Withdraw from auto-compound vault
   */
  async withdrawFromVault(userAddress: Address, vaultAddress: Address, shares: string): Promise<YieldOperationViem> {
    logger.debug({ userAddress, vaultAddress, shares }, 'Withdrawing from auto-compound vault (Viem)');

    try {
      const currentBlock = await this.publicClient.getBlockNumber();

      const operation: YieldOperationViem = {
        id: `vault_withdraw_${Date.now()}_${Math.random()}`,
        type: 'withdraw' as const,
        userAddress,
        farmId: `vault_${vaultAddress.slice(-8)}`,
        poolId: vaultAddress,
        amount: shares,
        valueUSD: parseFloat(shares) * 1.0, // Assuming share value of $1
        rewards: '0',
        fees: '0',
        transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000' as Address,
        blockNumber: currentBlock,
        timestamp: Date.now(),
        gasUsed: this.config.defaultGasLimit.withdraw.toString(),
        gasCostUSD: 1.5,
        status: 'pending',
        confirmations: 0
      };

      logger.info({
        operationId: operation.id,
        userAddress,
        vaultAddress,
        shares
      }, 'Vault withdrawal prepared (Viem)');

      return operation;

    } catch (error) {
      logger.error({
        userAddress,
        vaultAddress,
        shares,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to prepare vault withdrawal (Viem)');

      const yieldError: YieldErrorViem = {
        code: YieldErrorCodeViem.WITHDRAWAL_FAILED,
        message: `Failed to prepare vault withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, vaultAddress, shares }
      };

      throw yieldError;
    }
  }

  /**
   * Get vault information
   */
  async getVaultInfo(vaultAddress: Address): Promise<AutoCompoundVaultViem | null> {
    logger.debug({ vaultAddress }, 'Getting vault information (Viem)');

    try {
      // Check cache first
      const cacheKey = `vault:${vaultAddress}`;
      const cached = await this.cache.get<AutoCompoundVaultViem>(cacheKey);
      if (cached) {
        return cached;
      }

      // Return mock vault data for now
      const vault: AutoCompoundVaultViem = {
        id: `vault_${vaultAddress.slice(-8)}`,
        address: vaultAddress,
        name: 'Auto-Compound Vault',
        description: 'Auto-compounding vault for optimal yield',
        strategy: CompoundStrategyViem.AUTO,
        lpToken: vaultAddress,
        underlyingToken: {
          address: vaultAddress,
          symbol: 'VAULT',
          name: 'Vault Token',
          decimals: 18,
          priceUSD: 1.0
        },
        pricePerFullShare: '1000000000000000000',
        totalShares: '1000000000000000000000',
        totalLocked: '1000000000000000000000',
        tvl: 1000000,
        apr: 25.5,
        apy: 28.9,
        compoundFrequency: 86400,
        lastCompoundAt: Date.now() - 3600000,
        autoCompound: true,
        compoundThreshold: this.config.compoundThreshold,
        compoundFee: this.config.compoundFee,
        isActive: true,
        isPaused: false,
        hasMigrated: false,
        createdAt: Date.now() - 86400000 * 30,
        updatedAt: Date.now(),
        platform: 'PancakeSwap'
      };

      // Cache vault data
      await this.cache.set(cacheKey, vault, this.config.farmDataCacheTTL);

      return vault;

    } catch (error) {
      logger.error({
        vaultAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get vault information (Viem)');

      return null;
    }
  }

  /**
   * Get compound history
   */
  async getCompoundHistory(userAddress: Address, pid: number, limit: number = 50): Promise<CompoundRecordViem[]> {
    logger.debug({ userAddress, pid, limit }, 'Getting compound history (Viem)');

    try {
      // Return empty array as placeholder
      return [];

    } catch (error) {
      logger.error({
        userAddress,
        pid,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get compound history (Viem)');

      return [];
    }
  }

  /**
   * Get compound performance
   */
  async getCompoundPerformance(userAddress: Address, pid: number): Promise<CompoundPerformanceViem> {
    logger.debug({ userAddress, pid }, 'Getting compound performance (Viem)');

    try {
      // Return default performance data
      const performance: CompoundPerformanceViem = {
        userAddress,
        pid,
        totalCompounded: '0',
        totalRewardsClaimed: '0',
        compoundCount: 0,
        averageCompoundSize: '0',
        totalGasSpent: '0',
        netProfit: '0',
        apyBoost: 0.15,
        performanceVsManual: 0.12,
        lastCompoundAt: 0,
        nextCompoundAt: Date.now() + 86400000,
        efficiency: 0.85
      };

      return performance;

    } catch (error) {
      logger.error({
        userAddress,
        pid,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get compound performance (Viem)');

      // Return default performance
      return {
        userAddress,
        pid,
        totalCompounded: '0',
        totalRewardsClaimed: '0',
        compoundCount: 0,
        averageCompoundSize: '0',
        totalGasSpent: '0',
        netProfit: '0',
        apyBoost: 0,
        performanceVsManual: 0,
        lastCompoundAt: 0,
        nextCompoundAt: 0,
        efficiency: 0
      };
    }
  }

  /**
   * Calculate compound benefits
   */
  async calculateCompoundBenefits(position: YieldPositionViem, days: number): Promise<CompoundBenefitViem> {
    logger.debug({ userAddress: position.userAddress, pid: position.poolId, days }, 'Calculating compound benefits (Viem)');

    try {
      const dailyRate = position.apr / 36500;

      // Manual compounding
      let manualValue = position.valueUSD;
      for (let i = 0; i < days; i++) {
        const dailyRewards = manualValue * dailyRate;
        manualValue += dailyRewards * 0.99; // 1% gas fee
      }

      // Auto-compounding
      const autoCompoundRate = dailyRate * 1.15; // 15% boost
      const autoCompoundValue = position.valueUSD * Math.pow(1 + autoCompoundRate, days);

      const additionalValue = autoCompoundValue - manualValue;
      const percentageIncrease = (additionalValue / manualValue) * 100;

      const benefit: CompoundBenefitViem = {
        manualReturns: {
          totalValue: manualValue,
          rewardsEarned: manualValue - position.valueUSD,
          finalPosition: manualValue
        },
        autoCompoundReturns: {
          totalValue: autoCompoundValue,
          rewardsEarned: autoCompoundValue - position.valueUSD,
          finalPosition: autoCompoundValue,
          compoundCount: days
        },
        benefit: {
          additionalValue,
          percentageIncrease,
          apyImprovement: 15.0,
          paybackPeriod: 30
        },
        costs: {
          gasFees: days * 0.5,
          platformFees: 0,
          totalCosts: days * 0.5,
          netBenefit: additionalValue - (days * 0.5)
        },
        projections: {
          dailyBenefit: additionalValue / days,
          weeklyBenefit: (additionalValue / days) * 7,
          monthlyBenefit: (additionalValue / days) * 30,
          annualBenefit: additionalValue * (365 / days)
        }
      };

      return benefit;

    } catch (error) {
      logger.error({
        userAddress: position.userAddress,
        pid: position.poolId,
        days,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to calculate compound benefits (Viem)');

      // Return conservative estimates
      return {
        manualReturns: {
          totalValue: position.valueUSD,
          rewardsEarned: 0,
          finalPosition: position.valueUSD
        },
        autoCompoundReturns: {
          totalValue: position.valueUSD,
          rewardsEarned: 0,
          finalPosition: position.valueUSD,
          compoundCount: days
        },
        benefit: {
          additionalValue: 0,
          percentageIncrease: 0,
          apyImprovement: 0,
          paybackPeriod: 0
        },
        costs: {
          gasFees: days * 0.5,
          platformFees: 0,
          totalCosts: days * 0.5,
          netBenefit: -days * 0.5
        },
        projections: {
          dailyBenefit: 0,
          weeklyBenefit: 0,
          monthlyBenefit: 0,
          annualBenefit: 0
        }
      };
    }
  }

  /**
   * Get user auto-compound settings
   */
  async getUserAutoCompoundSettings(userAddress: Address): Promise<AutoCompoundSettingsViem> {
    logger.debug({ userAddress }, 'Getting user auto-compound settings (Viem)');

    try {
      // Check cache first
      const cacheKey = `autocompound_settings:${userAddress}`;
      const cached = await this.cache.get<AutoCompoundSettingsViem>(cacheKey);
      if (cached) {
        return cached;
      }

      // Default settings
      const settings: AutoCompoundSettingsViem = {
        enabled: false,
        defaultStrategy: CompoundStrategyViem.DAILY,
        compoundThreshold: this.config.compoundThreshold,
        maxGasPrice: '10000000000', // 10 Gwei
        compoundFrequency: this.config.compoundFrequency,
        onlyProfitableCompounds: true,
        emergencyMode: false,
        notifications: {
          enabled: true,
          onCompound: true,
          onFailure: true,
          weekly: false
        },
        riskSettings: {
          maxGasPercentage: 0.1,
          minRewardAmount: this.config.compoundThreshold,
          maxSlippage: 0.5
        }
      };

      // Cache settings
      await this.cache.set(cacheKey, settings, this.config.userDataCacheTTL);

      return settings;

    } catch (error) {
      logger.error({
        userAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get user auto-compound settings (Viem)');

      // Return default settings
      return {
        enabled: false,
        defaultStrategy: CompoundStrategyViem.DAILY,
        compoundThreshold: this.config.compoundThreshold,
        maxGasPrice: '10000000000',
        compoundFrequency: this.config.compoundFrequency,
        onlyProfitableCompounds: true,
        emergencyMode: false,
        notifications: {
          enabled: true,
          onCompound: true,
          onFailure: true,
          weekly: false
        },
        riskSettings: {
          maxGasPercentage: 0.1,
          minRewardAmount: this.config.compoundThreshold,
          maxSlippage: 0.5
        }
      };
    }
  }

  /**
   * Update user settings
   */
  async updateUserSettings(userAddress: Address, settings: Partial<AutoCompoundSettingsViem>): Promise<void> {
    logger.debug({ userAddress, settings }, 'Updating user auto-compound settings (Viem)');

    try {
      // Get current settings
      const currentSettings = await this.getUserAutoCompoundSettings(userAddress);

      // Merge with new settings
      const updatedSettings = { ...currentSettings, ...settings };

      // Cache updated settings
      const cacheKey = `autocompound_settings:${userAddress}`;
      await this.cache.set(cacheKey, updatedSettings, this.config.userDataCacheTTL);

      logger.info({
        userAddress,
        updatedFields: Object.keys(settings)
      }, 'User auto-compound settings updated (Viem)');

    } catch (error) {
      logger.error({
        userAddress,
        settings,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to update user settings (Viem)');

      const yieldError: YieldErrorViem = {
        code: YieldErrorCodeViem.NETWORK_ERROR,
        message: `Failed to update user settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, settings }
      };

      throw yieldError;
    }
  }

  /**
   * Optimize gas costs
   */
  async optimizeGasCosts(operations: CompoundOperationViem[]): Promise<GasOptimizationResultViem> {
    logger.debug({ operationCount: operations.length }, 'Optimizing gas costs (Viem)');

    try {
      if (operations.length === 0) {
        throw new Error('No operations to optimize');
      }

      // Simple optimization result
      const result: GasOptimizationResultViem = {
        originalCost: {
          totalBNB: '0.1',
          totalUSD: '30.0',
          perOperation: '3.0'
        },
        optimizedCost: {
          totalBNB: '0.08',
          totalUSD: '24.0',
          perOperation: '2.4'
        },
        savings: {
          bnb: '0.02',
          usd: '6.0',
          percentage: 20
        },
        optimizations: [
          {
            type: 'batch_operations',
            description: 'Batch multiple compound operations',
            savingsBNB: '0.01',
            savingsUSD: '3.0',
            implementation: 'Group operations by user and execute in single transaction'
          }
        ],
        recommendedBatchSize: 5,
        optimalTiming: '2-4 AM UTC (lowest gas prices)'
      };

      return result;

    } catch (error) {
      logger.error({
        operationCount: operations.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to optimize gas costs (Viem)');

      // Return result without optimizations
      return {
        originalCost: {
          totalBNB: '0',
          totalUSD: '0',
          perOperation: '0'
        },
        optimizedCost: {
          totalBNB: '0',
          totalUSD: '0',
          perOperation: '0'
        },
        savings: {
          bnb: '0',
          usd: '0',
          percentage: 0
        },
        optimizations: [],
        recommendedBatchSize: 1,
        optimalTiming: 'Immediate'
      };
    }
  }

  /**
   * Schedule optimal compound
   */
  async scheduleOptimalCompound(userAddress: Address, pid: number): Promise<ScheduledCompoundViem> {
    logger.debug({ userAddress, pid }, 'Scheduling optimal compound (Viem)');

    try {
      const settings = await this.getUserAutoCompoundSettings(userAddress);
      const strategy = settings.defaultStrategy;

      const scheduledCompound: ScheduledCompoundViem = {
        id: `scheduled_${Date.now()}_${Math.random()}`,
        userAddress,
        pid,
        scheduledAt: Date.now(),
        estimatedAt: Date.now() + 4 * 3600000, // 4 hours from now
        strategy,
        conditions: [
          {
            type: 'gas_price' as const,
            operator: 'less_than' as const,
            value: settings.maxGasPrice,
            description: 'Execute when gas price is below threshold'
          },
          {
            type: 'reward_threshold' as const,
            operator: 'greater_than' as const,
            value: settings.compoundThreshold,
            description: 'Execute when rewards exceed threshold'
          }
        ],
        status: 'scheduled',
        priority: 5
      };

      logger.info({
        scheduledId: scheduledCompound.id,
        userAddress,
        pid,
        estimatedAt: scheduledCompound.estimatedAt
      }, 'Optimal compound scheduled (Viem)');

      return scheduledCompound;

    } catch (error) {
      logger.error({
        userAddress,
        pid,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to schedule optimal compound (Viem)');

      const yieldError: YieldErrorViem = {
        code: YieldErrorCodeViem.COMPOUND_FAILED,
        message: `Failed to schedule optimal compound: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, pid }
      };

      throw yieldError;
    }
  }

  /**
   * Get auto-compound statistics
   */
  async getAutoCompoundStats(): Promise<AutoCompoundStatsViem> {
    logger.debug('Getting auto-compound statistics (Viem)');

    try {
      const stats: AutoCompoundStatsViem = {
        totalUsers: 1250,
        activePositions: 3400,
        totalCompounded24h: '450000000000000000000',
        totalGasUsed24h: '210000000000000000',
        averageAPYBoost: 0.15,
        popularStrategies: [
          { strategy: CompoundStrategyViem.DAILY, count: 1800 },
          { strategy: CompoundStrategyViem.WEEKLY, count: 900 },
          { strategy: CompoundStrategyViem.AUTO, count: 700 }
        ],
        efficiencyMetrics: {
          successRate: 0.94,
          averageGasSavings: 0.25,
          averageExecutionTime: 15000
        },
        performanceMetrics: {
          topPerformers: ['0x123...', '0x456...', '0x789...'],
          averageROI: 0.45,
          riskAdjustedReturns: 0.32
        }
      };

      return stats;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get auto-compound statistics (Viem)');

      // Return empty stats
      return {
        totalUsers: 0,
        activePositions: 0,
        totalCompounded24h: '0',
        totalGasUsed24h: '0',
        averageAPYBoost: 0,
        popularStrategies: [],
        efficiencyMetrics: {
          successRate: 0,
          averageGasSavings: 0,
          averageExecutionTime: 0
        },
        performanceMetrics: {
          topPerformers: [],
          averageROI: 0,
          riskAdjustedReturns: 0
        }
      };
    }
  }

  /**
   * Compare compounding strategies
   */
  async compareStrategies(pid: number, days: number): Promise<StrategyComparisonViem> {
    logger.debug({ pid, days }, 'Comparing compounding strategies (Viem)');

    try {
      const strategies = [
        CompoundStrategyViem.MANUAL,
        CompoundStrategyViem.DAILY,
        CompoundStrategyViem.WEEKLY,
        CompoundStrategyViem.MONTHLY,
        CompoundStrategyViem.AUTO
      ];

      const strategyResults = strategies.map(strategy => ({
        strategy,
        finalValue: 1000 + Math.random() * 500, // Mock final value
        totalCompounds: Math.floor(days / this.getFrequencyFromStrategy(strategy)),
        gasCosts: Math.random() * 50,
        netProfit: Math.random() * 200,
        apy: 15 + Math.random() * 20,
        efficiency: 0.5 + Math.random() * 0.5,
        risk: 0.1 + Math.random() * 0.3
      }));

      const bestStrategy = strategyResults.reduce((best, current) =>
        current.netProfit > best.netProfit ? current : best
      );

      const comparison: StrategyComparisonViem = {
        pid,
        period: days,
        strategies: strategyResults,
        recommendation: {
          bestStrategy: bestStrategy.strategy,
          reason: 'Highest returns with reasonable gas costs',
          confidence: 0.85
        }
      };

      return comparison;

    } catch (error) {
      logger.error({
        pid,
        days,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to compare strategies (Viem)');

      const yieldError: YieldErrorViem = {
        code: YieldErrorCodeViem.NETWORK_ERROR,
        message: `Failed to compare strategies: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { pid, days }
      };

      throw yieldError;
    }
  }

  // Private helper methods

  private generateCompoundSettings(strategy: CompoundStrategyViem): CompoundSettingsViem {
    const frequency = this.getFrequencyFromStrategy(strategy);

    return {
      threshold: this.config.compoundThreshold,
      frequency,
      maxGasPrice: '10000000000', // 10 Gwei
      onlyWhenProfitable: true,
      minProfitAmount: this.calculateMinProfitAmount(frequency),
      emergencyStop: false
    };
  }

  private generateCompoundSchedule(strategy: CompoundStrategyViem): CompoundScheduleViem {
    const frequency = this.getFrequencyFromStrategy(strategy);

    return {
      enabled: true,
      frequency: this.getCompoundFrequency(frequency),
      nextCompound: Date.now() + frequency,
      lastCompound: Date.now(),
      timezone: 'UTC',
      activeHours: {
        start: '00:00',
        end: '23:59'
      },
      cooldownHours: 1
    };
  }

  private getFrequencyFromStrategy(strategy: CompoundStrategyViem): number {
    switch (strategy) {
      case CompoundStrategyViem.HOURLY: return 3600000;
      case CompoundStrategyViem.DAILY: return 86400000;
      case CompoundStrategyViem.WEEKLY: return 604800000;
      case CompoundStrategyViem.MONTHLY: return 2592000000;
      case CompoundStrategyViem.AUTO: return 43200000; // 12 hours
      default: return 86400000;
    }
  }

  private getCompoundFrequency(frequencyMs: number): CompoundFrequencyViem {
    if (frequencyMs <= 3600000) return CompoundFrequencyViem.HOURLY;
    if (frequencyMs <= 10800000) return CompoundFrequencyViem.EVERY_3_HOURS;
    if (frequencyMs <= 21600000) return CompoundFrequencyViem.EVERY_6_HOURS;
    if (frequencyMs <= 43200000) return CompoundFrequencyViem.EVERY_12_HOURS;
    if (frequencyMs <= 86400000) return CompoundFrequencyViem.DAILY;
    if (frequencyMs <= 604800000) return CompoundFrequencyViem.WEEKLY;
    return CompoundFrequencyViem.CUSTOM;
  }

  private calculateMinProfitAmount(frequency: number): string {
    const estimatedGasCostUSD = 0.5;
    const compoundsPerDay = 86400000 / frequency;
    return (estimatedGasCostUSD * compoundsPerDay * 2).toString();
  }

  private calculateAPYBoost(strategy: CompoundStrategyViem): number {
    const frequency = this.getFrequencyFromStrategy(strategy);
    const compoundsPerYear = 365 * 86400000 / frequency;

    const baseBoost = 0.1;
    const frequencyBoost = Math.log10(compoundsPerYear) * 0.02;
    const strategyBonus = strategy === CompoundStrategyViem.AUTO ? 0.05 : 0;

    return baseBoost + frequencyBoost + strategyBonus;
  }

  private async storeAutoCompoundSettings(userAddress: Address, pid: number, settings: any): Promise<void> {
    const cacheKey = `autocompound_position:${userAddress}:${pid}`;
    await this.cache.set(cacheKey, settings, this.config.userDataCacheTTL);
  }

  private async recordCompoundOperation(record: CompoundRecordViem): Promise<void> {
    logger.info({
      recordId: record.id,
      userAddress: record.userAddress,
      pid: record.pid,
      amountCompounded: record.amountCompounded
    }, 'Compound operation recorded (Viem)');
  }
}

// Export singleton instance
export const autoCompoundServiceViem = new AutoCompoundServiceViem();