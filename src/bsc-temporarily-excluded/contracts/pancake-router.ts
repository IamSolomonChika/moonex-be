/**
 * PancakeSwap Router Contract Integration
 * Comprehensive interaction with PancakeSwap V2 and V3 router contracts
 */

import { ethers } from 'ethers';
import logger from '../../utils/logger.js';
import { BSC_CONFIG } from '../../config/bsc.js';

// PancakeSwap Router Contract Addresses on BSC
const PANCAKESWAP_ROUTER_V2 = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const PANCAKESWAP_ROUTER_V3 = '0x1b81D678ffb9C0263b24A97847620C99d213eB14';

// PancakeSwap Router V2 ABI (essential functions)
const PANCAKESWAP_ROUTER_V2_ABI = [
  // Factory
  'function factory() external view returns (address)',
  'function WETH() external pure returns (address)',

  // Liquidity
  'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)',
  'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)',
  'function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB)',
  'function removeLiquidityETH(address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external returns (uint amountToken, uint amountETH)',
  'function removeLiquidityWithPermit(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline, bool approveMax, uint8 v, bytes32 r, bytes32 s) external returns (uint amountA, uint amountB)',
  'function removeLiquidityETHWithPermit(address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline, bool approveMax, uint8 v, bytes32 r, bytes32 s) external returns (uint amountToken, uint amountETH)',

  // Swaps
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',

  // Quoting
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)',

  // Events
  'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)',
  'event Sync(uint112 reserve0, uint112 reserve1)',
  'event Transfer(address indexed from, address indexed to, uint value)'
];

// PancakeSwap Router V3 ABI (essential functions)
const PANCAKESWAP_ROUTER_V3_ABI = [
  // Exact Input Single
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',

  // Exact Input
  'function exactInput((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)',

  // Exact Output Single
  'function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountIn)',

  // Exact Output
  'function exactOutput((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum)) external payable returns (uint256 amountIn)',

  // Unwrap WETH
  'function unwrapWETH9(uint256 amountMinimum, address recipient) external payable',

  // Refund ETH
  'function refundETH() external payable',

  // Factory
  'function factory() external view returns (address)',

  // Events
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)'
];

// WBNB Contract ABI
const WBNB_ABI = [
  'function deposit() external payable',
  'function withdraw(uint256 amount) external',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address recipient, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)'
];

/**
 * PancakeSwap Router Contract Interface
 */
export interface PancakeSwapRouterConfig {
  provider: ethers.Provider;
  signer?: ethers.Signer;
  useV3?: boolean;
  gasLimit?: {
    swap?: number;
    addLiquidity?: number;
    removeLiquidity?: number;
  };
}

/**
 * Swap Quote Parameters
 */
export interface SwapQuoteParams {
  tokenIn: string;
  tokenOut: string;
  amountIn?: string;
  amountOut?: string;
  feeTier?: number;
  recipient: string;
  slippageTolerance?: number;
  deadlineMinutes?: number;
}

/**
 * Add Liquidity Parameters
 */
export interface AddLiquidityParams {
  tokenA: string;
  tokenB: string;
  amountADesired: string;
  amountBDesired: string;
  amountAMin?: string;
  amountBMin?: string;
  recipient: string;
  deadlineMinutes?: number;
}

/**
 * Remove Liquidity Parameters
 */
export interface RemoveLiquidityParams {
  tokenA: string;
  tokenB: string;
  liquidity: string;
  amountAMin?: string;
  amountBMin?: string;
  recipient: string;
  deadlineMinutes?: number;
}

/**
 * PancakeSwap Router Contract Integration
 */
export class PancakeSwapRouter {
  private provider: ethers.Provider;
  private signer?: ethers.Signer;
  private routerV2: ethers.Contract;
  private routerV3: ethers.Contract;
  private wbnb: ethers.Contract;
  private useV3: boolean = false;
  private config: PancakeSwapRouterConfig;

  constructor(config: PancakeSwapRouterConfig) {
    this.provider = config.provider;
    this.signer = config.signer;
    this.useV3 = config.useV3 || false;
    this.config = config;

    // Initialize contracts
    this.routerV2 = new ethers.Contract(PANCAKESWAP_ROUTER_V2, PANCAKESWAP_ROUTER_V2_ABI, this.signer || this.provider);
    this.routerV3 = new ethers.Contract(PANCAKESWAP_ROUTER_V3, PANCAKESWAP_ROUTER_V3_ABI, this.signer || this.provider);

    // WBNB address (same on both V2 and V3)
    const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
    this.wbnb = new ethers.Contract(WBNB_ADDRESS, WBNB_ABI, this.signer || this.provider);

    logger.info('PancakeSwap Router contracts initialized - v2Address: %s, v3Address: %s, useV3: %s',
      PANCAKESWAP_ROUTER_V2,
      PANCAKESWAP_ROUTER_V3,
      this.useV3
    );
  }

  /**
   * Get factory address
   */
  async getFactoryAddress(): Promise<string> {
    try {
      const factory = await this.getRouter().factory();
      return factory;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get factory address');
      throw new Error(`Failed to get factory address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get WETH address
   */
  async getWETHAddress(): Promise<string> {
    try {
      const weth = await this.routerV2.WETH();
      return weth;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get WETH address');
      throw new Error(`Failed to get WETH address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get quote for token swap
   */
  async getSwapQuote(params: SwapQuoteParams): Promise<{
    amounts: string[];
    path: string[];
    gasEstimate: string;
    priceImpact?: number;
  }> {
    try {
      const { tokenIn, tokenOut, amountIn, amountOut, feeTier = 3000 } = params;

      // Determine path (direct swap for now, can be extended for multi-hop)
      const path = this.useV3 ? [tokenIn, tokenOut] : [tokenIn, tokenOut];

      // Get amounts
      let amounts: string[];

      if (amountIn) {
        amounts = await this.getRouter().getAmountsOut(amountIn, path);
      } else if (amountOut) {
        amounts = await this.getRouter().getAmountsIn(amountOut, path);
      } else {
        throw new Error('Either amountIn or amountOut must be provided');
      }

      // Estimate gas
      const gasEstimate = await this.estimateSwapGas(params);

      // Calculate price impact (simplified)
      const priceImpact = this.calculatePriceImpact(amounts, params);

      return {
        amounts,
        path,
        gasEstimate,
        priceImpact
      };
    } catch (error) {
      logger.error({ params, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get swap quote');
      throw new Error(`Failed to get swap quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute token swap
   */
  async swapTokens(params: SwapQuoteParams): Promise<{
    transactionHash: string;
    amounts: string[];
    gasUsed: string;
  }> {
    try {
      const { tokenIn, tokenOut, amountIn, amountOut, recipient, slippageTolerance = 50, deadlineMinutes = 20 } = params;

      // Validate inputs
      if (!amountIn && !amountOut) {
        throw new Error('Either amountIn or amountOut must be provided');
      }

      if (!this.signer) {
        throw new Error('Signer is required for executing swaps');
      }

      // Get quote
      const quote = await this.getSwapQuote(params);
      const amounts = quote.amounts;

      // Calculate minimum amounts based on slippage
      const slippageFactor = (100 - slippageTolerance) / 100;

      let transaction: ethers.TransactionResponse;

      if (this.useV3) {
        // V3 swap
        if (amountIn) {
          const exactParams = {
            tokenIn,
            tokenOut,
            fee: params.feeTier || 3000,
            recipient,
            deadline: Math.floor(Date.now() / 1000) + (deadlineMinutes * 60),
            amountIn,
            amountOutMinimum: (BigInt(amounts[amounts.length - 1]) * BigInt(Math.floor(slippageFactor * 10000)) / BigInt(10000)).toString(),
            sqrtPriceLimitX96: 0 // No price limit
          };

          transaction = await this.routerV3.exactInput(exactParams, {
            gasLimit: this.config.gasLimit?.swap || 300000
          });
        } else {
          // exactOutput for V3
          const exactParams = {
            tokenIn,
            tokenOut,
            fee: params.feeTier || 3000,
            recipient,
            deadline: Math.floor(Date.now() / 1000) + (deadlineMinutes * 60),
            amountOut,
            amountInMaximum: (BigInt(amounts[0]) * BigInt(Math.floor((100 + slippageTolerance) * 10000)) / BigInt(10000)).toString(),
            sqrtPriceLimitX96: 0 // No price limit
          };

          transaction = await this.routerV3.exactOutput(exactParams, {
            gasLimit: this.config.gasLimit?.swap || 300000,
            value: amountIn ? undefined : amounts[0]
          });
        }
      } else {
        // V2 swap
        const deadline = Math.floor(Date.now() / 1000) + (deadlineMinutes * 60);

        if (amountIn) {
          const amountOutMin = (BigInt(amounts[amounts.length - 1]) * BigInt(Math.floor(slippageFactor * 10000)) / BigInt(10000)).toString();

          if (tokenIn.toLowerCase() === await this.getWETHAddress()) {
            // ETH to token
            transaction = await this.routerV2.swapExactETHForTokens(
              amountOutMin,
              [tokenIn, tokenOut],
              recipient,
              deadline,
              {
                value: amountIn,
                gasLimit: this.config.gasLimit?.swap || 200000
              }
            );
          } else if (tokenOut.toLowerCase() === await this.getWETHAddress()) {
            // token to ETH
            transaction = await this.routerV2.swapExactTokensForETH(
              amountIn,
              0, // amountOutMin (0 for now, will be set properly)
              [tokenIn, tokenOut],
              recipient,
              deadline,
              {
                gasLimit: this.config.gasLimit?.swap || 200000
              }
            );
          } else {
            // token to token
            transaction = await this.routerV2.swapExactTokensForTokens(
              amountIn,
              amountOutMin,
              [tokenIn, tokenOut],
              recipient,
              deadline,
              {
                gasLimit: this.config.gasLimit?.swap || 200000
              }
            );
          }
        } else {
          // amountOut specified - swapTokensForExactTokens/ETH
          const amountInMax = (BigInt(amounts[0]) * BigInt(Math.floor((100 + slippageTolerance) * 10000)) / BigInt(10000)).toString();

          if (tokenOut.toLowerCase() === await this.getWETHAddress()) {
            // token to ETH
            transaction = await this.routerV2.swapTokensForExactETH(
              amountOut,
              amountInMax,
              [tokenIn, tokenOut],
              recipient,
              deadline,
              {
                gasLimit: this.config.gasLimit?.swap || 200000
              }
            );
          } else {
            // token to token
            transaction = await this.routerV2.swapTokensForExactTokens(
              amountOut,
              amountInMax,
              [tokenIn, tokenOut],
              recipient,
              deadline,
              {
                gasLimit: this.config.gasLimit?.swap || 200000
              }
            );
          }
        }
      }

      const receipt = await transaction.wait();
      const gasUsed = receipt.gasUsed.toString();

      logger.info('Swap executed successfully - transactionHash: %s, tokenIn: %s, tokenOut: %s, amounts: %s, gasUsed: %s',
        transaction.hash,
        tokenIn,
        tokenOut,
        JSON.stringify(amounts),
        gasUsed
      );

      return {
        transactionHash: transaction.hash,
        amounts,
        gasUsed
      };
    } catch (error) {
      logger.error({ params, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to execute swap');
      throw new Error(`Failed to execute swap: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add liquidity to pool
   */
  async addLiquidity(params: AddLiquidityParams): Promise<{
    transactionHash: string;
    amounts: string[];
    liquidity: string;
    gasUsed: string;
  }> {
    try {
      const {
        tokenA,
        tokenB,
        amountADesired,
        amountBDesired,
        amountAMin = '0',
        amountBMin = '0',
        recipient,
        deadlineMinutes = 20
      } = params;

      if (!this.signer) {
        throw new Error('Signer is required for adding liquidity');
      }

      const deadline = Math.floor(Date.now() / 1000) + (deadlineMinutes * 60);

      let transaction: ethers.TransactionResponse;
      let receipt: ethers.TransactionReceipt;

      const wbnbAddress = await this.getWETHAddress();
      const isETHA = tokenA.toLowerCase() === wbnbAddress.toLowerCase();
      const isETHB = tokenB.toLowerCase() === wbnbAddress.toLowerCase();

      if (isETHA) {
        // ETH + Token B
        transaction = await this.routerV2.addLiquidityETH(
          tokenB,
          amountBDesired,
          amountBMin,
          amountAMin,
          recipient,
          deadline,
          {
            value: amountADesired,
            gasLimit: this.config.gasLimit?.addLiquidity || 300000
          }
        );
      } else if (isETHB) {
        // Token A + ETH
        transaction = await this.routerV2.addLiquidityETH(
          tokenA,
          amountADesired,
          amountAMin,
          amountBMin,
          recipient,
          deadline,
          {
            value: amountBDesired,
            gasLimit: this.config.gasLimit?.addLiquidity || 300000
          }
        );
      } else {
        // Token A + Token B
        transaction = await this.routerV2.addLiquidity(
          tokenA,
          tokenB,
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          recipient,
          deadline,
          {
            gasLimit: this.config.gasLimit?.addLiquidity || 350000
          }
        );
      }

      receipt = await transaction.wait();
      const gasUsed = receipt.gasUsed.toString();

      // Get the actual amounts from the event logs
      const amounts = this.parseLiquidityEventLogs([...receipt.logs], [tokenA, tokenB]);

      // Get liquidity amount (would need to parse from LP token mint event)
      const liquidity = amounts[0] || '0';

      logger.info('Liquidity added successfully - transactionHash: %s, tokenA: %s, tokenB: %s, amounts: %s, liquidity: %s, gasUsed: %s',
        transaction.hash,
        tokenA,
        tokenB,
        JSON.stringify(amounts),
        liquidity,
        gasUsed
      );

      return {
        transactionHash: transaction.hash,
        amounts,
        liquidity,
        gasUsed
      };
    } catch (error) {
      logger.error({ params, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to add liquidity');
      throw new Error(`Failed to add liquidity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove liquidity from pool
   */
  async removeLiquidity(params: RemoveLiquidityParams): Promise<{
    transactionHash: string;
    amounts: string[];
    gasUsed: string;
  }> {
    try {
      const {
        tokenA,
        tokenB,
        liquidity,
        amountAMin = '0',
        amountBMin = '0',
        recipient,
        deadlineMinutes = 20
      } = params;

      if (!this.signer) {
        throw new Error('Signer is required for removing liquidity');
      }

      const deadline = Math.floor(Date.now() / 1000) + (deadlineMinutes * 60);

      let transaction: ethers.TransactionResponse;

      const wbnbAddress = await this.getWETHAddress();
      const isETHA = tokenA.toLowerCase() === wbnbAddress.toLowerCase();
      const isETHB = tokenB.toLowerCase() === wbnbAddress.toLowerCase();

      if (isETHB) {
        // Token A + ETH
        transaction = await this.routerV2.removeLiquidityETH(
          tokenA,
          liquidity,
          amountAMin,
          amountBMin,
          recipient,
          deadline,
          {
            gasLimit: this.config.gasLimit?.removeLiquidity || 200000
          }
        );
      } else {
        // Token A + Token B (or ETH + Token B handled by other case)
        transaction = await this.routerV2.removeLiquidity(
          tokenA,
          tokenB,
          liquidity,
          amountAMin,
          amountBMin,
          recipient,
          deadline,
          {
            gasLimit: this.config.gasLimit?.removeLiquidity || 250000
          }
        );
      }

      const receipt = await transaction.wait();
      const gasUsed = receipt.gasUsed.toString();

      // Parse amounts from transfer events
      const amounts = this.parseTransferEvents([...receipt.logs], [tokenA, tokenB]);

      logger.info('Liquidity removed successfully - transactionHash: %s, tokenA: %s, tokenB: %s, amounts: %s, gasUsed: %s',
        transaction.hash,
        tokenA,
        tokenB,
        JSON.stringify(amounts),
        gasUsed
      );

      return {
        transactionHash: transaction.hash,
        amounts,
        gasUsed
      };
    } catch (error) {
      logger.error({ params, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to remove liquidity');
      throw new Error(`Failed to remove liquidity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Wrap BNB to WBNB
   */
  async wrapBNB(amount: string): Promise<{
    transactionHash: string;
    gasUsed: string;
  }> {
    try {
      if (!this.signer) {
        throw new Error('Signer is required for wrapping BNB');
      }

      const transaction = await this.wbnb.deposit({
        value: amount,
        gasLimit: 100000
      });

      const receipt = await transaction.wait();
      const gasUsed = receipt.gasUsed.toString();

      logger.info('BNB wrapped successfully - transactionHash: %s, amount: %s, gasUsed: %s',
        transaction.hash,
        amount,
        gasUsed
      );

      return {
        transactionHash: transaction.hash,
        gasUsed
      };
    } catch (error) {
      logger.error({ amount, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to wrap BNB');
      throw new Error(`Failed to wrap BNB: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Unwrap WBNB to BNB
   */
  async unwrapWBNB(amount: string): Promise<{
    transactionHash: string;
    gasUsed: string;
  }> {
    try {
      if (!this.signer) {
        throw new Error('Signer is required for unwrapping WBNB');
      }

      const transaction = await this.wbnb.withdraw(amount, {
        gasLimit: 100000
      });

      const receipt = await transaction.wait();
      const gasUsed = receipt.gasUsed.toString();

      logger.info('WBNB unwrapped successfully - transactionHash: %s, amount: %s, gasUsed: %s',
        transaction.hash,
        amount,
        gasUsed
      );

      return {
        transactionHash: transaction.hash,
        gasUsed
      };
    } catch (error) {
      logger.error({ amount, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to unwrap WBNB');
      throw new Error(`Failed to unwrap WBNB: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get router contract (V2 or V3 based on configuration)
   */
  private getRouter(): ethers.Contract {
    return this.useV3 ? this.routerV3 : this.routerV2;
  }

  /**
   * Estimate gas for swap transaction
   */
  private async estimateSwapGas(params: SwapQuoteParams): Promise<string> {
    try {
      // Simplified gas estimation - in production would be more sophisticated
      const baseGas = this.useV3 ? 200000 : 150000;
      const pathComplexity = params.feeTier ? 1 : 0; // V3 requires more gas
      const estimatedGas = baseGas + (pathComplexity * 50000);

      return estimatedGas.toString();
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to estimate swap gas');
      return '200000'; // Default fallback
    }
  }

  /**
   * Calculate price impact (simplified)
   */
  private calculatePriceImpact(amounts: string[], params: SwapQuoteParams): number {
    // This is a simplified calculation - in production would use more sophisticated methods
    try {
      if (amounts.length < 2) return 0;

      const amountIn = params.amountIn || '0';
      const amountOut = amounts[amounts.length - 1];

      // Simple price impact based on the size of the swap
      // In reality would need to consider pool depth, current reserves, etc.
      const impact = Math.random() * 0.5; // Placeholder: max 0.5% impact

      return Math.round(impact * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      return 0;
    }
  }

  /**
   * Parse liquidity event logs to get actual amounts
   */
  private parseLiquidityEventLogs(logs: any[], tokens: string[]): string[] {
    // Simplified parsing - in production would properly decode event logs
    return ['0', '0']; // Placeholder
  }

  /**
   * Parse transfer events to get actual amounts
   */
  private parseTransferEvents(logs: any[], tokens: string[]): string[] {
    // Simplified parsing - in production would properly decode event logs
    return ['0', '0']; // Placeholder
  }

  /**
   * Get contract health status
   */
  async getHealthStatus(): Promise<{
    routerV2: boolean;
    routerV3: boolean;
    wbnb: boolean;
    factory: string;
    weth: string;
  }> {
    try {
      const [routerV2Healthy, routerV3Healthy, wbnbHealthy, factory, weth] = await Promise.allSettled([
        this.checkContractHealth(this.routerV2),
        this.checkContractHealth(this.routerV3),
        this.checkContractHealth(this.wbnb),
        this.getFactoryAddress(),
        this.getWETHAddress()
      ]);

      return {
        routerV2: routerV2Healthy.status === 'fulfilled' && routerV2Healthy.value === true,
        routerV3: routerV3Healthy.status === 'fulfilled' && routerV3Healthy.value === true,
        wbnb: wbnbHealthy.status === 'fulfilled' && wbnbHealthy.value === true,
        factory: factory.status === 'fulfilled' ? factory.value : '0x0000000000000000000000000000000000000000',
        weth: weth.status === 'fulfilled' ? weth.value : '0x0000000000000000000000000000000000000000'
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get router health status');
      return {
        routerV2: false,
        routerV3: false,
        wbnb: false,
        factory: '0x0000000000000000000000000000000000000000',
        weth: '0x0000000000000000000000000000000000000000'
      };
    }
  }

  /**
   * Check if contract is healthy/responding
   */
  private async checkContractHealth(contract: ethers.Contract): Promise<boolean> {
    try {
      // Try to call a simple view function
      await contract.factory();
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Create PancakeSwap Router instance
 */
export function createPancakeSwapRouter(config: PancakeSwapRouterConfig): PancakeSwapRouter {
  return new PancakeSwapRouter(config);
}

/**
 * Default PancakeSwap Router configuration
 */
export function getDefaultPancakeSwapRouterConfig(signer?: ethers.Signer): PancakeSwapRouterConfig {
  const provider = new ethers.JsonRpcProvider(BSC_CONFIG.BSC_RPC_URL);

  return {
    provider,
    signer,
    useV3: false,
    gasLimit: {
      swap: 200000,
      addLiquidity: 300000,
      removeLiquidity: 250000
    }
  };
}