/** Bounded, transcript-recorded compatibility check against an already installed Ollama model. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runSimulation } from "../lib/server/simulation";
import { createWorldFromPreset } from "../lib/sim/presets";

const origin = "http://127.0.0.1:11434";
const nativeFetch = globalThis.fetch;
const maxCalls = 32;
const model = process.argv[2] || "";
const output = process.argv[3] || "/tmp/evolsim-episode-pilot.json";
const checkOnly = process.argv.includes("--check");
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

async function metadata(path: string, body?: unknown) {
  const response = await nativeFetch(`${origin}${path}`, {
    method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(5000),
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(`Ollama metadata request failed: ${response.status}`);
  return response.json();
}

async function main() {
  if (!model || model.startsWith("--")) throw new Error("Pass an explicit installed local model name");
  if (!checkOnly && execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()) throw new Error("Commit the episode protocol and source before inference");
  const version = await metadata("/api/version");
  const tags = await metadata("/api/tags");
  const installed = tags.models?.find((item: { name: string }) => item.name === model);
  if (!installed || !installed.digest || installed.size < 1000000 || model.includes("cloud")) {
    throw new Error("Choose an already installed local model; this script never downloads models");
  }
  const details = await metadata("/api/show", { model });
  if (details.remote_host || details.remote_model) throw new Error("Cloud-backed models are forbidden");
  if (checkOnly) {
    console.log(JSON.stringify({ endpoint: origin, version, model: installed, inferenceCalls: 0 }, null, 2));
    return;
  }

  // Override inherited provider settings. Only this loopback origin is reachable through the recorder.
  process.env.OPENAI_API_KEY = "ollama-local-validation";
  process.env.OPENAI_BASE_URL = `${origin}/v1`;
  process.env.EVOLSIM_ENABLE_LLM = "true";
  process.env.EVOLSIM_MODELS = model;
  process.env.EVOLSIM_TOKEN_LIMIT_FIELD = "max_tokens";
  delete process.env.OPENAI_ORG_ID;
  delete process.env.OPENAI_PROJECT_ID;

  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]);
  const sourceHash = createHash("sha256");
  for (const file of [...files("lib"), "scripts/research-episodes.ts", "docs/EPISODE_PILOT.md", "package-lock.json"].sort()) {
    sourceHash.update(file).update(readFileSync(file));
  }
  let context: Record<string, unknown> = {};
  const calls: Array<Record<string, unknown>> = [];
  const runs: Array<Record<string, unknown>> = [];
  const artifact = {
    protocol: "local-episode-pilot-v1", startedAt: new Date().toISOString(),
    sourceSha256: sourceHash.digest("hex"), node: process.version, endpoint: origin,
    ollama: version, model: installed, modelParameters: details.parameters ?? null,
    templateSha256: sha256(details.template ?? ""),
    sampling: "temperature0, provider seed equal to world seed; context uses installed Ollama server defaults. Seed is a reproducibility request, not a guarantee.",
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    tokenLimitField: "max_tokens", requestedMaxTokens: 1000,
    timeoutMs: 30000, maxRetries: 0, maxCalls, calls, runs,
  };
  mkdirSync(dirname(output), { recursive: true });
  const save = () => {
    writeFileSync(`${output}.${process.pid}.tmp`, JSON.stringify(artifact, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    renameSync(`${output}.${process.pid}.tmp`, output);
  };
  writeFileSync(output, JSON.stringify(artifact, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    if (request.url !== `${origin}/v1/chat/completions` || request.method !== "POST" || calls.length >= maxCalls) {
      throw new Error("Local validation request boundary rejected the request");
    }
    const rawRequest = await request.clone().text();
    const record: Record<string, unknown> = { ...context, index: calls.length, startedAt: new Date().toISOString(),
      request: rawRequest, requestSha256: sha256(rawRequest) };
    calls.push(record);
    save();
    const started = performance.now();
    try {
      const response = await nativeFetch(request, { redirect: "error" });
      const reader = response.clone().body?.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      if (reader) while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 1024 * 1024) {
          void reader.cancel();
          void response.body?.cancel();
          throw new Error("Local response exceeds 1 MiB recording limit");
        }
        chunks.push(chunk.value);
      }
      const rawResponse = Buffer.concat(chunks).toString("utf8");
      Object.assign(record, { status: response.status, response: rawResponse,
        responseSha256: sha256(rawResponse), elapsedMs: performance.now() - started });
      try { record.providerUsage = JSON.parse(rawResponse).usage ?? null; }
      catch { record.providerMetadataError = "Response body was not JSON"; }
      save();
      return response;
    } catch (error) {
      Object.assign(record, { error: error instanceof Error ? error.message : String(error),
        elapsedMs: performance.now() - started });
      save();
      throw error;
    }
  };
  try {
    for (const [index, seed] of [607, 709].entries()) {
      for (const structured of (index % 2 ? [true, false] : [false, true])) {
        const presetId = "two_species_simple_lake";
        const arm = structured ? "grounded_schema" : "original";
        context = { seed, arm };
        const { world } = createWorldFromPreset(presetId, {}, seed);
        const models = Object.fromEntries(world.species.map(species => [species.traits.id, model]));
        const firstCall = calls.length;
        const partialHistory: unknown[] = [];
        const run: Record<string, unknown> = { seed, arm, firstCall, requestedSteps: 4, status: "running", partialHistory };
        runs.push(run); save();
        try {
          const currentTags = await metadata("/api/tags");
          const reported = currentTags.models?.find((entry: { name: string }) => entry.name === model);
          run.reportedDigestBeforeEpisode = reported?.digest ?? null;
          if (reported?.digest !== installed.digest) throw new Error("Reported model digest changed before episode");
          const result = await runSimulation(presetId, 4, seed, models, { useBaselineAgents: false,
            useStructuredDecisions: structured, llmTemperature: 0, llmSeed: seed }, state => {
              partialHistory.push(state); save();
            });
          Object.assign(run, { status: "completed", result });
        } catch (error) {
          Object.assign(run, { status: "failed", error: error instanceof Error ? error.message : String(error) });
        }
        Object.assign(run, { callCount: calls.length - firstCall, completedSteps: Math.max(0, partialHistory.length - 1) });
        save();
        console.log(JSON.stringify({ seed, arm, status: run.status, completedSteps: run.completedSteps, calls: run.callCount, error: run.error }));
      }
    }
    const finalTags = await metadata("/api/tags");
    const finalDigest = finalTags.models?.find((entry: { name: string }) => entry.name === model)?.digest;
    Object.assign(artifact, { reportedDigestAfterRun: finalDigest ?? null, digestContinuity: finalDigest === installed.digest });
    save();
  } finally {
    globalThis.fetch = nativeFetch;
  }
  console.log(JSON.stringify({ output, calls: calls.length,
    runs: runs.map(({ seed, arm, status, completedSteps, error }) => ({ seed, arm, status, completedSteps, error })) }, null, 2));
  // Failures are research outcomes, retained in the artifact; do not retry them.
}

main().catch(error => { console.error(error); process.exitCode = 1; });
