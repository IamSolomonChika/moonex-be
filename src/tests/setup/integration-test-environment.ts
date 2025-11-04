/**
 * Integration Test Environment for Viem Migration
 * Provides comprehensive test environment setup for integration testing
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  fallback,
  Address,
  Hash,
  Chain,
  Account,
  PublicClient,
  WalletClient,
  Transport,
  WebSocketTransport
} from 'viem';
import { bsc, bscTestnet, sepolia } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';

// Test environment types
export interface TestEnvironment {
  name: string;
  chain: Chain;
  publicClient: PublicClient<Transport, Chain>;
  walletClient: WalletClient<Transport, Chain>;
  testAccount: Account;
  isTestnet: boolean;
  supportsWebSocket: boolean;
  customRpcUrls?: string[];
  webSocketUrl?: string;
}

export interface IntegrationTestConfig {
  environments: TestEnvironment[];
  defaultEnvironment: string;
  parallelExecution: boolean;
  timeoutMs: number;
  retryAttempts: number;
  enableMetrics: boolean;
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface TestDataProvider {
  getTestAccounts(count?: number): Account[];
  getRandomAddress(): Address;
  getRandomHash(): Hash;
  getKnownTokens(): Record<string, Address>;
  getKnownContracts(): Record<string, Address>;
  getTestData(type: string): any;
}

/**
 * Integration Test Environment Manager
 */
export class IntegrationTestEnvironmentManager {
  private environments: Map<string, TestEnvironment> = new Map();
  private config: IntegrationTestConfig;
  private dataProvider: TestDataProvider;

  constructor(config?: Partial<IntegrationTestConfig>) {
    this.config = {
      environments: [],
      defaultEnvironment: 'bsc-testnet',
      parallelExecution: false,
      timeoutMs: 30000,
      retryAttempts: 3,
      enableMetrics: true,
      enableLogging: true,
      logLevel: 'info',
      ...config
    };

    this.dataProvider = new ViemTestDataProvider();
    this.initializeEnvironments();
  }

  /**
   * Initialize test environments
   */
  private async initializeEnvironments(): Promise<void> {
    const environmentConfigs = [
      {
        name: 'bsc-testnet',
        chain: bscTestnet,
        rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
        webSocketUrl: 'wss://data-seed-prebsc-1-s1.binance.org:8545/',
        isTestnet: true,
        supportsWebSocket: true
      },
      {
        name: 'bsc-mainnet',
        chain: bsc,
        rpcUrls: ['https://bsc-dataseed1.binance.org/'],
        webSocketUrl: 'wss://bsc-ws-node.nariox.org:443',
        isTestnet: false,
        supportsWebSocket: true
      },
      {
        name: 'sepolia-testnet',
        chain: sepolia,
        rpcUrls: ['https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'],
        webSocketUrl: 'wss://sepolia.infura.io/ws/v3/9aa3d95b3bc440fa88ea12eaa4456161',
        isTestnet: true,
        supportsWebSocket: true
      }
    ];

    for (const envConfig of environmentConfigs) {
      const environment = await this.createTestEnvironment(envConfig);
      this.environments.set(envConfig.name, environment);
    }

    this.config.environments = Array.from(this.environments.values());
  }

  /**
   * Create a test environment
   */
  private async createTestEnvironment(config: any): Promise<TestEnvironment> {
    // Create test account
    const testAccount = mnemonicToAccount('test test test test test test test test test test test junk');

    // Create transport with fallback
    const transports = config.rpcUrls.map((url: string) => http(url));
    if (config.webSocketUrl && config.supportsWebSocket) {
      transports.push(webSocket(config.webSocketUrl));
    }

    const transport = fallback(transports);

    // Create clients
    const publicClient = createPublicClient({
      chain: config.chain,
      transport
    });

    const walletClient = createWalletClient({
      chain: config.chain,
      transport,
      account: testAccount
    });

    return {
      name: config.name,
      chain: config.chain,
      publicClient,
      walletClient,
      testAccount,
      isTestnet: config.isTestnet,
      supportsWebSocket: config.supportsWebSocket,
      customRpcUrls: config.rpcUrls,
      webSocketUrl: config.webSocketUrl
    };
  }

  /**
   * Get a specific test environment
   */
  getEnvironment(name?: string): TestEnvironment {
    const envName = name || this.config.defaultEnvironment;
    const environment = this.environments.get(envName);

    if (!environment) {
      throw new Error(`Test environment '${envName}' not found`);
    }

    return environment;
  }

  /**
   * Get all available environments
   */
  getAllEnvironments(): TestEnvironment[] {
    return this.config.environments;
  }

  /**
   * Get testnet environments only
   */
  getTestnetEnvironments(): TestEnvironment[] {
    return this.config.environments.filter(env => env.isTestnet);
  }

  /**
   * Get mainnet environments only
   */
  getMainnetEnvironments(): TestEnvironment[] {
    return this.config.environments.filter(env => !env.isTestnet);
  }

  /**
   * Run tests across multiple environments
   */
  async runAcrossEnvironments<T>(
    testFn: (env: TestEnvironment) => Promise<T>,
    environmentNames?: string[]
  ): Promise<Array<{ environment: string; result: T; error?: any }>> {
    const environments = environmentNames
      ? environmentNames.map(name => this.getEnvironment(name))
      : this.getTestnetEnvironments(); // Default to testnets

    if (this.config.parallelExecution) {
      const promises = environments.map(async (env) => {
        try {
          const result = await Promise.race([
            testFn(env),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Test timeout')), this.config.timeoutMs)
            )
          ]) as T;

          return { environment: env.name, result };
        } catch (error) {
          return { environment: env.name, error };
        }
      });

      return Promise.all(promises);
    } else {
      const results = [];
      for (const env of environments) {
        try {
          const result = await Promise.race([
            testFn(env),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Test timeout')), this.config.timeoutMs)
            )
          ]) as T;

          results.push({ environment: env.name, result });
        } catch (error) {
          results.push({ environment: env.name, error });
        }
      }
      return results;
    }
  }

  /**
   * Validate environment connectivity
   */
  async validateEnvironment(name?: string): Promise<boolean> {
    const environment = this.getEnvironment(name);

    try {
      const blockNumber = await environment.publicClient.getBlockNumber();
      return typeof blockNumber === 'bigint' && blockNumber > 0n;
    } catch (error) {
      if (this.config.enableLogging) {
        console.error(`Environment ${environment.name} validation failed:`, error);
      }
      return false;
    }
  }

  /**
   * Validate all environments
   */
  async validateAllEnvironments(): Promise<Array<{ name: string; valid: boolean; error?: any }>> {
    const results = [];

    for (const env of this.config.environments) {
      try {
        const valid = await this.validateEnvironment(env.name);
        results.push({ name: env.name, valid });
      } catch (error) {
        results.push({ name: env.name, valid: false, error });
      }
    }

    return results;
  }

  /**
   * Get test data provider
   */
  getDataProvider(): TestDataProvider {
    return this.dataProvider;
  }

  /**
   * Get configuration
   */
  getConfig(): IntegrationTestConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<IntegrationTestConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Cleanup environments
   */
  async cleanup(): Promise<void> {
    // Close WebSocket connections if any
    for (const env of this.environments.values()) {
      if (env.publicClient.transport && 'close' in env.publicClient.transport) {
        try {
          await (env.publicClient.transport as any).close();
        } catch (error) {
          // Ignore cleanup errors
        }
      }

      if (env.walletClient.transport && 'close' in env.walletClient.transport) {
        try {
          await (env.walletClient.transport as any).close();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }

    this.environments.clear();
  }
}

/**
 * Viem Test Data Provider
 */
export class ViemTestDataProvider implements TestDataProvider {
  private testAccounts: Account[] = [];
  private knownTokens: Record<string, Address> = {
    // BSC Testnet Tokens
    WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
    BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
    CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' as Address,
    USDT: '0x55d398326f99059fF775485246999027B3197955' as Address,

    // PancakeSwap Contracts
    PANCAKE_ROUTER: '0x10ED43C718714eb63d5aA57B78B54704E256024E' as Address,
    PANCAKE_FACTORY: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as Address,
    MASTER_CHEF: '0x73feaa1eE314F8c655E354234017bE2193C9E24E' as Address
  };

  private knownContracts: Record<string, Address> = {
    // BSC Contracts
    BSC_BRIDGE: '0x0000000000000000000000000000000000001004' as Address,
    VALIDATOR: '0x0000000000000000000000000000000000001002' as Address,

    // System Contracts
    BEACON: '0x0000000000000000000000000000000000001000' as Address,
    LIGHT_CLIENT: '0x0000000000000000000000000000000000001001' as Address
  };

  constructor() {
    this.initializeTestAccounts();
  }

  private initializeTestAccounts(): void {
    const mnemonics = [
      'test test test test test test test test test test test junk',
      'test test test test test test test test test test test two',
      'test test test test test test test test test test test three',
      'test test test test test test test test test test test four',
      'test test test test test test test test test test test five'
    ];

    this.testAccounts = mnemonics.map((mnemonic, index) =>
      mnemonicToAccount(mnemonic, { addressIndex: index })
    );
  }

  getTestAccounts(count: number = 1): Account[] {
    return this.testAccounts.slice(0, Math.min(count, this.testAccounts.length));
  }

  getRandomAddress(): Address {
    return `0x${Array.from({ length: 40 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}` as Address;
  }

  getRandomHash(): Hash {
    return `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}` as Hash;
  }

  getKnownTokens(): Record<string, Address> {
    return { ...this.knownTokens };
  }

  getKnownContracts(): Record<string, Address> {
    return { ...this.knownContracts };
  }

  getTestData(type: string): any {
    switch (type) {
      case 'swap':
        return {
          tokenIn: this.knownTokens.WBNB,
          tokenOut: this.knownTokens.BUSD,
          amountIn: '1000000000000000000', // 1 token
          slippageTolerancePercent: 0.5
        };

      case 'liquidity':
        return {
          tokenA: this.knownTokens.WBNB,
          tokenB: this.knownTokens.BUSD,
          amountADesired: '1000000000000000000', // 1 token
          amountBDesired: '100000000000000000000' // 100 tokens
        };

      case 'approval':
        return {
          token: this.knownTokens.BUSD,
          spender: this.getRandomAddress(),
          amount: '1000000000000000000000' // 1000 tokens
        };

      case 'governance':
        return {
          proposalId: Math.floor(Math.random() * 1000),
          support: true,
          votingPower: '100000000000000000000'
        };

      case 'farm':
        return {
          farmAddress: this.knownTokens.MASTER_CHEF,
          stakeAmount: '10000000000000000000', // 10 tokens
          stakeToken: this.knownTokens.CAKE
        };

      default:
        return null;
    }
  }

  addKnownToken(symbol: string, address: Address): void {
    this.knownTokens[symbol] = address;
  }

  addKnownContract(name: string, address: Address): void {
    this.knownContracts[name] = address;
  }
}

/**
 * Integration Test Utilities
 */
export class IntegrationTestUtils {
  static async waitForBlock(
    client: PublicClient<any, any>,
    targetBlockNumber?: bigint,
    timeoutMs: number = 30000
  ): Promise<bigint> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const currentBlock = await client.getBlockNumber();

      if (!targetBlockNumber || currentBlock >= targetBlockNumber) {
        return currentBlock;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Timeout waiting for block ${targetBlockNumber}`);
  }

  static async retryOperation<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        }
      }
    }

    throw lastError;
  }

  static async measureGasUsage<T>(
    operation: () => Promise<T>,
    client: PublicClient<any, any>
  ): Promise<{ result: T; gasUsed: bigint; gasPrice: bigint; gasCost: bigint }> {
    const gasPrice = await client.getGasPrice();
    const startGas = await client.getBalance(client.account.address);

    const result = await operation();

    const endGas = await client.getBalance(client.account.address);
    const gasUsed = startGas - endGas;
    const gasCost = gasUsed * gasPrice;

    return { result, gasUsed, gasPrice, gasCost };
  }

  static generateTestPayload(type: string, overrides: any = {}): any {
    const basePayloads = {
      'swap': {
        tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        amountIn: '100000000000000000',
        slippageTolerancePercent: 0.5
      },
      'liquidity': {
        tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        tokenB: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        amountADesired: '100000000000000000',
        amountBDesired: '10000000000000000000'
      },
      'approval': {
        token: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        spender: '0x0000000000000000000000000000000000000000',
        amount: '100000000000000000000'
      }
    };

    const basePayload = basePayloads[type as keyof typeof basePayloads] || {};
    return { ...basePayload, ...overrides };
  }

  static assertValidAddress(address: Address): void {
    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  }

  static assertValidHash(hash: Hash): void {
    expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  }

  static assertValidAmount(amount: bigint): void {
    expect(typeof amount).toBe('bigint');
    expect(amount).toBeGreaterThanOrEqual(0n);
  }

  static async assertTransactionSuccess(
    client: PublicClient<any, any>,
    transactionHash: Hash
  ): Promise<void> {
    const receipt = await client.waitForTransactionReceipt({ hash: transactionHash });
    expect(receipt.status).toBe('success');
  }
}

// Default export
export default {
  IntegrationTestEnvironmentManager,
  ViemTestDataProvider,
  IntegrationTestUtils
};