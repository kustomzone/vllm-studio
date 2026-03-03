// CRITICAL
"use client";

import { ChevronRight } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { ActivityGroup } from "@/app/chat/types";
import { getTurnSummary } from "./tool-categorization";
import { ThinkingItem } from "./thinking-item";
import { ToolItem } from "./tool-item";

interface TurnGroupProps {
  group: ActivityGroup;
  hasActiveThinking: boolean;
}

export function TurnGroup({ group, hasActiveThinking }: TurnGroupProps) {
  const [collapsed, setCollapsed] = useState(!group.isLatest);

  const summary = useMemo(() => getTurnSummary(group.items), [group.items]);
  const isCollapsed = group.isLatest ? false : collapsed;
  const toggleCollapsed = useCallback(() => {
    if (group.isLatest) return;
    setCollapsed((prev) => !prev);
  }, [group.isLatest]);

  return (
    <div className="">
      <button
        onClick={toggleCollapsed}
        className={`w-full px-1 py-1.5 text-left group ${
          !group.isLatest ? "cursor-pointer hover:text-(--fg)" : "cursor-default"
        } transition-colors`}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-(--fg)">
            {group.isLatest ? "Current turn" : `Turn ${group.turnNumber || 1}`}
          </span>
          {!group.isLatest && summary.count > 0 && (
            <span className="text-[11px] text-(--dim)">{summary.label}</span>
          )}
          {group.isLatest && hasActiveThinking && (
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-(--hl1) animate-pulse" />
          )}
          {!group.isLatest && (
            <ChevronRight
              className={`h-3.5 w-3.5 text-(--dim) shrink-0 ml-auto transition-transform duration-150 ${
                !isCollapsed ? "rotate-90" : "group-hover:text-(--fg)"
              }`}
            />
          )}
        </div>
      </button>

      {!isCollapsed && (
        <div className="pb-2 space-y-1.5">
          {group.items.map((item) =>
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
}
