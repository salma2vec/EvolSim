/**
 * Export/import utilities for simulation data
 */

import { WorldState, SimConfig } from "../sim/types";

export interface ExportData {
  version: string;
  timestamp: number;
  config: SimConfig;
  history: WorldState[];
  metadata?: {
    presetId?: string;
    seed?: number;
    description?: string;
    provenance?: Record<string, unknown>;
  };
}

/**
 * Export simulation history to JSON
 */
export function exportSimulation(
  history: WorldState[],
  config: SimConfig,
  metadata?: ExportData["metadata"]
): string {
  const exportData: ExportData = {
    version: "2.0.0",
    timestamp: Date.now(),
    config,
    history,
    metadata,
  };
  
  return JSON.stringify(exportData, null, 2);
}

/**
 * Import simulation from JSON
 */
export function importSimulation(json: string): ExportData {
  try {
    const data = JSON.parse(json) as ExportData;
    
    // Validate structure
    if (!data.history || !Array.isArray(data.history)) {
      throw new Error("Invalid export format: missing or invalid history");
    }
    
    if (!data.config) {
      throw new Error("Invalid export format: missing config");
    }
    
    return data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid JSON format");
    }
    throw error;
  }
}

/**
 * Download simulation data as file
 */
export function downloadSimulation(data: string, filename: string = "simulation.json"): void {
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

