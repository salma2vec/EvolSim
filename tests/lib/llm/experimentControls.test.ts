import { beforeEach, expect, it, vi } from "vitest";
import { callLLM } from "@/lib/llm/client";
import { buildNumericResourceRules } from "@/lib/llm/numericRules";
import { runSimulation } from "@/lib/server/simulation";
import { createWorldFromPreset } from "@/lib/sim/presets";
import { buildObservation } from "@/lib/sim/gameLoop";
import { getExogenousRNG, getRNG, setRNGSeed } from "@/lib/sim/random";
import { updateResources } from "@/lib/sim/dynamics";
import { validateSimConfig } from "@/lib/utils/validation";

vi.mock("@/lib/llm/client", () => ({ callLLM: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
const models = { species_0: "fixture", species_1: "fixture" };

function policy(treaty: boolean) {
  let calls = 0;
  return async () => JSON.stringify({ harvest: { fish_oceans: 1 }, relations: {},
    governance: { punishment_strength: 0, monitoring_investment: 0 }, communication: [],
    treatyProposal: treaty ? { targetSpeciesId: calls++ % 2 === 0 ? "species_1" : "species_0", text: "Coordination note." } : null });
}

it("holds physical noise and resource observations fixed across administrative treaty draws", async () => {
  async function run(treaty: boolean, keyed: boolean) {
    vi.mocked(callLLM).mockImplementation(policy(treaty));
    return runSimulation("two_species_simple_lake", 3, 1009, models,
      { useBaselineAgents: false, useIndependentRandomStreams: keyed });
  }
  const plain = await run(false, true), treaty = await run(true, true);
  expect(treaty.history[1].events.some(e => e.type === "TREATY")).toBe(true);
  expect(treaty.history.map(w => w.resources)).toEqual(plain.history.map(w => w.resources));
  const a = plain.history[2], b = treaty.history[2];
  const observedA = buildObservation(a.species[0], a, plain.history, plain.config);
  for (let i = 0; i < 100; i++) getRNG().random();
  const observedB = buildObservation(b.species[0], b, treaty.history, treaty.config);
  expect(observedB.resourceEstimates).toEqual(observedA.resourceEstimates);
  // Positive control: the legacy shared stream really is shifted by treaty IDs.
  const oldPlain = await run(false, false), oldTreaty = await run(true, false);
  expect(oldTreaty.history[1].resources).not.toEqual(oldPlain.history[1].resources);
});

it("keys physical draws by step and resource rather than iteration or administrative order", () => {
  const { world, config } = createWorldFromPreset("two_species_simple_lake", {}, 1009,
    { useIndependentRandomStreams: true });
  const extra = { ...world.resources[0], def: { ...world.resources[0].def, id: "extra" } };
  const resources = [...world.resources, extra];
  const first = updateResources(resources, { fish_oceans: 2, extra: 2 }, world.planet, config, 4);
  const reversed = updateResources([...resources].reverse(), { fish_oceans: 2, extra: 2 }, world.planet, config, 4);
  expect(reversed.reverse()).toEqual(first);
  expect(updateResources(resources, { fish_oceans: 2, extra: 2 }, world.planet, config, 5)).not.toEqual(first);
  expect(() => updateResources(resources, {}, world.planet, config)).toThrow("explicit nonnegative world step");
  expect(() => getExogenousRNG({ useIndependentRandomStreams: true }, "physical-shock", [0, "x"])).toThrow("explicit");
  setRNGSeed(42);
  const legacy = getRNG().normal();
  setRNGSeed(42);
  expect(getExogenousRNG({}, "physical-shock", [0, "x"]).normal()).toBe(legacy);
});

it("adds numeric resource rules only when opted in, without exposing hidden resource state", async () => {
  vi.mocked(callLLM).mockImplementation(policy(false));
  await runSimulation("two_species_simple_lake", 1, 1009, models, { useBaselineAgents: false });
  expect(vi.mocked(callLLM).mock.calls[0][1]).not.toContain("NUMERIC RESOURCE RULES");
  vi.clearAllMocks();
  vi.mocked(callLLM).mockImplementation(policy(false));
  const result = await runSimulation("two_species_simple_lake", 1, 1009, models,
    { useBaselineAgents: false, includeNumericRules: true });
  const prompt = vi.mocked(callLLM).mock.calls[0][1];
  expect(prompt).toContain("regeneration r=0.15, irreversible collapse threshold C=20");
  expect(prompt).toContain("does not mechanically cap harvest");
  const world = structuredClone(result.history[0]);
  const observation = buildObservation(world.species[0], world, [world], result.config);
  const before = buildNumericResourceRules(world, observation, result.config);
  world.resources[0].amount = 12.3456789;
  world.resources.push({ ...world.resources[0], def: { ...world.resources[0].def, id: "HIDDEN_SENTINEL", regenRate: .987654 } });
  expect(buildNumericResourceRules(world, observation, result.config)).toBe(before);
  expect(before).not.toContain("HIDDEN_SENTINEL");
  expect(validateSimConfig({ includeNumericRules: "yes" } as any).valid).toBe(false);
  expect(validateSimConfig({ useIndependentRandomStreams: 1 } as any).valid).toBe(false);
});
