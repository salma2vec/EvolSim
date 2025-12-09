/**
 * Export simulation data button
 */

"use client";

import { useSimStore } from "@/lib/store";
import { exportSimulation, downloadSimulation } from "@/lib/utils/export";
import { useState } from "react";
import LoadingSpinner from "./LoadingSpinner";

export default function ExportButton() {
  const { history, currentState } = useSimStore();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (history.length === 0 || !currentState) return;

    setIsExporting(true);
    try {
      const config = {
        maxTimeSteps: 100,
        harvestNoise: 0.05,
        historyLength: 5,
      };

      const exported = exportSimulation(history, config, {
        description: "Exported simulation",
      });

      const filename = `evolsim-${Date.now()}.json`;
      downloadSimulation(exported, filename);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  if (history.length === 0) {
    return null;
  }

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="px-4 py-2 border border-border hover:bg-foreground hover:text-background disabled:opacity-50 transition-colors text-xs uppercase font-mono"
    >
      {isExporting ? <LoadingSpinner size="sm" /> : "Export"}
    </button>
  );
}

