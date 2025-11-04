/**
 * BSC Proposal Tracker Service (Viem-based)
 * Comprehensive proposal tracking and analytics using Viem library
 */

import { Logger } from '../../../../utils/logger.js';
import { type Address, formatUnits, parseUnits } from 'viem';
import { ICache } from '../../../../services/cache.service.js';
import {
  ProposalViem,
  VoteViem,
  GovernanceEventViem,
  ProposalStatusViem,
  GovernanceMetricsViem
} from '../../types/governance-types-viem.js';

const logger = new Logger('ProposalTrackerViem');

// Proposal tracker configuration
export interface ProposalTrackerConfigViem {
  autoRefresh: boolean;
  refreshInterval: number; // seconds
  notifications: boolean;
  trackingDepth: number; // number of proposals to track
  analyticsEnabled: boolean;
  votingInterfaceEnabled: boolean;
}

export interface TrackedProposalViem {
  id: number;
  proposal: ProposalViem;
  tracking: ProposalTrackingViem;
  voting: VotingTrackingViem;
  analytics: ProposalAnalyticsViem;
  status: ProposalStatusViem;
  timeline: ProposalTimelineViem;
  interactions: ProposalInteractionViem[];
  notifications: ProposalNotificationViem[];
}

export interface ProposalTrackingViem {
  trackedAt: Date;
  lastUpdated: Date;
  updateCount: number;
  watchCount: number;
  watchers: Address[];
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: ProposalCategoryViem;
  impact: ProposalImpactViem;
}

export interface ProposalCategoryViem {
  primary: string;
  secondary?: string;
  tags: string[];
  customTags: string[];
}

export interface ProposalImpactViem {
  financial: FinancialImpactViem;
  governance: GovernanceImpactViem;
  technical: TechnicalImpactViem;
  community: CommunityImpactViem;
  overall: OverallImpactViem;
}

export interface FinancialImpactViem {
  estimatedCost: string;
  budgetAllocation: string;
  treasuryImpact: string;
  tokenEconomics: string;
  marketImpact: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface GovernanceImpactViem {
  votingPowerChange: string;
  quorumImpact: string;
  governanceStructure: string;
  processChange: string;
  decentralization: 'increase' | 'decrease' | 'neutral';
}

export interface TechnicalImpactViem {
  complexity: 'low' | 'medium' | 'high';
  implementationTime: string;
  riskLevel: 'low' | 'medium' | 'high';
  dependencies: string[];
  integrationPoints: string[];
  upgradeRequired: boolean;
}

export interface CommunityImpactViem {
  stakeholderEffect: 'positive' | 'negative' | 'neutral';
  participationChange: string;
  sentiment: 'positive' | 'negative' | 'mixed';
  controversyLevel: number; // 0-1
  adoptionRate: string;
}

export interface OverallImpactViem {
  score: number; // 0-100
  level: 'minimal' | 'moderate' | 'significant' | 'transformative';
  confidence: number; // 0-1
  timeframe: string;
  successProbability: number; // 0-1
}

export interface VotingTrackingViem {
  userVote?: UserVoteViem;
  votingPower: string;
  votingWeight: string;
  votingDeadline: Date;
  currentResults: VotingResultsViem;
  predictions: VotingPredictionViem[];
  recommendations: VotingRecommendationViem[];
  historicalContext: VotingHistoryContextViem;
}

export interface UserVoteViem {
  support: boolean;
  votingPower: string;
  reasoning: string;
  timestamp: Date;
  transactionHash: Address;
  gasUsed: string;
  effectiveVotingPower: string;
}

export interface VotingResultsViem {
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  totalVotes: string;
  quorum: string;
  quorumReached: boolean;
  currentSupport: number; // percentage
  turnoutRate: number;
  timeRemaining: number; // seconds
  voterCount: number;
  powerDistribution: PowerDistributionViem;
}

export interface PowerDistributionViem {
  whales: string; // votes from addresses with >1% power
  large: string; // votes from addresses with 0.1%-1% power
  medium: string; // votes from addresses with 0.01%-0.1% power
  small: string; // votes from addresses with <0.01% power
  whaleCount: number;
  largeCount: number;
  mediumCount: number;
  smallCount: number;
}

export interface VotingPredictionViem {
  timestamp: Date;
  predictedOutcome: 'pass' | 'fail' | 'uncertain';
  confidence: number; // 0-1
  predictedSupport: number; // percentage
  predictedTurnout: number;
  keyFactors: PredictionFactorViem[];
  scenario: 'base' | 'bullish' | 'bearish';
  modelAccuracy: number;
}

export interface PredictionFactorViem {
  factor: string;
  impact: number; // -1 to 1
  weight: number; // 0-1
  explanation: string;
}

export interface VotingRecommendationViem {
  recommendation: 'for' | 'against' | 'abstain';
  confidence: number; // 0-1
  reasoning: string[];
  alignmentScore: number; // 0-1, alignment with user's historical voting patterns
  riskAssessment: RiskAssessmentViem;
  alternatives: AlternativeVoteViem[];
}

export interface RiskAssessmentViem {
  financialRisk: number; // 0-1
  governanceRisk: number; // 0-1
  technicalRisk: number; // 0-1
  reputationalRisk: number; // 0-1
  overallRisk: number; // 0-1
  mitigation: string[];
}

export interface AlternativeVoteViem {
  action: string;
  description: string;
  expectedOutcome: string;
  pros: string[];
  cons: string[];
}

export interface VotingHistoryContextViem {
  similarProposals: SimilarProposalViem[];
  voterBehavior: VoterBehaviorViem;
  marketConditions: MarketConditionsViem;
  governanceTrends: GovernanceTrendViem[];
}

export interface SimilarProposalViem {
  id: number;
  title: string;
  similarity: number; // 0-1
  outcome: 'passed' | 'failed';
  supportRate: number;
  votingPower: string;
  keyDifferences: string[];
}

export interface VoterBehaviorViem {
  participationRate: number;
  votingPatterns: VotingPatternViem[];
  demographicShifts: DemographicShiftViem[];
  sentimentTrends: SentimentTrendViem[];
}

export interface VotingPatternViem {
  pattern: string;
  frequency: number;
  contexts: string[];
  effectiveness: number;
}

export interface DemographicShiftViem {
  demographic: string;
  change: number; // percentage change
  timeframe: string;
  causes: string[];
}

export interface SentimentTrendViem {
  sentiment: 'positive' | 'negative' | 'neutral';
  trend: 'improving' | 'declining' | 'stable';
  changeRate: number;
  drivers: string[];
}

export interface MarketConditionsViem {
  tokenPrice: string;
  marketCap: string;
  tradingVolume: string;
  volatility: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  keyEvents: string[];
}

export interface GovernanceTrendViem {
  trend: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  changeRate: number;
  timeframe: string;
  impact: string;
}

export interface ProposalAnalyticsViem {
  engagement: EngagementAnalyticsViem;
  participation: ParticipationAnalyticsViem;
  voting: VotingAnalyticsViem;
  performance: PerformanceAnalyticsViem;
  sentiment: SentimentAnalyticsViem;
  impact: ImpactAnalyticsViem;
}

export interface EngagementAnalyticsViem {
  views: number;
  uniqueViewers: number;
  averageViewTime: number;
  discussionParticipants: number;
  comments: number;
  shares: number;
  bookmarks: number;
  engagementRate: number;
  peakEngagement: Date;
}

export interface ParticipationAnalyticsViem {
  voterCount: number;
  votingPowerParticipation: string;
  participationRate: number;
  demographicBreakdown: DemographicBreakdownViem;
  geographicDistribution: GeographicDistributionViem;
  temporalPatterns: TemporalPatternViem[];
}

export interface DemographicBreakdownViem {
  byHoldingSize: Record<string, number>;
  byVotingHistory: Record<string, number>;
  byEngagement: Record<string, number>;
  byExperience: Record<string, number>;
}

export interface GeographicDistributionViem {
  byRegion: Record<string, number>;
  byTimezone: Record<string, number>;
  concentration: number;
}

export interface TemporalPatternViem {
  timeframe: string;
  participation: number;
  votingPower: string;
  factors: string[];
}

export interface VotingAnalyticsViem {
  voteDistribution: VoteDistributionViem;
  votingTimeline: VotingTimelineViem[];
  votingPowerEfficiency: number;
  voterAlignment: VoterAlignmentViem;
  votingDynamics: VotingDynamicsViem;
}

export interface VoteDistributionViem {
  for: string;
  against: string;
  abstain: string;
  forPercentage: number;
  againstPercentage: number;
  abstainPercentage: number;
  effectiveVotingPower: string;
}

export interface VotingTimelineViem {
  timestamp: Date;
  cumulativeVotes: number;
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  events: VotingEventViem[];
}

export interface VotingEventViem {
  type: string;
  timestamp: Date;
  description: string;
  impact: string;
  data: any;
}

export interface VoterAlignmentViem {
  withCommunity: number;
  withExperts: number;
  withPrevious: number;
  consistency: number;
}

export interface VotingDynamicsViem {
  momentum: number;
  volatility: number;
  convergenceRate: number;
  swingVoters: number;
  decisiveVoters: number;
}

export interface PerformanceAnalyticsViem {
  executionTime?: number;
  gasEfficiency: number;
  successRate: number;
  errorRate: number;
  bottlenecks: string[];
  optimizationOpportunities: string[];
}

export interface SentimentAnalyticsViem {
  overallSentiment: number;
  sentimentDistribution: Record<string, number>;
  sentimentTrends: SentimentTrendViem[];
  keyTopics: TopicAnalysisViem[];
  influencerOpinions: InfluencerOpinionViem[];
}

export interface TopicAnalysisViem {
  topic: string;
  sentiment: number;
  mentions: number;
  impact: number;
}

export interface InfluencerOpinionViem {
  address: Address;
  influence: number;
  stance: 'for' | 'against' | 'neutral';
  reasoning: string;
  followers: number;
}

export interface ImpactAnalyticsViem {
  expectedImpact: string;
  actualImpact?: string;
  impactVariance: number;
  successMetrics: SuccessMetricViem[];
  lessonsLearned: string[];
}

export interface SuccessMetricViem {
  metric: string;
  target: string;
  actual?: string;
  achievement: number;
}

export interface ProposalTimelineViem {
  events: ProposalEventViem[];
  milestones: ProposalMilestoneViem[];
  deadlines: ProposalDeadlineViem[];
  dependencies: ProposalDependencyViem[];
}

export interface ProposalEventViem {
  id: string;
  type: ProposalEventTypeViem;
  timestamp: Date;
  title: string;
  description: string;
  data: any;
  impact: 'low' | 'medium' | 'high';
}

export type ProposalEventTypeViem =
  | 'created'
  | 'queued'
  | 'active'
  | 'vote_cast'
  | 'vote_updated'
  | 'quorum_reached'
  | 'threshold_reached'
  | 'executed'
  | 'cancelled'
  | 'expired'
  | 'updated';

export interface ProposalMilestoneViem {
  id: string;
  title: string;
  description: string;
  targetDate: Date;
  actualDate?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'missed';
  importance: 'low' | 'medium' | 'high';
}

export interface ProposalDeadlineViem {
  id: string;
  type: 'voting' | 'execution' | 'implementation';
  deadline: Date;
  reminder: boolean;
  status: 'upcoming' | 'passed' | 'missed';
}

export interface ProposalDependencyViem {
  proposalId: number;
  type: 'requires' | 'conflicts_with' | 'complements';
  description: string;
  status: 'pending' | 'resolved' | 'blocked';
}

export interface ProposalInteractionViem {
  id: string;
  type: InteractionTypeViem;
  actor: Address;
  timestamp: Date;
  data: any;
  context: string;
}

export type InteractionTypeViem =
  | 'view'
  | 'share'
  | 'comment'
  | 'vote'
  | 'delegate'
  | 'follow'
  | 'bookmark'
  | 'analyze'
  | 'discuss';

export interface ProposalNotificationViem {
  id: string;
  type: NotificationTypeViem;
  recipient: Address;
  title: string;
  message: string;
  data: any;
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export type NotificationTypeViem =
  | 'proposal_created'
  | 'voting_started'
  | 'deadline_reminder'
  | 'quorum_reached'
  | 'result_announced'
  | 'execution_scheduled'
  | 'update_available'
  | 'analysis_ready';

export interface VotingInterfaceViem {
  interface: any;
  components: any[];
  workflows: any[];
  integrations: any[];
  accessibility: any;
}

/**
 * Proposal tracker service implementation using Viem
 */
export class ProposalTrackerViem {
  private governanceService: any; // Will be injected
  private config: ProposalTrackerConfigViem;
  private trackedProposals: Map<number, TrackedProposalViem> = new Map();
  private votingInterfaces: Map<string, VotingInterfaceViem> = new Map();
  private notifications: ProposalNotificationViem[] = [];
  private watchers: Map<Address, Set<number>> = new Map(); // address -> proposal IDs
  private analyticsCache: Map<string, any> = new Map();

  constructor(
    governanceService: any,
    config: ProposalTrackerConfigViem,
    private cacheService: ICache
  ) {
    this.governanceService = governanceService;
    this.config = config;

    // Start auto-refresh if enabled
    if (config.autoRefresh) {
      this.startAutoRefresh();
    }
  }

  /**
   * Start tracking a proposal
   */
  async startTrackingProposal(proposalId: number, category: ProposalCategoryViem): Promise<TrackedProposalViem> {
    if (this.trackedProposals.has(proposalId)) {
      throw new Error(`Proposal ${proposalId} is already being tracked`);
    }

    // Check cache first
    const cacheKey = `proposal:tracked:${proposalId}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      const trackedProposal = JSON.parse(cached) as TrackedProposalViem;
      this.trackedProposals.set(proposalId, trackedProposal);
      logger.info('Retrieved tracked proposal from cache', { proposalId });
      return trackedProposal;
    }

    const proposal = await this.governanceService.getProposal(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    const trackedProposal = await this.createTrackedProposal(proposalId, proposal, category);

    this.trackedProposals.set(proposalId, trackedProposal);

    // Cache the tracked proposal
    await this.cacheService.set(cacheKey, JSON.stringify(trackedProposal), {
      ttl: this.config.refreshInterval
    });

    await this.initializeTracking(proposalId);

    logger.info('Started tracking proposal', {
      proposalId,
      category: category.primary,
      priority: trackedProposal.tracking.priority
    });

    return trackedProposal;
  }

  /**
   * Stop tracking a proposal
   */
  async stopTrackingProposal(proposalId: number): Promise<void> {
    this.trackedProposals.delete(proposalId);

    // Remove from all watchers
    for (const [address, proposals] of this.watchers.entries()) {
      proposals.delete(proposalId);
      if (proposals.size === 0) {
        this.watchers.delete(address);
      }
    }

    // Clean up cache
    const cacheKey = `proposal:tracked:${proposalId}`;
    await this.cacheService.delete(cacheKey);

    logger.info('Stopped tracking proposal', { proposalId });
  }

  /**
   * Get tracked proposal details
   */
  async getTrackedProposal(proposalId: number): Promise<TrackedProposalViem | null> {
    // Check cache first
    const cacheKey = `proposal:tracked:${proposalId}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as TrackedProposalViem;
    }

    const tracked = this.trackedProposals.get(proposalId);
    if (!tracked) return null;

    // Update the tracked proposal with latest data
    await this.updateTrackedProposal(tracked);

    // Update cache
    await this.cacheService.set(cacheKey, JSON.stringify(tracked), {
      ttl: this.config.refreshInterval
    });

    return tracked;
  }

  /**
   * Get all tracked proposals
   */
  async getTrackedProposals(filter?: {
    status?: ProposalStatusViem;
    priority?: string;
    category?: string;
    watcher?: Address;
    limit?: number;
    offset?: number;
  }): Promise<TrackedProposalViem[]> {
    let proposals = Array.from(this.trackedProposals.values());

    // Apply filters
    if (filter) {
      if (filter.status) {
        proposals = proposals.filter(p => p.status === filter.status);
      }
      if (filter.priority) {
        proposals = proposals.filter(p => p.tracking.priority === filter.priority);
      }
      if (filter.category) {
        proposals = proposals.filter(p => p.tracking.category.primary === filter.category);
      }
      if (filter.watcher) {
        proposals = proposals.filter(p => p.tracking.watchers.includes(filter.watcher!));
      }
    }

    // Sort by priority and last updated
    proposals.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.tracking.priority];
      const bPriority = priorityOrder[b.tracking.priority];

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      return b.tracking.lastUpdated.getTime() - a.tracking.lastUpdated.getTime();
    });

    // Apply pagination
    if (filter?.offset) {
      proposals = proposals.slice(filter.offset);
    }
    if (filter?.limit) {
      proposals = proposals.slice(0, filter.limit);
    }

    return proposals;
  }

  /**
   * Add a watcher to a proposal
   */
  async addWatcher(proposalId: number, watcherAddress: Address): Promise<void> {
    const tracked = this.trackedProposals.get(proposalId);
    if (!tracked) {
      throw new Error(`Proposal ${proposalId} is not being tracked`);
    }

    if (!tracked.tracking.watchers.includes(watcherAddress)) {
      tracked.tracking.watchers.push(watcherAddress);
      tracked.tracking.watchCount++;
    }

    // Add to watchers map
    if (!this.watchers.has(watcherAddress)) {
      this.watchers.set(watcherAddress, new Set());
    }
    this.watchers.get(watcherAddress)!.add(proposalId);

    // Update cache
    const cacheKey = `proposal:tracked:${proposalId}`;
    await this.cacheService.set(cacheKey, JSON.stringify(tracked), {
      ttl: this.config.refreshInterval
    });

    logger.info('Added watcher to proposal', {
      proposalId,
      watcherAddress,
      totalWatchers: tracked.tracking.watchCount
    });
  }

  /**
   * Remove a watcher from a proposal
   */
  async removeWatcher(proposalId: number, watcherAddress: Address): Promise<void> {
    const tracked = this.trackedProposals.get(proposalId);
    if (!tracked) return;

    const index = tracked.tracking.watchers.indexOf(watcherAddress);
    if (index !== -1) {
      tracked.tracking.watchers.splice(index, 1);
      tracked.tracking.watchCount--;
    }

    // Remove from watchers map
    const watcherProposals = this.watchers.get(watcherAddress);
    if (watcherProposals) {
      watcherProposals.delete(proposalId);
      if (watcherProposals.size === 0) {
        this.watchers.delete(watcherAddress);
      }
    }

    // Update cache
    const cacheKey = `proposal:tracked:${proposalId}`;
    await this.cacheService.set(cacheKey, JSON.stringify(tracked), {
      ttl: this.config.refreshInterval
    });

    logger.info('Removed watcher from proposal', {
      proposalId,
      watcherAddress,
      totalWatchers: tracked.tracking.watchCount
    });
  }

  /**
   * Get proposals watched by a specific address
   */
  async getWatchedProposals(watcherAddress: Address): Promise<TrackedProposalViem[]> {
    const proposalIds = this.watchers.get(watcherAddress);
    if (!proposalIds) return [];

    const proposals: TrackedProposalViem[] = [];
    for (const proposalId of proposalIds) {
      const tracked = await this.getTrackedProposal(proposalId);
      if (tracked) {
        proposals.push(tracked);
      }
    }

    return proposals.sort((a, b) =>
      b.tracking.lastUpdated.getTime() - a.tracking.lastUpdated.getTime()
    );
  }

  /**
   * Get proposal analytics
   */
  async getProposalAnalytics(proposalId: number): Promise<ProposalAnalyticsViem> {
    const cacheKey = `proposal:analytics:${proposalId}`;
    const cached = this.analyticsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const tracked = await this.getTrackedProposal(proposalId);
    if (!tracked) {
      throw new Error(`Proposal ${proposalId} is not being tracked`);
    }

    const analytics = await this.calculateAnalytics(tracked);
    this.analyticsCache.set(cacheKey, analytics);

    // Cache analytics for shorter period
    setTimeout(() => {
      this.analyticsCache.delete(cacheKey);
    }, 300000); // 5 minutes

    return analytics;
  }

  /**
   * Get voting predictions for a proposal
   */
  async getVotingPredictions(proposalId: number): Promise<VotingPredictionViem[]> {
    const tracked = await this.getTrackedProposal(proposalId);
    if (!tracked) {
      throw new Error(`Proposal ${proposalId} is not being tracked`);
    }

    return await this.generateVotingPredictions(tracked);
  }

  /**
   * Get voting recommendations for a user
   */
  async getVotingRecommendations(proposalId: number, userAddress: Address): Promise<VotingRecommendationViem> {
    const tracked = await this.getTrackedProposal(proposalId);
    if (!tracked) {
      throw new Error(`Proposal ${proposalId} is not being tracked`);
    }

    return await this.generateVotingRecommendations(tracked, userAddress);
  }

  /**
   * Get proposal timeline
   */
  async getProposalTimeline(proposalId: number): Promise<ProposalTimelineViem> {
    const tracked = await this.getTrackedProposal(proposalId);
    if (!tracked) {
      throw new Error(`Proposal ${proposalId} is not being tracked`);
    }

    return tracked.timeline;
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(userAddress: Address, unreadOnly: boolean = false): Promise<ProposalNotificationViem[]> {
    let notifications = this.notifications.filter(n => n.recipient === userAddress);

    if (unreadOnly) {
      notifications = notifications.filter(n => !n.read);
    }

    return notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(notificationId: string): Promise<void> {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
    }
  }

  // Private helper methods

  private async createTrackedProposal(
    proposalId: number,
    proposal: ProposalViem,
    category: ProposalCategoryViem
  ): Promise<TrackedProposalViem> {
    const now = new Date();

    return {
      id: proposalId,
      proposal,
      tracking: {
        trackedAt: now,
        lastUpdated: now,
        updateCount: 0,
        watchCount: 0,
        watchers: [],
        tags: [],
        priority: this.calculateProposalPriority(proposal, category),
        category,
        impact: await this.assessProposalImpact(proposal)
      },
      voting: {
        votingPower: '0',
        votingWeight: '0',
        votingDeadline: new Date(proposal.endBlock * 15000), // Approximate
        currentResults: await this.calculateCurrentVotingResults(proposalId),
        predictions: [],
        recommendations: [],
        historicalContext: await this.getVotingHistoryContext(proposalId)
      },
      analytics: await this.initializeAnalytics(proposalId),
      status: proposal.status,
      timeline: await this.initializeTimeline(proposal),
      interactions: [],
      notifications: []
    };
  }

  private calculateProposalPriority(proposal: ProposalViem, category: ProposalCategoryViem): 'low' | 'medium' | 'high' | 'critical' {
    // Calculate priority based on proposal value, impact, and category
    const value = parseFloat(proposal.value);
    const hasFinancialImpact = value > 0;
    const isGovernanceChange = category.primary === 'governance';
    const hasHighRisk = category.tags.some(tag => tag.includes('risk') || tag.includes('security'));

    if (hasFinancialImpact && value > 1000000 && (isGovernanceChange || hasHighRisk)) {
      return 'critical';
    } else if (hasFinancialImpact && value > 100000 || isGovernanceChange) {
      return 'high';
    } else if (hasFinancialImpact || category.tags.length > 3) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private async assessProposalImpact(proposal: ProposalViem): Promise<ProposalImpactViem> {
    const value = parseFloat(proposal.value || '0');

    return {
      financial: {
        estimatedCost: proposal.value || '0',
        budgetAllocation: value > 0 ? (value * 0.1).toString() : '0',
        treasuryImpact: value > 0 ? (value * 0.05).toString() : '0',
        tokenEconomics: value > 1000000 ? 'high' : value > 100000 ? 'medium' : 'low',
        marketImpact: value > 1000000 ? 'significant' : value > 100000 ? 'moderate' : 'minimal',
        riskLevel: value > 1000000 ? 'high' : value > 100000 ? 'medium' : 'low'
      },
      governance: {
        votingPowerChange: '0',
        quorumImpact: '0',
        governanceStructure: 'minimal',
        processChange: 'minor',
        decentralization: 'neutral'
      },
      technical: {
        complexity: proposal.operations.length > 5 ? 'high' : proposal.operations.length > 2 ? 'medium' : 'low',
        implementationTime: proposal.operations.length > 5 ? '3-6 months' : '1-3 months',
        riskLevel: 'low',
        dependencies: [],
        integrationPoints: [],
        upgradeRequired: false
      },
      community: {
        stakeholderEffect: 'neutral',
        participationChange: '0',
        sentiment: 'mixed',
        controversyLevel: 0.3,
        adoptionRate: 'moderate'
      },
      overall: {
        score: Math.min(100, value / 10000),
        level: value > 1000000 ? 'significant' : value > 100000 ? 'moderate' : 'minimal',
        confidence: 0.8,
        timeframe: '3-6 months',
        successProbability: 0.7
      }
    };
  }

  private async calculateCurrentVotingResults(proposalId: number): Promise<VotingResultsViem> {
    try {
      const voteResult = await this.governanceService.calculateVoteResult(proposalId);

      return {
        forVotes: voteResult.votesFor,
        againstVotes: voteResult.votesAgainst,
        abstainVotes: voteResult.abstainVotes,
        totalVotes: voteResult.totalVotes,
        quorum: voteResult.quorumVotes,
        quorumReached: voteResult.quorumReached,
        currentSupport: parseFloat(voteResult.votesFor) / parseFloat(voteResult.totalVotes) * 100,
        turnoutRate: 0, // Would calculate based on total voting power
        timeRemaining: 0, // Would calculate based on current time vs end block
        voterCount: 0, // Would count unique voters
        powerDistribution: {
          whales: '0',
          large: '0',
          medium: '0',
          small: '0',
          whaleCount: 0,
          largeCount: 0,
          mediumCount: 0,
          smallCount: 0
        }
      };
    } catch (error) {
      logger.error('Failed to calculate voting results', {
        error: (error as Error).message,
        proposalId
      });

      return {
        forVotes: '0',
        againstVotes: '0',
        abstainVotes: '0',
        totalVotes: '0',
        quorum: '0',
        quorumReached: false,
        currentSupport: 0,
        turnoutRate: 0,
        timeRemaining: 0,
        voterCount: 0,
        powerDistribution: {
          whales: '0',
          large: '0',
          medium: '0',
          small: '0',
          whaleCount: 0,
          largeCount: 0,
          mediumCount: 0,
          smallCount: 0
        }
      };
    }
  }

  private async getVotingHistoryContext(proposalId: number): Promise<VotingHistoryContextViem> {
    // Simplified implementation - would query actual historical data
    return {
      similarProposals: [],
      voterBehavior: {
        participationRate: 0.6,
        votingPatterns: [],
        demographicShifts: [],
        sentimentTrends: []
      },
      marketConditions: {
        tokenPrice: '0',
        marketCap: '0',
        tradingVolume: '0',
        volatility: 0.3,
        sentiment: 'neutral',
        keyEvents: []
      },
      governanceTrends: []
    };
  }

  private async initializeAnalytics(proposalId: number): Promise<ProposalAnalyticsViem> {
    return {
      engagement: {
        views: 0,
        uniqueViewers: 0,
        averageViewTime: 0,
        discussionParticipants: 0,
        comments: 0,
        shares: 0,
        bookmarks: 0,
        engagementRate: 0,
        peakEngagement: new Date()
      },
      participation: {
        voterCount: 0,
        votingPowerParticipation: '0',
        participationRate: 0,
        demographicBreakdown: {
          byHoldingSize: {},
          byVotingHistory: {},
          byEngagement: {},
          byExperience: {}
        },
        geographicDistribution: {
          byRegion: {},
          byTimezone: {},
          concentration: 0
        },
        temporalPatterns: []
      },
      voting: {
        voteDistribution: {
          for: '0',
          against: '0',
          abstain: '0',
          forPercentage: 0,
          againstPercentage: 0,
          abstainPercentage: 0,
          effectiveVotingPower: '0'
        },
        votingTimeline: [],
        votingPowerEfficiency: 0,
        voterAlignment: {
          withCommunity: 0,
          withExperts: 0,
          withPrevious: 0,
          consistency: 0
        },
        votingDynamics: {
          momentum: 0,
          volatility: 0,
          convergenceRate: 0,
          swingVoters: 0,
          decisiveVoters: 0
        }
      },
      performance: {
        gasEfficiency: 0,
        successRate: 0,
        errorRate: 0,
        bottlenecks: [],
        optimizationOpportunities: []
      },
      sentiment: {
        overallSentiment: 0,
        sentimentDistribution: {},
        sentimentTrends: [],
        keyTopics: [],
        influencerOpinions: []
      },
      impact: {
        expectedImpact: '0',
        impactVariance: 0,
        successMetrics: [],
        lessonsLearned: []
      }
    };
  }

  private async initializeTimeline(proposal: ProposalViem): Promise<ProposalTimelineViem> {
    const events: ProposalEventViem[] = [
      {
        id: 'created',
        type: 'created',
        timestamp: new Date(proposal.metadata.creationTime),
        title: 'Proposal Created',
        description: `Proposal "${proposal.description}" was created`,
        data: { proposalId: proposal.id },
        impact: 'high'
      }
    ];

    if (proposal.status !== 'pending') {
      events.push({
        id: 'active',
        type: 'active',
        timestamp: new Date(proposal.startBlock * 15000),
        title: 'Voting Started',
        description: 'Voting period has begun',
        data: { startBlock: proposal.startBlock },
        impact: 'high'
      });
    }

    return {
      events,
      milestones: [],
      deadlines: [
        {
          id: 'voting_deadline',
          type: 'voting',
          deadline: new Date(proposal.endBlock * 15000),
          reminder: true,
          status: new Date() < new Date(proposal.endBlock * 15000) ? 'upcoming' : 'passed'
        }
      ],
      dependencies: []
    };
  }

  private async initializeTracking(proposalId: number): Promise<void> {
    // Set up event listeners, notifications, etc.
    logger.info('Initialized tracking for proposal', { proposalId });
  }

  private async updateTrackedProposal(tracked: TrackedProposalViem): Promise<void> {
    try {
      // Get latest proposal data
      const latestProposal = await this.governanceService.getProposal(tracked.id);
      if (latestProposal) {
        tracked.proposal = latestProposal;
        tracked.status = latestProposal.status;
      }

      // Update voting results
      tracked.voting.currentResults = await this.calculateCurrentVotingResults(tracked.id);

      // Update tracking metadata
      tracked.tracking.lastUpdated = new Date();
      tracked.tracking.updateCount++;

      // Add new interactions if any
      await this.updateInteractions(tracked);

    } catch (error) {
      logger.error('Failed to update tracked proposal', {
        error: (error as Error).message,
        proposalId: tracked.id
      });
    }
  }

  private async updateInteractions(tracked: TrackedProposalViem): Promise<void> {
    // Implementation would update interaction data
    // This would involve querying events, logs, etc.
  }

  private async calculateAnalytics(tracked: TrackedProposalViem): Promise<ProposalAnalyticsViem> {
    // Implementation would calculate comprehensive analytics
    return tracked.analytics;
  }

  private async generateVotingPredictions(tracked: TrackedProposalViem): Promise<VotingPredictionViem[]> {
    const results = tracked.voting.currentResults;
    const currentSupport = results.currentSupport / 100;

    return [
      {
        timestamp: new Date(),
        predictedOutcome: currentSupport > 0.5 ? 'pass' : 'fail',
        confidence: Math.abs(currentSupport - 0.5) * 2,
        predictedSupport: currentSupport,
        predictedTurnout: 0.6,
        keyFactors: [
          {
            factor: 'Current voting trends',
            impact: currentSupport > 0.5 ? 0.3 : -0.3,
            weight: 0.4,
            explanation: 'Based on current voting patterns'
          }
        ],
        scenario: 'base',
        modelAccuracy: 0.75
      }
    ];
  }

  private async generateVotingRecommendations(tracked: TrackedProposalViem, userAddress: Address): Promise<VotingRecommendationViem> {
    // Get user's voting power and history
    const userVotingPower = await this.governanceService.getVotingPower(userAddress);

    return {
      recommendation: 'for', // Would calculate based on analysis
      confidence: 0.7,
      reasoning: [
        'Analysis suggests positive impact',
        'Aligns with your historical voting patterns',
        'Low risk implementation'
      ],
      alignmentScore: 0.8,
      riskAssessment: {
        financialRisk: 0.2,
        governanceRisk: 0.1,
        technicalRisk: 0.3,
        reputationalRisk: 0.1,
        overallRisk: 0.175,
        mitigation: ['Monitor implementation', 'Set up success metrics']
      },
      alternatives: []
    };
  }

  private startAutoRefresh(): void {
    setInterval(async () => {
      try {
        await this.refreshAllTrackedProposals();
      } catch (error) {
        logger.error('Auto-refresh failed', { error: (error as Error).message });
      }
    }, this.config.refreshInterval * 1000);

    logger.info('Started auto-refresh', {
      interval: this.config.refreshInterval,
      proposalCount: this.trackedProposals.size
    });
  }

  private async refreshAllTrackedProposals(): Promise<void> {
    const proposalIds = Array.from(this.trackedProposals.keys());

    for (const proposalId of proposalIds) {
      try {
        const tracked = this.trackedProposals.get(proposalId);
        if (tracked) {
          await this.updateTrackedProposal(tracked);

          // Update cache
          const cacheKey = `proposal:tracked:${proposalId}`;
          await this.cacheService.set(cacheKey, JSON.stringify(tracked), {
            ttl: this.config.refreshInterval
          });
        }
      } catch (error) {
        logger.error('Failed to refresh proposal', {
          error: (error as Error).message,
          proposalId
        });
      }
    }

    logger.debug('Refreshed all tracked proposals', {
      count: proposalIds.length
    });
  }

  /**
   * Get tracking statistics
   */
  async getTrackingStatistics(): Promise<{
    totalTracked: number;
    byStatus: Record<ProposalStatusViem, number>;
    byPriority: Record<string, number>;
    totalWatchers: number;
    averageUpdateTime: number;
  }> {
    const proposals = Array.from(this.trackedProposals.values());

    const byStatus: Record<ProposalStatusViem, number> = {
      pending: 0,
      active: 0,
      canceled: 0,
      defeated: 0,
      succeeded: 0,
      queued: 0,
      expired: 0,
      executed: 0
    };

    const byPriority: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    proposals.forEach(proposal => {
      byStatus[proposal.status]++;
      byPriority[proposal.tracking.priority]++;
    });

    const totalWatchers = Array.from(this.watchers.values())
      .reduce((sum, set) => sum + set.size, 0);

    return {
      totalTracked: proposals.length,
      byStatus,
      byPriority,
      totalWatchers,
      averageUpdateTime: this.config.refreshInterval
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.trackedProposals.clear();
    this.votingInterfaces.clear();
    this.notifications = [];
    this.watchers.clear();
    this.analyticsCache.clear();

    logger.info('Proposal tracker cleaned up');
  }
}

// Factory function
export function createProposalTrackerViem(
  governanceService: any,
  config: ProposalTrackerConfigViem,
  cacheService: ICache
): ProposalTrackerViem {
  return new ProposalTrackerViem(governanceService, config, cacheService);
}