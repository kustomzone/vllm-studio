// CRITICAL
"use client";

import type { GPU, Metrics, ProcessInfo } from "@/lib/types";
import { toGB, toGBFromMB } from "@/lib/formatters";
import { SectionCard } from "./status-section";

interface GpuSectionProps {
  metrics: Metrics | null;
  gpus: GPU[];
  currentProcess: ProcessInfo | null;
  logs?: string[];
}

export function GpuSection({ metrics, gpus }: GpuSectionProps) {
  const totalUtil = gpus.reduce((s, g) => s + (g.utilization_pct ?? g.utilization ?? 0), 0) / gpus.length;
  const totalPower = gpus.reduce((s, g) => s + (g.power_draw || 0), 0);
  const totalMemUsed = gpus.reduce((sum, g) => {
    if (g.memory_used_mb != null) return sum + toGBFromMB(g.memory_used_mb);
    return sum + toGB(g.memory_used ?? 0);
  }, 0);
  const totalMemMax = gpus.reduce((sum, g) => {
    if (g.memory_total_mb != null) return sum + toGBFromMB(g.memory_total_mb);
    return sum + toGB(g.memory_total ?? 0);
  }, 0);
  const memPct = totalMemMax > 0 ? (totalMemUsed / totalMemMax) * 100 : 0;
  const kvCache = metrics?.kv_cache_usage ? Math.round(metrics.kv_cache_usage * 100) : 0;
  const genTps = firstPositive(metrics?.session_avg_generation, metrics?.generation_throughput);
  const prefillTps = firstPositive(metrics?.session_avg_prefill, metrics?.prompt_throughput);

  return (
    <SectionCard label="GPU" icon="cpu">
      {/* Charts row: utilization bars + memory donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Utilization bars */}
        <div className="lg:col-span-2">
          <div className="text-[11px] uppercase tracking-[0.1em] font-medium text-(--dim) mb-3">Utilization</div>
          <div className="space-y-2">
            {gpus.map((gpu) => {
              const util = gpu.utilization_pct ?? gpu.utilization ?? 0;
              return (
                <div key={gpu.id ?? gpu.index} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-(--fg) w-32 truncate" title={gpu.name}>
                    {gpu.name}
                  </span>
                  <div className="flex-1 h-5 bg-(--bg) rounded overflow-hidden">
                    <div
                      className={`h-full rounded transition-all duration-500 ${utilColor(util)}`}
                      style={{ width: `${Math.max(util, 1)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono tabular-nums text-(--fg) w-10 text-right">{util}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Memory donut */}
        <div className="flex flex-col items-center justify-center">
          <svg viewBox="0 0 120 120" className="w-32 h-32">
            {/* Background ring */}
            <circle cx="60" cy="60" r="48" fill="none" stroke="var(--bg)" strokeWidth="10" />
            {/* Used arc */}
            <circle
              cx="60" cy="60" r="48" fill="none"
              stroke="var(--fg)" strokeWidth="10"
              strokeDasharray={`${memPct * 3.01} ${301 - memPct * 3.01}`}
              strokeDashoffset="75.3"
              strokeLinecap="round"
              style={{ opacity: 0.5 }}
              className="transition-all duration-700"
            />
            {/* Center text */}
            <text x="60" y="54" textAnchor="middle" className="fill-(--fg) text-lg font-mono" fontSize="18">
              {memPct.toFixed(0)}%
            </text>
            <text x="60" y="72" textAnchor="middle" className="fill-(--dim) text-[10px]" fontSize="10">
              VRAM
            </text>
          </svg>
          <span className="text-xs font-mono text-(--dim) mt-1">
            {totalMemUsed.toFixed(1)} / {totalMemMax.toFixed(0)} GB
          </span>
        </div>
      </div>

      {/* Throughput sparkline area */}
      {(genTps > 0 || prefillTps > 0) && (
        <div className="mb-5">
          <div className="text-[11px] uppercase tracking-[0.1em] font-medium text-(--dim) mb-3">Throughput</div>
          <div className="flex flex-wrap gap-4">
            {genTps > 0 && (
              <MetricGauge label="Generation" value={genTps} unit="tok/s" peak={firstPositive(metrics?.session_peak_generation, metrics?.peak_generation_tps)} highlight />
            )}
            {prefillTps > 0 && (
              <MetricGauge label="Prefill" value={prefillTps} unit="tok/s" peak={firstPositive(metrics?.session_peak_prefill, metrics?.peak_prefill_tps)} />
            )}
            {kvCache > 0 && (
              <MetricGauge label="KV Cache" value={kvCache} unit="%" peak={100} />
            )}
          </div>
        </div>
      )}

      {/* GPU detail table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left py-2 pr-3 text-[10px] uppercase tracking-wider text-(--dim) font-medium">GPU</th>
              <th className="text-left py-2 pr-3 text-[10px] uppercase tracking-wider text-(--dim) font-medium">Util</th>
              <th className="text-left py-2 pr-3 text-[10px] uppercase tracking-wider text-(--dim) font-medium">VRAM</th>
              <th className="text-left py-2 pr-3 text-[10px] uppercase tracking-wider text-(--dim) font-medium">Temp</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-(--dim) font-medium">Power</th>
            </tr>
          </thead>
          <tbody>
            {gpus.map((gpu) => (
              <GpuRow key={gpu.id ?? gpu.index} gpu={gpu} />
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function GpuRow({ gpu }: { gpu: GPU }) {
  const memUsed = gpu.memory_used_mb != null ? toGBFromMB(gpu.memory_used_mb) : toGB(gpu.memory_used);
  const memTotal = gpu.memory_total_mb != null ? toGBFromMB(gpu.memory_total_mb) : toGB(gpu.memory_total);
  const temp = gpu.temp_c ?? gpu.temperature ?? 0;
  const util = gpu.utilization_pct ?? gpu.utilization ?? 0;
  const power = gpu.power_draw || 0;
  const tempColor = temp > 80 ? "text-(--fg)" : temp > 65 ? "text-(--dim)" : "text-(--dim)";

  return (
    <tr>
      <td className="py-2 pr-3 font-mono text-(--fg)" title={gpu.name}>
        {gpu.name.length > 24 ? `…${gpu.name.slice(-22)}` : gpu.name}
      </td>
      <td className="py-2 pr-3 font-mono text-(--fg) tabular-nums">{util}%</td>
      <td className="py-2 pr-3 font-mono text-(--dim) tabular-nums">{memUsed.toFixed(1)}/{memTotal.toFixed(0)}G</td>
      <td className={`py-2 pr-3 font-mono tabular-nums ${tempColor}`}>{temp > 0 ? `${temp}°` : "—"}</td>
      <td className="py-2 text-right font-mono text-(--dim) tabular-nums">{power > 0 ? `${Math.round(power)}W` : "—"}</td>
    </tr>
  );
}

function MetricGauge({ label, value, unit, peak, highlight }: {
  label: string; value: number; unit: string; peak?: number; highlight?: boolean;
}) {
  const pct = peak && peak > 0 ? Math.min((value / peak) * 100, 100) : 0;
  return (
    <div className="flex-1 min-w-[140px]">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] text-(--dim)">{label}</span>
        <span className="text-xs font-mono tabular-nums text-(--dim)">{peak ? `peak ${peak.toFixed(1)}` : ""}</span>
      </div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className={`text-xl font-mono tabular-nums ${highlight ? "text-(--fg)" : "text-(--fg)"}`}>
          {value.toFixed(1)}
        </span>
        <span className="text-[10px] text-(--dim)">{unit}</span>
      </div>
      {/* Progress bar toward peak */}
      {peak && peak > 0 && (
        <div className="h-1 bg-(--bg) rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${highlight ? "bg-(--fg)/50" : "bg-(--fg)/30"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function utilColor(pct: number): string {
  if (pct >= 90) return "bg-(--fg)/80";
  if (pct >= 70) return "bg-(--fg)/60";
  if (pct >= 40) return "bg-(--fg)/40";
  return "bg-(--fg)/20";
}

function firstPositive(...values: Array<number | null | undefined>): number {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  }
  return 0;
}
