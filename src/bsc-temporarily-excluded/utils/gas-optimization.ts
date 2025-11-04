import { ethers, JsonRpcProvider } from 'ethers';
import { bscConfig } from '../config';

/**
 * Gas configuration for BSC operations
 */
export interface GasConfig {
  maxGasPrice: bigint; // in wei
  defaultGasLimit: number;
  gasMultiplier: number;
  priorityFee?: bigint; // for EIP-1559 transactions (not used on BSC)
}

/**
 * Transaction gas estimate
 */
export interface GasEstimate {
  gasLimit: number;
  gasPrice: bigint;
  maxFeePerGas?: bigint; // Not used on BSC but kept for compatibility
  maxPriorityFeePerGas?: bigint; // Not used on BSC but kept for compatibility
  totalCost: bigint; // in wei
  totalCostBNB: string; // formatted BNB
  totalCostUSD?: string; // if BNB price is available
}

/**
 * BSC Gas Optimization Manager
 * Handles gas estimation, optimization, and cost calculation for BSC transactions
 */
export class BSCGasManager {
  private bnbPriceUSD: number = 0; // Cached BNB price in USD
  private lastPriceUpdate: number = 0;
  private readonly PRICE_UPDATE_INTERVAL = 60000; // 1 minute

  /**
   * Get current gas configuration
   */
  public getGasConfig(): GasConfig {
    return {
      maxGasPrice: ethers.parseEther(bscConfig.gasConfig.maxGasPrice),
      defaultGasLimit: bscConfig.gasConfig.defaultGasLimit,
      gasMultiplier: bscConfig.gasConfig.gasMultiplier,
    };
  }

  /**
   * Estimate gas for a transaction
   */
  public async estimateGas(
    transaction: {
      to?: string;
      data?: string;
      value?: string | number;
      from?: string;
    },
    provider: JsonRpcProvider
  ): Promise<GasEstimate> {
    const gasConfig = this.getGasConfig();

    try {
      // Get current gas price from BSC network
      const feeData = await provider.getFeeData();
      let gasPrice = feeData.gasPrice || ethers.parseUnits('5', 'gwei'); // fallback to 5 gwei

      // Ensure gas price doesn't exceed maximum
      if (gasPrice > gasConfig.maxGasPrice) {
        gasPrice = gasConfig.maxGasPrice;
      }

      // Apply gas multiplier for safety margin
      gasPrice = (gasPrice * BigInt(Math.floor(gasConfig.gasMultiplier * 100))) / BigInt(100);

      // Estimate gas limit
      let gasLimit: number;
      try {
        const estimatedGas = await provider.estimateGas(transaction);
        gasLimit = Math.ceil(Number(estimatedGas) * gasConfig.gasMultiplier);
      } catch (error) {
        console.warn('Gas estimation failed, using default:', error);
        gasLimit = gasConfig.defaultGasLimit;
      }

      // Calculate total cost
      const totalCost = gasPrice * BigInt(gasLimit);
      const totalCostBNB = ethers.formatEther(totalCost);

      // Update BNB price if needed
      await this.updateBNBPrice();

      return {
        gasLimit,
        gasPrice,
        totalCost,
        totalCostBNB,
        totalCostUSD: this.bnbPriceUSD > 0
          ? `$${(parseFloat(totalCostBNB) * this.bnbPriceUSD).toFixed(4)}`
          : undefined,
      };
    } catch (error) {
      console.error('Gas estimation failed:', error);
      throw new Error(`Failed to estimate gas: ${error}`);
    }
  }

  /**
   * Optimize gas settings for different transaction types
   */
  public optimizeGasForTransactionType(
    type: 'swap' | 'liquidity' | 'approval' | 'simple'
  ): Partial<GasConfig> {
    const baseConfig = this.getGasConfig();

    switch (type) {
      case 'swap':
        // Swaps need timely execution but not excessive gas
        return {
          gasMultiplier: 1.1,
          defaultGasLimit: 250000, // Standard for PancakeSwap swaps
        };

      case 'liquidity':
        // Liquidity operations can be gas-heavy
        return {
          gasMultiplier: 1.2,
          defaultGasLimit: 400000, // Higher for liquidity operations
        };

      case 'approval':
        // Approvals are simple and can use lower gas
        return {
          gasMultiplier: 1.0,
          defaultGasLimit: 100000, // Lower for approvals
        };

      case 'simple':
      default:
        return {
          gasMultiplier: 1.05,
          defaultGasLimit: baseConfig.defaultGasLimit,
        };
    }
  }

  /**
   * Get optimal gas price based on network conditions
   */
  public async getOptimalGasPrice(provider: JsonRpcProvider): Promise<bigint> {
    try {
      const feeData = await provider.getFeeData();
      let gasPrice = feeData.gasPrice || ethers.parseUnits('5', 'gwei');

      // Check if network is congested
      const block = await provider.getBlock('latest');
      const isCongested = block && block.gasUsed && (Number(block.gasUsed) / Number(block.gasLimit)) > 0.8;

      if (isCongested) {
        // Increase gas price during congestion
        gasPrice = (gasPrice * BigInt(120)) / BigInt(100); // 20% increase
      }

      // Ensure within bounds
      const gasConfig = this.getGasConfig();
      if (gasPrice > gasConfig.maxGasPrice) {
        gasPrice = gasConfig.maxGasPrice;
      }

      return gasPrice;
    } catch (error) {
      console.warn('Failed to get optimal gas price, using fallback:', error);
      return ethers.parseUnits('5', 'gwei'); // Safe fallback
    }
  }

  /**
   * Update BNB price in USD (for cost estimation)
   */
  private async updateBNBPrice(): Promise<void> {
    const now = Date.now();
    if (now - this.lastPriceUpdate < this.PRICE_UPDATE_INTERVAL && this.bnbPriceUSD > 0) {
      return; // Use cached price
    }

    try {
      // This would typically call a price API
      // For now, using a reasonable default
      this.bnbPriceUSD = 300; // Example price
      this.lastPriceUpdate = now;
    } catch (error) {
      console.warn('Failed to update BNB price:', error);
      // Keep using cached price
    }
  }

  /**
   * Check if transaction is cost-effective
   */
  public isTransactionCostEffective(
    gasEstimate: GasEstimate,
    minValueUSD: number = 1
  ): boolean {
    if (!gasEstimate.totalCostUSD) {
      return true; // Can't determine, proceed anyway
    }

    const costUSD = parseFloat(gasEstimate.totalCostUSD.replace('$', ''));
    return costUSD < minValueUSD;
  }

  /**
   * Format gas information for logging/debugging
   */
  public formatGasInfo(gasEstimate: GasEstimate): string {
    return `
Gas Information:
- Gas Limit: ${gasEstimate.gasLimit.toLocaleString()}
- Gas Price: ${ethers.formatUnits(gasEstimate.gasPrice, 'gwei')} gwei
- Total Cost: ${gasEstimate.totalCostBNB} BNB
- Total Cost USD: ${gasEstimate.totalCostUSD || 'Unknown'}
    `.trim();
  }
}

// Export singleton instance
export const bscGasManager = new BSCGasManager();

// Export convenience functions
export const estimateGas = (
  transaction: Parameters<BSCGasManager['estimateGas']>[0],
  provider: JsonRpcProvider
) => bscGasManager.estimateGas(transaction, provider);

export const optimizeGasForTransactionType = (
  type: Parameters<BSCGasManager['optimizeGasForTransactionType']>[0]
) => bscGasManager.optimizeGasForTransactionType(type);

export const getOptimalGasPrice = (provider: JsonRpcProvider) =>
  bscGasManager.getOptimalGasPrice(provider);