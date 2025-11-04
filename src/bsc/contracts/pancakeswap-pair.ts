import { Address, Hash, PublicClient, WalletClient } from 'viem';
import { PANCAKESWAP_PAIR_ABI_VIEM } from '../abis/pancakeswap';
import { getViemProvider } from '../providers/viem-provider';
import { getContractHelpers } from '../utils/contract-helpers';
import logger from '../../utils/logger';

/**
 * PancakeSwap Pair Contract (Viem Implementation)
 * Provides type-safe PancakeSwap pair interactions using Viem
 */

// PancakeSwap Pair contract types
export interface PancakeSwapPairViem {
  // Base contract methods will be added dynamically
  getReserves: () => Promise<{
    reserve0: bigint;
    reserve1: bigint;
    blockTimestampLast: bigint;
  }>;
  token0: () => Promise<Address>;
  token1: () => Promise<Address>;
  totalSupply: () => Promise<bigint>;
  balanceOf: (owner: Address) => Promise<bigint>;
  watchSync: (callback: () => void) => (() => void);
  // Add other methods as needed
}

/**
 * Create PancakeSwap Pair contract instance with Viem
 */
export function createPancakeSwapPair(pairAddress: Address): PancakeSwapPairViem {
  const provider = getViemProvider();
  const contractHelpers = getContractHelpers();

  // Create the base contract
  const contract = contractHelpers.createContract(
    pairAddress,
    PANCAKESWAP_PAIR_ABI_VIEM,
    'read'
  );

  return {
    ...contract,

    // Pair specific methods
    getReserves: async (): Promise<{
      reserve0: bigint;
      reserve1: bigint;
      blockTimestampLast: bigint;
    }> => {
      try {
        logger.debug('Getting reserves for pair: %s', pairAddress);
        const reserves = await contract.read.getReserves();
        logger.debug('Reserves: %O', reserves);
        return {
          reserve0: reserves.reserve0,
          reserve1: reserves.reserve1,
          blockTimestampLast: BigInt(reserves.blockTimestampLast),
        };
      } catch (error) {
        logger.error('Failed to get reserves: %O', error);
        throw new Error(`Failed to get reserves: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    token0: async (): Promise<Address> => {
      try {
        logger.debug('Getting token0 for pair: %s', pairAddress);
        const token0 = await contract.read.token0();
        logger.debug('Token0: %s', token0);
        return token0;
      } catch (error) {
        logger.error('Failed to get token0: %O', error);
        throw new Error(`Failed to get token0: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    token1: async (): Promise<Address> => {
      try {
        logger.debug('Getting token1 for pair: %s', pairAddress);
        const token1 = await contract.read.token1();
        logger.debug('Token1: %s', token1);
        return token1;
      } catch (error) {
        logger.error('Failed to get token1: %O', error);
        throw new Error(`Failed to get token1: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    totalSupply: async (): Promise<bigint> => {
      try {
        logger.debug('Getting total supply for pair: %s', pairAddress);
        const totalSupply = await contract.read.totalSupply();
        logger.debug('Total supply: %s', totalSupply.toString());
        return totalSupply;
      } catch (error) {
        logger.error('Failed to get total supply: %O', error);
        throw new Error(`Failed to get total supply: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    balanceOf: async (owner: Address): Promise<bigint> => {
      try {
        logger.debug('Getting balance for %s in pair: %s', owner, pairAddress);
        const balance = await contract.read.balanceOf([owner]);
        logger.debug('Balance: %s', balance.toString());
        return balance;
      } catch (error) {
        logger.error('Failed to get balance: %O', error);
        throw new Error(`Failed to get balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    allowance: async (owner: Address, spender: Address): Promise<bigint> => {
      try {
        logger.debug('Getting allowance for %s -> %s in pair: %s', owner, spender, pairAddress);
        const allowance = await contract.read.allowance([owner, spender]);
        logger.debug('Allowance: %s', allowance.toString());
        return allowance;
      } catch (error) {
        logger.error('Failed to get allowance: %O', error);
        throw new Error(`Failed to get allowance: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Write methods
    approve: async (
      spender: Address,
      value: bigint,
      privateKey: string
    ): Promise<boolean> => {
      try {
        logger.info('Approving %s to spend %s tokens from pair: %s', spender, value.toString(), pairAddress);

        await contractHelpers.callWriteFunction(
          pairAddress,
          PANCAKESWAP_PAIR_ABI_VIEM,
          'approve',
          [spender, value],
          privateKey
        );

        logger.info('Approval successful');
        return true;
      } catch (error) {
        logger.error('Failed to approve: %O', error);
        throw new Error(`Approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    transfer: async (
      to: Address,
      value: bigint,
      privateKey: string
    ): Promise<boolean> => {
      try {
        logger.info('Transferring %s tokens to %s from pair: %s', value.toString(), to, pairAddress);

        await contractHelpers.callWriteFunction(
          pairAddress,
          PANCAKESWAP_PAIR_ABI_VIEM,
          'transfer',
          [to, value],
          privateKey
        );

        logger.info('Transfer successful');
        return true;
      } catch (error) {
        logger.error('Failed to transfer: %O', error);
        throw new Error(`Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    transferFrom: async (
      from: Address,
      to: Address,
      value: bigint,
      privateKey: string
    ): Promise<boolean> => {
      try {
        logger.info('Transferring %s tokens from %s to %s via pair: %s', value.toString(), from, to, pairAddress);

        await contractHelpers.callWriteFunction(
          pairAddress,
          PANCAKESWAP_PAIR_ABI_VIEM,
          'transferFrom',
          [from, to, value],
          privateKey
        );

        logger.info('Transfer successful');
        return true;
      } catch (error) {
        logger.error('Failed to transferFrom: %O', error);
        throw new Error(`TransferFrom failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Liquidity operations
    mint: async (to: Address, privateKey: string): Promise<bigint> => {
      try {
        logger.info('Minting LP tokens for %s from pair: %s', to, pairAddress);

        const hash = await contractHelpers.callWriteFunction(
          pairAddress,
          PANCAKESWAP_PAIR_ABI_VIEM,
          'mint',
          [to],
          privateKey
        );

        // Wait for transaction and get receipt to extract mint amount from event
        const publicClient = provider.getHttpClient();
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        const mintAmount = await extractMintAmountFromReceipt(receipt);
        logger.info('Mint successful: %s LP tokens', mintAmount.toString());
        return mintAmount;
      } catch (error) {
        logger.error('Failed to mint: %O', error);
        throw new Error(`Mint failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    burn: async (to: Address, privateKey: string): Promise<readonly [bigint, bigint]> => {
      try {
        logger.info('Burning LP tokens for %s from pair: %s', to, pairAddress);

        const hash = await contractHelpers.callWriteFunction(
          pairAddress,
          PANCAKESWAP_PAIR_ABI_VIEM,
          'burn',
          [to],
          privateKey
        );

        // Wait for transaction and get receipt to extract amounts from event
        const publicClient = provider.getHttpClient();
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        const amounts = await extractBurnAmountsFromReceipt(receipt);
        logger.info('Burn successful: amount0=%s, amount1=%s', amounts[0].toString(), amounts[1].toString());
        return amounts;
      } catch (error) {
        logger.error('Failed to burn: %O', error);
        throw new Error(`Burn failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Swap operations
    skim: async (to: Address, privateKey: string): Promise<void> => {
      try {
        logger.info('Skimming excess tokens to %s from pair: %s', to, pairAddress);

        await contractHelpers.callWriteFunction(
          pairAddress,
          PANCAKESWAP_PAIR_ABI_VIEM,
          'skim',
          [to],
          privateKey
        );

        logger.info('Skim successful');
      } catch (error) {
        logger.error('Failed to skim: %O', error);
        throw new Error(`Skim failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    sync: async (privateKey: string): Promise<void> => {
      try {
        logger.info('Syncing reserves for pair: %s', pairAddress);

        await contractHelpers.callWriteFunction(
          pairAddress,
          PANCAKESWAP_PAIR_ABI_VIEM,
          'sync',
          [],
          privateKey
        );

        logger.info('Sync successful');
      } catch (error) {
        logger.error('Failed to sync: %O', error);
        throw new Error(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Utility methods
    getPairInfo: async (): Promise<{
      address: Address;
      token0: Address;
      token1: Address;
      reserves: {
        reserve0: bigint;
        reserve1: bigint;
        blockTimestampLast: bigint;
      };
      totalSupply: bigint;
    }> => {
      try {
        const [token0, token1, reserves, totalSupply] = await Promise.all([
          this.token0(),
          this.token1(),
          this.getReserves(),
          this.totalSupply(),
        ]);

        return {
          address: pairAddress,
          token0,
          token1,
          reserves,
          totalSupply,
        };
      } catch (error) {
        logger.error('Failed to get pair info: %O', error);
        throw new Error(`Get pair info failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    calculatePrice: async (): Promise<{
      price0: number;
      price1: number;
    }> => {
      try {
        const reserves = await this.getReserves();
        const price0 = Number(reserves.reserve1) / Number(reserves.reserve0);
        const price1 = Number(reserves.reserve0) / Number(reserves.reserve1);

        return { price0, price1 };
      } catch (error) {
        logger.error('Failed to calculate price: %O', error);
        throw new Error(`Price calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Batch operations
    getMultipleBalances: async (owners: Address[]): Promise<Array<{ owner: Address; balance: bigint }>> => {
      try {
        logger.debug('Getting balances for %d owners', owners.length);
        const client = provider.getHttpClient();

        const results = await client.multicall({
          contracts: owners.map(owner => ({
            address: pairAddress,
            abi: PANCAKESWAP_PAIR_ABI_VIEM,
            functionName: 'balanceOf',
            args: [owner],
          })),
          allowFailure: true,
        });

        const balances = results.map((result, index) => {
          if (result.status === 'success') {
            return {
              owner: owners[index],
              balance: result.result as bigint,
            };
          } else {
            logger.error('Failed to get balance for %s: %O', owners[index], result.error);
            throw new Error(`Failed to get balance for ${owners[index]}`);
          }
        });

        logger.debug('Retrieved %d balances', balances.length);
        return balances;
      } catch (error) {
        logger.error('Failed to get multiple balances: %O', error);
        throw new Error(`Batch get balances failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Event monitoring
    watchSwap: (callback: (sender: Address, amount0In: bigint, amount1In: bigint, amount0Out: bigint, amount1Out: bigint, to: Address) => void): (() => void) => {
      try {
        const client = provider.getWebSocketClient();

        const unwatch = client.watchEvent({
          address: pairAddress,
          abi: PANCAKESWAP_PAIR_ABI_VIEM,
          eventName: 'Swap',
          onLogs: (logs) => {
            logs.forEach(log => {
              if (log.eventName === 'Swap' && log.args) {
                const { sender, amount0In, amount1In, amount0Out, amount1Out, to } = log.args;
                logger.info('Swap event: %s -> %s via %s', amount0In.toString(), amount1Out.toString(), sender);
                callback(sender, amount0In, amount1In, amount0Out, amount1Out, to);
              }
            });
          },
        });

        logger.info('Started watching Swap events for pair: %s', pairAddress);
        return unwatch;
      } catch (error) {
        logger.error('Failed to watch Swap events: %O', error);
        throw new Error(`Event watching failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    watchMint: (callback: (sender: Address, amount0: bigint, amount1: bigint, to: Address) => void): (() => void) => {
      try {
        const client = provider.getWebSocketClient();

        const unwatch = client.watchEvent({
          address: pairAddress,
          abi: PANCAKESWAP_PAIR_ABI_VIEM,
          eventName: 'Mint',
          onLogs: (logs) => {
            logs.forEach(log => {
              if (log.eventName === 'Mint' && log.args) {
                const { sender, amount0, amount1, to } = log.args;
                logger.info('Mint event: +%s, +%s LP tokens to %s', amount0.toString(), amount1.toString(), to);
                callback(sender, amount0, amount1, to);
              }
            });
          },
        });

        logger.info('Started watching Mint events for pair: %s', pairAddress);
        return unwatch;
      } catch (error) {
        logger.error('Failed to watch Mint events: %O', error);
        throw new Error(`Event watching failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    watchBurn: (callback: (sender: Address, amount0: bigint, amount1: bigint, to: Address) => void): (() => void) => {
      try {
        const client = provider.getWebSocketClient();

        const unwatch = client.watchEvent({
          address: pairAddress,
          abi: PANCAKESWAP_PAIR_ABI_VIEM,
          eventName: 'Burn',
          onLogs: (logs) => {
            logs.forEach(log => {
              if (log.eventName === 'Burn' && log.args) {
                const { sender, amount0, amount1, to } = log.args;
                logger.info('Burn event: -%s, -%s LP tokens to %s', amount0.toString(), amount1.toString(), to);
                callback(sender, amount0, amount1, to);
              }
            });
          },
        });

        logger.info('Started watching Burn events for pair: %s', pairAddress);
        return unwatch;
      } catch (error) {
        logger.error('Failed to watch Burn events: %O', error);
        throw new Error(`Event watching failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Validation methods
    validatePair: async (): Promise<{
      valid: boolean;
      error?: string;
      info?: {
        token0: Address;
        token1: Address;
        hasLiquidity: boolean;
      };
    }> => {
      try {
        const [token0, token1, reserves] = await Promise.all([
          this.token0(),
          this.token1(),
          this.getReserves(),
        ]);

        const hasLiquidity = reserves.reserve0 > 0n && reserves.reserve1 > 0n;

        return {
          valid: true,
          info: {
            token0,
            token1,
            hasLiquidity,
          },
        };
      } catch (error) {
        return {
          valid: false,
          error: error instanceof Error ? error.message : 'Pair validation failed',
        };
      }
    },
  };
}

/**
 * Extract mint amount from transaction receipt
 */
async function extractMintAmountFromReceipt(receipt: any): Promise<bigint> {
  try {
    // Find the Mint event in the receipt logs
    for (const log of receipt.logs) {
      if (log.topics[0] === '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c2f36') {
        // Mint event signature
        // Extract liquidity amount from the data field
        // In Mint event: Mint(sender, amount0, amount1, to)
        // liquidity is returned from the function call, not in the event
        // For now, return a placeholder - in production you'd get this from the transaction result
        return BigInt(0);
      }
    }

    throw new Error('Mint event not found in transaction receipt');
  } catch (error) {
    logger.error('Failed to extract mint amount from receipt: %O', error);
    throw new Error(`Failed to extract mint amount: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract burn amounts from transaction receipt
 */
async function extractBurnAmountsFromReceipt(receipt: any): Promise<readonly [bigint, bigint]> {
  try {
    // Find the Burn event in the receipt logs
    for (const log of receipt.logs) {
      if (log.topics[0] === '0xdccd412f0b1252819cb1fd330b93224ca42612892bb3f4f789976e6d81936496e') {
        // Burn event signature
        // Extract amounts from the data field
        // In Burn event: Burn(sender, amount0, amount1, to)
        // amount0 and amount1 are in the data field
        const amount0 = BigInt('0x' + log.data.slice(26, 90));
        const amount1 = BigInt('0x' + log.data.slice(90, 154));
        return [amount0, amount1] as const;
      }
    }

    throw new Error('Burn event not found in transaction receipt');
  } catch (error) {
    logger.error('Failed to extract burn amounts from receipt: %O', error);
    throw new Error(`Failed to extract burn amounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * PancakeSwap Pair Factory Class
 */
export class PancakeSwapPairFactory {
  private static instances: Map<Address, PancakeSwapPairViem> = new Map();

  /**
   * Get or create pair instance (singleton pattern)
   */
  static getPair(address: Address): PancakeSwapPairViem {
    if (!this.instances.has(address)) {
      const pair = createPancakeSwapPair(address);
      this.instances.set(address, pair);
    }

    return this.instances.get(address)!;
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

export default createPancakeSwapPair;