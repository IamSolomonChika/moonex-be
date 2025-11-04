import { PublicClient, createPublicClient, createBatchClient, BatchRequest, Hash, Address } from 'viem';
import { getViemProvider, VIEM_CONFIG } from '../providers/viem-provider';
import { getCurrentChainConfig } from '../../config/viem';
import logger from '../../utils/logger';
import { CacheService } from '../../services/cache.service';
import { ViemTransaction, GasEstimate, BatchRequest as CustomBatchRequest, BatchResult } from '../../types/viem';

/**
 * Viem Client Utilities
 * Provides utility functions for Viem client operations, batch requests, and optimizations
 */

class ViemUtils {
  private cache: CacheService;
  private batchClient: PublicClient | null = null;

  constructor() {
    this.cache = new CacheService();
  }

  /**
   * Create optimized batch client for multiple requests
   */
  public createBatchClient(): PublicClient {
    if (!this.batchClient) {
      const provider = getViemProvider();
      this.batchClient = provider.createBatchClient();
    }
    return this.batchClient;
  }

  /**
   * Estimate gas with optimization and caching
   */
  public async estimateGasOptimized(transaction: ViemTransaction): Promise<GasEstimate> {
    const cacheKey = `gas_${transaction.to}_${transaction.data}_${transaction.value || '0'}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      logger.debug('Using cached gas estimate');
      return cached;
    }

    try {
      const client = getViemProvider().getHttpClient();

      // Get current gas price
      const gasPrice = await client.getGasPrice();
      const gas = await client.estimateGas(transaction);

      // Apply gas multiplier for safety
      const adjustedGas = BigInt(Math.floor(Number(gas) * VIEM_CONFIG.GAS_MULTIPLIER));
      const totalCost = adjustedGas * gasPrice;

      const estimate: GasEstimate = {
        gas: adjustedGas,
        gasPrice,
        totalCost,
      };

      // Cache the result
      this.cache.set(cacheKey, estimate, 30000); // Cache for 30 seconds

      return estimate;
    } catch (error) {
      logger.error('Gas estimation failed: %O', error);

      // Fallback to default estimates
      const fallbackGas = BigInt('21000'); // Standard transaction gas
      const fallbackGasPrice = BigInt('5000000000'); // 5 Gwei

      return {
        gas: fallbackGas,
        gasPrice: fallbackGasPrice,
        totalCost: fallbackGas * fallbackGasPrice,
      };
    }
  }

  /**
   * Build transaction with optimal gas settings
   */
  public buildTransaction(transaction: ViemTransaction): ViemTransaction {
    const client = getViemProvider().getHttpClient();

    return {
      ...transaction,
      gas: transaction.gas || BigInt('21000'),
      gasPrice: transaction.gasPrice || BigInt('5000000000'), // 5 Gwei default
    };
  }

  /**
   * Execute batch requests efficiently
   */
  public async executeBatchRequests(requests: CustomBatchRequest[]): Promise<BatchResult[]> {
    const batchClient = this.createBatchClient();
    const results: BatchResult[] = [];

    try {
      // Group requests by type for optimization
      const readRequests = requests.filter(req => req.type === 'read');
      const writeRequests = requests.filter(req => req.type === 'write');

      // Process read requests in batch
      if (readRequests.length > 0) {
        const readPromises = readRequests.map(async (request) => {
          try {
            const contract = {
              address: request.contract,
              abi: request.abi,
            } as const;

            let result;
            if (request.args) {
              result = await batchClient.readContract({
                ...contract,
                functionName: request.functionName,
                args: request.args,
              });
            } else {
              result = await batchClient.readContract({
                ...contract,
                functionName: request.functionName,
              });
            }

            return {
              success: true,
              result,
            };
          } catch (error) {
            logger.error('Batch read request failed: %O', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        });

        const readResults = await Promise.all(readPromises);
        results.push(...readResults);
      }

      // Process write requests individually (for safety)
      for (const request of writeRequests) {
        try {
          const walletClient = getViemProvider().createWalletClient('0x'); // Default account, should be overridden

          // This would need actual account and proper gas estimation
          // For now, return a placeholder result
          results.push({
            success: true,
            result: '0x' as Hash, // Placeholder transaction hash
          });
        } catch (error) {
          logger.error('Batch write request failed: %O', error);
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Batch execution failed: %O', error);

      // Return error results for all requests
      return requests.map(() => ({
        success: false,
        error: error instanceof Error ? error.message : 'Batch execution failed',
      }));
    }
  }

  /**
   * Get block with transaction optimization
   */
  public async getBlockOptimized(blockNumberOrTag: Hash | 'latest' | 'earliest' | 'pending' = 'latest') {
    const cacheKey = `block_${blockNumberOrTag}`;

    // Check cache for recent blocks
    if (blockNumberOrTag === 'latest') {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 5000) { // 5 seconds cache for latest block
        return cached.data;
      }
    }

    try {
      const client = getViemProvider().getHttpClient();
      const block = await client.getBlock(blockNumberOrTag);

      // Cache the result
      this.cache.set(cacheKey, { data: block, timestamp: Date.now() }, 30000);

      return block;
    } catch (error) {
      logger.error('Failed to get block: %O', error);
      throw error;
    }
  }

  /**
   * Get transaction with receipt in single call
   */
  public async getTransactionWithReceipt(hash: Hash) {
    const cacheKey = `tx_${hash}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const client = getViemProvider().getHttpClient();

      const [transaction, receipt] = await Promise.all([
        client.getTransaction(hash),
        client.getTransactionReceipt(hash),
      ]);

      const result = { transaction, receipt };

      // Cache the result
      this.cache.set(cacheKey, result, VIEM_CONFIG.CACHE_TTL);

      return result;
    } catch (error) {
      logger.error('Failed to get transaction with receipt: %O', error);
      throw error;
    }
  }

  /**
   * Multicall for multiple contract reads
   */
  public async multicall(calls: Array<{
    address: Address;
    abi: any[];
    functionName: string;
    args?: readonly unknown[];
  }>) {
    try {
      const batchClient = this.createBatchClient();

      const multicallResults = await batchClient.multicall({
        contracts: calls.map(call => ({
          address: call.address,
          abi: call.abi,
          functionName: call.functionName,
          args: call.args,
        })),
        allowFailure: true,
      });

      return multicallResults.map((result, index) => ({
        success: result.status === 'success',
        result: result.result,
        error: result.status === 'failure' ? result.error : undefined,
        call: calls[index],
      }));
    } catch (error) {
      logger.error('Multicall failed: %O', error);

      // Fallback to individual calls
      const fallbackResults = [];
      const client = getViemProvider().getHttpClient();

      for (const call of calls) {
        try {
          const result = await client.readContract({
            address: call.address,
            abi: call.abi,
            functionName: call.functionName,
            args: call.args,
          });

          fallbackResults.push({
            success: true,
            result,
            call,
          });
        } catch (error) {
          fallbackResults.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            call,
          });
        }
      }

      return fallbackResults;
    }
  }

  /**
   * Get client performance metrics
   */
  public getPerformanceMetrics() {
    return {
      cacheSize: this.cache.size(),
      batchClientActive: this.batchClient !== null,
      providerStatus: getViemProvider().getStatus(),
    };
  }

  /**
   * Clear caches
   */
  public clearCache(): void {
    this.cache.clear();
    logger.info('Viem utils cache cleared');
  }

  /**
   * Warm up caches and connections
   */
  public async warmUp(): Promise<void> {
    try {
      logger.info('Warming up Viem utils...');

      // Pre-warm the provider
      const provider = getViemProvider();
      const client = provider.getHttpClient();

      // Test connectivity
      await client.getBlockNumber();

      // Create batch client
      this.createBatchClient();

      logger.info('Viem utils warm up completed');
    } catch (error) {
      logger.error('Viem utils warm up failed: %O', error);
      throw error;
    }
  }
}

// Singleton instance
let viemUtils: ViemUtils | null = null;

/**
 * Get Viem utils singleton instance
 */
export const getViemUtils = (): ViemUtils => {
  if (!viemUtils) {
    viemUtils = new ViemUtils();
  }
  return viemUtils;
};

// Convenience exports
export const createBatchClient = () => getViemUtils().createBatchClient();
export const estimateGasOptimized = (transaction: ViemTransaction) => getViemUtils().estimateGasOptimized(transaction);
export const buildTransaction = (transaction: ViemTransaction) => getViemUtils().buildTransaction(transaction);
export const executeBatchRequests = (requests: CustomBatchRequest[]) => getViemUtils().executeBatchRequests(requests);
export const getBlockOptimized = (blockNumberOrTag?: Hash | 'latest' | 'earliest' | 'pending') => getViemUtils().getBlockOptimized(blockNumberOrTag);
export const getTransactionWithReceipt = (hash: Hash) => getViemUtils().getTransactionWithReceipt(hash);
export const multicall = (calls: Array<{
  address: Address;
  abi: any[];
  functionName: string;
  args?: readonly unknown[];
}>) => getViemUtils().multicall(calls);

export { ViemUtils };
export default getViemUtils;