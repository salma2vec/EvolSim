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
      
      {/* Comparative Metric: LLM Capability vs Outcome */}
      <div className="space-y-4">
        <div className="font-serif text-xs uppercase tracking-widest opacity-60 mb-4">
          Model Capability vs Strategic Outcome
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {species.map(s => {
            // Calculate performance metrics
            const populationChange = history.length > 1 
              ? s.population - (history[0]?.species.find(sp => sp.traits.id === s.traits.id)?.population || s.population)
              : 0;
            const populationTrend = populationChange > 0 ? "growing" : populationChange < 0 ? "declining" : "stable";
            
            // Determine capability tier
            const capabilityTier = s.policyBrainId.includes("gpt-4") || s.policyBrainId.includes("frontier") 
              ? "high" 
              : s.policyBrainId.includes("gpt-3.5") || s.policyBrainId.includes("medium")
              ? "medium"
              : "baseline";
            
            const outcomeStatus = s.alive && s.population > 1000000 ? "success" : s.alive ? "marginal" : "failure";
            
            return (
              <div key={s.traits.id} className="bg-surface border border-border/40 p-5 flex flex-col justify-between hover:border-border/60 transition-colors">
                <div className="space-y-4">
                  <div className="flex justify-between items-baseline border-b border-border/20 pb-3">
                    <div className="text-[10px] font-mono opacity-40 uppercase tracking-wider text-foreground/50">Policy Brain</div>
                    <div className={`text-[8px] font-mono uppercase px-2.5 py-1 border ${
                      capabilityTier === "high" ? "border-foreground/50 bg-foreground/5 opacity-70" :
                      capabilityTier === "medium" ? "border-foreground/30 bg-foreground/3 opacity-60" :
                      "border-foreground/20 bg-foreground/2 opacity-50"
                    }`}>
                      {capabilityTier}
                    </div>
                  </div>
                  <div className="font-serif text-xl tracking-tight text-foreground/90">{s.policyBrainId}</div>
                  <div className="space-y-2 text-[10px] font-mono">
                    <div className="flex justify-between">
                      <span className="opacity-50 uppercase">Population:</span>
                      <span className={outcomeStatus === "success" ? "text-foreground" : outcomeStatus === "marginal" ? "text-[var(--signal-violation)]" : "text-[var(--signal-collapse)]"}>
                        {(s.population / 1000000).toFixed(2)}M
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-50 uppercase">Trend:</span>
                      <span className={populationTrend === "growing" ? "text-foreground" : populationTrend === "declining" ? "text-[var(--signal-collapse)]" : "opacity-60"}>
                        {populationTrend.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-50 uppercase">Status:</span>
                      <span className={s.alive ? "text-foreground" : "text-[var(--signal-collapse)]"}>
                        {s.alive ? "ACTIVE" : "EXTINCT"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

