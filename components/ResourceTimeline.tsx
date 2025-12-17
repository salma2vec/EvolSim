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
  
  interface DataPoint {
    timeStep: number;
    [resourceName: string]: number | string;
  }

  const data: DataPoint[] = history.map((state) => {
    const point: DataPoint = { timeStep: state.timeStep };
    state.resources.forEach((resource) => {
      point[resource.def.name] = resource.amount;
    });
    return point;
  });
  
  // Monochrome colors - only use signal colors for collapse
  const colors = ["var(--foreground)", "rgba(230, 227, 220, 0.6)", "rgba(230, 227, 220, 0.4)", "rgba(230, 227, 220, 0.3)"];
  
  return (
    <div className="panel">
      <div className="panel-header">Resource Trajectory</div>
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

