import { Address, Hash, Hex, Chain, parseEther, formatEther, maxUint256 } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { TransactionSignerViem, TransactionParams, TransactionRequest } from '../contracts/transaction-signer-viem';
import logger from '../../utils/logger';

/**
 * Transaction Builder Utilities for Viem
 * Provides enhanced transaction building patterns and utilities
 */

export interface SwapParameters {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOutMin?: bigint;
  recipient?: Address;
  deadline?: number;
  path?: Address[];
  feeTier?: number;
}

export interface LiquidityParameters {
  tokenA: Address;
  tokenB: Address;
  amountADesired: bigint;
  amountBDesired: bigint;
  amountAMin?: bigint;
  amountBMin?: bigint;
  recipient?: Address;
  deadline?: number;
}

export interface FarmingParameters {
  poolId: bigint;
  amount: bigint;
  action: 'deposit' | 'withdraw' | 'harvest';
  recipient?: Address;
}

export interface TokenApprovalParameters {
  token: Address;
  spender: Address;
  amount: bigint;
  owner?: Address;
}

export interface BatchTransactionParams {
  transactions: Array<{
    to: Address;
    data?: Hex;
    value?: bigint;
    gasLimit?: bigint;
  }>;
  maxGasPerBatch?: bigint;
  revertOnFailure?: boolean;
}

export interface TransactionBuilderConfig {
  defaultGasLimit?: bigint;
  defaultGasPrice?: bigint;
  gasMultiplier?: number;
  defaultDeadline?: number; // seconds from now
  slippageTolerance?: number; // percentage (0.1 = 0.1%)
  maxSlippage?: number; // maximum slippage allowed
  enableFlashbots?: boolean;
  enableOptimism?: boolean;
}

export interface EnhancedTransactionRequest extends TransactionRequest {
  metadata?: {
    type: 'swap' | 'liquidity' | 'farming' | 'approval' | 'batch' | 'custom';
    description?: string;
    tags?: string[];
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    maxSlippage?: number;
    estimatedValue?: bigint;
  };
  optimization?: {
    simulateBeforeSend?: boolean;
    retryOnFailure?: boolean;
    maxRetries?: number;
    retryDelay?: number;
  };
}

export interface SwapQuote {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  price: bigint;
  priceImpact: number;
  gasEstimate: bigint;
  route?: Address[];
}

export interface LiquidityQuote {
  tokenA: Address;
  tokenB: Address;
  amountA: bigint;
  amountB: bigint;
  liquidity: bigint;
  shareOfPool: number;
  gasEstimate: bigint;
  priceImpact: number;
}

/**
 * Enhanced Transaction Builder using Viem
 */
export class TransactionBuilderViem {
  private signer: TransactionSignerViem;
  private config: TransactionBuilderConfig;
  private chain: Chain;

  constructor(
    signer: TransactionSignerViem,
    config: TransactionBuilderConfig = {}
  ) {
    this.signer = signer;
    this.config = {
      defaultGasLimit: config.defaultGasLimit || BigInt(200000),
      defaultGasPrice: config.defaultGasPrice || parseEther('0.00000002'), // 20 Gwei
      gasMultiplier: config.gasMultiplier || 1.1,
      defaultDeadline: config.defaultDeadline || 1200, // 20 minutes
      slippageTolerance: config.slippageTolerance || 0.5, // 0.5%
      maxSlippage: config.maxSlippage || 5, // 5%
      enableFlashbots: config.enableFlashbots || false,
      enableOptimism: config.enableOptimism || false,
      ...config
    };
    this.chain = signer instanceof TransactionSignerViem ? bsc : bsc; // Default to BSC
  }

  /**
   * Build a swap transaction
   */
  async buildSwapTransaction(
    params: SwapParameters,
    signerAddress: Address,
    options: {
      routerAddress?: Address;
      exactInput?: boolean;
      slippageTolerance?: number;
      deadline?: number;
    } = {}
  ): Promise<EnhancedTransactionRequest> {
    try {
      const {
        tokenIn,
        tokenOut,
        amountIn,
        amountOutMin,
        recipient = signerAddress,
        deadline = options.deadline || Math.floor(Date.now() / 1000) + this.config.defaultDeadline,
        path = [tokenIn, tokenOut]
      } = params;

      const slippageTolerance = options.slippageTolerance || this.config.slippageTolerance;

      // Build swap data (simplified - would integrate with PancakeSwap router)
      const swapData = this.encodeSwapData({
        tokenIn,
        tokenOut,
        amountIn,
        amountOutMin,
        recipient,
        deadline,
        path,
        exactInput: options.exactInput !== false
      });

      const transaction = await this.signer.prepareTransaction({
        to: options.routerAddress || '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap Router V2
        data: swapData,
        value: tokenIn === '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' ? amountIn : 0n, // WBNB as native token
      }, signerAddress);

      const enhancedTx: EnhancedTransactionRequest = {
        ...transaction,
        metadata: {
          type: 'swap',
          description: `Swap ${formatEther(amountIn)} tokens`,
          tags: ['swap', 'defi', 'pancakeswap'],
          priority: 'medium',
          maxSlippage: slippageTolerance,
          estimatedValue: amountIn
        },
        optimization: {
          simulateBeforeSend: true,
          retryOnFailure: true,
          maxRetries: 3,
          retryDelay: 2000
        }
      };

      logger.info(`Swap transaction built: tokenIn=${tokenIn}, tokenOut=${tokenOut}, amountIn=${amountIn.toString()}, recipient=${recipient}`);

      return enhancedTx;
    } catch (error) {
      logger.error({ error: (error as Error).message, params }, 'Failed to build swap transaction');
      throw error;
    }
  }

  /**
   * Build a liquidity transaction
   */
  async buildLiquidityTransaction(
    params: LiquidityParameters,
    signerAddress: Address,
    options: {
      routerAddress?: Address;
      action?: 'add' | 'remove';
      slippageTolerance?: number;
      deadline?: number;
    } = {}
  ): Promise<EnhancedTransactionRequest> {
    try {
      const {
        tokenA,
        tokenB,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        recipient = signerAddress,
        deadline = options.deadline || Math.floor(Date.now() / 1000) + this.config.defaultDeadline
      } = params;

      const action = options.action || 'add';
      const slippageTolerance = options.slippageTolerance || this.config.slippageTolerance;

      // Build liquidity data (simplified - would integrate with PancakeSwap router)
      const liquidityData = this.encodeLiquidityData({
        tokenA,
        tokenB,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        recipient,
        deadline,
        action
      });

      const transaction = await this.signer.prepareTransaction({
        to: options.routerAddress || '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap Router V2
        data: liquidityData,
        value: 0n // Liquidity transactions don't typically send native tokens
      }, signerAddress);

      const enhancedTx: EnhancedTransactionRequest = {
        ...transaction,
        metadata: {
          type: 'liquidity',
          description: `${action === 'add' ? 'Add' : 'Remove'} liquidity`,
          tags: ['liquidity', 'defi', 'pancakeswap'],
          priority: 'medium',
          maxSlippage: slippageTolerance,
          estimatedValue: amountADesired + amountBDesired
        },
        optimization: {
          simulateBeforeSend: true,
          retryOnFailure: true,
          maxRetries: 3,
          retryDelay: 2000
        }
      };

      logger.info('Liquidity transaction built', {
        tokenA,
        tokenB,
        amountADesired: amountADesired.toString(),
        amountBDesired: amountBDesired.toString(),
        action
      });

      return enhancedTx;
    } catch (error) {
      logger.error({ error: (error as Error).message, params }, 'Failed to build liquidity transaction');
      throw error;
    }
  }

  /**
   * Build a farming transaction
   */
  async buildFarmingTransaction(
    params: FarmingParameters,
    signerAddress: Address,
    options: {
      masterChefAddress?: Address;
      slippageTolerance?: number;
    } = {}
  ): Promise<EnhancedTransactionRequest> {
    try {
      const {
        poolId,
        amount,
        action,
        recipient = signerAddress
      } = params;

      // Build farming data (simplified - would integrate with MasterChef)
      const farmingData = this.encodeFarmingData({
        poolId,
        amount,
        action,
        recipient
      });

      const masterChefAddress = options.masterChefAddress ||
        (action === 'harvest' ? '0xa5f8C5Dbd5F286960b9d9e4868417a7eA7B9E3b4' : '0x73feaa1eE314F8c655E354234017bE2193C9E24E'); // V2 or V1

      const transaction = await this.signer.prepareTransaction({
        to: masterChefAddress as Address,
        data: farmingData,
        value: 0n
      }, signerAddress);

      const enhancedTx: EnhancedTransactionRequest = {
        ...transaction,
        metadata: {
          type: 'farming',
          description: `${action} ${formatEther(amount)} tokens in farm ${poolId.toString()}`,
          tags: ['farming', 'defi', 'yield', action],
          priority: 'medium',
          estimatedValue: amount
        },
        optimization: {
          simulateBeforeSend: true,
          retryOnFailure: true,
          maxRetries: 2,
          retryDelay: 3000
        }
      };

      logger.info('Farming transaction built', {
        poolId: poolId.toString(),
        amount: amount.toString(),
        action
      });

      return enhancedTx;
    } catch (error) {
      logger.error({ error: (error as Error).message, params }, 'Failed to build farming transaction');
      throw error;
    }
  }

  /**
   * Build a token approval transaction
   */
  async buildApprovalTransaction(
    params: TokenApprovalParameters,
    signerAddress: Address,
    options: {
      skipExistingApproval?: boolean;
    } = {}
  ): Promise<EnhancedTransactionRequest> {
    try {
      const { token, spender, amount, owner = signerAddress } = params;

      // Check existing allowance if requested
      if (options.skipExistingApproval) {
        // Implementation would check current allowance here
        logger.debug('Skipping approval check, using existing allowance');
      }

      // Build approval data
      const approvalData = this.encodeApprovalData({
        spender,
        amount
      });

      const transaction = await this.signer.prepareTransaction({
        to: token,
        data: approvalData,
        value: 0n
      }, signerAddress);

      const enhancedTx: EnhancedTransactionRequest = {
        ...transaction,
        metadata: {
          type: 'approval',
          description: `Approve ${formatEther(amount)} tokens`,
          tags: ['approval', 'token', 'erc20'],
          priority: 'high', // Approvals are usually critical
          estimatedValue: amount
        },
        optimization: {
          simulateBeforeSend: false, // Approvals don't need simulation
          retryOnFailure: true,
          maxRetries: 3,
          retryDelay: 1000
        }
      };

      logger.info('Approval transaction built', {
        token,
        spender,
        amount: amount.toString()
      });

      return enhancedTx;
    } catch (error) {
      logger.error({ error: (error as Error).message, params }, 'Failed to build approval transaction');
      throw error;
    }
  }

  /**
   * Build a batch transaction
   */
  async buildBatchTransaction(
    params: BatchTransactionParams,
    signerAddress: Address,
    options: {
      multicallAddress?: Address;
      revertOnFailure?: boolean;
    } = {}
  ): Promise<EnhancedTransactionRequest> {
    try {
      const { transactions, maxGasPerBatch, revertOnFailure = true } = params;

      // Encode batch data using multicall
      const batchData = this.encodeBatchData({
        transactions,
        revertOnFailure
      });

      const multicallAddress = options.multicallAddress || '0xca11bde05977b3631167028862be2a173976ca11'; // Multicall3

      const transaction = await this.signer.prepareTransaction({
        to: multicallAddress,
        data: batchData,
        value: transactions.reduce((sum, tx) => sum + (tx.value || 0n), 0n)
      }, signerAddress);

      const enhancedTx: EnhancedTransactionRequest = {
        ...transaction,
        metadata: {
          type: 'batch',
          description: `Batch transaction with ${transactions.length} operations`,
          tags: ['batch', 'multicall', 'optimization'],
          priority: 'medium',
          estimatedValue: transactions.reduce((sum, tx) => sum + (tx.value || 0n), 0n)
        },
        optimization: {
          simulateBeforeSend: true,
          retryOnFailure: true,
          maxRetries: 2,
          retryDelay: 5000
        }
      };

      logger.info('Batch transaction built', {
        transactionCount: transactions.length,
        revertOnFailure
      });

      return enhancedTx;
    } catch (error) {
      logger.error({ error: (error as Error).message, params }, 'Failed to build batch transaction');
      throw error;
    }
  }

  /**
   * Build a custom transaction with enhanced features
   */
  async buildCustomTransaction(
    params: TransactionParams,
    signerAddress: Address,
    metadata: EnhancedTransactionRequest['metadata'],
    optimization: EnhancedTransactionRequest['optimization'] = {}
  ): Promise<EnhancedTransactionRequest> {
    try {
      const transaction = await this.signer.prepareTransaction(params, signerAddress);

      const enhancedTx: EnhancedTransactionRequest = {
        ...transaction,
        metadata: {
          type: 'custom',
          tags: ['custom'],
          priority: 'medium',
          ...metadata
        },
        optimization: {
          simulateBeforeSend: true,
          retryOnFailure: true,
          maxRetries: 2,
          retryDelay: 2000,
          ...optimization
        }
      };

      logger.info('Custom transaction built', {
        to: params.to,
        value: params.value?.toString() || '0',
        type: metadata.type
      });

      return enhancedTx;
    } catch (error) {
      logger.error({ error: (error as Error).message, params }, 'Failed to build custom transaction');
      throw error;
    }
  }

  /**
   * Optimize transaction gas settings
   */
  async optimizeGasSettings(
    transaction: EnhancedTransactionRequest,
    priority: 'slow' | 'standard' | 'fast' | 'urgent' = 'standard'
  ): Promise<EnhancedTransactionRequest> {
    try {
      const gasData = await this.signer.getOptimalGasPrice(priority);

      const optimizedTx: EnhancedTransactionRequest = {
        ...transaction,
        ...gasData
      };

      // Adjust gas limit based on priority
      const gasMultiplier = {
        safe: 1.0,
        standard: 1.1,
        fast: 1.2,
        urgent: 1.3
      }[priority as 'safe' | 'standard' | 'fast' | 'urgent'];

      if (transaction.gasLimit) {
        optimizedTx.gasLimit = BigInt(Math.floor(Number(transaction.gasLimit) * gasMultiplier));
      }

      // Update priority in metadata
      if (optimizedTx.metadata) {
        optimizedTx.metadata.priority = priority as 'urgent' | 'medium' | 'low' | 'high';
      }

      logger.info('Transaction gas optimized', {
        priority,
        gasPrice: gasData.gasPrice?.toString() || gasData.maxFeePerGas?.toString(),
        gasMultiplier
      });

      return optimizedTx;
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Failed to optimize gas settings');
      throw error;
    }
  }

  /**
   * Validate transaction parameters
   */
  validateTransaction(transaction: EnhancedTransactionRequest): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate address
    if (!transaction.to || !transaction.to.match(/^0x[a-fA-F0-9]{40}$/)) {
      errors.push('Invalid recipient address');
    }

    // Validate value
    if (transaction.value && transaction.value < 0n) {
      errors.push('Transaction value cannot be negative');
    }

    // Validate gas limit
    if (transaction.gasLimit && transaction.gasLimit <= 0n) {
      errors.push('Gas limit must be positive');
    }

    // Check for excessive gas price
    const maxGasPrice = parseEther('0.000001'); // 1000 Gwei
    if (transaction.gasPrice && transaction.gasPrice > maxGasPrice) {
      warnings.push('Very high gas price detected');
    }

    // Validate metadata
    if (transaction.metadata?.maxSlippage && transaction.metadata.maxSlippage > 10) {
      warnings.push('High slippage tolerance may result in unfavorable trades');
    }

    // Check deadline would be implemented here if deadline was in metadata interface

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Private helper methods for encoding data
  private encodeSwapData(params: any): Hex {
    // Simplified implementation - would integrate with actual PancakeSwap router ABI
    return '0x' as Hex;
  }

  private encodeLiquidityData(params: any): Hex {
    // Simplified implementation - would integrate with actual PancakeSwap router ABI
    return '0x' as Hex;
  }

  private encodeFarmingData(params: any): Hex {
    // Simplified implementation - would integrate with actual MasterChef ABI
    return '0x' as Hex;
  }

  private encodeApprovalData(params: { spender: Address; amount: bigint }): Hex {
    // ERC20 approval function selector: approve(address,uint256)
    const approveSelector = '0x095ea7b3';
    const spenderPadded = params.spender.toLowerCase().slice(2).padStart(64, '0');
    const amountPadded = params.amount.toString(16).padStart(64, '0');
    return `${approveSelector}${spenderPadded}${amountPadded}` as Hex;
  }

  private encodeBatchData(params: any): Hex {
    // Simplified implementation - would integrate with actual Multicall ABI
    return '0x' as Hex;
  }
}

// Factory function
export function createTransactionBuilderViem(
  signer: TransactionSignerViem,
  config?: TransactionBuilderConfig
): TransactionBuilderViem {
  return new TransactionBuilderViem(signer, config);
}

export default createTransactionBuilderViem;