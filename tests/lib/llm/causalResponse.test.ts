import { expect, it } from "vitest";
import { HarvestPlanner, PARTNER_REQUESTS, parseStudyResponse, referenceDecision,
  resourceTransition, studyCaseQuartetIssues, studyCases, type ResourceGame } from "@/lib/research/causalResponse";
import { createWorldFromPreset } from "@/lib/sim/presets";
import { updateResources } from "@/lib/sim/dynamics";
import { getExogenousRNG } from "@/lib/sim/random";

const game: ResourceGame = { capacity: 100, regeneration: .15, collapseThreshold: 20,
  harvestNoise: 0, volatility: 0, discount: .9 };

it("matches production physical transitions including noise and irreversible collapse", () => {
  const { world, config } = createWorldFromPreset("two_species_simple_lake", {}, 1009,
    { useIndependentRandomStreams: true, harvestNoise: .05 });
  const parameters = { ...game, harvestNoise: .05, volatility: world.planet.volatility };
  for (const stock of [0, 10, 40, 80]) for (const collapsed of [false, true]) {
    const resource = { ...world.resources[0], amount: stock, collapsed };
    const zh = getExogenousRNG(config, "physical-harvest", [2, "fish_oceans"]).normal();
    const zs = getExogenousRNG(config, "physical-shock", [2, "fish_oceans"]).normal();
    const actual = resourceTransition(stock, collapsed, 30, 7, parameters, zh, zs);
    const production = updateResources([resource], { fish_oceans: Math.min(stock, 37) }, world.planet, config, 2)[0];
    expect(actual.nextStock).toBeCloseTo(production.amount, 12);
    expect(actual.collapsed).toBe(production.collapsed);
  }
});

it("agrees with independent two-step exhaustive action search in a deterministic fixture", () => {
  const possible = [0, 25, 50, 75, 100];
  for (const stock of [40, 80]) for (const partner of PARTNER_REQUESTS) {
    const planner = new HarvestPlanner(game, partner, 2, .25, 25);
    for (const first of possible) {
      // Independently compute allocation/growth/terminal payoff, without the reference transition helper.
      const scale = first + partner > stock ? stock / (first + partner) : 1;
      const next = Math.max(0, stock + .15 * stock * (1 - stock / 100) - (first + partner) * scale);
      const secondPayoff = Math.max(...possible.map(h => h + partner > next ? h * next / (h + partner) : h));
      const exhaustive = first * scale + .9 * secondPayoff;
      expect(planner.q(stock, false, first)).toBeCloseTo(exhaustive, 5);
    }
  }
});

it("builds64paired cells whose masks affect only partner history and announcement", () => {
  const cells = studyCases();
  expect(cells).toHaveLength(64);
  expect(new Set(cells.map(c => c.id)).size).toBe(64);
  for (let start = 0; start < cells.length; start += 4) {
    const quartet = cells.slice(start, start + 4);
    expect(studyCaseQuartetIssues(quartet)).toEqual([]);
    const payloads = quartet.map(c => JSON.parse(c.prompt));
    const stripped = payloads.map(({ announcement, partnerPreviousRequests, ...rest }) => rest);
    expect(stripped.every(p => JSON.stringify(p) === JSON.stringify(stripped[0]))).toBe(true);
    expect(new Set(payloads.map(p => p.announcement.length)).size).toBe(1);
    for (const [i, cell] of quartet.entries()) {
      expect(payloads[i].partnerPreviousRequests).toEqual(cell.visibleHistory
        ? [cell.partnerRequest, cell.partnerRequest] : "MASKED");
      expect(payloads[i].seed).toBeUndefined();
      expect(payloads[i].partnerRequest).toBeUndefined();
    }
  }
});

it("detects adversarial changes to fixed context, hidden history, and institution semantics", () => {
  const original = studyCases().slice(0, 4);
  const mutate = (index: number, change: (payload: Record<string, unknown>) => void) => {
    const quartet = structuredClone(original);
    const payload = JSON.parse(quartet[index].prompt);
    change(payload);
    quartet[index].prompt = JSON.stringify(payload);
    return studyCaseQuartetIssues(quartet);
  };
  expect(mutate(0, payload => { payload.exactCurrentStock = 41; })).not.toEqual([]);
  const masked = original.findIndex(item => !item.visibleHistory);
  expect(mutate(masked, payload => { payload.partnerPreviousRequests = [original[masked].partnerRequest]; })).not.toEqual([]);
  const announced = original.findIndex(item => item.announcement);
  expect(mutate(announced, payload => { payload.announcement = "Binding quota with a fine"; })).not.toEqual([]);
});

it("passes the nonbinding-announcement placebo and reports reference grid sensitivity", () => {
  const coarse = referenceDecision(40, game, null, 1, 5);
  const refined = referenceDecision(40, game, null, .5, 1);
  expect(refined.action).toBe(coarse.action);
  expect(Math.abs(refined.value - coarse.value)).toBeLessThan(.1);
  const cells = studyCases().slice(0, 4);
  const pair = cells.filter(c => !c.visibleHistory);
  const a = referenceDecision(pair[0].stock, pair[0].game, null, 1, 5);
  const b = referenceDecision(pair[1].stock, pair[1].game, null, 1, 5);
  expect(a).toEqual(b);
});

it("keeps valid but misunderstood rules distinct from invalid actions", () => {
  const cell = studyCases()[0];
  const correct = { harvest: 90, comprehension: cell.comprehension };
  expect(parseStudyResponse(JSON.stringify(correct), cell).comprehensionPassed).toBe(true);
  expect(parseStudyResponse(JSON.stringify({ ...correct, comprehension: { ...cell.comprehension, growth: 100 } }), cell).comprehensionPassed).toBe(false);
  for (const value of [{ ...correct, harvest: 101 }, { ...correct, other: 1 },
    { ...correct, comprehension: { ...cell.comprehension, quotaBinding: "false" } }]) {
    expect(() => parseStudyResponse(JSON.stringify(value), cell)).toThrow();
  }
});
