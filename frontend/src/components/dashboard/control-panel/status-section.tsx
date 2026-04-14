// CRITICAL
"use client";

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
}: StatusSectionProps) {
  const modelName = currentRecipe?.name || currentProcess?.model_path?.split("/").pop();
  const isRunning = !!currentProcess;
  const backend = currentProcess?.backend;

  const totalPower = gpus.reduce((sum, g) => sum + (g.power_draw || 0), 0);
  const totalMemUsed = gpus.reduce((sum, g) => {
    if (g.memory_used_mb != null) return sum + toGBFromMB(g.memory_used_mb);
    return sum + toGB(g.memory_used ?? 0);
  }, 0);
  const sessionInput = metrics?.prompt_tokens_total || 0;
  const sessionOutput = metrics?.generation_tokens_total || 0;
  const kvCache = metrics?.kv_cache_usage ? Math.round(metrics.kv_cache_usage * 100) : null;

  const genTps = firstPositive(metrics?.session_avg_generation, metrics?.generation_throughput);
  const prefillTps = firstPositive(metrics?.session_avg_prefill, metrics?.prompt_throughput);

  return (
    <SectionCard label="Status" icon="monitor">
      {/* Model identity + status */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <StatusDot running={isRunning} />
            <span className="text-xs text-(--dim)/60">
              {isRunning ? "Active" : "Standby"}
            </span>
            {!isConnected && (
              <Badge variant="error">offline</Badge>
            )}
            {backend && <Badge variant="default">{backend}</Badge>}
            {platformKind && <Badge variant="default">{platformKind}</Badge>}
          </div>
          <h2 className="text-xl font-semibold text-(--fg) leading-tight">
            {modelName || "No Model Loaded"}
          </h2>
          {inferencePort && (
            <span className="text-xs font-mono text-(--dim)/40 mt-1 block">:{inferencePort}</span>
          )}
        </div>

        {/* Action buttons */}
        {isRunning && (
          <div className="flex items-center gap-2">
            <ActionBtn label="Chat" onClick={onNavigateChat} />
            <ActionBtn label="Logs" onClick={onNavigateLogs} />
            <ActionBtn
              label={benchmarking ? "Running..." : "Benchmark"}
              onClick={onBenchmark}
              disabled={benchmarking}
            />
            <ActionBtn label="Stop" onClick={onStop} danger />
          </div>
        )}
      </div>

      {/* Stat pills */}
      {isRunning && (
        <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-(--border)/30">
          {genTps > 0 && <StatPill label="Generation" value={`${genTps.toFixed(1)}`} unit="tok/s" highlight />}
          {prefillTps > 0 && <StatPill label="Prefill" value={`${prefillTps.toFixed(1)}`} unit="tok/s" />}
          {sessionInput > 0 && <StatPill label="Prompt" value={fmt(sessionInput)} unit="tokens" />}
          {sessionOutput > 0 && <StatPill label="Output" value={fmt(sessionOutput)} unit="tokens" />}
          {kvCache != null && <StatPill label="KV Cache" value={`${kvCache}`} unit="%" />}
          {totalMemUsed > 0 && <StatPill label="VRAM" value={`${totalMemUsed.toFixed(1)}`} unit="GB" />}
          {totalPower > 0 && <StatPill label="Power" value={`${Math.round(totalPower)}`} unit="W" />}
        </div>
      )}
    </SectionCard>
  );
}

/* ── Shared primitives ── */

export function SectionCard({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-(--border)/40 bg-(--surface)/30 overflow-hidden">
      {/* Section header */}
      <div className="px-5 py-3 border-b border-(--border)/20 flex items-center gap-2 bg-(--surface)/50">
        {icon && <span className="text-sm text-(--dim)/50">{icon}</span>}
        <span className="text-[11px] uppercase tracking-[0.14em] font-medium text-(--dim)/50">
          {label}
        </span>
      </div>
      {/* Body */}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function StatusDot({ running }: { running: boolean }) {
  return (
    <span className={`h-2 w-2 rounded-full ${running ? "bg-(--hl2) animate-pulse" : "bg-(--dim)/25"}`} />
  );
}

function Badge({ variant, children }: { variant: "default" | "error"; children: React.ReactNode }) {
  const cls =
    variant === "error"
      ? "bg-(--err)/10 text-(--err) border-(--err)/20"
      : "bg-(--dim)/8 text-(--dim)/60 border-(--border)/30";
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${cls}`}>
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
      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        danger
          ? "border-(--err)/30 text-(--err) hover:bg-(--err)/10"
          : "border-(--border)/40 text-(--dim)/70 hover:bg-(--surface) hover:text-(--fg)"
      }`}
    >
      {label}
    </button>
  );
}

function StatPill({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-(--bg) border border-(--border)/20">
      <span className="text-[10px] text-(--dim)/50">{label}</span>
      <span className={`text-sm font-mono tabular-nums ${highlight ? "text-(--hl2)" : "text-(--fg)"}`}>
        {value}
      </span>
      <span className="text-[10px] text-(--dim)/40">{unit}</span>
    </div>
  );
}

function firstPositive(...values: Array<number | null | undefined>): number {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  }
  return 0;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}
