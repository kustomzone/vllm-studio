// CRITICAL
"use client";

import { Monitor, Terminal } from "lucide-react";
import { useMemo, useState } from "react";
import type { ActivityGroup } from "@/app/chat/types";
import { extractComputerActivityEntries } from "./browser-computer-data";

interface ComputerPanelProps {
  activityGroups: ActivityGroup[];
}

const STATE_TONE: Record<string, string> = {
  running: "text-(--accent)",
  complete: "text-(--fg)",
  error: "text-(--err)",
  pending: "text-(--dim)",
};

const labelFromTool = (toolName: string): string =>
  toolName
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

export function ComputerPanel({ activityGroups }: ComputerPanelProps) {
  const entries = useMemo(
    () => extractComputerActivityEntries(activityGroups),
    [activityGroups],
  );
  const [selectedIdOverride, setSelectedIdOverride] = useState<string | null>(null);
  const selected = useMemo(() => {
    if (entries.length === 0) return null;
    if (selectedIdOverride) {
      return entries.find((entry) => entry.id === selectedIdOverride) ?? entries[0];
    }
    return entries[0];
  }, [entries, selectedIdOverride]);

  if (entries.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-5">
        <div className="max-w-xs text-center">
          <p className="text-xl leading-tight text-(--fg)/80">No computer activity yet</p>
          <p className="mt-2 text-base leading-snug text-(--dim)">
            Ask the model to run <code className="text-(--fg)">computer_use</code> (or <code className="text-(--fg)">execute_command</code>) to stream backend machine output here.
          </p>
        </div>
      </div>
    );
  }
  if (!selected) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-3 border-b border-(--border)/40">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-(--dim)">Backend computer command</p>
            <p className="mt-1 text-xs text-(--fg) font-mono break-words">{selected.command}</p>
          </div>
          <div className="shrink-0 rounded-md border border-(--border)/50 px-2 py-1 text-[10px] text-(--dim)">
            {labelFromTool(selected.toolName)}
          </div>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-(--border)/40 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {entries.map((entry) => {
            const active = entry.id === selected.id;
            const tone = STATE_TONE[entry.state ?? "pending"] ?? "text-(--dim)";
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedIdOverride(entry.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] border transition-colors ${
                  active
                    ? "border-(--hl2)/60 bg-(--hl2)/10 text-(--fg)"
                    : "border-(--border)/50 text-(--dim) hover:text-(--fg) hover:border-(--fg)/20"
                }`}
                title={`${entry.command} • ${entry.turnTitle}`}
              >
                <Monitor className={`h-3.5 w-3.5 ${tone}`} />
                <span className="max-w-[200px] truncate">{entry.command}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-black/20 p-3">
        <div className="flex items-center gap-2 text-[11px] text-(--dim) mb-2">
          <Terminal className="h-3.5 w-3.5" />
          <span>{selected.turnTitle}</span>
        </div>
        <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-(--fg)">
          {selected.output || "(no output)"}
        </pre>
      </div>
    </div>
  );
}
