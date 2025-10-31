import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Configuration interface for the application
 */
export interface Config {
  port: number;
  nodeEnv: string;
  privy: {
    appId: string;
    appSecret: string;
    walletApiUrl: string;
    authApiUrl: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
}

/**
 * Validate environment variable
 */
const validateEnvVar = (name: string, required: boolean = true): string => {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`${name} environment variable is required`);
  }
  if (!value) {
    return '';
  }
  return value;
};

/**
 * Validate JWT secret strength
 */
const validateJwtSecret = (secret: string): void => {
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security');
  }
  if (secret === 'default-secret-change-in-production') {
    throw new Error('JWT_SECRET must be changed from the default value for security');
  }
};

/**
 * Get configuration from environment variables
 */
export const getConfig = (): Config => {
  const port = parseInt(validateEnvVar('PORT', false) || '3000', 10);
  const nodeEnv = validateEnvVar('NODE_ENV', false) || 'development';

  // Validate required Privy environment variables
  const privyAppId = validateEnvVar('PRIVY_APP_ID');
  const privyAppSecret = validateEnvVar('PRIVY_APP_SECRET');

  // Validate JWT secret
  const jwtSecret = validateEnvVar('JWT_SECRET');
  validateJwtSecret(jwtSecret);

  // Optional environment variables with defaults
  const privyWalletApiUrl = validateEnvVar('PRIVY_WALLET_API_URL', false) || 'https://api.privy.io';
  const privyAuthApiUrl = validateEnvVar('PRIVY_AUTH_API_URL', false) || 'https://auth.privy.io';
  const jwtExpiresIn = validateEnvVar('JWT_EXPIRES_IN', false) || '7d';

  // Log configuration (without secrets)
  console.log('🔧 Configuration loaded:', {
    port,
    nodeEnv,
    privyAppId: privyAppId.substring(0, 8) + '...',
    jwtSecretConfigured: jwtSecret.length >= 32,
    jwtExpiresIn
  });

  return {
    port,
    nodeEnv,
    privy: {
      appId: privyAppId,
      appSecret: privyAppSecret,
      walletApiUrl: privyWalletApiUrl,
      authApiUrl: privyAuthApiUrl,
    },
    jwt: {
      secret: jwtSecret,
      expiresIn: jwtExpiresIn,
    },
  };
};

// Export singleton configuration instance
export const config = getConfig();