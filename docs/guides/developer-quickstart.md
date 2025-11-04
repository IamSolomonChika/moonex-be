# BSC DEX Integration - Developer Quick Start

## Overview

This guide helps developers quickly integrate with the BSC DEX Integration API. We'll cover the essential setup and common use cases.

## Prerequisites

- Node.js 16+ or Python 3.8+
- BSC wallet with testnet BNB for testing
- Basic understanding of blockchain concepts

## 1. Setup API Client

### JavaScript/Node.js

```bash
# Install required packages
npm install axios ethers
```

```javascript
// config.js
const config = {
  baseURL: process.env.API_BASE_URL || 'https://api.bsc-dex.com/v1',
  apiKey: process.env.API_KEY || 'your_api_key',
  timeout: 30000
};

// api-client.js
const axios = require('axios');

class BSCDEXClient {
  constructor(config) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey
      }
    });
  }

  async request(method, endpoint, data = null) {
    try {
      const response = await this.client({
        method,
        url: endpoint,
        data
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  handleError(error) {
    if (error.response) {
      throw new Error(`API Error: ${error.response.status} - ${error.response.data.message}`);
    } else if (error.request) {
      throw new Error('Network Error: Unable to reach the API');
    } else {
      throw new Error(`Error: ${error.message}`);
    }
  }
}

module.exports = { BSCDEXClient, config };
```

### Python

```bash
# Install required packages
pip install requests web3
```

```python
# config.py
import os
from dotenv import load_dotenv

load_dotenv()

config = {
    'base_url': os.getenv('API_BASE_URL', 'https://api.bsc-dex.com/v1'),
    'api_key': os.getenv('API_KEY', 'your_api_key'),
    'timeout': 30
}

# api_client.py
import requests
import time

class BSCDEXClient:
    def __init__(self, config):
        self.config = config
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'X-API-Key': config['api_key']
        })

    def request(self, method, endpoint, data=None):
        try:
            response = self.session.request(
                method=method,
                url=f"{self.config['base_url']}{endpoint}",
                json=data,
                timeout=self.config['timeout']
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            raise Exception(f"API Error: {e.response.status_code} - {e.response.json().get('message', 'Unknown error')}")
        except requests.exceptions.RequestException as e:
            raise Exception(f"Network Error: Unable to reach the API - {str(e)}")
        except Exception as e:
            raise Exception(f"Error: {str(e)}")

module.exports = {'BSCDEXClient': BSCDEXClient, 'config': config}
```

## 2. Authentication

### Get API Credentials

1. Visit [BSC DEX Developer Portal](https://developer.bsc-dex.com)
2. Create an account and generate an API key
3. Set your API key as an environment variable:

```bash
export API_KEY="your_api_key_here"
# Or add to .env file
```

### Using JWT Tokens (Optional)

```javascript
// auth.js
const jwt = require('jsonwebtoken');

class AuthManager {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  getJWTToken() {
    // Exchange API key for JWT token
    return this.request('POST', '/auth/exchange', {
      apiKey: this.apiKey
    });
  }

  setJWTToken(token) {
    this.client.defaults.headers['Authorization'] = `Bearer ${token}`;
  }
}
```

## 3. Quick Examples

### Get Token List

```javascript
// JavaScript
const { BSCDEXClient } = require('./api-client');

const client = new BSCDEXClient(config);

async function getTokens() {
  try {
    const response = await client.request('GET', '/bsc/tokens', {
      limit: 10,
      verified: true,
      sortBy: 'marketCap',
      sortOrder: 'desc'
    });

    console.log('Tokens retrieved:', response.data.tokens.length);
    return response.data.tokens;
  } catch (error) {
    console.error('Failed to get tokens:', error.message);
  }
}

// Example usage
getTokens().then(tokens => {
  tokens.forEach(token => {
    console.log(`${token.symbol} - $${token.priceUSD} - Risk: ${token.riskLevel}`);
  });
});
```

```python
# Python
from api_client import BSCDEXClient, config

client = BSCDEXClient(config)

def get_tokens():
    try:
        response = client.request('GET', '/bsc/tokens', params={
            'limit': 10,
            'verified': True,
            'sortBy': 'marketCap',
            'sortOrder': 'desc'
        })

        print(f"Tokens retrieved: {len(response['data']['tokens'])}")
        return response['data']['tokens']
    except Exception as e:
        print(f"Failed to get tokens: {e}")

# Example usage
tokens = get_tokens()
for token in tokens:
    print(f"{token['symbol']} - ${token['priceUSD']:.2f} USD - Risk: {token['riskLevel']}")
```

### Get Swap Quote

```javascript
// JavaScript
async function getSwapQuote() {
  try {
    const response = await client.request('POST', '/bsc/trading/quote', {
      tokenIn: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
      tokenOut: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82', // CAKE
      amountIn: '1000000000000000000', // 1 BNB
      slippageTolerance: 1 // 1%
    });

    const quote = response.data;
    console.log('Quote Details:');
    console.log(`Input: ${quote.data.tokenIn.symbol} - ${quote.data.amountIn}`);
    console.log(`Output: ${quote.data.tokenOut.symbol} - ${quote.data.amountOut}`);
    console.log(`Price Impact: ${quote.data.priceImpact}%`);
    console.log(`Gas Estimate: ${quote.data.gasEstimate.estimatedCost} BNB`);

    return quote;
  } catch (error) {
    console.error('Failed to get swap quote:', error.message);
  }
}
```

```python
# Python
def get_swap_quote():
    try:
        response = client.request('POST', '/bsc/trading/quote', data={
            'tokenIn': '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',  # WBNB
            'tokenOut': '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',  # CAKE
            'amountIn': '1000000000000000000',  # 1 BNB
            'slippageTolerance': 1  # 1%
        })

        quote = response['data']
        print('Quote Details:')
        print(f"Input: {quote['data']['tokenIn']['symbol']} - {quote['data']['amountIn']}")
        print(f"Output: {quote['data']['tokenOut']['symbol']} - {quote['data']['amountOut']}")
        print(f"Price Impact: {quote['data']['priceImpact']}%")
        print(f"Gas Estimate: {quote['data']['gasEstimate']['estimatedCost']} BNB")

        return quote
    except Exception as e:
        print(f"Failed to get swap quote: {e}")
```

### Get Portfolio Overview

```javascript
// JavaScript
async function getPortfolioOverview(userAddress) {
  try {
    const response = await client.request('GET', `/bsc/portfolio/overview/${userAddress}`, {
      includeHistorical: true,
      timeframe: '30d'
    });

    const portfolio = response.data;
    console.log('Portfolio Overview:');
    console.log(`Total Value: $${portfolio.data.summary.totalValueUSD.toLocaleString()}`);
    console.log(`Total Return: $${portfolio.data.summary.totalReturn.toLocaleString()} (${portfolio.data.summary.totalReturnPercentage}%)`);
    console.log(`Asset Count: ${portfolio.data.summary.assetCount}`);

    return portfolio;
  } catch (error) {
    console.error('Failed to get portfolio overview:', error.message);
  }
}
```

## 4. Webhook Integration

### Setup Webhook Endpoint

```javascript
// webhook-server.js
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Webhook secret (set in environment)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your_webhook_secret';

// Verify webhook signature
function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(expectedSignature, signature);
}

// Webhook endpoint
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = JSON.stringify(req.body);

  if (!verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;
  console.log('Received webhook event:', event.type);

  // Handle different event types
  switch (event.type) {
    case 'transaction.confirmed':
      handleTransactionConfirmed(event.data);
      break;
    case 'portfolio.updated':
      handlePortfolioUpdated(event.data);
      break;
    default:
      console.log('Unknown event type:', event.type);
  }

  res.status(200).json({ success: true });
});

function handleTransactionConfirmed(data) {
  console.log(`Transaction ${data.transactionHash} confirmed`);
  // Update database, notify users, etc.
}

function handlePortfolioUpdated(data) {
  console.log(`Portfolio updated for ${data.userAddress}`);
  // Update cache, send notifications, etc.
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
```

## 5. Error Handling

### Comprehensive Error Handler

```javascript
// error-handler.js
class ErrorHandler {
  static handle(error) {
    if (error.response) {
      // API returned an error
      const { status, data } = error.response;

      switch (status) {
        case 400:
          return {
            type: 'ValidationError',
            message: data.message || 'Invalid request parameters',
            details: data.details
          };
        case 401:
          return {
            type: 'AuthenticationError',
            message: 'Invalid API credentials',
            details: 'Check your API key'
          };
        case 404:
          return {
            type: 'NotFoundError',
            message: data.message || 'Resource not found',
            details: data.details
          };
        case 429:
          return {
            type: 'RateLimitError',
            message: 'Rate limit exceeded',
            details: `Retry after ${error.response.headers['retry-after']} seconds`
          };
        case 500:
          return {
            type: 'ServerError',
            message: 'Internal server error',
            details: 'Please try again later'
          };
        default:
          return {
            type: 'UnknownError',
            message: data.message || 'An unexpected error occurred',
            details: data.details
          };
      }
    } else if (error.request) {
      // Network error
      return {
        type: 'NetworkError',
        message: 'Unable to connect to the API',
        details: 'Check your internet connection'
      };
    } else {
      // Other error
      return {
        type: 'UnknownError',
        message: error.message,
        details: 'An unexpected error occurred'
      };
    }
  }

  static logError(error, context = '') {
    console.error(`[${new Date().toISOString()}] ${context} Error:`, {
      type: error.type,
      message: error.message,
      details: error.details,
      stack: error.stack
    });
  }
}

// Usage example
try {
  const result = await client.request('GET', '/bsc/tokens');
  console.log('Success:', result);
} catch (error) {
  const errorInfo = ErrorHandler.handle(error);
  ErrorHandler.logError(errorInfo, 'Token Listing');

  if (errorInfo.type === 'RateLimitError') {
    // Implement retry logic
    console.log('Rate limited. Implementing backoff...');
  }
}
```

## 6. Testing

### Unit Tests

```javascript
// tests/api.test.js
const { BSCDEXClient } = require('../api-client');
const expect = require('chai').expect;

describe('BSC DEX API Client', () => {
  let client;

  beforeEach(() => {
    client = new BSCDEXClient({
      baseURL: 'https://api.bsc-dex.com/v1',
      apiKey: 'test_key',
      timeout: 5000
    });
  });

  describe('Token Operations', () => {
    it('should fetch token list', async () => {
      const response = await client.request('GET', '/bsc/tokens', {
        limit: 5
      });

      expect(response).to.have.property('success', true);
      expect(response.data).to.have.property('tokens');
      expect(response.data.tokens).to.be.an('array');
      expect(response.data.tokens).to.have.length(5);
    });

    it('should fetch specific token details', async () => {
      const tokenAddress = '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82'; // CAKE
      const response = await client.request('GET', `/bsc/tokens/${tokenAddress}`);

      expect(response).to.have.property('success', true);
      expect(response.data).to.have.property('address', tokenAddress);
      expect(response.data).to.have.property('symbol', 'CAKE');
    });
  });

  describe('Trading Operations', () => {
    it('should get swap quote', async () => {
      const quoteRequest = {
        tokenIn: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
        tokenOut: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82', // CAKE
        amountIn: '1000000000000000000', // 1 BNB
        slippageTolerance: 1
      };

      const response = await client.request('POST', '/bsc/trading/quote', quoteRequest);

      expect(response).to.have.property('success', true);
      expect(response.data).to.have.property('quoteId');
      expect(response.data).to.have.property('tokenIn');
      expect(response.data).to.have.property('tokenOut');
      expect(response.data).to.have.property('amountOut');
    });
  });
});
```

### Integration Tests

```javascript
// tests/integration.test.js
const { BSCDEXClient } = require('../api-client');
const expect = require('chai').expect;

describe('BSC DEX Integration Tests', () => {
  let client;

  before(() => {
    client = new BSCDEXClient({
      baseURL: process.env.API_BASE_URL || 'https://api.bsc-dex.com/v1',
      apiKey: process.env.API_KEY,
      timeout: 30000
    });
  });

  it('should complete full trading workflow', async function() {
    this.timeout(30000);

    // Step 1: Get available tokens
    const tokensResponse = await client.request('GET', '/bsc/tokens', {
      limit: 10,
      verified: true
    });
    expect(tokensResponse.success).to.be.true;
    const tokens = tokensResponse.data.tokens;
    expect(tokens.length).to.be.greaterThan(0);

    // Step 2: Get swap quote
    const quoteResponse = await client.request('POST', '/bsc/trading/quote', {
      tokenIn: tokens[0].address,
      tokenOut: tokens[1].address,
      amountIn: '100000000000000000000', // 1 token
      slippageTolerance: 1
    });
    expect(quoteResponse.success).to.be.true;
    expect(quoteResponse.data).to.have.property('quoteId');

    // Step 3: Verify quote is still valid
    expect(quoteResponse.data).to.have.property('validUntil');
    expect(Date.now()).to.be.lessThan(quoteResponse.data.validUntil * 1000);

    // Step 4: Check portfolio (if user address available)
    if (process.env.USER_ADDRESS) {
      const portfolioResponse = await client.request(
        'GET',
        `/bsc/portfolio/overview/${process.env.USER_ADDRESS}`
      );
      expect(portfolioResponse.success).to.be.true;
      expect(portfolioResponse.data).to.have.property('summary');
    }
  });
});
```

## 7. Production Deployment

### Environment Variables

```bash
# .env.production
API_BASE_URL=https://api.bsc-dex.com/v1
API_KEY=your_production_api_key
WEBHOOK_SECRET=your_production_webhook_secret
NODE_ENV=production

# Optional: Logging
LOG_LEVEL=info
SENTRY_DSN=your_sentry_dsn

# Optional: Monitoring
NEW_RELIC_LICENSE_KEY=your_newrelic_key
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  bsc-dex-integration:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - API_BASE_URL=${API_BASE_URL}
      - API_KEY=${API_KEY}
      - WEBHOOK_SECRET=${WEBHOOK_SECRET}
    restart: unless-stopped
```

## 8. Rate Limiting Best Practices

### Implement Backoff Strategy

```javascript
class RateLimitedClient {
  constructor(client, options = {}) {
    this.client = client;
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 10000;
  }

  async requestWithRetry(method, endpoint, data = null, retryCount = 0) {
    try {
      return await this.client.request(method, endpoint, data);
    } catch (error) {
      if (error.type === 'RateLimitError' && retryCount < this.maxRetries) {
        const delay = Math.min(
          this.baseDelay * Math.pow(2, retryCount),
          this.maxDelay
        );

        console.log(`Rate limited. Retrying in ${delay}ms...`);
        await this.delay(delay);

        return this.requestWithRetry(method, endpoint, data, retryCount + 1);
      }

      throw error;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Request Queuing

```javascript
class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.rateLimit = 100; // requests per minute
    this.requests = [];
  }

  async add(request) {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const { request, resolve, reject } = this.queue.shift();

      try {
        const result = await request();
        resolve(result);
      } catch (error) {
        reject(error);
      }

      // Respect rate limits
      await this.delay(60000 / this.rateLimit); // 60 seconds / rate limit
    }

    this.processing = false;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

This quick start guide should help you get up and running quickly with the BSC DEX Integration API. For more detailed information, refer to the [Integration Guide](./bsc-integration-guide.md) and [API Documentation](../api/README.md).