import { describe, it, expect } from "vitest";
/**
 * Unit tests for LLM action parsing
 */

import { parseLLMResponse } from "@/lib/llm/parseActions";
import { sanitizeDecision } from "@/lib/sim/guards";

describe("parseLLMResponse", () => {
  it("should parse valid JSON response", () => {
    const response = JSON.stringify({
      harvest: { resource1: 50, resource2: 30 },
      relations: { species1: "ally" },
      governance: {
        punishment_strength: 0.5,
        monitoring_investment: 0.3,
      },
    });

    const result = parseLLMResponse(response, "test_species");

    expect(result.speciesId).toBe("test_species");
    expect(result.harvest.resource1).toBe(50);
    expect(result.harvest.resource2).toBe(30);
    expect(result.relations.species1).toBe("ally");
    expect(result.governance.punishmentStrength).toBe(0.5);
    expect(result.governance.monitoringInvestment).toBe(0.3);
  });

  it("should handle code block format", () => {
    const response = `Here's the decision:
\`\`\`json
{
  "harvest": {"resource1": 40},
  "relations": {},
  "governance": {"punishment_strength": 0.4, "monitoring_investment": 0.2}
}
\`\`\``;

    const result = parseLLMResponse(response, "test_species");

    expect(result.speciesId).toBe("test_species");
    expect(result.harvest.resource1).toBe(40);
  });

  it("should clamp harvest values to 0-100", () => {
    const response = JSON.stringify({
      harvest: { resource1: 150, resource2: -10 },
    });

    const result = parseLLMResponse(response, "test_species");

    expect(result.harvest.resource1).toBe(100);
    expect(result.harvest.resource2).toBe(0);
  });

  it("should validate diplomatic stances", () => {
    const response = JSON.stringify({
      relations: {
        species1: "ally",
        species2: "invalid",
        species3: "war",
      },
    });

    const result = parseLLMResponse(response, "test_species");

    expect(result.relations.species1).toBe("ally");
    expect(result.relations.species2).toBe("neutral"); // Invalid becomes neutral
    expect(result.relations.species3).toBe("war");
  });

  it("should handle missing fields with defaults", () => {
    const response = JSON.stringify({});

    const result = parseLLMResponse(response, "test_species");

    expect(result.speciesId).toBe("test_species");
    expect(result.harvest).toEqual({});
    expect(result.relations).toEqual({});
    expect(result.governance.punishmentStrength).toBe(0.3);
    expect(result.governance.monitoringInvestment).toBe(0.2);
  });

  it("should handle invalid JSON gracefully", () => {
    const response = "This is not JSON";

    const result = parseLLMResponse(response, "test_species");

    expect(result.speciesId).toBe("test_species");
    expect(result.harvest).toEqual({});
    expect(result.governance.punishmentStrength).toBe(0.3);
  });
});

describe("strict live decisions", () => {
  const targets = { resourceIds: ["fish_oceans"], otherSpeciesIds: ["species_1"] };
  const valid = () => ({
    harvest: { fish_oceans: 50 }, relations: { species_1: "ally" },
    governance: { punishment_strength: 0, monitoring_investment: 0 },
    communication: [{ targetSpeciesId: "species_1", intent: "REPORT", message: "Observed fish." }],
    treatyProposal: { targetSpeciesId: "species_1", text: "Harvest at most 5 fish_oceans." },
  });
  const parse = (value: unknown) => parseLLMResponse(JSON.stringify(value), "species_0", true, targets);

  it("preserves zero governance, known targets and communication through the engine guard", () => {
    const decision = parse(valid());
    expect(decision.governance).toEqual({ punishmentStrength: 0, monitoringInvestment: 0 });
    expect(sanitizeDecision(decision)).toEqual(decision);
    expect(decision.communication).toEqual(valid().communication);
    expect(decision.treatyProposal).toEqual(valid().treatyProposal);
  });

  it("allows explicit abstention and a null optional treaty", () => {
    const value = { ...valid(), harvest: {}, relations: {}, communication: [], treatyProposal: null };
    expect(parse(value).harvest).toEqual({});
    expect(parse(value).treatyProposal).toBeUndefined();
  });

  it.each([
    ["invented resource", { harvest: { resource_id_1: 50 } }],
    ["hidden resource", { harvest: { hidden_resource: 5 } }],
    ["negative harvest", { harvest: { fish_oceans: -1 } }],
    ["oversized harvest", { harvest: { fish_oceans: 140 } }],
    ["string harvest", { harvest: { fish_oceans: "5" } }],
    ["missing harvest", { harvest: undefined }],
    ["array harvest", { harvest: [] }],
    ["invented relation", { relations: { other_species_id_1: "ally" } }],
    ["self relation", { relations: { species_0: "ally" } }],
    ["invalid stance", { relations: { species_1: "friends" } }],
    ["missing relations", { relations: undefined }],
    ["null governance", { governance: null }],
    ["partial governance", { governance: { punishment_strength: 0.2 } }],
    ["negative governance", { governance: { punishment_strength: -1, monitoring_investment: 0 } }],
    ["oversized governance", { governance: { punishment_strength: 0, monitoring_investment: 2 } }],
    ["numeric communication target", { communication: [{ targetSpeciesId: 100, intent: "REPORT", message: "Fish." }] }],
    ["unknown communication target", { communication: [{ targetSpeciesId: "Species 1", intent: "REPORT", message: "Fish." }] }],
    ["unknown intent", { communication: [{ targetSpeciesId: "species_1", intent: "GUESS", message: "Fish." }] }],
    ["oversized message", { communication: [{ targetSpeciesId: "species_1", intent: "REPORT", message: "x".repeat(501) }] }],
    ["blank message", { communication: [{ targetSpeciesId: "species_1", intent: "REPORT", message: " " }] }],
    ["non-array communication", { communication: {} }],
    ["unknown treaty target", { treatyProposal: { targetSpeciesId: "species_2", text: "Fish." } }],
    ["self treaty target", { treatyProposal: { targetSpeciesId: "species_0", text: "Fish." } }],
    ["numeric treaty target", { treatyProposal: { targetSpeciesId: 50, text: "Fish." } }],
    ["blank treaty", { treatyProposal: { targetSpeciesId: "species_1", text: "" } }],
    ["oversized treaty", { treatyProposal: { targetSpeciesId: "species_1", text: "x".repeat(501) } }],
    ["unadvertised treaty constraints", { treatyProposal: { targetSpeciesId: "species_1", text: "Fish.", statedConstraints: { maxHarvestByResource: { invented: 1e100 } } } }],
    ["unknown action", { inventedAction: true }],
  ])("rejects %s without repairs", (_name, patch) => {
    expect(() => parse({ ...valid(), ...patch })).toThrow("Invalid structured model decision");
  });

  it("rejects a JSON number that overflows to Infinity", () => {
    const raw = JSON.stringify(valid()).replace('"fish_oceans":50', '"fish_oceans":1e400');
    expect(() => parseLLMResponse(raw, "species_0", true, targets)).toThrow("harvest.fish_oceans");
  });

  it("requires trusted observation targets for strict parsing", () => {
    expect(() => parseLLMResponse(JSON.stringify(valid()), "species_0", true)).toThrow("targets are required");
  });
});
