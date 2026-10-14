import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { assertV2StrategicPanelAuthorized, auditV2PretestArtifact, buildV2Request, parseV2Pretest,
  V2_MODELS, V2_PRETEST_SCHEMA, V2_STRATEGIC_PANEL_AUTHORIZED, v2PretestCases,
  verifyV2PretestArtifact } from "@/lib/research/causalResponseV2";

const protocol = { pretest: { cellsPerAttemptedModel: 8, passThreshold: 8 }, provider: {
  endpoint: "http://127.0.0.1:11434/api/chat", ollamaVersion: "0.40.1", temperature: 0, numCtx: 8192, pretestNumPredict: 128 } };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const metadata = (modelIndex: number) => ({ endpoint: "http://127.0.0.1:11434", localOnly: true,
  version: { version: "0.40.1" }, installed: { name: V2_MODELS[modelIndex].model, digest: V2_MODELS[modelIndex].digest,
    details: { parameter_size: V2_MODELS[modelIndex].parameterSize, quantization_level: V2_MODELS[modelIndex].quantization } } });

function passingAttempt(modelIndex: number) {
  const cells = v2PretestCases(), specification = V2_MODELS[modelIndex];
  const records = cells.map((cell, index) => {
    const request = buildV2Request(specification.model, cell.prompt, V2_PRETEST_SCHEMA, cell.sampleSeed, 128, protocol.provider);
    const content = JSON.stringify({ growth: cell.growth, nextStock: cell.nextStock, quotaBinding: false });
    const response = JSON.stringify({ done: true, done_reason: "stop", message: { content } });
    return { index, id: cell.id, request, requestSha256: hash(JSON.stringify(request)), httpStatus: 200,
      response, responseSha256: hash(response), parsed: parseV2Pretest(content, cell), status: "passed" };
  });
  return { specification, metadata: metadata(modelIndex), records, passed: true, passedCount: 8 };
}

function timeoutAttempt(modelIndex: number) {
  const cells = v2PretestCases(), specification = V2_MODELS[modelIndex];
  const records = cells.map((cell, index) => {
    const request = buildV2Request(specification.model, cell.prompt, V2_PRETEST_SCHEMA, cell.sampleSeed, 128, protocol.provider);
    return { index, id: cell.id, request, requestSha256: hash(JSON.stringify(request)), status: "invalid",
      error: "The operation was aborted due to timeout", elapsedMs: 120001 };
  });
  return { specification, metadata: metadata(modelIndex), records, passed: false, passedCount: 0 };
}

it("freezes eight comprehension-only cells with exact expected arithmetic", () => {
  const cells = v2PretestCases();
  expect(cells).toHaveLength(8);
  for (const cell of cells) {
    expect(cell.prompt).not.toContain("harvest request"); expect(cell.prompt).not.toContain("partner");
    expect(parseV2Pretest(JSON.stringify({ growth: cell.growth, nextStock: cell.nextStock, quotaBinding: false }), cell).passed).toBe(true);
  }
});

it("recomputes a complete selection and rejects provenance or index tampering", () => {
  const artifact: any = { finishedAt: "done", modelOrder: V2_MODELS, cells: v2PretestCases(),
    attempts: [passingAttempt(0)], selectedModel: V2_MODELS[0] };
  expect(verifyV2PretestArtifact(artifact, protocol).issues).toEqual([]);
  const badMetadata = structuredClone(artifact); badMetadata.attempts[0].metadata.installed.digest = "tampered";
  expect(verifyV2PretestArtifact(badMetadata, protocol).issues).not.toEqual([]);
  const badIndex = structuredClone(artifact); badIndex.attempts[0].records[0].index = 7;
  expect(verifyV2PretestArtifact(badIndex, protocol).issues).not.toEqual([]);
});

it("audits interruption without claiming missing responses were verified or reparsed", () => {
  const cells = v2PretestCases();
  const startedRequest = buildV2Request(V2_MODELS[1].model, cells[0].prompt, V2_PRETEST_SCHEMA, cells[0].sampleSeed, 128, protocol.provider);
  const artifact = { modelOrder: V2_MODELS, cells, attempts: [
    timeoutAttempt(0),
    { specification: V2_MODELS[1], metadata: metadata(1), records: [{ index: 0, id: cells[0].id, request: startedRequest,
      requestSha256: hash(JSON.stringify(startedRequest)), status: "started" }], passed: false, passedCount: 0 }], selectedModel: null };
  const audit = auditV2PretestArtifact(artifact, protocol);
  expect(audit.issues).toEqual([]); expect(audit.interrupted).toBe(true); expect(audit.selectedModel).toBeNull();
  expect(audit.requestHashesVerified).toBe(9); expect(audit.responseHashesVerified).toBe(0); expect(audit.responsesReparsed).toBe(0);
});

it("rejects skipped fallback, continuation after a pass, and wrong selection", () => {
  const cells = v2PretestCases();
  const skipped: any = { finishedAt: "done", modelOrder: V2_MODELS, cells,
    attempts: [timeoutAttempt(0)], selectedModel: null };
  expect(auditV2PretestArtifact(skipped, protocol).complete).toBe(false);
  expect(auditV2PretestArtifact(skipped, protocol).issues).toContain("failed first model illegally skipped frozen fallback");

  const continued: any = { finishedAt: "done", modelOrder: V2_MODELS, cells,
    attempts: [passingAttempt(0), timeoutAttempt(1)], selectedModel: V2_MODELS[0] };
  expect(auditV2PretestArtifact(continued, protocol).complete).toBe(false);
  expect(auditV2PretestArtifact(continued, protocol).issues).toContain("ladder continued after first model passed");

  const allFailed: any = { finishedAt: "done", modelOrder: V2_MODELS, cells,
    attempts: [timeoutAttempt(0), timeoutAttempt(1)], selectedModel: null };
  expect(auditV2PretestArtifact(allFailed, protocol).issues).toEqual([]);
  expect(auditV2PretestArtifact(allFailed, protocol).complete).toBe(true);
  const wrongSelection = structuredClone(allFailed); wrongSelection.selectedModel = V2_MODELS[1];
  expect(auditV2PretestArtifact(wrongSelection, protocol).issues)
    .toContain("selected model does not equal the frozen first pass or null");

  const startedFallback: any = timeoutAttempt(1);
  startedFallback.records = startedFallback.records.map((record: any) => {
    const { error: _error, elapsedMs: _elapsedMs, ...started } = record;
    return { ...started, status: "started" };
  });
  const forgedFinish: any = { finishedAt: "done", modelOrder: V2_MODELS, cells,
    attempts: [timeoutAttempt(0), startedFallback], selectedModel: null };
  const forgedAudit = auditV2PretestArtifact(forgedFinish, protocol);
  expect(forgedAudit.complete).toBe(false);
  expect(forgedAudit.issues).toContain("finished ladder has incomplete fallback attempt");
});

it("keeps every strategic v2 path explicitly unauthorized", () => {
  expect(V2_STRATEGIC_PANEL_AUTHORIZED).toBe(false);
  expect(() => assertV2StrategicPanelAuthorized()).toThrow("new frozen protocol");
});

it("keeps the interrupted v2 ladder replay-only", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  expect(packageJson.scripts["causal:v2:pretest"]).toBeUndefined();
  expect(packageJson.scripts["causal:v2:replay"]).toContain(" replay ");
  const runner = readFileSync("scripts/causal-v2-pretest.ts", "utf8");
  expect(runner).not.toContain("fetch(");
  expect(runner).not.toContain("/api/chat");
});
