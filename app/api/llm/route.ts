/**
 * API route for LLM calls
 */

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm/client";
import { LLMRequest } from "@/lib/types/api";
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
    
    const req = body as LLMRequest;
    const { modelId, prompt, temperature } = req;
    
    if (!modelId || typeof modelId !== "string") {
      return NextResponse.json(
        { error: "modelId is required and must be a string" },
        { status: 400 }
      );
    }
    
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "prompt is required and must be a string" },
        { status: 400 }
      );
    }
    
    if (prompt.length > 50000) {
      return NextResponse.json(
        { error: "prompt is too long (max 50000 characters)" },
        { status: 400 }
      );
    }
    
    if (temperature !== undefined) {
      if (typeof temperature !== "number" || temperature < 0 || temperature > 2) {
        return NextResponse.json(
          { error: "temperature must be a number between 0 and 2" },
          { status: 400 }
        );
      }
    }
    
    try {
      const output = await callLLM(modelId, prompt, { temperature });
      
      if (!output || typeof output !== "string") {
        throw new Error("LLM returned invalid output");
      }
      
      return NextResponse.json({ output });
    } catch (error) {
      logger.error("LLM call error", error);
      return NextResponse.json(
        { 
          error: "Failed to call LLM", 
          details: error instanceof Error ? error.message : String(error) 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error("LLM API route error", error);
    return NextResponse.json(
      { 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

