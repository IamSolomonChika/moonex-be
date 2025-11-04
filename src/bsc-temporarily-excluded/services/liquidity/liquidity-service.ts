/**
 * BSC Liquidity Service
 * Handles liquidity provision and removal operations on PancakeSwap
 */

import { ethers } from 'ethers';
import logger from '../../../utils/logger.js';
import type {
  LiquidityQuote,
  LiquidityOperation,
  LiquidityPosition,
  LiquidityRequest,
  LiquidityOptions,
  LiquidityError,
  LiquidityErrorCode,
  LiquidityWarning,
  LiquidityRiskLevel,
  TokenInfo,
  FarmInfo
} from './types.js';
import { ILiquidityPoolIntegration, liquidityPoolIntegration } from './pool-integration.js';
import { BSCProviderManager } from '../../utils/ethers-provider.js';
import { BSCCacheManager } from '../cache/cache-manager.js';
import { BSCGasOptimizationService, bscGasOptimizationService } from '../trading/gas-optimization.js';
import {
  PANCAKESWAP_ROUTER_LIQUIDITY_ABI,
  PANCAKESWAP_PAIR_ABI,
  MASTERCHEF_V2_ABI
} from './types.js';

/**
 * Liquidity Service Interface
 */
export interface ILiquidityService {
  // Quote and estimation
  getAddLiquidityQuote(request: LiquidityRequest): Promise<LiquidityQuote>;
  getRemoveLiquidityQuote(poolAddress: string, liquidity: string): Promise<LiquidityQuote>;

  // Liquidity operations
  addLiquidity(request: LiquidityRequest, signer: ethers.Signer): Promise<LiquidityOperation>;
  removeLiquidity(poolAddress: string, liquidity: string, signer: ethers.Signer): Promise<LiquidityOperation>;

  // Position management
  getPositions(userAddress: string): Promise<LiquidityPosition[]>;
  getPosition(positionId: string): Promise<LiquidityPosition | null>;
  updatePosition(positionId: string): Promise<LiquidityPosition>;

  // Farming operations
  stakeInFarm(poolAddress: string, liquidity: string, signer: ethers.Signer): Promise<LiquidityOperation>;
  unstakeFromFarm(poolAddress: string, liquidity: string, signer: ethers.Signer): Promise<LiquidityOperation>;
  claimFarmRewards(poolAddress: string, signer: ethers.Signer): Promise<string>;

  // Batch operations
  batchAddLiquidity(requests: LiquidityRequest[], signer: ethers.Signer): Promise<LiquidityOperation[]>;
  batchRemoveLiquidity(operations: { poolAddress: string; liquidity: string }[], signer: ethers.Signer): Promise<LiquidityOperation[]>;

  // Analytics
  getLiquidityHistory(userAddress: string, limit?: number): Promise<LiquidityOperation[]>;
  getLiquidityMetrics(timeframe?: string): Promise<any>;

  // Health and status
  healthCheck(): Promise<boolean>;
  getServiceStatus(): Promise<any>;
}

/**
 * Liquidity Service Implementation
 */
export class LiquidityService implements ILiquidityService {
  private poolIntegration: ILiquidityPoolIntegration;
  private provider: BSCProviderManager;
  private cache: BSCCacheManager;
  private gasOptimizationService: BSCGasOptimizationService;

  // Contract instances
  private routerContract: ethers.Contract;
  private masterChefContract?: ethers.Contract;

  // Configuration
  private config: {
    defaultOptions: LiquidityOptions;
    gasConfig: any;
  };

  // Operation tracking
  private pendingOperations: Map<string, LiquidityOperation> = new Map();

  // Known addresses
  private readonly WBNB_ADDRESS = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
  private readonly PANCAKESWAP_ROUTER = '0x10ed43c718714eb63d5aa57b78b54704e256024e';
  private readonly PANCAKESWAP_MASTER_CHEF = '0x73feaa1eE314F8c655E354234017bE2193C9E24E';

  constructor(config?: { defaultOptions?: Partial<LiquidityOptions> }) {
    this.poolIntegration = liquidityPoolIntegration;
    this.provider = new BSCProviderManager();
    this.cache = new BSCCacheManager();
    this.gasOptimizationService = new BSCGasOptimizationService();

    // Configuration
    this.config = {
      defaultOptions: {
        slippageTolerance: 50, // 0.5%
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
    const provider = await this.provider.getProvider();

    // Router contract
    this.routerContract = new ethers.Contract(
      this.PANCAKESWAP_ROUTER,
      PANCAKESWAP_ROUTER_LIQUIDITY_ABI,
      provider
    );

    // MasterChef contract
    this.masterChefContract = new ethers.Contract(
      this.PANCAKESWAP_MASTER_CHEF,
      MASTERCHEF_V2_ABI,
      provider
    );
  }

  /**
   * Get quote for adding liquidity
   */
  async getAddLiquidityQuote(request: LiquidityRequest): Promise<LiquidityQuote> {
    logger.debug({ request }, 'Getting add liquidity quote');

    try {
      // Validate request
      this.validateLiquidityRequest(request);

      // Get token information
      const [tokenA, tokenB] = await Promise.all([
        this.getTokenInfo(request.tokenA),
        this.getTokenInfo(request.tokenB)
      ]);

      // Get or create pool
      let pool = await this.poolIntegration.getPool('');
      if (!pool) {
        // Create new pool
        pool = await this.poolIntegration.createPool(request.tokenA, request.tokenB);
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
      const shareOfPool = parseFloat(liquidityOut) / parseFloat(pool.totalSupply) * 100;

      // Get gas estimate
      const gasEstimate = await this.gasOptimizationService.estimateGasForSwap({
        amountIn: request.amountA,
        amountOut: amountBOut,
        tokenIn: tokenA,
        tokenOut: tokenB,
        // ... other parameters
      } as any);

      // Build quote
      const quote: LiquidityQuote = {
        tokenA,
        tokenB,
        amountA: request.amountA,
        amountB: amountBOut,
        isETH: request.isETH,
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
          estimatedCostETH: gasEstimate.estimatedCostBNB,
          estimatedCostUSD: gasEstimate.estimatedCostUSD
        },
        deadline: Date.now() + (request.deadlineMinutes || this.config.defaultOptions.deadlineMinutes) * 60000,
        validUntil: Date.now() + 300000, // 5 minutes
        warnings: [],
        riskLevel: this.assessLiquidityRisk(priceImpact, shareOfPool)
      };

      // Add warnings if needed
      if (priceImpact > this.config.defaultOptions.maxPriceImpact) {
        quote.warnings.push(LiquidityWarning.HIGH_PRICE_IMPACT);
      }

      if (shareOfPool > 50) {
        quote.warnings.push(LiquidityWarning.LOW_LIQUIDITY);
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
   * Get quote for removing liquidity
   */
  async getRemoveLiquidityQuote(poolAddress: string, liquidity: string): Promise<LiquidityQuote> {
    logger.debug({ poolAddress, liquidity }, 'Getting remove liquidity quote');

    try {
      // Get pool information
      const pool = await this.poolIntegration.getPool(poolAddress);
      if (!pool) {
        throw new LiquidityError(
          LiquidityErrorCode.POOL_NOT_FOUND,
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
        this.getTokenInfo(pool.token0.address),
        this.getTokenInfo(pool.token1.address)
      ]);

      // Get gas estimate
      const gasEstimate = await this.gasOptimizationService.estimateGasForSwap({
        amountIn: liquidity,
        amountOut: '0',
        tokenIn: { address: poolAddress, symbol: 'LP', decimals: 18 },
        tokenOut: tokenA,
        // ... other parameters
      } as any);

      // Build quote
      const quote: LiquidityQuote = {
        tokenA,
        tokenB,
        amountA: amountA.toString(),
        amountB: amountB.toString(),
        isETH: pool.token0.address === this.WBNB_ADDRESS || pool.token1.address === this.WBNB_ADDRESS,
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
          estimatedCostETH: gasEstimate.estimatedCostBNB,
          estimatedCostUSD: gasEstimate.estimatedCostUSD
        },
        deadline: Date.now() + this.config.defaultOptions.deadlineMinutes * 60000,
        validUntil: Date.now() + 300000,
        warnings: [],
        riskLevel: LiquidityRiskLevel.LOW
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
   * Add liquidity to a pool
   */
  async addLiquidity(request: LiquidityRequest, signer: ethers.Signer): Promise<LiquidityOperation> {
    logger.debug({ request }, 'Adding liquidity');

    try {
      // Get quote
      const quote = await this.getAddLiquidityQuote(request);

      // Check for approvals if needed
      await this.checkAndApproveTokens(quote, signer);

      // Build transaction
      const transaction = await this.buildAddLiquidityTransaction(quote, request);

      // Execute transaction
      const txResponse = await signer.sendTransaction({
        to: transaction.to,
        data: transaction.data,
        value: transaction.value,
        gasLimit: transaction.gasLimit,
        maxFeePerGas: transaction.maxFeePerGas,
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas
      });

      // Create operation record
      const operation: LiquidityOperation = {
        id: txResponse.hash,
        type: 'add',
        userAddress: await signer.getAddress(),
        poolAddress: '', // Would be populated from transaction
        amountA: request.amountA,
        amountB: quote.amountBOut!,
        amountETH: quote.isETH ? quote.amountBOut : undefined,
        liquidity: quote.liquidityOut,
        valueUSD: 0, // Would calculate
        slippage: quote.priceImpact,
        transactionHash: txResponse.hash,
        blockNumber: 0,
        timestamp: Date.now(),
        gasUsed: '0',
        gasCostUSD: 0,
        status: 'pending',
        confirmations: 0
      };

      // Track operation
      this.pendingOperations.set(txResponse.hash, operation);

      // Monitor transaction
      this.monitorOperation(txResponse.hash);

      logger.info({
        hash: txResponse.hash,
        userAddress: operation.userAddress,
        amountA: request.amountA,
        amountB: quote.amountBOut,
        liquidity: quote.liquidityOut
      }, 'Liquidity addition submitted');

      return operation;

    } catch (error) {
      logger.error({
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to add liquidity');

      if (error instanceof Error && error.message.includes('insufficient funds')) {
        throw new LiquidityError(
          LiquidityErrorCode.INSUFFICIENT_BALANCE,
          'Insufficient balance for liquidity addition'
        );
      }

      throw error;
    }
  }

  /**
   * Remove liquidity from a pool
   */
  async removeLiquidity(poolAddress: string, liquidity: string, signer: ethers.Signer): Promise<LiquidityOperation> {
    logger.debug({ poolAddress, liquidity }, 'Removing liquidity');

    try {
      // Get quote
      const quote = await this.getRemoveLiquidityQuote(poolAddress, liquidity);

      // Build transaction
      const transaction = await this.buildRemoveLiquidityTransaction(quote, poolAddress);

      // Execute transaction
      const txResponse = await signer.sendTransaction({
        to: transaction.to,
        data: transaction.data,
        value: transaction.value,
        gasLimit: transaction.gasLimit,
        maxFeePerGas: transaction.maxFeePerGas,
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas
      });

      // Create operation record
      const operation: LiquidityOperation = {
        id: txResponse.hash,
        type: 'remove',
        userAddress: await signer.getAddress(),
        poolAddress,
        amountA: quote.amountA,
        amountB: quote.amountB,
        amountETH: quote.isETH ? quote.amountA : undefined,
        liquidity,
        valueUSD: 0,
        slippage: 0,
        transactionHash: txResponse.hash,
        blockNumber: 0,
        timestamp: Date.now(),
        gasUsed: '0',
        gasCostUSD: 0,
        status: 'pending',
        confirmations: 0
      };

      // Track operation
      this.pendingOperations.set(txResponse.hash, operation);

      // Monitor transaction
      this.monitorOperation(txResponse.hash);

      logger.info({
        hash: txResponse.hash,
        userAddress: operation.userAddress,
        poolAddress,
        liquidity,
        amountA: quote.amountA,
        amountB: quote.amountB
      }, 'Liquidity removal submitted');

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
   * Get all positions for a user
   */
  async getPositions(userAddress: string): Promise<LiquidityPosition[]> {
    logger.debug({ userAddress }, 'Getting user positions');

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
   * Get specific position
   */
  async getPosition(positionId: string): Promise<LiquidityPosition | null> {
    logger.debug({ positionId }, 'Getting position');

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
   * Update position
   */
  async updatePosition(positionId: string): Promise<LiquidityPosition> {
    logger.debug({ positionId }, 'Updating position');

    try {
      // This would recalculate position metrics
      // For now, return placeholder
      const position: LiquidityPosition = {
        id: positionId,
        userAddress: '',
        poolAddress: '',
        poolId: '',
        pool: {
          id: '',
          address: '',
          token0: {
            address: '',
            symbol: '',
            name: '',
            decimals: 18
          },
          token1: {
            address: '',
            symbol: '',
            name: '',
            decimals: 18
          },
          pairAddress: '',
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
   * Stake liquidity in farm
   */
  async stakeInFarm(poolAddress: string, liquidity: string, signer: ethers.Signer): Promise<LiquidityOperation> {
    logger.debug({ poolAddress, liquidity }, 'Staking in farm');

    try {
      // Get farm info
      const farmInfo = await this.poolIntegration.getFarmInfo(poolAddress);
      if (!farmInfo) {
        throw new LiquidityError(
          LiquidityErrorCode.CONTRACT_ERROR,
          'Pool not available for farming'
        );
      }

      // Build transaction
      const transaction = await this.buildStakeTransaction(farmInfo.poolId, liquidity);

      // Execute transaction
      const txResponse = await signer.sendTransaction(transaction);

      // Create operation record
      const operation: LiquidityOperation = {
        id: txResponse.hash,
        type: 'add',
        userAddress: await signer.getAddress(),
        poolAddress,
        farmId: farmInfo.id,
        amountA: '0',
        amountB: '0',
        liquidity,
        valueUSD: 0,
        slippage: 0,
        transactionHash: txResponse.hash,
        blockNumber: 0,
        timestamp: Date.now(),
        gasUsed: '0',
        gasCostUSD: 0,
        status: 'pending',
        confirmations: 0
      };

      logger.info({
        hash: txResponse.hash,
        userAddress: operation.userAddress,
        poolAddress,
        farmId: farmInfo.id,
        liquidity
      }, 'Farm stake submitted');

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
   * Unstake liquidity from farm
   */
  async unstakeFromFarm(poolAddress: string, liquidity: string, signer: ethers.Signer): Promise<LiquidityOperation> {
    logger.debug({ poolAddress, liquidity }, 'Unstaking from farm');

    try {
      // Get farm info
      const farmInfo = await this.poolIntegration.getFarmInfo(poolAddress);
      if (!farmInfo) {
        throw new LiquidityError(
          LiquidityErrorCode.CONTRACT_ERROR,
          'Pool not available for farming'
        );
      }

      // Build transaction
      const transaction = await this.buildUnstakeTransaction(farmInfo.poolId, liquidity);

      // Execute transaction
      const txResponse = await signer.sendTransaction(transaction);

      // Create operation record
      const operation: LiquidityOperation = {
        id: txResponse.hash,
        type: 'remove',
        userAddress: await signer.getAddress(),
        poolAddress,
        farmId: farmInfo.id,
        amountA: '0',
        amountB: '0',
        liquidity,
        valueUSD: 0,
        slippage: 0,
        transactionHash: txResponse.hash,
        blockNumber: 0,
        timestamp: Date.now(),
        gasUsed: '0',
        gasCostUSD: 0,
        status: 'pending',
        confirmations: 0
      };

      logger.info({
        hash: txResponse.hash,
        userAddress: operation.userAddress,
        poolAddress,
        farmId: farmInfo.id,
        liquidity
      }, 'Farm unstake submitted');

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
   * Claim farm rewards
   */
  async claimFarmRewards(poolAddress: string, signer: ethers.Signer): Promise<string> {
    logger.debug({ poolAddress }, 'Claiming farm rewards');

    try {
      // Get farm info
      const farmInfo = await this.poolIntegration.getFarmInfo(poolAddress);
      if (!farmInfo) {
        throw new LiquidityError(
          LiquidityErrorCode.CONTRACT_ERROR,
          'Pool not available for farming'
        );
      }

      // Build transaction
      const transaction = await this.buildClaimRewardsTransaction(farmInfo.poolId, await signer.getAddress());

      // Execute transaction
      const txResponse = await signer.sendTransaction(transaction);

      logger.info({
        hash: txResponse.hash,
        userAddress: await signer.getAddress(),
        poolAddress,
        farmId: farmInfo.id
      }, 'Farm rewards claimed');

      return txResponse.hash;

    } catch (error) {
      logger.error({
        poolAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to claim farm rewards');
      throw error;
    }
  }

  /**
   * Batch add liquidity
   */
  async batchAddLiquidity(requests: LiquidityRequest[], signer: ethers.Signer): Promise<LiquidityOperation[]> {
    logger.debug({ count: requests.length }, 'Batch adding liquidity');

    try {
      const operations = await Promise.allSettled(
        requests.map(request => this.addLiquidity(request, signer))
      );

      return operations
        .filter((result): result is PromiseFulfilledResult<LiquidityOperation> => result.status === 'fulfilled')
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
   * Batch remove liquidity
   */
  async batchRemoveLiquidity(
    operations: { poolAddress: string; liquidity: string }[],
    signer: ethers.Signer
  ): Promise<LiquidityOperation[]> {
    logger.debug({ count: operations.length }, 'Batch removing liquidity');

    try {
      const results = await Promise.allSettled(
        operations.map(op => this.removeLiquidity(op.poolAddress, op.liquidity, signer))
      );

      return results
        .filter((result): result is PromiseFulfilledResult<LiquidityOperation> => result.status === 'fulfilled')
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
   * Get liquidity history
   */
  async getLiquidityHistory(userAddress: string, limit: number = 100): Promise<LiquidityOperation[]> {
    logger.debug({ userAddress, limit }, 'Getting liquidity history');

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
   * Get liquidity metrics
   */
  async getLiquidityMetrics(timeframe?: string): Promise<any> {
    logger.debug({ timeframe }, 'Getting liquidity metrics');

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
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const poolHealth = await this.poolIntegration.getPoolHealthStatus();
      const providerHealth = await this.provider.healthCheck();

      return poolHealth && providerHealth;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Liquidity service health check failed');
      return false;
    }
  }

  /**
   * Get service status
   */
  async getServiceStatus(): Promise<any> {
    try {
      return {
        healthy: await this.healthCheck(),
        pendingOperations: this.pendingOperations.size,
        supportedNetworks: ['BSC'],
        contracts: {
          router: this.config.PANCAKESWAP_ROUTER,
          masterChef: this.config.PANCAKESWAP_MASTER_CHEF
        },
        timestamp: Date.now()
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get service status');
      throw error;
    }
  }

  // Private helper methods

  private validateLiquidityRequest(request: LiquidityRequest): void {
    if (!request.tokenA || !request.tokenB) {
      throw new LiquidityError(
        LiquidityErrorCode.INVALID_AMOUNT,
        'Token addresses are required'
      );
    }

    if (!request.amountA) {
      throw new LiquidityError(
        LiquidityErrorCode.INVALID_AMOUNT,
        'Amount A is required'
      );
    }

    if (request.slippageTolerance && request.slippageTolerance > 1000) { // 10%
      throw new LiquidityError(
        LiquidityErrorCode.SLIPPAGE_TOO_HIGH,
        'Slippage tolerance too high'
      );
    }
  }

  private async getTokenInfo(address: string): Promise<TokenInfo> {
    // Simplified token info
    const isWBNB = address.toLowerCase() === this.WBNB_ADDRESS.toLowerCase();

    return {
      address,
      symbol: isWBNB ? 'WBNB' : 'TOKEN',
      name: isWBNB ? 'Wrapped BNB' : 'Token',
      decimals: 18,
      priceUSD: 0
    };
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

  private assessLiquidityRisk(priceImpact: number, shareOfPool: number): LiquidityRiskLevel {
    if (priceImpact > 10 || shareOfPool > 80) {
      return LiquidityRiskLevel.VERY_HIGH;
    }
    if (priceImpact > 5 || shareOfPool > 50) {
      return LiquidityRiskLevel.HIGH;
    }
    if (priceImpact > 2 || shareOfPool > 25) {
      return LiquidityRiskLevel.MEDIUM;
    }
    return LiquidityRiskLevel.LOW;
  }

  private async checkAndApproveTokens(quote: LiquidityQuote, signer: ethers.Signer): Promise<void> {
    if (!this.config.defaultOptions.autoApprove) {
      return;
    }

    const userAddress = await signer.getAddress();

    // Check and approve token A
    const allowanceA = await this.getTokenAllowance(
      quote.tokenA.address,
      userAddress,
      this.config.PANCAKESWAP_ROUTER
    );

    if (BigInt(allowanceA) < BigInt(quote.amountA)) {
      await this.approveToken(quote.tokenA.address, signer);
    }

    // Check and approve token B if not ETH
    if (!quote.isETH) {
      const allowanceB = await this.getTokenAllowance(
        quote.tokenB.address,
        userAddress,
        this.config.PANCAKESWAP_ROUTER
      );

      if (BigInt(allowanceB) < BigInt(quote.amountB!)) {
        await this.approveToken(quote.tokenB.address, signer);
      }
    }
  }

  private async getTokenAllowance(tokenAddress: string, owner: string, spender: string): Promise<string> {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function allowance(address owner, address spender) external view returns (uint256)'],
      await this.provider.getProvider()
    );

    const allowance = await tokenContract.allowance(owner, spender);
    return allowance.toString();
  }

  private async approveToken(tokenAddress: string, signer: ethers.Signer): Promise<string> {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function approve(address spender, uint256 amount) external returns (bool)'],
      signer
    );

    const maxAmount = ethers.MaxUint256;
    const tx = await tokenContract.approve(this.config.PANCAKESWAP_ROUTER, maxAmount);
    return tx.hash;
  }

  private async buildAddLiquidityTransaction(quote: LiquidityQuote, request: LiquidityRequest): Promise<any> {
    const deadline = Date.now() + (request.deadlineMinutes || this.config.defaultOptions.deadlineMinutes) * 60000;

    let data: string;
    let value: string;

    if (request.isETH) {
      // Add liquidity with ETH
      const iface = new ethers.Interface([
        'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)'
      ]);

      data = iface.encodeFunctionData('addLiquidityETH', [
        quote.tokenB.address,
        request.amountA,
        '0', // amountTokenMin - would calculate slippage
        '0', // amountETHMin - would calculate slippage
        request.recipient,
        deadline
      ]);

      value = quote.amountBOut!;
    } else {
      // Add liquidity with tokens
      const iface = new ethers.Interface([
        'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)'
      ]);

      data = iface.encodeFunctionData('addLiquidity', [
        quote.tokenA.address,
        quote.tokenB.address,
        quote.amountA,
        quote.amountB!,
        '0', // amountAMin - would calculate slippage
        '0', // amountBMin - would calculate slippage
        request.recipient,
        deadline
      ]);

      value = '0';
    }

    return {
      to: this.config.PANCAKESWAP_ROUTER,
      data,
      value,
      gasLimit: quote.gasEstimate.gasLimit,
      maxFeePerGas: quote.gasEstimate.maxFeePerGas,
      maxPriorityFeePerGas: quote.gasEstimate.maxPriorityFeePerGas
    };
  }

  private async buildRemoveLiquidityTransaction(quote: LiquidityQuote, poolAddress: string): Promise<any> {
    const deadline = Date.now() + this.config.defaultOptions.deadlineMinutes * 60000;

    let data: string;
    let value: string;

    if (quote.isETH) {
      // Remove liquidity with ETH
      const iface = new ethers.Interface([
        'function removeLiquidityETH(address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external returns (uint amountToken, uint amountETH)'
      ]);

      data = iface.encodeFunctionData('removeLiquidityETH', [
        quote.tokenA.address,
        quote.liquidityOut,
        '0', // amountTokenMin - would calculate slippage
        '0', // amountETHMin - would calculate slippage
        '0x0000000000000000000000000000000000000000000', // to address
        deadline
      ]);

      value = '0';
    } else {
      // Remove liquidity with tokens
      const iface = new ethers.Interface([
        'function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB)'
      ]);

      data = iface.encodeFunctionData('removeLiquidity', [
        quote.tokenA.address,
        quote.tokenB.address,
        quote.liquidityOut,
        '0', // amountAMin - would calculate slippage
        '0', // amountBMin - would calculate slippage
        '0x0000000000000000000000000000000000000000000', // to address
        deadline
      ]);

      value = '0';
    }

    return {
      to: this.config.PANCAKESWAP_ROUTER,
      data,
      value,
      gasLimit: quote.gasEstimate.gasLimit,
      maxFeePerGas: quote.gasEstimate.maxFeePerGas,
      maxPriorityFeePerGas: quote.gasEstimate.maxPriorityFeePerGas
    };
  }

  private async buildStakeTransaction(poolId: number, liquidity: string): Promise<any> {
    const iface = new ethers.Interface([
      'function deposit(uint256 pid, uint256 amount) external'
    ]);

    const data = iface.encodeFunctionData('deposit', [poolId, liquidity]);

    return {
      to: this.config.PANCAKESWAP_MASTER_CHEF,
      data,
      value: '0',
      gasLimit: this.config.gasConfig.stake
    };
  }

  private async buildUnstakeTransaction(poolId: number, liquidity: string): Promise<any> {
    const iface = new ethers.Interface([
      'function withdraw(uint256 pid, uint256 amount) external'
    ]);

    const data = iface.encodeFunctionData('withdraw', [poolId, liquidity]);

    return {
      to: this.config.PANCAKESWAP_MASTER_CHEF,
      data,
      value: '0',
      gasLimit: this.config.gasConfig.unstake
    };
  }

  private async buildClaimRewardsTransaction(poolId: number, userAddress: string): Promise<any> {
    const iface = new ethers.Interface([
      'function harvest(uint256 pid, address) external'
    ]);

    const data = iface.encodeFunctionData('harvest', [poolId, userAddress]);

    return {
      to: this.config.PANCAKESWAP_MASTER_CHEF,
      data,
      value: '0',
      gasLimit: '100000'
    };
  }

  private async monitorOperation(hash: string): Promise<void> {
    const checkOperation = async () => {
      try {
        const operation = this.pendingOperations.get(hash);
        if (!operation) {
          return;
        }

        // Check transaction status
        const provider = await this.provider.getProvider();
        const receipt = await provider.getTransactionReceipt(hash);

        if (receipt) {
          // Transaction is confirmed
          operation.status = receipt.status === 1 ? 'confirmed' : 'failed';
          operation.blockNumber = receipt.blockNumber ? Number(receipt.blockNumber) : 0;
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
          }, 'Liquidity operation completed');
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
export const liquidityService = new LiquidityService();