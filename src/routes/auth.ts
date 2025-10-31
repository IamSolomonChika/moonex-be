import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  authenticateWithEmail,
  verifyEmailCode,
  authenticateWithSocialProvider,
  authenticateWithWallet,
  refreshSessionToken,
  logoutUser,
  AuthResult
} from '../services/auth';
import { AuthenticatedRequest, authenticateToken, optionalAuth } from '../middleware/auth';

/**
 * Email authentication request body
 */
interface EmailAuthRequest {
  email: string;
}

/**
 * Email verification request body
 */
interface EmailVerifyRequest {
  email: string;
  code: string;
}

/**
 * Social authentication request body
 */
interface SocialAuthRequest {
  provider: string;
  accessToken: string;
}

/**
 * Wallet authentication request body
 */
interface WalletAuthRequest {
  walletAddress: string;
  signature: string;
  message: string;
}

/**
 * Token refresh request body
 */
interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Authentication routes
 */
export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * Initiate email authentication
   */
  fastify.post<{ Body: EmailAuthRequest }>('/auth/email', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: EmailAuthRequest }>, reply: FastifyReply) => {
    try {
      const { email } = request.body;
      const result = await authenticateWithEmail(email);
      
      if (result.success) {
        reply.code(200).send({
          success: true,
          message: 'Authentication code sent to email'
        });
      } else {
        reply.code(400).send({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      fastify.log.error({ error }, 'Email authentication error');
      reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Verify email authentication code
   */
  fastify.post<{ Body: EmailVerifyRequest }>('/auth/email/verify', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'code'],
        properties: {
          email: { type: 'string', format: 'email' },
          code: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: EmailVerifyRequest }>, reply: FastifyReply) => {
    try {
      const { email, code } = request.body;
      const result = await verifyEmailCode(email, code);
      
      if (result.success && result.token && result.user) {
        reply.code(200).send({
          success: true,
          token: result.token,
          user: {
            id: result.user.id,
            email: result.user.email,
            walletAddress: result.user.walletAddress,
            linkedAccounts: result.user.linkedAccounts
          }
        });
      } else {
        reply.code(400).send({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      fastify.log.error({ error }, 'Email verification error');
      reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Authenticate with social provider
   */
  fastify.post<{ Body: SocialAuthRequest }>('/auth/social', {
    schema: {
      body: {
        type: 'object',
        required: ['provider', 'accessToken'],
        properties: {
          provider: { type: 'string', enum: ['google', 'apple', 'twitter', 'facebook'] },
          accessToken: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: SocialAuthRequest }>, reply: FastifyReply) => {
    try {
      const { provider, accessToken } = request.body;
      const result = await authenticateWithSocialProvider(provider, accessToken);
      
      if (result.success && result.token && result.user) {
        reply.code(200).send({
          success: true,
          token: result.token,
          user: {
            id: result.user.id,
            email: result.user.email,
            walletAddress: result.user.walletAddress,
            linkedAccounts: result.user.linkedAccounts
          }
        });
      } else {
        reply.code(400).send({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      fastify.log.error({ error }, 'Social authentication error');
      reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Authenticate with wallet
   */
  fastify.post<{ Body: WalletAuthRequest }>('/auth/wallet', {
    schema: {
      body: {
        type: 'object',
        required: ['walletAddress', 'signature', 'message'],
        properties: {
          walletAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          signature: { type: 'string' },
          message: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: WalletAuthRequest }>, reply: FastifyReply) => {
    try {
      const { walletAddress, signature, message } = request.body;
      const result = await authenticateWithWallet(walletAddress, signature, message);
      
      if (result.success && result.token && result.user) {
        reply.code(200).send({
          success: true,
          token: result.token,
          user: {
            id: result.user.id,
            email: result.user.email,
            walletAddress: result.user.walletAddress,
            linkedAccounts: result.user.linkedAccounts
          }
        });
      } else {
        reply.code(400).send({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      fastify.log.error({ error }, 'Wallet authentication error');
      reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Refresh session token
   */
  fastify.post<{ Body: RefreshTokenRequest }>('/auth/refresh', {
    schema: {
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: RefreshTokenRequest }>, reply: FastifyReply) => {
    try {
      const { refreshToken } = request.body;
      const result = await refreshSessionToken(refreshToken);
      
      if (result.success && result.token) {
        reply.code(200).send({
          success: true,
          token: result.token
        });
      } else {
        reply.code(400).send({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      fastify.log.error({ error }, 'Token refresh error');
      reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Logout user
   */
  fastify.post('/auth/logout', {
    preHandler: [authenticateToken]
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      // Get token from Authorization header
      const authHeader = request.headers.authorization;
      const token = authHeader?.split(' ')[1];

      if (!token) {
        throw new Error('Access token is required');
      }

      const result = await logoutUser(token);
      
      if (result.success) {
        reply.code(200).send({
          success: true,
          message: 'Logged out successfully'
        });
      } else {
        reply.code(400).send({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      fastify.log.error({ error }, 'Logout error');
      reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Get current user profile
   */
  fastify.get('/auth/me', {
    preHandler: [authenticateToken]
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      // User is attached to request by the authentication middleware
      if (request.user) {
        reply.code(200).send({
          success: true,
          user: {
            id: request.user.id,
            privyUserId: request.user.privyUserId,
            email: request.user.email,
            name: request.user.name,
            avatar: request.user.avatar,
            walletAddress: request.user.walletAddress,
            linkedAccounts: request.user.linkedAccounts
          }
        });
      } else {
        reply.code(401).send({
          success: false,
          error: 'User not authenticated'
        });
      }
    } catch (error) {
      fastify.log.error({ error }, 'Get user profile error');
      reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });
}