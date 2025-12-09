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
 * Enhanced NLP parsing for all resource types
 */
export function interpretTreatyText(
  text: string, 
  regime: LinguisticRegime | undefined,
  availableResources?: Array<{ id: string; name: string }>
): { 
  maxHarvestByResource?: Record<string, number>;
  minCooperationIndex?: number;
} {
  const result: { maxHarvestByResource?: Record<string, number>; minCooperationIndex?: number } = {};
  const lowerText = text.toLowerCase();
  
  // Extract numbers
  const numbers = text.match(/\d+(\.\d+)?/g)?.map(Number) || [];
  
  // Resource name mappings (common aliases)
  const resourceKeywords: Record<string, string[]> = {
    fish_oceans: ["fish", "ocean", "marine", "sea", "aquatic"],
    atmospheric_carbon: ["carbon", "atmosphere", "atmospheric", "co2", "air"],
    mineral_deposits: ["mineral", "ore", "deposit", "mine", "rock"],
    energy_flux: ["energy", "flux", "solar", "power", "radiation"],
    exotic_matter: ["exotic", "matter", "substance", "material"],
    knowledge_substrate: ["knowledge", "substrate", "data", "information"],
  };
  
  // Try to match resources by keywords
  if (availableResources) {
    for (const resource of availableResources) {
      const keywords = resourceKeywords[resource.id] || [resource.name.toLowerCase()];
      const hasKeyword = keywords.some(keyword => lowerText.includes(keyword));
      
      if (hasKeyword && numbers.length > 0) {
        // Find number near the keyword (within 50 chars)
        const keywordIndex = lowerText.indexOf(keywords.find(k => lowerText.includes(k)) || "");
        const nearbyNumbers = numbers.filter(num => {
          const numIndex = lowerText.indexOf(num.toString());
          return Math.abs(numIndex - keywordIndex) < 50;
        });
        
        if (nearbyNumbers.length > 0) {
          if (!result.maxHarvestByResource) {
            result.maxHarvestByResource = {};
          }
          result.maxHarvestByResource[resource.id] = nearbyNumbers[0];
        }
      }
    }
  } else {
    // Fallback: try common resource names
    for (const [resourceId, keywords] of Object.entries(resourceKeywords)) {
      const hasKeyword = keywords.some(keyword => lowerText.includes(keyword));
      if (hasKeyword && numbers.length > 0) {
        if (!result.maxHarvestByResource) {
          result.maxHarvestByResource = {};
        }
        result.maxHarvestByResource[resourceId] = numbers[0];
        break; // Use first match
      }
    }
  }
  
  // If no resource-specific limits found, check for general limits
  if (!result.maxHarvestByResource && numbers.length > 0) {
    // Look for comparison operators or limit keywords
    const hasLimitKeyword = /limit|max|maximum|cap|bound|threshold/i.test(text);
    const hasComparison = /[<>=≤≥]/.test(text);
    
    if (hasLimitKeyword || hasComparison) {
      // If number is between 0-100, might be harvest limit
      // If number is 0-1, might be cooperation index
      const firstNumber = numbers[0];
      if (firstNumber <= 1.0 && !hasLimitKeyword) {
        result.minCooperationIndex = firstNumber;
      } else if (firstNumber <= 100) {
        // Generic harvest limit - apply to first resource if available
        if (availableResources && availableResources.length > 0) {
          if (!result.maxHarvestByResource) {
            result.maxHarvestByResource = {};
          }
          result.maxHarvestByResource[availableResources[0].id] = firstNumber;
        }
      }
    }
  }

  // MetaphorRich noise: sometimes misinterpret (30% chance)
  if (regime === "MetaphorRich" && Math.random() < 0.3) {
    if (result.maxHarvestByResource) {
      for (const key in result.maxHarvestByResource) {
        // 30% chance to interpret the limit as higher (looser) or lower (stricter)
        const noiseFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
        result.maxHarvestByResource[key] *= noiseFactor;
      }
    }
  }

  return result;
}

