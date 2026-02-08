// CRITICAL
"use client";

import type { JobRecord } from "@/lib/types";

const formatStatus = (status: JobRecord["status"]) => status.replace(/_/g, " ");

export function JobsPanel({ jobs }: { jobs: JobRecord[] }) {
  return (
    <div className="border border-(--border) bg-(--card) rounded-xl p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-(--foreground)">Jobs</h2>
        <div className="text-[11px] text-(--muted-foreground) font-mono">
          {jobs.length} total
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {jobs.length === 0 ? (
          <div className="text-xs text-(--muted-foreground)">No jobs yet.</div>
        ) : (
          jobs.slice(0, 50).map((job) => (
            <div key={job.id} className="border border-(--border) rounded-lg p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-(--foreground) font-mono truncate">{job.id}</div>
                  <div className="text-[11px] text-(--muted-foreground)">
                    {job.type} · {formatStatus(job.status)}
                    {job.error ? ` · error: ${job.error}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-[11px] text-(--muted-foreground) font-mono">
                  {Math.round((job.progress ?? 0) * 100)}%
                </div>
              </div>

              {Array.isArray(job.logs) && job.logs.length > 0 && (
                <div className="mt-2 text-[11px] font-mono text-(--muted-foreground) whitespace-pre-wrap break-words">
                  {job.logs.slice(-5).join("\n")}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

