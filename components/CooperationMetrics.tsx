/**
 * Cooperation metrics: Bar chart of cooperation index per species
 */

"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useSimStore } from "@/lib/store";
import { computeCooperationIndex } from "@/lib/sim/metrics";

export default function CooperationMetrics() {
  const { history } = useSimStore();
  
  if (history.length === 0) {
    return (
      <div className="border border-border p-4">
        <p className="font-mono text-xs uppercase opacity-50">No metric data</p>
      </div>
    );
  }
  
  const cooperationIndex = computeCooperationIndex(history);
  const data = Object.entries(cooperationIndex).map(([speciesId, value]) => {
    const species = history[history.length - 1]?.species.find((s) => s.traits.id === speciesId);
    return {
      name: species?.traits.name || speciesId,
      cooperation: value,
    };
  });
  
  return (
    <div className="border border-border p-4 bg-background">
      <h2 className="text-xs font-bold tracking-widest uppercase mb-4 opacity-50">Cooperation Index</h2>
      <div className="h-[250px] w-full font-mono text-[10px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
            <XAxis dataKey="name" stroke="var(--foreground)" opacity={0.5} tick={{fill: 'var(--foreground)'}} />
            <YAxis stroke="var(--foreground)" opacity={0.5} domain={[0, 1]} tick={{fill: 'var(--foreground)'}} />
            <Tooltip
              contentStyle={{ 
                backgroundColor: "var(--background)", 
                border: "1px solid var(--border)", 
                color: "var(--foreground)",
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase"
              }}
              cursor={{fill: 'var(--border)', opacity: 0.2}}
              formatter={(value: number) => [value.toFixed(2), "INDEX"]}
            />
            <Bar dataKey="cooperation" fill="var(--accent)" radius={[0, 0, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] font-mono opacity-50 mt-2 text-center uppercase">
        1.0 = Hive Mind / 0.0 = Pure Defector
      </p>
    </div>
  );
}

