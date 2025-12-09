/**
 * Game loop: main epoch step function
 */

import {
  WorldState,
  SimConfig,
  SpeciesDecision,
  SpeciesObservation,
  SimEvent,
  ResourceState,
  Treaty,
  SpeciesState,
} from "./types";
import { updateResources, updateSpeciesPopulation, computePerCapitaResource, computeStress, applyGovernanceEffects } from "./dynamics";
import { getRNG } from "./random";
import { isContactWindow, getDecisionInterval } from "./orders";
import { validateTreatyText, interpretTreatyText } from "./language";
import { HARVEST_CONSTANTS } from "../config";

/**
 * Build observations for a species (noisy estimates of world state)
 */
export function buildObservation(
  species: SpeciesState,
  world: WorldState,
  history: WorldState[],
  config: SimConfig
): SpeciesObservation {
  const rng = getRNG();
  const historyLength = config.historyLength ?? 5;
  
  // Noisy resource estimates
  const resourceEstimates = world.resources.map((resource) => {
    const noise = rng.normal(0, species.traits.perceptionNoise * resource.def.capacityK);
    const estimatedAmount = Math.max(0, resource.amount + noise);
    const uncertainty = species.traits.perceptionNoise * resource.def.capacityK;
    
    return {
      resourceId: resource.def.id,
      estimatedAmount,
      uncertainty,
    };
  });
  
  // Other species (noisy summaries)
  const otherSpecies = world.species
    .filter((s) => s.traits.id !== species.traits.id && s.alive)
    .map((s) => {
      const popNoise = rng.normal(0, s.population * 0.1);
      const estimatedPopulation = Math.max(0, s.population + popNoise);
      
      // Aggression proxy: infer from recent behavior (simplified)
      const aggressionProxy = 1 - s.traits.stabilityPreference;
      
      return {
        speciesId: s.traits.id,
        estimatedPopulation,
        aggressionProxy,
      };
    });
  
  // Recent events involving this species
  const recentEvents = world.events.filter((e) => {
    return (
      e.data?.speciesId === species.traits.id ||
      e.data?.otherSpeciesId === species.traits.id ||
      e.type === "COLLAPSE" || // Global events
      e.type === "CONCLAVE"
    );
  });
  
  // Also include events from recent history
  const recentHistoryEvents: SimEvent[] = [];
  for (let i = Math.max(0, history.length - historyLength); i < history.length; i++) {
    const pastState = history[i];
    const relevantEvents = pastState.events.filter((e) => {
      return (
        e.data?.speciesId === species.traits.id ||
        e.data?.otherSpeciesId === species.traits.id ||
        e.type === "COLLAPSE" ||
        e.type === "CONCLAVE"
      );
    });
    recentHistoryEvents.push(...relevantEvents);
  }

  // Active treaties
  const activeTreaties = world.activeTreaties.filter(t => t.signatories.includes(species.traits.id));
  
  return {
    speciesId: species.traits.id,
    timeStep: world.timeStep,
    resourceEstimates,
    ownPopulation: species.population,
    ownTechLevel: species.techLevel,
    otherSpecies,
    recentEvents: [...recentHistoryEvents, ...recentEvents].slice(-historyLength * 2),
    activeTreaties,
    isConclave: isContactWindow(species.traits.epistemicOrder, world.timeStep),
  };
}

/**
 * Detect and emit events (collapses, extinctions, defections, treaties)
 */
export function detectEvents(
  oldState: WorldState,
  newState: WorldState,
  decisions: SpeciesDecision[]
): SimEvent[] {
  const events: SimEvent[] = [];
  
  // Check for resource collapses
  for (const resource of newState.resources) {
    const oldResource = oldState.resources.find((r) => r.def.id === resource.def.id);
    if (oldResource && !oldResource.collapsed && resource.collapsed) {
      events.push({
        timeStep: newState.timeStep,
        type: "COLLAPSE",
        message: `Resource "${resource.def.name}" has collapsed below threshold`,
        data: {
          resourceId: resource.def.id,
        },
      });
    }
  }
  
  // Check for extinctions
  for (const species of newState.species) {
    const oldSpecies = oldState.species.find((s) => s.traits.id === species.traits.id);
    if (oldSpecies && oldSpecies.alive && !species.alive) {
      events.push({
        timeStep: newState.timeStep,
        type: "EXTINCTION",
        message: `Species "${species.traits.name}" has gone extinct`,
        data: {
          speciesId: species.traits.id,
        },
      });
    }
  }
  
  // Check for defections (simplified: if harvest exceeds sustainable level significantly)
  for (const decision of decisions) {
    const species = newState.species.find((s) => s.traits.id === decision.speciesId);
    if (!species || !species.alive) continue;
    
    for (const [resourceId, harvest] of Object.entries(decision.harvest)) {
      const resource = newState.resources.find((r) => r.def.id === resourceId);
      if (!resource) continue;
      
      // Estimate max sustainable yield
      const msy = resource.def.capacityK * HARVEST_CONSTANTS.MSY_RATIO;
      const sustainableHarvest = msy * HARVEST_CONSTANTS.SUSTAINABLE_YIELD_RATIO;
      
      if (harvest > sustainableHarvest * HARVEST_CONSTANTS.DEFECTION_THRESHOLD_MULTIPLIER) {
        events.push({
          timeStep: newState.timeStep,
          type: "DEFECT",
          message: `Species "${species.traits.name}" over-harvested "${resource.def.name}" by ${Math.round(((harvest - sustainableHarvest) / sustainableHarvest) * 100)}%`,
          data: {
            speciesId: species.traits.id,
            resourceId,
            harvestAmount: harvest,
          },
        });
      }
    }
  }
  
  // Check for diplomatic changes
  for (const decision of decisions) {
    const species = newState.species.find((s) => s.traits.id === decision.speciesId);
    if (!species || !species.alive) continue;
    
    for (const [otherSpeciesId, stance] of Object.entries(decision.relations)) {
      const oldStance = oldState.species
        .find((s) => s.traits.id === decision.speciesId)
        ?.relations[otherSpeciesId];
      
      if (oldStance && oldStance !== stance) {
        events.push({
          timeStep: newState.timeStep,
          type: "DIPLOMACY",
          message: `Species "${species.traits.name}" changed relations with "${otherSpeciesId}" from ${oldStance} to ${stance}`,
          data: {
            speciesId: species.traits.id,
            otherSpeciesId,
          },
        });
      }
    }
  }
  
  return events;
}

/**
 * Main epoch step function
 */
export async function stepWorld(
  state: WorldState,
  config: SimConfig,
  getDecisions: (observations: SpeciesObservation[]) => Promise<SpeciesDecision[]>,
  history: WorldState[] = []
): Promise<WorldState> {
  const rng = getRNG();

  // 1. Identify which species can act this epoch (Epistemic Order logic)
  const actingSpecies: SpeciesState[] = [];
  const observations: SpeciesObservation[] = [];
  const events: SimEvent[] = [];

  for (const species of state.species) {
    if (!species.alive) continue;

    // Check if it's time to act
    const canAct = !config.useEpistemicOrders || isContactWindow(species.traits.epistemicOrder, state.timeStep);
    
    if (canAct) {
      actingSpecies.push(species);
      const obs = buildObservation(species, state, history, config);
      observations.push(obs);

      // Emit CONCLAVE event if it's a rare window
      if (config.useEpistemicOrders && species.traits.epistemicOrder && species.traits.epistemicOrder !== "FastSecular") {
        events.push({
          timeStep: state.timeStep,
          type: "CONCLAVE",
          message: `Order "${species.traits.name}" enters conclave.`,
          data: { speciesId: species.traits.id }
        });
      }
    }
  }
  
  // 2. Get decisions only for acting species
  const newDecisions = await getDecisions(observations);

  // Merge new decisions with previous decisions for non-acting species (persistence)
  // Or assume non-acting species continue previous behavior?
  // For simplicity, let's assume non-acting species harvest 0 or continue previous harvest?
  // Let's implement persistence: look up last decision from history if available.
  // Actually, easiest is to assume "maintenance mode" (same harvest as last time) or 0.
  // We'll construct a full list of decisions for this step.
  
  const allDecisions: SpeciesDecision[] = [];

  for (const species of state.species) {
    if (!species.alive) continue;

    const newDecision = newDecisions.find(d => d.speciesId === species.traits.id);
    if (newDecision) {
      allDecisions.push(newDecision);
    } else {
      // Find last decision from history
      // Simplified: if not acting, idle (harvest 0) to avoid "zombie overharvest"
      // Alternatively, persist last harvest. Let's persist last harvest for continuity.
      let lastHarvest = {};
      let lastRelations = {};
      let lastGovernance = { punishmentStrength: 0.1, monitoringInvestment: 0.1 };

      if (history.length > 0) {
        // This is tricky without storing decisions directly in state.
        // We'll rely on species state having some persistence if we added it, but we didn't.
        // Fallback: idle behavior for cloistered phases.
        lastHarvest = {}; // Idle
      }
      
      allDecisions.push({
        speciesId: species.traits.id,
        harvest: lastHarvest,
        relations: species.relations, // Keep current relations
        governance: species.governance, // Keep current governance
      });
    }
  }

  // 3. Process Treaty Proposals
  const newTreaties: Treaty[] = [];
  
  for (const decision of newDecisions) {
    if (decision.treatyProposal) {
      const proposer = state.species.find(s => s.traits.id === decision.speciesId);
      const target = state.species.find(s => s.traits.id === decision.treatyProposal?.targetSpeciesId);
      
      if (proposer && target && target.alive) {
        // Check if target is in contact window (can receive?)
        // If not, proposal fails/is ignored
        const targetOpen = !config.useEpistemicOrders || isContactWindow(target.traits.epistemicOrder, state.timeStep);
        
        if (targetOpen) {
          // Validate Linguistic Regime
          const isValidLanguage = !config.useLinguisticRegimes || validateTreatyText(decision.treatyProposal.text, proposer.traits.linguisticRegime);
          
          if (isValidLanguage) {
            // Create Treaty
            const availableResources = state.resources.map(r => ({ id: r.def.id, name: r.def.name }));
            const constraints = interpretTreatyText(
              decision.treatyProposal.text, 
              proposer.traits.linguisticRegime,
              availableResources
            );
            const treaty: Treaty = {
              id: `treaty-${state.timeStep}-${rng.randomInt(1000, 9999)}`,
              signatories: [proposer.traits.id, target.traits.id],
              epochSigned: state.timeStep,
              text: decision.treatyProposal.text,
              interpretedConstraints: constraints,
              expiresAt: state.timeStep + 20, // Default duration
              violated: false,
            };
            newTreaties.push(treaty);
            
            events.push({
              timeStep: state.timeStep,
              type: "TREATY",
              message: `Treaty signed: "${treaty.text.substring(0, 50)}..."`,
              data: {
                speciesId: proposer.traits.id,
                otherSpeciesId: target.traits.id,
                treatyId: treaty.id
              }
            });
          } else {
            events.push({
              timeStep: state.timeStep,
              type: "LANGUAGE_SHIFT", // Reusing event type for failure
              message: `Treaty proposal from ${proposer.traits.name} failed linguistic validation.`,
              data: { speciesId: proposer.traits.id }
            });
          }
        }
      }
    }
  }

  // 4. Enforce Active Treaties (Check for violations)
  const activeTreaties = [...state.activeTreaties, ...newTreaties].filter(t => !t.expiresAt || t.expiresAt > state.timeStep);
  
  for (const treaty of activeTreaties) {
    if (treaty.violated) continue; // Already broken

    for (const signatoryId of treaty.signatories) {
      const decision = allDecisions.find(d => d.speciesId === signatoryId);
      if (!decision) continue;

      // Check max harvest constraints
      if (treaty.interpretedConstraints.maxHarvestByResource) {
        for (const [resId, maxAmt] of Object.entries(treaty.interpretedConstraints.maxHarvestByResource)) {
          if ((decision.harvest[resId] || 0) > maxAmt * 1.1) { // 10% buffer
             treaty.violated = true;
             events.push({
               timeStep: state.timeStep,
               type: "DEFECT",
               message: `Treaty ${treaty.id} violated by ${signatoryId} (Harvest ${resId} > ${maxAmt})`,
               data: { speciesId: signatoryId, treatyId: treaty.id }
             });
          }
        }
      }
    }
  }

  // 5. Apply governance & Update World
  const effectiveHarvests = applyGovernanceEffects(allDecisions, state.species);
  
  const newResources = updateResources(
    state.resources,
    effectiveHarvests,
    state.planet,
    config
  );
  
  const newSpecies = state.species.map((species) => {
    if (!species.alive) return species;
    
    // Compute per-capita resource
    const speciesHarvests: Record<string, number> = {};
    const decision = allDecisions.find((d) => d.speciesId === species.traits.id);
    if (decision) {
      for (const [resourceId, harvest] of Object.entries(decision.harvest)) {
        speciesHarvests[resourceId] = harvest;
      }
    }
    
    const perCapitaResource = computePerCapitaResource(species, state.resources, speciesHarvests);
    const stress = computeStress(species, newResources, state.planet);
    
    const updatedSpecies = updateSpeciesPopulation(species, perCapitaResource, stress, state.planet);
    
    // Update state from decision
    if (decision) {
      updatedSpecies.governance = decision.governance;
      updatedSpecies.relations = { ...updatedSpecies.relations, ...decision.relations };
    }
    
    // Update epistemic state
    if (actingSpecies.find(s => s.traits.id === species.traits.id)) {
      updatedSpecies.lastDecisionStep = state.timeStep;
    }
    
    updatedSpecies.techLevel = Math.min(1.0, updatedSpecies.techLevel + 0.001);
    
    return updatedSpecies;
  });
  
  const detectedEvents = detectEvents(state, { ...state, resources: newResources, species: newSpecies }, allDecisions);
  
  return {
    timeStep: state.timeStep + 1,
    planet: state.planet,
    resources: newResources,
    species: newSpecies,
    events: [...state.events, ...events, ...detectedEvents],
    activeTreaties: activeTreaties.filter(t => !t.violated), // Remove violated treaties? or keep them marked? Let's remove for now or keep to show history. Let's keep valid ones.
  };
}
