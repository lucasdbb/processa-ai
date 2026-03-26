import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { ProcessStatusItem } from "@/services/dashboard-service";

const STATUS_COLORS: Record<string, string> = {
  active: "#3b82f6",
  pending: "#f59e0b",
  suspended: "#8b5cf6",
  concluded: "#22c55e",
  cancelled: "#ef4444",
  archived: "#6b7280",
};

interface ProcessesChartProps {
  data: ProcessStatusItem[];
  total: number;
}

export function ProcessesChart({ data, total }: ProcessesChartProps) {
  const hasData = data.length > 0 && total > 0;

  const emptyData = [{ status: "empty", label: "Sem dados", count: 1 }];

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="w-full h-[250px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={hasData ? data : emptyData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={100}
              dataKey="count"
              nameKey="label"
              stroke="hsl(var(--card))"
              strokeWidth={3}
            >
              {hasData ? (
                data.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={STATUS_COLORS[entry.status] || "#6b7280"}
                  />
                ))
              ) : (
                <Cell fill="hsl(var(--muted))" />
              )}
            </Pie>
            {hasData && (
              <Tooltip
                formatter={(value: number | undefined, name: string | undefined) => [value ?? 0, name ?? '']}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-foreground">{total}</span>
          <span className="text-xs text-muted-foreground">processos</span>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        {data
          .filter((d) => d.count > 0)
          .map((item) => (
            <div key={item.status} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: STATUS_COLORS[item.status] || "#6b7280",
                }}
              />
              <span className="text-muted-foreground">
                {item.label} ({item.count})
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
