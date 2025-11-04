/**
 * BSC Token Types and Interfaces (Viem)
 * Defines comprehensive token data structures for BSC/PancakeSwap integration using Viem
 */

import { Address } from 'viem';

export interface BSCTokenViem {
  // Basic token information
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;

  // Token metadata
  logoURI?: string;
  description?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;

  // PancakeSwap integration data
  pancakeswapData?: {
    liquidityUSD?: number;
    volume24hUSD?: number;
    priceChange24h?: number;
    priceChange7d?: number;
    marketCapUSD?: number;
    circulatingSupply?: string;
    pairAddress?: Address;
    pairCount?: number;
  };

  // Price information
  priceUSD?: number;
  priceBNB?: number;
  lastPriceUpdate?: number;

  // Verification and safety
  verificationStatus: TokenVerificationStatusViem;
  safetyScore?: number;
  riskLevel?: TokenRiskLevel;
  tags?: TokenTag[];

  // Categories
  category?: TokenCategory;
  subcategory?: string;

  // Timestamps
  createdAt: number;
  updatedAt: number;
  discoveredAt: number;

  // Status
  isActive: boolean;
  isListed: boolean;
}

export interface TokenVerificationStatusViem {
  isVerified: boolean;
  sources: VerificationSourceViem[];
  confidence: number; // 0-100
  warnings?: string[];
  flags?: TokenFlag[];
}

export interface VerificationSourceViem {
  name: string;
  verified: boolean;
  lastChecked: number;
  url?: string;
}

export enum TokenFlag {
  SUSPICIOUS_CONTRACT = 'suspicious_contract',
  HIGH_TAX = 'high_tax',
  HONEYPOT_RISK = 'honeypot_risk',
  LOW_LIQUIDITY = 'low_liquidity',
  NEW_TOKEN = 'new_token',
  OWNERSHIP_NOT_RENOUNCED = 'ownership_not_renounced',
  MINTABLE = 'mintable',
  BLACKLISTED = 'blacklisted'
}

export enum TokenRiskLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export enum TokenCategory {
  CURRENCY = 'currency',
  DEFI = 'defi',
  GAMING = 'gaming',
  NFT = 'nft',
  MEME = 'meme',
  STABLECOIN = 'stablecoin',
  GOVERNANCE = 'governance',
  YIELD = 'yield',
  BRIDGE = 'bridge',
  LAYER2 = 'layer2',
  EXCHANGE = 'exchange',
  LENDING = 'lending',
  INSURANCE = 'insurance',
  ORACLE = 'oracle',
  STORAGE = 'storage',
  OTHER = 'other'
}

export enum TokenTag {
  TRENDING = 'trending',
  HOT = 'hot',
  NEW = 'new',
  VERIFIED = 'verified',
  STABLE = 'stable',
  FARMING = 'farming',
  STAKING = 'staking',
  AIRDROP = 'airdrop',
  COMMUNITY = 'community',
  AUDITED = 'audited',
  DOXXED = 'doxxed',
  LOW_RISK = 'low_risk',
  HIGH_YIELD = 'high_yield',
  BLUE_CHIP = 'blue_chip'
}

export interface TokenPriceDataViem {
  tokenAddress: Address;
  priceUSD: number;
  priceBNB: number;
  priceChange24h: number;
  priceChange7d: number;
  priceChange30d: number;
  volume24hUSD: number;
  marketCapUSD: number;
  liquidityUSD: number;
  timestamp: number;
  blockNumber: bigint;
}

export interface TokenLiquidityDataViem {
  tokenAddress: Address;
  pairAddress: Address;
  token0Reserve: string;
  token1Reserve: string;
  liquidityUSD: number;
  apr?: number;
  feeApr?: number;
  timestamp: number;
}

export interface TokenFilterViem {
  search?: string;
  category?: TokenCategory;
  tags?: TokenTag[];
  riskLevel?: TokenRiskLevel;
  minLiquidityUSD?: number;
  minVolume24h?: number;
  verified?: boolean;
  listed?: boolean;
  sortBy?: TokenSortField;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export enum TokenSortField {
  NAME = 'name',
  SYMBOL = 'symbol',
  PRICE_USD = 'priceUSD',
  MARKET_CAP = 'marketCapUSD',
  VOLUME_24H = 'volume24hUSD',
  LIQUIDITY = 'liquidityUSD',
  PRICE_CHANGE_24H = 'priceChange24h',
  CREATED_AT = 'createdAt',
  DISCOVERED_AT = 'discoveredAt'
}

export interface TokenListResponseViem {
  tokens: BSCTokenViem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface TokenDiscoveryConfigViem {
  // PancakeSwap integration
  pancakeswapEnabled: boolean;
  updateInterval: number; // milliseconds

  // Verification settings
  verificationSources: string[];
  autoVerification: boolean;
  riskAssessment: boolean;

  // Filtering criteria
  minLiquidityThreshold: number;
  minVolumeThreshold: number;
  excludeBlacklisted: boolean;

  // Cache settings
  cacheEnabled: boolean;
  cacheTTL: number; // milliseconds

  // Update settings
  realTimePriceUpdates: boolean;
  batchUpdates: boolean;
  batchSize: number;

  // Viem-specific settings
  multicallEnabled: boolean;
  multicallBatchSize: number;
}

export interface TokenMetricsViem {
  totalTokens: number;
  verifiedTokens: number;
  listedTokens: number;
  categories: Record<TokenCategory, number>;
  totalMarketCapUSD: number;
  totalVolume24hUSD: number;
  totalLiquidityUSD: number;
  lastUpdated: number;
}

export interface TokenValidationResultViem {
  isValid: boolean;
  score: number; // 0-100
  warnings: string[];
  errors: string[];
  recommendations: string[];
  verificationData: {
    contractExists: boolean;
    hasValidFunctions: boolean;
    isNotBlacklisted: boolean;
    hasSufficientLiquidity: boolean;
    hasNormalBuyTax: boolean;
    hasNormalSellTax: boolean;
  };
}

export interface TokenEventViem {
  type: 'price_update' | 'liquidity_change' | 'verification_update' | 'metadata_update';
  tokenAddress: Address;
  data: any;
  timestamp: number;
  blockNumber?: bigint;
}

// Viem-specific interfaces for token operations
export interface TokenBalanceViem {
  tokenAddress: Address;
  userAddress: Address;
  balance: string;
  formattedBalance: string;
  decimals: number;
  symbol: string;
  timestamp: number;
}

export interface TokenApprovalViem {
  tokenAddress: Address;
  ownerAddress: Address;
  spenderAddress: Address;
  amount: string;
  transactionHash: Address;
  blockNumber: bigint;
  timestamp: number;
}

export interface TokenTransferViem {
  tokenAddress: Address;
  fromAddress: Address;
  toAddress: Address;
  amount: string;
  formattedAmount: string;
  transactionHash: Address;
  blockNumber: bigint;
  timestamp: number;
}

export interface TokenInfoRequestViem {
  tokenAddress: Address;
  includeMetadata?: boolean;
  includePancakeSwapData?: boolean;
  includeVerification?: boolean;
}

export interface TokenPriceRequestViem {
  tokenAddress: Address;
  baseToken?: Address; // Default: WBNB
  includeHistory?: boolean;
  historyPeriod?: '24h' | '7d' | '30d';
}

export interface TokenBatchRequestViem {
  tokenAddresses: Address[];
  includePrices?: boolean;
  includeLiquidity?: boolean;
  includeVerification?: boolean;
}

export interface TokenTransactionRequestViem {
  tokenAddress: Address;
  userAddress: Address;
  privateKey: string;
  amount: string;
  toAddress: Address;
  gasLimit?: string;
  gasPrice?: string;
}

export interface TokenTransactionResultViem {
  transactionHash: Address;
  blockNumber: bigint;
  gasUsed: string;
  gasPrice: string;
  transactionFee: string;
  status: 'success' | 'failed';
  timestamp: number;
}

// Service interfaces
export interface IBSCTokenServiceViem {
  // Token discovery and listing
  discoverTokens(limit?: number): Promise<BSCTokenViem[]>;
  getAllTokens(filter?: TokenFilterViem): Promise<TokenListResponseViem>;
  getTokenByAddress(address: Address): Promise<BSCTokenViem | null>;
  searchTokens(query: string, limit?: number): Promise<BSCTokenViem[]>;

  // PancakeSwap token list management
  fetchPancakeSwapTokenList(): Promise<BSCTokenViem[]>;
  syncWithPancakeSwap(): Promise<void>;
  updateTokenPrices(): Promise<TokenPriceDataViem[]>;

  // Token verification and validation
  verifyToken(address: Address): Promise<TokenVerificationStatusViem>;
  validateToken(address: Address): Promise<TokenValidationResultViem>;
  assessTokenRisk(address: Address): Promise<number>;

  // Token metadata management
  enrichTokenMetadata(address: Address): Promise<BSCTokenViem>;
  updateTokenLogo(address: Address, logoURI: string): Promise<void>;
  categorizeToken(address: Address): Promise<void>;

  // Price tracking
  getTokenPrice(address: Address): Promise<TokenPriceDataViem | null>;
  getTokenPrices(addresses: Address[]): Promise<TokenPriceDataViem[]>;
  subscribeToPriceUpdates(address: Address, callback: (price: TokenPriceDataViem) => void): void;
  unsubscribeFromPriceUpdates(address: Address): void;

  // Liquidity data
  getTokenLiquidity(address: Address): Promise<TokenLiquidityDataViem | null>;
  getTopTokensByLiquidity(limit: number): Promise<BSCTokenViem[]>;
  getTopTokensByVolume(limit: number): Promise<BSCTokenViem[]>;

  // Analytics and metrics
  getTokenMetrics(): Promise<TokenMetricsViem>;
  getTokenAnalytics(address: Address, timeframe: string): Promise<any>;

  // Event handling
  subscribeToTokenEvents(callback: (event: TokenEventViem) => void): void;
  emitTokenEvent(event: TokenEventViem): void;

  // Cache management
  clearTokenCache(address?: Address): Promise<void>;
  warmupCache(): Promise<void>;

  // Service lifecycle
  start(config?: Partial<TokenDiscoveryConfigViem>): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<boolean>;

  // Viem-specific methods
  getTokenBalance(tokenAddress: Address, userAddress: Address): Promise<TokenBalanceViem>;
  getMultipleTokenBalances(tokenAddresses: Address[], userAddress: Address): Promise<TokenBalanceViem[]>;
  approveToken(tokenAddress: Address, spenderAddress: Address, amount: string, privateKey: string): Promise<TokenApprovalViem>;
  transferToken(request: TokenTransactionRequestViem): Promise<TokenTransactionResultViem>;
  batchTokenInfo(requests: TokenInfoRequestViem[]): Promise<BSCTokenViem[]>;
  batchTokenPrices(requests: TokenPriceRequestViem[]): Promise<TokenPriceDataViem[]>;
  getServiceStatus(): Promise<{ healthy: boolean; timestamp: number; details?: any }>;
}