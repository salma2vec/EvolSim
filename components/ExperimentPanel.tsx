/**
 * Experiment panel: Right drawer for configuring presets, model assignments, batch run parameters
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
  
  // Advanced options
  const [useLinguisticRegimes, setUseLinguisticRegimes] = useState(false);
  const [useEpistemicOrders, setUseEpistemicOrders] = useState(false);
  
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
          config: {
            useLinguisticRegimes,
            useEpistemicOrders,
          }
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
    <div className="bg-surface p-4 rounded border border-muted">
      <h2 className="text-xl font-bold mb-4 text-white">Experiment Setup</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Preset</label>
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            className="w-full bg-background text-white px-3 py-2 rounded border border-muted"
          >
            {presets.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-2">Number of Steps</label>
          <input
            type="number"
            value={numSteps}
            onChange={(e) => setNumSteps(Number(e.target.value))}
            min={1}
            max={100}
            className="w-full bg-background text-white px-3 py-2 rounded border border-muted"
          />
        </div>

        {/* Advanced Toggles */}
        <div className="pt-2 border-t border-muted/50">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            Advanced Mechanics
          </label>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Linguistic Regimes</span>
              <button
                onClick={() => setUseLinguisticRegimes(!useLinguisticRegimes)}
                className={`w-10 h-5 rounded-full relative transition-colors ${useLinguisticRegimes ? "bg-accent" : "bg-muted"}`}
              >
                <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${useLinguisticRegimes ? "left-6" : "left-1"}`} />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Enforce constraints on how species communicate (Embassytown).
            </p>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Epistemic Orders</span>
              <button
                onClick={() => setUseEpistemicOrders(!useEpistemicOrders)}
                className={`w-10 h-5 rounded-full relative transition-colors ${useEpistemicOrders ? "bg-accent" : "bg-muted"}`}
              >
                <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${useEpistemicOrders ? "left-6" : "left-1"}`} />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Restrict decision frequency and contact windows (Anathem).
            </p>
          </div>
        </div>
        
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="w-full bg-primary text-white px-4 py-2 rounded hover:bg-primary/80 disabled:opacity-50 mt-4"
        >
          {isRunning ? "Running..." : "Run Simulation"}
        </button>
      </div>
    </div>
  );
}
