/**
 * MasterChef Contract Integration
 * Comprehensive interaction with PancakeSwap MasterChef V1 and V2 contracts for yield farming
 */

import { ethers } from 'ethers';
import logger from '../../utils/logger.js';
import { BSC_CONFIG } from '../../config/bsc.js';

// MasterChef V1 Contract Address on BSC
const MASTERCHEF_V1 = '0x73feaa1eE314F8c655E354234017bE2193C9E24E';

// MasterChef V2 Contract Address on BSC
const MASTERCHEF_V2 = '0xa5f8C5DBd5F9b5d797539a3C0dd6Af3B4026F0c1f';

// CAKE Token Address (Reward Token)
const CAKE_TOKEN = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82';

// MasterChef V1 ABI
const MASTERCHEF_V1_ABI = [
  // Basic Info
  'function CAKE() external view returns (address)',
  'function SYRUP() external view returns (address)',
  'function owner() external view returns (address)',

  // Pool Management
  'function poolLength() external view returns (uint256)',
  'function add(uint256 _allocPoint, address _lpToken, bool _withUpdate) external',
  'function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) external',
  'function updatePool(uint256 _pid) external',
  'function massUpdatePools(uint256[] calldata pids) external',

  // User Functions
  'function deposit(uint256 _pid, uint256 _amount) external',
  'function withdraw(uint256 _pid, uint256 _amount) external',
  'function enterStaking(uint256 _amount) external',
  'function leaveStaking(uint256 _amount) external',
  'function emergencyWithdraw(uint256 _pid) external',

  // Pool Information
  'function poolInfo(uint256 pid) external view returns (address lpToken, uint256 allocPoint, uint256 lastRewardBlock, uint256 accCakePerShare)',
  'function userInfo(uint256 pid, address user) external view returns (uint256 amount, uint256 rewardDebt)',
  'function pendingCake(uint256 pid, address user) external view returns (uint256)',

  // Reward Calculation
  'function cakePerBlock() external view returns (uint256)',
  'function bonusMultiplier() external view returns (uint256)',
  'function BONUS_MULTIPLIER() external pure returns (uint256)',

  // Events
  'event Deposit(address indexed user, uint256 indexed pid, uint256 amount)',
  'event Withdraw(address indexed user, uint256 indexed pid, uint256 amount)',
  'event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount)',
  'event AddPool(uint256 indexed pid, uint256 allocPoint, address indexed lpToken, bool withUpdate)',
  'event SetPool(uint256 indexed pid, uint256 allocPoint, bool withUpdate)',
  'event UpdatePool(uint256 indexed pid, uint256 lastRewardBlock, uint256 lpSupply, uint256 accCakePerShare)'
];

// MasterChef V2 ABI
const MASTERCHEF_V2_ABI = [
  // Basic Info
  'function CAKE() external view returns (address)',
  'function owner() external view returns (address)',

  // Pool Management
  'function poolLength() external view returns (uint256)',
  'function add(uint256 _allocPoint, IBEP20 _lpToken, bool _withUpdate) external',
  'function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) external',
  'function updatePool(uint256 _pid) external',
  'function massUpdatePools(uint256[] calldata pids) external',

  // Regular Pool Functions
  'function deposit(uint256 _pid, uint256 _amount) external',
  'function withdraw(uint256 _pid, uint256 _amount) external',
  'function harvest(uint256 _pid, address _to) external',
  'function emergencyWithdraw(uint256 _pid) external',

  // V2 Special Functions
  'function withdrawAndHarvest(uint256 _pid, uint256 _amount) external',

  // User Functions
  'function enterStaking(uint256 _amount) external',
  'function leaveStaking(uint256 _amount) external',

  // Pool Information
  'function poolInfo(uint256 pid) external view returns (address lpToken, uint256 allocPoint, uint256 lastRewardBlock, uint256 accCakePerShare, uint256 rewardDebt)',
  'function userInfo(uint256 pid, address user) external view returns (uint256 amount, uint256 rewardDebt, uint256 rewardDebt)',
  'function pendingCake(uint256 pid, address user) external view returns (uint256)',
  'function pendingSyrup(uint256 pid, address user) external view returns (uint256)',

  // Reward Calculation
  'function cakePerBlock() external view returns (uint256)',
  'function totalAllocPoint() external view returns (uint256)',
  'function updateEmissionRate() external',

  // Events
  'event Deposit(address indexed user, uint256 indexed pid, uint256 amount)',
  'event Withdraw(address indexed user, uint256 indexed pid, uint256 amount)',
  'event Harvest(address indexed user, uint256 indexed pid, uint256 amount)',
  'event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount)',
  'event AddPool(uint256 indexed pid, uint256 allocPoint, address indexed lpToken, bool withUpdate)',
  'event SetPool(uint256 indexed pid, uint256 allocPoint, bool withUpdate)',
  'event UpdatePool(uint256 indexed pid, uint256 lastRewardBlock, uint256 lpSupply, uint256 accCakePerShare)'
];

// CAKE Token ABI
const CAKE_TOKEN_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address recipient, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)'
];

// IBEP20 Interface (for generic LP tokens)
const IBEP20_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)'
];

/**
 * Pool Information
 */
export interface PoolInfo {
  pid: number;
  lpToken: string;
  allocPoint: number;
  lastRewardBlock: number;
  accCakePerShare: string;
  rewardDebt?: string; // V2 only
}

/**
 * User Farm Position
 */
export interface UserFarmPosition {
  amount: string;
  rewardDebt: string;
  pendingRewards: string;
  depositedAt: number;
  lastHarvestAt: number;
}

/**
 * Farm Statistics
 */
export interface FarmStats {
  totalStaked: string;
  totalUsers: number;
  apr: number;
  apy: number;
  tvlUSD: number;
  rewardsPerBlock: string;
  rewardsPerDay: string;
}

/**
 * Farm Operation Parameters
 */
export interface FarmOperationParams {
  pid: number;
  amount?: string;
  userAddress: string;
}

/**
 * MasterChef Contract Configuration
 */
export interface MasterChefConfig {
  provider: ethers.Provider;
  signer?: ethers.Signer;
  useV2?: boolean;
}

/**
 * MasterChef Contract Integration
 */
export class MasterChefContract {
  private provider: ethers.Provider;
  private signer?: ethers.Signer;
  private masterChefV1: ethers.Contract;
  private masterChefV2: ethers.Contract;
  private cakeToken: ethers.Contract;
  private useV2: boolean = false;
  private config: MasterChefConfig;

  // Contract cache
  private lpTokenCache: Map<string, ethers.Contract> = new Map();

  constructor(config: MasterChefConfig) {
    this.provider = config.provider;
    this.signer = config.signer;
    this.useV2 = config.useV2 || false;
    this.config = config;

    // Initialize contracts
    this.masterChefV1 = new ethers.Contract(MASTERCHEF_V1, MASTERCHEF_V1_ABI, this.signer || this.provider);
    this.masterChefV2 = new ethers.Contract(MASTERCHEF_V2, MASTERCHEF_V2_ABI, this.signer || this.provider);
    this.cakeToken = new ethers.Contract(CAKE_TOKEN, CAKE_TOKEN_ABI, this.signer || this.provider);

    logger.info('MasterChef contracts initialized - v1Address: %s, v2Address: %s, cakeToken: %s, useV2: %s',
      MASTERCHEF_V1, MASTERCHEF_V2, CAKE_TOKEN, this.useV2
    );
  }

  /**
   * Get MasterChef contract instance
   */
  private getMasterChef(): ethers.Contract {
    return this.useV2 ? this.masterChefV2 : this.masterChefV1;
  }

  /**
   * Get total number of pools
   */
  async getPoolLength(): Promise<number> {
    try {
      const masterChef = this.getMasterChef();
      const length = await masterChef.poolLength();
      return length.toNumber();
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get pool length');
      throw new Error(`Failed to get pool length: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pool information
   */
  async getPoolInfo(pid: number): Promise<PoolInfo> {
    try {
      const masterChef = this.getMasterChef();
      const poolInfo = await masterChef.poolInfo(pid);

      const result: PoolInfo = {
        pid,
        lpToken: poolInfo.lpToken,
        allocPoint: poolInfo.allocPoint.toNumber(),
        lastRewardBlock: poolInfo.lastRewardBlock.toNumber(),
        accCakePerShare: poolInfo.accCakePerShare.toString()
      };

      // V2 has additional rewardDebt field
      if (this.useV2 && 'rewardDebt' in poolInfo) {
        result.rewardDebt = poolInfo.rewardDebt.toString();
      }

      return result;
    } catch (error) {
      logger.error({ pid, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get pool info');
      throw new Error(`Failed to get pool info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all pools information
   */
  async getAllPools(limit?: number, offset: number = 0): Promise<PoolInfo[]> {
    try {
      const poolLength = await this.getPoolLength();
      const endIndex = limit ? Math.min(offset + limit, poolLength) : poolLength;

      const pools: PoolInfo[] = [];

      for (let i = offset; i < endIndex; i++) {
        try {
          const poolInfo = await this.getPoolInfo(i);
          pools.push(poolInfo);
        } catch (error) {
          logger.warn({ pid: i, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get pool info, skipping');
          continue;
        }
      }

      return pools;
    } catch (error) {
      logger.error({ limit, offset, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get all pools');
      throw new Error(`Failed to get all pools: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user farm position
   */
  async getUserPosition(pid: number, userAddress: string): Promise<UserFarmPosition> {
    try {
      const masterChef = this.getMasterChef();
      const [amount, rewardDebt] = await masterChef.userInfo(pid, userAddress);
      const pendingRewards = await masterChef.pendingCake(pid, userAddress);

      // Get LP token balance for verification
      const poolInfo = await this.getPoolInfo(pid);
      const lpToken = this.getLPTokenContract(poolInfo.lpToken);
      const actualBalance = await lpToken.balanceOf(userAddress);

      return {
        amount: amount.toString(),
        rewardDebt: rewardDebt.toString(),
        pendingRewards: pendingRewards.toString(),
        depositedAt: 0, // Would need to track from events
        lastHarvestAt: 0 // Would need to track from events
      };
    } catch (error) {
      logger.error({ pid, userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get user position');
      throw new Error(`Failed to get user position: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all user positions
   */
  async getUserPositions(userAddress: string, limit?: number, offset: number = 0): Promise<Array<PoolInfo & UserFarmPosition>> {
    try {
      const pools = await this.getAllPools(limit, offset);
      const positions: Array<PoolInfo & UserFarmPosition> = [];

      for (const pool of pools) {
        try {
          const userPosition = await this.getUserPosition(pool.pid, userAddress);
          if (parseFloat(userPosition.amount) > 0) {
            positions.push({ ...pool, ...userPosition });
          }
        } catch (error) {
          logger.warn({ pid: pool.pid, userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get user position, skipping');
          continue;
        }
      }

      return positions;
    } catch (error) {
      logger.error({ userAddress, limit, offset, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get user positions');
      throw new Error(`Failed to get user positions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deposit to farm
   */
  async deposit(params: FarmOperationParams): Promise<{
    transactionHash: string;
    gasUsed: string;
    amount: string;
  }> {
    try {
      const { pid, amount, userAddress } = params;

      if (!this.signer) {
        throw new Error('Signer is required for deposit operations');
      }

      if (!amount) {
        throw new Error('Amount is required for deposit');
      }

      const masterChef = this.getMasterChef();
      const poolInfo = await this.getPoolInfo(pid);
      const lpToken = this.getLPTokenContract(poolInfo.lpToken);

      // Check user's LP token balance
      const userBalance = await lpToken.balanceOf(userAddress);
      if (parseFloat(userBalance.toString()) < parseFloat(amount)) {
        throw new Error('Insufficient LP token balance');
      }

      // Approve LP tokens if needed
      const allowance = await lpToken.allowance(userAddress, this.useV2 ? MASTERCHEF_V2 : MASTERCHEF_V1);
      if (parseFloat(allowance.toString()) < parseFloat(amount)) {
        const approveTx = await lpToken.approve(
          this.useV2 ? MASTERCHEF_V2 : MASTERCHEF_V1,
          amount,
          { gasLimit: 100000 }
        );
        await approveTx.wait();
        logger.info('LP token approved for MasterChef - transactionHash: %s', approveTx.hash);
      }

      // Execute deposit
      const transaction = await masterChef.deposit(pid, amount, {
        gasLimit: 300000
      });

      const receipt = await transaction.wait();
      const gasUsed = receipt.gasUsed.toString();

      logger.info('Deposit executed successfully - transactionHash: %s, pid: %s, amount: %s, userAddress: %s, gasUsed: %s',
      transaction.hash, pid, amount, userAddress, gasUsed
    );

      return {
        transactionHash: transaction.hash,
        gasUsed,
        amount
      };
    } catch (error) {
      logger.error({ params, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to execute deposit');
      throw new Error(`Failed to execute deposit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Withdraw from farm
   */
  async withdraw(params: FarmOperationParams): Promise<{
    transactionHash: string;
    gasUsed: string;
    amount: string;
    rewards: string;
  }> {
    try {
      const { pid, amount, userAddress } = params;

      if (!this.signer) {
        throw new Error('Signer is required for withdraw operations');
      }

      if (!amount) {
        throw new Error('Amount is required for withdraw');
      }

      const masterChef = this.getMasterChef();
      const userPosition = await this.getUserPosition(pid, userAddress);

      if (parseFloat(userPosition.amount) < parseFloat(amount)) {
        throw new Error('Insufficient staked amount');
      }

      // Get pending rewards before withdrawal
      const pendingRewards = await this.pendingRewards(pid, userAddress);

      // Execute withdrawal
      const transaction = await masterChef.withdraw(pid, amount, {
        gasLimit: 250000
      });

      const receipt = await transaction.wait();
      const gasUsed = receipt.gasUsed.toString();

    logger.info('Withdrawal executed successfully - transactionHash: %s, pid: %s, amount: %s, rewards: %s, userAddress: %s, gasUsed: %s',
      transaction.hash, pid, amount, pendingRewards, userAddress, gasUsed
    );

      return {
        transactionHash: transaction.hash,
        gasUsed,
        amount,
        rewards: pendingRewards
      };
    } catch (error) {
      logger.error({ params, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to execute withdrawal');
      throw new Error(`Failed to execute withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Harvest rewards
   */
  async harvest(params: FarmOperationParams): Promise<{
    transactionHash: string;
    gasUsed: string;
    rewards: string;
  }> {
    try {
      const { pid, userAddress } = params;

      if (!this.signer) {
        throw new Error('Signer is required for harvest operations');
      }

      const masterChef = this.getMasterChef();
      const pendingRewards = await this.pendingRewards(pid, userAddress);

      if (parseFloat(pendingRewards) === 0) {
        logger.info('No rewards to harvest - pid: %s, userAddress: %s', pid, userAddress);
        return {
          transactionHash: '',
          gasUsed: '0',
          rewards: '0'
        };
      }

      // Execute harvest
      const transaction = await masterChef.harvest(pid, userAddress, {
        gasLimit: 200000
      });

      const receipt = await transaction.wait();
      const gasUsed = receipt.gasUsed.toString();

      logger.info('Harvest executed successfully - transactionHash: %s, pid: %s, rewards: %s, userAddress: %s, gasUsed: %s',
      transaction.hash, pid, pendingRewards, userAddress, gasUsed
    );

      return {
        transactionHash: transaction.hash,
        gasUsed,
        rewards: pendingRewards
      };
    } catch (error) {
      logger.error({ params, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to execute harvest');
      throw new Error(`Failed to execute harvest: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Emergency withdraw
   */
  async emergencyWithdraw(params: FarmOperationParams): Promise<{
    transactionHash: string;
    gasUsed: string;
    amount: string;
  }> {
    try {
      const { pid, userAddress } = params;

      if (!this.signer) {
        throw new Error('Signer is required for emergency withdraw');
      }

      const masterChef = this.getMasterChef();
      const userPosition = await this.getUserPosition(pid, userAddress);

      if (parseFloat(userPosition.amount) === 0) {
        throw new Error('No staked amount to withdraw');
      }

      // Execute emergency withdrawal
      const transaction = await masterChef.emergencyWithdraw(pid, {
        gasLimit: 200000
      });

      const receipt = await transaction.wait();
      const gasUsed = receipt.gasUsed.toString();

      logger.info('Emergency withdrawal executed successfully - transactionHash: %s, pid: %s, amount: %s, userAddress: %s, gasUsed: %s',
      transaction.hash, pid, userPosition.amount, userAddress, gasUsed
    );

      return {
        transactionHash: transaction.hash,
        gasUsed,
        amount: userPosition.amount
      };
    } catch (error) {
      logger.error({ params, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to execute emergency withdrawal');
      throw new Error(`Failed to execute emergency withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pending rewards
   */
  async pendingRewards(pid: number, userAddress: string): Promise<string> {
    try {
      const masterChef = this.getMasterChef();
      const pending = await masterChef.pendingCake(pid, userAddress);
      return pending.toString();
    } catch (error) {
      logger.error({ pid, userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get pending rewards');
      throw new Error(`Failed to get pending rewards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get CAKE rewards per block
   */
  async getCakePerBlock(): Promise<string> {
    try {
      const masterChef = this.getMasterChef();
      const cakePerBlock = await masterChef.cakePerBlock();
      return cakePerBlock.toString();
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get CAKE per block');
      throw new Error(`Failed to get CAKE per block: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get total allocation points (V2)
   */
  async getTotalAllocPoint(): Promise<string> {
    try {
      if (!this.useV2) {
        throw new Error('Total allocation points only available in MasterChef V2');
      }

      const totalAllocPoint = await this.masterChefV2.totalAllocPoint();
      return totalAllocPoint.toString();
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get total allocation points');
      throw new Error(`Failed to get total allocation points: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get CAKE token balance
   */
  async getCakeBalance(userAddress: string): Promise<string> {
    try {
      const balance = await this.cakeToken.balanceOf(userAddress);
      return balance.toString();
    } catch (error) {
      logger.error({ userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get CAKE balance');
      throw new Error(`Failed to get CAKE balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get LP token balance
   */
  async getLPBalance(lpTokenAddress: string, userAddress: string): Promise<string> {
    try {
      const lpToken = this.getLPTokenContract(lpTokenAddress);
      const balance = await lpToken.balanceOf(userAddress);
      return balance.toString();
    } catch (error) {
      logger.error({ lpTokenAddress, userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get LP token balance');
      throw new Error(`Failed to get LP token balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate farm APR
   */
  async calculateFarmAPR(pid: number, poolPriceUSD: number): Promise<number> {
    try {
      const [poolInfo, cakePerBlock] = await Promise.all([
        this.getPoolInfo(pid),
        this.getCakePerBlock()
      ]);

      const totalAllocPoint = this.useV2 ?
        parseFloat(await this.getTotalAllocPoint()) :
        1000; // Default for V1

      const cakePriceUSD = await this.getCakePriceUSD();
      const blockTime = 3; // BSC block time in seconds
      const blocksPerDay = (24 * 3600) / blockTime;
      const cakePerDay = parseFloat(cakePerBlock) * blocksPerDay;
      const cakePerDayUSD = cakePerDay * cakePriceUSD;

      const poolTVLUSD = poolPriceUSD;
      const allocShare = poolInfo.allocPoint / totalAllocPoint;
      const dailyCakeRewards = cakePerDayUSD * allocShare;
      const apr = (dailyCakeRewards * 365) / poolTVLUSD * 100;

      return apr;
    } catch (error) {
      logger.error({ pid, poolPriceUSD, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to calculate farm APR');
      return 0;
    }
  }

  /**
   * Calculate farm APY (with compounding)
   */
  async calculateFarmAPY(pid: number, poolPriceUSD: number): Promise<number> {
    try {
      const apr = await this.calculateFarmAPR(pid, poolPriceUSD);
      // Assuming daily compounding
      const apy = Math.pow(1 + (apr / 100) / 365, 365) - 1;
      return apy * 100;
    } catch (error) {
      logger.error({ pid, poolPriceUSD, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to calculate farm APY');
      return 0;
    }
  }

  /**
   * Get CAKE price in USD (simplified)
   */
  private async getCakePriceUSD(): Promise<number> {
    try {
      // In production, would query from price oracle or DEX
      // For now, return a placeholder price
      return 2.50; // Placeholder price
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get CAKE price USD');
      return 0;
    }
  }

  /**
   * Get LP token contract instance
   */
  private getLPTokenContract(lpTokenAddress: string): ethers.Contract {
    if (!this.lpTokenCache.has(lpTokenAddress)) {
      const lpToken = new ethers.Contract(lpTokenAddress, IBEP20_ABI, this.provider);
      this.lpTokenCache.set(lpTokenAddress, lpToken);
    }
    return this.lpTokenCache.get(lpTokenAddress)!;
  }

  /**
   * Get MasterChef health status
   */
  async getHealthStatus(): Promise<{
    v1: boolean;
    v2: boolean;
    useV2: boolean;
    totalPools: number;
    cakePerBlock: string;
  }> {
    try {
      const [v1Healthy, v2Healthy, totalPools, cakePerBlock] = await Promise.allSettled([
        this.checkContractHealth(this.masterChefV1),
        this.checkContractHealth(this.masterChefV2),
        this.getPoolLength(),
        this.getCakePerBlock()
      ]);

      return {
        v1: v1Healthy.status === 'fulfilled' && v1Healthy.value === true,
        v2: v2Healthy.status === 'fulfilled' && v2Healthy.value === true,
        useV2: this.useV2,
        totalPools: totalPools.status === 'fulfilled' ? totalPools.value : 0,
        cakePerBlock: cakePerBlock.status === 'fulfilled' ? cakePerBlock.value : '0'
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get MasterChef health status');
      return {
        v1: false,
        v2: false,
        useV2: this.useV2,
        totalPools: 0,
        cakePerBlock: '0'
      };
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.lpTokenCache.clear();
    logger.info('MasterChef contracts cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { lpTokens: number } {
    return {
      lpTokens: this.lpTokenCache.size
    };
  }

  /**
   * Check if contract is healthy/responding
   */
  private async checkContractHealth(contract: ethers.Contract): Promise<boolean> {
    try {
      // Try to call a simple view function
      await contract.poolLength();
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Create MasterChef Contract instance
 */
export function createMasterChefContract(config: MasterChefConfig): MasterChefContract {
  return new MasterChefContract(config);
}

/**
 * Default MasterChef Contract configuration
 */
export function getDefaultMasterChefConfig(signer?: ethers.Signer): MasterChefConfig {
  const provider = new ethers.JsonRpcProvider(BSC_CONFIG.BSC_RPC_URL);

  return {
    provider,
    signer,
    useV2: true // Default to V2 as it's more commonly used
  };
}