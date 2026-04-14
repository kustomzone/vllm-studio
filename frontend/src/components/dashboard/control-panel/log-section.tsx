// CRITICAL
"use client";

import { SectionCard } from "./status-section";

interface LogSectionProps {
  logs: string[];
}

export function LogSection({ logs }: LogSectionProps) {
  return (
    <SectionCard label="Logs" icon="file-text">
      <div className="bg-(--bg) rounded-lg h-72 overflow-auto">
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
                    <span className="text-(--dim)/60 shrink-0 w-28 truncate">{ts}</span>
                  )}
                  <span
                    className={`break-all ${
                      isError
                        ? "text-(--err)"
                        : isWarning
                          ? "text-(--hl3)"
                          : isInfo
                            ? "text-(--fg)/70"
                            : "text-(--dim)"
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
            <span className="text-xs text-(--dim)">No output</span>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
