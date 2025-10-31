# MoonEx Backend API

A decentralized exchange backend API with Privy authentication and embedded wallet functionality.

## Overview

MoonEx is a modern decentralized exchange platform that provides secure authentication and wallet management through Privy. This backend API handles user authentication, wallet operations, and transaction management.

## Features

### 🔐 Authentication & Security

- **Multi-provider authentication**: Email, social providers (Google, Twitter, Discord), and wallet-based authentication
- **Secure session management**: JWT-based authentication with refresh tokens
- **Privy integration**: Enterprise-grade authentication infrastructure
- **Rate limiting & CORS**: Built-in security protections
- **Input validation**: Comprehensive request validation

### 💳 Wallet Management

- **Embedded wallets**: Automatic wallet creation for authenticated users
- **Multi-chain support**: Ethereum, Polygon, Arbitrum, and more
- **Transaction operations**: Send, receive, and track transactions
- **Gas fee estimation**: Real-time gas fee calculations
- **Balance tracking**: Multi-token balance monitoring

### 📈 DEX Trading Features

- **Automated Market Maker (AMM)**: Uniswap V2-style constant product formula
- **Token Swaps**: Direct token swaps with slippage protection
- **Price Impact Calculation**: Real-time price impact analysis
- **Gas Estimation**: Accurate gas cost predictions
- **Route Optimization**: Multi-hop routing for best prices
- **Front-running Protection**: MEV protection mechanisms

### 🏦 Liquidity & Yield Farming

- **Liquidity Pool Management**: Create and manage AMM pools
- **LP Token Operations**: Mint, burn, and track liquidity positions
- **Yield Farming**: Stake LP tokens for rewards
- **Impermanent Loss Tracking**: Real-time loss calculations
- **Pool Analytics**: Volume, TVL, and performance metrics

### 🤖 Advanced Trading

- **Limit Orders**: Place buy/sell orders at specific prices
- **Stop-Loss Orders**: Automated risk management
- **Trading Bots**: Grid trading, DCA, and momentum strategies
- **Portfolio Management**: Track all positions and performance
- **Real-time Analytics**: Comprehensive trading insights

### 🏛️ Governance System

- **Proposals**: Create, discuss, and vote on protocol changes
- **Vote Delegation**: Delegate voting power to trusted representatives
- **Treasury Management**: Community-controlled fund allocation
- **Token Governance**: Weighted voting based on token holdings
- **Discussion Platform**: Community engagement and debate

### 🌉 Cross-Chain Features (Planned)

- **Multi-Chain Support**: Bridge assets across different blockchains
- **LayerZero Integration**: Secure cross-chain messaging
- **Wormhole Support**: Additional bridge protocols
- **Cross-Chain Swaps**: Seamless asset exchange between networks

### API Features

- **RESTful API**: Clean, well-documented endpoints
- **TypeScript**: Full type safety and IntelliSense support
- **Modular architecture**: Clean separation of concerns
- **Comprehensive testing**: Unit and integration tests
- **Error handling**: Consistent error responses

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Fastify
- **Language**: TypeScript
- **Authentication**: Privy
- **Testing**: Jest
- **Package Manager**: pnpm

## Quick Start

### Prerequisites

- Node.js 18+ installed
- Privy account (sign up at [https://privy.io](https://privy.io))
- Git installed

### Installation

1. Clone the repository:

```bash
git clone https://github.com/your-org/moonex-be.git
cd moonex-be
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

4. Configure your environment variables:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# Required - Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require

# Required - Privy Configuration (get from https://dashboard.privy.io)
PRIVY_APP_ID=your_app_id_here
PRIVY_APP_SECRET=your_app_secret_here

# Required - JWT Configuration
JWT_SECRET=your_jwt_secret_here_change_in_production
JWT_EXPIRES_IN=7d

# Optional - Server Configuration
PORT=3000
NODE_ENV=development

# Optional - Governance Configuration
GOVERNANCE_TOKEN_ADDRESS=0x0000000000000000000000000000000000000000
GOVERNANCE_TOKEN_SYMBOL=MOON
GOVERNANCE_TOKEN_DECIMALS=18
QUORUM_PERCENTAGE=4
APPROVAL_THRESHOLD_PERCENTAGE=51
VOTING_PERIOD_DAYS=7
```

See [Environment Variables](#environment-variables) for a complete list of all available configuration options.

5. Set up the database (if using PostgreSQL):

```bash
# Run database migrations
pnpm prisma migrate dev

# Generate Prisma client
pnpm prisma generate
```

6. Start the development server:

```bash
pnpm dev
```

The API will be available at `http://localhost:3000`

## Configuration

### Environment Variables

#### Required Variables

| Variable           | Description                                    | Source |
| ------------------ | ---------------------------------------------- | ------ |
| `DATABASE_URL`     | PostgreSQL connection string                    | Your DB provider |
| `PRIVY_APP_ID`     | Your Privy application ID                      | Privy Dashboard |
| `PRIVY_APP_SECRET` | Your Privy application secret                  | Privy Dashboard |
| `JWT_SECRET`       | Secret for JWT token signing                   | Generate yourself |

#### Optional Variables (Commonly Used)

| Variable                       | Description                                   | Default |
| ------------------------------ | --------------------------------------------- | ------- |
| `PORT`                         | Server port                                   | 3000 |
| `NODE_ENV`                     | Environment mode                              | development |
| `JWT_EXPIRES_IN`               | JWT token expiration time                     | 7d |
| `PRIVY_WALLET_API_URL`         | Custom Privy wallet API URL                   | https://api.privy.io |
| `PRIVY_AUTH_API_URL`           | Custom Privy auth API URL                     | https://auth.privy.io |

#### Advanced Configuration

| Category                        | Variables |
| ------------------------------- | -------------------------------------------------------------------------------- |
| **Blockchain**                  | `DEFAULT_CHAIN_ID`, `DEFAULT_RPC_URL` |
| **DEX Configuration**           | `UNISWAP_V2_ROUTER`, `FACTORY_ADDRESS`, `GAS_PRICE_WEI`, `MAX_GAS_LIMIT` |
| **Governance**                  | `GOVERNANCE_TOKEN_ADDRESS`, `GOVERNANCE_TOKEN_SYMBOL`, `QUORUM_PERCENTAGE` |
| **Security**                    | `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`, `CORS_ORIGIN` |
| **Monitoring**                  | `LOG_LEVEL`, `ENABLE_REQUEST_LOGGING`, `SENTRY_DSN` |
| **Development**                 | `DEBUG`, `ENABLE_HOT_RELOAD`, `MOCK_BLOCKCHAIN_SERVICES` |
| **Production**                  | `REDIS_URL`, `CDN_URL`, `ANALYTICS_API_KEY` |

For a complete list of all environment variables, see [`.env.example`](.env.example).

### Privy Setup

Follow the [Privy Configuration Guide](docs/privy-setup.md) to set up your Privy application correctly.

## API Documentation

### Base URL

```
https://api.moonex.com/v1
```

### Authentication Endpoints

#### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Register

```http
POST /auth/register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "password123",
  "name": "New User"
}
```

#### Get Profile

```http
GET /auth/me
Authorization: Bearer <token>
```

### Wallet Endpoints

#### Create Wallet

```http
POST /wallets/create
Authorization: Bearer <token>
```

#### Get Balance

```http
GET /wallets/balance?token=ETH
Authorization: Bearer <token>
```

#### Send Transaction

```http
POST /wallets/transfer
Authorization: Bearer <token>
Content-Type: application/json

{
  "to": "0x9876543210987654321098765432109876543210",
  "amount": "0.1",
  "token": "ETH"
}
```

### Trading Endpoints

#### Get Swap Quote

```http
POST /api/v1/trading/quote
Content-Type: application/json

{
  "tokenIn": {
    "address": "0x1234567890123456789012345678901234567890",
    "symbol": "ETH",
    "decimals": 18
  },
  "tokenOut": {
    "address": "0x0987654321098765432109876543210987654321",
    "symbol": "USDC",
    "decimals": 6
  },
  "amountIn": "1.0",
  "slippageTolerance": "0.005"
}
```

#### Execute Swap

```http
POST /api/v1/trading/swap
Authorization: Bearer <token>
Content-Type: application/json

{
  "tokenIn": {
    "address": "0x1234567890123456789012345678901234567890",
    "symbol": "ETH",
    "decimals": 18
  },
  "tokenOut": {
    "address": "0x0987654321098765432109876543210987654321",
    "symbol": "USDC",
    "decimals": 6
  },
  "amountIn": "1.0",
  "slippageTolerance": "0.005"
}
```

#### Get Pools

```http
GET /api/v1/trading/pools
```

#### Estimate Gas

```http
POST /api/v1/trading/gas
Content-Type: application/json

{
  "transactionType": "swap",
  "params": {}
}
```

### Liquidity Management Endpoints

#### Create Liquidity Pool

```http
POST /api/v1/liquidity/pools
Authorization: Bearer <token>
Content-Type: application/json

{
  "token0": {
    "address": "0x1234567890123456789012345678901234567890",
    "symbol": "ETH",
    "decimals": 18
  },
  "token1": {
    "address": "0x0987654321098765432109876543210987654321",
    "symbol": "USDC",
    "decimals": 6
  },
  "amount0": "1.0",
  "amount1": "2000.0"
}
```

#### Add Liquidity

```http
POST /api/v1/liquidity/pools/{poolId}/add
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount0": "0.5",
  "amount1": "1000.0"
}
```

### Yield Farming Endpoints

#### Get Available Farms

```http
GET /api/v1/yield/farms
Authorization: Bearer <token>
```

#### Stake in Farm

```http
POST /api/v1/yield/stake
Authorization: Bearer <token>
Content-Type: application/json

{
  "farmId": "farm_123",
  "amount": "100.0"
}
```

### Governance Endpoints

#### Get Proposals

```http
GET /api/v1/governance/proposals
Authorization: Bearer <token>
```

#### Create Proposal

```http
POST /api/v1/governance/proposals
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Protocol Improvement Proposal",
  "description": "Detailed description of the proposal...",
  "votingPeriod": 7
}
```

#### Cast Vote

```http
POST /api/v1/governance/vote
Authorization: Bearer <token>
Content-Type: application/json

{
  "proposalId": "proposal_123",
  "choice": "for",
  "reason": "I support this proposal because..."
}
```

#### Delegate Votes

```http
POST /api/v1/governance/delegate
Authorization: Bearer <token>
Content-Type: application/json

{
  "delegateId": "user_456",
  "tokenAmount": "1000.0"
}
```

### Advanced Trading Endpoints

#### Create Limit Order

```http
POST /api/v1/limit-orders/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "tokenIn": {
    "address": "0x1234567890123456789012345678901234567890",
    "symbol": "ETH",
    "decimals": 18
  },
  "tokenOut": {
    "address": "0x0987654321098765432109876543210987654321",
    "symbol": "USDC",
    "decimals": 6
  },
  "amountIn": "1.0",
  "limitPrice": "2100.0",
  "type": "sell"
}
```

#### Create Trading Bot

```http
POST /api/v1/trading-bots/bots
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Grid Trading Bot",
  "type": "grid",
  "tokenIn": {
    "address": "0x1234567890123456789012345678901234567890",
    "symbol": "ETH",
    "decimals": 18
  },
  "tokenOut": {
    "address": "0x0987654321098765432109876543210987654321",
    "symbol": "USDC",
    "decimals": 6
  },
  "parameters": {
    "upperPrice": "2200.0",
    "lowerPrice": "2000.0",
    "gridCount": 10,
    "totalInvestment": "1000.0"
  }
}
```

#### Get Portfolio

```http
GET /api/v1/portfolio
Authorization: Bearer <token>
```

For complete API documentation, see [API Documentation](docs/api.md).

## Project Structure

```
moonex-be/
├── src/
│   ├── config/              # Configuration and database setup
│   │   ├── index.ts         # Main configuration
│   │   └── database.ts      # Database connection management
│   ├── middleware/          # Fastify middleware
│   │   └── auth.ts          # Authentication middleware
│   ├── routes/              # API route handlers
│   │   ├── auth.ts          # Authentication endpoints
│   │   ├── wallets.ts       # Wallet management endpoints
│   │   ├── trading.ts       # Basic trading endpoints
│   │   ├── liquidity.ts     # Liquidity pool endpoints
│   │   ├── yield.ts         # Yield farming endpoints
│   │   ├── governance.ts    # Governance endpoints
│   │   ├── limit-orders.ts  # Limit order endpoints
│   │   ├── trading-bots.ts  # Trading bot endpoints
│   │   └── portfolio.ts     # Portfolio management endpoints
│   ├── services/            # Business logic services
│   │   ├── auth.ts          # Authentication service
│   │   ├── wallet.ts        # Wallet management service
│   │   ├── trading/         # Trading engine services
│   │   │   ├── index.ts
│   │   │   └── amm-calculator.ts
│   │   ├── liquidity/       # Liquidity management
│   │   │   └── index.ts
│   │   ├── yield/           # Yield farming services
│   │   │   └── index.ts
│   │   ├── governance/      # Governance services
│   │   │   └── index.ts
│   │   ├── limit-orders/    # Limit order services
│   │   │   └── index.ts
│   │   ├── stop-loss/       # Stop-loss order services
│   │   │   └── index.ts
│   │   ├── trading-bots/    # Trading bot services
│   │   │   └── index.ts
│   │   └── portfolio/       # Portfolio services
│   │       └── index.ts
│   ├── schemas/             # Validation schemas
│   │   ├── auth.ts
│   │   ├── wallets.ts
│   │   └── trading.ts
│   ├── utils/               # Utility functions
│   │   ├── errors.ts        # Error handling utilities
│   │   └── logger.ts        # Logging utilities
│   ├── tests/               # Test files
│   │   ├── setup.ts         # Test setup
│   │   ├── integration.test.ts
│   │   ├── auth.test.ts
│   │   ├── wallet.test.ts
│   │   ├── trading.test.ts
│   │   ├── liquidity.test.ts
│   │   ├── yield.test.ts
│   │   ├── governance.test.ts
│   │   ├── limit-orders.test.ts
│   │   ├── stop-loss.test.ts
│   │   ├── trading-bots.test.ts
│   │   └── portfolio.test.ts
│   ├── generated/           # Prisma generated files
│   │   └── prisma/
│   └── index.ts             # Application entry point
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── migrations/          # Database migrations
├── openspec/                # OpenSpec specifications
│   ├── AGENTS.md            # OpenSpec agent documentation
│   └── changes/             # Change specifications
├── temp-disabled/           # Temporarily disabled files
├── docs/                    # Documentation (to be created)
├── .env.example             # Environment variables template
├── .gitignore               # Git ignore file
├── package.json             # Package configuration
├── pnpm-lock.yaml          # Dependency lock file
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

## Development

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### Code Style

This project uses ESLint and Prettier for code formatting and linting.

```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format
```

### Build

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## Architecture

### Modular Design

The application follows a modular architecture with clear separation of concerns:

- **Services**: Core business logic
- **Routes**: HTTP request handling
- **Middleware**: Request/response processing
- **Schemas**: Data validation
- **Utils**: Shared utilities

### Authentication Flow

1. User authenticates via Privy (email, social, or wallet)
2. Server receives authentication token from Privy
3. Server validates token and creates JWT session
4. Client uses JWT for subsequent API calls
5. Server validates JWT on protected routes

### Wallet Operations

1. User authenticates and creates embedded wallet
2. Wallet operations are performed through Privy SDK
3. Transactions are signed and sent via Privy infrastructure
4. Server tracks transaction status and history

## Security

### Authentication Security

- Privy handles sensitive authentication data
- JWT tokens with secure signing
- Token expiration and refresh mechanism
- Rate limiting on authentication endpoints

### API Security

- Input validation on all endpoints
- SQL injection prevention
- XSS protection
- CORS configuration
- HTTPS enforcement in production

### Best Practices

- Environment variable management
- Secret rotation
- Security headers
- Audit logging
- Error handling without information leakage

## Monitoring and Logging

### Application Monitoring

- Health check endpoint (`/health`)
- Performance metrics
- Error tracking
- Request logging

### Recommended Tools

- Application Performance Monitoring (APM)
- Log aggregation
- Error tracking services
- Uptime monitoring

## Deployment

### Environment Requirements

- Node.js 18+
- 2GB RAM minimum
- 10GB storage minimum
- HTTPS certificate

### Deployment Steps

1. Configure production environment variables
2. Build the application:

```bash
pnpm build
```

3. Deploy to your hosting platform
4. Configure load balancing and SSL
5. Set up monitoring and alerting

For detailed deployment instructions, see the [Deployment Guide](docs/deployment.md).

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Support

- **Documentation**: [https://docs.moonex.com](https://docs.moonex.com)
- **API Reference**: [https://api.moonex.com/docs](https://api.moonex.com/docs)
- **Support**: support@moonex.com
- **Issues**: [GitHub Issues](https://github.com/your-org/moonex-be/issues)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Privy](https://privy.io) for authentication and wallet infrastructure
- [Fastify](https://fastify.dev) for the web framework
- [TypeScript](https://typescriptlang.org) for type safety
- The open-source community for inspiration and tools
