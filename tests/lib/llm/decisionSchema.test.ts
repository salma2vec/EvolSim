import { expect, it } from "vitest";
import { buildDecisionSchema } from "@/lib/llm/decisionSchema";
import { parseLLMResponse } from "@/lib/llm/parseActions";

it("grounds every action key in exactly the observable identifiers", () => {
  const schema = buildDecisionSchema({ resourceIds: ["visible", "visible"], otherSpeciesIds: ["peer"] });
  const harvest = schema.properties.harvest as any;
  const relations = schema.properties.relations as any;
  expect(Object.keys(harvest.properties)).toEqual(["visible"]);
  expect(harvest.additionalProperties).toBe(false);
  expect(Object.keys(relations.properties)).toEqual(["peer"]);
});

it("keeps strict semantic rejection independent of schema decoding", () => {
  const targets = { resourceIds: ["visible"], otherSpeciesIds: ["peer"] };
  const valid = { harvest: { visible: 0 }, relations: { peer: "neutral" },
    governance: { punishment_strength: 0, monitoring_investment: 0 }, communication: [], treatyProposal: null };
  expect(parseLLMResponse(JSON.stringify(valid), "self", true, targets).harvest.visible).toBe(0);
  for (const harvest of [{ hidden: 1 }, { visible: 101 }, { visible: "1" }])
    expect(() => parseLLMResponse(JSON.stringify({ ...valid, harvest }), "self", true, targets)).toThrow();
});

it("supports observations without resources or other species", () => {
  const schema = buildDecisionSchema({ resourceIds: [], otherSpeciesIds: [] });
  expect((schema.properties.harvest as any).required).toEqual([]);
  expect((schema.properties.communication as any).maxItems).toBe(0);
  expect(schema.properties.treatyProposal).toEqual({ type: "null" });
});
