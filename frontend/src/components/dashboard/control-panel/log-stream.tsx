"use client";

interface LogStreamProps {
  logs: string[];
}

export function LogStream({ logs }: LogStreamProps) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] uppercase tracking-[0.16em] text-(--dim)/50 font-mono">Logs</span>
        <div className="flex-1 h-px bg-(--border)/20" />
        <span className="text-[10px] font-mono text-(--dim)/25">{logs.length} lines</span>
      </div>

      {/* Log area — no border box, just a tinted bg */}
      <div className="bg-(--fg)/[0.018] h-72 overflow-auto">
        {logs.length > 0 ? (
          <div className="p-4 font-mono text-[11px] leading-relaxed space-y-0">
            {logs.map((line, i) => {
              const isError = line.includes("ERROR");
              const isWarning = line.includes("WARNING");
              const isInfo = line.includes("INFO");

              const tsMatch = line.match(/^(\[?[\d\-:\s.]+\]?)/);
              const ts = tsMatch ? tsMatch[1] : "";
              const msg = ts ? line.slice(ts.length).trim() : line;

              return (
                <div key={i} className="flex gap-3 min-w-0">
                  {ts && (
                    <span className="text-(--dim)/25 shrink-0 w-24 truncate">{ts}</span>
                  )}
                  <span
                    className={`break-all ${
                      isError
                        ? "text-(--err)/80"
                        : isWarning
                          ? "text-(--hl3)/70"
                          : isInfo
                            ? "text-(--fg)/60"
                            : "text-(--dim)/50"
                    }`}
                  >
                    {msg}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <span className="text-[11px] font-mono text-(--dim)/25">— no output —</span>
          </div>
        )}
      </div>
    </div>
  );
}
