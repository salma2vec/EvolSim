/**
 * Event log: Scrollable list with color-coded event tags
 */

"use client";

import { useSimStore } from "@/lib/store";

export default function EventLog() {
  const { currentState, history } = useSimStore();
  
  if (!currentState || history.length === 0) {
    return (
      <div className="bg-surface p-4 rounded border border-muted">
        <p className="text-gray-400">No events</p>
      </div>
    );
  }
  
  const allEvents = history.flatMap((state) => state.events);
  const recentEvents = allEvents.slice(-50).reverse();
  
  const getEventStyle = (type: string) => {
    switch (type) {
      case "DEFECT":
        return "text-warning border-warning bg-warning/5";
      case "COLLAPSE":
        return "text-warning border-warning bg-warning/10 font-bold";
      case "EXTINCTION":
        return "text-gray-500 border-gray-500 bg-gray-500/5";
      case "TREATY":
        return "text-accent border-accent bg-accent/5";
      case "DIPLOMACY":
        return "text-primary border-primary bg-primary/5";
      case "CONCLAVE":
        return "text-cyan-400 border-cyan-400 bg-cyan-400/10 italic";
      case "LANGUAGE_SHIFT":
        return "text-purple-400 border-purple-400 bg-purple-400/5 font-mono text-xs";
      default:
        return "text-gray-400 border-gray-400";
    }
  };
  
  return (
    <div className="bg-surface p-4 rounded border border-muted h-96 flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-white">Event Log</h2>
      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        {recentEvents.length === 0 ? (
          <p className="text-gray-400">No events yet</p>
        ) : (
          recentEvents.map((event, idx) => (
            <div
              key={idx}
              className={`p-3 rounded border text-sm ${getEventStyle(event.type)} transition-all hover:bg-opacity-20`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs opacity-70">EPOCH {event.timeStep}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border border-current bg-background">
                    {event.type}
                  </span>
                </div>
              </div>
              <p className="text-gray-200 leading-relaxed">{event.message}</p>
              
              {/* Specialized data rendering */}
              {event.type === "TREATY" && event.data?.treatyId && (
                <div className="mt-2 text-xs font-mono opacity-70 pl-2 border-l-2 border-current">
                  ID: {event.data.treatyId}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
