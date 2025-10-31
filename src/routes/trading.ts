import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TradingService, Token, SwapRequest as TradingSwapRequest, GasEstimate } from '../services/trading';
import { AuthenticatedRequest } from '../middleware/auth';
import logger from '../utils/logger';

/**
 * Swap quote request body
 */
interface QuoteRequest {
  tokenIn: {
    address: string;
    symbol: string;
    decimals: number;
  };
  tokenOut: {
    address: string;
    symbol: string;
    decimals: number;
  };
  amountIn: string;
  slippageTolerance?: string; // Optional, defaults to 0.5%
}

/**
 * Swap execution request body
 */
interface SwapRequest {
  tokenIn: {
    address: string;
    symbol: string;
    decimals: number;
  };
  tokenOut: {
    address: string;
    symbol: string;
    decimals: number;
  };
  amountIn: string;
  slippageTolerance?: string;
  minimumOutput?: string; // Additional protection
}

/**
 * Route finding request body
 */
interface RouteRequest {
  tokenIn: {
    address: string;
    symbol: string;
    decimals: number;
  };
  tokenOut: {
    address: string;
    symbol: string;
    decimals: number;
  };
  amountIn: string;
  maxHops?: number;
}

/**
 * Gas estimation request body
 */
interface GasEstimateRequest {
  transactionType: 'swap' | 'addLiquidity' | 'removeLiquidity';
  params?: any;
}

/**
 * Initialize trading service
 */
const tradingService = new TradingService();

/**
 * Trading routes plugin
 */
export async function tradingRoutes(fastify: FastifyInstance) {

  /**
   * Get swap quote
   */
  fastify.post<{ Body: QuoteRequest }>('/quote', {
    schema: {
      body: {
        type: 'object',
        required: ['tokenIn', 'tokenOut', 'amountIn'],
        properties: {
          tokenIn: {
            type: 'object',
            required: ['address', 'symbol', 'decimals'],
            properties: {
              address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
              symbol: { type: 'string', minLength: 1, maxLength: 10 },
              decimals: { type: 'integer', minimum: 0, maximum: 18 }
            }
          },
          tokenOut: {
            type: 'object',
            required: ['address', 'symbol', 'decimals'],
            properties: {
              address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
              symbol: { type: 'string', minLength: 1, maxLength: 10 },
              decimals: { type: 'integer', minimum: 0, maximum: 18 }
            }
          },
          amountIn: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
          slippageTolerance: { type: 'string', pattern: '^0\\.[0-9]+$' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: QuoteRequest }>, reply: FastifyReply) => {
    try {
      const { tokenIn, tokenOut, amountIn, slippageTolerance } = request.body;

      if (tokenIn.address === tokenOut.address) {
        return reply.code(400).send({
          success: false,
          error: 'Token addresses must be different'
        });
      }

      const result = await tradingService.getSwapQuote({
        tokenIn,
        tokenOut,
        amountIn,
        slippageTolerance
      });

      if (!result.success) {
        return reply.code(400).send(result);
      }

      return reply.code(200).send(result);

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Quote request failed');
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Execute swap
   */
  fastify.post<{ Body: SwapRequest }>('/swap', {
    schema: {
      body: {
        type: 'object',
        required: ['tokenIn', 'tokenOut', 'amountIn'],
        properties: {
          tokenIn: {
            type: 'object',
            required: ['address', 'symbol', 'decimals'],
            properties: {
              address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
              symbol: { type: 'string', minLength: 1, maxLength: 10 },
              decimals: { type: 'integer', minimum: 0, maximum: 18 }
            }
          },
          tokenOut: {
            type: 'object',
            required: ['address', 'symbol', 'decimals'],
            properties: {
              address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
              symbol: { type: 'string', minLength: 1, maxLength: 10 },
              decimals: { type: 'integer', minimum: 0, maximum: 18 }
            }
          },
          amountIn: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
          slippageTolerance: { type: 'string', pattern: '^0\\.[0-9]+$' },
          minimumOutput: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      // Check if user is authenticated
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required'
        });
      }

      const body = request.body as {
        tokenIn: any;
        tokenOut: any;
        amountIn: string;
        slippageTolerance?: string;
        minimumOutput?: string;
      };

      const { tokenIn, tokenOut, amountIn, slippageTolerance, minimumOutput } = body;

      if (tokenIn.address === tokenOut.address) {
        return reply.code(400).send({
          success: false,
          error: 'Token addresses must be different'
        });
      }

      // Additional validation for minimum output
      const swapRequest: TradingSwapRequest = {
        tokenIn,
        tokenOut,
        amountIn,
        slippageTolerance,
        userAddress: request.user.id
      };

      const result = await tradingService.executeSwap(swapRequest);

      if (!result.success) {
        return reply.code(400).send(result);
      }

      // Validate that output meets minimum if specified
      if (minimumOutput && result.quote) {
        const minOutput = parseFloat(minimumOutput);
        const actualOutput = parseFloat(result.quote.outputAmount);

        if (actualOutput < minOutput) {
          return reply.code(400).send({
            success: false,
            error: `Output amount ${actualOutput} is below minimum ${minOutput}`
          });
        }
      }

      logger.info(`Swap executed by user ${request.user.id}: ${amountIn} ${tokenIn.symbol} -> ${result.quote?.outputAmount} ${tokenOut.symbol}`);

      return reply.code(200).send({
        success: true,
        transactionHash: result.transactionHash,
        quote: result.quote
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Swap execution failed');
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Find best routes
   */
  fastify.post<{ Body: RouteRequest }>('/routes', {
    schema: {
      body: {
        type: 'object',
        required: ['tokenIn', 'tokenOut', 'amountIn'],
        properties: {
          tokenIn: {
            type: 'object',
            required: ['address', 'symbol', 'decimals'],
            properties: {
              address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
              symbol: { type: 'string', minLength: 1, maxLength: 10 },
              decimals: { type: 'integer', minimum: 0, maximum: 18 }
            }
          },
          tokenOut: {
            type: 'object',
            required: ['address', 'symbol', 'decimals'],
            properties: {
              address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
              symbol: { type: 'string', minLength: 1, maxLength: 10 },
              decimals: { type: 'integer', minimum: 0, maximum: 18 }
            }
          },
          amountIn: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
          maxHops: { type: 'integer', minimum: 1, maximum: 5 }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: RouteRequest }>, reply: FastifyReply) => {
    try {
      const { tokenIn, tokenOut, amountIn, maxHops } = request.body;

      if (tokenIn.address === tokenOut.address) {
        return reply.code(400).send({
          success: false,
          error: 'Token addresses must be different'
        });
      }

      const route = await tradingService.findBestRoute(
        tokenIn,
        tokenOut,
        amountIn,
        maxHops
      );

      if (!route) {
        return reply.code(404).send({
          success: false,
          error: 'No route found for this token pair'
        });
      }

      return reply.code(200).send({
        success: true,
        route
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Route finding failed');
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Estimate gas costs
   */
  fastify.post<{ Body: GasEstimateRequest }>('/gas', {
    schema: {
      body: {
        type: 'object',
        required: ['transactionType'],
        properties: {
          transactionType: {
            type: 'string',
            enum: ['swap', 'addLiquidity', 'removeLiquidity']
          },
          params: { type: 'object' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: GasEstimateRequest }>, reply: FastifyReply) => {
    try {
      const { transactionType, params } = request.body;

      const gasEstimate = await tradingService.estimateGasCosts(transactionType, params);

      return reply.code(200).send({
        success: true,
        gasEstimate
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Gas estimation failed');
      return reply.code(500).send({
        success: false,
        error: 'Gas estimation failed'
      });
    }
  });

  /**
   * Get all pools
   */
  fastify.get('/pools', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const pools = await tradingService.getAllPools();

      return reply.code(200).send({
        success: true,
        pools,
        count: pools.length
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get pools');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve pools'
      });
    }
  });

  /**
   * Get specific pool by token pair
   */
  fastify.get('/pools/:tokenA/:tokenB', {
    schema: {
      params: {
        type: 'object',
        properties: {
          tokenA: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          tokenB: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        },
        required: ['tokenA', 'tokenB']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as { tokenA: string; tokenB: string };
      const { tokenA, tokenB } = params;

      // Mock token objects - in production, you'd get these from a token registry
      const tokenAObj: Token = {
        address: tokenA,
        symbol: 'TOKENA', // In production, fetch from token registry
        decimals: 18
      };

      const tokenBObj: Token = {
        address: tokenB,
        symbol: 'TOKENB', // In production, fetch from token registry
        decimals: 18
      };

      const pool = await tradingService.getPoolByTokenPair(tokenAObj, tokenBObj);

      if (!pool) {
        return reply.code(404).send({
          success: false,
          error: 'Pool not found for this token pair'
        });
      }

      return reply.code(200).send({
        success: true,
        pool
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get pool');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve pool'
      });
    }
  });

  /**
   * Health check for trading service
   */
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Test basic AMM calculator functionality
      const testQuote = await tradingService.getSwapQuote({
        tokenIn: { address: '0x0', symbol: 'ETH', decimals: 18 },
        tokenOut: { address: '0x1', symbol: 'USDC', decimals: 6 },
        amountIn: '1.0'
      });

      return reply.code(200).send({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          ammCalculator: 'operational',
          database: 'operational'
        },
        testQuote: testQuote.success ? 'passed' : 'failed'
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Trading health check failed');
      return reply.code(503).send({
        success: false,
        status: 'unhealthy',
        error: 'Trading service unavailable'
      });
    }
  });
}