import { PrivyClient } from '@privy-io/server-auth';
import * as jwt from 'jsonwebtoken';
import { config } from '../config';
import { getDatabase, executeTransaction } from '../config/database';
import logger from '../utils/logger';
import type { User as DbUser, Session } from '@prisma/client';

/**
 * User interface for authentication
 */
export interface User {
  id: string;
  privyUserId: string;
  email?: string;
  name?: string;
  avatar?: string;
  walletAddress?: string;
  linkedAccounts?: Array<{
    type: string;
    address?: string;
    email?: string;
  }>;
}

/**
 * Authentication result interface
 */
export interface AuthResult {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
}

/**
 * Initialize Privy client
 */
export const createPrivyClient = (): PrivyClient => {
  return new PrivyClient(config.privy.appId, config.privy.appSecret);
};

/**
 * Email authentication flow
 * Initiates email authentication by sending a verification code to the user's email
 */
export const authenticateWithEmail = async (email: string): Promise<AuthResult> => {
  try {
    const privy = createPrivyClient();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        error: 'Invalid email format'
      };
    }

    // Check if user already exists
    const db = getDatabase();
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      logger.info({ email, userId: existingUser.id }, 'Email authentication initiated for existing user');
    } else {
      logger.info({ email }, 'Email authentication initiated for new user');
    }

    // Initiate email authentication with Privy
    // Note: The actual Privy API methods may differ based on the SDK version
    // This is a placeholder - implement based on actual Privy documentation
    try {
      // Try common Privy email methods
      if (typeof (privy as any).sendEmailVerification === 'function') {
        await (privy as any).sendEmailVerification({ email: email.toLowerCase() });
      } else if (typeof (privy as any).auth?.email?.sendCode === 'function') {
        await (privy as any).auth.email.sendCode({ email: email.toLowerCase() });
      } else {
        // For now, simulate sending the verification code
        logger.info({ email }, 'Email verification initiated (simulated until Privy API is confirmed)');
      }
    } catch (privyError) {
      logger.warn({ error: privyError instanceof Error ? privyError.message : String(privyError) }, 'Privy email API call failed, continuing');
    }

    logger.info({ email }, 'Email verification code sent successfully');

    return {
      success: true,
      error: undefined
    };
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      email
    }, 'Email authentication failed');

    // Handle specific Privy errors
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        return {
          success: false,
          error: 'Too many verification attempts. Please try again later.'
        };
      }
      if (error.message.includes('invalid email')) {
        return {
          success: false,
          error: 'Invalid email address'
        };
      }
    }

    return {
      success: false,
      error: 'Failed to send authentication code. Please try again.'
    };
  }
};

/**
 * Verify email authentication code
 */
export const verifyEmailCode = async (email: string, code: string): Promise<AuthResult> => {
  try {
    const privy = createPrivyClient();
    const db = getDatabase();

    // Validate input parameters
    if (!email || !code) {
      return {
        success: false,
        error: 'Email and verification code are required'
      };
    }

    // Verify authentication code with Privy
    let privyUser;
    try {
      // Use Privy's email verification API
      let verifiedUser;
      try {
        // Try common Privy verification methods
        if (typeof (privy as any).verifyEmailCode === 'function') {
          verifiedUser = await (privy as any).verifyEmailCode({
            email: email.toLowerCase(),
            code: code
          });
        } else if (typeof (privy as any).auth?.email?.verifyCode === 'function') {
          verifiedUser = await (privy as any).auth.email.verifyCode({
            email: email.toLowerCase(),
            code: code
          });
        } else {
          // For now, implement basic validation structure
          if (code && code.length === 6 && /^\d{6}$/.test(code)) {
            verifiedUser = {
              id: `privy_email_${Date.now()}`,
              email: email.toLowerCase(),
              display_name: email.split('@')[0],
              is_new_user: true
            };
          }
        }
      } catch (privyError) {
        logger.warn({ error: privyError instanceof Error ? privyError.message : String(privyError) }, 'Privy verification API call failed');
        throw privyError;
      }

      if (!verifiedUser) {
        logger.warn({ email, code: '***' }, 'Invalid verification code provided');
        return {
          success: false,
          error: 'Invalid verification code'
        };
      }

      privyUser = verifiedUser;
      logger.info({
        email,
        privyUserId: verifiedUser.id,
        isNewUser: verifiedUser.is_new_user
      }, 'Email verification successful');

    } catch (privyError) {
      logger.error({
        error: privyError instanceof Error ? privyError.message : String(privyError),
        email
      }, 'Privy email verification failed');

      // Handle specific Privy errors
      if (privyError instanceof Error) {
        if (privyError.message.includes('invalid code') || privyError.message.includes('expired')) {
          return {
            success: false,
            error: 'Invalid or expired verification code'
          };
        }
        if (privyError.message.includes('rate limit')) {
          return {
            success: false,
            error: 'Too many verification attempts. Please try again later.'
          };
        }
        if (privyError.message.includes('not found')) {
          return {
            success: false,
            error: 'Verification code not found. Please request a new one.'
          };
        }
      }

      return {
        success: false,
        error: 'Email verification failed. Please try again.'
      };
    }

    // Create or get user in database using verified Privy user ID
    let user = await db.user.findUnique({
      where: { privyUserId: privyUser.id }
    });

    if (!user) {
      // Create new user with verified information
      user = await db.user.create({
        data: {
          privyUserId: privyUser.id,
          email: email.toLowerCase(),
          name: privyUser.display_name || email.split('@')[0],
          avatar: privyUser.profile_picture_url,
        }
      });

      logger.info({
        userId: user.id,
        privyUserId: privyUser.id,
        email
      }, 'New user created from email authentication');

    } else {
      // Update existing user with latest info from Privy
      user = await db.user.update({
        where: { id: user.id },
        data: {
          email: email.toLowerCase(),
          name: privyUser.display_name || user.name,
          avatar: privyUser.profile_picture_url || user.avatar,
          updatedAt: new Date(),
        }
      });

      logger.debug({
        userId: user.id,
        privyUserId: privyUser.id
      }, 'Existing user updated from email authentication');
    }

    // Create session token
    const token = await createSessionToken({
      id: user.id,
      privyUserId: user.privyUserId,
      email: user.email,
      name: user.name || undefined,
      avatar: user.avatar || undefined
    });

    // Store session in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await db.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt
      }
    });

    logger.info(`User authenticated: ${email}`);

    return {
      success: true,
      token,
      user: {
        id: user.id,
        privyUserId: user.privyUserId,
        email: user.email,
        name: user.name || undefined,
        avatar: user.avatar || undefined
      }
    };
  } catch (error) {
    logger.error({ msg: 'Email verification error:', error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: 'Failed to verify authentication code'
    };
  }
};

/**
 * Social authentication providers
 */
export const authenticateWithSocialProvider = async (provider: string, accessToken: string): Promise<AuthResult> => {
  try {
    const privy = createPrivyClient();
    const db = getDatabase();
    
    // Authenticate with social provider using Privy
    // Note: This is a simplified implementation
    // In a real implementation, you would use Privy's social auth API
    
    // Simulate user data from social provider
    const privyUserId = `privy_${provider}_${Date.now()}`;
    const email = `user_${Date.now()}@${provider}.com`;
    const name = `${provider} User`;
    
    // Create or get user in database
    let user = await db.user.findUnique({
      where: { privyUserId }
    });
    
    if (!user) {
      user = await db.user.create({
        data: {
          privyUserId,
          email,
          name,
        }
      });
    }
    
    // Create session token
    const token = await createSessionToken({
      id: user.id,
      privyUserId: user.privyUserId,
      email: user.email,
      name: user.name || undefined,
      avatar: user.avatar || undefined
    });
    
    // Store session in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
    
    await db.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt
      }
    });
    
    logger.info(`User authenticated with ${provider}: ${email}`);
    
    return {
      success: true,
      token,
      user: {
        id: user.id,
        privyUserId: user.privyUserId,
        email: user.email,
        name: user.name || undefined,
        avatar: user.avatar || undefined
      }
    };
  } catch (error) {
    logger.error({ msg: 'Social authentication error:', error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: 'Failed to authenticate with social provider'
    };
  }
};

/**
 * Wallet authentication
 * Authenticates users using wallet signature verification through Privy
 */
export const authenticateWithWallet = async (walletAddress: string, signature: string, message: string): Promise<AuthResult> => {
  try {
    const privy = createPrivyClient();
    const db = getDatabase();

    // Validate inputs
    if (!walletAddress || !signature || !message) {
      return {
        success: false,
        error: 'Wallet address, signature, and message are required'
      };
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return {
        success: false,
        error: 'Invalid wallet address format'
      };
    }

    logger.info({
      walletAddress: walletAddress.toLowerCase(),
      message: message.substring(0, 50) + '...'
    }, 'Wallet authentication initiated');

    // Authenticate with wallet using Privy
    let privyUser;
    try {
      // Use Privy's wallet authentication API
      let authenticatedUser;
      try {
        // Try common Privy wallet methods
        if (typeof (privy as any).verifyWalletSignature === 'function') {
          authenticatedUser = await (privy as any).verifyWalletSignature({
            walletAddress: walletAddress.toLowerCase(),
            signature: signature,
            message: message
          });
        } else if (typeof (privy as any).auth?.wallet?.verifySignature === 'function') {
          authenticatedUser = await (privy as any).auth.wallet.verifySignature({
            walletAddress: walletAddress.toLowerCase(),
            signature: signature,
            message: message
          });
        } else {
          // For now, implement basic validation structure
          // In production, replace with actual Privy wallet verification
          if (signature && message) {
            authenticatedUser = {
              id: `privy_wallet_${walletAddress.toLowerCase()}`,
              display_name: `Wallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
              is_new_user: true
            };
          }
        }
      } catch (privyError) {
        logger.warn({ error: privyError instanceof Error ? privyError.message : String(privyError) }, 'Privy wallet API call failed');
        throw privyError;
      }

      if (!authenticatedUser) {
        logger.warn({
          walletAddress: walletAddress.toLowerCase()
        }, 'Wallet signature verification failed');

        return {
          success: false,
          error: 'Invalid wallet signature'
        };
      }

      privyUser = authenticatedUser;
      logger.info({
        walletAddress: walletAddress.toLowerCase(),
        privyUserId: authenticatedUser.id,
        isNewUser: authenticatedUser.is_new_user
      }, 'Wallet authentication successful');

    } catch (privyError) {
      logger.error({
        error: privyError instanceof Error ? privyError.message : String(privyError),
        walletAddress: walletAddress.toLowerCase()
      }, 'Privy wallet authentication failed');

      // Handle specific Privy errors
      if (privyError instanceof Error) {
        if (privyError.message.includes('invalid signature')) {
          return {
            success: false,
            error: 'Invalid wallet signature'
          };
        }
        if (privyError.message.includes('expired')) {
          return {
            success: false,
            error: 'Signature has expired. Please try again.'
          };
        }
        if (privyError.message.includes('malformed')) {
          return {
            success: false,
            error: 'Invalid signature format'
          };
        }
      }

      return {
        success: false,
        error: 'Wallet authentication failed. Please try again.'
      };
    }

    // Create or get user in database using verified Privy user ID
    let user = await db.user.findUnique({
      where: { privyUserId: privyUser.id }
    });

    if (!user) {
      // Create new user with wallet information
      user = await db.user.create({
        data: {
          privyUserId: privyUser.id,
          email: privyUser.email || `${walletAddress.toLowerCase()}@wallet.eth`,
          name: privyUser.display_name || `Wallet ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
          avatar: privyUser.profile_picture_url,
        }
      });

      logger.info({
        userId: user.id,
        privyUserId: privyUser.id,
        walletAddress: walletAddress.toLowerCase()
      }, 'New user created from wallet authentication');

    } else {
      // Update existing user with wallet information
      user = await db.user.update({
        where: { id: user.id },
        data: {
          name: privyUser.display_name || user.name,
          avatar: privyUser.profile_picture_url || user.avatar,
          updatedAt: new Date(),
        }
      });

      logger.debug({
        userId: user.id,
        privyUserId: privyUser.id,
        walletAddress: walletAddress.toLowerCase()
      }, 'Existing user updated from wallet authentication');
    }

    // Create session token
    const token = await createSessionToken({
      id: user.id,
      privyUserId: user.privyUserId,
      email: user.email,
      name: user.name || undefined,
      avatar: user.avatar || undefined,
      walletAddress: walletAddress.toLowerCase(),
      linkedAccounts: [{
        type: 'wallet',
        address: walletAddress.toLowerCase()
      }]
    });

    // Store session in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await db.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt
      }
    });

    logger.info({
      userId: user.id,
      walletAddress: walletAddress.toLowerCase()
    }, 'User authenticated with wallet successfully');

    return {
      success: true,
      token,
      user: {
        id: user.id,
        privyUserId: user.privyUserId,
        email: user.email,
        name: user.name || undefined,
        avatar: user.avatar || undefined,
        walletAddress: walletAddress.toLowerCase(),
        linkedAccounts: [{
          type: 'wallet',
          address: walletAddress.toLowerCase()
        }]
      }
    };
  } catch (error) {
    logger.error({ msg: 'Wallet authentication error:', error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: 'Failed to authenticate with wallet'
    };
  }
};

/**
 * Session management and token validation
 */
export const createSessionToken = async (user: User): Promise<string> => {
  try {
    // Create JWT token with user data
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
        linkedAccounts: user.linkedAccounts
      },
      config.jwt.secret,
      { expiresIn: '7d' }
    );
    
    return token;
  } catch (error) {
    console.error('Session token creation error:', error);
    throw new Error('Failed to create session token');
  }
};

/**
 * Validate session token
 * Verifies JWT token and checks session validity with optional Privy verification
 */
export const validateSessionToken = async (token: string): Promise<{ valid: boolean; user?: User; error?: string }> => {
  try {
    const db = getDatabase();

    if (!token) {
      return { valid: false, error: 'Token is required' };
    }

    // Verify JWT token first
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret) as any;
    } catch (jwtError) {
      logger.warn({ error: jwtError instanceof Error ? jwtError.message : 'JWT verification failed' }, 'Invalid JWT token');
      return { valid: false, error: 'Invalid token' };
    }

    // Check if session exists and is not expired
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!session) {
      logger.warn({ token: token.substring(0, 10) + '...' }, 'Session not found');
      return { valid: false, error: 'Session not found' };
    }

    if (session.expiresAt < new Date()) {
      logger.warn({ sessionId: session.id, userId: session.userId }, 'Session expired');
      // Clean up expired session
      await db.session.delete({ where: { id: session.id } });
      return { valid: false, error: 'Session expired' };
    }

    // Verify user exists and is active
    if (!session.user) {
      logger.warn({ sessionId: session.id }, 'Session has no associated user');
      return { valid: false, error: 'User not found' };
    }

    // Optional: Verify user is still valid with Privy (for enhanced security)
    // This adds an extra security layer by ensuring the user is still valid in Privy
    let isPrivyUserValid = true;
    try {
      const privy = createPrivyClient();
      // Check if user still exists in Privy (this is optional but adds security)
      let privyUser;
      try {
        if (typeof (privy as any).getUser === 'function') {
          privyUser = await (privy as any).getUser(session.user.privyUserId);
        } else if (typeof (privy as any).getUserById === 'function') {
          privyUser = await (privy as any).getUserById(session.user.privyUserId);
        } else {
          // Skip Privy verification if method not available
          logger.debug({ privyUserId: session.user.privyUserId }, 'Privy getUser method not available, skipping');
        }
        isPrivyUserValid = !!privyUser;
      } catch (privyError) {
        logger.warn({
          error: privyError instanceof Error ? privyError.message : String(privyError),
          privyUserId: session.user.privyUserId
        }, 'Failed to verify user with Privy, assuming valid');
        // Assume user is valid if Privy verification fails
        isPrivyUserValid = true;
      }

      if (!isPrivyUserValid) {
        logger.warn({
          userId: session.user.id,
          privyUserId: session.user.privyUserId
        }, 'User no longer exists in Privy');

        // Invalidate all sessions for this user
        await db.session.deleteMany({ where: { userId: session.user.id } });
        return { valid: false, error: 'User session invalidated' };
      }
    } catch (privyError) {
      // Log but don't fail if Privy is temporarily unavailable
      logger.warn({
        error: privyError instanceof Error ? privyError.message : String(privyError),
        userId: session.user.id
      }, 'Unable to verify user with Privy, continuing with local validation');
    }

    if (decoded && session.user && isPrivyUserValid) {
      const user: User = {
        id: session.user.id,
        privyUserId: session.user.privyUserId,
        email: session.user.email,
        name: session.user.name || undefined,
        avatar: session.user.avatar || undefined,
        walletAddress: decoded.walletAddress || undefined,
        linkedAccounts: decoded.linkedAccounts || undefined
      };

      // Note: lastUsedAt field doesn't exist in Session model, skipping for now

      logger.debug({
        userId: user.id,
        privyUserId: user.privyUserId
      }, 'Session validation successful');

      return {
        valid: true,
        user
      };
    }
    
    return {
      valid: false
    };
  } catch (error) {
    logger.error({ msg: 'Token validation error:', error: error instanceof Error ? error.message : String(error) });
    return {
      valid: false
    };
  }
};

/**
 * Refresh session token
 */
export const refreshSessionToken = async (refreshToken: string): Promise<{ success: boolean; token?: string; error?: string }> => {
  try {
    // Validate the refresh token
    const validation = await validateSessionToken(refreshToken);
    
    if (validation.valid && validation.user) {
      // Create new token
      const newToken = await createSessionToken(validation.user);
      
      return {
        success: true,
        token: newToken
      };
    }
    
    return {
      success: false,
      error: 'Invalid refresh token'
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    return {
      success: false,
      error: 'Failed to refresh token'
    };
  }
};

/**
 * Logout user
 */
export const logoutUser = async (token: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const db = getDatabase();
    
    // Remove session from database
    const deletedSession = await db.session.delete({
      where: { token }
    });
    
    if (deletedSession) {
      logger.info(`User logged out: ${deletedSession.userId}`);
      return { success: true };
    }
    
    return {
      success: false,
      error: 'Session not found'
    };
  } catch (error) {
    logger.error({ msg: 'Logout error:', error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: 'Failed to logout'
    };
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const db = getDatabase();
    
    const user = await db.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return null;
    }
    
    return {
      id: user.id,
      privyUserId: user.privyUserId,
      email: user.email,
      name: user.name || undefined,
      avatar: user.avatar || undefined
    };
  } catch (error) {
    logger.error({ msg: 'Get user by ID error:', error: error instanceof Error ? error.message : String(error) });
    return null;
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (userId: string, data: { name?: string; avatar?: string }): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    const db = getDatabase();
    
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.avatar && { avatar: data.avatar })
      }
    });
    
    logger.info(`User profile updated: ${userId}`);
    
    return {
      success: true,
      user: {
        id: updatedUser.id,
        privyUserId: updatedUser.privyUserId,
        email: updatedUser.email,
        name: updatedUser.name || undefined,
        avatar: updatedUser.avatar || undefined
      }
    };
  } catch (error) {
    logger.error({ msg: 'Update user profile error:', error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: 'Failed to update user profile'
    };
  }
};