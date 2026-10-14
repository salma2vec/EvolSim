import { describe, it, expect, beforeEach } from "vitest";
/**
 * Unit tests for dynamics module
 */

import { updateResources, updateSpeciesPopulation, computeStress } from "@/lib/sim/dynamics";
import { ResourceState, PlanetEnv, SpeciesState, SpeciesTraits } from "@/lib/sim/types";
import { setRNGSeed } from "@/lib/sim/random";

describe("updateResources", () => {
  beforeEach(() => {
    setRNGSeed(12345);
  });

  it("should update resource amounts with growth and harvest", () => {
    const resources: ResourceState[] = [{
      def: { id: "test", name: "Test", capacityK: 100, regenRate: 0.1, collapseThreshold: 20, valuePerUnit: 1.0 },
      amount: 50,
      collapsed: false,
    }];

    const harvests = { test: 5 };
    const planet: PlanetEnv = {
      gravity: 1.0,
      volatility: 0.1,
      richness: 0.5,
      temperature: 0,
      metabolicCost: 0.3,
      productivity: 0.45,
    };

    const result = updateResources(resources, harvests, planet);

    expect(result[0].amount).toBeGreaterThan(0);
    expect(result[0].amount).toBeLessThanOrEqual(resources[0].def.capacityK);
  });

  it("should handle collapsed resources", () => {
    const resources: ResourceState[] = [{
      def: { id: "test", name: "Test", capacityK: 100, regenRate: 0.1, collapseThreshold: 20, valuePerUnit: 1.0 },
      amount: 10,
      collapsed: true,
    }];

    const harvests = { test: 2 };
    const planet: PlanetEnv = {
      gravity: 1.0,
      volatility: 0.1,
      richness: 0.5,
      temperature: 0,
      metabolicCost: 0.3,
      productivity: 0.45,
    };

    const result = updateResources(resources, harvests, planet);

    expect(result[0].collapsed).toBe(true);
    expect(result[0].amount).toBeLessThanOrEqual(resources[0].amount);
  });
});

describe("updateSpeciesPopulation", () => {
  it("should update population based on resources and stress", () => {
    const species: SpeciesState = {
      traits: {
        id: "test",
        name: "Test",
        lifespan: 50,
        reproductionRate: 0.5,
        discountFactor: 0.7,
        perceptionNoise: 0.1,
        mobility: "local",
        manipulation: "medium",
        normStrength: 0.5,
        stabilityPreference: 0.6,
        expansionPreference: 0.4,
      },
      population: 1000000,
      techLevel: 0.5,
      governance: { punishmentStrength: 0.3, monitoringInvestment: 0.2 },
      policyBrainId: "small",
      lexBudget: 100,
      lexRegenRate: 5,
    alive: true,
      relations: {},
    };

    const planet: PlanetEnv = {
      gravity: 1.0,
      volatility: 0.1,
      richness: 0.5,
      temperature: 0,
      metabolicCost: 0.3,
      productivity: 0.45,
    };

    const result = updateSpeciesPopulation(species, 5.0, 0.2, planet);

    expect(result.population).toBeGreaterThan(0);
    expect(result.alive).toBe(true);
  });

  it("should mark species as extinct if population too low", () => {
    const species: SpeciesState = {
      traits: {
        id: "test",
        name: "Test",
        lifespan: 50,
        reproductionRate: 0.1,
        discountFactor: 0.7,
        perceptionNoise: 0.1,
        mobility: "local",
        manipulation: "medium",
        normStrength: 0.5,
        stabilityPreference: 0.6,
        expansionPreference: 0.4,
      },
      population: 500,
      techLevel: 0.5,
      governance: { punishmentStrength: 0.3, monitoringInvestment: 0.2 },
      policyBrainId: "small",
      lexBudget: 100,
      lexRegenRate: 5,
    alive: true,
      relations: {},
    };

    const planet: PlanetEnv = {
      gravity: 1.0,
      volatility: 0.1,
      richness: 0.5,
      temperature: 0,
      metabolicCost: 0.3,
      productivity: 0.45,
    };

    const result = updateSpeciesPopulation(species, 0.1, 0.9, planet);

    expect(result.alive).toBe(false);
    expect(result.population).toBe(0);
  });
});

describe("computeStress", () => {
  it("should compute stress based on planet and resources", () => {
    const species: SpeciesState = {
      traits: {
        id: "test",
        name: "Test",
        lifespan: 50,
        reproductionRate: 0.5,
        discountFactor: 0.7,
        perceptionNoise: 0.1,
        mobility: "local",
        manipulation: "medium",
        normStrength: 0.5,
        stabilityPreference: 0.6,
        expansionPreference: 0.4,
      },
      population: 1000000,
      techLevel: 0.5,
      governance: { punishmentStrength: 0.3, monitoringInvestment: 0.2 },
      policyBrainId: "small",
      lexBudget: 100,
      lexRegenRate: 5,
    alive: true,
      relations: {},
    };

    const resources: ResourceState[] = [{
      def: { id: "test", name: "Test", capacityK: 100, regenRate: 0.1, collapseThreshold: 20, valuePerUnit: 1.0 },
      amount: 30,
      collapsed: false,
    }];

    const planet: PlanetEnv = {
      gravity: 1.5,
      volatility: 0.8,
      richness: 0.3,
      temperature: -0.5,
      metabolicCost: 0.6,
      productivity: 0.15,
    };

    const stress = computeStress(species, resources, planet);

    expect(stress).toBeGreaterThanOrEqual(0);
    expect(stress).toBeLessThanOrEqual(1);
  });
});

