/**
 * BSC Token Metadata Service
 * Handles fetching and enriching token metadata from various sources
 */

import { ethers } from 'ethers';
import logger from '../../../utils/logger.js';
import type { BSCToken, TokenVerificationStatus } from './types.js';
import { TokenCategory } from './types.js';
import { BSCProviderManager } from '../../utils/ethers-provider.js';
import { PancakeSwapSubgraphClient } from '../pancakeswap/subgraph-client.js';
import { PancakeSwapAPIClient } from '../pancakeswap/api-client.js';
import { BSCCacheManager } from '../cache/cache-manager.js';

// ERC-20 ABI for basic token information
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
];

/**
 * Interface for token metadata fetching
 */
export interface ITokenMetadataService {
  fetchBasicTokenInfo(address: string): Promise<Partial<BSCToken>>;
  fetchTokenLogo(address: string, symbol: string): Promise<string | null>;
  fetchTokenDescription(address: string): Promise<string | null>;
  fetchTokenSocials(address: string): Promise<Partial<BSCToken>>;
  categorizeToken(token: BSCToken): Promise<TokenCategory>;
  enrichTokenMetadata(address: string): Promise<BSCToken>;
  validateTokenContract(address: string): Promise<boolean>;
}

/**
 * Token Metadata Service Implementation
 * Fetches and enriches token metadata from multiple sources
 */
export class TokenMetadataService implements ITokenMetadataService {
  private provider: BSCProviderManager;
  private subgraphClient: PancakeSwapSubgraphClient;
  private apiClient: PancakeSwapAPIClient;
  private cache: BSCCacheManager;

  constructor() {
    this.provider = new BSCProviderManager();
    this.subgraphClient = new PancakeSwapSubgraphClient();
    this.apiClient = new PancakeSwapAPIClient();
    this.cache = new BSCCacheManager();
  }

  /**
   * Fetch basic token information from contract
   */
  async fetchBasicTokenInfo(address: string): Promise<Partial<BSCToken>> {
    logger.debug({ address }, 'Fetching basic token info');

    try {
      const cacheKey = `token:basic:${address}`;
      const cached = await this.cache.get<Partial<BSCToken>>(cacheKey);

      if (cached) {
        logger.debug({ address }, 'Returning cached token info');
        return cached;
      }

      const provider = await this.provider.getProvider();
      const contract = new ethers.Contract(address, ERC20_ABI, provider);

      const [name, symbol, decimals, totalSupply] = await Promise.all([
        contract.name().catch(() => 'Unknown'),
        contract.symbol().catch(() => 'UNKNOWN'),
        contract.decimals().catch(() => 18),
        contract.totalSupply().catch(() => BigInt(0)),
      ]);

      const tokenInfo: Partial<BSCToken> = {
        address: address.toLowerCase(),
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply: totalSupply.toString(),
        isActive: true,
        discoveredAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Cache for 1 hour
      await this.cache.set(cacheKey, tokenInfo, 3600000);

      logger.info({ address, symbol, name }, 'Fetched basic token info');
      return tokenInfo;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch basic token info');
      throw new Error(`Failed to fetch token info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch token logo from various sources
   */
  async fetchTokenLogo(address: string, symbol: string): Promise<string | null> {
    logger.debug({ address, symbol }, 'Fetching token logo');

    try {
      const cacheKey = `token:logo:${address}`;
      const cached = await this.cache.get<string>(cacheKey);

      if (cached) {
        return cached;
      }

      // Try multiple logo sources in order of preference
      const logoSources = [
        () => this.fetchFromCoinGeckoLogo(address, symbol),
        () => this.fetchFromTrustWallet(address),
        () => this.fetchFromPancakeSwap(address),
        () => this.generateDefaultLogo(symbol),
      ];

      for (const fetchLogo of logoSources) {
        try {
          const logo = await fetchLogo();
          if (logo) {
            // Cache for 24 hours
            await this.cache.set(cacheKey, logo, 86400000);
            return logo;
          }
        } catch (error) {
          logger.debug({ address, source: fetchLogo.name, error: error instanceof Error ? error.message : 'Unknown error' }, 'Logo source failed');
        }
      }

      return null;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch token logo');
      return null;
    }
  }

  /**
   * Fetch token description
   */
  async fetchTokenDescription(address: string): Promise<string | null> {
    logger.debug({ address }, 'Fetching token description');

    try {
      const cacheKey = `token:description:${address}`;
      const cached = await this.cache.get<string>(cacheKey);

      if (cached) {
        return cached;
      }

      // Try to fetch description from various sources
      const descriptionSources = [
        () => this.fetchFromCoinGeckoDescription(address),
        () => this.fetchFromCoinMarketCapDescription(address),
        () => this.generateBasicDescription(address),
      ];

      for (const fetchDescription of descriptionSources) {
        try {
          const description = await fetchDescription();
          if (description && description.length > 50) {
            // Cache for 6 hours
            await this.cache.set(cacheKey, description, 21600000);
            return description;
          }
        } catch (error) {
          logger.debug({ address, source: fetchDescription.name, error: error instanceof Error ? error.message : 'Unknown error' }, 'Description source failed');
        }
      }

      return null;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch token description');
      return null;
    }
  }

  /**
   * Fetch token social media links
   */
  async fetchTokenSocials(address: string): Promise<Partial<BSCToken>> {
    logger.debug({ address }, 'Fetching token socials');

    try {
      const cacheKey = `token:socials:${address}`;
      const cached = await this.cache.get<Partial<BSCToken>>(cacheKey);

      if (cached) {
        return cached;
      }

      const socials: Partial<BSCToken> = {};

      // Try to fetch social links from various sources
      const socialSources = [
        () => this.fetchFromCoinGeckoSocials(address),
        () => this.fetchFromDexToolsSocials(address),
        () => this.fetchFromBscScanSocials(address),
      ];

      for (const fetchSocials of socialSources) {
        try {
          const socialData = await fetchSocials();
          if (socialData) {
            Object.assign(socials, socialData);
          }
        } catch (error) {
          logger.debug({ address, source: fetchSocials.name, error: error instanceof Error ? error.message : 'Unknown error' }, 'Social source failed');
        }
      }

      // Cache for 12 hours
      if (Object.keys(socials).length > 0) {
        await this.cache.set(cacheKey, socials, 43200000);
      }

      return socials;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch token socials');
      return {};
    }
  }

  /**
   * Categorize token based on its characteristics
   */
  async categorizeToken(token: BSCToken): Promise<TokenCategory> {
    logger.debug({ address: token.address, symbol: token.symbol }, 'Categorizing token');

    try {
      // Check if it's a stablecoin
      if (this.isStablecoin(token)) {
        return TokenCategory.STABLECOIN;
      }

      // Check if it's a governance token
      if (this.isGovernanceToken(token)) {
        return TokenCategory.GOVERNANCE;
      }

      // Check if it's a meme token
      if (this.isMemeToken(token)) {
        return TokenCategory.MEME;
      }

      // Check if it's a DeFi token
      if (this.isDeFiToken(token)) {
        return TokenCategory.DEFI;
      }

      // Check if it's a gaming token
      if (this.isGamingToken(token)) {
        return TokenCategory.GAMING;
      }

      // Check if it's an exchange token
      if (this.isExchangeToken(token)) {
        return TokenCategory.EXCHANGE;
      }

      // Check if it's a yield token
      if (this.isYieldToken(token)) {
        return TokenCategory.YIELD;
      }

      // Default to currency
      return TokenCategory.CURRENCY;

    } catch (error) {
      logger.error({ address: token.address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to categorize token');
      return TokenCategory.OTHER;
    }
  }

  /**
   * Enrich token metadata with all available information
   */
  async enrichTokenMetadata(address: string): Promise<BSCToken> {
    logger.debug({ address }, 'Enriching token metadata');

    try {
      // Fetch basic token info
      const basicInfo = await this.fetchBasicTokenInfo(address);
      if (!basicInfo.symbol) {
        throw new Error('Invalid token contract');
      }

      // Fetch additional metadata in parallel
      const [logo, description, socials] = await Promise.all([
        this.fetchTokenLogo(address, basicInfo.symbol),
        this.fetchTokenDescription(address),
        this.fetchTokenSocials(address),
      ]);

      // Create enriched token object
      const enrichedToken: BSCToken = {
        ...basicInfo,
        logoURI: logo || undefined,
        description: description || undefined,
        website: socials.website,
        twitter: socials.twitter,
        telegram: socials.telegram,
        discord: socials.discord,
        verificationStatus: {
          isVerified: false,
          sources: [],
          confidence: 0,
        },
        riskLevel: 'medium',
        tags: [],
        isActive: true,
        isListed: false,
        updatedAt: Date.now(),
      } as BSCToken;

      // Categorize the token
      enrichedToken.category = await this.categorizeToken(enrichedToken);

      logger.info({ address, symbol: basicInfo.symbol, category: enrichedToken.category }, 'Token metadata enriched');
      return enrichedToken;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to enrich token metadata');
      throw error;
    }
  }

  /**
   * Validate if address is a valid ERC-20 token contract
   */
  async validateTokenContract(address: string): Promise<boolean> {
    logger.debug({ address }, 'Validating token contract');

    try {
      const cacheKey = `token:validate:${address}`;
      const cached = await this.cache.get<boolean>(cacheKey);

      if (cached !== undefined) {
        return cached;
      }

      const provider = await this.provider.getProvider();

      // Check if address is a contract
      const code = await provider.getCode(address);
      if (code === '0x') {
        await this.cache.set(cacheKey, false, 3600000);
        return false;
      }

      // Check if it has required ERC-20 functions
      const contract = new ethers.Contract(address, ERC20_ABI, provider);

      const [hasName, hasSymbol, hasDecimals] = await Promise.all([
        contract.name().then(() => true).catch(() => false),
        contract.symbol().then(() => true).catch(() => false),
        contract.decimals().then(() => true).catch(() => false),
      ]);

      const isValid = hasName && hasSymbol && hasDecimals;

      // Cache result for 1 hour
      await this.cache.set(cacheKey, isValid, 3600000);

      logger.info({ address, isValid }, 'Token contract validation completed');
      return isValid;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Token contract validation failed');
      return false;
    }
  }

  // Private helper methods

  private async fetchFromCoinGeckoLogo(address: string, symbol: string): Promise<string | null> {
    try {
      // This would make an API call to CoinGecko
      // For now, return null as placeholder
      logger.debug({ address, symbol }, 'Fetching logo from CoinGecko');
      return null;
    } catch (error) {
      return null;
    }
  }

  private async fetchFromTrustWallet(address: string): Promise<string | null> {
    try {
      // This would fetch from Trust Wallet assets
      logger.debug({ address }, 'Fetching logo from TrustWallet');
      return null;
    } catch (error) {
      return null;
    }
  }

  private async fetchFromPancakeSwap(address: string): Promise<string | null> {
    try {
      // Fetch from PancakeSwap Subgraph
      const tokens = await this.subgraphClient.getTokens();
      const tokenData = tokens.find(t => t.id.toLowerCase() === address.toLowerCase()) || null;
      return tokenData?.logoURI || null;
    } catch (error) {
      return null;
    }
  }

  private generateDefaultLogo(symbol: string): string | null {
    try {
      // Generate a simple identicon or use a default service
      const identiconUrl = `https://ui-avatars.com/api/?name=${symbol}&background=random&color=fff&size=128`;
      return identiconUrl;
    } catch (error) {
      return null;
    }
  }

  private async fetchFromCoinGeckoDescription(address: string): Promise<string | null> {
    try {
      // This would make an API call to CoinGecko
      logger.debug({ address }, 'Fetching description from CoinGecko');
      return null;
    } catch (error) {
      return null;
    }
  }

  private async fetchFromCoinMarketCapDescription(address: string): Promise<string | null> {
    try {
      // This would make an API call to CoinMarketCap
      logger.debug({ address }, 'Fetching description from CoinMarketCap');
      return null;
    } catch (error) {
      return null;
    }
  }

  private async generateBasicDescription(address: string): Promise<string | null> {
    try {
      // Generate a basic description based on available data
      return `Token contract deployed on BNB Chain with address ${address.toLowerCase()}.`;
    } catch (error) {
      return null;
    }
  }

  private async fetchFromCoinGeckoSocials(address: string): Promise<Partial<BSCToken>> {
    try {
      // This would fetch social links from CoinGecko
      logger.debug({ address }, 'Fetching socials from CoinGecko');
      return {};
    } catch (error) {
      return {};
    }
  }

  private async fetchFromDexToolsSocials(address: string): Promise<Partial<BSCToken>> {
    try {
      // This would fetch from DexTools
      logger.debug({ address }, 'Fetching socials from DexTools');
      return {};
    } catch (error) {
      return {};
    }
  }

  private async fetchFromBscScanSocials(address: string): Promise<Partial<BSCToken>> {
    try {
      // This would parse BscScan for social links
      logger.debug({ address }, 'Fetching socials from BscScan');
      return {};
    } catch (error) {
      return {};
    }
  }

  private isStablecoin(token: BSCToken): boolean {
    const stablecoinSymbols = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'FDUSD', 'USDD'];
    return stablecoinSymbols.includes(token.symbol.toUpperCase()) ||
           token.symbol.includes('USD') ||
           token.name?.toLowerCase().includes('stablecoin') ||
           token.name?.toLowerCase().includes('usd');
  }

  private isGovernanceToken(token: BSCToken): boolean {
    return token.symbol.toLowerCase().includes('gov') ||
           token.name?.toLowerCase().includes('governance') ||
           token.symbol.toLowerCase().includes('vote') ||
           token.name?.toLowerCase().includes('voting');
  }

  private isMemeToken(token: BSCToken): boolean {
    const memeKeywords = ['pepe', 'doge', 'shib', 'elon', 'musk', 'moon', 'rocket', 'safe', 'meme'];
    const lowerSymbol = token.symbol.toLowerCase();
    const lowerName = token.name?.toLowerCase() || '';

    return memeKeywords.some(keyword =>
      lowerSymbol.includes(keyword) || lowerName.includes(keyword)
    );
  }

  private isDeFiToken(token: BSCToken): boolean {
    return token.name?.toLowerCase().includes('defi') ||
           token.name?.toLowerCase().includes('finance') ||
           token.name?.toLowerCase().includes('protocol') ||
           token.symbol.toLowerCase().includes('defi');
  }

  private isGamingToken(token: BSCToken): boolean {
    return token.name?.toLowerCase().includes('game') ||
           token.name?.toLowerCase().includes('play') ||
           token.symbol.toLowerCase().includes('game') ||
           token.symbol.toLowerCase().includes('play');
  }

  private isExchangeToken(token: BSCToken): boolean {
    const exchangeTokens = ['CAKE', 'BNB', 'WBNB'];
    return exchangeTokens.includes(token.symbol.toUpperCase()) ||
           token.name?.toLowerCase().includes('exchange') ||
           token.name?.toLowerCase().includes('swap');
  }

  private isYieldToken(token: BSCToken): boolean {
    return token.name?.toLowerCase().includes('yield') ||
           token.name?.toLowerCase().includes('farm') ||
           token.symbol.toLowerCase().includes('yield') ||
           token.symbol.toLowerCase().includes('farm');
  }
}

// Export singleton instance
export const tokenMetadataService = new TokenMetadataService();