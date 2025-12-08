/**
 * Species list: Row list with badges, population bars, health status
 */

"use client";

import { useState } from "react";
import { useSimStore } from "@/lib/store";
import SpeciesDetailDrawer from "./SpeciesDetailDrawer";

export default function SpeciesList() {
  const { currentState } = useSimStore();
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(null);
  
  if (!currentState) {
    return (
      <div className="border border-border p-4">
        <p className="text-gray-400 font-mono text-xs uppercase">No species data loaded</p>
      </div>
    );
  }
  
  const { species } = currentState;
  const colors = ["var(--accent)", "#FF4500", "#00FFFF", "#FF00FF"];
  
  const getHealthStatus = (s: typeof species[0]) => {
    if (!s.alive) return { label: "EXTINCT", color: "text-foreground opacity-50" };
    if (s.population < 10000) return { label: "CRITICAL", color: "text-red-500 animate-pulse" };
    if (s.population > s.traits.reproductionRate * 2000000) return { label: "EXPANDING", color: "text-accent" };
    return { label: "STABLE", color: "text-foreground" };
  };
  
  return (
    <>
      <div>
        <h2 className="text-xs font-bold tracking-widest uppercase mb-4 opacity-50 pl-4 border-l-2 border-border">Biological Assets</h2>
        <div className="space-y-px border border-border bg-background">
          {species.map((s, idx) => {
            const health = getHealthStatus(s);
            const color = colors[idx % colors.length];
            const maxPop = Math.max(...species.map((sp) => sp.population), 1);
            const popPercent = (s.population / maxPop) * 100;
            
            return (
              <div
                key={s.traits.id}
                onClick={() => setSelectedSpeciesId(s.traits.id)}
                className="p-4 group cursor-pointer transition-all hover:bg-foreground hover:text-background border-b border-border last:border-b-0 relative overflow-hidden"
              >
                {/* Hover scan effect */}
                <div className="absolute inset-0 bg-scanlines opacity-0 group-hover:opacity-20 pointer-events-none" />
                
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-2"
                      style={{ backgroundColor: s.alive ? color : 'gray' }}
                    />
                    <span className="font-bold uppercase tracking-wide font-mono">{s.traits.name}</span>
                  </div>
                  <span className={`text-[10px] font-mono tracking-widest border px-1 ${health.color} border-current group-hover:text-background group-hover:border-background`}>
                    {health.label}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono opacity-70 group-hover:opacity-100">
                    <span>POPULATION</span>
                    <span>
                      {(s.population / 1000000).toFixed(3)}M
                    </span>
                  </div>
                  
                  {/* Blocky Progress Bar */}
                  <div className="w-full h-2 bg-border/20 border border-border/50">
                    <div
                      className="h-full bg-current transition-all duration-300"
                      style={{
                        width: `${popPercent}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {selectedSpeciesId && (
        <SpeciesDetailDrawer
          speciesId={selectedSpeciesId}
          onClose={() => setSelectedSpeciesId(null)}
        />
      )}
    </>
  );
}

