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
      {/* Summary row */}
      <div className="flex flex-wrap gap-4 mb-5">
        <SummaryStat label="Units" value={`${gpus.length}`} />
        <SummaryStat label="Avg Util" value={`${totalUtil.toFixed(0)}%`} />
        <SummaryStat label="VRAM" value={`${totalMemUsed.toFixed(1)} / ${totalMemMax.toFixed(0)} GB`} />
        <SummaryStat label="Power" value={`${Math.round(totalPower)}W`} />
        {genTps > 0 && <SummaryStat label="Gen" value={`${genTps.toFixed(1)} tok/s`} highlight />}
        {prefillTps > 0 && <SummaryStat label="Prefill" value={`${prefillTps.toFixed(1)} tok/s`} />}
        {kvCache > 0 && <SummaryStat label="KV Cache" value={`${kvCache}%`} />}
      </div>

      {/* Memory bar */}
      {memPct > 0 && (
        <div className="mb-5">
          <div className="flex justify-between text-[10px] text-(--dim)/50 mb-1">
            <span>Memory</span>
            <span>{memPct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-(--border)/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-(--hl2) rounded-full transition-all duration-700"
              style={{ width: `${memPct}%` }}
            />
          </div>
        </div>
      )}

      {/* GPU table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-(--border)/20">
              <th className="text-left py-2 pr-3 text-[10px] uppercase tracking-wider text-(--dim)/40 font-medium">Unit</th>
              <th className="text-left py-2 pr-3 text-[10px] uppercase tracking-wider text-(--dim)/40 font-medium">Util</th>
              <th className="text-left py-2 pr-3 text-[10px] uppercase tracking-wider text-(--dim)/40 font-medium">VRAM</th>
              <th className="text-left py-2 pr-3 text-[10px] uppercase tracking-wider text-(--dim)/40 font-medium">Temp</th>
              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-(--dim)/40 font-medium">Power</th>
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
  const memPct = memTotal > 0 ? Math.min((memUsed / memTotal) * 100, 100) : 0;
  const temp = gpu.temp_c ?? gpu.temperature ?? 0;
  const util = gpu.utilization_pct ?? gpu.utilization ?? 0;
  const power = gpu.power_draw || 0;

  const tempColor = temp > 80 ? "text-(--err)" : temp > 65 ? "text-(--hl3)" : "text-(--dim)/50";

  return (
    <tr className="border-b border-(--border)/10 last:border-0">
      <td className="py-2 pr-3 font-mono text-(--dim)/60">#{gpu.id ?? gpu.index}</td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-2">
          <div className="w-16 h-1 bg-(--border)/15 rounded-full overflow-hidden">
            <div className="h-full bg-(--fg)/30 rounded-full transition-all" style={{ width: `${util}%` }} />
          </div>
          <span className="font-mono text-(--dim)/50 tabular-nums">{util}%</span>
        </div>
      </td>
      <td className="py-2 pr-3 font-mono text-(--dim)/50 tabular-nums">{memUsed.toFixed(1)}/{memTotal.toFixed(0)}G</td>
      <td className={`py-2 pr-3 font-mono tabular-nums ${tempColor}`}>{temp > 0 ? `${temp}°` : "—"}</td>
      <td className="py-2 text-right font-mono text-(--dim)/40 tabular-nums">{power > 0 ? `${Math.round(power)}W` : "—"}</td>
    </tr>
  );
}

function SummaryStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] text-(--dim)/40">{label}</span>
      <span className={`text-sm font-mono tabular-nums ${highlight ? "text-(--hl2)" : "text-(--fg)"}`}>{value}</span>
    </div>
  );
}

function firstPositive(...values: Array<number | null | undefined>): number {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  }
  return 0;
}
