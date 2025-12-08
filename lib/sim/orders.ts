/**
 * Epistemic Orders (Anathem-inspired)
 * Controls how species relate to time, knowledge, and contact frequency
 */

import { EpistemicOrder } from "./types";

/**
 * Get the prompt description for an epistemic order
 */
export function getEpistemicPrompt(order: EpistemicOrder | undefined, timeStep: number): string {
  if (!order) return "";

  const interval = getDecisionInterval(order);
  const nextConclave = Math.ceil(timeStep / interval) * interval;
  const isConclaveNow = timeStep % interval === 0;

  let basePrompt = "";

  switch (order) {
    case "FastSecular":
      basePrompt = `EPISTEMIC ORDER: FastSecular
You live in the "now". You react immediately to every event.
Your planning horizon is short. You are always open to negotiation.`;
      break;

    case "SlowCloistered":
      basePrompt = `EPISTEMIC ORDER: SlowCloistered
You belong to a long-lived order that only acts every ${interval} epochs.
You must think in terms of decades, not years. Short-term fluctuations are noise.
You are currently ${isConclaveNow ? "IN CONCLAVE (Active)" : "CLOISTERED (Silent)"}.`;
      break;

    case "OrderOfTheSky":
      basePrompt = `EPISTEMIC ORDER: OrderOfTheSky
You observe global patterns from a detached perspective.
You act every ${interval} epochs. You prioritize global invariants over local politics.
You are currently ${isConclaveNow ? "IN CONCLAVE (Active)" : "CLOISTERED (Silent)"}.`;
      break;

    case "OrderOfTheDeep":
      basePrompt = `EPISTEMIC ORDER: OrderOfTheDeep
You are buried deep in resource extraction logic. You act every ${interval} epochs.
Your primary concern is the deep substrate of the world (resources).
You are currently ${isConclaveNow ? "IN CONCLAVE (Active)" : "CLOISTERED (Silent)"}.`;
      break;
  }

  if (order !== "FastSecular") {
    if (isConclaveNow) {
      basePrompt += `\nThis is a decisive epoch. You must set policy for the next ${interval} epochs.`;
    } else {
      // This technically shouldn't be seen if we gate decisions correctly, 
      // but good for context if we do pass prompts during silence
      basePrompt += `\nYou cannot act directly this epoch. Observe and record.`;
    }
  }

  return basePrompt;
}

/**
 * Get the decision interval (how many epochs between actions)
 */
export function getDecisionInterval(order: EpistemicOrder | undefined): number {
  switch (order) {
    case "FastSecular":
      return 1;
    case "SlowCloistered":
      return 5;
    case "OrderOfTheSky":
      return 3;
    case "OrderOfTheDeep":
      return 10;
    default:
      return 1;
  }
}

/**
 * Check if a species is currently in a contact window (open to negotiation/decision)
 */
export function isContactWindow(order: EpistemicOrder | undefined, timeStep: number): boolean {
  if (!order) return true;
  const interval = getDecisionInterval(order);
  return timeStep % interval === 0;
}

/**
 * Check if a species can receive a treaty proposal in this epoch
 * (Usually matches contact window, but could be stricter)
 */
export function canReceiveTreaty(order: EpistemicOrder | undefined, timeStep: number): boolean {
  return isContactWindow(order, timeStep);
}

