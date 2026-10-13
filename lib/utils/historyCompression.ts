/**
 * History compression utilities for efficient state storage
 */

import { WorldState } from "../sim/types";

/**
 * Lossless snapshot. Compression must not silently discard simulation state.
 */
export function compressWorldState(state: WorldState): Partial<WorldState> {
  return structuredClone(state);
}

/**
 * Decompress world state (requires full state reference)
 */
export function decompressWorldState(
  compressed: Partial<WorldState>,
  reference: WorldState
): WorldState {
  return structuredClone({ ...reference, ...compressed });
}

/**
 * Compress entire history
 */
export function compressHistory(history: WorldState[]): Partial<WorldState>[] {
  if (history.length === 0) return [];
  
  const compressed: Partial<WorldState>[] = [];

  
  // Store first state fully
  compressed.push(history[0]);
  
  // Compress subsequent states
  for (let i = 1; i < history.length; i++) {
    compressed.push(compressWorldState(history[i]));

  }
  
  return compressed;
}

