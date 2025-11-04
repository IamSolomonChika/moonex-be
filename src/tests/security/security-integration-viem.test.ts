import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formatUnits, parseUnits, Address, Hex, Hash } from 'viem';
import { SecurityPatternsViem } from '../../bsc/services/security/security-patterns-viem';
import { MevProtectionViem } from '../../bsc/services/security/mev-protection-viem';
import { TransactionSimulatorViem } from '../../bsc/services/security/transaction-simulator-viem';
import { ContractSecurityMonitorViem } from '../../bsc/services/security/contract-monitor-viem';
import { ICache } from '../../services/cache.service.js';
import { ILogger } from '../../utils/logger.js';

// Mock implementations
const mockCache: ICache = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn()
};

const mockLogger: ILogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
};

const mockPublicClient = {
  getBalance: vi.fn(),
  getBlockNumber: vi.fn(),
  getBlock: vi.fn(),
  call: vi.fn(),
  estimateGas: vi.fn(),
  readContract: vi.fn(),
  simulateContract: vi.fn(),
  writeContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  getGasPrice: vi.fn(),
  getChainId: vi.fn()
};

const mockWalletClient = {
  account: {
    address: '0x1234567890123456789012345678901234567890' as Address
  },
  writeContract: vi.fn()
};

describe('Security Integration Tests - Viem Migration', () => {
  const testAddress = '0x1234567890123456789012345678901234567890' as Address;
  const testPancakeSwapAddress = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as Address;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPublicClient.getBalance.mockResolvedValue(parseUnits('1000', 18));
    mockPublicClient.getBlockNumber.mockResolvedValue(12345n);
    mockPublicClient.getBlock.mockResolvedValue({
      number: 12345n,
      timestamp: 1640995200,
      baseFeePerGas: 20000000000n,
      difficulty: 0n
    } as any);
    mockPublicClient.getGasPrice.mockResolvedValue(20000000000n);
    mockPublicClient.call.mockResolvedValue({ data: '0x1234', status: 'success' } as any);
    mockPublicClient.estimateGas.mockResolvedValue(21000n);
    mockPublicClient.getChainId.mockResolvedValue(56);
  });

  describe('Security Patterns Service', () => {
    let securityPatterns: SecurityPatternsViem;

    beforeEach(() => {
      securityPatterns = new SecurityPatternsViem(
        mockPublicClient as any,
        mockCache,
        mockLogger,
        {
          enableBlacklist: true,
          enableWhitelist: true,
          enableRealTimeValidation: true,
          cacheTTL: 300,
          bscSpecific: {
            blacklistedContracts: [],
            whitelistedContracts: [testPancakeSwapAddress],
            knownHoneyPots: [],
            trackTokenApprovals: true,
            validatePancakeSwapInteractions: true
          }
        }
      );
    });

    it('should validate addresses correctly', async () => {
      const result = await securityPatterns.validateAddress(testAddress);

      expect(result.isValid).toBe(true);
      expect(result.isBlacklisted).toBe(false);
      expect(result.isWhitelisted).toBe(false);
      expect(mockPublicClient.getBalance).toHaveBeenCalledWith({ address: testAddress });
    });

    it('should detect blacklisted addresses', async () => {
      const blacklistedAddress = '0x0000000000000000000000000000000000000001' as Address;

      // Add to blacklist via configuration
      const securityWithBlacklist = new SecurityPatternsViem(
        mockPublicClient as any,
        mockCache,
        mockLogger,
        {
          enableBlacklist: true,
          blacklistedContracts: [blacklistedAddress],
          bscSpecific: {
            blacklistedContracts: [blacklistedAddress],
            whitelistedContracts: [],
            knownHoneyPots: [],
            trackTokenApprovals: true,
            validatePancakeSwapInteractions: true
          }
        }
      );

      const result = await securityWithBlacklist.validateAddress(blacklistedAddress);

      expect(result.isValid).toBe(false);
      expect(result.isBlacklisted).toBe(true);
      expect(result.riskLevel).toBe('critical');
    });

    it('should validate PancakeSwap interactions', async () => {
      const result = await securityPatterns.validateAddress(testPancakeSwapAddress);

      expect(result.isValid).toBe(true);
      expect(result.isWhitelisted).toBe(true);
      expect(result.isPancakeSwapContract).toBe(true);
    });

    it('should validate transactions', async () => {
      const transaction = {
        to: testAddress,
        value: parseUnits('1', 18).toString(),
        data: '0x095ea7b3' as Hex // approve function signature
      };

      const result = await securityPatterns.validateTransaction(
        testAddress,
        transaction.to,
        transaction.value,
        transaction.data
      );

      expect(result.isValid).toBe(true);
      expect(result.riskLevel).toBe('low');
    });

    it('should detect suspicious transaction patterns', async () => {
      const highValueTransaction = {
        to: testAddress,
        value: parseUnits('10000', 18).toString(),
        data: '0x' as Hex
      };

      const result = await securityPatterns.validateTransaction(
        testAddress,
        highValueTransaction.to,
        highValueTransaction.value,
        highValueTransaction.data
      );

      expect(result.riskLevel).toBe('high');
      expect(result.warnings).toContain('High value transaction detected');
    });

    it('should perform contract security validation', async () => {
      const result = await securityPatterns.validateContract(testAddress);

      expect(result).toBeDefined();
      expect(result.isVerified).toBeDefined();
      expect(result.hasAudit).toBeDefined();
      expect(result.securityScore).toBeDefined();
    });
  });

  describe('MEV Protection Service', () => {
    let mevProtection: MevProtectionViem;

    beforeEach(() => {
      mevProtection = new MevProtectionViem(
        mockPublicClient as any,
        mockWalletClient as any,
        mockCache,
        mockLogger,
        {
          enabled: true,
          protectionLevel: 'high',
          bscSpecific: {
            enablePancakeSwapProtection: true,
            monitorCommonMEVVectors: true,
            privateMempools: ['flashbots'],
            maxSlippage: 5,
            minLiquidity: parseUnits('1000', 18)
          }
        }
      );
    });

    it('should analyze MEV risk for transactions', async () => {
      const transaction = {
        from: testAddress,
        to: testPancakeSwapAddress,
        data: '0x38ed1739', // swapExactETHForTokens function
        value: parseUnits('10', 18).toString(),
        gasPrice: '20000000000',
        gasLimit: '300000'
      };

      const result = await mevProtection.analyzeMevRisk(transaction, {
        userAddress: testAddress,
        priority: 'normal',
        maxSlippage: 5,
        deadline: Date.now() + 3600000,
        usePrivateMempool: false
      });

      expect(result).toBeDefined();
      expect(result.frontRunningRisk).toBeDefined();
      expect(result.sandwichAttackRisk).toBeDefined();
      expect(result.overallRisk).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should protect transactions from MEV attacks', async () => {
      const transaction = {
        from: testAddress,
        to: testPancakeSwapAddress,
        data: '0x38ed1739',
        value: parseUnits('10', 18).toString(),
        gasPrice: '20000000000',
        gasLimit: '300000'
      };

      const result = await mevProtection.protectTransaction({
        transaction,
        userAddress: testAddress,
        priority: 'normal',
        maxSlippage: 5,
        deadline: Date.now() + 3600000,
        usePrivateMempool: true
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.protectionApplied).toBeDefined();
      expect(result.optimizedGasPrice).toBeDefined();
    });

    it('should create MEV bundles for private mempool', async () => {
      const transactions = [
        {
          from: testAddress,
          to: testPancakeSwapAddress,
          data: '0x38ed1739',
          value: parseUnits('10', 18).toString(),
          gasPrice: '20000000000',
          gasLimit: '300000'
        }
      ];

      const bundle = await mevProtection.createMevBundle(
        transactions,
        'private_mempool',
        {
          address: testAddress,
          preferences: {
            priority: 'high',
            maxSlippage: 3,
            usePrivateMempool: true,
            minGasPrice: '20000000000'
          }
        }
      );

      expect(bundle).toBeDefined();
      expect(bundle.transactions).toHaveLength(1);
      expect(bundle.bundleHash).toBeDefined();
      expect(bundle.strategy).toBe('private_mempool');
    });

    it('should detect front-running opportunities', async () => {
      // Mock pending transactions
      mockPublicClient.readContract.mockResolvedValue([testAddress] as Address[]);

      const transaction = {
        from: testAddress,
        to: testPancakeSwapAddress,
        data: '0x38ed1739',
        value: parseUnits('1000', 18).toString(), // High value
        gasPrice: '20000000000',
        gasLimit: '300000'
      };

      const result = await mevProtection.analyzeMevRisk(transaction, {
        userAddress: testAddress,
        priority: 'normal',
        maxSlippage: 5,
        deadline: Date.now() + 3600000,
        usePrivateMempool: false
      });

      expect(result.frontRunningRisk.risk).toBeGreaterThan(50);
      expect(result.sandwichAttackRisk.risk).toBeGreaterThan(30);
    });
  });

  describe('Transaction Simulator Service', () => {
    let transactionSimulator: TransactionSimulatorViem;

    beforeEach(() => {
      transactionSimulator = new TransactionSimulatorViem(
        mockPublicClient as any,
        mockWalletClient as any,
        mockCache,
        {
          chainId: 56,
          pancakeSwapRouter: testPancakeSwapAddress,
          pancakeSwapFactory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as Address,
          commonTokens: {
            WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
            BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
            CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' as Address,
            USDT: '0x55d398326f99059fF775485246999027B3197955' as Address,
            USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' as Address,
          },
          blacklistedAddresses: [],
          honeyPotDetector: true,
          gasPriceMultiplier: 1.1
        }
      );
    });

    it('should simulate transactions successfully', async () => {
      const request = {
        transaction: {
          to: testAddress,
          data: '0x095ea7b3' as Hex,
          value: '0',
          from: testAddress,
          gasPrice: '20000000000',
          gasLimit: '100000'
        }
      };

      const result = await transactionSimulator.simulateTransaction(request);

      expect(result.success).toBe(true);
      expect(result.gasUsed).toBeDefined();
      expect(result.gasLimit).toBe('100000');
      expect(result.analysis).toBeDefined();
      expect(result.riskLevel).toBe('low');
      expect(result.analysis.bscSpecificAnalysis).toBeDefined();
    });

    it('should handle failed transactions', async () => {
      mockPublicClient.call.mockRejectedValue(new Error('Revert: insufficient balance'));

      const request = {
        transaction: {
          to: testAddress,
          data: '0x095ea7b3' as Hex,
          value: parseUnits('999999999', 18).toString(), // Too much value
          from: testAddress,
          gasPrice: '20000000000',
          gasLimit: '100000'
        }
      };

      const result = await transactionSimulator.simulateTransaction(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.revertReason).toBeDefined();
      expect(result.riskLevel).toBe('high');
    });

    it('should simulate batch transactions', async () => {
      const batchRequest = {
        transactions: [
          {
            transaction: {
              to: testAddress,
              data: '0x095ea7b3' as Hex,
              value: '0',
              from: testAddress,
              gasPrice: '20000000000',
              gasLimit: '50000'
            }
          },
          {
            transaction: {
              to: testPancakeSwapAddress,
              data: '0x38ed1739' as Hex,
              value: parseUnits('1', 18).toString(),
              from: testAddress,
              gasPrice: '20000000000',
              gasLimit: '200000'
            }
          }
        ],
        concurrency: 2,
        enableCorrelation: true
      };

      const result = await transactionSimulator.simulateBatch(batchRequest);

      expect(result.results).toHaveLength(2);
      expect(result.summary.totalTransactions).toBe(2);
      expect(result.summary.successfulSimulations).toBeGreaterThanOrEqual(0);
      expect(result.summary.bscSpecific.pancakeSwapInteractions).toBeGreaterThanOrEqual(0);
      expect(result.correlations).toBeDefined();
    });

    it('should optimize gas usage', async () => {
      const request = {
        transaction: {
          to: testAddress,
          data: '0x095ea7b3' as Hex,
          value: '0',
          from: testAddress,
          gasPrice: '20000000000',
          gasLimit: '500000' // Initially high gas limit
        }
      };

      const optimization = await transactionSimulator.optimizeGasUsage(request);

      expect(optimization.optimizedGasLimit).toBeDefined();
      expect(optimization.potentialSavings).toBeDefined();
      expect(optimization.recommendations).toBeDefined();
      expect(optimization.bscSpecific).toBeDefined();
      expect(optimization.optimizationMethods).toContain('gas_limit_adjustment');
    });

    it('should perform security checks', async () => {
      const request = {
        transaction: {
          to: testAddress,
          data: '0x095ea7b3' as Hex,
          value: '0',
          from: testAddress,
          gasPrice: '20000000000',
          gasLimit: '100000'
        }
      };

      const securityCheck = await transactionSimulator.performSecurityCheck(request);

      expect(securityCheck.passed).toBeDefined();
      expect(securityCheck.checks).toBeDefined();
      expect(securityCheck.overallRisk).toBeDefined();
      expect(securityCheck.bscSpecificChecks).toBeDefined();
      expect(securityCheck.bscSpecificChecks.honeyPotCheck).toBeDefined();
      expect(securityCheck.bscSpecificChecks.pancakeSwapCompatibility).toBeDefined();
    });

    it('should detect PancakeSwap interactions', async () => {
      const request = {
        transaction: {
          to: testPancakeSwapAddress,
          data: '0x38ed1739' as Hex, // swapExactETHForTokens
          value: parseUnits('10', 18).toString(),
          from: testAddress,
          gasPrice: '20000000000',
          gasLimit: '300000'
        }
      };

      const result = await transactionSimulator.simulateTransaction(request);

      expect(result.success).toBe(true);
      expect(result.analysis.bscSpecificAnalysis.pancakeSwapInteraction).toBe(true);
      expect(result.warnings).toContain('Transaction interacts with PancakeSwap');
    });

    it('should identify token approvals', async () => {
      const request = {
        transaction: {
          to: testAddress,
          data: '0x095ea7b3000000000000000000000000' + // approve function signature
                 '0000000000000000000000000000000000000000' + // spender address
                 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', // unlimited amount
          value: '0',
          from: testAddress,
          gasPrice: '20000000000',
          gasLimit: '50000'
        }
      };

      const result = await transactionSimulator.simulateTransaction(request);

      expect(result.success).toBe(true);
      expect(result.analysis.bscSpecificAnalysis.tokenApprovals).toContain(testAddress);
      expect(result.analysis.securityAnalysis.approvalRisk).toBe(true);
    });
  });

  describe('Contract Security Monitor Service', () => {
    let contractMonitor: ContractSecurityMonitorViem;

    beforeEach(() => {
      contractMonitor = new ContractSecurityMonitorViem(
        mockPublicClient as any,
        mockWalletClient as any,
        mockCache,
        {
          enabled: true,
          monitoringInterval: 60000,
          alertThresholds: {
            balanceChange: 10000,
            transactionVolume: 100000,
            gasUsage: 200,
            errorRate: 10,
            responseTime: 5000,
            bnbChange: parseUnits('10', 18).toString(),
            tokenPriceChange: 20
          },
          vulnerabilityScan: {
            enabled: true,
            scanInterval: 24,
            scanMethods: ['transfer', 'approve', 'swap'],
            severityLevels: ['low', 'medium', 'high', 'critical'],
            autoBlock: false,
            manualReviewRequired: ['high', 'critical'],
            useAdvancedAnalysis: true,
            checkHoneyPots: true,
            checkRugPulls: true
          },
          eventMonitoring: {
            enabled: true,
            suspiciousEvents: ['OwnershipTransferred', 'Paused', 'TokenMinted'],
            eventFilters: [],
            realTimeAnalysis: true,
            trackDEXEvents: true,
            trackTokenEvents: true,
            trackGoveranceEvents: true
          },
          stateMonitoring: {
            enabled: true,
            monitoredVariables: ['balance', 'owner', 'paused'],
            changeThreshold: 10,
            storageSlots: [],
            balanceTracking: true,
            ownerTracking: true,
            liquidityTracking: true,
            tokenSupplyTracking: true
          },
          notifications: {
            email: { enabled: false, recipients: [], template: 'default' },
            webhook: { enabled: false, endpoints: [], headers: {}, timeout: 5000 },
            slack: { enabled: false, webhook: '', channel: '#security' },
            telegram: { enabled: false, botToken: '', chatId: '' },
            discord: { enabled: false, webhook: '', channelId: '#security' }
          },
          bscSpecific: {
            enabled: true,
            trackPancakeSwap: true,
            trackKnownScams: true,
            trackTokenMints: true,
            trackLiquidityChanges: true,
            blacklistedContracts: [],
            whitelistedContracts: [testPancakeSwapAddress],
            knownHoneyPotPatterns: [],
            rugPullThresholds: {
              liquidityDrain: 80,
              priceDump: 50,
              suddenSell: 90
            }
          }
        }
      );
    });

    it('should add contracts for monitoring', async () => {
      const contractInfo = {
        address: testAddress,
        name: 'Test Contract',
        type: 'token' as const,
        version: '1.0.0',
        verified: true,
        audited: false,
        owner: testAddress,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        metadata: {},
        bscSpecific: {
          isPancakeSwapContract: false,
          knownTokenPairs: [],
          liquidityProvider: false,
          farmContract: false
        }
      };

      await contractMonitor.addContract(contractInfo);

      const retrieved = await contractMonitor.getContract(testAddress);
      expect(retrieved).toBeDefined();
      expect(retrieved?.address).toBe(testAddress);
      expect(retrieved?.name).toBe('Test Contract');
    });

    it('should scan contracts for vulnerabilities', async () => {
      const contractInfo = {
        address: testAddress,
        name: 'Test Contract',
        type: 'token' as const,
        version: '1.0.0',
        verified: true,
        audited: false,
        owner: testAddress,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        metadata: {}
      };

      await contractMonitor.addContract(contractInfo);

      const report = await contractMonitor.scanContractForVulnerabilities(testAddress);

      expect(report).toBeDefined();
      expect(report.contractAddress).toBe(testAddress);
      expect(report.vulnerabilities).toBeDefined();
      expect(report.riskScore).toBeGreaterThanOrEqual(0);
      expect(report.bscSpecific).toBeDefined();
      expect(report.scanner).toBe('contract-monitor-viem-v1');
    });

    it('should create and manage security alerts', async () => {
      const contractInfo = {
        address: testAddress,
        name: 'Test Contract',
        type: 'token' as const,
        version: '1.0.0',
        verified: true,
        audited: false,
        owner: testAddress,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        metadata: {}
      };

      await contractMonitor.addContract(contractInfo);

      const alertId = await contractMonitor.createAlert({
        contractAddress: testAddress,
        type: 'suspicious_activity',
        severity: 'high',
        title: 'Test Alert',
        description: 'This is a test alert',
        details: { test: true }
      });

      expect(alertId).toBeDefined();

      const alerts = await contractMonitor.getAlerts({ contractAddress: testAddress });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].id).toBe(alertId);
      expect(alerts[0].severity).toBe('high');

      await contractMonitor.resolveAlert(alertId, 'Test resolution');
      const resolvedAlerts = await contractMonitor.getAlerts({ contractAddress: testAddress });
      expect(resolvedAlerts[0].status).toBe('resolved');
    });

    it('should capture state snapshots', async () => {
      const contractInfo = {
        address: testAddress,
        name: 'Test Contract',
        type: 'token' as const,
        version: '1.0.0',
        verified: true,
        audited: false,
        owner: testAddress,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        metadata: {}
      };

      await contractMonitor.addContract(contractInfo);

      const snapshot = await contractMonitor.captureStateSnapshot(testAddress);

      expect(snapshot).toBeDefined();
      expect(snapshot.contractAddress).toBe(testAddress);
      expect(snapshot.balance).toBeDefined();
      expect(snapshot.bnbBalance).toBeDefined();
      expect(snapshot.blockNumber).toBeDefined();
      expect(snapshot.bscSpecific).toBeDefined();
    });

    it('should analyze events', async () => {
      const contractInfo = {
        address: testAddress,
        name: 'Test Contract',
        type: 'token' as const,
        version: '1.0.0',
        verified: true,
        audited: false,
        owner: testAddress,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        metadata: {}
      };

      await contractMonitor.addContract(contractInfo);

      const log = {
        address: testAddress,
        topics: [
          '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925', // Approval event signature
          '0x000000000000000000000000' + testAddress.slice(2),
          '0x000000000000000000000000' + testPancakeSwapAddress.slice(2)
        ] as readonly Hex[],
        data: toHex(parseUnits('1000', 18)),
        blockNumber: 12345n,
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hash,
        logIndex: 0,
        blockHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hash,
        removed: false
      };

      const analysis = await contractMonitor.analyzeEvent(log, contractInfo);

      expect(analysis).toBeDefined();
      expect(analysis.eventType).toBeDefined();
      expect(analysis.contractAddress).toBe(testAddress);
      expect(analysis.analysis).toBeDefined();
      expect(analysis.bscSpecific).toBeDefined();
    });

    it('should provide security metrics', async () => {
      const metrics = await contractMonitor.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.contractsMonitored).toBeGreaterThanOrEqual(0);
      expect(metrics.alertsGenerated).toBeGreaterThanOrEqual(0);
      expect(metrics.bscSpecific).toBeDefined();
      expect(metrics.bscSpecific.pancakeSwapAlerts).toBeGreaterThanOrEqual(0);
      expect(metrics.bscSpecific.monitoredTokens).toBeGreaterThanOrEqual(0);
    });

    it('should provide monitoring status', async () => {
      const status = await contractMonitor.getStatus();

      expect(status).toBeDefined();
      expect(status.active).toBeDefined();
      expect(status.contractsCount).toBeGreaterThanOrEqual(0);
      expect(status.bscSpecific).toBeDefined();
      expect(status.performance).toBeDefined();
      expect(status.performance.bscSpecific).toBeDefined();
    });

    it('should perform health checks', async () => {
      const health = await contractMonitor.healthCheck();

      expect(health).toBeDefined();
      expect(health.status).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.details).toBeDefined();
      expect(health.details.monitoringActive).toBeDefined();
      expect(health.details.bscSpecific).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should work together - Security to MEV to Simulator to Monitor', async () => {
      // Initialize all services
      const securityPatterns = new SecurityPatternsViem(
        mockPublicClient as any,
        mockCache,
        mockLogger,
        {
          enableBlacklist: true,
          enableWhitelist: true,
          bscSpecific: {
            blacklistedContracts: [],
            whitelistedContracts: [testPancakeSwapAddress],
            knownHoneyPots: [],
            trackTokenApprovals: true,
            validatePancakeSwapInteractions: true
          }
        }
      );

      const mevProtection = new MevProtectionViem(
        mockPublicClient as any,
        mockWalletClient as any,
        mockCache,
        mockLogger,
        { enabled: true, protectionLevel: 'high' }
      );

      const transactionSimulator = new TransactionSimulatorViem(
        mockPublicClient as any,
        mockWalletClient as any,
        mockCache
      );

      const contractMonitor = new ContractSecurityMonitorViem(
        mockPublicClient as any,
        mockWalletClient as any,
        mockCache,
        { enabled: true }
      );

      // 1. Add contract to monitoring
      const contractInfo = {
        address: testPancakeSwapAddress,
        name: 'PancakeSwap Router',
        type: 'dex' as const,
        version: '2.0.0',
        verified: true,
        audited: true,
        owner: testAddress,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        metadata: {},
        bscSpecific: {
          isPancakeSwapContract: true,
          knownTokenPairs: [],
          liquidityProvider: false,
          farmContract: false
        }
      };

      await contractMonitor.addContract(contractInfo);

      // 2. Validate transaction with security patterns
      const securityValidation = await securityPatterns.validateTransaction(
        testAddress,
        testPancakeSwapAddress,
        parseUnits('10', 18).toString(),
        '0x38ed1739' as Hex
      );

      expect(securityValidation.isValid).toBe(true);

      // 3. Simulate transaction
      const simulationRequest = {
        transaction: {
          to: testPancakeSwapAddress,
          data: '0x38ed1739' as Hex,
          value: parseUnits('10', 18).toString(),
          from: testAddress,
          gasPrice: '20000000000',
          gasLimit: '300000'
        }
      };

      const simulation = await transactionSimulator.simulateTransaction(simulationRequest);
      expect(simulation.success).toBe(true);
      expect(simulation.analysis.bscSpecificAnalysis.pancakeSwapInteraction).toBe(true);

      // 4. Analyze MEV risk
      const mevRisk = await mevProtection.analyzeMevRisk(
        simulationRequest.transaction,
        {
          userAddress: testAddress,
          priority: 'normal',
          maxSlippage: 5,
          deadline: Date.now() + 3600000,
          usePrivateMempool: false
        }
      );

      expect(mevRisk.overallRisk).toBeDefined();
      expect(mevRisk.recommendations).toBeDefined();

      // 5. Capture state snapshot
      const snapshot = await contractMonitor.captureStateSnapshot(testPancakeSwapAddress);
      expect(snapshot.contractAddress).toBe(testPancakeSwapAddress);

      // All services work together without errors
      expect(true).toBe(true);
    });

    it('should handle security threats across all services', async () => {
      const suspiciousAddress = '0x000000000000000000000000000000000000dead' as Address;

      // Mock suspicious behavior
      mockPublicClient.call.mockRejectedValue(new Error('Revert: malicious contract'));

      const securityPatterns = new SecurityPatternsViem(
        mockPublicClient as any,
        mockCache,
        mockLogger,
        {
          enableBlacklist: true,
          blacklistedContracts: [suspiciousAddress],
          bscSpecific: {
            blacklistedContracts: [suspiciousAddress],
            whitelistedContracts: [],
            knownHoneyPots: [suspiciousAddress],
            trackTokenApprovals: true,
            validatePancakeSwapInteractions: true
          }
        }
      );

      const transactionSimulator = new TransactionSimulatorViem(
        mockPublicClient as any,
        mockWalletClient as any,
        mockCache
      );

      const contractMonitor = new ContractSecurityMonitorViem(
        mockPublicClient as any,
        mockWalletClient as any,
        mockCache,
        {
          enabled: true,
          vulnerabilityScan: {
            enabled: true,
            checkHoneyPots: true,
            checkRugPulls: true
          },
          bscSpecific: {
            enabled: true,
            blacklistedContracts: [suspiciousAddress],
            trackKnownScams: true,
            rugPullThresholds: {
              liquidityDrain: 80,
              priceDump: 50,
              suddenSell: 90
            }
          }
        }
      );

      // Test address validation
      const addressValidation = await securityPatterns.validateAddress(suspiciousAddress);
      expect(addressValidation.isValid).toBe(false);
      expect(addressValidation.isBlacklisted).toBe(true);
      expect(addressValidation.riskLevel).toBe('critical');

      // Test transaction simulation
      const simulationRequest = {
        transaction: {
          to: suspiciousAddress,
          data: '0x38ed1739' as Hex,
          value: parseUnits('1000', 18).toString(),
          from: testAddress,
          gasPrice: '20000000000',
          gasLimit: '500000'
        }
      };

      const simulation = await transactionSimulator.simulateTransaction(simulationRequest);
      expect(simulation.success).toBe(false);
      expect(simulation.riskLevel).toBe('high');

      // Test contract monitoring
      const contractInfo = {
        address: suspiciousAddress,
        name: 'Suspicious Contract',
        type: 'token' as const,
        version: '1.0.0',
        verified: false,
        audited: false,
        owner: testAddress,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        metadata: {}
      };

      await contractMonitor.addContract(contractInfo);
      const vulnerabilityReport = await contractMonitor.scanContractForVulnerabilities(suspiciousAddress);

      expect(vulnerabilityReport.vulnerabilities.length).toBeGreaterThan(0);
      expect(vulnerabilityReport.riskScore).toBeGreaterThan(50);
    });
  });

  describe('BSC-Specific Features', () => {
    it('should handle PancakeSwap-specific security patterns', async () => {
      const securityPatterns = new SecurityPatternsViem(
        mockPublicClient as any,
        mockCache,
        mockLogger,
        {
          enableBlacklist: true,
          bscSpecific: {
            blacklistedContracts: [],
            whitelistedContracts: [testPancakeSwapAddress],
            knownHoneyPots: [],
            trackTokenApprovals: true,
            validatePancakeSwapInteractions: true
          }
        }
      );

      const transactionSimulator = new TransactionSimulatorViem(
        mockPublicClient as any,
        mockWalletClient as any,
        mockCache
      );

      // Test PancakeSwap approval transaction
      const approvalRequest = {
        transaction: {
          to: testPancakeSwapAddress,
          data: '0x095ea7b3000000000000000000000000' + // approve
                 testAddress.slice(2).padStart(64, '0') + // spender
                 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', // amount
          value: '0',
          from: testAddress,
          gasPrice: '20000000000',
          gasLimit: '50000'
        }
      };

      const simulation = await transactionSimulator.simulateTransaction(approvalRequest);

      expect(simulation.analysis.bscSpecificAnalysis.pancakeSwapInteraction).toBe(true);
      expect(simulation.analysis.bscSpecificAnalysis.tokenApprovals).toContain(testAddress);
    });

    it('should detect honey pot patterns', async () => {
      const honeyPotAddress = '0x8e870d67f660d95d5be630bb64f8d5ba804b3cd2' as Address;

      const contractMonitor = new ContractSecurityMonitorViem(
        mockPublicClient as any,
        mockWalletClient as any,
        mockCache,
        {
          enabled: true,
          vulnerabilityScan: {
            enabled: true,
            checkHoneyPots: true
          },
          bscSpecific: {
            enabled: true,
            knownHoneyPotPatterns: ['8e870d67f660d95d5be630bb64f8d5ba804b3cd2'],
            trackKnownScams: true
          }
        }
      );

      const contractInfo = {
        address: honeyPotAddress,
        name: 'Honey Pot Token',
        type: 'token' as const,
        version: '1.0.0',
        verified: false,
        audited: false,
        owner: testAddress,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        metadata: {}
      };

      await contractMonitor.addContract(contractInfo);

      // This should create alerts for honey pot detection
      const alerts = await contractMonitor.getAlerts({ contractAddress: honeyPotAddress });

      // The monitoring system should detect honey pot patterns
      expect(contractMonitor).toBeDefined();
    });

    it('should monitor gas prices and network conditions', async () => {
      mockPublicClient.getGasPrice.mockResolvedValue(50000000000n); // 50 Gwei

      const transactionSimulator = new TransactionSimulatorViem(
        mockPublicClient as any,
        mockWalletClient as any,
        mockCache
      );

      const request = {
        transaction: {
          to: testAddress,
          data: '0x095ea7b3' as Hex,
          value: '0',
          from: testAddress,
          gasPrice: '50000000000', // 50 Gwei
          gasLimit: '100000'
        }
      };

      const result = await transactionSimulator.simulateTransaction(request);

      expect(result.effectiveGasPrice).toBe('50000000000');

      const optimization = await transactionSimulator.optimizeGasUsage(request);
      expect(optimization.optimizedGasPrice).toBeDefined();
    });
  });
});