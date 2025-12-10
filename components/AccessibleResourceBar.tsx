/**
 * Accessible resource bar component
 */

"use client";

import { ResourceState } from "@/lib/sim/types";
import { getResourceAriaLabel } from "@/lib/utils/accessibility";

interface Props {
  resource: ResourceState;
}

export default function AccessibleResourceBar({ resource }: Props) {
  const percent = (resource.amount / resource.def.capacityK) * 100;
  const thresholdPercent = (resource.def.collapseThreshold / resource.def.capacityK) * 100;
  const isLow = percent < thresholdPercent * 1.2;
  const isCollapsed = resource.collapsed;
  
  const ariaLabel = getResourceAriaLabel(
    resource.def.name,
    resource.amount,
    resource.def.capacityK,
    resource.collapsed
  );

  return (
    <div className="space-y-1" role="progressbar" aria-label={ariaLabel} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="flex justify-between text-[10px] font-mono uppercase">
        <span className="opacity-70">{resource.def.name}</span>
        <span className={isCollapsed ? "text-red-500 blink" : isLow ? "text-accent" : "opacity-70"}>
          {isCollapsed ? "COLLAPSED" : `${percent.toFixed(0)}%`}
        </span>
      </div>
      
      <div className="w-full h-3 bg-border/20 border border-border relative">
        <div 
          className="absolute top-0 bottom-0 w-px bg-red-500/50 z-10"
          style={{ left: `${thresholdPercent}%` }}
          aria-hidden="true"
        />
        
        <div
          className={`h-full transition-all duration-500 ${isCollapsed ? "bg-red-500/20" : isLow ? "bg-accent/50" : "bg-foreground"}`}
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

