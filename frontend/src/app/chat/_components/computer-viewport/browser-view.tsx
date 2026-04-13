// CRITICAL
"use client";

import { memo, useMemo } from "react";
import type { CurrentToolCall } from "@/app/chat/hooks/chat/use-current-tool-call";
import { safeJsonStringify } from "@/lib/safe-json";

function extractUrl(tc: CurrentToolCall): string {
  const inp = tc.input;
  if (typeof inp === "string" && inp.startsWith("http")) return inp;
  if (inp && typeof inp === "object") {
    const o = inp as Record<string, unknown>;
    for (const k of ["url", "href", "query", "search_query", "q", "search"]) {
      if (typeof o[k] === "string") return o[k] as string;
    }
  }
  return tc.target ?? "";
}

function fmt(output: unknown): string {
  if (output == null) return "";
  if (typeof output === "string") return output;
  return safeJsonStringify(output, "");
}

export const BrowserView = memo(function BrowserView({ toolCall }: { toolCall: CurrentToolCall }) {
  const url = useMemo(() => extractUrl(toolCall), [toolCall]);
  const output = useMemo(() => fmt(toolCall.output), [toolCall.output]);
  const running = toolCall.state === "running";
  const isSearch = toolCall.category === "search";
  const domainMatch = url.match(/^https?:\/\/([^/]+)(.*)/);
  const domain = domainMatch?.[1] ?? url;
  const path = domainMatch?.[2] ?? "";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-(--border)/30 px-4 py-2 shrink-0">
        <div className="flex-1 px-2.5 py-1 bg-(--fg)/[0.03] border border-(--border) rounded-md font-mono text-[11px] text-(--dim) truncate">
          {domain ? <><span className="text-(--fg)/70">{domain}</span><span>{path}</span></> : <span className="text-(--dim)/40">{isSearch ? "searching..." : "loading..."}</span>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {output ? (
          <div className="px-5 py-4 text-[12px] leading-[1.7]">
            {isSearch && url && !url.startsWith("http") && (
              <div className="mb-4 pb-3 border-b border-(--border)/20">
                <span className="text-[10px] font-mono uppercase text-(--dim)/40 tracking-wider">Search query</span>
                <p className="mt-1 text-[13px] font-medium text-(--fg)">{url}</p>
              </div>
            )}
            <pre className="whitespace-pre-wrap break-words text-(--dim)/80 font-mono text-[11px] leading-[1.7]">{output.slice(0, 4000)}{output.length > 4000 ? "\n..." : ""}</pre>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 opacity-20">
              <svg className="w-8 h-8 text-(--dim)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <p className="font-mono text-[11px] text-(--dim)">{running ? "Loading..." : "No content"}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
