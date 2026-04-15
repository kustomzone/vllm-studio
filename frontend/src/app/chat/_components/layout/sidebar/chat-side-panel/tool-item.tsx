// CRITICAL
"use client";

import { ChevronRight } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import type { ActivityItem } from "@/app/chat/types";
import { safeJsonStringify } from "@/lib/safe-json";

const OUTPUT_LIMIT = 700;

function displayName(name?: string) {
  if (!name) return "Tool";
  const clean = name.includes("__") ? name.split("__").slice(1).join("__") : name;
  return clean
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatOutput(output?: unknown): string {
  if (output == null) return "";
  if (typeof output === "string") return output;
  return safeJsonStringify(output, "");
}

function dotClass(state?: ActivityItem["state"]) {
  if (state === "error") return "bg-(--err)";
  if (state === "running") return "bg-(--accent) animate-pulse";
  if (state === "complete") return "bg-(--fg)/30";
  return "bg-(--dim)/30";
}

export const ToolItem = memo(
  function ToolItem({ item, variant = "default" }: { item: ActivityItem; variant?: "default" | "embedded" }) {
    const [expanded, setExpanded] = useState(false);
    const hasDetails = item.input != null || item.output != null;
    const toggle = useCallback(() => {
      if (hasDetails) setExpanded((p) => !p);
    }, [hasDetails]);

    const name = useMemo(() => displayName(item.toolName), [item.toolName]);
    const output = useMemo(
      () => (expanded ? formatOutput(item.output) : ""),
      [expanded, item.output],
    );
    const dot = useMemo(() => dotClass(item.state), [item.state]);

    return (
      <div className={`flex flex-col items-start gap-1 ${variant === "embedded" ? "px-0" : "px-1"}`}>
        <button
          type="button"
          onClick={toggle}
          disabled={!hasDetails}
          className={`inline-flex max-w-full items-center gap-1.5 py-0.5 text-[10px] leading-4 transition-colors text-(--dim) ${
            hasDetails ? "cursor-pointer hover:text-(--fg)" : "cursor-default"
          }`}
        >
          {variant === "default" && <span className={`h-1 w-1 shrink-0 rounded-full ${dot}`} />}
          <span className={`truncate ${variant === "embedded" ? "max-w-[min(100%,220px)]" : "max-w-[180px]"}`}>
            {name}
          </span>
          {hasDetails && (
            <ChevronRight
              className={`h-2.5 w-2.5 shrink-0 opacity-60 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          )}
        </button>

        {expanded && hasDetails && (
          <div
            className={`w-[calc(100%-0.5rem)] rounded-lg px-2.5 py-2 space-y-1.5 bg-(--fg)/[0.02] ${
              variant === "embedded" ? "ml-0" : "ml-2"
            }`}
          >
            {item.input != null && (
              <div>
                <span className="text-[9px] uppercase tracking-wide text-(--dim)/50">Input</span>
                <pre className="mt-0.5 max-h-24 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-(--fg)/70">
                  {String(safeJsonStringify(item.input, ""))}
                </pre>
              </div>
            )}
            {output && (
              <div>
                <span className="text-[9px] uppercase tracking-wide text-(--dim)/50">
                  {item.state === "error" ? "Error" : "Output"}
                </span>
                <pre className="mt-0.5 max-h-36 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-(--fg)/70">
                  {output.slice(0, OUTPUT_LIMIT)}
                  {output.length > OUTPUT_LIMIT ? "..." : ""}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
  (prev, next) => {
    const a = prev.item,
      b = next.item;
    return (
      a.id === b.id &&
      a.state === b.state &&
      a.isActive === b.isActive &&
      a.content === b.content &&
      a.input === b.input &&
      a.output === b.output &&
      prev.variant === next.variant
    );
  },
);
