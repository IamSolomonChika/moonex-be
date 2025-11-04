/**
 * BSC Liquidity Pool Schemas
 * JSON Schema definitions for BSC liquidity pool validation and operations
 */


// BSC-specific patterns
const ADDRESS_PATTERN = '^0x[a-fA-F0-9]{40}$';
const HASH_PATTERN = '^0x[a-fA-F0-9]{64}$';

/**
 * BSC Pool Address Validation Schema
 */
export const BSCPoolAddressSchema = {
  type: 'string',
  pattern: ADDRESS_PATTERN,
  minLength: 42,
  maxLength: 42,
  description: 'Valid BSC liquidity pool contract address'
};

/**
 * BSC Pool Pair Info Schema
 */
export const BSCPoolPairInfoSchema = {
  type: 'object',
  required: ['address', 'token0', 'token1'],
  properties: {
    address: BSCPoolAddressSchema,
    token0: {
      type: 'string',
      pattern: ADDRESS_PATTERN,
      description: 'First token address'
    },
    token1: {
      type: 'string',
      pattern: ADDRESS_PATTERN,
      description: 'Second token address'
    },
    token0Symbol: {
      type: 'string',
      minLength: 2,
      maxLength: 10,
      description: 'First token symbol'
    },
    token1Symbol: {
      type: 'string',
      minLength: 2,
      maxLength: 10,
      description: 'Second token symbol'
    },
    token0Decimals: {
      type: 'integer',
      minimum: 0,
      maximum: 18,
      description: 'First token decimals'
    },
    token1Decimals: {
      type: 'integer',
      minimum: 0,
      maximum: 18,
      description: 'Second token decimals'
    },
    reserve0: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Reserve of token0'
    },
    reserve1: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Reserve of token1'
    },
    totalSupply: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Total LP tokens supply'
    },
    fee: {
      type: 'integer',
      enum: [0, 500, 3000, 10000],
      description: 'Pool fee tier (V3 only): 0=V2, 500=0.05%, 3000=0.3%, 10000=1%'
    },
    tickSpacing: {
      type: 'integer',
      description: 'Tick spacing (V3 only)'
    },
    protocol: {
      type: 'string',
      enum: ['pancakeswap', 'uniswap', 'sushiswap'],
      default: 'pancakeswap',
      description: 'DEX protocol'
    },
    version: {
      type: 'string',
      enum: ['v2', 'v3'],
      description: 'Protocol version'
    }
  }
};

/**
 * BSC Liquidity Position Schema
 */
export const BSCLiquidityPositionSchema = {
  type: 'object',
  required: ['id', 'poolAddress', 'userAddress', 'liquidity'],
  properties: {
    id: {
      type: 'string',
      minLength: 1,
      description: 'Unique position identifier'
    },
    poolAddress: BSCPoolAddressSchema,
    userAddress: {
      type: 'string',
      pattern: ADDRESS_PATTERN,
      description: 'Position owner address'
    },
    liquidity: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'LP token amount'
    },
    amount0: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Amount of token0 in position'
    },
    amount1: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Amount of token1 in position'
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
    shareOfPool: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Percentage of pool owned'
    },
    uncollectedFees0: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Uncollected fees of token0 (V3)'
    },
    uncollectedFees1: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Uncollected fees of token1 (V3)'
    },
    feeAPR: {
      type: 'number',
      minimum: 0,
      description: 'Annualized fee return rate'
    },
    impermanentLoss: {
      type: 'number',
      description: 'Impermanent loss percentage'
    },
    netAPR: {
      type: 'number',
      description: 'Net APR after impermanent loss'
    },
    // V3 specific properties
    tickLower: {
      type: 'integer',
      description: 'Lower tick of position (V3)'
    },
    tickUpper: {
      type: 'integer',
      description: 'Upper tick of position (V3)'
    },
    feeTier: {
      type: 'integer',
      enum: [500, 3000, 10000],
      description: 'Fee tier (V3)'
    },
    isActive: {
      type: 'boolean',
      description: 'Whether position is currently active'
    },
    inRange: {
      type: 'boolean',
      description: 'Whether current price is within range (V3)'
    },
    createdAt: {
      type: 'integer',
      minimum: 0,
      description: 'Position creation timestamp'
    },
    updatedAt: {
      type: 'integer',
      minimum: 0,
      description: 'Last update timestamp'
    }
  }
};

/**
 * BSC Liquidity Pool Metrics Schema
 */
export const BSCPoolMetricsSchema = {
  type: 'object',
  required: ['address'],
  properties: {
    address: BSCPoolAddressSchema,
    totalLiquidityUSD: {
      type: 'number',
      minimum: 0,
      description: 'Total liquidity in USD'
    },
    totalLiquidityBNB: {
      type: 'number',
      minimum: 0,
      description: 'Total liquidity in BNB'
    },
    volume24hUSD: {
      type: 'number',
      minimum: 0,
      description: '24-hour trading volume in USD'
    },
    volume24hBNB: {
      type: 'number',
      minimum: 0,
      description: '24-hour trading volume in BNB'
    },
    volume7dUSD: {
      type: 'number',
      minimum: 0,
      description: '7-day trading volume in USD'
    },
    fees24hUSD: {
      type: 'number',
      minimum: 0,
      description: '24-hour fees generated in USD'
    },
    apr: {
      type: 'number',
      minimum: 0,
      description: 'Annual percentage rate from fees'
    },
    apy: {
      type: 'number',
      minimum: 0,
      description: 'Annual percentage yield (including compounding)'
    },
    feeAPR: {
      type: 'number',
      minimum: 0,
      description: 'Fee-only APR'
    },
    rewardAPR: {
      type: 'number',
      minimum: 0,
      description: 'Reward APR (if farm)'
    },
    price0: {
      type: 'number',
      minimum: 0,
      description: 'Price of token0 in USD'
    },
    price1: {
      type: 'number',
      minimum: 0,
      description: 'Price of token1 in USD'
    },
    price: {
      type: 'number',
      minimum: 0,
      description: 'Current pool price (token1/token0)'
    },
    priceChange24h: {
      type: 'number',
      description: '24-hour price change'
    },
    priceChangePercent24h: {
      type: 'number',
      description: '24-hour price change percentage'
    },
    utilization: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Pool utilization rate (0-1)'
    },
    tvlChange24h: {
      type: 'number',
      description: '24-hour TVL change'
    },
    tvlChangePercent24h: {
      type: 'number',
      description: '24-hour TVL change percentage'
    },
    holderCount: {
      type: 'integer',
      minimum: 0,
      description: 'Number of LP token holders'
    },
    transactionCount24h: {
      type: 'integer',
      minimum: 0,
      description: '24-hour transaction count'
    },
    averageTransactionSize24h: {
      type: 'number',
      minimum: 0,
      description: 'Average transaction size in USD'
    },
    impermanentLoss24h: {
      type: 'number',
      description: '24-hour impermanent loss'
    },
    volatility24h: {
      type: 'number',
      minimum: 0,
      description: '24-hour price volatility'
    },
    lastUpdated: {
      type: 'integer',
      minimum: 0,
      description: 'Last metrics update timestamp'
    }
  }
};

/**
 * BSC Liquidity Addition Quote Schema
 */
export const BSCLiquidityAdditionQuoteSchema = {
  type: 'object',
  required: ['poolAddress', 'amountA', 'amountB', 'liquidity'],
  properties: {
    poolAddress: BSCPoolAddressSchema,
    amountA: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Required amount of token A'
    },
    amountB: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Required amount of token B'
    },
    liquidity: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'LP tokens to be received'
    },
    shareOfPool: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Share of pool after addition'
    },
    priceImpact: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Price impact percentage'
    },
    gasEstimate: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Estimated gas in wei'
    },
    gasCostUSD: {
      type: 'number',
      minimum: 0,
      description: 'Estimated gas cost in USD'
    },
    minimumLiquidity: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Minimum LP tokens to receive'
    },
    deadline: {
      type: 'integer',
      minimum: 0,
      description: 'Transaction deadline timestamp'
    },
    route: {
      type: 'array',
      items: {
        type: 'string',
        pattern: ADDRESS_PATTERN
      },
      description: 'Token route for optimal pricing'
    },
    warnings: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'high_price_impact',
          'low_liquidity',
          'volatile_pair',
          'new_pool',
          'high_gas',
          'slippage_risk',
          'concentration_risk'
        ]
      },
      description: 'Warning messages'
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
 * BSC Liquidity Removal Quote Schema
 */
export const BSCLiquidityRemovalQuoteSchema = {
  type: 'object',
  required: ['poolAddress', 'liquidity', 'amountA', 'amountB'],
  properties: {
    poolAddress: BSCPoolAddressSchema,
    liquidity: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'LP tokens to be burned'
    },
    amountA: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Amount of token A to receive'
    },
    amountB: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Amount of token B to receive'
    },
    amountAMin: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Minimum amount of token A'
    },
    amountBMin: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Minimum amount of token B'
    },
    valueUSD: {
      type: 'number',
      minimum: 0,
      description: 'Total value in USD'
    },
    valueBNB: {
      type: 'number',
      minimum: 0,
      description: 'Total value in BNB'
    },
    uncollectedFees0: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Uncollected fees of token0'
    },
    uncollectedFees1: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Uncollected fees of token1'
    },
    totalFeesUSD: {
      type: 'number',
      minimum: 0,
      description: 'Total uncollected fees in USD'
    },
    gasEstimate: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Estimated gas in wei'
    },
    gasCostUSD: {
      type: 'number',
      minimum: 0,
      description: 'Estimated gas cost in USD'
    },
    impermanentLoss: {
      type: 'number',
      description: 'Current impermanent loss'
    },
    netProfit: {
      type: 'number',
      description: 'Net profit including fees and IL'
    },
    netProfitPercent: {
      type: 'number',
      description: 'Net profit percentage'
    },
    warnings: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'high_impermanent_loss',
          'low_liquidity',
          'high_gas',
          'early_withdrawal_penalty',
          'slippage_risk'
        ]
      },
      description: 'Warning messages'
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
 * BSC Pool Analysis Query Schema
 */
export const BSCPoolAnalysisQuerySchema = {
  type: 'object',
  properties: {
    poolAddress: BSCPoolAddressSchema,
    tokenA: {
      type: 'string',
      pattern: ADDRESS_PATTERN,
      description: 'Filter by token A address'
    },
    tokenB: {
      type: 'string',
      pattern: ADDRESS_PATTERN,
      description: 'Filter by token B address'
    },
    protocol: {
      type: 'string',
      enum: ['pancakeswap', 'uniswap', 'sushiswap'],
      description: 'Filter by protocol'
    },
    version: {
      type: 'string',
      enum: ['v2', 'v3'],
      description: 'Filter by version'
    },
    feeTier: {
      type: 'integer',
      enum: [0, 500, 3000, 10000],
      description: 'Filter by fee tier (0=V2)'
    },
    minLiquidityUSD: {
      type: 'number',
      minimum: 0,
      description: 'Minimum liquidity in USD'
    },
    minVolume24h: {
      type: 'number',
      minimum: 0,
      description: 'Minimum 24h volume in USD'
    },
    minAPR: {
      type: 'number',
      minimum: 0,
      description: 'Minimum APR'
    },
    isActive: {
      type: 'boolean',
      description: 'Filter by active status'
    },
    hasFarming: {
      type: 'boolean',
      description: 'Filter by farming availability'
    },
    sortBy: {
      type: 'string',
      enum: [
        'liquidity',
        'volume24h',
        'apr',
        'apy',
        'feeAPR',
        'price',
        'createdAt',
        'utilization',
        'holderCount'
      ],
      default: 'liquidity',
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
    }
  }
};

/**
 * BSC Concentration Risk Analysis Schema
 */
export const BSCConcentrationRiskSchema = {
  type: 'object',
  required: ['userAddress', 'overallRisk'],
  properties: {
    userAddress: {
      type: 'string',
      pattern: ADDRESS_PATTERN,
      description: 'User wallet address'
    },
    overallRisk: {
      type: 'string',
      enum: ['very_low', 'low', 'medium', 'high', 'very_high'],
      description: 'Overall concentration risk level'
    },
    overallRiskScore: {
      type: 'integer',
      minimum: 0,
      maximum: 100,
      description: 'Overall risk score (0-100)'
    },
    tokenConcentration: {
      type: 'object',
      properties: {
        topTokenPercentage: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'Percentage of portfolio in top token'
        },
        top3TokensPercentage: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'Percentage of portfolio in top 3 tokens'
        },
        uniqueTokenCount: {
          type: 'integer',
          minimum: 0,
          description: 'Number of unique tokens'
        },
        herfindahlIndex: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Herfindahl-Hirschman Index (0=diversified, 1=concentrated)'
        }
      }
    },
    protocolConcentration: {
      type: 'object',
      properties: {
        pancakesharePercentage: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'Percentage in PancakeSwap'
        },
        otherProtocolsPercentage: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'Percentage in other protocols'
        },
        protocolCount: {
          type: 'integer',
          minimum: 0,
          description: 'Number of protocols used'
        }
      }
    },
    recommendations: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'diversify_tokens',
          'reduce_pancakeshare_concentration',
          'add_stablecoin_positions',
          'increase_protocol_diversity',
          'rebalance_portfolio',
          'monitor_concentration_risk'
        ]
      },
      description: 'Diversification recommendations'
    },
    analyzedAt: {
      type: 'integer',
      minimum: 0,
      description: 'Analysis timestamp'
    }
  }
};

/**
 * BSC Impermanent Loss Data Schema
 */
export const BSCImpermanentLossSchema = {
  type: 'object',
  required: ['userAddress', 'currentIL'],
  properties: {
    userAddress: {
      type: 'string',
      pattern: ADDRESS_PATTERN,
      description: 'User wallet address'
    },
    currentIL: {
      type: 'number',
      description: 'Current impermanent loss percentage'
    },
    lifetimeIL: {
      type: 'number',
      description: 'Lifetime impermanent loss percentage'
    },
    il24h: {
      type: 'number',
      description: '24-hour impermanent loss change'
    },
    il7d: {
      type: 'number',
      description: '7-day impermanent loss change'
    },
    il30d: {
      type: 'number',
      description: '30-day impermanent loss change'
    },
    worstIL: {
      type: 'number',
      description: 'Worst impermanent loss experienced'
    },
    worstILDate: {
      type: 'integer',
      minimum: 0,
      description: 'Date of worst impermanent loss'
    },
    avgIL: {
      type: 'number',
      description: 'Average impermanent loss'
    },
    positions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          positionId: {
            type: 'string',
            description: 'Position identifier'
          },
          poolAddress: BSCPoolAddressSchema,
          token0Symbol: {
            type: 'string',
            description: 'Token 0 symbol'
          },
          token1Symbol: {
            type: 'string',
            description: 'Token 1 symbol'
          },
          currentIL: {
            type: 'number',
            description: 'Current IL for position'
          },
          positionValue: {
            type: 'number',
            minimum: 0,
            description: 'Position value in USD'
          },
          lossValue: {
            type: 'number',
            description: 'Loss value in USD'
          }
        }
      }
    },
    mitigatingFactors: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'fee_income_offsetting_il',
          'price_correlation_high',
          'stablecoin_pair',
          'balanced_allocation',
          'rebalancing_active'
        ]
      },
      description: 'Factors mitigating impermanent loss'
    },
    recommendations: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'add_stablecoin_pairs',
          'rebalance_volatile_positions',
          'consider_single_sided_staking',
          'implement_dynamic_rebalancing',
          'monitor_price_correlation',
          'reduce_volatile_exposure'
        ]
      },
      description: 'IL mitigation recommendations'
    },
    analyzedAt: {
      type: 'integer',
      minimum: 0,
      description: 'Analysis timestamp'
    }
  }
};

/**
 * Export all BSC liquidity schemas
 */
export const BSC_LIQUIDITY_SCHEMAS = {
  POOL_ADDRESS: BSCPoolAddressSchema,
  PAIR_INFO: BSCPoolPairInfoSchema,
  POSITION: BSCLiquidityPositionSchema,
  METRICS: BSCPoolMetricsSchema,
  ADDITION_QUOTE: BSCLiquidityAdditionQuoteSchema,
  REMOVAL_QUOTE: BSCLiquidityRemovalQuoteSchema,
  ANALYSIS_QUERY: BSCPoolAnalysisQuerySchema,
  CONCENTRATION_RISK: BSCConcentrationRiskSchema,
  IMPERMANENT_LOSS: BSCImpermanentLossSchema
};