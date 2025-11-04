import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { ethers } from 'ethers';
import { AMMIntegration } from '../../../src/bsc/services/trading/amm-integration';
import { PancakeRouterMock, PancakeFactoryMock, ERC20Mock } from '../../mocks/pancakeswap-contracts';
import { testEnvironment } from '../../setup/bsc-test-env';
import { testConfig } from '../../setup/test-config';

describe('AMM Integration Service', () => {
  let ammIntegration: AMMIntegration;
  let mockContracts: {
    router: PancakeRouterMock;
    factory: PancakeFactoryMock;
    tokens: Map<string, ERC20Mock>;
  };
  let deployer: ethers.Wallet;

  beforeAll(async () => {
    await testEnvironment.initialize();
    deployer = testEnvironment.getWallet('deployer');
  });

  beforeEach(async () => {
    // Initialize mocks
    mockContracts = {
      router: new PancakeRouterMock(
        new PancakeFactoryMock(deployer),
        new ERC20Mock('Wrapped BNB', 'WBNB', 18, '1000000', deployer),
        deployer
      ),
      factory: new PancakeFactoryMock(deployer),
      tokens: new Map([
        ['WBNB', new ERC20Mock('Wrapped BNB', 'WBNB', 18, '1000000', deployer)],
        ['USDT', new ERC20Mock('Tether USD', 'USDT', 6, '1000000000', deployer)],
        ['USDC', new ERC20Mock('USD Coin', 'USDC', 6, '1000000000', deployer)],
        ['CAKE', new ERC20Mock('PancakeSwap Token', 'CAKE', 18, '1000000000', deployer)]
      ])
    };

    // Create AMM integration with mock contracts
    ammIntegration = new AMMIntegration(
      testEnvironment.getProvider(),
      {
        routerAddress: mockContracts.router.address,
        factoryAddress: mockContracts.factory.address,
        wbnbAddress: mockContracts.tokens.get('WBNB')!.address
      },
      {
        rpc: mockContracts.router.contract,
        factory: mockContracts.factory.contract,
        router: mockContracts.router.contract,
        wbnb: mockContracts.tokens.get('WBNB')!.contract
      }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testEnvironment.cleanup();
  });

  describe('Constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(ammIntegration).toBeDefined();
    });

    it('should handle missing configuration gracefully', () => {
      expect(() => {
        new AMMIntegration(testEnvironment.getProvider(), {} as any, {} as any);
      }).not.toThrow();
    });
  });

  describe('getSwapQuote', () => {
    it('should return quote for valid token pair', async () => {
      const quote = await ammIntegration.getSwapQuote(
        mockContracts.tokens.get('WBNB')!.address,
        mockContracts.tokens.get('USDT')!.address,
        ethers.parseEther('1')
      );

      expect(quote).toBeDefined();
      expect(quote.amountIn).toBeGreaterThan(0);
      expect(quote.amountOut).toBeGreaterThan(0);
      expect(quote.path).toHaveLength(2);
      expect(quote.protocol).toBe('pancakeswap');
    });

    it('should handle WBNB wrapping/unwrapping', async () => {
      const quote = await ammIntegration.getSwapQuote(
        ethers.ZeroAddress, // ETH
        mockContracts.tokens.get('USDT')!.address,
        ethers.parseEther('1')
      );

      expect(quote.path[0]).toBe(mockContracts.tokens.get('WBNB')!.address);
      expect(quote.path[1]).toBe(mockContracts.tokens.get('USDT')!.address);
    });

    it('should throw error for invalid token address', async () => {
      await expect(
        ammIntegration.getSwapQuote(
          '0x0000000000000000000000000000000000000000000',
          mockContracts.tokens.get('USDT')!.address,
          ethers.parseEther('1')
        )
      ).rejects.toThrow('Invalid token address');
    });

    it('should handle zero amount', async () => {
      await expect(
        ammIntegration.getSwapQuote(
          mockContracts.tokens.get('WBNB')!.address,
          mockContracts.tokens.get('USDT')!.address,
          BigInt(0)
        )
      ).rejects.toThrow('Amount must be greater than zero');
    });

    it('should handle insufficient liquidity', async () => {
      const largeAmount = ethers.parseEther('1000000'); // More than mock liquidity

      await expect(
        ammIntegration.getSwapQuote(
          mockContracts.tokens.get('WBNB')!.address,
          mockContracts.tokens.get('USDT')!.address,
          largeAmount
        )
      ).rejects.toThrow('Insufficient liquidity');
    });
  });

  describe('executeSwap', () => {
    it('should execute swap successfully', async () => {
      const swapParams = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        amountOutMin: ethers.parseUnits('2000', 6), // 2000 USDT minimum
        recipient: testEnvironment.getWallet('user1').address,
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        slippageProtection: {
          enabled: true,
          slippageTolerance: 0.005
        }
      };

      const result = await ammIntegration.executeSwap(swapParams, deployer);

      expect(result).toBeDefined();
      expect(result.transactionHash).toBeDefined();
      expect(result.amountIn).toBeGreaterThan(0);
      expect(result.amountOut).toBeGreaterThan(0);
      expect(result.status).toBe('success');
    });

    it('should handle slippage protection', async () => {
      const swapParams = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        amountOutMin: ethers.parseUnits('1900', 6), // Lower than expected
        recipient: testEnvironment.getWallet('user1').address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        slippageProtection: {
          enabled: true,
          slippageTolerance: 0.005
        }
      };

      const result = await ammIntegration.executeSwap(swapParams, deployer);

      expect(result.status).toBe('success');
      // Should be less than original quote due to slippage protection
    });

    it('should handle expired deadline', async () => {
      const swapParams = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        amountOutMin: ethers.parseUnits('2000', 6),
        recipient: testEnvironment.getWallet('user1').address,
        deadline: Math.floor(Date.now() / 1000) - 1, // Expired
        slippageProtection: {
          enabled: false
        }
      };

      await expect(
        ammIntegration.executeSwap(swapParams, deployer)
      ).rejects.toThrow('Transaction deadline passed');
    });

    it('should handle insufficient balance', async () => {
      const swapParams = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1000000'), // More than available
        amountOutMin: ethers.parseUnits('2000', 6),
        recipient: testEnvironment.getWallet('user1').address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        slippageProtection: {
          enabled: false
        }
      };

      await expect(
        ammIntegration.executeSwap(swapParams, deployer)
      ).rejects.toThrow();
    });
  });

  describe('getPoolAddress', () => {
    it('should return correct pool address for token pair', async () => {
      const poolAddress = await ammIntegration.getPoolAddress(
        mockContracts.tokens.get('WBNB')!.address,
        mockContracts.tokens.get('USDT')!.address,
        3000 // 0.3%
      );

      expect(poolAddress).toBeDefined();
      expect(poolAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should handle reversed token order', async () => {
      const poolAddress1 = await ammIntegration.getPoolAddress(
        mockContracts.tokens.get('WBNB')!.address,
        mockContracts.tokens.get('USDT')!.address,
        3000
      );

      const poolAddress2 = await ammPoolAddress(
        mockContracts.tokens.get('USDT')!.address,
        mockContracts.tokens.get('WBNB')!.address,
        3000
      );

      expect(poolAddress1).toBe(poolAddress2);
    });

    it('should return null for non-existent pool', async () => {
      const poolAddress = await ammIntegration.getPoolAddress(
        mockContracts.tokens.get('CAKE')!.address,
        mockContracts.tokens.get('BUSD')!.address,
        2500 // 0.25%
      );

      expect(poolAddress).toBeNull();
    });
  });

  describe('calculateOptimalRoute', () => {
    it('should return single hop for direct pair', async () => {
      const route = await ammIntegration.calculateOptimalRoute(
        mockContracts.tokens.get('WBNB')!.address,
        mockContracts.tokens.get('USDT')!.address,
        ethers.parseEther('1')
      );

      expect(route).toBeDefined();
      expect(route.length).toBe(1);
      expect(route[0].tokenIn).toBe(mockContracts.tokens.get('WBNB')!.address);
      expect(route[0].tokenOut).toBe(mockContracts.tokens.get('USDT')!.address);
      expect(route[0].protocol).toBe('pancakeswap');
      expect(route[0].poolAddress).toBeDefined();
    });

    it('should calculate multi-hop route for complex swaps', async () => {
      // Create intermediate token
      const intermediateToken = new ERC20Mock('Intermediate Token', 'INT', 18, '1000000', deployer);

      const route = await ammIntegration.calculateOptimalRoute(
        mockContracts.tokens.get('WBNB')!.address,
        intermediateToken.address,
        ethers.parseEther('1')
      );

      expect(route).toBeDefined();
      expect(route.length).toBeGreaterThan(0);
      expect(route[0].tokenIn).toBe(mockContracts.tokens.get('WBNB')!.address);
    });

    it('should find best route among multiple options', async () => {
      const route = await ammIntegration.calculateOptimalRoute(
        mockContracts.tokens.get('WBNB')!.address,
        mockContracts.tokens.get('USDT')!.address,
        ethers.parseEther('1')
      );

      expect(route).toBeDefined();
      expect(route.length).toBeGreaterThan(0);
    });
  });

  describe('estimateGas', () => {
    it('should estimate gas for swap transaction', async () => {
      const swapParams = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        amountOutMin: ethers.parseUnits('2000', 6),
        recipient: testEnvironment.getWallet('user1').address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        slippageProtection: {
          enabled: true,
          slippageTolerance: 0.005
        }
      };

      const gasEstimate = await ammIntegration.estimateGas(swapParams);

      expect(gasEstimate).toBeGreaterThan(0);
      expect(gasEstimate).toBeLessThan(500000); // Should be reasonable
    });

    it('should handle different swap types', async () => {
      // ETH to token
      const ethToTokenGas = await ammIntegration.estimateGas({
        tokenIn: ethers.ZeroAddress,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        amountOutMin: ethers.parseUnits('2000', 6),
        recipient: testEnvironment.getWallet('user1').address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        slippageProtection: { enabled: false }
      });

      expect(ethToTokenGas).toBeGreaterThan(0);

      // Token to ETH
      const tokenToEthGas = await ammIntegration.estimateGas({
        tokenIn: mockContracts.tokens.get('USDT')!.address,
        tokenOut: ethers.ZeroAddress,
        amountIn: ethers.parseUnits('2000', 6),
        amountOutMin: ethers.parseEther('0.9'),
        recipient: testEnvironment.getWallet('user1').address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        slippageProtection: { enabled: false }
      });

      expect(tokenToEthGas).toBeGreaterThan(0);
    });
  });

  describe('validateSwapParams', () => {
    it('should validate correct swap parameters', () => {
      const validParams = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        amountOutMin: ethers.parseUnits('2000', 6),
        recipient: testEnvironment.getWallet('user1').address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        slippageProtection: {
          enabled: true,
          slippageTolerance: 0.005
        }
      };

      expect(() => {
        ammIntegration.validateSwapParams(validParams);
      }).not.toThrow();
    });

    it('should throw error for invalid parameters', () => {
      const invalidParams = {
        tokenIn: ethers.ZeroAddress,
        tokenOut: ethers.ZeroAddress,
        amountIn: BigInt(0),
        amountOutMin: BigInt(0),
        recipient: ethers.ZeroAddress,
        deadline: BigInt(0),
        slippageProtection: {
          enabled: true,
          slippageTolerance: 0.005
        }
      };

      expect(() => {
        ammIntegration.validateSwapParams(invalidParams);
      }).toThrow();
    });

    it('should detect invalid token addresses', () => {
      const invalidParams = {
        tokenIn: '0xinvalid',
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        amountOutMin: ethers.parseUnits('2000', 6),
        recipient: testEnvironment.getWallet('user1').address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        slippageProtection: {
          enabled: true,
          slippageTolerance: 0.005
        }
      };

      expect(() => {
        ammIntegration.validateSwapParams(invalidParams);
      }).toThrow('Invalid token address');
    });

    it('should detect expired deadline', () => {
      const invalidParams = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        amountOutMin: ethers.parseUnits('2000', 6),
        recipient: testEnvironment.getWallet('user1').address,
        deadline: Math.floor(Date.now() / 1000) - 1, // Expired
        slippageProtection: {
          enabled: true,
          slippageTolerance: 0.005
        }
      };

      expect(() => {
        ammIntegration.validateSwapParams(invalidParams);
      }).toThrow('Transaction deadline passed');
    });

    it('should detect zero amounts', () => {
      const invalidParams = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: BigInt(0),
        amountOutMin: ethers.parseUnits('2000', 6),
        recipient: testEnvironment.getWallet('user1').address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        slippageProtection: {
          enabled: true,
          slippageTolerance: 0.005
        }
      };

      expect(() => {
        ammIntegration.validateSwapParams(invalidParams);
      }).toThrow('Amount must be greater than zero');
    });
  });

  describe('calculatePriceImpact', () => {
    it('should calculate price impact for swap', async () => {
      const swapParams = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('10'), // Large amount
        amountOutMin: ethers.parseUnits('2000', 6),
        recipient: testEnvironment.getWallet('user1').address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        slippageProtection: {
          enabled: false
        }
      };

      const priceImpact = await ammIntegration.calculatePriceImpact(swapParams);

      expect(priceImpact).toBeDefined();
      expect(priceImpact.priceImpactPercentage).toBeGreaterThan(0);
      expect(priceImpact.priceImpactPercentage).toBeLessThan(0.1); // Should be reasonable
    });

    it('should return zero impact for small swaps', async () => {
      const swapParams = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('0.001'), // Small amount
        amountOutMin: ethers.parseUnits('1', 6),
        recipient: testEnvironment.getWallet('user1').address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        slippageProtection: {
          enabled: false
        }
      };

      const priceImpact = await ammIntegration.calculatePriceImpact(swapParams);

      expect(priceImpact.priceImpactPercentage).toBeCloseTo(0, 5);
    });
  });

  describe('getSupportedProtocols', () => {
    it('should return supported protocols list', () => {
      const protocols = ammIntegration.getSupportedProtocols();

      expect(protocols).toContain('pancakeswap');
      expect(protocols).toContain('uniswapv2');
      expect(protocols).toContain('sushiswap');
    });

    it('should include protocol metadata', () => {
      const protocols = ammIntegration.getSupportedProtocols();

      protocols.forEach(protocol => {
        expect(protocol.name).toBeDefined();
        expect(protocol.routerAddress).toBeDefined();
        expect(protocol.factoryAddress).toBeDefined();
        expect(protocol.feeTiers).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network error
      const originalCall = ammIntegration['contracts']['router']['callStatic'];
      ammIntegration['contracts']['router']['callStatic'] = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        ammIntegration.getSwapQuote(
          mockContracts.tokens.get('WBNB')!.address,
          mockContracts.tokens.get('USDT')!.address,
          ethers.parseEther('1')
        )
      ).rejects.toThrow('Network error');

      // Restore original function
      ammIntegration['contracts']['router']['callStatic'] = originalCall;
    });

    it('should handle transaction failures', async () => {
      const swapParams = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        amountOutMin: ethers.parseUnits('2000', 6),
        recipient: testEnvironment.getWallet('user1').address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        slippageProtection: {
          enabled: true,
          slippageTolerance: 0.005
        }
      };

      // Mock transaction failure
      const originalSend = ammIntegration['contracts']['router']['send'];
      ammIntegration['contracts']['router']['send'] = jest.fn().mockRejectedValue(new Error('Transaction failed'));

      await expect(
        ammIntegration.executeSwap(swapParams, deployer)
      ).rejects.toThrow('Transaction failed');

      // Restore original function
      ammIntegration['contracts']['router']['send'] = originalSend;
    });

    it('should handle timeout errors', async () => {
      const swapParams = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        amountOutMin: ethers.parseUnits('2000', 6),
        recipient: testEnvironment.getWallet('user1').address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        slippageProtection: {
          enabled: true,
          slippageTolerance: 0.005
        }
      };

      // Mock timeout
      const originalSend = ammIntegration['contracts']['router']['send'];
      ammIntegration['contracts']['router']['send'] = jest.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Transaction timeout')), 1000);
        });
      });

      await expect(
        ammIntegration.executeSwap(swapParams, deployer)
      ).rejects.toThrow('Transaction timeout');

      // Restore original function
      ammIntegration['contracts']['router']['send'] = originalSend;
    });
  });

  describe('Performance', () => {
    it('should handle concurrent swap requests', async () => {
      const swapPromises = [];
      const numRequests = 10;

      for (let i = 0; i < numRequests; i++) {
        const swapParams = {
          tokenIn: mockContracts.tokens.get('WBNB')!.address,
          tokenOut: mockContracts.tokens.get('USDT')!.address,
          amountIn: ethers.parseEther('0.1'),
          amountOutMin: ethers.parseUnits('200', 6),
          recipient: testEnvironment.getWallet('user1').address,
          deadline: Math.floor(Date.now() / 1000) + 3600,
          slippageProtection: {
            enabled: true,
            slippageTolerance: 0.005
          }
        };

        swapPromises.push(ammIntegration.getSwapQuote(
          swapParams.tokenIn,
          swapParams.tokenOut,
          swapParams.amountIn
        ));
      }

      const results = await Promise.all(swapPromises);

      expect(results).toHaveLength(numRequests);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    it('should maintain performance with large amounts', async () => {
      const startTime = Date.now();

      const quote = await ammIntegration.getSwapQuote(
        mockContracts.tokens.get('WBNB')!.address,
        mockContracts.tokens.get('USDT')!.address,
        ethers.parseEther('100')
      );

      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete in < 100ms
      expect(quote).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle token address case sensitivity', async () => {
      const address1 = mockContracts.tokens.get('WBNB')!.address;
      const address2 = address1.toLowerCase();

      expect(address1).not.toBe(address2);

      const quote1 = await ammIntegration.getSwapQuote(address1, mockContracts.tokens.get('USDT')!.address, ethers.parseEther('1'));
      const quote2 = await ammIntegration.getSwapQuote(address2, mockContracts.tokens.get('USDT')!.address, ethers.parseEther('1'));

      expect(quote1.amountOut.toString()).toBe(quote2.amountOut.toString());
    });

    it('should handle maximum amount calculations', async () => {
      const maxAmount = ethers.MaxUint256;

      await expect(
        ammIntegration.getSwapQuote(
          mockContracts.tokens.get('WBNB')!.address,
          mockContracts.tokens.get('USDT')!.address,
          maxAmount
        )
      ).resolves.not.toThrow();
    });

    it('should handle minimum output constraints', async () => {
      const swapParams = {
        tokenIn: mockContracts.tokens.get('WBNB')!.address,
        tokenOut: mockContracts.tokens.get('USDT')!.address,
        amountIn: ethers.parseEther('1'),
        amountOutMin: ethers.parseUnits('5000', 6), // Higher than expected
        recipient: testEnvironment.getWallet('user1').address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        slippageProtection: {
          enabled: true,
          slippageTolerance: 0.005
        }
      };

      await expect(
        ammIntegration.executeSwap(swapParams, deployer)
      ).rejects.toThrow();
    });
  });
});