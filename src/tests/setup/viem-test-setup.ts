/**
 * Viem Test Setup and Utilities
 * Provides common setup functions and utilities for Viem-based testing
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  Address,
  Hash,
  Chain,
  Account,
  PublicClient,
  WalletClient,
  Transport,
  TestClient,
  createTestClient,
  fallback,
  webSocket,
  WebSocketTransport
} from 'viem';
import { bsc, bscTestnet, sepolia } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';
import { viemMockContractManager } from '../mocks/viem-mock-contracts.js';

/**
 * Test configuration interface
 */
export interface TestConfig {
  chain: Chain;
  transport: string;
  useWebSocket?: boolean;
  enableForking?: boolean;
  forkBlockNumber?: bigint;
  mnemonic?: string;
  accountIndex?: number;
}

/**
 * Test clients interface
 */
export interface TestClients {
  publicClient: PublicClient<Transport, Chain>;
  walletClient: WalletClient<Transport, Chain>;
  testAccount: Account;
  testClient?: TestClient;
}

/**
 * BSC test addresses
 */
export const BSC_TEST_ADDRESSES = {
  WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
  BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
  CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' as Address,
  USDT: '0x55d398326f99059fF775485246999027B3197955' as Address,
  PANCAKE_ROUTER: '0x10ED43C718714eb63d5aA57B78B54704E256024E' as Address,
  PANCAKE_FACTORY: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as Address,
  MASTER_CHEF: '0x73feaa1eE314F8c655E354234017bE2193C9E24E' as Address,
  BNB_BUSD_PAIR: '0x58F876857a02D6762E0101bb5C46A8c1ED44D16' as Address,
  CAKE_BNB_PAIR: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' as Address
};

/**
 * Default test configurations
 */
export const TEST_CONFIGS = {
  BSC_TESTNET: {
    chain: bscTestnet,
    transport: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    useWebSocket: false,
    mnemonic: 'test test test test test test test test test test test junk',
    accountIndex: 0
  } as TestConfig,

  BSC_MAINNET: {
    chain: bsc,
    transport: 'https://bsc-dataseed1.binance.org/',
    useWebSocket: false,
    mnemonic: 'test test test test test test test test test test test junk',
    accountIndex: 0
  } as TestConfig,

  SEPOLIA: {
    chain: sepolia,
    transport: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    useWebSocket: false,
    mnemonic: 'test test test test test test test test test test test junk',
    accountIndex: 0
  } as TestConfig
};

/**
 * Create test clients for Viem testing
 */
export function createTestClients(config: Partial<TestConfig> = {}): TestClients {
  const finalConfig = { ...TEST_CONFIGS.BSC_TESTNET, ...config };

  // Create account
  const account = mnemonicToAccount(finalConfig.mnemonic!, { addressIndex: finalConfig.accountIndex });

  // Create public client
  let publicClient: PublicClient<Transport, Chain>;

  if (finalConfig.useWebSocket) {
    publicClient = createPublicClient({
      chain: finalConfig.chain,
      transport: webSocket(finalConfig.transport.replace('https://', 'wss://'))
    });
  } else {
    publicClient = createPublicClient({
      chain: finalConfig.chain,
      transport: http(finalConfig.transport)
    });
  }

  // Create wallet client
  const walletClient = createWalletClient({
    chain: finalConfig.chain,
    transport: finalConfig.useWebSocket
      ? webSocket(finalConfig.transport.replace('https://', 'wss://'))
      : http(finalConfig.transport),
    account
  });

  // Create test client (for anvil/hardhat style testing)
  let testClient: TestClient | undefined;
  if (finalConfig.enableForking) {
    testClient = createTestClient({
      chain: finalConfig.chain,
      mode: 'anvil',
      fork: {
        transport: http(finalConfig.transport),
        blockNumber: finalConfig.forkBlockNumber
      }
    });
  }

  return {
    publicClient,
    walletClient,
    testAccount: account,
    testClient
  };
}

/**
 * Setup BSC test environment
 */
export function setupBSCTestEnv(): TestClients {
  return createTestClients(TEST_CONFIGS.BSC_TESTNET);
}

/**
 * Setup BSC mainnet test environment (read-only)
 */
export function setupBSCMainnetTestEnv(): TestClients {
  return createTestClients(TEST_CONFIGS.BSC_MAINNET);
}

/**
 * Setup local fork environment
 */
export function setupForkTestEnv(blockNumber?: bigint): TestClients {
  return createTestClients({
    ...TEST_CONFIGS.BSC_TESTNET,
    enableForking: true,
    forkBlockNumber: blockNumber
  });
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(
  client: PublicClient<Transport, Chain>,
  hash: Hash,
  maxWaitTime: number = 30000
): Promise<any> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const receipt = await client.getTransactionReceipt({ hash });
      if (receipt) {
        return receipt;
      }
    } catch (error) {
      // Transaction might not be indexed yet
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`Transaction ${hash} was not confirmed within ${maxWaitTime}ms`);
}

/**
 * Skip blocks for testing
 */
export async function skipBlocks(
  client: TestClient,
  count: number
): Promise<void> {
  if (!client) {
    throw new Error('Test client not available. Use setupForkTestEnv() to create a test client.');
  }

  for (let i = 0; i < count; i++) {
    await client.mine({ blocks: 1 });
  }
}

/**
 * Set account balance for testing
 */
export async function setBalance(
  client: TestClient,
  address: Address,
  balance: bigint
): Promise<void> {
  if (!client) {
    throw new Error('Test client not available. Use setupForkTestEnv() to create a test client.');
  }

  await client.setBalance({
    address,
    value: balance
  });
}

/**
 * Create mock token contract interaction
 */
export function createMockTokenContract(
  client: PublicClient<Transport, Chain>,
  address: Address
) {
  return viemMockContractManager.getMockERC20(address);
}

/**
 * Create mock PancakeSwap router interaction
 */
export function createMockPancakeRouter(
  client: PublicClient<Transport, Chain>,
  address?: Address
) {
  return viemMockContractManager.getMockPancakeRouter(address);
}

/**
 * Create mock PancakeSwap factory interaction
 */
export function createMockPancakeFactory(
  client: PublicClient<Transport, Chain>,
  address?: Address
) {
  return viemMockContractManager.getMockPancakeFactory(address);
}

/**
 * Create mock MasterChef interaction
 */
export function createMockMasterChef(
  client: PublicClient<Transport, Chain>,
  address?: Address
) {
  return viemMockContractManager.getMockMasterChef(address);
}

/**
 * Test data generators
 */
export const TestDataGenerators = {
  /**
   * Generate random address
   */
  randomAddress(): Address {
    return `0x${Array.from({ length: 40 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}` as Address;
  },

  /**
   * Generate random hash
   */
  randomHash(): Hash {
    return `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}` as Hash;
  },

  /**
   * Generate random amount
   */
  randomAmount(min: bigint = 1n, max: bigint = parseEther('1000')): bigint {
    const range = Number(max - min);
    const random = Math.floor(Math.random() * range);
    return min + BigInt(random);
  },

  /**
   * Generate test account
   */
  generateTestAccount(index: number = 0): Account {
    return mnemonicToAccount(`test test test test test test test test test test test ${index} junk`);
  }
};

/**
 * Test assertions helpers
 */
export const TestAssertions = {
  /**
   * Assert valid address
   */
  isValidAddress(address: Address): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  },

  /**
   * Assert valid hash
   */
  isValidHash(hash: Hash): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test(hash);
  },

  /**
   * Assert positive bigint
   */
  isPositiveBigInt(value: bigint): boolean {
    return value > 0n;
  },

  /**
   * Assert valid block number
   */
  isValidBlockNumber(blockNumber: bigint): boolean {
    return blockNumber > 0n && blockNumber < 2n ** 256n;
  }
};

/**
 * Performance testing utilities
 */
export const PerformanceUtils = {
  /**
   * Measure execution time
   */
  async measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; time: number }> {
    const start = Date.now();
    const result = await fn();
    const time = Date.now() - start;
    return { result, time };
  },

  /**
   * Benchmark function
   */
  async benchmark<T>(
    fn: () => Promise<T>,
    iterations: number = 10
  ): Promise<{ averageTime: number; minTime: number; maxTime: number; results: T[] }> {
    const times: number[] = [];
    const results: T[] = [];

    for (let i = 0; i < iterations; i++) {
      const { result, time } = await this.measureTime(fn);
      times.push(time);
      results.push(result);
    }

    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    return { averageTime, minTime, maxTime, results };
  }
};

/**
 * Error handling utilities
 */
export const ErrorUtils = {
  /**
   * Expect specific error type
   */
  async expectError<T extends Error>(
    fn: () => Promise<any>,
    ErrorClass: new (...args: any[]) => T,
    errorMessage?: string
  ): Promise<T> {
    try {
      await fn();
      throw new Error(`Expected ${ErrorClass.name} to be thrown`);
    } catch (error) {
      if (!(error instanceof ErrorClass)) {
        throw new Error(`Expected ${ErrorClass.name} but got ${error?.constructor?.name}`);
      }

      if (errorMessage && !error.message.includes(errorMessage)) {
        throw new Error(`Expected error message to include "${errorMessage}" but got "${error.message}"`);
      }

      return error as T;
    }
  },

  /**
   * Expect any error
   */
  async expectAnyError(
    fn: () => Promise<any>,
    errorMessage?: string
  ): Promise<Error> {
    try {
      await fn();
      throw new Error('Expected an error to be thrown');
    } catch (error) {
      if (!(error instanceof Error)) {
        throw new Error('Expected an Error instance');
      }

      if (errorMessage && !error.message.includes(errorMessage)) {
        throw new Error(`Expected error message to include "${errorMessage}" but got "${error.message}"`);
      }

      return error;
    }
  }
};

/**
 * Global test setup
 */
export function globalTestSetup() {
  // Set default timeout for tests
  jest.setTimeout(30000);

  // Mock console methods to reduce noise
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

  // Setup process environment for testing
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'file:./test.db';
}

/**
 * Global test teardown
 */
export function globalTestTeardown() {
  // Restore console if needed
  // Clean up any global state
}

// Export default configuration
export default {
  createTestClients,
  setupBSCTestEnv,
  setupBSCMainnetTestEnv,
  setupForkTestEnv,
  BSC_TEST_ADDRESSES,
  TEST_CONFIGS,
  waitForTransaction,
  skipBlocks,
  setBalance,
  createMockTokenContract,
  createMockPancakeRouter,
  createMockPancakeFactory,
  createMockMasterChef,
  TestDataGenerators,
  TestAssertions,
  PerformanceUtils,
  ErrorUtils,
  globalTestSetup,
  globalTestTeardown
};