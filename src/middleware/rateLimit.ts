import { FastifyRequest, FastifyReply } from 'fastify';
import logger from '../utils/logger';

/**
 * Rate limiting configuration
 */
interface RateLimitConfig {
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;    // Custom message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean;     // Don't count failed requests
}

/**
 * Default rate limit configurations
 */
const RATE_LIMITS = {
  // Auth endpoints - stricter limits
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,           // 5 attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later',
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },

  // API endpoints - moderate limits
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,         // 100 requests per 15 minutes
    message: 'Rate limit exceeded, please try again later',
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  },

  // Trading endpoints - higher limits for legitimate use
  trading: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 30,          // 30 requests per minute
    message: 'Trading rate limit exceeded',
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  }
} as const;

/**
 * In-memory store for rate limiting
 * In production, consider using Redis for distributed rate limiting
 */
class RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number; lastRequest: number }>();

  get(key: string): { count: number; resetTime: number; lastRequest: number } | undefined {
    return this.store.get(key);
  }

  set(key: string, value: { count: number; resetTime: number; lastRequest: number }): void {
    this.store.set(key, value);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (now > value.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

const rateLimitStore = new RateLimitStore();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  rateLimitStore.cleanup();
}, 5 * 60 * 1000);

/**
 * Create rate limiting middleware
 */
export const createRateLimit = (config: RateLimitConfig) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Get client identifier (IP address)
    const clientId = request.ip || request.headers['x-forwarded-for'] as string || 'unknown';

    // Create unique key for this client and endpoint
    const routePath = (request as any).routePath || request.url;
    const key = `${clientId}:${routePath}`;

    const now = Date.now();
    const record = rateLimitStore.get(key);

    // If no record exists, create one
    if (!record || now > record.resetTime) {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
        lastRequest: now
      });
      return; // Allow request
    }

    // Check if rate limit is exceeded
    if (record.count >= config.maxRequests) {
      logger.warn({
        clientId,
        path: routePath,
        count: record.count,
        maxRequests: config.maxRequests,
        resetTime: record.resetTime
      }, 'Rate limit exceeded');

      reply.code(429).send({
        success: false,
        error: config.message || 'Rate limit exceeded',
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });

      throw new Error('Rate limit exceeded'); // This will prevent further processing
    }

    // Increment counter
    record.count++;
    record.lastRequest = now;
    rateLimitStore.set(key, record);

    logger.debug({
      clientId,
      path: routePath,
      count: record.count,
      maxRequests: config.maxRequests
    }, 'Rate limit check passed');
  };
};

/**
 * Pre-configured rate limiters
 */
export const rateLimitAuth = createRateLimit(RATE_LIMITS.auth);
export const rateLimitApi = createRateLimit(RATE_LIMITS.api);
export const rateLimitTrading = createRateLimit(RATE_LIMITS.trading);

/**
 * Rate limiting middleware factory
 */
export const rateLimit = (type: keyof typeof RATE_LIMITS) => {
  return createRateLimit(RATE_LIMITS[type]);
};