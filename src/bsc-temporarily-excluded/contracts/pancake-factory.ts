/**
 * PancakeSwap Factory Contract Integration
 * Comprehensive interaction with PancakeSwap V2 and V3 factory contracts
 */

import { ethers } from 'ethers';
import logger from '../../utils/logger.js';
import { BSC_CONFIG } from '../../config/bsc.js';

// PancakeSwap Factory Contract Addresses on BSC
const PANCAKESWAP_FACTORY_V2 = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
const PANCAKESWAP_FACTORY_V3 = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865';

// PancakeSwap Factory V2 ABI (essential functions)
const PANCAKESWAP_FACTORY_V2_ABI = [
  // Fee To Setter
  'function feeTo() external view returns (address)',
  'function feeToSetter() external view returns (address)',
  'function setFeeTo(address) external',
  'function setFeeToSetter(address) external',

  // Pair Creation
  'function createPair(address tokenA, address tokenB) external returns (address pair)',
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',

  // Initialization
  'function INIT_CODE_PAIR_HASH() external pure returns (bytes)',

  // All Pairs
  'function allPairs(uint256) external view returns (address pair)',
  'function allPairsLength() external view returns (uint256)',

  // Events
  'event PairCreated(address indexed token0, address indexed token1, address pair, uint256)'
];

// PancakeSwap Factory V3 ABI (essential functions)
const PANCAKESWAP_FACTORY_V3_ABI = [
  // Owner
  'function owner() external view returns (address)',
  'function setOwner(address) external',

  // Pool Creation
  'function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool)',
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',

  // Fee Management
  'function enableFeeAmount(uint24 fee, int24 tickSpacing) external',
  'function feeAmountTickSpacing(uint24 fee) external view returns (int24)',
  'function feeAmounts() external view returns (uint24[])',
  'function feeAmountsLength() external view returns (uint256)',

  // Pool Parameters
  'function setDefaultParameters(uint256 defaultLiquidityFee, address defaultFeeTo) external',
  'function defaultLiquidityFee() external view returns (uint256)',
  'function defaultFeeTo() external view returns (address)',

  // Events
  'event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)',
  'event OwnerChanged(address indexed oldOwner, address indexed newOwner)',
  'event FeeAmountEnabled(uint24 indexed fee, int24 indexed tickSpacing)',
  'event DefaultParametersSet(uint256 defaultLiquidityFee, address defaultFeeTo)'
];

// Pair Contract ABI (for interaction with created pairs)
const PANCAKESWAP_PAIR_ABI = [
  // ERC20
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function transfer(address to, uint256 value) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 value) external returns (bool)',
  'function transferFrom(address from, address to, uint256 value) external returns (bool)',

  // Pair-specific
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function MINIMUM_LIQUIDITY() external pure returns (uint256)',
  'function factory() external view returns (address)',
  'function kLast() external view returns (uint256)',

  // Liquidity
  'function mint(address to) external returns (uint256 liquidity)',
  'function burn(address to) external returns (uint256 amount0, uint256 amount1)',
  'function skim(address to) external',
  'function sync() external',

  // Swaps
  'function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external',

  // Events
  'event Mint(address indexed sender, uint amount0, uint amount1)',
  'event Burn(address indexed sender, uint amount0, uint amount1, address indexed to)',
  'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)',
  'event Sync(uint112 reserve0, uint112 reserve1)'
];

// V3 Pool ABI (essential functions)
const PANCAKESWAP_POOL_V3_ABI = [
  // Positions
  'function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function mint(address recipient, int24 tickLower, int24 tickUpper, uint128 amount, bytes calldata data) external returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'function burn(uint256 tokenId, uint128 amount) external returns (uint256 amount0, uint256 amount1)',
  'function collect(uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max) external returns (uint128 amount0, uint128 amount1)',

  // Swaps
  'function swap(address recipient, bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96, bytes calldata data) external returns (int256 amount0, int256 amount1)',
  'function flash(address recipient, uint256 amount0, uint256 amount1, bytes calldata data) external',

  // Pool State
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
  'function fee() external view returns (uint24)',
  'function tickSpacing() external view returns (int24)',
  'function maxLiquidityPerTick() external view returns (uint128)',

  // Factory
  'function factory() external view returns (address)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',

  // Oracle
  'function observe(uint32[] calldata secondsAgos) external view returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)',
  'function snapshotCumulativesInside(int24 tickLower, int24 tickUpper) external view returns (int56 tickCumulativeInside, uint160 secondsPerLiquidityInsideX128, uint32 secondsInside)'

  // Events
  // ... (would include all V3 pool events)
];

/**
 * Pool Information
 */
export interface PoolInfo {
  address: string;
  token0: string;
  token1: string;
  version: 'v2' | 'v3';
  fee?: number; // V3 only
  tickSpacing?: number; // V3 only
  liquidity?: string;
  sqrtPriceX96?: string; // V3 only
  tick?: number; // V3 only
  reserves?: {
    reserve0: string;
    reserve1: string;
    blockTimestampLast: number;
  }; // V2 only
}

/**
 * Create Pool Parameters
 */
export interface CreatePoolParams {
  tokenA: string;
  tokenB: string;
  fee?: number; // V3 only
  recipient?: string;
}

/**
 * PancakeSwap Factory Contract Interface
 */
export interface PancakeSwapFactoryConfig {
  provider: ethers.Provider;
  signer?: ethers.Signer;
  useV3?: boolean;
}

/**
 * PancakeSwap Factory Contract Integration
 */
export class PancakeSwapFactory {
  private provider: ethers.Provider;
  private signer?: ethers.Signer;
  private factoryV2: ethers.Contract;
  private factoryV3: ethers.Contract;
  private useV3: boolean = false;
  private config: PancakeSwapFactoryConfig;

  // Cache for pair/pool addresses
  private pairCache: Map<string, string> = new Map();
  private poolCache: Map<string, string> = new Map();

  constructor(config: PancakeSwapFactoryConfig) {
    this.provider = config.provider;
    this.signer = config.signer;
    this.useV3 = config.useV3 || false;
    this.config = config;

    // Initialize factory contracts
    this.factoryV2 = new ethers.Contract(PANCAKESWAP_FACTORY_V2, PANCAKESWAP_FACTORY_V2_ABI, this.signer || this.provider);
    this.factoryV3 = new ethers.Contract(PANCAKESWAP_FACTORY_V3, PANCAKESWAP_FACTORY_V3_ABI, this.signer || this.provider);

    logger.info('PancakeSwap Factory contracts initialized - v2Address: %s, v3Address: %s, useV3: %s',
      PANCAKESWAP_FACTORY_V2,
      PANCAKESWAP_FACTORY_V3,
      this.useV3
    );
  }

  /**
   * Get pair address for V2
   */
  async getPair(tokenA: string, tokenB: string): Promise<string> {
    try {
      // Check cache first
      const cacheKey = this.getPairCacheKey(tokenA, tokenB);
      if (this.pairCache.has(cacheKey)) {
        return this.pairCache.get(cacheKey)!;
      }

      const pairAddress = await this.factoryV2.getPair(tokenA, tokenB);

      // Cache the result
      if (pairAddress !== ethers.ZeroAddress) {
        this.pairCache.set(cacheKey, pairAddress);
      }

      return pairAddress;
    } catch (error) {
      logger.error({ tokenA, tokenB, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get pair address');
      throw new Error(`Failed to get pair address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pool address for V3
   */
  async getPool(tokenA: string, tokenB: string, fee: number): Promise<string> {
    try {
      // Check cache first
      const cacheKey = this.getPoolCacheKey(tokenA, tokenB, fee);
      if (this.poolCache.has(cacheKey)) {
        return this.poolCache.get(cacheKey)!;
      }

      const poolAddress = await this.factoryV3.getPool(tokenA, tokenB, fee);

      // Cache the result
      if (poolAddress !== ethers.ZeroAddress) {
        this.poolCache.set(cacheKey, poolAddress);
      }

      return poolAddress;
    } catch (error) {
      logger.error({ tokenA, tokenB, fee, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get pool address');
      throw new Error(`Failed to get pool address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create new pair (V2)
   */
  async createPair(tokenA: string, tokenB: string): Promise<{
    pairAddress: string;
    token0: string;
    token1: string;
    transactionHash: string;
  }> {
    try {
      if (!this.signer) {
        throw new Error('Signer is required for creating pairs');
      }

      // Ensure tokens are in correct order (tokenA < tokenB)
      const [token0, token1] = this.orderTokens(tokenA, tokenB);

      const transaction = await this.factoryV2.createPair(token0, token1, {
        gasLimit: 5000000 // High gas limit for contract creation
      });

      const receipt = await transaction.wait();

      // Get pair address from transaction logs
      const pairAddress = await this.getPair(token0, token1);

      logger.info('Pair created successfully - transactionHash: %s, token0: %s, token1: %s, pairAddress: %s, blockNumber: %s',
        transaction.hash,
        token0,
        token1,
        pairAddress,
        receipt.blockNumber
      );

      return {
        pairAddress,
        token0,
        token1,
        transactionHash: transaction.hash
      };
    } catch (error) {
      logger.error({ tokenA, tokenB, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to create pair');
      throw new Error(`Failed to create pair: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create new pool (V3)
   */
  async createPool(params: CreatePoolParams): Promise<{
    poolAddress: string;
    token0: string;
    token1: string;
    fee: number;
    tickSpacing: number;
    transactionHash: string;
  }> {
    try {
      const { tokenA, tokenB, fee = 3000 } = params;

      if (!this.signer) {
        throw new Error('Signer is required for creating pools');
      }

      // Validate fee tier
      await this.validateFeeTier(fee);

      // Ensure tokens are in correct order
      const [token0, token1] = this.orderTokens(tokenA, tokenB);

      const transaction = await this.factoryV3.createPool(token0, token1, fee, {
        gasLimit: 6000000 // High gas limit for contract creation
      });

      const receipt = await transaction.wait();

      // Get pool address
      const poolAddress = await this.getPool(token0, token1, fee);

      // Get tick spacing
      const tickSpacing = await this.factoryV3.feeAmountTickSpacing(fee);

      logger.info('Pool created successfully - transactionHash: %s, token0: %s, token1: %s, fee: %s, tickSpacing: %s, poolAddress: %s, blockNumber: %s',
        transaction.hash,
        token0,
        token1,
        fee,
        tickSpacing.toNumber(),
        poolAddress,
        receipt.blockNumber
      );

      return {
        poolAddress,
        token0,
        token1,
        fee,
        tickSpacing: tickSpacing.toNumber(),
        transactionHash: transaction.hash
      };
    } catch (error) {
      logger.error({ params, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to create pool');
      throw new Error(`Failed to create pool: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all pairs (V2)
   */
  async getAllPairs(limit: number = 100, offset: number = 0): Promise<string[]> {
    try {
      const pairs: string[] = [];
      const totalLength = await this.factoryV2.allPairsLength();
      const endIndex = Math.min(offset + limit, totalLength.toNumber());

      for (let i = offset; i < endIndex; i++) {
        const pair = await this.factoryV2.allPairs(i);
        if (pair !== ethers.ZeroAddress) {
          pairs.push(pair);
        }
      }

      return pairs;
    } catch (error) {
      logger.error({ limit, offset, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get all pairs');
      throw new Error(`Failed to get all pairs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get total number of pairs (V2)
   */
  async getAllPairsLength(): Promise<number> {
    try {
      const length = await this.factoryV2.allPairsLength();
      return length.toNumber();
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get all pairs length');
      throw new Error(`Failed to get all pairs length: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get enabled fee amounts (V3)
   */
  async getEnabledFeeAmounts(): Promise<number[]> {
    try {
      const feeAmounts = await this.factoryV3.feeAmounts();
      return feeAmounts.map(fee => fee.toNumber());
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get enabled fee amounts');
      throw new Error(`Failed to get enabled fee amounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get tick spacing for fee amount (V3)
   */
  async getTickSpacing(fee: number): Promise<number> {
    try {
      const tickSpacing = await this.factoryV3.feeAmountTickSpacing(fee);
      return tickSpacing.toNumber();
    } catch (error) {
      logger.error({ fee, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get tick spacing');
      throw new Error(`Failed to get tick spacing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get fee to address
   */
  async getFeeTo(): Promise<string> {
    try {
      const feeTo = await this.factoryV2.feeTo();
      return feeTo;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get fee to address');
      throw new Error(`Failed to get fee to address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get factory owner
   */
  async getOwner(): Promise<string> {
    try {
      const owner = await this.factoryV3.owner();
      return owner;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get factory owner');
      throw new Error(`Failed to get factory owner: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pair information
   */
  async getPairInfo(pairAddress: string, version: 'v2' | 'v3' = 'v2'): Promise<PoolInfo> {
    try {
      let poolInfo: PoolInfo;

      if (version === 'v2') {
        const pair = new ethers.Contract(pairAddress, PANCAKESWAP_PAIR_ABI, this.provider);

        const [token0, token1, reserves] = await Promise.all([
          pair.token0(),
          pair.token1(),
          pair.getReserves()
        ]);

        poolInfo = {
          address: pairAddress,
          token0,
          token1,
          version: 'v2',
          reserves: {
            reserve0: reserves.reserve0.toString(),
            reserve1: reserves.reserve1.toString(),
            blockTimestampLast: reserves.blockTimestampLast.toNumber()
          }
        };
      } else {
        // V3 pool
        const pool = new ethers.Contract(pairAddress, PANCAKESWAP_POOL_V3_ABI, this.provider);

        const [slot0, liquidity, fee, tickSpacing, token0, token1] = await Promise.all([
          pool.slot0(),
          pool.liquidity(),
          pool.fee(),
          pool.tickSpacing(),
          pool.token0(),
          pool.token1()
        ]);

        poolInfo = {
          address: pairAddress,
          token0,
          token1,
          version: 'v3',
          fee: fee.toNumber(),
          tickSpacing: tickSpacing.toNumber(),
          liquidity: liquidity.toString(),
          sqrtPriceX96: slot0.sqrtPriceX96.toString(),
          tick: slot0.tick
        };
      }

      return poolInfo;
    } catch (error) {
      logger.error({ pairAddress, version, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get pair info');
      throw new Error(`Failed to get pair info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for pairs containing specific token
   */
  async searchPairsByToken(tokenAddress: string, limit: number = 50): Promise<PoolInfo[]> {
    try {
      const pairs: PoolInfo[] = [];
      const totalPairs = await this.getAllPairsLength();
      const searchLimit = Math.min(limit, totalPairs);

      for (let i = 0; i < searchLimit; i++) {
        try {
          const pairAddress = await this.factoryV2.allPairs(i);
          if (pairAddress === ethers.ZeroAddress) continue;

          const pairInfo = await this.getPairInfo(pairAddress, 'v2');

          if (pairInfo.token0.toLowerCase() === tokenAddress.toLowerCase() ||
              pairInfo.token1.toLowerCase() === tokenAddress.toLowerCase()) {
            pairs.push(pairInfo);
          }
        } catch (error) {
          // Skip invalid pairs
          continue;
        }
      }

      return pairs;
    } catch (error) {
      logger.error({ tokenAddress, limit, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to search pairs by token');
      throw new Error(`Failed to search pairs by token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if pair exists
   */
  async pairExists(tokenA: string, tokenB: string): Promise<boolean> {
    try {
      const pairAddress = await this.getPair(tokenA, tokenB);
      return pairAddress !== ethers.ZeroAddress;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if pool exists (V3)
   */
  async poolExists(tokenA: string, tokenB: string, fee: number): Promise<boolean> {
    try {
      const poolAddress = await this.getPool(tokenA, tokenB, fee);
      return poolAddress !== ethers.ZeroAddress;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get factory health status
   */
  async getHealthStatus(): Promise<{
    v2: boolean;
    v3: boolean;
    totalPairs: number;
    enabledFees: number[];
    owner: string;
  }> {
    try {
      const [v2Healthy, v3Healthy, totalPairs, enabledFees, owner] = await Promise.allSettled([
        this.checkContractHealth(this.factoryV2),
        this.checkContractHealth(this.factoryV3),
        this.getAllPairsLength(),
        this.getEnabledFeeAmounts(),
        this.getOwner()
      ]);

      return {
        v2: v2Healthy.status === 'fulfilled' && v2Healthy.value === true,
        v3: v3Healthy.status === 'fulfilled' && v3Healthy.value === true,
        totalPairs: totalPairs.status === 'fulfilled' ? totalPairs.value : 0,
        enabledFees: enabledFees.status === 'fulfilled' ? enabledFees.value : [],
        owner: owner.status === 'fulfilled' ? owner.value : '0x0000000000000000000000000000000000000000'
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get factory health status');
      return {
        v2: false,
        v3: false,
        totalPairs: 0,
        enabledFees: [],
        owner: '0x0000000000000000000000000000000000000000'
      };
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.pairCache.clear();
    this.poolCache.clear();
    logger.info('Factory cache cleared');
  }

  /**
   * Order tokens correctly (token0 < token1)
   */
  private orderTokens(tokenA: string, tokenB: string): [string, string] {
    return tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
  }

  /**
   * Generate cache key for pairs
   */
  private getPairCacheKey(tokenA: string, tokenB: string): string {
    const [token0, token1] = this.orderTokens(tokenA, tokenB);
    return `${token0}-${token1}`;
  }

  /**
   * Generate cache key for pools
   */
  private getPoolCacheKey(tokenA: string, tokenB: string, fee: number): string {
    const [token0, token1] = this.orderTokens(tokenA, tokenB);
    return `${token0}-${token1}-${fee}`;
  }

  /**
   * Validate fee tier (V3)
   */
  private async validateFeeTier(fee: number): Promise<void> {
    try {
      const enabledFees = await this.getEnabledFeeAmounts();
      if (!enabledFees.includes(fee)) {
        throw new Error(`Fee tier ${fee} is not enabled`);
      }
    } catch (error) {
      throw new Error(`Invalid fee tier: ${fee}`);
    }
  }

  /**
   * Check if contract is healthy/responding
   */
  private async checkContractHealth(contract: ethers.Contract): Promise<boolean> {
    try {
      // Try to call a simple view function
      await contract.allPairsLength();
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Create PancakeSwap Factory instance
 */
export function createPancakeSwapFactory(config: PancakeSwapFactoryConfig): PancakeSwapFactory {
  return new PancakeSwapFactory(config);
}

/**
 * Default PancakeSwap Factory configuration
 */
export function getDefaultPancakeSwapFactoryConfig(signer?: ethers.Signer): PancakeSwapFactoryConfig {
  const provider = new ethers.JsonRpcProvider(BSC_CONFIG.BSC_RPC_URL);

  return {
    provider,
    signer,
    useV3: false
  };
}