/**
 * Unit tests for metrics module
 */

import { computeCollapseStats, computeSpeciesOutcomes, computeResourceHealth } from "@/lib/sim/metrics";
import { WorldState, ResourceState, SpeciesState, PlanetEnv } from "@/lib/sim/types";

function createMockWorld(timeStep: number): WorldState {
  const planet: PlanetEnv = {
    gravity: 1.0,
    volatility: 0.1,
    richness: 0.5,
    temperature: 0,
    metabolicCost: 0.3,
    productivity: 0.45,
  };

  const resources: ResourceState[] = [{
    def: { id: "test", name: "Test", capacityK: 100, regenRate: 0.1, collapseThreshold: 20, valuePerUnit: 1.0 },
    amount: 50,
    collapsed: false,
  }];

  const species: SpeciesState[] = [{
    traits: {
      id: "species1",
      name: "Species 1",
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
    alive: true,
    relations: {},
  }];

  return {
    timeStep,
    planet,
    resources,
    species,
    events: [],
    activeTreaties: [],
  };
}

describe("computeCollapseStats", () => {
  it("should detect resource collapses", () => {
    const history: WorldState[] = [
      createMockWorld(0),
      {
        ...createMockWorld(1),
        resources: [{
          def: { id: "test", name: "Test", capacityK: 100, regenRate: 0.1, collapseThreshold: 20, valuePerUnit: 1.0 },
          amount: 15,
          collapsed: true,
        }],
      },
    ];

    const stats = computeCollapseStats(history);

    expect(stats.collapseCount).toBe(1);
    expect(stats.firstCollapseStep).toBe(1);
    expect(stats.collapsedResources).toContain("test");
  });

  it("should return zero collapses when none occur", () => {
    const history: WorldState[] = [
      createMockWorld(0),
      createMockWorld(1),
    ];

    const stats = computeCollapseStats(history);

    expect(stats.collapseCount).toBe(0);
    expect(stats.firstCollapseStep).toBeUndefined();
  });
});

describe("computeSpeciesOutcomes", () => {
  it("should compute final populations and survival", () => {
    const history: WorldState[] = [
      createMockWorld(0),
      {
        ...createMockWorld(1),
        species: [{
          ...createMockWorld(1).species[0],
          population: 2000000,
        }],
      },
    ];

    const outcomes = computeSpeciesOutcomes(history);

    expect(outcomes.finalPopulations.species1).toBe(2000000);
    expect(outcomes.survivalRates.species1).toBe(true);
    expect(outcomes.peakPopulations.species1).toBe(2000000);
  });

  it("should handle extinct species", () => {
    const history: WorldState[] = [
      createMockWorld(0),
      {
        ...createMockWorld(1),
        species: [{
          ...createMockWorld(1).species[0],
          population: 0,
          alive: false,
        }],
      },
    ];

    const outcomes = computeSpeciesOutcomes(history);

    expect(outcomes.finalPopulations.species1).toBe(0);
    expect(outcomes.survivalRates.species1).toBe(false);
  });
});

describe("computeResourceHealth", () => {
  it("should compute resource health over time", () => {
    const history: WorldState[] = [
      createMockWorld(0),
      {
        ...createMockWorld(1),
        resources: [{
          def: { id: "test", name: "Test", capacityK: 100, regenRate: 0.1, collapseThreshold: 20, valuePerUnit: 1.0 },
          amount: 75,
          collapsed: false,
        }],
      },
    ];

    const health = computeResourceHealth(history);

    expect(health.test).toHaveLength(2);
    expect(health.test[0]).toBe(0.5); // 50/100
    expect(health.test[1]).toBe(0.75); // 75/100
  });

  it("should return zero health for collapsed resources", () => {
    const history: WorldState[] = [
      {
        ...createMockWorld(0),
        resources: [{
          def: { id: "test", name: "Test", capacityK: 100, regenRate: 0.1, collapseThreshold: 20, valuePerUnit: 1.0 },
          amount: 10,
          collapsed: true,
        }],
      },
    ];

    const health = computeResourceHealth(history);

    expect(health.test[0]).toBe(0);
  });
});

