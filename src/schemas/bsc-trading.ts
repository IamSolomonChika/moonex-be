/**
 * BSC Trading Schemas
 * JSON Schema definitions for BSC trading operations and validation
 */


// Common address pattern for BSC
const ADDRESS_PATTERN = '^0x[a-fA-F0-9]{40}$';
const HASH_PATTERN = '^0x[a-fA-F0-9]{64}$';

/**
 * BSC Token Address Validation
 */
export const BSCAddressSchema = {
  type: 'string',
  pattern: ADDRESS_PATTERN,
  minLength: 42,
  maxLength: 42,
  description: 'Valid BSC contract address (42 characters with 0x prefix)'
};

/**
 * BSC Transaction Hash Validation
 */
export const BSCTransactionHashSchema = {
  type: 'string',
  pattern: HASH_PATTERN,
  minLength: 66,
  maxLength: 66,
  description: 'Valid BSC transaction hash (66 characters with 0x prefix)'
};

/**
 * BSC Block Number Validation
 */
export const BSCBlockNumberSchema = {
  type: 'integer',
  minimum: 0,
  maximum: 9007199254740991, // JS Number.MAX_SAFE_INTEGER
  description: 'Valid BSC block number'
};

/**
 * BSC Amount in Wei Validation
 */
export const BSCWeiAmountSchema = {
  type: 'string',
  pattern: '^\\d+$',
  description: 'Amount in wei (non-negative integer string)'
};

/**
 * BSC Gas Price Schema
 */
export const BSCGasPriceSchema = {
  type: 'object',
  properties: {
    gasPrice: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Gas price in wei'
    },
    maxFeePerGas: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Maximum fee per gas (EIP-1559)'
    },
    maxPriorityFeePerGas: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Maximum priority fee per gas (EIP-1559)'
    },
    gasLimit: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Gas limit for transaction'
    }
  },
  oneOf: [
    { required: ['gasPrice'] },
    { required: ['maxFeePerGas', 'maxPriorityFeePerGas'] }
  ]
};

/**
 * BSC Swap Quote Request Schema
 */
export const BSCSwapQuoteRequestSchema = {
  type: 'object',
  required: ['tokenIn', 'tokenOut', 'amount'],
  properties: {
    tokenIn: BSCAddressSchema,
    tokenOut: BSCAddressSchema,
    amount: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Amount in base units (wei for BNB, smallest unit for tokens)'
    },
    amountType: {
      type: 'string',
      enum: ['exactIn', 'exactOut'],
      default: 'exactIn',
      description: 'Whether the amount is exact input or exact output'
    },
    slippageTolerance: {
      type: 'number',
      minimum: 0,
      maximum: 5000,
      default: 50,
      description: 'Slippage tolerance in basis points (0.01% - 50%)'
    },
    deadlineMinutes: {
      type: 'integer',
      minimum: 1,
      maximum: 60,
      default: 20,
      description: 'Transaction deadline in minutes'
    },
    recipient: BSCAddressSchema,
    preferV3: {
      type: 'boolean',
      default: false,
      description: 'Prefer PancakeSwap V3 pools'
    },
    useV2Fallback: {
      type: 'boolean',
      default: true,
      description: 'Fallback to V2 if V3 not available'
    },
    feeTiers: {
      type: 'array',
      items: {
        type: 'integer',
        enum: [100, 500, 2500, 10000]
      },
      uniqueItems: true,
      description: 'PancakeSwap V3 fee tiers to consider (100=0.01%, 500=0.05%, 2500=0.25%, 10000=1%)'
    },
    maxHops: {
      type: 'integer',
      minimum: 1,
      maximum: 8,
      default: 4,
      description: 'Maximum number of hops in routing'
    },
    enableMEVProtection: {
      type: 'boolean',
      default: true,
      description: 'Enable MEV protection mechanisms'
    }
  }
};

/**
 * BSC Swap Execution Request Schema
 */
export const BSCSwapExecutionRequestSchema = {
  type: 'object',
  required: ['quoteId', 'userAddress', 'signature'],
  properties: {
    quoteId: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Unique identifier for the swap quote'
    },
    userAddress: BSCAddressSchema,
    signature: {
      type: 'string',
      pattern: '^0x[a-fA-F0-9]{130}$',
      description: 'ECDSA signature (130 characters with 0x prefix)'
    },
    gasSettings: BSCGasPriceSchema,
    nonce: {
      type: 'integer',
      minimum: 0,
      description: 'Transaction nonce (optional, will be fetched if not provided)'
    }
  }
};

/**
 * BSC Liquidity Addition Request Schema
 */
export const BSCLiquidityAdditionRequestSchema = {
  type: 'object',
  required: ['poolAddress', 'tokenA', 'tokenB', 'recipient'],
  properties: {
    poolAddress: BSCAddressSchema,
    tokenA: BSCAddressSchema,
    tokenB: BSCAddressSchema,
    amountA: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Amount of token A in base units'
    },
    amountB: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Amount of token B in base units'
    },
    amountADesired: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Desired amount of token A (for V2 pools)'
    },
    amountBDesired: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Desired amount of token B (for V2 pools)'
    },
    minAmountA: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Minimum amount of token A to accept'
    },
    minAmountB: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Minimum amount of token B to accept'
    },
    recipient: BSCAddressSchema,
    deadlineMinutes: {
      type: 'integer',
      minimum: 1,
      maximum: 60,
      default: 20,
      description: 'Transaction deadline in minutes'
    },
    useV3: {
      type: 'boolean',
      default: false,
      description: 'Use PancakeSwap V3 pools'
    },
    // V3 specific properties
    tickLower: {
      type: 'integer',
      description: 'Lower tick for V3 position'
    },
    tickUpper: {
      type: 'integer',
      description: 'Upper tick for V3 position'
    },
    feeTier: {
      type: 'integer',
      enum: [100, 500, 2500, 10000],
      description: 'V3 fee tier'
    }
  },
  oneOf: [
    { required: ['amountA', 'amountB'] },
    { required: ['amountADesired', 'amountBDesired'] }
  ],
  if: { properties: { useV3: { const: true } } },
  then: {
    required: ['tickLower', 'tickUpper', 'feeTier']
  }
};

/**
 * BSC Liquidity Removal Request Schema
 */
export const BSCLiquidityRemovalRequestSchema = {
  type: 'object',
  required: ['poolAddress', 'recipient'],
  properties: {
    poolAddress: BSCAddressSchema,
    liquidityAmount: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Amount of liquidity tokens to remove'
    },
    percentage: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Percentage of position to remove (0-100%)'
    },
    amountAMin: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Minimum amount of token A to receive'
    },
    amountBMin: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Minimum amount of token B to receive'
    },
    recipient: BSCAddressSchema,
    deadlineMinutes: {
      type: 'integer',
      minimum: 1,
      maximum: 60,
      default: 20,
      description: 'Transaction deadline in minutes'
    },
    useV3: {
      type: 'boolean',
      default: false,
      description: 'Use PancakeSwap V3 pools'
    },
    collectAll: {
      type: 'boolean',
      default: false,
      description: 'Collect all fees and principal (V3 only)'
    }
  },
  oneOf: [
    { required: ['liquidityAmount'] },
    { required: ['percentage'] }
  ]
};

/**
 * BSC Batch Operations Request Schema
 */
export const BSCBatchOperationsRequestSchema = {
  type: 'object',
  required: ['operations', 'userAddress'],
  properties: {
    operations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'data'],
        properties: {
          type: {
            type: 'string',
            enum: ['swap', 'addLiquidity', 'removeLiquidity', 'claim', 'approve'],
            description: 'Type of operation'
          },
          data: {
            type: 'object',
            description: 'Operation-specific data'
          },
          priority: {
            type: 'integer',
            minimum: 1,
            maximum: 10,
            default: 5,
            description: 'Operation priority (1=highest, 10=lowest)'
          }
        }
      },
      minItems: 1,
      maxItems: 50,
      description: 'Array of operations to execute'
    },
    userAddress: BSCAddressSchema,
    signature: {
      type: 'string',
      pattern: '^0x[a-fA-F0-9]{130}$',
      description: 'Batch operation signature'
    },
    gasSettings: BSCGasPriceSchema,
    maxGasTotal: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Maximum total gas for all operations'
    }
  }
};

/**
 * BSC Transaction Status Schema
 */
export const BSCTransactionStatusSchema = {
  type: 'object',
  properties: {
    hash: BSCTransactionHashSchema,
    status: {
      type: 'string',
      enum: ['pending', 'confirmed', 'failed', 'replaced'],
      description: 'Transaction status'
    },
    blockNumber: BSCBlockNumberSchema,
    gasUsed: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Gas used by transaction'
    },
    effectiveGasPrice: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Effective gas price'
    },
    transactionFee: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Total transaction fee in wei'
    },
    confirmations: {
      type: 'integer',
      minimum: 0,
      description: 'Number of confirmations'
    },
    timestamp: {
      type: 'integer',
      minimum: 0,
      description: 'Block timestamp'
    },
    revertReason: {
      type: 'string',
      description: 'Revert reason if transaction failed'
    }
  }
};

/**
 * BSC MEV Protection Settings Schema
 */
export const BSCMEVProtectionSettingsSchema = {
  type: 'object',
  properties: {
    enableProtection: {
      type: 'boolean',
      default: true,
      description: 'Enable MEV protection'
    },
    maxSlippage: {
      type: 'number',
      minimum: 0,
      maximum: 1000,
      default: 100,
      description: 'Maximum slippage in basis points'
    },
    deadlineBuffer: {
      type: 'integer',
      minimum: 30,
      maximum: 300,
      default: 60,
      description: 'Deadline buffer in seconds'
    },
    usePrivateMempool: {
      type: 'boolean',
      default: false,
      description: 'Use private mempool for submission'
    },
    minProfitThreshold: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Minimum profit threshold in wei'
    },
    maxGasPrice: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Maximum gas price willing to pay'
    }
  }
};

/**
 * BSC Trading Analytics Query Schema
 */
export const BSCTradingAnalyticsQuerySchema = {
  type: 'object',
  properties: {
    userAddress: BSCAddressSchema,
    tokenAddress: BSCAddressSchema,
    pairAddress: BSCAddressSchema,
    timeframe: {
      type: 'string',
      enum: ['1m', '5m', '15m', '1h', '4h', '1d', '1w'],
      default: '1h',
      description: 'Timeframe for analytics data'
    },
    fromTimestamp: {
      type: 'integer',
      minimum: 0,
      description: 'Start timestamp for analytics period'
    },
    toTimestamp: {
      type: 'integer',
      minimum: 0,
      description: 'End timestamp for analytics period'
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 1000,
      default: 100,
      description: 'Maximum number of data points to return'
    },
    includeFailed: {
      type: 'boolean',
      default: false,
      description: 'Include failed transactions in analytics'
    }
  }
};

/**
 * BSC Router Information Schema
 */
export const BSCRouterInfoSchema = {
  type: 'object',
  required: ['routerAddress', 'protocol', 'version'],
  properties: {
    routerAddress: BSCAddressSchema,
    protocol: {
      type: 'string',
      enum: ['pancakeswap', 'uniswap', 'sushiswap'],
      description: 'DEX protocol'
    },
    version: {
      type: 'string',
      enum: ['v2', 'v3'],
      description: 'Protocol version'
    },
    factoryAddress: BSCAddressSchema,
    initCodeHash: {
      type: 'string',
      pattern: '^0x[a-fA-F0-9]{64}$',
      description: 'Init code hash for pair computation'
    },
    fee: {
      type: 'integer',
      description: 'Protocol fee (if applicable)'
    }
  }
};

/**
 * BSC Path Information Schema
 */
export const BSCPathInfoSchema = {
  type: 'object',
  required: ['path', 'pools'],
  properties: {
    path: {
      type: 'array',
      items: BSCAddressSchema,
      minItems: 2,
      maxItems: 5,
      description: 'Array of token addresses in the path'
    },
    pools: {
      type: 'array',
      items: {
        type: 'object',
        required: ['address', 'token0', 'token1', 'fee'],
        properties: {
          address: BSCAddressSchema,
          token0: BSCAddressSchema,
          token1: BSCAddressSchema,
          fee: {
            type: 'integer',
            description: 'Pool fee tier (for V3)'
          }
        }
      },
      description: 'Array of pool information for each hop'
    },
    inputAmount: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Input amount for the path'
    },
    outputAmount: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Expected output amount'
    },
    gasEstimate: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Estimated gas for this path'
    },
    priceImpact: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Price impact in percentage'
    }
  }
};

/**
 * Export all BSC trading schemas
 */
export const BSC_TRADING_SCHEMAS = {
  ADDRESS: BSCAddressSchema,
  TRANSACTION_HASH: BSCTransactionHashSchema,
  BLOCK_NUMBER: BSCBlockNumberSchema,
  WEI_AMOUNT: BSCWeiAmountSchema,
  GAS_PRICE: BSCGasPriceSchema,
  SWAP_QUOTE_REQUEST: BSCSwapQuoteRequestSchema,
  SWAP_EXECUTION_REQUEST: BSCSwapExecutionRequestSchema,
  LIQUIDITY_ADDITION_REQUEST: BSCLiquidityAdditionRequestSchema,
  LIQUIDITY_REMOVAL_REQUEST: BSCLiquidityRemovalRequestSchema,
  BATCH_OPERATIONS_REQUEST: BSCBatchOperationsRequestSchema,
  TRANSACTION_STATUS: BSCTransactionStatusSchema,
  MEV_PROTECTION_SETTINGS: BSCMEVProtectionSettingsSchema,
  TRADING_ANALYTICS_QUERY: BSCTradingAnalyticsQuerySchema,
  ROUTER_INFO: BSCRouterInfoSchema,
  PATH_INFO: BSCPathInfoSchema
};

/**
 * BSC Trading Error Response Schema
 */
export const BSCTradingErrorResponseSchema = {
  type: 'object',
  required: ['success', 'error'],
  properties: {
    success: {
      type: 'boolean',
      const: false,
      description: 'Always false for error responses'
    },
    error: {
      type: 'string',
      description: 'Error message'
    },
    errorCode: {
      type: 'string',
      enum: [
        'INVALID_ADDRESS',
        'INVALID_AMOUNT',
        'INSUFFICIENT_LIQUIDITY',
        'SLIPPAGE_TOO_HIGH',
        'TRANSACTION_FAILED',
        'GAS_LIMIT_EXCEEDED',
        'NONCE_TOO_LOW',
        'SIGNATURE_INVALID',
        'TIMEOUT',
        'NETWORK_ERROR',
        'CONTRACT_ERROR',
        'MEV_DETECTED',
        'FRONT_RUN_DETECTED'
      ],
      description: 'Machine-readable error code'
    },
    details: {
      type: 'object',
      description: 'Additional error details'
    },
    timestamp: {
      type: 'integer',
      description: 'Error timestamp'
    },
    requestId: {
      type: 'string',
      description: 'Request identifier for debugging'
    }
  }
};

/**
 * BSC Trading Success Response Schema
 */
export const BSCTradingSuccessResponseSchema = {
  type: 'object',
  required: ['success', 'data'],
  properties: {
    success: {
      type: 'boolean',
      const: true,
      description: 'Always true for success responses'
    },
    data: {
      type: 'object',
      description: 'Response data (varies by endpoint)'
    },
    meta: {
      type: 'object',
      properties: {
        timestamp: {
          type: 'integer',
          description: 'Response timestamp'
        },
        requestId: {
          type: 'string',
          description: 'Request identifier'
        },
        processingTime: {
          type: 'number',
          description: 'Processing time in milliseconds'
        },
        warnings: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Any warnings about the operation'
        }
      }
    }
  }
};