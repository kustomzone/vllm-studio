// CRITICAL
"use client";

import { useEffect, useRef, useState } from "react";
import type { GPU, Metrics, ProcessInfo, RecipeWithStatus, RuntimePlatformKind } from "@/lib/types";
import { toGB, toGBFromMB } from "@/lib/formatters";

interface StatusSectionProps {
  currentProcess: ProcessInfo | null;
  currentRecipe: RecipeWithStatus | null;
  metrics: Metrics | null;
  gpus: GPU[];
  isConnected: boolean;
  platformKind?: RuntimePlatformKind | null;
  inferencePort?: number;
  onNavigateChat: () => void;
  onNavigateLogs: () => void;
  onBenchmark: () => void;
  benchmarking: boolean;
  onStop: () => void;
  recipes?: RecipeWithStatus[];
  launching?: boolean;
  onLaunch?: (recipeId: string) => Promise<void>;
  onNewRecipe?: () => void;
  onViewAll?: () => void;
}

export function StatusSection({
  currentProcess,
  currentRecipe,
  metrics,
  gpus,
  isConnected,
  platformKind,
  inferencePort,
  onNavigateChat,
  onNavigateLogs,
  onBenchmark,
  benchmarking,
  onStop,
  recipes,
  launching,
  onLaunch,
  onNewRecipe,
  onViewAll,
}: StatusSectionProps) {
  const modelName = currentRecipe?.name || currentProcess?.model_path?.split("/").pop();
  const isRunning = !!currentProcess;
  const backend = currentProcess?.backend;

  const fallbackTotalPower = gpus.reduce((sum, g) => sum + (g.power_draw || 0), 0);
  const fallbackTotalMemUsed = gpus.reduce((sum, g) => {
    if (g.memory_used_mb != null) return sum + toGBFromMB(g.memory_used_mb);
    return sum + toGB(g.memory_used ?? 0);
  }, 0);
  const fallbackMemCapacity = gpus.reduce((sum, g) => {
    if (g.memory_total_mb != null) return sum + toGBFromMB(g.memory_total_mb);
    return sum + toGB(g.memory_total ?? 0);
  }, 0);
  const fallbackPowerLimit = gpus.reduce((sum, g) => sum + (g.power_limit || 0), 0);

  const totalPower = metrics?.current_power_watts ?? fallbackTotalPower;
  const totalMemUsed = metrics?.vram_used_gb ?? fallbackTotalMemUsed;
  const vramCapacity = metrics?.vram_capacity_gb ?? fallbackMemCapacity;
  const powerLimit = metrics?.power_limit_watts ?? fallbackPowerLimit;

  const genTps = firstPositive(metrics?.session_avg_generation, metrics?.generation_throughput);
  const prefillTps = firstPositive(metrics?.session_avg_prefill, metrics?.prompt_throughput);
  const ttftMs = firstPositive(metrics?.avg_ttft_ms);
  const sessions = metrics?.running_requests ?? 0;
  const peakGenTps = firstPositive(
    metrics?.session_peak_generation_throughput,
    metrics?.session_peak_generation,
    metrics?.peak_generation_tps,
  );
  const peakPrefillTps = firstPositive(
    metrics?.session_peak_prompt_throughput,
    metrics?.session_peak_prefill,
    metrics?.peak_prefill_tps,
  );
  const peakTtftMs = firstPositive(metrics?.session_peak_ttft_ms, metrics?.peak_ttft_ms);
  const peakReq = metrics?.session_peak_running_requests ?? 0;

  return (
    <div className="border border-(--border) bg-(--surface)">
      {/* Single-line header bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-(--border) px-3 py-2">
        <StatusDot running={isRunning} />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-(--dim)">
          {isRunning ? "Active" : "Standby"}
        </span>
        <span
          className="min-w-0 flex-1 truncate font-mono text-xs text-(--fg)"
          title={modelName || ""}
        >
          {modelName || "No model loaded"}
        </span>
        {!isConnected && <Tag tone="err">offline</Tag>}
        {backend && <Tag>{backend}</Tag>}
        {platformKind && <Tag>{platformKind}</Tag>}
        {inferencePort && (
          <span className="font-mono text-[10px] text-(--dim)">:{inferencePort}</span>
        )}

        {recipes && onLaunch && (
          <ModelsDropdown
            recipes={recipes}
            currentRecipeId={currentRecipe?.id}
            launching={!!launching}
            onLaunch={onLaunch}
            onNewRecipe={onNewRecipe}
            onViewAll={onViewAll}
          />
        )}

        {isRunning && (
          <div className="flex items-center gap-1">
            <ActionBtn label="Chat" onClick={onNavigateChat} />
            <ActionBtn label="Logs" onClick={onNavigateLogs} />
            <ActionBtn
              label={benchmarking ? "Run" : "Bench"}
              onClick={onBenchmark}
              disabled={benchmarking}
            />
            <ActionBtn label="Stop" onClick={onStop} danger />
          </div>
        )}
      </div>

      {/* Flat stat strip — one row, no nested cards */}
      {isRunning && (
        <div className="grid grid-cols-3 divide-x divide-(--border) xl:grid-cols-6">
          <Stat
            label="Decode"
            value={genTps.toFixed(1)}
            unit="t/s"
            detail={peakGenTps > 0 ? `max ${peakGenTps.toFixed(1)}` : undefined}
          />
          <Stat
            label="Prefill"
            value={prefillTps.toFixed(1)}
            unit="t/s"
            detail={peakPrefillTps > 0 ? `max ${peakPrefillTps.toFixed(1)}` : undefined}
          />
          <Stat
            label="TTFT"
            value={ttftMs > 0 ? ttftMs.toFixed(0) : "—"}
            unit="ms"
            detail={peakTtftMs > 0 ? `max ${peakTtftMs.toFixed(0)}ms` : undefined}
          />
          <Stat
            label="Req"
            value={String(sessions)}
            unit=""
            detail={peakReq > 0 ? `max ${peakReq}` : undefined}
          />
          <Stat
            label="VRAM"
            value={totalMemUsed.toFixed(1)}
            unit={vramCapacity > 0 ? `/${vramCapacity.toFixed(0)}G` : "G"}
          />
          <Stat
            label="Power"
            value={String(Math.round(totalPower))}
            unit={powerLimit > 0 ? `/${Math.round(powerLimit)}W` : "W"}
          />
        </div>
      )}
    </div>
  );
}

/* Section card kept for backwards compatibility (gpu/log sections still use it). */
export function SectionCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-(--border) bg-(--surface)">
      <div className="border-b border-(--border) px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-(--dim)">
          {label}
        </span>
      </div>
      <div className="px-3 py-3">{children}</div>
    </div>
  );
}

function StatusDot({ running }: { running: boolean }) {
  return <span className={`h-1.5 w-1.5 ${running ? "bg-(--fg)" : "bg-(--dim)/55"}`} />;
}

function Tag({ tone, children }: { tone?: "err"; children: React.ReactNode }) {
  const cls = tone === "err" ? "border-(--err) text-(--err)" : "border-(--border) text-(--dim)";
  return (
    <span
      className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${cls}`}
    >
      {children}
    </span>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        danger
          ? "border-(--err)/40 text-(--err) hover:bg-(--err)/10"
          : "border-(--border) text-(--dim) hover:bg-(--fg)/5 hover:text-(--fg)"
      }`}
    >
      {label}
    </button>
  );
}

function Stat({
  label,
  value,
  unit,
  detail,
}: {
  label: string;
  value: string;
  unit: string;
  detail?: string;
}) {
  return (
    <div className="px-3 py-2">
      <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-(--dim)">{label}</div>
      <div className="mt-0.5 font-mono text-sm tabular-nums text-(--fg)">
        {value}
        {unit && <span className="ml-1 text-[9px] text-(--dim)">{unit}</span>}
      </div>
      {detail && (
        <div className="mt-0.5 font-mono text-[9px] tabular-nums text-(--dim)">{detail}</div>
      )}
    </div>
  );
}

function firstPositive(...values: Array<number | null | undefined>): number {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  }
  return 0;
}

/* Inline Models dropdown — auto-closes on outside click and selection. */
function ModelsDropdown({
  recipes,
  currentRecipeId,
  launching,
  onLaunch,
  onNewRecipe,
  onViewAll,
}: {
  recipes: RecipeWithStatus[];
  currentRecipeId?: string;
  launching: boolean;
  onLaunch: (id: string) => Promise<void>;
  onNewRecipe?: () => void;
  onViewAll?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const q = filter.toLowerCase();
  const filtered = q
    ? recipes.filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
    : recipes;
  const visible = filtered.slice(0, q ? 8 : 6);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="border border-(--border) px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-(--dim) hover:bg-(--fg)/5 hover:text-(--fg)"
      >
        Models ▾
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-[22rem] border border-(--border) bg-(--surface) shadow-lg">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] border-b border-(--border)">
            <input
              autoFocus
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search models…"
              className="min-w-0 bg-transparent px-2.5 py-1.5 font-mono text-xs text-(--fg) placeholder:text-(--dim)/60 focus:outline-none"
            />
            {onNewRecipe && (
              <button
                onClick={() => {
                  setOpen(false);
                  onNewRecipe();
                }}
                className="border-l border-(--border) px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-(--dim) hover:bg-(--fg)/5 hover:text-(--fg)"
              >
                + new
              </button>
            )}
          </div>
          <div className="max-h-[18rem] overflow-auto">
            {visible.length === 0 && (
              <div className="px-3 py-4 font-mono text-xs text-(--dim)">No models</div>
            )}
            {visible.map((r) => {
              const isCur = r.id === currentRecipeId;
              const running = r.status === "running";
              const disabled = launching || running;
              return (
                <button
                  key={r.id}
                  disabled={disabled}
                  onClick={async () => {
                    setOpen(false);
                    await onLaunch(r.id);
                  }}
                  className={`flex w-full items-center gap-2 border-b border-(--border)/60 px-2.5 py-1.5 text-left last:border-b-0 ${
                    isCur ? "bg-(--fg)/8" : "hover:bg-(--fg)/5"
                  } ${disabled && !running ? "cursor-not-allowed opacity-30" : ""}`}
                >
                  <span
                    className={`h-3 w-0.5 shrink-0 ${
                      isCur ? "bg-(--fg)" : running ? "bg-(--fg)/60" : "bg-(--dim)/40"
                    }`}
                  />
                  <span className="flex-1 truncate font-mono text-xs text-(--fg)" title={r.name}>
                    {r.name}
                  </span>
                  {running && <span className="h-1.5 w-1.5 bg-(--fg)" />}
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-(--dim)">
                    tp{r.tp || r.tensor_parallel_size}
                  </span>
                </button>
              );
            })}
          </div>
          {onViewAll && filtered.length > visible.length && (
            <button
              onClick={() => {
                setOpen(false);
                onViewAll();
              }}
              className="block w-full border-t border-(--border) px-2.5 py-1.5 text-left font-mono text-[10px] text-(--dim) hover:bg-(--fg)/5 hover:text-(--fg)"
            >
              {filter
                ? `${filtered.length - visible.length} more →`
                : `View all ${recipes.length} →`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
