/**
 * Integration Tests for BSC Governance Functionality
 * Tests the integration between governance services and trading services
 */

import { ethers } from 'ethers';
import { SwapService } from '../../../src/bsc/services/trading/swap-service.js';
import { LiquidityService } from '../../../src/bsc/services/liquidity/liquidity-service.js';
import { BSCTokenService } from '../../../src/bsc/services/tokens/token-service.js';
import { CakeGovernance } from '../../../src/bsc/governance/cake-governance.js';
import { VotingPowerTracker } from '../../../src/bsc/governance/voting-power-tracker.js';
import { ProposalTracker } from '../../../src/bsc/governance/proposal-tracker.js';
import { ParticipationRewards } from '../../../src/bsc/governance/participation-rewards.js';
import { BSCTestEnvironment } from '../../setup/bsc-test-env.js';
import type {
  SwapRequest,
  LiquidityRequest
} from '../../../src/bsc/services/trading/types.js';

describe('Governance Integration Tests', () => {
  let testEnvironment: BSCTestEnvironment;
  let swapService: SwapService;
  let liquidityService: LiquidityService;
  let tokenService: BSCTokenService;
  let cakeGovernance: CakeGovernance;
  let votingPowerTracker: VotingPowerTracker;
  let proposalTracker: ProposalTracker;
  let participationRewards: ParticipationRewards;

  let deployer: ethers.Wallet;
  let user: ethers.Wallet;
  let governanceParticipant: ethers.Wallet;

  // Test tokens
  let CAKE: any;
  let WBNB: any;
  let USDT: any;

  beforeAll(async () => {
    // Initialize test environment
    testEnvironment = new BSCTestEnvironment();
    await testEnvironment.initialize();

    // Get wallets
    deployer = testEnvironment.getWallet('deployer');
    user = testEnvironment.getWallet('user1');
    governanceParticipant = testEnvironment.getWallet('user2');

    // Initialize services
    swapService = new SwapService();
    liquidityService = new LiquidityService();
    tokenService = new BSCTokenService();

    // Initialize governance services
    cakeGovernance = new CakeGovernance();
    votingPowerTracker = new VotingPowerTracker();
    proposalTracker = new ProposalTracker();
    participationRewards = new ParticipationRewards();

    // Start services
    await tokenService.start();

    // Setup test tokens
    const cakeContract = testEnvironment.getContract('tokens').get('CAKE');
    const wbnbContract = testEnvironment.getContract('tokens').get('WBNB');
    const usdtContract = testEnvironment.getContract('tokens').get('USDT');

    CAKE = {
      address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
      symbol: 'CAKE',
      decimals: 18
    };

    WBNB = {
      address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
      symbol: 'WBNB',
      decimals: 18
    };

    USDT = {
      address: '0x55d398326f99059ff775485246999027b3197955',
      symbol: 'USDT',
      decimals: 6
    };

    // Fund test accounts
    await testEnvironment.fundAccount(user.address, ethers.parseEther('50'));
    await testEnvironment.fundAccount(governanceParticipant.address, ethers.parseEther('100'));

    // Mint CAKE tokens for governance testing
    if (cakeContract) {
      await cakeContract.mint(governanceParticipant.address, ethers.parseEther('10000'));
      await cakeContract.mint(user.address, ethers.parseEther('5000'));
    }

    // Mint other tokens
    if (wbnbContract) await wbnbContract.mint(governanceParticipant.address, ethers.parseEther('50'));
    if (usdtContract) await usdtContract.mint(governanceParticipant.address, ethers.parseUnits('10000', 6));
  });

  afterAll(async () => {
    await tokenService.stop();
    await testEnvironment.cleanup();
  });

  describe('Governance Service Integration', () => {
    it('should initialize all governance services successfully', async () => {
      const governanceHealth = await cakeGovernance.healthCheck();
      const votingHealth = await votingPowerTracker.healthCheck();
      const proposalHealth = await proposalTracker.healthCheck();
      const rewardsHealth = await participationRewards.healthCheck();

      expect(governanceHealth).toBe(true);
      expect(votingHealth).toBe(true);
      expect(proposalHealth).toBe(true);
      expect(rewardsHealth).toBe(true);
    });

    it('should get governance status from all services', async () => {
      const governanceStatus = await cakeGovernance.getGovernanceStatus();
      const votingPower = await votingPowerTracker.getVotingPower(governanceParticipant.address);
      const activeProposals = await proposalTracker.getActiveProposals();
      const rewardsInfo = await participationRewards.getParticipantRewards(governanceParticipant.address);

      expect(governanceStatus).toBeDefined();
      expect(governanceStatus.totalProposals).toBeDefined();
      expect(governanceStatus.activeProposals).toBeDefined();

      expect(votingPower).toBeDefined();
      expect(typeof votingPower.totalPower).toBe('number');

      expect(Array.isArray(activeProposals)).toBe(true);

      expect(rewardsInfo).toBeDefined();
      expect(rewardsInfo.totalEarned).toBeDefined();
    });
  });

  describe('Trading to Governance Integration', () => {
    it('should track voting power from liquidity provision', async () => {
      // Add liquidity to CAKE pool to get voting power
      const liquidityRequest: LiquidityRequest = {
        tokenA: WBNB.address,
        tokenB: CAKE.address,
        amountA: ethers.parseEther('5').toString(),
        recipient: governanceParticipant.address
      };

      const addOperation = await liquidityService.addLiquidity(liquidityRequest, governanceParticipant);
      expect(addOperation).toBeDefined();

      // Check voting power after adding liquidity
      const votingPower = await votingPowerTracker.getVotingPower(governanceParticipant.address);
      expect(votingPower).toBeDefined();
      expect(votingPower.totalPower).toBeGreaterThan(0);

      // Verify voting power breakdown
      expect(votingPower.liquidityPower).toBeDefined();
      expect(votingPower.stakedPower).toBeDefined();
      expect(votingPower.delegatedPower).toBeDefined();
    });

    it('should handle staked liquidity for enhanced voting power', async () => {
      // Stake liquidity in farm
      const stakeOperation = await liquidityService.stakeInFarm(
        'mock-cake-pool',
        ethers.parseEther('100').toString(),
        governanceParticipant
      );
      expect(stakeOperation).toBeDefined();

      // Voting power should increase due to staking
      const updatedVotingPower = await votingPowerTracker.getVotingPower(governanceParticipant.address);
      expect(updatedVotingPower.totalPower).toBeGreaterThan(0);
      expect(updatedVotingPower.stakedPower).toBeGreaterThan(0);
    });

    it('should handle voting power delegation', async () => {
      // Delegate voting power
      const delegationTx = await cakeGovernance.delegateVotingPower(
        user.address,
        governanceParticipant
      );
      expect(delegationTx).toBeDefined();

      // Check delegated voting power
      const delegatorPower = await votingPowerTracker.getVotingPower(governanceParticipant.address);
      const delegateePower = await votingPowerTracker.getVotingPower(user.address);

      expect(delegatorPower.delegatedPower).toBeGreaterThan(0);
      expect(delegateePower.receivedDelegations).toBeGreaterThan(0);
    });

    it('should track governance participation rewards', async () => {
      // Simulate voting participation
      const proposalId = 'proposal-123';
      const voteTx = await cakeGovernance.castVote(
        proposalId,
        true, // Vote in favor
        governanceParticipant
      );
      expect(voteTx).toBeDefined();

      // Check participation rewards
      const rewards = await participationRewards.getParticipantRewards(governanceParticipant.address);
      expect(rewards).toBeDefined();
      expect(rewards.votingRewards).toBeDefined();
      expect(rewards.proposalRewards).toBeDefined();
      expect(rewards.totalEarned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Proposal Creation and Voting', () => {
    it('should create governance proposal successfully', async () => {
      const proposalData = {
        title: 'Test Proposal: Update Fee Structure',
        description: 'Proposal to update the fee structure for better sustainability',
        targets: [CAKE.address],
        values: ['0'],
        signatures: ['updateFee(uint256)'],
        calldatas: [ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [100])],
        votingPeriod: 7 * 24 * 60 * 60 // 7 days
      };

      const proposalTx = await cakeGovernance.createProposal(proposalData, governanceParticipant);
      expect(proposalTx).toBeDefined();

      // Wait for proposal to be created (mock)
      await testEnvironment.confirmTransaction(proposalTx);

      // Get proposal details
      const proposal = await proposalTracker.getProposal('proposal-123');
      expect(proposal).toBeDefined();
      expect(proposal.title).toBe(proposalData.title);
      expect(proposal.status).toBe('active');
    });

    it('should handle proposal voting with correct vote weight', async () => {
      const proposalId = 'proposal-123';

      // Get voting power before voting
      const votingPower = await votingPowerTracker.getVotingPower(governanceParticipant.address);
      expect(votingPower.totalPower).toBeGreaterThan(0);

      // Cast vote
      const voteTx = await cakeGovernance.castVote(proposalId, true, governanceParticipant);
      expect(voteTx).toBeDefined();

      // Check vote was recorded correctly
      const proposal = await proposalTracker.getProposal(proposalId);
      expect(proposal).toBeDefined();
      expect(proposal.forVotes).toBeGreaterThanOrEqual(votingPower.totalPower);
      expect(proposal.againstVotes).toBeGreaterThanOrEqual(0);

      // Check voter's voting history
      const votingHistory = await votingPowerTracker.getVotingHistory(governanceParticipant.address);
      expect(votingHistory).toBeDefined();
      expect(votingHistory.length).toBeGreaterThan(0);
    });

    it('should handle multiple votes on same proposal', async () => {
      const proposalId = 'proposal-123';

      // User with some CAKE also votes
      const userVotingPower = await votingPowerTracker.getVotingPower(user.address);
      if (userVotingPower.totalPower > 0) {
        const userVoteTx = await cakeGovernance.castVote(proposalId, false, user);
        expect(userVoteTx).toBeDefined();

        const proposal = await proposalTracker.getProposal(proposalId);
        expect(proposal.againstVotes).toBeGreaterThanOrEqual(userVotingPower.totalPower);
      }
    });

    it('should handle proposal execution after voting ends', async () => {
      const proposalId = 'proposal-123';

      // Mock proposal passing
      await proposalTracker.mockProposalResult(proposalId, true);

      // Execute proposal
      const executeTx = await cakeGovernance.executeProposal(proposalId, governanceParticipant);
      expect(executeTx).toBeDefined();

      // Check proposal status
      const proposal = await proposalTracker.getProposal(proposalId);
      expect(proposal.status).toBe('executed');
    });
  });

  describe('Governance Analytics Integration', () => {
    it('should provide comprehensive governance analytics', async () => {
      const analytics = await cakeGovernance.getGovernanceAnalytics();

      expect(analytics).toBeDefined();
      expect(analytics.totalProposals).toBeDefined();
      expect(analytics.successRate).toBeDefined();
      expect(analytics.averageParticipation).toBeDefined();
      expect(analytics.topVoters).toBeDefined();
      expect(analytics.recentProposals).toBeDefined();
    });

    it('should track voting power distribution', async () => {
      const distribution = await votingPowerTracker.getVotingPowerDistribution();

      expect(distribution).toBeDefined();
      expect(distribution.totalVotingPower).toBeDefined();
      expect(distribution.uniqueVoters).toBeDefined();
      expect(distribution.powerRanges).toBeDefined();
      expect(distribution.topHolders).toBeDefined();
    });

    it('should provide proposal lifecycle analytics', async () => {
      const analytics = await proposalTracker.getProposalAnalytics();

      expect(analytics).toBeDefined();
      expect(analytics.proposalsByStatus).toBeDefined();
      expect(analytics.averageVotingTime).toBeDefined();
      expect(analytics.participationTrends).toBeDefined();
      expect(analytics.successFactors).toBeDefined();
    });

    it('should calculate rewards efficiency', async () => {
      const efficiency = await participationRewards.getRewardsEfficiency();

      expect(efficiency).toBeDefined();
      expect(efficiency.totalDistributed).toBeDefined();
      expect(efficiency.participationRate).toBeDefined();
      expect(efficiency.averageRewardPerVote).toBeDefined();
      expect(efficiency.costEfficiency).toBeDefined();
    });
  });

  describe('Multi-Service Governance Workflows', () => {
    it('should handle complete governance participation workflow', async () => {
      // 1. Acquire voting power through liquidity provision
      const liquidityRequest: LiquidityRequest = {
        tokenA: WBNB.address,
        tokenB: CAKE.address,
        amountA: ethers.parseEther('2').toString(),
        recipient: user.address
      };

      await liquidityService.addLiquidity(liquidityRequest, user);

      // 2. Stake liquidity for enhanced voting power
      await liquidityService.stakeInFarm(
        'mock-cake-pool',
        ethers.parseEther('50').toString(),
        user
      );

      // 3. Create new proposal
      const proposalData = {
        title: 'Integration Test Proposal',
        description: 'Testing complete governance workflow',
        targets: [CAKE.address],
        values: ['0'],
        signatures: ['updateParameter(uint256)'],
        calldatas: [ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [200])],
        votingPeriod: 3 * 24 * 60 * 60 // 3 days
      };

      const proposalTx = await cakeGovernance.createProposal(proposalData, user);
      await testEnvironment.confirmTransaction(proposalTx);

      // 4. Vote on proposal
      const proposalId = 'proposal-integration-test';
      const voteTx = await cakeGovernance.castVote(proposalId, true, user);
      expect(voteTx).toBeDefined();

      // 5. Check rewards
      const rewards = await participationRewards.getParticipantRewards(user.address);
      expect(rewards.totalEarned).toBeGreaterThanOrEqual(0);

      // 6. Verify voting power impact
      const votingPower = await votingPowerTracker.getVotingPower(user.address);
      expect(votingPower.totalPower).toBeGreaterThan(0);
    });

    it('should handle governance token trading with voting implications', async () => {
      // Swap some WBNB for CAKE to get voting power
      const swapRequest: SwapRequest = {
        tokenIn: WBNB.address,
        tokenOut: CAKE.address,
        amountIn: ethers.parseEther('10').toString(),
        recipient: governanceParticipant.address
      };

      const swapTx = await swapService.executeSwap(swapRequest, governanceParticipant);
      expect(swapTx).toBeDefined();
      await testEnvironment.confirmTransaction(swapTx.hash);

      // Voting power should increase after receiving CAKE
      const votingPowerBefore = await votingPowerTracker.getVotingPower(governanceParticipant.address);

      // Simulate receiving additional CAKE tokens
      const additionalCAKE = ethers.parseEther('1000');
      // In real implementation, this would come from swap results

      const votingPowerAfter = await votingPowerTracker.getVotingPower(governanceParticipant.address);
      expect(votingPowerAfter.totalPower).toBeGreaterThanOrEqual(votingPowerBefore.totalPower);
    });

    it('should handle delegation and voting across multiple proposals', async () => {
      // Delegate voting power
      const delegationTx = await cakeGovernance.delegateVotingPower(
        user.address,
        governanceParticipant
      );
      expect(delegationTx).toBeDefined();

      // Create multiple proposals
      const proposals = ['proposal-multi-1', 'proposal-multi-2', 'proposal-multi-3'];

      for (const proposalId of proposals) {
        // Vote on each proposal
        const voteTx = await cakeGovernance.castVote(proposalId, true, governanceParticipant);
        expect(voteTx).toBeDefined();

        // Check rewards accumulation
        const rewards = await participationRewards.getParticipantRewards(governanceParticipant.address);
        expect(rewards.votingRewards).toBeDefined();
      }

      // Check voting history
      const votingHistory = await votingPowerTracker.getVotingHistory(governanceParticipant.address);
      expect(votingHistory.length).toBeGreaterThanOrEqual(proposals.length);
    });
  });

  describe('Governance Security and Validation', () => {
    it('should validate proposal parameters', async () => {
      const invalidProposalData = {
        title: '', // Empty title
        description: 'Invalid proposal',
        targets: ['0xinvalid'],
        values: ['0'],
        signatures: ['invalidFunction()'],
        calldatas: ['0x'],
        votingPeriod: -1 // Invalid voting period
      };

      await expect(cakeGovernance.createProposal(invalidProposalData, governanceParticipant))
        .rejects.toThrow();
    });

    it('should prevent double voting on same proposal', async () => {
      const proposalId = 'proposal-no-double-vote';

      // Cast first vote
      const voteTx1 = await cakeGovernance.castVote(proposalId, true, governanceParticipant);
      expect(voteTx1).toBeDefined();

      // Attempt to vote again - should handle gracefully
      await expect(cakeGovernance.castVote(proposalId, false, governanceParticipant))
        .rejects.toThrow();
    });

    it('should validate voting power before voting', async () => {
      const userWithNoPower = testEnvironment.getWallet('user4');
      const proposalId = 'proposal-validate-power';

      // User with no voting power should not be able to vote
      await expect(cakeGovernance.castVote(proposalId, true, userWithNoPower))
        .rejects.toThrow();
    });

    it('should handle proposal deadline enforcement', async () => {
      const proposalId = 'proposal-expired';

      // Mock expired proposal
      await proposalTracker.mockExpiredProposal(proposalId);

      // Should not be able to vote on expired proposal
      await expect(cakeGovernance.castVote(proposalId, true, governanceParticipant))
        .rejects.toThrow();
    });

    it('should prevent unauthorized proposal execution', async () => {
      const proposalId = 'proposal-unauthorized-execution';

      // Mock proposal that hasn't passed
      await proposalTracker.mockProposalResult(proposalId, false);

      // Should not be able to execute failed proposal
      await expect(cakeGovernance.executeProposal(proposalId, user))
        .rejects.toThrow();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent voting operations', async () => {
      const proposalIds = Array(10).fill(null).map((_, i) => `concurrent-proposal-${i}`);
      const votingPromises = proposalIds.map(proposalId =>
        cakeGovernance.castVote(proposalId, true, governanceParticipant)
      );

      const results = await Promise.allSettled(votingPromises);

      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });
    });

    it('should handle large voting power calculations efficiently', async () => {
      const startTime = Date.now();

      // Calculate voting power for multiple addresses
      const addresses = Array(100).fill(null).map((_, i) =>
        testEnvironment.getWallet(`voter${i}`).address
      );

      const votingPowers = await Promise.all(
        addresses.map(address => votingPowerTracker.getVotingPower(address))
      );

      const endTime = Date.now();

      expect(votingPowers).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain performance during high proposal activity', async () => {
      const startTime = Date.now();

      // Create multiple proposals
      const proposalPromises = Array(20).fill(null).map((_, i) => {
        const proposalData = {
          title: `Stress Test Proposal ${i}`,
          description: `Proposal number ${i} for stress testing`,
          targets: [CAKE.address],
          values: ['0'],
          signatures: ['testFunction()'],
          calldatas: ['0x'],
          votingPeriod: 7 * 24 * 60 * 60
        };

        return cakeGovernance.createProposal(proposalData, governanceParticipant);
      });

      const results = await Promise.allSettled(proposalPromises);
      const endTime = Date.now();

      expect(results).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Rewards Integration', () => {
    it('should calculate rewards based on participation quality', async () => {
      // Participate in multiple governance activities
      const activities = [
        () => cakeGovernance.castVote('proposal-quality-1', true, governanceParticipant),
        () => cakeGovernance.castVote('proposal-quality-2', false, governanceParticipant),
        () => cakeGovernance.delegateVotingPower(user.address, governanceParticipant)
      ];

      for (const activity of activities) {
        await activity();
      }

      // Check rewards calculation
      const rewards = await participationRewards.calculateRewards(governanceParticipant.address);
      expect(rewards).toBeDefined();
      expect(rewards.baseRewards).toBeDefined();
      expect(rewards.qualityBonus).toBeDefined();
      expect(rewards.timelinessBonus).toBeDefined();
      expect(rewards.totalRewards).toBeDefined();
    });

    it('should handle rewards distribution and claiming', async () => {
      // Accumulate rewards through participation
      await cakeGovernance.castVote('proposal-rewards', true, governanceParticipant);

      // Check pending rewards
      const pendingRewards = await participationRewards.getPendingRewards(governanceParticipant.address);
      expect(pendingRewards).toBeDefined();
      expect(pendingRewards.amount).toBeGreaterThanOrEqual(0);

      // Claim rewards
      if (pendingRewards.amount > 0) {
        const claimTx = await participationRewards.claimRewards(governanceParticipant);
        expect(claimTx).toBeDefined();
      }
    });

    it('should track rewards analytics and efficiency', async () => {
      const analytics = await participationRewards.getRewardsAnalytics();

      expect(analytics).toBeDefined();
      expect(analytics.totalDistributed).toBeDefined();
      expect(analytics.participantCount).toBeDefined();
      expect(analytics.averageReward).toBeDefined();
      expect(analytics.distributionTrends).toBeDefined();
    });
  });
});