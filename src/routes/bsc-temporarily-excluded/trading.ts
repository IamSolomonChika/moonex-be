/**
 * BSC Trading Routes
 * API endpoints for BSC trading functionality
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import logger from '../../utils/logger.js';
import { swapService } from '../../bsc/services/trading/swap-service.js';
import { pancakeSwapAMM } from '../../bsc/services/trading/amm-integration.js';
import type {
  SwapRequest,
  SwapOptions,
  SwapQuote,
  SwapTransaction,
  V3QuoteRequest
} from '../../bsc/services/trading/types.js';

/**
 * Swap request body schema
 */
const SwapRequestSchema = {
  type: 'object',
  required: ['tokenIn', 'tokenOut', 'recipient'],
  properties: {
    tokenIn: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    tokenOut: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    amountIn: { type: 'string' },
    amountOut: { type: 'string' },
    recipient: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    slippageTolerance: { type: 'number', minimum: 0, maximum: 5000, default: 50 },
    deadlineMinutes: { type: 'number', minimum: 1, maximum: 60, default: 20 },
    options: {
      type: 'object',
      properties: {
        preferV3: { type: 'boolean', default: false },
        useV2Fallback: { type: 'boolean', default: true },
        feeTiers: { type: 'array', items: { type: 'number' } },
        maxHops: { type: 'number', minimum: 1, maximum: 8, default: 4 },
        enableMEVProtection: { type: 'boolean', default: true },
        gasPrice: {
          type: 'object',
          properties: {
            maxFeePerGas: { type: 'string' },
            maxPriorityFeePerGas: { type: 'string' },
            gasLimit: { type: 'string' }
          }
        }
      }
    }
  },
  oneOf: [
    { required: ['amountIn'], not: { required: ['amountOut'] } },
    { required: ['amountOut'], not: { required: ['amountIn'] } }
  ]
};

/**
 * Quote request query schema
 */
const QuoteQuerySchema = {
  type: 'object',
  required: ['tokenIn', 'tokenOut'],
  properties: {
    tokenIn: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    tokenOut: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    amountIn: { type: 'string' },
    amountOut: { type: 'string' },
    slippageTolerance: { type: 'number', minimum: 0, maximum: 5000, default: 50 },
    deadlineMinutes: { type: 'number', minimum: 1, maximum: 60, default: 20 },
    preferV3: { type: 'boolean', default: false },
    useV2Fallback: { type: 'boolean', default: true },
    feeTiers: { type: 'array', items: { type: 'number' } },
    maxHops: { type: 'number', minimum: 1, maximum: 8, default: 4 }
  },
  oneOf: [
    { required: ['amountIn'], not: { required: ['amountOut'] } },
    { required: ['amountOut'], not: { required: ['amountIn'] } }
  ]
};

/**
 * Register all trading routes
 */
export async function tradingRoutes(fastify: FastifyInstance) {
  logger.info('Registering BSC trading routes');

  /**
   * Get swap quote
   */
  fastify.get('/quote', {
    schema: {
      description: 'Get swap quote for token pair',
      tags: ['bsc', 'trading', 'quote'],
      querystring: QuoteQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                quote: { type: 'object' },
                isValid: { type: 'boolean' },
                warnings: { type: 'array', items: { type: 'string' } },
                alternatives: { type: 'array', items: { type: 'object' } }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    try {
      const { tokenIn, tokenOut, amountIn, amountOut, ...options } = request.query;

      const quoteRequest: V3QuoteRequest = {
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        options: {
          slippageTolerance: options.slippageTolerance,
          deadlineMinutes: options.deadlineMinutes,
          preferV3: options.preferV3,
          useV2Fallback: options.useV2Fallback,
          feeTiers: options.feeTiers,
          maxHops: options.maxHops
        }
      };

      const ammResponse = await pancakeSwapAMM.getQuote(quoteRequest);

      return reply.send({
        success: true,
        data: {
          quote: ammResponse.quote,
          isValid: ammResponse.isValid,
          warnings: ammResponse.warnings,
          alternatives: ammResponse.alternatives
        }
      });

    } catch (error) {
      logger.error({
        query: request.query,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get swap quote');

      return reply.status(400).send({
        success: false,
        error: 'Failed to get swap quote',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Execute swap
   */
  fastify.post('/swap', {
    schema: {
      description: 'Execute token swap',
      tags: ['bsc', 'trading', 'swap'],
      body: SwapRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                transaction: { type: 'object' },
                quote: { type: 'object' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: SwapRequest }>, reply: FastifyReply) => {
    try {
      // For now, return quote without actual execution
      // In a real implementation, this would require user signature/Wallet integration
      const quote = await swapService.getQuote(request.body);

      // Build transaction for preview
      const transaction = await swapService['buildSwapTransaction'](quote, request.body);

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
            protocol: transaction.protocol,
            routerInfo: transaction.routerInfo,
            message: 'Transaction built successfully. Sign and send to execute swap.'
          }
        }
      });

    } catch (error) {
      logger.error({
        body: request.body,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to execute swap');

      return reply.status(400).send({
        success: false,
        error: 'Failed to execute swap',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get transaction details
   */
  fastify.get('/transaction/:hash', {
    schema: {
      description: 'Get transaction details',
      tags: ['bsc', 'trading', 'transaction'],
      params: {
        type: 'object',
        required: ['hash'],
        properties: {
          hash: { type: 'string', pattern: '^0x[a-fA-F0-9]{64}$' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                transaction: { type: 'object' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { hash: string } }>, reply: FastifyReply) => {
    try {
      const { hash } = request.params;
      const transaction = await swapService.getTransaction(hash);

      if (!transaction) {
        return reply.status(404).send({
          success: false,
          error: 'Transaction not found',
          message: `Transaction ${hash} not found`
        });
      }

      return reply.send({
        success: true,
        data: { transaction }
      });

    } catch (error) {
      logger.error({
        hash: request.params.hash,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get transaction details');

      return reply.status(500).send({
        success: false,
        error: 'Failed to get transaction details',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Batch quotes
   */
  fastify.post('/quotes/batch', {
    schema: {
      description: 'Get multiple swap quotes',
      tags: ['bsc', 'trading', 'quote'],
      body: {
        type: 'object',
        required: ['requests'],
        properties: {
          requests: {
            type: 'array',
            items: QuoteQuerySchema,
            minItems: 1,
            maxItems: 10
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                quotes: { type: 'array', items: { type: 'object' } }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: { requests: V3QuoteRequest[] } }>, reply: FastifyReply) => {
    try {
      const { requests } = request.body;
      const quotes = await swapService.batchQuotes(requests);

      return reply.send({
        success: true,
        data: { quotes }
      });

    } catch (error) {
      logger.error({
        body: request.body,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get batch quotes');

      return reply.status(400).send({
        success: false,
        error: 'Failed to get batch quotes',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Trading analytics
   */
  fastify.get('/analytics', {
    schema: {
      description: 'Get trading analytics and metrics',
      tags: ['bsc', 'trading', 'analytics'],
      querystring: {
        type: 'object',
        properties: {
          timeframe: {
            type: 'string',
            enum: ['1h', '24h', '7d', '30d'],
            default: '24h'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                metrics: { type: 'object' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: { timeframe?: string } }>, reply: FastifyReply) => {
    try {
      const { timeframe } = request.query;
      const metrics = await swapService.getSwapMetrics(timeframe);

      return reply.send({
        success: true,
        data: { metrics }
      });

    } catch (error) {
      logger.error({
        query: request.query,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get trading analytics');

      return reply.status(500).send({
        success: false,
        error: 'Failed to get trading analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get routing options
   */
  fastify.get('/routing/options', {
    schema: {
      description: 'Get multi-hop routing options for token pair',
      tags: ['bsc', 'trading', 'routing'],
      querystring: {
        type: 'object',
        required: ['tokenIn', 'tokenOut', 'amountIn'],
        properties: {
          tokenIn: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          tokenOut: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          amountIn: { type: 'string' },
          maxRoutes: { type: 'number', minimum: 1, maximum: 10, default: 5 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                routes: { type: 'array', items: { type: 'object' } },
                bestRoute: { type: 'object' },
                alternatives: { type: 'array', items: { type: 'object' } },
                totalOptions: { type: 'number' },
                calculationTime: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    try {
      const { tokenIn, tokenOut, amountIn, maxRoutes } = request.query;

      const routingResult = await swapService.getRoutingOptions(tokenIn, tokenOut, amountIn);

      return reply.send({
        success: true,
        data: {
          routes: routingResult.routes,
          bestRoute: routingResult.bestRoute,
          alternatives: routingResult.alternatives,
          totalOptions: routingResult.totalOptions,
          calculationTime: routingResult.calculationTime
        }
      });

    } catch (error) {
      logger.error({
        query: request.query,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get routing options');

      return reply.status(400).send({
        success: false,
        error: 'Failed to get routing options',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get best routes
   */
  fastify.get('/routing/best', {
    schema: {
      description: 'Get best routes for token pair',
      tags: ['bsc', 'trading', 'routing'],
      querystring: {
        type: 'object',
        required: ['tokenIn', 'tokenOut', 'amountIn'],
        properties: {
          tokenIn: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          tokenOut: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          amountIn: { type: 'string' },
          maxRoutes: { type: 'number', minimum: 1, maximum: 10, default: 5 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                routes: { type: 'array', items: { type: 'object' } }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    try {
      const { tokenIn, tokenOut, amountIn, maxRoutes } = request.query;

      const routes = await swapService.findBestRoutes(tokenIn, tokenOut, amountIn, maxRoutes);

      return reply.send({
        success: true,
        data: { routes }
      });

    } catch (error) {
      logger.error({
        query: request.query,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get best routes');

      return reply.status(400).send({
        success: false,
        error: 'Failed to get best routes',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get transaction queue status
   */
  fastify.get('/queue/status', {
    schema: {
      description: 'Get transaction queue status',
      tags: ['bsc', 'trading', 'queue'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                queueSize: { type: 'number' },
                processingCount: { type: 'number' },
                completedCount: { type: 'number' },
                failedCount: { type: 'number' },
                averageWaitTime: { type: 'number' },
                processingItems: { type: 'array', items: { type: 'object' } },
                nextRetryAt: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const queueStatus = await swapService.getQueueStatus();

      return reply.send({
        success: true,
        data: queueStatus
      });

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get queue status');

      return reply.status(500).send({
        success: false,
        error: 'Failed to get queue status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Queue a swap
   */
  fastify.post('/queue', {
    schema: {
      description: 'Queue a swap transaction',
      tags: ['bsc', 'trading', 'queue'],
      body: SwapRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                queueId: { type: 'string' },
                position: { type: 'number' },
                estimatedWaitTime: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: SwapRequest }>, reply: FastifyReply) => {
    try {
      const priority = request.body.options?.priority || 0;
      const queueId = await swapService.queueSwap(request.body, priority);

      return reply.send({
        success: true,
        data: {
          queueId,
          position: 1, // Would get actual position from queue
          estimatedWaitTime: 30000 // 30 seconds estimate
        }
      });

    } catch (error) {
      logger.error({
        body: request.body,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to queue swap');

      return reply.status(400).send({
        success: false,
        error: 'Failed to queue swap',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Cancel queued swap
   */
  fastify.delete('/queue/:queueId', {
    schema: {
      description: 'Cancel a queued swap',
      tags: ['bsc', 'trading', 'queue'],
      params: {
        type: 'object',
        required: ['queueId'],
        properties: {
          queueId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                cancelled: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { queueId: string } }>, reply: FastifyReply) => {
    try {
      const { queueId } = request.params;
      const cancelled = await swapService.cancelQueuedSwap(queueId);

      return reply.send({
        success: true,
        data: { cancelled }
      });

    } catch (error) {
      logger.error({
        queueId: request.params.queueId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to cancel queued swap');

      return reply.status(400).send({
        success: false,
        error: 'Failed to cancel queued swap',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Service health check
   */
  fastify.get('/health', {
    schema: {
      description: 'Trading service health check',
      tags: ['bsc', 'trading', 'health'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                services: { type: 'object' },
                timestamp: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = await swapService.getServiceStatus();

      return reply.send({
        success: true,
        data: {
          status: status.healthy ? 'healthy' : 'unhealthy',
          services: {
            swapService: status.healthy,
            routingService: true, // Would check actual routing service health
            queueService: true, // Would check actual queue service health
            ammIntegration: true, // Would check actual AMM health
            provider: true // Would check actual provider health
          },
          timestamp: Date.now()
        }
      });

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Trading service health check failed');

      return reply.status(500).send({
        success: false,
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  logger.info('BSC trading routes registered successfully');
}