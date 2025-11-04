import { describe, it, expect } from '@jest/globals';

/**
 * Test BSC module compilation after fixes
 * This test should now pass after fixing all the compilation issues
 */

describe('BSC Module Compilation', () => {
  it('should import BSC config with correct export pattern', async () => {
    // This should work since the config file is not excluded
    const { BSC_CONFIG } = await import('../config/bsc.js');
    expect(BSC_CONFIG).toBeDefined();
    expect(BSC_CONFIG.BSC_CHAIN_ID).toBe(56);
  });

  it('should handle logger imports correctly', async () => {
    // This should work since logger is not excluded
    const logger = await import('../utils/logger.js');
    expect(logger.default).toBeDefined();
  });

  it('should compile and import BSC contracts successfully', async () => {
    // After all our fixes, this should work
    const masterChefModule = await import('../bsc/contracts/masterchef.js');
    expect(masterChefModule).toBeDefined();
  });

  it('should import BSC trading routes successfully', async () => {
    // After fixing Ethers.js v6, logger, and schema issues, this should work
    const tradingModule = await import('../routes/bsc/trading.js');
    expect(tradingModule.tradingRoutes).toBeDefined();
  });

  it('should import BSC liquidity routes successfully', async () => {
    const liquidityModule = await import('../routes/bsc/liquidity.js');
    expect(liquidityModule.liquidityRoutes).toBeDefined();
  });

  it('should import BSC yield routes successfully', async () => {
    const yieldModule = await import('../routes/bsc/yield.js');
    expect(yieldModule.yieldRoutes).toBeDefined();
  });

  it('should import BSC token routes successfully', async () => {
    const tokenModule = await import('../routes/bsc/tokens.js');
    expect(tokenModule.tokenRoutes).toBeDefined();
  });

  it('should import BSC portfolio routes successfully', async () => {
    const portfolioModule = await import('../routes/bsc/portfolio.js');
    expect(portfolioModule.portfolioRoutes).toBeDefined();
  });
});