/**
 * API route for batch experiments
 */

import { NextRequest, NextResponse } from "next/server";
import { runBatchExperiments, BatchExperimentConfig } from "@/lib/utils/batch";
import { validateSimulationRequest } from "@/lib/utils/validation";
import { logger } from "@/lib/utils/logger";

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
    
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be an object" },
        { status: 400 }
      );
    }
    
    const config = body as Partial<BatchExperimentConfig>;
    
    // Validate required fields
    if (!config.presetId || typeof config.presetId !== "string") {
      return NextResponse.json(
        { error: "presetId is required and must be a string" },
        { status: 400 }
      );
    }
    
    if (config.numSteps === undefined || typeof config.numSteps !== "number" || config.numSteps < 1) {
      return NextResponse.json(
        { error: "numSteps is required and must be a positive number" },
        { status: 400 }
      );
    }
    
    if (config.runs === undefined || typeof config.runs !== "number" || config.runs < 1 || config.runs > 100) {
      return NextResponse.json(
        { error: "runs is required and must be between 1 and 100" },
        { status: 400 }
      );
    }
    
    const batchConfig: BatchExperimentConfig = {
      presetId: config.presetId,
      numSteps: config.numSteps,
      runs: config.runs,
      seeds: config.seeds,
      speciesModelMaps: config.speciesModelMaps,
      configOverrides: config.configOverrides,
    };
    
    logger.info("Starting batch experiment", { runs: batchConfig.runs, presetId: batchConfig.presetId });
    
    const results = await runBatchExperiments(batchConfig);
    
    const successCount = results.filter(r => r.success).length;
    logger.info("Batch experiment completed", { 
      total: results.length, 
      successful: successCount,
      failed: results.length - successCount 
    });
    
    return NextResponse.json({ results });
  } catch (error) {
    logger.error("Batch experiment API error", error);
    return NextResponse.json(
      { 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

