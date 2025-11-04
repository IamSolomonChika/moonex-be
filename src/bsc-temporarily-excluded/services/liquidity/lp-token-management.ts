/**
 * LP Token Management Service
 * Handles LP token operations including balance tracking, approvals, and staking
 */

import { ethers } from 'ethers';
import logger from '../../../utils/logger.js';
import type {
  LiquidityPool,
  LiquidityPosition,
  TokenInfo,
  LPTokenBalance,
  LPTokenApproval,
  LPTokenStaking,
  LPTokenOperation,
  LPTokenOperationType,
  LiquidityConfig,
  LiquidityError,
  LiquidityErrorCode
} from './types.js';
import { BSCProviderManager } from '../../utils/ethers-provider.js';
import { BSCCacheManager } from '../cache/cache-manager.js';
import { LiquidityPoolIntegration } from './pool-integration.js';
import { ImpermanentLossService } from './impermanent-loss.js';

/**
 * LP Token Management Interface
 */
export interface ILPTokenManagement {
  // LP Token operations
  getLPBalance(userAddress: string, poolAddress: string): Promise<LPTokenBalance>;
  getLPBalances(userAddress: string): Promise<LPTokenBalance[]>;

  // Approvals
  approveLP(tokenAddress: string, spenderAddress: string, amount?: string): Promise<LPTokenApproval>;
  checkApproval(tokenAddress: string, ownerAddress: string, spenderAddress: string): Promise<LPTokenApproval>;
  revokeApproval(tokenAddress: string, spenderAddress: string): Promise<LPTokenApproval>;

  // Staking operations
  stakeLP(userAddress: string, poolAddress: string, amount: string): Promise<LPTokenStaking>;
  unstakeLP(userAddress: string, poolAddress: string, amount: string): Promise<LPTokenStaking>;
  getStakingInfo(userAddress: string, poolAddress: string): Promise<LPTokenStaking>;

  // LP Token analytics
  getLPValue(userAddress: string, poolAddress: string): Promise<{ valueUSD: number; valueToken0: string; valueToken1: string }>;
  getLPPortfolio(userAddress: string): Promise<{ totalValueUSD: number; positions: LiquidityPosition[] }>;

  // Operations tracking
  getOperations(userAddress: string, limit?: number): Promise<LPTokenOperation[]>;
  trackOperation(operation: LPTokenOperation): Promise<void>;
}

/**
 * LP Token Management Implementation
 */
export class LPTokenManagement implements ILPTokenManagement {
  private provider: BSCProviderManager;
  private cache: BSCCacheManager;
  private config: LiquidityConfig;
  private poolIntegration: LiquidityPoolIntegration;
  private impermanentLossService: ImpermanentLossService;

  // Standard ERC20 ABI for LP tokens
  private readonly LP_TOKEN_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) returns (bool)',
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)'
  ];

  constructor(config?: Partial<LiquidityConfig>) {
    this.provider = new BSCProviderManager();
    this.cache = new BSCCacheManager();
    this.poolIntegration = new LiquidityPoolIntegration(config);
    this.impermanentLossService = new ImpermanentLossService(config);

    // Default configuration
    this.config = {
      approveUnlimited: true,
      maxApprovalAmount: ethers.MaxUint256.toString(),
      defaultGasLimit: {
        approve: 50000,
        transfer: 65000,
        transferFrom: 65000
      },
      cacheLPData: true,
      lpDataCacheTTL: 30000, // 30 seconds
      enableStaking: true,
      autoApprove: false,
      slippageTolerance: 0.5, // 0.5%
      ...config
    };
  }

  /**
   * Get LP token balance for a specific pool
   */
  async getLPBalance(userAddress: string, poolAddress: string): Promise<LPTokenBalance> {
    logger.debug({ userAddress, poolAddress }, 'Getting LP token balance');

    try {
      // Check cache first
      const cacheKey = `lp_balance:${userAddress}:${poolAddress}`;
      if (this.config.cacheLPData) {
        const cached = await this.cache.get<LPTokenBalance>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get LP token contract
      const lpContract = new ethers.Contract(
        poolAddress,
        this.LP_TOKEN_ABI,
        await this.provider.getProvider()
      );

      // Get balance and pool information
      const [balance, totalSupply, pool] = await Promise.all([
        lpContract.balanceOf(userAddress),
        lpContract.totalSupply(),
        this.poolIntegration.getPool(poolAddress)
      ]);

      if (!pool) {
        throw new Error('Pool not found');
      }

      // Calculate user's share of the pool
      const userBalance = balance.toString();
      const totalLiquidity = totalSupply.toString();
      const userShare = parseFloat(userBalance) / parseFloat(totalLiquidity);

      // Calculate user's share of reserves
      const userReserve0 = (parseFloat(pool.reserve0) * userShare).toString();
      const userReserve1 = (parseFloat(pool.reserve1) * userShare).toString();

      // Calculate USD value
      const valueUSD = this.calculateLPValueUSD(
        userReserve0,
        userReserve1,
        pool.token0,
        pool.token1
      );

      // Get LP token metadata
      const [name, symbol, decimals] = await Promise.all([
        lpContract.name().catch(() => `LP Token`),
        lpContract.symbol().catch(() => 'LPT'),
        lpContract.decimals().catch(() => 18)
      ]);

      const lpBalance: LPTokenBalance = {
        userAddress,
        poolAddress,
        balance: userBalance,
        totalSupply: totalLiquidity,
        userShare,
        valueUSD,
        reserve0Share: userReserve0,
        reserve1Share: userReserve1,
        lpToken: {
          address: poolAddress,
          name,
          symbol,
          decimals
        },
        lastUpdated: Date.now()
      };

      // Cache the result
      if (this.config.cacheLPData) {
        await this.cache.set(cacheKey, lpBalance, this.config.lpDataCacheTTL);
      }

      return lpBalance;

    } catch (error) {
      logger.error({
        userAddress,
        poolAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get LP token balance');

      const liquidityError: LiquidityError = {
        code: LiquidityErrorCode.BALANCE_FETCH_FAILED,
        message: `Failed to fetch LP balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, poolAddress }
      };

      throw liquidityError;
    }
  }

  /**
   * Get all LP token balances for a user
   */
  async getLPBalances(userAddress: string): Promise<LPTokenBalance[]> {
    logger.debug({ userAddress }, 'Getting all LP token balances');

    try {
      // Get user pools from pool integration
      const userPools = await this.poolIntegration.getUserPools(userAddress);

      // Get LP balances for each pool
      const lpBalances = await Promise.all(
        userPools.map(pool => this.getLPBalance(userAddress, pool.address))
      );

      // Filter out zero balances
      return lpBalances.filter(balance => parseFloat(balance.balance) > 0);

    } catch (error) {
      logger.error({
        userAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get LP token balances');

      const liquidityError: LiquidityError = {
        code: LiquidityErrorCode.BALANCE_FETCH_FAILED,
        message: `Failed to fetch LP balances: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress }
      };

      throw liquidityError;
    }
  }

  /**
   * Approve LP token for spending
   */
  async approveLP(
    tokenAddress: string,
    spenderAddress: string,
    amount?: string
  ): Promise<LPTokenApproval> {
    logger.debug({ tokenAddress, spenderAddress, amount }, 'Approving LP token');

    try {
      const approvalAmount = amount || (this.config.approveUnlimited ? this.config.maxApprovalAmount : '0');

      // Get LP token contract
      const lpContract = new ethers.Contract(
        tokenAddress,
        this.LP_TOKEN_ABI,
        await this.provider.getProvider()
      );

      // Build approval transaction
      const approveTx = await lpContract.approve.populateTransaction(
        spenderAddress,
        approvalAmount
      );

      const approval: LPTokenApproval = {
        tokenAddress,
        spenderAddress,
        ownerAddress: '', // Will be set by caller
        amount: approvalAmount,
        transaction: {
          to: tokenAddress,
          data: approveTx.data || '0x',
          value: '0',
          gasLimit: this.config.defaultGasLimit?.approve || 50000
        },
        status: 'pending',
        timestamp: Date.now()
      };

      // Track the operation
      await this.trackOperation({
        id: `approval_${Date.now()}`,
        userAddress: approval.ownerAddress,
        type: LPTokenOperationType.APPROVAL,
        poolAddress: tokenAddress,
        amount: approvalAmount,
        transactionHash: '',
        status: 'pending',
        timestamp: Date.now(),
        gasUsed: '0',
        gasPrice: '0',
        blockNumber: 0
      });

      return approval;

    } catch (error) {
      logger.error({
        tokenAddress,
        spenderAddress,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to approve LP token');

      const liquidityError: LiquidityError = {
        code: LiquidityErrorCode.APPROVAL_FAILED,
        message: `Failed to approve LP token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { tokenAddress, spenderAddress, amount }
      };

      throw liquidityError;
    }
  }

  /**
   * Check LP token approval
   */
  async checkApproval(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string
  ): Promise<LPTokenApproval> {
    logger.debug({ tokenAddress, ownerAddress, spenderAddress }, 'Checking LP token approval');

    try {
      const lpContract = new ethers.Contract(
        tokenAddress,
        this.LP_TOKEN_ABI,
        await this.provider.getProvider()
      );

      const allowance = await lpContract.allowance(ownerAddress, spenderAddress);

      const approval: LPTokenApproval = {
        tokenAddress,
        spenderAddress,
        ownerAddress,
        amount: allowance.toString(),
        transaction: {
          to: tokenAddress,
          data: '0x',
          value: '0',
          gasLimit: 0
        },
        status: allowance.gt(0) ? 'approved' : 'none',
        timestamp: Date.now()
      };

      return approval;

    } catch (error) {
      logger.error({
        tokenAddress,
        ownerAddress,
        spenderAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to check LP token approval');

      const liquidityError: LiquidityError = {
        code: LiquidityErrorCode.APPROVAL_CHECK_FAILED,
        message: `Failed to check LP approval: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { tokenAddress, ownerAddress, spenderAddress }
      };

      throw liquidityError;
    }
  }

  /**
   * Revoke LP token approval
   */
  async revokeApproval(tokenAddress: string, spenderAddress: string): Promise<LPTokenApproval> {
    logger.debug({ tokenAddress, spenderAddress }, 'Revoking LP token approval');

    try {
      // Set approval amount to 0 to revoke
      return await this.approveLP(tokenAddress, spenderAddress, '0');

    } catch (error) {
      logger.error({
        tokenAddress,
        spenderAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to revoke LP token approval');

      const liquidityError: LiquidityError = {
        code: LiquidityErrorCode.APPROVAL_REVOKE_FAILED,
        message: `Failed to revoke LP approval: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { tokenAddress, spenderAddress }
      };

      throw liquidityError;
    }
  }

  /**
   * Stake LP tokens
   */
  async stakeLP(userAddress: string, poolAddress: string, amount: string): Promise<LPTokenStaking> {
    logger.debug({ userAddress, poolAddress, amount }, 'Staking LP tokens');

    try {
      if (!this.config.enableStaking) {
        throw new Error('Staking is not enabled');
      }

      // Get farm information
      const farmInfo = await this.poolIntegration.getFarmInfo(poolAddress);
      if (!farmInfo) {
        throw new Error('Pool not found in farm');
      }

      // Get staking info
      const currentStaking = await this.getStakingInfo(userAddress, poolAddress);

      const staking: LPTokenStaking = {
        userAddress,
        poolAddress,
        farmId: farmInfo.id,
        amount,
        pendingRewards: '0',
        rewardDebt: '0',
        apr: farmInfo.apr,
        isStaked: true,
        stakingPeriod: 0, // Will be calculated based on unstake time
        lastRewardTime: Date.now(),
        transaction: {
          to: farmInfo.masterChefAddress,
          data: '0x', // Will be populated with actual staking transaction
          value: '0',
          gasLimit: 200000
        },
        status: 'pending',
        timestamp: Date.now()
      };

      // Track the operation
      await this.trackOperation({
        id: `stake_${Date.now()}`,
        userAddress,
        type: LPTokenOperationType.STAKE,
        poolAddress,
        amount,
        transactionHash: '',
        status: 'pending',
        timestamp: Date.now(),
        gasUsed: '0',
        gasPrice: '0',
        blockNumber: 0
      });

      return staking;

    } catch (error) {
      logger.error({
        userAddress,
        poolAddress,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to stake LP tokens');

      const liquidityError: LiquidityError = {
        code: LiquidityErrorCode.STAKING_FAILED,
        message: `Failed to stake LP tokens: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, poolAddress, amount }
      };

      throw liquidityError;
    }
  }

  /**
   * Unstake LP tokens
   */
  async unstakeLP(userAddress: string, poolAddress: string, amount: string): Promise<LPTokenStaking> {
    logger.debug({ userAddress, poolAddress, amount }, 'Unstaking LP tokens');

    try {
      if (!this.config.enableStaking) {
        throw new Error('Staking is not enabled');
      }

      // Get current staking info
      const currentStaking = await this.getStakingInfo(userAddress, poolAddress);

      // Get farm information
      const farmInfo = await this.poolIntegration.getFarmInfo(poolAddress);
      if (!farmInfo) {
        throw new Error('Pool not found in farm');
      }

      const staking: LPTokenStaking = {
        userAddress,
        poolAddress,
        farmId: farmInfo.id,
        amount: '-' + amount, // Negative to indicate withdrawal
        pendingRewards: currentStaking.pendingRewards,
        rewardDebt: currentStaking.rewardDebt,
        apr: farmInfo.apr,
        isStaked: false,
        stakingPeriod: currentStaking.stakingPeriod,
        lastRewardTime: Date.now(),
        transaction: {
          to: farmInfo.masterChefAddress,
          data: '0x', // Will be populated with actual unstaking transaction
          value: '0',
          gasLimit: 200000
        },
        status: 'pending',
        timestamp: Date.now()
      };

      // Track the operation
      await this.trackOperation({
        id: `unstake_${Date.now()}`,
        userAddress,
        type: LPTokenOperationType.UNSTAKE,
        poolAddress,
        amount,
        transactionHash: '',
        status: 'pending',
        timestamp: Date.now(),
        gasUsed: '0',
        gasPrice: '0',
        blockNumber: 0
      });

      return staking;

    } catch (error) {
      logger.error({
        userAddress,
        poolAddress,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to unstake LP tokens');

      const liquidityError: LiquidityError = {
        code: LiquidityErrorCode.UNSTAKING_FAILED,
        message: `Failed to unstake LP tokens: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, poolAddress, amount }
      };

      throw liquidityError;
    }
  }

  /**
   * Get staking information
   */
  async getStakingInfo(userAddress: string, poolAddress: string): Promise<LPTokenStaking> {
    logger.debug({ userAddress, poolAddress }, 'Getting staking information');

    try {
      // Get farm information
      const farmInfo = await this.poolIntegration.getFarmInfo(poolAddress);
      if (!farmInfo) {
        // Return default staking info if not in farm
        return {
          userAddress,
          poolAddress,
          farmId: '0',
          amount: '0',
          pendingRewards: '0',
          rewardDebt: '0',
          apr: 0,
          isStaked: false,
          stakingPeriod: 0,
          lastRewardTime: 0,
          transaction: {
            to: '',
            data: '0x',
            value: '0',
            gasLimit: 0
          },
          status: 'none',
          timestamp: Date.now()
        };
      }

      // In a real implementation, this would fetch from MasterChef contract
      // For now, return placeholder data
      const staking: LPTokenStaking = {
        userAddress,
        poolAddress,
        farmId: farmInfo.id,
        amount: '0',
        pendingRewards: '0',
        rewardDebt: '0',
        apr: farmInfo.apr,
        isStaked: false,
        stakingPeriod: 0,
        lastRewardTime: Date.now(),
        transaction: {
          to: farmInfo.masterChefAddress,
          data: '0x',
          value: '0',
          gasLimit: 0
        },
        status: 'none',
        timestamp: Date.now()
      };

      return staking;

    } catch (error) {
      logger.error({
        userAddress,
        poolAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get staking information');

      const liquidityError: LiquidityError = {
        code: LiquidityErrorCode.STAKING_INFO_FAILED,
        message: `Failed to get staking info: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, poolAddress }
      };

      throw liquidityError;
    }
  }

  /**
   * Get LP token value in USD and individual tokens
   */
  async getLPValue(
    userAddress: string,
    poolAddress: string
  ): Promise<{ valueUSD: number; valueToken0: string; valueToken1: string }> {
    logger.debug({ userAddress, poolAddress }, 'Getting LP token value');

    try {
      const lpBalance = await this.getLPBalance(userAddress, poolAddress);

      return {
        valueUSD: lpBalance.valueUSD,
        valueToken0: lpBalance.reserve0Share,
        valueToken1: lpBalance.reserve1Share
      };

    } catch (error) {
      logger.error({
        userAddress,
        poolAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get LP token value');

      const liquidityError: LiquidityError = {
        code: LiquidityErrorCode.VALUE_CALCULATION_FAILED,
        message: `Failed to calculate LP value: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress, poolAddress }
      };

      throw liquidityError;
    }
  }

  /**
   * Get complete LP portfolio
   */
  async getLPPortfolio(userAddress: string): Promise<{ totalValueUSD: number; positions: LiquidityPosition[] }> {
    logger.debug({ userAddress }, 'Getting LP portfolio');

    try {
      const lpBalances = await this.getLPBalances(userAddress);

      const positions: LiquidityPosition[] = [];
      let totalValueUSD = 0;

      for (const lpBalance of lpBalances) {
        // Get pool information
        const pool = await this.poolIntegration.getPool(lpBalance.poolAddress);
        if (!pool) continue;

        // Get impermanent loss data
        const ilData = await this.impermanentLossService.calculateImpermanentLoss(
          lpBalance.poolAddress,
          parseFloat(lpBalance.reserve0Share),
          parseFloat(lpBalance.reserve1Share)
        );

        // Get staking information
        const stakingInfo = await this.getStakingInfo(userAddress, lpBalance.poolAddress);

        const position: LiquidityPosition = {
          id: `${userAddress}_${lpBalance.poolAddress}`,
          userAddress,
          pool,
          liquidityAmount: lpBalance.balance,
          liquidityUSD: lpBalance.valueUSD,
          shareOfPool: lpBalance.userShare,
          unrealizedPnL: ilData.currentLoss,
          impermanentLoss: ilData.percentageLoss,
          apr: stakingInfo.isStaked ? stakingInfo.apr : pool.apr,
          rewardsEarned: stakingInfo.pendingRewards,
          feesEarned: '0', // Would calculate from historical data
          createdAt: Date.now(), // Would fetch from position creation time
          updatedAt: Date.now(),
          isActive: parseFloat(lpBalance.balance) > 0,
          isStaked: stakingInfo.isStaked
        };

        positions.push(position);
        totalValueUSD += lpBalance.valueUSD;
      }

      return { totalValueUSD, positions };

    } catch (error) {
      logger.error({
        userAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get LP portfolio');

      const liquidityError: LiquidityError = {
        code: LiquidityErrorCode.PORTFOLIO_FETCH_FAILED,
        message: `Failed to fetch LP portfolio: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { userAddress }
      };

      throw liquidityError;
    }
  }

  /**
   * Get LP token operations history
   */
  async getOperations(userAddress: string, limit: number = 50): Promise<LPTokenOperation[]> {
    logger.debug({ userAddress, limit }, 'Getting LP token operations');

    try {
      // In a real implementation, this would fetch from database
      // For now, return empty array as placeholder
      return [];

    } catch (error) {
      logger.error({
        userAddress,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get LP token operations');

      return [];
    }
  }

  /**
   * Track LP token operation
   */
  async trackOperation(operation: LPTokenOperation): Promise<void> {
    logger.debug({ operationId: operation.id, type: operation.type }, 'Tracking LP token operation');

    try {
      // In a real implementation, this would save to database
      // For now, just log the operation
      logger.info({
        operationId: operation.id,
        userAddress: operation.userAddress,
        type: operation.type,
        poolAddress: operation.poolAddress,
        amount: operation.amount,
        status: operation.status
      }, 'LP token operation tracked');

    } catch (error) {
      logger.error({
        operation,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to track LP token operation');
    }
  }

  // Private helper methods

  private calculateLPValueUSD(
    reserve0: string,
    reserve1: string,
    token0: TokenInfo,
    token1: TokenInfo
  ): number {
    const reserve0Float = parseFloat(reserve0);
    const reserve1Float = parseFloat(reserve1);

    const value0 = reserve0Float * token0.priceUSD;
    const value1 = reserve1Float * token1.priceUSD;

    return value0 + value1;
  }
}

// Export singleton instance
export const lpTokenManagement = new LPTokenManagement();