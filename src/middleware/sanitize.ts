import { FastifyRequest, FastifyReply } from 'fastify';
import logger from '../utils/logger';

/**
 * XSS Protection: Sanitize string inputs
 */
export const sanitizeString = (input: string): string => {
  if (typeof input !== 'string') {
    return input;
  }

  return input
    // Remove potentially dangerous characters
    .replace(/[<>]/g, '')
    // Normalize whitespace
    .trim()
    // Limit length to prevent DoS
    .substring(0, 10000);
};

/**
 * Email sanitization
 */
export const sanitizeEmail = (email: string): string => {
  if (typeof email !== 'string') {
    return email;
  }

  return email
    .toLowerCase()
    .trim()
    .substring(0, 254); // RFC 5321 limit
};

/**
 * Wallet address sanitization
 */
export const sanitizeWalletAddress = (address: string): string => {
  if (typeof address !== 'string') {
    return address;
  }

  // Remove spaces and convert to lowercase
  const sanitized = address.replace(/\s+/g, '').toLowerCase();

  // Validate basic Ethereum address format
  if (!/^0x[a-f0-9]{40}$/.test(sanitized)) {
    throw new Error('Invalid wallet address format');
  }

  return sanitized;
};

/**
 * Numeric input sanitization
 */
export const sanitizeNumber = (input: any): number => {
  const num = Number(input);

  if (isNaN(num) || !isFinite(num)) {
    throw new Error('Invalid number format');
  }

  // Prevent extremely large numbers that could cause issues
  if (Math.abs(num) > Number.MAX_SAFE_INTEGER) {
    throw new Error('Number too large');
  }

  return num;
};

/**
 * Sanitize object properties recursively
 */
export const sanitizeObject = (obj: any, maxDepth: number = 10): any => {
  if (maxDepth <= 0) {
    return null; // Prevent infinite recursion
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, maxDepth - 1));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip potentially dangerous keys
      if (key.includes('__proto__') || key.includes('constructor') || key.includes('prototype')) {
        continue;
      }
      sanitized[key] = sanitizeObject(value, maxDepth - 1);
    }
    return sanitized;
  }

  return obj;
};

/**
 * Input sanitization middleware
 */
export const sanitizeInput = (options: {
  sanitizeStrings?: boolean;
  sanitizeEmails?: boolean;
  sanitizeWallets?: boolean;
  sanitizeNumbers?: boolean;
  maxDepth?: number;
} = {}) => {
  const {
    sanitizeStrings = true,
    sanitizeEmails = false,
    sanitizeWallets = false,
    sanitizeNumbers = false,
    maxDepth = 10
  } = options;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      // Sanitize query parameters
      if (request.query) {
        request.query = sanitizeObject(request.query, maxDepth);
      }

      // Sanitize path parameters
      if (request.params) {
        request.params = sanitizeObject(request.params, maxDepth);
      }

      // Sanitize request body
      if (request.body) {
        request.body = sanitizeObject(request.body, maxDepth);
      }

      // Specific sanitizations based on context
      if (sanitizeEmails && request.body && typeof request.body === 'object') {
        const bodyObj = request.body as any;
        if (bodyObj.email) {
          bodyObj.email = sanitizeEmail(bodyObj.email);
        }
      }

      if (sanitizeWallets && request.body && typeof request.body === 'object') {
        const bodyObj = request.body as any;
        if (bodyObj.walletAddress) {
          bodyObj.walletAddress = sanitizeWalletAddress(bodyObj.walletAddress);
        }
      }

      if (sanitizeNumbers && request.body && typeof request.body === 'object') {
        const bodyObj = request.body as any;
        Object.keys(bodyObj).forEach(key => {
          if (key.includes('amount') || key.includes('balance') || key.includes('price')) {
            try {
              bodyObj[key] = sanitizeNumber(bodyObj[key]);
            } catch (error) {
              throw new Error(`Invalid ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        });
      }

      logger.debug({
        path: (request as any).routePath || request.url,
        method: request.method
      }, 'Input sanitization completed');

    } catch (error) {
      logger.warn({
        error: error instanceof Error ? error.message : String(error),
        path: (request as any).routePath || request.url,
        method: request.method
      }, 'Input sanitization failed');

      reply.code(400).send({
        success: false,
        error: 'Invalid input data',
        code: 'VALIDATION_ERROR',
        details: error instanceof Error ? error.message : 'Input validation failed'
      });

      throw new Error('Input validation failed');
    }
  };
};

/**
 * Pre-configured sanitization middleware for different contexts
 */
export const sanitizeAuthInput = sanitizeInput({
  sanitizeEmails: true,
  sanitizeStrings: true
});

export const sanitizeTradingInput = sanitizeInput({
  sanitizeWallets: true,
  sanitizeNumbers: true,
  sanitizeStrings: true
});

export const sanitizeWalletInput = sanitizeInput({
  sanitizeWallets: true,
  sanitizeStrings: true
});

export const sanitizeGeneralInput = sanitizeInput({
  sanitizeStrings: true
});