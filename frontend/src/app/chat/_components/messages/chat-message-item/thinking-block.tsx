// CRITICAL
"use client";

import { memo, useCallback, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";

interface ThinkingBlockProps {
  content: string;
  isActive: boolean;
}

export const ThinkingBlock = memo(function ThinkingBlock({ content, isActive }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(isActive);
  const toggle = useCallback(() => setExpanded(p => !p), []);

  if (!content && !isActive) return null;

  return (
    <div className="mb-2">
      <button onClick={toggle} className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-(--fg)/[0.03] transition-colors w-full text-left">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-(--fg) animate-pulse" : "bg-(--dim)/50"}`} />
        <span className={`text-[12px] flex-1 ${isActive ? "text-(--fg) font-medium" : "text-(--dim)"}`}>
          {isActive ? "Thinking..." : "Thought for a few seconds"}
        </span>
        {isActive && <Loader2 className="w-3 h-3 text-(--dim) animate-spin shrink-0" />}
        <ChevronRight className={`w-3 h-3 text-(--dim) shrink-0 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ease-out ${expanded ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="ml-[22px] mt-1 pl-3 border-l-2 border-(--border) text-[12px] leading-[1.7] text-(--dim) overflow-y-auto max-h-[280px]">
          <p className="whitespace-pre-wrap break-words">
            {content}
            {isActive && <span className="inline-block w-px h-3 bg-(--fg) animate-[blink_1s_step-end_infinite] align-middle ml-0.5" />}
          </p>
        </div>
      </div>
    </div>
  );
});
