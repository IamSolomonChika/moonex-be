import { ethers } from 'ethers';
import { CakeGovernanceService } from './cake-governance';
import { VotingPowerTracker } from './voting-power-tracker';
import { ProposalTracker } from './proposal-tracker';

/**
 * Comprehensive governance participation rewards system
 */
export interface ParticipationRewardsConfig {
  enabled: boolean;
  rewardToken: {
    address: string;
    symbol: string;
    decimals: number;
  };
  rewardPools: RewardPool[];
  distribution: DistributionConfig;
  eligibility: EligibilityConfig;
  calculation: CalculationConfig;
  timing: TimingConfig;
  notifications: NotificationConfig;
}

export interface RewardPool {
  id: string;
  name: string;
  description: string;
  type: RewardType;
  allocation: RewardAllocation;
  schedule: RewardSchedule;
  criteria: RewardCriteria[];
  multipliers: RewardMultiplier[];
  caps: RewardCaps;
  status: 'active' | 'paused' | 'expired';
}

export interface RewardType {
  category: 'voting' | 'participation' | 'contribution' | 'delegation' | 'governance' | 'community';
  subcategory: string;
  frequency: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
}

export interface RewardAllocation {
  totalAmount: string;
  amountPerPeriod: string;
  currency: string;
  vesting: VestingConfig;
  bonus: BonusConfig;
}

export interface VestingConfig {
  enabled: boolean;
  schedule: VestingSchedule;
  cliff: number; // seconds
  period: number; // seconds
  percentageLinear: number;
  percentageMilestone: number;
}

export interface VestingSchedule {
  immediate: number; // percentage
  milestone1: { percentage: number; timeframe: number }; // percentage, seconds
  milestone2: { percentage: number; timeframe: number };
  milestone3: { percentage: number; timeframe: number };
  final: { percentage: number; timeframe: number };
}

export interface BonusConfig {
  enabled: boolean;
  criteria: BonusCriteria[];
  multiplier: number;
  maxBonus: string;
}

export interface BonusCriteria {
  criteria: string;
  threshold: number;
  bonus: number;
  description: string;
}

export interface RewardSchedule {
  start: Date;
  end: Date;
  frequency: number; // seconds
  periods: number;
  distribution: 'immediate' | 'batch' | 'continuous';
}

export interface RewardCriteria {
  id: string;
  type: CriterionType;
  weight: number; // 0-1
  measurement: Measurement;
  threshold: number;
  description: string;
}

export interface CriterionType {
  category: 'participation' | 'quality' | 'consistency' | 'impact' | 'engagement' | 'expertise';
  subcategory: string;
  metric: string;
}

export interface Measurement {
  method: 'count' | 'percentage' | 'score' | 'weighted' | 'composite';
  source: string;
  timeframe: number; // seconds
  normalization: 'none' | 'minmax' | 'zscore' | 'rank';
}

export interface RewardMultiplier {
  id: string;
  name: string;
  description: string;
  criteria: MultiplierCriteria;
  multiplier: number;
  maxMultiplier: number;
  stackable: boolean;
  duration: number; // seconds
}

export interface MultiplierCriteria {
  criteria: string;
  operator: '>' | '<' | '=' | '>=' | '<=';
  value: number;
  timeWindow: number; // seconds
}

export interface RewardCaps {
  individual: IndividualCaps;
  pool: PoolCaps;
  period: PeriodCaps;
}

export interface IndividualCaps {
  maxPerPeriod: string;
  maxPerYear: string;
  maxLifetime: string;
  percentageOfPool: number;
}

export interface PoolCaps {
  maxPerDistribution: string;
  maxClaimants: number;
  minClaimAmount: string;
  maxClaimAmount: string;
}

export interface PeriodCaps {
  maxTotalRewards: string;
  maxParticipants: number;
  reservePercentage: number;
}

export interface EligibilityConfig {
  minimums: MinimumRequirements;
  restrictions: RestrictionRules;
  verification: VerificationConfig;
  blacklist: BlacklistConfig;
  whitelist: WhitelistConfig;
}

export interface MinimumRequirements {
  votingPower: string;
  participationRate: number;
  tenure: number; // seconds
  reputation: number;
  activity: ActivityRequirement;
}

export interface ActivityRequirement {
  proposalsVoted: number;
  discussionsParticipated: number;
  contributionsSubmitted: number;
  governanceActions: number;
}

export interface RestrictionRules {
  maxRewardsPerWallet: number;
  sybilProtection: boolean;
  geographic: GeographicRestriction[];
  temporal: TemporalRestriction[];
}

export interface GeographicRestriction {
  type: 'allow' | 'block';
  countries: string[];
  reason: string;
}

export interface TemporalRestriction {
  type: 'cooldown' | 'blackout' | 'window';
  start: Date;
  end: Date;
  description: string;
}

export interface VerificationConfig {
  required: boolean;
  methods: VerificationMethod[];
  providers: VerificationProvider[];
  level: 'basic' | 'standard' | 'enhanced';
}

export interface VerificationMethod {
  method: 'kyc' | 'identity' | 'attestation' | 'staking' | 'social';
  required: boolean;
  provider: string;
  data: string[];
}

export interface VerificationProvider {
  name: string;
  type: 'centralized' | 'decentralized' | 'hybrid';
  integration: IntegrationConfig;
  reliability: number;
  cost: string;
}

export interface IntegrationConfig {
  apiEndpoint: string;
  authentication: string;
  dataFormat: string;
  rateLimit: number;
}

export interface BlacklistConfig {
  enabled: boolean;
  sources: BlacklistSource[];
  appeal: AppealConfig;
  automatic: boolean;
}

export interface BlacklistSource {
  source: string;
  type: 'address' | 'behavior' | 'external' | 'manual';
  reliability: number;
  updateFrequency: number;
}

export interface AppealConfig {
  enabled: boolean;
  process: string;
  timeframe: number;
  requirements: string[];
  reviewers: string[];
}

export interface WhitelistConfig {
  enabled: boolean;
  criteria: WhitelistCriteria[];
  benefits: WhitelistBenefits;
  management: WhitelistManagement;
}

export interface WhitelistCriteria {
  criteria: string;
  operator: string;
  value: any;
  weight: number;
}

export interface WhitelistBenefits {
  bonusMultiplier: number;
  earlyAccess: number;
  reducedRequirements: number;
  exclusivePools: string[];
}

export interface WhitelistManagement {
  manager: string;
  process: string;
  review: string;
  appeals: string;
}

export interface CalculationConfig {
  formulas: CalculationFormula[];
  weights: WeightConfig;
  normalization: NormalizationConfig;
  aggregation: AggregationConfig;
}

export interface CalculationFormula {
  id: string;
  name: string;
  description: string;
  formula: string;
  variables: FormulaVariable[];
  validation: FormulaValidation;
}

export interface FormulaVariable {
  name: string;
  type: 'input' | 'calculated' | 'constant';
  source: string;
  transformation: string;
  validation: string;
}

export interface FormulaValidation {
  rules: ValidationRule[];
  tests: ValidationTest[];
  thresholds: ValidationThreshold[];
}

export interface ValidationRule {
  rule: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationTest {
  name: string;
  input: any;
  expected: any;
  tolerance: number;
}

export interface ValidationThreshold {
  metric: string;
  min: number;
  max: number;
  action: 'warn' | 'error' | 'adjust';
}

export interface WeightConfig {
  categories: CategoryWeight[];
  dynamic: DynamicWeighting;
  balancing: WeightBalancing;
}

export interface CategoryWeight {
  category: string;
  weight: number;
  minWeight: number;
  maxWeight: number;
  adjustment: number;
}

export interface DynamicWeighting {
  enabled: boolean;
  factors: WeightFactor[];
  adjustment: WeightAdjustment;
  smoothing: WeightSmoothing;
}

export interface WeightFactor {
  factor: string;
  impact: number;
  timeframe: number;
  source: string;
  reliability: number;
}

export interface WeightAdjustment {
  method: 'linear' | 'exponential' | 'logarithmic';
  sensitivity: number;
  bounds: { min: number; max: number };
  frequency: number;
}

export interface WeightSmoothing {
  method: 'moving_average' | 'exponential' | 'lowpass';
  window: number;
  alpha: number;
}

export interface WeightBalancing {
  enabled: boolean;
  method: 'proportional' | 'equal' | 'performance';
  frequency: number;
  constraints: BalancingConstraint[];
}

export interface BalancingConstraint {
  constraint: string;
  value: number;
  priority: number;
  flexible: boolean;
}

export interface NormalizationConfig {
  method: 'minmax' | 'zscore' | 'rank' | 'percentile' | 'custom';
  parameters: NormalizationParameters;
  outliers: OutlierHandling;
  scaling: ScalingConfig;
}

export interface NormalizationParameters {
  min?: number;
  max?: number;
  mean?: number;
  std?: number;
  percentile?: number;
}

export interface OutlierHandling {
  method: 'clip' | 'remove' | 'transform';
  threshold: number;
  action: string;
}

export interface ScalingConfig {
  enabled: boolean;
  method: 'linear' | 'logarithmic' | 'exponential';
  parameters: Record<string, number>;
}

export interface AggregationConfig {
  method: 'sum' | 'weighted_average' | 'geometric_mean' | 'custom';
  timeframe: number;
  windows: AggregationWindow[];
  smoothing: AggregationSmoothing;
}

export interface AggregationWindow {
  name: string;
  size: number;
  weight: number;
  overlap: number;
}

export interface AggregationSmoothing {
  enabled: boolean;
  method: 'moving_average' | 'exponential';
  parameters: Record<string, number>;
}

export interface TimingConfig {
  distribution: DistributionTiming;
  vesting: VestingTiming;
  claiming: ClaimingTiming;
  expiration: ExpirationTiming;
}

export interface DistributionTiming {
  frequency: number; // seconds
  schedule: DistributionSchedule;
  delays: DistributionDelay[];
  holidays: HolidaySchedule[];
}

export interface DistributionSchedule {
  type: 'fixed' | 'relative' | 'conditional';
  pattern: SchedulePattern[];
  timezone: string;
  businessDaysOnly: boolean;
}

export interface SchedulePattern {
  dayOfWeek: number;
  time: string;
  enabled: boolean;
  amount?: string;
  conditions?: string[];
}

export interface DistributionDelay {
  type: 'initial' | 'processing' | 'verification';
  duration: number;
  reason: string;
  bypassable: boolean;
}

export interface HolidaySchedule {
  holidays: Holiday[];
  behavior: 'skip' | 'next_day' | 'previous_day';
  notifications: boolean;
}

export interface Holiday {
  name: string;
  date: Date;
  recurring: boolean;
  timezone: string;
}

export interface VestingTiming {
  schedule: VestingSchedule;
  acceleration: AccelerationConfig;
  modification: ModificationConfig;
}

export interface AccelerationConfig {
  enabled: boolean;
  triggers: AccelerationTrigger[];
  multiplier: number;
  cap: number;
}

export interface AccelerationTrigger {
  trigger: string;
  condition: string;
  acceleration: number;
  maxAcceleration: number;
}

export interface ModificationConfig {
  allowed: boolean;
  methods: ModificationMethod[];
  approval: ModificationApproval;
  limits: ModificationLimit[];
}

export interface ModificationMethod {
  method: 'extend' | 'accelerate' | 'adjust' | 'pause';
  requirements: string[];
  restrictions: string[];
}

export interface ModificationApproval {
  required: boolean;
  approvers: string[];
  threshold: number;
  process: string;
}

export interface ModificationLimit {
  limit: string;
  type: 'absolute' | 'percentage' | 'frequency';
  value: number;
  timeframe: number;
}

export interface ClaimingTiming {
  window: ClaimingWindow;
  deadlines: ClaimingDeadline[];
  extensions: ExtensionConfig[];
  reminders: ReminderConfig[];
}

export interface ClaimingWindow {
  open: Date;
  close: Date;
  frequency: number;
  autoClaim: boolean;
  batchClaim: boolean;
}

export interface ClaimingDeadline {
  type: 'soft' | 'hard' | 'rolling';
  date: Date;
  action: 'forfeit' | 'redistribute' | 'extend';
  notification: boolean;
}

export interface ExtensionConfig {
  enabled: boolean;
  criteria: ExtensionCriteria[];
  limits: ExtensionLimit[];
  process: string;
}

export interface ExtensionCriteria {
  criteria: string;
  extension: number;
  maxExtensions: number;
  approval: string;
}

export interface ExtensionLimit {
  limit: string;
  type: 'time' | 'percentage' | 'absolute';
  value: number;
}

export interface ReminderConfig {
  enabled: boolean;
  schedule: ReminderSchedule[];
  channels: NotificationChannel[];
  content: ReminderContent[];
}

export interface ReminderSchedule {
  trigger: string;
  offset: number;
  frequency: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface NotificationChannel {
  channel: 'email' | 'push' | 'in_app' | 'sms' | 'discord' | 'telegram';
  enabled: boolean;
  template: string;
  settings: Record<string, any>;
}

export interface ReminderContent {
  type: string;
  template: string;
  variables: string[];
  personalization: boolean;
}

export interface ExpirationTiming {
  periods: ExpirationPeriod[];
  gracePeriods: GracePeriod[];
  forfeiture: ForfeitureConfig;
  redistribution: RedistributionConfig;
}

export interface ExpirationPeriod {
  period: string;
  duration: number;
  action: 'expire' | 'extend' | 'convert';
  notification: boolean;
}

export interface GracePeriod {
  type: 'claim' | 'verification' | 'appeal';
  duration: number;
  conditions: string[];
  extensions: number;
}

export interface ForfeitureConfig {
  enabled: boolean;
  conditions: ForfeitureCondition[];
  process: ForfeitureProcess;
  appeals: ForfeitureAppeal;
}

export interface ForfeitureCondition {
  condition: string;
  threshold: number;
  timeframe: number;
  warning: boolean;
}

export interface ForfeitureProcess {
  notice: number;
  review: number;
  decision: number;
  execution: number;
}

export interface ForfeitureAppeal {
  enabled: boolean;
  timeframe: number;
  requirements: string[];
  reviewers: string[];
}

export interface RedistributionConfig {
  enabled: boolean;
  method: 'proportional' | 'equal' | 'performance' | 'lottery';
  recipients: RedistributionRecipient[];
  frequency: number;
}

export interface RedistributionRecipient {
  type: 'active' | 'eligible' | 'top_performers' | 'random';
  criteria: string;
  weight: number;
  cap: string;
}

export interface NotificationConfig {
  channels: NotificationChannel[];
  events: NotificationEvent[];
  templates: NotificationTemplate[];
  preferences: NotificationPreferences;
}

export interface NotificationEvent {
  event: string;
  channels: string[];
  template: string;
  timing: NotificationTiming;
  conditions: NotificationCondition[];
}

export interface NotificationTiming {
  immediate: boolean;
  delay: number;
  schedule?: string;
  timezone: string;
}

export interface NotificationCondition {
  condition: string;
  value: any;
  operator: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'email' | 'push' | 'in_app' | 'sms';
  subject?: string;
  body: string;
  variables: TemplateVariable[];
  localization: TemplateLocalization[];
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'percentage';
  format?: string;
  required: boolean;
  default?: any;
}

export interface TemplateLocalization {
  language: string;
  subject?: string;
  body: string;
}

export interface NotificationPreferences {
  defaultChannels: string[];
  frequency: 'immediate' | 'digest' | 'weekly' | 'never';
  quietHours: QuietHours;
  categories: CategoryPreferences[];
}

export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
  weekends: boolean;
  urgent: boolean;
}

export interface CategoryPreferences {
  category: string;
  enabled: boolean;
  channels: string[];
  frequency: string;
}

export interface RewardCalculation {
  participant: string;
  period: RewardPeriod;
  metrics: ParticipantMetrics;
  score: RewardScore;
  amount: string;
  breakdown: RewardBreakdown;
  multipliers: AppliedMultiplier[];
  verification: VerificationStatus;
}

export interface RewardPeriod {
  id: string;
  start: Date;
  end: Date;
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  status: 'pending' | 'active' | 'completed' | 'expired';
}

export interface ParticipantMetrics {
  voting: VotingMetrics;
  participation: ParticipationMetrics;
  contribution: ContributionMetrics;
  engagement: EngagementMetrics;
  quality: QualityMetrics;
}

export interface VotingMetrics {
  votesCast: number;
  votingPower: string;
  participationRate: number;
  consistency: number;
  alignment: number;
  timeliness: number;
}

export interface ParticipationMetrics {
  proposalsReviewed: number;
  discussionsParticipated: number;
  commentsPosted: number;
  delegationsReceived: number;
  communityEvents: number;
}

export interface ContributionMetrics {
  proposalsSubmitted: number;
  improvementsSuggested: number;
  bugsReported: number;
  documentationCreated: number;
  mentorshipProvided: number;
}

export interface EngagementMetrics {
  loginFrequency: number;
  sessionDuration: number;
  interactionDepth: number;
  networkGrowth: number;
  influenceScore: number;
}

export interface QualityMetrics {
  reasoningQuality: number;
  researchDepth: number;
  constructiveness: number;
  innovation: number;
  accuracy: number;
}

export interface RewardScore {
  total: number;
  breakdown: ScoreBreakdown;
  rank: number;
  percentile: number;
  trend: ScoreTrend;
}

export interface ScoreBreakdown {
  voting: number;
  participation: number;
  contribution: number;
  engagement: number;
  quality: number;
  bonus: number;
}

export interface ScoreTrend {
  current: number;
  previous: number;
  change: number;
  direction: 'up' | 'down' | 'stable';
  momentum: number;
}

export interface RewardBreakdown {
  base: RewardComponent;
  bonus: RewardComponent;
  multipliers: RewardComponent[];
  adjustments: RewardComponent[];
  total: string;
}

export interface RewardComponent {
  type: string;
  amount: string;
  percentage: number;
  description: string;
  calculation: string;
  source: string;
}

export interface AppliedMultiplier {
  id: string;
  name: string;
  criteria: string;
  multiplier: number;
  amount: string;
  reason: string;
}

export interface VerificationStatus {
  status: 'pending' | 'verified' | 'rejected' | 'flagged';
  score: number;
  checks: VerificationCheck[];
  issues: VerificationIssue[];
  reviewed: boolean;
}

export interface VerificationCheck {
  check: string;
  status: 'pass' | 'fail' | 'warning';
  score: number;
  details: string;
  timestamp: Date;
}

export interface VerificationIssue {
  issue: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  resolution?: string;
  resolved: boolean;
}

export interface RewardDistribution {
  id: string;
  period: RewardPeriod;
  pool: RewardPool;
  recipients: RewardRecipient[];
  summary: DistributionSummary;
  status: DistributionStatus;
  transactions: DistributionTransaction[];
}

export interface RewardRecipient {
  address: string;
  calculation: RewardCalculation;
  status: RecipientStatus;
  claim: ClaimStatus;
  history: RecipientHistory[];
}

export interface RecipientStatus {
  eligible: boolean;
  verified: boolean;
  calculated: boolean;
  notified: boolean;
  blocked: boolean;
  reason?: string;
}

export interface ClaimStatus {
  claimable: boolean;
  claimed: boolean;
  amount: string;
  claimedAt?: Date;
  expiresAt?: Date;
  transactionHash?: string;
  method: 'automatic' | 'manual' | 'batch';
}

export interface RecipientHistory {
  period: string;
  amount: string;
  status: string;
  claimed: boolean;
  claimedAt?: Date;
}

export interface DistributionSummary {
  totalAmount: string;
  totalRecipients: number;
  averageReward: string;
  medianReward: string;
  maxReward: string;
  minReward: string;
  distribution: RewardDistributionStats;
}

export interface RewardDistributionStats {
  top1Percent: string;
  top5Percent: string;
  top10Percent: string;
  top25Percent: string;
  bottom25Percent: string;
  giniCoefficient: number;
}

export interface DistributionStatus {
  status: 'pending' | 'calculating' | 'verifying' | 'ready' | 'distributing' | 'completed' | 'failed';
  progress: number;
  errors: DistributionError[];
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletion?: Date;
}

export interface DistributionError {
  error: string;
  recipient?: string;
  amount?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  resolution?: string;
}

export interface DistributionTransaction {
  id: string;
  hash: string;
  from: string;
  to: string;
  amount: string;
  gasUsed: string;
  gasPrice: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
  blockNumber?: number;
}

export interface RewardClaim {
  id: string;
  recipient: string;
  distribution: string;
  amount: string;
  status: ClaimStatus['status'];
  method: ClaimMethod;
  transaction: ClaimTransaction;
  timestamp: Date;
}

export interface ClaimMethod {
  type: 'direct' | 'gasless' | 'batch' | 'relay';
  provider?: string;
  parameters: Record<string, any>;
}

export interface ClaimTransaction {
  hash?: string;
  from: string;
  to: string;
  amount: string;
  gasUsed?: string;
  gasPrice?: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
  blockNumber?: number;
}

export interface RewardAnalytics {
  overview: RewardOverview;
  trends: RewardTrends;
  participation: ParticipationAnalytics;
  performance: PerformanceAnalytics;
  economic: EconomicAnalytics;
  predictions: RewardPredictions;
}

export interface RewardOverview {
  totalDistributed: string;
  totalRecipients: number;
  activePools: number;
  averageReward: string;
  distributionRate: number;
  claimRate: number;
}

export interface RewardTrends {
  distribution: DistributionTrend[];
  participation: ParticipationTrend[];
  claim: ClaimTrend[];
  pool: PoolTrend[];
}

export interface DistributionTrend {
  period: string;
  amount: string;
  recipients: number;
  average: string;
  efficiency: number;
}

export interface ParticipationTrend {
  period: string;
  participants: number;
  eligible: number;
  participationRate: number;
  newParticipants: number;
}

export interface ClaimTrend {
  period: string;
  claims: number;
  amount: string;
  claimRate: number;
  averageTimeToClaim: number;
}

export interface PoolTrend {
  poolId: string;
  period: string;
  distributed: string;
  utilization: number;
  effectiveness: number;
}

export interface ParticipationAnalytics {
  demographics: ParticipantDemographics;
  behavior: ParticipantBehavior;
  retention: ParticipantRetention;
  engagement: ParticipantEngagement;
}

export interface ParticipantDemographics {
  experience: Record<string, number>;
  holdingSize: Record<string, number>;
  geography: Record<string, number>;
  tenure: Record<string, number>;
  activity: Record<string, number>;
}

export interface ParticipantBehavior {
  votingPatterns: VotingBehavior[];
  participationPatterns: ParticipationPattern[];
  claimPatterns: ClaimPattern[];
  interactionPatterns: InteractionPattern[];
}

export interface VotingBehavior {
  metric: string;
  frequency: number;
  consistency: number;
  impact: number;
  trend: string;
}

export interface ParticipationPattern {
  activity: string;
  frequency: number;
  duration: number;
  quality: number;
  seasonality: string;
}

export interface ClaimPattern {
  timing: string;
  speed: number;
  method: string;
  success: number;
  retry: number;
}

export interface InteractionPattern {
  interaction: string;
  frequency: number;
  depth: number;
  quality: number;
  network: number;
}

export interface ParticipantRetention {
  overall: RetentionMetrics;
  cohorts: RetentionCohort[];
  churn: ChurnMetrics;
  reactivation: ReactivationMetrics;
}

export interface RetentionMetrics {
  rate: number;
  lifetime: number;
  return: number;
  dropoff: number;
}

export interface RetentionCohort {
  cohort: string;
  size: number;
  retention: number[];
  characteristics: string[];
}

export interface ChurnMetrics {
  rate: number;
  reasons: ChurnReason[];
  prediction: ChurnPrediction[];
  prevention: ChurnPrevention[];
}

export interface ChurnReason {
  reason: string;
  frequency: number;
  impact: string;
  preventable: boolean;
}

export interface ChurnPrediction {
  participant: string;
  risk: number;
  factors: string[];
  timeframe: number;
  intervention: string;
}

export interface ChurnPrevention {
  strategy: string;
  effectiveness: number;
  cost: string;
  implementation: string;
}

export interface ReactivationMetrics {
  rate: number;
  methods: ReactivationMethod[];
  success: number;
  cost: string;
}

export interface ReactivationMethod {
  method: string;
  success: number;
  cost: string;
  timeframe: number;
}

export interface ParticipantEngagement {
  overall: EngagementScore;
  channels: ChannelEngagement[];
  content: ContentEngagement[];
  quality: EngagementQuality;
}

export interface EngagementScore {
  score: number;
  trend: string;
  components: EngagementComponent[];
  benchmarks: EngagementBenchmark[];
}

export interface EngagementComponent {
  component: string;
  score: number;
  weight: number;
  trend: string;
}

export interface EngagementBenchmark {
  metric: string;
  current: number;
  average: number;
  percentile: number;
}

export interface ChannelEngagement {
  channel: string;
  usage: number;
  effectiveness: number;
  satisfaction: number;
  demographics: Record<string, number>;
}

export interface ContentEngagement {
  content: string;
  views: number;
  interactions: number;
  shares: number;
  sentiment: number;
}

export interface EngagementQuality {
  constructiveness: number;
  relevance: number;
  accuracy: number;
  timeliness: number;
  innovation: number;
}

export interface PerformanceAnalytics {
  pools: PoolPerformance[];
  calculations: CalculationPerformance[];
  distributions: DistributionPerformance[];
  claims: ClaimPerformance[];
}

export interface PoolPerformance {
  poolId: string;
  utilization: number;
  effectiveness: number;
  efficiency: number;
  satisfaction: number;
  roi: number;
}

export interface CalculationPerformance {
  accuracy: number;
  speed: number;
  reliability: number;
  fairness: number;
  transparency: number;
}

export interface DistributionPerformance {
  timeliness: number;
  success: number;
  cost: number;
  scale: number;
  automation: number;
}

export interface ClaimPerformance {
  speed: number;
  success: number;
  cost: number;
  userExperience: number;
  automation: number;
}

export interface EconomicAnalytics {
  costs: EconomicCosts;
  benefits: EconomicBenefits;
  efficiency: EconomicEfficiency;
  sustainability: EconomicSustainability;
}

export interface EconomicCosts {
  total: string;
  distribution: CostDistribution[];
  trends: CostTrend[];
  optimization: CostOptimization[];
}

export interface CostDistribution {
  category: string;
  amount: string;
  percentage: number;
  trend: string;
}

export interface CostTrend {
  period: string;
  amount: string;
  change: number;
  drivers: string[];
}

export interface CostOptimization {
  opportunity: string;
  savings: string;
  implementation: string;
  timeline: string;
}

export interface EconomicBenefits {
  total: string;
  distribution: BenefitDistribution[];
  roi: number;
  value: ValueCreation[];
}

export interface BenefitDistribution {
  beneficiary: string;
  benefit: string;
  percentage: number;
  sustainability: number;
}

export interface ValueCreation {
  type: string;
  amount: string;
  metrics: string[];
  sustainability: number;
}

export interface EconomicEfficiency {
  ratio: number;
  trends: EfficiencyTrend[];
  benchmarks: EfficiencyBenchmark[];
  improvements: EfficiencyImprovement[];
}

export interface EfficiencyTrend {
  metric: string;
  current: number;
  previous: number;
  change: number;
  trend: string;
}

export interface EfficiencyBenchmark {
  metric: string;
  current: number;
  industry: number;
  target: number;
}

export interface EfficiencyImprovement {
  improvement: string;
  impact: number;
  cost: string;
  timeline: string;
}

export interface EconomicSustainability {
  score: number;
  factors: SustainabilityFactor[];
  risks: SustainabilityRisk[];
  strategies: SustainabilityStrategy[];
}

export interface SustainabilityFactor {
  factor: string;
  impact: number;
  trend: string;
  outlook: string;
}

export interface SustainabilityRisk {
  risk: string;
  probability: number;
  impact: string;
  mitigation: string;
}

export interface SustainabilityStrategy {
  strategy: string;
  effectiveness: number;
  cost: string;
  timeline: string;
}

export interface RewardPredictions {
  participation: ParticipationPrediction[];
  distribution: DistributionPrediction[];
  claims: ClaimPrediction[];
  economic: EconomicPrediction[];
}

export interface ParticipationPrediction {
  period: string;
  participants: number;
  confidence: number;
  factors: PredictionFactor[];
  scenarios: PredictionScenario[];
}

export interface PredictionFactor {
  factor: string;
  weight: number;
  trend: string;
  reliability: number;
}

export interface PredictionScenario {
  scenario: string;
  probability: number;
  outcome: number;
  assumptions: string[];
}

export interface DistributionPrediction {
  period: string;
  amount: string;
  recipients: number;
  confidence: number;
  drivers: string[];
  risks: string[];
}

export interface ClaimPrediction {
  period: string;
  claims: number;
  amount: string;
  rate: number;
  confidence: number;
}

export interface EconomicPrediction {
  metric: string;
  period: string;
  value: string;
  change: number;
  confidence: number;
}

/**
 * Comprehensive participation rewards service
 */
export class ParticipationRewards {
  private governanceService: CakeGovernanceService;
  private votingPowerTracker: VotingPowerTracker;
  private proposalTracker: ProposalTracker;
  private config: ParticipationRewardsConfig;
  private pools: Map<string, RewardPool> = new Map();
  private calculations: Map<string, RewardCalculation> = new Map();
  private distributions: Map<string, RewardDistribution> = new Map();
  private claims: Map<string, RewardClaim> = new Map();
  private analytics: RewardAnalytics;

  constructor(
    governanceService: CakeGovernanceService,
    votingPowerTracker: VotingPowerTracker,
    proposalTracker: ProposalTracker,
    config: ParticipationRewardsConfig
  ) {
    this.governanceService = governanceService;
    this.votingPowerTracker = votingPowerTracker;
    this.proposalTracker = proposalTracker;
    this.config = config;
    this.analytics = this.initializeAnalytics();
    this.initializePools();
  }

  /**
   * Initialize reward pools
   */
  private initializePools(): void {
    for (const poolConfig of this.config.rewardPools) {
      const pool: RewardPool = {
        ...poolConfig,
        status: 'active'
      };
      this.pools.set(pool.id, pool);
    }
  }

  /**
   * Calculate rewards for a participant
   */
  async calculateRewards(participant: string, period: RewardPeriod): Promise<RewardCalculation> {
    const calculationId = `${participant}_${period.id}`;

    // Check if already calculated
    if (this.calculations.has(calculationId)) {
      return this.calculations.get(calculationId)!;
    }

    // Verify eligibility
    const eligibility = await this.verifyEligibility(participant, period);
    if (!eligibility.eligible) {
      throw new Error(`Participant ${participant} is not eligible for rewards: ${eligibility.reason}`);
    }

    // Collect participant metrics
    const metrics = await this.collectParticipantMetrics(participant, period);

    // Calculate reward score
    const score = await this.calculateRewardScore(metrics);

    // Determine reward amount
    const amount = await this.calculateRewardAmount(score, period);

    // Apply multipliers
    const multipliers = await this.applyMultipliers(participant, metrics, score);

    // Create calculation record
    const calculation: RewardCalculation = {
      participant,
      period,
      metrics,
      score,
      amount: this.applyMultipliersToAmount(amount, multipliers),
      breakdown: await this.createRewardBreakdown(score, amount, multipliers),
      multipliers,
      verification: await this.verifyCalculation(calculationId, calculation)
    };

    this.calculations.set(calculationId, calculation);
    return calculation;
  }

  /**
   * Calculate rewards for all eligible participants in a period
   */
  async calculatePeriodRewards(period: RewardPeriod): Promise<RewardDistribution> {
    const distributionId = `distribution_${period.id}`;

    // Get all eligible participants
    const eligibleParticipants = await this.getEligibleParticipants(period);

    // Calculate rewards for each participant
    const recipients: RewardRecipient[] = [];
    let totalAmount = '0';

    for (const participant of eligibleParticipants) {
      try {
        const calculation = await this.calculateRewards(participant, period);
        const recipient: RewardRecipient = {
          address: participant,
          calculation,
          status: {
            eligible: true,
            verified: calculation.verification.status === 'verified',
            calculated: true,
            notified: false,
            blocked: false
          },
          claim: {
            claimable: calculation.verification.status === 'verified',
            claimed: false,
            amount: calculation.amount,
            method: 'automatic'
          },
          history: []
        };

        recipients.push(recipient);
        totalAmount = this.addAmounts(totalAmount, calculation.amount);

      } catch (error) {
        console.error(`Failed to calculate rewards for ${participant}:`, error);
      }
    }

    // Create distribution record
    const distribution: RewardDistribution = {
      id: distributionId,
      period,
      pool: this.pools.get('default')!, // Get appropriate pool
      recipients,
      summary: await this.calculateDistributionSummary(recipients, totalAmount),
      status: {
        status: 'ready',
        progress: 100,
        errors: [],
        startedAt: new Date(),
        completedAt: new Date()
      },
      transactions: []
    };

    this.distributions.set(distributionId, distribution);
    return distribution;
  }

  /**
   * Distribute rewards to participants
   */
  async distributeRewards(distributionId: string, signer: ethers.Wallet): Promise<DistributionTransaction[]> {
    const distribution = this.distributions.get(distributionId);
    if (!distribution) {
      throw new Error(`Distribution ${distributionId} not found`);
    }

    const transactions: DistributionTransaction[] = [];

    for (const recipient of distribution.recipients) {
      if (!recipient.status.eligible || recipient.status.blocked || !recipient.claim.claimable) {
        continue;
      }

      try {
        // Create and send transaction
        const tx = await this.sendRewardTransaction(recipient.address, recipient.claim.amount, signer);

        const transaction: DistributionTransaction = {
          id: `tx_${recipient.address}_${Date.now()}`,
          hash: tx.hash,
          from: signer.address,
          to: recipient.address,
          amount: recipient.claim.amount,
          gasUsed: '0', // Will be updated after confirmation
          gasPrice: '0',
          status: 'pending',
          timestamp: new Date()
        };

        transactions.push(transaction);

        // Update recipient status
        recipient.claim.claimed = true;
        recipient.claim.claimedAt = new Date();
        recipient.claim.transactionHash = tx.hash;

        // Wait for confirmation
        const receipt = await tx.wait();
        transaction.gasUsed = receipt.gasUsed.toString();
        transaction.gasPrice = receipt.gasPrice?.toString() || '0';
        transaction.status = 'confirmed';
        transaction.blockNumber = receipt.blockNumber;

      } catch (error) {
        console.error(`Failed to distribute rewards to ${recipient.address}:`, error);

        distribution.status.errors.push({
          error: error instanceof Error ? error.message : 'Unknown error',
          recipient: recipient.address,
          amount: recipient.claim.amount,
          severity: 'high',
          resolved: false
        });
      }
    }

    distribution.transactions = transactions;
    distribution.status.status = transactions.every(tx => tx.status === 'confirmed') ? 'completed' : 'failed';
    distribution.status.completedAt = new Date();

    return transactions;
  }

  /**
   * Claim rewards for a participant
   */
  async claimRewards(
    participant: string,
    distributionId: string,
    signer: ethers.Wallet
  ): Promise<RewardClaim> {
    const distribution = this.distributions.get(distributionId);
    if (!distribution) {
      throw new Error(`Distribution ${distributionId} not found`);
    }

    const recipient = distribution.recipients.find(r => r.address === participant);
    if (!recipient) {
      throw new Error(`Participant ${participant} not found in distribution ${distributionId}`);
    }

    if (!recipient.claim.claimable || recipient.claim.claimed) {
      throw new Error(`Rewards not claimable for participant ${participant}`);
    }

    const claimId = `claim_${participant}_${distributionId}_${Date.now()}`;

    try {
      // Send reward transaction
      const tx = await this.sendRewardTransaction(participant, recipient.claim.amount, signer);

      const claim: RewardClaim = {
        id: claimId,
        recipient: participant,
        distribution: distributionId,
        amount: recipient.claim.amount,
        status: 'pending',
        method: {
          type: 'direct',
          parameters: {}
        },
        transaction: {
          hash: tx.hash,
          from: signer.address,
          to: participant,
          amount: recipient.claim.amount,
          status: 'pending',
          timestamp: new Date()
        },
        timestamp: new Date()
      };

      this.claims.set(claimId, claim);

      // Update recipient status
      recipient.claim.claimed = true;
      recipient.claim.claimedAt = new Date();
      recipient.claim.transactionHash = tx.hash;

      // Wait for confirmation
      const receipt = await tx.wait();
      claim.status = 'confirmed';
      claim.transaction.status = 'confirmed';
      claim.transaction.gasUsed = receipt.gasUsed.toString();
      claim.transaction.gasPrice = receipt.gasPrice?.toString() || '0';
      claim.transaction.blockNumber = receipt.blockNumber;

      return claim;

    } catch (error) {
      console.error(`Failed to claim rewards for ${participant}:`, error);
      throw error;
    }
  }

  /**
   * Get reward analytics
   */
  async getAnalytics(period?: { start: Date; end: Date }): Promise<RewardAnalytics> {
    await this.updateAnalytics();
    return this.analytics;
  }

  /**
   * Get reward calculation for a participant
   */
  async getCalculation(participant: string, periodId: string): Promise<RewardCalculation | null> {
    const calculationId = `${participant}_${periodId}`;
    return this.calculations.get(calculationId) || null;
  }

  /**
   * Get reward status for a participant
   */
  async getRewardStatus(participant: string): Promise<RewardStatus> {
    const calculations = Array.from(this.calculations.values())
      .filter(calc => calc.participant === participant)
      .sort((a, b) => new Date(b.period.end).getTime() - new Date(a.period.end).getTime());

    const claims = Array.from(this.claims.values())
      .filter(claim => claim.recipient === participant)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return {
      participant,
      calculations: calculations.slice(0, 10),
      claims: claims.slice(0, 10),
      totalEarned: this.calculateTotalEarned(calculations),
      totalClaimed: this.calculateTotalClaimed(claims),
      pendingRewards: this.calculatePendingRewards(calculations, claims),
      eligibility: await this.checkCurrentEligibility(participant)
    };
  }

  // Private helper methods

  private initializeAnalytics(): RewardAnalytics {
    return {
      overview: {
        totalDistributed: '0',
        totalRecipients: 0,
        activePools: this.pools.size,
        averageReward: '0',
        distributionRate: 0,
        claimRate: 0
      },
      trends: {
        distribution: [],
        participation: [],
        claim: [],
        pool: []
      },
      participation: {
        demographics: {
          experience: {},
          holdingSize: {},
          geography: {},
          tenure: {},
          activity: {}
        },
        behavior: {
          votingPatterns: [],
          participationPatterns: [],
          claimPatterns: [],
          interactionPatterns: []
        },
        retention: {
          overall: { rate: 0, lifetime: 0, return: 0, dropoff: 0 },
          cohorts: [],
          churn: { rate: 0, reasons: [], prediction: [], prevention: [] },
          reactivation: { rate: 0, methods: [], success: 0, cost: '0' }
        },
        engagement: {
          overall: { score: 0, trend: 'stable', components: [], benchmarks: [] },
          channels: [],
          content: [],
          quality: {
            constructiveness: 0,
            relevance: 0,
            accuracy: 0,
            timeliness: 0,
            innovation: 0
          }
        }
      },
      performance: {
        pools: [],
        calculations: {
          accuracy: 0,
          speed: 0,
          reliability: 0,
          fairness: 0,
          transparency: 0
        },
        distributions: {
          timeliness: 0,
          success: 0,
          cost: '0',
          scale: 0,
          automation: 0
        },
        claims: {
          speed: 0,
          success: 0,
          cost: '0',
          userExperience: 0,
          automation: 0
        }
      },
      economic: {
        costs: {
          total: '0',
          distribution: [],
          trends: [],
          optimization: []
        },
        benefits: {
          total: '0',
          distribution: [],
          roi: 0,
          value: []
        },
        efficiency: {
          ratio: 0,
          trends: [],
          benchmarks: [],
          improvements: []
        },
        sustainability: {
          score: 0,
          factors: [],
          risks: [],
          strategies: []
        }
      },
      predictions: {
        participation: [],
        distribution: [],
        claims: [],
        economic: []
      }
    };
  }

  private async verifyEligibility(participant: string, period: RewardPeriod): Promise<{ eligible: boolean; reason?: string }> {
    // Check minimum requirements
    const votingPower = await this.votingPowerTracker.getCurrentVotingPower(participant);
    const minPower = this.config.eligibility.minimums.votingPower;

    if (Number(ethers.parseUnits(votingPower, 18)) < Number(ethers.parseUnits(minPower, 18))) {
      return { eligible: false, reason: `Insufficient voting power: ${votingPower} < ${minPower}` };
    }

    // Check participation rate
    const participationRate = await this.calculateParticipationRate(participant, period);
    const minParticipation = this.config.eligibility.minimums.participationRate;

    if (participationRate < minParticipation) {
      return { eligible: false, reason: `Insufficient participation rate: ${participationRate} < ${minParticipation}` };
    }

    // Check blacklist
    if (this.config.eligibility.blacklist.enabled && await this.isBlacklisted(participant)) {
      return { eligible: false, reason: 'Participant is blacklisted' };
    }

    // Check verification
    if (this.config.eligibility.verification.required) {
      const verification = await this.verifyIdentity(participant);
      if (!verification.verified) {
        return { eligible: false, reason: 'Identity verification required' };
      }
    }

    return { eligible: true };
  }

  private async collectParticipantMetrics(participant: string, period: RewardPeriod): Promise<ParticipantMetrics> {
    return {
      voting: await this.collectVotingMetrics(participant, period),
      participation: await this.collectParticipationMetrics(participant, period),
      contribution: await this.collectContributionMetrics(participant, period),
      engagement: await this.collectEngagementMetrics(participant, period),
      quality: await this.collectQualityMetrics(participant, period)
    };
  }

  private async collectVotingMetrics(participant: string, period: RewardPeriod): Promise<VotingMetrics> {
    // Implementation would collect voting metrics
    return {
      votesCast: 5,
      votingPower: await this.votingPowerTracker.getCurrentVotingPower(participant),
      participationRate: 0.75,
      consistency: 0.8,
      alignment: 0.7,
      timeliness: 0.9
    };
  }

  private async collectParticipationMetrics(participant: string, period: RewardPeriod): Promise<ParticipationMetrics> {
    // Implementation would collect participation metrics
    return {
      proposalsReviewed: 8,
      discussionsParticipated: 12,
      commentsPosted: 15,
      delegationsReceived: 3,
      communityEvents: 2
    };
  }

  private async collectContributionMetrics(participant: string, period: RewardPeriod): Promise<ContributionMetrics> {
    // Implementation would collect contribution metrics
    return {
      proposalsSubmitted: 1,
      improvementsSuggested: 3,
      bugsReported: 2,
      documentationCreated: 1,
      mentorshipProvided: 2
    };
  }

  private async collectEngagementMetrics(participant: string, period: RewardPeriod): Promise<EngagementMetrics> {
    // Implementation would collect engagement metrics
    return {
      loginFrequency: 15,
      sessionDuration: 1800, // seconds
      interactionDepth: 0.7,
      networkGrowth: 5,
      influenceScore: 0.6
    };
  }

  private async collectQualityMetrics(participant: string, period: RewardPeriod): Promise<QualityMetrics> {
    // Implementation would collect quality metrics
    return {
      reasoningQuality: 0.8,
      researchDepth: 0.7,
      constructiveness: 0.9,
      innovation: 0.6,
      accuracy: 0.85
    };
  }

  private async calculateRewardScore(metrics: ParticipantMetrics): Promise<RewardScore> {
    const votingScore = this.calculateVotingScore(metrics.voting);
    const participationScore = this.calculateParticipationScore(metrics.participation);
    const contributionScore = this.calculateContributionScore(metrics.contribution);
    const engagementScore = this.calculateEngagementScore(metrics.engagement);
    const qualityScore = this.calculateQualityScore(metrics.quality);

    const total = votingScore + participationScore + contributionScore + engagementScore + qualityScore;

    return {
      total,
      breakdown: {
        voting: votingScore,
        participation: participationScore,
        contribution: contributionScore,
        engagement: engagementScore,
        quality: qualityScore,
        bonus: 0
      },
      rank: 0, // Would be calculated after all participants
      percentile: 0, // Would be calculated after all participants
      trend: {
        current: total,
        previous: 0, // Would need historical data
        change: 0,
        direction: 'stable',
        momentum: 0
      }
    };
  }

  private calculateVotingScore(metrics: VotingMetrics): number {
    return (
      metrics.votesCast * 10 +
      metrics.participationRate * 20 +
      metrics.consistency * 15 +
      metrics.alignment * 10 +
      metrics.timeliness * 5
    );
  }

  private calculateParticipationScore(metrics: ParticipationMetrics): number {
    return (
      metrics.proposalsReviewed * 3 +
      metrics.discussionsParticipated * 2 +
      metrics.commentsPosted * 1 +
      metrics.delegationsReceived * 5 +
      metrics.communityEvents * 4
    );
  }

  private calculateContributionScore(metrics: ContributionMetrics): number {
    return (
      metrics.proposalsSubmitted * 20 +
      metrics.improvementsSuggested * 5 +
      metrics.bugsReported * 3 +
      metrics.documentationCreated * 4 +
      metrics.mentorshipProvided * 6
    );
  }

  private calculateEngagementScore(metrics: EngagementMetrics): number {
    return (
      metrics.loginFrequency * 2 +
      metrics.sessionDuration / 60 + // Convert to minutes
      metrics.interactionDepth * 15 +
      metrics.networkGrowth * 3 +
      metrics.influenceScore * 10
    );
  }

  private calculateQualityScore(metrics: QualityMetrics): number {
    return (
      metrics.reasoningQuality * 20 +
      metrics.researchDepth * 15 +
      metrics.constructiveness * 10 +
      metrics.innovation * 8 +
      metrics.accuracy * 12
    );
  }

  private async calculateRewardAmount(score: RewardScore, period: RewardPeriod): Promise<string> {
    // Base amount calculation
    const baseAmount = score.total * 100; // $100 per point

    // Apply pool-specific calculations
    const pool = this.pools.get('default'); // Get appropriate pool
    if (!pool) return '0';

    const totalPoolAmount = ethers.parseUnits(pool.allocation.amountPerPeriod, 18);
    const maxIndividual = ethers.parseUnits(pool.caps.individual.maxPerPeriod, 18);

    const calculatedAmount = ethers.parseUnits(baseAmount.toString(), 18);
    const finalAmount = calculatedAmount > maxIndividual ? maxIndividual : calculatedAmount;

    return ethers.formatUnits(finalAmount, 18);
  }

  private async applyMultipliers(
    participant: string,
    metrics: ParticipantMetrics,
    score: RewardScore
  ): Promise<AppliedMultiplier[]> {
    const multipliers: AppliedMultiplier[] = [];

    // Early participant bonus
    if (metrics.voting.timeliness > 0.9) {
      multipliers.push({
        id: 'early_voter',
        name: 'Early Voter Bonus',
        criteria: 'Voting timeliness > 90%',
        multiplier: 1.2,
        amount: '0', // Will be calculated
        reason: 'Rewarded for consistent early voting'
      });
    }

    // Quality contributor bonus
    if (score.breakdown.quality > 100) {
      multipliers.push({
        id: 'quality_contributor',
        name: 'Quality Contributor Bonus',
        criteria: 'Quality score > 100',
        multiplier: 1.15,
        amount: '0',
        reason: 'Rewarded for high-quality contributions'
      });
    }

    return multipliers;
  }

  private applyMultipliersToAmount(baseAmount: string, multipliers: AppliedMultiplier[]): string {
    let amount = ethers.parseUnits(baseAmount, 18);

    for (const multiplier of multipliers) {
      amount = (amount * BigInt(Math.floor(multiplier.multiplier * 100))) / BigInt(100);
    }

    return ethers.formatUnits(amount, 18);
  }

  private async createRewardBreakdown(
    score: RewardScore,
    amount: string,
    multipliers: AppliedMultiplier[]
  ): Promise<RewardBreakdown> {
    const baseAmount = ethers.parseUnits(amount, 18);
    let currentAmount = baseAmount;

    return {
      base: {
        type: 'base_reward',
        amount: ethers.formatUnits(baseAmount, 18),
        percentage: 100,
        description: 'Base reward calculated from participation metrics',
        calculation: `Score: ${score.total} * $100`,
        source: 'participation_metrics'
      },
      bonus: {
        type: 'bonus',
        amount: '0',
        percentage: 0,
        description: 'Additional bonuses',
        calculation: '0',
        source: 'bonus_criteria'
      },
      multipliers: multipliers.map(m => ({
        type: 'multiplier',
        amount: ethers.formatUnits(
          (currentAmount * BigInt(Math.floor((m.multiplier - 1) * 100))) / BigInt(100),
          18
        ),
        percentage: (m.multiplier - 1) * 100,
        description: m.reason,
        calculation: `Amount * ${m.multiplier}`,
        source: m.id
      })),
      adjustments: [],
      total: ethers.formatUnits(currentAmount, 18)
    };
  }

  private async verifyCalculation(calculationId: string, calculation: RewardCalculation): Promise<VerificationStatus> {
    // Perform verification checks
    const checks: VerificationCheck[] = [
      {
        check: 'eligibility',
        status: 'pass',
        score: 1.0,
        details: 'Participant meets all eligibility requirements',
        timestamp: new Date()
      },
      {
        check: 'metric_accuracy',
        status: 'pass',
        score: 0.95,
        details: 'All metrics collected and validated',
        timestamp: new Date()
      },
      {
        check: 'calculation_correctness',
        status: 'pass',
        score: 1.0,
        details: 'Reward calculation formulas applied correctly',
        timestamp: new Date()
      },
      {
        check: 'multiplier_application',
        status: 'warning',
        score: 0.9,
        details: 'Some multipliers may need manual review',
        timestamp: new Date()
      }
    ];

    const overallScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;

    return {
      status: overallScore > 0.8 ? 'verified' : 'flagged',
      score: overallScore,
      checks,
      issues: checks.filter(c => c.status === 'warning' || c.status === 'fail').map(c => ({
        issue: c.check,
        severity: c.status === 'fail' ? 'high' : 'medium',
        description: c.details,
        resolved: false
      })),
      reviewed: true
    };
  }

  private async getEligibleParticipants(period: RewardPeriod): Promise<string[]> {
    // Implementation would get all eligible participants for the period
    return ['0x1234...', '0x5678...', '0x9abc...']; // Example addresses
  }

  private async calculateDistributionSummary(
    recipients: RewardRecipient[],
    totalAmount: string
  ): Promise<DistributionSummary> {
    const amounts = recipients.map(r => ethers.parseUnits(r.calculation.amount, 18));
    const total = ethers.parseUnits(totalAmount, 18);

    const sortedAmounts = amounts.sort((a, b) => Number(b - a));
    const median = sortedAmounts[Math.floor(sortedAmounts.length / 2)] || BigInt(0);

    const top1Percent = sortedAmounts.slice(0, Math.ceil(sortedAmounts.length * 0.01));
    const top5Percent = sortedAmounts.slice(0, Math.ceil(sortedAmounts.length * 0.05));
    const top10Percent = sortedAmounts.slice(0, Math.ceil(sortedAmounts.length * 0.10));
    const top25Percent = sortedAmounts.slice(0, Math.ceil(sortedAmounts.length * 0.25));
    const bottom25Percent = sortedAmounts.slice(-Math.ceil(sortedAmounts.length * 0.25));

    return {
      totalAmount,
      totalRecipients: recipients.length,
      averageReward: ethers.formatUnits(total / BigInt(recipients.length), 18),
      medianReward: ethers.formatUnits(median, 18),
      maxReward: ethers.formatUnits(sortedAmounts[0] || BigInt(0), 18),
      minReward: ethers.formatUnits(sortedAmounts[sortedAmounts.length - 1] || BigInt(0), 18),
      distribution: {
        top1Percent: ethers.formatUnits(
          top1Percent.reduce((sum, amount) => sum + amount, BigInt(0)),
          18
        ),
        top5Percent: ethers.formatUnits(
          top5Percent.reduce((sum, amount) => sum + amount, BigInt(0)),
          18
        ),
        top10Percent: ethers.formatUnits(
          top10Percent.reduce((sum, amount) => sum + amount, BigInt(0)),
          18
        ),
        top25Percent: ethers.formatUnits(
          top25Percent.reduce((sum, amount) => sum + amount, BigInt(0)),
          18
        ),
        bottom25Percent: ethers.formatUnits(
          bottom25Percent.reduce((sum, amount) => sum + amount, BigInt(0)),
          18
        ),
        giniCoefficient: this.calculateGiniCoefficient(amounts)
      }
    };
  }

  private calculateGiniCoefficient(amounts: bigint[]): number {
    if (amounts.length === 0) return 0;

    const sortedAmounts = amounts.slice().sort((a, b) => Number(a - b));
    const n = sortedAmounts.length;
    const total = sortedAmounts.reduce((sum, amount) => sum + amount, BigInt(0));

    if (total === BigInt(0)) return 0;

    let giniSum = BigInt(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        giniSum += (sortedAmounts[i] - sortedAmounts[j]) >= 0 ?
          (sortedAmounts[i] - sortedAmounts[j]) :
          (sortedAmounts[j] - sortedAmounts[i]);
      }
    }

    return Number(giniSum) / (2 * n * Number(total));
  }

  private async sendRewardTransaction(
    to: string,
    amount: string,
    signer: ethers.Wallet
  ): Promise<ethers.ContractTransactionResponse> {
    // Implementation would send reward token transaction
    // This is a placeholder - actual implementation would depend on token contract
    throw new Error('Transaction sending not implemented in this demo');
  }

  private addAmounts(amount1: string, amount2: string): string {
    const a1 = ethers.parseUnits(amount1, 18);
    const a2 = ethers.parseUnits(amount2, 18);
    return ethers.formatUnits(a1 + a2, 18);
  }

  private async calculateParticipationRate(participant: string, period: RewardPeriod): Promise<number> {
    // Implementation would calculate actual participation rate
    return 0.75;
  }

  private async isBlacklisted(participant: string): Promise<boolean> {
    // Implementation would check blacklist
    return false;
  }

  private async verifyIdentity(participant: string): Promise<{ verified: boolean }> {
    // Implementation would verify identity
    return { verified: true };
  }

  private async updateAnalytics(): Promise<void> {
    // Implementation would update analytics with latest data
  }

  private async calculateTotalEarned(calculations: RewardCalculation[]): Promise<string> {
    const total = calculations.reduce((sum, calc) => {
      return sum + ethers.parseUnits(calc.amount, 18);
    }, BigInt(0));
    return ethers.formatUnits(total, 18);
  }

  private async calculateTotalClaimed(claims: RewardClaim[]): Promise<string> {
    const total = claims
      .filter(claim => claim.status === 'confirmed')
      .reduce((sum, claim) => {
        return sum + ethers.parseUnits(claim.amount, 18);
      }, BigInt(0));
    return ethers.formatUnits(total, 18);
  }

  private async calculatePendingRewards(calculations: RewardCalculation[], claims: RewardClaim[]): Promise<string> {
    const claimedAmounts = new Set(
      claims.filter(claim => claim.status === 'confirmed')
        .map(claim => claim.recipient)
    );

    const total = calculations
      .filter(calc => !claimedAmounts.has(calc.participant))
      .reduce((sum, calc) => {
        return sum + ethers.parseUnits(calc.amount, 18);
      }, BigInt(0));

    return ethers.formatUnits(total, 18);
  }

  private async checkCurrentEligibility(participant: string): Promise<boolean> {
    // Implementation would check current eligibility status
    return true;
  }
}

export interface RewardStatus {
  participant: string;
  calculations: RewardCalculation[];
  claims: RewardClaim[];
  totalEarned: string;
  totalClaimed: string;
  pendingRewards: string;
  eligibility: boolean;
}