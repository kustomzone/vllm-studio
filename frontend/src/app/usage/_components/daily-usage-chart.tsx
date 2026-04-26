// CRITICAL
"use client";

import { formatNumber, formatDate } from "@/lib/formatters";
import { getModelColor } from "@/lib/colors";
import { BarChart3, Calendar } from "lucide-react";

interface DailyStat {
  date: string;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  requests: number;
}

interface DailyUsageProps {
  stats: {
    daily: DailyStat[];
    peak_days?: Array<{ tokens: number }>;
  };
  dailyByModel: Map<string, Map<string, { total_tokens: number }>>;
  modelsForChart: string[];
}

interface ModelDataItem {
  model: string;
  tokens: number;
  color: string;
}

export function DailyUsageChart(
  stats: DailyUsageProps["stats"],
  dailyByModel: Map<string, Map<string, { total_tokens: number }>>,
  modelsForChart: string[],
) {
  const chartDates = [...new Set(stats.daily.map((d: DailyStat) => d.date))].sort(
    (a: string, b: string) => new Date(a).getTime() - new Date(b).getTime(),
  );
  const dailyTokens = stats.daily.map((d: DailyStat) => d.total_tokens);
  const maxDailyTokens = Math.max(...dailyTokens, 1);
  const peakTokens = stats.peak_days?.map((d: { tokens: number }) => d.tokens) || [];
  const maxPeakTokens = Math.max(...peakTokens, 1);
  const maxDailyTokensFinal = Math.max(maxDailyTokens, maxPeakTokens, 1);

  const totalTokensInPeriod = stats.daily.reduce((sum, d) => sum + d.total_tokens, 0);
  const totalRequestsInPeriod = stats.daily.reduce((sum, d) => sum + d.requests, 0);
  const avgDailyTokens = Math.round(totalTokensInPeriod / (chartDates.length || 1));

  return (
    <section className="mb-6 sm:mb-8">
      <div className="border border-(--border) bg-(--surface) overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-(--border) bg-(--bg)/55 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2 text-(--dim)">
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em]">Daily Usage</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-(--dim)">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              <span>{chartDates.length} days</span>
            </div>
            <span className="hidden sm:inline">
              <span className="text-(--fg) tabular-nums">{formatNumber(avgDailyTokens)}</span>{" "}
              avg/day
            </span>
          </div>
        </div>

        {/* Chart Area */}
        <div className="p-4 sm:p-5">
          <div className="flex h-44 items-end gap-1 overflow-x-auto border border-(--border) bg-(--bg) p-3 pb-2 sm:h-52 sm:gap-1.5">
            {chartDates.map((date: string) => {
              const dateData = stats.daily.find((d: DailyStat) => d.date === date);
              const dateTotalTokens = dateData?.total_tokens || 0;

              return (
                <div
                  key={date}
                  className="group flex min-w-[24px] flex-1 flex-col items-center gap-1.5"
                >
                  <div className="w-full relative" style={{ height: "140px" }}>
                    {dailyByModel.size > 0 && dateTotalTokens > 0
                      ? (() => {
                          const modelDataForDate: Array<{
                            model: string;
                            tokens: number;
                            color: string;
                          }> = [];

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

                          modelDataForDate.sort(
                            (a: ModelDataItem, b: ModelDataItem) => b.tokens - a.tokens,
                          );

                          if (modelDataForDate.length === 0) {
                            return null;
                          }

                          let cumulativeBottom = 0;
                          return modelDataForDate.map((item: ModelDataItem, idx: number) => {
                            const height = (item.tokens / maxDailyTokensFinal) * 100;
                            const bottom = cumulativeBottom;
                            cumulativeBottom += height;

                            return (
                              <div
                                key={`${date}-${item.model}`}
                                className="absolute left-0 w-full transition-opacity group-hover:opacity-80"
                                style={{
                                  height: `${height}%`,
                                  bottom: `${bottom}%`,
                                  backgroundColor: item.color,
                                  minHeight: height > 0.5 ? "2px" : "0",
                                }}
                                title={`${item.model}: ${formatNumber(item.tokens)} tokens (${((item.tokens / dateTotalTokens) * 100).toFixed(1)}%)`}
                              />
                            );
                          });
                        })()
                      : (() => {
                          if (!dateData || dateTotalTokens === 0) return null;

                          const completionHeight =
                            (dateData.completion_tokens / maxDailyTokensFinal) * 100;
                          const promptHeight = (dateData.prompt_tokens / maxDailyTokensFinal) * 100;

                          return (
                            <>
                              {completionHeight > 0 && (
                                <div
                                  className="absolute left-0 w-full bg-(--hl2)/60"
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
                                  className="absolute left-0 w-full bg-(--fg)/20"
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

                  {/* Date label */}
                  <div className="w-full truncate text-center font-mono text-[10px] text-(--dim)">
                    {formatDate(date)}
                  </div>

                  {/* Requests count */}
                  <div className="font-mono text-[9px] tabular-nums text-(--dim)/60">
                    {dateData?.requests || 0} req
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          {dailyByModel.size > 0 && modelsForChart.length > 0 && (
            <div className="mt-4 border-t border-(--border) pt-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {modelsForChart.slice(0, 8).map((model: string) => {
                  const hasData = chartDates.some((date: string) =>
                    dailyByModel.get(model)?.has(date),
                  );
                  if (!hasData) return null;
                  return (
                    <div key={model} className="flex items-center gap-1.5">
                      <div
                        className="h-2 w-2 shrink-0"
                        style={{
                          backgroundColor: getModelColor(model),
                        }}
                      />
                      <span
                        className="max-w-[100px] truncate font-mono text-[11px] text-(--dim)"
                        title={model}
                      >
                        {model.split("/").pop()}
                      </span>
                    </div>
                  );
                })}
                {modelsForChart.length > 8 && (
                  <span className="text-(--dim)/60 text-[11px]">
                    +{modelsForChart.length - 8} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Summary Stats */}
          <div className="mt-4 grid grid-cols-3 border border-(--border)">
            <div className="px-3 py-2.5 text-center">
              <p className="font-mono text-[10px] uppercase tracking-wider text-(--dim)">
                Total Tokens
              </p>
              <p className="font-mono text-sm tabular-nums">{formatNumber(totalTokensInPeriod)}</p>
            </div>
            <div className="border-x border-(--border) px-3 py-2.5 text-center">
              <p className="font-mono text-[10px] uppercase tracking-wider text-(--dim)">
                Total Requests
              </p>
              <p className="font-mono text-sm tabular-nums">
                {formatNumber(totalRequestsInPeriod)}
              </p>
            </div>
            <div className="px-3 py-2.5 text-center">
              <p className="font-mono text-[10px] uppercase tracking-wider text-(--dim)">
                Peak Day
              </p>
              <p className="font-mono text-sm tabular-nums">{formatNumber(maxDailyTokens)}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
