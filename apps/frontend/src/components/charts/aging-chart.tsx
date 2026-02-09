import type { AgingReport } from "@/services/dashboard-service";

interface AgingChartProps {
  data: AgingReport;
}

const AGING_COLORS = {
  "0_30": "#f59e0b",
  "31_60": "#f97316",
  "61_90": "#ef4444",
  "90_plus": "#dc2626",
};

export function AgingChart({ data }: AgingChartProps) {
  const chartData = [
    { name: "0-30 dias", value: data["0_30"], key: "0_30" as const },
    { name: "31-60 dias", value: data["31_60"], key: "31_60" as const },
    { name: "61-90 dias", value: data["61_90"], key: "61_90" as const },
    { name: "90+ dias", value: data["90_plus"], key: "90_plus" as const },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[140px] text-sm text-muted-foreground">
        Nenhum honorario em atraso
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stacked horizontal bar */}
      <div className="h-8 rounded-lg overflow-hidden flex">
        {chartData.map((item) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={item.key}
              className="h-full transition-all"
              style={{
                width: `${pct}%`,
                backgroundColor: AGING_COLORS[item.key],
              }}
              title={`${item.name}: ${formatCurrency(item.value)}`}
            />
          );
        })}
      </div>

      {/* Legend with values */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {chartData.map((item) => (
          <div key={item.key} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: AGING_COLORS[item.key] }}
            />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{item.name}</p>
              <p className="text-sm font-semibold text-foreground">
                {formatCurrency(item.value)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
