// CRITICAL
import type { AppContext } from "../../types/context";
import type { JobRecord } from "../../types/jobs";
import type { VoiceAssistantTurnInput } from "../../workflows/types";
import { createVoiceAssistantActivities } from "../../activities/voice-assistant";
import type { JobsOrchestrator } from "./orchestrator";

/**
 * In-memory jobs orchestrator (no Temporal dependency).
 */
export class MemoryJobsOrchestrator implements JobsOrchestrator {
  public readonly kind = "memory" as const;
  private readonly context: AppContext;

  /**
   * Create a MemoryJobsOrchestrator.
   * @param context - Controller app context.
   */
  public constructor(context: AppContext) {
    this.context = context;
  }

  /**
   * Start a `voice_assistant_turn` job.
   * @param _job - Job record (unused; job_id comes from input).
   * @param input - Job input.
   * @returns void
   */
  public async startVoiceAssistantTurn(_job: JobRecord, input: VoiceAssistantTurnInput): Promise<void> {
    // Fire-and-forget background execution (still tracked via the JobStore).
    void (async (): Promise<void> => {
      const activities = createVoiceAssistantActivities(this.context);
      try {
        await activities.runVoiceAssistantTurn(input);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.context.logger.error("Job failed", { job_id: input.job_id, error: message });
        // `runVoiceAssistantTurn` already marks the job failed durably.
      }
    })();
  }
}
