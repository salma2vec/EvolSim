import { getAvailablePresets } from "../sim/presets";
/**
 * Validation utilities for input validation and data integrity checks
 */

import { WorldState, SpeciesDecision, SpeciesObservation, SimConfig, ResourceState, SpeciesState } from "../sim/types";

/**
 * Validate a simulation configuration
 */
export function validateSimConfig(config: Partial<SimConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) return { valid: false, errors: ["config must be an object"] };
  const allowed = new Set(["maxTimeSteps", "harvestNoise", "historyLength", "useLinguisticRegimes", "useEpistemicOrders", "useTreaties", "useBaselineAgents", "useStructuredDecisions", "includeNumericRules", "useIndependentRandomStreams", "llmTemperature", "llmSeed", "baselinePolicyMap", "rngSeed"]);
  for (const key of Object.keys(config)) if (!allowed.has(key)) errors.push(`Unknown config key: ${key}`);
  for (const key of ["maxTimeSteps", "historyLength"] as const) {
    const x = config[key];
    if (x !== undefined && (!Number.isInteger(x) || x < (key === "maxTimeSteps" ? 1 : 0) || x > 200)) errors.push(`${key} must be an integer within 0/1 and 200`);
  }
  if (config.harvestNoise !== undefined && (!Number.isFinite(config.harvestNoise) || config.harvestNoise < 0 || config.harvestNoise > 1)) errors.push("harvestNoise must be within 0 and 1");
  for (const key of ["useLinguisticRegimes", "useEpistemicOrders", "useTreaties", "useBaselineAgents", "useStructuredDecisions", "includeNumericRules", "useIndependentRandomStreams"] as const) {
    if (config[key] !== undefined && typeof config[key] !== "boolean") errors.push(`${key} must be boolean`);
  }
  if (config.rngSeed !== undefined && !Number.isSafeInteger(config.rngSeed)) errors.push("rngSeed must be a safe integer");
  if (config.llmTemperature !== undefined && (!Number.isFinite(config.llmTemperature) || config.llmTemperature < 0 || config.llmTemperature > 2)) errors.push("llmTemperature must be in [0,2]");
  if (config.llmSeed !== undefined && (!Number.isInteger(config.llmSeed) || config.llmSeed < 0 || config.llmSeed >= 2**31)) errors.push("llmSeed must be an integer in [0,2**31)");
  if (config.baselinePolicyMap !== undefined && (!config.baselinePolicyMap || Array.isArray(config.baselinePolicyMap) || typeof config.baselinePolicyMap !== "object" ||
      Object.values(config.baselinePolicyMap).some(x => !["cooperative", "defector", "conservative", "opportunistic"].includes(x)))) errors.push("Invalid baseline policy map");
  return { valid: errors.length === 0, errors };

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
export function validateSimulationRequest(body: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    errors.push("Request body must be an object");
    return { valid: false, errors };
  }

  const req = body as Record<string, unknown>;

  if (!req.presetId || typeof req.presetId !== "string") {
    errors.push("presetId is required and must be a string");
  }

  if (typeof req.presetId === "string" && !getAvailablePresets().includes(req.presetId)) errors.push("Unknown presetId");

  if (req.numSteps !== undefined) {
    if (typeof req.numSteps !== "number" || !Number.isInteger(req.numSteps) || req.numSteps < 1 || req.numSteps > 200) {
      errors.push("numSteps must be an integer between 1 and 200");
    }
  } else {
    errors.push("numSteps is required");
  }

  if (req.speciesModelMap !== undefined) {
    if (typeof req.speciesModelMap !== "object" || Array.isArray(req.speciesModelMap) || req.speciesModelMap === null) {
      errors.push("speciesModelMap must be an object");
    }
  }

  if (req.speciesModelMap && typeof req.speciesModelMap === "object" && Object.values(req.speciesModelMap).some(x => typeof x !== "string" || x.length > 100)) errors.push("Invalid model identifier");

  if (req.seed !== undefined && !Number.isSafeInteger(req.seed)) {
    errors.push("seed must be a number");
  }

  if (req.config !== undefined) {
    const configValidation = validateSimConfig(req.config as Partial<SimConfig>);
    errors.push(...configValidation.errors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
