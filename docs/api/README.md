# BSC DEX Integration API

Comprehensive BSC DEX integration platform with PancakeSwap support, token trading, liquidity management, yield farming, and portfolio analytics

## Version

2.0.0

## Base URL

```
- Production Server: https://api.bsc-dex.com/v1
- Staging Server: https://staging-api.bsc-dex.com/v1
- Development Server: http://localhost:3000/v1
```

## Authentication

This API uses JWT Bearer tokens for authentication:

```
Authorization: Bearer YOUR_TOKEN_HERE
```

Alternatively, you can use API keys:

```
X-API-Key: YOUR_API_KEY_HERE
```

## Quick Start

### 1. Get Your API Token

Contact our support team at api-support@bsc-dex.com to get your API credentials.

### 2. Make Your First API Call

```bash
curl -X GET "https://api.bsc-dex.com/v1/bsc/tokens?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 3. Explore Token Trading

```bash
curl -X POST "https://api.bsc-dex.com/v1/bsc/trading/quote" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "tokenIn": "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
    "tokenOut": "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
    "amountIn": "1000000000000000000",
    "slippageTolerance": 1
  }'
```

## API Endpoints

### 🪙 Tokens API
- `GET /bsc/tokens` - List BSC tokens with filtering
- `GET /bsc/tokens/{address}` - Get specific token details
- `GET /bsc/tokens/search` - Search tokens
- `POST /bsc/tokens/verify` - Verify token contract

### 🔄 Trading API
- `POST /bsc/trading/quote` - Get swap quote
- `POST /bsc/trading/swap` - Execute token swap
- `POST /bsc/trading/routes` - Find optimal routes

### 💧 Liquidity API
- `GET /bsc/liquidity/pools` - List liquidity pools
- `POST /bsc/liquidity/quote/add` - Get add liquidity quote

### 🌱 Yield Farming API
- `GET /bsc/yield/farms` - List yield farms
- `POST /bsc/yield/farms/{farmId}/stake` - Stake in farm

### 📊 Portfolio API
- `GET /bsc/portfolio/overview/{address}` - Get portfolio overview
- `GET /bsc/portfolio/performance/{address}` - Get performance metrics

### 🏥 Health API
- `GET /bsc/health` - Check service health

## Rate Limiting

API requests are rate-limited to ensure fair usage:

- **Anonymous users**: 100 requests per minute
- **Authenticated users**: 1,000 requests per minute
- **Premium users**: 5,000 requests per minute

Rate limit headers are included in every response:

- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

## Error Handling

The API uses standard HTTP status codes and returns errors in the following format:

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Invalid parameters provided",
  "details": {
    "field": "tokenIn",
    "reason": "Invalid token address"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123456789"
}
```

### Common Error Codes

- `400 Bad Request` - Invalid parameters or data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `422 Unprocessable Entity` - Validation failed
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## Code Examples

### JavaScript (Node.js)

```javascript
const axios = require('axios');

// Configure API client
const api = axios.create({
  baseURL: 'https://api.bsc-dex.com/v1',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  }
});

// Get token list
const tokens = await api.get('/bsc/tokens', {
  params: { limit: 10, verified: true }
});

// Get swap quote
const quote = await api.post('/bsc/trading/quote', {
  tokenIn: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
  tokenOut: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
  amountIn: '1000000000000000000'
});
```

### Python

```python
import requests

# Configure session
session = requests.Session()
session.headers.update({
  'Authorization': 'Bearer YOUR_TOKEN_HERE'
})

# Get token list
response = session.get('https://api.bsc-dex.com/v1/bsc/tokens', params={
  'limit': 10,
  'verified': True
})
tokens = response.json()

# Get swap quote
quote_response = session.post('https://api.bsc-dex.com/v1/bsc/trading/quote', json={
  'tokenIn': '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
  'tokenOut': '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
  'amountIn': '1000000000000000000'
})
quote = quote_response.json()
```

### cURL

```bash
# Get token list
curl -X GET "https://api.bsc-dex.com/v1/bsc/tokens?limit=10&verified=true" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Get swap quote
curl -X POST "https://api.bsc-dex.com/v1/bsc/trading/quote" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "tokenIn": "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
    "tokenOut": "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
    "amountIn": "1000000000000000000",
    "slippageTolerance": 1
  }'
```

## SDKs and Libraries

Coming soon! We're working on official SDKs for:

- JavaScript/TypeScript
- Python
- Go
- Rust
- Swift

## Support

- **Documentation**: https://docs.bsc-dex.com
- **Email**: api-support@bsc-dex.com
- **Status Page**: https://status.bsc-dex.com
- **API Issues**: https://github.com/bsc-dex/api/issues

## License

MIT

## Changelog

### v2.0.0
- Initial BSC DEX API release
- Token discovery and verification
- Trading with PancakeSwap integration
- Liquidity management
- Yield farming opportunities
- Portfolio analytics

---

For more detailed information, see our [full documentation](https://docs.bsc-dex.com) or [interactive API explorer](./index.html).
