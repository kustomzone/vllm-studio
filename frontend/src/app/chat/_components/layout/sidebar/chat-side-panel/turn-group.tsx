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

  const toggle = useCallback(() => {
    if (!group.isLatest) setCollapsed((p) => !p);
  }, [group.isLatest]);

  return (
    <div>
      <button
        onClick={toggle}
        className={`w-full px-1 py-1 text-left ${
          !group.isLatest ? "cursor-pointer hover:text-(--fg)" : "cursor-default"
        } transition-colors`}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-(--fg)">
            {group.isLatest ? "Current" : `Turn ${group.turnNumber || 1}`}
          </span>
          {!group.isLatest && summary.count > 0 && (
            <span className="text-[10px] text-(--dim)">{summary.label}</span>
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
        <div className="pb-1.5 space-y-1">
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
