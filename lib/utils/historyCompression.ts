/**
 * History compression utilities for efficient state storage
 */

import { WorldState } from "../sim/types";

/**
 * Compress world state by removing redundant data
 */
export function compressWorldState(state: WorldState): Partial<WorldState> {
  return {
    timeStep: state.timeStep,
    planet: state.planet,
    resources: state.resources.map(r => ({
      def: { id: r.def.id }, // Only store ID
      amount: r.amount,
      collapsed: r.collapsed,
    })),
    species: state.species.map(s => ({
      traits: { id: s.traits.id },
      population: s.population,
      techLevel: s.techLevel,
      alive: s.alive,
      governance: s.governance,
    })),
    events: state.events.slice(-10), // Only keep last 10 events
    activeTreaties: state.activeTreaties.map(t => ({
      id: t.id,
      signatories: t.signatories,
      violated: t.violated,
    })),
  };
}

/**
 * Decompress world state (requires full state reference)
 */
export function decompressWorldState(
  compressed: Partial<WorldState>,
  reference: WorldState
): WorldState {
  return {
    timeStep: compressed.timeStep ?? reference.timeStep,
    planet: compressed.planet ?? reference.planet,
    resources: compressed.resources?.map(cr => {
      const ref = reference.resources.find(r => r.def.id === cr.def.id);
      return ref ? { ...ref, amount: cr.amount, collapsed: cr.collapsed } : ref!;
    }) ?? reference.resources,
    species: compressed.species?.map(cs => {
      const ref = reference.species.find(s => s.traits.id === cs.traits.id);
      return ref ? {
        ...ref,
        population: cs.population,
        techLevel: cs.techLevel,
        alive: cs.alive,
        governance: cs.governance,
      } : ref!;
    }) ?? reference.species,
    events: compressed.events ?? reference.events,
    activeTreaties: compressed.activeTreaties?.map(ct => {
      const ref = reference.activeTreaties.find(t => t.id === ct.id);
      return ref ? { ...ref, violated: ct.violated } : ref!;
    }) ?? reference.activeTreaties,
  };
}

/**
 * Compress entire history
 */
export function compressHistory(history: WorldState[]): Partial<WorldState>[] {
  if (history.length === 0) return [];
  
  const compressed: Partial<WorldState>[] = [];
  let lastFullState = history[0];
  
  // Store first state fully
  compressed.push(history[0]);
  
  // Compress subsequent states
  for (let i = 1; i < history.length; i++) {
    compressed.push(compressWorldState(history[i]));
    lastFullState = history[i];
  }
  
  return compressed;
}

