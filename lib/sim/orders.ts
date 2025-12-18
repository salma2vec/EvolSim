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

import { EpistemicOrder, InformationState, WorldState, SimEvent, SpeciesState, ResourceState } from "./types";

/**
 * Get the decision interval (how many epochs between actions)
 */
export function getDecisionInterval(order: EpistemicOrder | undefined): number {
  switch (order) {
    case "Order-0":
      return 10; // Decadal: Acts every 10 epochs
    case "Order-1":
      return 5;  // Annual: Acts every 5 epochs
    case "Order-2":
      return 1;  // Daily: Acts every epoch
    default:
      return 1;
  }
}

/**
 * Get observation bandwidth for an order
 */
export function getObservationBandwidth(order: EpistemicOrder | undefined): "local" | "summarized_global" | "full_global" {
  switch (order) {
    case "Order-0":
      return "full_global"; // High Order sees everything
    case "Order-1":
      return "summarized_global"; // Mid Order sees summaries
    case "Order-2":
      return "local"; // Low Order sees only local/immediate
    default:
      return "full_global";
  }
}

/**
 * Get memory length for an order
 */
export function getMemoryLength(order: EpistemicOrder | undefined): number {
  switch (order) {
    case "Order-0":
      return 100; // Very long memory
    case "Order-1":
      return 50;  // Long memory
    case "Order-2":
      return 10;  // Short memory
    default:
      return 10;
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
 * Enforce asymmetric visibility rules
 * 
 * Rule:
 * - Order-0 sees Order-0, Order-1, Order-2
 * - Order-1 sees Order-1, Order-2
 * - Order-2 sees only Order-2
 */
export function canSeeSpecies(observerOrder: EpistemicOrder | undefined, targetOrder: EpistemicOrder | undefined): boolean {
  if (!observerOrder) return true; // Default/Global observer
  if (!targetOrder) return true;

  const orderRank = {
    "Order-0": 0,
    "Order-1": 1,
    "Order-2": 2
  };

  const observerRank = orderRank[observerOrder];
  const targetRank = orderRank[targetOrder];

  // Higher rank (smaller number) sees everyone at or below their rank (larger or equal number)
  // Wait, the rule is:
  // Order-0 sees Order-1 and Order-2 (and implicitly Order-0)
  // Order-1 sees Order-1 and Order-2
  // Order-2 sees only Order-2
  
  // So:
  // Order-0 (0) can see target >= 0 (all)
  // Order-1 (1) can see target >= 1 (Order-1, Order-2)
  // Order-2 (2) can see target >= 2 (Order-2)

  return targetRank >= observerRank;
}

/**
 * Enforce asymmetric visibility for resources
 * (Based on Z-axis / Epistemic Depth)
 */
export function canSeeResource(observerOrder: EpistemicOrder | undefined, resourceZ: number): boolean {
  if (!observerOrder) return true;

  const orderRank = {
    "Order-0": 0,
    "Order-1": 1,
    "Order-2": 2
  };

  const observerRank = orderRank[observerOrder];
  
  // Resources also have an epistemic class (Z)
  // Z=0 is accessible by Order-0, Z=1 by Order-1, etc.
  // Actually, standard visibility: observer sees Z >= its own rank
  return resourceZ >= observerRank;
}

/**
 * Summarize history for long-interval orders
 */
export function summarizeMemory(
  events: SimEvent[],
  memoryLength: number
): string {
  if (events.length === 0) {
    return "No significant events in memory window.";
  }
  
  const eventCounts: Record<string, number> = {};
  for (const event of events) {
    eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
  }
  
  const parts: string[] = [];
  if (eventCounts.COLLAPSE) parts.push(`${eventCounts.COLLAPSE} resource collapse(s)`);
  if (eventCounts.EXTINCTION) parts.push(`${eventCounts.EXTINCTION} extinction(s)`);
  if (eventCounts.TREATY) parts.push(`${eventCounts.TREATY} treaty(ies) signed`);
  if (eventCounts.DEFECT) parts.push(`${eventCounts.DEFECT} defection(s)`);
  
  if (parts.length === 0) return "Stable period with no major events.";
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
  
  const memoryEvents: SimEvent[] = [];
  const startStep = Math.max(0, timeStep - memoryLength);
  for (const state of history) {
    if (state.timeStep >= startStep && state.timeStep < timeStep) {
      memoryEvents.push(...state.events);
    }
  }
  
  let memorySummary: string | undefined;
  if (order !== "Order-2" && memoryEvents.length > 0) {
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
  const isConclaveNow = informationState.contactWindow;

  switch (order) {
    case "Order-0":
      return `EPISTEMIC ORDER: Order-0 (The Sæcular/High Order)
You act every ${interval} epochs (Decadal scale).
You have a full view of the Orthogon lattice (Orders 0, 1, and 2).
You have very long memory. You must stabilize the system at a planetary scale.
Status: ${isConclaveNow ? "ACTIVE" : "OBSERVING"}.`;

    case "Order-1":
      return `EPISTEMIC ORDER: Order-1 (The Administrative Order)
You act every ${interval} epochs (Annual scale).
You see the Administrative and Emergent layers (Orders 1 and 2).
You focus on regional coordination and institutional stability.
Status: ${isConclaveNow ? "ACTIVE" : "OBSERVING"}.`;

    case "Order-2":
      return `EPISTEMIC ORDER: Order-2 (The Emergent Order)
You act every ${interval} epoch (Daily scale).
You see only the Emergent layer (Order 2).
You focus on immediate survival and local extraction.
Status: ACTIVE.`;

    default:
      return "";
  }
}
