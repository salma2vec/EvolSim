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
  const { history, currentState, config, provenance } = useSimStore();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (history.length === 0 || !currentState || !config) return;

    setIsExporting(true);
    try {
      const exported = exportSimulation(history, config, { description: "Exported baseline simulation", provenance: provenance ?? undefined });

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
      className="px-5 py-2.5 border border-border/40 bg-surface/20 hover:bg-foreground hover:text-background hover:border-foreground disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface/20 disabled:hover:text-foreground transition-all text-[11px] uppercase font-mono font-medium"
    >
      {isExporting ? <LoadingSpinner size="sm" /> : "Export"}
    </button>
  );
}

