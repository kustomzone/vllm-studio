// CRITICAL
import { randomUUID } from "node:crypto";
import type { AppContext } from "../../types/context";
import type { JobRecord, JobType } from "../../types/jobs";
import type { VoiceAssistantTurnInput } from "../../workflows/types";
import type { JobsOrchestrator } from "./orchestrator";
import { AutoJobsOrchestrator } from "./auto-orchestrator";
import { JobReporter } from "./job-reporter";
import { Event } from "../event-manager";

/**
 * JobManager owns job creation and dispatch to the selected orchestrator.
 */
export class JobManager {
  private readonly context: AppContext;
  private readonly orchestrator: JobsOrchestrator;
  private readonly reporter: JobReporter;

  /**
   * Create a JobManager.
   * @param context - Controller app context.
   * @param orchestrator - Optional orchestrator override (defaults to auto).
   */
  public constructor(context: AppContext, orchestrator?: JobsOrchestrator) {
    this.context = context;
    this.reporter = new JobReporter(context);
    this.orchestrator = orchestrator ?? new AutoJobsOrchestrator(context);
  }

  /**
   * Return the orchestrator kind.
   * @returns Orchestrator kind.
   */
  public getKind(): JobsOrchestrator["kind"] {
    return this.orchestrator.kind;
  }

  /**
   * List jobs (most recently updated first).
   * @returns Job records.
   */
  public listJobs(): JobRecord[] {
    return this.context.stores.jobStore.list();
  }

  /**
   * Get a job record by id.
   * @param id - Job identifier.
   * @returns Job record or null.
   */
  public getJob(id: string): JobRecord | null {
    return this.context.stores.jobStore.get(id);
  }

  /**
   * Create a new job record.
   * @param type - Job type.
   * @param input - Optional input payload.
   * @returns Created job record.
   */
  public async createJob(type: JobType, input?: Record<string, unknown> | null): Promise<JobRecord> {
    const id = randomUUID();
    const job = this.context.stores.jobStore.create({ id, type, input: input ?? null });
    // Publish once for UI visibility even before first snapshot tick.
    void this.context.eventManager.publish(new Event("job_state_changed", { job }));
    return job;
  }

  /**
   * Start a voice assistant turn job by id.
   * @param jobId - Job identifier.
   * @param input - Job input (without job_id).
   * @returns Updated job record.
   */
  public async startVoiceAssistantTurn(jobId: string, input: Omit<VoiceAssistantTurnInput, "job_id">): Promise<JobRecord> {
    const job = this.getJob(jobId);
    if (!job) {
      throw new Error("Job not found");
    }
    if (job.type !== "voice_assistant_turn") {
      throw new Error(`Job type mismatch: expected voice_assistant_turn, got ${job.type}`);
    }
    if (job.status !== "queued") {
      throw new Error(`Job already started: ${job.status}`);
    }

    const payload: VoiceAssistantTurnInput = { job_id: jobId, ...input };

    this.reporter.setStatus(jobId, "running", 0);
    await this.orchestrator.startVoiceAssistantTurn(job, payload);
    return this.getJob(jobId)!;
  }
}
