// CRITICAL
"use client";

import { ExternalLink, Globe, RefreshCcw } from "lucide-react";
import { useMemo, useState } from "react";
import type { ActivityGroup } from "@/app/chat/types";
import { extractBrowserActivityEntries } from "./browser-computer-data";

interface BrowserPanelProps {
  activityGroups: ActivityGroup[];
}

const STATE_TONE: Record<string, string> = {
  running: "text-(--accent)",
  complete: "text-(--fg)",
  error: "text-(--err)",
  pending: "text-(--dim)",
};

const labelFromTool = (toolName: string): string =>
  toolName
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const shortUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
};

export function BrowserPanel({ activityGroups }: BrowserPanelProps) {
  const entries = useMemo(
    () => extractBrowserActivityEntries(activityGroups),
    [activityGroups],
  );
  const [selectedUrlOverride, setSelectedUrlOverride] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const selectedUrl = useMemo(() => {
    if (entries.length === 0) return null;
    if (selectedUrlOverride && entries.some((entry) => entry.url === selectedUrlOverride)) {
      return selectedUrlOverride;
    }
    return entries[0]?.url ?? null;
  }, [entries, selectedUrlOverride]);

  if (entries.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-5">
        <div className="max-w-xs text-center">
          <p className="text-xl leading-tight text-(--fg)/80">No browser activity yet</p>
          <p className="mt-2 text-base leading-snug text-(--dim)">
            Ask the model to run <code className="text-(--fg)">browser_open_url</code> and URLs will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 pt-3 pb-2 border-b border-(--border)/40">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-(--dim)">Backend browser target</p>
            <p className="text-xs text-(--fg) truncate">{selectedUrl ?? "No URL selected"}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setReloadNonce((prev) => prev + 1)}
              className="p-1.5 rounded-md text-(--dim) hover:text-(--fg) hover:bg-(--fg)/[0.06]"
              title="Reload panel browser"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </button>
            {selectedUrl && (
              <a
                href={selectedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md text-(--dim) hover:text-(--fg) hover:bg-(--fg)/[0.06]"
                title="Open in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-(--border)/40 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {entries.map((entry) => {
            const active = entry.url === selectedUrl;
            const tone = STATE_TONE[entry.state ?? "pending"] ?? "text-(--dim)";
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedUrlOverride(entry.url)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] border transition-colors ${
                  active
                    ? "border-(--accent)/60 bg-(--accent)/10 text-(--fg)"
                    : "border-(--border)/50 text-(--dim) hover:text-(--fg) hover:border-(--fg)/20"
                }`}
                title={`${labelFromTool(entry.toolName)} • ${entry.turnTitle}`}
              >
                <Globe className={`h-3.5 w-3.5 ${tone}`} />
                <span className="max-w-[180px] truncate">{shortUrl(entry.url)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative flex-1 bg-black/20">
        {selectedUrl ? (
          <iframe
            key={`${selectedUrl}:${reloadNonce}`}
            src={selectedUrl}
            title="Sidepanel browser"
            className="absolute inset-0 h-full w-full border-0"
            sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="h-full flex items-center justify-center text-(--dim) text-sm">
            Select a URL to preview
          </div>
        )}
      </div>
    </div>
  );
}
