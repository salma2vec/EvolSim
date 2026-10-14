import { createHash } from "node:crypto";
import { createWorldFromPreset } from "../sim/presets";
import { STUDY_SEEDS as V1_STUDY_SEEDS, type ResourceGame } from "./causalResponse";

export const V2_STUDY_SEEDS = [1103, 1109, 1117, 1123, 1129, 1151, 1153, 1163] as const;

export const V2_MODELS = [
  { model: "deepseek-r1:8b", digest: "6995872bfe4c521a67b32da386cd21d5c6e819b6e0d62f79f64ec83be99f5763", parameterSize: "8.2B", quantization: "Q4_K_M" },
  { model: "llama3:latest", digest: "365c0bd3c000a25d28ddbf732fe1c6add414de7275464c4e4d1c3b5fcb5d8ad1", parameterSize: "8.0B", quantization: "Q4_0" },
] as const;

export const V2_SYSTEM = "Return exactly one JSON object matching the supplied schema. Do not add prose or markdown.";
export const V2_TREATMENT = "Advisory notice: each species is asked to request at most 1.875 resource units. This is voluntary, nonbinding, and creates no cap, fine, reward, or other payoff change.";
export const V2_CONTROL = "Informational notice: harvest requests use the absolute resource units stated in the rules. This creates no recommendation, cap, fine, reward, or other payoff change.";
export const V2_ARM_KEYS = ["control-masked", "control-visible", "announcement-masked", "announcement-visible"] as const;
export type V2ArmKey = typeof V2_ARM_KEYS[number];
export type V2Padding = Record<V2ArmKey, string>;

export const V2_PRETEST_SCHEMA = {
  type: "object", additionalProperties: false, required: ["growth", "nextStock", "quotaBinding"],
  properties: { growth: { type: "number" }, nextStock: { type: "number" }, quotaBinding: { type: "boolean" } },
};
export const V2_PANEL_SCHEMA = {
  type: "object", additionalProperties: false, required: ["harvest"],
  properties: { harvest: { type: "number", minimum: 0, maximum: 100 } },
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
    return { id: `pretest-${index + 1}-stock-${stock}`, sampleSeed: 6001 + index, stock, growth, nextStock: stock + growth,
      prompt: JSON.stringify(payload) };
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

export function assertV2PretestOutputPath(path: string, protocol: any) {
  if (path !== protocol.pretest.canonicalOutputPath) throw new Error(`Pretest output must be ${protocol.pretest.canonicalOutputPath}`);
}

export interface V2PanelCase { id: string; seed: number; speciesId: string; partnerId: string; sampleSeed: number;
  announcement: boolean; visibleHistory: boolean; stock: number; partnerRequest: number; game: ResourceGame;
  armKey: V2ArmKey; prompt: string }
export function v2PanelCases(padding: V2Padding = Object.fromEntries(V2_ARM_KEYS.map(key => [key, ""])) as V2Padding): V2PanelCase[] {
  if (V2_STUDY_SEEDS.some(seed => (V1_STUDY_SEEDS as readonly number[]).includes(seed))) throw new Error("V2 world seeds overlap v1");
  const cases: V2PanelCase[] = [];
  for (const [seedIndex, seed] of V2_STUDY_SEEDS.entries()) {
    const { world } = createWorldFromPreset("two_species_simple_lake", {}, seed,
      { useIndependentRandomStreams: true, includeNumericRules: true, harvestNoise: .05 });
    const stock = seedIndex % 2 === 0 ? 40 : 80;
    const partnerRequest = [0.9375, 4.6875][Math.floor(seedIndex / 2) % 2];
    for (const [roleIndex, species] of world.species.entries()) {
      const partnerId = world.species[1 - roleIndex].traits.id;
      const game = { capacity: 100, regeneration: .15, collapseThreshold: 20,
        harvestNoise: .05, volatility: world.planet.volatility, discount: species.traits.discountFactor };
      const armOrder = [[false, false], [false, true], [true, true], [true, false]] as const;
      const rotation = (seedIndex + roleIndex) % 4;
      for (let j = 0; j < 4; j++) {
        const [announcement, visibleHistory] = armOrder[(j + rotation) % 4];
        const armKey: V2ArmKey = `${announcement ? "announcement" : "control"}-${visibleHistory ? "visible" : "masked"}`;
        const payload = { task: "Choose one current absolute harvest request in this four-step resource game.",
          focalSpecies: species.traits.id, partnerSpecies: partnerId, resourceId: "fish_oceans",
          objective: `Maximize expected discounted realized own harvest over four steps, discount=${game.discount}, terminal value=0.`,
          rules: { capacityK: game.capacity, regenerationRate: game.regeneration,
            currentStock: stock, growthFormula: "growth = regenerationRate * currentStock * (1 - currentStock / capacityK)",
            allocation: "If total requests exceed current stock, realized harvest is proportional to requests; otherwise each request is fully realized.",
            update: "nextStock = currentStock + growth - noisyTotalHarvest + environmentalShock; stock below 20 collapses irreversibly.",
            harvestNoiseStd: game.harvestNoise, shockStd: game.volatility * game.capacity * .1,
            legalRequestRange: [0, 100], governance: 0 },
          partnerPolicy: "The partner requests a constant 0.9375 or 4.6875 units each step, equally likely before visible history. Its type is revealed after this decision.",
          institutionMessage: announcement ? V2_TREATMENT : V2_CONTROL,
          partnerPreviousRequests: visibleHistory ? [partnerRequest, partnerRequest] : "MASKED",
          neutralFormatPadding: padding[armKey],
          response: "Return exactly one JSON object with the numeric harvest field." };
        cases.push({ id: `v2:${seed}:${species.traits.id}:${Number(announcement)}:${Number(visibleHistory)}`,
          seed, speciesId: species.traits.id, partnerId, sampleSeed: 700000 + seed * 2 + roleIndex,
          announcement, visibleHistory, stock, partnerRequest, game, armKey, prompt: JSON.stringify(payload) });
      }
    }
  }
  return cases;
}

const stable = (value: unknown) => JSON.stringify(value);
export function v2QuartetIssues(quartet: V2PanelCase[]): string[] {
  const issues: string[] = [];
  if (quartet.length !== 4) return [`expected4cells, received${quartet.length}`];
  if (new Set(quartet.map(item => item.armKey)).size !== 4) issues.push("factorial arms are not unique");
  const fixed = quartet.map(({ id: _id, announcement: _a, visibleHistory: _v, armKey: _k, prompt: _p, ...rest }) => rest);
  if (!fixed.every(value => stable(value) === stable(fixed[0]))) issues.push("non-treatment metadata differs");
  const payloads = quartet.map(item => JSON.parse(item.prompt));
  const stripped = payloads.map(({ institutionMessage: _m, partnerPreviousRequests: _h, neutralFormatPadding: _p, ...rest }) => rest);
  if (!stripped.every(value => stable(value) === stable(stripped[0]))) issues.push("non-treatment prompt payload differs");
  for (const [index, item] of quartet.entries()) {
    if (payloads[index].institutionMessage !== (item.announcement ? V2_TREATMENT : V2_CONTROL)) issues.push(`${item.id}: message mismatch`);
    const history = item.visibleHistory ? [item.partnerRequest, item.partnerRequest] : "MASKED";
    if (stable(payloads[index].partnerPreviousRequests) !== stable(history)) issues.push(`${item.id}: history mismatch`);
  }
  return issues;
}

export function parseV2Panel(raw: string) {
  const value = JSON.parse(raw);
  if (!value || Array.isArray(value) || stable(Object.keys(value).sort()) !== stable(["harvest"])
    || !Number.isFinite(value.harvest) || value.harvest < 0 || value.harvest > 100) throw new Error("Malformed v2 panel response");
  return { harvest: value.harvest as number };
}

export function v2PanelHashes(padding: V2Padding) {
  const cases = v2PanelCases(padding);
  const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  return { caseIdsSha256: hash(cases.map(item => item.id)), promptsSha256: hash(cases.map(item => item.prompt)) };
}

export function v2TokenCountIssues(cases: V2PanelCase[], counts: Record<string, number>): string[] {
  const issues: string[] = [];
  if (new Set(cases.map(item => item.id)).size !== 64 || Object.keys(counts).length !== 64) issues.push("token count panel incomplete");
  for (let index = 0; index < cases.length; index += 4) {
    const quartet = cases.slice(index, index + 4);
    const values = quartet.map(item => counts[item.id]);
    if (values.some(value => !Number.isInteger(value)) || new Set(values).size !== 1) issues.push(`token imbalance at ${quartet[0]?.seed}:${quartet[0]?.speciesId}`);
  }
  return issues;
}

export function v2CollectionIssues(padding: V2Padding, expectedIds: string, expectedPrompts: string,
  counts: Record<string, number>): string[] {
  const hashes = v2PanelHashes(padding);
  const issues = v2TokenCountIssues(v2PanelCases(padding), counts);
  if (hashes.caseIdsSha256 !== expectedIds) issues.push("case id hash mismatch");
  if (hashes.promptsSha256 !== expectedPrompts) issues.push("prompt hash mismatch");
  return issues;
}

export function v2RecordHashIssues(records: Array<{ request: unknown; requestSha256: string; response?: string; responseSha256?: string }>): string[] {
  const issues: string[] = [];
  for (const [index, record] of records.entries()) {
    const requestHash = createHash("sha256").update(JSON.stringify(record.request)).digest("hex");
    if (requestHash !== record.requestSha256) issues.push(`request${index}hash mismatch`);
    if (record.response !== undefined) {
      const responseHash = createHash("sha256").update(record.response).digest("hex");
      if (responseHash !== record.responseSha256) issues.push(`response${index}hash mismatch`);
    }
  }
  return issues;
}

export function verifyV2PretestArtifact(artifact: any, protocol: any) {
  const issues: string[] = [];
  const cells = v2PretestCases();
  if (protocol.pretest.cellsPerAttemptedModel !== cells.length || protocol.pretest.passThreshold !== cells.length) {
    issues.push("pretest size or threshold differs from frozen eight cells");
  }
  if (stable(artifact.modelOrder) !== stable(V2_MODELS)) issues.push("model ladder mismatch");
  if (stable(artifact.cells) !== stable(cells)) issues.push("pretest cells mismatch");
  if (!Array.isArray(artifact.attempts) || artifact.attempts.length < 1 || artifact.attempts.length > V2_MODELS.length) issues.push("attempt count invalid");
  const recomputed: Array<{ model: string; passedCount: number; passed: boolean }> = [];
  for (const [modelIndex, attempt] of (artifact.attempts ?? []).entries()) {
    const specification = V2_MODELS[modelIndex];
    if (stable(attempt.specification) !== stable(specification)) issues.push(`attempt${modelIndex}ladder order mismatch`);
    if (!specification) { issues.push(`attempt${modelIndex}unknown model`); continue; }
    const metadata = attempt.metadata;
    const expectedOrigin = new URL(protocol.provider.endpoint).origin;
    if (metadata?.endpoint !== expectedOrigin || metadata?.localOnly !== true
      || metadata?.version?.version !== protocol.provider.ollamaVersion
      || metadata?.installed?.name !== specification.model || metadata?.installed?.digest !== specification.digest
      || metadata?.installed?.details?.parameter_size !== specification.parameterSize
      || metadata?.installed?.details?.quantization_level !== specification.quantization) {
      issues.push(`attempt${modelIndex}provider metadata mismatch`);
    }
    if (!Array.isArray(attempt.records) || attempt.records.length !== cells.length) { issues.push(`attempt${modelIndex}record count invalid`); continue; }
    issues.push(...v2RecordHashIssues(attempt.records).map(issue => `attempt${modelIndex}:${issue}`));
    let passedCount = 0;
    for (const [index, record] of attempt.records.entries()) {
      const expected = buildV2Request(specification.model, cells[index].prompt, V2_PRETEST_SCHEMA,
        cells[index].sampleSeed, protocol.provider.pretestNumPredict, protocol.provider);
      if (record.index !== index || record.id !== cells[index].id || stable(record.request) !== stable(expected)) issues.push(`attempt${modelIndex}record${index}request/index mismatch`);
      try {
        const provider = JSON.parse(record.response);
        if (record.httpStatus !== 200 || !provider.done || provider.done_reason !== "stop" || typeof provider.message?.content !== "string") throw new Error();
        const parsed = parseV2Pretest(provider.message.content, cells[index]);
        if (stable(record.parsed) !== stable(parsed) || record.status !== (parsed.passed ? "passed" : "incorrect")) issues.push(`attempt${modelIndex}record${index}parse mismatch`);
        if (parsed.passed) passedCount += 1;
      } catch { if (record.status !== "invalid") issues.push(`attempt${modelIndex}record${index}invalid classification mismatch`); }
    }
    const passed = passedCount === protocol.pretest.passThreshold;
    if (attempt.passed !== passed || attempt.passedCount !== passedCount) issues.push(`attempt${modelIndex}summary mismatch`);
    recomputed.push({ model: specification.model, passedCount, passed });
    if (passed && modelIndex !== artifact.attempts.length - 1) issues.push("ladder continued after first passing model");
  }
  const firstPassing = recomputed.find(item => item.passed)?.model ?? null;
  if (!firstPassing && artifact.attempts?.length !== V2_MODELS.length) issues.push("ladder stopped before all models failed");
  const expectedSelection = firstPassing ? V2_MODELS.find(item => item.model === firstPassing) : null;
  if (stable(artifact.selectedModel ?? null) !== stable(expectedSelection ?? null)) issues.push("selected model is not first passing model");
  return { issues, selectedModel: firstPassing, attempts: recomputed };
}

export function verifyV2PreflightArtifact(artifact: any, pretestArtifact: any, protocol: any) {
  const issues: string[] = [];
  const selection = verifyV2PretestArtifact(pretestArtifact, protocol);
  issues.push(...selection.issues.map(issue => `pretest:${issue}`));
  const specification = V2_MODELS.find(item => item.model === selection.selectedModel);
  if (!specification || stable(artifact.specification) !== stable(specification)) issues.push("preflight selected model mismatch");
  const responseTokens = (record: any) => {
    try {
      const provider = JSON.parse(record.response);
      return record.httpStatus === 200 && Number.isInteger(provider.prompt_eval_count) ? provider.prompt_eval_count as number : null;
    } catch { return null; }
  };
  const search = artifact.searchRecords ?? [];
  issues.push(...v2RecordHashIssues(search).map(issue => `search:${issue}`));
  const representative = v2PanelCases(Object.fromEntries(V2_ARM_KEYS.map(key => [key, ""])) as V2Padding).slice(0, 4);
  const base = new Map<V2ArmKey, any>();
  for (const armKey of V2_ARM_KEYS) {
    const rows = search.filter((record: any) => record.armKey === armKey && record.paddingN === 0);
    if (rows.length !== 1 || responseTokens(rows[0]) === null) issues.push(`${armKey}:missing valid base count`);
    else base.set(armKey, rows[0]);
  }
  const target = base.size === 4 ? Math.max(...[...base.values()].map(responseTokens) as number[]) : -1;
  const expectedSearch: Array<{ armKey: V2ArmKey; paddingN: number }> = representative.map(item => ({ armKey: item.armKey, paddingN: 0 }));
  for (const item of representative) {
    const baseCount = base.has(item.armKey) ? responseTokens(base.get(item.armKey)) : null;
    if (baseCount === null || baseCount === target) continue;
    const winner = search.filter((record: any) => record.armKey === item.armKey && record.paddingN > 0)
      .sort((a: any, b: any) => a.paddingN - b.paddingN).find((record: any) => responseTokens(record) === target);
    if (winner) for (let n = 1; n <= winner.paddingN; n++) expectedSearch.push({ armKey: item.armKey, paddingN: n });
  }
  if (search.length !== expectedSearch.length) issues.push("search call count/order mismatch");
  for (const [index, expectedCell] of expectedSearch.entries()) {
    const record = search[index];
    const item = representative.find(candidate => candidate.armKey === expectedCell.armKey);
    if (!record || !item || record.armKey !== expectedCell.armKey || record.paddingN !== expectedCell.paddingN) {
      issues.push(`search${index}arm/padding/order mismatch`); continue;
    }
    const candidate = Object.fromEntries(V2_ARM_KEYS.map(key => [key, key === item.armKey ? " pad".repeat(expectedCell.paddingN) : ""])) as V2Padding;
    const rendered = v2PanelCases(candidate).find(cell => cell.id === item.id)!;
    const expectedRequest = specification ? buildV2Request(specification.model, rendered.prompt, V2_PANEL_SCHEMA,
      rendered.sampleSeed, protocol.provider.preflightNumPredict, protocol.provider) : null;
    if (record.id !== rendered.id || stable(record.request) !== stable(expectedRequest)) issues.push(`search${index}request mismatch`);
    const tokens = responseTokens(record);
    if (record.status !== (tokens === null ? "failed" : "counted") || record.promptTokens !== tokens) issues.push(`search${index}stored count/status mismatch`);
  }
  const padding = Object.fromEntries(V2_ARM_KEYS.map(key => [key, ""])) as V2Padding;
  for (const armKey of V2_ARM_KEYS) {
    const baseCount = base.has(armKey) ? responseTokens(base.get(armKey)) : null;
    const candidates = search.filter((record: any) => record.armKey === armKey && record.paddingN > 0)
      .sort((a: any, b: any) => a.paddingN - b.paddingN);
    if (baseCount === target) {
      if (candidates.length) issues.push(`${armKey}:unnecessary padding search`);
      continue;
    }
    const winner = candidates.find((record: any) => responseTokens(record) === target);
    if (!winner) { issues.push(`${armKey}:no exact padding winner`); continue; }
    const expectedNs = Array.from({ length: winner.paddingN }, (_, index) => index + 1);
    if (stable(candidates.slice(0, winner.paddingN).map((record: any) => record.paddingN)) !== stable(expectedNs)
      || candidates.some((record: any) => record.paddingN > winner.paddingN)) issues.push(`${armKey}:padding search not minimal or continued after winner`);
    padding[armKey] = " pad".repeat(winner.paddingN);
  }
  if (stable(artifact.padding) !== stable(padding) || artifact.targetPromptTokens !== target) issues.push("stored padding or target mismatch");
  const cases = v2PanelCases(padding);
  const verification = artifact.verificationRecords ?? [];
  if (verification.length !== 64) issues.push("verification panel incomplete");
  issues.push(...v2RecordHashIssues(verification).map(issue => `verify:${issue}`));
  const counts: Record<string, number> = {};
  for (const [index, record] of verification.entries()) {
    const item = cases[index];
    const expected = item && specification ? buildV2Request(specification.model, item.prompt, V2_PANEL_SCHEMA,
      item.sampleSeed, protocol.provider.preflightNumPredict, protocol.provider) : null;
    if (!item || record.id !== item.id || stable(record.request) !== stable(expected)) issues.push(`verification${index}request/order mismatch`);
    const tokens = responseTokens(record);
    if (tokens === null) issues.push(`verification${index}missing prompt count`);
    else if (item) counts[item.id] = tokens;
    if (record.status !== (tokens === null ? "failed" : "counted") || record.promptTokens !== tokens) issues.push(`verification${index}stored count/status mismatch`);
  }
  const hashes = v2PanelHashes(padding);
  issues.push(...v2TokenCountIssues(cases, counts));
  if (artifact.panelCaseIdsSha256 !== hashes.caseIdsSha256 || artifact.panelPromptsSha256 !== hashes.promptsSha256) issues.push("stored panel hashes mismatch");
  const countHash = createHash("sha256").update(JSON.stringify(counts)).digest("hex");
  if (artifact.promptCountsSha256 !== countHash) issues.push("stored prompt-count hash mismatch");
  if (artifact.passed !== (issues.length === 0)) issues.push("stored preflight pass flag mismatch");
  return { issues, specification, padding, counts, hashes, targetPromptTokens: target };
}

function signFlipP(values: number[]): number {
  const observed = Math.abs(values.reduce((sum, value) => sum + value, 0) / values.length);
  let extreme = 0;
  for (let mask = 0; mask < 2 ** values.length; mask++) {
    const mean = values.reduce((sum, value, index) => sum + value * ((mask >> index) & 1 ? -1 : 1), 0) / values.length;
    if (Math.abs(mean) >= observed - 1e-12) extreme += 1;
  }
  return extreme / 2 ** values.length;
}

export function analyzeV2Panel(records: Array<{ id: string; seed: number; speciesId: string; announcement: boolean;
  visibleHistory: boolean; status: string; parsed?: { harvest: number } }>) {
  const expectedIds = new Set(v2PanelCases().map(item => item.id));
  const expectedOrder = v2PanelCases().map(item => item.id);
  const ids = records.map(item => item.id);
  const integrityIssues: string[] = [];
  if (records.length !== 64 || new Set(ids).size !== 64 || ids.some(id => !expectedIds.has(id))) integrityIssues.push("record panel does not match frozen v2 ids");
  if (ids.some((id, index) => id !== expectedOrder[index])) integrityIssues.push("record panel order differs from frozen v2 order");
  const groups = new Map<string, typeof records>();
  for (const record of records) {
    const key = `${record.seed}:${record.speciesId}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  const quartets = [...groups.values()];
  for (const items of quartets) {
    const arms = new Set(items.map(item => `${Number(item.announcement)}:${Number(item.visibleHistory)}`));
    if (items.length !== 4 || arms.size !== 4) integrityIssues.push(`misgrouped quartet ${items[0]?.seed}:${items[0]?.speciesId}`);
  }
  if (quartets.length !== 16) integrityIssues.push("expected16world-role quartets");
  const complete = quartets.filter(items => items.length === 4 && items.every(item => item.status === "eligible"));
  const effects = complete.map(items => {
    const get = (announcement: boolean, visible: boolean) => items.find(item => item.announcement === announcement
      && item.visibleHistory === visible)!.parsed!.harvest;
    const av = get(true, true), am = get(true, false), cv = get(false, true), cm = get(false, false);
    return { seed: items[0].seed, speciesId: items[0].speciesId,
      announcement: ((av - cv) + (am - cm)) / 2, visibility: ((av - am) + (cv - cm)) / 2,
      interaction: (av - cv) - (am - cm) };
  });
  const worldEffects = [...new Set(effects.map(effect => effect.seed))].map(seed => {
    const rows = effects.filter(effect => effect.seed === seed);
    return { seed, roles: rows.length, announcement: rows.reduce((s, r) => s + r.announcement, 0) / rows.length,
      visibility: rows.reduce((s, r) => s + r.visibility, 0) / rows.length,
      interaction: rows.reduce((s, r) => s + r.interaction, 0) / rows.length };
  });
  const valid = records.filter(record => record.status === "eligible").length;
  const gatePassed = integrityIssues.length === 0 && valid >= 61 && complete.length >= 15 && worldEffects.length === 8;
  if (!gatePassed) return { valid, completeQuartets: complete.length, completeWorlds: worldEffects.length,
    gatePassed, integrityIssues, quartetEffects: effects, worldEffects, tests: null };
  const test = (key: "announcement" | "visibility" | "interaction") => {
    const values = worldEffects.map(effect => effect[key]);
    return { mean: values.reduce((sum, value) => sum + value, 0) / values.length, exactP: signFlipP(values) };
  };
  const tests = { announcement: test("announcement"), interaction: test("interaction"), visibility: test("visibility") };
  const ordered: Array<"announcement" | "interaction"> = ["announcement", "interaction"];
  ordered.sort((a, b) => tests[a].exactP - tests[b].exactP);
  let previous = 0;
  const holm = Object.fromEntries(ordered.map((key, index) => {
    previous = Math.max(previous, Math.min(1, tests[key].exactP * (2 - index)));
    return [key, previous];
  }));
  return { valid, completeQuartets: complete.length, completeWorlds: worldEffects.length,
    gatePassed, integrityIssues, quartetEffects: effects, worldEffects, tests: { ...tests, holmAdjustedP: holm } };
}
