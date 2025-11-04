/**
 * Advanced Cache Manager for BSC Services
 * Multi-layer caching with intelligent invalidation and performance optimization
 */

import { EventEmitter } from 'events';
import logger from '../../../utils/logger.js';

/**
 * Cache configuration
 */
export interface CacheConfig {
  // Default TTL settings (in milliseconds)
  defaultTTL: number;
  shortTTL: number;
  mediumTTL: number;
  longTTL: number;

  // Cache size limits
  maxMemoryUsage: number; // bytes
  maxEntries: number;
  maxEntrySize: number; // bytes

  // Performance settings
  cleanupInterval: number;
  compressionThreshold: number; // bytes
  enableCompression: boolean;
  enableMetrics: boolean;

  // Layer settings
  enableMemoryCache: boolean;
  enableRedisCache: boolean;
  enableFileCache: boolean;

  // Cache invalidation
  enableAutoInvalidation: boolean;
  invalidationStrategy: 'time-based' | 'event-based' | 'hybrid';
  maxInvalidationQueue: number;
}

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl: number;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  size: number;
  compressed?: boolean;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  memoryUsage: number;
  entryCount: number;
  averageAccessTime: number;
  hitRate: number;
  missRate: number;
  compressionRatio: number;
}

/**
 * Cache invalidation event
 */
export interface CacheInvalidationEvent {
  key: string;
  reason: 'ttl-expired' | 'manual' | 'size-limit' | 'tag-based' | 'event-based';
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Multi-layer Cache Manager
 */
export class AdvancedCacheManager extends EventEmitter {
  private config: CacheConfig;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private invalidationQueue: CacheInvalidationEvent[] = [];

  // Statistics
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    memoryUsage: 0,
    entryCount: 0,
    averageAccessTime: 0,
    hitRate: 0,
    missRate: 0,
    compressionRatio: 0
  };

  // Timers
  private cleanupTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;

  // Performance tracking
  private accessTimes: number[] = [];
  private totalAccessTime: number = 0;
  private compressionStats: {
    compressedEntries: number;
    totalOriginalSize: number;
    totalCompressedSize: number;
  } = {
    compressedEntries: 0,
    totalOriginalSize: 0,
    totalCompressedSize: 0
  };

  constructor(config: Partial<CacheConfig> = {}) {
    super();
    this.config = {
      defaultTTL: 300000, // 5 minutes
      shortTTL: 60000, // 1 minute
      mediumTTL: 300000, // 5 minutes
      longTTL: 3600000, // 1 hour
      maxMemoryUsage: 256 * 1024 * 1024, // 256MB
      maxEntries: 10000,
      maxEntrySize: 1024 * 1024, // 1MB
      cleanupInterval: 60000, // 1 minute
      compressionThreshold: 10240, // 10KB
      enableCompression: true,
      enableMetrics: true,
      enableMemoryCache: true,
      enableRedisCache: false,
      enableFileCache: false,
      enableAutoInvalidation: true,
      invalidationStrategy: 'hybrid',
      maxInvalidationQueue: 1000,
      ...config
    };

    this.initializeCache();
  }

  /**
   * Initialize cache systems
   */
  private initializeCache(): void {
    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);

    // Start metrics collection
    if (this.config.enableMetrics) {
      this.metricsTimer = setInterval(() => {
        this.updateMetrics();
      }, 30000); // Every 30 seconds
    }

    logger.info('Advanced Cache Manager initialized', {
      maxMemory: this.config.maxMemoryUsage,
      maxEntries: this.config.maxEntries,
      compression: this.config.enableCompression
    });
  }

  /**
   * Set cache entry
   */
  async set<T>(
    key: string,
    value: T,
    options: {
      ttl?: number;
      tags?: string[];
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Check entry size
      const serializedValue = JSON.stringify(value);
      const entrySize = this.calculateSize(serializedValue);

      if (entrySize > this.config.maxEntrySize) {
        throw new Error(`Entry size (${entrySize} bytes) exceeds maximum (${this.config.maxEntrySize} bytes)`);
      }

      // Compress if enabled and threshold met
      let processedValue = value;
      let compressed = false;
      if (this.config.enableCompression && entrySize > this.config.compressionThreshold) {
        processedValue = await this.compressValue(value);
        compressed = true;
        this.updateCompressionStats(entrySize, this.calculateSize(JSON.stringify(processedValue)));
      }

      const now = Date.now();
      const ttl = options.ttl || this.config.defaultTTL;

      const entry: CacheEntry<T> = {
        key,
        value: processedValue,
        ttl,
        createdAt: now,
        lastAccessed: now,
        accessCount: 0,
        size: this.calculateSize(JSON.stringify(processedValue)),
        compressed,
        tags: options.tags,
        metadata: options.metadata
      };

      // Check memory limits
      if (this.shouldEvictForSize(entry.size)) {
        await this.performEviction(entry.size);
      }

      // Store in memory cache
      if (this.config.enableMemoryCache) {
        this.memoryCache.set(key, entry);

        // Update tag index
        if (entry.tags) {
          entry.tags.forEach(tag => {
            if (!this.tagIndex.has(tag)) {
              this.tagIndex.set(tag, new Set());
            }
            this.tagIndex.get(tag)!.add(key);
          });
        }
      }

      // Update statistics
      this.stats.sets++;
      this.stats.entryCount = this.memoryCache.size;
      this.stats.memoryUsage = this.calculateMemoryUsage();

      logger.debug('Cache entry set', {
        key,
        ttl,
        size: entry.size,
        compressed,
        memoryUsage: this.stats.memoryUsage
      });

    } catch (error) {
      logger.error({
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to set cache entry');
      throw error;
    } finally {
      this.recordAccessTime(Date.now() - startTime);
    }
  }

  /**
   * Get cache entry
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();

    try {
      // Check memory cache
      if (this.config.enableMemoryCache) {
        const entry = this.memoryCache.get(key) as CacheEntry<T> | undefined;

        if (entry) {
          // Check TTL
          if (this.isExpired(entry)) {
            await this.invalidate(key, 'ttl-expired');
            this.stats.misses++;
            return null;
          }

          // Update access statistics
          entry.lastAccessed = Date.now();
          entry.accessCount++;

          // Decompress if needed
          let value = entry.value;
          if (entry.compressed) {
            value = await this.decompressValue(entry.value);
          }

          this.stats.hits++;
          this.recordAccessTime(Date.now() - startTime);

          logger.debug('Cache hit', { key, compressed: entry.compressed });

          return value as T;
        }
      }

      // Cache miss
      this.stats.misses++;
      this.recordAccessTime(Date.now() - startTime);

      logger.debug('Cache miss', { key });
      return null;

    } catch (error) {
      logger.error({
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get cache entry');
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    try {
      if (this.config.enableMemoryCache) {
        const entry = this.memoryCache.get(key);
        if (entry && !this.isExpired(entry)) {
          return true;
        }
      }
      return false;
    } catch (error) {
      logger.error({
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to check cache existence');
      return false;
    }
  }

  /**
   * Delete cache entry
   */
  async delete(key: string): Promise<boolean> {
    try {
      const existed = this.memoryCache.has(key);

      if (this.config.enableMemoryCache) {
        const entry = this.memoryCache.get(key);
        if (entry) {
          // Remove from tag index
          if (entry.tags) {
            entry.tags.forEach(tag => {
              const tagKeys = this.tagIndex.get(tag);
              if (tagKeys) {
                tagKeys.delete(key);
                if (tagKeys.size === 0) {
                  this.tagIndex.delete(tag);
                }
              }
            });
          }

          this.memoryCache.delete(key);
        }
      }

      if (existed) {
        this.stats.deletes++;
        this.stats.entryCount = this.memoryCache.size;
        this.stats.memoryUsage = this.calculateMemoryUsage();

        logger.debug('Cache entry deleted', { key });
      }

      return existed;

    } catch (error) {
      logger.error({
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to delete cache entry');
      return false;
    }
  }

  /**
   * Invalidate entries by tags
   */
  async invalidateByTag(tag: string): Promise<number> {
    try {
      const keys = this.tagIndex.get(tag);
      if (!keys || keys.size === 0) {
        return 0;
      }

      let invalidatedCount = 0;
      for (const key of keys) {
        if (await this.delete(key)) {
          invalidatedCount++;
        }
      }

      logger.info('Cache entries invalidated by tag', {
        tag,
        count: invalidatedCount
      });

      return invalidatedCount;

    } catch (error) {
      logger.error({
        tag,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to invalidate by tag');
      return 0;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<number> {
    try {
      const count = this.memoryCache.size;

      this.memoryCache.clear();
      this.tagIndex.clear();
      this.invalidationQueue = [];

      // Reset statistics
      this.stats.entryCount = 0;
      this.stats.memoryUsage = 0;

      logger.info('Cache cleared', { count });

      return count;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to clear cache');
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;

    return {
      ...this.stats,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.stats.misses / totalRequests : 0,
      compressionRatio: this.compressionStats.compressedEntries > 0
        ? this.compressionStats.totalCompressedSize / this.compressionStats.totalOriginalSize
        : 1
    };
  }

  /**
   * Get cache entries by pattern
   */
  async getByPattern(pattern: RegExp): Promise<Array<{ key: string; value: any; metadata?: any }>> {
    try {
      const results: Array<{ key: string; value: any; metadata?: any }> = [];

      for (const [key, entry] of this.memoryCache.entries()) {
        if (pattern.test(key) && !this.isExpired(entry)) {
          let value = entry.value;
          if (entry.compressed) {
            value = await this.decompressValue(value);
          }

          results.push({
            key,
            value,
            metadata: entry.metadata
          });

          // Update access statistics
          entry.lastAccessed = Date.now();
          entry.accessCount++;
        }
      }

      return results;

    } catch (error) {
      logger.error({
        pattern,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get entries by pattern');
      return [];
    }
  }

  /**
   * Perform cache cleanup
   */
  private async performCleanup(): Promise<void> {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      // Remove expired entries
      for (const [key, entry] of this.memoryCache.entries()) {
        if (this.isExpired(entry)) {
          await this.invalidate(key, 'ttl-expired');
          cleanedCount++;
        }
      }

      // Process invalidation queue
      if (this.invalidationQueue.length > 0) {
        const processedCount = this.invalidationQueue.length;
        this.invalidationQueue = [];
        cleanedCount += processedCount;
      }

      // Update statistics
      this.stats.entryCount = this.memoryCache.size;
      this.stats.memoryUsage = this.calculateMemoryUsage();

      if (cleanedCount > 0) {
        logger.debug('Cache cleanup completed', {
          expiredEntries: cleanedCount,
          totalEntries: this.stats.entryCount,
          memoryUsage: this.stats.memoryUsage
        });
      }

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Cache cleanup failed');
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > (entry.createdAt + entry.ttl);
  }

  /**
   * Check if eviction is needed for size
   */
  private shouldEvictForSize(newEntrySize: number): boolean {
    const projectedMemory = this.stats.memoryUsage + newEntrySize;
    const projectedEntries = this.stats.entryCount + 1;

    return projectedMemory > this.config.maxMemoryUsage ||
           projectedEntries > this.config.maxEntries;
  }

  /**
   * Perform eviction to make space
   */
  private async performEviction(requiredSize: number): Promise<void> {
    let freedSize = 0;
    let freedEntries = 0;
    const targetSize = this.config.maxMemoryUsage * 0.8; // Free up to 80% of max

    // Sort entries by access frequency and time
    const entries = Array.from(this.memoryCache.entries())
      .map(([key, entry]) => ({ key, entry }))
      .sort((a, b) => {
        // LRU with access frequency weighting
        const scoreA = a.entry.accessCount / (Date.now() - a.entry.lastAccessed);
        const scoreB = b.entry.accessCount / (Date.now() - b.entry.lastAccessed);
        return scoreA - scoreB;
      });

    for (const { key, entry } of entries) {
      if (freedSize >= requiredSize || this.stats.memoryUsage <= targetSize) {
        break;
      }

      await this.delete(key);
      freedSize += entry.size;
      freedEntries++;
    }

    this.stats.evictions += freedEntries;

    logger.debug('Cache eviction completed', {
      freedEntries,
      freedSize,
      requiredSize,
      currentUsage: this.stats.memoryUsage
    });
  }

  /**
   * Invalidate cache entry
   */
  private async invalidate(key: string, reason: CacheInvalidationEvent['reason']): Promise<void> {
    await this.delete(key);

    const event: CacheInvalidationEvent = {
      key,
      reason,
      timestamp: Date.now()
    };

    this.invalidationQueue.push(event);
    this.emit('invalidated', event);

    // Limit queue size
    if (this.invalidationQueue.length > this.config.maxInvalidationQueue) {
      this.invalidationQueue = this.invalidationQueue.slice(-this.config.maxInvalidationQueue);
    }
  }

  /**
   * Calculate memory usage
   */
  private calculateMemoryUsage(): number {
    let totalSize = 0;

    for (const entry of this.memoryCache.values()) {
      totalSize += entry.size;
    }

    // Add overhead for Map structures
    totalSize += this.memoryCache.size * 64; // Approximate overhead per entry
    totalSize += this.tagIndex.size * 128; // Approximate overhead per tag

    return totalSize;
  }

  /**
   * Calculate size of data
   */
  private calculateSize(data: string): number {
    return Buffer.byteLength(data, 'utf8');
  }

  /**
   * Compress value if beneficial
   */
  private async compressValue<T>(value: T): Promise<T> {
    // Simple compression simulation
    // In a real implementation, you would use a compression library like zlib
    const serialized = JSON.stringify(value);

    // For demonstration, we'll just mark it as compressed
    // In production, implement actual compression
    return {
      _compressed: true,
      _originalSize: this.calculateSize(serialized),
      data: value
    } as any;
  }

  /**
   * Decompress value
   */
  private async decompressValue<T>(compressedValue: any): Promise<T> {
    // Check if it's our mock compressed format
    if (compressedValue && compressedValue._compressed) {
      return compressedValue.data;
    }

    return compressedValue;
  }

  /**
   * Update compression statistics
   */
  private updateCompressionStats(originalSize: number, compressedSize: number): void {
    this.compressionStats.compressedEntries++;
    this.compressionStats.totalOriginalSize += originalSize;
    this.compressionStats.totalCompressedSize += compressedSize;
  }

  /**
   * Record access time for performance metrics
   */
  private recordAccessTime(accessTime: number): void {
    this.accessTimes.push(accessTime);
    this.totalAccessTime += accessTime;

    // Keep only recent access times
    if (this.accessTimes.length > 1000) {
      const excess = this.accessTimes.length - 1000;
      this.accessTimes.splice(0, excess);
    }

    // Update average access time
    this.stats.averageAccessTime = this.totalAccessTime / this.accessTimes.length;
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    const stats = this.getStats();

    logger.debug('Cache Manager Metrics', {
      hits: stats.hits,
      misses: stats.misses,
      hitRate: (stats.hitRate * 100).toFixed(2) + '%',
      missRate: (stats.missRate * 100).toFixed(2) + '%',
      entries: stats.entryCount,
      memoryUsage: `${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB`,
      averageAccessTime: `${stats.averageAccessTime.toFixed(2)} ms`,
      compressionRatio: (stats.compressionRatio * 100).toFixed(2) + '%',
      evictions: stats.evictions
    });

    // Emit metrics event
    this.emit('metrics', stats);
  }

  /**
   * Get cache health status
   */
  getHealthStatus(): {
    healthy: boolean;
    memoryUsage: number;
    memoryUtilization: number;
    entryUtilization: number;
    hitRate: number;
    issues: string[];
  } {
    const stats = this.getStats();
    const memoryUtilization = stats.memoryUsage / this.config.maxMemoryUsage;
    const entryUtilization = stats.entryCount / this.config.maxEntries;

    const issues: string[] = [];

    // Check for issues
    if (memoryUtilization > 0.9) {
      issues.push('High memory usage (>90%)');
    }

    if (entryUtilization > 0.9) {
      issues.push('High entry count (>90%)');
    }

    if (stats.hitRate < 0.5) {
      issues.push('Low hit rate (<50%)');
    }

    if (stats.averageAccessTime > 100) {
      issues.push('Slow access times (>100ms)');
    }

    return {
      healthy: issues.length === 0,
      memoryUsage: stats.memoryUsage,
      memoryUtilization,
      entryUtilization,
      hitRate: stats.hitRate,
      issues
    };
  }

  /**
   * Warm up cache with common data
   */
  async warmup<T>(
    entries: Array<{
      key: string;
      value: T;
      ttl?: number;
      tags?: string[];
    }>
  ): Promise<void> {
    logger.info('Warming up cache', { entryCount: entries.length });

    const promises = entries.map(entry =>
      this.set(entry.key, entry.value, {
        ttl: entry.ttl || this.config.longTTL,
        tags: entry.tags
      }).catch(error => {
        logger.error({
          key: entry.key,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'Failed to warm up cache entry');
      })
    );

    await Promise.all(promises);

    logger.info('Cache warmup completed', {
      successful: promises.length,
      total: entries.length
    });
  }

  /**
   * Export cache data
   */
  async export(): Promise<Array<{ key: string; value: any; ttl: number; tags?: string[] }>> {
    try {
      const exportData: Array<{ key: string; value: any; ttl: number; tags?: string[] }> = [];

      for (const [key, entry] of this.memoryCache.entries()) {
        if (!this.isExpired(entry)) {
          let value = entry.value;
          if (entry.compressed) {
            value = await this.decompressValue(value);
          }

          exportData.push({
            key,
            value,
            ttl: entry.ttl,
            tags: entry.tags
          });
        }
      }

      logger.info('Cache exported', { entryCount: exportData.length });
      return exportData;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to export cache');
      return [];
    }
  }

  /**
   * Import cache data
   */
  async import(
    data: Array<{ key: string; value: any; ttl?: number; tags?: string[] }>
  ): Promise<number> {
    try {
      logger.info('Importing cache data', { entryCount: data.length });

      let importedCount = 0;

      for (const entry of data) {
        try {
          await this.set(entry.key, entry.value, {
            ttl: entry.ttl,
            tags: entry.tags
          });
          importedCount++;
        } catch (error) {
          logger.error({
            key: entry.key,
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Failed to import cache entry');
        }
      }

      logger.info('Cache import completed', {
        successful: importedCount,
        total: data.length
      });

      return importedCount;

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to import cache');
      return 0;
    }
  }

  /**
   * Shutdown cache manager
   */
  shutdown(): void {
    // Clear timers
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }

    // Clear cache
    this.clear();

    logger.info('Advanced Cache Manager shutdown completed');
  }
}

// Export singleton instance factory
export function createAdvancedCacheManager(config?: Partial<CacheConfig>): AdvancedCacheManager {
  return new AdvancedCacheManager(config);
}