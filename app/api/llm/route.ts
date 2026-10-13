import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm/client";
import { authorize, readJSON, apiFailure, APIError } from "@/lib/server/api";
let activeCalls = 0;
export async function POST(request: NextRequest) {
  try {
    authorize(request, true);
    const body = await readJSON(request) as Record<string, unknown>;
    if (!body || typeof body.modelId !== "string" || typeof body.prompt !== "string" || !body.prompt || body.prompt.length > 50000 ||
        (body.temperature !== undefined && (typeof body.temperature !== "number" || !Number.isFinite(body.temperature) || body.temperature < 0 || body.temperature > 2))) throw new APIError("Invalid model, prompt or temperature");
    if (activeCalls >= 2) throw new APIError("Provider capacity reached", 429);
    activeCalls++;
    try { return NextResponse.json({ output: await callLLM(body.modelId, body.prompt, { temperature: body.temperature as number | undefined }), modelId: body.modelId, mode: "live" }); }
    finally { activeCalls--; }
  } catch (error) { return apiFailure(error); }
}
