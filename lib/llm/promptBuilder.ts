/**
 * Build natural language prompts for LLM species decision-making
 */

import { SpeciesState, WorldState, SpeciesObservation, IntentType } from "../sim/types";
import { getLinguisticConstraintPrompt } from "../sim/language";
import { getEpistemicPrompt } from "../sim/orders";
import { LEX_CONSTANTS } from "../config";

/**
 * Generate a natural language description of species traits
 */
function describeSpeciesTraits(species: SpeciesState): string {
  const traits = species.traits;
  
  const lifespanDesc =
    traits.lifespan < 30
      ? "short-lived"
      : traits.lifespan < 100
      ? "moderate lifespan"
      : "long-lived";
  
  const reproductionDesc =
    traits.reproductionRate < 0.3
      ? "slow reproduction"
      : traits.reproductionRate < 0.6
      ? "moderate reproduction"
      : "rapid reproduction";
  
  const patienceDesc =
    traits.discountFactor < 0.4
      ? "short-term focused"
      : traits.discountFactor < 0.7
      ? "moderate patience"
      : "highly patient and long-term thinking";
  
  const perceptionDesc =
    traits.perceptionNoise < 0.1
      ? "accurate perception"
      : traits.perceptionNoise < 0.2
      ? "moderate perception noise"
      : "noisy perception";
  
  const cultureDesc = [];
  if (traits.normStrength > 0.7) {
    cultureDesc.push("strong cultural norms");
  }
  if (traits.stabilityPreference > 0.7) {
    cultureDesc.push("strong preference for long-term stability");
  } else if (traits.stabilityPreference < 0.3) {
    cultureDesc.push("preference for growth over stability");
  }
  if (traits.expansionPreference > 0.7) {
    cultureDesc.push("expansionist tendencies");
  }
  
  return `- Lifespan: ${lifespanDesc} (average ${Math.round(traits.lifespan)} epochs per individual)
- Reproduction: ${reproductionDesc} (rate ${traits.reproductionRate.toFixed(2)})
- Time perspective: ${patienceDesc} (discount factor ${traits.discountFactor.toFixed(2)})
- Senses: ${perceptionDesc} (noise level ${traits.perceptionNoise.toFixed(2)})
- Mobility: ${traits.mobility}
- Technology: ${traits.manipulation} manipulation ability
- Culture: ${cultureDesc.length > 0 ? cultureDesc.join(", ") : "moderate cultural values"}
- Norm strength: ${traits.normStrength > 0.6 ? "strong" : traits.normStrength > 0.3 ? "moderate" : "weak"} (${traits.normStrength.toFixed(2)})`;
}

/**
 * Build prompt for a species decision
 */
export function buildSpeciesPrompt(
  species: SpeciesState,
  world: WorldState,
  observation: SpeciesObservation,
  mechanics = {useLinguisticRegimes:true, useEpistemicOrders:true}
): string {
  // Inject new mechanics sections
  const linguisticSection = mechanics.useLinguisticRegimes ? getLinguisticConstraintPrompt(species.traits.linguisticRegime) : "";
  const epistemicSection = mechanics.useEpistemicOrders ? getEpistemicPrompt(species.traits.epistemicOrder, world.timeStep, observation.informationState) : "";

  const prompt = `You are the collective strategic mind of Species "${species.traits.name}" in an alien world.

BIOLOGY & VALUES
${describeSpeciesTraits(species)}

LEXICON & COMMUNICATION
- Current Lex Budget: ${species.lexBudget.toFixed(1)} units
- Lex Regeneration: ${species.lexRegenRate.toFixed(1)} units/epoch
- Speech Act Costs:
  * DESCRIBE: ${LEX_CONSTANTS.COSTS.DESCRIBE} Lex
  * PROMISE: ${LEX_CONSTANTS.COSTS.PROMISE} Lex
  * COMMIT / PROPOSE: ${LEX_CONSTANTS.COSTS.COMMIT} Lex
  * REPORT: ${LEX_CONSTANTS.COSTS.REPORT} Lex
If you exceed your budget, your speech acts will be rejected.

${linguisticSection ? linguisticSection + "\n" : ""}${epistemicSection ? epistemicSection + "\n" : ""}
WORLD STATE (noisy observations)
- Epoch: ${world.timeStep} of an unknown horizon
- Your population: ~${Math.round(observation.ownPopulation / 1000000)} million (${observation.ownPopulation > species.population * 1.1 ? "booming" : observation.ownPopulation < species.population * 0.9 ? "declining" : "stable"})
- Your tech level: ${observation.ownTechLevel.toFixed(2)} (0-1 scale)

RESOURCES (estimated amounts with uncertainty)
${observation.resourceEstimates
  .map((est) => {
    const resource = world.resources.find((r) => r.def.id === est.resourceId);
    if (!resource) return "";
    const capacity = resource.def.capacityK;
    const percent = (est.estimatedAmount / capacity) * 100;
    const threshold = (resource.def.collapseThreshold / capacity) * 100;
    const warning = est.estimatedAmount < resource.def.collapseThreshold ? " ⚠️ APPROACHING COLLAPSE" : "";
    return `- Resource "${resource.def.name}" [${resource.def.id}]: estimated ${est.estimatedAmount.toFixed(1)}/${capacity} (${percent.toFixed(1)}% capacity, ±${est.uncertainty.toFixed(1)} uncertainty)${warning}`;
  })
  .join("\n")}

OTHER SPECIES
${observation.otherSpecies
  .map((other) => {
    const otherSpecies = world.species.find((s) => s.traits.id === other.speciesId);
    if (!otherSpecies) return "";
    const relation = species.relations[other.speciesId] || "neutral";
    return `- Species "${otherSpecies.traits.name}" [${other.speciesId}]: estimated population ~${Math.round(other.estimatedPopulation / 1000000)} million, aggression proxy ${other.aggressionProxy.toFixed(2)}, current relation: ${relation}`;
  })
  .join("\n")}

ACTIVE TREATIES
${observation.activeTreaties.length > 0 
  ? observation.activeTreaties.map(t => `- Treaty [${t.id}] with ${t.signatories.filter(s => s !== species.traits.id).join(", ")}: "${t.text}"`).join("\n") 
  : "- No active treaties"}

LIVING SIMILES (Available for reference in AnchoredReference regime)
${observation.availableSimiles && observation.availableSimiles.length > 0
  ? observation.availableSimiles.map(s => `- "${s.referent}" (from Epoch ${s.epoch}: ${s.action})`).join("\n")
  : "- No living similes available yet. Perform actions to create referents for future abstractions."}

RECENT HISTORY (last ${observation.recentEvents.length} events)
${observation.recentEvents.length > 0
  ? observation.recentEvents
      .slice(-10)
      .map((e) => `- Epoch ${e.timeStep}: ${e.message}`)
      .join("\n")
  : "- No recent significant events"}

YOUR DECISION
Decide your actions for this epoch. Consider:
1. Your species' values and survival.
2. Resource sustainability.
3. Diplomatic relations and treaty adherence.
4. Internal governance.

${mechanics.useLinguisticRegimes && species.traits.linguisticRegime === "LiteralOnly" ? "REMINDER: You cannot make abstract promises. Stick to facts. Any claims about current state will be mechanically verified against observable reality." : ""}
${mechanics.useLinguisticRegimes && species.traits.linguisticRegime === "AnchoredReference" ? "REMINDER: You must reference specific past events (Epoch X) or living similes to make any commitment. Referenced epochs will be verified to exist and match your claims." : ""}

Return a STRICT JSON object with the following schema:
{
  "harvest": {
    "resource_id_1": <number 0-100>,
    "resource_id_2": <number 0-100>,
    ...
  },
  "relations": {
    "other_species_id_1": "ally" | "neutral" | "sanction" | "war",
    "other_species_id_2": "ally" | "neutral" | "sanction" | "war",
    ...
  },
  "governance": {
    "punishment_strength": <number 0-1>,
    "monitoring_investment": <number 0-1>
  },
  "communication": [
    {
      "targetSpeciesId": "<species_id>",
      "intent": "DESCRIBE" | "PROMISE" | "COMMIT" | "PROPOSE" | "REPORT",
      "message": "<your message here>"
    }
  ],
  "treatyProposal": {
    "targetSpeciesId": "<species_id>",
    "text": "<your treaty clause text here>"
  }
}

IMPORTANT: 
- Harvest requests are absolute resource units in [0,100]; scarcity may reduce the realized allocation
- "treatyProposal" is optional. If proposing, ensure 'text' follows your Linguistic Constraints strictly.
- Return ONLY valid JSON, no additional text or markdown formatting`;

  return prompt;
}
