// CRITICAL
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { AppContext } from "../../types/context";
import type { JobRecord } from "../../types/jobs";
import type { VoiceAssistantTurnInput } from "../../workflows/types";
import type { JobsOrchestrator } from "./orchestrator";
import { createVoiceAssistantActivities } from "../../activities/voice-assistant";
import { Client, Connection } from "@temporalio/client";
import { bundleWorkflowCode, NativeConnection, Worker } from "@temporalio/worker";

type TemporalInit = {
  client: Client;
  workerConnection: NativeConnection;
  taskQueue: string;
};

/**
 * Temporal-backed jobs orchestrator (worker + workflow start).
 */
export class TemporalJobsOrchestrator implements JobsOrchestrator {
  public readonly kind = "temporal" as const;

  private readonly context: AppContext;
  private initPromise: Promise<TemporalInit> | null = null;
  private workerStarted = false;
  private readonly taskQueue = "vllm-studio-jobs";

  /**
   * Create a TemporalJobsOrchestrator.
   * @param context - Controller app context.
   */
  public constructor(context: AppContext) {
    this.context = context;
  }

  /**
   * Initialize Temporal connections + client (cached).
   * @returns Temporal init state.
   */
  private async ensureInitialized(): Promise<TemporalInit> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async (): Promise<TemporalInit> => {
      const address = this.context.config.temporal_address;
      const clientConnection = await Connection.connect({ address });
      const workerConnection = await NativeConnection.connect({ address });
      const client = new Client({ connection: clientConnection });
      return { client, workerConnection, taskQueue: this.taskQueue };
    })();

    return this.initPromise;
  }

  /**
   * Ensure a worker is running for the configured task queue.
   * @param connection - Worker connection.
   * @returns void
   */
  private async ensureWorker(connection: NativeConnection): Promise<void> {
    if (this.workerStarted) return;
    this.workerStarted = true;

    try {
      // Bundle workflow code for the worker isolate.
      const here = dirname(fileURLToPath(import.meta.url));
      const workflowsPath = resolve(here, "..", "..", "workflows", "index.ts");
      const workflowBundle = await bundleWorkflowCode({ workflowsPath });

      const activities = createVoiceAssistantActivities(this.context);
      const worker = await Worker.create({
        connection,
        taskQueue: this.taskQueue,
        workflowBundle,
        activities,
      });

      void worker.run().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.context.logger.error("Temporal worker failed", { error: message });
        // Allow subsequent calls to re-attempt worker start.
        this.workerStarted = false;
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.context.logger.error("Failed to start Temporal worker", { error: message });
      this.workerStarted = false;
      throw error;
    }
  }

  /**
   * Start a `voice_assistant_turn` job.
   * @param job - Job record.
   * @param input - Workflow input.
   * @returns void
   */
  public async startVoiceAssistantTurn(job: JobRecord, input: VoiceAssistantTurnInput): Promise<void> {
    const { client, workerConnection, taskQueue } = await this.ensureInitialized();
    await this.ensureWorker(workerConnection);

    const workflowId = job.id;
    await client.workflow.start("voiceAssistantTurn", {
      workflowId,
      taskQueue,
      args: [input],
    });

    // Job progress + completion are persisted durably by activities (JobReporter),
    // so the UI remains accurate even if the controller restarts mid-workflow.
  }
}
