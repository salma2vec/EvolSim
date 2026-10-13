import { NextRequest, NextResponse } from "next/server";
import { runBatchExperiments, BatchExperimentConfig } from "@/lib/utils/batch";
import { authorize, readJSON, apiFailure } from "@/lib/server/api";
export async function POST(request: NextRequest) {
  try {
    authorize(request);
    const config = await readJSON(request) as BatchExperimentConfig;
    return NextResponse.json({ results: await runBatchExperiments(config) });
  } catch (error) { return apiFailure(error); }
}
