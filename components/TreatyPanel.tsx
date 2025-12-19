/**
 * Treaty / Institution Panel
 * 
 * Displays: Active treaties, constraints, violations.
 * Encodes causality: Do institutions modify behavioral trajectories?
 */

"use client";

import { useSimStore } from "@/lib/store";

export default function TreatyPanel() {
  const { currentState, history } = useSimStore();
  
  if (!currentState) {
    return (
      <div className="border border-border p-4">
        <div className="font-serif text-xs uppercase tracking-wide mb-2 opacity-60">Institutions</div>
        <div className="text-xs font-mono opacity-50">No treaties available</div>
      </div>
    );
  }
  
  const { activeTreaties } = currentState;
  
  // Get violations from history (Evidence)
  const violations: Record<string, { timeStep: number; speciesId: string }> = {};
  for (const state of history) {
    for (const event of state.events) {
      if (event.type === "DEFECT" && event.data?.treatyId) {
        violations[event.data.treatyId as string] = {
          timeStep: event.timeStep,
          speciesId: event.data.speciesId as string,
        };
      }
    }
  }
  
  if (activeTreaties.length === 0) {
    return (
      <div className="bg-surface border border-border/40 p-6 md:p-8">
        <div className="font-serif text-xs uppercase tracking-wider mb-8 opacity-50 text-foreground/70">Institutional Overlays</div>
        <div className="text-xs font-serif italic opacity-40 leading-relaxed text-foreground/60">
          No formal agreements present. Coordination must emerge purely from policy heuristics.
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-surface border border-border/40 p-6 md:p-8">
      <div className="font-serif text-xs uppercase tracking-wider mb-10 opacity-50 text-foreground/70">Institutional Overlays</div>
      
      <div className="space-y-8">
        {activeTreaties.map((treaty) => {
          const violation = violations[treaty.id];
          const isViolated = treaty.violated || !!violation;
          
          return (
            <div key={treaty.id} className="space-y-4 p-4 border border-border/20 bg-surface/30 hover:bg-surface/40 hover:border-border/30 transition-all duration-200">
              {/* Treaty identifier */}
              <div className="flex justify-between items-baseline border-b border-border/10 pb-3">
                <span className="text-[10px] font-mono uppercase tracking-wider opacity-60">{treaty.id}</span>
                {isViolated && (
                  <span className="text-[10px] font-mono text-[var(--signal-collapse)] font-bold animate-pulse">
                    BREACHED
                  </span>
                )}
              </div>
              
              {/* Narrative Content */}
              <div className="font-serif text-xs leading-relaxed opacity-80">
                Agreement between <span className="font-bold">{treaty.signatories.join(" & ")}</span>.
              </div>
              
              {/* Machine Constraints (Evidence) */}
              {treaty.interpretedConstraints.maxHarvestByResource && (
                <div className="p-2 bg-surface/30 space-y-1">
                  <div className="text-[8px] font-mono uppercase opacity-40 mb-1">Enforced Constraints</div>
                  {Object.entries(treaty.interpretedConstraints.maxHarvestByResource).map(([resId, limit]) => (
                    <div key={resId} className="flex justify-between text-[10px] font-mono">
                      <span className="opacity-60">{resId}</span>
                      <span className="font-bold">≤ {limit.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Violation Forensic */}
              {violation && (
                <div className="pt-2 border-t border-border/10">
                  <div className="text-[8px] font-mono uppercase text-[var(--signal-collapse)] mb-1 opacity-80 font-bold">Forensic: Violation at T-{violation.timeStep}</div>
                  <div className="text-[10px] font-mono opacity-60">
                    Defector: {violation.speciesId}
                  </div>
                </div>
              )}
              
              {/* Meta */}
              <div className="flex justify-between items-center pt-1 text-[8px] font-mono opacity-30 uppercase">
                <span>Signed T-{treaty.epochSigned}</span>
                {treaty.expiresAt && <span>Expires T-{treaty.expiresAt}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
