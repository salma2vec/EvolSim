/** Deterministic offline instrument audit: no model or network calls. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getExogenousRNG } from "../lib/sim/random";
import { referenceDecision, studyCaseQuartetIssues, studyCases, type StudyCase } from "../lib/research/causalResponse";

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
  .flatMap(entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]);
const sourceFiles = [...files("lib"), "scripts/audit-causal-response.ts", "docs/CAUSAL_RESPONSE_MANIFEST.json", "package-lock.json"].sort();
const source = createHash("sha256");
for (const path of sourceFiles) source.update(path).update(readFileSync(path));
const sourceCommit = execFileSync("git", ["log", "-1", "--format=%H", "--", ...sourceFiles], { encoding: "utf8" }).trim();
const manifestBytes = readFileSync("docs/CAUSAL_RESPONSE_MANIFEST.json");
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const cells = studyCases();
const failures: string[] = [];
const gate = (condition: boolean, message: string) => { if (!condition) failures.push(message); return condition; };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const quartets: StudyCase[][] = [];
for (let start = 0; start < cells.length; start += 4) quartets.push(cells.slice(start, start + 4));
const designIssues = quartets.flatMap((quartet, index) => studyCaseQuartetIssues(quartet).map(issue => `quartet${index}:${issue}`));

const adversarial = [
  { name: "fixed-stock mutation", mutate: (items: StudyCase[]) => {
    const payload = JSON.parse(items[0].prompt); payload.exactCurrentStock += 1; items[0].prompt = JSON.stringify(payload);
  } },
  { name: "masked-history leak", mutate: (items: StudyCase[]) => {
    const index = items.findIndex(item => !item.visibleHistory); const payload = JSON.parse(items[index].prompt);
    payload.partnerPreviousRequests = [items[index].partnerRequest, items[index].partnerRequest]; items[index].prompt = JSON.stringify(payload);
  } },
  { name: "binding-language mutation", mutate: (items: StudyCase[]) => {
    const index = items.findIndex(item => item.announcement); const payload = JSON.parse(items[index].prompt);
    payload.announcement = String(payload.announcement).replace("not a legal limit", "now a legal limit"); items[index].prompt = JSON.stringify(payload);
  } },
].map(control => {
  const mutated = clone(quartets[0]);
  control.mutate(mutated);
  const issues = studyCaseQuartetIssues(mutated);
  return { name: control.name, detected: issues.length > 0, issues };
});

type Decision = ReturnType<typeof referenceDecision>;
const decisionCache = new Map<string, Decision>();
const decision = (cell: StudyCase, refined: boolean): Decision => {
  const visible = cell.visibleHistory ? cell.partnerRequest : null;
  const key = JSON.stringify([cell.stock, cell.game, visible, refined]);
  let result = decisionCache.get(key);
  if (!result) {
    const grid = refined ? manifest.offlineGates.refinedGrid : manifest.offlineGates.coarseGrid;
    result = referenceDecision(cell.stock, cell.game, visible, grid.stockStep, grid.actionStep);
    decisionCache.set(key, result);
  }
  return result;
};

const rows = cells.map(cell => {
  const coarse = decision(cell, false);
  const refined = decision(cell, true);
  const config = { useIndependentRandomStreams: true, rngSeed: cell.seed };
  const exogenous = {
    observation: getExogenousRNG(config, "observation-resource", [2, "fish_oceans", cell.speciesId]).normal(),
    harvest: getExogenousRNG(config, "physical-harvest", [2, "fish_oceans"]).normal(),
    shock: getExogenousRNG(config, "physical-shock", [2, "fish_oceans"]).normal(),
  };
  return { id: cell.id, seed: cell.seed, speciesId: cell.speciesId, announcement: cell.announcement,
    visibleHistory: cell.visibleHistory, stock: cell.stock, partnerRequest: cell.partnerRequest,
    promptSha256: sha256(cell.prompt), promptBytes: Buffer.byteLength(cell.prompt),
    coarse: { action: coarse.action, value: coarse.value }, refined: { action: refined.action, value: refined.value }, exogenous };
});

const placeboDifferences: number[] = [];
const exogenousMismatches: string[] = [];
for (const quartet of quartets) for (const visibleHistory of [false, true]) {
  const pair = quartet.filter(cell => cell.visibleHistory === visibleHistory);
  const pairRows = pair.map(cell => rows.find(row => row.id === cell.id)!);
  placeboDifferences.push(pairRows[0].refined.action - pairRows[1].refined.action);
  if (JSON.stringify(pairRows[0].exogenous) !== JSON.stringify(pairRows[1].exogenous)) exogenousMismatches.push(pairRows[0].id);
}
const maxActionDifference = Math.max(...rows.map(row => Math.abs(row.refined.action - row.coarse.action)));
const maxValueDifference = Math.max(...rows.map(row => Math.abs(row.refined.value - row.coarse.value)));
const checks = {
  completeUniquePanel: gate(cells.length === manifest.panel.plannedCells && new Set(cells.map(cell => cell.id)).size === cells.length,
    "panel is incomplete or has duplicate ids"),
  quartetIsolation: gate(designIssues.length === 0, `design isolation failed: ${designIssues.join("; ")}`),
  adversarialControls: gate(adversarial.length === manifest.offlineGates.adversarialMutationsRequired && adversarial.every(item => item.detected),
    "one or more adversarial mutations escaped detection"),
  announcementPlacebo: gate(placeboDifferences.every(value => value === manifest.offlineGates.referenceAnnouncementEffect),
    "nonbinding announcement changed the reference decision"),
  gridActionConvergence: gate(maxActionDifference <= manifest.offlineGates.maxAllowedActionDifference,
    `reference action changed under refinement: max difference ${maxActionDifference}`),
  gridValueConvergence: gate(maxValueDifference <= manifest.offlineGates.maxAllowedValueDifference,
    `reference value changed under refinement: max difference ${maxValueDifference}`),
  exogenousArmIsolation: gate(exogenousMismatches.length === 0, `arm assignment shifted keyed draws: ${exogenousMismatches.join(",")}`),
};

const artifact = {
  artifactVersion: "causal-instrument-audit-v1", studyId: manifest.studyId,
  mode: "offline-no-inference", result: failures.length === 0 ? "pass" : "blocked",
  sourceCommit, sourceSha256: source.digest("hex"), manifestSha256: sha256(manifestBytes),
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  checks, diagnostics: { cells: cells.length, quartets: quartets.length, uniqueReferenceProblems: decisionCache.size,
    maxActionDifference, maxValueDifference, placeboDifferences, designIssues, exogenousMismatches, adversarial },
  failures, rows,
  interpretation: "This artifact validates a frozen offline instrument and transparent reference only. It contains no model responses and is not evidence of cooperation or an institutional treatment effect."
};

const replayIndex = process.argv.indexOf("--replay");
if (replayIndex >= 0) {
  const path = process.argv[replayIndex + 1];
  if (!path) throw new Error("Usage: npm run causal:replay -- <artifact>");
  const expected = JSON.parse(readFileSync(path, "utf8"));
  // Verify the historical source digest, then compare the scientific output. This lets a
  // later output-safety-only change replay an immutable artifact without rewriting it.
  const historicalSource = createHash("sha256");
  for (const file of sourceFiles) historicalSource.update(file)
    .update(execFileSync("git", ["show", `${expected.sourceCommit}:${file}`]));
  assert.equal(historicalSource.digest("hex"), expected.sourceSha256);
  assert.deepEqual({ ...artifact, sourceCommit: expected.sourceCommit, sourceSha256: expected.sourceSha256,
    environment: expected.environment }, expected);
  console.log(JSON.stringify({ replay: path, exact: true, sourceSha256: expected.sourceSha256 }, null, 2));
} else {
  const out = process.argv[2] || "results/causal-instrument-audit.json";
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(artifact, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ artifact: out, result: artifact.result, checks, failures }, null, 2));
}
if (failures.length > 0) process.exitCode = 1;
