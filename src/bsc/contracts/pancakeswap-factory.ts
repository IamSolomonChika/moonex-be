import { Address, PublicClient, WalletClient } from 'viem';
import { PANCAKESWAP_FACTORY_ABI_VIEM } from '../abis/pancakeswap';
import { getViemProvider } from '../providers/viem-provider';
import { getContractHelpers } from '../utils/contract-helpers';
import logger from '../../utils/logger';

/**
 * PancakeSwap Factory Contract (Viem Implementation)
 * Provides type-safe PancakeSwap factory interactions using Viem
 */

// PancakeSwap V2 Factory address on BSC
export const PANCAKESWAP_FACTORY_ADDRESS = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as Address;

// PancakeSwap Factory contract types
export interface PancakeSwapFactoryViem {
  // Base contract methods will be added dynamically
  getPair: (tokenA: Address, tokenB: Address) => Promise<Address>;
  allPairs: (index: bigint) => Promise<Address>;
  allPairsLength: () => Promise<bigint>;
  getPairs: (indices: bigint[]) => Promise<Address[]>;
  createPair: (
    tokenA: Address,
    tokenB: Address,
    privateKey: string
  ) => Promise<Address>;
  // Add other methods as needed
}

/**
 * Create PancakeSwap Factory contract instance with Viem
 */
export function createPancakeSwapFactory(): PancakeSwapFactoryViem {
  const provider = getViemProvider();
  const contractHelpers = getContractHelpers();

  // Create the base contract
  const contract = contractHelpers.createContract(
    PANCAKESWAP_FACTORY_ADDRESS,
    PANCAKESWAP_FACTORY_ABI_VIEM,
    'read'
  );

  return {
    ...contract,

    // Factory specific methods
    createPair: async (
      tokenA: Address,
      tokenB: Address,
      privateKey: string
    ): Promise<Address> => {
      try {
        logger.info('Creating pair for tokens: %s <-> %s', tokenA, tokenB);

        const hash = await contractHelpers.callWriteFunction(
          PANCAKESWAP_FACTORY_ADDRESS,
          PANCAKESWAP_FACTORY_ABI_VIEM,
          'createPair',
          [tokenA, tokenB],
          privateKey
        );

        // Wait for transaction and get receipt to extract pair address from event
        const publicClient = provider.getHttpClient();
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        // Parse PairCreated event to get the pair address
        const pairAddress = await extractPairAddressFromReceipt(receipt);

        logger.info('Pair created successfully: %s', pairAddress);
        return pairAddress;
      } catch (error) {
        logger.error('Failed to create pair: %O', error);
        throw new Error(`Pair creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    getPair: async (tokenA: Address, tokenB: Address): Promise<Address> => {
      try {
        logger.debug('Getting pair for tokens: %s <-> %s', tokenA, tokenB);
        const pairAddress = await contract.read.getPair([tokenA, tokenB]);
        logger.debug('Pair address: %s', pairAddress);
        return pairAddress;
      } catch (error) {
        logger.error('Failed to get pair: %O', error);
        throw new Error(`Failed to get pair: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    allPairs: async (index: bigint): Promise<Address> => {
      try {
        logger.debug('Getting pair at index: %s', index.toString());
        const pairAddress = await contract.read.allPairs([index]);
        logger.debug('Pair at index %s: %s', index.toString(), pairAddress);
        return pairAddress;
      } catch (error) {
        logger.error('Failed to get pair at index: %O', error);
        throw new Error(`Failed to get pair at index: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    allPairsLength: async (): Promise<bigint> => {
      try {
        logger.debug('Getting total pairs length');
        const length = await contract.read.allPairsLength();
        logger.debug('Total pairs length: %s', length.toString());
        return length;
      } catch (error) {
        logger.error('Failed to get pairs length: %O', error);
        throw new Error(`Failed to get pairs length: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    feeTo: async (): Promise<Address> => {
      try {
        logger.debug('Getting fee to address');
        const feeTo = await contract.read.feeTo();
        logger.debug('Fee to address: %s', feeTo);
        return feeTo;
      } catch (error) {
        logger.error('Failed to get fee to: %O', error);
        throw new Error(`Failed to get fee to: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    feeToSetter: async (): Promise<Address> => {
      try {
        logger.debug('Getting fee to setter address');
        const feeToSetter = await contract.read.feeToSetter();
        logger.debug('Fee to setter address: %s', feeToSetter);
        return feeToSetter;
      } catch (error) {
        logger.error('Failed to get fee to setter: %O', error);
        throw new Error(`Failed to get fee to setter: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    setFeeTo: async (
      feeTo: Address,
      privateKey: string
    ): Promise<void> => {
      try {
        logger.info('Setting fee to address: %s', feeTo);

        await contractHelpers.callWriteFunction(
          PANCAKESWAP_FACTORY_ADDRESS,
          PANCAKESWAP_FACTORY_ABI_VIEM,
          'setFeeTo',
          [feeTo],
          privateKey
        );

        logger.info('Fee to set successfully');
      } catch (error) {
        logger.error('Failed to set fee to: %O', error);
        throw new Error(`Set fee to failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    setFeeToSetter: async (
      feeToSetter: Address,
      privateKey: string
    ): Promise<void> => {
      try {
        logger.info('Setting fee to setter address: %s', feeToSetter);

        await contractHelpers.callWriteFunction(
          PANCAKESWAP_FACTORY_ADDRESS,
          PANCAKESWAP_FACTORY_ABI_VIEM,
          'setFeeToSetter',
          [feeToSetter],
          privateKey
        );

        logger.info('Fee to setter set successfully');
      } catch (error) {
        logger.error('Failed to set fee to setter: %O', error);
        throw new Error(`Set fee to setter failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Batch operations
    getPairs: async (indices: bigint[]): Promise<Address[]> => {
      try {
        logger.debug('Getting %d pairs in batch', indices.length);
        const client = provider.getHttpClient();

        const results = await client.multicall({
          contracts: indices.map((index, i) => ({
            address: PANCAKESWAP_FACTORY_ADDRESS,
            abi: PANCAKESWAP_FACTORY_ABI_VIEM,
            functionName: 'allPairs',
            args: [index],
          })),
          allowFailure: true,
        });

        const pairs = results.map((result, index) => {
          if (result.status === 'success') {
            return result.result as Address;
          } else {
            logger.error('Failed to get pair at index %s: %O', indices[index], result.error);
            throw new Error(`Failed to get pair at index ${indices[index]}`);
          }
        });

        logger.debug('Retrieved %d pairs', pairs.length);
        return pairs;
      } catch (error) {
        logger.error('Failed to get pairs in batch: %O', error);
        throw new Error(`Batch get pairs failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Utility methods
    pairExists: async (tokenA: Address, tokenB: Address): Promise<boolean> => {
      try {
        const pairAddress = await this.getPair(tokenA, tokenB);
        return pairAddress !== '0x0000000000000000000000000000000000000000' as Address;
      } catch (error) {
        return false;
      }
    },

    getAllPairs: async (): Promise<Array<{ index: bigint; address: Address }>> => {
      try {
        const length = await this.allPairsLength();
        const pairs: Array<{ index: bigint; address: Address }> = [];

        for (let i = 0n; i < length; i++) {
          const address = await this.allPairs(i);
          pairs.push({ index: i, address });
        }

        logger.info('Retrieved all %d pairs', pairs.length);
        return pairs;
      } catch (error) {
        logger.error('Failed to get all pairs: %O', error);
        throw new Error(`Get all pairs failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Event monitoring
    watchPairCreated: (
      callback: (token0: Address, token1: Address, pair: Address, allPairsLength: bigint) => void
    ): (() => void) => {
      try {
        const client = provider.getWebSocketClient();

        const unwatch = client.watchEvent({
          address: PANCAKESWAP_FACTORY_ADDRESS,
          abi: PANCAKESWAP_FACTORY_ABI_VIEM,
          eventName: 'PairCreated',
          onLogs: (logs) => {
            logs.forEach(log => {
              if (log.eventName === 'PairCreated' && log.args) {
                const { token0, token1, pair, allPairsLength } = log.args;
                logger.info('New pair created: %s <-> %s -> %s', token0, token1, pair);
                callback(token0, token1, pair, allPairsLength);
              }
            });
          },
        });

        logger.info('Started watching PairCreated events');
        return unwatch;
      } catch (error) {
        logger.error('Failed to watch PairCreated events: %O', error);
        throw new Error(`Event watching failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Factory configuration
    getFactoryInfo: async (): Promise<{
      feeTo: Address;
      feeToSetter: Address;
      allPairsLength: bigint;
    }> => {
      try {
        const [feeTo, feeToSetter, allPairsLength] = await Promise.all([
          this.feeTo(),
          this.feeToSetter(),
          this.allPairsLength(),
        ]);

        return {
          feeTo,
          feeToSetter,
          allPairsLength,
        };
      } catch (error) {
        logger.error('Failed to get factory info: %O', error);
        throw new Error(`Get factory info failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Validation methods
    validateTokens: async (tokenA: Address, tokenB: Address): Promise<{
      valid: boolean;
      error?: string;
    }> => {
      try {
        if (tokenA === tokenB) {
          return {
            valid: false,
            error: 'Tokens cannot be the same',
          };
        }

        if (tokenA === '0x0000000000000000000000000000000000000000' as Address ||
            tokenB === '0x0000000000000000000000000000000000000000' as Address) {
          return {
            valid: false,
            error: 'Invalid token address (zero address)',
          };
        }

        // Check if pair already exists
        const existingPair = await this.getPair(tokenA, tokenB);
        if (existingPair !== '0x0000000000000000000000000000000000000000' as Address) {
          return {
            valid: false,
            error: 'Pair already exists',
          };
        }

        return { valid: true };
      } catch (error) {
        return {
          valid: false,
          error: error instanceof Error ? error.message : 'Validation failed',
        };
      }
    },
  };
}

/**
 * Extract pair address from transaction receipt
 */
async function extractPairAddressFromReceipt(receipt: any): Promise<Address> {
  try {
    // Find the PairCreated event in the receipt logs
    for (const log of receipt.logs) {
      if (log.topics[0] === '0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e159') {
        // PairCreated event signature
        // Extract the pair address from the data field
        // In PairCreated event: PairCreated(token0, token1, pair, allPairsLength)
        // pair is the third parameter (index 2)
        const pairAddress = '0x' + log.data.slice(26, 66);
        return pairAddress as Address;
      }
    }

    throw new Error('PairCreated event not found in transaction receipt');
  } catch (error) {
    logger.error('Failed to extract pair address from receipt: %O', error);
    throw new Error(`Failed to extract pair address: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * PancakeSwap Factory Factory Class
 */
export class PancakeSwapFactoryFactory {
  private static instances: Map<Address, PancakeSwapFactoryViem> = new Map();

  /**
   * Get or create factory instance (singleton pattern)
   */
  static getFactory(address?: Address): PancakeSwapFactoryViem {
    const factoryAddress = address || PANCAKESWAP_FACTORY_ADDRESS;

    if (!this.instances.has(factoryAddress)) {
      const factory = createPancakeSwapFactory();
      this.instances.set(factoryAddress, factory);
    }

    return this.instances.get(factoryAddress)!;
  }

  /**
   * Clear all instances
   */
  static clearInstances(): void {
    this.instances.clear();
  }

  /**
   * Get number of cached instances
   */
  static getInstanceCount(): number {
    return this.instances.size;
  }
}

export default createPancakeSwapFactory;