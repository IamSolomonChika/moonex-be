import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { YieldFarmingService, CreateFarmRequest, StakeRequest, UnstakeRequest, ClaimRewardsRequest } from '../services/yield';
import { AuthenticatedRequest } from '../middleware/auth';
import logger from '../utils/logger';

/**
 * Create farm request body
 */
interface CreateFarmRequestBody {
  name: string;
  description?: string;
  poolId: string;
  rewardToken: {
    address: string;
    symbol: string;
    decimals: number;
  };
  rewardRate: string;
  totalRewards?: string;
  durationDays?: number;
  startsAt?: string;
  endsAt?: string;
}

/**
 * Stake request body
 */
interface StakeRequestBody {
  farmId: string;
  amount: string;
}

/**
 * Unstake request body
 */
interface UnstakeRequestBody {
  farmId: string;
  amount: string;
}

/**
 * Claim rewards request body
 */
interface ClaimRewardsRequestBody {
  farmId: string;
}

/**
 * Initialize yield farming service
 */
const yieldFarmingService = new YieldFarmingService();

/**
 * Yield farming routes plugin
 */
export async function yieldRoutes(fastify: FastifyInstance) {

  /**
   * Create new yield farm
   */
  fastify.post<{ Body: CreateFarmRequestBody }>('/farms/create', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'poolId', 'rewardToken', 'rewardRate'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100
          },
          description: {
            type: 'string',
            maxLength: 500
          },
          poolId: {
            type: 'string'
          },
          rewardToken: {
            type: 'object',
            required: ['address', 'symbol', 'decimals'],
            properties: {
              address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
              symbol: { type: 'string', minLength: 1, maxLength: 10 },
              decimals: { type: 'integer', minimum: 0, maximum: 18 }
            }
          },
          rewardRate: {
            type: 'string',
            pattern: '^[0-9]+(\\.[0-9]+)?$'
          },
          totalRewards: {
            type: 'string',
            pattern: '^[0-9]+(\\.[0-9]+)?$'
          },
          durationDays: {
            type: 'integer',
            minimum: 1,
            maximum: 3650
          },
          startsAt: {
            type: 'string',
            format: 'date-time'
          },
          endsAt: {
            type: 'string',
            format: 'date-time'
          }
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

      const body = request.body as CreateFarmRequestBody;
      const { name, description, poolId, rewardToken, rewardRate, totalRewards, durationDays, startsAt, endsAt } = body;

      const createRequest: CreateFarmRequest = {
        name,
        description,
        poolId,
        rewardToken,
        rewardRate,
        totalRewards,
        durationDays,
        startsAt: startsAt ? new Date(startsAt) : undefined,
        endsAt: endsAt ? new Date(endsAt) : undefined
      };

      const result = await yieldFarmingService.createFarm(createRequest);

      if (!result.success) {
        return reply.code(400).send(result);
      }

      logger.info(`Farm created by user ${request.user.id}: ${name}`);

      return reply.code(201).send({
        success: true,
        farm: result.farm
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to create farm');
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Stake LP tokens in a farm
   */
  fastify.post<{ Body: StakeRequestBody }>('/stake', {
    schema: {
      body: {
        type: 'object',
        required: ['farmId', 'amount'],
        properties: {
          farmId: { type: 'string' },
          amount: {
            type: 'string',
            pattern: '^[0-9]+(\\.[0-9]+)?$'
          }
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

      const body = request.body as StakeRequestBody;
      const { farmId, amount } = body;

      const stakeRequest: StakeRequest = {
        farmId,
        amount,
        userAddress: request.user.id
      };

      const result = await yieldFarmingService.stake(stakeRequest);

      if (!result.success) {
        return reply.code(400).send(result);
      }

      logger.info(`User ${request.user.id} staked ${amount} LP tokens in farm ${farmId}`);

      return reply.code(200).send({
        success: true,
        position: result.position
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to stake');
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Unstake LP tokens from a farm
   */
  fastify.post<{ Body: UnstakeRequestBody }>('/unstake', {
    schema: {
      body: {
        type: 'object',
        required: ['farmId', 'amount'],
        properties: {
          farmId: { type: 'string' },
          amount: {
            type: 'string',
            pattern: '^[0-9]+(\\.[0-9]+)?$'
          }
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

      const body = request.body as UnstakeRequestBody;
      const { farmId, amount } = body;

      const unstakeRequest: UnstakeRequest = {
        farmId,
        amount,
        userAddress: request.user.id
      };

      const result = await yieldFarmingService.unstake(unstakeRequest);

      if (!result.success) {
        return reply.code(400).send(result);
      }

      logger.info(`User ${request.user.id} unstaked ${amount} LP tokens from farm ${farmId}`);

      return reply.code(200).send({
        success: true,
        position: result.position,
        amount: result.amount
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to unstake');
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Claim rewards from a farm
   */
  fastify.post<{ Body: ClaimRewardsRequestBody }>('/claim-rewards', {
    schema: {
      body: {
        type: 'object',
        required: ['farmId'],
        properties: {
          farmId: { type: 'string' }
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

      const body = request.body as ClaimRewardsRequestBody;
      const { farmId } = body;

      const claimRequest: ClaimRewardsRequest = {
        farmId,
        userAddress: request.user.id
      };

      const result = await yieldFarmingService.claimRewards(claimRequest);

      if (!result.success) {
        return reply.code(400).send(result);
      }

      logger.info(`User ${request.user.id} claimed ${result.rewardsClaimed} rewards from farm ${farmId}`);

      return reply.code(200).send({
        success: true,
        position: result.position,
        rewardsClaimed: result.rewardsClaimed
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to claim rewards');
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Get all active farms
   */
  fastify.get('/farms', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const farms = await yieldFarmingService.getAllFarms();

      return reply.code(200).send({
        success: true,
        farms,
        count: farms.length
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get farms');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve farms'
      });
    }
  });

  /**
   * Get specific farm by ID
   */
  fastify.get<{
    Params: { farmId: string }
  }>('/farms/:farmId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          farmId: { type: 'string' }
        },
        required: ['farmId']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as { farmId: string };
      const { farmId } = params;

      const farm = await yieldFarmingService.getFarmById(farmId);

      if (!farm) {
        return reply.code(404).send({
          success: false,
          error: 'Farm not found'
        });
      }

      return reply.code(200).send({
        success: true,
        farm
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get farm');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve farm'
      });
    }
  });

  /**
   * Get user's farm positions
   */
  fastify.get('/positions', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required'
        });
      }

      const positions = await yieldFarmingService.getUserPositions(request.user.id);

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
   * Health check for yield farming service
   */
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const farms = await yieldFarmingService.getAllFarms();

      return reply.code(200).send({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          yieldFarmingService: 'operational',
          database: 'operational'
        },
        farmCount: farms.length,
        totalStaked: farms.reduce((sum, farm) => sum + parseFloat(farm.totalStaked), 0).toString()
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Yield farming health check failed');
      return reply.code(503).send({
        success: false,
        status: 'unhealthy',
        error: 'Yield farming service unavailable'
      });
    }
  });
}