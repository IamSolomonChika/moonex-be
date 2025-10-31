# MoonEx API

Comprehensive DeFi trading and wallet management API for the MoonEx platform

**Version:** 1.0.0

## 🚀 Features

- **Multi-chain Wallet Management**: Create and manage embedded wallets
- **Token Trading**: Swap tokens with best route finding
- **Liquidity Provision**: Add and remove liquidity from pools
- **Yield Farming**: Stake tokens and earn rewards
- **Governance**: Participate in protocol governance
- **Limit Orders**: Create and manage limit orders
- **Authentication**: Multiple auth methods (email, social, wallet)

## 📋 Table of Contents

- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [SDKs and Tools](#sdks-and-tools)
- [Support](#support)

## 🔐 Authentication

This API uses JWT Bearer tokens for authentication. Include the token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

### Authentication Methods

1. **Email Authentication**
   - Send code to email: `POST /auth/email`
   - Verify code: `POST /auth/email/verify`

2. **Social Authentication**
   - Authenticate with provider: `POST /auth/social`
   - Supported providers: `google`, `apple`, `twitter`, `facebook`

3. **Wallet Authentication**
   - Sign message with wallet: `POST /auth/wallet`

4. **Token Refresh**
   - Refresh access token: `POST /auth/refresh`

## 🛠 API Endpoints

### Authentication
- `POST /api/v1/auth/email` - Create email
- `POST /api/v1/auth/email/verify` - Create verify
- `POST /api/v1/auth/social` - Create social
- `POST /api/v1/auth/wallet` - Create wallet
- `POST /api/v1/auth/refresh` - Create refresh
- `POST /api/v1/auth/logout` - Create logout
- `GET /api/v1/auth/me` - List me

### Wallet Management
- `POST /api/v1/wallets` - Create wallets
- `GET /api/v1/wallets/{walletAddress}` - Get {wallet Address}
- `GET /api/v1/wallets/{walletAddress}/balance` - Get balance
- `POST /api/v1/wallets/sign` - Create sign
- `POST /api/v1/wallets/send` - Create send
- `GET /api/v1/wallets/{walletAddress}/transactions` - Get transactions
- `POST /api/v1/wallets/estimate-gas` - Create estimate-gas

### Trading
- `POST /api/v1/trading/quote` - Create quote
- `POST /api/v1/trading/swap` - Create swap
- `POST /api/v1/trading/routes` - Create routes
- `POST /api/v1/trading/gas-estimate` - Create gas-estimate

### Liquidity
- `POST /api/v1/liquidity/pools` - Create pools
- `GET /api/v1/liquidity/pools` - List pools
- `GET /api/v1/liquidity/pools/{poolId}` - Get {pool Id}
- `POST /api/v1/liquidity/pools/{poolId}/add` - Create add
- `POST /api/v1/liquidity/pools/{poolId}/remove` - Create remove

### Yield Farming
- `POST /api/v1/yield/farms` - Create farms
- `GET /api/v1/yield/farms` - List farms
- `GET /api/v1/yield/farms/{farmId}` - Get {farm Id}
- `POST /api/v1/yield/farms/{farmId}/stake` - Create stake
- `POST /api/v1/yield/farms/{farmId}/unstake` - Create unstake
- `POST /api/v1/yield/farms/{farmId}/claim` - Create claim

### Governance
- `POST /api/v1/governance/proposals` - Create proposals
- `GET /api/v1/governance/proposals` - List proposals
- `GET /api/v1/governance/proposals/{proposalId}` - Get {proposal Id}
- `POST /api/v1/governance/proposals/{proposalId}/vote` - Create vote
- `GET /api/v1/governance/proposals/{proposalId}/votes` - Get votes

### Limit Orders
- `POST /api/v1/limit-orders/orders` - Create orders
- `GET /api/v1/limit-orders/orders` - List orders
- `GET /api/v1/limit-orders/orders/{orderId}` - Get {order Id}
- `DELETE /api/v1/limit-orders/orders/{orderId}` - Delete {order Id}
- `GET /api/v1/limit-orders/orderbook/{tokenIn}/{tokenOut}` - Get {token Out}

## 📊 Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

## 🚦 Error Handling

| Status Code | Description | Example |
|-------------|-------------|---------|
| 200 | Success | Operation completed successfully |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication required |
| 404 | Not Found | Resource not found |
| 422 | Validation Error | Request validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error occurred |

## ⚡ Rate Limiting

The API implements rate limiting to ensure fair usage:

- **Authentication endpoints**: 5 requests per minute
- **Trading endpoints**: 60 requests per minute
- **General API endpoints**: 100 requests per minute

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Time when limit resets

## 🛠 SDKs and Tools

### JavaScript/TypeScript

```bash
npm install @moonex/sdk
```

```javascript
import { MoonExAPI } from '@moonex/sdk';

const api = new MoonExAPI({
  baseURL: 'https://api.moonex.io/v1',
  apiKey: 'your-api-key'
});

// Get wallet balance
const balance = await api.wallets.getBalance(walletAddress);
```

### Python

```bash
pip install moonex-sdk
```

```python
from moonex import MoonExAPI

api = MoonExAPI(
    base_url='https://api.moonex.io/v1',
    api_key='your-api-key'
)

# Get wallet balance
balance = api.wallets.get_balance(wallet_address)
```

## 📚 Documentation

- **[Interactive Swagger UI](./index.html)** - Try out API endpoints
- **[ReDoc Documentation](./redoc.html)** - Alternative documentation format
- **[OpenAPI Specification](./openapi.json)** - Raw API specification
- **[Postman Collection](./collections/postman_collection.json)** - Import to Postman

## 🤝 Support

For support, please contact:

- **Email**: support@moonex.io
- **Documentation**: https://moonex.io
- **Issues**: [GitHub Issues](https://github.com/moonex/api/issues)

## 📄 License

MIT

---

**Last Updated**: 2025-10-29
