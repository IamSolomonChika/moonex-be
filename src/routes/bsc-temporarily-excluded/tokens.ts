/**
 * BSC Token Routes
 * API endpoints for BSC token management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import logger from '../../utils/logger.js';
import {
  bscTokenService,
  tokenMetadataService,
  tokenVerificationService,
  tokenPriceTracker,
  type TokenFilter,
  type TokenCategory,
  type TokenTag,
  type TokenRiskLevel
} from '../../bsc/services/tokens/index.js';

/**
 * Token query parameters schema
 */
const TokenQuerySchema = {
  type: 'object',
  properties: {
    search: { type: 'string' },
    category: {
      type: 'string',
      enum: ['currency', 'defi', 'gaming', 'nft', 'meme', 'stablecoin', 'governance', 'yield', 'bridge', 'layer2', 'exchange', 'lending', 'insurance', 'oracle', 'storage', 'other']
    },
    tags: { type: 'array', items: { type: 'string' } },
    riskLevel: {
      type: 'string',
      enum: ['very_low', 'low', 'medium', 'high', 'very_high']
    },
    minLiquidityUSD: { type: 'number', minimum: 0 },
    minVolume24h: { type: 'number', minimum: 0 },
    verified: { type: 'boolean' },
    listed: { type: 'boolean' },
    sortBy: {
      type: 'string',
      enum: ['name', 'symbol', 'priceUSD', 'marketCap', 'volume24hUSD', 'liquidityUSD', 'priceChange24h', 'createdAt', 'discoveredAt']
    },
    sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
    limit: { type: 'number', minimum: 1, maximum: 1000, default: 100 },
    offset: { type: 'number', minimum: 0, default: 0 }
  }
};

/**
 * Token address parameter schema
 */
const TokenAddressSchema = {
  type: 'object',
  properties: {
    address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
  },
  required: ['address']
};

/**
 * Register token routes
 */
export async function tokenRoutes(fastify: FastifyInstance) {
  logger.info('Registering BSC token routes');

  /**
   * Get all tokens with filtering and pagination
   */
  fastify.get('/tokens', {
    schema: {
      querystring: TokenQuerySchema,
      description: 'Get all BSC tokens with optional filtering',
      tags: ['bsc', 'tokens']
    }
  }, async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    try {
      const filter: TokenFilter = {
        search: request.query.search,
        category: request.query.category as TokenCategory,
        tags: request.query.tags as TokenTag[],
        riskLevel: request.query.riskLevel as TokenRiskLevel,
        minLiquidityUSD: request.query.minLiquidityUSD,
        minVolume24h: request.query.minVolume24h,
        verified: request.query.verified,
        listed: request.query.listed,
        sortBy: request.query.sortBy,
        sortOrder: request.query.sortOrder,
        limit: request.query.limit,
        offset: request.query.offset
      };

      const result = await bscTokenService.getAllTokens(filter);

      return reply.send({
        success: true,
        data: result,
        meta: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasMore: result.hasMore
        }
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get tokens');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch tokens',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get token by address
   */
  fastify.get('/tokens/:address', {
    schema: {
      params: TokenAddressSchema,
      description: 'Get BSC token by contract address',
      tags: ['bsc', 'tokens']
    }
  }, async (request: FastifyRequest<{ Params: { address: string } }>, reply: FastifyReply) => {
    try {
      const { address } = request.params;
      const token = await bscTokenService.getTokenByAddress(address);

      if (!token) {
        return reply.status(404).send({
          success: false,
          error: 'Token not found',
          message: `Token with address ${address} not found`
        });
      }

      return reply.send({
        success: true,
        data: token
      });

    } catch (error) {
      logger.error({ address: request.params.address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get token');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch token',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Search tokens
   */
  fastify.get('/tokens/search/:query', {
    schema: {
      params: {
        type: 'object',
        properties: {
          query: { type: 'string', minLength: 1, maxLength: 100 }
        },
        required: ['query']
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 50, default: 20 }
        }
      },
      description: 'Search BSC tokens by name or symbol',
      tags: ['bsc', 'tokens']
    }
  }, async (request: FastifyRequest<{ Params: { query: string }, Querystring: { limit?: number } }>, reply: FastifyReply) => {
    try {
      const { query } = request.params;
      const { limit = 20 } = request.query;

      const tokens = await bscTokenService.searchTokens(query, limit);

      return reply.send({
        success: true,
        data: tokens,
        meta: {
          query,
          count: tokens.length,
          limit
        }
      });

    } catch (error) {
      logger.error({ query: request.params.query, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to search tokens');
      return reply.status(500).send({
        success: false,
        error: 'Failed to search tokens',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get token price
   */
  fastify.get('/tokens/:address/price', {
    schema: {
      params: TokenAddressSchema,
      description: 'Get current token price',
      tags: ['bsc', 'tokens', 'price']
    }
  }, async (request: FastifyRequest<{ Params: { address: string } }>, reply: FastifyReply) => {
    try {
      const { address } = request.params;
      const priceData = await tokenPriceTracker.getTokenPrice(address);

      if (!priceData) {
        return reply.status(404).send({
          success: false,
          error: 'Price data not found',
          message: `Unable to fetch price for token ${address}`
        });
      }

      return reply.send({
        success: true,
        data: priceData
      });

    } catch (error) {
      logger.error({ address: request.params.address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get token price');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch token price',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get multiple token prices
   */
  fastify.post('/tokens/prices', {
    schema: {
      body: {
        type: 'object',
        properties: {
          addresses: {
            type: 'array',
            items: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
            minItems: 1,
            maxItems: 100
          }
        },
        required: ['addresses']
      },
      description: 'Get prices for multiple tokens',
      tags: ['bsc', 'tokens', 'price']
    }
  }, async (request: FastifyRequest<{ Body: { addresses: string[] } }>, reply: FastifyReply) => {
    try {
      const { addresses } = request.body;
      const priceData = await tokenPriceTracker.getTokenPrices(addresses);

      return reply.send({
        success: true,
        data: priceData,
        meta: {
          requested: addresses.length,
          received: priceData.length
        }
      });

    } catch (error) {
      logger.error({ addresses: request.body.addresses, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get multiple token prices');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch token prices',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get token price history
   */
  fastify.get('/tokens/:address/price/history', {
    schema: {
      params: TokenAddressSchema,
      querystring: {
        type: 'object',
        properties: {
          timeframe: { type: 'string', enum: ['1h', '24h', '7d', '30d', '90d'], default: '24h' },
          from: { type: 'number' },
          to: { type: 'number' }
        }
      },
      description: 'Get token price history',
      tags: ['bsc', 'tokens', 'price', 'history']
    }
  }, async (request: FastifyRequest<{
    Params: { address: string },
    Querystring: { timeframe?: string; from?: number; to?: number }
  }>, reply: FastifyReply) => {
    try {
      const { address } = request.params;
      const { timeframe = '24h', from, to } = request.query;

      // Calculate time range if not provided
      const now = Date.now();
      let fromTime = from;
      let toTime = to || now;

      if (!fromTime) {
        switch (timeframe) {
          case '1h':
            fromTime = now - 60 * 60 * 1000;
            break;
          case '24h':
            fromTime = now - 24 * 60 * 60 * 1000;
            break;
          case '7d':
            fromTime = now - 7 * 24 * 60 * 60 * 1000;
            break;
          case '30d':
            fromTime = now - 30 * 24 * 60 * 60 * 1000;
            break;
          case '90d':
            fromTime = now - 90 * 24 * 60 * 60 * 1000;
            break;
        }
      }

      const history = await tokenPriceTracker.getHistoricalPrices(address, fromTime, toTime);

      return reply.send({
        success: true,
        data: history,
        meta: {
          address,
          timeframe,
          from: fromTime,
          to: toTime,
          points: history.length
        }
      });

    } catch (error) {
      logger.error({ address: request.params.address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get token price history');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch price history',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get token analytics
   */
  fastify.get('/tokens/:address/analytics', {
    schema: {
      params: TokenAddressSchema,
      querystring: {
        type: 'object',
        properties: {
          timeframe: { type: 'string', enum: ['24h', '7d', '30d'], default: '24h' }
        }
      },
      description: 'Get detailed token analytics',
      tags: ['bsc', 'tokens', 'analytics']
    }
  }, async (request: FastifyRequest<{
    Params: { address: string },
    Querystring: { timeframe?: string }
  }>, reply: FastifyReply) => {
    try {
      const { address } = request.params;
      const { timeframe = '24h' } = request.query;

      const analytics = await tokenPriceTracker.getPriceAnalytics(address, timeframe);

      return reply.send({
        success: true,
        data: analytics,
        meta: {
          address,
          timeframe
        }
      });

    } catch (error) {
      logger.error({ address: request.params.address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get token analytics');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch token analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get token liquidity
   */
  fastify.get('/tokens/:address/liquidity', {
    schema: {
      params: TokenAddressSchema,
      description: 'Get token liquidity information',
      tags: ['bsc', 'tokens', 'liquidity']
    }
  }, async (request: FastifyRequest<{ Params: { address: string } }>, reply: FastifyReply) => {
    try {
      const { address } = request.params;
      const liquidityData = await tokenPriceTracker.getTokenLiquidity(address);

      if (!liquidityData) {
        return reply.status(404).send({
          success: false,
          error: 'Liquidity data not found',
          message: `Unable to fetch liquidity for token ${address}`
        });
      }

      return reply.send({
        success: true,
        data: liquidityData
      });

    } catch (error) {
      logger.error({ address: request.params.address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get token liquidity');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch token liquidity',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Verify token
   */
  fastify.get('/tokens/:address/verify', {
    schema: {
      params: TokenAddressSchema,
      description: 'Verify token contract and get safety information',
      tags: ['bsc', 'tokens', 'verification']
    }
  }, async (request: FastifyRequest<{ Params: { address: string } }>, reply: FastifyReply) => {
    try {
      const { address } = request.params;
      const verificationStatus = await tokenVerificationService.verifyToken(address);

      return reply.send({
        success: true,
        data: verificationStatus
      });

    } catch (error) {
      logger.error({ address: request.params.address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to verify token');
      return reply.status(500).send({
        success: false,
        error: 'Failed to verify token',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Validate token
   */
  fastify.get('/tokens/:address/validate', {
    schema: {
      params: TokenAddressSchema,
      description: 'Perform comprehensive token validation',
      tags: ['bsc', 'tokens', 'validation']
    }
  }, async (request: FastifyRequest<{ Params: { address: string } }>, reply: FastifyReply) => {
    try {
      const { address } = request.params;
      const validationResult = await tokenVerificationService.validateToken(address);

      return reply.send({
        success: true,
        data: validationResult
      });

    } catch (error) {
      logger.error({ address: request.params.address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to validate token');
      return reply.status(500).send({
        success: false,
        error: 'Failed to validate token',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get token metrics
   */
  fastify.get('/tokens/metrics', {
    schema: {
      description: 'Get overall token metrics and statistics',
      tags: ['bsc', 'tokens', 'metrics']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = await bscTokenService.getTokenMetrics();

      return reply.send({
        success: true,
        data: metrics
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get token metrics');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch token metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get top tokens by liquidity
   */
  fastify.get('/tokens/top/liquidity', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 }
        }
      },
      description: 'Get top tokens by liquidity',
      tags: ['bsc', 'tokens', 'top']
    }
  }, async (request: FastifyRequest<{ Querystring: { limit?: number } }>, reply: FastifyReply) => {
    try {
      const { limit = 50 } = request.query;
      const tokens = await bscTokenService.getTopTokensByLiquidity(limit);

      return reply.send({
        success: true,
        data: tokens,
        meta: {
          limit,
          count: tokens.length
        }
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get top tokens by liquidity');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch top tokens',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get top tokens by volume
   */
  fastify.get('/tokens/top/volume', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 }
        }
      },
      description: 'Get top tokens by trading volume',
      tags: ['bsc', 'tokens', 'top']
    }
  }, async (request: FastifyRequest<{ Querystring: { limit?: number } }>, reply: FastifyReply) => {
    try {
      const { limit = 50 } = request.query;
      const tokens = await bscTokenService.getTopTokensByVolume(limit);

      return reply.send({
        success: true,
        data: tokens,
        meta: {
          limit,
          count: tokens.length
        }
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get top tokens by volume');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch top tokens',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Discover new tokens
   */
  fastify.post('/tokens/discover', {
    schema: {
      body: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
        }
      },
      description: 'Discover new BSC tokens',
      tags: ['bsc', 'tokens', 'discovery']
    }
  }, async (request: FastifyRequest<{ Body: { limit?: number } }>, reply: FastifyReply) => {
    try {
      const { limit = 20 } = request.body;
      const tokens = await bscTokenService.discoverTokens(limit);

      return reply.send({
        success: true,
        data: tokens,
        meta: {
          limit,
          discovered: tokens.length
        }
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to discover tokens');
      return reply.status(500).send({
        success: false,
        error: 'Failed to discover tokens',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Submit token for discovery
   */
  fastify.post('/tokens/submit', {
    schema: {
      body: {
        type: 'object',
        properties: {
          address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        },
        required: ['address']
      },
      description: 'Submit a token address for discovery and verification',
      tags: ['bsc', 'tokens', 'discovery']
    }
  }, async (request: FastifyRequest<{ Body: { address: string } }>, reply: FastifyReply) => {
    try {
      const { address } = request.body;

      // First validate the contract
      const isValid = await tokenMetadataService.validateTokenContract(address);
      if (!isValid) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid token contract',
          message: 'The provided address is not a valid ERC-20 token contract'
        });
      }

      // Discover and enrich the token
      const token = await bscTokenService.getTokenByAddress(address);

      if (token) {
        return reply.send({
          success: true,
          data: token,
          message: 'Token already exists in database'
        });
      }

      // Create new token entry
      const newToken = await tokenMetadataService.enrichTokenMetadata(address);

      return reply.send({
        success: true,
        data: newToken,
        message: 'Token successfully submitted for discovery'
      });

    } catch (error) {
      logger.error({ address: request.body.address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to submit token');
      return reply.status(500).send({
        success: false,
        error: 'Failed to submit token',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  logger.info('BSC token routes registered successfully');
}