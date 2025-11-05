# BSC Integration Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Viem Migration Guide](#viem-migration-guide)
5. [BSC Network Configuration](#bsc-network-configuration)
6. [PancakeSwap Integration](#pancakeswap-integration)
7. [Smart Contract Interaction](#smart-contract-interaction)
8. [Error Handling](#error-handling)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)
11. [Advanced Topics](#advanced-topics)
12. [Migration from Ethers.js to Viem](#migration-from-ethersjs-to-viem)

## Overview

This guide provides comprehensive instructions for integrating with the Binance Smart Chain (BSC) network and PancakeSwap DEX protocol using **Viem 2.38.5**. It covers everything from basic setup to advanced trading strategies, including the migration from Ethers.js to Viem.

### What's New in Viem Integration

- **Type Safety**: Full TypeScript support with enhanced type safety
- **Performance**: Optimized RPC calls and reduced bundle size
- **Modern API**: Cleaner, more intuitive API design
- **BSC Optimizations**: Built-in BSC-specific optimizations
- **Enhanced Testing**: Comprehensive test coverage with Viem-based tests

## Prerequisites

### Required Dependencies

```bash
# Install Viem for blockchain interactions (recommended)
pnpm add viem@2.38.5

# Install Viem chains for BSC support
pnpm add viem/chains

# For React applications
pnpm add wagmi @wagmi/core

# For Node.js backend
pnpm add viem @prisma/client dotenv

# Legacy Ethers.js support (if needed for migration)
pnpm add ethers
```

### Environment Variables

Create a `.env` file with the following variables:

```env
# BSC Network Configuration
BSC_RPC_URL=https://bsc-dataseed1.binance.org
BSC_RPC_URL_FALLBACK=https://bsc-dataseed2.binance.org
BSC_RPC_URL_TESTNET=https://data-seed-prebsc-1-s1.binance.org:8545

# BSC Chain Configuration
BSC_CHAIN_ID=56
BSC_CHAIN_ID_TESTNET=97

# PancakeSwap Contracts
PANCAKESWAP_ROUTER_V2=0x10ed43c718714eb63d5aa57b78b54704e256024e
PANCAKESWAP_ROUTER_V3=0x1b81D678ffb9C0263b24A97847620C99d213eB14
PANCAKESWAP_FACTORY_V2=0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73
PANCAKESWAP_MASTER_CHEF_V1=0x73feaa1eE314F8c655E354234017bE2193C9E24E
PANCAKESWAP_MASTER_CHEF_V2=0xa5f8C5DBd5F7206A938745d5898732843F7d896D

# API Configuration
API_BASE_URL=https://api.bsc-dex.com/v1
API_KEY=your_api_key_here

# Wallet Configuration
WALLET_PRIVATE_KEY=your_private_key_here
MNEMONIC=your_mnemonic_phrase_here

# Security
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_encryption_key_here
```

## Environment Setup

### 1. Initialize BSC Viem Clients

```javascript
import { createPublicClient, createWalletClient, http, webSocket } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';

// Public client for read operations (Mainnet)
const publicClient = createPublicClient({
  chain: bsc,
  transport: http(process.env.BSC_RPC_URL)
});

// Public client for read operations (Testnet)
const testnetPublicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(process.env.BSC_RPC_URL_TESTNET)
});

// WebSocket Client for real-time updates
const webSocketClient = createPublicClient({
  chain: bsc,
  transport: webSocket('wss://bsc-ws-node.nariox.org:443')
});
```

### 2. Setup Wallet with Viem

```javascript
import { createWalletClient, http } from 'viem';
import { bsc } from 'viem/chains';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';

// From private key
const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY);
const walletClient = createWalletClient({
  account,
  chain: bsc,
  transport: http(process.env.BSC_RPC_URL)
});

// From mnemonic
const mnemonicAccount = mnemonicToAccount(process.env.MNEMONIC);
const mnemonicWalletClient = createWalletClient({
  account: mnemonicAccount,
  chain: bsc,
  transport: http(process.env.BSC_RPC_URL)
});

// Get wallet information
console.log('Wallet Address:', walletClient.account.address);
const balance = await publicClient.getBalance({
  address: walletClient.account.address
});
console.log('Wallet Balance:', balance);
```

### 3. Initialize PancakeSwap Contracts with Viem

```javascript
import { getContract, parseAbi } from 'viem';

// PancakeSwap Router V2 ABI (simplified)
const PANCAKESWAP_ROUTER_V2_ABI = parseAbi([
  'function WETH() external pure returns (address)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)'
]);

// PancakeSwap Factory ABI (simplified)
const PANCAKESWAP_FACTORY_ABI = parseAbi([
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
  'function allPairs(uint) external view returns (address pair)',
  'function allPairsLength() external view returns (uint)',
  'function createPair(address tokenA, address tokenB) external returns (address pair)'
]);

// Initialize contracts with Viem
const pancakeRouterV2 = getContract({
  address: process.env.PANCAKESWAP_ROUTER_V2,
  abi: PANCAKESWAP_ROUTER_V2_ABI,
  client: publicClient
});

const pancakeFactoryV2 = getContract({
  address: process.env.PANCAKESWAP_FACTORY_V2,
  abi: PANCAKESWAP_FACTORY_ABI,
  client: publicClient
});

// For write operations, use wallet client
const pancakeRouterV2Write = getContract({
  address: process.env.PANCAKESWAP_ROUTER_V2,
  abi: PANCAKESWAP_ROUTER_V2_ABI,
  client: walletClient
});
```

## Viem Migration Guide

### Key Differences from Ethers.js

1. **Client-based Architecture**: Viem uses clients instead of providers
2. **Enhanced TypeScript**: Built-in TypeScript support with better type inference
3. **Simplified API**: More intuitive and cleaner API methods
4. **Performance Optimizations**: Better performance and smaller bundle size
5. **Modern Standards**: Follows modern JavaScript/TypeScript patterns

### Quick Migration Reference

| Ethers.js | Viem | Notes |
|-----------|------|-------|
| `new ethers.providers.JsonRpcProvider()` | `createPublicClient()` | Public client for read operations |
| `new ethers.Wallet()` | `createWalletClient()` | Wallet client for write operations |
| `provider.getBalance()` | `publicClient.getBalance()` | Same method, different client |
| `wallet.sendTransaction()` | `walletClient.sendTransaction()` | Same method, different client |
| `ethers.utils.parseEther()` | `parseEther()` | Direct import from viem |
| `ethers.utils.formatEther()` | `formatEther()` | Direct import from viem |

### Viem-Specific Features

- **Built-in BSC Support**: Native BSC chain configuration
- **Type-safe Contract Calls**: Enhanced contract interaction types
- **Better Error Handling**: More descriptive error messages
- **Optimized Batching**: Efficient batch request handling
- **WebSocket Support**: Built-in WebSocket for real-time updates

### Migration Example: Environment Setup

#### Before (Ethers.js)
```javascript
import { ethers } from 'ethers';

const bscProvider = new ethers.providers.JsonRpcProvider(
  process.env.BSC_RPC_URL,
  {
    name: 'bsc',
    chainId: parseInt(process.env.BSC_CHAIN_ID),
    ensAddress: null
  }
);

const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, bscProvider);
```

#### After (Viem)
```javascript
import { createPublicClient, createWalletClient, http } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';

// Public client for read operations
const publicClient = createPublicClient({
  chain: bsc,
  transport: http(process.env.BSC_RPC_URL)
});

// Wallet client for write operations
const account = mnemonicToAccount(process.env.MNEMONIC);
const walletClient = createWalletClient({
  account,
  chain: bsc,
  transport: http(process.env.BSC_RPC_URL)
});
```

### Migration Example: Contract Interaction

#### Before (Ethers.js)
```javascript
const contract = new ethers.Contract(
  contractAddress,
  abi,
  wallet
);

const result = await contract.someFunction(param1, param2);
```

#### After (Viem)
```javascript
const result = await walletClient.writeContract({
  address: contractAddress,
  abi,
  functionName: 'someFunction',
  args: [param1, param2]
});

// For read operations
const readResult = await publicClient.readContract({
  address: contractAddress,
  abi,
  functionName: 'viewFunction',
  args: [param1]
});
```

## BSC Network Configuration

### Network Settings

BSC has specific characteristics that affect integration:

```javascript
const BSC_CONFIG = {
  // Network details
  chainId: 56,
  name: 'BSC',
  rpcUrls: {
    mainnet: [
      'https://bsc-dataseed1.binance.org',
      'https://bsc-dataseed2.binance.org',
      'https://bsc-dataseed3.binance.org',
      'https://bsc-dataseed4.binance.org'
    ],
    testnet: [
      'https://data-seed-prebsc-1-s1.binance.org:8545',
      'https://data-seed-prebsc-2-s1.binance.org:8545'
    ]
  },

  // Block configuration
  blockTime: 3000, // 3 seconds
  gasLimit: {
    default: 21000,
    tokenTransfer: 65000,
    contractInteraction: 100000
  },

  // Gas configuration
  gasPrice: {
    slow: '5000000000',      // 5 Gwei
    standard: '10000000000', // 10 Gwei
    fast: '20000000000',     // 20 Gwei
    instant: '50000000000'  // 50 Gwei
  },

  // Native currency
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18
  }
};
```

### Gas Optimization with Viem

```javascript
class BSCGasOptimizerViem {
  constructor(publicClient, walletClient) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }

  async getOptimalGasPrice() {
    try {
      // Get current gas price with Viem
      const gasPrice = await this.publicClient.getGasPrice();

      // BSC-specific optimization (10% discount)
      const optimizedGasPrice = (gasPrice * 90n) / 100n;

      return gasPrice; // Return bigint for Viem compatibility
    } catch (error) {
      console.error('Failed to get optimal gas price:', error);
      return BigInt(BSC_CONFIG.gasPrice.standard);
    }
  }

  async estimateGasWithBuffer(transaction, bufferPercent = 20) {
    try {
      const gasEstimate = await this.publicClient.estimateGas(transaction);
      const buffer = (gasEstimate * BigInt(bufferPercent)) / 100n;
      return gasEstimate + buffer;
    } catch (error) {
      console.error('Gas estimation failed:', error);
      return BigInt(BSC_CONFIG.gasLimit.contractInteraction);
    }
  }

  async prepareTransaction(transaction) {
    const gasLimit = await this.estimateGasWithBuffer(transaction);
    const gasPrice = await this.getOptimalGasPrice();

    return {
      ...transaction,
      gas: gasLimit,
      gasPrice: gasPrice
    };
  }
}
```

## PancakeSwap Integration

### Token Swap Implementation with Viem

```javascript
class PancakeSwapTraderViem {
  constructor(routerContract, publicClient, walletClient) {
    this.router = routerContract;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.gasOptimizer = new BSCGasOptimizerViem(publicClient, walletClient);
  }

  async swapExactTokensForTokens(
    amountIn,
    tokenIn,
    tokenOut,
    recipient,
    slippageTolerancePercent = 1
  ) {
    try {
      // Create path
      const path = [tokenIn.address, tokenOut.address];

      // Get expected output amount using Viem
      const amounts = await this.router.read.getAmountsOut([amountIn, path]);
      const amountOutMin = (amounts[1] * BigInt(100 - slippageTolerancePercent)) / 100n;

      // Set deadline (20 minutes from now)
      const deadline = Math.floor(Date.now() / 1000) + 1200;

      // Prepare transaction with gas optimization
      const transaction = await this.gasOptimizer.prepareTransaction({
        to: this.router.address,
        data: this.router.interface.encodeFunctionData(
          'swapExactTokensForTokens',
          [amountIn, amountOutMin, path, recipient, deadline]
        )
      });

      // Execute transaction using Viem
      const transactionHash = await this.walletClient.writeContract({
        address: this.router.address,
        abi: this.router.abi,
        functionName: 'swapExactTokensForTokens',
        args: [amountIn, amountOutMin, path, recipient, deadline],
        gas: transaction.gas,
        gasPrice: transaction.gasPrice
      });

      console.log('Swap transaction sent:', transactionHash);

      // Wait for confirmation using Viem
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: transactionHash
      });
      console.log('Swap confirmed:', receipt.transactionHash);

      return {
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString(),
        actualAmountOut: this.parseSwapLogs(receipt.logs)
      };

    } catch (error) {
      console.error('Swap failed:', error);
      throw new Error(`Swap execution failed: ${error.message}`);
    }
  }

  async getBestRoute(tokenIn, tokenOut, amountIn) {
    try {
      // For direct pair
      const pairAddress = await this.getPairAddress(tokenIn, tokenOut);

      if (pairAddress !== ethers.constants.AddressZero) {
        return {
          path: [tokenIn.address, tokenOut.address],
          protocols: ['PancakeSwap V2'],
          amountOut: await this.router.getAmountsOut(amountIn, [tokenIn.address, tokenOut.address])
        };
      }

      // For multi-hop routes, you would integrate with DEX aggregators
      // like 1inch, ParaSwap, or implement custom routing logic
      throw new Error('No direct route found, implement multi-hop routing');

    } catch (error) {
      console.error('Route finding failed:', error);
      throw error;
    }
  }

  parseSwapLogs(logs) {
    // Parse swap logs to get actual output amount
    for (const log of logs) {
      try {
        const parsedLog = this.router.interface.parseLog(log);
        if (parsedLog && parsedLog.name === 'Swap') {
          return parsedLog.args.amount1Out.toString();
        }
      } catch (e) {
        // Ignore non-swap logs
      }
    }
    return '0';
  }

  async getPairAddress(tokenA, tokenB) {
    try {
      return await this.factory.getPair(tokenA, tokenB);
    } catch (error) {
      console.error('Failed to get pair address:', error);
      return ethers.constants.AddressZero;
    }
  }
}
```

### Liquidity Management

```javascript
class PancakeSwapLiquidity {
  constructor(routerContract, factoryContract, wallet) {
    this.router = routerContract;
    this.factory = factoryContract;
    this.wallet = wallet;
  }

  async addLiquidity(
    tokenA,
    tokenB,
    amountADesired,
    amountBDesired,
    amountAMin,
    amountBMin,
    recipient,
    deadline
  ) {
    try {
      // Approve tokens if needed
      await this.ensureAllowance(tokenA, amountADesired);
      await this.ensureAllowance(tokenB, amountBDesired);

      // Execute add liquidity
      const tx = await this.router.addLiquidity(
        tokenA.address,
        tokenB.address,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        recipient,
        deadline,
        {
          gasLimit: 200000,
          gasPrice: await this.gasOptimizer.getOptimalGasPrice()
        }
      );

      const receipt = await tx.wait();
      return receipt;

    } catch (error) {
      console.error('Add liquidity failed:', error);
      throw error;
    }
  }

  async ensureAllowance(token, amount) {
    const allowance = await token.allowance(this.wallet.address, this.router.address);

    if (allowance.lt(amount)) {
      const approveTx = await token.approve(
        this.router.address,
        ethers.constants.MaxUint256
      );
      await approveTx.wait();
      console.log(`Approved ${token.symbol} for PancakeSwap router`);
    }
  }
}
```

## Smart Contract Interaction

### ERC20 Token Interface

```javascript
class ERC20Token {
  constructor(address, provider) {
    this.address = address;
    this.provider = provider;

    this.abi = [
      'function name() external view returns (string)',
      'function symbol() external view returns (string)',
      'function decimals() external view returns (uint8)',
      'function totalSupply() external view returns (uint256)',
      'function balanceOf(address owner) external view returns (uint256)',
      'function transfer(address to, uint256 amount) external returns (bool)',
      'function allowance(address owner, address spender) external view returns (uint256)',
      function approve(address spender, uint256 amount) external returns (bool)',
      'function transferFrom(address from, address to, uint256 amount) external returns (bool)'
    ];

    this.contract = new ethers.Contract(address, this.abi, provider);
  }

  async getInfo() {
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      this.contract.name(),
      this.contract.symbol(),
      this.contract.decimals(),
      this.contract.totalSupply()
    ]);

    return {
      name,
      symbol,
      decimals: parseInt(decimals),
      totalSupply: totalSupply.toString(),
      address: this.address
    };
  }

  async getBalance(address) {
    const balance = await this.contract.balanceOf(address);
    return balance.toString();
  }

  async transfer(to, amount, signer) {
    const contractWithSigner = this.contract.connect(signer);
    const tx = await contractWithSigner.transfer(to, amount);
    return await tx.wait();
  }

  async approve(spender, amount, signer) {
    const contractWithSigner = this.contract.connect(signer);
    const tx = await contractWithSigner.approve(spender, amount);
    return await tx.wait();
  }
}
```

### MasterChef Farming Integration

```javascript
class MasterChefFarm {
  constructor(contractAddress, wallet) {
    this.address = contractAddress;
    this.wallet = wallet;

    this.abi = [
      'function deposit(uint256 _pid, uint256 _amount) external',
      'function withdraw(uint256 _pid, uint256 _amount) external',
      'function enterStaking(uint256 _amount) external',
      'function leaveStaking(uint256 _amount) external',
      'function pendingCake(uint256 _pid, address _user) external view returns (uint256)',
      'function userInfo(uint256 _pid, address _user) external view returns (uint256 amount, uint256 rewardDebt)',
      'function poolLength() external view returns (uint256)',
      'function poolInfo(uint256 _pid) external view returns (address lpToken, uint256 allocPoint, uint256 lastRewardTime, uint256 accCakePerShare)'
    ];

    this.contract = new ethers.Contract(contractAddress, this.abi, wallet);
  }

  async stake(pid, amount) {
    try {
      // Approve LP token if needed
      const lpToken = await this.getPoolLPToken(pid);
      await this.ensureAllowance(lpToken, amount);

      const tx = await this.contract.deposit(pid, amount, {
        gasLimit: 200000,
        gasPrice: await this.getOptimalGasPrice()
      });

      const receipt = await tx.wait();
      console.log(`Staked ${amount} tokens in pool ${pid}`);
      return receipt;

    } catch (error) {
      console.error('Staking failed:', error);
      throw error;
    }
  }

  async unstake(pid, amount) {
    try {
      const tx = await this.contract.withdraw(pid, amount, {
        gasLimit: 200000,
        gasPrice: await this.getOptimalGasPrice()
      });

      const receipt = await tx.wait();
      console.log(`Unstaked ${amount} tokens from pool ${pid}`);
      return receipt;

    } catch (error) {
      console.error('Unstaking failed:', error);
      throw error;
    }
  }

  async getPendingRewards(pid, userAddress) {
    try {
      const rewards = await this.contract.pendingCake(pid, userAddress);
      return rewards.toString();
    } catch (error) {
      console.error('Failed to get pending rewards:', error);
      return '0';
    }
  }

  async getPoolLPToken(pid) {
    try {
      const [lpToken] = await this.contract.poolInfo(pid);
      return lpToken;
    } catch (error) {
      console.error('Failed to get LP token:', error);
      throw error;
    }
  }

  async ensureAllowance(token, amount) {
    const allowance = await token.allowance(this.wallet.address, this.address);

    if (allowance.lt(amount)) {
      const approveTx = await token.approve(this.address, ethers.constants.MaxUint256);
      await approveTx.wait();
      console.log('Approved LP token for MasterChef');
    }
  }
}
```

## Error Handling

### Comprehensive Error Handling

```javascript
class BSCErrorHandler {
  static handleTransactionError(error) {
    if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
      return {
        type: 'GAS_LIMIT_EXCEEDED',
        message: 'Transaction gas limit exceeded. Try increasing gas limit or reducing transaction complexity.',
        suggestion: 'Increase gas limit by 20% or simplify the transaction.'
      };
    }

    if (error.code === 'INSUFFICIENT_FUNDS') {
      return {
        type: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient funds for transaction.',
        suggestion: 'Check your wallet balance and gas fees.'
      };
    }

    if (error.code === 'NETWORK_ERROR') {
      return {
        type: 'NETWORK_ERROR',
        message: 'Network connection error.',
        suggestion: 'Check your internet connection and try again.'
      };
    }

    if (error.message.includes('revert')) {
      return {
        type: 'TRANSACTION_REVERTED',
        message: 'Transaction was reverted by the smart contract.',
        suggestion: 'Check transaction parameters and contract conditions.'
      };
    }

    return {
      type: 'UNKNOWN_ERROR',
      message: error.message,
      suggestion: 'Check transaction parameters and try again.'
    };
  }

  static async retryTransaction(transactionFunction, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await transactionFunction();
      } catch (error) {
        const errorInfo = this.handleTransactionError(error);
        console.error(`Attempt ${i + 1} failed:`, errorInfo);

        if (i === maxRetries - 1) {
          throw new Error(`Transaction failed after ${maxRetries} attempts: ${errorInfo.message}`);
        }

        // Exponential backoff
        await this.delay(Math.pow(2, i) * 1000);
      }
    }
  }

  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Best Practices

### 1. Security Considerations

```javascript
class SecureBSCIntegration {
  constructor() {
    this.nonceCache = new Map();
    this.requestTimeout = 30000;
  }

  // Validate addresses
  validateAddress(address) {
    try {
      return ethers.utils.isAddress(address);
    } catch {
      return false;
    }
  }

  // Validate amounts
  validateAmount(amount) {
    try {
      const bigNumber = ethers.BigNumber.from(amount);
      return bigNumber.gt(0);
    } catch {
      return false;
    }
  }

  // Secure transaction signing
  async signTransaction(transaction, wallet) {
    // Validate transaction before signing
    if (!this.validateAddress(transaction.to)) {
      throw new Error('Invalid recipient address');
    }

    if (!this.validateAmount(transaction.value)) {
      throw new Error('Invalid transaction value');
    }

    // Add security metadata
    const securityData = {
      timestamp: Date.now(),
      source: 'BSC-Integration',
      version: '1.0.0'
    };

    return wallet.signTransaction(transaction, securityData);
  }
}
```

### 2. Performance Optimization

```javascript
class BSCPerformanceOptimizer {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }

  // Cached balance queries
  async getBalance(address, provider) {
    const cacheKey = `balance_${address}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.balance;
    }

    const balance = await provider.getBalance(address);

    this.cache.set(cacheKey, {
      balance,
      timestamp: Date.now()
    });

    return balance;
  }

  // Batch transactions for efficiency
  async batchTransactions(transactions, wallet) {
    try {
      const results = await Promise.allSettled(
        transactions.map(tx =>
          wallet.sendTransaction(tx).catch(error => ({ error }))
        )
      );

      return results.map((result, index) => ({
        index,
        success: result.status === 'fulfilled',
        transaction: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null
      }));

    } catch (error) {
      console.error('Batch transaction failed:', error);
      throw error;
    }
  }

  // Optimize gas usage
  async optimizeGas(transaction, provider) {
    try {
      // Get current gas price
      const feeData = await provider.getFeeData();

      // Use 10% less than recommended for BSC
      const optimizedGasPrice = feeData.gasPrice.mul(90).div(100);

      return {
        ...transaction,
        gasPrice: optimizedGasPrice
      };

    } catch (error) {
      console.error('Gas optimization failed:', error);
      return transaction;
    }
  }
}
```

### 3. Monitoring and Logging

```javascript
class BSCMonitor {
  constructor() {
    this.metrics = {
      transactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      totalGasUsed: 0,
      averageResponseTime: 0
    };
  }

  logTransaction(transaction, type = 'info') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      hash: transaction.hash,
      from: transaction.from,
      to: transaction.to,
      value: transaction.value ? transaction.value.toString() : '0',
      gasLimit: transaction.gasLimit ? transaction.gasLimit.toString() : '0',
      gasPrice: transaction.gasPrice ? transaction.gasPrice.toString() : '0'
    };

    console.log(`[BSC-${type.toUpperCase()}]`, JSON.stringify(logEntry, null, 2));

    this.updateMetrics(transaction);
  }

  updateMetrics(transaction) {
    this.metrics.transactions++;

    if (transaction.gasUsed) {
      this.metrics.totalGasUsed += parseInt(transaction.gasUsed.toString());
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.transactions > 0
        ? (this.metrics.successfulTransactions / this.metrics.transactions) * 100
        : 0
    };
  }
}
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Connection Issues

```javascript
// Handle connection timeouts
const bscProvider = new ethers.providers.JsonRpcProvider(
  process.env.BSC_RPC_URL,
  {
    polling: false,
    pollingInterval: 4000,
    staticNetwork: {
      chainId: 56,
      name: 'bsc'
    }
  }
);

// Add connection timeout
bscProvider._getResolver = function () {
  return new Promise((resolve, reject) => {
    const original = this._super_getResolver();
    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, 10000);

    original.then(resolve).catch(reject);
  });
};
```

#### 2. Gas Estimation Issues

```javascript
async function safeGasEstimate(transaction, provider) {
  try {
    const estimate = await provider.estimateGas(transaction);
    return estimate;
  } catch (error) {
    console.error('Gas estimation failed, using fallback:', error);

    // Fallback gas limits based on transaction type
    if (transaction.data && transaction.data.length > 0) {
      return ethers.BigNumber.from(200000); // Contract interaction
    } else {
      return ethers.BigNumber.from(21000);  // Simple transfer
    }
  }
}
```

#### 3. Nonce Issues

```javascript
class NonceManager {
  constructor(wallet) {
    this.wallet = wallet;
    this.pendingTransactions = new Set();
  }

  async getNextNonce() {
    let nonce = await this.wallet.getTransactionCount('pending');

    // Skip nonces of pending transactions
    while (this.pendingTransactions.has(nonce)) {
      nonce++;
    }

    return nonce;
  }

  addPendingTransaction(nonce) {
    this.pendingTransactions.add(nonce);
  }

  removePendingTransaction(nonce) {
    this.pendingTransactions.delete(nonce);
  }

  async sendTransactionWithNonce(transaction) {
    const nonce = await this.getNextNonce();
    this.addPendingTransaction(nonce);

    try {
      const tx = await this.wallet.sendTransaction({
        ...transaction,
        nonce
      });

      // Remove from pending on success
      this.removePendingTransaction(nonce);

      return tx;
    } catch (error) {
      // Remove from pending on failure
      this.removePendingTransaction(nonce);
      throw error;
    }
  }
}
```

## Advanced Topics

### Multi-Hop Routing

```javascript
class MultiHopRouter {
  constructor(pairs) {
    this.pairs = pairs;
    this.graph = this.buildGraph();
  }

  buildGraph() {
    const graph = {};

    for (const pair of this.pairs) {
      const { token0, token1 } = pair;

      if (!graph[token0]) graph[token0] = [];
      if (!graph[token1]) graph[token1] = [];

      graph[token0].push({ token: token1, pair });
      graph[token1].push({ token: token0, pair });
    }

    return graph;
  }

  findRoute(tokenIn, tokenOut, maxHops = 3) {
    const visited = new Set();
    const queue = [{
      path: [tokenIn],
      hops: 0
    }];

    while (queue.length > 0) {
      const { path, hops } = queue.shift();
      const currentToken = path[path.length - 1];

      if (currentToken === tokenOut) {
        return path;
      }

      if (hops >= maxHops) continue;

      if (visited.has(currentToken)) continue;
      visited.add(currentToken);

      const neighbors = this.graph[currentToken] || [];
      for (const neighbor of neighbors) {
        if (!path.includes(neighbor.token)) {
          queue.push({
            path: [...path, neighbor.token],
            hops: hops + 1
          });
        }
      }
    }

    return null; // No route found
  }
}
```

### MEV Protection

```bridge
class MEVProtection {
  constructor(wallet) {
    this.wallet = wallet;
    this.pendingTransactions = new Map();
  }

  async protectTransaction(transaction) {
    // Add timestamp and random salt
    const protectedData = {
      ...transaction,
      timestamp: Date.now(),
      salt: ethers.utils.randomBytes(32)
    };

    // Use private mempool when available
    if (this.hasPrivateMempool()) {
      return this.sendToPrivateMempool(protectedData);
    }

    // Fallback to regular transaction with timing protection
    return this.sendWithTimingProtection(protectedData);
  }

  hasPrivateMempool() {
    // Check if private mempool is available
    return process.env.USE_PRIVATE_MEMPOOL === 'true';
  }

  async sendWithTimingProtection(transaction) {
    // Add random delay to prevent front-running
    const delay = Math.random() * 1000; // 0-1 second random delay
    await this.delay(delay);

    return await this.wallet.sendTransaction(transaction);
  }

  async sendToPrivateMempool(transaction) {
    // Implementation for private mempool submission
    // This would integrate with Flashbots or similar services
    console.log('Sending transaction to private mempool');
    return await this.wallet.sendTransaction(transaction);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Migration from Ethers.js to Viem

### Complete Migration Example

This section provides a comprehensive example of migrating a complete BSC integration from Ethers.js to Viem.

#### Before: Ethers.js Implementation

```javascript
import { ethers } from 'ethers';

class BSCIntegration {
  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(
      process.env.BSC_RPC_URL,
      { chainId: 56, name: 'bsc' }
    );
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
  }

  async getTokenBalance(tokenAddress, userAddress) {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function balanceOf(address) view returns (uint256)'],
      this.provider
    );
    const balance = await tokenContract.balanceOf(userAddress);
    return ethers.utils.formatEther(balance);
  }

  async swapTokens(tokenIn, tokenOut, amountIn) {
    const router = new ethers.Contract(
      process.env.PANCAKE_ROUTER,
      ['function swapExactTokensForTokens(uint,uint,address[],address,uint)'],
      this.wallet
    );

    const amountOutMin = 0;
    const path = [tokenIn, tokenOut];
    const deadline = Math.floor(Date.now() / 1000) + 1200;

    const tx = await router.swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      path,
      this.wallet.address,
      deadline
    );

    return await tx.wait();
  }
}
```

#### After: Viem Implementation

```javascript
import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { getContract, parseAbi } from 'viem';

class BSCIntegrationViem {
  constructor() {
    // Public client for read operations
    this.publicClient = createPublicClient({
      chain: bsc,
      transport: http(process.env.BSC_RPC_URL)
    });

    // Wallet client for write operations
    const account = privateKeyToAccount(process.env.PRIVATE_KEY);
    this.walletClient = createWalletClient({
      account,
      chain: bsc,
      transport: http(process.env.BSC_RPC_URL)
    });
  }

  async getTokenBalance(tokenAddress, userAddress) {
    const tokenContract = getContract({
      address: tokenAddress,
      abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
      client: this.publicClient
    });

    const balance = await tokenContract.read.balanceOf([userAddress]);
    return formatEther(balance);
  }

  async swapTokens(tokenIn, tokenOut, amountIn) {
    const router = getContract({
      address: process.env.PANCAKE_ROUTER,
      abi: parseAbi(['function swapExactTokensForTokens(uint,uint,address[],address,uint)']),
      client: this.walletClient
    });

    const amountOutMin = 0n;
    const path = [tokenIn, tokenOut];
    const deadline = Math.floor(Date.now() / 1000) + 1200;

    const transactionHash = await router.write.swapExactTokensForTokens([
      amountIn,
      amountOutMin,
      path,
      this.walletClient.account.address,
      deadline
    ]);

    return await this.publicClient.waitForTransactionReceipt({
      hash: transactionHash
    });
  }
}
```

### Migration Benefits

1. **Type Safety**: Viem provides better TypeScript support out of the box
2. **Performance**: Optimized RPC calls and reduced bundle size
3. **Modern API**: Cleaner, more intuitive methods
4. **Built-in BSC Support**: Native chain configurations
5. **Better Error Handling**: More descriptive error messages

### Migration Checklist

- [ ] Replace `ethers.providers.JsonRpcProvider` with `createPublicClient`
- [ ] Replace `ethers.Wallet` with `createWalletClient`
- [ ] Update contract initialization to use `getContract`
- [ ] Replace BigNumber operations with native BigInt
- [ ] Update utility functions (`parseEther`, `formatEther`)
- [ ] Modify transaction methods to use new Viem patterns
- [ ] Update error handling for Viem-specific error types
- [ ] Test all functionality thoroughly
- [ ] Update test suites to use Viem testing utilities

### Testing Migration

```javascript
// Viem testing example
import { test, expect } from 'vitest';
import { createPublicClient, http, parseEther } from 'viem';
import { bsc } from 'viem/chains';

test('Viem BSC integration', async () => {
  const client = createPublicClient({
    chain: bsc,
    transport: http()
  });

  const blockNumber = await client.getBlockNumber();
  expect(typeof blockNumber).toBe('bigint');
  expect(blockNumber).toBeGreaterThan(0n);
});
```

This comprehensive integration guide covers all the essential aspects of integrating with BSC and PancakeSwap using Viem. The migration from Ethers.js provides significant benefits in terms of type safety, performance, and developer experience. Make sure to adapt the code examples to your specific use case and always test thoroughly before deploying to production.