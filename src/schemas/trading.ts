/**
 * Trading-related validation schemas
 */

/**
 * Swap quote request schema
 */
export const swapQuoteSchema = {
  type: 'object',
  required: ['tokenIn', 'tokenOut', 'amountIn'],
  properties: {
    tokenIn: {
      type: 'object',
      required: ['address', 'symbol', 'decimals'],
      properties: {
        address: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Token contract address'
        },
        symbol: {
          type: 'string',
          minLength: 1,
          maxLength: 10,
          description: 'Token symbol'
        },
        decimals: {
          type: 'integer',
          minimum: 0,
          maximum: 18,
          description: 'Token decimal places'
        }
      }
    },
    tokenOut: {
      type: 'object',
      required: ['address', 'symbol', 'decimals'],
      properties: {
        address: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Token contract address'
        },
        symbol: {
          type: 'string',
          minLength: 1,
          maxLength: 10,
          description: 'Token symbol'
        },
        decimals: {
          type: 'integer',
          minimum: 0,
          maximum: 18,
          description: 'Token decimal places'
        }
      }
    },
    amountIn: {
      type: 'string',
      pattern: '^[0-9]+(\\.[0-9]+)?$',
      description: 'Amount of input tokens (must be positive number)'
    },
    slippageTolerance: {
      type: 'string',
      pattern: '^0\\.[0-9]+$',
      description: 'Slippage tolerance as decimal (e.g., 0.005 for 0.5%)'
    }
  }
};

/**
 * Swap execution request schema
 */
export const swapExecutionSchema = {
  type: 'object',
  required: ['tokenIn', 'tokenOut', 'amountIn'],
  properties: {
    tokenIn: {
      type: 'object',
      required: ['address', 'symbol', 'decimals'],
      properties: {
        address: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Token contract address'
        },
        symbol: {
          type: 'string',
          minLength: 1,
          maxLength: 10,
          description: 'Token symbol'
        },
        decimals: {
          type: 'integer',
          minimum: 0,
          maximum: 18,
          description: 'Token decimal places'
        }
      }
    },
    tokenOut: {
      type: 'object',
      required: ['address', 'symbol', 'decimals'],
      properties: {
        address: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Token contract address'
        },
        symbol: {
          type: 'string',
          minLength: 1,
          maxLength: 10,
          description: 'Token symbol'
        },
        decimals: {
          type: 'integer',
          minimum: 0,
          maximum: 18,
          description: 'Token decimal places'
        }
      }
    },
    amountIn: {
      type: 'string',
      pattern: '^[0-9]+(\\.[0-9]+)?$',
      description: 'Amount of input tokens (must be positive number)'
    },
    slippageTolerance: {
      type: 'string',
      pattern: '^0\\.[0-9]+$',
      description: 'Slippage tolerance as decimal (e.g., 0.005 for 0.5%)'
    },
    minimumOutput: {
      type: 'string',
      pattern: '^[0-9]+(\\.[0-9]+)?$',
      description: 'Minimum output amount for additional protection'
    }
  }
};

/**
 * Route finding request schema
 */
export const routeFindingSchema = {
  type: 'object',
  required: ['tokenIn', 'tokenOut', 'amountIn'],
  properties: {
    tokenIn: {
      type: 'object',
      required: ['address', 'symbol', 'decimals'],
      properties: {
        address: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Token contract address'
        },
        symbol: {
          type: 'string',
          minLength: 1,
          maxLength: 10,
          description: 'Token symbol'
        },
        decimals: {
          type: 'integer',
          minimum: 0,
          maximum: 18,
          description: 'Token decimal places'
        }
      }
    },
    tokenOut: {
      type: 'object',
      required: ['address', 'symbol', 'decimals'],
      properties: {
        address: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Token contract address'
        },
        symbol: {
          type: 'string',
          minLength: 1,
          maxLength: 10,
          description: 'Token symbol'
        },
        decimals: {
          type: 'integer',
          minimum: 0,
          maximum: 18,
          description: 'Token decimal places'
        }
      }
    },
    amountIn: {
      type: 'string',
      pattern: '^[0-9]+(\\.[0-9]+)?$',
      description: 'Amount of input tokens (must be positive number)'
    },
    maxHops: {
      type: 'integer',
      minimum: 1,
      maximum: 5,
      description: 'Maximum number of hops in the route'
    }
  }
};

/**
 * Gas estimation request schema
 */
export const gasEstimationSchema = {
  type: 'object',
  required: ['transactionType'],
  properties: {
    transactionType: {
      type: 'string',
      enum: ['swap', 'addLiquidity', 'removeLiquidity'],
      description: 'Type of transaction to estimate gas for'
    },
    params: {
      type: 'object',
      description: 'Additional parameters for gas estimation'
    }
  }
};

/**
 * Response schemas for trading operations
 */

/**
 * Swap quote response schema
 */
export const swapQuoteResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    quote: {
      type: 'object',
      properties: {
        inputAmount: { type: 'string' },
        outputAmount: { type: 'string' },
        price: { type: 'string' },
        priceImpact: { type: 'string' },
        fee: { type: 'string' },
        slippage: { type: 'string' },
        minimumOutput: { type: 'string' }
      }
    },
    warnings: {
      type: 'array',
      items: { type: 'string' }
    },
    error: { type: 'string' }
  }
};

/**
 * Swap execution response schema
 */
export const swapExecutionResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    transactionHash: { type: 'string' },
    quote: {
      type: 'object',
      properties: {
        inputAmount: { type: 'string' },
        outputAmount: { type: 'string' },
        price: { type: 'string' },
        priceImpact: { type: 'string' },
        fee: { type: 'string' },
        slippage: { type: 'string' },
        minimumOutput: { type: 'string' }
      }
    },
    error: { type: 'string' }
  }
};

/**
 * Gas estimation response schema
 */
export const gasEstimationResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    gasEstimate: {
      type: 'object',
      properties: {
        gasLimit: { type: 'string' },
        gasPrice: { type: 'string' },
        maxFeePerGas: { type: 'string' },
        maxPriorityFeePerGas: { type: 'string' },
        totalCost: { type: 'string' },
        estimatedTime: { type: 'string' }
      }
    },
    error: { type: 'string' }
  }
};

/**
 * Pool information response schema
 */
export const poolResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    pools: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          address: { type: 'string' },
          token0: {
            type: 'object',
            properties: {
              address: { type: 'string' },
              symbol: { type: 'string' },
              decimals: { type: 'integer' }
            }
          },
          token1: {
            type: 'object',
            properties: {
              address: { type: 'string' },
              symbol: { type: 'string' },
              decimals: { type: 'integer' }
            }
          },
          reserve0: { type: 'string' },
          reserve1: { type: 'string' },
          totalSupply: { type: 'string' },
          fee: { type: 'string' },
          volume24h: { type: 'string' },
          fee24h: { type: 'string' },
          tvl: { type: 'string' },
          apr: { type: 'string' },
          isActive: { type: 'boolean' }
        }
      }
    },
    count: { type: 'integer' },
    error: { type: 'string' }
  }
};