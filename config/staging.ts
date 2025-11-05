/**
 * 🎭 Staging Environment Configuration
 *
 * Configuration for staging environment with Viem 2.38.5
 * Optimized for testing and validation before production deployment
 */

import { createPublicClient, createWalletClient, http, fallback } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';

// Environment type definition
export type Environment = 'staging' | 'production' | 'development';

// Staging environment configuration
export const STAGING_CONFIG = {
  // Basic environment settings
  env: 'staging' as Environment,
  nodeEnv: 'staging',
  debug: true,
  logLevel: 'info',

  // Server configuration
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    cors: {
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://staging.moonex.com',
        'https://app-staging.moonex.com'
      ],
      credentials: true
    }
  },

  // Database configuration
  database: {
    url: process.env.STAGING_DATABASE_URL || process.env.DATABASE_URL,
    ssl: true,
    connectionTimeout: 30000,
    queryTimeout: 30000,
    maxConnections: 10
  },

  // Redis configuration
  redis: {
    url: process.env.STAGING_REDIS_URL || process.env.REDIS_URL,
    keyPrefix: 'moonex:staging:',
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3
  },

  // Viem client configuration
  viem: {
    // BSC Mainnet client (for production-like testing)
    bscMainnet: {
      chain: bsc,
      transport: fallback([
        http(process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org', {
          retryCount: 3,
          retryDelay: 1000,
          timeout: 30000
        }),
        http(process.env.BSC_RPC_URL_2 || 'https://bsc-dataseed2.binance.org', {
          retryCount: 3,
          retryDelay: 1000,
          timeout: 30000
        }),
        http(process.env.BSC_RPC_URL_3 || 'https://bsc-dataseed3.binance.org', {
          retryCount: 3,
          retryDelay: 1000,
          timeout: 30000
        })
      ]),
      polling: false,
      batch: {
        multicall: true,
        batchSize: 10
      }
    },

    // BSC Testnet client (for initial testing)
    bscTestnet: {
      chain: bscTestnet,
      transport: fallback([
        http(process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545', {
          retryCount: 3,
          retryDelay: 1000,
          timeout: 30000
        })
      ]),
      polling: false,
      batch: {
        multicall: true,
        batchSize: 10
      }
    }
  },

  // Smart contract configuration
  contracts: {
    // PancakeSwap v2 Router
    pancakeSwapRouterV2: process.env.STAGING_PANCAKESWAP_ROUTER ||
      process.env.PANCAKESWAP_ROUTER_V2 || '0x10ED43C718714eb63d5aA57B78B54704E256024E',

    // PancakeSwap v2 Factory
    pancakeSwapFactoryV2: process.env.STAGING_PANCAKESWAP_FACTORY ||
      process.env.PANCAKESWAP_FACTORY_V2 || '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',

    // Common BSC tokens
    tokens: {
      WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
      CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
      USDT: '0x55d398326f99059fF775485246999027B3197955',
      USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'
    }
  },

  // Authentication configuration
  auth: {
    jwtSecret: process.env.STAGING_JWT_SECRET || process.env.JWT_SECRET,
    jwtExpiration: '24h',
    refreshExpiration: '7d',
    bcryptRounds: 10,

    // Privy configuration for staging
    privy: {
      appId: process.env.STAGING_PRIVY_APP_ID || process.env.PRIVY_APP_ID,
      appSecret: process.env.STAGING_PRIVY_APP_SECRET || process.env.PRIVY_APP_SECRET,
      verificationUrl: 'https://auth.staging.moonex.com'
    }
  },

  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  },

  // Security configuration
  security: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://api.staging.moonex.com"]
        }
      }
    }
  },

  // Monitoring and logging
  monitoring: {
    // Enable detailed logging in staging
    logging: {
      level: 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      }
    },

    // Metrics collection
    metrics: {
      enabled: true,
      prefix: 'moonex_staging_',
      labels: {
        environment: 'staging',
        version: process.env.npm_package_version || '1.0.0',
        viem_version: '2.38.5'
      }
    },

    // Health check configuration
    healthCheck: {
      enabled: true,
      endpoint: '/health',
      checks: [
        'database',
        'redis',
        'bsc_connection',
        'viem_functionality'
      ]
    }
  },

  // Cache configuration
  cache: {
    // Token info cache
    tokenInfo: {
      ttl: 300, // 5 minutes
      maxSize: 1000
    },

    // Swap quotes cache
    swapQuotes: {
      ttl: 60, // 1 minute
      maxSize: 500
    },

    // Liquidity info cache
    liquidityInfo: {
      ttl: 180, // 3 minutes
      maxSize: 500
    }
  },

  // Feature flags for staging
  features: {
    // Enable all Viem features in staging
    viem: true,
    bscIntegration: true,
    realTimeUpdates: true,
    advancedTrading: true,
    yieldFarming: true,
    governance: true,

    // Staging-specific features
    testMode: true,
    mockData: false,
    debugEndpoints: true,
    performanceMonitoring: true
  },

  // Performance configuration
  performance: {
    // Response timeouts
    timeouts: {
      bscRpc: 30000,
      database: 30000,
      redis: 5000,
      external: 10000
    },

    // Concurrency limits
    concurrency: {
      maxConcurrentBscCalls: 10,
      maxConcurrentDatabaseQueries: 20,
      maxConcurrentRedisOperations: 50
    },

    // Retry configuration
    retry: {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2
    }
  },

  // Testing configuration
  testing: {
    // Enable test endpoints
    testEndpoints: true,

    // Test data configuration
    testData: {
      testAccountAddress: '0x742d35Cc6634C0532925a3b8D4C0C8b3C2E4C5b6',
      testTokenAddress: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      testAmount: '1000000000000000000' // 1 token in wei
    },

    // Mock configuration for testing
    mock: {
      enableMockBscCalls: false,
      enableMockDatabase: false,
      enableMockRedis: false
    }
  }
};

// Validation function for staging config
export function validateStagingConfig(): boolean {
  const errors: string[] = [];

  // Validate required environment variables
  const requiredEnvVars = [
    'JWT_SECRET',
    'BSC_RPC_URL',
    'DATABASE_URL',
    'REDIS_URL'
  ];

  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  });

  // Validate configuration values
  if (!STAGING_CONFIG.contracts.pancakeSwapRouterV2) {
    errors.push('PancakeSwap router address is required');
  }

  if (!STAGING_CONFIG.contracts.pancakeSwapFactoryV2) {
    errors.push('PancakeSwap factory address is required');
  }

  if (errors.length > 0) {
    console.error('❌ Staging configuration validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    return false;
  }

  console.log('✅ Staging configuration validated successfully');
  return true;
}

// Export default configuration
export default STAGING_CONFIG;