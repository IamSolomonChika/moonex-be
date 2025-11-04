/**
 * BSC Yield Farming Schemas
 * JSON Schema definitions for BSC yield farming validation and operations
 */


// BSC-specific patterns
const ADDRESS_PATTERN = '^0x[a-fA-F0-9]{40}$';
const HASH_PATTERN = '^0x[a-fA-F0-9]{64}$';

/**
 * BSC Yield Farm Address Validation Schema
 */
export const BSCYieldFarmAddressSchema = {
  type: 'string',
  pattern: ADDRESS_PATTERN,
  minLength: 42,
  maxLength: 42,
  description: 'Valid BSC yield farm contract address'
};

/**
 * BSC Yield Farm Info Schema
 */
export const BSCYieldFarmInfoSchema = {
  type: 'object',
  required: ['id', 'address', 'lpToken', 'rewardToken'],
  properties: {
    id: {
      type: 'string',
      minLength: 1,
      description: 'Unique farm identifier'
    },
    address: BSCYieldFarmAddressSchema,
    lpToken: {
      type: 'string',
      pattern: ADDRESS_PATTERN,
      description: 'LP token address'
    },
    rewardToken: {
      type: 'string',
      pattern: ADDRESS_PATTERN,
      description: 'Reward token address (usually CAKE)'
    },
    pid: {
      type: 'integer',
      minimum: 0,
      description: 'Pool ID in MasterChef'
    },
    allocPoint: {
      type: 'integer',
      minimum: 0,
      description: 'Allocation points'
    },
    totalAllocPoint: {
      type: 'integer',
      minimum: 0,
      description: 'Total allocation points'
    },
    multiplier: {
      type: 'string',
      description: 'Reward multiplier (e.g., "40X")'
    },
    cakePerBlock: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'CAKE rewards per block'
    },
    lastRewardBlock: {
      type: 'integer',
      minimum: 0,
      description: 'Last reward block number'
    },
    accCakePerShare: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Accumulated CAKE per share'
    },
    // Token information
    lpTokenInfo: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'LP token symbol'
        },
        name: {
          type: 'string',
          description: 'LP token name'
        },
        decimals: {
          type: 'integer',
          minimum: 0,
          maximum: 18,
          description: 'LP token decimals'
        },
        token0: {
          type: 'string',
          pattern: ADDRESS_PATTERN,
          description: 'First token in pair'
        },
        token1: {
          type: 'string',
          pattern: ADDRESS_PATTERN,
          description: 'Second token in pair'
        },
        token0Symbol: {
          type: 'string',
          description: 'First token symbol'
        },
        token1Symbol: {
          type: 'string',
          description: 'Second token symbol'
        }
      }
    },
    rewardTokenInfo: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Reward token symbol'
        },
        name: {
          type: 'string',
          description: 'Reward token name'
        },
        decimals: {
          type: 'integer',
          minimum: 0,
          maximum: 18,
          description: 'Reward token decimals'
        },
        priceUSD: {
          type: 'number',
          minimum: 0,
          description: 'Reward token price in USD'
        }
      }
    },
    // Farm metrics
    totalLiquidity: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Total liquidity in LP tokens'
    },
    totalLiquidityUSD: {
      type: 'number',
      minimum: 0,
      description: 'Total liquidity in USD'
    },
    tvl: {
      type: 'number',
      minimum: 0,
      description: 'Total value locked in USD'
    },
    apr: {
      type: 'number',
      minimum: 0,
      description: 'Annual percentage rate'
    },
    apy: {
      type: 'number',
      minimum: 0,
      description: 'Annual percentage yield (including compounding)'
    },
    rewardApr: {
      type: 'number',
      minimum: 0,
      description: 'Reward token APR'
    },
    feeApr: {
      type: 'number',
      minimum: 0,
      description: 'Trading fee APR'
    },
    // Status and flags
    isActive: {
      type: 'boolean',
      description: 'Whether farm is currently active'
    },
    isFinished: {
      type: 'boolean',
      description: 'Whether farm rewards have finished'
    },
    isStable: {
      type: 'boolean',
      description: 'Whether farm contains stable coins'
    },
    isHot: {
      type: 'boolean',
      description: 'Whether farm is marked as hot'
    },
    isCAKEPool: {
      type: 'boolean',
      description: 'Whether farm is CAKE-only pool'
    },
    // Timing
    startBlock: {
      type: 'integer',
      minimum: 0,
      description: 'Farm start block'
    },
    endBlock: {
      type: 'integer',
      minimum: 0,
      description: 'Farm end block (if applicable)'
    },
    bonusEndBlock: {
      type: 'integer',
      minimum: 0,
      description: 'Bonus end block (if applicable)'
    },
    // Metadata
    category: {
      type: 'string',
      enum: ['stable', 'volatile', 'bluechip', 'defi', 'gaming', 'nft', 'launchpad', 'new', 'hot'],
      description: 'Farm category'
    },
    project: {
      type: 'string',
      description: 'Project name'
    },
    logoURI: {
      type: 'string',
      format: 'uri',
      description: 'Farm logo URI'
    },
    description: {
      type: 'string',
      maxLength: 500,
      description: 'Farm description'
    },
    createdAt: {
      type: 'integer',
      minimum: 0,
      description: 'Farm creation timestamp'
    },
    updatedAt: {
      type: 'integer',
      minimum: 0,
      description: 'Last update timestamp'
    }
  }
};

/**
 * BSC Yield Position Schema
 */
export const BSCYieldPositionSchema = {
  type: 'object',
  required: ['id', 'userAddress', 'farmId', 'amount'],
  properties: {
    id: {
      type: 'string',
      minLength: 1,
      description: 'Unique position identifier'
    },
    userAddress: {
      type: 'string',
      pattern: ADDRESS_PATTERN,
      description: 'Position owner address'
    },
    farmId: {
      type: 'string',
      minLength: 1,
      description: 'Farm identifier'
    },
    amount: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Amount staked in LP tokens'
    },
    valueUSD: {
      type: 'number',
      minimum: 0,
      description: 'Position value in USD'
    },
    valueBNB: {
      type: 'number',
      minimum: 0,
      description: 'Position value in BNB'
    },
    shares: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Position shares (for auto-compound vaults)'
    },
    // Position performance
    totalEarned: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Total rewards earned'
    },
    rewardEarned: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Reward tokens earned'
    },
    feeEarned: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Trading fees earned'
    },
    compoundEarned: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Earnings from compounding'
    },
    // Position metrics
    apr: {
      type: 'number',
      minimum: 0,
      description: 'Current APR'
    },
    apy: {
      type: 'number',
      minimum: 0,
      description: 'Current APY'
    },
    roi: {
      type: 'number',
      description: 'Return on investment percentage'
    },
    impermanentLoss: {
      type: 'number',
      description: 'Current impermanent loss'
    },
    // Position timing
    createdAt: {
      type: 'integer',
      minimum: 0,
      description: 'Position creation timestamp'
    },
    updatedAt: {
      type: 'integer',
      minimum: 0,
      description: 'Last update timestamp'
    },
    lastHarvestAt: {
      type: 'integer',
      minimum: 0,
      description: 'Last harvest timestamp'
    },
    duration: {
      type: 'integer',
      minimum: 0,
      description: 'Position duration in seconds'
    },
    // Position status
    isActive: {
      type: 'boolean',
      description: 'Whether position is currently active'
    },
    isAutoCompounding: {
      type: 'boolean',
      description: 'Whether position is auto-compounding'
    },
    isLocked: {
      type: 'boolean',
      description: 'Whether position is locked'
    },
    // Lock information
    lockEndsAt: {
      type: 'integer',
      minimum: 0,
      description: 'Lock end timestamp'
    },
    earlyWithdrawalFee: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Early withdrawal fee percentage'
    },
    // Farm type
    farmType: {
      type: 'string',
      enum: ['regular', 'syrup', 'autocompound', 'locked'],
      description: 'Farm type'
    },
    // Farm data
    farm: BSCYieldFarmInfoSchema
  }
};

/**
 * BSC Yield Operation Schema
 */
export const BSCYieldOperationSchema = {
  type: 'object',
  required: ['id', 'userAddress', 'farmId', 'type', 'amount'],
  properties: {
    id: {
      type: 'string',
      minLength: 1,
      description: 'Unique operation identifier'
    },
    userAddress: {
      type: 'string',
      pattern: ADDRESS_PATTERN,
      description: 'User wallet address'
    },
    farmId: {
      type: 'string',
      minLength: 1,
      description: 'Farm identifier'
    },
    poolId: {
      type: 'string',
      minLength: 1,
      description: 'Pool identifier'
    },
    type: {
      type: 'string',
      enum: ['deposit', 'withdraw', 'harvest', 'compound', 'emergency_withdraw', 'migrate', 'claim'],
      description: 'Operation type'
    },
    amount: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Operation amount'
    },
    valueUSD: {
      type: 'number',
      minimum: 0,
      description: 'Amount value in USD'
    },
    rewards: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Rewards from operation'
    },
    fees: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Fees from operation'
    },
    // Transaction details
    transactionHash: {
      type: 'string',
      pattern: HASH_PATTERN,
      description: 'Transaction hash'
    },
    blockNumber: {
      type: 'integer',
      minimum: 0,
      description: 'Block number'
    },
    timestamp: {
      type: 'integer',
      minimum: 0,
      description: 'Transaction timestamp'
    },
    gasUsed: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Gas used'
    },
    gasCostUSD: {
      type: 'number',
      minimum: 0,
      description: 'Gas cost in USD'
    },
    // Operation status
    status: {
      type: 'string',
      enum: ['pending', 'confirmed', 'failed'],
      description: 'Operation status'
    },
    confirmations: {
      type: 'integer',
      minimum: 0,
      description: 'Number of confirmations'
    },
    // Additional data
    metadata: {
      type: 'object',
      description: 'Additional operation metadata'
    }
  }
};

/**
 * BSC Yield Quote Schema
 */
export const BSCYieldQuoteSchema = {
  type: 'object',
  required: ['farmId', 'action', 'amount'],
  properties: {
    farmId: {
      type: 'string',
      minLength: 1,
      description: 'Farm identifier'
    },
    poolId: {
      type: 'string',
      minLength: 1,
      description: 'Pool identifier'
    },
    action: {
      type: 'string',
      enum: ['deposit', 'withdraw', 'harvest', 'compound'],
      description: 'Action type'
    },
    amount: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Operation amount'
    },
    valueUSD: {
      type: 'number',
      minimum: 0,
      description: 'Amount value in USD'
    },
    expectedShares: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Expected shares to receive'
    },
    expectedRewards: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Expected rewards'
    },
    // Performance
    expectedAPR: {
      type: 'number',
      minimum: 0,
      description: 'Expected APR'
    },
    expectedAPY: {
      type: 'number',
      minimum: 0,
      description: 'Expected APY'
    },
    lockDuration: {
      type: 'integer',
      minimum: 0,
      description: 'Lock duration in seconds'
    },
    earlyWithdrawalFee: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Early withdrawal fee percentage'
    },
    // Fees and costs
    depositFee: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Deposit fee percentage'
    },
    withdrawalFee: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Withdrawal fee percentage'
    },
    performanceFee: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Performance fee percentage'
    },
    gasEstimate: {
      type: 'object',
      required: ['gasLimit', 'gasPrice', 'estimatedCostBNB', 'estimatedCostUSD'],
      properties: {
        gasLimit: {
          type: 'string',
          pattern: '^\\d+$',
          description: 'Estimated gas limit'
        },
        gasPrice: {
          type: 'string',
          pattern: '^\\d+$',
          description: 'Estimated gas price'
        },
        estimatedCostBNB: {
          type: 'string',
          pattern: '^\\d+$',
          description: 'Estimated cost in BNB'
        },
        estimatedCostUSD: {
          type: 'string',
          description: 'Estimated cost in USD'
        }
      }
    },
    // Timing
    executionTime: {
      type: 'integer',
      minimum: 0,
      description: 'Expected execution time in seconds'
    },
    lockEndsAt: {
      type: 'integer',
      minimum: 0,
      description: 'Lock end timestamp'
    },
    // Risk assessment
    warnings: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'high_volatility',
          'low_liquidity',
          'contract_risk',
          'impermanent_loss',
          'high_gas',
          'long_lock',
          'high_fees',
          'concentration_risk',
          'new_pool',
          'unverified'
        ]
      },
      description: 'Risk warnings'
    },
    riskLevel: {
      type: 'string',
      enum: ['very_low', 'low', 'medium', 'high', 'very_high'],
      description: 'Risk level'
    },
    // Metadata
    timestamp: {
      type: 'integer',
      minimum: 0,
      description: 'Quote timestamp'
    },
    validUntil: {
      type: 'integer',
      minimum: 0,
      description: 'Quote expiration timestamp'
    },
    quoteId: {
      type: 'string',
      minLength: 1,
      description: 'Unique quote identifier'
    }
  }
};

/**
 * BSC Yield Strategy Schema
 */
export const BSCYieldStrategySchema = {
  type: 'object',
  required: ['id', 'name', 'category', 'allocations'],
  properties: {
    id: {
      type: 'string',
      minLength: 1,
      description: 'Unique strategy identifier'
    },
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Strategy name'
    },
    description: {
      type: 'string',
      maxLength: 500,
      description: 'Strategy description'
    },
    category: {
      type: 'string',
      enum: ['conservative', 'balanced', 'aggressive', 'income', 'growth', 'degen'],
      description: 'Strategy category'
    },
    // Strategy configuration
    farms: {
      type: 'array',
      items: {
        type: 'string'
      },
      description: 'Farm IDs in strategy'
    },
    allocations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['farmId', 'percentage'],
        properties: {
          farmId: {
            type: 'string',
            description: 'Farm identifier'
          },
          percentage: {
            type: 'number',
            minimum: 0,
            maximum: 100,
            description: 'Allocation percentage'
          }
        }
      },
      description: 'Farm allocations'
    },
    rebalanceFrequency: {
      type: 'integer',
      minimum: 1,
      description: 'Rebalance frequency in hours'
    },
    autoRebalance: {
      type: 'boolean',
      description: 'Whether to auto-rebalance'
    },
    // Performance metrics
    expectedAPR: {
      type: 'number',
      minimum: 0,
      description: 'Expected APR'
    },
    expectedAPY: {
      type: 'number',
      minimum: 0,
      description: 'Expected APY'
    },
    historicalReturn: {
      type: 'number',
      description: 'Historical return'
    },
    volatility: {
      type: 'number',
      minimum: 0,
      description: 'Expected volatility'
    },
    // Risk metrics
    riskLevel: {
      type: 'string',
      enum: ['very_low', 'low', 'medium', 'high', 'very_high'],
      description: 'Risk level'
    },
    maxDrawdown: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Maximum drawdown percentage'
    },
    diversificationScore: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Diversification score'
    },
    // Strategy settings
    minInvestment: {
      type: 'number',
      minimum: 0,
      description: 'Minimum investment amount'
    },
    maxInvestment: {
      type: 'number',
      minimum: 0,
      description: 'Maximum investment amount'
    },
    managementFee: {
      type: 'number',
      minimum: 0,
      maximum: 10,
      description: 'Management fee percentage'
    },
    performanceFee: {
      type: 'number',
      minimum: 0,
      maximum: 50,
      description: 'Performance fee percentage'
    },
    // Status and flags
    isActive: {
      type: 'boolean',
      description: 'Whether strategy is active'
    },
    isPublic: {
      type: 'boolean',
      description: 'Whether strategy is public'
    },
    requiresKYC: {
      type: 'boolean',
      description: 'Whether KYC is required'
    },
    // Metadata
    createdAt: {
      type: 'integer',
      minimum: 0,
      description: 'Strategy creation timestamp'
    },
    updatedAt: {
      type: 'integer',
      minimum: 0,
      description: 'Last update timestamp'
    },
    logoURI: {
      type: 'string',
      format: 'uri',
      description: 'Strategy logo URI'
    },
    manager: {
      type: 'string',
      description: 'Strategy manager'
    }
  }
};

/**
 * BSC Farm Performance Schema
 */
export const BSCFarmPerformanceSchema = {
  type: 'object',
  required: ['farmId', 'period'],
  properties: {
    farmId: {
      type: 'string',
      minLength: 1,
      description: 'Farm identifier'
    },
    period: {
      type: 'string',
      enum: ['1d', '7d', '30d', '90d', '1y'],
      description: 'Performance period'
    },
    // Performance metrics
    totalReturn: {
      type: 'number',
      description: 'Total return percentage'
    },
    annualizedReturn: {
      type: 'number',
      description: 'Annualized return percentage'
    },
    volatility: {
      type: 'number',
      minimum: 0,
      description: 'Volatility'
    },
    sharpeRatio: {
      type: 'number',
      description: 'Sharpe ratio'
    },
    maxDrawdown: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Maximum drawdown'
    },
    // Yield breakdown
    farmRewards: {
      type: 'number',
      description: 'Farm rewards return'
    },
    tradingFees: {
      type: 'number',
      description: 'Trading fees return'
    },
    compoundReturns: {
      type: 'number',
      description: 'Compound returns'
    },
    impermanentLoss: {
      type: 'number',
      description: 'Impermanent loss impact'
    },
    // Volume and liquidity
    totalVolume: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Total volume'
    },
    averageLiquidity: {
      type: 'number',
      minimum: 0,
      description: 'Average liquidity'
    },
    liquidityUtilization: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Liquidity utilization'
    },
    // User metrics
    totalUsers: {
      type: 'integer',
      minimum: 0,
      description: 'Total users'
    },
    activeUsers: {
      type: 'integer',
      minimum: 0,
      description: 'Active users'
    },
    newUsers: {
      type: 'integer',
      minimum: 0,
      description: 'New users'
    },
    averagePositionSize: {
      type: 'number',
      minimum: 0,
      description: 'Average position size'
    },
    // Risk metrics
    concentrationRisk: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Concentration risk score'
    },
    smartContractRisk: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Smart contract risk score'
    },
    tokenRisk: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Token risk score'
    },
    // Timestamps
    calculatedAt: {
      type: 'integer',
      minimum: 0,
      description: 'Calculation timestamp'
    },
    periodStart: {
      type: 'integer',
      minimum: 0,
      description: 'Period start timestamp'
    },
    periodEnd: {
      type: 'integer',
      minimum: 0,
      description: 'Period end timestamp'
    }
  }
};

/**
 * BSC Yield Farm Query Schema
 */
export const BSCYieldFarmQuerySchema = {
  type: 'object',
  properties: {
    category: {
      type: 'string',
      enum: ['stable', 'volatile', 'bluechip', 'defi', 'gaming', 'nft', 'launchpad', 'new', 'hot'],
      description: 'Filter by farm category'
    },
    isActive: {
      type: 'boolean',
      default: true,
      description: 'Filter by active status'
    },
    isStable: {
      type: 'boolean',
      description: 'Filter by stable coin farms'
    },
    isHot: {
      type: 'boolean',
      description: 'Filter by hot farms'
    },
    minAPR: {
      type: 'number',
      minimum: 0,
      description: 'Minimum APR'
    },
    minTVL: {
      type: 'number',
      minimum: 0,
      description: 'Minimum TVL in USD'
    },
    sortBy: {
      type: 'string',
      enum: ['apr', 'apy', 'tvl', 'liquidity', 'multiplier', 'createdAt', 'name'],
      default: 'apr',
      description: 'Sort field'
    },
    sortOrder: {
      type: 'string',
      enum: ['asc', 'desc'],
      default: 'desc',
      description: 'Sort order'
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 1000,
      default: 100,
      description: 'Maximum results to return'
    },
    offset: {
      type: 'integer',
      minimum: 0,
      default: 0,
      description: 'Number of results to skip'
    },
    farmType: {
      type: 'string',
      enum: ['regular', 'syrup', 'autocompound', 'locked'],
      description: 'Filter by farm type'
    },
    hasCAKE: {
      type: 'boolean',
      description: 'Filter by CAKE rewards'
    },
    hasAutoCompound: {
      type: 'boolean',
      description: 'Filter by auto-compound availability'
    }
  }
};

/**
 * Export all BSC yield schemas
 */
export const BSC_YIELD_SCHEMAS = {
  FARM_ADDRESS: BSCYieldFarmAddressSchema,
  FARM_INFO: BSCYieldFarmInfoSchema,
  POSITION: BSCYieldPositionSchema,
  OPERATION: BSCYieldOperationSchema,
  QUOTE: BSCYieldQuoteSchema,
  STRATEGY: BSCYieldStrategySchema,
  PERFORMANCE: BSCFarmPerformanceSchema,
  FARM_QUERY: BSCYieldFarmQuerySchema
};