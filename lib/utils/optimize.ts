/**
 * Optimization utilities for simulation performance
 */

import { WorldState } from "../sim/types";

/**
 * Optimize world state for rendering (remove unnecessary data)
 */
export function optimizeForRendering(state: WorldState) {
  return {
    timeStep: state.timeStep,
    planet: state.planet,
    resources: state.resources.map(r => ({
      def: { id: r.def.id, name: r.def.name },
      amount: r.amount,
      collapsed: r.collapsed,
    })),
    species: state.species.map(s => ({
      traits: { id: s.traits.id, name: s.traits.name },
      population: s.population,
      alive: s.alive,
      techLevel: s.techLevel,
    })),
    events: state.events.slice(-20), // Only recent events
    activeTreaties: state.activeTreaties.map(t => ({
      id: t.id,
      signatories: t.signatories,
    })),
  };
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

