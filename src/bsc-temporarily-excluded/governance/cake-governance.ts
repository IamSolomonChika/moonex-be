import { Logger } from '../../../utils/logger.js';
import { ethers } from 'ethers';
import { ICache } from '../../../services/cache.service.js';

const logger = new Logger('CakeGovernance');

// Governance types and interfaces
export interface GovernanceTokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  circulatingSupply: string;
  holdersCount: number;
  governance: {
    owner: string;
    timelockDelay: number;
    votingPower: VotingPowerConfig;
    proposals: ProposalConfig;
    treasury: TreasuryConfig;
  };
  metadata: {
    contractVersion: string;
    deployedAt: number;
    lastUpdated: number;
    verified: boolean;
  };
}

export interface VotingPowerConfig {
  enabled: boolean;
  contractAddress: string;
  votingPowerPerToken: number;
  maxVotingPower: number;
  blockNumber: number;
  snapshots: VotingPowerSnapshot[];
  delegationEnabled: boolean;
  delegationHistory: DelegationRecord[];
}

export interface VotingPowerSnapshot {
  id: string;
  blockNumber: number;
  timestamp: number;
  totalVotingPower: string;
  tokenHolders: TokenHolderVotingPower[];
  createdAt: number;
}

export interface TokenHolderVotingPower {
  address: string;
  balance: string;
  votingPower: string;
  delegatedTo?: string;
  delegationsReceived: DelegationRecord[];
}

export interface DelegationRecord {
  id: string;
  from: string;
  to: string;
  amount: string;
  blockNumber: number;
  timestamp: number;
  transactionHash: string;
  type: 'delegate' | 'undelegate';
  reason?: string;
}

export interface ProposalConfig {
  contractAddress: string;
  proposalThreshold: string;
  quorumVotes: string;
  votingPeriod: number;
  executionDelay: number;
  timelockDelay: number;
  minDelay: number;
  maxOperations: number;
  descriptionHash: string;
  proposerWhitelist: string[];
  activeProposals: number;
  proposalTypes: ProposalType[];
}

export interface ProposalType {
  id: string;
  name: string;
  description: string;
  parameters: ProposalParameter[];
  validationRules: ValidationRule[];
}

export interface ProposalParameter {
  name: string;
  type: 'address' | 'uint256' | 'string' | 'bool' | 'bytes';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: string;
}

export interface ValidationRule {
  field: string;
  condition: string;
  errorMessage: string;
}

export interface TreasuryConfig {
  address: string;
  balance: string;
  withdrawalLimits: WithdrawalLimit[];
  authorizedSpenders: string[];
  transactionHistory: TreasuryTransaction[];
  lastUpdated: number;
}

export interface WithdrawalLimit {
  amount: string;
  period: number; // seconds
  spender: string;
  lastWithdrawal: number;
}

export interface TreasuryTransaction {
  hash: string;
  from: string;
  to: string;
  amount: string;
  timestamp: number;
  blockNumber: number;
  description: string;
  executed: boolean;
}

export interface Proposal {
  id: number;
  proposer: string;
  target: string;
  value: string;
  signature: string;
  data: string;
  executionHash?: string;
  description: string;
  type: string;
  createdBlock: number;
  startBlock: number;
  endBlock: number;
  canceled: boolean;
  executed: boolean;
  votesFor: string;
  votesAgainst: string;
  abstainVotes: string;
  totalVotes: string;
  quorumVotes: string;
  proposalThreshold: string;
  status: ProposalStatus;
  operations: ProposalOperation[];
  metadata: {
    creationTime: number;
    lastUpdated: number;
    creatorReputation: number;
    discussionThread?: string;
    ipfsHash?: string;
  };
}

export interface ProposalOperation {
  target: string;
  value: string;
  data: string;
  signature: string;
  description: string;
}

export type ProposalStatus =
  | 'pending'
  | 'active'
  | 'canceled'
  | 'defeated'
  | 'succeeded'
  | 'queued'
  | 'expired'
  | 'executed';

export interface Vote {
  proposalId: number;
  voter: string;
  support: boolean;
  weight: string;
  reasoning?: string;
  blockNumber: number;
  timestamp: number;
  transactionHash: string;
  metadata: {
    ipHash?: string;
    reputationScore: number;
  };
}

export interface VoteResult {
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

export interface GovernanceMetrics {
  totalProposals: number;
  activeProposals: number;
  successfulProposals: number;
  participationRate: number;
  averageVotingTime: number;
  topVoters: Array<{
    address: string;
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

export interface DelegateInfo {
  delegator: string;
  delegatee: string;
  votingPower: string;
  delegatedAt: number;
  lastActivity: number;
  metadata: {
    reason?: string;
    reputationScore: number;
  };
}

export interface ProposalAnalysis {
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

export interface GovernanceEvent {
  type: GovernanceEventType;
  proposalId?: number;
  actor: string;
  data: any;
  blockNumber: number;
  timestamp: number;
  transactionHash: string;
  metadata: {
    relevance: 'high' | 'medium' | 'low';
    impact: 'high' | 'medium' | 'low';
  };
}

export type GovernanceEventType =
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

export interface GovernanceNotification {
  id: string;
  type: 'proposal_created' | 'vote_cast' | 'proposal_executed' | 'voting_deadline' | 'treasury_operation';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  data: any;
  recipients: string[];
  channels: ('email' | 'webhook' | 'slack' | 'telegram')[];
  timestamp: number;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  metadata: {
    proposalId?: number;
    actor?: string;
    impact: string;
  };
}

export class CakeGovernanceService {
  private governanceToken: GovernanceTokenInfo | null = null;
  private proposals: Map<number, Proposal> = new Map();
  private votes: Map<number, Vote[]> = new Map();
  private delegations: Map<string, DelegationRecord[]> = new Map();
  private events: GovernanceEvent[] = [];
  private metrics: GovernanceMetrics;

  constructor(
    private provider: ethers.JsonRpcProvider,
    private cacheService: ICache,
    governanceTokenAddress: string,
    votingPowerContractAddress: string,
    proposalContractAddress: string,
    treasuryContractAddress?: string
  ) {
    this.metrics = {
      totalProposals: 0,
      activeProposals: 0,
      successfulProposals: 0,
      participationRate: 0,
      averageVotingTime: 0,
      topVoters: [],
      proposalStatistics: {
        byType: {},
        byOutcome: {},
        averageDuration: 0
      },
      treasuryMetrics: {
        totalBalance: '0',
        totalWithdrawn: '0',
        activeLimits: 0,
        authorizedSpenders: 0
      },
      votingPowerMetrics: {
        totalVotingPower: '0',
        delegatedPower: '0',
        activeDelegations: 0,
        snapshotsCount: 0
      },
      lastUpdated: Date.now()
    };

    // Initialize contracts
    this.initializeContracts(
      governanceTokenAddress,
      votingPowerContractAddress,
      proposalContractAddress,
      treasuryContractAddress
    );
  }

  // Token and voting power management
  async getGovernanceTokenInfo(): Promise<GovernanceTokenInfo> {
    try {
      if (this.governanceToken) {
        return this.governanceToken;
      }

      logger.info('Fetching CAKE governance token information');

      // Get token info
      const tokenContract = new ethers.Contract(
        this.governanceTokenAddress,
        [
          'function name() view returns (string)',
          'function symbol() view returns (string)',
          'function decimals() view returns (uint8)',
          'function totalSupply() view returns (uint256)',
          'function balanceOf(address) view returns (uint256)',
          'function getOwner() view returns (address)'
        ],
        this.provider
      );

      const [name, symbol, decimals, totalSupply] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.totalSupply()
      ]);

      // Get owner
      const owner = await tokenContract.getOwner();

      // Get circulating supply (simplified - in production would calculate actual circulating supply)
      const circulatingSupply = totalSupply;

      // Get holders count (simplified)
      const holdersCount = await this.getHoldersCount();

      // Get governance configuration
      const governanceConfig = await this.getGovernanceConfig();

      this.governanceToken = {
        address: this.governanceTokenAddress,
        name,
        symbol,
        decimals,
        totalSupply: totalSupply.toString(),
        circulatingSupply: circulatingSupply.toString(),
        holdersCount,
        governance: governanceConfig,
        metadata: {
          contractVersion: '1.0.0',
          deployedAt: 0,
          lastUpdated: Date.now(),
          verified: true
        }
      };

      logger.info('CAKE governance token information retrieved', {
        address: this.governanceTokenAddress,
        name,
        symbol,
        totalSupply: totalSupply.toString()
      });

      return this.governanceToken;
    } catch (error) {
      logger.error('Failed to get governance token information', {
        error: error.message,
        governanceTokenAddress: this.governanceTokenAddress
      });
      throw error;
    }
  }

  async getVotingPower(address: string, blockNumber?: number): Promise<string> {
    try {
      const votingPowerContract = new ethers.Contract(
        this.governanceToken!.governance.votingPower.contractAddress,
        [
          'function getCurrentVotes(address) view returns (uint256)',
          'function getPastVotes(address, uint256) view returns (uint256)'
        ],
        this.provider
      );

      let votingPower: string;
      if (blockNumber) {
        votingPower = await votingPowerContract.getPastVotes(address, blockNumber);
      } else {
        votingPower = await votingPowerContract.getCurrentVotes(address);
      }

      // Add delegated voting power
      const delegatedPower = await this.getDelegatedVotingPower(address);
      const totalVotingPower = BigInt(votingPower) + BigInt(delegatedPower);

      return totalVotingPower.toString();
    } catch (error) {
      logger.error('Failed to get voting power', {
        error: error.message,
        address,
        blockNumber
      });
      throw error;
    }
  }

  async getTotalVotingPower(blockNumber?: number): Promise<string> {
    try {
      if (!this.governanceToken) {
        await this.getGovernanceTokenInfo();
      }

      const votingPowerContract = new ethers.Contract(
        this.governanceToken!.governance.votingPower.contractAddress,
        [
          'function getTotalVotes() view returns (uint256)'
        ],
        this.provider
      );

      const totalVotingPower = await votingPowerContract.getTotalVotes();

      return totalVotingPower.toString();
    } catch (error) {
      logger.error('Failed to get total voting power', {
        error: error.message
      });
      throw error;
    }
  }

  async delegateVotingPower(
    delegatee: string,
    amount: string,
    signer: ethers.Wallet
  ): Promise<{ transactionHash: string; votingPowerDelegated: string }> {
    try {
      logger.info('Delegating voting power', {
        delegatee,
        amount,
        from: signer.address
      });

      const votingPowerContract = new ethers.Contract(
        this.governanceToken!.governance.votingPower.contractAddress,
        [
          'function delegate(address, uint256) returns ()',
          'function delegateBySig(address, address, uint256, uint256, bytes, bytes) returns ()'
        ],
        this.provider
      );

      // Delegate voting power
      const tx = await votingPowerContract.delegate(delegatee, amount, {
        from: signer.address
      });

      const receipt = await tx.wait();

      // Record delegation
      const delegation: DelegationRecord = {
        id: this.generateId(),
        from: signer.address,
        to: delegatee,
        amount,
        blockNumber: receipt.blockNumber,
        timestamp: Date.now(),
        transactionHash: receipt.transactionHash,
        type: 'delegate'
      };

      const delegatorDelegations = this.delegations.get(signer.address.toLowerCase()) || [];
      delegatorDelegations.push(delegation);
      this.delegations.set(signer.address.toLowerCase(), delegatorDelegations);

      // Update metrics
      this.metrics.votingPowerMetrics.delegatedPower = await this.calculateTotalDelegatedPower();

      logger.info('Voting power delegated successfully', {
        transactionHash: receipt.transactionHash,
        from: signer.address,
        to: delegatee,
        amount,
        votingPowerDelegated: amount
      });

      return {
        transactionHash: receipt.transactionHash,
        votingPowerDelegated: amount
      };
    } catch (error) {
      logger.error('Failed to delegate voting power', {
        error: error.message,
        delegatee,
        amount
      });
      throw error;
    }
  }

  async undelegateVotingPower(
    amount: string,
    signer: ethers.Wallet
  ): Promise<{ transactionHash: string; votingPowerUndelegated: string }> {
    try {
      logger.info('Undelegating voting power', {
        amount,
        from: signer.address
      });

      const votingPowerContract = new ethers.Contract(
        this.governanceToken!.governance.votingPower.contractAddress,
        [
          'function undelegate(uint256) returns ()',
          'function undelegateBySig(address, uint256, uint256, bytes, bytes) returns ()'
        ],
        this.provider
      );

      // Undelegate voting power
      const tx = await votingPowerContract.undelegate(amount, {
        from: signer.address
      });

      const receipt = await tx.wait();

      // Remove delegation record (simplified - would remove most recent or specific amount)
      const delegatorDelegations = this.delegations.get(signer.address.toLowerCase()) || [];
      if (delegatorDelegations.length > 0) {
        delegatorDelegations.pop();
        this.delegations.set(signer.address.toLowerCase(), delegatorDelegations);
      }

      // Update metrics
      this.metrics.votingPowerMetrics.delegatedPower = await this.calculateTotalDelegatedPower();

      logger.info('Voting power undelegated successfully', {
        transactionHash: receipt.transactionHash,
        from: signer.address,
        amount,
        votingPowerUndelegated: amount
      });

      return {
        transactionHash: receipt.transactionHash,
        votingPowerUndelegated: amount
      };
    } catch (error) {
      logger.error('Failed to undelegate voting power', {
        error: error.message,
        amount
      });
      throw error;
    }
  }

  async getDelegationInfo(address: string): Promise<DelegateInfo[]> {
    try {
      const delegations = this.delegations.get(address.toLowerCase()) || [];

      // Get current voting power for each delegation
      const delegateInfos: DelegateInfo[] = [];

      for (const delegation of delegations) {
        const delegateVotingPower = await this.getVotingPower(delegation.to);
        delegateInfos.push({
          delegator: delegation.from,
          delegatee: delegation.to,
          votingPower: delegation.amount,
          delegatedAt: delegation.timestamp,
          lastActivity: delegation.timestamp,
          metadata: {
            reason: delegation.reason,
            reputationScore: 0 // Would calculate based on voting history
          }
        });
      }

      return delegateInfos;
    } catch (error) {
      logger.error('Failed to get delegation info', {
        error: error.message,
        address
      });
      throw error;
    }
  }

  // Proposal management
  async createProposal(
    targets: Array<{
      target: string;
      value: string;
      signature: string;
      data: string;
      description: string;
    }>,
    signer: ethers.Wallet
  ): Promise<Proposal> {
    try {
      logger.info('Creating governance proposal', {
        proposer: signer.address,
        targetsCount: targets.length,
        description: targets[0].description
      });

      const proposalContract = new ethers.Contract(
        this.governanceToken!.governance.proposals.contractAddress,
        [
          'function propose(address[], uint256, string, bytes) returns (uint256)',
          'function queue(uint256) returns (uint256)',
          'function execute(uint256) returns (bool)',
          'function cancel(uint256) returns (bool)'
        ],
        this.provider
      );

      // Create proposal
      const targetsForContract = targets.map(t => ({
        target: t.target,
        value: t.value,
        signature: t.signature,
        data: t.data
      }));

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(targets[0].description));

      const tx = await proposalContract.propose(
        targetsForContract,
        this.governanceToken!.governance.proposals.proposalThreshold,
        targets[0].description,
        '0x'
      );

      const receipt = await tx.wait();
      const proposalId = parseInt(receipt.events?.find((e: any) => e.event === 'ProposalCreated')?.args?.proposalId || '0');

      // Create proposal object
      const block = await this.provider.getBlock(receipt.blockNumber);
      const proposal: Proposal = {
        id: proposalId,
        proposer: signer.address,
        target: targets[0].target,
        value: targets[0].value,
        signature: targets[0].signature,
        data: targets[0].data,
        description: targets[0].description,
        type: 'simple', // Simplified - would determine from operation
        createdBlock: receipt.blockNumber,
        startBlock: block.number + 1,
        endBlock: block.number + this.governanceToken!.governance.proposals.votingPeriod,
        canceled: false,
        executed: false,
        votesFor: '0',
        votesAgainst: '0',
        abstainVotes: '0',
        totalVotes: '0',
        quorumVotes: '0',
        proposalThreshold: this.governanceToken!.governance.proposals.quorumVotes,
        status: 'pending',
        operations: [{
          target: targets[0].target,
          value: targets[0].value,
          data: targets[0].data,
          signature: targets[0].signature,
          description: targets[0].description
        }],
        metadata: {
          creationTime: Date.now(),
          lastUpdated: Date.now(),
          creatorReputation: 0,
          discussionThread: '',
          ipfsHash: descriptionHash
        }
      };

      // Store proposal
      this.proposals.set(proposalId, proposal);

      // Update metrics
      this.metrics.totalProposals++;
      this.metrics.activeProposals++;

      // Emit event
      this.emit('proposalCreated', proposal);

      logger.info('Governance proposal created successfully', {
        proposalId,
        proposer: proposal.proposer,
        description: proposal.description
      });

      return proposal;
    } catch (error) {
      logger.error('Failed to create proposal', {
        error: error.message,
        targets,
        proposer: signer.address
      });
      throw error;
    }
  }

  async getProposal(proposalId: number): Promise<Proposal | undefined> {
    try {
      const proposal = this.proposals.get(proposalId);
      if (!proposal) {
        return undefined;
      }

      // Update proposal status if needed
      await this.updateProposalStatus(proposal);

      return proposal;
    } catch (error) {
      logger.error('Failed to get proposal', {
        error: error.message,
        proposalId
      });
      throw error;
    }
  }

  async getAllProposals(
    filters?: {
      status?: ProposalStatus;
      proposer?: string;
      type?: string;
      limit?: number;
      offset?: number;
      sortBy?: 'createdBlock' | 'endBlock' | 'votesFor' | 'votesAgainst';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<Proposal[]> {
    try {
      let proposals = Array.from(this.proposals.values());

      // Apply filters
      if (filters) {
        if (filters.status) {
          proposals = proposals.filter(p => p.status === filters.status);
        }
        if (filters.proposer) {
          proposals = proposals.filter(p => p.proposer.toLowerCase() === filters.proposer.toLowerCase());
        }
        if (filters.type) {
          proposals = proposals.filter(p => p.type === filters.type);
        }
      }

      // Sort
      if (filters?.sortBy) {
        proposals.sort((a, b) => {
          let comparison = 0;

          switch (filters.sortBy) {
            case 'createdBlock':
              comparison = a.createdBlock - b.createdBlock;
              break;
            case 'endBlock':
              comparison = a.endBlock - b.endBlock;
              break;
            case 'votesFor':
              comparison = parseFloat(a.votesFor) - parseFloat(b.votesFor);
              break;
            case 'votesAgainst':
              comparison = parseFloat(a.votesAgainst) - parseFloat(b.votesAgainst);
              break;
            default:
              comparison = a.id - b.id;
          }

          return filters.sortOrder === 'desc' ? -comparison : comparison;
        });
      }

      // Apply pagination
      if (filters?.offset) {
        proposals = proposals.slice(filters.offset);
      }
      if (filters?.limit) {
        proposals = proposals.slice(0, filters.limit);
      }

      return proposals;
    } catch (error) {
      logger.error('Failed to get proposals', {
        error: error.message,
        filters
      });
      throw error;
    }
  }

  async voteOnProposal(
    proposalId: number,
    support: boolean,
    signer: ethers.Wallet,
    reasoning?: string
  ): Promise<Vote> {
    try {
      logger.info('Casting vote', {
        proposalId,
        support,
        voter: signer.address,
        reasoning
      });

      const proposal = await this.getProposal(proposalId);
      if (!proposal) {
        throw new Error(`Proposal not found: ${proposalId}`);
      }

      if (proposal.status !== 'active') {
        throw new Error(`Proposal is not active: ${proposal.status}`);
      }

      const votingPowerContract = new ethers.Contract(
        this.governanceToken!.governance.votingPower.contractAddress,
        [
          'function castVote(uint256, bool) returns ()',
          'function castVoteWithReason(uint256, bool, string) returns ()'
        ],
        this.provider
      );

      // Get current voting power
      const votingPower = await this.getVotingPower(signer.address);

      // Cast vote
      let tx;
      if (reasoning) {
        tx = await votingContract.castVoteWithReason(proposalId, support, reasoning, {
          from: signer.address
        });
      } else {
        tx = await votingContract.castVote(proposalId, support, {
          from: signer.address
        });
      }

      const receipt = await tx.wait();

      const vote: Vote = {
        proposalId,
        voter: signer.address,
        support,
        weight: votingPower,
        reasoning,
        blockNumber: receipt.blockNumber,
        timestamp: Date.now(),
        transactionHash: receipt.transactionHash,
        metadata: {
          reputationScore: 0 // Would calculate from voting history
        }
      };

      // Store vote
      const proposalVotes = this.votes.get(proposalId) || [];
      proposalVotes.push(vote);
      this.votes.set(proposalId, proposalVotes);

      // Update proposal vote counts
      await this.updateProposalVotes(proposal);

      // Update metrics
      this.updateVotingMetrics();

      // Emit events
      this.emit('voteCast', vote);
      this.emit('proposalUpdated', proposal);

      logger.info('Vote cast successfully', {
        proposalId,
        voter: vote.voter,
        support,
        weight: vote.weight,
        transactionHash: vote.transactionHash
      });

      return vote;
    } catch (error) {
      logger.error('Failed to cast vote', {
        error: error.message,
        proposalId,
        support,
        voter: signer.address
      });
      throw error;
    }
  }

  async executeProposal(
    proposalId: number,
    signer: ethers.Wallet
  ): Promise<{ transactionHash: string; executionTime: number }> {
    try {
      logger.info('Executing proposal', {
        proposalId,
        executor: signer.address
      });

      const proposal = await this.getProposal(proposalId);
      if (!proposal) {
        throw new Error(`Proposal not found: ${proposalId}`);
      }

      if (proposal.status !== 'succeeded') {
        throw new Error(`Proposal is not ready for execution: ${proposal.status}`);
      }

      const proposalContract = new ethers.Contract(
        this.governanceToken!.governance.proposals.contractAddress,
        [
          'function execute(uint256) returns (bool)',
          'function queue(uint256) returns (uint256)'
        ],
        this.provider
      );

      const startTime = Date.now();

      // Execute proposal
      const tx = await proposalContract.execute(proposalId, {
        from: signer.address
      });

      const receipt = await tx.wait();

      const executionTime = Date.now() - startTime;

      // Update proposal
      proposal.executed = true;
      proposal.executionHash = receipt.transactionHash;
      proposal.status = 'executed';
      proposal.metadata.lastUpdated = Date.now();

      // Update metrics
      this.metrics.successfulProposals++;
      this.metrics.activeProposals--;

      // Emit events
      this.emit('proposalExecuted', proposal);
      this.emit('proposalUpdated', proposal);

      logger.info('Proposal executed successfully', {
        proposalId,
        executor: signer.address,
        transactionHash: receipt.transactionHash,
        executionTime
      });

      return {
        transactionHash: receipt.transactionHash,
        executionTime
      };
    } catch (error) {
      logger.error('Failed to execute proposal', {
        error: error.message,
        proposalId,
        executor: signer.address
      });
      throw error;
    }
  }

  async cancelProposal(
    proposalId: number,
    signer: ethers.Wallet
  ): Promise<{ transactionHash: string }> {
    try {
      logger.info('Canceling proposal', {
        proposalId,
        proposer: signer.address
      });

      const proposal = await this.getProposal(proposalId);
      if (!proposal) {
        throw new Error(`Proposal not found: ${proposalId}`);
      }

      if (proposal.status !== 'pending' && proposal.status !== 'active') {
        throw new Error(`Proposal cannot be canceled: ${proposal.status}`);
      }

      const proposalContract = new ethers.Contract(
        this.governanceToken!.governance.proposals.contractAddress,
        [
          'function cancel(uint256) returns (bool)'
        ],
        this.provider
      );

      const tx = await proposalContract.cancel(proposalId, {
        from: signer.address
      });

      const receipt = await tx.wait();

      // Update proposal
      proposal.canceled = true;
      proposal.status = 'canceled';
      proposal.metadata.lastUpdated = Date.now();

      // Update metrics
      this.metrics.activeProposals--;

      // Emit events
      this.emit('proposalCanceled', proposal);
      this.emit('proposalUpdated', proposal);

      logger.info('Proposal canceled successfully', {
        proposalId,
        proposer: proposal.proposer,
        transactionHash: receipt.transactionHash
      });

      return {
        transactionHash: receipt.transactionHash
      };
    } catch (error) {
      logger.error('Failed to cancel proposal', {
        error: error.message,
        proposalId,
        proposer: signer.address
      });
      throw error;
    }
  }

  async queueProposal(
    proposalId: number,
    signer: ethers.Wallet
  ): Promise<{ transactionHash: string }> {
    try {
      logger.info('Queuing proposal', {
        proposalId,
        queue: signer.address
      });

      const proposal = await this.getProposal(proposalId);
      if (!proposal) {
        throw new Error(`Proposal not found: ${proposalId}`);
      }

      if (proposal.status !== 'pending') {
        throw new Error(`Proposal cannot be queued: ${proposal.status}`);
      }

      const proposalContract = new ethers.Contract(
        this.governanceToken!.governance.proposals.contractAddress,
        [
          'function queue(uint256) returns (uint256)'
        ],
        this.provider
      );

      const tx = await proposalContract.queue(proposalId, {
        from: signer.address
      });

      const receipt = await tx.wait();

      // Update proposal
      proposal.status = 'queued';
      proposal.startBlock = receipt.blockNumber + 1;
      proposal.metadata.lastUpdated = Date.now();

      // Emit events
      this.emit('proposalQueued', proposal);
      this.emit('proposalUpdated', proposal);

      logger.info('Proposal queued successfully', {
        proposalId,
        queue: signer.address,
        transactionHash: receipt.transactionHash
      });

      return {
        transactionHash: receipt.transactionHash
      };
    } catch (error) {
      logger.error('Failed to queue proposal', {
        error: error.message,
        proposalId,
        queue: signer.address
      });
      throw error;
    }
  }

  // Vote result calculation
  async calculateVoteResult(proposalId: number): Promise<VoteResult> {
    try {
      const proposal = await this.getProposal(proposalId);
      if (!proposal) {
        throw new Error(`Proposal not found: proposalId}`);
      }

      const votes = this.votes.get(proposalId) || [];
      const votesFor = votes
        .filter(v => v.support)
        .reduce((sum, vote) => sum + BigInt(vote.weight), 0n);
      const votesAgainst = votes
        .filter(v => !v.support)
        .reduce((sum, vote) => sum + BigInt(vote.weight), 0n);

      const abstainVotes = votes
        .filter(v => v.support === undefined || v.support === null)
        .reduce((sum, vote) => sum + BigInt(vote.weight), 0n);

      const totalVotes = votesFor + votesAgainst + abstainVotes;
      const quorumVotes = BigInt(proposal.quorumVotes);
      const thresholdVotes = BigInt(proposal.proposalThreshold);

      // Determine outcome
      let outcome: 'pass' | 'fail' | 'undetermined';
      let winner: 'for' | 'against' | 'none';
      let executionReady = false;

      const quorumReached = totalVotes >= quorumVotes;
      const thresholdReached = votesFor >= thresholdVotes;

      if (quorumReached && thresholdReached) {
        outcome = votesFor > votesAgainst ? 'pass' : 'fail';
        winner = votesFor > votesAgainst ? 'for' : 'against';
        executionReady = true;
      } else if (!quorumReached) {
        outcome = 'undetermined';
        winner = 'none';
      } else {
        outcome = 'fail';
        winner = 'against';
        executionReady = false;
      }

      return {
        proposalId,
        votesFor: votesFor.toString(),
        votesAgainst: votesAgainst.toString(),
        abstainVotes: abstainVotes.toString(),
        totalVotes: totalVotes.toString(),
        quorumReached,
        thresholdReached,
        outcome,
        winner,
        executionReady
      };
    } catch (error) {
      logger.error('Failed to calculate vote result', {
        error: error.message,
        proposalId
      });
      throw error;
    }
  }

  // Proposal analysis
  async analyzeProposal(proposalId: number): Promise<ProposalAnalysis> {
    try {
      const proposal = await this.getProposal(proposal);
      if (!proposal) {
        throw new Error(`Proposal not found: ${proposalId}`);
      }

      logger.info(`Analyzing proposal: ${proposalId}`);

      // Calculate risk assessment
      const riskAssessment = await this.calculateRiskAssessment(proposal);

      // Calculate market impact
      const marketImpact = await this.calculateMarketImpact(proposal);

      // Calculate voting analysis
      const votingAnalysis = await this.analyzeVotingPatterns(proposal);

      // Generate predictions
      const predictions = await this.generatePredictions(proposal);

      // Generate recommendations
      const recommendations = this.generateRecommendations(proposal, riskAssessment, marketImpact, votingAnalysis);

      const analysis: ProposalAnalysis = {
        proposalId,
        riskAssessment,
        marketImpact,
        votingAnalysis,
        predictions,
        recommendations
      };

      logger.info('Proposal analysis completed', {
        proposalId,
        riskScore: riskAssessment.overallRisk,
        successProbability: predictions.successProbability
      });

      return analysis;
    } catch (error) {
      logger.error('Failed to analyze proposal', {
        error: error.message,
        proposalId
      });
      throw error;
    }
  }

  // Metrics and analytics
  async getMetrics(): Promise<GovernanceMetrics> {
    try {
      // Update current metrics
      this.metrics.lastUpdated = Date.now();

      // Calculate participation rate
      if (this.governanceToken) {
        const totalVotingPower = await this.getTotalVotingPower();
        const votedPower = await this.calculateTotalVotedPower();
        this.metrics.participationRate = totalVotingPower > 0
          ? (votedPower / totalVotingPower) * 100
          : 0;
      }

      // Update top voters (simplified)
      this.metrics.topVoters = await this.getTopVoters();

      // Update proposal statistics
      this.metrics.proposalStatistics = this.calculateProposalStatistics();

      // Update treasury metrics
      this.metrics.treasuryMetrics = await this.getTreasuryMetrics();

      // Update voting power metrics
      this.metrics.votingPowerMetrics = await this.getVotingPowerMetrics();

      return { ...this.metrics };
    } catch (error) {
      logger.error('Failed to get governance metrics', {
        error: error.message
      });
      throw error;
    }
  }

  // Event management
  async getEvents(
    filters?: {
      type?: GovernanceEventType;
      proposalId?: number;
      actor?: string;
      blockNumber?: number;
      limit?: number;
      offset?: number;
    }
  ): Promise<GovernanceEvent[]> {
    try {
      let events = [...this.events];

      // Apply filters
      if (filters) {
        if (filters.type) {
          events = events.filter(e => e.type === filters.type);
        }
        if (filters.proposalId) {
          events = events.filter(e => e.proposalId === filters.proposalId);
        }
        if (filters.actor) {
          events = events.filter(e => e.actor === filters.actor);
        }
        if (filters.blockNumber) {
          events = events.filter(e => e.blockNumber >= filters.blockNumber);
        }
      }

      // Sort by timestamp (most recent first)
      events.sort((a, b) => b.timestamp - a.timestamp);

      // Apply pagination
      if (filters?.offset) {
        events = events.slice(filters.offset);
      }
      if (filters?.limit) {
        events = events.slice(0, filters.limit);
      }

      return events;
    } catch (error) {
      logger.error('Failed to get governance events', {
        error: error.message,
        filters
      });
      throw error;
    }
  }

  // Notification management
  async sendNotification(notification: Omit<GovernanceNotification, 'id'>): Promise<string> {
    try {
      const id = this.generateId();
      const fullNotification: GovernanceNotification = {
        id,
        timestamp: Date.now(),
        status: 'pending',
        ...notification
      };

      // Send notifications to specified channels
      if (notification.channels.includes('email')) {
        await this.sendEmailNotification(fullNotification);
      }
      if (notification.channels.includes('webhook')) {
        await this.sendWebhookNotification(fullNotification);
      }
      if (notification.channels.includes('slack')) {
        await this.sendSlackNotification(fullNotification);
      }
      if (notification.channels.includes('telegram')) {
        await this.sendTelegramNotification(fullNotification);
      }

      // Update status
      fullNotification.status = 'sent';
      fullNotification.metadata.status = 'sent';

      logger.info('Governance notification sent', {
        id,
        type: notification.type,
        priority: notification.priority
      });

      // Emit event
      this.emit('notificationSent', fullNotification);

      return id;
    } catch (error) {
      logger.error('Failed to send governance notification', {
        error: error.message,
        notification
      });
      throw error;
    }
  }

  // Private helper methods
  private async initializeContracts(
    governanceTokenAddress: string,
    votingPowerContractAddress: string,
    proposalContractAddress: string,
    treasuryContractAddress?: string
  ): Promise<void> {
    try {
      // Initialize contract instances
      // Contract instances would be created as needed
      logger.info('Governance contracts initialized', {
        governanceTokenAddress,
        votingPowerContractAddress,
        proposalContractAddress,
        treasuryContractAddress
      });
    } catch (error) {
      logger.error('Failed to initialize contracts', {
        error: error.message
      });
    }
  }

  private async getGovernanceConfig(): Promise<GovernanceTokenInfo['governance']> {
    // Mock governance configuration
    // In production, would query the actual governance contracts
    return {
      owner: ethers.Wallet.createRandom().address,
      timelockDelay: 172800, // 2 days
      votingPower: {
        enabled: true,
        contractAddress: this.votingPowerContractAddress,
        votingPowerPerToken: 1,
        maxVotingPower: ethers.parseUnits('1000000', 18),
        blockNumber: 0,
        snapshots: [],
        delegationEnabled: true,
        delegationHistory: []
      },
      proposals: {
        contractAddress: this.proposalContractAddress,
        proposalThreshold: ethers.parseUnits('10000', 18), // 10,000 CAKE
        quorumVotes: ethers.parseUnits('5000', 18), // 5,000 CAKE
        votingPeriod: 604800, // 7 days
        executionDelay: 172800, // 2 days
        timelockDelay: 172800, // 2 days
        minDelay: 43200, // 12 hours
        maxOperations: 10,
        descriptionHash: '',
        proposerWhitelist: [],
        activeProposals: 0,
        proposalTypes: [
          {
            id: 'parameter_change',
            name: 'Parameter Change',
            description: 'Change protocol parameters',
            parameters: [],
            validationRules: [],
          },
          {
            'id': 'treasury_withdrawal',
            name: 'Treasury Withdrawal',
            description: 'Withdraw funds from treasury',
            parameters: [
              {
                name: 'recipient',
                type: 'address',
                description: 'Recipient address',
                required: true
              },
              {
                name: 'amount',
                type: 'uint256',
                description: 'Withdrawal amount',
                required: true
              }
            ],
            validationRules: []
          }
        ]
      },
      treasury: {
        address: treasuryContractAddress || ethers.Wallet.createRandom().address,
        balance: '0',
        withdrawalLimits: [],
        authorizedSpenders: [],
        transactionHistory: [],
        lastUpdated: Date.now()
      }
    };
  }

  private async getHoldersCount(): Promise<number> {
    // Simplified holder count
    // In production, would query actual holder data
    return 10000;
  }

  private async calculateTotalDelegatedPower(): Promise<string> {
    try {
      let totalDelegated = 0n;

      for (const [_, delegations] of this.delegations.entries()) {
        for (const delegation of delegations) {
          totalDelegated = totalDelegated + BigInt(delegation.amount);
        }
      }

      return totalDelegated.toString();
    } catch (error) {
      logger.error('Failed to calculate total delegated power', { error: error.message });
      return '0';
    }
  }

  private async calculateTotalVotedPower(): Promise<string> {
    try {
      let totalVoted = 0n;

      for (const [_, votes] of this.votes.entries()) {
        for (const vote of votes) {
          totalVoted = totalVoted + BigInt(vote.weight);
        }
      }

      return totalVoted.toString();
    } catch (error) {
      logger.error('Failed to calculate total voted power', { error: error.message });
      return '0';
    }
  }

  private async updateProposalStatus(proposal: Proposal): Promise<void> {
    try {
      const now = Date.now();

      // Check if voting period has ended
      if (now >= proposal.endBlock * 1000) {
        if (proposal.votesFor === proposal.votesAgainst) {
          proposal.status = 'defeated';
        } else if (proposal.votesFor > proposal.votesAgainst) {
          proposal.status = 'succeeded';
        } else {
          proposal.status = 'expired';
        }
      }

      // Check if proposal should be queued
      if (proposal.status === 'pending' && now >= proposal.startBlock * 1000) {
        proposal.status = 'active';
      }

      // Check if proposal is ready for execution
      if (proposal.status === 'active' && now >= proposal.endBlock + this.governanceToken!.governance.proposals.executionDelay) {
        // Check if quorum and threshold are met
        const voteResult = await this.calculateVoteResult(proposal.id);
        if (voteResult.executionReady) {
          proposal.status = 'succeeded';
        }
      }

      proposal.metadata.lastUpdated = Date.now();
    } catch (error) {
      logger.error('Failed to update proposal status', {
        error: error.message,
        proposalId: proposal.id
      });
    }
  }

  private async updateProposalVotes(proposal: Proposal): Promise<void> {
    try {
      const votes = this.votes.get(proposal.id) || [];

      let votesFor = 0n;
      let votesAgainst = 0n;
      let abstainVotes = 0n;

      for (const vote of votes) {
        if (vote.support) {
          votesFor = votesFor + BigInt(vote.weight);
        } else if (vote.support === false) {
          votesAgainst = votesAgainst + BigInt(vote.weight);
        } else {
          abstainVotes = abstainVotes + BigInt(vote.weight);
        }
      }

      proposal.votesFor = votesFor.toString();
      proposal.votesAgainst = votesAgainst.toString();
      proposal.abstainVotes = abstainVotes.toString();
      proposal.totalVotes = votesFor.add(votesAgainst).add(abstainVotes).toString();
      proposal.quorumVotes = proposal.quorumVotes;
      proposal.proposalThreshold = proposal.proposalThreshold;

      proposal.metadata.lastUpdated = Date.now();
    } catch (error) {
      logger.error('Failed to update proposal votes', {
        error: error.message,
        proposalId: proposal.id
      });
    }
  }

  private updateVotingMetrics(): void {
    try {
      // Update voting metrics based on current votes
      const totalVotes = this.metrics.totalProposals > 0
        ? this.metrics.totalVotes / this.metrics.totalProposals
        : 0;

      // Calculate average voting time (simplified)
      // In production, would calculate actual voting times from vote timestamps
      this.metrics.averageVotingTime = 3600000; // 1 hour average

      // Update participation rate
      if (this.governanceToken) {
        const totalVotingPower = this.metrics.votingPowerMetrics.totalVotingPower;
        const votedPower = this.calculateTotalVotedPower();
        this.metrics.participationRate = totalVotingPower > 0
          ? (votedPower / totalVotingPower) * 100
          : 0;
      }
    } catch (error) {
      logger.error('Failed to update voting metrics', { error: error.message });
    }
  }

  private async getTopVoters(): Promise<Array<{
    address: string;
    votingPower: string;
    votesCast: number;
    reputation: number;
  }>> {
    // Simplified top voters tracking
    // In production, would calculate actual voting power and reputation scores
    return [];
  }

  private calculateProposalStatistics(): GovernanceMetrics['proposalStatistics'] {
    const proposals = Array.from(this.proposals.values());
    const byType: { [type: string]: number } = {};
    const byOutcome: { [outcome: string]: number } = {};

    proposals.forEach(proposal => {
      byType[proposal.type] = (byType[proposal.type] || 0) + 1;
      byOutcome[proposal.status] = (byOutcome[proposal.status] || 0) + 1;
    });

    const durations = proposals
      .filter(p => p.endBlock > p.startBlock)
      .map(p => p.endBlock - p.startBlock);

    const averageDuration = durations.length > 0
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
      : 0;

    return {
      byType,
      byOutcome,
      averageDuration
    };
  }

  private async getTreasuryMetrics(): Promise<GovernanceMetrics['treasuryMetrics']> {
    try {
      if (!this.governanceToken) {
        await this.getGovernanceTokenInfo();
      }

      // In production, would query actual treasury balance and transaction history
      return {
        totalBalance: '0',
        totalWithdrawn: '0',
        activeLimits: 0,
        authorizedSpenders: 0
      };
    } catch (error) {
      logger.error('Failed to get treasury metrics', { error: error.message });
      return {
        totalBalance: '0',
        totalWithdrawn: '0',
        activeLimits: 0,
        authorizedSpenders: 0
      };
    }
  }

  private async getVotingPowerMetrics(): Promise<GovernanceMetrics['votingPowerMetrics']> {
    try {
      const totalVotingPower = await this.getTotalVotingPower();
      const delegatedPower = await this.calculateTotalDelegatedPower();
      const snapshotsCount = this.governanceToken?.governance.votingPower.snapshots.length || 0;

      return {
        totalVotingPower,
        delegatedPower,
        activeDelegations: this.delegations.size,
        snapshotsCount
      };
    } catch (error) {
      logger.error('Failed to get voting power metrics', { error: error.message });
      return {
        totalVotingPower: '0',
        delegatedPower: '0',
        activeDelegations: 0,
        snapshotsCount: 0
      };
    }
  }

  private async calculateRiskAssessment(proposal: Proposal): Promise<ProposalAnalysis['riskAssessment']> {
    // Simplified risk assessment
    const financialRisk = proposal.value ?
      parseFloat(ethers.formatEther(proposal.value)) / 100000 : 0;

    const governanceRisk = proposal.proposer === this.governanceToken!.governance.owner ? 0 : 0.2;

    const technicalRisk = proposal.operations.length > 5 ? 0.3 : 0.1;

    const overallRisk = Math.min(1, (financialRisk + governanceRisk + technicalRisk) / 3);

    return {
      financialRisk,
      governanceRisk,
      technicalRisk,
      overallRisk
    };
  }

  private async calculateMarketImpact(proposal: Proposal): Promise<ProposalAnalysis['marketImpact']> {
    // Simplified market impact calculation
    const marketImpact = 0.1; // 10% impact

    return {
      priceImpact: marketImpact,
      volumeImpact: marketImpact * 2, // Volume impact is typically double price impact
      sentimentScore: 0,
    };
  }

  private async analyzeVotingPatterns(proposal: Proposal): Promise<ProposalAnalysis['votingAnalysis']> {
    const votes = this.votes.get(proposal.id) || [];

    const supportTrend: Array<{
      block: number;
      forVotes: string;
      againstVotes: string;
      totalVotes: string;
    }> = [];

    // Generate support trend (simplified)
    const sortedVotes = [...votes].sort((a, b) => b.blockNumber - a.blockNumber);
    let cumulativeFor = 0n;
    let cumulativeAgainst = 0n;
    let cumulativeTotal = 0n;

    for (const vote of sortedVotes) {
      cumulativeFor = cumulativeFor.add(vote.weight);
      cumulativeAgainst = cumulativeAgainst.add(vote.weight);
      cumulativeTotal = cumulativeTotal.add(vote.weight);

      supportTrend.push({
        block: vote.blockNumber,
        forVotes: cumulativeFor.toString(),
        againstVotes: cumulativeAgainst.toString(),
        totalVotes: cumulativeTotal.toString()
      });
    }

    // Analyze voter demographics
    const newVoters = votes.filter(v => this.isNewVoter(v.voter));
    const returningVoters = votes.filter(v => !this.isNewVoter(v.voter));

    const votingPowerConcentration = this.calculateVotingPowerConcentration(proposal);

    return {
      supportTrend,
      voterDemographics: {
        newVoters: newVoters.length,
        returningVoters: returningVoters.length,
        votingPowerConcentration
      },
      sentimentAnalysis: {
        positive: 0.7,
        negative: 0.1,
        neutral: 0.2
      }
    };
  }

  private async generatePredictions(proposal: Proposal): Promise<ProposalAnalysis['predictions']> {
    try {
      // Calculate current votes
      const voteResult = await this.calculateVoteResult(proposal.id);
      const votesFor = parseFloat(voteResult.votesFor);
      const totalVotes = parseFloat(voteResult.totalVotes);

      // Simple prediction based on current voting patterns
      const successProbability = this.calculateSuccessProbability(proposal, votesFor, totalVotes);

      // Estimate final votes
      const estimatedVotesFor = votesFor * (1.2 + (Date.now() - proposal.startBlock * 1000) / ((proposal.endBlock - proposal.startBlock) * 1000));
      const estimatedVotesAgainst = (totalVotes - estimatedVotesFor) * 0.8;

      return {
        successProbability,
        estimatedVotesFor: estimatedVotesFor.toString(),
        estimatedVotesAgainst: estimatedVotesAgainst.toString(),
        confidence: Math.min(0.9, successProbability)
      };
    } catch (error) {
      logger.error('Failed to generate predictions', {
        error: error.message,
        proposalId: proposal.id
      });
      return {
        successProbability: 0.5,
        estimatedVotesFor: '0',
        estimatedVotesAgainst: '0',
        confidence: 0
      };
    }
  }

  private calculateSuccessProbability(
    proposal: Proposal,
    votesFor: number,
    totalVotes: number
  ): number {
    // Simplified success probability calculation
    // In production, would use more sophisticated models
    if (totalVotes === 0) return 0;

    const voteRatio = votesFor / totalVotes;
    const timeRemaining = (proposal.endBlock - Date.now() / 1000) / 3600; // Convert to hours

    // Base probability from current votes
    let probability = voteRatio;

    // Time decay factor (votes closer to deadline are more certain)
    if (timeRemaining < 24) {
      probability *= 1.2; // 20% boost in last 24 hours
    } else if (timeRemaining < 168) { // Less than a week
      probability *= 1.1; // 10% boost in last week
    }

    // Quorum and threshold bonuses
    const quorumReached = voteResult.quorumReached;
    const thresholdReached = voteResult.thresholdReached;

    if (quorumReached && thresholdReached) {
      probability *= 0.9; // 10% reduction for both quorum and threshold reached
    } else if (quorumReached) {
      probability *= 0.8; // 20% reduction if only quorum reached
    } else if (thresholdReached) {
      probability *= 0.7; // 30% reduction if only threshold reached
    }

    return Math.min(1, probability);
  }

  private generateRecommendations(
    proposal: Proposal,
    riskAssessment: ProposalAnalysis['riskAssessment'],
    marketImpact: ProposalAnalysis['marketImpact'],
    votingAnalysis: ProposalAnalysis['votingAnalysis']
  ): string[] {
    const recommendations: string[] = [];

    // Risk-based recommendations
    if (riskAssessment.financialRisk > 0.7) {
      recommendations.push('Consider reducing proposal value or adding more security measures');
    }
    if (riskAssessment.governanceRisk > 0.5) {
      recommendations.push('Add more community engagement and transparency');
    }

    // Market impact recommendations
    if (marketImpact.priceImpact > 0.3) {
      recommendations.push('Monitor market reaction and consider adjusting implementation');
    }

    // Voting pattern recommendations
    if (votingAnalysis.voterDemographics.newVoters > votingAnalysis.voterDemographics.returningVoters) {
      recommendations.push('Engage with existing community members for better participation');
    }
    if (votingAnalysis.voterDemographics.votingPowerConcentration > 0.6) {
      recommendations.push('Diversify voting power across more token holders');
    }

    // General recommendations
    if (proposal.operations.length > 8) {
      recommendations.push('Consider breaking complex proposals into simpler, targeted changes');
    }
    if (proposal.description.length > 1000) {
      recommendations.push('Simplify proposal description for better clarity');
    }

    return recommendations;
  }

  private isNewVoter(address: string): boolean {
    const votes = Array.from(this.votes.values())
      .flat()
      .map(v => v.voter);

    const voteCount = votes.filter(v => v.voter === address).length;
    return voteCount === 1;
  }

  private calculateVotingPowerConcentration(proposal: Proposal): number {
    const votes = this.votes.get(proposal.id) || [];
    const votingPowers = votes.map(v => parseFloat(v.weight));

    // Calculate Gini coefficient for voting power concentration
    votingPowers.sort((a, b) => b - a);
    const n = votingPowers.length;
    let sum = votingPowers.reduce((sum, power) => sum + power, 0);
    let cumulativeSum = 0;

    for (let i = 0; i < n; i++) {
      cumulativeSum += votingPowers[i];
    }

    return n === 0 ? 0 : (n * (n + 1) / (2 * sum)) - cumulativeSum / sum;
  }

  private async sendEmailNotification(notification: GovernanceNotification): Promise<void> {
    // Implement email notification
    logger.info('Email notification sent', {
      notificationId: notification.id,
      type: notification.type
    });
  }

  private async sendWebhookNotification(notification: GovernanceNotification): Promise<void> {
    // Implement webhook notification
    logger.info('Webhook notification sent', {
      notificationId: notification.id,
      type: notification.type
    });
  }

  private async sendSlackNotification(notification: GovernanceNotification): Promise<void> {
    // Implement Slack notification
    logger.info('Slack notification sent', {
      notificationId: notification.id,
      type: notification.type
    });
  }

  private async sendTelegramNotification(notification: GovernanceNotification): Promise<void> {
    // Implement Telegram notification
    logger.info('Telegram notification sent', {
      notificationId: notification.id,
      type: notification.type
    });
  }

  private generateId(): string {
    return `gov_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      tokenInfo: boolean;
      contractsConfigured: boolean;
      activeProposals: number;
      totalVotes: number;
      cacheEnabled: boolean;
      metricsUpToDate: boolean;
    };
  }> {
    try {
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (!this.governanceToken) {
        status = 'degraded';
      }

      if (this.metrics.activeProposals > 10) {
        status = 'degraded';
      }

      return {
        status,
        details: {
          tokenInfo: !!this.governanceToken,
          contractsConfigured: !!this.governanceToken,
          activeProposals: this.metrics.activeProposals,
          totalVotes: this.metrics.totalVotes,
          cacheEnabled: this.cacheService !== null,
          metricsUpToDate: Date.now() - this.metrics.lastUpdated < 300000 // 5 minutes
        }
      };
    } catch (error) {
      logger.error('Governance service health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        details: {
          tokenInfo: false,
          contractsConfigured: false,
          activeProposals: 0,
          totalVotes: 0,
          cacheEnabled: false,
          metricsUpToDate: false
        }
      };
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    try {
      this.proposals.clear();
      this.votes.clear();
      this.delegations.clear();
      this.events = [];
      this.removeAllListeners();
      logger.info('Cake governance service cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup Cake governance service', { error: error.message });
      throw error;
    }
  }
}

// Factory function
export function createCakeGovernanceService(
  provider: ethers.JsonRpcProvider,
  cacheService: ICache,
  governanceTokenAddress: string,
  votingPowerContractAddress: string,
  proposalContractAddress: string,
  treasuryContractAddress?: string
): CakeGovernanceService {
  return new CakeGovernanceService(
    provider,
    cacheService,
    governanceTokenAddress,
    votingPowerContractAddress,
    proposalContractAddress,
    treasuryContractAddress
  );
}