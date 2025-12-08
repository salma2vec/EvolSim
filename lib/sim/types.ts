/**
 * Core type definitions for the Alien Cooperation Lab simulator
 */

/**
 * Linguistic Regimes (Embassytown-inspired)
 */
export type LinguisticRegime = "LiteralOnly" | "SimileBound" | "MetaphorRich" | "Mathematical";

/**
 * Epistemic Orders (Anathem-inspired)
 */
export type EpistemicOrder = "FastSecular" | "SlowCloistered" | "OrderOfTheSky" | "OrderOfTheDeep";

/**
 * Treaty definition
 */
export interface Treaty {
  id: string;
  signatories: string[]; // species IDs
  epochSigned: number;
  text: string;
  interpretedConstraints: {
    maxHarvestByResource?: Record<string, number>;
    minCooperationIndex?: number;
  };
  expiresAt?: number;
  violated: boolean;
}

/**
 * Planet environment parameters
 */
export interface PlanetEnv {
  gravity: number; // 0-2, affects metabolic cost
  volatility: number; // 0-1, variance of environmental shocks
  richness: number; // 0-1, baseline resource regeneration rate
  temperature: number; // -1 to 1, affects metabolic cost
  // Derived indices
  metabolicCost: number; // Computed from gravity and temperature
  productivity: number; // Computed from richness and volatility
}

/**
 * Resource definition (static properties)
 */
export interface ResourceDef {
  id: string;
  name: string;
  capacityK: number; // Carrying capacity
  regenRate: number; // Regeneration rate (0-1)
  collapseThreshold: number; // Below this, resource collapses
  valuePerUnit: number; // Fitness value per unit harvested
}

/**
 * Resource state (dynamic properties)
 */
export interface ResourceState {
  def: ResourceDef;
  amount: number; // Current amount
  collapsed: boolean; // Whether resource has collapsed
}

/**
 * Species traits (genetic/cultural characteristics)
 */
export interface SpeciesTraits {
  id: string;
  name: string;
  lifespan: number; // Average lifespan in epochs
  reproductionRate: number; // Birth rate multiplier
  discountFactor: number; // 0-1, how much they value future (1 = very patient)
  perceptionNoise: number; // Standard deviation of observation noise
  mobility: "local" | "global"; // Movement range
  manipulation: "low" | "medium" | "high"; // Technology ceiling
  normStrength: number; // 0-1, cost of deviating from group norms
  stabilityPreference: number; // 0-1, preference for stability vs growth
  expansionPreference: number; // 0-1, preference for expansion vs conservation
  // New mechanics
  linguisticRegime?: LinguisticRegime;
  epistemicOrder?: EpistemicOrder;
}

/**
 * Species state (dynamic properties)
 */
export interface SpeciesState {
  traits: SpeciesTraits;
  population: number;
  techLevel: number; // 0-1, current technology level
  governance: {
    punishmentStrength: number; // 0-1, internal punishment for defectors
    monitoringInvestment: number; // 0-1, resources invested in monitoring
  };
  policyBrainId: string; // Which LLM model controls this species
  alive: boolean;
  // Diplomatic relations (updated each epoch)
  relations: Record<string, DiplomaticStance>;
  // Epistemic mechanics
  lastDecisionStep?: number;
}

/**
 * Diplomatic stance toward another species
 */
export type DiplomaticStance = "ally" | "neutral" | "sanction" | "war";

/**
 * Species decision (output from LLM)
 */
export interface SpeciesDecision {
  speciesId: string;
  harvest: Record<string, number>; // resourceId -> harvest amount (0-100)
  relations: Record<string, DiplomaticStance>; // other speciesId -> stance
  governance: {
    punishmentStrength: number; // 0-1
    monitoringInvestment: number; // 0-1
  };
  // Updated treaty proposal structure
  treatyProposal?: {
    text: string;
    targetSpeciesId: string;
  };
}

/**
 * Simulation event
 */
export interface SimEvent {
  timeStep: number;
  type: "TREATY" | "DEFECT" | "COLLAPSE" | "EXTINCTION" | "HARVEST" | "DIPLOMACY" | "CONCLAVE" | "LANGUAGE_SHIFT";
  message: string;
  data?: {
    speciesId?: string;
    resourceId?: string;
    otherSpeciesId?: string;
    harvestAmount?: number;
    treatyId?: string;
    [key: string]: any;
  };
}

/**
 * World state (complete snapshot at one time step)
 */
export interface WorldState {
  timeStep: number;
  planet: PlanetEnv;
  resources: ResourceState[];
  species: SpeciesState[];
  events: SimEvent[];
  activeTreaties: Treaty[];
}

/**
 * Simulation configuration
 */
export interface SimConfig {
  maxTimeSteps: number;
  harvestNoise?: number; // Variance in harvest execution
  rngSeed?: number; // Random seed for reproducibility
  historyLength?: number; // How many past epochs to include in observations
  useLinguisticRegimes?: boolean;
  useEpistemicOrders?: boolean;
}

/**
 * Observation for a species (what they see)
 */
export interface SpeciesObservation {
  speciesId: string;
  timeStep: number;
  // Noisy resource estimates
  resourceEstimates: Array<{
    resourceId: string;
    estimatedAmount: number;
    uncertainty: number; // ± range
  }>;
  // Own state
  ownPopulation: number;
  ownTechLevel: number;
  // Other species (noisy summaries)
  otherSpecies: Array<{
    speciesId: string;
    estimatedPopulation: number;
    aggressionProxy: number; // 0-1, inferred from behavior
  }>;
  // Recent history (last K epochs)
  recentEvents: SimEvent[];
  // Active treaties involving this species
  activeTreaties: Treaty[];
  // Epistemic state
  isConclave?: boolean;
}
