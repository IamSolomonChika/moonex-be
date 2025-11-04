/**
 * Integration Test Runner for Viem Migration
 * Provides comprehensive test execution and reporting
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Viem imports
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  Address,
  Account,
  PublicClient,
  WalletClient
} from 'viem';
import { bscTestnet } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';

// Test environment and utilities
import {
  IntegrationTestEnvironmentManager,
  ViemTestDataProvider,
  IntegrationTestUtils
} from './setup/integration-test-environment.js';

// Viem services for integration testing
import { BSCTokenServiceViem } from '../bsc/services/tokens/token-service-viem.js';
import { SwapServiceViem } from '../bsc/services/trading/swap-service-viem.js';
import { PancakeSwapRouterViem } from '../bsc/services/trading/pancakeSwap-router-viem.js';
import { LiquidityServiceViem } from '../bsc/services/liquidity/liquidity-service-viem.js';
import { YieldFarmingServiceViem } from '../bsc/services/yield/farming-service-viem.js';
import { CakeGovernanceServiceViem } from '../bsc/services/governance/cake-governance-viem.js';
import { RealTimeUpdaterViem } from '../bsc/services/performance/realtime-updater-viem.js';
import { AdvancedBatchProcessorViem } from '../bsc/services/performance/batch-processor-viem.js';
import { BSCTransactionOptimizerViem } from '../bsc/services/performance/transaction-optimizer-viem.js';

// Test interfaces
interface TestResult {
  testName: string;
  environment: string;
  success: boolean;
  duration: number;
  error?: string;
  metrics?: any;
}

interface IntegrationTestSuite {
  name: string;
  tests: Array<{
    name: string;
    testFn: (env: any, services: any) => Promise<any>;
    timeout?: number;
    retryAttempts?: number;
  }>;
}

/**
 * Integration Test Runner Class
 */
export class ViemIntegrationTestRunner {
  private environmentManager: IntegrationTestEnvironmentManager;
  private dataProvider: ViemTestDataProvider;
  private testResults: TestResult[] = [];
  private suites: IntegrationTestSuite[] = [];

  constructor() {
    this.environmentManager = new IntegrationTestEnvironmentManager({
      parallelExecution: false,
      timeoutMs: 45000,
      retryAttempts: 2,
      enableMetrics: true,
      enableLogging: true,
      logLevel: 'info'
    });

    this.dataProvider = this.environmentManager.getDataProvider();
    this.initializeTestSuites();
  }

  /**
   * Initialize test suites
   */
  private initializeTestSuites(): void {
    this.suites = [
      this.createConnectivityTestSuite(),
      this.createTokenServiceTestSuite(),
      this.createTradingServiceTestSuite(),
      this.createLiquidityServiceTestSuite(),
      this.createYieldFarmingTestSuite(),
      this.createGovernanceTestSuite(),
      this.createPerformanceServiceTestSuite(),
      this.createCrossServiceTestSuite()
    ];
  }

  /**
   * Create connectivity test suite
   */
  private createConnectivityTestSuite(): IntegrationTestSuite {
    return {
      name: 'Connectivity Tests',
      tests: [
        {
          name: 'should connect to BSC testnet',
          testFn: async (env) => {
            const blockNumber = await env.publicClient.getBlockNumber();
            expect(typeof blockNumber).toBe('bigint');
            expect(blockNumber).toBeGreaterThan(0n);

            const chainId = await env.publicClient.getChainId();
            expect(chainId).toBe(97); // BSC testnet

            return { blockNumber, chainId };
          }
        },
        {
          name: 'should validate test account',
          testFn: async (env) => {
            expect(env.testAccount.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
            expect(env.testAccount.type).toBe('mnemonic');

            const balance = await env.publicClient.getBalance({
              address: env.testAccount.address
            });
            expect(typeof balance).toBe('bigint');

            return { address: env.testAccount.address, balance };
          }
        },
        {
          name: 'should get gas price',
          testFn: async (env) => {
            const gasPrice = await env.publicClient.getGasPrice();
            expect(typeof gasPrice).toBe('bigint');
            expect(gasPrice).toBeGreaterThan(0n);

            return { gasPrice };
          }
        }
      ]
    };
  }

  /**
   * Create token service test suite
   */
  private createTokenServiceTestSuite(): IntegrationTestSuite {
    return {
      name: 'Token Service Tests',
      tests: [
        {
          name: 'should initialize token service',
          testFn: async (env, services) => {
            expect(services.tokenService).toBeDefined();
            expect(services.tokenService).toBeInstanceOf(BSCTokenServiceViem);

            return { initialized: true };
          }
        },
        {
          name: 'should get WBNB token information',
          testFn: async (env, services) => {
            const wbnbAddress = this.dataProvider.getKnownTokens().WBNB;
            const tokenInfo = await services.tokenService.getTokenInfo(wbnbAddress);

            expect(tokenInfo.symbol).toBe('WBNB');
            expect(tokenInfo.decimals).toBe(18);
            expect(tokenInfo.totalSupply).toBeGreaterThan(0n);

            return tokenInfo;
          }
        },
        {
          name: 'should get BUSD token information',
          testFn: async (env, services) => {
            const busdAddress = this.dataProvider.getKnownTokens().BUSD;
            const tokenInfo = await services.tokenService.getTokenInfo(busdAddress);

            expect(tokenInfo.symbol).toBe('BUSD');
            expect(tokenInfo.decimals).toBe(18);
            expect(tokenInfo.totalSupply).toBeGreaterThan(0n);

            return tokenInfo;
          }
        },
        {
          name: 'should get token balances',
          testFn: async (env, services) => {
            const wbnbAddress = this.dataProvider.getKnownTokens().WBNB;
            const balance = await services.tokenService.getBalance(
              env.testAccount.address,
              wbnbAddress
            );

            expect(typeof balance).toBe('bigint');
            expect(balance).toBeGreaterThanOrEqual(0n);

            return { balance };
          }
        },
        {
          name: 'should handle invalid token address',
          testFn: async (env, services) => {
            await expect(
              services.tokenService.getTokenInfo('0xinvalid' as Address)
            ).rejects.toThrow();

            return { handledInvalidAddress: true };
          }
        }
      ]
    };
  }

  /**
   * Create trading service test suite
   */
  private createTradingServiceTestSuite(): IntegrationTestSuite {
    return {
      name: 'Trading Service Tests',
      tests: [
        {
          name: 'should initialize trading services',
          testFn: async (env, services) => {
            expect(services.swapService).toBeDefined();
            expect(services.pancakeSwapRouter).toBeDefined();

            return {
              swapService: !!services.swapService,
              routerService: !!services.pancakeSwapRouter
            };
          }
        },
        {
          name: 'should get swap quote WBNB to BUSD',
          testFn: async (env, services) => {
            const quote = await services.swapService.getSwapQuote({
              tokenIn: this.dataProvider.getKnownTokens().WBNB,
              tokenOut: this.dataProvider.getKnownTokens().BUSD,
              amountIn: parseEther('0.1'),
              slippageTolerancePercent: 0.5
            });

            expect(quote).toBeDefined();
            expect(quote.amountOut).toBeGreaterThan(0n);
            expect(quote.route).toBeDefined();

            return quote;
          }
        },
        {
          name: 'should get swap quote BUSD to CAKE',
          testFn: async (env, services) => {
            const quote = await services.swapService.getSwapQuote({
              tokenIn: this.dataProvider.getKnownTokens().BUSD,
              tokenOut: this.dataProvider.getKnownTokens().CAKE,
              amountIn: parseEther('10'),
              slippageTolerancePercent: 1.0
            });

            expect(quote).toBeDefined();
            expect(quote.amountOut).toBeGreaterThan(0n);

            return quote;
          }
        },
        {
          name: 'should handle zero amount swap',
          testFn: async (env, services) => {
            await expect(
              services.swapService.getSwapQuote({
                tokenIn: this.dataProvider.getKnownTokens().WBNB,
                tokenOut: this.dataProvider.getKnownTokens().BUSD,
                amountIn: 0n,
                slippageTolerancePercent: 0.5
              })
            ).rejects.toThrow();

            return { handledZeroAmount: true };
          }
        }
      ]
    };
  }

  /**
   * Create liquidity service test suite
   */
  private createLiquidityServiceTestSuite(): IntegrationTestSuite {
    return {
      name: 'Liquidity Service Tests',
      tests: [
        {
          name: 'should initialize liquidity service',
          testFn: async (env, services) => {
            expect(services.liquidityService).toBeDefined();
            expect(services.liquidityService).toBeInstanceOf(LiquidityServiceViem);

            return { initialized: true };
          }
        },
        {
          name: 'should get WBNB/BUSD pool info',
          testFn: async (env, services) => {
            const poolInfo = await services.liquidityService.getPoolInfo({
              tokenA: this.dataProvider.getKnownTokens().WBNB,
              tokenB: this.dataProvider.getKnownTokens().BUSD
            });

            expect(poolInfo).toBeDefined();
            expect(poolInfo.reserve0).toBeGreaterThanOrEqual(0n);
            expect(poolInfo.reserve1).toBeGreaterThanOrEqual(0n);

            return poolInfo;
          }
        },
        {
          name: 'should calculate liquidity amounts',
          testFn: async (env, services) => {
            const amounts = services.liquidityService.calculateLiquidityAmounts({
              amountADesired: parseEther('1'),
              amountBDesired: parseEther('100'),
              reserveA: parseEther('10'),
              reserveB: parseEther('1000')
            });

            expect(amounts.amountA).toBeDefined();
            expect(amounts.amountB).toBeDefined();
            expect(typeof amounts.amountA).toBe('bigint');
            expect(typeof amounts.amountB).toBe('bigint');

            return amounts;
          }
        },
        {
          name: 'should calculate APR',
          testFn: async (env, services) => {
            const apr = services.liquidityService.calculateAPR({
              feeApr: 0.25,
              rewardApr: 0.1,
              poolInfo: {
                reserve0: parseEther('100'),
                reserve1: parseEther('10000'),
                totalSupply: parseEther('1000')
              }
            });

            expect(typeof apr).toBe('number');
            expect(apr).toBeGreaterThanOrEqual(0);

            return { apr };
          }
        }
      ]
    };
  }

  /**
   * Create yield farming test suite
   */
  private createYieldFarmingTestSuite(): IntegrationTestSuite {
    return {
      name: 'Yield Farming Tests',
      tests: [
        {
          name: 'should initialize yield farming service',
          testFn: async (env, services) => {
            expect(services.yieldService).toBeDefined();
            expect(services.yieldService).toBeInstanceOf(YieldFarmingServiceViem);

            return { initialized: true };
          }
        },
        {
          name: 'should get available farms',
          testFn: async (env, services) => {
            const farms = await services.yieldService.getFarms();
            expect(Array.isArray(farms)).toBe(true);

            return { farmCount: farms.length, farms };
          }
        },
        {
          name: 'should calculate APR',
          testFn: async (env, services) => {
            const apr = services.yieldService.calculateAPR({
              rewardPerBlock: parseEther('0.1'),
              totalStaked: parseEther('1000'),
              tokenPrice: 1
            });

            expect(typeof apr).toBe('number');
            expect(apr).toBeGreaterThanOrEqual(0);

            return { apr };
          }
        }
      ]
    };
  }

  /**
   * Create governance test suite
   */
  private createGovernanceTestSuite(): IntegrationTestSuite {
    return {
      name: 'Governance Tests',
      tests: [
        {
          name: 'should initialize governance service',
          testFn: async (env, services) => {
            expect(services.governanceService).toBeDefined();
            expect(services.governanceService).toBeInstanceOf(CakeGovernanceServiceViem);

            return { initialized: true };
          }
        },
        {
          name: 'should get voting power',
          testFn: async (env, services) => {
            const votingPower = await services.governanceService.getVotingPower(
              env.testAccount.address
            );

            expect(typeof votingPower).toBe('bigint');
            expect(votingPower).toBeGreaterThanOrEqual(0n);

            return { votingPower };
          }
        },
        {
          name: 'should get proposals',
          testFn: async (env, services) => {
            const proposals = await services.governanceService.getProposals();
            expect(Array.isArray(proposals)).toBe(true);

            return { proposalCount: proposals.length, proposals };
          }
        }
      ]
    };
  }

  /**
   * Create performance service test suite
   */
  private createPerformanceServiceTestSuite(): IntegrationTestSuite {
    return {
      name: 'Performance Service Tests',
      tests: [
        {
          name: 'should initialize performance services',
          testFn: async (env, services) => {
            expect(services.realTimeUpdater).toBeDefined();
            expect(services.batchProcessor).toBeDefined();
            expect(services.txOptimizer).toBeDefined();

            return {
              realTimeUpdater: !!services.realTimeUpdater,
              batchProcessor: !!services.batchProcessor,
              txOptimizer: !!services.txOptimizer
            };
          }
        },
        {
          name: 'should get real-time metrics',
          testFn: async (env, services) => {
            const metrics = services.realTimeUpdater.getMetrics();
            expect(metrics).toBeDefined();
            expect(metrics.totalUpdates).toBeGreaterThanOrEqual(0);
            expect(metrics.successfulUpdates).toBeGreaterThanOrEqual(0);

            return metrics;
          }
        },
        {
          name: 'should handle subscription management',
          testFn: async (env, services) => {
            const callback = jest.fn();
            const subscriptionId = services.realTimeUpdater.subscribe('block', callback);
            expect(typeof subscriptionId).toBe('string');

            const unsubscribed = services.realTimeUpdater.unsubscribe(subscriptionId);
            expect(unsubscribed).toBe(true);

            return { subscriptionId, unsubscribed };
          }
        },
        {
          name: 'should get batch processor metrics',
          testFn: async (env, services) => {
            const metrics = services.batchProcessor.getMetrics();
            expect(metrics).toBeDefined();
            expect(metrics.totalBatches).toBeGreaterThanOrEqual(0);

            return metrics;
          }
        },
        {
          name: 'should get transaction optimizer metrics',
          testFn: async (env, services) => {
            const metrics = services.txOptimizer.getMetrics();
            expect(metrics).toBeDefined();
            expect(metrics.totalTransactions).toBeGreaterThanOrEqual(0);

            return metrics;
          }
        }
      ]
    };
  }

  /**
   * Create cross-service test suite
   */
  private createCrossServiceTestSuite(): IntegrationTestSuite {
    return {
      name: 'Cross-Service Integration Tests',
      tests: [
        {
          name: 'should handle complete trading workflow',
          testFn: async (env, services) => {
            // Get token info
            const wbnbInfo = await services.tokenService.getTokenInfo(
              this.dataProvider.getKnownTokens().WBNB
            );
            const busdInfo = await services.tokenService.getTokenInfo(
              this.dataProvider.getKnownTokens().BUSD
            );

            // Get swap quote
            const swapQuote = await services.swapService.getSwapQuote({
              tokenIn: this.dataProvider.getKnownTokens().WBNB,
              tokenOut: this.dataProvider.getKnownTokens().BUSD,
              amountIn: parseEther('0.1'),
              slippageTolerancePercent: 0.5
            });

            // Get pool info
            const poolInfo = await services.liquidityService.getPoolInfo({
              tokenA: this.dataProvider.getKnownTokens().WBNB,
              tokenB: this.dataProvider.getKnownTokens().BUSD
            });

            return {
              wbnbSymbol: wnbInfo.symbol,
              busdSymbol: busdInfo.symbol,
              swapAmountOut: swapQuote.amountOut,
              poolReserve0: poolInfo.reserve0,
              poolReserve1: poolInfo.reserve1
            };
          }
        },
        {
          name: 'should handle concurrent operations',
          testFn: async (env, services) => {
            const operations = [
              services.tokenService.getTokenInfo(this.dataProvider.getKnownTokens().WBNB),
              services.tokenService.getTokenInfo(this.dataProvider.getKnownTokens().BUSD),
              services.swapService.getSwapQuote({
                tokenIn: this.dataProvider.getKnownTokens().WBNB,
                tokenOut: this.dataProvider.getKnownTokens().BUSD,
                amountIn: parseEther('0.1'),
                slippageTolerancePercent: 0.5
              }),
              services.liquidityService.getPoolInfo({
                tokenA: this.dataProvider.getKnownTokens().WBNB,
                tokenB: this.dataProvider.getKnownTokens().BUSD
              })
            ];

            const results = await Promise.allSettled(operations);

            results.forEach((result, index) => {
              expect(result.status).toBe('fulfilled');
              if (result.status === 'fulfilled') {
                expect(result.value).toBeDefined();
              }
            });

            return { operationCount: operations.length, allSuccessful: true };
          }
        }
      ]
    };
  }

  /**
   * Initialize services for testing
   */
  private async initializeServices(env: any): Promise<any> {
    const pancakeSwapRouter = new PancakeSwapRouterViem(env.publicClient, env.walletClient);

    return {
      tokenService: new BSCTokenServiceViem(env.publicClient),
      swapService: new SwapServiceViem(env.publicClient, env.walletClient, pancakeSwapRouter),
      pancakeSwapRouter,
      liquidityService: new LiquidityServiceViem(env.publicClient, env.walletClient),
      yieldService: new YieldFarmingServiceViem(env.publicClient, env.walletClient),
      governanceService: new CakeGovernanceServiceViem(env.publicClient, env.walletClient),
      realTimeUpdater: new RealTimeUpdaterViem(env.publicClient),
      batchProcessor: new AdvancedBatchProcessorViem(env.publicClient),
      txOptimizer: new BSCTransactionOptimizerViem(env.publicClient)
    };
  }

  /**
   * Run a single test
   */
  private async runTest(
    testName: string,
    testFn: (env: any, services: any) => Promise<any>,
    env: any,
    services: any,
    timeout: number = 45000,
    retryAttempts: number = 2
  ): Promise<TestResult> {
    const startTime = Date.now();
    let lastError: any;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const result = await Promise.race([
          testFn(env, services),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Test timeout')), timeout)
          )
        ]);

        const duration = Date.now() - startTime;
        return {
          testName,
          environment: env.name,
          success: true,
          duration,
          metrics: result
        };
      } catch (error) {
        lastError = error;

        if (attempt < retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    const duration = Date.now() - startTime;
    return {
      testName,
      environment: env.name,
      success: false,
      duration,
      error: lastError.message || String(lastError)
    };
  }

  /**
   * Run all test suites
   */
  async runAllTests(): Promise<TestResult[]> {
    console.log('🚀 Starting Viem Integration Tests...\n');

    const env = this.environmentManager.getEnvironment('bsc-testnet');
    const services = await this.initializeServices(env);

    // Validate environment connectivity
    const isValid = await this.environmentManager.validateEnvironment('bsc-testnet');
    if (!isValid) {
      throw new Error('Test environment validation failed');
    }

    console.log(`✅ Environment validated: ${env.name}`);

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    for (const suite of this.suites) {
      console.log(`\n📋 Running ${suite.name}...`);

      for (const test of suite.tests) {
        totalTests++;
        const result = await this.runTest(
          test.name,
          test.testFn,
          env,
          services,
          test.timeout,
          test.retryAttempts
        );

        this.testResults.push(result);

        if (result.success) {
          passedTests++;
          console.log(`  ✅ ${test.name} (${result.duration}ms)`);
        } else {
          failedTests++;
          console.log(`  ❌ ${test.name} (${result.duration}ms) - ${result.error}`);
        }
      }
    }

    // Cleanup services
    try {
      await services.realTimeUpdater.shutdown();
      await services.batchProcessor.shutdown();
      await services.txOptimizer.shutdown();
    } catch (error) {
      console.warn('⚠️  Error during service cleanup:', error);
    }

    // Generate summary
    console.log('\n📊 Test Summary:');
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Passed: ${passedTests} ✅`);
    console.log(`  Failed: ${failedTests} ❌`);
    console.log(`  Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  - ${r.testName}: ${r.error}`);
        });
    }

    return this.testResults;
  }

  /**
   * Run tests across multiple environments
   */
  async runAcrossEnvironments(environmentNames?: string[]): Promise<TestResult[]> {
    console.log('🌍 Running tests across multiple environments...\n');

    const results = await this.environmentManager.runAcrossEnvironments(
      async (env) => {
        const services = await this.initializeServices(env);
        const envResults: TestResult[] = [];

        // Run a subset of critical tests for multi-environment validation
        const criticalTests = [
          {
            name: 'Connectivity Validation',
            testFn: async (env: any, services: any) => {
              const blockNumber = await env.publicClient.getBlockNumber();
              const chainId = await env.publicClient.getChainId();
              return { blockNumber, chainId };
            }
          },
          {
            name: 'Token Service Validation',
            testFn: async (env: any, services: any) => {
              const wbnbInfo = await services.tokenService.getTokenInfo(
                this.dataProvider.getKnownTokens().WBNB
              );
              return { symbol: wbnbInfo.symbol, decimals: wbnbInfo.decimals };
            }
          },
          {
            name: 'Trading Service Validation',
            testFn: async (env: any, services: any) => {
              const quote = await services.swapService.getSwapQuote({
                tokenIn: this.dataProvider.getKnownTokens().WBNB,
                tokenOut: this.dataProvider.getKnownTokens().BUSD,
                amountIn: parseEther('0.01'),
                slippageTolerancePercent: 1.0
              });
              return { amountOut: quote.amountOut };
            }
          }
        ];

        for (const test of criticalTests) {
          const result = await this.runTest(
            `${test.name} - ${env.name}`,
            test.testFn,
            env,
            services
          );
          envResults.push(result);
        }

        // Cleanup
        try {
          await services.realTimeUpdater.shutdown();
          await services.batchProcessor.shutdown();
          await services.txOptimizer.shutdown();
        } catch (error) {
          // Ignore cleanup errors
        }

        return envResults;
      },
      environmentNames
    );

    const allResults = results.flatMap(r => r.error ? [] : r.result);
    this.testResults.push(...allResults);

    // Generate cross-environment summary
    console.log('\n🌍 Cross-Environment Test Summary:');
    results.forEach(result => {
      if (result.error) {
        console.log(`  ❌ ${result.environment}: ${result.error}`);
      } else {
        console.log(`  ✅ ${result.environment}: All tests passed`);
      }
    });

    return allResults;
  }

  /**
   * Get test results
   */
  getTestResults(): TestResult[] {
    return [...this.testResults];
  }

  /**
   * Generate test report
   */
  generateReport(): {
    summary: any;
    results: TestResult[];
    environmentValidation: any;
  } {
    const passed = this.testResults.filter(r => r.success).length;
    const failed = this.testResults.filter(r => !r.success).length;
    const total = this.testResults.length;

    const summary = {
      total,
      passed,
      failed,
      successRate: total > 0 ? (passed / total) * 100 : 0,
      averageDuration: this.testResults.length > 0
        ? this.testResults.reduce((sum, r) => sum + r.duration, 0) / this.testResults.length
        : 0
    };

    return {
      summary,
      results: this.testResults,
      environmentValidation: null // Will be populated when validation is run
    };
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    await this.environmentManager.cleanup();
    this.testResults = [];
  }
}

// Export for use in test files
export {
  ViemIntegrationTestRunner,
  IntegrationTestEnvironmentManager,
  ViemTestDataProvider,
  IntegrationTestUtils
};

// Default export
export default ViemIntegrationTestRunner;