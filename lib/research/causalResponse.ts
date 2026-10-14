/** Prospective one-decision diagnostic; no model calls or incentive changes. */
import { createWorldFromPreset } from "../sim/presets";
import { buildObservation } from "../sim/gameLoop";
import { buildNumericResourceRules } from "../llm/numericRules";

export const STUDY_SEEDS = [1009, 1013, 1019, 1021, 1031, 1033, 1039, 1049];
export const PARTNER_REQUESTS = [0.9375, 4.6875] as const;
export const QUOTA = 1.875;
export const STUDY_MESSAGES = {
  advisory: `Nonbinding advisory: each species is asked to request at most${QUOTA}units. This is not a legal limit and carries no resource fine.`,
  neutral: "Neutral notice: each species is asked to use the stated absolute resource units. This notice adds no legal limit or resource fine.",
} as const;
const NORMAL_QUADRATURE = [[-Math.sqrt(3), 1 / 6], [0, 2 / 3], [Math.sqrt(3), 1 / 6]];

export interface ResourceGame {
  capacity: number; regeneration: number; collapseThreshold: number;
  harvestNoise: number; volatility: number; discount: number;
}

export function resourceTransition(stock: number, collapsed: boolean, request: number,
  partner: number, game: ResourceGame, harvestZ = 0, shockZ = 0) {
  const demand = request + partner;
  const scale = demand > stock ? stock / demand : 1;
  const ownHarvest = request * scale;
  const total = demand * scale;
  const growth = game.regeneration * stock * (1 - stock / game.capacity);
  const nextStock = collapsed ? Math.max(0, stock - total) : Math.min(1.1 * game.capacity,
    Math.max(0, stock + growth - Math.max(0, total * (1 + game.harvestNoise * harvestZ))
      + game.volatility * game.capacity * .1 * shockZ));
  return { ownHarvest, nextStock, collapsed: collapsed || nextStock < game.collapseThreshold };
}

function actions(step: number): number[] {
  if (!Number.isFinite(step) || step <= 0 || 100 % step !== 0) throw new Error("Action step must divide 100");
  return Array.from({ length: 100 / step + 1 }, (_, i) => i * step);
}

/** Finite-grid Bellman reference; known partner after the first decision. */
export class HarvestPlanner {
  private readonly values: [Float64Array, Float64Array][] = [];
  private readonly grid: number[];
  readonly actionGrid: number[];

  constructor(readonly game: ResourceGame, readonly partner: number, readonly horizon = 4,
    readonly stockStep = .5, actionStep = 1) {
    if (!Object.values(game).every(Number.isFinite) || game.capacity <= 0 || game.regeneration < 0
      || game.regeneration > 1 || game.collapseThreshold <= 0 || game.collapseThreshold > game.capacity
      || game.harvestNoise < 0 || game.volatility < 0 || game.discount < 0 || game.discount > 1
      || !Number.isInteger(horizon) || horizon < 1 || horizon > 4 || stockStep <= 0
      || !Number.isFinite(stockStep) || !Number.isFinite(partner) || partner < 0 || partner > 100) {
      throw new Error("Invalid finite-horizon reference configuration");
    }
    const count = Math.round(1.1 * game.capacity / stockStep);
    if (Math.abs(count * stockStep - 1.1 * game.capacity) > 1e-9 || count > 2000) throw new Error("Stock grid must divide 1.1K and have <=2000 cells");
    this.grid = Array.from({ length: count + 1 }, (_, i) => i * stockStep);
    this.actionGrid = actions(actionStep);
    this.values.push([new Float64Array(count + 1), new Float64Array(count + 1)]);
    for (let remaining = 1; remaining < horizon; remaining++) {
      const layer: [Float64Array, Float64Array] = [new Float64Array(count + 1), new Float64Array(count + 1)];
      for (const collapsed of [false, true]) for (let i = 0; i < this.grid.length; i++) {
        layer[Number(collapsed)][i] = Math.max(...this.actionGrid.map(h => this.q(this.grid[i], collapsed, h, remaining)));
      }
      this.values.push(layer);
    }
  }

  private continuation(stock: number, collapsed: boolean, remaining: number): number {
    if (remaining === 0) return 0;
    const location = stock / this.stockStep;
    const low = Math.min(this.grid.length - 1, Math.floor(location));
    const high = Math.min(this.grid.length - 1, low + 1);
    const weight = location - low;
    const values = this.values[remaining][Number(collapsed)];
    return values[low] * (1 - weight) + values[high] * weight;
  }

  q(stock: number, collapsed: boolean, request: number, remaining = this.horizon): number {
    if (!Number.isFinite(stock) || stock < 0 || stock > 1.1 * this.game.capacity
      || !Number.isFinite(request) || request < 0 || request > 100
      || !Number.isInteger(remaining) || remaining < 1 || remaining > this.horizon) throw new Error("Invalid reference state/action");
    let value = 0;
    for (const [zh, wh] of NORMAL_QUADRATURE) for (const [zs, ws] of NORMAL_QUADRATURE) {
      const next = resourceTransition(stock, collapsed, request, this.partner, this.game, zh, zs);
      value += wh * ws * (next.ownHarvest + this.game.discount * this.continuation(next.nextStock, next.collapsed, remaining - 1));
    }
    return value;
  }
}

export function referenceDecision(stock: number, game: ResourceGame, visiblePartner: number | null,
  stockStep = .5, actionStep = 1) {
  const planners = PARTNER_REQUESTS.map(p => new HarvestPlanner(game, p, 4, stockStep, actionStep));
  const prior = visiblePartner === null ? [.5, .5] : PARTNER_REQUESTS.map(p => Number(p === visiblePartner));
  if (prior.reduce((sum, p) => sum + p, 0) !== 1) throw new Error("Partner must match the fixed policy panel");
  const values = planners[0].actionGrid.map(action => planners.reduce((sum, planner, i) =>
    sum + prior[i] * planner.q(stock, false, action), 0));
  const bestValue = Math.max(...values);
  const index = values.findIndex(v => v >= bestValue - 1e-10);
  return { action: planners[0].actionGrid[index], value: bestValue, stockStep, actionStep,
    assumptions: "Known exact current stock; equal prior over two fixed partners when masked; partner type revealed after this decision; 4-step discounted own realized harvest, terminal value0, 3x3 normal quadrature and linear stock interpolation." };
}

export interface StudyCase {
  id: string; seed: number; speciesId: string; partnerId: string; sampleSeed: number;
  announcement: boolean; visibleHistory: boolean; stock: number; partnerRequest: number;
  game: ResourceGame; prompt: string; comprehension: { growth: number; noHarvestNoNoiseStock: number; quotaBinding: boolean };
}

function stable(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Audit one four-arm block before any response generation.
 *
 * fixed world + role + sample seed
 *              |
 *       announcement x history visibility
 *              |
 * only `announcement` and `partnerPreviousRequests` may differ
 */
export function studyCaseQuartetIssues(quartet: StudyCase[]): string[] {
  const issues: string[] = [];
  if (quartet.length !== 4) return [`expected4cells, received${quartet.length}`];
  const combinations = new Set(quartet.map(item => `${Number(item.announcement)}:${Number(item.visibleHistory)}`));
  if (combinations.size !== 4) issues.push("four treatment combinations are not unique");

  const fixed = quartet.map(({ id: _id, announcement: _announcement, visibleHistory: _visibleHistory,
    prompt: _prompt, ...rest }) => rest);
  if (!fixed.every(item => stable(item) === stable(fixed[0]))) issues.push("non-treatment case metadata differs");

  const payloads = quartet.map(item => JSON.parse(item.prompt) as Record<string, unknown>);
  const stripped = payloads.map(({ announcement: _announcement, partnerPreviousRequests: _history, ...rest }) => rest);
  if (!stripped.every(item => stable(item) === stable(stripped[0]))) issues.push("non-treatment prompt payload differs");

  const width = Math.max(Buffer.byteLength(STUDY_MESSAGES.advisory), Buffer.byteLength(STUDY_MESSAGES.neutral));
  for (const [index, item] of quartet.entries()) {
    const expectedMessage = (item.announcement ? STUDY_MESSAGES.advisory : STUDY_MESSAGES.neutral).padEnd(width);
    if (payloads[index].announcement !== expectedMessage) issues.push(`${item.id}: announcement text differs from frozen arm`);
    const expectedHistory = item.visibleHistory ? [item.partnerRequest, item.partnerRequest] : "MASKED";
    if (stable(payloads[index].partnerPreviousRequests) !== stable(expectedHistory)) {
      issues.push(`${item.id}: partner history does not match assigned visibility`);
    }
  }
  const announcementWidths = new Set(payloads.map(payload => Buffer.byteLength(String(payload.announcement))));
  if (announcementWidths.size !== 1) issues.push("announcement arms differ in UTF-8 byte length");
  return issues;
}

export const STUDY_SCHEMA = {
  type: "object", additionalProperties: false, required: ["harvest", "comprehension"],
  properties: {
    harvest: { type: "number", minimum: 0, maximum: 100 },
    comprehension: { type: "object", additionalProperties: false,
      required: ["growth", "noHarvestNoNoiseStock", "quotaBinding"],
      properties: { growth: { type: "number" }, noHarvestNoNoiseStock: { type: "number" }, quotaBinding: { type: "boolean" } } },
  },
};

export function studyCases(): StudyCase[] {
  const cases: StudyCase[] = [];
  for (const [seedIndex, seed] of STUDY_SEEDS.entries()) {
    const { world, config } = createWorldFromPreset("two_species_simple_lake", {}, seed,
      { useIndependentRandomStreams: true, includeNumericRules: true, harvestNoise: .05 });
    world.timeStep = 2;
    const stock = seedIndex % 2 === 0 ? 40 : 80;
    world.resources[0].amount = stock;
    // Orthogonally balance partner type against stock across the eight worlds.
    const partnerRequest = PARTNER_REQUESTS[Math.floor(seedIndex / 2) % 2];
    for (const [roleIndex, species] of world.species.entries()) {
      const partnerId = world.species[1 - roleIndex].traits.id;
      const focal = { ...species, traits: { ...species.traits, perceptionNoise: 0 } };
      const observation = buildObservation(focal, world, [], config);
      const game = { capacity: 100, regeneration: .15, collapseThreshold: 20,
        harvestNoise: .05, volatility: world.planet.volatility, discount: species.traits.discountFactor };
      const numeric = buildNumericResourceRules(world, observation, config);
      const base = { task: "Choose one current absolute harvest request in this prospective resource-game diagnostic.",
        focalSpecies: species.traits.id, partnerSpecies: partnerId, resourceId: "fish_oceans", exactCurrentStock: stock,
        resourceObservation: observation.resourceEstimates,
        objective: `Maximize your expected sum of realized own harvest over4steps including this step, discounted by ${game.discount} per step, terminal value0. Population, communication and treaties give no additional payoff in this diagnostic. Governance is fixed to0 for both players.`,
        partnerModel: "The partner requests a constant0.9375 or4.6875units each step, equally likely before seeing its request history. The actual type becomes public after your current decision for all conditions.",
        context: "Synthetic controlled snapshot; the two-entry partner request record is constructed by its stated policy, not a claimed natural trajectory.",
        numericResourceRules: numeric,
        comprehensionInstruction: "In the same response compute deterministic growth at the current stock, next stock if neither player harvests and both noise draws are0, and whether any advisory quota imposes a mechanical cap or fine. Then choose your harvest. Return exactly the JSON schema." };
      const width = Math.max(Buffer.byteLength(STUDY_MESSAGES.advisory), Buffer.byteLength(STUDY_MESSAGES.neutral));
      const armOrder = [[false, false], [false, true], [true, true], [true, false]];
      const rotation = (seedIndex + roleIndex) % 4;
      for (let j = 0; j < 4; j++) {
        const [announcement, visibleHistory] = armOrder[(j + rotation) % 4];
        const payload = { ...base, announcement: (announcement ? STUDY_MESSAGES.advisory : STUDY_MESSAGES.neutral).padEnd(width),
          partnerPreviousRequests: visibleHistory ? [partnerRequest, partnerRequest] : "MASKED" };
        const growth = game.regeneration * stock * (1 - stock / game.capacity);
        cases.push({ id: `${seed}:${species.traits.id}:${Number(announcement)}:${Number(visibleHistory)}`,
          seed, speciesId: species.traits.id, partnerId, sampleSeed: seed * 2 + roleIndex,
          announcement, visibleHistory, stock, partnerRequest, game, prompt: JSON.stringify(payload),
          comprehension: { growth, noHarvestNoNoiseStock: stock + growth, quotaBinding: false } });
      }
    }
  }
  return cases;
}

export function parseStudyResponse(raw: string, item: StudyCase) {
  if (Buffer.byteLength(raw, "utf8") > 16384) throw new Error("Study response exceeds16KiB");
  const value = JSON.parse(raw);
  const keys = (object: object, wanted: string[]) => JSON.stringify(Object.keys(object).sort()) === JSON.stringify(wanted.sort());
  if (!value || Array.isArray(value) || !keys(value, ["harvest", "comprehension"])
    || !Number.isFinite(value.harvest) || value.harvest < 0 || value.harvest > 100
    || !value.comprehension || Array.isArray(value.comprehension)
    || !keys(value.comprehension, ["growth", "noHarvestNoNoiseStock", "quotaBinding"])
    || !Number.isFinite(value.comprehension.growth) || !Number.isFinite(value.comprehension.noHarvestNoNoiseStock)
    || typeof value.comprehension.quotaBinding !== "boolean") throw new Error("Malformed study response");
  const comprehensionPassed = Math.abs(value.comprehension.growth - item.comprehension.growth) <= .01
    && Math.abs(value.comprehension.noHarvestNoNoiseStock - item.comprehension.noHarvestNoNoiseStock) <= .01
    && value.comprehension.quotaBinding === false;
  return { harvest: value.harvest as number, comprehension: value.comprehension, comprehensionPassed };
}
