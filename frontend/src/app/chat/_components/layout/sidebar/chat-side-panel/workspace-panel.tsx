// CRITICAL
"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { ActivityGroup, ActivityItem } from "@/app/chat/types";
import type { AgentFileEntry, AgentFileVersion } from "@/lib/types";
import type { AgentPlan } from "../../../agent/agent-types";
import { AgentFileTreeNode, buildAgentFilePath } from "../../../agent/agent-files-tree";
import { categorize } from "./tool-categorization";

/* ── Screenshot extraction ── */

function extractImages(output: unknown): string[] {
  const results: string[] = [];
  if (!output) return results;

  const walk = (val: unknown) => {
    if (typeof val === "string") {
      if (val.startsWith("data:image/")) results.push(val);
      return;
    }
    if (Array.isArray(val)) {
      for (const item of val) walk(item);
      return;
    }
    if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      // OpenAI image_url block
      if (obj.type === "image_url" && typeof obj.image_url === "object") {
        const u = (obj.image_url as Record<string, unknown>).url;
        if (typeof u === "string") results.push(u);
        return;
      }
      // Anthropic image block
      if (obj.type === "image" && typeof obj.source === "object") {
        const src = obj.source as Record<string, unknown>;
        if (
          src.type === "base64" &&
          typeof src.data === "string" &&
          typeof src.media_type === "string"
        ) {
          results.push(`data:${src.media_type};base64,${src.data}`);
          return;
        }
      }
      // Generic screenshot / image field
      for (const key of ["screenshot", "image", "data"]) {
        if (typeof obj[key] === "string" && obj[key]) {
          const v = obj[key] as string;
          if (v.startsWith("data:image/") || (v.length > 100 && /^[A-Za-z0-9+/]/.test(v))) {
            results.push(v.startsWith("data:") ? v : `data:image/png;base64,${v}`);
            return;
          }
        }
      }
      for (const v of Object.values(obj)) walk(v);
    }
  };

  walk(output);
  return results;
}

function extractUrl(input: unknown): string | null {
  if (!input) return null;
  if (typeof input === "string") {
    try {
      return extractUrl(JSON.parse(input));
    } catch {
      return input.startsWith("http") ? input : null;
    }
  }
  if (typeof input === "object" && input !== null) {
    const obj = input as Record<string, unknown>;
    const c = obj.url ?? obj.query ?? obj.search_query ?? obj.q;
    if (typeof c === "string") return c;
  }
  return null;
}

/* ── Section wrapper ── */

function Section({
  label,
  count,
  children,
  defaultOpen = true,
}: {
  label: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-(--border)/20 last:border-b-0">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-1.5 px-3 py-2 hover:bg-(--fg)/[0.02] transition-colors"
      >
        <ChevronRight
          className={`h-3 w-3 text-(--dim)/50 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
        />
        <span className="text-[11px] font-medium text-(--fg)/70 flex-1 text-left">{label}</span>
        {count !== undefined && (
          <span className="text-[10px] font-mono text-(--dim)/50 tabular-nums">{count}</span>
        )}
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

/* ── Browser section ── */

interface BrowserSectionProps {
  activityGroups: ActivityGroup[];
  isLoading?: boolean;
}

const BrowserSection = memo(function BrowserSection({
  activityGroups,
  isLoading,
}: BrowserSectionProps) {
  const { screenshots, webItems } = useMemo(() => {
    const allItems: ActivityItem[] = activityGroups.flatMap((g) =>
      g.items.filter((i) => i.type !== "thinking"),
    );
    const web = allItems.filter((i) => categorize(i.toolName) === "web");
    const shots: { url: string; tool: string }[] = [];
    for (const item of allItems) {
      const imgs = extractImages(item.output);
      for (const img of imgs) shots.push({ url: img, tool: item.toolName ?? "screenshot" });
    }
    return { screenshots: shots, webItems: web };
  }, [activityGroups]);

  const lastShot = screenshots[screenshots.length - 1];

  return (
    <div className="px-3 space-y-2">
      {/* Screenshot viewer */}
      <div
        className={`w-full rounded-lg overflow-hidden border border-(--border)/30 flex items-center justify-center transition-colors ${
          lastShot ? "bg-black" : "bg-(--fg)/[0.02]"
        }`}
        style={{ aspectRatio: "16/9" }}
      >
        {lastShot ? (
          <img src={lastShot.url} alt="Computer view" className="w-full h-full object-contain" />
        ) : (
          <p
            className={`text-[10px] font-mono ${isLoading ? "text-(--accent)/60 animate-pulse" : "text-(--dim)/30"}`}
          >
            {isLoading ? "waiting for screenshot…" : "no output yet"}
          </p>
        )}
      </div>

      {/* URL log */}
      {webItems.length > 0 && (
        <div className="space-y-1">
          {webItems.slice(-6).map((item) => {
            const url = extractUrl(item.input);
            if (!url) return null;
            const isRunning = item.state === "running";
            return (
              <div key={item.id} className="flex items-center gap-1.5">
                <span
                  className={`h-1 w-1 shrink-0 rounded-full ${
                    isRunning ? "bg-(--accent) animate-pulse" : "bg-(--fg)/20"
                  }`}
                />
                <p className="text-[10px] font-mono text-(--dim)/60 truncate">{url}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

/* ── Files section ── */

interface FilesSectionProps {
  files: AgentFileEntry[];
  selectedFilePath: string | null;
  onSelectFile: (path: string | null) => void;
}

const FilesSection = memo(function FilesSection({
  files,
  selectedFilePath,
  onSelectFile,
}: FilesSectionProps) {
  if (files.length === 0) {
    return <p className="px-4 text-[10px] text-(--dim)/40">No files yet</p>;
  }
  return (
    <div className="max-h-48 overflow-y-auto">
      {files.map((entry) => {
        const fullPath = buildAgentFilePath(entry, "");
        return (
          <AgentFileTreeNode
            key={fullPath}
            entry={entry}
            depth={0}
            fullPath={fullPath}
            selectedPath={selectedFilePath}
            onSelect={onSelectFile}
          />
        );
      })}
    </div>
  );
});

/* ── Context section ── */

interface ContextSectionProps {
  stats?: {
    currentTokens?: number;
    maxContext?: number;
    utilization?: number; // 0–1
  } | null;
  breakdown?: {
    userTokens: number;
    assistantTokens: number;
    thinkingTokens: number;
    toolCalls: number;
  } | null;
  formatTokenCount: (n: number) => string;
}

const ContextSection = memo(function ContextSection({
  stats,
  breakdown,
  formatTokenCount,
}: ContextSectionProps) {
  if (!stats) {
    return <p className="px-4 text-[10px] text-(--dim)/40">No context data</p>;
  }
  const pct = Math.min(100, (stats.utilization ?? 0) * 100);
  const barColor = pct > 80 ? "bg-(--err)" : pct > 60 ? "bg-(--hl3)" : "bg-(--hl2)";

  return (
    <div className="px-3 space-y-2">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-(--dim)/60">
            {formatTokenCount(stats.currentTokens ?? 0)} / {formatTokenCount(stats.maxContext ?? 0)}
          </span>
          <span className="text-[10px] font-mono text-(--dim)/60">{pct.toFixed(0)}%</span>
        </div>
        <div className="h-1 w-full bg-(--border)/40 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {breakdown && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {[
            ["User", breakdown.userTokens],
            ["Assistant", breakdown.assistantTokens],
            ["Thinking", breakdown.thinkingTokens],
            ["Tool calls", breakdown.toolCalls],
          ].map(([label, val]) => (
            <div key={label as string} className="flex items-center justify-between">
              <span className="text-[10px] text-(--dim)/50">{label as string}</span>
              <span className="text-[10px] font-mono text-(--dim)/60">
                {formatTokenCount(val as number)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

/* ── WorkspacePanel ── */

export interface WorkspacePanelProps {
  activityGroups: ActivityGroup[];
  isLoading?: boolean;
  agentFiles: AgentFileEntry[];
  agentFileVersions: Record<string, AgentFileVersion[]>;
  selectedFilePath: string | null;
  onSelectFile: (path: string | null) => void;
  agentPlan: AgentPlan | null;
  contextStats?: {
    currentTokens?: number;
    maxContext?: number;
    utilization?: number;
  } | null;
  contextBreakdown?: {
    userTokens: number;
    assistantTokens: number;
    thinkingTokens: number;
    toolCalls: number;
  } | null;
  formatTokenCount: (n: number) => string;
}

export function WorkspacePanel({
  activityGroups,
  isLoading,
  agentFiles,
  selectedFilePath,
  onSelectFile,
  contextStats,
  contextBreakdown,
  formatTokenCount,
}: WorkspacePanelProps) {
  const handleSelect = useCallback((p: string | null) => onSelectFile(p), [onSelectFile]);

  return (
    <div className="h-full overflow-y-auto">
      <Section label="Browser" defaultOpen={true}>
        <BrowserSection activityGroups={activityGroups} isLoading={isLoading} />
      </Section>
      <Section label="Files" count={agentFiles.length} defaultOpen={true}>
        <FilesSection
          files={agentFiles}
          selectedFilePath={selectedFilePath}
          onSelectFile={handleSelect}
        />
      </Section>
      <Section label="Context" defaultOpen={false}>
        <ContextSection
          stats={contextStats}
          breakdown={contextBreakdown}
          formatTokenCount={formatTokenCount}
        />
      </Section>
    </div>
  );
}
