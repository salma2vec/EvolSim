/**
 * Orthogon Spatial Lattice: Voxel assignment logic
 * 
 * Resources and species are assigned voxels in a stratified 3D lattice.
 * - X/Y: Resource partitioning
 * - Z: Epistemic depth (Stratification)
 * 
 * This is a permission lattice, not a physics space.
 */

import { ResourceDef, SpeciesState, ResourceState, EpistemicOrder } from "./types";
import { getRNG } from "./random";

/**
 * Get Z-layer from Epistemic Order
 */
export function getZFromOrder(order: EpistemicOrder | undefined): number {
  switch (order) {
    case "Order-0": return 0;
    case "Order-1": return 1;
    case "Order-2": return 2;
    default: return 2;
  }
}

/**
 * Assign voxels to resources
 * 
 * Resources are distributed across layers.
 */
export function assignResourceVoxels(
  resources: ResourceState[]
): void {
  const rng = getRNG();
  
  resources.forEach((resource, index) => {
    if (!resource.def.location) {
      // Stratification: distribute resources across Z-layers
      // Default: spread them out
      const z = index % 3; 
      
      resource.def.location = {
        x: rng.randomFloat(0.1, 0.9),
        y: rng.randomFloat(0.1, 0.9),
        z: z,
      };
    }
  });
}

/**
 * Assign voxels to species
 * 
 * Species are fixed to the Z-layer of their Epistemic Order.
 */
export function assignSpeciesVoxels(
  species: SpeciesState[]
): void {
  const rng = getRNG();
  
  species.forEach((s) => {
    if (!s.position) {
      const z = getZFromOrder(s.traits.epistemicOrder);
      
      s.position = {
        x: rng.randomFloat(0.1, 0.9),
        y: rng.randomFloat(0.1, 0.9),
        z: z,
      };
    }
  });
}

/**
 * Initialize Orthogon lattice for a world
 */
export function initializeSpatialLayout(
  resources: ResourceState[],
  species: SpeciesState[]
): void {
  assignResourceVoxels(resources);
  assignSpeciesVoxels(species);
}
