import { getDatabase } from '../../config/database';
import logger from '../../utils/logger';
import type { Proposal as DbProposal, Vote as DbVote } from '@prisma/client';

/**
 * Proposal interface
 */
export interface Proposal {
  id: string;
  title: string;
  description: string;
  proposerId: string;
  votingStartsAt: Date;
  votingEndsAt: Date;
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  quorum: string; // Minimum voting power required
  approvalThreshold: string; // Minimum approval percentage
  executed: boolean;
  executedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  votes?: Vote[];
}

/**
 * Vote interface
 */
export interface Vote {
  id: string;
  proposalId: string;
  userId: string;
  choice: 'for' | 'against' | 'abstain';
  votingPower: string;
  createdAt: Date;
}

/**
 * Create proposal request interface
 */
export interface CreateProposalRequest {
  title: string;
  description: string;
  votingPeriod: number; // In seconds
  quorum: string; // Minimum voting power percentage (e.g., "5" for 5%)
  approvalThreshold: string; // Minimum approval percentage (e.g., "51" for 51%)
}

/**
 * Cast vote request interface
 */
export interface CastVoteRequest {
  proposalId: string;
  choice: 'for' | 'against' | 'abstain';
  reason?: string;
}

/**
 * Proposal operation result interface
 */
export interface ProposalOperationResult {
  success: boolean;
  proposal?: Proposal;
  vote?: Vote;
  error?: string;
  warnings?: string[];
}

/**
 * Governance statistics interface
 */
export interface GovernanceStats {
  totalProposals: number;
  activeProposals: number;
  executedProposals: number;
  rejectedProposals: number;
  totalVotingPower: string;
  voterCount: number;
  averageVoterParticipation: string;
}

/**
 * Governance Service class
 */
export class GovernanceService {
  private readonly DEFAULT_VOTING_PERIOD = 7 * 24 * 60 * 60; // 7 days in seconds
  private readonly DEFAULT_QUORUM = '5'; // 5%
  private readonly DEFAULT_EXECUTION_DELAY = 2 * 24 * 60 * 60; // 2 days in seconds

  constructor() {}

  /**
   * Create a new proposal
   */
  async createProposal(request: CreateProposalRequest, proposerAddress: string): Promise<ProposalOperationResult> {
    try {
      const {
        title,
        description,
        votingPeriod,
        quorum,
        approvalThreshold
      } = request;

      // Validate proposal data
      if (!title.trim() || !description.trim()) {
        return {
          success: false,
          error: 'Title and description are required'
        };
      }

      // Create proposal in database
      const db = getDatabase();
      const now = new Date();
      const votingEndsAt = new Date(now.getTime() + votingPeriod * 1000);

      const proposal = await db.proposal.create({
        data: {
          title,
          description,
          proposerId: proposerAddress,
          votingStartsAt: now,
          votingEndsAt,
          quorum,
          approvalThreshold,
          forVotes: '0',
          againstVotes: '0',
          abstainVotes: '0',
          executed: false,
          createdAt: now,
          updatedAt: now
        }
      });

      logger.info(`Proposal created: ${title} by ${proposerAddress}`);

      return {
        success: true,
        proposal: await this.mapDbProposalToProposal(proposal)
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to create proposal');
      return {
        success: false,
        error: 'Failed to create proposal'
      };
    }
  }

  /**
   * Cast a vote on a proposal
   */
  async castVote(request: CastVoteRequest, voterAddress: string, votingPower: string): Promise<ProposalOperationResult> {
    try {
      const { proposalId, choice } = request;

      // Validate proposal exists and is not executed
      const proposal = await this.getProposalById(proposalId);
      if (!proposal) {
        return {
          success: false,
          error: 'Proposal not found'
        };
      }

      if (proposal.executed) {
        return {
          success: false,
          error: 'Proposal has already been executed'
        };
      }

      // Check if voting period has ended
      if (new Date() > proposal.votingEndsAt) {
        return {
          success: false,
          error: 'Voting period has ended'
        };
      }

      // Check if user has already voted
      const db = getDatabase();
      const existingVote = await db.vote.findUnique({
        where: {
          userId_proposalId: {
            userId: voterAddress,
            proposalId
          }
        }
      });

      if (existingVote) {
        return {
          success: false,
          error: 'You have already voted on this proposal'
        };
      }

      // Create vote
      const vote = await db.vote.create({
        data: {
          proposalId,
          userId: voterAddress,
          choice,
          votingPower,
          createdAt: new Date()
        }
      });

      // Update proposal vote counts
      await this.updateProposalVoteCounts(proposalId);

      logger.info(`Vote cast by ${voterAddress} on proposal ${proposalId}: ${choice}`);

      return {
        success: true,
        vote: await this.mapDbVoteToVote(vote)
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to cast vote');
      return {
        success: false,
        error: 'Failed to cast vote'
      };
    }
  }

  /**
   * Execute a proposal
   */
  async executeProposal(proposalId: string): Promise<ProposalOperationResult> {
    try {
      const proposal = await this.getProposalById(proposalId);
      if (!proposal) {
        return {
          success: false,
          error: 'Proposal not found'
        };
      }

      if (proposal.executed) {
        return {
          success: false,
          error: 'Proposal has already been executed'
        };
      }

      // Check if voting period has ended
      if (new Date() <= proposal.votingEndsAt) {
        return {
          success: false,
          error: 'Voting period has not ended yet'
        };
      }

      // Check if proposal passed (using approval threshold)
      const totalVotes = parseFloat(proposal.forVotes) + parseFloat(proposal.againstVotes) + parseFloat(proposal.abstainVotes);
      const quorumRequired = parseFloat(proposal.quorum);

      if (totalVotes < quorumRequired) {
        return {
          success: false,
          error: 'Proposal rejected due to insufficient quorum'
        };
      }

      const forPercentage = parseFloat(proposal.forVotes) / totalVotes * 100;
      const approvalThreshold = parseFloat(proposal.approvalThreshold);

      if (forPercentage < approvalThreshold) {
        return {
          success: false,
          error: `Proposal rejected. Only ${forPercentage.toFixed(2)}% voted for, but ${approvalThreshold}% required`
        };
      }

      // Mark the proposal as executed
      await this.markProposalAsExecuted(proposalId);

      logger.info(`Proposal executed: ${proposalId}`);

      const updatedProposal = await this.getProposalById(proposalId);
      return {
        success: true,
        proposal: updatedProposal || undefined
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to execute proposal');
      return {
        success: false,
        error: 'Failed to execute proposal'
      };
    }
  }

  /**
   * Get all proposals
   */
  async getAllProposals(executed?: boolean): Promise<Proposal[]> {
    try {
      const db = getDatabase();
      const whereClause = executed !== undefined ? { executed } : {};

      const proposals = await db.proposal.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' }
      });

      return Promise.all(proposals.map(async (proposal) => {
        return this.mapDbProposalToProposal(proposal);
      }));

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get proposals');
      return [];
    }
  }

  /**
   * Get proposal by ID
   */
  async getProposalById(proposalId: string): Promise<Proposal | null> {
    try {
      const db = getDatabase();
      const proposal = await db.proposal.findUnique({
        where: { id: proposalId }
      });

      if (!proposal) {
        return null;
      }

      return this.mapDbProposalToProposal(proposal);

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get proposal by ID');
      return null;
    }
  }

  /**
   * Get votes for a proposal
   */
  async getProposalVotes(proposalId: string): Promise<Vote[]> {
    try {
      const db = getDatabase();
      const votes = await db.vote.findMany({
        where: { proposalId },
        orderBy: { createdAt: 'desc' }
      });

      return votes.map(vote => this.mapDbVoteToVote(vote));

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get proposal votes');
      return [];
    }
  }

  /**
   * Get user's votes
   */
  async getUserVotes(voterAddress: string): Promise<Vote[]> {
    try {
      const db = getDatabase();
      const votes = await db.vote.findMany({
        where: { userId: voterAddress },
        orderBy: { createdAt: 'desc' }
      });

      return votes.map(vote => this.mapDbVoteToVote(vote));

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get user votes');
      return [];
    }
  }

  /**
   * Get governance statistics
   */
  async getGovernanceStats(): Promise<GovernanceStats> {
    try {
      const db = getDatabase();

      const [totalProposals, activeProposals, executedProposals, totalVotes] = await Promise.all([
        db.proposal.count(),
        db.proposal.count({ where: { executed: false } }),
        db.proposal.count({ where: { executed: true } }),
        db.vote.groupBy({
          by: ['userId'],
          _count: true
        })
      ]);

      // Mock total voting power - in a real implementation, this would come from governance token contract
      const totalVotingPower = '1000000'; // 1M tokens

      const voterCount = totalVotes.length;

      // Calculate average participation (simplified)
      const averageVoterParticipation = totalProposals > 0
        ? ((totalVotes.reduce((sum, vote) => sum + (vote._count || 0), 0) / totalProposals) / parseFloat(totalVotingPower) * 100).toFixed(2)
        : '0';

      return {
        totalProposals,
        activeProposals,
        executedProposals,
        rejectedProposals: 0, // Not tracked in current schema
        totalVotingPower,
        voterCount,
        averageVoterParticipation
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get governance stats');
      return {
        totalProposals: 0,
        activeProposals: 0,
        executedProposals: 0,
        rejectedProposals: 0,
        totalVotingPower: '0',
        voterCount: 0,
        averageVoterParticipation: '0'
      };
    }
  }

  /**
   * Update proposal vote counts
   */
  private async updateProposalVoteCounts(proposalId: string): Promise<void> {
    const db = getDatabase();

    const votes = await db.vote.findMany({
      where: { proposalId }
    });

    const forVotes = votes.filter(v => v.choice === 'for').reduce((sum, vote) => sum + parseFloat(vote.votingPower), 0);
    const againstVotes = votes.filter(v => v.choice === 'against').reduce((sum, vote) => sum + parseFloat(vote.votingPower), 0);
    const abstainVotes = votes.filter(v => v.choice === 'abstain').reduce((sum, vote) => sum + parseFloat(vote.votingPower), 0);

    await db.proposal.update({
      where: { id: proposalId },
      data: {
        forVotes: forVotes.toString(),
        againstVotes: againstVotes.toString(),
        abstainVotes: abstainVotes.toString(),
        updatedAt: new Date()
      }
    });
  }

  /**
   * Mark proposal as executed
   */
  private async markProposalAsExecuted(proposalId: string): Promise<void> {
    const db = getDatabase();

    await db.proposal.update({
      where: { id: proposalId },
      data: {
        executed: true,
        executedAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  /**
   * Map database proposal to Proposal interface
   */
  private async mapDbProposalToProposal(dbProposal: DbProposal): Promise<Proposal> {
    const db = getDatabase();
    const votes = await db.vote.findMany({
      where: { proposalId: dbProposal.id }
    });

    return {
      id: dbProposal.id,
      title: dbProposal.title,
      description: dbProposal.description,
      proposerId: dbProposal.proposerId,
      votingStartsAt: dbProposal.votingStartsAt,
      votingEndsAt: dbProposal.votingEndsAt,
      forVotes: dbProposal.forVotes,
      againstVotes: dbProposal.againstVotes,
      abstainVotes: dbProposal.abstainVotes,
      quorum: dbProposal.quorum,
      approvalThreshold: dbProposal.approvalThreshold,
      executed: dbProposal.executed,
      executedAt: dbProposal.executedAt || undefined,
      createdAt: dbProposal.createdAt,
      updatedAt: dbProposal.updatedAt,
      votes: (votes || []).map(vote => this.mapDbVoteToVote(vote))
    };
  }

  /**
   * Map database vote to Vote interface
   */
  private mapDbVoteToVote(dbVote: DbVote): Vote {
    return {
      id: dbVote.id,
      proposalId: dbVote.proposalId,
      userId: dbVote.userId,
      choice: dbVote.choice as any,
      votingPower: dbVote.votingPower,
      createdAt: dbVote.createdAt
    };
  }
}