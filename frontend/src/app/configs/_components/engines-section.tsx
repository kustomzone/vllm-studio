// CRITICAL
"use client";

import { useRealtimeStatus } from "@/hooks/use-realtime-status";

export function EnginesSection() {
  const { runtimeSummary, services = [], lease } = useRealtimeStatus();

  const backends = runtimeSummary?.backends;
  const gpuMon = runtimeSummary?.gpu_monitoring;

  return (
    <div className="space-y-6">
      {/* Backends */}
      <div>
        <h3 className="text-[11px] uppercase tracking-[0.12em] font-medium text-(--dim) mb-3">Inference Engines</h3>
        {backends ? (
          <div className="grid grid-cols-3 gap-3">
            {(["vllm", "sglang", "llamacpp"] as const).map((key) => {
              const b = backends[key];
              return (
                <div key={key} className="px-4 py-3 rounded-xl bg-(--surface)">
                  <div className="text-xs text-(--dim) mb-1">{key}</div>
                  <div className={`text-sm font-mono ${b.installed ? "text-(--fg)" : "text-(--dim)/50"}`}>
                    {b.installed ? (b.version ?? "installed") : "not installed"}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-(--dim)">Waiting for runtime summary…</div>
        )}
      </div>

      {/* GPU Monitoring */}
      {gpuMon && (
        <div>
          <h3 className="text-[11px] uppercase tracking-[0.12em] font-medium text-(--dim) mb-3">GPU Monitoring</h3>
          <div className="px-4 py-3 rounded-xl bg-(--surface)">
            <span className={`text-sm font-mono ${gpuMon.available ? "text-(--fg)" : "text-(--dim)/50"}`}>
              {gpuMon.available ? (gpuMon.tool ?? "available") : "unavailable"}
            </span>
          </div>
        </div>
      )}

      {/* Services */}
      {services.length > 0 && (
        <div>
          <h3 className="text-[11px] uppercase tracking-[0.12em] font-medium text-(--dim) mb-3">Services</h3>
          <div className="space-y-2">
            {services.map((svc) => (
              <div
                key={svc.id}
                className="flex items-center justify-between text-xs font-mono px-4 py-2.5 rounded-xl bg-(--surface)"
              >
                <span className="text-(--fg)">{svc.id}</span>
                <span
                  className={
                    svc.status === "running"
                      ? "text-(--fg)"
                      : svc.status === "error"
                        ? "text-(--fg)/70"
                        : "text-(--dim)"
                  }
                >
                  {svc.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lease */}
      {lease?.holder && (
        <div>
          <h3 className="text-[11px] uppercase tracking-[0.12em] font-medium text-(--dim) mb-3">GPU Lease</h3>
          <div className="px-4 py-3 rounded-xl bg-(--surface)">
            <span className="text-sm font-mono text-(--fg)">{lease.holder}</span>
          </div>
        </div>
      )}
    </div>
  );
}
