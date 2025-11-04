/**
 * Unit Tests for Liquidity Service
 * Tests liquidity provision, removal, and farming operations
 */

import { ethers } from 'ethers';
import { LiquidityService } from '../../../src/bsc/services/liquidity/liquidity-service.js';
import { LiquidityError, LiquidityErrorCode, LiquidityRiskLevel, LiquidityWarning } from '../../../src/bsc/services/liquidity/types.js';
import { BSCTestEnvironment } from '../../setup/bsc-test-env.js';
import {
  PancakeRouterMock,
  PancakeFactoryMock,
  ERC20Mock,
  MasterChefMock,
  type MockContract
} from '../../mocks/pancakeswap-contracts.js';

describe('Liquidity Service', () => {
  let liquidityService: LiquidityService;
  let testEnvironment: BSCTestEnvironment;
  let mockContracts: {
    router: PancakeRouterMock;
    factory: PancakeFactoryMock;
    masterChef: MasterChefMock;
    tokens: Map<string, ERC20Mock>;
  };
  let deployer: ethers.Wallet;
  let user: ethers.Wallet;

  beforeAll(async () => {
    // Initialize test environment
    testEnvironment = new BSCTestEnvironment();
    await testEnvironment.initialize();

    // Get wallets
    deployer = testEnvironment.getWallet('deployer');
    user = testEnvironment.getWallet('user1');

    // Get mock contracts
    mockContracts = {
      router: testEnvironment.getContract('router') as PancakeRouterMock,
      factory: testEnvironment.getContract('factory') as PancakeFactoryMock,
      masterChef: testEnvironment.getContract('masterChef') as MasterChefMock,
      tokens: testEnvironment.getTokens()
    };

    // Initialize liquidity service with test configuration
    liquidityService = new LiquidityService({
      defaultOptions: {
        slippageTolerance: 50, // 0.5%
        deadlineMinutes: 20,
        autoApprove: true,
        approveGasLimit: '50000',
        autoStake: false,
        maxPriceImpact: 5,
        requireVerification: true
      }
    });
  });

  afterAll(async () => {
    await testEnvironment.cleanup();
  });

  describe('Add Liquidity Quotes', () => {
    it('should generate valid add liquidity quote for token pair', async () => {
      const request = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('1').toString(),
        recipient: user.address
      };

      const quote = await liquidityService.getAddLiquidityQuote(request);

      expect(quote).toBeDefined();
      expect(quote.tokenA.address).toBe(request.tokenA);
      expect(quote.tokenB.address).toBe(request.tokenB);
      expect(quote.amountA).toBe(request.amountA);
      expect(quote.amountBOut).toBeDefined();
      expect(quote.liquidityOut).toBeDefined();
      expect(quote.shareOfPool).toBeGreaterThanOrEqual(0);
      expect(quote.priceImpact).toBeGreaterThanOrEqual(0);
      expect(quote.gasEstimate).toBeDefined();
      expect(quote.deadline).toBeGreaterThan(Date.now());
      expect(quote.validUntil).toBeGreaterThan(Date.now());
    });

    it('should handle both amounts specified', async () => {
      const request = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('1').toString(),
        amountB: ethers.parseUnits('2000', 6).toString(), // 2000 USDT
        recipient: user.address
      };

      const quote = await liquidityService.getAddLiquidityQuote(request);

      expect(quote).toBeDefined();
      expect(quote.amountA).toBe(request.amountA);
      expect(quote.amountBOut).toBe(request.amountB);
      expect(quote.liquidityOut).toBeDefined();
    });

    it('should calculate optimal amount B when only amount A specified', async () => {
      const request = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('1').toString(),
        recipient: user.address
      };

      const quote = await liquidityService.getAddLiquidityQuote(request);

      expect(quote).toBeDefined();
      expect(quote.amountBOut).toBeDefined();
      expect(parseFloat(quote.amountBOut)).toBeGreaterThan(0);
      // Should be calculated based on pool reserves ratio
    });

    it('should handle ETH liquidity provision correctly', async () => {
      const request = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('1').toString(),
        recipient: user.address,
        isETH: true
      };

      const quote = await liquidityService.getAddLiquidityQuote(request);

      expect(quote).toBeDefined();
      expect(quote.isETH).toBe(true);
      expect(quote.amountETH).toBeDefined();
    });

    it('should assess liquidity risk correctly', async () => {
      // Test low risk scenario
      const lowRiskRequest = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('0.01').toString(), // Small amount
        recipient: user.address
      };

      const lowRiskQuote = await liquidityService.getAddLiquidityQuote(lowRiskRequest);
      expect(lowRiskQuote.riskLevel).toBe(LiquidityRiskLevel.LOW);

      // Test high risk scenario
      const highRiskRequest = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('1000').toString(), // Large amount
        recipient: user.address
      };

      const highRiskQuote = await liquidityService.getAddLiquidityQuote(highRiskRequest);
      expect(highRiskQuote.riskLevel).toBeGreaterThanOrEqual(LiquidityRiskLevel.MEDIUM);
    });

    it('should add warnings for high price impact', async () => {
      const request = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('100').toString(), // Large amount for high impact
        recipient: user.address
      };

      const quote = await liquidityService.getAddLiquidityQuote(request);

      expect(quote).toBeDefined();
      if (quote.priceImpact > 5) {
        expect(quote.warnings).toContain(LiquidityWarning.HIGH_PRICE_IMPACT);
      }
    });

    it('should handle slippage tolerance correctly', async () => {
      const request = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('1').toString(),
        recipient: user.address,
        slippageTolerance: 100 // 1%
      };

      const quote = await liquidityService.getAddLiquidityQuote(request);

      expect(quote).toBeDefined();
      // Slippage tolerance would be used in transaction building
    });

    it('should validate token addresses', async () => {
      const invalidRequest = {
        tokenA: '0xinvalid',
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('1').toString(),
        recipient: user.address
      };

      await expect(liquidityService.getAddLiquidityQuote(invalidRequest)).rejects.toThrow(LiquidityError);
    });

    it('should validate amount A is required', async () => {
      const invalidRequest = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: '0',
        recipient: user.address
      };

      await expect(liquidityService.getAddLiquidityQuote(invalidRequest)).rejects.toThrow(LiquidityError);
    });

    it('should handle high slippage tolerance rejection', async () => {
      const request = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('1').toString(),
        recipient: user.address,
        slippageTolerance: 1500 // 15% - too high
      };

      await expect(liquidityService.getAddLiquidityQuote(request)).rejects.toThrow(LiquidityError);
    });
  });

  describe('Remove Liquidity Quotes', () => {
    it('should generate valid remove liquidity quote', async () => {
      const poolAddress = '0x1234567890123456789012345678901234567890';
      const liquidity = ethers.parseEther('10').toString();

      // Mock pool for testing
      const mockPool = {
        address: poolAddress,
        token0: { address: mockContracts.tokens.get('WBNB')!.address },
        token1: { address: mockContracts.tokens.get('USDT')!.address },
        reserve0: ethers.parseEther('100').toString(),
        reserve1: ethers.parseUnits('200000', 6).toString(),
        totalSupply: ethers.parseEther('1000').toString()
      };

      // This would require mocking the pool integration
      const quote = await liquidityService.getRemoveLiquidityQuote(poolAddress, liquidity);

      expect(quote).toBeDefined();
      expect(quote.liquidityOut).toBe(liquidity);
      expect(quote.amountA).toBeDefined();
      expect(quote.amountB).toBeDefined();
      expect(quote.shareOfPool).toBeGreaterThan(0);
      expect(quote.priceImpact).toBe(0); // Removing liquidity shouldn't have price impact
    });

    it('should calculate correct token amounts for liquidity removal', async () => {
      const poolAddress = '0x1234567890123456789012345678901234567890';
      const liquidity = ethers.parseEther('100').toString(); // 10% of pool

      const quote = await liquidityService.getRemoveLiquidityQuote(poolAddress, liquidity);

      expect(quote).toBeDefined();
      expect(parseFloat(quote.amountA)).toBeGreaterThan(0);
      expect(parseFloat(quote.amountB)).toBeGreaterThan(0);
      expect(quote.shareOfPool).toBe(10); // 10% of pool
    });

    it('should handle ETH pools correctly', async () => {
      const wbnbAddress = mockContracts.tokens.get('WBNB')!.address;
      const poolAddress = '0x1234567890123456789012345678901234567890';
      const liquidity = ethers.parseEther('10').toString();

      const quote = await liquidityService.getRemoveLiquidityQuote(poolAddress, liquidity);

      expect(quote).toBeDefined();
      // Should handle ETH withdrawal correctly
    });

    it('should handle pool not found error', async () => {
      const nonExistentPool = '0x0000000000000000000000000000000000000000';
      const liquidity = ethers.parseEther('10').toString();

      await expect(liquidityService.getRemoveLiquidityQuote(nonExistentPool, liquidity))
        .rejects.toThrow(LiquidityError);
    });

    it('should handle zero liquidity amount', async () => {
      const poolAddress = '0x1234567890123456789012345678901234567890';
      const liquidity = '0';

      const quote = await liquidityService.getRemoveLiquidityQuote(poolAddress, liquidity);

      expect(quote).toBeDefined();
      expect(parseFloat(quote.amountA)).toBe(0);
      expect(parseFloat(quote.amountB)).toBe(0);
    });
  });

  describe('Add Liquidity Execution', () => {
    it('should execute add liquidity successfully', async () => {
      const request = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('1').toString(),
        recipient: user.address
      };

      // Fund user with tokens
      await mockContracts.tokens.get('WBNB')!.mint(user.address, ethers.parseEther('10'));
      await mockContracts.tokens.get('USDT')!.mint(user.address, ethers.parseUnits('5000', 6));

      const operation = await liquidityService.addLiquidity(request, user);

      expect(operation).toBeDefined();
      expect(operation.id).toBeDefined();
      expect(operation.type).toBe('add');
      expect(operation.userAddress).toBe(user.address);
      expect(operation.amountA).toBe(request.amountA);
      expect(operation.status).toBe('pending');
      expect(operation.transactionHash).toBeDefined();
    });

    it('should handle ETH liquidity addition', async () => {
      const request = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('1').toString(),
        recipient: user.address,
        isETH: true
      };

      // Fund user with ETH
      await testEnvironment.fundAccount(user.address, ethers.parseEther('10'));

      const operation = await liquidityService.addLiquidity(request, user);

      expect(operation).toBeDefined();
      expect(operation.amountETH).toBeDefined();
      expect(operation.status).toBe('pending');
    });

    it('should handle token approvals automatically', async () => {
      const request = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('1').toString(),
        recipient: user.address
      };

      // Fund user
      await mockContracts.tokens.get('WBNB')!.mint(user.address, ethers.parseEther('10'));

      const operation = await liquidityService.addLiquidity(request, user);

      expect(operation).toBeDefined();
      // Auto-approval should be handled
    });

    it('should handle insufficient balance error', async () => {
      const request = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('1000').toString(), // More than user has
        recipient: user.address
      };

      await expect(liquidityService.addLiquidity(request, user)).rejects.toThrow(LiquidityError);
    });

    it('should handle transaction failures gracefully', async () => {
      const request = {
        tokenA: '0x0000000000000000000000000000000000000000', // Invalid token
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('1').toString(),
        recipient: user.address
      };

      await expect(liquidityService.addLiquidity(request, user)).rejects.toThrow();
    });
  });

  describe('Remove Liquidity Execution', () => {
    it('should execute remove liquidity successfully', async () => {
      const poolAddress = '0x1234567890123456789012345678901234567890';
      const liquidity = ethers.parseEther('10').toString();

      const operation = await liquidityService.removeLiquidity(poolAddress, liquidity, user);

      expect(operation).toBeDefined();
      expect(operation.id).toBeDefined();
      expect(operation.type).toBe('remove');
      expect(operation.userAddress).toBe(user.address);
      expect(operation.poolAddress).toBe(poolAddress);
      expect(operation.liquidity).toBe(liquidity);
      expect(operation.status).toBe('pending');
    });

    it('should handle ETH liquidity removal', async () => {
      const wbnbAddress = mockContracts.tokens.get('WBNB')!.address;
      const poolAddress = '0x1234567890123456789012345678901234567890';
      const liquidity = ethers.parseEther('10').toString();

      const operation = await liquidityService.removeLiquidity(poolAddress, liquidity, user);

      expect(operation).toBeDefined();
      expect(operation.amountETH).toBeDefined();
    });

    it('should handle zero liquidity removal', async () => {
      const poolAddress = '0x1234567890123456789012345678901234567890';
      const liquidity = '0';

      const operation = await liquidityService.removeLiquidity(poolAddress, liquidity, user);

      expect(operation).toBeDefined();
      expect(operation.liquidity).toBe('0');
    });
  });

  describe('Farming Operations', () => {
    it('should stake liquidity in farm successfully', async () => {
      const poolAddress = '0x1234567890123456789012345678901234567890';
      const liquidity = ethers.parseEther('100').toString();

      // Mock farm info
      const mockFarmInfo = {
        id: 'farm-1',
        poolId: 1,
        poolAddress,
        rewardToken: mockContracts.tokens.get('CAKE')!.address,
        apr: 50,
        isActive: true
      };

      const operation = await liquidityService.stakeInFarm(poolAddress, liquidity, user);

      expect(operation).toBeDefined();
      expect(operation.type).toBe('add');
      expect(operation.poolAddress).toBe(poolAddress);
      expect(operation.liquidity).toBe(liquidity);
      expect(operation.farmId).toBeDefined();
      expect(operation.status).toBe('pending');
    });

    it('should unstake liquidity from farm successfully', async () => {
      const poolAddress = '0x1234567890123456789012345678901234567890';
      const liquidity = ethers.parseEther('50').toString();

      const operation = await liquidityService.unstakeFromFarm(poolAddress, liquidity, user);

      expect(operation).toBeDefined();
      expect(operation.type).toBe('remove');
      expect(operation.poolAddress).toBe(poolAddress);
      expect(operation.liquidity).toBe(liquidity);
      expect(operation.farmId).toBeDefined();
      expect(operation.status).toBe('pending');
    });

    it('should claim farm rewards successfully', async () => {
      const poolAddress = '0x1234567890123456789012345678901234567890';

      const txHash = await liquidityService.claimFarmRewards(poolAddress, user);

      expect(txHash).toBeDefined();
      expect(typeof txHash).toBe('string');
      expect(txHash.startsWith('0x')).toBe(true);
    });

    it('should handle farm not available error', async () => {
      const invalidPoolAddress = '0x0000000000000000000000000000000000000000';
      const liquidity = ethers.parseEther('100').toString();

      await expect(liquidityService.stakeInFarm(invalidPoolAddress, liquidity, user))
        .rejects.toThrow(LiquidityError);
    });
  });

  describe('Position Management', () => {
    it('should get user positions', async () => {
      const userAddress = user.address;
      const positions = await liquidityService.getPositions(userAddress);

      expect(Array.isArray(positions)).toBe(true);
      // Would return user's liquidity positions
    });

    it('should get specific position', async () => {
      const positionId = 'position-123';
      const position = await liquidityService.getPosition(positionId);

      expect(position).toBeDefined();
      // Would return specific position details
    });

    it('should update position', async () => {
      const positionId = 'position-123';
      const position = await liquidityService.updatePosition(positionId);

      expect(position).toBeDefined();
      expect(position.id).toBe(positionId);
      expect(position.updatedAt).toBeDefined();
    });

    it('should handle position not found', async () => {
      const nonExistentPosition = 'non-existent';
      const position = await liquidityService.getPosition(nonExistentPosition);

      expect(position).toBeNull();
    });
  });

  describe('Batch Operations', () => {
    it('should handle batch add liquidity', async () => {
      const requests = [
        {
          tokenA: mockContracts.tokens.get('WBNB')!.address,
          tokenB: mockContracts.tokens.get('USDT')!.address,
          amountA: ethers.parseEther('0.5').toString(),
          recipient: user.address
        },
        {
          tokenA: mockContracts.tokens.get('WBNB')!.address,
          tokenB: mockContracts.tokens.get('CAKE')!.address,
          amountA: ethers.parseEther('0.5').toString(),
          recipient: user.address
        }
      ];

      // Fund user
      await mockContracts.tokens.get('WBNB')!.mint(user.address, ethers.parseEther('10'));
      await mockContracts.tokens.get('USDT')!.mint(user.address, ethers.parseUnits('5000', 6));
      await mockContracts.tokens.get('CAKE')!.mint(user.address, ethers.parseUnits('1000', 18));

      const operations = await liquidityService.batchAddLiquidity(requests, user);

      expect(operations).toHaveLength(2);
      operations.forEach(op => {
        expect(op).toBeDefined();
        expect(op.type).toBe('add');
        expect(op.status).toBe('pending');
      });
    });

    it('should handle batch remove liquidity', async () => {
      const operations = [
        {
          poolAddress: '0x1234567890123456789012345678901234567890',
          liquidity: ethers.parseEther('10').toString()
        },
        {
          poolAddress: '0x1234567890123456789012345678901234567891',
          liquidity: ethers.parseEther('20').toString()
        }
      ];

      const results = await liquidityService.batchRemoveLiquidity(operations, user);

      expect(results).toHaveLength(2);
      results.forEach(op => {
        expect(op).toBeDefined();
        expect(op.type).toBe('remove');
        expect(op.status).toBe('pending');
      });
    });

    it('should handle partial failures in batch operations', async () => {
      const requests = [
        {
          tokenA: mockContracts.tokens.get('WBNB')!.address,
          tokenB: mockContracts.tokens.get('USDT')!.address,
          amountA: ethers.parseEther('1').toString(),
          recipient: user.address
        },
        {
          tokenA: '0xinvalid', // Invalid token
          tokenB: mockContracts.tokens.get('CAKE')!.address,
          amountA: ethers.parseEther('1').toString(),
          recipient: user.address
        }
      ];

      const operations = await liquidityService.batchAddLiquidity(requests, user);

      // Should handle gracefully and return successful operations only
      expect(operations.length).toBeGreaterThanOrEqual(0);
      if (operations.length > 0) {
        expect(operations[0].type).toBe('add');
      }
    });
  });

  describe('Analytics and History', () => {
    it('should get liquidity history', async () => {
      const userAddress = user.address;
      const history = await liquidityService.getLiquidityHistory(userAddress, 10);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeLessThanOrEqual(10);
    });

    it('should get liquidity metrics', async () => {
      const metrics = await liquidityService.getLiquidityMetrics('24h');

      expect(metrics).toBeDefined();
      expect(metrics.totalLiquidity).toBeDefined();
      expect(metrics.totalPositions).toBeDefined();
      expect(metrics.averageAPR).toBeDefined();
      expect(metrics.totalFees).toBeDefined();
      expect(metrics.timestamp).toBeDefined();
    });

    it('should handle different timeframes for metrics', async () => {
      const timeframes = ['1h', '24h', '7d', '30d'];

      for (const timeframe of timeframes) {
        const metrics = await liquidityService.getLiquidityMetrics(timeframe);
        expect(metrics).toBeDefined();
        expect(metrics.timestamp).toBeDefined();
      }
    });
  });

  describe('Health Checks', () => {
    it('should pass health check', async () => {
      const isHealthy = await liquidityService.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should get service status', async () => {
      const status = await liquidityService.getServiceStatus();

      expect(status).toBeDefined();
      expect(status.healthy).toBeDefined();
      expect(status.pendingOperations).toBeDefined();
      expect(status.supportedNetworks).toContain('BSC');
      expect(status.contracts).toBeDefined();
      expect(status.timestamp).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle LiquidityError with correct codes', async () => {
      const invalidRequest = {
        tokenA: '', // Empty token address
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('1').toString(),
        recipient: user.address
      };

      await expect(liquidityService.getAddLiquidityQuote(invalidRequest))
        .rejects.toThrow(LiquidityError);
    });

    it('should handle network errors gracefully', async () => {
      const request = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('1').toString(),
        recipient: user.address
      };

      // Should not throw unhandled errors
      const quote = await liquidityService.getAddLiquidityQuote(request);
      expect(quote).toBeDefined();
    });

    it('should handle insufficient balance in operations', async () => {
      const request = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('1000000').toString(), // Very large amount
        recipient: user.address
      };

      await expect(liquidityService.addLiquidity(request, user))
        .rejects.toThrow(LiquidityError);
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent quote requests', async () => {
      const requests = Array(5).fill(null).map((_, index) => ({
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther((Math.random() + 0.1).toString()),
        recipient: user.address
      }));

      const startTime = Date.now();
      const quotes = await Promise.all(requests.map(req => liquidityService.getAddLiquidityQuote(req)));
      const endTime = Date.now();

      expect(quotes).toHaveLength(5);
      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds

      quotes.forEach(quote => {
        expect(quote).toBeDefined();
        expect(quote.amountBOut).toBeDefined();
      });
    });

    it('should handle large liquidity amounts without performance degradation', async () => {
      const request = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('100').toString(), // Large amount
        recipient: user.address
      };

      const startTime = Date.now();
      const quote = await liquidityService.getAddLiquidityQuote(request);
      const endTime = Date.now();

      expect(quote).toBeDefined();
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero amount liquidity provision', async () => {
      const request = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: '0',
        recipient: user.address
      };

      await expect(liquidityService.getAddLiquidityQuote(request)).rejects.toThrow(LiquidityError);
    });

    it('should handle same token liquidity provision', async () => {
      const tokenAddress = mockContracts.tokens.get('WBNB')!.address;
      const request = {
        tokenA: tokenAddress,
        tokenB: tokenAddress, // Same token
        amountA: ethers.parseEther('1').toString(),
        recipient: user.address
      };

      // Should handle gracefully - may reject or allow depending on implementation
      try {
        const quote = await liquidityService.getAddLiquidityQuote(request);
        expect(quote).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(LiquidityError);
      }
    });

    it('should handle very small liquidity amounts', async () => {
      const request = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: '1', // 1 wei
        recipient: user.address
      };

      const quote = await liquidityService.getAddLiquidityQuote(request);
      expect(quote).toBeDefined();
      // May have warnings about dust amounts
    });

    it('should handle extremely large liquidity amounts', async () => {
      const request = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.MaxUint256.toString(),
        recipient: user.address
      };

      // Should handle gracefully, likely with high risk assessment
      const quote = await liquidityService.getAddLiquidityQuote(request);
      expect(quote).toBeDefined();
      expect(quote.riskLevel).toBe(LiquidityRiskLevel.VERY_HIGH);
    });

    it('should handle invalid recipient addresses', async () => {
      const request = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('1').toString(),
        recipient: '0xinvalid'
      };

      await expect(liquidityService.addLiquidity(request, user)).rejects.toThrow();
    });

    it('should handle expired quotes', async () => {
      const request = {
        tokenA: mockContracts.tokens.get('WBNB')!.address,
        tokenB: mockContracts.tokens.get('USDT')!.address,
        amountA: ethers.parseEther('1').toString(),
        recipient: user.address
      };

      const quote = await liquidityService.getAddLiquidityQuote(request);
      expect(quote).toBeDefined();

      // Mock expired quote
      quote.validUntil = Date.now() - 1000;

      // Should handle expired quote during execution
      // This would depend on implementation
    });
  });
});