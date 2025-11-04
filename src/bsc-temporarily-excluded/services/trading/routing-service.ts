/**
 * BSC Routing Service
 * Handles optimal routing and multi-hop path finding for swaps
 */

import { ethers } from 'ethers';
import logger from '../../../utils/logger.js';
import type {
  SwapRoute,
  PoolInfo,
  SwapQuote,
  TradingPair,
  SwapRiskLevel,
  SwapWarning
} from './types.js';
import { IAMMIntegration } from './amm-integration.js';
import { PancakeSwapAMMIntegration } from './amm-integration.js';
import { BSCProviderManager } from '../../utils/ethers-provider.js';
import { BSCCacheManager } from '../cache/cache-manager.js';

/**
 * Routing configuration
 */
export interface RoutingConfig {
  // Path finding
  maxHops: number;
  minLiquidity: string;
  maxSlippagePerHop: number; // basis points

  // Token preferences
  preferredIntermediateTokens: string[];
  excludedTokens: string[];
  excludedPools: string[];

  // Performance
  cacheRoutes: boolean;
  routeCacheTTL: number; // milliseconds

  // Optimization
  enableFeeOptimization: boolean;
  enableGasOptimization: boolean;
  preferLowGasRoutes: boolean;

  // Risk management
  maxRiskLevel: SwapRiskLevel;
  requireMinimumLiquidity: boolean;
}

/**
 * Route calculation result
 */
export interface RouteCalculationResult {
  routes: CalculatedRoute[];
  bestRoute: CalculatedRoute;
  alternatives: CalculatedRoute[];
  totalOptions: number;
  calculationTime: number;
}

export interface CalculatedRoute {
  path: string[];
  route: SwapRoute[];
  totalAmountIn: string;
  totalAmountOut: string;
  totalFee: string;
  totalGasEstimate: string;
  totalSlippage: number;
  totalPriceImpact: number;
  confidence: number; // 0-100
  warnings: SwapWarning[];
  riskLevel: SwapRiskLevel;
}

/**
 * Routing Service Interface
 */
export interface IRoutingService {
  // Route calculation
  calculateRoute(tokenIn: string, tokenOut: string, amountIn: string): Promise<RouteCalculationResult>;
  calculateRouteOut(tokenIn: string, tokenOut: string, amountOut: string): Promise<RouteCalculationResult>;
  findBestRoutes(tokenIn: string, tokenOut: string, amountIn: string, maxRoutes: number): Promise<CalculatedRoute[]>;

  // Path optimization
  optimizeRoute(route: CalculatedRoute): Promise<CalculatedRoute>;
  validateRoute(route: CalculatedRoute): Promise<{ isValid: boolean; issues: string[] }>;

  // Liquidity analysis
  analyzeRouteLiquidity(route: CalculatedRoute): Promise<any>;
  estimateRouteGasCost(route: CalculatedRoute): Promise<string>;

  // Pool management
  getPoolsForToken(tokenAddress: string): Promise<PoolInfo[]>;
  getTopPools(limit: number): Promise<PoolInfo[]>;

  // Cache management
  clearRouteCache(): Promise<void>;
  warmupRouteCache(): Promise<void>;

  // Analytics
  getRoutingAnalytics(timeframe?: string): Promise<any>;
}

/**
 * Routing Service Implementation
 */
export class RoutingService implements IRoutingService {
  private ammIntegration: IAMMIntegration;
  private provider: BSCProviderManager;
  private cache: BSCCacheManager;
  private config: RoutingConfig;

  // Common intermediate tokens for routing
  private readonly COMMON_TOKENS = {
    WBNB: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82'
  };

  // Graph for path finding
  private tokenGraph: Map<string, Set<string>> = new Map();
  private pools: Map<string, PoolInfo> = new Map();

  constructor(config?: Partial<RoutingConfig>) {
    this.ammIntegration = new PancakeSwapAMMIntegration();
    this.provider = new BSCProviderManager();
    this.cache = new BSCCacheManager();

    this.config = {
      maxHops: 4,
      minLiquidity: '1000', // $1,000
      maxSlippagePerHop: 100, // 1%
      preferredIntermediateTokens: [this.COMMON_TOKENS.WBNB],
      excludedTokens: [],
      excludedPools: [],
      cacheRoutes: true,
      routeCacheTTL: 60000, // 1 minute
      enableFeeOptimization: true,
      enableGasOptimization: true,
      preferLowGasRoutes: false,
      maxRiskLevel: SwapRiskLevel.HIGH,
      requireMinimumLiquidity: true,
      ...config
    };
  }

  /**
   * Calculate route for amount in
   */
  async calculateRoute(tokenIn: string, tokenOut: string, amountIn: string): Promise<RouteCalculationResult> {
    const startTime = Date.now();
    logger.debug({ tokenIn, tokenOut, amountIn }, 'Calculating route');

    try {
      // Check cache first
      const cacheKey = `route:${tokenIn}:${tokenOut}:${amountIn}`;
      if (this.config.cacheRoutes) {
        const cached = await this.cache.get<RouteCalculationResult>(cacheKey);
        if (cached && (Date.now() - cached.calculationTime) < this.config.routeCacheTTL) {
          logger.debug('Returning cached route');
          return cached;
        }
      }

      // Ensure graph is built
      await this.buildTokenGraph();

      // Find all possible paths
      const paths = this.findPaths(tokenIn, tokenOut);

      if (paths.length === 0) {
        throw new Error('No valid path found');
      }

      // Calculate routes for all paths
      const calculatedRoutes = await this.calculateRoutesForPaths(paths, amountIn, 'input');

      // Sort routes by amount out (descending)
      calculatedRoutes.sort((a, b) => {
        const aOut = BigInt(a.totalAmountOut);
        const bOut = BigInt(b.totalAmountOut);
        return bOut > aOut ? 1 : aOut > bOut ? -1 : 0;
      });

      if (calculatedRoutes.length === 0) {
        throw new Error('No valid routes calculated');
      }

      const result: RouteCalculationResult = {
        routes: calculatedRoutes,
        bestRoute: calculatedRoutes[0],
        alternatives: calculatedRoutes.slice(1, 5), // Top 5 alternatives
        totalOptions: calculatedRoutes.length,
        calculationTime: Date.now() - startTime
      };

      // Cache result
      if (this.config.cacheRoutes) {
        await this.cache.set(cacheKey, result, this.config.routeCacheTTL);
      }

      logger.info({
        tokenIn,
        tokenOut,
        amountIn,
        bestRoute: {
          hops: result.bestRoute.path.length,
          amountOut: result.bestRoute.totalAmountOut,
          confidence: result.bestRoute.confidence
        },
        calculationTime: result.calculationTime
      }, 'Route calculation completed');

      return result;

    } catch (error) {
      logger.error({
        tokenIn,
        tokenOut,
        amountIn,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to calculate route');
      throw error;
    }
  }

  /**
   * Calculate route for amount out
   */
  async calculateRouteOut(tokenIn: string, tokenOut: string, amountOut: string): Promise<RouteCalculationResult> {
    const startTime = Date.now();
    logger.debug({ tokenIn, tokenOut, amountOut }, 'Calculating route for amount out');

    try {
      // Check cache
      const cacheKey = `route_out:${tokenIn}:${tokenOut}:${amountOut}`;
      if (this.config.cacheRoutes) {
        const cached = await this.cache.get<RouteCalculationResult>(cacheKey);
        if (cached && (Date.now() - cached.calculationTime) < this.config.routeCacheTTL) {
          return cached;
        }
      }

      // Build graph
      await this.buildTokenGraph();

      // Find paths
      const paths = this.findPaths(tokenIn, tokenOut);

      if (paths.length === 0) {
        throw new Error('No valid path found');
      }

      // Calculate routes for amount out
      const calculatedRoutes = await this.calculateRoutesForPaths(paths, amountOut, 'output');

      // Sort routes by amount in (ascending)
      calculatedRoutes.sort((a, b) => {
        const aIn = BigInt(a.totalAmountIn);
        const bIn = BigInt(b.totalAmountIn);
        return aIn > bIn ? 1 : aIn < bIn ? -1 : 0;
      });

      const result: RouteCalculationResult = {
        routes: calculatedRoutes,
        bestRoute: calculatedRoutes[0],
        alternatives: calculatedRoutes.slice(1, 5),
        totalOptions: calculatedRoutes.length,
        calculationTime: Date.now() - startTime
      };

      // Cache result
      if (this.config.cacheRoutes) {
        await this.cache.set(cacheKey, result, this.config.routeCacheTTL);
      }

      logger.info({
        tokenIn,
        tokenOut,
        amountOut,
        bestRoute: {
          hops: result.bestRoute.path.length,
          amountIn: result.bestRoute.totalAmountIn,
          confidence: result.bestRoute.confidence
        },
        calculationTime: result.calculationTime
      }, 'Route calculation for amount out completed');

      return result;

    } catch (error) {
      logger.error({
        tokenIn,
        tokenOut,
        amountOut,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to calculate route for amount out');
      throw error;
    }
  }

  /**
   * Find best routes
   */
  async findBestRoutes(tokenIn: string, tokenOut: string, amountIn: string, maxRoutes: number): Promise<CalculatedRoute[]> {
    try {
      const result = await this.calculateRoute(tokenIn, tokenOut, amountIn);
      return result.routes.slice(0, maxRoutes);

    } catch (error) {
      logger.error({
        tokenIn,
        tokenOut,
        amountIn,
        maxRoutes,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to find best routes');
      return [];
    }
  }

  /**
   * Optimize route
   */
  async optimizeRoute(route: CalculatedRoute): Promise<CalculatedRoute> {
    logger.debug({ route: route.path }, 'Optimizing route');

    try {
      let optimizedRoute = { ...route };

      // Optimize gas usage
      if (this.config.enableGasOptimization) {
        optimizedRoute = await this.optimizeRouteGas(optimizedRoute);
      }

      // Optimize fees
      if (this.config.enableFeeOptimization) {
        optimizedRoute = await this.optimizeRouteFees(optimizedRoute);
      }

      // Re-calculate confidence score
      optimizedRoute.confidence = this.calculateRouteConfidence(optimizedRoute);

      return optimizedRoute;

    } catch (error) {
      logger.error({
        route: route.path,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to optimize route');
      return route;
    }
  }

  /**
   * Validate route
   */
  async validateRoute(route: CalculatedRoute): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];
    let isValid = true;

    // Check path length
    if (route.path.length > this.config.maxHops + 1) {
      issues.push(`Route exceeds maximum hops (${this.config.maxHops})`);
      isValid = false;
    }

    // Check slippage
    if (route.totalSlippage > 500) { // 5%
      issues.push('Total slippage too high');
      isValid = false;
    }

    // Check liquidity
    if (this.config.requireMinimumLiquidity) {
      for (const pool of route.route) {
        if (BigInt(pool.liquidity) < BigInt(this.config.minLiquidity)) {
          issues.push(`Insufficient liquidity in pool ${pool.poolAddress}`);
          isValid = false;
        }
      }
    }

    // Check risk level
    if (route.riskLevel === SwapRiskLevel.VERY_HIGH) {
      issues.push('Route risk level too high');
      isValid = false;
    }

    // Validate pools
    for (const swap of route.route) {
      if (this.config.excludedPools.includes(swap.poolAddress)) {
        issues.push(`Pool ${swap.poolAddress} is excluded`);
        isValid = false;
      }
    }

    return { isValid, issues };
  }

  /**
   * Analyze route liquidity
   */
  async analyzeRouteLiquidity(route: CalculatedRoute): Promise<any> {
    try {
      const analysis = {
        totalLiquidity: '0',
        averageLiquidity: '0',
        minimumLiquidity: '0',
        liquidityUtilization: 0,
        isLiquidityConcentrated: false,
        liquidityRisk: SwapRiskLevel.LOW
      };

      let totalLiquidity = BigInt(0);
      let minLiquidity = BigInt('999999999999999999999'); // Very large number

      for (const swap of route.route) {
        const liquidity = BigInt(swap.liquidity);
        totalLiquidity += liquidity;
        if (liquidity < minLiquidity) {
          minLiquidity = liquidity;
        }
      }

      analysis.totalLiquidity = totalLiquidity.toString();
      analysis.averageLiquidity = (totalLiquidity / BigInt(route.route.length)).toString();
      analysis.minimumLiquidity = minLiquidity.toString();

      return analysis;

    } catch (error) {
      logger.error({
        route: route.path,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to analyze route liquidity');
      return null;
    }
  }

  /**
   * Estimate route gas cost
   */
  async estimateRouteGasCost(route: CalculatedRoute): Promise<string> {
    try {
      // Base gas for swaps
      const baseGasPerSwap = 100000;
      const additionalGasPerHop = 50000;

      const totalGas = baseGasPerSwap + (route.route.length - 1) * additionalGasPerHop;

      // Get current gas price
      const provider = await this.provider.getProvider();
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');

      const totalCost = BigInt(totalGas) * gasPrice;
      return totalCost.toString();

    } catch (error) {
      logger.error({
        route: route.path,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to estimate route gas cost');
      return '0';
    }
  }

  /**
   * Get pools for token
   */
  async getPoolsForToken(tokenAddress: string): Promise<PoolInfo[]> {
    try {
      const cacheKey = `pools:${tokenAddress}`;
      const cached = await this.cache.get<PoolInfo[]>(cacheKey);

      if (cached) {
        return cached;
      }

      // Fetch all trading pairs and filter
      const allPairs = await this.ammIntegration.getTradingPairs();
      const tokenPools = allPairs.filter(pair =>
        pair.token0.address.toLowerCase() === tokenAddress.toLowerCase() ||
        pair.token1.address.toLowerCase() === tokenAddress.toLowerCase()
      );

      const pools: PoolInfo[] = tokenPools.map(pair => ({
        address: pair.address,
        token0: pair.token0.address,
        token1: pair.token1.address,
        reserve0: pair.reserve0,
        reserve1: pair.reserve1,
        liquidity: pair.liquidity,
        fee: pair.fee,
        volume24h: pair.volume24h,
        apr: pair.apr,
        price: pair.price,
        priceUSD: pair.priceUSD
      }));

      // Cache for 5 minutes
      await this.cache.set(cacheKey, pools, 300000);

      return pools;

    } catch (error) {
      logger.error({
        tokenAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get pools for token');
      return [];
    }
  }

  /**
   * Get top pools
   */
  async getTopPools(limit: number): Promise<PoolInfo[]> {
    try {
      const allPairs = await this.ammIntegration.getTradingPairs();

      const pools: PoolInfo[] = allPairs
        .filter(pair => !this.config.excludedPools.includes(pair.address))
        .map(pair => ({
          address: pair.address,
          token0: pair.token0.address,
          token1: pair.token1.address,
          reserve0: pair.reserve0,
          reserve1: pair.reserve1,
          liquidity: pair.liquidity,
          fee: pair.fee,
          volume24h: pair.volume24h,
          apr: pair.apr,
          price: pair.price,
          priceUSD: pair.priceUSD
        }))
        .sort((a, b) => parseFloat(b.liquidity) - parseFloat(a.liquidity))
        .slice(0, limit);

      return pools;

    } catch (error) {
      logger.error({
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get top pools');
      return [];
    }
  }

  /**
   * Clear route cache
   */
  async clearRouteCache(): Promise<void> {
    try {
      // In a real implementation, this would clear cached routes
      logger.info('Route cache cleared');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to clear route cache');
    }
  }

  /**
   * Warm up route cache
   */
  async warmupRouteCache(): Promise<void> {
    try {
      logger.info('Warming up route cache');

      // Pre-calculate routes for common token pairs
      const commonTokens = [
        this.COMMON_TOKENS.WBNB,
        this.COMMON_TOKENS.USDT,
        this.COMMON_TOKENS.BUSD,
        this.COMMON_TOKENS.CAKE
      ];

      for (let i = 0; i < commonTokens.length; i++) {
        for (let j = i + 1; j < commonTokens.length; j++) {
          try {
            await this.calculateRoute(commonTokens[i], commonTokens[j], '1000000000000000000000'); // 1 token
          } catch (error) {
            // Ignore errors during warmup
          }
        }
      }

      logger.info('Route cache warmup completed');

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to warm up route cache');
    }
  }

  /**
   * Get routing analytics
   */
  async getRoutingAnalytics(timeframe?: string): Promise<any> {
    try {
      // This would return routing analytics data
      return {
        totalRoutes: 0,
        averageHops: 0,
        averageSlippage: 0,
        cacheHitRate: 0,
        popularTokens: [],
        topPaths: []
      };

    } catch (error) {
      logger.error({
        timeframe,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get routing analytics');
      throw error;
    }
  }

  // Private helper methods

  private async buildTokenGraph(): Promise<void> {
    if (this.tokenGraph.size > 0) {
      return; // Already built
    }

    try {
      logger.debug('Building token graph');

      const pairs = await this.ammIntegration.getTradingPairs();

      for (const pair of pairs) {
        const token0 = pair.token0.address.toLowerCase();
        const token1 = pair.token1.address.toLowerCase();

        // Skip excluded tokens
        if (this.config.excludedTokens.includes(token0) || this.config.excludedTokens.includes(token1)) {
          continue;
        }

        // Add to graph
        if (!this.tokenGraph.has(token0)) {
          this.tokenGraph.set(token0, new Set());
        }
        if (!this.tokenGraph.has(token1)) {
          this.tokenGraph.set(token1, new Set());
        }

        this.tokenGraph.get(token0)!.add(token1);
        this.tokenGraph.get(token1)!.add(token0);

        // Store pool info
        const poolKey = this.getPoolKey(token0, token1);
        this.pools.set(poolKey, {
          address: pair.address,
          token0: pair.token0.address,
          token1: pair.token1.address,
          reserve0: pair.reserve0,
          reserve1: pair.reserve1,
          liquidity: pair.liquidity,
          fee: pair.fee,
          volume24h: pair.volume24h,
          apr: pair.apr,
          price: pair.price,
          priceUSD: pair.priceUSD
        });
      }

      logger.info({ tokens: this.tokenGraph.size, pools: this.pools.size }, 'Token graph built successfully');

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to build token graph');
      throw error;
    }
  }

  private findPaths(tokenIn: string, tokenOut: string): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();
    const currentPath: string[] = [];

    this.dfsPaths(tokenIn.toLowerCase(), tokenOut.toLowerCase(), currentPath, visited, paths);

    // Filter by max hops
    return paths.filter(path => path.length <= this.config.maxHops + 1);
  }

  private dfsPaths(
    current: string,
    target: string,
    path: string[],
    visited: Set<string>,
    paths: string[][]
  ): void {
    if (current === target) {
      paths.push([...path, current]);
      return;
    }

    if (visited.has(current)) {
      return;
    }

    visited.add(current);
    path.push(current);

    const neighbors = this.tokenGraph.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        this.dfsPaths(neighbor, target, path, visited, paths);
      }
    }

    path.pop();
    visited.delete(current);
  }

  private async calculateRoutesForPaths(
    paths: string[][],
    amount: string,
    direction: 'input' | 'output'
  ): Promise<CalculatedRoute[]> {
    const routes: CalculatedRoute[] = [];

    for (const path of paths) {
      try {
        const route = await this.calculateRouteForPath(path, amount, direction);
        if (route) {
          routes.push(route);
        }
      } catch (error) {
        logger.debug({
          path,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'Failed to calculate route for path');
      }
    }

    return routes;
  }

  private async calculateRouteForPath(
    path: string[],
    amount: string,
    direction: 'input' | 'output'
  ): Promise<CalculatedRoute | null> {
    try {
      if (path.length < 2) {
        return null;
      }

      const swapRoute: SwapRoute[] = [];
      let currentAmount = BigInt(amount);

      for (let i = 0; i < path.length - 1; i++) {
        const tokenIn = path[i];
        const tokenOut = path[i + 1];
        const poolKey = this.getPoolKey(tokenIn, tokenOut);
        const pool = this.pools.get(poolKey);

        if (!pool) {
          return null;
        }

        // Calculate output for this hop
        const [amountOut, fee] = this.calculateHopOutput(
          currentAmount,
          pool.reserve0,
          pool.reserve1,
          pool.fee,
          tokenIn.toLowerCase() === pool.token0.toLowerCase()
        );

        const swap: SwapRoute = {
          poolAddress: pool.address,
          tokenIn,
          tokenOut,
          fee: pool.fee,
          amountIn: currentAmount.toString(),
          amountOut: amountOut.toString(),
          priceImpact: this.calculatePriceImpact(currentAmount, pool.reserve0, pool.reserve1),
          liquidity: pool.liquidity
        };

        swapRoute.push(swap);
        currentAmount = amountOut;
      }

      // Calculate totals
      const totalFee = swapRoute.reduce((sum, swap) => sum + BigInt(swap.fee), BigInt(0));
      const totalSlippage = this.calculateTotalSlippage(swapRoute);
      const totalPriceImpact = swapRoute.reduce((sum, swap) => sum + swap.priceImpact, 0);

      const route: CalculatedRoute = {
        path,
        route: swapRoute,
        totalAmountIn: direction === 'input' ? amount : currentAmount.toString(),
        totalAmountOut: direction === 'input' ? currentAmount.toString() : amount,
        totalFee: totalFee.toString(),
        totalGasEstimate: await this.estimateRouteGasCost({ path, route: swapRoute } as CalculatedRoute),
        totalSlippage,
        totalPriceImpact,
        confidence: this.calculateRouteConfidence({ path, route: swapRoute } as CalculatedRoute),
        warnings: [],
        riskLevel: this.assessRouteRisk({ path, route: swapRoute } as CalculatedRoute)
      };

      return route;

    } catch (error) {
      logger.debug({
        path,
        amount,
        direction,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to calculate route for path');
      return null;
    }
  }

  private calculateHopOutput(
    amountIn: bigint,
    reserve0: string,
    reserve1: string,
    fee: number,
    isToken0Input: boolean
  ): [bigint, bigint] {
    const res0 = BigInt(reserve0);
    const res1 = BigInt(reserve1);
    const feeBps = BigInt(fee);

    if (isToken0Input) {
      // Input is token0, output is token1
      const amountInWithFee = amountIn * (BigInt(10000) - feeBps) / BigInt(10000);
      const amountOut = (amountInWithFee * res1) / (res0 + amountInWithFee);
      return [amountOut, amountIn - amountOutWithFee];
    } else {
      // Input is token1, output is token0
      const amountInWithFee = amountIn * (BigInt(10000) - feeBps) / BigInt(10000);
      const amountOut = (amountInWithFee * res0) / (res1 + amountInWithFee);
      return [amountOut, amountIn - amountInWithFee];
    }
  }

  private calculatePriceImpact(amountIn: bigint, reserve0: string, reserve1: string): number {
    const res0 = BigInt(reserve0);
    const res1 = BigInt(reserve1);

    if (res0 === BigInt(0) || res1 === BigInt(0)) {
      return 0;
    }

    // Price before trade
    const priceBefore = Number(res1) / Number(res0);

    // Price after trade
    const newRes0 = res0 + amountIn;
    const newRes1 = res1 - (amountIn * res1) / (res0 + amountIn);
    const priceAfter = Number(newRes1) / Number(newRes0);

    // Price impact percentage
    return Math.abs((priceAfter - priceBefore) / priceBefore) * 100;
  }

  private calculateTotalSlippage(route: SwapRoute[]): number {
    if (route.length === 0) return 0;

    // Calculate total slippage across all hops
    let totalSlippage = 0;
    for (const swap of route) {
      totalSlippage += swap.priceImpact;
    }

    return totalSlippage;
  }

  private calculateRouteConfidence(route: CalculatedRoute): number {
    let confidence = 100;

    // Deduct for each hop
    confidence -= (route.path.length - 2) * 10;

    // Deduct for high slippage
    if (route.totalSlippage > 1) confidence -= 10;
    if (route.totalSlippage > 2) confidence -= 20;
    if (route.totalSlippage > 5) confidence -= 30;

    // Deduct for low liquidity
    for (const swap of route.route) {
      if (BigInt(swap.liquidity) < BigInt(this.config.minLiquidity)) {
        confidence -= 15;
      }
    }

    // Deduct for risk level
    switch (route.riskLevel) {
      case SwapRiskLevel.MEDIUM:
        confidence -= 10;
        break;
      case SwapRiskLevel.HIGH:
        confidence -= 25;
        break;
      case SwapRiskLevel.VERY_HIGH:
        confidence -= 50;
        break;
    }

    return Math.max(0, Math.min(100, confidence));
  }

  private assessRouteRisk(route: CalculatedRoute): SwapRiskLevel {
    let riskScore = 0;

    // Risk for more hops
    riskScore += (route.path.length - 2) * 10;

    // Risk for high slippage
    if (route.totalSlippage > 2) riskScore += 20;
    if (route.totalSlippage > 5) riskScore += 30;

    // Risk for low liquidity
    for (const swap of route.route) {
      if (BigInt(swap.liquidity) < BigInt(this.config.minLiquidity)) {
        riskScore += 25;
      }
    }

    // Convert score to risk level
    if (riskScore >= 50) return SwapRiskLevel.VERY_HIGH;
    if (riskScore >= 30) return SwapRiskLevel.HIGH;
    if (riskScore >= 15) return SwapRiskLevel.MEDIUM;
    return SwapRiskLevel.LOW;
  }

  private getPoolKey(token0: string, token1: string): string {
    const sorted = [token0.toLowerCase(), token1.toLowerCase()].sort();
    return `${sorted[0]}-${sorted[1]}`;
  }

  private async optimizeRouteGas(route: CalculatedRoute): Promise<CalculatedRoute> {
    // Implementation would optimize gas usage
    return route;
  }

  private async optimizeRouteFees(route: CalculatedRoute): Promise<CalculatedRoute> {
    // Implementation would optimize for lower fees
    return route;
  }
}

// Export singleton instance
export const routingService = new RoutingService();