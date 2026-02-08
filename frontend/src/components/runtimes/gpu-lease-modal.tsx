// CRITICAL
"use client";

import type { ServiceId } from "@/lib/types";

export type GpuLeaseConflictPayload = {
  code: "gpu_lease_conflict";
  requested_service: { id: ServiceId };
  holder_service: { id: ServiceId };
};

export function GpuLeaseModal({
  conflict,
  onCancel,
  onReplace,
  onBestEffort,
}: {
  conflict: GpuLeaseConflictPayload;
  onCancel: () => void;
  onReplace: () => void;
  onBestEffort: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg border border-foreground/10 bg-[#141414] p-4">
        <div className="text-xs uppercase tracking-widest text-foreground/40 mb-2">GPU Lease Conflict</div>
        <div className="text-sm text-foreground/80">
          <div>
            <span className="text-foreground/40">Requested:</span>{" "}
            <span className="font-mono">{conflict.requested_service.id}</span>
          </div>
          <div className="mt-1">
            <span className="text-foreground/40">Currently holding GPU:</span>{" "}
            <span className="font-mono">{conflict.holder_service.id}</span>
          </div>
        </div>

        <div className="mt-3 text-xs text-foreground/40">
          Strict mode blocks GPU contention. Best-effort may fail or OOM.
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs border border-foreground/10 text-foreground/60 hover:bg-foreground/[0.04]"
          >
            cancel
          </button>
          <button
            onClick={onBestEffort}
            className="px-3 py-1.5 text-xs border border-foreground/10 text-foreground/70 hover:bg-foreground/[0.04]"
          >
            best-effort
          </button>
          <button
            onClick={onReplace}
            className="px-3 py-1.5 text-xs border border-(--error)/30 bg-(--error)/10 text-(--error) hover:bg-(--error)/15"
          >
            stop holder and start
          </button>
        </div>
      </div>
    </div>
  );
}

