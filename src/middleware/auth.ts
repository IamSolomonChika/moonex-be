import { FastifyRequest, FastifyReply } from 'fastify';
import { validateSessionToken, User } from '../services/auth';
import logger from '../utils/logger';
import { createAuthError, createAuthzError } from '../utils/errors';

/**
 * Extended request interface with user information
 */
export interface AuthenticatedRequest extends FastifyRequest {
  user?: User;
}

/**
 * Authentication middleware for protecting routes
 */
export const authenticateToken = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      logger.warn({
        ip: request.ip,
        path: (request as any).routePath || request.url,
        userAgent: request.headers['user-agent']
      }, 'Authentication failed: No token provided');

      throw createAuthError('Access token is required', 'TOKEN_MISSING');
    }

    // Extract token from Bearer format
    const token = authHeader.split(' ')[1];

    if (!token) {
      logger.warn({
        ip: request.ip,
        path: (request as any).routePath || request.url,
        authHeader: authHeader.substring(0, 20) + '...' // Log partial header for security
      }, 'Authentication failed: Invalid token format');

      throw createAuthError('Invalid token format. Expected "Bearer <token>"', 'TOKEN_INVALID_FORMAT');
    }

    // Validate the token
    const validation = await validateSessionToken(token);

    if (!validation.valid || !validation.user) {
      logger.warn({
        ip: request.ip,
        path: (request as any).routePath || request.url,
        reason: (validation as any).error || 'Token validation failed'
      }, 'Authentication failed: Invalid token');

      throw createAuthError('Invalid or expired token', 'TOKEN_INVALID');
    }

    // Attach user to request object
    request.user = validation.user;

    logger.debug({
      userId: validation.user.id,
      ip: request.ip,
      path: (request as any).routePath || request.url
    }, 'Authentication successful');

  } catch (error) {
    // If it's already an ApiError, re-throw it
    if (error instanceof Error && 'statusCode' in error) {
      throw error;
    }

    logger.error({
      error: error instanceof Error ? error.message : String(error),
      ip: request.ip,
      path: (request as any).routePath || request.url
    }, 'Authentication middleware error');

    throw createAuthError('Authentication error', 'AUTH_ERROR');
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token is provided
 */
export const optionalAuth = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      // No token provided, continue without user
      return;
    }
    
    // Extract token from Bearer format
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      // Invalid token format, continue without user
      return;
    }
    
    // Validate the token
    const validation = await validateSessionToken(token);
    
    if (validation.valid && validation.user) {
      // Attach user to request object if token is valid
      request.user = validation.user;
    }
  } catch (error) {
    console.error('Optional authentication middleware error:', error);
    // Continue without user on error
  }
};

/**
 * Role-based authorization middleware
 */
export const authorize = (roles: string[]) => {
  return async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    // First ensure user is authenticated
    await authenticateToken(request, reply);
    
    if (reply.sent) {
      return; // Authentication failed, response already sent
    }
    
    // Check if user has required role
    if (!request.user) {
      reply.code(403).send({
        error: 'User not authenticated',
        code: 'USER_NOT_AUTHENTICATED'
      });
      return;
    }
    
    // For now, we'll implement a simple role check
    // In a real implementation, you would check user.roles against required roles
    const userRoles = request.user.linkedAccounts?.map(account => account.type) || [];
    
    const hasRequiredRole = roles.some(role => userRoles.includes(role));
    
    if (!hasRequiredRole) {
      reply.code(403).send({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: userRoles
      });
      return;
    }
  };
};

/**
 * Wallet ownership middleware - ensures user owns the wallet
 */
export const requireWalletOwnership = (walletAddressParam: string = 'walletAddress') => {
  return async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    // First ensure user is authenticated
    await authenticateToken(request, reply);
    
    if (reply.sent) {
      return; // Authentication failed, response already sent
    }
    
    if (!request.user) {
      reply.code(403).send({
        error: 'User not authenticated',
        code: 'USER_NOT_AUTHENTICATED'
      });
      return;
    }
    
    // Get wallet address from request parameters
    const walletAddress = (request.params as any)[walletAddressParam];
    
    if (!walletAddress) {
      reply.code(400).send({
        error: 'Wallet address parameter is required',
        code: 'WALLET_ADDRESS_MISSING'
      });
      return;
    }
    
    // Check if user owns the wallet
    const userWalletAddresses = request.user.linkedAccounts
      ?.filter(account => account.type === 'wallet')
      .map(account => account.address?.toLowerCase()) || [];
    
    const ownsWallet = userWalletAddresses.includes(walletAddress.toLowerCase());
    
    if (!ownsWallet) {
      reply.code(403).send({
        error: 'Access denied: wallet ownership required',
        code: 'WALLET_OWNERSHIP_REQUIRED'
      });
      return;
    }
  };
};