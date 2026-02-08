// CRITICAL
"use client";

import { useState } from "react";
import api from "@/lib/api";
import { JobsPanel } from "@/components/jobs/jobs-panel";
import { useRealtimeStatus } from "@/hooks/use-realtime-status";
import type { JobRecord } from "@/lib/types";

export default function JobsPage() {
  const { jobs } = useRealtimeStatus() as { jobs: JobRecord[] };

  const [text, setText] = useState("Hello from Jobs");
  const [ttsModel, setTtsModel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startVoiceJob = async () => {
    setError(null);
    setCreating(true);
    try {
      await api.createJob({
        type: "voice_assistant_turn",
        input: {
          text,
          tts_model: ttsModel || null,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="border border-(--border) bg-(--card) rounded-xl p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-lg font-semibold">Jobs</h1>
          <div className="text-xs text-(--muted-foreground) font-mono">orchestration</div>
        </div>

        <div className="mt-3 grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-(--muted-foreground)">Text</span>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="px-3 py-2 rounded-lg bg-transparent border border-(--border) text-sm"
              placeholder="Say something"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-(--muted-foreground)">TTS Model (models_dir/tts)</span>
            <input
              value={ttsModel}
              onChange={(e) => setTtsModel(e.target.value)}
              className="px-3 py-2 rounded-lg bg-transparent border border-(--border) text-sm font-mono"
              placeholder="example: en_US-amy.onnx"
            />
          </label>

          {error && <div className="text-xs text-(--error)">Error: {error}</div>}

          <div className="flex items-center gap-2">
            <button
              onClick={startVoiceJob}
              disabled={creating || !text.trim()}
              className="px-3 py-2 rounded-lg bg-[#e8e4dd] text-[#1a1918] text-xs uppercase tracking-wider disabled:opacity-50"
            >
              {creating ? "Starting..." : "Start Voice Job"}
            </button>
            <div className="text-xs text-(--muted-foreground)">
              Requires controller STT/TTS integrations (external CLIs).
            </div>
          </div>
        </div>
      </div>

      <JobsPanel jobs={jobs ?? []} />
    </div>
  );
}
