/**
 * Epistemic Orders (Anathem-inspired)
 * 
 * Implements epistemic asymmetry as temporal and informational structure.
 * Each order defines:
 * - decision_interval: how often the agent may act
 * - observation_bandwidth: how much global vs local state it sees
 * - contact_window: when treaties may be proposed or accepted
 * - memory: how much history is retained and how it's summarized
 */

import { EpistemicOrder, InformationState, WorldState, SimEvent } from "./types";

/**
 * Get the decision interval (how many epochs between actions)
 */
export function getDecisionInterval(order: EpistemicOrder | undefined): number {
  switch (order) {
    case "FastOrder":
      return 1;
    case "CloisteredOrder":
      return 10; // Acts every 10 epochs
    default:
      return 1;
  }
}

/**
 * Get observation bandwidth for an order
 */
export function getObservationBandwidth(order: EpistemicOrder | undefined): "local" | "summarized_global" | "full_global" {
  switch (order) {
    case "FastOrder":
      return "full_global"; // Full local + noisy global
    case "CloisteredOrder":
      return "summarized_global"; // Summarized global, detailed local history
    default:
      return "full_global";
  }
}

/**
 * Get memory length for an order
 */
export function getMemoryLength(order: EpistemicOrder | undefined): number {
  switch (order) {
    case "FastOrder":
      return 5; // Short memory (last 5 steps)
    case "CloisteredOrder":
      return 50; // Long memory (last 50 steps, but summarized)
    default:
      return 5;
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
 * Summarize history for long-interval orders
 * 
 * Creates a compact summary of events over the memory window.
 */
export function summarizeMemory(
  events: SimEvent[],
  memoryLength: number
): string {
  if (events.length === 0) {
    return "No significant events in memory window.";
  }
  
  // Count event types
  const eventCounts: Record<string, number> = {};
  for (const event of events) {
    eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
  }
  
  // Summarize
  const parts: string[] = [];
  if (eventCounts.COLLAPSE) {
    parts.push(`${eventCounts.COLLAPSE} resource collapse(s)`);
  }
  if (eventCounts.EXTINCTION) {
    parts.push(`${eventCounts.EXTINCTION} extinction(s)`);
  }
  if (eventCounts.TREATY) {
    parts.push(`${eventCounts.TREATY} treaty(ies) signed`);
  }
  if (eventCounts.DEFECT) {
    parts.push(`${eventCounts.DEFECT} defection(s)`);
  }
  if (eventCounts.DECEPTION_GAP) {
    parts.push(`${eventCounts.DECEPTION_GAP} deception gap(s) detected`);
  }
  
  if (parts.length === 0) {
    return "Stable period with no major events.";
  }
  
  return parts.join(", ") + ".";
}

/**
 * Build information state for a species based on its epistemic order
 */
export function buildInformationState(
  order: EpistemicOrder | undefined,
  timeStep: number,
  history: WorldState[],
  memoryLength: number
): InformationState {
  const interval = getDecisionInterval(order);
  const bandwidth = getObservationBandwidth(order);
  const contactWindow = isContactWindow(order, timeStep);
  
  // Get events from memory window
  const memoryEvents: SimEvent[] = [];
  const startStep = Math.max(0, timeStep - memoryLength);
  for (const state of history) {
    if (state.timeStep >= startStep && state.timeStep < timeStep) {
      memoryEvents.push(...state.events);
    }
  }
  
  // Summarize memory for long-interval orders
  let memorySummary: string | undefined;
  if (order === "CloisteredOrder" && memoryEvents.length > 0) {
    memorySummary = summarizeMemory(memoryEvents, memoryLength);
  }
  
  return {
    observationBandwidth: bandwidth,
    memoryLength,
    memorySummary,
    contactWindow,
  };
}

/**
 * Get the prompt description for an epistemic order
 */
export function getEpistemicPrompt(
  order: EpistemicOrder | undefined, 
  timeStep: number,
  informationState: InformationState
): string {
  if (!order) return "";

  const interval = getDecisionInterval(order);
  const nextConclave = Math.ceil(timeStep / interval) * interval;
  const isConclaveNow = informationState.contactWindow;

  let basePrompt = "";

  switch (order) {
    case "FastOrder":
      basePrompt = `EPISTEMIC ORDER: FastOrder
You act every timestep.
You have short memory (last ${informationState.memoryLength} epochs).
You have full local observability and noisy global information.
You are always open to negotiation.`;
      break;

    case "CloisteredOrder":
      basePrompt = `EPISTEMIC ORDER: CloisteredOrder
You belong to a long-lived order that only acts every ${interval} epochs.
You must think in terms of decades, not years. Short-term fluctuations are noise.
You have long memory (last ${informationState.memoryLength} epochs, summarized).
You observe summarized global patterns and detailed local history.
You are currently ${isConclaveNow ? "IN CONCLAVE (Active)" : "CLOISTERED (Silent)"}.
${informationState.memorySummary ? `Memory Summary: ${informationState.memorySummary}` : ""}`;
      break;
  }

  if (order === "CloisteredOrder") {
    if (isConclaveNow) {
      basePrompt += `\nThis is a decisive epoch. You must set policy for the next ${interval} epochs.`;
    } else {
      basePrompt += `\nYou cannot act directly this epoch. Observe and record.`;
    }
  }

  return basePrompt;
}
