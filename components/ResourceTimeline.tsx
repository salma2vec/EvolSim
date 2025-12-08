/**
 * Resource timeline: Multi-line chart of resource levels over time
 */

"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useSimStore } from "@/lib/store";

export default function ResourceTimeline() {
  const { history } = useSimStore();
  
  if (history.length === 0) {
    return (
      <div className="border border-border p-4 h-[300px] flex items-center justify-center">
        <p className="font-mono text-xs uppercase opacity-50">No resource data</p>
      </div>
    );
  }
  
  const data = history.map((state) => {
    const point: any = { timeStep: state.timeStep };
    state.resources.forEach((resource) => {
      point[resource.def.name] = resource.amount;
    });
    return point;
  });
  
  const colors = ["var(--accent)", "#FF4500", "#00FFFF", "#FF00FF", "#9B59B6"];
  
  return (
    <div className="border border-border p-4 bg-background">
      <h2 className="text-xs font-bold tracking-widest uppercase mb-4 opacity-50">Resource Analysis</h2>
      <div className="h-[250px] w-full font-mono text-[10px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
            <XAxis dataKey="timeStep" stroke="var(--foreground)" opacity={0.5} tick={{fill: 'var(--foreground)'}} />
            <YAxis stroke="var(--foreground)" opacity={0.5} tick={{fill: 'var(--foreground)'}} />
            <Tooltip
              contentStyle={{ 
                backgroundColor: "var(--background)", 
                border: "1px solid var(--border)", 
                color: "var(--foreground)",
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase"
              }}
              itemStyle={{ color: "var(--foreground)" }}
            />
            <Legend wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', paddingTop: '10px' }} />
            {history[0]?.resources.map((resource, idx) => (
              <Line
                key={resource.def.id}
                type="step"
                dataKey={resource.def.name}
                stroke={colors[idx % colors.length]}
                strokeWidth={1}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

