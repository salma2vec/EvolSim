/**
 * Unit tests for validation utilities
 */

import { validateSimConfig, validateSpeciesDecision, validateWorldState } from "@/lib/utils/validation";
import { SimConfig, SpeciesDecision, WorldState, ResourceState, SpeciesState, PlanetEnv } from "@/lib/sim/types";

describe("validateSimConfig", () => {
  it("should validate valid config", () => {
    const config: Partial<SimConfig> = {
      maxTimeSteps: 100,
      harvestNoise: 0.05,
      historyLength: 5,
    };

    const result = validateSimConfig(config);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject invalid maxTimeSteps", () => {
    const config: Partial<SimConfig> = {
      maxTimeSteps: -1,
    };

    const result = validateSimConfig(config);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should reject invalid harvestNoise", () => {
    const config: Partial<SimConfig> = {
      harvestNoise: 1.5,
    };

    const result = validateSimConfig(config);

    expect(result.valid).toBe(false);
  });
});

describe("validateSpeciesDecision", () => {
  it("should validate valid decision", () => {
    const decision: Partial<SpeciesDecision> = {
      speciesId: "test",
      harvest: { resource1: 50 },
      relations: { other1: "ally" },
      governance: {
        punishmentStrength: 0.5,
        monitoringInvestment: 0.3,
      },
    };

    const result = validateSpeciesDecision(decision, "test");

    expect(result.valid).toBe(true);
  });

  it("should reject invalid harvest amounts", () => {
    const decision: Partial<SpeciesDecision> = {
      speciesId: "test",
      harvest: { resource1: 150 },
    };

    const result = validateSpeciesDecision(decision, "test");

    expect(result.valid).toBe(false);
  });

  it("should reject invalid diplomatic stance", () => {
    const decision: Partial<SpeciesDecision> = {
      speciesId: "test",
      relations: { other1: "invalid" as any },
    };

    const result = validateSpeciesDecision(decision, "test");

    expect(result.valid).toBe(false);
  });
});

describe("validateWorldState", () => {
  it("should validate valid world state", () => {
    const planet: PlanetEnv = {
      gravity: 1.0,
      volatility: 0.1,
      richness: 0.5,
      temperature: 0,
      metabolicCost: 0.3,
      productivity: 0.45,
    };

    const world: Partial<WorldState> = {
      timeStep: 0,
      planet,
      resources: [{
        def: { id: "test", name: "Test", capacityK: 100, regenRate: 0.1, collapseThreshold: 20, valuePerUnit: 1.0 },
        amount: 50,
        collapsed: false,
      }],
      species: [],
      events: [],
      activeTreaties: [],
    };

    const result = validateWorldState(world);

    expect(result.valid).toBe(true);
  });
});

