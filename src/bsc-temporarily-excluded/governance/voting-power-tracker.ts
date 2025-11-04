import { ethers } from 'ethers';
import { CakeGovernanceService } from './cake-governance';

/**
 * Enhanced voting power tracking interface
 */
export interface VotingPowerRecord {
  address: string;
  currentPower: string;
  delegatedPower: string;
  receivedDelegations: string;
  totalEffectivePower: string;
  blockNumber: number;
  timestamp: Date;
  powerBreakdown: {
    directTokens: string;
    delegatedIn: string;
    delegatedOut: string;
    effectiveVotingPower: string;
  };
  historical: PowerHistoryPoint[];
  predictions: PowerPrediction[];
}

export interface PowerHistoryPoint {
  timestamp: Date;
  blockNumber: number;
  power: string;
  changeType: 'acquire' | 'delegate' | 'undelegate' | 'transfer_out' | 'transfer_in';
  changeAmount: string;
  source: string;
  transactionHash?: string;
}

export interface PowerPrediction {
  timestamp: Date;
  predictedPower: string;
  confidence: number;
  factors: PredictionFactor[];
  scenario: 'bullish' | 'bearish' | 'neutral';
}

export interface PredictionFactor {
  type: 'historical_trend' | 'delegation_pattern' | 'market_condition' | 'proposal_activity';
  weight: number;
  impact: number;
  description: string;
}

export interface VotingPowerAnalytics {
  address: string;
  analytics: {
    votingHistory: VotingHistoryAnalytics;
    delegationPatterns: DelegationAnalytics;
    influenceMetrics: InfluenceMetrics;
    powerVelocity: PowerVelocityMetrics;
    comparativeRanking: ComparativeRanking;
    participationScore: ParticipationScore;
  };
}

export interface VotingHistoryAnalytics {
  totalVotes: number;
  votingFrequency: number;
  averageSupportRate: number;
  proposalSuccessCorrelation: number;
  votingStreak: number;
  lastVotedAt?: Date;
  votingConsistency: number;
  issueAlignment: Record<string, number>;
}

export interface DelegationAnalytics {
  totalDelegationsReceived: number;
  totalDelegationsGiven: number;
  delegationRecipients: string[];
  delegationSources: string[];
  delegationDuration: number;
  delegationEfficiency: number;
  trustScore: number;
  networkCentrality: number;
}

export interface InfluenceMetrics {
  votingInfluence: number;
  delegationInfluence: number;
  proposalInfluence: number;
  socialInfluence: number;
  overallInfluence: number;
  influenceTrend: 'increasing' | 'decreasing' | 'stable';
  influenceVelocity: number;
}

export interface PowerVelocityMetrics {
  dailyChange: string;
  weeklyChange: string;
  monthlyChange: string;
  accelerationRate: number;
  volatilityIndex: number;
  momentumScore: number;
  predictedDirection: 'upward' | 'downward' | 'sideways';
}

export interface ComparativeRanking {
  globalRank: number;
  percentileRank: number;
  totalAddresses: number;
  rankCategory: 'whale' | 'large_holder' | 'medium_holder' | 'small_holder' | 'micro_holder';
  rankChange: number;
  topAddresses: PowerRankingEntry[];
}

export interface PowerRankingEntry {
  address: string;
  votingPower: string;
  rank: number;
  change: number;
}

export interface ParticipationScore {
  baseScore: number;
  votingBonus: number;
  delegationBonus: number;
  proposalBonus: number;
  communityBonus: number;
  totalScore: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  benefits: string[];
}

export interface PowerThresholdAlert {
  address: string;
  currentPower: string;
  threshold: string;
  type: 'above' | 'below';
  category: 'voting_threshold' | 'delegation_limit' | 'proposal_quorum' | 'custom';
  message: string;
  triggeredAt: Date;
}

export interface VotingPowerSnapshot {
  id: string;
  timestamp: Date;
  blockNumber: number;
  totalSupply: string;
  totalVotingPower: string;
  participationRate: number;
  topHolders: PowerHolder[];
  distributionMetrics: PowerDistributionMetrics;
  delegationMetrics: DelegationMetrics;
}

export interface PowerHolder {
  address: string;
  votingPower: string;
  percentage: number;
  rank: number;
  delegationStatus: 'delegated' | 'self_voting' | 'mixed';
}

export interface PowerDistributionMetrics {
  giniCoefficient: number;
  herfindahlIndex: number;
  concentrationRatio: number;
  topHolderPercentage: number;
  medianVotingPower: string;
  averageVotingPower: string;
}

export interface DelegationMetrics {
  totalDelegatedPower: string;
  delegationRate: number;
  averageDelegationSize: string;
  delegationDepth: number;
  redelegationRate: number;
  delegationNetworkDensity: number;
}

/**
 * Advanced voting power tracking service
 */
export class VotingPowerTracker {
  private provider: ethers.Provider;
  private governanceService: CakeGovernanceService;
  private powerRecords: Map<string, VotingPowerRecord> = new Map();
  private snapshots: VotingPowerSnapshot[] = [];
  private alerts: PowerThresholdAlert[] = [];
  private trackedAddresses: Set<string> = new Set();

  constructor(provider: ethers.Provider, governanceService: CakeGovernanceService) {
    this.provider = provider;
    this.governanceService = governanceService;
  }

  /**
   * Start tracking voting power for an address
   */
  async startTracking(address: string): Promise<void> {
    if (this.trackedAddresses.has(address)) {
      throw new Error(`Address ${address} is already being tracked`);
    }

    this.trackedAddresses.add(address);
    await this.initializePowerRecord(address);
  }

  /**
   * Stop tracking an address
   */
  async stopTracking(address: string): Promise<void> {
    this.trackedAddresses.delete(address);
    this.powerRecords.delete(address);
  }

  /**
   * Get current voting power for an address
   */
  async getCurrentVotingPower(address: string): Promise<string> {
    try {
      const tokenInfo = await this.governanceService.getTokenInfo();
      const balance = await this.provider.getBalance(address);

      // Convert to token units (assuming 18 decimals)
      const tokenBalance = ethers.formatUnits(balance, 18);

      // Get delegated power
      const delegatedPower = await this.calculateDelegatedPower(address);
      const receivedDelegations = await this.calculateReceivedDelegations(address);

      // Calculate effective voting power
      const effectivePower = ethers.formatUnits(
        (ethers.parseUnits(tokenBalance, 18) +
         ethers.parseUnits(receivedDelegations, 18) -
         ethers.parseUnits(delegatedPower, 18)),
        18
      );

      return effectivePower;
    } catch (error) {
      console.error('Error getting voting power:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive voting power analytics
   */
  async getVotingPowerAnalytics(address: string): Promise<VotingPowerAnalytics> {
    const currentPower = await this.getCurrentVotingPower(address);
    const history = await this.getVotingHistory(address);
    const delegations = await this.getDelegationHistory(address);

    return {
      address,
      analytics: {
        votingHistory: this.analyzeVotingHistory(history),
        delegationPatterns: this.analyzeDelegationPatterns(delegations),
        influenceMetrics: await this.calculateInfluenceMetrics(address, currentPower),
        powerVelocity: await this.calculatePowerVelocity(address),
        comparativeRanking: await this.getComparativeRanking(address, currentPower),
        participationScore: await this.calculateParticipationScore(address)
      }
    };
  }

  /**
   * Track voting power changes over time
   */
  async trackPowerChange(
    address: string,
    changeType: PowerHistoryPoint['changeType'],
    changeAmount: string,
    transactionHash?: string
  ): Promise<void> {
    const currentPower = await this.getCurrentVotingPower(address);
    const blockNumber = await this.provider.getBlockNumber();

    const historyPoint: PowerHistoryPoint = {
      timestamp: new Date(),
      blockNumber,
      power: currentPower,
      changeType,
      changeAmount,
      source: this.getChangeSource(changeType),
      transactionHash
    };

    const record = this.powerRecords.get(address);
    if (record) {
      record.historical.push(historyPoint);
      record.currentPower = currentPower;
      record.timestamp = new Date();

      // Keep only last 1000 history points
      if (record.historical.length > 1000) {
        record.historical = record.historical.slice(-1000);
      }

      // Update predictions
      record.predictions = await this.generatePowerPredictions(address);

      // Check for threshold alerts
      await this.checkThresholdAlerts(address, currentPower);
    }
  }

  /**
   * Create a voting power snapshot
   */
  async createSnapshot(description?: string): Promise<VotingPowerSnapshot> {
    const blockNumber = await this.provider.getBlockNumber();
    const timestamp = new Date();

    // Get current state
    const totalSupply = await this.getTotalVotingPower();
    const topHolders = await this.getTopHolders(100);
    const distributionMetrics = await this.calculateDistributionMetrics(topHolders, totalSupply);
    const delegationMetrics = await this.calculateDelegationMetrics();

    const snapshot: VotingPowerSnapshot = {
      id: `snapshot_${timestamp.getTime()}`,
      timestamp,
      blockNumber,
      totalSupply,
      totalVotingPower: totalSupply,
      participationRate: await this.calculateParticipationRate(),
      topHolders,
      distributionMetrics,
      delegationMetrics
    };

    this.snapshots.push(snapshot);

    // Keep only last 100 snapshots
    if (this.snapshots.length > 100) {
      this.snapshots = this.snapshots.slice(-100);
    }

    return snapshot;
  }

  /**
   * Predict future voting power based on trends
   */
  async predictVotingPower(
    address: string,
    timeHorizon: number // days
  ): Promise<PowerPrediction[]> {
    const record = this.powerRecords.get(address);
    if (!record || record.historical.length < 10) {
      return [];
    }

    const predictions: PowerPrediction[] = [];
    const currentPower = ethers.parseUnits(record.currentPower, 18);

    // Analyze historical patterns
    const trend = this.analyzePowerTrend(record.historical);
    const seasonality = this.detectSeasonality(record.historical);
    const volatility = this.calculateVolatility(record.historical);

    // Generate predictions for different scenarios
    for (let days = 1; days <= timeHorizon; days++) {
      const bullishPrediction = this.calculatePrediction(
        currentPower,
        trend + volatility,
        seasonality,
        days
      );

      const bearishPrediction = this.calculatePrediction(
        currentPower,
        trend - volatility,
        seasonality,
        days
      );

      const neutralPrediction = this.calculatePrediction(
        currentPower,
        trend,
        seasonality,
        days
      );

      predictions.push(
        {
          timestamp: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
          predictedPower: ethers.formatUnits(neutralPrediction, 18),
          confidence: Math.max(0.1, 1 - (days / timeHorizon) * 0.8),
          factors: [
            {
              type: 'historical_trend',
              weight: 0.4,
              impact: trend,
              description: 'Based on historical power changes'
            },
            {
              type: 'delegation_pattern',
              weight: 0.3,
              impact: await this.analyzeDelegationTrend(address),
              description: 'Delegation pattern analysis'
            },
            {
              type: 'market_condition',
              weight: 0.2,
              impact: await this.getMarketConditionScore(),
              description: 'Current market conditions'
            },
            {
              type: 'proposal_activity',
              weight: 0.1,
              impact: await this.analyzeProposalActivity(address),
              description: 'Recent proposal participation'
            }
          ],
          scenario: 'neutral'
        }
      );
    }

    return predictions;
  }

  /**
   * Get voting power changes in a time range
   */
  async getPowerChanges(
    address: string,
    startTime: Date,
    endTime: Date
  ): Promise<PowerHistoryPoint[]> {
    const record = this.powerRecords.get(address);
    if (!record) return [];

    return record.historical.filter(point =>
      point.timestamp >= startTime && point.timestamp <= endTime
    );
  }

  /**
   * Set up threshold alerts for voting power
   */
  async setThresholdAlert(
    address: string,
    threshold: string,
    type: PowerThresholdAlert['type'],
    category: PowerThresholdAlert['category']
  ): Promise<void> {
    const currentPower = await this.getCurrentVotingPower(address);

    const alert: PowerThresholdAlert = {
      address,
      currentPower,
      threshold,
      type,
      category,
      message: `Voting power ${type} threshold of ${threshold} for ${address}`,
      triggeredAt: new Date()
    };

    this.alerts.push(alert);
  }

  /**
   * Get addresses by voting power ranking
   */
  async getAddressesByPower(
    limit: number = 100,
    sortBy: 'voting_power' | 'delegations' | 'influence' = 'voting_power'
  ): Promise<PowerRankingEntry[]> {
    const allAddresses = Array.from(this.trackedAddresses);
    const rankings: PowerRankingEntry[] = [];

    for (const address of allAddresses) {
      const power = await this.getCurrentVotingPower(address);
      const delegations = await this.calculateReceivedDelegations(address);
      const influence = await this.calculateInfluenceScore(address, power);

      rankings.push({
        address,
        votingPower: power,
        rank: 0, // Will be calculated after sorting
        change: 0 // Would need historical data for this
      });
    }

    // Sort based on the requested criteria
    rankings.sort((a, b) => {
      switch (sortBy) {
        case 'voting_power':
          return Number(ethers.parseUnits(b.votingPower, 18)) - Number(ethers.parseUnits(a.votingPower, 18));
        case 'delegations':
          return Number(ethers.parseUnits(b.votingPower, 18)) - Number(ethers.parseUnits(a.votingPower, 18)); // Simplified
        case 'influence':
          return 0; // Would need influence calculation
        default:
          return 0;
      }
    });

    // Assign ranks
    rankings.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return rankings.slice(0, limit);
  }

  // Private helper methods

  private async initializePowerRecord(address: string): Promise<void> {
    const currentPower = await this.getCurrentVotingPower(address);
    const blockNumber = await this.provider.getBlockNumber();

    const record: VotingPowerRecord = {
      address,
      currentPower,
      delegatedPower: await this.calculateDelegatedPower(address),
      receivedDelegations: await this.calculateReceivedDelegations(address),
      totalEffectivePower: currentPower,
      blockNumber,
      timestamp: new Date(),
      powerBreakdown: {
        directTokens: currentPower,
        delegatedIn: await this.calculateReceivedDelegations(address),
        delegatedOut: await this.calculateDelegatedPower(address),
        effectiveVotingPower: currentPower
      },
      historical: [{
        timestamp: new Date(),
        blockNumber,
        power: currentPower,
        changeType: 'acquire',
        changeAmount: '0',
        source: 'initialization'
      }],
      predictions: []
    };

    this.powerRecords.set(address, record);
  }

  private async calculateDelegatedPower(address: string): Promise<string> {
    // Simplified implementation
    return '0';
  }

  private async calculateReceivedDelegations(address: string): Promise<string> {
    // Simplified implementation
    return '0';
  }

  private async getVotingHistory(address: string): Promise<any[]> {
    // Implementation would fetch from governance service
    return [];
  }

  private async getDelegationHistory(address: string): Promise<any[]> {
    // Implementation would fetch delegation history
    return [];
  }

  private analyzeVotingHistory(history: any[]): VotingHistoryAnalytics {
    return {
      totalVotes: history.length,
      votingFrequency: 0,
      averageSupportRate: 0,
      proposalSuccessCorrelation: 0,
      votingStreak: 0,
      votingConsistency: 0,
      issueAlignment: {}
    };
  }

  private analyzeDelegationPatterns(delegations: any[]): DelegationAnalytics {
    return {
      totalDelegationsReceived: 0,
      totalDelegationsGiven: 0,
      delegationRecipients: [],
      delegationSources: [],
      delegationDuration: 0,
      delegationEfficiency: 0,
      trustScore: 0,
      networkCentrality: 0
    };
  }

  private async calculateInfluenceMetrics(address: string, power: string): Promise<InfluenceMetrics> {
    return {
      votingInfluence: Number(ethers.parseUnits(power, 18)) / 1e18,
      delegationInfluence: 0,
      proposalInfluence: 0,
      socialInfluence: 0,
      overallInfluence: 0,
      influenceTrend: 'stable',
      influenceVelocity: 0
    };
  }

  private async calculatePowerVelocity(address: string): Promise<PowerVelocityMetrics> {
    return {
      dailyChange: '0',
      weeklyChange: '0',
      monthlyChange: '0',
      accelerationRate: 0,
      volatilityIndex: 0,
      momentumScore: 0,
      predictedDirection: 'sideways'
    };
  }

  private async getComparativeRanking(address: string, power: string): Promise<ComparativeRanking> {
    return {
      globalRank: 1,
      percentileRank: 100,
      totalAddresses: this.trackedAddresses.size,
      rankCategory: 'whale',
      rankChange: 0,
      topAddresses: []
    };
  }

  private async calculateParticipationScore(address: string): Promise<ParticipationScore> {
    return {
      baseScore: 0,
      votingBonus: 0,
      delegationBonus: 0,
      proposalBonus: 0,
      communityBonus: 0,
      totalScore: 0,
      tier: 'bronze',
      benefits: []
    };
  }

  private async getTotalVotingPower(): Promise<string> {
    // Simplified implementation
    return '1000000';
  }

  private async getTopHolders(limit: number): Promise<PowerHolder[]> {
    const holders: PowerHolder[] = [];
    const addresses = Array.from(this.trackedAddresses).slice(0, limit);

    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      const power = await this.getCurrentVotingPower(address);

      holders.push({
        address,
        votingPower: power,
        percentage: 0, // Would need total supply for calculation
        rank: i + 1,
        delegationStatus: 'self_voting'
      });
    }

    return holders;
  }

  private async calculateDistributionMetrics(holders: PowerHolder[], totalSupply: string): Promise<PowerDistributionMetrics> {
    return {
      giniCoefficient: 0,
      herfindahlIndex: 0,
      concentrationRatio: 0,
      topHolderPercentage: 0,
      medianVotingPower: '0',
      averageVotingPower: '0'
    };
  }

  private async calculateDelegationMetrics(): Promise<DelegationMetrics> {
    return {
      totalDelegatedPower: '0',
      delegationRate: 0,
      averageDelegationSize: '0',
      delegationDepth: 0,
      redelegationRate: 0,
      delegationNetworkDensity: 0
    };
  }

  private async calculateParticipationRate(): Promise<number> {
    return 0.65; // Simplified implementation
  }

  private async generatePowerPredictions(address: string): Promise<PowerPrediction[]> {
    return [];
  }

  private async checkThresholdAlerts(address: string, currentPower: string): Promise<void> {
    // Implementation would check against set thresholds
  }

  private getChangeSource(changeType: PowerHistoryPoint['changeType']): string {
    switch (changeType) {
      case 'acquire': return 'token_purchase';
      case 'delegate': return 'delegation';
      case 'undelegate': return 'undelegation';
      case 'transfer_out': return 'token_transfer';
      case 'transfer_in': return 'token_transfer';
      default: return 'unknown';
    }
  }

  private analyzePowerTrend(history: PowerHistoryPoint[]): number {
    if (history.length < 2) return 0;

    const recent = history.slice(-10);
    let totalChange = 0;

    for (let i = 1; i < recent.length; i++) {
      const current = Number(ethers.parseUnits(recent[i].power, 18));
      const previous = Number(ethers.parseUnits(recent[i-1].power, 18));
      totalChange += (current - previous) / previous;
    }

    return totalChange / (recent.length - 1);
  }

  private detectSeasonality(history: PowerHistoryPoint[]): number {
    // Simplified seasonality detection
    return 0;
  }

  private calculateVolatility(history: PowerHistoryPoint[]): number {
    if (history.length < 2) return 0;

    const returns: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const current = Number(ethers.parseUnits(history[i].power, 18));
      const previous = Number(ethers.parseUnits(history[i-1].power, 18));
      returns.push((current - previous) / previous);
    }

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }

  private calculatePrediction(
    currentPower: bigint,
    trend: number,
    seasonality: number,
    days: number
  ): bigint {
    const dailyGrowth = 1 + (trend + seasonality) / 365;
    const predictedPower = currentPower * BigInt(Math.pow(dailyGrowth, days) * 1e18) / BigInt(1e18);
    return predictedPower;
  }

  private async analyzeDelegationTrend(address: string): Promise<number> {
    // Simplified delegation trend analysis
    return 0;
  }

  private async getMarketConditionScore(): Promise<number> {
    // Simplified market condition analysis
    return 0;
  }

  private async analyzeProposalActivity(address: string): Promise<number> {
    // Simplified proposal activity analysis
    return 0;
  }

  private async calculateInfluenceScore(address: string, power: string): Promise<number> {
    // Simplified influence score calculation
    return Number(ethers.parseUnits(power, 18)) / 1e18;
  }
}