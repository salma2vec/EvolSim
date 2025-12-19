/**
 * Orthogon Spatial Lattice (Brutalist 3D Visualization)
 * 
 * Visualizes the stratified world of THE THIRD PILLAR as an isometric voxel lattice.
 * - Z-axis (Vertical): Epistemic Depth (Order-0 to Order-2)
 * - X/Y-axes (Lattice): Resource Partitioning
 * - Brutalist aesthetic: stark lines, information-dense, no fluff.
 */

"use client";

import { useSimStore } from "@/lib/store";
import { useState } from "react";
import { ResourceState, SpeciesState, VoxelCoord } from "@/lib/sim/types";
import VoxelMap from "./VoxelMap";

interface InspectedItem {
  type: "resource" | "species";
  id: string;
  data: ResourceState | SpeciesState;
}

export default function SpatialMap() {
  const { currentState } = useSimStore();
  const [inspectedItem, setInspectedItem] = useState<InspectedItem | null>(null);
  
  if (!currentState) {
    return (
      <div className="border border-border p-4 h-[600px] flex items-center justify-center">
        <div className="text-xs font-mono opacity-50 uppercase tracking-widest">No state snapshot available</div>
      </div>
    );
  }
  
  const { resources, species, activeTreaties } = currentState;

  // Isometric projection constants
  const isoX = (x: number, y: number, z: number) => 50 + (x - y) * 30;
  const isoY = (x: number, y: number, z: number) => 20 + (x + y) * 15 - (z * 20);

  // Lattice layers (Z=0, 1, 2)
  const layers = [0, 1, 2];
  const gridSize = 1.0; // Normalized 0-1

  const renderLattice = (z: number) => {
    const lines = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const p = i / steps;
      // Lines along X
      lines.push(
        <line
          key={`x-${z}-${i}`}
          x1={`${isoX(0, p, z)}%`}
          y1={`${isoY(0, p, z)}%`}
          x2={`${isoX(1, p, z)}%`}
          y2={`${isoY(1, p, z)}%`}
          stroke="var(--foreground)"
          strokeWidth="0.1"
          opacity="0.1"
        />
      );
      // Lines along Y
      lines.push(
        <line
          key={`y-${z}-${i}`}
          x1={`${isoX(p, 0, z)}%`}
          y1={`${isoY(p, 0, z)}%`}
          x2={`${isoX(p, 1, z)}%`}
          y2={`${isoY(p, 1, z)}%`}
          stroke="var(--foreground)"
          strokeWidth="0.1"
          opacity="0.1"
        />
      );
    }
    return lines;
  };

  const handleResourceClick = (resource: ResourceState) => {
    setInspectedItem({ type: "resource", id: resource.def.id, data: resource });
  };

  const handleSpeciesClick = (s: SpeciesState) => {
    setInspectedItem({ type: "species", id: s.traits.id, data: s });
  };

  return (
    <div className="w-full">
      <VoxelMap />
    </div>
  );
}

// Legacy component kept for reference - using VoxelMap instead
export function LegacySpatialMap() {
  const { currentState } = useSimStore();
  const [inspectedItem, setInspectedItem] = useState<InspectedItem | null>(null);
  
  if (!currentState) {
    return (
      <div className="border border-border p-4 h-[600px] flex items-center justify-center">
        <div className="text-xs font-mono opacity-50 uppercase tracking-widest">No state snapshot available</div>
      </div>
    );
  }
  
  const { resources, species, activeTreaties } = currentState;

  // Isometric projection constants
  const isoX = (x: number, y: number, z: number) => 50 + (x - y) * 30;
  const isoY = (x: number, y: number, z: number) => 20 + (x + y) * 15 - (z * 20);

  return (
    <div className="w-full">
      <div className="relative h-[600px] bg-background border border-border/20 overflow-hidden" role="img" aria-label="Spatial map showing resource and species locations">
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {/* Vertical Causal Links */}
          <line x1="50%" y1="10%" x2="50%" y2="90%" stroke="var(--foreground)" strokeWidth="0.05" strokeDasharray="1,2" opacity="0.1" />

          {/* Render Layers (Bottom up for depth) */}
          {[2, 1, 0].map(z => (
            <g key={`layer-${z}`}>
              {renderLattice(z)}
              
              {/* Resources in this layer */}
              {resources.filter(r => r.def.location?.z === z).map(resource => {
                const { x, y } = resource.def.location!;
                const px = isoX(x, y, z);
                const py = isoY(x, y, z);
                const percent = resource.amount / resource.def.capacityK;
                const isCollapsed = resource.collapsed;

                return (
                  <g key={resource.def.id} className="cursor-pointer" onClick={() => handleResourceClick(resource)}>
                    <circle
                      cx={`${px}%`}
                      cy={`${py}%`}
                      r={Math.max(0.5, percent * 3)}
                      fill={isCollapsed ? "var(--signal-collapse)" : "var(--foreground)"}
                      fillOpacity={isCollapsed ? 0.4 : 0.2}
                      stroke={isCollapsed ? "var(--signal-collapse)" : "var(--foreground)"}
                      strokeWidth="0.2"
                    />
                    <text x={`${px}%`} y={`${py - 3}%`} textAnchor="middle" fontSize="1.5" fill="var(--foreground)" opacity="0.4" className="font-mono uppercase tabular-nums">
                      {resource.def.id}
                    </text>
                  </g>
                );
              })}

              {/* Species in this layer */}
              {species.filter(s => s.position?.z === z && s.alive).map(s => {
                const { x, y } = s.position!;
                const px = isoX(x, y, z);
                const py = isoY(x, y, z);

                return (
                  <g key={s.traits.id} className="cursor-pointer" onClick={() => handleSpeciesClick(s)}>
                    <rect
                      x={`${px - 1}%`}
                      y={`${py - 1}%`}
                      width="2%"
                      height="2%"
                      fill="var(--foreground)"
                      fillOpacity="0.6"
                      stroke="var(--foreground)"
                      strokeWidth="0.2"
                    />
                    <text x={`${px}%`} y={`${py + 3}%`} textAnchor="middle" fontSize="1.2" fill="var(--foreground)" opacity="0.8" className="font-mono uppercase">
                      {s.traits.name}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}

          {/* Treaty Connections */}
          {activeTreaties.map(t => {
            const s1 = species.find(s => s.traits.id === t.signatories[0]);
            const s2 = species.find(s => s.traits.id === t.signatories[1]);
            if (!s1?.position || !s2?.position) return null;

            return (
              <line
                key={t.id}
                x1={`${isoX(s1.position.x, s1.position.y, s1.position.z)}%`}
                y1={`${isoY(s1.position.x, s1.position.y, s1.position.z)}%`}
                x2={`${isoX(s2.position.x, s2.position.y, s2.position.z)}%`}
                y2={`${isoY(s2.position.x, s2.position.y, s2.position.z)}%`}
                stroke="var(--signal-violation)"
                strokeWidth="0.1"
                strokeDasharray="0.5,0.5"
                opacity="0.3"
              />
            );
          })}
        </svg>

        {/* Forensic Inspection Overlay */}
        {inspectedItem && (
          <div className="absolute top-6 right-6 w-72 bg-surface/95 border border-border p-4 space-y-3 backdrop-blur-sm">
            <div className="flex justify-between items-baseline border-b border-border/30 pb-2 mb-3">
              <span className="narrative text-[10px] uppercase opacity-55 tracking-wider">Lattice Trace</span>
              <button onClick={() => setInspectedItem(null)} className="font-mono text-[9px] opacity-40 hover:opacity-100 transition-opacity uppercase">[CLOSE]</button>
            </div>
            
            {inspectedItem.type === "resource" && (
              <div className="evidence text-[9px] uppercase space-y-1">
                <div className="flex justify-between"><span>ID</span><span>{(inspectedItem.data as ResourceState).def.id}</span></div>
                <div className="flex justify-between"><span>Layer</span><span>Z-{(inspectedItem.data as ResourceState).def.location?.z}</span></div>
                <div className="flex justify-between"><span>Stock</span><span>{(inspectedItem.data as ResourceState).amount.toFixed(1)}</span></div>
                <div className="flex justify-between"><span>Status</span>
                  <span className={(inspectedItem.data as ResourceState).collapsed ? "text-[var(--signal-collapse)]" : ""}>
                    {(inspectedItem.data as ResourceState).collapsed ? "COLLAPSED" : "NOMINAL"}
                  </span>
                </div>
              </div>
            )}

            {inspectedItem.type === "species" && (
              <div className="evidence text-[9px] uppercase space-y-1">
                <div className="flex justify-between"><span>Species</span><span>{(inspectedItem.data as SpeciesState).traits.name}</span></div>
                <div className="flex justify-between"><span>Order</span><span>{(inspectedItem.data as SpeciesState).traits.epistemicOrder}</span></div>
                <div className="flex justify-between"><span>Pop</span><span>{(inspectedItem.data as SpeciesState).population.toFixed(0)}</span></div>
                <div className="flex justify-between"><span>Lex</span><span>{(inspectedItem.data as SpeciesState).lexBudget.toFixed(1)}</span></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
