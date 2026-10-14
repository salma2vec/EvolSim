/** Frozen v2 comprehension-only model ladder and offline replay. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildV2Request, parseV2Pretest, V2_MODELS, V2_PRETEST_SCHEMA, v2PretestCases,
  verifyV2PretestArtifact } from "../lib/research/causalResponseV2";

const origin = "http://127.0.0.1:11434";
const manifestPath = "docs/CAUSAL_RESPONSE_V2_MANIFEST.json";
const manifestBytes = readFileSync(manifestPath);
const protocol = JSON.parse(manifestBytes.toString("utf8"));
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const clean = () => {
  if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()) {
    throw new Error("Commit the frozen v2 pretest before provider calls");
  }
};
const startArtifact = (path: string, value: unknown) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
};
const checkpoint = (path: string, value: unknown) => {
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  renameSync(temporary, path);
};

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
  let parsed: any;
  try { parsed = JSON.parse(raw); } catch { parsed = null; }
  return { status: response.status, raw, parsed };
}

async function metadata(specification: typeof V2_MODELS[number]) {
  const [version, tags, details] = await Promise.all([local("/api/version"), local("/api/tags"), local("/api/show", { model: specification.model })]);
  const installed = tags.parsed?.models?.find((item: any) => item.name === specification.model);
  if (version.parsed?.version !== protocol.provider.ollamaVersion || installed?.digest !== specification.digest
    || installed?.details?.parameter_size !== specification.parameterSize
    || installed?.details?.quantization_level !== specification.quantization
    || details.parsed?.remote_host || details.parsed?.remote_model || specification.model.includes("cloud")) {
    throw new Error(`Frozen local metadata mismatch for ${specification.model}`);
  }
  return { endpoint: origin, localOnly: true, version: version.parsed, installed,
    templateSha256: sha256(details.parsed?.template ?? ""), parametersSha256: sha256(details.parsed?.parameters ?? "") };
}

async function call(body: unknown) {
  const started = performance.now();
  try {
    const result = await local("/api/chat", body, protocol.provider.timeoutMs);
    return { httpStatus: result.status, response: result.raw, responseSha256: sha256(result.raw),
      elapsedMs: performance.now() - started };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), elapsedMs: performance.now() - started };
  }
}

async function run(output: string) {
  clean();
  const cells = v2PretestCases();
  const artifact: any = { artifactVersion: "causal-v2-pretest-v1", startedAt: new Date().toISOString(),
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), manifestPath,
    manifestSha256: sha256(manifestBytes), modelOrder: V2_MODELS, cells, attempts: [], selectedModel: null };
  startArtifact(output, artifact);
  for (const specification of V2_MODELS) {
    const attempt: any = { specification, metadata: await metadata(specification), records: [], passed: false, passedCount: 0 };
    artifact.attempts.push(attempt); checkpoint(output, artifact);
    for (const [index, item] of cells.entries()) {
      const request = buildV2Request(specification.model, item.prompt, V2_PRETEST_SCHEMA, item.sampleSeed,
        protocol.provider.pretestNumPredict, protocol.provider);
      const record: any = { index, id: item.id, request, requestSha256: sha256(JSON.stringify(request)), status: "started" };
      attempt.records.push(record); checkpoint(output, artifact);
      const result: any = await call(request); Object.assign(record, result);
      try {
        const provider = JSON.parse(result.response);
        if (result.error || result.httpStatus !== 200 || !provider.done || provider.done_reason !== "stop"
          || typeof provider.message?.content !== "string") throw new Error("provider response incomplete");
        record.parsed = parseV2Pretest(provider.message.content, item);
        record.status = record.parsed.passed ? "passed" : "incorrect";
      } catch (error) { record.status = "invalid"; record.parseError = error instanceof Error ? error.message : String(error); }
      checkpoint(output, artifact);
      console.log(JSON.stringify({ model: specification.model, completed: index + 1, total: cells.length, status: record.status }));
    }
    attempt.passedCount = attempt.records.filter((record: any) => record.status === "passed").length;
    attempt.passed = attempt.passedCount === protocol.pretest.passThreshold;
    if (attempt.passed) { artifact.selectedModel = specification; break; }
  }
  artifact.finishedAt = new Date().toISOString();
  const verified = verifyV2PretestArtifact(artifact, protocol);
  artifact.integrity = { recomputedFromRawResponses: true, issues: verified.issues };
  artifact.summary = { selectedModel: verified.selectedModel, attempts: verified.attempts,
    next: verified.selectedModel && verified.issues.length === 0
      ? "Commit this evidence; strategic calibration and collection remain unauthorized until separately frozen."
      : "Stop; no model is authorized for strategic calibration or collection." };
  checkpoint(output, artifact);
  if (verified.issues.length) throw new Error(`Pretest integrity failure: ${verified.issues.join("; ")}`);
  console.log(JSON.stringify(artifact.summary, null, 2));
}

function replay(path: string) {
  const bytes = readFileSync(path), artifact = JSON.parse(bytes.toString("utf8"));
  assert.equal(artifact.artifactVersion, "causal-v2-pretest-v1");
  assert.equal(artifact.manifestSha256, sha256(manifestBytes));
  execFileSync("git", ["cat-file", "-e", `${artifact.sourceCommit}^{commit}`]);
  const verified = verifyV2PretestArtifact(artifact, protocol);
  assert.deepEqual(verified.issues, []);
  const records = artifact.attempts.flatMap((attempt: any) => attempt.records);
  console.log(JSON.stringify({ artifact: path, artifactSha256: sha256(bytes), inferenceCalls: 0,
    requestHashesVerified: records.length, responseHashesVerified: records.length,
    responsesReparsed: records.length, selectedModel: verified.selectedModel }, null, 2));
}

const [mode, path] = process.argv.slice(2);
if (mode === "run" && path) await run(path);
else if (mode === "replay" && path) replay(path);
else throw new Error("Usage: causal:v2:pretest run <exclusive-output> | causal:v2:pretest replay <artifact>");
