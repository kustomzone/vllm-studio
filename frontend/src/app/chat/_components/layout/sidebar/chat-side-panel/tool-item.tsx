// CRITICAL
"use client";

import { ChevronRight } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import type { ActivityItem } from "@/app/chat/types";
import { safeJsonStringify } from "@/lib/safe-json";

interface ToolItemProps {
  item: ActivityItem;
}

const OUTPUT_PREVIEW_LIMIT = 700;

function getToolDisplayName(name?: string) {
  if (!name) return "Tool";
  const cleanName = name.includes("__") ? name.split("__").slice(1).join("__") : name;
  return cleanName
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatToolOutput(output?: unknown): string {
  if (output == null) return "";
  if (typeof output === "string") return output;
  return safeJsonStringify(output, "");
}

function getChipToneClasses(state?: ActivityItem["state"]) {
  if (state === "error") {
    return {
      chip: "border-(--err)/40 bg-(--err)/12 text-(--err)",
      dot: "bg-(--err)",
      detail: "border-(--err)/25 text-(--err)/85 bg-(--err)/[0.04]",
    };
  }
  if (state === "running") {
    return {
      chip: "border-(--accent)/45 bg-(--accent)/12 text-(--accent)",
      dot: "bg-(--accent) animate-pulse",
      detail: "border-(--accent)/25 text-(--fg)/80 bg-(--accent)/[0.04]",
    };
  }
  if (state === "complete") {
    return {
      chip: "border-(--fg)/30 bg-(--fg)/[0.06] text-(--fg)",
      dot: "bg-(--fg)/70",
      detail: "border-(--border)/60 text-(--fg)/80 bg-(--surface)/70",
    };
  }
  return {
    chip: "border-(--border) bg-(--surface)/80 text-(--dim)",
    dot: "bg-(--dim)/60",
    detail: "border-(--border)/60 text-(--fg)/75 bg-(--surface)/70",
  };
}

export const ToolItem = memo(
  function ToolItem({ item }: ToolItemProps) {
    const [expanded, setExpanded] = useState(false);
    const hasDetails = item.input != null || item.output != null;

    const toggleExpanded = useCallback(() => {
      if (!hasDetails) return;
      setExpanded((prev) => !prev);
    }, [hasDetails]);

    const toolName = useMemo(() => getToolDisplayName(item.toolName), [item.toolName]);
    const outputText = useMemo(
      () => (expanded ? formatToolOutput(item.output) : ""),
      [expanded, item.output],
    );
    const tone = useMemo(() => getChipToneClasses(item.state), [item.state]);

    return (
      <div className="flex flex-col items-start gap-1.5 pl-1">
        <button
          onClick={toggleExpanded}
          disabled={!hasDetails}
          className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium leading-4 transition-colors ${tone.chip} ${
            hasDetails ? "cursor-pointer hover:brightness-110" : "cursor-default"
          }`}
        >
          <span className={`inline-flex h-1 w-1 shrink-0 rounded-full ${tone.dot}`} />
          <span className="truncate max-w-[200px]">{toolName}</span>
          {hasDetails && (
            <ChevronRight
              className={`h-3 w-3 shrink-0 opacity-70 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          )}
        </button>

        {expanded && hasDetails && (
          <div
            className={`ml-2 w-[calc(100%-0.5rem)] rounded-md border px-2.5 py-2 space-y-2 ${tone.detail}`}
          >
            {item.input != null && (
              <div>
                <span className="text-[10px] uppercase tracking-wide text-(--dim)">Input</span>
                <pre className="mt-1 max-h-28 overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed">
                  {String(safeJsonStringify(item.input, ""))}
                </pre>
              </div>
            )}
            {outputText && (
              <div>
                <span className="text-[10px] uppercase tracking-wide text-(--dim)">
                  {item.state === "error" ? "Error" : "Output"}
                </span>
                <pre className="mt-1 max-h-44 overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed">
                  {outputText.slice(0, OUTPUT_PREVIEW_LIMIT)}
                  {outputText.length > OUTPUT_PREVIEW_LIMIT ? "..." : ""}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
  function areToolItemPropsEqual(prev, next) {
    const a = prev.item;
    const b = next.item;
    return (
      a.id === b.id &&
      a.type === b.type &&
      a.toolName === b.toolName &&
      a.state === b.state &&
      a.isActive === b.isActive &&
      a.content === b.content &&
      a.input === b.input &&
      a.output === b.output
    );
  },
);
