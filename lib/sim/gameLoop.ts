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
import { isContactWindow, buildInformationState, getMemoryLength, getObservationBandwidth } from "./orders";
import { validateTreatyText } from "./language";
import { HARVEST_CONSTANTS } from "../config";
import { shouldUseBaselineAgent, generateBaselineDecision, getBaselinePolicy } from "./baselineAgents";
import type { BaselinePolicy } from "./baselineAgents";
import { assertWorldState, sanitizeDecision, assertDecisionValid } from "./guards";

/**
 * Build observations for a species (noisy estimates of world state)
 * 
 * Filtered by InformationState based on epistemic order.
 */
export function buildObservation(
  species: SpeciesState,
  world: WorldState,
  history: WorldState[],
  config: SimConfig
): SpeciesObservation {
  const rng = getRNG();
  
  // Build information state based on epistemic order
  const memoryLength = getMemoryLength(species.traits.epistemicOrder);
  const informationState = buildInformationState(
    species.traits.epistemicOrder,
    world.timeStep,
    history,
    memoryLength
  );
  
  const observationBandwidth = informationState.observationBandwidth;
  const historyLength = config.historyLength ?? memoryLength;
  
  // Noisy resource estimates (filtered by observation bandwidth)
  const resourceEstimates = world.resources.map((resource) => {
    let noise = rng.normal(0, species.traits.perceptionNoise * resource.def.capacityK);
    
    // If summarized_global, add more noise
    if (observationBandwidth === "summarized_global") {
      noise += rng.normal(0, resource.def.capacityK * 0.2);
    }
    
    const estimatedAmount = Math.max(0, resource.amount + noise);
    const uncertainty = species.traits.perceptionNoise * resource.def.capacityK;
    
    return {
      resourceId: resource.def.id,
      estimatedAmount,
      uncertainty,
    };
  });
  
  // Other species (noisy summaries, filtered by observation bandwidth)
  const otherSpecies = world.species
    .filter((s) => s.traits.id !== species.traits.id && s.alive)
    .map((s) => {
      let popNoise = rng.normal(0, s.population * 0.1);
      
      // If summarized_global, more noise
      if (observationBandwidth === "summarized_global") {
        popNoise += rng.normal(0, s.population * 0.2);
      }
      
      const estimatedPopulation = Math.max(0, s.population + popNoise);
      
      // Aggression proxy: infer from recent behavior (simplified)
      const aggressionProxy = 1 - s.traits.stabilityPreference;
      
      return {
        speciesId: s.traits.id,
        estimatedPopulation,
        aggressionProxy,
      };
    });
  
  // Recent events (filtered by memory length and summarization)
  const recentEvents: SimEvent[] = [];
  const startStep = Math.max(0, world.timeStep - historyLength);
  
  for (let i = Math.max(0, history.length - historyLength); i < history.length; i++) {
    const pastState = history[i];
    if (pastState.timeStep >= startStep) {
      const relevantEvents = pastState.events.filter((e) => {
        return (
          e.data?.speciesId === species.traits.id ||
          e.data?.otherSpeciesId === species.traits.id ||
          e.type === "COLLAPSE" ||
          e.type === "CONCLAVE"
        );
      });
      recentEvents.push(...relevantEvents);
    }
  }
  
  // Add current events
  const currentEvents = world.events.filter((e) => {
    return (
      e.data?.speciesId === species.traits.id ||
      e.data?.otherSpeciesId === species.traits.id ||
      e.type === "COLLAPSE" ||
      e.type === "CONCLAVE"
    );
  });
  recentEvents.push(...currentEvents);

  // Active treaties
  const activeTreaties = world.activeTreaties.filter(t => t.signatories.includes(species.traits.id));
  
  return {
    speciesId: species.traits.id,
    timeStep: world.timeStep,
    resourceEstimates,
    ownPopulation: species.population,
    ownTechLevel: species.techLevel,
    otherSpecies,
    recentEvents: recentEvents.slice(-historyLength * 2),
    activeTreaties,
    informationState,
    memorySummary: informationState.memorySummary,
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
      if (config.useEpistemicOrders && species.traits.epistemicOrder && species.traits.epistemicOrder === "CloisteredOrder") {
        events.push({
          timeStep: state.timeStep,
          type: "CONCLAVE",
          message: `Species "${species.traits.name}" enters conclave.`,
          data: { speciesId: species.traits.id }
        });
      }
    }
  }
  
  // 2. Get decisions only for acting species
  const newDecisions = await getDecisions(observations);
  
  // Sanitize and validate all decisions
  const sanitizedDecisions = newDecisions.map(d => sanitizeDecision(d));
  for (const decision of sanitizedDecisions) {
    const species = state.species.find(s => s.traits.id === decision.speciesId);
    if (species) {
      assertDecisionValid(decision, species);
    }
  }

  // Merge new decisions with previous decisions for non-acting species (persistence)
  // Non-acting species maintain their previous harvest pattern (idle for simplicity)
  const allDecisions: SpeciesDecision[] = [];

  for (const species of state.species) {
    if (!species.alive) continue;

    const newDecision = sanitizedDecisions.find(d => d.speciesId === species.traits.id);
    if (newDecision) {
      allDecisions.push(newDecision);
      
      // Emit HARVEST events for transparency
      for (const [resId, amount] of Object.entries(newDecision.harvest)) {
        if (amount > 0) {
          events.push({
            timeStep: state.timeStep,
            type: "HARVEST",
            message: `${species.traits.name} harvested ${amount.toFixed(1)} units of ${resId}`,
            data: {
              speciesId: species.traits.id,
              resourceId: resId,
              harvestAmount: amount
            }
          });
        }
      }
    } else {
      // Non-acting species: idle (harvest 0) to avoid "zombie overharvest"
      // This is deterministic and explicit
      allDecisions.push({
        speciesId: species.traits.id,
        harvest: {}, // Explicitly idle
        relations: species.relations, // Keep current relations
        governance: species.governance, // Keep current governance
      });
    }
  }

  // 3. Process Treaty Proposals (if treaties enabled)
  const newTreaties: Treaty[] = [];
  
  if (config.useTreaties !== false) {
    for (const decision of newDecisions) {
      if (decision.treatyProposal) {
        const proposer = state.species.find(s => s.traits.id === decision.speciesId);
        const target = state.species.find(s => s.traits.id === decision.treatyProposal?.targetSpeciesId);
        
        if (proposer && target && target.alive) {
          // Check if target is in contact window (can receive?)
          const targetOpen = !config.useEpistemicOrders || isContactWindow(target.traits.epistemicOrder, state.timeStep);
          
          if (targetOpen) {
            // Validate Linguistic Regime (parse-time rejection)
            const availableResources = state.resources.map(r => ({ id: r.def.id, name: r.def.name }));
            const validation = config.useLinguisticRegimes 
              ? validateTreatyText(decision.treatyProposal.text, proposer.traits.linguisticRegime, availableResources)
              : { valid: true, parsedConstraints: {} };
            
            if (validation.valid && validation.parsedConstraints) {
              // Create Treaty
              const treaty: Treaty = {
                id: `treaty-${state.timeStep}-${rng.randomInt(1000, 9999)}`,
                signatories: [proposer.traits.id, target.traits.id],
                epochSigned: state.timeStep,
                text: decision.treatyProposal.text,
                interpretedConstraints: validation.parsedConstraints,
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
              
              // Track stated intent for deception gap
              if (decision.treatyProposal.statedConstraints) {
                // Store in decision for later comparison
                decision.treatyProposal.statedConstraints = validation.parsedConstraints.maxHarvestByResource 
                  ? { maxHarvestByResource: validation.parsedConstraints.maxHarvestByResource }
                  : undefined;
              }
            } else {
              events.push({
                timeStep: state.timeStep,
                type: "LANGUAGE_REJECTED",
                message: `Treaty proposal from ${proposer.traits.name} failed linguistic validation: ${validation.reason || "Invalid format"}`,
                data: { speciesId: proposer.traits.id }
              });
            }
          }
        }
      }
    }
  }

  // 4. Enforce Active Treaties (Check for violations and deception gaps)
  const activeTreaties = [...state.activeTreaties, ...newTreaties].filter(t => !t.expiresAt || t.expiresAt > state.timeStep);
  
  if (config.useTreaties !== false) {
    for (const treaty of activeTreaties) {
      if (treaty.violated) continue; // Already broken

      for (const signatoryId of treaty.signatories) {
        const decision = allDecisions.find(d => d.speciesId === signatoryId);
        if (!decision) continue;

        // Check max harvest constraints
        if (treaty.interpretedConstraints.maxHarvestByResource) {
          for (const [resId, maxAmt] of Object.entries(treaty.interpretedConstraints.maxHarvestByResource)) {
            const actualHarvest = decision.harvest[resId] || 0;
            
            if (actualHarvest > maxAmt * 1.1) { // 10% buffer
              treaty.violated = true;
              events.push({
                timeStep: state.timeStep,
                type: "DEFECT",
                message: `Treaty ${treaty.id} violated by ${signatoryId} (Harvest ${resId} > ${maxAmt})`,
                data: { speciesId: signatoryId, treatyId: treaty.id }
              });
            }
            
            // Track deception gap (stated intent vs realized action)
            const statedLimit = maxAmt;
            const gap = Math.abs(actualHarvest - statedLimit);
            if (gap > statedLimit * 0.1) { // More than 10% deviation
              events.push({
                timeStep: state.timeStep,
                type: "DECEPTION_GAP",
                message: `Deception gap detected for ${signatoryId}: stated ${statedLimit}, realized ${actualHarvest.toFixed(2)}`,
                data: { speciesId: signatoryId, treatyId: treaty.id },
                statedIntent: {
                  treatyId: treaty.id,
                  proposedConstraint: { [resId]: statedLimit },
                },
                realizedAction: {
                  actualHarvest: { [resId]: actualHarvest },
                },
              });
            }
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
  
  const newState: WorldState = {
    timeStep: state.timeStep + 1,
    planet: state.planet,
    resources: newResources,
    species: newSpecies,
    events: [...events, ...detectedEvents],
    activeTreaties: activeTreaties.filter(t => !t.violated), // Keep only valid treaties
  };
  
  // CRITICAL: Assert state is valid before returning
  assertWorldState(newState);
  
  return newState;
}
