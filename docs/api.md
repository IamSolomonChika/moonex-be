# MoonEx API Documentation

## Overview

The MoonEx API provides authentication and wallet management capabilities using Privy for secure authentication and embedded wallet functionality.

## Base URL

```
https://api.moonex.com/v1
```

## Authentication

All API endpoints (except for login and register) require authentication using Bearer tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Health Check

### GET /health

Check the health status of the API.

**Response:**

```json
{
  "status": "ok",
  "message": "MoonEx API is running"
}
```

## Authentication Endpoints

### POST /auth/login

Authenticate a user with email and password.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "name": "User Name"
    },
    "token": "jwt_token_here"
  }
}
```

### POST /auth/register

Register a new user account.

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "name": "New User"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "user_id",
      "email": "newuser@example.com",
      "name": "New User"
    },
    "token": "jwt_token_here"
  }
}
```

### GET /auth/me

Get the current authenticated user's profile.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "name": "User Name",
      "createdAt": "2023-01-01T00:00:00.000Z"
    }
  }
}
```

### POST /auth/logout

Logout the current user and invalidate the token.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Logout successful"
}
```

### POST /auth/refresh

Refresh an authentication token.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "token": "new_jwt_token_here"
  }
}
```

## Wallet Endpoints

### POST /wallets/create

Create a new embedded wallet for the authenticated user.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Wallet created successfully",
  "data": {
    "wallet": {
      "address": "0x1234567890123456789012345678901234567890",
      "type": "embedded",
      "createdAt": "2023-01-01T00:00:00.000Z"
    }
  }
}
```

### GET /wallets/balance

Get the balance of the user's wallet.

**Headers:**

```
Authorization: Bearer <token>
```

**Query Parameters:**

- `token` (optional): Token symbol (e.g., ETH, USDC). Defaults to ETH.

**Response:**

```json
{
  "success": true,
  "data": {
    "balance": "1.234567",
    "token": "ETH",
    "usdValue": "2469.34"
  }
}
```

### POST /wallets/transfer

Transfer tokens from the user's wallet to another address.

**Headers:**

```
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "to": "0x9876543210987654321098765432109876543210",
  "amount": "0.1",
  "token": "ETH"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Transfer initiated successfully",
  "data": {
    "transaction": {
      "hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "from": "0x1234567890123456789012345678901234567890",
      "to": "0x9876543210987654321098765432109876543210",
      "amount": "0.1",
      "token": "ETH",
      "status": "pending"
    }
  }
}
```

### GET /wallets/transactions

Get the transaction history for the user's wallet.

**Headers:**

```
Authorization: Bearer <token>
```

**Query Parameters:**

- `limit` (optional): Number of transactions to return. Defaults to 10.
- `offset` (optional): Number of transactions to skip. Defaults to 0.

**Response:**

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        "from": "0x1234567890123456789012345678901234567890",
        "to": "0x9876543210987654321098765432109876543210",
        "amount": "0.1",
        "token": "ETH",
        "status": "completed",
        "timestamp": "2023-01-01T00:00:00.000Z"
      }
    ],
    "total": 25,
    "limit": 10,
    "offset": 0
  }
}
```

### GET /wallets/gas-fee

Get estimated gas fees for transactions.

**Headers:**

```
Authorization: Bearer <token>
```

**Query Parameters:**

- `token` (optional): Token symbol for gas estimation. Defaults to ETH.

**Response:**

```json
{
  "success": true,
  "data": {
    "gasPrice": "20000000000",
    "gasLimit": "21000",
    "maxFee": "420000000000000",
    "estimatedCost": "0.00042",
    "token": "ETH"
  }
}
```

## Error Responses

All endpoints may return error responses with the following format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Additional error details (optional)"
  }
}
```

### Common Error Codes

- `UNAUTHORIZED` (401): Authentication required or invalid token
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (400): Request validation failed
- `INTERNAL_ERROR` (500): Internal server error
- `WALLET_ERROR`: Wallet operation failed
- `INSUFFICIENT_BALANCE`: Insufficient balance for operation
- `INVALID_ADDRESS`: Invalid wallet address provided

## Rate Limiting

API endpoints are rate-limited to prevent abuse. Standard limits are:

- Authentication endpoints: 10 requests per minute
- Wallet operations: 30 requests per minute
- Other endpoints: 100 requests per minute

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640995200
```

## SDK and Libraries

Official SDKs are available for:

- JavaScript/TypeScript
- Python
- Go

## Support

For API support and questions:

- Documentation: https://docs.moonex.com
- Support: support@moonex.com
- Status: https://status.moonex.com
