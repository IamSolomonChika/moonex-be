import { BSCTestEnvironment } from './bsc-test-env';

/**
 * Test Configuration for BSC Testing Infrastructure
 */
export interface TestConfiguration {
  environment: 'local' | 'development' | 'staging' | 'testnet';
  database: DatabaseTestConfig;
  services: ServiceTestConfig;
  fixtures: FixtureConfig;
  mocks: MockConfig;
  coverage: CoverageConfig;
  reporting: ReportingConfig;
}

export interface DatabaseTestConfig {
  migrations: {
    enabled: boolean;
    path: string;
    pattern: string;
  };
  seeds: {
    enabled: boolean;
    path: string;
    data: string[];
  };
  cleanup: {
    enabled: boolean;
    strategy: 'drop' | 'truncate' | 'rollback';
    tables?: string[];
  };
  isolation: {
    transactions: boolean;
    databases: boolean;
    parallel: boolean;
  };
  performance: {
    queryTimeout: number;
    connectionPool: number;
    slowQueryThreshold: number;
  };
}

export interface ServiceTestConfig {
  api: {
    port: number;
    host: string;
    timeout: number;
    retries: number;
  };
  redis: {
    enabled: boolean;
    db: number;
    flushOnStart: boolean;
  };
  websocket: {
    enabled: boolean;
    port: number;
    autoReconnect: boolean;
  };
  external: {
    rpc: {
      enabled: boolean;
      mock: boolean;
      latency: number;
    };
    blockchain: {
      enabled: boolean;
      mining: 'auto' | 'manual';
      blockTime: number;
    };
  };
}

export interface FixtureConfig {
  tokens: TokenFixture[];
  liquidity: LiquidityFixture[];
  users: UserFixture[];
  proposals: ProposalFixture[];
  pools: PoolFixture[];
  farms: FarmFixture[];
}

export interface TokenFixture {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  holder: string;
  distribution: TokenDistribution[];
}

export interface TokenDistribution {
  address: string;
  amount: string;
  percentage: number;
}

export interface LiquidityFixture {
  tokenA: string;
  tokenB: string;
  amountA: string;
  amountB: string;
  provider: string;
  fee: number;
}

export interface UserFixture {
  address: string;
  label: string;
  role: 'trader' | 'liquidity_provider' | 'arbitrageur' | 'governor' | 'fee_recipient';
  balances: Record<string, string>;
  permissions: string[];
}

export interface ProposalFixture {
  title: string;
  description: string;
  proposer: string;
  targets: ProposalTarget[];
  votingPeriod: number;
  quorum: string;
}

export interface ProposalTarget {
  target: string;
  value: string;
  signature: string;
  data: string;
}

export interface PoolFixture {
  token0: string;
  token1: string;
  fee: number;
  sqrtPriceX96: string;
  liquidity: string;
  tickCurrent: number;
}

export interface FarmFixture {
  pool: string;
  allocPoint: number;
  rewarder: string;
  rewardsPerSecond: string;
  depositFee: number;
}

export interface MockConfig {
  pancakeswap: PancakeSwapMockConfig;
  externalAPIs: ExternalAPIMockConfig;
  marketData: MarketDataMockConfig;
  events: EventMockConfig;
}

export interface PancakeSwapMockConfig {
  enabled: boolean;
    contracts: {
      router: boolean;
      factory: boolean;
      masterChef: boolean;
      masterChefV2: boolean;
      wbnb: boolean;
    };
    prices: {
      enabled: boolean;
      volatility: number;
      trend: 'bullish' | 'bearish' | 'sideways';
      updateInterval: number;
    };
    liquidity: {
      enabled: boolean;
      depth: number;
      providers: number;
    };
  };

export interface ExternalAPIMockConfig {
  coingecko: {
    enabled: boolean;
    latency: number;
    errorRate: number;
  };
  defillama: {
    enabled: boolean;
    latency: number;
    errorRate: number;
  };
  moralis: {
    enabled: boolean;
    latency: number;
    errorRate: number;
  };
}

export interface MarketDataMockConfig {
  enabled: boolean;
  prices: PriceMockConfig;
  volumes: VolumeMockConfig;
  events: EventMockConfig;
  notifications: NotificationMockConfig;
}

export interface PriceMockConfig {
  basePrice: Record<string, number>;
  volatility: number;
  updateInterval: number;
  correlation: number;
}

export interface VolumeMockConfig {
  baseVolume: Record<string, number>;
  variation: number;
  pattern: 'random' | 'sine' | 'linear';
  updateInterval: number;
}

export interface EventMockConfig {
  types: string[];
  frequency: number;
  batch: boolean;
  batchSize: number;
}

export interface NotificationMockConfig {
  enabled: boolean;
  channels: string[];
  triggers: string[];
  frequency: number;
}

export interface CoverageConfig {
  enabled: boolean;
  thresholds: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  reports: {
    formats: ('html' | 'json' | 'lcov')[];
    output: string;
    clean: boolean;
  };
  exclude: string[];
  include: string[];
}

export interface ReportingConfig {
  enabled: boolean;
  formats: ('html' | 'json' | 'junit')[];
  output: string;
  include: {
    coverage: boolean;
    screenshots: boolean;
    videos: boolean;
    traces: boolean;
  };
  ci: {
    enabled: boolean;
    format: string;
    upload: boolean;
  };
}

/**
 * Test Configuration Manager
 */
export class TestConfigurationManager {
  private configurations: Map<string, TestConfiguration> = new Map();

  constructor() {
    this.initializeConfigurations();
  }

  /**
   * Get configuration by environment name
   */
  getConfig(environment: string): TestConfiguration {
    const config = this.configurations.get(environment);
    if (!config) {
      throw new Error(`Configuration not found for environment: ${environment}`);
    }
    return config;
  }

  /**
   * Get current environment configuration
   */
  getCurrentConfig(): TestConfiguration {
    const env = process.env.NODE_ENV || 'test';
    return this.getConfig(env);
  }

  /**
   * Add custom configuration
   */
  addConfiguration(name: string, config: TestConfiguration): void {
    this.configurations.set(name, config);
  }

  /**
   * Validate configuration
   */
  validateConfig(config: TestConfiguration): boolean {
    // Validate required fields
    if (!config.environment) {
      console.error('❌ Environment not specified');
      return false;
    }

    // Validate database configuration
    if (!config.database || !config.database.migrations || !config.database.seeds) {
      console.error('❌ Database configuration invalid');
      return false;
    }

    // Validate service configuration
    if (!config.services || !config.services.api || !config.services.redis) {
      console.error('❌ Service configuration invalid');
      return false;
    }

    console.log('✅ Configuration validation passed');
    return true;
  }

  private initializeConfigurations(): void {
    // Local development configuration
    this.configurations.set('local', {
      environment: 'local',
      database: {
        migrations: {
          enabled: true,
          path: './tests/migrations',
          pattern: '*.{js,ts}'
        },
        seeds: {
          enabled: true,
          path: './tests/seeds',
          data: ['tokens', 'users', 'liquidity']
        },
        cleanup: {
          enabled: true,
          strategy: 'truncate',
          tables: ['transactions', 'balances', 'positions']
        },
        isolation: {
          transactions: true,
          databases: false,
          parallel: true
        },
        performance: {
          queryTimeout: 30000,
          connectionPool: 5,
          slowQueryThreshold: 1000
        }
      },
      services: {
        api: {
          port: 3001,
          host: 'localhost',
          timeout: 30000,
          retries: 3
        },
        redis: {
          enabled: true,
          db: 1,
          flushOnStart: true
        },
        websocket: {
          enabled: true,
          port: 3002,
          autoReconnect: true
        },
        external: {
          rpc: {
            enabled: true,
            mock: false,
            latency: 0
          },
          blockchain: {
            enabled: true,
            mining: 'auto',
            blockTime: 2000
          }
        }
      },
      fixtures: this.generateFixtures(),
      mocks: this.generateMocks(),
      coverage: {
        enabled: true,
        thresholds: {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80
        },
        reports: {
          formats: ['html', 'lcov'],
          output: './coverage',
          clean: true
        },
        exclude: ['**/*.test.ts', '**/*.spec.ts'],
        include: ['src/**/*.ts']
      },
      reporting: {
        enabled: true,
        formats: ['html', 'json'],
        output: './test-results',
        include: {
          coverage: true,
          screenshots: true,
          videos: false,
          traces: true
        },
        ci: {
          enabled: false,
          format: 'github',
          upload: false
        }
      }
    });

    // Test environment configuration
    this.configurations.set('test', {
      environment: 'test',
      database: {
        migrations: {
          enabled: true,
          path: './tests/migrations',
          pattern: '*.{js,ts}'
        },
        seeds: {
          enabled: true,
          path: './tests/seeds',
          data: ['tokens', 'users', 'liquidity', 'proposals']
        },
        cleanup: {
          enabled: true,
          strategy: 'rollback',
          tables: []
        },
        isolation: {
          transactions: true,
          databases: true,
          parallel: false
        },
        performance: {
          queryTimeout: 10000,
          connectionPool: 2,
          slowQueryThreshold: 500
        }
      },
      services: {
        api: {
          port: 3001,
          host: 'localhost',
          timeout: 10000,
          retries: 1
        },
        redis: {
          enabled: true,
          db: 15,
          flushOnStart: true
        },
        websocket: {
          enabled: true,
          port: 3002,
          autoReconnect: true
        },
        external: {
          rpc: {
            enabled: true,
            mock: true,
            latency: 100
          },
          blockchain: {
            enabled: true,
            mining: 'manual',
            blockTime: 2000
          }
        }
      },
      fixtures: this.generateFixtures(),
      mocks: this.generateMocks(),
      coverage: {
        enabled: true,
        thresholds: {
          statements: 85,
          branches: 80,
          functions: 85,
          lines: 85
        },
        reports: {
          formats: ['json', 'lcov'],
          output: './coverage',
          clean: true
        },
        exclude: ['**/*.test.ts', '**/*.spec.ts', '**/mocks/**'],
        include: ['src/**/*.ts']
      },
      reporting: {
        enabled: true,
        formats: ['json', 'junit'],
        output: './test-results',
        include: {
          coverage: true,
          screenshots: false,
          videos: false,
          traces: true
        },
        ci: {
          enabled: true,
          format: 'github',
          upload: true
        }
      }
    });
  }

  private generateFixtures(): FixtureConfig {
    return {
      tokens: [
        {
          name: 'Wrapped BNB',
          symbol: 'WBNB',
          decimals: 18,
          totalSupply: '1000000000',
          holder: 'liquidityProvider',
          distribution: [
            { address: 'user1', amount: '10000', percentage: 1 },
            { address: 'user2', amount: '20000', percentage: 2 },
            { address: 'liquidityProvider', amount: '500000', percentage: 50 }
          ]
        },
        {
          name: 'USDT Token',
          symbol: 'USDT',
          decimals: 6,
          totalSupply: '1000000000',
          holder: 'liquidityProvider',
          distribution: [
            { address: 'user1', amount: '50000', percentage: 5 },
            { address: 'user2', amount: '100000', percentage: 10 },
            { address: 'liquidityProvider', amount: '400000', percentage: 40 }
          ]
        },
        {
          name: 'CAKE Token',
          symbol: 'CAKE',
          decimals: 18,
          totalSupply: '1000000000',
          holder: 'liquidityProvider',
          distribution: [
            { address: 'user1', amount: '10000', percentage: 1 },
            { address: 'user3', amount: '5000', percentage: 0.5 },
            { address: 'liquidityProvider', amount: '300000', percentage: 30 }
          ]
        }
      ],
      liquidity: [
        {
          tokenA: 'WBNB',
          tokenB: 'USDT',
          amountA: '1000',
          amountB: '2000000',
          provider: 'liquidityProvider',
          fee: 500
        },
        {
          tokenA: 'CAKE',
          tokenB: 'USDT',
          amountA: '10000',
          amountB: '100000',
          provider: 'liquidityProvider',
          fee: 2500
        }
      ],
      users: [
        {
          address: 'user1',
          label: 'Regular Trader',
          role: 'trader',
          balances: {
            WBNB: '100',
            USDT: '50000',
            CAKE: '10000'
          },
          permissions: ['trade', 'view']
        },
        {
          address: 'user2',
          label: 'Power Trader',
          role: 'trader',
          balances: {
            WBNB: '200',
            USDT: '100000',
            CAKE: '20000'
          },
          permissions: ['trade', 'view', 'analytics']
        },
        {
          address: 'user3',
          label: 'Governor',
          role: 'governor',
          balances: {
            WBNB: '50',
            USDT: '25000',
            CAKE: '5000'
          },
          permissions: ['trade', 'view', 'governance', 'analytics']
        }
      ],
      proposals: [
        {
          title: 'Test Proposal 1',
          description: 'A test proposal for governance testing',
          proposer: 'user3',
          targets: [],
          votingPeriod: 7 * 24 * 60 * 60, // 7 days
          quorum: '100000'
        }
      ],
      pools: [],
      farms: []
    };
  }

  private generateMocks(): MockConfig {
    return {
      pancakeswap: {
        enabled: true,
        contracts: {
          router: true,
          factory: true,
          masterChef: true,
          masterChefV2: true,
          wbnb: true
        },
        prices: {
          enabled: true,
          volatility: 0.05,
          trend: 'bullish',
          updateInterval: 5000
        },
        liquidity: {
          enabled: true,
          depth: 1000000,
          providers: 10
        }
      },
      externalAPIs: {
        coingecko: {
          enabled: true,
          latency: 200,
          errorRate: 0.01
        },
        defillama: {
          enabled: true,
          latency: 300,
          errorRate: 0.02
        },
        moralis: {
          enabled: true,
          latency: 150,
          errorRate: 0.01
        }
      },
      marketData: {
        enabled: true,
        prices: {
          basePrice: {
            WBNB: '300',
            USDT: '1',
            CAKE: '2.5'
          },
          volatility: 0.1,
          updateInterval: 1000,
          correlation: 0.7
        },
        volumes: {
          baseVolume: {
            WBNB: '1000000',
            USDT: '50000000',
            CAKE: '5000000'
          },
          variation: 0.2,
          pattern: 'sine',
          updateInterval: 5000
        },
        events: {
          types: ['trade', 'liquidity', 'governance'],
          frequency: 10,
          batch: true,
          batchSize: 5
        },
        notifications: {
          enabled: true,
          channels: ['console', 'webhook'],
          triggers: ['large_trade', 'price_movement', 'governance_event'],
          frequency: 30
        }
      }
    };
  }
}

/**
 * Global test configuration instance
 */
export const testConfig = new TestConfigurationManager();

/**
 * Export default configuration for common use
 */
export default testConfig.getCurrentConfig();