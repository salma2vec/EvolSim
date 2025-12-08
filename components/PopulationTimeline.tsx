/**
 * Population timeline: Stacked area chart of species populations
 */

"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useSimStore } from "@/lib/store";

export default function PopulationTimeline() {
  const { history } = useSimStore();
  
  if (history.length === 0) {
    return (
      <div className="border border-border p-4 h-[300px] flex items-center justify-center">
        <p className="font-mono text-xs uppercase opacity-50">No population data</p>
      </div>
    );
  }
  
  const data = history.map((state) => {
    const point: any = { timeStep: state.timeStep };
    state.species.forEach((species) => {
      point[species.traits.name] = species.population / 1000000; // Convert to millions
    });
    return point;
  });
  
  const colors = ["var(--accent)", "#FF4500", "#00FFFF", "#FF00FF", "#9B59B6", "#1ABC9C"];
  
  return (
    <div className="border border-border p-4 bg-background">
      <h2 className="text-xs font-bold tracking-widest uppercase mb-4 opacity-50">Population Dynamics</h2>
      <div className="h-[250px] w-full font-mono text-[10px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
            <XAxis dataKey="timeStep" stroke="var(--foreground)" opacity={0.5} tick={{fill: 'var(--foreground)'}} />
            <YAxis stroke="var(--foreground)" opacity={0.5} tick={{fill: 'var(--foreground)'}} />
            <Tooltip
              contentStyle={{ 
                backgroundColor: "var(--background)", 
                border: "1px solid var(--border)", 
                color: "var(--foreground)",
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                fontSize: "12px"
              }}
              formatter={(value: number) => [`${value.toFixed(2)}M`, "POP"]}
              itemStyle={{ color: "var(--foreground)" }}
            />
            <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', paddingTop: '10px' }} />
            {history[0]?.species.map((species, idx) => (
              <Area
                key={species.traits.id}
                type="step"
                dataKey={species.traits.name}
                stackId="1"
                stroke={colors[idx % colors.length]}
                fill={colors[idx % colors.length]}
                fillOpacity={0.1}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

