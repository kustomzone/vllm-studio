import type { Metrics } from "@/lib/types";

const ELECTRICITY_PRICE_PLN = 1.2;

interface DashboardSidebarProps {
  metrics: Metrics | null;
}

export function DashboardSidebar({ metrics }: DashboardSidebarProps) {
  return (
    <div className="space-y-6">
      <SessionStats metrics={metrics} />
      <LifetimeStats metrics={metrics} />
      <CostAnalytics metrics={metrics} />
    </div>
  );
}

function SessionStats({ metrics }: { metrics: Metrics | null }) {
  if (
    !metrics?.request_success &&
    !metrics?.prompt_tokens_total &&
    !metrics?.generation_tokens_total &&
    !metrics?.running_requests
  ) {
    return null;
  }

  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider text-(--muted-foreground) mb-3 font-medium">
        Session
      </h2>
      <div className="space-y-2">
        {metrics?.request_success !== undefined && (
          <StatRow label="Requests" value={metrics.request_success} />
        )}
        {metrics?.prompt_tokens_total !== undefined && (
          <StatRow label="Input Tokens" value={metrics.prompt_tokens_total.toLocaleString()} />
        )}
        {metrics?.generation_tokens_total !== undefined && (
          <StatRow label="Output Tokens" value={metrics.generation_tokens_total.toLocaleString()} />
        )}
        {metrics?.running_requests !== undefined && (
          <StatRow label="Running" value={metrics.running_requests} accent />
        )}
      </div>
    </section>
  );
}

function LifetimeStats({ metrics }: { metrics: Metrics | null }) {
  if (
    !metrics?.lifetime_prompt_tokens &&
    !metrics?.lifetime_completion_tokens &&
    !metrics?.lifetime_requests &&
    !metrics?.lifetime_energy_kwh &&
    !metrics?.lifetime_uptime_hours
  ) {
    return null;
  }

  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider text-(--muted-foreground) mb-3 font-medium">
        Lifetime
      </h2>
      <div className="space-y-2">
        {metrics?.lifetime_prompt_tokens !== undefined && (
          <StatRow label="Input Tokens" value={metrics.lifetime_prompt_tokens.toLocaleString()} />
        )}
        {metrics?.lifetime_completion_tokens !== undefined && (
          <StatRow
            label="Output Tokens"
            value={metrics.lifetime_completion_tokens.toLocaleString()}
          />
        )}
        {metrics?.lifetime_requests !== undefined && (
          <StatRow label="Total Requests" value={metrics.lifetime_requests.toLocaleString()} />
        )}
        {metrics?.lifetime_energy_kwh !== undefined && (
          <StatRow label="Energy" value={`${metrics.lifetime_energy_kwh.toFixed(2)} kWh`} />
        )}
        {metrics?.lifetime_uptime_hours !== undefined && (
          <StatRow label="Uptime" value={`${metrics.lifetime_uptime_hours.toFixed(1)}h`} />
        )}
      </div>
    </section>
  );
}

function CostAnalytics({ metrics }: { metrics: Metrics | null }) {
  if (!metrics?.lifetime_energy_kwh && !metrics?.current_power_watts) {
    return null;
  }

  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider text-(--muted-foreground) mb-3 font-medium">
        Cost Analytics
      </h2>
      <div className="space-y-3">
        {metrics?.lifetime_energy_kwh && (
          <div className="pb-3">
            <div className="text-xs text-(--muted-foreground) mb-1">Total Cost</div>
            <div className="text-sm font-medium text-(--success)">
              {(metrics.lifetime_energy_kwh * ELECTRICITY_PRICE_PLN).toFixed(2)} PLN
            </div>
          </div>
        )}
        {metrics?.kwh_per_million_input || metrics?.kwh_per_million_output ? (
          <div className="space-y-2">
            {metrics?.kwh_per_million_input && (
              <CostRow label="kWh/M Input" value={metrics.kwh_per_million_input.toFixed(3)} />
            )}
            {metrics?.kwh_per_million_output && (
              <CostRow label="kWh/M Output" value={metrics.kwh_per_million_output.toFixed(3)} />
            )}
            {metrics?.kwh_per_million_input && (
              <CostRow
                label="PLN/M Input"
                value={(metrics.kwh_per_million_input * ELECTRICITY_PRICE_PLN).toFixed(2)}
              />
            )}
            {metrics?.kwh_per_million_output && (
              <CostRow
                label="PLN/M Output"
                value={(metrics.kwh_per_million_output * ELECTRICITY_PRICE_PLN).toFixed(2)}
              />
            )}
          </div>
        ) : null}
        {metrics?.current_power_watts && (
          <div
            className={`${
              metrics?.lifetime_energy_kwh ||
              metrics?.kwh_per_million_input ||
              metrics?.kwh_per_million_output
                ? "pt-3"
                : ""
            }`}
          >
            <div className="text-xs text-(--muted-foreground) mb-1">Current Draw</div>
            <div className="text-sm font-medium text-(--foreground)">
              {Math.round(metrics.current_power_watts)}W
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-xs text-(--muted-foreground)">{label}</span>
      <span
        className={`text-xs font-medium tabular-nums ${
          accent ? "text-(--success)" : "text-(--foreground)"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between text-xs py-1">
      <span className="text-(--muted-foreground)">{label}</span>
      <span className="text-(--foreground) font-medium tabular-nums">{value}</span>
    </div>
  );
}
