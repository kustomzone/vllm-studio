// CRITICAL
"use client";

import { useMemo, useState } from "react";
import api from "@/lib/api";
import { ApiError } from "@/lib/api/core";
import { useRealtimeStatus } from "@/hooks/use-realtime-status";
import { GpuLeaseModal, type GpuLeaseConflictPayload } from "@/components/runtimes/gpu-lease-modal";

export default function ImagesPage() {
  const realtime = useRealtimeStatus();
  const imageService = useMemo(
    () => (realtime.services ?? []).find((s) => s.id === "image") ?? null,
    [realtime.services],
  );

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [b64, setB64] = useState<string | null>(null);
  const [leaseConflict, setLeaseConflict] = useState<GpuLeaseConflictPayload | null>(null);

  const run = async (opts?: { mode?: "strict" | "best_effort"; replace?: boolean }) => {
    setBusy(true);
    setError(null);
    setLeaseConflict(null);
    try {
      const res = await api.generateImage({
        prompt,
        ...(model.trim() ? { model: model.trim() } : {}),
        ...(opts?.mode ? { mode: opts.mode } : {}),
        ...(opts?.replace ? { replace: true } : {}),
      });
      const img = res.data?.[0]?.b64_json ?? null;
      setB64(img || null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const body = e.body as Partial<GpuLeaseConflictPayload> & Record<string, unknown>;
        if (body && body["code"] === "gpu_lease_conflict") {
          setLeaseConflict(body as GpuLeaseConflictPayload);
          return;
        }
      }
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        <div className="border-b border-foreground/10 pb-4">
          <div className="text-xs uppercase tracking-widest text-foreground/40">Image Generation</div>
          <div className="mt-2 text-sm text-foreground/50 font-mono flex flex-wrap gap-2 items-center">
            <span>service: image</span>
            <span className="text-foreground/30">status: {imageService?.status ?? "unknown"}</span>
            {realtime.gpuLease && (
              <span className="text-foreground/30">gpu lease: {realtime.gpuLease.holder_service_id}</span>
            )}
          </div>
        </div>

        <div className="border border-foreground/10 p-4 space-y-3">
          <label className="block text-xs text-foreground/40 uppercase tracking-wider">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="a clean technical diagram..."
            className="w-full bg-transparent border border-foreground/10 p-2 text-sm focus:outline-none focus:border-foreground/30"
          />

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-foreground/40 uppercase tracking-wider">Model (optional)</label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="model.gguf"
                className="w-full bg-transparent border border-foreground/10 p-2 text-sm focus:outline-none focus:border-foreground/30"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => run({ mode: "strict" })}
                disabled={busy || !prompt.trim()}
                className="px-3 py-2 text-xs uppercase tracking-wider border border-foreground/10 hover:bg-foreground/[0.04] disabled:opacity-40"
              >
                {busy ? "generating..." : "generate"}
              </button>
            </div>
          </div>

          {error && (
            <div className="border border-(--error)/30 bg-(--error)/10 text-(--error) px-3 py-2 text-xs">
              {error}
            </div>
          )}
        </div>

        {b64 && (
          <div className="border border-foreground/10 p-4">
            <div className="text-xs uppercase tracking-widest text-foreground/40 mb-3">Result</div>
            <img
              src={`data:image/png;base64,${b64}`}
              alt="generated"
              className="w-full max-h-[640px] object-contain bg-black/10 border border-white/10"
            />
          </div>
        )}
      </div>

      {leaseConflict && (
        <GpuLeaseModal
          conflict={leaseConflict}
          onCancel={() => setLeaseConflict(null)}
          onReplace={() => run({ replace: true, mode: "strict" })}
          onBestEffort={() => run({ mode: "best_effort" })}
        />
      )}
    </div>
  );
}

