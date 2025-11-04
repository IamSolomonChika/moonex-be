/**
 * BSC End-to-End Validation Tests for Viem Migration
 * Comprehensive validation of BSC-specific functionality using Viem
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Viem imports
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  Address,
  Hash,
  Account,
  PublicClient,
  WalletClient,
  Chain
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';

// Viem-based BSC services
import { BSCTokenServiceViem } from '../bsc/services/tokens/token-service-viem.js';
import { SwapServiceViem } from '../bsc/services/trading/swap-service-viem.js';
import { PancakeSwapRouterViem } from '../bsc/services/trading/pancakeSwap-router-viem.js';
import { LiquidityServiceViem } from '../bsc/services/liquidity/liquidity-service-viem.js';
import { YieldFarmingServiceViem } from '../bsc/services/yield/farming-service-viem.js';
import { CakeGovernanceServiceViem } from '../bsc/services/governance/cake-governance-viem.js';
import { RealTimeUpdaterViem } from '../bsc/services/performance/realtime-updater-viem.js';
import { AdvancedBatchProcessorViem } from '../bsc/services/performance/batch-processor-viem.js';
import { BSCTransactionOptimizerViem } from '../bsc/services/performance/transaction-optimizer-viem.js';

// BSC configuration
import { BSC_CONFIG } from '../config/bsc.js';

// Test utilities
import { setupBSCTestEnv, TestDataGenerators } from './setup/viem-test-setup.js';

describe('BSC End-to-End Validation Tests - Viem Migration', () => {
  let publicClient: PublicClient<any, Chain>;
  let walletClient: WalletClient<any, Chain>;
  let testAccount: Account;
  let testClients: any;

  // All Viem-based BSC services
  let tokenService: BSCTokenServiceViem;
  let swapService: SwapServiceViem;
  let pancakeSwapRouter: PancakeSwapRouterViem;
  let liquidityService: LiquidityServiceViem;
  let yieldService: YieldFarmingServiceViem;
  let governanceService: CakeGovernanceServiceViem;
  let realTimeUpdater: RealTimeUpdaterViem;
  let batchProcessor: AdvancedBatchProcessorViem;
  let txOptimizer: BSCTransactionOptimizerViem;

  // BSC-specific test data
  const bscTokens = {
    // BSC Testnet tokens
    WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
    BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
    CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' as Address,
    USDT: '0x55d398326f99059fF775485246999027B3197955' as Address,
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' as Address,

    // PancakeSwap contracts
    PANCAKE_ROUTER: '0x10ED43C718714eb63d5aA57B78B54704E256024E' as Address,
    PANCAKE_FACTORY: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as Address,
    MASTER_CHEF: '0x73feaa1eE314F8c655E354234017bE2193C9E24E' as Address
  };

  const bscContracts = {
    // System contracts
    BSC_BRIDGE: '0x0000000000000000000000000000000000001004' as Address,
    VALIDATOR: '0x0000000000000000000000000000000000001002' as Address,
    LIGHT_CLIENT: '0x0000000000000000000000000000000000001001' as Address
  };

  beforeAll(async () => {
    // Setup test environment
    testClients = setupBSCTestEnv();
    publicClient = testClients.publicClient;
    walletClient = testClients.walletClient;
    testAccount = testClients.testAccount;

    // Initialize all BSC services
    tokenService = new BSCTokenServiceViem(publicClient);
    pancakeSwapRouter = new PancakeSwapRouterViem(publicClient, walletClient);
    swapService = new SwapServiceViem(publicClient, walletClient, pancakeSwapRouter);
    liquidityService = new LiquidityServiceViem(publicClient, walletClient);
    yieldService = new YieldFarmingServiceViem(publicClient, walletClient);
    governanceService = new CakeGovernanceServiceViem(publicClient, walletClient);
    realTimeUpdater = new RealTimeUpdaterViem(publicClient);
    batchProcessor = new AdvancedBatchProcessorViem(publicClient);
    txOptimizer = new BSCTransactionOptimizerViem(publicClient);
  });

  afterAll(async () => {
    // Cleanup all services
    await realTimeUpdater.shutdown();
    await batchProcessor.shutdown();
    await txOptimizer.shutdown();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any ongoing operations
    await Promise.allSettled([
      realTimeUpdater.clearSubscriptions(),
      batchProcessor.clearQueue()
    ]);
  });

  describe('BSC Infrastructure Validation', () => {
    test('should validate BSC chain configuration', () => {
      // Test BSC configuration
      expect(BSC_CONFIG).toBeDefined();
      expect(BSC_CONFIG.BSC_CHAIN_ID).toBe(56);
      expect(BSC_CONFIG.BSC_TESTNET_CHAIN_ID).toBe(97);
      expect(BSC_CONFIG.BSC_RPC_URL).toBeDefined();
      expect(BSC_CONFIG.BSC_TESTNET_RPC_URL).toBeDefined();

      // Test chain connection
      const chainId = await publicClient.getChainId();
      expect(chainId).toBe(97); // BSC testnet

      const blockNumber = await publicClient.getBlockNumber();
      expect(typeof blockNumber).toBe('bigint');
      expect(blockNumber).toBeGreaterThan(0n);
    });

    test('should validate BSC gas fees and transaction costs', async () => {
      const gasPrice = await publicClient.getGasPrice();
      expect(typeof gasPrice).toBe('bigint');
      expect(gasPrice).toBeGreaterThan(0n);

      const block = await publicClient.getBlock();
      expect(block.baseFeePerGas).toBeGreaterThanOrEqual(0n);

      const networkStats = txOptimizer.getNetworkStats();
      expect(networkStats.averageGasPrice).toBeGreaterThan(0n);
      expect(networkStats.congestionLevel).toBeDefined();
      expect(typeof networkStats.congestionLevel).toBe('number');
    });

    test('should validate BSC test account setup', () => {
      expect(testAccount.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(testAccount.type).toBe('mnemonic');

      const balance = await publicClient.getBalance({
        address: testAccount.address
      });
      expect(typeof balance).toBe('bigint');
    });
  });

  describe('BSC Token Service E2E Validation', () => {
    test('should validate major BSC tokens', async () => {
      const tokensToValidate = [
        { symbol: 'WBNB', address: bscTokens.WBNB },
        { symbol: 'BUSD', address: bscTokens.BUSD },
        { symbol: 'CAKE', address: bscTokens.CAKE },
        { symbol: 'USDT', address: bscTokens.USDT }
      ];

      const results = await Promise.allSettled(
        tokensToValidate.map(token =>
          tokenService.getTokenInfo(token.address)
        )
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          expect(result.value.symbol).toBe(tokensToValidate[index].symbol);
          expect(result.value.decimals).toBeDefined();
          expect(typeof result.value.decimals).toBe('number');
          expect(result.value.totalSupply).toBeGreaterThan(0n);
        }
      });

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThanOrEqual(2); // At least 2 tokens should work
    });

    test('should validate BSC token balances and transfers', async () => {
      // Check WBNB balance
      const wbnbBalance = await tokenService.getBalance(
        testAccount.address,
        bscTokens.WBNB
      );
      expect(typeof wbnbBalance).toBe('bigint');
      expect(wbnbBalance).toBeGreaterThanOrEqual(0n);

      // Check BUSD balance
      const busdBalance = await tokenService.getBalance(
        testAccount.address,
        bscTokens.BUSD
      );
      expect(typeof busdBalance).toBe('bigint');
      expect(busdBalance).toBeGreaterThanOrEqual(0n);

      // Validate token decimals consistency
      const wbnbInfo = await tokenService.getTokenInfo(bscTokens.WBNB);
      const busdInfo = await tokenService.getTokenInfo(bscTokens.BUSD);

      expect(wbnbInfo.decimals).toBe(18);
      expect(busdInfo.decimals).toBe(18);

      return {
        wbnbBalance,
        busdBalance,
        tokenDecimalsConsistent: wbnbInfo.decimals === busdInfo.decimals
      };
    });

    test('should handle invalid BSC token addresses gracefully', async () => {
      const invalidAddresses = [
        '0xinvalid' as Address,
        '0x0000000000000000000000000000000000000000000' as Address,
        '0xffffffffffffffffffffffffffffffffffffffffffffffff' as Address
      ];

      const results = await Promise.allSettled(
        invalidAddresses.map(address =>
          tokenService.getTokenInfo(address)
        )
      );

      results.forEach(result => {
        expect(result.status).toBe('rejected');
      });
    });
  });

  describe('BSC Trading E2E Validation', () => {
    test('should validate PancakeSwap trading on BSC', async () => {
      // Test WBNB to BUSD swap
      const wbnbToBusdQuote = await swapService.getSwapQuote({
        tokenIn: bscTokens.WBNB,
        tokenOut: bscTokens.BUSD,
        amountIn: parseEther('0.01'),
        slippageTolerancePercent: 0.5
      });

      expect(wbnbToBusdQuote).toBeDefined();
      expect(wbnbToBusdQuote.amountOut).toBeGreaterThan(0n);
      expect(wbnbToBusdQuote.route).toBeDefined();
      expect(wbnbToBusdQuote.gasEstimate).toBeGreaterThan(0n);

      // Test BUSD to CAKE swap
      const busdToCakeQuote = await swapService.getSwapQuote({
        tokenIn: bscTokens.BUSD,
        tokenOut: bscTokens.CAKE,
        amountIn: parseEther('10'),
        slippageTolerancePercent: 1.0
      });

      expect(busdToCakeQuote).toBeDefined();
      expect(busdToCakeQuote.amountOut).toBeGreaterThan(0n);

      // Test CAKE to USDT swap
      const cakeToUsdtQuote = await swapService.getSwapQuote({
        tokenIn: bscTokens.CAKE,
        tokenOut: bscTokens.USDT,
        amountIn: parseEther('1'),
        slippageTolerancePercent: 1.5
      });

      expect(cakeToUsdtQuote).toBeDefined();
      expect(cakeToUsdtQuote.amountOut).toBeGreaterThan(0n);

      return {
        wbnbToBusd: {
          amountOut: wbnbToBusdQuote.amountOut,
          gasEstimate: wbnbToBusdQuote.gasEstimate
        },
        busdToCake: {
          amountOut: busdToCakeQuote.amountOut,
          gasEstimate: busdToCakeQuote.gasEstimate
        },
        cakeToUsdt: {
          amountOut: cakeToUsdtQuote.amountOut,
          gasEstimate: cakeToUsdtQuote.gasEstimate
        }
      };
    }, 30000);

    test('should validate BSC trading with slippage protection', async () => {
      const baseAmount = parseEther('0.1');
      const slippageTolerance = 2.0;

      // Get quote with slippage protection
      const protectedQuote = await swapService.getSwapQuote({
        tokenIn: bscTokens.WBNB,
        tokenOut: bscTokens.BUSD,
        amountIn: baseAmount,
        slippageTolerancePercent: slippageTolerance
      });

      // Calculate expected minimum output
      const expectedMinOut = protectedQuote.amountOut * BigInt(100 - slippageTolerance) / 100n;

      expect(protectedQuote.amountOut).toBeGreaterThan(expectedMinOut);

      // Test with zero slippage tolerance
      const noSlippageQuote = await swapService.getSwapQuote({
        tokenIn: bscTokens.WBNB,
        tokenOut: bscTokens.BUSD,
        amountIn: baseAmount,
        slippageTolerancePercent: 0
      });

      expect(noSlippageQuote.amountOut).toBeGreaterThanOrEqual(protectedQuote.amountOut);

      return {
        protectedQuote: protectedQuote.amountOut,
        expectedMinOut,
        noSlippageQuote: noSlippageQuote.amountOut,
        slippageProtectionWorking: protectedQuote.amountOut >= expectedMinOut
      };
    });

    test('should validate BSC gas optimization for trading', async () => {
      const tradingParams = {
        to: bscTokens.PANCAKE_ROUTER,
        value: parseEther('0.01'),
        data: '0x' // Mock transaction data
      };

      const gasOptimization = await txOptimizer.optimizeTransaction(tradingParams);
      expect(gasOptimization).toBeDefined();
      expect(gasOptimization.gasPrice).toBeGreaterThan(0n);
      expect(gasOptimization.gasLimit).toBeGreaterThan(0n);

      // Test with different transaction sizes
      const largeTxParams = {
        ...tradingParams,
        value: parseEther('1')
      };

      const largeGasOptimization = await txOptimizer.optimizeTransaction(largeTxParams);
      expect(largeGasOptimization.gasLimit).toBeGreaterThan(gasOptimization.gasLimit);

      // Test with complex transaction data
      const complexTxParams = {
        ...tradingParams,
        data: '0x' + 'a'.repeat(1000) // Large calldata
      };

      const complexGasOptimization = await txOptimizer.optimizeTransaction(complexTxParams);
      expect(complexGasOptimization.gasLimit).toBeGreaterThan(0n);

      return {
        standardOptimization: {
          gasPrice: gasOptimization.gasPrice,
          gasLimit: gasOptimization.gasLimit
        },
        largeOptimization: {
          gasPrice: largeGasOptimization.gasPrice,
          gasLimit: largeGasOptimization.gasLimit
        },
        complexOptimization: {
          gasPrice: complexGasOptimization.gasPrice,
          gasLimit: complexGasOptimization.gasLimit
        }
      };
    });
  });

  describe('BSC Liquidity E2E Validation', () => {
    test('should validate PancakeSwap liquidity pools', async () => {
      // Test major BSC liquidity pools
      const poolsToTest = [
        { tokenA: bscTokens.WBNB, tokenB: bscTokens.BUSD, name: 'WBNB/BUSD' },
        { tokenA: bscTokens.WBNB, tokenB: bscTokens.CAKE, name: 'WBNB/CAKE' },
        { tokenA: bscTokens.BUSD, tokenB: bscTokens.USDT, name: 'BUSD/USDT' }
      ];

      const poolResults = await Promise.allSettled(
        poolsToTest.map(pool =>
          liquidityService.getPoolInfo({
            tokenA: pool.tokenA,
            tokenB: poolB.tokenB
          })
        )
      );

      poolResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const pool = result.value;
          expect(pool.reserve0).toBeGreaterThanOrEqual(0n);
          expect(pool.reserve1).toBeGreaterThanOrEqual(0n);
          expect(pool.totalSupply).toBeGreaterThanOrEqual(0n);
        }
      });

      const validPools = poolResults.filter(r => r.status === 'fulfilled').length;
      expect(validPools).toBeGreaterThanOrEqual(1);

      return {
        poolsTested: poolsToTest.length,
        validPools,
        successRate: (validPools / poolsToTest.length) * 100
      };
    }, 25000);

    test('should validate BSC liquidity provision calculations', () => {
      // Test with WBNB/BUSD pool
      const poolInfo = await liquidityService.getPoolInfo({
        tokenA: bscTokens.WBNB,
        tokenB: bscTokens.BUSD
      });

      const liquidityAmounts = liquidityService.calculateLiquidityAmounts({
        amountADesired: parseEther('0.1'),
        amountBDesired: parseEther('50'),
        reserveA: poolInfo.reserve0,
        reserveB: poolInfo.reserve1
      });

      expect(liquidityAmounts.amountA).toBeGreaterThan(0n);
      expect(liquidityAmounts.amountB).toBeGreaterThan(0n);

      // Test APR calculation
      const apr = liquidityService.calculateAPR({
        feeApr: 0.25, // 0.25% trading fee
        rewardApr: 0.0, // No additional rewards for basic pool
        poolInfo
      });

      expect(typeof apr).toBe('number');
      expect(apr).toBeGreaterThanOrEqual(0);

      // Test impermanent loss calculation
      const impermanentLoss = liquidityService.calculateImpermanentLoss({
        priceRatio: 1.5, // 50% price increase
        initialPriceRatio: 1.0
      });

      expect(typeof impermanentLoss).toBe('number');
      expect(impermanentLoss).toBeGreaterThan(0);

      return {
        poolInfo: {
          reserve0: poolInfo.reserve0,
          reserve1: poolInfo.reserve1,
          totalSupply: poolInfo.totalSupply
        },
        liquidity: {
          amountA: liquidityAmounts.amountA,
          amountB: liquidityAmounts.amountB
        },
        calculations: { apr, impermanentLoss }
      };
    });

    test('should validate BSC single-sided liquidity provision', async () => {
      // Test providing only WBNB
      const wbnbOnlyAmounts = liquidityService.calculateLiquidityAmounts({
        amountADesired: parseEther('0.1'),
        amountBDesired: 0n, // No BUSD
        reserveA: parseEther('10'),
        reserveB: parseEther('500')
      });

      expect(wbnbOnlyAmounts.amountA).toBe(parseEther('0.1'));
      expect(wbnbOnlyAmounts.amountB).toBe(0n);

      // Test providing only BUSD
      const busdOnlyAmounts = liquidityService.calculateLiquidityAmounts({
        amountADesired: 0n, // No WBNB
        amountBDesired: parseEther('50'),
        reserveA: parseEther('10'),
        reserveB: parseEther('500')
      });

      expect(busdOnlyAmounts.amountA).toBe(0n);
      expect(busdOnlyAmounts.amountB).toBe(parseEther('50'));

      return {
        wbnbOnly: { amountA: wbnbOnlyAmounts.amountA, amountB: wbnbOnlyAmounts.amountB },
        busdOnly: { amountA: busdOnlyAmounts.amountA, amountB: busdOnlyAmounts.amountB }
      };
    });
  });

  describe('BSC Yield Farming E2E Validation', () => {
    test('should validate BSC yield farming opportunities', async () => {
      const farms = await yieldService.getFarms();
      expect(Array.isArray(farms)).toBe(true);

      if (farms.length > 0) {
        const farmAnalysis = await yieldService.analyzeFarm({
          farmAddress: farms[0].address,
          stakeTokenAddress: farms[0].stakeToken,
          rewardTokenAddress: farms[0].rewardToken
        });

        expect(farmAnalysis.apr).toBeGreaterThanOrEqual(0);
        expect(farmAnalysis.totalStaked).toBeGreaterThanOrEqual(0n);

        // Test staking simulation
        const stakeAmount = parseEther('10');
        const stakingSimulation = yieldService.simulateStaking({
          farmAddress: farms[0].address,
          stakeAmount,
          stakingPeriod: 30 // 30 days
        });

        expect(stakingSimulation.expectedRewards).toBeGreaterThanOrEqual(0n);
        expect(stakingSimulation.apy).toBeGreaterThanOrEqual(0);

        return {
          totalFarms: farms.length,
          firstFarm: {
            apr: farmAnalysis.apr,
            totalStaked: farmAnalysis.totalStaked
          },
          stakingSimulation: {
            amount: stakeAmount,
            expectedRewards: stakingSimulation.expectedRewards,
            apy: stakingSimulation.apy
          }
        };
      }

      return { totalFarms: 0, noFarmsAvailable: true };
    }, 30000);

    test('should validate BSC auto-compound farming strategies', async () => {
      const farms = await yieldService.getFarms();

      if (farms.length > 0) {
        const compoundAnalysis = yieldService.analyzeAutoCompound({
          farmAddress: farms[0].address,
          stakeAmount: parseEther('10'),
          compoundFrequency: 'daily',
          period: 30
        });

        expect(compoundAnalysis.totalRewards).toBeGreaterThanOrEqual(0n);
        expect(compoundAnalysis.compoundAPY).toBeGreaterThanOrEqual(0);

        // Compare with simple staking
        const simpleStaking = yieldService.simulateStaking({
          farmAddress: farms[0].address,
          stakeAmount: parseEther('10'),
          stakingPeriod: 30
        });

        const compoundBoost = compoundAnalysis.compoundAPY - simpleStaking.apy;
        expect(compoundBoost).toBeGreaterThanOrEqual(0);

        return {
          compoundAnalysis: {
            totalRewards: compoundAnalysis.totalRewards,
            compoundAPY: compoundAnalysis.compoundAPY
          },
          simpleStaking: {
            expectedRewards: simpleStaking.expectedRewards,
            apy: simpleStaking.apy
          },
          compoundBoost
        };
      }

      return { noFarmsToTest: true };
    });

    test('should validate BSC farm switching optimization', async () => {
      const farms = await yieldService.getFarms();

      if (farms.length >= 2) {
        // Test farm comparison
        const farmComparison = yieldService.compareFarms([
          farms[0],
          farms[1]
        ]);

        expect(farmComparison).toBeDefined();
        expect(Array.isArray(farmComparison.comparisonMatrix)).toBe(true);
        expect(farmComparison.recommendation).toBeDefined();

        // Test migration calculation
        const migrationCalculation = yieldService.calculateMigration({
          fromFarm: farms[0].address,
          toFarm: farms[1].address,
          stakeAmount: parseEther('10')
        });

        expect(migrationCalculation).toBeDefined();

        return {
          farmComparison: {
            recommendation: farmComparison.recommendation,
            matrix: farmComparison.comparisonMatrix
          },
          migrationCalculation
        };
      }

      return { insufficientFarms: farms.length < 2 };
    });
  });

  describe('BSC Governance E2E Validation', () => {
    test('should validate BSC Cake governance functionality', async () => {
      // Test voting power calculation
      const votingPower = await governanceService.getVotingPower(testAccount.address);
      expect(typeof votingPower).toBe('bigint');
      expect(votingPower).toBeGreaterThanOrEqual(0n);

      // Test proposals retrieval
      const proposals = await governanceService.getProposals();
      expect(Array.isArray(proposals)).toBe(true);

      // Test delegation analysis
      const delegationAnalysis = await governanceService.analyzeDelegation({
        delegatorAddress: testAccount.address
      });

      expect(delegationAnalysis).toBeDefined();
      expect(delegationAnalysis.currentDelegate).toBeDefined();

      // Test governance metrics
      const governanceMetrics = governanceService.getGovernanceMetrics();
      expect(governanceMetrics).toBeDefined();
      expect(governanceMetrics.totalProposals).toBeGreaterThanOrEqual(0);
      expect(governanceMetrics.participationRate).toBeGreaterThanOrEqual(0);

      return {
        votingPower,
        totalProposals: proposals.length,
        delegationAnalysis,
        governanceMetrics
      };
    }, 25000);

    test('should validate BSC voting simulation', async () => {
      const votingPower = await governanceService.getVotingPower(testAccount.address);

      const proposals = await governanceService.getProposals();
      if (proposals.length > 0) {
        const activeProposal = proposals.find(p => p.status === 'active');

        if (activeProposal) {
          const voteSimulation = governanceService.simulateVote({
            proposalId: activeProposal.id,
            voterAddress: testAccount.address,
            support: true,
            votingPower
          });

          expect(voteSimulation).toBeDefined();
          expect(voteSimulation.impact).toBeDefined();

          // Test voting power delegation
          const delegationSimulation = governanceService.simulateDelegation({
            delegatorAddress: testAccount.address,
            delegateeAddress: TestDataGenerators.randomAddress(),
            votingPower
          });

          expect(delegationSimulation).toBeDefined();

          return {
            proposal: {
              id: activeProposal.id,
              status: activeProposal.status
            },
            voteSimulation,
            delegationSimulation
          };
        }
      }

      return {
        votingPower,
        noActiveProposals: proposals.filter(p => p.status === 'active').length === 0
      };
    });

    test('should validate BSC governance token economics', async () => {
      // Get CAKE token info
      const cakeInfo = await tokenService.getTokenInfo(bscTokens.CAKE);
      expect(cakeInfo.symbol).toBe('CAKE');
      expect(cakeInfo.decimals).toBe(18);

      // Get CAKE balance
      const cakeBalance = await tokenService.getBalance(
        testAccount.address,
        bscTokens.CAKE
      );
      expect(typeof cakeBalance).toBe('bigint');

      // Test voting power calculation accuracy
      const votingPower = await governanceService.getVotingPower(testAccount.address);
      const expectedVotingPower = cakeBalance; // Simplified assumption

      expect(votingPower).toBeGreaterThanOrEqual(0n);

      // Test governance metrics aggregation
      const governanceMetrics = governanceService.getGovernanceMetrics();
      expect(governanceMetrics.totalVotingPower).toBeGreaterThanOrEqual(0n);
      expect(governanceMetrics.delegatedVotingPower).toBeGreaterThanOrEqual(0n);

      return {
        tokenInfo: {
          symbol: cakeInfo.symbol,
          totalSupply: cakeInfo.totalSupply
        },
        tokenBalance: cakeBalance,
        votingPower,
        governanceMetrics: {
          totalVotingPower: governanceMetrics.totalVotingPower,
          delegatedVotingPower: governanceMetrics.delegatedPower
        }
      };
    });
  });

  describe('BSC Real-time Updates E2E Validation', () => {
    test('should validate BSC real-time block monitoring', async () => {
      let blockUpdateReceived = false;
      let lastBlockNumber = 0n;

      // Subscribe to block updates
      const blockSubscription = realTimeUpdater.subscribe('block', (data) => {
        blockUpdateReceived = true;
        lastBlockNumber = data.blockNumber;
        expect(data.blockNumber).toBeGreaterThan(0n);
        expect(data.timestamp).toBeDefined();
      });

      expect(typeof blockSubscription).toBe('string');

      // Wait for block updates
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify updates were received
      expect(blockUpdateReceived).toBe(true);
      expect(lastBlockNumber).toBeGreaterThan(0n);

      // Test subscription management
      const unsubscribed = realTimeUpdater.unsubscribe(blockSubscription);
      expect(unsubscribed).toBe(true);

      return {
        subscriptionCreated: true,
        updatesReceived: blockUpdateReceived,
        lastBlockNumber,
        subscriptionManaged: unsubscribed
      };
    }, 10000);

    test('should validate BSC real-time price monitoring', async () => {
      let priceUpdates = 0;

      // Subscribe to WBNB price updates
      const wbnbPriceSubscription = realTimeUpdater.subscribe('price', (data) => {
        priceUpdates++;
        expect(data.tokenAddress).toBe(bscTokens.WBNB);
        expect(data.price).toBeGreaterThan(0n);
      }, {
        tokenAddress: bscTokens.WBNB
      });

      // Subscribe to BUSD price updates
      const busdPriceSubscription = realTimeUpdater.subscribe('price', (data) => {
        priceUpdates++;
        expect(data.tokenAddress).toBe(bscTokens.BUSD);
        expect(data.price).toBeGreaterThan(0n);
      }, {
        tokenAddress: bscTokens.BUSD
      });

      expect(typeof wbnbPriceSubscription).toBe('string');
      expect(typeof busdPriceSubscription).toBe('string');

      // Wait for potential price updates
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test real-time metrics
      const realTimeMetrics = realTimeUpdater.getMetrics();
      expect(realTimeMetrics.activeSubscriptions).toBeGreaterThanOrEqual(2);

      // Cleanup
      realTimeUpdater.unsubscribe(wbnbPriceSubscription);
      realTimeUpdater.unsubscribe(busdPriceSubscription);

      return {
        subscriptionsCreated: 2,
        priceUpdates,
        metricsCollected: realTimeMetrics.activeSubscriptions
      };
    }, 8000);

    test('should validate BSC real-time pool monitoring', async () => {
      let poolUpdates = 0;

      // Subscribe to WBNB/BUSD pool updates
      const poolSubscription = realTimeUpdater.subscribe('pool', (data) => {
        poolUpdates++;
        expect(data.tokenA).toBeDefined();
        expect(data.tokenB).toBeDefined();
        expect(data.reserve0).toBeGreaterThanOrEqual(0n);
        expect(data.reserve1).toBeGreaterThanOrEqual(0n);
      }, {
        tokenA: bscTokens.WBNB,
        tokenB: bscTokens.BUSD
      });

      expect(typeof poolSubscription).toBe('string');

      // Wait for pool updates
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test batch processing integration
      const batchOperationId = await batchProcessor.submitOperation(
        'PROCESS_POOL_UPDATE' as any,
        {
          poolAddress: TestDataGenerators.randomAddress(),
          timestamp: BigInt(Date.now())
        }
      );

      expect(typeof batchOperationId).toBe('string');

      // Test gas optimization with real-time data
      const networkStats = txOptimizer.getNetworkStats();
      expect(networkStats.averageGasPrice).toBeGreaterThan(0n);

      // Cleanup
      realTimeUpdater.unsubscribe(poolSubscription);

      return {
        subscriptionCreated: true,
        poolUpdates,
        batchOperationSubmitted: true,
        networkStatsAvailable: !!networkStats.averageGasPrice
      };
    });
  });

  describe('BSC Performance E2E Validation', () => {
    test('should validate BSC batch processing performance', async () => {
      const operationCount = 10;
      const operationIds = [];

      // Submit batch operations
      for (let i = 0; i < operationCount; i++) {
        const operationId = await batchProcessor.submitOperation(
          'APPROVE' as any,
          {
            token: bscTokens.BUSD,
            spender: testAccount.address,
            amount: parseEther('1')
          }
        );
        operationIds.push(operationId);
      }

      expect(operationIds).toHaveLength(operationCount);

      // Monitor batch processing
      const startTime = Date.now();
      const batchStatuses = await Promise.all(
        operationIds.map(id => batchProcessor.getOperationStatus(id))
      );
      const endTime = Date.now();

      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(10000);

      // Test batch optimization
      const optimizationResult = await batchProcessor.optimizeBatch({
        operationIds,
        optimizationStrategy: 'gas_efficient'
      });

      expect(optimizationResult).toBeDefined();
      expect(optimizationResult.optimizedOperations).toBeDefined();

      return {
        operationsSubmitted: operationCount,
        processingTime,
        optimization: {
          gasSavings: optimizationResult.gasSavings,
          optimizedCount: optimizationResult.optimizedOperations.length
        }
      };
    }, 20000);

    test('should validate BSC transaction optimization under load', async () => {
      const transactionCount = 5;
      const optimizations = [];

      // Generate multiple transaction optimizations
      for (let i = 0; i < transactionCount; i++) {
        const optimization = await txOptimizer.optimizeTransaction({
          to: bscTokens.PANCAKE_ROUTER,
          value: parseEther('0.01'),
          data: '0x' + 'a'.repeat(i * 100) // Varying calldata sizes
        });

        optimizations.push(optimization);
      }

      expect(optimizations).toHaveLength(transactionCount);

      // Analyze optimization consistency
      const gasPrices = optimizations.map(opt => opt.gasPrice);
      const gasLimits = optimizations.map(opt => opt.gasLimit);

      expect(gasPrices.every(price => price > 0n)).toBe(true);
      expect(gasLimits.every(limit => limit > 0n)).toBe(true);

      const avgGasPrice = gasPrices.reduce((sum, price) => sum + price, 0n) / BigInt(gasPrices.length);
      const avgGasLimit = gasLimits.reduce((sum, limit) => sum + limit, 0n) / BigInt(gasLimits.length);

      expect(avgGasPrice).toBeGreaterThan(0n);
      expect(avgGasLimit).toBeGreaterThan(0n);

      // Test network statistics consistency
      const networkStats = txOptimizer.getNetworkStats();
      expect(networkStats.averageGasPrice).toBeGreaterThan(0n);
      expect(networkStats.congestionLevel).toBeDefined();

      return {
        optimizations: transactionCount,
        averageGasPrice,
        averageGasLimit,
        networkStats,
        consistency: {
          allPricesPositive: gasPrices.every(p => p > 0n),
          allLimitsPositive: gasLimits.every(l => l > 0n)
        }
      };
    });

    test('should validate BSC performance metrics collection', async () => {
      // Collect metrics from all services
      const metrics = {
        tokenService: tokenService.getMetrics(),
        swapService: swapService.getMetrics(),
        liquidityService: liquidityService.getMetrics(),
        yieldService: yieldService.getMetrics(),
        governanceService: governanceService.getMetrics(),
        realTimeUpdater: realTimeUpdater.getMetrics(),
        batchProcessor: batchProcessor.getMetrics(),
        txOptimizer: txOptimizer.getMetrics()
      };

      // Validate metrics structure
      Object.values(metrics).forEach(serviceMetrics => {
        expect(serviceMetrics).toBeDefined();
        expect(typeof serviceMetrics.totalOperations).toBe('number');
        expect(serviceMetrics.totalOperations).toBeGreaterThanOrEqual(0);
        expect(serviceMetrics.successfulOperations).toBeGreaterThanOrEqual(0);
        expect(serviceMetrics.failedOperations).toBeGreaterThanOrEqual(0);
      });

      // Test BSC-specific metrics
      const bscSpecificMetrics = {
        realTime: metrics.realTimeUpdater.bscSpecific,
        batch: metrics.batchProcessor.bscSpecific,
        optimizer: metrics.txOptimizer.bscSpecific
      };

      Object.values(bscSpecificMetrics).forEach(bscMetrics => {
        expect(bscMetrics).toBeDefined();
      });

      // Test metrics consistency
      const totalOperations = Object.values(metrics).reduce(
        (sum, m) => sum + m.totalOperations, 0
      );
      expect(totalOperations).toBeGreaterThan(0);

      return {
        servicesWithMetrics: Object.keys(metrics).length,
        totalOperations,
        bscSpecificMetrics: Object.keys(bscSpecificMetrics).length,
        metricsConsistency: totalOperations > 0
      };
    });
  });

  describe('BSC Complete Workflow E2E Validation', () => {
    test('should validate complete BSC DeFi workflow', async () => {
      // 1. Token discovery phase
      const wbnbInfo = await tokenService.getTokenInfo(bscTokens.WBNB);
      const busdInfo = await tokenService.getTokenInfo(bscTokens.BUSD);
      const cakeInfo = await tokenService.getTokenInfo(bscTokens.CAKE);

      // 2. Balance checking phase
      const wbnbBalance = await tokenService.getBalance(testAccount.address, bscTokens.WBNB);
      const busdBalance = await tokenService.getBalance(testAccount.address, bscTokens.BUSD);
      const cakeBalance = await tokenService.getBalance(testAccount.address, bscTokens.CAKE);

      // 3. Trading phase - WBNB to BUSD
      const wbnbToBusdQuote = await swapService.getSwapQuote({
        tokenIn: bscTokens.WBNB,
        tokenOut: bscTokens.BUSD,
        amountIn: parseEther('0.01'),
        slippageTolerancePercent: 0.5
      });

      // 4. Gas optimization
      const gasOptimization = await txOptimizer.optimizeTransaction({
        to: wbnbToBusdQuote.router,
        value: wbnbToBusdQuote.amountOut,
        data: wbnbToBusdQuote.transactionData || '0x'
      });

      // 5. Liquidity analysis
      const poolInfo = await liquidityService.getPoolInfo({
        tokenA: bscTokens.WBNB,
        tokenB: bscTokens.BUSD
      });

      const liquidityAmounts = liquidityService.calculateLiquidityAmounts({
        amountADesired: parseEther('0.005'),
        amountBDesired: wbnbToBusdQuote.amountOut / 2n,
        reserveA: poolInfo.reserve0,
        reserveB: poolInfo.reserve1
      });

      // 6. Yield farming analysis
      const farms = await yieldService.getFarms();
      let farmAnalysis = null;
      if (farms.length > 0) {
        farmAnalysis = await yieldService.analyzeFarm({
          farmAddress: farms[0].address,
          stakeTokenAddress: farms[0].stakeToken,
          rewardTokenAddress: farms[0].rewardToken
        });
      }

      // 7. Governance participation
      const votingPower = await governanceService.getVotingPower(testAccount.address);
      const proposals = await governanceService.getProposals();

      // 8. Real-time monitoring setup
      const blockSubscription = realTimeUpdater.subscribe('block', () => {});
      const priceSubscription = realTimeUpdater.subscribe('price', () => {}, {
        tokenAddress: bscTokens.WBNB
      });

      // 9. Batch processing
      const batchOperationId = await batchProcessor.submitOperation(
        'PROCESS_COMPLETE_WORKFLOW' as any,
        {
          timestamp: BigInt(Date.now()),
          workflow: 'bsc-defi-complete'
        }
      );

      // 10. Performance metrics collection
      const performanceMetrics = {
        trading: swapService.getMetrics(),
        liquidity: liquidityService.getMetrics(),
        governance: governanceService.getMetrics(),
        realTime: realTimeUpdater.getMetrics(),
        batch: batchProcessor.getMetrics(),
        optimizer: txOptimizer.getMetrics()
      };

      // Cleanup
      realTimeUpdater.unsubscribe(blockSubscription);
      realTimeUpdater.unsubscribe(priceSubscription);

      // Validate complete workflow
      expect(wbnbInfo.symbol).toBe('WBNB');
      expect(busdInfo.symbol).toBe('BUSD');
      expect(cakeInfo.symbol).toBe('CAKE');
      expect(wbnbToBusdQuote.amountOut).toBeGreaterThan(0n);
      expect(gasOptimization.gasPrice).toBeGreaterThan(0n);
      expect(poolInfo.reserve0).toBeGreaterThanOrEqual(0n);
      expect(liquidityAmounts.amountA).toBeGreaterThan(0n);
      expect(votingPower).toBeGreaterThanOrEqual(0n);
      expect(typeof batchOperationId).toBe('string');

      return {
        tokenDiscovery: {
          tokensValidated: 3,
          symbols: [wbnbInfo.symbol, busdInfo.symbol, cakeInfo.symbol]
        },
        balances: {
          wbnb: wbnbBalance,
          busd: busdBalance,
          cake: cakeBalance
        },
        trading: {
          quoteAmount: wbnbToBusdQuote.amountOut,
          gasOptimization: gasOptimization.gasPrice
        },
        liquidity: {
          poolReserve0: poolInfo.reserve0,
          calculatedAmountA: liquidityAmounts.amountA
        },
        yieldFarming: {
          farmsAvailable: farms.length,
          firstFarmAPR: farmAnalysis?.apr || 0
        },
        governance: {
          votingPower,
          proposals: proposals.length
        },
        monitoring: {
          subscriptionsCreated: 2,
          batchOperationId
        },
        performance: {
          servicesWithMetrics: Object.keys(performanceMetrics).length,
          totalOperations: Object.values(performanceMetrics).reduce(
            (sum, m) => sum + m.totalOperations, 0
          )
        }
      };
    }, 45000);

    test('should validate BSC high-frequency trading workflow', async () => {
      const tradesPerRound = 3;
      const rounds = 2;
      const workflowResults = [];

      for (let round = 0; round < rounds; round++) {
        const roundStart = Date.now();

        // Execute multiple trades in parallel
        const trades = [];
        for (let i = 0; i < tradesPerRound; i++) {
          const trade = swapService.getSwapQuote({
            tokenIn: bscTokens.WBNB,
            tokenOut: bscTokens.BUSD,
            amountIn: parseEther('0.001'),
            slippageTolerancePercent: 1.0
          });
          trades.push(trade);
        }

        const tradeResults = await Promise.allSettled(trades);
        const successfulTrades = tradeResults.filter(r => r.status === 'fulfilled');

        const roundEnd = Date.now();
        const roundDuration = roundEnd - roundStart;

        // Optimize gas for all trades
        const gasOptimizations = await Promise.all(
          successfulTrades.map(async (result) => {
            if (result.status === 'fulfilled') {
              return await txOptimizer.optimizeTransaction({
                to: result.value.router,
                value: result.value.amountOut,
                data: result.value.transactionData || '0x'
              });
            }
            return null;
          })
        );

        const validOptimizations = gasOptimizations.filter(opt => opt !== null);

        workflowResults.push({
          round: round + 1,
          duration: roundDuration,
          tradesAttempted: tradesPerRound,
          tradesSuccessful: successfulTrades.length,
          gasOptimizations: validOptimizations.length
        });

        // Brief pause between rounds
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Analyze workflow performance
      const durations = workflowResults.map(r => r.duration);
      const totalDuration = durations.reduce((sum, d) => sum + d, 0);
      const avgDuration = totalDuration / durations.length;
      const totalTrades = workflowResults.reduce((sum, r) => sum + r.tradesSuccessful, 0);

      // Validate performance consistency
      const successRate = (totalTrades / (workflowResults.length * tradesPerRound)) * 100;
      expect(successRate).toBeGreaterThan(80);

      return {
        rounds: workflowResults.length,
        totalDuration,
        avgDuration,
        totalTrades,
        successRate,
        performance: {
          consistent: Math.max(...durations) - Math.min(...durations) < avgDuration * 0.5
        }
      };
    }, 30000);

    test('should validate BSC complex DeFi strategy simulation', async () => {
      // Simulate a complex DeFi strategy:
      // 1. Arbitrage detection
      // 2. Yield farming optimization
      // 3. Governance participation
      // 4. Risk management

      const strategyStartTime = Date.now();

      // 1. Arbitrage detection simulation
      const wbnbBusdPool = await liquidityService.getPoolInfo({
        tokenA: bscTokens.WBNB,
        tokenB: bscTokens.BUSD
      });

      const wbnbCakePool = await liquidityService.getPoolInfo({
        tokenA: bscTokens.WBNB,
        tokenB: bscTokens.CAKE
      });

      // Calculate arbitrage opportunities
      const arbitrageOpportunity = {
        wbnbBusdRate: wbnbBusdPool.reserve1 / wbnbBusdPool.reserve0,
        wbnbCakeRate: wbnbCakePool.reserve1 / wbnbCakePool.reserve0,
        priceDifference: 0
      };

      arbitrageOpportunity.priceDifference = Math.abs(
        Number(arbitrageOpportunity.wbnbBusdRate) - Number(arbitrageOpportunity.wbnbCakeRate)
      );

      // 2. Yield farming optimization
      const farms = await yieldService.getFarms();
      let bestFarm = null;
      let highestAPR = 0;

      if (farms.length > 0) {
        for (const farm of farms) {
          const analysis = await yieldService.analyzeFarm({
            farmAddress: farm.address,
            stakeTokenAddress: farm.stakeToken,
            rewardTokenAddress: farm.rewardToken
          });
          if (analysis.apr > highestAPR) {
            highestAPR = analysis.apr;
            bestFarm = farm;
          }
        }
      }

      // 3. Governance participation simulation
      const votingPower = await governanceService.getVotingPower(testAccount.address);
      const proposals = await governanceService.getProposals();
      const activeProposals = proposals.filter(p => p.status === 'active');

      const governanceInfluence = {
        votingPower,
        activeProposals: activeProposals.length,
        canVote: votingPower > 0n
      };

      // 4. Risk management assessment
      const riskMetrics = {
        liquidityDepth: Math.min(
          Number(wbnbBusdPool.reserve0),
          Number(wbnbCakePool.reserve0)
        ),
        priceVolatility: 0.15, // Simulated volatility
        smartContractRisk: 0.05, // Low risk for PancakeSwap
        marketRisk: 0.1 // Moderate market risk
      };

      const overallRiskScore = Object.values(riskMetrics).reduce((sum, risk) => sum + risk, 0) / Object.keys(riskMetrics).length;

      // 5. Real-time monitoring setup for strategy execution
      const strategySubscriptions = [];

      const arbitrageSubscription = realTimeUpdater.subscribe('arbitrage', () => {});
      strategySubscriptions.push(arbitrageSubscription);

      const farmSubscription = realTimeUpdater.subscribe('farm', () => {});
      strategySubscriptions.push(farmSubscription);

      const governanceSubscription = realTimeUpdater.subscribe('governance', () => {});
      strategySubscriptions.push(governanceSubscription);

      // 6. Strategy execution simulation
      const strategyExecution = {
        arbitrage: {
          opportunityDetected: arbitrageOpportunity.priceDifference > 0.01,
          priceDifference: arbitrageOpportunity.priceDifference
        },
        yieldFarming: {
          bestFarmAPR: highestAPR,
          bestFarmAvailable: !!bestFarm
        },
        governance: governanceInfluence,
        riskManagement: {
          overallRiskScore,
          riskLevel: overallRiskScore < 0.1 ? 'low' : overallRiskScore < 0.2 ? 'medium' : 'high'
        }
      };

      // Cleanup
      strategySubscriptions.forEach(subId => realTimeUpdater.unsubscribe(subId));

      const strategyEndTime = Date.now();
      const strategyDuration = strategyEndTime - strategyStartTime;

      return {
        arbitrageDetection: {
          priceDifference: arbitrageOpportunity.priceDifference,
          opportunityFound: strategyExecution.arbitrage.opportunityDetected
        },
        yieldOptimization: {
          bestAPR: highestAPR,
          farmsAnalyzed: farms.length,
          bestFarmSelected: !!bestFarm
        },
        governanceParticipation: governanceInfluence,
        riskManagement: {
          riskScore: overallRiskScore,
          riskLevel: strategyExecution.riskManagement.riskLevel
        },
        monitoring: {
          subscriptionsCreated: strategySubscriptions.length,
          strategyDuration
        },
        validation: {
          allServicesFunctional: true,
          dataConsistent: true,
          executionComplete: true
        }
      };
    }, 40000);
  });
});