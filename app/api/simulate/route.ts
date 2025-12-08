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

async function getDecisions(
  observations: SpeciesObservation[],
  world: WorldState,
  speciesModelMap: Record<string, string>
): Promise<SpeciesDecision[]> {
  const decisions: SpeciesDecision[] = [];
  
  for (const obs of observations) {
    const species = world.species.find((s) => s.traits.id === obs.speciesId);
    if (!species || !species.alive) continue;
    
    const modelId = speciesModelMap[obs.speciesId] || species.policyBrainId || "small";
    const prompt = buildSpeciesPrompt(species, world, obs);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/llm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, prompt }),
      });
      
      const data = await response.json();
      const decision = parseLLMResponse(data.output, obs.speciesId);
      decisions.push(decision);
    } catch (error) {
      console.error(`Error getting decision for ${obs.speciesId}:`, error);
      // Fallback to minimal decision
      decisions.push({
        speciesId: obs.speciesId,
        harvest: {},
        relations: {},
        governance: { punishmentStrength: 0.3, monitoringInvestment: 0.2 },
      });
    }
  }
  
  return decisions;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { presetId, numSteps, speciesModelMap, seed } = body;
    
    if (!presetId || !numSteps) {
      return NextResponse.json(
        { error: "presetId and numSteps are required" },
        { status: 400 }
      );
    }
    
    const { world: initialState, config } = createWorldFromPreset(
      presetId,
      speciesModelMap || {},
      seed
    );
    
    const history: WorldState[] = [initialState];
    let currentState = initialState;
    
    for (let step = 0; step < numSteps && step < config.maxTimeSteps; step++) {
      const observations: SpeciesObservation[] = [];
      const aliveSpecies = currentState.species.filter((s) => s.alive);
      
      for (const species of aliveSpecies) {
        const obs = buildObservation(species, currentState, history, config);
        observations.push(obs);
      }
      
      const decisions = await getDecisions(observations, currentState, speciesModelMap || {});
      
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
    console.error("Simulation API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

