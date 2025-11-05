# 🔄 Viem 2.38.5 Migration Guide

## Overview

This comprehensive migration guide will walk you through migrating from Ethers.js to Viem 2.38.5 in the Moonex BE project. This migration provides significant performance improvements, better TypeScript support, and enhanced security features.

## Table of Contents

1. [Pre-Migration Checklist](#pre-migration-checklist)
2. [Understanding Key Differences](#understanding-key-differences)
3. [Step-by-Step Migration](#step-by-step-migration)
4. [Service Migration Examples](#service-migration-examples)
5. [API Endpoint Migration](#api-endpoint-migration)
6. [Testing Migration](#testing-migration)
7. [Configuration Updates](#configuration-updates)
8. [Common Issues and Solutions](#common-issues-and-solutions)
9. [Post-Migration Validation](#post-migration-validation)

### Target Version

- **From**: Ethers.js v5/v6
- **To**: Viem v2.38.5
- **Chain Focus**: BSC Mainnet & Testnet
- **Application Type**: DeFi/DEX Integration

## Why Migrate to Viem?

### Key Benefits

1. **Type Safety**: Built-in TypeScript with enhanced type inference
2. **Performance**: ~30% smaller bundle size and optimized RPC calls
3. **Modern API**: Cleaner, more intuitive interface design
4. **Chain Support**: Built-in support for BSC and other EVM chains
5. **Developer Experience**: Better error messages and debugging tools

### Performance Improvements

```javascript
// Bundle size comparison
// Ethers.js: ~650KB gzipped
// Viem: ~450KB gzipped
// Reduction: ~30% smaller

// RPC call optimization
// Viem uses batch requests by default
// Reduced round trips by ~40%
```

## Pre-Migration Checklist

### Prerequisites

- [ ] Node.js 18+ installed
- [ ] pnpm package manager
- [ ] Backup of current codebase
- [ ] Test environment set up
- [ ] Access to BSC testnet and mainnet RPC endpoints
- [ ] Test accounts with sufficient funds

### Environment Preparation

```bash
# 1. Create a new branch for migration
git checkout -b feature/viem-2.38.5-migration

# 2. Update dependencies
pnpm add viem@2.38.5
pnpm remove ethers @ethersproject/*

# 3. Install new development dependencies
pnpm add -D @types/node@latest

# 4. Generate Prisma client (if applicable)
pnpm prisma generate
```

## Understanding Key Differences

### 1. Client Creation

**Ethers.js (Old):**
```typescript
import { ethers } from 'ethers';

const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
const wallet = new ethers.Wallet(privateKey, provider);
```

**Viem (New):**
```typescript
import { createPublicClient, createWalletClient, http } from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const publicClient = createPublicClient({
  chain: bsc,
  transport: http(rpcUrl)
});

const account = privateKeyToAccount(privateKey);
const walletClient = createWalletClient({
  account,
  chain: bsc,
  transport: http(rpcUrl)
});
```

### 2. Number Handling

**Ethers.js (Old):**
```typescript
import { BigNumber } from 'ethers';

const amount = BigNumber.from('1000000000000000000');
const balance = await provider.getBalance(address);
```

**Viem (New):**
```typescript
const amount = 1000000000000000000n; // BigInt
const balance = await publicClient.getBalance({ address });
```

### 3. Contract Interaction

**Ethers.js (Old):**
```typescript
const contract = new ethers.Contract(address, abi, provider);
const result = await contract.someMethod(param1, param2);
```

**Viem (New):**
```typescript
const result = await publicClient.readContract({
  address,
  abi,
  functionName: 'someMethod',
  args: [param1, param2]
});
```

## Step-by-Step Migration

### Step 1: Update Import Statements

**Files to Update:**
- `src/services/token-service.ts`
- `src/services/swap-service.ts`
- `src/services/liquidity-service.ts`
- `src/services/yield-farming-service.ts`
- `src/config/bsc.ts`

**Example Migration:**

```typescript
// Remove old ethers imports
// import { ethers, BigNumber, Contract } from 'ethers';
// import { Contract as ContractInstance } from '@ethersproject/contracts';

// Add new Viem imports
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  Hex,
  Address,
  ContractFunctionExecutionError,
  Chain
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
```

### Step 2: Update Client Configuration

**Example: `src/config/bsc.ts`**

```typescript
export const VIEM_BSC_CONFIG = {
  mainnet: {
    chain: bsc,
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org',
    blockExplorerUrl: 'https://bscscan.com'
  },
  testnet: {
    chain: bscTestnet,
    rpcUrl: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
    blockExplorerUrl: 'https://testnet.bscscan.com'
  }
};

export const createViemClient = (network: 'mainnet' | 'testnet' = 'mainnet') => {
  const config = VIEM_BSC_CONFIG[network];
  return createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
    batch: {
      multicall: true,
    }
  });
};
```

### Step 3: Update Service Classes

#### Token Service Migration

**Before (Ethers.js):**
```typescript
export class TokenService {
  constructor(private provider: ethers.providers.JsonRpcProvider) {}

  async getTokenInfo(address: string): Promise<TokenInfo> {
    const contract = new ethers.Contract(address, ERC20_ABI, this.provider);
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
      contract.totalSupply()
    ]);

    return {
      address,
      name,
      symbol,
      decimals: decimals.toNumber(),
      totalSupply
    };
  }
}
```

**After (Viem):**
```typescript
export class TokenService {
  constructor(private publicClient: PublicClient) {}

  async getTokenInfo(address: Address): Promise<TokenInfo> {
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      this.publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'name'
      }),
      this.publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'symbol'
      }),
      this.publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'decimals'
      }),
      this.publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'totalSupply'
      })
    ]);

    return {
      address,
      name: name as string,
      symbol: symbol as string,
      decimals: decimals as number,
      totalSupply: totalSupply as bigint
    };
  }
}
```

#### Swap Service Migration

**Key Changes:**
1. Replace `BigNumber` with `BigInt`
2. Update transaction building
3. Change gas estimation

```typescript
export class SwapService {
  constructor(
    private publicClient: PublicClient,
    private walletClient: WalletClient
  ) {}

  async getSwapQuote(params: SwapQuoteParams): Promise<SwapQuote> {
    // Use Viem's multicall for efficient data retrieval
    const multicallResults = await this.publicClient.multicall({
      contracts: [
        {
          address: PANCAKESWAP_ROUTER,
          abi: PANCAKESWAP_ROUTER_ABI,
          functionName: 'getAmountsOut',
          args: [params.amountIn, [params.tokenIn, params.tokenOut]]
        }
      ]
    });

    const amountsOut = multicallResults[0].result as bigint[];
    const amountOut = amountsOut[amountsOut.length - 1];

    return {
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amountIn,
      amountOut,
      slippageTolerancePercent: params.slippageTolerancePercent,
      minimumAmountOut: amountOut * (100n - BigInt(params.slippageTolerancePercent * 100)) / 100n
    };
  }

  async executeSwap(params: SwapExecutionParams): Promise<TransactionHash> {
    try {
      // Estimate gas
      const gasEstimate = await this.walletClient.estimateGas({
        to: PANCAKESWAP_ROUTER,
        data: encodeFunctionData({
          abi: PANCAKESWAP_ROUTER_ABI,
          functionName: 'swapExactTokensForTokens',
          args: [
            params.amountIn,
            params.amountOutMin,
            [params.tokenIn, params.tokenOut],
            params.recipient,
            BigInt(Math.floor(Date.now() / 1000) + 1200) // 20 minutes deadline
          ]
        }),
        account: this.walletClient.account
      });

      // Execute transaction
      const hash = await this.walletClient.writeContract({
        address: PANCAKESWAP_ROUTER,
        abi: PANCAKESWAP_ROUTER_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [
          params.amountIn,
          params.amountOutMin,
          [params.tokenIn, params.tokenOut],
          params.recipient,
          BigInt(Math.floor(Date.now() / 1000) + 1200)
        ],
        gas: gasEstimate
      });

      return hash;
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new SwapExecutionError(
          `Swap execution failed: ${error.message}`,
          error.cause as any
        );
      }
      throw error;
    }
  }
}
```

### Step 4: Update API Endpoints

#### Token Info Endpoint

**Migration Example:**

```typescript
// Controller method
export async function getTokenInfo(
  request: FastifyRequest<{ Params: { address: string } }>,
  reply: FastifyReply
) {
  try {
    const { address } = request.params;

    // Validate address format using Viem
    if (!isAddress(address)) {
      return reply.status(400).send({
        success: false,
        error: 'INVALID_ADDRESS',
        message: 'Invalid token address format'
      });
    }

    const tokenService = new TokenService(createViemClient());
    const tokenInfo = await tokenService.getTokenInfo(address as Address);

    return reply.send({
      success: true,
      data: tokenInfo
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      error: 'TOKEN_INFO_FETCH_FAILED',
      message: 'Failed to fetch token information'
    });
  }
}
```

### Step 5: Update Tests

#### Unit Test Migration

```typescript
describe('TokenService - Viem Migration', () => {
  let tokenService: TokenService;
  let mockPublicClient: jest.Mocked<PublicClient>;

  beforeEach(() => {
    mockPublicClient = {
      readContract: jest.fn(),
      multicall: jest.fn(),
    } as any;

    tokenService = new TokenService(mockPublicClient);
  });

  test('should get token info using Viem', async () => {
    const mockTokenInfo = {
      name: 'Wrapped BNB',
      symbol: 'WBNB',
      decimals: 18,
      totalSupply: 1000000000000000000000000n
    };

    mockPublicClient.readContract
      .mockResolvedValueOnce(mockTokenInfo.name)
      .mockResolvedValueOnce(mockTokenInfo.symbol)
      .mockResolvedValueOnce(mockTokenInfo.decimals)
      .mockResolvedValueOnce(mockTokenInfo.totalSupply);

    const result = await tokenService.getTokenInfo('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address);

    expect(result).toEqual({
      address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      ...mockTokenInfo
    });
  });
});
```

### Step 6: Update Configuration Files

#### Viem Configuration (`viem.config.js`)

```javascript
module.exports = {
  // Viem client configuration
  clients: {
    bsc: {
      chain: 'bsc',
      transport: {
        type: 'http',
        url: process.env.BSC_RPC_URL
      },
      batch: {
        multicall: true
      }
    },
    bscTestnet: {
      chain: 'bscTestnet',
      transport: {
        type: 'http',
        url: process.env.BSC_TESTNET_RPC_URL
      },
      batch: {
        multicall: true
      }
    }
  },

  // Contract addresses
  contracts: {
    pancakeswapRouter: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    wbnb: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    busd: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'
  },

  // Default settings
  defaults: {
    slippageTolerance: 0.5,
    gasMultiplier: 1.1,
    transactionTimeout: 20000
  }
};
```

## Service Migration Examples

### Complete Token Service Migration

```typescript
import { PublicClient, Address, isAddress, ContractFunctionExecutionError } from 'viem';
import { ERC20_ABI } from '../abis/erc20';

export interface TokenInfo {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  price?: number;
}

export class TokenService {
  constructor(private publicClient: PublicClient) {}

  async getTokenInfo(address: Address): Promise<TokenInfo> {
    try {
      if (!isAddress(address)) {
        throw new Error('Invalid token address');
      }

      const [name, symbol, decimals, totalSupply] = await Promise.all([
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'name'
        }),
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'symbol'
        }),
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'decimals'
        }),
        this.publicClient.readContract({
          address,
          abi: ERC20_ABI,
          functionName: 'totalSupply'
        })
      ]);

      return {
        address,
        name: name as string,
        symbol: symbol as string,
        decimals: decimals as number,
        totalSupply: totalSupply as bigint
      };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new Error(`Failed to fetch token info: ${error.message}`);
      }
      throw error;
    }
  }

  async getBalance(address: Address, tokenAddress: Address): Promise<bigint> {
    try {
      const balance = await this.publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address]
      });

      return balance as bigint;
    } catch (error) {
      throw new Error(`Failed to fetch token balance: ${error.message}`);
    }
  }

  async getMultipleBalances(address: Address, tokenAddresses: Address[]): Promise<Map<Address, bigint>> {
    const balances = new Map<Address, bigint>();

    const multicallResults = await this.publicClient.multicall({
      contracts: tokenAddresses.map(tokenAddress => ({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address]
      }))
    });

    multicallResults.forEach((result, index) => {
      if (result.status === 'success') {
        balances.set(tokenAddresses[index], result.result as bigint);
      }
    });

    return balances;
  }
}
```

## API Endpoint Migration

### Swap Quote Endpoint Migration

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { Address, isAddress, parseEther } from 'viem';
import { SwapService } from '../services/swap-service';
import { createViemClient } from '../config/bsc';

interface SwapQuoteRequest {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippageTolerancePercent: number;
}

export async function getSwapQuote(
  request: FastifyRequest<{ Body: SwapQuoteRequest }>,
  reply: FastifyReply
) {
  try {
    const { tokenIn, tokenOut, amountIn, slippageTolerancePercent } = request.body;

    // Validate inputs
    if (!isAddress(tokenIn) || !isAddress(tokenOut)) {
      return reply.status(400).send({
        success: false,
        error: 'INVALID_ADDRESS',
        message: 'Invalid token address format'
      });
    }

    if (!amountIn || isNaN(Number(amountIn)) || Number(amountIn) <= 0) {
      return reply.status(400).send({
        success: false,
        error: 'INVALID_AMOUNT',
        message: 'Invalid amount'
      });
    }

    // Create services
    const publicClient = createViemClient();
    const swapService = new SwapService(publicClient);

    // Get swap quote
    const quote = await swapService.getSwapQuote({
      tokenIn: tokenIn as Address,
      tokenOut: tokenOut as Address,
      amountIn: parseEther(amountIn),
      slippageTolerancePercent
    });

    return reply.send({
      success: true,
      data: {
        ...quote,
        amountIn: quote.amountIn.toString(),
        amountOut: quote.amountOut.toString(),
        minimumAmountOut: quote.minimumAmountOut.toString()
      }
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({
      success: false,
      error: 'SWAP_QUOTE_FAILED',
      message: 'Failed to generate swap quote'
    });
  }
}
```

## Testing Migration

### Integration Test Example

```typescript
describe('Swap Service Integration Tests - Viem', () => {
  let publicClient: PublicClient;
  let walletClient: WalletClient;
  let swapService: SwapService;

  beforeAll(async () => {
    publicClient = createPublicClient({
      chain: bscTestnet,
      transport: http(process.env.BSC_TESTNET_RPC_URL)
    });

    const testAccount = privateKeyToAccount(process.env.TEST_PRIVATE_KEY as `0x${string}`);
    walletClient = createWalletClient({
      account: testAccount,
      chain: bscTestnet,
      transport: http(process.env.BSC_TESTNET_RPC_URL)
    });

    swapService = new SwapService(publicClient, walletClient);
  });

  test('should generate swap quote correctly', async () => {
    const quote = await swapService.getSwapQuote({
      tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address, // WBNB
      tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address, // BUSD
      amountIn: parseEther('0.1'),
      slippageTolerancePercent: 0.5
    });

    expect(quote.tokenIn).toBe('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c');
    expect(quote.tokenOut).toBe('0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56');
    expect(quote.amountOut).toBeGreaterThan(0n);
    expect(quote.minimumAmountOut).toBeGreaterThan(0n);
  });
});
```

## Configuration Updates

### TypeScript Configuration

Update `tsconfig.json` to support Viem types:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "types": ["node", "jest"],
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": [
    "src/**/*",
    "tests/**/*"
  ],
  "exclude": [
    "node_modules",
    "build"
  ]
}
```

### Package.json Scripts

Update your npm scripts:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node build/index.js",
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "test": "jest",
    "test:viem": "jest --testPathPattern=viem",
    "test:integration": "jest --testPathPattern=integration",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "format": "prettier --write src/**/*.ts",
    "format:check": "prettier --check src/**/*.ts"
  }
}
```

## Common Issues and Solutions

### Issue 1: BigInt Serialization

**Problem:** JSON.stringify() doesn't handle BigInt values

**Solution:**
```typescript
// Create a custom JSON replacer
const jsonReplacer = (key: string, value: any) => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
};

// Usage
const jsonString = JSON.stringify(data, jsonReplacer);
```

### Issue 2: Address Validation

**Problem:** Ethers.js address validation is different from Viem

**Solution:**
```typescript
import { isAddress } from 'viem';

// Replace ethers address validation
// const isValid = ethers.utils.isAddress(address);
const isValid = isAddress(address);
```

### Issue 3: Gas Estimation

**Problem:** Viem gas estimation returns different values

**Solution:**
```typescript
// Add gas multiplier for safety
const gasEstimate = await walletClient.estimateGas({
  to: contractAddress,
  data: encodedData,
  account: walletClient.account
});

const gasLimit = gasEstimate * 110n / 100n; // 10% buffer
```

### Issue 4: Multicall Batch Size

**Problem:** Multicall calls exceed block gas limit

**Solution:**
```typescript
const BATCH_SIZE = 50;
const chunks = arrayChunk(addresses, BATCH_SIZE);

for (const chunk of chunks) {
  const results = await publicClient.multicall({
    contracts: chunk.map(addr => ({
      address: addr,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [userAddress]
    }))
  });

  // Process results...
}
```

## Post-Migration Validation

### 1. Run Full Test Suite

```bash
# Run all tests
pnpm test

# Run specific Viem tests
pnpm test:viem

# Run integration tests
pnpm test:integration
```

### 2. Performance Validation

```bash
# Run performance benchmarks
pnpm test:performance

# Check bundle size
pnpm analyze:bundle
```

### 3. Security Validation

```bash
# Run security audit
pnpm audit

# Run security tests
pnpm test:security
```

### 4. Manual Testing Checklist

- [ ] Token info retrieval works correctly
- [ ] Balance checking returns accurate results
- [ ] Swap quotes generate properly
- [ ] Liquidity calculations are correct
- [ ] Transaction execution completes successfully
- [ ] Error handling works as expected
- [ ] API endpoints respond correctly
- [ ] WebSocket connections are stable

### 5. Monitoring Setup

Set up monitoring for:
- RPC response times
- Transaction success rates
- Error frequencies
- Memory usage
- Gas costs

## Rollback Plan

If issues arise during migration:

1. **Immediate Rollback:**
   ```bash
   git checkout main
   pnpm install
   ```

2. **Database Rollback:**
   ```bash
   # If database schema changed
   pnpm prisma migrate reset
   ```

3. **Deployment Rollback:**
   ```bash
   # Use your deployment tool to rollback
   # For example, with Docker:
   docker-compose down
   docker tag moonex:latest moonex:backup
   docker-compose up -d
   ```

## Support Resources

- **Viem Documentation:** https://viem.sh/
- **Viem GitHub:** https://github.com/wagmi-dev/viem
- **BSC Documentation:** https://docs.binance.org/
- **Project Discord:** [Your Discord Server]
- **Technical Support:** [Your Support Email]

## Conclusion

This migration guide provides a comprehensive approach to migrating from Ethers.js to Viem 2.38.5. The key benefits of this migration include:

- **Better Performance:** Viem is optimized for modern JavaScript/TypeScript
- **Enhanced Type Safety:** Full TypeScript support with strict typing
- **Smaller Bundle Size:** Reduced dependencies and tree-shaking
- **Modern API:** Cleaner, more intuitive API design
- **Better Error Handling:** More detailed error information

Following this guide will ensure a smooth migration while maintaining code quality, security, and performance standards.

---

*Last Updated: November 2024*
*Version: 2.38.5*
*Maintainer: Moonex Development Team*