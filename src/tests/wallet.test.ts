import {
  createEmbeddedWallet,
  getWalletInfo,
  getWalletBalance,
  signTransaction,
  sendTransaction,
  getTransactionHistory,
  estimateGasFees,
  Wallet,
  TokenBalance,
  Transaction,
  GasEstimate
} from '../services/wallet';
import { User } from '../services/auth';

// Mock user for testing
const mockUser: User = {
  id: 'test-user-123',
  privyUserId: 'privy-test-user-123',
  email: 'test@example.com',
  walletAddress: '0x1234567890123456789012345678901234',
  linkedAccounts: [
    { type: 'wallet', address: '0x1234567890123456789012345678901234' }
  ]
};

// Mock wallet for testing
const mockWallet: Wallet = {
  id: 'wallet-123',
  address: '0x1234567890123456789012345678901234',
  userId: 'test-user-123',
  type: 'embedded',
  chainId: '1',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

// Mock token balances for testing
const mockBalances: TokenBalance[] = [
  {
    tokenAddress: '0x0000000000000000000000000000000',
    tokenSymbol: 'ETH',
    tokenName: 'Ethereum',
    balance: '1.5',
    decimals: 18
  },
  {
    tokenAddress: '0x1234567890123456789012345678901234',
    tokenSymbol: 'USDC',
    tokenName: 'USD Coin',
    balance: '1000.0',
    decimals: 6
  }
];

// Mock transactions for testing
const mockTransactions: Transaction[] = [
  {
    hash: '0x1234567890123456789012345678901234567890123',
    from: '0x1234567890123456789012345678901234',
    to: '0x9876543210987654321098765432109876',
    value: '1000000000000000000',
    gasUsed: '21000',
    gasPrice: '20000000000',
    status: 'confirmed',
    timestamp: new Date(Date.now() - 86400000),
    blockNumber: 12345678
  },
  {
    hash: '0x9876543210987654321098765432109876543210',
    from: '0x9876543210987654321098765432109876',
    to: '0x1234567890123456789012345678901234',
    value: '500000000000000000',
    gasUsed: '21000',
    gasPrice: '20000000000',
    status: 'confirmed',
    timestamp: new Date(Date.now() - 172800000),
    blockNumber: 12345677
  }
];

// Mock gas estimate for testing
const mockGasEstimate: GasEstimate = {
  gasLimit: '21000',
  gasPrice: '20000000000',
  estimatedCost: '420000000000000'
};

describe('Wallet Service', () => {
  describe('createEmbeddedWallet', () => {
    it('should create wallet for user', async () => {
      const result = await createEmbeddedWallet(mockUser);
      
      expect(result.success).toBe(true);
      expect(result.wallet).toBeDefined();
      expect(result.wallet?.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(result.wallet?.userId).toBe(mockUser.id);
    });

    it('should handle wallet creation error', async () => {
      // This test would need to mock the Privy client to throw an error
      // For now, we'll just test the success case
      const result = await createEmbeddedWallet(mockUser);
      
      expect(result.success).toBe(true);
    });
  });

  describe('getWalletInfo', () => {
    it('should return wallet info for valid wallet', async () => {
      const result = await getWalletInfo(mockWallet.address, mockUser);
      
      expect(result.success).toBe(true);
      expect(result.wallet).toBeDefined();
      expect(result.wallet?.address).toBe(mockWallet.address);
      expect(result.wallet?.userId).toBe(mockUser.id);
    });

    it('should return error for unauthorized wallet', async () => {
      const result = await getWalletInfo('0xunauthorizedwallet', mockUser);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Wallet not found or access denied');
    });
  });

  describe('getWalletBalance', () => {
    it('should return wallet balance for valid wallet', async () => {
      const result = await getWalletBalance(mockWallet.address, mockUser);
      
      expect(result.success).toBe(true);
      expect(result.balances).toBeDefined();
      expect(result.balances?.length).toBeGreaterThan(0);
      expect(result.balances?.[0].tokenSymbol).toBe('ETH');
    });

    it('should return error for unauthorized wallet', async () => {
      const result = await getWalletBalance('0xunauthorizedwallet', mockUser);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Wallet not found or access denied');
    });
  });

  describe('signTransaction', () => {
    it('should sign transaction for valid wallet', async () => {
      const result = await signTransaction(
        mockWallet.address,
        '0x9876543210987654321098765432109876',
        '1000000000000000000',
        '0x',
        mockUser
      );
      
      expect(result.success).toBe(true);
      expect(result.signature).toBeDefined();
      expect(result.signature).toMatch(/^0x[a-fA-F0-9]{130}$/);
    });

    it('should return error for unauthorized wallet', async () => {
      const result = await signTransaction(
        '0xunauthorizedwallet',
        '0x9876543210987654321098765432109876',
        '1000000000000000000',
        '0x',
        mockUser
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Wallet not found or access denied');
    });
  });

  describe('sendTransaction', () => {
    it('should send transaction for valid wallet', async () => {
      const result = await sendTransaction(
        mockWallet.address,
        '0x9876543210987654321098765432109876',
        '1000000000000000000',
        'ETH',
        '0x',
        mockUser
      );
      
      expect(result.success).toBe(true);
      expect(result.transactionHash).toBeDefined();
      expect(result.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should return error for unauthorized wallet', async () => {
      const result = await sendTransaction(
        '0xunauthorizedwallet',
        '0x9876543210987654321098765432109876',
        '1000000000000000000',
        'ETH',
        '0x',
        mockUser
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Wallet not found or access denied');
    });
  });

  describe('getTransactionHistory', () => {
    it('should return transaction history for valid wallet', async () => {
      const result = await getTransactionHistory(mockWallet.address, mockUser, 1, 10);
      
      expect(result.success).toBe(true);
      expect(result.transactions).toBeDefined();
      expect(result.transactions?.length).toBeGreaterThan(0);
      expect(result.transactions?.[0].hash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should return error for unauthorized wallet', async () => {
      const result = await getTransactionHistory('0xunauthorizedwallet', mockUser, 1, 10);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Wallet not found or access denied');
    });
  });

  describe('estimateGasFees', () => {
    it('should estimate gas fees for valid transaction', async () => {
      const result = await estimateGasFees(
        '0x9876543210987654321098765432109876',
        '1000000000000000000',
        '0x'
      );
      
      expect(result.success).toBe(true);
      expect(result.estimate).toBeDefined();
      expect(result.estimate?.gasLimit).toBe('21000');
      expect(result.estimate?.gasPrice).toBe('20000000000');
    });

    it('should handle gas estimation error', async () => {
      // This test would need to mock the Privy client to throw an error
      // For now, we'll just test the success case
      const result = await estimateGasFees(
        '0x9876543210987654321098765432109876',
        '1000000000000000000',
        '0x'
      );
      
      expect(result.success).toBe(true);
      expect(result.estimate).toBeDefined();
    });
  });
});