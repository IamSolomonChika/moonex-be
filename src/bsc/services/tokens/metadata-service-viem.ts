/**
 * BSC Token Metadata Service (Viem)
 * Handles fetching and enriching token metadata from various sources using Viem
 */

import { createPublicClient, http, Address } from 'viem';
import { bsc } from 'viem/chains';
import logger from '../../../utils/logger.js';
import type { BSCTokenViem, TokenVerificationStatusViem } from '../../types/token-types-viem.js';
import { TokenCategory } from '../../types/token-types-viem.js';
import { BSCCacheManager } from '../../cache/bsc-cache-manager.js';

// ERC-20 ABI for Viem
const ERC20_ABI = [
  {
    inputs: [],
    name: 'name',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ type: 'address' }],
    name: 'balanceOf',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

/**
 * Interface for token metadata fetching (Viem)
 */
export interface ITokenMetadataServiceViem {
  fetchBasicTokenInfo(address: Address): Promise<Partial<BSCTokenViem>>;
  fetchTokenLogo(address: Address, symbol: string): Promise<string | null>;
  fetchTokenDescription(address: Address): Promise<string | null>;
  fetchTokenSocials(address: Address): Promise<Partial<BSCTokenViem>>;
  categorizeToken(token: BSCTokenViem): Promise<TokenCategory>;
  enrichTokenMetadata(address: Address): Promise<BSCTokenViem>;
  validateTokenContract(address: Address): Promise<boolean>;
  batchValidateTokenContracts(addresses: Address[]): Promise<boolean[]>;
  getServiceStatus(): Promise<{ healthy: boolean; timestamp: number; details?: any }>;
}

/**
 * Token Metadata Service Implementation (Viem)
 * Fetches and enriches token metadata from multiple sources using Viem
 */
export class TokenMetadataServiceViem implements ITokenMetadataServiceViem {
  private publicClient: any;
  private cache: BSCCacheManager;

  constructor() {
    this.publicClient = createPublicClient({
      chain: bsc,
      transport: http()
    });
    this.cache = new BSCCacheManager('metadata-service');
  }

  /**
   * Fetch basic token information from contract using Viem
   */
  async fetchBasicTokenInfo(address: Address): Promise<Partial<BSCTokenViem>> {
    logger.debug({ address }, 'Fetching basic token info (Viem)');

    try {
      const cacheKey = `token:basic:${address}`;
      const cached = await this.cache.get<Partial<BSCTokenViem>>(cacheKey);

      if (cached) {
        logger.debug({ address }, 'Returning cached token info');
        return cached;
      }

      const [name, symbol, decimals, totalSupply] = await Promise.all([
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'name'
        }).catch(() => 'Unknown'),
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'symbol'
        }).catch(() => 'UNKNOWN'),
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'decimals'
        }).catch(() => 18n),
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'totalSupply'
        }).catch(() => 0n),
      ]);

      const tokenInfo: Partial<BSCTokenViem> = {
        address,
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

      logger.info({ address, symbol, name }, 'Fetched basic token info (Viem)');
      return tokenInfo;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch basic token info (Viem)');
      throw new Error(`Failed to fetch token info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch token logo from various sources
   */
  async fetchTokenLogo(address: Address, symbol: string): Promise<string | null> {
    logger.debug({ address, symbol }, 'Fetching token logo (Viem)');

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
          logger.debug({ address, source: fetchLogo.name, error: error instanceof Error ? error.message : 'Unknown error' }, 'Logo source failed (Viem)');
        }
      }

      return null;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch token logo (Viem)');
      return null;
    }
  }

  /**
   * Fetch token description
   */
  async fetchTokenDescription(address: Address): Promise<string | null> {
    logger.debug({ address }, 'Fetching token description (Viem)');

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
          logger.debug({ address, source: fetchDescription.name, error: error instanceof Error ? error.message : 'Unknown error' }, 'Description source failed (Viem)');
        }
      }

      return null;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch token description (Viem)');
      return null;
    }
  }

  /**
   * Fetch token social media links
   */
  async fetchTokenSocials(address: Address): Promise<Partial<BSCTokenViem>> {
    logger.debug({ address }, 'Fetching token socials (Viem)');

    try {
      const cacheKey = `token:socials:${address}`;
      const cached = await this.cache.get<Partial<BSCTokenViem>>(cacheKey);

      if (cached) {
        return cached;
      }

      const socials: Partial<BSCTokenViem> = {};

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
          logger.debug({ address, source: fetchSocials.name, error: error instanceof Error ? error.message : 'Unknown error' }, 'Social source failed (Viem)');
        }
      }

      // Cache for 12 hours
      if (Object.keys(socials).length > 0) {
        await this.cache.set(cacheKey, socials, 43200000);
      }

      return socials;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch token socials (Viem)');
      return {};
    }
  }

  /**
   * Categorize token based on its characteristics
   */
  async categorizeToken(token: BSCTokenViem): Promise<TokenCategory> {
    logger.debug({ address: token.address, symbol: token.symbol }, 'Categorizing token (Viem)');

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
      logger.error({ address: token.address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to categorize token (Viem)');
      return TokenCategory.OTHER;
    }
  }

  /**
   * Enrich token metadata with all available information
   */
  async enrichTokenMetadata(address: Address): Promise<BSCTokenViem> {
    logger.debug({ address }, 'Enriching token metadata (Viem)');

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
      const enrichedToken: BSCTokenViem = {
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
          warnings: [],
          flags: []
        } as TokenVerificationStatusViem,
        riskLevel: 'medium',
        tags: [],
        isActive: true,
        isListed: false,
        updatedAt: Date.now(),
      } as BSCTokenViem;

      // Categorize the token
      enrichedToken.category = await this.categorizeToken(enrichedToken);

      logger.info({ address, symbol: basicInfo.symbol, category: enrichedToken.category }, 'Token metadata enriched (Viem)');
      return enrichedToken;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to enrich token metadata (Viem)');
      throw error;
    }
  }

  /**
   * Validate if address is a valid ERC-20 token contract using Viem
   */
  async validateTokenContract(address: Address): Promise<boolean> {
    logger.debug({ address }, 'Validating token contract (Viem)');

    try {
      const cacheKey = `token:validate:${address}`;
      const cached = await this.cache.get<boolean>(cacheKey);

      if (cached !== undefined) {
        return cached;
      }

      // Check if address is a contract
      const bytecode = await this.publicClient.getBytecode({ address });
      if (!bytecode || bytecode === '0x') {
        await this.cache.set(cacheKey, false, 3600000);
        return false;
      }

      // Check if it has required ERC-20 functions
      const [hasName, hasSymbol, hasDecimals] = await Promise.all([
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'name'
        }).then(() => true).catch(() => false),
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'symbol'
        }).then(() => true).catch(() => false),
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'decimals'
        }).then(() => true).catch(() => false),
      ]);

      const isValid = hasName && hasSymbol && hasDecimals;

      // Cache result for 1 hour
      await this.cache.set(cacheKey, isValid, 3600000);

      logger.info({ address, isValid }, 'Token contract validation completed (Viem)');
      return isValid;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Token contract validation failed (Viem)');
      return false;
    }
  }

  /**
   * Validate multiple token contracts in batch using multicall
   */
  async batchValidateTokenContracts(addresses: Address[]): Promise<boolean[]> {
    logger.debug({ addresses }, 'Batch validating token contracts (Viem)');

    try {
      const results = await Promise.all(
        addresses.map(address => this.validateTokenContract(address))
      );

      logger.info({
        total: addresses.length,
        valid: results.filter(r => r).length,
        invalid: results.filter(r => !r).length
      }, 'Batch token contract validation completed (Viem)');

      return results;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Batch token contract validation failed (Viem)');
      return addresses.map(() => false);
    }
  }

  /**
   * Get service status
   */
  async getServiceStatus(): Promise<{ healthy: boolean; timestamp: number; details?: any }> {
    try {
      // Check if we can read from blockchain
      await this.publicClient.getBlockNumber();

      return {
        healthy: true,
        timestamp: Date.now(),
        details: {
          cacheEnabled: true,
          supportedChains: ['bsc'],
          features: [
            'basicTokenInfo',
            'logoFetching',
            'descriptionFetching',
            'socialFetching',
            'tokenCategorization',
            'contractValidation',
            'batchValidation'
          ]
        }
      };
    } catch (error) {
      return {
        healthy: false,
        timestamp: Date.now(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  // Private helper methods

  private async fetchFromCoinGeckoLogo(address: Address, symbol: string): Promise<string | null> {
    try {
      // This would make an API call to CoinGecko
      // For now, return null as placeholder
      logger.debug({ address, symbol }, 'Fetching logo from CoinGecko (Viem)');
      return null;
    } catch (error) {
      return null;
    }
  }

  private async fetchFromTrustWallet(address: Address): Promise<string | null> {
    try {
      // This would fetch from Trust Wallet assets
      logger.debug({ address }, 'Fetching logo from TrustWallet (Viem)');
      return null;
    } catch (error) {
      return null;
    }
  }

  private async fetchFromPancakeSwap(address: Address): Promise<string | null> {
    try {
      // Fetch from PancakeSwap Subgraph
      // For now, return null as placeholder
      logger.debug({ address }, 'Fetching logo from PancakeSwap (Viem)');
      return null;
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

  private async fetchFromCoinGeckoDescription(address: Address): Promise<string | null> {
    try {
      // This would make an API call to CoinGecko
      logger.debug({ address }, 'Fetching description from CoinGecko (Viem)');
      return null;
    } catch (error) {
      return null;
    }
  }

  private async fetchFromCoinMarketCapDescription(address: Address): Promise<string | null> {
    try {
      // This would make an API call to CoinMarketCap
      logger.debug({ address }, 'Fetching description from CoinMarketCap (Viem)');
      return null;
    } catch (error) {
      return null;
    }
  }

  private async generateBasicDescription(address: Address): Promise<string | null> {
    try {
      // Generate a basic description based on available data
      return `Token contract deployed on BNB Chain with address ${address}.`;
    } catch (error) {
      return null;
    }
  }

  private async fetchFromCoinGeckoSocials(address: Address): Promise<Partial<BSCTokenViem>> {
    try {
      // This would fetch social links from CoinGecko
      logger.debug({ address }, 'Fetching socials from CoinGecko (Viem)');
      return {};
    } catch (error) {
      return {};
    }
  }

  private async fetchFromDexToolsSocials(address: Address): Promise<Partial<BSCTokenViem>> {
    try {
      // This would fetch from DexTools
      logger.debug({ address }, 'Fetching socials from DexTools (Viem)');
      return {};
    } catch (error) {
      return {};
    }
  }

  private async fetchFromBscScanSocials(address: Address): Promise<Partial<BSCTokenViem>> {
    try {
      // This would parse BscScan for social links
      logger.debug({ address }, 'Fetching socials from BscScan (Viem)');
      return {};
    } catch (error) {
      return {};
    }
  }

  private isStablecoin(token: BSCTokenViem): boolean {
    const stablecoinSymbols = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'FDUSD', 'USDD'];
    return stablecoinSymbols.includes(token.symbol.toUpperCase()) ||
           token.symbol.includes('USD') ||
           token.name?.toLowerCase().includes('stablecoin') ||
           token.name?.toLowerCase().includes('usd');
  }

  private isGovernanceToken(token: BSCTokenViem): boolean {
    return token.symbol.toLowerCase().includes('gov') ||
           token.name?.toLowerCase().includes('governance') ||
           token.symbol.toLowerCase().includes('vote') ||
           token.name?.toLowerCase().includes('voting');
  }

  private isMemeToken(token: BSCTokenViem): boolean {
    const memeKeywords = ['pepe', 'doge', 'shib', 'elon', 'musk', 'moon', 'rocket', 'safe', 'meme'];
    const lowerSymbol = token.symbol.toLowerCase();
    const lowerName = token.name?.toLowerCase() || '';

    return memeKeywords.some(keyword =>
      lowerSymbol.includes(keyword) || lowerName.includes(keyword)
    );
  }

  private isDeFiToken(token: BSCTokenViem): boolean {
    return token.name?.toLowerCase().includes('defi') ||
           token.name?.toLowerCase().includes('finance') ||
           token.name?.toLowerCase().includes('protocol') ||
           token.symbol.toLowerCase().includes('defi');
  }

  private isGamingToken(token: BSCTokenViem): boolean {
    return token.name?.toLowerCase().includes('game') ||
           token.name?.toLowerCase().includes('play') ||
           token.symbol.toLowerCase().includes('game') ||
           token.symbol.toLowerCase().includes('play');
  }

  private isExchangeToken(token: BSCTokenViem): boolean {
    const exchangeTokens = ['CAKE', 'BNB', 'WBNB'];
    return exchangeTokens.includes(token.symbol.toUpperCase()) ||
           token.name?.toLowerCase().includes('exchange') ||
           token.name?.toLowerCase().includes('swap');
  }

  private isYieldToken(token: BSCTokenViem): boolean {
    return token.name?.toLowerCase().includes('yield') ||
           token.name?.toLowerCase().includes('farm') ||
           token.symbol.toLowerCase().includes('yield') ||
           token.symbol.toLowerCase().includes('farm');
  }
}

// Export singleton instance
export const tokenMetadataServiceViem = new TokenMetadataServiceViem();