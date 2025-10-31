import Fastify from 'fastify';
import { config } from './config';
import { initializeDatabase, disconnectDatabase, checkDatabaseHealth } from './config/database';
import { authRoutes } from './routes/auth';
import { walletRoutes } from './routes/wallets';
import { tradingRoutes } from './routes/trading';
import { liquidityRoutes } from './routes/liquidity';
import { yieldRoutes } from './routes/yield';
import { governanceRoutes } from './routes/governance';
// import { governanceCompleteRoutes } from './routes/governance-complete'; // Temporarily commented due to TypeScript errors
import { limitOrderRoutes } from './routes/limit-orders';
// import { stopLossRoutes } from './routes/stop-loss'; // Temporarily commented due to auth errors
// import { tradingBotRoutes } from './routes/trading-bots'; // Temporarily commented due to auth errors
// import { tradingBotGenericRoutes } from './routes/trading-bots-generic'; // Temporarily commented due to syntax errors
// import { portfolioRoutes } from './routes/portfolio'; // Temporarily commented due to auth errors
import { errorHandler } from './utils/errors';
import logger from './utils/logger';
import { rateLimitAuth, rateLimitApi, rateLimitTrading } from './middleware/rateLimit';
import { sanitizeAuthInput, sanitizeTradingInput, sanitizeGeneralInput } from './middleware/sanitize';
import { logRequests } from './middleware/logging';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    }
  },
});

// Database will be initialized asynchronously in start() function

// Add global middleware
fastify.addHook('preHandler', logRequests); // Global request logging

// Register auth routes with stricter rate limiting and sanitization
fastify.register(async (fastify) => {
  fastify.addHook('preHandler', rateLimitAuth);
  fastify.addHook('preHandler', sanitizeAuthInput);
  await fastify.register(authRoutes);
}, { prefix: '/api/v1' });

// Register wallet routes with standard protection
fastify.register(async (fastify) => {
  fastify.addHook('preHandler', rateLimitApi);
  fastify.addHook('preHandler', sanitizeGeneralInput);
  await fastify.register(walletRoutes, { prefix: '/api/v1' });
});

// Register trading routes with higher limits and trading-specific sanitization
fastify.register(async (fastify) => {
  fastify.addHook('preHandler', rateLimitTrading);
  fastify.addHook('preHandler', sanitizeTradingInput);
  await fastify.register(tradingRoutes, { prefix: '/api/v1/trading' });
});

// Register other routes with standard protection
fastify.register(async (fastify) => {
  fastify.addHook('preHandler', rateLimitApi);
  fastify.addHook('preHandler', sanitizeGeneralInput);
  await fastify.register(liquidityRoutes, { prefix: '/api/v1/liquidity' });
});

fastify.register(async (fastify) => {
  fastify.addHook('preHandler', rateLimitApi);
  fastify.addHook('preHandler', sanitizeGeneralInput);
  await fastify.register(yieldRoutes, { prefix: '/api/v1/yield' });
});

fastify.register(async (fastify) => {
  fastify.addHook('preHandler', rateLimitApi);
  fastify.addHook('preHandler', sanitizeGeneralInput);
  await fastify.register(governanceRoutes, { prefix: '/api/v1/governance' });
});

fastify.register(async (fastify) => {
  fastify.addHook('preHandler', rateLimitApi);
  fastify.addHook('preHandler', sanitizeGeneralInput);
  await fastify.register(limitOrderRoutes, { prefix: '/api/v1/limit-orders' });
});

// Commented routes would also need middleware when re-enabled
// fastify.register(governanceCompleteRoutes, { prefix: '/api/v1/governance-complete' });
// fastify.register(stopLossRoutes, { prefix: '/api/v1/stop-loss' });
// fastify.register(tradingBotRoutes, { prefix: '/api/v1/trading-bots' });
// fastify.register(tradingBotGenericRoutes, { prefix: '/api/v1/trading' });
// fastify.register(portfolioRoutes, { prefix: '/api/v1/portfolio' });

// Global error handler
fastify.setErrorHandler(errorHandler);

// API Documentation routes
fastify.register(async (fastify) => {
  // Serve OpenAPI specification
  fastify.get('/docs/openapi.json', async (request, reply) => {
    try {
      const OpenAPIGenerator = (await import('./utils/openapi-generator')).default;
      const generator = new OpenAPIGenerator(fastify);
      const spec = await generator.generateSpec();
      return reply.type('application/json').send(spec);
    } catch (error) {
      fastify.log.error({ error }, 'Failed to generate OpenAPI spec');
      return reply.code(500).send({ error: 'Failed to generate API specification' });
    }
  });

  // Serve OpenAPI specification in YAML format
  fastify.get('/docs/openapi.yaml', async (request, reply) => {
    try {
      const OpenAPIGenerator = (await import('./utils/openapi-generator')).default;
      const generator = new OpenAPIGenerator(fastify);
      const spec = await generator.generateSpec();
      const yaml = (await import('js-yaml')).dump;
      return reply.type('application/yaml').send(yaml(spec));
    } catch (error) {
      fastify.log.error({ error }, 'Failed to generate OpenAPI YAML');
      return reply.code(500).send({ error: 'Failed to generate API specification' });
    }
  });

  // Serve Swagger UI HTML
  fastify.get('/docs', async (request, reply) => {
    const swaggerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>MoonEx API - Swagger UI</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui.css">
    <style>
      body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .scheme-container { margin: 20px 0; }
      .header { text-align: center; margin-bottom: 30px; }
      .header h1 { color: #2c5282; margin-bottom: 10px; }
      .header p { color: #718096; }
      .api-status { background: #f7fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #4299e1; }
      .links { display: flex; gap: 20px; justify-content: center; margin-bottom: 20px; }
      .links a { padding: 10px 20px; background: #4299e1; color: white; text-decoration: none; border-radius: 6px; transition: background 0.2s; }
      .links a:hover { background: #3182ce; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 MoonEx API Documentation</h1>
        <p>Comprehensive DeFi trading and wallet management API</p>
    </div>

    <div class="api-status">
        <h3>🔗 API Base URL</h3>
        <p><strong>Development:</strong> <code>http://127.0.0.1:3000/api/v1</code></p>
        <p><strong>Health Check:</strong> <code>GET http://127.0.0.1:3000</code></p>
    </div>

    <div class="links">
        <a href="/docs/openapi.json" target="_blank">📄 OpenAPI JSON</a>
        <a href="/docs/openapi.yaml" target="_blank">📄 OpenAPI YAML</a>
        <a href="/docs/redoc" target="_blank">📖 ReDoc View</a>
    </div>

    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: '/docs/openapi.json',
          dom_id: '#swagger-ui',
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
          ],
          layout: "BaseLayout",
          deepLinking: true,
          showExtensions: true,
          showCommonExtensions: true,
          tryItOutEnabled: true,
          requestInterceptor: (request) => {
            // Automatically set the base URL to the local development server
            if (request.url && request.url.startsWith('/api/v1')) {
              request.url = request.url.replace('/api/v1', 'http://127.0.0.1:3000/api/v1');
            }
            return request;
          }
        });
      };
    </script>
</body>
</html>`;
    return reply.type('text/html').send(swaggerHtml);
  });

  // Serve ReDoc HTML
  fastify.get('/docs/redoc', async (request, reply) => {
    const redocHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>MoonEx API - ReDoc</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      redoc { min-height: 100vh; }
      .header { text-align: center; margin-bottom: 30px; }
      .header h1 { color: #2c5282; margin-bottom: 10px; }
      .links { display: flex; gap: 20px; justify-content: center; margin-bottom: 20px; }
      .links a { padding: 10px 20px; background: #4299e1; color: white; text-decoration: none; border-radius: 6px; transition: background 0.2s; }
      .links a:hover { background: #3182ce; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📖 MoonEx API Documentation (ReDoc)</h1>
        <p>Alternative documentation view with enhanced readability</p>
    </div>

    <div class="links">
        <a href="/docs">🔙 Back to Swagger UI</a>
        <a href="/docs/openapi.json" target="_blank">📄 OpenAPI JSON</a>
        <a href="/docs/openapi.yaml" target="_blank">📄 OpenAPI YAML</a>
    </div>

    <redoc spec-url='/docs/openapi.json'></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@2.0.0/bundles/redoc.standalone.js"></script>
</body>
</html>`;
    return reply.type('text/html').send(redocHtml);
  });

}, { prefix: '' });

// Health check endpoint
fastify.get('/', async (request, reply) => {
  try {
    const dbHealth = await checkDatabaseHealth();

    return {
      status: 'ok',
      message: 'MoonEx API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: {
        connected: dbHealth,
        status: dbHealth ? 'healthy' : 'unhealthy'
      }
    };
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    return reply.code(503).send({
      status: 'error',
      message: 'Service unavailable',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: {
        connected: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await disconnectDatabase();
  process.exit(0);
});

const start = async () => {
  try {
    // Initialize database first before starting server
    logger.info('Initializing database connection...');
    initializeDatabase();

    // Test database connection
    const dbHealth = await checkDatabaseHealth();
    if (!dbHealth) {
      throw new Error('Database health check failed');
    }

    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    logger.info(`Server listening on port ${config.port}`);
    logger.info('Database connection initialized successfully');
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    await disconnectDatabase();
    process.exit(1);
  }
};

// Export the server instance for testing
export const createServer = async () => {
  return fastify;
};

// Start the server if this file is run directly
if (require.main === module) {
  start();
}