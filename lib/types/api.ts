/**
 * API request and response types
 */

export interface SimulationRequest {
  presetId: string;
  numSteps: number;
  speciesModelMap?: Record<string, string>;
  seed?: number;
  config?: {
    maxTimeSteps?: number;
    harvestNoise?: number;
    rngSeed?: number;
    historyLength?: number;
    useLinguisticRegimes?: boolean;
    useEpistemicOrders?: boolean;
  };
}

export interface LLMRequest {
  modelId: string;
  prompt: string;
  temperature?: number;
}

export interface LLMResponse {
  output: string;
}

export interface SimulationResponse {
  history: unknown[];
  metrics: {
    collapseStats: unknown;
    cooperationIndex: Record<string, number>;
    speciesOutcomes: unknown;
  };
}

export interface ErrorResponse {
  error: string;
  details?: string | string[];
}

