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
 * Enhanced version that tracks actual harvest behavior and treaty adherence
 */
export function computeCooperationIndex(history: WorldState[]): Record<string, number> {
  const speciesIndices: Record<string, { 
    totalDeviation: number; 
    count: number;
    treatyViolations: number;
    treatyAdherence: number;
  }> = {};
  
  // Track treaty violations and adherence
  const treatyViolationsBySpecies: Record<string, number> = {};
  const treatyAdherenceBySpecies: Record<string, { total: number; kept: number }> = {};
  
  for (let i = 0; i < history.length; i++) {
    const state = history[i];
    
    // Track defections from events
    for (const event of state.events) {
      if (event.type === "DEFECT" && event.data?.speciesId) {
        const speciesId = event.data.speciesId as string;
        if (!speciesIndices[speciesId]) {
          speciesIndices[speciesId] = { 
            totalDeviation: 0, 
            count: 0,
            treatyViolations: 0,
            treatyAdherence: 0,
          };
        }
        
        // Check if this is a treaty violation
        if (event.data.treatyId) {
          speciesIndices[speciesId].treatyViolations += 1;
          treatyViolationsBySpecies[speciesId] = (treatyViolationsBySpecies[speciesId] || 0) + 1;
        }
        
        // Defection indicates low cooperation
        speciesIndices[speciesId].totalDeviation += 1;
        speciesIndices[speciesId].count += 1;
      }
      
      // Track treaty signings
      if (event.type === "TREATY" && event.data?.speciesId) {
        const speciesId = event.data.speciesId as string;
        if (!treatyAdherenceBySpecies[speciesId]) {
          treatyAdherenceBySpecies[speciesId] = { total: 0, kept: 0 };
        }
        treatyAdherenceBySpecies[speciesId].total += 1;
      }
    }
    
    // Track resource sustainability by comparing resource levels
    // If resources are declining faster than expected, species may be over-harvesting
    if (i > 0) {
      const prevState = history[i - 1];
      for (const resource of state.resources) {
        const prevResource = prevState.resources.find(r => r.def.id === resource.def.id);
        if (!prevResource) continue;
        
        // Calculate expected regeneration
        const expectedRegen = prevResource.def.regenRate * prevResource.amount * 
          (1 - prevResource.amount / prevResource.def.capacityK);
        const actualChange = resource.amount - prevResource.amount;
        const harvestEstimate = expectedRegen - actualChange;
        
        // If harvest is significantly above sustainable yield, it's a defection
        const msy = resource.def.capacityK * 0.5;
        const sustainableHarvest = msy * 0.1;
        
        if (harvestEstimate > sustainableHarvest * 1.5) {
          // Distribute blame to all species (simplified - in reality would track per-species)
          for (const species of state.species) {
            if (!speciesIndices[species.traits.id]) {
              speciesIndices[species.traits.id] = { 
                totalDeviation: 0, 
                count: 0,
                treatyViolations: 0,
                treatyAdherence: 0,
              };
            }
            // Small penalty for being in a system with over-harvesting
            speciesIndices[species.traits.id].totalDeviation += 0.1;
            speciesIndices[species.traits.id].count += 1;
          }
        }
      }
    }
  }
  
  // Calculate treaty adherence scores
  for (const [speciesId, adherence] of Object.entries(treatyAdherenceBySpecies)) {
    if (!speciesIndices[speciesId]) {
      speciesIndices[speciesId] = { 
        totalDeviation: 0, 
        count: 0,
        treatyViolations: 0,
        treatyAdherence: 0,
      };
    }
    const violations = treatyViolationsBySpecies[speciesId] || 0;
    const adherenceRate = adherence.total > 0 
      ? (adherence.total - violations) / adherence.total 
      : 1.0;
    speciesIndices[speciesId].treatyAdherence = adherenceRate;
  }
  
  // Convert to cooperation index (1 = fully cooperative, 0 = fully defective)
  const result: Record<string, number> = {};
  for (const [speciesId, data] of Object.entries(speciesIndices)) {
    // Base score from defection frequency
    const defectionPenalty = data.count > 0 
      ? Math.min(1.0, data.totalDeviation / Math.max(1, data.count * 0.5))
      : 0;
    
    // Treaty violation penalty
    const violationPenalty = data.treatyViolations * 0.2;
    
    // Treaty adherence bonus
    const adherenceBonus = data.treatyAdherence * 0.2;
    
    // Combine: start at 1.0, subtract penalties, add bonuses
    const cooperationScore = Math.max(0, Math.min(1.0, 
      1.0 - defectionPenalty - violationPenalty + adherenceBonus
    ));
    
    result[speciesId] = cooperationScore;
  }
  
  // Initialize all species with default cooperation index
  if (history.length > 0) {
    for (const species of history[history.length - 1].species) {
      if (!result[species.traits.id]) {
        // Default based on species traits
        const baseCooperation = species.traits.stabilityPreference * 0.5 + 0.5;
        result[species.traits.id] = baseCooperation;
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

