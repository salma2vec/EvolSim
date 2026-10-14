/**
 * Species list: Row list with badges, population bars, health status
 */

"use client";

import { useState } from "react";
import { useSimStore } from "@/lib/store";
import SpeciesDetailDrawer from "./SpeciesDetailDrawer";
import { isContactWindow } from "@/lib/sim/orders";

export default function SpeciesList() {
  const { currentState } = useSimStore();
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(null);
  
  if (!currentState) {
    return (
      <div className="bg-surface p-4 rounded-sm border border-muted">
        <p className="text-gray-400">No world loaded</p>
      </div>
    );
  }
  
  const { species } = currentState;
  const colors = ["#4A90E2", "#2ECC71", "#E74C3C", "#F39C12", "#9B59B6", "#1ABC9C"];
  
  const getHealthStatus = (s: typeof species[0]) => {
    if (!s.alive) return { label: "Extinct", color: "text-gray-500" };
    if (s.population < 10000) return { label: "Collapsing", color: "text-warning" };
    if (s.population > s.traits.reproductionRate * 2000000) return { label: "Booming", color: "text-accent" };
    return { label: "Stable", color: "text-white" };
  };
  
  return (
    <>
      <div className="bg-surface p-4 rounded-sm border border-muted">
        <h2 className="text-xl font-bold mb-4 text-white">Species</h2>
        <div className="space-y-2">
          {species.map((s, idx) => {
            const health = getHealthStatus(s);
            const color = colors[idx % colors.length];
            const maxPop = Math.max(...species.map((sp) => sp.population), 1);
            const popPercent = (s.population / maxPop) * 100;
            
            // Check if active (for cloistered species)
            const isActive = isContactWindow(s.traits.epistemicOrder, currentState.timeStep);
            
            return (
              <div
                key={s.traits.id}
                onClick={() => setSelectedSpeciesId(s.traits.id)}
                className={`p-3 rounded-sm border hover:border-primary cursor-pointer transition-colors ${isActive ? 'border-muted' : 'border-gray-800 opacity-75'}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-4 h-4 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-semibold text-white">{s.traits.name}</span>
                  <span className={`text-xs ${health.color}`}>{health.label}</span>
                  
                  {/* Status Indicator */}
                  {s.traits.epistemicOrder && s.traits.epistemicOrder !== undefined && (
                    <span className={`text-[10px] px-1 rounded-sm ml-auto ${isActive ? "bg-accent/20 text-accent border border-accent/50" : "bg-gray-800 text-gray-500 border border-gray-700"}`}>
                      {isActive ? "CONCLAVE" : "CLOISTERED"}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Population</span>
                    <span className="text-white font-mono">
                      {(s.population / 1000000).toFixed(2)}M
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${popPercent}%`,
                        backgroundColor: color,
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
