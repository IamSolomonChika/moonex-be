# 🎯 Viem 2.38.5 Best Practices

**Professional Development Guidelines for BSC DEX Backend**

## 📋 Table of Contents

1. [Architecture Patterns](#architecture-patterns)
2. [Code Organization](#code-organization)
3. [Performance Optimization](#performance-optimization)
4. [Security Guidelines](#security-guidelines)
5. [Error Handling](#error-handling)
6. [Testing Strategies](#testing-strategies)
7. [Monitoring & Debugging](#monitoring--debugging)
8. [Deployment Guidelines](#deployment-guidelines)

## 🏗️ Architecture Patterns

### 1. Service Layer Pattern

```typescript
// src/services/base.service.ts
export abstract class BaseService {
  constructor(
    protected readonly publicClient: PublicClient,
    protected readonly walletClient?: WalletClient
  ) {}

  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delayMs = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          throw lastError;
        }

        // Exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, delayMs * Math.pow(2, attempt - 1))
        );
      }
    }

    throw lastError!;
  }
}

// src/services/token.service.ts
export class TokenService extends BaseService {
  async getBalance(tokenAddress: Address, walletAddress: Address): Promise<bigint> {
    return this.executeWithRetry(async () => {
      return await this.publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [walletAddress]
      });
    });
  }
}
```

### 2. Repository Pattern

```typescript
// src/repositories/token.repository.ts
export class TokenRepository {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly cache: CacheService
  ) {}

  async findByAddress(address: Address): Promise<Token | null> {
    // Check cache first
    const cached = await this.cache.get<Token>(`token:${address}`);
    if (cached) return cached;

    try {
      const [name, symbol, decimals, totalSupply] = await this.publicClient.multicall({
        contracts: [
          { address, abi: ERC20_ABI, functionName: 'name' },
          { address, abi: ERC20_ABI, functionName: 'symbol' },
          { address, abi: ERC20_ABI, functionName: 'decimals' },
          { address, abi: ERC20_ABI, functionName: 'totalSupply' }
        ]
      });

      const token = {
        address,
        name: name.result || 'Unknown',
        symbol: symbol.result || 'UNKNOWN',
        decimals: decimals.result || 18,
        totalSupply: totalSupply.result || 0n
      };

      // Cache for 5 minutes
      await this.cache.set(`token:${address}`, token, 300);
      return token;
    } catch (error) {
      console.warn(`Failed to fetch token info for ${address}:`, error);
      return null;
    }
  }
}
```

### 3. Factory Pattern for Clients

```typescript
// src/factories/client.factory.ts
export class ClientFactory {
  private static instances = new Map<string, PublicClient>();

  static getPublicClient(chainName: SupportedChain): PublicClient {
    const key = `public:${chainName}`;

    if (!this.instances.has(key)) {
      const client = createPublicClient({
        chain: CHAINS[chainName],
        transport: http(this.getRpcUrl(chainName))
      });

      this.instances.set(key, client);
    }

    return this.instances.get(key)!;
  }

  static createWalletClient(
    chainName: SupportedChain,
    privateKey: `0x${string}`
  ): WalletClient {
    return createWalletClient({
      account: privateKeyToAccount(privateKey),
      chain: CHAINS[chainName],
      transport: http(this.getRpcUrl(chainName))
    });
  }

  private static getRpcUrl(chainName: SupportedChain): string {
    const urls = {
      bsc: process.env.BSC_RPC_URL,
      bscTestnet: process.env.BSC_TESTNET_RPC_URL
    };

    const url = urls[chainName];
    if (!url) {
      throw new Error(`No RPC URL configured for chain: ${chainName}`);
    }

    return url;
  }
}
```

## 📁 Code Organization

### Directory Structure

```
src/
├── config/
│   ├── chains.ts          # Chain configurations
│   ├── contracts.ts       # Contract ABIs and addresses
│   ├── viem.ts           # Viem client configurations
│   └── env.ts            # Environment variables
├── services/
│   ├── base.service.ts   # Base service class
│   ├── token.service.ts  # Token operations
│   ├── swap.service.ts   # Swap operations
│   └── liquidity.service.ts # Liquidity operations
├── repositories/
│   ├── token.repository.ts
│   ├── swap.repository.ts
│   └── liquidity.repository.ts
├── utils/
│   ├── viem.helpers.ts   # Viem utility functions
│   ├── validation.ts     # Input validation
│   ├── formatting.ts     # Data formatting
│   ├── cache.ts          # Caching utilities
│   └── retry.ts          # Retry logic
├── types/
│   ├── viem.types.ts     # Viem-specific types
│   ├── api.types.ts      # API response types
│   └── contract.types.ts # Contract interaction types
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

### Naming Conventions

```typescript
// Types - PascalCase with descriptive names
type TokenInfo = {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
};

type SwapQuote = {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  minimumAmountOut: bigint;
  priceImpact: number;
};

// Functions - camelCase with descriptive verbs
async function getSwapQuote(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: string
): Promise<SwapQuote> {}

async function validateAndFormatAddress(address: string): Promise<Address> {}

// Constants - UPPER_SNAKE_CASE
const BSC_RPC_URL = 'https://bsc-dataseed1.binance.org/';
const DEFAULT_SLIPPAGE_TOLERANCE = 0.5; // 0.5%
const MAX_RETRIES = 3;

// Classes - PascalCase
class TokenService {}
class SwapRepository {}
class ViemHelper {}
```

## ⚡ Performance Optimization

### 1. Multicall Optimization

```typescript
// src/utils/multicall.ts
export class MulticallOptimizer {
  static async batchTokenInfo(tokens: Address[]): Promise<TokenInfo[]> {
    const contracts = tokens.flatMap(address => [
      {
        address,
        abi: ERC20_ABI,
        functionName: 'name' as const
      },
      {
        address,
        abi: ERC20_ABI,
        functionName: 'symbol' as const
      },
      {
        address,
        abi: ERC20_ABI,
        functionName: 'decimals' as const
      }
    ]);

    const results = await publicClient.multicall({ contracts });

    // Group results by token
    const tokenInfos: TokenInfo[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const nameResult = results[i * 3];
      const symbolResult = results[i * 3 + 1];
      const decimalsResult = results[i * 3 + 2];

      tokenInfos.push({
        address: tokens[i],
        name: nameResult.result || 'Unknown',
        symbol: symbolResult.result || 'UNKNOWN',
        decimals: decimalsResult.result || 18
      });
    }

    return tokenInfos;
  }
}
```

### 2. Connection Pooling

```typescript
// src/utils/connection-pool.ts
export class ConnectionPool {
  private pools = new Map<string, PublicClient[]>();
  private readonly maxPoolSize = 5;
  private readonly minPoolSize = 2;

  async getClient(chainName: SupportedChain): Promise<PublicClient> {
    const pool = this.pools.get(chainName) || [];

    if (pool.length > 0) {
      return pool.pop()!;
    }

    // Create new client if pool is empty
    return createPublicClient({
      chain: CHAINS[chainName],
      transport: http(this.getRpcUrl(chainName))
    });
  }

  releaseClient(chainName: SupportedChain, client: PublicClient): void {
    const pool = this.pools.get(chainName) || [];

    if (pool.length < this.maxPoolSize) {
      pool.push(client);
      this.pools.set(chainName, pool);
    }
  }
}
```

### 3. Smart Caching

```typescript
// src/utils/smart-cache.ts
export class SmartCache<T> {
  private cache = new Map<string, { data: T; expiry: number; hits: number }>();
  private readonly defaultTTL: number;
  private readonly maxSize: number;

  constructor(defaultTTL = 300000, maxSize = 1000) {
    this.defaultTTL = defaultTTL;
    this.maxSize = maxSize;
  }

  async getOrSet<K>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.cache.get(key);

    if (cached && cached.expiry > Date.now()) {
      cached.hits++;
      return cached.data;
    }

    const data = await factory();
    this.set(key, data, ttl);

    return data;
  }

  private set(key: string, data: T, ttl = this.defaultTTL): void {
    // Clean up if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLeastUsed();
    }

    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
      hits: 0
    });
  }

  private evictLeastUsed(): void {
    let leastUsed: [string, { data: T; expiry: number; hits: number }] | null = null;

    for (const [key, value] of this.cache.entries()) {
      if (!leastUsed || value.hits < leastUsed[1].hits) {
        leastUsed = [key, value];
      }
    }

    if (leastUsed) {
      this.cache.delete(leastUsed[0]);
    }
  }
}
```

## 🔒 Security Guidelines

### 1. Private Key Management

```typescript
// src/utils/security.ts
export class SecureKeyManager {
  private static instance: SecureKeyManager;
  private encryptedKeys = new Map<string, string>();

  static getInstance(): SecureKeyManager {
    if (!this.instance) {
      this.instance = new SecureKeyManager();
    }
    return this.instance;
  }

  storePrivateKey(identifier: string, privateKey: `0x${string}`): void {
    const encrypted = this.encrypt(privateKey);
    this.encryptedKeys.set(identifier, encrypted);
  }

  getPrivateKey(identifier: string): `0x${string}` {
    const encrypted = this.encryptedKeys.get(identifier);
    if (!encrypted) {
      throw new Error(`No private key found for identifier: ${identifier}`);
    }

    return this.decrypt(encrypted);
  }

  private encrypt(privateKey: `0x${string}`): string {
    // Implement encryption logic
    return privateKey; // Placeholder - use proper encryption
  }

  private decrypt(encrypted: string): `0x${string}` {
    // Implement decryption logic
    return encrypted as `0x${string}`; // Placeholder - use proper decryption
  }
}
```

### 2. Input Validation

```typescript
// src/utils/validation.ts
export class InputValidator {
  static validateAddress(address: unknown): Address {
    if (typeof address !== 'string') {
      throw new Error('Address must be a string');
    }

    if (!address.startsWith('0x') || address.length !== 42) {
      throw new Error('Invalid address format');
    }

    if (!isAddress(address)) {
      throw new Error(`Invalid address: ${address}`);
    }

    return getAddress(address);
  }

  static validateAmount(amount: unknown, decimals = 18): bigint {
    if (typeof amount !== 'string' && typeof amount !== 'bigint') {
      throw new Error('Amount must be string or bigint');
    }

    const parsedAmount = typeof amount === 'string'
      ? parseUnits(amount, decimals)
      : amount;

    if (parsedAmount <= 0n) {
      throw new Error('Amount must be greater than 0');
    }

    if (parsedAmount > maxUint256) {
      throw new Error('Amount exceeds maximum value');
    }

    return parsedAmount;
  }

  static validateSlippage(slippage: unknown): number {
    if (typeof slippage !== 'number') {
      throw new Error('Slippage must be a number');
    }

    if (slippage < 0 || slippage > 50) {
      throw new Error('Slippage must be between 0% and 50%');
    }

    return slippage;
  }
}
```

### 3. Rate Limiting

```typescript
// src/utils/rate-limiter.ts
export class RateLimiter {
  private requests = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.requests.get(identifier) || [];

    // Remove old timestamps
    timestamps = timestamps.filter(timestamp => timestamp > windowStart);

    if (timestamps.length >= this.maxRequests) {
      return false;
    }

    timestamps.push(now);
    this.requests.set(identifier, timestamps);

    return true;
  }

  getRemainingRequests(identifier: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const timestamps = this.requests.get(identifier) || [];
    const recentTimestamps = timestamps.filter(timestamp => timestamp > windowStart);

    return Math.max(0, this.maxRequests - recentTimestamps.length);
  }
}
```

## 🚨 Error Handling

### 1. Comprehensive Error Types

```typescript
// src/utils/errors.ts
export class ViemError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'ViemError';
  }
}

export class NetworkError extends ViemError {
  constructor(message: string, public readonly rpcUrl: string) {
    super(message, 'NETWORK_ERROR', { rpcUrl });
    this.name = 'NetworkError';
  }
}

export class ContractError extends ViemError {
  constructor(
    message: string,
    public readonly contractAddress: Address,
    public readonly functionName: string
  ) {
    super(message, 'CONTRACT_ERROR', { contractAddress, functionName });
    this.name = 'ContractError';
  }
}

export class ValidationError extends ViemError {
  constructor(message: string, public readonly field: string) {
    super(message, 'VALIDATION_ERROR', { field });
    this.name = 'ValidationError';
  }
}
```

### 2. Error Handler Middleware

```typescript
// src/middleware/error-handler.ts
export class ErrorHandler {
  static async handleAsyncOperation<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const wrappedError = this.wrapError(error, context);
      this.logError(wrappedError);
      throw wrappedError;
    }
  }

  private static wrapError(error: unknown, context: string): ViemError {
    if (error instanceof ViemError) {
      return error;
    }

    if (error instanceof ContractFunctionExecutionError) {
      return new ContractError(
        `Contract execution failed in ${context}: ${error.message}`,
        error.address as Address,
        error.functionName
      );
    }

    if (error instanceof BaseError) {
      return new ViemError(
        `Viem error in ${context}: ${error.message}`,
        error.code,
        { originalError: error }
      );
    }

    return new ViemError(
      `Unexpected error in ${context}: ${error}`,
      'UNKNOWN_ERROR',
      { originalError: error }
    );
  }

  private static logError(error: ViemError): void {
    console.error(`[${error.code}] ${error.message}`, {
      context: error.name,
      details: error.details,
      timestamp: new Date().toISOString()
    });
  }
}
```

## 🧪 Testing Strategies

### 1. Test Utilities

```typescript
// src/tests/utils/test-helpers.ts
export class TestHelpers {
  static createMockPublicClient(overrides: Partial<PublicClient> = {}) {
    return {
      getBalance: vi.fn(),
      readContract: vi.fn(),
      multicall: vi.fn(),
      waitForTransactionReceipt: vi.fn(),
      ...overrides
    } as any;
  }

  static createMockWalletClient(overrides: Partial<WalletClient> = {}) {
    return {
      writeContract: vi.fn(),
      sendTransaction: vi.fn(),
      estimateGas: vi.fn(),
      account: {
        address: '0x742d35Cc6634C0532925a3b8D4E7E0E0e9e0dF3b' as Address
      },
      ...overrides
    } as any;
  }

  static createMockTokenInfo(overrides: Partial<TokenInfo> = {}): TokenInfo {
    return {
      address: '0x1234567890123456789012345678901234567890' as Address,
      name: 'Test Token',
      symbol: 'TEST',
      decimals: 18,
      totalSupply: 1000000000000000000000000n,
      ...overrides
    };
  }

  static async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeout = 5000,
    interval = 100
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('Condition not met within timeout');
  }
}
```

### 2. Integration Test Patterns

```typescript
// src/tests/integration/token.service.integration.test.ts
describe('TokenService Integration', () => {
  let tokenService: TokenService;
  let testAddress: Address;

  beforeAll(async () => {
    tokenService = new TokenService(publicClient);
    testAddress = '0x742d35Cc6634C0532925a3b8D4E7E0E0e9e0dF3b' as Address;
  });

  describe('getBalance', () => {
    it('should return valid balance for existing token', async () => {
      const balance = await tokenService.getBalance(
        BSC_ADDRESSES.WBNB,
        testAddress
      );

      expect(typeof balance).toBe('bigint');
      expect(balance).toBeGreaterThanOrEqual(0n);
    });

    it('should throw error for invalid token address', async () => {
      await expect(
        tokenService.getBalance('0xinvalid' as Address, testAddress)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getTokenInfo', () => {
    it('should return valid token information', async () => {
      const tokenInfo = await tokenService.getTokenInfo(BSC_ADDRESSES.WBNB);

      expect(tokenInfo.address).toBe(BSC_ADDRESSES.WBNB);
      expect(tokenInfo.name).toBe('Wrapped BNB');
      expect(tokenInfo.symbol).toBe('WBNB');
      expect(tokenInfo.decimals).toBe(18);
    });
  });
});
```

## 📊 Monitoring & Debugging

### 1. Performance Monitoring

```typescript
// src/utils/performance.ts
export class PerformanceMonitor {
  private static metrics = new Map<string, number[]>();

  static startTimer(operation: string): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(operation, duration);
    };
  }

  private static recordMetric(operation: string, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }

    const measurements = this.metrics.get(operation)!;
    measurements.push(duration);

    // Keep only last 100 measurements
    if (measurements.length > 100) {
      measurements.shift();
    }
  }

  static getMetrics(operation: string): {
    avg: number;
    min: number;
    max: number;
    count: number;
  } | null {
    const measurements = this.metrics.get(operation);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const avg = measurements.reduce((sum, val) => sum + val, 0) / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);

    return { avg, min, max, count: measurements.length };
  }
}
```

### 2. Logging Utilities

```typescript
// src/utils/logger.ts
export class Logger {
  private static context: string;

  static setContext(context: string): void {
    this.context = context;
  }

  static info(message: string, data?: any): void {
    console.log(JSON.stringify({
      level: 'info',
      context: this.context,
      message,
      data,
      timestamp: new Date().toISOString()
    }));
  }

  static warn(message: string, data?: any): void {
    console.warn(JSON.stringify({
      level: 'warn',
      context: this.context,
      message,
      data,
      timestamp: new Date().toISOString()
    }));
  }

  static error(message: string, error?: Error, data?: any): void {
    console.error(JSON.stringify({
      level: 'error',
      context: this.context,
      message,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined,
      data,
      timestamp: new Date().toISOString()
    }));
  }
}
```

## 🚀 Deployment Guidelines

### 1. Environment Configuration

```typescript
// src/config/environment.ts
export interface EnvironmentConfig {
  bscRpcUrl: string;
  bscTestnetRpcUrl: string;
  privateKey?: string;
  etherscanApiKey?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  rateLimit: {
    requests: number;
    windowMs: number;
  };
  cache: {
    ttl: number;
    maxSize: number;
  };
}

export function getEnvironmentConfig(): EnvironmentConfig {
  return {
    bscRpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/',
    bscTestnetRpcUrl: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    privateKey: process.env.PRIVATE_KEY,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY,
    logLevel: (process.env.LOG_LEVEL as any) || 'info',
    rateLimit: {
      requests: parseInt(process.env.RATE_LIMIT_REQUESTS || '100'),
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000')
    },
    cache: {
      ttl: parseInt(process.env.CACHE_TTL || '300000'),
      maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000')
    }
  };
}
```

### 2. Health Checks

```typescript
// src/utils/health-check.ts
export class HealthChecker {
  static async checkRpcConnectivity(rpcUrl: string): Promise<boolean> {
    try {
      const client = createPublicClient({
        chain: bsc,
        transport: http(rpcUrl)
      });

      const blockNumber = await client.getBlockNumber();
      return blockNumber > 0;
    } catch (error) {
      return false;
    }
  }

  static async performHealthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    checks: Record<string, boolean>;
    timestamp: string;
  }> {
    const config = getEnvironmentConfig();

    const checks = {
      bscRpc: await this.checkRpcConnectivity(config.bscRpcUrl),
      bscTestnetRpc: await this.checkRpcConnectivity(config.bscTestnetRpcUrl),
      privateKeyConfigured: !!config.privateKey,
      etherscanConfigured: !!config.etherscanApiKey
    };

    const allHealthy = Object.values(checks).every(check => check);

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      checks,
      timestamp: new Date().toISOString()
    };
  }
}
```

---

## ✅ Best Practices Checklist

### Development

- [ ] Use TypeScript with strict mode enabled
- [ ] Implement comprehensive error handling
- [ ] Validate all inputs before processing
- [ ] Use dependency injection for better testability
- [ ] Follow consistent naming conventions
- [ ] Write comprehensive tests for all functionality

### Performance

- [ ] Use multicall for batch operations
- [ ] Implement smart caching strategies
- [ ] Optimize RPC calls and connection pooling
- [ ] Monitor performance metrics
- [ ] Use connection keep-alive where possible

### Security

- [ ] Never expose private keys in code or logs
- [ ] Validate all user inputs
- [ ] Implement rate limiting
- [ ] Use HTTPS for all RPC connections
- [ ] Regularly update dependencies

### Testing

- [ ] Write unit tests for all functions
- [ ] Create integration tests for critical paths
- [ ] Use mock data for deterministic tests
- [ ] Test error conditions and edge cases
- [ ] Maintain good test coverage

---

*Best Practices v2.38.5 | Last Updated: 2025-11-05*