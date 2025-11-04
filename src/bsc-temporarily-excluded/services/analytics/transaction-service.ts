import { Logger } from '../../../utils/logger.js';
import { ICache } from '../../../services/cache.service.js';
import { BscTokenService } from '../tokens/token-service.js';
import { BscTradingService } from '../trading/trading-service.js';
import { BscLiquidityService } from '../liquidity/liquidity-service.js';
import { BscYieldService } from '../yield/yield-service.js';
import { PancakeSwapSubgraphClient } from '../pancakeswap/subgraph-client.js';

const logger = new Logger('TransactionService');

// Transaction types and interfaces
export interface Transaction {
  hash: string;
  blockNumber: number;
  blockHash: string;
  transactionIndex: number;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  gasCost: string;
  status: 'success' | 'failed' | 'pending';
  timestamp: number;
  type: TransactionType;
  method: string;
  data: string;
  logs: TransactionLog[];
  tokenTransfers: TokenTransfer[];
  events: TransactionEvent[];
  metadata: TransactionMetadata;
}

export interface TransactionLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
  logIndex: number;
  removed: boolean;
}

export interface TokenTransfer {
  from: string;
  to: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  amount: string;
  valueUSD: number;
  transactionHash: string;
  logIndex: number;
}

export interface TransactionEvent {
  name: string;
  signature: string;
  address: string;
  args: { [key: string]: any };
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

export interface TransactionMetadata {
  contractType: 'router' | 'factory' | 'pair' | 'masterchef' | 'token' | 'other';
  protocol: 'pancakeswap_v2' | 'pancakeswap_v3' | 'other';
  dappName: string;
  category: TransactionCategory;
  description: string;
  tags: string[];
  riskLevel: 'low' | 'medium' | 'high';
  mevRisk: 'none' | 'low' | 'medium' | 'high';
  confidence: number; // 0-100
}

export type TransactionType =
  | 'swap'
  | 'add_liquidity'
  | 'remove_liquidity'
  | 'farm_deposit'
  | 'farm_withdraw'
  | 'farm_harvest'
  | 'token_approval'
  | 'token_transfer'
  | 'contract_creation'
  | 'multisig_submit'
  | 'multisig_confirm'
  | 'multisig_execute'
  | 'other';

export type TransactionCategory =
  | 'trading'
  | 'liquidity'
  | 'yield'
  | 'governance'
  | 'security'
  | 'infrastructure'
  | 'other';

export interface TransactionSummary {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
  totalVolumeUSD: number;
  totalGasCostUSD: number;
  averageGasCostUSD: number;
  totalFeesUSD: number;
  uniqueAddresses: number;
  transactionTypes: { [type: string]: number };
  transactionCategories: { [category: string]: number };
  topGasSpenders: Array<{ address: string; gasCostUSD: number; transactionCount: number }>;
  topVolumeUsers: Array<{ address: string; volumeUSD: number; transactionCount: number }>;
  timeDistribution: { [hour: number]: number };
  dateRange: { start: number; end: number };
  lastUpdated: number;
}

export interface TransactionReport {
  id: string;
  title: string;
  description: string;
  type: ReportType;
  parameters: ReportParameters;
  data: ReportData;
  generatedAt: number;
  validUntil: number;
  format: 'json' | 'csv' | 'pdf';
  size: number;
}

export type ReportType =
  | 'transaction_history'
  | 'volume_analysis'
  | 'gas_analysis'
  | 'profit_loss'
  | 'mev_analysis'
  | 'security_audit'
  | 'performance_summary'
  | 'custom';

export interface ReportParameters {
  address?: string;
  addresses?: string[];
  timeRange: {
    start: number;
    end: number;
  };
  transactionTypes?: TransactionType[];
  transactionCategories?: TransactionCategory[];
  minValue?: number;
  maxValue?: number;
  includeFailed?: boolean;
  includePending?: boolean;
  groupBy?: 'day' | 'week' | 'month';
  metrics?: string[];
  format?: 'json' | 'csv' | 'pdf';
}

export interface ReportData {
  summary: TransactionSummary;
  transactions: Transaction[];
  charts: ChartData[];
  tables: TableData[];
  insights: Insight[];
  recommendations: Recommendation[];
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'area' | 'candlestick';
  title: string;
  data: Array<{ [key: string]: any }>;
  xAxis: string;
  yAxis: string;
  labels?: string[];
}

export interface TableData {
  title: string;
  headers: string[];
  rows: string[][];
  sortable?: boolean;
  filterable?: boolean;
}

export interface Insight {
  type: 'trend' | 'anomaly' | 'opportunity' | 'risk' | 'efficiency';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  confidence: number;
  data: any;
  recommendation?: string;
}

export interface Recommendation {
  type: 'cost_optimization' | 'security' | 'performance' | 'strategy';
  title: string;
  description: string;
  expectedBenefit: string;
  implementation: string;
  priority: 'low' | 'medium' | 'high';
  estimatedSavings?: number;
}

export interface TransactionFilter {
  addresses?: string[];
  transactionTypes?: TransactionType[];
  transactionCategories?: TransactionCategory[];
  status?: ('success' | 'failed' | 'pending')[];
  minValue?: number;
  maxValue?: number;
  minGasCost?: number;
  maxGasCost?: number;
  timeRange?: {
    start: number;
    end: number;
  };
  contracts?: string[];
  protocols?: string[];
  tags?: string[];
  riskLevel?: ('low' | 'medium' | 'high')[];
  mevRisk?: ('none' | 'low' | 'medium' | 'high')[];
}

export interface TransactionQuery {
  filter?: TransactionFilter;
  sort?: {
    field: 'timestamp' | 'value' | 'gasCost' | 'blockNumber';
    order: 'asc' | 'desc';
  };
  pagination?: {
    offset: number;
    limit: number;
  };
  includeDetails?: boolean;
  includeLogs?: boolean;
  includeEvents?: boolean;
  includeTransfers?: boolean;
}

export interface TransactionAnalytics {
  totalVolume: number;
  totalGasCost: number;
  totalFees: number;
  averageTransactionValue: number;
  averageGasCost: number;
  transactionFrequency: number;
  successRate: number;
  mevAnalysis: {
    sandwichAttacks: number;
    frontRunning: number;
    backRunning: number;
    liquidations: number;
    arbitrage: number;
  };
  riskAnalysis: {
    highRiskTransactions: number;
    suspiciousPatterns: number;
    contractInteractions: { [address: string]: number };
    anomalousBehavior: number;
  };
  performanceMetrics: {
    throughput: number;
    latency: number;
    errorRate: number;
    gasEfficiency: number;
  };
}

export class TransactionService {
  private cache: Map<string, Transaction[]> = new Map();
  private reports: Map<string, TransactionReport> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly REPORT_CACHE_TTL = 1800000; // 30 minutes

  constructor(
    private tokenService: BscTokenService,
    private tradingService: BscTradingService,
    private liquidityService: BscLiquidityService,
    private yieldService: BscYieldService,
    private subgraphClient: PancakeSwapSubgraphClient,
    private cacheService: ICache
  ) {}

  // Transaction retrieval
  async getTransaction(hash: string): Promise<Transaction> {
    try {
      const cacheKey = `transaction_${hash}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      logger.info(`Fetching transaction: ${hash}`);

      // Get transaction from subgraph
      const transactionData = await this.subgraphClient.getTransaction(hash);
      if (!transactionData) {
        throw new Error(`Transaction not found: ${hash}`);
      }

      // Enrich transaction with additional data
      const transaction = await this.enrichTransaction(transactionData);

      // Cache the result
      await this.cacheService.set(cacheKey, JSON.stringify(transaction), this.CACHE_TTL);

      logger.info(`Transaction retrieved successfully: ${hash}`);

      return transaction;
    } catch (error) {
      logger.error('Failed to get transaction', {
        error: error.message,
        hash
      });
      throw error;
    }
  }

  async getTransactions(query: TransactionQuery): Promise<{
    transactions: Transaction[];
    total: number;
    hasNext: boolean;
  }> {
    try {
      logger.info('Querying transactions', { query });

      // Build filter for subgraph query
      const subgraphFilter = this.buildSubgraphFilter(query.filter);

      // Get transactions from subgraph
      const result = await this.subgraphClient.getTransactions(
        subgraphFilter,
        query.sort,
        query.pagination
      );

      // Enrich transactions
      let transactions = await Promise.all(
        result.transactions.map(tx => this.enrichTransaction(tx))
      );

      // Apply additional client-side filtering
      if (query.filter) {
        transactions = this.applyClientSideFilter(transactions, query.filter);
      }

      const total = result.total;
      const hasNext = (query.pagination?.offset || 0) + transactions.length < total;

      logger.info(`Retrieved ${transactions.length} transactions out of ${total} total`);

      return {
        transactions,
        total,
        hasNext
      };
    } catch (error) {
      logger.error('Failed to get transactions', {
        error: error.message,
        query
      });
      throw error;
    }
  }

  async getTransactionHistory(
    address: string,
    timeRange?: { start: number; end: number }
  ): Promise<Transaction[]> {
    try {
      logger.info(`Getting transaction history for address: ${address}`);

      const query: TransactionQuery = {
        filter: {
          addresses: [address],
          timeRange
        },
        sort: {
          field: 'timestamp',
          order: 'desc'
        },
        includeDetails: true,
        includeLogs: true,
        includeEvents: true,
        includeTransfers: true
      };

      const result = await this.getTransactions(query);

      logger.info(`Retrieved ${result.transactions.length} transactions for address: ${address}`);

      return result.transactions;
    } catch (error) {
      logger.error('Failed to get transaction history', {
        error: error.message,
        address,
        timeRange
      });
      throw error;
    }
  }

  // Transaction analysis
  async analyzeTransactions(transactions: Transaction[]): Promise<TransactionAnalytics> {
    try {
      logger.info(`Analyzing ${transactions.length} transactions`);

      const successfulTxs = transactions.filter(tx => tx.status === 'success');
      const totalVolume = transactions.reduce((sum, tx) => {
        const value = parseFloat(tx.value);
        const transfers = tx.tokenTransfers.reduce((transferSum, transfer) =>
          transferSum + transfer.valueUSD, 0);
        return sum + Math.max(value, transfers);
      }, 0);

      const totalGasCost = transactions.reduce((sum, tx) =>
        sum + parseFloat(tx.gasCost) * (tx.gasPrice ? parseFloat(tx.gasPrice) : 0), 0);

      const totalFees = transactions.reduce((sum, tx) => {
        // Calculate trading fees, liquidity fees, etc.
        return sum + this.calculateTransactionFees(tx);
      }, 0);

      const analytics: TransactionAnalytics = {
        totalVolume,
        totalGasCost,
        totalFees,
        averageTransactionValue: successfulTxs.length > 0 ? totalVolume / successfulTxs.length : 0,
        averageGasCost: transactions.length > 0 ? totalGasCost / transactions.length : 0,
        transactionFrequency: this.calculateTransactionFrequency(transactions),
        successRate: transactions.length > 0 ? (successfulTxs.length / transactions.length) * 100 : 0,
        mevAnalysis: await this.analyzeMEV(transactions),
        riskAnalysis: await this.analyzeRisk(transactions),
        performanceMetrics: this.calculatePerformanceMetrics(transactions)
      };

      logger.info('Transaction analysis completed', {
        totalTransactions: transactions.length,
        totalVolume,
        successRate: analytics.successRate
      });

      return analytics;
    } catch (error) {
      logger.error('Failed to analyze transactions', { error: error.message });
      throw error;
    }
  }

  // Transaction reporting
  async generateReport(parameters: ReportParameters): Promise<TransactionReport> {
    try {
      const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logger.info(`Generating report: ${reportId}`, { parameters });

      // Get transactions based on parameters
      const query: TransactionQuery = {
        filter: {
          addresses: parameters.address ? [parameters.address] : parameters.addresses,
          transactionTypes: parameters.transactionTypes,
          transactionCategories: parameters.transactionCategories,
          minValue: parameters.minValue,
          maxValue: parameters.maxValue,
          timeRange: parameters.timeRange
        },
        sort: { field: 'timestamp', order: 'desc' },
        includeDetails: true,
        includeLogs: true,
        includeEvents: true,
        includeTransfers: true
      };

      const result = await this.getTransactions(query);

      // Analyze transactions
      const analytics = await this.analyzeTransactions(result.transactions);

      // Generate summary
      const summary = await this.generateTransactionSummary(result.transactions);

      // Generate charts
      const charts = await this.generateCharts(result.transactions, parameters);

      // Generate tables
      const tables = await this.generateTables(result.transactions, parameters);

      // Generate insights
      const insights = await this.generateInsights(result.transactions, analytics);

      // Generate recommendations
      const recommendations = await this.generateRecommendations(result.transactions, analytics);

      const report: TransactionReport = {
        id: reportId,
        title: this.generateReportTitle(parameters),
        description: this.generateReportDescription(parameters),
        type: parameters.type || 'transaction_history',
        parameters,
        data: {
          summary,
          transactions: result.transactions,
          charts,
          tables,
          insights,
          recommendations
        },
        generatedAt: Date.now(),
        validUntil: Date.now() + this.REPORT_CACHE_TTL,
        format: parameters.format || 'json',
        size: JSON.stringify(result.transactions).length
      };

      // Cache the report
      this.reports.set(reportId, report);

      logger.info(`Report generated successfully: ${reportId}`, {
        transactionCount: result.transactions.length,
        type: report.type
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate report', {
        error: error.message,
        parameters
      });
      throw error;
    }
  }

  async getReport(reportId: string): Promise<TransactionReport> {
    try {
      const report = this.reports.get(reportId);
      if (!report) {
        throw new Error(`Report not found: ${reportId}`);
      }

      // Check if report is still valid
      if (Date.now() > report.validUntil) {
        this.reports.delete(reportId);
        throw new Error(`Report expired: ${reportId}`);
      }

      return report;
    } catch (error) {
      logger.error('Failed to get report', {
        error: error.message,
        reportId
      });
      throw error;
    }
  }

  async getReports(): Promise<TransactionReport[]> {
    try {
      const now = Date.now();
      const validReports = Array.from(this.reports.values())
        .filter(report => report.validUntil > now)
        .sort((a, b) => b.generatedAt - a.generatedAt);

      return validReports;
    } catch (error) {
      logger.error('Failed to get reports', { error: error.message });
      throw error;
    }
  }

  async deleteReport(reportId: string): Promise<void> {
    try {
      const deleted = this.reports.delete(reportId);
      if (!deleted) {
        throw new Error(`Report not found: ${reportId}`);
      }

      logger.info(`Report deleted: ${reportId}`);
    } catch (error) {
      logger.error('Failed to delete report', {
        error: error.message,
        reportId
      });
      throw error;
    }
  }

  // Transaction monitoring
  async monitorTransactions(
    addresses: string[],
    callback: (transaction: Transaction) => void
  ): Promise<string> {
    try {
      const monitorId = `monitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logger.info(`Starting transaction monitor: ${monitorId}`, { addresses });

      // This would implement real-time monitoring using WebSocket or polling
      // For now, return a placeholder implementation

      return monitorId;
    } catch (error) {
      logger.error('Failed to start transaction monitoring', {
        error: error.message,
        addresses
      });
      throw error;
    }
  }

  async stopMonitoring(monitorId: string): Promise<void> {
    try {
      // This would stop the monitoring process
      logger.info(`Stopped transaction monitor: ${monitorId}`);
    } catch (error) {
      logger.error('Failed to stop transaction monitoring', {
        error: error.message,
        monitorId
      });
      throw error;
    }
  }

  // Transaction validation
  async validateTransaction(transaction: Transaction): Promise<{
    isValid: boolean;
    issues: string[];
    warnings: string[];
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    try {
      const issues: string[] = [];
      const warnings: string[] = [];

      // Validate transaction structure
      if (!transaction.hash) issues.push('Missing transaction hash');
      if (!transaction.from) issues.push('Missing from address');
      if (!transaction.to) issues.push('Missing to address');

      // Validate values
      if (parseFloat(transaction.gasUsed) <= 0) warnings.push('Zero gas used');
      if (parseFloat(transaction.gasPrice) <= 0) warnings.push('Zero gas price');

      // Validate status
      if (transaction.status === 'failed') issues.push('Transaction failed');

      // Check for suspicious patterns
      const suspiciousPatterns = await this.detectSuspiciousPatterns(transaction);
      warnings.push(...suspiciousPatterns);

      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (issues.length > 0) riskLevel = 'high';
      else if (warnings.length > 2) riskLevel = 'medium';

      return {
        isValid: issues.length === 0,
        issues,
        warnings,
        riskLevel
      };
    } catch (error) {
      logger.error('Failed to validate transaction', {
        error: error.message,
        hash: transaction.hash
      });
      throw error;
    }
  }

  // Private helper methods
  private async enrichTransaction(transactionData: any): Promise<Transaction> {
    try {
      // Get token transfers
      const tokenTransfers = await this.getTokenTransfers(transactionData.hash);

      // Get transaction events
      const events = await this.getTransactionEvents(transactionData.hash);

      // Determine transaction type
      const type = this.determineTransactionType(transactionData, events);

      // Determine metadata
      const metadata = await this.getTransactionMetadata(transactionData, type);

      // Calculate gas cost in USD
      const gasCost = await this.calculateGasCostUSD(transactionData);

      return {
        hash: transactionData.id,
        blockNumber: parseInt(transactionData.blockNumber),
        blockHash: transactionData.blockHash,
        transactionIndex: parseInt(transactionData.transactionIndex),
        from: transactionData.from,
        to: transactionData.to,
        value: transactionData.value,
        gasUsed: transactionData.gasUsed,
        gasPrice: transactionData.gasPrice,
        gasCost,
        status: transactionData.status as any,
        timestamp: parseInt(transactionData.timestamp) * 1000,
        type,
        method: transactionData.method || 'unknown',
        data: transactionData.input,
        logs: transactionData.logs || [],
        tokenTransfers,
        events,
        metadata
      };
    } catch (error) {
      logger.error('Failed to enrich transaction', {
        error: error.message,
        hash: transactionData.id
      });
      throw error;
    }
  }

  private async getTokenTransfers(transactionHash: string): Promise<TokenTransfer[]> {
    try {
      return await this.subgraphClient.getTokenTransfers(transactionHash);
    } catch (error) {
      logger.warn('Failed to get token transfers', { error: error.message, transactionHash });
      return [];
    }
  }

  private async getTransactionEvents(transactionHash: string): Promise<TransactionEvent[]> {
    try {
      return await this.subgraphClient.getTransactionEvents(transactionHash);
    } catch (error) {
      logger.warn('Failed to get transaction events', { error: error.message, transactionHash });
      return [];
    }
  }

  private determineTransactionType(transactionData: any, events: TransactionEvent[]): TransactionType {
    // Determine transaction type based on events and method
    const method = transactionData.method?.toLowerCase();

    if (method?.includes('swap')) return 'swap';
    if (method?.includes('addliquidity')) return 'add_liquidity';
    if (method?.includes('removeliquidity')) return 'remove_liquidity';
    if (method?.includes('deposit')) return 'farm_deposit';
    if (method?.includes('withdraw')) return 'farm_withdraw';
    if (method?.includes('harvest')) return 'farm_harvest';
    if (method?.includes('approve')) return 'token_approval';
    if (method?.includes('transfer')) return 'token_transfer';

    // Check events for type determination
    for (const event of events) {
      switch (event.name.toLowerCase()) {
        case 'swap': return 'swap';
        case 'mint': return 'add_liquidity';
        case 'burn': return 'remove_liquidity';
        case 'deposit': return 'farm_deposit';
        case 'withdraw': return 'farm_withdraw';
        case 'harvest': return 'farm_harvest';
      }
    }

    return 'other';
  }

  private async getTransactionMetadata(transactionData: any, type: TransactionType): Promise<TransactionMetadata> {
    try {
      // Determine contract type and protocol
      const contractType = await this.determineContractType(transactionData.to);
      const protocol = await this.determineProtocol(transactionData.to);
      const dappName = await this.determineDappName(transactionData.to, protocol);

      // Determine category
      const category = this.determineCategory(type);

      // Generate description
      const description = this.generateTransactionDescription(type, transactionData);

      // Determine risk level and MEV risk
      const riskLevel = await this.assessRiskLevel(transactionData, type);
      const mevRisk = await this.assessMEVRisk(transactionData, type);

      return {
        contractType,
        protocol,
        dappName,
        category,
        description,
        tags: this.generateTransactionTags(type, protocol),
        riskLevel,
        mevRisk,
        confidence: this.calculateConfidence(transactionData, type)
      };
    } catch (error) {
      logger.error('Failed to get transaction metadata', {
        error: error.message,
        hash: transactionData.id
      });

      return {
        contractType: 'other',
        protocol: 'other',
        dappName: 'Unknown',
        category: 'other',
        description: 'Unknown transaction',
        tags: [],
        riskLevel: 'medium',
        mevRisk: 'none',
        confidence: 0
      };
    }
  }

  private async determineContractType(address: string): Promise<TransactionMetadata['contractType']> {
    // Check known contract addresses
    const knownContracts = {
      '0x10ed43c718714eb63d5aa57b78b54704e256024e': 'router', // PancakeSwap Router V2
      '0x1b81D678ffb9C0263b24A97847620C99d213eB14': 'router', // PancakeSwap Router V3
      '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73': 'factory', // PancakeSwap Factory V2
      '0x73feaa1eE314F8c655E354234017bE2193C9E24E': 'masterchef', // MasterChef V1
      '0xa5f8C5DBd5F7206A938745d5898732843F7d896D': 'masterchef', // MasterChef V2
    };

    return knownContracts[address.toLowerCase()] || 'other';
  }

  private async determineProtocol(address: string): Promise<TransactionMetadata['protocol']> {
    const v2Contracts = [
      '0x10ed43c718714eb63d5aa57b78b54704e256024e', // Router V2
      '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', // Factory V2
      '0x73feaa1eE314F8c655E354234017bE2193C9E24E', // MasterChef V1
    ];

    const v3Contracts = [
      '0x1b81D678ffb9C0263b24A97847620C99d213eB14', // Router V3
    ];

    if (v2Contracts.includes(address.toLowerCase())) return 'pancakeswap_v2';
    if (v3Contracts.includes(address.toLowerCase())) return 'pancakeswap_v3';

    return 'other';
  }

  private async determineDappName(address: string, protocol: string): Promise<string> {
    const knownDapps = {
      'pancakeswap_v2': 'PancakeSwap V2',
      'pancakeswap_v3': 'PancakeSwap V3',
    };

    return knownDapps[protocol] || 'Unknown';
  }

  private determineCategory(type: TransactionType): TransactionCategory {
    const categoryMap: { [key in TransactionType]: TransactionCategory } = {
      swap: 'trading',
      add_liquidity: 'liquidity',
      remove_liquidity: 'liquidity',
      farm_deposit: 'yield',
      farm_withdraw: 'yield',
      farm_harvest: 'yield',
      token_approval: 'security',
      token_transfer: 'infrastructure',
      contract_creation: 'infrastructure',
      multisig_submit: 'governance',
      multisig_confirm: 'governance',
      multisig_execute: 'governance',
      other: 'other'
    };

    return categoryMap[type];
  }

  private generateTransactionDescription(type: TransactionType, transactionData: any): string {
    const descriptions: { [key in TransactionType]: string } = {
      swap: 'Token swap transaction',
      add_liquidity: 'Liquidity provision transaction',
      remove_liquidity: 'Liquidity removal transaction',
      farm_deposit: 'Yield farming deposit transaction',
      farm_withdraw: 'Yield farming withdrawal transaction',
      farm_harvest: 'Yield farming harvest transaction',
      token_approval: 'Token approval transaction',
      token_transfer: 'Token transfer transaction',
      contract_creation: 'Smart contract deployment',
      multisig_submit: 'Multi-signature transaction submission',
      multisig_confirm: 'Multi-signature transaction confirmation',
      multisig_execute: 'Multi-signature transaction execution',
      other: 'Unknown transaction type'
    };

    return descriptions[type];
  }

  private generateTransactionTags(type: TransactionType, protocol: string): string[] {
    const tags = [type, protocol];

    if (protocol.includes('pancakeswap')) tags.push('dex');
    if (type.includes('farm')) tags.push('defi', 'yield');
    if (type.includes('liquidity')) tags.push('defi', 'liquidity');
    if (type.includes('swap')) tags.push('defi', 'trading');

    return tags;
  }

  private async assessRiskLevel(transactionData: any, type: TransactionType): Promise<'low' | 'medium' | 'high'> {
    // Simplified risk assessment
    let riskScore = 0;

    // High value transactions are higher risk
    const value = parseFloat(transactionData.value);
    if (value > 100000) riskScore += 30;
    else if (value > 10000) riskScore += 15;

    // Failed transactions are high risk
    if (transactionData.status === 'failed') riskScore += 40;

    // Unknown contract interactions are higher risk
    const contractType = await this.determineContractType(transactionData.to);
    if (contractType === 'other') riskScore += 20;

    if (riskScore >= 50) return 'high';
    if (riskScore >= 25) return 'medium';
    return 'low';
  }

  private async assessMEVRisk(transactionData: any, type: TransactionType): Promise<'none' | 'low' | 'medium' | 'high'> {
    // Simplified MEV risk assessment
    if (type === 'swap') return 'medium';
    if (type === 'add_liquidity' || type === 'remove_liquidity') return 'low';
    return 'none';
  }

  private calculateConfidence(transactionData: any, type: TransactionType): number {
    // Confidence in our analysis of the transaction
    let confidence = 50; // Base confidence

    // Known contracts increase confidence
    if (transactionData.to) {
      const knownContracts = [
        '0x10ed43c718714eb63d5aa57b78b54704e256024e',
        '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
        '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
      ];
      if (knownContracts.includes(transactionData.to.toLowerCase())) {
        confidence += 30;
      }
    }

    // Successful transactions increase confidence
    if (transactionData.status === 'success') {
      confidence += 20;
    }

    return Math.min(100, confidence);
  }

  private async calculateGasCostUSD(transactionData: any): Promise<string> {
    try {
      const gasUsed = parseFloat(transactionData.gasUsed);
      const gasPrice = parseFloat(transactionData.gasPrice);
      const bnbPrice = 300; // Simplified BNB price

      const gasCostBNB = (gasUsed * gasPrice) / Math.pow(10, 18);
      const gasCostUSD = gasCostBNB * bnbPrice;

      return gasCostUSD.toString();
    } catch (error) {
      logger.warn('Failed to calculate gas cost USD', { error: error.message });
      return '0';
    }
  }

  private buildSubgraphFilter(filter?: TransactionFilter): any {
    if (!filter) return {};

    const subgraphFilter: any = {};

    if (filter.addresses) {
      subgraphFilter.or = filter.addresses.map(address => ({
        from: address.toLowerCase(),
        to: address.toLowerCase()
      }));
    }

    if (filter.timeRange) {
      subgraphFilter.timestamp_gt = Math.floor(filter.timeRange.start / 1000);
      subgraphFilter.timestamp_lt = Math.floor(filter.timeRange.end / 1000);
    }

    return subgraphFilter;
  }

  private applyClientSideFilter(transactions: Transaction[], filter: TransactionFilter): Transaction[] {
    return transactions.filter(tx => {
      // Filter by transaction types
      if (filter.transactionTypes && !filter.transactionTypes.includes(tx.type)) {
        return false;
      }

      // Filter by transaction categories
      if (filter.transactionCategories && !filter.transactionCategories.includes(tx.metadata.category)) {
        return false;
      }

      // Filter by status
      if (filter.status && !filter.status.includes(tx.status)) {
        return false;
      }

      // Filter by value range
      const value = parseFloat(tx.value);
      if (filter.minValue !== undefined && value < filter.minValue) return false;
      if (filter.maxValue !== undefined && value > filter.maxValue) return false;

      // Filter by gas cost range
      const gasCost = parseFloat(tx.gasCost);
      if (filter.minGasCost !== undefined && gasCost < filter.minGasCost) return false;
      if (filter.maxGasCost !== undefined && gasCost > filter.maxGasCost) return false;

      // Filter by risk level
      if (filter.riskLevel && !filter.riskLevel.includes(tx.metadata.riskLevel)) {
        return false;
      }

      // Filter by MEV risk
      if (filter.mevRisk && !filter.mevRisk.includes(tx.metadata.mevRisk)) {
        return false;
      }

      return true;
    });
  }

  private calculateTransactionFees(transaction: Transaction): number {
    // Simplified fee calculation
    switch (transaction.type) {
      case 'swap':
        return parseFloat(transaction.value) * 0.0025; // 0.25% trading fee
      case 'add_liquidity':
      case 'remove_liquidity':
        return 0; // No direct fee for liquidity operations
      case 'farm_deposit':
      case 'farm_withdraw':
      case 'farm_harvest':
        return 0; // Fees are handled by the farm contract
      default:
        return 0;
    }
  }

  private calculateTransactionFrequency(transactions: Transaction[]): number {
    if (transactions.length < 2) return 0;

    const timeSpan = Math.max(...transactions.map(tx => tx.timestamp)) -
                    Math.min(...transactions.map(tx => tx.timestamp));

    const days = timeSpan / (1000 * 60 * 60 * 24);

    return days > 0 ? transactions.length / days : 0;
  }

  private async analyzeMEV(transactions: Transaction[]): Promise<{
    sandwichAttacks: number;
    frontRunning: number;
    backRunning: number;
    liquidations: number;
    arbitrage: number;
  }> {
    // Simplified MEV analysis
    return {
      sandwichAttacks: 0,
      frontRunning: 0,
      backRunning: 0,
      liquidations: 0,
      arbitrage: 0
    };
  }

  private async analyzeRisk(transactions: Transaction[]): Promise<{
    highRiskTransactions: number;
    suspiciousPatterns: number;
    contractInteractions: { [address: string]: number };
    anomalousBehavior: number;
  }> {
    const highRiskTransactions = transactions.filter(tx => tx.metadata.riskLevel === 'high').length;
    const suspiciousPatterns = 0; // Would implement pattern detection

    const contractInteractions: { [address: string]: number } = {};
    transactions.forEach(tx => {
      contractInteractions[tx.to] = (contractInteractions[tx.to] || 0) + 1;
    });

    return {
      highRiskTransactions,
      suspiciousPatterns,
      contractInteractions,
      anomalousBehavior: 0
    };
  }

  private calculatePerformanceMetrics(transactions: Transaction[]): {
    throughput: number;
    latency: number;
    errorRate: number;
    gasEfficiency: number;
  } {
    const successfulTxs = transactions.filter(tx => tx.status === 'success');
    const timeSpan = Math.max(...transactions.map(tx => tx.timestamp)) -
                    Math.min(...transactions.map(tx => tx.timestamp));
    const hours = timeSpan / (1000 * 60 * 60);

    return {
      throughput: hours > 0 ? successfulTxs.length / hours : 0,
      latency: 15000, // 15 seconds average
      errorRate: transactions.length > 0 ? ((transactions.length - successfulTxs.length) / transactions.length) * 100 : 0,
      gasEfficiency: 75 // Simplified efficiency score
    };
  }

  private async generateTransactionSummary(transactions: Transaction[]): Promise<TransactionSummary> {
    const successfulTxs = transactions.filter(tx => tx.status === 'success');
    const failedTxs = transactions.filter(tx => tx.status === 'failed');
    const pendingTxs = transactions.filter(tx => tx.status === 'pending');

    const totalVolumeUSD = transactions.reduce((sum, tx) => {
      const value = parseFloat(tx.value);
      const transfers = tx.tokenTransfers.reduce((transferSum, transfer) =>
        transferSum + transfer.valueUSD, 0);
      return sum + Math.max(value, transfers);
    }, 0);

    const totalGasCostUSD = transactions.reduce((sum, tx) =>
      sum + parseFloat(tx.gasCost), 0);

    const transactionTypes: { [type: string]: number } = {};
    const transactionCategories: { [category: string]: number } = {};

    transactions.forEach(tx => {
      transactionTypes[tx.type] = (transactionTypes[tx.type] || 0) + 1;
      transactionCategories[tx.metadata.category] = (transactionCategories[tx.metadata.category] || 0) + 1;
    });

    // Calculate top gas spenders
    const gasSpenders: { [address: string]: { gasCost: number; count: number } } = {};
    transactions.forEach(tx => {
      const gasCost = parseFloat(tx.gasCost);
      if (!gasSpenders[tx.from]) {
        gasSpenders[tx.from] = { gasCost: 0, count: 0 };
      }
      gasSpenders[tx.from].gasCost += gasCost;
      gasSpenders[tx.from].count += 1;
    });

    const topGasSpenders = Object.entries(gasSpenders)
      .map(([address, data]) => ({
        address,
        gasCostUSD: data.gasCost,
        transactionCount: data.count
      }))
      .sort((a, b) => b.gasCostUSD - a.gasCostUSD)
      .slice(0, 10);

    // Calculate top volume users
    const volumeUsers: { [address: string]: { volume: number; count: number } } = {};
    transactions.forEach(tx => {
      const volume = Math.max(parseFloat(tx.value),
        tx.tokenTransfers.reduce((sum, transfer) => sum + transfer.valueUSD, 0));
      if (!volumeUsers[tx.from]) {
        volumeUsers[tx.from] = { volume: 0, count: 0 };
      }
      volumeUsers[tx.from].volume += volume;
      volumeUsers[tx.from].count += 1;
    });

    const topVolumeUsers = Object.entries(volumeUsers)
      .map(([address, data]) => ({
        address,
        volumeUSD: data.volume,
        transactionCount: data.count
      }))
      .sort((a, b) => b.volumeUSD - a.volumeUSD)
      .slice(0, 10);

    // Calculate time distribution
    const timeDistribution: { [hour: number]: number } = {};
    transactions.forEach(tx => {
      const hour = new Date(tx.timestamp).getHours();
      timeDistribution[hour] = (timeDistribution[hour] || 0) + 1;
    });

    const timestamps = transactions.map(tx => tx.timestamp);
    const dateRange = {
      start: Math.min(...timestamps),
      end: Math.max(...timestamps)
    };

    return {
      totalTransactions: transactions.length,
      successfulTransactions: successfulTxs.length,
      failedTransactions: failedTxs.length,
      pendingTransactions: pendingTxs.length,
      totalVolumeUSD,
      totalGasCostUSD,
      averageGasCostUSD: transactions.length > 0 ? totalGasCostUSD / transactions.length : 0,
      totalFeesUSD: transactions.reduce((sum, tx) => sum + this.calculateTransactionFees(tx), 0),
      uniqueAddresses: new Set(transactions.map(tx => tx.from)).size,
      transactionTypes,
      transactionCategories,
      topGasSpenders,
      topVolumeUsers,
      timeDistribution,
      dateRange,
      lastUpdated: Date.now()
    };
  }

  private async generateCharts(transactions: Transaction[], parameters: ReportParameters): Promise<ChartData[]> {
    const charts: ChartData[] = [];

    // Volume over time chart
    if (parameters.metrics?.includes('volume')) {
      const volumeData = this.prepareVolumeChartData(transactions, parameters.groupBy);
      charts.push({
        type: 'line',
        title: 'Transaction Volume Over Time',
        data: volumeData,
        xAxis: 'timestamp',
        yAxis: 'volumeUSD'
      });
    }

    // Gas cost over time chart
    if (parameters.metrics?.includes('gas')) {
      const gasData = this.prepareGasChartData(transactions, parameters.groupBy);
      charts.push({
        type: 'line',
        title: 'Gas Costs Over Time',
        data: gasData,
        xAxis: 'timestamp',
        yAxis: 'gasCostUSD'
      });
    }

    // Transaction types pie chart
    const typeData = this.prepareTypeChartData(transactions);
    charts.push({
      type: 'pie',
      title: 'Transaction Types Distribution',
      data: typeData,
      xAxis: 'type',
      yAxis: 'count'
    });

    return charts;
  }

  private prepareVolumeChartData(transactions: Transaction[], groupBy?: string): Array<{ [key: string]: any }> {
    const data: Array<{ [key: string]: any }> = [];

    transactions.forEach(tx => {
      const volume = Math.max(parseFloat(tx.value),
        tx.tokenTransfers.reduce((sum, transfer) => sum + transfer.valueUSD, 0));

      data.push({
        timestamp: tx.timestamp,
        volumeUSD: volume,
        type: tx.type
      });
    });

    return data;
  }

  private prepareGasChartData(transactions: Transaction[], groupBy?: string): Array<{ [key: string]: any }> {
    return transactions.map(tx => ({
      timestamp: tx.timestamp,
      gasCostUSD: parseFloat(tx.gasCost),
      gasUsed: parseInt(tx.gasUsed),
      gasPrice: parseFloat(tx.gasPrice)
    }));
  }

  private prepareTypeChartData(transactions: Transaction[]): Array<{ [key: string]: any }> {
    const typeCounts: { [type: string]: number } = {};

    transactions.forEach(tx => {
      typeCounts[tx.type] = (typeCounts[tx.type] || 0) + 1;
    });

    return Object.entries(typeCounts).map(([type, count]) => ({
      type,
      count
    }));
  }

  private async generateTables(transactions: Transaction[], parameters: ReportParameters): Promise<TableData[]> {
    const tables: TableData[] = [];

    // Recent transactions table
    const recentTransactions = transactions.slice(0, 50);
    tables.push({
      title: 'Recent Transactions',
      headers: ['Hash', 'Type', 'Status', 'Value (USD)', 'Gas Cost (USD)', 'Timestamp'],
      rows: recentTransactions.map(tx => [
        tx.hash.substring(0, 10) + '...',
        tx.type,
        tx.status,
        Math.max(parseFloat(tx.value),
          tx.tokenTransfers.reduce((sum, transfer) => sum + transfer.valueUSD, 0)).toFixed(2),
        parseFloat(tx.gasCost).toFixed(4),
        new Date(tx.timestamp).toISOString()
      ]),
      sortable: true,
      filterable: true
    });

    return tables;
  }

  private async generateInsights(transactions: Transaction[], analytics: TransactionAnalytics): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Success rate insight
    if (analytics.successRate < 95) {
      insights.push({
        type: 'risk',
        title: 'Low Success Rate Detected',
        description: `Transaction success rate is ${analytics.successRate.toFixed(1)}%, which is below the optimal threshold of 95%`,
        impact: analytics.successRate < 90 ? 'high' : 'medium',
        confidence: 85,
        data: { successRate: analytics.successRate },
        recommendation: 'Review failed transactions and consider adjusting gas settings'
      });
    }

    // High gas cost insight
    if (analytics.averageGasCost > 10) {
      insights.push({
        type: 'efficiency',
        title: 'High Average Gas Costs',
        description: `Average gas cost is $${analytics.averageGasCost.toFixed(2)}, which may indicate inefficiency`,
        impact: 'medium',
        confidence: 75,
        data: { averageGasCost: analytics.averageGasCost },
        recommendation: 'Consider optimizing transaction timing or using gas optimization tools'
      });
    }

    return insights;
  }

  private async generateRecommendations(transactions: Transaction[], analytics: TransactionAnalytics): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Gas optimization recommendation
    if (analytics.averageGasCost > 5) {
      recommendations.push({
        type: 'cost_optimization',
        title: 'Optimize Gas Usage',
        description: 'Implement gas optimization strategies to reduce transaction costs',
        expectedBenefit: 'Reduce gas costs by 15-30%',
        implementation: 'Use gas price prediction tools and optimize transaction timing',
        priority: 'medium',
        estimatedSavings: analytics.totalGasCost * 0.2
      });
    }

    // Diversification recommendation
    const transactionTypes = new Set(transactions.map(tx => tx.type));
    if (transactionTypes.size === 1) {
      recommendations.push({
        type: 'strategy',
        title: 'Diversify Transaction Types',
        description: 'Consider diversifying DeFi strategies beyond a single transaction type',
        expectedBenefit: 'Reduce risk and potentially increase returns',
        implementation: 'Explore yield farming, liquidity provision, and other DeFi opportunities',
        priority: 'low'
      });
    }

    return recommendations;
  }

  private generateReportTitle(parameters: ReportParameters): string {
    const typeTitles: { [key in ReportType]: string } = {
      transaction_history: 'Transaction History Report',
      volume_analysis: 'Volume Analysis Report',
      gas_analysis: 'Gas Analysis Report',
      profit_loss: 'Profit & Loss Report',
      mev_analysis: 'MEV Analysis Report',
      security_audit: 'Security Audit Report',
      performance_summary: 'Performance Summary Report',
      custom: 'Custom Transaction Report'
    };

    return typeTitles[parameters.type];
  }

  private generateReportDescription(parameters: ReportParameters): string {
    const startDate = new Date(parameters.timeRange.start).toLocaleDateString();
    const endDate = new Date(parameters.timeRange.end).toLocaleDateString();

    let description = `Transaction report covering the period from ${startDate} to ${endDate}`;

    if (parameters.address) {
      description += ` for address ${parameters.address}`;
    } else if (parameters.addresses && parameters.addresses.length > 0) {
      description += ` for ${parameters.addresses.length} addresses`;
    }

    return description;
  }

  private async detectSuspiciousPatterns(transaction: Transaction): Promise<string[]> {
    const warnings: string[] = [];

    // Check for high gas price
    const gasPrice = parseFloat(transaction.gasPrice);
    if (gasPrice > 20e9) { // 20 Gwei
      warnings.push('High gas price detected');
    }

    // Check for high value transfer to unknown address
    const value = parseFloat(transaction.value);
    if (value > 100000 && transaction.metadata.contractType === 'other') {
      warnings.push('High value transfer to unknown contract');
    }

    return warnings;
  }

  // Cache management
  async clearCache(): Promise<void> {
    try {
      this.cache.clear();
      this.reports.clear();
      logger.info('Transaction service cache cleared');
    } catch (error) {
      logger.error('Failed to clear transaction cache', { error: error.message });
      throw error;
    }
  }
}

// Factory function
export function createTransactionService(
  tokenService: BscTokenService,
  tradingService: BscTradingService,
  liquidityService: BscLiquidityService,
  yieldService: BscYieldService,
  subgraphClient: PancakeSwapSubgraphClient,
  cacheService: ICache
): TransactionService {
  return new TransactionService(
    tokenService,
    tradingService,
    liquidityService,
    yieldService,
    subgraphClient,
    cacheService
  );
}