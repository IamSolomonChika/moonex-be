import { http, webSocket, fallback } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import logger from '../utils/logger';

/**
 * Viem Configuration
 * Central configuration for Viem blockchain interactions
 */

export const VIEM_CONFIG = {
  // BSC Mainnet Configuration
  BSC_CHAIN_ID: 56,
  BSC_RPC_URL: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
  BSC_WSS_URL: process.env.BSC_WSS_URL || 'wss://bsc-ws-node.nariox.org:443',

  // BSC Testnet Configuration
  BSC_TESTNET_CHAIN_ID: 97,
  BSC_TESTNET_RPC_URL: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/',
  BSC_TESTNET_WSS_URL: process.env.BSC_TESTNET_WSS_URL || 'wss://bsc-testnet-ws.nariox.org:443',

  // Connection Configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  TIMEOUT: 30000,
  POLLING_INTERVAL: 4000,

  // WebSocket Configuration
  WS_RECONNECT_LIMIT: 5,
  WS_RECONNECT_DELAY: 2000,

  // Cache Configuration
  CACHE_TTL: 300000, // 5 minutes
  BATCH_SIZE: 100,

  // Gas Configuration
  GAS_MULTIPLIER: 1.1,
  MAX_PRIORITY_FEE_PER_GAS: '5000000000', // 5 Gwei

  // Performance Configuration
  ENABLE_BATCH_REQUESTS: true,
  ENABLE_WEBSOCKETS: true,
  ENABLE_CACHING: true,
} as const;

/**
 * BSC Chain configuration for Viem
 */
export const BSC_CHAIN = bsc;

/**
 * BSC Testnet configuration for Viem
 */
export const BSC_TESTNET_CHAIN = bscTestnet;

/**
 * Create HTTP transport for BSC
 */
export const createHttpTransport = () => {
  const transports = [
    http(VIEM_CONFIG.BSC_RPC_URL, {
      retryCount: VIEM_CONFIG.MAX_RETRIES,
      retryDelay: VIEM_CONFIG.RETRY_DELAY,
      timeout: VIEM_CONFIG.TIMEOUT,
    })
  ];

  // Add fallback RPC URLs if available
  const fallbackUrls = [
    'https://bsc-dataseed1.defibit.io/',
    'https://bsc-dataseed1.ninicoin.io/',
    'https://bsc-dataseed2.defibit.io/',
    'https://bsc-dataseed3.defibit.io/',
    'https://bsc-dataseed4.defibit.io/',
    'https://bsc-dataseed2.ninicoin.io/',
    'https://bsc-dataseed3.ninicoin.io/',
    'https://bsc-dataseed4.ninicoin.io/',
    'https://bsc-dataseed1.binance.org/',
    'https://bsc-dataseed2.binance.org/',
    'https://bsc-dataseed3.binance.org/',
    'https://bsc-dataseed4.binance.org/',
  ];

  fallbackUrls.forEach(url => {
    transports.push(
      http(url, {
        retryCount: VIEM_CONFIG.MAX_RETRIES,
        retryDelay: VIEM_CONFIG.RETRY_DELAY,
        timeout: VIEM_CONFIG.TIMEOUT,
      })
    );
  });

  return fallback(transports);
};

/**
 * Create WebSocket transport for BSC
 */
export const createWebSocketTransport = () => {
  return webSocket(VIEM_CONFIG.BSC_WSS_URL, {
    retryCount: VIEM_CONFIG.WS_RECONNECT_LIMIT,
    retryDelay: VIEM_CONFIG.WS_RECONNECT_DELAY,
  });
};

/**
 * Create Viem configuration for BSC
 */
export const createBscConfig = () => {
  return {
    chain: BSC_CHAIN,
    transport: createHttpTransport(),
    pollingInterval: VIEM_CONFIG.POLLING_INTERVAL,
    batch: {
      multicall: VIEM_CONFIG.ENABLE_BATCH_REQUESTS,
    },
  };
};

/**
 * Create Viem configuration for BSC with WebSocket
 */
export const createBscWebSocketConfig = () => {
  return {
    chain: BSC_CHAIN,
    transport: createWebSocketTransport(),
    batch: {
      multicall: VIEM_CONFIG.ENABLE_BATCH_REQUESTS,
    },
  };
};

/**
 * Create Viem configuration for BSC Testnet
 */
export const createBscTestnetConfig = () => {
  return {
    chain: BSC_TESTNET_CHAIN,
    transport: http(VIEM_CONFIG.BSC_TESTNET_RPC_URL, {
      retryCount: VIEM_CONFIG.MAX_RETRIES,
      retryDelay: VIEM_CONFIG.RETRY_DELAY,
      timeout: VIEM_CONFIG.TIMEOUT,
    }),
    pollingInterval: VIEM_CONFIG.POLLING_INTERVAL,
    batch: {
      multicall: VIEM_CONFIG.ENABLE_BATCH_REQUESTS,
    },
  };
};

/**
 * Get current chain configuration based on environment
 */
export const getCurrentChainConfig = () => {
  const isTestnet = process.env.NODE_ENV === 'test' || process.env.BSC_NETWORK === 'testnet';

  if (isTestnet) {
    return {
      chain: BSC_TESTNET_CHAIN,
      config: createBscTestnetConfig(),
      chainId: VIEM_CONFIG.BSC_TESTNET_CHAIN_ID,
    };
  }

  return {
    chain: BSC_CHAIN,
    config: createBscConfig(),
    chainId: VIEM_CONFIG.BSC_CHAIN_ID,
  };
};

/**
 * Log Viem configuration status
 */
export const logViemConfig = () => {
  const currentConfig = getCurrentChainConfig();

  logger.info('Viem Configuration Loaded');
  logger.info('Network: %s', currentConfig.chain.name);
  logger.info('Chain ID: %d', currentConfig.chainId);
  logger.info('Batch Requests: %s', VIEM_CONFIG.ENABLE_BATCH_REQUESTS ? 'Enabled' : 'Disabled');
  logger.info('WebSockets: %s', VIEM_CONFIG.ENABLE_WEBSOCKETS ? 'Enabled' : 'Disabled');
  logger.info('Caching: %s', VIEM_CONFIG.ENABLE_CACHING ? 'Enabled' : 'Disabled');
};

export default {
  VIEM_CONFIG,
  BSC_CHAIN,
  BSC_TESTNET_CHAIN,
  createHttpTransport,
  createWebSocketTransport,
  createBscConfig,
  createBscWebSocketConfig,
  createBscTestnetConfig,
  getCurrentChainConfig,
  logViemConfig,
};