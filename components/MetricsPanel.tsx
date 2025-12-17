/**
 * Metrics Panel
 * 
 * Displays:
 * - Collapse probability
 * - Time-to-collapse
 * - Welfare trajectory
 * - Cooperation index
 * 
 * All metrics derive from logged state only.
 */

"use client";

import { useSimStore } from "@/lib/store";
import { 
  computeCollapseProbabilityByT, 
  computeTimeToFirstCollapse,
  computeMeanTotalWelfare,
  computeWelfareVariance,
  computeCooperationIndex,
  computeTreatyViolationRate,
  computeDeceptionGap
} from "@/lib/sim/metrics";

export default function MetricsPanel() {
  const { history, currentState } = useSimStore();
  
  if (history.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header">Metrics</div>
        <div className="data text-xs opacity-50">No metrics available</div>
      </div>
    );
  }
  
  const T = currentState?.timeStep || history.length;
  const collapseProb = computeCollapseProbabilityByT(history, T);
  const timeToCollapse = computeTimeToFirstCollapse(history);
  const meanWelfare = computeMeanTotalWelfare(history);
  const welfareVariance = computeWelfareVariance(history);
  const cooperationIndex = computeCooperationIndex(history);
  const treatyMetrics = computeTreatyViolationRate(history);
  const deceptionGap = computeDeceptionGap(history);
  
  return (
    <div className="panel">
      <div className="panel-header">Metrics</div>
      
      <div className="space-y-4">
        {/* Collapse metrics */}
        <div className="border-b border-border pb-3">
          <div className="data text-xs uppercase tracking-wider mb-2 opacity-60">Collapse</div>
          <div className="space-y-1 text-[10px] data font-mono">
            <div className="flex justify-between">
              <span className="opacity-70">Probability (T{T}):</span>
              <span>{collapseProb.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Time to first:</span>
              <span>{timeToCollapse !== undefined ? `T${timeToCollapse}` : 'N/A'}</span>
            </div>
          </div>
        </div>
        
        {/* Welfare metrics */}
        <div className="border-b border-border pb-3">
          <div className="data text-xs uppercase tracking-wider mb-2 opacity-60">Welfare</div>
          <div className="space-y-1 text-[10px] data font-mono">
            <div className="flex justify-between">
              <span className="opacity-70">Mean:</span>
              <span>{meanWelfare.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">Variance:</span>
              <span>{welfareVariance.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        {/* Cooperation metrics */}
        <div className="border-b border-border pb-3">
          <div className="data text-xs uppercase tracking-wider mb-2 opacity-60">Cooperation</div>
          <div className="space-y-1 text-[10px] data font-mono">
            {Object.entries(cooperationIndex).map(([speciesId, index]) => (
              <div key={speciesId} className="flex justify-between">
                <span className="opacity-70">{speciesId}:</span>
                <span>{index.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Treaty metrics */}
        {treatyMetrics.totalTreaties > 0 && (
          <div className="border-b border-border pb-3">
            <div className="data text-xs uppercase tracking-wider mb-2 opacity-60">Treaties</div>
            <div className="space-y-1 text-[10px] data font-mono">
              <div className="flex justify-between">
                <span className="opacity-70">Violation rate:</span>
                <span>{(treatyMetrics.violationRate * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">Total:</span>
                <span>{treatyMetrics.totalTreaties}</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Deception gap */}
        {Object.keys(deceptionGap).length > 0 && (
          <div>
            <div className="data text-xs uppercase tracking-wider mb-2 opacity-60">Deception Gap</div>
            <div className="space-y-1 text-[10px] data font-mono">
              {Object.entries(deceptionGap).map(([speciesId, gap]) => (
                <div key={speciesId} className="flex justify-between">
                  <span className="opacity-70">{speciesId}:</span>
                  <span>{gap.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

