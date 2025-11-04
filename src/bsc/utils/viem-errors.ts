import { ViemError, RpcError, ContractError } from '../../types/viem';
import logger from '../../utils/logger';

/**
 * Viem Error Handling Utilities
 * Provides specialized error handling for Viem operations with classification and recovery strategies
 */

export class ViemErrorHandler {
  /**
   * Handle and classify Viem errors
   */
  public static handleViemError(error: unknown, context?: string): ViemError {
    if (this.isRpcError(error)) {
      return this.handleRpcError(error, context);
    }

    if (this.isContractError(error)) {
      return this.handleContractError(error, context);
    }

    // Generic error handling
    const viemError: ViemError = {
      name: 'ViemError',
      message: error instanceof Error ? error.message : 'Unknown Viem error',
      cause: error,
    };

    logger.error('Viem error%s: %O', context ? ` in ${context}` : '', viemError);
    return viemError;
  }

  /**
   * Check if error is an RPC error
   */
  public static isRpcError(error: unknown): error is RpcError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as any).code === 'number' &&
      'message' in error &&
      typeof (error as any).message === 'string'
    );
  }

  /**
   * Check if error is a contract error
   */
  public static isContractError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const err = error as any;
    return (
      err.message &&
      (
        err.message.includes('execution reverted') ||
        err.message.includes('revert') ||
        err.message.includes('call revert exception') ||
        err.message.includes('out of gas') ||
        err.message.includes('gas required exceeds allowance')
      )
    );
  }

  /**
   * Handle RPC-specific errors
   */
  public static handleRpcError(error: unknown, context?: string): RpcError {
    const rpcError: RpcError = {
      name: 'RpcError',
      message: (error as any).message || 'Unknown RPC error',
      code: (error as any).code || -1,
      data: (error as any).data,
    };

    // Add specific error context
    switch (rpcError.code) {
      case -32600:
        rpcError.message = `Invalid Request: ${rpcError.message}`;
        break;
      case -32601:
        rpcError.message = `Method not found: ${rpcError.message}`;
        break;
      case -32602:
        rpcError.message = `Invalid params: ${rpcError.message}`;
        break;
      case -32603:
        rpcError.message = `Internal error: ${rpcError.message}`;
        break;
      case -32000:
        rpcError.message = `Server error: ${rpcError.message}`;
        break;
      case -32001:
        rpcError.message = `Requested block not found: ${rpcError.message}`;
        break;
      case -32002:
        rpcError.message = `Requested transaction not found: ${rpcError.message}`;
        break;
      case -32003:
        rpcError.message = `Requested data not found: ${rpcError.message}`;
        break;
      case -32004:
        rpcError.message = `Method not supported: ${rpcError.message}`;
        break;
      case -32005:
        rpcError.message = `Limit exceeded: ${rpcError.message}`;
        break;
      case 4001:
        rpcError.message = `User rejected the request: ${rpcError.message}`;
        break;
      case 4100:
        rpcError.message = `Unauthorized: ${rpcError.message}`;
        break;
      case 4200:
        rpcError.message = `Unsupported method: ${rpcError.message}`;
        break;
      case 4900:
        rpcError.message = `Disconnected: ${rpcError.message}`;
        break;
      case 4901:
        rpcError.message = `Chain disconnected: ${rpcError.message}`;
        break;
      default:
        rpcError.message = `RPC Error (${rpcError.code}): ${rpcError.message}`;
    }

    logger.error('RPC error%s: %O', context ? ` in ${context}` : '', rpcError);
    return rpcError;
  }

  /**
   * Handle contract-specific errors
   */
  public static handleContractError(error: unknown, context?: string): ContractError {
    const errorMessage = error instanceof Error ? error.message : 'Unknown contract error';
    let contractAddress: string | undefined;
    let functionName: string | undefined;

    // Try to extract contract information from error message
    const addressMatch = errorMessage.match(/contract[^:]*:\s*(0x[a-fA-F0-9]{40})/i);
    if (addressMatch) {
      contractAddress = addressMatch[1];
    }

    const functionMatch = errorMessage.match(/function[^:]*:\s*(\w+)/i);
    if (functionMatch) {
      functionName = functionMatch[1];
    }

    const contractError: ContractError = {
      name: 'ContractError',
      message: errorMessage,
      contract: contractAddress as any || 'unknown',
      functionName: functionName || 'unknown',
    };

    // Classify specific contract errors
    if (errorMessage.includes('execution reverted')) {
      contractError.message = `Contract execution reverted: ${errorMessage}`;
    } else if (errorMessage.includes('out of gas')) {
      contractError.message = `Contract call out of gas: ${errorMessage}`;
    } else if (errorMessage.includes('insufficient balance')) {
      contractError.message = `Insufficient balance for contract call: ${errorMessage}`;
    } else if (errorMessage.includes('invalid opcode')) {
      contractError.message = `Invalid opcode in contract: ${errorMessage}`;
    } else if (errorMessage.includes('revert')) {
      contractError.message = `Contract call reverted: ${errorMessage}`;
    }

    logger.error('Contract error%s: %O', context ? ` in ${context}` : '', contractError);
    return contractError;
  }

  /**
   * Get recovery strategy for error
   */
  public static getRecoveryStrategy(error: ViemError): {
    canRetry: boolean;
    retryDelay: number;
    maxRetries: number;
    action: string;
  } {
    if (this.isRpcError(error)) {
      return this.getRpcRecoveryStrategy(error as RpcError);
    }

    if (this.isContractError(error)) {
      return this.getContractRecoveryStrategy(error);
    }

    // Default recovery strategy
    return {
      canRetry: false,
      retryDelay: 0,
      maxRetries: 0,
      action: 'Check error details and retry manually',
    };
  }

  /**
   * Get RPC error recovery strategy
   */
  private static getRpcRecoveryStrategy(error: RpcError): {
    canRetry: boolean;
    retryDelay: number;
    maxRetries: number;
    action: string;
  } {
    switch (error.code) {
      case -32600: // Invalid Request
        return {
          canRetry: false,
          retryDelay: 0,
          maxRetries: 0,
          action: 'Fix request parameters and retry',
        };

      case -32602: // Invalid params
        return {
          canRetry: false,
          retryDelay: 0,
          maxRetries: 0,
          action: 'Fix request parameters and retry',
        };

      case -32000: // Server error
      case -32001: // Block not found
      case -32002: // Transaction not found
        return {
          canRetry: true,
          retryDelay: 2000,
          maxRetries: 3,
          action: 'Server error - retry with exponential backoff',
        };

      case 4900: // Disconnected
      case 4901: // Chain disconnected
        return {
          canRetry: true,
          retryDelay: 5000,
          maxRetries: 5,
          action: 'Connection lost - reconnect and retry',
        };

      case 4001: // User rejected
        return {
          canRetry: false,
          retryDelay: 0,
          maxRetries: 0,
          action: 'User rejected - get new user approval',
        };

      default:
        return {
          canRetry: true,
          retryDelay: 1000,
          maxRetries: 2,
          action: 'Unknown RPC error - retry cautiously',
        };
    }
  }

  /**
   * Get contract error recovery strategy
   */
  private static getContractRecoveryStrategy(error: ContractError): {
    canRetry: boolean;
    retryDelay: number;
    maxRetries: number;
    action: string;
  } {
    if (error.message.includes('out of gas')) {
      return {
        canRetry: true,
        retryDelay: 1000,
        maxRetries: 2,
        action: 'Increase gas limit and retry',
      };
    }

    if (error.message.includes('execution reverted')) {
      return {
        canRetry: false,
        retryDelay: 0,
        maxRetries: 0,
        action: 'Check contract conditions and parameters',
      };
    }

    if (error.message.includes('insufficient balance')) {
      return {
        canRetry: false,
        retryDelay: 0,
        maxRetries: 0,
        action: 'Add funds to wallet and retry',
      };
    }

    if (error.message.includes('nonce')) {
      return {
        canRetry: true,
        retryDelay: 3000,
        maxRetries: 3,
        action: 'Wait for previous transaction to confirm and retry',
      };
    }

    return {
      canRetry: false,
      retryDelay: 0,
      maxRetries: 0,
      action: 'Review contract call parameters',
    };
  }

  /**
   * Format error for user display
   */
  public static formatErrorForUser(error: ViemError): {
    title: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
    canRetry: boolean;
  } {
    if (this.isRpcError(error)) {
      const rpcError = error as RpcError;
      return {
        title: 'Network Error',
        message: this.getRpcUserMessage(rpcError),
        severity: 'error',
        canRetry: this.getRecoveryStrategy(rpcError).canRetry,
      };
    }

    if (this.isContractError(error)) {
      const contractError = error;
      return {
        title: 'Contract Error',
        message: this.getContractUserMessage(contractError),
        severity: 'error',
        canRetry: this.getRecoveryStrategy(contractError).canRetry,
      };
    }

    return {
      title: 'Unknown Error',
      message: error.message || 'An unexpected error occurred',
      severity: 'error',
      canRetry: false,
    };
  }

  /**
   * Get user-friendly RPC error message
   */
  private static getRpcUserMessage(error: RpcError): string {
    switch (error.code) {
      case -32600:
        return 'Invalid request format. Please try again.';
      case -32601:
        return 'This operation is not supported.';
      case -32602:
        return 'Invalid parameters provided.';
      case -32000:
        return 'Server error. Please try again in a moment.';
      case -32001:
        return 'Block not found. Please check the block number.';
      case -32002:
        return 'Transaction not found. Please check the transaction hash.';
      case 4900:
      case 4901:
        return 'Connection to the blockchain was lost. Please refresh the page.';
      case 4001:
        return 'Transaction was cancelled.';
      default:
        return 'Network error occurred. Please try again.';
    }
  }

  /**
   * Get user-friendly contract error message
   */
  private static getContractUserMessage(error: ContractError): string {
    if (error.message.includes('out of gas')) {
      return 'Transaction ran out of gas. Please try with a higher gas limit.';
    }

    if (error.message.includes('execution reverted')) {
      return 'Transaction failed. Please check your parameters and try again.';
    }

    if (error.message.includes('insufficient balance')) {
      return 'Insufficient funds for this transaction.';
    }

    if (error.message.includes('nonce')) {
      return 'Please wait for your previous transaction to complete.';
    }

    return 'Contract interaction failed. Please check your parameters and try again.';
  }
}

// Convenience exports
export const handleViemError = (error: unknown, context?: string) =>
  ViemErrorHandler.handleViemError(error, context);

export const isRpcError = (error: unknown) => ViemErrorHandler.isRpcError(error);

export const isContractError = (error: unknown) => ViemErrorHandler.isContractError(error);

export const getRecoveryStrategy = (error: ViemError) =>
  ViemErrorHandler.getRecoveryStrategy(error);

export const formatErrorForUser = (error: ViemError) =>
  ViemErrorHandler.formatErrorForUser(error);

export default ViemErrorHandler;