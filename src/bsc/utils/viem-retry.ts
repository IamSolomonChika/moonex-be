import { ViemError } from '../../types/viem';
import { handleViemError, getRecoveryStrategy } from './viem-errors';
import logger from '../../utils/logger';

/**
 * Retry Configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryCondition?: (error: ViemError) => boolean;
}

/**
 * Retry Result
 */
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: ViemError;
  attempts: number;
  totalTime: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Viem Retry Utilities
 * Provides retry mechanisms with exponential backoff for Viem operations
 */

export class ViemRetryUtils {
  /**
   * Execute function with retry logic
   */
  public static async withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context?: string
  ): Promise<RetryResult<T>> {
    const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    const startTime = Date.now();
    let lastError: ViemError | undefined;

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        logger.debug('Executing operation (attempt %d/%d)%s',
          attempt + 1, finalConfig.maxRetries + 1,
          context ? ` for ${context}` : '');

        const result = await fn();

        if (attempt > 0) {
          logger.info('Operation succeeded after %d attempts%s',
            attempt + 1, context ? ` for ${context}` : '');
        }

        return {
          success: true,
          result,
          attempts: attempt + 1,
          totalTime: Date.now() - startTime,
        };
      } catch (error) {
        lastError = handleViemError(error, context);

        // Check if we should retry
        const recoveryStrategy = getRecoveryStrategy(lastError);
        const shouldRetry = this.shouldRetry(lastError, finalConfig, attempt, recoveryStrategy);

        if (!shouldRetry || attempt === finalConfig.maxRetries) {
          logger.error('Operation failed after %d attempts%s: %O',
            attempt + 1, context ? ` for ${context}` : '', lastError);
          break;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, finalConfig, recoveryStrategy);

        logger.warn('Operation failed (attempt %d/%d)%s, retrying in %dms: %s',
          attempt + 1, finalConfig.maxRetries + 1,
          context ? ` for ${context}` : '',
          delay,
          lastError.message);

        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: finalConfig.maxRetries + 1,
      totalTime: Date.now() - startTime,
    };
  }

  /**
   * Retry with exponential backoff
   */
  public static async exponentialBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    context?: string
  ): Promise<RetryResult<T>> {
    return this.withRetry(fn, {
      maxRetries,
      baseDelay,
      backoffMultiplier: 2,
      jitter: true,
    }, context);
  }

  /**
   * Retry with linear backoff
   */
  public static async linearBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
    context?: string
  ): Promise<RetryResult<T>> {
    return this.withRetry(fn, {
      maxRetries,
      baseDelay: delay,
      backoffMultiplier: 1,
      jitter: false,
    }, context);
  }

  /**
   * Determine if operation should be retried
   */
  private static shouldRetry(
    error: ViemError,
    config: RetryConfig,
    attempt: number,
    recoveryStrategy: { canRetry: boolean; maxRetries: number }
  ): boolean {
    // Don't retry if we've exceeded max attempts
    if (attempt >= config.maxRetries) {
      return false;
    }

    // Don't retry if recovery strategy says no
    if (!recoveryStrategy.canRetry) {
      return false;
    }

    // Don't retry if we've exceeded recovery strategy max retries
    if (attempt >= recoveryStrategy.maxRetries) {
      return false;
    }

    // Check custom retry condition
    if (config.retryCondition && !config.retryCondition(error)) {
      return false;
    }

    return true;
  }

  /**
   * Calculate delay before next retry
   */
  private static calculateDelay(
    attempt: number,
    config: RetryConfig,
    recoveryStrategy: { retryDelay: number }
  ): number {
    // Use recovery strategy delay if available
    if (recoveryStrategy.retryDelay > 0) {
      let delay = recoveryStrategy.retryDelay;

      // Apply backoff multiplier
      if (config.backoffMultiplier > 1) {
        delay = delay * Math.pow(config.backoffMultiplier, attempt);
      }

      // Apply jitter
      if (config.jitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
      }

      // Ensure delay doesn't exceed maximum
      return Math.min(delay, config.maxDelay);
    }

    // Default exponential backoff calculation
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);

    // Apply jitter
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    // Ensure delay doesn't exceed maximum
    return Math.min(delay, config.maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Convenience exports
export const withRetry = <T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>,
  context?: string
) => ViemRetryUtils.withRetry(fn, config, context);

export const exponentialBackoff = <T>(
  fn: () => Promise<T>,
  maxRetries?: number,
  baseDelay?: number,
  context?: string
) => ViemRetryUtils.exponentialBackoff(fn, maxRetries, baseDelay, context);

export const linearBackoff = <T>(
  fn: () => Promise<T>,
  maxRetries?: number,
  delay?: number,
  context?: string
) => ViemRetryUtils.linearBackoff(fn, maxRetries, delay, context);

export default ViemRetryUtils;