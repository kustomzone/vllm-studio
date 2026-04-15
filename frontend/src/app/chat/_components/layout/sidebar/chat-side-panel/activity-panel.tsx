// CRITICAL
"use client";

import { ChevronRight, Loader2 } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import type { ActivityGroup, ActivityItem } from "@/app/chat/types";
import { categorize } from "./tool-categorization";
import { ThinkingItem } from "./thinking-item";
import { ToolItem } from "./tool-item";

export interface ActivityPanelProps {
  activityGroups: ActivityGroup[];
  agentPlan?: { steps: Array<{ status: string; title: string }> } | null;
  isLoading?: boolean;
  runStatusLine?: string;
}

/* ── Category labels (shown on each row, in timeline order) ── */
const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  web: { label: "Browser", color: "var(--accent)" },
  file: { label: "File System", color: "var(--hl2)" },
  search: { label: "Search", color: "var(--hl1)" },
  code: { label: "Terminal", color: "var(--hl3)" },
  plan: { label: "Planning", color: "var(--hl2)" },
  thinking: { label: "Reasoning", color: "var(--dim)" },
  other: { label: "Tools", color: "var(--dim)" },
};

/* ── One turn: single chronological timeline ── */
interface ChronologicalTurnGroupProps {
  group: ActivityGroup;
  hasActiveThinking: boolean;
}

const ChronologicalTurnGroup = memo(function ChronologicalTurnGroup({
  group,
  hasActiveThinking,
}: ChronologicalTurnGroupProps) {
  const [collapsed, setCollapsed] = useState(!group.isLatest);
  const isCollapsed = group.isLatest ? false : collapsed;
  const toggle = useCallback(() => {
    if (!group.isLatest) setCollapsed((p) => !p);
  }, [group.isLatest]);

  const orderedItems = useMemo(
    () => [...group.items].sort((a, b) => a.timestamp - b.timestamp),
    [group.items],
  );

  const totalTools = group.items.filter((i) => i.type !== "thinking").length;

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className={`w-full px-1 py-1 text-left ${
          !group.isLatest ? "cursor-pointer hover:text-(--fg)" : "cursor-default"
        } transition-colors`}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-(--fg)">
            {group.isLatest ? "Current turn" : `Turn ${group.turnNumber || 1}`}
          </span>
          {!group.isLatest && totalTools > 0 && (
            <span className="text-[10px] text-(--dim) font-mono">
              {totalTools} action{totalTools !== 1 ? "s" : ""}
            </span>
          )}
          {group.isLatest && hasActiveThinking && (
            <span className="h-1.5 w-1.5 rounded-full bg-(--hl1) animate-pulse" />
          )}
          {!group.isLatest && (
            <ChevronRight
              className={`h-3 w-3 text-(--dim) ml-auto transition-transform duration-150 ${
                !isCollapsed ? "rotate-90" : ""
              }`}
            />
          )}
        </div>
      </button>

      {!isCollapsed &&
        (group.isLatest ? (
          <div className="rounded-lg border border-(--border)/20 bg-(--fg)/[0.02] px-2 py-2 pb-2.5">
            <div className="relative pl-2">
              <div
                className="pointer-events-none absolute left-[5px] top-1.5 bottom-1.5 w-px bg-(--border)/35 rounded-full"
                aria-hidden
              />
              <div className="space-y-0">
                {orderedItems.map((item, idx) => {
                  const cat = item.type === "thinking" ? "thinking" : categorize(item.toolName);
                  const config = CATEGORY_LABELS[cat] ?? CATEGORY_LABELS.other;
                  const rowActive =
                    item.state === "running" || (item.type === "thinking" && item.isActive);
                  const isLast = idx === orderedItems.length - 1;
                  return (
                    <div
                      key={item.id}
                      className={`relative flex gap-2.5 pl-1 ${!isLast ? "pb-2.5" : ""}`}
                    >
                      <div className="relative z-[1] flex w-3 shrink-0 flex-col items-center pt-1">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ring-2 ring-(--bg) ${rowActive ? "animate-pulse" : ""}`}
                          style={{ background: config.color }}
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5 pt-0.5">
                        <span className="text-[9px] font-medium tracking-wide text-(--dim)/45">
                          {config.label}
                        </span>
                        {item.type === "thinking" ? (
                          <ThinkingItem
                            variant="embedded"
                            content={item.content}
                            isActive={item.isActive}
                          />
                        ) : (
                          <ToolItem variant="embedded" item={item} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 border-l border-(--border)/20 ml-1.5 pl-2.5 pb-2">
            {orderedItems.map((item) => {
              const cat = item.type === "thinking" ? "thinking" : categorize(item.toolName);
              const config = CATEGORY_LABELS[cat] ?? CATEGORY_LABELS.other;
              const rowActive =
                item.state === "running" || (item.type === "thinking" && item.isActive);
              return (
                <div key={item.id} className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${rowActive ? "animate-pulse" : ""}`}
                      style={{ background: config.color }}
                    />
                    <span className="text-[9px] font-medium uppercase tracking-wide text-(--dim)/55">
                      {config.label}
                    </span>
                  </div>
                  {item.type === "thinking" ? (
                    <ThinkingItem content={item.content} isActive={item.isActive} />
                  ) : (
                    <ToolItem item={item} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
});

/* ── Main Activity Panel ── */
export function ActivityPanel({
  activityGroups,
  agentPlan,
  isLoading,
  runStatusLine,
}: ActivityPanelProps) {
  if (activityGroups.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-5">
        <p className="text-[11px] text-(--dim)/40">No activity yet</p>
      </div>
    );
  }

  const totalSteps = agentPlan?.steps.length ?? 0;
  const doneSteps = agentPlan?.steps.filter((s) => s.status === "done").length ?? 0;
  const currentStep = agentPlan?.steps.find((s) => s.status === "running");

  return (
    <div className="h-full flex flex-col">
      <div
        className={`px-3 pt-2.5 pb-0.5 flex items-center gap-2 transition-opacity duration-200 ${
          isLoading && runStatusLine?.trim() ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-(--accent) animate-pulse shrink-0" />
        <p className="text-[11px] text-(--fg)/70 truncate font-mono">{runStatusLine ?? ""}</p>
      </div>

      {totalSteps > 0 && (
        <div className="px-3 pt-2.5 pb-2">
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <span className="text-[11px] font-medium text-(--fg)">Plan</span>
            <span className="text-[10px] text-(--dim) font-mono tabular-nums">
              {doneSteps}/{totalSteps}
            </span>
          </div>
          <div className="h-1 w-full bg-(--border)/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-(--hl2) rounded-full transition-all duration-300"
              style={{ width: `${totalSteps > 0 ? (doneSteps / totalSteps) * 100 : 0}%` }}
            />
          </div>
          {isLoading && currentStep && (
            <p className="mt-1 text-[10px] text-(--dim) truncate">{currentStep.title}</p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="px-2.5 py-2 space-y-2">
          {activityGroups.map((group) => (
            <ChronologicalTurnGroup
              key={`${group.id}:${group.isLatest ? "latest" : "past"}`}
              group={group}
              hasActiveThinking={
                group.isLatest && group.items.some((i) => i.type === "thinking" && i.isActive)
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
