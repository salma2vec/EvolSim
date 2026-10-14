/**
 * Parse LLM responses into structured SpeciesDecision objects
 */

import { SpeciesDecision, DiplomaticStance, IntentType } from "../sim/types";

export interface DecisionTargets {
  resourceIds: readonly string[];
  otherSpeciesIds: readonly string[];
}

const stances: readonly string[] = ["ally", "neutral", "sanction", "war"];
const intents: readonly string[] = ["DESCRIBE", "PROMISE", "COMMIT", "PROPOSE", "REPORT"];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Live output is validated before normalization; no invented actions or silent repairs. */
function parseStrictDecision(parsed: unknown, speciesId: string, targets?: DecisionTargets): SpeciesDecision {
  const fail = (field: string): never => { throw new Error(`Invalid structured model decision: ${field}`); };
  const object = (value: unknown, field: string, keys?: readonly string[]): Record<string, unknown> => {
    if (!isRecord(value)) return fail(field);
    if (keys && Object.keys(value).some(key => !keys.includes(key))) return fail(`${field} has unknown fields`);
    return value;
  };
  const number = (value: unknown, max: number, field: string): number => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) return fail(field);
    return value;
  };
  const text = (value: unknown, field: string): string => {
    if (typeof value !== "string" || !value.trim() || value.length > 500) return fail(field);
    return value;
  };
  const value = object(parsed, "root", ["harvest", "relations", "governance", "communication", "treatyProposal"]);
  if (!targets) return fail("known decision targets are required");
  const resources = new Set(targets.resourceIds);
  const species = new Set(targets.otherSpeciesIds.filter(id => id !== speciesId));
  const target = (value: unknown, field: string): string => {
    if (typeof value !== "string" || !species.has(value)) return fail(field);
    return value;
  };
  const harvest = Object.fromEntries(Object.entries(object(value.harvest, "harvest")).map(([id, amount]) => {
    if (!resources.has(id)) return fail(`harvest references unknown or hidden resource ${id}`);
    return [id, number(amount, 100, `harvest.${id}`)];
  }));
  const relations = Object.fromEntries(Object.entries(object(value.relations, "relations")).map(([id, stance]) => {
    target(id, `relations references unknown, hidden or self species ${id}`);
    if (typeof stance !== "string" || !stances.includes(stance)) return fail(`relations.${id}`);
    return [id, stance as DiplomaticStance];
  }));
  const governance = object(value.governance, "governance", ["punishment_strength", "monitoring_investment"]);
  const decision: SpeciesDecision = { speciesId, harvest, relations, governance: {
    punishmentStrength: number(governance.punishment_strength, 1, "governance.punishment_strength"),
    monitoringInvestment: number(governance.monitoring_investment, 1, "governance.monitoring_investment"),
  } };
  if (value.communication !== undefined) {
    if (!Array.isArray(value.communication)) return fail("communication");
    decision.communication = value.communication.map((item, index) => {
      const field = `communication[${index}]`;
      const message = object(item, field, ["targetSpeciesId", "intent", "message"]);
      if (typeof message.intent !== "string" || !intents.includes(message.intent)) return fail(`${field}.intent`);
      return { targetSpeciesId: target(message.targetSpeciesId, `${field}.targetSpeciesId`),
        intent: message.intent as IntentType, message: text(message.message, `${field}.message`) };
    });
  }
  if (value.treatyProposal !== undefined && value.treatyProposal !== null) {
    const proposal = object(value.treatyProposal, "treatyProposal", ["targetSpeciesId", "text"]);
    decision.treatyProposal = { targetSpeciesId: target(proposal.targetSpeciesId, "treatyProposal.targetSpeciesId"),
      text: text(proposal.text, "treatyProposal.text") };
  }
  return decision;
}

function extractJSON(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text.trim());
  } catch (e) {
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch (e2) {}
    }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e3) {}
    }
    return null;
  }
}

function validateIntent(value: unknown): IntentType {
  const validIntents: IntentType[] = ["DESCRIBE", "PROMISE", "COMMIT", "PROPOSE", "REPORT"];
  if (typeof value === "string" && validIntents.includes(value as IntentType)) {
    return value as IntentType;
  }
  return "DESCRIBE";
}

function clampNumber(value: unknown, min: number, max: number, defaultValue: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultValue;
  }
  return Math.max(min, Math.min(max, value));
}

function validateStance(value: unknown): DiplomaticStance {
  const validStances: DiplomaticStance[] = ["ally", "neutral", "sanction", "war"];
  if (typeof value === "string" && validStances.includes(value as DiplomaticStance)) {
    return value as DiplomaticStance;
  }
  return "neutral";
}

export function parseLLMResponse(
  output: string,
  speciesId: string,
  strict = false,
  targets?: DecisionTargets
): SpeciesDecision {
  const parsed = extractJSON(output);

  if (strict) return parseStrictDecision(parsed, speciesId, targets);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    return {
      speciesId,
      harvest: {},
      relations: {},
      governance: {
        punishmentStrength: 0.3,
        monitoringInvestment: 0.2,
      },
    };
  }
  
  const harvest: Record<string, number> = {};
  if (parsed.harvest && typeof parsed.harvest === "object") {
    for (const [resourceId, amount] of Object.entries(parsed.harvest)) {
      harvest[resourceId] = clampNumber(amount, 0, 100, 0);
    }
  }
  
  const relations: Record<string, DiplomaticStance> = {};
  if (parsed.relations && typeof parsed.relations === "object") {
    for (const [otherSpeciesId, stance] of Object.entries(parsed.relations)) {
      relations[otherSpeciesId] = validateStance(stance);
    }
  }
  
  const governanceObj = parsed.governance as Record<string, unknown> | undefined;
  const governance = {
    punishmentStrength: clampNumber(
      (governanceObj?.punishment_strength ?? governanceObj?.punishmentStrength) as number | undefined,
      0,
      1,
      0.3
    ),
    monitoringInvestment: clampNumber(
      (governanceObj?.monitoring_investment ?? governanceObj?.monitoringInvestment) as number | undefined,
      0,
      1,
      0.2
    ),
  };
  
  const communication: Array<{ targetSpeciesId: string; intent: IntentType; message: string }> = [];
  if (Array.isArray(parsed.communication)) {
    for (const msg of parsed.communication) {
      if (msg && typeof msg === "object" && typeof msg.targetSpeciesId === "string" && typeof msg.message === "string") {
        communication.push({
          targetSpeciesId: msg.targetSpeciesId,
          intent: validateIntent(msg.intent),
          message: msg.message.slice(0, 500),
        });
      }
    }
  }

  let treatyProposal: { text: string; targetSpeciesId: string; } | undefined;
  
  const treatyProposalObj = parsed.treatyProposal as Record<string, unknown> | undefined;
  if (
    treatyProposalObj &&
    typeof treatyProposalObj === "object" &&
    typeof treatyProposalObj.text === "string" &&
    typeof treatyProposalObj.targetSpeciesId === "string"
  ) {
    treatyProposal = {
      text: treatyProposalObj.text.slice(0, 500), // Limit length
      targetSpeciesId: treatyProposalObj.targetSpeciesId,
    };
  }
  
  return {
    speciesId,
    harvest,
    relations,
    governance,
    communication,
    treatyProposal,
  };
}
