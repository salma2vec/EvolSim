/**
 * Retro tile map: High-fidelity "Thermal/Radar" Canvas visualization
 */

"use client";

import { useSimStore } from "@/lib/store";
import { useEffect, useRef } from "react";

export default function RetroTileMap() {
  const { currentState } = useSimStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Render loop
  useEffect(() => {
    if (!currentState || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Set explicit resolution for high-DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    // Config
    const width = rect.width;
    const height = rect.height;
    const { planet, resources, species, timeStep } = currentState;
    
    // Clear with "CRT black"
    ctx.fillStyle = "#0B0C0E";
    ctx.fillRect(0, 0, width, height);
    
    // 1. Generate/Render Terrain Grid (Simulated based on volatility/richness)
    // We use a pseudo-random grid seeded by the planet stats
    const gridSize = 20;
    const cols = Math.ceil(width / gridSize);
    const rows = Math.ceil(height / gridSize);
    
    ctx.lineWidth = 1;
    
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // Pseudo-noise function
        const noise = Math.sin(x * 0.1 + planet.volatility * 10) * Math.cos(y * 0.1 + planet.richness * 10);
        const threshold = 0.2; // Water level essentially
        
        const isLand = noise > threshold;
        
        if (isLand) {
          // Draw "Land" - Dithered pattern
          ctx.fillStyle = `rgba(236, 231, 225, ${0.05 + (noise * 0.05)})`; // Very subtle
          ctx.fillRect(x * gridSize, y * gridSize, gridSize - 1, gridSize - 1);
        } else {
          // Draw "Sea" - Crosshatch or empty
          ctx.strokeStyle = "rgba(236, 231, 225, 0.02)";
          ctx.strokeRect(x * gridSize, y * gridSize, gridSize - 1, gridSize - 1);
        }
      }
    }
    
    // 2. Render Resources as Heatmap Blobs
    resources.forEach((res, idx) => {
        // We simulate resource locations based on index (just for viz)
        const centerX = width * (0.3 + (idx * 0.3) % 0.6);
        const centerY = height * (0.3 + (idx * 0.4) % 0.6);
        const radius = (res.amount / res.def.capacityK) * 100;
        
        // Glow
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        if (res.collapsed) {
            gradient.addColorStop(0, "rgba(255, 69, 0, 0.4)"); // Red
            gradient.addColorStop(1, "rgba(255, 69, 0, 0)");
        } else {
             // Use accent colors (Amber/Green/Acid)
             const color = idx % 2 === 0 ? "255, 176, 0" : "204, 255, 0";
             gradient.addColorStop(0, `rgba(${color}, 0.2)`);
             gradient.addColorStop(1, `rgba(${color}, 0)`);
        }
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Label
        ctx.fillStyle = res.collapsed ? "#FF4500" : "rgba(236, 231, 225, 0.7)";
        ctx.font = "10px JetBrains Mono";
        ctx.fillText(`${res.def.name.substring(0, 3).toUpperCase()}`, centerX - 10, centerY);
    });
    
    // 3. Render Species as Tactical Markers
    species.filter(s => s.alive).forEach((s, idx) => {
         // Orbit or wander behavior visualization
         const t = Date.now() / 2000;
         const offset = (idx * Math.PI * 2) / species.length;
         const orbitR = 80 + Math.sin(t + idx) * 20;
         
         const sx = width/2 + Math.cos(t + offset) * orbitR;
         const sy = height/2 + Math.sin(t + offset) * orbitR;
         
         // Draw Marker (Triangle)
         ctx.save();
         ctx.translate(sx, sy);
         ctx.rotate(t + offset + Math.PI/2);
         
         ctx.beginPath();
         ctx.moveTo(0, -6);
         ctx.lineTo(5, 6);
         ctx.lineTo(-5, 6);
         ctx.closePath();
         
         ctx.fillStyle = "#ECE7E1";
         ctx.fill();
         ctx.restore();
         
         // Trail
         ctx.strokeStyle = "rgba(236, 231, 225, 0.2)";
         ctx.beginPath();
         ctx.arc(width/2, height/2, orbitR, t + offset - 0.5, t + offset);
         ctx.stroke();
         
         // Name Tag
         ctx.fillStyle = "#ECE7E1";
         ctx.font = "bold 10px JetBrains Mono";
         ctx.fillText(`${s.traits.name.substring(0, 4)}`, sx + 10, sy);
    });
    
    // 4. Scanline Overlay (Canvas specific)
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    for (let y = 0; y < height; y += 2) {
        ctx.fillRect(0, y, width, 1);
    }

  }, [currentState]); // Re-render when state changes
  
  if (!currentState) {
    return (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center border border-border bg-background/50">
        <div className="text-center space-y-2">
           <div className="animate-spin w-8 h-8 border-2 border-border border-t-accent rounded-full mx-auto"/>
           <p className="font-mono text-xs uppercase tracking-widest opacity-50">Initializing Terrain...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col min-h-[400px]">
      <div className="flex justify-between items-center mb-2 px-4 pt-4">
        <h2 className="text-xs font-bold tracking-widest uppercase opacity-70">
          Sector Scan // <span className="text-accent animate-pulse">LIVE</span>
        </h2>
        <div className="font-mono text-[10px] opacity-50">
          GRID: {currentState.planet.gravity.toFixed(2)}G / RAD: {currentState.planet.volatility.toFixed(2)}
        </div>
      </div>
      
      <div className="flex-1 relative w-full h-full border-t border-b border-border bg-black overflow-hidden">
        <canvas 
            ref={canvasRef}
            className="w-full h-full object-cover"
            style={{ imageRendering: "pixelated" }}
        />
        
        {/* HUD Overlay Elements */}
        <div className="absolute top-4 left-4 text-[10px] font-mono text-accent opacity-70 pointer-events-none">
            TARGET: ALPHA-7<br/>
            ELEV: 00.00
        </div>
        
        {/* Corner Brackets */}
        <div className="absolute top-2 left-2 w-4 h-4 border-t border-l border-white/20" />
        <div className="absolute top-2 right-2 w-4 h-4 border-t border-r border-white/20" />
        <div className="absolute bottom-2 left-2 w-4 h-4 border-b border-l border-white/20" />
        <div className="absolute bottom-2 right-2 w-4 h-4 border-b border-r border-white/20" />
      </div>
    </div>
  );
}
