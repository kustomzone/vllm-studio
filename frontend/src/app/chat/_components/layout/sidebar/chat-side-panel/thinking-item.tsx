// CRITICAL
"use client";

import { memo, useCallback, useMemo, useState } from "react";

const PREVIEW_LIMIT = 200;

interface ThinkingItemProps {
  content?: string;
  isActive?: boolean;
  /** Hides the left dot row; use inside a parent timeline (e.g. current turn). */
  variant?: "default" | "embedded";
}

export const ThinkingItem = memo(
  function ThinkingItem({ content, isActive, variant = "default" }: ThinkingItemProps) {
    const [expanded, setExpanded] = useState(false);
    const toggle = useCallback(() => setExpanded((p) => !p), []);

    const text = useMemo(() => (content ?? "").trim(), [content]);
    const compact = useMemo(() => text.replace(/\s+/g, " "), [text]);
    const truncated = compact.length > PREVIEW_LIMIT;
    const display = expanded || !truncated ? text : compact.slice(0, PREVIEW_LIMIT);

    const body = (
      <div className="min-w-0 flex-1">
        {text ? (
          <p
            className={`text-[11px] leading-relaxed break-words whitespace-pre-wrap ${
              variant === "embedded"
                ? isActive
                  ? "text-(--fg)/75"
                  : "text-(--dim)/65"
                : isActive
                  ? "text-(--fg)/80"
                  : "text-(--dim)/70"
            }`}
          >
            {display}
            {!expanded && truncated ? "…" : ""}
          </p>
        ) : (
          <p className="text-[11px] text-(--dim)/60">Thinking…</p>
        )}
        {text && truncated && (
          <button
            type="button"
            onClick={toggle}
            className="mt-0.5 text-[10px] text-(--dim)/50 hover:text-(--fg) transition-colors"
          >
            {expanded ? "less" : "more"}
          </button>
        )}
      </div>
    );

    if (variant === "embedded") {
      return <div className="min-w-0 px-0">{body}</div>;
    }

    return (
      <div className="flex items-start gap-2 px-1">
        <span
          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
            isActive ? "bg-(--hl2) animate-pulse" : "bg-(--dim)/30"
          }`}
        />
        {body}
      </div>
    );
  },
  (prev, next) =>
    prev.content === next.content &&
    prev.isActive === next.isActive &&
    prev.variant === next.variant,
);
