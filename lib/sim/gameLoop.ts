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
  LivingSimile,
} from "./types";
import { updateResources, updateSpeciesPopulation, computePerCapitaResource, computeStress, applyGovernanceEffects, resolveHarvests } from "./dynamics";
import { getRNG } from "./random";
import { isContactWindow, buildInformationState, getMemoryLength, getObservationBandwidth, canSeeSpecies, canSeeResource } from "./orders";
import { validateTreatyText } from "./language";
import { HARVEST_CONSTANTS } from "../config";
import { shouldUseBaselineAgent, generateBaselineDecision, getBaselinePolicy } from "./baselineAgents";
import type { BaselinePolicy } from "./baselineAgents";
import { assertWorldState, sanitizeDecision, assertDecisionValid, assertConservation } from "./guards";

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
  const effectiveOrder = config.useEpistemicOrders ? species.traits.epistemicOrder : "Order-0";
  
  // Build information state based on epistemic order
  const memoryLength = getMemoryLength(effectiveOrder);
  const informationState = buildInformationState(
    effectiveOrder,
    world.timeStep,
    history,
    memoryLength
  );
  
  const observationBandwidth = informationState.observationBandwidth;
  const historyLength = config.historyLength ?? memoryLength;
  
  // Noisy resource estimates (filtered by asymmetric visibility and bandwidth)
  const resourceEstimates = world.resources
    .filter((resource) => canSeeResource(effectiveOrder, resource.def.location?.z || 0))
    .map((resource) => {
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
  
  // Other species (noisy summaries, filtered by asymmetric visibility and bandwidth)
  const otherSpecies = world.species
    .filter((s) => s.traits.id !== species.traits.id && s.alive)
    .filter((s) => canSeeSpecies(effectiveOrder, s.traits.epistemicOrder))
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
  
  // Living similes available for reference (Embassytown mechanic)
  const availableSimiles = (world.livingSimiles || []).filter(simile => {
    // Only show similes from epochs the agent could observe
    if (effectiveOrder) {
      const memoryLength = getMemoryLength(effectiveOrder);
      return world.timeStep - simile.createdAt <= memoryLength;
    }
    return true;
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
    availableSimiles,
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
      if (config.useEpistemicOrders && species.traits.epistemicOrder && isContactWindow(species.traits.epistemicOrder, state.timeStep)) {
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
  
  // Lex budget enforcement
  const lexCosts = config.lexCosts || { DESCRIBE: 10, PROMISE: 20, COMMIT: 30, PROPOSE: 30, REPORT: 10 };
  
  for (const decision of sanitizedDecisions) {
    const species = state.species.find(s => s.traits.id === decision.speciesId);
    if (species) {
      assertDecisionValid(decision, species);
      
      // Calculate total Lex cost for communication acts
      let totalLexCost = 0;
      if (decision.communication) {
        for (const comm of decision.communication) {
          totalLexCost += lexCosts[comm.intent] || 10;
        }
      }
      
      // Add treaty proposal cost if applicable
      if (decision.treatyProposal) {
        totalLexCost += lexCosts.PROPOSE;
      }
      
      // Enforce budget
      if (totalLexCost > species.lexBudget) {
        // Budget exceeded: strip communications and proposals
        decision.communication = [];
        decision.treatyProposal = undefined;
        
        events.push({
          timeStep: state.timeStep,
          type: "LANGUAGE_REJECTED",
          message: `Speech acts for ${species.traits.name} rejected: Lex cost (${totalLexCost}) exceeds budget (${species.lexBudget.toFixed(1)}).`,
          data: { speciesId: species.traits.id }
        });
      } else {
        // Deduct Lex cost
        // Note: Lex deduction will be applied when creating newSpecies
        (decision as any)._lexCost = totalLexCost;

        if (totalLexCost > 0) {
          events.push({
            timeStep: state.timeStep,
            type: "LEX_BURN",
            message: `${species.traits.name} burned ${totalLexCost} Lex units on speech acts.`,
            data: { speciesId: species.traits.id, amount: totalLexCost }
          });
        }
      }
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
    for (const decision of sanitizedDecisions) {
      if (decision.treatyProposal) {
        const proposer = state.species.find(s => s.traits.id === decision.speciesId);
        const target = state.species.find(s => s.traits.id === decision.treatyProposal?.targetSpeciesId);
        
        if (proposer && target && target.alive) {
          // Check if target is in contact window (can receive?)
          const targetOpen = !config.useEpistemicOrders || isContactWindow(target.traits.epistemicOrder, state.timeStep);
          
          if (targetOpen) {
            // Validate Linguistic Regime (parse-time rejection with truth verification)
            const availableResources = state.resources.map(r => ({ 
              id: r.def.id, 
              name: r.def.name,
              amount: r.amount 
            }));
            const availableSimiles = state.livingSimiles || [];
            const validation = config.useLinguisticRegimes 
              ? validateTreatyText(
                  decision.treatyProposal.text, 
                  proposer.traits.linguisticRegime, 
                  availableResources,
                  history.map(h => ({
                    timeStep: h.timeStep,
                    resources: h.resources.map(r => ({ def: { id: r.def.id }, amount: r.amount }))
                  })),
                  proposer.traits.epistemicOrder,
                  availableSimiles
                )
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
  const activeTreaties = [...state.activeTreaties.map(t => ({ ...t })), ...newTreaties].filter(t => !t.expiresAt || t.expiresAt > state.timeStep);
  
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

  // 5. Resolve harvests (strict conservation and voxel access)
  const governanceAdjustedHarvests = applyGovernanceEffects(allDecisions, state.species);
  const realizedHarvestsBySpecies = resolveHarvests(governanceAdjustedHarvests, state.resources, state.species, config.useEpistemicOrders === true);
  
  for (const [speciesId, harvests] of Object.entries(realizedHarvestsBySpecies)) {
    for (const [resourceId, harvestAmount] of Object.entries(harvests)) {
      events.push({ timeStep: state.timeStep, type: "HARVEST",
        message: `${speciesId} harvested ${harvestAmount.toFixed(1)} units of ${resourceId}`,
        data: { speciesId, resourceId, harvestAmount } });
    }
  }

  // CRITICAL: Assert resource conservation before applying dynamics
  assertConservation(realizedHarvestsBySpecies, state.resources);

  // Aggregate realized harvests by resource for world dynamics
  const totalRealizedHarvests: Record<string, number> = {};
  for (const [speciesId, harvests] of Object.entries(realizedHarvestsBySpecies)) {
    for (const [resId, amount] of Object.entries(harvests)) {
      totalRealizedHarvests[resId] = (totalRealizedHarvests[resId] || 0) + amount;
    }
  }

  // Detect and log scarcity conflicts
  for (const resource of state.resources) {
    const resId = resource.def.id;
    const requested = Object.values(governanceAdjustedHarvests).reduce((sum, h) => sum + (h[resId] || 0), 0);
    const realized = totalRealizedHarvests[resId] || 0;
    
    if (requested > resource.amount && resource.amount > 0) {
      events.push({
        timeStep: state.timeStep,
        type: "RESOURCE_SCARCITY_CONFLICT",
        message: `Resource conflict for ${resId}: requested ${requested.toFixed(1)}, only ${resource.amount.toFixed(1)} available. Proportional scaling applied.`,
        data: { resourceId: resId, amount: resource.amount }
      });
    }
  }

  const newResources = updateResources(
    state.resources,
    totalRealizedHarvests,
    state.planet,
    config
  );
  
  const newSpecies = state.species.map((species) => {
    if (!species.alive) return species;
    
    // Compute per-capita resource based on REALIZED harvest
    const speciesRealizedHarvest = realizedHarvestsBySpecies[species.traits.id] || {};
    
    const perCapitaResource = computePerCapitaResource(species, state.resources, speciesRealizedHarvest);
    const stress = computeStress(species, newResources, state.planet);
    
    const updatedSpecies = updateSpeciesPopulation(species, perCapitaResource, stress, state.planet);
    
    // Update state from decision
    const speciesDecision = sanitizedDecisions.find(d => d.speciesId === species.traits.id);
    if (speciesDecision) {
      updatedSpecies.governance = speciesDecision.governance;
      updatedSpecies.relations = { ...updatedSpecies.relations, ...speciesDecision.relations };
    }
    
    // Update epistemic state
    if (actingSpecies.find(s => s.traits.id === species.traits.id)) {
      updatedSpecies.lastDecisionStep = state.timeStep;
    }
    
    // Update Lex budget: deduct and regenerate
    const lexCost = (speciesDecision as any)?._lexCost || 0;
    const lexRegen = config.lexRegenRate || 5;
    updatedSpecies.lexBudget = Math.max(0, species.lexBudget - lexCost + lexRegen);
    updatedSpecies.lexRegenRate = lexRegen;

    updatedSpecies.techLevel = Math.min(1.0, updatedSpecies.techLevel + 0.001);
    
    return updatedSpecies;
  });
  
  const detectedEvents = detectEvents(state, { ...state, resources: newResources, species: newSpecies }, allDecisions);
  
  // 6. Track Living Similes (Embassytown mechanic: actions become referents)
  const existingSimiles = state.livingSimiles || [];
  const newSimiles: LivingSimile[] = [];
  
  // Create living similes from significant actions this epoch
  for (const [speciesId, harvests] of Object.entries(realizedHarvestsBySpecies)) {
    const species = state.species.find(s => s.traits.id === speciesId);
    if (!species || !species.alive) continue;
    
    // Create simile for each resource harvest (if significant)
    for (const [resId, amount] of Object.entries(harvests)) {
      if (amount > 0) {
        const resource = state.resources.find(r => r.def.id === resId);
        if (resource) {
          // Only create similes for moderate-to-high harvests (above 10% of capacity)
          const threshold = resource.def.capacityK * 0.1;
          if (amount >= threshold) {
            const actionHash = `${speciesId}-${resId}-${Math.round(amount)}`;
            const simile: LivingSimile = {
              id: `simile-${state.timeStep}-${actionHash}`,
              speciesId,
              epoch: state.timeStep,
              action: `harvested ${amount.toFixed(1)} units of ${resource.def.name}`,
              referent: `the agent who harvested ${Math.round(amount)} units of ${resource.def.name}`,
              createdAt: state.timeStep,
            };
            newSimiles.push(simile);
          }
        }
      }
    }
  }
  
  // Keep similes from last 20 epochs (they can be referenced)
  const maxSimileAge = 20;
  const allSimiles = [...existingSimiles, ...newSimiles].filter(
    s => state.timeStep - s.createdAt <= maxSimileAge
  );
  
  const newState: WorldState = {
    ...state,
    timeStep: state.timeStep + 1,
    planet: state.planet,
    resources: newResources,
    species: newSpecies,
    events: [...events, ...detectedEvents],
    activeTreaties: activeTreaties.filter(t => !t.violated), // Keep only valid treaties
    livingSimiles: allSimiles,
  };
  
  // CRITICAL: Assert state is valid before returning
  assertWorldState(newState);
  
  return newState;
}
