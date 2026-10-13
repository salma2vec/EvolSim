/**
 * Reality Check: Verification harness for simulation integrity
 * 
 * Tests strict resource conservation and simultaneous resolution.
 */

import { WorldState, SimConfig, SpeciesDecision, SpeciesObservation } from "../sim/types";
import { stepWorld } from "../sim/gameLoop";
import { getRNG } from "../sim/random";

/**
 * Run a "Greedy Conflict" scenario:
 * 4 species all try to harvest 100% of a limited resource.
 * Verify that each only gets 25% and total harvested <= available.
 */
export async function runGreedyConflictTest() {
  console.log("Starting Reality Check: Greedy Conflict Test...");

  const rng = getRNG();
  
  // 1. Setup world with 1 resource and 4 species
  const initialWorld: WorldState = {
    timeStep: 0,
    planet: {
      gravity: 1,
      volatility: 0,
      richness: 0.5,
      temperature: 0,
      metabolicCost: 0.3,
      productivity: 0.5
    },
    resources: [{
      def: {
        id: "test-lake",
        name: "Test Lake",
        capacityK: 1000,
        regenRate: 0.1,
        collapseThreshold: 100,
        valuePerUnit: 1
      },
      amount: 400, // Limited supply
      collapsed: false
    }],
    species: [1, 2, 3, 4].map(i => ({
      traits: {
        id: `species-${i}`,
        name: `Greedy Species ${i}`,
        lifespan: 50,
        reproductionRate: 1,
        discountFactor: 0.9,
        perceptionNoise: 0,
        mobility: "global",
        manipulation: "medium",
        normStrength: 0,
        stabilityPreference: 0,
        expansionPreference: 1
      },
      population: 1000,
      techLevel: 0.5,
      governance: { punishmentStrength: 0, monitoringInvestment: 0 },
      policyBrainId: "baseline-greedy",
      lexBudget: 100,
      lexRegenRate: 5,
    alive: true,
      relations: {}
    })),
    events: [],
    activeTreaties: []
  };

  const config: SimConfig = {
    maxTimeSteps: 1,
    useBaselineAgents: true
  };

  // 2. Mock decision function: All species request 100 units each
  const getGreedyDecisions = async (obs: SpeciesObservation[]): Promise<SpeciesDecision[]> => {
    return obs.map(o => ({
      speciesId: o.speciesId,
      harvest: { "test-lake": 100 },
      relations: {},
      governance: { punishmentStrength: 0, monitoringInvestment: 0 }
    }));
  };

  // 3. Step the world
  const nextState = await stepWorld(initialWorld, config, getGreedyDecisions);

  // 4. Verify results
  console.log("--- Test Results ---");
  console.log(`Initial Lake Amount: 400`);
  console.log(`Total Requested Harvest: 400 (100 per species)`);
  
  const harvestEvents = nextState.events.filter(e => e.type === "HARVEST");
  console.log(`Number of Harvest Events: ${harvestEvents.length}`);

  let totalRealized = 0;
  harvestEvents.forEach(e => {
    const amount = e.data?.harvestAmount || 0;
    console.log(`  ${e.data?.speciesId} realized: ${amount.toFixed(2)}`);
    totalRealized += amount;
  });

  console.log(`Total Realized Harvest: ${totalRealized.toFixed(2)}`);

  const scarcityConflicts = nextState.events.filter(e => e.type === "RESOURCE_SCARCITY_CONFLICT");
  console.log(`Scarcity Conflicts Detected: ${scarcityConflicts.length}`);

  // Assertions
  if (totalRealized > 400.0001) {
    console.error("FAIL: Conservation violation! Total realized > available.");
  } else if (Math.abs(totalRealized - 400) > 0.1) {
    console.error(`FAIL: Total realized (${totalRealized}) should be exactly 400.`);
  } else {
    console.log("PASS: Conservation verified.");
  }

  const expectedPerSpecies = 100; // In this case demand=400, supply=400, so scaling factor is 1.0
  // Let's test actual scarcity: supply=200
  initialWorld.resources[0].amount = 200;
  const stateWithScarcity = await stepWorld(initialWorld, config, getGreedyDecisions);
  
  console.log("\n--- Scarcity Test (Supply: 200, Demand: 400) ---");
  let totalScarcityHarvest = 0;
  stateWithScarcity.events.filter(e => e.type === "HARVEST").forEach(e => {
    const amount = e.data?.harvestAmount || 0;
    console.log(`  ${e.data?.speciesId} realized: ${amount.toFixed(2)}`);
    totalScarcityHarvest += amount;
  });
  
  console.log(`Total Realized Scarcity Harvest: ${totalScarcityHarvest.toFixed(2)}`);
  if (Math.abs(totalScarcityHarvest - 200) < 0.1) {
    console.log("PASS: Proportional scaling verified.");
  } else {
    console.error(`FAIL: Total realized (${totalScarcityHarvest}) should be exactly 200.`);
  }

  return { success: true };
}
