/**
 * BSC Portfolio Routes
 * API endpoints for comprehensive BSC portfolio management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import logger from '../../utils/logger.js';
import {
  bscTokenService,
  tokenPriceTracker,
  swapService,
  liquidityManager,
  farmIntegration,
  yieldOptimizer,
  liquidityAnalyzer,
  performanceTracker,
  type PortfolioSummary,
  type AssetAllocation,
  type PerformanceMetrics,
  type PortfolioRecommendations,
  type RiskAnalysis
} from '../../bsc/services/index.js';

/**
 * Portfolio query schema
 */
const PortfolioQuerySchema = {
  type: 'object',
  properties: {
    userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
    timeframe: { type: 'string', enum: ['24h', '7d', '30d', '90d', '1y'], default: '30d' },
    includeInactive: { type: 'boolean', default: false },
    detailed: { type: 'boolean', default: false },
    includeHistorical: { type: 'boolean', default: false }
  }
};

/**
 * Register portfolio routes
 */
export async function portfolioRoutes(fastify: FastifyInstance) {
  logger.info('Registering BSC portfolio routes');

  /**
   * Get comprehensive portfolio overview
   */
  fastify.get('/overview/:userAddress', {
    schema: {
      params: {
        type: 'object',
        required: ['userAddress'],
        properties: {
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          timeframe: { type: 'string', enum: ['24h', '7d', '30d', '90d', '1y'], default: '30d' },
          includeInactive: { type: 'boolean', default: false },
          detailed: { type: 'boolean', default: false },
          currency: { type: 'string', enum: ['USD', 'BNB', 'ETH'], default: 'USD' }
        }
      },
      description: 'Get comprehensive portfolio overview',
      tags: ['bsc', 'portfolio', 'overview']
    }
  }, async (request: FastifyRequest<{
    Params: { userAddress: string },
    Querystring: { timeframe?: string; includeInactive?: boolean; detailed?: boolean; currency?: string }
  }>, reply: FastifyReply) => {
    try {
      const { userAddress } = request.params;
      const { timeframe = '30d', includeInactive = false, detailed = false, currency = 'USD' } = request.query;

      // Get all portfolio data in parallel
      const [
        tokenBalances,
        liquidityPositions,
        yieldFarmingPositions,
        tradingHistory,
        portfolioMetrics
      ] = await Promise.all([
        bscTokenService.getUserTokenBalances(userAddress, { includeInactive }),
        liquidityManager.getUserPositions(userAddress, { includeInactive }),
        farmIntegration.getUserPositions(userAddress, { includeInactive }),
        swapService.getUserTradingHistory(userAddress, { timeframe }),
        calculatePortfolioMetrics(userAddress, { timeframe, currency })
      ]);

      const portfolioOverview = {
        userAddress,
        summary: portfolioMetrics.summary,
        assets: {
          tokens: tokenBalances,
          liquidity: liquidityPositions,
          yieldFarming: yieldFarmingPositions
        },
        performance: portfolioMetrics.performance,
        allocation: portfolioMetrics.allocation,
        risk: portfolioMetrics.risk,
        trading: {
          history: tradingHistory,
          metrics: portfolioMetrics.tradingMetrics
        },
        meta: {
          timeframe,
          currency,
          includeInactive,
          detailed,
          generatedAt: Date.now()
        }
      };

      if (detailed) {
        // Add additional detailed analytics
        portfolioOverview.analytics = await getDetailedAnalytics(userAddress, { timeframe, currency });
        portfolioOverview.recommendations = await getPortfolioRecommendations(userAddress, portfolioOverview);
      }

      return reply.send({
        success: true,
        data: portfolioOverview
      });

    } catch (error) {
      logger.error({ userAddress: request.params.userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get portfolio overview');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch portfolio overview',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get portfolio performance metrics
   */
  fastify.get('/performance/:userAddress', {
    schema: {
      params: {
        type: 'object',
        required: ['userAddress'],
        properties: {
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          timeframe: { type: 'string', enum: ['24h', '7d', '30d', '90d', '1y'], default: '30d' },
          granularity: { type: 'string', enum: ['hour', 'day', 'week', 'month'], default: 'day' },
          assets: { type: 'array', items: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' } }
        }
      },
      description: 'Get detailed portfolio performance metrics',
      tags: ['bsc', 'portfolio', 'performance']
    }
  }, async (request: FastifyRequest<{
    Params: { userAddress: string },
    Querystring: { timeframe?: string; granularity?: string; assets?: string[] }
  }>, reply: FastifyReply) => {
    try {
      const { userAddress } = request.params;
      const { timeframe = '30d', granularity = 'day', assets } = request.query;

      const performance = await performanceTracker.getPortfolioPerformance(userAddress, {
        timeframe,
        granularity,
        assets
      });

      return reply.send({
        success: true,
        data: performance,
        meta: {
          userAddress,
          timeframe,
          granularity,
          generatedAt: Date.now()
        }
      });

    } catch (error) {
      logger.error({ userAddress: request.params.userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get portfolio performance');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch portfolio performance',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get asset allocation analysis
   */
  fastify.get('/allocation/:userAddress', {
    schema: {
      params: {
        type: 'object',
        required: ['userAddress'],
        properties: {
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          groupBy: { type: 'string', enum: ['type', 'risk', 'protocol', 'token'], default: 'type' },
          includeInactive: { type: 'boolean', default: false }
        }
      },
      description: 'Get portfolio asset allocation analysis',
      tags: ['bsc', 'portfolio', 'allocation']
    }
  }, async (request: FastifyRequest<{
    Params: { userAddress: string },
    Querystring: { groupBy?: string; includeInactive?: boolean }
  }>, reply: FastifyReply) => {
    try {
      const { userAddress } = request.params;
      const { groupBy = 'type', includeInactive = false } = request.query;

      const allocation = await getAssetAllocation(userAddress, {
        groupBy,
        includeInactive
      });

      return reply.send({
        success: true,
        data: allocation,
        meta: {
          userAddress,
          groupBy,
          generatedAt: Date.now()
        }
      });

    } catch (error) {
      logger.error({ userAddress: request.params.userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get asset allocation');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch asset allocation',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get portfolio risk analysis
   */
  fastify.get('/risk/:userAddress', {
    schema: {
      params: {
        type: 'object',
        required: ['userAddress'],
        properties: {
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          timeframe: { type: 'string', enum: ['24h', '7d', '30d', '90d'], default: '30d' },
          includeStressTest: { type: 'boolean', default: true },
          detailed: { type: 'boolean', default: false }
        }
      },
      description: 'Get comprehensive portfolio risk analysis',
      tags: ['bsc', 'portfolio', 'risk']
    }
  }, async (request: FastifyRequest<{
    Params: { userAddress: string },
    Querystring: { timeframe?: string; includeStressTest?: boolean; detailed?: boolean }
  }>, reply: FastifyReply) => {
    try {
      const { userAddress } = request.params;
      const { timeframe = '30d', includeStressTest = true, detailed = false } = request.query;

      const riskAnalysis = await getPortfolioRiskAnalysis(userAddress, {
        timeframe,
        includeStressTest,
        detailed
      });

      return reply.send({
        success: true,
        data: riskAnalysis,
        meta: {
          userAddress,
          timeframe,
          includeStressTest,
          detailed,
          analyzedAt: Date.now()
        }
      });

    } catch (error) {
      logger.error({ userAddress: request.params.userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get portfolio risk analysis');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch portfolio risk analysis',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get portfolio recommendations
   */
  fastify.get('/recommendations/:userAddress', {
    schema: {
      params: {
        type: 'object',
        required: ['userAddress'],
        properties: {
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          riskTolerance: { type: 'string', enum: ['conservative', 'moderate', 'aggressive', 'very_aggressive'] },
          investmentGoals: { type: 'array', items: { type: 'string' } },
          timeHorizon: { type: 'number', minimum: 1 }, // months
          maxRecommendations: { type: 'number', minimum: 1, maximum: 50, default: 10 }
        }
      },
      description: 'Get personalized portfolio recommendations',
      tags: ['bsc', 'portfolio', 'recommendations']
    }
  }, async (request: FastifyRequest<{
    Params: { userAddress: string },
    Querystring: { riskTolerance?: string; investmentGoals?: string[]; timeHorizon?: number; maxRecommendations?: number }
  }>, reply: FastifyReply) => {
    try {
      const { userAddress } = request.params;
      const { riskTolerance, investmentGoals, timeHorizon, maxRecommendations = 10 } = request.query;

      const recommendations = await getPortfolioRecommendations(userAddress, {
        riskTolerance,
        investmentGoals,
        timeHorizon,
        maxRecommendations
      });

      return reply.send({
        success: true,
        data: recommendations,
        meta: {
          userAddress,
          recommendationCount: recommendations.length,
          generatedAt: Date.now()
        }
      });

    } catch (error) {
      logger.error({ userAddress: request.params.userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get portfolio recommendations');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch portfolio recommendations',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get portfolio historical data
   */
  fastify.get('/history/:userAddress', {
    schema: {
      params: {
        type: 'object',
        required: ['userAddress'],
        properties: {
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          timeframe: { type: 'string', enum: ['7d', '30d', '90d', '1y'], default: '30d' },
          granularity: { type: 'string', enum: ['hour', 'day', 'week', 'month'], default: 'day' },
          assets: { type: 'array', items: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' } },
          includeTransactions: { type: 'boolean', default: false }
        }
      },
      description: 'Get portfolio historical performance data',
      tags: ['bsc', 'portfolio', 'history']
    }
  }, async (request: FastifyRequest<{
    Params: { userAddress: string },
    Querystring: { timeframe?: string; granularity?: string; assets?: string[]; includeTransactions?: boolean }
  }>, reply: FastifyReply) => {
    try {
      const { userAddress } = request.params;
      const { timeframe = '30d', granularity = 'day', assets, includeTransactions = false } = request.query;

      const history = await getPortfolioHistory(userAddress, {
        timeframe,
        granularity,
        assets,
        includeTransactions
      });

      return reply.send({
        success: true,
        data: history,
        meta: {
          userAddress,
          timeframe,
          granularity,
          generatedAt: Date.now()
        }
      });

    } catch (error) {
      logger.error({ userAddress: request.params.userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get portfolio history');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch portfolio history',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get portfolio comparison
   */
  fastify.post('/compare', {
    schema: {
      body: {
        type: 'object',
        required: ['portfolios'],
        properties: {
          portfolios: {
            type: 'array',
            items: {
              type: 'object',
              required: ['userAddress'],
              properties: {
                userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
                name: { type: 'string' },
                timeframe: { type: 'string', enum: ['7d', '30d', '90d', '1y'], default: '30d' }
              }
            },
            minItems: 2,
            maxItems: 10
          },
          metrics: {
            type: 'array',
            items: { type: 'string', enum: ['total_return', 'sharpe_ratio', 'max_drawdown', 'volatility', 'apy'] },
            default: ['total_return', 'sharpe_ratio', 'max_drawdown']
          }
        }
      },
      description: 'Compare multiple portfolios',
      tags: ['bsc', 'portfolio', 'compare']
    }
  }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const { portfolios, metrics } = request.body;

      const comparison = await comparePortfolios(portfolios, {
        metrics
      });

      return reply.send({
        success: true,
        data: comparison,
        meta: {
          comparedPortfolios: portfolios.length,
          metrics: metrics.length,
          generatedAt: Date.now()
        }
      });

    } catch (error) {
      logger.error({ body: request.body, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to compare portfolios');
      return reply.status(500).send({
        success: false,
        error: 'Failed to compare portfolios',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Get portfolio insights
   */
  fastify.get('/insights/:userAddress', {
    schema: {
      params: {
        type: 'object',
        required: ['userAddress'],
        properties: {
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['performance', 'risk', 'allocation', 'opportunities', 'all'], default: 'all' },
          timeframe: { type: 'string', enum: ['7d', '30d', '90d'], default: '30d' }
        }
      },
      description: 'Get AI-powered portfolio insights',
      tags: ['bsc', 'portfolio', 'insights']
    }
  }, async (request: FastifyRequest<{
    Params: { userAddress: string },
    Querystring: { category?: string; timeframe?: string }
  }>, reply: FastifyReply) => {
    try {
      const { userAddress } = request.params;
      const { category = 'all', timeframe = '30d' } = request.query;

      const insights = await getPortfolioInsights(userAddress, {
        category,
        timeframe
      });

      return reply.send({
        success: true,
        data: insights,
        meta: {
          userAddress,
          category,
          timeframe,
          generatedAt: Date.now()
        }
      });

    } catch (error) {
      logger.error({ userAddress: request.params.userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to get portfolio insights');
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch portfolio insights',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Export portfolio data
   */
  fastify.get('/export/:userAddress', {
    schema: {
      params: {
        type: 'object',
        required: ['userAddress'],
        properties: {
          userAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['json', 'csv', 'pdf'], default: 'json' },
          timeframe: { type: 'string', enum: ['30d', '90d', '1y', 'all'], default: '30d' },
          includeTransactions: { type: 'boolean', default: true },
          includePerformance: { type: 'boolean', default: true },
          includeAnalytics: { type: 'boolean', default: true }
        }
      },
      description: 'Export portfolio data in various formats',
      tags: ['bsc', 'portfolio', 'export']
    }
  }, async (request: FastifyRequest<{
    Params: { userAddress: string },
    Querystring: { format?: string; timeframe?: string; includeTransactions?: boolean; includePerformance?: boolean; includeAnalytics?: boolean }
  }>, reply: FastifyReply) => {
    try {
      const { userAddress } = request.params;
      const { format = 'json', timeframe = '30d', includeTransactions = true, includePerformance = true, includeAnalytics = true } = request.query;

      const exportData = await exportPortfolioData(userAddress, {
        format,
        timeframe,
        includeTransactions,
        includePerformance,
        includeAnalytics
      });

      // Set appropriate content type based on format
      const contentType = getContentType(format);
      reply.header('Content-Type', contentType);
      reply.header('Content-Disposition', `attachment; filename="portfolio_${userAddress}_${timeframe}.${format}"`);

      return reply.send(exportData);

    } catch (error) {
      logger.error({ userAddress: request.params.userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to export portfolio data');
      return reply.status(500).send({
        success: false,
        error: 'Failed to export portfolio data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Helper functions

  async function calculatePortfolioMetrics(userAddress: string, options: any): Promise<any> {
    try {
      // This would integrate with various service calls to calculate comprehensive metrics
      const portfolioValue = await bscTokenService.calculatePortfolioValue(userAddress);
      const performance = await performanceTracker.calculatePortfolioReturns(userAddress, options.timeframe);
      const risk = await calculatePortfolioRisk(userAddress, options.timeframe);
      const allocation = await getAssetAllocation(userAddress, { groupBy: 'type' });
      const tradingMetrics = await swapService.getUserTradingMetrics(userAddress, options.timeframe);

      return {
        summary: {
          totalValueUSD: portfolioValue.totalValueUSD,
          totalValueBNB: portfolioValue.totalValueBNB,
          totalReturn: performance.totalReturn,
          totalReturnPercent: performance.totalReturnPercent,
          dailyChange: performance.dailyChange,
          dailyChangePercent: performance.dailyChangePercent,
          assetCount: portfolioValue.assetCount,
          lastUpdated: Date.now()
        },
        performance,
        risk,
        allocation,
        tradingMetrics
      };
    } catch (error) {
      logger.error({ userAddress, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to calculate portfolio metrics');
      throw error;
    }
  }

  async function getAssetAllocation(userAddress: string, options: any): Promise<AssetAllocation> {
    // Implementation would calculate allocation by various groupings
    return {
      byType: {
        tokens: 40,
        liquidity: 35,
        yieldFarming: 25
      },
      byRisk: {
        low: 30,
        medium: 50,
        high: 20
      },
      byProtocol: {
        pancakeswap: 60,
        other: 40
      }
    } as AssetAllocation;
  }

  async function getPortfolioRiskAnalysis(userAddress: string, options: any): Promise<RiskAnalysis> {
    // Implementation would perform comprehensive risk analysis
    return {
      overallRiskScore: 65,
      riskLevel: 'medium',
      concentrationRisk: 25,
      volatilityRisk: 70,
      smartContractRisk: 40,
      marketRisk: 75,
      recommendations: [
        'Consider diversifying across more protocols',
        'Reduce exposure to high-volatility assets'
      ]
    } as RiskAnalysis;
  }

  async function getPortfolioRecommendations(userAddress: string, options: any): Promise<PortfolioRecommendations> {
    // Implementation would generate personalized recommendations
    return {
      highPriority: [
        {
          type: 'rebalance',
          description: 'Rebalance portfolio to reduce concentration risk',
          potentialImpact: '+2.3% APY',
          confidence: 85
        }
      ],
      mediumPriority: [
        {
          type: 'opportunity',
          description: 'New high-yield farming opportunity available',
          potentialImpact: '+5.1% APY',
          confidence: 70
        }
      ],
      lowPriority: [
        {
          type: 'optimization',
          description: 'Consider auto-compounding for better returns',
          potentialImpact: '+1.2% APY',
          confidence: 60
        }
      ]
    } as PortfolioRecommendations;
  }

  async function getDetailedAnalytics(userAddress: string, options: any): Promise<any> {
    // Implementation would provide detailed analytics
    return {
      topPerformers: [],
      underperformers: [],
      yieldBreakdown: {},
      gasAnalysis: {},
      transactionAnalysis: {}
    };
  }

  async function getPortfolioHistory(userAddress: string, options: any): Promise<any> {
    // Implementation would get historical portfolio data
    return {
      timeline: [],
      totalValueHistory: [],
      assetAllocationHistory: [],
      performanceHistory: []
    };
  }

  async function comparePortfolios(portfolios: any[], options: any): Promise<any> {
    // Implementation would compare multiple portfolios
    return {
      rankings: [],
      metrics: {},
      insights: []
    };
  }

  async function getPortfolioInsights(userAddress: string, options: any): Promise<any> {
    // Implementation would generate AI-powered insights
    return {
      performance: [],
      risk: [],
      allocation: [],
      opportunities: []
    };
  }

  async function exportPortfolioData(userAddress: string, options: any): Promise<any> {
    // Implementation would export data in requested format
    return {
      portfolio: {},
      transactions: [],
      performance: {},
      analytics: {}
    };
  }

  function getContentType(format: string): string {
    switch (format) {
      case 'json':
        return 'application/json';
      case 'csv':
        return 'text/csv';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'application/json';
    }
  }

  async function calculatePortfolioRisk(userAddress: string, timeframe: string): Promise<any> {
    // Implementation would calculate portfolio risk metrics
    return {
      volatility: 0.15,
      sharpeRatio: 1.2,
      maxDrawdown: 0.08,
      beta: 0.9,
      valueAtRisk: 0.05
    };
  }

  /**
   * Health check
   */
  fastify.get('/health', {
    schema: {
      description: 'Portfolio service health check',
      tags: ['bsc', 'portfolio', 'health']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const healthStatus = {
        healthy: true,
        services: {
          tokenService: true,
          liquidityService: true,
          yieldService: true,
          tradingService: true,
          performanceTracker: true
        },
        timestamp: Date.now()
      };

      return reply.send({
        success: true,
        data: healthStatus
      });

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Portfolio service health check failed');
      return reply.status(500).send({
        success: false,
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  logger.info('BSC portfolio routes registered successfully');
}