/**
 * BSC Liquidity Types (Viem)
 * Type definitions for liquidity services using Viem
 */

import { Address, Hex } from 'viem';

/**
 * Liquidity Request (Viem)
 */
export interface LiquidityRequestViem {
  tokenA: Address;
  tokenB: Address;
  amountA: string;
  amountB?: string;
  slippageToleranceBps?: number; // Basis points (0.01% = 1 bps)
  deadlineMinutes?: number;
  recipient: Address;
  isETH?: boolean;
  type: 'add' | 'remove';
}

/**
 * Liquidity Options (Viem)
 */
export interface LiquidityOptionsViem {
  slippageToleranceBps: number;
  deadlineMinutes: number;
  autoApprove: boolean;
  approveGasLimit: string;
  autoStake: boolean;
  maxPriceImpact: number;
  requireVerification: boolean;
}

/**
 * Token Information (Viem)
 */
export interface TokenInfoViem {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  priceUSD: number;
}

/**
 * Reserves Change (Viem)
 */
export interface ReservesChangeViem {
  reserve0Change: string;
  reserve1Change: string;
  priceChange: number;
}

/**
 * Gas Estimate (Viem)
 */
export interface GasEstimateViem {
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedCostBNB: string;
  estimatedCostUSD: number;
}

/**
 * Liquidity Quote (Viem)
 */
export interface LiquidityQuoteViem {
  tokenA: TokenInfoViem;
  tokenB: TokenInfoViem;
  amountA: string;
  amountB: string;
  isETH: boolean;
  amountBOut: string;
  liquidityOut: string;
  shareOfPool: number;
  priceImpact: number;
  reservesChange: ReservesChangeViem;
  gasEstimate: GasEstimateViem;
  deadline: number;
  validUntil: number;
  warnings: LiquidityWarningViem[];
  riskLevel: LiquidityRiskLevelViem;
}

/**
 * Liquidity Operation (Viem)
 */
export interface LiquidityOperationViem {
  id: Hex;
  type: 'add' | 'remove';
  userAddress: Address;
  poolAddress: Address;
  farmId?: string;
  amountA: string;
  amountB: string;
  amountETH?: string;
  liquidity: string;
  valueUSD: number;
  slippage: number;
  transactionHash: Hex;
  blockNumber: number;
  timestamp: number;
  gasUsed: string;
  gasCostUSD: number;
  status: 'pending' | 'confirmed' | 'failed' | 'reverted';
  confirmations: number;
}

/**
 * Pool Information (Viem)
 */
export interface PoolInfoViem {
  id: string;
  address: Address;
  token0: TokenInfoViem;
  token1: TokenInfoViem;
  pairAddress: Address;
  isStable: boolean;
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  liquidity: string;
  apr: number;
  volume24h: string;
  volume7d: string;
  price0: number;
  price1: number;
  priceUSD: number;
  fee: number;
  feeTier: string;
  createdAt: number;
  updatedAt: number;
  version: 'v2' | 'v3';
}

/**
 * Liquidity Position (Viem)
 */
export interface LiquidityPositionViem {
  id: string;
  userAddress: Address;
  poolAddress: Address;
  poolId: string;
  pool: PoolInfoViem;
  liquidityAmount: string;
  liquidityUSD: number;
  shareOfPool: number;
  amount0: string;
  amount1: string;
  valueUSD: number;
  unrealizedPnL: number;
  impermanentLoss: number;
  feesEarned: string;
  rewardsEarned: string;
  apr: number;
  totalReturn: number;
  totalReturnUSD: number;
  createdAt: number;
  updatedAt: number;
  duration: number;
  isActive: boolean;
  isStaked: boolean;
  isFarm: boolean;
}

/**
 * Farm Information (Viem)
 */
export interface FarmInfoViem {
  id: string;
  poolId: number;
  lpToken: Address;
  allocPoint: number;
  lastRewardBlock: number;
  accCakePerShare: string;
  cakePerBlock: string;
  multiplier: string;
  totalDeposit: string;
}

/**
 * LP Token Information (Viem)
 */
export interface LPTokenInfoViem extends TokenInfoViem {
  poolAddress: Address;
  totalSupply: string;
  reserve0: string;
  reserve1: string;
  apr: number;
  volume24h: string;
  tvlUSD: number;
  holdersCount: number;
}

/**
 * Impermanent Loss Calculation (Viem)
 */
export interface ImpermanentLossCalculationViem {
  currentRatio: number;
  initialRatio: number;
  priceChangePercent: number;
  impermanentLossPercent: number;
  hodlValue: number;
  liquidityValue: number;
  lossAmount: number;
}

/**
 * APR Calculation (Viem)
 */
export interface APRCalculationViem {
  baseAPR: number;
  tradingFeeAPR: number;
  rewardAPR: number;
  totalAPR: number;
  timeframe: '24h' | '7d' | '30d' | '1y';
  lastUpdated: number;
}

/**
 * Liquidity Metrics (Viem)
 */
export interface LiquidityMetricsViem {
  totalLiquidity: string;
  totalPositions: number;
  averageAPR: number;
  totalFees: string;
  volume24h: string;
  activePositions: number;
  tvlUSD: number;
  impermanentLossAverage: number;
  timeframe: string;
  timestamp: number;
}

/**
 * Liquidity Warning (Viem)
 */
export enum LiquidityWarningViem {
  HIGH_PRICE_IMPACT = 'HIGH_PRICE_IMPACT',
  LOW_LIQUIDITY = 'LOW_LIQUIDITY',
  HIGH_SLIPPAGE = 'HIGH_SLIPPAGE',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
  DEADLINE_EXPIRED = 'DEADLINE_EXPIRED',
  POOL_NOT_FOUND = 'POOL_NOT_FOUND',
  IMPERMANENT_LOSS_RISK = 'IMPERMANENT_LOSS_RISK'
}

/**
 * Liquidity Risk Level (Viem)
 */
export enum LiquidityRiskLevelViem {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

/**
 * Liquidity Error (Viem)
 */
export interface LiquidityErrorViem extends Error {
  code: LiquidityErrorCodeViem;
  details?: any;
}

/**
 * Liquidity Error Code (Viem)
 */
export enum LiquidityErrorCodeViem {
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  SLIPPAGE_TOO_HIGH = 'SLIPPAGE_TOO_HIGH',
  POOL_NOT_FOUND = 'POOL_NOT_FOUND',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  DEADLINE_EXPIRED = 'DEADLINE_EXPIRED',
  APPROVAL_FAILED = 'APPROVAL_FAILED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_TOKEN = 'INVALID_TOKEN',
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  PRICE_IMPACT_TOO_HIGH = 'PRICE_IMPACT_TOO_HIGH'
}

/**
 * Liquidity Pool Configuration (Viem)
 */
export interface LiquidityPoolConfigViem {
  address: Address;
  token0: Address;
  token1: Address;
  fee: number;
  tickSpacing: number;
  maxLiquidityPerTick: string;
}

/**
 * Liquidity Event (Viem)
 */
export interface LiquidityEventViem {
  type: 'mint' | 'burn' | 'swap' | 'collect';
  transactionHash: Hex;
  blockNumber: number;
  timestamp: number;
  owner: Address;
  amount0?: string;
  amount1?: string;
  liquidity?: string;
  tickLower?: number;
  tickUpper?: number;
  price0?: number;
  price1?: number;
}

/**
 * Liquidity Analytics (Viem)
 */
export interface LiquidityAnalyticsViem {
  period: string;
  volume: string;
  fees: string;
  revenue: string;
  activeLiquidity: string;
  tvl: string;
  apr: number;
  positions: number;
  impermanentLoss: number;
  gasUsage: {
    average: string;
    total: string;
    count: number;
  };
}

/**
 * Batch Liquidity Operation (Viem)
 */
export interface BatchLiquidityOperationViem {
  id: string;
  operations: LiquidityRequestViem[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results?: LiquidityOperationViem[];
  errors?: string[];
  totalGasUsed: string;
  totalValueUSD: number;
  createdAt: number;
  completedAt?: number;
}