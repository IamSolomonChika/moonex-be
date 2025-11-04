/**
 * BSC Liquidity Routes
 * API endpoints for BSC liquidity management functionality
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import logger from '../../utils/logger.js';
import {
  liquidityManager,
  liquidityOptimizer,
  liquidityAnalyzer,
  autoRebalancer,
  concentrationAnalyzer,
  impermanentLossTracker,
  liquidityProvider,
  type LiquidityPosition,
  type LiquidityPool,
  type AddLiquidityRequest,
  type RemoveLiquidityRequest,
  type RebalanceRequest,
  type LiquidityRecommendation,
  type ConcentrationRisk,
  type ImpermanentLossData
} from '../../bsc/services/liquidity/index.js';

/**
 * Add liquidity request schema
 */
const AddLiquiditySchema = {
  type: 'object',
  required: ['poolAddress', 'tokenA', 'tokenB', 'recipient'],
  properties: {
    poolAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    tokenA: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    tokenB: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    amountA: { type: 'string' },
    amountB: { type: 'string' },
    amountADesired: { type: 'string' },
    amountBDesired: { type: 'string' },
    minAmountA: { type: 'string' },
    minAmountB: { type: 'string' },
    recipient: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    deadlineMinutes: { type: 'number', minimum: 1, maximum: 60, default: 20 },
    useV3: { type: 'boolean', default: false },
    tickLower: { type: 'number' },
    tickUpper: { type: 'number' },
    feeTier: { type: 'number', enum: [500, 3000, 10000] },
    slippageTolerance: { type: 'number', minimum: 0, maximum: 5000, default: 50 }
  },
  oneOf: [
    { required: ['amountA', 'amountB'] },
    { required: ['amountADesired', 'amountBDesired'] }
  ]
};

/**
 * Remove liquidity request schema
 */
const RemoveLiquiditySchema = {
  type: 'object',
  required: ['poolAddress', 'recipient'],
  properties: {
    poolAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    liquidityAmount: { type: 'string' },
    percentage: { type: 'number', minimum: 0, maximum: 100, maximum: 100 },
    amountAMin: { type: 'string' },
    amountBMin: { type: 'string' },
    recipient: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    deadlineMinutes: { type: 'number', minimum: 1, maximum: 60, default: 20 },
    useV3: { type: 'boolean', default: false },
    collectAll: { type: 'boolean', default: false }
  },
  oneOf: [
    { required: ['liquidityAmount'] },
    { required: ['percentage'] }
  ]
};

/**
 * Liquidity query schema
 */
const LiquidityQuerySchema = {
  type: 'object',
  properties: {
    poolAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    tokenA: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    tokenB: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    isActive: { type: 'boolean' },
    minLiquidityUSD: { type: 'number', minimum: 0 },
    sortBy: {
      type: 'string',
      enum: ['liquidity', 'volume24h', 'fees24h', 'apr', 'createdAt', 'valueUSD']
    },
    sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
    limit: { type: 'number', minimum: 1, maximum: 1000, default: 100 },
    offset: { type: 'number', minimum: 0, default: 0 }
  }
};

/**
 * Register liquidity routes
 */
export async function liquidityRoutes(fastify: FastifyInstance) {
  logger.info('Registering BSC liquidity routes');

  /**
   * Get all liquidity positions
   */
  fastify.get('/positions', {
    schema: {
      querystring: LiquidityQuerySchema,
      description: 'Get liquidity positions with filtering',
      tags: ['bsc', 'liquidity', 'positions']
    }
  }, async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    try {
      const filter = {
        userAddress: request.query.userAddress,
        poolAddress: request.query.poolAddress,
        tokenA: request.query.tokenA,
        tokenB: request.query.tokenB,
        isActive: request.query.isActive,
        minLiquidityUSD: request.query.minLiquidityUSD,
        sortBy: request.query.sortBy,
        sortOrder: request.query.sortOrder,
        limit: request.query.limit,
        offset: request.query.offset
      };

      const positions = await liquidityManager.getPositions(filter);

      return reply.send({
        success: true,
        data: positions,
        meta: {
          total: positions.length,
          limit: filter.limit,
          offset: filter.offset
        }
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get liquidity positions');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch liquidity positions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get liquidity position by ID
   */
  fastify.get('/positions/:positionId', {
    schema: {
      params: {
        type: 'object',
        required: ['positionId'],
        properties: {
          positionId: { type: 'string' }
        }
      },
      description: 'Get liquidity position by ID',
      tags: ['bsc', 'liquidity', 'positions']
    }
  }, async (request: FastifyRequest<{ Params: { positionId: string } }>, reply: FastifyReply) => {
    try {
      const { positionId } = request.params;
      const position = await liquidityManager.getPosition(positionId);

      if (!position) {
        return reply.status(404).send({
          success: false,
          error: 'Position not found',
          message: `Liquidity position ${positionId} not found`
        });
      }

      return reply.send({
        success: true,
        data: position
      });

    } catch (error) {
      logger.error({ positionId: request.params.positionId, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get liquidity position');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch liquidity position',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get user liquidity positions
   */
  fastify.get('/positions/user/:userAddress', {
    schema: {
      params: {
        type: 'object',
        required: ['userAddress'],
        properties: {
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          includeInactive: { type: 'boolean', default: false },
          sortBy: { type: 'string', enum: ['valueUSD', 'apr', 'createdAt', 'feesEarned'] },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        }
      },
      description: 'Get all liquidity positions for a user',
      tags: ['bsc', 'liquidity', 'positions']
    }
  }, async (request: FastifyRequest<{
    Params: { userAddress: string },
    Querystring: { includeInactive?: boolean; sortBy?: string; sortOrder?: string }
  }>, reply: FastifyReply) => {
    try {
      const { userAddress } = request.params;
      const { includeInactive = false, sortBy, sortOrder } = request.query;

      const positions = await liquidityManager.getUserPositions(userAddress, {
        includeInactive,
        sortBy,
        sortOrder
      });

      // Calculate portfolio metrics
      const portfolioMetrics = await liquidityAnalyzer.calculatePortfolioMetrics(userAddress);

      return reply.send({
        success: true,
        data: {
          positions,
          portfolioMetrics,
          meta: {
            userAddress,
            totalPositions: positions.length,
            activePositions: positions.filter(p => p.isActive).length,
            totalValueUSD: positions.reduce((sum, p) => sum + (p.valueUSD || 0), 0)
          }
        }
      });

    } catch (error) {
      logger.error({ userAddress: request.params.userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get user liquidity positions');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch user liquidity positions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Add liquidity
   */
  fastify.post('/add', {
    schema: {
      body: AddLiquiditySchema,
      description: 'Add liquidity to a pool',
      tags: ['bsc', 'liquidity', 'add']
    }
  }, async (request: FastifyRequest<{ Body: AddLiquidityRequest }>, reply: FastifyReply) => {
    try {
      const addRequest = request.body;

      // Get quote for adding liquidity
      const quote = await liquidityProvider.getAddLiquidityQuote(addRequest);

      // Build transaction
      const transaction = await liquidityProvider.buildAddLiquidityTransaction(addRequest);

      return reply.send({
        success: true,
        data: {
          quote,
          transaction: {
            to: transaction.to,
            data: transaction.data,
            value: transaction.value,
            gasLimit: transaction.gasLimit,
            gasPrice: transaction.gasPrice,
            maxFeePerGas: transaction.maxFeePerGas,
            maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
            deadline: transaction.deadline,
            protocol: transaction.protocol
          },
          warnings: quote.warnings || [],
          message: 'Transaction built successfully. Sign and send to add liquidity.'
        }
      });

    } catch (error) {
      logger.error({ body: request.body, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to add liquidity');
      return reply.status(400).send({
        success: false,
        error: 'Failed to add liquidity',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Remove liquidity
   */
  fastify.post('/remove', {
    schema: {
      body: RemoveLiquiditySchema,
      description: 'Remove liquidity from a pool',
      tags: ['bsc', 'liquidity', 'remove']
    }
  }, async (request: FastifyRequest<{ Body: RemoveLiquidityRequest }>, reply: FastifyReply) => {
    try {
      const removeRequest = request.body;

      // Get quote for removing liquidity
      const quote = await liquidityProvider.getRemoveLiquidityQuote(removeRequest);

      // Build transaction
      const transaction = await liquidityProvider.buildRemoveLiquidityTransaction(removeRequest);

      return reply.send({
        success: true,
        data: {
          quote,
          transaction: {
            to: transaction.to,
            data: transaction.data,
            value: transaction.value,
            gasLimit: transaction.gasLimit,
            gasPrice: transaction.gasPrice,
            maxFeePerGas: transaction.maxFeePerGas,
            maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
            deadline: transaction.deadline,
            protocol: transaction.protocol
          },
          warnings: quote.warnings || [],
          message: 'Transaction built successfully. Sign and send to remove liquidity.'
        }
      });

    } catch (error) {
      logger.error({ body: request.body, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to remove liquidity');
      return reply.status(400).send({
        success: false,
        error: 'Failed to remove liquidity',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get liquidity pools
   */
  fastify.get('/pools', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          tokenA: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          tokenB: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          feeTier: { type: 'number', enum: [500, 3000, 10000] },
          minTVL: { type: 'number', minimum: 0 },
          minAPR: { type: 'number', minimum: 0 },
          sortBy: { type: 'string', enum: ['tvl', 'volume24h', 'apr', 'fees24h'] },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 }
        }
      },
      description: 'Get available liquidity pools',
      tags: ['bsc', 'liquidity', 'pools']
    }
  }, async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    try {
      const filter = {
        tokenA: request.query.tokenA,
        tokenB: request.query.tokenB,
        feeTier: request.query.feeTier,
        minTVL: request.query.minTVL,
        minAPR: request.query.minAPR,
        sortBy: request.query.sortBy,
        sortOrder: request.query.sortOrder,
        limit: request.query.limit
      };

      const pools = await liquidityManager.getAvailablePools(filter);

      return reply.send({
        success: true,
        data: pools,
        meta: {
          total: pools.length,
          limit: filter.limit
        }
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get liquidity pools');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch liquidity pools',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get liquidity pool details
   */
  fastify.get('/pools/:poolAddress', {
    schema: {
      params: {
        type: 'object',
        required: ['poolAddress'],
        properties: {
          poolAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      },
      description: 'Get liquidity pool details',
      tags: ['bsc', 'liquidity', 'pools']
    }
  }, async (request: FastifyRequest<{ Params: { poolAddress: string } }>, reply: FastifyReply) => {
    try {
      const { poolAddress } = request.params;
      const pool = await liquidityManager.getPoolDetails(poolAddress);

      if (!pool) {
        return reply.status(404).send({
          success: false,
          error: 'Pool not found',
          message: `Liquidity pool ${poolAddress} not found`
        });
      }

      return reply.send({
        success: true,
        data: pool
      });

    } catch (error) {
      logger.error({ poolAddress: request.params.poolAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get pool details');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch pool details',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get liquidity recommendations
   */
  fastify.get('/recommendations/:userAddress', {
    schema: {
      params: {
        type: 'object',
        required: ['userAddress'],
        properties: {
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          riskTolerance: { type: 'string', enum: ['conservative', 'moderate', 'aggressive'] },
          investmentAmount: { type: 'number', minimum: 0 },
          preferredTokens: { type: 'array', items: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' } },
          maxPositions: { type: 'number', minimum: 1, maximum: 50, default: 10 }
        }
      },
      description: 'Get liquidity provision recommendations',
      tags: ['bsc', 'liquidity', 'recommendations']
    }
  }, async (request: FastifyRequest<{
    Params: { userAddress: string },
    Querystring: { riskTolerance?: string; investmentAmount?: number; preferredTokens?: string[]; maxPositions?: number }
  }>, reply: FastifyReply) => {
    try {
      const { userAddress } = request.params;
      const { riskTolerance, investmentAmount, preferredTokens, maxPositions } = request.query;

      const recommendations = await liquidityOptimizer.getRecommendations(userAddress, {
        riskTolerance,
        investmentAmount,
        preferredTokens,
        maxPositions
      });

      return reply.send({
        success: true,
        data: recommendations,
        meta: {
          userAddress,
          recommendationCount: recommendations.length,
          generatedAt: Date.now()
        }
      });

    } catch (error) {
      logger.error({ userAddress: request.params.userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get liquidity recommendations');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch liquidity recommendations',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Optimize liquidity positions
   */
  fastify.post('/optimize/:userAddress', {
    schema: {
      params: {
        type: 'object',
        required: ['userAddress'],
        properties: {
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      },
      body: {
        type: 'object',
        properties: {
          riskTolerance: { type: 'string', enum: ['conservative', 'moderate', 'aggressive'] },
          targetAPR: { type: 'number', minimum: 0 },
          maxPositions: { type: 'number', minimum: 1, maximum: 50 },
          rebalanceThreshold: { type: 'number', minimum: 0, maximum: 100, default: 20 },
          excludeTokens: { type: 'array', items: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' } }
        }
      },
      description: 'Optimize user liquidity positions',
      tags: ['bsc', 'liquidity', 'optimize']
    }
  }, async (request: FastifyRequest<{
    Params: { userAddress: string },
    Body: { riskTolerance?: string; targetAPR?: number; maxPositions?: number; rebalanceThreshold?: number; excludeTokens?: string[] }
  }>, reply: FastifyReply) => {
    try {
      const { userAddress } = request.params;
      const optimizationParams = request.body;

      const optimization = await liquidityOptimizer.optimizePositions(userAddress, optimizationParams);

      return reply.send({
        success: true,
        data: optimization,
        meta: {
          userAddress,
          optimizedAt: Date.now()
        }
      });

    } catch (error) {
      logger.error({ userAddress: request.params.userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to optimize liquidity positions');
      return reply.status(500).send({
        success: false,
        error: 'Failed to optimize liquidity positions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Rebalance liquidity positions
   */
  fastify.post('/rebalance', {
    schema: {
      body: {
        type: 'object',
        required: ['userAddress', 'rebalances'],
        properties: {
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          rebalances: {
            type: 'array',
            items: {
              type: 'object',
              required: ['positionId', 'action'],
              properties: {
                positionId: { type: 'string' },
                action: { type: 'string', enum: ['increase', 'decrease', 'remove', 'add'] },
                amountUSD: { type: 'number' },
                newPoolAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
              }
            }
          },
          slippageTolerance: { type: 'number', minimum: 0, maximum: 5000, default: 50 }
        }
      },
      description: 'Rebalance liquidity positions',
      tags: ['bsc', 'liquidity', 'rebalance']
    }
  }, async (request: FastifyRequest<{ Body: RebalanceRequest }>, reply: FastifyReply) => {
    try {
      const rebalanceRequest = request.body;

      const rebalancePlan = await autoRebalancer.createRebalancePlan(rebalanceRequest);

      return reply.send({
        success: true,
        data: rebalancePlan,
        message: 'Rebalance plan created successfully. Execute transactions to complete rebalancing.'
      });

    } catch (error) {
      logger.error({ body: request.body, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to rebalance liquidity positions');
      return reply.status(400).send({
        success: false,
        error: 'Failed to rebalance liquidity positions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get concentration risk analysis
   */
  fastify.get('/risk/concentration/:userAddress', {
    schema: {
      params: {
        type: 'object',
        required: ['userAddress'],
        properties: {
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      },
      description: 'Get concentration risk analysis for user positions',
      tags: ['bsc', 'liquidity', 'risk']
    }
  }, async (request: FastifyRequest<{ Params: { userAddress: string } }>, reply: FastifyReply) => {
    try {
      const { userAddress } = request.params;

      const concentrationRisk = await concentrationAnalyzer.analyzeConcentrationRisk(userAddress);

      return reply.send({
        success: true,
        data: concentrationRisk,
        meta: {
          userAddress,
          analyzedAt: Date.now()
        }
      });

    } catch (error) {
      logger.error({ userAddress: request.params.userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to analyze concentration risk');
      return reply.status(500).send({
        success: false,
        error: 'Failed to analyze concentration risk',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get impermanent loss data
   */
  fastify.get('/risk/impermanent-loss/:userAddress', {
    schema: {
      params: {
        type: 'object',
        required: ['userAddress'],
        properties: {
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          timeframe: { type: 'string', enum: ['24h', '7d', '30d', '90d'], default: '30d' }
        }
      },
      description: 'Get impermanent loss analysis',
      tags: ['bsc', 'liquidity', 'risk']
    }
  }, async (request: FastifyRequest<{
    Params: { userAddress: string },
    Querystring: { timeframe?: string }
  }>, reply: FastifyReply) => {
    try {
      const { userAddress } = request.params;
      const { timeframe = '30d' } = request.query;

      const ilData = await impermanentLossTracker.getImpermanentLossData(userAddress, timeframe);

      return reply.send({
        success: true,
        data: ilData,
        meta: {
          userAddress,
          timeframe,
          analyzedAt: Date.now()
        }
      });

    } catch (error) {
      logger.error({ userAddress: request.params.userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get impermanent loss data');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch impermanent loss data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get liquidity analytics
   */
  fastify.get('/analytics/:userAddress', {
    schema: {
      params: {
        type: 'object',
        required: ['userAddress'],
        properties: {
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          timeframe: { type: 'string', enum: ['24h', '7d', '30d', '90d'], default: '30d' },
          includeInactive: { type: 'boolean', default: false }
        }
      },
      description: 'Get liquidity analytics and performance metrics',
      tags: ['bsc', 'liquidity', 'analytics']
    }
  }, async (request: FastifyRequest<{
    Params: { userAddress: string },
    Querystring: { timeframe?: string; includeInactive?: boolean }
  }>, reply: FastifyReply) => {
    try {
      const { userAddress } = request.params;
      const { timeframe = '30d', includeInactive = false } = request.query;

      const analytics = await liquidityAnalyzer.getLiquidityAnalytics(userAddress, {
        timeframe,
        includeInactive
      });

      return reply.send({
        success: true,
        data: analytics,
        meta: {
          userAddress,
          timeframe,
          includeInactive,
          generatedAt: Date.now()
        }
      });

    } catch (error) {
      logger.error({ userAddress: request.params.userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get liquidity analytics');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch liquidity analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get portfolio liquidity overview
   */
  fastify.get('/portfolio/:userAddress', {
    schema: {
      params: {
        type: 'object',
        required: ['userAddress'],
        properties: {
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      },
      description: 'Get comprehensive liquidity portfolio overview',
      tags: ['bsc', 'liquidity', 'portfolio']
    }
  }, async (request: FastifyRequest<{ Params: { userAddress: string } }>, reply: FastifyReply) => {
    try {
      const { userAddress } = request.params;

      // Get all portfolio data
      const [positions, portfolioMetrics, concentrationRisk, ilData, analytics] = await Promise.all([
        liquidityManager.getUserPositions(userAddress, { includeInactive: false }),
        liquidityAnalyzer.calculatePortfolioMetrics(userAddress),
        concentrationAnalyzer.analyzeConcentrationRisk(userAddress),
        impermanentLossTracker.getImpermanentLossData(userAddress, '30d'),
        liquidityAnalyzer.getLiquidityAnalytics(userAddress, { timeframe: '30d' })
      ]);

      return reply.send({
        success: true,
        data: {
          positions,
          portfolioMetrics,
          riskAnalysis: {
            concentrationRisk,
            impermanentLoss: ilData
          },
          performance: analytics,
          summary: {
            totalPositions: positions.length,
            totalValueUSD: portfolioMetrics.totalValueUSD,
            weightedAPR: portfolioMetrics.weightedAPR,
            dailyFees: analytics.dailyFees,
            riskLevel: concentrationRisk.overallRisk
          }
        },
        meta: {
          userAddress,
          generatedAt: Date.now()
        }
      });

    } catch (error) {
      logger.error({ userAddress: request.params.userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get liquidity portfolio');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch liquidity portfolio',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Health check
   */
  fastify.get('/health', {
    schema: {
      description: 'Liquidity service health check',
      tags: ['bsc', 'liquidity', 'health']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const healthStatus = await liquidityManager.getHealthStatus();

      return reply.send({
        success: true,
        data: {
          status: healthStatus.healthy ? 'healthy' : 'unhealthy',
          services: {
            liquidityManager: healthStatus.healthy,
            liquidityOptimizer: healthStatus.optimizerHealthy,
            liquidityAnalyzer: healthStatus.analyzerHealthy,
            autoRebalancer: healthStatus.rebalancerHealthy
          },
          timestamp: Date.now()
        }
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Liquidity service health check failed');
      return reply.status(500).send({
        success: false,
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  logger.info('BSC liquidity routes registered successfully');
}