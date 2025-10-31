import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { createServer } from '../index';

describe('API Integration Tests', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createServer();
    await server.listen({ port: 0 });
  });

  afterAll(async () => {
    await server.close();
  });

  test('GET / should return health status', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.statusCode).toBe(200);
    const result = JSON.parse(response.payload);
    expect(result.status).toBe('ok');
    expect(result.message).toBe('MoonEx API is running');
  });

  test('POST /api/v1/auth/email should handle email authentication request', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/email',
      payload: {
        email: 'test@example.com',
      },
    });

    expect(response.statusCode).toBe(200);
    const result = JSON.parse(response.payload);
    expect(result.success).toBeDefined();
  });

  test('GET /api/v1/auth/me should require authentication', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });

    expect(response.statusCode).toBe(401);
    const result = JSON.parse(response.payload);
    expect(result.error).toBeDefined();
  });

  test('POST /api/v1/wallets should require authentication', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/wallets',
    });

    expect(response.statusCode).toBe(401);
    const result = JSON.parse(response.payload);
    expect(result.error).toBeDefined();
  });

  test('GET /api/v1/wallets/test/balance should require authentication', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/wallets/0x1234567890123456789012345678901234567890/balance',
    });

    expect(response.statusCode).toBe(401);
    const result = JSON.parse(response.payload);
    expect(result.error).toBeDefined();
  });

  test('POST /api/v1/wallets/send should require authentication', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/wallets/send',
      payload: {
        walletAddress: '0x1234567890123456789012345678901234567890',
        to: '0x9876543210987654321098765432109876543210',
        value: '0.1',
        token: 'ETH',
      },
    });

    expect(response.statusCode).toBe(401);
    const result = JSON.parse(response.payload);
    expect(result.error).toBeDefined();
  });
});