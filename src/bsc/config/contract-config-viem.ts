/**
 * Contract Configuration for Viem
 * Enhanced configurations and constants for BSC contracts using Viem
 */

import { Address, Hex, Chain } from 'viem';
import { BSC_CHAIN, BSC_TESTNET_CHAIN, VIEM_CONFIG } from '../../config/viem';
import logger from '../../utils/logger';

/**
 * Gas configuration for Viem transactions
 */
export interface GasConfig {
  gasLimit?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  gasPrice?: bigint;
  gasMultiplier?: number;
  enableDynamicFees?: boolean;
}

/**
 * Transaction timeout configuration
 */
export interface TimeoutConfig {
  transactionTimeout: number; // milliseconds
  confirmationTimeout: number; // milliseconds
  maxRetries: number;
  retryDelay: number; // milliseconds
  enableRetryOnFailure: boolean;
}

/**
 * Slippage configuration
 */
export interface SlippageConfig {
  low: number; // percentage
  medium: number; // percentage
  high: number; // percentage
  max: number; // percentage
  autoAdjust: boolean;
}

/**
 * Contract interaction configuration
 */
export interface ContractConfig {
  mode: 'read_only' | 'write' | 'simulate';
  timeout: TimeoutConfig;
  gas: GasConfig;
  slippage: SlippageConfig;
  enableCaching: boolean;
  enableBatching: boolean;
  enableWebSocket: boolean;
}

/**
 * Default gas configuration for Viem
 */
export const DEFAULT_GAS_CONFIG: GasConfig = {
  gasLimit: 210000n,
  maxFeePerGas: 10000000000n, // 10 Gwei
  maxPriorityFeePerGas: 5000000000n, // 5 Gwei
  gasPrice: 5000000000n, // 5 Gwei fallback
  gasMultiplier: 1.1,
  enableDynamicFees: true,
};

/**
 * Default timeout configuration
 */
export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  transactionTimeout: 30000, // 30 seconds
  confirmationTimeout: 60000, // 1 minute
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  enableRetryOnFailure: true,
};

/**
 * Default slippage configuration
 */
export const DEFAULT_SLIPPAGE_CONFIG: SlippageConfig = {
  low: 0.1,   // 0.1%
  medium: 0.5, // 0.5%
  high: 2.0,   // 2%
  max: 5.0,    // 5%
  autoAdjust: true,
};

/**
 * PancakeSwap contract addresses for BSC Mainnet
 */
export const PANCAKESWAP_MAINNET_ADDRESSES = {
  router: '0x10ED43C718714eb63d5aA57B78B54704E256024E' as Address,
  factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as Address,
  masterChefV1: '0x73feaa1eE314F8c655E354234017bE2193C9E24E' as Address,
  masterChefV2: '0xa5f8C5Dbd5F286960b9d8D4867a3baaC9455d4A9' as Address,
  cakeToken: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' as Address,
  wbnbToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Address,
  usdtToken: '0x55d398326f99059fF775485246999027B3197955' as Address,
  usdcToken: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' as Address,
  busdToken: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' as Address,
};

/**
 * PancakeSwap contract addresses for BSC Testnet
 */
export const PANCAKESWAP_TESTNET_ADDRESSES = {
  router: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1' as Address,
  factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as Address,
  masterChefV1: '0x41599A411A5F7F7d6195F4A5e5f8d5A3f9f2e7f1' as Address,
  masterChefV2: '0x41599A411A5F7F7d6195F4A5e5f8d5A3f9f2e7f2' as Address,
  cakeToken: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' as Address,
  wbnbToken: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd' as Address,
  usdtToken: '0xaB1a4d4f1D656d2450692d237fdD6C7f9146e814' as Address,
  usdcToken: '0x9A89392f3b6105eD3b8D6C0a9D8A2e7c6b5f9A9B' as Address,
  busdToken: '0x8301F2213c0eeD49a7E28aeceC4C03DBe0Df5a54' as Address,
};

/**
 * Default contract configuration
 */
export const DEFAULT_CONTRACT_CONFIG: ContractConfig = {
  mode: 'write',
  timeout: DEFAULT_TIMEOUT_CONFIG,
  gas: DEFAULT_GAS_CONFIG,
  slippage: DEFAULT_SLIPPAGE_CONFIG,
  enableCaching: true,
  enableBatching: VIEM_CONFIG.ENABLE_BATCH_REQUESTS,
  enableWebSocket: VIEM_CONFIG.ENABLE_WEBSOCKETS,
};

/**
 * Get current network contract addresses
 */
export const getCurrentNetworkAddresses = () => {
  const isTestnet = process.env.NODE_ENV === 'test' || process.env.BSC_NETWORK === 'testnet';

  if (isTestnet) {
    return {
      network: 'testnet',
      chain: BSC_TESTNET_CHAIN,
      addresses: PANCAKESWAP_TESTNET_ADDRESSES,
    };
  }

  return {
    network: 'mainnet',
    chain: BSC_CHAIN,
    addresses: PANCAKESWAP_MAINNET_ADDRESSES,
  };
};

/**
 * Get contract configuration for specific mode
 */
export const getContractConfig = (mode: 'read_only' | 'write' | 'simulate' = 'write'): ContractConfig => {
  return {
    ...DEFAULT_CONTRACT_CONFIG,
    mode,
    gas: mode === 'read_only' ? { ...DEFAULT_GAS_CONFIG, gasLimit: 50000n } : DEFAULT_GAS_CONFIG,
    timeout: mode === 'simulate' ?
      { ...DEFAULT_TIMEOUT_CONFIG, transactionTimeout: 10000 } :
      DEFAULT_TIMEOUT_CONFIG,
  };
};

/**
 * Get gas configuration for transaction type
 */
export const getGasConfig = (transactionType: 'simple' | 'complex' | 'defi' = 'simple'): GasConfig => {
  const baseConfig = { ...DEFAULT_GAS_CONFIG };

  switch (transactionType) {
    case 'simple':
      return {
        ...baseConfig,
        gasLimit: 21000n,
        gasMultiplier: 1.05,
      };
    case 'complex':
      return {
        ...baseConfig,
        gasLimit: 500000n,
        gasMultiplier: 1.2,
      };
    case 'defi':
      return {
        ...baseConfig,
        gasLimit: 1000000n,
        gasMultiplier: 1.3,
        enableDynamicFees: true,
      };
    default:
      return baseConfig;
  }
};

/**
 * Get timeout configuration for operation type
 */
export const getTimeoutConfig = (operation: 'read' | 'write' | 'batch' = 'write'): TimeoutConfig => {
  const baseConfig = { ...DEFAULT_TIMEOUT_CONFIG };

  switch (operation) {
    case 'read':
      return {
        ...baseConfig,
        transactionTimeout: 5000,
        maxRetries: 2,
      };
    case 'write':
      return baseConfig;
    case 'batch':
      return {
        ...baseConfig,
        transactionTimeout: 120000, // 2 minutes
        confirmationTimeout: 300000, // 5 minutes
        maxRetries: 5,
        retryDelay: 2000,
      };
    default:
      return baseConfig;
  }
};

/**
 * Get slippage configuration for trade type
 */
export const getSlippageConfig = (tradeType: 'stable' | 'volatile' | 'custom' = 'stable'): SlippageConfig => {
  const baseConfig = { ...DEFAULT_SLIPPAGE_CONFIG };

  switch (tradeType) {
    case 'stable':
      return {
        ...baseConfig,
        low: 0.05,
        medium: 0.1,
        high: 0.5,
      };
    case 'volatile':
      return {
        ...baseConfig,
        low: 0.5,
        medium: 1.0,
        high: 3.0,
        max: 10.0,
      };
    case 'custom':
      return baseConfig;
    default:
      return baseConfig;
  }
};

/**
 * Contract status enum
 */
export enum ContractStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  ERROR = 'error',
}

/**
 * Contract interaction modes
 */
export enum ContractMode {
  READ_ONLY = 'read_only',
  WRITE = 'write',
  SIMULATE = 'simulate',
  BATCH = 'batch',
}

/**
 * Contract types for configuration
 */
export enum ContractType {
  PANCAKESWAP_ROUTER = 'pancakeswap_router',
  PANCAKESWAP_FACTORY = 'pancakeswap_factory',
  PANCAKESWAP_PAIR = 'pancakeswap_pair',
  MASTERCHEF_V1 = 'masterchef_v1',
  MASTERCHEF_V2 = 'masterchef_v2',
  ERC20_TOKEN = 'erc20_token',
}

/**
 * Get contract address by type
 */
export const getContractAddress = (contractType: ContractType, customAddress?: Address): Address => {
  if (customAddress) {
    return customAddress;
  }

  const { addresses } = getCurrentNetworkAddresses();

  switch (contractType) {
    case ContractType.PANCAKESWAP_ROUTER:
      return addresses.router;
    case ContractType.PANCAKESWAP_FACTORY:
      return addresses.factory;
    case ContractType.MASTERCHEF_V1:
      return addresses.masterChefV1;
    case ContractType.MASTERCHEF_V2:
      return addresses.masterChefV2;
    case ContractType.ERC20_TOKEN:
      return addresses.cakeToken; // Default to CAKE token
    default:
      throw new Error(`Unknown contract type: ${contractType}`);
  }
};

/**
 * Validate contract address
 */
export const validateContractAddress = (address: Address | any, expectedType?: ContractType): boolean => {
  try {
    // Basic address validation
    if (!address || typeof address !== 'string' || !address.startsWith('0x') || address.length !== 42) {
      return false;
    }

    // Optional type-specific validation
    if (expectedType) {
      const expectedAddress = getContractAddress(expectedType);
      return address.toLowerCase() === expectedAddress.toLowerCase();
    }

    return true;
  } catch (error) {
    logger.error('Contract address validation failed: ' + (error as Error).message);
    return false;
  }
};

/**
 * Log contract configuration
 */
export const logContractConfig = (config: ContractConfig, contractType: ContractType) => {
  const { network } = getCurrentNetworkAddresses();

  logger.info('Contract Configuration Loaded');
  logger.info('Network: %s', network);
  logger.info('Contract Type: %s', contractType);
  logger.info('Mode: %s', config.mode);
  logger.info('Gas Limit: %s', config.gas.gasLimit?.toString() || 'auto');
  logger.info('Gas Multiplier: %s', config.gas.gasMultiplier);
  logger.info('Caching: %s', config.enableCaching ? 'Enabled' : 'Disabled');
  logger.info('Batching: %s', config.enableBatching ? 'Enabled' : 'Disabled');
  logger.info('WebSocket: %s', config.enableWebSocket ? 'Enabled' : 'Disabled');
};

/**
 * Create configuration for specific contract
 */
export const createContractConfig = (
  contractType: ContractType,
  options: Partial<ContractConfig> = {}
): ContractConfig => {
  const baseConfig = getContractConfig();
  const gasConfig = getGasConfig(contractType === ContractType.ERC20_TOKEN ? 'simple' : 'defi');

  return {
    ...baseConfig,
    ...options,
    gas: { ...gasConfig, ...options.gas },
    timeout: { ...baseConfig.timeout, ...options.timeout },
    slippage: { ...baseConfig.slippage, ...options.slippage },
  };
};

/**
 * Configuration exports
 */
export default {
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
};