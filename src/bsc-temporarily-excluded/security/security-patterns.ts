import { Logger } from '../../../utils/logger.js';
import { ethers } from 'ethers';
import { ICache } from '../../../services/cache.service.js';

const logger = new Logger('BscSecurityPatterns');

// Security pattern types and interfaces
export interface SecurityPattern {
  id: string;
  name: string;
  description: string;
  category: 'address_validation' | 'transaction_validation' | 'contract_validation' | 'gas_security' | 'timing_security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  config: SecurityPatternConfig;
}

export interface SecurityPatternConfig {
  parameters: { [key: string]: any };
  thresholds: { [key: string]: number };
  actions: SecurityAction[];
  notifications: SecurityNotification[];
}

export interface SecurityAction {
  type: 'block' | 'warn' | 'log' | 'quarantine' | 'require_approval';
  condition: string;
  parameters?: { [key: string]: any };
}

export interface SecurityNotification {
  type: 'email' | 'webhook' | 'slack' | 'telegram';
  recipients: string[];
  template: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface AddressValidationResult {
  isValid: boolean;
  isWhitelisted: boolean;
  isBlacklisted: boolean;
  riskScore: number;
  warnings: string[];
  recommendations: string[];
  metadata: {
    type: 'contract' | 'eoa' | 'factory';
    age: number;
    transactionCount: number;
    balance: string;
    verified: boolean;
  };
}

export interface TransactionValidationResult {
  isValid: boolean;
  riskScore: number;
  threats: SecurityThreat[];
  warnings: string[];
  recommendations: string[];
  gasAnalysis: GasSecurityAnalysis;
  timingAnalysis: TimingSecurityAnalysis;
}

export interface SecurityThreat {
  type: 'front_running' | 'sandwich_attack' | 'flash_loan_attack' | 'honeypot' | 'rug_pull' | 'phishing';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
  indicators: string[];
  mitigation: string;
}

export interface GasSecurityAnalysis {
  isValid: boolean;
  gasPrice: number;
  gasLimit: number;
  estimatedGasCost: number;
  threats: {
    gasGouging: boolean;
    unusualGasLimit: boolean;
    gasManipulation: boolean;
  };
  recommendations: string[];
}

export interface TimingSecurityAnalysis {
  isValid: boolean;
  timestamp: number;
  blockTimestamp: number;
  delay: number;
  threats: {
    flashCrashTiming: boolean;
    mevTiming: boolean;
    unusualActivity: boolean;
  };
  recommendations: string[];
}

export interface ContractSecurityResult {
  isValid: boolean;
  address: string;
  verificationStatus: 'verified' | 'unverified' | 'error';
  auditStatus: 'audited' | 'unaudited' | 'unknown';
  riskScore: number;
  vulnerabilities: ContractVulnerability[];
  warnings: string[];
  recommendations: string[];
}

export interface ContractVulnerability {
  type: 'reentrancy' | 'integer_overflow' | 'access_control' | 'logic_error' | 'gas_limit';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: string;
  impact: string;
  mitigation: string;
}

export interface SecurityContext {
  userAddress: string;
  transactionType: string;
  contractAddress: string;
  value: string;
  gasPrice: string;
  gasLimit: string;
  timestamp: number;
  networkId: number;
  metadata: { [key: string]: any };
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  patterns: string[];
  conditions: SecurityCondition[];
  actions: SecurityAction[];
  priority: number;
}

export interface SecurityCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'regex';
  value: any;
  required: boolean;
}

export class BscSecurityPatterns {
  private patterns: Map<string, SecurityPattern> = new Map();
  private policies: Map<string, SecurityPolicy> = new Map();
  private blacklistedAddresses: Set<string> = new Set();
  private whitelistedAddresses: Set<string> = new Set();
  private verifiedContracts: Set<string> = new Set();
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor(private cacheService: ICache) {
    this.initializeDefaultPatterns();
    this.initializeDefaultPolicies();
  }

  // Address validation
  async validateAddress(address: string, context?: SecurityContext): Promise<AddressValidationResult> {
    try {
      logger.info(`Validating address: ${address}`);

      // Check cache first
      const cacheKey = `address_validation_${address}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Basic address format validation
      if (!ethers.utils.isAddress(address)) {
        return {
          isValid: false,
          isWhitelisted: false,
          isBlacklisted: false,
          riskScore: 100,
          warnings: ['Invalid address format'],
          recommendations: ['Use a valid Ethereum address'],
          metadata: {
            type: 'eoa',
            age: 0,
            transactionCount: 0,
            balance: '0',
            verified: false
          }
        };
      }

      const normalizedAddress = address.toLowerCase();

      // Check blacklist
      const isBlacklisted = this.blacklistedAddresses.has(normalizedAddress);
      if (isBlacklisted) {
        return {
          isValid: false,
          isWhitelisted: false,
          isBlacklisted: true,
          riskScore: 100,
          warnings: ['Address is blacklisted'],
          recommendations: ['Avoid interacting with this address'],
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

      // Get address metadata (this would typically involve blockchain queries)
      const metadata = await this.getAddressMetadata(address);

      // Calculate risk score
      const riskScore = this.calculateAddressRiskScore(metadata, isWhitelisted);

      // Generate warnings and recommendations
      const warnings = this.generateAddressWarnings(metadata, riskScore);
      const recommendations = this.generateAddressRecommendations(metadata, riskScore);

      const result: AddressValidationResult = {
        isValid: riskScore < 80,
        isWhitelisted,
        isBlacklisted,
        riskScore,
        warnings,
        recommendations,
        metadata
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(result), this.CACHE_TTL);

      logger.info(`Address validation completed`, {
        address,
        isValid: result.isValid,
        riskScore
      });

      return result;
    } catch (error) {
      logger.error('Failed to validate address', {
        error: error.message,
        address
      });
      throw error;
    }
  }

  // Transaction validation
  async validateTransaction(
    to: string,
    value: string,
    data: string,
    gasPrice: string,
    gasLimit: string,
    context: SecurityContext
  ): Promise<TransactionValidationResult> {
    try {
      logger.info(`Validating transaction`, { to, value, gasPrice });

      // Validate recipient address
      const addressValidation = await this.validateAddress(to, context);
      if (!addressValidation.isValid) {
        return {
          isValid: false,
          riskScore: 100,
          threats: [{
            type: 'phishing',
            severity: 'critical',
            confidence: 95,
            description: 'Transaction to blacklisted address',
            indicators: ['Blacklisted address'],
            mitigation: 'Cancel transaction'
          }],
          warnings: addressValidation.warnings,
          recommendations: addressValidation.recommendations,
          gasAnalysis: {
            isValid: false,
            gasPrice: parseFloat(gasPrice),
            gasLimit: parseInt(gasLimit),
            estimatedGasCost: 0,
            threats: {
              gasGouging: false,
              unusualGasLimit: false,
              gasManipulation: false
            },
            recommendations: []
          },
          timingAnalysis: {
            isValid: true,
            timestamp: Date.now(),
            blockTimestamp: 0,
            delay: 0,
            threats: {
              flashCrashTiming: false,
              mevTiming: false,
              unusualActivity: false
            },
            recommendations: []
          }
        };
      }

      // Analyze gas security
      const gasAnalysis = await this.analyzeGasSecurity(
        parseFloat(gasPrice),
        parseInt(gasLimit),
        to,
        data
      );

      // Analyze timing security
      const timingAnalysis = await this.analyzeTimingSecurity(context);

      // Detect threats
      const threats = await this.detectTransactionThreats(
        to,
        value,
        data,
        context,
        gasAnalysis,
        timingAnalysis
      );

      // Calculate overall risk score
      const riskScore = this.calculateTransactionRiskScore(
        addressValidation,
        gasAnalysis,
        timingAnalysis,
        threats
      );

      // Generate warnings and recommendations
      const warnings = this.generateTransactionWarnings(
        addressValidation,
        gasAnalysis,
        timingAnalysis,
        threats
      );
      const recommendations = this.generateTransactionRecommendations(
        addressValidation,
        gasAnalysis,
        timingAnalysis,
        threats
      );

      const result: TransactionValidationResult = {
        isValid: riskScore < 75 && gasAnalysis.isValid && timingAnalysis.isValid,
        riskScore,
        threats,
        warnings,
        recommendations,
        gasAnalysis,
        timingAnalysis
      };

      logger.info(`Transaction validation completed`, {
        to,
        isValid: result.isValid,
        riskScore
      });

      return result;
    } catch (error) {
      logger.error('Failed to validate transaction', {
        error: error.message,
        to
      });
      throw error;
    }
  }

  // Contract validation
  async validateContract(address: string): Promise<ContractSecurityResult> {
    try {
      logger.info(`Validating contract: ${address}`);

      // Check cache first
      const cacheKey = `contract_validation_${address}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Check if contract is verified
      const verificationStatus = await this.checkContractVerification(address);

      // Check if contract has been audited
      const auditStatus = await this.checkContractAuditStatus(address);

      // Analyze contract for vulnerabilities
      const vulnerabilities = await this.analyzeContractVulnerabilities(address);

      // Calculate risk score
      const riskScore = this.calculateContractRiskScore(
        verificationStatus,
        auditStatus,
        vulnerabilities
      );

      // Generate warnings and recommendations
      const warnings = this.generateContractWarnings(
        verificationStatus,
        auditStatus,
        vulnerabilities
      );
      const recommendations = this.generateContractRecommendations(
        verificationStatus,
        auditStatus,
        vulnerabilities
      );

      const result: ContractSecurityResult = {
        isValid: riskScore < 70 && verificationStatus === 'verified',
        address,
        verificationStatus,
        auditStatus,
        riskScore,
        vulnerabilities,
        warnings,
        recommendations
      };

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(result), this.CACHE_TTL);

      logger.info(`Contract validation completed`, {
        address,
        isValid: result.isValid,
        riskScore
      });

      return result;
    } catch (error) {
      logger.error('Failed to validate contract', {
        error: error.message,
        address
      });
      throw error;
    }
  }

  // Security pattern management
  async addPattern(pattern: SecurityPattern): Promise<void> {
    try {
      this.patterns.set(pattern.id, pattern);
      logger.info(`Security pattern added: ${pattern.id}`);
    } catch (error) {
      logger.error('Failed to add security pattern', {
        error: error.message,
        patternId: pattern.id
      });
      throw error;
    }
  }

  async updatePattern(patternId: string, updates: Partial<SecurityPattern>): Promise<void> {
    try {
      const existingPattern = this.patterns.get(patternId);
      if (!existingPattern) {
        throw new Error(`Security pattern not found: ${patternId}`);
      }

      const updatedPattern = { ...existingPattern, ...updates };
      this.patterns.set(patternId, updatedPattern);
      logger.info(`Security pattern updated: ${patternId}`);
    } catch (error) {
      logger.error('Failed to update security pattern', {
        error: error.message,
        patternId
      });
      throw error;
    }
  }

  async removePattern(patternId: string): Promise<void> {
    try {
      const deleted = this.patterns.delete(patternId);
      if (!deleted) {
        throw new Error(`Security pattern not found: ${patternId}`);
      }
      logger.info(`Security pattern removed: ${patternId}`);
    } catch (error) {
      logger.error('Failed to remove security pattern', {
        error: error.message,
        patternId
      });
      throw error;
    }
  }

  // Policy management
  async addPolicy(policy: SecurityPolicy): Promise<void> {
    try {
      this.policies.set(policy.id, policy);
      logger.info(`Security policy added: ${policy.id}`);
    } catch (error) {
      logger.error('Failed to add security policy', {
        error: error.message,
        policyId: policy.id
      });
      throw error;
    }
  }

  async evaluatePolicies(context: SecurityContext): Promise<{
    policies: SecurityPolicy[];
    actions: SecurityAction[];
    riskScore: number;
    blocked: boolean;
  }> {
    try {
      const applicablePolicies: SecurityPolicy[] = [];
      const triggeredActions: SecurityAction[] = [];
      let maxRiskScore = 0;
      let blocked = false;

      for (const policy of this.policies.values()) {
        if (!policy.enabled) continue;

        // Check if policy conditions are met
        const conditionsMet = await this.evaluatePolicyConditions(policy.conditions, context);
        if (conditionsMet) {
          applicablePolicies.push(policy);
          triggeredActions.push(...policy.actions);

          // Update risk score based on policy priority
          maxRiskScore = Math.max(maxRiskScore, policy.priority);

          // Check if any action blocks the transaction
          if (policy.actions.some(action => action.type === 'block')) {
            blocked = true;
          }
        }
      }

      return {
        policies: applicablePolicies,
        actions: triggeredActions,
        riskScore: maxRiskScore,
        blocked
      };
    } catch (error) {
      logger.error('Failed to evaluate security policies', {
        error: error.message,
        context
      });
      throw error;
    }
  }

  // Address list management
  async addToBlacklist(address: string, reason?: string): Promise<void> {
    try {
      const normalizedAddress = address.toLowerCase();
      this.blacklistedAddresses.add(normalizedAddress);
      logger.info(`Address added to blacklist: ${address}`, { reason });
    } catch (error) {
      logger.error('Failed to add address to blacklist', {
        error: error.message,
        address
      });
      throw error;
    }
  }

  async removeFromBlacklist(address: string): Promise<void> {
    try {
      const normalizedAddress = address.toLowerCase();
      this.blacklistedAddresses.delete(normalizedAddress);
      logger.info(`Address removed from blacklist: ${address}`);
    } catch (error) {
      logger.error('Failed to remove address from blacklist', {
        error: error.message,
        address
      });
      throw error;
    }
  }

  async addToWhitelist(address: string, reason?: string): Promise<void> {
    try {
      const normalizedAddress = address.toLowerCase();
      this.whitelistedAddresses.add(normalizedAddress);
      logger.info(`Address added to whitelist: ${address}`, { reason });
    } catch (error) {
      logger.error('Failed to add address to whitelist', {
        error: error.message,
        address
      });
      throw error;
    }
  }

  async removeFromWhitelist(address: string): Promise<void> {
    try {
      const normalizedAddress = address.toLowerCase();
      this.whitelistedAddresses.delete(normalizedAddress);
      logger.info(`Address removed from whitelist: ${address}`);
    } catch (error) {
      logger.error('Failed to remove address from whitelist', {
        error: error.message,
        address
      });
      throw error;
    }
  }

  // Private helper methods
  private initializeDefaultPatterns(): void {
    // Address validation patterns
    this.patterns.set('blacklist_check', {
      id: 'blacklist_check',
      name: 'Blacklist Address Check',
      description: 'Check if address is blacklisted',
      category: 'address_validation',
      severity: 'critical',
      enabled: true,
      config: {
        parameters: {},
        thresholds: {},
        actions: [{
          type: 'block',
          condition: 'address_blacklisted',
          parameters: { reason: 'Address is blacklisted' }
        }],
        notifications: []
      }
    });

    // Gas security patterns
    this.patterns.set('gas_price_validation', {
      id: 'gas_price_validation',
      name: 'Gas Price Validation',
      description: 'Validate gas price against market rates',
      category: 'gas_security',
      severity: 'medium',
      enabled: true,
      config: {
        parameters: { max_multiplier: 2.0 },
        thresholds: { max_gas_price_gwei: 100 },
        actions: [{
          type: 'warn',
          condition: 'gas_price_too_high',
          parameters: { message: 'Gas price is unusually high' }
        }],
        notifications: []
      }
    });

    // Timing security patterns
    this.patterns.set('timing_validation', {
      id: 'timing_validation',
      name: 'Transaction Timing Validation',
      description: 'Validate transaction timing for MEV protection',
      category: 'timing_security',
      severity: 'medium',
      enabled: true,
      config: {
        parameters: { max_delay_ms: 5000 },
        thresholds: {},
        actions: [{
          type: 'warn',
          condition: 'timing_suspicious',
          parameters: { message: 'Transaction timing may be vulnerable to MEV' }
        }],
        notifications: []
      }
    });
  }

  private initializeDefaultPolicies(): void {
    // High-value transaction policy
    this.policies.set('high_value_protection', {
      id: 'high_value_protection',
      name: 'High-Value Transaction Protection',
      description: 'Additional security for high-value transactions',
      enabled: true,
      patterns: ['gas_price_validation', 'timing_validation'],
      conditions: [
        {
          field: 'value',
          operator: 'greater_than',
          value: ethers.utils.parseEther('10').toString(),
          required: true
        }
      ],
      actions: [
        {
          type: 'require_approval',
          condition: 'value_high',
          parameters: { minApprovals: 2 }
        }
      ],
      priority: 80
    });

    // Untrusted address policy
    this.policies.set('untrusted_address_protection', {
      id: 'untrusted_address_protection',
      name: 'Untrusted Address Protection',
      description: 'Additional validation for untrusted addresses',
      enabled: true,
      patterns: ['blacklist_check'],
      conditions: [
        {
          field: 'contractAddress',
          operator: 'not_equals',
          value: '',
          required: true
        }
      ],
      actions: [
        {
          type: 'warn',
          condition: 'contract_unverified',
          parameters: { message: 'Interacting with unverified contract' }
        }
      ],
      priority: 60
    });
  }

  private async getAddressMetadata(address: string): Promise<AddressValidationResult['metadata']> {
    // Simplified metadata retrieval - in production would use blockchain queries
    const timestamp = Date.now();
    const randomAge = Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000); // Random age in ms
    const creationDate = timestamp - randomAge;

    return {
      type: 'contract', // Simplified
      age: creationDate,
      transactionCount: Math.floor(Math.random() * 1000),
      balance: ethers.utils.parseEther((Math.random() * 100).toString()).toString(),
      verified: this.verifiedContracts.has(address.toLowerCase())
    };
  }

  private calculateAddressRiskScore(
    metadata: AddressValidationResult['metadata'],
    isWhitelisted: boolean
  ): number {
    let score = 0;

    if (isWhitelisted) {
      return 0; // Whitelisted addresses have zero risk
    }

    // Age-based risk
    const ageInDays = (Date.now() - metadata.age) / (1000 * 60 * 60 * 24);
    if (ageInDays < 7) score += 30; // New addresses are higher risk
    else if (ageInDays < 30) score += 15;

    // Transaction count risk
    if (metadata.transactionCount < 10) score += 20;
    else if (metadata.transactionCount < 100) score += 10;

    // Verification risk
    if (!metadata.verified && metadata.type === 'contract') score += 25;

    // Balance risk (very low or very high balances can be suspicious)
    const balanceEth = parseFloat(ethers.utils.formatEther(metadata.balance));
    if (balanceEth < 0.01) score += 10;
    else if (balanceEth > 10000) score += 15;

    return Math.min(100, score);
  }

  private generateAddressWarnings(
    metadata: AddressValidationResult['metadata'],
    riskScore: number
  ): string[] {
    const warnings: string[] = [];

    const ageInDays = (Date.now() - metadata.age) / (1000 * 60 * 60 * 24);
    if (ageInDays < 7) {
      warnings.push('Address was created recently');
    }

    if (metadata.transactionCount < 10) {
      warnings.push('Address has few transactions');
    }

    if (!metadata.verified && metadata.type === 'contract') {
      warnings.push('Contract is not verified');
    }

    if (riskScore > 70) {
      warnings.push('Address has high risk score');
    }

    return warnings;
  }

  private generateAddressRecommendations(
    metadata: AddressValidationResult['metadata'],
    riskScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (!metadata.verified && metadata.type === 'contract') {
      recommendations.push('Verify the contract source code before interacting');
    }

    const ageInDays = (Date.now() - metadata.age) / (1000 * 60 * 60 * 24);
    if (ageInDays < 7) {
      recommendations.push('Exercise caution with newly created addresses');
    }

    if (metadata.transactionCount < 10) {
      recommendations.push('Consider the transaction history before proceeding');
    }

    if (riskScore > 50) {
      recommendations.push('Review all details carefully before proceeding');
    }

    return recommendations;
  }

  private async analyzeGasSecurity(
    gasPrice: number,
    gasLimit: number,
    to: string,
    data: string
  ): Promise<GasSecurityAnalysis> {
    // Get current market gas price (simplified)
    const marketGasPrice = 20e9; // 20 Gwei

    const gasPriceGwei = gasPrice / 1e9;
    const estimatedGasCost = (gasPrice * gasLimit) / 1e18;

    const threats = {
      gasGouging: gasPriceGwei > (marketGasPrice / 1e9) * 3, // 3x market rate
      unusualGasLimit: gasLimit > 1000000, // Very high gas limit
      gasManipulation: gasPriceGwei < (marketGasPrice / 1e9) * 0.5 // Unusually low gas price
    };

    const recommendations: string[] = [];
    if (threats.gasGouging) {
      recommendations.push('Gas price is unusually high, consider waiting');
    }
    if (threats.unusualGasLimit) {
      recommendations.push('Gas limit is unusually high, verify transaction parameters');
    }
    if (threats.gasManipulation) {
      recommendations.push('Gas price is unusually low, transaction may be stuck');
    }

    return {
      isValid: !threats.gasGouging && !threats.unusualGasLimit,
      gasPrice,
      gasLimit,
      estimatedGasCost,
      threats,
      recommendations
    };
  }

  private async analyzeTimingSecurity(context: SecurityContext): Promise<TimingSecurityAnalysis> {
    const currentTime = Date.now();
    const delay = currentTime - context.timestamp;

    // Simplified timing analysis
    const threats = {
      flashCrashTiming: false, // Would check market conditions
      mevTiming: delay < 1000, // Very recent transaction may be vulnerable to MEV
      unusualActivity: false // Would check for unusual network activity
    };

    const recommendations: string[] = [];
    if (threats.mevTiming) {
      recommendations.push('Transaction may be vulnerable to MEV attacks');
    }

    return {
      isValid: !threats.flashCrashTiming && !threats.mevTiming,
      timestamp: currentTime,
      blockTimestamp: context.timestamp,
      delay,
      threats,
      recommendations
    };
  }

  private async detectTransactionThreats(
    to: string,
    value: string,
    data: string,
    context: SecurityContext,
    gasAnalysis: GasSecurityAnalysis,
    timingAnalysis: TimingSecurityAnalysis
  ): Promise<SecurityThreat[]> {
    const threats: SecurityThreat[] = [];

    // Check for front-running risk
    if (timingAnalysis.threats.mevTiming) {
      threats.push({
        type: 'front_running',
        severity: 'medium',
        confidence: 70,
        description: 'Transaction timing suggests potential front-running risk',
        indicators: ['Recent transaction submission', 'High value transfer'],
        mitigation: 'Consider using private mempool or delay submission'
      });
    }

    // Check for sandwich attack risk
    if (context.transactionType === 'swap' && parseFloat(value) > ethers.utils.parseEther('1')) {
      threats.push({
        type: 'sandwich_attack',
        severity: 'medium',
        confidence: 60,
        description: 'Large swap transaction may be vulnerable to sandwich attacks',
        indicators: ['Large swap amount', 'DEX interaction'],
        mitigation: 'Consider using MEV protection or smaller transactions'
      });
    }

    // Check for phishing/honeypot risk
    const contractValidation = await this.validateContract(to);
    if (!contractValidation.isValid) {
      threats.push({
        type: 'honeypot',
        severity: 'high',
        confidence: 80,
        description: 'Contract has security issues that may indicate a honeypot',
        indicators: ['Unverified contract', 'High risk score'],
        mitigation: 'Avoid interacting with this contract'
      });
    }

    return threats;
  }

  private calculateTransactionRiskScore(
    addressValidation: AddressValidationResult,
    gasAnalysis: GasSecurityAnalysis,
    timingAnalysis: TimingSecurityAnalysis,
    threats: SecurityThreat[]
  ): number {
    let score = 0;

    // Address risk
    score += addressValidation.riskScore * 0.4;

    // Gas risk
    if (gasAnalysis.threats.gasGouging) score += 20;
    if (gasAnalysis.threats.unusualGasLimit) score += 15;
    if (gasAnalysis.threats.gasManipulation) score += 10;

    // Timing risk
    if (timingAnalysis.threats.mevTiming) score += 15;
    if (timingAnalysis.threats.flashCrashTiming) score += 25;

    // Threat risk
    threats.forEach(threat => {
      switch (threat.severity) {
        case 'critical': score += 40; break;
        case 'high': score += 30; break;
        case 'medium': score += 20; break;
        case 'low': score += 10; break;
      }
    });

    return Math.min(100, score);
  }

  private generateTransactionWarnings(
    addressValidation: AddressValidationResult,
    gasAnalysis: GasSecurityAnalysis,
    timingAnalysis: TimingSecurityAnalysis,
    threats: SecurityThreat[]
  ): string[] {
    const warnings: string[] = [];

    warnings.push(...addressValidation.warnings);
    warnings.push(...gasAnalysis.recommendations);
    warnings.push(...timingAnalysis.recommendations);

    threats.forEach(threat => {
      warnings.push(`Potential ${threat.type}: ${threat.description}`);
    });

    return warnings;
  }

  private generateTransactionRecommendations(
    addressValidation: AddressValidationResult,
    gasAnalysis: GasSecurityAnalysis,
    timingAnalysis: TimingSecurityAnalysis,
    threats: SecurityThreat[]
  ): string[] {
    const recommendations: string[] = [];

    recommendations.push(...addressValidation.recommendations);

    if (gasAnalysis.threats.gasGouging) {
      recommendations.push('Wait for gas prices to normalize');
    }

    if (timingAnalysis.threats.mevTiming) {
      recommendations.push('Consider using MEV protection services');
    }

    threats.forEach(threat => {
      recommendations.push(threat.mitigation);
    });

    return recommendations;
  }

  private async checkContractVerification(address: string): Promise<'verified' | 'unverified' | 'error'> {
    // Simplified check - in production would query BscScan API
    return this.verifiedContracts.has(address.toLowerCase()) ? 'verified' : 'unverified';
  }

  private async checkContractAuditStatus(address: string): Promise<'audited' | 'unaudited' | 'unknown'> {
    // Simplified check - in production would query audit databases
    return 'unknown';
  }

  private async analyzeContractVulnerabilities(address: string): Promise<ContractVulnerability[]> {
    // Simplified vulnerability analysis - in production would use security tools
    return [];
  }

  private calculateContractRiskScore(
    verificationStatus: 'verified' | 'unverified' | 'error',
    auditStatus: 'audited' | 'unaudited' | 'unknown',
    vulnerabilities: ContractVulnerability[]
  ): number {
    let score = 0;

    if (verificationStatus !== 'verified') {
      score += 40;
    }

    if (auditStatus === 'unaudited') {
      score += 20;
    }

    vulnerabilities.forEach(vuln => {
      switch (vuln.severity) {
        case 'critical': score += 50; break;
        case 'high': score += 30; break;
        case 'medium': score += 15; break;
        case 'low': score += 5; break;
      }
    });

    return Math.min(100, score);
  }

  private generateContractWarnings(
    verificationStatus: 'verified' | 'unverified' | 'error',
    auditStatus: 'audited' | 'unaudited' | 'unknown',
    vulnerabilities: ContractVulnerability[]
  ): string[] {
    const warnings: string[] = [];

    if (verificationStatus !== 'verified') {
      warnings.push('Contract source code is not verified');
    }

    if (auditStatus === 'unaudited') {
      warnings.push('Contract has not been professionally audited');
    }

    vulnerabilities.forEach(vuln => {
      warnings.push(`Vulnerability detected: ${vuln.description}`);
    });

    return warnings;
  }

  private generateContractRecommendations(
    verificationStatus: 'verified' | 'unverified' | 'error',
    auditStatus: 'audited' | 'unaudited' | 'unknown',
    vulnerabilities: ContractVulnerability[]
  ): string[] {
    const recommendations: string[] = [];

    if (verificationStatus !== 'verified') {
      recommendations.push('Request contract verification from the deployer');
    }

    if (auditStatus === 'unaudited') {
      recommendations.push('Consider professional security audit');
    }

    if (vulnerabilities.length > 0) {
      recommendations.push('Address identified vulnerabilities before use');
    }

    return recommendations;
  }

  private async evaluatePolicyConditions(
    conditions: SecurityCondition[],
    context: SecurityContext
  ): Promise<boolean> {
    for (const condition of conditions) {
      const fieldValue = this.getFieldValue(context, condition.field);
      const conditionMet = this.evaluateCondition(fieldValue, condition.operator, condition.value);

      if (condition.required && !conditionMet) {
        return false;
      }

      if (!condition.required && conditionMet) {
        return true;
      }
    }

    return true;
  }

  private getFieldValue(context: SecurityContext, field: string): any {
    switch (field) {
      case 'userAddress': return context.userAddress;
      case 'transactionType': return context.transactionType;
      case 'contractAddress': return context.contractAddress;
      case 'value': return context.value;
      case 'gasPrice': return context.gasPrice;
      case 'gasLimit': return context.gasLimit;
      case 'timestamp': return context.timestamp;
      case 'networkId': return context.networkId;
      default: return context.metadata[field];
    }
  }

  private evaluateCondition(
    fieldValue: any,
    operator: SecurityCondition['operator'],
    conditionValue: any
  ): boolean {
    switch (operator) {
      case 'equals': return fieldValue === conditionValue;
      case 'not_equals': return fieldValue !== conditionValue;
      case 'greater_than': return parseFloat(fieldValue) > parseFloat(conditionValue);
      case 'less_than': return parseFloat(fieldValue) < parseFloat(conditionValue);
      case 'contains': return String(fieldValue).includes(String(conditionValue));
      case 'regex': return new RegExp(conditionValue).test(String(fieldValue));
      default: return false;
    }
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      patternsLoaded: number;
      policiesLoaded: number;
      blacklistSize: number;
      whitelistSize: number;
      verifiedContracts: number;
      cacheEnabled: boolean;
    };
  }> {
    try {
      const status = this.patterns.size > 0 && this.policies.size > 0 ? 'healthy' : 'degraded';

      return {
        status,
        details: {
          patternsLoaded: this.patterns.size,
          policiesLoaded: this.policies.size,
          blacklistSize: this.blacklistedAddresses.size,
          whitelistSize: this.whitelistedAddresses.size,
          verifiedContracts: this.verifiedContracts.size,
          cacheEnabled: this.cacheService !== null
        }
      };
    } catch (error) {
      logger.error('Security patterns health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        details: {
          patternsLoaded: 0,
          policiesLoaded: 0,
          blacklistSize: 0,
          whitelistSize: 0,
          verifiedContracts: 0,
          cacheEnabled: false
        }
      };
    }
  }
}

// Factory function
export function createBscSecurityPatterns(cacheService: ICache): BscSecurityPatterns {
  return new BscSecurityPatterns(cacheService);
}