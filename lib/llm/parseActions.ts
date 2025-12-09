/**
 * Parse LLM responses into structured SpeciesDecision objects
 */

import { SpeciesDecision, DiplomaticStance } from "../sim/types";

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

function clampNumber(value: unknown, min: number, max: number, defaultValue: number): number {
  if (typeof value !== "number" || isNaN(value)) {
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
  speciesId: string
): SpeciesDecision {
  const parsed = extractJSON(output);
  
  if (!parsed || typeof parsed !== "object") {
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
  
  const governance = {
    punishmentStrength: clampNumber(
      parsed.governance?.punishment_strength ?? parsed.governance?.punishmentStrength,
      0,
      1,
      0.3
    ),
    monitoringInvestment: clampNumber(
      parsed.governance?.monitoring_investment ?? parsed.governance?.monitoringInvestment,
      0,
      1,
      0.2
    ),
  };
  
  let treatyProposal: { text: string; targetSpeciesId: string; } | undefined;
  
  if (
    parsed.treatyProposal &&
    typeof parsed.treatyProposal === "object" &&
    typeof parsed.treatyProposal.text === "string" &&
    typeof parsed.treatyProposal.targetSpeciesId === "string"
  ) {
    treatyProposal = {
      text: parsed.treatyProposal.text.slice(0, 500), // Limit length
      targetSpeciesId: parsed.treatyProposal.targetSpeciesId,
    };
  }
  
  return {
    speciesId,
    harvest,
    relations,
    governance,
    treatyProposal,
  };
}
