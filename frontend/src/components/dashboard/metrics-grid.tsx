import { Metrics } from '@/lib/types';
import { cn } from '@/lib/cn';

interface MetricsGridProps {
  metrics: Metrics | null;
  totalPower: number;
  className?: string;
}

export function MetricsGrid({ metrics, totalPower, className }: MetricsGridProps) {
  if (!metrics) return null;

  return (
    <div className={cn('grid grid-cols-3 sm:grid-cols-6 gap-4 sm:gap-8 mb-6 sm:mb-10', className)}>
      <Metric label="Requests" value={metrics.running_requests || 0} sub={`${metrics.pending_requests || 0} pending`} />
      <Metric
        label="Gen"
        value={metrics.generation_throughput?.toFixed(1) || '--'}
        sub={metrics.peak_generation_tps ? `peak ${metrics.peak_generation_tps.toFixed(1)}` : 'tok/s'}
      />
      <Metric
        label="Prefill"
        value={metrics.prompt_throughput?.toFixed(1) || '--'}
        sub={metrics.peak_prefill_tps ? `peak ${metrics.peak_prefill_tps.toFixed(1)}` : 'tok/s'}
      />
      <Metric
        label="TTFT"
        value={metrics.avg_ttft_ms ? Math.round(metrics.avg_ttft_ms) : '--'}
        sub={metrics.peak_ttft_ms ? `best ${Math.round(metrics.peak_ttft_ms)}ms` : 'ms'}
      />
      <Metric label="KV Cache" value={metrics.kv_cache_usage != null ? `${Math.round(metrics.kv_cache_usage * 100)}%` : '--'} />
      <Metric label="Power" value={`${Math.round(totalPower)}W`} />
    </div>
  );
}

interface MetricProps {
  label: string;
  value: string | number;
  sub?: string;
}

function Metric({ label, value, sub }: MetricProps) {
  return (
    <div>
      <div className="text-[10px] sm:text-xs text-[var(--muted-foreground)] mb-0.5 sm:mb-1">{label}</div>
      <div className="text-lg sm:text-2xl text-[var(--foreground)] font-light tracking-tight">{value}</div>
      {sub && <div className="text-[10px] sm:text-xs text-[var(--muted-foreground)]/60 mt-0.5">{sub}</div>}
    </div>
  );
}
