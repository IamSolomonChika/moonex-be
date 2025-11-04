import { Address, Hash, PublicClient, WalletClient } from 'viem';
import { PANCAKESWAP_ROUTER_ABI_VIEM } from '../abis/pancakeswap';
import { getViemProvider } from '../providers/viem-provider';
import { getContractHelpers } from '../utils/contract-helpers';
import logger from '../../utils/logger';
import { estimateGasOptimized } from '../utils/viem-utils';

/**
 * PancakeSwap Router Contract (Viem Implementation)
 * Provides type-safe PancakeSwap router interactions using Viem
 */

// PancakeSwap V2 Router address on BSC
export const PANCAKESWAP_ROUTER_ADDRESS = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as Address;

// PancakeSwap Router contract types
export interface PancakeSwapRouterViem {
  // Base contract methods will be added dynamically
  getAmountsOut: (amountIn: bigint, path: Address[]) => Promise<readonly bigint[]>;
  getAmountsIn: (amountOut: bigint, path: Address[]) => Promise<readonly bigint[]>;
  swapExactTokensForTokens: (
    amountIn: bigint,
    amountOutMin: bigint,
    path: Address[],
    to: Address,
    deadline: bigint,
    privateKey: string
  ) => Promise<Hash>;
  // Add other methods as needed
}

/**
 * Create PancakeSwap Router contract instance with Viem
 */
export function createPancakeSwapRouter(): PancakeSwapRouterViem {
  const provider = getViemProvider();
  const contractHelpers = getContractHelpers();

  // Create the base contract
  const contract = contractHelpers.createContract(
    PANCAKESWAP_ROUTER_ADDRESS,
    PANCAKESWAP_ROUTER_ABI_VIEM,
    'read'
  );

  return {
    ...contract,

    // Router specific methods
    getAmountsOut: async (amountIn: bigint, path: Address[]): Promise<readonly bigint[]> => {
      try {
        logger.debug('Getting amounts out for %s tokens', path.length);
        const result = await contract.read.getAmountsOut([amountIn, path]);
        logger.debug('Amounts out result: %O', result);
        return result;
      } catch (error) {
        logger.error('Failed to get amounts out: %O', error);
        throw new Error(`Failed to get amounts out: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    getAmountsIn: async (amountOut: bigint, path: Address[]): Promise<readonly bigint[]> => {
      try {
        logger.debug('Getting amounts in for %s tokens', path.length);
        const result = await contract.read.getAmountsIn([amountOut, path]);
        logger.debug('Amounts in result: %O', result);
        return result;
      } catch (error) {
        logger.error('Failed to get amounts in: %O', error);
        throw new Error(`Failed to get amounts in: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    swapExactTokensForTokens: async (
      amountIn: bigint,
      amountOutMin: bigint,
      path: Address[],
      to: Address,
      deadline: bigint,
      privateKey: string
    ): Promise<Hash> => {
      try {
        logger.info('Swapping exact tokens for tokens');
        logger.debug('Amount in: %s, Amount out min: %s', amountIn.toString(), amountOutMin.toString());
        logger.debug('Path: %O', path);
        logger.debug('To: %s, Deadline: %s', to, deadline.toString());

        const hash = await contractHelpers.callWriteFunction(
          PANCAKESWAP_ROUTER_ADDRESS,
          PANCAKESWAP_ROUTER_ABI_VIEM,
          'swapExactTokensForTokens',
          [amountIn, amountOutMin, path, to, deadline],
          privateKey
        );

        logger.info('Swap executed successfully: %s', hash);
        return hash;
      } catch (error) {
        logger.error('Failed to swap exact tokens for tokens: %O', error);
        throw new Error(`Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    swapTokensForExactTokens: async (
      amountOut: bigint,
      amountInMax: bigint,
      path: Address[],
      to: Address,
      deadline: bigint,
      privateKey: string
    ): Promise<Hash> => {
      try {
        logger.info('Swapping tokens for exact tokens');
        logger.debug('Amount out: %s, Amount in max: %s', amountOut.toString(), amountInMax.toString());
        logger.debug('Path: %O', path);
        logger.debug('To: %s, Deadline: %s', to, deadline.toString());

        const hash = await contractHelpers.callWriteFunction(
          PANCAKESWAP_ROUTER_ADDRESS,
          PANCAKESWAP_ROUTER_ABI_VIEM,
          'swapTokensForExactTokens',
          [amountOut, amountInMax, path, to, deadline],
          privateKey
        );

        logger.info('Swap executed successfully: %s', hash);
        return hash;
      } catch (error) {
        logger.error('Failed to swap tokens for exact tokens: %O', error);
        throw new Error(`Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    swapExactETHForTokens: async (
      amountOutMin: bigint,
      path: Address[],
      to: Address,
      deadline: bigint,
      privateKey: string,
      value: bigint
    ): Promise<Hash> => {
      try {
        logger.info('Swapping exact ETH for tokens');
        logger.debug('Amount out min: %s, Value: %s', amountOutMin.toString(), value.toString());
        logger.debug('Path: %O', path);
        logger.debug('To: %s, Deadline: %s', to, deadline.toString());

        const walletClient = provider.createWalletClient(privateKey);
        const publicClient = provider.getHttpClient();

        // Build transaction for ETH swap
        const { request } = await publicClient.simulateContract({
          address: PANCAKESWAP_ROUTER_ADDRESS,
          abi: PANCAKESWAP_ROUTER_ABI_VIEM,
          functionName: 'swapExactETHForTokens',
          args: [amountOutMin, path, to, deadline],
          account: walletClient.account,
          value,
        });

        const hash = await walletClient.writeContract(request);
        logger.info('ETH swap executed successfully: %s', hash);
        return hash;
      } catch (error) {
        logger.error('Failed to swap exact ETH for tokens: %O', error);
        throw new Error(`ETH swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    swapTokensForExactETH: async (
      amountOut: bigint,
      path: Address[],
      to: Address,
      deadline: bigint,
      privateKey: string
    ): Promise<Hash> => {
      try {
        logger.info('Swapping tokens for exact ETH');
        logger.debug('Amount out: %s', amountOut.toString());
        logger.debug('Path: %O', path);
        logger.debug('To: %s, Deadline: %s', to, deadline.toString());

        const hash = await contractHelpers.callWriteFunction(
          PANCAKESWAP_ROUTER_ADDRESS,
          PANCAKESWAP_ROUTER_ABI_VIEM,
          'swapTokensForExactETH',
          [amountOut, path, to, deadline],
          privateKey
        );

        logger.info('Token to ETH swap executed successfully: %s', hash);
        return hash;
      } catch (error) {
        logger.error('Failed to swap tokens for exact ETH: %O', error);
        throw new Error(`Token to ETH swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    swapExactTokensForETH: async (
      amountIn: bigint,
      amountOutMin: bigint,
      path: Address[],
      to: Address,
      deadline: bigint,
      privateKey: string
    ): Promise<Hash> => {
      try {
        logger.info('Swapping exact tokens for ETH');
        logger.debug('Amount in: %s, Amount out min: %s', amountIn.toString(), amountOutMin.toString());
        logger.debug('Path: %O', path);
        logger.debug('To: %s, Deadline: %s', to, deadline.toString());

        const hash = await contractHelpers.callWriteFunction(
          PANCAKESWAP_ROUTER_ADDRESS,
          PANCAKESWAP_ROUTER_ABI_VIEM,
          'swapExactTokensForETH',
          [amountIn, amountOutMin, path, to, deadline],
          privateKey
        );

        logger.info('Token to ETH swap executed successfully: %s', hash);
        return hash;
      } catch (error) {
        logger.error('Failed to swap exact tokens for ETH: %O', error);
        throw new Error(`Token to ETH swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    swapETHForExactTokens: async (
      amountOut: bigint,
      path: Address[],
      to: Address,
      deadline: bigint,
      privateKey: string,
      value: bigint
    ): Promise<Hash> => {
      try {
        logger.info('Swapping ETH for exact tokens');
        logger.debug('Amount out: %s, Value: %s', amountOut.toString(), value.toString());
        logger.debug('Path: %O', path);
        logger.debug('To: %s, Deadline: %s', to, deadline.toString());

        const walletClient = provider.createWalletClient(privateKey);
        const publicClient = provider.getHttpClient();

        // Build transaction for ETH swap
        const { request } = await publicClient.simulateContract({
          address: PANCAKESWAP_ROUTER_ADDRESS,
          abi: PANCAKESWAP_ROUTER_ABI_VIEM,
          functionName: 'swapETHForExactTokens',
          args: [amountOut, path, to, deadline],
          account: walletClient.account,
          value,
        });

        const hash = await walletClient.writeContract(request);
        logger.info('ETH to token swap executed successfully: %s', hash);
        return hash;
      } catch (error) {
        logger.error('Failed to swap ETH for exact tokens: %O', error);
        throw new Error(`ETH swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Liquidity operations
    addLiquidity: async (
      tokenA: Address,
      tokenB: Address,
      amountADesired: bigint,
      amountBDesired: bigint,
      amountAMin: bigint,
      amountBMin: bigint,
      to: Address,
      deadline: bigint,
      privateKey: string
    ): Promise<readonly [bigint, bigint, bigint]> => {
      try {
        logger.info('Adding liquidity');
        logger.debug('Tokens: %s <-> %s', tokenA, tokenB);
        logger.debug('Amounts desired: A=%s, B=%s', amountADesired.toString(), amountBDesired.toString());
        logger.debug('Minimum amounts: A=%s, B=%s', amountAMin.toString(), amountBMin.toString());

        const hash = await contractHelpers.callWriteFunction(
          PANCAKESWAP_ROUTER_ADDRESS,
          PANCAKESWAP_ROUTER_ABI_VIEM,
          'addLiquidity',
          [tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline],
          privateKey
        );

        // Wait for transaction and get receipt to extract return values
        const publicClient = provider.getHttpClient();
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        // Note: In a real implementation, you would need to parse the logs to get the return values
        // For now, return placeholder values
        logger.info('Liquidity added successfully: %s', hash);
        return [amountADesired, amountBDesired, BigInt(0)];
      } catch (error) {
        logger.error('Failed to add liquidity: %O', error);
        throw new Error(`Add liquidity failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    addLiquidityETH: async (
      token: Address,
      amountTokenDesired: bigint,
      amountTokenMin: bigint,
      amountETHMin: bigint,
      to: Address,
      deadline: bigint,
      privateKey: string,
      value: bigint
    ): Promise<readonly [bigint, bigint, bigint]> => {
      try {
        logger.info('Adding ETH liquidity');
        logger.debug('Token: %s', token);
        logger.debug('Amount token desired: %s, Value: %s', amountTokenDesired.toString(), value.toString());
        logger.debug('Minimum amounts: Token=%s, ETH=%s', amountTokenMin.toString(), amountETHMin.toString());

        const walletClient = provider.createWalletClient(privateKey);
        const publicClient = provider.getHttpClient();

        // Build transaction for adding ETH liquidity
        const { request } = await publicClient.simulateContract({
          address: PANCAKESWAP_ROUTER_ADDRESS,
          abi: PANCAKESWAP_ROUTER_ABI_VIEM,
          functionName: 'addLiquidityETH',
          args: [token, amountTokenDesired, amountTokenMin, amountETHMin, to, deadline],
          account: walletClient.account,
          value,
        });

        const hash = await walletClient.writeContract(request);
        logger.info('ETH liquidity added successfully: %s', hash);
        return [amountTokenDesired, value, BigInt(0)];
      } catch (error) {
        logger.error('Failed to add ETH liquidity: %O', error);
        throw new Error(`Add ETH liquidity failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    removeLiquidity: async (
      tokenA: Address,
      tokenB: Address,
      liquidity: bigint,
      amountAMin: bigint,
      amountBMin: bigint,
      to: Address,
      deadline: bigint,
      privateKey: string
    ): Promise<readonly [bigint, bigint]> => {
      try {
        logger.info('Removing liquidity');
        logger.debug('Tokens: %s <-> %s', tokenA, tokenB);
        logger.debug('Liquidity: %s', liquidity.toString());
        logger.debug('Minimum amounts: A=%s, B=%s', amountAMin.toString(), amountBMin.toString());

        const hash = await contractHelpers.callWriteFunction(
          PANCAKESWAP_ROUTER_ADDRESS,
          PANCAKESWAP_ROUTER_ABI_VIEM,
          'removeLiquidity',
          [tokenA, tokenB, liquidity, amountAMin, amountBMin, to, deadline],
          privateKey
        );

        logger.info('Liquidity removed successfully: %s', hash);
        return [amountAMin, amountBMin];
      } catch (error) {
        logger.error('Failed to remove liquidity: %O', error);
        throw new Error(`Remove liquidity failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    removeLiquidityETH: async (
      token: Address,
      liquidity: bigint,
      amountTokenMin: bigint,
      amountETHMin: bigint,
      to: Address,
      deadline: bigint,
      privateKey: string
    ): Promise<readonly [bigint, bigint]> => {
      try {
        logger.info('Removing ETH liquidity');
        logger.debug('Token: %s', token);
        logger.debug('Liquidity: %s', liquidity.toString());
        logger.debug('Minimum amounts: Token=%s, ETH=%s', amountTokenMin.toString(), amountETHMin.toString());

        const hash = await contractHelpers.callWriteFunction(
          PANCAKESWAP_ROUTER_ADDRESS,
          PANCAKESWAP_ROUTER_ABI_VIEM,
          'removeLiquidityETH',
          [token, liquidity, amountTokenMin, amountETHMin, to, deadline],
          privateKey
        );

        logger.info('ETH liquidity removed successfully: %s', hash);
        return [amountTokenMin, amountETHMin];
      } catch (error) {
        logger.error('Failed to remove ETH liquidity: %O', error);
        throw new Error(`Remove ETH liquidity failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    // Utility methods
    getRouterInfo: async (): Promise<{
      factory: Address;
      WETH: Address;
    }> => {
      try {
        const client = provider.getHttpClient();
        const [factory, WETH] = await Promise.all([
          client.readContract({
            address: PANCAKESWAP_ROUTER_ADDRESS,
            abi: PANCAKESWAP_ROUTER_ABI_VIEM,
            functionName: 'factory',
          }),
          client.readContract({
            address: PANCAKESWAP_ROUTER_ADDRESS,
            abi: PANCAKESWAP_ROUTER_ABI_VIEM,
            functionName: 'WETH',
          }),
        ]);

        return { factory: factory as Address, WETH: WETH as Address };
      } catch (error) {
        logger.error('Failed to get router info: %O', error);
        throw new Error(`Failed to get router info: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },

    estimateSwapGas: async (
      amountIn: bigint,
      amountOutMin: bigint,
      path: Address[],
      to: Address,
      deadline: bigint,
      privateKey: string
    ) => {
      try {
        const walletClient = provider.createWalletClient(privateKey);
        const publicClient = provider.getHttpClient();

        const gasEstimate = await publicClient.estimateContractGas({
          address: PANCAKESWAP_ROUTER_ADDRESS,
          abi: PANCAKESWAP_ROUTER_ABI_VIEM,
          functionName: 'swapExactTokensForTokens',
          args: [amountIn, amountOutMin, path, to, deadline],
          account: walletClient.account,
        });

        const gasPrice = await publicClient.getGasPrice();
        return {
          gas: gasEstimate,
          gasPrice,
          totalCost: gasEstimate * gasPrice,
        };
      } catch (error) {
        logger.error('Failed to estimate swap gas: %O', error);
        throw new Error(`Gas estimation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  };
}

/**
 * PancakeSwap Router Factory Class
 */
export class PancakeSwapRouterFactory {
  private static instances: Map<Address, PancakeSwapRouterViem> = new Map();

  /**
   * Get or create router instance (singleton pattern)
   */
  static getRouter(address?: Address): PancakeSwapRouterViem {
    const routerAddress = address || PANCAKESWAP_ROUTER_ADDRESS;

    if (!this.instances.has(routerAddress)) {
      const router = createPancakeSwapRouter();
      this.instances.set(routerAddress, router);
    }

    return this.instances.get(routerAddress)!;
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

export default createPancakeSwapRouter;