import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export class APIError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function authorize(request: Request, live = false): void {
  const token = process.env.EVOLSIM_API_TOKEN;
  if (live && (process.env.EVOLSIM_ENABLE_LLM !== "true" || !token || token.length < 32)) {
    throw new APIError("Live LLM calls require explicit server enablement and an API token of at least 32 characters", 403);
  }
  if (token) {
    const actual = Buffer.from(request.headers.get("authorization") || "");
    const expected = Buffer.from(`Bearer ${token}`);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new APIError("Unauthorized", 401);
    }
  }
}

export async function readJSON(request: Request, limit = 65536): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new APIError("JSON body required");
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new APIError("Request body too large", 413);
    }
    parts.push(value);
  }
  try { return JSON.parse(Buffer.concat(parts).toString("utf8")); }
  catch { throw new APIError("Invalid JSON"); }
}

export function apiFailure(error: unknown) {
  if (error instanceof APIError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("Experiment failed", error instanceof Error ? error.name : "UnknownError");
  return NextResponse.json({ error: "Experiment failed; no substitute model output was used" }, { status: 500 });
}
