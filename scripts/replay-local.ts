/** Offline validation of retained local-adapter-check-v1 responses; never performs inference. */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseLLMResponse } from "../lib/llm/parseActions";
import { buildObservation } from "../lib/sim/gameLoop";
import { createWorldFromPreset } from "../lib/sim/presets";

globalThis.fetch = async () => { throw new Error("Offline replay forbids network requests"); };
const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) throw new Error("Pass the original local artifact and a distinct replay output path");
if (resolve(input) === resolve(output)) throw new Error("Replay must not overwrite the original artifact");
if (statSync(input).size > 10 * 1024 * 1024) throw new Error("Artifact exceeds 10 MiB limit");
const bytes = readFileSync(input);
const original = JSON.parse(bytes.toString("utf8"));
if (original.protocol !== "local-adapter-check-v1" || !Array.isArray(original.calls) ||
    original.calls.length > 4 || !Array.isArray(original.runs) || original.runs.length > 2) {
  throw new Error("Unsupported local artifact");
}
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]);
const source = createHash("sha256");
for (const file of [...files("lib"), "scripts/validate-local.ts", "scripts/replay-local.ts", "package-lock.json"].sort()) {
  source.update(file).update(readFileSync(file));
}
const runs = original.runs.map((run: { seed: number; firstCall: number; callCount: number; status: string }) => {
  if (![11, 42].includes(run.seed) || !Number.isInteger(run.firstCall) || run.firstCall < 0 ||
      !Number.isInteger(run.callCount) || run.callCount < 0 || run.callCount > 2 ||
      run.firstCall + run.callCount > original.calls.length) throw new Error("Invalid run indexing");
  const { world, config } = createWorldFromPreset("two_species_simple_lake", {}, run.seed);
  const decisions = original.calls.slice(run.firstCall, run.firstCall + run.callCount).map((call: {
    index: number; response?: string; responseSha256?: string; request: string; requestSha256: string;
  }, index: number) => {
    const species = world.species[index];
    const observation = buildObservation(species, world, [], config);
    try {
      if (sha256(call.request) !== call.requestSha256 || !call.response || sha256(call.response) !== call.responseSha256) {
        throw new Error("Transcript content hash mismatch or missing response");
      }
      const completion = JSON.parse(call.response).choices?.[0];
      if (completion?.finish_reason !== "stop" || typeof completion.message?.content !== "string") {
        throw new Error("Provider returned incomplete output");
      }
      const decision = parseLLMResponse(completion.message.content, species.traits.id, true, {
        resourceIds: observation.resourceEstimates.map(resource => resource.resourceId),
        otherSpeciesIds: observation.otherSpecies.map(other => other.speciesId),
      });
      return { callIndex: call.index, speciesId: species.traits.id, accepted: true, decision };
    } catch (error) {
      return { callIndex: call.index, speciesId: species.traits.id, accepted: false,
        error: error instanceof Error ? error.message : String(error) };
    }
  });
  return { seed: run.seed, originalRunStatus: run.status, decisions,
    allRequiredDecisionsValid: decisions.length === world.species.length && decisions.every((d: { accepted: boolean }) => d.accepted) };
});
const replay = { protocol: "offline-local-parser-replay-v1", createdAt: new Date().toISOString(),
  originalArtifactSha256: sha256(bytes), originalSourceSha256: original.sourceSha256,
  replaySourceSha256: source.digest("hex"), newInferenceCalls: 0,
  scope: "Each recorded response is checked independently against current strict parsing and observation IDs. No simulation or new model inference is performed.",
  runs };
writeFileSync(output, JSON.stringify(replay, null, 2) + "\n", { mode: 0o600, flag: "wx" });
console.log(JSON.stringify(replay, null, 2));
