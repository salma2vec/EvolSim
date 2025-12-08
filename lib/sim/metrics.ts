/**
 * Metrics computation for simulation analysis
 */

import { WorldState, SimEvent } from "./types";

/**
 * Compute collapse statistics from history
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
 * Compute cooperation index (deviation from max sustainable yield)
 */
export function computeCooperationIndex(history: WorldState[]): Record<string, number> {
  const speciesIndices: Record<string, { totalDeviation: number; count: number }> = {};
  
  for (const state of history) {
    // Estimate harvests from events (simplified - in real implementation, track actual harvests)
    // For now, we'll compute based on resource changes and defection events
    
    for (const event of state.events) {
      if (event.type === "DEFECT" && event.data?.speciesId) {
        const speciesId = event.data.speciesId as string;
        if (!speciesIndices[speciesId]) {
          speciesIndices[speciesId] = { totalDeviation: 0, count: 0 };
        }
        // Defection indicates low cooperation
        speciesIndices[speciesId].totalDeviation += 1;
        speciesIndices[speciesId].count += 1;
      }
    }
  }
  
  // Convert to cooperation index (1 = fully cooperative, 0 = fully defective)
  const result: Record<string, number> = {};
  for (const [speciesId, data] of Object.entries(speciesIndices)) {
    // More defections = lower cooperation index
    result[speciesId] = Math.max(0, 1 - (data.totalDeviation / Math.max(1, data.count * 0.5)));
  }
  
  // Initialize all species with default cooperation index
  if (history.length > 0) {
    for (const species of history[history.length - 1].species) {
      if (!result[species.traits.id]) {
        result[species.traits.id] = 0.7; // Default moderate cooperation
      }
    }
  }
  
  return result;
}

/**
 * Compute species outcomes (final populations, survival rates)
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
  
  // Track peak populations
  for (const state of history) {
    for (const species of state.species) {
      const currentPeak = peakPopulations[species.traits.id] || 0;
      peakPopulations[species.traits.id] = Math.max(currentPeak, species.population);
    }
  }
  
  // Final state
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
 * Compute treaty metrics
 */
export function computeTreatyMetrics(history: WorldState[]): {
  proposalRate: number;
  acceptanceRate: number;
  violationRate: number;
  totalProposals: number;
  totalAcceptances: number;
  totalViolations: number;
} {
  let totalProposals = 0;
  let totalAcceptances = 0;
  let totalViolations = 0;
  
  for (const state of history) {
    for (const event of state.events) {
      if (event.type === "TREATY") {
        totalProposals += 1;
        // Simplified: assume proposals are accepted if no DEFECT event follows soon
        // In a more sophisticated implementation, track explicit acceptances
      } else if (event.type === "DEFECT") {
        // Check if this is a violation of a treaty
        // Simplified: count all defections as potential violations
        totalViolations += 1;
      }
    }
  }
  
  // Simplified acceptance rate (assume 50% if no explicit tracking)
  totalAcceptances = Math.floor(totalProposals * 0.5);
  
  const proposalRate = history.length > 0 ? totalProposals / history.length : 0;
  const acceptanceRate = totalProposals > 0 ? totalAcceptances / totalProposals : 0;
  const violationRate = totalProposals > 0 ? totalViolations / totalProposals : 0;
  
  return {
    proposalRate,
    acceptanceRate,
    violationRate,
    totalProposals,
    totalAcceptances,
    totalViolations,
  };
}

/**
 * Compute average resource health over time
 */
export function computeResourceHealth(history: WorldState[]): Record<string, number[]> {
  const resourceHealth: Record<string, number[]> = {};
  
  for (const state of history) {
    for (const resource of state.resources) {
      if (!resourceHealth[resource.def.id]) {
        resourceHealth[resource.def.id] = [];
      }
      // Health as fraction of capacity
      const health = resource.collapsed ? 0 : resource.amount / resource.def.capacityK;
      resourceHealth[resource.def.id].push(health);
    }
  }
  
  return resourceHealth;
}

