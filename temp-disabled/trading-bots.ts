import { FastifyInstance } from 'fastify';
import { TradingBotService } from '../services/trading-bots';
import { authMiddleware } from '../middleware/auth';

/**
 * Trading Bot Routes
 */
export async function tradingBotRoutes(fastify: FastifyInstance) {
  const botService = new TradingBotService();

  // Schema definitions
  const tokenSchema = {
    type: 'object',
    required: ['address', 'symbol', 'decimals'],
    properties: {
      address: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
      symbol: { type: 'string', minLength: 1, maxLength: 20 },
      decimals: { type: 'integer', minimum: 0, maximum: 77 }
    }
  };

  const createGridBotSchema = {
    type: 'object',
    required: ['name', 'tokenIn', 'tokenOut', 'upperPrice', 'lowerPrice', 'gridCount', 'totalInvestment'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      tokenIn: tokenSchema,
      tokenOut: tokenSchema,
      upperPrice: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
      lowerPrice: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
      gridCount: { type: 'integer', minimum: 1, maximum: 100 },
      totalInvestment: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
      takeProfit: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
      stopLoss: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' }
    },
    additionalProperties: false
  };

  const createDCABotSchema = {
    type: 'object',
    required: ['name', 'tokenIn', 'tokenOut', 'totalInvestment', 'purchaseInterval', 'purchaseAmount'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      tokenIn: tokenSchema,
      tokenOut: tokenSchema,
      totalInvestment: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
      purchaseInterval: { type: 'integer', minimum: 1, maximum: 8760 }, // Max 1 year
      purchaseAmount: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
      maxPrice: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
      minPrice: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
      takeProfit: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
      stopLoss: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' }
    },
    additionalProperties: false
  };

  const createMomentumBotSchema = {
    type: 'object',
    required: ['name', 'tokenIn', 'tokenOut', 'rsiPeriod', 'rsiOverbought', 'rsiOversold', 'investmentAmount'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      tokenIn: tokenSchema,
      tokenOut: tokenSchema,
      rsiPeriod: { type: 'integer', minimum: 1, maximum: 100 },
      rsiOverbought: { type: 'number', minimum: 0, maximum: 100 },
      rsiOversold: { type: 'number', minimum: 0, maximum: 100 },
      investmentAmount: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
      takeProfit: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
      stopLoss: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' }
    },
    additionalProperties: false
  };

  const stopBotSchema = {
    type: 'object',
    required: ['botId'],
    properties: {
      botId: { type: 'string' }
    },
    additionalProperties: false
  };

  /**
   * POST /api/v1/trading/bots/grid
   * Create a grid trading bot
   */
  fastify.post('/bots/grid', {
    preHandler: authMiddleware,
    schema: {
      description: 'Create a grid trading bot',
      tags: ['Trading Bots'],
      body: createGridBotSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            bot: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                userId: { type: 'string' },
                name: { type: 'string' },
                type: { type: 'string' },
                tokenIn: tokenSchema,
                tokenOut: tokenSchema,
                isActive: { type: 'boolean' },
                parameters: { type: 'object' },
                createdAt: { type: 'string', format: 'date-time' }
              }
            },
            error: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
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
      const { name, tokenIn, tokenOut, upperPrice, lowerPrice, gridCount, totalInvestment, takeProfit, stopLoss } = request.body as any;

      const result = await botService.createBot(
        userId,
        name,
        'grid',
        tokenIn,
        tokenOut,
        {
          upperPrice,
          lowerPrice,
          gridCount,
          totalInvestment,
          takeProfit,
          stopLoss
        }
      );

      if (result.success) {
        return reply.send(result);
      } else {
        return reply.status(400).send(result);
      }
    } catch (error) {
      fastify.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to create grid bot');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * POST /api/v1/trading/bots/dca
   * Create a DCA (Dollar Cost Averaging) bot
   */
  fastify.post('/bots/dca', {
    preHandler: authMiddleware,
    schema: {
      description: 'Create a DCA trading bot',
      tags: ['Trading Bots'],
      body: createDCABotSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            bot: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                userId: { type: 'string' },
                name: { type: 'string' },
                type: { type: 'string' },
                tokenIn: tokenSchema,
                tokenOut: tokenSchema,
                isActive: { type: 'boolean' },
                parameters: { type: 'object' },
                createdAt: { type: 'string', format: 'date-time' }
              }
            },
            error: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
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
      const { name, tokenIn, tokenOut, totalInvestment, purchaseInterval, purchaseAmount, maxPrice, minPrice, takeProfit, stopLoss } = request.body as any;

      const result = await botService.createBot(
        userId,
        name,
        'dca',
        tokenIn,
        tokenOut,
        {
          totalInvestment,
          purchaseInterval,
          purchaseAmount,
          maxPrice,
          minPrice,
          takeProfit,
          stopLoss
        }
      );

      if (result.success) {
        return reply.send(result);
      } else {
        return reply.status(400).send(result);
      }
    } catch (error) {
      fastify.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to create DCA bot');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * POST /api/v1/trading/bots/momentum
   * Create a momentum trading bot
   */
  fastify.post('/bots/momentum', {
    preHandler: authMiddleware,
    schema: {
      description: 'Create a momentum trading bot',
      tags: ['Trading Bots'],
      body: createMomentumBotSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            bot: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                userId: { type: 'string' },
                name: { type: 'string' },
                type: { type: 'string' },
                tokenIn: tokenSchema,
                tokenOut: tokenSchema,
                isActive: { type: 'boolean' },
                parameters: { type: 'object' },
                createdAt: { type: 'string', format: 'date-time' }
              }
            },
            error: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
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
      const { name, tokenIn, tokenOut, rsiPeriod, rsiOverbought, rsiOversold, investmentAmount, takeProfit, stopLoss } = request.body as any;

      const result = await botService.createBot(
        userId,
        name,
        'momentum',
        tokenIn,
        tokenOut,
        {
          rsiPeriod,
          rsiOverbought,
          rsiOversold,
          investmentAmount,
          takeProfit,
          stopLoss
        }
      );

      if (result.success) {
        return reply.send(result);
      } else {
        return reply.status(400).send(result);
      }
    } catch (error) {
      fastify.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to create momentum bot');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * POST /api/v1/trading/bots/stop
   * Stop a trading bot
   */
  fastify.post('/bots/stop', {
    preHandler: authMiddleware,
    schema: {
      description: 'Stop a trading bot',
      tags: ['Trading Bots'],
      body: stopBotSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
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
      const { botId } = request.body as { botId: string };
      const result = await botService.stopBot(botId, userId);

      if (result.success) {
        return reply.send({
          success: true,
          message: 'Bot stopped successfully'
        });
      } else {
        return reply.status(400).send(result);
      }
    } catch (error) {
      fastify.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to stop bot');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * GET /api/v1/trading/bots
   * Get user's trading bots
   */
  fastify.get('/bots', {
    preHandler: authMiddleware,
    schema: {
      description: 'Get user trading bots',
      tags: ['Trading Bots'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            bots: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  name: { type: 'string' },
                  type: { type: 'string' },
                  tokenIn: tokenSchema,
                  tokenOut: tokenSchema,
                  isActive: { type: 'boolean' },
                  parameters: { type: 'object' },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' }
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
      const bots = await botService.getUserBots(userId);

      return reply.send({
        success: true,
        bots
      });
    } catch (error) {
      fastify.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get user bots');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * GET /api/v1/trading/bots/:botId/performance
   * Get bot performance metrics
   */
  fastify.get('/bots/:botId/performance', {
    preHandler: authMiddleware,
    schema: {
      description: 'Get bot performance metrics',
      tags: ['Trading Bots'],
      params: {
        type: 'object',
        required: ['botId'],
        properties: {
          botId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            performance: {
              type: 'object',
              properties: {
                totalInvested: { type: 'string' },
                currentValue: { type: 'string' },
                profitLoss: { type: 'string' },
                profitLossPercentage: { type: 'string' },
                totalTrades: { type: 'integer' },
                successfulTrades: { type: 'integer' },
                winRate: { type: 'string' },
                averageHoldingTime: { type: 'number' },
                lastTradeAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
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
      const { botId } = request.params as { botId: string };
      const performance = await botService.getBotPerformance(botId, userId);

      if (performance) {
        return reply.send({
          success: true,
          performance
        });
      } else {
        return reply.status(400).send({
          success: false,
          error: 'Bot not found or access denied'
        });
      }
    } catch (error) {
      fastify.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get bot performance');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });
}