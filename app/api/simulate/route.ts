/**
 * API route for running simulations
 */

import { NextRequest, NextResponse } from "next/server";
import { createWorldFromPreset } from "@/lib/sim/presets";
import { stepWorld } from "@/lib/sim/gameLoop";
import { buildObservation } from "@/lib/sim/gameLoop";
import { buildSpeciesPrompt } from "@/lib/llm/promptBuilder";
import { parseLLMResponse } from "@/lib/llm/parseActions";
import { computeCollapseStats, computeCooperationIndex, computeSpeciesOutcomes } from "@/lib/sim/metrics";
import { WorldState, SpeciesObservation, SpeciesDecision } from "@/lib/sim/types";
import { validateSimulationRequest, validateSpeciesDecision } from "@/lib/utils/validation";
import { SimulationRequest } from "@/lib/types/api";

async function getDecisions(
  observations: SpeciesObservation[],
  world: WorldState,
  speciesModelMap: Record<string, string>
): Promise<SpeciesDecision[]> {
  const decisions: SpeciesDecision[] = [];
  
  for (const obs of observations) {
    const species = world.species.find((s) => s.traits.id === obs.speciesId);
    if (!species || !species.alive) {
      console.warn(`Species ${obs.speciesId} not found or not alive, skipping decision`);
      continue;
    }
    
    const modelId = speciesModelMap[obs.speciesId] || species.policyBrainId || "small";
    const prompt = buildSpeciesPrompt(species, world, obs);
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      const response = await fetch(`${baseUrl}/api/llm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, prompt }),
      });
      
      if (!response.ok) {
        throw new Error(`LLM API returned status ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.output) {
        throw new Error("LLM API response missing output field");
      }
      
      const decision = parseLLMResponse(data.output, obs.speciesId);
      
      // Validate the parsed decision
      const validation = validateSpeciesDecision(decision, obs.speciesId);
      if (!validation.valid) {
        console.warn(`Invalid decision for ${obs.speciesId}:`, validation.errors);
        // Use fallback decision but log the issue
      }
      
      decisions.push(decision);
    } catch (error) {
      console.error(`Error getting decision for ${obs.speciesId}:`, error);
      // Fallback to minimal decision
      const fallbackDecision: SpeciesDecision = {
        speciesId: obs.speciesId,
        harvest: {},
        relations: {},
        governance: { punishmentStrength: 0.3, monitoringInvestment: 0.2 },
      };
      decisions.push(fallbackDecision);
    }
  }
  
  return decisions;
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid JSON in request body", details: String(error) },
        { status: 400 }
      );
    }
    
    // Validate request body
    const validation = validateSimulationRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: validation.errors },
        { status: 400 }
      );
    }
    
    const { presetId, numSteps, speciesModelMap, seed, config: configOverrides } = body;
    
    try {
      const { world: initialState, config } = createWorldFromPreset(
        presetId,
        speciesModelMap || {},
        seed,
        configOverrides
      );
      
      const history: WorldState[] = [initialState];
      let currentState = initialState;
      
      for (let step = 0; step < numSteps && step < config.maxTimeSteps; step++) {
        const observations: SpeciesObservation[] = [];
        const aliveSpecies = currentState.species.filter((s) => s.alive);
        
        if (aliveSpecies.length === 0) {
          console.log("All species extinct, stopping simulation early");
          break;
        }
        
        for (const species of aliveSpecies) {
          const obs = buildObservation(species, currentState, history, config);
          observations.push(obs);
        }
        
        const decisions = await getDecisions(observations, currentState, speciesModelMap || {});
        
        if (decisions.length === 0) {
          console.warn("No decisions received, stopping simulation");
          break;
        }
        
        currentState = await stepWorld(
          currentState,
          config,
          async (obs: SpeciesObservation[]) => {
            return decisions;
          },
          history
        );
        
        history.push(currentState);
        
        // Stop if all species are extinct
        if (currentState.species.every((s) => !s.alive)) {
          break;
        }
      }
      
      const metrics = {
        collapseStats: computeCollapseStats(history),
        cooperationIndex: computeCooperationIndex(history),
        speciesOutcomes: computeSpeciesOutcomes(history),
      };
      
      return NextResponse.json({ history, metrics });
    } catch (error) {
      console.error("Error during simulation:", error);
      return NextResponse.json(
        { error: "Simulation failed", details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Simulation API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

