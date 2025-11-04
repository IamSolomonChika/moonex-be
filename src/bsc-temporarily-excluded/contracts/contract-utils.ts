/**
 * Contract Utility Functions
 * Helper functions for BSC contract interactions
 */

import { ethers } from 'ethers';

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
 * Validate contract address
 */
export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address);
}

/**
 * Get transaction receipt with timeout
 */
export async function getTransactionReceipt(
  provider: ethers.Provider,
  hash: string,
  timeout: number = 30000
): Promise<ethers.TransactionReceipt | null> {
  try {
    return await provider.getTransactionReceipt(hash);
  } catch (error) {
    throw new Error(`Failed to get transaction receipt: ${error}`);
  }
}

/**
 * Estimate gas for transaction
 */
export async function estimateGas(
  contract: ethers.Contract,
  method: string,
  args: any[] = [],
  overrides: any = {}
): Promise<bigint> {
  try {
    const gasEstimate = await contract[method](...args, { gasLimit: undefined, ...overrides });
    return BigInt(gasEstimate.toString());
  } catch (error) {
    throw new Error(`Failed to estimate gas: ${error}`);
  }
}