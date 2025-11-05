# 📚 Viem 2.38.5 Developer Resources

**BSC DEX Backend Migration Guide**
*Version: 2.38.5 | Last Updated: 2025-11-05*

## 🎯 Overview

This comprehensive developer resource guide provides everything you need to work effectively with the Viem 2.38.5 blockchain library in the BSC DEX backend. This includes setup guides, best practices, coding standards, and reference materials.

## 📋 Table of Contents

1. [Quick Start Guide](#quick-start-guide)
2. [Development Setup](#development-setup)
3. [Viem Fundamentals](#viem-fundamentals)
4. [BSC Integration](#bsc-integration)
5. [Best Practices](#best-practices)
6. [Code Patterns](#code-patterns)
7. [Testing Guidelines](#testing-guidelines)
8. [Performance Optimization](#performance-optimization)
9. [Security Considerations](#security-considerations)
10. [Troubleshooting](#troubleshooting)
11. [Reference Materials](#reference-materials)
12. [Community & Support](#community--support)

## 🚀 Quick Start Guide

### Prerequisites

```bash
# Install required dependencies
pnpm add viem@2.38.5

# For development with TypeScript
pnpm add -D @types/node typescript

# For testing
pnpm add -D jest @types/jest
```

### Basic Setup

```typescript
// src/config/viem.ts
import { createPublicClient, createWalletClient, http } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

export const publicClient = createPublicClient({
  chain: bsc,
  transport: http(process.env.BSC_RPC_URL!)
});

export const walletClient = createWalletClient({
  account: privateKeyToAccount(process.env.PRIVATE_KEY! as `0x${string}`),
  chain: bsc,
  transport: http(process.env.BSC_RPC_URL!)
});
```

### First Query

```typescript
// Get BNB balance
const balance = await publicClient.getBalance({
  address: '0x742d35Cc6634C0532925a3b8D4E7E0E0e9e0dF3b'
});

console.log(`Balance: ${formatUnits(balance, 18)} BNB`);
```

## 🛠️ Development Setup

### IDE Configuration

#### VSCode Extensions

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json"
  ]
}
```

#### VSCode Settings

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  }
}
```

### Environment Setup

```bash
# .env.example
BSC_RPC_URL=https://bsc-dataseed1.binance.org/
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/
PRIVATE_KEY=0x_YOUR_PRIVATE_KEY_HERE
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
```

### Project Structure

```
src/
├── config/
│   ├── viem.ts           # Viem client configuration
│   ├── chains.ts         # Chain configurations
│   └── contracts.ts      # Contract ABIs and addresses
├── services/
│   ├── token.service.ts  # Token operations
│   ├── swap.service.ts   # Swap operations
│   └── wallet.service.ts # Wallet operations
├── utils/
│   ├── viem.helpers.ts   # Helper functions
│   ├── validation.ts     # Validation utilities
│   └── formatting.ts     # Formatting utilities
└── types/
    ├── viem.types.ts     # Type definitions
    └── api.types.ts      # API type definitions
```

## 📖 Viem Fundamentals

### Core Concepts

#### 1. Clients

```typescript
// Public Client - Read operations
const publicClient = createPublicClient({
  chain: bsc,
  transport: http(rpcUrl)
});

// Wallet Client - Write operations
const walletClient = createWalletClient({
  account: privateKeyToAccount(privateKey),
  chain: bsc,
  transport: http(rpcUrl)
});
```

#### 2. Address Handling

```typescript
import { isAddress, getAddress } from 'viem';

// Validate address
if (!isAddress(address)) {
  throw new Error('Invalid address');
}

// Get checksummed address
const checksummed = getAddress(address);
```

#### 3. Unit Conversions

```typescript
import { formatUnits, parseUnits } from 'viem';

// To wei
const amountInWei = parseUnits('1.5', 18); // 1.5 ETH = 1500000000000000000 wei

// From wei
const amountInEth = formatUnits(1500000000000000000n, 18); // 1.5 ETH
```

#### 4. Contract Interactions

```typescript
// Read contract
const balance = await publicClient.readContract({
  address: tokenAddress,
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [address]
});

// Write contract
const hash = await walletClient.writeContract({
  address: tokenAddress,
  abi: erc20Abi,
  functionName: 'transfer',
  args: [recipient, amount]
});
```

### Common Patterns

#### Error Handling

```typescript
import { BaseError, ContractFunctionExecutionError } from 'viem';

try {
  const result = await publicClient.readContract({...});
  return result;
} catch (error) {
  if (error instanceof ContractFunctionExecutionError) {
    console.error('Contract execution failed:', error.message);
    // Handle specific contract errors
  } else if (error instanceof BaseError) {
    console.error('Viem error:', error.code, error.message);
    // Handle general Viem errors
  }
  throw error;
}
```

#### Transaction Waiting

```typescript
const hash = await walletClient.sendTransaction({...});

// Wait for transaction
const receipt = await publicClient.waitForTransactionReceipt({
  hash,
  confirmations: 2
});

console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
```

## 🔗 BSC Integration

### Chain Configuration

```typescript
// src/config/chains.ts
import { bsc, bscTestnet } from 'viem/chains';

export const CHAINS = {
  bsc,
  bscTestnet
} as const;

export type SupportedChain = typeof CHAINS[keyof typeof CHAINS];
```

### Common BSC Addresses

```typescript
// src/config/contracts.ts
export const BSC_ADDRESSES = {
  WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  USDT: '0x55d398326f99059fF775485246999027B3197955',
  CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',

  // PancakeSwap V2
  PANCAKE_ROUTER_V2: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  PANCAKE_FACTORY_V2: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
  PANCAKE_MASTER_CHEF: '0x73feaa1eE314F8c655E354234017bE2193C9E24E'
} as const;
```

### PancakeSwap Integration

```typescript
// PancakeSwap Router ABI (simplified)
const PANCAKE_ROUTER_ABI = [
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    name: 'swapExactTokensForTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

// Get swap quote
const amounts = await publicClient.readContract({
  address: BSC_ADDRESSES.PANCAKE_ROUTER_V2,
  abi: PANCAKE_ROUTER_ABI,
  functionName: 'getAmountsOut',
  args: [amountIn, [tokenIn, tokenOut]]
});
```

## ✅ Best Practices

### 1. Type Safety

```typescript
// Use strict typing for addresses
type Address = `0x${string}`;

// Type-safe function signatures
async function getTokenBalance(
  tokenAddress: Address,
  walletAddress: Address
): Promise<bigint> {
  return await publicClient.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [walletAddress]
  });
}
```

### 2. Error Handling

```typescript
// Implement comprehensive error handling
async function safeContractCall<T>({
  address,
  abi,
  functionName,
  args,
  retries = 3
}: {
  address: Address;
  abi: readonly unknown[];
  functionName: string;
  args: unknown[];
  retries?: number;
}): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < retries; i++) {
    try {
      return await publicClient.readContract({
        address,
        abi,
        functionName,
        args
      }) as T;
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${i + 1} failed:`, error);

      // Wait before retry
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  throw lastError!;
}
```

### 3. Gas Optimization

```typescript
// Optimize gas usage
async function optimizedTransfer(
  tokenAddress: Address,
  to: Address,
  amount: bigint
): Promise<Address> {
  // Check allowance first
  const allowance = await publicClient.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [walletClient.account!.address, to]
  });

  if (allowance < amount) {
    // Approve only the needed amount
    await walletClient.writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [to, amount]
    });
  }

  // Execute transfer
  return await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [to, amount]
  });
}
```

### 4. Performance Optimization

```typescript
// Use multicall for batch operations
async function getMultipleBalances(
  tokenAddresses: Address[],
  walletAddress: Address
): Promise<bigint[]> {
  const contracts = tokenAddresses.map(address => ({
    address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [walletAddress]
  }));

  const results = await publicClient.multicall({ contracts });
  return results.map(result => result.result || 0n);
}

// Cache frequently accessed data
const tokenInfoCache = new Map<Address, TokenInfo>();

async function getTokenInfo(tokenAddress: Address): Promise<TokenInfo> {
  if (tokenInfoCache.has(tokenAddress)) {
    return tokenInfoCache.get(tokenAddress)!;
  }

  const [name, symbol, decimals] = await publicClient.multicall({
    contracts: [
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'name' },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'symbol' },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'decimals' }
    ]
  });

  const tokenInfo = {
    address: tokenAddress,
    name: name.result || 'Unknown',
    symbol: symbol.result || 'UNKNOWN',
    decimals: decimals.result || 18
  };

  tokenInfoCache.set(tokenAddress, tokenInfo);
  return tokenInfo;
}
```

## 🏗️ Code Patterns

### 1. Service Pattern

```typescript
// src/services/base.service.ts
export abstract class BaseService {
  constructor(
    protected readonly publicClient: PublicClient,
    protected readonly walletClient?: WalletClient
  ) {}

  protected async handleContractError(error: unknown): Promise<never> {
    if (error instanceof ContractFunctionExecutionError) {
      // Handle specific contract errors
      throw new Error(`Contract execution failed: ${error.message}`);
    }
    throw error;
  }
}

// src/services/token.service.ts
export class TokenService extends BaseService {
  async getBalance(tokenAddress: Address, walletAddress: Address): Promise<bigint> {
    try {
      return await this.publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [walletAddress]
      });
    } catch (error) {
      return this.handleContractError(error);
    }
  }
}
```

### 2. Repository Pattern

```typescript
// src/repositories/token.repository.ts
export class TokenRepository {
  constructor(private readonly publicClient: PublicClient) {}

  async findTokenByAddress(address: Address): Promise<Token | null> {
    try {
      const [name, symbol, decimals, totalSupply] = await this.publicClient.multicall({
        contracts: [
          { address, abi: ERC20_ABI, functionName: 'name' },
          { address, abi: ERC20_ABI, functionName: 'symbol' },
          { address, abi: ERC20_ABI, functionName: 'decimals' },
          { address, abi: ERC20_ABI, functionName: 'totalSupply' }
        ]
      });

      return {
        address,
        name: name.result || 'Unknown',
        symbol: symbol.result || 'UNKNOWN',
        decimals: decimals.result || 18,
        totalSupply: totalSupply.result || 0n
      };
    } catch (error) {
      return null;
    }
  }
}
```

### 3. Factory Pattern

```typescript
// src/factories/client.factory.ts
export class ClientFactory {
  static createPublicClient(chainName: string): PublicClient {
    const config = this.getChainConfig(chainName);
    return createPublicClient(config);
  }

  static createWalletClient(
    chainName: string,
    privateKey: `0x${string}`
  ): WalletClient {
    const config = this.getChainConfig(chainName);
    return createWalletClient({
      ...config,
      account: privateKeyToAccount(privateKey)
    });
  }

  private static getChainConfig(chainName: string) {
    switch (chainName) {
      case 'bsc':
        return {
          chain: bsc,
          transport: http(process.env.BSC_RPC_URL!)
        };
      case 'bscTestnet':
        return {
          chain: bscTestnet,
          transport: http(process.env.BSC_TESTNET_RPC_URL!)
        };
      default:
        throw new Error(`Unsupported chain: ${chainName}`);
    }
  }
}
```

## 🧪 Testing Guidelines

### Unit Testing

```typescript
// src/tests/token.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenService } from '../services/token.service';
import { createPublicClient } from 'viem';
import { bsc } from 'viem/chains';

describe('TokenService', () => {
  let tokenService: TokenService;
  let mockPublicClient: ReturnType<typeof createPublicClient>;

  beforeEach(() => {
    mockPublicClient = createPublicClient({
      chain: bsc,
      transport: http('https://rpc-endpoint')
    });

    tokenService = new TokenService(mockPublicClient);
  });

  it('should get token balance', async () => {
    const mockBalance = 1000000000000000000n;

    vi.spyOn(mockPublicClient, 'readContract').mockResolvedValue(mockBalance);

    const result = await tokenService.getBalance(
      '0x123...' as Address,
      '0x456...' as Address
    );

    expect(result).toBe(mockBalance);
    expect(mockPublicClient.readContract).toHaveBeenCalledWith({
      address: '0x123...',
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: ['0x456...']
    });
  });
});
```

### Integration Testing

```typescript
// src/tests/integration/swap.integration.test.ts
import { describe, it, expect } from 'vitest';
import { SwapService } from '../services/swap.service';

describe('SwapService Integration', () => {
  let swapService: SwapService;

  beforeAll(() => {
    swapService = new SwapService(publicClient, walletClient);
  });

  it('should get swap quote', async () => {
    const quote = await swapService.getSwapQuote(
      BSC_ADDRESSES.WBNB,
      BSC_ADDRESSES.BUSD,
      '1'
    );

    expect(quote.amountIn).toBeGreaterThan(0n);
    expect(quote.amountOut).toBeGreaterThan(0n);
    expect(quote.path).toHaveLength(2);
  });
});
```

### Mock Testing

```typescript
// src/tests/mocks/viem.mock.ts
import { vi } from 'vitest';
import { PublicClient } from 'viem';

export const createMockPublicClient = (): Partial<PublicClient> => ({
  getBalance: vi.fn(),
  readContract: vi.fn(),
  multicall: vi.fn(),
  waitForTransactionReceipt: vi.fn()
});

export const createMockWalletClient = (): Partial<WalletClient> => ({
  sendTransaction: vi.fn(),
  writeContract: vi.fn(),
  account: {
    address: '0x1234567890123456789012345678901234567890' as Address
  }
});
```

## ⚡ Performance Optimization

### 1. Connection Pooling

```typescript
// src/utils/connection-pool.ts
class ConnectionPool {
  private clients: Map<string, PublicClient> = new Map();
  private maxSize = 5;

  getClient(rpcUrl: string): PublicClient {
    if (this.clients.has(rpcUrl)) {
      return this.clients.get(rpcUrl)!;
    }

    if (this.clients.size >= this.maxSize) {
      // Remove oldest client
      const firstKey = this.clients.keys().next().value;
      this.clients.delete(firstKey);
    }

    const client = createPublicClient({
      chain: bsc,
      transport: http(rpcUrl)
    });

    this.clients.set(rpcUrl, client);
    return client;
  }
}

export const connectionPool = new ConnectionPool();
```

### 2. Batch Processing

```typescript
// src/utils/batch-processor.ts
export class BatchProcessor {
  static async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize = 10
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(item => processor(item))
      );
      results.push(...batchResults);
    }

    return results;
  }
}
```

### 3. Caching Strategy

```typescript
// src/utils/cache.ts
export class TimedCache<K, V> {
  private cache = new Map<K, { value: V; expiry: number }>();
  private ttl: number;

  constructor(ttlMs: number = 60000) {
    this.ttl = ttlMs;
  }

  set(key: K, value: V): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl
    });
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const tokenCache = new TimedCache<Address, TokenInfo>(300000); // 5 minutes
```

## 🔒 Security Considerations

### 1. Private Key Management

```typescript
// src/utils/security.ts
import { decrypt } from './encryption';

export function getSecurePrivateKey(): `0x${string}` {
  const encryptedKey = process.env.ENCRYPTED_PRIVATE_KEY;
  const decryptionKey = process.env.DECRYPTION_KEY;

  if (!encryptedKey || !decryptionKey) {
    throw new Error('Missing encryption configuration');
  }

  return decrypt(encryptedKey, decryptionKey);
}
```

### 2. Input Validation

```typescript
// src/utils/validation.ts
export function validateAddress(address: unknown): Address {
  if (typeof address !== 'string' || !isAddress(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
  return getAddress(address);
}

export function validateAmount(amount: unknown): bigint {
  if (typeof amount !== 'string' && typeof amount !== 'bigint') {
    throw new Error(`Invalid amount type: ${typeof amount}`);
  }

  const parsedAmount = typeof amount === 'string' ? parseUnits(amount, 18) : amount;

  if (parsedAmount <= 0n) {
    throw new Error('Amount must be greater than 0');
  }

  return parsedAmount;
}
```

### 3. Rate Limiting

```typescript
// src/utils/rate-limiter.ts
export class RateLimiter {
  private requests = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing requests for this identifier
    let timestamps = this.requests.get(identifier) || [];

    // Remove old requests outside the window
    timestamps = timestamps.filter(timestamp => timestamp > windowStart);

    // Check if under limit
    if (timestamps.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    timestamps.push(now);
    this.requests.set(identifier, timestamps);

    return true;
  }
}
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Network Connection Issues

```typescript
// src/utils/network-check.ts
export async function checkNetworkHealth(client: PublicClient): Promise<boolean> {
  try {
    const blockNumber = await client.getBlockNumber();
    return blockNumber > 0;
  } catch (error) {
    console.error('Network health check failed:', error);
    return false;
  }
}

// Usage
const isHealthy = await checkNetworkHealth(publicClient);
if (!isHealthy) {
  // Switch to backup RPC
  const backupClient = createPublicClient({
    chain: bsc,
    transport: http(process.env.BACKUP_RPC_URL!)
  });
}
```

#### 2. Gas Estimation Failures

```typescript
// src/utils/gas-estimation.ts
export async function estimateGasWithFallback(
  client: WalletClient,
  transaction: any
): Promise<bigint> {
  try {
    return await client.estimateGas(transaction);
  } catch (error) {
    console.warn('Gas estimation failed, using fallback:', error);
    // Return a reasonable gas limit based on transaction type
    return 100000n; // 100k gas units as fallback
  }
}
```

#### 3. Transaction Reverts

```typescript
// src/utils/transaction-debug.ts
export async function debugTransactionRevert(
  client: PublicClient,
  hash: Address
): Promise<string> {
  try {
    const receipt = await client.getTransactionReceipt({ hash });
    const transaction = await client.getTransaction({ hash });

    return `Transaction ${hash} failed. Gas used: ${receipt.gasUsed}, Status: ${receipt.status}`;
  } catch (error) {
    return `Failed to debug transaction: ${error}`;
  }
}
```

## 📚 Reference Materials

### Quick Reference Cheatsheet

```typescript
// Import statements
import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  parseUnits,
  isAddress,
  getAddress,
  maxUint256,
  zeroAddress,
  BaseError,
  ContractFunctionExecutionError
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Client creation
const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });
const walletClient = createWalletClient({
  account: privateKeyToAccount(privateKey),
  chain: bsc,
  transport: http(rpcUrl)
});

// Common operations
const balance = await publicClient.getBalance({ address });
const blockNumber = await publicClient.getBlockNumber();
const gasPrice = await publicClient.getGasPrice();

// Contract interactions
const result = await publicClient.readContract({
  address: contractAddress,
  abi: contractAbi,
  functionName: 'balanceOf',
  args: [address]
});

const hash = await walletClient.writeContract({
  address: contractAddress,
  abi: contractAbi,
  functionName: 'transfer',
  args: [to, amount]
});
```

### Common ABI Templates

```typescript
// ERC-20 ABI
const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

// Uniswap/PancakeSwap Router ABI
const ROUTER_ABI = [
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    name: 'swapExactTokensForTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;
```

## 🤝 Community & Support

### Official Resources

- **Viem Documentation**: https://viem.sh/
- **Viem GitHub**: https://github.com/wevm/viem
- **Viem Discord**: https://discord.gg/viem
- **BSC Documentation**: https://docs.binance.org/smart-chain/

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| RPC rate limiting | Implement retry logic with exponential backoff |
| Transaction stuck | Use higher gas price or check nonce |
| Invalid address | Use `isAddress()` and `getAddress()` for validation |
| Contract revert | Check function arguments and contract state |
| Gas estimation fails | Use fallback gas limit or debug transaction |

### Best Practices Checklist

- [ ] Always validate addresses before use
- [ ] Implement proper error handling
- [ ] Use TypeScript for type safety
- [ ] Cache frequently accessed data
- [ ] Implement rate limiting for API calls
- [ ] Use multicall for batch operations
- [ ] Secure private keys properly
- [ ] Monitor gas prices and optimize transactions
- [ ] Write comprehensive tests
- [ ] Keep dependencies updated

---

## 🎉 Conclusion

This developer resource guide provides a comprehensive foundation for working with Viem 2.38.5 in the BSC DEX backend. Following these best practices and patterns will help you build robust, secure, and performant blockchain applications.

For additional support or questions, refer to the official Viem documentation or reach out to the development team.

---

*Last updated: November 5, 2025*
*Version: 2.38.5*