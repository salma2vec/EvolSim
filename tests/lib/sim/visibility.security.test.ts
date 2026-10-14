import { expect, it } from "vitest";
import { buildObservation, stepWorld } from "@/lib/sim/gameLoop";
import { createWorldFromPreset } from "@/lib/sim/presets";
import { buildSpeciesPrompt } from "@/lib/llm/promptBuilder";
import type { EpistemicOrder, SpeciesDecision } from "@/lib/sim/types";

function fixture(order: EpistemicOrder = "Order-2") {
  const { world, config } = createWorldFromPreset("two_species_simple_lake", {}, 42);
  world.species[0].traits.epistemicOrder = order;
  world.species[0].traits.linguisticRegime = "LiteralOnly";
  world.species[0].position = { x: 0, y: 0, z: order === "Order-1" ? 1 : 2 };
  world.species[1].traits.epistemicOrder = "Order-0";
  world.species[1].traits.name = "Secret High Species";
  world.species[1].position = { x: 0, y: 0, z: 0 };
  world.species.push({ ...structuredClone(world.species[0]), traits: {
    ...world.species[0].traits, id: "species_2", name: "Visible Peer",
  } });
  world.resources[0] = { ...world.resources[0], amount: 42, def: {
    ...world.resources[0].def, id: "hidden_ore", name: "Secret Mineral", location: { x: 0, y: 0, z: 0 },
  } };
  world.resources.push({ ...structuredClone(world.resources[0]), def: {
    ...world.resources[0].def, id: "visible_water", name: "Visible Water", location: { x: 0, y: 0, z: 2 },
  } });
  return { world, config: { ...config, useEpistemicOrders: true, useLinguisticRegimes: true } };
}

it.each<EpistemicOrder>(["Order-1", "Order-2"])("filters hidden history and simile channels for %s", order => {
  const { world, config } = fixture(order);
  world.timeStep = 1;
  const history = [{ ...structuredClone(world), timeStep: 0, events: [
    { timeStep: 0, type: "COLLAPSE" as const, message: "Secret Mineral collapsed", data: { resourceId: "hidden_ore" } },
    { timeStep: 0, type: "COLLAPSE" as const, message: "Visible Water collapsed", data: { resourceId: "visible_water" } },
    { timeStep: 0, type: "CONCLAVE" as const, message: "Secret High Species enters conclave", data: { speciesId: "species_1" } },
  ] }];
  const reference = { epoch: 0, createdAt: 0, action: "harvested 20 units", referent: "the agent who harvested 20 units" };
  world.livingSimiles = [
    { ...reference, id: "hidden-species", speciesId: "species_1", resourceId: "visible_water", referent: "Secret High Species harvest" },
    { ...reference, id: "hidden-resource", speciesId: "species_2", resourceId: "hidden_ore", referent: "Secret Mineral harvest" },
    { ...reference, id: "visible", speciesId: "species_2", resourceId: "visible_water" },
    { ...reference, id: "unverified-legacy", speciesId: "species_2" },
  ];
  const observation = buildObservation(world.species[0], world, history, config);
  expect(observation.resourceEstimates.map(r => r.resourceId)).toEqual(["visible_water"]);
  expect(observation.otherSpecies.map(s => s.speciesId)).toEqual(["species_2"]);
  expect(observation.recentEvents.map(e => e.message)).toEqual(["Visible Water collapsed"]);
  expect(observation.availableSimiles?.map(s => s.id)).toEqual(["visible"]);
  if (order === "Order-1") expect(observation.memorySummary).toBe("1 resource collapse(s).");
  expect(buildSpeciesPrompt(world.species[0], world, observation)).not.toContain("Secret");
});

it("a treaty query cannot disclose hidden resource amounts through validation errors", async () => {
  const { world, config } = fixture();
  const next = await stepWorld(world, config, async observations => observations.map(observation => ({
    speciesId: observation.speciesId, harvest: {}, relations: {},
    governance: { punishmentStrength: 0, monitoringInvestment: 0 },
    ...(observation.speciesId === "species_0" ? { treatyProposal: {
      targetSpeciesId: "species_2", text: "Secret Mineral is 1 units; limit 1 units",
    } } : {}),
  } satisfies SpeciesDecision)));
  const rejected = next.events.find(e => e.type === "LANGUAGE_REJECTED");
  expect(rejected?.message).toContain("observable resources");
  expect(rejected?.message).not.toContain("42");
  expect(next.activeTreaties).toHaveLength(0);
});

it("disabling epistemic restrictions still exposes the complete declared observation", () => {
  const { world, config } = fixture();
  world.events = [{ timeStep: 0, type: "COLLAPSE", message: "Secret Mineral collapsed", data: { resourceId: "hidden_ore" } }];
  const observation = buildObservation(world.species[0], world, [], { ...config, useEpistemicOrders: false });
  expect(observation.resourceEstimates).toHaveLength(2);
  expect(observation.otherSpecies).toHaveLength(2);
  expect(observation.recentEvents[0].message).toBe("Secret Mineral collapsed");
});
