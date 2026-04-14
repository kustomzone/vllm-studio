// CRITICAL
"use client";

import type { GPU, Metrics, ProcessInfo, RecipeWithStatus, RuntimePlatformKind } from "@/lib/types";
import { toGB, toGBFromMB } from "@/lib/formatters";

interface StatusLineProps {
  currentProcess: ProcessInfo | null;
  currentRecipe: RecipeWithStatus | null;
  isConnected: boolean;
  metrics: Metrics | null;
  gpus: GPU[];
  platformKind?: RuntimePlatformKind | null;
  inferencePort?: number;
  onNavigateChat: () => void;
  onNavigateLogs: () => void;
  onBenchmark: () => void;
  benchmarking: boolean;
  onStop: () => void;
}

export function StatusLine({
  currentProcess,
  currentRecipe,
  isConnected,
  metrics,
  gpus,
  platformKind,
  inferencePort,
  onNavigateChat,
  onNavigateLogs,
  onBenchmark,
  benchmarking,
  onStop,
}: StatusLineProps) {
  const modelName = currentRecipe?.name || currentProcess?.model_path?.split("/").pop();
  const isRunning = !!currentProcess;

  const totalPower = gpus.reduce((sum, g) => sum + (g.power_draw || 0), 0);
  const totalMemUsed = gpus.reduce((sum, g) => {
    if (g.memory_used_mb !== undefined && g.memory_used_mb !== null)
      return sum + toGBFromMB(g.memory_used_mb);
    return sum + toGB(g.memory_used ?? 0);
  }, 0);

  const totalCost = metrics?.lifetime_energy_kwh
    ? (metrics.lifetime_energy_kwh * 0.5).toFixed(2)
    : null;
  const sessionInput = metrics?.prompt_tokens_total || 0;
  const sessionOutput = metrics?.generation_tokens_total || 0;

  return (
    <div className="pb-6 border-b border-(--border)/15">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        {/* Left — Model identity */}
        <div>
          {/* Status indicator */}
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isRunning ? "bg-(--hl2) animate-pulse" : "bg-(--dim)/30"
              }`}
            />
            <span className="text-[10px] uppercase tracking-[0.18em] font-mono text-(--dim)/50">
              {isRunning ? "Active" : "Standby"}
            </span>
            {!isConnected && (
              <span className="text-[10px] font-mono text-(--hl3)/70 ml-1">[offline]</span>
            )}
          </div>

          {/* Model name */}
          <h1 className="text-2xl font-light tracking-tight text-(--fg) leading-tight">
            {modelName || "No Model"}
          </h1>

          {/* Sub info */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {isRunning && currentProcess.backend && (
              <span className="text-[11px] font-mono text-(--dim)/40">
                {currentProcess.backend}
              </span>
            )}
            {platformKind && (
              <span className="text-[11px] font-mono text-(--dim)/30">
                {platformKind}
              </span>
            )}
            {inferencePort && (
              <span className="text-[11px] font-mono text-(--dim)/30">
                :{inferencePort}
              </span>
            )}
          </div>
        </div>

        {/* Right — Stats + Actions */}
        <div className="flex flex-col items-start lg:items-end gap-3">
          {/* Compact stats row */}
          <div className="flex items-center gap-4 font-mono text-[11px] text-(--dim)/40">
            {sessionInput > 0 && <span>↑ {formatTokens(sessionInput)}</span>}
            {sessionOutput > 0 && <span>↓ {formatTokens(sessionOutput)}</span>}
            {totalPower > 0 && <span>{Math.round(totalPower)}W</span>}
            {totalMemUsed > 0 && <span>{totalMemUsed.toFixed(1)} GB</span>}
            {totalCost && <span className="text-(--hl2)/70">{totalCost} PLN</span>}
          </div>

          {/* Action buttons */}
          {isRunning && (
            <div className="flex items-center">
              <Btn label="chat" onClick={onNavigateChat} />
              <span className="text-(--border)/30 mx-0.5">·</span>
              <Btn label="logs" onClick={onNavigateLogs} />
              <span className="text-(--border)/30 mx-0.5">·</span>
              <Btn
                label={benchmarking ? "running…" : "benchmark"}
                onClick={onBenchmark}
                disabled={benchmarking}
              />
              <span className="text-(--border)/20 mx-2">|</span>
              <Btn label="stop" onClick={onStop} danger />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Btn({
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
      className={`px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        danger
          ? "text-(--dim)/40 hover:text-(--err)"
          : "text-(--dim)/40 hover:text-(--fg)/70"
      }`}
    >
      {label}
    </button>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}
