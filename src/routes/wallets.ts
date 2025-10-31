import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createEmbeddedWallet,
  getWalletInfo,
  getWalletBalance,
  signTransaction,
  sendTransaction,
  getTransactionHistory,
  estimateGasFees
} from '../services/wallet';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';

/**
 * Create wallet request body
 */
interface CreateWalletRequest {
  // No additional fields needed for wallet creation
}

/**
 * Get wallet info request parameters
 */
interface GetWalletInfoParams {
  walletAddress: string;
}

/**
 * Get wallet balance request parameters
 */
interface GetWalletBalanceParams {
  walletAddress: string;
}

/**
 * Sign transaction request body
 */
interface SignTransactionRequest {
  walletAddress: string;
  to: string;
  value: string;
  data?: string;
}

/**
 * Send transaction request body
 */
interface SendTransactionRequest {
  walletAddress: string;
  to: string;
  value: string;
  token?: string;
  data?: string;
}

/**
 * Get transaction history request parameters
 */
interface GetTransactionHistoryParams {
  walletAddress: string;
}

/**
 * Get transaction history query parameters
 */
interface GetTransactionHistoryQuery {
  page?: number;
  limit?: number;
}

/**
 * Estimate gas fees request body
 */
interface EstimateGasFeesRequest {
  to: string;
  value: string;
  data?: string;
}

/**
 * Wallet management routes
 */
export async function walletRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * Create embedded wallet
   */
  fastify.post<{ Body: CreateWalletRequest }>('/wallets', {
    preHandler: authenticateToken
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        reply.code(401).send({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      const result = await createEmbeddedWallet(request.user);
      
      if (result.success && result.wallet) {
        reply.code(201).send({
          success: true,
          wallet: result.wallet
        });
      } else {
        reply.code(400).send({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      fastify.log.error({ error }, 'Create wallet error');
      reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Get wallet information
   */
  fastify.get<{ Params: GetWalletInfoParams }>('/wallets/:walletAddress', {
    preHandler: authenticateToken,
    schema: {
      params: {
        type: 'object',
        required: ['walletAddress'],
        properties: {
          walletAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const params = request.params as GetWalletInfoParams;
    try {
      if (!request.user) {
        reply.code(401).send({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      const { walletAddress } = params;
      const result = await getWalletInfo(walletAddress, request.user);
      
      if (result.success && result.wallet) {
        reply.code(200).send({
          success: true,
          wallet: result.wallet
        });
      } else {
        reply.code(404).send({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      fastify.log.error({ error }, 'Get wallet info error');
      reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Get wallet balance
   */
  fastify.get<{ Params: GetWalletBalanceParams }>('/wallets/:walletAddress/balance', {
    preHandler: authenticateToken,
    schema: {
      params: {
        type: 'object',
        required: ['walletAddress'],
        properties: {
          walletAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const params = request.params as GetWalletBalanceParams;
    try {
      if (!request.user) {
        reply.code(401).send({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      const { walletAddress } = params;
      const result = await getWalletBalance(walletAddress, request.user);
      
      if (result.success && result.balances) {
        reply.code(200).send({
          success: true,
          balances: result.balances
        });
      } else {
        reply.code(404).send({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      fastify.log.error({ error }, 'Get wallet balance error');
      reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Sign transaction
   */
  fastify.post<{ Body: SignTransactionRequest }>('/wallets/sign', {
    preHandler: authenticateToken,
    schema: {
      body: {
        type: 'object',
        required: ['walletAddress', 'to', 'value'],
        properties: {
          walletAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          to: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          value: { type: 'string' },
          data: { type: 'string' }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const body = request.body as SignTransactionRequest;
    try {
      if (!request.user) {
        reply.code(401).send({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      const { walletAddress, to, value, data } = body;
      const result = await signTransaction(walletAddress, to, value, data, request.user);
      
      if (result.success && result.signature) {
        reply.code(200).send({
          success: true,
          signature: result.signature
        });
      } else {
        reply.code(400).send({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      fastify.log.error({ error }, 'Sign transaction error');
      reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Send transaction
   */
  fastify.post<{ Body: SendTransactionRequest }>('/wallets/send', {
    preHandler: authenticateToken,
    schema: {
      body: {
        type: 'object',
        required: ['walletAddress', 'to', 'value'],
        properties: {
          walletAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          to: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          value: { type: 'string' },
          token: { type: 'string' },
          data: { type: 'string' }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const body = request.body as SendTransactionRequest;
    try {
      if (!request.user) {
        reply.code(401).send({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      const { walletAddress, to, value, token, data } = body;
      const result = await sendTransaction(walletAddress, to, value, token || 'ETH', data, request.user);
      
      if (result.success && result.transactionHash) {
        reply.code(200).send({
          success: true,
          transactionHash: result.transactionHash
        });
      } else {
        reply.code(400).send({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      fastify.log.error({ error }, 'Send transaction error');
      reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Get transaction history
   */
  fastify.get<{ 
    Params: GetTransactionHistoryParams,
    Querystring: GetTransactionHistoryQuery
  }>('/wallets/:walletAddress/transactions', {
    preHandler: authenticateToken,
    schema: {
      params: {
        type: 'object',
        required: ['walletAddress'],
        properties: {
          walletAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 10 }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const params = request.params as GetTransactionHistoryParams;
    const query = request.query as GetTransactionHistoryQuery;
    try {
      if (!request.user) {
        reply.code(401).send({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      const { walletAddress } = params;
      const { page = 1, limit = 10 } = query;
      
      const result = await getTransactionHistory(walletAddress, request.user, page, limit);
      
      if (result.success && result.transactions) {
        reply.code(200).send({
          success: true,
          transactions: result.transactions,
          pagination: {
            page,
            limit,
            total: result.total || result.transactions.length
          }
        });
      } else {
        reply.code(404).send({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      fastify.log.error({ error }, 'Get transaction history error');
      reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * Estimate gas fees
   */
  fastify.post<{ Body: EstimateGasFeesRequest }>('/wallets/estimate-gas', {
    preHandler: authenticateToken,
    schema: {
      body: {
        type: 'object',
        required: ['to', 'value'],
        properties: {
          to: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          value: { type: 'string' },
          data: { type: 'string' }
        }
      }
    }
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const body = request.body as EstimateGasFeesRequest;
    try {
      if (!request.user) {
        reply.code(401).send({
          success: false,
          error: 'User not authenticated'
        });
        return;
      }

      const { to, value, data } = body;
      const result = await estimateGasFees(to, value, 'ETH', data);
      
      if (result.success && result.estimate) {
        reply.code(200).send({
          success: true,
          estimate: result.estimate
        });
      } else {
        reply.code(400).send({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      fastify.log.error({ error }, 'Estimate gas fees error');
      reply.code(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });
}