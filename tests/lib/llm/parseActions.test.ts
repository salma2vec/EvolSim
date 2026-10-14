import { describe, it, expect } from "vitest";
/**
 * Unit tests for LLM action parsing
 */

import { parseLLMResponse } from "@/lib/llm/parseActions";

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

