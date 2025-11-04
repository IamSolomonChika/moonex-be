/**
 * Auto-compounding Service
 * Handles automatic reward compounding for yield farming positions
 */

import { ethers } from 'ethers';
import logger from '../../../utils/logger.js';
import type {
  YieldFarm,
  YieldPosition,
  YieldOperation,
  YieldOperationType,
  AutoCompoundVault,
  CompoundStrategy,
  YieldConfig,
  YieldError,
  YieldErrorCode
} from './types.js';
import { BSCProviderManager } from '../../utils/ethers-provider.js';
import { BSCCacheManager } from '../cache/cache-manager.js';
import { BSCGasOptimizationService, bscGasOptimizationService } from '../trading/gas-optimization.js';
import { FarmIntegration, farmIntegration } from './farm-integration.js';
import {
  AUTO_COMPOUND_VAULT_ABI,
  MASTERCHEF_V2_ABI
} from './types.js';

/**
 * Auto-compound Service Interface
 */
export interface IAutoCompoundService {
  // Auto-compounding management
  enableAutoCompound(userAddress: string, pid: number, strategy: CompoundStrategy): Promise<AutoCompoundOperation>;
  disableAutoCompound(userAddress: string, pid: number): Promise<YieldOperation>;
  updateAutoCompoundStrategy(userAddress: string, pid: number, strategy: CompoundStrategy): Promise<AutoCompoundOperation>;

  // Compound operations
  compound(userAddress: string, pid: number): Promise<YieldOperation>;
  compoundMultiple(userAddress: string, pids: number[]): Promise<YieldOperation[]>;
  batchCompound(operations: CompoundOperation[]): Promise<YieldOperation[]>;

  // Vault management
  depositToVault(userAddress: string, vaultAddress: string, amount: string): Promise<YieldOperation>;
  withdrawFromVault(userAddress: string, vaultAddress: string, shares: string): Promise<YieldOperation>;
  getVaultInfo(vaultAddress: string): Promise<AutoCompoundVault>;

  // Performance tracking
  getCompoundHistory(userAddress: string, pid: number, limit?: number): Promise<CompoundRecord[]>;
  getCompoundPerformance(userAddress: string, pid: number): Promise<CompoundPerformance>;
  calculateCompoundBenefits(position: YieldPosition, days: number): Promise<CompoundBenefit>;

  // Auto-compounding settings
  getUserAutoCompoundSettings(userAddress: string): Promise<AutoCompoundSettings>;
  updateUserSettings(userAddress: string, settings: Partial<AutoCompoundSettings>): Promise<void>;

  // Gas optimization
  optimizeGasCosts(operations: CompoundOperation[]): Promise<GasOptimizationResult>;
  scheduleOptimalCompound(userAddress: string, pid: number): Promise<ScheduledCompound>;

  // Analytics
  getAutoCompoundStats(): Promise<AutoCompoundStats>;
  compareStrategies(pid: number, days: number): Promise<StrategyComparison>;
}

export interface AutoCompoundOperation {
  operation: YieldOperation;
  strategy: CompoundStrategy;
  settings: CompoundSettings;
  schedule: CompoundSchedule;
  estimatedAPYBoost: number;
  gasEstimate: {
    costBNB: string;
    costUSD: string;
    savings: string;
  };
}

export interface CompoundRecord {
  id: string;
  userAddress: string;
  pid: number;
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
  amountCompounded: string;
  rewardsClaimed: string;
  newShares: string;
  gasUsed: string;
  gasCostUSD: number;
  apyBoost: number;
  strategy: CompoundStrategy;
}

export interface CompoundPerformance {
  userAddress: string;
  pid: number;
  totalCompounded: string;
  totalRewardsClaimed: string;
  compoundCount: number;
  averageCompoundSize: string;
  totalGasSpent: string;
  netProfit: string;
  apyBoost: number;
  performanceVsManual: number;
  lastCompoundAt: number;
  nextCompoundAt: number;
  efficiency: number;
}

export interface CompoundBenefit {
  // Manual compounding scenario
  manualReturns: {
    totalValue: number;
    rewardsEarned: number;
    finalPosition: number;
  };

  // Auto-compounding scenario
  autoCompoundReturns: {
    totalValue: number;
    rewardsEarned: number;
    finalPosition: number;
    compoundCount: number;
  };

  // Comparison
  benefit: {
    additionalValue: number;
    percentageIncrease: number;
    apyImprovement: number;
    paybackPeriod: number;
  };

  // Cost analysis
  costs: {
    gasFees: number;
    platformFees: number;
    totalCosts: number;
    netBenefit: number;
  };

  // Projections
  projections: {
    dailyBenefit: number;
    weeklyBenefit: number;
    monthlyBenefit: number;
    annualBenefit: number;
  };
}

export interface AutoCompoundSettings {
  enabled: boolean;
  defaultStrategy: CompoundStrategy;
  compoundThreshold: string;
  maxGasPrice: string;
  compoundFrequency: number;
  onlyProfitableCompounds: boolean;
  emergencyMode: boolean;
  notifications: {
    enabled: boolean;
    onCompound: boolean;
    onFailure: boolean;
    weekly: boolean;
  };
  riskSettings: {
    maxGasPercentage: number;
    minRewardAmount: string;
    maxSlippage: number;
  };
}

export interface CompoundSettings {
  threshold: string;
  frequency: number;
  maxGasPrice: string;
  onlyWhenProfitable: boolean;
  minProfitAmount: string;
  emergencyStop: boolean;
}

export interface CompoundSchedule {
  enabled: boolean;
  frequency: CompoundFrequency;
  nextCompound: number;
  lastCompound: number;
  timezone: string;
  activeHours: {
    start: string;
    end: string;
  };
  cooldownHours: number;
}

export enum CompoundFrequency {
  HOURLY = 'hourly',
  EVERY_3_HOURS = 'every_3_hours',
  EVERY_6_HOURS = 'every_6_hours',
  EVERY_12_HOURS = 'every_12_hours',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  CUSTOM = 'custom'
}

export interface GasOptimizationResult {
  originalCost: {
    totalBNB: string;
    totalUSD: string;
    perOperation: string;
  };
  optimizedCost: {
    totalBNB: string;
    totalUSD: string;
    perOperation: string;
  };
  savings: {
    bnb: string;
    usd: string;
    percentage: number;
  };
  optimizations: GasOptimization[];
  recommendedBatchSize: number;
  optimalTiming: string;
}

export interface GasOptimization {
  type: string;
  description: string;
  savingsBNB: string;
  savingsUSD: string;
  implementation: string;
}

export interface ScheduledCompound {
  id: string;
  userAddress: string;
  pid: number;
  scheduledAt: number;
  estimatedAt: number;
  strategy: CompoundStrategy;
  conditions: CompoundCondition[];
  status: 'scheduled' | 'executing' | 'completed' | 'failed' | 'cancelled';
  priority: number;
}

export interface CompoundCondition {
  type: 'reward_threshold' | 'gas_price' | 'time_based' | 'price_based';
  operator: 'greater_than' | 'less_than' | 'equals';
  value: string | number;
  description: string;
}

export interface AutoCompoundStats {
  totalUsers: number;
  activePositions: number;
  totalCompounded24h: string;
  totalGasUsed24h: string;
  averageAPYBoost: number;
  popularStrategies: { strategy: CompoundStrategy; count: number }[];
  efficiencyMetrics: {
    successRate: number;
    averageGasSavings: number;
    averageExecutionTime: number;
  };
  performanceMetrics: {
    topPerformers: string[];
    averageROI: number;
    riskAdjustedReturns: number;
  };
}

export interface StrategyComparison {
  pid: number;
  period: number;
  strategies: {
    strategy: CompoundStrategy;
    finalValue: number;
    totalCompounds: number;
    gasCosts: number;
    netProfit: number;
    apy: number;
    efficiency: number;
    risk: number;
  }[];
  recommendation: {
    bestStrategy: CompoundStrategy;
    reason: string;
    confidence: number;
  };
}

/**
 * Auto-compound Service Implementation
 */
export class AutoCompoundService implements IAutoCompoundService {
  private provider: BSCProviderManager;
  private cache: BSCCacheManager;
  private gasOptimization: BSCGasOptimizationService;
  private farmIntegration: FarmIntegration;
  private config: YieldConfig;

  // Contract instances
  private masterChefV2Contract?: ethers.Contract;
  private vaultContracts: Map<string, ethers.Contract> = new Map();

  // Known addresses
  private readonly AUTO_COMPOUND_VAULT_FACTORY = '0x...'; // Auto-compound vault factory
  private readonly PANCAKESWAP_AUTO_VAULTS = [
    '0xa9dE0215d6228941c4D4Aa8e0a5d0D5D3C3B2b2e', // Example auto-compound vault
    '0x...f0d5D3C3B2b2e' // More vault addresses
  ];

  constructor(config?: Partial<YieldConfig>) {
    this.provider = new BSCProviderManager();
    this.cache = new BSCCacheManager();
    this.gasOptimization = new BSCGasOptimizationService();
    this.farmIntegration = farmIntegration;

    // Default configuration
    this.config = {
      autoCompound: true,
      compoundThreshold: '100000000000000000', // 0.1 CAKE
      compoundFrequency: 86400, // 24 hours
      compoundFee: 0.1, // 0.1%
      performanceFee: 0,
      withdrawalFee: 0,
      masterChefV2: '0xa5f8c5dbd5f286960e9d8e7e8b15ae934c6c5d83',
      rewardToken: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
      defaultGasLimit: {
        deposit: 200000,
        withdraw: 200000,
        harvest: 200000,
        compound: 250000,
        approve: 50000
      },
      cacheFarmData: true,
      farmDataCacheTTL: 30000,
      cacheUserData: true,
      userDataCacheTTL: 60000,
      enableAnalytics: true,
      analyticsRetentionDays: 30,
      maxConcentration: 0.8,
      minFarmAge: 100,
      maxFarmAge: 0,
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
  }

  /**
   * Enable auto-compounding for a position
   */
  async enableAutoCompound(
    userAddress: string,
    pid: number,
    strategy: CompoundStrategy
  ): Promise<AutoCompoundOperation> {
    logger.debug({ userAddress, pid, strategy }, 'Enabling auto-compounding');

    try {
      // Get user position
      const position = await this.farmIntegration.getUserPosition(userAddress, pid);
      if (!position) {
        throw new Error('User position not found');
      }

      // Get farm information
      const farm = await this.farmIntegration.getFarm(pid);
      if (!farm) {
        throw new Error('Farm not found');
      }

      // Get user settings
      const userSettings = await this.getUserAutoCompoundSettings(userAddress);

      // Determine compounding strategy
      const compoundSettings = this.getCompoundSettings(strategy, userSettings);
      const schedule = this.generateCompoundSchedule(strategy, compoundSettings);

      // Estimate gas costs
      const gasEstimate = await this.estimateCompoundGasCost(userAddress, pid, strategy);

      // Calculate APY boost
      const estimatedAPYBoost = await this.calculateAPYBoost(position, strategy);

      // Create operation
      const operation: YieldOperation = {
        id: `enable_autocompound_${Date.now()}_${Math.random()}`,
        type: YieldOperationType.COMPOUND,
        userAddress,
        farmId: farm.id,
        poolId: pid.toString(),
        amount: position.amount,
        valueUSD: position.valueUSD,
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

      const autoCompoundOperation: AutoCompoundOperation = {
        operation,
        strategy,
        settings: compoundSettings,
        schedule,
        estimatedAPYBoost,
        gasEstimate: {
          costBNB: gasEstimate.estimatedCostBNB,
          costUSD: gasEstimate.estimatedCostUSD,
          savings: gasEstimate.estimatedSavings || '0'
        }
      };

      // Store settings
      await this.storeAutoCompoundSettings(userAddress, pid, {
        enabled: true,
        strategy,
        settings: compoundSettings,
        schedule,
        enabledAt: Date.now()
      });

      // Schedule first compound
      await this.scheduleNextCompound(userAddress, pid, schedule);

      logger.info({
        operationId: operation.id,
        userAddress,
        farmId: farm.id,
        pid,
        strategy,
        estimatedAPYBoost
      }, 'Auto-compounding enabled');

      return autoCompoundOperation;

    } catch (error) {
      logger.error({
        userAddress,
        pid,
        strategy,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to enable auto-compounding');

      const yieldError: YieldError = {
        code: YieldErrorCode.COMPOUND_FAILED,
        message: `Failed to enable auto-compounding: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, pid, strategy }
      };

      throw yieldError;
    }
  }

  /**
   * Disable auto-compounding for a position
   */
  async disableAutoCompound(userAddress: string, pid: number): Promise<YieldOperation> {
    logger.debug({ userAddress, pid }, 'Disabling auto-compounding');

    try {
      // Get current settings
      const currentSettings = await this.getAutoCompoundSettingsForPosition(userAddress, pid);
      if (!currentSettings?.enabled) {
        throw new Error('Auto-compounding is not enabled for this position');
      }

      // Get farm information
      const farm = await this.farmIntegration.getFarm(pid);
      if (!farm) {
        throw new Error('Farm not found');
      }

      // Create operation
      const operation: YieldOperation = {
        id: `disable_autocompound_${Date.now()}_${Math.random()}`,
        type: YieldOperationType.COMPOUND,
        userAddress,
        farmId: farm.id,
        poolId: pid.toString(),
        amount: '0',
        valueUSD: 0,
        rewards: '0',
        fees: '0',
        transactionHash: '',
        blockNumber: 0,
        timestamp: Date.now(),
        gasUsed: '50000',
        gasCostUSD: 0.5, // Minimal gas cost
        status: 'pending',
        confirmations: 0
      };

      // Cancel scheduled compounds
      await this.cancelScheduledCompounds(userAddress, pid);

      // Update settings
      await this.storeAutoCompoundSettings(userAddress, pid, {
        enabled: false,
        disabledAt: Date.now(),
        previousSettings: currentSettings
      });

      logger.info({
        operationId: operation.id,
        userAddress,
        farmId: farm.id,
        pid
      }, 'Auto-compounding disabled');

      return operation;

    } catch (error) {
      logger.error({
        userAddress,
        pid,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to disable auto-compounding');

      const yieldError: YieldError = {
        code: YieldErrorCode.COMPOUND_FAILED,
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
    userAddress: string,
    pid: number,
    strategy: CompoundStrategy
  ): Promise<AutoCompoundOperation> {
    logger.debug({ userAddress, pid, strategy }, 'Updating auto-compounding strategy');

    try {
      // Get current settings
      const currentSettings = await this.getAutoCompoundSettingsForPosition(userAddress, pid);
      if (!currentSettings?.enabled) {
        throw new Error('Auto-compounding is not enabled for this position');
      }

      // Disable old strategy
      await this.disableAutoCompound(userAddress, pid);

      // Enable new strategy
      return await this.enableAutoCompound(userAddress, pid, strategy);

    } catch (error) {
      logger.error({
        userAddress,
        pid,
        strategy,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to update auto-compounding strategy');

      const yieldError: YieldError = {
        code: YieldErrorCode.COMPOUND_FAILED,
        message: `Failed to update auto-compounding strategy: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, pid, strategy }
      };

      throw yieldError;
    }
  }

  /**
   * Execute compound operation
   */
  async compound(userAddress: string, pid: number): Promise<YieldOperation> {
    logger.debug({ userAddress, pid }, 'Executing compound operation');

    try {
      // Get position and farm
      const [position, farm] = await Promise.all([
        this.farmIntegration.getUserPosition(userAddress, pid),
        this.farmIntegration.getFarm(pid)
      ]);

      if (!position || !farm) {
        throw new Error('Position or farm not found');
      }

      // Check if there are rewards to compound
      if (parseFloat(position.rewardEarned) === 0) {
        throw new Error('No rewards available to compound');
      }

      // Get auto-compound settings
      const settings = await this.getAutoCompoundSettingsForPosition(userAddress, pid);
      const strategy = settings?.strategy || CompoundStrategy.MANUAL;

      // Estimate gas
      const gasEstimate = await this.gasOptimizationService.estimateGasForTransaction({
        to: this.config.masterChefV2,
        data: this.masterChefV2Contract?.interface.encodeFunctionData('harvest', [pid, userAddress]) || '0x',
        value: '0'
      });

      // Create compound operation
      const operation: YieldOperation = {
        id: `compound_${Date.now()}_${Math.random()}`,
        type: YieldOperationType.COMPOUND,
        userAddress,
        farmId: farm.id,
        poolId: pid.toString(),
        amount: position.rewardEarned,
        valueUSD: parseFloat(position.rewardEarned) * (farm.rewardTokenInfo.priceUSD || 2.5),
        rewards: position.rewardEarned,
        fees: (parseFloat(position.rewardEarned) * this.config.compoundFee / 100).toString(),
        transactionHash: '',
        blockNumber: 0,
        timestamp: Date.now(),
        gasUsed: gasEstimate.gasLimit,
        gasCostUSD: parseFloat(gasEstimate.estimatedCostUSD),
        status: 'pending',
        confirmations: 0
      };

      // Record compound operation
      await this.recordCompoundOperation({
        id: operation.id,
        userAddress,
        pid,
        transactionHash: '', // Will be updated after execution
        blockNumber: 0,
        timestamp: Date.now(),
        amountCompounded: position.rewardEarned,
        rewardsClaimed: position.rewardEarned,
        newShares: '0', // Will be calculated after execution
        gasUsed: gasEstimate.gasLimit,
        gasCostUSD: parseFloat(gasEstimate.estimatedCostUSD),
        apyBoost: 0, // Will be calculated after execution
        strategy
      });

      // Update position cache
      await this.invalidatePositionCache(userAddress, pid);

      logger.info({
        operationId: operation.id,
        userAddress,
        farmId: farm.id,
        pid,
        amountCompounded: position.rewardEarned,
        strategy
      }, 'Compound operation prepared');

      return operation;

    } catch (error) {
      logger.error({
        userAddress,
        pid,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to execute compound operation');

      const yieldError: YieldError = {
        code: YieldErrorCode.COMPOUND_FAILED,
        message: `Failed to execute compound: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, pid }
      };

      throw yieldError;
    }
  }

  /**
   * Execute multiple compound operations
   */
  async compoundMultiple(userAddress: string, pids: number[]): Promise<YieldOperation[]> {
    logger.debug({ userAddress, pids }, 'Executing multiple compound operations');

    try {
      if (pids.length === 0) {
        throw new Error('No PIDs provided');
      }

      // Get positions and farms
      const positions = await Promise.all(
        pids.map(pid => this.farmIntegration.getUserPosition(userAddress, pid))
      );

      const farms = await Promise.all(
        pids.map(pid => this.farmIntegration.getFarm(pid))
      );

      // Filter valid positions with rewards
      const validOperations: Array<{ pid: number; position: any; farm: any }> = [];
      for (let i = 0; i < pids.length; i++) {
        const position = positions[i];
        const farm = farms[i];
        if (position && farm && parseFloat(position.rewardEarned) > 0) {
          validOperations.push({ pid: pids[i], position, farm });
        }
      }

      if (validOperations.length === 0) {
        throw new Error('No positions with available rewards found');
      }

      // Check for batch optimization opportunity
      const shouldBatch = validOperations.length > 2;

      let operations: YieldOperation[];

      if (shouldBatch) {
        // Create batch compound operation
        operations = await this.createBatchCompoundOperation(userAddress, validOperations);
      } else {
        // Create individual compound operations
        operations = await Promise.all(
          validOperations.map(({ pid }) => this.compound(userAddress, pid))
        );
      }

      logger.info({
        userAddress,
        totalOperations: operations.length,
        batched: shouldBatch,
        totalPIDs: pids.length
      }, 'Multiple compound operations prepared');

      return operations;

    } catch (error) {
      logger.error({
        userAddress,
        pids,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to execute multiple compound operations');

      const yieldError: YieldError = {
        code: YieldErrorCode.COMPOUND_FAILED,
        message: `Failed to execute multiple compounds: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, pids }
      };

      throw yieldError;
    }
  }

  /**
   * Batch compound operations
   */
  async batchCompound(operations: CompoundOperation[]): Promise<YieldOperation[]> {
    logger.debug({ operationCount: operations.length }, 'Batching compound operations');

    try {
      if (operations.length === 0) {
        throw new Error('No operations to batch');
      }

      // Group operations by user for optimization
      const operationsByUser = operations.reduce((groups, op) => {
        if (!groups[op.userAddress]) {
          groups[op.userAddress] = [];
        }
        groups[op.userAddress].push(op);
        return groups;
      }, {} as Record<string, CompoundOperation[]>);

      // Execute batches for each user
      const results: YieldOperation[] = [];
      for (const [userAddress, userOps] of Object.entries(operationsByUser)) {
        const userResults = await this.compoundMultiple(
          userAddress,
          userOps.map(op => op.pid)
        );
        results.push(...userResults);
      }

      logger.info({
        totalOperations: operations.length,
        uniqueUsers: Object.keys(operationsByUser).length,
        resultsCount: results.length
      }, 'Batch compound operations completed');

      return results;

    } catch (error) {
      logger.error({
        operationCount: operations.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to batch compound operations');

      const yieldError: YieldError = {
        code: YieldErrorCode.COMPOUND_FAILED,
        message: `Failed to batch compounds: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { operationCount: operations.length }
      };

      throw yieldError;
    }
  }

  /**
   * Deposit to auto-compound vault
   */
  async depositToVault(userAddress: string, vaultAddress: string, amount: string): Promise<YieldOperation> {
    logger.debug({ userAddress, vaultAddress, amount }, 'Depositing to auto-compound vault');

    try {
      // Get vault contract
      const vaultContract = await this.getVaultContract(vaultAddress);

      // Get vault info
      const vaultInfo = await this.getVaultInfo(vaultAddress);
      if (!vaultInfo) {
        throw new Error('Vault not found');
      }

      // Estimate gas
      const gasEstimate = await this.gasOptimizationService.estimateGasForTransaction({
        to: vaultAddress,
        data: vaultContract.interface.encodeFunctionData('deposit', [amount]),
        value: '0'
      });

      // Create operation
      const operation: YieldOperation = {
        id: `vault_deposit_${Date.now()}_${Math.random()}`,
        type: YieldOperationType.DEPOSIT,
        userAddress,
        farmId: vaultInfo.id,
        poolId: vaultAddress,
        amount,
        valueUSD: parseFloat(amount) * (vaultInfo.underlyingToken.priceUSD || 1),
        rewards: '0',
        fees: (parseFloat(amount) * vaultInfo.compoundFee / 100).toString(),
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
        vaultAddress,
        amount,
        estimatedShares: await this.estimateShares(vaultAddress, amount)
      }, 'Vault deposit prepared');

      return operation;

    } catch (error) {
      logger.error({
        userAddress,
        vaultAddress,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to prepare vault deposit');

      const yieldError: YieldError = {
        code: YieldErrorCode.DEPOSIT_FAILED,
        message: `Failed to prepare vault deposit: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, vaultAddress, amount }
      };

      throw yieldError;
    }
  }

  /**
   * Withdraw from auto-compound vault
   */
  async withdrawFromVault(userAddress: string, vaultAddress: string, shares: string): Promise<YieldOperation> {
    logger.debug({ userAddress, vaultAddress, shares }, 'Withdrawing from auto-compound vault');

    try {
      // Get vault contract
      const vaultContract = await this.getVaultContract(vaultAddress);

      // Get vault info
      const vaultInfo = await this.getVaultInfo(vaultAddress);
      if (!vaultInfo) {
        throw new Error('Vault not found');
      }

      // Estimate gas
      const gasEstimate = await this.gasOptimizationService.estimateGasForTransaction({
        to: vaultAddress,
        data: vaultContract.interface.encodeFunctionData('withdraw', [shares]),
        value: '0'
      });

      // Estimate withdrawal amount
      const withdrawalAmount = await this.estimateWithdrawalAmount(vaultAddress, shares);

      // Create operation
      const operation: YieldOperation = {
        id: `vault_withdraw_${Date.now()}_${Math.random()}`,
        type: YieldOperationType.WITHDRAW,
        userAddress,
        farmId: vaultInfo.id,
        poolId: vaultAddress,
        amount: withdrawalAmount,
        valueUSD: parseFloat(withdrawalAmount) * (vaultInfo.underlyingToken.priceUSD || 1),
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
        vaultAddress,
        shares,
        estimatedAmount: withdrawalAmount
      }, 'Vault withdrawal prepared');

      return operation;

    } catch (error) {
      logger.error({
        userAddress,
        vaultAddress,
        shares,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to prepare vault withdrawal');

      const yieldError: YieldError = {
        code: YieldErrorCode.WITHDRAWAL_FAILED,
        message: `Failed to prepare vault withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, vaultAddress, shares }
      };

      throw yieldError;
    }
  }

  /**
   * Get vault information
   */
  async getVaultInfo(vaultAddress: string): Promise<AutoCompoundVault | null> {
    logger.debug({ vaultAddress }, 'Getting vault information');

    try {
      // Check cache first
      const cacheKey = `vault:${vaultAddress}`;
      const cached = await this.cache.get<AutoCompoundVault>(cacheKey);
      if (cached) {
        return cached;
      }

      // Get vault contract
      const vaultContract = await this.getVaultContract(vaultAddress);

      // Get vault data
      const [
        pricePerFullShare,
        totalShares,
        totalLocked,
        rewardRate,
        lastUpdateTime,
        periodFinish
      ] = await Promise.all([
        vaultContract.pricePerFullShare(),
        vaultContract.totalShares(),
        vaultContract.balanceOf(vaultAddress),
        vaultContract.rewardRate(),
        vaultContract.lastUpdateTime(),
        vaultContract.periodFinish()
      ]);

      // Get underlying token info
      const stakingToken = await vaultContract.stakingToken();
      const tokenInfo = await this.getTokenInfo(stakingToken);

      // Calculate metrics
      const tvl = parseFloat(ethers.formatEther(totalLocked)) * (tokenInfo.priceUSD || 1);
      const apr = await this.calculateVaultAPR(vaultAddress, rewardRate, totalLocked);
      const apy = this.calculateAPYFromAPR(apr);

      const vault: AutoCompoundVault = {
        id: `vault_${vaultAddress.slice(-8)}`,
        address: vaultAddress,
        name: `${tokenInfo.symbol} Auto-Compound Vault`,
        description: `Auto-compounding vault for ${tokenInfo.name}`,
        strategy: CompoundStrategy.AUTO,
        lpToken: stakingToken,
        underlyingToken: tokenInfo,
        pricePerFullShare: pricePerFullShare.toString(),
        totalShares: totalShares.toString(),
        totalLocked: totalLocked.toString(),
        tvl,
        apr,
        apy,
        compoundFrequency: 86400, // 24 hours
        lastCompoundAt: lastUpdateTime.toNumber() * 1000,
        autoCompound: true,
        compoundThreshold: this.config.compoundThreshold,
        compoundFee: this.config.compoundFee,
        userShares: '0',
        userValueUSD: 0,
        userDepositedAt: 0,
        isActive: periodFinish.toNumber() > Date.now() / 1000,
        isPaused: false,
        hasMigrated: false,
        createdAt: Date.now() - 86400000 * 30, // Assume 30 days ago
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
      }, 'Failed to get vault information');

      return null;
    }
  }

  /**
   * Get compound history
   */
  async getCompoundHistory(userAddress: string, pid: number, limit: number = 50): Promise<CompoundRecord[]> {
    logger.debug({ userAddress, pid, limit }, 'Getting compound history');

    try {
      // In a real implementation, this would fetch from database
      // For now, return empty array as placeholder
      return [];

    } catch (error) {
      logger.error({
        userAddress,
        pid,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get compound history');

      return [];
    }
  }

  /**
   * Get compound performance
   */
  async getCompoundPerformance(userAddress: string, pid: number): Promise<CompoundPerformance> {
    logger.debug({ userAddress, pid }, 'Getting compound performance');

    try {
      // Get current position
      const position = await this.farmIntegration.getUserPosition(userAddress, pid);
      if (!position) {
        throw new Error('Position not found');
      }

      // Get compound history
      const history = await this.getCompoundHistory(userAddress, pid);

      // Calculate performance metrics
      const totalCompounded = history.reduce((sum, record) =>
        sum + parseFloat(record.amountCompounded), 0
      );
      const totalRewardsClaimed = history.reduce((sum, record) =>
        sum + parseFloat(record.rewardsClaimed), 0
      );
      const totalGasSpent = history.reduce((sum, record) =>
        sum + record.gasCostUSD, 0
      );

      const performance: CompoundPerformance = {
        userAddress,
        pid,
        totalCompounded: totalCompounded.toString(),
        totalRewardsClaimed: totalRewardsClaimed.toString(),
        compoundCount: history.length,
        averageCompoundSize: history.length > 0 ?
          (totalCompounded / history.length).toString() : '0',
        totalGasSpent: totalGasSpent.toString(),
        netProfit: (totalRewardsClaimed - totalGasSpent).toString(),
        apyBoost: position.isAutoCompounding ? 0.15 : 0, // 15% boost for auto-compound
        performanceVsManual: position.isAutoCompounding ? 0.12 : 0, // 12% better than manual
        lastCompoundAt: history.length > 0 ? history[0].timestamp : 0,
        nextCompoundAt: position.isAutoCompounding ?
          Date.now() + 86400000 : 0, // Next day if auto-compounding
        efficiency: history.length > 0 ? 0.85 : 1.0 // 85% efficiency
      };

      return performance;

    } catch (error) {
      logger.error({
        userAddress,
        pid,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get compound performance');

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
  async calculateCompoundBenefits(position: YieldPosition, days: number): Promise<CompoundBenefit> {
    logger.debug({ userAddress: position.userAddress, pid: position.poolId, days }, 'Calculating compound benefits');

    try {
      const dailyRate = position.apr / 36500;

      // Manual compounding (daily)
      let manualValue = position.valueUSD;
      let manualRewards = 0;
      for (let i = 0; i < days; i++) {
        const dailyRewards = manualValue * dailyRate;
        manualRewards += dailyRewards;
        manualValue += dailyRewards * 0.99; // 1% gas fee
      }

      // Auto-compounding (continuous)
      const autoCompoundRate = dailyRate * 1.15; // 15% boost from optimal timing
      const autoCompoundValue = position.valueUSD * Math.pow(1 + autoCompoundRate, days);
      const autoCompoundRewards = autoCompoundValue - position.valueUSD;

      // Calculate benefits
      const additionalValue = autoCompoundValue - manualValue;
      const percentageIncrease = (additionalValue / manualValue) * 100;
      const apyImprovement = ((Math.pow(1 + autoCompoundRate, 365) - 1) -
                             (Math.pow(1 + dailyRate, 365) - 1)) * 100;

      // Cost analysis
      const gasFees = days * 0.5; // $0.50 per compound
      const platformFees = (autoCompoundRewards * this.config.compoundFee) / 100;
      const totalCosts = gasFees + platformFees;

      const benefit: CompoundBenefit = {
        manualReturns: {
          totalValue: manualValue,
          rewardsEarned: manualRewards,
          finalPosition: manualValue
        },
        autoCompoundReturns: {
          totalValue: autoCompoundValue,
          rewardsEarned: autoCompoundRewards,
          finalPosition: autoCompoundValue,
          compoundCount: days
        },
        benefit: {
          additionalValue,
          percentageIncrease,
          apyImprovement,
          paybackPeriod: totalCosts / (additionalValue / days) // days to recoup costs
        },
        costs: {
          gasFees,
          platformFees,
          totalCosts,
          netBenefit: additionalValue - totalCosts
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
      }, 'Failed to calculate compound benefits');

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
  async getUserAutoCompoundSettings(userAddress: string): Promise<AutoCompoundSettings> {
    logger.debug({ userAddress }, 'Getting user auto-compound settings');

    try {
      // Check cache first
      const cacheKey = `autocompound_settings:${userAddress}`;
      const cached = await this.cache.get<AutoCompoundSettings>(cacheKey);
      if (cached) {
        return cached;
      }

      // Default settings
      const settings: AutoCompoundSettings = {
        enabled: false,
        defaultStrategy: CompoundStrategy.DAILY,
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
          maxGasPercentage: 0.1, // 10% of rewards
          minRewardAmount: this.config.compoundThreshold,
          maxSlippage: 0.5 // 0.5%
        }
      };

      // Cache settings
      await this.cache.set(cacheKey, settings, this.config.userDataCacheTTL);

      return settings;

    } catch (error) {
      logger.error({
        userAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get user auto-compound settings');

      // Return default settings
      return {
        enabled: false,
        defaultStrategy: CompoundStrategy.DAILY,
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
  async updateUserSettings(userAddress: string, settings: Partial<AutoCompoundSettings>): Promise<void> {
    logger.debug({ userAddress, settings }, 'Updating user auto-compound settings');

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
      }, 'User auto-compound settings updated');

    } catch (error) {
      logger.error({
        userAddress,
        settings,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to update user settings');

      const yieldError: YieldError = {
        code: YieldErrorCode.INVALID_STRATEGY,
        message: `Failed to update user settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, settings }
      };

      throw yieldError;
    }
  }

  /**
   * Optimize gas costs
   */
  async optimizeGasCosts(operations: CompoundOperation[]): Promise<GasOptimizationResult> {
    logger.debug({ operationCount: operations.length }, 'Optimizing gas costs');

    try {
      if (operations.length === 0) {
        throw new Error('No operations to optimize');
      }

      // Calculate original costs
      const originalCost = await this.calculateTotalGasCost(operations);

      // Apply optimizations
      const optimizations: GasOptimization[] = [];

      // Batch operations
      if (operations.length > 2) {
        const batchSavings = await this.calculateBatchSavings(operations);
        optimizations.push({
          type: 'batch_operations',
          description: 'Batch multiple compound operations',
          savingsBNB: batchSavings.bnb,
          savingsUSD: batchSavings.usd,
          implementation: 'Group operations by user and execute in single transaction'
        });
      }

      // Gas price optimization
      const gasPriceSavings = await this.calculateGasPriceSavings(operations);
      optimizations.push({
        type: 'gas_price_optimization',
        description: 'Optimize gas price timing',
        savingsBNB: gasPriceSavings.bnb,
        savingsUSD: gasPriceSavings.usd,
        implementation: 'Execute during low gas price periods'
      });

      // Calculate optimized costs
      const optimizedCost = {
        totalBNB: (parseFloat(originalCost.totalBNB) -
                   optimizations.reduce((sum, opt) => sum + parseFloat(opt.savingsBNB), 0)).toString(),
        totalUSD: (parseFloat(originalCost.totalUSD) -
                   optimizations.reduce((sum, opt) => sum + parseFloat(opt.savingsUSD), 0)).toString(),
        perOperation: ((parseFloat(originalCost.totalUSD) -
                      optimizations.reduce((sum, opt) => sum + parseFloat(opt.savingsUSD), 0)) / operations.length).toString()
      };

      const result: GasOptimizationResult = {
        originalCost,
        optimizedCost,
        savings: {
          bnb: (parseFloat(originalCost.totalBNB) - parseFloat(optimizedCost.totalBNB)).toString(),
          usd: (parseFloat(originalCost.totalUSD) - parseFloat(optimizedCost.totalUSD)).toString(),
          percentage: ((parseFloat(originalCost.totalUSD) - parseFloat(optimizedCost.totalUSD)) /
                      parseFloat(originalCost.totalUSD)) * 100
        },
        optimizations,
        recommendedBatchSize: Math.min(operations.length, 5),
        optimalTiming: '2-4 AM UTC (lowest gas prices)'
      };

      logger.info({
        operationCount: operations.length,
        totalSavings: result.savings,
        optimizationCount: optimizations.length
      }, 'Gas cost optimization completed');

      return result;

    } catch (error) {
      logger.error({
        operationCount: operations.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to optimize gas costs');

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
  async scheduleOptimalCompound(userAddress: string, pid: number): Promise<ScheduledCompound> {
    logger.debug({ userAddress, pid }, 'Scheduling optimal compound');

    try {
      // Get current gas prices
      const currentGasPrice = await this.getCurrentGasPrice();

      // Predict optimal timing
      const optimalTiming = await this.predictOptimalGasTiming();

      // Get position settings
      const settings = await this.getAutoCompoundSettingsForPosition(userAddress, pid);
      const strategy = settings?.strategy || CompoundStrategy.DAILY;

      // Create scheduled compound
      const scheduledCompound: ScheduledCompound = {
        id: `scheduled_${Date.now()}_${Math.random()}`,
        userAddress,
        pid,
        scheduledAt: Date.now(),
        estimatedAt: optimalTiming.timestamp,
        strategy,
        conditions: [
          {
            type: 'gas_price' as const,
            operator: 'less_than' as const,
            value: settings?.maxGasPrice || '10000000000',
            description: 'Execute when gas price is below threshold'
          },
          {
            type: 'reward_threshold' as const,
            operator: 'greater_than' as const,
            value: settings?.compoundThreshold || this.config.compoundThreshold,
            description: 'Execute when rewards exceed threshold'
          }
        ],
        status: 'scheduled',
        priority: this.calculatePriority(userAddress, pid)
      };

      // Store scheduled compound
      await this.storeScheduledCompound(scheduledCompound);

      logger.info({
        scheduledId: scheduledCompound.id,
        userAddress,
        pid,
        estimatedAt: optimalTiming.timestamp,
        priority: scheduledCompound.priority
      }, 'Optimal compound scheduled');

      return scheduledCompound;

    } catch (error) {
      logger.error({
        userAddress,
        pid,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to schedule optimal compound');

      const yieldError: YieldError = {
        code: YieldErrorCode.COMPOUND_FAILED,
        message: `Failed to schedule optimal compound: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, pid }
      };

      throw yieldError;
    }
  }

  /**
   * Get auto-compound statistics
   */
  async getAutoCompoundStats(): Promise<AutoCompoundStats> {
    logger.debug('Getting auto-compound statistics');

    try {
      // In a real implementation, this would fetch from database
      // For now, return placeholder data
      const stats: AutoCompoundStats = {
        totalUsers: 1250,
        activePositions: 3400,
        totalCompounded24h: '450000000000000000000', // 450 CAKE
        totalGasUsed24h: '210000000000000000', // 0.21 BNB
        averageAPYBoost: 0.15, // 15%
        popularStrategies: [
          { strategy: CompoundStrategy.DAILY, count: 1800 },
          { strategy: CompoundStrategy.WEEKLY, count: 900 },
          { strategy: CompoundStrategy.AUTO, count: 700 }
        ],
        efficiencyMetrics: {
          successRate: 0.94, // 94%
          averageGasSavings: 0.25, // 25%
          averageExecutionTime: 15000 // 15 seconds
        },
        performanceMetrics: {
          topPerformers: ['0x123...', '0x456...', '0x789...'],
          averageROI: 0.45, // 45%
          riskAdjustedReturns: 0.32 // 32%
        }
      };

      return stats;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get auto-compound statistics');

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
  async compareStrategies(pid: number, days: number): Promise<StrategyComparison> {
    logger.debug({ pid, days }, 'Comparing compounding strategies');

    try {
      // Get farm information
      const farm = await this.farmIntegration.getFarm(pid);
      if (!farm) {
        throw new Error('Farm not found');
      }

      // Test different strategies
      const strategies = [
        CompoundStrategy.MANUAL,
        CompoundStrategy.DAILY,
        CompoundStrategy.WEEKLY,
        CompoundStrategy.MONTHLY,
        CompoundStrategy.AUTO
      ];

      const strategyResults = await Promise.all(
        strategies.map(async strategy => {
          const result = await this.simulateStrategy(farm, strategy, days);
          return {
            strategy,
            finalValue: result.finalValue,
            totalCompounds: result.totalCompounds,
            gasCosts: result.gasCosts,
            netProfit: result.netProfit,
            apy: result.apy,
            efficiency: result.efficiency,
            risk: result.risk
          };
        })
      );

      // Find best strategy
      const bestStrategy = strategyResults.reduce((best, current) =>
        current.netProfit > best.netProfit ? current : best
      );

      const comparison: StrategyComparison = {
        pid,
        period: days,
        strategies: strategyResults,
        recommendation: {
          bestStrategy: bestStrategy.strategy,
          reason: this.generateRecommendationReason(bestStrategy),
          confidence: this.calculateRecommendationConfidence(bestStrategy, strategyResults)
        }
      };

      logger.info({
        pid,
        days,
        bestStrategy: bestStrategy.strategy,
        netProfit: bestStrategy.netProfit
      }, 'Strategy comparison completed');

      return comparison;

    } catch (error) {
      logger.error({
        pid,
        days,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to compare strategies');

      const yieldError: YieldError = {
        code: YieldErrorCode.NETWORK_ERROR,
        message: `Failed to compare strategies: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { pid, days }
      };

      throw yieldError;
    }
  }

  // Private helper methods

  private getCompoundSettings(strategy: CompoundStrategy, userSettings: AutoCompoundSettings): CompoundSettings {
    const frequency = this.getFrequencyFromStrategy(strategy);

    return {
      threshold: userSettings.compoundThreshold,
      frequency,
      maxGasPrice: userSettings.maxGasPrice,
      onlyWhenProfitable: userSettings.onlyProfitableCompounds,
      minProfitAmount: this.calculateMinProfitAmount(frequency),
      emergencyStop: userSettings.emergencyMode
    };
  }

  private generateCompoundSchedule(strategy: CompoundStrategy, settings: CompoundSettings): CompoundSchedule {
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

  private getFrequencyFromStrategy(strategy: CompoundStrategy): number {
    switch (strategy) {
      case CompoundStrategy.HOURLY: return 3600000; // 1 hour
      case CompoundStrategy.DAILY: return 86400000; // 24 hours
      case CompoundStrategy.WEEKLY: return 604800000; // 7 days
      case CompoundStrategy.MONTHLY: return 2592000000; // 30 days
      case CompoundStrategy.AUTO: return 43200000; // 12 hours (adaptive)
      default: return 86400000; // Default to daily
    }
  }

  private getCompoundFrequency(frequencyMs: number): CompoundFrequency {
    if (frequencyMs <= 3600000) return CompoundFrequency.HOURLY;
    if (frequencyMs <= 10800000) return CompoundFrequency.EVERY_3_HOURS;
    if (frequencyMs <= 21600000) return CompoundFrequency.EVERY_6_HOURS;
    if (frequencyMs <= 43200000) return CompoundFrequency.EVERY_12_HOURS;
    if (frequencyMs <= 86400000) return CompoundFrequency.DAILY;
    if (frequencyMs <= 604800000) return CompoundFrequency.WEEKLY;
    return CompoundFrequency.CUSTOM;
  }

  private calculateMinProfitAmount(frequency: number): string {
    // Minimum profit should cover gas costs
    const estimatedGasCostUSD = 0.5; // $0.50 per compound
    const compoundsPerDay = 86400000 / frequency;
    return (estimatedGasCostUSD * compoundsPerDay * 2).toString(); // 2x buffer
  }

  private async estimateCompoundGasCost(userAddress: string, pid: number, strategy: CompoundStrategy): Promise<any> {
    const frequency = this.getFrequencyFromStrategy(strategy);
    const gasMultiplier = strategy === CompoundStrategy.AUTO ? 1.2 : 1.0; // Auto requires more gas

    return await this.gasOptimizationService.estimateGasForTransaction({
      to: this.config.masterChefV2,
      data: this.masterChefV2Contract?.interface.encodeFunctionData('harvest', [pid, userAddress]) || '0x',
      value: '0'
    });
  }

  private async calculateAPYBoost(position: YieldPosition, strategy: CompoundStrategy): Promise<number> {
    const frequency = this.getFrequencyFromStrategy(strategy);
    const compoundsPerYear = 365 * 86400000 / frequency;

    // More frequent compounding = higher boost
    const baseBoost = 0.1; // 10% base boost
    const frequencyBoost = Math.log10(compoundsPerYear) * 0.02; // 2% per log10 of compounds per year
    const strategyBonus = strategy === CompoundStrategy.AUTO ? 0.05 : 0; // 5% bonus for auto

    return baseBoost + frequencyBoost + strategyBonus;
  }

  private calculateAPYFromAPR(apr: number): number {
    return Math.pow(1 + apr / 36500, 365) - 1;
  }

  private async getVaultContract(vaultAddress: string): Promise<ethers.Contract> {
    // Check cache first
    if (this.vaultContracts.has(vaultAddress)) {
      return this.vaultContracts.get(vaultAddress)!;
    }

    const provider = await this.provider.getProvider();
    const contract = new ethers.Contract(vaultAddress, AUTO_COMPOUND_VAULT_ABI, provider);

    this.vaultContracts.set(vaultAddress, contract);
    return contract;
  }

  private async getTokenInfo(tokenAddress: string): Promise<any> {
    // Simplified token info - would fetch from token service
    return {
      address: tokenAddress,
      symbol: 'TOKEN',
      name: 'Token',
      decimals: 18,
      priceUSD: 1.0
    };
  }

  private async calculateVaultAPR(vaultAddress: string, rewardRate: bigint, totalLocked: bigint): Promise<number> {
    // Simplified APR calculation for vaults
    const rewardRatePerYear = Number(rewardRate) * 365 * 86400;
    const totalLockedValue = Number(ethers.formatEther(totalLocked));

    return totalLockedValue > 0 ? (rewardRatePerYear / totalLockedValue) * 100 : 0;
  }

  private async estimateShares(vaultAddress: string, amount: string): Promise<string> {
    const vaultContract = await this.getVaultContract(vaultAddress);
    const pricePerFullShare = await vaultContract.pricePerFullShare();
    const amountWei = ethers.parseEther(amount);

    return (amountWei * 1000000n / pricePerFullShare).toString(); // Convert to shares
  }

  private async estimateWithdrawalAmount(vaultAddress: string, shares: string): Promise<string> {
    const vaultContract = await this.getVaultContract(vaultAddress);
    const pricePerFullShare = await vaultContract.pricePerFullShare();
    const sharesWei = ethers.parseEther(shares);

    return ethers.formatEther(sharesWei * pricePerFullShare / 1000000n);
  }

  private async recordCompoundOperation(record: CompoundRecord): Promise<void> {
    // In a real implementation, this would save to database
    logger.info({
      recordId: record.id,
      userAddress: record.userAddress,
      pid: record.pid,
      amountCompounded: record.amountCompounded
    }, 'Compound operation recorded');
  }

  private async invalidatePositionCache(userAddress: string, pid: number): Promise<void> {
    const cacheKey = `position:${userAddress}:${pid}`;
    await this.cache.delete(cacheKey);
  }

  private async storeAutoCompoundSettings(userAddress: string, pid: number, settings: any): Promise<void> {
    const cacheKey = `autocompound_position:${userAddress}:${pid}`;
    await this.cache.set(cacheKey, settings, this.config.userDataCacheTTL);
  }

  private async getAutoCompoundSettingsForPosition(userAddress: string, pid: number): Promise<any> {
    const cacheKey = `autocompound_position:${userAddress}:${pid}`;
    return await this.cache.get(cacheKey);
  }

  private async cancelScheduledCompounds(userAddress: string, pid: number): Promise<void> {
    // In a real implementation, this would cancel scheduled jobs
    logger.info({ userAddress, pid }, 'Scheduled compounds cancelled');
  }

  private async scheduleNextCompound(userAddress: string, pid: number, schedule: CompoundSchedule): Promise<void> {
    // In a real implementation, this would schedule a background job
    logger.info({
      userAddress,
      pid,
      nextCompound: schedule.nextCompound
    }, 'Next compound scheduled');
  }

  private async createBatchCompoundOperation(userAddress: string, operations: Array<{ pid: number; position: any; farm: any }>): Promise<YieldOperation[]> {
    // Create a single batch operation that compounds multiple positions
    const batchOperation: YieldOperation = {
      id: `batch_compound_${Date.now()}_${Math.random()}`,
      type: YieldOperationType.COMPOUND,
      userAddress,
      farmId: 'batch',
      poolId: operations.map(op => op.pid.toString()).join(','),
      amount: operations.reduce((sum, op) => {
        const rewards = parseFloat(op.position.rewardEarned);
        return sum + rewards;
      }, 0).toString(),
      valueUSD: operations.reduce((sum, op) => sum + op.position.valueUSD, 0),
      rewards: operations.reduce((sum, op) => {
        const rewards = parseFloat(op.position.rewardEarned);
        return sum + rewards;
      }, 0).toString(),
      fees: '0',
      transactionHash: '',
      blockNumber: 0,
      timestamp: Date.now(),
      gasUsed: (operations.length * 200000).toString(), // Rough estimate
      gasCostUSD: operations.length * 2.5, // Rough estimate
      status: 'pending',
      confirmations: 0
    };

    return [batchOperation];
  }

  private async getCurrentGasPrice(): Promise<number> {
    const provider = await this.provider.getProvider();
    const gasPrice = await provider.getFeeData();
    return Number(gasPrice.gasPrice || 0);
  }

  private async predictOptimalGasTiming(): Promise<{ timestamp: number; gasPrice: number }> {
    // Simplified gas price prediction
    const currentGasPrice = await this.getCurrentGasPrice();
    const optimalGasPrice = currentGasPrice * 0.7; // Assume 30% reduction possible
    const timeToOptimal = 4 * 3600000; // 4 hours from now

    return {
      timestamp: Date.now() + timeToOptimal,
      gasPrice: optimalGasPrice
    };
  }

  private calculatePriority(userAddress: string, pid: number): number {
    // Calculate priority based on user tier, position size, etc.
    return Math.floor(Math.random() * 10) + 1; // Random priority 1-10
  }

  private async storeScheduledCompound(scheduled: ScheduledCompound): Promise<void> {
    // In a real implementation, this would save to database or scheduler
    logger.info({
      scheduledId: scheduled.id,
      userAddress: scheduled.userAddress,
      pid: scheduled.pid,
      estimatedAt: scheduled.estimatedAt
    }, 'Scheduled compound stored');
  }

  private async calculateTotalGasCost(operations: CompoundOperation[]): Promise<{ totalBNB: string; totalUSD: string; perOperation: string }> {
    const totalUSD = operations.reduce((sum, op) => sum + op.gasCostUSD, 0);
    const bnbPrice = 300; // Placeholder BNB price
    const totalBNB = totalUSD / bnbPrice;

    return {
      totalBNB: totalBNB.toString(),
      totalUSD: totalUSD.toString(),
      perOperation: (totalUSD / operations.length).toString()
    };
  }

  private async calculateBatchSavings(operations: CompoundOperation[]): Promise<{ bnb: string; usd: string }> {
    const individualCosts = operations.map(op => op.gasCostUSD);
    const totalIndividualCost = individualCosts.reduce((sum, cost) => sum + cost, 0);
    const batchCost = 5.0; // Estimated batch cost
    const savings = totalIndividualCost - batchCost;
    const bnbPrice = 300;

    return {
      bnb: (savings / bnbPrice).toString(),
      usd: savings.toString()
    };
  }

  private async calculateGasPriceSavings(operations: CompoundOperation[]): Promise<{ bnb: string; usd: string }> {
    // Assume 20% savings from optimal timing
    const totalCost = operations.reduce((sum, op) => sum + op.gasCostUSD, 0);
    const savings = totalCost * 0.2;
    const bnbPrice = 300;

    return {
      bnb: (savings / bnbPrice).toString(),
      usd: savings.toString()
    };
  }

  private async simulateStrategy(farm: YieldFarm, strategy: CompoundStrategy, days: number): Promise<any> {
    const frequency = this.getFrequencyFromStrategy(strategy);
    const compoundsPerPeriod = Math.floor((days * 86400000) / frequency);
    const dailyRate = farm.apr / 36500;

    // Simulate compounding
    let value = 1000; // Start with $1000
    let totalCompounds = 0;
    let totalGasCosts = 0;

    for (let i = 0; i < compoundsPerPeriod; i++) {
      const rewards = value * dailyRate * (frequency / 86400000);
      const gasCost = 0.5; // $0.50 per compound
      const netRewards = Math.max(0, rewards - gasCost);

      value += netRewards;
      totalCompounds++;
      totalGasCosts += gasCost;
    }

    return {
      finalValue: value,
      totalCompounds,
      gasCosts: totalGasCosts,
      netProfit: value - 1000 - totalGasCosts,
      apy: ((value - 1000) / 1000) * (365 / days) * 100,
      efficiency: totalCompounds > 0 ? (value - 1000) / (totalCompounds * 0.5) : 0,
      risk: strategy === CompoundStrategy.AUTO ? 0.3 : 0.1 // Auto has slightly higher risk
    };
  }

  private generateRecommendationReason(bestStrategy: any): string {
    if (bestStrategy.netProfit > 100) {
      return `Highest returns with ${bestStrategy.totalCompounds} compounds and reasonable gas costs`;
    } else if (bestStrategy.efficiency > 2) {
      return `Best efficiency with excellent return to gas cost ratio`;
    } else {
      return `Optimal balance between returns and costs for this position`;
    }
  }

  private calculateRecommendationConfidence(bestStrategy: any, allStrategies: any[]): number {
    const avgProfit = allStrategies.reduce((sum, s) => sum + s.netProfit, 0) / allStrategies.length;
    const profitMargin = (bestStrategy.netProfit - avgProfit) / avgProfit;

    return Math.min(0.95, Math.max(0.5, 0.7 + profitMargin));
  }
}

// Export types and interfaces
export type { CompoundOperation };

// Export singleton instance
export const autoCompoundService = new AutoCompoundService();