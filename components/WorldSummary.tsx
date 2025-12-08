/**
 * World summary: Planet card with environment icons and resource gauges
 */

"use client";

import { useSimStore } from "@/lib/store";

export default function WorldSummary() {
  const { currentState } = useSimStore();
  
  if (!currentState) {
    return (
      <div className="border border-border p-4">
        <p className="text-gray-400 font-mono text-xs uppercase">No telemetry available</p>
      </div>
    );
  }
  
  const { planet, resources } = currentState;
  
  const metrics = [
    { label: "GRAVITY", value: planet.gravity },
    { label: "VOLATILITY", value: planet.volatility },
    { label: "RICHNESS", value: planet.richness },
    { label: "METABOLIC", value: planet.metabolicCost },
    { label: "YIELD", value: planet.productivity },
  ];
  
  return (
    <div className="space-y-6 p-2">
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 font-mono text-xs">
        {metrics.map((m) => (
          <div key={m.label} className="flex justify-between items-end border-b border-border border-dashed pb-1">
            <span className="opacity-50">{m.label}</span>
            <span className="text-accent ml-2">{m.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
      
      <div className="space-y-4">
        <h3 className="text-xs font-bold tracking-widest uppercase opacity-50">Resource Levels</h3>
        <div className="space-y-3">
          {resources.map((resource) => {
            const percent = (resource.amount / resource.def.capacityK) * 100;
            const thresholdPercent = (resource.def.collapseThreshold / resource.def.capacityK) * 100;
            const isLow = percent < thresholdPercent * 1.2;
            const isCollapsed = resource.collapsed;
            
            return (
              <div key={resource.def.id} className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono uppercase">
                  <span className="opacity-70">{resource.def.name}</span>
                  <span className={isCollapsed ? "text-red-500 blink" : isLow ? "text-accent" : "opacity-70"}>
                    {isCollapsed ? "COLLAPSED" : `${percent.toFixed(0)}%`}
                  </span>
                </div>
                
                {/* Custom Bar Component */}
                <div className="w-full h-3 bg-border/20 border border-border relative">
                  {/* Threshold Marker */}
                  <div 
                    className="absolute top-0 bottom-0 w-px bg-red-500/50 z-10"
                    style={{ left: `${thresholdPercent}%` }}
                  />
                  
                  <div
                    className={`h-full transition-all duration-500 ${isCollapsed ? "bg-red-500/20" : isLow ? "bg-accent/50" : "bg-foreground"}`}
                    style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

