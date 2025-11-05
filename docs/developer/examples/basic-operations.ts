/**
 * 📚 Basic Viem Operations Examples
 *
 * This file contains practical examples of common Viem operations
 * for the BSC DEX backend. Use these as reference implementations.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  WebSocket,
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

// Configuration
const RPC_URL = 'https://bsc-dataseed1.binance.org';
const WS_URL = 'wss://bsc-ws-node.nariox.org:443';

// Common addresses on BSC
const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address;
const BUSD_ADDRESS = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address;
const PANCAKE_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as Address;

// ERC-20 ABI (simplified for examples)
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
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

/**
 * Example 1: Basic Client Setup
 */
export function setupClients() {
  console.log('🔧 Setting up Viem clients...');

  // Public client for read operations
  const publicClient = createPublicClient({
    chain: bsc,
    transport: http(RPC_URL)
  });

  // WebSocket client for real-time updates
  const wsClient = createPublicClient({
    chain: bsc,
    transport: WebSocket(WS_URL)
  });

  // Wallet client for write operations (requires private key)
  const account = privateKeyToAccount('0x_YOUR_PRIVATE_KEY_HERE');
  const walletClient = createWalletClient({
    account,
    chain: bsc,
    transport: http(RPC_URL)
  });

  console.log('✅ Clients initialized successfully');
  return { publicClient, wsClient, walletClient };
}

/**
 * Example 2: Address Validation
 */
export function validateAddressExample(address: string): Address {
  console.log(`🔍 Validating address: ${address}`);

  if (!isAddress(address)) {
    throw new Error(`Invalid address: ${address}`);
  }

  const checksummed = getAddress(address);
  console.log(`✅ Valid address (checksummed): ${checksummed}`);
  return checksummed;
}

/**
 * Example 3: Balance Queries
 */
export async function balanceQueriesExample(publicClient: PublicClient) {
  console.log('💰 Querying balances...');

  try {
    const userAddress = '0x742d35Cc6634C0532925a3b8D4E7E0E0e9e0dF3b' as Address;

    // Get BNB balance
    const bnbBalance = await publicClient.getBalance({
      address: userAddress
    });
    console.log(`📊 BNB Balance: ${formatUnits(bnbBalance, 18)} BNB`);

    // Get BUSD balance
    const busdBalance = await publicClient.readContract({
      address: BUSD_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [userAddress]
    });
    console.log(`📊 BUSD Balance: ${formatUnits(busdBalance, 18)} BUSD`);

    // Get WBNB balance
    const wbnbBalance = await publicClient.readContract({
      address: WBNB_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [userAddress]
    });
    console.log(`📊 WBNB Balance: ${formatUnits(wbnbBalance, 18)} WBNB`);

    return { bnbBalance, busdBalance, wbnbBalance };
  } catch (error) {
    console.error('❌ Error querying balances:', error);
    throw error;
  }
}

/**
 * Example 4: Token Information
 */
export async function getTokenInfoExample(publicClient: PublicClient, tokenAddress: Address) {
  console.log(`🔍 Getting token info for: ${tokenAddress}`);

  try {
    const [name, symbol, decimals, totalSupply] = await publicClient.multicall({
      contracts: [
        {
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'name'
        },
        {
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'symbol'
        },
        {
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'decimals'
        },
        {
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'totalSupply'
        }
      ]
    });

    const tokenInfo = {
      address: tokenAddress,
      name: name.result || 'Unknown Token',
      symbol: symbol.result || 'UNKNOWN',
      decimals: decimals.result || 18,
      totalSupply: totalSupply.result || 0n
    };

    console.log('📋 Token Information:');
    console.log(`  Name: ${tokenInfo.name}`);
    console.log(`  Symbol: ${tokenInfo.symbol}`);
    console.log(`  Decimals: ${tokenInfo.decimals}`);
    console.log(`  Total Supply: ${formatUnits(tokenInfo.totalSupply, tokenInfo.decimals)}`);

    return tokenInfo;
  } catch (error) {
    console.error('❌ Error getting token info:', error);
    throw error;
  }
}

/**
 * Example 5: Transaction Operations
 */
export async function transactionExample(walletClient: WalletClient, publicClient: PublicClient) {
  console.log('📤 Performing transaction...');

  try {
    const recipient = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address;
    const amount = parseUnits('0.01', 18); // 0.01 BNB

    console.log(`💸 Sending ${formatUnits(amount, 18)} BNB to ${recipient}`);

    // Send transaction
    const hash = await walletClient.sendTransaction({
      to: recipient,
      value: amount
    });

    console.log(`📝 Transaction submitted: ${hash}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 2
    });

    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`⛽ Gas used: ${receipt.gasUsed}`);

    return receipt;
  } catch (error) {
    console.error('❌ Transaction failed:', error);

    if (error instanceof BaseError) {
      console.error(`Error code: ${error.code}`);
      console.error(`Error message: ${error.message}`);
    }

    throw error;
  }
}

/**
 * Example 6: ERC-20 Transfer
 */
export async function erc20TransferExample(walletClient: WalletClient, publicClient: PublicClient) {
  console.log('🪙 Performing ERC-20 transfer...');

  try {
    const recipient = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address;
    const amount = parseUnits('100', 18); // 100 tokens

    console.log(`💸 Sending ${formatUnits(amount, 18)} BUSD to ${recipient}`);

    // First check balance
    const senderBalance = await publicClient.readContract({
      address: BUSD_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [walletClient.account.address]
    });

    console.log(`📊 Current BUSD balance: ${formatUnits(senderBalance, 18)}`);

    if (senderBalance < amount) {
      throw new Error('Insufficient balance');
    }

    // Transfer tokens
    const hash = await walletClient.writeContract({
      address: BUSD_ADDRESS,
      abi: [
        {
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ],
          name: 'transfer',
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
          type: 'function'
        }
      ],
      functionName: 'transfer',
      args: [recipient, amount]
    });

    console.log(`📝 Transfer submitted: ${hash}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    console.log(`✅ Transfer confirmed!`);

    return receipt;
  } catch (error) {
    console.error('❌ Transfer failed:', error);
    throw error;
  }
}

/**
 * Example 7: Event Listening
 */
export function eventListeningExample(publicClient: PublicClient) {
  console.log('👂 Setting up event listener...');

  // Listen for Transfer events on BUSD
  const unwatch = publicClient.watchEvent({
    address: BUSD_ADDRESS,
    abi: [
      {
        anonymous: false,
        inputs: [
          { indexed: true, name: 'from', type: 'address' },
          { indexed: true, name: 'to', type: 'address' },
          { indexed: false, name: 'value', type: 'uint256' }
        ],
        name: 'Transfer',
        type: 'event'
      }
    ],
    eventName: 'Transfer',
    onLogs: (logs) => {
      console.log('📡 New Transfer events detected:');
      logs.forEach((log) => {
        console.log(`  From: ${log.args.from}`);
        console.log(`  To: ${log.args.to}`);
        console.log(`  Value: ${formatUnits(log.args.value!, 18)} BUSD`);
        console.log(`  Transaction: ${log.transactionHash}`);
        console.log('---');
      });
    }
  });

  console.log('✅ Event listener active. Press Ctrl+C to stop.');

  // Return cleanup function
  return () => {
    console.log('🛑 Stopping event listener...');
    unwatch();
  };
}

/**
 * Example 8: Batch Operations
 */
export async function batchOperationsExample(publicClient: PublicClient) {
  console.log('🔄 Performing batch operations...');

  try {
    const addresses = [
      '0x742d35Cc6634C0532925a3b8D4E7E0E0e9e0dF3b',
      '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      '0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed'
    ] as Address[];

    // Get BNB balances for multiple addresses
    const balanceCalls = addresses.map(address => ({
      address: '0x0000000000000000000000000000000000000000' as Address, // Zero address for native balance
      abi: [
        {
          inputs: [{ name: 'account', type: 'address' }],
          name: 'getBalance',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function'
        }
      ],
      functionName: 'getBalance',
      args: [address]
    }));

    // Note: For native ETH/BNB balance, use getBalance directly
    const balances = await Promise.all(
      addresses.map(address => publicClient.getBalance({ address }))
    );

    console.log('📊 Batch balance results:');
    addresses.forEach((address, index) => {
      console.log(`  ${address}: ${formatUnits(balances[index], 18)} BNB`);
    });

    return balances;
  } catch (error) {
    console.error('❌ Batch operation failed:', error);
    throw error;
  }
}

/**
 * Example 9: Error Handling
 */
export async function errorHandlingExample(publicClient: PublicClient) {
  console.log('⚠️ Demonstrating error handling...');

  try {
    // Try to get info for invalid address
    await publicClient.readContract({
      address: '0x0000000000000000000000000000000000000000' as Address,
      abi: ERC20_ABI,
      functionName: 'name'
    });
  } catch (error) {
    console.log('🔍 Caught error:');

    if (error instanceof ContractFunctionExecutionError) {
      console.log(`  Type: Contract Function Execution Error`);
      console.log(`  Message: ${error.message}`);
      console.log(`  Function Name: ${error.functionName}`);
    } else if (error instanceof BaseError) {
      console.log(`  Type: Viem Base Error`);
      console.log(`  Code: ${error.code}`);
      console.log(`  Message: ${error.message}`);

      // Check for common error codes
      switch (error.code) {
        case 'CALL_EXCEPTION':
          console.log('  Details: Contract call failed (possibly invalid contract or function)');
          break;
        case 'NETWORK_ERROR':
          console.log('  Details: Network connection failed');
          break;
        default:
          console.log(`  Details: Unknown error code: ${error.code}`);
      }
    } else {
      console.log(`  Type: Generic Error`);
      console.log(`  Message: ${error.message}`);
    }
  }
}

/**
 * Example 10: Unit Conversion Utilities
 */
export function unitConversionExamples() {
  console.log('🔄 Unit conversion examples...');

  // ETH/BNB conversions
  const ethAmount = '1.5';
  const ethInWei = parseUnits(ethAmount, 18);
  console.log(`💰 ${ethAmount} ETH = ${ethInWei} wei`);

  const weiAmount = 1500000000000000000n;
  const weiInEth = formatUnits(weiAmount, 18);
  console.log(`💰 ${weiAmount} wei = ${weiInEth} ETH`);

  // Token conversions (6 decimals like USDT)
  const usdtAmount = '100.25';
  const usdtInBaseUnits = parseUnits(usdtAmount, 6);
  console.log(`💰 ${usdtAmount} USDT = ${usdtInBaseUnits} base units`);

  const usdtBaseUnits = 100250000n;
  const usdtFormatted = formatUnits(usdtBaseUnits, 6);
  console.log(`💰 ${usdtBaseUnits} base units = ${usdtFormatted} USDT`);

  // Percentage calculations
  const percentage = (amount: bigint, percent: number): bigint => {
    return (amount * BigInt(Math.floor(percent * 10000))) / BigInt(10000);
  };

  const amount = 1000000000000000000n; // 1 token
  const fivePercent = percentage(amount, 5); // 5%
  console.log(`💰 5% of ${formatUnits(amount, 18)} tokens = ${formatUnits(fivePercent, 18)} tokens`);
}

/**
 * Main execution function
 */
export async function runAllExamples() {
  console.log('🚀 Running Viem examples...\n');

  try {
    // Setup
    const { publicClient, wsClient, walletClient } = setupClients();

    // Basic operations
    const validAddress = validateAddressExample(WBNB_ADDRESS);

    // Balance queries
    await balanceQueriesExample(publicClient);

    // Token information
    await getTokenInfoExample(publicClient, validAddress);

    // Batch operations
    await batchOperationsExample(publicClient);

    // Unit conversions
    unitConversionExamples();

    // Error handling
    await errorHandlingExample(publicClient);

    // Note: Transaction examples require actual private key
    console.log('\n📝 Note: Transaction examples require valid private key');
    console.log('   Uncomment the following lines to test transactions:');
    console.log('   await transactionExample(walletClient, publicClient);');
    console.log('   await erc20TransferExample(walletClient, publicClient);');

    // Event listening (commented out as it runs indefinitely)
    console.log('\n📝 Note: Event listening example available but commented out');
    console.log('   Uncomment to test real-time event monitoring');

    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('\n❌ Example execution failed:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}