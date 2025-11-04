/**
 * BSC APR Calculation Types (Viem Compatible)
 * Defines comprehensive APR calculation data structures for Viem integration
 */

import { Address } from 'viem';

export interface APRCalculationInputViem {
  poolAddress: Address;
  liquidity: string;
  timeframe: string;
  feeRate?: number;
  volume24h?: string;
  volume7d?: string;
  impermanentLoss?: number;
}

export interface FarmAPRCalculationInputViem {
  farmId: string;
  poolAddress: Address;
  poolId: number;
  stakedAmount: string;
  totalStaked: string;
  rewardTokenPrice: number;
  rewardPerBlock: string;
  blocksPerDay: number;
  totalAllocPoint: number;
  allocPoint: number;
}

export interface CompoundAPRCalculationInputViem {
  principalAmount: string;
  baseAPR: number;
  compoundFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  timeframe: string;
  fees?: number;
}

export interface APRResultViem {
  apr: number;
  apy: number;
  dailyAPR: number;
  weeklyAPR: number;
  monthlyAPR: number;
  yearlyAPR: number;
  impermanentLossAdjustedAPR?: number;
  riskAdjustedAPR?: number;
  volatility: number;
  confidence: number;
  methodology: string;
  timestamp: number;
}

export interface FarmAPRResultViem extends APRResultViem {
  farmId: string;
  poolId: number;
  rewardTokenAPR: number;
  feeAPR: number;
  totalRewardsPerYear: string;
  rewardsUSDPerYear: number;
  roi: number;
  paybackPeriod: number;
}

export interface CompoundAPRResultViem {
  principalAmount: string;
  baseAPR: number;
  effectiveAPY: number;
  totalReturns: string;
  compoundGains: string;
  totalFees: string;
  netReturns: string;
  compoundFrequency: string;
  timeframe: string;
  growthCurve: {
    period: string;
    value: string;
    gains: string;
  }[];
}

export interface PoolAPRAnalyticsViem {
  poolAddress: Address;
  period: string;
  averageAPR: number;
  maxAPR: number;
  minAPR: number;
  volatility: number;
  trending: 'up' | 'down' | 'stable';
  volume: {
    daily: string;
    weekly: string;
    monthly: string;
  };
  liquidity: {
    current: string;
    change24h: number;
    change7d: number;
  };
  fees: {
    totalFees24h: string;
    totalFees7d: string;
    aprFromFees: number;
  };
  impermanentLoss: {
    current24h: number;
    average7d: number;
    max30d: number;
  };
  timestamp: number;
}

export interface APRComparisonViem {
  pools: {
    poolAddress: Address;
    apr: number;
    apy: number;
    volume: string;
    liquidity: string;
    risk: 'low' | 'medium' | 'high';
  }[];
  recommended: {
    poolAddress: Address;
    reason: string;
    expectedReturns: number;
  };
  analysis: {
    bestAPR: number;
    averageAPR: number;
    highestLiquidity: string;
    lowestRisk: Address;
  };
  timestamp: number;
}

export interface APRForecastViem {
  poolAddress: Address;
  forecastPeriod: string;
  methodology: string;
  assumptions: {
    volumeGrowth: number;
    liquidityGrowth: number;
    feeStability: number;
    marketConditions: 'bullish' | 'bearish' | 'neutral';
  };
  projections: {
    period: string;
    projectedAPR: number;
    confidence: number;
    factors: string[];
  }[];
  riskFactors: {
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    probability: number;
  }[];
  timestamp: number;
}

export interface APRMetricsViem {
  poolAddress: Address;
  timeframe: string;
  totalValueLocked: string;
  volume24h: string;
  volume7d: string;
  fees24h: string;
  fees7d: string;
  aprFees: number;
  aprRewards: number;
  aprTotal: number;
  apy: number;
  impermanentLoss24h: number;
  impermanentLoss7d: number;
  volatility30d: number;
  sharpeRatio: number;
  maxDrawdown: number;
  historicalData: {
    date: string;
    apr: number;
    volume: string;
    liquidity: string;
  }[];
  timestamp: number;
}

export interface APRServiceStatusViem {
  healthy: boolean;
  supportedPools: number;
  cacheHitRate: number;
  averageResponseTime: number;
  lastUpdate: number;
  dataFreshness: {
    priceData: number;
    volumeData: number;
    liquidityData: number;
  };
  timestamp: number;
}

export interface APRCalculationErrorViem {
  code: APRCalculationErrorCodeViem;
  message: string;
  poolAddress?: Address;
  details?: any;
  retryable?: boolean;
  suggestedAction?: string;
}

export enum APRCalculationErrorCodeViem {
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  INVALID_POOL = 'INVALID_POOL',
  PRICE_DATA_UNAVAILABLE = 'PRICE_DATA_UNAVAILABLE',
  VOLUME_DATA_UNAVAILABLE = 'VOLUME_DATA_UNAVAILABLE',
  CALCULATION_ERROR = 'CALCULATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  UNSTABLE_POOL = 'UNSTABLE_POOL',
  EXTREME_VALUES = 'EXTREME_VALUES'
}

export interface APRConfigViem {
  defaultTimeframe: string;
  riskFreeRate: number;
  volatilityWindow: number;
  minimumLiquidity: string;
  maximumAPR: number;
  confidenceThreshold: number;
  cacheDuration: number;
  updateFrequency: number;
  dataSources: {
    priceFeeds: Address[];
    volumeAPIs: string[];
    liquidityAPIs: string[];
  };
}

export interface APRAlertViem {
  type: 'opportunity' | 'risk' | 'trend_change' | 'volatility';
  poolAddress: Address;
  message: string;
  currentValue: number;
  previousValue?: number;
  change?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  timestamp: number;
}

// Input validation types
export interface APRValidationResultViem {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  normalizedInput?: any;
}

export interface APRCalculationContextViem {
  userAddress?: Address;
  slippageTolerance?: number;
  gasPrice?: string;
  transactionDeadline?: number;
  minimumReturn?: string;
}

export interface APRSimulationViem {
  scenario: 'optimistic' | 'realistic' | 'pessimistic';
  parameters: {
    volumeGrowth: number;
    liquidityGrowth: number;
    feeRate: number;
    impermanentLoss: number;
    compoundingFrequency: number;
  };
  results: {
    apr: number;
    apy: number;
    totalReturns: string;
    riskAdjustedReturns: number;
    probability: number;
  };
  sensitivity: {
    parameter: string;
    impact: number;
    description: string;
  }[];
}

export interface APRBenchmarkViem {
  poolAddress: Address;
  benchmarks: {
    category: string;
    value: number;
    percentile: number;
    description: string;
  }[];
  comparison: {
    betterThan: number;
    worseThan: number;
    averageRank: number;
  };
  recommendations: string[];
  timestamp: number;
}