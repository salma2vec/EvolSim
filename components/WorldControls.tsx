/**
 * World controls: Play/Pause/Step/Reset, preset selector
 */

"use client";

import { useRef, useState } from "react";
import { useSimStore } from "@/lib/store";
import { createWorldFromPreset, getAvailablePresets } from "@/lib/sim/presets";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import ExportButton from "./ExportButton";
import { showToast } from "./Toast";

export default function WorldControls() {
  const { isPlaying, setIsPlaying, setHistory, setRunMetadata, reset, currentTimeStep, setCurrentTimeStep, history } = useSimStore();
  const [presetId, setPresetId] = useState("two_species_simple_lake");
  const [isRunning, setIsRunning] = useState(false);
  
  const inFlight = useRef(false);
  const generation = useRef(0);
  const presets = getAvailablePresets();

  // Define handlers first (before useKeyboardShortcuts)
  const resetToPreset = (nextPreset: string) => {
    generation.current++;
    reset();
    const initial = createWorldFromPreset(nextPreset, {}, 12345);
    setRunMetadata(initial.config, {seed:12345, presetId:nextPreset, mode:"baseline"});
    setHistory([initial.world]);
  };
  const handleReset = () => resetToPreset(presetId);
  
  const handleStep = async () => {
    if (inFlight.current) return;
    const requestGeneration = generation.current;
    inFlight.current = true;
    setIsRunning(true);
    
    try {
      const seed = 12345;
      const numSteps = Math.max(1, useSimStore.getState().history.length);
      if (numSteps > 200) { setIsPlaying(false); return; }
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId,
          numSteps,
          config: { useBaselineAgents: true },
          seed, // Use deterministic seed
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}`;
        console.error("Step error:", errorMessage);
        showToast(`Simulation error: ${errorMessage}`, "error");
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      if (requestGeneration === generation.current && data.history?.length) {
        const previousLength = useSimStore.getState().history.length;
        setRunMetadata(data.config, data.provenance);
        setHistory(data.history);
        if (data.history.length <= previousLength) setIsPlaying(false);
      }

    } catch (error) {
      setIsPlaying(false);
      console.error("Step error:", error);
    } finally {
      inFlight.current = false;
      setIsRunning(false);
    }
  };
  
  const handlePlay = async () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    
    setIsPlaying(true);
    
    // Run simulation steps
    const runSteps = async () => {
      while (useSimStore.getState().isPlaying) {
        await handleStep();
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    };
    
    runSteps();
  };

  // Keyboard shortcuts (after handlers are defined)
  useKeyboardShortcuts([
    {
      key: " ",
      action: () => !isRunning && handlePlay(),
      description: "Play/Pause",
    },
    {
      key: "s",
      ctrl: true,
      action: () => !isRunning && handleStep(),
      description: "Step",
    },
    {
      key: "r",
      ctrl: true,
      action: handleReset,
      description: "Reset",
    },
  ]);
  
  return (
    <div className="flex flex-col md:flex-row flex-wrap items-center gap-4 justify-between font-mono text-xs uppercase">
      <div className="flex items-center gap-3 w-full md:w-auto">
        <span className="opacity-55 tracking-widest">Scenario:</span>
        <div className="relative group">
          <select
            value={presetId}
            onChange={(e) => { resetToPreset(e.target.value); setPresetId(e.target.value); }}
            className="appearance-none bg-background border border-border px-5 py-2.5 pr-8 w-full md:w-auto hover:bg-surface/50 cursor-pointer focus:outline-hidden focus:border-foreground/40 transition-colors"
          >
            {presets.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] opacity-50">
            ▼
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
        <button
          onClick={handlePlay}
          disabled={isRunning && !isPlaying}
          className={`
            shrink-0 whitespace-nowrap px-6 py-2.5 border border-border transition-all
            ${isPlaying 
              ? 'bg-foreground text-background border-foreground' 
              : 'hover:bg-foreground hover:text-background'}
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-foreground
          `}
        >
          {isPlaying ? "[ Running ]" : "[ Play ]"}
        </button>
        
        <button
          onClick={handleStep}
          disabled={isRunning}
          className="px-5 py-2.5 border border-border hover:bg-foreground hover:text-background disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Step
        </button>
        
        <button
          onClick={handleReset}
          className="px-5 py-2.5 border border-border hover:bg-[var(--signal-collapse)] hover:text-background hover:border-[var(--signal-collapse)] transition-all"
        >
          Reset
        </button>
        
        <ExportButton />
      </div>
      
      {history.length > 0 && (
        <div className="w-full md:w-auto flex-1 flex items-center gap-4 md:gap-5 border-l border-border/40 pl-4 md:pl-6">
          <label className="whitespace-nowrap opacity-50 font-mono text-[10px] uppercase tracking-wider text-foreground/60">
            T: <span className="tabular-nums">{String(currentTimeStep).padStart(3, '0')}</span>
          </label>
          <input
            type="range"
            min={0}
            max={Math.max(0, history.length - 1)}
            value={currentTimeStep}
            onChange={(e) => setCurrentTimeStep(Number(e.target.value))}
            className="w-full h-1.5 bg-border/40 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-border/40 [&::-webkit-slider-thumb]:rounded-none hover:[&::-webkit-slider-thumb]:bg-foreground/80 transition-colors"
            aria-label="Timeline scrubber"
          />
        </div>
      )}
    </div>
  );
}
