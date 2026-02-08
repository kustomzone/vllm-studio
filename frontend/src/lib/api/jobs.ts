// CRITICAL
import type { JobRecord } from "../types";
import type { ApiCore } from "./core";

export function createJobsApi(core: ApiCore) {
  return {
    listJobs: (): Promise<{ jobs: JobRecord[] }> => core.request("/jobs"),

    getJob: (jobId: string): Promise<{ job: JobRecord }> => core.request(`/jobs/${encodeURIComponent(jobId)}`),

    createJob: (payload: { type: "voice_assistant_turn"; input: Record<string, unknown> }): Promise<{ job: JobRecord }> =>
      core.request("/jobs", { method: "POST", body: JSON.stringify(payload) }),
  };
}

