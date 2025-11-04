import { bscConfig } from '../../config';
import logger from '../../../utils/logger';

/**
 * PancakeSwap Subgraph Query Types
 */
export interface Pair {
  id: string;
  token0: {
    id: string;
    symbol: string;
    name: string;
    decimals: number;
    derivedETH: string;
  };
  token1: {
    id: string;
    symbol: string;
    name: string;
    decimals: number;
    derivedETH: string;
  };
  reserve0: string;
  reserve1: string;
  reserveUSD: string;
  totalSupply: string;
  volumeUSD: string;
  untrackedVolumeUSD: string;
  txCount: string;
  created_at_timestamp: number;
  liquidityProviderCount: string;
}

export interface Token {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  derivedETH: string;
  derivedUSD: string;
  volume: string;
  volumeUSD: string;
  untrackedVolumeUSD: string;
  totalLiquidity: string;
  txCount: string;
  pairs: string[];
}

export interface Bundle {
  id: string;
  ethPrice: string;
}

/**
 * PancakeSwap Subgraph Query Templates
 */
const QUERIES = {
  // Get all tokens with basic info
  TOKENS_FIRST_100: `
    query getTokens($first: Int!, $skip: Int!) {
      tokens(first: $first, skip: $skip, orderBy: volumeUSD, orderDirection: desc) {
        id
        symbol
        name
        decimals
        derivedETH
        derivedUSD
        volume
        volumeUSD
        totalLiquidity
        txCount
      }
    }
  `,

  // Get token by address
  TOKEN_BY_ADDRESS: `
    query getToken($id: ID!) {
      token(id: $id) {
        id
        symbol
        name
        decimals
        derivedETH
        derivedUSD
        volume
        volumeUSD
        totalLiquidity
        txCount
      }
    }
  `,

  // Get top pairs by liquidity
  TOP_PAIRS: `
    query getTopPairs($first: Int!) {
      pairs(first: $first, orderBy: reserveUSD, orderDirection: desc) {
        id
        token0 {
          id
          symbol
          name
          decimals
          derivedETH
        }
        token1 {
          id
          symbol
          name
          decimals
          derivedETH
        }
        reserve0
        reserve1
        reserveUSD
        totalSupply
        volumeUSD
        txCount
      }
    }
  `,

  // Get pair by address
  PAIR_BY_ADDRESS: `
    query getPair($id: ID!) {
      pair(id: $id) {
        id
        token0 {
          id
          symbol
          name
          decimals
          derivedETH
        }
        token1 {
          id
          symbol
          name
          decimals
          derivedETH
        }
        reserve0
        reserve1
        reserveUSD
        totalSupply
        volumeUSD
        txCount
      }
    }
  `,

  // Get ETH price (for BNB in this case)
  BUNDLE: `
    query getBundle {
      bundle(id: "1") {
        ethPrice
      }
    }
  `,
};

/**
 * PancakeSwap Subgraph Client
 * Handles communication with PancakeSwap's The Graph subgraph
 */
export class PancakeSwapSubgraphClient {
  private readonly endpoint: string;
  private readonly maxRetries: number = 3;
  private readonly timeout: number = 10000; // 10 seconds

  constructor() {
    this.endpoint = bscConfig.pancakeSwapSubgraph;
  }

  /**
   * Execute GraphQL query
   */
  private async executeQuery<T>(
    query: string,
    variables: Record<string, any> = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query,
              variables,
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();

          if (result.errors) {
            throw new Error(`GraphQL Error: ${result.errors.map((e: any) => e.message).join(', ')}`);
          }

          return result.data as T;

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.warn({ attempt, error: errorMessage }, `Subgraph query attempt ${attempt} failed`);

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
   * Get first 100 tokens (paginated)
   */
  async getTokens(first: number = 100, skip: number = 0): Promise<{ tokens: Token[] }> {
    try {
      const result = await this.executeQuery<{ tokens: Token[] }>(
        QUERIES.TOKENS_FIRST_100,
        { first, skip }
      );

      logger.debug(`Retrieved ${result.tokens.length} tokens from subgraph`);
      return result;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch tokens from subgraph');
      throw new Error(`Failed to fetch tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all tokens (with pagination)
   */
  async getAllTokens(): Promise<Token[]> {
    const allTokens: Token[] = [];
    const batchSize = 100;
    let skip = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        const result = await this.getTokens(batchSize, skip);
        allTokens.push(...result.tokens);

        if (result.tokens.length < batchSize) {
          hasMore = false;
        } else {
          skip += batchSize;
        }

        // Safety check to prevent infinite loops
        if (allTokens.length > 10000) {
          logger.warn('Stopping token pagination at 10000 tokens');
          break;
        }
      }

      logger.info(`Retrieved total of ${allTokens.length} tokens from subgraph`);
      return allTokens;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch all tokens from subgraph');
      throw error;
    }
  }

  /**
   * Get token by address
   */
  async getTokenByAddress(address: string): Promise<{ token: Token } | null> {
    try {
      const result = await this.executeQuery<{ token: Token }>(
        QUERIES.TOKEN_BY_ADDRESS,
        { id: address.toLowerCase() }
      );

      return result.token ? result : null;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, `Failed to fetch token ${address} from subgraph`);
      throw new Error(`Failed to fetch token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get top pairs by liquidity
   */
  async getTopPairs(first: number = 100): Promise<{ pairs: Pair[] }> {
    try {
      const result = await this.executeQuery<{ pairs: Pair[] }>(
        QUERIES.TOP_PAIRS,
        { first }
      );

      logger.debug(`Retrieved ${result.pairs.length} top pairs from subgraph`);
      return result;

    } catch (error) {
      logger.error({ first, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch top pairs from subgraph');
      throw new Error(`Failed to fetch top pairs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pair by address
   */
  async getPairByAddress(address: string): Promise<{ pair: Pair } | null> {
    try {
      const result = await this.executeQuery<{ pair: Pair }>(
        QUERIES.PAIR_BY_ADDRESS,
        { id: address.toLowerCase() }
      );

      return result.pair ? result : null;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, `Failed to fetch pair ${address} from subgraph`);
      throw new Error(`Failed to fetch pair: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get ETH price (BNB price in USD)
   */
  async getETHPrice(): Promise<string> {
    try {
      const result = await this.executeQuery<{ bundle: Bundle }>(QUERIES.BUNDLE);

      if (!result.bundle) {
        throw new Error('Bundle not found in subgraph response');
      }

      return result.bundle.ethPrice;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch ETH price from subgraph');
      throw new Error(`Failed to fetch ETH price: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search tokens by symbol or name
   */
  async searchTokens(query: string, limit: number = 50): Promise<Token[]> {
    try {
      // Get all tokens and filter client-side (subgraph doesn't support text search well)
      const allTokens = await this.getAllTokens();

      const filteredTokens = allTokens
        .filter(token =>
          token.symbol.toLowerCase().includes(query.toLowerCase()) ||
          token.name.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, limit);

      logger.debug(`Found ${filteredTokens.length} tokens matching "${query}"`);
      return filteredTokens;

    } catch (error) {
      logger.error({ query, error: error instanceof Error ? error.message : 'Unknown error' }, `Failed to search tokens for "${query}"`);
      throw new Error(`Failed to search tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get tokens with minimum liquidity
   */
  async getTokensWithMinLiquidity(minLiquidityUSD: number = 1000): Promise<Token[]> {
    try {
      const allTokens = await this.getAllTokens();

      const filteredTokens = allTokens.filter(
        token => parseFloat(token.totalLiquidity) >= minLiquidityUSD
      );

      logger.debug(`Found ${filteredTokens.length} tokens with min liquidity $${minLiquidityUSD}`);
      return filteredTokens;

    } catch (error) {
      logger.error({ minLiquidityUSD, error: error instanceof Error ? error.message : 'Unknown error' }, `Failed to get tokens with min liquidity ${minLiquidityUSD}`);
      throw new Error(`Failed to get tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Health check for subgraph
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.executeQuery<{ bundle: Bundle }>(QUERIES.BUNDLE);
      return result.bundle !== undefined;
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Subgraph health check failed');
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
export const pancakeSwapSubgraphClient = new PancakeSwapSubgraphClient();

// Export convenience functions
export const getAllTokens = () => pancakeSwapSubgraphClient.getAllTokens();
export const getTokenByAddress = (address: string) =>
  pancakeSwapSubgraphClient.getTokenByAddress(address);
export const getTopPairs = (first?: number) =>
  pancakeSwapSubgraphClient.getTopPairs(first);
export const getETHPrice = () => pancakeSwapSubgraphClient.getETHPrice();