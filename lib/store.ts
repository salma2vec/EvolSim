/**
 * Zustand store for simulation state
 */

import { create } from "zustand";
import { WorldState, SimConfig } from "./sim/types";

interface SimStore {
  currentState: WorldState | null;
  config: SimConfig | null;
  provenance: Record<string, unknown> | null;
  setRunMetadata: (config: SimConfig, provenance: Record<string, unknown>) => void;
  history: WorldState[];
  isPlaying: boolean;
  currentTimeStep: number;
  setState: (state: WorldState | null) => void;
  setHistory: (history: WorldState[]) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTimeStep: (step: number) => void;
  reset: () => void;
}

export const useSimStore = create<SimStore>((set) => ({
  currentState: null,
  config: null,
  provenance: null,
  setRunMetadata: (config, provenance) => set({config, provenance}),
  history: [],
  isPlaying: false,
  currentTimeStep: 0,
  setState: (state) => set({ currentState: state }),
  setHistory: (history) => set({ history, currentState: history[history.length - 1] || null, currentTimeStep: history.length - 1 }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTimeStep: (step) => {
    set((state) => {
      const newState = state.history[step] || null;
      return { currentTimeStep: step, currentState: newState };
    });
  },
  reset: () => set({ config: null, provenance: null, currentState: null, history: [], isPlaying: false, currentTimeStep: 0 }),
}));

