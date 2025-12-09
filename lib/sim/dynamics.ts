/**
 * Dynamics engine: resource and population updates
 * 
 * This module handles the core simulation dynamics including:
 * - Resource regeneration using logistic growth models
 * - Species population updates based on resources and stress
 * - Governance effects on harvest efficiency
 * 
 * @module lib/sim/dynamics
 */

import { ResourceState, PlanetEnv, SpeciesState, SpeciesDecision } from "./types";
import { getRNG } from "./random";
import { GOVERNANCE_CONSTANTS, HARVEST_CONSTANTS, SPECIES_CONSTANTS } from "../config";

/**
 * Update resources using logistic growth model
 * 
 * Formula: R_{t+1} = max(0, R_t + g*R_t*(1-R_t/K) - harvest + noise)
 * 
 * @param resources - Current resource states
 * @param harvests - Total harvest amounts by resource ID
 * @param planet - Planet environment parameters
 * @param config - Optional configuration (harvestNoise)
 * @returns Updated resource states
 */
export function updateResources(
  resources: ResourceState[],
  harvests: Record<string, number>, // resourceId -> total harvested
  planet: PlanetEnv,
  config?: { harvestNoise?: number }
): ResourceState[] {
  const rng = getRNG();
  const harvestNoise = config?.harvestNoise ?? 0.05;
  
  return resources.map((resource) => {
    // Validate resource state
    if (resource.amount < 0) {
      resource.amount = 0;
    }
    if (resource.amount > resource.def.capacityK * 1.1) {
      // Cap at slightly above capacity (allows for temporary overshoot)
      resource.amount = resource.def.capacityK * 1.1;
    }
    
    if (resource.collapsed) {
      // Collapsed resources don't regenerate
      const harvest = harvests[resource.def.id] || 0;
      return {
        ...resource,
        amount: Math.max(0, resource.amount - harvest),
      };
    }
    
    const currentAmount = resource.amount;
    const capacity = resource.def.capacityK;
    const regenRate = resource.def.regenRate;
    
    // Validate capacity and regen rate
    if (capacity <= 0 || regenRate < 0 || regenRate > 1) {
      // Invalid resource definition, return unchanged
      return resource;
    }
    
    // Logistic growth: g * R * (1 - R/K)
    const growth = regenRate * currentAmount * (1 - currentAmount / capacity);
    
    // Harvest with noise (ensure non-negative)
    const harvest = Math.max(0, harvests[resource.def.id] || 0);
    const harvestWithNoise = Math.max(0, harvest * (1 + rng.normal(0, harvestNoise)));
    
    // Environmental shock (volatility)
    const shock = rng.normal(0, planet.volatility * capacity * 0.1);
    
    // Update amount (ensure non-negative)
    const newAmount = Math.max(0, currentAmount + growth - harvestWithNoise + shock);
    
    // Check for collapse
    const collapsed = newAmount < resource.def.collapseThreshold;
    
    return {
      ...resource,
      amount: newAmount,
      collapsed: collapsed || resource.collapsed,
    };
  });
}

/**
 * Compute per-capita resource for a species
 * 
 * Calculates the total resource value per individual in the species population.
 * 
 * @param species - Species state
 * @param resources - Available resources
 * @param harvests - Harvest amounts by resource ID
 * @returns Per-capita resource value
 */
export function computePerCapitaResource(
  species: SpeciesState,
  resources: ResourceState[],
  harvests: Record<string, number> // speciesId -> resourceId -> harvest
): number {
  let totalValue = 0;
  
  for (const resource of resources) {
    const harvest = harvests[resource.def.id] || 0;
    if (harvest > 0 && species.population > 0) {
      const perCapita = (harvest * resource.def.valuePerUnit) / species.population;
      totalValue += perCapita;
    }
  }
  
  return totalValue;
}

/**
 * Compute stress factor for a species
 * 
 * Stress is calculated from:
 * - Metabolic cost (gravity, temperature)
 * - Resource scarcity
 * - Population density
 * 
 * @param species - Species state
 * @param resources - Available resources
 * @param planet - Planet environment
 * @returns Stress factor (0-1, higher = more stress)
 */
export function computeStress(
  species: SpeciesState,
  resources: ResourceState[],
  planet: PlanetEnv
): number {
  // Base stress from metabolic cost
  let stress = planet.metabolicCost * 0.3;
  
  // Stress from resource scarcity
  const totalResourceCapacity = resources.reduce((sum, r) => sum + r.def.capacityK, 0);
  const totalResourceAmount = resources.reduce((sum, r) => sum + r.amount, 0);
  const resourceScarcity = 1 - (totalResourceAmount / totalResourceCapacity);
  stress += resourceScarcity * 0.4;
  
  // Stress from high population density (if applicable)
  const populationDensity = species.population / 10000000; // Normalize
  stress += Math.min(0.3, populationDensity * 0.1);
  
  return Math.min(1.0, stress);
}

/**
 * Update species population using exponential growth/decline
 * 
 * Formula: N_{t+1} = N_t * exp(a*resource - b*stress)
 * 
 * @param species - Current species state
 * @param perCapitaResource - Resource value per individual
 * @param stress - Stress factor (0-1)
 * @param planet - Planet environment
 * @returns Updated species state
 */
export function updateSpeciesPopulation(
  species: SpeciesState,
  perCapitaResource: number,
  stress: number,
  planet: PlanetEnv
): SpeciesState {
  // Validate species state
  if (!species.alive || species.population <= 0) {
    return { ...species, alive: false, population: 0 };
  }
  
  // Validate inputs
  if (perCapitaResource < 0) perCapitaResource = 0;
  if (stress < 0) stress = 0;
  if (stress > 1) stress = 1;
  
  // Validate population bounds
  if (species.population < 0) {
    species.population = 0;
  }
  if (species.population > SPECIES_CONSTANTS.MAX_POPULATION * 1.1) {
    species.population = SPECIES_CONSTANTS.MAX_POPULATION * 1.1;
  }
  
  // Growth parameters
  const a = species.traits.reproductionRate * 0.1; // Resource-to-growth multiplier
  const b = 0.5; // Stress-to-decline multiplier
  
  // Normalize per-capita resource (0-1 scale)
  const normalizedResource = Math.min(1.0, perCapitaResource / 10.0);
  
  // Exponential growth/decline
  const growthFactor = Math.exp(a * normalizedResource - b * stress);
  let newPopulation = species.population * growthFactor;
  
  // Apply planet productivity modifier
  newPopulation *= (0.8 + planet.productivity * 0.4);
  
  // Cap population growth (can't exceed reasonable limits)
  newPopulation = Math.min(SPECIES_CONSTANTS.MAX_POPULATION, newPopulation);
  
  // Ensure non-negative
  newPopulation = Math.max(0, newPopulation);
  
  // Extinction threshold
  const alive = newPopulation >= SPECIES_CONSTANTS.EXTINCTION_THRESHOLD;
  
  if (!alive) {
    newPopulation = 0;
  }
  
  // Validate tech level
  let techLevel = species.techLevel;
  if (techLevel < 0) techLevel = 0;
  if (techLevel > SPECIES_CONSTANTS.MAX_TECH_LEVEL) techLevel = SPECIES_CONSTANTS.MAX_TECH_LEVEL;
  
  return {
    ...species,
    population: newPopulation,
    alive,
    techLevel,
  };
}

/**
 * Apply governance effects (internal punishment reduces effective harvest)
 * 
 * Strong governance can reduce over-harvesting through internal enforcement.
 * 
 * @param decisions - Species decisions with harvest amounts
 * @param species - Species states
 * @returns Effective harvest amounts aggregated by resource ID
 */
export function applyGovernanceEffects(
  decisions: SpeciesDecision[],
  species: SpeciesState[]
): Record<string, number> {
  // Map speciesId -> resourceId -> effective harvest
  const effectiveHarvests: Record<string, Record<string, number>> = {};
  
  for (const decision of decisions) {
    const speciesState = species.find((s) => s.traits.id === decision.speciesId);
    if (!speciesState || !speciesState.alive) continue;
    
    effectiveHarvests[decision.speciesId] = {};
    
    for (const [resourceId, harvest] of Object.entries(decision.harvest)) {
      let effectiveHarvest = harvest;
      
      // If governance is strong and harvest is high, reduce it (internal punishment)
      const punishmentStrength = decision.governance.punishmentStrength;
      const monitoringInvestment = decision.governance.monitoringInvestment;
      
      // Calculate governance effectiveness
      const governanceEffectiveness = punishmentStrength * monitoringInvestment;
      
      // If governance is effective and harvest exceeds threshold, apply reduction
      if (
        governanceEffectiveness > GOVERNANCE_CONSTANTS.EFFECTIVENESS_THRESHOLD &&
        harvest > GOVERNANCE_CONSTANTS.HARVEST_THRESHOLD_FOR_GOVERNANCE
      ) {
        // Reduce harvest proportionally to governance strength
        const excessHarvest = harvest - GOVERNANCE_CONSTANTS.HARVEST_THRESHOLD_FOR_GOVERNANCE;
        const reduction = excessHarvest * governanceEffectiveness * GOVERNANCE_CONSTANTS.HARVEST_REDUCTION_FACTOR;
        effectiveHarvest = harvest - reduction;
      }
      
      effectiveHarvests[decision.speciesId][resourceId] = Math.max(0, effectiveHarvest);
    }
  }
  
  // Aggregate by resource
  const aggregated: Record<string, number> = {};
  
  for (const [speciesId, harvests] of Object.entries(effectiveHarvests)) {
    for (const [resourceId, amount] of Object.entries(harvests)) {
      aggregated[resourceId] = (aggregated[resourceId] || 0) + amount;
    }
  }
  
  return aggregated;
}

