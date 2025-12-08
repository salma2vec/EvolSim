/**
 * Language mechanics (Embassytown-inspired)
 * Controls how species can communicate and what constraints apply to treaties
 */

import { LinguisticRegime, Treaty } from "./types";

/**
 * Get the prompt description for a linguistic regime
 */
export function getLinguisticConstraintPrompt(regime: LinguisticRegime | undefined): string {
  if (!regime) return "";

  switch (regime) {
    case "LiteralOnly":
      return `LANGUAGE CONSTRAINTS
You are LiteralOnly. You cannot speak false propositions or make promises about future states you cannot guarantee.
You may only propose treaties that are factual inequality constraints based on current or invariant truths.
Do not use metaphor, simile, or "I promise" constructions. Use "We enable harvest < X" or "We set limit Y".`;

    case "SimileBound":
      return `LANGUAGE CONSTRAINTS
You are SimileBound. You cannot express abstract commitments directly.
You must ground any promise in a specific, past event (a "living simile").
Treaty text MUST reference a past epoch or event ID, e.g., "As in Epoch 12, we shall..." or "Like the crash of Resource X, we avoid..."
If you cannot find a relevant past event to reference, you cannot form the thought.`;

    case "MetaphorRich":
      return `LANGUAGE CONSTRAINTS
You are MetaphorRich. You speak in dense, high-context allegories.
You may lie, exaggerate, or use flowery language.
However, your treaties are ambiguous. "The river of fish shall flow forever" might mean "Harvest < 50" or "Harvest < 80".
Trust is costly. Clear communication is difficult but expressive power is high.`;

    case "Mathematical":
      return `LANGUAGE CONSTRAINTS
You are Mathematical. You prefer formal, quantitative descriptions.
Treaties should look like code or inequalities: "∀t > now, H(t) <= 0.5 * K".
Avoid narrative. Focus on invariants, bounds, and precise functional relationships.`;

    default:
      return "";
  }
}

/**
 * Validate if a treaty text conforms to the linguistic regime
 * Returns true if valid, false if invalid
 */
export function validateTreatyText(text: string, regime: LinguisticRegime | undefined): boolean {
  if (!regime) return true; // No constraints

  const lowerText = text.toLowerCase();

  switch (regime) {
    case "LiteralOnly":
      // Heuristic: Check for future tense "will", "promise", "shall" (soft ban)
      // and ensure it contains numbers or comparison operators
      const hasNumbers = /\d/.test(text) || /[<>=]/.test(text);
      const hasPromise = lowerText.includes("promise") || lowerText.includes("swear") || lowerText.includes("vow");
      // Strictness: LiteralOnly shouldn't "promise", they just state limits.
      // But we'll be lenient on grammar, stricter on content.
      return hasNumbers;

    case "SimileBound":
      // Must contain "like", "as", or reference "epoch" or "event"
      const hasSimileMarkers = 
        lowerText.includes("like ") || 
        lowerText.includes("as ") || 
        lowerText.includes("epoch") || 
        lowerText.includes("remember");
      return hasSimileMarkers;

    case "Mathematical":
      // Should contain math symbols or keywords
      const hasMath = /[<>=+*/]/.test(text) || 
        lowerText.includes("max") || 
        lowerText.includes("min") || 
        lowerText.includes("limit") || 
        lowerText.includes("bound");
      return hasMath;

    case "MetaphorRich":
      // Almost anything goes, but maybe minimal length?
      return text.length > 10;

    default:
      return true;
  }
}

/**
 * Interpret treaty text into machine-readable constraints
 * (Simplified NLP - mostly heuristic extraction)
 */
export function interpretTreatyText(text: string, regime: LinguisticRegime | undefined): { 
  maxHarvestByResource?: Record<string, number>;
  minCooperationIndex?: number;
} {
  const result: { maxHarvestByResource?: Record<string, number>; minCooperationIndex?: number } = {};
  
  // Extract numbers
  const numbers = text.match(/\d+(\.\d+)?/g)?.map(Number) || [];
  
  // Simple heuristic: if we see "fish" and a number, assume it's a limit
  if (text.toLowerCase().includes("fish") && numbers.length > 0) {
    result.maxHarvestByResource = { "fish_oceans": numbers[0] };
  } else if (numbers.length > 0) {
    // If no specific resource named, maybe it's a general cap? 
    // For v1, let's just guess it applies to the first/main resource or cooperation index
    // If the number is small (0-1), maybe it's cooperation index
    if (numbers[0] <= 1.0) {
      result.minCooperationIndex = numbers[0];
    } else {
      // If large, assume generic harvest cap (will need mapping to actual resource IDs in game loop context)
      // We'll leave it empty here and let the game loop logic try to attach it if context allows
      // or just treat it as "uninterpreted" which means it's purely reputation-based.
    }
  }

  // MetaphorRich noise: sometimes misinterpret
  if (regime === "MetaphorRich" && Math.random() < 0.3) {
    if (result.maxHarvestByResource) {
      for (const key in result.maxHarvestByResource) {
        // 30% chance to interpret the limit as higher (looser) or lower (stricter)
        result.maxHarvestByResource[key] *= (0.8 + Math.random() * 0.4);
      }
    }
  }

  return result;
}

