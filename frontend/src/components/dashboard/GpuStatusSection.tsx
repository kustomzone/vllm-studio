import { useRealtimeStatus } from "@/hooks/useRealtimeStatus";

export function GpuStatusSection() {
  const { gpus: realtimeGpus } = useRealtimeStatus();

  const gpus = realtimeGpus.length > 0 ? realtimeGpus : [];
  const toGB = (value: number): number => {
    if (value > 1e10) return value / (1024 * 1024 * 1024);
    if (value > 1e8) return value / (1024 * 1024 * 1024);
    if (value > 1000) return value / 1024;
    return value;
  };

  const totalPower = gpus.reduce((sum, g) => sum + (g.power_draw || 0), 0);
  const totalMem = gpus.reduce((sum, g) => sum + toGB(g.memory_used_mb ?? g.memory_used ?? 0), 0);
  const totalMemMax = gpus.reduce(
    (sum, g) => sum + toGB(g.memory_total_mb ?? g.memory_total ?? 0),
    0,
  );

  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider text-(--muted-foreground) mb-3 font-medium">
        GPU Status
      </h2>

      {gpus.length === 0 ? (
        <p className="text-sm text-(--muted-foreground)">No GPU data available</p>
      ) : (
        <div className="space-y-0.5">
          {gpus.map((gpu, i) => {
            const memUsed = toGB(gpu.memory_used_mb ?? gpu.memory_used ?? 0);
            const memTotal = toGB(gpu.memory_total_mb ?? gpu.memory_total ?? 1);
            const memPct = (memUsed / memTotal) * 100;
            const temp = gpu.temp_c ?? gpu.temperature ?? 0;
            const util = gpu.utilization_pct ?? gpu.utilization ?? 0;
            return (
              <div
                key={gpu.id ?? gpu.index}
                className={`py-2.5 px-3 -mx-3 rounded-lg hover:bg-(--card)/50 transition-all duration-200 ${
                  i < gpus.length - 1 ? "mb-1" : ""
                }`}
              >
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-center">
                  <div className="text-sm text-(--foreground)">GPU {gpu.id ?? gpu.index}</div>
                  <div className="text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-1 bg-(--muted)/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-(--foreground)/50 rounded-full transition-all duration-500"
                          style={{ width: `${util}%` }}
                        />
                      </div>
                      <span className="text-(--muted-foreground) w-10 text-right tabular-nums font-medium">
                        {util}%
                      </span>
                    </div>
                  </div>
                  <div className="text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-1 bg-(--muted)/20 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            memPct > 90
                              ? "bg-(--error)/70"
                              : memPct > 70
                                ? "bg-(--warning)/70"
                                : "bg-(--success)/70"
                          }`}
                          style={{ width: `${memPct}%` }}
                        />
                      </div>
                      <span className="text-(--muted-foreground) text-right tabular-nums font-medium">
                        {memUsed.toFixed(1)}/{memTotal.toFixed(0)}G
                      </span>
                    </div>
                  </div>
                  <div className="text-xs">
                    <div
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium ${
                        temp > 80
                          ? "bg-(--error)/15 text-(--error)"
                          : temp > 65
                            ? "bg-(--warning)/15 text-(--warning)"
                            : "bg-(--success)/15 text-(--success)"
                      }`}
                    >
                      <span className="tabular-nums">{temp}°</span>
                    </div>
                  </div>
                  <div className="text-xs text-(--muted-foreground) tabular-nums">
                    {gpu.power_draw ? `${Math.round(gpu.power_draw)}W` : "--"}
                  </div>
                </div>
              </div>
            );
          })}
          {gpus.length > 0 && (
            <div className="pt-3 mt-3">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div className="text-(--muted-foreground) font-medium">Total</div>
                <div className="text-(--foreground) tabular-nums font-medium">
                  {Math.round(
                    gpus.reduce((sum, g) => sum + (g.utilization_pct ?? g.utilization ?? 0), 0) /
                      gpus.length,
                  )}
                  % avg
                </div>
                <div className="text-(--foreground) tabular-nums font-medium">
                  {totalMem.toFixed(1)}/{totalMemMax.toFixed(0)}G
                </div>
                <div className="text-(--foreground) tabular-nums font-medium">
                  {Math.round(
                    gpus.reduce((sum, g) => sum + (g.temp_c ?? g.temperature ?? 0), 0) /
                      gpus.length,
                  )}
                  ° avg
                </div>
                <div className="text-(--foreground) tabular-nums font-medium">
                  {Math.round(totalPower)}W
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
