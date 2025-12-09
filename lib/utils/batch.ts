/**
 * Batch experiment runner utilities
 */

import { SimConfig, WorldState } from "../sim/types";
import { createWorldFromPreset } from "../sim/presets";
import { stepWorld, buildObservation } from "../sim/gameLoop";
import { buildSpeciesPrompt } from "../llm/promptBuilder";
import { parseLLMResponse } from "../llm/parseActions";
import { logger } from "./logger";

export interface BatchExperimentConfig {
  presetId: string;
  numSteps: number;
  runs: number;
  seeds?: number[];
  speciesModelMaps?: Record<string, string>[];
  configOverrides?: Partial<SimConfig>[];
}

export interface BatchResult {
  runIndex: number;
  seed: number;
  history: WorldState[];
  success: boolean;
  error?: string;
}

export interface SpeciesDecision {
  speciesId: string;
  harvest: Record<string, number>;
  relations: Record<string, string>;
  governance: {
    punishmentStrength: number;
    monitoringInvestment: number;
  };
}

async function getDecisions(
  observations: any[],
  world: WorldState,
  speciesModelMap: Record<string, string>
): Promise<SpeciesDecision[]> {
  const decisions: SpeciesDecision[] = [];
  
  for (const obs of observations) {
    const species = world.species.find((s) => s.traits.id === obs.speciesId);
    if (!species || !species.alive) continue;
    
    const modelId = speciesModelMap[obs.speciesId] || species.policyBrainId || "small";
    const prompt = buildSpeciesPrompt(species, world, obs);
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      const response = await fetch(`${baseUrl}/api/llm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, prompt }),
      });
      
      if (!response.ok) {
        throw new Error(`LLM API returned status ${response.status}`);
      }
      
      const data = await response.json();
      const decision = parseLLMResponse(data.output, obs.speciesId);
      decisions.push(decision);
    } catch (error) {
      logger.error(`Error getting decision for ${obs.speciesId}`, error);
      decisions.push({
        speciesId: obs.speciesId,
        harvest: {},
        relations: {},
        governance: { punishmentStrength: 0.3, monitoringInvestment: 0.2 },
      });
    }
  }
  
  return decisions;
}

/**
 * Run a single simulation
 */
export async function runSingleSimulation(
  presetId: string,
  numSteps: number,
  seed: number,
  speciesModelMap: Record<string, string> = {},
  configOverrides?: Partial<SimConfig>
): Promise<{ history: WorldState[]; success: boolean; error?: string }> {
  try {
    const { world: initialState, config } = createWorldFromPreset(
      presetId,
      speciesModelMap,
      seed,
      configOverrides
    );
    
    const history: WorldState[] = [initialState];
    let currentState = initialState;
    
    for (let step = 0; step < numSteps && step < config.maxTimeSteps; step++) {
      const observations: any[] = [];
      const aliveSpecies = currentState.species.filter((s) => s.alive);
      
      if (aliveSpecies.length === 0) {
        break;
      }
      
      for (const species of aliveSpecies) {
        const obs = buildObservation(species, currentState, history, config);
        observations.push(obs);
      }
      
      const decisions = await getDecisions(observations, currentState, speciesModelMap);
      
      if (decisions.length === 0) {
        break;
      }
      
      currentState = await stepWorld(
        currentState,
        config,
        async () => decisions,
        history
      );
      
      history.push(currentState);
      
      if (currentState.species.every((s) => !s.alive)) {
        break;
      }
    }
    
    return { history, success: true };
  } catch (error) {
    return {
      history: [],
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run batch experiments
 */
export async function runBatchExperiments(
  batchConfig: BatchExperimentConfig
): Promise<BatchResult[]> {
  const results: BatchResult[] = [];
  const { presetId, numSteps, runs, seeds, speciesModelMaps, configOverrides } = batchConfig;
  
  for (let i = 0; i < runs; i++) {
    const seed = seeds?.[i] ?? Date.now() + i;
    const speciesModelMap = speciesModelMaps?.[i] ?? {};
    const configOverride = configOverrides?.[i];
    
    logger.info(`Running batch experiment ${i + 1}/${runs}`, { seed, presetId });
    
    const result = await runSingleSimulation(
      presetId,
      numSteps,
      seed,
      speciesModelMap,
      configOverride
    );
    
    results.push({
      runIndex: i,
      seed,
      history: result.history,
      success: result.success,
      error: result.error,
    });
  }
  
  return results;
}

