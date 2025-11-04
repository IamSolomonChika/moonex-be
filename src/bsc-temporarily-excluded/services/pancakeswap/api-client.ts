import { bscConfig } from '../../config';
import logger from '../../../utils/logger';

/**
 * PancakeSwap API Response Types
 */
export interface PancakeSwapToken {
  symbol: string;
  name: string;
  address: string;
  decimals: string;
  logo: string;
  website?: string;
  description?: string;
  audits?: string[];
  audit_links?: string[];
  cmcId?: number;
  cmcRank?: number;
  categories?: string[];
  tags?: string[];
}

export interface PancakeSwapPair {
  pair_address: string;
  base_symbol: string;
  base_name: string;
  base_address: string;
  quote_symbol: string;
  quote_name: string;
  quote_address: string;
  price: string;
  price_BNB?: string;
  liquidity?: {
    usd: string;
    base: string;
    quote: string;
  };
  volume?: {
    h24?: string;
    h6?: string;
    h1?: string;
    m5?: string;
  };
  price_change?: {
    h24?: string;
    h6?: string;
    h1?: string;
    m5?: string;
  };
}

export interface PancakeSwapPrice {
  [tokenAddress: string]: {
    [quoteTokenAddress: string]: string;
  };
}

/**
 * PancakeSwap API Client
 * Handles communication with PancakeSwap's REST API as fallback to subgraph
 */
export class PancakeSwapAPIClient {
  private readonly baseUrl: string;
  private readonly maxRetries: number = 3;
  private readonly timeout: number = 10000; // 10 seconds

  constructor() {
    this.baseUrl = bscConfig.pancakeSwapApiV2;
  }

  /**
   * Make HTTP request to PancakeSwap API
   */
  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = new URL(`${this.baseUrl}${endpoint}`);
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'MoonEx-API/1.0',
            },
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();
          return result as T;

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.warn({ attempt, endpoint, error: errorMessage }, `PancakeSwap API request attempt ${attempt} failed`);

          if (attempt === this.maxRetries) {
            throw error;
          }

          // Exponential backoff
          await this.sleep(Math.min(1000 * Math.pow(2, attempt - 1), 5000));
        }
      }

      throw new Error('Max retries exceeded');

    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get all tokens from PancakeSwap API
   */
  async getTokens(): Promise<PancakeSwapToken[]> {
    try {
      const result = await this.makeRequest<{ data: PancakeSwapToken[] }>('/tokens');

      if (!result.data || !Array.isArray(result.data)) {
        throw new Error('Invalid token data received from PancakeSwap API');
      }

      logger.debug(`Retrieved ${result.data.length} tokens from PancakeSwap API`);
      return result.data;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch tokens from PancakeSwap API');
      throw new Error(`Failed to fetch tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get token by address
   */
  async getTokenByAddress(address: string): Promise<PancakeSwapToken | null> {
    try {
      const result = await this.makeRequest<{ data: PancakeSwapToken[] }>('/tokens');

      if (!result.data || !Array.isArray(result.data)) {
        throw new Error('Invalid token data received from PancakeSwap API');
      }

      const token = result.data.find(t => t.address.toLowerCase() === address.toLowerCase());
      return token || null;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, `Failed to fetch token ${address} from PancakeSwap API`);
      throw new Error(`Failed to fetch token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search tokens by symbol or name
   */
  async searchTokens(search: string, limit: number = 50): Promise<PancakeSwapToken[]> {
    try {
      const allTokens = await this.getTokens();

      const filteredTokens = allTokens
        .filter(token =>
          token.symbol.toLowerCase().includes(search.toLowerCase()) ||
          token.name.toLowerCase().includes(search.toLowerCase())
        )
        .slice(0, limit);

      logger.debug(`Found ${filteredTokens.length} tokens matching "${search}"`);
      return filteredTokens;

    } catch (error) {
      logger.error({ search, error: error instanceof Error ? error.message : 'Unknown error' }, `Failed to search tokens for "${search}"`);
      throw new Error(`Failed to search tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get price data for tokens
   */
  async getPrices(tokenAddresses: string[]): Promise<PancakeSwapPrice> {
    try {
      const result = await this.makeRequest<{ data: PancakeSwapPrice }>('/prices', {
        token_addresses: tokenAddresses.join(',')
      });

      if (!result.data) {
        throw new Error('Invalid price data received from PancakeSwap API');
      }

      logger.debug(`Retrieved prices for ${tokenAddresses.length} tokens`);
      return result.data;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch prices from PancakeSwap API');
      throw new Error(`Failed to fetch prices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get trading pairs
   */
  async getPairs(limit: number = 100): Promise<PancakeSwapPair[]> {
    try {
      const result = await this.makeRequest<{ data: PancakeSwapPair[] }>('/pairs', {
        limit: limit.toString()
      });

      if (!result.data || !Array.isArray(result.data)) {
        throw new Error('Invalid pair data received from PancakeSwap API');
      }

      logger.debug(`Retrieved ${result.data.length} pairs from PancakeSwap API`);
      return result.data;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch pairs from PancakeSwap API');
      throw new Error(`Failed to fetch pairs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pair by address
   */
  async getPairByAddress(address: string): Promise<PancakeSwapPair | null> {
    try {
      const allPairs = await this.getPairs(1000); // Get more pairs for better search

      const pair = allPairs.find(p => p.pair_address.toLowerCase() === address.toLowerCase());
      return pair || null;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, `Failed to fetch pair ${address} from PancakeSwap API`);
      throw new Error(`Failed to fetch pair: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pairs for a specific token
   */
  async getPairsForToken(tokenAddress: string): Promise<PancakeSwapPair[]> {
    try {
      const allPairs = await this.getPairs(1000);

      const tokenPairs = allPairs.filter(pair =>
        pair.base_address.toLowerCase() === tokenAddress.toLowerCase() ||
        pair.quote_address.toLowerCase() === tokenAddress.toLowerCase()
      );

      logger.debug(`Found ${tokenPairs.length} pairs for token ${tokenAddress}`);
      return tokenPairs;

    } catch (error) {
      logger.error({ tokenAddress, error: error instanceof Error ? error.message : 'Unknown error' }, `Failed to fetch pairs for token ${tokenAddress}`);
      throw new Error(`Failed to fetch token pairs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get tokens with minimum trading volume
   */
  async getTokensWithMinVolume(minVolumeUSD: number = 1000): Promise<PancakeSwapToken[]> {
    try {
      const allTokens = await this.getTokens();
      const tokenAddresses = allTokens.slice(0, 100).map(t => t.address); // Limit for API performance

      const prices = await this.getPrices(tokenAddresses);
      const tokensWithVolume: PancakeSwapToken[] = [];

      for (const token of allTokens) {
        const tokenPrice = prices[token.address];
        if (tokenPrice) {
          // Get volume data from pairs (approximation)
          const pair = await this.getPairsForToken(token.address);
          const totalVolume = pair.reduce((sum, p) => {
            return sum + (p.volume?.h24 ? parseFloat(p.volume.h24) : 0);
          }, 0);

          if (totalVolume >= minVolumeUSD) {
            tokensWithVolume.push(token);
          }
        }
      }

      logger.debug(`Found ${tokensWithVolume.length} tokens with min volume $${minVolumeUSD}`);
      return tokensWithVolume;

    } catch (error) {
      logger.error({ minVolumeUSD, error: error instanceof Error ? error.message : 'Unknown error' }, `Failed to get tokens with min volume ${minVolumeUSD}`);
      throw new Error(`Failed to get tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Health check for PancakeSwap API
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.makeRequest('/health');
      return true;
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : 'Unknown error' }, 'PancakeSwap API health check failed');
      return false;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const pancakeSwapAPIClient = new PancakeSwapAPIClient();

// Export convenience functions
export const getTokens = () => pancakeSwapAPIClient.getTokens();
export const getTokenByAddress = (address: string) =>
  pancakeSwapAPIClient.getTokenByAddress(address);
export const getPrices = (tokenAddresses: string[]) =>
  pancakeSwapAPIClient.getPrices(tokenAddresses);
export const getPairs = (limit?: number) =>
  pancakeSwapAPIClient.getPairs(limit);