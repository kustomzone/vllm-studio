// CRITICAL
import type { AppContext } from "../../types/context";
import type { JobRecord } from "../../types/jobs";
import type { VoiceAssistantTurnInput } from "../../workflows/types";
import type { JobsOrchestrator } from "./orchestrator";
import { MemoryJobsOrchestrator } from "./memory-orchestrator";
import { TemporalJobsOrchestrator } from "./temporal-orchestrator";

type Mode = "auto" | "temporal" | "memory";

const parseMode = (): Mode => {
  const raw = (process.env["VLLM_STUDIO_JOBS_ORCHESTRATOR"] || "auto").trim().toLowerCase();
  if (raw === "temporal") return "temporal";
  if (raw === "memory") return "memory";
  return "auto";
};

/**
 * Orchestrator that selects Temporal or in-memory execution based on env.
 */
export class AutoJobsOrchestrator implements JobsOrchestrator {
  public readonly kind = "temporal" as const;
  private readonly context: AppContext;
  private readonly mode: Mode;
  private readonly temporal: TemporalJobsOrchestrator;
  private readonly memory: MemoryJobsOrchestrator;

  /**
   * Create an AutoJobsOrchestrator.
   * @param context - Controller app context.
   */
  public constructor(context: AppContext) {
    this.context = context;
    this.mode = parseMode();
    this.temporal = new TemporalJobsOrchestrator(context);
    this.memory = new MemoryJobsOrchestrator(context);
  }

  /**
   * Start a `voice_assistant_turn` job.
   * @param job - Job record.
   * @param input - Job input.
   * @returns void
   */
  public async startVoiceAssistantTurn(job: JobRecord, input: VoiceAssistantTurnInput): Promise<void> {
    if (this.mode === "memory") {
      await this.memory.startVoiceAssistantTurn(job, input);
      return;
    }

    try {
      await this.temporal.startVoiceAssistantTurn(job, input);
    } catch (error) {
      if (this.mode === "temporal") throw error;
      // Auto fallback: when Temporal isn't available, still run the job in-process.
      await this.memory.startVoiceAssistantTurn(job, input);
    }
  }
}
