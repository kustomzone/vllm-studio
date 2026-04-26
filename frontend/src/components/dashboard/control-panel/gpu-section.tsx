// CRITICAL
"use client";

import type { GPU, Metrics, ProcessInfo } from "@/lib/types";
import { toGB, toGBFromMB } from "@/lib/formatters";

interface GpuSectionProps {
  metrics: Metrics | null;
  gpus: GPU[];
  currentProcess: ProcessInfo | null;
  logs?: string[];
}

export function GpuSection({ gpus }: GpuSectionProps) {
  const sortedGpus = [...gpus].sort((a, b) => gpuMemoryTotal(b) - gpuMemoryTotal(a));
  const totalUsed = sortedGpus.reduce((s, g) => s + gpuMemoryUsed(g), 0);
  const totalCap = sortedGpus.reduce((s, g) => s + gpuMemoryTotal(g), 0);

  return (
    <div className="border border-(--border) bg-(--surface)">
      <div className="flex items-center justify-between border-b border-(--border) px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-(--dim)">
          GPU · {sortedGpus.length}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-(--dim)">
          {totalUsed.toFixed(1)} / {totalCap.toFixed(0)} G
        </span>
      </div>

      {/* VRAM column strip — flat, no nested card */}
      <div
        className="grid gap-2 overflow-x-auto px-3 py-2"
        style={{ gridTemplateColumns: `repeat(${sortedGpus.length}, minmax(3.5rem, 1fr))` }}
      >
        {sortedGpus.map((gpu) => {
          const used = gpuMemoryUsed(gpu);
          const total = gpuMemoryTotal(gpu);
          const cells = 14;
          const active = Math.min(
            cells,
            Math.max(0, Math.round((total > 0 ? used / total : 0) * cells)),
          );
          const label = gpu.id ?? gpu.index ?? "gpu";
          return (
            <div
              key={gpu.id ?? gpu.index}
              className="min-w-0 max-w-[5.5rem] overflow-hidden"
              title={gpu.name}
            >
              <div className="mb-1 flex items-center justify-between gap-1 font-mono text-[9px] text-(--dim)">
                <span className="truncate">G{label}</span>
                <span className="tabular-nums">{total.toFixed(0)}G</span>
              </div>
              <div
                className="grid gap-px"
                style={{ gridTemplateRows: `repeat(${cells}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: cells }, (_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 ${i >= cells - active ? "bg-(--fg)/55" : "bg-(--dim)/15"}`}
                  />
                ))}
              </div>
              <div className="mt-1 truncate font-mono text-[9px] tabular-nums text-(--dim)">
                {used.toFixed(1)}G
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail table — flat, no extra borders */}
      <div className="overflow-x-auto border-t border-(--border)">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-(--border)">
              {["GPU", "Util", "VRAM", "Temp", "Power"].map((h, i) => (
                <th
                  key={h}
                  className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-(--dim) ${
                    i === 4 ? "text-right" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedGpus.map((gpu) => (
              <GpuRow key={gpu.id ?? gpu.index} gpu={gpu} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GpuRow({ gpu }: { gpu: GPU }) {
  const memUsed = gpuMemoryUsed(gpu);
  const memTotal = gpuMemoryTotal(gpu);
  const temp = gpu.temp_c ?? gpu.temperature ?? 0;
  const util = gpu.utilization_pct ?? gpu.utilization ?? 0;
  const power = gpu.power_draw || 0;

  return (
    <tr className="border-b border-(--border)/40 last:border-b-0">
      <td className="max-w-[10rem] px-3 py-1.5 font-mono text-(--fg)" title={gpu.name}>
        <span className="block truncate">{gpu.name}</span>
      </td>
      <td className="px-3 py-1.5 font-mono tabular-nums text-(--fg)">{util}%</td>
      <td className="px-3 py-1.5 font-mono tabular-nums text-(--dim)">
        {memUsed.toFixed(1)}/{memTotal.toFixed(0)}G
      </td>
      <td className="px-3 py-1.5 font-mono tabular-nums text-(--dim)">
        {temp > 0 ? `${temp}°` : "—"}
      </td>
      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-(--dim)">
        {power > 0 ? `${Math.round(power)}W` : "—"}
      </td>
    </tr>
  );
}

function gpuMemoryUsed(gpu: GPU): number {
  if (gpu.memory_used_mb != null) return toGBFromMB(gpu.memory_used_mb);
  return toGB(gpu.memory_used ?? 0);
}

function gpuMemoryTotal(gpu: GPU): number {
  if (gpu.memory_total_mb != null) return toGBFromMB(gpu.memory_total_mb);
  return toGB(gpu.memory_total ?? 0);
}
