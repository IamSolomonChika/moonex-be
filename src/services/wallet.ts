import { PrivyClient } from '@privy-io/server-auth';
import { config } from '../config';
import { User } from './auth';
import { getDatabase, executeTransaction } from '../config/database';
import logger from '../utils/logger';
import type { Wallet as DbWallet, Transaction as DbTransaction } from '@prisma/client';

/**
 * Wallet interface
 */
export interface Wallet {
  id: string;
  address: string;
  userId: string;
  type: string;
  chainId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Token balance interface
 */
export interface TokenBalance {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  balance: string;
  decimals: number;
}

/**
 * Transaction interface
 */
export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
  blockNumber?: number;
}

/**
 * Gas fee estimate interface
 */
export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedCost: string;
}

/**
 * Initialize Privy client
 */
export const createPrivyClient = (): PrivyClient => {
  return new PrivyClient(config.privy.appId, config.privy.appSecret);
};

/**
 * Create embedded wallet for user
 */
export const createEmbeddedWallet = async (user: User): Promise<{ success: boolean; wallet?: Wallet; error?: string }> => {
  try {
    const privy = createPrivyClient();
    const db = getDatabase();
    
    // Create embedded wallet using Privy
    // Note: This is a simplified implementation
    // In a real implementation, you would use Privy's wallet creation API
    const walletAddress = `0x${Math.random().toString(16).substr(2, 40)}`;
    
    // Check if wallet already exists for this user
    const existingWallet = await db.wallet.findFirst({
      where: {
        userId: user.id,
        address: walletAddress
      }
    });
    
    if (existingWallet) {
      return {
        success: false,
        error: 'Wallet already exists for this user'
      };
    }
    
    // Create wallet in database
    const newWallet = await db.wallet.create({
      data: {
        userId: user.id,
        address: walletAddress,
        type: 'embedded',
        chainId: '1', // Ethereum mainnet
        isActive: true
      }
    });
    
    logger.info(`Embedded wallet created for user ${user.id}: ${walletAddress}`);
    
    const wallet: Wallet = {
      id: newWallet.id,
      address: newWallet.address,
      userId: newWallet.userId,
      type: newWallet.type,
      chainId: newWallet.chainId,
      isActive: newWallet.isActive,
      createdAt: newWallet.createdAt,
      updatedAt: newWallet.updatedAt
    };
    
    return {
      success: true,
      wallet
    };
  } catch (error) {
    logger.error({ msg: 'Wallet creation error:', error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: 'Failed to create embedded wallet'
    };
  }
};

/**
 * Get wallet information
 */
export const getWalletInfo = async (walletAddress: string, user: User): Promise<{ success: boolean; wallet?: Wallet; error?: string }> => {
  try {
    const db = getDatabase();
    
    // Get wallet from database
    const wallet = await db.wallet.findFirst({
      where: {
        address: walletAddress.toLowerCase(),
        userId: user.id,
        isActive: true
      }
    });
    
    if (!wallet) {
      return {
        success: false,
        error: 'Wallet not found or access denied'
      };
    }
    
    const walletInfo: Wallet = {
      id: wallet.id,
      address: wallet.address,
      userId: wallet.userId,
      type: wallet.type,
      chainId: wallet.chainId,
      isActive: wallet.isActive,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt
    };
    
    return {
      success: true,
      wallet: walletInfo
    };
  } catch (error) {
    logger.error({ msg: 'Get wallet info error:', error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: 'Failed to get wallet information'
    };
  }
};

/**
 * Get wallet balance
 */
export const getWalletBalance = async (walletAddress: string, user: User): Promise<{ success: boolean; balances?: TokenBalance[]; error?: string }> => {
  try {
    const db = getDatabase();
    
    // Verify user owns the wallet
    const wallet = await db.wallet.findFirst({
      where: {
        address: walletAddress.toLowerCase(),
        userId: user.id,
        isActive: true
      }
    });
    
    if (!wallet) {
      return {
        success: false,
        error: 'Wallet not found or access denied'
      };
    }
    
    // Get wallet balance from Privy
    // Note: This is a simplified implementation
    // In a real implementation, you would use Privy's balance API
    
    // Simulate token balances
    const balances: TokenBalance[] = [
      {
        tokenAddress: '0x0000000000000000000000000000000000000000',
        tokenSymbol: 'ETH',
        tokenName: 'Ethereum',
        balance: '1.5',
        decimals: 18
      },
      {
        tokenAddress: '0x1234567890123456789012345678901234567890',
        tokenSymbol: 'USDC',
        tokenName: 'USD Coin',
        balance: '1000.0',
        decimals: 6
      }
    ];
    
    return {
      success: true,
      balances
    };
  } catch (error) {
    logger.error({ msg: 'Get wallet balance error:', error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: 'Failed to get wallet balance'
    };
  }
};

/**
 * Sign transaction
 */
export const signTransaction = async (
  walletAddress: string,
  to: string,
  value: string,
  data: string = '0x',
  user: User
): Promise<{ success: boolean; signature?: string; error?: string }> => {
  try {
    const privy = createPrivyClient();
    
    // Sign transaction using Privy
    // Note: This is a simplified implementation
    // In a real implementation, you would use Privy's signing API
    
    // Verify user owns the wallet
    const userWallets = user.linkedAccounts?.filter(account => 
      account.type === 'wallet' && account.address?.toLowerCase() === walletAddress.toLowerCase()
    ) || [];
    
    if (userWallets.length === 0) {
      return {
        success: false,
        error: 'Wallet not found or access denied'
      };
    }
    
    // Simulate transaction signing
    const signature = `0x${Math.random().toString(16).substr(2, 130)}`;
    
    return {
      success: true,
      signature
    };
  } catch (error) {
    console.error('Sign transaction error:', error);
    return {
      success: false,
      error: 'Failed to sign transaction'
    };
  }
};

/**
 * Send transaction
 */
export const sendTransaction = async (
  walletAddress: string,
  to: string,
  value: string,
  tokenSymbol: string = 'ETH',
  data: string = '0x',
  user: User
): Promise<{ success: boolean; transactionHash?: string; error?: string }> => {
  try {
    const db = getDatabase();
    
    // Verify user owns the wallet
    const wallet = await db.wallet.findFirst({
      where: {
        address: walletAddress.toLowerCase(),
        userId: user.id,
        isActive: true
      }
    });
    
    if (!wallet) {
      return {
        success: false,
        error: 'Wallet not found or access denied'
      };
    }
    
    // Send transaction using Privy
    // Note: This is a simplified implementation
    // In a real implementation, you would use Privy's transaction API
    
    // Simulate transaction sending
    const transactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;
    
    // Store transaction in database
    await executeTransaction(async (tx) => {
      await tx.transaction.create({
        data: {
          userId: user.id,
          walletId: wallet.id,
          hash: transactionHash,
          fromAddress: walletAddress,
          toAddress: to,
          amount: value,
          tokenSymbol,
          tokenDecimals: tokenSymbol === 'ETH' ? 18 : 6,
          status: 'pending'
        }
      });
    });
    
    logger.info(`Transaction sent from ${walletAddress} to ${to}: ${transactionHash}`);
    
    return {
      success: true,
      transactionHash
    };
  } catch (error) {
    logger.error({ msg: 'Send transaction error:', error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: 'Failed to send transaction'
    };
  }
};

/**
 * Get transaction history
 */
export const getTransactionHistory = async (
  walletAddress: string,
  user: User,
  page: number = 1,
  limit: number = 10
): Promise<{ success: boolean; transactions?: Transaction[]; total?: number; error?: string }> => {
  try {
    const db = getDatabase();
    
    // Verify user owns the wallet
    const wallet = await db.wallet.findFirst({
      where: {
        address: walletAddress.toLowerCase(),
        userId: user.id,
        isActive: true
      }
    });
    
    if (!wallet) {
      return {
        success: false,
        error: 'Wallet not found or access denied'
      };
    }
    
    // Get transactions from database
    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where: {
          walletId: wallet.id
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.transaction.count({
        where: {
          walletId: wallet.id
        }
      })
    ]);
    
    // Format transactions
    const formattedTransactions: Transaction[] = transactions.map(tx => ({
      hash: tx.hash,
      from: tx.fromAddress,
      to: tx.toAddress,
      value: tx.amount,
      gasUsed: tx.gasUsed || '0',
      gasPrice: tx.gasPrice || '0',
      status: tx.status as 'pending' | 'confirmed' | 'failed',
      timestamp: tx.createdAt,
      blockNumber: tx.blockNumber ? Number(tx.blockNumber) : undefined
    }));
    
    return {
      success: true,
      transactions: formattedTransactions,
      total
    };
  } catch (error) {
    logger.error({ msg: 'Get transaction history error:', error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: 'Failed to get transaction history'
    };
  }
};

/**
 * Estimate gas fees
 */
export const estimateGasFees = async (
  to: string,
  value: string,
  tokenSymbol: string = 'ETH',
  data: string = '0x'
): Promise<{ success: boolean; estimate?: GasEstimate; error?: string }> => {
  try {
    const privy = createPrivyClient();
    
    // Estimate gas fees using Privy
    // Note: This is a simplified implementation
    // In a real implementation, you would use Privy's gas estimation API
    
    // Simulate gas estimation
    const gasLimit = '21000';
    const gasPrice = '20000000000';
    const estimatedCost = (parseInt(gasLimit) * parseInt(gasPrice)).toString();
    
    const estimate: GasEstimate = {
      gasLimit,
      gasPrice,
      estimatedCost
    };
    
    logger.info(`Gas estimated for transaction to ${to}: ${estimatedCost} wei`);
    
    return {
      success: true,
      estimate
    };
  } catch (error) {
    logger.error({ msg: 'Estimate gas fees error:', error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: 'Failed to estimate gas fees'
    };
  }
};

/**
 * Get user wallets
 */
export const getUserWallets = async (user: User): Promise<{ success: boolean; wallets?: Wallet[]; error?: string }> => {
  try {
    const db = getDatabase();
    
    const wallets = await db.wallet.findMany({
      where: {
        userId: user.id,
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    const formattedWallets: Wallet[] = wallets.map(wallet => ({
      id: wallet.id,
      address: wallet.address,
      userId: wallet.userId,
      type: wallet.type,
      chainId: wallet.chainId,
      isActive: wallet.isActive,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt
    }));
    
    return {
      success: true,
      wallets: formattedWallets
    };
  } catch (error) {
    logger.error({ msg: 'Get user wallets error:', error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: 'Failed to get user wallets'
    };
  }
};

/**
 * Update transaction status
 */
export const updateTransactionStatus = async (
  transactionHash: string,
  status: 'pending' | 'completed' | 'failed',
  blockNumber?: bigint,
  gasUsed?: string,
  gasPrice?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const db = getDatabase();
    
    const updateData: any = {
      status,
      ...(blockNumber && { blockNumber }),
      ...(gasUsed && { gasUsed }),
      ...(gasPrice && { gasPrice }),
      ...(status === 'completed' && { confirmedAt: new Date() })
    };
    
    await db.transaction.update({
      where: {
        hash: transactionHash
      },
      data: updateData
    });
    
    logger.info(`Transaction ${transactionHash} updated to status: ${status}`);
    
    return {
      success: true
    };
  } catch (error) {
    logger.error({ msg: 'Update transaction status error:', error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: 'Failed to update transaction status'
    };
  }
};