/** Public resource-rule parameters only; never expose hidden state or stock. */
import type { SimConfig, SpeciesObservation, WorldState } from "../sim/types";
import { GOVERNANCE_CONSTANTS as G } from "../config";

export function buildNumericResourceRules(world: WorldState, observation: SpeciesObservation,
  config: Partial<SimConfig>): string {
  const visible = new Set(observation.resourceEstimates.map(r => r.resourceId));
  const parameters = world.resources.filter(r => visible.has(r.def.id)).map(({ def }) =>
    `- ${def.id}: capacity K=${def.capacityK}, regeneration r=${def.regenRate}, irreversible collapse threshold C=${def.collapseThreshold}.`);
  return `NUMERIC RESOURCE RULES (public parameters; R is the true unknown stock, not its noisy estimate)
${parameters.join("\n")}
Requests are absolute units in [0,100], not percentages. For each species let h be its request and e=punishment_strength*monitoring_investment. If e>${G.EFFECTIVENESS_THRESHOLD} and h>${G.HARVEST_THRESHOLD_FOR_GOVERNANCE}, effective request is h-(h-${G.HARVEST_THRESHOLD_FOR_GOVERNANCE})*e*${G.HARVEST_REDUCTION_FACTOR}; otherwise it is h.
After access rules, if total effective demand D exceeds current stock R, each request is multiplied by R/D. Otherwise each is realized in full. Total realized harvest is H.
For an uncollapsed resource, growth is r*R*(1-R/K). Physical harvest depletion is max(0,H*(1+${config.harvestNoise ?? 0.05}*Z_h)); the environmental shock is ${world.planet.volatility}*K*0.1*Z_s. Z_h and Z_s are standard normal draws. Next stock is min(1.1*K,max(0,R+growth-depletion+shock)). These stochastic depletion terms can differ from the realized allocations.
If next stock is strictly below C, collapse is irreversible. An already collapsed resource has no growth or noise and next stock max(0,R-H).
Treaty violation is recorded and removes the treaty; it does not mechanically cap harvest or impose a resource fine. This statement does not change any incentives, action limits or transition rules. These are resource dynamics, not a complete objective or population-utility model.`;
}
