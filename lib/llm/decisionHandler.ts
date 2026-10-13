/**
 * Decision handler for explicit baseline or live-provider runs
 * 
 * Provider failures abort the experiment; they never become baseline decisions.
 */

import { SpeciesObservation, SpeciesDecision, SimEvent } from "../sim/types";
import { WorldState } from "../sim/types";
import { buildSpeciesPrompt } from "./promptBuilder";
import { parseLLMResponse } from "./parseActions";
import { sanitizeDecision } from "../sim/guards";
import { logger } from "../utils/logger";
import { callLLM } from "./client";
import { shouldUseBaselineAgent, generateBaselineDecision, getBaselinePolicy } from "../sim/baselineAgents";
import type { BaselinePolicy } from "../sim/baselineAgents";
import { getRNG } from "../sim/random";



/**
 * Semantic substitution dictionary for interpreter noise
 * 
 * Replaces words with contextually plausible but incorrect alternatives.
 */
const SEMANTIC_SUBSTITUTIONS: Record<string, string[]> = {
  "harvest": ["extract", "collect", "gather", "take"],
  "limit": ["bound", "cap", "maximum", "ceiling"],
  "resource": ["material", "substance", "stock", "supply"],
  "units": ["amount", "quantity", "volume", "measure"],
  "epoch": ["time", "period", "step", "cycle"],
  "exceed": ["surpass", "go over", "break", "violate"],
  "shall": ["will", "must", "should", "can"],
  "not": ["never", "no", "cannot", "won't"],
};

/**
 * Apply noise to communication acts (systematic misinterpretation, not random)
 * 
 * Strengthened to 20-30% noise rate with semantic substitution.
 */
function applyInterpreterNoise(decision: SpeciesDecision): SpeciesDecision {
  const rng = getRNG();
  
  if (decision.communication) {
    decision.communication = decision.communication.map(comm => {
      const words = comm.message.split(" ");
      const noisyWords = words.map(word => {
        const r = rng.randomFloat(0, 1);
        const cleanWord = word.toLowerCase().replace(/[.,!?;:]/g, "");
        
        // 10% deletion rate
        if (r < 0.10) return "[REDACTED]";
        
        // 15% semantic substitution (total 25% noise)
        if (r < 0.25 && SEMANTIC_SUBSTITUTIONS[cleanWord]) {
          const alternatives = SEMANTIC_SUBSTITUTIONS[cleanWord];
          const substitute = alternatives[rng.randomInt(0, alternatives.length - 1)];
          // Preserve capitalization
          return word[0] === word[0].toUpperCase() 
            ? substitute[0].toUpperCase() + substitute.slice(1)
            : substitute;
        }
        
        // 5% number corruption (total 30% noise)
        if (r < 0.30 && /\d/.test(word)) {
          const numMatch = word.match(/(\d+)/);
          if (numMatch) {
            const num = parseInt(numMatch[1], 10);
            const corrupted = num + rng.randomInt(-Math.floor(num * 0.2), Math.floor(num * 0.2));
            return word.replace(/\d+/, Math.max(0, corrupted).toString());
          }
        }
        
        return word;
      });
      return { ...comm, message: noisyWords.join(" ") };
    });
  }

  if (decision.treatyProposal) {
    const words = decision.treatyProposal.text.split(" ");
    const noisyWords = words.map(word => {
      const r = rng.randomFloat(0, 1);
      const cleanWord = word.toLowerCase().replace(/[.,!?;:]/g, "");
      
      // 10% deletion
      if (r < 0.10) return "[ERROR]";
      
      // 15% semantic substitution
      if (r < 0.25 && SEMANTIC_SUBSTITUTIONS[cleanWord]) {
        const alternatives = SEMANTIC_SUBSTITUTIONS[cleanWord];
        const substitute = alternatives[rng.randomInt(0, alternatives.length - 1)];
        return word[0] === word[0].toUpperCase() 
          ? substitute[0].toUpperCase() + substitute.slice(1)
          : substitute;
      }
      
      // 5% number corruption
      if (r < 0.30 && /\d/.test(word)) {
        const numMatch = word.match(/(\d+)/);
        if (numMatch) {
          const num = parseInt(numMatch[1], 10);
          const corrupted = num + rng.randomInt(-Math.floor(num * 0.2), Math.floor(num * 0.2));
          return word.replace(/\d+/, Math.max(0, corrupted).toString());
        }
      }
      
      return word;
    });
    decision.treatyProposal.text = noisyWords.join(" ");
  }

  return decision;
}

/**
 * Get decision for a single species
 */
async function getDecisionForSpecies(
  observation: SpeciesObservation,
  world: WorldState,
  speciesModelMap: Record<string, string>,
  baselinePolicyMap?: Record<string, BaselinePolicy>,
  useBaselineAgents?: boolean,
  mechanics = {useLinguisticRegimes:true, useEpistemicOrders:true}
): Promise<{ decision: SpeciesDecision; error?: string; usedFallback: boolean }> {
  const species = world.species.find((s) => s.traits.id === observation.speciesId);
  if (!species || !species.alive) {
    logger.warn(`Species ${observation.speciesId} not found or not alive`);
    return {
      decision: {
        speciesId: observation.speciesId,
        harvest: {},
        relations: {},
        governance: { punishmentStrength: 0.3, monitoringInvestment: 0.2 },
      },
      error: "Species not found or extinct",
      usedFallback: true,
    };
  }
  
  // Check if should use baseline agent
  if (shouldUseBaselineAgent(observation.speciesId, useBaselineAgents || false, baselinePolicyMap)) {
    const policy = getBaselinePolicy(observation.speciesId, baselinePolicyMap);
    const decision = generateBaselineDecision(observation, policy, world.resources);
    return {
      decision: sanitizeDecision(decision),
      usedFallback: false,
    };
  }
  
  // Use LLM
  const modelId = speciesModelMap[observation.speciesId] || species.policyBrainId || "small";
  const prompt = buildSpeciesPrompt(species, world, observation, mechanics);
  
  const output = await callLLM(modelId, prompt);
  const parsed = parseLLMResponse(output, observation.speciesId, true);
  let decision = sanitizeDecision(parsed);
  if (species.traits.requiresInterpreter) decision = applyInterpreterNoise(decision);
  return { decision, usedFallback: false };

}

/**
 * Get decisions for all observations with error handling
 */
export async function getLLMDecision(
  observations: SpeciesObservation[],
  world: WorldState,
  speciesModelMap: Record<string, string>,
  config: { useBaselineAgents?: boolean; baselinePolicyMap?: Record<string, BaselinePolicy>; useLinguisticRegimes?: boolean; useEpistemicOrders?: boolean }
): Promise<{ decisions: SpeciesDecision[]; errors: SimEvent[] }> {
  const decisions: SpeciesDecision[] = [];
  const errors: SimEvent[] = [];
  
  for (const obs of observations) {
    const result = await getDecisionForSpecies(
      obs,
      world,
      speciesModelMap,
      config.baselinePolicyMap,
      config.useBaselineAgents,
      {useLinguisticRegimes:!!config.useLinguisticRegimes, useEpistemicOrders:!!config.useEpistemicOrders}
    );
    
    decisions.push(result.decision);
    
    if (result.error || result.usedFallback) {
      errors.push({
        timeStep: world.timeStep,
        type: "DEFECT", // Reuse event type for now, could add "LLM_FAILURE"
        message: `LLM failure for ${obs.speciesId}: ${result.error || "Using fallback decision"}`,
        data: {
          speciesId: obs.speciesId,
        },
      });
    }
  }
  
  return { decisions, errors };
}

