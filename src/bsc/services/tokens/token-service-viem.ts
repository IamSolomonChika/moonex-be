/**
 * BSC Token Service (Viem)
 * Comprehensive token management service for BSC/PancakeSwap integration using Viem
 */

import { createPublicClient, createWalletClient, http, formatUnits, parseUnits, Address, Hex } from 'viem';
import { bsc } from 'viem/chains';
import logger from '../../../utils/logger.js';
import type {
  BSCTokenViem,
  TokenFilterViem,
  TokenListResponseViem,
  TokenPriceDataViem,
  TokenLiquidityDataViem,
  TokenVerificationStatusViem,
  TokenValidationResultViem,
  TokenMetricsViem,
  TokenDiscoveryConfigViem,
  TokenEventViem,
  TokenBalanceViem,
  TokenApprovalViem,
  TokenTransferViem,
  TokenInfoRequestViem,
  TokenPriceRequestViem,
  TokenBatchRequestViem,
  TokenTransactionRequestViem,
  TokenTransactionResultViem,
  IBSCTokenServiceViem
} from '../../types/token-types-viem.js';
import { BSCCacheManager } from '../../cache/bsc-cache-manager.js';
import { BSCGasOptimizationServiceViem } from '../gas/bsc-gas-optimization-viem.js';

// ERC-20 ABI for Viem
const ERC20_ABI = [
  {
    inputs: [{ internalType: 'string', name: 'name_', type: 'string' }],
    stateMutability: 'nonpayable',
    type: 'constructor'
  },
  {
    inputs: [{ internalType: 'string', name: 'symbol_', type: 'string' }],
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'from', type: 'address' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'transferFrom',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

/**
 * BSC Token Service Implementation (Viem)
 * Comprehensive token management service for BSC/PancakeSwap using Viem
 */
export class BSCTokenServiceViem implements IBSCTokenServiceViem {
  private publicClient: any;
  private cache: BSCCacheManager;
  private gasOptimizationService: BSCGasOptimizationServiceViem;
  private config: TokenDiscoveryConfigViem;
  private isRunning: boolean = false;
  private priceUpdateSubscriptions: Map<Address, Set<(price: TokenPriceDataViem) => void>> = new Map();
  private tokenEventSubscriptions: Set<(event: TokenEventViem) => void> = new Set();
  private updateIntervals: NodeJS.Timeout[] = [];

  // PancakeSwap constants
  private readonly PANCAKESWAP_FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as Address;
  private readonly PANCAKESWAP_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as Address;
  private readonly WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address;
  private readonly BUSD = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address;

  constructor(config?: Partial<TokenDiscoveryConfigViem>) {
    this.config = {
      pancakeswapEnabled: true,
      updateInterval: 30000, // 30 seconds
      verificationSources: ['pancakeswap', 'coingecko', 'bscscan'],
      autoVerification: true,
      riskAssessment: true,
      minLiquidityThreshold: 1000, // $1,000
      minVolumeThreshold: 100, // $100
      excludeBlacklisted: true,
      cacheEnabled: true,
      cacheTTL: 60000, // 1 minute
      realTimePriceUpdates: true,
      batchUpdates: true,
      batchSize: 50,
      multicallEnabled: true,
      multicallBatchSize: 100,
      ...config
    };

    // Initialize Viem clients
    this.publicClient = createPublicClient({
      chain: bsc,
      transport: http()
    });

    this.cache = new BSCCacheManager('token-service');
    this.gasOptimizationService = new BSCGasOptimizationServiceViem();
  }

  /**
   * Start the token service
   */
  async start(config?: Partial<TokenDiscoveryConfigViem>): Promise<void> {
    if (this.isRunning) {
      return;
    }

    if (config) {
      this.config = { ...this.config, ...config };
    }

    logger.info({ config: this.config }, 'Starting BSC Token Service (Viem)');

    try {
      // Initialize PancakeSwap integration
      if (this.config.pancakeswapEnabled) {
        await this.initializePancakeSwapIntegration();
      }

      // Start periodic updates
      this.startPeriodicUpdates();

      // Initial data sync
      await this.performInitialSync();

      this.isRunning = true;
      logger.info('BSC Token Service (Viem) started successfully');

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to start BSC Token Service (Viem)');
      throw error;
    }
  }

  /**
   * Stop the token service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping BSC Token Service (Viem)');

    // Clear all intervals
    this.updateIntervals.forEach(interval => clearInterval(interval));
    this.updateIntervals = [];

    // Clear subscriptions
    this.priceUpdateSubscriptions.clear();
    this.tokenEventSubscriptions.clear();

    this.isRunning = false;
    logger.info('BSC Token Service (Viem) stopped');
  }

  /**
   * Discover new tokens from PancakeSwap
   */
  async discoverTokens(limit: number = 100): Promise<BSCTokenViem[]> {
    logger.debug({ limit }, 'Discovering new tokens (Viem)');

    try {
      const tokens = await this.fetchPancakeSwapTokenList();

      // Filter tokens based on configuration
      const filteredTokens = tokens.filter(token => {
        if (this.config.excludeBlacklisted && token.riskLevel === 'very_high') {
          return false;
        }
        if (token.pancakeswapData?.liquidityUSD &&
            token.pancakeswapData.liquidityUSD < this.config.minLiquidityThreshold) {
          return false;
        }
        if (token.pancakeswapData?.volume24hUSD &&
            token.pancakeswapData.volume24hUSD < this.config.minVolumeThreshold) {
          return false;
        }
        return true;
      });

      // Sort by discovery date and limit
      const discoveredTokens = filteredTokens
        .sort((a, b) => b.discoveredAt - a.discoveredAt)
        .slice(0, limit);

      logger.info({ discovered: discoveredTokens.length, total: tokens.length }, 'Token discovery completed (Viem)');

      // Emit discovery events
      discoveredTokens.forEach(token => {
        this.emitTokenEvent({
          type: 'metadata_update',
          tokenAddress: token.address,
          data: token,
          timestamp: Date.now()
        });
      });

      return discoveredTokens;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Token discovery failed (Viem)');
      throw error;
    }
  }

  /**
   * Get all tokens with filtering
   */
  async getAllTokens(filter?: TokenFilterViem): Promise<TokenListResponseViem> {
    logger.debug({ filter }, 'Getting all tokens (Viem)');

    try {
      // Check cache first
      const cacheKey = `all_tokens_${JSON.stringify(filter)}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as TokenListResponseViem;
      }

      // Implementation would query database/cache and apply filters
      // For now, return a placeholder response
      const tokens: BSCTokenViem[] = [];
      const total = tokens.length;

      const response = {
        tokens,
        total,
        limit: filter?.limit || 100,
        offset: filter?.offset || 0,
        hasMore: (filter?.offset || 0) + tokens.length < total
      };

      // Cache the result
      if (this.config.cacheEnabled) {
        await this.cache.set(cacheKey, response, this.config.cacheTTL);
      }

      return response;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get all tokens (Viem)');
      throw error;
    }
  }

  /**
   * Get token by address
   */
  async getTokenByAddress(address: Address): Promise<BSCTokenViem | null> {
    logger.debug({ address }, 'Getting token by address (Viem)');

    try {
      // Check cache first
      const cacheKey = `token_${address}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as BSCTokenViem;
      }

      // Get token info from blockchain
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'symbol'
        }) as Promise<string>,
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'name'
        }) as Promise<string>,
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'decimals'
        }) as Promise<number>,
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'totalSupply'
        }) as Promise<bigint>
      ]);

      const token: BSCTokenViem = {
        address,
        name,
        symbol,
        decimals,
        totalSupply: totalSupply.toString(),
        verificationStatus: {
          isVerified: false,
          sources: [],
          confidence: 0,
          warnings: ['Basic verification only'],
          flags: []
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        discoveredAt: Date.now(),
        isActive: true,
        isListed: false
      };

      // Cache the result
      if (this.config.cacheEnabled) {
        await this.cache.set(cacheKey, token, this.config.cacheTTL);
      }

      return token;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get token by address (Viem)');
      return null;
    }
  }

  /**
   * Search tokens by query
   */
  async searchTokens(query: string, limit: number = 20): Promise<BSCTokenViem[]> {
    logger.debug({ query, limit }, 'Searching tokens (Viem)');

    try {
      // Implementation would perform search across database
      // For now, return empty array as placeholder
      return [];

    } catch (error) {
      logger.error({ query, error: error instanceof Error ? error.message : 'Unknown error' }, 'Token search failed (Viem)');
      throw error;
    }
  }

  /**
   * Fetch token list from PancakeSwap
   */
  async fetchPancakeSwapTokenList(): Promise<BSCTokenViem[]> {
    logger.debug('Fetching PancakeSwap token list (Viem)');

    try {
      // Implementation would use PancakeSwap Subgraph/API
      // For now, return empty array as placeholder
      return [];

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch PancakeSwap token list (Viem)');
      throw error;
    }
  }

  /**
   * Sync with PancakeSwap data
   */
  async syncWithPancakeSwap(): Promise<void> {
    logger.debug('Syncing with PancakeSwap (Viem)');

    try {
      const tokens = await this.fetchPancakeSwapTokenList();

      // Process and update tokens
      for (const token of tokens) {
        await this.processTokenUpdate(token);
      }

      logger.info({ tokenCount: tokens.length }, 'PancakeSwap sync completed (Viem)');

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'PancakeSwap sync failed (Viem)');
      throw error;
    }
  }

  /**
   * Update token prices
   */
  async updateTokenPrices(): Promise<TokenPriceDataViem[]> {
    logger.debug('Updating token prices (Viem)');

    try {
      // Implementation would fetch latest prices from PancakeSwap
      // For now, return empty array as placeholder
      return [];

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to update token prices (Viem)');
      throw error;
    }
  }

  /**
   * Verify token contract
   */
  async verifyToken(address: Address): Promise<TokenVerificationStatusViem> {
    logger.debug({ address }, 'Verifying token (Viem)');

    try {
      // Implementation would perform multi-source verification
      // For now, return basic verification status
      return {
        isVerified: false,
        sources: [],
        confidence: 0,
        warnings: ['Verification not implemented'],
        flags: []
      };

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Token verification failed (Viem)');
      throw error;
    }
  }

  /**
   * Validate token contract
   */
  async validateToken(address: Address): Promise<TokenValidationResultViem> {
    logger.debug({ address }, 'Validating token (Viem)');

    try {
      // Check if contract exists and has valid functions
      const [name, symbol, decimals] = await Promise.all([
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'name'
        }).catch(() => null),
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'symbol'
        }).catch(() => null),
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'decimals'
        }).catch(() => null)
      ]);

      const contractExists = !!(name && symbol && decimals !== null);

      // Implementation would perform comprehensive validation
      // For now, return basic validation result
      return {
        isValid: contractExists,
        score: contractExists ? 50 : 0,
        warnings: contractExists ? [] : ['Contract validation failed'],
        errors: contractExists ? [] : ['Invalid contract'],
        recommendations: contractExists ? ['Proceed with caution'] : ['Avoid this token'],
        verificationData: {
          contractExists,
          hasValidFunctions: contractExists,
          isNotBlacklisted: true, // Would check against blacklist
          hasSufficientLiquidity: false, // Would check liquidity
          hasNormalBuyTax: true, // Would check buy tax
          hasNormalSellTax: true // Would check sell tax
        }
      };

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Token validation failed (Viem)');
      throw error;
    }
  }

  /**
   * Assess token risk
   */
  async assessTokenRisk(address: Address): Promise<number> {
    logger.debug({ address }, 'Assessing token risk (Viem)');

    try {
      // Implementation would perform risk assessment
      // For now, return neutral risk score
      return 50;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Risk assessment failed (Viem)');
      throw error;
    }
  }

  /**
   * Enrich token metadata
   */
  async enrichTokenMetadata(address: Address): Promise<BSCTokenViem> {
    logger.debug({ address }, 'Enriching token metadata (Viem)');

    try {
      // Implementation would fetch and enrich metadata
      // For now, throw not implemented error
      throw new Error('Token metadata enrichment not implemented');

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Metadata enrichment failed (Viem)');
      throw error;
    }
  }

  /**
   * Update token logo
   */
  async updateTokenLogo(address: Address, logoURI: string): Promise<void> {
    logger.debug({ address, logoURI }, 'Updating token logo (Viem)');

    try {
      // Implementation would update token logo
      // For now, do nothing as placeholder
    } catch (error) {
      logger.error({ address, logoURI, error: error instanceof Error ? error.message : 'Unknown error' }, 'Logo update failed (Viem)');
      throw error;
    }
  }

  /**
   * Categorize token
   */
  async categorizeToken(address: Address): Promise<void> {
    logger.debug({ address }, 'Categorizing token (Viem)');

    try {
      // Implementation would categorize token
      // For now, do nothing as placeholder
    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Token categorization failed (Viem)');
      throw error;
    }
  }

  /**
   * Get token price
   */
  async getTokenPrice(address: Address): Promise<TokenPriceDataViem | null> {
    logger.debug({ address }, 'Getting token price (Viem)');

    try {
      // Implementation would fetch token price
      // For now, return null as placeholder
      return null;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get token price (Viem)');
      throw error;
    }
  }

  /**
   * Get multiple token prices
   */
  async getTokenPrices(addresses: Address[]): Promise<TokenPriceDataViem[]> {
    logger.debug({ addresses }, 'Getting token prices (Viem)');

    try {
      // Implementation would fetch multiple token prices
      // For now, return empty array as placeholder
      return [];

    } catch (error) {
      logger.error({ addresses, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get token prices (Viem)');
      throw error;
    }
  }

  /**
   * Subscribe to price updates
   */
  subscribeToPriceUpdates(address: Address, callback: (price: TokenPriceDataViem) => void): void {
    if (!this.priceUpdateSubscriptions.has(address)) {
      this.priceUpdateSubscriptions.set(address, new Set());
    }
    this.priceUpdateSubscriptions.get(address)!.add(callback);
    logger.debug({ address, subscriberCount: this.priceUpdateSubscriptions.get(address)!.size }, 'Subscribed to price updates (Viem)');
  }

  /**
   * Unsubscribe from price updates
   */
  unsubscribeFromPriceUpdates(address: Address): void {
    this.priceUpdateSubscriptions.delete(address);
    logger.debug({ address }, 'Unsubscribed from price updates (Viem)');
  }

  /**
   * Get token liquidity
   */
  async getTokenLiquidity(address: Address): Promise<TokenLiquidityDataViem | null> {
    logger.debug({ address }, 'Getting token liquidity (Viem)');

    try {
      // Implementation would fetch token liquidity
      // For now, return null as placeholder
      return null;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get token liquidity (Viem)');
      throw error;
    }
  }

  /**
   * Get top tokens by liquidity
   */
  async getTopTokensByLiquidity(limit: number): Promise<BSCTokenViem[]> {
    logger.debug({ limit }, 'Getting top tokens by liquidity (Viem)');

    try {
      // Implementation would fetch top tokens by liquidity
      // For now, return empty array as placeholder
      return [];

    } catch (error) {
      logger.error({ limit, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get top tokens by liquidity (Viem)');
      throw error;
    }
  }

  /**
   * Get top tokens by volume
   */
  async getTopTokensByVolume(limit: number): Promise<BSCTokenViem[]> {
    logger.debug({ limit }, 'Getting top tokens by volume (Viem)');

    try {
      // Implementation would fetch top tokens by volume
      // For now, return empty array as placeholder
      return [];

    } catch (error) {
      logger.error({ limit, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get top tokens by volume (Viem)');
      throw error;
    }
  }

  /**
   * Get token metrics
   */
  async getTokenMetrics(): Promise<TokenMetricsViem> {
    logger.debug('Getting token metrics (Viem)');

    try {
      // Implementation would calculate and return metrics
      // For now, return empty metrics as placeholder
      return {
        totalTokens: 0,
        verifiedTokens: 0,
        listedTokens: 0,
        categories: {} as any,
        totalMarketCapUSD: 0,
        totalVolume24hUSD: 0,
        totalLiquidityUSD: 0,
        lastUpdated: Date.now()
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get token metrics (Viem)');
      throw error;
    }
  }

  /**
   * Get token analytics
   */
  async getTokenAnalytics(address: Address, timeframe: string): Promise<any> {
    logger.debug({ address, timeframe }, 'Getting token analytics (Viem)');

    try {
      // Implementation would return analytics data
      // For now, return empty object as placeholder
      return {};

    } catch (error) {
      logger.error({ address, timeframe, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get token analytics (Viem)');
      throw error;
    }
  }

  /**
   * Subscribe to token events
   */
  subscribeToTokenEvents(callback: (event: TokenEventViem) => void): void {
    this.tokenEventSubscriptions.add(callback);
    logger.debug({ subscriberCount: this.tokenEventSubscriptions.size }, 'Subscribed to token events (Viem)');
  }

  /**
   * Emit token event
   */
  emitTokenEvent(event: TokenEventViem): void {
    this.tokenEventSubscriptions.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        logger.error({ event: JSON.stringify(event), error: error instanceof Error ? error.message : 'Unknown error' }, 'Error in token event callback (Viem)');
      }
    });
  }

  /**
   * Clear token cache
   */
  async clearTokenCache(address?: Address): Promise<void> {
    logger.debug({ address }, 'Clearing token cache (Viem)');

    try {
      if (address) {
        await this.cache.delete(`token_${address}`);
        await this.cache.delete(`token_balance_${address}`);
        await this.cache.delete(`token_price_${address}`);
      } else {
        await this.cache.clear();
      }
    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to clear token cache (Viem)');
      throw error;
    }
  }

  /**
   * Warm up cache
   */
  async warmupCache(): Promise<void> {
    logger.debug('Warming up token cache (Viem)');

    try {
      // Implementation would warm up cache with popular tokens
      // For now, do nothing as placeholder
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to warm up token cache (Viem)');
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if we can read from blockchain
      await this.publicClient.getBlockNumber();
      return true;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Health check failed (Viem)');
      return false;
    }
  }

  /**
   * Get token balance
   */
  async getTokenBalance(tokenAddress: Address, userAddress: Address): Promise<TokenBalanceViem> {
    logger.debug({ tokenAddress, userAddress }, 'Getting token balance (Viem)');

    try {
      const cacheKey = `token_balance_${tokenAddress}_${userAddress}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached as TokenBalanceViem;
      }

      const [balance, decimals, symbol] = await Promise.all([
        this.publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [userAddress]
        }) as Promise<bigint>,
        this.publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'decimals'
        }) as Promise<number>,
        this.publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'symbol'
        }) as Promise<string>
      ]);

      const tokenBalance: TokenBalanceViem = {
        tokenAddress,
        userAddress,
        balance: balance.toString(),
        formattedBalance: formatUnits(balance, decimals),
        decimals,
        symbol,
        timestamp: Date.now()
      };

      // Cache the result
      if (this.config.cacheEnabled) {
        await this.cache.set(cacheKey, tokenBalance, this.config.cacheTTL / 2); // Shorter cache for balances
      }

      return tokenBalance;

    } catch (error) {
      logger.error({ tokenAddress, userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get token balance (Viem)');
      throw error;
    }
  }

  /**
   * Get multiple token balances
   */
  async getMultipleTokenBalances(tokenAddresses: Address[], userAddress: Address): Promise<TokenBalanceViem[]> {
    logger.debug({ tokenAddresses, userAddress }, 'Getting multiple token balances (Viem)');

    try {
      if (!this.config.multicallEnabled) {
        // Fallback to individual calls
        return Promise.all(
          tokenAddresses.map(address => this.getTokenBalance(address, userAddress))
        );
      }

      // Use multicall for efficiency
      const promises = tokenAddresses.map(async (tokenAddress) => {
        try {
          return await this.getTokenBalance(tokenAddress, userAddress);
        } catch (error) {
          logger.warn({ tokenAddress, userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get individual token balance (Viem)');
          return null;
        }
      });

      const results = await Promise.all(promises);
      return results.filter((balance): balance is TokenBalanceViem => balance !== null);

    } catch (error) {
      logger.error({ tokenAddresses, userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get multiple token balances (Viem)');
      throw error;
    }
  }

  /**
   * Approve token spending
   */
  async approveToken(tokenAddress: Address, spenderAddress: Address, amount: string, privateKey: string): Promise<TokenApprovalViem> {
    logger.debug({ tokenAddress, spenderAddress, amount }, 'Approving token (Viem)');

    try {
      const walletClient = createWalletClient({
        chain: bsc,
        transport: http(),
        account: privateKey as Hex
      });

      const decimals = await this.publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'decimals'
      }) as Promise<number>;

      const parsedAmount = parseUnits(amount, decimals);

      // Get gas recommendation
      const gasRecommendation = await this.gasOptimizationService.getGasRecommendation({
        type: 'token_approval',
        priority: 'medium',
        tokenAddress
      });

      const transaction = await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spenderAddress, parsedAmount],
        gas: BigInt(gasRecommendation.gasLimit),
        gasPrice: BigInt(gasRecommendation.gasPrice)
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: transaction });

      const approval: TokenApprovalViem = {
        tokenAddress,
        ownerAddress: walletClient.account.address,
        spenderAddress,
        amount,
        transactionHash: transaction,
        blockNumber: receipt.blockNumber,
        timestamp: Date.now()
      };

      return approval;

    } catch (error) {
      logger.error({ tokenAddress, spenderAddress, amount, error: error instanceof Error ? error.message : 'Unknown error' }, 'Token approval failed (Viem)');
      throw error;
    }
  }

  /**
   * Transfer tokens
   */
  async transferToken(request: TokenTransactionRequestViem): Promise<TokenTransactionResultViem> {
    logger.debug({ tokenAddress: request.tokenAddress, toAddress: request.toAddress, amount: request.amount }, 'Transferring token (Viem)');

    try {
      const walletClient = createWalletClient({
        chain: bsc,
        transport: http(),
        account: request.privateKey as Hex
      });

      const decimals = await this.publicClient.readContract({
        address: request.tokenAddress,
        abi: ERC20_ABI,
        functionName: 'decimals'
      }) as Promise<number>;

      const parsedAmount = parseUnits(request.amount, decimals);

      // Get gas recommendation
      const gasRecommendation = await this.gasOptimizationService.getGasRecommendation({
        type: 'token_transfer',
        priority: 'medium',
        tokenAddress: request.tokenAddress
      });

      const transaction = await walletClient.writeContract({
        address: request.tokenAddress,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [request.toAddress, parsedAmount],
        gas: BigInt(gasRecommendation.gasLimit),
        gasPrice: BigInt(gasRecommendation.gasPrice)
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: transaction });

      const result: TokenTransactionResultViem = {
        transactionHash: transaction,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: gasRecommendation.gasPrice,
        transactionFee: (receipt.gasUsed * BigInt(gasRecommendation.gasPrice)).toString(),
        status: receipt.status === 'success' ? 'success' : 'failed',
        timestamp: Date.now()
      };

      return result;

    } catch (error) {
      logger.error({ request, error: error instanceof Error ? error.message : 'Unknown error' }, 'Token transfer failed (Viem)');
      throw error;
    }
  }

  /**
   * Batch token info retrieval
   */
  async batchTokenInfo(requests: TokenInfoRequestViem[]): Promise<BSCTokenViem[]> {
    logger.debug({ requestCount: requests.length }, 'Getting batch token info (Viem)');

    try {
      const tokens = await Promise.all(
        requests.map(request => this.getTokenByAddress(request.tokenAddress))
      );

      return tokens.filter((token): token is BSCTokenViem => token !== null);

    } catch (error) {
      logger.error({ requestCount: requests.length, error: error instanceof Error ? error.message : 'Unknown error' }, 'Batch token info failed (Viem)');
      throw error;
    }
  }

  /**
   * Batch token prices
   */
  async batchTokenPrices(requests: TokenPriceRequestViem[]): Promise<TokenPriceDataViem[]> {
    logger.debug({ requestCount: requests.length }, 'Getting batch token prices (Viem)');

    try {
      const addresses = requests.map(req => req.tokenAddress);
      return await this.getTokenPrices(addresses);

    } catch (error) {
      logger.error({ requestCount: requests.length, error: error instanceof Error ? error.message : 'Unknown error' }, 'Batch token prices failed (Viem)');
      throw error;
    }
  }

  /**
   * Get service status
   */
  async getServiceStatus(): Promise<{ healthy: boolean; timestamp: number; details?: any }> {
    const healthCheck = await this.healthCheck();

    return {
      healthy: healthCheck,
      timestamp: Date.now(),
      details: {
        isRunning: this.isRunning,
        subscriptions: {
          priceUpdates: this.priceUpdateSubscriptions.size,
          tokenEvents: this.tokenEventSubscriptions.size
        },
        config: this.config
      }
    };
  }

  // Private helper methods

  private async initializePancakeSwapIntegration(): Promise<void> {
    // Initialize PancakeSwap clients
    logger.debug('Initializing PancakeSwap integration (Viem)');
  }

  private startPeriodicUpdates(): void {
    logger.debug('Starting periodic updates (Viem)');

    // Price updates
    if (this.config.realTimePriceUpdates) {
      const priceInterval = setInterval(async () => {
        try {
          await this.updateTokenPrices();
        } catch (error) {
          logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Periodic price update failed (Viem)');
        }
      }, this.config.updateInterval);

      this.updateIntervals.push(priceInterval);
    }

    // PancakeSwap sync
    const syncInterval = setInterval(async () => {
      try {
        await this.syncWithPancakeSwap();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Periodic PancakeSwap sync failed (Viem)');
      }
    }, this.config.updateInterval * 2); // Less frequent

    this.updateIntervals.push(syncInterval);
  }

  private async performInitialSync(): Promise<void> {
    logger.debug('Performing initial sync (Viem)');

    try {
      // Fetch initial token data
      await this.syncWithPancakeSwap();

      // Warm up cache
      if (this.config.cacheEnabled) {
        await this.warmupCache();
      }

      logger.info('Initial sync completed (Viem)');

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Initial sync failed (Viem)');
      throw error;
    }
  }

  private async processTokenUpdate(token: BSCTokenViem): Promise<void> {
    // Process token update, emit events, etc.
    this.emitTokenEvent({
      type: 'metadata_update',
      tokenAddress: token.address,
      data: token,
      timestamp: Date.now()
    });
  }
}

// Export singleton instance
export const bscTokenServiceViem = new BSCTokenServiceViem();