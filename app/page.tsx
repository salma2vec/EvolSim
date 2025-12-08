/**
 * Main page: Three-column layout
 */

"use client";

import WorldControls from "@/components/WorldControls";
import WorldSummary from "@/components/WorldSummary";
import SpeciesList from "@/components/SpeciesList";
import RetroTileMap from "@/components/RetroTileMap";
import ResourceTimeline from "@/components/ResourceTimeline";
import PopulationTimeline from "@/components/PopulationTimeline";
import CooperationMetrics from "@/components/CooperationMetrics";
import EventLog from "@/components/EventLog";
import ExperimentPanel from "@/components/ExperimentPanel";
import { useEffect } from "react";
import { useSimStore } from "@/lib/store";
import { createWorldFromPreset } from "@/lib/sim/presets";

export default function Home() {
  const { setState, setHistory, currentState } = useSimStore();

  useEffect(() => {
    // Initialize with a default scenario if empty
    if (!currentState) {
      const { world } = createWorldFromPreset("two_species_simple_lake", undefined, Date.now());
      setState(world);
      setHistory([world]);
    }
  }, [currentState, setState, setHistory]);

  return (
    <div className="min-h-screen bg-grid p-4 md:p-8 font-mono text-sm">
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* Header Section */}
        <header className="border-b border-border pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div className="space-y-2 relative">
            <h1 className="text-6xl md:text-9xl font-black tracking-tighter leading-none select-none font-sans uppercase relative z-10 text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/80">
              EvolSim
            </h1>
            {/* Scanline overlay specifically for text */}
            <div className="absolute inset-0 z-20 pointer-events-none bg-scanlines opacity-50 mix-blend-overlay" aria-hidden="true" />
            
            <div className="flex items-center gap-2 text-accent">
              <span className="animate-blink">●</span>
              <span className="text-xs tracking-widest uppercase">System Online</span>
            </div>
          </div>
          
          <div className="max-w-md text-right md:text-left">
            <p className="opacity-70 leading-relaxed text-xs md:text-sm max-w-prose">
              EVOLUTIONARY SIMULATION INTERFACE<br/>
              Testing intelligence stability in alien ecologies.<br/>
              Auth: ADMIN // Sector: 7G
            </p>
          </div>
        </header>
        
        {/* Controls */}
        <div className="border border-border p-1 bg-background/50 backdrop-blur-sm">
          <WorldControls />
        </div>
        
        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-h-[600px]">
          {/* Left Column: Telemetry */}
          <div className="lg:col-span-3 space-y-6 flex flex-col">
            <div className="border border-border p-4 bg-background relative flex-1">
               <div className="absolute top-0 left-0 bg-border text-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">Status</div>
               <div className="mt-4">
                 <WorldSummary />
               </div>
            </div>
            <div className="border border-border p-0 bg-background flex-1 overflow-hidden relative">
               <div className="absolute top-0 left-0 bg-border text-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest z-10">Assets</div>
               <div className="mt-6 h-full overflow-y-auto">
                 <SpeciesList />
               </div>
            </div>
          </div>
          
          {/* Center Column: Visualization */}
          <div className="lg:col-span-6 space-y-6 flex flex-col">
            <div className="border border-border bg-background p-1 flex-1 relative min-h-[400px]">
              {/* Corner markers for "instrument" feel */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-accent z-10" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-accent z-10" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-accent z-10" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-accent z-10" />
              
              <RetroTileMap />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[300px]">
              <ResourceTimeline />
              <PopulationTimeline />
            </div>
          </div>
          
          {/* Right Column: Analysis */}
          <div className="lg:col-span-3 space-y-6 flex flex-col">
             <div className="border border-border p-4 bg-background relative">
                <div className="absolute top-0 left-0 bg-border text-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">Metrics</div>
                <div className="mt-4">
                  <CooperationMetrics />
                </div>
             </div>
            <div className="border border-border bg-background flex-1 relative flex flex-col">
               <div className="absolute top-0 left-0 bg-border text-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest z-10">Logs</div>
               <div className="mt-6 flex-1 overflow-hidden">
                 <EventLog />
               </div>
            </div>
            <div className="border-t border-border pt-4">
              <ExperimentPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

