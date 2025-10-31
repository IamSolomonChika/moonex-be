import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { LimitOrderService, CreateLimitOrderRequest, Token } from '../services/limit-orders';
import { AuthenticatedRequest } from '../middleware/auth';
import logger from '../utils/logger';

/**
 * Create limit order request body
 */
interface CreateLimitOrderRequestBody {
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
  amountOutMin: string;
  price: string;
  type: 'buy' | 'sell';
  gasPrice?: string;
  gasLimit?: string;
  slippageTolerance?: string;
  expiresAt: string;
}

/**
 * Cancel order request body
 */
interface CancelOrderRequestBody {
  orderId: string;
}

/**
 * Get order book request params
 */
interface GetOrderBookParams {
  tokenIn: string;
  tokenOut: string;
}

/**
 * Initialize limit order service
 */
const limitOrderService = new LimitOrderService();

/**
 * Limit order routes plugin
 */
export async function limitOrderRoutes(fastify: FastifyInstance) {

  /**
   * Create new limit order
   */
  fastify.post<{ Body: CreateLimitOrderRequestBody }>('/orders', {
    schema: {
      body: {
        type: 'object',
        required: ['tokenIn', 'tokenOut', 'amountIn', 'amountOutMin', 'price', 'type', 'expiresAt'],
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
          amountIn: {
            type: 'string',
            pattern: '^[0-9]+(\\.[0-9]+)?$'
          },
          amountOutMin: {
            type: 'string',
            pattern: '^[0-9]+(\\.[0-9]+)?$'
          },
          price: {
            type: 'string',
            pattern: '^[0-9]+(\\.[0-9]+)?$'
          },
          type: {
            type: 'string',
            enum: ['buy', 'sell']
          },
          gasPrice: {
            type: 'string',
            pattern: '^[0-9]+$'
          },
          gasLimit: {
            type: 'string',
            pattern: '^[0-9]+$'
          },
          slippageTolerance: {
            type: 'string',
            pattern: '^0\\.[0-9]+$'
          },
          expiresAt: {
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

      const body = request.body as CreateLimitOrderRequestBody;
      const {
        tokenIn,
        tokenOut,
        amountIn,
        amountOutMin,
        price,
        type,
        gasPrice,
        gasLimit,
        slippageTolerance,
        expiresAt
      } = body;

      // Validate token addresses are different
      if (tokenIn.address === tokenOut.address) {
        return reply.code(400).send({
          success: false,
          error: 'Token addresses must be different'
        });
      }

      const createRequest: CreateLimitOrderRequest = {
        tokenIn,
        tokenOut,
        amountIn,
        amountOutMin,
        price,
        type,
        gasPrice,
        gasLimit,
        slippageTolerance,
        expiresAt: new Date(expiresAt)
      };

      const result = await limitOrderService.createLimitOrder(createRequest, request.user.id);

      if (!result.success) {
        return reply.code(400).send(result);
      }

      logger.info(`Limit order created by user ${request.user.id}: ${type} ${amountIn} ${tokenIn.symbol}`);

      return reply.code(201).send({
        success: true,
        order: result.order
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to create limit order');
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Cancel limit order
   */
  fastify.post<{ Body: CancelOrderRequestBody }>('/orders/cancel', {
    schema: {
      body: {
        type: 'object',
        required: ['orderId'],
        properties: {
          orderId: { type: 'string' }
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

      const body = request.body as CancelOrderRequestBody;
      const { orderId } = body;

      const result = await limitOrderService.cancelLimitOrder(orderId, request.user.id);

      if (!result.success) {
        return reply.code(400).send(result);
      }

      logger.info(`Limit order cancelled by user ${request.user.id}: ${orderId}`);

      return reply.code(200).send({
        success: true,
        order: result.order
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to cancel limit order');
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Get user's limit orders
   */
  fastify.get('/orders', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'filled', 'cancelled', 'expired']
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

      const query = request.query as { status?: string };
      const { status } = query;

      const orders = await limitOrderService.getUserLimitOrders(request.user.id, status);

      return reply.code(200).send({
        success: true,
        orders,
        count: orders.length
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get user limit orders');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve orders'
      });
    }
  });

  /**
   * Get order book for token pair
   */
  fastify.get<{
    Params: GetOrderBookParams
  }>('/orderbook/:tokenIn/:tokenOut', {
    schema: {
      params: {
        type: 'object',
        properties: {
          tokenIn: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          tokenOut: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        },
        required: ['tokenIn', 'tokenOut']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as GetOrderBookParams;
      const { tokenIn, tokenOut } = params;

      // Validate tokens are different
      if (tokenIn === tokenOut) {
        return reply.code(400).send({
          success: false,
          error: 'Token addresses must be different'
        });
      }

      // Mock token objects - in production, fetch from token registry
      const tokenInObj: Token = {
        address: tokenIn,
        symbol: 'TOKENIN',
        decimals: 18
      };

      const tokenOutObj: Token = {
        address: tokenOut,
        symbol: 'TOKENOUT',
        decimals: 18
      };

      const orderBook = await limitOrderService.getOrderBook(tokenInObj, tokenOutObj);

      if (!orderBook) {
        return reply.code(404).send({
          success: false,
          error: 'Order book not found'
        });
      }

      return reply.code(200).send({
        success: true,
        orderBook
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get order book');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve order book'
      });
    }
  });

  /**
   * Get specific order by ID
   */
  fastify.get<{
    Params: { orderId: string }
  }>('/orders/:orderId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          orderId: { type: 'string' }
        },
        required: ['orderId']
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

      const params = request.params as { orderId: string };
      const { orderId } = params;

      const orders = await limitOrderService.getUserLimitOrders(request.user.id);
      const order = orders.find(o => o.id === orderId);

      if (!order) {
        return reply.code(404).send({
          success: false,
          error: 'Order not found'
        });
      }

      return reply.code(200).send({
        success: true,
        order
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get order');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve order'
      });
    }
  });

  /**
   * Check and expire pending orders (admin/internal endpoint)
   */
  fastify.post('/orders/check-expired', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await limitOrderService.checkExpiredOrders();

      return reply.code(200).send({
        success: true,
        message: 'Expired orders checked and updated'
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to check expired orders');
      return reply.code(500).send({
        success: false,
        error: 'Failed to check expired orders'
      });
    }
  });

  /**
   * Health check for limit order service
   */
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Perform basic health check by attempting to get an empty order book
      const dummyToken: Token = {
        address: '0x0000000000000000000000000000000000000000',
        symbol: 'TEST',
        decimals: 18
      };

      const orderBook = await limitOrderService.getOrderBook(dummyToken, dummyToken);

      return reply.code(200).send({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          limitOrderService: 'operational',
          database: 'operational'
        },
        orderBookStatus: orderBook ? 'functional' : 'empty'
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Limit order health check failed');
      return reply.code(503).send({
        success: false,
        status: 'unhealthy',
        error: 'Limit order service unavailable'
      });
    }
  });
}