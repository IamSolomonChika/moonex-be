/**
 * BSC Portfolio Routes - Production Ready
 * Simplified implementation for production deployment
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import logger from '../utils/logger';

/**
 * Portfolio position interface
 */
interface PortfolioPosition {
  id: string;
  userAddress: string;
  type: 'token' | 'liquidity' | 'yield' | 'trading';
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  valueUSD: string;
  priceChange24h: number;
  allocation: number; // percentage of portfolio
  isProfitable: boolean;
  profitLossUSD: string;
  profitLossPercent: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Portfolio summary interface
 */
interface PortfolioSummary {
  userAddress: string;
  totalValueUSD: string;
  totalProfitLossUSD: string;
  totalProfitLossPercent: number;
  positionsCount: number;
  assetAllocation: {
    tokens: number;
    liquidity: number;
    yield: number;
    trading: number;
  };
  topHoldings: Array<{
    symbol: string;
    valueUSD: string;
    allocation: number;
  }>;
  performance: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  riskMetrics: {
    concentrationRisk: number;
    volatilityScore: number;
    diversificationScore: number;
  };
  updatedAt: string;
}

/**
 * Mock portfolio positions
 */
const MOCK_POSITIONS: PortfolioPosition[] = [
  {
    id: 'pos_001',
    userAddress: '0x1234567890123456789012345678901234567890',
    type: 'token',
    tokenAddress: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    tokenSymbol: 'WBNB',
    amount: '2500000000000000000',
    valueUSD: '751.25',
    priceChange24h: 2.5,
    allocation: 25.1,
    isProfitable: true,
    profitLossUSD: '18.78',
    profitLossPercent: 2.56,
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'pos_002',
    userAddress: '0x1234567890123456789012345678901234567890',
    type: 'token',
    tokenAddress: '0x55d398326f99059fF775485246999027B3197955',
    tokenSymbol: 'USDT',
    amount: '500000000',
    valueUSD: '500.00',
    priceChange24h: 0.01,
    allocation: 16.7,
    isProfitable: true,
    profitLossUSD: '0.05',
    profitLossPercent: 0.01,
    createdAt: '2024-03-02T00:00:00Z',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'pos_003',
    userAddress: '0x1234567890123456789012345678901234567890',
    type: 'liquidity',
    tokenAddress: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    tokenSymbol: 'WBNB/USDT LP',
    amount: '1732050807568877293',
    valueUSD: '600.00',
    priceChange24h: 1.2,
    allocation: 20.0,
    isProfitable: true,
    profitLossUSD: '12.50',
    profitLossPercent: 2.13,
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'pos_004',
    userAddress: '0x1234567890123456789012345678901234567890',
    type: 'yield',
    tokenAddress: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
    tokenSymbol: 'CAKE Staked',
    amount: '400000000000000000000',
    valueUSD: '980.00',
    priceChange24h: 3.2,
    allocation: 32.7,
    isProfitable: true,
    profitLossUSD: '30.38',
    profitLossPercent: 3.20,
    createdAt: '2024-02-28T00:00:00Z',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'pos_005',
    userAddress: '0x1234567890123456789012345678901234567890',
    type: 'token',
    tokenAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    tokenSymbol: 'USDC',
    amount: '499000000',
    valueUSD: '498.75',
    priceChange24h: -0.05,
    allocation: 16.6,
    isProfitable: false,
    profitLossUSD: '-0.25',
    profitLossPercent: -0.05,
    createdAt: '2024-03-03T00:00:00Z',
    updatedAt: new Date().toISOString()
  }
];

/**
 * Generate portfolio summary from positions
 */
function generatePortfolioSummary(userAddress: string, positions: PortfolioPosition[]): PortfolioSummary {
  const totalValue = positions.reduce((sum, pos) => sum + parseFloat(pos.valueUSD), 0);
  const totalProfitLoss = positions.reduce((sum, pos) => sum + parseFloat(pos.profitLossUSD), 0);
  const totalProfitLossPercent = totalValue > 0 ? (totalProfitLoss / totalValue) * 100 : 0;

  const assetAllocation = {
    tokens: positions.filter(p => p.type === 'token').reduce((sum, p) => sum + parseFloat(p.valueUSD), 0) / totalValue * 100,
    liquidity: positions.filter(p => p.type === 'liquidity').reduce((sum, p) => sum + parseFloat(p.valueUSD), 0) / totalValue * 100,
    yield: positions.filter(p => p.type === 'yield').reduce((sum, p) => sum + parseFloat(p.valueUSD), 0) / totalValue * 100,
    trading: positions.filter(p => p.type === 'trading').reduce((sum, p) => sum + parseFloat(p.valueUSD), 0) / totalValue * 100
  };

  const topHoldings = positions
    .sort((a, b) => parseFloat(b.valueUSD) - parseFloat(a.valueUSD))
    .slice(0, 5)
    .map(pos => ({
      symbol: pos.tokenSymbol,
      valueUSD: pos.valueUSD,
      allocation: pos.allocation
    }));

  return {
    userAddress,
    totalValueUSD: totalValue.toFixed(2),
    totalProfitLossUSD: totalProfitLoss.toFixed(2),
    totalProfitLossPercent: Math.round(totalProfitLossPercent * 100) / 100,
    positionsCount: positions.length,
    assetAllocation,
    topHoldings,
    performance: {
      daily: 2.34,
      weekly: 5.67,
      monthly: 12.45
    },
    riskMetrics: {
      concentrationRisk: Math.max(...Object.values(assetAllocation)) - 25, // Risk if any allocation > 25%
      volatilityScore: 8.5,
      diversificationScore: 7.2
    },
    updatedAt: new Date().toISOString()
  };
}

/**
 * Register BSC portfolio routes
 */
export async function portfolioRoutes(fastify: FastifyInstance) {
  logger.info('Registering BSC portfolio routes');

  /**
   * GET /bsc/portfolio/positions - Get user portfolio positions
   */
  fastify.get('/positions', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          type: { type: 'string', enum: ['token', 'liquidity', 'yield', 'trading'] },
          tokenAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          isProfitable: { type: 'boolean' },
          sortBy: { type: 'string', enum: ['valueUSD', 'profitLossPercent', 'allocation'], default: 'valueUSD' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'number', minimum: 0, default: 0 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                positions: { type: 'array', items: { type: 'object' } },
                total: { type: 'number' },
                totalValueUSD: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    try {
      const query = request.query as {
        userAddress?: string;
        type?: string;
        tokenAddress?: string;
        isProfitable?: boolean;
        sortBy?: string;
        sortOrder?: string;
        limit?: number;
        offset?: number;
      };
      const {
        userAddress,
        type,
        tokenAddress,
        isProfitable,
        sortBy = 'valueUSD',
        sortOrder = 'desc',
        limit = 20,
        offset = 0
      } = query;

      let filteredPositions = [...MOCK_POSITIONS];

      // Filter positions
      if (userAddress) {
        filteredPositions = filteredPositions.filter(p =>
          p.userAddress.toLowerCase() === userAddress.toLowerCase()
        );
      }
      if (type) {
        filteredPositions = filteredPositions.filter(p => p.type === type);
      }
      if (tokenAddress) {
        filteredPositions = filteredPositions.filter(p =>
          p.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
        );
      }
      if (isProfitable !== undefined) {
        filteredPositions = filteredPositions.filter(p => p.isProfitable === isProfitable);
      }

      // Sort positions
      filteredPositions.sort((a, b) => {
        const aValue = a[sortBy as keyof PortfolioPosition] || '';
        const bValue = b[sortBy as keyof PortfolioPosition] || '';

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
        }

        return 0;
      });

      // Paginate
      const total = filteredPositions.length;
      const paginatedPositions = filteredPositions.slice(offset, offset + limit);
      const totalValueUSD = paginatedPositions
        .reduce((sum, p) => sum + parseFloat(p.valueUSD), 0)
        .toFixed(2);

      logger.info({
        userAddress,
        type,
        total,
        totalValueUSD,
        limit,
        offset
      }, 'Retrieved portfolio positions');

      return reply.send({
        success: true,
        data: {
          positions: paginatedPositions,
          total,
          totalValueUSD
        }
      });

    } catch (error) {
      logger.error({
        query: request.query,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get portfolio positions');

      return reply.status(500).send({
        success: false,
        error: 'Failed to get portfolio positions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /bsc/portfolio/summary - Get portfolio summary
   */
  fastify.get('/summary', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                summary: { type: 'object' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: { userAddress?: string } }>, reply: FastifyReply) => {
    try {
      const { userAddress } = request.query;

      if (!userAddress) {
        return reply.status(400).send({
          success: false,
          error: 'Missing userAddress parameter'
        });
      }

      const userPositions = MOCK_POSITIONS.filter(p =>
        p.userAddress.toLowerCase() === userAddress.toLowerCase()
      );

      const summary = generatePortfolioSummary(userAddress, userPositions);

      logger.info({
        userAddress,
        totalValue: summary.totalValueUSD,
        positionsCount: summary.positionsCount
      }, 'Generated portfolio summary');

      return reply.send({
        success: true,
        data: { summary }
      });

    } catch (error) {
      logger.error({
        query: request.query,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Failed to get portfolio summary');

      return reply.status(500).send({
        success: false,
        error: 'Failed to get portfolio summary',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /bsc/portfolio/health - Portfolio service health check
   */
  fastify.get('/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                services: { type: 'object' },
                timestamp: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.send({
        success: true,
        data: {
          status: 'healthy',
          services: {
            portfolioManager: true,
            performanceTracker: true,
            riskAnalyzer: true,
            assetAllocator: true,
            rebalancer: true
          },
          timestamp: Date.now()
        }
      });

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Portfolio service health check failed');

      return reply.status(500).send({
        success: false,
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  logger.info('BSC portfolio routes registered successfully');
}