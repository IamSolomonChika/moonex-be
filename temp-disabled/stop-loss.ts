import { FastifyInstance } from 'fastify';
import { StopLossOrderService } from '../services/stop-loss';
import { authMiddleware } from '../middleware/auth';

/**
 * Stop Loss Order Routes
 */
export async function stopLossRoutes(fastify: FastifyInstance) {
  const stopLossService = new StopLossOrderService();

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

  const createStopLossOrderSchema = {
    type: 'object',
    required: ['tokenIn', 'tokenOut', 'amountIn', 'stopPrice', 'type'],
    properties: {
      tokenIn: tokenSchema,
      tokenOut: tokenSchema,
      amountIn: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
      stopPrice: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
      type: { type: 'string', enum: ['stop-loss', 'take-profit'] },
      trailAmount: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
      trailPercentage: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' },
      gasPrice: { type: 'string', pattern: '^[0-9]+$' },
      gasLimit: { type: 'string', pattern: '^[0-9]+$' },
      slippageTolerance: { type: 'string', pattern: '^[0-9]+(\\.[0-9]+)?$' }
    },
    additionalProperties: false
  };

  const cancelStopLossOrderSchema = {
    type: 'object',
    required: ['orderId'],
    properties: {
      orderId: { type: 'string' }
    },
    additionalProperties: false
  };

  const userOrdersQuerySchema = {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['active', 'triggered', 'cancelled', 'expired'] }
    }
  };

  /**
   * POST /api/v1/stop-loss/orders
   * Create a new stop loss order
   */
  fastify.post('/orders', {
    preHandler: authMiddleware,
    schema: {
      description: 'Create a new stop loss order',
      tags: ['Stop Loss'],
      body: createStopLossOrderSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            order: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                userId: { type: 'string' },
                tokenIn: tokenSchema,
                tokenOut: tokenSchema,
                amountIn: { type: 'string' },
                stopPrice: { type: 'string' },
                type: { type: 'string' },
                status: { type: 'string' },
                trailAmount: { type: 'string' },
                trailPercentage: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' }
              }
            },
            error: { type: 'string' },
            warnings: { type: 'array', items: { type: 'string' } }
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
      const result = await stopLossService.createStopLossOrder(request.body as any, userId);

      if (result.success) {
        return reply.send(result);
      } else {
        return reply.status(400).send(result);
      }
    } catch (error) {
      fastify.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to create stop loss order');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * POST /api/v1/stop-loss/orders/cancel
   * Cancel a stop loss order
   */
  fastify.post('/orders/cancel', {
    preHandler: authMiddleware,
    schema: {
      description: 'Cancel a stop loss order',
      tags: ['Stop Loss'],
      body: cancelStopLossOrderSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            order: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                status: { type: 'string' },
                updatedAt: { type: 'string', format: 'date-time' }
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
      const { orderId } = request.body as { orderId: string };
      const result = await stopLossService.cancelStopLossOrder(orderId, userId);

      if (result.success) {
        return reply.send(result);
      } else {
        return reply.status(400).send(result);
      }
    } catch (error) {
      fastify.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to cancel stop loss order');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * GET /api/v1/stop-loss/orders
   * Get user's stop loss orders
   */
  fastify.get('/orders', {
    preHandler: authMiddleware,
    schema: {
      description: 'Get user stop loss orders',
      tags: ['Stop Loss'],
      querystring: userOrdersQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            orders: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  tokenIn: tokenSchema,
                  tokenOut: tokenSchema,
                  amountIn: { type: 'string' },
                  stopPrice: { type: 'string' },
                  type: { type: 'string' },
                  status: { type: 'string' },
                  triggeredPrice: { type: 'string' },
                  filledAmountIn: { type: 'string' },
                  filledAmountOut: { type: 'string' },
                  trailAmount: { type: 'string' },
                  trailPercentage: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                  triggeredAt: { type: 'string', format: 'date-time' }
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
      const { status } = request.query as { status?: string };
      const orders = await stopLossService.getUserStopLossOrders(userId, status);

      return reply.send({
        success: true,
        orders
      });
    } catch (error) {
      fastify.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get user stop loss orders');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * POST /api/v1/stop-loss/check-and-trigger
   * Manually trigger order checking (for testing/admin)
   */
  fastify.post('/check-and-trigger', {
    schema: {
      description: 'Manually trigger stop loss order checking',
      tags: ['Stop Loss', 'Admin'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await stopLossService.checkAndTriggerOrders();
      await stopLossService.updateTrailingStops();

      return reply.send({
        success: true,
        message: 'Stop loss order checking completed'
      });
    } catch (error) {
      fastify.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to check and trigger orders');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * GET /api/v1/stop-loss/price-monitors
   * Get current price monitors (for debugging)
   */
  fastify.get('/price-monitors', {
    schema: {
      description: 'Get current price monitors',
      tags: ['Stop Loss', 'Debug'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            monitors: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  tokenPair: { type: 'string' },
                  currentPrice: { type: 'string' },
                  lastUpdated: { type: 'string', format: 'date-time' },
                  priceHistory: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        price: { type: 'string' },
                        timestamp: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // This would need to be exposed from the service
      // For now, return a placeholder response
      return reply.send({
        success: true,
        monitors: {},
        message: 'Price monitor data not exposed in current implementation'
      });
    } catch (error) {
      fastify.log.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get price monitors');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });
}