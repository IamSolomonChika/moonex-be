/**
 * Create wallet request schema
 */
export const createWalletSchema = {
  type: 'object',
  properties: {}
};

/**
 * Wallet address parameter schema
 */
export const walletAddressParamSchema = {
  type: 'string',
  pattern: '^0x[a-fA-F0-9]{40}$',
  minLength: 42,
  maxLength: 42
};

/**
 * Get wallet info response schema
 */
export const walletInfoResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    wallet: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        address: { type: 'string' },
        userId: { type: 'string' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' }
      }
    },
    error: { type: 'string' }
  }
};

/**
 * Get wallet balance response schema
 */
export const walletBalanceResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    balances: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tokenAddress: { type: 'string' },
          tokenSymbol: { type: 'string' },
          tokenName: { type: 'string' },
          balance: { type: 'string' },
          decimals: { type: 'number' }
        }
      }
    },
    error: { type: 'string' }
  }
};

/**
 * Sign transaction request schema
 */
export const signTransactionSchema = {
  type: 'object',
  required: ['walletAddress', 'to', 'value'],
  properties: {
    walletAddress: {
      type: 'string',
      pattern: '^0x[a-fA-F0-9]{40}$',
      minLength: 42,
      maxLength: 42
    },
    to: {
      type: 'string',
      pattern: '^0x[a-fA-F0-9]{40}$',
      minLength: 42,
      maxLength: 42
    },
    value: {
      type: 'string',
      minLength: 1,
      maxLength: 100
    },
    data: {
      type: 'string',
      minLength: 2,
      maxLength: 100000
    }
  }
};

/**
 * Send transaction request schema
 */
export const sendTransactionSchema = {
  type: 'object',
  required: ['walletAddress', 'to', 'value'],
  properties: {
    walletAddress: {
      type: 'string',
      pattern: '^0x[a-fA-F0-9]{40}$',
      minLength: 42,
      maxLength: 42
    },
    to: {
      type: 'string',
      pattern: '^0x[a-fA-F0-9]{40}$',
      minLength: 42,
      maxLength: 42
    },
    value: {
      type: 'string',
      minLength: 1,
      maxLength: 100
    },
    data: {
      type: 'string',
      minLength: 2,
      maxLength: 100000
    }
  }
};

/**
 * Transaction response schema
 */
export const transactionResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    signature: { type: 'string' },
    transactionHash: { type: 'string' },
    error: { type: 'string' }
  }
};

/**
 * Get transaction history query schema
 */
export const transactionHistoryQuerySchema = {
  type: 'object',
  properties: {
    page: {
      type: 'number',
      minimum: 1,
      default: 1
    },
    limit: {
      type: 'number',
      minimum: 1,
      maximum: 100,
      default: 10
    }
  }
};

/**
 * Get transaction history response schema
 */
export const transactionHistoryResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    transactions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          hash: { type: 'string' },
          from: { type: 'string' },
          to: { type: 'string' },
          value: { type: 'string' },
          gasUsed: { type: 'string' },
          gasPrice: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'confirmed', 'failed'] },
          timestamp: { type: 'string' },
          blockNumber: { type: 'number' }
        }
      }
    },
    pagination: {
      type: 'object',
      properties: {
        page: { type: 'number' },
        limit: { type: 'number' },
        total: { type: 'number' }
      }
    },
    error: { type: 'string' }
  }
};

/**
 * Estimate gas fees request schema
 */
export const estimateGasFeesSchema = {
  type: 'object',
  required: ['to', 'value'],
  properties: {
    to: {
      type: 'string',
      pattern: '^0x[a-fA-F0-9]{40}$',
      minLength: 42,
      maxLength: 42
    },
    value: {
      type: 'string',
      minLength: 1,
      maxLength: 100
    },
    data: {
      type: 'string',
      minLength: 2,
      maxLength: 100000
    }
  }
};

/**
 * Gas estimate response schema
 */
export const gasEstimateResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    estimate: {
      type: 'object',
      properties: {
        gasLimit: { type: 'string' },
        gasPrice: { type: 'string' },
        maxFeePerGas: { type: 'string' },
        maxPriorityFeePerGas: { type: 'string' },
        estimatedCost: { type: 'string' }
      }
    },
    error: { type: 'string' }
  }
};