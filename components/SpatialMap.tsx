/**
 * Spatial Map Component
 * 
 * Wrapper for VoxelMap - provides voxel/Minecraft-style 3D visualization
 */

"use client";

import VoxelMap from "./VoxelMap";

export default function SpatialMap() {
  return (
    <div className="w-full">
      <VoxelMap />
    </div>
  );
}
