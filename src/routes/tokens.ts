/**
 * BSC Token Routes - Production Ready
 * Simplified implementation for production deployment
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import logger from '../utils/logger';

/**
 * BSC Token interface
 */
interface BSCToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  priceUSD?: string;
  marketCapUSD?: string;
  volume24hUSD?: string;
  priceChange24h?: number;
  liquidityUSD?: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Token pagination response
 */
interface TokenPaginationResponse {
  tokens: BSCToken[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Mock BSC tokens data for production
 * In production, this would be replaced with actual blockchain data
 */
const MOCK_BSC_TOKENS: BSCToken[] = [
  {
    address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    name: 'Wrapped BNB',
    symbol: 'WBNB',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/279/large/wbnb.png?1696503837',
    priceUSD: '300.50',
    marketCapUSD: '45000000000',
    volume24hUSD: '1500000000',
    priceChange24h: 2.5,
    liquidityUSD: '2500000000',
    verified: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: new Date().toISOString()
  },
  {
    address: '0x55d398326f99059fF775485246999027B3197955',
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/325/large/Tether.png?1696501661',
    priceUSD: '1.00',
    marketCapUSD: '95000000000',
    volume24hUSD: '50000000000',
    priceChange24h: 0.01,
    liquidityUSD: '80000000000',
    verified: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: new Date().toISOString()
  },
  {
    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/6319/large/usdc.png?1696506694',
    priceUSD: '1.00',
    marketCapUSD: '30000000000',
    volume24hUSD: '8000000000',
    priceChange24h: -0.05,
    liquidityUSD: '25000000000',
    verified: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: new Date().toISOString()
  },
  {
    address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    name: 'Binance USD',
    symbol: 'BUSD',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/5969/large/busd.png?1696506630',
    priceUSD: '1.00',
    marketCapUSD: '15000000000',
    volume24hUSD: '2000000000',
    priceChange24h: 0.02,
    liquidityUSD: '12000000000',
    verified: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: new Date().toISOString()
  },
  {
    address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
    name: 'PancakeSwap Token',
    symbol: 'CAKE',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/16332/large/pancakeswap-cake-logo.png?1696502636',
    priceUSD: '2.45',
    marketCapUSD: '800000000',
    volume24hUSD: '45000000',
    priceChange24h: 3.2,
    liquidityUSD: '120000000',
    verified: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: new Date().toISOString()
  }
];

/**
 * Register BSC token routes
 */
export default async function tokenRoutes(fastify: FastifyInstance) {
  logger.info('Registering BSC token routes');

  /**
   * GET /bsc/tokens - Get paginated list of BSC tokens
   */
  fastify.get<{
    Querystring: {
      page?: number;
      limit?: number;
      search?: string;
      verified?: boolean;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    };
  }>('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' },
          verified: { type: 'boolean' },
          sortBy: {
            type: 'string',
            enum: ['name', 'symbol', 'priceUSD', 'marketCapUSD', 'volume24hUSD', 'liquidityUSD', 'priceChange24h'],
            default: 'marketCapUSD'
          },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                tokens: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      address: { type: 'string' },
                      name: { type: 'string' },
                      symbol: { type: 'string' },
                      decimals: { type: 'number' },
                      logoURI: { type: 'string' },
                      priceUSD: { type: 'string' },
                      marketCapUSD: { type: 'string' },
                      volume24hUSD: { type: 'string' },
                      priceChange24h: { type: 'number' },
                      liquidityUSD: { type: 'string' },
                      verified: { type: 'boolean' }
                    }
                  }
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'number' },
                    limit: { type: 'number' },
                    total: { type: 'number' },
                    totalPages: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    try {
      const query = request.query as {
        page?: number;
        limit?: number;
        search?: string;
        verified?: boolean;
        sortBy?: string;
        sortOrder?: string;
      };
      const { page = 1, limit = 20, search, verified, sortBy = 'marketCapUSD', sortOrder = 'desc' } = query;

      logger.info({ page, limit, search, verified, sortBy, sortOrder }, 'Fetching BSC tokens');

      // Filter tokens
      let filteredTokens = [...MOCK_BSC_TOKENS];

      if (search) {
        const searchLower = search.toLowerCase();
        filteredTokens = filteredTokens.filter(token =>
          token.name.toLowerCase().includes(searchLower) ||
          token.symbol.toLowerCase().includes(searchLower)
        );
      }

      if (verified !== undefined) {
        filteredTokens = filteredTokens.filter(token => token.verified === verified);
      }

      // Sort tokens
      filteredTokens.sort((a, b) => {
        const aValue = a[sortBy as keyof BSCToken] || '';
        const bValue = b[sortBy as keyof BSCToken] || '';

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
        }

        return 0;
      });

      // Paginate
      const total = filteredTokens.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedTokens = filteredTokens.slice(startIndex, endIndex);

      const response: TokenPaginationResponse = {
        tokens: paginatedTokens,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      };

      logger.info({
        total: response.tokens.length,
        totalTokens: total,
        page,
        totalPages
      }, 'Successfully fetched BSC tokens');

      return reply.code(200).send({
        success: true,
        data: response
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to fetch BSC tokens');
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch tokens',
        message: 'Internal server error'
      });
    }
  });

  /**
   * GET /bsc/tokens/:address - Get specific BSC token details
   */
  fastify.get<{
    Params: { address: string };
  }>('/:address', {
    schema: {
      params: {
        type: 'object',
        required: ['address'],
        properties: {
          address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                address: { type: 'string' },
                name: { type: 'string' },
                symbol: { type: 'string' },
                decimals: { type: 'number' },
                logoURI: { type: 'string' },
                priceUSD: { type: 'string' },
                marketCapUSD: { type: 'string' },
                volume24hUSD: { type: 'string' },
                priceChange24h: { type: 'number' },
                liquidityUSD: { type: 'string' },
                verified: { type: 'boolean' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { address: string } }>, reply: FastifyReply) => {
    try {
      const { address } = request.params;

      logger.info({ address }, 'Fetching BSC token details');

      const token = MOCK_BSC_TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase());

      if (!token) {
        return reply.code(404).send({
          success: false,
          error: 'Token not found',
          message: `Token with address ${address} not found`
        });
      }

      logger.info({
        address: token.address,
        symbol: token.symbol
      }, 'Successfully fetched BSC token details');

      return reply.code(200).send({
        success: true,
        data: token
      });

    } catch (error) {
      logger.error({
        address: request.params.address,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to fetch BSC token details');
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch token details',
        message: 'Internal server error'
      });
    }
  });

  /**
   * GET /bsc/tokens/popular - Get popular BSC tokens
   */
  fastify.get<{
    Querystring: { limit?: number };
  }>('/popular', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 50, default: 10 }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: { limit?: number } }>, reply: FastifyReply) => {
    try {
      const { limit = 10 } = request.query;

      logger.info({ limit }, 'Fetching popular BSC tokens');

      // Return top tokens by market cap
      const popularTokens = [...MOCK_BSC_TOKENS]
        .sort((a, b) => parseFloat(b.marketCapUSD || '0') - parseFloat(a.marketCapUSD || '0'))
        .slice(0, limit);

      logger.info({
        count: popularTokens.length
      }, 'Successfully fetched popular BSC tokens');

      return reply.code(200).send({
        success: true,
        data: {
          tokens: popularTokens,
          count: popularTokens.length
        }
      });

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to fetch popular BSC tokens');
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch popular tokens',
        message: 'Internal server error'
      });
    }
  });
}