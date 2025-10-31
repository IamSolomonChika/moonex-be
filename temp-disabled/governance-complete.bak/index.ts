import { getDatabase } from '../../config/database';
import logger from '../../utils/logger';
import { Decimal } from 'decimal.js';

/**
 * Token Balance interface
 */
export interface TokenBalance {
  id: string;
  userId: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  balance: string;
  lockedBalance: string;
  delegatedBalance: string;
  receivedDelegated: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Vote Delegation interface
 */
export interface VoteDelegation {
  id: string;
  delegatorId: string;
  delegateId: string;
  tokenAmount: string;
  isActive: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * Treasury interface
 */
export interface Treasury {
  id: string;
  name: string;
  description?: string;
  totalBalance: string;
  availableBalance: string;
  lockedBalance: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Treasury Transaction interface
 */
export interface TreasuryTransaction {
  id: string;
  treasuryId: string;
  userId?: string;
  type: 'deposit' | 'withdrawal' | 'allocation' | 'refund';
  amount: string;
  tokenSymbol: string;
  description?: string;
  metadata?: Record<string, any>;
  txHash?: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Treasury Allocation interface
 */
export interface TreasuryAllocation {
  id: string;
  treasuryId: string;
  proposalId: string;
  amount: string;
  tokenSymbol: string;
  recipient: string;
  purpose: string;
  status: 'pending' | 'approved' | 'executed' | 'refunded';
  txHash?: string;
  approvedBy: string;
  createdAt: Date;
  executedAt?: Date;
}

/**
 * Proposal Discussion interface
 */
export interface ProposalDiscussion {
  id: string;
  proposalId: string;
  userId: string;
  content: string;
  isReply: boolean;
  parentId?: string;
  upvotes: number;
  downvotes: number;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Governance Token Service class
 */
export class GovernanceTokenService {
  /**
   * Get user's token balance
   */
  async getTokenBalance(userId: string, tokenAddress?: string): Promise<TokenBalance | null> {
    try {
      const db = getDatabase();

      const whereClause: any = { userId };
      if (tokenAddress) {
        whereClause.tokenAddress = tokenAddress;
      }

      const balance = await db.tokenBalance.findFirst({
        where: whereClause
      });

      return balance;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), userId }, 'Failed to get token balance');
      return null;
    }
  }

  /**
   * Update user's token balance
   */
  async updateTokenBalance(
    userId: string,
    tokenAddress: string,
    tokenSymbol: string,
    tokenDecimals: number,
    amount: string,
    type: 'add' | 'subtract' = 'add'
  ): Promise<{ success: boolean; balance?: TokenBalance; error?: string }> {
    try {
      const db = getDatabase();

      const currentBalance = await this.getTokenBalance(userId, tokenAddress);

      let newBalance: Decimal;
      if (currentBalance) {
        const current = new Decimal(currentBalance.balance);
        const change = new Decimal(amount);

        if (type === 'add') {
          newBalance = current.add(change);
        } else {
          if (current.lt(change)) {
            return {
              success: false,
              error: 'Insufficient balance'
            };
          }
          newBalance = current.sub(change);
        }

        const updatedBalance = await db.tokenBalance.update({
          where: { id: currentBalance.id },
          data: {
            balance: newBalance.toString(),
            updatedAt: new Date()
          }
        });

        return {
          success: true,
          balance: updatedBalance
        };
      } else {
        // Create new balance record
        const newBalanceRecord = await db.tokenBalance.create({
          data: {
            userId,
            tokenAddress,
            tokenSymbol,
            tokenDecimals,
            balance: type === 'add' ? amount : '0',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });

        return {
          success: true,
          balance: newBalanceRecord
        };
      }
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), userId }, 'Failed to update token balance');
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Distribute tokens to users (airdrop)
   */
  async distributeTokens(
    recipients: Array<{ userId: string; amount: string }>,
    tokenAddress: string,
    tokenSymbol: string,
    tokenDecimals: number
  ): Promise<{ success: boolean; distributed: number; errors: string[] }> {
    try {
      const db = getDatabase();
      const errors: string[] = [];
      let distributed = 0;

      for (const recipient of recipients) {
        const result = await this.updateTokenBalance(
          recipient.userId,
          tokenAddress,
          tokenSymbol,
          tokenDecimals,
          recipient.amount,
          'add'
        );

        if (result.success) {
          distributed++;
        } else {
          errors.push(`Failed to distribute to user ${recipient.userId}: ${result.error}`);
        }
      }

      return {
        success: distributed === recipients.length,
        distributed,
        errors
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to distribute tokens');
      return {
        success: false,
        distributed: 0,
        errors: ['Internal server error']
      };
    }
  }

  /**
   * Lock tokens for voting
   */
  async lockTokens(userId: string, amount: string): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getDatabase();

      const balance = await this.getTokenBalance(userId);
      if (!balance) {
        return {
          success: false,
          error: 'Token balance not found'
        };
      }

      const availableBalance = new Decimal(balance.balance).sub(new Decimal(balance.lockedBalance));
      const lockAmount = new Decimal(amount);

      if (availableBalance.lt(lockAmount)) {
        return {
          success: false,
          error: 'Insufficient available balance'
        };
      }

      await db.tokenBalance.update({
        where: { id: balance.id },
        data: {
          lockedBalance: new Decimal(balance.lockedBalance).add(lockAmount).toString(),
          updatedAt: new Date()
        }
      });

      return { success: true };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), userId }, 'Failed to lock tokens');
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Unlock tokens
   */
  async unlockTokens(userId: string, amount: string): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getDatabase();

      const balance = await this.getTokenBalance(userId);
      if (!balance) {
        return {
          success: false,
          error: 'Token balance not found'
        };
      }

      const lockedBalance = new Decimal(balance.lockedBalance);
      const unlockAmount = new Decimal(amount);

      if (lockedBalance.lt(unlockAmount)) {
        return {
          success: false,
          error: 'Insufficient locked balance'
        };
      }

      await db.tokenBalance.update({
        where: { id: balance.id },
        data: {
          lockedBalance: lockedBalance.sub(unlockAmount).toString(),
          updatedAt: new Date()
        }
      });

      return { success: true };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), userId }, 'Failed to unlock tokens');
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }
}

/**
 * Vote Delegation Service class
 */
export class VoteDelegationService {
  /**
   * Delegate votes to another user
   */
  async delegateVotes(
    delegatorId: string,
    delegateId: string,
    tokenAmount: string,
    expiresAt?: Date
  ): Promise<{ success: boolean; delegation?: VoteDelegation; error?: string }> {
    try {
      const db = getDatabase();

      // Check if delegator has enough tokens
      const tokenService = new GovernanceTokenService();
      const balance = await tokenService.getTokenBalance(delegatorId);

      if (!balance) {
        return {
          success: false,
          error: 'Token balance not found'
        };
      }

      const availableBalance = new Decimal(balance.balance)
        .sub(new Decimal(balance.lockedBalance))
        .sub(new Decimal(balance.delegatedBalance));

      const delegationAmount = new Decimal(tokenAmount);
      if (availableBalance.lt(delegationAmount)) {
        return {
          success: false,
          error: 'Insufficient available tokens for delegation'
        };
      }

      // Check if delegation already exists
      const existingDelegation = await db.voteDelegation.findFirst({
        where: {
          delegatorId,
          delegateId,
          isActive: true
        }
      });

      if (existingDelegation) {
        // Update existing delegation
        const updatedDelegation = await db.voteDelegation.update({
          where: { id: existingDelegation.id },
          data: {
            tokenAmount: new Decimal(existingDelegation.tokenAmount).add(delegationAmount).toString(),
            expiresAt,
            updatedAt: new Date()
          }
        });

        // Update delegated balance
        await db.tokenBalance.update({
          where: { id: balance.id },
          data: {
            delegatedBalance: new Decimal(balance.delegatedBalance).add(delegationAmount).toString(),
            updatedAt: new Date()
          }
        });

        return {
          success: true,
          delegation: updatedDelegation
        };
      } else {
        // Create new delegation
        const delegation = await db.voteDelegation.create({
          data: {
            delegatorId,
            delegateId,
            tokenAmount,
            isActive: true,
            expiresAt,
            createdAt: new Date()
          }
        });

        // Update delegated balance
        await db.tokenBalance.update({
          where: { id: balance.id },
          data: {
            delegatedBalance: new Decimal(balance.delegatedBalance).add(delegationAmount).toString(),
            updatedAt: new Date()
          }
        });

        return {
          success: true,
          delegation
        };
      }
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), delegatorId }, 'Failed to delegate votes');
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Cancel vote delegation
   */
  async cancelDelegation(delegationId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getDatabase();

      const delegation = await db.voteDelegation.findFirst({
        where: { id: delegationId, delegatorId: userId, isActive: true }
      });

      if (!delegation) {
        return {
          success: false,
          error: 'Delegation not found'
        };
      }

      // Get user's token balance
      const tokenService = new GovernanceTokenService();
      const balance = await tokenService.getTokenBalance(userId);

      if (balance) {
        // Update delegated balance
        await db.tokenBalance.update({
          where: { id: balance.id },
          data: {
            delegatedBalance: new Decimal(balance.delegatedBalance).sub(delegation.tokenAmount).toString(),
            updatedAt: new Date()
          }
        });
      }

      // Mark delegation as inactive
      await db.voteDelegation.update({
        where: { id: delegationId },
        data: {
          isActive: false
        }
      });

      return { success: true };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), userId }, 'Failed to cancel delegation');
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Get user's delegations (both given and received)
   */
  async getUserDelegations(userId: string): Promise<{
    given: VoteDelegation[];
    received: VoteDelegation[];
  }> {
    try {
      const db = getDatabase();

      const given = await db.voteDelegation.findMany({
        where: {
          delegatorId: userId,
          isActive: true
        },
        include: {
          delegate: true
        }
      });

      const received = await db.voteDelegation.findMany({
        where: {
          delegateId: userId,
          isActive: true
        },
        include: {
          delegator: true
        }
      });

      return { given, received };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), userId }, 'Failed to get user delegations');
      return { given: [], received: [] };
    }
  }

  /**
   * Calculate user's voting power including delegated votes
   */
  async calculateVotingPower(userId: string): Promise<{
    directPower: string;
    delegatedToOthers: string;
    receivedFromOthers: string;
    totalPower: string
  } | null> {
    try {
      const db = getDatabase();

      const balance = await db.tokenBalance.findFirst({
        where: { userId }
      });

      if (!balance) {
        return null;
      }

      const directPower = new Decimal(balance.balance)
        .sub(new Decimal(balance.lockedBalance))
        .sub(new Decimal(balance.delegatedBalance));

      const receivedDelegations = await db.voteDelegation.aggregate({
        where: {
          delegateId: userId,
          isActive: true
        },
        _sum: {
          tokenAmount: true
        }
      });

      const receivedFromOthers = receivedDelegations._sum.tokenAmount || '0';

      return {
        directPower: directPower.toString(),
        delegatedToOthers: balance.delegatedBalance,
        receivedFromOthers,
        totalPower: directPower.add(new Decimal(receivedFromOthers)).toString()
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), userId }, 'Failed to calculate voting power');
      return null;
    }
  }
}

/**
 * Treasury Management Service class
 */
export class TreasuryService {
  /**
   * Get treasury information
   */
  async getTreasury(): Promise<Treasury | null> {
    try {
      const db = getDatabase();

      const treasury = await db.treasury.findFirst({
        where: { isActive: true },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          allocations: {
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      });

      return treasury;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get treasury');
      return null;
    }
  }

  /**
   * Create treasury transaction
   */
  async createTransaction(
    type: 'deposit' | 'withdrawal' | 'allocation' | 'refund',
    amount: string,
    tokenSymbol: string,
    description?: string,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; transaction?: TreasuryTransaction; error?: string }> {
    try {
      const db = getDatabase();

      const treasury = await this.getTreasury();
      if (!treasury) {
        return {
          success: false,
          error: 'Treasury not found'
        };
      }

      const transaction = await db.treasuryTransaction.create({
        data: {
          treasuryId: treasury.id,
          userId,
          type,
          amount,
          tokenSymbol,
          description,
          metadata,
          status: 'pending',
          createdAt: new Date()
        }
      });

      // Update treasury balance
      const currentBalance = new Decimal(treasury.totalBalance);
      const transactionAmount = new Decimal(amount);

      let newTotalBalance: Decimal;
      let newAvailableBalance: Decimal;
      let newLockedBalance: Decimal;

      switch (type) {
        case 'deposit':
          newTotalBalance = currentBalance.add(transactionAmount);
          newAvailableBalance = new Decimal(treasury.availableBalance).add(transactionAmount);
          newLockedBalance = new Decimal(treasury.lockedBalance);
          break;
        case 'withdrawal':
          newTotalBalance = currentBalance.sub(transactionAmount);
          newAvailableBalance = new Decimal(treasury.availableBalance).sub(transactionAmount);
          newLockedBalance = new Decimal(treasury.lockedBalance);
          break;
        case 'allocation':
          newTotalBalance = currentBalance;
          newAvailableBalance = new Decimal(treasury.availableBalance).sub(transactionAmount);
          newLockedBalance = new Decimal(treasury.lockedBalance).add(transactionAmount);
          break;
        case 'refund':
          newTotalBalance = currentBalance;
          newAvailableBalance = new Decimal(treasury.availableBalance).add(transactionAmount);
          newLockedBalance = new Decimal(treasury.lockedBalance).sub(transactionAmount);
          break;
      }

      await db.treasury.update({
        where: { id: treasury.id },
        data: {
          totalBalance: newTotalBalance.toString(),
          availableBalance: newAvailableBalance.toString(),
          lockedBalance: newLockedBalance.toString(),
          updatedAt: new Date()
        }
      });

      return {
        success: true,
        transaction
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to create treasury transaction');
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Get treasury transactions
   */
  async getTransactions(limit: number = 50, offset: number = 0): Promise<TreasuryTransaction[]> {
    try {
      const db = getDatabase();

      const transactions = await db.treasuryTransaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      return transactions;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get treasury transactions');
      return [];
    }
  }

  /**
   * Create treasury allocation
   */
  async createAllocation(
    proposalId: string,
    amount: string,
    tokenSymbol: string,
    recipient: string,
    purpose: string,
    approvedBy: string
  ): Promise<{ success: boolean; allocation?: TreasuryAllocation; error?: string }> {
    try {
      const db = getDatabase();

      const treasury = await this.getTreasury();
      if (!treasury) {
        return {
          success: false,
          error: 'Treasury not found'
        };
      }

      if (new Decimal(treasury.availableBalance).lt(amount)) {
        return {
          success: false,
          error: 'Insufficient treasury balance'
        };
      }

      const allocation = await db.treasuryAllocation.create({
        data: {
          treasuryId: treasury.id,
          proposalId,
          amount,
          tokenSymbol,
          recipient,
          purpose,
          approvedBy,
          status: 'approved',
          createdAt: new Date()
        }
      });

      // Update treasury balance
      await db.treasury.update({
        where: { id: treasury.id },
        data: {
          availableBalance: new Decimal(treasury.availableBalance).sub(amount).toString(),
          lockedBalance: new Decimal(treasury.lockedBalance).add(amount).toString(),
          updatedAt: new Date()
        }
      });

      return {
        success: true,
        allocation
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to create treasury allocation');
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Execute treasury allocation
   */
  async executeAllocation(
    allocationId: string,
    txHash: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getDatabase();

      const allocation = await db.treasuryAllocation.findFirst({
        where: { id: allocationId, status: 'approved' }
      });

      if (!allocation) {
        return {
          success: false,
          error: 'Allocation not found or not approved'
        };
      }

      const treasury = await this.getTreasury();
      if (!treasury) {
        return {
          success: false,
          error: 'Treasury not found'
        };
      }

      // Update allocation status
      await db.treasuryAllocation.update({
        where: { id: allocationId },
        data: {
          status: 'executed',
          txHash,
          executedAt: new Date()
        }
      });

      // Update treasury balance
      await db.treasury.update({
        where: { id: treasury.id },
        data: {
          lockedBalance: new Decimal(treasury.lockedBalance).sub(allocation.amount).toString(),
          updatedAt: new Date()
        }
      });

      return { success: true };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to execute treasury allocation');
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Get treasury performance report
   */
  async getPerformanceReport(period: '7d' | '30d' | '90d' | '1y' = '30d'): Promise<{
    totalTransactions: number;
    totalVolume: string;
    allocationSummary: Record<string, string>;
    transactionTypes: Record<string, number>;
    period: string;
  } | null> {
    try {
      const db = getDatabase();

      const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const transactions = await db.treasuryTransaction.findMany({
        where: {
          createdAt: {
            gte: startDate
          }
        }
      });

      const allocations = await db.treasuryAllocation.findMany({
        where: {
          createdAt: {
            gte: startDate
          }
        }
      });

      const totalTransactions = transactions.length;
      const totalVolume = transactions.reduce((sum, tx) => {
        return new Decimal(sum).add(tx.amount).toString();
      }, '0');

      const transactionTypes = transactions.reduce((acc, tx) => {
        acc[tx.type] = (acc[tx.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const allocationSummary = allocations.reduce((acc, alloc) => {
        acc[alloc.purpose] = new Decimal(acc[alloc.purpose] || '0').add(alloc.amount).toString();
        return acc;
      }, {} as Record<string, string>);

      return {
        totalTransactions,
        totalVolume,
        allocationSummary,
        transactionTypes,
        period
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get treasury performance report');
      return null;
    }
  }
}

/**
 * Proposal Discussion Service class
 */
export class ProposalDiscussionService {
  /**
   * Create discussion comment
   */
  async createComment(
    proposalId: string,
    userId: string,
    content: string,
    parentId?: string
  ): Promise<{ success: boolean; comment?: ProposalDiscussion; error?: string }> {
    try {
      const db = getDatabase();

      const comment = await db.proposalDiscussion.create({
        data: {
          proposalId,
          userId,
          content,
          isReply: !!parentId,
          parentId,
          upvotes: 0,
          downvotes: 0,
          isEdited: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      return {
        success: true,
        comment
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), userId }, 'Failed to create discussion comment');
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Get proposal discussions
   */
  async getDiscussions(
    proposalId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ProposalDiscussion[]> {
    try {
      const db = getDatabase();

      const discussions = await db.proposalDiscussion.findMany({
        where: { proposalId },
        orderBy: { createdAt: 'asc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true
            }
          },
          replies: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar: true
                }
              }
            }
          }
        }
      });

      return discussions;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), proposalId }, 'Failed to get proposal discussions');
      return [];
    }
  }

  /**
   * Vote on discussion comment
   */
  async voteComment(
    commentId: string,
    userId: string,
    voteType: 'upvote' | 'downvote'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getDatabase();

      // Check if user has already voted on this comment
      // For simplicity, we'll just update the vote count
      // In a real implementation, you'd track individual votes

      const comment = await db.proposalDiscussion.findFirst({
        where: { id: commentId }
      });

      if (!comment) {
        return {
          success: false,
          error: 'Comment not found'
        };
      }

      const updateData: any = {};
      if (voteType === 'upvote') {
        updateData.upvotes = comment.upvotes + 1;
      } else {
        updateData.downvotes = comment.downvotes + 1;
      }

      await db.proposalDiscussion.update({
        where: { id: commentId },
        data: updateData
      });

      return { success: true };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), userId }, 'Failed to vote on comment');
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Edit discussion comment
   */
  async editComment(
    commentId: string,
    userId: string,
    newContent: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getDatabase();

      const comment = await db.proposalDiscussion.findFirst({
        where: { id: commentId, userId }
      });

      if (!comment) {
        return {
          success: false,
          error: 'Comment not found or access denied'
        };
      }

      await db.proposalDiscussion.update({
        where: { id: commentId },
        data: {
          content: newContent,
          isEdited: true,
          updatedAt: new Date()
        }
      });

      return { success: true };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), userId }, 'Failed to edit comment');
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Delete discussion comment
   */
  async deleteComment(
    commentId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getDatabase();

      const comment = await db.proposalDiscussion.findFirst({
        where: { id: commentId, userId }
      });

      if (!comment) {
        return {
          success: false,
          error: 'Comment not found or access denied'
        };
      }

      // Check if comment has replies
      const hasReplies = await db.proposalDiscussion.count({
        where: { parentId: commentId }
      });

      if (hasReplies > 0) {
        return {
          success: false,
          error: 'Cannot delete comment with replies'
        };
      }

      await db.proposalDiscussion.delete({
        where: { id: commentId }
      });

      return { success: true };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), userId }, 'Failed to delete comment');
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }
}