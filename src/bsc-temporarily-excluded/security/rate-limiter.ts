import { Logger } from '../../../utils/logger.js';
import { EventEmitter } from 'events';
import { ICache } from '../../../services/cache.service.js';

const logger = new Logger('RateLimiter');

// Rate limiting types and interfaces
export interface RateLimitConfig {
  enabled: boolean;
  rules: RateLimitRule[];
  globalLimits: GlobalLimits;
  antiAbuse: AntiAbuseConfig;
  storage: RateLimitStorage;
  notifications: NotificationConfig;
}

export interface RateLimitRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  target: RateLimitTarget;
  limits: RateLimit[];
  action: RateLimitAction;
  conditions: RateLimitCondition[];
}

export interface RateLimitTarget {
  type: 'global' | 'user' | 'ip' | 'wallet' | 'endpoint' | 'function' | 'token' | 'contract';
  identifier?: string; // specific IP, address, etc.
  scope: 'all' | 'authenticated' | 'unauthenticated';
}

export interface RateLimit {
  windowMs: number;
  maxRequests: number;
  blockDurationMs?: number;
  penaltyMultiplier?: number;
}

export interface RateLimitAction {
  type: 'block' | 'warn' | 'throttle' | 'challenge' | 'queue' | 'custom';
  parameters?: { [key: string]: any };
  message?: string;
}

export interface RateLimitCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'regex';
  value: any;
}

export interface GlobalLimits {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  concurrentConnections: number;
  payloadSizeMax: number;
}

export interface AntiAbuseConfig {
  enabled: boolean;
  suspiciousPatterns: SuspiciousPattern[];
  behavioralAnalysis: BehavioralAnalysisConfig;
  ipReputation: IPReputationConfig;
  deviceFingerprinting: DeviceFingerprintingConfig;
  automatedDetection: AutomatedDetectionConfig;
}

export interface SuspiciousPattern {
  id: string;
  name: string;
  pattern: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: string;
  confidence: number;
}

export interface BehavioralAnalysisConfig {
  enabled: boolean;
  trackingDurationMs: number;
  anomalyThreshold: number;
  baselines: BehaviorBaseline[];
}

export interface BehaviorBaseline {
  metric: string;
  normalRange: { min: number; max: number };
  weight: number;
}

export interface IPReputationConfig {
  enabled: boolean;
  providers: string[];
  cacheDurationMs: number;
  defaultReputation: 'trusted' | 'neutral' | 'suspicious' | 'malicious';
  blacklistSources: string[];
}

export interface DeviceFingerprintingConfig {
  enabled: boolean;
  trackingFields: string[];
  similarityThreshold: number;
  cacheDurationMs: number;
}

export interface AutomatedDetectionConfig {
  enabled: boolean;
  machineLearning: boolean;
  heuristics: HeuristicRule[];
  falsePositiveRate: number;
}

export interface HeuristicRule {
  id: string;
  name: string;
  conditions: HeuristicCondition[];
  severity: number;
  confidence: number;
}

export interface HeuristicCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'in' | 'not_in';
  value: any;
  weight: number;
}

export interface NotificationConfig {
  email: EmailNotificationConfig;
  webhook: WebhookNotificationConfig;
  slack: SlackNotificationConfig;
  alertThresholds: AlertThresholds;
}

export interface EmailNotificationConfig {
  enabled: boolean;
  recipients: string[];
  templates: { [key: string]: string };
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

export interface AlertThresholds {
  rateLimitExceeded: boolean;
  suspiciousActivity: boolean;
  abuseDetected: boolean;
  systemOverload: boolean;
}

export interface RateLimitRequest {
  identifier: string;
  type: string;
  ip?: string;
  userAgent?: string;
  wallet?: string;
  endpoint?: string;
  payload?: any;
  timestamp: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  rule?: RateLimitRule;
  action?: RateLimitAction;
  metadata: {
    requestId: string;
    processingTime: number;
    blockedBy: string[];
    warnings: string[];
  };
}

export interface RateLimitMetrics {
  totalRequests: number;
  blockedRequests: number;
  allowedRequests: number;
  averageResponseTime: number;
  topViolators: Array<{
    identifier: string;
    violations: number;
    lastViolation: number;
  }>;
  ruleStatistics: Array<{
    ruleId: string;
    ruleName: string;
    triggered: number;
    blocked: number;
  }>;
  abuseMetrics: {
    suspiciousPatterns: number;
    ipReputation: string;
    behavioralAnomalies: number;
    automatedDetections: number;
  };
  lastUpdated: number;
}

export interface RateLimitStorage {
  type: 'memory' | 'redis' | 'database';
  config: any;
}

export interface AbuseReport {
  id: string;
  timestamp: number;
  type: AbuseReportType;
  reporter: string;
  reported: string;
  evidence: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'investigating' | 'resolved' | 'false_positive';
  metadata: { [key: string]: any };
}

export type AbuseReportType =
  | 'spam'
  | 'phishing'
  | 'fraud'
  | 'automation'
  | 'ddos'
  | 'suspicious_behavior'
  | 'api_abuse'
  | 'resource_abuse';

export class RateLimiter extends EventEmitter {
  private config: RateLimitConfig;
  private rules: Map<string, RateLimitRule> = new Map();
  private metrics: RateLimitMetrics;
  private abuseReports: Map<string, AbuseReport> = new Map();
  private ipReputationCache: Map<string, IPReputation> = new Map();
  private deviceFingerprints: Map<string, DeviceFingerprint> = new Map();
  private behaviorTracking: Map<string, UserBehavior> = new Map();
  private globalCounters: Map<string, RequestCounter> = new Map();

  constructor(
    private cacheService: ICache,
    config: Partial<RateLimitConfig> = {}
  ) {
    super();

    this.config = {
      enabled: true,
      rules: [],
      globalLimits: {
        requestsPerMinute: 1000,
        requestsPerHour: 10000,
        requestsPerDay: 100000,
        concurrentConnections: 100,
        payloadSizeMax: 1048576 // 1MB
      },
      antiAbuse: {
        enabled: true,
        suspiciousPatterns: [],
        behavioralAnalysis: {
          enabled: true,
          trackingDurationMs: 3600000, // 1 hour
          anomalyThreshold: 0.8,
          baselines: []
        },
        ipReputation: {
          enabled: true,
          providers: [],
          cacheDurationMs: 300000, // 5 minutes
          defaultReputation: 'neutral',
          blacklistSources: []
        },
        deviceFingerprinting: {
          enabled: true,
          trackingFields: ['userAgent', 'acceptLanguage', 'acceptEncoding'],
          similarityThreshold: 0.8,
          cacheDurationMs: 86400000 // 24 hours
        },
        automatedDetection: {
          enabled: true,
          machineLearning: false,
          heuristics: [],
          falsePositiveRate: 0.05
        }
      },
      storage: {
        type: 'memory',
        config: {}
      },
      notifications: {
        email: { enabled: false, recipients: [], templates: {} },
        webhook: { enabled: false, endpoints: [], headers: {} },
        slack: { enabled: false, webhook: '', channel: '#security' },
        alertThresholds: {
          rateLimitExceeded: true,
          suspiciousActivity: true,
          abuseDetected: true,
          systemOverload: false
        }
      },
      ...config
    };

    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      allowedRequests: 0,
      averageResponseTime: 0,
      topViolators: [],
      ruleStatistics: [],
      abuseMetrics: {
        suspiciousPatterns: 0,
        ipReputation: 'neutral',
        behavioralAnomalies: 0,
        automatedDetections: 0
      },
      lastUpdated: Date.now()
    };

    this.initializeDefaultRules();
    this.initializeSuspiciousPatterns();
  }

  // Main rate limiting methods
  async checkRateLimit(request: RateLimitRequest): Promise<RateLimitResult> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      logger.debug(`Checking rate limit for request`, {
        requestId,
        identifier: request.identifier,
        type: request.type
      });

      // Update global counters
      this.updateGlobalCounters();

      // Perform anti-abuse checks
      if (this.config.antiAbuse.enabled) {
        const abuseResult = await this.performAbuseCheck(request);
        if (!abuseResult.allowed) {
          return this.createBlockedResult(requestId, startTime, abuseResult);
        }
      }

      // Check global limits
      const globalResult = await this.checkGlobalLimits(request);
      if (!globalResult.allowed) {
        return this.createBlockedResult(requestId, startTime, globalResult);
      }

      // Check specific rate limit rules
      const applicableRules = await this.getApplicableRules(request);
      let result: RateLimitResult | null = null;

      for (const rule of applicableRules) {
        const ruleResult = await this.checkRule(rule, request);
        if (!ruleResult.allowed) {
          result = ruleResult;
          break; // Stop at first rule that blocks
        }
      }

      // If no rule blocked, allow the request
      if (!result) {
        result = this.createAllowedResult(requestId, startTime, request);
      }

      // Update metrics
      this.updateMetrics(result, startTime);

      // Emit events
      if (!result.allowed) {
        this.emit('rateLimitExceeded', {
          request,
          result,
          rule: result.rule
        });
      }

      // Send notifications if needed
      if (!result.allowed && this.shouldSendNotification(result)) {
        await this.sendNotifications(result, request);
      }

      logger.debug(`Rate limit check completed`, {
        requestId,
        allowed: result.allowed,
        remaining: result.remaining,
        processingTime: Date.now() - startTime
      });

      return result;
    } catch (error) {
      logger.error('Rate limit check failed', {
        error: error.message,
        requestId,
        request
      });

      // Fail open - allow request on error
      return this.createErrorResult(requestId, startTime, error);
    }
  }

  // Batch rate limit checking
  async checkBatch(requests: RateLimitRequest[]): Promise<RateLimitResult[]> {
    try {
      logger.info(`Checking rate limits for batch of ${requests.length} requests`);

      const results: RateLimitResult[] = [];

      for (const request of requests) {
        const result = await this.checkRateLimit(request);
        results.push(result);
      }

      const blockedCount = results.filter(r => !r.allowed).length;
      const allowedCount = results.length - blockedCount;

      logger.info(`Batch rate limit check completed`, {
        totalRequests: requests.length,
        allowed: allowedCount,
        blocked: blockedCount
      });

      return results;
    } catch (error) {
      logger.error('Batch rate limit check failed', {
        error: error.message,
        requestCount: requests.length
      });
      throw error;
    }
  }

  // Rule management
  async addRule(rule: RateLimitRule): Promise<void> {
    try {
      this.rules.set(rule.id, rule);
      logger.info(`Rate limit rule added: ${rule.id}`);
    } catch (error) {
      logger.error('Failed to add rate limit rule', {
        error: error.message,
        ruleId: rule.id
      });
      throw error;
    }
  }

  async updateRule(ruleId: string, updates: Partial<RateLimitRule>): Promise<void> {
    try {
      const existingRule = this.rules.get(ruleId);
      if (!existingRule) {
        throw new Error(`Rate limit rule not found: ${ruleId}`);
      }

      const updatedRule = { ...existingRule, ...updates };
      this.rules.set(ruleId, updatedRule);
      logger.info(`Rate limit rule updated: ${ruleId}`);
    } catch (error) {
      logger.error('Failed to update rate limit rule', {
        error: error.message,
        ruleId
      });
      throw error;
    }
  }

  async removeRule(ruleId: string): Promise<void> {
    try {
      const deleted = this.rules.delete(ruleId);
      if (!deleted) {
        throw new Error(`Rate limit rule not found: ${ruleId}`);
      }
      logger.info(`Rate limit rule removed: ${ruleId}`);
    } catch (error) {
      logger.error('Failed to remove rate limit rule', {
        error: error.message,
        ruleId
      });
      throw error;
    }
  }

  // Abuse reporting
  async reportAbuse(report: Omit<AbuseReport, 'id' | 'timestamp' | 'status'>): Promise<string> {
    try {
      const id = this.generateReportId();

      const fullReport: AbuseReport = {
        id,
        timestamp: Date.now(),
        status: 'pending',
        ...report
      };

      this.abuseReports.set(id, fullReport);

      logger.info(`Abuse report created`, {
        id,
        type: report.type,
        reporter: report.reporter,
        reported: report.reported
      });

      // Emit event
      this.emit('abuseReported', fullReport);

      return id;
    } catch (error) {
      logger.error('Failed to create abuse report', {
        error: error.message,
        report
      });
      throw error;
    }
  }

  async resolveAbuseReport(reportId: string, resolution: string): Promise<void> {
    try {
      const report = this.abuseReports.get(reportId);
      if (!report) {
        throw new Error(`Abuse report not found: ${reportId}`);
      }

      report.status = 'resolved';
      report.metadata = {
        ...report.metadata,
        resolution,
        resolvedAt: Date.now()
      };

      logger.info(`Abuse report resolved`, {
        id: reportId,
        resolution
      });

      // Emit event
      this.emit('abuseReportResolved', report);
    } catch (error) {
      logger.error('Failed to resolve abuse report', {
        error: error.message,
        reportId
      });
      throw error;
    }
  }

  // Metrics and analytics
  async getMetrics(): Promise<RateLimitMetrics> {
    try {
      // Update top violators
      this.updateTopViolators();

      // Update rule statistics
      this.updateRuleStatistics();

      this.metrics.lastUpdated = Date.now();
      return { ...this.metrics };
    } catch (error) {
      logger.error('Failed to get rate limit metrics', { error: error.message });
      throw error;
    }
  }

  async getAbuseReports(filters?: {
    type?: AbuseReportType;
    status?: string;
    severity?: string;
    limit?: number;
    offset?: number;
  }): Promise<AbuseReport[]> {
    try {
      let reports = Array.from(this.abuseReports.values());

      // Apply filters
      if (filters) {
        if (filters.type) {
          reports = reports.filter(report => report.type === filters.type);
        }
        if (filters.status) {
          reports = reports.filter(report => report.status === filters.status);
        }
        if (filters.severity) {
          reports = reports.filter(report => report.severity === filters.severity);
        }
      }

      // Sort by timestamp (most recent first)
      reports.sort((a, b) => b.timestamp - a.timestamp);

      // Apply pagination
      if (filters?.offset) {
        reports = reports.slice(filters.offset);
      }
      if (filters?.limit) {
        reports = reports.slice(0, filters.limit);
      }

      return reports;
    } catch (error) {
      logger.error('Failed to get abuse reports', { error: error.message });
      throw error;
    }
  }

  // Configuration management
  async updateConfig(updates: Partial<RateLimitConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...updates };
      logger.info('Rate limiter configuration updated', { updates });
    } catch (error) {
      logger.error('Failed to update rate limiter config', { error: error.message });
      throw error;
    }
  }

  async getConfig(): Promise<RateLimitConfig> {
    return { ...this.config };
  }

  // Private helper methods
  private initializeDefaultRules(): void {
    // Global rate limiting rule
    this.config.rules.push({
      id: 'global_rate_limit',
      name: 'Global Rate Limit',
      description: 'Global rate limiting for all requests',
      enabled: true,
      priority: 100,
      target: {
        type: 'global',
        scope: 'all'
      },
      limits: [
        { windowMs: 60000, maxRequests: 1000 }, // 1000 requests per minute
        { windowMs: 3600000, maxRequests: 10000 }, // 10k requests per hour
        { windowMs: 86400000, maxRequests: 100000 } // 100k requests per day
      ],
      action: {
        type: 'throttle',
        message: 'Rate limit exceeded. Please try again later.'
      },
      conditions: []
    });

    // User-specific rate limiting
    this.config.rules.push({
      id: 'user_rate_limit',
      name: 'User Rate Limit',
      description: 'Rate limiting per user',
      enabled: true,
      priority: 90,
      target: {
        type: 'user',
        scope: 'all'
      },
      limits: [
        { windowMs: 60000, maxRequests: 100 }, // 100 requests per minute per user
        { windowMs: 3600000, maxRequests: 1000 } // 1000 requests per hour per user
      ],
      action: {
        type: 'throttle',
        message: 'User rate limit exceeded. Please slow down.'
      },
      conditions: []
    });

    // IP-based rate limiting
    this.config.rules.push({
      id: 'ip_rate_limit',
      name: 'IP Rate Limit',
      description: 'Rate limiting per IP address',
      enabled: true,
      priority: 80,
      target: {
        type: 'ip',
        scope: 'all'
      },
      limits: [
        { windowMs: 60000, maxRequests: 200 }, // 200 requests per minute per IP
        { windowMs: 3600000, maxRequests: 2000 } // 2000 requests per hour per IP
      ],
      action: {
        type: 'throttle',
        message: 'IP rate limit exceeded.'
      },
      conditions: []
    });

    // Add rules to the map
    this.config.rules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });
  }

  private initializeSuspiciousPatterns(): void {
    // Common suspicious patterns
    this.config.antiAbuse.suspiciousPatterns = [
      {
        id: 'rapid_requests',
        name: 'Rapid Sequential Requests',
        pattern: 'requests_per_second > 10',
        severity: 'medium',
        action: 'throttle',
        confidence: 0.8
      },
      {
        id: 'large_payload',
        name: 'Large Payload Size',
        pattern: 'payload_size > 10MB',
        severity: 'high',
        action: 'block',
        confidence: 0.9
      },
      {
        id: 'automation_detected',
        name: 'Automation Detected',
        pattern: 'request_interval < 100ms && consistent_headers',
        severity: 'high',
        action: 'challenge',
        confidence: 0.7
      },
      {
        id: 'distributed_attack',
        name: 'Distributed Attack Pattern',
        pattern: 'multiple_ips_same_pattern && high_frequency',
        severity: 'critical',
        action: 'block',
        confidence: 0.9
      }
    ];
  }

  private updateGlobalCounters(): void {
    const now = Date.now();
    const minute = Math.floor(now / 60000);

    if (!this.globalCounters.has('minute')) {
      this.globalCounters.set('minute', {
        count: 0,
        resetTime: (minute + 1) * 60000
      });
    }

    const counter = this.globalCounters.get('minute')!;
    if (now >= counter.resetTime) {
      counter.count = 0;
      counter.resetTime = (minute + 1) * 60000;
    }

    counter.count++;
  }

  private async performAbuseCheck(request: RateLimitRequest): Promise<RateLimitResult> {
    try {
      // IP reputation check
      if (request.ip && this.config.antiAbuse.ipReputation.enabled) {
        const reputation = await this.checkIPReputation(request.ip);
        if (reputation.reputation === 'malicious') {
          return this.createAbuseBlockResult('Malicious IP reputation', request);
        }
      }

      // Device fingerprinting
      if (this.config.antiAbuse.deviceFingerprinting.enabled) {
        const fingerprint = this.generateDeviceFingerprint(request);
        const suspiciousDevices = await this.checkSuspiciousDevices(fingerprint);
        if (suspiciousDevices.length > 0) {
          return this.createAbuseBlockResult('Suspicious device fingerprint', request);
        }
      }

      // Behavioral analysis
      if (this.config.antiAbuse.behavioralAnalysis.enabled) {
        const behavior = await this.analyzeBehavior(request);
        if (behavior.anomalyScore > this.config.antiAbuse.behavioralAnalysis.anomalyThreshold) {
          return this.createAbuseBlockResult('Behavioral anomaly detected', request);
        }
      }

      // Pattern matching
      const patternMatch = this.checkSuspiciousPatterns(request);
      if (patternMatch) {
        const action = this.config.antiAbuse.suspiciousPatterns.find(p => p.id === patternMatch);
        if (action && action.confidence > 0.7) {
          return this.createAbuseBlockResult(`Suspicious pattern: ${action.name}`, request);
        }
      }

      // Heuristic analysis
      if (this.config.antiAbuse.automatedDetection.enabled) {
        const heuristicResult = await this.runHeuristicAnalysis(request);
        if (heuristicResult.block) {
          return this.createAbuseBlockResult('Automated threat detected', request);
        }
      }

      return { allowed: true } as RateLimitResult;
    } catch (error) {
      logger.error('Abuse check failed', {
        error: error.message,
        request
      });
      return { allowed: true } as RateLimitResult; // Fail open
    }
  }

  private async checkGlobalLimits(request: RateLimitRequest): Promise<RateLimitResult> {
    const now = Date.now();
    const counters = ['minute', 'hour', 'day'];
    const windows = [60000, 3600000, 86400000];
    const limits = [
      this.config.globalLimits.requestsPerMinute,
      this.config.globalLimits.requestsPerHour,
      this.config.globalLimits.requestsPerDay
    ];

    for (let i = 0; i < counters.length; i++) {
      const counterKey = counters[i];
      const windowMs = windows[i];
      const limit = limits[i];

      if (!this.globalCounters.has(counterKey)) {
        this.globalCounters.set(counterKey, {
          count: 0,
          resetTime: Math.ceil(now / windowMs) * windowMs
        });
      }

      const counter = this.globalCounters.get(counterKey)!;
      if (now >= counter.resetTime) {
        counter.count = 1;
        counter.resetTime = Math.ceil(now / windowMs) * windowMs;
      } else {
        counter.count++;
      }

      if (counter.count > limit) {
        return this.createRateLimitResult('global', limit, windowMs, counter.resetTime);
      }
    }

    return { allowed: true } as RateLimitResult;
  }

  private async getApplicableRules(request: RateLimitRequest): Promise<RateLimitRule[]> {
    const applicableRules: RateLimitRule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // Check if rule applies to this request
      if (this.ruleAppliesToRequest(rule, request)) {
        applicableRules.push(rule);
      }
    }

    // Sort by priority (higher priority first)
    applicableRules.sort((a, b) => b.priority - a.priority);

    return applicableRules;
  }

  private ruleAppliesToRequest(rule: RateLimitRule, request: RateLimitRequest): boolean {
    // Check scope
    if (rule.target.scope === 'authenticated' && !this.isAuthenticated(request)) {
      return false;
    }
    if (rule.target.scope === 'unauthenticated' && this.isAuthenticated(request)) {
      return false;
    }

    // Check conditions
    if (rule.conditions.length > 0) {
      return this.evaluateConditions(rule.conditions, request);
    }

    return true;
  }

  private isAuthenticated(request: RateLimitRequest): boolean {
    // Simplified authentication check
    // In production, would check actual authentication tokens
    return request.wallet !== undefined || request.identifier.length > 20;
  }

  private evaluateConditions(conditions: RateLimitCondition[], request: RateLimitRequest): boolean {
    return conditions.every(condition => {
      const fieldValue = this.getFieldValue(request, condition.field);
      return this.evaluateCondition(fieldValue, condition.operator, condition.value);
    });
  }

  private getFieldValue(request: RateLimitRequest, field: string): any {
    const fields = field.split('.');
    let value: any = request;

    for (const field of fields) {
      if (value && typeof value === 'object' && field in value) {
        value = value[field];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private evaluateCondition(fieldValue: any, operator: string, conditionValue: any): boolean {
    switch (operator) {
      case 'equals': return fieldValue === conditionValue;
      case 'not_equals': return fieldValue !== conditionValue;
      case 'contains': return String(fieldValue).includes(String(conditionValue));
      case 'regex': return new RegExp(conditionValue).test(String(fieldValue));
      default: return false;
    }
  }

  private async checkRule(rule: RateLimitRule, request: RateLimitRequest): Promise<RateLimitResult> {
    const identifier = this.getRuleIdentifier(rule, request);
    const now = Date.now();

    for (const limit of rule.limits) {
      const key = this.getRuleKey(rule.id, identifier, limit.windowMs);
      const counter = await this.getCounter(key);

      // Check if counter needs reset
      if (now >= counter.resetTime) {
        counter.count = 1;
        counter.resetTime = now + limit.windowMs;
        await this.setCounter(key, counter);
      } else {
        counter.count++;
        await this.setCounter(key, counter);
      }

      if (counter.count > limit.maxRequests) {
        return this.createRateLimitResult(
          rule.id,
          limit.maxRequests,
          limit.windowMs,
          counter.resetTime,
          rule
        );
      }
    }

    return { allowed: true } as RateLimitResult;
  }

  private getRuleIdentifier(rule: RateLimitRule, request: RateLimitRequest): string {
    switch (rule.target.type) {
      case 'global': return 'global';
      case 'user': return request.identifier;
      case 'ip': return request.ip || 'unknown';
      case 'wallet': return request.wallet || 'unknown';
      case 'endpoint': return request.endpoint || 'unknown';
      default: return 'unknown';
    }
  }

  private getRuleKey(ruleId: string, identifier: string, windowMs: number): string {
    return `rate_limit:${ruleId}:${identifier}:${windowMs}`;
  }

  private async getCounter(key: string): Promise<RequestCounter> {
    // Try cache first
    const cached = await this.cacheService.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    // Return default counter
    return {
      count: 0,
      resetTime: Date.now() + 60000
    };
  }

  private async setCounter(key: string, counter: RequestCounter): Promise<void> {
    await this.cacheService.set(key, JSON.stringify(counter), 86400000); // 24 hours TTL
  }

  private async checkIPReputation(ip: string): Promise<IPReputation> {
    // Check cache first
    const cached = this.ipReputationCache.get(ip);
    if (cached && (Date.now() - cached.timestamp) < this.config.antiAbuse.ipReputation.cacheDurationMs) {
      return cached;
    }

    // Simulate IP reputation check
    // In production, would query external reputation services
    const reputation: IPReputation = {
      ip,
      reputation: this.config.antiAbuse.ipReputation.defaultReputation,
      confidence: 0.5,
      source: 'internal',
      timestamp: Date.now(),
      metadata: {}
    };

    // Check if IP is in internal blacklist
    if (this.config.antiAbuse.ipReputation.blacklistSources.some(source => ip.includes(source))) {
      reputation.reputation = 'malicious';
      reputation.confidence = 0.9;
    }

    // Cache result
    this.ipReputationCache.set(ip, reputation);

    return reputation;
  }

  private generateDeviceFingerprint(request: RateLimitRequest): string {
    const components = [];

    if (request.userAgent) {
      components.push(request.userAgent);
    }
    if (request.ip) {
      components.push(request.ip);
    }

    // Add other identifying features
    components.push(request.type);
    components.push(request.endpoint || '');

    return this.hashString(components.join('|'));
  }

  private async checkSuspiciousDevices(fingerprint: string): Promise<string[]> {
    // Check if this fingerprint matches known suspicious patterns
    // In production, would maintain a database of device fingerprints
    return [];
  }

  private async analyzeBehavior(request: RateLimitRequest): Promise<UserBehavior> {
    const behavior = this.behaviorTracking.get(request.identifier) || {
      identifier: request.identifier,
      requests: [],
      patterns: {},
      anomalyScore: 0,
      lastActivity: Date.now()
    };

    // Add current request to behavior tracking
    behavior.requests.push({
      timestamp: request.timestamp,
      type: request.type,
      ip: request.ip,
      endpoint: request.endpoint
    });

    // Clean old requests
    const cutoff = Date.now() - this.config.antiAbuse.behavioralAnalysis.trackingDurationMs;
    behavior.requests = behavior.requests.filter(req => req.timestamp >= cutoff);

    // Analyze patterns
    behavior.anomalyScore = this.calculateBehavioralAnomaly(behavior);
    behavior.lastActivity = Date.now();

    // Store updated behavior
    this.behaviorTracking.set(request.identifier, behavior);

    return behavior;
  }

  private calculateBehavioralAnomaly(behavior: UserBehavior): number {
    const requests = behavior.requests;
    if (requests.length < 10) return 0;

    // Analyze request frequency
    const timeSpan = Math.max(...requests.map(r => r.timestamp)) - Math.min(...requests.map(r => r.timestamp));
    const avgInterval = timeSpan / (requests.length - 1);

    let anomalyScore = 0;

    // Very fast requests are suspicious
    if (avgInterval < 1000) { // Less than 1 second between requests
      anomalyScore += 0.3;
    }

    // Check for consistent timing (automation indicator)
    const intervals = [];
    for (let i = 1; i < requests.length; i++) {
      intervals.push(requests[i].timestamp - requests[i - 1].timestamp);
    }

    const avgDeviation = this.calculateStandardDeviation(intervals);
    if (avgDeviation < 100) { // Very consistent timing
      anomalyScore += 0.4;
    }

    // Check for diversity of endpoints
    const uniqueEndpoints = new Set(requests.map(r => r.endpoint)).size;
    if (uniqueEndpoints < 3 && requests.length > 20) {
      anomalyScore += 0.3;
    }

    return Math.min(1, anomalyScore);
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private checkSuspiciousPatterns(request: RateLimitRequest): string | null {
    for (const pattern of this.config.antiAbuse.suspiciousPatterns) {
      if (this.evaluatePattern(pattern.pattern, request)) {
        return pattern.id;
      }
    }
    return null;
  }

  private evaluatePattern(pattern: string, request: RateLimitRequest): boolean {
    // Simplified pattern evaluation
    // In production, would use a proper pattern matching engine
    return false;
  }

  private async runHeuristicAnalysis(request: RateLimitRequest): Promise<{ block: boolean; confidence: number }> {
    let block = false;
    let confidence = 0;

    for (const rule of this.config.antiAbuse.automatedDetection.heuristics) {
      const result = this.evaluateHeuristic(rule, request);
      if (result.matches) {
        confidence = Math.max(confidence, result.confidence);
        if (result.severity > 0.7) {
          block = true;
        }
      }
    }

    return { block, confidence };
  }

  private evaluateHeuristic(rule: HeuristicRule, request: RateLimitRequest): { matches: boolean; confidence: number; severity: number } {
    // Simplified heuristic evaluation
    // In production, would implement proper heuristic logic
    return { matches: false, confidence: 0, severity: 0 };
  }

  private createAllowedResult(requestId: string, startTime: number, request: RateLimitRequest): RateLimitResult {
    return {
      allowed: true,
      remaining: Number.MAX_SAFE_INTEGER, // Simplified
      resetTime: Date.now() + 86400000, // 24 hours
      metadata: {
        requestId,
        processingTime: Date.now() - startTime,
        blockedBy: [],
        warnings: []
      }
    };
  }

  private createBlockedResult(requestId: string, startTime: number, source: RateLimitResult): RateLimitResult {
    return {
      allowed: false,
      remaining: 0,
      resetTime: source.resetTime || Date.now() + 60000,
      retryAfter: source.resetTime ? Math.max(0, source.resetTime - Date.now()) : undefined,
      rule: source.rule,
      action: source.action,
      metadata: {
        requestId,
        processingTime: Date.now() - startTime,
        blockedBy: [source.rule?.id || 'unknown'],
        warnings: source.metadata?.warnings || []
      }
    };
  }

  private createRateLimitResult(
    ruleId: string,
    maxRequests: number,
    windowMs: number,
    resetTime: number,
    rule?: RateLimitRule
  ): RateLimitResult {
    return {
      allowed: false,
      remaining: 0,
      resetTime,
      retryAfter: Math.max(0, resetTime - Date.now()),
      rule,
      action: rule?.action || { type: 'throttle', message: 'Rate limit exceeded' },
      metadata: {
        requestId: '',
        processingTime: 0,
        blockedBy: [ruleId],
        warnings: [`Rate limit exceeded: ${maxRequests} requests per ${windowMs / 1000} seconds`]
      }
    };
  }

  private createAbuseBlockResult(reason: string, request: RateLimitRequest): RateLimitResult {
    return {
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 3600000, // 1 hour
      retryAfter: 3600000,
      action: {
        type: 'block',
        message: 'Access denied due to suspicious activity'
      },
      metadata: {
        requestId: '',
        processingTime: 0,
        blockedBy: ['abuse_detection'],
        warnings: [reason]
      }
    };
  }

  private createErrorResult(requestId: string, startTime: number, error: any): RateLimitResult {
    return {
      allowed: true,
      remaining: Number.MAX_SAFE_INTEGER,
      resetTime: Date.now() + 86400000,
      metadata: {
        requestId,
        processingTime: Date.now() - startTime,
        blockedBy: [],
        warnings: [`Rate limiting error: ${error.message}`]
      }
    };
  }

  private updateMetrics(result: RateLimitResult, startTime: number): void {
    this.metrics.totalRequests++;

    if (result.allowed) {
      this.metrics.allowedRequests++;
    } else {
      this.metrics.blockedRequests++;
    }

    // Update average response time
    const processingTime = Date.now() - startTime;
    this.metrics.averageResponseTime = (this.metrics.averageResponseTime + processingTime) / 2;
  }

  private updateTopViolators(): void {
    // Simplified top violators tracking
    // In production, would maintain more detailed statistics
    this.metrics.topViolators = [];
  }

  private updateRuleStatistics(): void {
    const stats: RateLimitMetrics['ruleStatistics'] = [];

    for (const rule of this.rules.values()) {
      stats.push({
        ruleId: rule.id,
        ruleName: rule.name,
        triggered: 0, // Would track actual triggers
        blocked: 0
      });
    }

    this.metrics.ruleStatistics = stats;
  }

  private shouldSendNotification(result: RateLimitResult): boolean {
    if (!result.allowed) {
      const severity = result.action?.type === 'block' ? 'critical' : 'high';
      return this.config.notifications.alertThresholds.rateLimitExceeded;
    }
    return false;
  }

  private async sendNotifications(result: RateLimitResult, request: RateLimitRequest): Promise<void> {
    try {
      // Send email notifications
      if (this.config.notifications.email.enabled) {
        await this.sendEmailNotification(result, request);
      }

      // Send webhook notifications
      if (this.config.notifications.webhook.enabled) {
        await this.sendWebhookNotification(result, request);
      }

      // Send Slack notifications
      if (this.config.notifications.slack.enabled) {
        await this.sendSlackNotification(result, request);
      }
    } catch (error) {
      logger.error('Failed to send notifications', {
        error: error.message,
        result
      });
    }
  }

  private async sendEmailNotification(result: RateLimitResult, request: RateLimitRequest): Promise<void> {
    // Implement email notification
    logger.info('Email notification sent', { result });
  }

  private async sendWebhookNotification(result: RateLimitResult, request: RateLimitRequest): Promise<void> {
    // Implement webhook notification
    logger.info('Webhook notification sent', { result });
  }

  private async sendSlackNotification(result: RateLimitResult, request: RateLimitRequest): Promise<void> {
    // Implement Slack notification
    logger.info('Slack notification sent', { result });
  }

  private generateRequestId(): string {
    return `rl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateReportId(): string {
    return `abuse_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private hashString(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      enabled: boolean;
      rulesLoaded: number;
      globalCountersActive: number;
      cacheEnabled: boolean;
      ipReputationCache: number;
      behaviorTracking: number;
    };
  }> {
    try {
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (!this.config.enabled) {
        status = 'degraded';
      }

      if (this.rules.size === 0) {
        status = 'degraded';
      }

      return {
        status,
        details: {
          enabled: this.config.enabled,
          rulesLoaded: this.rules.size,
          globalCountersActive: this.globalCounters.size,
          cacheEnabled: this.cacheService !== null,
          ipReputationCache: this.ipReputationCache.size,
          behaviorTracking: this.behaviorTracking.size
        }
      };
    } catch (error) {
      logger.error('Rate limiter health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        details: {
          enabled: false,
          rulesLoaded: 0,
          globalCountersActive: 0,
          cacheEnabled: false,
          ipReputationCache: 0,
          behaviorTracking: 0
        }
      };
    }
  }
}

// Supporting interfaces
interface RequestCounter {
  count: number;
  resetTime: number;
}

interface IPReputation {
  ip: string;
  reputation: 'trusted' | 'neutral' | 'suspicious' | 'malicious';
  confidence: number;
  source: string;
  timestamp: number;
  metadata: { [key: string]: any };
}

interface DeviceFingerprint {
  id: string;
  components: { [key: string]: string };
  firstSeen: number;
  lastSeen: number;
  requestCount: number;
  suspicious: boolean;
}

interface UserBehavior {
  identifier: string;
  requests: Array<{
    timestamp: number;
    type: string;
    ip?: string;
    endpoint?: string;
  }>;
  patterns: { [key: string]: any };
  anomalyScore: number;
  lastActivity: number;
}

// Factory function
export function createRateLimiter(
  cacheService: ICache,
  config?: Partial<RateLimitConfig>
): RateLimiter {
  return new RateLimiter(cacheService, config);
}