// CRITICAL
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { isParallaxEnabled } from "@/lib/features";

type ParallaxPayloadV1 = {
  v: 1;
  source: "local" | "hf";
  model_id: string;
  served_model_name?: string;
  pipeline_parallel?: "auto" | number;
};

const encodePayload = (payload: ParallaxPayloadV1): string => {
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const buildShareUrl = (payload: ParallaxPayloadV1): string => {
  const token = encodePayload(payload);
  return `${window.location.origin}/beta/parallax/share?p=${encodeURIComponent(token)}`;
};

export default function ParallaxBetaPage() {
  const enabled = isParallaxEnabled();

  const [source, setSource] = useState<ParallaxPayloadV1["source"]>("local");
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [localModel, setLocalModel] = useState<string>("");
  const [hfModel, setHfModel] = useState<string>("meta-llama/Meta-Llama-3.1-8B-Instruct");
  const [servedName, setServedName] = useState<string>("");
  const [shareUrl, setShareUrl] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.getOpenAIModels();
        const raw = (data as { data?: Array<{ id?: string }> }).data ?? [];
        const ids = raw
          .map((m) => (m?.id ?? "").trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
        if (cancelled) return;
        setLocalModels(ids);
        if (!localModel && ids.length > 0) setLocalModel(ids[0] ?? "");
      } catch {
        if (!cancelled) setLocalModels([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [localModel]);

  const payload = useMemo<ParallaxPayloadV1>(() => {
    const model_id = source === "local" ? localModel : hfModel.trim();
    const served_model_name = servedName.trim() || undefined;
    return {
      v: 1,
      source,
      model_id,
      served_model_name,
      pipeline_parallel: "auto",
    };
  }, [hfModel, localModel, servedName, source]);

  const canCreate = Boolean(enabled && payload.model_id.trim());

  const onCreateLink = useCallback(() => {
    if (!enabled) {
      setStatus("Parallax is disabled. Enable it in Chat Settings (Beta Features).");
      return;
    }
    if (!payload.model_id.trim()) return;
    const url = buildShareUrl(payload);
    setShareUrl(url);
    setStatus("Share link created.");
  }, [enabled, payload]);

  const onCopy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus("Copied to clipboard.");
    } catch {
      setStatus("Copy failed. Select the URL and copy manually.");
    }
  }, [shareUrl]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-xl font-semibold">Parallax (Beta)</div>
          <p className="text-sm text-[#9a9590] mt-1">
            Demo module inspired by GradientHQ/parallax: share model configs via link and guide install.
          </p>
        </div>
        <Link
          href="/beta"
          className="text-sm text-[#cfcac2] hover:text-white underline underline-offset-4"
        >
          Back
        </Link>
      </div>

      {!enabled && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Parallax is disabled. Enable it in Chat Settings: Beta Features.
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="grid gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider text-[#9a9590]">Source</span>
            <button
              onClick={() => setSource("local")}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                source === "local" ? "bg-white/10 border-white/15 text-white" : "bg-transparent border-white/10 text-[#cfcac2]"
              }`}
            >
              Local
            </button>
            <button
              onClick={() => setSource("hf")}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                source === "hf" ? "bg-white/10 border-white/15 text-white" : "bg-transparent border-white/10 text-[#cfcac2]"
              }`}
            >
              Hugging Face
            </button>
          </div>

          {source === "local" ? (
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#9a9590] mb-2">
                Local Model
              </label>
              <select
                value={localModel}
                onChange={(e) => setLocalModel(e.target.value)}
                className="w-full h-10 px-3 bg-black/20 border border-white/10 rounded-lg text-sm focus:outline-none"
              >
                {localModels.length === 0 ? (
                  <option value="">No models detected</option>
                ) : (
                  localModels.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))
                )}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#9a9590] mb-2">
                Hugging Face Model ID
              </label>
              <input
                value={hfModel}
                onChange={(e) => setHfModel(e.target.value)}
                placeholder="org/repo"
                className="w-full h-10 px-3 bg-black/20 border border-white/10 rounded-lg text-sm focus:outline-none"
              />
              <p className="text-xs text-[#9a9590] mt-2">
                Install uses the existing Downloads pipeline and queue.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs uppercase tracking-wider text-[#9a9590] mb-2">
              Served Model Name (Optional)
            </label>
            <input
              value={servedName}
              onChange={(e) => setServedName(e.target.value)}
              placeholder="e.g. llama31-8b"
              className="w-full h-10 px-3 bg-black/20 border border-white/10 rounded-lg text-sm focus:outline-none"
            />
          </div>

          <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
            <div className="text-xs uppercase tracking-wider text-[#9a9590] mb-2">Defaults</div>
            <div className="text-sm text-[#cfcac2]">
              <div>Pipeline parallelism: auto</div>
              <div>Scheduling: managed by controller services</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onCreateLink}
              disabled={!canCreate}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/10 hover:bg-white/15 transition-colors disabled:opacity-50"
            >
              Create Share Link
            </button>
            {status && <span className="text-sm text-[#9a9590]">{status}</span>}
          </div>

          {shareUrl && (
            <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-xs uppercase tracking-wider text-[#9a9590] mb-2">Share URL</div>
              <div className="flex items-center gap-2">
                <input
                  value={shareUrl}
                  readOnly
                  className="flex-1 h-10 px-3 bg-black/20 border border-white/10 rounded-lg text-xs font-mono text-[#e8e4dd] focus:outline-none"
                />
                <button
                  onClick={onCopy}
                  className="h-10 px-3 rounded-lg bg-white/10 border border-white/10 hover:bg-white/15 transition-colors text-sm"
                >
                  Copy
                </button>
              </div>
              <div className="text-xs text-[#9a9590] mt-2">
                Anyone with the link can open the installer page (no secrets included).
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

