// CRITICAL
"use client";

import type { UsageStats } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";
import { ChangeIndicator } from "@/components/shared";
import { Hash, Activity, TrendingUp, Users, Clock, Database } from "lucide-react";

function MetricCard({
  icon: Icon,
  label,
  value,
  subvalue,
  subvalueNode,
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subvalue?: string;
  subvalueNode?: React.ReactNode;
  trend?: React.ReactNode;
}) {
  return (
    <div className="border border-(--border) bg-(--surface) p-3">
      <div className="flex items-start justify-between border-b border-(--border) pb-2">
        <div className="flex items-center gap-2 text-(--dim)">
          <Icon className="h-3.5 w-3.5" />
          <span className="font-mono text-[9px] uppercase tracking-[0.18em]">{label}</span>
        </div>
        {trend && <div className="flex items-center">{trend}</div>}
      </div>
      <div className="mt-2">
        <div className="font-mono text-lg tabular-nums tracking-tight">{value}</div>
        {(subvalue || subvalueNode) && (
          <div className="mt-1.5 font-mono text-[10px] text-(--dim)">
            {subvalueNode || subvalue}
          </div>
        )}
      </div>
    </div>
  );
}

export function OverviewMetrics(stats: UsageStats) {
  const totals = stats.totals ?? ({} as UsageStats["totals"]);
  const recent = stats.recent_activity ?? ({} as UsageStats["recent_activity"]);
  const wow = stats.week_over_week ?? ({} as UsageStats["week_over_week"]);
  const cache = stats.cache ?? ({} as UsageStats["cache"]);
  const successRate = Number(totals.success_rate ?? 0);
  const cacheRate = Number(cache.hit_rate ?? 0);

  return (
    <section className="mb-6 sm:mb-8">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          icon={Hash}
          label="Total Tokens"
          value={formatNumber(totals.total_tokens ?? 0)}
          subvalue={`${formatNumber(totals.prompt_tokens ?? 0)} prompt · ${formatNumber(totals.completion_tokens ?? 0)} completion`}
        />
        <MetricCard
          icon={Activity}
          label="Total Requests"
          value={formatNumber(totals.total_requests ?? 0)}
          subvalueNode={
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 bg-(--hl2)" />
              {formatNumber(recent.last_24h_requests ?? 0)} last 24h
            </span>
          }
        />
        <MetricCard
          icon={TrendingUp}
          label="Success Rate"
          value={`${successRate.toFixed(1)}%`}
          subvalue={
            successRate >= 95 ? "Excellent" : successRate >= 90 ? "Good" : "Needs Attention"
          }
        />
        <MetricCard
          icon={Users}
          label="Active Sessions"
          value={formatNumber(totals.unique_sessions ?? 0)}
          subvalue={`${formatNumber(totals.unique_users ?? 0)} unique users`}
        />
        <MetricCard
          icon={Clock}
          label="This Week"
          value={formatNumber(wow.this_week?.requests ?? 0)}
          trend={<ChangeIndicator value={wow.change_pct?.requests ?? null} />}
        />
        <MetricCard
          icon={Database}
          label="Cache Hit Rate"
          value={`${cacheRate.toFixed(1)}%`}
          subvalue={`${formatNumber(cache.hits ?? 0)} hits · ${formatNumber(cache.misses ?? 0)} misses`}
        />
      </div>
    </section>
  );
}
