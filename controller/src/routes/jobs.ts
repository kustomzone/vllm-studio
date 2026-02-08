// CRITICAL
import type { Hono } from "hono";
import type { AppContext } from "../types/context";
import { badRequest, notFound, serviceUnavailable } from "../core/errors";
import type { VoiceAssistantTurnInput } from "../workflows/types";

export const registerJobsRoutes = (app: Hono, context: AppContext): void => {
  app.get("/jobs", async (ctx) => {
    const jobs = context.jobManager.listJobs();
    return ctx.json({ jobs });
  });

  app.get("/jobs/:jobId", async (ctx) => {
    const jobId = ctx.req.param("jobId");
    const job = context.jobManager.getJob(jobId);
    if (!job) throw notFound("Job not found");
    return ctx.json({ job });
  });

  app.post("/jobs", async (ctx) => {
    const body = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body || typeof body !== "object") throw badRequest("Invalid payload");
    const type = typeof body["type"] === "string" ? body["type"] : "";
    const input = (body["input"] && typeof body["input"] === "object") ? (body["input"] as Record<string, unknown>) : null;

    if (type !== "voice_assistant_turn") {
      throw badRequest("Unsupported job type");
    }

    // For now, require Temporal or memory orchestrator implicitly. (Temporal-backed when available.)
    const job = await context.jobManager.createJob(type, input);
    const jobInput: Omit<VoiceAssistantTurnInput, "job_id"> = {};
    if (typeof input?.["text"] === "string") jobInput.text = String(input["text"]);
    if (typeof input?.["audio_base64"] === "string") jobInput.audio_base64 = String(input["audio_base64"]);
    if (typeof input?.["audio_extension"] === "string") jobInput.audio_extension = String(input["audio_extension"]);
    if (typeof input?.["language"] === "string") jobInput.language = String(input["language"]);
    if (typeof input?.["stt_model"] === "string") jobInput.stt_model = String(input["stt_model"]);
    if (typeof input?.["llm_model"] === "string") jobInput.llm_model = String(input["llm_model"]);
    if (typeof input?.["system"] === "string") jobInput.system = String(input["system"]);
    if (typeof input?.["tts_model"] === "string") jobInput.tts_model = String(input["tts_model"]);

    await context.jobManager.startVoiceAssistantTurn(job.id, jobInput);

    const updated = context.jobManager.getJob(job.id);
    if (!updated) throw serviceUnavailable("Job could not be started");
    return ctx.json({ job: updated });
  });
};
