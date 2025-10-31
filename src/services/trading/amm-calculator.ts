import { Decimal } from 'decimal.js';

/**
 * AMM Calculator implementing Uniswap V2-style constant product formula (x*y=k)
 */

/**
 * Token pair interface for AMM calculations
 */
export interface TokenPair {
  token0: {
    address: string;
    symbol: string;
    decimals: number;
  };
  token1: {
    address: string;
    symbol: string;
    decimals: number;
  };
}

/**
 * Liquidity pool interface
 */
export interface LiquidityPool {
  token0Reserve: string;
  token1Reserve: string;
  fee: string; // Trading fee as decimal (e.g., "0.003" for 0.3%)
  lpTokenSupply: string;
}

/**
 * Swap quote interface
 */
export interface SwapQuote {
  inputAmount: string;
  outputAmount: string;
  price: string;
  priceImpact: string;
  fee: string;
  slippage: string;
  minimumOutput: string;
}

/**
 * AMM Calculator class for constant product formula calculations
 */
export class AMMCalculator {
  private readonly MINIMUM_LIQUIDITY = '1000';

  /**
   * Calculate swap output using constant product formula
   * x * y = k, where k remains constant
   *
   * Formula: outputAmount = inputAmount * outputReserve * (1000 - fee) / (inputReserve * 1000 + inputAmount * (1000 - fee))
   */
  calculateSwapOutput(
    inputAmount: string,
    inputReserve: string,
    outputReserve: string,
    fee: string
  ): string {
    try {
      const input = new Decimal(inputAmount);
      const reserveIn = new Decimal(inputReserve);
      const reserveOut = new Decimal(outputReserve);
      const feeDecimal = new Decimal(fee);

      // Validate inputs
      if (input.lte(0)) {
        throw new Error('Input amount must be greater than 0');
      }

      if (reserveIn.lte(0) || reserveOut.lte(0)) {
        throw new Error('Reserves must be greater than 0');
      }

      // Apply fee (multiply by (1000 - fee) / 1000)
      const feeMultiplier = new Decimal(1).minus(feeDecimal);
      const inputWithFee = input.mul(feeMultiplier);

      // Calculate output amount
      const numerator = inputWithFee.mul(reserveOut);
      const denominator = reserveIn.plus(inputWithFee);
      const outputAmount = numerator.div(denominator);

      // Ensure output is positive
      if (outputAmount.lte(0)) {
        throw new Error('Insufficient liquidity for this swap');
      }

      return outputAmount.toString();
    } catch (error) {
      throw new Error(`Swap calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate the required input amount for a desired output amount
   */
  calculateSwapInput(
    outputAmount: string,
    inputReserve: string,
    outputReserve: string,
    fee: string
  ): string {
    try {
      const output = new Decimal(outputAmount);
      const reserveIn = new Decimal(inputReserve);
      const reserveOut = new Decimal(outputReserve);
      const feeDecimal = new Decimal(fee);

      if (output.lte(0)) {
        throw new Error('Output amount must be greater than 0');
      }

      if (reserveIn.lte(0) || reserveOut.lte(0)) {
        throw new Error('Reserves must be greater than 0');
      }

      // Calculate required input using reverse formula
      const numerator = reserveIn.mul(output);
      const denominator = reserveOut.minus(output);
      const inputWithFee = numerator.div(denominator);

      // Account for fee (divide by (1000 - fee) / 1000)
      const feeMultiplier = new Decimal(1).minus(feeDecimal);
      const inputAmount = inputWithFee.div(feeMultiplier);

      return inputAmount.toString();
    } catch (error) {
      throw new Error(`Input calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate price impact of a swap
   */
  calculatePriceImpact(
    inputAmount: string,
    outputAmount: string,
    inputReserve: string,
    outputReserve: string
  ): string {
    try {
      const input = new Decimal(inputAmount);
      const output = new Decimal(outputAmount);
      const reserveIn = new Decimal(inputReserve);
      const reserveOut = new Decimal(outputReserve);

      // Calculate current price
      const currentPrice = reserveOut.div(reserveIn);

      // Calculate execution price
      const executionPrice = output.div(input);

      // Calculate price impact
      const priceDifference = currentPrice.minus(executionPrice);
      const priceImpact = priceDifference.div(currentPrice).abs();

      return priceImpact.mul(100).toString(); // Return as percentage
    } catch (error) {
      throw new Error(`Price impact calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a comprehensive swap quote
   */
  generateSwapQuote(
    inputAmount: string,
    inputReserve: string,
    outputReserve: string,
    fee: string,
    slippageTolerance: string = '0.005' // 0.5% default
  ): SwapQuote {
    try {
      const input = new Decimal(inputAmount);
      const reserveIn = new Decimal(inputReserve);
      const reserveOut = new Decimal(outputReserve);
      const feeDecimal = new Decimal(fee);
      const slippage = new Decimal(slippageTolerance);

      // Calculate output amount
      const outputAmount = this.calculateSwapOutput(inputAmount, inputReserve, outputReserve, fee);

      // Calculate fee amount
      const feeAmount = input.mul(feeDecimal);

      // Calculate current price
      const currentPrice = reserveOut.div(reserveIn);

      // Calculate execution price
      const executionPrice = new Decimal(outputAmount).div(input);

      // Calculate price impact
      const priceImpact = this.calculatePriceImpact(inputAmount, outputAmount, inputReserve, outputReserve);

      // Calculate minimum output with slippage protection
      const slippageMultiplier = new Decimal(1).minus(slippage);
      const minimumOutput = new Decimal(outputAmount).mul(slippageMultiplier);

      return {
        inputAmount: input.toString(),
        outputAmount,
        price: currentPrice.toString(),
        priceImpact,
        fee: feeAmount.toString(),
        slippage: slippageTolerance,
        minimumOutput: minimumOutput.toString()
      };
    } catch (error) {
      throw new Error(`Quote generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate liquidity amounts for adding liquidity
   */
  calculateLiquidityAmounts(
    amount0: string,
    amount1: string,
    reserve0: string,
    reserve1: string
  ): { amount0: string; amount1: string } {
    try {
      if (reserve0 === '0' || reserve1 === '0') {
        // First liquidity provider
        return {
          amount0,
          amount1
        };
      }

      const optimalAmount1 = new Decimal(amount0)
        .mul(new Decimal(reserve1))
        .div(new Decimal(reserve0));

      // Check if optimalAmount1 <= amount1
      if (optimalAmount1.lte(new Decimal(amount1))) {
        return {
          amount0,
          amount1: optimalAmount1.toString()
        };
      } else {
        // Calculate optimal amount0 based on amount1
        const optimalAmount0 = new Decimal(amount1)
          .mul(new Decimal(reserve0))
          .div(new Decimal(reserve1));

        return {
          amount0: optimalAmount0.toString(),
          amount1
        };
      }
    } catch (error) {
      throw new Error(`Liquidity calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate liquidity tokens to mint
   */
  calculateLPTokens(
    amount0: string,
    amount1: string,
    reserve0: string,
    reserve1: string,
    totalSupply: string
  ): string {
    try {
      if (totalSupply === '0') {
        // First liquidity provider
        const liquidity = new Decimal(amount0)
          .mul(new Decimal(amount1))
          .sqrt()
          .minus(new Decimal(this.MINIMUM_LIQUIDITY));

        return liquidity.toString();
      }

      const liquidity0 = new Decimal(amount0)
        .mul(new Decimal(totalSupply))
        .div(new Decimal(reserve0));

      const liquidity1 = new Decimal(amount1)
        .mul(new Decimal(totalSupply))
        .div(new Decimal(reserve1));

      // Return the minimum of both calculations
      return liquidity0.lt(liquidity1) ? liquidity0.toString() : liquidity1.toString();
    } catch (error) {
      throw new Error(`LP token calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate impermanent loss
   */
  calculateImpermanentLoss(
    priceRatio: string, // Current price ratio (token1/token0)
    initialPriceRatio: string = '1' // Initial price ratio (default 1:1)
  ): string {
    try {
      const currentRatio = new Decimal(priceRatio);
      const initialRatio = new Decimal(initialPriceRatio);

      const priceChange = currentRatio.div(initialRatio);

      // Impermanent loss formula: IL = 1 - (2 * sqrt(priceChange) / (1 + priceChange))
      const sqrtPriceChange = priceChange.sqrt();
      const numerator = sqrtPriceChange.mul(2);
      const denominator = new Decimal(1).plus(priceChange);
      const liquidityRatio = numerator.div(denominator);
      const impermanentLoss = new Decimal(1).minus(liquidityRatio);

      // Return as percentage (positive value indicates loss)
      return impermanentLoss.mul(100).toString();
    } catch (error) {
      throw new Error(`Impermanent loss calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}