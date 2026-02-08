// CRITICAL
import type { JobRecord } from "../../types/jobs";
import type { VoiceAssistantTurnInput } from "../../workflows/types";

export interface JobsOrchestrator {
  kind: "temporal" | "memory";
  startVoiceAssistantTurn(job: JobRecord, input: VoiceAssistantTurnInput): Promise<void>;
}

