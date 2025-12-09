/**
 * API route for exporting simulation data
 */

import { NextRequest, NextResponse } from "next/server";
import { exportSimulation } from "@/lib/utils/export";
import { WorldState, SimConfig } from "@/lib/sim/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { history, config, metadata } = body;
    
    if (!history || !Array.isArray(history)) {
      return NextResponse.json(
        { error: "history is required and must be an array" },
        { status: 400 }
      );
    }
    
    if (!config) {
      return NextResponse.json(
        { error: "config is required" },
        { status: 400 }
      );
    }
    
    const exported = exportSimulation(history as WorldState[], config as SimConfig, metadata);
    
    return NextResponse.json({ 
      data: exported,
      filename: `simulation-${Date.now()}.json`
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: "Export failed", 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

