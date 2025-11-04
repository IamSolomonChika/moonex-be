/**
 * Contract Utility Functions for Viem (Simplified)
 * Migrated from Ethers.js to Viem
 * Helper functions for BSC contract interactions
 */

import { Address, Hash, Hex } from 'viem';
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
  try {
    return BigInt(amount);
  } catch (error) {
    // Return 0 for invalid input instead of throwing
    return 0n;
  }
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
 * Estimate gas for contract call using Viem (simplified)
 */
export async function estimateGas(
  client: any,
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
    // Return fallback gas estimate
    return BigInt(210000); // Standard gas limit for simple transfers
  }
}

/**
 * Execute contract read call (simplified)
 */
export async function executeContractRead(
  client: any,
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
    });

    return result;
  } catch (error) {
    logger.error(`Failed to execute contract read ${functionName}: ${error}`);
    throw new Error(`Failed to execute contract read: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Execute contract write call (simplified)
 */
export async function executeContractWrite(
  publicClient: any,
  walletClient: any,
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
 * Wait for transaction confirmation (simplified)
 */
export async function waitForTransaction(
  client: any,
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
 * Batch multicall for multiple contract reads (simplified)
 */
export async function batchMulticall(
  client: any,
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
    // Simple implementation - execute calls individually
    const results = [];
    for (const call of calls) {
      try {
        const result = await executeContractRead(
          client,
          call.address,
          call.abi,
          call.functionName,
          call.args
        );
        results.push({
          success: true,
          result,
          call,
        });
      } catch (error) {
        if (allowFailure) {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            call,
          });
        } else {
          throw error;
        }
      }
    }

    return results;
  } catch (error) {
    logger.error(`Batch multicall failed: ${error}`);
    throw new Error(`Batch multicall failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get contract creation bytecode (simplified)
 */
export async function getContractBytecode(
  client: any,
  address: Address
): Promise<Hash> {
  try {
    const bytecode = await client.getBytecode({ address });
    return bytecode;
  } catch (error) {
    logger.error(`Failed to get contract bytecode for ${address}: ${error}`);
    return '0x' as Hash;
  }
}

/**
 * Check if address is a contract (simplified)
 */
export async function isContract(
  client: any,
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
    gasFeeETH: (Number(gasFee) / 1e18).toFixed(18),
    totalCostETH: (Number(totalCost) / 1e18).toFixed(18),
  };
}

/**
 * Format gas price to Gwei (simplified)
 */
export function formatGasPrice(gasPrice: bigint): string {
  return (Number(gasPrice) / 1e9).toFixed(2); // Convert to Gwei
}

/**
 * Parse gas price from Gwei to Wei (simplified)
 */
export function parseGasPrice(gasPriceGwei: string | number): bigint {
  return BigInt(Math.floor(Number(gasPriceGwei) * 1e9));
}

/**
 * Get current gas price from network (simplified)
 */
export async function getCurrentGasPrice(
  client: any
): Promise<bigint> {
  try {
    const gasPrice = await client.getGasPrice();
    return gasPrice;
  } catch (error) {
    logger.error(`Failed to get current gas price: ${error}`);
    // Return fallback gas price
    return BigInt(20000000000); // 20 Gwei fallback
  }
}

/**
 * Get fee data for EIP-1559 transactions (simplified)
 */
export async function getFeeData(
  client: any
): Promise<{
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}> {
  try {
    const gasPrice = await client.getGasPrice();

    return {
      gasPrice,
      maxFeePerGas: gasPrice * BigInt(110) / BigInt(100), // 10% buffer
      maxPriorityFeePerGas: gasPrice / BigInt(10), // 10% of gas price
    };
  } catch (error) {
    logger.error(`Failed to get fee data: ${error}`);
    // Return fallback fee data
    return {
      gasPrice: BigInt(20000000000), // 20 Gwei fallback
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
 * Get current block number
 */
export async function getCurrentBlockNumber(
  client: any
): Promise<bigint> {
  try {
    const blockNumber = await client.getBlockNumber();
    return blockNumber;
  } catch (error) {
    logger.error(`Failed to get current block number: ${error}`);
    return BigInt(0);
  }
}

/**
 * Get transaction by hash
 */
export async function getTransaction(
  client: any,
  hash: Hash
): Promise<any> {
  try {
    const transaction = await client.getTransaction({ hash });
    return transaction;
  } catch (error) {
    logger.error(`Failed to get transaction ${hash}: ${error}`);
    throw new Error(`Failed to get transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert Hex string to Address
 */
export function hexToAddress(hex: string): Address {
  return hex as Address;
}

/**
 * Convert Address to Hex string
 */
export function addressToHex(address: Address): Hex {
  return address as Hex;
}

/**
 * Check if value is Hex
 */
export function isHex(value: string): boolean {
  return value.startsWith('0x') && /^[0-9a-fA-F]+$/.test(value.slice(2));
}

/**
 * Pad hex string to even length
 */
export function padHex(hex: string): Hex {
  if (hex.length % 2 === 1) {
    return `0${hex}` as Hex;
  }
  return hex as Hex;
}

export default {
  formatAmount,
  parseAmount,
  calculateGasPrice,
  isValidAddress,
  estimateGas,
  executeContractRead,
  executeContractWrite,
  waitForTransaction,
  batchMulticall,
  getContractBytecode,
  isContract,
  calculateTransactionCost,
  formatGasPrice,
  parseGasPrice,
  getCurrentGasPrice,
  getFeeData,
  validateContractResult,
  retryContractCall,
  getCurrentBlockNumber,
  getTransaction,
  hexToAddress,
  addressToHex,
  isHex,
  padHex,
};