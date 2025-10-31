import { GovernanceService } from '../services/governance';
import { getDatabase } from '../config/database';

// Mock the database module
jest.mock('../config/database');
const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

describe('GovernanceService', () => {
  let governanceService: GovernanceService;
  let mockDb: any;

  beforeEach(() => {
    governanceService = new GovernanceService();

    // Mock database methods
    mockDb = {
      proposal: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn()
      },
      vote: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn()
      }
    };

    mockGetDatabase.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createProposal', () => {
    it('should create a new proposal successfully', async () => {
      const request = {
        title: 'Test Proposal',
        description: 'This is a test proposal for governance',
        votingPeriod: 7 * 24 * 60 * 60, // 7 days
        quorum: '1000',
        approvalThreshold: '51'
      };

      const mockProposal = {
        id: 'proposal-1',
        title: request.title,
        description: request.description,
        proposerId: 'user-1',
        votingStartsAt: new Date(),
        votingEndsAt: new Date(Date.now() + request.votingPeriod * 1000),
        quorum: request.quorum,
        approvalThreshold: request.approvalThreshold,
        forVotes: '0',
        againstVotes: '0',
        abstainVotes: '0',
        executed: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.proposal.create.mockResolvedValue(mockProposal);

      const result = await governanceService.createProposal(request, 'user-1');

      expect(result.success).toBe(true);
      expect(result.proposal).toBeDefined();
      expect(result.proposal?.title).toBe('Test Proposal');
      expect(result.proposal?.proposerId).toBe('user-1');
    });

    it('should fail if title is empty', async () => {
      const request = {
        title: '',
        description: 'This is a test proposal',
        votingPeriod: 7 * 24 * 60 * 60,
        quorum: '1000',
        approvalThreshold: '51'
      };

      const result = await governanceService.createProposal(request, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Title and description are required');
    });

    it('should fail if description is empty', async () => {
      const request = {
        title: 'Test Proposal',
        description: '',
        votingPeriod: 7 * 24 * 60 * 60,
        quorum: '1000',
        approvalThreshold: '51'
      };

      const result = await governanceService.createProposal(request, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Title and description are required');
    });
  });

  describe('castVote', () => {
    it('should cast a vote successfully', async () => {
      const request = {
        proposalId: 'proposal-1',
        choice: 'for' as const
      };

      const mockProposal = {
        id: 'proposal-1',
        executed: false,
        votingEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day from now
      };

      const mockVote = {
        id: 'vote-1',
        proposalId: request.proposalId,
        userId: 'user-1',
        choice: request.choice,
        votingPower: '1000',
        createdAt: new Date()
      };

      mockDb.proposal.findUnique.mockResolvedValue(mockProposal);
      mockDb.vote.findUnique.mockResolvedValue(null); // No existing vote
      mockDb.vote.create.mockResolvedValue(mockVote);
      mockDb.vote.findMany.mockResolvedValue([mockVote]); // For vote count update
      mockDb.proposal.update.mockResolvedValue(mockProposal);

      const result = await governanceService.castVote(request, 'user-1', '1000');

      expect(result.success).toBe(true);
      expect(result.vote).toBeDefined();
      expect(result.vote?.choice).toBe('for');
      expect(result.vote?.userId).toBe('user-1');
    });

    it('should fail if proposal not found', async () => {
      const request = {
        proposalId: 'non-existent-proposal',
        choice: 'for' as const
      };

      mockDb.proposal.findUnique.mockResolvedValue(null);

      const result = await governanceService.castVote(request, 'user-1', '1000');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Proposal not found');
    });

    it('should fail if proposal already executed', async () => {
      const request = {
        proposalId: 'proposal-1',
        choice: 'for' as const
      };

      const mockProposal = {
        id: 'proposal-1',
        executed: true
      };

      mockDb.proposal.findUnique.mockResolvedValue(mockProposal);

      const result = await governanceService.castVote(request, 'user-1', '1000');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Proposal has already been executed');
    });

    it('should fail if voting period has ended', async () => {
      const request = {
        proposalId: 'proposal-1',
        choice: 'for' as const
      };

      const mockProposal = {
        id: 'proposal-1',
        executed: false,
        votingEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      };

      mockDb.proposal.findUnique.mockResolvedValue(mockProposal);

      const result = await governanceService.castVote(request, 'user-1', '1000');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Voting period has ended');
    });

    it('should fail if user already voted', async () => {
      const request = {
        proposalId: 'proposal-1',
        choice: 'for' as const
      };

      const mockProposal = {
        id: 'proposal-1',
        executed: false,
        votingEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const existingVote = {
        id: 'existing-vote',
        userId: 'user-1',
        proposalId: 'proposal-1'
      };

      mockDb.proposal.findUnique.mockResolvedValue(mockProposal);
      mockDb.vote.findUnique.mockResolvedValue(existingVote);

      const result = await governanceService.castVote(request, 'user-1', '1000');

      expect(result.success).toBe(false);
      expect(result.error).toBe('You have already voted on this proposal');
    });
  });

  describe('executeProposal', () => {
    it('should execute proposal successfully', async () => {
      const proposalId = 'proposal-1';

      const mockProposal = {
        id: proposalId,
        executed: false,
        votingEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        forVotes: '600',
        againstVotes: '300',
        abstainVotes: '100',
        quorum: '500',
        approvalThreshold: '51'
      };

      const updatedProposal = {
        ...mockProposal,
        executed: true,
        executedAt: new Date()
      };

      mockDb.proposal.findUnique
        .mockResolvedValueOnce(mockProposal) // First call for execution check
        .mockResolvedValueOnce(updatedProposal); // Second call for result
      mockDb.proposal.update.mockResolvedValue(updatedProposal);

      const result = await governanceService.executeProposal(proposalId);

      expect(result.success).toBe(true);
      expect(result.proposal?.executed).toBe(true);
    });

    it('should fail if proposal not found', async () => {
      const proposalId = 'non-existent-proposal';

      mockDb.proposal.findUnique.mockResolvedValue(null);

      const result = await governanceService.executeProposal(proposalId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Proposal not found');
    });

    it('should fail if proposal already executed', async () => {
      const proposalId = 'proposal-1';

      const mockProposal = {
        id: proposalId,
        executed: true
      };

      mockDb.proposal.findUnique.mockResolvedValue(mockProposal);

      const result = await governanceService.executeProposal(proposalId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Proposal has already been executed');
    });

    it('should fail if voting period has not ended', async () => {
      const proposalId = 'proposal-1';

      const mockProposal = {
        id: proposalId,
        executed: false,
        votingEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day from now
      };

      mockDb.proposal.findUnique.mockResolvedValue(mockProposal);

      const result = await governanceService.executeProposal(proposalId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Voting period has not ended yet');
    });

    it('should fail if insufficient quorum', async () => {
      const proposalId = 'proposal-1';

      const mockProposal = {
        id: proposalId,
        executed: false,
        votingEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        forVotes: '300',
        againstVotes: '100',
        abstainVotes: '50',
        quorum: '1000', // Requires 1000 votes, only has 450
        approvalThreshold: '51'
      };

      mockDb.proposal.findUnique.mockResolvedValue(mockProposal);

      const result = await governanceService.executeProposal(proposalId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Proposal rejected due to insufficient quorum');
    });

    it('should fail if insufficient approval', async () => {
      const proposalId = 'proposal-1';

      const mockProposal = {
        id: proposalId,
        executed: false,
        votingEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        forVotes: '400',
        againstVotes: '400',
        abstainVotes: '200',
        quorum: '500',
        approvalThreshold: '51' // Requires 51% approval, only has 40%
      };

      mockDb.proposal.findUnique.mockResolvedValue(mockProposal);

      const result = await governanceService.executeProposal(proposalId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Proposal rejected. Only 40.00% voted for, but 51% required');
    });
  });

  describe('getAllProposals', () => {
    it('should return all proposals', async () => {
      const mockProposals = [
        {
          id: 'proposal-1',
          title: 'Test Proposal 1',
          description: 'First test proposal',
          proposerId: 'user-1',
          votingStartsAt: new Date(),
          votingEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          quorum: '1000',
          approvalThreshold: '51',
          forVotes: '0',
          againstVotes: '0',
          abstainVotes: '0',
          executed: false,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'proposal-2',
          title: 'Test Proposal 2',
          description: 'Second test proposal',
          proposerId: 'user-2',
          votingStartsAt: new Date(),
          votingEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          quorum: '1000',
          approvalThreshold: '51',
          forVotes: '100',
          againstVotes: '50',
          abstainVotes: '25',
          executed: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockDb.proposal.findMany.mockResolvedValue(mockProposals);
      mockDb.vote.findMany.mockResolvedValue([]); // No votes

      const proposals = await governanceService.getAllProposals();

      expect(proposals).toHaveLength(2);
      expect(proposals[0].title).toBe('Test Proposal 1');
      expect(proposals[1].title).toBe('Test Proposal 2');
    });

    it('should filter proposals by executed status', async () => {
      const mockProposals = [
        {
          id: 'proposal-1',
          title: 'Executed Proposal',
          executed: true
        }
      ];

      mockDb.proposal.findMany.mockResolvedValue(mockProposals);
      mockDb.vote.findMany.mockResolvedValue([]);

      const proposals = await governanceService.getAllProposals(true);

      expect(proposals).toHaveLength(1);
      expect(proposals[0].executed).toBe(true);
    });
  });

  describe('getProposalById', () => {
    it('should return proposal by ID', async () => {
      const proposalId = 'proposal-1';
      const mockProposal = {
        id: proposalId,
        title: 'Test Proposal',
        description: 'Test description',
        proposerId: 'user-1',
        votingStartsAt: new Date(),
        votingEndsAt: new Date(),
        quorum: '1000',
        approvalThreshold: '51',
        forVotes: '100',
        againstVotes: '50',
        abstainVotes: '25',
        executed: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDb.proposal.findUnique.mockResolvedValue(mockProposal);
      mockDb.vote.findMany.mockResolvedValue([]);

      const proposal = await governanceService.getProposalById(proposalId);

      expect(proposal).toBeDefined();
      expect(proposal?.id).toBe(proposalId);
      expect(proposal?.title).toBe('Test Proposal');
    });

    it('should return null if proposal not found', async () => {
      const proposalId = 'non-existent-proposal';

      mockDb.proposal.findUnique.mockResolvedValue(null);

      const proposal = await governanceService.getProposalById(proposalId);

      expect(proposal).toBeNull();
    });
  });

  describe('getUserVotes', () => {
    it('should return user votes', async () => {
      const userId = 'user-1';
      const mockVotes = [
        {
          id: 'vote-1',
          proposalId: 'proposal-1',
          userId,
          choice: 'for',
          votingPower: '1000',
          createdAt: new Date()
        },
        {
          id: 'vote-2',
          proposalId: 'proposal-2',
          userId,
          choice: 'against',
          votingPower: '500',
          createdAt: new Date()
        }
      ];

      mockDb.vote.findMany.mockResolvedValue(mockVotes);

      const votes = await governanceService.getUserVotes(userId);

      expect(votes).toHaveLength(2);
      expect(votes[0].choice).toBe('for');
      expect(votes[1].choice).toBe('against');
      expect(votes.every(vote => vote.userId === userId)).toBe(true);
    });
  });

  describe('getGovernanceStats', () => {
    it('should return governance statistics', async () => {
      mockDb.proposal.count
        .mockResolvedValueOnce(10) // totalProposals
        .mockResolvedValueOnce(7)  // activeProposals (executed: false)
        .mockResolvedValueOnce(3); // executedProposals (executed: true)

      mockDb.vote.groupBy.mockResolvedValue([
        { userId: 'user-1', _count: 2 },
        { userId: 'user-2', _count: 1 }
      ]);

      const stats = await governanceService.getGovernanceStats();

      expect(stats.totalProposals).toBe(10);
      expect(stats.activeProposals).toBe(7);
      expect(stats.executedProposals).toBe(3);
      expect(stats.voterCount).toBe(2);
      expect(stats.totalVotingPower).toBe('1000000');
    });

    it('should handle empty database', async () => {
      mockDb.proposal.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      mockDb.vote.groupBy.mockResolvedValue([]);

      const stats = await governanceService.getGovernanceStats();

      expect(stats.totalProposals).toBe(0);
      expect(stats.activeProposals).toBe(0);
      expect(stats.executedProposals).toBe(0);
      expect(stats.voterCount).toBe(0);
      expect(stats.totalVotingPower).toBe('1000000');
      expect(stats.averageVoterParticipation).toBe('0');
    });
  });
});