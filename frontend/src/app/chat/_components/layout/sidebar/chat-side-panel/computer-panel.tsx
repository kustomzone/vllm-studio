// CRITICAL
"use client";

import { Monitor, Terminal } from "lucide-react";
import { useMemo, useState } from "react";
import type { ActivityGroup } from "@/app/chat/types";
import type { AgentMachineInfo } from "@/lib/types";
import { extractComputerActivityEntries } from "./browser-computer-data";

interface ComputerPanelProps {
  activityGroups: ActivityGroup[];
  machine: AgentMachineInfo | null;
  machineLoading: boolean;
  machineError: string | null;
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

export function ComputerPanel({
  activityGroups,
  machine,
  machineLoading,
  machineError,
}: ComputerPanelProps) {
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

  const screenshot = machine?.screenshot?.imageDataUrl ?? null;

  if (!selected && !screenshot && !machineLoading) {
    return (
      <div className="h-full flex items-center justify-center px-5">
        <div className="max-w-xs text-center">
          <p className="text-xl leading-tight text-(--fg)/80">No remote computer session yet</p>
          <p className="mt-2 text-base leading-snug text-(--dim)">
            Open the Browser or Files tab to initialize the remote machine.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-3 border-b border-(--border)/40">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-(--dim)">Remote computer</p>
            {selected ? (
              <p className="mt-1 text-xs text-(--fg) font-mono break-words">{selected.command}</p>
            ) : (
              <p className="mt-1 text-xs text-(--dim)">
                {machineLoading
                  ? "Initializing desktop processes…"
                  : machineError || machine?.screenshotError || "Desktop snapshot ready"}
              </p>
            )}
          </div>
          {selected ? (
            <div className="shrink-0 rounded-md border border-(--border)/50 px-2 py-1 text-[10px] text-(--dim)">
              {labelFromTool(selected.toolName)}
            </div>
          ) : null}
        </div>
      </div>

      {entries.length > 0 && selected ? (
        <div className="px-3 py-2 border-b border-(--border)/40 overflow-y-auto max-h-40">
          <div className="flex flex-col gap-1.5">
            {entries.map((entry) => {
              const active = entry.id === selected.id;
              const tone = STATE_TONE[entry.state ?? "pending"] ?? "text-(--dim)";
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedIdOverride(entry.id)}
                  className={`w-full inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] border transition-colors text-left ${
                    active
                      ? "border-(--hl2)/60 bg-(--hl2)/10 text-(--fg)"
                      : "border-(--border)/50 text-(--dim) hover:text-(--fg) hover:border-(--fg)/20"
                  }`}
                  title={`${entry.command} • ${entry.turnTitle}`}
                >
                  <Monitor className={`h-3.5 w-3.5 shrink-0 ${tone}`} />
                  <span className="min-w-0 break-all leading-relaxed">{entry.command}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-auto bg-black/20 p-3">
        {screenshot ? (
          <div className="mb-3 rounded-md border border-(--border)/40 overflow-hidden bg-black/40">
            <img
              src={screenshot}
              alt="Remote desktop screenshot"
              className="w-full h-auto block"
            />
          </div>
        ) : null}

        {selected ? (
          <>
            <div className="flex items-center gap-2 text-[11px] text-(--dim) mb-2">
              <Terminal className="h-3.5 w-3.5" />
              <span>{selected.turnTitle}</span>
            </div>
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-(--fg)">
              {selected.output || "(no output)"}
            </pre>
          </>
        ) : (
          <div className="text-xs text-(--dim)">
            {machineLoading
              ? "Preparing remote computer screenshot…"
              : machineError || machine?.screenshotError || "No command output yet."}
          </div>
        )}
      </div>
    </div>
  );
}
