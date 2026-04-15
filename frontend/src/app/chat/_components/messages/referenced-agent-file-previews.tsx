// CRITICAL
"use client";

import { ChevronDown, ChevronRight, FileCode2, Loader2 } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import type { AgentFileEntry } from "@/lib/types";
import { joinAgentBrowsePath } from "@/app/chat/hooks/agent/use-agent-files";
import {
  extractReferencedAgentPaths,
  flattenAgentFilePaths,
  resolveReferenceToKnownPath,
} from "./referenced-agent-paths";

/** Avoid locking the main thread on accidental huge/binary-as-text reads; full file still opens in workspace. */
const PREVIEW_CHAR_SAFETY_CAP = 1_250_000;

export interface ReferencedAgentFilePreviewsProps {
  text: string;
  agentFiles: AgentFileEntry[];
  agentFilesBrowsePath: string;
  sessionId: string | null;
  onOpenFile: (relativePath: string) => void;
}

export const ReferencedAgentFilePreviews = memo(function ReferencedAgentFilePreviews({
  text,
  agentFiles,
  agentFilesBrowsePath,
  sessionId,
  onOpenFile,
}: ReferencedAgentFilePreviewsProps) {
  const knownPaths = useMemo(() => flattenAgentFilePaths(agentFiles), [agentFiles]);
  const refs = useMemo(() => {
    const raw = extractReferencedAgentPaths(text);
    const resolved: { ref: string; path: string }[] = [];
    const seen = new Set<string>();
    for (const ref of raw) {
      const path = resolveReferenceToKnownPath(ref, knownPaths);
      if (!path || seen.has(path)) continue;
      seen.add(path);
      resolved.push({ ref, path });
      if (resolved.length >= 6) break;
    }
    return resolved;
  }, [knownPaths, text]);

  if (!sessionId || refs.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {refs.map(({ ref, path }) => (
        <ReferencedFileRow
          key={path}
          label={ref.length > 42 ? `${ref.slice(0, 20)}…${ref.slice(-18)}` : ref}
          apiPath={joinAgentBrowsePath(agentFilesBrowsePath, path)}
          path={path}
          sessionId={sessionId}
          onOpenFile={onOpenFile}
        />
      ))}
    </div>
  );
});

const ReferencedFileRow = memo(function ReferencedFileRow({
  label,
  apiPath,
  path,
  sessionId,
  onOpenFile,
}: {
  label: string;
  apiPath: string;
  path: string;
  sessionId: string;
  onOpenFile: (relativePath: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.readAgentFile(sessionId, apiPath);
      const c = typeof data.content === "string" ? data.content : "";
      if (c.length > PREVIEW_CHAR_SAFETY_CAP) {
        setPreview(
          `${c.slice(0, PREVIEW_CHAR_SAFETY_CAP)}\n\n— Preview truncated (${c.length.toLocaleString()} chars). Open in workspace for the full file.`,
        );
      } else {
        setPreview(c);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load file");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [apiPath, sessionId]);

  useEffect(() => {
    if (open && preview === null && !loading && !error) void load();
  }, [open, preview, loading, error, load]);

  const toggle = useCallback(() => setOpen((o) => !o), []);

  return (
    <div className="rounded-lg border border-(--border)/35 bg-(--fg)/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] text-(--fg)/80 hover:bg-(--fg)/[0.04] transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-(--dim)/50" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-(--dim)/50" />
        )}
        <FileCode2 className="h-3.5 w-3.5 shrink-0 text-(--hl2)/80" />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{label}</span>
        {loading ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-(--dim)/50" /> : null}
      </button>
      {open && (
        <div className="border-t border-(--border)/25 px-2.5 pb-2 pt-1">
          {error ? (
            <p className="text-[11px] text-(--err)/90">{error}</p>
          ) : preview != null ? (
            <pre className="message-content max-h-[min(85vh,120rem)] overflow-auto whitespace-pre-wrap break-words rounded-md bg-(--surface) px-2 py-2 font-mono text-[14px] leading-[1.65] text-(--fg)">
              {preview}
            </pre>
          ) : loading ? (
            <p className="text-[10px] text-(--dim)/60">Loading…</p>
          ) : null}
          <button
            type="button"
            onClick={() => onOpenFile(path)}
            className="mt-1.5 text-[10px] font-medium text-(--accent) hover:underline"
          >
            Open in workspace
          </button>
        </div>
      )}
    </div>
  );
});
