/**
 * Robust LLM decision handler with timeout, retry, and fallback
 * 
 * Handles all LLM failures gracefully with logged fallback decisions.
 */

import { SpeciesObservation, SpeciesDecision, SimEvent } from "../sim/types";
import { WorldState } from "../sim/types";
import { buildSpeciesPrompt } from "./promptBuilder";
import { parseLLMResponse } from "./parseActions";
import { sanitizeDecision } from "../sim/guards";
import { logger } from "../utils/logger";
import { withTimeout } from "../utils/async";
import { shouldUseBaselineAgent, generateBaselineDecision, getBaselinePolicy } from "../sim/baselineAgents";
import type { BaselinePolicy } from "../sim/baselineAgents";
import { getRNG } from "../sim/random";

const LLM_TIMEOUT_MS = 30000; // 30 seconds
const LLM_MAX_RETRIES = 2;

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
  useBaselineAgents?: boolean
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
  const prompt = buildSpeciesPrompt(species, world, observation);
  
  let lastError: Error | unknown;
  
  for (let attempt = 1; attempt <= LLM_MAX_RETRIES; attempt++) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      
      const response = await withTimeout(
        fetch(`${baseUrl}/api/llm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId, prompt }),
        }),
        LLM_TIMEOUT_MS,
        `LLM API timeout after ${LLM_TIMEOUT_MS}ms`
      );
      
      if (!response.ok) {
        throw new Error(`LLM API returned status ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.output) {
        throw new Error("LLM API response missing output field");
      }
      
      const parsed = parseLLMResponse(data.output, observation.speciesId);
      let decision = sanitizeDecision(parsed);
      
      // Apply interpreter noise if required
      if (species.traits.requiresInterpreter) {
        decision = applyInterpreterNoise(decision);
      }

      return {
        decision,
        usedFallback: false,
      };
    } catch (error) {
      lastError = error;
      logger.warn(`LLM attempt ${attempt}/${LLM_MAX_RETRIES} failed for ${observation.speciesId}`, error);
      
      if (attempt < LLM_MAX_RETRIES) {
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  // All retries failed - use fallback
  logger.error(`All LLM attempts failed for ${observation.speciesId}, using fallback`, lastError);
  
  const fallbackDecision: SpeciesDecision = {
    speciesId: observation.speciesId,
    harvest: {},
    relations: species.relations || {},
    governance: species.governance || { punishmentStrength: 0.3, monitoringInvestment: 0.2 },
  };
  
  return {
    decision: sanitizeDecision(fallbackDecision),
    error: lastError instanceof Error ? lastError.message : String(lastError),
    usedFallback: true,
  };
}

/**
 * Get decisions for all observations with error handling
 */
export async function getLLMDecision(
  observations: SpeciesObservation[],
  world: WorldState,
  speciesModelMap: Record<string, string>,
  config: { useBaselineAgents?: boolean; baselinePolicyMap?: Record<string, BaselinePolicy> }
): Promise<{ decisions: SpeciesDecision[]; errors: SimEvent[] }> {
  const decisions: SpeciesDecision[] = [];
  const errors: SimEvent[] = [];
  
  for (const obs of observations) {
    const result = await getDecisionForSpecies(
      obs,
      world,
      speciesModelMap,
      config.baselinePolicyMap,
      config.useBaselineAgents
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

