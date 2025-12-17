/**
 * World generation: create planets and species from presets
 */

import { PlanetEnv, SpeciesTraits, SpeciesState, LinguisticRegime, EpistemicOrder } from "./types";
import { getRNG } from "./random";

/**
 * Generate planet environment from preset ID
 */
export function generatePlanetEnv(presetId: string): PlanetEnv {
  const rng = getRNG();
  
  switch (presetId) {
    case "harsh_twilight":
      return {
        gravity: 1.8,
        volatility: 0.7,
        richness: 0.3,
        temperature: -0.5,
        metabolicCost: 0,
        productivity: 0,
      };
    
    case "lush_gaia":
      return {
        gravity: 0.8,
        volatility: 0.2,
        richness: 0.9,
        temperature: 0.6,
        metabolicCost: 0,
        productivity: 0,
      };
    
    case "volatile_storm":
      return {
        gravity: 1.2,
        volatility: 0.9,
        richness: 0.5,
        temperature: 0.3,
        metabolicCost: 0,
        productivity: 0,
      };
    
    default:
      // Random planet
      return {
        gravity: rng.randomFloat(0.5, 2.0),
        volatility: rng.randomFloat(0.1, 1.0),
        richness: rng.randomFloat(0.2, 1.0),
        temperature: rng.randomFloat(-1, 1),
        metabolicCost: 0,
        productivity: 0,
      };
  }
}

/**
 * Derive metabolic cost from gravity and temperature
 */
export function computeMetabolicCost(gravity: number, temperature: number): number {
  // Higher gravity and extreme temperatures increase metabolic cost
  const gravityFactor = gravity * 0.3;
  const tempFactor = Math.abs(temperature) * 0.2;
  return Math.min(1.0, gravityFactor + tempFactor);
}

/**
 * Derive productivity from richness and volatility
 */
export function computeProductivity(richness: number, volatility: number): number {
  // High richness increases productivity, but high volatility reduces it
  return richness * (1 - volatility * 0.5);
}

/**
 * Complete planet environment with derived values
 */
export function finalizePlanetEnv(env: PlanetEnv): PlanetEnv {
  return {
    ...env,
    metabolicCost: computeMetabolicCost(env.gravity, env.temperature),
    productivity: computeProductivity(env.richness, env.volatility),
  };
}

/**
 * Generate species name (simple numeric ID for scientific rigor)
 */
function generateSpeciesName(id: string): string {
  // Use ID directly: "species_0" -> "Species 0"
  const match = id.match(/species_(\d+)/);
  if (match) {
    return `Species ${match[1]}`;
  }
  return id;
}

/**
 * Generate species traits conditioned on planet environment
 */
export function generateSpeciesTraits(
  planet: PlanetEnv,
  id: string,
  rng: ReturnType<typeof getRNG>,
  config?: { useLinguisticRegimes?: boolean; useEpistemicOrders?: boolean }
): SpeciesTraits {
  // High metabolic cost → lower reproduction, higher discount factor (more patient)
  const metabolicInfluence = planet.metabolicCost;
  
  // High volatility → higher perception noise, more expansion preference
  const volatilityInfluence = planet.volatility;
  
  // High productivity → higher reproduction, more stability preference
  const productivityInfluence = planet.productivity;
  
  // Sample traits with planet-conditioned priors
  const lifespan = rng.randomFloat(
    10 + (1 - metabolicInfluence) * 50,
    100 + (1 - metabolicInfluence) * 400
  );
  
  const reproductionRate = rng.randomFloat(
    0.1 + productivityInfluence * 0.3,
    0.5 + productivityInfluence * 0.5
  ) * (1 - metabolicInfluence * 0.5);
  
  const discountFactor = rng.randomFloat(
    0.3 + metabolicInfluence * 0.4,
    0.9 + metabolicInfluence * 0.1
  );
  
  const perceptionNoise = rng.randomFloat(
    0.05 + volatilityInfluence * 0.1,
    0.2 + volatilityInfluence * 0.3
  );
  
  const mobility = rng.random() < 0.5 ? "local" : "global";
  
  const manipulationLevels: Array<"low" | "medium" | "high"> = ["low", "medium", "high"];
  const manipulation = rng.choice(manipulationLevels);
  
  const normStrength = rng.randomFloat(0.2, 0.9);
  
  const stabilityPreference = rng.randomFloat(
    0.3 + productivityInfluence * 0.3,
    0.8 + productivityInfluence * 0.2
  );
  
  const expansionPreference = rng.randomFloat(
    0.2 + volatilityInfluence * 0.3,
    0.7 + volatilityInfluence * 0.3
  );

  let linguisticRegime: LinguisticRegime | undefined;
  if (config?.useLinguisticRegimes) {
    linguisticRegime = rng.choice(["LiteralOnly", "AnchoredReference", "Expressive"]);
  }

  let epistemicOrder: EpistemicOrder | undefined;
  if (config?.useEpistemicOrders) {
    epistemicOrder = rng.choice(["FastOrder", "CloisteredOrder"]);
  }
  
  return {
    id,
    name: generateSpeciesName(id),
    lifespan,
    reproductionRate,
    discountFactor,
    perceptionNoise,
    mobility,
    manipulation,
    normStrength,
    stabilityPreference,
    expansionPreference,
    linguisticRegime,
    epistemicOrder,
  };
}

/**
 * Generate species states for a planet
 */
export function generateSpeciesForPlanet(
  planet: PlanetEnv,
  count: number,
  defaultPolicyBrainId: string = "small",
  config?: { useLinguisticRegimes?: boolean; useEpistemicOrders?: boolean }
): SpeciesState[] {
  const rng = getRNG();
  const finalizedPlanet = finalizePlanetEnv(planet);
  
  const species: SpeciesState[] = [];
  
  for (let i = 0; i < count; i++) {
    const traits = generateSpeciesTraits(finalizedPlanet, `species_${i}`, rng, config);
    
    // Initial population based on planet productivity
    const basePopulation = 1000000 * (0.5 + finalizedPlanet.productivity * 0.5);
    const population = rng.randomFloat(basePopulation * 0.5, basePopulation * 1.5);
    
    species.push({
      traits,
      population,
      techLevel: rng.randomFloat(0.2, 0.6),
      governance: {
        punishmentStrength: rng.randomFloat(0.1, 0.5),
        monitoringInvestment: rng.randomFloat(0.1, 0.4),
      },
      policyBrainId: defaultPolicyBrainId,
      alive: true,
      relations: {},
      lastDecisionStep: -1, // Initialize as never having decided
    });
  }
  
  // Initialize relations (all neutral initially)
  for (const s1 of species) {
    for (const s2 of species) {
      if (s1.traits.id !== s2.traits.id) {
        s1.relations[s2.traits.id] = "neutral";
      }
    }
  }
  
  return species;
}
