import { FastifyRequest, FastifyReply } from 'fastify';
import logger from '../utils/logger';

/**
 * Configuration for request logging
 */
interface LoggingConfig {
  logRequestBody?: boolean;
  logResponseBody?: boolean;
  logHeaders?: boolean;
  excludePaths?: string[];
  maxBodySize?: number;
}

/**
 * Default logging configuration
 */
const DEFAULT_CONFIG: LoggingConfig = {
  logRequestBody: false, // Don't log bodies by default for security
  logResponseBody: false, // Don't log response bodies by default
  logHeaders: false, // Don't log headers by default (may contain sensitive data)
  excludePaths: ['/health', '/metrics'], // Exclude health checks and metrics
  maxBodySize: 1024 // Max body size to log (in bytes)
};

/**
 * Mask sensitive data in logs
 */
const maskSensitiveData = (data: any): any => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveKeys = [
    'password', 'token', 'secret', 'key', 'auth', 'authorization',
    'jwt', 'bearer', 'apikey', 'api_key', 'private', 'confidential'
  ];

  const masked = { ...data };

  const maskValue = (obj: any, path: string = ''): void => {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      const keyLower = key.toLowerCase();

      // Check if this key or path contains sensitive information
      const isSensitive = sensitiveKeys.some(sensitive =>
        keyLower.includes(sensitive) || currentPath.toLowerCase().includes(sensitive)
      );

      if (isSensitive && typeof value === 'string') {
        obj[key] = value.length > 0 ? `${value.substring(0, 4)}****` : '****';
      } else if (typeof value === 'object' && value !== null) {
        maskValue(value, currentPath);
      }
    }
  };

  maskValue(masked);
  return masked;
};

/**
 * Truncate large bodies for logging
 */
const truncateBody = (body: any, maxSize: number): any => {
  if (!body) {
    return body;
  }

  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

  if (bodyStr.length > maxSize) {
    return {
      truncated: true,
      size: bodyStr.length,
      preview: bodyStr.substring(0, maxSize) + '...[TRUNCATED]'
    };
  }

  return body;
};

/**
 * Create request/response logging middleware
 */
export const createLoggingMiddleware = (config: Partial<LoggingConfig> = {}) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Skip logging for excluded paths
    const routePath = (request as any).routePath || request.url;
    if (finalConfig.excludePaths?.includes(routePath)) {
      return;
    }

    // Add request ID to request for tracking
    (request as any).requestId = requestId;

    // Log request
    const requestData: any = {
      requestId,
      method: request.method,
      path: routePath,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString()
    };

    // Add headers if configured
    if (finalConfig.logHeaders) {
      requestData.headers = maskSensitiveData({ ...request.headers });
    }

    // Add body if configured
    if (finalConfig.logRequestBody && request.body) {
      try {
        requestData.body = maskSensitiveData(truncateBody(request.body, finalConfig.maxBodySize!));
      } catch (error) {
        requestData.body = '[UNABLE TO LOG BODY]';
      }
    }

    // Add user info if authenticated
    if ((request as any).user) {
      requestData.userId = (request as any).user.id;
    }

    logger.info(requestData, 'Request received');

    // Capture response
    const originalSend = reply.send.bind(reply);

    reply.send = function(payload: any) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Log response
      const responseData: any = {
        requestId,
        statusCode: reply.statusCode,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      };

      // Add response body if configured
      if (finalConfig.logResponseBody && payload) {
        try {
          responseData.body = maskSensitiveData(truncateBody(payload, finalConfig.maxBodySize!));
        } catch (error) {
          responseData.body = '[UNABLE TO LOG RESPONSE BODY]';
        }
      }

      // Add response size
      if (payload) {
        try {
          const responseStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
          responseData.responseSize = responseStr.length;
        } catch (error) {
          responseData.responseSize = -1;
        }
      }

      const logLevel = reply.statusCode >= 400 ? 'warn' : 'info';
      logger[logLevel](responseData, 'Response sent');

      // Call original send
      return originalSend(payload);
    };

    // Note: Error handling is done by the global error handler
    // We don't add hooks to reply here as it's not the correct Fastify pattern
  };
};

/**
 * Pre-configured logging middleware
 */
export const logRequests = createLoggingMiddleware({
  logRequestBody: false,
  logResponseBody: false,
  logHeaders: false,
  excludePaths: ['/health', '/', '/metrics'],
  maxBodySize: 512
});

export const logWithBodies = createLoggingMiddleware({
  logRequestBody: true,
  logResponseBody: true,
  logHeaders: false,
  excludePaths: ['/health', '/'],
  maxBodySize: 1024
});

export const logWithHeaders = createLoggingMiddleware({
  logRequestBody: false,
  logResponseBody: false,
  logHeaders: true,
  excludePaths: ['/health', '/'],
  maxBodySize: 256
});

/**
 * Performance logging middleware
 */
export const logPerformance = createLoggingMiddleware({
  logRequestBody: false,
  logResponseBody: false,
  logHeaders: false,
  excludePaths: ['/health', '/metrics'],
  maxBodySize: 0
});