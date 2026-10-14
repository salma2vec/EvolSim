/** One frozen, failure-inclusive local panel. Never downloads, retries, or repairs. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseStudyResponse, STUDY_SCHEMA, studyCases } from "../lib/research/causalResponse";

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const manifest = JSON.parse(readFileSync("docs/CAUSAL_RESPONSE_RUN.json", "utf8"));
const origin = "http://127.0.0.1:11434";
const output = process.argv[2] || "results/causal-response-qwen25coder15b.json";
const cells = studyCases();

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
    if (bytes > 1024 * 1024) { await reader.cancel(); throw new Error("Response exceeds 1MiB"); }
    chunks.push(chunk.value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  let parsed: any;
  try { parsed = JSON.parse(raw); } catch { parsed = null; }
  return { status: response.status, raw, parsed };
}

function classify(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("syntax:")) return "syntax";
  if (message.startsWith("semantic:")) return "semantic";
  if (message.startsWith("truncation:")) return "truncation";
  if (message.startsWith("provider:")) return "provider";
  return "transport";
}

async function main() {
  if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()) {
    throw new Error("Commit the frozen run manifest, runner, and offline audit before model calls");
  }
  const idsHash = sha256(JSON.stringify(cells.map(cell => cell.id)));
  const promptsHash = sha256(JSON.stringify(cells.map(cell => cell.prompt)));
  if (cells.length !== manifest.panel.calls || idsHash !== manifest.panel.caseIdsSha256 || promptsHash !== manifest.panel.promptsSha256) {
    throw new Error("Frozen panel hash mismatch");
  }
  const version = await local("/api/version");
  const tags = await local("/api/tags");
  const installed = tags.parsed?.models?.find((item: any) => item.name === manifest.provider.model);
  if (version.parsed?.version !== manifest.provider.ollamaVersion || installed?.digest !== manifest.provider.digest
    || installed?.details?.parameter_size !== manifest.provider.parameterSize
    || installed?.details?.quantization_level !== manifest.provider.quantization || manifest.provider.model.includes("cloud")) {
    throw new Error("Frozen local provider/model metadata mismatch; no calls made");
  }
  const details = await local("/api/show", { model: manifest.provider.model });
  if (details.parsed?.remote_host || details.parsed?.remote_model) throw new Error("Cloud-backed model forbidden");

  const records: Array<Record<string, any>> = [];
  const artifact: Record<string, any> = {
    artifactVersion: "causal-response-panel-v1", runId: manifest.runId, mode: "local-model-single-panel",
    startedAt: new Date().toISOString(), sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    runManifest: manifest, runManifestSha256: sha256(readFileSync("docs/CAUSAL_RESPONSE_RUN.json")),
    instrumentArtifactSha256: sha256(readFileSync(manifest.offlineAudit.artifact)),
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    provider: { version: version.parsed, installed, templateSha256: sha256(details.parsed?.template ?? ""),
      parametersSha256: sha256(details.parsed?.parameters ?? "") }, records,
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(artifact, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  const save = () => {
    const temporary = `${output}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(artifact, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    renameSync(temporary, output);
  };

  for (const [index, cell] of cells.entries()) {
    const request = { model: manifest.provider.model, stream: false,
      messages: [
        { role: "system", content: manifest.request.system },
        { role: "user", content: cell.prompt },
      ], format: STUDY_SCHEMA, keep_alive: manifest.request.keepAlive,
      options: { temperature: manifest.request.temperature, seed: cell.sampleSeed,
        num_ctx: manifest.request.numCtx, num_predict: manifest.request.numPredict } };
    const record: Record<string, any> = { index, id: cell.id, seed: cell.seed, speciesId: cell.speciesId,
      announcement: cell.announcement, visibleHistory: cell.visibleHistory, partnerRequest: cell.partnerRequest,
      sampleSeed: cell.sampleSeed, request, requestSha256: sha256(JSON.stringify(request)),
      status: "started", startedAt: new Date().toISOString() };
    records.push(record); save();
    const started = performance.now();
    try {
      const result = await local("/api/chat", request, manifest.request.timeoutMs);
      Object.assign(record, { httpStatus: result.status, response: result.raw, responseSha256: sha256(result.raw),
        providerDone: result.parsed?.done, doneReason: result.parsed?.done_reason,
        promptTokens: result.parsed?.prompt_eval_count ?? null, generatedTokens: result.parsed?.eval_count ?? null });
      if (result.status !== 200 || !result.parsed) throw new Error(`provider: HTTP${result.status} or invalid provider JSON`);
      if (!result.parsed.done || result.parsed.done_reason !== "stop") throw new Error(`truncation: done=${result.parsed.done} reason=${result.parsed.done_reason}`);
      if (typeof result.parsed.message?.content !== "string") throw new Error("provider: missing message content");
      let parsed;
      try { parsed = parseStudyResponse(result.parsed.message.content, cell); }
      catch (error) {
        const message = error instanceof SyntaxError ? "syntax" : "semantic";
        throw new Error(`${message}: ${error instanceof Error ? error.message : String(error)}`);
      }
      Object.assign(record, { parsed, status: parsed.comprehensionPassed ? "eligible" : "comprehension",
        failureCategory: parsed.comprehensionPassed ? null : "comprehension" });
    } catch (error) {
      record.status = "failed";
      record.failureCategory = classify(error);
      record.error = error instanceof Error ? error.message : String(error);
    }
    record.elapsedMs = performance.now() - started;
    save();
    console.log(JSON.stringify({ completed: index + 1, total: cells.length, id: cell.id,
      status: record.status, failureCategory: record.failureCategory }));
  }

  const eligible = records.filter(record => record.status === "eligible");
  const quartets = Array.from({ length: 16 }, (_, index) => records.slice(index * 4, index * 4 + 4));
  const completeQuartets = quartets.filter(quartet => quartet.every(record => record.status === "eligible"));
  const categories = Object.fromEntries(manifest.accounting.failureCategories.map((category: string) =>
    [category, records.filter(record => record.failureCategory === category).length]));
  const promptPairDeltas: number[] = [];
  for (const quartet of quartets) for (const visible of [false, true]) {
    const pair = quartet.filter(record => record.visibleHistory === visible);
    if (pair.every(record => Number.isInteger(record.promptTokens))) promptPairDeltas.push(pair[0].promptTokens - pair[1].promptTokens);
  }
  const interpretationGatePassed = eligible.length / records.length >= manifest.accounting.minimumEligibleRate
    && quartets.length - completeQuartets.length <= manifest.accounting.maximumIncompleteQuartets;
  artifact.summary = { attempted: records.length, eligible: eligible.length, eligibleRate: eligible.length / records.length,
    completeQuartets: completeQuartets.length, incompleteQuartets: quartets.length - completeQuartets.length,
    categories, nativePromptTokenPairDeltas: promptPairDeltas,
    nativePromptTokensBalanced: promptPairDeltas.length === 32 && promptPairDeltas.every(value => value === 0),
    interpretationGatePassed, externalIndependentScientificReview: false,
    promotionGatePassed: interpretationGatePassed && manifest.review.externalIndependentScientificReview,
    estimands: interpretationGatePassed ? "eligible for frozen paired analysis; no analysis implemented in this collection runner" : null,
    interpretation: interpretationGatePassed
      ? "Collection gates passed, but scientific promotion remains blocked pending genuinely independent review and repeated worlds."
      : "Strategic interpretation is blocked. Invalid, misunderstood, or incomplete cells remain in the denominator and are not recoded as behavior." };
  artifact.finishedAt = new Date().toISOString(); save();
  console.log(JSON.stringify(artifact.summary, null, 2));
  if (records.length !== manifest.panel.calls) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
