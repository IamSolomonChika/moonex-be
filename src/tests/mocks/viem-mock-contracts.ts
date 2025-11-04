/**
 * Viem Mock Contracts for Testing
 * Provides mock implementations of BSC contracts using Viem
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  Address,
  Hash,
  Chain,
  Account,
  Abi,
  GetContractReturnType,
  GetEventArgs,
  GetTransactionReceiptReturnType,
  WriteContractReturnType
} from 'viem';
import { bscTestnet } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';

/**
 * Mock ERC20 Token ABI
 */
export const MOCK_ERC20_ABI: Abi = [
  {
    inputs: [{ internalType: 'string', name: 'name', type: 'string' }],
    stateMutability: 'nonpayable',
    type: 'constructor'
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'from', type: 'address' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'transferFrom',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'from', type: 'address' },
      { indexed: true, internalType: 'address', name: 'to', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'value', type: 'uint256' }
    ],
    name: 'Transfer',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'owner', type: 'address' },
      { indexed: true, internalType: 'address', name: 'spender', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'value', type: 'uint256' }
    ],
    name: 'Approval',
    type: 'event'
  }
] as const;

/**
 * Mock PancakeSwap Router ABI
 */
export const MOCK_PANCAKE_ROUTER_ABI: Abi = [
  {
    inputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' }
    ],
    name: 'swapExactTokensForTokens',
    outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
      { internalType: 'uint256', name: 'amountInMax', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' }
    ],
    name: 'swapTokensForExactTokens',
    outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' }
    ],
    name: 'swapExactETHForTokens',
    outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
      { internalType: 'uint256', name: 'amountInMax', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' }
    ],
    name: 'swapTokensForExactETH',
    outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'tokenA', type: 'address' },
      { internalType: 'address', name: 'tokenB', type: 'address' },
      { internalType: 'uint256', name: 'amountADesired', type: 'uint256' },
      { internalType: 'uint256', name: 'amountBDesired', type: 'uint256' },
      { internalType: 'uint256', name: 'amountAMin', type: 'uint256' },
      { internalType: 'uint256', name: 'amountBMin', type: 'uint256' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' }
    ],
    name: 'addLiquidity',
    outputs: [
      { internalType: 'uint256', name: 'amountA', type: 'uint256' },
      { internalType: 'uint256', name: 'amountB', type: 'uint256' },
      { internalType: 'uint256', name: 'liquidity', type: 'uint256' }
    ],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'tokenA', type: 'address' },
      { internalType: 'address', name: 'tokenB', type: 'address' },
      { internalType: 'uint256', name: 'liquidity', type: 'uint256' },
      { internalType: 'uint256', name: 'amountAMin', type: 'uint256' },
      { internalType: 'uint256', name: 'amountBMin', type: 'uint256' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' }
    ],
    name: 'removeLiquidity',
    outputs: [
      { internalType: 'uint256', name: 'amountA', type: 'uint256' },
      { internalType: 'uint256', name: 'amountB', type: 'uint256' }
    ],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint256', name: 'reserveIn', type: 'uint256' },
      { internalType: 'uint256', name: 'reserveOut', type: 'uint256' }
    ],
    name: 'getAmountOut',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'pure',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
      { internalType: 'uint256', name: 'reserveIn', type: 'uint256' },
      { internalType: 'uint256', name: 'reserveOut', type: 'uint256' }
    ],
    name: 'getAmountIn',
    outputs: [{ internalType: 'uint256', name: 'amountIn', type: 'uint256' }],
    stateMutability: 'pure',
    type: 'function'
  }
] as const;

/**
 * Mock PancakeSwap Factory ABI
 */
export const MOCK_PANCAKE_FACTORY_ABI: Abi = [
  {
    inputs: [{ internalType: 'address', name: '_feeToSetter', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'constructor'
  },
  {
    inputs: [
      { internalType: 'address', name: 'tokenA', type: 'address' },
      { internalType: 'address', name: 'tokenB', type: 'address' }
    ],
    name: 'getPair',
    outputs: [{ internalType: 'address', name: 'pair', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'tokenA', type: 'address' },
      { internalType: 'address', name: 'tokenB', type: 'address' }
    ],
    name: 'createPair',
    outputs: [{ internalType: 'address', name: 'pair', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'allPairs',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'allPairsLength',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'token0', type: 'address' },
      { indexed: true, internalType: 'address', name: 'token1', type: 'address' },
      { indexed: false, internalType: 'address', name: 'pair', type: 'address' },
      { indexed: false, internalType: 'uint256', name: '', type: 'uint256' }
    ],
    name: 'PairCreated',
    type: 'event'
  }
] as const;

/**
 * Mock MasterChef ABI
 */
export const MOCK_MASTERCHEF_ABI: Abi = [
  {
    inputs: [
      { internalType: 'address', name: '_cake', type: 'address' },
      { internalType: 'address', name: '_syrup', type: 'address' },
      { internalType: 'address', name: '_devaddr', type: 'address' },
      { internalType: 'uint256', name: '_cakePerBlock', type: 'uint256' },
      { internalType: 'uint256', name: '_startBlock', type: 'uint256' }
    ],
    stateMutability: 'nonpayable',
    type: 'constructor'
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_pid', type: 'uint256' },
      { internalType: 'uint256', name: '_amount', type: 'uint256' }
    ],
    name: 'deposit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_pid', type: 'uint256' },
      { internalType: 'uint256', name: '_amount', type: 'uint256' }
    ],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: '_pid', type: 'uint256' }],
    name: 'enterStaking',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: '_amount', type: 'uint256' }],
    name: 'leaveStaking',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_pid', type: 'uint256' },
      { internalType: 'address', name: '_user', type: 'address' }
    ],
    name: 'pendingCake',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_pid', type: 'uint256' },
      { internalType: 'address', name: '_user', type: 'address' }
    ],
    name: 'userInfo',
    outputs: [
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'uint256', name: 'rewardDebt', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'poolInfo',
    outputs: [
      { internalType: 'address', name: 'lpToken', type: 'address' },
      { internalType: 'uint256', name: 'allocPoint', type: 'uint256' },
      { internalType: 'uint256', name: 'lastRewardBlock', type: 'uint256' },
      { internalType: 'uint256', name: 'accCakePerShare', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'poolLength',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'pid', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'Deposit',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'pid', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'Withdraw',
    type: 'event'
  }
] as const;

/**
 * Mock Contract Manager for Viem Testing
 */
export class ViemMockContractManager {
  private publicClient: any;
  private walletClient: any;
  private testAccount: Account;

  constructor() {
    // Create test account
    this.testAccount = mnemonicToAccount('test test test test test test test test test test test junk');

    // Create clients for testing
    this.publicClient = createPublicClient({
      chain: bscTestnet,
      transport: http('https://data-seed-prebsc-1-s1.binance.org:8545/')
    });

    this.walletClient = createWalletClient({
      chain: bscTestnet,
      transport: http('https://data-seed-prebsc-1-s1.binance.org:8545/'),
      account: this.testAccount
    });
  }

  /**
   * Get mock ERC20 contract
   */
  getMockERC20(tokenAddress: Address) {
    return {
      address: tokenAddress,
      abi: MOCK_ERC20_ABI,
      publicClient: this.publicClient,
      walletClient: this.walletClient
    };
  }

  /**
   * Get mock PancakeSwap Router contract
   */
  getMockPancakeRouter(routerAddress: Address = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as Address) {
    return {
      address: routerAddress,
      abi: MOCK_PANCAKE_ROUTER_ABI,
      publicClient: this.publicClient,
      walletClient: this.walletClient
    };
  }

  /**
   * Get mock PancakeSwap Factory contract
   */
  getMockPancakeFactory(factoryAddress: Address = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as Address) {
    return {
      address: factoryAddress,
      abi: MOCK_PANCAKE_FACTORY_ABI,
      publicClient: this.publicClient,
      walletClient: this.walletClient
    };
  }

  /**
   * Get mock MasterChef contract
   */
  getMockMasterChef(masterChefAddress: Address = '0x73feaa1eE314F8c655E354234017bE2193C9E24E' as Address) {
    return {
      address: masterChefAddress,
      abi: MOCK_MASTERCHEF_ABI,
      publicClient: this.publicClient,
      walletClient: this.walletClient
    };
  }

  /**
   * Get test account
   */
  getTestAccount(): Account {
    return this.testAccount;
  }

  /**
   * Get public client
   */
  getPublicClient() {
    return this.publicClient;
  }

  /**
   * Get wallet client
   */
  getWalletClient() {
    return this.walletClient;
  }

  /**
   * Create mock token data for testing
   */
  createMockTokenData(overrides: Partial<{
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: bigint;
    balance: bigint;
  }> = {}) {
    const defaults = {
      name: 'Mock Token',
      symbol: 'MOCK',
      decimals: 18,
      totalSupply: parseEther('1000000'),
      balance: parseEther('1000')
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Create mock pool data for testing
   */
  createMockPoolData(overrides: Partial<{
    token0: Address;
    token1: Address;
    reserve0: bigint;
    reserve1: bigint;
    totalSupply: bigint;
  }> = {}) {
    const defaults = {
      token0: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address, // WBNB
      token1: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address, // BUSD
      reserve0: parseEther('100'),
      reserve1: parseEther('10000'),
      totalSupply: parseEther('1000')
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Create mock farm data for testing
   */
  createMockFarmData(overrides: Partial<{
    pid: number;
    lpToken: Address;
    allocPoint: bigint;
    lastRewardBlock: bigint;
    accCakePerShare: bigint;
    userAmount: bigint;
    userRewardDebt: bigint;
    pendingCake: bigint;
  }> = {}) {
    const defaults = {
      pid: 0,
      lpToken: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' as Address, // CAKE-BNB LP
      allocPoint: 100n,
      lastRewardBlock: 1000000n,
      accCakePerShare: parseEther('1'),
      userAmount: parseEther('10'),
      userRewardDebt: 0n,
      pendingCake: parseEther('0.5')
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Mock transaction data for testing
   */
  createMockTransactionData(overrides: Partial<{
    hash: Hash;
    from: Address;
    to: Address;
    value: bigint;
    gasUsed: bigint;
    gasPrice: bigint;
    status: 'success' | 'reverted';
    blockNumber: bigint;
  }> = {}) {
    const defaults = {
      hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hash,
      from: this.testAccount.address,
      to: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
      value: parseEther('1'),
      gasUsed: 21000n,
      gasPrice: parseEther('0.00000001'),
      status: 'success' as const,
      blockNumber: 12345678n
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Mock swap quote data
   */
  createMockSwapQuote(overrides: Partial<{
    amountIn: bigint;
    amountOut: bigint;
    amountOutMin: bigint;
    path: Address[];
    priceImpact: number;
    gasEstimate: bigint;
  }> = {}) {
    const defaults = {
      amountIn: parseEther('1'),
      amountOut: parseEther('100'),
      amountOutMin: parseEther('95'),
      path: [
        '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address, // WBNB
        '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address  // BUSD
      ],
      priceImpact: 0.5,
      gasEstimate: 150000n
    };

    return { ...defaults, ...overrides };
  }
}

// Export singleton instance
export const viemMockContractManager = new ViemMockContractManager();

// Export convenience functions
export const getMockERC20 = (address: Address) => viemMockContractManager.getMockERC20(address);
export const getMockPancakeRouter = (address?: Address) => viemMockContractManager.getMockPancakeRouter(address);
export const getMockPancakeFactory = (address?: Address) => viemMockContractManager.getMockPancakeFactory(address);
export const getMockMasterChef = (address?: Address) => viemMockContractManager.getMockMasterChef(address);