/**
 * BSC Impermanent Loss Calculation Types (Viem Compatible)
 * Defines comprehensive impermanent loss data structures for Viem integration
 */

import { Address, Hex } from 'viem';

export interface ImpermanentLossCalculationViem {
  // Initial state
  initialPrices: {
    price0: number;
    price1: number;
    ratio: number;
  };
  initialAmounts: {
    amount0: string;
    amount1: string;
    value0USD: number;
    value1USD: number;
    totalValueUSD: number;
  };

  // Current state
  currentPrices: {
    price0: number;
    price1: number;
    ratio: number;
  };
  currentAmounts: {
    amount0: string;
    amount1: string;
    value0USD: number;
    value1USD: number;
    totalValueUSD: number;
  };

  // Impermanent loss calculation
  impermanentLoss: number;
  impermanentLossUSD: number;
  impermanentLossPercentage: number;

  // Hold value comparison
  holdValueUSD: number;
  liquidityValueUSD: number;
  differenceUSD: number;
  differencePercentage: number;

  // Time metrics
  duration: number;
  annualizedIL: number;

  // Risk assessment
  riskLevel: LiquidityRiskLevelViem;
  recommendations: string[];
}

export interface ImpermanentLossMetricsViem {
  poolAddress: Address;
  timeframe: string;
  averageIL: number;
  maxIL: number;
  totalILUSD: number;
  affectedPositions: number;
  totalPositions: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    very_high: number;
  };
  timestamp: number;
}

export interface ImpermanentLossRiskAssessmentViem {
  riskLevel: LiquidityRiskLevelViem;
  maxIL: number;
  probability: number;
  recommendations: string[];
}

export interface ImpermanentLossPredictionViem {
  estimatedIL: number;
  confidence: number;
  methodology: string;
}

export interface ImpermanentLossHistoryViem {
  positionId: string;
  calculations: ImpermanentLossCalculationViem[];
  summary: {
    averageIL: number;
    maxIL: number;
    currentIL: number;
    totalLossUSD: number;
    duration: number;
  };
}

export interface ImpermanentLossHistoricalAnalysisViem {
  poolAddress: Address;
  period: string;
  averageIL: number;
  volatility: number;
  maxIL: number;
  recoveryTimes: number[];
  seasonalPatterns: any[];
  correlations: any[];
  timestamp: number;
}

export interface ImpermanentLossStrategyComparisonViem {
  poolAddress: Address;
  strategies: ImpermanentLossStrategyViem[];
  recommendation: string;
  timestamp: number;
}

export interface ImpermanentLossStrategyViem {
  name: string;
  description: string;
  expectedIL: number;
  risk: string;
  timeframe: string;
}

export interface ImpermanentLossWorstCaseViem {
  scenarios: {
    priceChange: number;
    IL: number;
    probability: number;
  }[];
  maxIL: number;
  recommendedAction: string;
}

export interface ImpermanentLossServiceStatusViem {
  healthy: boolean;
  trackedPositions: number;
  volatilityDataPoints: number;
  riskThresholds: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    VERY_HIGH: number;
  };
  timestamp: number;
}

export interface VolatilityDataViem {
  dailyVolatility: number;
  weeklyVolatility: number;
  monthlyVolatility?: number;
  lastUpdated: number;
}

export enum LiquidityRiskLevelViem {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

// Input types for impermanent loss calculations
export interface ImpermanentLossInputViem {
  initialAmounts: {
    amount0: string;
    amount1: string;
  };
  initialPrices: {
    price0: number;
    price1: number;
  };
  currentAmounts: {
    amount0: string;
    amount1: string;
  };
  currentPrices: {
    price0: number;
    price1: number;
  };
}

export interface PositionTrackingInputViem {
  positionId: string;
  userAddress: Address;
  poolAddress: Address;
  amount0: string;
  amount1: string;
}

export interface ILRiskAssessmentInputViem {
  poolAddress: Address;
  positionSize: number;
  timeframe?: string;
}

export interface ILPredictionInputViem {
  poolAddress: Address;
  priceChange: number;
  timeframe: string;
}

// Error types specific to impermanent loss calculations
export interface ImpermanentLossErrorViem {
  code: ImpermanentLossErrorCodeViem;
  message: string;
  details?: any;
  retryable?: boolean;
  suggestedAction?: string;
}

export enum ImpermanentLossErrorCodeViem {
  CALCULATION_FAILED = 'CALCULATION_FAILED',
  POSITION_NOT_FOUND = 'POSITION_NOT_FOUND',
  POOL_NOT_FOUND = 'POOL_NOT_FOUND',
  INVALID_INPUT = 'INVALID_INPUT',
  PRICE_DATA_UNAVAILABLE = 'PRICE_DATA_UNAVAILABLE',
  VOLATILITY_DATA_UNAVAILABLE = 'VOLATILITY_DATA_UNAVAILABLE',
  HISTORICAL_DATA_UNAVAILABLE = 'HISTORICAL_DATA_UNAVAILABLE',
  RISK_ASSESSMENT_FAILED = 'RISK_ASSESSMENT_FAILED',
  PREDICTION_FAILED = 'PREDICTION_FAILED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}

// Event types for impermanent loss tracking
export interface ImpermanentLossEventViem {
  type: 'il_calculated' | 'position_tracked' | 'risk_assessed' | 'prediction_made' | 'threshold_exceeded';
  data: any;
  timestamp: number;
  positionId?: string;
  poolAddress?: Address;
  userAddress?: Address;
}