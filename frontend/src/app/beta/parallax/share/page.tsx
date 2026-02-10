// CRITICAL
"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { isParallaxEnabled } from "@/lib/features";

type ParallaxPayloadV1 = {
  v: 1;
  source: "local" | "hf";
  model_id: string;
  served_model_name?: string;
  pipeline_parallel?: "auto" | number;
  rpc_workers?: string;
};

const decodePayload = (token: string): ParallaxPayloadV1 | null => {
  try {
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((token.length + 3) % 4);
    const json = decodeURIComponent(escape(atob(b64)));
    const parsed = JSON.parse(json) as ParallaxPayloadV1;
    if (!parsed || parsed.v !== 1) return null;
    if (parsed.source !== "local" && parsed.source !== "hf") return null;
    if (typeof parsed.model_id !== "string" || !parsed.model_id.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
};

export default function ParallaxSharePage() {
  const enabled = isParallaxEnabled();
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("p") ?? "";
  const payload = useMemo(() => (token ? decodePayload(token) : null), [token]);

  const [status, setStatus] = useState<string>("");
  const [installing, setInstalling] = useState<boolean>(false);

  const onInstall = useCallback(async () => {
    if (!payload) return;
    if (payload.source !== "hf") {
      setStatus("Local model selected. Nothing to install.");
      return;
    }
    const modelId = payload.model_id.trim();
    if (!modelId) return;

    setInstalling(true);
    setStatus("");
    try {
      await api.startDownload({ model_id: modelId });
      setStatus("Download started. Opening Discover...");
      window.setTimeout(() => router.push("/discover"), 600);
    } catch (err) {
      setStatus(`Install failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setInstalling(false);
    }
  }, [payload, router]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-xl font-semibold">Install From Share Link</div>
          <p className="text-sm text-[#9a9590] mt-1">
            Parallax-like demo installer page.
          </p>
        </div>
        <Link
          href="/beta/parallax"
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

      {!payload ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm font-medium">Invalid share link</div>
          <div className="text-xs text-[#9a9590] mt-1">
            The payload could not be decoded.
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-wider text-[#9a9590] mb-2">Details</div>
          <div className="text-sm text-[#cfcac2] space-y-1">
            <div>Source: {payload.source === "hf" ? "Hugging Face" : "Local"}</div>
            <div>Model: {payload.model_id}</div>
            <div>Served name: {payload.served_model_name ?? "(default)"}</div>
            <div>Pipeline parallelism: {payload.pipeline_parallel ?? "auto"}</div>
            <div>RPC workers: {payload.rpc_workers ?? "(none)"}</div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={onInstall}
              disabled={!enabled || installing}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/10 hover:bg-white/15 transition-colors disabled:opacity-50"
            >
              {payload.source === "hf" ? (installing ? "Installing..." : "Install") : "Done"}
            </button>
            {status && <span className="text-sm text-[#9a9590]">{status}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
