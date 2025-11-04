/**
 * BSC Liquidity Management Types and Interfaces
 * Defines comprehensive liquidity management data structures for PancakeSwap integration
 */

import { ethers } from 'ethers';

// PancakeSwap MasterChef ABI (simplified for key functions)
export const MASTERCHEF_V2_ABI = [
  'function poolInfo(uint256) external view returns (address lpToken, uint256 allocPoint, uint256 lastRewardBlock, uint256 accCakePerShare)',
  'function userInfo(uint256, address) external view returns (uint256 amount, uint256 rewardDebt)',
  'function deposit(uint256 pid, uint256 amount) external',
  'function withdraw(uint256 pid, uint256 amount) external',
  'function pendingCake(uint256 pid, address) external view returns (uint256)',
  'function poolLength() external view returns (uint256)',
  'function updatePool(uint256 pid) external',
  'function massUpdatePools(uint256[] calldata pids) external'
];

// PancakeSwap Pair ABI (for liquidity operations)
export const PANCAKESWAP_PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address) external view returns (uint256)',
  'function allowance(address, address) external view returns (uint256)',
  'function approve(address, uint256) external returns (bool)',
  'function addLiquidity(uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) external returns (uint256 amountA, uint256 amountB, uint256 liquidity)',
  'function removeLiquidity(uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) external returns (uint256 amountA, uint256 amountB)',
  'function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data)',
  'function sync()',
  'function mint(address to) external returns (uint256 liquidity)',
  'function burn(address to) external returns (uint256 amount0, uint256 amount1)',
  'function skim(address to) external',
  'function initialize(address, address) external'
];

// PancakeSwap Router ABI (for liquidity operations)
export const PANCAKESWAP_ROUTER_LIQUIDITY_ABI = [
  'function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) external returns (uint256 amountA, uint256 amountB, uint256 liquidity)',
  'function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)',
  'function removeLiquidity(address tokenA, address tokenB, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) external returns (uint256 amountA, uint256 amountB)',
  'function removeLiquidityETH(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) external returns (uint256 amountToken, uint256 amountETH)',
  'function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) external pure returns (uint256 amountB)',
  'function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] amounts)',
  'function factory() external pure returns (address)',
  'function WETH() external pure returns (address)'
];

export interface LiquidityPool {
  // Pool identification
  id: string;
  address: string;
  token0: TokenInfo;
  token1: TokenInfo;
  pairAddress: string;
  isStable: boolean;

  // Liquidity information
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  liquidity: string;
  apr: number;
  volume24h: string;
  volume7d: string;

  // Price information
  price0: number;
  price1: number;
  priceUSD: number;

  // Fee information
  fee: number;
  feeTier: string;

  // User data
  userBalance?: string;
  userShare?: number;
  userValueUSD?: number;

  // Farm information (if applicable)
  farmInfo?: FarmInfo;

  // Metadata
  createdAt: number;
  updatedAt: number;
  version: 'v2' | 'v3';
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  priceUSD?: number;
}

export interface FarmInfo {
  id: string;
  masterChefAddress: string;
  poolId: number;
  allocPoint: number;
  lastRewardBlock: number;
  accCakePerShare: string;
  cakePerBlock: string;
  pendingCake: string;
  rewardDebt: string;
  apr: number;
  multiplier: string;
  totalAllocPoint: number;
  cakePriceUSD: number;
}

export interface LiquidityPosition {
  // Position identification
  id: string;
  userAddress: string;
  poolAddress: string;
  poolId: string;
  pool: LiquidityPool;
  farmId?: string;

  // Position amounts
  liquidityAmount: string;
  liquidityUSD: number;
  shareOfPool: number;
  amount0?: string;
  amount1?: string;
  valueUSD?: number;

  // Position performance
  unrealizedPnL: number;
  impermanentLoss: number;
  feesEarned: string;
  rewardsEarned: string;
  apr: number;
  totalReturn?: number;
  totalReturnUSD?: number;

  // Position timing
  createdAt: number;
  updatedAt: number;
  duration?: number;

  // Position status
  isActive: boolean;
  isStaked: boolean;
  isFarm?: boolean;
}

export interface LiquidityOperation {
  // Operation details
  id: string;
  type: 'add' | 'remove';
  userAddress: string;
  poolAddress: string;
  farmId?: string;

  // Amounts
  amount0: string;
  amount1: string;
  amountETH?: string;
  liquidity: string;
  valueUSD: number;

  // Slippage and pricing
  amount0Min?: string;
  amount1Min?: string;
  amountETHMin?: string;
  slippage: number;

  // Transaction details
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
  gasUsed: string;
  gasCostUSD: number;

  // Operation status
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
}

export interface LiquidityQuote {
  // Input parameters
  tokenA: TokenInfo;
  tokenB: TokenInfo;
  amountA: string;
  amountB?: string;
  isETH: boolean;

  // Calculated amounts
  amountBOut?: string;
  amountAOut?: string;
  liquidityOut: string;
  shareOfPool: number;

  // Price impact
  priceImpact: number;
  reservesChange: {
    reserve0Change: string;
    reserve1Change: string;
    priceChange: number;
  };

  // Fees and gas
  gasEstimate: {
    gasLimit: string;
    gasPrice: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    estimatedCostETH: string;
    estimatedCostUSD: string;
  };

  // Timing
  deadline: number;
  validUntil: number;

  // Risk assessment
  warnings: LiquidityWarning[];
  riskLevel: LiquidityRiskLevel;
}

export interface ImpermanentLossCalculation {
  // Initial state
  initialPrices: {
    price0: number;
    price1: number;
    ratio: number;
  };
  initialAmounts: {
    amount0: string;
    amount1: string;
    value0USD: number;
    value1USD: number;
    totalValueUSD: number;
  };

  // Current state
  currentPrices: {
    price0: number;
    price1: number;
    ratio: number;
  };
  currentAmounts: {
    amount0: string;
    amount1: string;
    value0USD: number;
    value1USD: number;
    totalValueUSD: number;
  };

  // Impermanent loss calculation
  impermanentLoss: number;
  impermanentLossUSD: number;
  impermanentLossPercentage: number;

  // Hold value comparison
  holdValueUSD: number;
  liquidityValueUSD: number;
  differenceUSD: number;
  differencePercentage: number;

  // Time metrics
  duration: number;
  annualizedIL: number;

  // Risk assessment
  riskLevel: LiquidityRiskLevel;
  recommendations: string[];
}

export interface LPPosition {
  // Basic position info
  id: string;
  userAddress: string;
  poolAddress: string;
  liquidity: string;
  shareOfPool: number;

  // Token amounts
  amount0: string;
  amount1: string;
  valueUSD: number;

  // Performance metrics
  impermanentLoss: number;
  feesEarned: string;
  rewardsEarned: string;
  totalValue: number;
  totalReturn: number;

  // Position timing
  createdAt: number;
  updatedAt: number;
  duration: number;

  // Position status
  isActive: boolean;
  isStaked: boolean;
  isFarm: boolean;
}

export interface PoolAnalytics {
  // Pool metrics
  poolAddress: string;
  token0: TokenInfo;
  token1: TokenInfo;

  // Liquidity metrics
  totalLiquidity: string;
  totalLiquidityUSD: number;
  liquidityChange24h: number;
  liquidityChange7d: number;

  // Volume metrics
  volume24h: string;
  volume7d: string;
  volume30d: string;
  volumeChange24h: number;
  volumeChange7d: number;

  // Fee metrics
  fees24h: string;
  fees7d: string;
  fees30d: string;
  apr: number;
  apy: number;

  // Price metrics
  price0: number;
  price1: number;
  priceChange24h: number;
  priceChange7d: number;

  // User metrics
  totalUsers: number;
  activeUsers24h: number;
  newUsers24h: number;

  // Farm metrics (if applicable)
  farmAPR?: number;
  stakedPercentage?: number;
  totalStaked?: string;

  // Timestamps
  timestamp: number;
  period: '24h' | '7d' | '30d';
}

export enum LiquidityWarning {
  LOW_LIQUIDITY = 'low_liquidity',
  HIGH_PRICE_IMPACT = 'high_price_impact',
  INSUFFICIENT_BALANCE = 'insufficient_balance',
  ALLOWANCE_REQUIRED = 'allowance_required',
  DEADLINE_EXPIRED = 'deadline_expired',
  SLIPPAGE_TOO_HIGH = 'slippage_too_high',
  POOL_RISK = 'pool_risk',
  IMPERMANENT_LOSS_RISK = 'impermanent_loss_risk',
  HIGH_GAS_PRICE = 'high_gas_price'
}

export enum LiquidityRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export interface LiquidityRequest {
  // Basic parameters
  tokenA: string;
  tokenB: string;
  amountA: string;
  amountB?: string;
  isETH: boolean;
  recipient: string;

  // Slippage and timing
  slippageTolerance: number; // basis points
  deadlineMinutes: number;

  // Options
  minAmountA?: string;
  minAmountB?: string;
  approveTokens?: boolean;
  useFarm?: boolean;
}

export interface LiquidityOptions {
  // Slippage configuration
  slippageTolerance: number; // basis points
  deadlineMinutes: number;

  // Gas optimization
  maxGasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasLimitMultiplier?: number;

  // Approval handling
  autoApprove: boolean;
  approveGasLimit?: string;

  // Farm integration
  autoStake: boolean;
  farmId?: string;

  // Risk management
  maxPriceImpact: number;
  requireVerification: boolean;
}

export interface LiquidityConfig {
  // Contract addresses
  routerAddress: string;
  factoryAddress: string;
  masterChefAddress?: string;

  // Gas configuration
  defaultGasLimit: {
    addLiquidity: number;
    removeLiquidity: number;
    approve: number;
    transfer?: number;
    transferFrom?: number;
  };

  // Slippage configuration
  defaultSlippage: number; // basis points
  maxSlippage: number; // basis points

  // Fee configuration
  defaultFee: number; // basis points

  // Risk thresholds
  maxPriceImpact: number;
  minLiquidityUSD: number;

  // Cache configuration
  cachePoolData: boolean;
  poolDataCacheTTL: number; // milliseconds

  // Analytics configuration
  enableAnalytics: boolean;
  analyticsRetentionDays: number;

  // LP Token management configuration
  approveUnlimited?: boolean;
  maxApprovalAmount?: string;
  cacheLPData?: boolean;
  lpDataCacheTTL?: number;
  enableStaking?: boolean;
  autoApprove?: boolean;
  slippageTolerance?: number;
}

// Event types for liquidity operations
export interface LiquidityEvent {
  type: 'liquidity_added' | 'liquidity_removed' | 'position_created' | 'position_closed' | 'farm_staked' | 'farm_unstaked';
  data: any;
  timestamp: number;
  userAddress?: string;
  poolAddress?: string;
  transactionHash?: string;
}

// Error types
export interface LiquidityError {
  code: LiquidityErrorCode;
  message: string;
  details?: any;
  retryable?: boolean;
  suggestedAction?: string;
}

export enum LiquidityErrorCode {
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_ALLOWANCE = 'INSUFFICIENT_ALLOWANCE',
  SLIPPAGE_TOO_HIGH = 'SLIPPAGE_TOO_HIGH',
  DEADLINE_EXPIRED = 'DEADLINE_EXPIRED',
  POOL_NOT_FOUND = 'POOL_NOT_FOUND',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  GAS_PRICE_TOO_HIGH = 'GAS_PRICE_TOO_HIGH',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  BALANCE_FETCH_FAILED = 'BALANCE_FETCH_FAILED',
  APPROVAL_FAILED = 'APPROVAL_FAILED',
  APPROVAL_CHECK_FAILED = 'APPROVAL_CHECK_FAILED',
  APPROVAL_REVOKE_FAILED = 'APPROVAL_REVOKE_FAILED',
  STAKING_FAILED = 'STAKING_FAILED',
  UNSTAKING_FAILED = 'UNSTAKING_FAILED',
  STAKING_INFO_FAILED = 'STAKING_INFO_FAILED',
  VALUE_CALCULATION_FAILED = 'VALUE_CALCULATION_FAILED',
  PORTFOLIO_FETCH_FAILED = 'PORTFOLIO_FETCH_FAILED'
}

// LP Token Management Types
export interface LPTokenBalance {
  // Basic info
  userAddress: string;
  poolAddress: string;
  balance: string;
  totalSupply: string;
  userShare: number;

  // Value calculation
  valueUSD: number;
  reserve0Share: string;
  reserve1Share: string;

  // LP token info
  lpToken: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
  };

  // Metadata
  lastUpdated: number;
}

export interface LPTokenApproval {
  // Approval details
  tokenAddress: string;
  spenderAddress: string;
  ownerAddress: string;
  amount: string;

  // Transaction details
  transaction: {
    to: string;
    data: string;
    value: string;
    gasLimit: number;
  };

  // Status
  status: 'none' | 'pending' | 'approved' | 'failed';
  timestamp: number;
}

export interface LPTokenStaking {
  // Staking details
  userAddress: string;
  poolAddress: string;
  farmId: string;
  amount: string; // Positive for stake, negative for unstake
  pendingRewards: string;
  rewardDebt: string;

  // Performance metrics
  apr: number;
  isStaked: boolean;
  stakingPeriod: number; // Duration in seconds
  lastRewardTime: number;

  // Transaction details
  transaction: {
    to: string;
    data: string;
    value: string;
    gasLimit: number;
  };

  // Status
  status: 'none' | 'pending' | 'active' | 'failed';
  timestamp: number;
}

export interface LPTokenOperation {
  // Operation details
  id: string;
  type: LPTokenOperationType;
  userAddress: string;
  poolAddress: string;
  amount: string;

  // Transaction details
  transactionHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  gasUsed: string;
  gasPrice: string;
  blockNumber: number;
}

export enum LPTokenOperationType {
  APPROVAL = 'approval',
  TRANSFER = 'transfer',
  STAKE = 'stake',
  UNSTAKE = 'unstake',
  CLAIM = 'claim',
  COMPOUND = 'compound'
}