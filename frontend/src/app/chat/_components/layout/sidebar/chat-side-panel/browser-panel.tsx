// CRITICAL
"use client";

import { memo } from "react";
import type { ActivityGroup } from "@/app/chat/types";
import { categorize } from "./tool-categorization";
import { safeJsonStringify } from "@/lib/safe-json";

function extractUrl(input: unknown): string | null {
  if (!input) return null;
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return extractUrl(parsed);
    } catch {
      return input.startsWith("http") ? input : null;
    }
  }
  if (typeof input === "object" && input !== null) {
    const obj = input as Record<string, unknown>;
    const candidate = obj.url ?? obj.query ?? obj.search_query ?? obj.q;
    if (typeof candidate === "string") return candidate;
  }
  return null;
}

function extractOutput(output: unknown): string {
  if (!output) return "";
  if (typeof output === "string") return output.slice(0, 300);
  return safeJsonStringify(output, "").slice(0, 300);
}

interface BrowserPanelProps {
  activityGroups: ActivityGroup[];
  isLoading?: boolean;
}

export const BrowserPanel = memo(function BrowserPanel({
  activityGroups,
  isLoading,
}: BrowserPanelProps) {
  const webItems = activityGroups.flatMap((g) =>
    g.items.filter((i) => i.type !== "thinking" && categorize(i.toolName) === "web"),
  );

  if (webItems.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-5">
        <p className="text-[11px] text-(--dim)/40">
          {isLoading ? "Waiting for web activity…" : "No browser activity yet"}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-3 py-2.5 space-y-2">
        {webItems.map((item) => {
          const url = extractUrl(item.input);
          const snippet = extractOutput(item.output);
          const label = url ?? item.toolName ?? "Request";
          const isRunning = item.state === "running";
          const isError = item.state === "error";

          return (
            <div key={item.id} className="space-y-1">
              <div className="flex items-start gap-2">
                <span
                  className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                    isRunning
                      ? "bg-(--accent) animate-pulse"
                      : isError
                        ? "bg-(--err)"
                        : "bg-(--fg)/30"
                  }`}
                />
                <div className="min-w-0">
                  <p
                    className={`text-[11px] font-mono break-all leading-snug ${
                      isError ? "text-(--err)" : isRunning ? "text-(--accent)" : "text-(--fg)/80"
                    }`}
                  >
                    {label}
                  </p>
                  {snippet && item.state === "complete" && (
                    <p className="mt-0.5 text-[10px] text-(--dim)/60 line-clamp-2 leading-snug">
                      {snippet}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
