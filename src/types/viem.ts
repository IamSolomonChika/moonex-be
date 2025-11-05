import {
  PublicClient,
  WalletClient,
  Address,
  Hash,
  BlockNumber,
  BlockTag,
  Chain,
  Transport
} from 'viem';
import { Abi } from 'viem';

/**
 * Viem-specific type definitions for BSC integration
 */

/**
 * Base Viem client types
 */
export type ViemClient = PublicClient;
export type ViemWalletClient = WalletClient;
export type ViemContract = Contract<Abi>;

/**
 * BSC-specific types
 */
export type BSCAddress = Address;
export type BSCHash = Hash;
export type BSCBlockNumber = BlockNumber;
export type BSCBlockTag = BlockTag;

/**
 * Token types
 */
export interface BSCToken {
  address: BSCAddress;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  logoURI?: string;
}

export interface BSCTokenWithBalance extends BSCToken {
  balance: bigint;
  balanceUSD?: string;
  priceUSD?: string;
}

/**
 * Trading pair types
 */
export interface BSCTradingPair {
  address: BSCAddress;
  token0: BSCToken;
  token1: BSCToken;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
  fee: number;
  price0: string;
  price1: string;
  apr?: string;
  volume24h?: bigint;
  fees24h?: bigint;
}

/**
 * Liquidity position types
 */
export interface BSCLiquidityPosition {
  id: string;
  user: BSCAddress;
  pool: BSCTradingPair;
  amount0: bigint;
  amount1: bigint;
  lpTokens: bigint;
  valueUSD?: string;
  impermanentLoss?: string;
  feesEarned?: bigint;
}

/**
 * Transaction types
 */
export interface ViemTransaction {
  to: BSCAddress;
  data: `0x${string}`;
  value?: bigint;
  gas?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  nonce?: number;
}

export interface ViemTransactionResult {
  hash: BSCHash;
  blockNumber: BSCBlockNumber;
  blockHash: BSCHash;
  transactionIndex: number;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  status: 'success' | 'reverted';
}

/**
 * Event types
 */
export interface ViemEventFilter {
  address?: BSCAddress | BSCAddress[];
  topics?: Array<(string | string[] | null)>;
  fromBlock?: BSCBlockNumber | BSCBlockTag;
  toBlock?: BSCBlockNumber | BSCBlockTag;
}

export interface ViemEventLog {
  address: BSCAddress;
  topics: Array<string>;
  data: string;
  blockNumber: BSCBlockNumber;
  blockHash: BSCHash;
  transactionHash: BSCHash;
  transactionIndex: number;
  logIndex: number;
  removed: boolean;
}

/**
 * PancakeSwap contract types
 */

// PancakeSwap Router V2 ABI (simplified)
export const PANCAKESWAP_ROUTER_ABI = [
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'amountInMax', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapTokensForExactTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    name: 'getAmountsOut',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    name: 'getAmountsIn',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// PancakeSwap Pair ABI (simplified)
export const PANCAKESWAP_PAIR_ABI = [
  {
    inputs: [],
    name: 'getReserves',
    outputs: [
      { name: 'reserve0', type: 'uint112' },
      { name: 'reserve1', type: 'uint112' },
      { name: 'blockTimestampLast', type: 'uint32' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token0',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token1',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ERC20 Token ABI (simplified)
export const ERC20_ABI = [
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

/**
 * Contract interface types
 */
export type PancakeSwapRouter = Contract<typeof PANCAKESWAP_ROUTER_ABI>;
export type PancakeSwapPair = Contract<typeof PANCAKESWAP_PAIR_ABI>;
export type ERC20Contract = Contract<typeof ERC20_ABI>;

/**
 * BSC Contract Types
 */
export interface BSCContractTypes {
  PancakeSwapRouter: PancakeSwapRouter;
  PancakeSwapPair: PancakeSwapPair;
  ERC20: ERC20Contract;
}

/**
 * Utility types for contract interactions
 */
export interface ContractCallParams<T extends readonly unknown[]> {
  functionName: string;
  args?: T;
}

export interface ContractWriteParams<T extends readonly unknown[]> extends ContractCallParams<T> {
  account?: Address;
  gas?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

/**
 * Event filter types
 */
export interface TransferEventFilter extends ViemEventFilter {
  topics: [
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // Transfer event signature
    string | string[] | null | undefined,
    string | string[] | null | undefined
  ];
}

export interface SwapEventFilter extends ViemEventFilter {
  topics: [
    '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822', // Swap event signature
    string | string[] | null | undefined
  ];
}

/**
 * Gas estimation types
 */
export interface GasEstimate {
  gas: bigint;
  gasPrice: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  totalCost: bigint;
}

/**
 * Slippage protection types
 */
export interface SlippageProtection {
  amountOutMin: bigint;
  amountInMax: bigint;
  slippageTolerance: number; // in basis points (100 = 1%)
}

/**
 * Price calculation types
 */
export interface PriceQuote {
  amountIn: bigint;
  amountOut: bigint;
  priceImpact: number; // in basis points
  route: BSCAddress[];
  gasEstimate?: GasEstimate;
}

/**
 * Batch request types
 */
export interface BatchRequest {
  type: 'read' | 'write';
  contract: BSCAddress;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}

export interface BatchResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
}

/**
 * WebSocket event types
 */
export interface WebSocketSubscription {
  id: string;
  type: 'newBlocks' | 'logs' | 'pendingTransactions';
  filter?: ViemEventFilter;
  callback: (data: any) => void;
}

/**
 * Cache types
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Error types
 */
export interface ViemError extends Error {
  code?: number;
  data?: unknown;
  transaction?: ViemTransaction;
  receipt?: ViemTransactionResult;
}

export interface RpcError extends ViemError {
  code: number;
  message: string;
  data?: {
    code: number;
    message: string;
  };
}

export interface ContractError extends ViemError {
  contract: BSCAddress;
  functionName: string;
  args?: readonly unknown[];
}

/**
 * Performance monitoring types
 */
export interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  successRate: number;
  errorRate: number;
  cacheHitRate: number;
  gasUsageAverage: bigint;
}

/**
 * Configuration types
 */
export interface ViemConfig {
  chain: Chain;
  transport: Transport;
  pollingInterval?: number;
  batch?: {
    multicall?: boolean;
    batchSize?: number;
  };
}

export default {
  // ABIs
  PANCAKESWAP_ROUTER_ABI,
  PANCAKESWAP_PAIR_ABI,
  ERC20_ABI,
};