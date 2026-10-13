/** Deterministic baseline experiment: no network or provider credentials used. */
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { runSimulation, PROTOCOL_VERSION } from "../lib/server/simulation";
import { createWorldFromPreset } from "../lib/sim/presets";
import { computeTimeToFirstCollapse } from "../lib/sim/metrics";
import type { BaselinePolicy } from "../lib/sim/baselineAgents";

async function main() {
  const out = process.argv[2] || "results/baseline.json";
  const policies: BaselinePolicy[] = ["cooperative", "defector", "conservative", "opportunistic"];
  const seeds = [11, 23, 42, 71, 101];
  const runs: Array<Awaited<ReturnType<typeof runSimulation>>["provenance"] & {policy: BaselinePolicy; config: unknown; timeToFirstCollapse: number | null; finalResourceStock: number; survivors: number; history: Awaited<ReturnType<typeof runSimulation>>["history"]}> = [];
  for (const policy of policies) for (const seed of seeds) {
    const presetId = "two_species_simple_lake";
    const { world } = createWorldFromPreset(presetId, {}, seed);
    const baselinePolicyMap = Object.fromEntries(world.species.map(s => [s.traits.id, policy]));
    const run = await runSimulation(presetId, 100, seed, {}, { useBaselineAgents: true, baselinePolicyMap, harvestNoise: 0 });
    const final = run.history.at(-1)!;
    runs.push({ policy, ...run.provenance, config: run.config,
      timeToFirstCollapse: computeTimeToFirstCollapse(run.history) ?? null,
      finalResourceStock: final.resources.reduce((sum, r) => sum + r.amount, 0),
      survivors: final.species.filter(s => s.alive).length, history: run.history });
  }
  const summary = policies.map(policy => {
    const subset = runs.filter(r => r.policy === policy);
    return { policy, seeds: subset.length, collapses: subset.filter(r => r.timeToFirstCollapse !== null).length,
      meanFinalStock: subset.reduce((s, r) => s+r.finalResourceStock, 0)/subset.length };
  });
  const files = (dir: string): string[] => readdirSync(dir, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? files(join(dir,entry.name)) : [join(dir,entry.name)]);
  const sourceHash = createHash("sha256");
  for (const file of [...files("lib"), "scripts/benchmark.ts", "package-lock.json"].sort()) sourceHash.update(file).update(readFileSync(file));
  const artifact = { protocol: PROTOCOL_VERSION, mode: "baseline", sourceSha256: sourceHash.digest("hex"),
    node: process.version, seeds, summary, runs };
  mkdirSync(out.split("/").slice(0,-1).join("/") || ".", { recursive: true });
  writeFileSync(out, JSON.stringify(artifact, null, 2)+"\n");
  console.log(JSON.stringify({ artifact: out, summary }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
