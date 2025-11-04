/**
 * BSC Yield Farming Types and Interfaces
 * Defines comprehensive yield farming data structures for PancakeSwap integration
 */

import { ethers } from 'ethers';

// PancakeSwap MasterChef V2 ABI (simplified for key functions)
export const MASTERCHEF_V2_ABI = [
  'function poolInfo(uint256) external view returns (address lpToken, uint256 allocPoint, uint256 lastRewardBlock, uint256 accCakePerShare)',
  'function userInfo(uint256, address) external view returns (uint256 amount, uint256 rewardDebt)',
  'function deposit(uint256 pid, uint256 amount) external',
  'function withdraw(uint256 pid, uint256 amount) external',
  'function pendingCake(uint256 pid, address) external view returns (uint256)',
  'function poolLength() external view returns (uint256)',
  'function updatePool(uint256 pid) external',
  'function massUpdatePools(uint256[] calldata pids) external',
  'function harvest(uint256 pid, address) external',
  'function withdrawAndHarvest(uint256 pid, uint256 amount) external',
  'function emergencyWithdraw(uint256 pid) external'
];

// PancakeSwap Syrup Pool ABI
export const SYRUP_POOL_ABI = [
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
  'function rewardsToken() view returns (address)'
];

// Auto-compounding vault ABI
export const AUTO_COMPOUND_VAULT_ABI = [
  'function deposit(uint256 _amount) external',
  'function withdraw(uint256 _amount) external',
  'function earn() external',
  'function balanceOf(address) view returns (uint256)',
  'function getPricePerFullShare() view returns (uint256)',
  'function getUserInfo(address) view returns (uint256 shares, uint256 lastDepositedTime, uint256 cakeAtLastUserAction)',
  'function withdrawAll() external',
  'function emergencyWithdraw() external'
];

export interface YieldFarm {
  // Farm identification
  id: string;
  pid: number;
  name: string;
  description: string;
  category: FarmCategory;
  version: 'v1' | 'v2' | 'v3';

  // Contract addresses
  lpToken: string;
  masterChef: string;
  rewardToken: string;

  // Token information
  token0: TokenInfo;
  token1: TokenInfo;
  rewardTokenInfo: TokenInfo;

  // Farm metrics
  allocPoint: number;
  totalAllocPoint: number;
  lastRewardBlock: number;
  accCakePerShare: string;
  cakePerBlock: string;

  // Performance metrics
  apr: number;
  apy: number;
  rewardApr: number;
  feeApr: number;
  multiplier: string;

  // Pool information
  totalLiquidity: string;
  totalLiquidityUSD: number;
  tvl: number;
  totalStaked: string;

  // User data
  userStaked?: string;
  userPendingRewards?: string;
  userRewardDebt?: string;
  userValueUSD?: number;

  // Status and flags
  isActive: boolean;
  isFinished: boolean;
  isStable: boolean;
  isHot: boolean;
  isCAKEPool: boolean;

  // Timing
  startBlock: number;
  endBlock?: number;
  bonusEndBlock?: number;

  // Metadata
  createdAt: number;
  updatedAt: number;
  logoURI?: string;
  project: string;
}

export interface SyrupPool {
  // Pool identification
  id: string;
  address: string;
  name: string;
  description: string;
  category: StakingCategory;

  // Token information
  stakingToken: TokenInfo;
  rewardToken: TokenInfo;

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

export interface AutoCompoundVault {
  // Vault identification
  id: string;
  address: string;
  name: string;
  description: string;
  strategy: CompoundStrategy;

  // Token information
  lpToken: TokenInfo;
  underlyingToken: TokenInfo;

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

export interface YieldPosition {
  // Position identification
  id: string;
  userAddress: string;
  farmId: string;
  poolId: string;

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
  farm?: YieldFarm;
  syrupPool?: SyrupPool;
  vault?: AutoCompoundVault;
}

export interface YieldOperation {
  // Operation details
  id: string;
  type: YieldOperationType;
  userAddress: string;
  farmId: string;
  poolId: string;

  // Amounts
  amount: string;
  valueUSD: number;
  rewards: string;
  fees: string;

  // Transaction details
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
  gasUsed: string;
  gasCostUSD: number;

  // Operation status
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;

  // Additional data
  metadata?: any;
}

export enum YieldOperationType {
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw',
  HARVEST = 'harvest',
  COMPOUND = 'compound',
  EMERGENCY_WITHDRAW = 'emergency_withdraw',
  MIGRATE = 'migrate',
  CLAIM = 'claim'
}

export interface YieldQuote {
  // Quote details
  farmId: string;
  poolId: string;
  action: YieldOperationType;

  // Amounts
  amount: string;
  valueUSD: number;
  expectedShares?: string;
  expectedRewards?: string;

  // Performance
  expectedAPR: number;
  expectedAPY: number;
  lockDuration?: number;
  earlyWithdrawalFee?: number;

  // Fees and costs
  depositFee: number;
  withdrawalFee: number;
  performanceFee: number;
  gasEstimate: {
    gasLimit: string;
    gasPrice: string;
    estimatedCostBNB: string;
    estimatedCostUSD: string;
  };

  // Timing
  executionTime: number;
  lockEndsAt?: number;

  // Risk assessment
  warnings: YieldWarning[];
  riskLevel: YieldRiskLevel;

  // Metadata
  timestamp: number;
  validUntil: number;
}

export interface FarmPerformance {
  // Farm identification
  farmId: string;
  period: string;

  // Performance metrics
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;

  // Yield breakdown
  farmRewards: number;
  tradingFees: number;
  compoundReturns: number;
  impermanentLoss: number;

  // Volume and liquidity
  totalVolume: string;
  averageLiquidity: number;
  liquidityUtilization: number;

  // User metrics
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  averagePositionSize: number;

  // Risk metrics
  concentrationRisk: number;
  smartContractRisk: number;
  tokenRisk: number;

  // Timestamps
  calculatedAt: number;
  periodStart: number;
  periodEnd: number;
}

export interface YieldStrategy {
  // Strategy identification
  id: string;
  name: string;
  description: string;
  category: StrategyCategory;

  // Strategy configuration
  farms: string[];
  allocations: { farmId: string; percentage: number }[];
  rebalanceFrequency: number;
  autoRebalance: boolean;

  // Performance metrics
  expectedAPR: number;
  expectedAPY: number;
  historicalReturn: number;
  volatility: number;

  // Risk metrics
  riskLevel: YieldRiskLevel;
  maxDrawdown: number;
  diversificationScore: number;

  // Strategy settings
  minInvestment: number;
  maxInvestment: number;
  managementFee: number;
  performanceFee: number;

  // Status and flags
  isActive: boolean;
  isPublic: boolean;
  requiresKYC: boolean;

  // Metadata
  createdAt: number;
  updatedAt: number;
  logoURI?: string;
  manager: string;
}

export interface YieldOptimization {
  // Optimization details
  userAddress: string;
  strategyId: string;

  // Current allocation
  currentAllocation: { farmId: string; amount: string; percentage: number }[];
  currentValueUSD: number;

  // Recommended allocation
  recommendedAllocation: { farmId: string; amount: string; percentage: number }[];
  expectedImprovement: number;

  // Optimization parameters
  riskTolerance: RiskTolerance;
  investmentHorizon: number;
  liquidityPreference: LiquidityPreference;

  // Execution plan
  actions: {
    type: YieldOperationType;
    farmId: string;
    amount: string;
    reason: string;
  }[];

  // Metadata
  calculatedAt: number;
  validFor: number;
  confidence: number;
}

export enum FarmCategory {
  STABLE = 'stable',
  VOLATILE = 'volatile',
  BLUECHIP = 'bluechip',
  DEFI = 'defi',
  GAMING = 'gaming',
  NFT = 'nft',
  LAUNCHPAD = 'launchpad',
  NEW = 'new',
  HOT = 'hot'
}

export enum StakingCategory {
  FLEXIBLE = 'flexible',
  LOCKED = 'locked',
  GOVERNANCE = 'governance',
  NFT = 'nft',
  LIQUIDITY_MINING = 'liquidity_mining',
  SINGLE_STAKING = 'single_staking'
}

export enum CompoundStrategy {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  AUTO = 'auto',
  MANUAL = 'manual',
  HYBRID = 'hybrid'
}

export enum StrategyCategory {
  CONSERVATIVE = 'conservative',
  BALANCED = 'balanced',
  AGGRESSIVE = 'aggressive',
  INCOME = 'income',
  GROWTH = 'growth',
  DEGEN = 'degen'
}

export enum YieldWarning {
  HIGH_VOLATILITY = 'high_volatility',
  LOW_LIQUIDITY = 'low_liquidity',
  CONTRACT_RISK = 'contract_risk',
  IMPERMANENT_LOSS = 'impermanent_loss',
  HIGH_GAS = 'high_gas',
  LONG_LOCK = 'long_lock',
  HIGH_FEES = 'high_fees',
  CONCENTRATION_RISK = 'concentration_risk',
  NEW_POOL = 'new_pool',
  UNVERIFIED = 'unverified'
}

export enum YieldRiskLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export enum RiskTolerance {
  CONSERVATIVE = 'conservative',
  MODERATE = 'moderate',
  AGGRESSIVE = 'aggressive',
  VERY_AGGRESSIVE = 'very_aggressive'
}

export enum LiquidityPreference {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  priceUSD?: number;
}

export interface YieldConfig {
  // Contract addresses
  masterChefV2: string;
  masterChefV1?: string;
  rewardToken: string;

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
  defaultRiskTolerance: RiskTolerance;
  defaultLiquidityPreference: LiquidityPreference;
  maxPositionsPerUser: number;
}

// Error types
export interface YieldError {
  code: YieldErrorCode;
  message: string;
  details?: any;
  retryable?: boolean;
  suggestedAction?: string;
}

export enum YieldErrorCode {
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_ALLOWANCE = 'INSUFFICIENT_ALLOWANCE',
  FARM_NOT_FOUND = 'FARM_NOT_FOUND',
  POOL_NOT_FOUND = 'POOL_NOT_FOUND',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  GAS_PRICE_TOO_HIGH = 'GAS_PRICE_TOO_HIGH',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  FARM_FINISHED = 'FARM_FINISHED',
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  LOCK_PERIOD_ACTIVE = 'LOCK_PERIOD_ACTIVE',
  EARLY_WITHDRAWAL_FEE = 'EARLY_WITHDRAWAL_FEE',
  APPROVAL_FAILED = 'APPROVAL_FAILED',
  DEPOSIT_FAILED = 'DEPOSIT_FAILED',
  WITHDRAWAL_FAILED = 'WITHDRAWAL_FAILED',
  HARVEST_FAILED = 'HARVEST_FAILED',
  COMPOUND_FAILED = 'COMPOUND_FAILED',
  STRATEGY_NOT_FOUND = 'STRATEGY_NOT_FOUND',
  INVALID_STRATEGY = 'INVALID_STRATEGY',
  OPTIMIZATION_FAILED = 'OPTIMIZATION_FAILED',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  POSITION_NOT_FOUND = 'POSITION_NOT_FOUND'
}

// Additional types for auto-compounding and yield optimization
export interface CompoundOperation {
  id: string;
  userAddress: string;
  pid: number;
  timestamp: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  strategy: CompoundStrategy;
  amount: string;
  gasEstimate?: string;
  transactionHash?: string;
}

export interface YieldStrategyManager {
  // Strategy management
  createStrategy(params: StrategyParams): Promise<YieldStrategy>;
  updateStrategy(strategyId: string, params: Partial<StrategyParams>): Promise<YieldStrategy>;
  deleteStrategy(strategyId: string): Promise<boolean>;

  // Strategy execution
  executeStrategy(strategyId: string, capital: number): Promise<StrategyExecution>;
  stopStrategy(strategyId: string): Promise<boolean>;

  // Performance tracking
  getStrategyPerformance(strategyId: string, period: string): Promise<StrategyPerformance>;
  compareStrategies(strategyIds: string[]): Promise<StrategyComparisonResult>;
}

export interface StrategyParams {
  name: string;
  description: string;
  category: StrategyCategory;
  riskTolerance: RiskTolerance;
  targetAPR: number;
  maxPositions: number;
  rebalanceFrequency: number;
  autoRebalance: boolean;
  allocationRules: AllocationRule[];
  riskLimits: RiskLimits;
  feeStructure: FeeStructure;
}

export interface AllocationRule {
  farmId: string;
  minPercentage: number;
  maxPercentage: number;
  rebalanceThreshold: number;
  priority: number;
}

export interface RiskLimits {
  maxPositionSize: number;
  maxConcentration: number;
  maxVolatility: number;
  stopLoss: number;
  takeProfit: number;
}

export interface FeeStructure {
  managementFee: number;
  performanceFee: number;
  depositFee: number;
  withdrawalFee: number;
}

export interface StrategyExecution {
  executionId: string;
  strategyId: string;
  capital: number;
  allocations: { farmId: string; amount: number; percentage: number }[];
  transactions: string[];
  status: 'pending' | 'executing' | 'completed' | 'failed';
  executedAt: number;
  completedAt?: number;
  fees: number;
}

export interface StrategyPerformance {
  strategyId: string;
  period: string;
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalFees: number;
  netReturn: number;
  benchmarkComparison: BenchmarkComparison;
}

export interface StrategyComparisonResult {
  strategies: Array<{
    strategy: YieldStrategy;
    performance: StrategyPerformance;
    ranking: number;
    score: number;
  }>;
  bestPerformer: string;
  recommendations: string[];
  riskAdjustedReturns: { [strategyId: string]: number };
}

export interface BenchmarkComparison {
  benchmark: string;
  strategyReturn: number;
  benchmarkReturn: number;
  alpha: number;
  beta: number;
  correlation: number;
  trackingError: number;
  informationRatio: number;
}