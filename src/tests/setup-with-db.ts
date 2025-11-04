// Jest setup file with real database integration
import 'jest';
import dotenv from 'dotenv';
import { initializeDatabase, disconnectDatabase } from '../config/database';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Initialize database for tests
let database: any;

beforeAll(async () => {
  console.log('Setting up test database...');

  // Initialize database connection for tests
  try {
    database = initializeDatabase();

    // Wait a moment for database to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Test database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize test database:', error);
    throw error;
  }
});

afterAll(async () => {
  console.log('Cleaning up test database...');

  // Clean up database connection after all tests
  if (database) {
    try {
      await disconnectDatabase();
      console.log('Test database disconnected successfully');
    } catch (error) {
      console.error('Failed to disconnect test database:', error);
    }
  }
});

// Mock external modules that might not be available in test environment
jest.mock('@privy-io/server-auth', () => ({
  PrivyClient: jest.fn().mockImplementation(() => ({
    // Mock implementation
    verifyAuthToken: jest.fn().mockResolvedValue({ userId: 'test-user-id' }),
    getUser: jest.fn().mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
      linked_accounts: []
    }),
    createWallet: jest.fn().mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890'
    }),
    signMessage: jest.fn().mockResolvedValue('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'),
    sendTransaction: jest.fn().mockResolvedValue({
      hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    }),
    getBalance: jest.fn().mockResolvedValue([
      { tokenAddress: '0x0', tokenSymbol: 'ETH', tokenName: 'Ethereum', balance: '1.5', decimals: 18 }
    ]),
    getTransactionHistory: jest.fn().mockResolvedValue([
      {
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        from: '0x1234567890123456789012345678901234567890',
        to: '0x9876543210987654321098765432109876543210',
        value: '0.1',
        gasUsed: '21000',
        gasPrice: '20000000000',
        status: 'confirmed',
        timestamp: new Date(),
        blockNumber: 12345
      }
    ]),
    estimateGas: jest.fn().mockResolvedValue({
      gasLimit: '21000',
      gasPrice: '20000000000',
      maxFeePerGas: '30000000000',
      maxPriorityFeePerGas: '2000000000'
    })
  }))
}));

// Set up global test configuration
global.console = {
  ...console,
  // Keep error logging for debugging
  error: console.error,
  warn: console.warn,
  // Suppress other logs in tests unless needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};

// Ensure test environment variables are set
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';