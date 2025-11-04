/**
 * BSC Yield Farming Routes
 * API endpoints for BSC yield farming functionality
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import logger from '../../utils/logger.js';
import {
  farmIntegration,
  syrupPoolService,
  autoCompoundService,
  yieldStrategyManager,
  yieldOptimizer,
  performanceTracker,
  riskManager,
  type YieldFarm,
  type SyrupPool,
  type AutoCompoundVault,
  type YieldPosition,
  type YieldOperation,
  type YieldQuote,
  type YieldStrategy,
  type YieldOptimization,
  type FarmPerformance
} from '../../bsc/services/yield/index.js';

/**
 * Yield query schema
 */
const YieldQuerySchema = {
  type: 'object',
  properties: {
    category: {
      type: 'string',
      enum: ['stable', 'volatile', 'bluechip', 'defi', 'gaming', 'nft', 'launchpad', 'new', 'hot']
    },
    isActive: { type: 'boolean', default: true },
    isStable: { type: 'boolean' },
    isHot: { type: 'boolean' },
    minAPR: { type: 'number', minimum: 0 },
    minTVL: { type: 'number', minimum: 0 },
    sortBy: {
      type: 'string',
      enum: ['apr', 'apy', 'tvl', 'liquidity', 'multiplier', 'createdAt', 'name']
    },
    sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
    limit: { type: 'number', minimum: 1, maximum: 1000, default: 100 },
    offset: { type: 'number', minimum: 0, default: 0 }
  }
};

/**
 * Yield operation schema
 */
const YieldOperationSchema = {
  type: 'object',
  required: ['farmId', 'userAddress', 'action'],
  properties: {
    farmId: { type: 'string' },
    userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    action: { type: 'string', enum: ['deposit', 'withdraw', 'harvest', 'compound'] },
    amount: { type: 'string' },
    percentage: { type: 'number', minimum: 0, maximum: 100 },
    slippageTolerance: { type: 'number', minimum: 0, maximum: 5000, default: 50 },
    deadlineMinutes: { type: 'number', minimum: 1, maximum: 60, default: 20 }
  },
  oneOf: [
    { required: ['amount'] },
    { required: ['percentage'] }
  ]
};

/**
 * Register yield farming routes
 */
export async function yieldRoutes(fastify: FastifyInstance) {
  logger.info('Registering BSC yield farming routes');

  /**
   * Get all yield farms
   */
  fastify.get('/farms', {
    schema: {
      querystring: YieldQuerySchema,
      description: 'Get all yield farms with filtering',
      tags: ['bsc', 'yield', 'farms']
    }
  }, async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    try {
      const filter = {
        category: request.query.category,
        isActive: request.query.isActive,
        isStable: request.query.isStable,
        isHot: request.query.isHot,
        minAPR: request.query.minAPR,
        minTVL: request.query.minTVL,
        sortBy: request.query.sortBy,
        sortOrder: request.query.sortOrder,
        limit: request.query.limit,
        offset: request.query.offset
      };

      const farms = await farmIntegration.getAllFarms(filter);

      return reply.send({
        success: true,
        data: farms,
        meta: {
          total: farms.total || farms.length,
          limit: filter.limit,
          offset: filter.offset,
          hasMore: farms.hasMore || false
        }
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get yield farms');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch yield farms',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get yield farm by ID
   */
  fastify.get('/farms/:farmId', {
    schema: {
      params: {
        type: 'object',
        required: ['farmId'],
        properties: {
          farmId: { type: 'string' }
        }
      },
      description: 'Get yield farm by ID',
      tags: ['bsc', 'yield', 'farms']
    }
  }, async (request: FastifyRequest<{ Params: { farmId: string } }>, reply: FastifyReply) => {
    try {
      const { farmId } = request.params;
      const farm = await farmIntegration.getFarmById(farmId);

      if (!farm) {
        return reply.status(404).send({
          success: false,
          error: 'Farm not found',
          message: `Yield farm ${farmId} not found`
        });
      }

      return reply.send({
        success: true,
        data: farm
      });

    } catch (error) {
      logger.error({ farmId: request.params.farmId, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get yield farm');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch yield farm',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get top yield farms
   */
  fastify.get('/farms/top', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          sortBy: { type: 'string', enum: ['apr', 'tvl', 'liquidity'], default: 'apr' },
          category: { type: 'string' },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
          minTVL: { type: 'number', minimum: 0 }
        }
      },
      description: 'Get top yield farms by performance',
      tags: ['bsc', 'yield', 'farms']
    }
  }, async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    try {
      const { sortBy = 'apr', category, limit = 50, minTVL } = request.query;

      const farms = await farmIntegration.getTopFarms({
        sortBy,
        category,
        limit,
        minTVL
      });

      return reply.send({
        success: true,
        data: farms,
        meta: {
          sortBy,
          category,
          limit,
          count: farms.length
        }
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get top yield farms');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch top yield farms',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get all syrup pools
   */
  fastify.get('/syrup-pools', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          isActive: { type: 'boolean', default: true },
          isFinished: { type: 'boolean', default: false },
          flexible: { type: 'boolean' },
          category: {
            type: 'string',
            enum: ['flexible', 'locked', 'governance', 'nft', 'liquidity_mining', 'single_staking']
          },
          minAPR: { type: 'number', minimum: 0 },
          sortBy: { type: 'string', enum: ['apr', 'apy', 'tvl', 'duration'], default: 'apr' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 }
        }
      },
      description: 'Get all syrup pools',
      tags: ['bsc', 'yield', 'syrup']
    }
  }, async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    try {
      const filter = {
        isActive: request.query.isActive,
        isFinished: request.query.isFinished,
        flexible: request.query.flexible,
        category: request.query.category,
        minAPR: request.query.minAPR,
        sortBy: request.query.sortBy,
        sortOrder: request.query.sortOrder,
        limit: request.query.limit
      };

      const pools = await syrupPoolService.getAllSyrupPools(filter);

      return reply.send({
        success: true,
        data: pools,
        meta: {
          total: pools.length,
          limit: filter.limit
        }
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get syrup pools');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch syrup pools',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get auto-compound vaults
   */
  fastify.get('/auto-compound-vaults', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          isActive: { type: 'boolean', default: true },
          strategy: {
            type: 'string',
            enum: ['daily', 'weekly', 'monthly', 'auto', 'manual', 'hybrid']
          },
          minAPR: { type: 'number', minimum: 0 },
          minTVL: { type: 'number', minimum: 0 },
          sortBy: { type: 'string', enum: ['apr', 'apy', 'tvl', 'compoundFrequency'], default: 'apr' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 }
        }
      },
      description: 'Get auto-compound vaults',
      tags: ['bsc', 'yield', 'autocompound']
    }
  }, async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    try {
      const filter = {
        isActive: request.query.isActive,
        strategy: request.query.strategy,
        minAPR: request.query.minAPR,
        minTVL: request.query.minTVL,
        sortBy: request.query.sortBy,
        sortOrder: request.query.sortOrder,
        limit: request.query.limit
      };

      const vaults = await autoCompoundService.getAllVaults(filter);

      return reply.send({
        success: true,
        data: vaults,
        meta: {
          total: vaults.length,
          limit: filter.limit
        }
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get auto-compound vaults');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch auto-compound vaults',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get user yield positions
   */
  fastify.get('/positions/:userAddress', {
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
          farmType: { type: 'string', enum: ['regular', 'syrup', 'autocompound', 'locked'] },
          isActive: { type: 'boolean', default: true },
          sortBy: { type: 'string', enum: ['valueUSD', 'apr', 'roi', 'createdAt'] },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        }
      },
      description: 'Get user yield positions',
      tags: ['bsc', 'yield', 'positions']
    }
  }, async (request: FastifyRequest<{
    Params: { userAddress: string },
    Querystring: { farmType?: string; isActive?: boolean; sortBy?: string; sortOrder?: string }
  }>, reply: FastifyReply) => {
    try {
      const { userAddress } = request.params;
      const { farmType, isActive = true, sortBy, sortOrder } = request.query;

      const positions = await farmIntegration.getUserPositions(userAddress, {
        farmType,
        isActive,
        sortBy,
        sortOrder
      });

      // Calculate portfolio metrics
      const portfolioMetrics = await yieldOptimizer.calculateYieldPortfolioMetrics(userAddress);

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
      logger.error({ userAddress: request.params.userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get user yield positions');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch user yield positions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get yield quote for operation
   */
  fastify.post('/quote', {
    schema: {
      body: YieldOperationSchema,
      description: 'Get yield operation quote',
      tags: ['bsc', 'yield', 'quote']
    }
  }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const { farmId, userAddress, action, amount, percentage, ...options } = request.body;

      const quoteRequest = {
        farmId,
        userAddress,
        action,
        amount,
        percentage,
        options: {
          slippageTolerance: options.slippageTolerance,
          deadlineMinutes: options.deadlineMinutes
        }
      };

      const quote = await farmIntegration.getYieldQuote(quoteRequest);

      return reply.send({
        success: true,
        data: quote,
        meta: {
          farmId,
          action,
          timestamp: Date.now()
        }
      });

    } catch (error) {
      logger.error({ body: request.body, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get yield quote');
      return reply.status(400).send({
        success: false,
        error: 'Failed to get yield quote',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Execute yield operation
   */
  fastify.post('/execute', {
    schema: {
      body: {
        type: 'object',
        required: ['farmId', 'userAddress', 'action', 'quoteId'],
        properties: {
          farmId: { type: 'string' },
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          action: { type: 'string', enum: ['deposit', 'withdraw', 'harvest', 'compound'] },
          quoteId: { type: 'string' },
          signature: { type: 'string' }
        }
      },
      description: 'Execute yield operation',
      tags: ['bsc', 'yield', 'execute']
    }
  }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const { farmId, userAddress, action, quoteId, signature } = request.body;

      // For now, build transaction for preview without actual execution
      const operation = await farmIntegration.buildYieldTransaction({
        farmId,
        userAddress,
        action,
        quoteId,
        signature
      });

      return reply.send({
        success: true,
        data: {
          operation: {
            id: operation.id,
            transaction: {
              to: operation.transaction.to,
              data: operation.transaction.data,
              value: operation.transaction.value,
              gasLimit: operation.transaction.gasLimit,
              gasPrice: operation.transaction.gasPrice
            },
            quote: operation.quote,
            warnings: operation.warnings || []
          },
          message: 'Transaction built successfully. Sign and send to execute yield operation.'
        }
      });

    } catch (error) {
      logger.error({ body: request.body, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to execute yield operation');
      return reply.status(400).send({
        success: false,
        error: 'Failed to execute yield operation',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get yield strategies
   */
  fastify.get('/strategies', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['conservative', 'balanced', 'aggressive', 'income', 'growth', 'degen']
          },
          riskLevel: {
            type: 'string',
            enum: ['very_low', 'low', 'medium', 'high', 'very_high']
          },
          minAPR: { type: 'number', minimum: 0 },
          maxRisk: { type: 'string', enum: ['low', 'medium', 'high'] },
          isActive: { type: 'boolean', default: true },
          isPublic: { type: 'boolean', default: true },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 }
        }
      },
      description: 'Get available yield strategies',
      tags: ['bsc', 'yield', 'strategies']
    }
  }, async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    try {
      const filter = {
        category: request.query.category,
        riskLevel: request.query.riskLevel,
        minAPR: request.query.minAPR,
        maxRisk: request.query.maxRisk,
        isActive: request.query.isActive,
        isPublic: request.query.isPublic,
        limit: request.query.limit
      };

      const strategies = await yieldStrategyManager.getStrategies(filter);

      return reply.send({
        success: true,
        data: strategies,
        meta: {
          total: strategies.length,
          limit: filter.limit
        }
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get yield strategies');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch yield strategies',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get yield strategy by ID
   */
  fastify.get('/strategies/:strategyId', {
    schema: {
      params: {
        type: 'object',
        required: ['strategyId'],
        properties: {
          strategyId: { type: 'string' }
        }
      },
      description: 'Get yield strategy by ID',
      tags: ['bsc', 'yield', 'strategies']
    }
  }, async (request: FastifyRequest<{ Params: { strategyId: string } }>, reply: FastifyReply) => {
    try {
      const { strategyId } = request.params;
      const strategy = await yieldStrategyManager.getStrategy(strategyId);

      if (!strategy) {
        return reply.status(404).send({
          success: false,
          error: 'Strategy not found',
          message: `Yield strategy ${strategyId} not found`
        });
      }

      return reply.send({
        success: true,
        data: strategy
      });

    } catch (error) {
      logger.error({ strategyId: request.params.strategyId, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get yield strategy');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch yield strategy',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Create yield strategy
   */
  fastify.post('/strategies', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'description', 'category', 'riskTolerance', 'targetAPR'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', minLength: 1, maxLength: 500 },
          category: {
            type: 'string',
            enum: ['conservative', 'balanced', 'aggressive', 'income', 'growth', 'degen']
          },
          riskTolerance: {
            type: 'string',
            enum: ['conservative', 'moderate', 'aggressive', 'very_aggressive']
          },
          targetAPR: { type: 'number', minimum: 0, maximum: 1000 },
          maxPositions: { type: 'number', minimum: 1, maximum: 50 },
          rebalanceFrequency: { type: 'number', minimum: 1 }, // hours
          autoRebalance: { type: 'boolean', default: true },
          managementFee: { type: 'number', minimum: 0, maximum: 10 }, // percentage
          performanceFee: { type: 'number', minimum: 0, maximum: 50 }, // percentage
          farms: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 20
          },
          allocations: {
            type: 'array',
            items: {
              type: 'object',
              required: ['farmId', 'percentage'],
              properties: {
                farmId: { type: 'string' },
                percentage: { type: 'number', minimum: 0, maximum: 100 }
              }
            },
            minItems: 1
          }
        }
      },
      description: 'Create new yield strategy',
      tags: ['bsc', 'yield', 'strategies']
    }
  }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const strategyParams = request.body;

      const strategy = await yieldStrategyManager.createStrategy(strategyParams);

      return reply.send({
        success: true,
        data: strategy,
        message: 'Yield strategy created successfully'
      });

    } catch (error) {
      logger.error({ body: request.body, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to create yield strategy');
      return reply.status(400).send({
        success: false,
        error: 'Failed to create yield strategy',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Execute yield strategy
   */
  fastify.post('/strategies/:strategyId/execute', {
    schema: {
      params: {
        type: 'object',
        required: ['strategyId'],
        properties: {
          strategyId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['capital'],
        properties: {
          capital: { type: 'number', minimum: 0.01 },
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          options: {
            type: 'object',
            properties: {
              autoRebalance: { type: 'boolean' },
              rebalanceFrequency: { type: 'number' },
              maxSlippage: { type: 'number' }
            }
          }
        }
      },
      description: 'Execute yield strategy',
      tags: ['bsc', 'yield', 'strategies']
    }
  }, async (request: FastifyRequest<{
    Params: { strategyId: string },
    Body: { capital: number; userAddress?: string; options?: any }
  }>, reply: FastifyReply) => {
    try {
      const { strategyId } = request.params;
      const { capital, userAddress, options } = request.body;

      const execution = await yieldStrategyManager.executeStrategy(strategyId, capital, {
        userAddress,
        ...options
      });

      return reply.send({
        success: true,
        data: execution,
        message: 'Strategy execution planned successfully'
      });

    } catch (error) {
      logger.error({ strategyId: request.params.strategyId, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to execute yield strategy');
      return reply.status(400).send({
        success: false,
        error: 'Failed to execute yield strategy',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get yield optimization recommendations
   */
  fastify.get('/optimize/:userAddress', {
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
          riskTolerance: {
            type: 'string',
            enum: ['conservative', 'moderate', 'aggressive', 'very_aggressive']
          },
          investmentHorizon: { type: 'number', minimum: 1 }, // days
          liquidityPreference: { type: 'string', enum: ['high', 'medium', 'low'] },
          targetAPR: { type: 'number', minimum: 0 },
          maxPositions: { type: 'number', minimum: 1, maximum: 50 }
        }
      },
      description: 'Get yield optimization recommendations',
      tags: ['bsc', 'yield', 'optimize']
    }
  }, async (request: FastifyRequest<{
    Params: { userAddress: string },
    Querystring: { riskTolerance?: string; investmentHorizon?: number; liquidityPreference?: string; targetAPR?: number; maxPositions?: number }
  }>, reply: FastifyReply) => {
    try {
      const { userAddress } = request.params;
      const { riskTolerance, investmentHorizon, liquidityPreference, targetAPR, maxPositions } = request.query;

      const optimization = await yieldOptimizer.optimizeYieldPortfolio(userAddress, {
        riskTolerance,
        investmentHorizon,
        liquidityPreference,
        targetAPR,
        maxPositions
      });

      return reply.send({
        success: true,
        data: optimization,
        meta: {
          userAddress,
          optimizedAt: Date.now()
        }
      });

    } catch (error) {
      logger.error({ userAddress: request.params.userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get yield optimization');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch yield optimization',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get farm performance data
   */
  fastify.get('/performance/:farmId', {
    schema: {
      params: {
        type: 'object',
        required: ['farmId'],
        properties: {
          farmId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['1d', '7d', '30d', '90d', '1y'], default: '30d' },
          metrics: { type: 'array', items: { type: 'string' } }
        }
      },
      description: 'Get farm performance data',
      tags: ['bsc', 'yield', 'performance']
    }
  }, async (request: FastifyRequest<{
    Params: { farmId: string },
    Querystring: { period?: string; metrics?: string[] }
  }>, reply: FastifyReply) => {
    try {
      const { farmId } = request.params;
      const { period = '30d', metrics } = request.query;

      const performance = await performanceTracker.getFarmPerformance(farmId, {
        period,
        metrics
      });

      return reply.send({
        success: true,
        data: performance,
        meta: {
          farmId,
          period,
          calculatedAt: Date.now()
        }
      });

    } catch (error) {
      logger.error({ farmId: request.params.farmId, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get farm performance');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch farm performance',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get risk assessment for yield position
   */
  fastify.get('/risk/:farmId', {
    schema: {
      params: {
        type: 'object',
        required: ['farmId'],
        properties: {
          farmId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          amount: { type: 'string' },
          timeframe: { type: 'string', enum: ['24h', '7d', '30d'], default: '30d' }
        }
      },
      description: 'Get risk assessment for yield position',
      tags: ['bsc', 'yield', 'risk']
    }
  }, async (request: FastifyRequest<{
    Params: { farmId: string },
    Querystring: { userAddress?: string; amount?: string; timeframe?: string }
  }>, reply: FastifyReply) => {
    try {
      const { farmId } = request.params;
      const { userAddress, amount, timeframe = '30d' } = request.query;

      const riskAssessment = await riskManager.assessYieldRisk(farmId, {
        userAddress,
        amount,
        timeframe
      });

      return reply.send({
        success: true,
        data: riskAssessment,
        meta: {
          farmId,
          timeframe,
          assessedAt: Date.now()
        }
      });

    } catch (error) {
      logger.error({ farmId: request.params.farmId, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to assess yield risk');
      return reply.status(500).send({
        success: false,
        error: 'Failed to assess yield risk',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get yield portfolio overview
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
      querystring: {
        type: 'object',
        properties: {
          timeframe: { type: 'string', enum: ['24h', '7d', '30d', '90d'], default: '30d' },
          includeInactive: { type: 'boolean', default: false },
          detailed: { type: 'boolean', default: false }
        }
      },
      description: 'Get comprehensive yield portfolio overview',
      tags: ['bsc', 'yield', 'portfolio']
    }
  }, async (request: FastifyRequest<{
    Params: { userAddress: string },
    Querystring: { timeframe?: string; includeInactive?: boolean; detailed?: boolean }
  }>, reply: FastifyReply) => {
    try {
      const { userAddress } = request.params;
      const { timeframe = '30d', includeInactive = false, detailed = false } = request.query;

      // Get comprehensive portfolio data
      const [positions, portfolioMetrics, recommendations, riskAnalysis] = await Promise.all([
        farmIntegration.getUserPositions(userAddress, { includeInactive }),
        yieldOptimizer.calculateYieldPortfolioMetrics(userAddress),
        yieldOptimizer.getRecommendations(userAddress, { timeframe }),
        riskManager.assessPortfolioRisk(userAddress, { timeframe })
      ]);

      const portfolioOverview = {
        positions,
        metrics: portfolioMetrics,
        recommendations,
        riskAnalysis,
        summary: {
          totalPositions: positions.length,
          activePositions: positions.filter(p => p.isActive).length,
          totalValueUSD: portfolioMetrics.totalValueUSD,
          weightedAPR: portfolioMetrics.weightedAPR,
          dailyEarnings: portfolioMetrics.dailyEarnings,
          riskLevel: riskAnalysis.overallRiskLevel,
          diversificationScore: portfolioMetrics.diversificationScore
        }
      };

      if (detailed) {
        // Add additional detailed analytics
        portfolioOverview.performance = await performanceTracker.getPortfolioPerformance(userAddress, { timeframe });
        portfolioOverview.optimizations = await yieldOptimizer.getOptimizationOpportunities(userAddress);
      }

      return reply.send({
        success: true,
        data: portfolioOverview,
        meta: {
          userAddress,
          timeframe,
          includeInactive,
          detailed,
          generatedAt: Date.now()
        }
      });

    } catch (error) {
      logger.error({ userAddress: request.params.userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get yield portfolio');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch yield portfolio',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Health check
   */
  fastify.get('/health', {
    schema: {
      description: 'Yield farming service health check',
      tags: ['bsc', 'yield', 'health']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const healthStatus = await farmIntegration.getHealthStatus();

      return reply.send({
        success: true,
        data: {
          status: healthStatus.healthy ? 'healthy' : 'unhealthy',
          services: {
            farmIntegration: healthStatus.healthy,
            syrupPoolService: healthStatus.syrupHealthy,
            autoCompoundService: healthStatus.autoCompoundHealthy,
            yieldStrategyManager: healthStatus.strategyHealthy,
            yieldOptimizer: healthStatus.optimizerHealthy,
            performanceTracker: healthStatus.performanceHealthy,
            riskManager: healthStatus.riskHealthy
          },
          timestamp: Date.now()
        }
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Yield service health check failed');
      return reply.status(500).send({
        success: false,
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  logger.info('BSC yield farming routes registered successfully');
}