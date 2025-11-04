# BSC Testing Infrastructure

This directory contains the comprehensive testing infrastructure for the BSC DEX integration, implementing Section 13 of the OpenSpec change proposal.

## 📁 Directory Structure

```
tests/
├── setup/                          # Test environment setup
│   ├── bsc-test-env.ts            # Main BSC test environment manager
│   ├── test-config.ts             # Test configuration management
│   └── database-setup.ts          # Database setup utilities
├── mocks/                          # Mock contracts and utilities
│   └── pancakeswap-contracts.ts   # PancakeSwap contract mocks
├── unit/                           # Unit tests for individual services
│   ├── trading/                    # Trading service tests
│   │   ├── amm-integration.test.ts
│   │   └── swap-service.test.ts
│   ├── liquidity/                  # Liquidity service tests
│   │   └── liquidity-service.test.ts
│   └── tokens/                     # Token service tests
│       └── token-service.test.ts
├── integration/                    # Integration tests for multi-service workflows
│   ├── trading/                    # Trading integration tests
│   │   └── trading-integration.test.ts
│   └── governance/                 # Governance integration tests
│       └── governance-integration.test.ts
├── e2e/                           # End-to-end tests for complete user workflows
│   └── complete-user-workflows.test.ts
├── scripts/                       # Test utilities and runners
│   └── run-tests.js               # Comprehensive test runner
└── README.md                      # This file
```

## 🚀 Quick Start

### Install Dependencies
```bash
pnpm install
```

### Run All Tests
```bash
# Run all test categories
pnpm test

# Or use the test runner directly
node tests/scripts/run-tests.js
```

### Run Specific Test Categories
```bash
# Unit tests only
node tests/scripts/run-tests.js unit

# Integration tests only
node tests/scripts/run-tests.js integration

# End-to-end tests only
node tests/scripts/run-tests.js e2e

# Multiple categories
node tests/scripts/run-tests.js unit integration
```

### Watch Mode (Development)
```bash
# Watch unit tests for changes
node tests/scripts/run-tests.js --watch unit

# Watch all tests
node tests/scripts/run-tests.js --watch
```

### CI/CD Pipeline
```bash
# Run with coverage for CI/CD
node tests/scripts/run-tests.js --ci
```

## 🧪 Test Categories

### 1. Unit Tests (`tests/unit/`)
- **Purpose**: Test individual services in isolation
- **Coverage**: All BSC services (swap, liquidity, tokens, governance, etc.)
- **Features**:
  - Mock contracts for isolated testing
  - Comprehensive edge case coverage
  - Performance testing for individual components
  - Error handling validation

### 2. Integration Tests (`tests/integration/`)
- **Purpose**: Test interactions between multiple services
- **Coverage**: Trading workflows, governance integration, cross-service data flow
- **Features**:
  - Real contract interaction testing
  - Multi-service workflow validation
  - Data consistency verification
  - Cache integration testing

### 3. End-to-End Tests (`tests/e2e/`)
- **Purpose**: Test complete user workflows from start to finish
- **Coverage**: New user onboarding, active trading, liquidity provision, governance participation
- **Features**:
  - Complete user journey simulation
  - Multiple user personas testing
  - System performance under load
  - Error recovery and edge cases

## 🔧 Test Environment

### BSC Test Environment (`tests/setup/bsc-test-env.ts`)
- **Provider Management**: Configurable BSC network providers
- **Wallet Management**: Pre-configured test wallets
- **Contract Deployment**: Automated contract deployment for testing
- **Blockchain Simulation**: Mock blockchain state and operations
- **Cleanup Operations**: Automatic environment cleanup

### Mock Contracts (`tests/mocks/pancakeswap-contracts.ts`)
- **PancakeSwap Router**: Full V2/V3 router functionality
- **PancakeSwap Factory**: Pair creation and management
- **MasterChef V1/V2**: Farming contract simulation
- **ERC20 Tokens**: Standard token contract mocks
- **Event Simulation**: Realistic event emission and tracking

### Test Configuration (`tests/setup/test-config.ts`)
- **Environment Management**: Multiple test environment configurations
- **Service Configuration**: Centralized service setup
- **Database Configuration**: Test database management
- **Test Data**: Pre-configured test data and fixtures

## 📊 Coverage Requirements

Minimum coverage thresholds:
- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 75%
- **Statements**: 80%

Coverage reports are generated in `coverage/` directory.

## 🎯 Test Features

### Comprehensive Test Scenarios

#### Trading Workflows
- Swap execution with MEV protection
- Multi-hop routing optimization
- Batch operations
- Gas optimization strategies
- Slippage protection
- Error handling and recovery

#### Liquidity Operations
- Single-sided and dual-sided liquidity provision
- Impermanent loss calculation
- Farming and staking workflows
- Reward claiming and compounding
- Risk assessment and management

#### Governance Participation
- Proposal creation and voting
- Voting power tracking
- Delegation mechanisms
- Reward distribution
- Cross-service governance integration

#### Performance Testing
- Concurrent operation handling
- Memory usage optimization
- Cache efficiency validation
- Network congestion simulation
- Stress testing

### Security Testing
- MEV attack simulation
- Front-running detection
- Sandwich attack protection
- Contract interaction security
- Input validation and sanitization

## 🛠️ Development Tools

### Test Runner (`tests/scripts/run-tests.js`)
- **Multi-category execution**: Run specific test categories
- **Coverage reporting**: Integrated coverage analysis
- **Watch mode**: Continuous testing during development
- **CI/CD integration**: Pipeline-ready test execution
- **Performance metrics**: Execution time and resource usage

### Debugging Support
- **Detailed logging**: Comprehensive test execution logs
- **Error reporting**: Clear error messages and stack traces
- **State inspection**: Ability to inspect test state at any point
- **Snapshot testing**: Visual regression testing support

## 📝 Writing Tests

### Test Structure
```typescript
describe('Service Name', () => {
  let service: ServiceType;
  let testEnvironment: BSCTestEnvironment;

  beforeAll(async () => {
    // Setup test environment
    testEnvironment = new BSCTestEnvironment();
    await testEnvironment.initialize();

    // Initialize service
    service = new ServiceType();
  });

  afterAll(async () => {
    // Cleanup
    await testEnvironment.cleanup();
  });

  describe('Feature Group', () => {
    it('should handle basic functionality', async () => {
      // Test implementation
    });

    it('should handle edge cases', async () => {
      // Edge case testing
    });
  });
});
```

### Best Practices
1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up resources after tests
3. **Assertions**: Use specific and meaningful assertions
4. **Error Testing**: Test both success and failure scenarios
5. **Performance**: Include performance assertions where relevant

## 🚨 Troubleshooting

### Common Issues
1. **Port Conflicts**: Ensure test ports are available
2. **Memory Issues**: Increase Node.js memory limit for large test suites
3. **Timeouts**: Adjust test timeouts for complex operations
4. **Environment**: Ensure test environment variables are set correctly

### Debug Mode
```bash
# Run with detailed logging
DEBUG=* node tests/scripts/run-tests.js

# Run specific test with debugging
node --inspect-brk node_modules/.bin/jest tests/unit/trading/swap-service.test.ts
```

## 📈 CI/CD Integration

### GitHub Actions Example
```yaml
name: BSC Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: pnpm install
      - run: node tests/scripts/run-tests.js --ci
      - uses: codecov/codecov-action@v3
```

### Environment Variables
- `NODE_ENV=test`: Set test environment
- `BSC_NETWORK=testnet`: BSC network configuration
- `LOG_LEVEL=info`: Logging verbosity
- `COVERAGE_THRESHOLD=80`: Minimum coverage requirement

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Ethers.js Testing](https://docs.ethers.org/v5/api/providers/provider/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## 🤝 Contributing

When adding new tests:
1. Follow the established directory structure
2. Include comprehensive test coverage
3. Add appropriate error handling tests
4. Update documentation as needed
5. Ensure all tests pass before submitting

For questions or issues with the testing infrastructure, please refer to the project maintainers or create an issue in the project repository.