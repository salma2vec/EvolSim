/**
 * World controls: Play/Pause/Step/Reset, preset selector
 */

"use client";

import { useState } from "react";
import { useSimStore } from "@/lib/store";
import { getAvailablePresets } from "@/lib/sim/presets";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import ExportButton from "./ExportButton";

export default function WorldControls() {
  const { isPlaying, setIsPlaying, setHistory, reset, currentTimeStep, setCurrentTimeStep, history } = useSimStore();
  const [presetId, setPresetId] = useState("two_species_simple_lake");
  const [isRunning, setIsRunning] = useState(false);
  
  const presets = getAvailablePresets();

  // Keyboard shortcuts
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
  
  const handleReset = async () => {
    reset();
    setIsRunning(false);
  };
  
  const handleStep = async () => {
    if (isRunning) return;
    setIsRunning(true);
    
    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId,
          numSteps: 1,
          seed: Date.now(),
        }),
      });
      
      const data = await response.json();
      if (data.history) {
        setHistory([...history, ...data.history.slice(history.length)]);
      }
    } catch (error) {
      console.error("Step error:", error);
    } finally {
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
      while (useSimStore.getState().isPlaying && !isRunning) {
        await handleStep();
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    };
    
    runSteps();
  };
  
  return (
    <div className="flex flex-col md:flex-row items-center gap-4 justify-between font-mono text-xs uppercase">
      <div className="flex items-center gap-2 w-full md:w-auto">
        <span className="opacity-50 tracking-widest">Scenario:</span>
        <div className="relative group">
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            className="appearance-none bg-background border border-border px-4 py-2 pr-8 w-full md:w-auto hover:bg-border/10 cursor-pointer focus:outline-none focus:border-accent transition-colors"
          >
            {presets.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[10px]">
            ▼
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 w-full md:w-auto justify-end">
        <button
          onClick={handlePlay}
          disabled={isRunning}
          className={`
            px-6 py-2 border border-border transition-all
            ${isPlaying 
              ? 'bg-accent text-background border-accent animate-pulse' 
              : 'hover:bg-foreground hover:text-background'}
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isPlaying ? "[ Running ]" : "[ Play ]"}
        </button>
        
        <button
          onClick={handleStep}
          disabled={isRunning}
          className="px-4 py-2 border border-border hover:border-accent hover:text-accent disabled:opacity-50 transition-colors"
        >
          Step
        </button>
        
        <button
          onClick={handleReset}
          className="px-4 py-2 border border-border hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"
        >
          Reset
        </button>
        
        <ExportButton />
      </div>
      
      {history.length > 0 && (
        <div className="w-full md:w-auto flex-1 flex items-center gap-4 border-l border-border pl-4">
          <label className="whitespace-nowrap opacity-50">T: {String(currentTimeStep).padStart(3, '0')}</label>
          <input
            type="range"
            min={0}
            max={Math.max(0, history.length - 1)}
            value={currentTimeStep}
            onChange={(e) => setCurrentTimeStep(Number(e.target.value))}
            className="w-full h-1 bg-border appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-accent"
          />
        </div>
      )}
    </div>
  );
}

