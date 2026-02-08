// CRITICAL
import type { AppContext } from "../../types/context";
import type { JobRecord, JobStatus } from "../../types/jobs";
import { Event } from "../event-manager";

/**
 * Helper to update durable job state and emit SSE updates.
 */
export class JobReporter {
  private readonly context: AppContext;

  /**
   * Create a JobReporter.
   * @param context - Controller app context.
   */
  public constructor(context: AppContext) {
    this.context = context;
  }

  /**
   * Get a job by id.
   * @param jobId - Job identifier.
   * @returns Job record or null.
   */
  public getJob(jobId: string): JobRecord | null {
    return this.context.stores.jobStore.get(jobId);
  }

  /**
   * Apply a patch to a job record and publish a `job_state_changed` event.
   * @param jobId - Job identifier.
   * @param patch - Patch fields.
   * @returns Updated job record or null.
   */
  public update(jobId: string, patch: Partial<Pick<JobRecord, "status" | "progress" | "error" | "result">>): JobRecord | null {
    const updated = this.context.stores.jobStore.update(jobId, patch);
    if (updated) {
      void this.context.eventManager.publish(new Event("job_state_changed", { job: updated }));
    }
    return updated;
  }

  /**
   * Set job status (optionally progress).
   * @param jobId - Job identifier.
   * @param status - Job status.
   * @param progress - Optional progress (0..1).
   * @returns Updated job record or null.
   */
  public setStatus(jobId: string, status: JobStatus, progress?: number): JobRecord | null {
    return this.update(jobId, {
      status,
      ...(typeof progress === "number" ? { progress } : {}),
    });
  }

  /**
   * Set job progress (clamped to 0..1).
   * @param jobId - Job identifier.
   * @param progress - Progress (0..1).
   * @returns Updated job record or null.
   */
  public setProgress(jobId: string, progress: number): JobRecord | null {
    const clamped = Math.max(0, Math.min(1, progress));
    return this.update(jobId, { progress: clamped });
  }

  /**
   * Set the job result payload.
   * @param jobId - Job identifier.
   * @param result - Result object.
   * @returns Updated job record or null.
   */
  public setResult(jobId: string, result: Record<string, unknown>): JobRecord | null {
    return this.update(jobId, { result });
  }

  /**
   * Mark the job failed with an error.
   * @param jobId - Job identifier.
   * @param error - Error message.
   * @returns Updated job record or null.
   */
  public fail(jobId: string, error: string): JobRecord | null {
    return this.update(jobId, { status: "failed", error, progress: 1 });
  }

  /**
   * Append a log line and publish `job_state_changed`.
   * @param jobId - Job identifier.
   * @param line - Log line.
   * @returns Updated job record or null.
   */
  public log(jobId: string, line: string): JobRecord | null {
    const updated = this.context.stores.jobStore.appendLog(jobId, line);
    if (updated) {
      void this.context.eventManager.publish(new Event("job_state_changed", { job: updated }));
    }
    return updated;
  }
}
