interface RecentLogsSectionProps {
  logs: string[];
}

export function RecentLogsSection({ logs }: RecentLogsSectionProps) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider text-(--muted-foreground) mb-3 font-medium">
        Recent Logs
      </h2>
      {logs.length > 0 ? (
        <div className="h-48 sm:h-64 overflow-auto font-mono text-xs leading-relaxed border border-(--border)/30 rounded-lg p-3 bg-(--card)/30 backdrop-blur-sm">
          <div className="space-y-1">
            {logs.map((line, i) => {
              const isError = line.includes("ERROR");
              const isWarning = line.includes("WARNING");
              return (
                <div
                  key={i}
                  className={`break-all ${
                    isError
                      ? "text-(--error)"
                      : isWarning
                        ? "text-(--warning)"
                        : "text-(--muted-foreground)"
                  }`}
                >
                  {line}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="h-48 sm:h-64 flex items-center justify-center border border-(--border)/30 rounded-lg bg-(--card)/20">
          <p className="text-xs text-(--muted-foreground)/50">No logs available</p>
        </div>
      )}
    </section>
  );
}
