import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { analyzeV2Panel, buildV2Request, parseV2Pretest, V2_MODELS, V2_PRETEST_SCHEMA, V2_STUDY_SEEDS,
  v2CollectionIssues, v2PanelCases, v2PanelHashes, v2PretestCases, v2QuartetIssues,
  v2RecordHashIssues, v2TokenCountIssues, verifyV2PretestArtifact } from "@/lib/research/causalResponseV2";
import { STUDY_SEEDS } from "@/lib/research/causalResponse";

it("freezes eight comprehension-only pretest cells with exact expected arithmetic", () => {
  const cells = v2PretestCases();
  expect(cells).toHaveLength(8);
  expect(new Set(cells.map(cell => cell.id)).size).toBe(8);
  for (const cell of cells) {
    expect(cell.prompt).not.toContain("harvest request");
    expect(cell.prompt).not.toContain("partner");
    expect(parseV2Pretest(JSON.stringify({ growth: cell.growth, nextStock: cell.nextStock, quotaBinding: false }), cell).passed).toBe(true);
    expect(parseV2Pretest(JSON.stringify({ growth: .15, nextStock: cell.stock, quotaBinding: false }), cell).passed).toBe(false);
  }
});

it("recomputes pretest selection from raw responses and rejects tampering", () => {
  const protocol = { pretest: { passThreshold: 8 }, provider: { temperature: 0, numCtx: 8192, pretestNumPredict: 128 } };
  const cells = v2PretestCases();
  const records = cells.map((cell, index) => {
    const request = buildV2Request(V2_MODELS[0].model, cell.prompt, V2_PRETEST_SCHEMA, cell.sampleSeed,
      protocol.provider.pretestNumPredict, protocol.provider);
    const content = JSON.stringify({ growth: cell.growth, nextStock: cell.nextStock, quotaBinding: false });
    const response = JSON.stringify({ done: true, done_reason: "stop", message: { content } });
    return { index, id: cell.id, request, requestSha256: createHash("sha256").update(JSON.stringify(request)).digest("hex"),
      httpStatus: 200, response, responseSha256: createHash("sha256").update(response).digest("hex"),
      parsed: parseV2Pretest(content, cell), status: "passed" };
  });
  const artifact = { modelOrder: V2_MODELS, cells, attempts: [{ specification: V2_MODELS[0], records,
    passed: true, passedCount: 8 }], selectedModel: V2_MODELS[0] };
  expect(verifyV2PretestArtifact(artifact, protocol).issues).toEqual([]);
  const tampered = structuredClone(artifact);
  tampered.attempts[0].records[0].response = JSON.stringify({ done: true, done_reason: "stop",
    message: { content: JSON.stringify({ growth: 0, nextStock: 0, quotaBinding: false }) } });
  expect(verifyV2PretestArtifact(tampered, protocol).issues).not.toEqual([]);
});

it("isolates only message, history, and neutral padding within every v2 quartet", () => {
  const cells = v2PanelCases({ "control-masked": " pad", "control-visible": "", "announcement-masked": " pad pad", "announcement-visible": " pad" });
  expect(cells).toHaveLength(64);
  for (let index = 0; index < cells.length; index += 4) expect(v2QuartetIssues(cells.slice(index, index + 4))).toEqual([]);
  const changed = structuredClone(cells.slice(0, 4));
  const payload = JSON.parse(changed[0].prompt); payload.rules.currentStock += 1; changed[0].prompt = JSON.stringify(payload);
  expect(v2QuartetIssues(changed)).not.toEqual([]);
  expect(V2_STUDY_SEEDS.some(seed => STUDY_SEEDS.includes(seed))).toBe(false);
});

it("fails closed on token imbalance, padding tampering, and response tampering", () => {
  const padding = { "control-masked": " pad", "control-visible": "", "announcement-masked": " pad pad", "announcement-visible": " pad" };
  const cases = v2PanelCases(padding);
  const counts = Object.fromEntries(cases.map(item => [item.id, 500]));
  expect(v2TokenCountIssues(cases, counts)).toEqual([]);
  counts[cases[0].id] = 501;
  expect(v2TokenCountIssues(cases, counts)).not.toEqual([]);
  counts[cases[0].id] = 500;
  const hashes = v2PanelHashes(padding);
  expect(v2CollectionIssues(padding, hashes.caseIdsSha256, hashes.promptsSha256, counts)).toEqual([]);
  expect(v2CollectionIssues({ ...padding, "control-masked": "tampered" }, hashes.caseIdsSha256, hashes.promptsSha256, counts)).not.toEqual([]);
  const request = { prompt: "fixed" }, response = '{"harvest":1}';
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const records = [{ request, requestSha256: hash(JSON.stringify(request)), response, responseSha256: hash(response) }];
  expect(v2RecordHashIssues(records)).toEqual([]);
  records[0].response = '{"harvest":2}';
  expect(v2RecordHashIssues(records)).not.toEqual([]);
});

it("computes frozen quartet estimands and exact world tests only after the gate", () => {
  const cases = v2PanelCases();
  const records = cases.map(item => ({ ...item, status: "eligible", parsed: { harvest:
    10 + Number(item.announcement) * 2 + Number(item.visibleHistory) * 3 + Number(item.announcement && item.visibleHistory) * 4 } }));
  const result = analyzeV2Panel(records);
  expect(result.gatePassed).toBe(true);
  expect(result.tests?.announcement.mean).toBe(4);
  expect(result.tests?.visibility.mean).toBe(5);
  expect(result.tests?.interaction.mean).toBe(4);
  expect(result.tests?.holmAdjustedP).toBeDefined();
  records[0].status = "failed"; records[4].status = "failed";
  expect(analyzeV2Panel(records).gatePassed).toBe(false);
  const misgrouped = cases.map(item => ({ ...item, status: "eligible", parsed: { harvest: 10 } }));
  misgrouped[0].speciesId = "wrong-role";
  expect(analyzeV2Panel(misgrouped).gatePassed).toBe(false);
  expect(analyzeV2Panel(misgrouped).integrityIssues).not.toEqual([]);
});
