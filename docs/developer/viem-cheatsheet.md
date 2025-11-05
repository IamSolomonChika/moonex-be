# ⚡ Viem 2.38.5 Cheatsheet

Quick reference for common Viem operations and patterns.

## 🚀 Getting Started

### Installation

```bash
pnpm add viem@2.38.5
pnpm add -D @types/node
```

### Basic Imports

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  WebSocket,
  formatUnits,
  parseUnits,
  isAddress,
  getAddress,
  BaseError,
  ContractFunctionExecutionError,
  TransactionExecutionError,
  Chain,
  PublicClient,
  WalletClient
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
```

## 🌐 Client Setup

### Public Client (Read Operations)

```typescript
const publicClient = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-dataseed1.binance.org/')
});

// With WebSocket for real-time updates
const wsClient = createPublicClient({
  chain: bsc,
  transport: WebSocket('wss://bsc-ws-node.nariox.org:443')
});
```

### Wallet Client (Write Operations)

```typescript
const account = privateKeyToAccount('0x_PRIVATE_KEY');

const walletClient = createWalletClient({
  account,
  chain: bsc,
  transport: http('https://bsc-dataseed1.binance.org/')
});
```

### Custom Chain Configuration

```typescript
const customChain: Chain = {
  id: 56,
  name: 'BNB Smart Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: {
    public: { http: ['https://bsc-dataseed1.binance.org/'] },
    default: { http: ['https://bsc-dataseed1.binance.org/'] }
  },
  blockExplorers: {
    default: { name: 'BscScan', url: 'https://bscscan.com' }
  }
};
```

## 🔍 Common Operations

### Balance Queries

```typescript
// Get BNB balance
const balance = await publicClient.getBalance({
  address: '0x742d35Cc6634C0532925a3b8D4E7E0E0e9e0dF3b'
});

// Get ERC-20 token balance
const tokenBalance = await publicClient.readContract({
  address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // BUSD
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: ['0x742d35Cc6634C0532925a3b8D4E7E0E0e9e0dF3b']
});
```

### Token Information

```typescript
// Get token info
const [name, symbol, decimals, totalSupply] = await publicClient.multicall({
  contracts: [
    {
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'name'
    },
    {
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'symbol'
    },
    {
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'decimals'
    },
    {
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'totalSupply'
    }
  ]
});
```

### Block Information

```typescript
// Get latest block
const latestBlock = await publicClient.getBlock();

// Get block by number
const block = await publicClient.getBlock({
  blockNumber: BigInt(12345678)
});

// Get transaction count
const transactionCount = await publicClient.getTransactionCount({
  address: '0x742d35Cc6634C0532925a3b8D4E7E0E0e9e0dF3b'
});
```

## 💸 Transaction Operations

### Send BNB

```typescript
const hash = await walletClient.sendTransaction({
  to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  value: parseUnits('0.1', 18) // 0.1 BNB
});

const receipt = await publicClient.waitForTransactionReceipt({ hash });
```

### ERC-20 Transfer

```typescript
const hash = await walletClient.writeContract({
  address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // BUSD
  abi: erc20Abi,
  functionName: 'transfer',
  args: ['0x70997970C51812dc3A010C7d01b50e0d17dc79C8', parseUnits('100', 18)]
});
```

### Contract Interaction

```typescript
// Read from contract
const result = await publicClient.readContract({
  address: contractAddress,
  abi: contractAbi,
  functionName: 'getSomeValue',
  args: [param1, param2]
});

// Write to contract
const hash = await walletClient.writeContract({
  address: contractAddress,
  abi: contractAbi,
  functionName: 'setSomeValue',
  args: [newValue]
});
```

## 🔄 Event Listening

### Event Subscription

```typescript
const unwatch = publicClient.watchEvent({
  address: tokenAddress,
  abi: erc20Abi,
  eventName: 'Transfer',
  onLogs: (logs) => {
    console.log('New Transfer events:', logs);
  }
});

// Stop watching
unwatch();
```

### Historical Events

```typescript
const logs = await publicClient.getLogs({
  address: tokenAddress,
  abi: erc20Abi,
  eventName: 'Transfer',
  fromBlock: BigInt(12345678),
  toBlock: BigInt(12345688)
});
```

## 🔧 Utility Functions

### Address Validation

```typescript
// Validate address
function validateAddress(address: string): `0x${string}` {
  if (!isAddress(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
  return getAddress(address); // Returns checksummed address
}

// Usage
const validAddress = validateAddress('0x742d35cc6634c0532925a3b8d4e7e0e0e9e0df3b');
// Returns: '0x742d35Cc6634C0532925a3b8D4E7E0E0e9e0dF3b'
```

### Unit Conversion

```typescript
// Convert ether units to wei
const amountInWei = parseUnits('1.5', 18); // 1500000000000000000n

// Convert wei to ether units
const amountInEther = formatUnits(1500000000000000000n, 18); // '1.5'

// Different decimals
const tokenAmount = parseUnits('100.25', 6); // For USDT-like tokens
const formatted = formatUnits(100250000n, 6); // '100.25'
```

### Gas Estimation

```typescript
// Estimate gas for transaction
const gasEstimate = await publicClient.estimateGas({
  account: account.address,
  to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  value: parseUnits('0.1', 18)
});

// Get gas price
const gasPrice = await publicClient.getGasPrice();

// Get fee data (EIP-1559)
const feeData = await publicClient.getFeeData();
```

## 📊 Multicall

### Batch Contract Calls

```typescript
import { multicall } from 'viem/actions';

const results = await multicall(publicClient, {
  contracts: [
    {
      address: tokenA,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [userAddress]
    },
    {
      address: tokenB,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [userAddress]
    },
    {
      address: tokenA,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [userAddress, spenderAddress]
    }
  ]
});

// results is an array of results for each call
const tokenABalance = results[0].result;
const tokenBBalance = results[1].result;
const allowance = results[2].result;
```

## 🛡️ Error Handling

### Try-Catch Pattern

```typescript
try {
  const balance = await publicClient.getBalance({ address });
  return balance;
} catch (error) {
  if (error instanceof BaseError) {
    // Handle Viem-specific errors
    console.error('Viem error:', error.message);
    console.error('Error code:', error.code);

    // Specific error types
    if (error instanceof ContractFunctionExecutionError) {
      console.error('Contract execution failed');
    } else if (error instanceof TransactionExecutionError) {
      console.error('Transaction execution failed');
    }
  }
  throw error;
}
```

### Common Error Codes

```typescript
const handleCommonErrors = (error: BaseError) => {
  switch (error.code) {
    case 'INSUFFICIENT_FUNDS':
      throw new Error('Insufficient balance for this transaction');

    case 'NONCE_TOO_LOW':
    case 'NONCE_TOO_HIGH':
      throw new Error('Invalid transaction nonce');

    case 'GAS_LIMIT_EXCEEDED':
      throw new Error('Gas limit too low for transaction');

    case 'REVERT':
      throw new Error(`Contract reverted: ${error.details}`);

    default:
      throw new Error(`Transaction failed: ${error.message}`);
  }
};
```

## 🎯 Common Patterns

### Retry Logic

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // Exponential backoff
      await new Promise(resolve =>
        setTimeout(resolve, delay * Math.pow(2, i))
      );
    }
  }
  throw new Error('Max retries exceeded');
}
```

### Cached Calls

```typescript
const cache = new Map<string, { data: any; timestamp: number }>();

async function cachedCall<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = 300000 // 5 minutes
): Promise<T> {
  const cached = cache.get(key);

  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }

  const data = await fn();
  cache.set(key, { data, timestamp: Date.now() });

  return data;
}
```

### Rate Limiting

```typescript
class RateLimiter {
  private lastCall = 0;
  private readonly minInterval: number;

  constructor(callsPerSecond: number) {
    this.minInterval = 1000 / callsPerSecond;
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCall;

    if (timeSinceLastCall < this.minInterval) {
      const delay = this.minInterval - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastCall = Date.now();
  }
}
```

## 📋 ERC-20 ABI

```typescript
const erc20Abi = [
  // Read functions
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  // Write functions
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
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
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' }
    ],
    name: 'Transfer',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: true, name: 'spender', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' }
    ],
    name: 'Approval',
    type: 'event'
  }
] as const;
```

## 🔍 Debugging Tips

### Transaction Debugging

```typescript
// Get transaction details
const tx = await publicClient.getTransaction({ hash });
console.log('Transaction:', tx);

// Get transaction receipt
const receipt = await publicClient.getTransactionReceipt({ hash });
console.log('Receipt:', receipt);

// Simulate transaction
try {
  await publicClient.call({
    account: account.address,
    to: contractAddress,
    data: '0x...',
    value: parseUnits('0.1', 18)
  });
} catch (error) {
  console.error('Simulation failed:', error);
}
```

### Gas Optimization

```typescript
// Optimize gas usage
const optimizedTx = await walletClient.sendTransaction({
  to: contractAddress,
  data: encodedData,
  gasLimit: await publicClient.estimateGas({
    account: account.address,
    to: contractAddress,
    data: encodedData
  }),
  gasPrice: await publicClient.getGasPrice(),
  type: 'eip1559' // Use EIP-1559 if supported
});
```

---

This cheatsheet covers the most common Viem operations. For more detailed information, refer to the [official Viem documentation](https://viem.sh/).