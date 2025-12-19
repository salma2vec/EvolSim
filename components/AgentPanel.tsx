/**
 * Agent Panel
 * 
 * Displays: Species name, assigned policy/LLM, population, last action.
 * Encodes causality: Which agent defection or extraction matters.
 */

"use client";

import { useSimStore } from "@/lib/store";
import { isContactWindow } from "@/lib/sim/orders";

export default function AgentPanel() {
  const { currentState, history } = useSimStore();
  
  if (!currentState) {
    return (
      <div className="border border-border p-4">
        <div className="font-serif text-xs uppercase tracking-wide mb-2 opacity-60">Agents</div>
        <div className="text-xs font-mono opacity-50">No agents available</div>
      </div>
    );
  }
  
  const { species } = currentState;
  
  // Get cumulative over-extraction from history (Evidence)
  const cumulativeDeficit: Record<string, number> = {};
  for (const state of history) {
    for (const event of state.events) {
      if (event.type === "DEFECT" && event.data?.speciesId) {
        cumulativeDeficit[event.data.speciesId] = (cumulativeDeficit[event.data.speciesId] || 0) + 1;
      }
    }
  }
  
  // Get last actions
  const lastActions: Record<string, { harvest?: Record<string, number>; timestamp: number }> = {};
  for (const state of history.slice().reverse()) {
    for (const event of state.events) {
      if (event.data?.speciesId && event.type === "HARVEST" && !lastActions[event.data.speciesId]) {
        lastActions[event.data.speciesId] = {
          harvest: event.data.harvestAmount ? { [event.data.resourceId || '']: event.data.harvestAmount } : undefined,
          timestamp: event.timeStep,
        };
      }
    }
  }
  
  return (
    <div className="card">
      <div className="font-serif text-xs uppercase tracking-wide mb-8 opacity-65">Agent Policy Outcomes</div>
      
      <div className="space-y-10">
        {species.map((s) => {
          const isActive = isContactWindow(s.traits.epistemicOrder, currentState.timeStep);
          const lastAction = lastActions[s.traits.id];
          const violations = cumulativeDeficit[s.traits.id] || 0;
          
          return (
            <div key={s.traits.id} className="space-y-3">
              {/* Agent ID & Status */}
              <div className="flex justify-between items-baseline border-b border-border/30 pb-3">
                <span className="font-serif text-base">{s.traits.name}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 border ${s.alive ? 'border-foreground/20 opacity-60' : 'border-[var(--signal-collapse)] text-[var(--signal-collapse)]'}`}>
                  {s.alive ? 'ACTIVE' : 'EXTINCT'}
                </span>
              </div>
              
              {/* Policy & Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="font-serif text-[10px] uppercase opacity-40">Intelligence</span>
                  <span className="font-mono text-xs">{s.policyBrainId}</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="font-serif text-[10px] uppercase opacity-40">Population</span>
                  <span className="font-mono text-xs">{(s.population / 1000000).toFixed(2)}M</span>
                </div>
              </div>
              
              {/* Institutional constraints (Evidence) */}
              <div className="p-2 bg-background border border-border/20 space-y-1">
                <div className="flex justify-between text-[9px] font-mono opacity-50 uppercase">
                  <span>Regime: {s.traits.linguisticRegime || 'N/A'}</span>
                  <span>Order: {s.traits.epistemicOrder || 'N/A'}</span>
                </div>
                {!isActive && s.traits.epistemicOrder && s.traits.epistemicOrder !== undefined && (
                  <div className="text-[8px] font-mono text-amber-500 uppercase tracking-tighter text-center pt-1 border-t border-border/10">
                    Cloistered: Observation Suppressed
                  </div>
                )}
              </div>

              {/* Behavior Metrics */}
              <div className="flex justify-between items-center text-[10px] font-mono pt-2 border-t border-border/20">
                <div className="flex flex-col">
                  <span className="opacity-40 uppercase mb-1">Defect Count</span>
                  <span className={`text-sm tabular-nums ${
                    violations > 0 
                      ? "text-[var(--signal-collapse)] font-bold" 
                      : violations === 0
                      ? "text-foreground opacity-80"
                      : "opacity-60"
                  }`}>
                    {violations}
                  </span>
                </div>
                {lastAction && (
                  <div className="flex flex-col text-right">
                    <span className="opacity-40 uppercase mb-1">Last Extraction</span>
                    <div className="space-y-0.5">
                      <span className="opacity-60 text-[8px]">T{lastAction.timestamp}</span>
                      <div className="text-sm tabular-nums opacity-90">
                        {lastAction.harvest ? Object.values(lastAction.harvest)[0].toFixed(1) : "0.0"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
