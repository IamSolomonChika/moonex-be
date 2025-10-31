import {
  authenticateWithEmail,
  verifyEmailCode,
  authenticateWithSocialProvider,
  authenticateWithWallet,
  createSessionToken,
  validateSessionToken,
  refreshSessionToken,
  logoutUser,
  User
} from '../services/auth';

// Mock user for testing
const mockUser: User = {
  id: 'test-user-123',
  privyUserId: 'privy-test-user-123',
  email: 'test@example.com',
  walletAddress: '0x1234567890123456789012345678901234',
  linkedAccounts: [
    { type: 'email', email: 'test@example.com' },
    { type: 'wallet', address: '0x1234567890123456789012345678901234' }
  ]
};

describe('Authentication Service', () => {
  describe('authenticateWithEmail', () => {
    it('should return success result for valid email', async () => {
      const result = await authenticateWithEmail('test@example.com');
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error result for invalid email', async () => {
      const result = await authenticateWithEmail('invalid-email');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to send authentication code');
    });
  });

  describe('verifyEmailCode', () => {
    it('should return success result for valid code', async () => {
      const result = await verifyEmailCode('test@example.com', '123456');
      
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('test@example.com');
    });

    it('should return error result for invalid code', async () => {
      const result = await verifyEmailCode('test@example.com', '000000');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid authentication code');
    });
  });

  describe('authenticateWithSocialProvider', () => {
    it('should return success result for valid provider', async () => {
      const result = await authenticateWithSocialProvider('google', 'valid-access-token');
      
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.user).toBeDefined();
    });

    it('should return error result for invalid provider', async () => {
      const result = await authenticateWithSocialProvider('invalid-provider', 'invalid-token');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to authenticate with social provider');
    });
  });

  describe('authenticateWithWallet', () => {
    it('should return success result for valid wallet', async () => {
      const result = await authenticateWithWallet(
        '0x1234567890123456789012345678901234',
        'valid-signature',
        'valid-message'
      );
      
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user?.walletAddress).toBe('0x1234567890123456789012345678901234');
    });

    it('should return error result for invalid wallet', async () => {
      const result = await authenticateWithWallet('invalid-wallet', 'invalid-signature', 'invalid-message');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Wallet authentication failed');
    });
  });

  describe('createSessionToken', () => {
    it('should create valid JWT token for user', async () => {
      const token = await createSessionToken(mockUser);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });
  });

  describe('validateSessionToken', () => {
    it('should validate valid token', async () => {
      const token = await createSessionToken(mockUser);
      const result = await validateSessionToken(token);
      
      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.id).toBe(mockUser.id);
    });

    it('should reject invalid token', async () => {
      const result = await validateSessionToken('invalid-token');
      
      expect(result.valid).toBe(false);
      expect(result.user).toBeUndefined();
    });
  });

  describe('refreshSessionToken', () => {
    it('should refresh valid token', async () => {
      const token = await createSessionToken(mockUser);
      const result = await refreshSessionToken(token);
      
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.token).not.toBe(token); // Should be a new token
    });

    it('should reject invalid refresh token', async () => {
      const result = await refreshSessionToken('invalid-token');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid refresh token');
    });
  });

  describe('logoutUser', () => {
    it('should logout valid token', async () => {
      const token = await createSessionToken(mockUser);
      const result = await logoutUser(token);
      
      expect(result.success).toBe(true);
    });

    it('should handle invalid token gracefully', async () => {
      const result = await logoutUser('invalid-token');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to logout');
    });
  });
});