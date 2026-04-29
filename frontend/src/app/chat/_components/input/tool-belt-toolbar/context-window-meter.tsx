"use client";

import type { ContextStats } from "@/lib/services/context-management";

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ContextWindowMeter({
  stats,
  onClick,
}: {
  stats: Omit<ContextStats, "compactionHistory" | "lastCompaction" | "totalCompactions" | "totalTokensCompacted"> | null | undefined;
  onClick?: () => void;
}) {
  if (!stats || !stats.maxContext || stats.maxContext <= 0) return null;

  const pct = Math.min(100, Math.round((stats.currentTokens / stats.maxContext) * 100));
  const label = `${formatCompact(stats.currentTokens)} / ${formatCompact(stats.maxContext)}`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`Context: ${label} (${pct}%)`}
      className="flex items-center gap-1 px-1.5 h-7 rounded-md hover:bg-(--fg)/[0.06] transition-colors cursor-pointer shrink-0"
    >
      <div className="h-1.5 w-10 rounded-full bg-(--surface-overlay) overflow-hidden">
        <div
          className="h-full rounded-full bg-(--accent)/60 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-(--dim)/60 tabular-nums whitespace-nowrap">
        {pct}%
      </span>
    </button>
  );
}
