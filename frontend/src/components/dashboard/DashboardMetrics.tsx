import type { GPU, Metrics } from "@/lib/types";

interface DashboardMetricsProps {
  metrics: Metrics | null;
  gpus: GPU[];
}

export function DashboardMetrics({ metrics, gpus }: DashboardMetricsProps) {
  const toGB = (value: number): number => {
    if (value > 1e10) return value / (1024 * 1024 * 1024);
    if (value > 1e8) return value / (1024 * 1024 * 1024);
    if (value > 1000) return value / 1024;
    return value;
  };

  const totalPower = gpus.reduce((sum, g) => sum + (g.power_draw || 0), 0);
  const totalMem = gpus.reduce((sum, g) => sum + toGB(g.memory_used_mb ?? g.memory_used ?? 0), 0);
  const totalMemMax = gpus.reduce(
    (sum, g) => sum + toGB(g.memory_total_mb ?? g.memory_total ?? 0),
    0,
  );

  return (
    <section className="mb-6 pb-5 border-b border-(--border)/40">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
        <Metric
          label="Requests"
          value={metrics?.running_requests || 0}
          sub={metrics?.pending_requests ? `${metrics.pending_requests} pending` : undefined}
        />
        <Metric
          label="Generation"
          value={metrics?.generation_throughput?.toFixed(1) || "--"}
          sub={
            metrics?.peak_generation_tps
              ? `peak ${metrics.peak_generation_tps.toFixed(1)}`
              : undefined
          }
        />
        <Metric
          label="Prefill"
          value={metrics?.prompt_throughput?.toFixed(1) || "--"}
          sub={
            metrics?.peak_prefill_tps ? `peak ${metrics.peak_prefill_tps.toFixed(1)}` : undefined
          }
        />
        <Metric
          label="TTFT"
          value={metrics?.avg_ttft_ms ? Math.round(metrics.avg_ttft_ms) : "--"}
          sub={metrics?.peak_ttft_ms ? `best ${Math.round(metrics.peak_ttft_ms)}ms` : undefined}
        />
        <Metric
          label="KV Cache"
          value={
            metrics?.kv_cache_usage != null ? `${Math.round(metrics.kv_cache_usage * 100)}%` : "--"
          }
        />
        <Metric
          label="Power"
          value={`${Math.round(totalPower)}W`}
          sub={`${totalMem.toFixed(0)}/${totalMemMax.toFixed(0)}G`}
        />
      </div>
    </section>
  );
}

function Metric({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-(--muted-foreground) mb-1 font-medium">
        {label}
      </div>
      <div className="text-base sm:text-lg text-(--foreground) font-normal tracking-tight tabular-nums">
        {value}
      </div>
      {sub && <div className="text-xs text-(--muted-foreground)/70 mt-0.5">{sub}</div>}
    </div>
  );
}
