/**
 * Experiment panel: Right drawer for configuring presets, model assignments
 */

"use client";

import { useState } from "react";
import { getAvailablePresets } from "@/lib/sim/presets";
import { useSimStore } from "@/lib/store";

export default function ExperimentPanel() {
  const { setHistory } = useSimStore();
  const [presetId, setPresetId] = useState("two_species_simple_lake");
  const [numSteps, setNumSteps] = useState(10);
  const [isRunning, setIsRunning] = useState(false);
  
  const presets = getAvailablePresets();
  
  const handleRun = async () => {
    setIsRunning(true);
    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId,
          numSteps,
          seed: Date.now(),
        }),
      });
      
      const data = await response.json();
      if (data.history) {
        setHistory(data.history);
      }
    } catch (error) {
      console.error("Simulation error:", error);
    } finally {
      setIsRunning(false);
    }
  };
  
  return (
    <div className="border border-border p-4 bg-background">
      <h2 className="text-xs font-bold tracking-widest uppercase mb-4 opacity-50 border-b border-border pb-2">Configuration</h2>
      
      <div className="space-y-4 font-mono text-xs">
        <div>
          <label className="block opacity-70 mb-2 uppercase">Scenario Preset</label>
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            className="w-full bg-background text-foreground px-3 py-2 border border-border focus:outline-none focus:border-accent"
          >
            {presets.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block opacity-70 mb-2 uppercase">Epoch Limit</label>
          <input
            type="number"
            value={numSteps}
            onChange={(e) => setNumSteps(Number(e.target.value))}
            min={1}
            max={100}
            className="w-full bg-background text-foreground px-3 py-2 border border-border focus:outline-none focus:border-accent"
          />
        </div>
        
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="w-full bg-foreground text-background px-4 py-3 hover:bg-accent hover:text-foreground disabled:opacity-50 transition-colors uppercase font-bold tracking-wider"
        >
          {isRunning ? "Running Simulation..." : "Initialize Sequence"}
        </button>
      </div>
    </div>
  );
}

