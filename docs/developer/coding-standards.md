# 📏 Viem 2.38.5 Coding Standards

This document defines the coding standards and best practices for the Viem 2.38.5 migration project.

## 🎯 Overview

These standards ensure:
- Consistent code quality across the project
- Maintainable and readable code
- Type safety and error resilience
- Optimal performance with Viem
- Security best practices

## 📝 General Standards

### File Naming

```
// Files
kebab-case.service.ts
kebab-case.controller.ts
kebab-case.util.ts
kebab-case.type.ts
kebab-case.test.ts
kebab-case.integration.test.ts

// Directories
src/services/
src/controllers/
src/utils/
src/types/
src/tests/
```

### Import Order

```typescript
// 1. Node.js built-ins
import { performance } from 'perf_hooks';
import { createReadStream } from 'fs';

// 2. External libraries (viem first)
import {
  createPublicClient,
  http,
  isAddress,
  getAddress,
  BaseError
} from 'viem';
import { bsc } from 'viem/chains';
import express from 'express';
import { z } from 'zod';

// 3. Internal modules (absolute paths)
import { logger } from '@/utils/logger';
import { config } from '@/config/environment';
import { TokenService } from '@/services/token.service';

// 4. Relative imports
import { validateInput } from './validation';
import type { TokenInfo } from './types';
```

### Variable Naming

```typescript
// ✅ Good: Descriptive and consistent
const userAddress = '0x...';
const tokenBalance = BigInt(1000000);
const publicClient = createPublicClient({...});
const transactionHash = '0x...';

// ❌ Bad: Unclear or abbreviated
const addr = '0x...';
const bal = BigInt(1000000);
const client = createPublicClient({...});
const hash = '0x...';
```

## 🔧 Viem-Specific Standards

### Client Management

```typescript
// ✅ Good: Use client factory
import { viemClientFactory } from '@/config/viem';

export class TokenService {
  private client = viemClientFactory.getPublicClient();

  async getBalance(address: string): Promise<bigint> {
    return this.client.getBalance({ address: validateAddress(address) });
  }
}

// ❌ Bad: Create clients directly
export class TokenService {
  async getBalance(address: string): Promise<bigint> {
    const client = createPublicClient({...}); // Bad: creates new client each time
    return client.getBalance({ address });
  }
}
```

### Address Handling

```typescript
// ✅ Good: Always validate and checksum addresses
import { isAddress, getAddress } from 'viem';

function validateAddress(address: string): `0x${string}` {
  if (!isAddress(address)) {
    throw new ValidationError(`Invalid address: ${address}`);
  }
  return getAddress(address);
}

// Usage
const validAddress = validateAddress(userInput);

// ❌ Bad: Assume addresses are valid
function processAddress(address: string) {
  // No validation - potential security risk
  return address.toLowerCase();
}
```

### BigInt Usage

```typescript
// ✅ Good: Use BigInt consistently
const amount: bigint = parseUnits('1.5', 18);
const fee: bigint = amount * BigInt(5) / BigInt(100); // 5% fee
const total: bigint = amount + fee;

// ✅ Good: Type annotations for clarity
function calculateFee(amount: bigint, percentage: bigint): bigint {
  return amount * percentage / BigInt(10000); // percentage in basis points
}

// ❌ Bad: Mix with numbers
const amount = 1000000000000000000; // Should be BigInt
const fee = amount * 0.05; // Type error
const total = amount + fee; // Incorrect
```

### Error Handling

```typescript
// ✅ Good: Specific error types and handling
import { BaseError, ContractFunctionExecutionError } from 'viem';

export class ViemOperationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ViemOperationError';
  }
}

async function getTokenBalance(address: string): Promise<bigint> {
  try {
    const validAddress = validateAddress(address);
    return await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [validAddress]
    });
  } catch (error) {
    if (error instanceof ContractFunctionExecutionError) {
      throw new ViemOperationError(
        'Failed to read token balance',
        'CONTRACT_READ_ERROR',
        error
      );
    }
    if (error instanceof BaseError) {
      throw new ViemOperationError(
        `Blockchain operation failed: ${error.message}`,
        'BLOCKCHAIN_ERROR',
        error
      );
    }
    throw error;
  }
}

// ❌ Bad: Generic error handling
async function getTokenBalance(address: string): Promise<bigint> {
  try {
    return await publicClient.readContract({...});
  } catch (error) {
    console.error('Error:', error); // Too generic
    throw new Error('Something went wrong'); // Not helpful
  }
}
```

## 📋 TypeScript Standards

### Type Definitions

```typescript
// ✅ Good: Specific, typed interfaces
export interface TokenInfo {
  address: `0x${string}`;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  logoURI?: string;
}

export interface SwapQuote {
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountIn: bigint;
  amountOut: bigint;
  priceImpact: number; // Percentage as decimal (0.01 = 1%)
  gasEstimate: bigint;
}

// ✅ Good: Union types for specific states
export type TransactionStatus =
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'replaced';

// ✅ Good: Generic utility types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// ❌ Bad: Any types
interface TokenInfo {
  address: any; // Avoid 'any'
  name: any;
  balance: any;
}
```

### Function Signatures

```typescript
// ✅ Good: Clear parameter and return types
export function calculateSlippage(
  amountOut: bigint,
  expectedAmountOut: bigint,
  decimals: number
): number {
  const slippage = Number(expectedAmountOut - amountOut) / Number(expectedAmountOut);
  return Math.max(0, slippage);
}

// ✅ Good: Async functions with proper error handling
export async function waitForTransaction(
  hash: `0x${string}`,
  maxWaitTime: number = 60000 // 1 minute default
): Promise<TransactionReceipt> {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: maxWaitTime
  });

  if (receipt.status === 'reverted') {
    throw new TransactionRevertedError(hash, receipt);
  }

  return receipt;
}

// ❌ Bad: Unclear types
function calculateSlippage(amountOut, expectedAmountOut, decimals) {
  // No type annotations
}
```

## 🏗️ Architecture Standards

### Service Pattern

```typescript
// ✅ Good: Service class with dependency injection
export class TokenService {
  constructor(
    private readonly client: PublicClient,
    private readonly cache: CacheService,
    private readonly logger: Logger
  ) {}

  async getTokenInfo(address: string): Promise<TokenInfo> {
    const validAddress = validateAddress(address);

    // Check cache first
    const cached = await this.cache.get(`token:${validAddress}`);
    if (cached) {
      this.logger.debug(`Cache hit for token: ${validAddress}`);
      return cached;
    }

    // Fetch from blockchain
    const info = await this.fetchTokenInfoFromChain(validAddress);

    // Cache the result
    await this.cache.set(`token:${validAddress}`, info, 300); // 5 minutes

    this.logger.info(`Fetched token info for: ${validAddress}`);
    return info;
  }

  private async fetchTokenInfoFromChain(address: `0x${string}`): Promise<TokenInfo> {
    const [name, symbol, decimals, totalSupply] = await this.client.multicall({
      contracts: [
        { address, abi: erc20Abi, functionName: 'name' },
        { address, abi: erc20Abi, functionName: 'symbol' },
        { address, abi: erc20Abi, functionName: 'decimals' },
        { address, abi: erc20Abi, functionName: 'totalSupply' }
      ]
    });

    return {
      address,
      name: name.result || 'Unknown Token',
      symbol: symbol.result || 'UNKNOWN',
      decimals: decimals.result || 18,
      totalSupply: totalSupply.result || 0n
    };
  }
}

// ❌ Bad: Static methods, no dependency injection
export class TokenService {
  static async getTokenInfo(address: string) {
    // Hard to test, no caching, no logging
    const client = createPublicClient({...});
    return await client.readContract({...});
  }
}
```

### Controller Pattern

```typescript
// ✅ Good: Clean controller with validation
@Controller('/api/tokens')
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  @Get('/info/:address')
  async getTokenInfo(@Param('address') address: string): Promise<ApiResponse<TokenInfo>> {
    try {
      const tokenInfo = await this.tokenService.getTokenInfo(address);
      return {
        success: true,
        data: tokenInfo
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof ViemOperationError) {
        throw new InternalServerErrorException(error.message);
      }
      throw error;
    }
  }

  @Get('/balance/:address')
  async getTokenBalance(
    @Param('address') address: string,
    @Query('token') tokenAddress: string
  ): Promise<ApiResponse<{ balance: string; formatted: string }>> {
    const validatedAddress = validateAddress(address);
    const validatedToken = validateAddress(tokenAddress);

    const balance = await this.tokenService.getTokenBalance(validatedAddress, validatedToken);

    return {
      success: true,
      data: {
        balance: balance.toString(),
        formatted: formatUnits(balance, 18) // Adjust based on token decimals
      }
    };
  }
}
```

## 🧪 Testing Standards

### Unit Tests

```typescript
// ✅ Good: Comprehensive unit tests
describe('TokenService', () => {
  let tokenService: TokenService;
  let mockClient: jest.Mocked<PublicClient>;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockClient = createMockPublicClient();
    mockCache = createMockCacheService();
    tokenService = new TokenService(mockClient, mockCache, logger);
  });

  describe('getTokenInfo', () => {
    it('should return cached token info when available', async () => {
      // Arrange
      const address = '0x...';
      const cachedInfo = createMockTokenInfo();
      mockCache.get.mockResolvedValue(cachedInfo);

      // Act
      const result = await tokenService.getTokenInfo(address);

      // Assert
      expect(result).toEqual(cachedInfo);
      expect(mockCache.get).toHaveBeenCalledWith(`token:${address}`);
      expect(mockClient.multicall).not.toHaveBeenCalled();
    });

    it('should fetch token info from blockchain when not cached', async () => {
      // Arrange
      const address = '0x...';
      const blockchainInfo = createMockTokenInfo();
      mockCache.get.mockResolvedValue(null);
      mockClient.multicall.mockResolvedValue([
        { result: 'Test Token' },
        { result: 'TEST' },
        { result: 18 },
        { result: 1000000n }
      ]);

      // Act
      const result = await tokenService.getTokenInfo(address);

      // Assert
      expect(result).toEqual(blockchainInfo);
      expect(mockClient.multicall).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith(
        `token:${address}`,
        blockchainInfo,
        300
      );
    });

    it('should throw ValidationError for invalid address', async () => {
      // Arrange
      const invalidAddress = 'invalid-address';

      // Act & Assert
      await expect(tokenService.getTokenInfo(invalidAddress))
        .rejects.toThrow(ValidationError);
    });
  });
});
```

### Integration Tests

```typescript
// ✅ Good: Integration tests with real blockchain interaction
describe('Token API Integration', () => {
  let app: Express;
  let testAddress: `0x${string}`;

  beforeAll(async () => {
    app = createApp();
    testAddress = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'; // WBNB
  });

  it('should return token info for valid address', async () => {
    const response = await request(app)
      .get(`/api/tokens/info/${testAddress}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        address: testAddress,
        name: 'Wrapped BNB',
        symbol: 'WBNB',
        decimals: 18
      }
    });
    expect(typeof response.body.data.totalSupply).toBe('string');
  });

  it('should return 400 for invalid address', async () => {
    await request(app)
      .get('/api/tokens/info/invalid-address')
      .expect(400);
  });
});
```

## 🔒 Security Standards

### Input Validation

```typescript
// ✅ Good: Comprehensive input validation
import { z } from 'zod';

const TokenAddressSchema = z.object({
  address: z.string().refine(
    (addr) => isAddress(addr),
    { message: 'Invalid Ethereum address format' }
  )
});

const SwapQuoteSchema = z.object({
  tokenIn: z.string().refine(isAddress, { message: 'Invalid tokenIn address' }),
  tokenOut: z.string().refine(isAddress, { message: 'Invalid tokenOut address' }),
  amountIn: z.string().regex(/^\d+$/, { message: 'Amount must be a positive integer' }),
  slippageTolerancePercent: z.number().min(0).max(50).default(0.5)
});

export function validateSwapInput(input: unknown): SwapQuoteRequest {
  return SwapQuoteSchema.parse(input);
}

// ❌ Bad: No validation
export async function createSwapQuote(input: any) {
  // Directly use input without validation - security risk
  return await swapService.createQuote(input.tokenIn, input.tokenOut, input.amount);
}
```

### Environment Security

```typescript
// ✅ Good: Secure configuration management
export const config = {
  database: {
    url: process.env.DATABASE_URL || throw new Error('DATABASE_URL required'),
    ssl: process.env.NODE_ENV === 'production'
  },
  blockchain: {
    rpcUrl: process.env.BSC_RPC_URL || throw new Error('BSC_RPC_URL required'),
    chainId: parseInt(process.env.BSC_CHAIN_ID || '56', 10)
  },
  jwt: {
    secret: process.env.JWT_SECRET || throw new Error('JWT_SECRET required'),
    expiresIn: '24h'
  }
};

function throw(message: string): never {
  throw new Error(message);
}

// ✅ Good: Secure key handling
export function getPrivateKey(): `0x${string}` {
  const key = process.env.PRIVATE_KEY;
  if (!key || !key.startsWith('0x') || key.length !== 66) {
    throw new Error('Invalid PRIVATE_KEY format');
  }
  return key as `0x${string}`;
}

// ❌ Bad: Hardcoded secrets
export const config = {
  privateKey: '0x1234...', // Never hardcode secrets
  rpcUrl: 'https://fixed-url.com' // Use environment variables
};
```

## 📊 Performance Standards

### Caching

```typescript
// ✅ Good: Multi-level caching
export class TokenService {
  private readonly memoryCache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 300000; // 5 minutes

  async getTokenInfo(address: string): Promise<TokenInfo> {
    const validAddress = validateAddress(address);
    const cacheKey = `token:${validAddress}`;

    // Check memory cache first
    const memoryCached = this.memoryCache.get(cacheKey);
    if (memoryCached && Date.now() - memoryCached.timestamp < this.CACHE_TTL) {
      return memoryCached.data;
    }

    // Check Redis cache
    const redisCached = await this.redisCache.get(cacheKey);
    if (redisCached) {
      // Update memory cache
      this.memoryCache.set(cacheKey, {
        data: redisCached,
        timestamp: Date.now()
      });
      return redisCached;
    }

    // Fetch from blockchain
    const tokenInfo = await this.fetchFromBlockchain(validAddress);

    // Update both caches
    this.memoryCache.set(cacheKey, {
      data: tokenInfo,
      timestamp: Date.now()
    });
    await this.redisCache.set(cacheKey, tokenInfo, this.CACHE_TTL);

    return tokenInfo;
  }
}
```

### Batch Operations

```typescript
// ✅ Good: Batch operations for efficiency
export class BalanceService {
  async getMultipleBalances(
    addresses: string[],
    tokenAddress: string
  ): Promise<Map<string, bigint>> {
    const validAddresses = addresses.map(validateAddress);
    const validToken = validateAddress(tokenAddress);

    // Use multicall for efficiency
    const calls = validAddresses.map(address => ({
      address: validToken,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [address]
    }));

    const results = await this.client.multicall({ contracts: calls });

    const balances = new Map<string, bigint>();
    results.forEach((result, index) => {
      balances.set(validAddresses[index], result.result || 0n);
    });

    return balances;
  }
}

// ❌ Bad: Individual calls in loop
async function getMultipleBalancesBad(addresses: string[], tokenAddress: string) {
  const balances = new Map<string, bigint>();

  for (const address of addresses) {
    const balance = await this.client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address]
    });
    balances.set(address, balance);
  }

  return balances; // Inefficient - N network calls
}
```

## 📝 Documentation Standards

### JSDoc Comments

```typescript
/**
 * Calculates the optimal slippage tolerance for a swap based on market conditions.
 *
 * @param amountOut - The expected output amount from the swap
 * @param marketDepth - The current market depth indicator (0-1)
 * @param volatility - The recent price volatility (0-1)
 * @returns Recommended slippage tolerance as a percentage (0-1)
 *
 * @example
 * ```typescript
 * const slippage = calculateOptimalSlippage(1000000n, 0.8, 0.1);
 * console.log(`Recommended slippage: ${slippage * 100}%`); // "Recommended slippage: 0.5%"
 * ```
 *
 * @throws {ValidationError} When marketDepth or volatility are outside valid range
 */
export function calculateOptimalSlippage(
  amountOut: bigint,
  marketDepth: number,
  volatility: number
): number {
  if (marketDepth < 0 || marketDepth > 1) {
    throw new ValidationError('Market depth must be between 0 and 1');
  }
  if (volatility < 0 || volatility > 1) {
    throw new ValidationError('Volatility must be between 0 and 1');
  }

  const baseSlippage = 0.005; // 0.5% base
  const volatilityAdjustment = volatility * 0.01; // Up to 1% for high volatility
  const depthDiscount = (1 - marketDepth) * 0.002; // Up to 0.2% for low depth

  return Math.min(baseSlippage + volatilityAdjustment + depthDiscount, 0.05); // Max 5%
}
```

### README Standards

Each module should include a README.md with:

```markdown
# Token Service

## Overview
Handles all token-related operations including balance queries, token information, and transfers.

## Usage

```typescript
import { TokenService } from '@/services/token.service';

const tokenService = new TokenService(client, cache, logger);
const tokenInfo = await tokenService.getTokenInfo('0x...');
```

## API Reference

### `getTokenInfo(address: string): Promise<TokenInfo>`
Returns comprehensive token information.

**Parameters:**
- `address`: The token contract address

**Returns:** Token information including name, symbol, decimals, and total supply

**Throws:**
- `ValidationError`: When address is invalid
- `ViemOperationError`: When blockchain operation fails

## Examples

See `/examples/token-operations.ts` for detailed usage examples.
```

---

Following these coding standards ensures consistent, maintainable, and high-quality code throughout the Viem migration project.