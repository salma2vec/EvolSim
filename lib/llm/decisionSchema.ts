/** Observation-grounded output contract. Parsing remains the semantic authority. */
import type { DecisionTargets } from "./parseActions";

export function buildDecisionSchema(targets: DecisionTargets) {
  const resources = [...new Set(targets.resourceIds)];
  const species = [...new Set(targets.otherSpeciesIds)];
  const object = (properties: Record<string, unknown>, required = Object.keys(properties)) =>
    ({ type: "object", properties, required, additionalProperties: false });
  const text = { type: "string", minLength: 1, maxLength: 500 };
  const target = { type: "string", enum: species };
  return object({
    harvest: object(Object.fromEntries(resources.map(id => [id, { type: "number", minimum: 0, maximum: 100 }]))),
    relations: object(Object.fromEntries(species.map(id => [id,
      { type: "string", enum: ["ally", "neutral", "sanction", "war"] }]))),
    governance: object({ punishment_strength: { type: "number", minimum: 0, maximum: 1 },
      monitoring_investment: { type: "number", minimum: 0, maximum: 1 } }),
    communication: species.length ? { type: "array", maxItems: 4,
      items: object({ targetSpeciesId: target,
        intent: { type: "string", enum: ["DESCRIBE", "PROMISE", "COMMIT", "PROPOSE", "REPORT"] }, message: text }) }
      : { type: "array", maxItems: 0, items: { type: "string" } },
    treatyProposal: species.length ? { anyOf: [object({ targetSpeciesId: target, text }), { type: "null" }] }
      : { type: "null" },
  });
}
