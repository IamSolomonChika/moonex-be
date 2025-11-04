import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  DEFAULT_GAS_CONFIG,
  DEFAULT_TIMEOUT_CONFIG,
  DEFAULT_SLIPPAGE_CONFIG,
  DEFAULT_CONTRACT_CONFIG,
  PANCAKESWAP_MAINNET_ADDRESSES,
  PANCAKESWAP_TESTNET_ADDRESSES,
  getCurrentNetworkAddresses,
  getContractConfig,
  getGasConfig,
  getTimeoutConfig,
  getSlippageConfig,
  getContractAddress,
  validateContractAddress,
  createContractConfig,
  logContractConfig,
  ContractStatus,
  ContractMode,
  ContractType,
} from '../bsc/config/contract-config-viem';

/**
 * Test Contract Configuration for Viem
 * These tests validate that contract configuration utilities are properly migrated to Viem
 * and functioning as expected during the Ethers.js to Viem migration.
 */

describe('Contract Configuration Viem Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore environment after each test
    process.env = originalEnv;
  });

  describe('Default Configurations', () => {
    it('should have correct default gas configuration', () => {
      expect(DEFAULT_GAS_CONFIG.gasLimit).toBe(210000n);
      expect(DEFAULT_GAS_CONFIG.maxFeePerGas).toBe(10000000000n);
      expect(DEFAULT_GAS_CONFIG.maxPriorityFeePerGas).toBe(5000000000n);
      expect(DEFAULT_GAS_CONFIG.gasPrice).toBe(5000000000n);
      expect(DEFAULT_GAS_CONFIG.gasMultiplier).toBe(1.1);
      expect(DEFAULT_GAS_CONFIG.enableDynamicFees).toBe(true);
    });

    it('should have correct default timeout configuration', () => {
      expect(DEFAULT_TIMEOUT_CONFIG.transactionTimeout).toBe(30000);
      expect(DEFAULT_TIMEOUT_CONFIG.confirmationTimeout).toBe(60000);
      expect(DEFAULT_TIMEOUT_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_TIMEOUT_CONFIG.retryDelay).toBe(1000);
      expect(DEFAULT_TIMEOUT_CONFIG.enableRetryOnFailure).toBe(true);
    });

    it('should have correct default slippage configuration', () => {
      expect(DEFAULT_SLIPPAGE_CONFIG.low).toBe(0.1);
      expect(DEFAULT_SLIPPAGE_CONFIG.medium).toBe(0.5);
      expect(DEFAULT_SLIPPAGE_CONFIG.high).toBe(2.0);
      expect(DEFAULT_SLIPPAGE_CONFIG.max).toBe(5.0);
      expect(DEFAULT_SLIPPAGE_CONFIG.autoAdjust).toBe(true);
    });

    it('should have correct default contract configuration', () => {
      expect(DEFAULT_CONTRACT_CONFIG.mode).toBe('write');
      expect(DEFAULT_CONTRACT_CONFIG.enableCaching).toBe(true);
      expect(DEFAULT_CONTRACT_CONFIG.enableBatching).toBe(true);
      expect(DEFAULT_CONTRACT_CONFIG.enableWebSocket).toBe(true);
      expect(DEFAULT_CONTRACT_CONFIG.gas).toEqual(DEFAULT_GAS_CONFIG);
      expect(DEFAULT_CONTRACT_CONFIG.timeout).toEqual(DEFAULT_TIMEOUT_CONFIG);
      expect(DEFAULT_CONTRACT_CONFIG.slippage).toEqual(DEFAULT_SLIPPAGE_CONFIG);
    });
  });

  describe('Network Configuration', () => {
    it('should return mainnet configuration by default', () => {
      const config = getCurrentNetworkAddresses();

      expect(config.network).toBe('mainnet');
      expect(config.chain.name).toBe('BNB Smart Chain');
      expect(config.chain.id).toBe(56);
      expect(config.addresses).toEqual(PANCAKESWAP_MAINNET_ADDRESSES);
    });

    it('should return testnet configuration in test environment', () => {
      process.env.NODE_ENV = 'test';
      const config = getCurrentNetworkAddresses();

      expect(config.network).toBe('testnet');
      expect(config.chain.name).toBe('BNB Smart Chain Testnet');
      expect(config.chain.id).toBe(97);
      expect(config.addresses).toEqual(PANCAKESWAP_TESTNET_ADDRESSES);
    });

    it('should return testnet configuration when BSC_NETWORK is testnet', () => {
      process.env.BSC_NETWORK = 'testnet';
      const config = getCurrentNetworkAddresses();

      expect(config.network).toBe('testnet');
      expect(config.addresses).toEqual(PANCAKESWAP_TESTNET_ADDRESSES);
    });

    it('should have valid contract addresses', () => {
      const mainnetAddresses = PANCAKESWAP_MAINNET_ADDRESSES;
      const testnetAddresses = PANCAKESWAP_TESTNET_ADDRESSES;

      // Test mainnet addresses
      expect(mainnetAddresses.router).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(mainnetAddresses.factory).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(mainnetAddresses.masterChefV1).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(mainnetAddresses.masterChefV2).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(mainnetAddresses.cakeToken).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(mainnetAddresses.wbnbToken).toMatch(/^0x[a-fA-F0-9]{40}$/);

      // Test testnet addresses
      expect(testnetAddresses.router).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(testnetAddresses.factory).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(testnetAddresses.cakeToken).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(testnetAddresses.wbnbToken).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe('Contract Configuration', () => {
    it('should return write mode configuration by default', () => {
      const config = getContractConfig();

      expect(config.mode).toBe('write');
      expect(config.gas.gasLimit).toBe(210000n);
      expect(config.timeout.transactionTimeout).toBe(30000);
    });

    it('should return read only configuration', () => {
      const config = getContractConfig('read_only');

      expect(config.mode).toBe('read_only');
      expect(config.gas.gasLimit).toBe(50000n); // Lower gas limit for read-only
    });

    it('should return simulate configuration', () => {
      const config = getContractConfig('simulate');

      expect(config.mode).toBe('simulate');
      expect(config.timeout.transactionTimeout).toBe(10000); // Shorter timeout for simulation
    });

    it('should return write configuration explicitly', () => {
      const config = getContractConfig('write');

      expect(config.mode).toBe('write');
      expect(config.gas.gasLimit).toBe(210000n);
      expect(config.timeout.transactionTimeout).toBe(30000);
    });
  });

  describe('Gas Configuration', () => {
    it('should return simple gas configuration', () => {
      const config = getGasConfig('simple');

      expect(config.gasLimit).toBe(21000n);
      expect(config.gasMultiplier).toBe(1.05);
    });

    it('should return complex gas configuration', () => {
      const config = getGasConfig('complex');

      expect(config.gasLimit).toBe(500000n);
      expect(config.gasMultiplier).toBe(1.2);
    });

    it('should return defi gas configuration', () => {
      const config = getGasConfig('defi');

      expect(config.gasLimit).toBe(1000000n);
      expect(config.gasMultiplier).toBe(1.3);
      expect(config.enableDynamicFees).toBe(true);
    });

    it('should return default gas configuration for unknown type', () => {
      const config = getGasConfig('unknown' as any);

      expect(config.gasLimit).toBe(210000n);
      expect(config.gasMultiplier).toBe(1.1);
    });
  });

  describe('Timeout Configuration', () => {
    it('should return read timeout configuration', () => {
      const config = getTimeoutConfig('read');

      expect(config.transactionTimeout).toBe(5000);
      expect(config.maxRetries).toBe(2);
    });

    it('should return write timeout configuration', () => {
      const config = getTimeoutConfig('write');

      expect(config.transactionTimeout).toBe(30000);
      expect(config.confirmationTimeout).toBe(60000);
      expect(config.maxRetries).toBe(3);
    });

    it('should return batch timeout configuration', () => {
      const config = getTimeoutConfig('batch');

      expect(config.transactionTimeout).toBe(120000); // 2 minutes
      expect(config.confirmationTimeout).toBe(300000); // 5 minutes
      expect(config.maxRetries).toBe(5);
      expect(config.retryDelay).toBe(2000);
    });

    it('should return default timeout configuration for unknown type', () => {
      const config = getTimeoutConfig('unknown' as any);

      expect(config.transactionTimeout).toBe(30000);
      expect(config.maxRetries).toBe(3);
    });
  });

  describe('Slippage Configuration', () => {
    it('should return stable slippage configuration', () => {
      const config = getSlippageConfig('stable');

      expect(config.low).toBe(0.05);
      expect(config.medium).toBe(0.1);
      expect(config.high).toBe(0.5);
    });

    it('should return volatile slippage configuration', () => {
      const config = getSlippageConfig('volatile');

      expect(config.low).toBe(0.5);
      expect(config.medium).toBe(1.0);
      expect(config.high).toBe(3.0);
      expect(config.max).toBe(10.0);
    });

    it('should return custom slippage configuration', () => {
      const config = getSlippageConfig('custom');

      expect(config.low).toBe(0.1);
      expect(config.medium).toBe(0.5);
      expect(config.high).toBe(2.0);
      expect(config.max).toBe(5.0);
    });

    it('should return default slippage configuration for unknown type', () => {
      const config = getSlippageConfig('unknown' as any);

      expect(config.low).toBe(0.1);
      expect(config.medium).toBe(0.5);
      expect(config.high).toBe(2.0);
    });
  });

  describe('Contract Address Management', () => {
    it('should return correct contract addresses', () => {
      const routerAddress = getContractAddress(ContractType.PANCAKESWAP_ROUTER);
      const factoryAddress = getContractAddress(ContractType.PANCAKESWAP_FACTORY);
      const masterChefV1Address = getContractAddress(ContractType.MASTERCHEF_V1);
      const cakeTokenAddress = getContractAddress(ContractType.ERC20_TOKEN);

      expect(routerAddress).toBe(PANCAKESWAP_MAINNET_ADDRESSES.router);
      expect(factoryAddress).toBe(PANCAKESWAP_MAINNET_ADDRESSES.factory);
      expect(masterChefV1Address).toBe(PANCAKESWAP_MAINNET_ADDRESSES.masterChefV1);
      expect(cakeTokenAddress).toBe(PANCAKESWAP_MAINNET_ADDRESSES.cakeToken);
    });

    it('should return custom address when provided', () => {
      const customAddress = '0x1234567890123456789012345678901234567890' as const;
      const address = getContractAddress(ContractType.PANCAKESWAP_ROUTER, customAddress);

      expect(address).toBe(customAddress);
    });

    it('should throw error for unknown contract type', () => {
      expect(() => {
        getContractAddress('unknown' as ContractType);
      }).toThrow('Unknown contract type: unknown');
    });

    it('should validate correct contract addresses', () => {
      const validAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const;

      expect(validateContractAddress(validAddress)).toBe(true);
      expect(validateContractAddress(validAddress, ContractType.ERC20_TOKEN)).toBe(false); // Not the expected CAKE token address
    });

    it('should reject invalid contract addresses', () => {
      const invalidAddress = '0xinvalid' as const;
      const shortAddress = '0x123456789012345678901234567890123456789' as const; // 39 chars
      const longAddress = '0x12345678901234567890123456789012345678901' as const; // 43 chars

      expect(validateContractAddress(invalidAddress)).toBe(false);
      expect(validateContractAddress(shortAddress)).toBe(false);
      expect(validateContractAddress(longAddress)).toBe(false);
      expect(validateContractAddress('0x' as any)).toBe(false);
    });

    it('should validate addresses against expected type', () => {
      const routerAddress = PANCAKESWAP_MAINNET_ADDRESSES.router;

      expect(validateContractAddress(routerAddress, ContractType.PANCAKESWAP_ROUTER)).toBe(true);
      expect(validateContractAddress(routerAddress, ContractType.PANCAKESWAP_FACTORY)).toBe(false);
    });
  });

  describe('Custom Contract Configuration', () => {
    it('should create custom configuration with overrides', () => {
      const customConfig = createContractConfig(ContractType.PANCAKESWAP_ROUTER, {
        mode: 'read_only',
        gas: { gasLimit: 50000n },
        timeout: { transactionTimeout: 10000, confirmationTimeout: 60000, maxRetries: 3, retryDelay: 1000, enableRetryOnFailure: true },
      });

      expect(customConfig.mode).toBe('read_only');
      expect(customConfig.gas.gasLimit).toBe(50000n);
      expect(customConfig.timeout.transactionTimeout).toBe(10000);
      expect(customConfig.slippage).toEqual(DEFAULT_SLIPPAGE_CONFIG);
    });

    it('should create ERC20 token configuration', () => {
      const tokenConfig = createContractConfig(ContractType.ERC20_TOKEN);

      expect(tokenConfig.gas.gasLimit).toBe(21000n); // Simple gas config for ERC20
    });

    it('should create DeFi configuration for complex contracts', () => {
      const defiConfig = createContractConfig(ContractType.PANCAKESWAP_ROUTER);

      expect(defiConfig.gas.gasLimit).toBe(1000000n); // DeFi gas config for router
    });

    it('should merge custom options correctly', () => {
      const customConfig = createContractConfig(ContractType.MASTERCHEF_V1, {
        gas: {
          gasMultiplier: 2.0,
          enableDynamicFees: false,
        },
        slippage: {
          low: 0.1,
          medium: 0.5,
          high: 5.0,
          max: 5.0,
          autoAdjust: false,
        },
      });

      expect(customConfig.gas.gasMultiplier).toBe(2.0);
      expect(customConfig.gas.enableDynamicFees).toBe(false);
      expect(customConfig.slippage.high).toBe(5.0);
      expect(customConfig.slippage.autoAdjust).toBe(false);
    });
  });

  describe('Enum Values', () => {
    it('should have correct contract status enum values', () => {
      expect(ContractStatus.ACTIVE).toBe('active');
      expect(ContractStatus.INACTIVE).toBe('inactive');
      expect(ContractStatus.MAINTENANCE).toBe('maintenance');
      expect(ContractStatus.ERROR).toBe('error');
    });

    it('should have correct contract mode enum values', () => {
      expect(ContractMode.READ_ONLY).toBe('read_only');
      expect(ContractMode.WRITE).toBe('write');
      expect(ContractMode.SIMULATE).toBe('simulate');
      expect(ContractMode.BATCH).toBe('batch');
    });

    it('should have correct contract type enum values', () => {
      expect(ContractType.PANCAKESWAP_ROUTER).toBe('pancakeswap_router');
      expect(ContractType.PANCAKESWAP_FACTORY).toBe('pancakeswap_factory');
      expect(ContractType.PANCAKESWAP_PAIR).toBe('pancakeswap_pair');
      expect(ContractType.MASTERCHEF_V1).toBe('masterchef_v1');
      expect(ContractType.MASTERCHEF_V2).toBe('masterchef_v2');
      expect(ContractType.ERC20_TOKEN).toBe('erc20_token');
    });
  });

  describe('Configuration Logging', () => {
    it('should log configuration without throwing errors', () => {
      const config = getContractConfig();

      expect(() => {
        logContractConfig(config, ContractType.PANCAKESWAP_ROUTER);
      }).not.toThrow();
    });

    it('should log different contract types', () => {
      const config = createContractConfig(ContractType.ERC20_TOKEN);

      expect(() => {
        logContractConfig(config, ContractType.ERC20_TOKEN);
      }).not.toThrow();
    });
  });

  describe('Environment Integration', () => {
    it('should adapt to test environment', () => {
      process.env.NODE_ENV = 'test';

      const networkConfig = getCurrentNetworkAddresses();
      const contractConfig = createContractConfig(ContractType.PANCAKESWAP_ROUTER);

      expect(networkConfig.network).toBe('testnet');
      expect(contractConfig.gas.gasLimit).toBe(1000000n); // DeFi config
    });

    it('should adapt to custom network setting', () => {
      process.env.BSC_NETWORK = 'mainnet';

      const networkConfig = getCurrentNetworkAddresses();

      expect(networkConfig.network).toBe('mainnet');
    });

    it('should handle missing environment variables', () => {
      delete process.env.NODE_ENV;
      delete process.env.BSC_NETWORK;

      const networkConfig = getCurrentNetworkAddresses();

      expect(networkConfig.network).toBe('mainnet');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid environment gracefully', () => {
      process.env.NODE_ENV = 'invalid';

      expect(() => {
        getCurrentNetworkAddresses();
      }).not.toThrow();
    });

    it('should handle configuration merging errors', () => {
      const invalidConfig = {
        gas: {
          gasLimit: 'invalid' as any,
        },
      };

      expect(() => {
        createContractConfig(ContractType.PANCAKESWAP_ROUTER, invalidConfig);
      }).not.toThrow();
    });

    it('should handle address validation errors', () => {
      expect(validateContractAddress(null as any)).toBe(false);
      expect(validateContractAddress(undefined as any)).toBe(false);
      expect(validateContractAddress(123 as any)).toBe(false);
    });
  });

  describe('Performance Tests', () => {
    it('should handle rapid configuration access', () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        getCurrentNetworkAddresses();
        getContractConfig();
        getGasConfig('defi');
        getTimeoutConfig('batch');
        getSlippageConfig('volatile');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle multiple contract configurations', () => {
      const startTime = Date.now();

      const contractTypes = [
        ContractType.PANCAKESWAP_ROUTER,
        ContractType.PANCAKESWAP_FACTORY,
        ContractType.MASTERCHEF_V1,
        ContractType.MASTERCHEF_V2,
        ContractType.ERC20_TOKEN,
      ];

      for (let i = 0; i < 100; i++) {
        contractTypes.forEach(type => {
          createContractConfig(type);
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500); // Should complete within 0.5 seconds
    });
  });

  describe('Integration Tests', () => {
    it('should work together across all components', () => {
      // Test complete workflow
      const networkConfig = getCurrentNetworkAddresses();
      const contractConfig = createContractConfig(ContractType.PANCAKESWAP_ROUTER);
      const contractAddress = getContractAddress(ContractType.PANCAKESWAP_ROUTER);
      const isValidAddress = validateContractAddress(contractAddress, ContractType.PANCAKESWAP_ROUTER);

      expect(networkConfig.network).toBe('mainnet');
      expect(contractConfig.mode).toBe('write');
      expect(contractAddress).toBe(PANCAKESWAP_MAINNET_ADDRESSES.router);
      expect(isValidAddress).toBe(true);
    });

    it('should handle configuration switching', () => {
      // Test switching between modes
      const readConfig = getContractConfig('read_only');
      const writeConfig = getContractConfig('write');
      const simulateConfig = getContractConfig('simulate');

      expect(readConfig.mode).toBe('read_only');
      expect(writeConfig.mode).toBe('write');
      expect(simulateConfig.mode).toBe('simulate');

      expect(readConfig.gas.gasLimit).toBeLessThan(writeConfig.gas.gasLimit);
      expect(simulateConfig.timeout.transactionTimeout).toBeLessThan(writeConfig.timeout.transactionTimeout);
    });

    it('should handle network switching', () => {
      // Test mainnet
      process.env.NODE_ENV = 'production';
      const mainnetConfig = getCurrentNetworkAddresses();

      // Test testnet
      process.env.NODE_ENV = 'test';
      const testnetConfig = getCurrentNetworkAddresses();

      expect(mainnetConfig.network).toBe('mainnet');
      expect(testnetConfig.network).toBe('testnet');
      expect(mainnetConfig.chain.id).toBe(56);
      expect(testnetConfig.chain.id).toBe(97);
    });
  });
});