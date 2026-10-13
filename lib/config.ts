/**
 * Configuration constants for the simulation
 */

/**
 * Lex Budget constants
 */
export const LEX_CONSTANTS = {
  INITIAL_BUDGET: 100,
  REGEN_RATE: 5,
  COSTS: {
    DESCRIBE: 10,
    PROMISE: 20,
    COMMIT: 30,
    PROPOSE: 30,
    REPORT: 10,
  },
} as const;

/**
 * Default simulation configuration values
 */
export const DEFAULT_SIM_CONFIG = {
  maxTimeSteps: 100,
  harvestNoise: 0.05,
  historyLength: 5,
  // Lex defaults
  lexRegenRate: LEX_CONSTANTS.REGEN_RATE,
  lexCosts: LEX_CONSTANTS.COSTS,
  // Ablation switches
  useLinguisticRegimes: false,  // If false, all agents can express freely
  useEpistemicOrders: false,     // If false, all agents act every step with full information
  useTreaties: true,              // If false, agents cannot form agreements
  useBaselineAgents: true,       // If true, use fixed-policy heuristics instead of LLMs
} as const;

/**
 * Resource-related constants
 */
export const RESOURCE_CONSTANTS = {
  MIN_CAPACITY: 10,
  MAX_CAPACITY: 1000,
  MIN_REGEN_RATE: 0.01,
  MAX_REGEN_RATE: 0.5,
  DEFAULT_COLLAPSE_THRESHOLD_RATIO: 0.2, // 20% of capacity
} as const;

/**
 * Species-related constants
 */
export const SPECIES_CONSTANTS = {
  MIN_POPULATION: 1000,
  MAX_POPULATION: 100000000, // 100 million
  EXTINCTION_THRESHOLD: 1000,
  MIN_LIFESPAN: 10,
  MAX_LIFESPAN: 500,
  MIN_REPRODUCTION_RATE: 0.1,
  MAX_REPRODUCTION_RATE: 1.0,
  MIN_DISCOUNT_FACTOR: 0.1,
  MAX_DISCOUNT_FACTOR: 0.99,
  MIN_PERCEPTION_NOISE: 0.01,
  MAX_PERCEPTION_NOISE: 0.5,
  TECH_LEVEL_INCREMENT: 0.001,
  MAX_TECH_LEVEL: 1.0,
} as const;

/**
 * Harvest-related constants
 */
export const HARVEST_CONSTANTS = {
  MIN_HARVEST: 0,
  MAX_HARVEST: 100,
  SUSTAINABLE_YIELD_RATIO: 0.1, // 10% of MSY per epoch
  MSY_RATIO: 0.5, // Maximum Sustainable Yield is 50% of capacity
  DEFECTION_THRESHOLD_MULTIPLIER: 1.5, // 1.5x sustainable harvest = defection
} as const;

/**
 * Governance constants
 */
export const GOVERNANCE_CONSTANTS = {
  MIN_PUNISHMENT_STRENGTH: 0,
  MAX_PUNISHMENT_STRENGTH: 1,
  MIN_MONITORING_INVESTMENT: 0,
  MAX_MONITORING_INVESTMENT: 1,
  EFFECTIVENESS_THRESHOLD: 0.3,
  HARVEST_REDUCTION_FACTOR: 0.5,
  HARVEST_THRESHOLD_FOR_GOVERNANCE: 50,
} as const;

/**
 * Planet environment constants
 */
export const PLANET_CONSTANTS = {
  MIN_GRAVITY: 0.5,
  MAX_GRAVITY: 2.0,
  MIN_VOLATILITY: 0.1,
  MAX_VOLATILITY: 1.0,
  MIN_RICHNESS: 0.2,
  MAX_RICHNESS: 1.0,
  MIN_TEMPERATURE: -1,
  MAX_TEMPERATURE: 1,
  METABOLIC_COST_GRAVITY_FACTOR: 0.3,
  METABOLIC_COST_TEMP_FACTOR: 0.2,
  PRODUCTIVITY_VOLATILITY_PENALTY: 0.5,
} as const;

/**
 * Treaty constants
 */
export const TREATY_CONSTANTS = {
  DEFAULT_DURATION: 20, // epochs
  MIN_DURATION: 5,
  MAX_DURATION: 100,
  VIOLATION_BUFFER: 1.1, // 10% buffer before violation
  MAX_TEXT_LENGTH: 500,
} as const;

/**
 * LLM API constants
 */
export const LLM_CONSTANTS = {
  MAX_PROMPT_LENGTH: 50000,
  MIN_TEMPERATURE: 0,
  MAX_TEMPERATURE: 2,
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_MAX_TOKENS: 1000,
} as const;

/**
 * API rate limiting constants
 */
export const RATE_LIMIT_CONSTANTS = {
  MAX_REQUESTS_PER_MINUTE: 60,
  MAX_SIMULATION_STEPS: 1000,
  MAX_BATCH_SIZE: 10,
} as const;

/**
 * UI constants
 */
export const UI_CONSTANTS = {
  MAX_EVENTS_DISPLAYED: 50,
  ANIMATION_DURATION_MS: 300,
  DEBOUNCE_DELAY_MS: 300,
} as const;

