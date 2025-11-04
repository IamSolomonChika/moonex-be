/**
 * BSC Token Types and Interfaces
 * Defines comprehensive token data structures for BSC/PancakeSwap integration
 */

export interface BSCToken {
  // Basic token information
  address: string;
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
    pairAddress?: string;
    pairCount?: number;
  };

  // Price information
  priceUSD?: number;
  priceBNB?: number;
  lastPriceUpdate?: number;

  // Verification and safety
  verificationStatus: TokenVerificationStatus;
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

export interface TokenVerificationStatus {
  isVerified: boolean;
  sources: VerificationSource[];
  confidence: number; // 0-100
  warnings?: string[];
  flags?: TokenFlag[];
}

export interface VerificationSource {
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

export interface TokenPriceData {
  tokenAddress: string;
  priceUSD: number;
  priceBNB: number;
  priceChange24h: number;
  priceChange7d: number;
  priceChange30d: number;
  volume24hUSD: number;
  marketCapUSD: number;
  liquidityUSD: number;
  timestamp: number;
  blockNumber: number;
}

export interface TokenLiquidityData {
  tokenAddress: string;
  pairAddress: string;
  token0Reserve: string;
  token1Reserve: string;
  liquidityUSD: number;
  apr?: number;
  feeApr?: number;
  timestamp: number;
}

export interface TokenFilter {
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

export interface TokenListResponse {
  tokens: BSCToken[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface TokenDiscoveryConfig {
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
}

export interface TokenMetrics {
  totalTokens: number;
  verifiedTokens: number;
  listedTokens: number;
  categories: Record<TokenCategory, number>;
  totalMarketCapUSD: number;
  totalVolume24hUSD: number;
  totalLiquidityUSD: number;
  lastUpdated: number;
}

export interface TokenValidationResult {
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

export interface TokenEvent {
  type: 'price_update' | 'liquidity_change' | 'verification_update' | 'metadata_update';
  tokenAddress: string;
  data: any;
  timestamp: number;
  blockNumber?: number;
}