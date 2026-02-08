// CRITICAL
"use client";

import { useMemo, useState } from "react";
import api from "@/lib/api";
import type { ServiceId, ServiceState } from "@/lib/types";
import { ApiError } from "@/lib/api/core";
import { GpuLeaseModal, type GpuLeaseConflictPayload } from "@/components/runtimes/gpu-lease-modal";

const statusColor = (status: ServiceState["status"]) => {
  switch (status) {
    case "running":
      return "text-(--success)";
    case "ready":
      return "text-[#8aa3ff]";
    case "starting":
      return "text-(--warning)";
    case "error":
      return "text-(--error)";
    default:
      return "text-foreground/40";
  }
};

export function RuntimesPanel({
  services,
  gpuLease,
}: {
  services: ServiceState[];
  gpuLease: { holder_service_id: string; acquired_at: string; reason?: string | null } | null;
}) {
  const [pending, setPending] = useState<ServiceId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaseConflict, setLeaseConflict] = useState<GpuLeaseConflictPayload | null>(null);

  const ordered = useMemo(() => {
    const rank: Record<string, number> = { llm: 0, stt: 1, tts: 2, image: 3, video: 4 };
    return [...services].sort((a, b) => (rank[a.id] ?? 99) - (rank[b.id] ?? 99));
  }, [services]);

  const doStart = async (id: ServiceId) => {
    setPending(id);
    setError(null);
    setLeaseConflict(null);
    try {
      await api.startService(id, {});
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const body = e.body as Partial<GpuLeaseConflictPayload> & Record<string, unknown>;
        if (body && body["code"] === "gpu_lease_conflict") {
          const requested = body["requested_service"] as { id?: unknown } | undefined;
          const holder = body["holder_service"] as { id?: unknown } | undefined;
          if (requested?.id && holder?.id) {
            setLeaseConflict(body as GpuLeaseConflictPayload);
            return;
          }
        }
      }
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  };

  const doStop = async (id: ServiceId) => {
    setPending(id);
    setError(null);
    try {
      await api.stopService(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null);
    }
  };

  if (!ordered.length) {
    return (
      <div className="border border-foreground/10 p-4">
        <div className="text-xs uppercase tracking-widest text-foreground/40 mb-2">Runtimes (Rock-Em)</div>
        <div className="text-sm text-foreground/30">No service data</div>
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-x-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs uppercase tracking-widest text-foreground/40">Runtimes (Rock-Em)</div>
        <div className="text-xs text-foreground/30 font-mono">{ordered.length} services</div>
      </div>

      {gpuLease && (
        <div className="mb-3 text-xs text-foreground/40 font-mono">
          gpu lease: {gpuLease.holder_service_id}
        </div>
      )}

      {error && (
        <div className="mb-3 border border-(--error)/30 bg-(--error)/10 text-(--error) px-3 py-2 text-xs">
          {error}
        </div>
      )}

      <div className="border border-foreground/10">
        <div className="grid grid-cols-12 gap-4 p-3 border-b border-foreground/10 bg-foreground/[0.02] text-[10px] uppercase tracking-wider text-foreground/30">
          <div className="col-span-2">Service</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3">Runtime</div>
          <div className="col-span-3">Version</div>
          <div className="col-span-2 text-right">Action</div>
        </div>
        <div>
          {ordered.map((service) => {
            const isPending = pending === service.id;
            const canStart = service.id !== "llm" && (service.status === "stopped" || service.status === "error");
            const canStop = service.status === "running" || service.status === "ready" || service.status === "error";
            const holdsLease = gpuLease?.holder_service_id === service.id;

            return (
              <div
                key={service.id}
                className="grid grid-cols-12 gap-4 p-3 border-b border-foreground/5 last:border-0 items-center text-sm"
              >
                <div className="col-span-2 font-mono">{service.id}</div>
                <div className={`col-span-2 font-mono text-xs ${statusColor(service.status)}`}>
                  {service.status}
                </div>
                <div className="col-span-3 text-xs text-foreground/60 truncate">
                  {service.runtime}
                  {holdsLease ? <span className="ml-2 text-foreground/30">[lease]</span> : null}
                </div>
                <div className="col-span-3 text-xs text-foreground/50 font-mono truncate">
                  {service.version ?? "--"}
                </div>
                <div className="col-span-2 flex justify-end gap-2">
                  {canStart && (
                    <button
                      onClick={() => doStart(service.id)}
                      disabled={isPending}
                      className="px-2 py-1 text-xs border border-foreground/10 hover:bg-foreground/[0.04] disabled:opacity-50"
                    >
                      start
                    </button>
                  )}
                  {canStop && (
                    <button
                      onClick={() => doStop(service.id)}
                      disabled={isPending}
                      className="px-2 py-1 text-xs border border-foreground/10 hover:bg-foreground/[0.04] disabled:opacity-50"
                    >
                      stop
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {leaseConflict && (
        <GpuLeaseModal
          conflict={leaseConflict}
          onCancel={() => setLeaseConflict(null)}
          onReplace={async () => {
            const requested = leaseConflict.requested_service.id;
            setLeaseConflict(null);
            setPending(requested);
            setError(null);
            try {
              await api.startService(requested, { replace: true, mode: "strict" });
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setPending(null);
            }
          }}
          onBestEffort={async () => {
            const requested = leaseConflict.requested_service.id;
            setLeaseConflict(null);
            setPending(requested);
            setError(null);
            try {
              await api.startService(requested, { mode: "best_effort" });
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setPending(null);
            }
          }}
        />
      )}
    </div>
  );
}
