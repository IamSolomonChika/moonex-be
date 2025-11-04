/**
 * BSC Liquidity Service (Viem)
 * Handles liquidity provision and removal operations on PancakeSwap using Viem
 */

import { formatUnits, parseUnits, Hex, Address, createPublicClient, createWalletClient, http, getContract } from 'viem';
import { bsc } from 'viem/chains';
import { parseAbi } from 'viem';
import logger from '../../../utils/logger.js';
import type {
  LiquidityQuoteViem,
  LiquidityOperationViem,
  LiquidityPositionViem,
  LiquidityRequestViem,
  LiquidityOptionsViem,
  LiquidityErrorViem,
  LiquidityErrorCodeViem,
  LiquidityWarningViem,
  LiquidityRiskLevelViem,
  TokenInfoViem,
  FarmInfoViem
} from '../types/liquidity-types-viem.js';
import { BSCCacheManager } from '../cache/cache-manager.js';
import { BSCGasOptimizationServiceViem } from '../trading/gas-optimization-viem.js';

/**
 * Liquidity Service Interface (Viem)
 */
export interface ILiquidityServiceViem {
  // Quote and estimation
  getAddLiquidityQuote(request: LiquidityRequestViem): Promise<LiquidityQuoteViem>;
  getRemoveLiquidityQuote(poolAddress: Address, liquidity: string): Promise<LiquidityQuoteViem>;

  // Liquidity operations
  addLiquidity(request: LiquidityRequestViem, privateKey: string): Promise<LiquidityOperationViem>;
  removeLiquidity(poolAddress: Address, liquidity: string, privateKey: string): Promise<LiquidityOperationViem>;

  // Position management
  getPositions(userAddress: Address): Promise<LiquidityPositionViem[]>;
  getPosition(positionId: string): Promise<LiquidityPositionViem | null>;
  updatePosition(positionId: string): Promise<LiquidityPositionViem>;

  // Farming operations
  stakeInFarm(poolAddress: Address, liquidity: string, privateKey: string): Promise<LiquidityOperationViem>;
  unstakeFromFarm(poolAddress: Address, liquidity: string, privateKey: string): Promise<LiquidityOperationViem>;
  claimFarmRewards(poolAddress: Address, privateKey: string): Promise<Hex>;

  // Batch operations
  batchAddLiquidity(requests: LiquidityRequestViem[], privateKey: string): Promise<LiquidityOperationViem[]>;
  batchRemoveLiquidity(operations: { poolAddress: Address; liquidity: string }[], privateKey: string): Promise<LiquidityOperationViem[]>;

  // Analytics
  getLiquidityHistory(userAddress: Address, limit?: number): Promise<LiquidityOperationViem[]>;
  getLiquidityMetrics(timeframe?: string): Promise<any>;

  // Health and status
  healthCheck(): Promise<boolean>;
  getServiceStatus(): Promise<any>;
}

/**
 * Liquidity Service Implementation (Viem)
 */
export class LiquidityServiceViem implements ILiquidityServiceViem {
  private publicClient: any; // Simplified type for Viem 2.38.5 compatibility
  private cache: BSCCacheManager;
  private gasOptimizationService: BSCGasOptimizationServiceViem;

  // Contract instances
  private routerContract: any;
  private masterChefContract?: any;

  // Configuration
  private config: {
    defaultOptions: LiquidityOptionsViem;
    gasConfig: any;
  };

  // Operation tracking
  private pendingOperations: Map<string, LiquidityOperationViem> = new Map();

  // Known addresses
  private readonly WBNB_ADDRESS: Address = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
  private readonly PANCAKESWAP_ROUTER: Address = '0x10ed43c718714eb63d5aa57b78b54704e256024e';
  private readonly PANCAKESWAP_MASTER_CHEF: Address = '0x73feaa1eE314F8c655E354234017bE2193C9E24E';
  private readonly PANCAKESWAP_FACTORY: Address = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';

  // Contract ABIs (simplified for compatibility)
  private readonly ROUTER_ABI = parseAbi([
    'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)',
    'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)',
    'function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB)',
    'function removeLiquidityETH(address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external returns (uint amountToken, uint amountETH)',
    'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
    'function quote(uint amountA, uint reserveA, uint reserveB) external pure returns (uint amountB)',
    'function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) external pure returns (uint amountIn)'
  ]);

  private readonly PAIR_ABI = parseAbi([
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function totalSupply() external view returns (uint256)',
    'function balanceOf(address owner) external view returns (uint256)',
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function transfer(address to, uint256 amount) external returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
    'function token0() external view returns (address)',
    'function token1() external view returns (address)'
  ]);

  private readonly ERC20_ABI = parseAbi([
    'function balanceOf(address owner) external view returns (uint256)',
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function transfer(address to, uint256 amount) external returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
    'function decimals() external view returns (uint8)',
    'function symbol() external view returns (string)',
    'function name() external view returns (string)'
  ]);

  private readonly MASTERCHEF_ABI = parseAbi([
    'function deposit(uint256 pid, uint256 amount) external',
    'function withdraw(uint256 pid, uint256 amount) external',
    'function harvest(uint256 pid, address to) external',
    'function pendingCake(uint256 pid, address user) external view returns (uint256)',
    'function userInfo(uint256 pid, address user) external view returns (uint256 amount, uint256 rewardDebt)',
    'function poolInfo(uint256 pid) external view returns (address lpToken, uint256 allocPoint, uint256 lastRewardBlock, uint256 accCakePerShare)'
  ]);

  constructor(config?: { defaultOptions?: Partial<LiquidityOptionsViem> }) {
    this.publicClient = createPublicClient({
      chain: bsc,
      transport: http()
    });

    this.cache = new BSCCacheManager();
    this.gasOptimizationService = new BSCGasOptimizationServiceViem();

    // Configuration
    this.config = {
      defaultOptions: {
        slippageToleranceBps: 50, // 0.5%
        deadlineMinutes: 20,
        autoApprove: true,
        approveGasLimit: '50000',
        autoStake: false,
        maxPriceImpact: 5,
        requireVerification: true,
        ...config?.defaultOptions
      },
      gasConfig: {
        addLiquidity: 200000,
        removeLiquidity: 200000,
        approve: 50000,
        stake: 100000,
        unstake: 100000
      }
    };

    // Initialize contracts
    this.initializeContracts();
  }

  private async initializeContracts(): Promise<void> {
    // Router contract
    this.routerContract = getContract({
      address: this.PANCAKESWAP_ROUTER,
      abi: this.ROUTER_ABI,
      client: this.publicClient
    });

    // MasterChef contract
    this.masterChefContract = getContract({
      address: this.PANCAKESWAP_MASTER_CHEF,
      abi: this.MASTERCHEF_ABI,
      client: this.publicClient
    });
  }

  /**
   * Get quote for adding liquidity using Viem
   */
  async getAddLiquidityQuote(request: LiquidityRequestViem): Promise<LiquidityQuoteViem> {
    logger.debug({ request }, 'Getting add liquidity quote (Viem)');

    try {
      // Validate request
      this.validateLiquidityRequest(request);

      // Get token information
      const [tokenA, tokenB] = await Promise.all([
        this.getTokenInfo(request.tokenA),
        this.getTokenInfo(request.tokenB)
      ]);

      // Get or create pool
      const pairAddress = await this.getPairAddress(request.tokenA, request.tokenB);
      let pool = await this.getPoolInfo(pairAddress);

      if (!pool || pool.totalSupply === '0') {
        // Create new pool logic
        pool = {
          address: pairAddress,
          token0: request.tokenA.toLowerCase() < request.tokenB.toLowerCase() ? request.tokenA : request.tokenB,
          token1: request.tokenA.toLowerCase() < request.tokenB.toLowerCase() ? request.tokenB : request.tokenA,
          reserve0: '0',
          reserve1: '0',
          totalSupply: '0'
        };
      }

      // Calculate amounts and liquidity
      let amountBOut: string;
      let liquidityOut: string;

      if (request.amountB) {
        // Both amounts specified - check ratio
        const currentRatio = parseFloat(pool.reserve1) / parseFloat(pool.reserve0);
        const desiredRatio = parseFloat(request.amountB) / parseFloat(request.amountA);
        const priceImpact = Math.abs(desiredRatio - currentRatio) / currentRatio * 100;

        amountBOut = request.amountB;
        liquidityOut = await this.calculateLiquidity(
          pool,
          request.amountA,
          amountBOut
        );
      } else {
        // Only amountA specified - calculate optimal amountB
        amountBOut = await this.calculateOptimalAmountB(
          pool,
          request.amountA
        );
        liquidityOut = await this.calculateLiquidity(
          pool,
          request.amountA,
          amountBOut
        );
      }

      // Calculate price impact
      const priceImpact = await this.calculatePriceImpact(
        pool,
        request.amountA,
        amountBOut
      );

      // Calculate share of pool
      const shareOfPool = parseFloat(liquidityOut) / parseFloat(pool.totalSupply || '1') * 100;

      // Get gas estimate
      const gasEstimate = await this.gasOptimizationService.estimateGasForSwap({
        amountIn: request.amountA,
        amountOut: amountBOut,
        tokenIn: tokenA,
        tokenOut: tokenB,
        gasPrice: parseUnits('20', 'gwei').toString()
      } as any);

      // Build quote
      const quote: LiquidityQuoteViem = {
        tokenA,
        tokenB,
        amountA: request.amountA,
        amountB: amountBOut,
        isETH: request.tokenA === this.WBNB_ADDRESS || request.tokenB === this.WBNB_ADDRESS,
        amountBOut,
        liquidityOut,
        shareOfPool,
        priceImpact,
        reservesChange: {
          reserve0Change: request.amountA,
          reserve1Change: amountBOut,
          priceChange: priceImpact
        },
        gasEstimate: {
          gasLimit: gasEstimate.gasLimit,
          gasPrice: gasEstimate.gasPrice,
          maxFeePerGas: gasEstimate.maxFeePerGas,
          maxPriorityFeePerGas: gasEstimate.maxPriorityFeePerGas,
          estimatedCostBNB: gasEstimate.estimatedCostBNB,
          estimatedCostUSD: gasEstimate.estimatedCostUSD
        },
        deadline: Date.now() + (request.deadlineMinutes || this.config.defaultOptions.deadlineMinutes) * 60000,
        validUntil: Date.now() + 300000, // 5 minutes
        warnings: [],
        riskLevel: this.assessLiquidityRisk(priceImpact, shareOfPool)
      };

      // Add warnings if needed
      if (priceImpact > this.config.defaultOptions.maxPriceImpact) {
        quote.warnings.push(LiquidityWarningViem.HIGH_PRICE_IMPACT);
      }

      if (shareOfPool > 50) {
        quote.warnings.push(LiquidityWarningViem.LOW_LIQUIDITY);
      }

      return quote;

    } catch (error) {
      logger.error({
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get add liquidity quote');
      throw error;
    }
  }

  /**
   * Get quote for removing liquidity using Viem
   */
  async getRemoveLiquidityQuote(poolAddress: Address, liquidity: string): Promise<LiquidityQuoteViem> {
    logger.debug({ poolAddress, liquidity }, 'Getting remove liquidity quote (Viem)');

    try {
      // Get pool information
      const pool = await this.getPoolInfo(poolAddress);
      if (!pool) {
        throw new LiquidityErrorViem(
          LiquidityErrorCodeViem.POOL_NOT_FOUND,
          'Pool not found'
        );
      }

      // Calculate expected token amounts
      const totalSupply = parseFloat(pool.totalSupply);
      const shareOfPool = parseFloat(liquidity) / totalSupply;

      const amountA = (parseFloat(pool.reserve0) * parseFloat(liquidity)) / totalSupply;
      const amountB = (parseFloat(pool.reserve1) * parseFloat(liquidity)) / totalSupply;

      // Get token information
      const [tokenA, tokenB] = await Promise.all([
        this.getTokenInfo(pool.token0),
        this.getTokenInfo(pool.token1)
      ]);

      // Get gas estimate
      const gasEstimate = await this.gasOptimizationService.estimateGasForSwap({
        amountIn: liquidity,
        amountOut: '0',
        tokenIn: { address: poolAddress, symbol: 'LP', decimals: 18, name: 'LP Token', priceUSD: 0 },
        tokenOut: tokenA,
        gasPrice: parseUnits('20', 'gwei').toString()
      } as any);

      // Build quote
      const quote: LiquidityQuoteViem = {
        tokenA,
        tokenB,
        amountA: amountA.toString(),
        amountB: amountB.toString(),
        isETH: pool.token0 === this.WBNB_ADDRESS || pool.token1 === this.WBNB_ADDRESS,
        liquidityOut: liquidity,
        shareOfPool,
        priceImpact: 0, // Removing liquidity typically doesn't have price impact
        reservesChange: {
          reserve0Change: `-${amountA.toString()}`,
          reserve1Change: `-${amountB.toString()}`,
          priceChange: 0
        },
        gasEstimate: {
          gasLimit: gasEstimate.gasLimit,
          gasPrice: gasEstimate.gasPrice,
          maxFeePerGas: gasEstimate.maxFeePerGas,
          maxPriorityFeePerGas: gasEstimate.maxPriorityFeePerGas,
          estimatedCostBNB: gasEstimate.estimatedCostBNB,
          estimatedCostUSD: gasEstimate.estimatedCostUSD
        },
        deadline: Date.now() + this.config.defaultOptions.deadlineMinutes * 60000,
        validUntil: Date.now() + 300000,
        warnings: [],
        riskLevel: LiquidityRiskLevelViem.LOW
      };

      return quote;

    } catch (error) {
      logger.error({
        poolAddress,
        liquidity,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get remove liquidity quote');
      throw error;
    }
  }

  /**
   * Add liquidity to a pool using Viem
   */
  async addLiquidity(request: LiquidityRequestViem, privateKey: string): Promise<LiquidityOperationViem> {
    logger.debug({ request }, 'Adding liquidity (Viem)');

    try {
      // Get quote
      const quote = await this.getAddLiquidityQuote(request);

      // Create wallet client
      const walletClient = createWalletClient({
        chain: bsc,
        transport: http(),
        account: privateKey as `0x${string}`
      });

      const userAddress = walletClient.account.address;

      // Check for approvals if needed
      await this.checkAndApproveTokens(quote, walletClient);

      // Build transaction
      const transaction = await this.buildAddLiquidityTransaction(quote, request);

      // Execute transaction
      const txHash = await walletClient.sendTransaction({
        to: transaction.to,
        data: transaction.data,
        value: BigInt(transaction.value),
        gas: BigInt(transaction.gasLimit),
        maxFeePerGas: transaction.maxFeePerGas ? BigInt(transaction.maxFeePerGas) : undefined,
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas ? BigInt(transaction.maxPriorityFeePerGas) : undefined
      });

      // Create operation record
      const operation: LiquidityOperationViem = {
        id: txHash,
        type: 'add',
        userAddress,
        poolAddress: '', // Would be populated from transaction
        amountA: request.amountA,
        amountB: quote.amountBOut!,
        amountETH: quote.isETH ? quote.amountBOut : undefined,
        liquidity: quote.liquidityOut,
        valueUSD: 0, // Would calculate
        slippage: quote.priceImpact,
        transactionHash: txHash,
        blockNumber: 0,
        timestamp: Date.now(),
        gasUsed: '0',
        gasCostUSD: 0,
        status: 'pending',
        confirmations: 0
      };

      // Track operation
      this.pendingOperations.set(txHash, operation);

      // Monitor transaction
      this.monitorOperation(txHash);

      logger.info({
        hash: txHash,
        userAddress,
        amountA: request.amountA,
        amountB: quote.amountBOut,
        liquidity: quote.liquidityOut
      }, 'Liquidity addition submitted (Viem)');

      return operation;

    } catch (error) {
      logger.error({
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to add liquidity');

      if (error instanceof Error && error.message.includes('insufficient funds')) {
        throw new LiquidityErrorViem(
          LiquidityErrorCodeViem.INSUFFICIENT_BALANCE,
          'Insufficient balance for liquidity addition'
        );
      }

      throw error;
    }
  }

  /**
   * Remove liquidity from a pool using Viem
   */
  async removeLiquidity(poolAddress: Address, liquidity: string, privateKey: string): Promise<LiquidityOperationViem> {
    logger.debug({ poolAddress, liquidity }, 'Removing liquidity (Viem)');

    try {
      // Get quote
      const quote = await this.getRemoveLiquidityQuote(poolAddress, liquidity);

      // Create wallet client
      const walletClient = createWalletClient({
        chain: bsc,
        transport: http(),
        account: privateKey as `0x${string}`
      });

      const userAddress = walletClient.account.address;

      // Build transaction
      const transaction = await this.buildRemoveLiquidityTransaction(quote, poolAddress);

      // Execute transaction
      const txHash = await walletClient.sendTransaction({
        to: transaction.to,
        data: transaction.data,
        value: BigInt(transaction.value),
        gas: BigInt(transaction.gasLimit),
        maxFeePerGas: transaction.maxFeePerGas ? BigInt(transaction.maxFeePerGas) : undefined,
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas ? BigInt(transaction.maxPriorityFeePerGas) : undefined
      });

      // Create operation record
      const operation: LiquidityOperationViem = {
        id: txHash,
        type: 'remove',
        userAddress,
        poolAddress,
        amountA: quote.amountA,
        amountB: quote.amountB,
        amountETH: quote.isETH ? quote.amountA : undefined,
        liquidity,
        valueUSD: 0,
        slippage: 0,
        transactionHash: txHash,
        blockNumber: 0,
        timestamp: Date.now(),
        gasUsed: '0',
        gasCostUSD: 0,
        status: 'pending',
        confirmations: 0
      };

      // Track operation
      this.pendingOperations.set(txHash, operation);

      // Monitor transaction
      this.monitorOperation(txHash);

      logger.info({
        hash: txHash,
        userAddress,
        poolAddress,
        liquidity,
        amountA: quote.amountA,
        amountB: quote.amountB
      }, 'Liquidity removal submitted (Viem)');

      return operation;

    } catch (error) {
      logger.error({
        poolAddress,
        liquidity,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to remove liquidity');
      throw error;
    }
  }

  /**
   * Get all positions for a user using Viem
   */
  async getPositions(userAddress: Address): Promise<LiquidityPositionViem[]> {
    logger.debug({ userAddress }, 'Getting user positions (Viem)');

    try {
      // This would fetch from database or blockchain
      // For now, return empty array as placeholder
      return [];

    } catch (error) {
      logger.error({
        userAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get positions');
      return [];
    }
  }

  /**
   * Get specific position using Viem
   */
  async getPosition(positionId: string): Promise<LiquidityPositionViem | null> {
    logger.debug({ positionId }, 'Getting position (Viem)');

    try {
      // This would fetch from database
      return null;

    } catch (error) {
      logger.error({
        positionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get position');
      return null;
    }
  }

  /**
   * Update position using Viem
   */
  async updatePosition(positionId: string): Promise<LiquidityPositionViem> {
    logger.debug({ positionId }, 'Updating position (Viem)');

    try {
      // This would recalculate position metrics
      // For now, return placeholder
      const position: LiquidityPositionViem = {
        id: positionId,
        userAddress: '0x' as Address,
        poolAddress: '0x' as Address,
        poolId: '',
        pool: {
          id: '',
          address: '0x' as Address,
          token0: {
            address: '0x' as Address,
            symbol: '',
            name: '',
            decimals: 18,
            priceUSD: 0
          },
          token1: {
            address: '0x' as Address,
            symbol: '',
            name: '',
            decimals: 18,
            priceUSD: 0
          },
          pairAddress: '0x' as Address,
          isStable: false,
          reserve0: '0',
          reserve1: '0',
          totalSupply: '0',
          liquidity: '0',
          apr: 0,
          volume24h: '0',
          volume7d: '0',
          price0: 0,
          price1: 0,
          priceUSD: 0,
          fee: 0,
          feeTier: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 'v2'
        },
        liquidityAmount: '0',
        liquidityUSD: 0,
        shareOfPool: 0,
        amount0: '0',
        amount1: '0',
        valueUSD: 0,
        unrealizedPnL: 0,
        impermanentLoss: 0,
        feesEarned: '0',
        rewardsEarned: '0',
        apr: 0,
        totalReturn: 0,
        totalReturnUSD: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        duration: 0,
        isActive: false,
        isStaked: false,
        isFarm: false
      };

      return position;

    } catch (error) {
      logger.error({
        positionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to update position');
      throw error;
    }
  }

  /**
   * Stake liquidity in farm using Viem
   */
  async stakeInFarm(poolAddress: Address, liquidity: string, privateKey: string): Promise<LiquidityOperationViem> {
    logger.debug({ poolAddress, liquidity }, 'Staking in farm (Viem)');

    try {
      // Get farm info
      const farmInfo = await this.getFarmInfo(poolAddress);
      if (!farmInfo) {
        throw new LiquidityErrorViem(
          LiquidityErrorCodeViem.CONTRACT_ERROR,
          'Pool not available for farming'
        );
      }

      // Create wallet client
      const walletClient = createWalletClient({
        chain: bsc,
        transport: http(),
        account: privateKey as `0x${string}`
      });

      const userAddress = walletClient.account.address;

      // Build transaction
      const transaction = await this.buildStakeTransaction(farmInfo.poolId, liquidity);

      // Execute transaction
      const txHash = await walletClient.sendTransaction({
        to: transaction.to,
        data: transaction.data,
        value: BigInt(transaction.value),
        gas: BigInt(transaction.gasLimit)
      });

      // Create operation record
      const operation: LiquidityOperationViem = {
        id: txHash,
        type: 'add',
        userAddress,
        poolAddress,
        farmId: farmInfo.id,
        amountA: '0',
        amountB: '0',
        liquidity,
        valueUSD: 0,
        slippage: 0,
        transactionHash: txHash,
        blockNumber: 0,
        timestamp: Date.now(),
        gasUsed: '0',
        gasCostUSD: 0,
        status: 'pending',
        confirmations: 0
      };

      logger.info({
        hash: txHash,
        userAddress,
        poolAddress,
        farmId: farmInfo.id,
        liquidity
      }, 'Farm stake submitted (Viem)');

      return operation;

    } catch (error) {
      logger.error({
        poolAddress,
        liquidity,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to stake in farm');
      throw error;
    }
  }

  /**
   * Unstake liquidity from farm using Viem
   */
  async unstakeFromFarm(poolAddress: Address, liquidity: string, privateKey: string): Promise<LiquidityOperationViem> {
    logger.debug({ poolAddress, liquidity }, 'Unstaking from farm (Viem)');

    try {
      // Get farm info
      const farmInfo = await this.getFarmInfo(poolAddress);
      if (!farmInfo) {
        throw new LiquidityErrorViem(
          LiquidityErrorCodeViem.CONTRACT_ERROR,
          'Pool not available for farming'
        );
      }

      // Create wallet client
      const walletClient = createWalletClient({
        chain: bsc,
        transport: http(),
        account: privateKey as `0x${string}`
      });

      const userAddress = walletClient.account.address;

      // Build transaction
      const transaction = await this.buildUnstakeTransaction(farmInfo.poolId, liquidity);

      // Execute transaction
      const txHash = await walletClient.sendTransaction({
        to: transaction.to,
        data: transaction.data,
        value: BigInt(transaction.value),
        gas: BigInt(transaction.gasLimit)
      });

      // Create operation record
      const operation: LiquidityOperationViem = {
        id: txHash,
        type: 'remove',
        userAddress,
        poolAddress,
        farmId: farmInfo.id,
        amountA: '0',
        amountB: '0',
        liquidity,
        valueUSD: 0,
        slippage: 0,
        transactionHash: txHash,
        blockNumber: 0,
        timestamp: Date.now(),
        gasUsed: '0',
        gasCostUSD: 0,
        status: 'pending',
        confirmations: 0
      };

      logger.info({
        hash: txHash,
        userAddress,
        poolAddress,
        farmId: farmInfo.id,
        liquidity
      }, 'Farm unstake submitted (Viem)');

      return operation;

    } catch (error) {
      logger.error({
        poolAddress,
        liquidity,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to unstake from farm');
      throw error;
    }
  }

  /**
   * Claim farm rewards using Viem
   */
  async claimFarmRewards(poolAddress: Address, privateKey: string): Promise<Hex> {
    logger.debug({ poolAddress }, 'Claiming farm rewards (Viem)');

    try {
      // Get farm info
      const farmInfo = await this.getFarmInfo(poolAddress);
      if (!farmInfo) {
        throw new LiquidityErrorViem(
          LiquidityErrorCodeViem.CONTRACT_ERROR,
          'Pool not available for farming'
        );
      }

      // Create wallet client
      const walletClient = createWalletClient({
        chain: bsc,
        transport: http(),
        account: privateKey as `0x${string}`
      });

      const userAddress = walletClient.account.address;

      // Build transaction
      const transaction = await this.buildClaimRewardsTransaction(farmInfo.poolId, userAddress);

      // Execute transaction
      const txHash = await walletClient.sendTransaction({
        to: transaction.to,
        data: transaction.data,
        value: BigInt(transaction.value),
        gas: BigInt(transaction.gasLimit)
      });

      logger.info({
        hash: txHash,
        userAddress,
        poolAddress,
        farmId: farmInfo.id
      }, 'Farm rewards claimed (Viem)');

      return txHash;

    } catch (error) {
      logger.error({
        poolAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to claim farm rewards');
      throw error;
    }
  }

  /**
   * Batch add liquidity using Viem
   */
  async batchAddLiquidity(requests: LiquidityRequestViem[], privateKey: string): Promise<LiquidityOperationViem[]> {
    logger.debug({ count: requests.length }, 'Batch adding liquidity (Viem)');

    try {
      const operations = await Promise.allSettled(
        requests.map(request => this.addLiquidity(request, privateKey))
      );

      return operations
        .filter((result): result is PromiseFulfilledResult<LiquidityOperationViem> => result.status === 'fulfilled')
        .map(result => result.value);

    } catch (error) {
      logger.error({
        count: requests.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to batch add liquidity');
      throw error;
    }
  }

  /**
   * Batch remove liquidity using Viem
   */
  async batchRemoveLiquidity(
    operations: { poolAddress: Address; liquidity: string }[],
    privateKey: string
  ): Promise<LiquidityOperationViem[]> {
    logger.debug({ count: operations.length }, 'Batch removing liquidity (Viem)');

    try {
      const results = await Promise.allSettled(
        operations.map(op => this.removeLiquidity(op.poolAddress, op.liquidity, privateKey))
      );

      return results
        .filter((result): result is PromiseFulfilledResult<LiquidityOperationViem> => result.status === 'fulfilled')
        .map(result => result.value);

    } catch (error) {
      logger.error({
        count: operations.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to batch remove liquidity');
      throw error;
    }
  }

  /**
   * Get liquidity history using Viem
   */
  async getLiquidityHistory(userAddress: Address, limit: number = 100): Promise<LiquidityOperationViem[]> {
    logger.debug({ userAddress, limit }, 'Getting liquidity history (Viem)');

    try {
      // This would fetch from database
      return [];

    } catch (error) {
      logger.error({
        userAddress,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get liquidity history');
      return [];
    }
  }

  /**
   * Get liquidity metrics using Viem
   */
  async getLiquidityMetrics(timeframe?: string): Promise<any> {
    logger.debug({ timeframe }, 'Getting liquidity metrics (Viem)');

    try {
      // This would return analytics data
      return {
        totalLiquidity: '0',
        totalPositions: 0,
        averageAPR: 0,
        totalFees: '0',
        timestamp: Date.now()
      };

    } catch (error) {
      logger.error({
        timeframe,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get liquidity metrics');
      throw error;
    }
  }

  /**
   * Health check using Viem
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if we can connect to the blockchain
      const blockNumber = await this.publicClient.getBlockNumber();
      return blockNumber > 0;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Liquidity service health check failed');
      return false;
    }
  }

  /**
   * Get service status using Viem
   */
  async getServiceStatus(): Promise<any> {
    try {
      return {
        healthy: await this.healthCheck(),
        pendingOperations: this.pendingOperations.size,
        supportedNetworks: ['BSC'],
        contracts: {
          router: this.PANCAKESWAP_ROUTER,
          masterChef: this.PANCAKESWAP_MASTER_CHEF,
          factory: this.PANCAKESWAP_FACTORY
        },
        timestamp: Date.now()
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get service status');
      throw error;
    }
  }

  // Private helper methods

  private validateLiquidityRequest(request: LiquidityRequestViem): void {
    if (!request.tokenA || !request.tokenB) {
      throw new LiquidityErrorViem(
        LiquidityErrorCodeViem.INVALID_AMOUNT,
        'Token addresses are required'
      );
    }

    if (!request.amountA) {
      throw new LiquidityErrorViem(
        LiquidityErrorCodeViem.INVALID_AMOUNT,
        'Amount A is required'
      );
    }

    if (request.slippageToleranceBps && request.slippageToleranceBps > 1000) { // 10%
      throw new LiquidityErrorViem(
        LiquidityErrorCodeViem.SLIPPAGE_TOO_HIGH,
        'Slippage tolerance too high'
      );
    }
  }

  private async getTokenInfo(address: Address): Promise<TokenInfoViem> {
    try {
      const isWBNB = address.toLowerCase() === this.WBNB_ADDRESS.toLowerCase();

      if (isWBNB) {
        return {
          address,
          symbol: 'WBNB',
          name: 'Wrapped BNB',
          decimals: 18,
          priceUSD: 0
        };
      }

      // Get token info from contract
      const tokenContract = getContract({
        address,
        abi: this.ERC20_ABI,
        client: this.publicClient
      });

      const [symbol, name, decimals] = await Promise.all([
        tokenContract.read.symbol(),
        tokenContract.read.name(),
        tokenContract.read.decimals()
      ]);

      return {
        address,
        symbol,
        name,
        decimals,
        priceUSD: 0 // Would get from price oracle
      };
    } catch (error) {
      logger.debug({ address, error }, 'Failed to get token info');
      return {
        address,
        symbol: 'UNKNOWN',
        name: 'Unknown Token',
        decimals: 18,
        priceUSD: 0
      };
    }
  }

  private async getPairAddress(tokenA: Address, tokenB: Address): Promise<Address> {
    // This would use PancakeSwap factory to get pair address
    // For now, return placeholder
    return '0x' as Address;
  }

  private async getPoolInfo(pairAddress: Address): Promise<any> {
    try {
      const pairContract = getContract({
        address: pairAddress,
        abi: this.PAIR_ABI,
        client: this.publicClient
      });

      const [reserves, totalSupply] = await Promise.all([
        pairContract.read.getReserves(),
        pairContract.read.totalSupply()
      ]);

      const [token0, token1] = await Promise.all([
        pairContract.read.token0(),
        pairContract.read.token1()
      ]);

      return {
        address: pairAddress,
        token0,
        token1,
        reserve0: reserves[0].toString(),
        reserve1: reserves[1].toString(),
        totalSupply: totalSupply.toString()
      };
    } catch (error) {
      logger.debug({ pairAddress, error }, 'Failed to get pool info');
      return null;
    }
  }

  private async calculateOptimalAmountB(pool: any, amountA: string): Promise<string> {
    // Simplified calculation - would use Uniswap's getAmountsOut
    const ratio = parseFloat(pool.reserve1) / parseFloat(pool.reserve0);
    return (parseFloat(amountA) * ratio).toString();
  }

  private async calculateLiquidity(pool: any, amountA: string, amountB: string): Promise<string> {
    // Simplified liquidity calculation
    const totalSupply = parseFloat(pool.totalSupply);
    if (totalSupply === 0) {
      // New pool - calculate based on geometric mean
      return Math.sqrt(parseFloat(amountA) * parseFloat(amountB)).toString();
    }

    // Existing pool - calculate proportionally
    const shareOfPool = (parseFloat(amountA) / parseFloat(pool.reserve0));
    return (totalSupply * shareOfPool).toString();
  }

  private async calculatePriceImpact(pool: any, amountA: string, amountB: string): Promise<number> {
    // Simplified price impact calculation
    const currentPrice = parseFloat(pool.reserve1) / parseFloat(pool.reserve0);
    const newPrice = (parseFloat(pool.reserve1) + parseFloat(amountB)) / (parseFloat(pool.reserve0) + parseFloat(amountA));

    return Math.abs((newPrice - currentPrice) / currentPrice) * 100;
  }

  private assessLiquidityRisk(priceImpact: number, shareOfPool: number): LiquidityRiskLevelViem {
    if (priceImpact > 10 || shareOfPool > 80) {
      return LiquidityRiskLevelViem.VERY_HIGH;
    }
    if (priceImpact > 5 || shareOfPool > 50) {
      return LiquidityRiskLevelViem.HIGH;
    }
    if (priceImpact > 2 || shareOfPool > 25) {
      return LiquidityRiskLevelViem.MEDIUM;
    }
    return LiquidityRiskLevelViem.LOW;
  }

  private async checkAndApproveTokens(quote: LiquidityQuoteViem, walletClient: any): Promise<void> {
    if (!this.config.defaultOptions.autoApprove) {
      return;
    }

    const userAddress = walletClient.account.address;

    // Check and approve token A
    const allowanceA = await this.getTokenAllowance(
      quote.tokenA.address,
      userAddress,
      this.PANCAKESWAP_ROUTER
    );

    if (BigInt(allowanceA) < BigInt(quote.amountA)) {
      await this.approveToken(quote.tokenA.address, walletClient);
    }

    // Check and approve token B if not ETH
    if (!quote.isETH) {
      const allowanceB = await this.getTokenAllowance(
        quote.tokenB.address,
        userAddress,
        this.PANCAKESWAP_ROUTER
      );

      if (BigInt(allowanceB) < BigInt(quote.amountB!)) {
        await this.approveToken(quote.tokenB.address, walletClient);
      }
    }
  }

  private async getTokenAllowance(tokenAddress: Address, owner: Address, spender: Address): Promise<string> {
    const tokenContract = getContract({
      address: tokenAddress,
      abi: this.ERC20_ABI,
      client: this.publicClient
    });

    const allowance = await tokenContract.read.allowance([owner, spender]);
    return allowance.toString();
  }

  private async approveToken(tokenAddress: Address, walletClient: any): Promise<Hex> {
    const tokenContract = getContract({
      address: tokenAddress,
      abi: this.ERC20_ABI,
      client: walletClient
    });

    const maxAmount = parseUnits('115792089237316195423570985008687907322637443944578913850467616782713342524160', 'wei'); // Max uint256

    const txHash = await tokenContract.write.approve([this.PANCAKESWAP_ROUTER, maxAmount]);
    return txHash;
  }

  private async buildAddLiquidityTransaction(quote: LiquidityQuoteViem, request: LiquidityRequestViem): Promise<any> {
    const deadline = BigInt(Date.now() + (request.deadlineMinutes || this.config.defaultOptions.deadlineMinutes) * 60000);

    let data: Hex;
    let value: string;

    if (request.isETH) {
      // Add liquidity with ETH
      data = this.routerContract.write.addLiquidityETH([
        quote.tokenB.address,
        BigInt(request.amountA),
        BigInt('0'), // amountTokenMin - would calculate slippage
        BigInt('0'), // amountETHMin - would calculate slippage
        request.recipient,
        deadline
      ]) as any;

      value = quote.amountBOut!;
    } else {
      // Add liquidity with tokens
      data = this.routerContract.write.addLiquidity([
        quote.tokenA.address,
        quote.tokenB.address,
        BigInt(quote.amountA),
        BigInt(quote.amountB!),
        BigInt('0'), // amountAMin - would calculate slippage
        BigInt('0'), // amountBMin - would calculate slippage
        request.recipient,
        deadline
      ]) as any;

      value = '0';
    }

    return {
      to: this.PANCAKESWAP_ROUTER,
      data,
      value,
      gasLimit: quote.gasEstimate.gasLimit,
      maxFeePerGas: quote.gasEstimate.maxFeePerGas,
      maxPriorityFeePerGas: quote.gasEstimate.maxPriorityFeePerGas
    };
  }

  private async buildRemoveLiquidityTransaction(quote: LiquidityQuoteViem, poolAddress: Address): Promise<any> {
    const deadline = BigInt(Date.now() + this.config.defaultOptions.deadlineMinutes * 60000);

    let data: Hex;
    let value: string;

    if (quote.isETH) {
      // Remove liquidity with ETH
      data = this.routerContract.write.removeLiquidityETH([
        quote.tokenA.address,
        BigInt(quote.liquidityOut),
        BigInt('0'), // amountTokenMin - would calculate slippage
        BigInt('0'), // amountETHMin - would calculate slippage
        '0x0000000000000000000000000000000000000000000' as Address, // to address
        deadline
      ]) as any;

      value = '0';
    } else {
      // Remove liquidity with tokens
      data = this.routerContract.write.removeLiquidity([
        quote.tokenA.address,
        quote.tokenB.address,
        BigInt(quote.liquidityOut),
        BigInt('0'), // amountAMin - would calculate slippage
        BigInt('0'), // amountBMin - would calculate slippage
        '0x0000000000000000000000000000000000000000000' as Address, // to address
        deadline
      ]) as any;

      value = '0';
    }

    return {
      to: this.PANCAKESWAP_ROUTER,
      data,
      value,
      gasLimit: quote.gasEstimate.gasLimit,
      maxFeePerGas: quote.gasEstimate.maxFeePerGas,
      maxPriorityFeePerGas: quote.gasEstimate.maxPriorityFeePerGas
    };
  }

  private async getFarmInfo(poolAddress: Address): Promise<FarmInfoViem | null> {
    // This would fetch farm information from PancakeSwap farms
    // For now, return placeholder
    return {
      id: '1',
      poolId: 1,
      lpToken: poolAddress,
      allocPoint: 100,
      lastRewardBlock: 0,
      accCakePerShare: '0',
      cakePerBlock: '40',
      multiplier: '1x',
      totalDeposit: '0'
    };
  }

  private async buildStakeTransaction(poolId: number, liquidity: string): Promise<any> {
    const data = this.masterChefContract!.write.deposit([BigInt(poolId), BigInt(liquidity)]) as any;

    return {
      to: this.PANCAKESWAP_MASTER_CHEF,
      data,
      value: '0',
      gasLimit: this.config.gasConfig.stake
    };
  }

  private async buildUnstakeTransaction(poolId: number, liquidity: string): Promise<any> {
    const data = this.masterChefContract!.write.withdraw([BigInt(poolId), BigInt(liquidity)]) as any;

    return {
      to: this.PANCAKESWAP_MASTER_CHEF,
      data,
      value: '0',
      gasLimit: this.config.gasConfig.unstake
    };
  }

  private async buildClaimRewardsTransaction(poolId: number, userAddress: Address): Promise<any> {
    const data = this.masterChefContract!.write.harvest([BigInt(poolId), userAddress]) as any;

    return {
      to: this.PANCAKESWAP_MASTER_CHEF,
      data,
      value: '0',
      gasLimit: '100000'
    };
  }

  private async monitorOperation(hash: Hex): Promise<void> {
    const checkOperation = async () => {
      try {
        const operation = this.pendingOperations.get(hash);
        if (!operation) {
          return;
        }

        // Check transaction status
        const receipt = await this.publicClient.getTransactionReceipt({ hash });

        if (receipt) {
          // Transaction is confirmed
          operation.status = receipt.status === 'success' ? 'confirmed' : 'failed';
          operation.blockNumber = Number(receipt.blockNumber);
          operation.confirmations = 1;
          operation.gasUsed = receipt.gasUsed?.toString() || '0';

          // Update pending operations
          this.pendingOperations.delete(hash);

          // Update position if applicable
          if (operation.status === 'confirmed') {
            // Would update user's position
          }

          logger.info({
            hash,
            status: operation.status,
            blockNumber: operation.blockNumber
          }, 'Liquidity operation completed (Viem)');
        } else {
          // Still pending, check again in 2 seconds
          setTimeout(checkOperation, 2000);
        }

      } catch (error) {
        logger.error({
          hash,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'Error monitoring liquidity operation');
      }
    };

    // Start monitoring after a short delay
    setTimeout(checkOperation, 1000);
  }
}

// Export singleton instance
export const liquidityServiceViem = new LiquidityServiceViem();