/**
 * Contract Configuration
 * Default configurations and constants for BSC contracts
 */

import { BSC_CONFIG } from '../../config/bsc.js';

// Default gas configurations
export const DEFAULT_GAS_CONFIG = {
  gasLimit: 210000,
  maxGasPrice: BSC_CONFIG.DEFAULT_GAS_PRICE || '10',
  gasMultiplier: 1.1,
};

// Default transaction timeouts
export const DEFAULT_TIMEOUT_CONFIG = {
  transactionTimeout: 30000, // 30 seconds
  confirmationTimeout: 60000, // 1 minute
  maxRetries: 3,
};

// PancakeSwap contract addresses
export const PANCAKESWAP_CONFIG = {
  router: BSC_CONFIG.PANCAKESWAP_ROUTER || '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  factory: BSC_CONFIG.PANCAKESWAP_FACTORY || '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
  masterChef: BSC_CONFIG.MASTER_CHEF_V1 || '0x73feaa1eE314F8c655E354234017bE2193C9E24E',
  masterChefV2: BSC_CONFIG.MASTER_CHEF_V2 || '0xa5f8C5Dbd5F286960b9d8D4867a3baaC9455d4A9',
  cakeToken: BSC_CONFIG.CAKE_TOKEN || '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
  wbnbToken: BSC_CONFIG.WBNB_TOKEN || '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
};

// Default slippage tolerance
export const DEFAULT_SLIPPAGE = {
  low: 0.1,   // 0.1%
  medium: 0.5, // 0.5%
  high: 2.0,   // 2%
};

// Default deadline settings
export const DEFAULT_DEADLINE = {
  minutes: 20, // 20 minutes default deadline
};

// Contract interaction modes
export enum ContractMode {
  READ_ONLY = 'read_only',
  WRITE = 'write',
  SIMULATE = 'simulate',
}

// Contract status
export enum ContractStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
}