/**
 * World presets for different simulation scenarios
 */

import { WorldState, SimConfig, ResourceDef, ResourceState } from "./types";
import { generatePlanetEnv, finalizePlanetEnv, generateSpeciesForPlanet } from "./worldGen";
import { setRNGSeed } from "./random";
import { initializeSpatialLayout } from "./spatial";

/**
 * Create initial world state from preset
 */
export function createWorldFromPreset(
  presetId: string,
  speciesModelMap?: Record<string, string>,
  seed?: number,
  overrides?: { useLinguisticRegimes?: boolean; useEpistemicOrders?: boolean }
): { world: WorldState; config: SimConfig } {
  if (seed !== undefined) {
    setRNGSeed(seed);
  }
  
  let result: { world: WorldState; config: SimConfig };

  switch (presetId) {
    case "two_species_simple_lake":
      result = createTwoSpeciesSimpleLake(speciesModelMap);
      break;
    
    case "four_species_mixed":
      result = createFourSpeciesMixed(speciesModelMap);
      break;

    case "embassytown_scenario":
      result = createEmbassytownScenario(speciesModelMap);
      break;

    case "anathem_scenario":
      result = createAnathemScenario(speciesModelMap);
      break;
    
    case "harsh_twilight":
      result = createHarshTwilightScenario(speciesModelMap);
      break;
    
    case "lush_gaia":
      result = createLushGaiaScenario(speciesModelMap);
      break;
    
    case "volatile_storm":
      result = createVolatileStormScenario(speciesModelMap);
      break;
    
    default:
      result = createTwoSpeciesSimpleLake(speciesModelMap);
      break;
  }

  // Apply overrides
  if (overrides) {
    if (overrides.useLinguisticRegimes !== undefined) {
      result.config.useLinguisticRegimes = overrides.useLinguisticRegimes;
    }
    if (overrides.useEpistemicOrders !== undefined) {
      result.config.useEpistemicOrders = overrides.useEpistemicOrders;
    }
  }

  return result;
}

/**
 * Preset: Two species competing for a single resource (simple lake)
 */
function createTwoSpeciesSimpleLake(
  speciesModelMap?: Record<string, string>
): { world: WorldState; config: SimConfig } {
  const planet = finalizePlanetEnv(generatePlanetEnv("lush_gaia"));
  
  // Single resource: "Fish Oceans"
  const fishOceansDef: ResourceDef = {
    id: "fish_oceans",
    name: "Fish Oceans",
    capacityK: 100,
    regenRate: 0.15,
    collapseThreshold: 20,
    valuePerUnit: 1.0,
  };
  
  const resources: ResourceState[] = [
    {
      def: fishOceansDef,
      amount: 80, // Start at 80% capacity
      collapsed: false,
    },
  ];
  
  // Generate two species with contrasting traits
  const species = generateSpeciesForPlanet(planet, 2, "small");
  
  // Modify first species to be short-lived and greedy
  if (species.length > 0) {
    species[0].traits.lifespan = 20;
    species[0].traits.reproductionRate = 0.8;
    species[0].traits.discountFactor = 0.3; // Low patience
    species[0].traits.stabilityPreference = 0.2;
    species[0].traits.expansionPreference = 0.9;
  }
  
  // Modify second species to be long-lived and patient
  if (species.length > 1) {
    species[1].traits.lifespan = 200;
    species[1].traits.reproductionRate = 0.2;
    species[1].traits.discountFactor = 0.9; // High patience
    species[1].traits.stabilityPreference = 0.9;
    species[1].traits.expansionPreference = 0.2;
  }
  
  // Apply model assignments if provided
  if (speciesModelMap) {
    for (const s of species) {
      if (speciesModelMap[s.traits.id]) {
        s.policyBrainId = speciesModelMap[s.traits.id];
      }
    }
  }
  
  const config: SimConfig = {
    maxTimeSteps: 100,
    harvestNoise: 0.05,
    historyLength: 5,
  };
  
  const world: WorldState = {
    timeStep: 0,
    planet,
    resources,
    species,
    events: [],
    activeTreaties: [],
    metadata: {
      id: "two_species_simple_lake",
      name: "Two Species Simple Lake",
      scarce: "Renewable resource stock (fish units).",
      collapseMechanics: "Resource stock falls below regeneration threshold → regeneration halts → populations crash.",
      nonTrivialReason: "Each species maximizes short-term payoff by extracting more than its fair share, but joint over-extraction reduces future availability for both.",
      naiveStrategyFail: "Myopic greedy extraction proportional to current population size."
    }
  };
  
  // Initialize spatial layout
  initializeSpatialLayout(resources, species);
  
  return { world, config };
}

/**
 * Preset: Four species with multiple resources
 */
function createFourSpeciesMixed(
  speciesModelMap?: Record<string, string>
): { world: WorldState; config: SimConfig } {
  const planet = finalizePlanetEnv(generatePlanetEnv("volatile_storm"));
  
  // Multiple resources
  const resources: ResourceState[] = [
    {
      def: {
        id: "atmospheric_carbon",
        name: "Atmospheric Carbon Buffer",
        capacityK: 80,
        regenRate: 0.1,
        collapseThreshold: 30,
        valuePerUnit: 1.2,
      },
      amount: 60,
      collapsed: false,
    },
    {
      def: {
        id: "mineral_deposits",
        name: "Mineral Deposits",
        capacityK: 120,
        regenRate: 0.05,
        collapseThreshold: 40,
        valuePerUnit: 0.8,
      },
      amount: 100,
      collapsed: false,
    },
    {
      def: {
        id: "energy_flux",
        name: "Solar Energy Flux",
        capacityK: 150,
        regenRate: 0.2,
        collapseThreshold: 50,
        valuePerUnit: 0.6,
      },
      amount: 130,
      collapsed: false,
    },
  ];
  
  // Generate four species with varied traits
  const species = generateSpeciesForPlanet(planet, 4, "small");
  
  // Modify species to have distinct characteristics
  if (species.length > 0) {
    species[0].traits.expansionPreference = 0.95;
    species[0].traits.stabilityPreference = 0.1;
    species[0].traits.discountFactor = 0.2;
  }
  
  if (species.length > 1) {
    species[1].traits.expansionPreference = 0.1;
    species[1].traits.stabilityPreference = 0.95;
    species[1].traits.discountFactor = 0.9;
  }
  
  if (species.length > 2) {
    species[2].traits.normStrength = 0.9;
    species[2].traits.stabilityPreference = 0.7;
    species[2].traits.expansionPreference = 0.4;
  }
  
  if (species.length > 3) {
    species[3].traits.normStrength = 0.2;
    species[3].traits.discountFactor = 0.3;
    species[3].traits.expansionPreference = 0.7;
  }
  
  // Apply model assignments if provided
  if (speciesModelMap) {
    for (const s of species) {
      if (speciesModelMap[s.traits.id]) {
        s.policyBrainId = speciesModelMap[s.traits.id];
      }
    }
  }
  
  const config: SimConfig = {
    maxTimeSteps: 150,
    harvestNoise: 0.08,
    historyLength: 7,
  };
  
  const world: WorldState = {
    timeStep: 0,
    planet,
    resources,
    species,
    events: [],
    activeTreaties: [],
    metadata: {
      id: "four_species_mixed",
      name: "Four Species Mixed",
      scarce: "Balanced resource mix with varying regeneration rates.",
      collapseMechanics: "Cascading failure if any single resource hit zero, affecting population health and extraction pressure on others.",
      nonTrivialReason: "Complex interdependencies; species must balance multiple resource constraints simultaneously.",
      naiveStrategyFail: "Optimizing for single-resource payoff without considering multi-resource sustainability."
    }
  };
  
  // Initialize spatial layout
  initializeSpatialLayout(resources, species);
  
  return { world, config };
}

/**
 * Preset: Embassytown-inspired scenario (Linguistic Regimes)
 */
function createEmbassytownScenario(
  speciesModelMap?: Record<string, string>
): { world: WorldState; config: SimConfig } {
  const planet = finalizePlanetEnv(generatePlanetEnv("harsh_twilight"));
  
  const resources: ResourceState[] = [{
    def: { id: "exotic_matter", name: "Exotic Matter", capacityK: 120, regenRate: 0.1, collapseThreshold: 30, valuePerUnit: 1.5 },
    amount: 100, collapsed: false
  }];

  const species = generateSpeciesForPlanet(planet, 3, "small");

  // Order-2 (Emergent)
  if (species.length > 0) {
    species[0].traits.linguisticRegime = "LiteralOnly";
    species[0].traits.epistemicOrder = "Order-2";
  }

  // Order-1 (Administrative)
  if (species.length > 1) {
    species[1].traits.linguisticRegime = "Expressive";
    species[1].traits.epistemicOrder = "Order-1";
  }

  // Order-0 (Sæcular)
  if (species.length > 2) {
    species[2].traits.linguisticRegime = "AnchoredReference";
    species[2].traits.epistemicOrder = "Order-0";
  }

  if (speciesModelMap) {
    for (const s of species) {
      if (speciesModelMap[s.traits.id]) s.policyBrainId = speciesModelMap[s.traits.id];
    }
  }

  const world: WorldState = {
    timeStep: 0,
    planet,
    resources,
    species,
    events: [],
    activeTreaties: [],
    metadata: {
      id: "embassytown_scenario",
      name: "Embassytown Scenario",
      scarce: "Shared resource and credible commitments (communication bandwidth constrained by linguistic regime).",
      collapseMechanics: "Resource collapses due to delayed or unverifiable coordination; institutions fail to form in time.",
      nonTrivialReason: "Agents cannot freely express future commitments or abstractions; coordination requires grounding agreements in observable state, slowing norm formation.",
      naiveStrategyFail: "Relying on verbal promises or future-oriented agreements without enforceable anchors."
    }
  };
  
  // Initialize spatial layout
  initializeSpatialLayout(resources, species);
  
  return {
    world,
    config: { maxTimeSteps: 100, useLinguisticRegimes: true, useEpistemicOrders: false }
  };
}

/**
 * Preset: Anathem-inspired scenario (Epistemic Orders)
 */
function createAnathemScenario(
  speciesModelMap?: Record<string, string>
): { world: WorldState; config: SimConfig } {
  const planet = finalizePlanetEnv(generatePlanetEnv("lush_gaia"));
  
  const resources: ResourceState[] = [{
    def: { id: "knowledge_substrate", name: "Knowledge Substrate", capacityK: 200, regenRate: 0.05, collapseThreshold: 50, valuePerUnit: 1.0 },
    amount: 150, collapsed: false
  }];

  const species = generateSpeciesForPlanet(planet, 3, "small");

  // Order-2
  if (species.length > 0) {
    species[0].traits.epistemicOrder = "Order-2";
    species[0].traits.linguisticRegime = "LiteralOnly";
  }

  // Order-1
  if (species.length > 1) {
    species[1].traits.epistemicOrder = "Order-1";
    species[1].traits.linguisticRegime = "AnchoredReference";
  }

  // Order-0
  if (species.length > 2) {
    species[2].traits.epistemicOrder = "Order-0";
    species[2].traits.linguisticRegime = "AnchoredReference";
  }

  if (speciesModelMap) {
    for (const s of species) {
      if (speciesModelMap[s.traits.id]) s.policyBrainId = speciesModelMap[s.traits.id];
    }
  }

  const world: WorldState = {
    timeStep: 0,
    planet,
    resources,
    species,
    events: [],
    activeTreaties: [],
    metadata: {
      id: "anathem_scenario",
      name: "Anathem Scenario",
      scarce: "Shared knowledge substrate and temporal alignment.",
      collapseMechanics: "Knowledge loss if extraction occurs out of sync with epistemic windows; coordination failures due to clock misalignment.",
      nonTrivialReason: "Agents exist on different time scales (epistemic orders); coordination requires predicting others' availability.",
      naiveStrategyFail: "Synchronous cooperation strategies that assume all agents can respond every timestep."
    }
  };
  
  // Initialize spatial layout
  initializeSpatialLayout(resources, species);
  
  return {
    world,
    config: { maxTimeSteps: 200, useLinguisticRegimes: true, useEpistemicOrders: true }
  };
}

/**
 * Get list of available preset IDs
 */
export function getAvailablePresets(): string[] {
  return [
    "two_species_simple_lake", 
    "four_species_mixed",
    "embassytown_scenario",
    "anathem_scenario",
    "harsh_twilight",
    "lush_gaia",
    "volatile_storm",
  ];
}

/**
 * Create a harsh environment scenario
 */
function createHarshTwilightScenario(
  speciesModelMap?: Record<string, string>
): { world: WorldState; config: SimConfig } {
  const planet = finalizePlanetEnv(generatePlanetEnv("harsh_twilight"));
  const resources: ResourceState[] = [{
    def: { id: "scarce_water", name: "Scarce Water", capacityK: 50, regenRate: 0.05, collapseThreshold: 10, valuePerUnit: 2.0 },
    amount: 30, collapsed: false
  }];
  const species = generateSpeciesForPlanet(planet, 2, "small");
  if (speciesModelMap) {
    for (const s of species) {
      if (speciesModelMap[s.traits.id]) s.policyBrainId = speciesModelMap[s.traits.id];
    }
  }
  const world: WorldState = {
    timeStep: 0,
    planet,
    resources,
    species,
    events: [],
    activeTreaties: [],
    metadata: {
      id: "harsh_twilight",
      name: "Harsh Twilight",
      scarce: "Resource regeneration capacity (low regen rate, high volatility).",
      collapseMechanics: "Resource oscillates below threshold → regeneration becomes insufficient → populations decline irreversibly.",
      nonTrivialReason: "Even cooperative extraction rates must adapt dynamically; static “fair share” policies overshoot under volatility.",
      naiveStrategyFail: "Fixed extraction quotas or delayed response strategies based on long-term averages."
    }
  };
  
  // Initialize spatial layout
  initializeSpatialLayout(resources, species);
  
  return {
    world,
    config: { maxTimeSteps: 80, harvestNoise: 0.1 }
  };
}

/**
 * Create a lush environment scenario
 */
function createLushGaiaScenario(
  speciesModelMap?: Record<string, string>
): { world: WorldState; config: SimConfig } {
  const planet = finalizePlanetEnv(generatePlanetEnv("lush_gaia"));
  const resources: ResourceState[] = [
    { def: { id: "abundant_food", name: "Abundant Food", capacityK: 200, regenRate: 0.3, collapseThreshold: 50, valuePerUnit: 0.8 }, amount: 180, collapsed: false },
    { def: { id: "clean_water", name: "Clean Water", capacityK: 150, regenRate: 0.25, collapseThreshold: 30, valuePerUnit: 1.0 }, amount: 140, collapsed: false }
  ];
  const species = generateSpeciesForPlanet(planet, 3, "small");
  if (speciesModelMap) {
    for (const s of species) {
      if (speciesModelMap[s.traits.id]) s.policyBrainId = speciesModelMap[s.traits.id];
    }
  }
  const world: WorldState = {
    timeStep: 0,
    planet,
    resources,
    species,
    events: [],
    activeTreaties: [],
    metadata: {
      id: "lush_gaia",
      name: "Lush Gaia",
      scarce: "Relatively abundant resources; scarcity is strategically induced by expansion.",
      collapseMechanics: "Over-extraction due to population boom; high regen rate masks early signs of depletion.",
      nonTrivialReason: "Cooperation requires resisting the urge to over-expand despite initial abundance.",
      naiveStrategyFail: "Unbounded exponential growth that eventually outpaces even high regeneration rates."
    }
  };
  
  // Initialize spatial layout
  initializeSpatialLayout(resources, species);
  
  return {
    world,
    config: { maxTimeSteps: 120, harvestNoise: 0.03 }
  };
}

/**
 * Create a volatile storm scenario
 */
function createVolatileStormScenario(
  speciesModelMap?: Record<string, string>
): { world: WorldState; config: SimConfig } {
  const planet = finalizePlanetEnv(generatePlanetEnv("volatile_storm"));
  const resources: ResourceState[] = [{
    def: { id: "unstable_energy", name: "Unstable Energy", capacityK: 100, regenRate: 0.15, collapseThreshold: 20, valuePerUnit: 1.5 },
    amount: 70, collapsed: false
  }];
  const species = generateSpeciesForPlanet(planet, 2, "small");
  if (speciesModelMap) {
    for (const s of species) {
      if (speciesModelMap[s.traits.id]) s.policyBrainId = speciesModelMap[s.traits.id];
    }
  }
  const world: WorldState = {
    timeStep: 0,
    planet,
    resources,
    species,
    events: [],
    activeTreaties: [],
    metadata: {
      id: "volatile_storm",
      name: "Volatile Storm",
      scarce: "Stable resource regeneration capacity.",
      collapseMechanics: "Resource crashes when environmental shocks coincide with peak extraction; high variance makes prediction difficult.",
      nonTrivialReason: "Cooperation requires maintaining high buffers; 'efficient' extraction is fatal under volatility.",
      naiveStrategyFail: "Harvesting at mean regeneration rate without accounting for environmental variance."
    }
  };
  
  // Initialize spatial layout
  initializeSpatialLayout(resources, species);
  
  return {
    world,
    config: { maxTimeSteps: 100, harvestNoise: 0.12 }
  };
}
