import type { ApiCore } from "./core";

export interface JobRecord {
  id: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  logs: string[];
  created_at: string;
  updated_at: string;
}

export function createJobsApi(core: ApiCore) {
  return {
    createJob: (
      type: string,
      input: Record<string, unknown>,
    ): Promise<{ job: JobRecord }> =>
      core.request("/jobs", {
        method: "POST",
        body: JSON.stringify({ type, input }),
      }),

    listJobs: (limit = 50): Promise<{ jobs: JobRecord[] }> =>
      core.request(`/jobs?limit=${limit}`),

    getJob: (jobId: string): Promise<{ job: JobRecord }> =>
      core.request(`/jobs/${encodeURIComponent(jobId)}`),
  };
}
