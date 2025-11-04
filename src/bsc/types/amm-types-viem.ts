/**
 * BSC Trading Engine Types and Interfaces - Viem Implementation
 * Defines comprehensive trading data structures for PancakeSwap integration using Viem
 */

import { Address, Hex } from 'viem';

export interface SwapQuote {
  // Input/Output amounts
  amountIn: string;
  amountOut: string;
  amountOutMin: string; // With slippage
  amountInMax: string; // With slippage

  // Token information
  tokenIn: {
    address: Address;
    symbol: string;
    decimals: number;
  };
  tokenOut: {
    address: Address;
    symbol: string;
    decimals: number;
  };

  // Path and routing
  path: string[];
  route: SwapRoute[];

  // Fees and costs
  tradingFee: string;
  tradingFeePercentage: number;
  priceImpact: number;
  gasEstimate: {
    gasLimit: string;
    gasPrice: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    estimatedCostBNB: string;
    estimatedCostUSD: string;
  };

  // Timing and execution
  deadline: number;
  slippageTolerance: number;

  // Price information
  price: {
    tokenInPriceUSD: number;
    tokenOutPriceUSD: number;
    exchangeRate: number;
  };

  // Pool information
  pools: PoolInfo[];

  // Risk and warnings
  warnings: SwapWarning[];
  riskLevel: SwapRiskLevel;

  // Metadata
  timestamp: number;
  blockNumber: number;
  validUntil: number;
}

export interface SwapRoute {
  poolAddress: Address;
  tokenIn: string;
  tokenOut: string;
  fee: number;
  amountIn: string;
  amountOut: string;
  priceImpact: number;
  liquidity: string;
  protocol: 'v2' | 'v3';
  version: string;
}

export interface PoolInfo {
  address: Address;
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
  liquidity: string;
  fee: number;
  volume24h: string;
  apr?: number;
  price: number;
  priceUSD?: number;
}

export interface SwapTransaction {
  // Transaction details
  hash: Hex;
  from: Address;
  to: Address;
  data: Hex;
  value: string;
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  nonce: number;

  // Execution details
  blockNumber?: number;
  blockHash?: Hex;
  transactionIndex?: number;
  status: TransactionStatus;
  gasUsed?: string;
  effectiveGasPrice?: string;
  actualCostBNB?: string;
  actualCostUSD?: string;

  // Timing
  timestamp: number;
  confirmations: number;

  // Swap details
  swapDetails: SwapExecutionDetails;
}

export interface SwapExecutionDetails {
  quote: SwapQuote;
  actualAmountIn: string;
  actualAmountOut: string;
  actualSlippage: number;
  priceImpact: number;
  tradingFee: string;

  // Performance metrics
  executionTime: number;
  confirmationTime: number;
  priceChangeDuringExecution?: number;
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  REPLACED = 'replaced',
  CANCELLED = 'cancelled'
}

export enum SwapRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export enum SwapWarning {
  LOW_LIQUIDITY = 'low_liquidity',
  HIGH_PRICE_IMPACT = 'high_price_impact',
  INSUFFICIENT_LIQUIDITY = 'insufficient_liquidity',
  DEADLINE_EXPIRED = 'deadline_expired',
  SLIPPAGE_EXCEEDED = 'slippage_exceeded',
  GAS_PRICE_HIGH = 'gas_price_high',
  UNVERIFIED_POOL = 'unverified_pool',
  MEV_RISK = 'mev_risk',
  CONTRACT_RISK = 'contract_risk'
}

export interface SwapRequest {
  tokenIn: Address;
  tokenOut: Address;
  amountIn?: string;
  amountOut?: string;
  slippageTolerance: number; // in basis points (100 = 1%)
  deadline?: number;
  recipient: Address;

  // Advanced options
  enableMEVProtection?: boolean;
  preferDirectRoute?: boolean;
  maxHops?: number;
  gasPrice?: {
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    gasLimit?: string;
  };
}

export interface SwapOptions {
  // Slippage and deadline
  slippageTolerance: number; // basis points
  deadlineMinutes: number;

  // Gas optimization
  maxGasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasLimitMultiplier?: number;

  // Routing preferences
  maxHops?: number;
  preferDirectRoute?: boolean;
  excludeTokens?: Address[];

  // MEV protection
  enableMEVProtection?: boolean;
  privateMempool?: boolean;

  // Advanced options
  enablePartialFills?: boolean;
  minimumAmountOut?: string;
  maximumAmountIn?: string;
}

export interface LiquidityAnalysis {
  tokenAddress: Address;
  pairAddress?: Address;

  // Current state
  currentLiquidity: string;
  currentPrice: number;
  volume24h: string;

  // Depth analysis
  depth1Percent: string;
  depth5Percent: string;
  depth10Percent: string;

  // Price impact at different sizes
  priceImpact1k: number;
  priceImpact10k: number;
  priceImpact100k: number;
  priceImpact1m: number;

  // Recommendations
  optimalTradeSize: string;
  recommendedSlippage: number;

  // Risk indicators
  liquidityUtilization: number;
  isLiquidityConcentrated: boolean;
  liquidityRisk: SwapRiskLevel;
}

export interface TradingAnalytics {
  period: string;

  // Volume metrics
  totalVolume: string;
  tradeCount: number;
  averageTradeSize: string;

  // Performance metrics
  averagePriceImpact: number;
  averageSlippage: number;
  successRate: number;

  // Gas metrics
  averageGasUsed: string;
  averageGasCost: string;

  // Popular pairs
  topPairs: Array<{
    pairAddress: Address;
    token0: string;
    token1: string;
    volume: string;
    trades: number;
  }>;

  // Error analysis
  errorRates: Record<string, number>;
  failureReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
}

export interface TradingPair {
  address: Address;
  token0: {
    address: Address;
    symbol: string;
    decimals: number;
  };
  token1: {
    address: Address;
    symbol: string;
    decimals: number;
  };

  // Liquidity and pricing
  reserve0: string;
  reserve1: string;
  liquidity: string;
  price: number;
  priceUSD?: number;

  // Fees and rewards
  fee: number;
  apr?: number;

  // Volume and activity
  volume24h: string;
  volume7d: string;
  trades24h: number;

  // Analytics
  priceChange24h: number;
  priceChange7d: number;

  // Risk and quality
  isVerified: boolean;
  riskLevel: SwapRiskLevel;
  warnings: SwapWarning[];

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

// V3-specific interfaces
export interface V3PoolInfo extends PoolInfo {
  // V3-specific fields
  tick: number;
  tickSpacing: number;
  sqrtPriceX96: string;
  liquidity: string;
  fee: number;
  liquidityProviderCount?: number;

  // Concentrated liquidity info
  currentTick: number;
  nearestTickBelow?: number;
  nearestTickAbove?: number;
  tickLiquidityActive: string;
  tickLiquidityGross: string;

  // V3-specific calculations
  priceImpactProtection: boolean;
  concentratedLiquidityRisk: number;
}

export interface V3SwapParams {
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  recipient: Address;
  deadline: number;
  amountIn: string;
  amountOutMinimum: string;
  sqrtPriceLimitX96: string;
}

export interface V3SwapRoute extends SwapRoute {
  // V3-specific fields
  fee: number;
  tickSpacing: number;
  sqrtPriceX96: string;
  liquidity: string;
  tick: number;
}

export interface V3LiquidityDepth {
  // Price depth analysis for V3 pools
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  amount0: string;
  amount1: string;
  priceImpact: number;
}

export interface V3QuoteRequest extends QuoteRequest {
  // V3-specific options
  feeTiers?: number[];
  useV2Fallback?: boolean;
  preferV3?: boolean;
  maxTickDifference?: number;
}

export interface V3PoolState {
  // Current pool state
  sqrtPriceX96: string;
  tick: number;
  liquidity: string;
  fee: number;
  tickSpacing: number;

  // Active liquidity ticks
  tickBitmap: string;
  feeGrowthGlobal0X128: string;
  feeGrowthGlobal1X128: string;

  // Protocol fees
  feeProtocol: number;
  unlocked: boolean;

  // Observation data
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
}

export interface QuoteRequest {
  tokenIn: Address;
  tokenOut: Address;
  amountIn?: string;
  amountOut?: string;
  options?: Partial<SwapOptions>;
}

export interface QuoteResponse {
  quote: SwapQuote;
  isValid: boolean;
  warnings: string[];
  alternatives?: SwapQuote[]; // Alternative routes if better options exist
}

export interface TransactionQueue {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

  // Transaction details
  transaction: SwapTransaction;
  quote: SwapQuote;

  // Timing
  createdAt: number;
  updatedAt: number;
  priority: number;

  // Status tracking
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: number;

  // Error handling
  lastError?: string;
  errorHistory: Array<{
    timestamp: number;
    error: string;
  }>;
}

export interface MEVProtection {
  enabled: boolean;
  strategy: 'private_mempool' | 'flashbots' | 'hybrid';

  // Detection
  sandwichDetection: boolean;
  frontRunningDetection: boolean;

  // Prevention
  usePrivateMempool: boolean;
  randomizeNonce: boolean;
  delayExecution: boolean;

  // Monitoring
  trackMEVActivity: boolean;
  alertOnMEVRisk: boolean;
}

export interface GasOptimization {
  // BSC-specific gas settings
  gasPriceStrategy: 'eip1559' | 'legacy' | 'dynamic';

  // Dynamic pricing
  enableDynamicGas: boolean;
  gasPriceMultiplier: number;
  maxGasPriceGwei: number;

  // BSC optimizations
  bscFastLane: boolean;
  optimizeForFastBlocks: boolean;

  // Cost estimation
  estimateInBNB: boolean;
  estimateInUSD: boolean;
  bnbPriceUSD: number;

  // Gas limit optimization
  enableGasLimitOptimization: boolean;
  historicGasData: Map<string, number>;
}

export interface TradingMetrics {
  // Performance metrics
  averageExecutionTime: number;
  averageConfirmationTime: number;
  successRate: number;

  // Cost metrics
  averageGasCost: string;
  averageTradingCost: string;

  // Volume metrics
  totalVolume24h: string;
  totalTrades24h: number;
  averageTradeSize: string;

  // Risk metrics
  averageSlippage: number;
  averagePriceImpact: number;
  failedTransactions: number;

  // System health
  routerStatus: boolean;
  quoteCacheHitRate: number;
  averageResponseTime: number;
}

// Event types
export interface SwapEvent {
  type: 'swap_initiated' | 'swap_completed' | 'swap_failed' | 'quote_requested';
  data: any;
  timestamp: number;
  userId?: string;
  transactionHash?: Hex;
}

// Error types
export interface TradingErrorType {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
  suggestedAction?: string;
}

export enum TradingErrorCode {
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  SLIPPAGE_TOO_HIGH = 'SLIPPAGE_TOO_HIGH',
  DEADLINE_EXPIRED = 'DEADLINE_EXPIRED',
  GAS_PRICE_TOO_HIGH = 'GAS_PRICE_TOO_HIGH',
  INVALID_TOKEN = 'INVALID_TOKEN',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_ALLOWANCE = 'INSUFFICIENT_ALLOWANCE',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  ROUTING_ERROR = 'ROUTING_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  MEV_RISK_DETECTED = 'MEV_RISK_DETECTED'
}

// Custom error class for trading operations
export class TradingError extends Error {
  constructor(
    public code: TradingErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'TradingError';
  }
}