import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { MonthlyRevenue } from "@/services/dashboard-service";

interface RevenueChartProps {
  data: MonthlyRevenue[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  // Format month labels: "2025-01" -> "Jan/25"
  const chartData = data.map((d) => ({
    ...d,
    label: new Date(d.month + "-01").toLocaleDateString("pt-BR", {
      month: "short",
      year: "2-digit",
    }),
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="w-full h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              dy={10}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted)/0.2)" }}
              formatter={(value: number | undefined, name: string | undefined) => [
                formatCurrency(value ?? 0),
                name === "received" ? "Recebido" : "Pendente",
              ]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
              labelStyle={{ color: "hsl(var(--foreground))", marginBottom: "0.5rem" }}
            />
            <Bar dataKey="received" fill="#22c55e" radius={[4, 4, 0, 0]} stackId="a" maxBarSize={40} />
            <Bar dataKey="pending" fill="#f59e0b" radius={[4, 4, 0, 0]} stackId="a" maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
          <span className="text-sm text-muted-foreground">Recebido</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
          <span className="text-sm text-muted-foreground">Pendente</span>
        </div>
      </div>
    </div>
  );
}
