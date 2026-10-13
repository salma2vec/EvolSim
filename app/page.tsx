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
  const { setState, setHistory, setRunMetadata, currentState } = useSimStore();
  const [technicalMode, setTechnicalMode] = useState(false);
  const [viewMode, setViewMode] = useState<"causal" | "spatial">("causal");

  useEffect(() => {
    // Initialize with a default scenario if empty
    if (!currentState) {
      const { world, config } = createWorldFromPreset("two_species_simple_lake", undefined, 12345);
      setRunMetadata(config, {seed:12345, presetId:"two_species_simple_lake", mode:"baseline"});
      setState(world);
      setHistory([world]);
    }
  }, [currentState, setState, setHistory]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground antialiased">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-8 md:py-12 space-y-16 md:space-y-20">
          
          {/* Layer 1: Interpretive Summary (The "So What?") */}
          <section className="space-y-8 md:space-y-12">
            <header className="flex flex-col md:flex-row justify-between items-start gap-8 border-b border-border/30 pb-10 mb-14">
              <div className="space-y-3">
                <h1 className="text-xs font-mono uppercase tracking-[0.2em] opacity-40 text-foreground/60">Scientific Instrument</h1>
                <h2 className="text-4xl md:text-6xl font-serif uppercase tracking-tight leading-none">The Third Pillar</h2>
                <p className="text-xs opacity-60">Seeded baseline simulation · no model calls</p>
              </div>
              <div className="flex flex-col items-end gap-4 w-full md:w-auto">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="inline-flex items-center gap-0 border border-border/40 bg-surface/20">
                    <button
                      onClick={() => setViewMode("causal")}
                      className={`text-[10px] font-mono uppercase px-4 py-2 transition-all ${
                        viewMode === "causal" 
                          ? "bg-foreground text-background" 
                          : "opacity-60 hover:opacity-100 hover:bg-surface/40"
                      }`}
                    >
                      Causal
                    </button>
                    <button
                      onClick={() => setViewMode("spatial")}
                      className={`text-[10px] font-mono uppercase px-4 py-2 transition-all border-l border-border/40 ${
                        viewMode === "spatial" 
                          ? "bg-foreground text-background" 
                          : "opacity-60 hover:opacity-100 hover:bg-surface/40"
                      }`}
                    >
                      Voxel Map
                    </button>
                  </div>
                  <label className="text-[10px] font-mono uppercase opacity-50 flex items-center gap-2 cursor-pointer border border-border/40 px-3 py-2 bg-surface/10 hover:bg-surface/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={technicalMode}
                      onChange={(e) => setTechnicalMode(e.target.checked)}
                      className="cursor-pointer w-3 h-3"
                    />
                    Technical
                  </label>
                </div>
                <div className="w-full md:w-auto">
                  <WorldControls />
                </div>
              </div>
            </header>

            <InterpretiveSummary />
          </section>

          {/* Layer 2: Causal Panels (The "Why?") */}
          {viewMode === "causal" ? (
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
              {/* Left: Institutions */}
              <div className="lg:col-span-3">
                <div className="font-serif text-xs uppercase tracking-widest opacity-50 mb-4 text-foreground/70">Institutional Overlays</div>
                <TreatyPanel />
              </div>

              {/* Center: Load-bearing Variable (Delta & Resources) */}
              <div className="lg:col-span-6">
                <div className="font-serif text-xs uppercase tracking-widest opacity-50 mb-4 text-foreground/70">Primary Causal Chain</div>
                <WorldStatePanel />
              </div>

              {/* Right: Agent Policies */}
              <div className="lg:col-span-3">
                <div className="font-serif text-xs uppercase tracking-widest opacity-50 mb-4 text-foreground/70">Agent Outcomes</div>
                <AgentPanel />
              </div>
            </section>
          ) : (
            <section className="w-full">
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
