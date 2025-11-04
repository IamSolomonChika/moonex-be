import logger from '../../../utils/logger';

/**
 * Cache configuration
 */
export interface CacheConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

/**
 * Cache entry
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  total: number;
  hitRate: number;
}

/**
 * Simple in-memory cache (fallback when Redis is not available)
 */
class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private stats = { hits: 0, misses: 0 };

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (entry) {
      if (Date.now() - entry.timestamp < entry.ttl) {
        this.stats.hits++;
        return entry.data;
      }
      this.cache.delete(key); // Expired
    }
    this.stats.misses++;
    return null;
  }

  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() - entry.timestamp >= entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      total,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
    };
  }
}

/**
 * BSC Cache Manager
 * Handles caching for BSC data with Redis as primary store and memory as fallback
 */
export class BSCCacheManager {
  private redis: any = null;
  private memoryCache = new MemoryCache();
  private keyPrefix: string;
  private stats = { redis: { hits: 0, misses: 0 }, memory: { hits: 0, misses: 0 } };

  constructor(config: CacheConfig = {}) {
    this.keyPrefix = config.keyPrefix || 'bsc:cache:';

    // Try to initialize Redis
    this.initializeRedis(config).catch(error => {
      logger.warn({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Redis not available, using memory cache');
    });
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(config: CacheConfig): Promise<void> {
    try {
      // Dynamically import Redis to avoid build errors if not installed
      const { createClient } = await import('redis');

      this.redis = createClient({
        socket: {
          host: config.host || 'localhost',
          port: config.port || 6379,
        },
        password: config.password,
        database: config.db || 0,
      });

      await this.redis.connect();
      logger.info('Redis cache initialized successfully');

    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to initialize Redis');
      this.redis = null;
    }
  }

  /**
   * Get data from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = `${this.keyPrefix}${key}`;

    try {
      if (this.redis) {
        const serialized = await this.redis.get(fullKey);
        if (serialized) {
          const entry: CacheEntry<T> = JSON.parse(serialized);
          if (Date.now() - entry.timestamp < entry.ttl) {
            this.stats.redis.hits++;
            return entry.data;
          }
          // Expired, remove it
          await this.redis.del(fullKey);
        }
        this.stats.redis.misses++;
      }

      // Fallback to memory cache
      return await this.memoryCache.get<T>(key);

    } catch (error) {
      logger.error({ key, error: error instanceof Error ? error.message : 'Unknown error' }, `Cache get error for key ${key}`);
      this.stats.redis.misses++;
      return await this.memoryCache.get<T>(key);
    }
  }

  /**
   * Set data in cache
   */
  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    const fullKey = `${this.keyPrefix}${key}`;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    try {
      if (this.redis) {
        const serialized = JSON.stringify(entry);
        await this.redis.setEx(fullKey, Math.ceil(ttl / 1000), serialized);
      }

      // Also store in memory cache for faster access
      await this.memoryCache.set(key, data, ttl);

    } catch (error) {
      logger.error({ key, error: error instanceof Error ? error.message : 'Unknown error' }, `Cache set error for key ${key}`);
      // Fallback to memory cache
      await this.memoryCache.set(key, data, ttl);
    }
  }

  /**
   * Delete data from cache
   */
  async del(key: string): Promise<void> {
    const fullKey = `${this.keyPrefix}${key}`;

    try {
      if (this.redis) {
        await this.redis.del(fullKey);
      }
      await this.memoryCache.del(key);

    } catch (error) {
      logger.error({ key, error: error instanceof Error ? error.message : 'Unknown error' }, `Cache delete error for key ${key}`);
      await this.memoryCache.del(key);
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const fullKey = `${this.keyPrefix}${key}`;

    try {
      if (this.redis) {
        const exists = await this.redis.exists(fullKey);
        if (exists) return true;
      }
      return await this.memoryCache.exists(key);

    } catch (error) {
      logger.error({ key, error: error instanceof Error ? error.message : 'Unknown error' }, `Cache exists error for key ${key}`);
      return await this.memoryCache.exists(key);
    }
  }

  /**
   * Clear all cache data
   */
  async clear(): Promise<void> {
    try {
      if (this.redis) {
        // Delete all keys with our prefix
        const pattern = `${this.keyPrefix}*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(keys);
        }
      }
      await this.memoryCache.clear();
      this.stats = { redis: { hits: 0, misses: 0 }, memory: { hits: 0, misses: 0 } };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Cache clear error');
      await this.memoryCache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getStatistics(): {
    redis: CacheStats;
    memory: CacheStats;
    combined: CacheStats;
  } {
    const memoryStats = this.memoryCache.getStats();
    const redisTotal = this.stats.redis.hits + this.stats.redis.misses;
    const memoryTotal = memoryStats.hits + memoryStats.misses;

    return {
      redis: {
        hits: this.stats.redis.hits,
        misses: this.stats.redis.misses,
        total: redisTotal,
        hitRate: redisTotal > 0 ? (this.stats.redis.hits / redisTotal) * 100 : 0,
      },
      memory: memoryStats,
      combined: {
        hits: this.stats.redis.hits + memoryStats.hits,
        misses: this.stats.redis.misses + memoryStats.misses,
        total: redisTotal + memoryTotal,
        hitRate: (redisTotal + memoryTotal) > 0
          ? ((this.stats.redis.hits + memoryStats.hits) / (redisTotal + memoryTotal)) * 100
          : 0,
      },
    };
  }

  /**
   * Get or set with TTL (get if exists, set if not)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await factory();
    await this.set(key, data, ttl);
    return data;
  }

  /**
   * Get multiple keys
   */
  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    const results = await Promise.all(
      keys.map(key => this.get<T>(key))
    );
    return results;
  }

  /**
   * Set multiple keys
   */
  async mset<T>(entries: Array<{ key: string; data: T; ttl: number }>): Promise<void> {
    await Promise.all(
      entries.map(entry => this.set(entry.key, entry.data, entry.ttl))
    );
  }

  /**
   * Increment counter
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      if (this.redis) {
        const fullKey = `${this.keyPrefix}${key}`;
        return await this.redis.incrBy(fullKey, amount);
      }
      // Fallback for memory cache
      const current = await this.get<number>(key) || 0;
      const newValue = current + amount;
      await this.set(key, newValue, 86400000); // 24 hours
      return newValue;
    } catch (error) {
      logger.error({ key, error: error instanceof Error ? error.message : 'Unknown error' }, `Cache increment error for key ${key}`);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    redis: boolean;
    memory: boolean;
    overall: boolean;
  }> {
    try {
      const redis = this.redis ? await this.redis.ping() : false;
      const memory = await this.memoryCache.set('health-check', 'ok', 1000);
      const memOk = memory !== null;

      return {
        redis,
        memory: memOk,
        overall: redis || memOk,
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Cache health check failed');
      return {
        redis: false,
        memory: false,
        overall: false,
      };
    }
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.quit();
        this.redis = null;
      }
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error closing cache');
    }
  }
}

// Export singleton instance with default config
export const bscCacheManager = new BSCCacheManager({
  keyPrefix: 'bsc:',
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
});

// Export convenience functions
export const getCache = <T>(key: string) => bscCacheManager.get<T>(key);
export const setCache = <T>(key: string, data: T, ttl: number) => bscCacheManager.set(key, data, ttl);
export const delCache = (key: string) => bscCacheManager.del(key);
export const getOrSetCache = <T>(key: string, factory: () => Promise<T>, ttl: number) =>
  bscCacheManager.getOrSet(key, factory, ttl);