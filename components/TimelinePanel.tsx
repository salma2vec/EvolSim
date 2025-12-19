/**
 * Timeline Panel
 * 
 * Supports two modes:
 * 1. Compact: Horizontal strip for footer navigation.
 * 2. Full: Expanded view for technical forensics.
 */

"use client";

import { useSimStore } from "@/lib/store";
import { useState } from "react";

interface TimelinePanelProps {
  compact?: boolean;
}

export default function TimelinePanel({ compact = false }: TimelinePanelProps) {
  const { history, setCurrentTimeStep, currentTimeStep } = useSimStore();
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  
  if (history.length === 0) {
    return (
      <div className={compact ? "flex items-center gap-2 h-full px-4 text-[10px] opacity-50" : "border border-border p-4"}>
        {!compact && <div className="font-serif text-xs uppercase tracking-wide mb-2 opacity-60">Timeline</div>}
        <div className="font-mono">Waiting for simulation data...</div>
      </div>
    );
  }
  
  // Group events by timestep for deterministic display
  const eventsByStep: Record<number, typeof history[0]['events']> = {};
  for (const state of history) {
    eventsByStep[state.timeStep] = state.events;
  }
  
  const steps = Object.keys(eventsByStep).map(Number).sort((a, b) => a - b);
  
  const handleStepClick = (step: number) => {
    setSelectedStep(step);
    setCurrentTimeStep(step);
  };
  
  if (compact) {
    return (
      <div className="flex gap-1.5 overflow-x-auto h-full items-center no-scrollbar pb-1 px-2">
        <div className="text-[9px] font-mono opacity-45 uppercase tracking-[0.2em] mr-4 whitespace-nowrap">Execution Trace:</div>
        {steps.map((step) => {
          const events = eventsByStep[step] || [];
          const isSelected = currentTimeStep === step;
          const hasCritical = events.some(e => e.type === "COLLAPSE" || e.type === "EXTINCTION" || e.type === "DEFECT");
          
          return (
            <button
              key={step}
              onClick={() => handleStepClick(step)}
              className={`
                min-w-[36px] h-9 border flex flex-col items-center justify-center transition-all duration-150
                ${isSelected 
                  ? 'bg-foreground text-background border-foreground shadow-sm' 
                  : 'bg-surface/50 hover:bg-surface/70 border-border hover:border-foreground/30'}
                ${hasCritical && !isSelected ? 'border-[var(--signal-collapse)]/50 text-[var(--signal-collapse)] hover:border-[var(--signal-collapse)]' : ''}
              `}
              title={`T-${step}: ${events.length} events`}
              aria-label={`Go to epoch ${step}`}
            >
              <span className="text-[9px] font-mono leading-none tabular-nums">{step}</span>
              {events.length > 0 && (
                <span className={`text-[7px] font-mono leading-none mt-0.5 ${
                  isSelected ? 'opacity-70' : 'opacity-50'
                }`}>
                  {events.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="font-serif text-xs uppercase tracking-widest opacity-65">Epoch Execution Log</div>
        <div className="font-mono text-[10px] opacity-45 uppercase">Click any epoch to inspect details</div>
      </div>
      
      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-4">
        {steps.map((step) => {
          const events = eventsByStep[step] || [];
          const isSelected = selectedStep === step;
          const hasCritical = events.some(e => e.type === "COLLAPSE" || e.type === "EXTINCTION" || e.type === "DEFECT");
          
          return (
            <div
              key={step}
              onClick={() => handleStepClick(step)}
              className={`border-b border-border/20 py-4 cursor-pointer group transition-colors ${isSelected ? 'bg-surface/30' : 'hover:bg-surface/10'}`}
            >
              <div className="flex justify-between items-baseline mb-3 px-3">
                <span className={`font-mono text-xs uppercase tracking-wider ${isSelected ? 'text-foreground' : 'opacity-50 group-hover:opacity-80'}`}>
                  Epoch T-{String(step).padStart(3, '0')}
                </span>
                <span className="font-mono text-[9px] opacity-30">{events.length} execution events</span>
              </div>
              
              <div className="flex flex-wrap gap-1 px-2">
                {events.map((event, idx) => {
                  const isCritical = event.type === "COLLAPSE" || event.type === "EXTINCTION" || event.type === "DEFECT";
                  
                  return (
                    <span
                      key={idx}
                      className={`text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 border ${
                        isCritical ? 'border-[var(--signal-collapse)] text-[var(--signal-collapse)]' : 'border-border/40 opacity-40'
                      }`}
                    >
                      {event.type}
                    </span>
                  );
                })}
              </div>
              
              {isSelected && events.length > 0 && (
                <div className="mt-5 mx-3 p-4 bg-surface/40 border border-border space-y-3">
                  {events.map((event, idx) => (
                    <div key={idx} className="text-[10px] font-mono opacity-80 leading-relaxed border-l border-border/30 pl-3">
                      <div className="flex gap-2 items-center mb-0.5">
                        <span className="uppercase text-[8px] opacity-40">{event.type}</span>
                        {event.data?.speciesId && <span className="text-[8px] px-1 bg-surface text-foreground/60">{event.data.speciesId}</span>}
                      </div>
                      {event.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
