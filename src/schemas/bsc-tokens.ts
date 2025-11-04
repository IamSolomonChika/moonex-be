/**
 * BSC Token Schemas
 * JSON Schema definitions for BEP-20 token validation and BSC token operations
 */


// BSC-specific patterns
const ADDRESS_PATTERN = '^0x[a-fA-F0-9]{40}$';
const HASH_PATTERN = '^0x[a-fA-F0-9]{64}$';
const SYMBOL_PATTERN = '^[A-Z0-9]{2,10}$';
const NAME_PATTERN = '^[a-zA-Z0-9\\s\\-\\.]{2,50}$';

/**
 * BSC Token Address Validation Schema
 */
export const BSCTokenAddressSchema = {
  type: 'string',
  pattern: ADDRESS_PATTERN,
  minLength: 42,
  maxLength: 42,
  description: 'Valid BSC BEP-20 token contract address'
};

/**
 * BEP-20 Token Basic Info Schema
 */
export const BEP20TokenBasicInfoSchema = {
  type: 'object',
  required: ['address', 'name', 'symbol', 'decimals'],
  properties: {
    address: BSCTokenAddressSchema,
    name: {
      type: 'string',
      minLength: 2,
      maxLength: 50,
      pattern: NAME_PATTERN,
      description: 'Token name (2-50 characters)'
    },
    symbol: {
      type: 'string',
      minLength: 2,
      maxLength: 10,
      pattern: SYMBOL_PATTERN,
      description: 'Token symbol (uppercase, 2-10 characters)'
    },
    decimals: {
      type: 'integer',
      minimum: 0,
      maximum: 18,
      description: 'Number of decimal places (0-18)'
    },
    totalSupply: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Total supply in smallest token units'
    },
    logoURI: {
      type: 'string',
      format: 'uri',
      description: 'URL to token logo image'
    }
  }
};

/**
 * BEP-20 Token Metadata Schema
 */
export const BEP20TokenMetadataSchema = {
  type: 'object',
  required: ['address'],
  allOf: [
    {
      type: 'object',
      properties: {
        address: BSCTokenAddressSchema,
        name: {
          type: 'string',
          minLength: 2,
          maxLength: 50,
          description: 'Token name'
        },
        symbol: {
          type: 'string',
          minLength: 2,
          maxLength: 10,
          pattern: SYMBOL_PATTERN,
          description: 'Token symbol'
        },
        decimals: {
          type: 'integer',
          minimum: 0,
          maximum: 18,
          description: 'Token decimals'
        }
      }
    }
  ],
  properties: {
    totalSupply: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Total supply in smallest units'
    },
    circulatingSupply: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Circulating supply in smallest units'
    },
    description: {
      type: 'string',
      maxLength: 500,
      description: 'Token description'
    },
    website: {
      type: 'string',
      format: 'uri',
      description: 'Token website URL'
    },
    whitepaper: {
      type: 'string',
      format: 'uri',
      description: 'Whitepaper URL'
    },
    socialLinks: {
      type: 'object',
      properties: {
        twitter: {
          type: 'string',
          description: 'Twitter handle or URL'
        },
        telegram: {
          type: 'string',
          description: 'Telegram group or channel'
        },
        discord: {
          type: 'string',
          description: 'Discord invite URL'
        },
        github: {
          type: 'string',
          format: 'uri',
          description: 'GitHub repository URL'
        },
        medium: {
          type: 'string',
          format: 'uri',
          description: 'Medium publication URL'
        }
      }
    },
    logoURI: {
      type: 'string',
      format: 'uri',
      description: 'Token logo image URL'
    },
    category: {
      type: 'string',
      enum: [
        'currency',
        'defi',
        'gaming',
        'nft',
        'meme',
        'stablecoin',
        'governance',
        'yield',
        'bridge',
        'layer2',
        'exchange',
        'lending',
        'insurance',
        'oracle',
        'storage',
        'other'
      ],
      description: 'Token category'
    },
    tags: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'verified',
          'bluechip',
          'stablecoin',
          'wrapped',
          'staking',
          'governance',
          'defi',
          'gaming',
          'nft',
          'meme',
          'new',
          'hot',
          'trending',
          'airdrop',
          'fork',
          'audited',
          'KYC'
        ]
      },
      uniqueItems: true,
      description: 'Token tags'
    },
    createdAt: {
      type: 'integer',
      minimum: 0,
      description: 'Token creation timestamp'
    },
    verifiedAt: {
      type: 'integer',
      minimum: 0,
      description: 'Verification timestamp'
    },
    auditReport: {
      type: 'string',
      format: 'uri',
      description: 'Audit report URL'
    },
    auditScore: {
      type: 'integer',
      minimum: 0,
      maximum: 100,
      description: 'Audit score (0-100)'
    }
  }
};

/**
 * BEP-20 Token Price Data Schema
 */
export const BEP20TokenPriceDataSchema = {
  type: 'object',
  required: ['address', 'priceUSD'],
  properties: {
    address: BSCTokenAddressSchema,
    priceUSD: {
      type: 'number',
      minimum: 0,
      description: 'Current price in USD'
    },
    priceBNB: {
      type: 'number',
      minimum: 0,
      description: 'Current price in BNB'
    },
    marketCap: {
      type: 'number',
      minimum: 0,
      description: 'Market capitalization in USD'
    },
    marketCapBNB: {
      type: 'number',
      minimum: 0,
      description: 'Market capitalization in BNB'
    },
    totalLiquidityUSD: {
      type: 'number',
      minimum: 0,
      description: 'Total liquidity across all pools in USD'
    },
    totalLiquidityBNB: {
      type: 'number',
      minimum: 0,
      description: 'Total liquidity across all pools in BNB'
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
    priceChange24h: {
      type: 'number',
      description: '24-hour price change in USD'
    },
    priceChangePercent24h: {
      type: 'number',
      description: '24-hour price change percentage'
    },
    priceChange7d: {
      type: 'number',
      description: '7-day price change in USD'
    },
    priceChangePercent7d: {
      type: 'number',
      description: '7-day price change percentage'
    },
    priceChange30d: {
      type: 'number',
      description: '30-day price change in USD'
    },
    priceChangePercent30d: {
      type: 'number',
      description: '30-day price change percentage'
    },
    allTimeHigh: {
      type: 'number',
      minimum: 0,
      description: 'All-time high price in USD'
    },
    allTimeLow: {
      type: 'number',
      minimum: 0,
      description: 'All-time low price in USD'
    },
    athDate: {
      type: 'integer',
      minimum: 0,
      description: 'All-time high timestamp'
    },
    atlDate: {
      type: 'integer',
      minimum: 0,
      description: 'All-time low timestamp'
    },
    lastUpdated: {
      type: 'integer',
      minimum: 0,
      description: 'Last price update timestamp'
    }
  }
};

/**
 * BEP-20 Token Balance Schema
 */
export const BEP20TokenBalanceSchema = {
  type: 'object',
  required: ['address', 'userAddress', 'balance'],
  properties: {
    address: BSCTokenAddressSchema,
    userAddress: {
      type: 'string',
      pattern: ADDRESS_PATTERN,
      description: 'User wallet address'
    },
    balance: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Token balance in smallest units'
    },
    balanceUSD: {
      type: 'number',
      minimum: 0,
      description: 'Balance value in USD'
    },
    balanceBNB: {
      type: 'number',
      minimum: 0,
      description: 'Balance value in BNB'
    },
    allowance: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Allowance for spender address'
    },
    spender: {
      type: 'string',
      pattern: ADDRESS_PATTERN,
      description: 'Spender address for allowance'
    },
    lastUpdated: {
      type: 'integer',
      minimum: 0,
      description: 'Last balance update timestamp'
    }
  }
};

/**
 * BEP-20 Token Verification Schema
 */
export const BEP20TokenVerificationSchema = {
  type: 'object',
  required: ['address', 'isValid'],
  properties: {
    address: BSCTokenAddressSchema,
    isValid: {
      type: 'boolean',
      description: 'Whether token passes validation'
    },
    isVerified: {
      type: 'boolean',
      description: 'Whether token is officially verified'
    },
    verificationLevel: {
      type: 'string',
      enum: ['unverified', 'basic', 'standard', 'premium'],
      description: 'Verification level'
    },
    contractChecks: {
      type: 'object',
      properties: {
        hasValidABI: {
          type: 'boolean',
          description: 'Contract has valid ERC-20 ABI'
        },
        hasTransferFunction: {
          type: 'boolean',
          description: 'Contract has transfer function'
        },
        hasBalanceFunction: {
          type: 'boolean',
          description: 'Contract has balanceOf function'
        },
        hasAllowanceFunction: {
          type: 'boolean',
          description: 'Contract has allowance function'
        },
        hasTotalSupplyFunction: {
          type: 'boolean',
          description: 'Contract has totalSupply function'
        },
        hasDecimalsFunction: {
          type: 'boolean',
          description: 'Contract has decimals function'
        },
        hasSymbolFunction: {
          type: 'boolean',
          description: 'Contract has symbol function'
        },
        hasNameFunction: {
          type: 'boolean',
          description: 'Contract has name function'
        },
        isERC20Compliant: {
          type: 'boolean',
          description: 'Contract is fully ERC-20 compliant'
        }
      }
    },
    securityChecks: {
      type: 'object',
      properties: {
        isHoneypot: {
          type: 'boolean',
          description: 'Whether token is suspected honeypot'
        },
        canBuy: {
          type: 'boolean',
          description: 'Whether token can be bought'
        },
        canSell: {
          type: 'boolean',
          description: 'Whether token can be sold'
        },
        transferTax: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'Transfer tax percentage'
        },
        sellTax: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'Sell tax percentage'
        },
        buyTax: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'Buy tax percentage'
        },
        isBlacklisted: {
          type: 'boolean',
          description: 'Whether token is blacklisted'
        },
        hasMintFunction: {
          type: 'boolean',
          description: 'Whether contract has mint function'
        },
        hasBurnFunction: {
          type: 'boolean',
          description: 'Whether contract has burn function'
        },
        ownerCanPause: {
          type: 'boolean',
          description: 'Whether owner can pause transfers'
        },
        ownerCanBlacklist: {
          type: 'boolean',
          description: 'Whether owner can blacklist addresses'
        }
      }
    },
    liquidityChecks: {
      type: 'object',
      properties: {
        hasLiquidity: {
          type: 'boolean',
          description: 'Whether token has liquidity pools'
        },
        liquidityUSD: {
          type: 'number',
          minimum: 0,
          description: 'Total liquidity in USD'
        },
        holderCount: {
          type: 'integer',
          minimum: 0,
          description: 'Number of token holders'
        },
        top10HolderPercentage: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'Percentage held by top 10 addresses'
        },
        isLiquidityLocked: {
          type: 'boolean',
          description: 'Whether liquidity is locked'
        },
        liquidityLockDuration: {
          type: 'integer',
          minimum: 0,
          description: 'Liquidity lock duration in seconds'
        }
      }
    },
    auditInfo: {
      type: 'object',
      properties: {
        isAudited: {
          type: 'boolean',
          description: 'Whether contract has been audited'
        },
        auditFirm: {
          type: 'string',
          description: 'Auditing firm name'
        },
        auditDate: {
          type: 'integer',
          minimum: 0,
          description: 'Audit date timestamp'
        },
        auditScore: {
          type: 'integer',
          minimum: 0,
          maximum: 100,
          description: 'Audit score'
        },
        criticalIssues: {
          type: 'integer',
          minimum: 0,
          description: 'Number of critical issues found'
        },
        majorIssues: {
          type: 'integer',
          minimum: 0,
          description: 'Number of major issues found'
        },
        minorIssues: {
          type: 'integer',
          minimum: 0,
          description: 'Number of minor issues found'
        }
      }
    },
    verifiedAt: {
      type: 'integer',
      minimum: 0,
      description: 'Verification timestamp'
    },
    riskScore: {
      type: 'integer',
      minimum: 0,
      maximum: 100,
      description: 'Risk score (0=lowest risk, 100=highest risk)'
    },
    recommendations: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'safe_to_trade',
          'caution_advised',
          'high_risk',
          'extreme_risk',
          'avoid_trading',
          'do_more_research',
          'check_liquidity',
          'verify_contract',
          'review_audit_report'
        ]
      },
      description: 'Trading recommendations'
    }
  }
};

/**
 * BSC Token Search Query Schema
 */
export const BSCTokenSearchQuerySchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Search query (name, symbol, or address)'
    },
    category: {
      type: 'string',
      enum: [
        'currency',
        'defi',
        'gaming',
        'nft',
        'meme',
        'stablecoin',
        'governance',
        'yield',
        'bridge',
        'layer2',
        'exchange',
        'lending',
        'insurance',
        'oracle',
        'storage',
        'other'
      ],
      description: 'Filter by token category'
    },
    tags: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'verified',
          'bluechip',
          'stablecoin',
          'wrapped',
          'staking',
          'governance',
          'defi',
          'gaming',
          'nft',
          'meme',
          'new',
          'hot',
          'trending',
          'airdrop',
          'fork',
          'audited',
          'KYC'
        ]
      },
      description: 'Filter by tags'
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
    minMarketCap: {
      type: 'number',
      minimum: 0,
      description: 'Minimum market cap in USD'
    },
    verified: {
      type: 'boolean',
      description: 'Filter by verification status'
    },
    listed: {
      type: 'boolean',
      description: 'Filter by listing status'
    },
    sortBy: {
      type: 'string',
      enum: [
        'name',
        'symbol',
        'priceUSD',
        'marketCap',
        'volume24hUSD',
        'liquidityUSD',
        'priceChange24h',
        'createdAt',
        'discoveredAt',
        'relevance'
      ],
      default: 'relevance',
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
      maximum: 100,
      default: 20,
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
 * BSC Token List Schema (for PancakeSwap token lists)
 */
export const BSCTokenListSchema = {
  type: 'object',
  required: ['name', 'version', 'timestamp', 'tokens'],
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Token list name'
    },
    version: {
      type: 'object',
      required: ['major', 'minor', 'patch'],
      properties: {
        major: {
          type: 'integer',
          minimum: 0
        },
        minor: {
          type: 'integer',
          minimum: 0
        },
        patch: {
          type: 'integer',
          minimum: 0
        }
      },
      description: 'Semantic version'
    },
    timestamp: {
      type: 'integer',
      minimum: 0,
      description: 'List creation timestamp'
    },
    tokens: {
      type: 'array',
      items: BEP20TokenBasicInfoSchema,
      minItems: 1,
      description: 'Array of tokens in the list'
    },
    logoURI: {
      type: 'string',
      format: 'uri',
      description: 'List logo URI'
    },
    keywords: {
      type: 'array',
      items: {
        type: 'string'
      },
      description: 'Keywords for the list'
    }
  }
};

/**
 * BSC Token Price History Query Schema
 */
export const BSCTokenPriceHistoryQuerySchema = {
  type: 'object',
  required: ['address'],
  properties: {
    address: BSCTokenAddressSchema,
    timeframe: {
      type: 'string',
      enum: ['1m', '5m', '15m', '1h', '4h', '1d', '1w'],
      default: '1h',
      description: 'Price history timeframe'
    },
    from: {
      type: 'integer',
      minimum: 0,
      description: 'Start timestamp'
    },
    to: {
      type: 'integer',
      minimum: 0,
      description: 'End timestamp'
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 1000,
      default: 100,
      description: 'Maximum data points to return'
    },
    includeVolume: {
      type: 'boolean',
      default: true,
      description: 'Include volume data'
    }
  }
};

/**
 * Export all BSC token schemas
 */
export const BSC_TOKEN_SCHEMAS = {
  ADDRESS: BSCTokenAddressSchema,
  BASIC_INFO: BEP20TokenBasicInfoSchema,
  METADATA: BEP20TokenMetadataSchema,
  PRICE_DATA: BEP20TokenPriceDataSchema,
  BALANCE: BEP20TokenBalanceSchema,
  VERIFICATION: BEP20TokenVerificationSchema,
  SEARCH_QUERY: BSCTokenSearchQuerySchema,
  TOKEN_LIST: BSCTokenListSchema,
  PRICE_HISTORY_QUERY: BSCTokenPriceHistoryQuerySchema
};