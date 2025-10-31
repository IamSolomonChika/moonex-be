import { AMMCalculator } from '../services/trading/amm-calculator';

describe('AMM Calculator', () => {
  let calculator: AMMCalculator;

  beforeAll(() => {
    calculator = new AMMCalculator();
  });

  describe('calculateSwapOutput', () => {
    it('should calculate correct swap output for simple case', () => {
      const inputAmount = '1000';
      const inputReserve = '10000';
      const outputReserve = '20000';
      const fee = '0.003'; // 0.3%

      const output = calculator.calculateSwapOutput(
        inputAmount,
        inputReserve,
        outputReserve,
        fee
      );

      expect(output).toBeDefined();
      expect(parseFloat(output)).toBeGreaterThan(0);
      expect(parseFloat(output)).toBeLessThan(parseFloat(outputReserve));
    });

    it('should handle zero input amount', () => {
      expect(() => {
        calculator.calculateSwapOutput('0', '1000', '2000', '0.003');
      }).toThrow('Input amount must be greater than 0');
    });

    it('should handle zero reserves', () => {
      expect(() => {
        calculator.calculateSwapOutput('100', '0', '2000', '0.003');
      }).toThrow('Reserves must be greater than 0');
    });

    it('should respect fee calculation', () => {
      const inputAmount = '1000';
      const inputReserve = '10000';
      const outputReserve = '20000';

      const outputWithFee = calculator.calculateSwapOutput(
        inputAmount,
        inputReserve,
        outputReserve,
        '0.01' // 1% fee
      );

      const outputNoFee = calculator.calculateSwapOutput(
        inputAmount,
        inputReserve,
        outputReserve,
        '0' // No fee
      );

      expect(parseFloat(outputWithFee)).toBeLessThan(parseFloat(outputNoFee));
    });
  });

  describe('generateSwapQuote', () => {
    it('should generate complete swap quote', () => {
      const quote = calculator.generateSwapQuote(
        '1000', // input amount
        '10000', // input reserve
        '20000', // output reserve
        '0.003', // fee
        '0.005' // slippage tolerance
      );

      expect(quote).toHaveProperty('inputAmount', '1000');
      expect(quote).toHaveProperty('outputAmount');
      expect(quote).toHaveProperty('price');
      expect(quote).toHaveProperty('priceImpact');
      expect(quote).toHaveProperty('fee');
      expect(quote).toHaveProperty('slippage', '0.005');
      expect(quote).toHaveProperty('minimumOutput');

      expect(parseFloat(quote.minimumOutput)).toBeLessThan(parseFloat(quote.outputAmount));
      expect(parseFloat(quote.priceImpact)).toBeGreaterThanOrEqual(0);
    });

    it('should calculate slippage protection correctly', () => {
      const quote = calculator.generateSwapQuote(
        '1000',
        '10000',
        '20000',
        '0.003',
        '0.01' // 1% slippage
      );

      const expectedMinimum = parseFloat(quote.outputAmount) * 0.99; // 1% less than output
      expect(parseFloat(quote.minimumOutput)).toBeCloseTo(expectedMinimum, 2);
    });
  });

  describe('calculateLiquidityAmounts', () => {
    it('should calculate optimal liquidity amounts', () => {
      const result = calculator.calculateLiquidityAmounts(
        '1000', // amount0
        '2000', // amount1
        '10000', // reserve0
        '20000'  // reserve1
      );

      expect(result).toHaveProperty('amount0');
      expect(result).toHaveProperty('amount1');
      expect(result.amount0).toBe('1000'); // Should keep amount0 as is
      expect(parseFloat(result.amount1)).toBeCloseTo(2000, 0); // Should adjust amount1
    });

    it('should handle first liquidity provider', () => {
      const result = calculator.calculateLiquidityAmounts(
        '1000',
        '2000',
        '0', // No existing reserves
        '0'
      );

      expect(result.amount0).toBe('1000');
      expect(result.amount1).toBe('2000');
    });
  });

  describe('calculateImpermanentLoss', () => {
    it('should calculate impermanent loss correctly', () => {
      // 2x price change should result in ~5.7% loss
      const loss = calculator.calculateImpermanentLoss('2', '1');
      const lossPercentage = parseFloat(loss);

      expect(lossPercentage).toBeGreaterThan(0);
      expect(lossPercentage).toBeLessThan(6); // Should be around 5.7%
    });

    it('should return zero loss for no price change', () => {
      const loss = calculator.calculateImpermanentLoss('1', '1');
      expect(parseFloat(loss)).toBeCloseTo(0, 5);
    });

    it('should handle price decrease', () => {
      const loss = calculator.calculateImpermanentLoss('0.5', '1');
      expect(parseFloat(loss)).toBeGreaterThan(0);
    });
  });
});