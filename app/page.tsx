/**
 * THE THIRD PILLAR: Main Instrument Panel
 * 
 * 3-Layer Hierarchy:
 * 1. Interpretive Summary (Derived Narrative)
 * 2. Causal Panels (Extraction vs Regen Delta)
 * 3. Debug Section (Raw state & Full logs)
 */

"use client";

import WorldControls from "@/components/WorldControls";
import TreatyPanel from "@/components/TreatyPanel";
import WorldStatePanel from "@/components/WorldStatePanel";
import AgentPanel from "@/components/AgentPanel";
import TimelinePanel from "@/components/TimelinePanel";
import SpatialMap from "@/components/SpatialMap";
import InterpretiveSummary from "@/components/InterpretiveSummary";
import { useEffect, useState } from "react";
import { useSimStore } from "@/lib/store";
import { createWorldFromPreset } from "@/lib/sim/presets";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function Home() {
  const { setState, setHistory, currentState } = useSimStore();
  const [technicalMode, setTechnicalMode] = useState(false);
  const [viewMode, setViewMode] = useState<"causal" | "spatial">("causal");

  useEffect(() => {
    // Initialize with a default scenario if empty
    if (!currentState) {
      const { world } = createWorldFromPreset("two_species_simple_lake", undefined, 12345);
      setState(world);
      setHistory([world]);
    }
  }, [currentState, setState, setHistory]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground font-mono">
        <div className="max-w-[1800px] mx-auto p-6 md:p-8 space-y-12 md:space-y-16">
          
          {/* Layer 1: Interpretive Summary (The "So What?") */}
          <section className="space-y-6 md:space-y-8">
            <header className="flex flex-col md:flex-row justify-between items-start gap-4 md:gap-0 border-b border-border pb-4 md:pb-6 mb-8 md:mb-10">
              <div className="space-y-1">
                <h1 className="text-xs md:text-sm font-mono uppercase tracking-[0.3em] opacity-50">Scientific Instrument</h1>
                <div className="text-2xl md:text-4xl font-serif uppercase tracking-wider">The Third Pillar</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 border border-border px-2 py-1">
                    <button
                      onClick={() => setViewMode("causal")}
                      className={`text-[10px] font-mono uppercase px-2 py-1 ${
                        viewMode === "causal" 
                          ? "bg-foreground text-background" 
                          : "opacity-60 hover:opacity-100"
                      }`}
                    >
                      Causal View
                    </button>
                    <button
                      onClick={() => setViewMode("spatial")}
                      className={`text-[10px] font-mono uppercase px-2 py-1 ${
                        viewMode === "spatial" 
                          ? "bg-foreground text-background" 
                          : "opacity-60 hover:opacity-100"
                      }`}
                    >
                      Spatial Map
                    </button>
                  </div>
                  <label className="text-[10px] font-mono uppercase opacity-60 flex items-center gap-2 cursor-pointer border border-border px-3 py-2 hover:bg-surface/50">
                    <input
                      type="checkbox"
                      checked={technicalMode}
                      onChange={(e) => setTechnicalMode(e.target.checked)}
                      className="cursor-pointer"
                    />
                    Technical Mode
                  </label>
                </div>
                <WorldControls />
              </div>
            </header>

            <InterpretiveSummary />
          </section>

          {/* Layer 2: Causal Panels (The "Why?") */}
          {viewMode === "causal" ? (
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 lg:gap-10 items-start">
              {/* Left: Institutions */}
              <div className="lg:col-span-3 space-y-4">
                <div className="font-serif text-xs uppercase tracking-widest opacity-40 mb-2">Institutional Overlays</div>
                <TreatyPanel />
              </div>

              {/* Center: Load-bearing Variable (Delta & Resources) */}
              <div className="lg:col-span-6 space-y-4">
                <div className="font-serif text-xs uppercase tracking-widest opacity-40 mb-2">Primary Causal Chain: Extraction vs Regen</div>
                <WorldStatePanel />
              </div>

              {/* Right: Agent Policies */}
              <div className="lg:col-span-3 space-y-4">
                <div className="font-serif text-xs uppercase tracking-widest opacity-40 mb-2">Agent-Policy Outcomes</div>
                <AgentPanel />
              </div>
            </section>
          ) : (
            <section className="border border-border p-4 bg-surface/5">
              <SpatialMap />
            </section>
          )}

          {/* Layer 3: Debug Section (The "What Exactly?") */}
          {technicalMode && (
            <section className="pt-12 border-t border-border space-y-8 opacity-80">
              <div className="flex items-baseline gap-4">
                <h3 className="font-serif text-xl uppercase tracking-wider">Technical Forensics</h3>
                <span className="font-mono text-[10px] opacity-40 uppercase">Low-level execution data</span>
              </div>
              
              <div className="grid grid-cols-12 gap-8">
                <div className="col-span-8">
                  <TimelinePanel />
                </div>
                <div className="col-span-4 space-y-4">
                  <div className="panel p-4 border border-border bg-surface/20">
                    <div className="font-serif text-xs uppercase tracking-wide mb-3 opacity-60">Raw Snapshot</div>
                    <pre className="text-[9px] font-mono opacity-70 overflow-auto max-h-[500px] leading-tight tabular-nums">
                      {JSON.stringify(currentState, (key, value) => 
                        typeof value === 'number' ? Number(value.toFixed(4)) : value, 
                      2)}
                    </pre>
                  </div>
                </div>
              </div>
            </section>
          )}
          
          {/* Footer Timeline strip (Always visible) */}
          <footer className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md border-t border-border p-2 z-50">
            <div className="max-w-[1800px] mx-auto overflow-hidden h-12 flex items-center">
              <TimelinePanel compact />
            </div>
          </footer>
        </div>
      </div>
    </ErrorBoundary>
  );
}
