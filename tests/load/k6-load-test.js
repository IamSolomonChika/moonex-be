import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
export let errorRate = new Rate('errors');
export let responseTime = new Trend('response_time');
export let tradingSuccessRate = new Rate('trading_success');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 500 }, // Ramp up to 500 users
    { duration: '5m', target: 500 }, // Stay at 500 users
    { duration: '2m', target: 1000 }, // Ramp up to 1000 users
    { duration: '5m', target: 1000 }, // Stay at 1000 users
    { duration: '2m', target: 2000 }, // Peak load
    { duration: '5m', target: 2000 }, // Stay at peak load
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'], // Error rate under 10%
    errors: ['rate<0.1'],
    trading_success: ['rate>0.95'], // 95% trading success rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/v1`;

// Test data
const USERS = [
  { email: 'user1@test.com', password: 'password123', wallet: '0x1234...' },
  { email: 'user2@test.com', password: 'password123', wallet: '0x5678...' },
  { email: 'user3@test.com', password: 'password123', wallet: '0x9abc...' },
];

const TOKENS = {
  BNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
  WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
};

// Helper functions
function randomUser() {
  return USERS[Math.floor(Math.random() * USERS.length)];
}

function randomTokenPair() {
  const tokens = Object.keys(TOKENS);
  const from = tokens[Math.floor(Math.random() * tokens.length)];
  let to = tokens[Math.floor(Math.random() * tokens.length)];
  while (to === from) {
    to = tokens[Math.floor(Math.random() * tokens.length)];
  }
  return { from: TOKENS[from], to: TOKENS[to] };
}

function generateRandomAmount() {
  return (Math.random() * 10).toFixed(4); // Random amount 0-10
}

function generateWallet() {
  return '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

// Authentication
function authenticate(user) {
  const loginPayload = JSON.stringify({
    email: user.email,
    password: user.password,
  });

  const loginParams = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const loginResponse = http.post(`${API_BASE}/auth/login`, loginPayload, loginParams);

  const success = check(loginResponse, {
    'login successful': (r) => r.status === 200,
    'token received': (r) => r.json('token') !== undefined,
  });

  if (success) {
    return loginResponse.json('token');
  }

  return null;
}

// Main test functions
export function setup() {
  console.log('Starting BSC DEX Load Test');
  console.log(`Target URL: ${BASE_URL}`);

  // Validate API is accessible
  const healthResponse = http.get(`${API_BASE}/health`);
  check(healthResponse, {
    'API is healthy': (r) => r.status === 200,
  }) || console.log('API health check failed');
}

export default function () {
  const user = randomUser();
  const token = authenticate(user);

  if (!token) {
    errorRate.add(1);
    return;
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Test 1: Get token list
  const tokenListResponse = http.get(`${API_BASE}/bsc/tokens`, { headers });
  check(tokenListResponse, {
    'token list status 200': (r) => r.status === 200,
    'token list has data': (r) => r.json('data').length > 0,
  });

  // Test 2: Search tokens
  const searchResponse = http.get(`${API_BASE}/bsc/tokens/search?query=CAKE`, { headers });
  check(searchResponse, {
    'search status 200': (r) => r.status === 200,
    'search has results': (r) => r.json('data').length > 0,
  });

  // Test 3: Get trading quote
  const { from, to } = randomTokenPair();
  const amount = generateRandomAmount();

  const quoteParams = {
    headers,
    params: {
      from,
      to,
      amount,
    },
  };

  const quoteResponse = http.get(`${API_BASE}/bsc/trading/quote`, quoteParams);
  const quoteSuccess = check(quoteResponse, {
    'quote status 200': (r) => r.status === 200,
    'quote has price': (r) => r.json('data') && r.json('data').price,
    'quote has gas': (r) => r.json('data') && r.json('data').gas,
  });

  // Test 4: Execute trade (if quote successful)
  if (quoteSuccess && Math.random() > 0.7) { // 30% chance of executing trade
    const tradePayload = JSON.stringify({
      from,
      to,
      amount,
      slippage: 1.0,
      wallet: generateWallet(),
    });

    const tradeResponse = http.post(`${API_BASE}/bsc/trading/swap`, tradePayload, {
      headers,
      params: {
        dry_run: true, // Execute as dry run to avoid actual blockchain transactions
      },
    });

    const tradeSuccess = check(tradeResponse, {
      'trade status 200': (r) => r.status === 200,
      'trade has transaction': (r) => r.json('data') && r.json('data').transaction,
    });

    tradingSuccessRate.add(tradeSuccess ? 1 : 0);
  }

  // Test 5: Get portfolio data
  const portfolioResponse = http.get(`${API_BASE}/bsc/portfolio`, { headers });
  check(portfolioResponse, {
    'portfolio status 200': (r) => r.status === 200,
    'portfolio has data': (r) => r.json('data'),
  });

  // Test 6: Get liquidity pools
  const poolsResponse = http.get(`${API_BASE}/bsc/liquidity/pools`, { headers });
  check(poolsResponse, {
    'pools status 200': (r) => r.status === 200,
    'pools has data': (r) => r.json('data').length > 0,
  });

  // Test 7: Get yield farms
  const farmsResponse = http.get(`${API_BASE}/bsc/yield/farms`, { headers });
  check(farmsResponse, {
    'farms status 200': (r) => r.status === 200,
    'farms has data': (r) => r.json('data').length > 0,
  });

  // Wait between requests
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

export function teardown() {
  console.log('Load test completed');
  console.log('Error Rate:', errorRate.rate * 100, '%');
  console.log('Trading Success Rate:', tradingSuccessRate.rate * 100, '%');
}

// High-frequency trading specific test
export function tradingStressTest() {
  const options = {
    stages: [
      { duration: '1m', target: 100 },
      { duration: '10m', target: 1000 },
      { duration: '5m', target: 2000 },
      { duration: '10m', target: 2000 },
      { duration: '5m', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<800'],
      http_req_failed: ['rate<0.2'],
      trading_success: ['rate>0.90'],
    },
  };

  return options;
}

// Readiness test
export function readinessTest() {
  const options = {
    stages: [
      { duration: '1m', target: 10 },
      { duration: '5m', target: 50 },
      { duration: '1m', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<300'],
      http_req_failed: ['rate<0.05'],
    },
  };

  return options;
}

// Failover test
export function failoverTest() {
  const options = {
    stages: [
      { duration: '2m', target: 500 },
      { duration: '10m', target: 500 }, // Sustained load
      { duration: '5m', target: 1000 }, // Increased load
      { duration: '10m', target: 1000 },
      { duration: '2m', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<1000'],
      http_req_failed: ['rate<0.3'],
    },
  };

  return options;
}