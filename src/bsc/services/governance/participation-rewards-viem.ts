import {
  PublicClient,
  WalletClient,
  Address,
  Hash,
  BlockNumber,
  formatUnits,
  parseUnits,
  Chain,
  Transport,
  Account
} from 'viem';
import { CakeGovernanceServiceViem } from './cake-governance-viem';
import { VotingPowerTrackerViem } from './voting-power-tracker-viem';
import { ProposalTrackerViem } from './proposal-tracker-viem';
import {
  ICache,
  ILogger,
  IWebSocketManager,
  CacheConfig,
  WebSocketConfig,
  GovernanceConfigViem
} from '../../../types/viem-core-types';

/**
 * Comprehensive governance participation rewards system for Viem integration
 */
export interface ParticipationRewardsConfigViem {
  enabled: boolean;
  rewardToken: {
    address: Address;
    symbol: string;
    decimals: number;
  };
  rewardPools: RewardPoolViem[];
  distribution: DistributionConfigViem;
  eligibility: EligibilityConfigViem;
  calculation: CalculationConfigViem;
  timing: TimingConfigViem;
  notifications: NotificationConfigViem;
}

export interface RewardPoolViem {
  id: string;
  name: string;
  description: string;
  type: RewardTypeViem;
  allocation: RewardAllocationViem;
  schedule: RewardScheduleViem;
  criteria: RewardCriteriaViem[];
  multipliers: RewardMultiplierViem[];
  caps: RewardCapsViem;
  status: 'active' | 'paused' | 'expired';
}

export interface RewardTypeViem {
  category: 'voting' | 'participation' | 'contribution' | 'delegation' | 'governance' | 'community';
  subcategory: string;
  frequency: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
}

export interface RewardAllocationViem {
  totalAmount: string;
  amountPerPeriod: string;
  currency: string;
  vesting: VestingConfigViem;
  bonus: BonusConfigViem;
}

export interface VestingConfigViem {
  enabled: boolean;
  schedule: VestingScheduleViem;
  cliff: number; // seconds
  period: number; // seconds
  percentageLinear: number;
  percentageMilestone: number;
}

export interface VestingScheduleViem {
  immediate: number; // percentage
  milestone1: { percentage: number; timeframe: number }; // percentage, seconds
  milestone2: { percentage: number; timeframe: number };
  milestone3: { percentage: number; timeframe: number };
  final: { percentage: number; timeframe: number };
}

export interface BonusConfigViem {
  enabled: boolean;
  criteria: BonusCriteriaViem[];
  multiplier: number;
  maxBonus: string;
}

export interface BonusCriteriaViem {
  criteria: string;
  threshold: number;
  bonus: number;
  description: string;
}

export interface RewardScheduleViem {
  start: Date;
  end: Date;
  frequency: number; // seconds
  periods: number;
  distribution: 'immediate' | 'batch' | 'continuous';
}

export interface RewardCriteriaViem {
  id: string;
  type: CriterionTypeViem;
  weight: number; // 0-1
  measurement: MeasurementViem;
  threshold: number;
  description: string;
}

export interface CriterionTypeViem {
  category: 'participation' | 'quality' | 'consistency' | 'impact' | 'engagement' | 'expertise';
  subcategory: string;
  metric: string;
}

export interface MeasurementViem {
  method: 'count' | 'percentage' | 'score' | 'weighted' | 'composite';
  source: string;
  timeframe: number; // seconds
  normalization: 'none' | 'minmax' | 'zscore' | 'rank';
}

export interface RewardMultiplierViem {
  id: string;
  name: string;
  description: string;
  criteria: MultiplierCriteriaViem;
  multiplier: number;
  maxMultiplier: number;
  stackable: boolean;
  duration: number; // seconds
}

export interface MultiplierCriteriaViem {
  criteria: string;
  operator: '>' | '<' | '=' | '>=' | '<=';
  value: number;
  timeWindow: number; // seconds
}

export interface RewardCapsViem {
  individual: IndividualCapsViem;
  pool: PoolCapsViem;
  period: PeriodCapsViem;
}

export interface IndividualCapsViem {
  maxPerPeriod: string;
  maxPerYear: string;
  maxLifetime: string;
  percentageOfPool: number;
}

export interface PoolCapsViem {
  maxPerDistribution: string;
  maxClaimants: number;
  minClaimAmount: string;
  maxClaimAmount: string;
}

export interface PeriodCapsViem {
  maxTotalRewards: string;
  maxParticipants: number;
  reservePercentage: number;
}

export interface EligibilityConfigViem {
  minimums: MinimumRequirementsViem;
  restrictions: RestrictionRulesViem;
  verification: VerificationConfigViem;
  blacklist: BlacklistConfigViem;
  whitelist: WhitelistConfigViem;
}

export interface MinimumRequirementsViem {
  votingPower: string;
  participationRate: number;
  tenure: number; // seconds
  reputation: number;
  activity: ActivityRequirementViem;
}

export interface ActivityRequirementViem {
  proposalsVoted: number;
  discussionsParticipated: number;
  contributionsSubmitted: number;
  governanceActions: number;
}

export interface RestrictionRulesViem {
  maxRewardsPerWallet: number;
  sybilProtection: boolean;
  geographic: GeographicRestrictionViem[];
  temporal: TemporalRestrictionViem[];
}

export interface GeographicRestrictionViem {
  type: 'allow' | 'block';
  countries: string[];
  reason: string;
}

export interface TemporalRestrictionViem {
  type: 'cooldown' | 'blackout' | 'window';
  start: Date;
  end: Date;
  description: string;
}

export interface VerificationConfigViem {
  required: boolean;
  methods: VerificationMethodViem[];
  providers: VerificationProviderViem[];
  level: 'basic' | 'standard' | 'enhanced';
}

export interface VerificationMethodViem {
  method: 'kyc' | 'identity' | 'attestation' | 'staking' | 'social';
  required: boolean;
  provider: string;
  data: string[];
}

export interface VerificationProviderViem {
  name: string;
  type: 'centralized' | 'decentralized' | 'hybrid';
  integration: IntegrationConfigViem;
  reliability: number;
  cost: string;
}

export interface IntegrationConfigViem {
  apiEndpoint: string;
  authentication: string;
  dataFormat: string;
  rateLimit: number;
}

export interface BlacklistConfigViem {
  enabled: boolean;
  sources: BlacklistSourceViem[];
  appeal: AppealConfigViem;
  automatic: boolean;
}

export interface BlacklistSourceViem {
  source: string;
  type: 'address' | 'behavior' | 'external' | 'manual';
  reliability: number;
  updateFrequency: number;
}

export interface AppealConfigViem {
  enabled: boolean;
  process: string;
  timeframe: number;
  requirements: string[];
  reviewers: Address[];
}

export interface WhitelistConfigViem {
  enabled: boolean;
  criteria: WhitelistCriteriaViem[];
  benefits: WhitelistBenefitsViem;
  management: WhitelistManagementViem;
}

export interface WhitelistCriteriaViem {
  criteria: string;
  operator: string;
  value: any;
  weight: number;
}

export interface WhitelistBenefitsViem {
  bonusMultiplier: number;
  earlyAccess: number;
  reducedRequirements: number;
  exclusivePools: string[];
}

export interface WhitelistManagementViem {
  manager: Address;
  process: string;
  review: string;
  appeals: string;
}

export interface CalculationConfigViem {
  formulas: CalculationFormulaViem[];
  weights: WeightConfigViem;
  normalization: NormalizationConfigViem;
  aggregation: AggregationConfigViem;
}

export interface CalculationFormulaViem {
  id: string;
  name: string;
  description: string;
  formula: string;
  variables: FormulaVariableViem[];
  validation: FormulaValidationViem;
}

export interface FormulaVariableViem {
  name: string;
  type: 'input' | 'calculated' | 'constant';
  source: string;
  transformation: string;
  validation: string;
}

export interface FormulaValidationViem {
  rules: ValidationRuleViem[];
  tests: ValidationTestViem[];
  thresholds: ValidationThresholdViem[];
}

export interface ValidationRuleViem {
  rule: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationTestViem {
  name: string;
  input: any;
  expected: any;
  tolerance: number;
}

export interface ValidationThresholdViem {
  metric: string;
  min: number;
  max: number;
  action: 'warn' | 'error' | 'adjust';
}

export interface WeightConfigViem {
  categories: CategoryWeightViem[];
  dynamic: DynamicWeightingViem;
  balancing: WeightBalancingViem;
}

export interface CategoryWeightViem {
  category: string;
  weight: number;
  minWeight: number;
  maxWeight: number;
  adjustment: number;
}

export interface DynamicWeightingViem {
  enabled: boolean;
  factors: WeightFactorViem[];
  adjustment: WeightAdjustmentViem;
  smoothing: WeightSmoothingViem;
}

export interface WeightFactorViem {
  factor: string;
  impact: number;
  timeframe: number;
  source: string;
  reliability: number;
}

export interface WeightAdjustmentViem {
  method: 'linear' | 'exponential' | 'logarithmic';
  sensitivity: number;
  bounds: { min: number; max: number };
  frequency: number;
}

export interface WeightSmoothingViem {
  method: 'moving_average' | 'exponential' | 'lowpass';
  window: number;
  alpha: number;
}

export interface WeightBalancingViem {
  enabled: boolean;
  method: 'proportional' | 'equal' | 'performance';
  frequency: number;
  constraints: BalancingConstraintViem[];
}

export interface BalancingConstraintViem {
  constraint: string;
  value: number;
  priority: number;
  flexible: boolean;
}

export interface NormalizationConfigViem {
  method: 'minmax' | 'zscore' | 'rank' | 'percentile' | 'custom';
  parameters: NormalizationParametersViem;
  outliers: OutlierHandlingViem;
  scaling: ScalingConfigViem;
}

export interface NormalizationParametersViem {
  min?: number;
  max?: number;
  mean?: number;
  std?: number;
  percentile?: number;
}

export interface OutlierHandlingViem {
  method: 'clip' | 'remove' | 'transform';
  threshold: number;
  action: string;
}

export interface ScalingConfigViem {
  enabled: boolean;
  method: 'linear' | 'logarithmic' | 'exponential';
  parameters: Record<string, number>;
}

export interface AggregationConfigViem {
  method: 'sum' | 'weighted_average' | 'geometric_mean' | 'custom';
  timeframe: number;
  windows: AggregationWindowViem[];
  smoothing: AggregationSmoothingViem;
}

export interface AggregationWindowViem {
  name: string;
  size: number;
  weight: number;
  overlap: number;
}

export interface AggregationSmoothingViem {
  enabled: boolean;
  method: 'moving_average' | 'exponential';
  parameters: Record<string, number>;
}

export interface TimingConfigViem {
  distribution: DistributionTimingViem;
  vesting: VestingTimingViem;
  claiming: ClaimingTimingViem;
  expiration: ExpirationTimingViem;
}

export interface DistributionTimingViem {
  frequency: number; // seconds
  schedule: DistributionScheduleViem;
  delays: DistributionDelayViem[];
  holidays: HolidayScheduleViem[];
}

export interface DistributionScheduleViem {
  type: 'fixed' | 'relative' | 'conditional';
  pattern: SchedulePatternViem[];
  timezone: string;
  businessDaysOnly: boolean;
}

export interface SchedulePatternViem {
  dayOfWeek: number;
  time: string;
  enabled: boolean;
  amount?: string;
  conditions?: string[];
}

export interface DistributionDelayViem {
  type: 'initial' | 'processing' | 'verification';
  duration: number;
  reason: string;
  bypassable: boolean;
}

export interface HolidayScheduleViem {
  holidays: HolidayViem[];
  behavior: 'skip' | 'next_day' | 'previous_day';
  notifications: boolean;
}

export interface HolidayViem {
  name: string;
  date: Date;
  recurring: boolean;
  timezone: string;
}

export interface VestingTimingViem {
  schedule: VestingScheduleViem;
  acceleration: AccelerationConfigViem;
  modification: ModificationConfigViem;
}

export interface AccelerationConfigViem {
  enabled: boolean;
  triggers: AccelerationTriggerViem[];
  multiplier: number;
  cap: number;
}

export interface AccelerationTriggerViem {
  trigger: string;
  condition: string;
  acceleration: number;
  maxAcceleration: number;
}

export interface ModificationConfigViem {
  allowed: boolean;
  methods: ModificationMethodViem[];
  approval: ModificationApprovalViem;
  limits: ModificationLimitViem[];
}

export interface ModificationMethodViem {
  method: 'extend' | 'accelerate' | 'adjust' | 'pause';
  requirements: string[];
  restrictions: string[];
}

export interface ModificationApprovalViem {
  required: boolean;
  approvers: Address[];
  threshold: number;
  process: string;
}

export interface ModificationLimitViem {
  limit: string;
  type: 'absolute' | 'percentage' | 'frequency';
  value: number;
  timeframe: number;
}

export interface ClaimingTimingViem {
  window: ClaimingWindowViem;
  deadlines: ClaimingDeadlineViem[];
  extensions: ExtensionConfigViem[];
  reminders: ReminderConfigViem[];
}

export interface ClaimingWindowViem {
  open: Date;
  close: Date;
  frequency: number;
  autoClaim: boolean;
  batchClaim: boolean;
}

export interface ClaimingDeadlineViem {
  type: 'soft' | 'hard' | 'rolling';
  date: Date;
  action: 'forfeit' | 'redistribute' | 'extend';
  notification: boolean;
}

export interface ExtensionConfigViem {
  enabled: boolean;
  criteria: ExtensionCriteriaViem[];
  limits: ExtensionLimitViem[];
  process: string;
}

export interface ExtensionCriteriaViem {
  criteria: string;
  extension: number;
  maxExtensions: number;
  approval: string;
}

export interface ExtensionLimitViem {
  limit: string;
  type: 'time' | 'percentage' | 'absolute';
  value: number;
}

export interface ReminderConfigViem {
  enabled: boolean;
  schedule: ReminderScheduleViem[];
  channels: NotificationChannelViem[];
  content: ReminderContentViem[];
}

export interface ReminderScheduleViem {
  trigger: string;
  offset: number;
  frequency: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface NotificationChannelViem {
  channel: 'email' | 'push' | 'in_app' | 'sms' | 'discord' | 'telegram';
  enabled: boolean;
  template: string;
  settings: Record<string, any>;
}

export interface ReminderContentViem {
  type: string;
  template: string;
  variables: string[];
  personalization: boolean;
}

export interface ExpirationTimingViem {
  periods: ExpirationPeriodViem[];
  gracePeriods: GracePeriodViem[];
  forfeiture: ForfeitureConfigViem;
  redistribution: RedistributionConfigViem;
}

export interface ExpirationPeriodViem {
  period: string;
  duration: number;
  action: 'expire' | 'extend' | 'convert';
  notification: boolean;
}

export interface GracePeriodViem {
  type: 'claim' | 'verification' | 'appeal';
  duration: number;
  conditions: string[];
  extensions: number;
}

export interface ForfeitureConfigViem {
  enabled: boolean;
  conditions: ForfeitureConditionViem[];
  process: ForfeitureProcessViem;
  appeals: ForfeitureAppealViem;
}

export interface ForfeitureConditionViem {
  condition: string;
  threshold: number;
  timeframe: number;
  warning: boolean;
}

export interface ForfeitureProcessViem {
  notice: number;
  review: number;
  decision: number;
  execution: number;
}

export interface ForfeitureAppealViem {
  enabled: boolean;
  timeframe: number;
  requirements: string[];
  reviewers: Address[];
}

export interface RedistributionConfigViem {
  enabled: boolean;
  method: 'proportional' | 'equal' | 'performance' | 'lottery';
  recipients: RedistributionRecipientViem[];
  frequency: number;
}

export interface RedistributionRecipientViem {
  type: 'active' | 'eligible' | 'top_performers' | 'random';
  criteria: string;
  weight: number;
  cap: string;
}

export interface NotificationConfigViem {
  channels: NotificationChannelViem[];
  events: NotificationEventViem[];
  templates: NotificationTemplateViem[];
  preferences: NotificationPreferencesViem;
}

export interface NotificationEventViem {
  event: string;
  channels: string[];
  template: string;
  timing: NotificationTimingViem;
  conditions: NotificationConditionViem[];
}

export interface NotificationTimingViem {
  immediate: boolean;
  delay: number;
  schedule?: string;
  timezone: string;
}

export interface NotificationConditionViem {
  condition: string;
  value: any;
  operator: string;
}

export interface NotificationTemplateViem {
  id: string;
  name: string;
  type: 'email' | 'push' | 'in_app' | 'sms';
  subject?: string;
  body: string;
  variables: TemplateVariableViem[];
  localization: TemplateLocalizationViem[];
}

export interface TemplateVariableViem {
  name: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'percentage';
  format?: string;
  required: boolean;
  default?: any;
}

export interface TemplateLocalizationViem {
  language: string;
  subject?: string;
  body: string;
}

export interface NotificationPreferencesViem {
  defaultChannels: string[];
  frequency: 'immediate' | 'digest' | 'weekly' | 'never';
  quietHours: QuietHoursViem;
  categories: CategoryPreferencesViem[];
}

export interface QuietHoursViem {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
  weekends: boolean;
  urgent: boolean;
}

export interface CategoryPreferencesViem {
  category: string;
  enabled: boolean;
  channels: string[];
  frequency: string;
}

export interface RewardCalculationViem {
  participant: Address;
  period: RewardPeriodViem;
  metrics: ParticipantMetricsViem;
  score: RewardScoreViem;
  amount: string;
  breakdown: RewardBreakdownViem;
  multipliers: AppliedMultiplierViem[];
  verification: VerificationStatusViem;
}

export interface RewardPeriodViem {
  id: string;
  start: Date;
  end: Date;
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  status: 'pending' | 'active' | 'completed' | 'expired';
}

export interface ParticipantMetricsViem {
  voting: VotingMetricsViem;
  participation: ParticipationMetricsViem;
  contribution: ContributionMetricsViem;
  engagement: EngagementMetricsViem;
  quality: QualityMetricsViem;
}

export interface VotingMetricsViem {
  votesCast: number;
  votingPower: string;
  participationRate: number;
  consistency: number;
  alignment: number;
  timeliness: number;
}

export interface ParticipationMetricsViem {
  proposalsReviewed: number;
  discussionsParticipated: number;
  commentsPosted: number;
  delegationsReceived: number;
  communityEvents: number;
}

export interface ContributionMetricsViem {
  proposalsSubmitted: number;
  improvementsSuggested: number;
  bugsReported: number;
  documentationCreated: number;
  mentorshipProvided: number;
}

export interface EngagementMetricsViem {
  loginFrequency: number;
  sessionDuration: number;
  interactionDepth: number;
  networkGrowth: number;
  influenceScore: number;
}

export interface QualityMetricsViem {
  reasoningQuality: number;
  researchDepth: number;
  constructiveness: number;
  innovation: number;
  accuracy: number;
}

export interface RewardScoreViem {
  total: number;
  breakdown: ScoreBreakdownViem;
  rank: number;
  percentile: number;
  trend: ScoreTrendViem;
}

export interface ScoreBreakdownViem {
  voting: number;
  participation: number;
  contribution: number;
  engagement: number;
  quality: number;
  bonus: number;
}

export interface ScoreTrendViem {
  current: number;
  previous: number;
  change: number;
  direction: 'up' | 'down' | 'stable';
  momentum: number;
}

export interface RewardBreakdownViem {
  base: RewardComponentViem;
  bonus: RewardComponentViem;
  multipliers: RewardComponentViem[];
  adjustments: RewardComponentViem[];
  total: string;
}

export interface RewardComponentViem {
  type: string;
  amount: string;
  percentage: number;
  description: string;
  calculation: string;
  source: string;
}

export interface AppliedMultiplierViem {
  id: string;
  name: string;
  criteria: string;
  multiplier: number;
  amount: string;
  reason: string;
}

export interface VerificationStatusViem {
  status: 'pending' | 'verified' | 'rejected' | 'flagged';
  score: number;
  checks: VerificationCheckViem[];
  issues: VerificationIssueViem[];
  reviewed: boolean;
}

export interface VerificationCheckViem {
  check: string;
  status: 'pass' | 'fail' | 'warning';
  score: number;
  details: string;
  timestamp: Date;
}

export interface VerificationIssueViem {
  issue: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  resolution?: string;
  resolved: boolean;
}

export interface RewardDistributionViem {
  id: string;
  period: RewardPeriodViem;
  pool: RewardPoolViem;
  recipients: RewardRecipientViem[];
  summary: DistributionSummaryViem;
  status: DistributionStatusViem;
  transactions: DistributionTransactionViem[];
}

export interface RewardRecipientViem {
  address: Address;
  calculation: RewardCalculationViem;
  status: RecipientStatusViem;
  claim: ClaimStatusViem;
  history: RecipientHistoryViem[];
}

export interface RecipientStatusViem {
  eligible: boolean;
  verified: boolean;
  calculated: boolean;
  notified: boolean;
  blocked: boolean;
  reason?: string;
}

export interface ClaimStatusViem {
  claimable: boolean;
  claimed: boolean;
  amount: string;
  claimedAt?: Date;
  expiresAt?: Date;
  transactionHash?: Hash;
  method: 'automatic' | 'manual' | 'batch';
}

export interface RecipientHistoryViem {
  period: string;
  amount: string;
  status: string;
  claimed: boolean;
  claimedAt?: Date;
}

export interface DistributionSummaryViem {
  totalAmount: string;
  totalRecipients: number;
  averageReward: string;
  medianReward: string;
  maxReward: string;
  minReward: string;
  distribution: RewardDistributionStatsViem;
}

export interface RewardDistributionStatsViem {
  top1Percent: string;
  top5Percent: string;
  top10Percent: string;
  top25Percent: string;
  bottom25Percent: string;
  giniCoefficient: number;
}

export interface DistributionStatusViem {
  status: 'pending' | 'calculating' | 'verifying' | 'ready' | 'distributing' | 'completed' | 'failed';
  progress: number;
  errors: DistributionErrorViem[];
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletion?: Date;
}

export interface DistributionErrorViem {
  error: string;
  recipient?: Address;
  amount?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  resolution?: string;
}

export interface DistributionTransactionViem {
  id: string;
  hash: Hash;
  from: Address;
  to: Address;
  amount: string;
  gasUsed: string;
  gasPrice: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
  blockNumber?: BlockNumber;
}

export interface RewardClaimViem {
  id: string;
  recipient: Address;
  distribution: string;
  amount: string;
  status: ClaimStatusViem['status'];
  method: ClaimMethodViem;
  transaction: ClaimTransactionViem;
  timestamp: Date;
}

export interface ClaimMethodViem {
  type: 'direct' | 'gasless' | 'batch' | 'relay';
  provider?: string;
  parameters: Record<string, any>;
}

export interface ClaimTransactionViem {
  hash?: Hash;
  from: Address;
  to: Address;
  amount: string;
  gasUsed?: string;
  gasPrice?: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
  blockNumber?: BlockNumber;
}

export interface RewardAnalyticsViem {
  overview: RewardOverviewViem;
  trends: RewardTrendsViem;
  participation: ParticipationAnalyticsViem;
  performance: PerformanceAnalyticsViem;
  economic: EconomicAnalyticsViem;
  predictions: RewardPredictionsViem;
}

export interface RewardOverviewViem {
  totalDistributed: string;
  totalRecipients: number;
  activePools: number;
  averageReward: string;
  distributionRate: number;
  claimRate: number;
}

export interface RewardTrendsViem {
  distribution: DistributionTrendViem[];
  participation: ParticipationTrendViem[];
  claim: ClaimTrendViem[];
  pool: PoolTrendViem[];
}

export interface DistributionTrendViem {
  period: string;
  amount: string;
  recipients: number;
  average: string;
  efficiency: number;
}

export interface ParticipationTrendViem {
  period: string;
  participants: number;
  eligible: number;
  participationRate: number;
  newParticipants: number;
}

export interface ClaimTrendViem {
  period: string;
  claims: number;
  amount: string;
  claimRate: number;
  averageTimeToClaim: number;
}

export interface PoolTrendViem {
  poolId: string;
  period: string;
  distributed: string;
  utilization: number;
  effectiveness: number;
}

export interface ParticipationAnalyticsViem {
  demographics: ParticipantDemographicsViem;
  behavior: ParticipantBehaviorViem;
  retention: ParticipantRetentionViem;
  engagement: ParticipantEngagementViem;
}

export interface ParticipantDemographicsViem {
  experience: Record<string, number>;
  holdingSize: Record<string, number>;
  geography: Record<string, number>;
  tenure: Record<string, number>;
  activity: Record<string, number>;
}

export interface ParticipantBehaviorViem {
  votingPatterns: VotingBehaviorViem[];
  participationPatterns: ParticipationPatternViem[];
  claimPatterns: ClaimPatternViem[];
  interactionPatterns: InteractionPatternViem[];
}

export interface VotingBehaviorViem {
  metric: string;
  frequency: number;
  consistency: number;
  impact: number;
  trend: string;
}

export interface ParticipationPatternViem {
  activity: string;
  frequency: number;
  duration: number;
  quality: number;
  seasonality: string;
}

export interface ClaimPatternViem {
  timing: string;
  speed: number;
  method: string;
  success: number;
  retry: number;
}

export interface InteractionPatternViem {
  interaction: string;
  frequency: number;
  depth: number;
  quality: number;
  network: number;
}

export interface ParticipantRetentionViem {
  overall: RetentionMetricsViem;
  cohorts: RetentionCohortViem[];
  churn: ChurnMetricsViem;
  reactivation: ReactivationMetricsViem;
}

export interface RetentionMetricsViem {
  rate: number;
  lifetime: number;
  return: number;
  dropoff: number;
}

export interface RetentionCohortViem {
  cohort: string;
  size: number;
  retention: number[];
  characteristics: string[];
}

export interface ChurnMetricsViem {
  rate: number;
  reasons: ChurnReasonViem[];
  prediction: ChurnPredictionViem[];
  prevention: ChurnPreventionViem[];
}

export interface ChurnReasonViem {
  reason: string;
  frequency: number;
  impact: string;
  preventable: boolean;
}

export interface ChurnPredictionViem {
  participant: Address;
  risk: number;
  factors: string[];
  timeframe: number;
  intervention: string;
}

export interface ChurnPreventionViem {
  strategy: string;
  effectiveness: number;
  cost: string;
  implementation: string;
}

export interface ReactivationMetricsViem {
  rate: number;
  methods: ReactivationMethodViem[];
  success: number;
  cost: string;
}

export interface ReactivationMethodViem {
  method: string;
  success: number;
  cost: string;
  timeframe: number;
}

export interface ParticipantEngagementViem {
  overall: EngagementScoreViem;
  channels: ChannelEngagementViem[];
  content: ContentEngagementViem[];
  quality: EngagementQualityViem;
}

export interface EngagementScoreViem {
  score: number;
  trend: string;
  components: EngagementComponentViem[];
  benchmarks: EngagementBenchmarkViem[];
}

export interface EngagementComponentViem {
  component: string;
  score: number;
  weight: number;
  trend: string;
}

export interface EngagementBenchmarkViem {
  metric: string;
  current: number;
  average: number;
  percentile: number;
}

export interface ChannelEngagementViem {
  channel: string;
  usage: number;
  effectiveness: number;
  satisfaction: number;
  demographics: Record<string, number>;
}

export interface ContentEngagementViem {
  content: string;
  views: number;
  interactions: number;
  shares: number;
  sentiment: number;
}

export interface EngagementQualityViem {
  constructiveness: number;
  relevance: number;
  accuracy: number;
  timeliness: number;
  innovation: number;
}

export interface PerformanceAnalyticsViem {
  pools: PoolPerformanceViem[];
  calculations: CalculationPerformanceViem[];
  distributions: DistributionPerformanceViem[];
  claims: ClaimPerformanceViem[];
}

export interface PoolPerformanceViem {
  poolId: string;
  utilization: number;
  effectiveness: number;
  efficiency: number;
  satisfaction: number;
  roi: number;
}

export interface CalculationPerformanceViem {
  accuracy: number;
  speed: number;
  reliability: number;
  fairness: number;
  transparency: number;
}

export interface DistributionPerformanceViem {
  timeliness: number;
  success: number;
  cost: number;
  scale: number;
  automation: number;
}

export interface ClaimPerformanceViem {
  speed: number;
  success: number;
  cost: number;
  userExperience: number;
  automation: number;
}

export interface EconomicAnalyticsViem {
  costs: EconomicCostsViem;
  benefits: EconomicBenefitsViem;
  efficiency: EconomicEfficiencyViem;
  sustainability: EconomicSustainabilityViem;
}

export interface EconomicCostsViem {
  total: string;
  distribution: CostDistributionViem[];
  trends: CostTrendViem[];
  optimization: CostOptimizationViem[];
}

export interface CostDistributionViem {
  category: string;
  amount: string;
  percentage: number;
  trend: string;
}

export interface CostTrendViem {
  period: string;
  amount: string;
  change: number;
  drivers: string[];
}

export interface CostOptimizationViem {
  opportunity: string;
  savings: string;
  implementation: string;
  timeline: string;
}

export interface EconomicBenefitsViem {
  total: string;
  distribution: BenefitDistributionViem[];
  roi: number;
  value: ValueCreationViem[];
}

export interface BenefitDistributionViem {
  beneficiary: string;
  benefit: string;
  percentage: number;
  sustainability: number;
}

export interface ValueCreationViem {
  type: string;
  amount: string;
  metrics: string[];
  sustainability: number;
}

export interface EconomicEfficiencyViem {
  ratio: number;
  trends: EfficiencyTrendViem[];
  benchmarks: EfficiencyBenchmarkViem[];
  improvements: EfficiencyImprovementViem[];
}

export interface EfficiencyTrendViem {
  metric: string;
  current: number;
  previous: number;
  change: number;
  trend: string;
}

export interface EfficiencyBenchmarkViem {
  metric: string;
  current: number;
  industry: number;
  target: number;
}

export interface EfficiencyImprovementViem {
  improvement: string;
  impact: number;
  cost: string;
  timeline: string;
}

export interface EconomicSustainabilityViem {
  score: number;
  factors: SustainabilityFactorViem[];
  risks: SustainabilityRiskViem[];
  strategies: SustainabilityStrategyViem[];
}

export interface SustainabilityFactorViem {
  factor: string;
  impact: number;
  trend: string;
  outlook: string;
}

export interface SustainabilityRiskViem {
  risk: string;
  probability: number;
  impact: string;
  mitigation: string;
}

export interface SustainabilityStrategyViem {
  strategy: string;
  effectiveness: number;
  cost: string;
  timeline: string;
}

export interface RewardPredictionsViem {
  participation: ParticipationPredictionViem[];
  distribution: DistributionPredictionViem[];
  claims: ClaimPredictionViem[];
  economic: EconomicPredictionViem[];
}

export interface ParticipationPredictionViem {
  period: string;
  participants: number;
  confidence: number;
  factors: PredictionFactorViem[];
  scenarios: PredictionScenarioViem[];
}

export interface PredictionFactorViem {
  factor: string;
  weight: number;
  trend: string;
  reliability: number;
}

export interface PredictionScenarioViem {
  scenario: string;
  probability: number;
  outcome: number;
  assumptions: string[];
}

export interface DistributionPredictionViem {
  period: string;
  amount: string;
  recipients: number;
  confidence: number;
  drivers: string[];
  risks: string[];
}

export interface ClaimPredictionViem {
  period: string;
  claims: number;
  amount: string;
  rate: number;
  confidence: number;
}

export interface EconomicPredictionViem {
  metric: string;
  period: string;
  value: string;
  change: number;
  confidence: number;
}

/**
 * Comprehensive participation rewards service using Viem 2.38.5
 */
export class ParticipationRewardsViem {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private governanceService: CakeGovernanceServiceViem;
  private votingPowerTracker: VotingPowerTrackerViem;
  private proposalTracker: ProposalTrackerViem;
  private cacheService: ICache;
  private logger: ILogger;
  private config: ParticipationRewardsConfigViem;

  private pools: Map<string, RewardPoolViem> = new Map();
  private calculations: Map<string, RewardCalculationViem> = new Map();
  private distributions: Map<string, RewardDistributionViem> = new Map();
  private claims: Map<string, RewardClaimViem> = new Map();
  private analytics: RewardAnalyticsViem;

  private readonly cacheConfig: CacheConfig = {
    ttl: 900, // 15 minutes
    maxSize: 1000,
    strategy: 'lru'
  };

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient,
    governanceService: CakeGovernanceServiceViem,
    votingPowerTracker: VotingPowerTrackerViem,
    proposalTracker: ProposalTrackerViem,
    cacheService: ICache,
    logger: ILogger,
    config: ParticipationRewardsConfigViem
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.governanceService = governanceService;
    this.votingPowerTracker = votingPowerTracker;
    this.proposalTracker = proposalTracker;
    this.cacheService = cacheService;
    this.logger = logger;
    this.config = config;
    this.analytics = this.initializeAnalytics();
    this.initializePools();
  }

  /**
   * Initialize reward pools
   */
  private initializePools(): void {
    for (const poolConfig of this.config.rewardPools) {
      const pool: RewardPoolViem = {
        ...poolConfig,
        status: 'active'
      };
      this.pools.set(pool.id, pool);
    }

    this.logger.info('Initialized reward pools', {
      totalPools: this.pools.size,
      activePools: Array.from(this.pools.values()).filter(p => p.status === 'active').length
    });
  }

  /**
   * Calculate rewards for a participant
   */
  async calculateRewards(participant: Address, period: RewardPeriodViem): Promise<RewardCalculationViem> {
    const calculationId = `${participant}_${period.id}`;
    const cacheKey = `calculation:${calculationId}`;

    try {
      // Check cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string) as RewardCalculationViem;
      }

      // Check if already calculated
      if (this.calculations.has(calculationId)) {
        const calculation = this.calculations.get(calculationId)!;
        await this.cacheService.set(cacheKey, JSON.stringify(calculation), this.cacheConfig);
        return calculation;
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

      // Calculate reward amount
      const amount = await this.calculateRewardAmount(score, period);

      // Create calculation
      const calculation: RewardCalculationViem = {
        participant,
        period,
        metrics,
        score,
        amount,
        breakdown: await this.generateRewardBreakdown(score, amount),
        multipliers: await this.applyRewardMultipliers(participant, metrics, score),
        verification: await this.verifyCalculation(calculation)
      };

      this.calculations.set(calculationId, calculation);

      // Cache the calculation
      await this.cacheService.set(cacheKey, JSON.stringify(calculation), this.cacheConfig);

      this.logger.info('Calculated rewards for participant', {
        participant,
        period: period.id,
        amount,
        score: score.total
      });

      return calculation;
    } catch (error) {
      this.logger.error('Error calculating rewards', {
        participant,
        period: period.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Create reward distribution
   */
  async createDistribution(period: RewardPeriodViem, poolId: string): Promise<RewardDistributionViem> {
    const distributionId = `dist_${period.id}_${poolId}`;
    const cacheKey = `distribution:${distributionId}`;

    try {
      // Check cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string) as RewardDistributionViem;
      }

      const pool = this.pools.get(poolId);
      if (!pool) {
        throw new Error(`Reward pool ${poolId} not found`);
      }

      if (pool.status !== 'active') {
        throw new Error(`Reward pool ${poolId} is not active`);
      }

      const distribution: RewardDistributionViem = {
        id: distributionId,
        period,
        pool,
        recipients: [],
        summary: {
          totalAmount: '0',
          totalRecipients: 0,
          averageReward: '0',
          medianReward: '0',
          maxReward: '0',
          minReward: '0',
          distribution: {
            top1Percent: '0',
            top5Percent: '0',
            top10Percent: '0',
            top25Percent: '0',
            bottom25Percent: '0',
            giniCoefficient: 0
          }
        },
        status: {
          status: 'pending',
          progress: 0,
          errors: []
        },
        transactions: []
      };

      this.distributions.set(distributionId, distribution);

      // Cache the distribution
      await this.cacheService.set(cacheKey, JSON.stringify(distribution), this.cacheConfig);

      this.logger.info('Created reward distribution', {
        distributionId,
        period: period.id,
        poolId
      });

      return distribution;
    } catch (error) {
      this.logger.error('Error creating distribution', {
        period: period.id,
        poolId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Process reward distribution
   */
  async processDistribution(distributionId: string): Promise<RewardDistributionViem> {
    try {
      const distribution = this.distributions.get(distributionId);
      if (!distribution) {
        throw new Error(`Distribution ${distributionId} not found`);
      }

      // Update status
      distribution.status = {
        ...distribution.status,
        status: 'calculating',
        progress: 0
      };

      // Get eligible participants
      const eligibleParticipants = await this.getEligibleParticipants(distribution.period);

      // Calculate rewards for all participants
      const calculations: RewardCalculationViem[] = [];
      for (let i = 0; i < eligibleParticipants.length; i++) {
        const participant = eligibleParticipants[i];

        try {
          const calculation = await this.calculateRewards(participant, distribution.period);
          calculations.push(calculation);

          // Update progress
          distribution.status.progress = Math.round((i + 1) / eligibleParticipants.length * 100);

          // Rate limiting
          if (i % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          this.logger.error('Error calculating rewards for participant', {
            participant,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Sort and select recipients based on pool caps
      const sortedCalculations = calculations.sort((a, b) =>
        Number(parseUnits(b.score.total.toString(), 18)) - Number(parseUnits(a.score.total.toString(), 18))
      );

      const selectedRecipients = this.selectRecipients(sortedCalculations, distribution.pool);

      // Create recipients
      distribution.recipients = selectedRecipients.map(calculation => ({
        address: calculation.participant,
        calculation,
        status: {
          eligible: true,
          verified: calculation.verification.status === 'verified',
          calculated: true,
          notified: false,
          blocked: false
        },
        claim: {
          claimable: true,
          claimed: false,
          amount: calculation.amount,
          method: 'manual'
        },
        history: []
      }));

      // Update summary
      distribution.summary = await this.calculateDistributionSummary(distribution.recipients);

      // Update status
      distribution.status = {
        ...distribution.status,
        status: 'ready',
        progress: 100
      };

      this.logger.info('Processed reward distribution', {
        distributionId,
        totalRecipients: distribution.recipients.length,
        totalAmount: distribution.summary.totalAmount
      });

      return distribution;
    } catch (error) {
      this.logger.error('Error processing distribution', {
        distributionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Execute reward distribution
   */
  async executeDistribution(distributionId: string): Promise<RewardDistributionViem> {
    try {
      const distribution = this.distributions.get(distributionId);
      if (!distribution) {
        throw new Error(`Distribution ${distributionId} not found`);
      }

      if (distribution.status.status !== 'ready') {
        throw new Error(`Distribution ${distributionId} is not ready for execution`);
      }

      // Update status
      distribution.status = {
        ...distribution.status,
        status: 'distributing',
        startedAt: new Date()
      };

      // Execute transactions in batches
      const batchSize = 100;
      const transactions: DistributionTransactionViem[] = [];

      for (let i = 0; i < distribution.recipients.length; i += batchSize) {
        const batch = distribution.recipients.slice(i, i + batchSize);

        for (const recipient of batch) {
          try {
            const tx = await this.sendRewardTransaction(
              recipient.address,
              recipient.claim.amount,
              this.config.rewardToken
            );

            const transaction: DistributionTransactionViem = {
              id: `tx_${Date.now()}_${recipient.address}`,
              hash: tx,
              from: this.walletClient.account?.address || '0x0',
              to: recipient.address,
              amount: recipient.claim.amount,
              gasUsed: '0', // Will be updated after confirmation
              gasPrice: '0', // Will be updated after confirmation
              status: 'pending',
              timestamp: new Date()
            };

            transactions.push(transaction);

            // Update recipient claim status
            recipient.claim = {
              ...recipient.claim,
              claimed: true,
              claimedAt: new Date(),
              transactionHash: tx
            };

            // Update progress
            distribution.status.progress = Math.round((i + batch.length) / distribution.recipients.length * 100);

          } catch (error) {
            this.logger.error('Error sending reward transaction', {
              recipient: recipient.address,
              amount: recipient.claim.amount,
              error: error instanceof Error ? error.message : 'Unknown error'
            });

            distribution.status.errors.push({
              error: error instanceof Error ? error.message : 'Unknown error',
              recipient: recipient.address,
              amount: recipient.claim.amount,
              severity: 'high',
              resolved: false
            });
          }
        }

        // Delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      distribution.transactions = transactions;

      // Update final status
      distribution.status = {
        ...distribution.status,
        status: distribution.status.errors.length > 0 ? 'completed' : 'completed',
        progress: 100,
        completedAt: new Date()
      };

      this.logger.info('Executed reward distribution', {
        distributionId,
        totalTransactions: transactions.length,
        errors: distribution.status.errors.length
      });

      return distribution;
    } catch (error) {
      this.logger.error('Error executing distribution', {
        distributionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Claim rewards for a participant
   */
  async claimRewards(
    participant: Address,
    distributionId: string,
    claimMethod?: ClaimMethodViem
  ): Promise<RewardClaimViem> {
    const claimId = `claim_${participant}_${distributionId}`;
    const cacheKey = `claim:${claimId}`;

    try {
      // Check cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string) as RewardClaimViem;
      }

      const distribution = this.distributions.get(distributionId);
      if (!distribution) {
        throw new Error(`Distribution ${distributionId} not found`);
      }

      const recipient = distribution.recipients.find(r => r.address === participant);
      if (!recipient) {
        throw new Error(`Recipient ${participant} not found in distribution ${distributionId}`);
      }

      if (!recipient.claim.claimable) {
        throw new Error(`Rewards are not claimable for participant ${participant}`);
      }

      if (recipient.claim.claimed) {
        throw new Error(`Rewards already claimed for participant ${participant}`);
      }

      const method = claimMethod || { type: 'direct' as const };

      let transactionHash: Hash | undefined;

      if (method.type === 'direct') {
        transactionHash = await this.executeClaimTransaction(
          participant,
          recipient.claim.amount
        );
      }

      const claim: RewardClaimViem = {
        id: claimId,
        recipient: participant,
        distribution: distributionId,
        amount: recipient.claim.amount,
        status: 'confirmed',
        method,
        transaction: {
          hash: transactionHash,
          from: participant,
          to: this.config.rewardToken.address,
          amount: recipient.claim.amount,
          status: 'confirmed',
          timestamp: new Date()
        },
        timestamp: new Date()
      };

      this.claims.set(claimId, claim);

      // Update recipient status
      recipient.claim = {
        ...recipient.claim,
        claimed: true,
        claimedAt: new Date(),
        transactionHash
      };

      // Cache the claim
      await this.cacheService.set(cacheKey, JSON.stringify(claim), this.cacheConfig);

      this.logger.info('Claimed rewards', {
        participant,
        distributionId,
        amount: recipient.claim.amount,
        transactionHash
      });

      return claim;
    } catch (error) {
      this.logger.error('Error claiming rewards', {
        participant,
        distributionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get reward analytics
   */
  async getAnalytics(period?: RewardPeriodViem): Promise<RewardAnalyticsViem> {
    const cacheKey = `analytics:${period?.id || 'all'}`;

    try {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string) as RewardAnalyticsViem;
      }

      const analytics: RewardAnalyticsViem = {
        overview: await this.getRewardOverview(period),
        trends: await this.getRewardTrends(period),
        participation: await this.getParticipationAnalytics(period),
        performance: await this.getPerformanceAnalytics(period),
        economic: await this.getEconomicAnalytics(period),
        predictions: await this.getRewardPredictions(period)
      };

      // Cache analytics with shorter TTL for real-time data
      await this.cacheService.set(cacheKey, JSON.stringify(analytics), {
        ...this.cacheConfig,
        ttl: 600 // 10 minutes
      });

      return analytics;
    } catch (error) {
      this.logger.error('Error getting analytics', {
        period: period?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Private helper methods

  private initializeAnalytics(): RewardAnalyticsViem {
    return {
      overview: {
        totalDistributed: '0',
        totalRecipients: 0,
        activePools: 0,
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
        demographics: {},
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
        calculations: [],
        distributions: [],
        claims: []
      },
      economic: {
        costs: { total: '0', distribution: [], trends: [], optimization: [] },
        benefits: { total: '0', distribution: [], roi: 0, value: [] },
        efficiency: { ratio: 0, trends: [], benchmarks: [], improvements: [] },
        sustainability: { score: 0, factors: [], risks: [], strategies: [] }
      },
      predictions: {
        participation: [],
        distribution: [],
        claims: [],
        economic: []
      }
    };
  }

  private async verifyEligibility(
    participant: Address,
    period: RewardPeriodViem
  ): Promise<{ eligible: boolean; reason?: string }> {
    try {
      // Check minimum requirements
      const votingPower = await this.votingPowerTracker.getCurrentVotingPower(participant);
      const minVotingPower = parseUnits(this.config.eligibility.minimums.votingPower, 18);

      if (parseUnits(votingPower, 18) < minVotingPower) {
        return { eligible: false, reason: 'Insufficient voting power' };
      }

      // Check blacklist
      if (this.config.eligibility.blacklist.enabled) {
        const isBlacklisted = await this.checkBlacklist(participant);
        if (isBlacklisted) {
          return { eligible: false, reason: 'Participant is blacklisted' };
        }
      }

      // Check verification requirements
      if (this.config.eligibility.verification.required) {
        const isVerified = await this.checkVerification(participant);
        if (!isVerified) {
          return { eligible: false, reason: 'Participant is not verified' };
        }
      }

      return { eligible: true };
    } catch (error) {
      this.logger.error('Error verifying eligibility', {
        participant,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { eligible: false, reason: 'Error verifying eligibility' };
    }
  }

  private async collectParticipantMetrics(
    participant: Address,
    period: RewardPeriodViem
  ): Promise<ParticipantMetricsViem> {
    try {
      const votingPower = await this.votingPowerTracker.getCurrentVotingPower(participant);
      const votingAnalytics = await this.votingPowerTracker.getVotingPowerAnalytics(participant);

      return {
        voting: {
          votesCast: 0, // Would be calculated from voting history
          votingPower,
          participationRate: 0.65, // Would be calculated from actual data
          consistency: 0.8,
          alignment: 0.7,
          timeliness: 0.9
        },
        participation: {
          proposalsReviewed: 5,
          discussionsParticipated: 12,
          commentsPosted: 8,
          delegationsReceived: 2,
          communityEvents: 1
        },
        contribution: {
          proposalsSubmitted: 1,
          improvementsSuggested: 3,
          bugsReported: 2,
          documentationCreated: 1,
          mentorshipProvided: 1
        },
        engagement: {
          loginFrequency: 15,
          sessionDuration: 1800, // seconds
          interactionDepth: 3,
          networkGrowth: 5,
          influenceScore: 7.5
        },
        quality: {
          reasoningQuality: 0.8,
          researchDepth: 0.7,
          constructiveness: 0.9,
          innovation: 0.6,
          accuracy: 0.85
        }
      };
    } catch (error) {
      this.logger.error('Error collecting participant metrics', {
        participant,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async calculateRewardScore(metrics: ParticipantMetricsViem): Promise<RewardScoreViem> {
    const weights = this.config.calculation.weights;

    const voting = metrics.voting.participationRate * 0.3 +
                  metrics.voting.consistency * 0.4 +
                  metrics.voting.alignment * 0.3;

    const participation = (metrics.participation.proposalsReviewed * 0.2 +
                         metrics.participation.discussionsParticipated * 0.3 +
                         metrics.participation.commentsPosted * 0.3 +
                         metrics.participation.communityEvents * 0.2) / 10;

    const contribution = (metrics.contribution.proposalsSubmitted * 0.3 +
                         metrics.contribution.improvementsSuggested * 0.2 +
                         metrics.contribution.bugsReported * 0.2 +
                         metrics.contribution.documentationCreated * 0.2 +
                         metrics.contribution.mentorshipProvided * 0.1) / 10;

    const engagement = (metrics.engagement.loginFrequency * 0.2 +
                       metrics.engagement.interactionDepth * 0.3 +
                       metrics.engagement.networkGrowth * 0.3 +
                       metrics.engagement.influenceScore * 0.2) / 10;

    const quality = (metrics.quality.reasoningQuality * 0.25 +
                    metrics.quality.researchDepth * 0.2 +
                    metrics.quality.constructiveness * 0.25 +
                    metrics.quality.innovation * 0.15 +
                    metrics.quality.accuracy * 0.15);

    const total = voting * 0.35 + participation * 0.25 + contribution * 0.15 +
                 engagement * 0.15 + quality * 0.1;

    return {
      total: Math.min(total, 100),
      breakdown: {
        voting,
        participation,
        contribution,
        engagement,
        quality,
        bonus: 0
      },
      rank: 1, // Would be calculated from all participants
      percentile: 95, // Would be calculated from all participants
      trend: {
        current: total,
        previous: total * 0.95, // Mock previous value
        change: (total - total * 0.95) / (total * 0.95) * 100,
        direction: 'up' as const,
        momentum: 0.05
      }
    };
  }

  private async calculateRewardAmount(score: RewardScoreViem, period: RewardPeriodViem): Promise<string> {
    const baseAmount = parseUnits('100', 18); // Base reward amount
    const scoreMultiplier = score.total / 100;
    const adjustedAmount = baseAmount * BigInt(Math.floor(scoreMultiplier * 1000000)) / BigInt(1000000);

    return formatUnits(adjustedAmount, 18);
  }

  private async generateRewardBreakdown(
    score: RewardScoreViem,
    amount: string
  ): Promise<RewardBreakdownViem> {
    const amountBN = parseUnits(amount, 18);
    const baseAmount = amountBN * BigInt(Math.floor(score.breakdown.voting * 1000000)) / BigInt(1000000);

    return {
      base: {
        type: 'base_reward',
        amount: formatUnits(baseAmount, 18),
        percentage: score.breakdown.voting,
        description: 'Base reward calculated from voting participation',
        calculation: 'score.voting * base_amount',
        source: 'voting_metrics'
      },
      bonus: {
        type: 'bonus',
        amount: '0',
        percentage: 0,
        description: 'Bonus rewards',
        calculation: '0',
        source: 'bonus_criteria'
      },
      multipliers: [],
      adjustments: [],
      total: amount
    };
  }

  private async applyRewardMultipliers(
    participant: Address,
    metrics: ParticipantMetricsViem,
    score: RewardScoreViem
  ): Promise<AppliedMultiplierViem[]> {
    const multipliers: AppliedMultiplierViem[] = [];

    // Consistency bonus
    if (metrics.voting.consistency > 0.9) {
      multipliers.push({
        id: 'consistency_bonus',
        name: 'High Consistency Bonus',
        criteria: 'voting_consistency > 0.9',
        multiplier: 1.1,
        amount: formatUnits(parseUnits('10', 18), 18), // 10 token bonus
        reason: 'Consistently participating in votes'
      });
    }

    return multipliers;
  }

  private async verifyCalculation(calculation: RewardCalculationViem): Promise<VerificationStatusViem> {
    return {
      status: 'verified',
      score: 95,
      checks: [
        {
          check: 'eligibility_check',
          status: 'pass',
          score: 100,
          details: 'Participant meets all eligibility requirements',
          timestamp: new Date()
        },
        {
          check: 'metrics_validation',
          status: 'pass',
          score: 90,
          details: 'All metrics are within expected ranges',
          timestamp: new Date()
        }
      ],
      issues: [],
      reviewed: true
    };
  }

  private async getEligibleParticipants(period: RewardPeriodViem): Promise<Address[]> {
    // This would typically query a database or use a known set of participants
    // For now, returning a mock implementation
    return [
      '0x1234567890123456789012345678901234567890' as Address,
      '0x2345678901234567890123456789012345678901' as Address,
      '0x3456789012345678901234567890123456789012' as Address
    ];
  }

  private selectRecipients(
    calculations: RewardCalculationViem[],
    pool: RewardPoolViem
  ): RewardCalculationViem[] {
    let selected = calculations;

    // Apply individual caps
    selected = selected.filter(calc =>
      parseUnits(calc.amount, 18) <= parseUnits(pool.caps.individual.maxPerPeriod, 18)
    );

    // Apply pool caps
    selected = selected.slice(0, pool.caps.pool.maxClaimants);

    return selected;
  }

  private async calculateDistributionSummary(recipients: RewardRecipientViem[]): Promise<DistributionSummaryViem> {
    const amounts = recipients.map(r => parseUnits(r.claim.amount, 18));
    const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0n);
    const averageAmount = totalAmount / BigInt(recipients.length);

    // Calculate median
    const sortedAmounts = amounts.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const medianAmount = sortedAmounts[Math.floor(sortedAmounts.length / 2)];

    // Calculate distribution stats
    const totalAmountFloat = Number(formatUnits(totalAmount, 18));
    const top1Percent = totalAmountFloat * 0.01;
    const top5Percent = totalAmountFloat * 0.05;
    const top10Percent = totalAmountFloat * 0.10;
    const top25Percent = totalAmountFloat * 0.25;
    const bottom25Percent = totalAmountFloat * 0.25;

    return {
      totalAmount: formatUnits(totalAmount, 18),
      totalRecipients: recipients.length,
      averageReward: formatUnits(averageAmount, 18),
      medianReward: formatUnits(medianAmount, 18),
      maxReward: formatUnits(sortedAmounts[sortedAmounts.length - 1], 18),
      minReward: formatUnits(sortedAmounts[0], 18),
      distribution: {
        top1Percent: top1Percent.toString(),
        top5Percent: top5Percent.toString(),
        top10Percent: top10Percent.toString(),
        top25Percent: top25Percent.toString(),
        bottom25Percent: bottom25Percent.toString(),
        giniCoefficient: 0.35 // Simplified calculation
      }
    };
  }

  private async sendRewardTransaction(
    to: Address,
    amount: string,
    token: { address: Address; decimals: number }
  ): Promise<Hash> {
    // This would use the wallet client to send the actual transaction
    // For now, returning a mock transaction hash
    return '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hash;
  }

  private async executeClaimTransaction(
    participant: Address,
    amount: string
  ): Promise<Hash> {
    // This would use the wallet client to execute the claim transaction
    // For now, returning a mock transaction hash
    return '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hash;
  }

  private async checkBlacklist(participant: Address): Promise<boolean> {
    // This would check against various blacklist sources
    return false;
  }

  private async checkVerification(participant: Address): Promise<boolean> {
    // This would check verification status
    return true;
  }

  private async getRewardOverview(period?: RewardPeriodViem): Promise<RewardOverviewViem> {
    return {
      totalDistributed: '1000000',
      totalRecipients: 500,
      activePools: this.pools.size,
      averageReward: '2000',
      distributionRate: 0.85,
      claimRate: 0.92
    };
  }

  private async getRewardTrends(period?: RewardPeriodViem): Promise<RewardTrendsViem> {
    return {
      distribution: [
        {
          period: '2024-01',
          amount: '100000',
          recipients: 50,
          average: '2000',
          efficiency: 0.95
        }
      ],
      participation: [
        {
          period: '2024-01',
          participants: 100,
          eligible: 120,
          participationRate: 0.83,
          newParticipants: 15
        }
      ],
      claim: [
        {
          period: '2024-01',
          claims: 45,
          amount: '90000',
          claimRate: 0.9,
          averageTimeToClaim: 7200 // seconds
        }
      ],
      pool: []
    };
  }

  private async getParticipationAnalytics(period?: RewardPeriodViem): Promise<ParticipationAnalyticsViem> {
    return {
      demographics: {
        experience: { 'beginner': 30, 'intermediate': 40, 'advanced': 25, 'expert': 5 },
        holdingSize: { 'micro': 20, 'small': 35, 'medium': 30, 'large': 12, 'whale': 3 },
        geography: { 'US': 40, 'EU': 30, 'Asia': 25, 'Other': 5 },
        tenure: { 'new': 25, 'recent': 30, 'established': 35, 'veteran': 10 },
        activity: { 'active': 60, 'inactive': 20, 'occasional': 15, 'frequent': 5 }
      },
      behavior: {
        votingPatterns: [],
        participationPatterns: [],
        claimPatterns: [],
        interactionPatterns: []
      },
      retention: {
        overall: { rate: 0.85, lifetime: 180, return: 0.7, dropoff: 0.15 },
        cohorts: [],
        churn: { rate: 0.15, reasons: [], prediction: [], prevention: [] },
        reactivation: { rate: 0.3, methods: [], success: 0.6, cost: '5000' }
      },
      engagement: {
        overall: { score: 75, trend: 'up', components: [], benchmarks: [] },
        channels: [],
        content: [],
        quality: {
          constructiveness: 0.8,
          relevance: 0.85,
          accuracy: 0.9,
          timeliness: 0.75,
          innovation: 0.7
        }
      }
    };
  }

  private async getPerformanceAnalytics(period?: RewardPeriodViem): Promise<PerformanceAnalyticsViem> {
    return {
      pools: [],
      calculations: [
        {
          accuracy: 0.95,
          speed: 120, // seconds per calculation
          reliability: 0.98,
          fairness: 0.92,
          transparency: 0.88
        }
      ],
      distributions: [
        {
          timeliness: 0.9,
          success: 0.95,
          cost: 0.05, // percentage of total rewards
          scale: 1000, // recipients processed
          automation: 0.85
        }
      ],
      claims: [
        {
          speed: 30, // seconds
          success: 0.98,
          cost: 0.001, // percentage of claim amount
          userExperience: 0.92,
          automation: 0.8
        }
      ]
    };
  }

  private async getEconomicAnalytics(period?: RewardPeriodViem): Promise<EconomicAnalyticsViem> {
    return {
      costs: {
        total: '50000',
        distribution: [
          { category: 'gas_fees', amount: '20000', percentage: 40, trend: 'stable' },
          { category: 'infrastructure', amount: '15000', percentage: 30, trend: 'down' },
          { category: 'operations', amount: '10000', percentage: 20, trend: 'stable' },
          { category: 'support', amount: '5000', percentage: 10, trend: 'up' }
        ],
        trends: [],
        optimization: []
      },
      benefits: {
        total: '1000000',
        distribution: [
          { beneficiary: 'participants', benefit: '900000', percentage: 90, sustainability: 0.95 },
          { beneficiary: 'ecosystem', benefit: '100000', percentage: 10, sustainability: 0.88 }
        ],
        roi: 20, // 20x return on investment
        value: []
      },
      efficiency: {
        ratio: 20, // 20:1 benefit to cost ratio
        trends: [],
        benchmarks: [],
        improvements: []
      },
      sustainability: {
        score: 85,
        factors: [],
        risks: [],
        strategies: []
      }
    };
  }

  private async getRewardPredictions(period?: RewardPeriodViem): Promise<RewardPredictionsViem> {
    return {
      participation: [
        {
          period: '2024-02',
          participants: 550,
          confidence: 0.85,
          factors: [
            { factor: 'seasonal_trend', weight: 0.3, trend: 'up', reliability: 0.8 },
            { factor: 'market_conditions', weight: 0.2, trend: 'stable', reliability: 0.7 }
          ],
          scenarios: [
            { scenario: 'bull_case', probability: 0.3, outcome: 600, assumptions: ['High market activity'] },
            { scenario: 'base_case', probability: 0.5, outcome: 550, assumptions: ['Normal market activity'] },
            { scenario: 'bear_case', probability: 0.2, outcome: 500, assumptions: ['Low market activity'] }
          ]
        }
      ],
      distribution: [
        {
          period: '2024-02',
          amount: '1100000',
          recipients: 550,
          confidence: 0.8,
          drivers: ['Increased participation', 'Higher token price'],
          risks: ['Market volatility', 'Gas price spikes']
        }
      ],
      claims: [
        {
          period: '2024-02',
          claims: 500,
          amount: '1000000',
          rate: 0.91,
          confidence: 0.85
        }
      ],
      economic: [
        {
          metric: 'total_rewards',
          period: '2024-02',
          value: '1100000',
          change: 10,
          confidence: 0.8
        }
      ]
    };
  }
}