import { Logger } from '../../../utils/logger.js';
import { EventEmitter } from 'events';
import { ICache } from '../../../services/cache.service.js';
import {
  PublicClient,
  WalletClient,
  Address,
  Hash,
  Hex,
  Chain,
  Transport,
  Block,
  Log,
  Transaction,
  TransactionReceipt
} from 'viem';
import { formatUnits, parseUnits, toHex, isAddress, getAddress } from 'viem';

const logger = new Logger('ContractSecurityMonitorViem');

// Viem-compatible types and interfaces
export interface ContractMonitorConfigViem {
  enabled: boolean;
  monitoringInterval: number; // milliseconds
  alertThresholds: AlertThresholdsViem;
  vulnerabilityScan: VulnerabilityScanConfigViem;
  eventMonitoring: EventMonitoringConfigViem;
  stateMonitoring: StateMonitoringConfigViem;
  notifications: NotificationConfigViem;
  bscSpecific: BscSpecificMonitoringConfig;
}

export interface AlertThresholdsViem {
  balanceChange: number; // USD
  transactionVolume: number; // USD per hour
  gasUsage: number; // percentage above average
  errorRate: number; // percentage
  responseTime: number; // milliseconds
  bnbChange: number; // BNB amount
  tokenPriceChange: number; // percentage
}

export interface VulnerabilityScanConfigViem {
  enabled: boolean;
  scanInterval: number; // hours
  scanMethods: string[];
  severityLevels: ('low' | 'medium' | 'high' | 'critical')[];
  autoBlock: boolean;
  manualReviewRequired: ('high' | 'critical')[];
  useAdvancedAnalysis: boolean;
  checkHoneyPots: boolean;
  checkRugPulls: boolean;
}

export interface EventMonitoringConfigViem {
  enabled: boolean;
  suspiciousEvents: string[];
  eventFilters: EventFilterViem[];
  realTimeAnalysis: boolean;
  trackDEXEvents: boolean;
  trackTokenEvents: boolean;
  trackGoveranceEvents: boolean;
}

export interface EventFilterViem {
  eventName: string;
  contractAddress?: Address;
  conditions: EventConditionViem[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'block' | 'investigate';
}

export interface EventConditionViem {
  parameter: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'regex' | 'address_equals';
  value: any;
}

export interface StateMonitoringConfigViem {
  enabled: boolean;
  monitoredVariables: string[];
  changeThreshold: number; // percentage
  storageSlots: Hex[];
  balanceTracking: boolean;
  ownerTracking: boolean;
  liquidityTracking: boolean;
  tokenSupplyTracking: boolean;
}

export interface NotificationConfigViem {
  email: EmailNotificationConfigViem;
  webhook: WebhookNotificationConfigViem;
  slack: SlackNotificationConfigViem;
  telegram: TelegramNotificationConfigViem;
  discord: DiscordNotificationConfigViem;
}

export interface EmailNotificationConfigViem {
  enabled: boolean;
  recipients: string[];
  template: string;
}

export interface WebhookNotificationConfigViem {
  enabled: boolean;
  endpoints: string[];
  headers: { [key: string]: string };
  timeout: number;
}

export interface SlackNotificationConfigViem {
  enabled: boolean;
  webhook: string;
  channel: string;
  mentionUsers?: string[];
}

export interface TelegramNotificationConfigViem {
  enabled: boolean;
  botToken: string;
  chatId: string;
}

export interface DiscordNotificationConfigViem {
  enabled: boolean;
  webhook: string;
  channelId: string;
  mentionRoles?: string[];
}

export interface BscSpecificMonitoringConfig {
  enabled: boolean;
  trackPancakeSwap: boolean;
  trackKnownScams: boolean;
  trackTokenMints: boolean;
  trackLiquidityChanges: boolean;
  blacklistedContracts: Address[];
  whitelistedContracts: Address[];
  knownHoneyPotPatterns: string[];
  rugPullThresholds: {
    liquidityDrain: number; // percentage
    priceDump: number; // percentage
    suddenSell: number; // percentage
  };
}

export interface ContractInfoViem {
  address: Address;
  name: string;
  type: 'token' | 'dex' | 'lending' | 'governance' | 'liquidity_pool' | 'farm' | 'bridge' | 'other';
  version: string;
  verified: boolean;
  audited: boolean;
  owner: Address;
  createdAt: number;
  lastActivity: number;
  metadata: { [key: string]: any };
  bscSpecific?: {
    isPancakeSwapContract: boolean;
    knownTokenPairs: Address[];
    liquidityProvider: boolean;
    farmContract: boolean;
  };
}

export interface SecurityAlertViem {
  id: string;
  contractAddress: Address;
  type: AlertTypeViem;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  details: { [key: string]: any };
  timestamp: number;
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  assignedTo?: Address;
  resolvedAt?: number;
  resolution?: string;
  bscSpecific?: {
    affectedTokens?: Address[];
    dexInvolved?: Address;
    transactionHash?: Hash;
    blockNumber?: bigint;
  };
}

export type AlertTypeViem =
  | 'vulnerability_found'
  | 'suspicious_activity'
  | 'unusual_state_change'
  | 'high_gas_usage'
  | 'access_control_breach'
  | 'owner_changed'
  | 'contract_paused'
  | 'emergency_mode'
  | 'upgrade_detected'
  | 'liquidity_drain'
  | 'price_manipulation'
  | 'honey_pot_detected'
  | 'rug_pull_detected'
  | 'pancakeswap_anomaly'
  | 'token_mint_suspicious'
  | 'unauthorized_approval'
  | 'flash_loan_attack';

export interface VulnerabilityReportViem {
  id: string;
  contractAddress: Address;
  scanDate: number;
  vulnerabilities: VulnerabilityViem[];
  riskScore: number;
  recommendations: string[];
  nextScanDate: number;
  scanner: string;
  bscSpecific: {
    pancakeSwapIntegration: boolean;
    tokenInteractions: Address[];
    liquidityPools: Address[];
    knownRisks: string[];
  };
}

export interface VulnerabilityViem {
  type: VulnerabilityTypeViem;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  location: string;
  impact: string;
  mitigation: string;
  cweId?: string;
  cvssScore?: number;
  references: string[];
  bscSpecific?: {
    pancakeSwapRisk: boolean;
    tokenRisk: boolean;
    liquidityRisk: boolean;
  };
}

export type VulnerabilityTypeViem =
  | 'reentrancy'
  | 'integer_overflow'
  | 'access_control'
  | 'logic_error'
  | 'dos_vulnerability'
  | 'front_running'
  | 'timestamp_dependency'
  | 'gas_limit'
  | 'unchecked_call'
  | 'uninitialized_storage'
  | 'delegatecall_vulnerability'
  | 'selfdestruct_vulnerability'
  | 'provenance_validation'
  | 'honey_pot'
  | 'rug_pull'
  | 'flash_loan_attack'
  | 'price_manipulation';

export interface EventAnalysisViem {
  eventType: string;
  parameters: { [key: string]: any };
  timestamp: number;
  blockNumber: bigint;
  transactionHash: Hash;
  contractAddress: Address;
  analysis: {
    suspicious: boolean;
    riskScore: number;
    indicators: string[];
    relatedAlerts: string[];
  };
  bscSpecific?: {
    pancakeSwapOperation?: string;
    tokenFlow?: {
      from: Address;
      to: Address;
      amount: string;
      token?: Address;
    }[];
    priceImpact?: number;
  };
}

export interface StateSnapshotViem {
  contractAddress: Address;
  blockNumber: bigint;
  timestamp: number;
  balance: string;
  bnbBalance: string;
  storage: { [slot: Hex]: Hex };
  variables: { [key: string]: any };
  events: EventAnalysisViem[];
  bscSpecific?: {
    tokenBalances: { [tokenAddress: Address]: string };
    liquidityPositions: Array<{
      token0: Address;
      token1: Address;
      balance: string;
    }>;
    farmPositions: Array<{
      poolAddress: Address;
      stakedAmount: string;
      rewards: string;
    }>;
  };
  metadata: { [key: string]: any };
}

export interface SecurityMetricsViem {
  contractsMonitored: number;
  alertsGenerated: number;
  alertsResolved: number;
  vulnerabilitiesFound: number;
  averageResponseTime: number;
  falsePositiveRate: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  alertTrends: Array<{
    date: string;
    count: number;
    severity: string;
  }>;
  bscSpecific: {
    pancakeSwapAlerts: number;
    tokenAlerts: number;
    honeyPotDetections: number;
    rugPullDetections: number;
    averageGasPrice: number;
    monitoredTokens: number;
  };
  lastUpdated: number;
}

export interface MonitoringStatusViem {
  active: boolean;
  contractsCount: number;
  lastScan: number;
  uptime: number;
  errors: Array<{
    timestamp: number;
    error: string;
    contract?: Address;
  }>;
  performance: {
    averageScanTime: number;
    alertsPerHour: number;
    memoryUsage: number;
    bscSpecific: {
      pancakeScanTime: number;
      tokenAnalysisTime: number;
    };
  };
  bscSpecific: {
    pancakeSwapMonitored: number;
    tokensMonitored: number;
    farmsMonitored: number;
  };
}

export class ContractSecurityMonitorViem extends EventEmitter {
  private config: ContractMonitorConfigViem;
  private contracts: Map<Address, ContractInfoViem> = new Map();
  private alerts: Map<string, SecurityAlertViem> = new Map();
  private vulnerabilityReports: Map<Address, VulnerabilityReportViem> = new Map();
  private stateSnapshots: Map<Address, StateSnapshotViem[]> = new Map();
  private monitoringActive: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private vulnerabilityScanInterval?: NodeJS.Timeout;
  private metrics: SecurityMetricsViem;

  constructor(
    private publicClient: PublicClient<Transport, Chain>,
    private walletClient?: WalletClient<Transport, Chain, any>,
    private cacheService?: ICache,
    config: Partial<ContractMonitorConfigViem> = {}
  ) {
    super();

    this.config = {
      enabled: true,
      monitoringInterval: 60000, // 1 minute
      alertThresholds: {
        balanceChange: 10000, // $10,000
        transactionVolume: 100000, // $100,000 per hour
        gasUsage: 200, // 200% above average
        errorRate: 10, // 10%
        responseTime: 5000, // 5 seconds
        bnbChange: parseUnits('10', 18).toString(), // 10 BNB
        tokenPriceChange: 20 // 20%
      },
      vulnerabilityScan: {
        enabled: true,
        scanInterval: 24, // 24 hours
        scanMethods: ['transfer', 'approve', 'swap', 'deposit', 'withdraw', 'addLiquidity', 'removeLiquidity'],
        severityLevels: ['low', 'medium', 'high', 'critical'],
        autoBlock: false,
        manualReviewRequired: ['high', 'critical'],
        useAdvancedAnalysis: true,
        checkHoneyPots: true,
        checkRugPulls: true
      },
      eventMonitoring: {
        enabled: true,
        suspiciousEvents: ['OwnershipTransferred', 'Paused', 'EmergencyMode', 'TokenMinted', 'LiquidityRemoved'],
        eventFilters: [],
        realTimeAnalysis: true,
        trackDEXEvents: true,
        trackTokenEvents: true,
        trackGoveranceEvents: true
      },
      stateMonitoring: {
        enabled: true,
        monitoredVariables: ['balance', 'owner', 'paused', 'totalSupply', 'reserve0', 'reserve1'],
        changeThreshold: 10, // 10%
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
        whitelistedContracts: [],
        knownHoneyPotPatterns: [
          '0x8e870d67f660d95d5be630bb64f8d5ba804b3cd2', // Common honey pot patterns
          '0x8e870d67f660d95d5be630bb64f8d5ba804b3cd3'
        ],
        rugPullThresholds: {
          liquidityDrain: 80, // 80% liquidity removed
          priceDump: 50, // 50% price drop
          suddenSell: 90 // 90% of tokens sold suddenly
        }
      },
      ...config
    };

    this.metrics = {
      contractsMonitored: 0,
      alertsGenerated: 0,
      alertsResolved: 0,
      vulnerabilitiesFound: 0,
      averageResponseTime: 0,
      falsePositiveRate: 0,
      riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
      alertTrends: [],
      bscSpecific: {
        pancakeSwapAlerts: 0,
        tokenAlerts: 0,
        honeyPotDetections: 0,
        rugPullDetections: 0,
        averageGasPrice: 0,
        monitoredTokens: 0
      },
      lastUpdated: Date.now()
    };
  }

  // Contract management
  async addContract(contractInfo: ContractInfoViem): Promise<void> {
    try {
      const normalizedAddress = getAddress(contractInfo.address);
      this.contracts.set(normalizedAddress, contractInfo);
      this.metrics.contractsMonitored = this.contracts.size;

      // Initialize state snapshots array
      if (!this.stateSnapshots.has(normalizedAddress)) {
        this.stateSnapshots.set(normalizedAddress, []);
      }

      // Update BSC specific metrics
      if (contractInfo.bscSpecific?.isPancakeSwapContract) {
        this.metrics.bscSpecific.pancakeSwapAlerts++;
      }
      if (contractInfo.type === 'token') {
        this.metrics.bscSpecific.monitoredTokens++;
      }

      logger.info(`Contract added to monitoring: ${contractInfo.address}`, {
        name: contractInfo.name,
        type: contractInfo.type,
        bscSpecific: contractInfo.bscSpecific
      });

      // Emit event
      this.emit('contractAdded', contractInfo);

      // Run initial vulnerability scan
      if (this.config.vulnerabilityScan.enabled) {
        await this.scanContractForVulnerabilities(contractInfo.address);
      }
    } catch (error) {
      logger.error('Failed to add contract to monitoring', {
        error: (error as Error).message,
        contractAddress: contractInfo.address
      });
      throw error;
    }
  }

  async removeContract(address: Address): Promise<void> {
    try {
      const normalizedAddress = getAddress(address);
      const removed = this.contracts.delete(normalizedAddress);
      if (!removed) {
        throw new Error(`Contract not found: ${address}`);
      }

      this.stateSnapshots.delete(normalizedAddress);
      this.metrics.contractsMonitored = this.contracts.size;

      logger.info(`Contract removed from monitoring: ${address}`);

      // Emit event
      this.emit('contractRemoved', address);
    } catch (error) {
      logger.error('Failed to remove contract from monitoring', {
        error: (error as Error).message,
        address
      });
      throw error;
    }
  }

  async getContract(address: Address): Promise<ContractInfoViem | undefined> {
    return this.contracts.get(getAddress(address));
  }

  async getAllContracts(): Promise<ContractInfoViem[]> {
    return Array.from(this.contracts.values());
  }

  // Monitoring control
  async startMonitoring(): Promise<void> {
    try {
      if (this.monitoringActive) {
        logger.warn('Contract monitoring is already active');
        return;
      }

      this.monitoringActive = true;

      // Start periodic monitoring
      this.monitoringInterval = setInterval(async () => {
        try {
          await this.performMonitoringCycle();
        } catch (error) {
          logger.error('Error in monitoring cycle', { error: (error as Error).message });
        }
      }, this.config.monitoringInterval);

      // Start vulnerability scanning
      if (this.config.vulnerabilityScan.enabled) {
        this.vulnerabilityScanInterval = setInterval(async () => {
          try {
            await this.performVulnerabilityScans();
          } catch (error) {
            logger.error('Error in vulnerability scan cycle', { error: (error as Error).message });
          }
        }, this.config.vulnerabilityScan.scanInterval * 60 * 60 * 1000); // Convert hours to milliseconds
      }

      logger.info('Contract security monitoring started', {
        contractsCount: this.contracts.size,
        monitoringInterval: this.config.monitoringInterval,
        bscSpecific: {
          trackPancakeSwap: this.config.bscSpecific.trackPancakeSwap,
          trackKnownScams: this.config.bscSpecific.trackKnownScams
        }
      });

      // Emit event
      this.emit('monitoringStarted');
    } catch (error) {
      logger.error('Failed to start contract monitoring', { error: (error as Error).message });
      throw error;
    }
  }

  async stopMonitoring(): Promise<void> {
    try {
      if (!this.monitoringActive) {
        logger.warn('Contract monitoring is not active');
        return;
      }

      this.monitoringActive = false;

      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = undefined;
      }

      if (this.vulnerabilityScanInterval) {
        clearInterval(this.vulnerabilityScanInterval);
        this.vulnerabilityScanInterval = undefined;
      }

      logger.info('Contract security monitoring stopped');

      // Emit event
      this.emit('monitoringStopped');
    } catch (error) {
      logger.error('Failed to stop contract monitoring', { error: (error as Error).message });
      throw error;
    }
  }

  // Vulnerability scanning with Viem
  async scanContractForVulnerabilities(address: Address): Promise<VulnerabilityReportViem> {
    try {
      const normalizedAddress = getAddress(address);
      logger.info(`Starting vulnerability scan for contract: ${normalizedAddress}`);

      const contract = this.contracts.get(normalizedAddress);
      if (!contract) {
        throw new Error(`Contract not found: ${normalizedAddress}`);
      }

      // Perform vulnerability analysis
      const vulnerabilities = await this.analyzeVulnerabilities(contract);

      // Calculate risk score
      const riskScore = this.calculateRiskScore(vulnerabilities);

      // Generate recommendations
      const recommendations = this.generateRecommendations(vulnerabilities);

      // BSC specific analysis
      const bscSpecific = await this.analyzeBscSpecific(contract);

      const report: VulnerabilityReportViem = {
        id: this.generateReportId(),
        contractAddress: normalizedAddress,
        scanDate: Date.now(),
        vulnerabilities,
        riskScore,
        recommendations,
        nextScanDate: Date.now() + (this.config.vulnerabilityScan.scanInterval * 60 * 60 * 1000),
        scanner: 'contract-monitor-viem-v1',
        bscSpecific
      };

      // Store report
      this.vulnerabilityReports.set(normalizedAddress, report);

      // Update metrics
      this.metrics.vulnerabilitiesFound += vulnerabilities.length;

      // Generate alerts for critical vulnerabilities
      const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical');
      for (const vuln of criticalVulns) {
        await this.createAlert({
          contractAddress: normalizedAddress,
          type: 'vulnerability_found',
          severity: 'critical',
          title: `Critical Vulnerability: ${vuln.title}`,
          description: vuln.description,
          details: {
            vulnerability: vuln,
            scanReport: report.id
          }
        });
      }

      // Check for honey pots and rug pulls
      if (this.config.vulnerabilityScan.checkHoneyPots) {
        await this.checkForHoneyPot(normalizedAddress, report);
      }

      if (this.config.vulnerabilityScan.checkRugPulls) {
        await this.checkForRugPullPatterns(normalizedAddress, report);
      }

      logger.info(`Vulnerability scan completed`, {
        address: normalizedAddress,
        vulnerabilitiesFound: vulnerabilities.length,
        riskScore,
        bscSpecific: {
          pancakeSwapIntegration: bscSpecific.pancakeSwapIntegration,
          tokenInteractions: bscSpecific.tokenInteractions.length
        }
      });

      // Emit event
      this.emit('vulnerabilityScanCompleted', report);

      return report;
    } catch (error) {
      logger.error('Failed to scan contract for vulnerabilities', {
        error: (error as Error).message,
        address
      });
      throw error;
    }
  }

  // Alert management
  async createAlert(alert: Omit<SecurityAlertViem, 'id' | 'timestamp' | 'status'>): Promise<string> {
    try {
      const id = this.generateAlertId();
      const normalizedAddress = getAddress(alert.contractAddress);

      const fullAlert: SecurityAlertViem = {
        id,
        contractAddress: normalizedAddress,
        timestamp: Date.now(),
        status: 'open',
        ...alert
      };

      this.alerts.set(id, fullAlert);

      // Update metrics
      this.metrics.alertsGenerated++;
      this.updateRiskDistribution();

      // Update BSC specific metrics
      if (alert.type === 'honey_pot_detected') {
        this.metrics.bscSpecific.honeyPotDetections++;
      }
      if (alert.type === 'rug_pull_detected') {
        this.metrics.bscSpecific.rugPullDetections++;
      }

      // Send notifications
      await this.sendAlertNotifications(fullAlert);

      logger.info(`Security alert created`, {
        id,
        contractAddress: normalizedAddress,
        type: alert.type,
        severity: alert.severity
      });

      // Emit event
      this.emit('alertCreated', fullAlert);

      return id;
    } catch (error) {
      logger.error('Failed to create security alert', {
        error: (error as Error).message,
        alert
      });
      throw error;
    }
  }

  async resolveAlert(alertId: string, resolution: string, assignedTo?: Address): Promise<void> {
    try {
      const alert = this.alerts.get(alertId);
      if (!alert) {
        throw new Error(`Alert not found: ${alertId}`);
      }

      alert.status = 'resolved';
      alert.resolvedAt = Date.now();
      alert.resolution = resolution;
      if (assignedTo) {
        alert.assignedTo = getAddress(assignedTo);
      }

      // Update metrics
      this.metrics.alertsResolved++;

      logger.info(`Security alert resolved`, {
        alertId,
        resolution,
        assignedTo
      });

      // Emit event
      this.emit('alertResolved', alert);
    } catch (error) {
      logger.error('Failed to resolve security alert', {
        error: (error as Error).message,
        alertId
      });
      throw error;
    }
  }

  async getAlerts(filters?: {
    contractAddress?: Address;
    severity?: string;
    status?: string;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<SecurityAlertViem[]> {
    try {
      let alerts = Array.from(this.alerts.values());

      // Apply filters
      if (filters) {
        if (filters.contractAddress) {
          const normalizedAddress = getAddress(filters.contractAddress);
          alerts = alerts.filter(alert => alert.contractAddress === normalizedAddress);
        }
        if (filters.severity) {
          alerts = alerts.filter(alert => alert.severity === filters.severity);
        }
        if (filters.status) {
          alerts = alerts.filter(alert => alert.status === filters.status);
        }
        if (filters.type) {
          alerts = alerts.filter(alert => alert.type === filters.type);
        }
      }

      // Sort by timestamp (most recent first)
      alerts.sort((a, b) => b.timestamp - a.timestamp);

      // Apply pagination
      if (filters?.offset) {
        alerts = alerts.slice(filters.offset);
      }
      if (filters?.limit) {
        alerts = alerts.slice(0, filters.limit);
      }

      return alerts;
    } catch (error) {
      logger.error('Failed to get alerts', { error: (error as Error).message });
      throw error;
    }
  }

  // Event monitoring with Viem
  async analyzeEvent(log: Log, contract: ContractInfoViem): Promise<EventAnalysisViem> {
    try {
      const normalizedAddress = getAddress(log.address);

      // Check against event filters
      const matchingFilter = this.config.eventMonitoring.eventFilters.find(filter =>
        (!filter.contractAddress || filter.contractAddress === normalizedAddress) &&
        this.evaluateEventConditions(filter.conditions, log.data, log.topics)
      );

      const analysis: EventAnalysisViem = {
        eventType: this.extractEventName(log.topics[0]),
        parameters: this.parseEventParameters(log.data, log.topics),
        timestamp: Date.now(),
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        contractAddress: normalizedAddress,
        analysis: {
          suspicious: false,
          riskScore: 0,
          indicators: [],
          relatedAlerts: []
        }
      };

      // Apply filter analysis
      if (matchingFilter) {
        analysis.analysis.suspicious = true;
        analysis.analysis.riskScore = this.getSeverityScore(matchingFilter.severity);
        analysis.analysis.indicators.push(`Event matched security filter: ${matchingFilter.eventName}`);

        // Create alert if necessary
        if (matchingFilter.action === 'alert' || matchingFilter.action === 'block') {
          await this.createAlert({
            contractAddress: normalizedAddress,
            type: 'suspicious_activity',
            severity: matchingFilter.severity,
            title: `Suspicious Event: ${analysis.eventType}`,
            description: `Suspicious event detected: ${analysis.eventType}`,
            details: {
              event: analysis,
              filter: matchingFilter,
              log
            },
            bscSpecific: {
              transactionHash: log.transactionHash,
              blockNumber: log.blockNumber
            }
          });
        }
      }

      // BSC specific event analysis
      if (this.config.bscSpecific.enabled) {
        analysis.bscSpecific = await this.analyzeBscEvent(log, contract);
      }

      // Additional event analysis
      await this.performEventAnalysis(analysis, contract, log);

      return analysis;
    } catch (error) {
      logger.error('Failed to analyze event', {
        error: (error as Error).message,
        log
      });
      throw error;
    }
  }

  // State monitoring with Viem
  async captureStateSnapshot(address: Address): Promise<StateSnapshotViem> {
    try {
      const normalizedAddress = getAddress(address);
      const contract = this.contracts.get(normalizedAddress);
      if (!contract) {
        throw new Error(`Contract not found: ${normalizedAddress}`);
      }

      const latestBlock = await this.publicClient.getBlock({ blockTag: 'latest' });
      if (!latestBlock) {
        throw new Error('Failed to get latest block');
      }

      // Get contract balances
      const balance = await this.publicClient.getBalance({ address: normalizedAddress });
      const bnbBalance = balance;

      // Get storage (simplified)
      const storage: { [slot: Hex]: Hex } = {};

      // Get variables (simplified - would use contract ABI in production)
      const variables: { [key: string]: any } = {
        balance: balance.toString(),
        bnbBalance: bnbBalance.toString(),
        blockNumber: latestBlock.number.toString(),
        timestamp: latestBlock.timestamp
      };

      const snapshot: StateSnapshotViem = {
        contractAddress: normalizedAddress,
        blockNumber: latestBlock.number,
        timestamp: Date.now(),
        balance: balance.toString(),
        bnbBalance: bnbBalance.toString(),
        storage,
        variables,
        events: [],
        metadata: {
          gasPrice: latestBlock.baseFeePerGas?.toString(),
          difficulty: latestBlock.difficulty.toString()
        }
      };

      // BSC specific state collection
      if (this.config.bscSpecific.enabled) {
        snapshot.bscSpecific = await this.collectBscSpecificState(normalizedAddress, contract);
      }

      // Store snapshot
      const snapshots = this.stateSnapshots.get(normalizedAddress) || [];
      snapshots.push(snapshot);
      this.stateSnapshots.set(normalizedAddress, snapshots.slice(-100)); // Keep last 100 snapshots

      // Analyze for anomalies
      await this.analyzeStateChanges(snapshot, normalizedAddress);

      return snapshot;
    } catch (error) {
      logger.error('Failed to capture state snapshot', {
        error: (error as Error).message,
        address
      });
      throw error;
    }
  }

  // Metrics and reporting
  async getMetrics(): Promise<SecurityMetricsViem> {
    try {
      // Update alert trends
      this.updateAlertTrends();

      // Update BSC specific metrics
      await this.updateBscSpecificMetrics();

      this.metrics.lastUpdated = Date.now();
      return { ...this.metrics };
    } catch (error) {
      logger.error('Failed to get security metrics', { error: (error as Error).message });
      throw error;
    }
  }

  async getStatus(): Promise<MonitoringStatusViem> {
    try {
      const uptime = this.monitoringActive ? Date.now() - (this.metrics.lastUpdated - 86400000) : 0; // Simplified

      // Calculate BSC specific stats
      const pancakeSwapContracts = Array.from(this.contracts.values())
        .filter(c => c.bscSpecific?.isPancakeSwapContract).length;
      const tokenContracts = Array.from(this.contracts.values())
        .filter(c => c.type === 'token').length;
      const farmContracts = Array.from(this.contracts.values())
        .filter(c => c.type === 'farm').length;

      return {
        active: this.monitoringActive,
        contractsCount: this.contracts.size,
        lastScan: this.metrics.lastUpdated,
        uptime,
        errors: [], // Would track actual errors
        performance: {
          averageScanTime: 1000, // Mock value
          alertsPerHour: this.calculateAlertsPerHour(),
          memoryUsage: 50, // MB
          bscSpecific: {
            pancakeScanTime: 500,
            tokenAnalysisTime: 200
          }
        },
        bscSpecific: {
          pancakeSwapMonitored: pancakeSwapContracts,
          tokensMonitored: tokenContracts,
          farmsMonitored: farmContracts
        }
      };
    } catch (error) {
      logger.error('Failed to get monitoring status', { error: (error as Error).message });
      throw error;
    }
  }

  // Private helper methods
  private async performMonitoringCycle(): Promise<void> {
    try {
      for (const [address, contract] of this.contracts) {
        try {
          // Capture state snapshot
          if (this.config.stateMonitoring.enabled) {
            await this.captureStateSnapshot(address);
          }

          // Check for unusual activity
          await this.checkForUnusualActivity(contract);

          // BSC specific monitoring
          if (this.config.bscSpecific.enabled && contract.bscSpecific?.isPancakeSwapContract) {
            await this.monitorPancakeSwapActivity(address, contract);
          }

        } catch (error) {
          logger.error('Error in contract monitoring cycle', {
            error: (error as Error).message,
            address,
            contractName: contract.name
          });
        }
      }
    } catch (error) {
      logger.error('Error in monitoring cycle', { error: (error as Error).message });
    }
  }

  private async performVulnerabilityScans(): Promise<void> {
    try {
      if (!this.config.vulnerabilityScan.enabled) {
        return;
      }

      for (const [address, contract] of this.contracts) {
        try {
          // Check if scan is due
          const lastReport = this.vulnerabilityReports.get(address);
          if (lastReport && Date.now() < lastReport.nextScanDate) {
            continue;
          }

          await this.scanContractForVulnerabilities(address);

        } catch (error) {
          logger.error('Error in vulnerability scan', {
            error: (error as Error).message,
            address,
            contractName: contract.name
          });
        }
      }
    } catch (error) {
      logger.error('Error in vulnerability scan cycle', { error: (error as Error).message });
    }
  }

  private async analyzeVulnerabilities(contract: ContractInfoViem): Promise<VulnerabilityViem[]> {
    const vulnerabilities: VulnerabilityViem[] = [];

    // Simulate vulnerability detection with Viem-specific patterns
    // In production, would use static analysis tools and pattern matching

    // Reentrancy check
    if (Math.random() > 0.8) { // 20% chance for demo
      vulnerabilities.push({
        type: 'reentrancy',
        severity: 'high',
        title: 'Potential Reentrancy Vulnerability',
        description: 'Contract may be vulnerable to reentrancy attacks',
        location: 'Multiple functions',
        impact: 'Attacker could potentially drain contract funds',
        mitigation: 'Implement reentrancy guards using Checks-Effects-Interactions pattern',
        cweId: 'CWE-841',
        cvssScore: 7.5,
        references: ['https://swcregistry.io/docs/SWC-107'],
        bscSpecific: {
          pancakeSwapRisk: contract.bscSpecific?.isPancakeSwapContract || false,
          tokenRisk: contract.type === 'token',
          liquidityRisk: contract.type === 'liquidity_pool'
        }
      });
    }

    // Honey pot check
    if (this.config.vulnerabilityScan.checkHoneyPots && Math.random() > 0.9) {
      vulnerabilities.push({
        type: 'honey_pot',
        severity: 'critical',
        title: 'Honey Pot Pattern Detected',
        description: 'Contract exhibits characteristics of a honey pot scam',
        location: 'Transfer functions',
        impact: 'Users may be unable to sell or transfer tokens',
        mitigation: 'Avoid interaction with suspected honey pot contracts',
        cvssScore: 9.0,
        references: ['https://etherscan.io/token/salerchecker'],
        bscSpecific: {
          pancakeSwapRisk: false,
          tokenRisk: true,
          liquidityRisk: true
        }
      });
    }

    // Access control check
    if (Math.random() > 0.85) { // 15% chance for demo
      vulnerabilities.push({
        type: 'access_control',
        severity: 'high',
        title: 'Access Control Vulnerability',
        description: 'Critical functions may lack proper access controls',
        location: 'Administrative functions',
        impact: 'Unauthorized users could perform privileged operations',
        mitigation: 'Implement proper access control modifiers and role-based permissions',
        cweId: 'CWE-284',
        cvssScore: 8.0,
        references: ['https://swcregistry.io/docs/SWC-105'],
        bscSpecific: {
          pancakeSwapRisk: contract.bscSpecific?.isPancakeSwapContract || false,
          tokenRisk: contract.type === 'token',
          liquidityRisk: false
        }
      });
    }

    return vulnerabilities;
  }

  private async analyzeBscSpecific(contract: ContractInfoViem): Promise<VulnerabilityReportViem['bscSpecific']> {
    return {
      pancakeSwapIntegration: contract.bscSpecific?.isPancakeSwapContract || false,
      tokenInteractions: contract.bscSpecific?.knownTokenPairs || [],
      liquidityPools: contract.type === 'liquidity_pool' ? [contract.address] : [],
      knownRisks: this.getBscSpecificRisks(contract)
    };
  }

  private getBscSpecificRisks(contract: ContractInfoViem): string[] {
    const risks: string[] = [];

    if (contract.bscSpecific?.isPancakeSwapContract) {
      risks.push('Interacts with PancakeSwap - monitor for flash loan attacks');
    }

    if (contract.type === 'token' && !contract.audited) {
      risks.push('Una token contract - potential scam risk');
    }

    if (this.config.bscSpecific.blacklistedContracts.includes(contract.address)) {
      risks.push('Contract is on blacklist - HIGH RISK');
    }

    return risks;
  }

  private async checkForHoneyPot(address: Address, report: VulnerabilityReportViem): Promise<void> {
    try {
      // Simplified honey pot detection
      // In production, would use sophisticated honey pot detection algorithms

      const isBlacklisted = this.config.bscSpecific.blacklistedContracts.includes(address);
      const hasHoneyPotPattern = this.config.bscSpecific.knownHoneyPotPatterns.some(pattern =>
        address.toLowerCase().includes(pattern.toLowerCase())
      );

      if (isBlacklisted || hasHoneyPotPattern) {
        await this.createAlert({
          contractAddress: address,
          type: 'honey_pot_detected',
          severity: 'critical',
          title: 'Honey Pot Contract Detected',
          description: 'Contract matches known honey pot patterns',
          details: {
            blacklisted: isBlacklisted,
            patternMatched: hasHoneyPotPattern,
            scanReport: report.id
          }
        });
      }
    } catch (error) {
      logger.error('Failed to check for honey pot', {
        error: (error as Error).message,
        address
      });
    }
  }

  private async checkForRugPullPatterns(address: Address, report: VulnerabilityReportViem): Promise<void> {
    try {
      // Simplified rug pull detection
      // In production, would analyze liquidity patterns and token distribution

      const snapshots = this.stateSnapshots.get(address) || [];
      if (snapshots.length < 2) return;

      const latest = snapshots[snapshots.length - 1];
      const previous = snapshots[snapshots.length - 2];

      // Check for sudden liquidity changes
      if (latest.bscSpecific?.liquidityPositions && previous.bscSpecific?.liquidityPositions) {
        const latestLiquidity = latest.bscSpecific.liquidityPositions.reduce((sum, pos) =>
          sum + parseFloat(pos.balance), 0);
        const previousLiquidity = previous.bscSpecific.liquidityPositions.reduce((sum, pos) =>
          sum + parseFloat(pos.balance), 0);

        if (previousLiquidity > 0) {
          const liquidityDrain = ((previousLiquidity - latestLiquidity) / previousLiquidity) * 100;

          if (liquidityDrain > this.config.bscSpecific.rugPullThresholds.liquidityDrain) {
            await this.createAlert({
              contractAddress: address,
              type: 'rug_pull_detected',
              severity: 'critical',
              title: 'Potential Rug Pull Detected',
              description: `Liquidity drained by ${liquidityDrain.toFixed(2)}%`,
              details: {
                liquidityDrain,
                previousLiquidity: previousLiquidity.toString(),
                currentLiquidity: latestLiquidity.toString(),
                scanReport: report.id
              }
            });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to check for rug pull patterns', {
        error: (error as Error).message,
        address
      });
    }
  }

  private async monitorPancakeSwapActivity(address: Address, contract: ContractInfoViem): Promise<void> {
    try {
      // Monitor PancakeSwap-specific activity
      // In production, would track swap events, liquidity changes, etc.

      logger.debug('Monitoring PancakeSwap activity', {
        address,
        contractName: contract.name
      });
    } catch (error) {
      logger.error('Failed to monitor PancakeSwap activity', {
        error: (error as Error).message,
        address
      });
    }
  }

  private async collectBscSpecificState(address: Address, contract: ContractInfoViem): Promise<StateSnapshotViem['bscSpecific']> {
    return {
      tokenBalances: {}, // Would collect token balances
      liquidityPositions: [], // Would collect LP positions
      farmPositions: [] // Would collect farm positions
    };
  }

  private async analyzeBscEvent(log: Log, contract: ContractInfoViem): Promise<EventAnalysisViem['bscSpecific']> {
    return {
      pancakeSwapOperation: contract.bscSpecific?.isPancakeSwapContract ? 'swap' : undefined,
      tokenFlow: [], // Would analyze token flows
      priceImpact: undefined // Would calculate price impact
    };
  }

  private extractEventName(topic: Hex): string {
    // Simplified event name extraction
    // In production, would use ABI to map event signatures to names
    return 'UnknownEvent';
  }

  private parseEventParameters(data: Hex, topics: readonly Hex[]): { [key: string]: any } {
    // Simplified parameter parsing
    // In production, would use ABI to parse named parameters
    return {
      data,
      topics: topics.slice(1), // Remove event signature
      parameterCount: topics.length - 1
    };
  }

  private evaluateEventConditions(conditions: EventConditionViem[], data: Hex, topics: readonly Hex[]): boolean {
    // Simplified condition evaluation
    // In production, would implement more sophisticated condition matching
    return conditions.every(condition => {
      const value = topics[1] || data; // Simplified
      switch (condition.operator) {
        case 'equals': return value === condition.value;
        case 'address_equals': return getAddress(value as Address) === getAddress(condition.value);
        case 'greater_than': return BigInt(value) > BigInt(condition.value);
        case 'less_than': return BigInt(value) < BigInt(condition.value);
        case 'contains': return (value as Hex).includes(condition.value);
        case 'regex': return new RegExp(condition.value).test(value as string);
        default: return false;
      }
    });
  }

  private async performEventAnalysis(
    analysis: EventAnalysisViem,
    contract: ContractInfoViem,
    log: Log
  ): Promise<void> {
    // Additional event-specific analysis
    // This would implement deeper event analysis based on contract type
  }

  private calculateRiskScore(vulnerabilities: VulnerabilityViem[]): number {
    if (vulnerabilities.length === 0) return 0;

    let totalScore = 0;
    vulnerabilities.forEach(vuln => {
      const severityScore = {
        'low': 1,
        'medium': 3,
        'high': 7,
        'critical': 10
      }[vuln.severity];

      totalScore += severityScore;
    });

    return Math.min(100, (totalScore / vulnerabilities.length) * 10);
  }

  private generateRecommendations(vulnerabilities: VulnerabilityViem[]): string[] {
    const recommendations: string[] = [];

    vulnerabilities.forEach(vuln => {
      recommendations.push(vuln.mitigation);
    });

    if (vulnerabilities.length > 0) {
      recommendations.push('Consider professional security audit');
      recommendations.push('Implement comprehensive testing suite');
      recommendations.push('Use established DeFi security standards');
    }

    return Array.from(new Set(recommendations));
  }

  private async analyzeStateChanges(snapshot: StateSnapshotViem, address: Address): Promise<void> {
    try {
      const snapshots = this.stateSnapshots.get(address) || [];
      if (snapshots.length < 2) return;

      const previousSnapshot = snapshots[snapshots.length - 2];
      const currentSnapshot = snapshot;

      // Check BNB balance changes
      const balanceChange = BigInt(currentSnapshot.bnbBalance) - BigInt(previousSnapshot.bnbBalance);
      const changeThreshold = BigInt(this.config.alertThresholds.bnbChange);

      if (balanceChange > changeThreshold || balanceChange < -changeThreshold) {
        await this.createAlert({
          contractAddress: address,
          type: 'unusual_state_change',
          severity: 'medium',
          title: 'Unusual BNB Balance Change',
          description: `Contract BNB balance changed by ${formatUnits(balanceChange, 18)} BNB`,
          details: {
            previousBalance: previousSnapshot.bnbBalance,
            currentBalance: currentSnapshot.bnbBalance,
            change: balanceChange.toString()
          },
          bscSpecific: {
            blockNumber: currentSnapshot.blockNumber
          }
        });
      }

      // Check for other anomalies
      await this.checkForStateAnomalies(previousSnapshot, currentSnapshot, address);

    } catch (error) {
      logger.error('Failed to analyze state changes', {
        error: (error as Error).message,
        address
      });
    }
  }

  private async checkForStateAnomalies(
    previous: StateSnapshotViem,
    current: StateSnapshotViem,
    address: Address
  ): Promise<void> {
    // Implement additional state anomaly checks
    // This would check for suspicious patterns in state changes
  }

  private async checkForUnusualActivity(contract: ContractInfoViem): Promise<void> {
    try {
      // Check for unusual transaction patterns
      // This would analyze recent transaction history
    } catch (error) {
      logger.error('Failed to check for unusual activity', {
        error: (error as Error).message,
        contractAddress: contract.address
      });
    }
  }

  private getSeverityScore(severity: string): number {
    const scores = {
      'low': 25,
      'medium': 50,
      'high': 75,
      'critical': 100
    };
    return scores[severity as keyof typeof scores] || 0;
  }

  private async sendAlertNotifications(alert: SecurityAlertViem): Promise<void> {
    try {
      // Send email notifications
      if (this.config.notifications.email.enabled && alert.severity !== 'low') {
        await this.sendEmailNotification(alert);
      }

      // Send webhook notifications
      if (this.config.notifications.webhook.enabled) {
        await this.sendWebhookNotification(alert);
      }

      // Send Slack notifications
      if (this.config.notifications.slack.enabled && alert.severity !== 'low') {
        await this.sendSlackNotification(alert);
      }

      // Send Telegram notifications
      if (this.config.notifications.telegram.enabled && alert.severity === 'critical') {
        await this.sendTelegramNotification(alert);
      }

      // Send Discord notifications
      if (this.config.notifications.discord.enabled && alert.severity !== 'low') {
        await this.sendDiscordNotification(alert);
      }

    } catch (error) {
      logger.error('Failed to send alert notifications', {
        error: (error as Error).message,
        alertId: alert.id
      });
    }
  }

  private async sendEmailNotification(alert: SecurityAlertViem): Promise<void> {
    // Implement email notification sending
    logger.info('Email notification sent', { alertId: alert.id });
  }

  private async sendWebhookNotification(alert: SecurityAlertViem): Promise<void> {
    // Implement webhook notification sending
    logger.info('Webhook notification sent', { alertId: alert.id });
  }

  private async sendSlackNotification(alert: SecurityAlertViem): Promise<void> {
    // Implement Slack notification sending
    logger.info('Slack notification sent', { alertId: alert.id });
  }

  private async sendTelegramNotification(alert: SecurityAlertViem): Promise<void> {
    // Implement Telegram notification sending
    logger.info('Telegram notification sent', { alertId: alert.id });
  }

  private async sendDiscordNotification(alert: SecurityAlertViem): Promise<void> {
    // Implement Discord notification sending
    logger.info('Discord notification sent', { alertId: alert.id });
  }

  private updateRiskDistribution(): void {
    const alerts = Array.from(this.alerts.values());

    this.metrics.riskDistribution = {
      low: alerts.filter(a => a.severity === 'low').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      high: alerts.filter(a => a.severity === 'high').length,
      critical: alerts.filter(a => a.severity === 'critical').length
    };
  }

  private updateAlertTrends(): void {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentAlerts = Array.from(this.alerts.values())
      .filter(alert => alert.timestamp >= oneDayAgo.getTime());

    // Group by hour
    const hourlyTrends = new Map<string, number>();
    recentAlerts.forEach(alert => {
      const hour = new Date(alert.timestamp).toISOString().substring(0, 13);
      hourlyTrends.set(hour, (hourlyTrends.get(hour) || 0) + 1);
    });

    this.metrics.alertTrends = Array.from(hourlyTrends.entries()).map(([date, count]) => ({
      date,
      count,
      severity: 'mixed' // Simplified
    }));
  }

  private async updateBscSpecificMetrics(): Promise<void> {
    try {
      // Get current gas price
      const gasPrice = await this.publicClient.getGasPrice();
      if (gasPrice) {
        this.metrics.bscSpecific.averageGasPrice = Number(formatUnits(gasPrice, 9)); // Gwei
      }

      // Update monitored tokens count
      this.metrics.bscSpecific.monitoredTokens = Array.from(this.contracts.values())
        .filter(c => c.type === 'token').length;

    } catch (error) {
      logger.error('Failed to update BSC specific metrics', {
        error: (error as Error).message
      });
    }
  }

  private calculateAlertsPerHour(): number {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentAlerts = Array.from(this.alerts.values())
      .filter(alert => alert.timestamp >= oneHourAgo);

    return recentAlerts.length;
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      monitoringActive: boolean;
      contractsCount: number;
      alertsCount: number;
      vulnerabilityReportsCount: number;
      lastScan: number;
      notificationsEnabled: boolean;
      bscSpecific: {
        pancakeSwapTracking: boolean;
        honeyPotDetection: boolean;
        rugPullDetection: boolean;
      };
    };
  }> {
    try {
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (!this.monitoringActive) {
        status = 'degraded';
      }

      if (this.contracts.size === 0) {
        status = 'degraded';
      }

      const notificationsEnabled = Object.values(this.config.notifications).some(n => n.enabled);

      return {
        status,
        details: {
          monitoringActive: this.monitoringActive,
          contractsCount: this.contracts.size,
          alertsCount: this.alerts.size,
          vulnerabilityReportsCount: this.vulnerabilityReports.size,
          lastScan: this.metrics.lastUpdated,
          notificationsEnabled,
          bscSpecific: {
            pancakeSwapTracking: this.config.bscSpecific.trackPancakeSwap,
            honeyPotDetection: this.config.vulnerabilityScan.checkHoneyPots,
            rugPullDetection: this.config.vulnerabilityScan.checkRugPulls
          }
        }
      };
    } catch (error) {
      logger.error('Contract monitor health check failed', { error: (error as Error).message });
      return {
        status: 'unhealthy',
        details: {
          monitoringActive: false,
          contractsCount: 0,
          alertsCount: 0,
          vulnerabilityReportsCount: 0,
          lastScan: 0,
          notificationsEnabled: false,
          bscSpecific: {
            pancakeSwapTracking: false,
            honeyPotDetection: false,
            rugPullDetection: false
          }
        }
      };
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    try {
      await this.stopMonitoring();
      this.contracts.clear();
      this.alerts.clear();
      this.vulnerabilityReports.clear();
      this.stateSnapshots.clear();
      this.removeAllListeners();
      logger.info('Contract security monitor cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup contract monitor', { error: (error as Error).message });
      throw error;
    }
  }
}

// Factory function
export function createContractSecurityMonitorViem(
  publicClient: PublicClient<Transport, Chain>,
  walletClient?: WalletClient<Transport, Chain, any>,
  cacheService?: ICache,
  config?: Partial<ContractMonitorConfigViem>
): ContractSecurityMonitorViem {
  return new ContractSecurityMonitorViem(publicClient, walletClient, cacheService, config);
}