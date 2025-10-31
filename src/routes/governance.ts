import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GovernanceService, CreateProposalRequest, CastVoteRequest } from '../services/governance';
import { AuthenticatedRequest } from '../middleware/auth';
import logger from '../utils/logger';

/**
 * Create proposal request body
 */
interface CreateProposalRequestBody {
  title: string;
  description: string;
  votingPeriod: number;
  quorum: string;
  approvalThreshold: string;
}

/**
 * Cast vote request body
 */
interface CastVoteRequestBody {
  proposalId: string;
  choice: 'for' | 'against' | 'abstain';
  reason?: string;
}

/**
 * Initialize governance service
 */
const governanceService = new GovernanceService();

/**
 * Governance routes plugin
 */
export async function governanceRoutes(fastify: FastifyInstance) {

  /**
   * Create new proposal
   */
  fastify.post<{ Body: CreateProposalRequestBody }>('/proposals', {
    schema: {
      body: {
        type: 'object',
        required: ['title', 'description', 'votingPeriod', 'quorum', 'approvalThreshold'],
        properties: {
          title: {
            type: 'string',
            minLength: 1,
            maxLength: 200
          },
          description: {
            type: 'string',
            minLength: 1,
            maxLength: 5000
          },
          votingPeriod: {
            type: 'integer',
            minimum: 3600, // 1 hour minimum
            maximum: 30 * 24 * 60 * 60 // 30 days maximum
          },
          quorum: {
            type: 'string',
            pattern: '^[0-9]+(\\.[0-9]+)?$'
          },
          approvalThreshold: {
            type: 'string',
            pattern: '^[0-9]+(\\.[0-9]+)?$'
          }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required'
        });
      }

      const body = request.body as CreateProposalRequestBody;
      const { title, description, votingPeriod, quorum, approvalThreshold } = body;

      // In a real implementation, you would check if the user has sufficient governance tokens
      // For now, we'll allow any authenticated user to create proposals
      const userVotingPower = '1000'; // Mock voting power

      if (parseFloat(userVotingPower) < 100) {
        return reply.code(403).send({
          success: false,
          error: 'Insufficient governance tokens to create proposal'
        });
      }

      const createRequest: CreateProposalRequest = {
        title,
        description,
        votingPeriod,
        quorum,
        approvalThreshold
      };

      const result = await governanceService.createProposal(createRequest, request.user.id);

      if (!result.success) {
        return reply.code(400).send(result);
      }

      logger.info(`Proposal created by user ${request.user.id}: ${title}`);

      return reply.code(201).send({
        success: true,
        proposal: result.proposal
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to create proposal');
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Get all proposals
   */
  fastify.get('/proposals', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          executed: {
            type: 'boolean'
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { executed?: boolean };
      const { executed } = query;

      const proposals = await governanceService.getAllProposals(executed);

      return reply.code(200).send({
        success: true,
        proposals,
        count: proposals.length
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get proposals');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve proposals'
      });
    }
  });

  /**
   * Get specific proposal by ID
   */
  fastify.get<{
    Params: { proposalId: string }
  }>('/proposals/:proposalId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          proposalId: { type: 'string' }
        },
        required: ['proposalId']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as { proposalId: string };
      const { proposalId } = params;

      const proposal = await governanceService.getProposalById(proposalId);

      if (!proposal) {
        return reply.code(404).send({
          success: false,
          error: 'Proposal not found'
        });
      }

      return reply.code(200).send({
        success: true,
        proposal
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get proposal');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve proposal'
      });
    }
  });

  /**
   * Get proposal votes
   */
  fastify.get<{
    Params: { proposalId: string }
  }>('/proposals/:proposalId/votes', {
    schema: {
      params: {
        type: 'object',
        properties: {
          proposalId: { type: 'string' }
        },
        required: ['proposalId']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as { proposalId: string };
      const { proposalId } = params;

      const votes = await governanceService.getProposalVotes(proposalId);

      return reply.code(200).send({
        success: true,
        votes,
        count: votes.length
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get proposal votes');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve votes'
      });
    }
  });

  /**
   * Cast vote on proposal
   */
  fastify.post<{ Body: CastVoteRequestBody }>('/vote', {
    schema: {
      body: {
        type: 'object',
        required: ['proposalId', 'choice'],
        properties: {
          proposalId: { type: 'string' },
          choice: {
            type: 'string',
            enum: ['for', 'against', 'abstain']
          }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required'
        });
      }

      const body = request.body as CastVoteRequestBody;
      const { proposalId, choice } = body;

      // In a real implementation, you would check the user's governance token balance
      // For now, we'll use a mock voting power
      const userVotingPower = '1000'; // Mock voting power

      if (parseFloat(userVotingPower) <= 0) {
        return reply.code(403).send({
          success: false,
          error: 'No voting power available'
        });
      }

      const castVoteRequest: CastVoteRequest = {
        proposalId,
        choice
      };

      const result = await governanceService.castVote(castVoteRequest, request.user.id, userVotingPower);

      if (!result.success) {
        return reply.code(400).send(result);
      }

      logger.info(`Vote cast by user ${request.user.id} on proposal ${proposalId}: ${choice}`);

      return reply.code(200).send({
        success: true,
        vote: result.vote
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to cast vote');
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Execute proposal
   */
  fastify.post<{
    Params: { proposalId: string }
  }>('/proposals/:proposalId/execute', {
    schema: {
      params: {
        type: 'object',
        properties: {
          proposalId: { type: 'string' }
        },
        required: ['proposalId']
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required'
        });
      }

      const params = request.params as { proposalId: string };
      const { proposalId } = params;

      // In a real implementation, you would check if the user has permission to execute proposals
      // For now, we'll allow any authenticated user to execute
      const result = await governanceService.executeProposal(proposalId);

      if (!result.success) {
        return reply.code(400).send(result);
      }

      logger.info(`Proposal executed by user ${request.user.id}: ${proposalId}`);

      return reply.code(200).send({
        success: true,
        proposal: result.proposal
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to execute proposal');
      return reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Get user's votes
   */
  fastify.get('/votes', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required'
        });
      }

      const votes = await governanceService.getUserVotes(request.user.id);

      return reply.code(200).send({
        success: true,
        votes,
        count: votes.length
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get user votes');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve votes'
      });
    }
  });

  /**
   * Get governance statistics
   */
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await governanceService.getGovernanceStats();

      return reply.code(200).send({
        success: true,
        stats
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get governance stats');
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve statistics'
      });
    }
  });

  /**
   * Health check for governance service
   */
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await governanceService.getGovernanceStats();

      return reply.code(200).send({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          governanceService: 'operational',
          database: 'operational'
        },
        proposalCount: stats.totalProposals,
        activeProposals: stats.activeProposals
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Governance health check failed');
      return reply.code(503).send({
        success: false,
        status: 'unhealthy',
        error: 'Governance service unavailable'
      });
    }
  });
}