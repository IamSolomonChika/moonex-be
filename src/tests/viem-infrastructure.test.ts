import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

/**
 * Test Viem Infrastructure Migration
 * These tests validate that Viem infrastructure is properly set up
 * and functioning as expected during the Ethers.js to Viem migration.
 */

describe('Viem Infrastructure Tests', () => {
  describe('Viem Configuration', () => {
    it('should import Viem configuration successfully', async () => {
      // This test will fail initially (RED phase)
      const viemConfig = await import('../config/viem.js');
      expect(viemConfig.VIEM_CONFIG).toBeDefined();
      expect(viemConfig.VIEM_CONFIG.BSC_CHAIN_ID).toBe(56);
      expect(viemConfig.VIEM_CONFIG.BSC_RPC_URL).toBeDefined();
    });

    it('should have BSC chain configuration', async () => {
      const { BSC_CHAIN } = await import('../config/viem.js');
      expect(BSC_CHAIN).toBeDefined();
      expect(BSC_CHAIN.id).toBe(56);
      expect(BSC_CHAIN.name).toBe('BNB Smart Chain');
    });
  });

  describe('Viem Provider', () => {
    it('should create Viem provider successfully', async () => {
      // This will fail until viem-provider.ts is created
      const viemProvider = await import('../bsc/providers/viem-provider.js');
      expect(viemProvider.createViemClient).toBeDefined();
      expect(typeof viemProvider.createViemClient).toBe('function');
    });

    it('should establish connection to BSC network', async () => {
      const { createViemClient } = await import('../bsc/providers/viem-provider.js');
      const client = createViemClient();
      expect(client).toBeDefined();
      expect(await client.getChainId()).toBe(56);
    });

    it('should support WebSocket connections', async () => {
      const { createWebSocketClient } = await import('../bsc/providers/viem-provider.js');
      const wsClient = createWebSocketClient();
      expect(wsClient).toBeDefined();
      expect(wsClient.transport.name).toContain('websocket');
    });
  });

  describe('Viem Types', () => {
    it('should have Viem-specific type definitions', async () => {
      // This will fail until types are created
      const viemTypes = await import('../types/viem.js');
      expect(viemTypes.ViemClient).toBeDefined();
      expect(viemTypes.ViemContract).toBeDefined();
      expect(viemTypes.BSCContractTypes).toBeDefined();
    });

    it('should provide type-safe contract interfaces', async () => {
      const { PancakeSwapRouter, PancakeSwapPair } = await import('../types/viem.js');
      expect(PancakeSwapRouter).toBeDefined();
      expect(PancakeSwapPair).toBeDefined();
    });
  });

  describe('Viem Utilities', () => {
    it('should provide Viem client utilities', async () => {
      const viemUtils = await import('../bsc/utils/viem-utils.js');
      expect(viemUtils.createBatchClient).toBeDefined();
      expect(viemUtils.estimateGasOptimized).toBeDefined();
      expect(viemUtils.buildTransaction).toBeDefined();
    });

    it('should provide contract interaction helpers', async () => {
      const contractHelpers = await import('../bsc/utils/contract-helpers.js');
      expect(contractHelpers.createContract).toBeDefined();
      expect(contractHelpers.callReadFunction).toBeDefined();
      expect(contractHelpers.callWriteFunction).toBeDefined();
    });

    it('should provide event monitoring utilities', async () => {
      const eventUtils = await import('../bsc/utils/event-utils.js');
      expect(eventUtils.setupEventListeners).toBeDefined();
      expect(eventUtils.filterEvents).toBeDefined();
      expect(eventUtils.parseEventLogs).toBeDefined();
    });
  });

  describe('Package Dependencies', () => {
    it('should have Viem in dependencies', async () => {
      const packageJson = await import('../../package.json');
      expect(packageJson.default.dependencies).toHaveProperty('viem');
    });

    it('should not have Ethers.js in dependencies', async () => {
      const packageJson = await import('../../package.json');
      expect(packageJson.default.dependencies).not.toHaveProperty('ethers');
    });
  });

  describe('Error Handling', () => {
    it('should provide Viem-specific error handling', async () => {
      const errorHandlers = await import('../bsc/utils/viem-errors.js');
      expect(errorHandlers.handleViemError).toBeDefined();
      expect(errorHandlers.isRpcError).toBeDefined();
      expect(errorHandlers.isContractError).toBeDefined();
    });

    it('should provide retry mechanisms', async () => {
      const retryUtils = await import('../bsc/utils/viem-retry.js');
      expect(retryUtils.withRetry).toBeDefined();
      expect(retryUtils.exponentialBackoff).toBeDefined();
    });
  });
});