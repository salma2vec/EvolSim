/**
 * Validation utilities for input validation and data integrity checks
 */

import { WorldState, SpeciesDecision, SpeciesObservation, SimConfig, ResourceState, SpeciesState } from "../sim/types";

/**
 * Validate a simulation configuration
 */
export function validateSimConfig(config: Partial<SimConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.maxTimeSteps !== undefined) {
    if (typeof config.maxTimeSteps !== "number" || config.maxTimeSteps < 1) {
      errors.push("maxTimeSteps must be a positive number");
    }
  }

  if (config.harvestNoise !== undefined) {
    if (typeof config.harvestNoise !== "number" || config.harvestNoise < 0 || config.harvestNoise > 1) {
      errors.push("harvestNoise must be a number between 0 and 1");
    }
  }

  if (config.historyLength !== undefined) {
    if (typeof config.historyLength !== "number" || config.historyLength < 0) {
      errors.push("historyLength must be a non-negative number");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a species decision
 */
export function validateSpeciesDecision(decision: Partial<SpeciesDecision>, speciesId: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!decision.speciesId || decision.speciesId !== speciesId) {
    errors.push(`speciesId mismatch: expected ${speciesId}, got ${decision.speciesId}`);
  }

  if (decision.harvest) {
    for (const [resourceId, amount] of Object.entries(decision.harvest)) {
      if (typeof amount !== "number" || amount < 0 || amount > 100) {
        errors.push(`harvest amount for ${resourceId} must be between 0 and 100`);
      }
    }
  }

  if (decision.relations) {
    const validStances = ["ally", "neutral", "sanction", "war"];
    for (const [otherId, stance] of Object.entries(decision.relations)) {
      if (!validStances.includes(stance)) {
        errors.push(`invalid diplomatic stance: ${stance} for ${otherId}`);
      }
    }
  }

  if (decision.governance) {
    const { punishmentStrength, monitoringInvestment } = decision.governance;
    if (punishmentStrength !== undefined && (punishmentStrength < 0 || punishmentStrength > 1)) {
      errors.push("punishmentStrength must be between 0 and 1");
    }
    if (monitoringInvestment !== undefined && (monitoringInvestment < 0 || monitoringInvestment > 1)) {
      errors.push("monitoringInvestment must be between 0 and 1");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a world state
 */
export function validateWorldState(state: Partial<WorldState>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (state.timeStep !== undefined) {
    if (typeof state.timeStep !== "number" || state.timeStep < 0) {
      errors.push("timeStep must be a non-negative number");
    }
  }

  if (state.resources) {
    for (const resource of state.resources) {
      const resourceErrors = validateResourceState(resource);
      errors.push(...resourceErrors.errors);
    }
  }

  if (state.species) {
    for (const species of state.species) {
      const speciesErrors = validateSpeciesState(species);
      errors.push(...speciesErrors.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a resource state
 */
export function validateResourceState(resource: Partial<ResourceState>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (resource.def) {
    if (!resource.def.id || typeof resource.def.id !== "string") {
      errors.push("resource def.id must be a non-empty string");
    }
    if (resource.def.capacityK !== undefined && (typeof resource.def.capacityK !== "number" || resource.def.capacityK <= 0)) {
      errors.push("resource capacityK must be a positive number");
    }
    if (resource.def.regenRate !== undefined && (typeof resource.def.regenRate !== "number" || resource.def.regenRate < 0 || resource.def.regenRate > 1)) {
      errors.push("resource regenRate must be between 0 and 1");
    }
  }

  if (resource.amount !== undefined) {
    if (typeof resource.amount !== "number" || resource.amount < 0) {
      errors.push("resource amount must be a non-negative number");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a species state
 */
export function validateSpeciesState(species: Partial<SpeciesState>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (species.traits) {
    if (!species.traits.id || typeof species.traits.id !== "string") {
      errors.push("species traits.id must be a non-empty string");
    }
  }

  if (species.population !== undefined) {
    if (typeof species.population !== "number" || species.population < 0) {
      errors.push("species population must be a non-negative number");
    }
  }

  if (species.techLevel !== undefined) {
    if (typeof species.techLevel !== "number" || species.techLevel < 0 || species.techLevel > 1) {
      errors.push("species techLevel must be between 0 and 1");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate API request body for simulation endpoint
 */
export function validateSimulationRequest(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!body.presetId || typeof body.presetId !== "string") {
    errors.push("presetId is required and must be a string");
  }

  if (body.numSteps !== undefined) {
    if (typeof body.numSteps !== "number" || body.numSteps < 1 || body.numSteps > 1000) {
      errors.push("numSteps must be a number between 1 and 1000");
    }
  } else {
    errors.push("numSteps is required");
  }

  if (body.speciesModelMap !== undefined) {
    if (typeof body.speciesModelMap !== "object" || Array.isArray(body.speciesModelMap)) {
      errors.push("speciesModelMap must be an object");
    }
  }

  if (body.seed !== undefined && typeof body.seed !== "number") {
    errors.push("seed must be a number");
  }

  if (body.config !== undefined) {
    const configValidation = validateSimConfig(body.config);
    errors.push(...configValidation.errors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

