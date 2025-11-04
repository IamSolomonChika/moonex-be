/**
 * Pair Contract Integration
 * Comprehensive interaction with PancakeSwap V2 pairs and V3 pools for price data
 */

import { ethers } from 'ethers';
import logger from '../../utils/logger.js';
import { BSC_CONFIG } from '../../config/bsc.js';

// Pair Contract ABI (V2)
const PAIR_CONTRACT_ABI = [
  // ERC20 functions
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 value) external returns (bool)',
  'function transfer(address to, uint256 value) external returns (bool)',
  'function transferFrom(address from, address to, uint256 value) external returns (bool)',

  // Pair-specific functions
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function factory() external view returns (address)',
  'function kLast() external view returns (uint256)',
  'function MINIMUM_LIQUIDITY() external pure returns (uint256)',

  // Liquidity functions
  'function mint(address to) external returns (uint256 liquidity)',
  'function burn(address to) external returns (uint256 amount0, uint256 amount1)',
  'function skim(address to) external',
  'function sync() external',

  // Swap functions
  'function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external',

  // Events
  'event Mint(address indexed sender, uint amount0, uint amount1)',
  'event Burn(address indexed sender, uint amount0, uint amount1, address indexed to)',
  'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)',
  'event Sync(uint112 reserve0, uint112 reserve1)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

// V3 Pool ABI (essential functions)
const POOL_CONTRACT_ABI = [
  // Position functions
  'function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function liquidity() external view returns (uint128)',
  'function fee() external view returns (uint24)',
  'function tickSpacing() external view returns (int24)',
  'function maxLiquidityPerTick() external view returns (uint128)',

  // State functions
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function factory() external view returns (address)',

  // Price calculation functions
  'function sqrtPriceX96() external view returns (uint160)',
  'function tick() external view returns (int24)',

  // Oracle functions
  'function observe(uint32[] calldata secondsAgos) external view returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)',
  'function snapshotCumulativesInside(int24 tickLower, int24 tickUpper) external view returns (int56 tickCumulativeInside, uint160 secondsPerLiquidityInsideX128, uint32 secondsInside)',

  // Swap functions
  'function swap(address recipient, bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96, bytes calldata data) external returns (int256 amount0, int256 amount1)',
  'function flash(address recipient, uint256 amount0, uint256 amount1, bytes calldata data) external',

  // Events
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
  'event Mint(address indexed sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
  'event Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
  'event Flash(address indexed sender, address indexed recipient, uint256 amount0, uint256 amount1, uint256 paid0, uint256 paid1)'
];

// ERC20 Token ABI (for price calculations)
const ERC20_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)'
];

/**
 * Pair Reserves Information
 */
export interface PairReserves {
  reserve0: string;
  reserve1: string;
  blockTimestampLast: number;
}

/**
 * Pool Slot Information
 */
export interface PoolSlot {
  sqrtPriceX96: string;
  tick: number;
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
  feeProtocol: number;
  unlocked: boolean;
}

/**
 * Price Information
 */
export interface PriceInfo {
  price: string; // token1/token0
  price0: string; // token0/token1
  price1: string; // token1/token0
  sqrtPriceX96?: string; // V3 only
  tick?: number; // V3 only
  liquidity?: string; // V3 only
}

/**
 * Price Calculation Result
 */
export interface PriceCalculation {
  amountIn: string;
  amountOut: string;
  price: string;
  priceImpact: number;
  gasEstimate: string;
}

/**
 * Pair Contract Configuration
 */
export interface PairContractConfig {
  provider: ethers.Provider;
  signer?: ethers.Signer;
}

/**
 * Pair Contract Integration
 */
export class PairContracts {
  private provider: ethers.Provider;
  private signer?: ethers.Signer;
  private config: PairContractConfig;

  // Contract instances cache
  private contractCache: Map<string, ethers.Contract> = new Map();
  private tokenCache: Map<string, ethers.Contract> = new Map();

  constructor(config: PairContractConfig) {
    this.provider = config.provider;
    this.signer = config.signer;
    this.config = config;

    logger.info('Pair Contracts integration initialized');
  }

  /**
   * Get pair reserves (V2)
   */
  async getPairReserves(pairAddress: string): Promise<PairReserves> {
    try {
      const pair = this.getPairContract(pairAddress);
      const reserves = await pair.getReserves();

      return {
        reserve0: reserves.reserve0.toString(),
        reserve1: reserves.reserve1.toString(),
        blockTimestampLast: reserves.blockTimestampLast.toNumber()
      };
    } catch (error) {
      logger.error({ pairAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get pair reserves');
      throw new Error(`Failed to get pair reserves: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pool slot data (V3)
   */
  async getPoolSlot(poolAddress: string): Promise<PoolSlot> {
    try {
      const pool = this.getPoolContract(poolAddress);
      const slot0 = await pool.slot0();

      return {
        sqrtPriceX96: slot0.sqrtPriceX96.toString(),
        tick: slot0.tick,
        observationIndex: slot0.observationIndex,
        observationCardinality: slot0.observationCardinality,
        observationCardinalityNext: slot0.observationCardinalityNext,
        feeProtocol: slot0.feeProtocol,
        unlocked: slot0.unlocked
      };
    } catch (error) {
      logger.error({ poolAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get pool slot data');
      throw new Error(`Failed to get pool slot data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current price from pair (V2)
   */
  async getCurrentPrice(pairAddress: string): Promise<PriceInfo> {
    try {
      const reserves = await this.getPairReserves(pairAddress);
      const pair = this.getPairContract(pairAddress);
      const [token0, token1] = await Promise.all([pair.token0(), pair.token1()]);

      // Calculate price: reserve1/reserve0 (token1/token0)
      const price = parseFloat(reserves.reserve1) / parseFloat(reserves.reserve0);
      const price0 = 1 / price;
      const price1 = price;

      return {
        price: price.toString(),
        price0: price0.toString(),
        price1: price1.toString()
      };
    } catch (error) {
      logger.error({ pairAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get current price');
      throw new Error(`Failed to get current price: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current price from pool (V3)
   */
  async getCurrentPriceV3(poolAddress: string): Promise<PriceInfo> {
    try {
      const pool = this.getPoolContract(poolAddress);
      const [slot0, liquidity] = await Promise.all([pool.slot0(), pool.liquidity()]);
      const [token0, token1] = await Promise.all([pool.token0(), pool.token1()]);

      // Calculate price from sqrtPriceX96
      const sqrtPrice = parseFloat(slot0.sqrtPriceX96.toString());
      const price = Math.pow(sqrtPrice / (2 ** 96), 2);
      const price0 = 1 / price;
      const price1 = price;

      return {
        price: price.toString(),
        price0: price0.toString(),
        price1: price1.toString(),
        sqrtPriceX96: slot0.sqrtPriceX96.toString(),
        tick: slot0.tick,
        liquidity: liquidity.toString()
      };
    } catch (error) {
      logger.error({ poolAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get current V3 price');
      throw new Error(`Failed to get current V3 price: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate swap amount (V2)
   */
  async calculateSwapAmount(
    pairAddress: string,
    amountIn: string,
    tokenInAddress: string,
    zeroForOne: boolean
  ): Promise<PriceCalculation> {
    try {
      const reserves = await this.getPairReserves(pairAddress);
      const pair = this.getPairContract(pairAddress);
      const [token0, token1] = await Promise.all([pair.token0(), pair.token1()]);

      // Determine which reserve is input/output
      const tokenInIsToken0 = tokenInAddress.toLowerCase() === token0.toLowerCase();

      let reserveIn: string;
      let reserveOut: string;

      if (zeroForOne) {
        reserveIn = reserves.reserve0;
        reserveOut = reserves.reserve1;
      } else {
        reserveIn = reserves.reserve1;
        reserveOut = reserves.reserve0;
      }

      // Calculate output amount using constant product formula
      const amountInWithFee = parseFloat(amountIn) * 997; // 0.3% fee
      const numerator = parseFloat(reserveOut) * amountInWithFee;
      const denominator = parseFloat(reserveIn) * 1000 + amountInWithFee;
      const amountOut = numerator / denominator;

      // Calculate price
      const price = zeroForOne ?
        parseFloat(reserveOut) / parseFloat(reserveIn) :
        parseFloat(reserveIn) / parseFloat(reserveOut);

      // Calculate price impact
      const priceImpact = Math.abs((amountOut / parseFloat(reserveOut)) * 100);

      // Estimate gas
      const gasEstimate = '100000'; // V2 swap gas estimate

      return {
        amountIn,
        amountOut: Math.floor(amountOut).toString(),
        price: price.toString(),
        priceImpact,
        gasEstimate
      };
    } catch (error) {
      logger.error({ pairAddress, amountIn, tokenInAddress, zeroForOne, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to calculate swap amount');
      throw new Error(`Failed to calculate swap amount: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate swap amount (V3)
   */
  async calculateSwapAmountV3(
    poolAddress: string,
    amountIn: string,
    zeroForOne: boolean
  ): Promise<PriceCalculation> {
    try {
      const pool = this.getPoolContract(poolAddress);
      const [slot0, liquidity] = await Promise.all([pool.slot0(), pool.liquidity()]);
      const [token0, token1] = await Promise.all([pool.token0(), pool.token1()]);

      // V3 price calculation is more complex
      // For now, provide simplified calculation
      const sqrtPrice = parseFloat(slot0.sqrtPriceX96.toString());
      const currentPrice = Math.pow(sqrtPrice / (2 ** 96), 2);

      // Simplified V3 calculation (in production would use proper V3 math)
      const amountInFloat = parseFloat(amountIn);
      const fee = await pool.fee();
      const feeAmount = amountInFloat * (fee.toNumber() / 1000000); // fee in basis points

      let amountOut: number;
      if (zeroForOne) {
        amountOut = (amountInFloat - feeAmount) * currentPrice;
      } else {
        amountOut = (amountInFloat - feeAmount) / currentPrice;
      }

      const price = zeroForOne ? currentPrice : (1 / currentPrice);
      const priceImpact = Math.abs((amountOut / parseFloat(liquidity.toString())) * 100);
      const gasEstimate = '150000'; // V3 swap gas estimate

      return {
        amountIn,
        amountOut: Math.floor(amountOut).toString(),
        price: price.toString(),
        priceImpact,
        gasEstimate
      };
    } catch (error) {
      logger.error({ poolAddress, amountIn, zeroForOne, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to calculate V3 swap amount');
      throw new Error(`Failed to calculate V3 swap amount: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get token information
   */
  async getTokenInfo(tokenAddress: string): Promise<{
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
  }> {
    try {
      // Check cache first
      if (this.tokenCache.has(tokenAddress)) {
        const token = this.tokenCache.get(tokenAddress)!;
        const [name, symbol, decimals, totalSupply] = await Promise.all([
          token.name(),
          token.symbol(),
          token.decimals(),
          token.totalSupply()
        ]);

        return { name, symbol, decimals: decimals.toNumber(), totalSupply: totalSupply.toString() };
      }

      const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      this.tokenCache.set(tokenAddress, token);

      const [name, symbol, decimals, totalSupply] = await Promise.all([
        token.name(),
        token.symbol(),
        token.decimals(),
        token.totalSupply()
      ]);

      return { name, symbol, decimals: decimals.toNumber(), totalSupply: totalSupply.toString() };
    } catch (error) {
      logger.error({ tokenAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get token info');
      throw new Error(`Failed to get token info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pair total supply (LP tokens)
   */
  async getPairTotalSupply(pairAddress: string): Promise<string> {
    try {
      const pair = this.getPairContract(pairAddress);
      const totalSupply = await pair.totalSupply();
      return totalSupply.toString();
    } catch (error) {
      logger.error({ pairAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get pair total supply');
      throw new Error(`Failed to get pair total supply: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user LP token balance
   */
  async getUserLPBalance(pairAddress: string, userAddress: string): Promise<string> {
    try {
      const pair = this.getPairContract(pairAddress);
      const balance = await pair.balanceOf(userAddress);
      return balance.toString();
    } catch (error) {
      logger.error({ pairAddress, userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get user LP balance');
      throw new Error(`Failed to get user LP balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get token balance
   */
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
    try {
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const balance = await token.balanceOf(userAddress);
      return balance.toString();
    } catch (error) {
      logger.error({ tokenAddress, userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get token balance');
      throw new Error(`Failed to get token balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get price history (simplified)
   */
  async getPriceHistory(
    pairAddress: string,
    hours: number = 24,
    version: 'v2' | 'v3' = 'v2'
  ): Promise<Array<{
    timestamp: number;
    price: string;
    reserve0?: string;
    reserve1?: string;
    liquidity?: string;
  }>> {
    try {
      const history: Array<{
        timestamp: number;
        price: string;
        reserve0?: string;
        reserve1?: string;
        liquidity?: string;
      }> = [];

      // This is a simplified implementation
      // In production, would query historical data from events or external APIs

      const currentTimestamp = Math.floor(Date.now() / 1000);
      const interval = hours * 3600; // hours in seconds

      for (let i = 0; i < hours; i++) {
        const timestamp = currentTimestamp - (i * interval);

        try {
          if (version === 'v2') {
            const price = await this.getCurrentPrice(pairAddress);
            history.push({
              timestamp,
              price: price.price
            });
          } else {
            const price = await this.getCurrentPriceV3(pairAddress);
            history.push({
              timestamp,
              price: price.price,
              liquidity: price.liquidity
            });
          }
        } catch (error) {
          // Skip failed data points
          continue;
        }
      }

      return history.reverse(); // Return in chronological order
    } catch (error) {
      logger.error({ pairAddress, hours, version, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get price history');
      throw new Error(`Failed to get price history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pool liquidity (V3)
   */
  async getPoolLiquidity(poolAddress: string): Promise<string> {
    try {
      const pool = this.getPoolContract(poolAddress);
      const liquidity = await pool.liquidity();
      return liquidity.toString();
    } catch (error) {
      logger.error({ poolAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get pool liquidity');
      throw new Error(`Failed to get pool liquidity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pool fee tier (V3)
   */
  async getPoolFee(poolAddress: string): Promise<number> {
    try {
      const pool = this.getPoolContract(poolAddress);
      const fee = await pool.fee();
      return fee.toNumber();
    } catch (error) {
      logger.error({ poolAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get pool fee');
      throw new Error(`Failed to get pool fee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if contract is a pair
   */
  async isPair(address: string): Promise<boolean> {
    try {
      const contract = new ethers.Contract(address, PAIR_CONTRACT_ABI, this.provider);

      // Try to call pair-specific functions
      await Promise.all([
        contract.getReserves(),
        contract.token0(),
        contract.token1()
      ]);

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if contract is a V3 pool
   */
  async isV3Pool(address: string): Promise<boolean> {
    try {
      const contract = new ethers.Contract(address, POOL_CONTRACT_ABI, this.provider);

      // Try to call V3-specific functions
      await Promise.all([
        contract.slot0(),
        contract.liquidity(),
        contract.fee()
      ]);

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get pair contract instance
   */
  private getPairContract(pairAddress: string): ethers.Contract {
    const cacheKey = `pair_${pairAddress}`;
    if (!this.contractCache.has(cacheKey)) {
      const contract = new ethers.Contract(pairAddress, PAIR_CONTRACT_ABI, this.signer || this.provider);
      this.contractCache.set(cacheKey, contract);
    }
    return this.contractCache.get(cacheKey)!;
  }

  /**
   * Get pool contract instance
   */
  private getPoolContract(poolAddress: string): ethers.Contract {
    const cacheKey = `pool_${poolAddress}`;
    if (!this.contractCache.has(cacheKey)) {
      const contract = new ethers.Contract(poolAddress, POOL_CONTRACT_ABI, this.signer || this.provider);
      this.contractCache.set(cacheKey, contract);
    }
    return this.contractCache.get(cacheKey)!;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.contractCache.clear();
    this.tokenCache.clear();
    logger.info('Pair contracts cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { contracts: number; tokens: number } {
    return {
      contracts: this.contractCache.size,
      tokens: this.tokenCache.size
    };
  }
}

/**
 * Create Pair Contracts instance
 */
export function createPairContracts(config: PairContractConfig): PairContracts {
  return new PairContracts(config);
}

/**
 * Default Pair Contracts configuration
 */
export function getDefaultPairContractsConfig(signer?: ethers.Signer): PairContractConfig {
  const provider = new ethers.JsonRpcProvider(BSC_CONFIG.BSC_RPC_URL);

  return {
    provider,
    signer
  };
}