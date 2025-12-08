/**
 * API route for LLM calls
 */

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, prompt, temperature } = body;
    
    if (!modelId || !prompt) {
      return NextResponse.json(
        { error: "modelId and prompt are required" },
        { status: 400 }
      );
    }
    
    const output = await callLLM(modelId, prompt, { temperature });
    
    return NextResponse.json({ output });
  } catch (error) {
    console.error("LLM API route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

