import { it, expect, afterEach, vi } from "vitest";
import { runSimulation } from "@/lib/server/simulation";
import { getAvailablePresets, createWorldFromPreset } from "@/lib/sim/presets";
import { authorize, readJSON } from "@/lib/server/api";
import { validateBatch } from "@/lib/utils/batch";
import { resolveHarvests } from "@/lib/sim/dynamics";
import { callLLM } from "@/lib/llm/client";
import { parseLLMResponse } from "@/lib/llm/parseActions";
vi.mock("@/lib/llm/client", () => ({ callLLM: vi.fn(() => { throw new Error("provider unavailable"); }) }));

afterEach(() => { delete process.env.EVOLSIM_API_TOKEN; delete process.env.EVOLSIM_ENABLE_LLM; vi.clearAllMocks(); });

it("replays the same seed and isolates interleaved runs", async () => {
  const a = await runSimulation("two_species_simple_lake", 10, 11);
  const b = await runSimulation("two_species_simple_lake", 10, 71);
  const [parallelA, parallelB] = await Promise.all([runSimulation("two_species_simple_lake",10,11),runSimulation("two_species_simple_lake",10,71)]);
  expect(parallelA.history).toEqual(a.history);
  expect(parallelB.history).toEqual(b.history);
  expect(a.provenance.trajectorySha256).not.toEqual(b.provenance.trajectorySha256);
  expect(callLLM).not.toHaveBeenCalled();
});

it.each(getAvailablePresets())("runs preset %s with finite state and no provider calls", async preset => {
  const result = await runSimulation(preset, 25, 42);
  expect(result.history.length).toBeGreaterThan(1);
  for (const state of result.history) for (const r of state.resources) expect(Number.isFinite(r.amount) && r.amount >= 0).toBe(true);
  expect(callLLM).not.toHaveBeenCalled();
});

it("honors zero resource allocation instead of restoring demand", () => {
  const {world} = createWorldFromPreset("two_species_simple_lake", {}, 42);
  const resource = {...world.resources[0], amount: 0};
  const species = world.species[0];
  const result = resolveHarvests({[species.traits.id]: {[resource.def.id]: 100}}, [resource], world.species);
  expect(result[species.traits.id][resource.def.id]).toBe(0);
});

it("rejects live calls by default and authenticates before execution", () => {
  expect(() => authorize(new Request("http://localhost"), true)).toThrow("enablement");
  process.env.EVOLSIM_ENABLE_LLM = "true";
  process.env.EVOLSIM_API_TOKEN = "a".repeat(32);
  expect(() => authorize(new Request("http://localhost"), true)).toThrow("Unauthorized");
  expect(() => authorize(new Request("http://localhost", {headers:{authorization:`Bearer ${"a".repeat(32)}`}}), true)).not.toThrow();
});

it("rejects over-budget and malformed batch input", () => {
  expect(() => validateBatch({presetId:"two_species_simple_lake", numSteps:1e9, runs:20})).toThrow();
  expect(() => validateBatch({presetId:"two_species_simple_lake", numSteps:10, runs:2, seeds:[42]})).toThrow();
  expect(() => validateBatch({presetId:"two_species_simple_lake", numSteps:10, runs:1, configOverrides:[{useBaselineAgents:false}]})).toThrow("baseline");
});

it("limits bodies while streaming and rejects invalid JSON", async () => {
  await expect(readJSON(new Request("http://localhost",{method:"POST",body:"x".repeat(100)}),10)).rejects.toThrow("too large");
  await expect(readJSON(new Request("http://localhost",{method:"POST",body:"broken"}))).rejects.toThrow("Invalid JSON");
});

it("live provider failure aborts without substitute trajectories", async () => {
  const {world} = createWorldFromPreset("two_species_simple_lake", {}, 42);
  const models = Object.fromEntries(world.species.map(s => [s.traits.id, "explicit-model"]));
  await expect(runSimulation("two_species_simple_lake",1,42,models,{useBaselineAgents:false})).rejects.toThrow("provider unavailable");
});

it.each(["nonsense", "[]", '{"harvest": [1,2]}', '{"harvest":{"x":"5"}}'])("invalid model decision fails closed: %s", text => {
  expect(() => parseLLMResponse(text,"species",true)).toThrow();
});
