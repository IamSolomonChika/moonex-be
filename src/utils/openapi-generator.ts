import { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

/**
 * OpenAPI Documentation Generator for MoonEx API
 *
 * This class automatically generates comprehensive OpenAPI 3.0 documentation
 * by analyzing the Fastify application routes and schemas.
 */

interface OpenAPIInfo {
  title: string;
  version: string;
  description: string;
  contact?: {
    name: string;
    email: string;
    url: string;
  };
  license?: {
    name: string;
    url: string;
  };
}

interface OpenAPIServer {
  url: string;
  description: string;
}

interface Config {
  info?: Partial<OpenAPIInfo>;
  servers?: OpenAPIServer[];
  outputPath?: string;
  includeExamples?: boolean;
  securitySchemes?: any;
}

export class OpenAPIGenerator {
  private config: Config;
  private paths: any = {};
  private schemas: any = {};
  private tags: any[] = [];

  constructor(_fastify: FastifyInstance, config: Config = {}) {
    this.config = {
      outputPath: './api-docs',
      includeExamples: true,
      ...config
    };
  }

  /**
   * Generate complete OpenAPI 3.0 specification
   */
  async generateSpec(): Promise<any> {
    // Analyze all routes from the Fastify instance
    await this.analyzeRoutes();

    // Add common schemas
    this.addCommonSchemas();

    // Build the complete specification
    const spec: any = {
      openapi: '3.0.3',
      info: {
        title: 'MoonEx API',
        version: '1.0.0',
        description: 'Comprehensive DeFi trading and wallet management API',
        contact: {
          name: 'MoonEx Team',
          email: 'support@moonex.io',
          url: 'https://moonex.io'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        },
        ...this.config.info
      },
      servers: [
        {
          url: 'https://api.moonex.io/v1',
          description: 'Production server'
        },
        {
          url: 'https://staging-api.moonex.io/v1',
          description: 'Staging server'
        },
        {
          url: 'http://localhost:3000/api/v1',
          description: 'Development server'
        },
        ...(this.config.servers || [])
      ],
      tags: this.tags,
      paths: this.paths,
      components: {
        schemas: this.schemas,
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT authentication token obtained from /auth endpoints'
          },
          ...(this.config.securitySchemes || {})
        },
        responses: {
          SuccessResponse: {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'object' },
                    message: { type: 'string' }
                  }
                }
              }
            }
          },
          ErrorResponse: {
            description: 'Error occurred',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string' },
                    code: { type: 'string' },
                    details: { type: 'object' }
                  }
                }
              }
            }
          },
          ValidationError: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string' },
                    issues: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          field: { type: 'string' },
                          message: { type: 'string' }
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
    };

    return spec;
  }

  /**
   * Analyze Fastify routes and convert to OpenAPI paths
   */
  private async analyzeRoutes(): Promise<void> {
    // Get all registered routes
    const routes = this.getAllRoutes();

    for (const route of routes) {
      if (route.method === 'HEAD' || route.method === 'OPTIONS') continue;

      const openAPIPath = this.convertPathToOpenAPI(route.path);
      const operation = this.createOperation(route);

      if (!this.paths[openAPIPath]) {
        this.paths[openAPIPath] = {};
      }

      this.paths[openAPIPath][route.method.toLowerCase()] = operation;
    }
  }

  /**
   * Extract all routes from Fastify instance
   */
  private getAllRoutes(): any[] {
    const routes: any[] = [];

    // This is a simplified version - in production you'd walk the route tree
    // For now, we'll manually define the routes based on the codebase analysis

    // Root route
    routes.push(
      { method: 'GET', path: '/', config: { auth: false }, schema: {} }
    );

    // Auth routes - Use relative paths (without /api/v1 prefix) since server URLs already include it
    routes.push(
      { method: 'POST', path: '/auth/email', config: { auth: false }, schema: { body: { email: 'string' } } },
      { method: 'POST', path: '/auth/email/verify', config: { auth: false }, schema: { body: { email: 'string', code: 'string' } } },
      { method: 'POST', path: '/auth/social', config: { auth: false }, schema: { body: { provider: 'string', accessToken: 'string' } } },
      { method: 'POST', path: '/auth/wallet', config: { auth: false }, schema: { body: { walletAddress: 'string', signature: 'string', message: 'string' } } },
      { method: 'POST', path: '/auth/refresh', config: { auth: false }, schema: { body: { refreshToken: 'string' } } },
      { method: 'POST', path: '/auth/logout', config: { auth: true }, schema: {} },
      { method: 'GET', path: '/auth/me', config: { auth: true }, schema: {} }
    );

    // Wallet routes - Use relative paths (without /api/v1 prefix) since server URLs already include it
    routes.push(
      { method: 'POST', path: '/wallets', config: { auth: true }, schema: { body: {} } },
      { method: 'GET', path: '/wallets/{walletAddress}', config: { auth: true }, schema: { params: { walletAddress: 'string' } } },
      { method: 'GET', path: '/wallets/{walletAddress}/balance', config: { auth: true }, schema: { params: { walletAddress: 'string' } } },
      { method: 'POST', path: '/wallets/sign', config: { auth: true }, schema: { body: { walletAddress: 'string', to: 'string', value: 'string', data: 'string' } } },
      { method: 'POST', path: '/wallets/send', config: { auth: true }, schema: { body: { walletAddress: 'string', to: 'string', value: 'string', token: 'string', data: 'string' } } },
      { method: 'GET', path: '/wallets/{walletAddress}/transactions', config: { auth: true }, schema: { params: { walletAddress: 'string' }, query: { page: 'number', limit: 'number' } } },
      { method: 'POST', path: '/wallets/estimate-gas', config: { auth: true }, schema: { body: { to: 'string', value: 'string', data: 'string' } } }
    );

    // Trading routes - Use relative paths (without /api/v1 prefix) since server URLs already include it
    routes.push(
      { method: 'POST', path: '/trading/quote', config: { auth: true }, schema: { body: { tokenIn: 'object', tokenOut: 'object', amountIn: 'string', slippageTolerance: 'string' } } },
      { method: 'POST', path: '/trading/swap', config: { auth: true }, schema: { body: { tokenIn: 'object', tokenOut: 'object', amountIn: 'string', slippageTolerance: 'string', minimumOutput: 'string' } } },
      { method: 'POST', path: '/trading/routes', config: { auth: true }, schema: { body: { tokenIn: 'object', tokenOut: 'object', amountIn: 'string', maxHops: 'number' } } },
      { method: 'POST', path: '/trading/gas-estimate', config: { auth: true }, schema: { body: { transactionType: 'string', params: 'object' } } }
    );

    // Liquidity routes - Use relative paths (without /api/v1 prefix) since server URLs already include it
    routes.push(
      { method: 'POST', path: '/liquidity/pools', config: { auth: true }, schema: { body: { token0: 'object', token1: 'object', fee: 'string', initialAmount0: 'string', initialAmount1: 'string' } } },
      { method: 'GET', path: '/liquidity/pools', config: { auth: true }, schema: { query: { page: 'number', limit: 'number' } } },
      { method: 'GET', path: '/liquidity/pools/{poolId}', config: { auth: true }, schema: { params: { poolId: 'string' } } },
      { method: 'POST', path: '/liquidity/pools/{poolId}/add', config: { auth: true }, schema: { body: { poolId: 'string', amount0: 'string', amount1: 'string', slippageTolerance: 'string', minimumLPTokens: 'string' } } },
      { method: 'POST', path: '/liquidity/pools/{poolId}/remove', config: { auth: true }, schema: { body: { poolId: 'string', lpTokenAmount: 'string', slippageTolerance: 'string', minimumAmount0: 'string', minimumAmount1: 'string' } } }
    );

    // Yield farming routes - Use relative paths (without /api/v1 prefix) since server URLs already include it
    routes.push(
      { method: 'POST', path: '/yield/farms', config: { auth: true }, schema: { body: { name: 'string', description: 'string', poolId: 'string', rewardToken: 'object', rewardRate: 'string', totalRewards: 'string', durationDays: 'number' } } },
      { method: 'GET', path: '/yield/farms', config: { auth: true }, schema: { query: { page: 'number', limit: 'number', status: 'string' } } },
      { method: 'GET', path: '/yield/farms/{farmId}', config: { auth: true }, schema: { params: { farmId: 'string' } } },
      { method: 'POST', path: '/yield/farms/{farmId}/stake', config: { auth: true }, schema: { body: { farmId: 'string', amount: 'string' } } },
      { method: 'POST', path: '/yield/farms/{farmId}/unstake', config: { auth: true }, schema: { body: { farmId: 'string', amount: 'string' } } },
      { method: 'POST', path: '/yield/farms/{farmId}/claim', config: { auth: true }, schema: { body: { farmId: 'string' } } }
    );

    // Governance routes - Use relative paths (without /api/v1 prefix) since server URLs already include it
    routes.push(
      { method: 'POST', path: '/governance/proposals', config: { auth: true }, schema: { body: { title: 'string', description: 'string', votingPeriod: 'number', quorum: 'string', approvalThreshold: 'string' } } },
      { method: 'GET', path: '/governance/proposals', config: { auth: true }, schema: { query: { page: 'number', limit: 'number', status: 'string' } } },
      { method: 'GET', path: '/governance/proposals/{proposalId}', config: { auth: true }, schema: { params: { proposalId: 'string' } } },
      { method: 'POST', path: '/governance/proposals/{proposalId}/vote', config: { auth: true }, schema: { body: { proposalId: 'string', choice: 'string', reason: 'string' } } },
      { method: 'GET', path: '/governance/proposals/{proposalId}/votes', config: { auth: true }, schema: { params: { proposalId: 'string' }, query: { page: 'number', limit: 'number' } } }
    );

    // Limit order routes - Use relative paths (without /api/v1 prefix) since server URLs already include it
    routes.push(
      { method: 'POST', path: '/limit-orders/orders', config: { auth: true }, schema: { body: { tokenIn: 'object', tokenOut: 'object', amountIn: 'string', amountOutMin: 'string', price: 'string', type: 'string', gasPrice: 'string', gasLimit: 'string', slippageTolerance: 'string', expiresAt: 'string' } } },
      { method: 'GET', path: '/limit-orders/orders', config: { auth: true }, schema: { query: { page: 'number', limit: 'number', status: 'string' } } },
      { method: 'GET', path: '/limit-orders/orders/{orderId}', config: { auth: true }, schema: { params: { orderId: 'string' } } },
      { method: 'DELETE', path: '/limit-orders/orders/{orderId}', config: { auth: true }, schema: { params: { orderId: 'string' } } },
      { method: 'GET', path: '/limit-orders/orderbook/{tokenIn}/{tokenOut}', config: { auth: true }, schema: { params: { tokenIn: 'string', tokenOut: 'string' } } }
    );

    // BSC (Binance Smart Chain) routes
    routes.push(
      // BSC Health Check
      { method: 'GET', path: '/bsc/health', config: { auth: false }, schema: {} },

      // BSC Token routes (15 endpoints)
      { method: 'GET', path: '/bsc/tokens', config: { auth: true }, schema: { query: { page: 'number', limit: 'number', search: 'string' } } },
      { method: 'GET', path: '/bsc/tokens/{address}', config: { auth: true }, schema: { params: { address: 'string' } } },
      { method: 'POST', path: '/bsc/tokens/verify', config: { auth: true }, schema: { body: { address: 'string', name: 'string', symbol: 'string', decimals: 'number' } } },
      { method: 'GET', path: '/bsc/tokens/{address}/price', config: { auth: true }, schema: { params: { address: 'string' } } },
      { method: 'GET', path: '/bsc/tokens/{address}/balance', config: { auth: true }, schema: { params: { address: 'string' }, query: { walletAddress: 'string' } } },
      { method: 'GET', path: '/bsc/tokens/popular', config: { auth: true }, schema: { query: { limit: 'number' } } },
      { method: 'GET', path: '/bsc/tokens/trending', config: { auth: true }, schema: { query: { timeFrame: 'string', limit: 'number' } } },
      { method: 'GET', path: '/bsc/tokens/new', config: { auth: true }, schema: { query: { timeFrame: 'string', limit: 'number' } } },
      { method: 'POST', path: '/bsc/tokens/search', config: { auth: true }, schema: { body: { query: 'string', filters: 'object' } } },
      { method: 'GET', path: '/bsc/tokens/{address}/history', config: { auth: true }, schema: { params: { address: 'string' }, query: { period: 'string', interval: 'string' } } },
      { method: 'GET', path: '/bsc/tokens/{address}/holders', config: { auth: true }, schema: { params: { address: 'string' }, query: { page: 'number', limit: 'number' } } },
      { method: 'GET', path: '/bsc/tokens/{address}/analytics', config: { auth: true }, schema: { params: { address: 'string' } } },
      { method: 'POST', path: '/bsc/tokens/track', config: { auth: true }, schema: { body: { addresses: 'array' } } },
      { method: 'DELETE', path: '/bsc/tokens/{address}/track', config: { auth: true }, schema: { params: { address: 'string' } } },
      { method: 'GET', path: '/bsc/tokens/tracked', config: { auth: true }, schema: { query: { page: 'number', limit: 'number' } } },

      // BSC Trading routes (11 endpoints)
      { method: 'POST', path: '/bsc/trading/quote', config: { auth: true }, schema: { body: { tokenIn: 'string', tokenOut: 'string', amountIn: 'string', slippageTolerance: 'string' } } },
      { method: 'POST', path: '/bsc/trading/swap', config: { auth: true }, schema: { body: { tokenIn: 'string', tokenOut: 'string', amountIn: 'string', slippageTolerance: 'string', minimumOutput: 'string' } } },
      { method: 'POST', path: '/bsc/trading/routes', config: { auth: true }, schema: { body: { tokenIn: 'string', tokenOut: 'string', amountIn: 'string', maxHops: 'number' } } },
      { method: 'POST', path: '/bsc/trading/gas-estimate', config: { auth: true }, schema: { body: { transactionType: 'string', params: 'object' } } },
      { method: 'GET', path: '/bsc/trading/pairs', config: { auth: true }, schema: { query: { page: 'number', limit: 'number', token: 'string' } } },
      { method: 'GET', path: '/bsc/trading/pairs/{address}', config: { auth: true }, schema: { params: { address: 'string' } } },
      { method: 'GET', path: '/bsc/trading/history', config: { auth: true }, schema: { query: { walletAddress: 'string', page: 'number', limit: 'number' } } },
      { method: 'POST', path: '/bsc/trading/approve', config: { auth: true }, schema: { body: { token: 'string', spender: 'string', amount: 'string' } } },
      { method: 'GET', path: '/bsc/trading/allowance', config: { auth: true }, schema: { query: { token: 'string', owner: 'string', spender: 'string' } } },
      { method: 'GET', path: '/bsc/trading/impact', config: { auth: true }, schema: { query: { tokenIn: 'string', tokenOut: 'string', amountIn: 'string' } } },
      { method: 'POST', path: '/bsc/trading/batch', config: { auth: true }, schema: { body: { transactions: 'array' } } },

      // BSC Liquidity routes (15 endpoints)
      { method: 'GET', path: '/bsc/liquidity/pools', config: { auth: true }, schema: { query: { page: 'number', limit: 'number', token: 'string' } } },
      { method: 'GET', path: '/bsc/liquidity/pools/{address}', config: { auth: true }, schema: { params: { address: 'string' } } },
      { method: 'POST', path: '/bsc/liquidity/pools', config: { auth: true }, schema: { body: { token0: 'string', token1: 'string', fee: 'string' } } },
      { method: 'POST', path: '/bsc/liquidity/pools/{address}/add', config: { auth: true }, schema: { body: { amount0: 'string', amount1: 'string', slippageTolerance: 'string' } } },
      { method: 'POST', path: '/bsc/liquidity/pools/{address}/remove', config: { auth: true }, schema: { body: { lpTokenAmount: 'string', slippageTolerance: 'string' } } },
      { method: 'GET', path: '/bsc/liquidity/positions', config: { auth: true }, schema: { query: { walletAddress: 'string', page: 'number', limit: 'number' } } },
      { method: 'GET', path: '/bsc/liquidity/positions/{address}', config: { auth: true }, schema: { params: { address: 'string' } } },
      { method: 'GET', path: '/bsc/liquidity/apr', config: { auth: true }, schema: { query: { poolAddress: 'string' } } },
      { method: 'GET', path: '/bsc/liquidity/impermanent-loss', config: { auth: true }, schema: { query: { poolAddress: 'string', amount0: 'string', amount1: 'string' } } },
      { method: 'POST', path: '/bsc/liquidity/estimate/add', config: { auth: true }, schema: { body: { poolAddress: 'string', amount0: 'string', amount1: 'string' } } },
      { method: 'POST', path: '/bsc/liquidity/estimate/remove', config: { auth: true }, schema: { body: { poolAddress: 'string', lpTokenAmount: 'string' } } },
      { method: 'GET', path: '/bsc/liquidity/pools/{address}/fees', config: { auth: true }, schema: { params: { address: 'string' } } },
      { method: 'GET', path: '/bsc/liquidity/pools/{address}/volume', config: { auth: true }, schema: { params: { address: 'string' }, query: { period: 'string' } } },
      { method: 'GET', path: '/bsc/liquidity/top-pools', config: { auth: true }, schema: { query: { sortBy: 'string', limit: 'number' } } },
      { method: 'GET', path: '/bsc/liquidity/pools/{address}/chart', config: { auth: true }, schema: { params: { address: 'string' }, query: { period: 'string', interval: 'string' } } },

      // BSC Portfolio routes (10 endpoints)
      { method: 'GET', path: '/bsc/portfolio/{address}', config: { auth: true }, schema: { params: { address: 'string' } } },
      { method: 'GET', path: '/bsc/portfolio/{address}/assets', config: { auth: true }, schema: { params: { address: 'string' }, query: { page: 'number', limit: 'number' } } },
      { method: 'GET', path: '/bsc/portfolio/{address}/value', config: { auth: true }, schema: { params: { address: 'string' }, query: { currency: 'string' } } },
      { method: 'GET', path: '/bsc/portfolio/{address}/performance', config: { auth: true }, schema: { params: { address: 'string' }, query: { period: 'string' } } },
      { method: 'GET', path: '/bsc/portfolio/{address}/allocation', config: { auth: true }, schema: { params: { address: 'string' } } },
      { method: 'GET', path: '/bsc/portfolio/{address}/history', config: { auth: true }, schema: { params: { address: 'string' }, query: { period: 'string', interval: 'string' } } },
      { method: 'GET', path: '/bsc/portfolio/{address}/pnl', config: { auth: true }, schema: { params: { address: 'string' }, query: { period: 'string' } } },
      { method: 'POST', path: '/bsc/portfolio/compare', config: { auth: true }, schema: { body: { addresses: 'array', period: 'string' } } },
      { method: 'GET', path: '/bsc/portfolio/{address}/recommendations', config: { auth: true }, schema: { params: { address: 'string' } } },
      { method: 'POST', path: '/bsc/portfolio/export', config: { auth: true }, schema: { body: { address: 'string', format: 'string', period: 'string' } } }
    );

    // Health check
    routes.push(
      { method: 'GET', path: '/', config: { auth: false }, schema: {} }
    );

    return routes;
  }

  /**
   * Convert Fastify path to OpenAPI format
   */
  private convertPathToOpenAPI(path: string): string {
    return path.replace(/:([^/]+)/g, '{$1}');
  }

  /**
   * Create OpenAPI operation from route
   */
  private createOperation(route: any): any {
    const pathSegments = route.path.split('/').filter((s: string) => s && !s.startsWith(':'));
    const tag = this.inferTag(pathSegments);

    const operation: any = {
      tags: [tag],
      summary: this.generateSummary(route.method, route.path),
      description: this.generateDescription(route.method, route.path),
      operationId: this.generateOperationId(route.method, route.path),
      parameters: this.extractParameters(route.path),
      responses: this.generateResponses(route.method, route.path)
    };

    // Add request body if applicable
    if (['POST', 'PUT', 'PATCH'].includes(route.method)) {
      operation.requestBody = this.generateRequestBody(route);
    }

    // Add security if auth required
    if (route.config?.auth !== false) {
      operation.security = [{ bearerAuth: [] }];
    }

    return operation;
  }

  /**
   * Infer tag from path
   */
  private inferTag(pathSegments: string[]): string {
    const tagMap: { [key: string]: string } = {
      'auth': 'Authentication',
      'wallets': 'Wallet Management',
      'trading': 'Trading',
      'liquidity': 'Liquidity',
      'yield': 'Yield Farming',
      'governance': 'Governance',
      'limit-orders': 'Limit Orders',
      'bsc': 'BSC (Binance Smart Chain)'
    };

    for (const segment of pathSegments) {
      if (tagMap[segment]) {
        // Add tag to tags list if not exists
        if (!this.tags.find(t => t.name === tagMap[segment])) {
          this.tags.push({
            name: tagMap[segment],
            description: `Operations related to ${segment.toLowerCase()} management`
          });
        }
        return tagMap[segment];
      }
    }

    return 'General';
  }

  /**
   * Generate operation summary
   */
  private generateSummary(method: string, path: string): string {
    const resource = path.split('/').filter(s => s && !s.startsWith(':')).pop() || 'resource';
    const action = this.getActionDescription(method, path);

    return `${action} ${resource.replace(/([A-Z])/g, ' $1').trim()}`;
  }

  /**
   * Get human-readable action description
   */
  private getActionDescription(method: string, path: string): string {
    const actions: { [key: string]: string } = {
      'GET': path.includes('{') ? 'Get' : 'List',
      'POST': 'Create',
      'PUT': 'Update',
      'PATCH': 'Partially update',
      'DELETE': 'Delete'
    };

    return actions[method] || method.toUpperCase();
  }

  /**
   * Generate detailed description
   */
  private generateDescription(method: string, path: string): string {
    const resource = path.split('/').filter(s => s && !s.startsWith(':')).pop() || 'resource';
    const action = this.getActionDescription(method, path);

    let description = `Performs a ${action.toUpperCase()} operation on ${resource}.`;

    if (path.includes('auth')) {
      description += ' This endpoint handles user authentication and authorization.';
    } else if (path.includes('trading')) {
      description += ' This endpoint facilitates token swapping and trading operations.';
    } else if (path.includes('wallet')) {
      description += ' This endpoint manages wallet operations and transactions.';
    }

    return description;
  }

  /**
   * Generate operation ID
   */
  private generateOperationId(method: string, path: string): string {
    const segments = path.split('/').filter(s => s && !s.startsWith(':'));
    const resource = segments.join('_');
    return `${method}_${resource}`.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Extract parameters from path
   */
  private extractParameters(path: string): any[] {
    const parameters: any[] = [];

    // Extract path parameters
    const pathParams = path.match(/:([^/]+)/g);
    if (pathParams) {
      pathParams.forEach(param => {
        const name = param.slice(1);
        parameters.push({
          name,
          in: 'path',
          required: true,
          description: `ID of the ${name}`,
          schema: {
            type: 'string',
            format: name.toLowerCase().includes('id') ? 'uuid' : undefined
          }
        });
      });
    }

    // Add common query parameters for list operations
    if (!path.includes(':')) {
      parameters.push(
        {
          name: 'page',
          in: 'query',
          description: 'Page number for pagination',
          schema: { type: 'integer', default: 1, minimum: 1 }
        },
        {
          name: 'limit',
          in: 'query',
          description: 'Number of items per page',
          schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 }
        }
      );
    }

    return parameters;
  }

  /**
   * Generate request body schema
   */
  private generateRequestBody(route: any): any {
    const body = {
      required: true,
      content: {
        'application/json': {
          schema: this.generateBodySchema(route.path, route.schema?.body || {}),
          examples: this.generateExamples(route.path)
        }
      }
    };

    return body;
  }

  /**
   * Generate body schema
   */
  private generateBodySchema(path: string, schema: any): any {
    if (Object.keys(schema).length > 0) {
      return this.convertToJSONSchema(schema);
    }

    // Generate default schema based on path
    const resource = path.split('/').filter(s => s && !s.startsWith(':')).pop() || 'resource';

    switch (resource) {
      case 'auth':
        return this.getAuthSchema(path);
      case 'wallets':
        return this.getWalletSchema();
      case 'trading':
        return this.getTradingSchema();
      case 'liquidity':
        return this.getLiquiditySchema();
      case 'yield':
        return this.getYieldSchema();
      case 'governance':
        return this.getGovernanceSchema();
      case 'limit-orders':
        return this.getLimitOrderSchema();
      default:
        return { type: 'object', properties: {} };
    }
  }

  /**
   * Get auth schema
   */
  private getAuthSchema(path: string): any {
    if (path.includes('email')) {
      return {
        type: 'object',
        required: ['email'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          code: path.includes('verify') ? {
            type: 'string',
            description: 'Email verification code'
          } : undefined
        }
      };
    } else if (path.includes('social')) {
      return {
        type: 'object',
        required: ['provider', 'accessToken'],
        properties: {
          provider: {
            type: 'string',
            enum: ['google', 'apple', 'twitter', 'facebook'],
            description: 'Social authentication provider'
          },
          accessToken: {
            type: 'string',
            description: 'Access token from the social provider'
          }
        }
      };
    } else if (path.includes('wallet')) {
      return {
        type: 'object',
        required: ['walletAddress', 'signature', 'message'],
        properties: {
          walletAddress: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            description: 'Ethereum wallet address'
          },
          signature: {
            type: 'string',
            description: 'Cryptographic signature'
          },
          message: {
            type: 'string',
            description: 'Signed message'
          }
        }
      };
    } else if (path.includes('refresh')) {
      return {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: {
            type: 'string',
            description: 'JWT refresh token'
          }
        }
      };
    }

    return { type: 'object', properties: {} };
  }

  /**
   * Get wallet schema
   */
  private getWalletSchema(): any {
    return {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Ethereum wallet address'
        },
        to: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Recipient address'
        },
        value: {
          type: 'string',
          description: 'Amount in wei'
        },
        token: {
          type: 'string',
          description: 'Token symbol or address'
        },
        data: {
          type: 'string',
          description: 'Transaction data'
        }
      }
    };
  }

  /**
   * Get trading schema
   */
  private getTradingSchema(): any {
    return {
      type: 'object',
      required: ['tokenIn', 'tokenOut', 'amountIn'],
      properties: {
        tokenIn: {
          $ref: '#/components/schemas/Token'
        },
        tokenOut: {
          $ref: '#/components/schemas/Token'
        },
        amountIn: {
          type: 'string',
          description: 'Input amount in smallest token units'
        },
        slippageTolerance: {
          type: 'string',
          description: 'Maximum acceptable slippage (e.g., "0.5" for 0.5%)',
          default: '0.5'
        },
        minimumOutput: {
          type: 'string',
          description: 'Minimum output amount'
        },
        maxHops: {
          type: 'integer',
          description: 'Maximum number of hops in trading route',
          minimum: 1,
          maximum: 5
        }
      }
    };
  }

  /**
   * Get liquidity schema
   */
  private getLiquiditySchema(): any {
    return {
      type: 'object',
      properties: {
        token0: {
          $ref: '#/components/schemas/Token'
        },
        token1: {
          $ref: '#/components/schemas/Token'
        },
        fee: {
          type: 'string',
          description: 'Pool fee tier'
        },
        amount0: {
          type: 'string',
          description: 'Amount of token0'
        },
        amount1: {
          type: 'string',
          description: 'Amount of token1'
        },
        slippageTolerance: {
          type: 'string',
          description: 'Slippage tolerance percentage'
        }
      }
    };
  }

  /**
   * Get yield farming schema
   */
  private getYieldSchema(): any {
    return {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Farm name'
        },
        description: {
          type: 'string',
          description: 'Farm description'
        },
        poolId: {
          type: 'string',
          description: 'Associated liquidity pool ID'
        },
        rewardToken: {
          $ref: '#/components/schemas/Token'
        },
        rewardRate: {
          type: 'string',
          description: 'Reward rate per block'
        },
        amount: {
          type: 'string',
          description: 'Amount to stake/unstake'
        }
      }
    };
  }

  /**
   * Get governance schema
   */
  private getGovernanceSchema(): any {
    return {
      type: 'object',
      required: ['title', 'description', 'votingPeriod', 'quorum', 'approvalThreshold'],
      properties: {
        title: {
          type: 'string',
          minLength: 1,
          maxLength: 200,
          description: 'Proposal title'
        },
        description: {
          type: 'string',
          description: 'Detailed proposal description'
        },
        votingPeriod: {
          type: 'integer',
          minimum: 1,
          description: 'Voting period in blocks'
        },
        quorum: {
          type: 'string',
          description: 'Minimum participation required'
        },
        approvalThreshold: {
          type: 'string',
          description: 'Approval threshold percentage'
        },
        choice: {
          type: 'string',
          enum: ['for', 'against', 'abstain'],
          description: 'Vote choice'
        },
        reason: {
          type: 'string',
          description: 'Vote reasoning'
        }
      }
    };
  }

  /**
   * Get limit order schema
   */
  private getLimitOrderSchema(): any {
    return {
      type: 'object',
      required: ['tokenIn', 'tokenOut', 'amountIn', 'amountOutMin', 'price', 'type', 'expiresAt'],
      properties: {
        tokenIn: {
          $ref: '#/components/schemas/Token'
        },
        tokenOut: {
          $ref: '#/components/schemas/Token'
        },
        amountIn: {
          type: 'string',
          description: 'Input amount'
        },
        amountOutMin: {
          type: 'string',
          description: 'Minimum output amount'
        },
        price: {
          type: 'string',
          description: 'Limit price'
        },
        type: {
          type: 'string',
          enum: ['buy', 'sell'],
          description: 'Order type'
        },
        gasPrice: {
          type: 'string',
          description: 'Gas price in gwei'
        },
        gasLimit: {
          type: 'string',
          description: 'Gas limit'
        },
        slippageTolerance: {
          type: 'string',
          description: 'Slippage tolerance'
        },
        expiresAt: {
          type: 'string',
          format: 'date-time',
          description: 'Order expiration time'
        }
      }
    };
  }

  /**
   * Generate examples for request body
   */
  private generateExamples(path: string): any {
    const examples: any = {};

    if (path.includes('auth/email')) {
      examples.default = {
        summary: 'Email authentication',
        value: {
          email: 'user@example.com',
          code: path.includes('verify') ? '123456' : undefined
        }
      };
    } else if (path.includes('auth/wallet')) {
      examples.default = {
        summary: 'Wallet authentication',
        value: {
          walletAddress: '0x742d35Cc6634C0532925a3b8D4C7db1c5b0F5a8a',
          signature: '0x...',
          message: 'Sign this message to authenticate'
        }
      };
    } else if (path.includes('trading')) {
      examples.default = {
        summary: 'Token swap',
        value: {
          tokenIn: {
            address: '0xA0b86a33E6441b8e8C7C7b0b8e8e8e8e8e8e8e8e',
            symbol: 'USDC',
            decimals: 6
          },
          tokenOut: {
            address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            symbol: 'DAI',
            decimals: 18
          },
          amountIn: '1000000',
          slippageTolerance: '0.5'
        }
      };
    }

    return examples;
  }

  /**
   * Generate response schemas
   */
  private generateResponses(method: string, path: string): any {
    const responses: any = {
      '200': {
        description: 'Successful operation',
        content: {
          'application/json': {
            schema: this.generateResponseSchema(method, path)
          }
        }
      },
      '400': { $ref: '#/components/responses/ErrorResponse' },
      '401': { $ref: '#/components/responses/ErrorResponse' },
      '404': { $ref: '#/components/responses/ErrorResponse' },
      '422': { $ref: '#/components/responses/ValidationError' },
      '500': { $ref: '#/components/responses/ErrorResponse' }
    };

    // Customize based on method
    if (method === 'POST' && !path.includes('auth')) {
      responses['201'] = responses['200'];
      responses['201'].description = 'Resource created successfully';
      delete responses['200'];
    } else if (method === 'DELETE') {
      responses['204'] = {
        description: 'Resource deleted successfully'
      };
      delete responses['200'];
    }

    return responses;
  }

  /**
   * Generate response schema
   */
  private generateResponseSchema(method: string, path: string): any {
    if (path.includes('{') && method === 'GET') {
      // Single resource response
      return {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: this.getResourceDataSchema(path),
          message: { type: 'string' }
        }
      };
    } else if (!path.includes('{') && method === 'GET') {
      // List response
      return {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: this.getResourceDataSchema(path)
          },
          pagination: { $ref: '#/components/schemas/Pagination' },
          message: { type: 'string' }
        }
      };
    } else {
      // Operation response
      return {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
          message: { type: 'string' }
        }
      };
    }
  }

  /**
   * Get resource data schema
   */
  private getResourceDataSchema(path: string): any {
    if (path.includes('auth')) {
      return { $ref: '#/components/schemas/User' };
    } else if (path.includes('wallets')) {
      return { $ref: '#/components/schemas/Wallet' };
    } else if (path.includes('trading')) {
      return { $ref: '#/components/schemas/Trade' };
    } else if (path.includes('liquidity')) {
      return { $ref: '#/components/schemas/LiquidityPool' };
    } else if (path.includes('yield')) {
      return { $ref: '#/components/schemas/Farm' };
    } else if (path.includes('governance')) {
      return { $ref: '#/components/schemas/Proposal' };
    } else if (path.includes('limit-orders')) {
      return { $ref: '#/components/schemas/LimitOrder' };
    }

    return { type: 'object' };
  }

  /**
   * Add common schemas
   */
  private addCommonSchemas(): void {
    this.schemas = {
      ...this.schemas,
      Token: {
        type: 'object',
        required: ['address', 'symbol', 'decimals'],
        properties: {
          address: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            description: 'Token contract address'
          },
          symbol: {
            type: 'string',
            minLength: 1,
            maxLength: 10,
            description: 'Token symbol'
          },
          decimals: {
            type: 'integer',
            minimum: 0,
            maximum: 18,
            description: 'Number of decimal places'
          }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'User unique identifier'
          },
          privyUserId: {
            type: 'string',
            description: 'Privy user ID'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          name: {
            type: 'string',
            description: 'User display name'
          },
          avatar: {
            type: 'string',
            description: 'User avatar URL'
          },
          walletAddress: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            description: 'Primary wallet address'
          },
          linkedAccounts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                address: { type: 'string' }
              }
            },
            description: 'Linked social accounts'
          }
        }
      },
      Wallet: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            description: 'Wallet address'
          },
          userId: {
            type: 'string',
            format: 'uuid',
            description: 'Owner user ID'
          },
          type: {
            type: 'string',
            enum: ['embedded', 'external'],
            description: 'Wallet type'
          },
          balances: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                token: { $ref: '#/components/schemas/Token' },
                balance: { type: 'string' },
                usdValue: { type: 'string' }
              }
            },
            description: 'Token balances'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Wallet creation timestamp'
          }
        }
      },
      Trade: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Trade unique identifier'
          },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              walletAddress: { type: 'string' }
            }
          },
          tokenIn: { $ref: '#/components/schemas/Token' },
          tokenOut: { $ref: '#/components/schemas/Token' },
          amountIn: { type: 'string' },
          amountOut: { type: 'string' },
          price: { type: 'string' },
          transactionHash: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{64}$',
            description: 'Transaction hash'
          },
          status: {
            type: 'string',
            enum: ['pending', 'completed', 'failed'],
            description: 'Trade status'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Trade creation timestamp'
          }
        }
      },
      LiquidityPool: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Pool unique identifier'
          },
          token0: { $ref: '#/components/schemas/Token' },
          token1: { $ref: '#/components/schemas/Token' },
          fee: {
            type: 'string',
            description: 'Pool fee tier'
          },
          reserve0: { type: 'string' },
          reserve1: { type: 'string' },
          totalSupply: { type: 'string' },
          apr: {
            type: 'string',
            description: 'Annual percentage rate'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      Farm: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Farm unique identifier'
          },
          name: {
            type: 'string',
            description: 'Farm name'
          },
          description: {
            type: 'string',
            description: 'Farm description'
          },
          poolId: {
            type: 'string',
            description: 'Associated pool ID'
          },
          rewardToken: { $ref: '#/components/schemas/Token' },
          rewardRate: { type: 'string' },
          totalRewards: { type: 'string' },
          stakedAmount: { type: 'string' },
          userStake: {
            type: 'object',
            properties: {
              amount: { type: 'string' },
              pendingRewards: { type: 'string' }
            }
          },
          status: {
            type: 'string',
            enum: ['active', 'ended', 'paused']
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
      },
      Proposal: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Proposal unique identifier'
          },
          title: {
            type: 'string',
            description: 'Proposal title'
          },
          description: {
            type: 'string',
            description: 'Proposal description'
          },
          proposer: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              walletAddress: { type: 'string' }
            }
          },
          votingPeriod: {
            type: 'integer',
            description: 'Voting period in blocks'
          },
          quorum: {
            type: 'string',
            description: 'Required quorum'
          },
          approvalThreshold: {
            type: 'string',
            description: 'Approval threshold'
          },
          votes: {
            type: 'object',
            properties: {
              for: { type: 'string' },
              against: { type: 'string' },
              abstain: { type: 'string' }
            }
          },
          status: {
            type: 'string',
            enum: ['active', 'passed', 'rejected', 'executed']
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          endsAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      LimitOrder: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Order unique identifier'
          },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              walletAddress: { type: 'string' }
            }
          },
          tokenIn: { $ref: '#/components/schemas/Token' },
          tokenOut: { $ref: '#/components/schemas/Token' },
          amountIn: { type: 'string' },
          amountOutMin: { type: 'string' },
          price: { type: 'string' },
          type: {
            type: 'string',
            enum: ['buy', 'sell']
          },
          filledAmount: { type: 'string' },
          remainingAmount: { type: 'string' },
          status: {
            type: 'string',
            enum: ['active', 'filled', 'cancelled', 'expired']
          },
          expiresAt: {
            type: 'string',
            format: 'date-time'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          total: { type: 'integer', minimum: 0 },
          pages: { type: 'integer', minimum: 0 }
        }
      },
      Error: {
        type: 'object',
        required: ['success', 'error'],
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'string',
            description: 'Error message'
          },
          code: {
            type: 'string',
            description: 'Error code'
          },
          details: {
            type: 'object',
            additionalProperties: true,
            description: 'Additional error details'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Error timestamp'
          }
        }
      },
      // BSC-specific schemas
      BSCToken: {
        type: 'object',
        required: ['address', 'symbol', 'decimals'],
        properties: {
          address: {
            type: 'string',
            pattern: '^0x[a-fA-F0-9]{40}$',
            description: 'BSC token contract address'
          },
          symbol: {
            type: 'string',
            description: 'Token symbol'
          },
          name: {
            type: 'string',
            description: 'Token name'
          },
          decimals: {
            type: 'integer',
            description: 'Number of decimal places'
          },
          totalSupply: {
            type: 'string',
            description: 'Total token supply'
          },
          priceUSD: {
            type: 'string',
            description: 'Current price in USD'
          },
          marketCapUSD: {
            type: 'string',
            description: 'Market capitalization in USD'
          },
          liquidityUSD: {
            type: 'string',
            description: 'Total liquidity in USD'
          },
          volume24hUSD: {
            type: 'string',
            description: '24 hour trading volume in USD'
          },
          priceChange24h: {
            type: 'string',
            description: '24 hour price change percentage'
          }
        }
      },
      BSCTradingPair: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Pair contract address'
          },
          token0: { $ref: '#/components/schemas/BSCToken' },
          token1: { $ref: '#/components/schemas/BSCToken' },
          reserve0: {
            type: 'string',
            description: 'Token0 reserve amount'
          },
          reserve1: {
            type: 'string',
            description: 'Token1 reserve amount'
          },
          totalSupply: {
            type: 'string',
            description: 'LP tokens total supply'
          },
          apr: {
            type: 'string',
            description: 'Annual percentage rate'
          },
          volume24h: {
            type: 'string',
            description: '24 hour volume'
          },
          fees24h: {
            type: 'string',
            description: '24 hour fees'
          }
        }
      },
      BSCLiquidityPosition: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Position unique identifier'
          },
          pool: { $ref: '#/components/schemas/BSCTradingPair' },
          user: {
            type: 'string',
            description: 'User wallet address'
          },
          amount0: {
            type: 'string',
            description: 'Token0 amount in position'
          },
          amount1: {
            type: 'string',
            description: 'Token1 amount in position'
          },
          lpTokens: {
            type: 'string',
            description: 'LP token amount'
          },
          valueUSD: {
            type: 'string',
            description: 'Position value in USD'
          },
          impermanentLoss: {
            type: 'string',
            description: 'Impermanent loss percentage'
          },
          feesEarned: {
            type: 'string',
            description: 'Fees earned'
          }
        }
      },
      BSCPortfolio: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Portfolio wallet address'
          },
          totalValueUSD: {
            type: 'string',
            description: 'Total portfolio value in USD'
          },
          assets: {
            type: 'array',
            items: { $ref: '#/components/schemas/BSCToken' },
            description: 'Portfolio assets'
          },
          liquidityPositions: {
            type: 'array',
            items: { $ref: '#/components/schemas/BSCLiquidityPosition' },
            description: 'Liquidity positions'
          },
          performance24h: {
            type: 'string',
            description: '24 hour performance percentage'
          },
          performance7d: {
            type: 'string',
            description: '7 day performance percentage'
          },
          performance30d: {
            type: 'string',
            description: '30 day performance percentage'
          }
        }
      }
    };
  }

  /**
   * Convert Fastify schema to JSON Schema
   */
  private convertToJSONSchema(schema: any): any {
    // This is a simplified conversion - in production you'd use a proper schema converter
    return {
      type: schema.type || 'object',
      properties: schema.properties || {},
      required: schema.required || []
    };
  }

  /**
   * Export documentation to various formats
   */
  async exportDocumentation(outputDir?: string): Promise<void> {
    const spec = await this.generateSpec();
    const outputPath = outputDir || this.config.outputPath || './api-docs';

    // Create output directory
    await fs.mkdir(outputPath, { recursive: true });
    await fs.mkdir(path.join(outputPath, 'collections'), { recursive: true });

    // Save OpenAPI spec in YAML and JSON
    await fs.writeFile(
      path.join(outputPath, 'openapi.yaml'),
      yaml.dump(spec, { indent: 2 })
    );

    await fs.writeFile(
      path.join(outputPath, 'openapi.json'),
      JSON.stringify(spec, null, 2)
    );

    // Generate Postman collection
    const postmanCollection = this.convertToPostmanCollection(spec);
    await fs.writeFile(
      path.join(outputPath, 'collections', 'postman_collection.json'),
      JSON.stringify(postmanCollection, null, 2)
    );

    // Generate HTML documentation
    await this.generateHTMLDocs(spec, outputPath);

    // Generate README
    await this.generateREADME(spec, outputPath);

    console.log(`API documentation generated in ${outputPath}`);
  }

  /**
   * Convert OpenAPI to Postman Collection
   */
  private convertToPostmanCollection(openApiSpec: any): any {
    const collection: any = {
      info: {
        name: openApiSpec.info.title,
        description: openApiSpec.info.description,
        version: openApiSpec.info.version,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      item: [] as any[],
      auth: {
        type: 'bearer',
        bearer: [{
          key: 'token',
          value: '{{access_token}}',
          type: 'string'
        }]
      },
      variable: [
        {
          key: 'baseUrl',
          value: openApiSpec.servers[0].url,
          type: 'string'
        },
        {
          key: 'access_token',
          value: '',
          type: 'string'
        }
      ]
    };

    // Group by tags
    const folders: { [key: string]: any } = {};

    Object.entries(openApiSpec.paths).forEach(([path, methods]: [string, any]) => {
      Object.entries(methods).forEach(([method, operation]: [string, any]) => {
        const tag = operation.tags?.[0] || 'General';

        if (!folders[tag]) {
          folders[tag] = {
            name: tag,
            item: [] as any[]
          };
        }

        const request: any = {
          name: operation.summary,
          request: {
            method: method.toUpperCase(),
            header: [] as any[],
            url: {
              raw: `{{baseUrl}}${path}`,
              host: ['{{baseUrl}}'],
              path: path.split('/').filter(p => p)
            },
            description: operation.description
          }
        };

        // Add path parameters
        if (operation.parameters) {
          const pathParams = operation.parameters.filter((p: any) => p.in === 'path');
          const queryParams = operation.parameters.filter((p: any) => p.in === 'query');

          if (pathParams.length > 0) {
            (request.request.url as any).variable = pathParams.map((p: any) => ({
              key: p.name,
              value: '',
              description: p.description
            }));
          }

          if (queryParams.length > 0) {
            (request.request.url as any).query = queryParams.map((p: any) => ({
              key: p.name,
              value: '',
              description: p.description,
              disabled: !p.required
            }));
          }
        }

        // Add request body
        if (operation.requestBody) {
          const content = operation.requestBody.content['application/json'];
          if (content) {
            request.request.header.push({
              key: 'Content-Type',
              value: 'application/json'
            });

            (request.request as any).body = {
              mode: 'raw',
              raw: JSON.stringify(
                content.examples?.default?.value || {},
                null,
                2
              )
            };
          }
        }

        // Add auth if required
        if (operation.security) {
          (request.request as any).auth = {
            type: 'bearer',
            bearer: [{
              key: 'token',
              value: '{{access_token}}'
            }]
          };
        }

        folders[tag].item.push(request);
      });
    });

    collection.item = Object.values(folders);
    return collection;
  }

  /**
   * Generate HTML documentation
   */
  private async generateHTMLDocs(spec: any, outputDir: string): Promise<void> {
    // Swagger UI HTML
    const swaggerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${spec.info.title} - Swagger UI</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui.css">
    <style>
      body { margin: 0; padding: 0; }
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 50px 0; }
      .swagger-ui .scheme-container { margin: 50px 0; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: './openapi.json',
          dom_id: '#swagger-ui',
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
          ],
          layout: "BaseLayout",
          deepLinking: true,
          showExtensions: true,
          showCommonExtensions: true,
          tryItOutEnabled: true
        });
      };
    </script>
</body>
</html>`;

    // ReDoc HTML
    const redocHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${spec.info.title} - ReDoc</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { margin: 0; padding: 0; }
      redoc { min-height: 100vh; }
    </style>
</head>
<body>
    <redoc spec-url='./openapi.json'></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@2.0.0/bundles/redoc.standalone.js"></script>
</body>
</html>`;

    await fs.writeFile(path.join(outputDir, 'index.html'), swaggerHtml);
    await fs.writeFile(path.join(outputDir, 'redoc.html'), redocHtml);
  }

  /**
   * Generate README documentation
   */
  private async generateREADME(spec: any, outputDir: string): Promise<void> {
    // Generate endpoint lists
    const authEndpoints = this.generateEndpointList(spec.paths, '/auth');
    const walletEndpoints = this.generateEndpointList(spec.paths, '/wallets');
    const tradingEndpoints = this.generateEndpointList(spec.paths, '/trading');
    const liquidityEndpoints = this.generateEndpointList(spec.paths, '/liquidity');
    const yieldEndpoints = this.generateEndpointList(spec.paths, '/yield');
    const governanceEndpoints = this.generateEndpointList(spec.paths, '/governance');
    const limitOrderEndpoints = this.generateEndpointList(spec.paths, '/limit-orders');

    const readme = `# ${spec.info.title}

${spec.info.description}

**Version:** ${spec.info.version}

## 🚀 Features

- **Multi-chain Wallet Management**: Create and manage embedded wallets
- **Token Trading**: Swap tokens with best route finding
- **Liquidity Provision**: Add and remove liquidity from pools
- **Yield Farming**: Stake tokens and earn rewards
- **Governance**: Participate in protocol governance
- **Limit Orders**: Create and manage limit orders
- **Authentication**: Multiple auth methods (email, social, wallet)

## 📋 Table of Contents

- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [SDKs and Tools](#sdks-and-tools)
- [Support](#support)

## 🔐 Authentication

This API uses JWT Bearer tokens for authentication. Include the token in the Authorization header:

\`\`\`http
Authorization: Bearer <your-jwt-token>
\`\`\`

### Authentication Methods

1. **Email Authentication**
   - Send code to email: \`POST /auth/email\`
   - Verify code: \`POST /auth/email/verify\`

2. **Social Authentication**
   - Authenticate with provider: \`POST /auth/social\`
   - Supported providers: \`google\`, \`apple\`, \`twitter\`, \`facebook\`

3. **Wallet Authentication**
   - Sign message with wallet: \`POST /auth/wallet\`

4. **Token Refresh**
   - Refresh access token: \`POST /auth/refresh\`

## 🛠 API Endpoints

### Authentication
${authEndpoints}

### Wallet Management
${walletEndpoints}

### Trading
${tradingEndpoints}

### Liquidity
${liquidityEndpoints}

### Yield Farming
${yieldEndpoints}

### Governance
${governanceEndpoints}

### Limit Orders
${limitOrderEndpoints}

## 📊 Response Format

All API responses follow a consistent format:

\`\`\`json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
\`\`\`

### Error Response Format

\`\`\`json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
\`\`\`

## 🚦 Error Handling

| Status Code | Description | Example |
|-------------|-------------|---------|
| 200 | Success | Operation completed successfully |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication required |
| 404 | Not Found | Resource not found |
| 422 | Validation Error | Request validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error occurred |

## ⚡ Rate Limiting

The API implements rate limiting to ensure fair usage:

- **Authentication endpoints**: 5 requests per minute
- **Trading endpoints**: 60 requests per minute
- **General API endpoints**: 100 requests per minute

Rate limit headers are included in responses:
- \`X-RateLimit-Limit\`: Request limit per window
- \`X-RateLimit-Remaining\`: Remaining requests
- \`X-RateLimit-Reset\`: Time when limit resets

## 🛠 SDKs and Tools

### JavaScript/TypeScript

\`\`\`bash
npm install @moonex/sdk
\`\`\`

\`\`\`javascript
import { MoonExAPI } from '@moonex/sdk';

const api = new MoonExAPI({
  baseURL: 'https://api.moonex.io/v1',
  apiKey: 'your-api-key'
});

// Get wallet balance
const balance = await api.wallets.getBalance(walletAddress);
\`\`\`

### Python

\`\`\`bash
pip install moonex-sdk
\`\`\`

\`\`\`python
from moonex import MoonExAPI

api = MoonExAPI(
    base_url='https://api.moonex.io/v1',
    api_key='your-api-key'
)

# Get wallet balance
balance = api.wallets.get_balance(wallet_address)
\`\`\`

## 📚 Documentation

- **[Interactive Swagger UI](./index.html)** - Try out API endpoints
- **[ReDoc Documentation](./redoc.html)** - Alternative documentation format
- **[OpenAPI Specification](./openapi.json)** - Raw API specification
- **[Postman Collection](./collections/postman_collection.json)** - Import to Postman

## 🤝 Support

For support, please contact:

- **Email**: ${spec.info.contact?.email || 'support@moonex.io'}
- **Documentation**: ${spec.info.contact?.url || 'https://docs.moonex.io'}
- **Issues**: [GitHub Issues](https://github.com/moonex/api/issues)

## 📄 License

${spec.info.license?.name || 'MIT License'}

---

**Last Updated**: ${new Date().toISOString().split('T')[0]}
`;

    await fs.writeFile(path.join(outputDir, 'README.md'), readme);
  }

  /**
   * Generate endpoint list for README
   */
  private generateEndpointList(paths: any, pathFilter: string): string {
    return Object.entries(paths)
      .filter(([path]) => path.includes(pathFilter))
      .map(([path, methods]) =>
        Object.entries(methods as any)
          .map(([method, op]: [string, any]) =>
            `- \`${method.toUpperCase()} ${path}\` - ${op.summary}`
          ).join('\n')
      ).join('\n');
  }
}

export default OpenAPIGenerator;