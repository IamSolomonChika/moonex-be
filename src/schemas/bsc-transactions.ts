/**
 * BSC Transaction Schemas
 * JSON Schema definitions for BSC transaction validation and monitoring
 */


// BSC-specific patterns
const ADDRESS_PATTERN = '^0x[a-fA-F0-9]{40}$';
const HASH_PATTERN = '^0x[a-fA-F0-9]{64}$';
const SIGNATURE_PATTERN = '^0x[a-fA-F0-9]{130}$';
const DATA_PATTERN = '^0x[a-fA-F0-9]*$';

/**
 * BSC Transaction Hash Validation Schema
 */
export const BSCTransactionHashSchema = {
  type: 'string',
  pattern: HASH_PATTERN,
  minLength: 66,
  maxLength: 66,
  description: 'Valid BSC transaction hash (66 characters with 0x prefix)'
};

/**
 * BSC Address Validation Schema
 */
export const BSCAddressSchema = {
  type: 'string',
  pattern: ADDRESS_PATTERN,
  minLength: 42,
  maxLength: 42,
  description: 'Valid BSC address (42 characters with 0x prefix)'
};

/**
 * BSC Transaction Input Schema
 */
export const BSCTransactionInputSchema = {
  type: 'object',
  required: ['from', 'to'],
  properties: {
    from: BSCAddressSchema,
    to: BSCAddressSchema,
    value: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Transaction value in wei'
    },
    data: {
      type: 'string',
      pattern: DATA_PATTERN,
      description: 'Transaction data (hex string)'
    },
    gasLimit: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Gas limit'
    },
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
    nonce: {
      type: 'integer',
      minimum: 0,
      description: 'Transaction nonce'
    }
  },
  oneOf: [
    { required: ['gasPrice'] },
    { required: ['maxFeePerGas', 'maxPriorityFeePerGas'] }
  ]
};

/**
 * BSC Signed Transaction Schema
 */
export const BSCTransactionSignatureSchema = {
  type: 'object',
  required: ['transaction', 'signature'],
  properties: {
    transaction: BSCTransactionInputSchema,
    signature: {
      type: 'string',
      pattern: SIGNATURE_PATTERN,
      minLength: 132,
      maxLength: 132,
      description: 'ECDSA signature (130-132 characters with 0x prefix)'
    },
    recoveryId: {
      type: 'integer',
      minimum: 0,
      maximum: 1,
      description: 'Recovery ID (0 or 1)'
    }
  }
};

/**
 * BSC Transaction Status Schema
 */
export const BSCTransactionStatusSchema = {
  type: 'object',
  required: ['hash', 'status'],
  properties: {
    hash: BSCTransactionHashSchema,
    status: {
      type: 'string',
      enum: ['pending', 'confirmed', 'failed', 'replaced', 'dropped'],
      description: 'Transaction status'
    },
    blockNumber: {
      type: 'integer',
      minimum: 0,
      description: 'Block number where transaction was included'
    },
    blockHash: {
      type: 'string',
      pattern: HASH_PATTERN,
      description: 'Block hash'
    },
    transactionIndex: {
      type: 'integer',
      minimum: 0,
      description: 'Transaction index in block'
    },
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
    maxFeePerGas: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Maximum fee per gas paid'
    },
    maxPriorityFeePerGas: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Maximum priority fee per gas paid'
    },
    cumulativeGasUsed: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Cumulative gas used in block'
    },
    logsBloom: {
      type: 'string',
      pattern: '^0x[a-fA-F0-9]{512}$',
      description: 'Bloom filter for logs'
    },
    logs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          address: BSCAddressSchema,
          topics: {
            type: 'array',
            items: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{64}$'
            }
          },
          data: {
            type: 'string',
            pattern: DATA_PATTERN
          },
          blockNumber: {
            type: 'integer',
            minimum: 0
          },
          transactionHash: BSCTransactionHashSchema,
          transactionIndex: {
            type: 'integer',
            minimum: 0
          },
          blockHash: {
            type: 'string',
            pattern: HASH_PATTERN
          },
          logIndex: {
            type: 'integer',
            minimum: 0
          }
        }
      }
    },
    contractAddress: {
      type: 'string',
      pattern: ADDRESS_PATTERN,
      description: 'Created contract address (if contract creation)'
    },
    type: {
      type: 'integer',
      minimum: 0,
      maximum: 2,
      description: 'Transaction type (0=legacy, 1=EIP-2930, 2=EIP-1559)'
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
    },
    error: {
      type: 'string',
      description: 'Error message if transaction failed'
    }
  }
};

/**
 * BSC Transaction Receipt Schema
 */
export const BSCTransactionReceiptSchema = {
  type: 'object',
  required: ['transactionHash', 'transactionIndex', 'blockHash', 'blockNumber'],
  properties: {
    transactionHash: BSCTransactionHashSchema,
    transactionIndex: {
      type: 'integer',
      minimum: 0,
      description: 'Transaction index in block'
    },
    blockHash: {
      type: 'string',
      pattern: HASH_PATTERN,
      description: 'Block hash'
    },
    blockNumber: {
      type: 'integer',
      minimum: 0,
      description: 'Block number'
    },
    from: BSCAddressSchema,
    to: BSCAddressSchema,
    gasUsed: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Gas used'
    },
    cumulativeGasUsed: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Cumulative gas used'
    },
    effectiveGasPrice: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Effective gas price'
    },
    contractAddress: {
      type: 'string',
      pattern: ADDRESS_PATTERN,
      description: 'Contract address created (if any)'
    },
    logs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['address', 'topics', 'data', 'logIndex'],
        properties: {
          address: BSCAddressSchema,
          topics: {
            type: 'array',
            items: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{64}$'
            }
          },
          data: {
            type: 'string',
            pattern: DATA_PATTERN
          },
          blockNumber: {
            type: 'integer',
            minimum: 0
          },
          transactionHash: BSCTransactionHashSchema,
          transactionIndex: {
            type: 'integer',
            minimum: 0
          },
          blockHash: {
            type: 'string',
            pattern: HASH_PATTERN
          },
          logIndex: {
            type: 'integer',
            minimum: 0
          },
          removed: {
            type: 'boolean',
            description: 'Whether log was removed due to chain reorganization'
          }
        }
      }
    },
    logsBloom: {
      type: 'string',
      pattern: '^0x[a-fA-F0-9]{512}$',
      description: 'Bloom filter for logs'
    },
    status: {
      type: 'integer',
      enum: [0, 1],
      description: 'Transaction status (1=success, 0=failed)'
    },
    type: {
      type: 'integer',
      minimum: 0,
      maximum: 2,
      description: 'Transaction type'
    }
  }
};

/**
 * BSC Transaction Estimate Schema
 */
export const BSCTransactionEstimateSchema = {
  type: 'object',
  required: ['gasEstimate'],
  properties: {
    gasEstimate: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Estimated gas limit'
    },
    gasPrice: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Suggested gas price'
    },
    maxFeePerGas: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Suggested max fee per gas'
    },
    maxPriorityFeePerGas: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Suggested max priority fee per gas'
    },
    estimatedCostBNB: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Estimated cost in BNB'
    },
    estimatedCostUSD: {
      type: 'number',
      minimum: 0,
      description: 'Estimated cost in USD'
    },
    estimatedTime: {
      type: 'integer',
      minimum: 0,
      description: 'Estimated confirmation time in seconds'
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Confidence level of estimate'
    }
  }
};

/**
 * BSC Transaction Monitoring Query Schema
 */
export const BSCTransactionQuerySchema = {
  type: 'object',
  properties: {
    userAddress: BSCAddressSchema,
    fromBlock: {
      type: 'integer',
      minimum: 0,
      description: 'Starting block number'
    },
    toBlock: {
      type: 'integer',
      minimum: 0,
      description: 'Ending block number'
    },
    fromTimestamp: {
      type: 'integer',
      minimum: 0,
      description: 'Starting timestamp'
    },
    toTimestamp: {
      type: 'integer',
      minimum: 0,
      description: 'Ending timestamp'
    },
    status: {
      type: 'string',
      enum: ['pending', 'confirmed', 'failed'],
      description: 'Filter by transaction status'
    },
    transactionType: {
      type: 'string',
      enum: ['transfer', 'swap', 'add_liquidity', 'remove_liquidity', 'harvest', 'compound', 'approve'],
      description: 'Filter by transaction type'
    },
    minValue: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Minimum transaction value in wei'
    },
    maxValue: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Maximum transaction value in wei'
    },
    contractAddress: BSCAddressSchema,
    tokenAddress: BSCAddressSchema,
    gasUsedMin: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Minimum gas used'
    },
    gasUsedMax: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Maximum gas used'
    },
    sortBy: {
      type: 'string',
      enum: ['timestamp', 'blockNumber', 'value', 'gasUsed', 'gasPrice'],
      default: 'timestamp',
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
    includeLogs: {
      type: 'boolean',
      default: false,
      description: 'Include transaction logs'
    }
  }
};

/**
 * BSC Transaction Validation Schema
 */
export const BSCTransactionValidationSchema = {
  type: 'object',
  required: ['transaction', 'validationResults'],
  properties: {
    transaction: BSCTransactionInputSchema,
    validationResults: {
      type: 'object',
      required: ['isValid', 'errors'],
      properties: {
        isValid: {
          type: 'boolean',
          description: 'Whether transaction is valid'
        },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                enum: [
                  'INVALID_ADDRESS',
                  'INVALID_NONCE',
                  'INSUFFICIENT_FUNDS',
                  'INSUFFICIENT_GAS',
                  'GAS_LIMIT_TOO_LOW',
                  'INVALID_SIGNATURE',
                  'INVALID_DATA',
                  'CONTRACT_EXECUTION_FAILED',
                  'REVERTED',
                  'OUT_OF_GAS',
                  'NETWORK_ERROR',
                  'TIMEOUT',
                  'UNKNOWN_ERROR'
                ],
                description: 'Error code'
              },
              message: {
                type: 'string',
                description: 'Error message'
              },
              severity: {
                type: 'string',
                enum: ['error', 'warning', 'info'],
                default: 'error',
                description: 'Error severity'
              },
              field: {
                type: 'string',
                description: 'Field that caused the error'
              },
              suggestion: {
                type: 'string',
                description: 'Suggested fix'
              }
            }
          }
        },
        warnings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Warning code'
              },
              message: {
                type: 'string',
                description: 'Warning message'
              },
              suggestion: {
                type: 'string',
                description: 'Suggested action'
              }
            }
          }
        },
        riskLevel: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Transaction risk level'
        },
        riskFactors: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'high_gas_price',
              'large_value',
              'new_contract',
              'unverified_contract',
              'complex_data',
              'flashloan_interaction',
              'mev_susceptible',
              'front_running_risk',
              'sandwich_attack_risk'
            ]
          }
        },
        gasEstimate: BSCTransactionEstimateSchema,
        simulatedResult: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Simulation success'
            },
            gasUsed: {
              type: 'string',
              pattern: '^\\d+$',
              description: 'Simulated gas used'
            },
            returnValue: {
              type: 'string',
              pattern: DATA_PATTERN,
              description: 'Simulated return value'
            },
            revertReason: {
              type: 'string',
              description: 'Simulation revert reason'
            }
          }
        },
        mevAnalysis: {
          type: 'object',
          properties: {
            mevRisk: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              description: 'MEV risk level'
            },
            sandwichRisk: {
              type: 'boolean',
              description: 'Susceptible to sandwich attacks'
            },
            frontRunningRisk: {
              type: 'boolean',
              description: 'Susceptible to front-running'
            },
            arbitrageOpportunity: {
              type: 'boolean',
              description: 'Potential arbitrage opportunity'
            },
            suggestedProtection: {
              type: 'array',
              items: {
                type: 'string',
                enum: [
                  'use_private_mempool',
                  'increase_slippage',
                  'add_deadline',
                  'use_flashbots',
                  'split_transaction',
                  'delay_execution'
                ]
              }
            }
          }
        }
      }
    },
    validatedAt: {
      type: 'integer',
      minimum: 0,
      description: 'Validation timestamp'
    }
  }
};

/**
 * BSC Batch Transaction Schema
 */
export const BSCBatchTransactionSchema = {
  type: 'object',
  required: ['transactions', 'batchId'],
  properties: {
    batchId: {
      type: 'string',
      minLength: 1,
      description: 'Unique batch identifier'
    },
    transactions: {
      type: 'array',
      items: BSCTransactionInputSchema,
      minItems: 1,
      maxItems: 50,
      description: 'Array of transactions in batch'
    },
    userAddress: BSCAddressSchema,
    maxGasTotal: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Maximum total gas for batch'
    },
    totalValue: {
      type: 'string',
      pattern: '^\\d+$',
      description: 'Total value of all transactions'
    },
    signature: {
      type: 'string',
      pattern: SIGNATURE_PATTERN,
      description: 'Batch signature'
    },
    deadline: {
      type: 'integer',
      minimum: 0,
      description: 'Batch execution deadline'
    },
    revertOnFailure: {
      type: 'boolean',
      default: true,
      description: 'Whether to revert entire batch on failure'
    },
    status: {
      type: 'string',
      enum: ['pending', 'executing', 'completed', 'failed', 'cancelled'],
      description: 'Batch status'
    },
    executedAt: {
      type: 'integer',
      minimum: 0,
      description: 'Batch execution timestamp'
    },
    transactionHash: {
      type: 'string',
      pattern: HASH_PATTERN,
      description: 'Batch transaction hash'
    },
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: {
            type: 'integer',
            minimum: 0
          },
          success: {
            type: 'boolean'
          },
          gasUsed: {
            type: 'string',
            pattern: '^\\d+$'
          },
          returnValue: {
            type: 'string',
            pattern: DATA_PATTERN
          },
          error: {
            type: 'string'
          }
        }
      }
    }
  }
};

/**
 * BSC Transaction Analytics Schema
 */
export const BSCTransactionAnalyticsSchema = {
  type: 'object',
  required: ['period', 'metrics'],
  properties: {
    period: {
      type: 'string',
      enum: ['1h', '24h', '7d', '30d'],
      description: 'Analytics period'
    },
    userAddress: BSCAddressSchema,
    contractAddress: BSCAddressSchema,
    metrics: {
      type: 'object',
      properties: {
        totalTransactions: {
          type: 'integer',
          minimum: 0,
          description: 'Total transaction count'
        },
        successfulTransactions: {
          type: 'integer',
          minimum: 0,
          description: 'Successful transaction count'
        },
        failedTransactions: {
          type: 'integer',
          minimum: 0,
          description: 'Failed transaction count'
        },
        totalGasUsed: {
          type: 'string',
          pattern: '^\\d+$',
          description: 'Total gas used'
        },
        totalGasCost: {
          type: 'string',
          pattern: '^\\d+$',
          description: 'Total gas cost in wei'
        },
        totalGasCostUSD: {
          type: 'number',
          minimum: 0,
          description: 'Total gas cost in USD'
        },
        averageGasPrice: {
          type: 'string',
          pattern: '^\\d+$',
          description: 'Average gas price'
        },
        averageTransactionValue: {
          type: 'string',
          pattern: '^\\d+$',
          description: 'Average transaction value'
        },
        totalValue: {
          type: 'string',
          pattern: '^\\d+$',
          description: 'Total transaction value'
        },
        transactionTypes: {
          type: 'object',
          properties: {
            transfer: {
              type: 'integer',
              minimum: 0
            },
            swap: {
              type: 'integer',
              minimum: 0
            },
            add_liquidity: {
              type: 'integer',
              minimum: 0
            },
            remove_liquidity: {
              type: 'integer',
              minimum: 0
            },
            harvest: {
              type: 'integer',
              minimum: 0
            },
            compound: {
              type: 'integer',
              minimum: 0
            },
            approve: {
              type: 'integer',
              minimum: 0
            }
          }
        },
        mevIncidents: {
          type: 'integer',
          minimum: 0,
          description: 'Number of MEV incidents'
        },
        sandwichAttacks: {
          type: 'integer',
          minimum: 0,
          description: 'Number of sandwich attacks'
        },
        frontRunningIncidents: {
          type: 'integer',
          minimum: 0,
          description: 'Number of front-running incidents'
        }
      }
    },
    generatedAt: {
      type: 'integer',
      minimum: 0,
      description: 'Analytics generation timestamp'
    }
  }
};

/**
 * Export all BSC transaction schemas
 */
export const BSC_TRANSACTION_SCHEMAS = {
  TRANSACTION_HASH: BSCTransactionHashSchema,
  ADDRESS: BSCAddressSchema,
  TRANSACTION_INPUT: BSCTransactionInputSchema,
  TRANSACTION_SIGNATURE: BSCTransactionSignatureSchema,
  TRANSACTION_STATUS: BSCTransactionStatusSchema,
  TRANSACTION_RECEIPT: BSCTransactionReceiptSchema,
  TRANSACTION_ESTIMATE: BSCTransactionEstimateSchema,
  TRANSACTION_QUERY: BSCTransactionQuerySchema,
  TRANSACTION_VALIDATION: BSCTransactionValidationSchema,
  BATCH_TRANSACTION: BSCBatchTransactionSchema,
  TRANSACTION_ANALYTICS: BSCTransactionAnalyticsSchema
};