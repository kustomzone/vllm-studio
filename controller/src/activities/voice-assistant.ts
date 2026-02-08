// CRITICAL
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { AppContext } from "../types/context";
import type { VoiceAssistantTurnInput, VoiceAssistantTurnResult } from "../workflows/types";
import { getSttAdapter } from "../services/integrations/stt";
import { getTtsAdapter } from "../services/integrations/tts";
import { JobReporter } from "../services/jobs/job-reporter";

export type VoiceAssistantActivities = {
  transcribe: (input: VoiceAssistantTurnInput) => Promise<{ transcript: string }>;
  llmRespond: (input: {
    job_id: string;
    transcript: string;
    llm_model?: string | null;
    system?: string | null;
  }) => Promise<{ response_text: string }>;
  speak: (input: { job_id: string; text: string; tts_model?: string | null }) => Promise<{
    audio_base64: string;
    audio_mime_type: string;
  }>;
  runVoiceAssistantTurn: (input: VoiceAssistantTurnInput) => Promise<VoiceAssistantTurnResult>;
};

const ensureTemporaryDirectory = (directoryPath: string): string => {
  mkdirSync(directoryPath, { recursive: true });
  return directoryPath;
};

const resolveModelPath = (modelsDirectory: string, subdirectory: string, model: string | null | undefined): string => {
  const trimmed = typeof model === "string" ? model.trim() : "";
  if (!trimmed) {
    throw new Error(`${subdirectory}_model is required`);
  }
  if (trimmed.startsWith("/") || trimmed.includes("..")) {
    // Allow absolute paths for advanced users, but prevent path traversal in relative values.
    return resolve(trimmed);
  }
  return resolve(modelsDirectory, subdirectory, trimmed);
};

/**
 * Create activity implementations for the voice assistant workflow.
 * @param context - Controller app context.
 * @returns Activities implementation set.
 */
export function createVoiceAssistantActivities(context: AppContext): VoiceAssistantActivities {
  const reporter = new JobReporter(context);

  const transcribe = async (input: VoiceAssistantTurnInput): Promise<{ transcript: string }> => {
    const jobId = input.job_id;
    reporter.log(jobId, "stt: start");
    reporter.setProgress(jobId, 0.1);

    const adapter = getSttAdapter();
    if (!adapter.isInstalled()) {
      throw new Error(`STT adapter not installed: ${adapter.id}`);
    }

    const audioBase64 = typeof input.audio_base64 === "string" ? input.audio_base64 : "";
    if (!audioBase64) throw new Error("audio_base64 is required for STT");

    const scratch = mkdtempSync(join(tmpdir(), "vllm-studio-stt-"));
    const extension =
      typeof input.audio_extension === "string" && input.audio_extension.trim() ? input.audio_extension.trim() : "wav";
    const audioPath = join(scratch, `audio.${extension}`);
    writeFileSync(audioPath, Buffer.from(audioBase64, "base64"));

    const modelPath = resolveModelPath(context.config.models_dir, "stt", input.stt_model);
    const language = input.language ?? null;

    const { text } = await adapter.transcribe({ audioPath, modelPath, language });
    reporter.log(jobId, "stt: done");
    reporter.setProgress(jobId, 0.35);
    return { transcript: text };
  };

  const llmRespond = async (input: { job_id: string; transcript: string; llm_model?: string | null; system?: string | null }): Promise<{ response_text: string }> => {
    const jobId = input.job_id;
    reporter.log(jobId, "llm: start");
    reporter.log(jobId, `llm: mock_inference=${String(process.env["VLLM_STUDIO_MOCK_INFERENCE"] ?? "")}`);
    reporter.setProgress(jobId, 0.45);

    const sessionId = randomUUID();
    const model = (input.llm_model ?? "default").trim() || "default";
    context.stores.chatStore.createSession(sessionId, `job:${jobId}`, model);

    const run = await context.runManager.startRun({
      sessionId,
      content: input.transcript,
      model,
      ...(input.system ? { systemPrompt: input.system } : {}),
      agentMode: true,
      agentFiles: false,
      mcpEnabled: false,
      deepResearch: false,
    });
    reporter.log(jobId, "llm: stream started");

    const timeoutMsRaw = process.env["VLLM_STUDIO_JOB_LLM_TIMEOUT_MS"];
    const timeoutMs = timeoutMsRaw && !Number.isNaN(Number(timeoutMsRaw)) ? Number(timeoutMsRaw) : 60_000;
    const timeoutId = setTimeout(() => {
      reporter.log(jobId, `llm: timeout after ${timeoutMs}ms (aborting run)`);
      context.runManager.abortRun(run.runId);
    }, timeoutMs);
    for await (const chunk of run.stream) {
      void chunk;
    }
    clearTimeout(timeoutId);

    const session = context.stores.chatStore.getSession(sessionId);
    const messages = Array.isArray(session?.["messages"])
      ? (session?.["messages"] as Array<Record<string, unknown>>)
      : [];
    const lastAssistant = [...messages].reverse().find((m) => m && typeof m === "object" && m["role"] === "assistant") as
      | Record<string, unknown>
      | undefined;
    const responseText = typeof lastAssistant?.["content"] === "string" ? String(lastAssistant["content"]) : "";
    reporter.log(jobId, "llm: done");
    reporter.setProgress(jobId, 0.75);
    return { response_text: responseText || "[no response]" };
  };

  const speak = async (input: { job_id: string; text: string; tts_model?: string | null }): Promise<{ audio_base64: string; audio_mime_type: string }> => {
    const jobId = input.job_id;
    reporter.log(jobId, "tts: start");
    reporter.setProgress(jobId, 0.82);

    const adapter = getTtsAdapter();
    if (!adapter.isInstalled()) {
      throw new Error(`TTS adapter not installed: ${adapter.id}`);
    }

    const scratch = ensureTemporaryDirectory(join(context.config.data_dir, "tmp"));
    const outputPath = join(scratch, `tts-${jobId}-${Date.now()}.wav`);
    const modelPath = resolveModelPath(context.config.models_dir, "tts", input.tts_model);

    await adapter.speak({ text: input.text, modelPath, outputPath });
    const wavBytes = readFileSync(outputPath);
    reporter.log(jobId, "tts: done");
    reporter.setProgress(jobId, 1);
    return { audio_base64: wavBytes.toString("base64"), audio_mime_type: "audio/wav" };
  };

  // Convenience "one shot" runner usable by the in-memory orchestrator (and tests).
  const runVoiceAssistantTurn = async (input: VoiceAssistantTurnInput): Promise<VoiceAssistantTurnResult> => {
    const jobId = input.job_id;
    reporter.setStatus(jobId, "running", 0);
    reporter.log(jobId, "job: start voice_assistant_turn");

    const text = typeof input.text === "string" && input.text.trim() ? input.text.trim() : null;

    const transcript = text ?? (await transcribe(input)).transcript;

    const { response_text } = await llmRespond({
      job_id: jobId,
      transcript,
      llm_model: input.llm_model ?? null,
      system: input.system ?? null,
    });

    const { audio_base64, audio_mime_type } = await speak({
      job_id: jobId,
      text: response_text,
      tts_model: input.tts_model ?? null,
    });

    const result: VoiceAssistantTurnResult = {
      transcript,
      response_text: response_text,
      audio_base64,
      audio_mime_type,
    };

    reporter.setResult(jobId, result as unknown as Record<string, unknown>);
    reporter.setStatus(jobId, "completed", 1);
    reporter.log(jobId, "job: completed");
    return result;
  };

  return { transcribe, llmRespond, speak, runVoiceAssistantTurn };
}
