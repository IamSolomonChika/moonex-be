import { Address, Abi } from 'viem';
import { getViemProvider } from '../providers/viem-provider';
import logger from '../../utils/logger';

/**
 * Basic Contract type for Viem compatibility
 */
type Contract<TAbi extends Abi = Abi> = {
  address: Address;
  abi: TAbi;
  client: any; // Will be replaced with actual client type
};

/**
 * Contract Cache for Viem
 * Provides contract instance caching for performance optimization
 */

interface CachedContract {
  contract: Contract<any>;
  address: Address;
  abi: Abi;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
}

interface ContractCacheOptions {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
}

class ContractCache {
  private cache = new Map<string, CachedContract>();
  private maxSize: number;
  private ttl: number;

  constructor(options: ContractCacheOptions = {}) {
    this.maxSize = options.maxSize || 100;
    this.ttl = options.ttl || 300000; // 5 minutes default
  }

  /**
   * Get cached contract instance
   */
  get(key: string): Contract<any> | undefined {
    try {
      const cached = this.cache.get(key);
      if (!cached) {
        return undefined;
      }

      // Check if expired
      const now = Date.now();
      if (now - cached.createdAt > this.ttl) {
        this.cache.delete(key);
        logger.debug('Contract cache expired for key: %s', key);
        return undefined;
      }

      // Update access metadata
      cached.lastAccessed = now;
      cached.accessCount++;

      logger.debug('Contract cache hit for key: %s (access count: %d)', key, cached.accessCount);
      return cached.contract;
    } catch (error) {
      logger.error('Failed to get contract from cache: %O', error);
      return undefined;
    }
  }

  /**
   * Set contract in cache
   */
  set(key: string, contract: Contract<any>, address: Address, abi: Abi): void {
    try {
      // Check cache size limit
      if (this.cache.size >= this.maxSize) {
        this.evictLeastRecentlyUsed();
      }

      const now = Date.now();
      this.cache.set(key, {
        contract,
        address,
        abi,
        createdAt: now,
        lastAccessed: now,
        accessCount: 1,
      });

      logger.debug('Contract cached with key: %s', key);
    } catch (error) {
      logger.error('Failed to cache contract: %O', error);
    }
  }

  /**
   * Check if contract exists in cache
   */
  has(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) {
      return false;
    }

    // Check if expired
    const now = Date.now();
    if (now - cached.createdAt > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove contract from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug('Contract removed from cache: %s', key);
    }
    return deleted;
  }

  /**
   * Clear all cached contracts
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Contract cache cleared (%d contracts removed)', size);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate?: number;
    topAccessed: Array<{ key: string; accessCount: number; lastAccessed: number }>;
  } {
    const size = this.cache.size;
    const topAccessed = Array.from(this.cache.entries())
      .map(([key, cached]) => ({
        key,
        accessCount: cached.accessCount,
        lastAccessed: cached.lastAccessed,
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    return {
      size,
      maxSize: this.maxSize,
      topAccessed,
    };
  }

  /**
   * Clean up expired contracts
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.createdAt > this.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.info('Cleaned up %d expired contracts from cache', removed);
    }

    return removed;
  }

  /**
   * Evict least recently used contracts
   */
  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, cached] of this.cache.entries()) {
      if (cached.lastAccessed < oldestTime) {
        oldestTime = cached.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug('Evicted least recently used contract: %s', oldestKey);
    }
  }
}

// Global contract cache instance
const contractCache = new ContractCache();

/**
 * Get cached contract instance
 */
export function getCachedContract(
  address: Address,
  abi: Abi,
  type: string = 'default'
): Contract<any> {
  try {
    const key = `${address}_${type}`;

    // Check cache first
    if (contractCache.has(key)) {
      return contractCache.get(key)!;
    }

    // Create new contract instance
    const provider = getViemProvider();
    const client = type === 'write'
      ? provider.createWalletClient('0x') // Default account, should be overridden
      : provider.getHttpClient();

    const contract = {
      address,
      abi,
      client,
    };

    // Cache the contract
    contractCache.set(key, contract, address, abi);

    logger.debug('Created new contract instance for: %s', address);
    return contract;
  } catch (error) {
      logger.error('Failed to get cached contract: %O', error);
      throw new Error(`Failed to get cached contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create cached contract factory
 */
export function createCachedContractFactory<T extends readonly unknown[]>(
  abi: Abi,
  options?: ContractCacheOptions
) {
  const cache = new ContractCache(options);

  return {
    get: (address: Address, privateKey?: string): Contract<T> => {
      const type = privateKey ? 'write' : 'read';
      const key = `${address}_${type}`;

      // Check cache first
      if (cache.has(key)) {
        return cache.get(key)!;
      }

      // Create new contract instance
      const provider = getViemProvider();
      const client = privateKey
        ? provider.createWalletClient(privateKey)
        : provider.getHttpClient();

      const contract = {
        address,
        abi,
        client,
      };

      // Cache the contract
      cache.set(key, contract, address, abi);

      return contract;
    },
    clear: () => cache.clear(),
    cleanup: () => cache.cleanup(),
    getStats: () => cache.getStats(),
  };
}

/**
 * Batch get multiple contracts
 */
export function batchGetCachedContracts(
  contracts: Array<{
    address: Address;
    abi: Abi;
    type?: string;
  }>
): Array<{
  address: Address;
    contract?: Contract<any>;
  error?: string;
}> {
  try {
    logger.debug('Batch getting %d cached contracts', contracts.length);

    const results = contracts.map(({ address, abi, type = 'default' }) => {
      try {
        const contract = getCachedContract(address, abi, type);
        return { address, contract };
      } catch (error) {
        logger.error('Failed to get cached contract for %s: %O', address, error);
        return {
          address,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    const successCount = results.filter(r => !r.error).length;
    logger.debug('Batch get complete: %d/%d successful', successCount, contracts.length);
    return results;
  } catch (error) {
    logger.error('Failed to batch get cached contracts: %O', error);
    throw new Error(`Batch get contracts failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Preload contracts into cache
 */
export async function preloadContracts(
  contracts: Array<{
    address: Address;
    abi: Abi;
    type?: string;
  }>
): Promise<{
  loaded: number;
  failed: number;
  errors: string[];
}> {
  try {
    logger.info('Preloading %d contracts into cache', contracts.length);

    const results = await Promise.allSettled(
      contracts.map(async ({ address, abi, type = 'default' }) => {
        try {
          getCachedContract(address, abi, type);
          return { address, success: true };
        } catch (error) {
          return {
            address,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    const loaded = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - loaded;
    const errors = results
      .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))
      .map(r => r.status === 'rejected' ? 'Unknown error' : r.value?.error || 'Unknown error');

    logger.info('Contract preloading complete: %d loaded, %d failed', loaded, failed);
    return { loaded, failed, errors };
  } catch (error) {
    logger.error('Failed to preload contracts: %O', error);
    return { loaded: 0, failed: 0, errors: [error instanceof Error ? error.message : 'Unknown error'] };
  }
}

/**
 * Warm up contract cache with common contracts
 */
export async function warmUpCache(): Promise<void> {
  try {
    logger.info('Warming up contract cache');

    // Common PancakeSwap contracts
    const commonContracts = [
      {
        address: '0x10ED43C718714eb63d5aA57B78B54704E256024E' as Address, // PancakeSwap Router
        abi: [] as Abi, // Would be populated with actual ABI
        type: 'read',
      },
      {
        address: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as Address, // PancakeSwap Factory
        abi: [] as Abi,
        type: 'read',
      },
      // Add more common contracts as needed
    ];

    const { loaded, failed } = await preloadContracts(commonContracts);
    logger.info('Contract cache warm up complete: %d loaded, %d failed', loaded, failed);
  } catch (error) {
    logger.error('Failed to warm up contract cache: %O', error);
  }
}

/**
 * Export contract cache instance
 */
export { contractCache };

export default {
  getCachedContract,
  createCachedContractFactory,
  batchGetCachedContracts,
  preloadContracts,
  warmUpCache,
  contractCache,
};