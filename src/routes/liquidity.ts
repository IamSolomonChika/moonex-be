import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { LiquidityService, Token, CreatePoolRequest, AddLiquidityRequest, RemoveLiquidityRequest } from '../services/liquidity';
import { AuthenticatedRequest } from '../middleware/auth';
import logger from '../utils/logger';

/**
 * Create pool request body
 */
interface CreatePoolRequestBody {
  token0: {
    address: string;
    symbol: string;
    decimals: number;
  };
  token1: {
    address: string;
    symbol: string;
    decimals: number;
  };
  fee?: string;
  initialAmount0?: string;
  initialAmount1?: string;
}

/**
 * Add liquidity request body
 */
interface AddLiquidityRequestBody {
  poolId: string;
  amount0: string;
  amount1: string;
  slippageTolerance?: string;
  minimumLPTokens?: string;
}

/**
 * Remove liquidity request body
 */
interface RemoveLiquidityRequestBody {
  poolId: string;
  lpTokenAmount: string;
  slippageTolerance?: string;
  minimumAmount0?: string;
  minimumAmount1?: string;
}

/**
 * Initialize liquidity service
 */
const liquidityService = new LiquidityService();

/**
 * Liquidity pool routes plugin
 */
export async function liquidityRoutes(fastify: FastifyInstance) {

  /**
   * Create new liquidity pool
   */
  fastify.post<{ Body: CreatePoolRequestBody }>('/pools/create', {
    schema: {
      body: {
        type: 'object',
        required: ['token0', 'token1'],
        properties: {
          token0: {
            type: 'object',
            required: ['address', 'symbol', 'decimals'],
            properties: {
              address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
              symbol: { type: 'string', minLength: 1, maxLength: 10 },
              decimals: { type: 'integer', minimum: 0, maximum: 18 }
            }
          },
          token1: {
            type: 'object',
            required: ['address', 'symbol', 'decimals'],
            properties: {
              address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
              symbol: { type: 'string', minLength: 1, maxLength: 10 },
              decimals: { type: 'integer', minimum: 0, maximum: 18 }
            }
          },
          fee: { type: 'string', pattern: '^0\\.[0-9]+$' },
          initialAmount0: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
          initialAmount1: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' }
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

      const body = request.body as CreatePoolRequestBody;
      const { token0, token1, fee, initialAmount0, initialAmount1 } = body;

      if (token0.address === token1.address) {
        return reply.code(400).send({
          success: false,
          error: 'Token addresses must be different'
        });
      }

      const createRequest: CreatePoolRequest = {
        token0,
        token1,
        fee,
        initialAmount0,
        initialAmount1
      };

      const result = await liquidityService.createPool(createRequest);

      if (!result.success) {
        return reply.code(400).send(result);
      }

      logger.info(`Pool created by user ${request.user.id}: ${token0.symbol}/${token1.symbol}`);

      return reply.code(201).send({
        success: true,
        pool: result.pool,
        lpTokens: result.lpTokens
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to create pool');
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Add liquidity to existing pool
   */
  fastify.post<{ Body: AddLiquidityRequestBody }>('/pools/add-liquidity', {
    schema: {
      body: {
        type: 'object',
        required: ['poolId', 'amount0', 'amount1'],
        properties: {
          poolId: { type: 'string' },
          amount0: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
          amount1: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
          slippageTolerance: { type: 'string', pattern: '^0\\.[0-9]+$' },
          minimumLPTokens: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required'
        });
      }

      const addBody = request.body as AddLiquidityRequestBody;
      const { poolId, amount0, amount1, slippageTolerance, minimumLPTokens } = addBody;

      const addRequest: AddLiquidityRequest = {
        poolId,
        amount0,
        amount1,
        slippageTolerance,
        minimumLPTokens,
        userAddress: request.user.id
      };

      const result = await liquidityService.addLiquidity(addRequest);

      if (!result.success) {
        return reply.code(400).send(result);
      }

      logger.info(`Liquidity added by user ${request.user.id} to pool ${poolId}: ${amount0} + ${amount1}`);

      return reply.code(200).send({
        success: true,
        pool: result.pool,
        lpTokens: result.lpTokens,
        amounts: result.amounts
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to add liquidity');
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Remove liquidity from pool
   */
  fastify.post<{ Body: RemoveLiquidityRequestBody }>('/pools/remove-liquidity', {
    schema: {
      body: {
        type: 'object',
        required: ['poolId', 'lpTokenAmount'],
        properties: {
          poolId: { type: 'string' },
          lpTokenAmount: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
          slippageTolerance: { type: 'string', pattern: '^0\\.[0-9]+$' },
          minimumAmount0: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
          minimumAmount1: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required'
        });
      }

      const removeBody = request.body as RemoveLiquidityRequestBody;
      const { poolId, lpTokenAmount, slippageTolerance, minimumAmount0, minimumAmount1 } = removeBody;

      const removeRequest: RemoveLiquidityRequest = {
        poolId,
        lpTokenAmount,
        slippageTolerance,
        minimumAmount0,
        minimumAmount1,
        userAddress: request.user.id
      };

      const result = await liquidityService.removeLiquidity(removeRequest);

      if (!result.success) {
        return reply.code(400).send(result);
      }

      logger.info(`Liquidity removed by user ${request.user.id} from pool ${poolId}: ${lpTokenAmount} LP tokens`);

      return reply.code(200).send({
        success: true,
        pool: result.pool,
        amounts: result.amounts,
        impermanentLoss: result.impermanentLoss
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to remove liquidity');
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Get all liquidity pools
   */
  fastify.get('/pools', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const pools = await liquidityService.getAllPools();

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
   * Get specific pool by ID
   */
  fastify.get<{
    Params: { poolId: string }
  }>('/pools/:poolId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          poolId: { type: 'string' }
        },
        required: ['poolId']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as { poolId: string };
      const { poolId } = params;

      const pool = await liquidityService.getPoolById(poolId);

      if (!pool) {
        return reply.code(404).send({
          success: false,
          error: 'Pool not found'
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
   * Get pool by token pair
   */
  fastify.get<{
    Params: { tokenA: string; tokenB: string }
  }>('/pools/:tokenA/:tokenB', {
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

      // Mock token objects - in production, fetch from token registry
      const tokenAObj: Token = {
        address: tokenA,
        symbol: 'TOKENA',
        decimals: 18
      };

      const tokenBObj: Token = {
        address: tokenB,
        symbol: 'TOKENB',
        decimals: 18
      };

      const pool = await liquidityService.getPoolByTokenPair(tokenAObj, tokenBObj);

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
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get pool by token pair');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve pool'
      });
    }
  });

  /**
   * Get pool analytics
   */
  fastify.get<{
    Params: { poolId: string }
  }>('/pools/:poolId/analytics', {
    schema: {
      params: {
        type: 'object',
        properties: {
          poolId: { type: 'string' }
        },
        required: ['poolId']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as { poolId: string };
      const { poolId } = params;

      const analytics = await liquidityService.getPoolAnalytics(poolId);

      if (!analytics) {
        return reply.code(404).send({
          success: false,
          error: 'Pool not found'
        });
      }

      return reply.code(200).send({
        success: true,
        analytics
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get pool analytics');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve analytics'
      });
    }
  });

  /**
   * Get user's liquidity positions
   */
  fastify.get('/positions', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required'
        });
      }

      const positions = await liquidityService.getUserPositions(request.user.id);

      return reply.code(200).send({
        success: true,
        positions,
        count: positions.length
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get user positions');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve positions'
      });
    }
  });

  /**
   * Health check for liquidity service
   */
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const pools = await liquidityService.getAllPools();

      return reply.code(200).send({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          liquidityService: 'operational',
          database: 'operational'
        },
        poolCount: pools.length
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Liquidity health check failed');
      return reply.code(503).send({
        success: false,
        status: 'unhealthy',
        error: 'Liquidity service unavailable'
      });
    }
  });
}