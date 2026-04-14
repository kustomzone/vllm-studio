// CRITICAL
"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Globe, Loader2, RotateCw } from "lucide-react";
import { sanitizeEmbeddedBrowserUrl } from "@/lib/sanitize-embedded-browser-url";

export interface ComputerEmbeddedBrowserProps {
  url: string;
  onUrlChange: (next: string) => void;
}

export const ComputerEmbeddedBrowser = memo(function ComputerEmbeddedBrowser({
  url,
  onUrlChange,
}: ComputerEmbeddedBrowserProps) {
  const [draft, setDraft] = useState(url);
  const [iframeNonce, setIframeNonce] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const safeSrc = useMemo(() => sanitizeEmbeddedBrowserUrl(url), [url]);

  useEffect(() => {
    setDraft(url);
  }, [url]);

  useEffect(() => {
    if (!safeSrc) {
      setIframeLoaded(false);
      return;
    }
    setIframeLoaded(false);
    // Many sites never fire onLoad when X-Frame-Options blocks framing — avoid an infinite spinner.
    const loadCap = window.setTimeout(() => setIframeLoaded(true), 28_000);
    return () => window.clearTimeout(loadCap);
  }, [safeSrc, iframeNonce]);

  const submitUrl = useCallback(() => {
    const s = sanitizeEmbeddedBrowserUrl(draft);
    if (!s) return;
    onUrlChange(s);
  }, [draft, onUrlChange]);

  const reload = useCallback(() => {
    if (!safeSrc) return;
    setIframeNonce((n) => n + 1);
  }, [safeSrc]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-(--border)/30 px-2 py-1.5">
        <button
          type="button"
          title="Reload frame"
          disabled={!safeSrc}
          onClick={reload}
          className="rounded p-1.5 text-(--dim) hover:bg-(--fg)/[0.06] hover:text-(--fg) disabled:opacity-30"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-md border border-(--border) bg-(--surface) px-2 py-1">
          <Globe className="h-3 w-3 shrink-0 text-(--dim)/50" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitUrl();
            }}
            placeholder="https://…"
            className="min-w-0 flex-1 bg-transparent text-[11px] text-(--fg) outline-none placeholder:text-(--dim)/40"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={submitUrl}
            className="shrink-0 rounded bg-(--surface-overlay) px-2 py-0.5 text-[10px] font-semibold text-(--fg) hover:bg-(--fg)/[0.08]"
          >
            Go
          </button>
        </div>
        {safeSrc ? (
          <a
            href={safeSrc}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in system browser"
            className="rounded p-1.5 text-(--dim) hover:bg-(--fg)/[0.06] hover:text-(--fg)"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>

      <div className="relative min-h-0 flex-1 bg-(--surface)/40">
        {!safeSrc ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-[12px] text-(--dim)">
            <Globe className="h-10 w-10 opacity-20" strokeWidth={1.25} />
            <p>Enter a public <span className="font-mono">http(s)</span> URL to preview here.</p>
            <p className="max-w-sm text-[11px] leading-snug text-(--dim)/70">
              Embedded preview uses the same browser engine as this app. Some sites block iframes
              (blank frame); use “Open in system browser”. Switching Computer tabs does not unload
              this frame while a URL is set, so long pages stay connected.{" "}
              <span className="font-mono">browser_open_url</span> opens this tab automatically.
            </p>
          </div>
        ) : (
          <>
            {!iframeLoaded && (
              <div className="absolute inset-0 z-[1] flex items-center justify-center bg-(--bg)/60">
                <Loader2 className="h-6 w-6 animate-spin text-(--dim)" />
              </div>
            )}
            <iframe
              key={`${safeSrc}-${iframeNonce}`}
              title="Computer browser"
              src={safeSrc}
              className="h-full w-full border-0"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => setIframeLoaded(true)}
            />
          </>
        )}
      </div>
    </div>
  );
});
