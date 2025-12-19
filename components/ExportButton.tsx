/**
 * Export simulation data button
 */

"use client";

import { useSimStore } from "@/lib/store";
import { exportSimulation, downloadSimulation } from "@/lib/utils/export";
import { useState } from "react";
import LoadingSpinner from "./LoadingSpinner";
import { showToast } from "./Toast";

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
      showToast(`Exported ${filename}`, "success", 3000);
    } catch (error) {
      console.error("Export failed:", error);
      showToast(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`, "error");
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
      className="px-5 py-2.5 border border-border hover:bg-foreground hover:text-background disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-foreground transition-all text-xs uppercase font-mono"
    >
      {isExporting ? <LoadingSpinner size="sm" /> : "Export"}
    </button>
  );
}

