/**
 * Simplified Viem Contract Helpers
 * Essential utility functions for Viem contract interactions with fallback mechanisms
 */

import {
  Address,
  Hash,
  Hex,
  Abi,
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  PublicClient,
  WalletClient,
  Chain,
  parseEther,
  formatEther,
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import logger from '../../utils/logger';

/**
 * Contract interaction result
 */
export interface ContractResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  gasUsed?: bigint;
  blockNumber?: bigint;
  transactionHash?: Hash;
}

/**
 * Batch contract call
 */
export interface BatchCall {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}

/**
 * Multicall result
 */
export interface MulticallResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Contract event filter
 */
export interface EventFilter {
  address?: Address | Address[];
  topics?: (string | string[] | null)[];
  fromBlock?: bigint | 'latest' | 'earliest';
  toBlock?: bigint | 'latest' | 'earliest';
}

/**
 * Contract event
 */
export interface ContractEvent {
  eventName: string;
  args?: any[];
  blockNumber?: bigint;
  transactionHash?: Hash;
  address?: Address;
}

/**
 * Create Viem public client
 */
export const createViemPublicClient = (chain?: Chain): PublicClient => {
  const currentChain = chain || (process.env.NODE_ENV === 'test' ? bscTestnet : bsc);
  const rpcUrl = currentChain.id === 56
    ? 'https://bsc-dataseed1.binance.org'
    : 'https://data-seed-prebsc-1-s1.binance.org:8545';

  return createPublicClient({
    chain: currentChain,
    transport: http(rpcUrl, {
      retryCount: 3,
      retryDelay: 1000,
      timeout: 30000,
    }),
  } as any);
};

/**
 * Create Viem wallet client
 */
export const createViemWalletClient = (
  privateKey: Hex,
  chain?: Chain
): WalletClient => {
  const currentChain = chain || (process.env.NODE_ENV === 'test' ? bscTestnet : bsc);
  const rpcUrl = currentChain.id === 56
    ? 'https://bsc-dataseed1.binance.org'
    : 'https://data-seed-prebsc-1-s1.binance.org:8545';

  return createWalletClient({
    chain: currentChain,
    transport: http(rpcUrl, {
      retryCount: 3,
      retryDelay: 1000,
      timeout: 30000,
    }),
    account: privateKey,
  } as any);
};

/**
 * Create Viem WebSocket client
 */
export const createViemWebSocketClient = (chain?: Chain): PublicClient => {
  const currentChain = chain || (process.env.NODE_ENV === 'test' ? bscTestnet : bsc);
  const wsUrl = currentChain.id === 56
    ? 'wss://bsc-ws-node.nariox.org:443'
    : 'wss://bsc-testnet-ws.nariox.org:443';

  return createPublicClient({
    chain: currentChain,
    transport: webSocket(wsUrl, {
      retryCount: 5,
      retryDelay: 2000,
    }),
  } as any);
};

/**
 * Read contract data
 */
export const readContract = async <T = any>(
  contractAddress: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = [],
  client?: PublicClient
): Promise<ContractResult<T>> => {
  try {
    const publicClient = client || createViemPublicClient();

    logger.debug('Reading contract: %s, function: %s', contractAddress, functionName);

    const result = await (publicClient as any).readContract({
      address: contractAddress,
      abi,
      functionName,
      args,
      authorizationList: [],
    });

    logger.debug('Contract read successful: %s', functionName);

    return {
      success: true,
      data: result as T,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Contract read failed: %s', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Write contract data
 */
export const writeContract = async <T = any>(
  contractAddress: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = [],
  privateKey: Hex,
  value?: bigint,
  client?: WalletClient
): Promise<ContractResult<T>> => {
  try {
    const walletClient = client || createViemWalletClient(privateKey);

    logger.debug('Writing contract: %s, function: %s', contractAddress, functionName);

    const request = await (walletClient as any).prepareTransactionRequest({
      account: walletClient.account,
      to: contractAddress,
      data: (walletClient as any).encodeFunctionData({
        abi,
        functionName,
        args,
      }),
      value,
      kzg: undefined,
    });

    const hash = await (walletClient as any).sendTransaction(request);

    logger.debug('Contract write successful: %s, hash: %s', functionName, hash);

    return {
      success: true,
      data: hash as T,
      transactionHash: hash,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Contract write failed: %s', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Simulate contract transaction
 */
export const simulateContract = async <T = any>(
  contractAddress: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = [],
  account: Address,
  value?: bigint,
  client?: PublicClient
): Promise<ContractResult<T>> => {
  try {
    const publicClient = client || createViemPublicClient();

    logger.debug('Simulating contract: %s, function: %s', contractAddress, functionName);

    const result = await (publicClient as any).simulateContract({
      account,
      to: contractAddress,
      data: (publicClient as any).encodeFunctionData({
        abi,
        functionName,
        args,
      }),
      value,
    });

    logger.debug('Contract simulation successful: %s', functionName);

    return {
      success: true,
      data: result.result as T,
      gasUsed: result.gas,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Contract simulation failed: %s', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Batch read contract calls (multicall)
 */
export const batchReadContracts = async <T = any>(
  calls: BatchCall[],
  client?: PublicClient
): Promise<ContractResult<MulticallResult<T>[]>> => {
  try {
    const publicClient = client || createViemPublicClient();

    logger.debug('Batch reading contracts: %d calls', calls.length);

    const results = await (publicClient as any).multicall({
      contracts: calls.map(call => ({
        address: call.address,
        abi: call.abi,
        functionName: call.functionName,
        args: call.args || [],
      })),
      allowFailure: true,
      authorizationList: [],
    });

    const multicallResults: MulticallResult<T>[] = results.map((result: any) => ({
      success: result.status === 'success',
      data: result.status === 'success' ? result.result as T : undefined,
      error: result.status === 'failure' ? result.error?.message : undefined,
    }));

    const successCount = multicallResults.filter(r => r.success).length;
    logger.debug('Batch read completed: %d/%d successful', successCount, calls.length);

    return {
      success: true,
      data: multicallResults,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Batch contract read failed: %s', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Get contract events
 */
export const getContractEvents = async <T = any>(
  contractAddress: Address,
  abi: Abi,
  eventName: string,
  filter: EventFilter = {},
  client?: PublicClient
): Promise<ContractResult<ContractEvent[]>> => {
  try {
    const publicClient = client || createViemPublicClient();

    logger.debug('Getting contract events: %s, event: %s', contractAddress, eventName);

    const events = await (publicClient as any).getContractEvents({
      address: contractAddress,
      abi,
      eventName,
      fromBlock: filter.fromBlock,
      toBlock: filter.toBlock,
    });

    const formattedEvents: ContractEvent[] = events.map((event: any) => ({
      eventName,
      args: event.args,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      address: event.address,
    }));

    logger.debug('Retrieved %d events for %s', formattedEvents.length, eventName);

    return {
      success: true,
      data: formattedEvents,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Get contract events failed: %s', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Watch contract events
 */
export const watchContractEvents = (
  contractAddress: Address,
  abi: Abi,
  eventName: string,
  callback: (event: ContractEvent) => void,
  filter: EventFilter = {},
  client?: PublicClient
): (() => void) => {
  const publicClient = client || createViemPublicClient();

  logger.debug('Watching contract events: %s, event: %s', contractAddress, eventName);

  const unwatch = (publicClient as any).watchContractEvent({
    address: contractAddress,
    abi,
    eventName,
    onLogs: (logs: any[]) => {
      logs.forEach((log: any) => {
        const event: ContractEvent = {
          eventName,
          args: log.args,
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          address: log.address,
        };
        callback(event);
      });
    },
    fromBlock: typeof filter.fromBlock === 'bigint' ? filter.fromBlock : undefined,
  });

  return unwatch;
};

/**
 * Get transaction receipt
 */
export const getTransactionReceipt = async (
  transactionHash: Hash,
  client?: PublicClient
): Promise<ContractResult<any>> => {
  try {
    const publicClient = client || createViemPublicClient();

    logger.debug('Getting transaction receipt: %s', transactionHash);

    const receipt = await (publicClient as any).getTransactionReceipt({ hash: transactionHash });

    logger.debug('Transaction receipt retrieved: %s', transactionHash);

    return {
      success: true,
      data: receipt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Get transaction receipt failed: %s', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Wait for transaction
 */
export const waitForTransaction = async (
  transactionHash: Hash,
  confirmations: number = 1,
  timeout: number = 60000,
  client?: PublicClient
): Promise<ContractResult<any>> => {
  try {
    const publicClient = client || createViemPublicClient();

    logger.debug('Waiting for transaction: %s, confirmations: %d', transactionHash, confirmations);

    const receipt = await (publicClient as any).waitForTransactionReceipt({
      hash: transactionHash,
      confirmations,
      timeout,
    });

    logger.debug('Transaction confirmed: %s', transactionHash);

    return {
      success: true,
      data: receipt,
      gasUsed: receipt.gasUsed,
      blockNumber: receipt.blockNumber,
      transactionHash: receipt.transactionHash,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Wait for transaction failed: %s', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Estimate gas for contract call
 */
export const estimateContractGas = async (
  contractAddress: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = [],
  account: Address,
  value?: bigint,
  client?: PublicClient
): Promise<ContractResult<bigint>> => {
  try {
    const publicClient = client || createViemPublicClient();

    logger.debug('Estimating gas for contract: %s, function: %s', contractAddress, functionName);

    const gasEstimate = await (publicClient as any).estimateContractGas({
      account,
      to: contractAddress,
      data: (publicClient as any).encodeFunctionData({
        abi,
        functionName,
        args,
      }),
      value,
      authorizationList: [],
    });

    logger.debug('Gas estimate: %s', gasEstimate.toString());

    return {
      success: true,
      data: gasEstimate,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gas estimation failed: %s', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Get current gas price
 */
export const getCurrentGasPrice = async (client?: PublicClient): Promise<ContractResult<bigint>> => {
  try {
    const publicClient = client || createViemPublicClient();

    const gasPrice = await (publicClient as any).getGasPrice();

    return {
      success: true,
      data: gasPrice,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Get gas price failed: %s', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Format token amount
 */
export const formatTokenAmount = (
  amount: bigint,
  decimals: number = 18
): string => {
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = amount / divisor;
  const fractional = amount % divisor;

  const wholeStr = whole.toString();
  const fractionalStr = fractional.toString().padStart(decimals, '0').replace(/0+$/, '');

  return fractionalStr ? `${wholeStr}.${fractionalStr}` : wholeStr;
};

/**
 * Parse token amount
 */
export const parseTokenAmount = (
  amount: string,
  decimals: number = 18
): bigint => {
  const [whole, fractional = ''] = amount.split('.');
  const wholeBigInt = BigInt(whole || '0');
  const divisor = BigInt(10) ** BigInt(decimals);

  if (fractional.length > decimals) {
    throw new Error(`Fractional part exceeds ${decimals} decimal places`);
  }

  const fractionalBigInt = BigInt(fractional.padEnd(decimals, '0'));
  return (wholeBigInt * divisor) + fractionalBigInt;
};

/**
 * Check if address is a contract
 */
export const isContract = async (
  address: Address,
  client?: PublicClient
): Promise<ContractResult<boolean>> => {
  try {
    const publicClient = client || createViemPublicClient();

    const bytecode = await (publicClient as any).getBytecode({ address });

    return {
      success: true,
      data: bytecode !== '0x' && bytecode !== '0x0',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Check if address is contract failed: %s', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Validate contract ABI
 */
export const validateContractABI = (abi: Abi): ContractResult<boolean> => {
  try {
    if (!Array.isArray(abi)) {
      return {
        success: false,
        error: 'ABI must be an array',
      };
    }

    // Check for required properties in ABI items
    for (let i = 0; i < abi.length; i++) {
      const item = abi[i];

      if (typeof item !== 'object' || item === null) {
        return {
          success: false,
          error: `ABI item ${i} is not an object`,
        };
      }

      if (!item.type) {
        return {
          success: false,
          error: `ABI item ${i} missing type`,
        };
      }

      if (item.type === 'function' && !item.name) {
        return {
          success: false,
          error: `Function ABI item ${i} missing name`,
        };
      }

      if (item.type === 'event' && !item.name) {
        return {
          success: false,
          error: `Event ABI item ${i} missing name`,
        };
      }
    }

    return {
      success: true,
      data: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Validate contract ABI failed: %s', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Create a complete contract interaction helper
 */
export const createContractHelper = (
  contractAddress: Address,
  abi: Abi,
  privateKey?: Hex
) => {
  const publicClient = createViemPublicClient();
  const walletClient = privateKey ? createViemWalletClient(privateKey) : undefined;

  return {
    address: contractAddress,
    abi,

    // Read operations
    read: <T = any>(functionName: string, args: readonly unknown[] = []) =>
      readContract<T>(contractAddress, abi, functionName, args, publicClient),

    // Write operations
    write: <T = any>(functionName: string, args: readonly unknown[] = [], value?: bigint) => {
      if (!walletClient) {
        throw new Error('Wallet client not initialized - private key required');
      }
      return writeContract<T>(contractAddress, abi, functionName, args, privateKey!, value, walletClient);
    },

    // Simulation
    simulate: <T = any>(functionName: string, args: readonly unknown[] = [], account: Address, value?: bigint) =>
      simulateContract<T>(contractAddress, abi, functionName, args, account, value, publicClient),

    // Events
    getEvents: <T = any>(eventName: string, filter?: EventFilter) =>
      getContractEvents<T>(contractAddress, abi, eventName, filter, publicClient),

    watchEvents: (eventName: string, callback: (event: ContractEvent) => void, filter?: EventFilter) =>
      watchContractEvents(contractAddress, abi, eventName, callback, filter, publicClient),

    // Utilities
    isContract: () => isContract(contractAddress, publicClient),
    estimateGas: (functionName: string, args: readonly unknown[] = [], account: Address, value?: bigint) =>
      estimateContractGas(contractAddress, abi, functionName, args, account, value, publicClient),

    // Batch operations
    batchRead: <T = any>(calls: BatchCall[]) =>
      batchReadContracts<T>(calls, publicClient),
  };
};

/**
 * Export all helpers
 */
export default {
  // Client creation
  createViemPublicClient,
  createViemWalletClient,
  createViemWebSocketClient,

  // Contract operations
  readContract,
  writeContract,
  simulateContract,
  batchReadContracts,

  // Event handling
  getContractEvents,
  watchContractEvents,

  // Transaction handling
  getTransactionReceipt,
  waitForTransaction,

  // Gas utilities
  estimateContractGas,
  getCurrentGasPrice,

  // Token utilities
  formatTokenAmount,
  parseTokenAmount,

  // Contract utilities
  isContract,
  validateContractABI,

  // Helper factory
  createContractHelper,
};