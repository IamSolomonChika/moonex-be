# ⚡ Viem 2.38.5 Quick Reference

**BSC DEX Backend - Essential Commands & Patterns**

## 📋 Table of Contents

1. [Essential Imports](#essential-imports)
2. [Client Setup](#client-setup)
3. [Common Operations](#common-operations)
4. [Contract Interactions](#contract-interactions)
5. [Error Handling](#error-handling)
6. [Unit Conversions](#unit-conversions)
7. [BSC Specifics](#bsc-specifics)
8. [Testing Patterns](#testing-patterns)

## 🔗 Essential Imports

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
  maxUint256,
  zeroAddress,
  BaseError,
  ContractFunctionExecutionError,
  type PublicClient,
  type WalletClient,
  type Address,
  type Hex
} from 'viem';

import { bsc, bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
```

## 🛠️ Client Setup

```typescript
// Public Client (Read operations)
const publicClient = createPublicClient({
  chain: bsc,
  transport: http(process.env.BSC_RPC_URL!)
});

// Wallet Client (Write operations)
const account = privateKeyToAccount(process.env.PRIVATE_KEY! as `0x${string}`);
const walletClient = createWalletClient({
  account,
  chain: bsc,
  transport: http(process.env.BSC_RPC_URL!)
});

// WebSocket Client (Real-time updates)
const wsClient = createPublicClient({
  chain: bsc,
  transport: WebSocket(process.env.BSC_WS_URL!)
});
```

## 🔄 Common Operations

### Balance Queries

```typescript
// Native balance (BNB)
const bnbBalance = await publicClient.getBalance({
  address: '0x742d35Cc6634C0532925a3b8D4E7E0E0e9e0dF3b'
});

// Token balance
const tokenBalance = await publicClient.readContract({
  address: tokenAddress,
  abi: ERC20_ABI,
  functionName: 'balanceOf',
  args: [address]
});
```

### Block Information

```typescript
// Current block number
const blockNumber = await publicClient.getBlockNumber();

// Block details
const block = await publicClient.getBlock({
  blockNumber: 'latest',
  includeTransactions: true
});
```

### Gas Information

```typescript
// Gas price
const gasPrice = await publicClient.getGasPrice();

// Estimate gas
const gasEstimate = await walletClient.estimateGas({
  to: recipient,
  value: amount
});
```

## 📄 Contract Interactions

### Read Contract

```typescript
const result = await publicClient.readContract({
  address: contractAddress,
  abi: contractAbi,
  functionName: 'balanceOf',
  args: [address]
});

// Multicall - Multiple read operations
const [name, symbol, decimals] = await publicClient.multicall({
  contracts: [
    { address: tokenAddress, abi: ERC20_ABI, functionName: 'name' },
    { address: tokenAddress, abi: ERC20_ABI, functionName: 'symbol' },
    { address: tokenAddress, abi: ERC20_ABI, functionName: 'decimals' }
  ]
});
```

### Write Contract

```typescript
const hash = await walletClient.writeContract({
  address: contractAddress,
  abi: contractAbi,
  functionName: 'transfer',
  args: [recipient, amount]
});

// Wait for confirmation
const receipt = await publicClient.waitForTransactionReceipt({
  hash,
  confirmations: 2
});
```

### Send Transaction

```typescript
const hash = await walletClient.sendTransaction({
  to: recipient,
  value: parseUnits('1', 18), // 1 ETH/BNB
  gas: 21000n
});

const receipt = await publicClient.waitForTransactionReceipt({ hash });
```

## ⚠️ Error Handling

```typescript
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

## 🔄 Unit Conversions

```typescript
// To wei/smallest unit
const amountInWei = parseUnits('1.5', 18); // 1.5 tokens → wei
const ethAmount = parseUnits('0.01', 18);  // 0.01 ETH → wei
const usdtAmount = parseUnits('100', 6);  // 100 USDT → base units

// From wei/largest unit
const formattedAmount = formatUnits(1500000000000000000n, 18); // 1.5 tokens
const ethFormatted = formatUnits(10000000000000000n, 18);     // 0.01 ETH
const usdtFormatted = formatUnits(100000000n, 6);            // 100 USDT

// Percentage calculations
const percentOfAmount = (amount: bigint, percent: number): bigint => {
  return (amount * BigInt(Math.floor(percent * 10000))) / BigInt(10000);
};

const fivePercent = percentOfAmount(1000000000000000000n, 5); // 5% of 1 token
```

## 🔗 BSC Specifics

### Common Addresses

```typescript
const BSC_ADDRESSES = {
  WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  USDT: '0x55d398326f99059fF775485246999027B3197955',
  CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
  PANCAKE_ROUTER_V2: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  PANCAKE_FACTORY_V2: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73'
} as const;
```

### PancakeSwap Swap Example

```typescript
// Get swap quote
const amounts = await publicClient.readContract({
  address: BSC_ADDRESSES.PANCAKE_ROUTER_V2,
  abi: PANCAKE_ROUTER_ABI,
  functionName: 'getAmountsOut',
  args: [parseUnits('1', 18), [BSC_ADDRESSES.WBNB, BSC_ADDRESSES.BUSD]]
});

// Execute swap
const hash = await walletClient.writeContract({
  address: BSC_ADDRESSES.PANCAKE_ROUTER_V2,
  abi: PANCAKE_ROUTER_ABI,
  functionName: 'swapExactTokensForTokens',
  args: [
    amountIn,
    minAmountOut,
    [WBNB_ADDRESS, BUSD_ADDRESS],
    walletClient.account.address,
    deadline
  ]
});
```

## 🧪 Testing Patterns

### Mock Setup

```typescript
import { vi } from 'vitest';

// Mock public client
const mockPublicClient = {
  getBalance: vi.fn(),
  readContract: vi.fn(),
  multicall: vi.fn(),
  waitForTransactionReceipt: vi.fn()
};

// Mock wallet client
const mockWalletClient = {
  writeContract: vi.fn(),
  sendTransaction: vi.fn(),
  account: { address: '0x123...' }
};
```

### Test Example

```typescript
it('should get token balance', async () => {
  const mockBalance = 1000000000000000000n;

  mockPublicClient.readContract.mockResolvedValue(mockBalance);

  const result = await tokenService.getBalance(tokenAddress, walletAddress);

  expect(result).toBe(mockBalance);
  expect(mockPublicClient.readContract).toHaveBeenCalledWith({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [walletAddress]
  });
});
```

## 📚 Common ABIs

### ERC-20 Token

```typescript
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
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;
```

### PancakeSwap Router

```typescript
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
  },
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' }
    ],
    name: 'getAmountsOut',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;
```

## 🎯 Utility Functions

### Address Validation

```typescript
function validateAddress(address: string): Address {
  if (!isAddress(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
  return getAddress(address);
}
```

### Transaction Formatting

```typescript
function formatTransaction(tx: any) {
  return {
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    value: formatUnits(tx.value || 0n, 18),
    gasUsed: tx.gasUsed?.toString(),
    gasPrice: tx.gasPrice ? formatUnits(tx.gasPrice, 9) : 'N/A',
    status: tx.status === 'success' ? 'Success' : 'Failed'
  };
}
```

### Slippage Calculation

```typescript
function calculateSlippage(amount: bigint, slippagePercent: number): bigint {
  return (amount * BigInt(Math.floor(slippagePercent * 10000))) / BigInt(10000);
}

const minAmountOut = amountOut - calculateSlippage(amountOut, 0.5); // 0.5% slippage
```

---

## 🔥 Pro Tips

1. **Always validate addresses** before using them in transactions
2. **Use multicall** for batch read operations to reduce RPC calls
3. **Implement proper error handling** for network issues and contract reverts
4. **Cache frequently accessed data** like token information
5. **Use TypeScript** for better type safety and developer experience
6. **Set appropriate gas limits** to avoid transaction failures
7. **Monitor gas prices** for cost-effective transactions
8. **Write comprehensive tests** for all blockchain interactions

---

*Quick Reference v2.38.5 | Last Updated: 2025-11-05*