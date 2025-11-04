// BSC Network Configuration
export const BSC_CONFIG = {
  // Network settings
  BSC_CHAIN_ID: 56,
  BSC_RPC_URL: 'https://bsc-dataseed1.binance.org',
  BSC_TESTNET_RPC_URL: 'https://data-seed-prebsc-1-s1.binance.org:8545',

  // Contract addresses
  PANCAKESWAP_FACTORY: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
  PANCAKESWAP_ROUTER: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  MASTER_CHEF_V1: '0x73feaa1eE314F8c655E354234017bE2193C9E24E',
  MASTER_CHEF_V2: '0xa5f8C5Dbd5F286960b9d8D4867a3baaC9455d4A9',
  CAKE_TOKEN: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
  WBNB_TOKEN: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',

  // API endpoints
  PANCAKESWAP_API: 'https://api.pancakeswap.info/api/v2',
  BSC_SCAN_API: 'https://api.bscscan.com/api',

  // Gas settings
  DEFAULT_GAS_LIMIT: 21000,
  DEFAULT_GAS_PRICE: '5',

  // Time settings
  BLOCK_TIME: 3000, // 3 seconds
  BLOCKS_PER_DAY: 28800,

  // Other settings
  MIN_TRADE_AMOUNT: '0.001',
  MAX_SLIPPAGE_PERCENT: 5,
  DEFAULT_SLIPPAGE_PERCENT: 0.5,
};

export default BSC_CONFIG;