import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * BSC Network Configuration
 */
export interface BSCConfig {
  chainId: number;
  rpcUrls: {
    primary: string;
    fallback: string[];
    testnet: string;
  };
  blockExplorerUrls: {
    mainnet: string;
    testnet: string;
  };
  gasConfig: {
    maxGasPrice: string; // in gwei
    defaultGasLimit: number;
    gasMultiplier: number;
  };
  contracts: {
    pancakeSwapRouter: string;
    pancakeSwapFactory: string;
    wbnb: string;
  };
  pancakeSwapApiV2: string;
  pancakeSwapSubgraph: string;
}

/**
 * Get BSC configuration from environment variables
 */
export const getBSCConfig = (): BSCConfig => {
  const chainId = parseInt(process.env.BSC_CHAIN_ID || '56', 10);
  const isTestnet = chainId === 97; // BSC Testnet

  return {
    chainId,
    rpcUrls: {
      primary: process.env.BSC_RPC_URL_PRIMARY || getPrimaryRPC(chainId),
      fallback: getFallbackRPCs(chainId),
      testnet: process.env.BSC_RPC_URL_TESTNET || 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    },
    blockExplorerUrls: {
      mainnet: process.env.BSC_EXPLORER_URL || 'https://bscscan.com',
      testnet: process.env.BSC_TESTNET_EXPLORER_URL || 'https://testnet.bscscan.com',
    },
    gasConfig: {
      maxGasPrice: process.env.BSC_MAX_GAS_PRICE || '10', // 10 gwei max for BSC
      defaultGasLimit: parseInt(process.env.BSC_DEFAULT_GAS_LIMIT || '210000', 10),
      gasMultiplier: parseFloat(process.env.BSC_GAS_MULTIPLIER || '1.1'),
    },
    contracts: {
      pancakeSwapRouter: process.env.PANCAKESWAP_ROUTER ||
        (isTestnet ? '0xD99D1c33F9fC3444f8101754aBC46c52416550D1' : '0x10ED43C718714eb63d5aA57B78B54704E256024E'),
      pancakeSwapFactory: process.env.PANCAKESWAP_FACTORY ||
        (isTestnet ? '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' : '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73'),
      wbnb: process.env.WBNB_ADDRESS ||
        (isTestnet ? '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd' : '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'),
    },
    pancakeSwapApiV2: process.env.PANCAKESWAP_API_V2 || 'https://api.pancakeswap.info/api/v2',
    pancakeSwapSubgraph: process.env.PANCAKESWAP_SUBGRAPH || 'https://api.thegraph.com/subgraphs/name/pancakeswap/exchange',
  };
};

/**
 * Get primary RPC URL based on chain
 */
function getPrimaryRPC(chainId: number): string {
  const rpcs: Record<number, string> = {
    56: 'https://bsc-dataseed1.binance.org/',
    97: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
  };
  return rpcs[chainId] || rpcs[56];
}

/**
 * Get fallback RPC URLs for redundancy
 */
function getFallbackRPCs(chainId: number): string[] {
  const fallbackRPCs: Record<number, string[]> = {
    56: [
      'https://bsc-dataseed2.binance.org/',
      'https://bsc-dataseed3.binance.org/',
      'https://bsc-dataseed4.binance.org/',
      'https://bsc-dataseed1.defibit.io/',
      'https://bsc-dataseed1.ninicoin.io/',
    ],
    97: [
      'https://data-seed-prebsc-2-s1.binance.org:8545/',
      'https://data-seed-prebsc-1-s2.binance.org:8545/',
    ],
  };
  return fallbackRPCs[chainId] || fallbackRPCs[56];
}

// Export singleton configuration
export const bscConfig = getBSCConfig();

// Log configuration (without sensitive data)
console.log('🔗 BSC Configuration loaded:', {
  chainId: bscConfig.chainId,
  primaryRPC: bscConfig.rpcUrls.primary.substring(0, 30) + '...',
  fallbackRPCs: bscConfig.rpcUrls.fallback.length,
  maxGasPrice: bscConfig.gasConfig.maxGasPrice,
  pancakeSwapRouter: bscConfig.contracts.pancakeSwapRouter.substring(0, 10) + '...',
});