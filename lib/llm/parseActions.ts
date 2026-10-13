/**
 * Parse LLM responses into structured SpeciesDecision objects
 */

import { SpeciesDecision, DiplomaticStance, IntentType } from "../sim/types";

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
  strict = false
): SpeciesDecision {
  const parsed = extractJSON(output);
  
  if (strict && (!parsed || Array.isArray(parsed) || typeof parsed !== "object" ||
      !parsed.harvest || Array.isArray(parsed.harvest) || typeof parsed.harvest !== "object" ||
      Object.values(parsed.harvest).some(x => typeof x !== "number" || !Number.isFinite(x)))) {
    throw new Error("Invalid structured model decision");
  }
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
