/**
 * THE THIRD PILLAR: Core type definitions
 * 
 * Formal definition of the scientific object:
 * - State S_t = (R_t, P_t, T_t, I_t)
 * - Agents π_i: species-level policies controlled by LLMs
 * - Environment E: dynamics that derive social dilemmas
 * - Information I: constraints on observation and action
 * - Metrics M: falsifiable outcome measures
 */

/**
 * Linguistic Regimes (Embassytown-inspired)
 * 
 * Language as a restricted action space, not text flavor.
 * Each regime constrains what can be expressed in treaties.
 */
export type LinguisticRegime = 
  | "LiteralOnly"      // Only factual constraints based on current state
  | "AnchoredReference" // Only commitments referencing past events
  | "Expressive";        // Free expression, but with ambiguity penalties

/**
 * Voxel coordinates for the Orthogon lattice
 */
export interface VoxelCoord {
  x: number; // Resource partitioning
  y: number; // Resource partitioning
  z: number; // Epistemic depth / Observability class
}

/**
 * Epistemic Orders (Anathem-inspired)
 * 
 * Defines temporal and informational structure:
 * - Order-0: full observability, slow update (Decadal)
 * - Order-1: partial observability, faster update (Annual)
 * - Order-2: minimal observability, fastest update (Daily)
 */
export type EpistemicOrder = 
  | "Order-0" // The Sæcular/High Order: Full view, slow clock
  | "Order-1" // The Administrative Order: Partial view, mid clock
  | "Order-2"; // The Emergent Order: Limited view, fast clock

/**
 * Speech Intent Types (Embassytown-derived)
 * 
 * Mandatory tags for every speech act to determine Lex cost and validity.
 */
export type IntentType = "DESCRIBE" | "PROMISE" | "COMMIT" | "PROPOSE" | "REPORT";

/**
 * Lex Cost Weights
 */
export interface LexCosts {
  DESCRIBE: number;
  PROMISE: number;
  COMMIT: number;
  PROPOSE: number;
  REPORT: number;
}

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
  location?: VoxelCoord; // Voxel location for permission/observability
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
  requiresInterpreter?: boolean; // If true, messages pass through a noisy interpreter
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
  // Lex budget (regenerates slowly)
  lexBudget: number;
  lexRegenRate: number;
  // Diplomatic relations (updated each epoch)
  relations: Record<string, DiplomaticStance>;
  // Epistemic mechanics
  lastDecisionStep?: number;
  position?: VoxelCoord; // Voxel position for visibility rules
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
  // Lex-bound communication
  communication?: Array<{
    targetSpeciesId: string;
    intent: IntentType;
    message: string;
  }>;
  // Updated treaty proposal structure
  treatyProposal?: {
    text: string;
    targetSpeciesId: string;
    // Stated intent (for deception gap tracking)
    statedConstraints?: {
      maxHarvestByResource?: Record<string, number>;
      minCooperationIndex?: number;
    };
  };
}

/**
 * Simulation event
 */
export interface SimEventData {
  speciesId?: string;
  resourceId?: string;
  otherSpeciesId?: string;
  harvestAmount?: number;
  treatyId?: string;
  epoch?: number;
  amount?: number;
  stance?: DiplomaticStance;
}

export interface SimEvent {
  timeStep: number;
  type: "TREATY" | "DEFECT" | "COLLAPSE" | "EXTINCTION" | "HARVEST" | "DIPLOMACY" | "CONCLAVE" | "LANGUAGE_REJECTED" | "DECEPTION_GAP" | "RESOURCE_SCARCITY_CONFLICT" | "LEX_BURN";
  message: string;
  data?: SimEventData;
  // For DECEPTION_GAP events: track stated intent vs realized action
  statedIntent?: {
    treatyId?: string;
    proposedConstraint?: Record<string, number>;
  };
  realizedAction?: {
    actualHarvest?: Record<string, number>;
  };
}

/**
 * Scenario metadata for interpretive summary
 */
export interface ScenarioMetadata {
  id: string;
  name: string;
  scarce: string;
  collapseMechanics: string;
  nonTrivialReason: string;
  naiveStrategyFail: string;
}

/**
 * Living simile: an agent action that becomes a referent for future abstractions
 * 
 * In Embassytown, agents perform actions that can be referenced in Language.
 * Example: "the agent who harvested 50 units" becomes a simile for "moderate extraction".
 */
export interface LivingSimile {
  id: string; // Unique identifier: "simile-{speciesId}-{epoch}-{actionHash}"
  speciesId: string;
  resourceId?: string; // Explicit visibility provenance; legacy references may omit it
  epoch: number;
  action: string; // Human-readable description: "harvested 50 units of exotic_matter"
  referent: string; // How it's referenced in Language: "the agent who harvested 50 units"
  createdAt: number; // timeStep when created
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
  metadata?: ScenarioMetadata;
  // Living simile registry (Embassytown mechanic)
  livingSimiles?: LivingSimile[];
}

/**
 * Simulation configuration
 * 
 * Includes ablation switches for testing whether mechanisms matter.
 */
export interface SimConfig {
  maxTimeSteps: number;
  harvestNoise?: number; // Variance in harvest execution
  rngSeed?: number; // Random seed for reproducibility
  historyLength?: number; // How many past epochs to include in observations
  
  // Lex costs
  lexCosts?: LexCosts;
  lexRegenRate?: number;
  
  // Ablation switches
  useLinguisticRegimes?: boolean; // If false, all agents can express freely
  useEpistemicOrders?: boolean;  // If false, all agents act every step with full information
  useTreaties?: boolean;          // If false, agents cannot form agreements
  baselinePolicyMap?: Record<string, "cooperative" | "defector" | "conservative" | "opportunistic">;
  useBaselineAgents?: boolean;    // If true, use fixed-policy heuristics instead of LLMs
  useStructuredDecisions?: boolean; // Opt-in observation-grounded provider schema; semantic parsing stays strict
  includeNumericRules?: boolean; // Factual resource equations in the prompt; no incentive change
  useIndependentRandomStreams?: boolean; // Keyed exogenous draws; legacy sequence remains default
  llmTemperature?: number;
  llmSeed?: number; // Provider sampling seed; not a guarantee of deterministic inference
}

/**
 * Information access state I_t for a species
 * 
 * Determines observation bandwidth and memory based on epistemic order.
 */
export interface InformationState {
  observationBandwidth: "local" | "summarized_global" | "full_global";
  memoryLength: number; // How many past steps are retained
  memorySummary?: string; // Summarized history for long-interval orders
  contactWindow: boolean; // Whether treaties can be proposed/accepted now
}

/**
 * Observation for a species (what they see)
 * 
 * Filtered by InformationState based on epistemic order.
 */
export interface SpeciesObservation {
  speciesId: string;
  timeStep: number;
  // Noisy resource estimates (filtered by observation bandwidth)
  resourceEstimates: Array<{
    resourceId: string;
    estimatedAmount: number;
    uncertainty: number; // ± range
  }>;
  // Own state
  ownPopulation: number;
  ownTechLevel: number;
  // Other species (noisy summaries, filtered by observation bandwidth)
  otherSpecies: Array<{
    speciesId: string;
    estimatedPopulation: number;
    aggressionProxy: number; // 0-1, inferred from behavior
  }>;
  // History (filtered by memory length and summarization)
  recentEvents: SimEvent[];
  memorySummary?: string; // For long-interval orders
  // Active treaties involving this species
  activeTreaties: Treaty[];
  // Information state
  informationState: InformationState;
  // Living similes available for reference (Embassytown mechanic)
  availableSimiles?: LivingSimile[];
}
