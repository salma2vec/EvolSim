/** Offline verification of a saved causal panel; performs no provider calls. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseStudyResponse, STUDY_SCHEMA, studyCases } from "../lib/research/causalResponse";

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const path = process.argv[2];
if (!path) throw new Error("Usage: npm run causal:replay-panel -- <artifact>");
const artifact = JSON.parse(readFileSync(path, "utf8"));
const manifest = JSON.parse(readFileSync("docs/CAUSAL_RESPONSE_RUN.json", "utf8"));
const cells = studyCases();

assert.equal(artifact.artifactVersion, "causal-response-panel-v1");
assert.equal(artifact.runManifestSha256, sha256(readFileSync("docs/CAUSAL_RESPONSE_RUN.json")));
assert.equal(artifact.instrumentArtifactSha256, sha256(readFileSync(manifest.offlineAudit.artifact)));
assert.equal(artifact.provider.installed.digest, manifest.provider.digest);
assert.equal(artifact.records.length, manifest.panel.calls);
assert.equal(new Set(artifact.records.map((record: any) => record.id)).size, artifact.records.length);
assert.equal(sha256(JSON.stringify(cells.map(cell => cell.id))), manifest.panel.caseIdsSha256);
assert.equal(sha256(JSON.stringify(cells.map(cell => cell.prompt))), manifest.panel.promptsSha256);

let requestHashesVerified = 0;
let responseHashesVerified = 0;
let decisionsReparsed = 0;
for (const [index, cell] of cells.entries()) {
  const record = artifact.records[index];
  assert.equal(record.id, cell.id);
  const expectedRequest = { model: manifest.provider.model, stream: false,
    messages: [
      { role: "system", content: manifest.request.system },
      { role: "user", content: cell.prompt },
    ], format: STUDY_SCHEMA, keep_alive: manifest.request.keepAlive,
    options: { temperature: manifest.request.temperature, seed: cell.sampleSeed,
      num_ctx: manifest.request.numCtx, num_predict: manifest.request.numPredict } };
  assert.deepEqual(record.request, expectedRequest);
  assert.equal(record.requestSha256, sha256(JSON.stringify(record.request)));
  requestHashesVerified += 1;
  assert.equal(record.responseSha256, sha256(record.response));
  responseHashesVerified += 1;
  const provider = JSON.parse(record.response);
  assert.equal(record.httpStatus, 200);
  assert.equal(provider.done, true);
  assert.equal(provider.done_reason, "stop");
  const parsed = parseStudyResponse(provider.message.content, cell);
  assert.deepEqual(record.parsed, parsed);
  assert.equal(record.status, parsed.comprehensionPassed ? "eligible" : "comprehension");
  decisionsReparsed += 1;
}

const eligible = artifact.records.filter((record: any) => record.status === "eligible").length;
const completeQuartets = Array.from({ length: 16 }, (_, index) => artifact.records.slice(index * 4, index * 4 + 4))
  .filter((quartet: any[]) => quartet.every(record => record.status === "eligible")).length;
assert.equal(artifact.summary.attempted, artifact.records.length);
assert.equal(artifact.summary.eligible, eligible);
assert.equal(artifact.summary.completeQuartets, completeQuartets);
assert.equal(artifact.summary.interpretationGatePassed, false);
assert.equal(artifact.summary.estimands, null);

console.log(JSON.stringify({ artifact: path, inferenceCalls: 0, exactFrozenRequests: true,
  requestHashesVerified, responseHashesVerified, decisionsReparsed, eligible,
  completeQuartets, interpretationGatePassed: false }, null, 2));
