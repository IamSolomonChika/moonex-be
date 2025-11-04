/**
 * BSC Token Discovery Engine
 * Automatically discovers and analyzes new tokens on BSC
 */

import { ethers } from 'ethers';
import logger from '../../../utils/logger.js';
import type { BSCToken, TokenFilter, TokenEvent } from './types.js';
import { IBSCTokenService } from './token-service.js';
import { TokenMetadataService } from './metadata-service.js';
import { BSCProviderManager } from '../../utils/ethers-provider.js';
import { PancakeSwapSubgraphClient } from '../pancakeswap/subgraph-client.js';
import { PancakeSwapAPIClient } from '../pancakeswap/api-client.js';
import { BSCCacheManager } from '../cache/cache-manager.js';
import { BSCEventMonitor } from '../event-monitoring.js';

/**
 * Configuration for token discovery
 */
export interface TokenDiscoveryConfig {
  // Discovery sources
  enablePancakeSwapDiscovery: boolean;
  enableEventBasedDiscovery: boolean;
  enableContractAnalysis: boolean;

  // Discovery intervals
  pancakeSwapSyncInterval: number; // milliseconds
  eventScanInterval: number; // milliseconds
  contractAnalysisInterval: number; // milliseconds

  // Filtering criteria
  minLiquidityUSD: number;
  minVolumeUSD: number;
  minHoldersCount: number;
  maxContractAge: number; // days
  excludeBlacklisted: boolean;

  // Rate limiting
  maxNewTokensPerBatch: number;
  discoveryThrottleRate: number; // tokens per minute

  // Verification settings
  autoVerification: boolean;
  requiredVerificationSources: number;
  minVerificationConfidence: number;

  // Cache settings
  cacheDiscoveryResults: boolean;
  cacheTTL: number; // milliseconds
}

/**
 * Token discovery event types
 */
export interface TokenDiscoveryEvent {
  type: 'new_token_discovered' | 'token_verified' | 'token_blacklisted' | 'discovery_batch_completed';
  tokenAddress: string;
  data: any;
  timestamp: number;
  metadata?: {
    source: string;
    confidence: number;
    batchId?: string;
  };
}

/**
 * Token discovery sources
 */
export enum DiscoverySource {
  PANCAKESWAP_SUBGRAPH = 'pancakeswap_subgraph',
  PANCAKESWAP_API = 'pancakeswap_api',
  EVENT_MONITORING = 'event_monitoring',
  CONTRACT_ANALYSIS = 'contract_analysis',
  USER_SUBMISSION = 'user_submission',
  EXTERNAL_API = 'external_api'
}

/**
 * Token Discovery Engine Implementation
 */
export class TokenDiscoveryEngine {
  private config: TokenDiscoveryConfig;
  private tokenService: IBSCTokenService;
  private metadataService: TokenMetadataService;
  private provider: BSCProviderManager;
  private subgraphClient: PancakeSwapSubgraphClient;
  private apiClient: PancakeSwapAPIClient;
  private cache: BSCCacheManager;
  private eventMonitor: BSCEventMonitor;

  private isRunning: boolean = false;
  private discoveryIntervals: NodeJS.Timeout[] = [];
  private eventCallbacks: Set<(event: TokenDiscoveryEvent) => void> = new Set();
  private lastDiscoveryTimestamp: number = 0;
  private discoveredTokens: Set<string> = new Set();
  private blacklistedTokens: Set<string> = new Set();

  constructor(
    tokenService: IBSCTokenService,
    config?: Partial<TokenDiscoveryConfig>
  ) {
    this.tokenService = tokenService;
    this.metadataService = new TokenMetadataService();
    this.provider = new BSCProviderManager();
    this.subgraphClient = new PancakeSwapSubgraphClient();
    this.apiClient = new PancakeSwapAPIClient();
    this.cache = new BSCCacheManager();
    this.eventMonitor = new BSCEventMonitor();

    this.config = {
      enablePancakeSwapDiscovery: true,
      enableEventBasedDiscovery: true,
      enableContractAnalysis: true,
      pancakeSwapSyncInterval: 60000, // 1 minute
      eventScanInterval: 30000, // 30 seconds
      contractAnalysisInterval: 300000, // 5 minutes
      minLiquidityUSD: 1000,
      minVolumeUSD: 100,
      minHoldersCount: 10,
      maxContractAge: 30, // days
      excludeBlacklisted: true,
      maxNewTokensPerBatch: 50,
      discoveryThrottleRate: 10, // tokens per minute
      autoVerification: true,
      requiredVerificationSources: 2,
      minVerificationConfidence: 70,
      cacheDiscoveryResults: true,
      cacheTTL: 300000, // 5 minutes
      ...config
    };
  }

  /**
   * Start the discovery engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    logger.info({ config: this.config }, 'Starting token discovery engine');

    try {
      // Initialize blacklisted tokens
      await this.loadBlacklistedTokens();

      // Start discovery processes
      if (this.config.enablePancakeSwapDiscovery) {
        this.startPancakeSwapDiscovery();
      }

      if (this.config.enableEventBasedDiscovery) {
        this.startEventBasedDiscovery();
      }

      if (this.config.enableContractAnalysis) {
        this.startContractAnalysis();
      }

      this.isRunning = true;
      logger.info('Token discovery engine started successfully');

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to start token discovery engine');
      throw error;
    }
  }

  /**
   * Stop the discovery engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping token discovery engine');

    // Clear all intervals
    this.discoveryIntervals.forEach(interval => clearInterval(interval));
    this.discoveryIntervals = [];

    // Clear event callbacks
    this.eventCallbacks.clear();

    this.isRunning = false;
    logger.info('Token discovery engine stopped');
  }

  /**
   * Discover tokens from PancakeSwap
   */
  async discoverFromPancakeSwap(): Promise<BSCToken[]> {
    logger.debug('Discovering tokens from PancakeSwap');

    try {
      // Fetch tokens from PancakeSwap Subgraph
      const subgraphTokens = await this.subgraphClient.getAllTokens();

      // Fetch tokens from PancakeSwap API as fallback
      const apiTokens = await this.apiClient.getTokens();

      // Combine and deduplicate tokens
      const allTokens = this.deduplicateTokens([...subgraphTokens, ...apiTokens]);

      // Filter tokens based on criteria
      const filteredTokens = this.filterTokens(allTokens);

      // Process new tokens
      const newTokens = await this.processNewTokens(filteredTokens, DiscoverySource.PANCAKESWAP_SUBGRAPH);

      logger.info({
        total: allTokens.length,
        filtered: filteredTokens.length,
        new: newTokens.length
      }, 'PancakeSwap discovery completed');

      return newTokens;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'PancakeSwap discovery failed');
      return [];
    }
  }

  /**
   * Discover tokens from blockchain events
   */
  async discoverFromEvents(): Promise<BSCToken[]> {
    logger.debug('Discovering tokens from blockchain events');

    try {
      const newTokens: BSCToken[] = [];
      const currentBlock = await this.provider.getProvider().getBlockNumber();
      const fromBlock = currentBlock - 100; // Look at last 100 blocks

      // Monitor for PairCreated events (new liquidity pools)
      await this.eventMonitor.startMonitoring({
        contractAddress: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', // PancakeSwap Factory
        eventTopics: [
          '0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9', // PairCreated signature
        ],
        fromBlock,
        toBlock: 'latest',
      });

      // Get historical events instead of real-time monitoring for discovery
      const historicalEvents = await this.eventMonitor.getHistoricalEvents({
        contractAddress: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', // PancakeSwap Factory
        eventTopics: [
          '0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9', // PairCreated signature
        ],
        fromBlock,
        toBlock: 'latest',
      });

      for (const event of historicalEvents) {
        try {
          const token = await this.processPairCreatedEvent(event);
          if (token) {
            newTokens.push(token);
          }
        } catch (error) {
          logger.error({ event: JSON.stringify(event), error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to process PairCreated event');
        }
      }

      logger.info({ newTokensCount: newTokens.length }, 'Event-based discovery completed');
      return newTokens;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Event-based discovery failed');
      return [];
    }
  }

  /**
   * Discover tokens from contract analysis
   */
  async discoverFromContractAnalysis(): Promise<BSCToken[]> {
    logger.debug('Discovering tokens from contract analysis');

    try {
      // This would scan recent transactions for new token contracts
      // For now, return empty array as placeholder
      logger.info('Contract analysis discovery not yet implemented');
      return [];

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Contract analysis discovery failed');
      return [];
    }
  }

  /**
   * Manual token discovery for specific address
   */
  async discoverToken(address: string): Promise<BSCToken | null> {
    logger.debug({ address }, 'Manual token discovery');

    try {
      // Check if already discovered
      if (this.discoveredTokens.has(address.toLowerCase())) {
        const existingToken = await this.tokenService.getTokenByAddress(address);
        return existingToken;
      }

      // Check if blacklisted
      if (this.config.excludeBlacklisted && this.blacklistedTokens.has(address.toLowerCase())) {
        logger.warn({ address }, 'Token is blacklisted');
        return null;
      }

      // Validate contract
      const isValid = await this.metadataService.validateTokenContract(address);
      if (!isValid) {
        logger.warn({ address }, 'Invalid token contract');
        return null;
      }

      // Enrich metadata
      const enrichedToken = await this.metadataService.enrichTokenMetadata(address);

      // Apply filtering
      if (!this.passesFilter(enrichedToken)) {
        logger.info({ address, symbol: enrichedToken.symbol }, 'Token did not pass filter criteria');
        return null;
      }

      // Verify token if auto-verification is enabled
      if (this.config.autoVerification) {
        enrichedToken.verificationStatus = await this.tokenService.verifyToken(address);
      }

      // Add to discovered tokens
      this.discoveredTokens.add(address.toLowerCase());

      // Emit discovery event
      this.emitDiscoveryEvent({
        type: 'new_token_discovered',
        tokenAddress: address,
        data: enrichedToken,
        timestamp: Date.now(),
        metadata: {
          source: DiscoverySource.USER_SUBMISSION,
          confidence: enrichedToken.verificationStatus.confidence
        }
      });

      logger.info({ address, symbol: enrichedToken.symbol }, 'Token discovered manually');
      return enrichedToken;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Manual token discovery failed');
      return null;
    }
  }

  /**
   * Subscribe to discovery events
   */
  subscribeToDiscoveryEvents(callback: (event: TokenDiscoveryEvent) => void): void {
    this.eventCallbacks.add(callback);
    logger.debug({ callbackCount: this.eventCallbacks.size }, 'Subscribed to discovery events');
  }

  /**
   * Unsubscribe from discovery events
   */
  unsubscribeFromDiscoveryEvents(callback: (event: TokenDiscoveryEvent) => void): void {
    this.eventCallbacks.delete(callback);
    logger.debug({ callbackCount: this.eventCallbacks.size }, 'Unsubscribed from discovery events');
  }

  /**
   * Get discovery statistics
   */
  getDiscoveryStats(): {
    totalDiscovered: number;
    blacklistedCount: number;
    lastDiscovery: number;
    isRunning: boolean;
  } {
    return {
      totalDiscovered: this.discoveredTokens.size,
      blacklistedCount: this.blacklistedTokens.size,
      lastDiscovery: this.lastDiscoveryTimestamp,
      isRunning: this.isRunning
    };
  }

  // Private helper methods

  private async loadBlacklistedTokens(): Promise<void> {
    try {
      // Load blacklisted tokens from cache or config
      const cacheKey = 'discovery:blacklisted_tokens';
      const cached = await this.cache.get<string[]>(cacheKey);

      if (cached) {
        this.blacklistedTokens = new Set(cached.map(addr => addr.toLowerCase()));
      }

      logger.info({ count: this.blacklistedTokens.size }, 'Loaded blacklisted tokens');

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to load blacklisted tokens');
    }
  }

  private startPancakeSwapDiscovery(): void {
    logger.debug('Starting PancakeSwap discovery');

    const interval = setInterval(async () => {
      try {
        await this.discoverFromPancakeSwap();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'PancakeSwap discovery interval failed');
      }
    }, this.config.pancakeSwapSyncInterval);

    this.discoveryIntervals.push(interval);
  }

  private startEventBasedDiscovery(): void {
    logger.debug('Starting event-based discovery');

    const interval = setInterval(async () => {
      try {
        await this.discoverFromEvents();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Event-based discovery interval failed');
      }
    }, this.config.eventScanInterval);

    this.discoveryIntervals.push(interval);
  }

  private startContractAnalysis(): void {
    logger.debug('Starting contract analysis discovery');

    const interval = setInterval(async () => {
      try {
        await this.discoverFromContractAnalysis();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Contract analysis discovery interval failed');
      }
    }, this.config.contractAnalysisInterval);

    this.discoveryIntervals.push(interval);
  }

  private deduplicateTokens(tokens: any[]): any[] {
    const seen = new Set<string>();
    return tokens.filter(token => {
      const address = token.address?.toLowerCase();
      if (!address || seen.has(address)) {
        return false;
      }
      seen.add(address);
      return true;
    });
  }

  private filterTokens(tokens: any[]): any[] {
    return tokens.filter(token => {
      // Check if blacklisted
      if (this.config.excludeBlacklisted &&
          this.blacklistedTokens.has(token.address?.toLowerCase())) {
        return false;
      }

      // Check liquidity threshold
      if (token.liquidityUSD && token.liquidityUSD < this.config.minLiquidityUSD) {
        return false;
      }

      // Check volume threshold
      if (token.volume24hUSD && token.volume24hUSD < this.config.minVolumeUSD) {
        return false;
      }

      // Check holders count
      if (token.holderCount && token.holderCount < this.config.minHoldersCount) {
        return false;
      }

      return true;
    });
  }

  private async processNewTokens(tokens: any[], source: DiscoverySource): Promise<BSCToken[]> {
    const newTokens: BSCToken[] = [];
    const batchSize = Math.min(tokens.length, this.config.maxNewTokensPerBatch);

    for (let i = 0; i < batchSize; i++) {
      const tokenData = tokens[i];
      const address = tokenData.address?.toLowerCase();

      if (!address || this.discoveredTokens.has(address)) {
        continue;
      }

      try {
        // Enrich token metadata
        const enrichedToken = await this.metadataService.enrichTokenMetadata(address);

        // Add PancakeSwap specific data
        if (tokenData.liquidityUSD || tokenData.volume24hUSD) {
          enrichedToken.pancakeswapData = {
            liquidityUSD: tokenData.liquidityUSD,
            volume24hUSD: tokenData.volume24hUSD,
            pairAddress: tokenData.pairAddress,
          };
        }

        // Verify token if required
        if (this.config.autoVerification) {
          enrichedToken.verificationStatus = await this.tokenService.verifyToken(address);
        }

        // Add to discovered tokens
        this.discoveredTokens.add(address);
        newTokens.push(enrichedToken);

        // Emit discovery event
        this.emitDiscoveryEvent({
          type: 'new_token_discovered',
          tokenAddress: address,
          data: enrichedToken,
          timestamp: Date.now(),
          metadata: {
            source,
            confidence: enrichedToken.verificationStatus.confidence
          }
        });

        // Throttle discovery
        if (i > 0 && i % this.config.discoveryThrottleRate === 0) {
          await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute delay
        }

      } catch (error) {
        logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to process new token');
      }
    }

    // Emit batch completion event
    this.emitDiscoveryEvent({
      type: 'discovery_batch_completed',
      tokenAddress: '',
      data: {
        source,
        processedCount: tokens.length,
        newTokensCount: newTokens.length,
        batchId: `batch_${Date.now()}`
      },
      timestamp: Date.now()
    });

    this.lastDiscoveryTimestamp = Date.now();
    return newTokens;
  }

  private async processPairCreatedEvent(event: any): Promise<BSCToken | null> {
    try {
      // Extract token addresses from PairCreated event
      const token0Address = event.args?.token0;
      const token1Address = event.args?.token1;

      if (!token0Address || !token1Address) {
        return null;
      }

      // Process each token (skip WBNB as it's well-known)
      const tokenAddresses = [token0Address, token1Address]
        .filter(addr => addr.toLowerCase() !== '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'); // WBNB

      for (const address of tokenAddresses) {
        if (!this.discoveredTokens.has(address.toLowerCase())) {
          return await this.discoverToken(address);
        }
      }

      return null;

    } catch (error) {
      logger.error({ event: JSON.stringify(event), error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to process PairCreated event');
      return null;
    }
  }

  private passesFilter(token: BSCToken): boolean {
    // Check liquidity
    if (token.pancakeswapData?.liquidityUSD &&
        token.pancakeswapData.liquidityUSD < this.config.minLiquidityUSD) {
      return false;
    }

    // Check volume
    if (token.pancakeswapData?.volume24hUSD &&
        token.pancakeswapData.volume24hUSD < this.config.minVolumeUSD) {
      return false;
    }

    // Check verification confidence
    if (this.config.autoVerification &&
        token.verificationStatus.confidence < this.config.minVerificationConfidence) {
      return false;
    }

    return true;
  }

  private emitDiscoveryEvent(event: TokenDiscoveryEvent): void {
    this.eventCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        logger.error({ event: JSON.stringify(event), error: error instanceof Error ? error.message : 'Unknown error' }, 'Error in discovery event callback');
      }
    });
  }
}