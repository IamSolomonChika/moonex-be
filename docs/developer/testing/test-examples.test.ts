/**
 * 🧪 Comprehensive Test Examples for Viem Integration
 *
 * This file contains practical testing examples for Viem 2.38.5 operations,
 * including unit tests, integration tests, and mocking strategies.
 */

import { describe, it, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals';
import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  parseUnits,
  isAddress,
  getAddress,
  BaseError,
  ContractFunctionExecutionError,
  type PublicClient,
  type WalletClient,
  type Address
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Test utilities
import { TokenService } from '../../../src/services/token.service';
import { SwapService } from '../../../src/services/swap.service';
import { viemClientFactory } from '../../../src/config/viem';

// Mock data
const MOCK_WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address;
const MOCK_BUSD_ADDRESS = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address;
const MOCK_USER_ADDRESS = '0x742d35Cc6634C0532925a3b8D4E7E0E0e9e0dF3b' as Address;

// Mock ERC-20 ABI
const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

describe('TokenService - Unit Tests', () => {
  let tokenService: TokenService;
  let mockPublicClient: jest.Mocked<PublicClient>;
  let mockCache: jest.Mocked<any>;

  beforeEach(() => {
    // Create mock client
    mockPublicClient = {
      readContract: jest.fn(),
      multicall: jest.fn(),
      getBalance: jest.fn()
    } as any;

    // Mock cache
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };

    tokenService = new TokenService(mockPublicClient, mockCache);
  });

  describe('getTokenInfo', () => {
    it('should return cached token info when available', async () => {
      // Arrange
      const cachedInfo = {
        address: MOCK_WBNB_ADDRESS,
        name: 'Wrapped BNB',
        symbol: 'WBNB',
        decimals: 18,
        totalSupply: 1000000n
      };

      mockCache.get.mockResolvedValue(cachedInfo);

      // Act
      const result = await tokenService.getTokenInfo(MOCK_WBNB_ADDRESS);

      // Assert
      expect(result).toEqual(cachedInfo);
      expect(mockCache.get).toHaveBeenCalledWith(`token:${MOCK_WBNB_ADDRESS}`);
      expect(mockPublicClient.multicall).not.toHaveBeenCalled();
    });

    it('should fetch token info from blockchain when not cached', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockPublicClient.multicall.mockResolvedValue([
        { result: 'Wrapped BNB' },
        { result: 'WBNB' },
        { result: 18 },
        { result: 1000000n }
      ]);

      const expectedInfo = {
        address: MOCK_WBNB_ADDRESS,
        name: 'Wrapped BNB',
        symbol: 'WBNB',
        decimals: 18,
        totalSupply: 1000000n
      };

      // Act
      const result = await tokenService.getTokenInfo(MOCK_WBNB_ADDRESS);

      // Assert
      expect(result).toEqual(expectedInfo);
      expect(mockPublicClient.multicall).toHaveBeenCalledWith({
        contracts: [
          {
            address: MOCK_WBNB_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'name'
          },
          {
            address: MOCK_WBNB_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'symbol'
          },
          {
            address: MOCK_WBNB_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'decimals'
          },
          {
            address: MOCK_WBNB_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'totalSupply'
          }
        ]
      });
      expect(mockCache.set).toHaveBeenCalledWith(
        `token:${MOCK_WBNB_ADDRESS}`,
        expectedInfo,
        300
      );
    });

    it('should throw ValidationError for invalid address', async () => {
      // Arrange
      const invalidAddress = 'invalid-address';

      // Act & Assert
      await expect(tokenService.getTokenInfo(invalidAddress))
        .rejects.toThrow('Invalid address: invalid-address');
    });

    it('should handle contract read errors gracefully', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockPublicClient.multicall.mockRejectedValue(
        new ContractFunctionExecutionError('Contract call failed', 'CALL_EXCEPTION')
      );

      // Act & Assert
      await expect(tokenService.getTokenInfo(MOCK_WBNB_ADDRESS))
        .rejects.toThrow('Failed to fetch token information');
    });

    it('should handle partial multicall results', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockPublicClient.multicall.mockResolvedValue([
        { result: 'Wrapped BNB' },
        { result: null }, // Failed call
        { result: 18 },
        { result: 1000000n }
      ]);

      const expectedInfo = {
        address: MOCK_WBNB_ADDRESS,
        name: 'Wrapped BNB',
        symbol: 'UNKNOWN',
        decimals: 18,
        totalSupply: 1000000n
      };

      // Act
      const result = await tokenService.getTokenInfo(MOCK_WBNB_ADDRESS);

      // Assert
      expect(result).toEqual(expectedInfo);
    });
  });

  describe('getTokenBalance', () => {
    it('should return token balance for valid address', async () => {
      // Arrange
      const balance = parseUnits('100.5', 18);
      mockPublicClient.readContract.mockResolvedValue(balance);

      // Act
      const result = await tokenService.getTokenBalance(MOCK_WBNB_ADDRESS, MOCK_USER_ADDRESS);

      // Assert
      expect(result).toBe(balance);
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: MOCK_WBNB_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [MOCK_USER_ADDRESS]
      });
    });

    it('should return 0 for zero balance', async () => {
      // Arrange
      mockPublicClient.readContract.mockResolvedValue(0n);

      // Act
      const result = await tokenService.getTokenBalance(MOCK_WBNB_ADDRESS, MOCK_USER_ADDRESS);

      // Assert
      expect(result).toBe(0n);
    });

    it('should validate both token and user addresses', async () => {
      // Act & Assert
      await expect(tokenService.getTokenBalance('invalid-token', MOCK_USER_ADDRESS))
        .rejects.toThrow('Invalid token address: invalid-token');

      await expect(tokenService.getTokenBalance(MOCK_WBNB_ADDRESS, 'invalid-user'))
        .rejects.toThrow('Invalid user address: invalid-user');
    });
  });
});

describe('SwapService - Unit Tests', () => {
  let swapService: SwapService;
  let mockPublicClient: jest.Mocked<PublicClient>;
  let mockWalletClient: jest.Mocked<WalletClient>;

  beforeEach(() => {
    mockPublicClient = {
      readContract: jest.fn(),
      multicall: jest.fn(),
      simulateContract: jest.fn(),
      waitForTransactionReceipt: jest.fn()
    } as any;

    mockWalletClient = {
      account: { address: MOCK_USER_ADDRESS },
      writeContract: jest.fn(),
      writeTransaction: jest.fn()
    } as any;

    swapService = new SwapService(mockPublicClient, mockWalletClient);
  });

  describe('getSwapQuote', () => {
    it('should return swap quote for valid tokens', async () => {
      // Arrange
      const amountIn = parseUnits('1', 18);
      const amountOut = parseUnits('300', 18); // 1 WBNB = 300 BUSD

      mockPublicClient.readContract.mockResolvedValue([amountIn, amountOut]);

      // Act
      const result = await swapService.getSwapQuote(
        MOCK_WBNB_ADDRESS,
        MOCK_BUSD_ADDRESS,
        '1',
        0.5
      );

      // Assert
      expect(result).toMatchObject({
        tokenIn: MOCK_WBNB_ADDRESS,
        tokenOut: MOCK_BUSD_ADDRESS,
        amountIn,
        amountOut,
        slippageTolerancePercent: 0.5
      });
      expect(result.minimumAmountOut).toBeLessThan(amountOut);
    });

    it('should calculate minimum amount with slippage tolerance', async () => {
      // Arrange
      const amountIn = parseUnits('1', 18);
      const amountOut = parseUnits('300', 18);
      const slippageTolerance = 1.0; // 1%

      const expectedMinimum = amountOut - (amountOut * BigInt(100)) / BigInt(10000);

      mockPublicClient.readContract.mockResolvedValue([amountIn, amountOut]);

      // Act
      const result = await swapService.getSwapQuote(
        MOCK_WBNB_ADDRESS,
        MOCK_BUSD_ADDRESS,
        '1',
        slippageTolerance
      );

      // Assert
      expect(result.minimumAmountOut).toBe(expectedMinimum);
    });

    it('should handle insufficient liquidity', async () => {
      // Arrange
      mockPublicClient.readContract.mockRejectedValue(
        new Error('Insufficient liquidity')
      );

      // Act & Assert
      await expect(swapService.getSwapQuote(MOCK_WBNB_ADDRESS, MOCK_BUSD_ADDRESS, '1000'))
        .rejects.toThrow('Failed to get swap quote');
    });
  });

  describe('executeSwap', () => {
    it('should execute swap successfully', async () => {
      // Arrange
      const amountIn = parseUnits('1', 18);
      const amountOut = parseUnits('300', 18);
      const txHash = '0x1234567890abcdef' as Address;

      // Mock quote
      jest.spyOn(swapService, 'getSwapQuote').mockResolvedValue({
        tokenIn: MOCK_WBNB_ADDRESS,
        tokenOut: MOCK_BUSD_ADDRESS,
        amountIn,
        amountOut,
        minimumAmountOut: amountOut - (amountOut * BigInt(50)) / BigInt(10000),
        slippageTolerancePercent: 0.5,
        priceImpact: 0.01,
        path: [MOCK_WBNB_ADDRESS, MOCK_BUSD_ADDRESS]
      });

      // Mock contract simulation
      mockPublicClient.simulateContract.mockResolvedValue({
        request: {
          to: MOCK_WBNB_ADDRESS,
          data: '0xabcdef',
          value: amountIn
        }
      });

      // Mock transaction execution
      mockWalletClient.writeContract.mockResolvedValue(txHash);

      // Mock transaction receipt
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        transactionHash: txHash,
        blockNumber: BigInt(12345),
        status: 'success'
      } as any);

      // Act
      const result = await swapService.executeSwap(
        MOCK_WBNB_ADDRESS,
        MOCK_BUSD_ADDRESS,
        '1',
        0.5
      );

      // Assert
      expect(result.hash).toBe(txHash);
      expect(mockWalletClient.writeContract).toHaveBeenCalled();
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
        hash: txHash,
        confirmations: 2
      });
    });

    it('should handle transaction failure', async () => {
      // Arrange
      mockPublicClient.simulateContract.mockRejectedValue(
        new Error('Insufficient balance')
      );

      // Act & Assert
      await expect(swapService.executeSwap(MOCK_WBNB_ADDRESS, MOCK_BUSD_ADDRESS, '1000'))
        .rejects.toThrow('Swap execution failed');
    });
  });
});

describe('Integration Tests', () => {
  let publicClient: PublicClient;

  beforeAll(() => {
    // Use testnet for integration tests
    publicClient = createPublicClient({
      chain: bscTestnet,
      transport: http('https://data-seed-prebsc-1-s1.binance.org:8545')
    });
  });

  describe('Real Blockchain Interactions', () => {
    it('should fetch real WBNB token information', async () => {
      // Act
      const [name, symbol, decimals] = await publicClient.multicall({
        contracts: [
          {
            address: MOCK_WBNB_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'name'
          },
          {
            address: MOCK_WBNB_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'symbol'
          },
          {
            address: MOCK_WBNB_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'decimals'
          }
        ]
      });

      // Assert
      expect(name.result).toBe('Wrapped BNB');
      expect(symbol.result).toBe('WBNB');
      expect(decimals.result).toBe(18);
    }, 30000); // 30 second timeout

    it('should get real BNB balance for an address', async () => {
      // Use a known address with BNB balance
      const testAddress = '0x8894E0a0c962CB723c1976a4421c7A739705a4E6' as Address;

      // Act
      const balance = await publicClient.getBalance({ address: testAddress });

      // Assert
      expect(balance).toBeGreaterThan(0n);
      console.log(`Balance: ${formatUnits(balance, 18)} BNB`);
    }, 30000);

    it('should fetch real BUSD token information', async () => {
      // Act
      const [name, symbol, decimals, totalSupply] = await publicClient.multicall({
        contracts: [
          {
            address: MOCK_BUSD_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'name'
          },
          {
            address: MOCK_BUSD_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'symbol'
          },
          {
            address: MOCK_BUSD_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'decimals'
          },
          {
            address: MOCK_BUSD_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'totalSupply'
          }
        ]
      });

      // Assert
      expect(name.result).toBe('BUSD Token');
      expect(symbol.result).toBe('BUSD');
      expect(decimals.result).toBe(18);
      expect(totalSupply.result).toBeGreaterThan(0n);
    }, 30000);
  });
});

describe('Performance Tests', () => {
  let mockPublicClient: jest.Mocked<PublicClient>;
  let tokenService: TokenService;

  beforeEach(() => {
    mockPublicClient = {
      readContract: jest.fn(),
      multicall: jest.fn(),
      getBalance: jest.fn()
    } as any;

    const mockCache = {
      get: jest.fn(),
      set: jest.fn()
    };

    tokenService = new TokenService(mockPublicClient, mockCache);
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent token info requests', async () => {
      // Arrange
      const tokens = [
        MOCK_WBNB_ADDRESS,
        MOCK_BUSD_ADDRESS,
        '0x2170Ed0880ac9A755fd29B2688956BD959F933F8' as Address, // ETH
        '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' as Address  // CAKE
      ];

      mockPublicClient.multicall.mockImplementation(async ({ contracts }) => {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 100));
        return contracts.map(() => ({ result: 'Mock Result' }));
      });

      // Act
      const startTime = Date.now();
      const promises = tokens.map(token => tokenService.getTokenInfo(token));
      const results = await Promise.all(promises);
      const endTime = Date.now();

      // Assert
      expect(results).toHaveLength(4);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should batch operations efficiently', async () => {
      // Arrange
      const addresses = Array.from({ length: 100 }, (_, i) =>
        `0x${i.toString(16).padStart(40, '0')}` as Address
      );

      mockPublicClient.getBalance.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 1000000n;
      });

      // Act
      const startTime = Date.now();
      const promises = addresses.map(address =>
        tokenService.getTokenBalance(MOCK_WBNB_ADDRESS, address)
      );
      await Promise.all(promises);
      const endTime = Date.now();

      // Assert
      console.log(`Processed ${addresses.length} balance requests in ${endTime - startTime}ms`);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });
});

describe('Error Handling Tests', () => {
  let mockPublicClient: jest.Mocked<PublicClient>;
  let tokenService: TokenService;

  beforeEach(() => {
    mockPublicClient = {
      readContract: jest.fn(),
      multicall: jest.fn()
    } as any;

    const mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn()
    };

    tokenService = new TokenService(mockPublicClient, mockCache);
  });

  describe('Network Errors', () => {
    it('should handle network timeouts', async () => {
      // Arrange
      mockPublicClient.multicall.mockRejectedValue(new Error('Network timeout'));

      // Act & Assert
      await expect(tokenService.getTokenInfo(MOCK_WBNB_ADDRESS))
        .rejects.toThrow('Failed to fetch token information');
    });

    it('should handle rate limiting', async () => {
      // Arrange
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = 'RateLimitError';
      mockPublicClient.multicall.mockRejectedValue(rateLimitError);

      // Act & Assert
      await expect(tokenService.getTokenInfo(MOCK_WBNB_ADDRESS))
        .rejects.toThrow('Failed to fetch token information');
    });

    it('should handle invalid contract addresses', async () => {
      // Arrange
      mockPublicClient.multicall.mockRejectedValue(
        new ContractFunctionExecutionError('Contract not found', 'CALL_EXCEPTION')
      );

      // Act & Assert
      await expect(tokenService.getTokenInfo('0x0000000000000000000000000000000000000000' as Address))
        .rejects.toThrow('Failed to fetch token information');
    });
  });

  describe('Data Validation', () => {
    it('should handle malformed contract responses', async () => {
      // Arrange
      mockPublicClient.multicall.mockResolvedValue([
        { result: null },
        { result: undefined },
        { result: 'invalid' },
        { result: 123n }
      ]);

      // Act
      const result = await tokenService.getTokenInfo(MOCK_WBNB_ADDRESS);

      // Assert
      expect(result.name).toBe('Unknown Token');
      expect(result.symbol).toBe('UNKNOWN');
      expect(result.decimals).toBe(18);
      expect(result.totalSupply).toBe(123n);
    });

    it('should handle BigInt serialization issues', async () => {
      // Arrange
      const hugeNumber = 2n ** 256n - 1n; // Maximum uint256
      mockPublicClient.multicall.mockResolvedValue([
        { result: 'Test Token' },
        { result: 'TEST' },
        { result: 18 },
        { result: hugeNumber }
      ]);

      // Act
      const result = await tokenService.getTokenInfo(MOCK_WBNB_ADDRESS);

      // Assert
      expect(result.totalSupply).toBe(hugeNumber);
      expect(typeof result.totalSupply).toBe('bigint');
    });
  });
});

describe('Mock Utilities', () => {
  describe('Viem Client Mocking', () => {
    it('should create mock public client', () => {
      const mockClient = createMockPublicClient();

      expect(mockClient.readContract).toBeDefined();
      expect(mockClient.multicall).toBeDefined();
      expect(mockClient.getBalance).toBeDefined();

      // Test mock behavior
      mockClient.readContract.mockResolvedValue(1000n);
      expect(mockClient.readContract({} as any)).resolves.toBe(1000n);
    });

    it('should create mock wallet client', () => {
      const mockClient = createMockWalletClient();

      expect(mockClient.writeContract).toBeDefined();
      expect(mockClient.writeTransaction).toBeDefined();
      expect(mockClient.account).toBeDefined();

      // Test mock behavior
      mockClient.writeContract.mockResolvedValue('0x123' as Address);
      expect(mockClient.writeContract({} as any)).resolves.toBe('0x123');
    });
  });
});

// Utility functions for testing
function createMockPublicClient(): jest.Mocked<PublicClient> {
  return {
    readContract: jest.fn(),
    multicall: jest.fn(),
    getBalance: jest.fn(),
    getTransaction: jest.fn(),
    getTransactionReceipt: jest.fn(),
    waitForTransactionReceipt: jest.fn(),
    simulateContract: jest.fn(),
    call: jest.fn(),
    estimateGas: jest.fn(),
    getGasPrice: jest.fn(),
    getFeeData: jest.fn(),
    getBlock: jest.fn(),
    getBlockNumber: jest.fn(),
    getChainId: jest.fn(),
    getTransactionCount: jest.fn(),
    getLogs: jest.fn(),
    readContractParameters: jest.fn(),
    getStorageAt: jest.fn(),
    getCode: jest.fn(),
    sendTransaction: jest.fn(),
    sendRawTransaction: jest.fn(),
    sendUnsignedTransaction: jest.fn(),
    watchBlockNumber: jest.fn(),
    watchEvent: jest.fn(),
    watchPendingTransactions: jest.fn(),
    getFilterChanges: jest.fn(),
    getFilterLogs: jest.fn(),
    createContractEventFilter: jest.fn(),
    createEventFilter: jest.fn(),
    getBlockTransactionCount: jest.fn(),
    uncle: jest.fn(),
    getProof: jest.fn(),
    createPendingTransactionFilter: jest.fn(),
    getTransactionReceipts: jest.fn(),
    request: jest.fn(),
    clearWatch: jest.fn(),
    getEnsAddress: jest.fn(),
    getEnsName: jest.fn(),
    getEnsResolver: jest.fn(),
    getEnsText: jest.fn(),
    batch: jest.fn(),
    extend: jest.fn()
  } as any;
}

function createMockWalletClient(): jest.Mocked<WalletClient> {
  return {
    account: { address: MOCK_USER_ADDRESS, type: 'json-rpc' },
    writeContract: jest.fn(),
    writeTransaction: jest.fn(),
    sendTransaction: jest.fn(),
    signMessage: jest.fn(),
    signTypedData: jest.fn(),
    getAddresses: jest.fn(),
    getChainId: jest.fn(),
    request: jest.fn(),
    deployContract: jest.fn(),
    getPermissions: jest.fn(),
    requestPermissions: jest.fn(),
    revokePermissions: jest.fn(),
    switchChain: jest.fn(),
    watchAsset: jest.fn(),
    addChain: jest.fn(),
    clearWatch: jest.fn(),
    extend: jest.fn()
  } as any;
}