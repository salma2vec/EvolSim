/**
 * Baseline heuristic agents
 * 
 * Fixed-policy agents for ablation studies.
 * These agents do not use LLMs and have deterministic behavior.
 */

import { SpeciesDecision, SpeciesObservation, ResourceState } from "./types";

/**
 * Baseline agent policy types
 */
export type BaselinePolicy = 
  | "cooperative"      // Always harvest at sustainable level
  | "defector"          // Always over-harvest
  | "conservative"      // Always harvest very little
  | "opportunistic";    // Harvest based on resource availability

/**
 * Generate a baseline agent decision
 */
export function generateBaselineDecision(
  observation: SpeciesObservation,
  policy: BaselinePolicy,
  resources: ResourceState[]
): SpeciesDecision {
  const harvest: Record<string, number> = {};
  
  for (const resourceEst of observation.resourceEstimates) {
    const resource = resources.find(r => r.def.id === resourceEst.resourceId);
    if (!resource) continue;
    
    const capacity = resource.def.capacityK;
    const currentAmount = resourceEst.estimatedAmount;
    const msy = resource.def.regenRate * capacity / 4;
    const sustainableHarvest = msy / (observation.otherSpecies.length + 1); // equal perceived population share
    
    switch (policy) {
      case "cooperative":
        // Harvest at sustainable level
        harvest[resourceEst.resourceId] = Math.min(100, sustainableHarvest);
        break;
        
      case "defector":
        // Over-harvest (250% of sustainable share)
        harvest[resourceEst.resourceId] = Math.min(100, sustainableHarvest * 2.5);
        break;
        
      case "conservative":
        // Harvest very little (50% of sustainable)
        harvest[resourceEst.resourceId] = Math.min(100, sustainableHarvest * 0.5);
        break;
        
      case "opportunistic":
        // Harvest based on resource availability
        // If resource is abundant (>80% capacity), harvest more
        // If resource is scarce (<30% capacity), harvest less
        const resourceRatio = currentAmount / capacity;
        if (resourceRatio > 0.8) {
          harvest[resourceEst.resourceId] = Math.min(100, sustainableHarvest * 1.2);
        } else if (resourceRatio < 0.3) {
          harvest[resourceEst.resourceId] = Math.min(100, sustainableHarvest * 0.7);
        } else {
          harvest[resourceEst.resourceId] = Math.min(100, sustainableHarvest);
        }
        break;
    }
  }
  
  // Relations: all neutral for baseline agents
  const relations: Record<string, "neutral"> = {};
  for (const other of observation.otherSpecies) {
    relations[other.speciesId] = "neutral";
  }
  
  return {
    speciesId: observation.speciesId,
    harvest,
    relations,
    governance: {
      punishmentStrength: 0.1,
      monitoringInvestment: 0.1,
    },
    // Baseline agents do not propose treaties
  };
}

/**
 * Check if a species should use baseline agent
 */
export function shouldUseBaselineAgent(
  speciesId: string,
  useBaselineAgents: boolean,
  baselinePolicyMap?: Record<string, BaselinePolicy>
): boolean {
  if (!useBaselineAgents) return false;
  

  return true;
}

/**
 * Get baseline policy for a species
 */
export function getBaselinePolicy(
  speciesId: string,
  baselinePolicyMap?: Record<string, BaselinePolicy>
): BaselinePolicy {
  if (baselinePolicyMap && baselinePolicyMap[speciesId]) {
    return baselinePolicyMap[speciesId];
  }
  
  // Default policy
  return "cooperative";
}



