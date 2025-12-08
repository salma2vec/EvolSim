/**
 * Event log: Scrollable list with color-coded event tags
 */

"use client";

import { useSimStore } from "@/lib/store";

export default function EventLog() {
  const { currentState, history } = useSimStore();
  
  if (!currentState || history.length === 0) {
    return (
      <div className="p-4 font-mono text-xs uppercase opacity-50">
        No event data
      </div>
    );
  }
  
  const allEvents = history.flatMap((state) => state.events);
  const recentEvents = allEvents.slice(-50).reverse();
  
  const getEventColor = (type: string) => {
    switch (type) {
      case "DEFECT":
        return "text-red-500 border-red-500";
      case "COLLAPSE":
        return "text-red-500 border-red-500 bg-red-500/10";
      case "EXTINCTION":
        return "text-gray-500 border-gray-500 line-through";
      case "TREATY":
        return "text-accent border-accent";
      case "DIPLOMACY":
        return "text-blue-400 border-blue-400";
      default:
        return "text-foreground border-border";
    }
  };
  
  return (
    <div className="h-full flex flex-col font-mono text-xs overflow-hidden">
      <div className="flex-1 overflow-y-auto space-y-0 p-2 scrollbar-thin">
        {recentEvents.length === 0 ? (
          <p className="opacity-50">No events recorded.</p>
        ) : (
          recentEvents.map((event, idx) => (
            <div
              key={idx}
              className={`p-2 border-b border-border/50 hover:bg-foreground/5 transition-colors ${getEventColor(event.type)}`}
            >
              <div className="flex items-center gap-2 mb-1 opacity-70">
                <span>T+{String(event.timeStep).padStart(3, '0')}</span>
                <span className="text-[10px] tracking-wider uppercase">
                  [{event.type}]
                </span>
              </div>
              <p className="opacity-90 font-sans leading-tight text-foreground">{event.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

