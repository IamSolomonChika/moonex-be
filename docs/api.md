# MoonEx API Documentation

## Overview

The MoonEx API provides authentication, wallet management, and BSC (Binance Smart Chain) DeFi capabilities using Viem 2.38.5 for blockchain interactions and Privy for secure authentication and embedded wallet functionality.

### What's New with Viem Integration

- **Enhanced BSC Support**: Native BSC mainnet and testnet integration
- **Improved Performance**: Optimized RPC calls and reduced latency
- **Type Safety**: Full TypeScript support with enhanced type inference
- **DeFi Features**: PancakeSwap integration, token swaps, liquidity management
- **Real-time Updates**: WebSocket support for live price and transaction updates

## Base URL

```
https://api.moonex.com/v1
```

## Authentication

All API endpoints (except for login and register) require authentication using Bearer tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Health Check

### GET /health

Check the health status of the API.

**Response:**

```json
{
  "status": "ok",
  "message": "MoonEx API is running"
}
```

## Authentication Endpoints

### POST /auth/login

Authenticate a user with email and password.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "name": "User Name"
    },
    "token": "jwt_token_here"
  }
}
```

### POST /auth/register

Register a new user account.

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "name": "New User"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "user_id",
      "email": "newuser@example.com",
      "name": "New User"
    },
    "token": "jwt_token_here"
  }
}
```

### GET /auth/me

Get the current authenticated user's profile.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "name": "User Name",
      "createdAt": "2023-01-01T00:00:00.000Z"
    }
  }
}
```

### POST /auth/logout

Logout the current user and invalidate the token.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Logout successful"
}
```

### POST /auth/refresh

Refresh an authentication token.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "token": "new_jwt_token_here"
  }
}
```

## Wallet Endpoints

### POST /wallets/create

Create a new embedded wallet for the authenticated user.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Wallet created successfully",
  "data": {
    "wallet": {
      "address": "0x1234567890123456789012345678901234567890",
      "type": "embedded",
      "createdAt": "2023-01-01T00:00:00.000Z"
    }
  }
}
```

### GET /wallets/balance

Get the balance of the user's wallet.

**Headers:**

```
Authorization: Bearer <token>
```

**Query Parameters:**

- `token` (optional): Token symbol (e.g., ETH, USDC). Defaults to ETH.

**Response:**

```json
{
  "success": true,
  "data": {
    "balance": "1.234567",
    "token": "ETH",
    "usdValue": "2469.34"
  }
}
```

### POST /wallets/transfer

Transfer tokens from the user's wallet to another address.

**Headers:**

```
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "to": "0x9876543210987654321098765432109876543210",
  "amount": "0.1",
  "token": "ETH"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Transfer initiated successfully",
  "data": {
    "transaction": {
      "hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "from": "0x1234567890123456789012345678901234567890",
      "to": "0x9876543210987654321098765432109876543210",
      "amount": "0.1",
      "token": "ETH",
      "status": "pending"
    }
  }
}
```

### GET /wallets/transactions

Get the transaction history for the user's wallet.

**Headers:**

```
Authorization: Bearer <token>
```

**Query Parameters:**

- `limit` (optional): Number of transactions to return. Defaults to 10.
- `offset` (optional): Number of transactions to skip. Defaults to 0.

**Response:**

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        "from": "0x1234567890123456789012345678901234567890",
        "to": "0x9876543210987654321098765432109876543210",
        "amount": "0.1",
        "token": "ETH",
        "status": "completed",
        "timestamp": "2023-01-01T00:00:00.000Z"
      }
    ],
    "total": 25,
    "limit": 10,
    "offset": 0
  }
}
```

### GET /wallets/gas-fee

Get estimated gas fees for transactions.

**Headers:**

```
Authorization: Bearer <token>
```

**Query Parameters:**

- `token` (optional): Token symbol for gas estimation. Defaults to ETH.

**Response:**

```json
{
  "success": true,
  "data": {
    "gasPrice": "20000000000",
    "gasLimit": "21000",
    "maxFee": "420000000000000",
    "estimatedCost": "0.00042",
    "token": "ETH"
  }
}
```

## BSC DeFi Endpoints

### GET /bsc/tokens

Get a list of supported BSC tokens with their metadata.

**Headers:**

```
Authorization: Bearer <token>
```

**Query Parameters:**

- `search` (optional): Search term to filter tokens by name or symbol
- `limit` (optional): Number of tokens to return. Defaults to 50
- `offset` (optional): Number of tokens to skip. Defaults to 0

**Response:**

```json
{
  "success": true,
  "data": {
    "tokens": [
      {
        "address": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        "symbol": "WBNB",
        "name": "Wrapped BNB",
        "decimals": 18,
        "logoURI": "https://assets.coingecko.com/coins/images/12595/small/wbnb.png",
        "verified": true,
        "priceUSD": "315.45"
      }
    ],
    "total": 156,
    "limit": 50,
    "offset": 0
  }
}
```

### GET /bsc/tokens/{address}

Get detailed information about a specific token.

**Headers:**

```
Authorization: Bearer <token>
```

**Path Parameters:**

- `address`: The contract address of the token

**Response:**

```json
{
  "success": true,
  "data": {
    "token": {
      "address": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
      "symbol": "WBNB",
      "name": "Wrapped BNB",
      "decimals": 18,
      "totalSupply": "1000000000000000000000000000",
      "logoURI": "https://assets.coingecko.com/coins/images/12595/small/wbnb.png",
      "verified": true,
      "priceUSD": "315.45",
      "priceChange24h": "2.34",
      "volume24h": "125000000",
      "liquidity": "45000000"
    }
  }
}
```

### GET /bsc/tokens/{address}/balance

Get the balance of a specific token for the authenticated user.

**Headers:**

```
Authorization: Bearer <token>
```

**Path Parameters:**

- `address`: The contract address of the token

**Response:**

```json
{
  "success": true,
  "data": {
    "balance": "1000000000000000000",
    "formattedBalance": "1.0",
    "token": {
      "address": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
      "symbol": "WBNB",
      "decimals": 18
    },
    "valueUSD": "315.45"
  }
}
```

### POST /bsc/swap/quote

Get a swap quote for exchanging tokens on PancakeSwap.

**Headers:**

```
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "tokenIn": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  "tokenOut": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  "amountIn": "1000000000000000000",
  "slippageTolerancePercent": 1
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "quote": {
      "tokenIn": {
        "address": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        "symbol": "WBNB",
        "amountIn": "1000000000000000000",
        "formattedAmountIn": "1.0"
      },
      "tokenOut": {
        "address": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
        "symbol": "BUSD",
        "amountOut": "315450000000000000000",
        "formattedAmountOut": "315.45"
      },
      "route": [
        {
          "address": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
          "symbol": "WBNB"
        },
        {
          "address": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
          "symbol": "BUSD"
        }
      ],
      "priceImpact": "0.12",
      "slippageTolerancePercent": 1,
      "minimumAmountOut": "312295500000000000000",
      "gasEstimate": "150000",
      "estimatedGasUSD": "0.75"
    }
  }
}
```

### POST /bsc/swap/execute

Execute a token swap on PancakeSwap.

**Headers:**

```
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "tokenIn": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  "tokenOut": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  "amountIn": "1000000000000000000",
  "minimumAmountOut": "312295500000000000000",
  "deadline": "1640995200"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Swap executed successfully",
  "data": {
    "transaction": {
      "hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "from": "0x1234567890123456789012345678901234567890",
      "tokenIn": {
        "address": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        "symbol": "WBNB",
        "amountIn": "1000000000000000000",
        "formattedAmountIn": "1.0"
      },
      "tokenOut": {
        "address": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
        "symbol": "BUSD",
        "amountOut": "315450000000000000000",
        "formattedAmountOut": "315.45"
      },
      "gasUsed": "145623",
      "gasPrice": "20000000000",
      "gasUSD": "0.73",
      "status": "completed",
      "timestamp": "2023-01-01T00:00:00.000Z"
    }
  }
}
```

### GET /bsc/pools

Get available liquidity pools on PancakeSwap.

**Headers:**

```
Authorization: Bearer <token>
```

**Query Parameters:**

- `tokenA` (optional): Filter pools containing token A
- `tokenB` (optional): Filter pools containing token B
- `limit` (optional): Number of pools to return. Defaults to 50

**Response:**

```json
{
  "success": true,
  "data": {
    "pools": [
      {
        "address": "0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16",
        "tokenA": {
          "address": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
          "symbol": "WBNB",
          "decimals": 18
        },
        "tokenB": {
          "address": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
          "symbol": "BUSD",
          "decimals": 18
        },
        "reserveA": "50000000000000000000000",
        "reserveB": "15750000000000000000000000",
        "apr": "12.5",
        "tvlUSD": "63125000",
        "volume24h": "1250000"
      }
    ]
  }
}
```

### POST /bsc/pools/add-liquidity

Add liquidity to a PancakeSwap pool.

**Headers:**

```
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "tokenA": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  "tokenB": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  "amountADesired": "1000000000000000000",
  "amountBDesired": "315000000000000000000",
  "minimumAmountA": "990000000000000000",
  "minimumAmountB": "311850000000000000000",
  "deadline": "1640995200"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Liquidity added successfully",
  "data": {
    "transaction": {
      "hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "poolAddress": "0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16",
      "liquidityTokens": "150000000000000000000",
      "amountA": "1000000000000000000",
      "amountB": "315450000000000000000",
      "gasUsed": "234567",
      "gasPrice": "20000000000",
      "gasUSD": "1.17",
      "status": "completed"
    }
  }
}
```

### POST /bsc/pools/remove-liquidity

Remove liquidity from a PancakeSwap pool.

**Headers:**

```
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "tokenA": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  "tokenB": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  "liquidity": "100000000000000000000",
  "minimumAmountA": "990000000000000000",
  "minimumAmountB": "311850000000000000000",
  "deadline": "1640995200"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Liquidity removed successfully",
  "data": {
    "transaction": {
      "hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "amountA": "665432100000000000",
      "amountB": "209876540000000000000",
      "gasUsed": "189234",
      "gasPrice": "20000000000",
      "gasUSD": "0.95",
      "status": "completed"
    }
  }
}
```

### GET /bsc/farms

Get available yield farming opportunities.

**Headers:**

```
Authorization: Bearer <token>
```

**Query Parameters:**

- `limit` (optional): Number of farms to return. Defaults to 20
- `activeOnly` (optional): Filter for active farms only. Defaults to true

**Response:**

```json
{
  "success": true,
  "data": {
    "farms": [
      {
        "id": 1,
        "lpToken": "0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16",
        "tokenA": {
          "address": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
          "symbol": "WBNB"
        },
        "tokenB": {
          "address": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
          "symbol": "BUSD"
        },
        "rewardToken": {
          "address": "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
          "symbol": "CAKE"
        },
        "apr": "45.2",
        "tvlUSD": "125000000",
        "rewardPerBlock": "1000000000000000000",
        "userStaked": null,
        "userPendingRewards": null
      }
    ]
  }
}
```

### POST /bsc/farms/{farmId}/stake

Stake LP tokens in a yield farm.

**Headers:**

```
Authorization: Bearer <token>
```

**Path Parameters:**

- `farmId`: The ID of the farm to stake in

**Request Body:**

```json
{
  "amount": "100000000000000000000"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Successfully staked in farm",
  "data": {
    "transaction": {
      "hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "farmId": 1,
      "amount": "100000000000000000000",
      "gasUsed": "167890",
      "gasPrice": "20000000000",
      "gasUSD": "0.84",
      "status": "completed"
    }
  }
}
```

### POST /bsc/farms/{farmId}/unstake

Unstake LP tokens from a yield farm.

**Headers:**

```
Authorization: Bearer <token>
```

**Path Parameters:**

- `farmId`: The ID of the farm to unstake from

**Request Body:**

```json
{
  "amount": "50000000000000000000"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Successfully unstaked from farm",
  "data": {
    "transaction": {
      "hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "farmId": 1,
      "amount": "50000000000000000000",
      "rewardsClaimed": "123456789000000000000",
      "gasUsed": "156789",
      "gasPrice": "20000000000",
      "gasUSD": "0.78",
      "status": "completed"
    }
  }
}
```

### POST /bsc/farms/{farmId}/claim

Claim pending rewards from a yield farm.

**Headers:**

```
Authorization: Bearer <token>
```

**Path Parameters:**

- `farmId`: The ID of the farm to claim rewards from

**Response:**

```json
{
  "success": true,
  "message": "Successfully claimed rewards",
  "data": {
    "transaction": {
      "hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "farmId": 1,
      "rewardsClaimed": "123456789000000000000",
      "rewardsUSD": "38.92",
      "gasUsed": "123456",
      "gasPrice": "20000000000",
      "gasUSD": "0.62",
      "status": "completed"
    }
  }
}
```

### GET /bsc/portfolio

Get a comprehensive portfolio overview for the authenticated user.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "portfolio": {
      "totalValueUSD": "5234.56",
      "assets": [
        {
          "token": {
            "address": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
            "symbol": "WBNB",
            "name": "Wrapped BNB",
            "decimals": 18
          },
          "balance": "1000000000000000000",
          "formattedBalance": "1.0",
          "valueUSD": "315.45",
          "percentage": "6.02"
        }
      ],
      "liquidityPositions": [
        {
          "pool": {
            "address": "0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16",
            "tokenA": "WBNB",
            "tokenB": "BUSD"
          },
          "liquidityTokens": "150000000000000000000",
          "valueUSD": "1500.00",
          "percentage": "28.65"
        }
      ],
      "farmPositions": [
        {
          "farm": {
            "id": 1,
            "tokenA": "WBNB",
            "tokenB": "BUSD",
            "rewardToken": "CAKE"
          },
          "stakedAmount": "50000000000000000000",
          "valueUSD": "750.00",
          "pendingRewards": "123456789000000000000",
          "pendingRewardsUSD": "38.92",
          "apr": "45.2",
          "percentage": "14.33"
        }
      ],
      "performance": {
        "24hChange": "2.34",
        "7dChange": "8.76",
        "30dChange": "15.43"
      }
    }
  }
}
```

### WebSocket Endpoints

#### BSC Real-time Updates

Connect to WebSocket for real-time BSC updates:

```
wss://api.moonex.com/v1/bsc/ws
```

**Authentication:**

Send authentication message after connection:

```json
{
  "type": "auth",
  "token": "your-jwt-token"
}
```

**Subscribe to events:**

```json
{
  "type": "subscribe",
  "channel": "transactions",
  "address": "0x1234567890123456789012345678901234567890"
}
```

**Available channels:**

- `transactions`: Real-time transaction updates
- `balances`: Balance updates for specific addresses
- `prices`: Token price updates
- `swaps`: Real-time swap notifications
- `positions`: Liquidity and farming position updates

**WebSocket message format:**

```json
{
  "type": "event",
  "channel": "transactions",
  "data": {
    "hash": "0xabcdef...",
    "status": "completed",
    "timestamp": "2023-01-01T00:00:00.000Z",
    "details": { ... }
  }
}
```

## Error Responses

All endpoints may return error responses with the following format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Additional error details (optional)"
  }
}
```

### Common Error Codes

#### Authentication Errors
- `UNAUTHORIZED` (401): Authentication required or invalid token
- `FORBIDDEN` (403): Insufficient permissions
- `TOKEN_EXPIRED` (401): JWT token has expired
- `INVALID_TOKEN` (401): Invalid token format

#### General Errors
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (400): Request validation failed
- `INTERNAL_ERROR` (500): Internal server error
- `RATE_LIMITED` (429): Too many requests

#### Wallet Errors
- `WALLET_ERROR`: General wallet operation failed
- `INSUFFICIENT_BALANCE`: Insufficient balance for operation
- `INVALID_ADDRESS`: Invalid wallet address provided
- `WALLET_NOT_FOUND`: User wallet not found

#### BSC-Specific Errors
- `BSC_NETWORK_ERROR`: BSC network connection issue
- `BSC_TRANSACTION_FAILED`: Transaction failed on BSC
- `BSC_GAS_ESTIMATION_FAILED`: Unable to estimate gas
- `BSC_INSUFFICIENT_GAS`: Insufficient gas provided
- `BSC_NONCE_TOO_LOW`: Transaction nonce too low
- `BSC_NONCE_TOO_HIGH`: Transaction nonce too high
- `BSC_SLIPPAGE_TOO_HIGH`: Price impact too high
- `BSC_DEADLINE_EXCEEDED`: Transaction deadline exceeded
- `BSC_INVALID_TOKEN`: Invalid token contract
- `BSC_INSUFFICIENT_LIQUIDITY`: Insufficient liquidity in pool
- `BSC_SWAP_FAILED`: PancakeSwap swap failed
- `BSC_POOL_NOT_FOUND`: Liquidity pool not found
- `BSC_FARM_NOT_FOUND`: Yield farm not found
- `BSC_FARM_NOT_ACTIVE`: Farm is not currently active
- `BSC_APPROVAL_REQUIRED`: Token approval required
- `BSC_ALLOWANCE_INSUFFICIENT`: Insufficient token allowance

## Rate Limiting

API endpoints are rate-limited to prevent abuse. Standard limits are:

- Authentication endpoints: 10 requests per minute
- Wallet operations: 30 requests per minute
- BSC swap operations: 20 requests per minute
- BSC liquidity operations: 15 requests per minute
- BSC farming operations: 10 requests per minute
- Other endpoints: 100 requests per minute
- WebSocket connections: 5 connections per minute

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640995200
X-RateLimit-Window: 60
```

## SDK and Libraries

### Official SDKs

Official SDKs are available for:

- **JavaScript/TypeScript**: `@moonex/sdk` - Built with Viem 2.38.5
- **Python**: `moonex-python-sdk`
- **Go**: `moonex-go-sdk`

### JavaScript/TypeScript SDK Usage

```bash
# Install the SDK
pnpm add @moonex/sdk viem@2.38.5
```

```javascript
import { MoonExSDK } from '@moonex/sdk';
import { createWalletClient, http } from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Initialize SDK
const sdk = new MoonExSDK({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.moonex.com/v1',
  chain: bsc
});

// BSC Operations
const tokenList = await sdk.bsc.getTokens();
const swapQuote = await sdk.bsc.getSwapQuote({
  tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  amountIn: '1000000000000000000'
});

// With custom wallet client
const account = privateKeyToAccount('0x...');
const walletClient = createWalletClient({
  account,
  chain: bsc,
  transport: http()
});

const swapResult = await sdk.bsc.executeSwap(swapQuote, {
  walletClient
});
```

### SDK Features

- **Type Safety**: Full TypeScript support with Viem integration
- **BSC Optimized**: Built-in BSC mainnet and testnet support
- **Error Handling**: Comprehensive error handling and retry logic
- **Real-time**: WebSocket integration for live updates
- **Batching**: Automatic request batching for better performance

## Code Examples

### Basic Token Swap

```javascript
import { MoonExSDK } from '@moonex/sdk';

const sdk = new MoonExSDK({
  apiKey: process.env.MOONEX_API_KEY
});

// Get swap quote
const quote = await sdk.bsc.getSwapQuote({
  tokenIn: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
  tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // BUSD
  amountIn: '1000000000000000000', // 1 WBNB
  slippageTolerancePercent: 1
});

// Execute swap
const result = await sdk.bsc.executeSwap({
  ...quote,
  minimumAmountOut: quote.minimumAmountOut,
  deadline: Math.floor(Date.now() / 1000) + 1200
});

console.log('Swap completed:', result.transaction.hash);
```

### Real-time Price Monitoring

```javascript
// Connect to WebSocket for real-time updates
const ws = sdk.bsc.connectWebSocket();

await ws.authenticate('your-jwt-token');

// Subscribe to price updates
ws.subscribe('prices', {
  tokens: [
    '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'
  ]
});

ws.on('priceUpdate', (data) => {
  console.log(`Price update: ${data.token} = $${data.price}`);
});
```

### Portfolio Management

```javascript
// Get comprehensive portfolio
const portfolio = await sdk.bsc.getPortfolio();

console.log('Total portfolio value:', portfolio.totalValueUSD);
console.log('Assets:', portfolio.assets);
console.log('Liquidity positions:', portfolio.liquidityPositions);
console.log('Farm positions:', portfolio.farmPositions);

// Get performance metrics
const performance = await sdk.bsc.getPortfolioPerformance({
  timeframe: '30d'
});

console.log('30-day change:', performance.changePercent);
```

## Best Practices

### Security
- Store API keys securely (environment variables, secret management)
- Use HTTPS for all API communications
- Validate all user inputs before processing
- Implement proper error handling for all requests

### Performance
- Use WebSocket connections for real-time data
- Batch multiple requests when possible
- Implement caching for frequently accessed data
- Use appropriate rate limiting on client side

### Error Handling
- Always handle BSC-specific error codes
- Implement retry logic for network errors
- Provide meaningful error messages to users
- Monitor transaction status appropriately

## Support

For API support and questions:

- **Documentation**: https://docs.moonex.com
- **API Reference**: https://api.moonex.com/docs
- **SDK Documentation**: https://docs.moonex.com/sdk
- **GitHub**: https://github.com/moonex/sdk
- **Support**: support@moonex.com
- **Status**: https://status.moonex.com
- **Discord Community**: https://discord.gg/moonex

## Changelog

### v2.38.5 (Viem Integration)
- ✅ Migrated to Viem 2.38.5 for BSC interactions
- ✅ Added comprehensive BSC DeFi endpoints
- ✅ Improved performance and reduced latency
- ✅ Enhanced type safety with TypeScript
- ✅ Added WebSocket real-time updates
- ✅ Implemented PancakeSwap integration
- ✅ Added yield farming capabilities
- ✅ Enhanced error handling and reporting
