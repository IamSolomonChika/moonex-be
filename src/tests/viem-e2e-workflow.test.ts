/**
 * Viem E2E Workflow Tests
 * Comprehensive end-to-end testing of Viem migration workflows
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Viem imports for e2e testing
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  Address,
  Hash,
  Chain,
  Account,
  PublicClient,
  WalletClient,
  Transport
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';

// Viem-based services for e2e workflows
import { BSCTokenServiceViem } from '../bsc/services/tokens/token-service-viem.js';
import { SwapServiceViem } from '../bsc/services/trading/swap-service-viem.js';
import { PancakeSwapRouterViem } from '../bsc/services/trading/pancakeSwap-router-viem.js';
import { LiquidityServiceViem } from '../bsc/services/liquidity/liquidity-service-viem.js';
import { YieldFarmingServiceViem } from '../bsc/services/yield/farming-service-viem.js';
import { CakeGovernanceServiceViem } from '../bsc/services/governance/cake-governance-viem.js';
import { RealTimeUpdaterViem } from '../bsc/services/performance/realtime-updater-viem.js';
import { AdvancedBatchProcessorViem } from '../bsc/services/performance/batch-processor-viem.js';
import { BSCTransactionOptimizerViem } from '../bsc/services/performance/transaction-optimizer-viem.js';

// Test setup utilities
import {
  setupBSCTestEnv,
  TestDataGenerators,
  PerformanceUtils,
  ErrorUtils
} from './setup/viem-test-setup.js';

describe('Viem E2E Workflow Tests', () => {
  let publicClient: PublicClient<Transport, Chain>;
  let walletClient: WalletClient<Transport, Chain>;
  let testAccount: Account;
  let testClients: any;

  // Viem-based services
  let tokenService: BSCTokenServiceViem;
  let swapService: SwapServiceViem;
  let pancakeSwapRouter: PancakeSwapRouterViem;
  let liquidityService: LiquidityServiceViem;
  let yieldService: YieldFarmingServiceViem;
  let governanceService: CakeGovernanceServiceViem;

  // Performance services
  let realTimeUpdater: RealTimeUpdaterViem;
  let batchProcessor: AdvancedBatchProcessorViem;
  let txOptimizer: BSCTransactionOptimizerViem;

  // Test data
  const testTokens = {
    WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
    BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
    CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' as Address,
    USDT: '0x55d398326f99059fF775485246999027B3197955' as Address
  };

  beforeAll(async () => {
    // Setup test environment
    testClients = setupBSCTestEnv();
    publicClient = testClients.publicClient;
    walletClient = testClients.walletClient;
    testAccount = testClients.testAccount;

    // Initialize Viem-based services
    pancakeSwapRouter = new PancakeSwapRouterViem(publicClient, walletClient);
    swapService = new SwapServiceViem(publicClient, walletClient, pancakeSwapRouter);
    tokenService = new BSCTokenServiceViem(publicClient);
    liquidityService = new LiquidityServiceViem(publicClient, walletClient);
    yieldService = new YieldFarmingServiceViem(publicClient, walletClient);
    governanceService = new CakeGovernanceServiceViem(publicClient, walletClient);

    // Initialize performance services
    realTimeUpdater = new RealTimeUpdaterViem(publicClient);
    batchProcessor = new AdvancedBatchProcessorViem(publicClient);
    txOptimizer = new BSCTransactionOptimizerViem(publicClient);
  });

  afterAll(async () => {
    // Cleanup services
    await realTimeUpdater.shutdown();
    await batchProcessor.shutdown();
    await txOptimizer.shutdown();
  });

  beforeEach(() => {
    // Reset service metrics before each test
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup any ongoing operations
    await Promise.allSettled([
      realTimeUpdater.clearSubscriptions(),
      batchProcessor.clearQueue()
    ]);
  });

  describe('Complete Trading Workflow E2E', () => {
    test('should execute complete trading workflow from token discovery to swap execution', async () => {
      // 1. Token Discovery Phase
      const wbnbInfo = await tokenService.getTokenInfo(testTokens.WBNB);
      const busdInfo = await tokenService.getTokenInfo(testTokens.BUSD);

      expect(wbnbInfo.symbol).toBe('WBNB');
      expect(busdInfo.symbol).toBe('BUSD');
      expect(wbnbInfo.decimals).toBe(18);
      expect(busdInfo.decimals).toBe(18);

      // 2. Balance Checking Phase
      const wbnbBalance = await tokenService.getBalance(testAccount.address, testTokens.WBNB);
      const busdBalance = await tokenService.getBalance(testAccount.address, testTokens.BUSD);

      expect(typeof wbnbBalance).toBe('bigint');
      expect(typeof busdBalance).toBe('bigint');

      // 3. Swap Quote Generation Phase
      const swapQuote = await swapService.getSwapQuote({
        tokenIn: testTokens.WBNB,
        tokenOut: testTokens.BUSD,
        amountIn: parseEther('0.1'),
        slippageTolerancePercent: 0.5
      });

      expect(swapQuote).toBeDefined();
      expect(swapQuote.amountOut).toBeGreaterThan(0n);
      expect(swapQuote.route).toBeDefined();
      expect(swapQuote.gasEstimate).toBeGreaterThan(0n);

      // 4. Liquidity Pool Information Phase
      const poolInfo = await liquidityService.getPoolInfo({
        tokenA: testTokens.WBNB,
        tokenB: testTokens.BUSD
      });

      expect(poolInfo).toBeDefined();
      expect(poolInfo.reserve0).toBeGreaterThanOrEqual(0n);
      expect(poolInfo.reserve1).toBeGreaterThanOrEqual(0n);

      // 5. Gas Optimization Phase
      const gasOptimization = await txOptimizer.optimizeTransaction({
        to: swapQuote.router,
        value: swapQuote.amountOut,
        data: swapQuote.transactionData || '0x',
        gasLimit: swapQuote.gasEstimate
      });

      expect(gasOptimization).toBeDefined();
      expect(gasOptimization.gasPrice).toBeGreaterThan(0n);
      expect(gasOptimization.gasLimit).toBeGreaterThan(0n);

      // 6. Transaction Validation Phase
      const isValidTransaction = await swapService.validateTransaction({
        tokenIn: testTokens.WBNB,
        tokenOut: testTokens.BUSD,
        amountIn: parseEther('0.1'),
        amountOutMin: swapQuote.amountOut,
        recipient: testAccount.address,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 300) // 5 minutes
      });

      expect(isValidTransaction).toBe(true);

      // 7. Performance Metrics Validation
      const performanceMetrics = {
        tokenService: tokenService.getMetrics(),
        swapService: swapService.getMetrics(),
        liquidityService: liquidityService.getMetrics(),
        txOptimizer: txOptimizer.getMetrics()
      };

      Object.values(performanceMetrics).forEach(metrics => {
        expect(metrics).toBeDefined();
        expect(typeof metrics.totalOperations).toBe('number');
        expect(typeof metrics.successfulOperations).toBe('number');
      });
    }, 30000);

    test('should handle multi-hop trading workflow', async () => {
      // Test a more complex trading route: WBNB -> BUSD -> CAKE
      const multiHopRoute = await swapService.getMultiHopQuote({
        tokenIn: testTokens.WBNB,
        tokenOut: testTokens.CAKE,
        amountIn: parseEther('0.1'),
        slippageTolerancePercent: 1.0,
        maxHops: 2
      });

      expect(multiHopRoute).toBeDefined();
      expect(multiHopRoute.amountOut).toBeGreaterThan(0n);
      expect(Array.isArray(multiHopRoute.route)).toBe(true);
      expect(multiHopRoute.route.length).toBeGreaterThan(1);
    }, 20000);

    test('should recover from trading failures gracefully', async () => {
      // Test failure recovery with invalid token
      await ErrorUtils.expectAnyError(async () => {
        await swapService.getSwapQuote({
          tokenIn: TestDataGenerators.randomAddress(),
          tokenOut: testTokens.BUSD,
          amountIn: parseEther('0.1'),
          slippageTolerancePercent: 0.5
        });
      });

      // Verify service is still functional after error
      const validQuote = await swapService.getSwapQuote({
        tokenIn: testTokens.WBNB,
        tokenOut: testTokens.BUSD,
        amountIn: parseEther('0.05'),
        slippageTolerancePercent: 0.5
      });

      expect(validQuote.amountOut).toBeGreaterThan(0n);
    });
  });

  describe('Liquidity Management Workflow E2E', () => {
    test('should execute complete liquidity provision workflow', async () => {
      // 1. Pool Analysis Phase
      const poolInfo = await liquidityService.getPoolInfo({
        tokenA: testTokens.WBNB,
        tokenB: testTokens.BUSD
      });

      expect(poolInfo).toBeDefined();

      // 2. Liquidity Calculation Phase
      const liquidityAmounts = liquidityService.calculateLiquidityAmounts({
        amountADesired: parseEther('0.1'),
        amountBDesired: parseEther('50'),
        reserveA: poolInfo.reserve0,
        reserveB: poolInfo.reserve1
      });

      expect(liquidityAmounts.amountA).toBeGreaterThan(0n);
      expect(liquidityAmounts.amountB).toBeGreaterThan(0n);

      // 3. APR Calculation Phase
      const apr = liquidityService.calculateAPR({
        poolInfo,
        feeApr: 0.25, // 0.25% trading fee
        rewardApr: 0.0  // No rewards for basic pool
      });

      expect(typeof apr).toBe('number');
      expect(apr).toBeGreaterThanOrEqual(0);

      // 4. Impermanent Loss Calculation Phase
      const impermanentLoss = liquidityService.calculateImpermanentLoss({
        priceRatio: 1.2, // 20% price change
        initialPriceRatio: 1.0
      });

      expect(typeof impermanentLoss).toBe('number');
      expect(impermanentLoss).toBeGreaterThanOrEqual(0);

      // 5. Liquidity Position Simulation Phase
      const positionSimulation = liquidityService.simulateLiquidityPosition({
        tokenA: testTokens.WBNB,
        tokenB: testTokens.BUSD,
        amountA: liquidityAmounts.amountA,
        amountB: liquidityAmounts.amountB,
        priceChangeRange: [-0.5, 0.5] // -50% to +50% price change
      });

      expect(positionSimulation).toBeDefined();
      expect(Array.isArray(positionSimulation.profitLossScenarios)).toBe(true);
    }, 25000);

    test('should handle liquidity removal workflow', async () => {
      // Simulate existing liquidity position
      const existingPosition = {
        liquidity: parseEther('10'),
        tokenA: testTokens.WBNB,
        tokenB: testTokens.BUSD
      };

      // Calculate removal amounts
      const removalAmounts = liquidityService.calculateLiquidityRemoval({
        liquidity: existingPosition.liquidity,
        totalSupply: parseEther('100'),
        reserveA: parseEther('50'),
        reserveB: parseEther('2500')
      });

      expect(removalAmounts.amountA).toBeGreaterThan(0n);
      expect(removalAmounts.amountB).toBeGreaterThan(0n);
    });
  });

  describe('Yield Farming Workflow E2E', () => {
    test('should execute complete yield farming workflow', async () => {
      // 1. Farm Discovery Phase
      const farms = await yieldService.getFarms();
      expect(Array.isArray(farms)).toBe(true);

      if (farms.length > 0) {
        const selectedFarm = farms[0];

        // 2. Farm Analysis Phase
        const farmAnalysis = await yieldService.analyzeFarm({
          farmAddress: selectedFarm.address,
          stakeTokenAddress: selectedFarm.stakeToken,
          rewardTokenAddress: selectedFarm.rewardToken
        });

        expect(farmAnalysis).toBeDefined();
        expect(farmAnalysis.apr).toBeGreaterThanOrEqual(0);

        // 3. Staking Simulation Phase
        const stakingSimulation = yieldService.simulateStaking({
          farmAddress: selectedFarm.address,
          stakeAmount: parseEther('10'),
          stakingPeriod: 30 // 30 days
        });

        expect(stakingSimulation).toBeDefined();
        expect(stakingSimulation.expectedRewards).toBeGreaterThanOrEqual(0n);

        // 4. Auto-compound Analysis Phase
        const compoundAnalysis = yieldService.analyzeAutoCompound({
          farmAddress: selectedFarm.address,
          stakeAmount: parseEther('10'),
          compoundFrequency: 'daily', // Daily compounding
          period: 30 // 30 days
        });

        expect(compoundAnalysis).toBeDefined();
        expect(compoundAnalysis.totalRewards).toBeGreaterThanOrEqual(0n);
        expect(compoundAnalysis.compoundAPY).toBeGreaterThanOrEqual(0);
      }
    }, 30000);

    test('should handle farm switching workflow', async () => {
      const farms = await yieldService.getFarms();

      if (farms.length >= 2) {
        // Simulate switching between farms
        const farmComparison = yieldService.compareFarms([
          farms[0],
          farms[1]
        ]);

        expect(farmComparison).toBeDefined();
        expect(Array.isArray(farmComparison.comparisonMatrix)).toBe(true);
        expect(farmComparison.recommendation).toBeDefined();
      }
    });
  });

  describe('Governance Participation Workflow E2E', () => {
    test('should execute complete governance workflow', async () => {
      // 1. Voting Power Analysis Phase
      const votingPower = await governanceService.getVotingPower(testAccount.address);
      expect(typeof votingPower).toBe('bigint');
      expect(votingPower).toBeGreaterThanOrEqual(0n);

      // 2. Proposal Discovery Phase
      const proposals = await governanceService.getProposals();
      expect(Array.isArray(proposals)).toBe(true);

      if (proposals.length > 0) {
        const activeProposal = proposals.find(p => p.status === 'active');

        if (activeProposal) {
          // 3. Proposal Analysis Phase
          const proposalAnalysis = await governanceService.analyzeProposal({
            proposalId: activeProposal.id,
            voterAddress: testAccount.address
          });

          expect(proposalAnalysis).toBeDefined();
          expect(proposalAnalysis.canVote).toBeDefined();

          // 4. Vote Simulation Phase
          const voteSimulation = governanceService.simulateVote({
            proposalId: activeProposal.id,
            voterAddress: testAccount.address,
            support: true,
            votingPower: votingPower
          });

          expect(voteSimulation).toBeDefined();
          expect(voteSimulation.impact).toBeDefined();
        }
      }

      // 5. Delegation Analysis Phase
      const delegationAnalysis = await governanceService.analyzeDelegation({
        delegatorAddress: testAccount.address
      });

      expect(delegationAnalysis).toBeDefined();
      expect(delegationAnalysis.currentDelegate).toBeDefined();

      // 6. Governance Metrics Phase
      const governanceMetrics = governanceService.getGovernanceMetrics();
      expect(governanceMetrics).toBeDefined();
      expect(governanceMetrics.totalProposals).toBeGreaterThanOrEqual(0);
      expect(governanceMetrics.participationRate).toBeGreaterThanOrEqual(0);
    }, 25000);
  });

  describe('Real-time Data Workflow E2E', () => {
    test('should execute complete real-time data workflow', async () => {
      // 1. Subscription Setup Phase
      const subscriptionPromises = [];

      // Block subscription
      const blockSubscription = realTimeUpdater.subscribe('block', (data) => {
        expect(data).toBeDefined();
        expect(data.blockNumber).toBeDefined();
      });
      expect(typeof blockSubscription).toBe('string');

      // Token price subscription
      const priceSubscription = realTimeUpdater.subscribe('price', (data) => {
        expect(data).toBeDefined();
        expect(data.tokenAddress).toBeDefined();
        expect(data.price).toBeDefined();
      }, { tokenAddress: testTokens.WBNB });
      expect(typeof priceSubscription).toBe('string');

      // 2. Real-time Data Processing Phase
      const realTimeMetrics = realTimeUpdater.getMetrics();
      expect(realTimeMetrics).toBeDefined();
      expect(realTimeMetrics.totalUpdates).toBeGreaterThanOrEqual(0);
      expect(realTimeMetrics.activeSubscriptions).toBeGreaterThanOrEqual(0);

      // 3. Event Monitoring Phase
      let eventReceived = false;
      const eventSubscription = realTimeUpdater.subscribe('event', (data) => {
        eventReceived = true;
        expect(data).toBeDefined();
        expect(data.eventName).toBeDefined();
        expect(data.transactionHash).toBeDefined();
      }, { contractAddress: testTokens.WBNB });

      // Wait for potential events
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 4. Subscription Management Phase
      const unsubscribedBlock = realTimeUpdater.unsubscribe(blockSubscription);
      expect(unsubscribedBlock).toBe(true);

      const unsubscribedPrice = realTimeUpdater.unsubscribe(priceSubscription);
      expect(unsubscribedPrice).toBe(true);

      const unsubscribedEvent = realTimeUpdater.unsubscribe(eventSubscription);
      expect(unsubscribedEvent).toBe(true);

      // 5. Cleanup Validation Phase
      const finalMetrics = realTimeUpdater.getMetrics();
      expect(finalMetrics.activeSubscriptions).toBe(0);
    }, 20000);

    test('should handle real-time data buffering and batching', async () => {
      // Test data buffering capabilities
      const bufferConfig = {
        bufferSize: 100,
        flushInterval: 1000, // 1 second
        maxWaitTime: 5000   // 5 seconds
      };

      const bufferedProcessor = new RealTimeUpdaterViem(publicClient, bufferConfig);

      // Subscribe to multiple data streams
      const subscriptions = [];
      for (let i = 0; i < 5; i++) {
        const subId = bufferedProcessor.subscribe('price', (data) => {
          expect(data).toBeDefined();
        });
        subscriptions.push(subId);
      }

      // Wait for buffer processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify buffer metrics
      const bufferMetrics = bufferedProcessor.getBufferMetrics();
      expect(bufferMetrics).toBeDefined();
      expect(bufferMetrics.bufferUtilization).toBeGreaterThanOrEqual(0);
      expect(bufferMetrics.averageProcessingTime).toBeGreaterThanOrEqual(0);

      // Cleanup
      subscriptions.forEach(subId => bufferedProcessor.unsubscribe(subId));
      await bufferedProcessor.shutdown();
    });
  });

  describe('Batch Processing Workflow E2E', () => {
    test('should execute complete batch processing workflow', async () => {
      // 1. Batch Creation Phase
      const operations = [];
      for (let i = 0; i < 5; i++) {
        const operation = {
          type: 'APPROVE' as const,
          target: testTokens.BUSD,
          amount: parseEther('10'),
          spender: testAccount.address
        };
        operations.push(operation);
      }

      // 2. Batch Submission Phase
      const batchPromises = operations.map(op =>
        batchProcessor.submitOperation(op.type, op)
      );

      const batchIds = await Promise.all(batchPromises);
      expect(batchIds).toHaveLength(5);

      batchIds.forEach(id => {
        expect(typeof id).toBe('string');
        expect(id).toMatch(/^op_\d+_[a-z0-9]+$/);
      });

      // 3. Batch Monitoring Phase
      const batchStatuses = await Promise.all(
        batchIds.map(id => batchProcessor.getOperationStatus(id))
      );

      batchStatuses.forEach(status => {
        expect(status).toBeDefined();
        expect(status.id).toBeDefined();
        expect(['queued', 'pending', 'processing', 'completed', 'failed']).toContain(status.status);
      });

      // 4. Batch Optimization Phase
      const optimizationResult = await batchProcessor.optimizeBatch({
        operationIds: batchIds,
        optimizationStrategy: 'gas_efficient'
      });

      expect(optimizationResult).toBeDefined();
      expect(optimizationResult.optimizedOperations).toBeDefined();
      expect(optimizationResult.gasSavings).toBeGreaterThanOrEqual(0);

      // 5. Batch Cancellation Phase
      const cancellationResults = await Promise.all(
        batchIds.map(id => batchProcessor.cancelOperation(id))
      );

      cancellationResults.forEach(result => {
        expect(result).toBe(true);
      });

      // 6. Batch Metrics Phase
      const batchMetrics = batchProcessor.getMetrics();
      expect(batchMetrics).toBeDefined();
      expect(batchMetrics.totalBatches).toBeGreaterThanOrEqual(5);
      expect(batchMetrics.cancelledOperations).toBeGreaterThanOrEqual(5);
    }, 30000);

    test('should handle batch processing failures gracefully', async () => {
      // Submit operations that will fail
      const invalidOperation = {
        type: 'INVALID_OPERATION' as any,
        target: TestDataGenerators.randomAddress(),
        amount: parseEther('0')
      };

      const operationId = await batchProcessor.submitOperation(
        invalidOperation.type,
        invalidOperation
      );

      expect(typeof operationId).toBe('string');

      // Monitor failure handling
      const status = await batchProcessor.getOperationStatus(operationId);
      expect(status.status).toBe('failed');

      // Verify batch processor is still functional
      const validOperation = {
        type: 'APPROVE' as const,
        target: testTokens.WBNB,
        amount: parseEther('1'),
        spender: testAccount.address
      };

      const validOperationId = await batchProcessor.submitOperation(
        validOperation.type,
        validOperation
      );

      expect(typeof validOperationId).toBe('string');
      expect(validOperationId).not.toBe(operationId);

      await batchProcessor.cancelOperation(validOperationId);
    });
  });

  describe('Cross-Service Integration Workflow E2E', () => {
    test('should execute complex cross-service workflow', async () => {
      // Complex workflow: Trading -> Liquidity -> Yield Farming -> Governance

      // 1. Trading Phase
      const swapQuote = await swapService.getSwapQuote({
        tokenIn: testTokens.WBNB,
        tokenOut: testTokens.BUSD,
        amountIn: parseEther('0.5'),
        slippageTolerancePercent: 0.5
      });

      expect(swapQuote.amountOut).toBeGreaterThan(0n);

      // 2. Liquidity Analysis Phase
      const poolInfo = await liquidityService.getPoolInfo({
        tokenA: testTokens.WBNB,
        tokenB: testTokens.BUSD
      });

      const liquidityAmounts = liquidityService.calculateLiquidityAmounts({
        amountADesired: parseEther('0.25'),
        amountBDesired: swapQuote.amountOut / 2n,
        reserveA: poolInfo.reserve0,
        reserveB: poolInfo.reserve1
      });

      // 3. Yield Farming Analysis Phase
      const farms = await yieldService.getFarms();
      let bestFarm = null;
      let highestAPR = 0;

      if (farms.length > 0) {
        for (const farm of farms) {
          const farmAnalysis = await yieldService.analyzeFarm({
            farmAddress: farm.address,
            stakeTokenAddress: farm.stakeToken,
            rewardTokenAddress: farm.rewardToken
          });

          if (farmAnalysis.apr > highestAPR) {
            highestAPR = farmAnalysis.apr;
            bestFarm = farm;
          }
        }
      }

      // 4. Governance Participation Phase
      const votingPower = await governanceService.getVotingPower(testAccount.address);
      const proposals = await governanceService.getProposals();

      // 5. Real-time Monitoring Phase
      const realTimeSubscriptions = [];

      const blockSubscription = realTimeUpdater.subscribe('block', () => {});
      realTimeSubscriptions.push(blockSubscription);

      const priceSubscription = realTimeUpdater.subscribe('price', () => {}, {
        tokenAddress: testTokens.WBNB
      });
      realTimeSubscriptions.push(priceSubscription);

      // 6. Performance Analysis Phase
      const performanceReport = {
        trading: {
          quoteAmount: swapQuote.amountOut,
          gasEstimate: swapQuote.gasEstimate,
          priceImpact: swapQuote.priceImpact
        },
        liquidity: {
          poolReserve0: poolInfo.reserve0,
          poolReserve1: poolInfo.reserve1,
          calculatedAmountA: liquidityAmounts.amountA,
          calculatedAmountB: liquidityAmounts.amountB
        },
        yieldFarming: {
          bestFarmAPR: highestAPR,
          totalFarms: farms.length
        },
        governance: {
          votingPower,
          activeProposals: proposals.filter(p => p.status === 'active').length
        },
        realTime: {
          activeSubscriptions: realTimeSubscriptions.length,
          totalUpdates: realTimeUpdater.getMetrics().totalUpdates
        }
      };

      // Validate comprehensive report
      expect(performanceReport.trading.quoteAmount).toBeGreaterThan(0n);
      expect(performanceReport.liquidity.poolReserve0).toBeGreaterThanOrEqual(0n);
      expect(performanceReport.yieldFarming.totalFarms).toBeGreaterThanOrEqual(0);
      expect(performanceReport.governance.votingPower).toBeGreaterThanOrEqual(0n);
      expect(performanceReport.realTime.activeSubscriptions).toBe(2);

      // 7. Cleanup Phase
      realTimeSubscriptions.forEach(subId => realTimeUpdater.unsubscribe(subId));
    }, 45000);

    test('should handle concurrent cross-service operations', async () => {
      // Execute multiple operations across different services concurrently
      const concurrentOperations = [
        // Trading operations
        swapService.getSwapQuote({
          tokenIn: testTokens.WBNB,
          tokenOut: testTokens.BUSD,
          amountIn: parseEther('0.1'),
          slippageTolerancePercent: 0.5
        }),

        // Liquidity operations
        liquidityService.getPoolInfo({
          tokenA: testTokens.WBNB,
          tokenB: testTokens.CAKE
        }),

        // Token operations
        tokenService.getTokenInfo(testTokens.USDT),

        // Yield farming operations
        yieldService.getFarms(),

        // Governance operations
        governanceService.getVotingPower(testAccount.address),

        // Performance operations
        txOptimizer.getNetworkStats(),

        // Real-time operations
        realTimeUpdater.getMetrics()
      ];

      const startTime = Date.now();
      const results = await Promise.allSettled(concurrentOperations);
      const endTime = Date.now();

      // Validate all operations completed
      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value).toBeDefined();
        }
      });

      // Performance validation
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      // Validate metrics consistency
      const finalMetrics = {
        swapService: swapService.getMetrics(),
        tokenService: tokenService.getMetrics(),
        liquidityService: liquidityService.getMetrics(),
        yieldService: yieldService.getMetrics(),
        governanceService: governanceService.getMetrics(),
        realTimeUpdater: realTimeUpdater.getMetrics(),
        txOptimizer: txOptimizer.getMetrics()
      };

      Object.values(finalMetrics).forEach(metrics => {
        expect(metrics).toBeDefined();
        expect(typeof metrics.totalOperations).toBe('number');
        expect(metrics.totalOperations).toBeGreaterThanOrEqual(0);
      });
    }, 20000);
  });

  describe('Performance and Scalability Workflow E2E', () => {
    test('should handle high-volume trading operations', async () => {
      const tradingVolume = parseEther('10');
      const numberOfTrades = 10;

      const performanceResults = await PerformanceUtils.benchmark(async () => {
        const trades = [];
        for (let i = 0; i < numberOfTrades; i++) {
          const tradeAmount = tradingVolume / BigInt(numberOfTrades);
          const quote = await swapService.getSwapQuote({
            tokenIn: testTokens.WBNB,
            tokenOut: testTokens.BUSD,
            amountIn: tradeAmount,
            slippageTolerancePercent: 0.5
          });
          trades.push(quote);
        }
        return trades;
      }, 3); // Run 3 iterations

      expect(performanceResults.averageTime).toBeLessThan(15000); // Average < 15 seconds
      expect(performanceResults.results).toHaveLength(3);

      performanceResults.results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(numberOfTrades);

        result.forEach(trade => {
          expect(trade.amountOut).toBeGreaterThan(0n);
        });
      });
    }, 60000);

    test('should maintain performance under memory stress', async () => {
      // Create memory stress by processing large amounts of data
      const memoryIntensiveOperations = [];

      for (let i = 0; i < 100; i++) {
        memoryIntensiveOperations.push(
          tokenService.getTokenInfo(testTokens.WBNB),
          swapService.getSwapQuote({
            tokenIn: testTokens.WBNB,
            tokenOut: testTokens.BUSD,
            amountIn: parseEther('0.001'),
            slippageTolerancePercent: 0.5
          }),
          liquidityService.getPoolInfo({
            tokenA: testTokens.WBNB,
            tokenB: testTokens.BUSD
          })
        );
      }

      const { result: memoryResults, time: memoryTime } = await PerformanceUtils.measureTime(async () => {
        return Promise.allSettled(memoryIntensiveOperations);
      });

      expect(memoryResults).toHaveLength(300); // 100 operations × 3 services each
      expect(memoryTime).toBeLessThan(30000); // Should complete within 30 seconds

      // Verify services are still responsive
      const postStressQuote = await swapService.getSwapQuote({
        tokenIn: testTokens.WBNB,
        tokenOut: testTokens.BUSD,
        amountIn: parseEther('0.1'),
        slippageTolerancePercent: 0.5
      });

      expect(postStressQuote.amountOut).toBeGreaterThan(0n);
    }, 45000);
  });

  describe('Error Recovery and Resilience Workflow E2E', () => {
    test('should recover from network failures', async () => {
      // Simulate network failure by using invalid endpoint
      const faultyClient = createPublicClient({
        chain: bscTestnet,
        transport: http('http://invalid-endpoint')
      });

      const faultyTokenService = new BSCTokenServiceViem(faultyClient);
      const faultySwapService = new SwapServiceViem(faultyClient, walletClient);

      // Verify services fail gracefully
      await ErrorUtils.expectAnyError(async () => {
        await faultyTokenService.getTokenInfo(testTokens.WBNB);
      });

      await ErrorUtils.expectAnyError(async () => {
        await faultySwapService.getSwapQuote({
          tokenIn: testTokens.WBNB,
          tokenOut: testTokens.BUSD,
          amountIn: parseEther('0.1'),
          slippageTolerancePercent: 0.5
        });
      });

      // Verify original services still work
      const recoveryQuote = await swapService.getSwapQuote({
        tokenIn: testTokens.WBNB,
        tokenOut: testTokens.BUSD,
        amountIn: parseEther('0.1'),
        slippageTolerancePercent: 0.5
      });

      expect(recoveryQuote.amountOut).toBeGreaterThan(0n);
    });

    test('should handle service degradation gracefully', async () => {
      // Test with malformed responses
      const degradationPromises = [
        // Invalid token address
        ErrorUtils.expectAnyError(async () => {
          await swapService.getSwapQuote({
            tokenIn: '0xinvalid' as Address,
            tokenOut: testTokens.BUSD,
            amountIn: parseEther('0.1'),
            slippageTolerancePercent: 0.5
          });
        }),

        // Zero amount
        ErrorUtils.expectAnyError(async () => {
          await swapService.getSwapQuote({
            tokenIn: testTokens.WBNB,
            tokenOut: testTokens.BUSD,
            amountIn: 0n,
            slippageTolerancePercent: 0.5
          });
        }),

        // Excessive slippage
        swapService.getSwapQuote({
          tokenIn: testTokens.WBNB,
          tokenOut: testTokens.BUSD,
          amountIn: parseEther('0.1'),
          slippageTolerancePercent: 50.0
        })
      ];

      const degradationResults = await Promise.allSettled(degradationPromises);

      // Two should fail, one should succeed
      const failures = degradationResults.filter(r => r.status === 'rejected');
      const successes = degradationResults.filter(r => r.status === 'fulfilled');

      expect(failures).toHaveLength(2);
      expect(successes).toHaveLength(1);

      // Verify services recover and continue functioning
      const postDegradationQuote = await swapService.getSwapQuote({
        tokenIn: testTokens.WBNB,
        tokenOut: testTokens.BUSD,
        amountIn: parseEther('0.1'),
        slippageTolerancePercent: 0.5
      });

      expect(postDegradationQuote.amountOut).toBeGreaterThan(0n);
    });
  });
});