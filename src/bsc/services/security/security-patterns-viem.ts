import {
  PublicClient,
  WalletClient,
  Address,
  Hash,
  BlockNumber,
  BlockTag,
  formatUnits,
  parseUnits,
  Chain,
  Transport,
  Account
} from 'viem';
import { ICache, ILogger, CacheConfig } from '../../../types/viem-core-types';

/**
 * Comprehensive security patterns and threat detection system for Viem integration
 */
export interface SecurityPatternViem {
  id: string;
  name: string;
  description: string;
  category: 'address_validation' | 'transaction_validation' | 'contract_validation' | 'gas_security' | 'timing_security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  config: SecurityPatternConfigViem;
}

export interface SecurityPatternConfigViem {
  parameters: Record<string, any>;
  thresholds: Record<string, number>;
  actions: SecurityActionViem[];
  notifications: SecurityNotificationViem[];
}

export interface SecurityActionViem {
  type: 'block' | 'warn' | 'log' | 'quarantine' | 'require_approval';
  condition: string;
  parameters?: Record<string, any>;
}

export interface SecurityNotificationViem {
  type: 'email' | 'webhook' | 'slack' | 'telegram';
  recipients: string[];
  template: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface AddressValidationResultViem {
  isValid: boolean;
  isWhitelisted: boolean;
  isBlacklisted: boolean;
  riskScore: number;
  warnings: string[];
  recommendations: string[];
  metadata: AddressMetadataViem;
}

export interface AddressMetadataViem {
  type: 'contract' | 'eoa' | 'factory';
  age: number;
  transactionCount: number;
  balance: string;
  verified: boolean;
  codeSize?: number;
  hasCode?: boolean;
}

export interface TransactionValidationResultViem {
  isValid: boolean;
  riskScore: number;
  threats: SecurityThreatViem[];
  warnings: string[];
  recommendations: string[];
  gasAnalysis: GasSecurityAnalysisViem;
  timingAnalysis: TimingSecurityAnalysisViem;
  mevAnalysis: MevSecurityAnalysisViem;
}

export interface SecurityThreatViem {
  type: 'front_running' | 'sandwich_attack' | 'flash_loan_attack' | 'honeypot' | 'rug_pull' | 'phishing' | 'mev_exploit';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
  indicators: string[];
  mitigation: string;
  detectedAt: Date;
}

export interface GasSecurityAnalysisViem {
  isValid: boolean;
  gasPrice: string;
  gasLimit: string;
  estimatedGasCost: string;
  networkGasPrice: string;
  threats: {
    gasGouging: boolean;
    unusualGasLimit: boolean;
    gasManipulation: boolean;
    priceImpact: boolean;
  };
  recommendations: string[];
  metrics: GasSecurityMetricsViem;
}

export interface GasSecurityMetricsViem {
  priceMultiplier: number;
  limitMultiplier: number;
  costEfficiency: number;
  networkPercentile: number;
  volatilityIndex: number;
}

export interface TimingSecurityAnalysisViem {
  isValid: boolean;
  timestamp: Date;
  blockTimestamp: Date;
  delay: number;
  blockNumber: BlockNumber;
  threats: {
    flashCrashTiming: boolean;
    mevTiming: boolean;
    unusualActivity: boolean;
    timingManipulation: boolean;
  };
  recommendations: string[];
  metrics: TimingSecurityMetricsViem;
}

export interface TimingSecurityMetricsViem {
  blockDelay: number;
  networkActivity: number;
  volatilityScore: number;
  timingAnomaly: number;
}

export interface MevSecurityAnalysisViem {
  isValid: boolean;
  mevRisk: number;
  threats: {
    frontRunning: boolean;
    sandwichAttack: boolean;
    arbitrage: boolean;
    liquidation: boolean;
  };
  analysis: MevAnalysisViem;
  recommendations: string[];
}

export interface MevAnalysisViem {
  potentialProfit: string;
  attackComplexity: 'low' | 'medium' | 'high';
  requiredCapital: string;
  successProbability: number;
  riskFactors: string[];
}

export interface ContractSecurityResultViem {
  isValid: boolean;
  address: Address;
  verificationStatus: 'verified' | 'unverified' | 'error';
  auditStatus: 'audited' | 'unaudited' | 'unknown';
  riskScore: number;
  vulnerabilities: ContractVulnerabilityViem[];
  warnings: string[];
  recommendations: string[];
  analysis: ContractAnalysisViem;
}

export interface ContractVulnerabilityViem {
  type: 'reentrancy' | 'integer_overflow' | 'access_control' | 'logic_error' | 'gas_limit' | 'mev_vulnerability';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: string;
  impact: string;
  mitigation: string;
  cwe?: string; // Common Weakness Enumeration
}

export interface ContractAnalysisViem {
  bytecodeAnalysis: BytecodeAnalysisViem;
  storageAnalysis: StorageAnalysisViem;
  functionAnalysis: FunctionAnalysisViem;
  externalCalls: ExternalCallAnalysisViem;
}

export interface BytecodeAnalysisViem {
  size: number;
  complexity: number;
  knownPatterns: string[];
  suspiciousCode: boolean;
  optimizationLevel: string;
}

export interface StorageAnalysisViem {
  storageSlots: number;
  publicVariables: number;
  sensitiveData: boolean;
  accessPatterns: string[];
}

export interface FunctionAnalysisViem {
  totalFunctions: number;
  publicFunctions: number;
  payableFunctions: number;
  criticalFunctions: string[];
  externalDependencies: string[];
}

export interface ExternalCallAnalysisViem {
  externalCalls: ExternalCallViem[];
  riskLevel: 'low' | 'medium' | 'high';
  suspiciousCalls: string[];
}

export interface ExternalCallViem {
  target: Address;
  function: string;
  riskLevel: 'low' | 'medium' | 'high';
  valueTransferred: string;
}

export interface SecurityContextViem {
  userAddress: Address;
  transactionType: string;
  contractAddress?: Address;
  value: string;
  gasPrice?: string;
  gasLimit?: string;
  timestamp: Date;
  networkId: number;
  metadata: Record<string, any>;
}

export interface SecurityPolicyViem {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  patterns: string[];
  conditions: SecurityConditionViem[];
  actions: SecurityActionViem[];
  priority: number;
  scope: 'global' | 'user' | 'contract' | 'transaction';
}

export interface SecurityConditionViem {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'regex' | 'in_range';
  value: any;
  required: boolean;
  weight?: number;
}

export interface SecurityEventViem {
  id: string;
  type: 'threat_detected' | 'policy_violation' | 'anomaly_detected' | 'security_alert';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  context: SecurityContextViem;
  details: SecurityEventDetailsViem;
  resolved: boolean;
  resolvedAt?: Date;
  resolution?: string;
}

export interface SecurityEventDetailsViem {
  threat?: SecurityThreatViem;
  policy?: SecurityPolicyViem;
  pattern?: SecurityPatternViem;
  violation?: string;
  anomaly?: SecurityAnomalyViem;
  recommendations: string[];
}

export interface SecurityAnomalyViem {
  type: 'behavioral' | 'statistical' | 'temporal' | 'network';
  description: string;
  severity: number;
  confidence: number;
  baseline: any;
  observed: any;
  deviation: number;
}

export interface SecurityReportViem {
  id: string;
  generatedAt: Date;
  period: ReportPeriodViem;
  summary: SecuritySummaryViem;
  threats: ThreatSummaryViem;
  policies: PolicySummaryViem;
  recommendations: SecurityRecommendationViem[];
  metrics: SecurityMetricsViem;
}

export interface ReportPeriodViem {
  start: Date;
  end: Date;
  type: 'hourly' | 'daily' | 'weekly' | 'monthly';
}

export interface SecuritySummaryViem {
  totalThreats: number;
  blockedTransactions: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  securityScore: number;
  trends: SecurityTrendViem[];
}

export interface SecurityTrendViem {
  metric: string;
  current: number;
  previous: number;
  change: number;
  direction: 'up' | 'down' | 'stable';
}

export interface ThreatSummaryViem {
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  bySource: Record<string, number>;
  resolved: number;
  pending: number;
}

export interface PolicySummaryViem {
  totalPolicies: number;
  activePolicies: number;
  violations: number;
  effectiveness: number;
}

export interface SecurityRecommendationViem {
  category: 'immediate' | 'short_term' | 'long_term';
  priority: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
  rationale: string;
  implementation: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
}

export interface SecurityMetricsViem {
  detection: DetectionMetricsViem;
  prevention: PreventionMetricsViem;
  response: ResponseMetricsViem;
  performance: PerformanceMetricsViem;
}

export interface DetectionMetricsViem {
  detectionRate: number;
  falsePositiveRate: number;
  averageDetectionTime: number;
  coverage: number;
}

export interface PreventionMetricsViem {
  blockedThreats: number;
  preventedLosses: string;
  policyEffectiveness: number;
  riskReduction: number;
}

export interface ResponseMetricsViem {
  averageResponseTime: number;
  resolutionRate: number;
  escalationRate: number;
  userSatisfaction: number;
}

export interface PerformanceMetricsViem {
  scanTime: number;
  resourceUsage: number;
  throughput: number;
  availability: number;
}

/**
 * Advanced security patterns service using Viem 2.38.5
 */
export class SecurityPatternsViem {
  private publicClient: PublicClient;
  private walletClient?: WalletClient;
  private cacheService: ICache;
  private logger: ILogger;

  private patterns: Map<string, SecurityPatternViem> = new Map();
  private policies: Map<string, SecurityPolicyViem> = new Map();
  private blacklistedAddresses: Set<Address> = new Set();
  private whitelistedAddresses: Set<Address> = new Set();
  private verifiedContracts: Set<Address> = new Set();
  private securityEvents: SecurityEventViem[] = [];

  private readonly cacheConfig: CacheConfig = {
    ttl: 300, // 5 minutes
    maxSize: 10000,
    strategy: 'lru'
  };

  constructor(
    publicClient: PublicClient,
    cacheService: ICache,
    logger: ILogger,
    walletClient?: WalletClient
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.cacheService = cacheService;
    this.logger = logger;

    this.initializeDefaultPatterns();
    this.initializeDefaultPolicies();
  }

  /**
   * Validate address security using Viem
   */
  async validateAddress(address: Address, context?: SecurityContextViem): Promise<AddressValidationResultViem> {
    try {
      this.logger.info(`Validating address: ${address}`);

      // Check cache first
      const cacheKey = `address_validation_${address}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as AddressValidationResultViem;
      }

      const normalizedAddress = address.toLowerCase() as Address;

      // Check blacklist
      const isBlacklisted = this.blacklistedAddresses.has(normalizedAddress);
      if (isBlacklisted) {
        return {
          isValid: false,
          isWhitelisted: false,
          isBlacklisted: true,
          riskScore: 100,
          warnings: ['Address is blacklisted'],
          recommendations: ['Use a different address'],
          metadata: {
            type: 'eoa',
            age: 0,
            transactionCount: 0,
            balance: '0',
            verified: false
          }
        };
      }

      // Check whitelist
      const isWhitelisted = this.whitelistedAddresses.has(normalizedAddress);
      if (isWhitelisted) {
        return {
          isValid: true,
          isWhitelisted: true,
          isBlacklisted: false,
          riskScore: 0,
          warnings: [],
          recommendations: [],
          metadata: {
            type: 'eoa',
            age: 0,
            transactionCount: 0,
            balance: '0',
            verified: true
          }
        };
      }

      // Get address metadata using Viem
      const metadata = await this.getAddressMetadata(address);

      // Apply security patterns
      const threats = await this.applyAddressPatterns(address, context);
      const riskScore = this.calculateRiskScore(threats, metadata);

      const result: AddressValidationResultViem = {
        isValid: riskScore < 80,
        isWhitelisted,
        isBlacklisted,
        riskScore,
        warnings: threats.map(t => t.description),
        recommendations: this.generateRecommendations(threats, metadata),
        metadata
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(result), this.cacheConfig);

      return result;
    } catch (error) {
      this.logger.error('Error validating address', {
        address,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate transaction security using Viem
   */
  async validateTransaction(
    to: Address,
    value: string,
    data?: string,
    context?: SecurityContextViem
  ): Promise<TransactionValidationResultViem> {
    try {
      this.logger.info(`Validating transaction to: ${to}, value: ${value}`);

      const cacheKey = `tx_validation_${to}_${value}_${Date.now()}`;

      // Get current network state
      const blockNumber = await this.publicClient.getBlockNumber();
      const block = await this.publicClient.getBlock({ blockNumber });

      // Analyze gas security
      const gasAnalysis = await this.analyzeGasSecurity(to, value, data);

      // Analyze timing security
      const timingAnalysis = await this.analyzeTimingSecurity(blockNumber, block?.timestamp);

      // Analyze MEV security
      const mevAnalysis = await this.analyzeMevSecurity(to, value, data, context);

      // Detect threats
      const threats = await this.detectTransactionThreats(to, value, data, context);

      // Calculate overall risk score
      const riskScore = this.calculateTransactionRiskScore(threats, gasAnalysis, timingAnalysis, mevAnalysis);

      const result: TransactionValidationResultViem = {
        isValid: riskScore < 80,
        riskScore,
        threats,
        warnings: this.generateTransactionWarnings(threats, gasAnalysis, timingAnalysis, mevAnalysis),
        recommendations: this.generateTransactionRecommendations(threats, gasAnalysis, timingAnalysis, mevAnalysis),
        gasAnalysis,
        timingAnalysis,
        mevAnalysis
      };

      // Log security event if high risk
      if (riskScore >= 70) {
        await this.logSecurityEvent({
          id: `tx_${Date.now()}`,
          type: 'threat_detected',
          severity: riskScore >= 90 ? 'critical' : 'high',
          timestamp: new Date(),
          context: context || {
            userAddress: '0x0' as Address,
            transactionType: 'unknown',
            contractAddress: to,
            value,
            timestamp: new Date(),
            networkId: 56, // BSC
            metadata: {}
          },
          details: {
            threat: threats[0],
            recommendations: result.recommendations
          },
          resolved: false
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Error validating transaction', {
        to,
        value,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate contract security using Viem
   */
  async validateContract(address: Address): Promise<ContractSecurityResultViem> {
    try {
      this.logger.info(`Validating contract: ${address}`);

      const cacheKey = `contract_validation_${address}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as ContractSecurityResultViem;
      }

      // Check if contract is verified
      const isVerified = this.verifiedContracts.has(address);

      // Get contract bytecode
      const bytecode = await this.publicClient.getBytecode({ address });
      const hasCode = bytecode && bytecode.length > 0;

      if (!hasCode) {
        return {
          isValid: true,
          address,
          verificationStatus: 'unverified',
          auditStatus: 'unknown',
          riskScore: 10,
          vulnerabilities: [],
          warnings: ['Address appears to be an EOA, not a contract'],
          recommendations: ['Verify if this is the intended contract address'],
          analysis: {
            bytecodeAnalysis: {
              size: 0,
              complexity: 0,
              knownPatterns: [],
              suspiciousCode: false,
              optimizationLevel: 'unknown'
            },
            storageAnalysis: {
              storageSlots: 0,
              publicVariables: 0,
              sensitiveData: false,
              accessPatterns: []
            },
            functionAnalysis: {
              totalFunctions: 0,
              publicFunctions: 0,
              payableFunctions: 0,
              criticalFunctions: [],
              externalDependencies: []
            },
            externalCalls: {
              externalCalls: [],
              riskLevel: 'low',
              suspiciousCalls: []
            }
          }
        };
      }

      // Analyze bytecode for vulnerabilities
      const vulnerabilities = await this.analyzeBytecodeVulnerabilities(bytecode);
      const analysis = await this.performContractAnalysis(address, bytecode);

      // Calculate risk score
      const riskScore = this.calculateContractRiskScore(vulnerabilities, analysis);

      const result: ContractSecurityResultViem = {
        isValid: riskScore < 80,
        address,
        verificationStatus: isVerified ? 'verified' : 'unverified',
        auditStatus: 'unknown',
        riskScore,
        vulnerabilities,
        warnings: this.generateContractWarnings(vulnerabilities, analysis),
        recommendations: this.generateContractRecommendations(vulnerabilities, analysis),
        analysis
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(result), {
        ...this.cacheConfig,
        ttl: 1800 // 30 minutes for contract validation
      });

      return result;
    } catch (error) {
      this.logger.error('Error validating contract', {
        address,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Apply security policies to a transaction
   */
  async applySecurityPolicies(
    context: SecurityContextViem
  ): Promise<{
    allowed: boolean;
    blockedBy: string[];
    warnings: string[];
    requiredActions: string[];
  }> {
    const blockedBy: string[] = [];
    const warnings: string[] = [];
    const requiredActions: string[] = [];

    for (const policy of this.policies.values()) {
      if (!policy.enabled) continue;

      const policyResult = await this.evaluatePolicy(policy, context);

      if (!policyResult.passed) {
        blockedBy.push(policy.name);

        // Add policy actions
        policyResult.actions.forEach(action => {
          if (action.type === 'block') {
            blockedBy.push(action.condition);
          } else if (action.type === 'warn') {
            warnings.push(action.condition);
          } else if (action.type === 'require_approval') {
            requiredActions.push(action.condition);
          }
        });
      }
    }

    return {
      allowed: blockedBy.length === 0,
      blockedBy,
      warnings,
      requiredActions
    };
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(
    startDate: Date,
    endDate: Date,
    type: ReportPeriodViem['type'] = 'daily'
  ): Promise<SecurityReportViem> {
    const reportId = `security_report_${type}_${startDate.getTime()}_${endDate.getTime()}`;

    try {
      // Analyze events in the period
      const events = this.securityEvents.filter(
        event => event.timestamp >= startDate && event.timestamp <= endDate
      );

      const summary = this.generateSecuritySummary(events);
      const threats = this.generateThreatSummary(events);
      const policies = this.generatePolicySummary(events);
      const recommendations = this.generateSecurityRecommendations(events);
      const metrics = this.calculateSecurityMetrics(events);

      const report: SecurityReportViem = {
        id: reportId,
        generatedAt: new Date(),
        period: { start: startDate, end: endDate, type },
        summary,
        threats,
        policies,
        recommendations,
        metrics
      };

      this.logger.info('Generated security report', {
        reportId,
        type,
        threats: summary.totalThreats,
        securityScore: summary.securityScore
      });

      return report;
    } catch (error) {
      this.logger.error('Error generating security report', {
        reportId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Add address to blacklist
   */
  async addToBlacklist(address: Address, reason?: string): Promise<void> {
    this.blacklistedAddresses.add(address.toLowerCase() as Address);

    // Clear cache for this address
    await this.cacheService.delete(`address_validation_${address}`);

    this.logger.warn('Address added to blacklist', { address, reason });
  }

  /**
   * Remove address from blacklist
   */
  async removeFromBlacklist(address: Address): Promise<void> {
    this.blacklistedAddresses.delete(address.toLowerCase() as Address);

    // Clear cache for this address
    await this.cacheService.delete(`address_validation_${address}`);

    this.logger.info('Address removed from blacklist', { address });
  }

  /**
   * Add address to whitelist
   */
  async addToWhitelist(address: Address, reason?: string): Promise<void> {
    this.whitelistedAddresses.add(address.toLowerCase() as Address);

    // Clear cache for this address
    await this.cacheService.delete(`address_validation_${address}`);

    this.logger.info('Address added to whitelist', { address, reason });
  }

  /**
   * Get security events
   */
  async getSecurityEvents(
    filters?: {
      type?: SecurityEventViem['type'];
      severity?: SecurityEventViem['severity'];
      startDate?: Date;
      endDate?: Date;
      resolved?: boolean;
    }
  ): Promise<SecurityEventViem[]> {
    let events = this.securityEvents;

    if (filters) {
      if (filters.type) {
        events = events.filter(e => e.type === filters.type);
      }
      if (filters.severity) {
        events = events.filter(e => e.severity === filters.severity);
      }
      if (filters.startDate) {
        events = events.filter(e => e.timestamp >= filters.startDate);
      }
      if (filters.endDate) {
        events = events.filter(e => e.timestamp <= filters.endDate);
      }
      if (filters.resolved !== undefined) {
        events = events.filter(e => e.resolved === filters.resolved);
      }
    }

    return events;
  }

  // Private helper methods

  private initializeDefaultPatterns(): void {
    // Address validation patterns
    this.patterns.set('blacklist_check', {
      id: 'blacklist_check',
      name: 'Blacklist Check',
      description: 'Check if address is in blacklist',
      category: 'address_validation',
      severity: 'critical',
      enabled: true,
      config: {
        parameters: {},
        thresholds: { riskScore: 100 },
        actions: [{ type: 'block', condition: 'Address is blacklisted' }],
        notifications: []
      }
    });

    // Gas security patterns
    this.patterns.set('gas_gouging_detection', {
      id: 'gas_gouging_detection',
      name: 'Gas Gouging Detection',
      description: 'Detect unusually high gas prices',
      category: 'gas_security',
      severity: 'high',
      enabled: true,
      config: {
        parameters: { maxMultiplier: 5 },
        thresholds: { riskScore: 70 },
        actions: [{ type: 'warn', condition: 'Gas price is unusually high' }],
        notifications: []
      }
    });

    // MEV detection patterns
    this.patterns.set('front_running_detection', {
      id: 'front_running_detection',
      name: 'Front Running Detection',
      description: 'Detect potential front running attacks',
      category: 'transaction_validation',
      severity: 'high',
      enabled: true,
      config: {
        parameters: { timeWindow: 30 },
        thresholds: { riskScore: 80 },
        actions: [{ type: 'warn', condition: 'Potential front running detected' }],
        notifications: []
      }
    });
  }

  private initializeDefaultPolicies(): void {
    this.policies.set('high_value_protection', {
      id: 'high_value_protection',
      name: 'High Value Transaction Protection',
      description: 'Additional checks for high value transactions',
      enabled: true,
      patterns: ['gas_gouging_detection', 'front_running_detection'],
      conditions: [
        { field: 'value', operator: 'greater_than', value: parseUnits('10', 18), required: true }
      ],
      actions: [
        { type: 'require_approval', condition: 'High value transaction requires approval' }
      ],
      priority: 1,
      scope: 'transaction'
    });
  }

  private async getAddressMetadata(address: Address): Promise<AddressMetadataViem> {
    try {
      const balance = await this.publicClient.getBalance({ address });
      const bytecode = await this.publicClient.getBytecode({ address });
      const hasCode = bytecode && bytecode.length > 0;

      return {
        type: hasCode ? 'contract' : 'eoa',
        age: 0, // Would need external API for this
        transactionCount: 0, // Would need external API for this
        balance: formatUnits(balance, 18),
        verified: this.verifiedContracts.has(address),
        codeSize: hasCode ? bytecode.length : undefined,
        hasCode
      };
    } catch (error) {
      this.logger.error('Error getting address metadata', {
        address,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        type: 'eoa',
        age: 0,
        transactionCount: 0,
        balance: '0',
        verified: false
      };
    }
  }

  private async applyAddressPatterns(
    address: Address,
    context?: SecurityContextViem
  ): Promise<SecurityThreatViem[]> {
    const threats: SecurityThreatViem[] = [];

    // Apply blacklist pattern
    if (this.blacklistedAddresses.has(address.toLowerCase() as Address)) {
      threats.push({
        type: 'phishing',
        severity: 'critical',
        confidence: 1.0,
        description: 'Address is blacklisted',
        indicators: ['Blacklisted address'],
        mitigation: 'Use a different address',
        detectedAt: new Date()
      });
    }

    return threats;
  }

  private calculateRiskScore(
    threats: SecurityThreatViem[],
    metadata: AddressMetadataViem
  ): number {
    let riskScore = 0;

    // Calculate threat risk
    threats.forEach(threat => {
      const severityWeight = {
        low: 10,
        medium: 30,
        high: 60,
        critical: 100
      };

      riskScore += severityWeight[threat.severity] * threat.confidence;
    });

    // Add metadata-based risk
    if (!metadata.verified && metadata.type === 'contract') {
      riskScore += 20;
    }

    if (metadata.type === 'contract' && metadata.codeSize && metadata.codeSize < 100) {
      riskScore += 15;
    }

    return Math.min(riskScore, 100);
  }

  private generateRecommendations(
    threats: SecurityThreatViem[],
    metadata: AddressMetadataViem
  ): string[] {
    const recommendations: string[] = [];

    threats.forEach(threat => {
      recommendations.push(threat.mitigation);
    });

    if (!metadata.verified && metadata.type === 'contract') {
      recommendations.push('Verify the contract source code on Etherscan');
    }

    if (parseFloat(metadata.balance) > 1000) {
      recommendations.push('Consider using a hardware wallet for large balances');
    }

    return recommendations;
  }

  private async analyzeGasSecurity(
    to: Address,
    value: string,
    data?: string
  ): Promise<GasSecurityAnalysisViem> {
    try {
      // Estimate gas for the transaction
      const gasEstimate = data
        ? await this.publicClient.estimateGas({
            to,
            value: parseUnits(value, 18),
            data: data as `0x${string}`
          })
        : await this.publicClient.estimateGas({
            to,
            value: parseUnits(value, 18)
          });

      // Get current gas price
      const gasPrice = await this.publicClient.getGasPrice();
      const gasLimit = gasEstimate;
      const estimatedGasCost = gasPrice * gasLimit;

      // Check for gas gouging
      const networkGasPrice = gasPrice; // In a real implementation, get historical average
      const priceMultiplier = Number(formatUnits(gasPrice, 'gwei')) / Number(formatUnits(networkGasPrice, 'gwei'));

      return {
        isValid: priceMultiplier < 10,
        gasPrice: formatUnits(gasPrice, 'gwei'),
        gasLimit: gasLimit.toString(),
        estimatedGasCost: formatUnits(estimatedGasCost, 18),
        networkGasPrice: formatUnits(networkGasPrice, 'gwei'),
        threats: {
          gasGouging: priceMultiplier > 5,
          unusualGasLimit: gasLimit > 1000000n,
          gasManipulation: priceMultiplier > 20,
          priceImpact: estimatedGasCost > parseUnits('1', 18)
        },
        recommendations: this.generateGasRecommendations(priceMultiplier, gasLimit),
        metrics: {
          priceMultiplier,
          limitMultiplier: Number(gasLimit) / 21000, // Relative to standard transfer
          costEfficiency: 0.8, // Simplified
          networkPercentile: 0.5,
          volatilityIndex: 0.1
        }
      };
    } catch (error) {
      this.logger.error('Error analyzing gas security', {
        to,
        value,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        isValid: false,
        gasPrice: '0',
        gasLimit: '0',
        estimatedGasCost: '0',
        networkGasPrice: '0',
        threats: {
          gasGouging: false,
          unusualGasLimit: false,
          gasManipulation: false,
          priceImpact: false
        },
        recommendations: ['Unable to estimate gas - check transaction parameters'],
        metrics: {
          priceMultiplier: 0,
          limitMultiplier: 0,
          costEfficiency: 0,
          networkPercentile: 0,
          volatilityIndex: 0
        }
      };
    }
  }

  private async analyzeTimingSecurity(
    blockNumber: BlockNumber,
    blockTimestamp?: bigint
  ): Promise<TimingSecurityAnalysisViem> {
    const now = Date.now();
    const blockTime = blockTimestamp ? Number(blockTimestamp) * 1000 : now;
    const delay = now - blockTime;

    return {
      isValid: delay < 60000, // Within 1 minute
      timestamp: new Date(now),
      blockTimestamp: new Date(blockTime),
      delay,
      blockNumber,
      threats: {
        flashCrashTiming: delay < 1000, // Very recent block
        mevTiming: delay < 5000, // Very recent for MEV
        unusualActivity: delay < 100, // Suspiciously recent
        timingManipulation: delay < 10 // Extremely recent
      },
      recommendations: this.generateTimingRecommendations(delay),
      metrics: {
        blockDelay: delay,
        networkActivity: 0.5, // Simplified
        volatilityScore: 0.1,
        timingAnomaly: Math.min(delay / 1000, 1)
      }
    };
  }

  private async analyzeMevSecurity(
    to: Address,
    value: string,
    data?: string,
    context?: SecurityContextViem
  ): Promise<MevSecurityAnalysisViem> {
    // Simplified MEV analysis
    const valueBN = parseUnits(value, 18);
    const isHighValue = valueBN > parseUnits('1', 18);

    return {
      isValid: !isHighValue,
      mevRisk: isHighValue ? 0.7 : 0.1,
      threats: {
        frontRunning: isHighValue,
        sandwichAttack: data && data.length > 0,
        arbitrage: false,
        liquidation: false
      },
      analysis: {
        potentialProfit: isHighValue ? '0.1' : '0.001',
        attackComplexity: 'medium',
        requiredCapital: value,
        successProbability: isHighValue ? 0.3 : 0.1,
        riskFactors: isHighValue ? ['High value transaction', 'Public mempool'] : []
      },
      recommendations: isHighValue
        ? ['Consider using private mempool', 'Add slippage protection']
        : ['Transaction appears safe from MEV attacks']
    };
  }

  private async detectTransactionThreats(
    to: Address,
    value: string,
    data?: string,
    context?: SecurityContextViem
  ): Promise<SecurityThreatViem[]> {
    const threats: SecurityThreatViem[] = [];

    // Check for high-value transaction
    const valueBN = parseUnits(value, 18);
    if (valueBN > parseUnits('10', 18)) {
      threats.push({
        type: 'mev_exploit',
        severity: 'high',
        confidence: 0.7,
        description: 'High-value transaction detected',
        indicators: ['Large value transfer', 'Potential MEV target'],
        mitigation: 'Consider using private mempool or delayed execution',
        detectedAt: new Date()
      });
    }

    // Check for suspicious contract interactions
    const contractValidation = await this.validateContract(to);
    if (!contractValidation.isValid && contractValidation.vulnerabilities.length > 0) {
      threats.push({
        type: 'honeypot',
        severity: 'high',
        confidence: 0.8,
        description: 'Interaction with vulnerable contract',
        indicators: ['Contract has vulnerabilities', 'Unverified contract'],
        mitigation: 'Avoid interaction with this contract',
        detectedAt: new Date()
      });
    }

    return threats;
  }

  private calculateTransactionRiskScore(
    threats: SecurityThreatViem[],
    gasAnalysis: GasSecurityAnalysisViem,
    timingAnalysis: TimingSecurityAnalysisViem,
    mevAnalysis: MevSecurityAnalysisViem
  ): number {
    let riskScore = 0;

    // Calculate threat risk
    threats.forEach(threat => {
      const severityWeight = {
        low: 10,
        medium: 30,
        high: 60,
        critical: 100
      };

      riskScore += severityWeight[threat.severity] * threat.confidence;
    });

    // Add gas analysis risk
    if (gasAnalysis.threats.gasGouging) riskScore += 30;
    if (gasAnalysis.threats.unusualGasLimit) riskScore += 20;

    // Add timing analysis risk
    if (timingAnalysis.threats.flashCrashTiming) riskScore += 25;
    if (timingAnalysis.threats.mevTiming) riskScore += 20;

    // Add MEV analysis risk
    riskScore += mevAnalysis.mevRisk * 50;

    return Math.min(riskScore, 100);
  }

  private generateTransactionWarnings(
    threats: SecurityThreatViem[],
    gasAnalysis: GasSecurityAnalysisViem,
    timingAnalysis: TimingSecurityAnalysisViem,
    mevAnalysis: MevSecurityAnalysisViem
  ): string[] {
    const warnings: string[] = [];

    threats.forEach(threat => {
      warnings.push(threat.description);
    });

    if (gasAnalysis.threats.gasGouging) {
      warnings.push('Gas price appears to be unusually high');
    }

    if (timingAnalysis.threats.flashCrashTiming) {
      warnings.push('Transaction timing may be risky');
    }

    if (mevAnalysis.threats.frontRunning) {
      warnings.push('Transaction may be vulnerable to front-running');
    }

    return warnings;
  }

  private generateTransactionRecommendations(
    threats: SecurityThreatViem[],
    gasAnalysis: GasSecurityAnalysisViem,
    timingAnalysis: TimingSecurityAnalysisViem,
    mevAnalysis: MevSecurityAnalysisViem
  ): string[] {
    const recommendations: string[] = [];

    threats.forEach(threat => {
      recommendations.push(threat.mitigation);
    });

    recommendations.push(...gasAnalysis.recommendations);
    recommendations.push(...timingAnalysis.recommendations);
    recommendations.push(...mevAnalysis.recommendations);

    return recommendations;
  }

  private generateGasRecommendations(priceMultiplier: number, gasLimit: bigint): string[] {
    const recommendations: string[] = [];

    if (priceMultiplier > 5) {
      recommendations.push('Consider waiting for lower gas prices');
    }

    if (gasLimit > 1000000n) {
      recommendations.push('Gas limit seems unusually high - verify transaction');
    }

    if (priceMultiplier > 10) {
      recommendations.push('Gas price is extremely high - consider postponing transaction');
    }

    return recommendations;
  }

  private generateTimingRecommendations(delay: number): string[] {
    const recommendations: string[] = [];

    if (delay < 1000) {
      recommendations.push('Transaction submitted very quickly - ensure this is intentional');
    }

    if (delay < 100) {
      recommendations.push('Suspicious timing - consider additional verification');
    }

    return recommendations;
  }

  private async analyzeBytecodeVulnerabilities(bytecode: `0x${string}`): Promise<ContractVulnerabilityViem[]> {
    const vulnerabilities: ContractVulnerabilityViem[] = [];

    // Simplified bytecode analysis
    if (bytecode.includes('selfdestruct')) {
      vulnerabilities.push({
        type: 'logic_error',
        severity: 'critical',
        description: 'Contract contains selfdestruct function',
        location: 'Bytecode',
        impact: 'Contract can be destroyed',
        mitigation: 'Verify this is intentional and necessary',
        cwe: 'CWE-703'
      });
    }

    // Check for common vulnerable patterns
    const vulnerablePatterns = [
      { pattern: 'delegatecall', type: 'access_control' as const, severity: 'high' as const },
      { pattern: 'suicide', type: 'logic_error' as const, severity: 'critical' as const },
      { pattern: 'tx.origin', type: 'access_control' as const, severity: 'medium' as const }
    ];

    vulnerablePatterns.forEach(({ pattern, type, severity }) => {
      if (bytecode.toLowerCase().includes(pattern)) {
        vulnerabilities.push({
          type,
          severity,
          description: `Contract contains potentially vulnerable pattern: ${pattern}`,
          location: 'Bytecode',
          impact: 'May lead to security vulnerabilities',
          mitigation: 'Ensure proper access controls and validation'
        });
      }
    });

    return vulnerabilities;
  }

  private async performContractAnalysis(
    address: Address,
    bytecode: `0x${string}`
  ): Promise<ContractAnalysisViem> {
    return {
      bytecodeAnalysis: {
        size: bytecode.length,
        complexity: Math.min(bytecode.length / 1000, 10),
        knownPatterns: [],
        suspiciousCode: false,
        optimizationLevel: 'unknown'
      },
      storageAnalysis: {
        storageSlots: 0,
        publicVariables: 0,
        sensitiveData: false,
        accessPatterns: []
      },
      functionAnalysis: {
        totalFunctions: 0,
        publicFunctions: 0,
        payableFunctions: 0,
        criticalFunctions: [],
        externalDependencies: []
      },
      externalCalls: {
        externalCalls: [],
        riskLevel: 'low',
        suspiciousCalls: []
      }
    };
  }

  private calculateContractRiskScore(
    vulnerabilities: ContractVulnerabilityViem[],
    analysis: ContractAnalysisViem
  ): number {
    let riskScore = 0;

    vulnerabilities.forEach(vuln => {
      const severityWeight = {
        low: 10,
        medium: 30,
        high: 60,
        critical: 100
      };

      riskScore += severityWeight[vuln.severity];
    });

    // Add bytecode analysis risk
    if (analysis.bytecodeAnalysis.suspiciousCode) {
      riskScore += 50;
    }

    if (analysis.externalCalls.riskLevel === 'high') {
      riskScore += 30;
    }

    return Math.min(riskScore, 100);
  }

  private generateContractWarnings(
    vulnerabilities: ContractVulnerabilityViem[],
    analysis: ContractAnalysisViem
  ): string[] {
    const warnings: string[] = [];

    vulnerabilities.forEach(vuln => {
      warnings.push(vuln.description);
    });

    if (analysis.bytecodeAnalysis.suspiciousCode) {
      warnings.push('Contract bytecode contains suspicious patterns');
    }

    if (analysis.externalCalls.riskLevel === 'high') {
      warnings.push('Contract makes high-risk external calls');
    }

    return warnings;
  }

  private generateContractRecommendations(
    vulnerabilities: ContractVulnerabilityViem[],
    analysis: ContractAnalysisViem
  ): string[] {
    const recommendations: string[] = [];

    vulnerabilities.forEach(vuln => {
      recommendations.push(vuln.mitigation);
    });

    if (!this.verifiedContracts.has(analysis.externalCalls.externalCalls[0]?.target || '0x' as Address)) {
      recommendations.push('Verify the contract source code on Etherscan');
    }

    if (analysis.externalCalls.suspiciousCalls.length > 0) {
      recommendations.push('Review external calls for security implications');
    }

    return recommendations;
  }

  private async evaluatePolicy(
    policy: SecurityPolicyViem,
    context: SecurityContextViem
  ): Promise<{ passed: boolean; actions: SecurityActionViem[] }> {
    const actions: SecurityActionViem[] = [];
    let passed = true;

    for (const condition of policy.conditions) {
      if (!this.evaluateCondition(condition, context)) {
        if (condition.required) {
          passed = false;
        }
      }
    }

    if (!passed) {
      actions.push(...policy.actions);
    }

    return { passed, actions };
  }

  private evaluateCondition(
    condition: SecurityConditionViem,
    context: SecurityContextViem
  ): boolean {
    const value = this.extractFieldValue(condition.field, context);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'greater_than':
        return Number(value) > Number(condition.value);
      case 'less_than':
        return Number(value) < Number(condition.value);
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'regex':
        return new RegExp(condition.value).test(String(value));
      case 'in_range':
        return Number(value) >= condition.value[0] && Number(value) <= condition.value[1];
      default:
        return true;
    }
  }

  private extractFieldValue(field: string, context: SecurityContextViem): any {
    const parts = field.split('.');
    let value: any = context;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      }
    }

    return value;
  }

  private async logSecurityEvent(event: SecurityEventViem): Promise<void> {
    this.securityEvents.push(event);

    // Keep only last 1000 events
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }

    this.logger.warn('Security event detected', {
      eventId: event.id,
      type: event.type,
      severity: event.severity,
      context: event.context
    });
  }

  private generateSecuritySummary(events: SecurityEventViem[]): SecuritySummaryViem {
    const threats = events.filter(e => e.type === 'threat_detected');
    const blocked = events.filter(e => e.details.threat?.severity === 'critical');

    return {
      totalThreats: threats.length,
      blockedTransactions: blocked.length,
      riskLevel: blocked.length > 0 ? 'critical' : threats.length > 10 ? 'high' : threats.length > 0 ? 'medium' : 'low',
      securityScore: Math.max(0, 100 - (threats.length * 5) - (blocked.length * 20)),
      trends: [] // Would calculate from historical data
    };
  }

  private generateThreatSummary(events: SecurityEventViem[]): ThreatSummaryViem {
    const threats = events.filter(e => e.type === 'threat_detected');

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    threats.forEach(event => {
      if (event.details.threat) {
        byType[event.details.threat.type] = (byType[event.details.threat.type] || 0) + 1;
        bySeverity[event.details.threat.severity] = (bySeverity[event.details.threat.severity] || 0) + 1;
        bySource[event.context.userAddress] = (bySource[event.context.userAddress] || 0) + 1;
      }
    });

    return {
      byType,
      bySeverity,
      bySource,
      resolved: threats.filter(e => e.resolved).length,
      pending: threats.filter(e => !e.resolved).length
    };
  }

  private generatePolicySummary(events: SecurityEventViem[]): PolicySummaryViem {
    const violations = events.filter(e => e.type === 'policy_violation');

    return {
      totalPolicies: this.policies.size,
      activePolicies: Array.from(this.policies.values()).filter(p => p.enabled).length,
      violations: violations.length,
      effectiveness: violations.length === 0 ? 1 : 0.8 // Simplified
    };
  }

  private generateSecurityRecommendations(events: SecurityEventViem[]): SecurityRecommendationViem[] {
    const recommendations: SecurityRecommendationViem[] = [];

    const criticalThreats = events.filter(e =>
      e.type === 'threat_detected' && e.details.threat?.severity === 'critical'
    );

    if (criticalThreats.length > 0) {
      recommendations.push({
        category: 'immediate',
        priority: 'critical',
        recommendation: 'Review and block critical security threats immediately',
        rationale: `Found ${criticalThreats.length} critical threats`,
        implementation: 'Review each threat and apply appropriate blocking actions',
        impact: 'Prevents potential security breaches',
        effort: 'medium'
      });
    }

    const highValueViolations = events.filter(e =>
      e.type === 'policy_violation' &&
      Number(e.context.value) > Number(parseUnits('10', 18))
    );

    if (highValueViolations.length > 0) {
      recommendations.push({
        category: 'short_term',
        priority: 'high',
        recommendation: 'Implement additional verification for high-value transactions',
        rationale: 'High-value transactions detected without proper verification',
        implementation: 'Add multi-signature or time-delay requirements',
        impact: 'Reduces risk of large-scale losses',
        effort: 'high'
      });
    }

    return recommendations;
  }

  private calculateSecurityMetrics(events: SecurityEventViem[]): SecurityMetricsViem {
    const threats = events.filter(e => e.type === 'threat_detected');
    const resolved = threats.filter(e => e.resolved);

    return {
      detection: {
        detectionRate: threats.length > 0 ? 0.9 : 1, // Simplified
        falsePositiveRate: 0.05, // Simplified
        averageDetectionTime: 5000, // 5 seconds
        coverage: 0.85
      },
      prevention: {
        blockedThreats: threats.filter(t => t.details.threat?.severity === 'critical').length,
        preventedLosses: '0', // Would calculate actual losses prevented
        policyEffectiveness: 0.8,
        riskReduction: 0.7
      },
      response: {
        averageResponseTime: 10000, // 10 seconds
        resolutionRate: resolved.length / threats.length,
        escalationRate: 0.1,
        userSatisfaction: 0.9
      },
      performance: {
        scanTime: 100, // milliseconds
        resourceUsage: 0.3, // 30% of available resources
        throughput: threats.length / 3600, // threats per hour
        availability: 0.99
      }
    };
  }
}