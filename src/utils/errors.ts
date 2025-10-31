/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

/**
 * Error response interface
 */
export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: any;
}

/**
 * Success response interface
 */
export interface SuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
}

/**
 * Create standardized error response
 */
export const createErrorResponse = (error: ApiError | Error, statusCode?: number): ErrorResponse => {
  const apiError = error instanceof ApiError ? error : new ApiError(error.message, statusCode);
  
  return {
    success: false,
    error: apiError.message,
    code: apiError.code
  };
};

/**
 * Create standardized success response
 */
export const createSuccessResponse = <T = any>(data?: T, message?: string): SuccessResponse<T> => {
  const response: SuccessResponse<T> = {
    success: true
  };
  
  if (data !== undefined) {
    response.data = data;
  }
  
  if (message) {
    response.message = message;
  }
  
  return response;
};

/**
 * Common error codes
 */
export const ErrorCodes = {
  // Authentication errors
  TOKEN_MISSING: 'TOKEN_MISSING',
  TOKEN_INVALID_FORMAT: 'TOKEN_INVALID_FORMAT',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Authorization errors
  USER_NOT_AUTHENTICATED: 'USER_NOT_AUTHENTICATED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Wallet errors
  WALLET_NOT_FOUND: 'WALLET_NOT_FOUND',
  WALLET_OWNERSHIP_REQUIRED: 'WALLET_OWNERSHIP_REQUIRED',
  WALLET_CREATION_FAILED: 'WALLET_CREATION_FAILED',
  WALLET_ACCESS_DENIED: 'WALLET_ACCESS_DENIED',
  
  // Transaction errors
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INVALID_TRANSACTION: 'INVALID_TRANSACTION',
  GAS_ESTIMATION_FAILED: 'GAS_ESTIMATION_FAILED',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // General errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST'
} as const;

/**
 * HTTP status codes
 */
export const StatusCodes = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

/**
 * Error handler middleware
 */
export const errorHandler = (error: Error, request: any, reply: any) => {
  // Log error
  request.log.error({ error }, 'Error occurred');
  
  // If it's an operational error, send the error response
  if (error instanceof ApiError) {
    reply.code(error.statusCode).send(createErrorResponse(error));
    return;
  }
  
  // For other errors, send a generic error response
  reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send(
    createErrorResponse(error, StatusCodes.INTERNAL_SERVER_ERROR)
  );
};

/**
 * 404 handler for unknown routes
 */
export const notFoundHandler = (request: any, reply: any) => {
  reply.code(StatusCodes.NOT_FOUND).send(
    createErrorResponse(
      new ApiError('Route not found', StatusCodes.NOT_FOUND, ErrorCodes.NOT_FOUND)
    )
  );
};

/**
 * Validation error helper
 */
export const createValidationError = (message: string, details?: any): ApiError => {
  return new ApiError(message, StatusCodes.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
};

/**
 * Authentication error helper
 */
export const createAuthError = (message: string, code: string = ErrorCodes.TOKEN_INVALID): ApiError => {
  return new ApiError(message, StatusCodes.UNAUTHORIZED, code);
};

/**
 * Authorization error helper
 */
export const createAuthzError = (message: string, code: string = ErrorCodes.INSUFFICIENT_PERMISSIONS): ApiError => {
  return new ApiError(message, StatusCodes.FORBIDDEN, code);
};

/**
 * Wallet error helper
 */
export const createWalletError = (message: string, code: string = ErrorCodes.WALLET_NOT_FOUND): ApiError => {
  return new ApiError(message, StatusCodes.NOT_FOUND, code);
};

/**
 * Transaction error helper
 */
export const createTransactionError = (message: string, code: string = ErrorCodes.TRANSACTION_FAILED): ApiError => {
  return new ApiError(message, StatusCodes.BAD_REQUEST, code);
};