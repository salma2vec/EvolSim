import { NextRequest, NextResponse } from "next/server";
import { authorize, readJSON, apiFailure, APIError } from "@/lib/server/api";
import { runSimulation } from "@/lib/server/simulation";
import { validateSimulationRequest } from "@/lib/utils/validation";
import type { SimConfig } from "@/lib/sim/types";
export async function POST(request: NextRequest) {
  try {
    authorize(request);
    const body = await readJSON(request);
    const check = validateSimulationRequest(body);
    if (!check.valid) throw new APIError(check.errors.join("; "));
    const req = body as { presetId: string; numSteps: number; seed?: number; speciesModelMap?: Record<string,string>; config?: Partial<SimConfig> };
    authorize(request, req.config?.useBaselineAgents === false);
    return NextResponse.json(await runSimulation(req.presetId, req.numSteps, req.seed, req.speciesModelMap, req.config));
  } catch (error) { return apiFailure(error); }
}
