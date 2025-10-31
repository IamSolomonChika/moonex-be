/**
 * Email authentication request schema
 */
export const emailAuthSchema = {
  type: 'object',
  required: ['email'],
  properties: {
    email: {
      type: 'string',
      format: 'email',
      minLength: 5,
      maxLength: 255
    }
  }
};

/**
 * Email verification request schema
 */
export const emailVerifySchema = {
  type: 'object',
  required: ['email', 'code'],
  properties: {
    email: {
      type: 'string',
      format: 'email',
      minLength: 5,
      maxLength: 255
    },
    code: {
      type: 'string',
      minLength: 4,
      maxLength: 10
    }
  }
};

/**
 * Social authentication request schema
 */
export const socialAuthSchema = {
  type: 'object',
  required: ['provider', 'accessToken'],
  properties: {
    provider: {
      type: 'string',
      enum: ['google', 'apple', 'twitter', 'facebook', 'discord']
    },
    accessToken: {
      type: 'string',
      minLength: 10,
      maxLength: 1000
    }
  }
};

/**
 * Wallet authentication request schema
 */
export const walletAuthSchema = {
  type: 'object',
  required: ['walletAddress', 'signature', 'message'],
  properties: {
    walletAddress: {
      type: 'string',
      pattern: '^0x[a-fA-F0-9]{40}$',
      minLength: 42,
      maxLength: 42
    },
    signature: {
      type: 'string',
      minLength: 2,
      maxLength: 132
    },
    message: {
      type: 'string',
      minLength: 1,
      maxLength: 1000
    }
  }
};

/**
 * Token refresh request schema
 */
export const refreshTokenSchema = {
  type: 'object',
  required: ['refreshToken'],
  properties: {
    refreshToken: {
      type: 'string',
      minLength: 10,
      maxLength: 1000
    }
  }
};

/**
 * Response schemas
 */
export const authResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    token: { type: 'string' },
    user: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        walletAddress: { type: 'string' },
        linkedAccounts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              address: { type: 'string' },
              email: { type: 'string' }
            }
          }
        }
      }
    },
    error: { type: 'string' }
  }
};

export const errorResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'string' }
  }
};