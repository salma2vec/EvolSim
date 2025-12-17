/**
 * Spatial Map Component
 * 
 * Visualizes resources and species on a 2D map.
 * - Resources as circles (size = amount/capacity)
 * - Species as markers (position, color by policy)
 * - Collapsed resources in red
 * - Active treaties as lines between species
 * - No animations - static representation
 */

"use client";

import { useSimStore } from "@/lib/store";
import { useState } from "react";
import { ResourceState, SpeciesState, Treaty } from "@/lib/sim/types";

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
        <div className="text-xs font-mono opacity-50">No state available</div>
      </div>
    );
  }
  
  const { resources, species, activeTreaties } = currentState;
  
  // Filter to only resources/species with positions
  const resourcesWithPos = resources.filter(r => r.def.location);
  const speciesWithPos = species.filter(s => s.position);
  
  if (resourcesWithPos.length === 0 && speciesWithPos.length === 0) {
    return (
      <div className="border border-border p-4 h-[600px] flex items-center justify-center">
        <div className="text-xs font-mono opacity-50">No spatial data available</div>
      </div>
    );
  }
  
  const handleResourceClick = (resource: ResourceState) => {
    setInspectedItem({
      type: "resource",
      id: resource.def.id,
      data: resource,
    });
  };
  
  const handleSpeciesClick = (species: SpeciesState) => {
    setInspectedItem({
      type: "species",
      id: species.traits.id,
      data: species,
    });
  };
  
  // Get treaty lines (connections between species)
  const treatyLines: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> = [];
  activeTreaties.forEach((treaty) => {
    if (treaty.signatories.length >= 2) {
      const signatory1 = species.find(s => s.traits.id === treaty.signatories[0]);
      const signatory2 = species.find(s => s.traits.id === treaty.signatories[1]);
      
      if (signatory1?.position && signatory2?.position) {
        treatyLines.push({
          from: signatory1.position,
          to: signatory2.position,
        });
      }
    }
  });
  
  return (
    <div className="border border-border p-4 bg-surface/5">
      <div className="font-serif text-xs uppercase tracking-wide mb-6 opacity-60">Spatial Dynamics</div>
      
      <div className="relative h-[600px] bg-background border border-border">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0"
        >
          {/* Treaty lines */}
          {treatyLines.map((line, idx) => (
            <line
              key={idx}
              x1={line.from.x * 100}
              y1={line.from.y * 100}
              x2={line.to.x * 100}
              y2={line.to.y * 100}
              stroke="var(--foreground)"
              strokeWidth="0.3"
              opacity="0.2"
            />
          ))}
          
          {/* Resources */}
          {resourcesWithPos.map((resource) => {
            const { location } = resource.def;
            if (!location) return null;
            
            const percent = resource.amount / resource.def.capacityK;
            const radius = Math.max(1.5, Math.min(6, percent * 6));
            const isCollapsed = resource.collapsed;
            
            return (
              <g
                key={resource.def.id}
                onClick={() => handleResourceClick(resource)}
                className="cursor-pointer"
              >
                <circle
                  cx={location.x * 100}
                  cy={location.y * 100}
                  r={radius}
                  fill={isCollapsed ? "var(--signal-collapse)" : "var(--foreground)"}
                  fillOpacity={isCollapsed ? 0.3 : 0.05}
                  stroke={isCollapsed ? "var(--signal-collapse)" : "var(--foreground)"}
                  strokeWidth="0.3"
                  strokeOpacity={isCollapsed ? 0.8 : 0.3}
                />
                <text
                  x={location.x * 100}
                  y={location.y * 100 - radius - 2}
                  textAnchor="middle"
                  fontSize="2.5"
                  fill="var(--foreground)"
                  opacity="0.5"
                  className="font-mono uppercase tracking-tighter"
                >
                  {resource.def.id}
                </text>
              </g>
            );
          })}
          
          {/* Species markers */}
          {speciesWithPos.map((s) => {
            if (!s.position) return null;
            
            const isAlive = s.alive;
            const size = 2.5;
            
            return (
              <g
                key={s.traits.id}
                onClick={() => handleSpeciesClick(s)}
                className="cursor-pointer"
              >
                <rect
                  x={s.position.x * 100 - size/2}
                  y={s.position.y * 100 - size/2}
                  width={size}
                  height={size}
                  fill={isAlive ? "var(--foreground)" : "var(--signal-collapse)"}
                  fillOpacity={isAlive ? 0.4 : 0.2}
                  stroke="var(--foreground)"
                  strokeWidth="0.3"
                  strokeOpacity={isAlive ? 0.8 : 0.2}
                />
                <text
                  x={s.position.x * 100}
                  y={s.position.y * 100 + size + 2}
                  textAnchor="middle"
                  fontSize="2"
                  fill="var(--foreground)"
                  opacity={isAlive ? 0.7 : 0.3}
                  className="font-mono uppercase tracking-tighter"
                >
                  {s.traits.name}
                </text>
              </g>
            );
          })}
        </svg>
        
        {/* Inspection panel */}
        {inspectedItem && (
          <div className="absolute bottom-4 left-4 right-4 bg-background border border-border p-4 z-10 space-y-3">
            <div className="flex justify-between items-baseline border-b border-border/20 pb-2">
              <div className="font-serif text-sm uppercase tracking-widest opacity-60 italic">
                Evidential Trace: {inspectedItem.type}
              </div>
              <button
                onClick={() => setInspectedItem(null)}
                className="text-[10px] font-mono opacity-40 hover:opacity-100 uppercase tracking-widest"
              >
                [Dismiss]
              </button>
            </div>
            
            {inspectedItem.type === "resource" && (
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[10px] font-mono opacity-80 uppercase tabular-nums">
                <div className="flex justify-between border-b border-border/10 pb-1">
                  <span className="opacity-50">Identifier</span>
                  <span>{(inspectedItem.data as ResourceState).def.id}</span>
                </div>
                <div className="flex justify-between border-b border-border/10 pb-1">
                  <span className="opacity-50">Current Stock</span>
                  <span>{(inspectedItem.data as ResourceState).amount.toFixed(1)}</span>
                </div>
                <div className="flex justify-between border-b border-border/10 pb-1">
                  <span className="opacity-50">Max Capacity</span>
                  <span>{(inspectedItem.data as ResourceState).def.capacityK.toFixed(1)}</span>
                </div>
                <div className="flex justify-between border-b border-border/10 pb-1">
                  <span className="opacity-50">Regen Rate</span>
                  <span>{((inspectedItem.data as ResourceState).def.regenRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between border-b border-border/10 pb-1">
                  <span className="opacity-50">Collapse Threshold</span>
                  <span>{(inspectedItem.data as ResourceState).def.collapseThreshold.toFixed(1)}</span>
                </div>
                <div className="flex justify-between border-b border-border/10 pb-1">
                  <span className="opacity-50">Condition</span>
                  <span className={(inspectedItem.data as ResourceState).collapsed ? "text-[var(--signal-collapse)] font-bold" : "text-emerald-500"}>
                    {(inspectedItem.data as ResourceState).collapsed ? "COLLAPSED" : "FUNCTIONAL"}
                  </span>
                </div>
              </div>
            )}
            
            {inspectedItem.type === "species" && (
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[10px] font-mono opacity-80 uppercase tabular-nums">
                <div className="flex justify-between border-b border-border/10 pb-1">
                  <span className="opacity-50">Identity</span>
                  <span>{(inspectedItem.data as SpeciesState).traits.name}</span>
                </div>
                <div className="flex justify-between border-b border-border/10 pb-1">
                  <span className="opacity-50">Intelligence</span>
                  <span>{(inspectedItem.data as SpeciesState).policyBrainId}</span>
                </div>
                <div className="flex justify-between border-b border-border/10 pb-1">
                  <span className="opacity-50">Population</span>
                  <span>{(inspectedItem.data as SpeciesState).population.toFixed(0)}</span>
                </div>
                <div className="flex justify-between border-b border-border/10 pb-1">
                  <span className="opacity-50">Status</span>
                  <span className={(inspectedItem.data as SpeciesState).alive ? "text-emerald-500" : "text-[var(--signal-collapse)] font-bold"}>
                    {(inspectedItem.data as SpeciesState).alive ? "ACTIVE" : "EXTINCT"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/10 pb-1">
                  <span className="opacity-50">Epistemic Order</span>
                  <span>{(inspectedItem.data as SpeciesState).traits.epistemicOrder || "NONE"}</span>
                </div>
                <div className="flex justify-between border-b border-border/10 pb-1">
                  <span className="opacity-50">Linguistic Regime</span>
                  <span>{(inspectedItem.data as SpeciesState).traits.linguisticRegime || "NONE"}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

