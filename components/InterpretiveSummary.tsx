/**
 * Interpretive Summary Component
 * 
 * Provides a high-level natural language assessment of the simulation state.
 * Encodes causality: World -> Incentives -> Policies -> Outcomes.
 */

"use client";

import { useSimStore } from "@/lib/store";
import { WorldState, ResourceState } from "@/lib/sim/types";

export default function InterpretiveSummary() {
  const { currentState, history } = useSimStore();
  
  if (!currentState) return null;
  
  const { resources, species, metadata, timeStep } = currentState;
  
  // 1. Derive High-Level Status
  let status = "STABLE EQUILIBRIUM";
  let statusColor = "text-foreground";
  
  const collapsedResources = resources.filter(r => r.collapsed);
  const criticalResources = resources.filter(r => !r.collapsed && r.amount < r.def.collapseThreshold * 1.5);
  
  // Calculate aggregate extraction vs regeneration for each resource
  const resourceAnalysis = resources.map(resource => {
    // Look at last state to see regen and harvest effects
    // Actually, we can just estimate from current state's last events
    const harvests = currentState.events
      .filter(e => e.type === "HARVEST" && e.data?.resourceId === resource.def.id)
      .reduce((sum, e) => sum + (e.data?.harvestAmount || 0), 0);
    
    // Logistic growth estimate: g * R * (1 - R/K)
    const regen = resource.def.regenRate * resource.amount * (1 - resource.amount / resource.def.capacityK);
    const delta = regen - harvests;
    
    return {
      id: resource.def.id,
      name: resource.def.name,
      harvests,
      regen,
      delta,
      collapsed: resource.collapsed,
      critical: resource.amount < resource.def.collapseThreshold * 1.5
    };
  });
  
  const isOvershoot = resourceAnalysis.some(a => a.delta < 0);
  
  if (collapsedResources.length > 0) {
    status = "TERMINAL COLLAPSE";
    statusColor = "text-[var(--signal-collapse)]";
  } else if (criticalResources.length > 0) {
    status = "CRITICAL INSTABILITY";
    statusColor = "text-[var(--signal-collapse)]";
  } else if (isOvershoot) {
    status = "RESOURCE OVERSHOOT";
    statusColor = "text-[var(--signal-violation)]";
  }
  
  // 2. Derive Causal Narrative
  const topDeficitResource = [...resourceAnalysis].sort((a, b) => a.delta - b.delta)[0];
  
  return (
    <div className="space-y-8 border-b border-border pb-10">
      {/* High-level status */}
      <div className="flex justify-between items-baseline">
        <h2 className={`text-3xl font-serif uppercase tracking-tight ${statusColor}`}>
          {status}
        </h2>
        <div className="text-xs font-mono opacity-50 uppercase tracking-widest">
          Epoch T-{String(timeStep).padStart(3, '0')}
        </div>
      </div>
      
      {/* Interpretive Narrative */}
      <div className="max-w-4xl space-y-6">
        <p className="text-lg font-serif leading-relaxed opacity-90 border-l-2 border-border pl-8">
          {metadata ? (
            <>
              Testing hypothesis in <span className="font-bold">{metadata.name}</span>. 
              {metadata.scarce} {metadata.collapseMechanics} 
              <span className="block mt-2 text-sm opacity-60 italic">{metadata.nonTrivialReason} {metadata.naiveStrategyFail}</span>
            </>
          ) : (
            "Observation of ecological-strategic interaction in progress. No scenario metadata available."
          )}
        </p>
        
        <div className="p-5 border border-border bg-surface/30 font-mono text-sm space-y-3">
          <div className="uppercase opacity-55 text-[10px] tracking-widest mb-3">Live Causal Analysis</div>
          {collapsedResources.length > 0 ? (
            <p className="text-[var(--signal-collapse)]">
              Irreversible collapse detected in {collapsedResources.map(r => r.def.id).join(", ")}. 
              Regeneration has halted. Extinction is inevitable without external intervention.
            </p>
          ) : topDeficitResource && topDeficitResource.delta < 0 ? (
            <p>
              Aggregate extraction ({topDeficitResource.harvests.toFixed(1)}) exceeds 
              regeneration ({topDeficitResource.regen.toFixed(1)}) for <span className="text-foreground font-bold">{topDeficitResource.id}</span>. 
              Net deficit: <span className="text-[var(--signal-collapse)]">{Math.abs(topDeficitResource.delta).toFixed(1)} units/epoch</span>. 
              {topDeficitResource.critical ? " System is in critical state." : " Stability is deteriorating."}
            </p>
          ) : (
            <p className="text-foreground/70">
              Current extraction levels are within sustainable regeneration bounds. 
              Equilibrium maintained at current population densities.
            </p>
          )}
        </div>
      </div>
      
      {/* Comparative Metric: LLM Capability vs Outcome (Placeholder) */}
      <div className="grid grid-cols-3 gap-6">
        {species.map(s => (
          <div key={s.traits.id} className="card flex flex-col justify-between">
            <div className="text-[10px] font-mono opacity-50 uppercase tracking-widest">Policy Brain</div>
            <div className="font-serif text-lg">{s.policyBrainId}</div>
            <div className="mt-2 text-[10px] font-mono">
              <span className="opacity-50 uppercase">Cumulative Bias: </span>
              <span className={s.population > 1000000 ? "text-foreground" : "text-[var(--signal-collapse)]"}>
                {s.alive ? "Active" : "Extinct"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

