import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { SeededRNG, setRandomContextProvider } from "../sim/random";
import { createWorldFromPreset } from "../sim/presets";
import { stepWorld } from "../sim/gameLoop";
import { getLLMDecision } from "../llm/decisionHandler";
import { assertWorldState } from "../sim/guards";
import { validateSimulationRequest } from "../utils/validation";
import { computeCollapseStats, computeCooperationIndex, computeSpeciesOutcomes } from "../sim/metrics";
import type { SimConfig, WorldState } from "../sim/types";
import { APIError } from "./api";

const randomContext = new AsyncLocalStorage<SeededRNG>();
setRandomContextProvider(() => randomContext.getStore());
let activeRuns = 0;
export const PROTOCOL_VERSION = "2.3.0";

export async function runSimulation(presetId: string, numSteps: number, seed = 42,
  speciesModelMap: Record<string, string> = {}, configOverrides: Partial<SimConfig> = {},
  onState?: (state: WorldState) => void) {
  const check = validateSimulationRequest({ presetId, numSteps, seed, speciesModelMap, config: configOverrides });
  if (!check.valid) throw new APIError(check.errors.join("; "));
  if (activeRuns >= 2) throw new APIError("Simulation capacity reached; retry later", 429);
  activeRuns++;
  try {
    return await randomContext.run(new SeededRNG(seed), async () => {
      const { world, config } = createWorldFromPreset(presetId, speciesModelMap, seed, configOverrides);
      // Live calls are bounded before issuing any provider request.
      if (!config.useBaselineAgents && numSteps * world.species.length > 100) throw new APIError("Live run exceeds 100 decision-call budget");
      if (!config.useBaselineAgents && world.species.some(s => !speciesModelMap[s.traits.id])) throw new APIError("Live runs require exact model IDs for every species");
      const history: WorldState[] = [world];
      let current = world;
      assertWorldState(current);
      onState?.(structuredClone(current));
      for (let i = 0; i < numSteps && i < config.maxTimeSteps; i++) {
        if (current.species.every(s => !s.alive)) break;
        current = await stepWorld(current, config, async observations => {
          const result = await getLLMDecision(observations, current, speciesModelMap, config);
          if (result.errors.length) throw new Error("Decision generation failed");
          return result.decisions;
        }, history);
        assertWorldState(current);
        history.push(current);
        onState?.(structuredClone(current));
      }
      return { history, config, metrics: { collapseStats: computeCollapseStats(history),
        cooperationIndex: computeCooperationIndex(history), speciesOutcomes: computeSpeciesOutcomes(history) },
        provenance: { protocolVersion: PROTOCOL_VERSION, seed, presetId, requestedSteps: numSteps,
          mode: config.useBaselineAgents ? "baseline" : "live", speciesModelMap,
          trajectorySha256: createHash("sha256").update(JSON.stringify(history)).digest("hex") } };
    });
  } finally { activeRuns--; }
}
