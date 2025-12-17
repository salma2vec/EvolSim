/**
 * Spatial model: Simple fixed-position layout for visualization
 * 
 * Resources and species are assigned positions on a 2D grid.
 * Positions are deterministic (grid-based) for reproducibility.
 */

import { ResourceDef, SpeciesState, ResourceState } from "./types";
import { getRNG } from "./random";

/**
 * Assign grid-based positions to resources
 * 
 * Resources are placed on a grid with spacing to avoid overlap.
 * Position is deterministic based on resource index.
 */
export function assignResourcePositions(
  resources: ResourceState[],
  gridSize: number = 5 // 5x5 grid
): void {
  const spacing = 1.0 / (gridSize + 1);
  
  resources.forEach((resource, index) => {
    if (!resource.def.location) {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      
      resource.def.location = {
        x: (col + 1) * spacing,
        y: (row + 1) * spacing,
      };
    }
  });
}

/**
 * Assign initial positions to species
 * 
 * Species are positioned near resources (attracted to high-resource areas)
 * or randomly if no resources available.
 */
export function assignSpeciesPositions(
  species: SpeciesState[],
  resources: ResourceState[],
  gridSize: number = 5
): void {
  const rng = getRNG();
  
  // If no resources, place species randomly on grid
  if (resources.length === 0) {
    species.forEach((s) => {
      if (!s.position) {
        s.position = {
          x: rng.randomFloat(0.1, 0.9),
          y: rng.randomFloat(0.1, 0.9),
        };
      }
    });
    return;
  }
  
  // Place species near resources (weighted by resource amount)
  species.forEach((s) => {
    if (!s.position) {
      // Calculate weighted center of resources
      let totalWeight = 0;
      let weightedX = 0;
      let weightedY = 0;
      
      resources.forEach((resource) => {
        if (resource.def.location) {
          const weight = resource.amount / resource.def.capacityK;
          totalWeight += weight;
          weightedX += resource.def.location.x * weight;
          weightedY += resource.def.location.y * weight;
        }
      });
      
      if (totalWeight > 0) {
        // Position near weighted center with some randomness
        const centerX = weightedX / totalWeight;
        const centerY = weightedY / totalWeight;
        const offset = 0.15; // Max offset from center
        
        s.position = {
          x: Math.max(0.05, Math.min(0.95, centerX + rng.randomFloat(-offset, offset))),
          y: Math.max(0.05, Math.min(0.95, centerY + rng.randomFloat(-offset, offset))),
        };
      } else {
        // Fallback: random position
        s.position = {
          x: rng.randomFloat(0.1, 0.9),
          y: rng.randomFloat(0.1, 0.9),
        };
      }
    }
  });
}

/**
 * Initialize spatial layout for a world
 * 
 * Assigns positions to all resources and species.
 */
export function initializeSpatialLayout(
  resources: ResourceState[],
  species: SpeciesState[]
): void {
  assignResourcePositions(resources);
  assignSpeciesPositions(species, resources);
}

