/**
 * Voxel-based 3D Minecraft-style visualization
 * 
 * Renders resources and species as 3D voxel cubes in an isometric view
 */

"use client";

import { useSimStore } from "@/lib/store";
import { useState } from "react";
import { ResourceState, SpeciesState } from "@/lib/sim/types";

interface InspectedItem {
  type: "resource" | "species";
  id: string;
  data: ResourceState | SpeciesState;
}

// Isometric projection helper
const isoX = (x: number, y: number, z: number) => (x - y) * 0.866;
const isoY = (x: number, y: number, z: number) => (x + y) * 0.5 - z * 0.707;

// Render a 3D voxel cube
function VoxelCube({ 
  x, y, z, 
  size = 1, 
  color, 
  opacity = 1,
  onClick 
}: { 
  x: number; 
  y: number; 
  z: number; 
  size?: number;
  color: string;
  opacity?: number;
  onClick?: () => void;
}) {
  const baseX = 50 + isoX(x, y, z) * 25;
  const baseY = 30 + isoY(x, y, z) * 25;
  const cubeSize = size * 3;
  
  // Top face
  const topPoints = [
    `${baseX},${baseY}`,
    `${baseX + cubeSize * 0.866},${baseY - cubeSize * 0.5}`,
    `${baseX + cubeSize * 0.866 - cubeSize * 0.866},${baseY - cubeSize * 0.5 - cubeSize * 0.5}`,
    `${baseX - cubeSize * 0.866},${baseY - cubeSize * 0.5}`,
  ].join(' ');
  
  // Front face
  const frontPoints = [
    `${baseX},${baseY}`,
    `${baseX + cubeSize * 0.866},${baseY - cubeSize * 0.5}`,
    `${baseX + cubeSize * 0.866},${baseY - cubeSize * 0.5 + cubeSize * 0.707}`,
    `${baseX},${baseY + cubeSize * 0.707}`,
  ].join(' ');
  
  // Right face
  const rightPoints = [
    `${baseX + cubeSize * 0.866},${baseY - cubeSize * 0.5}`,
    `${baseX + cubeSize * 0.866 - cubeSize * 0.866},${baseY - cubeSize * 0.5 - cubeSize * 0.5}`,
    `${baseX + cubeSize * 0.866 - cubeSize * 0.866},${baseY - cubeSize * 0.5 - cubeSize * 0.5 + cubeSize * 0.707}`,
    `${baseX + cubeSize * 0.866},${baseY - cubeSize * 0.5 + cubeSize * 0.707}`,
  ].join(' ');

  return (
    <g className={onClick ? "cursor-pointer" : ""} onClick={onClick}>
      {/* Top face (lighter) */}
      <polygon
        points={topPoints}
        fill={color}
        fillOpacity={opacity * 0.9}
        stroke="rgba(230, 227, 220, 0.2)"
        strokeWidth="0.1"
      />
      {/* Front face (medium) */}
      <polygon
        points={frontPoints}
        fill={color}
        fillOpacity={opacity * 0.7}
        stroke="rgba(230, 227, 220, 0.15)"
        strokeWidth="0.1"
      />
      {/* Right face (darker) */}
      <polygon
        points={rightPoints}
        fill={color}
        fillOpacity={opacity * 0.5}
        stroke="rgba(230, 227, 220, 0.1)"
        strokeWidth="0.1"
      />
    </g>
  );
}

export default function VoxelMap() {
  const { currentState } = useSimStore();
  const [inspectedItem, setInspectedItem] = useState<InspectedItem | null>(null);
  
  if (!currentState) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center border border-border/20 bg-surface/10">
        <div className="text-xs font-mono opacity-50 uppercase tracking-widest">No state snapshot available</div>
      </div>
    );
  }
  
  const { resources, species, activeTreaties } = currentState;

  return (
    <div className="w-full bg-surface border border-border/40 p-6">
      <div className="mb-8 flex items-center justify-between border-b border-border/30 pb-5">
        <h2 className="font-serif text-sm uppercase tracking-wider opacity-60 text-foreground/70">Voxel Lattice</h2>
        <div className="flex gap-5 text-[10px] font-mono uppercase tracking-wider opacity-40">
          <span className="flex items-center gap-2.5">
            <div className="w-3.5 h-3.5 border border-foreground/50 bg-foreground/10"></div>
            Order-0
          </span>
          <span className="flex items-center gap-2.5">
            <div className="w-3.5 h-3.5 border border-foreground/30 bg-foreground/5"></div>
            Order-1
          </span>
          <span className="flex items-center gap-2.5">
            <div className="w-3.5 h-3.5 border border-foreground/10 bg-foreground/2"></div>
            Order-2
          </span>
        </div>
      </div>
      
      <div className="relative w-full h-[600px] bg-background border border-border/30 overflow-hidden rounded-xs">
        <svg 
          width="100%" 
          height="100%" 
          viewBox="0 0 100 100" 
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
        >
          {/* Grid background */}
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(230, 227, 220, 0.05)" strokeWidth="0.1"/>
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grid)" />
          
          {/* Render layers from bottom to top */}
          {[2, 1, 0].map(z => (
            <g key={`layer-${z}`} opacity={z === 0 ? 1 : z === 1 ? 0.7 : 0.4}>
              {/* Resources as voxels */}
              {resources
                .filter(r => r.def.location?.z === z)
                .map(resource => {
                  const { x, y } = resource.def.location!;
                  const percent = resource.amount / resource.def.capacityK;
                  const isCollapsed = resource.collapsed;
                  const voxelSize = 0.5 + percent * 1.5;
                  
                  return (
                    <VoxelCube
                      key={resource.def.id}
                      x={x}
                      y={y}
                      z={z}
                      size={voxelSize}
                      color={isCollapsed ? "var(--signal-collapse)" : "var(--foreground)"}
                      opacity={isCollapsed ? 0.6 : 0.3 + percent * 0.4}
                      onClick={() => setInspectedItem({ type: "resource", id: resource.def.id, data: resource })}
                    />
                  );
                })}
              
              {/* Species as voxels */}
              {species
                .filter(s => s.position?.z === z && s.alive)
                .map(s => {
                  const { x, y } = s.position!;
                  
                  return (
                    <VoxelCube
                      key={s.traits.id}
                      x={x}
                      y={y}
                      z={z + 0.3}
                      size={0.8}
                      color="var(--foreground)"
                      opacity={0.8}
                      onClick={() => setInspectedItem({ type: "species", id: s.traits.id, data: s })}
                    />
                  );
                })}
            </g>
          ))}
          
          {/* Treaty connections */}
          {activeTreaties.map(t => {
            const s1 = species.find(s => s.traits.id === t.signatories[0]);
            const s2 = species.find(s => s.traits.id === t.signatories[1]);
            if (!s1?.position || !s2?.position) return null;
            
            const x1 = 50 + isoX(s1.position.x, s1.position.y, s1.position.z) * 25;
            const y1 = 30 + isoY(s1.position.x, s1.position.y, s1.position.z) * 25;
            const x2 = 50 + isoX(s2.position.x, s2.position.y, s2.position.z) * 25;
            const y2 = 30 + isoY(s2.position.x, s2.position.y, s2.position.z) * 25;
            
            return (
              <line
                key={t.id}
                x1={`${x1}%`}
                y1={`${y1}%`}
                x2={`${x2}%`}
                y2={`${y2}%`}
                stroke="var(--signal-violation)"
                strokeWidth="0.2"
                strokeDasharray="1,1"
                opacity="0.4"
              />
            );
          })}
        </svg>

        {/* Inspection overlay */}
        {inspectedItem && (
          <div className="absolute top-4 right-4 w-64 bg-surface/98 border border-border p-4 shadow-xl backdrop-blur-xs">
            <div className="flex justify-between items-baseline border-b border-border/30 pb-2 mb-3">
              <span className="font-serif text-[10px] uppercase tracking-wider opacity-60">Inspection</span>
              <button 
                onClick={() => setInspectedItem(null)} 
                className="font-mono text-[9px] opacity-40 hover:opacity-100 transition-opacity uppercase"
              >
                [CLOSE]
              </button>
            </div>
            
            {inspectedItem.type === "resource" && (
              <div className="font-mono text-[10px] uppercase space-y-2">
                <div className="flex justify-between">
                  <span className="opacity-50">ID</span>
                  <span>{(inspectedItem.data as ResourceState).def.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-50">Layer</span>
                  <span>Z-{(inspectedItem.data as ResourceState).def.location?.z}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-50">Stock</span>
                  <span className="tabular-nums">{(inspectedItem.data as ResourceState).amount.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-50">Status</span>
                  <span className={(inspectedItem.data as ResourceState).collapsed ? "text-[var(--signal-collapse)]" : ""}>
                    {(inspectedItem.data as ResourceState).collapsed ? "COLLAPSED" : "NOMINAL"}
                  </span>
                </div>
              </div>
            )}

            {inspectedItem.type === "species" && (
              <div className="font-mono text-[10px] uppercase space-y-2">
                <div className="flex justify-between">
                  <span className="opacity-50">Species</span>
                  <span>{(inspectedItem.data as SpeciesState).traits.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-50">Order</span>
                  <span>{(inspectedItem.data as SpeciesState).traits.epistemicOrder || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-50">Population</span>
                  <span className="tabular-nums">{((inspectedItem.data as SpeciesState).population / 1000000).toFixed(2)}M</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-50">Lex Budget</span>
                  <span className="tabular-nums">{(inspectedItem.data as SpeciesState).lexBudget.toFixed(1)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

