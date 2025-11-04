/**
 * Contract Utility Functions for Viem
 * Migrated from Ethers.js to Viem
 * Helper functions for BSC contract interactions
 */

import { Address, Hash, PublicClient, WalletClient, Chain, parseEther, formatEther } from 'viem';
import { isAddress } from 'viem';
import logger from '../../utils/logger';

/**
 * Format amount to proper string representation
 */
export function formatAmount(amount: string | number | bigint): string {
  return amount.toString();
}

/**
 * Parse amount to BigInt
 */
export function parseAmount(amount: string | number): bigint {
  return BigInt(amount);
}

/**
 * Calculate gas price with buffer
 */
export function calculateGasPrice(basePrice: string | bigint, buffer: number = 1.1): bigint {
  return BigInt(Math.floor(Number(basePrice) * buffer));
}

/**
 * Validate contract address using Viem
 */
export function isValidAddress(address: string): boolean {
  try {
    return isAddress(address as Address);
  } catch {
    return false;
  }
}

/**
 * Get transaction receipt with timeout using Viem
 */
export async function getTransactionReceipt(
  client: PublicClient,
  hash: Hash,
  timeout: number = 30000
): Promise<any | null> {
  try {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const receipt = await client.getTransactionReceipt({ hash });
      if (receipt) {
        return receipt;
      }

      // Wait 1 second before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Timeout reached
    return null;
  } catch (error) {
    logger.error(`Failed to get transaction receipt: ${error}`);
    throw new Error(`Failed to get transaction receipt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Estimate gas for contract call using Viem
 */
export async function estimateGas(
  client: PublicClient,
  contractAddress: Address,
  abi: any[],
  functionName: string,
  args: any[] = [],
  account?: Address,
  value?: bigint
): Promise<bigint> {
  try {
    const gasEstimate = await client.estimateContractGas({
      address: contractAddress,
      abi,
      functionName,
      args,
      account,
      value,
    });

    return gasEstimate;
  } catch (error) {
    logger.error(`Failed to estimate gas for ${functionName}: ${error}`);
    throw new Error(`Failed to estimate gas: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Estimate gas for contract write operation
 */
export async function estimateContractWriteGas(
  publicClient: PublicClient,
  walletClient: WalletClient,
  contractAddress: Address,
  abi: any[],
  functionName: string,
  args: any[] = [],
  value?: bigint
): Promise<bigint> {
  try {
    const gasEstimate = await publicClient.estimateContractGas({
      address: contractAddress,
      abi,
      functionName,
      args,
      account: walletClient.account,
      value,
    });

    return gasEstimate;
  } catch (error) {
    logger.error(`Failed to estimate gas for contract write ${functionName}: ${error}`);
    throw new Error(`Failed to estimate gas: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Simulate contract call
 */
export async function simulateContractCall(
  publicClient: PublicClient,
  walletClient: WalletClient,
  contractAddress: Address,
  abi: any[],
  functionName: string,
  args: any[] = [],
  value?: bigint
): Promise<any> {
  try {
    const result = await publicClient.simulateContract({
      address: contractAddress,
      abi,
      functionName,
      args,
      account: walletClient.account,
      value,
    });

    return result;
  } catch (error) {
    logger.error(`Failed to simulate contract call ${functionName}: ${error}`);
    throw new Error(`Failed to simulate contract call: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Execute contract write call
 */
export async function executeContractWrite(
  publicClient: PublicClient,
  walletClient: WalletClient,
  contractAddress: Address,
  abi: any[],
  functionName: string,
  args: any[] = [],
  value?: bigint
): Promise<Hash> {
  try {
    // Simulate first
    const { request } = await publicClient.simulateContract({
      address: contractAddress,
      abi,
      functionName,
      args,
      account: walletClient.account,
      value,
    });

    // Execute transaction
    const hash = await walletClient.writeContract(request);

    logger.info(`Contract write ${functionName} executed, tx hash: ${hash}`);
    return hash;
  } catch (error) {
    logger.error(`Failed to execute contract write ${functionName}: ${error}`);
    throw new Error(`Failed to execute contract write: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Execute contract read call
 */
export async function executeContractRead(
  client: PublicClient,
  contractAddress: Address,
  abi: any[],
  functionName: string,
  args: any[] = []
): Promise<any> {
  try {
      const result = await client.readContract({
      address: contractAddress,
      abi,
      functionName,
      args,
    } as any);

    return result;
  } catch (error) {
    logger.error(`Failed to execute contract read ${functionName}: ${error}`);
    throw new Error(`Failed to execute contract read: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(
  client: PublicClient,
  hash: Hash,
  confirmations: number = 1,
  timeout: number = 60000
): Promise<any> {
  try {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const receipt = await client.getTransactionReceipt({ hash });

      if (receipt) {
        const currentBlock = await client.getBlockNumber();
        const confirmationBlocks = currentBlock - receipt.blockNumber;

        if (confirmationBlocks >= confirmations) {
          return receipt;
        }
      }

      // Wait 2 seconds before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error(`Transaction confirmation timeout after ${timeout}ms`);
  } catch (error) {
    logger.error(`Failed to wait for transaction ${hash}: ${error}`);
    throw new Error(`Failed to wait for transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Batch multicall for multiple contract reads
 */
export async function batchMulticall(
  client: PublicClient,
  calls: Array<{
    address: Address;
    abi: any[];
    functionName: string;
    args?: any[];
  }>,
  allowFailure: boolean = true
): Promise<Array<{
  success: boolean;
  result?: any;
  error?: string;
  call: any;
}>> {
  try {
    const multicallResults = await client.multicall({
      contracts: calls.map(call => ({
        address: call.address,
        abi: call.abi,
        functionName: call.functionName,
        args: call.args,
      })),
      allowFailure,
    });

    return multicallResults.map((result, index) => ({
      success: result.status === 'success',
      result: result.status === 'success' ? result.result : undefined,
      error: result.status === 'failure' ? result.error : undefined,
      call: calls[index],
    }));
  } catch (error) {
    logger.error(`Batch multicall failed: ${error}`);
    throw new Error(`Batch multicall failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get contract creation bytecode
 */
export async function getContractBytecode(
  client: PublicClient,
  address: Address
): Promise<Hash> {
  try {
    const bytecode = await client.getBytecode({ address });
    return bytecode;
  } catch (error) {
    logger.error(`Failed to get contract bytecode for ${address}: ${error}`);
    throw new Error(`Failed to get contract bytecode: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if address is a contract
 */
export async function isContract(
  client: PublicClient,
  address: Address
): Promise<boolean> {
  try {
    const bytecode = await client.getBytecode({ address });
    return bytecode !== '0x' && bytecode.length > 2;
  } catch (error) {
    return false;
  }
}

/**
 * Get contract storage slot
 */
export async function getStorageAt(
  client: PublicClient,
  address: Address,
  slot: string
): Promise<Hash> {
  try {
    const storage = await client.getStorageAt({ address, slot });
    return storage;
  } catch (error) {
    logger.error(`Failed to get storage at ${slot} for ${address}: ${error}`);
    throw new Error(`Failed to get storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate transaction cost
 */
export function calculateTransactionCost(
  gasUsed: bigint,
  gasPrice: bigint,
  value?: bigint
): {
  gasFee: bigint;
  totalCost: bigint;
  gasFeeETH: string;
  totalCostETH: string;
} {
  const gasFee = gasUsed * gasPrice;
  const totalCost = gasFee + (value || 0n);

  return {
    gasFee,
    totalCost,
    gasFeeETH: formatEther(gasFee),
    totalCostETH: formatEther(totalCost),
  };
}

/**
 * Format gas price to Gwei
 */
export function formatGasPrice(gasPrice: bigint): string {
  return formatEther(gasPrice * BigInt(10) ** BigInt(9)); // Convert to Gwei
}

/**
 * Parse gas price from Gwei to Wei
 */
export function parseGasPrice(gasPriceGwei: string | number): bigint {
  return parseEther(gasPriceGwei.toString()) / BigInt(10) ** BigInt(9);
}

/**
 * Get current gas price from network
 */
export async function getCurrentGasPrice(
  client: PublicClient
): Promise<bigint> {
  try {
    const gasPrice = await client.getGasPrice();
    return gasPrice;
  } catch (error) {
    logger.error(`Failed to get current gas price: ${error}`);
    // Return fallback gas price
    return parseEther('0.00000002'); // 20 Gwei fallback
  }
}

/**
 * Get fee data for EIP-1559 transactions
 */
export async function getFeeData(
  client: PublicClient
): Promise<{
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}> {
  try {
    const feeData = await client.getFeeHistory({
      blockCount: 1,
      rewardPercentiles: [25, 50, 75],
    });

    // Extract gas price and EIP-1559 fees
    const gasPrice = await client.getGasPrice();

    return {
      gasPrice,
      maxFeePerGas: feeData.baseFeePerGas[0] + (feeData.reward[0]?.[1] || 0n), // Use median priority fee
      maxPriorityFeePerGas: feeData.reward[0]?.[1] || 0n, // Use median priority fee
    };
  } catch (error) {
    logger.error(`Failed to get fee data: ${error}`);
    // Return fallback fee data
    return {
      gasPrice: parseEther('0.00000002'), // 20 Gwei fallback
    };
  }
}

/**
 * Contract call result validator
 */
export function validateContractResult<T>(
  result: any,
  expectedType?: string
): T {
  if (result === null || result === undefined) {
    throw new Error('Contract call returned null or undefined');
  }

  if (expectedType && typeof result !== expectedType) {
    throw new Error(`Expected ${expectedType}, got ${typeof result}`);
  }

  return result as T;
}

/**
 * Retry contract call with exponential backoff
 */
export async function retryContractCall<T>(
  call: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await call();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (attempt === maxRetries) {
        break;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn(`Contract call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms: ${lastError.message}`);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Contract call failed after retries');
}

/**
 * Batch execute multiple contract writes
 */
export async function batchContractWrites(
  writes: Array<{
    publicClient: PublicClient;
    walletClient: WalletClient;
    address: Address;
    abi: any[];
    functionName: string;
    args?: any[];
    value?: bigint;
  }>,
  options: {
    parallel?: boolean;
    delay?: number; // Delay between writes in ms
  } = {}
): Promise<Array<{
  hash?: Hash;
  error?: string;
  success: boolean;
}>> {
  const { parallel = false, delay = 0 } = options;

  if (parallel) {
    // Execute all writes in parallel
    const results = await Promise.allSettled(
      writes.map(async (write) => {
        try {
          const hash = await executeContractWrite(
            write.publicClient,
            write.walletClient,
            write.address,
            write.abi,
            write.functionName,
            write.args,
            write.value
          );
          return { hash, success: true };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false,
          };
        }
      })
    );

    return results.map(result =>
      result.status === 'fulfilled' ? result.value : { success: false, error: 'Unknown error' }
    );
  } else {
    // Execute writes sequentially
    const results: Array<{
      hash?: Hash;
      error?: string;
      success: boolean;
    }> = [];

    for (const write of writes) {
      try {
        const hash = await executeContractWrite(
          write.publicClient,
          write.walletClient,
          write.address,
          write.abi,
          write.functionName,
          write.args,
          write.value
        );
        results.push({ hash, success: true });

        // Add delay between writes if specified
        if (delay > 0 && writes.indexOf(write) < writes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        results.push({
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false,
        });
      }
    }

    return results;
  }
}

/**
 * Contract event subscription helper
 */
export function subscribeToContractEvent(
  client: PublicClient,
  address: Address,
  abi: any[],
  eventName: string,
  callback: (logs: any[]) => void,
  options: {
    fromBlock?: bigint;
    toBlock?: bigint;
  } = {}
): () => void {
  const unwatch = client.watchContractEvent({
    address,
    abi,
    eventName,
    onLogs: callback,
    fromBlock: options.fromBlock,
    toBlock: options.toBlock,
  });

  return unwatch;
}

/**
 * Get historical contract events
 */
export async function getContractEvents(
  client: PublicClient,
  address: Address,
  abi: any[],
  eventName: string,
  options: {
    fromBlock?: bigint;
    toBlock?: bigint;
    args?: any;
  } = {}
): Promise<any[]> {
  try {
    const events = await client.getContractEvents({
      address,
      abi,
      eventName,
      args: options.args,
      fromBlock: options.fromBlock,
      toBlock: options.toBlock,
    });

    return events;
  } catch (error) {
    logger.error(`Failed to get contract events ${eventName}: ${error}`);
    throw new Error(`Failed to get contract events: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export default {
  formatAmount,
  parseAmount,
  calculateGasPrice,
  isValidAddress,
  getTransactionReceipt,
  estimateGas,
  estimateContractWriteGas,
  simulateContractCall,
  executeContractWrite,
  executeContractRead,
  waitForTransaction,
  batchMulticall,
  getContractBytecode,
  isContract,
  getStorageAt,
  calculateTransactionCost,
  formatGasPrice,
  parseGasPrice,
  getCurrentGasPrice,
  getFeeData,
  validateContractResult,
  retryContractCall,
  batchContractWrites,
  subscribeToContractEvent,
  getContractEvents,
};