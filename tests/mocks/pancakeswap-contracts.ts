import { ethers } from 'ethers';
import { testEnvironment } from '../setup/bsc-test-env';

/**
 * PancakeSwap Contract Mocks for Testing
 */
export interface PancakeSwapMocks {
  router: PancakeRouterMock;
  factory: PancakeFactoryMock;
  masterChef: MasterChefMock;
  masterChefV2: MasterChefV2Mock;
  wbnb: WBNBMock;
  tokens: Map<string, ERC20Mock>;
  pairs: Map<string, PancakePairMock>;
  pools: Map<string, PancakePoolMock>;
}

export interface MockContract {
  contract: ethers.Contract;
  address: string;
  abi: any[];
  deployer: ethers.Wallet;
  state: Map<string, any>;
  events: MockEvent[];
  functions: Map<string, MockFunction>;
}

export interface MockFunction {
  name: string;
  inputs: any[];
  outputs: any[];
  implementation: (...args: any[]) => any;
}

export interface MockEvent {
  name: string;
  args: any[];
  blockNumber: number;
  transactionHash: string;
  timestamp: Date;
}

/**
 * ERC20 Token Mock
 */
export class ERC20Mock implements MockContract {
  contract: ethers.Contract;
  address: string;
  abi: any[];
  deployer: ethers.Wallet;
  state: Map<string, any>;
  events: MockEvent[];
  functions: Map<string, MockFunction>;

  constructor(
    name: string,
    symbol: string,
    decimals: number,
    initialSupply: string,
    deployer: ethers.Wallet
  ) {
    this.deployer = deployer;
    this.state = new Map();
    this.events = [];
    this.functions = new Map();

    // Initialize state
    this.state.set('name', name);
    this.state.set('symbol', symbol);
    this.state.set('decimals', decimals);
    this.state.set('totalSupply', ethers.parseUnits(initialSupply, decimals));
    this.state.set('balances', new Map());
    this.state.set('allowances', new Map());

    // Set initial balance for deployer
    this.state.get('balances').set(deployer.address, this.state.get('totalSupply'));

    // Create ABI
    this.abi = [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function totalSupply() view returns (uint256)',
      'function balanceOf(address) view returns (uint256)',
      'function transfer(address to, uint256 amount) returns (bool)',
      'function allowance(address owner, address spender) view returns (uint256)',
      'function approve(address spender, uint256 amount) returns (bool)',
      'function transferFrom(address from, address to, uint256 amount) returns (bool)',
      'function mint(address to, uint256 amount)',
      'function burn(uint256 amount)',
      'event Transfer(address indexed from, address indexed to, uint256 value)',
      'event Approval(address indexed owner, address indexed spender, uint256 value)'
    ];

    // Create contract instance (mock)
    this.contract = this.createMockContract();
    this.address = this.contract.target as string;

    this.setupFunctions();
  }

  private createMockContract(): ethers.Contract {
    // Create a mock contract that intercepts calls
    const mockContract = {
      target: ethers.getAddress(ethers.createAddress().toString()),
      interface: new ethers.Interface(this.abi),
      callStatic: async (method: string, ...args: any[]) => {
        return this.handleCall(method, args);
      },
      send: async (method: string, ...args: any[]) => {
        return this.handleTransaction(method, args);
      },
      queryFilter: async (event: string, fromBlock?: number, toBlock?: number) => {
        return this.handleQueryFilter(event, fromBlock, toBlock);
      },
      on: (event: string, listener: (...args: any[]) => void) => {
        // Mock event listener
      },
      off: (event: string, listener: (...args: any[]) => void) => {
        // Mock event listener removal
      }
    } as any;

    return mockContract;
  }

  private setupFunctions(): void {
    this.functions.set('name', {
      name: 'name',
      inputs: [],
      outputs: ['string'],
      implementation: () => this.state.get('name')
    });

    this.functions.set('symbol', {
      name: 'symbol',
      inputs: [],
      outputs: ['string'],
      implementation: () => this.state.get('symbol')
    });

    this.functions.set('decimals', {
      name: 'decimals',
      inputs: [],
      outputs: ['uint8'],
      implementation: () => this.state.get('decimals')
    });

    this.functions.set('totalSupply', {
      name: 'totalSupply',
      inputs: [],
      outputs: ['uint256'],
      implementation: () => this.state.get('totalSupply')
    });

    this.functions.set('balanceOf', {
      name: 'balanceOf',
      inputs: ['address'],
      outputs: ['uint256'],
      implementation: (account: string) => {
        const balances = this.state.get('balances') as Map<string, bigint>;
        return balances.get(account) || BigInt(0);
      }
    });

    this.functions.set('transfer', {
      name: 'transfer',
      inputs: ['address', 'uint256'],
      outputs: ['bool'],
      implementation: (to: string, amount: bigint) => {
        const balances = this.state.get('balances') as Map<string, bigint>;
        const fromBalance = balances.get(this.deployer.address) || BigInt(0);

        if (fromBalance < amount) {
          throw new Error('ERC20: transfer amount exceeds balance');
        }

        // Update balances
        balances.set(this.deployer.address, fromBalance - amount);
        balances.set(to, (balances.get(to) || BigInt(0)) + amount);

        // Emit event
        this.emitEvent('Transfer', [this.deployer.address, to, amount]);

        return true;
      }
    });

    this.functions.set('approve', {
      name: 'approve',
      inputs: ['address', 'uint256'],
      outputs: ['bool'],
      implementation: (spender: string, amount: bigint) => {
        const allowances = this.state.get('allowances') as Map<string, Map<string, bigint>>;
        if (!allowances.has(this.deployer.address)) {
          allowances.set(this.deployer.address, new Map());
        }
        allowances.get(this.deployer.address)!.set(spender, amount);

        // Emit event
        this.emitEvent('Approval', [this.deployer.address, spender, amount]);

        return true;
      }
    });

    this.functions.set('transferFrom', {
      name: 'transferFrom',
      inputs: ['address', 'address', 'uint256'],
      outputs: ['bool'],
      implementation: (from: string, to: string, amount: bigint) => {
        const balances = this.state.get('balances') as Map<string, bigint>;
        const allowances = this.state.get('allowances') as Map<string, Map<string, bigint>>;

        const fromBalance = balances.get(from) || BigInt(0);
        const allowance = allowances.get(from)?.get(this.deployer.address) || BigInt(0);

        if (fromBalance < amount) {
          throw new Error('ERC20: transfer amount exceeds balance');
        }

        if (allowance < amount) {
          throw new Error('ERC20: transfer amount exceeds allowance');
        }

        // Update balances
        balances.set(from, fromBalance - amount);
        balances.set(to, (balances.get(to) || BigInt(0)) + amount);

        // Update allowance
        allowances.get(from)!.set(this.deployer.address, allowance - amount);

        // Emit event
        this.emitEvent('Transfer', [from, to, amount]);

        return true;
      }
    });

    this.functions.set('mint', {
      name: 'mint',
      inputs: ['address', 'uint256'],
      outputs: [],
      implementation: (to: string, amount: bigint) => {
        const balances = this.state.get('balances') as Map<string, bigint>;
        const totalSupply = this.state.get('totalSupply') as bigint;

        balances.set(to, (balances.get(to) || BigInt(0)) + amount);
        this.state.set('totalSupply', totalSupply + amount);

        // Emit event
        this.emitEvent('Transfer', [ethers.ZeroAddress, to, amount]);
      }
    });

    this.functions.set('burn', {
      name: 'burn',
      inputs: ['uint256'],
      outputs: [],
      implementation: (amount: bigint) => {
        const balances = this.state.get('balances') as Map<string, bigint>;
        const totalSupply = this.state.get('totalSupply') as bigint;
        const fromBalance = balances.get(this.deployer.address) || BigInt(0);

        if (fromBalance < amount) {
          throw new Error('ERC20: burn amount exceeds balance');
        }

        balances.set(this.deployer.address, fromBalance - amount);
        this.state.set('totalSupply', totalSupply - amount);

        // Emit event
        this.emitEvent('Transfer', [this.deployer.address, ethers.ZeroAddress, amount]);
      }
    });
  }

  private async handleCall(method: string, args: any[]): Promise<any> {
    const mockFunction = this.functions.get(method);
    if (!mockFunction) {
      throw new Error(`Function ${method} not found`);
    }
    return mockFunction.implementation(...args);
  }

  private async handleTransaction(method: string, args: any[]): Promise<any> {
    const result = await this.handleCall(method, args);
    return {
      hash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [method, JSON.stringify(args)])),
      wait: async () => ({
        to: this.address,
        from: this.deployer.address,
        gasUsed: BigInt(50000),
        gasPrice: ethers.parseUnits('20', 'gwei'),
        logs: [],
        status: 1,
        blockNumber: 1,
        transactionHash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [method, JSON.stringify(args)]))
      })
    };
  }

  private async handleQueryFilter(event: string, fromBlock?: number, toBlock?: number): Promise<any[]> {
    const events = this.events.filter(e => e.name === event);
    return events.map(e => ({
      address: this.address,
      args: e.args,
      blockNumber: e.blockNumber,
      transactionHash: e.transactionHash,
      timestamp: e.timestamp
    }));
  }

  private emitEvent(name: string, args: any[]): void {
    this.events.push({
      name,
      args,
      blockNumber: 1,
      transactionHash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [name, JSON.stringify(args)])),
      timestamp: new Date()
    });
  }

  // Helper methods for testing
  getBalance(address: string): string {
    const balances = this.state.get('balances') as Map<string, bigint>;
    return ethers.formatUnits(balances.get(address) || BigInt(0), this.state.get('decimals'));
  }

  getTotalSupply(): string {
    return ethers.formatUnits(this.state.get('totalSupply') as bigint, this.state.get('decimals'));
  }

  mint(to: string, amount: string): void {
    const decimals = this.state.get('decimals');
    const parsedAmount = ethers.parseUnits(amount, decimals);
    this.functions.get('mint')!.implementation(to, parsedAmount);
  }

  burn(amount: string): void {
    const decimals = this.state.get('decimals');
    const parsedAmount = ethers.parseUnits(amount, decimals);
    this.functions.get('burn')!.implementation(parsedAmount);
  }
}

/**
 * PancakeSwap Router Mock
 */
export class PancakeRouterMock implements MockContract {
  contract: ethers.Contract;
  address: string;
  abi: any[];
  deployer: ethers.Wallet;
  state: Map<string, any>;
  events: MockEvent[];
  functions: Map<string, MockFunction>;
  factory: PancakeFactoryMock;
  wbnb: WBNBMock;

  constructor(factory: PancakeFactoryMock, wbnb: WBNBMock, deployer: ethers.Wallet) {
    this.deployer = deployer;
    this.factory = factory;
    this.wbnb = wbnb;
    this.state = new Map();
    this.events = [];
    this.functions = new Map();

    // Initialize state
    this.state.set('WETH', wbnb.address);
    this.state.set('factory', factory.address);

    // Create ABI
    this.abi = [
      'function factory() external view returns (address)',
      'function WETH() external view returns (address)',
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) external returns (uint[] amounts)',
      'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] path, address to, uint deadline) external returns (uint[] amounts)',
      'function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) external payable returns (uint[] amounts)',
      'function swapTokensForExactETH(uint amountOut, address[] path, address to, uint deadline) external returns (uint[] amounts)',
      'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)',
      'function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB)',
      'function quote(uint amountA, uint reserveA, uint reserveB) external pure returns (uint amountB)',
      'function getAmountsOut(uint amountIn, address[] path) external view returns (uint[] amounts)',
      'function getAmountsIn(uint amountOut, address[] path) external view returns (uint[] amounts)',
      'event Swap(address indexed sender, uint amountIn, address indexed tokenIn, address indexed tokenOut, address to, uint[] amounts)',
      'event Sync(uint112 reserve0, uint112 reserve1)',
      'event PairCreated(address indexed token0, address indexed token1, address pair, uint)'
    ];

    // Create contract instance
    this.contract = this.createMockContract();
    this.address = this.contract.target as string;

    this.setupFunctions();
  }

  private createMockContract(): ethers.Contract {
    const mockContract = {
      target: ethers.getAddress(ethers.createAddress().toString()),
      interface: new ethers.Interface(this.abi),
      callStatic: async (method: string, ...args: any[]) => {
        return this.handleCall(method, args);
      },
      send: async (method: string, ...args: any[]) => {
        return this.handleTransaction(method, args);
      },
      queryFilter: async (event: string, fromBlock?: number, toBlock?: number) => {
        return this.handleQueryFilter(event, fromBlock, toBlock);
      },
      on: (event: string, listener: (...args: any[]) => void) => {
        // Mock event listener
      },
      off: (event: string, listener: (...args: any[]) => void) => {
        // Mock event listener removal
      }
    } as any;

    return mockContract;
  }

  private setupFunctions(): void {
    this.functions.set('factory', {
      name: 'factory',
      inputs: [],
      outputs: ['address'],
      implementation: () => this.factory.address
    });

    this.functions.set('WETH', {
      name: 'WETH',
      inputs: [],
      outputs: ['address'],
      implementation: () => this.wbnb.address
    });

    this.functions.set('quote', {
      name: 'quote',
      inputs: ['uint', 'uint', 'uint'],
      outputs: ['uint'],
      implementation: (amountA: bigint, reserveA: bigint, reserveB: bigint) => {
        return (amountA * reserveB) / reserveA;
      }
    });

    this.functions.set('getAmountsOut', {
      name: 'getAmountsOut',
      inputs: ['uint', 'address[]'],
      outputs: ['uint[]'],
      implementation: (amountIn: bigint, path: string[]) => {
        const amounts: bigint[] = [amountIn];

        // Simulate price impact and slippage
        let currentAmount = amountIn;
        for (let i = 0; i < path.length - 1; i++) {
          // Mock price calculation with slippage
          const slippage = BigInt(Math.floor(Math.random() * 5 + 1)); // 1-5 slippage
          const amountOut = currentAmount * BigInt(100 - Number(slippage)) / BigInt(100);
          amounts.push(amountOut);
          currentAmount = amountOut;
        }

        return amounts;
      }
    });

    this.functions.set('getAmountsIn', {
      name: 'getAmountsIn',
      inputs: ['uint', 'address[]'],
      outputs: ['uint[]'],
      implementation: (amountOut: bigint, path: string[]) => {
        const amounts: bigint[] = [];
        let currentAmount = amountOut;

        // Reverse calculation
        for (let i = path.length - 1; i > 0; i--) {
          const slippage = BigInt(Math.floor(Math.random() * 5 + 1));
          const amountIn = currentAmount * BigInt(100 + Number(slippage)) / BigInt(100 - Number(slippage));
          amounts.unshift(amountIn);
          currentAmount = amountIn;
        }
        amounts.unshift(currentAmount);

        return amounts;
      }
    });

    this.functions.set('swapExactTokensForTokens', {
      name: 'swapExactTokensForTokens',
      inputs: ['uint', 'uint', 'address[]', 'address', 'uint'],
      outputs: ['uint[]'],
      implementation: (amountIn: bigint, amountOutMin: bigint, path: string[], to: string, deadline: bigint) => {
        const amounts = this.functions.get('getAmountsOut')!.implementation(amountIn, path);
        const amountOut = amounts[amounts.length - 1];

        if (amountOut < amountOutMin) {
          throw new Error('PancakeRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        }

        if (deadline < BigInt(Date.now() / 1000)) {
          throw new Error('PancakeRouter: EXPIRED');
        }

        // Emit swap event
        this.emitEvent('Swap', [
          this.deployer.address,
          amountIn,
          path[0],
          path[path.length - 1],
          to,
          amounts
        ]);

        return amounts;
      }
    });

    this.functions.set('swapExactETHForTokens', {
      name: 'swapExactETHForTokens',
      inputs: ['uint', 'address[]', 'address', 'uint'],
      outputs: ['uint[]'],
      implementation: (amountOutMin: bigint, path: string[], to: string, deadline: bigint) => {
        const amountIn = this.state.get('msgValue') || ethers.parseEther('1');
        const amounts = this.functions.get('getAmountsOut')!.implementation(amountIn, path);
        const amountOut = amounts[amounts.length - 1];

        if (amountOut < amountOutMin) {
          throw new Error('PancakeRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        }

        // Emit swap event
        this.emitEvent('Swap', [
          this.deployer.address,
          amountIn,
          path[0],
          path[path.length - 1],
          to,
          amounts
        ]);

        return amounts;
      }
    });

    this.functions.set('addLiquidity', {
      name: 'addLiquidity',
      inputs: ['address', 'address', 'uint', 'uint', 'uint', 'uint', 'address', 'uint'],
      outputs: ['uint', 'uint', 'uint'],
      implementation: (tokenA: string, tokenB: string, amountADesired: bigint, amountBDesired: bigint, amountAMin: bigint, amountBMin: bigint, to: string, deadline: bigint) => {
        // Mock liquidity addition
        const amountA = amountADesired;
        const amountB = amountBDesired;

        if (amountA < amountAMin || amountB < amountBMin) {
          throw new Error('PancakeRouter: INSUFFICIENT_A_AMOUNT' || 'PancakeRouter: INSUFFICIENT_B_AMOUNT');
        }

        if (deadline < BigInt(Date.now() / 1000)) {
          throw new Error('PancakeRouter: EXPIRED');
        }

        // Mock liquidity amount (simplified)
        const liquidity = amountA + amountB;

        return [amountA, amountB, liquidity];
      }
    });
  }

  private async handleCall(method: string, args: any[]): Promise<any> {
    const mockFunction = this.functions.get(method);
    if (!mockFunction) {
      throw new Error(`Function ${method} not found`);
    }
    return mockFunction.implementation(...args);
  }

  private async handleTransaction(method: string, args: any[]): Promise<any> {
    const result = await this.handleCall(method, args);
    return {
      hash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [method, JSON.stringify(args)])),
      wait: async () => ({
        to: this.address,
        from: this.deployer.address,
        gasUsed: BigInt(150000),
        gasPrice: ethers.parseUnits('20', 'gwei'),
        logs: [],
        status: 1,
        blockNumber: 1,
        transactionHash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [method, JSON.stringify(args)]))
      })
    };
  }

  private async handleQueryFilter(event: string, fromBlock?: number, toBlock?: number): Promise<any[]> {
    const events = this.events.filter(e => e.name === event);
    return events.map(e => ({
      address: this.address,
      args: e.args,
      blockNumber: e.blockNumber,
      transactionHash: e.transactionHash,
      timestamp: e.timestamp
    }));
  }

  private emitEvent(name: string, args: any[]): void {
    this.events.push({
      name,
      args,
      blockNumber: 1,
      transactionHash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [name, JSON.stringify(args)])),
      timestamp: new Date()
    });
  }

  // Helper method to set msgValue for transactions
  setMsgValue(value: bigint): void {
    this.state.set('msgValue', value);
  }
}

/**
 * PancakeSwap Factory Mock
 */
export class PancakeFactoryMock implements MockContract {
  contract: ethers.Contract;
  address: string;
  abi: any[];
  deployer: ethers.Wallet;
  state: Map<string, any>;
  events: MockEvent[];
  functions: Map<string, MockFunction>;
  pairs: Map<string, PancakePairMock>;

  constructor(deployer: ethers.Wallet) {
    this.deployer = deployer;
    this.state = new Map();
    this.events = [];
    this.functions = new Map();
    this.pairs = new Map();

    // Initialize state
    this.state.set('feeTo', deployer.address);
    this.state.set('feeToSetter', deployer.address);

    // Create ABI
    this.abi = [
      'function getPair(address tokenA, address tokenB) external view returns (address pair)',
      'function allPairs(uint) external view returns (address pair)',
      'function allPairsLength() external view returns (uint)',
      'function createPair(address tokenA, address tokenB) external returns (address pair)',
      'function setFeeTo(address) external',
      'function setFeeToSetter(address) external',
      'event PairCreated(address indexed token0, address indexed token1, address pair, uint)'
    ];

    // Create contract instance
    this.contract = this.createMockContract();
    this.address = this.contract.target as string;

    this.setupFunctions();
  }

  private createMockContract(): ethers.Contract {
    const mockContract = {
      target: ethers.getAddress(ethers.createAddress().toString()),
      interface: new ethers.Interface(this.abi),
      callStatic: async (method: string, ...args: any[]) => {
        return this.handleCall(method, args);
      },
      send: async (method: string, ...args: any[]) => {
        return this.handleTransaction(method, args);
      },
      queryFilter: async (event: string, fromBlock?: number, toBlock?: number) => {
        return this.handleQueryFilter(event, fromBlock, toBlock);
      },
      on: (event: string, listener: (...args: any[]) => void) => {
        // Mock event listener
      },
      off: (event: string, listener: (...args: any[]) => void) => {
        // Mock event listener removal
      }
    } as any;

    return mockContract;
  }

  private setupFunctions(): void {
    this.functions.set('getPair', {
      name: 'getPair',
      inputs: ['address', 'address'],
      outputs: ['address'],
      implementation: (tokenA: string, tokenB: string) => {
        const sortedTokens = [tokenA, tokenB].sort();
        const pairKey = sortedTokens.join('-');
        const pair = this.pairs.get(pairKey);
        return pair ? pair.address : ethers.ZeroAddress;
      }
    });

    this.functions.set('allPairsLength', {
      name: 'allPairsLength',
      inputs: [],
      outputs: ['uint'],
      implementation: () => this.pairs.size
    });

    this.functions.set('allPairs', {
      name: 'allPairs',
      inputs: ['uint'],
      outputs: ['address'],
      implementation: (index: number) => {
        const pairs = Array.from(this.pairs.values());
        return index < pairs.length ? pairs[index].address : ethers.ZeroAddress;
      }
    });

    this.functions.set('createPair', {
      name: 'createPair',
      inputs: ['address', 'address'],
      outputs: ['address'],
      implementation: (tokenA: string, tokenB: string) => {
        const sortedTokens = [tokenA, tokenB].sort();
        const pairKey = sortedTokens.join('-');

        if (this.pairs.has(pairKey)) {
          return this.pairs.get(pairKey)!.address;
        }

        // Create new pair
        const pair = new PancakePairMock(sortedTokens[0], sortedTokens[1], this.deployer);
        this.pairs.set(pairKey, pair);

        // Emit event
        this.emitEvent('PairCreated', [sortedTokens[0], sortedTokens[1], pair.address, 1]);

        return pair.address;
      }
    });

    this.functions.set('setFeeTo', {
      name: 'setFeeTo',
      inputs: ['address'],
      outputs: [],
      implementation: (feeTo: string) => {
        this.state.set('feeTo', feeTo);
      }
    });

    this.functions.set('setFeeToSetter', {
      name: 'setFeeToSetter',
      inputs: ['address'],
      outputs: [],
      implementation: (feeToSetter: string) => {
        this.state.set('feeToSetter', feeToSetter);
      }
    });
  }

  private async handleCall(method: string, args: any[]): Promise<any> {
    const mockFunction = this.functions.get(method);
    if (!mockFunction) {
      throw new Error(`Function ${method} not found`);
    }
    return mockFunction.implementation(...args);
  }

  private async handleTransaction(method: string, args: any[]): Promise<any> {
    const result = await this.handleCall(method, args);
    return {
      hash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [method, JSON.stringify(args)])),
      wait: async () => ({
        to: this.address,
        from: this.deployer.address,
        gasUsed: BigInt(100000),
        gasPrice: ethers.parseUnits('20', 'gwei'),
        logs: [],
        status: 1,
        blockNumber: 1,
        transactionHash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [method, JSON.stringify(args)]))
      })
    };
  }

  private async handleQueryFilter(event: string, fromBlock?: number, toBlock?: number): Promise<any[]> {
    const events = this.events.filter(e => e.name === event);
    return events.map(e => ({
      address: this.address,
      args: e.args,
      blockNumber: e.blockNumber,
      transactionHash: e.transactionHash,
      timestamp: e.timestamp
    }));
  }

  private emitEvent(name: string, args: any[]): void {
    this.events.push({
      name,
      args,
      blockNumber: 1,
      transactionHash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [name, JSON.stringify(args)])),
      timestamp: new Date()
    });
  }

  // Helper methods
  getPairCount(): number {
    return this.pairs.size;
  }

  getPair(tokenA: string, tokenB: string): PancakePairMock | null {
    const sortedTokens = [tokenA, tokenB].sort();
    const pairKey = sortedTokens.join('-');
    return this.pairs.get(pairKey) || null;
  }

  createPair(tokenA: string, tokenB: string): PancakePairMock {
    return this.functions.get('createPair')!.implementation(tokenA, tokenB);
  }
}

/**
 * PancakeSwap Pair Mock (for V2)
 */
export class PancakePairMock implements MockContract {
  contract: ethers.Contract;
  address: string;
  abi: any[];
  deployer: ethers.Wallet;
  state: Map<string, any>;
  events: MockEvent[];
  functions: Map<string, MockFunction>;
  token0: string;
  token1: string;

  constructor(token0: string, token1: string, deployer: ethers.Wallet) {
    this.deployer = deployer;
    this.token0 = token0;
    this.token1 = token1;
    this.state = new Map();
    this.events = [];
    this.functions = new Map();

    // Initialize state
    this.state.set('reserve0', ethers.parseUnits('1000', 18));
    this.state.set('reserve1', ethers.parseUnits('2000', 18));
    this.state.set('k', ethers.parseUnits('1000', 18) * ethers.parseUnits('2000', 18));

    // Create ABI
    this.abi = [
      'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
      'function token0() external view returns (address)',
      'function token1() external view returns (address)',
      'function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external',
      'function skim(address to) external',
      'function sync() external',
      'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)',
      'event Sync(uint112 reserve0, uint112 reserve1)'
    ];

    // Create contract instance
    this.contract = this.createMockContract();
    this.address = this.contract.target as string;

    this.setupFunctions();
  }

  private createMockContract(): ethers.Contract {
    const mockContract = {
      target: ethers.getAddress(ethers.createAddress().toString()),
      interface: new ethers.Interface(this.abi),
      callStatic: async (method: string, ...args: any[]) => {
        return this.handleCall(method, args);
      },
      send: async (method: string, ...args: any[]) => {
        return this.handleTransaction(method, args);
      },
      queryFilter: async (event: string, fromBlock?: number, toBlock?: number) => {
        return this.handleQueryFilter(event, fromBlock, toBlock);
      },
      on: (event: string, listener: (...args: any[]) => void) => {
        // Mock event listener
      },
      off: (event: string, listener: (...args: any[]) => void) => {
        // Mock event listener removal
      }
    } as any;

    return mockContract;
  }

  private setupFunctions(): void {
    this.functions.set('getReserves', {
      name: 'getReserves',
      inputs: [],
      outputs: ['uint112', 'uint112', 'uint32'],
      implementation: () => [
        this.state.get('reserve0'),
        this.state.get('reserve1'),
        Math.floor(Date.now() / 1000)
      ]
    });

    this.functions.set('token0', {
      name: 'token0',
      inputs: [],
      outputs: ['address'],
      implementation: () => this.token0
    });

    this.functions.set('token1', {
      name: 'token1',
      inputs: [],
      outputs: ['address'],
      implementation: () => this.token1
    });

    this.functions.set('swap', {
      name: 'swap',
      inputs: ['uint', 'uint', 'address', 'bytes'],
      outputs: [],
      implementation: (amount0Out: bigint, amount1Out: bigint, to: string, data: string) => {
        const reserve0 = this.state.get('reserve0') as bigint;
        const reserve1 = this.state.get('reserve1') as bigint;

        // Calculate required input amounts
        const amount0In = (amount0Out * reserve0) / (reserve1 - amount1Out);
        const amount1In = (amount1Out * reserve1) / (reserve0 - amount0Out);

        // Update reserves
        this.state.set('reserve0', reserve0 + amount0In - amount0Out);
        this.state.set('reserve1', reserve1 + amount1In - amount1Out);

        // Emit swap event
        this.emitEvent('Swap', [
          this.deployer.address,
          amount0In,
          amount1In,
          amount0Out,
          amount1Out,
          to
        ]);
      }
    });

    this.functions.set('sync', {
      name: 'sync',
      inputs: [],
      outputs: [],
      implementation: () => {
        // Emit sync event
        this.emitEvent('Sync', [
          this.state.get('reserve0'),
          this.state.get('reserve1')
        ]);
      }
    });
  }

  private async handleCall(method: string, args: any[]): Promise<any> {
    const mockFunction = this.functions.get(method);
    if (!mockFunction) {
      throw new Error(`Function ${method} not found`);
    }
    return mockFunction.implementation(...args);
  }

  private async handleTransaction(method: string, args: any[]): Promise<any> {
    const result = await this.handleCall(method, args);
    return {
      hash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [method, JSON.stringify(args)])),
      wait: async () => ({
        to: this.address,
        from: this.deployer.address,
        gasUsed: BigInt(80000),
        gasPrice: ethers.parseUnits('20', 'gwei'),
        logs: [],
        status: 1,
        blockNumber: 1,
        transactionHash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [method, JSON.stringify(args)]))
      })
    };
  }

  private async handleQueryFilter(event: string, fromBlock?: number, toBlock?: number): Promise<any[]> {
    const events = this.events.filter(e => e.name === event);
    return events.map(e => ({
      address: this.address,
      args: e.args,
      blockNumber: e.blockNumber,
      transactionHash: e.transactionHash,
      timestamp: e.timestamp
    }));
  }

  private emitEvent(name: string, args: any[]): void {
    this.events.push({
      name,
      args,
      blockNumber: 1,
      transactionHash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [name, JSON.stringify(args)])),
      timestamp: new Date()
    });
  }

  // Helper methods
  getReserves(): { reserve0: string; reserve1: string } {
    return {
      reserve0: ethers.formatUnits(this.state.get('reserve0') as bigint, 18),
      reserve1: ethers.formatUnits(this.state.get('reserve1') as bigint, 18)
    };
  }

  setReserves(reserve0: string, reserve1: string): void {
    this.state.set('reserve0', ethers.parseUnits(reserve0, 18));
    this.state.set('reserve1', ethers.parseUnits(reserve1, 18));
    this.state.set('k', this.state.get('reserve0') * this.state.get('reserve1'));
  }

  getPrice(token: string): string {
    const { reserve0, reserve1 } = this.getReserves();
    if (token === this.token0) {
      return ethers.formatUnits(ethers.parseUnits(reserve1, 18) / ethers.parseUnits(reserve0, 18), 18);
    } else {
      return ethers.formatUnits(ethers.parseUnits(reserve0, 18) / ethers.parseUnits(reserve1, 18), 18);
    }
  }
}

/**
 * WBNB Mock
 */
export class WBNBMock extends ERC20Mock {
  constructor(deployer: ethers.Wallet) {
    super('Wrapped BNB', 'WBNB', 18, '1000000', deployer);
  }
}

/**
 * MasterChef Mock
 */
export class MasterChefMock implements MockContract {
  contract: ethers.Contract;
  address: string;
  abi: any[];
  deployer: ethers.Wallet;
  state: Map<string, any>;
  events: MockEvent[];
  functions: Map<string, MockFunction>;

  constructor(cakeToken: ERC20Mock, deployer: ethers.Wallet) {
    this.deployer = deployer;
    this.state = new Map();
    this.events = [];
    this.functions = new Map();

    // Initialize state
    this.state.set('CAKE', cakeToken.address);
    this.state.set('CAKE_PER_BLOCK', ethers.parseUnits('40', 18)); // 40 CAKE per block
    this.state.set('totalAllocPoint', 1000);
    this.state.set('pools', new Map());
    this.state.set('poolInfo', new Map());
    this.state.set('userInfo', new Map());

    // Create ABI
    this.abi = [
      'function poolInfo(uint256 pid) external view returns (address lpToken, uint256 allocPoint, uint256 lastRewardBlock, uint256 accCakePerShare)',
      'function userInfo(uint256 pid, address user) external view returns (uint256 amount, uint256 rewardDebt)',
      'function poolLength() external view returns (uint256)',
      'function add(uint256 _allocPoint, address _lpToken) external',
      'function set(uint256 _pid, uint256 _allocPoint) external',
      'function updatePool(uint256 _pid) external',
      'function deposit(uint256 _pid, uint256 _amount) external',
      'function withdraw(uint256 _pid, uint256 _amount) external',
      'function enterStaking(uint256 _amount) external',
      'function leaveStaking(uint256 _amount) external',
      'function pendingCake(uint256 _pid, address _user) external view returns (uint256)',
      'function updateAllPools() external',
      'event Deposit(address indexed user, uint256 indexed pid, uint256 amount)',
      'event Withdraw(address indexed user, uint256 indexed pid, uint256 amount)',
      'event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount)'
    ];

    // Create contract instance
    this.contract = this.createMockContract();
    this.address = this.contract.target as string;

    this.setupFunctions();
  }

  private createMockContract(): ethers.Contract {
    const mockContract = {
      target: ethers.getAddress(ethers.createAddress().toString()),
      interface: new ethers.Interface(this.abi),
      callStatic: async (method: string, ...args: any[]) => {
        return this.handleCall(method, args);
      },
      send: async (method: string, ...args: any[]) => {
        return this.handleTransaction(method, args);
      },
      queryFilter: async (event: string, fromBlock?: number, toBlock?: number) => {
        return this.handleQueryFilter(event, fromBlock, toBlock);
      },
      on: (event: string, listener: (...args: any[]) => void) => {
        // Mock event listener
      },
      off: (event: string, listener: (...args: any[]) => void) => {
        // Mock event listener removal
      }
    } as any;

    return mockContract;
  }

  private setupFunctions(): void {
    this.functions.set('poolInfo', {
      name: 'poolInfo',
      inputs: ['uint256'],
      outputs: ['address', 'uint256', 'uint256', 'uint256'],
      implementation: (pid: bigint) => {
        const poolInfo = this.state.get('poolInfo') as Map<string, any>;
        const info = poolInfo.get(pid.toString()) || {
          lpToken: ethers.ZeroAddress,
          allocPoint: 0,
          lastRewardBlock: 1,
          accCakePerShare: ethers.parseUnits('1', 18)
        };
        return [info.lpToken, info.allocPoint, info.lastRewardBlock, info.accCakePerShare];
      }
    });

    this.functions.set('userInfo', {
      name: 'userInfo',
      inputs: ['uint256', 'address'],
      outputs: ['uint256', 'uint256'],
      implementation: (pid: bigint, user: string) => {
        const userInfo = this.state.get('userInfo') as Map<string, Map<string, any>>;
        if (!userInfo.has(pid.toString())) {
          userInfo.set(pid.toString(), new Map());
        }
        const userPoolInfo = userInfo.get(pid.toString())!;
        return [userPoolInfo.amount || BigInt(0), userPoolInfo.rewardDebt || BigInt(0)];
      }
    });

    this.functions.set('poolLength', {
      name: 'poolLength',
      inputs: [],
      outputs: ['uint256'],
      implementation: () => this.state.get('pools').size
    });

    this.functions.set('add', {
      name: 'add',
      inputs: ['uint256', 'address'],
      outputs: [],
      implementation: (allocPoint: bigint, lpToken: string) => {
        const pid = this.state.get('pools').size;
        this.state.get('pools').set(pid.toString(), lpToken);

        const poolInfo = this.state.get('poolInfo') as Map<string, any>;
        poolInfo.set(pid.toString(), {
          lpToken,
          allocPoint,
          lastRewardBlock: 1,
          accCakePerShare: ethers.parseUnits('1', 18)
        });

        // Update total allocation points
        const totalAllocPoint = this.state.get('totalAllocPoint') as bigint;
        this.state.set('totalAllocPoint', totalAllocPoint + allocPoint);
      }
    });

    this.functions.set('deposit', {
      name: 'deposit',
      inputs: ['uint256', 'uint256'],
      outputs: [],
      implementation: (pid: bigint, amount: bigint) => {
        const userInfo = this.state.get('userInfo') as Map<string, Map<string, any>>;
        if (!userInfo.has(pid.toString())) {
          userInfo.set(pid.toString(), new Map());
        }
        const userPoolInfo = userInfo.get(pid.toString())!;

        // Update user info
        userPoolInfo.amount = (userPoolInfo.amount || BigInt(0)) + amount;

        // Emit event
        this.emitEvent('Deposit', [this.deployer.address, pid, amount]);
      }
    });

    this.functions.set('withdraw', {
      name: 'withdraw',
      inputs: ['uint256', 'uint256'],
      outputs: [],
      implementation: (pid: bigint, amount: bigint) => {
        const userInfo = this.state.get('userInfo') as Map<string, Map<string, any>>;
        const userPoolInfo = userInfo.get(pid.toString());

        if (!userPoolInfo || userPoolInfo.amount < amount) {
          throw new Error('MasterChef: withdraw: insufficient');
        }

        // Update user info
        userPoolInfo.amount -= amount;

        // Emit event
        this.emitEvent('Withdraw', [this.deployer.address, pid, amount]);
      }
    });

    this.functions.set('pendingCake', {
      name: 'pendingCake',
      inputs: ['uint256', 'address'],
      outputs: ['uint256'],
      implementation: (pid: bigint, user: string) => {
        const poolInfo = this.functions.get('poolInfo')!.implementation(pid);
        const userInfo = this.functions.get('userInfo')!.implementation(pid, user);
        const accCakePerShare = poolInfo[3] as bigint;
        const userAmount = userInfo[0] as bigint;

        // Simplified pending rewards calculation
        return (userAmount * accCakePerShare) / ethers.parseUnits('1', 18);
      }
    });
  }

  private async handleCall(method: string, args: any[]): Promise<any> {
    const mockFunction = this.functions.get(method);
    if (!mockFunction) {
      throw new Error(`Function ${method} not found`);
    }
    return mockFunction.implementation(...args);
  }

  private async handleTransaction(method: string, args: any[]): Promise<any> {
    const result = await this.handleCall(method, args);
    return {
      hash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [method, JSON.stringify(args)])),
      wait: async () => ({
        to: this.address,
        from: this.deployer.address,
        gasUsed: BigInt(120000),
        gasPrice: ethers.parseUnits('20', 'gwei'),
        logs: [],
        status: 1,
        blockNumber: 1,
        transactionHash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [method, JSON.stringify(args)]))
      })
    };
  }

  private async handleQueryFilter(event: string, fromBlock?: number, toBlock?: number): Promise<any[]> {
    const events = this.events.filter(e => e.name === event);
    return events.map(e => ({
      address: this.address,
      args: e.args,
      blockNumber: e.blockNumber,
      transactionHash: e.transactionHash,
      timestamp: e.timestamp
    }));
  }

  private emitEvent(name: string, args: any[]): void {
    this.events.push({
      name,
      args,
      blockNumber: 1,
      transactionHash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [name, JSON.stringify(args)])),
      timestamp: new Date()
    });
  }
}

/**
 * MasterChefV2 Mock
 */
export class MasterChefV2Mock implements MockContract {
  contract: ethers.Contract;
  address: string;
  abi: any[];
  deployer: ethers.Wallet;
  state: Map<string, any>;
  events: MockEvent[];
  functions: Map<string, MockFunction>;

  constructor(deployer: ethers.Wallet) {
    this.deployer = deployer;
    this.state = new Map();
    this.events = [];
    this.functions = new Map();

    // Initialize state
    this.state.set('regularRewardsPerSecond', ethers.parseUnits('1', 18));
    this.state.set('pools', new Map());

    // Create ABI
    this.abi = [
      'function add(uint256 allocPoint, address _lpToken, address _rewarder) external',
      'function set(uint256 _pid, uint256 _allocPoint) external',
      'function updatePool(uint256 _pid) external',
      'function deposit(uint256 _pid, uint256 _amount) external',
      'function withdraw(uint256 _pid, uint256 _amount) external',
      'function harvest(uint256 _pid, address _to) external',
      'function withdrawAndHarvest(uint256 _pid, uint256 _amount) external',
      'function pendingSushi(uint256 _pid, address _user) external view returns (uint256)',
      'function poolInfo(uint256 _pid) external view returns (address lpToken, address rewarder, uint256 rewardDebt, uint256 rewardDebt)',
      'event Deposit(address indexed user, uint256 indexed pid, uint256 amount)',
      'event Withdraw(address indexed user, uint256 indexed pid, uint256 amount)',
      'event Harvest(address indexed user, uint256 indexed pid, uint256 amount)'
    ];

    // Create contract instance
    this.contract = this.createMockContract();
    this.address = this.contract.target as string;

    this.setupFunctions();
  }

  private createMockContract(): ethers.Contract {
    const mockContract = {
      target: ethers.getAddress(ethers.createAddress().toString()),
      interface: new ethers.Interface(this.abi),
      callStatic: async (method: string, ...args: any[]) => {
        return this.handleCall(method, args);
      },
      send: async (method: string, ...args: any[]) => {
        return this.handleTransaction(method, args);
      },
      queryFilter: async (event: string, fromBlock?: number, toBlock?: number) => {
        return this.handleQueryFilter(event, fromBlock, toBlock);
      },
      on: (event: string, listener: (...args: any[]) => void) => {
        // Mock event listener
      },
      off: (event: string, listener: (...args: any[]) => void) => {
        // Mock event listener removal
      }
    } as any;

    return mockContract;
  }

  private setupFunctions(): void {
    // Similar to MasterChef but simplified for brevity
    this.functions.set('poolInfo', {
      name: 'poolInfo',
      inputs: ['uint256'],
      outputs: ['address', 'address', 'uint256', 'uint256'],
      implementation: (pid: bigint) => {
        const poolInfo = this.state.get('pools') as Map<string, any>;
        const info = poolInfo.get(pid.toString()) || {
          lpToken: ethers.ZeroAddress,
          rewarder: ethers.ZeroAddress,
          rewardDebt: BigInt(0),
          rewardDebt: BigInt(0)
        };
        return [info.lpToken, info.rewarder, info.rewardDebt, info.rewardDebt];
      }
    });

    this.functions.set('pendingSushi', {
      name: 'pendingSushi',
      inputs: ['uint256', 'address'],
      outputs: ['uint256'],
      implementation: (pid: bigint, user: string) => {
        // Simplified pending rewards calculation
        return ethers.parseUnits('10', 18);
      }
    });

    this.functions.set('deposit', {
      name: 'deposit',
      inputs: ['uint256', 'uint256'],
      outputs: [],
      implementation: (pid: bigint, amount: bigint) => {
        // Mock deposit logic
        console.log(`Depositing ${amount} to pool ${pid}`);
        this.emitEvent('Deposit', [user, pid, amount]);
      }
    });

    this.functions.set('withdraw', {
      name: 'withdraw',
      inputs: ['uint256', 'uint256'],
      outputs: [],
      implementation: (pid: bigint, amount: bigint) => {
        // Mock withdraw logic
        console.log(`Withdrawing ${amount} from pool ${pid}`);
        this.emitEvent('Withdraw', [user, pid, amount]);
      }
    });

    this.functions.set('harvest', {
      name: 'harvest',
      inputs: ['uint256', 'address'],
      outputs: [],
      implementation: (pid: bigint, to: string) => {
        // Mock harvest logic
        console.log(`Harvesting from pool ${pid} to ${to}`);
        this.emitEvent('Harvest', [user, pid, ethers.parseUnits('5', 18)]);
      }
    });
  }

  private async handleCall(method: string, args: any[]): Promise<any> {
    const mockFunction = this.functions.get(method);
    if (!mockFunction) {
      throw new Error(`Function ${method} not found`);
    }
    return mockFunction.implementation(...args);
  }

  private async handleTransaction(method: string, args: any[]): Promise<any> {
    const result = await this.handleCall(method, args);
    return {
      hash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [method, JSON.stringify(args)])),
      wait: async () => ({
        to: this.address,
        from: this.deployer.address,
        gasUsed: BigInt(150000),
        gasPrice: ethers.parseUnits('20', 'gwei'),
        logs: [],
        status: 1,
        blockNumber: 1,
        transactionHash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [method, JSON.stringify(args)]))
      })
    };
  }

  private async handleQueryFilter(event: string, fromBlock?: number, toBlock?: number): Promise<any[]> {
    const events = this.events.filter(e => e.name === event);
    return events.map(e => ({
      address: this.address,
      args: e.args,
      blockNumber: e.blockNumber,
      transactionHash: e.transactionHash,
      timestamp: e.timestamp
    }));
  }

  private emitEvent(name: string, args: any[]): void {
    this.events.push({
      name,
      args,
      blockNumber: 1,
      transactionHash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [name, JSON.stringify(args)])),
      timestamp: new Date()
    });
  }
}

/**
 * PancakePool Mock (for V3)
 */
export class PancakePoolMock implements MockContract {
  contract: ethers.Contract;
  address: string;
  abi: any[];
  deployer: ethers.Wallet;
  state: Map<string, any>;
  events: MockEvent[];
  functions: Map<string, MockFunction>;
  token0: string;
  token1: string;
  fee: number;

  constructor(token0: string, token1: string, fee: number, deployer: ethers.Wallet) {
    this.deployer = deployer;
    this.token0 = token0;
    this.token1 = token1;
    this.fee = fee;
    this.state = new Map();
    this.events = [];
    this.functions = new Map();

    // Initialize state
    this.state.set('sqrtPriceX96', BigInt('79228162514264337593543950336'));
    this.state.set('liquidity', ethers.parseUnits('1000', 18));
    this.state.set('tick', 0);

    // Create ABI
    this.abi = [
      'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
      'function liquidity() external view returns (uint128)',
      'function fee() external view returns (uint24)',
      'function token0() external view returns (address)',
      'function token1() external view returns (address)',
      'function swap(address recipient, bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96, bytes calldata) external returns (int256 amount0, int256 amount1)',
      'function flash(address recipient, uint256 amount0, uint256 amount1, bytes calldata) external',
      'function increaseObservationCardinalityNext(uint16 observationCardinalityNext) external',
      'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
      'event Flash(address indexed sender, address indexed recipient, uint256 amount0, uint256 amount1, bytes paid0, bytes paid1)',
      'event IncreaseObservationCardinalityNext(uint16 observationCardinalityNext, uint16 observationCardinality)'
    ];

    // Create contract instance
    this.contract = this.createMockContract();
    this.address = this.contract.target as string;

    this.setupFunctions();
  }

  private createMockContract(): ethers.Contract {
    const mockContract = {
      target: ethers.getAddress(ethers.createAddress().toString()),
      interface: new ethers.Interface(this.abi),
      callStatic: async (method: string, ...args: any[]) => {
        return this.handleCall(method, args);
      },
      send: async (method: string, ...args: any[]) => {
        return this.handleTransaction(method, args);
      },
      queryFilter: async (event: string, fromBlock?: number, toBlock?: number) => {
        return this.handleQueryFilter(event, fromBlock, toBlock);
      },
      on: (event: string, listener: (...args: any[]) => void) => {
        // Mock event listener
      },
      off: (event: string, listener: (...args: any[]) => void) => {
        // Mock event listener removal
      }
    } as any;

    return mockContract;
  }

  private setupFunctions(): void {
    this.functions.set('slot0', {
      name: 'slot0',
      inputs: [],
      outputs: ['uint160', 'int24', 'uint16', 'uint16', 'uint16', 'uint8', 'bool'],
      implementation: () => [
        this.state.get('sqrtPriceX96'),
        this.state.get('tick'),
        0,
        0,
        0,
        this.fee,
        true
      ]
    });

    this.functions.set('liquidity', {
      name: 'liquidity',
      inputs: [],
      outputs: ['uint128'],
      implementation: () => this.state.get('liquidity')
    });

    this.functions.set('fee', {
      name: 'fee',
      inputs: [],
      outputs: ['uint24'],
      implementation: () => this.fee
    });

    this.functions.set('token0', {
      name: 'token0',
      inputs: [],
      outputs: ['address'],
      implementation: () => this.token0
    });

    this.functions.set('token1', {
      name: 'token1',
      inputs: [],
      outputs: ['address'],
      implementation: () => this.token1
    });

    this.functions.set('swap', {
      name: 'swap',
      inputs: ['address', 'bool', 'int256', 'uint160', 'bytes'],
      outputs: ['int256', 'int256'],
      implementation: (recipient: string, zeroForOne: boolean, amountSpecified: bigint, sqrtPriceLimitX96: bigint, calldata: string) => {
        // Simplified V3 swap calculation
        const amountOut = amountSpecified - BigInt(Math.floor(Number(amountSpecified) * 0.003)); // 0.3% fee

      if (zeroForOne) {
        return [-amountOut, amountSpecified];
      } else {
        return [amountSpecified, -amountOut];
      }

      // Emit swap event
      this.emitEvent('Swap', [
        this.deployer.address,
        recipient,
        zeroForOne ? -amountOut : amountSpecified,
        zeroForOne ? amountSpecified : -amountOut,
        this.state.get('sqrtPriceX96'),
        this.state.get('liquidity'),
        this.state.get('tick')
      ]);
    }
    });
  }

  private async handleCall(method: string, args: any[]): Promise<any> {
    const mockFunction = this.functions.get(method);
    if (!mockFunction) {
      throw new Error(`Function ${method} not found`);
    }
    return mockFunction.implementation(...args);
  }

  private async handleTransaction(method: string, args: any[]): Promise<any> {
    const result = await this.handleCall(method, args);
    return {
      hash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [method, JSON.stringify(args)])),
      wait: async () => ({
        to: this.address,
        from: this.deployer.address,
        gasUsed: BigInt(200000),
        gasPrice: ethers.parseUnits('20', 'gwei'),
        logs: [],
        status: 1,
        blockNumber: 1,
        transactionHash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [method, JSON.stringify(args)]))
      })
    };
  }

  private async handleQueryFilter(event: string, fromBlock?: number, toBlock?: number): Promise<any[]> {
    const events = this.events.filter(e => e.name === event);
    return events.map(e => ({
      address: this.address,
      args: e.args,
      blockNumber: e.blockNumber,
      transactionHash: e.transactionHash,
      timestamp: e.timestamp
    }));
  }

  private emitEvent(name: string, args: any[]): void {
    this.events.push({
      name,
      args,
      blockNumber: 1,
      transactionHash: ethers.keccak256(ethers.solidityPacked(['string', 'string'], [name, JSON.stringify(args)])),
      timestamp: new Date()
    });
  }
}

/**
 * PancakeSwap Mocks Manager
 */
export class PancakeSwapMocksManager {
  private mocks: PancakeSwapMocks;
  private deployer: ethers.Wallet;

  constructor(deployer: ethers.Wallet) {
    this.deployer = deployer;
    this.mocks = {
      router: {} as PancakeRouterMock,
      factory: {} as PancakeFactoryMock,
      masterChef: {} as MasterChefMock,
      masterChefV2: {} as MasterChefV2Mock,
      wbnb: {} as WBNBMock,
      tokens: new Map(),
      pairs: new Map(),
      pools: new Map()
    };
  }

  /**
   * Initialize all mocks
   */
  async initialize(): Promise<void> {
    console.log('🧪 Initializing PancakeSwap contract mocks...');

    // Deploy WBNB
    this.mocks.wbnb = new WBNBMock(this.deployer);
    console.log('✅ WBNB mock deployed');

    // Deploy Factory
    this.mocks.factory = new PancakeFactoryMock(this.deployer);
    console.log('✅ PancakeFactory mock deployed');

    // Deploy Router
    this.mocks.router = new PancakeRouterMock(this.mocks.factory, this.mocks.wbnb, this.deployer);
    console.log('✅ PancakeRouter mock deployed');

    // Deploy MasterChef
    const cakeToken = new ERC20Mock('PancakeSwap Token', 'CAKE', 18, '1000000000', this.deployer);
    this.mocks.tokens.set('CAKE', cakeToken);
    this.mocks.masterChef = new MasterChefMock(cakeToken, this.deployer);
    console.log('✅ MasterChef mock deployed');

    // Deploy MasterChefV2
    this.mocks.masterChefV2 = new MasterChefV2Mock(this.deployer);
    console.log('✅ MasterChefV2 mock deployed');

    // Deploy common test tokens
    await this.deployTestTokens();

    console.log('✅ PancakeSwap mocks initialized successfully');
  }

  /**
   * Get mock contract by name
   */
  getMock(name: keyof PancakeMocks): any {
    const mock = this.mocks[name];
    if (!mock) {
      throw new Error(`Mock ${name} not found`);
    }
    return mock;
  }

  /**
   * Get ERC20 token mock
   */
  getToken(symbol: string): ERC20Mock {
    const token = this.mocks.tokens.get(symbol);
    if (!token) {
      throw new Error(`Token mock ${symbol} not found`);
    }
    return token;
  }

  /**
   * Get pair mock
   */
  getPair(tokenA: string, tokenB: string): PancakePairMock | null {
    const pairKey = [tokenA, tokenB].sort().join('-');
    return this.mocks.pairs.get(pairKey) || null;
  }

  /**
   * Get pool mock
   */
  getPool(tokenA: string, tokenB: string, fee: number): PancakePoolMock | null {
    const poolKey = [tokenA, tokenB, fee.toString()].join('-');
    return this.mocks.pools.get(poolKey) || null;
  }

  /**
   * Create a new pair
   */
  createPair(tokenA: string, tokenB: string): PancakePairMock {
    const existingPair = this.getPair(tokenA, tokenB);
    if (existingPair) {
      return existingPair;
    }

    const pair = new PancakePairMock(tokenA, tokenB, this.deployer);
    const pairKey = [tokenA, tokenB].sort().join('-');
    this.mocks.pairs.set(pairKey, pair);

    console.log(`📦 Created mock pair: ${tokenA}/${tokenB}`);
    return pair;
  }

  /**
   * Create a new pool
   */
  createPool(tokenA: string, tokenB: string, fee: number): PancakePoolMock {
    const existingPool = this.getPool(tokenA, tokenB, fee);
    if (existingPool) {
      return existingPool;
    }

    const pool = new PancakePoolMock(tokenA, tokenB, fee, this.deployer);
    const poolKey = [tokenA, tokenB, fee.toString()].sort().join('-');
    this.mocks.pools.set(poolKey, pool);

    console.log(`📦 Created mock pool: ${tokenA}/${tokenB} (fee: ${fee * 10000}bps)`);
    return pool;
  }

  /**
   * Get all deployed contracts
   */
  getAllContracts(): { [key: string]: any } {
    return {
      router: this.mocks.router.contract,
      factory: this.mocks.factory.contract,
      masterChef: this.mocks.masterChef.contract,
      masterChefV2: this.mocks.masterChefV2.contract,
      wbnb: this.mocks.wbnb.contract,
      tokens: Object.fromEntries(
        Array.from(this.mocks.tokens.entries()).map(([symbol, token]) => [symbol, token.contract])
      ),
      pairs: Object.fromEntries(
        Array.from(this.mocks.pairs.entries()).map(([key, pair]) => [key, pair.contract])
      ),
      pools: Object.fromEntries(
        Array.from(this.mocks.pools.entries()).map(([key, pool]) => [key, pool.contract])
      )
    };
  }

  /**
   * Clean up all mocks
   */
  cleanup(): void {
    this.mocks = {
      router: {} as PancakeRouterMock,
      factory: {} as PancakeFactoryMock,
      masterChef: {} as MasterChefMock,
      masterChefV2: {} as MasterChefV2Mock,
      wbnb: {} as WBNBMock,
      tokens: new Map(),
      pairs: new Map(),
      pools: new Map()
    };
    console.log('🧹 PancakeSwap mocks cleaned up');
  }

  /**
   * Reset all mock states
   */
  reset(): void {
    // Reset events for all contracts
    for (const [name, mock] of Object.entries(this.mocks)) {
      if (mock && 'events' in mock) {
        mock.events = [];
      }
    }

    // Reset state for all contracts
    for (const [name, mock] of Object.entries(this.mocks)) {
      if (mock && 'state' in mock) {
        // Re-initialize state if needed
        if (name === 'factory') {
          mock.state.clear();
          mock.state.set('feeTo', this.deployer.address);
          mock.state.set('feeToSetter', this.deployer.address);
        }
      }
    }

    console.log('🔄 PancakeSwap mocks reset');
  }

  private async deployTestTokens(): Promise<void> {
    const tokens = [
      { name: 'Tether USD', symbol: 'USDT', decimals: 6, supply: '1000000000' },
      { name: 'USD Coin', symbol: 'USDC', symbol: 'USDC', decimals: 6, supply: '1000000000' },
      { name: 'Binance USD', symbol: 'BUSD', symbol: 'BUSD', decimals: 18, supply: '1000000000' },
      { name: 'Ethereum', symbol: 'ETH', symbol: 'ETH', decimals: 18, supply: '1000000' }
    ];

    for (const token of tokens) {
      const mockToken = new ERC20Mock(token.name, token.symbol, token.decimals, token.supply, this.deployer);
      this.mocks.tokens.set(token.symbol, mockToken);
      console.log(`📦 Deployed mock token: ${token.symbol}`);
    }
  }
}

/**
 * Export default mocks manager
 */
export default PancakeSwapMocksManager;