#!/usr/bin/env node

/**
 * Simple API Documentation Generator
 * Generates comprehensive OpenAPI 3.0 documentation for BSC DEX integration
 */

const { writeFileSync, mkdirSync, existsSync } = require('fs');
const { join } = require('path');
const yaml = require('js-yaml');

// Configuration
const config = {
  title: 'BSC DEX Integration API',
  version: '2.0.0',
  description: 'Comprehensive BSC DEX integration platform with PancakeSwap support, token trading, liquidity management, yield farming, and portfolio analytics',
  servers: [
    {
      url: 'https://api.bsc-dex.com/v1',
      description: 'Production Server'
    },
    {
      url: 'https://staging-api.bsc-dex.com/v1',
      description: 'Staging Server'
    },
    {
      url: 'http://localhost:3000/v1',
      description: 'Development Server'
    }
  ],
  contact: {
    name: 'BSC DEX API Support',
    email: 'api-support@bsc-dex.com',
    url: 'https://docs.bsc-dex.com'
  },
  license: {
    name: 'MIT',
    url: 'https://opensource.org/licenses/MIT'
  },
  outputDir: './docs/api',
  includeExamples: true,
  generatePostmanCollection: true
};

/**
 * Generate comprehensive OpenAPI specification
 */
function generateOpenAPISpec() {
  const spec = {
    openapi: '3.0.3',
    info: {
      title: config.title,
      version: config.version,
      description: config.description,
      contact: config.contact,
      license: config.license,
      termsOfService: 'https://bsc-dex.com/terms',
      x_logo: {
        url: 'https://bsc-dex.com/logo.png',
        backgroundColor: '#FFFFFF',
        altText: 'BSC DEX Integration API'
      }
    },
    servers: config.servers,
    tags: [
      {
        name: 'bsc',
        description: 'BSC (Binance Smart Chain) operations and utilities'
      },
      {
        name: 'tokens',
        description: 'Token discovery, verification, and pricing',
        externalDocs: {
          description: 'Token API Documentation',
          url: 'https://docs.bsc-dex.com/tokens'
        }
      },
      {
        name: 'trading',
        description: 'Token swapping, routing, and trade execution',
        externalDocs: {
          description: 'Trading API Documentation',
          url: 'https://docs.bsc-dex.com/trading'
        }
      },
      {
        name: 'liquidity',
        description: 'Liquidity pool management and operations',
        externalDocs: {
          description: 'Liquidity API Documentation',
          url: 'https://docs.bsc-dex.com/liquidity'
        }
      },
      {
        name: 'yield',
        description: 'Yield farming and staking operations',
        externalDocs: {
          description: 'Yield Farming Documentation',
          url: 'https://docs.bsc-dex.com/yield'
        }
      },
      {
        name: 'portfolio',
        description: 'Portfolio management and analytics',
        externalDocs: {
          description: 'Portfolio API Documentation',
          url: 'https://docs.bsc-dex.com/portfolio'
        }
      },
      {
        name: 'health',
        description: 'Health checks and service monitoring'
      }
    ],
    paths: generateAPIPaths(),
    components: {
      schemas: generateSchemas(),
      responses: generateResponses(),
      parameters: generateParameters(),
      examples: generateExamples(),
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer token for authentication'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for alternative authentication'
        }
      }
    },
    security: [{ bearerAuth: [] }],
    externalDocs: {
      description: 'Complete BSC DEX documentation',
      url: 'https://docs.bsc-dex.com'
    }
  };

  return spec;
}

/**
 * Generate API paths
 */
function generateAPIPaths() {
  return {
    '/bsc/health': {
      get: {
        tags: ['health', 'bsc'],
        summary: 'BSC services health check',
        description: 'Check the health status of all BSC-related services',
        operationId: 'bscHealthCheck',
        responses: {
          '200': {
            description: 'Health check completed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        status: {
                          type: 'string',
                          enum: ['healthy', 'unhealthy', 'degraded']
                        },
                        services: {
                          type: 'object',
                          properties: {
                            tokenService: { type: 'boolean' },
                            priceTracker: { type: 'boolean' },
                            verificationService: { type: 'boolean' },
                            tradingService: { type: 'boolean' }
                          }
                        },
                        timestamp: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                },
                examples: {
                  healthy: {
                    summary: 'All services healthy',
                    value: {
                      success: true,
                      data: {
                        status: 'healthy',
                        services: {
                          tokenService: true,
                          priceTracker: true,
                          verificationService: true,
                          tradingService: true
                        },
                        timestamp: '2024-01-15T10:30:00Z'
                      }
                    }
                  }
                }
              }
            }
          },
          '503': { $ref: '#/components/responses/ServiceUnavailable' }
        }
      }
    },
    '/bsc/tokens': {
      get: {
        tags: ['tokens', 'bsc'],
        summary: 'List BSC tokens',
        description: 'Retrieve a comprehensive list of BSC tokens with filtering and sorting capabilities',
        operationId: 'listBSCTokens',
        parameters: [
          {
            name: 'search',
            in: 'query',
            description: 'Search tokens by name, symbol, or address',
            required: false,
            schema: { type: 'string', minLength: 1, maxLength: 100 }
          },
          {
            name: 'category',
            in: 'query',
            description: 'Filter tokens by category',
            required: false,
            schema: {
              type: 'string',
              enum: ['currency', 'defi', 'gaming', 'nft', 'meme', 'stablecoin', 'governance', 'yield', 'bridge', 'layer2', 'exchange', 'lending', 'insurance', 'oracle', 'storage', 'other']
            }
          },
          {
            name: 'riskLevel',
            in: 'query',
            description: 'Filter tokens by risk level',
            required: false,
            schema: {
              type: 'string',
              enum: ['very_low', 'low', 'medium', 'high', 'very_high']
            }
          },
          {
            name: 'minLiquidityUSD',
            in: 'query',
            description: 'Minimum liquidity in USD',
            required: false,
            schema: { type: 'number', minimum: 0 }
          },
          {
            name: 'minVolume24h',
            in: 'query',
            description: 'Minimum 24h volume in USD',
            required: false,
            schema: { type: 'number', minimum: 0 }
          },
          {
            name: 'verified',
            in: 'query',
            description: 'Filter by verification status',
            required: false,
            schema: { type: 'boolean' }
          },
          {
            name: 'sortBy',
            in: 'query',
            description: 'Sort field',
            required: false,
            schema: {
              type: 'string',
              enum: ['name', 'symbol', 'priceUSD', 'marketCap', 'volume24hUSD', 'liquidityUSD', 'priceChange24h', 'createdAt', 'discoveredAt'],
              default: 'liquidityUSD'
            }
          },
          {
            name: 'sortOrder',
            in: 'query',
            description: 'Sort order',
            required: false,
            schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Number of items to return',
            required: false,
            schema: { type: 'number', minimum: 1, maximum: 1000, default: 100 }
          },
          {
            name: 'offset',
            in: 'query',
            description: 'Number of items to skip',
            required: false,
            schema: { type: 'number', minimum: 0, default: 0 }
          }
        ],
        responses: {
          '200': {
            description: 'Tokens retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TokenListResponse' },
                examples: {
                  default: {
                    summary: 'Example token list',
                    value: {
                      success: true,
                      data: {
                        tokens: [
                          {
                            address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
                            name: 'PancakeSwap Token',
                            symbol: 'CAKE',
                            decimals: 18,
                            verificationStatus: 'verified',
                            riskLevel: 'low',
                            priceUSD: 2.45,
                            priceBNB: 0.0087,
                            marketCap: 856234567,
                            volume24hUSD: 12345678,
                            liquidityUSD: 45678901,
                            priceChange24h: 0.0523,
                            category: 'defi',
                            tags: ['defi', 'dex', 'governance']
                          }
                        ],
                        pagination: {
                          total: 1250,
                          limit: 100,
                          offset: 0,
                          pages: 13
                        },
                        summary: {
                          totalTokens: 1250,
                          verifiedTokens: 890,
                          averageRiskLevel: 'medium',
                          totalMarketCap: 12500000000
                        }
                      }
                    }
                  }
                }
              }
            },
            x_codeSamples: [
              {
                lang: 'Shell',
                source: `curl -X GET "${config.servers[0].url}/bsc/tokens?limit=10&verified=true&sortBy=marketCap" \\
  -H "Authorization: Bearer YOUR_TOKEN"`,
                label: 'cURL'
              },
              {
                lang: 'JavaScript',
                source: `const axios = require('axios');

const response = await axios.get('${config.servers[0].url}/bsc/tokens', {
  params: {
    limit: 10,
    verified: true,
    sortBy: 'marketCap'
  },
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});

console.log(response.data);`,
                label: 'Node.js'
              }
            ]
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/bsc/tokens/{address}': {
      get: {
        tags: ['tokens', 'bsc'],
        summary: 'Get BSC token details',
        description: 'Retrieve detailed information about a specific BSC token',
        operationId: 'getBSCToken',
        parameters: [
          {
            name: 'address',
            in: 'path',
            description: 'Token contract address',
            required: true,
            schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
          }
        ],
        responses: {
          '200': {
            description: 'Token details retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TokenDetailsResponse' }
              }
            }
          },
          '404': { $ref: '#/components/responses/NotFound' },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/bsc/tokens/search': {
      get: {
        tags: ['tokens', 'bsc'],
        summary: 'Search BSC tokens',
        description: 'Search for tokens by name, symbol, or partial address',
        operationId: 'searchBSCTokens',
        parameters: [
          {
            name: 'q',
            in: 'query',
            description: 'Search query',
            required: true,
            schema: { type: 'string', minLength: 1, maxLength: 100 }
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Number of results to return',
            required: false,
            schema: { type: 'number', minimum: 1, maximum: 50, default: 20 }
          }
        ],
        responses: {
          '200': {
            description: 'Search results retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SearchResponse' }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/bsc/tokens/verify': {
      post: {
        tags: ['tokens', 'bsc'],
        summary: 'Verify BSC token',
        description: 'Submit a token contract for security verification and analysis',
        operationId: 'verifyBSCToken',
        requestBody: {
          description: 'Token verification request',
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TokenVerificationRequest' }
            }
          }
        },
        responses: {
          '202': {
            description: 'Token verification initiated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TokenVerificationResponse' }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '409': {
            description: 'Token already verified',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/bsc/trading/quote': {
      post: {
        tags: ['trading', 'bsc'],
        summary: 'Get swap quote',
        description: 'Get a detailed quote for token swap including optimal routing, gas estimation, and price impact analysis',
        operationId: 'getSwapQuote',
        requestBody: {
          description: 'Swap quote request',
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SwapQuoteRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Swap quote generated successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SwapQuoteResponse' },
                examples: {
                  default: {
                    summary: 'Example swap quote',
                    value: {
                      success: true,
                      data: {
                        quoteId: 'quote_abc123',
                        tokenIn: {
                          address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
                          symbol: 'WBNB',
                          decimals: 18
                        },
                        tokenOut: {
                          address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
                          symbol: 'CAKE',
                          decimals: 18
                        },
                        amountIn: '1000000000000000000',
                        amountOut: '408163265306122448',
                        priceImpact: 0.0234,
                        slippageTolerance: 0.01,
                        minimumAmountOut: '404081632653061224'
                      }
                    }
                  }
                }
              }
            },
            x_codeSamples: [
              {
                lang: 'Shell',
                source: `curl -X POST "${config.servers[0].url}/bsc/trading/quote" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "tokenIn": "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
    "tokenOut": "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
    "amountIn": "1000000000000000000",
    "slippageTolerance": 1
  }'`,
                label: 'cURL'
              },
              {
                lang: 'JavaScript',
                source: `const response = await axios.post('${config.servers[0].url}/bsc/trading/quote', {
  tokenIn: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
  tokenOut: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
  amountIn: '1000000000000000000',
  slippageTolerance: 1
}, {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});`,
                label: 'Node.js'
              }
            ]
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/bsc/trading/swap': {
      post: {
        tags: ['trading', 'bsc'],
        summary: 'Execute token swap',
        description: 'Execute a token swap using the provided quote with MEV protection and gas optimization',
        operationId: 'executeSwap',
        requestBody: {
          description: 'Swap execution request',
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SwapExecutionRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Swap executed successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SwapExecutionResponse' }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '409': {
            description: 'Quote expired or invalid',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          '422': { $ref: '#/components/responses/UnprocessableEntity' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/bsc/trading/routes': {
      post: {
        tags: ['trading', 'bsc'],
        summary: 'Find optimal trading routes',
        description: 'Find optimal trading routes between tokens with detailed path analysis',
        operationId: 'findOptimalRoutes',
        requestBody: {
          description: 'Route finding request',
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RouteFindingRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Routes found successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RouteFindingResponse' }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': {
            description: 'No routes found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/bsc/liquidity/pools': {
      get: {
        tags: ['liquidity', 'bsc'],
        summary: 'List liquidity pools',
        description: 'List available liquidity pools with filtering and sorting options',
        operationId: 'listLiquidityPools',
        parameters: [
          {
            name: 'token0',
            in: 'query',
            description: 'Filter by first token address',
            required: false,
            schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
          },
          {
            name: 'token1',
            in: 'query',
            description: 'Filter by second token address',
            required: false,
            schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
          },
          {
            name: 'protocol',
            in: 'query',
            description: 'Filter by protocol',
            required: false,
            schema: {
              type: 'string',
              enum: ['pancakeswap-v2', 'pancakeswap-v3', 'uniswap-v2', 'uniswap-v3']
            }
          },
          {
            name: 'feeTier',
            in: 'query',
            description: 'Filter by fee tier (V3 only)',
            required: false,
            schema: {
              type: 'string',
              enum: ['100', '500', '2500', '10000']
            }
          },
          {
            name: 'minTVL',
            in: 'query',
            description: 'Minimum TVL in USD',
            required: false,
            schema: { type: 'number', minimum: 0 }
          },
          {
            name: 'sortBy',
            in: 'query',
            description: 'Sort field',
            required: false,
            schema: {
              type: 'string',
              enum: ['tvl', 'volume24h', 'apr', 'fee', 'createdAt'],
              default: 'tvl'
            }
          },
          {
            name: 'sortOrder',
            in: 'query',
            description: 'Sort order',
            required: false,
            schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Number of pools to return',
            required: false,
            schema: { type: 'number', minimum: 1, maximum: 100, default: 50 }
          }
        ],
        responses: {
          '200': {
            description: 'Liquidity pools retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LiquidityPoolsResponse' }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/bsc/liquidity/quote/add': {
      post: {
        tags: ['liquidity', 'bsc'],
        summary: 'Get add liquidity quote',
        description: 'Get a quote for adding liquidity to a pool',
        operationId: 'getAddLiquidityQuote',
        requestBody: {
          description: 'Add liquidity quote request',
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AddLiquidityRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Add liquidity quote generated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AddLiquidityResponse' }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/bsc/yield/farms': {
      get: {
        tags: ['yield', 'bsc'],
        summary: 'List yield farms',
        description: 'List available yield farming opportunities with detailed metrics',
        operationId: 'listYieldFarms',
        parameters: [
          {
            name: 'protocol',
            in: 'query',
            description: 'Filter by protocol',
            required: false,
            schema: {
              type: 'string',
              enum: ['pancakeswap', 'apeswap', 'biswap', 'mdex', 'babyswap']
            }
          },
          {
            name: 'asset',
            in: 'query',
            description: 'Filter by asset token address',
            required: false,
            schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
          },
          {
            name: 'type',
            in: 'query',
            description: 'Filter by farm type',
            required: false,
            schema: {
              type: 'string',
              enum: ['standard', 'auto-compound', 'locked', 'flexible']
            }
          },
          {
            name: 'minAPR',
            in: 'query',
            description: 'Minimum APR percentage',
            required: false,
            schema: { type: 'number', minimum: 0 }
          },
          {
            name: 'sortBy',
            in: 'query',
            description: 'Sort field',
            required: false,
            schema: {
              type: 'string',
              enum: ['apr', 'tvl', 'volume', 'fees', 'createdAt'],
              default: 'apr'
            }
          },
          {
            name: 'sortOrder',
            in: 'query',
            description: 'Sort order',
            required: false,
            schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Number of farms to return',
            required: false,
            schema: { type: 'number', minimum: 1, maximum: 100, default: 50 }
          }
        ],
        responses: {
          '200': {
            description: 'Yield farms retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/YieldFarmsResponse' }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/bsc/yield/farms/{farmId}/stake': {
      post: {
        tags: ['yield', 'bsc'],
        summary: 'Stake in yield farm',
        description: 'Stake tokens in a yield farm',
        operationId: 'stakeInYieldFarm',
        parameters: [
          {
            name: 'farmId',
            in: 'path',
            description: 'Farm ID',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          description: 'Staking request',
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StakingRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Staked successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StakingResponse' }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
          '422': { $ref: '#/components/responses/UnprocessableEntity' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/bsc/portfolio/overview/{userAddress}': {
      get: {
        tags: ['portfolio', 'bsc'],
        summary: 'Get portfolio overview',
        description: 'Get comprehensive portfolio overview for a user address',
        operationId: 'getPortfolioOverview',
        parameters: [
          {
            name: 'userAddress',
            in: 'path',
            description: 'User wallet address',
            required: true,
            schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
          },
          {
            name: 'includeHistorical',
            in: 'query',
            description: 'Include historical data',
            required: false,
            schema: { type: 'boolean', default: false }
          },
          {
            name: 'timeframe',
            in: 'query',
            description: 'Timeframe for historical data',
            required: false,
            schema: {
              type: 'string',
              enum: ['1d', '7d', '30d', '90d', '1y'],
              default: '30d'
            }
          }
        ],
        responses: {
          '200': {
            description: 'Portfolio overview retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PortfolioOverviewResponse' }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    },
    '/bsc/portfolio/performance/{userAddress}': {
      get: {
        tags: ['portfolio', 'bsc'],
        summary: 'Get portfolio performance metrics',
        description: 'Get detailed performance metrics and analytics for a portfolio',
        operationId: 'getPortfolioPerformance',
        parameters: [
          {
            name: 'userAddress',
            in: 'path',
            description: 'User wallet address',
            required: true,
            schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
          },
          {
            name: 'timeframe',
            in: 'query',
            description: 'Analysis timeframe',
            required: false,
            schema: {
              type: 'string',
              enum: ['1d', '7d', '30d', '90d', '1y'],
              default: '30d'
            }
          },
          {
            name: 'benchmarks',
            in: 'query',
            description: 'Benchmark tokens to compare against',
            required: false,
            schema: {
              type: 'array',
              items: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
            }
          }
        ],
        responses: {
          '200': {
            description: 'Performance metrics retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PortfolioPerformanceResponse' }
              }
            }
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/InternalServerError' }
        }
      }
    }
  };
}

/**
 * Generate schemas
 */
function generateSchemas() {
  return {
    BSCToken: {
      type: 'object',
      required: ['address', 'name', 'symbol', 'decimals'],
      properties: {
        address: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Token contract address'
        },
        name: { type: 'string', description: 'Token name' },
        symbol: { type: 'string', description: 'Token symbol' },
        decimals: { type: 'number', description: 'Token decimals' },
        verificationStatus: {
          type: 'string',
          enum: ['unverified', 'pending', 'verified', 'blacklisted'],
          description: 'Verification status'
        },
        riskLevel: {
          type: 'string',
          enum: ['very_low', 'low', 'medium', 'high', 'very_high'],
          description: 'Risk assessment level'
        },
        priceUSD: { type: 'number', description: 'Price in USD' },
        priceBNB: { type: 'number', description: 'Price in BNB' },
        marketCap: { type: 'number', description: 'Market capitalization' },
        volume24hUSD: { type: 'number', description: '24h volume in USD' },
        liquidityUSD: { type: 'number', description: 'Total liquidity in USD' },
        priceChange24h: { type: 'number', description: '24h price change percentage' },
        category: {
          type: 'string',
          enum: ['currency', 'defi', 'gaming', 'nft', 'meme', 'stablecoin', 'governance', 'yield', 'bridge', 'layer2', 'exchange', 'lending', 'insurance', 'oracle', 'storage', 'other']
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Token tags'
        },
        logoURI: { type: 'string', format: 'uri', description: 'Token logo URL' },
        website: { type: 'string', format: 'uri', description: 'Project website' },
        twitter: { type: 'string', description: 'Twitter handle' },
        telegram: { type: 'string', description: 'Telegram group' },
        createdAt: { type: 'string', format: 'date-time' },
        discoveredAt: { type: 'string', format: 'date-time' }
      }
    },
    SwapQuote: {
      type: 'object',
      required: ['quoteId', 'tokenIn', 'tokenOut', 'amountIn', 'amountOut'],
      properties: {
        quoteId: { type: 'string', description: 'Unique quote identifier' },
        tokenIn: {
          type: 'object',
          properties: {
            address: { type: 'string' },
            symbol: { type: 'string' },
            decimals: { type: 'number' }
          }
        },
        tokenOut: {
          type: 'object',
          properties: {
            address: { type: 'string' },
            symbol: { type: 'string' },
            decimals: { type: 'number' }
          }
        },
        amountIn: { type: 'string', description: 'Input amount' },
        amountOut: { type: 'string', description: 'Expected output amount' },
        priceImpact: { type: 'number', description: 'Price impact percentage' },
        slippageTolerance: { type: 'number', description: 'Slippage tolerance' },
        minimumAmountOut: { type: 'string', description: 'Minimum output amount' },
        route: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              protocol: { type: 'string' },
              percentage: { type: 'number' }
            }
          }
        },
        gasEstimate: {
          type: 'object',
          properties: {
            gasLimit: { type: 'string' },
            gasPrice: { type: 'string' },
            estimatedCost: { type: 'string' }
          }
        },
        fees: {
          type: 'object',
          properties: {
            protocolFee: { type: 'string' },
            tradingFee: { type: 'string' },
            mevProtectionFee: { type: 'string' }
          }
        },
        validUntil: { type: 'number', description: 'Quote expiration timestamp' },
        metadata: {
          type: 'object',
          properties: {
            bestRouteFound: { type: 'boolean' },
            mevProtection: { type: 'string' },
            liquidityDepth: { type: 'string' }
          }
        }
      }
    },
    LiquidityPool: {
      type: 'object',
      required: ['id', 'token0', 'token1', 'protocol', 'tvl'],
      properties: {
        id: { type: 'string', description: 'Pool identifier' },
        token0: { $ref: '#/components/schemas/BSCToken' },
        token1: { $ref: '#/components/schemas/BSCToken' },
        protocol: {
          type: 'string',
          enum: ['pancakeswap-v2', 'pancakeswap-v3', 'uniswap-v2', 'uniswap-v3'],
          description: 'DEX protocol'
        },
        feeTier: { type: 'string', description: 'Fee tier for V3 pools' },
        tvl: { type: 'number', description: 'Total value locked in USD' },
        volume24h: { type: 'number', description: '24h volume in USD' },
        apr: { type: 'number', description: 'Annual percentage rate' },
        fees24h: { type: 'number', description: '24h fees in USD' },
        price0: { type: 'number', description: 'Price of token0 in terms of token1' },
        price1: { type: 'number', description: 'Price of token1 in terms of token0' },
        reserve0: { type: 'string', description: 'Token0 reserve' },
        reserve1: { type: 'string', description: 'Token1 reserve' },
        liquidity: { type: 'string', description: 'Pool liquidity tokens' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    },
    YieldFarm: {
      type: 'object',
      required: ['id', 'protocol', 'asset', 'apr', 'tvl'],
      properties: {
        id: { type: 'string', description: 'Farm identifier' },
        protocol: {
          type: 'string',
          enum: ['pancakeswap', 'apeswap', 'biswap', 'mdex', 'babyswap'],
          description: 'Protocol name'
        },
        asset: { $ref: '#/components/schemas/BSCToken' },
        type: {
          type: 'string',
          enum: ['standard', 'auto-compound', 'locked', 'flexible'],
          description: 'Farm type'
        },
        apr: { type: 'number', description: 'Annual percentage rate' },
        apy: { type: 'number', description: 'Annual percentage yield (with compounding)' },
        tvl: { type: 'number', description: 'Total value locked in USD' },
        rewardToken: { $ref: '#/components/schemas/BSCToken' },
        rewardRate: { type: 'string', description: 'Reward rate per block/second' },
        multiplier: { type: 'number', description: 'Allocation multiplier' },
        lockPeriod: { type: 'number', description: 'Lock period in days (if applicable)' },
        harvestFrequency: { type: 'string', description: 'Harvest frequency' },
        autoCompound: { type: 'boolean', description: 'Auto-compounding available' },
        isActive: { type: 'boolean', description: 'Farm is currently active' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    },
    PortfolioOverview: {
      type: 'object',
      required: ['userAddress', 'summary', 'assets'],
      properties: {
        userAddress: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'User wallet address'
        },
        summary: {
          type: 'object',
          properties: {
            totalValueUSD: { type: 'number', description: 'Total portfolio value in USD' },
            totalValueBNB: { type: 'number', description: 'Total portfolio value in BNB' },
            totalReturn: { type: 'number', description: 'Total return in USD' },
            totalReturnPercentage: { type: 'number', description: 'Total return percentage' },
            assetCount: { type: 'number', description: 'Number of unique assets' },
            lastUpdated: { type: 'string', format: 'date-time' }
          }
        },
        assets: {
          type: 'object',
          properties: {
            tokens: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  token: { $ref: '#/components/schemas/BSCToken' },
                  balance: { type: 'string', description: 'Token balance' },
                  valueUSD: { type: 'number', description: 'Value in USD' },
                  percentage: { type: 'number', description: 'Portfolio percentage' },
                  avgBuyPrice: { type: 'number', description: 'Average buy price' },
                  currentPrice: { type: 'number', description: 'Current price' },
                  pnl: { type: 'number', description: 'Profit/loss' },
                  pnlPercentage: { type: 'number', description: 'PnL percentage' }
                }
              }
            },
            liquidity: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  pool: { $ref: '#/components/schemas/LiquidityPool' },
                  liquidityTokens: { type: 'string', description: 'LP tokens balance' },
                  valueUSD: { type: 'number', description: 'Value in USD' },
                  percentage: { type: 'number', description: 'Portfolio percentage' },
                  impermanentLoss: { type: 'number', description: 'Impermanent loss' },
                  feesEarned: { type: 'number', description: 'Fees earned' }
                }
              }
            },
            yieldFarming: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  farm: { $ref: '#/components/schemas/YieldFarm' },
                  stakedAmount: { type: 'string', description: 'Amount staked' },
                  valueUSD: { type: 'number', description: 'Value in USD' },
                  percentage: { type: 'number', description: 'Portfolio percentage' },
                  rewardsEarned: { type: 'number', description: 'Rewards earned' },
                  apr: { type: 'number', description: 'Current APR' }
                }
              }
            }
          }
        },
        historicalData: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', format: 'date-time' },
              totalValueUSD: { type: 'number' },
              totalReturn: { type: 'number' }
            }
          }
        }
      }
    },
    Error: {
      type: 'object',
      required: ['success', 'error', 'message'],
      properties: {
        success: { type: 'boolean', example: false },
        error: { type: 'string', description: 'Error code' },
        message: { type: 'string', description: 'Error message' },
        details: {
          type: 'object',
          description: 'Additional error details',
          additionalProperties: true
        },
        timestamp: { type: 'string', format: 'date-time' },
        requestId: { type: 'string', format: 'uuid' }
      }
    },
    Pagination: {
      type: 'object',
      properties: {
        total: { type: 'number', description: 'Total number of items' },
        limit: { type: 'number', description: 'Items per page' },
        offset: { type: 'number', description: 'Items skipped' },
        pages: { type: 'number', description: 'Total pages' },
        hasNext: { type: 'boolean', description: 'Has next page' },
        hasPrev: { type: 'boolean', description: 'Has previous page' }
      }
    },
    TokenListResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            tokens: {
              type: 'array',
              items: { $ref: '#/components/schemas/BSCToken' }
            },
            pagination: { $ref: '#/components/schemas/Pagination' },
            summary: {
              type: 'object',
              properties: {
                totalTokens: { type: 'number' },
                verifiedTokens: { type: 'number' },
                averageRiskLevel: { type: 'string' },
                totalMarketCap: { type: 'number' }
              }
            }
          }
        }
      }
    },
    TokenDetailsResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { $ref: '#/components/schemas/BSCToken' }
      }
    },
    SearchResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            tokens: {
              type: 'array',
              items: { $ref: '#/components/schemas/BSCToken' }
            },
            query: { type: 'string' },
            totalResults: { type: 'number' }
          }
        }
      }
    },
    TokenVerificationRequest: {
      type: 'object',
      required: ['address'],
      properties: {
        address: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Token contract address to verify'
        }
      }
    },
    TokenVerificationResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            verificationId: { type: 'string', format: 'uuid' },
            address: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
            estimatedTime: { type: 'number', description: 'Estimated verification time in seconds' }
          }
        }
      }
    },
    SwapQuoteRequest: {
      type: 'object',
      required: ['tokenIn', 'tokenOut', 'amountIn'],
      properties: {
        tokenIn: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Input token contract address'
        },
        tokenOut: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Output token contract address'
        },
        amountIn: {
          type: 'string',
          pattern: '^[0-9]+$',
          description: 'Input amount in wei/smallest unit'
        },
        slippageTolerance: {
          type: 'number',
          minimum: 0,
          maximum: 50,
          default: 1,
          description: 'Slippage tolerance percentage (0.01 - 50)'
        },
        deadline: {
          type: 'number',
          minimum: 60,
          maximum: 1800,
          description: 'Transaction deadline in seconds'
        },
        recipient: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Recipient address (optional, defaults to sender)'
        },
        enableMEVProtection: {
          type: 'boolean',
          default: true,
          description: 'Enable MEV protection mechanisms'
        }
      }
    },
    SwapQuoteResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { $ref: '#/components/schemas/SwapQuote' }
      }
    },
    SwapExecutionRequest: {
      type: 'object',
      required: ['quoteId', 'signature'],
      properties: {
        quoteId: {
          type: 'string',
          description: 'Quote ID from previous quote request'
        },
        signature: {
          type: 'string',
          description: 'Transaction signature from wallet'
        },
        maxFeePerGas: {
          type: 'string',
          pattern: '^[0-9]+$',
          description: 'Maximum fee per gas (EIP-1559)'
        },
        maxPriorityFeePerGas: {
          type: 'string',
          pattern: '^[0-9]+$',
          description: 'Maximum priority fee per gas (EIP-1559)'
        }
      }
    },
    SwapExecutionResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            transactionHash: { type: 'string', description: 'Transaction hash' },
            status: { type: 'string', enum: ['pending', 'confirmed', 'failed'] },
            amountIn: { type: 'string', description: 'Actual input amount' },
            amountOut: { type: 'string', description: 'Actual output amount' },
            gasUsed: { type: 'string', description: 'Gas used' },
            fees: { type: 'object', description: 'Transaction fees' }
          }
        }
      }
    },
    RouteFindingRequest: {
      type: 'object',
      required: ['tokenIn', 'tokenOut', 'amountIn'],
      properties: {
        tokenIn: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Input token address'
        },
        tokenOut: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Output token address'
        },
        amountIn: {
          type: 'string',
          pattern: '^[0-9]+$',
          description: 'Input amount'
        },
        maxHops: {
          type: 'number',
          minimum: 1,
          maximum: 4,
          default: 3,
          description: 'Maximum number of hops in route'
        },
        protocols: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['pancakeswap-v2', 'pancakeswap-v3', 'uniswap-v2', 'uniswap-v3', 'sushiswap']
          },
          description: 'Preferred protocols (optional)'
        }
      }
    },
    RouteFindingResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            routes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  path: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  protocols: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  amountOut: { type: 'string' },
                  gasEstimate: { type: 'number' },
                  confidence: { type: 'number' }
                }
              }
            },
            bestRoute: {
              type: 'object',
              properties: {
                path: {
                  type: 'array',
                  items: { type: 'string' }
                },
                protocols: {
                  type: 'array',
                  items: { type: 'string' }
                },
                amountOut: { type: 'string' },
                gasEstimate: { type: 'number' },
                confidence: { type: 'number' }
              }
            },
            analysis: {
              type: 'object',
              properties: {
                totalRoutes: { type: 'number' },
                averageSlippage: { type: 'number' },
                bestPriceImpact: { type: 'number' }
              }
            }
          }
        }
      }
    },
    LiquidityPoolsResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            pools: {
              type: 'array',
              items: { $ref: '#/components/schemas/LiquidityPool' }
            },
            pagination: { $ref: '#/components/schemas/Pagination' }
          }
        }
      }
    },
    AddLiquidityRequest: {
      type: 'object',
      required: ['token0', 'token1', 'amount0'],
      properties: {
        token0: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'First token address'
        },
        token1: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Second token address'
        },
        amount0: {
          type: 'string',
          pattern: '^[0-9]+$',
          description: 'Amount of token0 to add'
        },
        amount1: {
          type: 'string',
          pattern: '^[0-9]+$',
          description: 'Amount of token1 to add (optional for single-sided)'
        },
        slippageTolerance: {
          type: 'number',
          minimum: 0,
          maximum: 50,
          default: 0.5,
          description: 'Slippage tolerance percentage'
        },
        deadline: {
          type: 'number',
          minimum: 60,
          maximum: 1800,
          description: 'Transaction deadline in seconds'
        }
      }
    },
    AddLiquidityResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            quoteId: { type: 'string' },
            amount0: { type: 'string' },
            amount1: { type: 'string' },
            liquidityTokens: { type: 'string' },
            shareOfPool: { type: 'number' },
            priceImpact: { type: 'number' },
            gasEstimate: {
              type: 'object',
              properties: {
                gasLimit: { type: 'string' },
                gasPrice: { type: 'string' },
                estimatedCost: { type: 'string' }
              }
            }
          }
        }
      }
    },
    YieldFarmsResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            farms: {
              type: 'array',
              items: { $ref: '#/components/schemas/YieldFarm' }
            },
            pagination: { $ref: '#/components/schemas/Pagination' },
            summary: {
              type: 'object',
              properties: {
                totalFarms: { type: 'number' },
                averageAPR: { type: 'number' },
                totalTVL: { type: 'number' }
              }
            }
          }
        }
      }
    },
    StakingRequest: {
      type: 'object',
      required: ['amount'],
      properties: {
        amount: {
          type: 'string',
          pattern: '^[0-9]+$',
          description: 'Amount to stake in wei'
        },
        lockPeriod: {
          type: 'number',
          minimum: 0,
          description: 'Lock period in days (if applicable)'
        },
        enableAutoCompound: {
          type: 'boolean',
          default: false,
          description: 'Enable auto-compounding'
        }
      }
    },
    StakingResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            positionId: { type: 'string' },
            farmId: { type: 'string' },
            stakedAmount: { type: 'string' },
            shares: { type: 'string' },
            apr: { type: 'number' },
            rewardsToDate: { type: 'number' },
            transactionHash: { type: 'string' }
          }
        }
      }
    },
    PortfolioOverviewResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { $ref: '#/components/schemas/PortfolioOverview' }
      }
    },
    PortfolioPerformanceResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            totalReturn: { type: 'number' },
            totalReturnPercentage: { type: 'number' },
            annualizedReturn: { type: 'number' },
            volatility: { type: 'number' },
            sharpeRatio: { type: 'number' },
            maxDrawdown: { type: 'number' },
            winRate: { type: 'number' },
            assetPerformance: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  assetAddress: { type: 'string' },
                  assetSymbol: { type: 'string' },
                  return: { type: 'number' },
                  returnPercentage: { type: 'number' },
                  allocation: { type: 'number' }
                }
              }
            },
            benchmarks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  benchmarkAddress: { type: 'string' },
                  benchmarkSymbol: { type: 'string' },
                  benchmarkReturn: { type: 'number' },
                  portfolioOutperformance: { type: 'number' }
                }
              }
            },
            timeSeriesData: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string', format: 'date-time' },
                  portfolioValue: { type: 'number' },
                  benchmarkValue: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  };
}

/**
 * Generate response templates
 */
function generateResponses() {
  return {
    BadRequest: {
      description: 'Bad request - invalid parameters or data',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Error' }
        }
      }
    },
    Unauthorized: {
      description: 'Unauthorized - authentication required',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Error' }
        }
      }
    },
    Forbidden: {
      description: 'Forbidden - insufficient permissions',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Error' }
        }
      }
    },
    NotFound: {
      description: 'Resource not found',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Error' }
        }
      }
    },
    UnprocessableEntity: {
      description: 'Unprocessable entity - validation failed',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Error' }
        }
      }
    },
    TooManyRequests: {
      description: 'Too many requests - rate limit exceeded',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Error' }
        }
      }
    },
    InternalServerError: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Error' }
        }
      }
    },
    ServiceUnavailable: {
      description: 'Service unavailable',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Error' }
        }
      }
    }
  };
}

/**
 * Generate parameter templates
 */
function generateParameters() {
  return {
    Address: {
      name: 'address',
      in: 'path',
      description: 'Token contract address',
      required: true,
      schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
    },
    UserAddress: {
      name: 'userAddress',
      in: 'path',
      description: 'User wallet address',
      required: true,
      schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
    },
    FarmId: {
      name: 'farmId',
      in: 'path',
      description: 'Farm ID',
      required: true,
      schema: { type: 'string' }
    },
    Limit: {
      name: 'limit',
      in: 'query',
      description: 'Number of items to return',
      required: false,
      schema: { type: 'number', minimum: 1, maximum: 1000, default: 100 }
    },
    Offset: {
      name: 'offset',
      in: 'query',
      description: 'Number of items to skip',
      required: false,
      schema: { type: 'number', minimum: 0, default: 0 }
    },
    SortBy: {
      name: 'sortBy',
      in: 'query',
      description: 'Sort field',
      required: false,
      schema: { type: 'string', enum: ['name', 'createdAt', 'updatedAt'] }
    },
    SortOrder: {
      name: 'sortOrder',
      in: 'query',
      description: 'Sort order',
      required: false,
      schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
    }
  };
}

/**
 * Generate examples
 */
function generateExamples() {
  return {
    TokenExample: {
      summary: 'Example BSC Token',
      value: {
        address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
        name: 'PancakeSwap Token',
        symbol: 'CAKE',
        decimals: 18,
        verificationStatus: 'verified',
        riskLevel: 'low',
        priceUSD: 2.45,
        priceBNB: 0.0087,
        marketCap: 856234567,
        volume24hUSD: 12345678,
        liquidityUSD: 45678901,
        priceChange24h: 0.0523,
        category: 'defi',
        tags: ['defi', 'dex', 'governance'],
        logoURI: 'https://assets.coingecko.com/coins/images/8254/large/cake.png',
        website: 'https://pancakeswap.finance',
        twitter: '@PancakeSwap',
        telegram: 'https://t.me/pancakeswap',
        createdAt: '2020-09-25T00:00:00Z',
        discoveredAt: '2020-09-25T00:00:00Z'
      }
    },
    SwapQuoteExample: {
      summary: 'Example swap quote',
      value: {
        quoteId: 'quote_abc123def456',
        tokenIn: {
          address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
          symbol: 'WBNB',
          decimals: 18
        },
        tokenOut: {
          address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
          symbol: 'CAKE',
          decimals: 18
        },
        amountIn: '1000000000000000000',
        amountOut: '408163265306122448',
        priceImpact: 0.0234,
        slippageTolerance: 0.01,
        minimumAmountOut: '404081632653061224',
        route: [
          {
            from: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
            to: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
            protocol: 'pancakeswap-v2',
            percentage: 100
          }
        ],
        gasEstimate: {
          gasLimit: '150000',
          gasPrice: '5000000000',
          estimatedCost: '750000000000000'
        },
        fees: {
          protocolFee: '0',
          tradingFee: '2040816',
          mevProtectionFee: '500000000000000'
        },
        validUntil: 1704321600,
        metadata: {
          bestRouteFound: true,
          mevProtection: 'standard',
          liquidityDepth: 'excellent'
        }
      }
    },
    ErrorExample: {
      summary: 'Example error response',
      value: {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid parameters provided',
        details: {
          field: 'tokenIn',
          reason: 'Invalid token address format'
        },
        timestamp: '2024-01-15T10:30:00Z',
        requestId: 'req_123456789'
      }
    }
  };
}

/**
 * Generate HTML documentation
 */
function generateHTMLDocumentation(spec, outputDir) {
  // Swagger UI HTML
  const swaggerHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${config.title} - Swagger UI</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui.css">
    <style>
        body { margin: 0; padding: 20px; background-color: #fafafa; }
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info { margin: 20px 0; }
        .custom-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
        }
        .custom-header h1 { margin: 0; font-size: 2.5em; }
        .custom-header p { margin: 10px 0 0 0; opacity: 0.9; }
    </style>
</head>
<body>
    <div class="custom-header">
        <h1>${config.title}</h1>
        <p>Interactive API Documentation - OpenAPI 3.0</p>
    </div>
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
                tryItOutEnabled: true,
                defaultModelsExpandDepth: 2,
                defaultModelExpandDepth: 2,
                displayRequestDuration: true,
                filter: true,
                supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
                onComplete: function() {
                    console.log("Swagger UI loaded successfully");
                },
                docExpansion: "list",
                persistAuthorization: false
            });
        };
    </script>
</body>
</html>`;

  // ReDoc HTML
  const redocHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${config.title} - ReDoc</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { margin: 0; padding: 0; background-color: #fafafa; }
        .custom-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
        }
        .custom-header h1 { margin: 0; font-size: 2.5em; }
        .custom-header p { margin: 10px 0 0 0; opacity: 0.9; }
    </style>
</head>
<body>
    <div class="custom-header">
        <h1>${config.title}</h1>
        <p>API Reference Documentation</p>
    </div>
    <redoc spec-url='./openapi.json'></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@2.0.0/bundles/redoc.standalone.js"></script>
</body>
</html>`;

  writeFileSync(join(outputDir, 'index.html'), swaggerHTML, 'utf-8');
  writeFileSync(join(outputDir, 'redoc.html'), redocHTML, 'utf-8');
}

/**
 * Generate Postman collection
 */
function generatePostmanCollection(spec) {
  const collection = {
    info: {
      name: spec.info.title,
      description: spec.info.description,
      version: spec.info.version,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      _postman_id: 'bsc-dex-collection'
    },
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
        value: spec.servers[0].url,
        type: 'string'
      },
      {
        key: 'access_token',
        value: '',
        type: 'string'
      }
    ],
    item: []
  };

  // Group by tags
  const folders = {};

  Object.entries(spec.paths).forEach(([path, methods]) => {
    Object.entries(methods).forEach(([method, operation]) => {
      const tag = operation.tags?.[0] || 'General';

      if (!folders[tag]) {
        folders[tag] = {
          name: tag.charAt(0).toUpperCase() + tag.slice(1),
          item: []
        };
      }

      const request = {
        name: operation.summary || `${method.toUpperCase()} ${path}`,
        request: {
          method: method.toUpperCase(),
          header: [],
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
        const pathParams = operation.parameters.filter(p => p.in === 'path');
        const queryParams = operation.parameters.filter(p => p.in === 'query');

        if (pathParams.length > 0) {
          request.request.url.variable = pathParams.map(p => ({
            key: p.name,
            value: '',
            description: p.description
          }));
        }

        if (queryParams.length > 0) {
          request.request.url.query = queryParams.map(p => ({
            key: p.name,
            value: '',
            description: p.description,
            disabled: !p.required
          }));
        }
      }

      // Add request body
      if (operation.requestBody && operation.requestBody.content) {
        const content = operation.requestBody.content['application/json'];
        if (content) {
          request.request.header.push({
            key: 'Content-Type',
            value: 'application/json'
          });

          request.request.body = {
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
        request.request.auth = {
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
 * Generate README documentation
 */
function generateREADME(spec, outputDir) {
  const readme = `# ${spec.info.title}

${spec.info.description}

## Version

${spec.info.version}

## Base URL

\`\`\`
${spec.servers.map(s => `- ${s.description}: ${s.url}`).join('\n')}
\`\`\`

## Authentication

This API uses JWT Bearer tokens for authentication:

\`\`\`
Authorization: Bearer YOUR_TOKEN_HERE
\`\`\`

Alternatively, you can use API keys:

\`\`\`
X-API-Key: YOUR_API_KEY_HERE
\`\`\`

## Quick Start

### 1. Get Your API Token

Contact our support team at ${spec.info.contact.email} to get your API credentials.

### 2. Make Your First API Call

\`\`\`bash
curl -X GET "${spec.servers[0].url}/bsc/tokens?limit=10" \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
\`\`\`

### 3. Explore Token Trading

\`\`\`bash
curl -X POST "${spec.servers[0].url}/bsc/trading/quote" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\
  -d '{
    "tokenIn": "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
    "tokenOut": "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
    "amountIn": "1000000000000000000",
    "slippageTolerance": 1
  }'
\`\`\`

## API Endpoints

### 🪙 Tokens API
- \`GET /bsc/tokens\` - List BSC tokens with filtering
- \`GET /bsc/tokens/{address}\` - Get specific token details
- \`GET /bsc/tokens/search\` - Search tokens
- \`POST /bsc/tokens/verify\` - Verify token contract

### 🔄 Trading API
- \`POST /bsc/trading/quote\` - Get swap quote
- \`POST /bsc/trading/swap\` - Execute token swap
- \`POST /bsc/trading/routes\` - Find optimal routes

### 💧 Liquidity API
- \`GET /bsc/liquidity/pools\` - List liquidity pools
- \`POST /bsc/liquidity/quote/add\` - Get add liquidity quote

### 🌱 Yield Farming API
- \`GET /bsc/yield/farms\` - List yield farms
- \`POST /bsc/yield/farms/{farmId}/stake\` - Stake in farm

### 📊 Portfolio API
- \`GET /bsc/portfolio/overview/{address}\` - Get portfolio overview
- \`GET /bsc/portfolio/performance/{address}\` - Get performance metrics

### 🏥 Health API
- \`GET /bsc/health\` - Check service health

## Rate Limiting

API requests are rate-limited to ensure fair usage:

- **Anonymous users**: 100 requests per minute
- **Authenticated users**: 1,000 requests per minute
- **Premium users**: 5,000 requests per minute

Rate limit headers are included in every response:

- \`X-RateLimit-Limit\`: Request limit per window
- \`X-RateLimit-Remaining\`: Remaining requests
- \`X-RateLimit-Reset\`: Reset timestamp

## Error Handling

The API uses standard HTTP status codes and returns errors in the following format:

\`\`\`json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Invalid parameters provided",
  "details": {
    "field": "tokenIn",
    "reason": "Invalid token address"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123456789"
}
\`\`\`

### Common Error Codes

- \`400 Bad Request\` - Invalid parameters or data
- \`401 Unauthorized\` - Authentication required
- \`403 Forbidden\` - Insufficient permissions
- \`404 Not Found\` - Resource not found
- \`422 Unprocessable Entity\` - Validation failed
- \`429 Too Many Requests\` - Rate limit exceeded
- \`500 Internal Server Error\` - Server error

## Code Examples

### JavaScript (Node.js)

\`\`\`javascript
const axios = require('axios');

// Configure API client
const api = axios.create({
  baseURL: '${spec.servers[0].url}',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  }
});

// Get token list
const tokens = await api.get('/bsc/tokens', {
  params: { limit: 10, verified: true }
});

// Get swap quote
const quote = await api.post('/bsc/trading/quote', {
  tokenIn: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
  tokenOut: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
  amountIn: '1000000000000000000'
});
\`\`\`

### Python

\`\`\`python
import requests

# Configure session
session = requests.Session()
session.headers.update({
  'Authorization': 'Bearer YOUR_TOKEN_HERE'
})

# Get token list
response = session.get('${spec.servers[0].url}/bsc/tokens', params={
  'limit': 10,
  'verified': True
})
tokens = response.json()

# Get swap quote
quote_response = session.post('${spec.servers[0].url}/bsc/trading/quote', json={
  'tokenIn': '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
  'tokenOut': '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
  'amountIn': '1000000000000000000'
})
quote = quote_response.json()
\`\`\`

### cURL

\`\`\`bash
# Get token list
curl -X GET "${spec.servers[0].url}/bsc/tokens?limit=10&verified=true" \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Get swap quote
curl -X POST "${spec.servers[0].url}/bsc/trading/quote" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \\
  -d '{
    "tokenIn": "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
    "tokenOut": "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
    "amountIn": "1000000000000000000",
    "slippageTolerance": 1
  }'
\`\`\`

## SDKs and Libraries

Coming soon! We're working on official SDKs for:

- JavaScript/TypeScript
- Python
- Go
- Rust
- Swift

## Support

- **Documentation**: ${spec.info.contact.url}
- **Email**: ${spec.info.contact.email}
- **Status Page**: https://status.bsc-dex.com
- **API Issues**: https://github.com/bsc-dex/api/issues

## License

${spec.info.license.name}

## Changelog

### v${spec.info.version}
- Initial BSC DEX API release
- Token discovery and verification
- Trading with PancakeSwap integration
- Liquidity management
- Yield farming opportunities
- Portfolio analytics

---

For more detailed information, see our [full documentation](${spec.info.contact.url}) or [interactive API explorer](./index.html).
`;

  writeFileSync(join(outputDir, 'README.md'), readme, 'utf-8');
}

/**
 * Export documentation to files
 */
async function exportDocumentation(spec) {
  const outputDir = config.outputDir;

  // Create output directory if it doesn't exist
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Export OpenAPI JSON
  writeFileSync(
    join(outputDir, 'openapi.json'),
    JSON.stringify(spec, null, 2),
    'utf-8'
  );

  // Export OpenAPI YAML
  writeFileSync(
    join(outputDir, 'openapi.yaml'),
    yaml.dump(spec, { indent: 2 }),
    'utf-8'
  );

  // Generate HTML documentation
  generateHTMLDocumentation(spec, outputDir);

  // Generate Postman collection if requested
  if (config.generatePostmanCollection) {
    const collectionsDir = join(outputDir, 'collections');
    if (!existsSync(collectionsDir)) {
      mkdirSync(collectionsDir, { recursive: true });
    }

    const postmanCollection = generatePostmanCollection(spec);
    writeFileSync(
      join(collectionsDir, 'postman_collection.json'),
      JSON.stringify(postmanCollection, null, 2),
      'utf-8'
    );
  }

  // Generate README
  generateREADME(spec, outputDir);
}

/**
 * Generate API documentation
 */
async function generateAPIDocumentation() {
  console.log('🚀 Starting BSC DEX API Documentation Generation');

  try {
    // Generate OpenAPI specification
    const spec = generateOpenAPISpec();

    // Export documentation files
    await exportDocumentation(spec);

    console.log('✅ API documentation generated successfully!');
    console.log(`📁 Documentation location: ${config.outputDir}`);
    console.log(`🌐 Interactive docs: http://localhost:3000/docs`);
    console.log(`📋 OpenAPI spec: ${config.outputDir}/openapi.json`);

    // Log statistics
    const endpointCount = Object.keys(spec.paths).length;
    const schemaCount = Object.keys(spec.components.schemas || {}).length;

    console.log(`📊 Generated ${endpointCount} API endpoints`);
    console.log(`📋 Created ${schemaCount} data schemas`);
    console.log(`📖 Available in JSON, YAML, and HTML formats`);

    if (config.generatePostmanCollection) {
      console.log(`📮 Postman collection: ${config.outputDir}/collections/postman_collection.json`);
    }

    console.log('\n🎉 Documentation generation complete!');
    console.log('\nNext steps:');
    console.log('1. Review the generated documentation');
    console.log('2. Test the interactive API explorer');
    console.log('3. Import the Postman collection for testing');
    console.log('4. Share the documentation with your team');

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Validate configuration
 */
function validateConfig() {
  if (!config.title) {
    throw new Error('API title is required');
  }

  if (!config.version) {
    throw new Error('API version is required');
  }

  if (!config.description) {
    throw new Error('API description is required');
  }

  if (!config.outputDir) {
    throw new Error('Output directory is required');
  }

  if (!config.servers || config.servers.length === 0) {
    throw new Error('At least one server URL is required');
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🚀 BSC DEX API Documentation Generator');

    // Validate configuration
    validateConfig();

    // Generate documentation
    await generateAPIDocumentation();

    console.log('✨ All done! Your API documentation is ready.');

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('\n💥 Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { generateAPIDocumentation, config };