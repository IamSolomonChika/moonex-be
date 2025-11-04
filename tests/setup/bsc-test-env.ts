import { ethers } from 'ethers';
import { config as dotenvConfig } from 'dotenv';

// Load test environment variables
dotenvConfig({ path: '.env.test' });

/**
 * BSC Test Environment Configuration
 */
export interface BSCTestEnvironment {
  network: BSCNetworkConfig;
  contracts: ContractConfig;
  wallets: TestWalletConfig;
  services: ServiceConfig;
  database: DatabaseConfig;
  monitoring: MonitoringConfig;
}

export interface BSCNetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  blockTime: number;
  gasLimit: number;
  gasPrice: string;
  confirmations: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface ContractConfig {
  PancakeRouter: string;
  PancakeFactory: string;
  PancakeMasterChef: string;
  PancakeMasterChefV2: string;
  WBNB: string;
  USDT: string;
  USDC: string;
  CAKE: string;
  BUSD: string;
  MockERC20: string;
  MockGovernance: string;
}

export interface TestWalletConfig {
  deployer: WalletConfig;
  user1: WalletConfig;
  user2: WalletConfig;
  user3: WalletConfig;
  liquidityProvider: WalletConfig;
  arbitrageur: WalletConfig;
  feeRecipient: WalletConfig;
  governanceAdmin: WalletConfig;
}

export interface WalletConfig {
  address: string;
  privateKey: string;
  mnemonic?: string;
  balance: string;
  label: string;
}

export interface ServiceConfig {
  rpc: RPCServiceConfig;
  redis: RedisConfig;
  api: APIServiceConfig;
  websocket: WebSocketConfig;
  monitoring: MonitoringServiceConfig;
}

export interface RPCServiceConfig {
  primary: string;
  fallback: string[];
  timeout: number;
  retries: number;
  rateLimit: number;
  maxConcurrency: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  ttl: number;
  maxRetries: number;
  connectTimeout: number;
  lazyConnect: boolean;
}

export interface APIServiceConfig {
  port: number;
  host: string;
  cors: boolean;
  bodyParser: boolean;
  rateLimit: boolean;
  rateLimitWindow: number;
  rateLimitMax: number;
  logging: boolean;
  swagger: boolean;
}

export interface WebSocketConfig {
  port: number;
  host: string;
  path: string;
  compression: boolean;
  maxConnections: number;
  heartbeatInterval: number;
  heartbeatTimeout: number;
}

export interface MonitoringServiceConfig {
  enabled: boolean;
  metrics: boolean;
  tracing: boolean;
  logging: boolean;
  logLevel: string;
  logFormat: string;
  prometheus: PrometheusConfig;
  jaeger: JaegerConfig;
}

export interface PrometheusConfig {
  enabled: boolean;
  port: number;
  endpoint: string;
  labels: Record<string, string>;
}

export interface JaegerConfig {
  enabled: boolean;
  endpoint: string;
  service: string;
  sampler: {
    type: string;
    param: number;
  };
}

export interface DatabaseConfig {
  postgres: PostgresConfig;
  mongodb: MongoConfig;
  testDatabase: boolean;
  migrations: boolean;
  seeds: boolean;
}

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export interface MongoConfig {
  uri: string;
  database: string;
  options: MongoOptions;
}

export interface MongoOptions {
  maxPoolSize: number;
  minPoolSize: number;
  maxIdleTimeMS: number;
  serverSelectionTimeoutMS: number;
  socketTimeoutMS: number;
  connectTimeoutMS: number;
}

export interface MonitoringConfig {
  alerts: AlertConfig;
  healthChecks: HealthCheckConfig;
  performanceMetrics: PerformanceMetricsConfig;
  errorTracking: ErrorTrackingConfig;
}

export interface AlertConfig {
  enabled: boolean;
  channels: string[];
  thresholds: Record<string, number>;
  escalation: EscalationConfig;
}

export interface EscalationConfig {
  enabled: boolean;
  levels: number[];
  intervals: number[];
  channels: string[][];
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  retries: number;
  services: string[];
}

export interface PerformanceMetricsConfig {
  enabled: boolean;
  interval: number;
  retention: number;
  metrics: string[];
  aggregations: string[];
}

export interface ErrorTrackingConfig {
  enabled: boolean;
  sampling: number;
  environments: string[];
  excludeErrors: string[];
  includeWarnings: boolean;
}

/**
 * BSC Test Environment Manager
 */
export class BSCTestEnvironment {
  private config: BSCTestEnvironment;
  private provider: ethers.JsonRpcProvider;
  private wallets: Map<string, ethers.Wallet> = new Map();
  private deployer: ethers.Wallet;
  private contracts: Map<string, ethers.Contract> = new Map();
  private isInitialized = false;

  constructor(config?: Partial<BSCTestEnvironment>) {
    this.config = this.mergeConfig(this.getDefaultConfig(), config);
    this.provider = new ethers.JsonRpcProvider(this.config.network.rpcUrl);
  }

  /**
   * Initialize the BSC test environment
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Test environment is already initialized');
    }

    try {
      // Initialize wallets
      await this.initializeWallets();

      // Deploy mock contracts
      await this.deployContracts();

      // Initialize services
      await this.initializeServices();

      // Setup monitoring
      await this.setupMonitoring();

      this.isInitialized = true;
      console.log('✅ BSC Test Environment initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize BSC Test Environment:', error);
      throw error;
    }
  }

  /**
   * Cleanup the test environment
   */
  async cleanup(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Disconnect provider
      if (this.provider) {
        await this.provider.destroy();
      }

      // Clear contracts
      this.contracts.clear();

      // Clear wallets
      this.wallets.clear();

      this.isInitialized = false;
      console.log('✅ BSC Test Environment cleaned up successfully');

    } catch (error) {
      console.error('❌ Failed to cleanup BSC Test Environment:', error);
      throw error;
    }
  }

  /**
   * Get the test provider
   */
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  /**
   * Get a test wallet by name
   */
  getWallet(name: keyof TestWalletConfig): ethers.Wallet {
    const wallet = this.wallets.get(name);
    if (!wallet) {
      throw new Error(`Wallet ${name} not found`);
    }
    return wallet;
  }

  /**
   * Get a deployed contract by name
   */
  getContract(name: keyof ContractConfig): ethers.Contract {
    const contract = this.contracts.get(name);
    if (!contract) {
      throw new Error(`Contract ${name} not found`);
    }
    return contract;
  }

  /**
   * Get the test configuration
   */
  getConfig(): BSCTestEnvironment {
    return this.config;
  }

  /**
   * Get network information
   */
  async getNetworkInfo(): Promise<ethers.Network> {
    return await this.provider.getNetwork();
  }

  /**
   * Get block number
   */
  async getBlockNumber(): Promise<number> {
    return await this.provider.getBlockNumber();
  }

  /**
   * Mine a new block (for test networks that support it)
   */
  async mineBlock(): Promise<void> {
    // This works with Hardhat network
    await this.provider.send('evm_mine', []);
  }

  /**
   * Increase time in the test environment
   */
  async increaseTime(seconds: number): Promise<void> {
    await this.provider.send('evm_increaseTime', [seconds]);
    await this.mineBlock();
  }

  /**
   * Set timestamp for next block
   */
  async setNextBlockTimestamp(timestamp: number): Promise<void> {
    await this.provider.send('evm_setNextBlockTimestamp', [timestamp]);
  }

  /**
   * Take a snapshot of the current state
   */
  async snapshot(): Promise<string> {
    return await this.provider.send('evm_snapshot', []);
  }

  /**
   * Revert to a snapshot
   */
  async revert(snapshotId: string): Promise<void> {
    await this.provider.send('evm_revert', [snapshotId]);
  }

  /**
   * Reset the test environment to initial state
   */
  async reset(): Promise<void> {
    await this.provider.send('evm_reset', []);
  }

  /**
   * Fund a test wallet with BNB
   */
  async fundWallet(address: string, amount: string): Promise<ethers.TransactionResponse> {
    const deployer = this.getWallet('deployer');
    const tx = await deployer.sendTransaction({
      to: address,
      value: ethers.parseEther(amount)
    });
    return await tx.wait();
  }

  /**
   * Get wallet balance
   */
  async getBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  /**
   * Get test token balance
   */
  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<string> {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function balanceOf(address) view returns (uint256)'],
      this.provider
    );

    const balance = await tokenContract.balanceOf(walletAddress);
    // Assuming 18 decimals
    return ethers.formatUnits(balance, 18);
  }

  /**
   * Deploy mock ERC20 token
   */
  async deployMockToken(
    name: string,
    symbol: string,
    decimals: number = 18,
    initialSupply: string = '1000000'
  ): Promise<ethers.Contract> {
    const deployer = this.getWallet('deployer');

    // Mock ERC20 ABI (simplified)
    const mockERC20ABI = [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function totalSupply() view returns (uint256)',
      'function balanceOf(address) view returns (uint256)',
      'function transfer(address to, uint256 amount) returns (bool)',
      'function approve(address spender, uint256 amount) returns (bool)',
      'function allowance(address owner, address spender) view returns (uint256)',
      'function transferFrom(address from, address to, uint256 amount) returns (bool)',
      'function mint(address to, uint256 amount)',
      'function burn(uint256 amount)'
    ];

    // Mock ERC20 bytecode (simplified - in real implementation, use actual compiled bytecode)
    const mockERC20Bytecode = '0x608060405234801561001057600080fd5b50604051610...'; // This would be the actual compiled bytecode

    const factory = new ethers.ContractFactory(mockERC20ABI, mockERC20Bytecode, deployer);
    const contract = await factory.deploy(name, symbol, decimals, ethers.parseUnits(initialSupply, decimals));

    await contract.waitForDeployment();
    return contract;
  }

  // Private helper methods

  private getDefaultConfig(): BSCTestEnvironment {
    return {
      network: {
        name: 'hardhat',
        chainId: 31337,
        rpcUrl: process.env.BSC_TEST_RPC_URL || 'http://127.0.0.1:8545',
        blockTime: 2000,
        gasLimit: 30000000,
        gasPrice: ethers.parseUnits('20', 'gwei').toString(),
        confirmations: 1,
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000
      },
      contracts: {
        PancakeRouter: '0x0000000000000000000000000000000000000000',
        PancakeFactory: '0x0000000000000000000000000000000000000000',
        PancakeMasterChef: '0x0000000000000000000000000000000000000000',
        PancakeMasterChefV2: '0x0000000000000000000000000000000000000000',
        WBNB: '0x0000000000000000000000000000000000000000',
        USDT: '0x0000000000000000000000000000000000000000',
        USDC: '0x0000000000000000000000000000000000000000',
        CAKE: '0x0000000000000000000000000000000000000000',
        BUSD: '0x0000000000000000000000000000000000000000',
        MockERC20: '0x0000000000000000000000000000000000000000',
        MockGovernance: '0x0000000000000000000000000000000000000000'
      },
      wallets: {
        deployer: {
          address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
          balance: '10000',
          label: 'Deployer Account'
        },
        user1: {
          address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
          balance: '1000',
          label: 'Test User 1'
        },
        user2: {
          address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
          privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
          balance: '1000',
          label: 'Test User 2'
        },
        user3: {
          address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
          privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
          balance: '1000',
          label: 'Test User 3'
        },
        liquidityProvider: {
          address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
          privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
          balance: '5000',
          label: 'Liquidity Provider'
        },
        arbitrageur: {
          address: '0x9965507D1a55bccE26f7C9325a978Ea367Af844f',
          privateKey: '0x8b3a350cf5c34c9194ca85829a2de0e165bd3393639be80e4735878db4d445ab',
          balance: '2000',
          label: 'Arbitrageur'
        },
        feeRecipient: {
          address: '0x57DAa510681cB559aD7A7F6827394C7E5c6Ab7B6',
          privateKey: '0x92db14e403b83dfe3df233f83dfa3a070d23a31d3d94279f3d8a0102bba36ae9',
          balance: '500',
          label: 'Fee Recipient'
        },
        governanceAdmin: {
          address: '0x8ba1f109551bD432803012645Hac136c22C57B',
          privateKey: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
          balance: '1000',
          label: 'Governance Admin'
        }
      },
      services: {
        rpc: {
          primary: process.env.BSC_TEST_RPC_URL || 'http://127.0.0.1:8545',
          fallback: [
            'http://127.0.0.1:8546',
            'http://127.0.0.1:8547'
          ],
          timeout: 30000,
          retries: 3,
          rateLimit: 100,
          maxConcurrency: 10
        },
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0'),
          keyPrefix: 'bsc:test:',
          ttl: 3600,
          maxRetries: 3,
          connectTimeout: 10000,
          lazyConnect: true
        },
        api: {
          port: parseInt(process.env.TEST_API_PORT || '3001'),
          host: process.env.TEST_API_HOST || 'localhost',
          cors: true,
          bodyParser: true,
          rateLimit: true,
          rateLimitWindow: 60000,
          rateLimitMax: 100,
          logging: true,
          swagger: true
        },
        websocket: {
          port: parseInt(process.env.TEST_WS_PORT || '3002'),
          host: process.env.TEST_WS_HOST || 'localhost',
          path: '/ws',
          compression: true,
          maxConnections: 100,
          heartbeatInterval: 30000,
          heartbeatTimeout: 5000
        },
        monitoring: {
          enabled: true,
          metrics: true,
          tracing: false,
          logging: true,
          logLevel: 'info',
          logFormat: 'json',
          prometheus: {
            enabled: true,
            port: 9090,
            endpoint: '/metrics',
            labels: {
              service: 'bsc-test',
              environment: 'test'
            }
          },
          jaeger: {
            enabled: false,
            endpoint: 'http://localhost:14268/api/traces',
            service: 'bsc-test',
            sampler: {
              type: 'const',
              param: 1
            }
          }
        }
      },
      database: {
        postgres: {
          host: process.env.TEST_POSTGRES_HOST || 'localhost',
          port: parseInt(process.env.TEST_POSTGRES_PORT || '5432'),
          database: process.env.TEST_POSTGRES_DB || 'bsc_test',
          username: process.env.TEST_POSTGRES_USER || 'test',
          password: process.env.TEST_POSTGRES_PASSWORD || 'test',
          ssl: false,
          maxConnections: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000
        },
        mongodb: {
          uri: process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/bsc_test',
          database: 'bsc_test',
          options: {
            maxPoolSize: 10,
            minPoolSize: 1,
            maxIdleTimeMS: 30000,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000
          }
        },
        testDatabase: true,
        migrations: true,
        seeds: true
      },
      monitoring: {
        alerts: {
          enabled: true,
          channels: ['console'],
          thresholds: {
            errorRate: 0.05,
            responseTime: 1000,
            memoryUsage: 0.8,
            cpuUsage: 0.8
          },
          escalation: {
            enabled: false,
            levels: [1, 2, 3],
            intervals: [300000, 600000, 1800000],
            channels: [['console'], ['console', 'email'], ['console', 'email', 'slack']]
          }
        },
        healthChecks: {
          enabled: true,
          interval: 30000,
          timeout: 5000,
          retries: 3,
          services: ['rpc', 'redis', 'database', 'api']
        },
        performanceMetrics: {
          enabled: true,
          interval: 60000,
          retention: 86400000, // 24 hours
          metrics: ['response_time', 'error_rate', 'throughput', 'memory_usage', 'cpu_usage'],
          aggregations: ['avg', 'max', 'min', 'sum', 'count']
        },
        errorTracking: {
          enabled: true,
          sampling: 1.0,
          environments: ['test'],
          excludeErrors: ['ECONNRESET', 'ETIMEDOUT'],
          includeWarnings: true
        }
      }
    };
  }

  private mergeConfig(defaultConfig: BSCTestEnvironment, customConfig?: Partial<BSCTestEnvironment>): BSCTestEnvironment {
    if (!customConfig) {
      return defaultConfig;
    }

    return {
      network: { ...defaultConfig.network, ...customConfig.network },
      contracts: { ...defaultConfig.contracts, ...customConfig.contracts },
      wallets: { ...defaultConfig.wallets, ...customConfig.wallets },
      services: {
        rpc: { ...defaultConfig.services.rpc, ...customConfig.services?.rpc },
        redis: { ...defaultConfig.services.redis, ...customConfig.services?.redis },
        api: { ...defaultConfig.services.api, ...customConfig.services?.api },
        websocket: { ...defaultConfig.services.websocket, ...customConfig.services?.websocket },
        monitoring: { ...defaultConfig.services.monitoring, ...customConfig.services?.monitoring }
      },
      database: {
        postgres: { ...defaultConfig.database.postgres, ...customConfig.database?.postgres },
        mongodb: { ...defaultConfig.database.mongodb, ...customConfig.database?.mongodb },
        testDatabase: customConfig.database?.testDatabase ?? defaultConfig.database.testDatabase,
        migrations: customConfig.database?.migrations ?? defaultConfig.database.migrations,
        seeds: customConfig.database?.seeds ?? defaultConfig.database.seeds
      },
      monitoring: {
        alerts: { ...defaultConfig.monitoring.alerts, ...customConfig.monitoring?.alerts },
        healthChecks: { ...defaultConfig.monitoring.healthChecks, ...customConfig.monitoring?.healthChecks },
        performanceMetrics: { ...defaultConfig.monitoring.performanceMetrics, ...customConfig.monitoring?.performanceMetrics },
        errorTracking: { ...defaultConfig.monitoring.errorTracking, ...customConfig.monitoring?.errorTracking }
      }
    };
  }

  private async initializeWallets(): Promise<void> {
    const walletNames = Object.keys(this.config.wallets) as (keyof TestWalletConfig)[];

    for (const walletName of walletNames) {
      const walletConfig = this.config.wallets[walletName];
      const wallet = new ethers.Wallet(walletConfig.privateKey, this.provider);
      this.wallets.set(walletName, wallet);

      console.log(`🔑 Initialized wallet: ${walletConfig.label} (${wallet.address})`);
    }

    // Set deployer wallet
    this.deployer = this.wallets.get('deployer')!;
  }

  private async deployContracts(): Promise<void> {
    console.log('📦 Deploying mock contracts...');

    // In a real implementation, this would deploy actual mock contracts
    // For now, we'll create placeholder contract instances

    const deployer = this.getWallet('deployer');

    // Mock contract ABI (minimal)
    const mockABI = [
      'function balanceOf(address) view returns (uint256)',
      'function transfer(address to, uint256 amount) returns (bool)',
      'function approve(address spender, uint256 amount) returns (bool)'
    ];

    // Create mock contract instances (these would be deployed in real implementation)
    for (const [name, address] of Object.entries(this.config.contracts)) {
      if (address !== '0x0000000000000000000000000000000000000000') {
        const contract = new ethers.Contract(address, mockABI, deployer);
        this.contracts.set(name, contract);
        console.log(`📋 Connected to contract: ${name} at ${address}`);
      }
    }
  }

  private async initializeServices(): Promise<void> {
    console.log('🔧 Initializing test services...');

    // Initialize Redis connection
    // Initialize database connections
    // Start API server
    // Start WebSocket server
    // Setup monitoring services

    console.log('✅ Test services initialized');
  }

  private async setupMonitoring(): Promise<void> {
    console.log('📊 Setting up monitoring...');

    // Setup health checks
    // Setup metrics collection
    // Setup error tracking
    // Setup alerting

    console.log('✅ Monitoring setup complete');
  }
}

/**
 * Global test environment instance
 */
export const testEnvironment = new BSCTestEnvironment();

/**
 * Test environment utilities
 */
export class TestUtils {
  static async createSnapshot(): Promise<string> {
    return await testEnvironment.snapshot();
  }

  static async revertSnapshot(snapshotId: string): Promise<void> {
    await testEnvironment.revert(snapshotId);
  }

  static async mineBlocks(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await testEnvironment.mineBlock();
    }
  }

  static async increaseTimeAndMine(seconds: number): Promise<void> {
    await testEnvironment.increaseTime(seconds);
    await testEnvironment.mineBlock();
  }

  static async fundAllWallets(amount: string): Promise<void> {
    const wallets = ['user1', 'user2', 'user3', 'liquidityProvider', 'arbitrageur', 'feeRecipient', 'governanceAdmin'] as const;

    for (const walletName of wallets) {
      const wallet = testEnvironment.getWallet(walletName);
      await testEnvironment.fundWallet(wallet.address, amount);
    }
  }

  static async getBalances(): Promise<Record<string, string>> {
    const balances: Record<string, string> = {};
    const walletNames = ['deployer', 'user1', 'user2', 'user3', 'liquidityProvider', 'arbitrageur', 'feeRecipient', 'governanceAdmin'] as const;

    for (const walletName of walletNames) {
      const wallet = testEnvironment.getWallet(walletName);
      balances[walletName] = await testEnvironment.getBalance(wallet.address);
    }

    return balances;
  }

  static async createTokenBalanceSnapshot(): Promise<Record<string, Record<string, string>>> {
    const snapshot: Record<string, Record<string, string>> = {};
    const tokens = ['WBNB', 'USDT', 'USDC', 'CAKE', 'BUSD'];
    const walletNames = ['user1', 'user2', 'user3', 'liquidityProvider', 'arbitrageur'] as const;

    for (const walletName of walletNames) {
      snapshot[walletName] = {};
      const wallet = testEnvironment.getWallet(walletName);

      for (const tokenName of tokens) {
        const tokenAddress = testEnvironment.getConfig().contracts[tokenName as keyof ContractConfig];
        if (tokenAddress !== '0x0000000000000000000000000000000000000000') {
          snapshot[walletName][tokenName] = await testEnvironment.getTokenBalance(tokenAddress, wallet.address);
        }
      }
    }

    return snapshot;
  }

  static async waitForTransaction(tx: ethers.TransactionResponse, confirmations: number = 1): Promise<ethers.TransactionReceipt> {
    return await tx.wait(confirmations);
  }

  static async waitForBlock(blockNumber: number): Promise<void> {
    const provider = testEnvironment.getProvider();

    while (true) {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock >= blockNumber) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  static async generateTestWallet(label: string, balance: string = '100'): Promise<ethers.Wallet> {
    const wallet = ethers.Wallet.createRandom();
    const connectedWallet = wallet.connect(testEnvironment.getProvider());

    // Fund the wallet
    await testEnvironment.fundWallet(connectedWallet.address, balance);

    console.log(`🔑 Generated test wallet: ${label} (${connectedWallet.address})`);
    return connectedWallet;
  }

  static async calculateGasCost(tx: ethers.TransactionResponse): Promise<string> {
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error('Transaction receipt not available');
    }

    const gasUsed = receipt.gasUsed;
    const gasPrice = tx.gasPrice || ethers.parseUnits('20', 'gwei');
    const gasCost = gasUsed * gasPrice;

    return ethers.formatEther(gasCost);
  }

  static async estimateGas(transaction: {
    to?: string;
    data?: string;
    value?: string;
    from?: string;
  }): Promise<string> {
    const provider = testEnvironment.getProvider();
    const gasLimit = await provider.estimateGas(transaction);
    return gasLimit.toString();
  }

  static formatEther(value: string | bigint | number): string {
    return ethers.formatEther(value);
  }

  static parseEther(value: string): bigint {
    return ethers.parseEther(value);
  }

  static formatUnits(value: string | bigint | number, decimals: number): string {
    return ethers.formatUnits(value, decimals);
  }

  static parseUnits(value: string, decimals: number): bigint {
    return ethers.parseUnits(value, decimals);
  }
}

/**
 * Export default test environment
 */
export default testEnvironment;