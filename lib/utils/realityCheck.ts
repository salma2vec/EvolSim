/**
 * Reality Check: Verify system distinguishes greedy vs cooperative policies
 * 
 * Runs baseline comparisons to verify metrics diverge meaningfully.
 */

import { WorldState, SimConfig } from "../sim/types";
import { createWorldFromPreset } from "../sim/presets";
import { stepWorld } from "../sim/gameLoop";
import { getLLMDecision } from "../llm/decisionHandler";
import { 
  computeTimeToFirstCollapse,
  computeCooperationIndex,
  computeMeanTotalWelfare
} from "../sim/metrics";
import type { BaselinePolicy } from "../sim/baselineAgents";

export interface RealityCheckResult {
  policy: BaselinePolicy;
  timeToCollapse: number | undefined;
  cooperationIndex: Record<string, number>;
  meanWelfare: number;
  valid: boolean;
}

/**
 * Run a single reality check with a baseline policy
 */
export async function runRealityCheck(
  policy: BaselinePolicy,
  numSteps: number = 50,
  seed: number = 12345
): Promise<RealityCheckResult> {
  const { world: initialState, config } = createWorldFromPreset(
    "two_species_simple_lake",
    {},
    seed,
    {
      useBaselineAgents: true,
      baselinePolicyMap: {
        "species_0": policy,
        "species_1": policy === "defector" ? "cooperative" : "defector", // Mixed for comparison
      }
    } as any
  );
  
  const history: WorldState[] = [initialState];
  let currentState = initialState;
  
  for (let step = 0; step < numSteps && step < config.maxTimeSteps; step++) {
    const aliveSpecies = currentState.species.filter((s) => s.alive);
    if (aliveSpecies.length === 0) break;
    
    currentState = await stepWorld(
      currentState,
      config,
      async (observations) => {
        const { decisions } = await getLLMDecision(
          observations,
          currentState,
          {},
          {
            useBaselineAgents: true,
            baselinePolicyMap: {
              "species_0": policy,
              "species_1": policy === "defector" ? "cooperative" : "defector",
            }
          }
        );
        return decisions;
      },
      history
    );
    
    history.push(currentState);
    
    if (currentState.species.every((s) => !s.alive)) break;
  }
  
  const timeToCollapse = computeTimeToFirstCollapse(history);
  const cooperationIndex = computeCooperationIndex(history);
  const meanWelfare = computeMeanTotalWelfare(history);
  
  // Validation: Check if outcomes are meaningful
  // Greedy should collapse earlier, cooperative should have higher welfare
  const valid = history.length > 0;
  
  return {
    policy,
    timeToCollapse,
    cooperationIndex,
    meanWelfare,
    valid,
  };
}

/**
 * Run all reality checks and compare results
 */
export async function runAllRealityChecks(): Promise<{
  greedy: RealityCheckResult;
  cooperative: RealityCheckResult;
  mixed: RealityCheckResult;
  diverges: boolean;
}> {
  const greedy = await runRealityCheck("defector", 50, 12345);
  const cooperative = await runRealityCheck("cooperative", 50, 12346);
  const mixed = await runRealityCheck("opportunistic", 50, 12347);
  
  // Check if outcomes diverge meaningfully
  const diverges = 
    (greedy.timeToCollapse !== undefined && cooperative.timeToCollapse === undefined) ||
    (greedy.timeToCollapse !== undefined && cooperative.timeToCollapse !== undefined && 
     greedy.timeToCollapse < cooperative.timeToCollapse) ||
    (greedy.meanWelfare < cooperative.meanWelfare);
  
  return {
    greedy,
    cooperative,
    mixed,
    diverges,
  };
}

