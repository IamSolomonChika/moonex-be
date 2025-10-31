import { FastifyInstance } from 'fastify';
import { PortfolioService } from '../services/portfolio';
import { authMiddleware } from '../middleware/auth';

/**
 * Portfolio Routes
 */
export async function portfolioRoutes(fastify: FastifyInstance) {
  const portfolioService = new PortfolioService();

  // Schema definitions
  const performanceMetricsSchema = {
    type: 'object',
    properties: {
      totalReturn: { type: 'string' },
      totalReturnPercentage: { type: 'string' },
      annualizedReturn: { type: 'string' },
      sharpeRatio: { type: 'string' },
      maxDrawdown: { type: 'string' },
      volatility: { type: 'string' },
      winRate: { type: 'string' },
      profitFactor: { type: 'string' }
    }
  };

  const positionSchema = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      type: { type: 'string', enum: ['liquidity', 'farm', 'trading_bot', 'wallet'] },
      asset: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          symbol: { type: 'string' },
          decimals: { type: 'integer' }
        }
      },
      amount: { type: 'string' },
      valueUSD: { type: 'string' },
      percentageChange24h: { type: 'string' },
      apr: { type: 'string' },
      rewards: { type: 'string' },
      metadata: { type: 'object' }
    }
  };

  const portfolioSummarySchema = {
    type: 'object',
    properties: {
      totalValueUSD: { type: 'string' },
      totalValueChange24h: { type: 'string' },
      totalValueChange24hPercentage: { type: 'string' },
      positions: {
        type: 'array',
        items: positionSchema
      },
      assetAllocation: { type: 'object', additionalProperties: { type: 'string' } },
      positionAllocation: { type: 'object', additionalProperties: { type: 'string' } },
      dailyHistory: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            timestamp: { type: 'string', format: 'date-time' },
            valueUSD: { type: 'string' },
            change24h: { type: 'string' },
            change24hPercentage: { type: 'string' }
          }
        }
      },
      weeklyHistory: {
        type: 'array',
        items: { $ref: '#/definitions/historyPoint' }
      },
      monthlyHistory: {
        type: 'array',
        items: { $ref: '#/definitions/historyPoint' }
      }
    },
    definitions: {
      historyPoint: {
        type: 'object',
        properties: {
          timestamp: { type: 'string', format: 'date-time' },
          valueUSD: { type: 'string' },
          change24h: { type: 'string' },
          change24hPercentage: { type: 'string' }
        }
      }
    }
  };

  const rebalancingSuggestionSchema = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      type: { type: 'string', enum: ['add_liquidity', 'remove_liquidity', 'rebalance_assets', 'start_bot', 'stop_bot'] },
      description: { type: 'string' },
      expectedImpact: { type: 'string' },
      riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
      estimatedGasCost: { type: 'string' },
      estimatedTime: { type: 'string' },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            parameters: { type: 'object' },
            expectedOutcome: { type: 'string' }
          }
        }
      }
    }
  };

  /**
   * GET /api/v1/portfolio
   * Get user's portfolio summary
   */
  fastify.get('/portfolio', {
    preHandler: authMiddleware,
    schema: {
      description: 'Get user portfolio summary',
      tags: ['Portfolio'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            portfolio: portfolioSummarySchema
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const portfolio = await portfolioService.getPortfolioSummary(userId);

      if (!portfolio) {
        return reply.status(404).send({
          success: false,
          error: 'Portfolio not found'
        });
      }

      return reply.send({
        success: true,
        portfolio
      });
    } catch (error) {
      fastify.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get portfolio summary');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * GET /api/v1/portfolio/performance
   * Get portfolio performance metrics
   */
  fastify.get('/portfolio/performance', {
    preHandler: authMiddleware,
    schema: {
      description: 'Get portfolio performance metrics',
      tags: ['Portfolio'],
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['7d', '30d', '90d', '1y'], default: '30d' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            metrics: performanceMetricsSchema
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const { period = '30d' } = request.query as { period?: '7d' | '30d' | '90d' | '1y' };

      const metrics = await portfolioService.getPerformanceMetrics(userId, period);

      if (!metrics) {
        return reply.status(404).send({
          success: false,
          error: 'Performance metrics not available'
        });
      }

      return reply.send({
        success: true,
        metrics
      });
    } catch (error) {
      fastify.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get performance metrics');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * GET /api/v1/portfolio/rebalancing
   * Get portfolio rebalancing suggestions
   */
  fastify.get('/portfolio/rebalancing', {
    preHandler: authMiddleware,
    schema: {
      description: 'Get portfolio rebalancing suggestions',
      tags: ['Portfolio'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            suggestions: {
              type: 'array',
              items: rebalancingSuggestionSchema
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const suggestions = await portfolioService.getRebalancingSuggestions(userId);

      return reply.send({
        success: true,
        suggestions
      });
    } catch (error) {
      fastify.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get rebalancing suggestions');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * GET /api/v1/portfolio/positions
   * Get detailed portfolio positions
   */
  fastify.get('/portfolio/positions', {
    preHandler: authMiddleware,
    schema: {
      description: 'Get detailed portfolio positions',
      tags: ['Portfolio'],
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['liquidity', 'farm', 'trading_bot', 'wallet'] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            positions: {
              type: 'array',
              items: positionSchema
            },
            totalValueUSD: { type: 'string' },
            totalChange24h: { type: 'string' },
            totalChange24hPercentage: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const { type } = request.query as { type?: string };

      const portfolio = await portfolioService.getPortfolioSummary(userId);
      if (!portfolio) {
        return reply.status(404).send({
          success: false,
          error: 'Portfolio not found'
        });
      }

      let positions = portfolio.positions;
      if (type) {
        positions = positions.filter(position => position.type === type);
      }

      return reply.send({
        success: true,
        positions,
        totalValueUSD: portfolio.totalValueUSD,
        totalChange24h: portfolio.totalValueChange24h,
        totalChange24hPercentage: portfolio.totalValueChange24hPercentage
      });
    } catch (error) {
      fastify.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get portfolio positions');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * GET /api/v1/portfolio/allocation
   * Get portfolio allocation breakdown
   */
  fastify.get('/portfolio/allocation', {
    preHandler: authMiddleware,
    schema: {
      description: 'Get portfolio allocation breakdown',
      tags: ['Portfolio'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            assetAllocation: { type: 'object', additionalProperties: { type: 'string' } },
            positionAllocation: { type: 'object', additionalProperties: { type: 'string' } },
            totalValueUSD: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;

      const portfolio = await portfolioService.getPortfolioSummary(userId);
      if (!portfolio) {
        return reply.status(404).send({
          success: false,
          error: 'Portfolio not found'
        });
      }

      return reply.send({
        success: true,
        assetAllocation: portfolio.assetAllocation,
        positionAllocation: portfolio.positionAllocation,
        totalValueUSD: portfolio.totalValueUSD
      });
    } catch (error) {
      fastify.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get portfolio allocation');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * GET /api/v1/portfolio/history
   * Get portfolio historical data
   */
  fastify.get('/portfolio/history', {
    preHandler: authMiddleware,
    schema: {
      description: 'Get portfolio historical data',
      tags: ['Portfolio'],
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['24h', '7d', '30d'], default: '30d' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            history: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string', format: 'date-time' },
                  valueUSD: { type: 'string' },
                  change24h: { type: 'string' },
                  change24hPercentage: { type: 'string' }
                }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const { period = '30d' } = request.query as { period?: '24h' | '7d' | '30d' };

      const portfolio = await portfolioService.getPortfolioSummary(userId);
      if (!portfolio) {
        return reply.status(404).send({
          success: false,
          error: 'Portfolio not found'
        });
      }

      let history;
      switch (period) {
        case '24h':
          history = portfolio.dailyHistory;
          break;
        case '7d':
          history = portfolio.weeklyHistory;
          break;
        case '30d':
          history = portfolio.monthlyHistory;
          break;
        default:
          history = portfolio.monthlyHistory;
      }

      return reply.send({
        success: true,
        history
      });
    } catch (error) {
      fastify.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get portfolio history');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });
}