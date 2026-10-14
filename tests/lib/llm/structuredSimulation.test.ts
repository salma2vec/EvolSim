import { beforeEach, expect, it, vi } from "vitest";
import { callLLM } from "@/lib/llm/client";
import { runSimulation } from "@/lib/server/simulation";
import { validateSimConfig } from "@/lib/utils/validation";

vi.mock("@/lib/llm/client", () => ({ callLLM: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
const models = { species_0: "fixture", species_1: "fixture" };
const valid = JSON.stringify({ harvest: { fish_oceans: 1 }, relations: {},
  governance: { punishment_strength: 0, monitoring_investment: 0 }, communication: [] });

it("routes grounded schemas through the real multi-step simulation decision path", async () => {
  vi.mocked(callLLM).mockResolvedValue(valid);
  const snapshots: number[] = [];
  const result = await runSimulation("two_species_simple_lake", 2, 607, models,
    { useBaselineAgents: false, useStructuredDecisions: true, llmTemperature: 0, llmSeed: 607 }, state => {
      snapshots.push(state.timeStep);
      state.resources[0].amount = -999; // Observer snapshots cannot mutate simulation state.
    });
  expect(snapshots).toEqual([0, 1, 2]);
  expect(result.history.at(-1)?.resources[0].amount).toBeGreaterThanOrEqual(0);
  expect(callLLM).toHaveBeenCalledTimes(4);
  for (const [, prompt, options] of vi.mocked(callLLM).mock.calls) {
    expect(prompt).toContain("exact contract below");
    expect(options?.temperature).toBe(0);
    expect(options?.seed).toBe(607);
    expect(Object.keys((options?.schema?.properties as any).harvest.properties)).toEqual(["fish_oceans"]);
  }
});

it("leaves the default interface plain and retains partial history on a later failure", async () => {
  vi.mocked(callLLM).mockResolvedValueOnce(valid).mockResolvedValueOnce(valid)
    .mockResolvedValueOnce(JSON.stringify({ harvest: { invented: 1 }, relations: {},
      governance: { punishment_strength: 0, monitoring_investment: 0 } }));
  const snapshots: number[] = [];
  await expect(runSimulation("two_species_simple_lake", 2, 607, models,
    { useBaselineAgents: false }, state => snapshots.push(state.timeStep))).rejects.toThrow("unknown or hidden");
  expect(snapshots).toEqual([0, 1]);
  expect(vi.mocked(callLLM).mock.calls.every(([, , options]) => options?.schema === undefined)).toBe(true);
});

it("rejects malformed provider sampling and interface configuration before inference", async () => {
  for (const config of [{ useStructuredDecisions: "yes" }, { llmTemperature: -1 }, { llmTemperature: NaN },
    { llmSeed: 1.5 }, { llmSeed: 2**31 }]) {
    expect(validateSimConfig(config as any).valid).toBe(false);
    await expect(runSimulation("two_species_simple_lake", 1, 607, models,
      { useBaselineAgents: false, ...config } as any)).rejects.toThrow();
  }
  expect(callLLM).not.toHaveBeenCalled();
});
