/**
 * API route for running simulations
 * 
 * POST /api/simulate
 * 
 * Request body:
 * - presetId: string (required) - Preset scenario ID
 * - numSteps: number (required) - Number of simulation steps
 * - speciesModelMap?: Record<string, string> - Model assignments per species
 * - seed?: number - Random seed for reproducibility
 * - config?: Partial<SimConfig> - Configuration overrides
 * 
 * Response:
 * - history: WorldState[] - Simulation history
 * - metrics: { collapseStats, cooperationIndex, speciesOutcomes }
 */

import { NextRequest, NextResponse } from "next/server";
import { createWorldFromPreset } from "@/lib/sim/presets";
import { stepWorld } from "@/lib/sim/gameLoop";
import { computeCollapseStats, computeCooperationIndex, computeSpeciesOutcomes } from "@/lib/sim/metrics";
import { WorldState, SpeciesDecision, SimConfig } from "@/lib/sim/types";
import { validateSimulationRequest } from "@/lib/utils/validation";
import { logger } from "@/lib/utils/logger";
import { assertWorldState } from "@/lib/sim/guards";
import { shouldUseBaselineAgent, generateBaselineDecision, getBaselinePolicy } from "@/lib/sim/baselineAgents";
import type { BaselinePolicy } from "@/lib/sim/baselineAgents";
import { getLLMDecision } from "@/lib/llm/decisionHandler";

// Decision handling moved to lib/llm/decisionHandler.ts

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
      
      // Validate initial state
      assertWorldState(initialState);
      
      const history: WorldState[] = [initialState];
      let currentState = initialState;
      
      // Extract baseline policy map if provided
      const baselinePolicyMap = (configOverrides as any)?.baselinePolicyMap as Record<string, BaselinePolicy> | undefined;
      
      for (let step = 0; step < numSteps && step < config.maxTimeSteps; step++) {
        // Check termination conditions
        const aliveSpecies = currentState.species.filter((s) => s.alive);
        if (aliveSpecies.length === 0) {
          logger.info("All species extinct, stopping simulation early");
          break;
        }
        
        // stepWorld handles observation building and decision making internally
        // This ensures consistency and proper epistemic order handling
        const llmErrors: typeof currentState.events = [];
        currentState = await stepWorld(
          currentState,
          config,
          async (observations) => {
            // Get decisions using robust handler
            const { decisions, errors } = await getLLMDecision(
              observations,
              currentState,
              speciesModelMap || {},
              {
                useBaselineAgents: config.useBaselineAgents || false,
                baselinePolicyMap,
              }
            );
            
            // Collect errors to add to new state
            llmErrors.push(...errors);
            
            return decisions;
          },
          history
        );
        
        // Add LLM error events to new state
        if (llmErrors.length > 0) {
          currentState.events.push(...llmErrors);
        }
        
        // Validate state after step
        assertWorldState(currentState);
        
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
      logger.error("Error during simulation", error);
      return NextResponse.json(
        { error: "Simulation failed", details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error("Simulation API error", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

