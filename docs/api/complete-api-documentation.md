# 📚 Complete API Documentation - Viem 2.38.5 Integration

## Overview

This document provides comprehensive API documentation for the MoonEx backend application after Viem 2.38.5 migration. The API exposes RESTful endpoints for blockchain interactions, trading, liquidity management, and yield farming on the Binance Smart Chain.

## Table of Contents

- [Base Information](#base-information)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Core API Endpoints](#core-api-endpoints)
- [Token Service API](#token-service-api)
- [Swap Service API](#swap-service-api)
- [Liquidity Service API](#liquidity-service-api)
- [Yield Farming Service API](#yield-farming-service-api)
- [BSC Integration API](#bsc-integration-api)
- [Viem Specific Endpoints](#viem-specific-endpoints)
- [WebSocket Events](#websocket-events)
- [SDK Examples](#sdk-examples)

## Base Information

### Base URL
- **Production:** `https://api.moonex.com`
- **Staging:** `https://api-staging.moonex.com`
- **Development:** `http://localhost:3000`

### API Version
- **Current Version:** `v1`
- **Versioning:** URL-based (e.g., `/api/v1/tokens`)

### Content Type
- **Request:** `application/json`
- **Response:** `application/json`

### Timestamps
All timestamps are in ISO 8601 format: `2025-11-05T12:00:00.000Z`

## Authentication

### JWT Token Authentication
```bash
curl -X GET "https://api.moonex.com/api/v1/user/profile" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Header Requirements
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
User-Agent: moonex-client/1.0
```

### Token Generation
```bash
curl -X POST "https://api.moonex.com/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x...",
    "signature": "0x...",
    "message": "Login to MoonEx"
  }'
```

## Rate Limiting

### Rate Limits
- **Default:** 1000 requests per 15 minutes per IP
- **Authenticated Users:** 5000 requests per 15 minutes
- **Burst Limit:** 100 requests per minute
- **WebSocket:** 100 connections per IP

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1641234567
```

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": {
      "field": "tokenAddress",
      "reason": "Invalid address format"
    }
  },
  "timestamp": "2025-11-05T12:00:00.000Z"
}
```

### Error Codes
- `VALIDATION_ERROR`: Input validation failed
- `AUTHENTICATION_ERROR`: Authentication required
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `NOT_FOUND`: Resource not found
-RATE_LIMIT_EXCEEDED: Rate limit exceeded
- `BLOCKCHAIN_ERROR`: Blockchain operation failed
- `INTERNAL_ERROR`: Internal server error

## Core API Endpoints

### Health Check
```bash
GET /health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-11-05T12:00:00.000Z",
    "uptime": 86400,
    "version": "1.0.0",
    "viemVersion": "2.38.5",
    "services": {
      "database": "healthy",
      "redis": "healthy",
      "bsc": "healthy"
    }
  }
}
```

### System Information
```bash
GET /api/v1/system/info
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "MoonEx Backend",
    "version": "1.0.0",
    "environment": "production",
    "timestamp": "2025-11-05T12:00:00.000Z",
    "viem": {
      "version": "2.38.5",
      "chains": ["bsc", "bscTestnet"],
      "clientStatus": "connected"
    },
    "features": {
      "trading": true,
      "liquidity": true,
      "yieldFarming": true,
      "governance": true
    }
  }
}
```

## Token Service API

### Get Token Information
```bash
GET /api/v1/tokens/{address}
```

**Parameters:**
- `address` (path): Token contract address (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    "name": "Wrapped BNB",
    "symbol": "WBNB",
    "decimals": 18,
    "totalSupply": "100000000000000000000000000",
    "logo": "https://moonex.com/logos/wbnb.png",
    "website": "https://www.binance.org/",
    "description": "Wrapped BNB token for BSC"
  }
}
```

### Get Token Balance
```bash
GET /api/v1/tokens/{address}/balance?userAddress={userAddress}
```

**Parameters:**
- `address` (path): Token contract address (required)
- `userAddress` (query): User wallet address (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    "userAddress": "0x742d35Cc6634C0532925a3b8D4C0C8b3C2E4C5b6",
    "balance": "150000000000000000000",
    "formattedBalance": "0.15",
    "usdValue": "45.67",
    "lastUpdated": "2025-11-05T12:00:00.000Z"
  }
}
```

### Get Multiple Token Balances
```bash
POST /api/v1/tokens/balances
```

**Request Body:**
```json
{
  "userAddress": "0x742d35Cc6634C0532925a3b8D4C0C8b3C2E4C5b6",
  "addresses": [
    "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
    "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "address": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
      "balance": "150000000000000000000",
      "formattedBalance": "0.15"
    },
    {
      "address": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
      "balance": "100000000000000000000",
      "formattedBalance": "100.00"
    }
  ]
}
```

### Search Tokens
```bash
GET /api/v1/tokens/search?query={query}&limit={limit}&offset={offset}
```

**Parameters:**
- `query` (query): Search term (required)
- `limit` (query): Maximum results (default: 20, max: 100)
- `offset` (query): Results offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "tokens": [
      {
        "address": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        "name": "Wrapped BNB",
        "symbol": "WBNB",
        "logo": "https://moonex.com/logos/wbnb.png"
      }
    ],
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

## Swap Service API

### Get Swap Quote
```bash
POST /api/v1/swap/quote
```

**Request Body:**
```json
{
  "tokenIn": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  "tokenOut": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  "amountIn": "100000000000000000000",
  "slippageTolerancePercent": 0.5
}
```

**Response:**
```json
{
  "valid": true,
  "data": {
    "tokenIn": {
      "address": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
      "symbol": "WBNB",
      "decimals": 18
    },
    "tokenOut": {
      "address": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
      "symbol": "BUSD",
      "decimals": 18
    },
    "amountIn": "100000000000000000000",
    "formattedAmountIn": "0.1",
    "amountOut": "31545000000000000000000",
    "formattedAmountOut": "31.545",
    "price": "315.45",
    "slippageTolerancePercent": 0.5,
    "minimumAmountOut": "31392750000000000000000",
    "formattedMinimumAmountOut": "31.39",
    "route": [
      {
        "from": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        "to": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
        "protocol": "PancakeSwap V2",
        "pool": "0x58F876FF749e89EaF5Bf0Bd9f9e1D3b4f2C6c7",
        "fee": "0.25%"
      }
    ],
    "gasEstimate": "150000"
  }
}
```

### Execute Swap
```bash
POST /api/v1/swap/execute
```

**Request Body:**
```json
{
  "userAddress": "0x742d35Cc6634C0532925a3b8D4C0C8b3C2E4C5b6",
  "tokenIn": "0xbb4CdB9CBd36B01b1cBaEBF2De08d9173bc095c",
  "tokenOut": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  "amountIn": "100000000000000000000",
  "slippageTolerancePercent": 0.5,
  "deadline": "1641234567"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionHash": "0x1234567890abcdef1234567890abcdef1234567890",
    "from": "0x742d35Cc6634C0532925a3b8D4C0C8b3C2E4C5b6",
    "to": "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    "value": "100000000000000000000",
    "data": "0x...",
    "gasUsed": "150000",
    "gasPrice": "20000000000",
    "status": "success",
    "blockNumber": 12345678,
    "transactionIndex": 1,
    "blockHash": "0xabcdef1234567890abcdef1234567890abcdef12",
    "timestamp": "2025-11-05T12:00:00.000Z"
  }
}
```

### Get Swap History
```bash
GET /api/v1/swap/history?userAddress={userAddress}&limit={limit}&offset={offset}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "swaps": [
      {
        "transactionHash": "0x1234567890abcdef1234567890abcdef1234567890",
        "tokenIn": {
          "address": "0xbb4CdB9CBd36B01b1cBaEBF2De08d9173bc095c",
          "symbol": "WBNB"
        },
        "tokenOut": {
          "address": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
          "symbol": "BUSD"
        },
        "amountIn": "100000000000000000000",
        "amountOut": "31545000000000000000000",
        "status": "success",
        "timestamp": "2025-11-05T12:00:00.000Z"
      }
    ],
    "total": 25,
    "limit": 20,
    "offset": 0
  }
}
```

## Liquidity Service API

### Get Pool Information
```bash
POST /api/v1/liquidity/info
```

**Request Body:**
```json
{
  "tokenA": "0xbb4CdB9CBd36B01b1cBaEBF2De08d9173bc095c",
  "tokenB": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  "amountA": "100000000000000000000",
  "amountB": "31545000000000000000000"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "poolAddress": "0x58F876FF749e89EaF5Bf0Bd9f9e1D3b4f2C6c7",
    "tokenA": {
      "address": "0xbb4CdB9CBd36B01b1cBaEBF2De08d9173bc095c",
      "symbol": "WBNB",
      "decimals": 18
    },
    "tokenB": {
      "address": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
      "symbol": "BUSD",
      "decimals": 18
    },
    "reserveA": "5000000000000000000000",
    "reserveB": "15722500000000000000000",
    "totalLiquidity": "2500000000000000000000",
    "poolTokens": "2500000000000000000000",
    "share": "100000000000000000000",
    "apr": "0.234",
    "fee": "0.25%"
  }
}
```

### Add Liquidity
```bash
POST /api/v1/liquidity/add
```

**Request Body:**
```json
{
  "userAddress": "0x742d35Cc6634C0532925a3b8D4C0C8b3C2E4C5b6",
  "tokenA": "0xbb4CdB9CBd36B01b1cBaEBF2De08d9173bc095c",
  "tokenB": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  "amountA": "100000000000000000000",
  "amountB": "31545000000000000000000",
  "slippageTolerancePercent": 0.5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionHash": "0x1234567890abcdef1234567890abcdef1234567890",
    "liquidityTokens": "100000000000000000000",
    "share": "100000000000000000000",
    "timestamp": "2025-11-05T12:00:00.000Z"
  }
}
```

### Remove Liquidity
```bash
POST /api/v1/liquidity/remove
```

**Request Body:**
```json
{
  "userAddress": "0x742d35Cc6634C0532925a3b8D4C0C8b3C2E4C5b6",
  "poolAddress": "0x58F876FF749e89EaF5Bf0Bd9f9e1D3b4f2C6c7",
  "liquidityTokens": "100000000000000000000",
    "amountAMin": "95000000000000000000",
    "amountBMin": "29967750000000000000"
  }
}
```

## Yield Farming Service API

### Get Farming Pools
```bash
GET /api/v1/farming/pools
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "poolAddress": "0x73feaa1e3f5c5c9a2ce9e2b7d33c66603",
      "name": "WBNB-BUSD LP",
      "symbol": "WBNB-BUSD LP",
      "staked": true,
      "rewardToken": {
        "address": "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
        "symbol": "CAKE"
      },
      "apr": "0.456",
      "apy": "0.467",
      "tvl": "0.123",
      "totalStaked": "1000000000000000000000",
      "totalRewards": "12345678901234567890"
    }
  ]
}
```

### Get Farming Position
```bash
GET /api/v1/farming/position/{poolAddress}?userAddress={userAddress}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "poolAddress": "0x73feaa1e3f5c5c9a2ce9e2b7d33c66603",
    "userAddress": "0x742d35Cc6634C0532925a3b8D4C0C8b3C2E4C5b6",
    "stakedAmount": "100000000000000000000",
    "formattedStakedAmount": "100",
    "pendingRewards": "12345678901234567890",
    "rewardDebt": "12345678901234567890",
    "harvestableRewards": "12345678901234567890",
    "lastHarvest": "2025-11-05T12:00:00.000Z",
    "timestamp": "2025-11-05T12:00:00.000Z"
  }
}
```

### Stake in Farming Pool
```bash
POST /api/v1/farming/stake
```

**Request Body:**
```json
{
  "userAddress": "0x742d35Cc6634C0532925a3b8D4C0C8b3C2E4C5b6",
  "poolAddress": "0x73feaa1e3f5c5c9a2ce9e2b7d33c66603",
  "amount": "100000000000000000000"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionHash": "0x1234567890abcdef1234567890abcdef1234567890",
    "stakedAmount": "100000000000000000000",
    "lpTokensReceived": "99000000000000000000",
    "timestamp": "2025-11-05T12:00:00.000Z"
  }
}
```

### Harvest Rewards
```bash
POST /api/v1/farming/harvest
```

**Request Body:**
```json
{
  "userAddress": "0x742d35Cc6634C0532925a3b8D4C0C8b3C2E4C5b6",
  "poolAddress": "0x73feaa1e3f5c5c9a2ce9e2b7d33c66603"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionHash": "0x1234567890abcdef1234567890abcdef1234567890",
    "rewardAmount": "12345678901234567890",
    "formattedRewardAmount": "1.234",
    "timestamp": "2025-11-05T12:00:00.000Z"
  }
}
```

## BSC Integration API

### Get BSC Status
```bash
GET /api/v1/bsc/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "chainId": 56,
    "chainName": "BNB Smart Chain",
    "blockNumber": 12345678,
    "gasPrice": "20000000000",
    "formattedGasPrice": "20 Gwei",
    "networkId": "0x38",
    "rpcUrl": "https://bsc-dataseed1.binance.org",
    "isHealthy": true,
    "lastBlockTime": "2025-11-05T12:00:00.000Z",
    "viemClientStatus": "connected"
  }
}
```

### Get Block Information
```bash
GET /api/v1/bsc/block/{blockNumber}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "number": 12345678,
    "hash": "0x1234567890abcdef1234567890abcdef1234567890",
    "parentHash": "0xabcdef1234567890abcdef1234567890abcdef12",
    "timestamp": "2025-11-05T12:00:00.000Z",
    "miner": "0x...",
    "difficulty": "123456",
    "totalDifficulty": "12345678901234567890",
    "size": 12345,
    "gasLimit": "8000000",
    "gasUsed": "150000",
    "transactionCount": 150,
    "transactions": [
      "0x1234567890abcdef1234567890abcdef1234567890"
    ]
  }
}
```

### Get Transaction Information
```bash
GET /api/v1/bsc/transaction/{transactionHash}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hash": "0x1234567890abcdef1234567890abcdef1234567890",
    "blockNumber": 12345678,
    "transactionIndex": 1,
    "from": "0x742d35Cc6634C0532925a3b8D4C0C8b3C2E4C5b6",
    "to": "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    "value": "100000000000000000000",
    "gasUsed": "150000",
    "gasPrice": "20000000000",
    "status": "success",
    "timestamp": "2025-11-05T12:00:00.000Z",
    "blockHash": "0xabcdef1234567890abcdef1234567890abcdef12"
  }
}
```

## Viem Specific Endpoints

### Validate Viem Configuration
```bash
GET /api/viem/validate
```

**Response:**
```json
{
  "success": true,
  "data": {
    "viemVersion": "2.38.5",
    "bscConnection": true,
    "chains": ["bsc", "bscTestnet"],
    "clientStatus": "connected",
    "features": {
      "client": "available",
      "transactions": "available",
      "contracts": "available",
      "events": "available"
    },
    "configuration": {
      "rpcUrl": "https://bsc-dataseed1.binance.org",
      "fallbackUrls": [
        "https://bsc-dataseed2.binance.org",
        "https://bsc-dataseed3.binance.org"
      ]
    },
    "timestamp": "2025-11-05T12:00:00.000Z"
  }
}
```

### Get Viem Performance Metrics
```bash
GET /api/viem/metrics
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rpcLatency": 150,
    "blockNumber": 12345678,
    "gasPrice": "20000000000",
    "clientMemoryUsage": "45.2MB",
    "cacheHitRate": "0.85",
    "connectionPoolSize": 5,
    "activeConnections": 2,
    "timestamp": "2025-11-05T12:00:00.000Z"
  }
}
```

### Test RPC Connection
```bash
POST /api/viem/rpc-test
```

**Request Body:**
```json
{
  "method": "eth_blockNumber",
  "params": [],
  "id": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "result": "0x76a39170a7c5c7c1c160c6c3b27402f5c51ab3",
    "id": 1,
    "jsonrpc": "2.0",
    "timestamp": "2025-11-05T12:00:00.000Z"
  }
}
```

## WebSocket Events

### Connection
```javascript
const ws = new WebSocket('wss://api.moonex.com/ws');
ws.on('open', () => {
  console.log('Connected to MoonEx WebSocket');
});
```

### Subscribe to Token Updates
```javascript
ws.send(JSON.stringify({
  "event": "subscribe",
  "channel": "tokens",
  "address": "0xbb4CdB9CBd36B01b1cBaEBF2De08d9173bc095c"
}));
```

### Receive Token Price Updates
```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.event === 'priceUpdate') {
    console.log(`Price update: ${data.price}`);
  }
};
```

### Subscribe to Transaction Updates
```javascript
ws.send(JSON.stringify({
  "event": "subscribe",
  "channel": "transactions",
  "userAddress": "0x742d35Cc6634C0532925a3b8D4C0C8b3C2E4C5b6"
}));
```

## SDK Examples

### Node.js SDK Usage
```javascript
import { MoonExAPI } from '@moonex/sdk';

const api = new MoonExAPI({
  baseURL: 'https://api.moonex.com/api/v1',
  apiKey: 'your-api-key'
});

// Get token information
const tokenInfo = await api.tokens.getTokenInfo(
  '0xbb4Cmb9CBd36B01b1cBaEBF2De08d9173bc095c'
);

// Get swap quote
const swapQuote = await api.swap.getQuote({
  tokenIn: '0xbb4Cmb9CBd36B01b1cBaEBF2De08d9173bc095c',
  tokenOut: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  amountIn: '100000000000000000000',
  slippageTolerancePercent: 0.5
});
```

### React Hook Usage
```javascript
import { useMoonEx } from '@moonex/react-hooks';

function TradingComponent() {
  const { tokens, getQuote, executeSwap } = useMoonEx();

  const handleSwap = async () => {
    const quote = await getQuote(tokenA, tokenB, amount);
    const result = await executeSwap(quote);
  };

  return (
    <div>
      {/* Trading UI */}
    </div>
  );
}
```

### Browser Usage
```javascript
// Using fetch API
const tokenInfo = await fetch('https://api.moonex.com/api/v1/tokens/0xbb4CdB9CBd36B01b1cBaEBF2De08d9173bc095c')
  .then(response => response.json());

// Using WebSocket
const ws = new WebSocket('wss://api.moonex.com/ws');
ws.onopen = () => {
  ws.send(JSON.stringify({
    event: 'subscribe',
    channel: 'tokens'
  }));
};
```

## Error Codes Reference

### 400 Bad Request
- **Description**: Invalid request parameters
- **Example**: Invalid token address format
- **Solution**: Validate input parameters before sending

### 401 Unauthorized
- **Description**: Authentication required
- **Example**: No or invalid JWT token
- **Solution**: Authenticate with valid JWT token

### 403 Forbidden
- **Description**: Insufficient permissions
- **Example**: User doesn't have access to resource
- **Solution**: Check user permissions

### 404 Not Found
- **Description**: Resource not found
- **Example**: Token address not found
- **Solution**: Verify resource exists

### 429 Too Many Requests
- **Description**: Rate limit exceeded
- **Example**: Too many requests in short time
- **Solution**: Implement retry logic with exponential backoff

### 500 Internal Server Error
- **Description**: Server error occurred
- **Example**: Database connection failed
- **Solution**: Check server logs and retry

### 502 Bad Gateway
- **Description**: Invalid gateway configuration
- **Example**: Upstream service unavailable
- **Solution**: Check service status

### 503 Service Unavailable
- **Description**: Service temporarily unavailable
- **Example**: BSC RPC connection issues
- **Solution**: Check service status and retry

This comprehensive API documentation provides developers with all the information needed to integrate with the MoonEx Viem-powered backend API, including examples for different platforms and frameworks.