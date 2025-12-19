/**
 * World State Panel
 * 
 * Focus: Load-bearing variable (Extraction vs. Regeneration).
 * All values map to WorldState.resources.
 */

"use client";

import { useSimStore } from "@/lib/store";

export default function WorldStatePanel() {
  const { currentState } = useSimStore();
  
  if (!currentState) {
    return (
      <div className="border border-border p-4">
        <div className="font-serif text-xs uppercase tracking-wide mb-2 opacity-60">World State</div>
        <div className="text-xs font-mono opacity-50">No state available</div>
      </div>
    );
  }
  
  const { resources, events } = currentState;
  
  return (
    <div className="card">
      <div className="font-serif text-xs uppercase tracking-wide mb-8 opacity-65">System Dynamics: The Delta</div>
      
      <div className="space-y-12">
        {resources.map((resource) => {
          const amount = resource.amount;
          const capacity = resource.def.capacityK;
          const regenRate = resource.def.regenRate;
          const threshold = resource.def.collapseThreshold;
          const collapsed = resource.collapsed;
          
          // Calculate aggregate extraction from events in this timestep
          const totalHarvest = events
            .filter(e => e.type === "HARVEST" && e.data?.resourceId === resource.def.id)
            .reduce((sum, e) => sum + (e.data?.harvestAmount || 0), 0);
          
          // Logistic regen: g * R * (1 - R/K)
          const currentRegen = resource.def.regenRate * amount * (1 - amount / resource.def.capacityK);
          const delta = currentRegen - totalHarvest;
          const isDeficit = delta < 0;
          
          const percent = (amount / capacity) * 100;
          const thresholdPercent = (threshold / capacity) * 100;
          
          return (
            <div key={resource.def.id} className="space-y-4">
              {/* Resource ID & Amount */}
              <div className="flex justify-between items-baseline border-b border-border pb-3">
                <span className="font-serif text-base uppercase tracking-wide">{resource.def.id}</span>
                <span className={`text-sm font-mono ${collapsed ? 'text-[var(--signal-collapse)]' : 'opacity-90'}`}>
                  {collapsed ? 'COLLAPSED' : `${amount.toFixed(1)} / ${capacity.toFixed(1)}`}
                </span>
              </div>
              
              {/* THE DELTA: Extraction vs Regen */}
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div className="flex flex-col">
                  <span className="opacity-50 uppercase text-[10px]">Extraction</span>
                  <span className={isDeficit ? "text-[var(--signal-collapse)]" : ""}>{totalHarvest.toFixed(1)}</span>
                </div>
                <div className="flex flex-col text-center border-x border-border/30">
                  <span className="opacity-50 uppercase text-[10px]">Regeneration</span>
                  <span>{currentRegen.toFixed(1)}</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="opacity-50 uppercase text-[10px]">Net Delta</span>
                  <span className={isDeficit ? "text-[var(--signal-collapse)] font-bold" : "text-emerald-500"}>
                    {isDeficit ? "" : "+"}{delta.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Resource Level Bar */}
              <div className="relative h-8 bg-background border border-border">
                {/* Threshold Zone (Red background below threshold) */}
                <div 
                  className="absolute top-0 bottom-0 left-0 bg-[var(--signal-collapse)] opacity-10"
                  style={{ width: `${thresholdPercent}%` }}
                />
                
                {/* Threshold marker line */}
                <div 
                  className="absolute top-0 bottom-0 w-px bg-[var(--signal-collapse)] z-10"
                  style={{ left: `${thresholdPercent}%` }}
                />
                <div 
                  className="absolute -top-4 text-[8px] font-mono uppercase text-[var(--signal-collapse)]"
                  style={{ left: `${thresholdPercent}%` }}
                >
                  Collapse Zone
                </div>
                
                {/* Current amount bar */}
                <div
                  className={`h-full ${collapsed ? 'bg-[var(--signal-collapse)] opacity-30' : isDeficit ? 'bg-amber-500 opacity-20' : 'bg-foreground opacity-10'}`}
                  style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                />
              </div>
              
              {/* Static Metadata */}
              <div className="flex justify-between text-[10px] font-mono opacity-40 uppercase tracking-widest">
                <span>Max Capacity: {capacity}</span>
                <span>Base Regen Rate: {(regenRate * 100).toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
