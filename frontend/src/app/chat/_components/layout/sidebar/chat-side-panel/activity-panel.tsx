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

/* ── Category config ── */
const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  web: { label: "Browser", color: "var(--accent)" },
  file: { label: "File System", color: "var(--hl2)" },
  search: { label: "Search", color: "var(--hl1)" },
  code: { label: "Terminal", color: "var(--hl3)" },
  plan: { label: "Planning", color: "var(--hl2)" },
  thinking: { label: "Reasoning", color: "var(--dim)" },
  other: { label: "Tools", color: "var(--dim)" },
};

/* ── Category section — dot-style, no borders ── */
interface CategorySectionProps {
  category: string;
  items: ActivityItem[];
  isActive: boolean;
}

const CategorySection = memo(function CategorySection({
  category,
  items,
  isActive,
}: CategorySectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const config = CATEGORY_LABELS[category] ?? CATEGORY_LABELS.other;
  const activeItems = items.filter((i) => i.state === "running");
  const toggle = useCallback(() => setCollapsed((p) => !p), []);

  return (
    <div>
      <button
        onClick={toggle}
        className="w-full flex items-center gap-1.5 px-1 py-0.5 hover:bg-(--fg)/[0.02] transition-colors rounded"
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full bg-(--dim)/40 ${isActive ? "animate-pulse" : ""}`}
        />
        <span className="text-[10px] font-medium text-(--fg)/70 flex-1 text-left">
          {config.label}
        </span>
        <span className="text-[9px] text-(--dim)/50 font-mono tabular-nums">{items.length}</span>
        <ChevronRight
          className={`h-2.5 w-2.5 text-(--dim)/40 transition-transform duration-150 ${
            !collapsed ? "rotate-90" : ""
          }`}
        />
      </button>

      {!collapsed && (
        <div className="ml-2 pl-2 border-l border-(--border)/20 space-y-0.5 mt-0.5">
          {isActive && activeItems.length > 0 && (
            <p className="text-[10px] font-mono py-0.5 px-1" style={{ color: config.color }}>
              {activeItems[0].toolName
                ? activeItems[0].toolName.split("__").pop()?.replace(/_/g, " ")
                : "running…"}
            </p>
          )}
          {items.map((item) =>
            item.type === "thinking" ? (
              <ThinkingItem key={item.id} content={item.content} isActive={item.isActive} />
            ) : (
              <ToolItem key={item.id} item={item} />
            ),
          )}
        </div>
      )}
    </div>
  );
});

/* ── Turn group with categories ── */
interface CategorizedTurnGroupProps {
  group: ActivityGroup;
  hasActiveThinking: boolean;
}

const CategorizedTurnGroup = memo(function CategorizedTurnGroup({
  group,
  hasActiveThinking,
}: CategorizedTurnGroupProps) {
  const [collapsed, setCollapsed] = useState(!group.isLatest);
  const isCollapsed = group.isLatest ? false : collapsed;
  const toggle = useCallback(() => {
    if (!group.isLatest) setCollapsed((p) => !p);
  }, [group.isLatest]);

  const categorized = useMemo(() => {
    const cats = new Map<string, ActivityItem[]>();
    const thinkingItems = group.items.filter((i) => i.type === "thinking");
    if (thinkingItems.length > 0) {
      cats.set("thinking", thinkingItems);
    }
    for (const item of group.items) {
      if (item.type === "thinking") continue;
      const cat = categorize(item.toolName);
      const list = cats.get(cat) ?? [];
      list.push(item);
      cats.set(cat, list);
    }
    return cats;
  }, [group.items]);

  const totalTools = group.items.filter((i) => i.type !== "thinking").length;

  return (
    <div>
      <button
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

      {!isCollapsed && (
        <div className="space-y-1 pb-2">
          {Array.from(categorized.entries()).map(([cat, items]) => {
            const hasActiveItem = items.some(
              (i) => i.state === "running" || (i.type === "thinking" && i.isActive),
            );
            return (
              <CategorySection key={cat} category={cat} items={items} isActive={hasActiveItem} />
            );
          })}
        </div>
      )}
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
            <CategorizedTurnGroup
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
