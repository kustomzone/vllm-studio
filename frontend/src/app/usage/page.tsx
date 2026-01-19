"use client";

import { RefreshButton, PageState } from "@/components/shared";
import { DailyUsageChart } from "./_components/DailyUsageChart";
import { ModelPerformanceTable } from "./_components/ModelPerformanceTable";
import { PerformanceDetails } from "./_components/PerformanceDetails";
import { SecondaryMetrics } from "./_components/SecondaryMetrics";
import { OverviewMetrics } from "./_components/OverviewMetrics";
import { useUsage } from "./hooks/useUsage";

export default function UsagePage() {
  const {
    stats,
    peakMetrics,
    loading,
    error,
    expandedRows,
    sortField,
    sortDirection,
    loadStats,
    dailyByModel,
    modelsForChart,
    sortedModels,
    handleSort,
    toggleRow,
  } = useUsage();

  const pageStateRender = PageState({
    loading,
    data: stats,
    hasData: Boolean(stats),
    error,
    onLoad: loadStats,
  });
  if (pageStateRender) return <div className="min-h-full bg-[var(--background)]">{pageStateRender}</div>;

  if (!stats) return null;

  return (
    <div className="min-h-full bg-[var(--background)] text-[var(--foreground)] overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border)]/40">
          <div>
            <h1 className="text-lg font-medium text-[var(--foreground)]">Usage Analytics</h1>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Comprehensive insights into your model usage
            </p>
          </div>
          {RefreshButton({ onRefresh: loadStats, loading, className: "hover:bg-[var(--card)]/50" })}
        </div>

        {/* Overview Metrics */}
        {OverviewMetrics(stats)}

        {/* Daily Usage Chart by Model */}
        {DailyUsageChart(stats, dailyByModel, modelsForChart)}

        {/* Model Performance Table */}
        {ModelPerformanceTable(
          sortedModels,
          peakMetrics,
          expandedRows,
          sortField,
          sortDirection,
          handleSort,
          toggleRow,
        )}

        {/* Performance Details */}
        {PerformanceDetails(stats)}

        {/* Secondary Metrics */}
        {SecondaryMetrics(stats)}
      </div>
    </div>
  );
}
