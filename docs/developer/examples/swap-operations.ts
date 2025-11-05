/**
 * 📚 Swap Operations Examples
 *
 * This file contains practical examples of DEX swap operations using Viem
 * for the BSC DEX backend, including PancakeSwap integration.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  parseUnits,
  isAddress,
  getAddress,
  BaseError,
  ContractFunctionExecutionError,
  type PublicClient,
  type WalletClient,
  type Address,
  type Hex
} from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Configuration
const RPC_URL = 'https://bsc-dataseed1.binance.org';

// Common addresses on BSC
const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address;
const BUSD_ADDRESS = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address;
const PANCAKE_ROUTER_V2 = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as Address;
const PANCAKE_FACTORY_V2 = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as Address;

// PancakeSwap Router ABI (simplified)
const PANCAKE_ROUTER_ABI = [
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    name: 'swapExactTokensForTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'amountInMax', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    name: 'swapTokensForExactTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' }
    ],
    name: 'getAmountsOut',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'path', type: 'address[]' }
    ],
    name: 'getAmountsIn',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'amountADesired', type: 'uint256' },
      { name: 'amountBDesired', type: 'uint256' },
      { name: 'amountAMin', type: 'uint256' },
      { name: 'amountBMin', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    name: 'addLiquidity',
    outputs: [
      { name: 'amountA', type: 'uint256' },
      { name: 'amountB', type: 'uint256' },
      { name: 'liquidity', type: 'uint256' }
    ],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

// ERC-20 ABI for approve/transfer
const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'account', type: 'address' }
    ],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

// Pair ABI for liquidity operations
const PAIR_ABI = [
  {
    inputs: [],
    name: 'getReserves',
    outputs: [
      { name: 'reserve0', type: 'uint112' },
      { name: 'reserve1', type: 'uint112' },
      { name: 'blockTimestampLast', type: 'uint32' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'token0',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'token1',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

/**
 * Swap Service Example
 */
export class SwapService {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly walletClient: WalletClient
  ) {}

  /**
   * Get a swap quote for exact input
   */
  async getSwapQuote(
    tokenIn: Address,
    tokenOut: Address,
    amountIn: string,
    slippageTolerancePercent: number = 0.5
  ) {
    console.log(`📊 Getting swap quote: ${amountIn} ${tokenIn} → ${tokenOut}`);

    try {
      const validTokenIn = getAddress(tokenIn);
      const validTokenOut = getAddress(tokenOut);
      const amountInWei = parseUnits(amountIn, 18); // Assuming 18 decimals, adjust per token

      // Get amounts out
      const amounts = await this.publicClient.readContract({
        address: PANCAKE_ROUTER_V2,
        abi: PANCAKE_ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [amountInWei, [validTokenIn, validTokenOut]]
      });

      const amountOutWei = amounts[amounts.length - 1];
      const slippageToleranceWei = (amountOutWei * BigInt(Math.floor(slippageTolerancePercent * 10000))) / BigInt(10000);
      const minimumAmountOut = amountOutWei - slippageToleranceWei;

      const quote = {
        tokenIn: validTokenIn,
        tokenOut: validTokenOut,
        amountIn: amountInWei,
        amountOut: amountOutWei,
        minimumAmountOut,
        slippageTolerancePercent,
        priceImpact: this.calculatePriceImpact(amountInWei, amountOutWei),
        path: [validTokenIn, validTokenOut]
      };

      console.log(`💱 Quote received: ${formatUnits(amountOutWei, 18)} tokens out`);
      console.log(`📉 Minimum out (with ${slippageTolerancePercent}% slippage): ${formatUnits(minimumAmountOut, 18)}`);

      return quote;
    } catch (error) {
      console.error('❌ Failed to get swap quote:', error);
      throw new Error(`Failed to get swap quote: ${error.message}`);
    }
  }

  /**
   * Execute a swap
   */
  async executeSwap(
    tokenIn: Address,
    tokenOut: Address,
    amountIn: string,
    slippageTolerancePercent: number = 0.5,
    deadlineMinutes: number = 20
  ) {
    console.log(`🔄 Executing swap: ${amountIn} ${tokenIn} → ${tokenOut}`);

    try {
      const quote = await this.getSwapQuote(tokenIn, tokenOut, amountIn, slippageTolerancePercent);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineMinutes * 60);

      // Check allowance for ERC-20 tokens (not needed for BNB)
      if (tokenIn !== WBNB_ADDRESS) {
        await this.ensureApproval(tokenIn, PANCAKE_ROUTER_V2, quote.amountIn);
      }

      // Execute swap
      const args = tokenIn === WBNB_ADDRESS
        ? [
            quote.amountIn,
            quote.minimumAmountOut,
            quote.path,
            this.walletClient.account!.address,
            deadline
          ]
        : [
            quote.amountIn,
            quote.minimumAmountOut,
            quote.path,
            this.walletClient.account!.address,
            deadline
          ];

      const functionName = tokenIn === WBNB_ADDRESS
        ? 'swapExactETHForTokens'
        : 'swapExactTokensForTokens';

      const { request } = await this.publicClient.simulateContract({
        address: PANCAKE_ROUTER_V2,
        abi: PANCAKE_ROUTER_ABI,
        functionName: functionName as any,
        args: args as any,
        value: tokenIn === WBNB_ADDRESS ? quote.amountIn : undefined,
        account: this.walletClient.account!
      });

      const hash = await this.walletClient.writeContract(request);
      console.log(`📝 Swap transaction submitted: ${hash}`);

      // Wait for confirmation
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 2
      });

      console.log(`✅ Swap completed in block ${receipt.blockNumber}`);
      return { hash, receipt, quote };
    } catch (error) {
      console.error('❌ Swap execution failed:', error);
      throw new Error(`Swap execution failed: ${error.message}`);
    }
  }

  /**
   * Get liquidity information for a pair
   */
  async getLiquidityInfo(tokenA: Address, tokenB: Address) {
    console.log(`💧 Getting liquidity info for pair: ${tokenA} / ${tokenB}`);

    try {
      const pairAddress = await this.getPairAddress(tokenA, tokenB);

      const [reserves, token0] = await this.publicClient.multicall({
        contracts: [
          {
            address: pairAddress,
            abi: PAIR_ABI,
            functionName: 'getReserves'
          },
          {
            address: pairAddress,
            abi: PAIR_ABI,
            functionName: 'token0'
          }
        ]
      });

      const [reserve0, reserve1] = reserves.result || [0n, 0n];
      const token0Address = token0.result || tokenA;

      // Determine which token is which
      const isTokenA0 = token0Address.toLowerCase() === tokenA.toLowerCase();
      const reserveA = isTokenA0 ? reserve0 : reserve1;
      const reserveB = isTokenA0 ? reserve1 : reserve0;

      const liquidityInfo = {
        pair: pairAddress,
        tokenA,
        tokenB,
        reserveA,
        reserveB,
        totalLiquidity: reserveA + reserveB, // Simplified
        priceA: reserveB > 0n ? Number(reserveA) / Number(reserveB) : 0,
        priceB: reserveA > 0n ? Number(reserveB) / Number(reserveA) : 0
      };

      console.log(`💧 Reserves: ${formatUnits(reserveA, 18)} / ${formatUnits(reserveB, 18)}`);
      return liquidityInfo;
    } catch (error) {
      console.error('❌ Failed to get liquidity info:', error);
      throw new Error(`Failed to get liquidity info: ${error.message}`);
    }
  }

  /**
   * Add liquidity to a pair
   */
  async addLiquidity(
    tokenA: Address,
    tokenB: Address,
    amountA: string,
    amountB: string,
    slippageTolerancePercent: number = 0.5
  ) {
    console.log(`💧 Adding liquidity: ${amountA} ${tokenA} + ${amountB} ${tokenB}`);

    try {
      const amountAWei = parseUnits(amountA, 18);
      const amountBWei = parseUnits(amountB, 18);

      const slippageToleranceA = (amountAWei * BigInt(Math.floor(slippageTolerancePercent * 10000))) / BigInt(10000);
      const slippageToleranceB = (amountBWei * BigInt(Math.floor(slippageTolerancePercent * 10000))) / BigInt(10000);

      const amountAMin = amountAWei - slippageToleranceA;
      const amountBMin = amountBWei - slippageToleranceB;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60); // 20 minutes

      // Approve tokens if needed
      if (tokenA !== WBNB_ADDRESS) {
        await this.ensureApproval(tokenA, PANCAKE_ROUTER_V2, amountAWei);
      }
      if (tokenB !== WBNB_ADDRESS) {
        await this.ensureApproval(tokenB, PANCAKE_ROUTER_V2, amountBWei);
      }

      const { request } = await this.publicClient.simulateContract({
        address: PANCAKE_ROUTER_V2,
        abi: PANCAKE_ROUTER_ABI,
        functionName: 'addLiquidity',
        args: [
          tokenA,
          tokenB,
          amountAWei,
          amountBWei,
          amountAMin,
          amountBMin,
          this.walletClient.account!.address,
          deadline
        ],
        account: this.walletClient.account!
      });

      const hash = await this.walletClient.writeContract(request);
      console.log(`📝 Add liquidity transaction submitted: ${hash}`);

      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 2
      });

      console.log(`✅ Liquidity added in block ${receipt.blockNumber}`);
      return { hash, receipt };
    } catch (error) {
      console.error('❌ Add liquidity failed:', error);
      throw new Error(`Add liquidity failed: ${error.message}`);
    }
  }

  /**
   * Ensure token approval
   */
  private async ensureApproval(token: Address, spender: Address, amount: bigint) {
    console.log(`🔐 Checking approval for ${token} → ${spender}`);

    const allowance = await this.publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [this.walletClient.account!.address, spender]
    });

    if (allowance < amount) {
      console.log(`📝 Approving ${formatUnits(amount, 18)} tokens`);

      const { request } = await this.publicClient.simulateContract({
        address: token,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender, amount],
        account: this.walletClient.account!
      });

      const hash = await this.walletClient.writeContract(request);
      await this.publicClient.waitForTransactionReceipt({ hash });
      console.log(`✅ Approval completed: ${hash}`);
    } else {
      console.log(`✅ Sufficient allowance exists: ${formatUnits(allowance, 18)}`);
    }
  }

  /**
   * Get pair address from factory
   */
  private async getPairAddress(tokenA: Address, tokenB: Address): Promise<Address> {
    const factoryAbi = [
      {
        inputs: [
          { name: 'tokenA', type: 'address' },
          { name: 'tokenB', type: 'address' }
        ],
        name: 'getPair',
        outputs: [{ name: 'pair', type: 'address' }],
        stateMutability: 'view',
        type: 'function'
      }
    ] as const;

    const pairAddress = await this.publicClient.readContract({
      address: PANCAKE_FACTORY_V2,
      abi: factoryAbi,
      functionName: 'getPair',
      args: [tokenA, tokenB]
    });

    if (pairAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error(`Pair does not exist for ${tokenA} / ${tokenB}`);
    }

    return pairAddress as Address;
  }

  /**
   * Calculate price impact (simplified)
   */
  private calculatePriceImpact(amountIn: bigint, amountOut: bigint): number {
    // This is a simplified calculation
    // In production, you'd calculate based on pool reserves
    return 0.01; // 1% placeholder
  }
}

/**
 * Example usage functions
 */
export async function swapExamples() {
  console.log('🚀 Running swap operation examples...\n');

  // Setup clients
  const publicClient = createPublicClient({
    chain: bsc,
    transport: http(RPC_URL)
  });

  const account = privateKeyToAccount('0x_YOUR_PRIVATE_KEY_HERE');
  const walletClient = createWalletClient({
    account,
    chain: bsc,
    transport: http(RPC_URL)
  });

  const swapService = new SwapService(publicClient, walletClient);

  try {
    // Example 1: Get swap quote
    console.log('📊 Example 1: Getting swap quote');
    const quote = await swapService.getSwapQuote(
      WBNB_ADDRESS,
      BUSD_ADDRESS,
      '1', // 1 WBNB
      0.5 // 0.5% slippage
    );

    console.log('📈 Quote Details:');
    console.log(`  Amount In: ${formatUnits(quote.amountIn, 18)} WBNB`);
    console.log(`  Amount Out: ${formatUnits(quote.amountOut, 18)} BUSD`);
    console.log(`  Minimum Out: ${formatUnits(quote.minimumAmountOut, 18)} BUSD`);
    console.log(`  Price Impact: ${(quote.priceImpact * 100).toFixed(2)}%\n`);

    // Example 2: Get liquidity info
    console.log('💧 Example 2: Getting liquidity information');
    const liquidityInfo = await swapService.getLiquidityInfo(WBNB_ADDRESS, BUSD_ADDRESS);

    console.log('💧 Liquidity Details:');
    console.log(`  Pair Address: ${liquidityInfo.pair}`);
    console.log(`  WBNB Reserve: ${formatUnits(liquidityInfo.reserveA, 18)}`);
    console.log(`  BUSD Reserve: ${formatUnits(liquidityInfo.reserveB, 18)}`);
    console.log(`  Price (WBNB/BUSD): ${liquidityInfo.priceA.toFixed(6)}\n`);

    // Note: Actual swap execution requires valid private key and sufficient balance
    console.log('📝 Note: Swap execution requires valid private key and sufficient balance');
    console.log('   Uncomment the following lines to test actual swaps:');
    console.log('   const swapResult = await swapService.executeSwap(');
    console.log('     WBNB_ADDRESS, BUSD_ADDRESS, "0.1", 0.5');
    console.log('   );');

    console.log('\n✅ All swap examples completed successfully!');
  } catch (error) {
    console.error('\n❌ Swap examples failed:', error);
  }
}

/**
 * Advanced swap routing example
 */
export class AdvancedSwapRouter {
  constructor(private readonly publicClient: PublicClient) {}

  /**
   * Find best path for multi-hop swaps
   */
  async findBestPath(
    tokenIn: Address,
    tokenOut: Address,
    amountIn: bigint
  ): Promise<{ path: Address[]; amountOut: bigint; hops: number }> {
    console.log(`🔍 Finding best path for ${tokenIn} → ${tokenOut}`);

    // For direct pairs
    try {
      const amounts = await this.publicClient.readContract({
        address: PANCAKE_ROUTER_V2,
        abi: PANCAKE_ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [amountIn, [tokenIn, tokenOut]]
      });

      return {
        path: [tokenIn, tokenOut],
        amountOut: amounts[1],
        hops: 1
      };
    } catch (error) {
      console.log('Direct pair not found, searching for multi-hop routes...');
    }

    // For multi-hop routes through WBNB
    try {
      const amounts = await this.publicClient.readContract({
        address: PANCAKE_ROUTER_V2,
        abi: PANCAKE_ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [amountIn, [tokenIn, WBNB_ADDRESS, tokenOut]]
      });

      return {
        path: [tokenIn, WBNB_ADDRESS, tokenOut],
        amountOut: amounts[2],
        hops: 2
      };
    } catch (error) {
      throw new Error(`No valid swap path found for ${tokenIn} → ${tokenOut}`);
    }
  }

  /**
   * Get multiple quotes for comparison
   */
  async getMultipleQuotes(
    tokenIn: Address,
    tokenOut: Address,
    amountIn: string
  ) {
    const amountInWei = parseUnits(amountIn, 18);

    try {
      const directPath = await this.findBestPath(tokenIn, tokenOut, amountInWei);

      return {
        bestPath: directPath,
        alternatives: [], // Could add other DEXes here
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Failed to get quotes: ${error.message}`);
    }
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  swapExamples().catch(console.error);
}