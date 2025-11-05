/**
 * BSC Routes Index
 * Main entry point for all BSC-related routes
 */

import { FastifyInstance } from 'fastify';
import tokenRoutes from './tokens.js';
import { tradingRoutes } from './trading.js';
import { liquidityRoutes } from './liquidity.js';
import { portfolioRoutes } from './portfolio.js';
import logger from '../utils/logger';

/**
 * Register all BSC routes
 */
export async function bscRoutes(fastify: FastifyInstance) {
  logger.info('Registering BSC routes');

  // Register token routes
  await fastify.register(tokenRoutes, { prefix: '/tokens' });

  // Register trading routes
  await fastify.register(tradingRoutes, { prefix: '/trading' });

  // Register liquidity routes
  await fastify.register(liquidityRoutes, { prefix: '/liquidity' });

  // Register yield routes (temporarily excluded)
  // await fastify.register(yieldRoutes, { prefix: '/yield' });

  // Register portfolio routes
  await fastify.register(portfolioRoutes, { prefix: '/portfolio' });

  // Add health check for BSC services
  fastify.get('/health', {
    schema: {}
  }, async (request, reply) => {
    try {
      const healthChecks = await Promise.allSettled([
        // Add health checks for various BSC services
        Promise.resolve(true), // Placeholder for token service health
        Promise.resolve(true), // Placeholder for price tracker health
        Promise.resolve(true), // Placeholder for verification service health
        Promise.resolve(true), // Placeholder for trading service health
      ]);

      const allHealthy = healthChecks.every(check => check.status === 'fulfilled' && check.value === true);

      return reply.send({
        success: true,
        data: {
          status: allHealthy ? 'healthy' : 'unhealthy',
          services: {
            tokenService: healthChecks[0].status === 'fulfilled' && healthChecks[0].value === true,
            priceTracker: healthChecks[1].status === 'fulfilled' && healthChecks[1].value === true,
            verificationService: healthChecks[2].status === 'fulfilled' && healthChecks[2].value === true,
            tradingService: healthChecks[3].status === 'fulfilled' && healthChecks[3].value === true,
          },
          timestamp: Date.now()
        }
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'BSC health check failed');
      return reply.status(500).send({
        success: false,
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  logger.info('BSC routes registered successfully');
}