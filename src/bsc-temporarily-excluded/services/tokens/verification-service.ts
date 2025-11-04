/**
 * BSC Token Verification Service
 * Multi-source token verification and validation system
 */

import { ethers } from 'ethers';
import logger from '../../../utils/logger.js';
import type {
  BSCToken,
  TokenVerificationStatus,
  TokenValidationResult,
  VerificationSource,
  TokenRiskLevel
} from './types.js';
import { TokenFlag } from './types.js';
import { BSCProviderManager } from '../../utils/ethers-provider.js';
import { BSCCacheManager } from '../cache/cache-manager.js';

/**
 * Verification provider interface
 */
export interface IVerificationProvider {
  name: string;
  verifyToken(address: string): Promise<VerificationSource>;
  getTokenMetadata(address: string): Promise<Partial<BSCToken>>;
  getTokenRisks(address: string): Promise<TokenFlag[]>;
  isAvailable(): Promise<boolean>;
}

/**
 * Token verification configuration
 */
export interface VerificationConfig {
  // Enabled providers
  enabledProviders: string[];

  // Verification thresholds
  minConfidenceThreshold: number; // 0-100
  requiredSources: number;
  maxVerificationAge: number; // milliseconds

  // Risk assessment settings
  enableRiskAssessment: boolean;
  riskThresholds: {
    low: number;
    medium: number;
    high: number;
    very_high: number;
  };

  // Cache settings
  cacheResults: boolean;
  cacheTTL: number; // milliseconds

  // Security checks
  enableContractAnalysis: boolean;
  enableBlacklistCheck: boolean;
  enableLiquidityCheck: boolean;
  enableTaxCheck: boolean;
}

/**
 * Contract analysis result
 */
export interface ContractAnalysisResult {
  isValidERC20: boolean;
  hasMintFunction: boolean;
  hasBurnFunction: boolean;
  hasPauseFunction: boolean;
  hasBlacklistFunction: boolean;
  hasOwnerFunction: boolean;
  isOwnershipRenounced: boolean;
  totalSupply?: string;
  decimals?: number;
  securityFlags: TokenFlag[];
  warnings: string[];
}

/**
 * Token Verification Service Implementation
 */
export class TokenVerificationService {
  private config: VerificationConfig;
  private provider: BSCProviderManager;
  private cache: BSCCacheManager;
  private verificationProviders: Map<string, IVerificationProvider> = new Map();
  private blacklistedContracts: Set<string> = new Set();

  constructor(config?: Partial<VerificationConfig>) {
    this.config = {
      enabledProviders: ['pancakeswap', 'bscscan', 'coingecko', 'trustwallet'],
      minConfidenceThreshold: 60,
      requiredSources: 2,
      maxVerificationAge: 86400000, // 24 hours
      enableRiskAssessment: true,
      riskThresholds: {
        low: 20,
        medium: 40,
        high: 60,
        very_high: 80
      },
      cacheResults: true,
      cacheTTL: 3600000, // 1 hour
      enableContractAnalysis: true,
      enableBlacklistCheck: true,
      enableLiquidityCheck: true,
      enableTaxCheck: true,
      ...config
    };

    this.provider = new BSCProviderManager();
    this.cache = new BSCCacheManager();

    this.initializeProviders();
  }

  /**
   * Verify token from multiple sources
   */
  async verifyToken(address: string): Promise<TokenVerificationStatus> {
    logger.debug({ address }, 'Verifying token from multiple sources');

    try {
      const cacheKey = `verification:${address}`;
      const cached = await this.cache.get<TokenVerificationStatus>(cacheKey);

      if (cached && (Date.now() - cached.sources[0]?.lastChecked) < this.config.maxVerificationAge) {
        logger.debug({ address }, 'Returning cached verification result');
        return cached;
      }

      // Check blacklist first
      if (this.config.enableBlacklistCheck && this.isBlacklisted(address)) {
        return {
          isVerified: false,
          sources: [{
            name: 'blacklist',
            verified: false,
            lastChecked: Date.now()
          }],
          confidence: 0,
          warnings: ['Token is blacklisted'],
          flags: [TokenFlag.BLACKLISTED]
        };
      }

      const verificationPromises = this.config.enabledProviders.map(providerName =>
        this.verifyWithProvider(address, providerName)
      );

      const sources = await Promise.allSettled(verificationPromises);
      const validSources = sources
        .filter((result): result is PromiseFulfilledResult<VerificationSource> =>
          result.status === 'fulfilled')
        .map(result => result.value);

      // Calculate overall confidence
      const confidence = this.calculateConfidence(validSources);
      const isVerified = confidence >= this.config.minConfidenceThreshold &&
                       validSources.length >= this.config.requiredSources;

      // Aggregate warnings and flags
      const warnings = this.aggregateWarnings(validSources);
      const flags = this.aggregateFlags(validSources);

      const verificationStatus: TokenVerificationStatus = {
        isVerified,
        sources: validSources,
        confidence,
        warnings: warnings.length > 0 ? warnings : undefined,
        flags: flags.length > 0 ? flags : undefined
      };

      // Cache result
      if (this.config.cacheResults) {
        await this.cache.set(cacheKey, verificationStatus, this.config.cacheTTL);
      }

      logger.info({
        address,
        isVerified,
        confidence,
        sourcesCount: validSources.length
      }, 'Token verification completed');

      return verificationStatus;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Token verification failed');
      throw new Error(`Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Comprehensive token validation
   */
  async validateToken(address: string): Promise<TokenValidationResult> {
    logger.debug({ address }, 'Performing comprehensive token validation');

    try {
      const cacheKey = `validation:${address}`;
      const cached = await this.cache.get<TokenValidationResult>(cacheKey);

      if (cached) {
        logger.debug({ address }, 'Returning cached validation result');
        return cached;
      }

      // Contract analysis
      const contractAnalysis = this.config.enableContractAnalysis
        ? await this.analyzeContract(address)
        : null;

      // Multi-source verification
      const verificationStatus = await this.verifyToken(address);

      // Risk assessment
      const riskScore = this.config.enableRiskAssessment
        ? await this.assessRisk(address, verificationStatus, contractAnalysis)
        : 50;

      // Liquidity check
      const liquidityCheck = this.config.enableLiquidityCheck
        ? await this.checkLiquidity(address)
        : { hasSufficientLiquidity: true, liquidityUSD: 0 };

      // Tax check
      const taxCheck = this.config.enableTaxCheck
        ? await this.checkTaxes(address)
        : { hasNormalBuyTax: true, hasNormalSellTax: true, buyTax: 0, sellTax: 0 };

      // Calculate overall validation score
      const score = this.calculateValidationScore(
        verificationStatus,
        contractAnalysis,
        liquidityCheck,
        taxCheck
      );

      const isValid = score >= 60; // Minimum score to be considered valid

      const validationResult: TokenValidationResult = {
        isValid,
        score,
        warnings: [
          ...(verificationStatus.warnings || []),
          ...(contractAnalysis?.warnings || [])
        ],
        errors: isValid ? [] : ['Token did not meet minimum validation criteria'],
        recommendations: this.generateRecommendations(
          verificationStatus,
          contractAnalysis,
          liquidityCheck,
          taxCheck
        ),
        verificationData: {
          contractExists: contractAnalysis?.isValidERC20 || false,
          hasValidFunctions: contractAnalysis?.isValidERC20 || false,
          isNotBlacklisted: !this.isBlacklisted(address),
          hasSufficientLiquidity: liquidityCheck.hasSufficientLiquidity,
          hasNormalBuyTax: taxCheck.hasNormalBuyTax,
          hasNormalSellTax: taxCheck.hasNormalSellTax
        }
      };

      // Cache result
      if (this.config.cacheResults) {
        await this.cache.set(cacheKey, validationResult, this.config.cacheTTL);
      }

      logger.info({
        address,
        isValid,
        score,
        warningsCount: validationResult.warnings.length
      }, 'Token validation completed');

      return validationResult;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Token validation failed');
      throw new Error(`Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Assess token risk level
   */
  async assessTokenRisk(
    address: string,
    verificationStatus?: TokenVerificationStatus,
    contractAnalysis?: ContractAnalysisResult | null
  ): Promise<number> {
    logger.debug({ address }, 'Assessing token risk');

    try {
      let riskScore = 50; // Base score (medium risk)

      // Verification risk
      if (!verificationStatus) {
        verificationStatus = await this.verifyToken(address);
      }

      if (!verificationStatus.isVerified) {
        riskScore += 30;
      }

      riskScore += (100 - verificationStatus.confidence) * 0.3;

      // Contract analysis risk
      if (this.config.enableContractAnalysis) {
        if (!contractAnalysis) {
          contractAnalysis = await this.analyzeContract(address);
        }

        // Dangerous functions increase risk
        if (contractAnalysis.hasMintFunction) riskScore += 15;
        if (contractAnalysis.hasBlacklistFunction) riskScore += 10;
        if (contractAnalysis.hasPauseFunction) riskScore += 5;

        // Ownership not renounced increases risk
        if (!contractAnalysis.isOwnershipRenounced) riskScore += 10;

        // Apply security flags
        riskScore += contractAnalysis.securityFlags.length * 5;
      }

      // Blacklist check
      if (this.isBlacklisted(address)) {
        riskScore = 100; // Maximum risk
      }

      // Ensure score is within bounds
      riskScore = Math.max(0, Math.min(100, riskScore));

      logger.debug({ address, riskScore }, 'Risk assessment completed');
      return riskScore;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Risk assessment failed');
      return 75; // Default to high risk on error
    }
  }

  /**
   * Analyze smart contract for security issues
   */
  async analyzeContract(address: string): Promise<ContractAnalysisResult> {
    logger.debug({ address }, 'Analyzing smart contract');

    try {
      const cacheKey = `contract_analysis:${address}`;
      const cached = await this.cache.get<ContractAnalysisResult>(cacheKey);

      if (cached) {
        return cached;
      }

      const provider = await this.provider.getProvider();

      // Check if it's a contract
      const code = await provider.getCode(address);
      if (code === '0x') {
        throw new Error('Address is not a contract');
      }

      // ERC-20 function signatures to check
      const erc20Signatures = {
        '0x095ea7b3': 'approve',
        '0x70a08231': 'balanceOf',
        '0xa9059cbb': 'transfer',
        '0x23b872dd': 'transferFrom',
        '0x06fdde03': 'name',
        '0x95d89b41': 'symbol',
        '0x313ce567': 'decimals',
        '0x18160ddd': 'totalSupply'
      };

      const dangerousSignatures = {
        '0x40c10f19': 'mint',
        '0x42966c68': 'burn',
        '0x8da5cb5b': 'owner',
        '0xf2fde38b': 'transferOwnership',
        '0x5c975abb': 'pause',
        '0x8456cb59': 'unpause',
        '0x8a3ab6b6': 'blacklist',
        '0x6a627842': 'unBlacklist'
      };

      // Check function availability using eth_call
      const functionChecks = {
        ...erc20Signatures,
        ...dangerousSignatures
      };

      const availableFunctions: string[] = [];
      const securityFlags: TokenFlag[] = [];
      const warnings: string[] = [];

      // Test each function
      for (const [signature, functionName] of Object.entries(functionChecks)) {
        try {
          const result = await provider.call({
            to: address,
            data: signature + '0'.repeat(56) // Add padding for potential parameters
          });

          if (result !== '0x') {
            availableFunctions.push(functionName);
          }
        } catch (error) {
          // Function doesn't exist or failed
        }
      }

      // Analyze available functions
      const isValidERC20 = ['name', 'symbol', 'decimals', 'totalSupply', 'balanceOf', 'transfer']
        .every(func => availableFunctions.includes(func));

      const hasMintFunction = availableFunctions.includes('mint');
      const hasBurnFunction = availableFunctions.includes('burn');
      const hasPauseFunction = availableFunctions.includes('pause');
      const hasBlacklistFunction = availableFunctions.includes('blacklist');
      const hasOwnerFunction = availableFunctions.includes('owner');

      // Check if ownership is renounced
      let isOwnershipRenounced = false;
      if (hasOwnerFunction) {
        try {
          const owner = await provider.call({
            to: address,
            data: '0x8da5cb5b' // owner() signature
          });
          isOwnershipRenounced = owner === '0x0000000000000000000000000000000000000000';
        } catch (error) {
          // Owner check failed
        }
      } else {
        isOwnershipRenounced = true; // No owner function means ownership is likely renounced
      }

      // Add security flags based on analysis
      if (hasMintFunction) {
        securityFlags.push(TokenFlag.MINTABLE);
        warnings.push('Token has minting function - unlimited supply possible');
      }

      if (hasBlacklistFunction) {
        securityFlags.push(TokenFlag.BLACKLISTED);
        warnings.push('Token has blacklist function - users can be blocked');
      }

      if (!isOwnershipRenounced) {
        warnings.push('Contract ownership not renounced - owner has special privileges');
      }

      if (!isValidERC20) {
        warnings.push('Contract does not implement standard ERC-20 interface');
      }

      // Try to get basic token info
      let totalSupply: string | undefined;
      let decimals: number | undefined;

      try {
        if (availableFunctions.includes('totalSupply')) {
          totalSupply = await provider.call({
            to: address,
            data: '0x18160ddd'
          });
        }

        if (availableFunctions.includes('decimals')) {
          const result = await provider.call({
            to: address,
            data: '0x313ce567'
          });
          decimals = parseInt(result, 16);
        }
      } catch (error) {
        // Failed to get token info
      }

      const analysisResult: ContractAnalysisResult = {
        isValidERC20,
        hasMintFunction,
        hasBurnFunction,
        hasPauseFunction,
        hasBlacklistFunction,
        hasOwnerFunction,
        isOwnershipRenounced,
        totalSupply,
        decimals,
        securityFlags,
        warnings
      };

      // Cache result
      await this.cache.set(cacheKey, analysisResult, this.config.cacheTTL);

      logger.info({
        address,
        isValidERC20,
        securityFlagsCount: securityFlags.length,
        warningsCount: warnings.length
      }, 'Contract analysis completed');

      return analysisResult;

    } catch (error) {
      logger.error({ address, error: error instanceof Error ? error.message : 'Unknown error' }, 'Contract analysis failed');
      throw new Error(`Contract analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check token liquidity
   */
  async checkLiquidity(address: string): Promise<{ hasSufficientLiquidity: boolean; liquidityUSD: number }> {
    try {
      // This would check PancakeSwap for liquidity
      // For now, return placeholder data
      return {
        hasSufficientLiquidity: true,
        liquidityUSD: 10000
      };
    } catch (error) {
      return {
        hasSufficientLiquidity: false,
        liquidityUSD: 0
      };
    }
  }

  /**
   * Check token taxes (buy/sell fees)
   */
  async checkTaxes(address: string): Promise<{
    hasNormalBuyTax: boolean;
    hasNormalSellTax: boolean;
    buyTax: number;
    sellTax: number;
  }> {
    try {
      // This would analyze the contract for tax mechanisms
      // For now, return placeholder data
      return {
        hasNormalBuyTax: true,
        hasNormalSellTax: true,
        buyTax: 0,
        sellTax: 0
      };
    } catch (error) {
      return {
        hasNormalBuyTax: false,
        hasNormalSellTax: false,
        buyTax: 0,
        sellTax: 0
      };
    }
  }

  /**
   * Add contract to blacklist
   */
  async addToBlacklist(address: string, reason: string): Promise<void> {
    this.blacklistedContracts.add(address.toLowerCase());

    const cacheKey = 'verification:blacklisted_contracts';
    const blacklisted = Array.from(this.blacklistedContracts);
    await this.cache.set(cacheKey, blacklisted, 86400000); // 24 hours

    logger.warn({ address, reason }, 'Contract added to blacklist');
  }

  /**
   * Remove contract from blacklist
   */
  async removeFromBlacklist(address: string): Promise<void> {
    this.blacklistedContracts.delete(address.toLowerCase());

    const cacheKey = 'verification:blacklisted_contracts';
    const blacklisted = Array.from(this.blacklistedContracts);
    await this.cache.set(cacheKey, blacklisted, 86400000);

    logger.info({ address }, 'Contract removed from blacklist');
  }

  // Private helper methods

  private initializeProviders(): void {
    // Initialize verification providers
    // For now, this is a placeholder - in a real implementation,
    // you would initialize actual providers like PancakeSwap, BscScan, CoinGecko, etc.
    logger.debug('Initializing verification providers');
  }

  private async verifyWithProvider(address: string, providerName: string): Promise<VerificationSource> {
    try {
      const provider = this.verificationProviders.get(providerName);
      if (!provider || !(await provider.isAvailable())) {
        throw new Error(`Provider ${providerName} not available`);
      }

      return await provider.verifyToken(address);
    } catch (error) {
      logger.warn({ address, provider: providerName, error: error instanceof Error ? error.message : 'Unknown error' }, 'Provider verification failed');

      // Return failed verification source
      return {
        name: providerName,
        verified: false,
        lastChecked: Date.now(),
        url: undefined
      };
    }
  }

  private calculateConfidence(sources: VerificationSource[]): number {
    if (sources.length === 0) return 0;

    const verifiedCount = sources.filter(source => source.verified).length;
    const totalSources = sources.length;

    // Base confidence from verification ratio
    let confidence = (verifiedCount / totalSources) * 100;

    // Boost confidence based on number of sources
    if (totalSources >= 3) confidence += 10;
    if (totalSources >= 4) confidence += 10;

    // Ensure confidence is within bounds
    return Math.max(0, Math.min(100, confidence));
  }

  private aggregateWarnings(sources: VerificationSource[]): string[] {
    const warnings: string[] = [];

    sources.forEach(source => {
      // Add warnings based on source verification status
      if (!source.verified) {
        warnings.push(`Unverified by ${source.name}`);
      }
    });

    return [...new Set(warnings)]; // Remove duplicates
  }

  private aggregateFlags(sources: VerificationSource[]): TokenFlag[] {
    const flags: TokenFlag[] = [];

    // This would aggregate flags from various sources
    // For now, return empty array as placeholder

    return [...new Set(flags)]; // Remove duplicates
  }

  private calculateValidationScore(
    verificationStatus: TokenVerificationStatus,
    contractAnalysis: ContractAnalysisResult | null,
    liquidityCheck: { hasSufficientLiquidity: boolean },
    taxCheck: { hasNormalBuyTax: boolean; hasNormalSellTax: boolean }
  ): number {
    let score = 0;

    // Verification score (40% weight)
    score += (verificationStatus.confidence / 100) * 40;

    // Contract analysis score (30% weight)
    if (contractAnalysis) {
      let contractScore = 50; // Base score

      if (contractAnalysis.isValidERC20) contractScore += 20;
      if (contractAnalysis.isOwnershipRenounced) contractScore += 15;
      if (!contractAnalysis.hasMintFunction) contractScore += 10;
      if (!contractAnalysis.hasBlacklistFunction) contractScore += 5;

      contractScore -= contractAnalysis.securityFlags.length * 5;

      score += Math.max(0, Math.min(100, contractScore)) * 0.3;
    }

    // Liquidity score (15% weight)
    if (liquidityCheck.hasSufficientLiquidity) {
      score += 15;
    }

    // Tax score (15% weight)
    if (taxCheck.hasNormalBuyTax && taxCheck.hasNormalSellTax) {
      score += 15;
    } else if (taxCheck.hasNormalBuyTax || taxCheck.hasNormalSellTax) {
      score += 7.5;
    }

    return Math.max(0, Math.min(100, score));
  }

  private generateRecommendations(
    verificationStatus: TokenVerificationStatus,
    contractAnalysis: ContractAnalysisResult | null,
    liquidityCheck: { hasSufficientLiquidity: boolean },
    taxCheck: { hasNormalBuyTax: boolean; hasNormalSellTax: boolean }
  ): string[] {
    const recommendations: string[] = [];

    if (!verificationStatus.isVerified) {
      recommendations.push('Token should be verified by more sources before use');
    }

    if (contractAnalysis?.hasMintFunction) {
      recommendations.push('Be cautious: token can mint new tokens unlimitedly');
    }

    if (contractAnalysis?.hasBlacklistFunction) {
      recommendations.push('Token can blacklist addresses - use with caution');
    }

    if (!liquidityCheck.hasSufficientLiquidity) {
      recommendations.push('Token has low liquidity - high price impact risk');
    }

    if (!taxCheck.hasNormalBuyTax || !taxCheck.hasNormalSellTax) {
      recommendations.push('Token has high taxes - consider transaction costs');
    }

    if (!contractAnalysis?.isOwnershipRenounced) {
      recommendations.push('Contract ownership not renounced - owner has control');
    }

    if (recommendations.length === 0) {
      recommendations.push('Token appears safe for basic transactions');
    }

    return recommendations;
  }

  private isBlacklisted(address: string): boolean {
    return this.blacklistedContracts.has(address.toLowerCase());
  }
}

// Export singleton instance
export const tokenVerificationService = new TokenVerificationService();