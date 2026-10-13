/** Seeded batches share the exact simulator used by the API. */
import { SimConfig, WorldState } from "../sim/types";
import { runSimulation } from "../server/simulation";
import { validateSimulationRequest } from "./validation";
import { APIError } from "../server/api";

export interface BatchExperimentConfig {
  presetId: string; numSteps: number; runs: number; seeds?: number[];
  speciesModelMaps?: Record<string, string>[]; configOverrides?: Partial<SimConfig>[];
}
export interface BatchResult {
  runIndex: number; seed: number; history: WorldState[]; success: boolean;
  error?: string; provenance?: Awaited<ReturnType<typeof runSimulation>>["provenance"];
}

export function validateBatch(config: BatchExperimentConfig): void {
  if (!config || !Number.isInteger(config.runs) || config.runs < 1 || config.runs > 20 ||
      !Number.isInteger(config.numSteps) || config.runs * config.numSteps > 1000) throw new APIError("Batch limit: 20 runs and 1000 total steps");
  for (const key of ["seeds", "speciesModelMaps", "configOverrides"] as const) {
    const list = config[key];
    if (list !== undefined && (!Array.isArray(list) || list.length !== config.runs)) throw new APIError(`${key} must have exactly runs entries`);
  }
  for (let i = 0; i < config.runs; i++) {
    const result = validateSimulationRequest({ presetId: config.presetId, numSteps: config.numSteps,
      seed: config.seeds?.[i] ?? 42+i, speciesModelMap: config.speciesModelMaps?.[i], config: config.configOverrides?.[i] });
    if (!result.valid) throw new APIError(result.errors.join("; "));
    if (config.configOverrides?.[i]?.useBaselineAgents === false) throw new APIError("Batch endpoint supports baseline experiments only");
  }
}

export async function runSingleSimulation(presetId: string, numSteps: number, seed: number,
  speciesModelMap: Record<string,string> = {}, configOverrides?: Partial<SimConfig>) {
  try { return { ...await runSimulation(presetId, numSteps, seed, speciesModelMap, configOverrides), success: true }; }
  catch (error) { return { history: [] as WorldState[], success: false, error: error instanceof Error ? error.message : String(error) }; }
}
export async function runBatchExperiments(config: BatchExperimentConfig): Promise<BatchResult[]> {
  validateBatch(config);
  const results: BatchResult[] = [];
  for (let i=0; i<config.runs; i++) {
    const seed = config.seeds?.[i] ?? 42+i;
    results.push({ runIndex: i, seed, ...await runSingleSimulation(config.presetId, config.numSteps,
      seed, config.speciesModelMaps?.[i], config.configOverrides?.[i]) });
  }
  return results;
}
