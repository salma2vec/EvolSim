/**
 * Simulation constants and magic numbers
 * 
 * These constants are used throughout the simulation for consistency.
 * Consider moving frequently used values here from config.ts if they
 * are more simulation-specific than configuration.
 */

/**
 * Default values for simulation parameters
 */
export const SIMULATION_DEFAULTS = {
  INITIAL_POPULATION_MULTIPLIER: 1000000,
  POPULATION_NORMALIZATION: 10000000,
  RESOURCE_NORMALIZATION: 10.0,
  GROWTH_FACTOR_A: 0.1,
  STRESS_FACTOR_B: 0.5,
  PRODUCTIVITY_MODIFIER_MIN: 0.8,
  PRODUCTIVITY_MODIFIER_RANGE: 0.4,
} as const;

/**
 * Event type constants
 */
export const EVENT_TYPES = {
  TREATY: "TREATY",
  DEFECT: "DEFECT",
  COLLAPSE: "COLLAPSE",
  EXTINCTION: "EXTINCTION",
  HARVEST: "HARVEST",
  DIPLOMACY: "DIPLOMACY",
  CONCLAVE: "CONCLAVE",
  LANGUAGE_SHIFT: "LANGUAGE_SHIFT",
} as const;

/**
 * Diplomatic stance constants
 */
export const DIPLOMATIC_STANCES = {
  ALLY: "ally",
  NEUTRAL: "neutral",
  SANCTION: "sanction",
  WAR: "war",
} as const;

