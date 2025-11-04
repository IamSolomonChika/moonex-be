import { Address, Hash, PublicClient, WalletClient, Abi } from 'viem';
import { getViemProvider } from '../providers/viem-provider';
import { estimateGasOptimized } from './viem-utils';
import { ERC20_ABI, PANCAKESWAP_ROUTER_ABI, PANCAKESWAP_PAIR_ABI } from '../../types/viem';
import logger from '../../utils/logger';

/**
 * Contract Interaction Helpers
 * Provides type-safe contract interaction utilities for Viem
 */

class ContractHelpers {
  private provider = getViemProvider();

  /**
   * Create a contract instance
   */
  public createContract<T extends Abi>(
    address: Address,
    abi: T,
    clientType: 'read' | 'write' = 'read'
  ): any {
    const client = clientType === 'read'
      ? this.provider.getHttpClient()
      : this.provider.createWalletClient('0x'); // Default account

    return {
      address,
      abi,
      client,
      read: this.createReadFunctions(address, abi, client as PublicClient),
      write: this.createWriteFunctions(address, abi, client as WalletClient),
    };
  }

  /**
   * Create ERC20 contract helpers
   */
  public createERC20Contract(tokenAddress: Address) {
    const contract = this.createContract(tokenAddress, ERC20_ABI, 'read');

    return {
      ...contract,

      // Token info
      getName: () => this.callReadFunction(tokenAddress, ERC20_ABI, 'name'),
      getSymbol: () => this.callReadFunction(tokenAddress, ERC20_ABI, 'symbol'),
      getDecimals: () => this.callReadFunction(tokenAddress, ERC20_ABI, 'decimals'),
      getTotalSupply: () => this.callReadFunction(tokenAddress, ERC20_ABI, 'totalSupply'),

      // Balance operations
      getBalance: (owner: Address) => this.callReadFunction(tokenAddress, ERC20_ABI, 'balanceOf', [owner]),
      getAllowance: (owner: Address, spender: Address) =>
        this.callReadFunction(tokenAddress, ERC20_ABI, 'allowance', [owner, spender]),

      // Write operations
      approve: (spender: Address, amount: bigint, privateKey: string) =>
        this.callWriteFunction(tokenAddress, ERC20_ABI, 'approve', [spender, amount], privateKey),
      transfer: (to: Address, amount: bigint, privateKey: string) =>
        this.callWriteFunction(tokenAddress, ERC20_ABI, 'transfer', [to, amount], privateKey),
      transferFrom: (from: Address, to: Address, amount: bigint, privateKey: string) =>
        this.callWriteFunction(tokenAddress, ERC20_ABI, 'transferFrom', [from, to, amount], privateKey),
    };
  }

  /**
   * Create PancakeSwap Router contract helpers
   */
  public createPancakeSwapRouter(routerAddress: Address) {
    const contract = this.createContract(routerAddress, PANCAKESWAP_ROUTER_ABI, 'read');

    return {
      ...contract,

      // Quote functions
      getAmountsOut: (amountIn: bigint, path: Address[]) =>
        this.callReadFunction(routerAddress, PANCAKESWAP_ROUTER_ABI, 'getAmountsOut', [amountIn, path]),
      getAmountsIn: (amountOut: bigint, path: Address[]) =>
        this.callReadFunction(routerAddress, PANCAKESWAP_ROUTER_ABI, 'getAmountsIn', [amountOut, path]),

      // Trading functions
      swapExactTokensForTokens: (
        amountIn: bigint,
        amountOutMin: bigint,
        path: Address[],
        to: Address,
        deadline: bigint,
        privateKey: string
      ) =>
        this.callWriteFunction(
          routerAddress,
          PANCAKESWAP_ROUTER_ABI,
          'swapExactTokensForTokens',
          [amountIn, amountOutMin, path, to, deadline],
          privateKey
        ),

      swapTokensForExactTokens: (
        amountOut: bigint,
        amountInMax: bigint,
        path: Address[],
        to: Address,
        deadline: bigint,
        privateKey: string
      ) =>
        this.callWriteFunction(
          routerAddress,
          PANCAKESWAP_ROUTER_ABI,
          'swapTokensForExactTokens',
          [amountOut, amountInMax, path, to, deadline],
          privateKey
        ),
    };
  }

  /**
   * Create PancakeSwap Pair contract helpers
   */
  public createPancakeSwapPair(pairAddress: Address) {
    const contract = this.createContract(pairAddress, PANCAKESWAP_PAIR_ABI, 'read');

    return {
      ...contract,

      // Pair info
      getReserves: () => this.callReadFunction(pairAddress, PANCAKESWAP_PAIR_ABI, 'getReserves'),
      getToken0: () => this.callReadFunction(pairAddress, PANCAKESWAP_PAIR_ABI, 'token0'),
      getToken1: () => this.callReadFunction(pairAddress, PANCAKESWAP_PAIR_ABI, 'token1'),
      getTotalSupply: () => this.callReadFunction(pairAddress, PANCAKESWAP_PAIR_ABI, 'totalSupply'),
      getBalance: (owner: Address) => this.callReadFunction(pairAddress, PANCAKESWAP_PAIR_ABI, 'balanceOf', [owner]),
    };
  }

  /**
   * Generic read function call
   */
  public async callReadFunction<T extends readonly unknown[]>(
    contractAddress: Address,
    abi: Abi,
    functionName: string,
    args?: T
  ): Promise<any> {
    try {
      const client = this.provider.getHttpClient();

      logger.debug('Calling read function: %s on contract: %s', functionName, contractAddress);

      const result = await client.readContract({
        address: contractAddress,
        abi,
        functionName,
        args,
      });

      logger.debug('Read function %s result: %O', functionName, result);
      return result;
    } catch (error) {
      logger.error('Read function %s failed: %O', functionName, error);
      throw new Error(`Contract read function ${functionName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generic write function call
   */
  public async callWriteFunction<T extends readonly unknown[]>(
    contractAddress: Address,
    abi: Abi,
    functionName: string,
    args: T,
    privateKey: string
  ): Promise<Hash> {
    try {
      const walletClient = this.provider.createWalletClient(privateKey);
      const publicClient = this.provider.getHttpClient();

      logger.debug('Calling write function: %s on contract: %s', functionName, contractAddress);

      // Build transaction
      const { request } = await publicClient.simulateContract({
        address: contractAddress,
        abi,
        functionName,
        args,
        account: walletClient.account,
      });

      // Execute transaction
      const hash = await walletClient.writeContract(request);

      logger.info('Write function %s executed, tx hash: %s', functionName, hash);
      return hash;
    } catch (error) {
      logger.error('Write function %s failed: %O', functionName, error);
      throw new Error(`Contract write function ${functionName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch read calls
   */
  public async batchReadCalls(calls: Array<{
    contractAddress: Address;
    abi: Abi;
    functionName: string;
    args?: readonly unknown[];
  }>) {
    try {
      const client = this.provider.getHttpClient();

      const multicallResults = await client.multicall({
        contracts: calls.map(call => ({
          address: call.contractAddress,
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
      logger.error('Batch read calls failed: %O', error);
      throw error;
    }
  }

  /**
   * Get contract ABI functions info
   */
  public getContractFunctions(abi: Abi): Array<{
    name: string;
    type: 'function';
    stateMutability: 'view' | 'pure' | 'nonpayable' | 'payable';
    inputs: Array<{ name: string; type: string }>;
    outputs: Array<{ name: string; type: string }>;
  }> {
    return abi
      .filter(item => item.type === 'function')
      .map(item => ({
        name: item.name,
        type: item.type,
        stateMutability: item.stateMutability,
        inputs: item.inputs || [],
        outputs: item.outputs || [],
      }));
  }

  /**
   * Check if function is read-only
   */
  public isReadOnlyFunction(abi: Abi, functionName: string): boolean {
    const functionInfo = abi.find(item =>
      item.type === 'function' && item.name === functionName
    );

    if (!functionInfo) return false;

    return functionInfo.stateMutability === 'view' || functionInfo.stateMutability === 'pure';
  }

  /**
   * Estimate gas for contract function call
   */
  public async estimateContractCallGas<T extends readonly unknown[]>(
    contractAddress: Address,
    abi: Abi,
    functionName: string,
    args: T,
    privateKey: string
  ) {
    try {
      const walletClient = this.provider.createWalletClient(privateKey);
      const publicClient = this.provider.getHttpClient();

      const { request } = await publicClient.simulateContract({
        address: contractAddress,
        abi,
        functionName,
        args,
        account: walletClient.account,
      });

      return estimateGasOptimized(request);
    } catch (error) {
      logger.error('Gas estimation for contract call failed: %O', error);
      throw error;
    }
  }

  /**
   * Create read functions helper
   */
  private createReadFunctions(address: Address, abi: Abi, client: PublicClient) {
    const readFunctions: Record<string, (...args: any[]) => Promise<any>> = {};

    abi.forEach(item => {
      if (item.type === 'function' &&
          (item.stateMutability === 'view' || item.stateMutability === 'pure')) {
        readFunctions[item.name] = (...args: any[]) =>
          client.readContract({
            address,
            abi,
            functionName: item.name,
            args,
          });
      }
    });

    return readFunctions;
  }

  /**
   * Create write functions helper
   */
  private createWriteFunctions(address: Address, abi: Abi, client: WalletClient) {
    const writeFunctions: Record<string, (...args: any[]) => Promise<Hash>> = {};

    abi.forEach(item => {
      if (item.type === 'function' &&
          item.stateMutability !== 'view' &&
          item.stateMutability !== 'pure') {
        writeFunctions[item.name] = (...args: any[]) =>
          client.writeContract({
            address,
            abi,
            functionName: item.name,
            args,
          });
      }
    });

    return writeFunctions;
  }
}

// Singleton instance
let contractHelpers: ContractHelpers | null = null;

/**
 * Get contract helpers singleton instance
 */
export const getContractHelpers = (): ContractHelpers => {
  if (!contractHelpers) {
    contractHelpers = new ContractHelpers();
  }
  return contractHelpers;
};

// Convenience exports
export const createContract = <T extends Abi>(
  address: Address,
  abi: T,
  clientType: 'read' | 'write' = 'read'
) => getContractHelpers().createContract(address, abi, clientType);

export const callReadFunction = <T extends readonly unknown[]>(
  contractAddress: Address,
  abi: Abi,
  functionName: string,
  args?: T
) => getContractHelpers().callReadFunction(contractAddress, abi, functionName, args);

export const callWriteFunction = <T extends readonly unknown[]>(
  contractAddress: Address,
  abi: Abi,
  functionName: string,
  args: T,
  privateKey: string
) => getContractHelpers().callWriteFunction(contractAddress, abi, functionName, args, privateKey);

export const createERC20Contract = (tokenAddress: Address) =>
  getContractHelpers().createERC20Contract(tokenAddress);

export const createPancakeSwapRouter = (routerAddress: Address) =>
  getContractHelpers().createPancakeSwapRouter(routerAddress);

export const createPancakeSwapPair = (pairAddress: Address) =>
  getContractHelpers().createPancakeSwapPair(pairAddress);

export { ContractHelpers };
export default getContractHelpers;