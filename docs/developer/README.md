# 👨‍💻 Viem Developer Documentation

**Complete Developer Resources for BSC DEX Backend with Viem 2.38.5**

## 📚 Documentation Overview

This directory contains comprehensive developer resources for working with Viem 2.38.5 in the BSC DEX backend. Whether you're new to Viem or an experienced developer, you'll find everything you need to build robust blockchain applications.

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Documentation Structure](#documentation-structure)
3. [Quick Links](#quick-links)
4. [Prerequisites](#prerequisites)
5. [Development Workflow](#development-workflow)
6. [Common Patterns](#common-patterns)
7. [Troubleshooting](#troubleshooting)
8. [Contributing](#contributing)

## 🚀 Getting Started

### For New Developers

1. **Start with the Quick Reference**: [Viem Quick Reference](viem-quick-reference.md)
2. **Review Best Practices**: [Viem Best Practices](viem-best-practices.md)
3. **Explore Examples**: Check the `../examples/` directory for practical implementations
4. **Run Tests**: `pnpm test` to ensure everything is working

### For Migrating Developers

1. **Migration Guide**: [Viem Migration Guide](../guides/viem-migration-guide.md)
2. **Comparison Examples**: See side-by-side comparisons with Ethers.js
3. **Breaking Changes**: Review important differences from previous versions

## 📁 Documentation Structure

```
docs/developer/
├── README.md                           # This file - Overview and navigation
├── viem-quick-reference.md             # Essential commands and patterns
├── viem-developer-resources.md         # Comprehensive developer guide
├── viem-best-practices.md              # Professional development guidelines
├── examples/                           # Practical code examples
│   ├── basic-operations.ts             # Fundamental Viem operations
│   ├── swap-operations.ts              # DEX swap implementations
│   ├── testing-examples.test.ts        # Testing patterns and examples
│   └── advanced-patterns.ts            # Complex use cases and patterns
├── testing/                            # Testing documentation
│   ├── test-examples.test.ts           # Example test implementations
│   ├── testing-guidelines.md           # Testing best practices
│   └── mock-patterns.md                # Mock data and test utilities
└── api/                                # API documentation
    ├── token-service.md                # Token service API reference
    ├── swap-service.md                 # Swap service API reference
    └── complete-api-documentation.md   # Full API documentation
```

## 🔗 Quick Links

### Essential Reading

- **[⚡ Quick Reference](viem-quick-reference.md)** - Commands you'll use daily
- **[🎯 Best Practices](viem-best-practices.md)** - Professional development guidelines
- **[📚 Developer Resources](viem-developer-resources.md)** - Comprehensive guide

### Code Examples

- **[🔧 Basic Operations](../examples/basic-operations.ts)** - Client setup, queries, transactions
- **[💱 Swap Operations](../examples/swap-operations.ts)** - DEX integration examples
- **[🧪 Testing Examples](../testing/test-examples.test.ts)** - Test patterns and utilities

### Integration Guides

- **[🔄 Migration Guide](../guides/viem-migration-guide.md)** - From Ethers.js to Viem
- **[🔧 Troubleshooting Guide](../guides/viem-troubleshooting-guide.md)** - Common issues and solutions
- **[📖 API Documentation](api/complete-api-documentation.md)** - Complete API reference

## 🎯 Prerequisites

Before starting development, ensure you have:

### Required Knowledge

- **TypeScript**: Proficient with types and interfaces
- **Blockchain Concepts**: Understanding of addresses, transactions, gas
- **Async/Await**: Comfortable with Promise-based programming
- **BSC Knowledge**: Familiar with Binance Smart Chain specifics

### Development Environment

```bash
# Required Node.js version
node --version  # v18.0.0 or higher

# Required package manager
pnpm --version  # v8.0.0 or higher

# Install dependencies
pnpm install

# Run tests
pnpm test

# Start development server
pnpm dev
```

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit with your configuration
# BSC_RPC_URL=your_rpc_url
# PRIVATE_KEY=your_private_key
# ETHERSCAN_API_KEY=your_api_key
```

## 🔄 Development Workflow

### 1. Setup Your Environment

```bash
# Clone the repository
git clone <repository-url>
cd moonex_be

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration
```

### 2. Explore the Codebase

```bash
# Understand the project structure
find src -name "*.ts" | head -20

# Look at main entry points
cat src/main.ts
cat src/app.ts
```

### 3. Run Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run specific test files
pnpm test token.service.test.ts
```

### 4. Start Development

```bash
# Start development server
pnpm dev

# Make changes and see hot reload
# Test your changes
pnpm test
```

### 5. Quality Checks

```bash
# Type checking
pnpm type-check

# Linting
pnpm lint

# Formatting
pnpm format

# All quality checks
pnpm quality-check
```

## 🏗️ Common Patterns

### Service Pattern

```typescript
// src/services/token.service.ts
export class TokenService {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly cache: CacheService
  ) {}

  async getBalance(tokenAddress: Address, walletAddress: Address): Promise<bigint> {
    // Check cache first
    const cacheKey = `balance:${tokenAddress}:${walletAddress}`;
    const cached = await this.cache.get<bigint>(cacheKey);
    if (cached) return cached;

    // Fetch from blockchain
    const balance = await this.publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [walletAddress]
    });

    // Cache for 30 seconds
    await this.cache.set(cacheKey, balance, 30);
    return balance;
  }
}
```

### Error Handling Pattern

```typescript
// src/utils/error-handler.ts
export async function handleViemOperation<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ContractFunctionExecutionError) {
      logger.error(`Contract execution failed in ${context}`, error);
      throw new ContractError(error.message, error.address as Address, error.functionName);
    }
    throw error;
  }
}
```

### Testing Pattern

```typescript
// src/tests/token.service.test.ts
describe('TokenService', () => {
  let tokenService: TokenService;
  let mockPublicClient: MockPublicClient;

  beforeEach(() => {
    mockPublicClient = createMockPublicClient();
    tokenService = new TokenService(mockPublicClient, mockCacheService);
  });

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
});
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Import Errors

```typescript
// ❌ Wrong
import { ethers } from 'ethers';

// ✅ Correct
import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';
```

#### 2. Address Validation

```typescript
// ❌ Unsafe
function getAddress(address: string): Address {
  return address as Address;
}

// ✅ Safe
function validateAddress(address: string): Address {
  if (!isAddress(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
  return getAddress(address);
}
```

#### 3. Type Errors

```typescript
// ❌ Any type
const balance: any = await publicClient.readContract({...});

// ✅ Proper typing
const balance: bigint = await publicClient.readContract({...});
```

### Getting Help

1. **Check the Troubleshooting Guide**: [Troubleshooting Documentation](../guides/viem-troubleshooting-guide.md)
2. **Review Error Messages**: Look for specific error codes and messages
3. **Check Logs**: Use proper logging to debug issues
4. **Ask for Help**: Join our Discord or create an issue

## 🤝 Contributing

### Code Standards

- **TypeScript**: Use strict mode and proper types
- **ESLint**: Follow configured linting rules
- **Prettier**: Use consistent formatting
- **Tests**: Write tests for new functionality
- **Documentation**: Update docs for new features

### Submitting Changes

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature-name`
3. **Make changes and test**: `pnpm test`
4. **Run quality checks**: `pnpm quality-check`
5. **Commit changes**: Follow commit message conventions
6. **Push and create PR**: Submit pull request for review

### Documentation Updates

When adding new features:

1. **Update code examples** in relevant documentation files
2. **Add API documentation** for new services or methods
3. **Update the quick reference** if adding common patterns
4. **Add troubleshooting entries** for known issues

## 📚 Additional Resources

### Official Documentation

- **[Viem Documentation](https://viem.sh/)** - Official Viem documentation
- **[Viem GitHub](https://github.com/wevm/viem)** - Source code and issues
- **[BSC Documentation](https://docs.binance.org/smart-chain/)** - Binance Smart Chain docs
- **[TypeScript Handbook](https://www.typescriptlang.org/docs/)** - TypeScript guide

### Community Resources

- **[Viem Discord](https://discord.gg/viem)** - Community support
- **[Stack Overflow](https://stackoverflow.com/questions/tagged/viem)** - Q&A
- **[GitHub Discussions](https://github.com/wevm/viem/discussions)** - Feature discussions

### Tools and Utilities

- **[Viem Type Generator](https://github.com/wevm/abitype)** - Type generation from ABIs
- **[Chainlist](https://chainlist.org/)** - Network configurations
- **[Etherscan BSC](https://bscscan.com/)** - BSC block explorer

## 🎯 Learning Path

### Beginner (1-2 weeks)

1. **Read Quick Reference** - Learn basic Viem operations
2. **Study Basic Operations Example** - Understand client setup and simple queries
3. **Run Tests** - See how testing works in the project
4. **Make Small Changes** - Try modifying existing functionality

### Intermediate (2-4 weeks)

1. **Study Best Practices** - Learn professional development patterns
2. **Review Swap Operations** - Understand complex DEX interactions
3. **Write New Services** - Implement new functionality following patterns
4. **Integration Testing** - Learn how to test with real blockchain data

### Advanced (1-2 months)

1. **Performance Optimization** - Implement caching and connection pooling
2. **Security Implementation** - Add advanced security features
3. **Monitoring and Debugging** - Set up comprehensive monitoring
4. **Architecture Contributions** - Help improve project architecture

## 📞 Support

### Getting Help

- **Documentation**: Start with the relevant documentation file
- **Issues**: Create a GitHub issue for bugs or feature requests
- **Discord**: Join our community for real-time help
- **Code Review**: Request code review for complex changes

### Reporting Issues

When reporting issues, include:

1. **Environment Details**: Node version, OS, Viem version
2. **Error Messages**: Full error messages and stack traces
3. **Steps to Reproduce**: Clear steps to reproduce the issue
4. **Expected vs Actual**: What you expected vs what happened
5. **Code Examples**: Minimal code examples that demonstrate the issue

---

## 🎉 Conclusion

This developer documentation provides a comprehensive foundation for working with Viem 2.38.5 in the BSC DEX backend. Whether you're new to blockchain development or an experienced developer, you'll find the resources you need to build successful applications.

**Key Takeaways:**

- Start with the [Quick Reference](viem-quick-reference.md) for daily operations
- Follow [Best Practices](viem-best-practices.md) for professional development
- Use [Examples](../examples/) to learn practical implementations
- Refer to [Troubleshooting Guide](../guides/viem-troubleshooting-guide.md) when issues arise

Happy coding! 🚀

---

*Developer Documentation v2.38.5 | Last Updated: 2025-11-05*