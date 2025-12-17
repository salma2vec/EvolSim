/**
 * Execution path guards and assertions
 * 
 * Explicit guards to prevent silent failures and state corruption.
 */

import { WorldState, SpeciesState, ResourceState, SpeciesDecision } from "./types";
import { SPECIES_CONSTANTS, RESOURCE_CONSTANTS } from "../config";

/**
 * Assert resource state is valid
 */
export function assertResourceState(resource: ResourceState): void {
  if (resource.amount < 0) {
    throw new Error(`Resource ${resource.def.id} has negative amount: ${resource.amount}`);
  }
  if (resource.amount > resource.def.capacityK * 1.1) {
    throw new Error(`Resource ${resource.def.id} exceeds capacity: ${resource.amount} > ${resource.def.capacityK * 1.1}`);
  }
  if (resource.def.capacityK <= 0) {
    throw new Error(`Resource ${resource.def.id} has invalid capacity: ${resource.def.capacityK}`);
  }
  if (resource.def.regenRate < 0 || resource.def.regenRate > 1) {
    throw new Error(`Resource ${resource.def.id} has invalid regenRate: ${resource.def.regenRate}`);
  }
  // Collapse is irreversible
  if (resource.collapsed && resource.amount >= resource.def.collapseThreshold) {
    throw new Error(`Resource ${resource.def.id} is marked collapsed but amount (${resource.amount}) >= threshold (${resource.def.collapseThreshold})`);
  }
}

/**
 * Assert species state is valid
 */
export function assertSpeciesState(species: SpeciesState): void {
  if (species.population < 0) {
    throw new Error(`Species ${species.traits.id} has negative population: ${species.population}`);
  }
  if (species.population > SPECIES_CONSTANTS.MAX_POPULATION * 1.1) {
    throw new Error(`Species ${species.traits.id} exceeds max population: ${species.population}`);
  }
  if (!species.alive && species.population > 0) {
    throw new Error(`Species ${species.traits.id} is marked extinct but has population: ${species.population}`);
  }
  if (species.alive && species.population < SPECIES_CONSTANTS.EXTINCTION_THRESHOLD) {
    throw new Error(`Species ${species.traits.id} is marked alive but population (${species.population}) < threshold (${SPECIES_CONSTANTS.EXTINCTION_THRESHOLD})`);
  }
  if (species.techLevel < 0 || species.techLevel > SPECIES_CONSTANTS.MAX_TECH_LEVEL) {
    throw new Error(`Species ${species.traits.id} has invalid techLevel: ${species.techLevel}`);
  }
}

/**
 * Assert world state is valid
 */
export function assertWorldState(state: WorldState): void {
  if (state.timeStep < 0) {
    throw new Error(`Invalid timeStep: ${state.timeStep}`);
  }
  
  for (const resource of state.resources) {
    assertResourceState(resource);
  }
  
  for (const species of state.species) {
    assertSpeciesState(species);
  }
  
  // Verify no duplicate species IDs
  const speciesIds = new Set<string>();
  for (const species of state.species) {
    if (speciesIds.has(species.traits.id)) {
      throw new Error(`Duplicate species ID: ${species.traits.id}`);
    }
    speciesIds.add(species.traits.id);
  }
  
  // Verify no duplicate resource IDs
  const resourceIds = new Set<string>();
  for (const resource of state.resources) {
    if (resourceIds.has(resource.def.id)) {
      throw new Error(`Duplicate resource ID: ${resource.def.id}`);
    }
    resourceIds.add(resource.def.id);
  }
}

/**
 * Assert decision is valid for a species
 */
export function assertDecisionValid(decision: SpeciesDecision, species: SpeciesState): void {
  if (decision.speciesId !== species.traits.id) {
    throw new Error(`Decision speciesId mismatch: ${decision.speciesId} !== ${species.traits.id}`);
  }
  
  if (!species.alive) {
    throw new Error(`Decision for extinct species: ${species.traits.id}`);
  }
  
  // Validate harvest amounts
  for (const [resourceId, amount] of Object.entries(decision.harvest)) {
    if (amount < 0 || amount > 100) {
      throw new Error(`Invalid harvest amount for ${resourceId}: ${amount} (must be 0-100)`);
    }
    if (isNaN(amount)) {
      throw new Error(`NaN harvest amount for ${resourceId}`);
    }
  }
  
  // Validate governance
  const { punishmentStrength, monitoringInvestment } = decision.governance;
  if (punishmentStrength < 0 || punishmentStrength > 1 || isNaN(punishmentStrength)) {
    throw new Error(`Invalid punishmentStrength: ${punishmentStrength}`);
  }
  if (monitoringInvestment < 0 || monitoringInvestment > 1 || isNaN(monitoringInvestment)) {
    throw new Error(`Invalid monitoringInvestment: ${monitoringInvestment}`);
  }
}

/**
 * Sanitize decision to ensure it's safe to apply
 */
export function sanitizeDecision(decision: SpeciesDecision): SpeciesDecision {
  const sanitized: SpeciesDecision = {
    speciesId: decision.speciesId,
    harvest: {},
    relations: decision.relations || {},
    governance: {
      punishmentStrength: Math.max(0, Math.min(1, decision.governance.punishmentStrength || 0.3)),
      monitoringInvestment: Math.max(0, Math.min(1, decision.governance.monitoringInvestment || 0.2)),
    },
  };
  
  // Sanitize harvest amounts
  for (const [resourceId, amount] of Object.entries(decision.harvest || {})) {
    if (typeof amount === "number" && !isNaN(amount) && isFinite(amount)) {
      sanitized.harvest[resourceId] = Math.max(0, Math.min(100, amount));
    }
  }
  
  // Copy treaty proposal if valid
  if (decision.treatyProposal) {
    if (
      typeof decision.treatyProposal.text === "string" &&
      typeof decision.treatyProposal.targetSpeciesId === "string" &&
      decision.treatyProposal.text.length > 0 &&
      decision.treatyProposal.text.length <= 500
    ) {
      sanitized.treatyProposal = {
        text: decision.treatyProposal.text,
        targetSpeciesId: decision.treatyProposal.targetSpeciesId,
        statedConstraints: decision.treatyProposal.statedConstraints,
      };
    }
  }
  
  return sanitized;
}

