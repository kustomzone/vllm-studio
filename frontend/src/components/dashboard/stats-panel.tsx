import { Metrics } from '@/lib/types';

const ELECTRICITY_PRICE_PLN = 1.20;

interface StatsPanelProps {
  metrics: Metrics | null;
  className?: string;
}

export function StatsPanel({ metrics, className }: StatsPanelProps) {
  if (!metrics) return null;

  return (
    <div className={cn('space-y-6 sm:space-y-8', className)}>
      <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-6">
        <StatsSection title="Session" stats={[
          { label: 'Requests', value: metrics.request_success || 0 },
          { label: 'Input', value: metrics.prompt_tokens_total?.toLocaleString() || 0 },
          { label: 'Output', value: metrics.generation_tokens_total?.toLocaleString() || 0 },
          { label: 'Running', value: metrics.running_requests || 0 },
        ]} />

        <StatsSection title="Lifetime" stats={[
          { label: 'Input', value: metrics.lifetime_prompt_tokens?.toLocaleString() || 0 },
          { label: 'Output', value: metrics.lifetime_completion_tokens?.toLocaleString() || 0 },
          { label: 'Requests', value: metrics.lifetime_requests?.toLocaleString() || 0 },
          { label: 'Energy', value: metrics.lifetime_energy_kwh ? `${metrics.lifetime_energy_kwh.toFixed(2)} kWh` : '--' },
          { label: 'Uptime', value: metrics.lifetime_uptime_hours ? `${metrics.lifetime_uptime_hours.toFixed(1)}h` : '--' },
        ]} />
      </div>

      <CostAnalytics metrics={metrics} />
    </div>
  );
}

interface StatsSectionProps {
  title: string;
  stats: Array<{ label: string; value: string | number }>;
}

function StatsSection({ title, stats }: StatsSectionProps) {
  return (
    <div>
      <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider mb-3">{title}</div>
      <div className="space-y-1.5 sm:space-y-2">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center justify-between py-1">
            <span className="text-[var(--muted-foreground)] text-sm">{stat.label}</span>
            <span className="text-sm text-[var(--foreground)]">{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CostAnalytics({ metrics }: { metrics: Metrics }) {
  return (
    <div>
      <div className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider mb-3">Cost Analytics</div>
      <div className="bg-[var(--card)] rounded-lg p-3 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-[var(--muted-foreground)]">Total Cost</span>
          <span className="text-lg font-medium text-[var(--success)]">
            {metrics.lifetime_energy_kwh ? `${(metrics.lifetime_energy_kwh * ELECTRICITY_PRICE_PLN).toFixed(2)} PLN` : '--'}
          </span>
        </div>
        <div className="border-t border-[var(--border)] pt-2 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--muted-foreground)]">kWh/M Input</span>
            <span className="text-[var(--link)]">
              {metrics.kwh_per_million_input ? metrics.kwh_per_million_input.toFixed(3) : '--'}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[var(--muted-foreground)]">kWh/M Output</span>
            <span className="text-[var(--success)]">
              {metrics.kwh_per_million_output ? metrics.kwh_per_million_output.toFixed(3) : '--'}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[var(--muted-foreground)]">PLN/M Input</span>
            <span className="text-[var(--link)]">
              {metrics.kwh_per_million_input ? (metrics.kwh_per_million_input * ELECTRICITY_PRICE_PLN).toFixed(2) : '--'}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[var(--muted-foreground)]">PLN/M Output</span>
            <span className="text-[var(--success)]">
              {metrics.kwh_per_million_output ? (metrics.kwh_per_million_output * ELECTRICITY_PRICE_PLN).toFixed(2) : '--'}
            </span>
          </div>
        </div>
        <div className="border-t border-[var(--border)] pt-2">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--muted-foreground)]">Current Draw</span>
            <span className="text-[var(--foreground)]">
              {metrics.current_power_watts ? `${Math.round(metrics.current_power_watts)}W` : '--'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
