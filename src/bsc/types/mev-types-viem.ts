/**
 * BSC MEV Protection Types (Viem)
 * Type definitions for MEV protection services using Viem
 */

import { Address, Hex } from 'viem';

/**
 * MEV Protection Configuration
 */
export interface MEVProtection {
  enabled: boolean;
  strategy: 'private_mempool' | 'flashbots' | 'hybrid' | 'delay_execution' | 'gas_auction' | 'commit_reveal';
  sandwichDetection: boolean;
  frontRunningDetection: boolean;
  usePrivateMempool: boolean;
  randomizeNonce: boolean;
  delayExecution: boolean;
  trackMEVActivity: boolean;
  alertOnMEVRisk: boolean;
}

/**
 * Swap Quote (Viem)
 */
export interface SwapQuoteViem {
  tokenIn: {
    address: Address;
    symbol: string;
    name: string;
    decimals: number;
  };
  tokenOut: {
    address: Address;
    symbol: string;
    name: string;
    decimals: number;
  };
  amountIn: string;
  amountOut: string;
  priceImpact: number;
  slippageTolerance: number;
  gasEstimate: {
    gasLimit: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    gasPrice?: string;
  };
  pools: Array<{
    address: Address;
    token0: Address;
    token1: Address;
    fee?: number;
    liquidity?: string;
    priceImpact?: number;
  }>;
  price?: {
    tokenInPriceUSD?: number;
    tokenOutPriceUSD?: number;
  };
  warnings: SwapWarning[];
  route?: Array<{
    from: Address;
    to: Address;
    percent: number;
  }>;
  validUntil: number;
}

/**
 * Swap Transaction (Viem)
 */
export interface SwapTransactionViem {
  hash: Hex;
  from: Address;
  to?: Address;
  value: string;
  data: Hex;
  gasLimit: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasPrice?: string;
  nonce?: number;
  status?: 'pending' | 'success' | 'failed';
  blockNumber?: number;
  timestamp?: number;
  gasUsed?: string;
  effectiveGasPrice?: string;
}

/**
 * Swap Warning
 */
export enum SwapWarning {
  HIGH_PRICE_IMPACT = 'HIGH_PRICE_IMPACT',
  LOW_LIQUIDITY = 'LOW_LIQUIDITY',
  SLIPPAGE_EXCEEDED = 'SLIPPAGE_EXCEEDED',
  MEV_RISK = 'MEV_RISK',
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
  DEADLINE_EXPIRED = 'DEADLINE_EXPIRED',
  GAS_ESTIMATION_FAILED = 'GAS_ESTIMATION_FAILED'
}

/**
 * Swap Risk Level
 */
export enum SwapRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Trading Error
 */
export interface TradingError extends Error {
  code: TradingErrorCode;
  details?: any;
}

/**
 * Trading Error Code
 */
export enum TradingErrorCode {
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  SLIPPAGE_EXCEEDED = 'SLIPPAGE_EXCEEDED',
  PRICE_IMPACT_TOO_HIGH = 'PRICE_IMPACT_TOO_HIGH',
  GAS_ESTIMATION_FAILED = 'GAS_ESTIMATION_FAILED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_TOKEN = 'INVALID_TOKEN',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
  DEADLINE_EXPIRED = 'DEADLINE_EXPIRED',
  MEV_DETECTED = 'MEV_DETECTED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  CONTRACT_ERROR = 'CONTRACT_ERROR'
}