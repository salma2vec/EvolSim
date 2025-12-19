/**
 * Language mechanics (Embassytown-inspired)
 * 
 * Language as a restricted action space, not text flavor.
 * Mechanically enforces constraints by rejecting invalid proposals at parse-time.
 * 
 * CRITICAL: Truth verification is mechanical, not prompt-based.
 */

import { LinguisticRegime, Treaty, LivingSimile, EpistemicOrder } from "./types";

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
      return `LANGUAGE CONSTRAINTS: Expressive (Control Condition)
You can speak freely, including counterfactuals and promises.
Language is cheap; enforcement is noisy.
Treaties derived from this regime carry ambiguity penalties (30% interpretation variance).
You may lie, exaggerate, or use flowery language, but trust is costly.
NOTE: This is a control condition, not Embassytown-inspired. Embassytown Language cannot lie.`;

    default:
      return "";
  }
}

/**
 * Extract truth claims about current state from text
 * 
 * Returns claims about resource amounts, population, etc. that can be verified.
 */
function extractTruthClaims(
  text: string,
  availableResources?: Array<{ id: string; name: string; amount: number }>
): Array<{ resourceId?: string; claimedAmount: number; type: "resource" | "population" | "comparison" }> {
  const claims: Array<{ resourceId?: string; claimedAmount: number; type: "resource" | "population" | "comparison" }> = [];
  const lowerText = text.toLowerCase();
  
  if (!availableResources) return claims;
  
  // Extract numbers
  const numbers = text.match(/\d+(\.\d+)?/g)?.map(Number) || [];
  
  // Resource keywords
  const resourceKeywords: Record<string, string[]> = {
    fish_oceans: ["fish", "ocean", "marine", "sea", "aquatic"],
    atmospheric_carbon: ["carbon", "atmosphere", "atmospheric", "co2", "air"],
    mineral_deposits: ["mineral", "ore", "deposit", "mine", "rock"],
    energy_flux: ["energy", "flux", "solar", "power", "radiation"],
    exotic_matter: ["exotic", "matter", "substance", "material"],
    knowledge_substrate: ["knowledge", "substrate", "data", "information"],
  };
  
  // Find claims about resource amounts
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
        // Check if it's a claim about current state (has "is", "at", "equals", etc.)
        const claimPattern = new RegExp(
          `(is|at|equals?|currently|now)\\s*${nearbyNumbers[0]}|${nearbyNumbers[0]}\\s*(is|units?|amount)`,
          "i"
        );
        
        if (claimPattern.test(text)) {
          claims.push({
            resourceId: resource.id,
            claimedAmount: nearbyNumbers[0],
            type: "resource",
          });
        }
      }
    }
  }
  
  return claims;
}

/**
 * Verify truth claims against observable state
 * 
 * Returns false if any claim is false (mechanical enforcement of "cannot lie").
 */
function verifyTruthClaims(
  claims: Array<{ resourceId?: string; claimedAmount: number; type: "resource" | "population" | "comparison" }>,
  availableResources?: Array<{ id: string; name: string; amount: number }>
): { valid: boolean; reason?: string } {
  if (!availableResources) return { valid: true };
  
  for (const claim of claims) {
    if (claim.type === "resource" && claim.resourceId) {
      const resource = availableResources.find(r => r.id === claim.resourceId);
      if (resource) {
        // Allow 5% tolerance for perception noise
        const tolerance = resource.amount * 0.05;
        if (Math.abs(claim.claimedAmount - resource.amount) > tolerance) {
          return {
            valid: false,
            reason: `LiteralOnly: False claim about ${resource.name}: stated ${claim.claimedAmount}, actual ${resource.amount.toFixed(1)}`,
          };
        }
      }
    }
  }
  
  return { valid: true };
}

/**
 * Extract epoch reference from text
 */
function extractEpochReference(text: string): number | null {
  const epochMatch = text.match(/\b(epoch|event|step|time)\s+(\d+)/i);
  if (epochMatch) {
    return parseInt(epochMatch[2], 10);
  }
  return null;
}

/**
 * Validate if a treaty text conforms to the linguistic regime
 * 
 * Returns validation result with parse-time rejection for invalid proposals.
 * This is the mechanical enforcement of language constraints.
 * 
 * @param text - Treaty proposal text
 * @param regime - Linguistic regime constraint
 * @param availableResources - Resources with current amounts (for truth verification)
 * @param history - Past world states (for anchored reference validation)
 * @param proposerOrder - Epistemic order of proposer (for visibility checks)
 * @param availableSimiles - Living similes that can be referenced
 */
export function validateTreatyText(
  text: string, 
  regime: LinguisticRegime | undefined,
  availableResources?: Array<{ id: string; name: string; amount?: number }>,
  history?: Array<{ timeStep: number; resources: Array<{ def: { id: string }; amount: number }> }>,
  proposerOrder?: EpistemicOrder,
  availableSimiles?: LivingSimile[]
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
      
      // CRITICAL: Truth verification (mechanical enforcement of "cannot lie")
      if (availableResources && availableResources.some(r => r.amount !== undefined)) {
        const resourcesWithAmounts = availableResources.filter(r => r.amount !== undefined) as Array<{ id: string; name: string; amount: number }>;
        const truthClaims = extractTruthClaims(text, resourcesWithAmounts);
        
        if (truthClaims.length > 0) {
          const truthCheck = verifyTruthClaims(truthClaims, resourcesWithAmounts);
          if (!truthCheck.valid) {
            return {
              valid: false,
              reason: truthCheck.reason || "LiteralOnly: False claim about observable state",
            };
          }
        }
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
        // Check for living simile reference
        const hasSimileReference = availableSimiles && availableSimiles.some(simile => 
          lowerText.includes(simile.referent.toLowerCase()) || 
          lowerText.includes(`the agent who ${simile.action.toLowerCase()}`)
        );
        
        if (!hasSimileReference) {
          return {
            valid: false,
            reason: "AnchoredReference: Must reference a specific past epoch, event, or living simile (e.g., 'As in Epoch 12...' or 'the agent who harvested 50 units')",
          };
        }
      }
      
      // CRITICAL: Verify referenced epoch exists and proposer could observe it
      if (hasAnchor && history && proposerOrder) {
        const referencedEpoch = extractEpochReference(text);
        if (referencedEpoch !== null) {
          // Check if epoch exists
          const epochExists = history.some(state => state.timeStep === referencedEpoch);
          if (!epochExists) {
            return {
              valid: false,
              reason: `AnchoredReference: Referenced epoch ${referencedEpoch} does not exist in history`,
            };
          }
          
          // Check if proposer could observe that epoch (epistemic visibility)
          // For now, we assume all agents can see past epochs they reference
          // (This could be enhanced with actual visibility rules)
          
          // Extract claimed state from reference (e.g., "resource X was at 80 units")
          const stateClaimMatch = text.match(/(?:was|were|at)\s+(\d+)\s*(?:units?|amount)/i);
          if (stateClaimMatch && availableResources) {
            const claimedAmount = parseInt(stateClaimMatch[1], 10);
            const pastState = history.find(s => s.timeStep === referencedEpoch);
            
            if (pastState) {
              // Verify claimed state matches actual past state
              const resourceMatch = availableResources.find(r => 
                lowerText.includes(r.name.toLowerCase()) || lowerText.includes(r.id.toLowerCase())
              );
              
              if (resourceMatch) {
                const pastResource = pastState.resources.find(r => r.def.id === resourceMatch.id);
                if (pastResource) {
                  const tolerance = pastResource.amount * 0.1; // 10% tolerance
                  if (Math.abs(claimedAmount - pastResource.amount) > tolerance) {
                    return {
                      valid: false,
                      reason: `AnchoredReference: False claim about past state in epoch ${referencedEpoch}: stated ${claimedAmount}, actual ${pastResource.amount.toFixed(1)}`,
                    };
                  }
                }
              }
            }
          }
        }
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
