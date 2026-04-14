// CRITICAL
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMotionValueEvent, useSpring } from "framer-motion";
import type { GPU, Metrics, ProcessInfo } from "@/lib/types";
import { toGB, toGBFromMB } from "@/lib/formatters";

interface MetricBarProps {
  metrics: Metrics | null;
  gpus: GPU[];
  currentProcess: ProcessInfo | null;
  logs?: string[];
}

const TOKENS_PER_SECOND_PATTERN = /([0-9]+(?:\.[0-9]+)?)\s*tokens\s+per\s+second/i;
const PROMPT_EVAL_PATTERN = /prompt eval time\s*=/i;
const EVAL_PATTERN = /(^|\s)eval time\s*=/i;

const parseTokensPerSecond = (line: string): number => {
  const match = line.match(TOKENS_PER_SECOND_PATTERN);
  if (!match?.[1]) return 0;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const parseLlamacppThroughputFromLogs = (
  lines: string[] | undefined,
): { prefill: number; generation: number } => {
  if (!Array.isArray(lines) || lines.length === 0) return { prefill: 0, generation: 0 };
  let promptLine = "";
  let evalLine = "";
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? "";
    if (!promptLine && PROMPT_EVAL_PATTERN.test(line)) { promptLine = line; continue; }
    if (!evalLine && EVAL_PATTERN.test(line) && !PROMPT_EVAL_PATTERN.test(line)) evalLine = line;
    if (promptLine && evalLine) break;
  }
  return { prefill: parseTokensPerSecond(promptLine), generation: parseTokensPerSecond(evalLine) };
};

const firstPositive = (...values: Array<number | null | undefined>): number => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  }
  return 0;
};

/* ── Stat block ── */
function StatBlock({
  label,
  value,
  unit,
  sub,
  live,
  accent,
  wide,
}: {
  label: string;
  value: string;
  unit: string;
  sub?: string;
  live?: boolean;
  accent?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`flex flex-col justify-between py-5 px-5 ${wide ? "flex-[1.4]" : "flex-1"}`}>
      <span className="text-[9px] uppercase tracking-[0.18em] text-(--dim)/50 font-mono mb-3">
        {label}
      </span>
      <div className="flex items-end gap-1.5 leading-none">
        <span
          className={`font-mono tabular-nums text-[2rem] leading-none font-light ${
            live ? "text-(--hl2)" : accent ? "text-(--hl2)" : "text-(--fg)"
          }`}
        >
          {value}
        </span>
        <span className="text-[10px] text-(--dim)/40 font-mono mb-0.5">{unit}</span>
        {live && (
          <span className="mb-0.5 ml-0.5 h-1.5 w-1.5 rounded-full bg-(--hl2) animate-pulse shrink-0" />
        )}
      </div>
      {sub && <span className="text-[9px] font-mono text-(--dim)/30 mt-1.5">{sub}</span>}
    </div>
  );
}

/* ── Divider ── */
const VDiv = () => <div className="w-px bg-(--border)/25 self-stretch my-3" />;

export function MetricBar({ metrics, gpus, currentProcess, logs }: MetricBarProps) {
  const isLlamacpp = currentProcess?.backend === "llamacpp";
  const logThroughput = useMemo(() => parseLlamacppThroughputFromLogs(logs), [logs]);
  const rawGenTps = firstPositive(
    metrics?.session_avg_generation,
    metrics?.generation_throughput,
    isLlamacpp ? logThroughput.generation : 0,
  );
  const rawPrefillTps = firstPositive(
    metrics?.session_avg_prefill,
    metrics?.prompt_throughput,
    isLlamacpp ? logThroughput.prefill : 0,
  );
  const genTps = useHeldThroughput(rawGenTps);
  const prefillTps = useHeldThroughput(rawPrefillTps);
  const animatedGenTps = useAnimatedNumber(genTps);
  const animatedPrefillTps = useAnimatedNumber(prefillTps);

  const genPeak = firstPositive(metrics?.session_peak_generation, metrics?.peak_generation_tps);
  const prefillPeak = firstPositive(metrics?.session_peak_prefill, metrics?.peak_prefill_tps);

  const totalPower = gpus.reduce((sum, g) => sum + (g.power_draw || 0), 0);
  const totalMemUsed = gpus.reduce((sum, g) => {
    if (g.memory_used_mb !== undefined && g.memory_used_mb !== null)
      return sum + toGBFromMB(g.memory_used_mb);
    return sum + toGB(g.memory_used ?? 0);
  }, 0);
  const totalMemMax = gpus.reduce((sum, g) => {
    if (g.memory_total_mb !== undefined && g.memory_total_mb !== null)
      return sum + toGBFromMB(g.memory_total_mb);
    return sum + toGB(g.memory_total ?? 0);
  }, 0);
  const kvCache = metrics?.kv_cache_usage ? Math.round(metrics.kv_cache_usage * 100) : 0;
  const totalCost = metrics?.lifetime_energy_kwh
    ? (metrics.lifetime_energy_kwh * 0.5).toFixed(2)
    : null;

  const memPct = totalMemMax > 0 ? (totalMemUsed / totalMemMax) * 100 : 0;

  return (
    <div className="relative">
      {/* Corner marks */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-(--border)/40" />
      <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-(--border)/40" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-(--border)/40" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-(--border)/40" />

      {/* Dot grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, color-mix(in srgb, var(--fg) 5%, transparent) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      <div className="relative flex items-stretch flex-wrap">
        <StatBlock
          label="generation"
          value={genTps > 0 ? animatedGenTps.toFixed(1) : "--"}
          unit="tok/s"
          sub={genPeak > 0 ? `peak ${genPeak.toFixed(1)}` : undefined}
          live={genTps > 0}
        />
        <VDiv />
        <StatBlock
          label="prefill"
          value={prefillTps > 0 ? animatedPrefillTps.toFixed(1) : "--"}
          unit="tok/s"
          sub={prefillPeak > 0 ? `peak ${prefillPeak.toFixed(1)}` : undefined}
          live={prefillTps > 0}
        />
        <VDiv />
        <StatBlock
          label="memory"
          value={`${totalMemUsed.toFixed(1)} / ${totalMemMax.toFixed(0)}`}
          unit="GB"
          sub={memPct > 0 ? `${memPct.toFixed(0)}% used` : undefined}
          wide
        />
        <VDiv />
        <StatBlock
          label="kv cache"
          value={kvCache > 0 ? kvCache.toString() : "--"}
          unit="%"
        />
        <VDiv />
        <StatBlock
          label="power"
          value={totalPower > 0 ? Math.round(totalPower).toString() : "--"}
          unit="W"
        />
        {totalCost && (
          <>
            <VDiv />
            <StatBlock label="cost" value={totalCost} unit="PLN" accent />
          </>
        )}
      </div>

      {/* Memory fill bar — thin bottom edge indicator */}
      {memPct > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-px bg-(--border)/10">
          <div
            className="h-full bg-(--fg)/20 transition-all duration-700"
            style={{ width: `${memPct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function useHeldThroughput(value: number, holdMs = 12_000): number {
  const [heldValue, setHeldValue] = useState(() => (value > 0 ? value : 0));
  const lastPositiveAtRef = useRef(value > 0 ? Date.now() : 0);
  useEffect(() => {
    if (value > 0) {
      lastPositiveAtRef.current = Date.now();
      setHeldValue(value);
      return;
    }
    const lastPositiveAt = lastPositiveAtRef.current;
    if (!lastPositiveAt) { setHeldValue(0); return; }
    const elapsed = Date.now() - lastPositiveAt;
    if (elapsed >= holdMs) { setHeldValue(0); return; }
    const timer = window.setTimeout(() => setHeldValue(0), holdMs - elapsed);
    return () => window.clearTimeout(timer);
  }, [holdMs, value]);
  return heldValue;
}

function useAnimatedNumber(value: number): number {
  const spring = useSpring(value, { stiffness: 190, damping: 26, mass: 0.7 });
  const [displayValue, setDisplayValue] = useState(value);
  useEffect(() => { spring.set(value); }, [spring, value]);
  useMotionValueEvent(spring, "change", (latest) => { setDisplayValue(latest); });
  return Number.isFinite(displayValue) ? displayValue : value;
}
