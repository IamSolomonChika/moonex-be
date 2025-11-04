import { Logger } from '../../../utils/logger.js';
import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import { ICache } from '../../../services/cache.service.js';

const logger = new Logger('ContractMonitor');

// Contract monitoring types and interfaces
export interface ContractMonitorConfig {
  enabled: boolean;
  monitoringInterval: number; // milliseconds
  alertThresholds: AlertThresholds;
  vulnerabilityScan: VulnerabilityScanConfig;
  eventMonitoring: EventMonitoringConfig;
  stateMonitoring: StateMonitoringConfig;
  notifications: NotificationConfig;
}

export interface AlertThresholds {
  balanceChange: number; // USD
  transactionVolume: number; // USD per hour
  gasUsage: number; // percentage above average
  errorRate: number; // percentage
  responseTime: number; // milliseconds
}

export interface VulnerabilityScanConfig {
  enabled: boolean;
  scanInterval: number; // hours
  scanMethods: string[];
  severityLevels: ('low' | 'medium' | 'high' | 'critical')[];
  autoBlock: boolean;
  manualReviewRequired: ('high' | 'critical')[];
}

export interface EventMonitoringConfig {
  enabled: boolean;
  suspiciousEvents: string[];
  eventFilters: EventFilter[];
  realTimeAnalysis: boolean;
}

export interface EventFilter {
  eventName: string;
  conditions: EventCondition[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'alert' | 'block' | 'investigate';
}

export interface EventCondition {
  parameter: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
}

export interface StateMonitoringConfig {
  enabled: boolean;
  monitoredVariables: string[];
  changeThreshold: number; // percentage
  storageSlots: string[];
  balanceTracking: boolean;
  ownerTracking: boolean;
}

export interface NotificationConfig {
  email: EmailNotificationConfig;
  webhook: WebhookNotificationConfig;
  slack: SlackNotificationConfig;
  telegram: TelegramNotificationConfig;
}

export interface EmailNotificationConfig {
  enabled: boolean;
  recipients: string[];
  template: string;
}

export interface WebhookNotificationConfig {
  enabled: boolean;
  endpoints: string[];
  headers: { [key: string]: string };
}

export interface SlackNotificationConfig {
  enabled: boolean;
  webhook: string;
  channel: string;
}

export interface TelegramNotificationConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
}

export interface ContractInfo {
  address: string;
  name: string;
  type: 'token' | 'dex' | 'lending' | 'governance' | 'other';
  version: string;
  verified: boolean;
  audited: boolean;
  owner: string;
  createdAt: number;
  lastActivity: number;
  metadata: { [key: string]: any };
}

export interface SecurityAlert {
  id: string;
  contractAddress: string;
  type: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  details: { [key: string]: any };
  timestamp: number;
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  assignedTo?: string;
  resolvedAt?: number;
  resolution?: string;
}

export type AlertType =
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
  | 'price_manipulation';

export interface VulnerabilityReport {
  id: string;
  contractAddress: string;
  scanDate: number;
  vulnerabilities: Vulnerability[];
  riskScore: number;
  recommendations: string[];
  nextScanDate: number;
  scanner: string;
}

export interface Vulnerability {
  type: VulnerabilityType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  location: string;
  impact: string;
  mitigation: string;
  cweId?: string;
  cvssScore?: number;
  references: string[];
}

export type VulnerabilityType =
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
  | 'provenance_validation';

export interface EventAnalysis {
  eventType: string;
  parameters: { [key: string]: any };
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
  analysis: {
    suspicious: boolean;
    riskScore: number;
    indicators: string[];
    relatedAlerts: string[];
  };
}

export interface StateSnapshot {
  contractAddress: string;
  blockNumber: number;
  timestamp: number;
  balance: string;
  storage: { [slot: string]: string };
  variables: { [key: string]: any };
  events: EventAnalysis[];
  metadata: { [key: string]: any };
}

export interface SecurityMetrics {
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
  lastUpdated: number;
}

export interface MonitoringStatus {
  active: boolean;
  contractsCount: number;
  lastScan: number;
  uptime: number;
  errors: Array<{
    timestamp: number;
    error: string;
    contract?: string;
  }>;
  performance: {
    averageScanTime: number;
    alertsPerHour: number;
    memoryUsage: number;
  };
}

export class ContractSecurityMonitor extends EventEmitter {
  private config: ContractMonitorConfig;
  private contracts: Map<string, ContractInfo> = new Map();
  private alerts: Map<string, SecurityAlert> = new Map();
  private vulnerabilityReports: Map<string, VulnerabilityReport> = new Map();
  private stateSnapshots: Map<string, StateSnapshot[]> = new Map();
  private monitoringActive: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private vulnerabilityScanInterval?: NodeJS.Timeout;
  private metrics: SecurityMetrics;

  constructor(
    private provider: ethers.providers.JsonRpcProvider,
    private cacheService: ICache,
    config: Partial<ContractMonitorConfig> = {}
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
        responseTime: 5000 // 5 seconds
      },
      vulnerabilityScan: {
        enabled: true,
        scanInterval: 24, // 24 hours
        scanMethods: ['transfer', 'approve', 'swap', 'deposit', 'withdraw'],
        severityLevels: ['low', 'medium', 'high', 'critical'],
        autoBlock: false,
        manualReviewRequired: ['high', 'critical']
      },
      eventMonitoring: {
        enabled: true,
        suspiciousEvents: ['OwnershipTransferred', 'Paused', 'EmergencyMode'],
        eventFilters: [],
        realTimeAnalysis: true
      },
      stateMonitoring: {
        enabled: true,
        monitoredVariables: ['balance', 'owner', 'paused', 'totalSupply'],
        changeThreshold: 10, // 10%
        storageSlots: [],
        balanceTracking: true,
        ownerTracking: true
      },
      notifications: {
        email: { enabled: false, recipients: [], template: 'default' },
        webhook: { enabled: false, endpoints: [], headers: {} },
        slack: { enabled: false, webhook: '', channel: '#security' },
        telegram: { enabled: false, botToken: '', chatId: '' }
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
      lastUpdated: Date.now()
    };
  }

  // Contract management
  async addContract(contractInfo: ContractInfo): Promise<void> {
    try {
      this.contracts.set(contractInfo.address.toLowerCase(), contractInfo);
      this.metrics.contractsMonitored = this.contracts.size;

      // Initialize state snapshots array
      if (!this.stateSnapshots.has(contractInfo.address.toLowerCase())) {
        this.stateSnapshots.set(contractInfo.address.toLowerCase(), []);
      }

      logger.info(`Contract added to monitoring: ${contractInfo.address}`, {
        name: contractInfo.name,
        type: contractInfo.type
      });

      // Emit event
      this.emit('contractAdded', contractInfo);

      // Run initial vulnerability scan
      if (this.config.vulnerabilityScan.enabled) {
        await this.scanContractForVulnerabilities(contractInfo.address);
      }
    } catch (error) {
      logger.error('Failed to add contract to monitoring', {
        error: error.message,
        contractAddress: contractInfo.address
      });
      throw error;
    }
  }

  async removeContract(address: string): Promise<void> {
    try {
      const normalizedAddress = address.toLowerCase();
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
        error: error.message,
        address
      });
      throw error;
    }
  }

  async getContract(address: string): Promise<ContractInfo | undefined> {
    return this.contracts.get(address.toLowerCase());
  }

  async getAllContracts(): Promise<ContractInfo[]> {
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
          logger.error('Error in monitoring cycle', { error: error.message });
        }
      }, this.config.monitoringInterval);

      // Start vulnerability scanning
      if (this.config.vulnerabilityScan.enabled) {
        this.vulnerabilityScanInterval = setInterval(async () => {
          try {
            await this.performVulnerabilityScans();
          } catch (error) {
            logger.error('Error in vulnerability scan cycle', { error: error.message });
          }
        }, this.config.vulnerabilityScan.scanInterval * 60 * 60 * 1000); // Convert hours to milliseconds
      }

      logger.info('Contract security monitoring started', {
        contractsCount: this.contracts.size,
        monitoringInterval: this.config.monitoringInterval
      });

      // Emit event
      this.emit('monitoringStarted');
    } catch (error) {
      logger.error('Failed to start contract monitoring', { error: error.message });
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
      logger.error('Failed to stop contract monitoring', { error: error.message });
      throw error;
    }
  }

  // Vulnerability scanning
  async scanContractForVulnerabilities(address: string): Promise<VulnerabilityReport> {
    try {
      logger.info(`Starting vulnerability scan for contract: ${address}`);

      const contract = this.contracts.get(address.toLowerCase());
      if (!contract) {
        throw new Error(`Contract not found: ${address}`);
      }

      // Perform vulnerability analysis
      const vulnerabilities = await this.analyzeVulnerabilities(contract);

      // Calculate risk score
      const riskScore = this.calculateRiskScore(vulnerabilities);

      // Generate recommendations
      const recommendations = this.generateRecommendations(vulnerabilities);

      const report: VulnerabilityReport = {
        id: this.generateReportId(),
        contractAddress: address,
        scanDate: Date.now(),
        vulnerabilities,
        riskScore,
        recommendations,
        nextScanDate: Date.now() + (this.config.vulnerabilityScan.scanInterval * 60 * 60 * 1000),
        scanner: 'contract-monitor-v1'
      };

      // Store report
      this.vulnerabilityReports.set(address, report);

      // Update metrics
      this.metrics.vulnerabilitiesFound += vulnerabilities.length;

      // Generate alerts for critical vulnerabilities
      const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical');
      for (const vuln of criticalVulns) {
        await this.createAlert({
          contractAddress: address,
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

      logger.info(`Vulnerability scan completed`, {
        address,
        vulnerabilitiesFound: vulnerabilities.length,
        riskScore
      });

      // Emit event
      this.emit('vulnerabilityScanCompleted', report);

      return report;
    } catch (error) {
      logger.error('Failed to scan contract for vulnerabilities', {
        error: error.message,
        address
      });
      throw error;
    }
  }

  // Alert management
  async createAlert(alert: Omit<SecurityAlert, 'id' | 'timestamp' | 'status'>): Promise<string> {
    try {
      const id = this.generateAlertId();

      const fullAlert: SecurityAlert = {
        id,
        timestamp: Date.now(),
        status: 'open',
        ...alert
      };

      this.alerts.set(id, fullAlert);

      // Update metrics
      this.metrics.alertsGenerated++;
      this.updateRiskDistribution();

      // Send notifications
      await this.sendAlertNotifications(fullAlert);

      logger.info(`Security alert created`, {
        id,
        contractAddress: alert.contractAddress,
        type: alert.type,
        severity: alert.severity
      });

      // Emit event
      this.emit('alertCreated', fullAlert);

      return id;
    } catch (error) {
      logger.error('Failed to create security alert', {
        error: error.message,
        alert
      });
      throw error;
    }
  }

  async resolveAlert(alertId: string, resolution: string, assignedTo?: string): Promise<void> {
    try {
      const alert = this.alerts.get(alertId);
      if (!alert) {
        throw new Error(`Alert not found: ${alertId}`);
      }

      alert.status = 'resolved';
      alert.resolvedAt = Date.now();
      alert.resolution = resolution;
      if (assignedTo) {
        alert.assignedTo = assignedTo;
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
        error: error.message,
        alertId
      });
      throw error;
    }
  }

  async getAlerts(filters?: {
    contractAddress?: string;
    severity?: string;
    status?: string;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<SecurityAlert[]> {
    try {
      let alerts = Array.from(this.alerts.values());

      // Apply filters
      if (filters) {
        if (filters.contractAddress) {
          alerts = alerts.filter(alert => alert.contractAddress.toLowerCase() === filters.contractAddress!.toLowerCase());
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
      logger.error('Failed to get alerts', { error: error.message });
      throw error;
    }
  }

  // Event monitoring
  async analyzeEvent(event: {
    address: string;
    event: string;
    args: any[];
    blockNumber: number;
    transactionHash: string;
    timestamp: number;
  }): Promise<EventAnalysis> {
    try {
      const contract = this.contracts.get(event.address.toLowerCase());
      if (!contract) {
        throw new Error(`Contract not found: ${event.address}`);
      }

      // Check against event filters
      const matchingFilter = this.config.eventMonitoring.eventFilters.find(filter =>
        filter.eventName === event.event && this.evaluateEventConditions(filter.conditions, event.args)
      );

      const analysis: EventAnalysis = {
        eventType: event.event,
        parameters: this.parseEventParameters(event.args),
        timestamp: event.timestamp,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
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
            contractAddress: event.address,
            type: 'suspicious_activity',
            severity: matchingFilter.severity,
            title: `Suspicious Event: ${event.event}`,
            description: `Suspicious event detected: ${event.event}`,
            details: {
              event,
              filter: matchingFilter
            }
          });
        }
      }

      // Additional event analysis
      await this.performEventAnalysis(analysis, contract, event);

      return analysis;
    } catch (error) {
      logger.error('Failed to analyze event', {
        error: error.message,
        event
      });
      throw error;
    }
  }

  // State monitoring
  async captureStateSnapshot(address: string): Promise<StateSnapshot> {
    try {
      const contract = this.contracts.get(address.toLowerCase());
      if (!contract) {
        throw new Error(`Contract not found: ${address}`);
      }

      const latestBlock = await this.provider.getBlock('latest');
      if (!latestBlock) {
        throw new Error('Failed to get latest block');
      }

      // Get contract balance
      const balance = await this.provider.getBalance(address);

      // Get storage (simplified)
      const storage: { [slot: string]: string } = {};

      // Get variables (simplified - would use contract ABI in production)
      const variables: { [key: string]: any } = {
        balance: balance.toString(),
        blockNumber: latestBlock.number,
        timestamp: latestBlock.timestamp
      };

      const snapshot: StateSnapshot = {
        contractAddress: address,
        blockNumber: latestBlock.number,
        timestamp: Date.now(),
        balance: balance.toString(),
        storage,
        variables,
        events: [],
        metadata: {}
      };

      // Store snapshot
      const snapshots = this.stateSnapshots.get(address.toLowerCase()) || [];
      snapshots.push(snapshot);
      this.stateSnapshots.set(address.toLowerCase(), snapshots.slice(-100)); // Keep last 100 snapshots

      // Analyze for anomalies
      await this.analyzeStateChanges(snapshot, address);

      return snapshot;
    } catch (error) {
      logger.error('Failed to capture state snapshot', {
        error: error.message,
        address
      });
      throw error;
    }
  }

  // Metrics and reporting
  async getMetrics(): Promise<SecurityMetrics> {
    try {
      // Update alert trends
      this.updateAlertTrends();

      this.metrics.lastUpdated = Date.now();
      return { ...this.metrics };
    } catch (error) {
      logger.error('Failed to get security metrics', { error: error.message });
      throw error;
    }
  }

  async getStatus(): Promise<MonitoringStatus> {
    try {
      const uptime = this.monitoringActive ? Date.now() - (this.metrics.lastUpdated - 86400000) : 0; // Simplified

      return {
        active: this.monitoringActive,
        contractsCount: this.contracts.size,
        lastScan: this.metrics.lastUpdated,
        uptime,
        errors: [], // Would track actual errors
        performance: {
          averageScanTime: 1000, // Mock value
          alertsPerHour: this.calculateAlertsPerHour(),
          memoryUsage: 50 // MB
        }
      };
    } catch (error) {
      logger.error('Failed to get monitoring status', { error: error.message });
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

        } catch (error) {
          logger.error('Error in contract monitoring cycle', {
            error: error.message,
            address,
            contractName: contract.name
          });
        }
      }
    } catch (error) {
      logger.error('Error in monitoring cycle', { error: error.message });
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
            error: error.message,
            address,
            contractName: contract.name
          });
        }
      }
    } catch (error) {
      logger.error('Error in vulnerability scan cycle', { error: error.message });
    }
  }

  private async analyzeVulnerabilities(contract: ContractInfo): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    // Simulate vulnerability detection
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
        references: ['https://swcregistry.io/docs/SWC-107']
      });
    }

    // Integer overflow check
    if (Math.random() > 0.9) { // 10% chance for demo
      vulnerabilities.push({
        type: 'integer_overflow',
        severity: 'medium',
        title: 'Potential Integer Overflow',
        description: 'Contract contains arithmetic operations that may overflow',
        location: 'Line 42-45',
        impact: 'Unexpected behavior or fund loss',
        mitigation: 'Use SafeMath library or Solidity 0.8+ built-in overflow protection',
        cweId: 'CWE-190',
        cvssScore: 5.5,
        references: ['https://swcregistry.io/docs/SWC-101']
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
        references: ['https://swcregistry.io/docs/SWC-105']
      });
    }

    return vulnerabilities;
  }

  private calculateRiskScore(vulnerabilities: Vulnerability[]): number {
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

  private generateRecommendations(vulnerabilities: Vulnerability[]): string[] {
    const recommendations: string[] = [];

    vulnerabilities.forEach(vuln => {
      recommendations.push(vuln.mitigation);
    });

    if (vulnerabilities.length > 0) {
      recommendations.push('Consider professional security audit');
      recommendations.push('Implement comprehensive testing suite');
    }

    return Array.from(new Set(recommendations));
  }

  private async analyzeStateChanges(snapshot: StateSnapshot, address: string): Promise<void> {
    try {
      const snapshots = this.stateSnapshots.get(address.toLowerCase()) || [];
      if (snapshots.length < 2) return;

      const previousSnapshot = snapshots[snapshots.length - 2];
      const currentSnapshot = snapshot;

      // Check balance changes
      const balanceChange = parseFloat(currentSnapshot.balance) - parseFloat(previousSnapshot.balance);
      if (Math.abs(balanceChange) > this.config.alertThresholds.balanceChange) {
        await this.createAlert({
          contractAddress: address,
          type: 'unusual_state_change',
          severity: 'medium',
          title: 'Unusual Balance Change',
          description: `Contract balance changed by ${balanceChange} ETH`,
          details: {
            previousBalance: previousSnapshot.balance,
            currentBalance: currentSnapshot.balance,
            change: balanceChange.toString()
          }
        });
      }

      // Check for other anomalies
      await this.checkForStateAnomalies(previousSnapshot, currentSnapshot, address);

    } catch (error) {
      logger.error('Failed to analyze state changes', {
        error: error.message,
        address
      });
    }
  }

  private async checkForStateAnomalies(
    previous: StateSnapshot,
    current: StateSnapshot,
    address: string
  ): Promise<void> {
    // Implement additional state anomaly checks
    // This would check for suspicious patterns in state changes
  }

  private async checkForUnusualActivity(contract: ContractInfo): Promise<void> {
    try {
      // Check for unusual transaction patterns
      // This would analyze recent transaction history
    } catch (error) {
      logger.error('Failed to check for unusual activity', {
        error: error.message,
        contractAddress: contract.address
      });
    }
  }

  private async performEventAnalysis(
    analysis: EventAnalysis,
    contract: ContractInfo,
    event: any
  ): Promise<void> {
    // Additional event-specific analysis
    // This would implement deeper event analysis based on contract type
  }

  private parseEventParameters(args: any[]): { [key: string]: any } {
    // Simplified parameter parsing
    // In production, would use ABI to parse named parameters
    return {
      parameter0: args[0],
      parameter1: args[1],
      parameterCount: args.length
    };
  }

  private evaluateEventConditions(conditions: EventCondition[], args: any[]): boolean {
    // Simplified condition evaluation
    // In production, would implement more sophisticated condition matching
    return conditions.every(condition => {
      const argValue = args[0]; // Simplified
      switch (condition.operator) {
        case 'equals': return argValue === condition.value;
        case 'greater_than': return parseFloat(argValue) > parseFloat(condition.value);
        case 'less_than': return parseFloat(argValue) < parseFloat(condition.value);
        case 'contains': return String(argValue).includes(String(condition.value));
        default: return false;
      }
    });
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

  private async sendAlertNotifications(alert: SecurityAlert): Promise<void> {
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

    } catch (error) {
      logger.error('Failed to send alert notifications', {
        error: error.message,
        alertId: alert.id
      });
    }
  }

  private async sendEmailNotification(alert: SecurityAlert): Promise<void> {
    // Implement email notification sending
    logger.info('Email notification sent', { alertId: alert.id });
  }

  private async sendWebhookNotification(alert: SecurityAlert): Promise<void> {
    // Implement webhook notification sending
    logger.info('Webhook notification sent', { alertId: alert.id });
  }

  private async sendSlackNotification(alert: SecurityAlert): Promise<void> {
    // Implement Slack notification sending
    logger.info('Slack notification sent', { alertId: alert.id });
  }

  private async sendTelegramNotification(alert: SecurityAlert): Promise<void> {
    // Implement Telegram notification sending
    logger.info('Telegram notification sent', { alertId: alert.id });
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
          notificationsEnabled
        }
      };
    } catch (error) {
      logger.error('Contract monitor health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        details: {
          monitoringActive: false,
          contractsCount: 0,
          alertsCount: 0,
          vulnerabilityReportsCount: 0,
          lastScan: 0,
          notificationsEnabled: false
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
      logger.error('Failed to cleanup contract monitor', { error: error.message });
      throw error;
    }
  }
}

// Factory function
export function createContractSecurityMonitor(
  provider: ethers.providers.JsonRpcProvider,
  cacheService: ICache,
  config?: Partial<ContractMonitorConfig>
): ContractSecurityMonitor {
  return new ContractSecurityMonitor(provider, cacheService, config);
}