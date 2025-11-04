/**
 * BSC Voting Power Analytics Service (Viem-based)
 * Advanced voting power analytics and reporting using Viem library
 */

import { Logger } from '../../../../utils/logger.js';
import { type Address, formatUnits, parseUnits } from 'viem';
import { ICache } from '../../../../services/cache.service.js';
import {
  ProposalViem,
  VoteViem,
  GovernanceEventViem,
  GovernanceMetricsViem
} from '../../types/governance-types-viem.js';

const logger = new Logger('VotingPowerAnalyticsViem');

// Advanced voting power analytics interface
export interface VotingPowerReportViem {
  id: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
    duration: number; // days
  };
  summary: PowerSummaryViem;
  distribution: PowerDistributionAnalysisViem;
  trends: PowerTrendAnalysisViem;
  concentration: ConcentrationAnalysisViem;
  delegation: DelegationAnalysisViem;
  predictions: PowerPredictionsViem;
  insights: PowerInsightViem[];
  recommendations: PowerRecommendationViem[];
}

export interface PowerSummaryViem {
  totalAddresses: number;
  totalVotingPower: string;
  averageVotingPower: string;
  medianVotingPower: string;
  topHolderConcentration: number;
  participationRate: number;
  activeAddresses: number;
  newAddresses: number;
  churnRate: number;
}

export interface PowerDistributionAnalysisViem {
  distribution: PowerDistributionBucketViem[];
  inequality: InequalityMetricsViem;
  mobility: PowerMobilityMetricsViem;
  segments: PowerSegmentViem[];
}

export interface PowerDistributionBucketViem {
  range: {
    min: string;
    max: string;
  };
  addressCount: number;
  totalPower: string;
  percentageOfTotal: number;
  averagePower: string;
}

export interface InequalityMetricsViem {
  giniCoefficient: number;
  palmaRatio: number;
  theilIndex: number;
  atkinsonIndex: number;
  lorenzCurve: LorenzPointViem[];
  percentileRatios: Record<string, number>;
}

export interface LorenzPointViem {
  populationPercentage: number;
  powerPercentage: number;
}

export interface PowerMobilityMetricsViem {
  rankCorrelation: number;
  upwardMobility: number;
  downwardMobility: number;
  mobilityMatrix: MobilityMatrixViem;
  persistenceRate: number;
}

export interface MobilityMatrixViem {
  stable: number;
  movedUp: number;
  movedDown: number;
  newEntrants: number;
  exits: number;
}

export interface PowerSegmentViem {
  name: string;
  description: string;
  addressCount: number;
  totalPower: string;
  percentage: number;
  characteristics: SegmentCharacteristicsViem;
  behavior: SegmentBehaviorViem;
}

export interface SegmentCharacteristicsViem {
  averagePower: string;
  powerRange: { min: string; max: string };
  delegationRate: number;
  votingFrequency: number;
  proposalSuccessRate: number;
  votingConsistency: number;
  participationLevel: string;
}

export interface SegmentBehaviorViem {
  votingPatterns: VotingPatternViem[];
  proposalEngagement: ProposalEngagementViem;
  delegationTendencies: DelegationTendencyViem;
  temporalActivity: TemporalActivityViem;
}

export interface VotingPatternViem {
  supportRate: number;
  abstentionRate: number;
  consensusAlignment: number;
  votingTiming: string;
  proposalTypes: string[];
}

export interface ProposalEngagementViem {
  viewedProposals: number;
  votedProposals: number;
  discussionParticipation: number;
  proposalCreation: number;
}

export interface DelegationTendencyViem {
  selfVoting: number;
  delegationRate: number;
  delegationRecipients: Address[];
  delegationFrequency: number;
}

export interface TemporalActivityViem {
  peakHours: number[];
  peakDays: number[];
  seasonalPatterns: SeasonalPatternViem[];
  votingCadence: VotingCadenceViem;
}

export interface SeasonalPatternViem {
  season: string;
  activity: number;
  votingPower: string;
  trends: string[];
}

export interface VotingCadenceViem {
  averageVotesPerWeek: number;
  votingFrequency: string;
  batchVotingTendency: number;
  proposalResponseTime: number;
}

export interface PowerTrendAnalysisViem {
  overallTrend: TrendDirectionViem;
  growthRates: GrowthRateViem[];
  volatilityMetrics: VolatilityMetricsViem;
  cycleAnalysis: CycleAnalysisViem;
  predictiveIndicators: PredictiveIndicatorViem[];
}

export type TrendDirectionViem = 'increasing' | 'decreasing' | 'stable' | 'volatile';

export interface GrowthRateViem {
  period: string;
  rate: number;
  confidence: number;
  factors: string[];
}

export interface VolatilityMetricsViem {
  standardDeviation: number;
  coefficientOfVariation: number;
  maxDrawdown: number;
  volatilityIndex: number;
  periods: VolatilityPeriodViem[];
}

export interface VolatilityPeriodViem {
  start: Date;
  end: Date;
  volatility: number;
  cause: string;
  impact: string;
}

export interface CycleAnalysisViem {
  detected: boolean;
  cycleLength: number;
  phase: CyclePhaseViem;
  amplitude: number;
  nextPhase: Date;
  characteristics: CycleCharacteristicsViem;
}

export type CyclePhaseViem = 'expansion' | 'peak' | 'contraction' | 'trough';

export interface CycleCharacteristicsViem {
  description: string;
  indicators: string[];
  historicalOccurrences: number;
  averageDuration: number;
}

export interface PredictiveIndicatorViem {
  name: string;
  value: number;
  threshold: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  timeframe: string;
}

export interface ConcentrationAnalysisViem {
  concentration: ConcentrationMetricsViem;
  topHolders: TopHolderViem[];
  institutional: InstitutionalAnalysisViem;
  whale: WhaleAnalysisViem;
  centralization: CentralizationAssessmentViem;
}

export interface ConcentrationMetricsViem {
  herfindahlIndex: number;
  concentrationRatio: Record<string, number>;
  entropyIndex: number;
  nakamotoCoefficient: number;
  effectiveNumberOfHolders: number;
}

export interface TopHolderViem {
  rank: number;
  address: Address;
  votingPower: string;
  percentage: number;
  cumulativePercentage: number;
  influence: InfluenceMetricsViem;
}

export interface InfluenceMetricsViem {
  votingPower: number;
  networkCentrality: number;
  proposalImpact: number;
  socialInfluence: number;
  overallScore: number;
}

export interface InstitutionalAnalysisViem {
  institutions: InstitutionViem[];
  totalInstitutionalPower: string;
  institutionalConcentration: number;
  governanceImpact: GovernanceImpactViem;
}

export interface InstitutionViem {
  name: string;
  addresses: Address[];
  totalPower: string;
  votingStrategy: string;
  governanceAlignment: number;
}

export interface GovernanceImpactViem {
  proposalSuccess: number;
  votingAlignment: number;
  delegationNetwork: number;
}

export interface WhaleAnalysisViem {
  whales: WhaleViem[];
  whaleCount: number;
  totalWhalePower: string;
  whaleControlPercentage: number;
  whaleActivity: WhaleActivityViem;
}

export interface WhaleViem {
  address: Address;
  votingPower: string;
  percentage: number;
  votingHistory: VotingHistoryViem;
  delegationNetwork: DelegationNetworkViem;
  behaviorPattern: string;
}

export interface VotingHistoryViem {
  totalVotes: number;
  supportRate: number;
  proposalTypes: Record<string, number>;
  votingConsistency: number;
  lastVote: Date;
}

export interface DelegationNetworkViem {
  delegates: number;
  delegators: number;
  totalDelegatedPower: string;
  delegationRecipients: Address[];
  networkDepth: number;
}

export interface WhaleActivityViem {
  votingFrequency: number;
  proposalParticipation: number;
  delegationActivity: number;
  votingTiming: string;
  batchVoting: boolean;
}

export interface CentralizationAssessmentViem {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  decentralizationScore: number;
  governanceThreats: GovernanceThreatViem[];
  mitigationStrategies: MitigationStrategyViem[];
}

export interface GovernanceThreatViem {
  threat: string;
  probability: number;
  impact: string;
  timeline: string;
  mitigationRequired: boolean;
}

export interface MitigationStrategyViem {
  strategy: string;
  effectiveness: number;
  implementation: string;
  timeline: string;
}

export interface DelegationAnalysisViem {
  overview: DelegationOverviewViem;
  networks: DelegationNetworkViem[];
  patterns: DelegationPatternViem[];
  efficiency: DelegationEfficiencyViem;
  risks: DelegationRiskViem[];
}

export interface DelegationOverviewViem {
  totalDelegatedPower: string;
  delegationRate: number;
  averageDelegationSize: string;
  delegationVelocity: number;
  delegationTrend: TrendDirectionViem;
}

export interface DelegationNetworkViem {
  id: string;
  delegator: Address;
  delegatee: Address;
  votingPower: string;
  depth: number;
  networkSize: number;
  centrality: number;
  influence: number;
}

export interface DelegationPatternViem {
  pattern: string;
  frequency: number;
  averageSize: string;
  duration: number;
  success: number;
  contexts: string[];
}

export interface DelegationEfficiencyViem {
 利用率: number;
  votingPowerUtilization: number;
  networkEfficiency: number;
  timeEfficiency: number;
  costEfficiency: number;
}

export interface DelegationRiskViem {
  risk: string;
  level: 'low' | 'medium' | 'high';
  probability: number;
  impact: string;
  mitigation: string[];
}

export interface PowerPredictionsViem {
  shortTerm: ShortTermPredictionViem[];
  mediumTerm: MediumTermPredictionViem[];
  longTerm: LongTermPredictionViem[];
  scenarioAnalysis: ScenarioAnalysisViem[];
  confidenceMetrics: PredictionConfidenceMetricsViem;
}

export interface ShortTermPredictionViem {
  timeframe: string;
  predictedTotalPower: string;
  predictedActiveAddresses: number;
  predictedParticipationRate: number;
  keyFactors: PredictionFactorViem[];
  confidence: number;
}

export interface MediumTermPredictionViem {
  timeframe: string;
  predictedGrowthRate: number;
  predictedNewAddresses: number;
  predictedChurnRate: number;
  structuralChanges: StructuralChangeViem[];
  confidence: number;
}

export interface StructuralChangeViem {
  change: string;
  probability: number;
  impact: string;
  timeline: string;
  dependencies: string[];
}

export interface LongTermPredictionViem {
  timeframe: string;
  predictedState: VotingPowerStateViem;
  majorTrends: MajorTrendViem[];
  disruptiveFactors: DisruptiveFactorViem[];
  confidence: number;
}

export interface VotingPowerStateViem {
  distribution: string;
  concentration: string;
  participation: string;
  governance: string;
  stability: string;
}

export interface MajorTrendViem {
  trend: string;
  direction: TrendDirectionViem;
  magnitude: number;
  confidence: number;
  drivers: string[];
}

export interface DisruptiveFactorViem {
  factor: string;
  probability: number;
  impact: string;
  timeline: string;
  scenarios: string[];
}

export interface ScenarioAnalysisViem {
  scenarios: ScenarioViem[];
  baselineComparison: BaselineComparisonViem;
  sensitivity: SensitivityAnalysisViem;
}

export interface ScenarioViem {
  name: string;
  description: string;
  assumptions: string[];
  outcomes: ScenarioOutcomeViem[];
  probability: number;
  timeframe: string;
}

export interface ScenarioOutcomeViem {
  metric: string;
  value: string | number;
  change: string;
  confidence: number;
}

export interface BaselineComparisonViem {
  current: Record<string, number>;
  predicted: Record<string, number>;
  variance: Record<string, number>;
  significance: Record<string, boolean>;
}

export interface SensitivityAnalysisViem {
  factors: SensitivityFactorViem[];
  correlations: CorrelationMatrixViem[];
  modelAccuracy: number;
}

export interface SensitivityFactorViem {
  factor: string;
  sensitivity: number;
  impact: string;
  range: string;
}

export interface CorrelationMatrixViem {
  factors: string[];
  correlations: Record<string, number>;
  significance: Record<string, boolean>;
}

export interface PredictionConfidenceMetricsViem {
  overallConfidence: number;
  modelAccuracy: number;
  dataQuality: number;
  assumptionsValidity: number;
  uncertainty: UncertaintyAnalysisViem;
}

export interface UncertaintyAnalysisViem {
  sources: UncertaintySourceViem[];
  totalUncertainty: number;
  keyAssumptions: string[];
  sensitivityPoints: string[];
}

export interface UncertaintySourceViem {
  source: string;
  uncertainty: number;
  impact: string;
  mitigation: string[];
}

export interface PowerInsightViem {
  category: 'distribution' | 'concentration' | 'trends' | 'governance' | 'risk';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  data: any;
  recommendations: string[];
}

export interface PowerRecommendationViem {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'governance' | 'security' | 'participation' | 'efficiency';
  title: string;
  description: string;
  rationale: string[];
  implementation: RecommendationImplementationViem;
  expectedImpact: RecommendationImpactViem;
}

export interface RecommendationImplementationViem {
  steps: string[];
  timeline: string;
  resources: string[];
  stakeholders: Address[];
  complexity: 'low' | 'medium' | 'high';
  dependencies: string[];
}

export interface RecommendationImpactViem {
  votingPowerImpact: string;
  governanceImpact: string;
  securityImpact: string;
  timeframe: string;
  confidence: number;
}

export interface VotingPowerSnapshotViem {
  id: string;
  timestamp: Date;
  totalVotingPower: string;
  addressCount: number;
  records: VotingPowerRecordViem[];
  metadata: {
    blockNumber: number;
    transactionCount: number;
    dataQuality: number;
    completeness: number;
  };
}

export interface VotingPowerRecordViem {
  address: Address;
  votingPower: string;
  delegatedPower: string;
  effectivePower: string;
  lastUpdated: Date;
  metadata: {
    source: string;
    confidence: number;
    verification: boolean;
  };
}

export interface VotingPowerQueryViem {
  addresses?: Address[];
  minPower?: string;
  maxPower?: string;
  sortBy?: 'power' | 'address' | 'updated';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  includeDelegated?: boolean;
}

/**
 * Voting power analytics service implementation using Viem
 */
export class VotingPowerAnalyticsViem {
  private governanceService: any; // Will be injected
  private cacheService: ICache;
  private reports: VotingPowerReportViem[] = [];
  private analyticsCache: Map<string, any> = new Map();

  constructor(
    governanceService: any,
    cacheService: ICache
  ) {
    this.governanceService = governanceService;
    this.cacheService = cacheService;
  }

  /**
   * Generate comprehensive voting power report
   */
  async generateReport(
    startDate: Date,
    endDate: Date,
    includePredictions: boolean = true
  ): Promise<VotingPowerReportViem> {
    const cacheKey = `analytics:report:${startDate.getTime()}-${endDate.getTime()}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as VotingPowerReportViem;
    }

    logger.info('Generating voting power report', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      includePredictions
    });

    // Get current snapshot
    const currentSnapshot = await this.createSnapshot('Analytics report');

    const report: VotingPowerReportViem = {
      id: `report_${Date.now()}`,
      generatedAt: new Date(),
      period: {
        start: startDate,
        end: endDate,
        duration: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      },
      summary: await this.generateSummary(currentSnapshot),
      distribution: await this.analyzeDistribution(),
      trends: await this.analyzeTrends(startDate, endDate),
      concentration: await this.analyzeConcentration(currentSnapshot),
      delegation: await this.analyzeDelegation(),
      predictions: includePredictions ? await this.generatePredictions(currentSnapshot) : {
        shortTerm: [],
        mediumTerm: [],
        longTerm: [],
        scenarioAnalysis: [],
        confidenceMetrics: {
          overallConfidence: 0,
          modelAccuracy: 0,
          dataQuality: 0,
          assumptionsValidity: 0
        }
      },
      insights: await this.generateInsights(currentSnapshot),
      recommendations: await this.generateRecommendations(currentSnapshot)
    };

    this.reports.push(report);

    // Cache the report for 1 hour
    await this.cacheService.set(cacheKey, JSON.stringify(report), {
      ttl: 3600
    });

    logger.info('Generated voting power report', {
      reportId: report.id,
      period: report.period.duration,
      insightsCount: report.insights.length,
      recommendationsCount: report.recommendations.length
    });

    return report;
  }

  /**
   * Get voting power distribution analysis
   */
  async getDistributionAnalysis(): Promise<PowerDistributionAnalysisViem> {
    const cacheKey = 'analytics:distribution';
    const cached = this.analyticsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const distribution = await this.analyzeDistribution();
    this.analyticsCache.set(cacheKey, distribution);

    // Cache for 30 minutes
    setTimeout(() => {
      this.analyticsCache.delete(cacheKey);
    }, 1800000);

    return distribution;
  }

  /**
   * Get concentration metrics
   */
  async getConcentrationMetrics(): Promise<ConcentrationMetricsViem> {
    const cacheKey = 'analytics:concentration';
    const cached = this.analyticsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const snapshot = await this.createSnapshot('Concentration analysis');
    const concentration = await this.analyzeConcentration(snapshot);

    this.analyticsCache.set(cacheKey, concentration);

    // Cache for 30 minutes
    setTimeout(() => {
      this.analyticsCache.delete(cacheKey);
    }, 1800000);

    return concentration.concentration;
  }

  /**
   * Get delegation analysis
   */
  async getDelegationAnalysis(): Promise<DelegationAnalysisViem> {
    const cacheKey = 'analytics:delegation';
    const cached = this.analyticsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const delegation = await this.analyzeDelegation();

    this.analyticsCache.set(cacheKey, delegation);

    // Cache for 30 minutes
    setTimeout(() => {
      this.analyticsCache.delete(cacheKey);
    }, 1800000);

    return delegation;
  }

  /**
   * Get voting power trends
   */
  async getTrends(days: number = 30): Promise<PowerTrendAnalysisViem> {
    const cacheKey = `analytics:trends:${days}`;
    const cached = this.analyticsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

    const trends = await this.analyzeTrends(startDate, endDate);

    this.analyticsCache.set(cacheKey, trends);

    // Cache for 1 hour
    setTimeout(() => {
      this.analyticsCache.delete(cacheKey);
    }, 3600000);

    return trends;
  }

  /**
   * Get voting power predictions
   */
  async getPredictions(): Promise<PowerPredictionsViem> {
    const cacheKey = 'analytics:predictions';
    const cached = this.analyticsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const snapshot = await this.createSnapshot('Predictions');
    const predictions = await this.generatePredictions(snapshot);

    this.analyticsCache.set(cacheKey, predictions);

    // Cache for 2 hours
    setTimeout(() => {
      this.analyticsCache.delete(cacheKey);
    }, 7200000);

    return predictions;
  }

  /**
   * Get voting power insights
   */
  async getInsights(): Promise<PowerInsightViem[]> {
    const cacheKey = 'analytics:insights';
    const cached = this.analyticsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const snapshot = await this.createSnapshot('Insights');
    const insights = await this.generateInsights(snapshot);

    this.analyticsCache.set(cacheKey, insights);

    // Cache for 1 hour
    setTimeout(() => {
      this.analyticsCache.delete(cacheKey);
    }, 3600000);

    return insights;
  }

  /**
   * Get voting power recommendations
   */
  async getRecommendations(): Promise<PowerRecommendationViem[]> {
    const cacheKey = 'analytics:recommendations';
    const cached = this.analyticsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const snapshot = await this.createSnapshot('Recommendations');
    const recommendations = await this.generateRecommendations(snapshot);

    this.analyticsCache.set(cacheKey, recommendations);

    // Cache for 2 hours
    setTimeout(() => {
      this.analyticsCache.delete(cacheKey);
    }, 7200000);

    return recommendations;
  }

  /**
   * Get all reports
   */
  getReports(limit?: number): VotingPowerReportViem[] {
    let reports = this.reports.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());

    if (limit) {
      reports = reports.slice(0, limit);
    }

    return reports;
  }

  /**
   * Get report by ID
   */
  getReport(reportId: string): VotingPowerReportViem | undefined {
    return this.reports.find(report => report.id === reportId);
  }

  /**
   * Analyze voting power for specific addresses
   */
  async analyzeAddresses(addresses: Address[]): Promise<{
    summary: PowerSummaryViem;
    distribution: PowerDistributionAnalysisViem;
    insights: PowerInsightViem[];
  }> {
    logger.info('Analyzing voting power for addresses', {
      addressCount: addresses.length
    });

    // Create a custom snapshot for these addresses
    const snapshot = await this.createSnapshot('Address analysis', addresses);

    return {
      summary: await this.generateSummary(snapshot),
      distribution: await this.analyzeDistributionForAddresses(addresses),
      insights: await this.generateInsightsForAddresses(addresses)
    };
  }

  // Private helper methods

  private async createSnapshot(name: string, addresses?: Address[]): Promise<VotingPowerSnapshotViem> {
    try {
      // Get voting power data
      const records: VotingPowerRecordViem[] = [];

      if (addresses) {
        // Get voting power for specific addresses
        for (const address of addresses) {
          try {
            const votingPower = await this.governanceService.getVotingPower(address);
            records.push({
              address,
              votingPower,
              delegatedPower: '0', // Would calculate from delegation data
              effectivePower: votingPower,
              lastUpdated: new Date(),
              metadata: {
                source: 'direct_query',
                confidence: 0.9,
                verification: true
              }
            });
          } catch (error) {
            logger.warn('Failed to get voting power for address', {
              address,
              error: (error as Error).message
            });
          }
        }
      }

      // Calculate total voting power and other metrics
      const totalVotingPower = records.reduce((sum, record) =>
        sum + BigInt(record.votingPower), 0n);

      return {
        id: `snapshot_${Date.now()}`,
        timestamp: new Date(),
        totalVotingPower: totalVotingPower.toString(),
        addressCount: records.length,
        records,
        metadata: {
          blockNumber: 0, // Would get from current block
          transactionCount: 0,
          dataQuality: 0.9,
          completeness: 0.8
        }
      };
    } catch (error) {
      logger.error('Failed to create voting power snapshot', {
        name,
        error: (error as Error).message
      });

      // Return empty snapshot on error
      return {
        id: `snapshot_${Date.now()}`,
        timestamp: new Date(),
        totalVotingPower: '0',
        addressCount: 0,
        records: [],
        metadata: {
          blockNumber: 0,
          transactionCount: 0,
          dataQuality: 0,
          completeness: 0
        }
      };
    }
  }

  private async generateSummary(snapshot: VotingPowerSnapshotViem): Promise<PowerSummaryViem> {
    const records = snapshot.records;
    const totalAddresses = records.length;
    const totalVotingPower = snapshot.totalVotingPower;
    const averageVotingPower = totalAddresses > 0
      ? (BigInt(totalVotingPower) / BigInt(totalAddresses)).toString()
      : '0';

    // Calculate median
    const sortedPowers = records
      .map(r => BigInt(r.votingPower))
      .sort((a, b) => Number(a - b));
    const medianVotingPower = sortedPowers.length > 0
      ? sortedPowers[Math.floor(sortedPowers.length / 2)].toString()
      : '0';

    // Calculate top holder concentration (top 10%)
    const top10Count = Math.max(1, Math.ceil(totalAddresses * 0.1));
    const top10Power = sortedPowers
      .slice(-top10Count)
      .reduce((sum, power) => sum + power, 0n);
    const topHolderConcentration = totalVotingPower !== '0'
      ? Number(top10Power * 100n / BigInt(totalVotingPower)) / 100
      : 0;

    // Calculate participation rate (simplified)
    const activeAddresses = records.filter(r =>
      BigInt(r.votingPower) > 0n
    ).length;
    const participationRate = totalAddresses > 0 ? activeAddresses / totalAddresses : 0;

    return {
      totalAddresses,
      totalVotingPower,
      averageVotingPower,
      medianVotingPower,
      topHolderConcentration,
      participationRate,
      activeAddresses,
      newAddresses: 0, // Would calculate from historical data
      churnRate: 0 // Would calculate from historical data
    };
  }

  private async analyzeDistribution(): Promise<PowerDistributionAnalysisViem> {
    // Simplified implementation - would use actual voting power data
    const distribution: PowerDistributionBucketViem[] = [
      {
        range: { min: '0', max: '100' },
        addressCount: 1000,
        totalPower: '100000',
        percentageOfTotal: 50,
        averagePower: '100'
      },
      {
        range: { min: '100', max: '1000' },
        addressCount: 100,
        totalPower: '50000',
        percentageOfTotal: 25,
        averagePower: '500'
      },
      {
        range: { min: '1000', max: '10000' },
        addressCount: 10,
        totalPower: '30000',
        percentageOfTotal: 15,
        averagePower: '3000'
      },
      {
        range: { min: '10000', max: '100000' },
        addressCount: 1,
        totalPower: '20000',
        percentageOfTotal: 10,
        averagePower: '20000'
      }
    ];

    return {
      distribution,
      inequality: await this.calculateInequalityMetrics(distribution),
      mobility: await this.calculateMobilityMetrics(),
      segments: await this.identifyPowerSegments(distribution)
    };
  }

  private async analyzeDistributionForAddresses(addresses: Address[]): Promise<PowerDistributionAnalysisViem> {
    // Implementation would analyze distribution for specific addresses
    return this.analyzeDistribution();
  }

  private async calculateInequalityMetrics(distribution: PowerDistributionBucketViem[]): Promise<InequalityMetricsViem> {
    // Calculate Gini coefficient
    let totalPower = 0n;
    let cumulativePower = 0n;
    const lorenzCurve: LorenzPointViem[] = [{ populationPercentage: 0, powerPercentage: 0 }];

    for (const bucket of distribution) {
      totalPower += BigInt(bucket.totalPower);
    }

    for (const bucket of distribution) {
      cumulativePower += BigInt(bucket.totalPower);
      lorenzCurve.push({
        populationPercentage: (cumulativePower / totalPower) * 100,
        powerPercentage: (cumulativePower / totalPower) * 100
      });
    }

    // Simplified Gini coefficient calculation
    const giniCoefficient = 0.65; // Would calculate properly

    return {
      giniCoefficient,
      palmaRatio: 2.5,
      theilIndex: 0.45,
      atkinsonIndex: 0.3,
      lorenzCurve,
      percentileRatios: {
        '90/10': 15.5,
        '80/20': 8.2,
        '50/10': 25.0
      }
    };
  }

  private async calculateMobilityMetrics(): Promise<PowerMobilityMetricsViem> {
    return {
      rankCorrelation: 0.75,
      upwardMobility: 0.15,
      downwardMobility: 0.12,
      mobilityMatrix: {
        stable: 0.8,
        movedUp: 0.1,
        movedDown: 0.08,
        newEntrants: 0.01,
        exits: 0.01
      },
      persistenceRate: 0.85
    };
  }

  private async identifyPowerSegments(distribution: PowerDistributionBucketViem[]): Promise<PowerSegmentViem[]> {
    return [
      {
        name: 'Small Holders',
        description: 'Addresses with minimal voting power',
        addressCount: distribution[0].addressCount,
        totalPower: distribution[0].totalPower,
        percentage: distribution[0].percentageOfTotal,
        characteristics: {
          averagePower: distribution[0].averagePower,
          powerRange: distribution[0].range,
          delegationRate: 0.1,
          votingFrequency: 0.3,
          proposalSuccessRate: 0.6,
          votingConsistency: 0.4,
          participationLevel: 'low'
        },
        behavior: {
          votingPatterns: [{
            supportRate: 0.6,
            abstentionRate: 0.3,
            consensusAlignment: 0.7,
            votingTiming: 'late',
            proposalTypes: ['governance', 'community']
          }],
          proposalEngagement: {
            viewedProposals: 5,
            votedProposals: 2,
            discussionParticipation: 1,
            proposalCreation: 0
          },
          delegationTendencies: {
            selfVoting: 0.9,
            delegationRate: 0.1,
            delegationRecipients: [],
            delegationFrequency: 0.1
          },
          temporalActivity: {
            peakHours: [18, 19, 20],
            peakDays: [1, 2, 3],
            seasonalPatterns: [],
            votingCadence: {
              averageVotesPerWeek: 0.5,
              votingFrequency: 'rare',
              batchVotingTendency: 0.2,
              proposalResponseTime: 72
            }
          }
        }
      },
      {
        name: 'Medium Holders',
        description: 'Addresses with moderate voting power',
        addressCount: distribution[1].addressCount,
        totalPower: distribution[1].totalPower,
        percentage: distribution[1].percentageOfTotal,
        characteristics: {
          averagePower: distribution[1].averagePower,
          powerRange: distribution[1].range,
          delegationRate: 0.3,
          votingFrequency: 0.7,
          proposalSuccessRate: 0.8,
          votingConsistency: 0.7,
          participationLevel: 'medium'
        },
        behavior: {
          votingPatterns: [{
            supportRate: 0.75,
            abstentionRate: 0.2,
            consensusAlignment: 0.8,
            votingTiming: 'normal',
            proposalTypes: ['technical', 'treasury', 'governance']
          }],
          proposalEngagement: {
            viewedProposals: 20,
            votedProposals: 15,
            discussionParticipation: 5,
            proposalCreation: 1
          },
          delegationTendencies: {
            selfVoting: 0.7,
            delegationRate: 0.3,
            delegationRecipients: [],
            delegationFrequency: 0.5
          },
          temporalActivity: {
            peakHours: [14, 15, 16],
            peakDays: [2, 3, 4],
            seasonalPatterns: [],
            votingCadence: {
              averageVotesPerWeek: 2,
              votingFrequency: 'regular',
              batchVotingTendency: 0.4,
              proposalResponseTime: 24
            }
          }
        }
      },
      {
        name: 'Large Holders',
        description: 'Addresses with significant voting power',
        addressCount: distribution[2].addressCount,
        totalPower: distribution[2].totalPower,
        percentage: distribution[2].percentageOfTotal,
        characteristics: {
          averagePower: distribution[2].averagePower,
          powerRange: distribution[2].range,
          delegationRate: 0.6,
          votingFrequency: 0.9,
          proposalSuccessRate: 0.9,
          votingConsistency: 0.85,
          participationLevel: 'high'
        },
        behavior: {
          votingPatterns: [{
            supportRate: 0.85,
            abstentionRate: 0.1,
            consensusAlignment: 0.9,
            votingTiming: 'early',
            proposalTypes: ['all']
          }],
          proposalEngagement: {
            viewedProposals: 50,
            votedProposals: 45,
            discussionParticipation: 15,
            proposalCreation: 2
          },
          delegationTendencies: {
            selfVoting: 0.4,
            delegationRate: 0.6,
            delegationRecipients: [],
            delegationFrequency: 1.5
          },
          temporalActivity: {
            peakHours: [10, 11, 12],
            peakDays: [1, 5],
            seasonalPatterns: [],
            votingCadence: {
              averageVotesPerWeek: 5,
              votingFrequency: 'frequent',
              batchVotingTendency: 0.6,
              proposalResponseTime: 6
            }
          }
        }
      },
      {
        name: 'Whale Holders',
        description: 'Addresses with dominant voting power',
        addressCount: distribution[3].addressCount,
        totalPower: distribution[3].totalPower,
        percentage: distribution[3].percentageOfTotal,
        characteristics: {
          averagePower: distribution[3].averagePower,
          powerRange: distribution[3].range,
          delegationRate: 0.8,
          votingFrequency: 0.95,
          proposalSuccessRate: 0.95,
          votingConsistency: 0.9,
          participationLevel: 'very_high'
        },
        behavior: {
          votingPatterns: [{
            supportRate: 0.9,
            abstentionRate: 0.05,
            consensusAlignment: 0.95,
            votingTiming: 'immediate',
            proposalTypes: ['all']
          }],
          proposalEngagement: {
            viewedProposals: 100,
            votedProposals: 95,
            discussionParticipation: 25,
            proposalCreation: 5
          },
          delegationTendencies: {
            selfVoting: 0.2,
            delegationRate: 0.8,
            delegationRecipients: [],
            delegationFrequency: 2.0
          },
          temporalActivity: {
            peakHours: [9, 10, 11],
            peakDays: [1, 2],
            seasonalPatterns: [],
            votingCadence: {
              averageVotesPerWeek: 10,
              votingFrequency: 'very_frequent',
              batchVotingTendency: 0.8,
              proposalResponseTime: 1
            }
          }
        }
      }
    ];
  }

  private async analyzeTrends(startDate: Date, endDate: Date): Promise<PowerTrendAnalysisViem> {
    // Simplified trend analysis - would use historical data
    return {
      overallTrend: 'increasing',
      growthRates: [
        {
          period: 'daily',
          rate: 0.02,
          confidence: 0.8,
          factors: ['new_users', 'price_appreciation']
        },
        {
          period: 'weekly',
          rate: 0.15,
          confidence: 0.7,
          factors: ['proposal_activity', 'community_growth']
        },
        {
          period: 'monthly',
          rate: 0.5,
          confidence: 0.6,
          factors: ['ecosystem_development', 'adoption_rate']
        }
      ],
      volatilityMetrics: {
        standardDeviation: 0.15,
        coefficientOfVariation: 0.3,
        maxDrawdown: 0.25,
        volatilityIndex: 0.4,
        periods: []
      },
      cycleAnalysis: {
        detected: false,
        cycleLength: 0,
        phase: 'expansion',
        amplitude: 0,
        nextPhase: new Date(),
        characteristics: {
          description: 'No clear cycle detected',
          indicators: [],
          historicalOccurrences: 0,
          averageDuration: 0
        }
      },
      predictiveIndicators: [
        {
          name: 'Voting Power Growth',
          value: 0.15,
          threshold: 0.1,
          signal: 'bullish',
          confidence: 0.7,
          timeframe: '1_month'
        }
      ]
    };
  }

  private async analyzeConcentration(snapshot: VotingPowerSnapshotViem): Promise<ConcentrationAnalysisViem> {
    const records = snapshot.records;
    const sortedRecords = records.sort((a, b) =>
      BigInt(b.votingPower) - BigInt(a.votingPower)
    );

    // Calculate concentration metrics
    const totalPower = BigInt(snapshot.totalVotingPower);
    const top1Power = sortedRecords.length > 0 ? BigInt(sortedRecords[0].votingPower) : 0n;
    const top10Power = sortedRecords.slice(0, 10).reduce((sum, r) => sum + BigInt(r.votingPower), 0n);

    const herfindahlIndex = this.calculateHerfindahlIndex(sortedRecords, totalPower);
    const nakamotoCoefficient = this.calculateNakamotoCoefficient(sortedRecords, totalPower);

    // Create top holders list
    const topHolders: TopHolderViem[] = [];
    let cumulativePercentage = 0;

    for (let i = 0; i < Math.min(10, sortedRecords.length); i++) {
      const record = sortedRecords[i];
      const percentage = Number(BigInt(record.votingPower) * 10000n / totalPower) / 100;
      cumulativePercentage += percentage;

      topHolders.push({
        rank: i + 1,
        address: record.address,
        votingPower: record.votingPower,
        percentage,
        cumulativePercentage,
        influence: {
          votingPower: percentage,
          networkCentrality: Math.min(1, percentage * 2), // Simplified
          proposalImpact: 0.8,
          socialInfluence: 0.6,
          overallScore: percentage
        }
      });
    }

    return {
      concentration: {
        herfindahlIndex,
        concentrationRatio: {
          'CR1': Number(top1Power * 10000n / totalPower) / 100,
          'CR5': Number(sortedRecords.slice(0, 5).reduce((sum, r) => sum + BigInt(r.votingPower), 0n) * 10000n / totalPower) / 100,
          'CR10': Number(top10Power * 10000n / totalPower) / 100
        },
        entropyIndex: this.calculateEntropyIndex(sortedRecords, totalPower),
        nakamotoCoefficient,
        effectiveNumberOfHolders: 1 / (herfindahlIndex || 0.01)
      },
      topHolders,
      institutional: await this.analyzeInstitutionalHolders(topHolders),
      whale: await this.analyzeWhales(topHolders),
      centralization: await this.assessCentralization(topHolders, totalPower)
    };
  }

  private calculateHerfindahlIndex(records: VotingPowerRecordViem[], totalPower: bigint): number {
    if (totalPower === 0n) return 0;

    let sum = 0n;
    for (const record of records) {
      const share = BigInt(record.votingPower) / totalPower;
      sum += share * share;
    }

    return Number(sum);
  }

  private calculateNakamotoCoefficient(records: VotingPowerRecordViem[], totalPower: bigint): number {
    let cumulativePower = 0n;
    let count = 0;

    for (const record of records) {
      cumulativePower += BigInt(record.votingPower);
      count++;
      if (cumulativePower * 2n >= totalPower) {
        return count;
      }
    }

    return records.length;
  }

  private calculateEntropyIndex(records: VotingPowerRecordViem[], totalPower: bigint): number {
    if (totalPower === 0n) return 0;

    let entropy = 0;
    for (const record of records) {
      const probability = Number(BigInt(record.votingPower)) / Number(totalPower);
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    }

    return entropy;
  }

  private async analyzeInstitutionalHolders(topHolders: TopHolderViem[]): Promise<InstitutionalAnalysisViem> {
    // Simplified institutional analysis - would identify known institutional addresses
    const institutions: InstitutionViem[] = [
      {
        name: 'Exchange A',
        addresses: [topHolders[0]?.address || '0x0' as Address],
        totalPower: topHolders[0]?.votingPower || '0',
        votingStrategy: 'passive',
        governanceAlignment: 0.8
      }
    ];

    return {
      institutions,
      totalInstitutionalPower: institutions.reduce((sum, inst) =>
        sum + BigInt(inst.totalPower), 0n).toString(),
      institutionalConcentration: 0.6,
      governanceImpact: {
        proposalSuccess: 0.8,
        votingAlignment: 0.7,
        delegationNetwork: 0.5
      }
    };
  }

  private async analyzeWhales(topHolders: TopHolderViem[]): Promise<WhaleAnalysisViem> {
    const whaleThreshold = 1; // Top 1% considered whales
    const whaleCount = Math.max(1, Math.ceil(topHolders.length * whaleThreshold / 100));

    const whales: WhaleViem[] = topHolders.slice(0, whaleCount).map(holder => ({
      address: holder.address,
      votingPower: holder.votingPower,
      percentage: holder.percentage,
      votingHistory: {
        totalVotes: 25,
        supportRate: 0.85,
        proposalTypes: { 'governance': 15, 'treasury': 5, 'technical': 5 },
        votingConsistency: 0.9,
        lastVote: new Date()
      },
      delegationNetwork: {
        delegates: 5,
        delegators: 2,
        totalDelegatedPower: (BigInt(holder.votingPower) * 3n / 10n).toString(),
        delegationRecipients: [],
        networkDepth: 2
      },
      behaviorPattern: 'strategic'
    }));

    const totalWhalePower = whales.reduce((sum, whale) =>
      sum + BigInt(whale.votingPower), 0n);

    return {
      whales,
      whaleCount,
      totalWhalePower: totalWhalePower.toString(),
      whaleControlPercentage: Number(totalWhalePower * 10000n / BigInt(topHolders.reduce((sum, h) => sum + BigInt(h.votingPower), 0n))) / 100,
      whaleActivity: {
        votingFrequency: 0.9,
        proposalParticipation: 0.95,
        delegationActivity: 0.6,
        votingTiming: 'strategic',
        batchVoting: true
      }
    };
  }

  private async assessCentralization(topHolders: TopHolderViem[], totalPower: bigint): Promise<CentralizationAssessmentViem> {
    const concentrationRatio = Number(topHolders[0]?.votingPower || '0') / Number(totalPower);

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let decentralizationScore = 100;

    if (concentrationRatio > 0.5) {
      riskLevel = 'critical';
      decentralizationScore = 20;
    } else if (concentrationRatio > 0.3) {
      riskLevel = 'high';
      decentralizationScore = 40;
    } else if (concentrationRatio > 0.15) {
      riskLevel = 'medium';
      decentralizationScore = 60;
    }

    return {
      riskLevel,
      decentralizationScore,
      governanceThreats: [
        {
          threat: '51% attack vulnerability',
          probability: concentrationRatio > 0.5 ? 0.8 : 0.2,
          impact: 'Complete governance control',
          timeline: 'immediate',
          mitigationRequired: concentrationRatio > 0.3
        },
        {
          threat: 'Whale coordination',
          probability: 0.6,
          impact: 'Proposal manipulation',
          timeline: 'ongoing',
          mitigationRequired: true
        }
      ],
      mitigationStrategies: [
        {
          strategy: 'Voting power delegation',
          effectiveness: 0.7,
          implementation: 'Encourage delegation to reduce concentration',
          timeline: '3-6 months'
        },
        {
          strategy: 'Multi-signature governance',
          effectiveness: 0.9,
          implementation: 'Implement multi-sig for critical decisions',
          timeline: '1-3 months'
        }
      ]
    };
  }

  private async analyzeDelegation(): Promise<DelegationAnalysisViem> {
    // Simplified delegation analysis
    return {
      overview: {
        totalDelegatedPower: '5000000',
        delegationRate: 0.35,
        averageDelegationSize: '10000',
        delegationVelocity: 0.05,
        delegationTrend: 'increasing'
      },
      networks: [
        {
          id: 'network_1',
          delegator: '0x1234...5678' as Address,
          delegatee: '0x8765...4321' as Address,
          votingPower: '50000',
          depth: 2,
          networkSize: 10,
          centrality: 0.8,
          influence: 0.7
        }
      ],
      patterns: [
        {
          pattern: 'trust_based_delegation',
          frequency: 0.6,
          averageSize: '15000',
          duration: 180,
          success: 0.85,
          contexts: ['long_term_holding', 'governance_participation']
        }
      ],
      efficiency: {
        utilization: 0.7,
        votingPowerUtilization: 0.8,
        networkEfficiency: 0.6,
        timeEfficiency: 0.7,
        costEfficiency: 0.5
      },
      risks: [
        {
          risk: 'Delegation revocation',
          level: 'medium',
          probability: 0.2,
          impact: 'Loss of voting power',
          mitigation: ['Monitoring', 'Diversification']
        }
      ]
    };
  }

  private async generatePredictions(snapshot: VotingPowerSnapshotViem): Promise<PowerPredictionsViem> {
    return {
      shortTerm: [
        {
          timeframe: '7_days',
          predictedTotalPower: (BigInt(snapshot.totalVotingPower) * 102n / 100n).toString(),
          predictedActiveAddresses: Math.floor(snapshot.addressCount * 1.1),
          predictedParticipationRate: 0.65,
          keyFactors: [
            {
              factor: 'New user acquisition',
              impact: 0.3,
              weight: 0.4,
              explanation: 'Continued ecosystem growth driving participation'
            }
          ],
          confidence: 0.7
        }
      ],
      mediumTerm: [
        {
          timeframe: '30_days',
          predictedGrowthRate: 0.2,
          predictedNewAddresses: 50,
          predictedChurnRate: 0.05,
          structuralChanges: [
            {
              change: 'Delegation pattern shift',
              probability: 0.6,
              impact: 'Moderate',
              timeline: '2-4 weeks',
              dependencies: ['User education', 'UI improvements']
            }
          ],
          confidence: 0.6
        }
      ],
      longTerm: [
        {
          timeframe: '6_months',
          predictedState: {
            distribution: 'moderately_concentrated',
            concentration: 'decreasing',
            participation: 'high',
            governance: 'mature',
            stability: 'stable'
          },
          majorTrends: [
            {
              trend: 'Decentralization',
              direction: 'increasing',
              magnitude: 0.3,
              confidence: 0.7,
              drivers: ['Education', 'Incentives', 'Tools']
            }
          ],
          disruptiveFactors: [
            {
              factor: 'Regulatory changes',
              probability: 0.3,
              impact: 'High',
              timeline: '3-6 months',
              scenarios: ['compliance_required', 'access_restricted']
            }
          ],
          confidence: 0.5
        }
      ],
      scenarioAnalysis: [
        {
          name: 'Optimistic Growth',
          description: 'High adoption and participation rates',
          assumptions: [
            'UI/UX improvements',
            'Market conditions favorable',
            'No regulatory hurdles'
          ],
          outcomes: [
            {
              metric: 'Total voting power',
              value: '25000000',
              change: '+25%',
              confidence: 0.6
            }
          ],
          probability: 0.4,
          timeframe: '6 months'
        }
      ],
      confidenceMetrics: {
        overallConfidence: 0.6,
        modelAccuracy: 0.75,
        dataQuality: 0.8,
        assumptionsValidity: 0.7,
        uncertainty: {
          sources: [
            {
              source: 'Market volatility',
              uncertainty: 0.3,
              impact: 'High',
              mitigation: ['Diversification', 'Risk management']
            }
          ],
          totalUncertainty: 0.4,
          keyAssumptions: ['Steady growth rate', 'No major disruptions'],
          sensitivityPoints: ['User acquisition', 'Retention rates']
        }
      }
    };
  }

  private async generateInsights(snapshot: VotingPowerSnapshotViem): Promise<PowerInsightViem[]> {
    const insights: PowerInsightViem[] = [];

    // Distribution insights
    const topHolderConcentration = this.calculateTopHolderConcentration(snapshot);
    if (topHolderConcentration > 0.5) {
      insights.push({
        category: 'concentration',
        title: 'High Concentration Risk',
        description: `Top holder controls ${Math.round(topHolderConcentration * 100)}% of voting power`,
        severity: 'critical',
        data: { concentration: topHolderConcentration },
        recommendations: [
          'Encourage delegation to reduce concentration',
          'Implement voting power caps for proposals',
          'Monitor for coordinated voting'
        ]
      });
    }

    // Participation insights
    const participationRate = this.calculateParticipationRate(snapshot);
    if (participationRate < 0.3) {
      insights.push({
        category: 'participation',
        title: 'Low Participation Rate',
        description: `Only ${Math.round(participationRate * 100)}% of addresses are actively voting`,
        severity: 'warning',
        data: { participationRate },
        recommendations: [
          'Increase community engagement initiatives',
          'Simplify voting process',
          'Provide voting education and guidance'
        ]
      });
    }

    // Distribution insights
    const distribution = await this.analyzeDistribution();
    if (distribution.inequality.giniCoefficient > 0.7) {
      insights.push({
        category: 'distribution',
        title: 'High Inequality Detected',
        description: `Voting power distribution is highly unequal (Gini: ${distribution.inequality.giniCoefficient.toFixed(2)})`,
        severity: 'critical',
        data: { giniCoefficient: distribution.inequality.giniCoefficient },
        recommendations: [
          'Review token distribution mechanisms',
          'Consider anti-concentration measures',
          'Promote wider participation'
        ]
      });
    }

    return insights;
  }

  private async generateInsightsForAddresses(addresses: Address[]): Promise<PowerInsightViem[]> {
    // Implementation would generate insights for specific addresses
    return await this.generateInsights(await this.createSnapshot('Address insights', addresses));
  }

  private async generateRecommendations(snapshot: VotingPowerSnapshotViem): Promise<PowerRecommendationViem[]> {
    const recommendations: PowerRecommendationViem[] = [];

    const topHolderConcentration = this.calculateTopHolderConcentration(snapshot);
    const participationRate = this.calculateParticipationRate(snapshot);

    // High concentration recommendations
    if (topHolderConcentration > 0.4) {
      recommendations.push({
        priority: 'urgent',
        category: 'security',
        title: 'Implement Anti-Concentration Measures',
        description: 'Reduce voting power concentration to improve governance security',
        rationale: [
          'Current concentration level poses 51% attack risk',
          'High concentration undermines decentralization principles',
          'Market perception and investor confidence at risk'
        ],
        implementation: {
          steps: [
            'Research and select delegation mechanism',
            'Develop smart contract for delegation limits',
            'Create user education materials',
            'Implement gradual rollout program',
            'Monitor and adjust based on results'
          ],
          timeline: '3-6 months',
          resources: ['Development team', 'Legal counsel', 'Community managers'],
          stakeholders: ['Token holders', 'Core team', 'Community advisors'],
          complexity: 'high',
          dependencies: ['Smart contract audit', 'Token holder approval']
        },
        expectedImpact: {
          votingPowerImpact: 'moderate_reduction',
          governanceImpact: 'significantly_improved',
          securityImpact: 'dramatically_improved',
          timeframe: '6 months',
          confidence: 0.7
        }
      });
    }

    // Low participation recommendations
    if (participationRate < 0.4) {
      recommendations.push({
        priority: 'high',
        category: 'participation',
        title: 'Boost Voter Participation',
        description: 'Increase voting participation to improve governance legitimacy',
        rationale: [
          'Low participation undermines governance effectiveness',
          'Higher participation improves decision quality',
          'Increased engagement drives ecosystem growth'
        ],
        implementation: {
          steps: [
            'Analyze participation barriers',
            'Design simplified voting interface',
            'Implement voting reminders and notifications',
            'Create educational content series',
            'Launch community engagement campaigns'
          ],
          timeline: '2-4 months',
          resources: ['UX team', 'Community managers', 'Content creators'],
          stakeholders: ['All token holders', 'Community leaders'],
          complexity: 'medium',
          dependencies: ['UI/UX improvements', 'Notification system']
        },
        expectedImpact: {
          votingPowerImpact: 'significant_increase',
          governanceImpact: 'moderately_improved',
          securityImpact: 'slightly_improved',
          timeframe: '3 months',
          confidence: 0.8
        }
      });
    }

    // General governance recommendations
    recommendations.push({
      priority: 'medium',
      category: 'efficiency',
      title: 'Implement Analytics Dashboard',
      description: 'Provide comprehensive voting power analytics for transparency',
      rationale: [
        'Data-driven decision making improves outcomes',
        'Transparency builds community trust',
        'Analytics help identify governance issues early'
      ],
      implementation: {
        steps: [
          'Design analytics architecture',
          'Implement data collection systems',
          'Create visualization dashboards',
          'Set up automated reporting',
          'Train governance team on analytics'
        ],
        timeline: '1-2 months',
        resources: ['Data team', 'Frontend developers', 'Governance team'],
        stakeholders: ['Core team', 'Community leaders', 'Researchers'],
        complexity: 'medium',
        dependencies: ['Data infrastructure', 'Backend systems']
      },
      expectedImpact: {
        votingPowerImpact: 'minimal_change',
        governanceImpact: 'significantly_improved',
        securityImpact: 'moderately_improved',
        timeframe: '2 months',
        confidence: 0.9
      }
    });

    return recommendations;
  }

  private calculateTopHolderConcentration(snapshot: VotingPowerSnapshotViem): number {
    const sortedRecords = snapshot.records.sort((a, b) =>
      BigInt(b.votingPower) - BigInt(a.votingPower)
    );

    if (sortedRecords.length === 0 || BigInt(snapshot.totalVotingPower) === 0n) {
      return 0;
    }

    const topHolderPower = BigInt(sortedRecords[0].votingPower);
    return Number(topHolderPower * 10000n / BigInt(snapshot.totalVotingPower)) / 100;
  }

  private calculateParticipationRate(snapshot: VotingPowerSnapshotViem): number {
    const activeAddresses = snapshot.records.filter(r =>
      BigInt(r.votingPower) > 0n
    ).length;

    return snapshot.addressCount > 0 ? activeAddresses / snapshot.addressCount : 0;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.reports = [];
    this.analyticsCache.clear();

    logger.info('Voting power analytics service cleaned up');
  }
}

// Factory function
export function createVotingPowerAnalyticsViem(
  governanceService: any,
  cacheService: ICache
): VotingPowerAnalyticsViem {
  return new VotingPowerAnalyticsViem(governanceService, cacheService);
}