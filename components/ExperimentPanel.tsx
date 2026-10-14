/**
 * Experiment panel: Right drawer for configuring presets, model assignments, batch run parameters
 */

"use client";

import { useState } from "react";
import { getAvailablePresets } from "@/lib/sim/presets";
import { useSimStore } from "@/lib/store";
import { showToast } from "./Toast";

export default function ExperimentPanel() {
  const { setHistory, setRunMetadata } = useSimStore();
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
          seed: 42,
          config: {
            useBaselineAgents: true,
            useLinguisticRegimes,
            useEpistemicOrders,
          }
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}`;
        showToast(`Simulation error: ${errorMessage}`, "error");
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      if (data.history) {
        setRunMetadata(data.config, data.provenance);
        setHistory(data.history);
        showToast(`Simulation completed: ${data.history.length} steps`, "success");
      }
    } catch (error) {
      console.error("Simulation error:", error);
      // Error already shown to user above
    } finally {
      setIsRunning(false);
    }
  };
  
  return (
    <div className="card">
      <h2 className="font-serif text-base uppercase tracking-wide mb-6 opacity-65">Experiment Setup</h2>
      <p className="text-xs mb-4 opacity-60">Seed 42 · fixed baseline policies · no model calls</p>
      
      <div className="space-y-6">
        <div>
          <label className="block font-serif text-xs uppercase tracking-wider opacity-60 mb-3">Preset</label>
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            className="w-full bg-background border border-border px-4 py-2.5 font-mono text-xs hover:bg-surface/50 cursor-pointer focus:outline-hidden focus:border-foreground/40 transition-colors"
          >
            {presets.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block font-serif text-xs uppercase tracking-wider opacity-60 mb-3">Number of Steps</label>
          <input
            type="number"
            value={numSteps}
            onChange={(e) => setNumSteps(Number(e.target.value))}
            min={1}
            max={100}
            className="w-full bg-background border border-border px-4 py-2.5 font-mono text-xs hover:bg-surface/50 focus:outline-hidden focus:border-foreground/40 transition-colors"
          />
        </div>

        {/* Advanced Toggles */}
        <div className="pt-4 border-t border-border/30">
          <label className="block font-serif text-xs uppercase tracking-wider opacity-60 mb-4">
            Advanced Mechanics
          </label>
          
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs opacity-80">Linguistic Regimes</span>
              <button
                onClick={() => setUseLinguisticRegimes(!useLinguisticRegimes)}
                className={`w-11 h-6 border border-border relative transition-colors ${useLinguisticRegimes ? "bg-foreground" : "bg-surface"}`}
              >
                <div className={`w-4 h-4 bg-background border border-border absolute top-0.5 transition-all ${useLinguisticRegimes ? "left-6" : "left-0.5"}`} />
              </button>
            </div>
            <p className="font-serif text-[10px] opacity-50 leading-relaxed">
              Enforce constraints on how species communicate (Embassytown).
            </p>

            <div className="flex items-center justify-between">
              <span className="font-mono text-xs opacity-80">Epistemic Orders</span>
              <button
                onClick={() => setUseEpistemicOrders(!useEpistemicOrders)}
                className={`w-11 h-6 border border-border relative transition-colors ${useEpistemicOrders ? "bg-foreground" : "bg-surface"}`}
              >
                <div className={`w-4 h-4 bg-background border border-border absolute top-0.5 transition-all ${useEpistemicOrders ? "left-6" : "left-0.5"}`} />
              </button>
            </div>
            <p className="font-serif text-[10px] opacity-50 leading-relaxed">
              Restrict decision frequency and contact windows (Anathem).
            </p>
          </div>
        </div>
        
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="w-full btn mt-6"
        >
          {isRunning ? "Running..." : "Run Simulation"}
        </button>
      </div>
    </div>
  );
}
