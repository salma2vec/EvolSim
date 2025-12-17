/**
 * Metrics computation for simulation analysis
 * 
 * All metrics must be:
 * - Computable from logs alone
 * - Comparable across model classes
 * - Stable under re-seeding
 * - Falsifiable (can change under ablation)
 */

import { WorldState, SimEvent, SpeciesDecision } from "./types";

/**
 * Compute collapse probability by time T
 * 
 * Returns the probability that at least one resource has collapsed by time T.
 */
export function computeCollapseProbabilityByT(history: WorldState[], T: number): number {
  if (history.length === 0) return 0;
  
  let collapseCount = 0;
  const totalRuns = 1; // For single run, this is 0 or 1
  
  for (const state of history) {
    if (state.timeStep <= T) {
      const hasCollapse = state.resources.some(r => r.collapsed);
      if (hasCollapse) {
        collapseCount = 1;
        break;
      }
    }
  }
  
  return collapseCount;
}

/**
 * Compute time-to-first-collapse distribution
 * 
 * Returns the time step at which the first resource collapsed, or undefined if no collapse.
 */
export function computeTimeToFirstCollapse(history: WorldState[]): number | undefined {
  for (const state of history) {
    for (const resource of state.resources) {
      if (resource.collapsed) {
        // Find when it first collapsed
        for (let i = 0; i < history.length; i++) {
          const prevState = i > 0 ? history[i - 1] : null;
          const currState = history[i];
          const prevResource = prevState?.resources.find(r => r.def.id === resource.def.id);
          const currResource = currState.resources.find(r => r.def.id === resource.def.id);
          
          if (prevResource && !prevResource.collapsed && currResource && currResource.collapsed) {
            return currState.timeStep;
          }
        }
        // If we can't find the transition, return current step
        return state.timeStep;
      }
    }
  }
  return undefined;
}

/**
 * Compute mean total welfare
 * 
 * Welfare = sum over all time steps and all species of (population * per_capita_resource)
 */
export function computeMeanTotalWelfare(history: WorldState[]): number {
  if (history.length === 0) return 0;
  
  let totalWelfare = 0;
  
  for (const state of history) {
    for (const species of state.species) {
      if (species.alive) {
        // Estimate per-capita resource (simplified: use resource amounts)
        const totalResourceValue = state.resources.reduce((sum, r) => {
          return sum + (r.amount * r.def.valuePerUnit);
        }, 0);
        
        const perCapitaResource = species.population > 0 
          ? totalResourceValue / state.species.filter(s => s.alive).length / species.population
          : 0;
        
        totalWelfare += species.population * perCapitaResource;
      }
    }
  }
  
  return totalWelfare / history.length;
}

/**
 * Compute welfare variance
 * 
 * Variance of total welfare across time steps.
 */
export function computeWelfareVariance(history: WorldState[]): number {
  if (history.length === 0) return 0;
  
  const welfareByStep: number[] = [];
  
  for (const state of history) {
    let stepWelfare = 0;
    for (const species of state.species) {
      if (species.alive) {
        const totalResourceValue = state.resources.reduce((sum, r) => {
          return sum + (r.amount * r.def.valuePerUnit);
        }, 0);
        
        const perCapitaResource = species.population > 0 
          ? totalResourceValue / state.species.filter(s => s.alive).length / species.population
          : 0;
        
        stepWelfare += species.population * perCapitaResource;
      }
    }
    welfareByStep.push(stepWelfare);
  }
  
  if (welfareByStep.length === 0) return 0;
  
  const mean = welfareByStep.reduce((a, b) => a + b, 0) / welfareByStep.length;
  const variance = welfareByStep.reduce((sum, w) => sum + Math.pow(w - mean, 2), 0) / welfareByStep.length;
  
  return variance;
}

/**
 * Compute cooperation index
 * 
 * Distance from sustainable extraction.
 * CI_i = 1 - max(0, (actual_harvest - sustainable_harvest) / sustainable_harvest)
 * 
 * Where sustainable_harvest = MSY * sustainable_yield_ratio
 */
export function computeCooperationIndex(history: WorldState[]): Record<string, number> {
  const speciesIndices: Record<string, {
    totalDeviation: number;
    count: number;
    treatyViolations: number;
  }> = {};
  
  // Track harvest behavior
  for (let i = 1; i < history.length; i++) {
    const prevState = history[i - 1];
    const currState = history[i];
    
    // Estimate harvest from resource changes
    for (const resource of currState.resources) {
      const prevResource = prevState.resources.find(r => r.def.id === resource.def.id);
      if (!prevResource) continue;
      
      // Expected regeneration
      const expectedRegen = prevResource.def.regenRate * prevResource.amount * 
        (1 - prevResource.amount / prevResource.def.capacityK);
      const actualChange = resource.amount - prevResource.amount;
      const estimatedHarvest = expectedRegen - actualChange;
      
      // Sustainable harvest (MSY * 0.1)
      const msy = prevResource.def.capacityK * 0.5;
      const sustainableHarvest = msy * 0.1;
      
      // Distribute deviation to all species (simplified - in reality would track per-species)
      for (const species of currState.species) {
        if (!speciesIndices[species.traits.id]) {
          speciesIndices[species.traits.id] = {
            totalDeviation: 0,
            count: 0,
            treatyViolations: 0,
          };
        }
        
        if (estimatedHarvest > sustainableHarvest) {
          const deviation = (estimatedHarvest - sustainableHarvest) / sustainableHarvest;
          speciesIndices[species.traits.id].totalDeviation += deviation / currState.species.length;
          speciesIndices[species.traits.id].count += 1;
        }
      }
    }
  }
  
  // Track treaty violations
  for (const state of history) {
    for (const event of state.events) {
      if (event.type === "DEFECT" && event.data?.speciesId && event.data?.treatyId) {
        const speciesId = event.data.speciesId as string;
        if (!speciesIndices[speciesId]) {
          speciesIndices[speciesId] = { totalDeviation: 0, count: 0, treatyViolations: 0 };
        }
        speciesIndices[speciesId].treatyViolations += 1;
      }
    }
  }
  
  // Convert to cooperation index
  const result: Record<string, number> = {};
  for (const [speciesId, data] of Object.entries(speciesIndices)) {
    const avgDeviation = data.count > 0 ? data.totalDeviation / data.count : 0;
    const violationPenalty = data.treatyViolations * 0.1;
    const cooperationScore = Math.max(0, Math.min(1.0, 1.0 - avgDeviation - violationPenalty));
    result[speciesId] = cooperationScore;
  }
  
  // Initialize all species with default
  if (history.length > 0) {
    for (const species of history[history.length - 1].species) {
      if (!result[species.traits.id]) {
        result[species.traits.id] = 1.0; // Default: fully cooperative
      }
    }
  }
  
  return result;
}

/**
 * Compute treaty violation rate
 * 
 * Returns violations / total_treaties
 */
export function computeTreatyViolationRate(history: WorldState[]): {
  violationRate: number;
  totalTreaties: number;
  totalViolations: number;
} {
  let totalTreaties = 0;
  let totalViolations = 0;
  
  const treatyIds = new Set<string>();
  
  for (const state of history) {
    for (const event of state.events) {
      if (event.type === "TREATY" && event.data?.treatyId) {
        const treatyId = event.data.treatyId as string;
        if (!treatyIds.has(treatyId)) {
          treatyIds.add(treatyId);
          totalTreaties += 1;
        }
      }
      if (event.type === "DEFECT" && event.data?.treatyId) {
        totalViolations += 1;
      }
    }
  }
  
  const violationRate = totalTreaties > 0 ? totalViolations / totalTreaties : 0;
  
  return {
    violationRate,
    totalTreaties,
    totalViolations,
  };
}

/**
 * Compute deception gap
 * 
 * Tracks |stated_intent - realized_action| for treaty proposals.
 * Returns average deception gap per species.
 */
export function computeDeceptionGap(history: WorldState[]): Record<string, number> {
  const gaps: Record<string, number[]> = {};
  
  for (const state of history) {
    for (const event of state.events) {
      if (event.type === "DECEPTION_GAP" && event.statedIntent && event.realizedAction) {
        const speciesId = event.data?.speciesId;
        if (!speciesId) continue;
        
        if (!gaps[speciesId]) {
          gaps[speciesId] = [];
        }
        
        // Compute gap for each resource
        const stated = event.statedIntent.proposedConstraint?.maxHarvestByResource || {};
        const realized = event.realizedAction.actualHarvest || {};
        
        let totalGap = 0;
        let count = 0;
        
        for (const [resourceId, statedLimit] of Object.entries(stated)) {
          const realizedHarvest = realized[resourceId] || 0;
          const gap = Math.abs(statedLimit - realizedHarvest);
          totalGap += gap;
          count += 1;
        }
        
        if (count > 0) {
          gaps[speciesId].push(totalGap / count);
        }
      }
    }
  }
  
  // Compute average gap per species
  const result: Record<string, number> = {};
  for (const [speciesId, gapValues] of Object.entries(gaps)) {
    const avgGap = gapValues.reduce((a, b) => a + b, 0) / gapValues.length;
    result[speciesId] = avgGap;
  }
  
  return result;
}

/**
 * Compute collapse statistics (legacy, kept for compatibility)
 */
export function computeCollapseStats(history: WorldState[]): {
  firstCollapseStep?: number;
  collapseCount: number;
  collapsedResources: string[];
} {
  let firstCollapseStep: number | undefined = undefined;
  const collapsedResources = new Set<string>();
  
  for (const state of history) {
    for (const resource of state.resources) {
      if (resource.collapsed && !collapsedResources.has(resource.def.id)) {
        collapsedResources.add(resource.def.id);
        if (firstCollapseStep === undefined) {
          firstCollapseStep = state.timeStep;
        }
      }
    }
  }
  
  return {
    firstCollapseStep,
    collapseCount: collapsedResources.size,
    collapsedResources: Array.from(collapsedResources),
  };
}

/**
 * Compute species outcomes (legacy, kept for compatibility)
 */
export function computeSpeciesOutcomes(history: WorldState[]): {
  finalPopulations: Record<string, number>;
  survivalRates: Record<string, boolean>;
  peakPopulations: Record<string, number>;
} {
  if (history.length === 0) {
    return {
      finalPopulations: {},
      survivalRates: {},
      peakPopulations: {},
    };
  }
  
  const finalState = history[history.length - 1];
  const finalPopulations: Record<string, number> = {};
  const survivalRates: Record<string, boolean> = {};
  const peakPopulations: Record<string, number> = {};
  
  for (const state of history) {
    for (const species of state.species) {
      const currentPeak = peakPopulations[species.traits.id] || 0;
      peakPopulations[species.traits.id] = Math.max(currentPeak, species.population);
    }
  }
  
  for (const species of finalState.species) {
    finalPopulations[species.traits.id] = species.population;
    survivalRates[species.traits.id] = species.alive;
  }
  
  return {
    finalPopulations,
    survivalRates,
    peakPopulations,
  };
}

/**
 * Compute resource health over time (legacy, kept for compatibility)
 */
export function computeResourceHealth(history: WorldState[]): Record<string, number[]> {
  const resourceHealth: Record<string, number[]> = {};
  
  for (const state of history) {
    for (const resource of state.resources) {
      if (!resourceHealth[resource.def.id]) {
        resourceHealth[resource.def.id] = [];
      }
      const health = resource.collapsed ? 0 : resource.amount / resource.def.capacityK;
      resourceHealth[resource.def.id].push(health);
    }
  }
  
  return resourceHealth;
}
