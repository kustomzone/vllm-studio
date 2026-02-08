// CRITICAL
import { proxyActivities } from "@temporalio/workflow";
import type { VoiceAssistantTurnInput, VoiceAssistantTurnResult } from "./types";
import type { createVoiceAssistantActivities } from "../activities/voice-assistant";

const { transcribe, llmRespond, speak, finalizeSuccess, finalizeFailure } = proxyActivities<
  ReturnType<typeof createVoiceAssistantActivities>
>({
  startToCloseTimeout: "10 minutes",
});

/**
 * Temporal workflow for a single voice assistant turn (STT -> LLM -> TTS).
 * @param input - Turn input.
 * @returns Turn result.
 */
export async function voiceAssistantTurn(input: VoiceAssistantTurnInput): Promise<VoiceAssistantTurnResult> {
  try {
    const transcript =
      (typeof input.text === "string" && input.text.trim())
        ? input.text.trim()
        : (await transcribe(input)).transcript;

    const { response_text } = await llmRespond({
      job_id: input.job_id,
      transcript,
      llm_model: input.llm_model ?? null,
      system: input.system ?? null,
    });

    const { audio_base64, audio_mime_type } = await speak({
      job_id: input.job_id,
      text: response_text,
      tts_model: input.tts_model ?? null,
    });

    const result: VoiceAssistantTurnResult = {
      transcript,
      response_text,
      audio_base64,
      audio_mime_type,
    };

    // Persist completion durably via an activity so job state is updated even if the controller restarts.
    await finalizeSuccess({ job_id: input.job_id, result });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finalizeFailure({ job_id: input.job_id, error: message });
    throw error;
  }
}
