import { createHash } from "node:crypto";

export const V2_MODELS = [
  { model: "deepseek-r1:8b", digest: "6995872bfe4c521a67b32da386cd21d5c6e819b6e0d62f79f64ec83be99f5763", parameterSize: "8.2B", quantization: "Q4_K_M" },
  { model: "llama3:latest", digest: "365c0bd3c000a25d28ddbf732fe1c6add414de7275464c4e4d1c3b5fcb5d8ad1", parameterSize: "8.0B", quantization: "Q4_0" },
] as const;
export const V2_SYSTEM = "Return exactly one JSON object matching the supplied schema. Do not add prose or markdown.";
export const V2_PRETEST_SCHEMA = {
  type: "object", additionalProperties: false, required: ["growth", "nextStock", "quotaBinding"],
  properties: { growth: { type: "number" }, nextStock: { type: "number" }, quotaBinding: { type: "boolean" } },
};

export function buildV2Request(model: string, prompt: string, schema: unknown, sampleSeed: number,
  numPredict: number, provider: { temperature: number; numCtx: number }) {
  return { model, stream: false, think: false, messages: [
    { role: "system", content: V2_SYSTEM }, { role: "user", content: prompt }], format: schema, keep_alive: "5m",
    options: { temperature: provider.temperature, seed: sampleSeed, num_ctx: provider.numCtx, num_predict: numPredict } };
}

export interface V2PretestCase { id: string; sampleSeed: number; stock: number; growth: number; nextStock: number; prompt: string }
export function v2PretestCases(): V2PretestCase[] {
  return [20, 40, 60, 80, 80, 60, 40, 20].map((stock, index) => {
    const growth = .15 * stock * (1 - stock / 100);
    const payload = { task: "Numerical resource-rule comprehension only. Do not choose a harvest or strategy.",
      rules: { capacityK: 100, regenerationRate: .15, growthFormula: "growth = regenerationRate * currentStock * (1 - currentStock / capacityK)",
        currentStock: stock, update: "With no harvest and both noise draws equal to zero, nextStock = currentStock + growth." },
      institution: "No quota, cap, fine, reward, recommendation, or advisory exists in this pretest.",
      response: "Return growth, nextStock, and whether a quota mechanically binds." };
    return { id: `pretest-${index + 1}-stock-${stock}`, sampleSeed: 6001 + index, stock, growth,
      nextStock: stock + growth, prompt: JSON.stringify(payload) };
  });
}

export function parseV2Pretest(raw: string, item: V2PretestCase) {
  const value = JSON.parse(raw);
  const keys = value && !Array.isArray(value) ? Object.keys(value).sort() : [];
  if (JSON.stringify(keys) !== JSON.stringify(["growth", "nextStock", "quotaBinding"].sort())
    || !Number.isFinite(value.growth) || !Number.isFinite(value.nextStock) || typeof value.quotaBinding !== "boolean") {
    throw new Error("Malformed v2 pretest response");
  }
  const passed = Math.abs(value.growth - item.growth) <= .01 && Math.abs(value.nextStock - item.nextStock) <= .01
    && value.quotaBinding === false;
  return { growth: value.growth as number, nextStock: value.nextStock as number,
    quotaBinding: value.quotaBinding as boolean, passed };
}

const stable = (value: unknown) => JSON.stringify(value);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export function auditV2PretestArtifact(artifact: any, protocol: any) {
  const issues: string[] = [];
  const cells = v2PretestCases();
  if (protocol.pretest.cellsPerAttemptedModel !== 8 || protocol.pretest.passThreshold !== 8 || cells.length !== 8) {
    issues.push("pretest size or threshold differs from frozen eight cells");
  }
  if (stable(artifact.modelOrder) !== stable(V2_MODELS) || stable(artifact.cells) !== stable(cells)) issues.push("frozen ladder or cells mismatch");
  if (!Array.isArray(artifact.attempts) || artifact.attempts.length < 1 || artifact.attempts.length > 2) issues.push("attempt count invalid");
  const attempts: Array<{ model: string; records: number; passed: number; incorrect: number; invalid: number; started: number }> = [];
  let requestHashesVerified = 0, responseHashesVerified = 0, responsesReparsed = 0;
  for (const [modelIndex, attempt] of (artifact.attempts ?? []).entries()) {
    const specification = V2_MODELS[modelIndex];
    if (!specification || stable(attempt.specification) !== stable(specification)) { issues.push(`attempt${modelIndex}ladder order mismatch`); continue; }
    const metadata = attempt.metadata;
    if (metadata?.endpoint !== new URL(protocol.provider.endpoint).origin || metadata?.localOnly !== true
      || metadata?.version?.version !== protocol.provider.ollamaVersion
      || metadata?.installed?.name !== specification.model || metadata?.installed?.digest !== specification.digest
      || metadata?.installed?.details?.parameter_size !== specification.parameterSize
      || metadata?.installed?.details?.quantization_level !== specification.quantization) issues.push(`attempt${modelIndex}provider metadata mismatch`);
    if (!Array.isArray(attempt.records) || attempt.records.length > 8 || (modelIndex === 0 && attempt.records.length !== 8)) {
      issues.push(`attempt${modelIndex}record count invalid`); continue;
    }
    const counts = { model: specification.model, records: attempt.records.length, passed: 0, incorrect: 0, invalid: 0, started: 0 };
    for (const [index, record] of attempt.records.entries()) {
      const cell = cells[index];
      const expected = buildV2Request(specification.model, cell.prompt, V2_PRETEST_SCHEMA, cell.sampleSeed,
        protocol.provider.pretestNumPredict, protocol.provider);
      if (record.index !== index || record.id !== cell.id || stable(record.request) !== stable(expected)
        || record.requestSha256 !== hash(stable(record.request))) issues.push(`attempt${modelIndex}record${index}request/index/hash mismatch`);
      else requestHashesVerified++;
      if (record.response !== undefined) {
        if (record.responseSha256 !== hash(record.response)) issues.push(`attempt${modelIndex}record${index}response hash mismatch`);
        else responseHashesVerified++;
        try {
          const provider = JSON.parse(record.response);
          if (record.httpStatus !== 200 || !provider.done || provider.done_reason !== "stop" || typeof provider.message?.content !== "string") throw new Error();
          const parsed = parseV2Pretest(provider.message.content, cell); responsesReparsed++;
          const expectedStatus = parsed.passed ? "passed" : "incorrect";
          if (record.status !== expectedStatus || stable(record.parsed) !== stable(parsed)) issues.push(`attempt${modelIndex}record${index}parse/status mismatch`);
        } catch { if (record.status !== "invalid") issues.push(`attempt${modelIndex}record${index}invalid classification mismatch`); }
      } else if (record.status === "started") {
        if (record.error !== undefined || record.elapsedMs !== undefined) issues.push(`attempt${modelIndex}record${index}started row contains completion fields`);
      } else if (record.status === "invalid") {
        if (typeof record.error !== "string" || typeof record.elapsedMs !== "number") issues.push(`attempt${modelIndex}record${index}transport failure evidence missing`);
      } else issues.push(`attempt${modelIndex}record${index}has no response for status ${record.status}`);
      if (record.status in counts) (counts as any)[record.status]++;
    }
    const passedCount = attempt.records.filter((record: any) => record.status === "passed").length;
    if (attempt.passedCount !== passedCount || attempt.passed !== (passedCount === 8)) issues.push(`attempt${modelIndex}stored summary mismatch`);
    attempts.push(counts);
  }
  const complete = artifact.finishedAt !== undefined && artifact.finishedAt !== null
    && attempts.length > 0 && attempts.every((attempt, index) => attempt.records === 8 || index < attempts.length - 1);
  const firstPassing = attempts.find(attempt => attempt.passed === 8)?.model ?? null;
  if (artifact.selectedModel !== null && artifact.selectedModel?.model !== firstPassing) issues.push("selected model mismatch");
  if (!complete && artifact.selectedModel !== null) issues.push("interrupted artifact cannot select a model");
  return { issues, complete, interrupted: !complete, selectedModel: complete ? firstPassing : null, attempts,
    requestHashesVerified, responseHashesVerified, responsesReparsed };
}

export function verifyV2PretestArtifact(artifact: any, protocol: any) {
  const audit = auditV2PretestArtifact(artifact, protocol);
  const issues = [...audit.issues];
  if (!audit.complete) issues.push("pretest ladder incomplete");
  return { ...audit, issues };
}

export interface FutureStrategicCase { id: string; prompt: string; seed: number; speciesId: string; announcement: boolean; visibleHistory: boolean }
export interface FutureStrategicRecord extends FutureStrategicCase { request: any; requestSha256: string; response?: string; responseSha256?: string }
export function futureV2StrategicPromotionIssues(cases: FutureStrategicCase[], records: FutureStrategicRecord[]): string[] {
  const issues: string[] = [];
  if (cases.length !== 64 || new Set(cases.map(item => item.prompt)).size !== 64) issues.push("all 64 analysis units must expose distinct frozen world states to the model");
  if (records.length !== cases.length) issues.push("raw record panel incomplete");
  for (const [index, item] of cases.entries()) {
    const record = records[index];
    if (!record || record.id !== item.id || record.seed !== item.seed || record.speciesId !== item.speciesId
      || record.announcement !== item.announcement || record.visibleHistory !== item.visibleHistory) {
      issues.push(`record${index} metadata differs from canonical case`); continue;
    }
    const userPrompt = record.request?.messages?.find((message: any) => message.role === "user")?.content;
    if (userPrompt !== item.prompt || record.requestSha256 !== hash(stable(record.request))) issues.push(`record${index} raw request differs from canonical case`);
    if (record.response !== undefined && record.responseSha256 !== hash(record.response)) issues.push(`record${index} raw response hash mismatch`);
  }
  return issues;
}
