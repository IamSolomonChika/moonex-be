/**
 * BSC Governance Types and Interfaces (Viem)
 * Defines comprehensive governance data structures for PancakeSwap integration using Viem
 */

import { Address } from 'viem';

// PancakeSwap Governance ABI (Viem compatible)
export const GOVERNANCE_TOKEN_ABI_VIEM = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function getOwner() view returns (address)',
  'function getPriorVotes(address, uint256) view returns (uint256)',
  'function getCurrentVotes(address) view returns (uint256)'
] as const;

export const GOVERNANCE_ABI_VIEM = [
  'function propose(address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description) external returns (uint256)',
  'function queue(uint256 proposalId) external returns (uint256)',
  'function execute(uint256 proposalId) external payable returns (uint256)',
  'function cancel(uint256 proposalId) external',
  'function castVote(uint256 proposalId, uint8 support) external',
  'function castVoteWithReason(uint256 proposalId, uint8 support, string calldata reason) external',
  'function getActions(uint256 proposalId) external view returns (address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas)',
  'function getReceipt(uint256 proposalId, address voter) external view returns (bool hasVoted, uint8 support, uint96 votes)',
  'function state(uint256 proposalId) external view returns (uint8)',
  'function proposalCount() external view returns (uint256)',
  'function votingDelay() external view returns (uint256)',
  'function votingPeriod() external view returns (uint256)',
  'function proposalThreshold() external view returns (uint256)',
  'function quorumVotes() external view returns (uint256)',
  'function timelock() external view returns (address)'
] as const;

export const VOTING_POWER_ABI_VIEM = [
  'function getCurrentVotes(address account) external view returns (uint96)',
  'function getPriorVotes(address account, uint256 blockNumber) external view returns (uint96)',
  'function delegate(address delegatee) external',
  'function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) external'
] as const;

export const TIMELOCK_ABI_VIEM = [
  'function admin() external view returns (address)',
  'function pendingAdmin() external view returns (address)',
  'function delay() external view returns (uint256)',
  'function queueTransaction(address target, uint256 value, string calldata signature, bytes calldata data, uint256 eta) external returns (bytes32)',
  'function executeTransaction(address target, uint256 value, string calldata signature, bytes calldata data, uint256 eta) external payable returns (bytes32)',
  'function cancelTransaction(address target, uint256 value, string calldata signature, bytes calldata data, uint256 eta) external'
] as const;

export interface GovernanceTokenInfoViem {
  // Token identification
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  circulatingSupply: string;
  holdersCount: number;

  // Governance configuration
  governance: {
    owner: Address;
    timelockDelay: number;
    votingPower: VotingPowerConfigViem;
    proposals: ProposalConfigViem;
    treasury: TreasuryConfigViem;
  };

  // Metadata
  metadata: {
    contractVersion: string;
    deployedAt: number;
    lastUpdated: number;
    verified: boolean;
  };
}

export interface VotingPowerConfigViem {
  enabled: boolean;
  contractAddress: Address;
  votingPowerPerToken: number;
  maxVotingPower: string;
  blockNumber: number;
  snapshots: VotingPowerSnapshotViem[];
  delegationEnabled: boolean;
  delegationHistory: DelegationRecordViem[];
}

export interface VotingPowerSnapshotViem {
  id: string;
  blockNumber: number;
  timestamp: number;
  totalVotingPower: string;
  tokenHolders: TokenHolderVotingPowerViem[];
  createdAt: number;
}

export interface TokenHolderVotingPowerViem {
  address: Address;
  balance: string;
  votingPower: string;
  delegatedTo?: Address;
  delegationsReceived: DelegationRecordViem[];
}

export interface DelegationRecordViem {
  id: string;
  from: Address;
  to: Address;
  amount: string;
  blockNumber: number;
  timestamp: number;
  transactionHash: Address;
  type: 'delegate' | 'undelegate';
  reason?: string;
}

export interface ProposalConfigViem {
  contractAddress: Address;
  proposalThreshold: string;
  quorumVotes: string;
  votingPeriod: number;
  executionDelay: number;
  timelockDelay: number;
  minDelay: number;
  maxOperations: number;
  descriptionHash: string;
  proposerWhitelist: Address[];
  activeProposals: number;
  proposalTypes: ProposalTypeViem[];
}

export interface ProposalTypeViem {
  id: string;
  name: string;
  description: string;
  parameters: ProposalParameterViem[];
  validationRules: ValidationRuleViem[];
}

export interface ProposalParameterViem {
  name: string;
  type: 'address' | 'uint256' | 'string' | 'bool' | 'bytes';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: string;
}

export interface ValidationRuleViem {
  field: string;
  condition: string;
  errorMessage: string;
}

export interface TreasuryConfigViem {
  address: Address;
  balance: string;
  withdrawalLimits: WithdrawalLimitViem[];
  authorizedSpenders: Address[];
  transactionHistory: TreasuryTransactionViem[];
  lastUpdated: number;
}

export interface WithdrawalLimitViem {
  amount: string;
  period: number; // seconds
  spender: Address;
  lastWithdrawal: number;
}

export interface TreasuryTransactionViem {
  hash: Address;
  from: Address;
  to: Address;
  amount: string;
  timestamp: number;
  blockNumber: number;
  description: string;
  executed: boolean;
}

export interface ProposalViem {
  // Proposal identification
  id: number;
  proposer: Address;
  target: Address;
  value: string;
  signature: string;
  data: string;
  executionHash?: Address;
  description: string;
  type: string;

  // Proposal timing
  createdBlock: number;
  startBlock: number;
  endBlock: number;
  canceled: boolean;
  executed: boolean;

  // Voting data
  votesFor: string;
  votesAgainst: string;
  abstainVotes: string;
  totalVotes: string;
  quorumVotes: string;
  proposalThreshold: string;
  status: ProposalStatusViem;

  // Proposal operations
  operations: ProposalOperationViem[];

  // Metadata
  metadata: {
    creationTime: number;
    lastUpdated: number;
    creatorReputation: number;
    discussionThread?: string;
    ipfsHash?: string;
  };
}

export interface ProposalOperationViem {
  target: Address;
  value: string;
  data: string;
  signature: string;
  description: string;
}

export type ProposalStatusViem =
  | 'pending'
  | 'active'
  | 'canceled'
  | 'defeated'
  | 'succeeded'
  | 'queued'
  | 'expired'
  | 'executed';

export interface VoteViem {
  proposalId: number;
  voter: Address;
  support: boolean;
  weight: string;
  reasoning?: string;
  blockNumber: number;
  timestamp: number;
  transactionHash: Address;
  metadata: {
    ipHash?: string;
    reputationScore: number;
  };
}

export interface VoteResultViem {
  proposalId: number;
  votesFor: string;
  votesAgainst: string;
  abstainVotes: string;
  totalVotes: string;
  quorumReached: boolean;
  thresholdReached: boolean;
  outcome: 'pass' | 'fail' | 'undetermined';
  winner: 'for' | 'against' | 'none';
  executionReady: boolean;
}

export interface GovernanceMetricsViem {
  totalProposals: number;
  activeProposals: number;
  successfulProposals: number;
  participationRate: number;
  averageVotingTime: number;
  topVoters: Array<{
    address: Address;
    votingPower: string;
    votesCast: number;
    reputation: number;
  }>;
  proposalStatistics: {
    byType: { [type: string]: number };
    byOutcome: { [outcome: string]: number };
    averageDuration: number;
  };
  treasuryMetrics: {
    totalBalance: string;
    totalWithdrawn: string;
    activeLimits: number;
    authorizedSpenders: number;
  };
  votingPowerMetrics: {
    totalVotingPower: string;
    delegatedPower: string;
    activeDelegations: number;
    snapshotsCount: number;
  };
  lastUpdated: number;
}

export interface DelegateInfoViem {
  delegator: Address;
  delegatee: Address;
  votingPower: string;
  delegatedAt: number;
  lastActivity: number;
  metadata: {
    reason?: string;
    reputationScore: number;
  };
}

export interface ProposalAnalysisViem {
  proposalId: number;
  riskAssessment: {
    financialRisk: number;
    governanceRisk: number;
    technicalRisk: number;
    overallRisk: number;
  };
  marketImpact: {
    priceImpact: number;
    volumeImpact: number;
    sentimentScore: number;
  };
  votingAnalysis: {
    supportTrend: Array<{
      block: number;
      forVotes: string;
      againstVotes: string;
      totalVotes: string;
    }>;
    voterDemographics: {
      newVoters: number;
      returningVoters: number;
      votingPowerConcentration: number;
    };
    sentimentAnalysis: {
      positive: number;
      negative: number;
      neutral: number;
    };
  };
  predictions: {
    successProbability: number;
    estimatedVotesFor: string;
    estimatedVotesAgainst: string;
    confidence: number;
  };
  recommendations: string[];
}

export interface GovernanceEventViem {
  type: GovernanceEventTypeViem;
  proposalId?: number;
  actor: Address;
  data: any;
  blockNumber: number;
  timestamp: number;
  transactionHash: Address;
  metadata: {
    relevance: 'high' | 'medium' | 'low';
    impact: 'high' | 'medium' | 'low';
  };
}

export type GovernanceEventTypeViem =
  | 'proposal_created'
  | 'vote_cast'
  | 'proposal_executed'
  | 'proposal_cancelled'
  | 'delegation'
  | 'undelegation'
  | 'timelock_changed'
  | 'treasury_withdrawal'
  | 'quorum_reached'
  | 'threshold_reached'
  | 'proposal_queued';

export interface GovernanceNotificationViem {
  id: string;
  type: 'proposal_created' | 'vote_cast' | 'proposal_executed' | 'voting_deadline' | 'treasury_operation';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  data: any;
  recipients: Address[];
  channels: ('email' | 'webhook' | 'slack' | 'telegram')[];
  timestamp: number;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  metadata: {
    proposalId?: number;
    actor?: Address;
    impact: string;
  };
}

// Viem-specific interfaces for service implementation
export interface IGovernanceServiceViem {
  // Token and voting power management
  getGovernanceTokenInfo(): Promise<GovernanceTokenInfoViem>;
  getVotingPower(address: Address, blockNumber?: number): Promise<string>;
  getTotalVotingPower(blockNumber?: number): Promise<string>;
  delegateVotingPower(delegatee: Address, amount: string, signer: any): Promise<{ transactionHash: Address; votingPowerDelegated: string }>;
  undelegateVotingPower(amount: string, signer: any): Promise<{ transactionHash: Address; votingPowerUndelegated: string }>;
  getDelegationInfo(address: Address): Promise<DelegateInfoViem[]>;

  // Proposal management
  createProposal(targets: Array<{
    target: Address;
    value: string;
    signature: string;
    data: string;
    description: string;
  }>, signer: any): Promise<ProposalViem>;
  getProposal(proposalId: number): Promise<ProposalViem | undefined>;
  getAllProposals(filters?: {
    status?: ProposalStatusViem;
    proposer?: Address;
    type?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'createdBlock' | 'endBlock' | 'votesFor' | 'votesAgainst';
    sortOrder?: 'asc' | 'desc';
  }): Promise<ProposalViem[]>;
  voteOnProposal(proposalId: number, support: boolean, signer: any, reasoning?: string): Promise<VoteViem>;
  executeProposal(proposalId: number, signer: any): Promise<{ transactionHash: Address; executionTime: number }>;
  cancelProposal(proposalId: number, signer: any): Promise<{ transactionHash: Address }>;
  queueProposal(proposalId: number, signer: any): Promise<{ transactionHash: Address }>;

  // Vote result calculation
  calculateVoteResult(proposalId: number): Promise<VoteResultViem>;

  // Proposal analysis
  analyzeProposal(proposalId: number): Promise<ProposalAnalysisViem>;

  // Metrics and analytics
  getMetrics(): Promise<GovernanceMetricsViem>;

  // Event management
  getEvents(filters?: {
    type?: GovernanceEventTypeViem;
    proposalId?: number;
    actor?: Address;
    blockNumber?: number;
    limit?: number;
    offset?: number;
  }): Promise<GovernanceEventViem[]>;

  // Notification management
  sendNotification(notification: Omit<GovernanceNotificationViem, 'id'>): Promise<string>;

  // Health check
  healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      tokenInfo: boolean;
      contractsConfigured: boolean;
      activeProposals: number;
      totalVotes: number;
      cacheEnabled: boolean;
      metricsUpToDate: boolean;
    };
  }>;

  // Cleanup
  cleanup(): Promise<void>;
}

export interface GovernanceConfigViem {
  // Contract addresses
  governanceToken: Address;
  votingPowerContract: Address;
  proposalContract: Address;
  treasuryContract?: Address;

  // Gas configuration
  defaultGasLimit: {
    propose: number;
    vote: number;
    execute: number;
    cancel: number;
    queue: number;
    delegate: number;
  };

  // Cache configuration
  cacheTokenInfo: boolean;
  tokenInfoCacheTTL: number;
  cacheProposalData: boolean;
  proposalDataCacheTTL: number;
  cacheUserData: boolean;
  userDataCacheTTL: number;

  // Monitoring configuration
  enableEventLogging: boolean;
  enableMetrics: boolean;
  metricsRetentionDays: number;

  // Security settings
  maxProposalValue: string;
  requireProposalVerification: boolean;
  allowedProposers: Address[];
}

export interface GovernanceFilterViem {
  status?: ProposalStatusViem;
  proposer?: Address;
  type?: string;
  isActive?: boolean;
  hasExecuted?: boolean;
  minVotes?: string;
  maxVotes?: string;
  dateRange?: {
    start: number;
    end: number;
  };
  sortBy?: 'createdBlock' | 'endBlock' | 'votesFor' | 'votesAgainst' | 'value';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface GovernanceBatchRequestViem {
  proposalIds: number[];
  includeVotes?: boolean;
  includeAnalysis?: boolean;
  userAddress?: Address;
}

export interface GovernanceBatchResponseViem {
  proposals: ProposalViem[];
  votes?: VoteViem[];
  analysis?: ProposalAnalysisViem[];
  errors: Array<{
    proposalId: number;
    error: string;
  }>;
  timestamp: number;
}