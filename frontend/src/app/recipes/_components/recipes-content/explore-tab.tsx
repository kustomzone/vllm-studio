"use client";

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  DownloadCloud,
  ExternalLink,
  Heart,
  Pause,
  Play,
  RefreshCw,
  Search,
} from "lucide-react";
import type { HuggingFaceModel, ModelDownload } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";
import { extractProvider, extractQuantizations } from "@/app/discover/_components/utils";
import { useExplore } from "./use-explore";
import { useDownloads } from "@/hooks/use-downloads";
import api from "@/lib/api";

const ModelRow = memo(function ModelRow({
  model,
  isLocal,
  activeDownload,
  onStartDownload,
  onPauseDownload,
  onResumeDownload,
  variantCount,
  expanded,
  onToggleExpand,
  child,
}: {
  model: HuggingFaceModel;
  isLocal: boolean;
  activeDownload: ModelDownload | null;
  onStartDownload: (id: string) => void;
  onPauseDownload: (id: string) => void;
  onResumeDownload: (id: string) => void;
  variantCount: number;
  expanded: boolean;
  onToggleExpand?: () => void;
  child?: boolean;
}) {
  const provider = useMemo(() => extractProvider(model.modelId), [model.modelId]);
  const quants = useMemo(() => extractQuantizations(model.tags), [model.tags]);
  const [copied, setCopied] = useState(false);

  const copyId = useCallback(() => {
    navigator.clipboard.writeText(model.modelId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [model.modelId]);

  return (
    <tr className={child ? "bg-(--surface)/10" : ""}>
      <td className="px-4 py-3">
        <div className={`flex items-center gap-2 ${child ? "pl-5" : ""}`}>
          {variantCount > 1 && !child && onToggleExpand && (
            <button onClick={onToggleExpand} className="p-1 hover:bg-(--surface) rounded shrink-0">
              {expanded ? <ChevronDown className="h-3.5 w-3.5 text-(--dim)" /> : <ChevronRight className="h-3.5 w-3.5 text-(--dim)" />}
            </button>
          )}
          <span className="text-sm text-(--fg) truncate max-w-[280px]" title={model.modelId}>
            {model.modelId}
          </span>
          <button onClick={copyId} className="p-0.5 hover:bg-(--surface) rounded shrink-0">
            {copied ? <Check className="h-3 w-3 text-(--hl2)" /> : <Copy className="h-3 w-3 text-(--dim)" />}
          </button>
        </div>
        {!child && variantCount > 1 && (
          <div className="text-[11px] text-(--dim) mt-0.5 pl-7">{variantCount} variants</div>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-(--dim)">{provider}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {quants.length > 0 ? quants.map((q) => (
            <span key={q} className="px-1.5 py-0.5 bg-(--surface) border border-(--border) rounded text-[11px] text-(--dim)">{q}</span>
          )) : <span className="text-xs text-(--dim)">—</span>}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-3 text-xs text-(--dim)">
          <span className="flex items-center gap-1"><Download className="h-3 w-3" />{formatNumber(model.downloads)}</span>
          <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{formatNumber(model.likes)}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        {isLocal ? (
          <span className="inline-flex items-center gap-1 text-xs text-(--hl2)"><CheckCircle2 className="h-3.5 w-3.5" />Local</span>
        ) : activeDownload ? (
          <div className="flex items-center justify-end gap-1">
            {activeDownload.status === "downloading" && (
              <button onClick={() => onPauseDownload(activeDownload.id)} className="p-1 rounded border border-(--border) hover:bg-(--surface)" title="Pause">
                <Pause className="h-3.5 w-3.5" />
              </button>
            )}
            {(activeDownload.status === "paused" || activeDownload.status === "failed") && (
              <button onClick={() => onResumeDownload(activeDownload.id)} className="p-1 rounded border border-(--border) hover:bg-(--surface)" title="Resume">
                <Play className="h-3.5 w-3.5" />
              </button>
            )}
            {activeDownload.status === "completed" && <span className="text-xs text-(--hl2)">Done</span>}
            {(activeDownload.status === "downloading" || activeDownload.status === "queued") && <span className="text-xs text-(--dim)">…</span>}
          </div>
        ) : (
          <button
            onClick={() => onStartDownload(model.modelId)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--hl1) text-white text-xs font-medium hover:opacity-90"
          >
            <DownloadCloud className="h-3.5 w-3.5" />
            Download
          </button>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <a
          href={`https://huggingface.co/${model.modelId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 hover:bg-(--surface) rounded inline-block text-(--dim) hover:text-(--fg)"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </td>
    </tr>
  );
});

export function ExploreTab() {
  const { groups, maxVramGb, loading, error, search, hasMore, setSearch, loadMore, refresh } = useExplore();
  const { downloads, downloadsByModel, startDownload, pauseDownload, resumeDownload } = useDownloads();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [localModelIds, setLocalModelIds] = useState<Set<string>>(new Set());
  const completedSet = useRef<Set<string>>(new Set());

  // Load local models
  useEffect(() => {
    (async () => {
      try {
        const data = await api.getModels();
        const ids = new Set<string>();
        for (const m of data.models || []) {
          ids.add(m.name.toLowerCase());
          for (const part of m.path.split("/")) {
            if (part) ids.add(part.toLowerCase());
          }
        }
        setLocalModelIds(ids);
      } catch {}
    })();
  }, []);

  // Refresh local models on download completion
  useEffect(() => {
    let shouldRefresh = false;
    for (const d of downloads) {
      if (d.status === "completed" && !completedSet.current.has(d.id)) {
        completedSet.current.add(d.id);
        shouldRefresh = true;
      }
    }
    if (shouldRefresh) {
      (async () => {
        try {
          const data = await api.getModels();
          const ids = new Set<string>();
          for (const m of data.models || []) {
            ids.add(m.name.toLowerCase());
            for (const part of m.path.split("/")) {
              if (part) ids.add(part.toLowerCase());
            }
          }
          setLocalModelIds(ids);
        } catch {}
      })();
    }
  }, [downloads]);

  const isLocal = useCallback(
    (modelId: string) => localModelIds.has(modelId.toLowerCase()) || modelId.toLowerCase().split("/").some((p) => localModelIds.has(p)),
    [localModelIds],
  );

  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const handleStartDownload = useCallback(
    async (modelId: string) => { await startDownload({ model_id: modelId }); },
    [startDownload],
  );

  const handlePause = useCallback(
    async (id: string) => { await pauseDownload(id); },
    [pauseDownload],
  );

  const handleResume = useCallback(
    async (id: string) => { await resumeDownload(id); },
    [resumeDownload],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Search + VRAM badge */}
      <div className="px-4 py-3 border-b border-(--border) flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--dim)" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models on HuggingFace…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-(--surface) border border-(--border) rounded-lg text-(--fg) placeholder:text-(--dim) focus:outline-none focus:ring-1 focus:ring-(--hl1)"
          />
        </div>
        {maxVramGb > 0 && (
          <span className="text-xs px-2.5 py-1.5 rounded-md bg-(--surface) border border-(--border) text-(--dim)">
            {Math.round(maxVramGb)} GB pooled VRAM
          </span>
        )}
        <button onClick={refresh} className="p-2 hover:bg-(--surface) rounded-lg text-(--dim) hover:text-(--fg)" title="Refresh">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="p-4 text-center text-(--err) text-sm">{error}</div>
        )}

        {loading && groups.length === 0 && (
          <div className="flex items-center justify-center py-16 text-(--dim)">
            <RefreshCw className="h-5 w-5 animate-spin" />
          </div>
        )}

        {!loading && !error && groups.length === 0 && (
          <div className="py-16 text-center text-(--dim)">
            <p>No models found</p>
            <p className="text-sm mt-1">Try a different search</p>
          </div>
        )}

        {groups.length > 0 && (
          <>
            <div className="px-4 pt-3 pb-1 text-xs text-(--dim)">
              {groups.length} models — sorted by popularity
            </div>
            <table className="w-full">
              <thead className="bg-(--surface) border-b border-(--border)">
                <tr>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-(--dim) uppercase tracking-wider">Model</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-(--dim) uppercase tracking-wider">Provider</th>
                  <th className="px-4 py-2 text-left text-[11px] font-medium text-(--dim) uppercase tracking-wider">Format</th>
                  <th className="px-4 py-2 text-right text-[11px] font-medium text-(--dim) uppercase tracking-wider">Stats</th>
                  <th className="px-4 py-2 text-right text-[11px] font-medium text-(--dim) uppercase tracking-wider">Action</th>
                  <th className="px-4 py-2 text-right text-[11px] font-medium text-(--dim) uppercase tracking-wider w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border)">
                {groups.map((group) => {
                  const expanded = expandedKeys.has(group.key);
                  return [
                    <ModelRow
                      key={group.key}
                      model={group.lead}
                      isLocal={isLocal(group.lead.modelId)}
                      activeDownload={downloadsByModel.get(group.lead.modelId) ?? null}
                      onStartDownload={handleStartDownload}
                      onPauseDownload={handlePause}
                      onResumeDownload={handleResume}
                      variantCount={group.variants.length}
                      expanded={expanded}
                      onToggleExpand={group.variants.length > 1 ? () => toggleExpand(group.key) : undefined}
                    />,
                    ...(expanded
                      ? group.variants.slice(1).map((variant) => (
                          <ModelRow
                            key={variant._id}
                            model={variant}
                            isLocal={isLocal(variant.modelId)}
                            activeDownload={downloadsByModel.get(variant.modelId) ?? null}
                            onStartDownload={handleStartDownload}
                            onPauseDownload={handlePause}
                            onResumeDownload={handleResume}
                            variantCount={1}
                            expanded={false}
                            child
                          />
                        ))
                      : []),
                  ];
                })}
              </tbody>
            </table>

            {hasMore && (
              <div className="py-6 text-center">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-4 py-2 bg-(--surface) border border-(--border) rounded-lg text-sm text-(--fg) hover:bg-(--surface) disabled:opacity-50"
                >
                  {loading ? "Loading…" : "Load More"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
