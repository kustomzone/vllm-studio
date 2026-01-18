"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import api from "@/lib/api";
import type { UsageStats, PeakMetrics, SortField, SortDirection } from "@/lib/types";
import { formatNumber, formatDuration, formatDate, formatHour } from "@/lib/formatters";
import { getModelColor } from "@/lib/colors";
import { RefreshButton, PageState, SectionHeader, ChangeIndicator } from "@/components/shared";

export default function UsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [peakMetrics, setPeakMetrics] = useState<Map<string, PeakMetrics>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("success");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usageData, peakData] = await Promise.all([api.getUsageStats(), api.getPeakMetrics()]);
      setStats(usageData);

      if (peakData.metrics) {
        const metricsMap = new Map<string, PeakMetrics>();
        for (const m of peakData.metrics) {
          metricsMap.set(m.model_id, m);
        }
        setPeakMetrics(metricsMap);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Group daily data by model
  const dailyByModel = useMemo(() => {
    if (!stats || !stats.daily_by_model || !Array.isArray(stats.daily_by_model)) {
      return new Map<string, Map<string, { date: string; model: string; total_tokens: number }>>();
    }
    const grouped = new Map<string, Map<string, (typeof stats.daily_by_model)[0]>>();
    for (const entry of stats.daily_by_model) {
      if (!grouped.has(entry.model)) {
        grouped.set(entry.model, new Map());
      }
      grouped.get(entry.model)!.set(entry.date, entry);
    }
    return grouped;
  }, [stats]);

  const maxDailyTokens = useMemo(() => {
    if (!stats) return 1;
    const dailyTokens = stats.daily.map((d) => d.total_tokens);
    const maxDaily = Math.max(...dailyTokens, 1);
    const peakTokens = stats.peak_days?.map((d) => d.tokens) || [];
    const maxPeak = Math.max(...peakTokens, 1);
    return Math.max(maxDaily, maxPeak, 1);
  }, [stats]);

  const maxHourlyRequests = useMemo(
    () => (stats ? Math.max(...stats.hourly_pattern.map((h) => h.requests), 1) : 1),
    [stats],
  );

  // Get unique dates for chart (sorted chronologically)
  const chartDates = useMemo(() => {
    if (!stats) return [];
    const dates = [...new Set(stats.daily.map((d) => d.date))];
    return dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }, [stats]);

  // Get models sorted by total tokens for chart ordering
  const modelsForChart = useMemo(() => {
    if (!stats) return [];
    return [...stats.by_model].sort((a, b) => b.total_tokens - a.total_tokens).map((m) => m.model);
  }, [stats]);

  // Sorted models
  const sortedModels = useMemo(() => {
    if (!stats) return [];
    const sorted = [...stats.by_model];
    sorted.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case "model":
          aVal = a.model.toLowerCase();
          bVal = b.model.toLowerCase();
          break;
        case "requests":
          aVal = a.requests;
          bVal = b.requests;
          break;
        case "tokens":
          aVal = a.total_tokens;
          bVal = b.total_tokens;
          break;
        case "success":
          aVal = a.success_rate;
          bVal = b.success_rate;
          break;
        case "latency":
          aVal = a.avg_latency_ms;
          bVal = b.avg_latency_ms;
          break;
        case "ttft":
          aVal = a.avg_ttft_ms;
          bVal = b.avg_ttft_ms;
          break;
        case "speed":
          aVal = a.tokens_per_sec ?? 0;
          bVal = b.tokens_per_sec ?? 0;
          break;
        default:
          return 0;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    return sorted;
  }, [stats, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const toggleRow = (model: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(model)) {
        next.delete(model);
      } else {
        next.add(model);
      }
      return next;
    });
  };

  // Handle loading and error states using shared component
  const pageStateRender = PageState({
    loading,
    data: stats,
    hasData: Boolean(stats),
    error,
    onLoad: loadStats,
  });
  if (pageStateRender) return <div className="min-h-full bg-(--background)">{pageStateRender}</div>;

  if (!stats) return null;

  return (
    <div className="min-h-full bg-(--background) text-(--foreground) overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-(--border)/40">
          <div>
            <h1 className="text-lg font-medium text-(--foreground)">Usage Analytics</h1>
            <p className="text-xs text-(--muted-foreground) mt-1">
              Comprehensive insights into your model usage
            </p>
          </div>
          {RefreshButton({ onRefresh: loadStats, loading, className: "hover:bg-(--card)/50" })}
        </div>

        {/* Overview Metrics */}
        <section className="mb-6 pb-5 border-b border-(--border)/40">
          {SectionHeader("Overview")}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
            <div>
              <div className="text-xs text-(--muted-foreground) mb-1">Total Tokens</div>
              <div className="text-lg font-medium tabular-nums">
                {formatNumber(stats.totals.total_tokens)}
              </div>
            </div>
            <div>
              <div className="text-xs text-(--muted-foreground) mb-1">Requests</div>
              <div className="text-lg font-medium tabular-nums">
                {formatNumber(stats.totals.total_requests)}
              </div>
              <div className="text-[10px] text-(--muted-foreground) mt-0.5">
                {formatNumber(stats.recent_activity.last_24h_requests)} last 24h
              </div>
            </div>
            <div>
              <div className="text-xs text-(--muted-foreground) mb-1">Success Rate</div>
              <div
                className={`text-lg font-medium tabular-nums ${
                  stats.totals.success_rate >= 95
                    ? "text-(--success)"
                    : stats.totals.success_rate >= 90
                      ? "text-(--warning)"
                      : "text-(--error)"
                }`}
              >
                {stats.totals.success_rate.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-(--muted-foreground) mb-1">Sessions</div>
              <div className="text-lg font-medium tabular-nums">
                {formatNumber(stats.totals.unique_sessions)}
              </div>
              <div className="text-[10px] text-(--muted-foreground) mt-0.5">
                {formatNumber(stats.totals.unique_users)} users
              </div>
            </div>
            <div>
              <div className="text-xs text-(--muted-foreground) mb-1">This Week</div>
              <div className="text-lg font-medium tabular-nums">
                {formatNumber(stats.week_over_week.this_week.requests)}
              </div>
              <div className="mt-0.5">
                <ChangeIndicator value={stats.week_over_week.change_pct.requests} />
              </div>
            </div>
            <div>
              <div className="text-xs text-(--muted-foreground) mb-1">Cache Hit Rate</div>
              <div className="text-lg font-medium tabular-nums">
                {stats.cache.hit_rate.toFixed(1)}%
              </div>
              <div className="text-[10px] text-(--muted-foreground) mt-0.5">
                {formatNumber(stats.cache.hits)} hits
              </div>
            </div>
          </div>
        </section>

        {/* Daily Usage Chart by Model */}
        <section className="mb-6 pb-5 border-b border-(--border)/40">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-wider text-(--muted-foreground) font-medium">
              Daily Usage by Model (Last 14 Days)
            </h2>
            {dailyByModel.size > 0 && (
              <div className="text-[10px] text-(--muted-foreground)">
                {modelsForChart.length} models
              </div>
            )}
          </div>
          <div className="flex items-end gap-1 h-80 overflow-x-auto pb-2">
            {chartDates.map((date) => {
              const dateData = stats.daily.find((d) => d.date === date);
              const dateTotalTokens = dateData?.total_tokens || 0;

              return (
                <div key={date} className="flex-1 flex flex-col items-center gap-1 group min-w-0">
                  <div className="w-full relative" style={{ height: "288px" }}>
                    {dailyByModel.size > 0 && dateTotalTokens > 0
                      ? // Stack models vertically using absolute positioning
                        (() => {
                          const modelDataForDate: Array<{
                            model: string;
                            tokens: number;
                            color: string;
                          }> = [];

                          // Collect all models with data for this date
                          for (const model of modelsForChart) {
                            const modelData = dailyByModel.get(model)?.get(date);
                            if (modelData && modelData.total_tokens > 0) {
                              modelDataForDate.push({
                                model,
                                tokens: modelData.total_tokens,
                                color: getModelColor(model),
                              });
                            }
                          }

                          // Sort by tokens descending for stacking order (largest on bottom)
                          modelDataForDate.sort((a, b) => b.tokens - a.tokens);

                          if (modelDataForDate.length === 0) {
                            // No model data, show empty bar
                            return null;
                          }

                          let cumulativeBottom = 0;
                          return modelDataForDate.map((item, idx) => {
                            const height = (item.tokens / maxDailyTokens) * 100;
                            const bottom = cumulativeBottom;
                            cumulativeBottom += height;
                            const isTop = idx === 0;
                            const isBottom = idx === modelDataForDate.length - 1;

                            return (
                              <div
                                key={`${date}-${item.model}`}
                                className="absolute w-full left-0 transition-all group-hover:opacity-90"
                                style={{
                                  height: `${height}%`,
                                  bottom: `${bottom}%`,
                                  backgroundColor: item.color,
                                  minHeight: height > 0.5 ? "2px" : "0",
                                  borderRadius: isTop
                                    ? "2px 2px 0 0"
                                    : isBottom
                                      ? "0 0 2px 2px"
                                      : "0",
                                }}
                                title={`${item.model}: ${formatNumber(item.tokens)} tokens (${((item.tokens / dateTotalTokens) * 100).toFixed(1)}%)`}
                              />
                            );
                          });
                        })()
                      : // Fallback to total daily usage
                        (() => {
                          if (!dateData || dateTotalTokens === 0) return null;

                          const completionHeight =
                            (dateData.completion_tokens / maxDailyTokens) * 100;
                          const promptHeight = (dateData.prompt_tokens / maxDailyTokens) * 100;

                          return (
                            <>
                              {completionHeight > 0 && (
                                <div
                                  className="absolute w-full left-0 bg-(--success)/40 rounded-t transition-all group-hover:bg-(--success)/60"
                                  style={{
                                    height: `${completionHeight}%`,
                                    bottom: `${promptHeight}%`,
                                    minHeight: completionHeight > 0.5 ? "2px" : "0",
                                  }}
                                  title={`Completion: ${formatNumber(dateData.completion_tokens)} tokens`}
                                />
                              )}
                              {promptHeight > 0 && (
                                <div
                                  className="absolute w-full left-0 bg-(--foreground)/20 rounded-b transition-all group-hover:bg-(--foreground)/30"
                                  style={{
                                    height: `${promptHeight}%`,
                                    bottom: "0%",
                                    minHeight: promptHeight > 0.5 ? "2px" : "0",
                                  }}
                                  title={`Prompt: ${formatNumber(dateData.prompt_tokens)} tokens`}
                                />
                              )}
                            </>
                          );
                        })()}
                  </div>
                  <div className="text-[9px] text-(--muted-foreground) truncate w-full text-center mt-1">
                    {formatDate(date)}
                  </div>
                  <div className="text-[8px] text-(--muted-foreground)/60">
                    {dateData?.requests || 0} req
                  </div>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          {dailyByModel.size > 0 && modelsForChart.length > 0 && (
            <div className="mt-4 pt-3 border-t border-(--border)/20">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-(--muted-foreground)">
                {modelsForChart.slice(0, 12).map((model) => {
                  const hasData = chartDates.some((date) => dailyByModel.get(model)?.has(date));
                  if (!hasData) return null;
                  return (
                    <div key={model} className="flex items-center gap-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded shrink-0"
                        style={{
                          backgroundColor: getModelColor(model),
                        }}
                      />
                      <span className="truncate max-w-[140px] text-[11px]" title={model}>
                        {model}
                      </span>
                    </div>
                  );
                })}
                {modelsForChart.length > 12 && (
                  <span className="text-(--muted-foreground)/60 text-[11px]">
                    +{modelsForChart.length - 12} more
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Model Performance Table */}
        <section className="mb-6 pb-5 border-b border-(--border)/40">
          <h2 className="text-xs uppercase tracking-wider text-(--muted-foreground) mb-3 font-medium">
            Model Performance
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-(--muted-foreground) text-xs border-b border-(--border)/40">
                  <th className="text-left py-3 px-3 font-normal w-8"></th>
                  <th
                    className="text-left py-3 px-3 font-normal cursor-pointer hover:text-(--foreground) transition-colors"
                    onClick={() => handleSort("model")}
                  >
                    Model {sortField === "model" && (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="text-right py-3 px-3 font-normal tabular-nums cursor-pointer hover:text-(--foreground) transition-colors"
                    onClick={() => handleSort("requests")}
                  >
                    Requests {sortField === "requests" && (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="text-right py-3 px-3 font-normal tabular-nums cursor-pointer hover:text-(--foreground) transition-colors"
                    onClick={() => handleSort("tokens")}
                  >
                    Tokens {sortField === "tokens" && (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="text-right py-3 px-3 font-normal tabular-nums cursor-pointer hover:text-(--foreground) transition-colors"
                    onClick={() => handleSort("success")}
                  >
                    Success {sortField === "success" && (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="text-right py-3 px-3 font-normal tabular-nums cursor-pointer hover:text-(--foreground) transition-colors"
                    onClick={() => handleSort("latency")}
                  >
                    Latency {sortField === "latency" && (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="text-right py-3 px-3 font-normal tabular-nums cursor-pointer hover:text-(--foreground) transition-colors"
                    onClick={() => handleSort("ttft")}
                  >
                    TTFT {sortField === "ttft" && (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="text-right py-3 px-3 font-normal tabular-nums cursor-pointer hover:text-(--foreground) transition-colors"
                    onClick={() => handleSort("speed")}
                  >
                    Speed {sortField === "speed" && (sortDirection === "asc" ? "↑" : "↓")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedModels.map((model, i) => {
                  const peak = peakMetrics.get(model.model);
                  const isExpanded = expandedRows.has(model.model);
                  const modelColor = getModelColor(model.model);

                  return (
                    <>
                      <tr
                        key={model.model}
                        className={`hover:bg-(--card)/30 transition-colors cursor-pointer ${i > 0 ? "border-t border-(--border)/20" : ""}`}
                        onClick={() => toggleRow(model.model)}
                      >
                        <td className="py-3 px-3">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-(--muted-foreground)" />
                          ) : (
                            <ChevronUp className="h-3.5 w-3.5 text-(--muted-foreground) rotate-[-90deg]" />
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: modelColor }}
                            />
                            <div
                              className="text-(--foreground) font-medium truncate max-w-xs"
                              title={model.model}
                            >
                              {model.model}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums text-(--foreground)">
                          {formatNumber(model.requests)}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums text-(--foreground)">
                          {formatNumber(model.total_tokens)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`tabular-nums ${
                              model.success_rate >= 95
                                ? "text-(--success)"
                                : model.success_rate >= 90
                                  ? "text-(--warning)"
                                  : "text-(--error)"
                            }`}
                          >
                            {model.success_rate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums text-(--foreground)">
                          {formatDuration(model.avg_latency_ms)}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums text-(--foreground)">
                          {formatDuration(model.avg_ttft_ms)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {model.prefill_tps || model.generation_tps ? (
                            <div className="flex flex-col items-end gap-0.5">
                              {model.prefill_tps && (
                                <span className="tabular-nums text-(--foreground) text-xs">
                                  {model.prefill_tps.toFixed(1)} prefill
                                </span>
                              )}
                              {model.generation_tps && (
                                <span className="tabular-nums text-(--foreground) text-xs">
                                  {model.generation_tps.toFixed(1)} gen
                                </span>
                              )}
                            </div>
                          ) : model.tokens_per_sec ? (
                            <span className="tabular-nums text-(--foreground)">
                              {model.tokens_per_sec.toFixed(1)} tok/s
                            </span>
                          ) : peak?.generation_tps || peak?.prefill_tps ? (
                            <div className="flex flex-col items-end gap-0.5">
                              {peak.prefill_tps && (
                                <span className="tabular-nums text-(--muted-foreground) text-xs">
                                  peak {peak.prefill_tps.toFixed(1)} prefill
                                </span>
                              )}
                              {peak.generation_tps && (
                                <span className="tabular-nums text-(--muted-foreground) text-xs">
                                  peak {peak.generation_tps.toFixed(1)} gen
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-(--muted-foreground)">—</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-(--card)/20">
                          <td colSpan={8} className="py-4 px-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <div className="text-xs text-(--muted-foreground) mb-1">
                                  Prompt Tokens
                                </div>
                                <div className="text-(--foreground) tabular-nums">
                                  {formatNumber(model.prompt_tokens)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-(--muted-foreground) mb-1">
                                  Completion Tokens
                                </div>
                                <div className="text-(--foreground) tabular-nums">
                                  {formatNumber(model.completion_tokens)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-(--muted-foreground) mb-1">
                                  Avg Tokens/Req
                                </div>
                                <div className="text-(--foreground) tabular-nums">
                                  {formatNumber(model.avg_tokens)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-(--muted-foreground) mb-1">
                                  P50 Latency
                                </div>
                                <div className="text-(--foreground) tabular-nums">
                                  {formatDuration(model.p50_latency_ms)}
                                </div>
                              </div>
                              {peak && (
                                <>
                                  {peak.prefill_tps && (
                                    <div>
                                      <div className="text-xs text-(--muted-foreground) mb-1">
                                        Peak Prefill
                                      </div>
                                      <div className="text-(--foreground) tabular-nums">
                                        {peak.prefill_tps.toFixed(1)} tok/s
                                      </div>
                                    </div>
                                  )}
                                  {peak.generation_tps && (
                                    <div>
                                      <div className="text-xs text-(--muted-foreground) mb-1">
                                        Peak Generation
                                      </div>
                                      <div className="text-(--foreground) tabular-nums">
                                        {peak.generation_tps.toFixed(1)} tok/s
                                      </div>
                                    </div>
                                  )}
                                  {peak.ttft_ms && (
                                    <div>
                                      <div className="text-xs text-(--muted-foreground) mb-1">
                                        Best TTFT
                                      </div>
                                      <div className="text-(--foreground) tabular-nums">
                                        {Math.round(peak.ttft_ms)}ms
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Performance Details */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6 pb-5 border-b border-(--border)/40">
          <section>
            <h2 className="text-xs uppercase tracking-wider text-(--muted-foreground) mb-3 font-medium">
              Latency
            </h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-(--muted-foreground)">Average</span>
                <span className="text-(--foreground) tabular-nums font-medium">
                  {formatDuration(stats.latency.avg_ms)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-(--muted-foreground)">P50</span>
                <span className="text-(--foreground) tabular-nums font-medium">
                  {formatDuration(stats.latency.p50_ms)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-(--muted-foreground)">P95</span>
                <span className="text-(--foreground) tabular-nums font-medium">
                  {formatDuration(stats.latency.p95_ms)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-(--muted-foreground)">P99</span>
                <span className="text-(--foreground) tabular-nums font-medium">
                  {formatDuration(stats.latency.p99_ms)}
                </span>
              </div>
              <div className="pt-2 mt-2 border-t border-(--border)/20 flex items-center justify-between text-xs text-(--muted-foreground)">
                <span>Min: {formatDuration(stats.latency.min_ms)}</span>
                <span>Max: {formatDuration(stats.latency.max_ms)}</span>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-wider text-(--muted-foreground) mb-3 font-medium">
              Time to First Token
            </h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-(--muted-foreground)">Average</span>
                <span className="text-(--foreground) tabular-nums font-medium">
                  {formatDuration(stats.ttft.avg_ms)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-(--muted-foreground)">P50</span>
                <span className="text-(--foreground) tabular-nums font-medium">
                  {formatDuration(stats.ttft.p50_ms)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-(--muted-foreground)">P95</span>
                <span className="text-(--foreground) tabular-nums font-medium">
                  {formatDuration(stats.ttft.p95_ms)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-(--muted-foreground)">P99</span>
                <span className="text-(--foreground) tabular-nums font-medium">
                  {formatDuration(stats.ttft.p99_ms)}
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* Secondary Metrics */}
        <div className="grid lg:grid-cols-3 gap-6">
          <section>
            <h2 className="text-xs uppercase tracking-wider text-(--muted-foreground) mb-3 font-medium">
              Tokens per Request
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-(--muted-foreground)">Average</span>
                <span className="text-(--foreground) tabular-nums font-medium">
                  {formatNumber(stats.tokens_per_request.avg)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-(--muted-foreground)">Prompt</span>
                <span className="text-(--foreground) tabular-nums">
                  {formatNumber(stats.tokens_per_request.avg_prompt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-(--muted-foreground)">Completion</span>
                <span className="text-(--foreground) tabular-nums">
                  {formatNumber(stats.tokens_per_request.avg_completion)}
                </span>
              </div>
              <div className="pt-2 mt-2 border-t border-(--border)/20 flex items-center justify-between text-xs text-(--muted-foreground)">
                <span>P50: {formatNumber(stats.tokens_per_request.p50)}</span>
                <span>P95: {formatNumber(stats.tokens_per_request.p95)}</span>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-wider text-(--muted-foreground) mb-3 font-medium">
              Cache
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-(--muted-foreground)">Hit Rate</span>
                <span className="text-(--foreground) tabular-nums font-medium">
                  {stats.cache.hit_rate.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-(--muted-foreground)">Hits</span>
                <span className="text-(--foreground) tabular-nums">
                  {formatNumber(stats.cache.hits)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-(--muted-foreground)">Misses</span>
                <span className="text-(--foreground) tabular-nums">
                  {formatNumber(stats.cache.misses)}
                </span>
              </div>
              <div className="pt-2 mt-2 border-t border-(--border)/20">
                <div className="flex items-center justify-between text-xs text-(--muted-foreground)">
                  <span>Cached: {formatNumber(stats.cache.hit_tokens)}</span>
                  <span>Uncached: {formatNumber(stats.cache.miss_tokens)}</span>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-wider text-(--muted-foreground) mb-3 font-medium">
              Hourly Pattern
            </h2>
            <div className="flex items-end gap-0.5 h-32 overflow-x-auto pb-2">
              {Array.from({ length: 24 }, (_, i) => {
                const hourData = stats.hourly_pattern.find((h) => h.hour === i);
                const requests = hourData?.requests || 0;
                const height = (requests / maxHourlyRequests) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group min-w-0">
                    <div
                      className="w-full bg-(--foreground)/20 rounded-t transition-all group-hover:bg-(--foreground)/30"
                      style={{
                        height: `${height}%`,
                        minHeight: height > 0 ? "1px" : "0",
                      }}
                      title={`${formatHour(i)}: ${requests} requests`}
                    />
                    <div className="text-[7px] text-(--muted-foreground)/60 truncate w-full text-center">
                      {i % 6 === 0 ? formatHour(i) : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
