/**
 * BSC Yield Farming Types and Interfaces (Viem)
 * Defines comprehensive yield farming data structures for PancakeSwap integration using Viem
 */

import { Address } from 'viem';

// PancakeSwap Syrup Pool ABI (Viem compatible)
export const SYRUP_POOL_ABI_VIEM = [
  'function deposit(uint256 amount) external',
  'function withdraw(uint256 amount) external',
  'function emergencyWithdraw() external',
  'function balanceOf(address) view returns (uint256)',
  'function earned(address) view returns (uint256)',
  'function getReward() external',
  'function stake(address) external',
  'function withdraw(address, uint256) external',
  'function earned(address, address) view returns (uint256)',
  'function rewards(address) view returns (uint256)',
  'function userRewardPerTokenPaid(address, address) view returns (uint256)',
  'function rewardPerTokenStored() view returns (uint256)',
  'function lastUpdateTime() view returns (uint256)',
  'function rewardRate() view returns (uint256)',
  'function stakingToken() view returns (address)',
  'function rewardsToken() view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function periodFinish() view returns (uint256)'
] as const;

// ERC20 ABI for token operations
export const ERC20_ABI_VIEM = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)'
] as const;

export interface SyrupPoolViem {
  // Pool identification
  id: string;
  address: Address;
  name: string;
  description: string;
  category: StakingCategoryViem;

  // Token information
  stakingToken: TokenInfoViem;
  rewardToken: TokenInfoViem;

  // Pool metrics
  rewardRate: string;
  rewardPerTokenStored: string;
  lastUpdateTime: number;
  periodFinish: number;

  // Performance metrics
  apr: number;
  apy: number;
  tvl: number;
  totalStaked: string;

  // User data
  userBalance?: string;
  userEarned?: string;
  userValueUSD?: number;

  // Status and flags
  isActive: boolean;
  isFinished: boolean;
  isLocked: boolean;
  flexible: boolean;

  // Lock information
  lockDuration?: number;
  earlyWithdrawalFee?: number;

  // Metadata
  createdAt: number;
  updatedAt: number;
  logoURI?: string;
}

export interface YieldPositionViem {
  // Position identification
  id: string;
  userAddress: Address;
  farmId: string;
  poolId: Address;

  // Position amounts
  amount: string;
  valueUSD: number;
  shares?: string;

  // Position performance
  totalEarned: string;
  rewardEarned: string;
  feeEarned: string;
  compoundEarned: string;

  // Position metrics
  apr: number;
  apy: number;
  roi: number;
  impermanentLoss: number;

  // Position timing
  createdAt: number;
  updatedAt: number;
  lastHarvestAt: number;
  duration: number;

  // Position status
  isActive: boolean;
  isAutoCompounding: boolean;
  isLocked: boolean;

  // Lock information
  lockEndsAt?: number;
  earlyWithdrawalFee?: number;

  // Farm type
  farmType: 'regular' | 'syrup' | 'autocompound' | 'locked';

  // Farm data
  syrupPool?: SyrupPoolViem;
}

export interface YieldOperationViem {
  // Operation details
  id: string;
  type: YieldOperationTypeViem;
  userAddress: Address;
  farmId: string;
  poolId: Address;

  // Amounts
  amount: string;
  valueUSD: number;
  rewards: string;
  fees: string;

  // Transaction details
  transactionHash: Address;
  blockNumber: bigint;
  timestamp: number;
  gasUsed: string;
  gasCostUSD: number;

  // Operation status
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;

  // Additional data
  metadata?: any;
}

export enum YieldOperationTypeViem {
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw',
  HARVEST = 'harvest',
  COMPOUND = 'compound',
  EMERGENCY_WITHDRAW = 'emergency_withdraw',
  MIGRATE = 'migrate',
  CLAIM = 'claim'
}

export interface SyrupPoolTrendViem {
  poolAddress: Address;
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

export interface RewardEstimateViem {
  daily: string;
  weekly: string;
  monthly: string;
  yearly: string;
  currentAPR: number;
  projectedValue: number;
  assumptions: string[];
}

export interface LockInfoViem {
  userAddress: Address;
  poolAddress: Address;
  lockedAmount: string;
  lockedUntil: number;
  remainingDays: number;
  earlyWithdrawalFee: number;
  canWithdraw: boolean;
  lockDuration: number;
  rewardsWhileLocked: string;
}

export interface SyrupPoolPerformanceViem {
  poolId: string;
  period: string;
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalStakers: number;
  activeStakers: number;
  newStakers: number;
  averageStakeSize: number;
  concentrationRisk: number;
  smartContractRisk: number;
  tokenRisk: number;
  calculatedAt: number;
  periodStart: number;
  periodEnd: number;
}

export interface TokenInfoViem {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  priceUSD?: number;
}

export enum StakingCategoryViem {
  FLEXIBLE = 'flexible',
  LOCKED = 'locked',
  GOVERNANCE = 'governance',
  NFT = 'nft',
  LIQUIDITY_MINING = 'liquidity_mining',
  SINGLE_STAKING = 'single_staking'
}

export interface YieldConfigViem {
  // Contract addresses
  masterChefV2: Address;
  masterChefV1?: Address;
  rewardToken: Address;

  // Gas configuration
  defaultGasLimit: {
    deposit: number;
    withdraw: number;
    harvest: number;
    compound: number;
    approve: number;
  };

  // Fee configuration
  performanceFee: number;
  compoundFee: number;
  withdrawalFee: number;

  // Yield optimization
  autoCompound: boolean;
  compoundThreshold: string;
  compoundFrequency: number;

  // Cache configuration
  cacheFarmData: boolean;
  farmDataCacheTTL: number; // milliseconds
  cacheUserData: boolean;
  userDataCacheTTL: number;

  // Analytics configuration
  enableAnalytics: boolean;
  analyticsRetentionDays: number;

  // Risk management
  maxConcentration: number;
  minFarmAge: number; // blocks
  maxFarmAge: number; // blocks
  requireVerification: boolean;

  // Strategy settings
  defaultRiskTolerance: RiskToleranceViem;
  defaultLiquidityPreference: LiquidityPreferenceViem;
  maxPositionsPerUser: number;
}

export enum RiskToleranceViem {
  CONSERVATIVE = 'conservative',
  MODERATE = 'moderate',
  AGGRESSIVE = 'aggressive',
  VERY_AGGRESSIVE = 'very_aggressive'
}

export enum LiquidityPreferenceViem {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface YieldErrorViem {
  code: YieldErrorCodeViem;
  message: string;
  details?: any;
  retryable?: boolean;
  suggestedAction?: string;
}

export enum YieldErrorCodeViem {
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_ALLOWANCE = 'INSUFFICIENT_ALLOWANCE',
  POOL_NOT_FOUND = 'POOL_NOT_FOUND',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  GAS_PRICE_TOO_HIGH = 'GAS_PRICE_TOO_HIGH',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  POOL_FINISHED = 'POOL_FINISHED',
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  LOCK_PERIOD_ACTIVE = 'LOCK_PERIOD_ACTIVE',
  EARLY_WITHDRAWAL_FEE = 'EARLY_WITHDRAWAL_FEE',
  APPROVAL_FAILED = 'APPROVAL_FAILED',
  DEPOSIT_FAILED = 'DEPOSIT_FAILED',
  WITHDRAWAL_FAILED = 'WITHDRAWAL_FAILED',
  HARVEST_FAILED = 'HARVEST_FAILED',
  COMPOUND_FAILED = 'COMPOUND_FAILED',
  POSITION_NOT_FOUND = 'POSITION_NOT_FOUND'
}

// Viem-specific interfaces
export interface ISyrupPoolServiceViem {
  // Pool information
  getSyrupPool(address: Address): Promise<SyrupPoolViem | null>;
  getSyrupPools(category?: StakingCategoryViem): Promise<SyrupPoolViem[]>;
  getActiveSyrupPools(): Promise<SyrupPoolViem[]>;
  getFinishedSyrupPools(): Promise<SyrupPoolViem[]>;

  // User positions
  getUserSyrupPosition(userAddress: Address, poolAddress: Address): Promise<YieldPositionViem | null>;
  getUserSyrupPositions(userAddress: Address): Promise<YieldPositionViem[]>;

  // Staking operations
  stakeSyrup(userAddress: Address, poolAddress: Address, amount: string): Promise<YieldOperationViem>;
  unstakeSyrup(userAddress: Address, poolAddress: Address, amount: string): Promise<YieldOperationViem>;
  claimSyrupRewards(userAddress: Address, poolAddress: Address): Promise<YieldOperationViem>;
  emergencyWithdrawSyrup(userAddress: Address, poolAddress: Address): Promise<YieldOperationViem>;

  // Pool discovery
  discoverSyrupPools(): Promise<SyrupPoolViem[]>;
  validateSyrupPool(poolAddress: Address): Promise<{ isValid: boolean; issues: string[] }>;

  // Analytics
  getSyrupPoolPerformance(poolAddress: Address, period: string): Promise<SyrupPoolPerformanceViem>;
  getSyrupPoolTrends(period: string): Promise<SyrupPoolTrendViem[]>;
  getTopSyrupPools(limit: number, sortBy?: string): Promise<SyrupPoolViem[]>;

  // Rewards calculation
  calculatePendingRewards(userAddress: Address, poolAddress: Address): Promise<string>;
  calculateRewardRate(poolAddress: Address): Promise<string>;
  estimateRewards(userAddress: Address, poolAddress: Address, days: number): Promise<RewardEstimateViem>;

  // Lock management
  getLockInfo(userAddress: Address, poolAddress: Address): Promise<LockInfoViem>;
  extendLockPeriod(userAddress: Address, poolAddress: Address, additionalDays: number): Promise<YieldOperationViem>;
  calculateEarlyWithdrawalFee(userAddress: Address, poolAddress: Address, amount: string): Promise<string>;
}

export interface SyrupPoolFilterViem {
  category?: StakingCategoryViem;
  isActive?: boolean;
  isFinished?: boolean;
  isLocked?: boolean;
  minAPR?: number;
  maxAPR?: number;
  minTVL?: number;
  maxTVL?: number;
  sortBy?: 'apr' | 'apy' | 'tvl' | 'name';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SyrupPoolAnalyticsViem {
  totalPools: number;
  activePools: number;
  finishedPools: number;
  totalTVL: number;
  averageAPR: number;
  topPools: SyrupPoolViem[];
  trends: {
    tvlChange24h: number;
    tvlChange7d: number;
    aprChange24h: number;
    aprChange7d: number;
  };
  categories: Record<StakingCategoryViem, {
    count: number;
    totalTVL: number;
    averageAPR: number;
  }>;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  lastUpdated: number;
}

export interface SyrupPoolBatchRequestViem {
  poolAddresses: Address[];
  includeUserData?: boolean;
  userAddress?: Address;
  includeAnalytics?: boolean;
}

export interface SyrupPoolBatchResponseViem {
  pools: SyrupPoolViem[];
  userPositions?: YieldPositionViem[];
  analytics?: SyrupPoolAnalyticsViem;
  errors: Array<{
    poolAddress: Address;
    error: string;
  }>;
  timestamp: number;
}

// Auto-compounding types
export interface AutoCompoundVaultViem {
  // Vault identification
  id: string;
  address: Address;
  name: string;
  description: string;
  strategy: CompoundStrategyViem;

  // Token information
  lpToken: Address;
  underlyingToken: TokenInfoViem;

  // Vault metrics
  pricePerFullShare: string;
  totalShares: string;
  totalLocked: string;
  tvl: number;

  // Performance metrics
  apr: number;
  apy: number;
  compoundFrequency: number;
  lastCompoundAt: number;

  // Auto-compounding settings
  autoCompound: boolean;
  compoundThreshold: string;
  compoundFee: number;

  // User data
  userShares?: string;
  userValueUSD?: number;
  userDepositedAt?: number;

  // Status and flags
  isActive: boolean;
  isPaused: boolean;
  hasMigrated: boolean;

  // Metadata
  createdAt: number;
  updatedAt: number;
  logoURI?: string;
  platform: string;
}

export enum CompoundStrategyViem {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  AUTO = 'auto',
  MANUAL = 'manual',
  HOURLY = 'hourly',
  HYBRID = 'hybrid'
}

export interface AutoCompoundOperationViem {
  operation: YieldOperationViem;
  strategy: CompoundStrategyViem;
  settings: CompoundSettingsViem;
  schedule: CompoundScheduleViem;
  estimatedAPYBoost: number;
  gasEstimate: {
    costBNB: string;
    costUSD: string;
    savings: string;
  };
}

export interface CompoundRecordViem {
  id: string;
  userAddress: Address;
  pid: number;
  transactionHash: Address;
  blockNumber: bigint;
  timestamp: number;
  amountCompounded: string;
  rewardsClaimed: string;
  newShares: string;
  gasUsed: string;
  gasCostUSD: number;
  apyBoost: number;
  strategy: CompoundStrategyViem;
}

export interface CompoundPerformanceViem {
  userAddress: Address;
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

export interface CompoundBenefitViem {
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

export interface AutoCompoundSettingsViem {
  enabled: boolean;
  defaultStrategy: CompoundStrategyViem;
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

export interface CompoundSettingsViem {
  threshold: string;
  frequency: number;
  maxGasPrice: string;
  onlyWhenProfitable: boolean;
  minProfitAmount: string;
  emergencyStop: boolean;
}

export interface CompoundScheduleViem {
  enabled: boolean;
  frequency: CompoundFrequencyViem;
  nextCompound: number;
  lastCompound: number;
  timezone: string;
  activeHours: {
    start: string;
    end: string;
  };
  cooldownHours: number;
}

export enum CompoundFrequencyViem {
  HOURLY = 'hourly',
  EVERY_3_HOURS = 'every_3_hours',
  EVERY_6_HOURS = 'every_6_hours',
  EVERY_12_HOURS = 'every_12_hours',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  CUSTOM = 'custom'
}

export interface GasOptimizationResultViem {
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
  optimizations: GasOptimizationViem[];
  recommendedBatchSize: number;
  optimalTiming: string;
}

export interface GasOptimizationViem {
  type: string;
  description: string;
  savingsBNB: string;
  savingsUSD: string;
  implementation: string;
}

export interface ScheduledCompoundViem {
  id: string;
  userAddress: Address;
  pid: number;
  scheduledAt: number;
  estimatedAt: number;
  strategy: CompoundStrategyViem;
  conditions: CompoundConditionViem[];
  status: 'scheduled' | 'executing' | 'completed' | 'failed' | 'cancelled';
  priority: number;
}

export interface CompoundConditionViem {
  type: 'reward_threshold' | 'gas_price' | 'time_based' | 'price_based';
  operator: 'greater_than' | 'less_than' | 'equals';
  value: string | number;
  description: string;
}

export interface AutoCompoundStatsViem {
  totalUsers: number;
  activePositions: number;
  totalCompounded24h: string;
  totalGasUsed24h: string;
  averageAPYBoost: number;
  popularStrategies: { strategy: CompoundStrategyViem; count: number }[];
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

export interface StrategyComparisonViem {
  pid: number;
  period: number;
  strategies: {
    strategy: CompoundStrategyViem;
    finalValue: number;
    totalCompounds: number;
    gasCosts: number;
    netProfit: number;
    apy: number;
    efficiency: number;
    risk: number;
  }[];
  recommendation: {
    bestStrategy: CompoundStrategyViem;
    reason: string;
    confidence: number;
  };
}

export interface IAutoCompoundServiceViem {
  // Auto-compounding management
  enableAutoCompound(userAddress: Address, pid: number, strategy: CompoundStrategyViem): Promise<AutoCompoundOperationViem>;
  disableAutoCompound(userAddress: Address, pid: number): Promise<YieldOperationViem>;
  updateAutoCompoundStrategy(userAddress: Address, pid: number, strategy: CompoundStrategyViem): Promise<AutoCompoundOperationViem>;

  // Compound operations
  compound(userAddress: Address, pid: number): Promise<YieldOperationViem>;
  compoundMultiple(userAddress: Address, pids: number[]): Promise<YieldOperationViem[]>;
  batchCompound(operations: CompoundOperationViem[]): Promise<YieldOperationViem[]>;

  // Vault management
  depositToVault(userAddress: Address, vaultAddress: Address, amount: string): Promise<YieldOperationViem>;
  withdrawFromVault(userAddress: Address, vaultAddress: Address, shares: string): Promise<YieldOperationViem>;
  getVaultInfo(vaultAddress: Address): Promise<AutoCompoundVaultViem>;

  // Performance tracking
  getCompoundHistory(userAddress: Address, pid: number, limit?: number): Promise<CompoundRecordViem[]>;
  getCompoundPerformance(userAddress: Address, pid: number): Promise<CompoundPerformanceViem>;
  calculateCompoundBenefits(position: YieldPositionViem, days: number): Promise<CompoundBenefitViem>;

  // Auto-compounding settings
  getUserAutoCompoundSettings(userAddress: Address): Promise<AutoCompoundSettingsViem>;
  updateUserSettings(userAddress: Address, settings: Partial<AutoCompoundSettingsViem>): Promise<void>;

  // Gas optimization
  optimizeGasCosts(operations: CompoundOperationViem[]): Promise<GasOptimizationResultViem>;
  scheduleOptimalCompound(userAddress: Address, pid: number): Promise<ScheduledCompoundViem>;

  // Analytics
  getAutoCompoundStats(): Promise<AutoCompoundStatsViem>;
  compareStrategies(pid: number, days: number): Promise<StrategyComparisonViem>;
}

export interface CompoundOperationViem {
  id: string;
  userAddress: Address;
  pid: number;
  timestamp: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  strategy: CompoundStrategyViem;
  amount: string;
  gasEstimate?: string;
  transactionHash?: Address;
}