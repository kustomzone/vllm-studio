// CRITICAL
"use client";

import { toGB, toGBFromMB } from "@/lib/formatters";
import type { GPU } from "@/lib/types";

interface GpuListProps {
  gpus: GPU[];
}

export function GpuList({ gpus }: GpuListProps) {
  if (gpus.length === 0) {
    return (
      <div>
        <SectionLabel label="GPU" right="no data" />
        <p className="text-xs text-(--dim)/30 mt-3">No GPU detected</p>
      </div>
    );
  }

  const totalUtil = gpus.reduce((s, g) => s + (g.utilization_pct ?? g.utilization ?? 0), 0) / gpus.length;
  const totalPower = gpus.reduce((s, g) => s + (g.power_draw || 0), 0);

  return (
    <div>
      <SectionLabel
        label="GPU"
        right={`${gpus.length} units · avg ${totalUtil.toFixed(0)}% · ${Math.round(totalPower)}W`}
      />

      {/* Mini utilization columns — compact heatmap strip */}
      <div className="flex gap-1 mb-4 mt-3">
        {gpus.map((gpu) => {
          const util = gpu.utilization_pct ?? gpu.utilization ?? 0;
          const temp = gpu.temp_c ?? gpu.temperature ?? 0;
          const hotColor = temp > 80 ? "#ef4444" : temp > 65 ? "#f59e0b" : null;
          return (
            <div key={gpu.id ?? gpu.index} className="flex-1 flex flex-col items-center gap-1">
              {/* Mini bar */}
              <div className="w-full h-10 bg-(--fg)/[0.04] relative overflow-hidden">
                <div
                  className="absolute bottom-0 left-0 right-0 transition-all duration-700"
                  style={{
                    height: `${Math.max(2, util)}%`,
                    background: hotColor ?? `color-mix(in srgb, var(--fg) ${30 + util * 0.5}%, transparent)`,
                  }}
                />
              </div>
              <span className="text-[8px] font-mono text-(--dim)/40">{gpu.id ?? gpu.index}</span>
            </div>
          );
        })}
      </div>

      {/* Detail rows */}
      <div>
        {/* Header */}
        <div className="grid grid-cols-[3rem_1fr_5rem_3rem_3rem] gap-3 mb-1 px-0">
          <ColHead>unit</ColHead>
          <ColHead>util</ColHead>
          <ColHead>vram</ColHead>
          <ColHead>temp</ColHead>
          <ColHead right>pwr</ColHead>
        </div>

        <div className="space-y-0">
          {gpus.map((gpu) => (
            <GpuRow key={gpu.id ?? gpu.index} gpu={gpu} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ label, right }: { label: string; right?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] uppercase tracking-[0.16em] text-(--dim)/50 font-mono">{label}</span>
      <div className="flex-1 h-px bg-(--border)/20" />
      {right && <span className="text-[10px] font-mono text-(--dim)/30">{right}</span>}
    </div>
  );
}

function ColHead({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <div className={`text-[9px] uppercase tracking-wider text-(--dim)/30 font-mono ${right ? "text-right" : ""}`}>
      {children}
    </div>
  );
}

function GpuRow({ gpu }: { gpu: GPU }) {
  const memUsed =
    gpu.memory_used_mb !== undefined && gpu.memory_used_mb !== null
      ? toGBFromMB(gpu.memory_used_mb)
      : toGB(gpu.memory_used);
  const memTotal =
    gpu.memory_total_mb !== undefined && gpu.memory_total_mb !== null
      ? toGBFromMB(gpu.memory_total_mb)
      : toGB(gpu.memory_total);
  const memPct = memTotal > 0 ? Math.min((memUsed / memTotal) * 100, 100) : 0;
  const temp = gpu.temp_c ?? gpu.temperature ?? 0;
  const util = gpu.utilization_pct ?? gpu.utilization ?? 0;
  const power = gpu.power_draw || 0;

  const tempColor =
    temp > 80 ? "text-(--err)" : temp > 65 ? "text-(--hl3)" : "text-(--dim)/50";

  return (
    <div className="grid grid-cols-[3rem_1fr_5rem_3rem_3rem] gap-3 py-1.5 items-center border-t border-(--border)/[0.06] first:border-t-0">
      {/* Unit */}
      <span className="text-[10px] font-mono text-(--dim)/60">_{gpu.id ?? gpu.index}</span>

      {/* Utilization */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-[3px] bg-(--fg)/[0.06] relative">
          <div
            className="absolute inset-y-0 left-0 bg-(--fg)/40 transition-all duration-500"
            style={{ width: `${util}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-(--dim)/50 w-6 text-right tabular-nums">{util}%</span>
      </div>

      {/* VRAM */}
      <div className="flex items-center gap-1.5">
        <div className="w-8 h-[3px] bg-(--fg)/[0.06] relative shrink-0">
          <div
            className="absolute inset-y-0 left-0 bg-(--fg)/25 transition-all duration-500"
            style={{ width: `${memPct}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-(--dim)/50 tabular-nums">
          {memUsed.toFixed(0)}G
        </span>
      </div>

      {/* Temp */}
      <span className={`text-[10px] font-mono ${tempColor} tabular-nums`}>
        {temp > 0 ? `${temp}°` : "--"}
      </span>

      {/* Power */}
      <span className="text-[10px] font-mono text-(--dim)/40 text-right tabular-nums">
        {power > 0 ? `${Math.round(power)}w` : "--"}
      </span>
    </div>
  );
}
