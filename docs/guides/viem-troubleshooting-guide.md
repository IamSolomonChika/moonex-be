# 🔧 Viem 2.38.5 Troubleshooting Guide

## Overview

This troubleshooting guide provides comprehensive solutions for common issues that may arise during and after the Viem 2.38.5 migration. It covers runtime errors, configuration issues, performance problems, and debugging techniques specific to Viem and BSC integration.

## Table of Contents

1. [Installation & Setup Issues](#installation--setup-issues)
2. [Configuration Problems](#configuration-problems)
3. [Runtime Errors](#runtime-errors)
4. [Performance Issues](#performance-issues)
5. [Network Connectivity](#network-connectivity)
6. [Transaction Failures](#transaction-failures)
7. [TypeScript & Type Errors](#typescript--type-errors)
8. [Testing & Debugging](#testing--debugging)
9. [BSC-Specific Issues](#bsc-specific-issues)
10. [Common Migration Pitfalls](#common-migration-pitfalls)
11. [Debugging Tools & Techniques](#debugging-tools--techniques)
12. [Emergency Procedures](#emergency-procedures)

## Installation & Setup Issues

### Issue: Version Conflicts

**Problem**: Conflicting Viem or TypeScript versions

```bash
npm ERR! peer dep missing: viem@^2.38.5, required by @project
npm ERR! peer dep missing: typescript@^5.0.0, required by viem
```

**Solutions**:

1. **Clean Installation**
   ```bash
   # Remove node_modules and lock file
   rm -rf node_modules pnpm-lock.yaml

   # Clear pnpm cache
   pnpm store prune

   # Reinstall with exact versions
   pnpm add viem@2.38.5 typescript@5.3.3
   ```

2. **Check Peer Dependencies**
   ```bash
   pnpm why viem
   pnpm why typescript
   ```

3. **Resolution Strategy**
   ```bash
   # Force resolution in package.json
   "pnpm": {
     "peerDependencyRules": {
       "ignoreMissing": ["@types/node"]
     }
   }
   ```

### Issue: Missing Chain Configuration

**Problem**: BSC chain not recognized

```typescript
Error: Chain "bsc" not found
```

**Solutions**:

1. **Install Chain Package**
   ```bash
   pnpm add viem/chains
   ```

2. **Import Chains Correctly**
   ```typescript
   import { bsc, bscTestnet } from 'viem/chains';
   // NOT: import { bsc } from 'viem';
   ```

3. **Custom Chain Configuration**
   ```typescript
   const customBsc = {
     id: 56,
     name: 'BNB Smart Chain',
     nativeCurrency: {
       name: 'BNB',
       symbol: 'BNB',
       decimals: 18
     },
     rpcUrls: {
       default: { http: ['https://bsc-dataseed1.binance.org'] }
     },
     blockExplorers: {
       default: { name: 'BscScan', url: 'https://bscscan.com' }
     }
   };
   ```

## Configuration Problems

### Issue: RPC Endpoint Failures

**Problem**: Unable to connect to BSC RPC

```typescript
Error: Failed to fetch RPC response
Error: ETIMEDOUT
Error: ECONNREFUSED
```

**Solutions**:

1. **Verify RPC URL**
   ```typescript
   // Test RPC endpoint
   const response = await fetch('https://bsc-dataseed1.binance.org', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       jsonrpc: '2.0',
       method: 'eth_blockNumber',
       params: [],
       id: 1
     })
   });
   ```

2. **Use Multiple RPC URLs**
   ```typescript
   const rpcUrls = [
     'https://bsc-dataseed1.binance.org',
     'https://bsc-dataseed2.binance.org',
     'https://bsc-dataseed3.binance.org'
   ];

   let client = null;
   for (const url of rpcUrls) {
     try {
       client = createPublicClient({
         chain: bsc,
         transport: http(url, { timeout: 10000 })
       });
       await client.getBlockNumber();
       break;
     } catch (error) {
       console.warn(`RPC ${url} failed:`, error.message);
     }
   }
   ```

3. **Add Fallback Transport**
   ```typescript
   import { createFallbackTransport } from 'viem';

   const client = createPublicClient({
     chain: bsc,
     transport: createFallbackTransport([
       http('https://bsc-dataseed1.binance.org'),
       http('https://bsc-dataseed2.binance.org')
     ])
   });
   ```

### Issue: Chain ID Mismatch

**Problem**: Chain ID doesn't match configured network

```typescript
Error: Chain ID mismatch. Expected 56, got 97
```

**Solutions**:

1. **Verify Chain Configuration**
   ```typescript
   console.log('Expected chain ID:', bsc.id); // 56
   console.log('Connected chain ID:', await client.getChainId());
   ```

2. **Dynamic Chain Detection**
   ```typescript
   const chainId = await client.getChainId();
   const supportedChains = { 56: bsc, 97: bscTestnet };

   if (!supportedChains[chainId]) {
     throw new Error(`Unsupported chain ID: ${chainId}`);
   }
   ```

## Runtime Errors

### Issue: Invalid Address Format

**Problem**: Address validation failures

```typescript
Error: Invalid address format
Type Error: Type 'string' is not assignable to type '0x${string}'
```

**Solutions**:

1. **Use Address Validation**
   ```typescript
   import { isAddress, getAddress } from 'viem';

   function validateAddress(address: string): `0x${string}` {
     if (!isAddress(address)) {
       throw new Error(`Invalid address: ${address}`);
     }
     return getAddress(address);
   }

   const validAddress = validateAddress(userInput);
   ```

2. **Type Assertion with Validation**
   ```typescript
   function safeAddress(address: string): `0x${string}` {
     if (!isAddress(address)) {
       throw new Error('Invalid address format');
     }
     return address as `0x${string}`;
   }
   ```

3. **Environment Variable Validation**
   ```typescript
   const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
   if (!CONTRACT_ADDRESS || !isAddress(CONTRACT_ADDRESS)) {
     throw new Error('Invalid CONTRACT_ADDRESS in environment');
   }
   ```

### Issue: BigInt Handling

**Problem**: BigInt serialization and calculation errors

```typescript
Error: Do not know how to serialize a BigInt
TypeError: Cannot convert a BigInt value to a number
```

**Solutions**:

1. **JSON Serialization with BigInt**
   ```typescript
   const jsonReplacer = (_key: string, value: any) => {
     if (typeof value === 'bigint') {
       return value.toString();
     }
     return value;
   };

   const jsonString = JSON.stringify(data, jsonReplacer);
   ```

2. **BigInt Type Guards**
   ```typescript
   function isBigInt(value: unknown): value is bigint {
     return typeof value === 'bigint';
   }

   function safeBigIntCalculation(a: bigint, b: bigint): bigint {
     if (!isBigInt(a) || !isBigInt(b)) {
       throw new Error('Both arguments must be BigInt');
     }
     return a + b;
   }
   ```

3. **API Response Transformation**
   ```typescript
   interface TokenInfo {
     address: string;
     balance: string; // Store as string
     decimals: number;
   }

   // Convert BigInt to string for API responses
   const apiResponse: TokenInfo = {
     address: token.address,
     balance: balance.toString(), // Convert BigInt to string
     decimals: token.decimals
   };
   ```

### Issue: Contract Function Errors

**Problem**: Contract interaction failures

```typescript
Error: Contract read reverted
Error: Transaction reverted
ContractFunctionExecutionError: execution reverted
```

**Solutions**:

1. **Detailed Error Handling**
   ```typescript
   import { ContractFunctionExecutionError } from 'viem';

   try {
     const result = await contract.read.someMethod([params]);
     return result;
   } catch (error) {
     if (error instanceof ContractFunctionExecutionError) {
       console.error('Contract execution failed:', {
         reason: error.reason,
         signature: error.signature,
         args: error.args,
         cause: error.cause
       });

       // Handle specific revert reasons
       if (error.reason?.includes('insufficient')) {
         throw new Error('Insufficient balance for this operation');
       }
     }
     throw error;
   }
   ```

2. **Contract ABI Validation**
   ```typescript
   function validateContractABI(abi: any[]): boolean {
     try {
       parseAbi(abi);
       return true;
     } catch (error) {
       console.error('Invalid ABI:', error);
       return false;
     }
   }
   ```

3. **Gas Estimation Safety**
   ```typescript
   async function safeGasEstimation(
     client: WalletClient,
     request: any
   ): Promise<bigint> {
     try {
       const estimate = await client.estimateGas(request);
       return estimate * 110n / 100n; // 10% buffer
     } catch (error) {
       console.warn('Gas estimation failed, using default:', error);
       return 200000n; // Default gas limit
     }
   }
   ```

## Performance Issues

### Issue: Slow RPC Response Times

**Problem**: High latency on blockchain calls

**Symptoms**:
- API requests taking >5 seconds
- Timeouts during swap quote generation
- Poor user experience

**Solutions**:

1. **Enable Batching and Multicall**
   ```typescript
   const client = createPublicClient({
     chain: bsc,
     transport: http(rpcUrl),
     batch: {
       multicall: true,
       batchSize: 50
     }
   });
   ```

2. **Implement Caching**
   ```typescript
   class TokenInfoCache {
     private cache = new Map<string, { data: any; timestamp: number }>();
     private ttl = 60000; // 1 minute

     async getTokenInfo(address: string): Promise<any> {
       const cached = this.cache.get(address);
       if (cached && Date.now() - cached.timestamp < this.ttl) {
         return cached.data;
       }

       const data = await this.fetchTokenInfo(address);
       this.cache.set(address, { data, timestamp: Date.now() });
       return data;
     }
   }
   ```

3. **Use WebSocket for Real-time Data**
   ```typescript
   const wsClient = createPublicClient({
     chain: bsc,
     transport: webSocket('wss://bsc-ws-node.nariox.org:443')
   });
   ```

4. **Optimize Multicall Batches**
   ```typescript
   function chunkArray<T>(array: T[], size: number): T[][] {
     const chunks: T[][] = [];
     for (let i = 0; i < array.length; i += size) {
       chunks.push(array.slice(i, i + size));
     }
     return chunks;
   }

   const addresses = ['0x...', '0x...', /* ... */];
   const chunks = chunkArray(addresses, 20); // Batch size of 20

   for (const chunk of chunks) {
     const results = await client.multicall({
       contracts: chunk.map(addr => ({
         address: addr,
         abi: tokenAbi,
         functionName: 'balanceOf',
         args: [userAddress]
       }))
     });
     // Process results...
   }
   ```

### Issue: Memory Leaks

**Problem**: Memory usage increasing over time

**Solutions**:

1. **Monitor Memory Usage**
   ```typescript
   function logMemoryUsage() {
     const usage = process.memoryUsage();
     console.log('Memory Usage:', {
       rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
       heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
       heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
       external: `${Math.round(usage.external / 1024 / 1024)} MB`
     });
   }

   // Log every 5 minutes
   setInterval(logMemoryUsage, 300000);
   ```

2. **Clean Up Event Listeners**
   ```typescript
   class ContractWatcher {
     private unwatchCallbacks: (() => void)[] = [];

     watchTransferEvent(callback: Function) {
       const unwatch = contract.watch.EventTransfer({}, callback);
       this.unwatchCallbacks.push(unwatch);
     }

     cleanup() {
       this.unwatchCallbacks.forEach(unwatch => unwatch());
       this.unwatchCallbacks = [];
     }
   }
   ```

3. **Limit Cache Size**
   ```typescript
   class LRUCache<K, V> {
     private cache = new Map<K, V>();
     private maxSize: number;

     constructor(maxSize: number = 1000) {
       this.maxSize = maxSize;
     }

     set(key: K, value: V) {
       if (this.cache.size >= this.maxSize) {
         const firstKey = this.cache.keys().next().value;
         this.cache.delete(firstKey);
       }
       this.cache.set(key, value);
     }
   }
   ```

## Network Connectivity

### Issue: WebSocket Connection Failures

**Problem**: WebSocket connections dropping frequently

```typescript
Error: WebSocket connection closed
Error: Unexpected server response: 403
```

**Solutions**:

1. **Implement WebSocket Reconnection**
   ```typescript
   class WebSocketClient {
     private client: PublicClient | null = null;
     private reconnectAttempts = 0;
     private maxReconnectAttempts = 5;

     async connect() {
       try {
         this.client = createPublicClient({
           chain: bsc,
           transport: webSocket(wsUrl, {
             retryCount: 3,
             timeout: 10000
           })
         });

         // Test connection
         await this.client.getBlockNumber();
         this.reconnectAttempts = 0;
       } catch (error) {
         if (this.reconnectAttempts < this.maxReconnectAttempts) {
           this.reconnectAttempts++;
           const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
           setTimeout(() => this.connect(), delay);
         }
       }
     }
   }
   ```

2. **Fallback to HTTP**
   ```typescript
   async function createResilientClient(): Promise<PublicClient> {
     try {
       // Try WebSocket first
       return createPublicClient({
         chain: bsc,
         transport: webSocket(wsUrl)
       });
     } catch (error) {
       console.warn('WebSocket failed, falling back to HTTP:', error);
       return createPublicClient({
         chain: bsc,
         transport: http(rpcUrl)
       });
     }
   }
   ```

### Issue: Rate Limiting

**Problem**: RPC provider rate limiting requests

```typescript
Error: Too many requests
Error: Rate limit exceeded
Error: 429 Too Many Requests
```

**Solutions**:

1. **Implement Request Throttling**
   ```typescript
   class RateLimiter {
     private lastRequest = 0;
     private minInterval = 100; // 100ms between requests

     async throttle<T>(fn: () => Promise<T>): Promise<T> {
       const now = Date.now();
       const timeSinceLastRequest = now - this.lastRequest;

       if (timeSinceLastRequest < this.minInterval) {
         await new Promise(resolve =>
           setTimeout(resolve, this.minInterval - timeSinceLastRequest)
         );
       }

       this.lastRequest = Date.now();
       return fn();
     }
   }

   const rateLimiter = new RateLimiter();

   // Usage
   const blockNumber = await rateLimiter.throttle(() => client.getBlockNumber());
   ```

2. **Use Multiple RPC Providers**
   ```typescript
   const providers = [
     'https://bsc-dataseed1.binance.org',
     'https://bsc-dataseed2.binance.org',
     'https://bsc-dataseed3.binance.org'
   ];

   class LoadBalancer {
     private currentIndex = 0;

     getNextProvider(): string {
       const provider = providers[this.currentIndex];
       this.currentIndex = (this.currentIndex + 1) % providers.length;
       return provider;
     }
   }
   ```

## Transaction Failures

### Issue: Gas Estimation Failures

**Problem**: Unable to estimate gas for transactions

```typescript
Error: Gas estimation failed
Error: Transaction execution reverted
```

**Solutions**:

1. **Detailed Gas Error Analysis**
   ```typescript
   async function debugGasEstimation(
     client: WalletClient,
     transaction: any
   ): Promise<void> {
     try {
       const gasEstimate = await client.estimateGas(transaction);
       console.log('Gas estimate:', gasEstimate);
     } catch (error) {
       console.error('Gas estimation failed:', {
         error: error.message,
         transaction,
         cause: error.cause
       });

       // Try with higher gas limit
       try {
         const result = await client.simulateContract({
           ...transaction,
           gas: 500000n
         });
         console.log('Simulation result:', result);
       } catch (simError) {
         console.error('Simulation also failed:', simError.message);
       }
     }
   }
   ```

2. **Manual Gas Configuration**
   ```typescript
   async function executeTransactionWithGasBuffer(
     client: WalletClient,
     transaction: any
   ): Promise<`0x${string}`> {
     const gasPrice = await client.getGasPrice();
     const baseFee = await client.getFeeData();

     const enhancedTransaction = {
       ...transaction,
       gasPrice: gasPrice * 110n / 100n, // 10% buffer
       maxFeePerGas: baseFee.maxFeePerGas * 120n / 100n, // 20% buffer
       maxPriorityFeePerGas: baseFee.maxPriorityFeePerGas * 120n / 100n
     };

     return client.sendTransaction(enhancedTransaction);
   }
   ```

### Issue: Nonce Conflicts

**Problem**: Transaction nonce issues

```typescript
Error: Nonce too low
Error: Nonce too high
Error: Transaction already imported
```

**Solutions**:

1. **Nonce Management**
   ```typescript
   class NonceManager {
     private nonceMap = new Map<string, bigint>();
     private client: WalletClient;

     constructor(client: WalletClient) {
       this.client = client;
     }

     async getNextNonce(address: `0x${string}`): Promise<bigint> {
       const cached = this.nonceMap.get(address);
       const networkNonce = await this.client.getTransactionCount({
         address,
         blockTag: 'pending'
       });

       const nextNonce = cached && cached > networkNonce ? cached : networkNonce;
       this.nonceMap.set(address, nextNonce + 1n);
       return nextNonce;
     }

     resetNonce(address: `0x${string}`) {
       this.nonceMap.delete(address);
     }
   }
   ```

2. **Transaction Queue**
   ```typescript
   class TransactionQueue {
     private queue: Array<{
       transaction: any;
       resolve: (hash: string) => void;
       reject: (error: Error) => void;
     }> = [];
     private processing = false;

     async add(transaction: any): Promise<string> {
       return new Promise((resolve, reject) => {
         this.queue.push({ transaction, resolve, reject });
         this.processQueue();
       });
     }

     private async processQueue() {
       if (this.processing || this.queue.length === 0) return;

       this.processing = true;

       while (this.queue.length > 0) {
         const { transaction, resolve, reject } = this.queue.shift()!;

         try {
           const hash = await this.executeTransaction(transaction);
           resolve(hash);
         } catch (error) {
           reject(error);
         }
       }

       this.processing = false;
     }
   }
   ```

## TypeScript & Type Errors

### Issue: Type Inference Problems

**Problem**: TypeScript unable to infer correct types

```typescript
Error: Argument of type 'unknown' is not assignable to parameter
Error: Property 'result' does not exist on type '...'
```

**Solutions**:

1. **Explicit Type Annotations**
   ```typescript
   import type { Abi, Address } from 'viem';

   const ERC20_ABI = [
     'function balanceOf(address owner) view returns (uint256)',
     'function transfer(address to, uint256 amount) returns (bool)'
   ] as const;

   type ERC20Abi = typeof ERC20_ABI;

   async function getTokenBalance(
     client: PublicClient,
     tokenAddress: Address,
     owner: Address
   ): Promise<bigint> {
     const balance = await client.readContract<ERC20Abi>({
       address: tokenAddress,
       abi: ERC20_ABI,
       functionName: 'balanceOf',
       args: [owner]
     });

     return balance as bigint;
   }
   ```

2. **Type Guards for Contract Results**
   ```typescript
   function isContractResult(result: unknown): result is readonly unknown[] {
     return Array.isArray(result) && result.length > 0;
   }

   function processMulticallResult(result: unknown) {
     if (!isContractResult(result)) {
       throw new Error('Invalid multicall result');
     }

     return result.map(item => {
       if (item && typeof item === 'object' && 'result' in item) {
         return item.result;
       }
       throw new Error('Invalid result item');
     });
   }
   ```

### Issue: Generic Type Constraints

**Problem**: Complex generic type errors

**Solutions**:

1. **Constrained Generic Types**
   ```typescript
   interface ReadContractConfig<
     TAbi extends Abi | readonly unknown[],
     TFunctionName extends string = string
   > {
     address: Address;
     abi: TAbi;
     functionName: TFunctionName;
     args?: any[];
   }

   async function safeReadContract<
     TAbi extends Abi | readonly unknown[],
     TFunctionName extends string
   >(
     client: PublicClient,
     config: ReadContractConfig<TAbi, TFunctionName>
   ): Promise<any> {
     try {
       return await client.readContract(config);
     } catch (error) {
       console.error(`Contract read failed for ${config.functionName}:`, error);
       throw error;
     }
   }
   ```

## Testing & Debugging

### Issue: Test Environment Setup

**Problem**: Tests failing due to environment configuration

**Solutions**:

1. **Mock Viem Clients for Testing**
   ```typescript
   import { vi } from 'vitest';

   const mockPublicClient = {
     getBlockNumber: vi.fn().mockResolvedValue(12345n),
     getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
     readContract: vi.fn().mockResolvedValue(100n),
     multicall: vi.fn().mockResolvedValue([
       { status: 'success', result: 100n },
       { status: 'success', result: 200n }
     ])
   };

   vi.mock('viem', () => ({
     createPublicClient: vi.fn(() => mockPublicClient),
     createWalletClient: vi.fn(() => mockWalletClient)
   }));
   ```

2. **Test Utilities**
   ```typescript
   export function createTestClient(
     overrides: Partial<PublicClient> = {}
   ): PublicClient {
     return {
       getBlockNumber: async () => 12345n,
       getBalance: async () => 1000000000000000000n,
       readContract: async () => 100n,
       ...overrides
     } as PublicClient;
   }

   export function createTestContract(address: Address) {
     return getContract({
       address,
       abi: ERC20_ABI,
       client: createTestClient()
     });
   }
   ```

### Issue: Debugging Contract Interactions

**Problem**: Difficulty debugging contract calls

**Solutions**:

1. **Transaction Debugging**
   ```typescript
   async function debugTransaction(
     client: PublicClient,
     hash: `0x${string}`
   ): Promise<void> {
     try {
       const receipt = await client.getTransactionReceipt({ hash });
       const transaction = await client.getTransaction({ hash });

       console.log('Transaction Debug Info:', {
         hash,
         status: receipt.status,
         gasUsed: receipt.gasUsed,
         gasLimit: transaction.gas,
         gasPrice: transaction.gasPrice,
         to: transaction.to,
         value: transaction.value,
         input: transaction.input
       });

       if (receipt.status === 'reverted') {
         console.error('Transaction was reverted');

         // Try to simulate to get revert reason
         try {
           const simulation = await client.call({
             to: transaction.to!,
             data: transaction.input,
             from: transaction.from
           });
           console.log('Simulation result:', simulation);
         } catch (simError) {
           console.error('Simulation failed:', simError.message);
         }
       }
     } catch (error) {
       console.error('Failed to debug transaction:', error);
     }
   }
   ```

2. **Contract Call Tracing**
   ```typescript
   async function traceContractCall<T>(
     contract: any,
     functionName: string,
     args: any[]
   ): Promise<T> {
     console.log(`Calling ${functionName} with args:`, args);

     const startTime = performance.now();

     try {
       const result = await contract[functionName](...args);
       const endTime = performance.now();

       console.log(`${functionName} completed in ${endTime - startTime}ms:`, result);
       return result;
     } catch (error) {
       const endTime = performance.now();
       console.error(`${functionName} failed after ${endTime - startTime}ms:`, error);
       throw error;
     }
   }
   ```

## BSC-Specific Issues

### Issue: BSC Gas Price Volatility

**Problem**: Unpredictable gas prices on BSC

**Solutions**:

1. **Dynamic Gas Pricing**
   ```typescript
   async function getOptimalGasPrice(client: PublicClient): Promise<bigint> {
     const gasPrice = await client.getGasPrice();
     const block = await client.getBlock();

     // Adjust based on block utilization
     const utilization = Number(block.gasUsed) / Number(block.gasLimit);
     let multiplier = 1.0;

     if (utilization > 0.8) {
       multiplier = 1.2; // High congestion
     } else if (utilization < 0.3) {
       multiplier = 0.9; // Low congestion
     }

     return BigInt(Math.floor(Number(gasPrice) * multiplier));
   }
   ```

2. **Gas Price History Tracking**
   ```typescript
   class GasPriceTracker {
     private history: bigint[] = [];
     private maxHistory = 100;

     addGasPrice(gasPrice: bigint) {
       this.history.push(gasPrice);
       if (this.history.length > this.maxHistory) {
         this.history.shift();
       }
     }

     getAverageGasPrice(): bigint {
       if (this.history.length === 0) return 0n;

       const sum = this.history.reduce((acc, price) => acc + price, 0n);
       return sum / BigInt(this.history.length);
     }

     getPercentileGasPrice(percentile: number): bigint {
       if (this.history.length === 0) return 0n;

       const sorted = [...this.history].sort((a, b) =>
         Number(a) - Number(b)
       );

       const index = Math.floor(sorted.length * percentile / 100);
       return sorted[index];
     }
   }
   ```

### Issue: PancakeSwap Integration

**Problem**: Issues with PancakeSwap router interactions

**Solutions**:

1. **Router Address Validation**
   ```typescript
   const PANCAKESWAP_ROUTERS = {
     56: '0x10ED43C718714eb63d5aA57B78B54704E256024E', // Mainnet
     97: '0xD99D1c33F9fC3444f8101754aBC46c52416550D01'  // Testnet
   };

   function getPancakeRouter(chainId: number): Address {
     const router = PANCAKESWAP_ROUTERS[chainId as keyof typeof PANCAKESWAP_ROUTERS];
     if (!router) {
       throw new Error(`PancakeSwap router not found for chain ID: ${chainId}`);
     }
     return router as Address;
   }
   ```

2. **Slippage Handling**
   ```typescript
   function calculateSlippageAmount(
     amountOut: bigint,
     slippagePercent: number
   ): bigint {
     return amountOut * (10000n - BigInt(slippagePercent * 100)) / 10000n;
   }

   async function executeSwapWithSlippageProtection(
     client: WalletClient,
     params: SwapParams
   ): Promise<`0x${string}`> {
     const quote = await getSwapQuote(params);
     const minimumAmountOut = calculateSlippageAmount(
       quote.amountOut,
       params.slippageTolerancePercent
     );

     return client.writeContract({
       address: getPancakeRouter(client.chain.id),
       abi: PANCAKESWAP_ROUTER_ABI,
       functionName: 'swapExactTokensForTokens',
       args: [
         params.amountIn,
         minimumAmountOut,
         [params.tokenIn, params.tokenOut],
         params.recipient,
         BigInt(Math.floor(Date.now() / 1000) + 1200) // 20 min deadline
       ]
     });
   }
   ```

## Common Migration Pitfalls

### Issue: Ethers.js Patterns in Viem

**Problem**: Using Ethers.js patterns with Viem

**Common Mistakes**:

1. **Incorrect Client Usage**
   ```typescript
   // WRONG (Ethers.js pattern)
   const balance = await provider.getBalance(address);

   // CORRECT (Viem pattern)
   const balance = await publicClient.getBalance({ address });
   ```

2. **Wrong Contract Interaction**
   ```typescript
   // WRONG (Ethers.js pattern)
   const result = await contract.someMethod(param1, param2);

   // CORRECT (Viem pattern)
   const result = await contract.read.someMethod([param1, param2]);
   ```

3. **Transaction Handling**
   ```typescript
   // WRONG (Ethers.js pattern)
   const tx = await contract.transfer(to, amount);
   const receipt = await tx.wait();

   // CORRECT (Viem pattern)
   const hash = await contract.write.transfer([to, amount]);
   const receipt = await publicClient.waitForTransactionReceipt({ hash });
   ```

### Issue: BigInt vs Number Confusion

**Problem**: Mixing BigInt and Number types

**Solutions**:

1. **Consistent Type Usage**
   ```typescript
   // Always use BigInt for blockchain values
   const amount: bigint = parseEther('1.0');
   const gasPrice: bigint = await client.getGasPrice();

   // Convert to Number only for display
   const displayAmount = Number(formatEther(amount));
   ```

2. **Type Conversion Utilities**
   ```typescript
   function toBigInt(value: string | number | bigint): bigint {
     if (typeof value === 'bigint') return value;
     if (typeof value === 'number') return BigInt(value);
     return BigInt(value);
   }

   function toNumber(value: bigint): number {
     if (value > Number.MAX_SAFE_INTEGER) {
       throw new Error('BigInt too large to convert to Number safely');
     }
     return Number(value);
   }
   ```

## Debugging Tools & Techniques

### Issue: Logging and Monitoring

**Problem**: Insufficient visibility into system behavior

**Solutions**:

1. **Structured Logging**
   ```typescript
   interface LogContext {
     requestId: string;
     userId?: string;
     method: string;
     duration?: number;
     error?: Error;
   }

   class Logger {
     log(level: 'info' | 'warn' | 'error', message: string, context: LogContext) {
       const logEntry = {
         timestamp: new Date().toISOString(),
         level,
         message,
         ...context
       };

       console.log(JSON.stringify(logEntry));
     }

     info(message: string, context: LogContext) {
       this.log('info', message, context);
     }

     error(message: string, error: Error, context: LogContext) {
       this.log('error', message, { ...context, error: error.message });
     }
   }
   ```

2. **Performance Monitoring**
   ```typescript
   class PerformanceMonitor {
     private metrics = new Map<string, number[]>();

     startTimer(name: string): () => void {
       const start = performance.now();

       return () => {
         const duration = performance.now() - start;

         if (!this.metrics.has(name)) {
           this.metrics.set(name, []);
         }

         this.metrics.get(name)!.push(duration);

         // Keep only last 100 measurements
         const measurements = this.metrics.get(name)!;
         if (measurements.length > 100) {
           measurements.shift();
         }
       };
     }

     getAverageTime(name: string): number {
       const measurements = this.metrics.get(name) || [];
       if (measurements.length === 0) return 0;

       const sum = measurements.reduce((acc, time) => acc + time, 0);
       return sum / measurements.length;
     }

     getMetrics(): Record<string, { avg: number; count: number }> {
       const result: Record<string, { avg: number; count: number }> = {};

       for (const [name, measurements] of this.metrics.entries()) {
         result[name] = {
           avg: this.getAverageTime(name),
           count: measurements.length
         };
       }

       return result;
     }
   }
   ```

### Issue: Health Checks

**Problem**: Difficulty detecting system health issues

**Solutions**:

1. **Health Check Endpoint**
   ```typescript
   class HealthChecker {
     private checks: Array<{
       name: string;
       check: () => Promise<boolean>;
       timeout: number;
     }> = [];

     addCheck(name: string, check: () => Promise<boolean>, timeout = 5000) {
       this.checks.push({ name, check, timeout });
     }

     async runHealthChecks(): Promise<{
       healthy: boolean;
       checks: Record<string, boolean | string>;
     }> {
       const results: Record<string, boolean | string> = {};
       let allHealthy = true;

       for (const { name, check, timeout } of this.checks) {
         try {
           const result = await Promise.race([
             check(),
             new Promise<never>((_, reject) =>
               setTimeout(() => reject(new Error('Timeout')), timeout)
             )
           ]);

           results[name] = result;
           if (!result) allHealthy = false;
         } catch (error) {
           results[name] = error.message;
           allHealthy = false;
         }
       }

       return { healthy: allHealthy, checks: results };
     }
   }

   // Usage
   const healthChecker = new HealthChecker();

   healthChecker.addCheck('bsc-rpc', async () => {
     const blockNumber = await publicClient.getBlockNumber();
     return blockNumber > 0n;
   });

   healthChecker.addCheck('pancake-router', async () => {
     const factory = await pancakeRouter.read.factory();
     return factory !== '0x0000000000000000000000000000000000000000';
   });
   ```

## Emergency Procedures

### Issue: System Outages

**Problem**: Complete system failure

**Emergency Response Plan**:

1. **Immediate Actions**
   ```typescript
   class EmergencyMode {
     private isEmergency = false;
     private fallbackData: Record<string, any> = {};

     enableEmergencyMode(reason: string) {
       this.isEmergency = true;
       console.error('EMERGENCY MODE ENABLED:', reason);

       // Switch to read-only mode
       // Disable all write operations
       // Serve cached data where available
     }

     isEmergencyMode(): boolean {
       return this.isEmergency;
     }

     getFallbackData(key: string): any {
       return this.fallbackData[key];
     }
   }
   ```

2. **Circuit Breaker Pattern**
   ```typescript
   class CircuitBreaker {
     private failures = 0;
     private lastFailureTime = 0;
     private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

     constructor(
       private threshold = 5,
       private timeout = 60000, // 1 minute
       private monitorPeriod = 10000 // 10 seconds
     ) {}

     async execute<T>(fn: () => Promise<T>): Promise<T> {
       if (this.state === 'OPEN') {
         if (Date.now() - this.lastFailureTime > this.timeout) {
           this.state = 'HALF_OPEN';
         } else {
           throw new Error('Circuit breaker is OPEN');
         }
       }

       try {
         const result = await fn();
         this.onSuccess();
         return result;
       } catch (error) {
         this.onFailure();
         throw error;
       }
     }

     private onSuccess() {
       this.failures = 0;
       this.state = 'CLOSED';
     }

     private onFailure() {
       this.failures++;
       this.lastFailureTime = Date.now();

       if (this.failures >= this.threshold) {
         this.state = 'OPEN';
       }
     }
   }
   ```

### Issue: Data Recovery

**Problem**: Recovering from data corruption or loss

**Recovery Procedures**:

1. **Backup Verification**
   ```typescript
   class BackupManager {
     async verifyBackup(backupPath: string): Promise<boolean> {
       try {
         const backup = JSON.parse(await fs.readFile(backupPath, 'utf8'));

         // Verify backup structure
         const requiredFields = ['timestamp', 'version', 'data'];
         for (const field of requiredFields) {
           if (!(field in backup)) {
             console.error(`Backup missing required field: ${field}`);
             return false;
           }
         }

         // Verify data integrity
         const checksum = this.calculateChecksum(backup.data);
         if (backup.checksum !== checksum) {
           console.error('Backup checksum mismatch');
           return false;
         }

         return true;
       } catch (error) {
         console.error('Backup verification failed:', error);
         return false;
       }
     }

     private calculateChecksum(data: any): string {
       return keccak256(toHex(JSON.stringify(data)));
     }
   }
   ```

2. **Graceful Degradation**
   ```typescript
   class GracefulDegradation {
     private serviceLevels = {
       full: 'full',
       limited: 'limited',
       emergency: 'emergency'
     };

     private currentLevel = this.serviceLevels.full;

     degradeService(reason: string) {
       console.warn(`Degrading service level: ${reason}`);

       if (this.currentLevel === this.serviceLevels.full) {
         this.currentLevel = this.serviceLevels.limited;
         // Disable non-essential features
       } else if (this.currentLevel === this.serviceLevels.limited) {
         this.currentLevel = this.serviceLevels.emergency;
         // Only essential features available
       }
     }

     canExecuteOperation(operation: string): boolean {
       const emergencyOperations = ['health-check', 'read-only-data'];
       const limitedOperations = [...emergencyOperations, 'basic-reads'];

       switch (this.currentLevel) {
         case this.serviceLevels.emergency:
           return emergencyOperations.includes(operation);
         case this.serviceLevels.limited:
           return limitedOperations.includes(operation);
         case this.serviceLevels.full:
           return true;
         default:
           return false;
       }
     }
   }
   ```

## Quick Reference Solutions

### Most Common Issues

1. **Address Format Error**
   ```typescript
   import { isAddress, getAddress } from 'viem';

   function fixAddress(address: string): `0x${string}` {
     if (!isAddress(address)) {
       throw new Error(`Invalid address: ${address}`);
     }
     return getAddress(address);
   }
   ```

2. **BigInt JSON Error**
   ```typescript
   const jsonString = JSON.stringify(data, (key, value) =>
     typeof value === 'bigint' ? value.toString() : value
   );
   ```

3. **Gas Estimation Failure**
   ```typescript
   const gasLimit = gasEstimate * 110n / 100n; // Add 10% buffer
   ```

4. **RPC Connection Timeout**
   ```typescript
   const client = createPublicClient({
     chain: bsc,
     transport: http(rpcUrl, { timeout: 10000, retryCount: 3 })
   });
   ```

5. **Contract Revert Error**
   ```typescript
   try {
     return await contract.read.someMethod([params]);
   } catch (error) {
     if (error instanceof ContractFunctionExecutionError) {
       console.error('Contract reverted:', error.reason);
     }
     throw error;
   }
   ```

## Support Channels

### Getting Help

1. **Internal Support**
   - Development Team Slack
   - Technical Documentation
   - Code Review Process

2. **External Resources**
   - Viem Documentation: https://viem.sh/
   - Viem GitHub Issues: https://github.com/wagmi-dev/viem/issues
   - BSC Documentation: https://docs.binance.org/

3. **Monitoring and Alerting**
   - Set up alerts for error rates
   - Monitor performance metrics
   - Track transaction success rates

---

*Last Updated: November 2024*
*Version: 2.38.5*
*Maintainer: Moonex Development Team*
---

*Last Updated: November 2024*
*Version: 2.38.5*
*Maintainer: Moonex Development Team*