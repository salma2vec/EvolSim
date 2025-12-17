/**
 * Language mechanics (Embassytown-inspired)
 * 
 * Language as a restricted action space, not text flavor.
 * Mechanically enforces constraints by rejecting invalid proposals at parse-time.
 */

import { LinguisticRegime, Treaty } from "./types";

/**
 * Result of treaty text validation
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  parsedConstraints?: {
    maxHarvestByResource?: Record<string, number>;
    minCooperationIndex?: number;
  };
}

/**
 * Get the prompt description for a linguistic regime
 */
export function getLinguisticConstraintPrompt(regime: LinguisticRegime | undefined): string {
  if (!regime) return "";

  switch (regime) {
    case "LiteralOnly":
      return `LANGUAGE CONSTRAINTS: LiteralOnly
You can only state propositions grounded in current observable state.
You cannot make unconditional future promises.
You cannot lie in language; defection can only occur via action.
Treaty proposals must be factual inequality constraints based on current or invariant truths.
Example: "Harvest of resource X shall not exceed 50 units" (if 50 is observable from current state).
Invalid: "I promise we will harvest less" (unconditional future promise).`;

    case "AnchoredReference":
      return `LANGUAGE CONSTRAINTS: AnchoredReference
You can only express commitments by referencing prior events or states.
New abstract commitments require a prior "anchor event".
This limits how fast norms and institutions can form.
Treaty proposals MUST reference a specific past epoch or event.
Example: "As in Epoch 12 when resource X was at 80 units, we shall limit harvest to 50".
Invalid: "We shall limit harvest" (no anchor).`;

    case "Expressive":
      return `LANGUAGE CONSTRAINTS: Expressive
You can speak freely, including counterfactuals and promises.
Language is cheap; enforcement is noisy.
Treaties derived from this regime carry ambiguity penalties (30% interpretation variance).
You may lie, exaggerate, or use flowery language, but trust is costly.`;

    default:
      return "";
  }
}

/**
 * Validate if a treaty text conforms to the linguistic regime
 * 
 * Returns validation result with parse-time rejection for invalid proposals.
 * This is the mechanical enforcement of language constraints.
 */
export function validateTreatyText(
  text: string, 
  regime: LinguisticRegime | undefined,
  availableResources?: Array<{ id: string; name: string }>
): ValidationResult {
  if (!regime) {
    // No constraints: parse and return
    return {
      valid: true,
      parsedConstraints: interpretTreatyText(text, undefined, availableResources),
    };
  }

  const lowerText = text.toLowerCase();

  switch (regime) {
    case "LiteralOnly": {
      // Must contain numbers or comparison operators (factual constraints)
      const hasNumbers = /\d/.test(text) || /[<>=≤≥]/.test(text);
      
      // Cannot contain unconditional future promises
      const hasUnconditionalPromise = 
        /\b(will|shall|promise|swear|vow|guarantee)\b.*\b(future|tomorrow|next|later)\b/i.test(text) ||
        /\bI\s+(promise|swear|vow|guarantee)\b/i.test(text);
      
      // Must reference observable state (resource names, current amounts)
      const hasObservableReference = availableResources 
        ? availableResources.some(r => lowerText.includes(r.name.toLowerCase()) || lowerText.includes(r.id.toLowerCase()))
        : true; // If no resources provided, skip this check
      
      if (!hasNumbers) {
        return {
          valid: false,
          reason: "LiteralOnly: Must contain numerical constraints or comparison operators",
        };
      }
      
      if (hasUnconditionalPromise) {
        return {
          valid: false,
          reason: "LiteralOnly: Cannot make unconditional future promises",
        };
      }
      
      if (!hasObservableReference && availableResources) {
        return {
          valid: false,
          reason: "LiteralOnly: Must reference observable resources or current state",
        };
      }
      
      return {
        valid: true,
        parsedConstraints: interpretTreatyText(text, regime, availableResources),
      };
    }

    case "AnchoredReference": {
      // Must contain reference to past event (epoch, event ID, or "remember"/"as in")
      const hasAnchor = 
        /\b(epoch|event|step|time)\s+\d+/i.test(text) ||
        /\b(as|like|remember|recall|when)\s+(epoch|event|step|time)\s+\d+/i.test(text) ||
        /\b(as|like)\s+in\s+(epoch|event|step|time)\s+\d+/i.test(text);
      
      if (!hasAnchor) {
        return {
          valid: false,
          reason: "AnchoredReference: Must reference a specific past epoch or event (e.g., 'As in Epoch 12...')",
        };
      }
      
      return {
        valid: true,
        parsedConstraints: interpretTreatyText(text, regime, availableResources),
      };
    }

    case "Expressive": {
      // Almost anything goes, but must have minimum length
      if (text.length < 10) {
        return {
          valid: false,
          reason: "Expressive: Treaty text too short (minimum 10 characters)",
        };
      }
      
      // Parse with ambiguity noise
      return {
        valid: true,
        parsedConstraints: interpretTreatyText(text, regime, availableResources),
      };
    }

    default:
      return {
        valid: true,
        parsedConstraints: interpretTreatyText(text, undefined, availableResources),
      };
  }
}

/**
 * Interpret treaty text into machine-readable constraints
 * 
 * Enhanced NLP parsing for all resource types.
 * For Expressive regime, applies ambiguity penalties.
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
          let value = nearbyNumbers[0];
          
          // Expressive regime: apply ambiguity penalty (30% variance)
          if (regime === "Expressive") {
            const noiseFactor = 0.85 + Math.random() * 0.3; // 0.85 to 1.15 (30% variance)
            value *= noiseFactor;
          }
          
          result.maxHarvestByResource[resource.id] = value;
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
        let value = numbers[0];
        
        if (regime === "Expressive") {
          const noiseFactor = 0.85 + Math.random() * 0.3;
          value *= noiseFactor;
        }
        
        result.maxHarvestByResource[resourceId] = value;
        break; // Use first match
      }
    }
  }
  
  // If no resource-specific limits found, check for general limits
  if (!result.maxHarvestByResource && numbers.length > 0) {
    const hasLimitKeyword = /limit|max|maximum|cap|bound|threshold/i.test(text);
    const hasComparison = /[<>=≤≥]/.test(text);
    
    if (hasLimitKeyword || hasComparison) {
      const firstNumber = numbers[0];
      if (firstNumber <= 1.0 && !hasLimitKeyword) {
        result.minCooperationIndex = firstNumber;
      } else if (firstNumber <= 100) {
        if (availableResources && availableResources.length > 0) {
          if (!result.maxHarvestByResource) {
            result.maxHarvestByResource = {};
          }
          let value = firstNumber;
          
          if (regime === "Expressive") {
            const noiseFactor = 0.85 + Math.random() * 0.3;
            value *= noiseFactor;
          }
          
          result.maxHarvestByResource[availableResources[0].id] = value;
        }
      }
    }
  }

  return result;
}
