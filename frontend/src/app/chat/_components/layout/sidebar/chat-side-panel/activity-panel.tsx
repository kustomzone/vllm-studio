// CRITICAL
"use client";

import { Globe, FolderTree, Terminal, Brain, ChevronRight, Loader2 } from "lucide-react";
import { memo, useCallback, useMemo, useState, type ReactNode } from "react";
import type { ActivityGroup, ActivityItem } from "@/app/chat/types";
import { categorize, type ToolCategory } from "./tool-categorization";
import { ThinkingItem } from "./thinking-item";
import { ToolItem } from "./tool-item";

export interface ActivityPanelProps {
  activityGroups: ActivityGroup[];
  agentPlan?: { steps: Array<{ status: string; title: string }> } | null;
  isLoading?: boolean;
  runStatusLine?: string;
}

/* ── Category config ── */
const CATEGORY_CONFIG: Record<string, { icon: typeof Globe; label: string; color: string }> = {
  web: { icon: Globe, label: "Browser", color: "var(--accent)" },
  file: { icon: FolderTree, label: "File System", color: "var(--hl2)" },
  search: { icon: FolderTree, label: "Search", color: "var(--hl1)" },
  code: { icon: Terminal, label: "Terminal", color: "var(--hl3)" },
  plan: { icon: Brain, label: "Planning", color: "var(--hl2)" },
  thinking: { icon: Brain, label: "Reasoning", color: "var(--dim)" },
  other: { icon: Terminal, label: "Tools", color: "var(--dim)" },
};

/* ── Live category section ── */
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
  const config = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.other;
  const Icon = config.icon;
  const activeItems = items.filter((i) => i.state === "running");
  const toggle = useCallback(() => setCollapsed((p) => !p), []);

  return (
    <div className="rounded-lg border border-(--border)/30 overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-(--fg)/[0.03] transition-colors"
      >
        <div
          className="flex items-center justify-center w-5 h-5 rounded"
          style={{ background: `color-mix(in srgb, ${config.color} 12%, transparent)` }}
        >
          {isActive ? (
            <Loader2 className="h-3 w-3 animate-spin" style={{ color: config.color }} />
          ) : (
            <Icon className="h-3 w-3" style={{ color: config.color }} />
          )}
        </div>
        <span className="text-[11px] font-medium text-(--fg) flex-1 text-left">{config.label}</span>
        <span className="text-[10px] text-(--dim) font-mono tabular-nums">{items.length}</span>
        <ChevronRight
          className={`h-3 w-3 text-(--dim)/50 transition-transform duration-150 ${
            !collapsed ? "rotate-90" : ""
          }`}
        />
      </button>

      {!collapsed && (
        <div className="px-2 pb-1.5 space-y-0.5">
          {/* Active item highlight */}
          {isActive && activeItems.length > 0 && (
            <div
              className="px-2 py-1 rounded-md text-[10px] font-mono"
              style={{
                background: `color-mix(in srgb, ${config.color} 6%, transparent)`,
                color: config.color,
              }}
            >
              {activeItems[0].toolName
                ? `Running: ${activeItems[0].toolName.split("__").pop()?.replace(/_/g, " ")}`
                : "Running…"}
            </div>
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

  // Group items by category
  const categorized = useMemo(() => {
    const cats = new Map<string, ActivityItem[]>();
    // Thinking items first
    const thinkingItems = group.items.filter((i) => i.type === "thinking");
    if (thinkingItems.length > 0) {
      cats.set("thinking", thinkingItems);
    }
    // Tool calls by category
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
        <div className="space-y-1.5 pb-2">
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
        <div className="text-center">
          <Brain className="h-5 w-5 text-(--dim)/30 mx-auto mb-2" />
          <p className="text-[12px] text-(--dim)/50">No activity yet</p>
        </div>
      </div>
    );
  }

  const totalSteps = agentPlan?.steps.length ?? 0;
  const doneSteps = agentPlan?.steps.filter((s) => s.status === "done").length ?? 0;
  const currentStep = agentPlan?.steps.find((s) => s.status === "running");

  return (
    <div className="h-full flex flex-col">
      {/* Status line */}
      {isLoading && runStatusLine?.trim() && (
        <div className="px-3 pt-2.5 flex items-center gap-2">
          <Loader2 className="h-3 w-3 text-(--accent) animate-spin shrink-0" />
          <p className="text-[11px] text-(--fg)/70 truncate font-mono">{runStatusLine}</p>
        </div>
      )}

      {/* Plan progress */}
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

      {/* Categorized turn groups */}
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
