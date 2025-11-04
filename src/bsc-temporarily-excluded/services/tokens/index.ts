/**
 * BSC Token Services Module
 * Exports all token-related services and types
 */

// Types and interfaces
export type {
  BSCToken,
  TokenFilter,
  TokenListResponse,
  TokenPriceData,
  TokenLiquidityData,
  TokenVerificationStatus,
  TokenValidationResult,
  TokenMetrics,
  TokenDiscoveryConfig,
  TokenEvent,
  TokenCategory,
  TokenRiskLevel,
  TokenTag,
  TokenFlag,
  TokenSortField
} from './types.js';

// Services
export {
  IBSCTokenService,
  BSCTokenService,
  bscTokenService
} from './token-service.js';

export {
  ITokenMetadataService,
  TokenMetadataService,
  tokenMetadataService
} from './metadata-service.js';

export {
  TokenDiscoveryEngine,
  type TokenDiscoveryConfig as IDiscoveryConfig,
  type TokenDiscoveryEvent,
  DiscoverySource
} from './discovery-engine.js';

export {
  TokenVerificationService,
  tokenVerificationService,
  type VerificationConfig,
  type ContractAnalysisResult,
  type IVerificationProvider
} from './verification-service.js';

export {
  IPriceTracker,
  TokenPriceTracker,
  tokenPriceTracker,
  type PriceTrackingConfig,
  type PriceSubscription,
  type PriceHistoryPoint,
  type PriceAnalytics
} from './price-tracker.js';

// Utility functions
export const createTokenService = (config?: any) => new BSCTokenService(config);
export const createMetadataService = () => new TokenMetadataService();
export const createDiscoveryEngine = (tokenService: IBSCTokenService, config?: any) =>
  new TokenDiscoveryEngine(tokenService, config);
export const createVerificationService = (config?: any) => new TokenVerificationService(config);
export const createPriceTracker = (config?: any) => new TokenPriceTracker(config);

// Constants
export const BSC_CHAIN_ID = 56;
export const BSC_TESTNET_CHAIN_ID = 97;
export const PANCAKESWAP_FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
export const PANCAKESWAP_ROUTER = '0x10ed43c718714eb63d5aa57b78b54704e256024e';
export const WBNB_ADDRESS = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';

// Default configurations
export const DEFAULT_TOKEN_DISCOVERY_CONFIG = {
  enablePancakeSwapDiscovery: true,
  enableEventBasedDiscovery: true,
  enableContractAnalysis: true,
  pancakeSwapSyncInterval: 60000,
  eventScanInterval: 30000,
  contractAnalysisInterval: 300000,
  minLiquidityUSD: 1000,
  minVolumeUSD: 100,
  minHoldersCount: 10,
  maxContractAge: 30,
  excludeBlacklisted: true,
  maxNewTokensPerBatch: 50,
  discoveryThrottleRate: 10,
  autoVerification: true,
  requiredVerificationSources: 2,
  minVerificationConfidence: 70,
  cacheDiscoveryResults: true,
  cacheTTL: 300000
};

export const DEFAULT_VERIFICATION_CONFIG = {
  enabledProviders: ['pancakeswap', 'bscscan', 'coingecko', 'trustwallet'],
  minConfidenceThreshold: 60,
  requiredSources: 2,
  maxVerificationAge: 86400000,
  enableRiskAssessment: true,
  riskThresholds: {
    low: 20,
    medium: 40,
    high: 60,
    very_high: 80
  },
  cacheResults: true,
  cacheTTL: 3600000,
  enableContractAnalysis: true,
  enableBlacklistCheck: true,
  enableLiquidityCheck: true,
  enableTaxCheck: true
};

export const DEFAULT_PRICE_TRACKING_CONFIG = {
  priceUpdateInterval: 30000,
  liquidityUpdateInterval: 60000,
  volumeUpdateInterval: 300000,
  enableSubgraphPrices: true,
  enableAPISources: true,
  enableOnChainCalculations: true,
  cachePrices: true,
  cacheTTL: 60000,
  enableHistoricalData: true,
  enableRealTimeUpdates: true,
  maxSubscriptions: 1000,
  subscriptionTimeout: 300000,
  enableBlockBasedUpdates: true,
  confirmationBlocks: 1,
  maxPriceAge: 120000,
  batchSize: 50,
  maxConcurrentRequests: 10,
  enableRetryMechanism: true,
  maxRetries: 3
};