/** Local paired action-interface pilot; not a strategy or cooperation benchmark. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildSpeciesPrompt } from "../lib/llm/promptBuilder";
import { buildDecisionSchema } from "../lib/llm/decisionSchema";
import { parseLLMResponse } from "../lib/llm/parseActions";
import { buildObservation } from "../lib/sim/gameLoop";
import { createWorldFromPreset } from "../lib/sim/presets";

const origin = "http://127.0.0.1:11434";
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]);

async function local(path: string, body?: unknown, timeout = 5000) {
  if (!["/api/version", "/api/tags", "/api/show", "/api/chat"].includes(path)) throw new Error("Forbidden local endpoint");
  const response = await fetch(origin + path, { method: body ? "POST" : "GET", redirect: "error",
    signal: AbortSignal.timeout(timeout), ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  if (reader) while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > 1024 * 1024) { await reader.cancel(); throw new Error("Response exceeds 1 MiB"); }
    chunks.push(chunk.value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return { status: response.status, raw, parsed: JSON.parse(raw) };
}

async function main() {
  const [model, output] = process.argv.slice(2);
  if (!model || !output) throw new Error("Pass an installed model and new output path");
  if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()) throw new Error("Commit the protocol and runner before inference");
  const version = await local("/api/version");
  const tags = await local("/api/tags");
  const installed = tags.parsed.models?.find((entry: { name: string }) => entry.name === model);
  if (!installed?.digest || installed.size < 1000000 || model.includes("cloud")) throw new Error("An installed local model is required; no downloads");
  const details = await local("/api/show", { model });
  if (details.parsed.remote_host || details.parsed.remote_model) throw new Error("Cloud models forbidden");
  const sourceFiles = [...files("lib"), "scripts/research-interface.ts", "docs/INTERFACE_PILOT.md", "package-lock.json"].sort();
  const sourceHashes = Object.fromEntries(sourceFiles.map(path => [path, sha256(readFileSync(path))]));
  const cases = [203, 307, 401, 503].flatMap(seed => {
    const { world, config } = createWorldFromPreset("two_species_simple_lake", {}, seed);
    return world.species.map(species => {
      const observation = buildObservation(species, world, [], config);
      const targets = { resourceIds: observation.resourceEstimates.map(r => r.resourceId),
        otherSpeciesIds: observation.otherSpecies.map(s => s.speciesId) };
      return { seed, speciesId: species.traits.id, observation, targets,
        prompt: buildSpeciesPrompt(species, world, observation, { useEpistemicOrders: !!config.useEpistemicOrders,
          useLinguisticRegimes: !!config.useLinguisticRegimes }), schema: buildDecisionSchema(targets) };
    });
  });
  const calls: Array<Record<string, any>> = [];
  const artifact: Record<string, any> = { protocol: "action-interface-pilot-v1", startedAt: new Date().toISOString(),
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), sourceHashes,
    node: process.version, model: installed, ollama: version.parsed,
    templateSha256: sha256(details.parsed.template ?? ""), modelParameters: details.parsed.parameters ?? null,
    budget: { calls: 16, timeoutMs: 30000, retries: 0, generatedTokens: 1000, temperature: 0, context: 8192 },
    scope: "Eight fixed initial observations; grounding plus decoder package; dependent role pairs; no strategic outcome claim.",
    cases, calls };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(artifact, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  const save = () => {
    const temporary = `${output}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(artifact, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    renameSync(temporary, output);
  };
  for (const [index, item] of cases.entries()) {
    const arms = index % 2 ? ["grounded_schema", "original"] : ["original", "grounded_schema"];
    for (const arm of arms) {
      const prompt = arm === "original" ? item.prompt : item.prompt +
        "\nThe exact contract below replaces the placeholder example above. Use these exact IDs. Empty communication and null treatyProposal are allowed.\n" + JSON.stringify(item.schema);
      const request = { model, stream: false, messages: [
        { role: "system", content: "You are a strategic decision-making system for an alien species. Always respond with valid JSON only." },
        { role: "user", content: prompt }], options: { temperature: 0, seed: 1000 + index, num_ctx: 8192, num_predict: 1000 },
        ...(arm === "grounded_schema" ? { format: item.schema } : {}) };
      const record: Record<string, any> = { caseIndex: index, seed: item.seed, speciesId: item.speciesId, arm,
        request, requestSha256: sha256(JSON.stringify(request)), accepted: false, startedAt: new Date().toISOString() };
      calls.push(record); save();
      const started = performance.now();
      try {
        const result = await local("/api/chat", request, 30000);
        Object.assign(record, { status: result.status, response: result.raw, responseSha256: sha256(result.raw),
          finishReason: result.parsed.done_reason, generatedTokens: result.parsed.eval_count });
        if (result.status !== 200 || !result.parsed.done || result.parsed.done_reason !== "stop" || typeof result.parsed.message?.content !== "string") throw new Error("Incomplete provider response");
        record.decision = parseLLMResponse(result.parsed.message.content, item.speciesId, true, item.targets);
        record.accepted = true;
      } catch (error) { record.error = error instanceof Error ? error.message : String(error); }
      record.elapsedMs = performance.now() - started; save();
      console.log(JSON.stringify({ caseIndex: index, arm, accepted: record.accepted, error: record.error }));
    }
  }
  const count = (arm: string) => calls.filter(c => c.arm === arm && c.accepted).length;
  const pairs = cases.map((_, index) => Object.fromEntries(calls.filter(c => c.caseIndex === index).map(c => [c.arm, c.accepted])));
  artifact.summary = { attemptedPerArm: 8, originalValid: count("original"), groundedValid: count("grounded_schema"),
    improvedPairs: pairs.filter(p => !p.original && p.grounded_schema).length,
    regressedPairs: pairs.filter(p => p.original && !p.grounded_schema).length,
    pilotGatePassed: count("grounded_schema") >= 7 && count("grounded_schema") > count("original"),
    emptyHarvestAmongValid: calls.filter(c => c.accepted && !Object.keys(c.decision.harvest).length).length,
    interpretation: "Descriptive pilot. The gate concerns action validity only; no cooperation or population reliability inference." };
  artifact.finishedAt = new Date().toISOString(); save();
  console.log(JSON.stringify(artifact.summary, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
