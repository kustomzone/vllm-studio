// CRITICAL
import type { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AppContext } from "../types/context";
import { badRequest, serviceUnavailable } from "../core/errors";
import { getSttAdapter } from "../services/integrations/stt";
import { getTtsAdapter } from "../services/integrations/tts";

const ensureDirectory = (directory: string): void => {
  try {
    mkdirSync(directory, { recursive: true });
  } catch {
    // ignore
  }
};

const resolveIntegrationModelPath = (
  modelsDirectory: string,
  kind: "stt" | "tts",
  requested: string | null,
  envFallback: string | null,
): string => {
  const raw = (requested || envFallback || "").trim();
  if (!raw) {
    throw badRequest(`Missing model. Provide 'model' or set VLLM_STUDIO_${kind.toUpperCase()}_MODEL.`);
  }

  if (raw.includes("/")) {
    return resolve(raw);
  }

  return resolve(modelsDirectory, kind, raw);
};

export const registerAudioRoutes = (app: Hono, context: AppContext): void => {
  app.post("/v1/audio/transcriptions", async (ctx) => {
    const adapter = getSttAdapter();
    if (!adapter.isInstalled()) {
      throw serviceUnavailable("STT integration not installed (missing whisper-cli). Set VLLM_STUDIO_STT_CLI.");
    }

    const form = await ctx.req.formData().catch(() => null);
    if (!form) throw badRequest("Expected multipart/form-data");
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw badRequest("Missing audio file field 'file'");
    }

    const model = typeof form.get("model") === "string" ? String(form.get("model")) : null;
    const language = typeof form.get("language") === "string" ? String(form.get("language")) : null;
    const modelPath = resolveIntegrationModelPath(
      context.config.models_dir,
      "stt",
      model,
      process.env["VLLM_STUDIO_STT_MODEL"] ?? null,
    );

    if (!existsSync(modelPath)) {
      throw badRequest(`STT model not found: ${modelPath}`);
    }

    const temporaryDirectory = resolve(context.config.data_dir, "tmp", "stt");
    ensureDirectory(temporaryDirectory);
    const audioPath = join(temporaryDirectory, `${randomUUID()}-${file.name || "audio"}`);
    const bytes = Buffer.from(await file.arrayBuffer());
    writeFileSync(audioPath, bytes);

    const result = await adapter.transcribe({
      audioPath,
      modelPath,
      ...(language ? { language } : {}),
    });

    return ctx.json({ text: result.text });
  });

  app.post("/v1/audio/speech", async (ctx) => {
    const adapter = getTtsAdapter();
    if (!adapter.isInstalled()) {
      throw serviceUnavailable("TTS integration not installed (missing piper). Set VLLM_STUDIO_TTS_CLI.");
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await ctx.req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const input = typeof body["input"] === "string" ? body["input"] : "";
    if (!input.trim()) {
      throw badRequest("Missing 'input' text");
    }

    const responseFormatRaw =
      (typeof body["response_format"] === "string" ? body["response_format"] : null) ??
      (typeof body["format"] === "string" ? body["format"] : null);
    const responseFormat = (responseFormatRaw || "wav").trim().toLowerCase();
    if (responseFormat !== "wav") {
      throw badRequest("Only response_format='wav' is supported for now");
    }

    const model = typeof body["model"] === "string" ? body["model"] : null;
    const modelPath = resolveIntegrationModelPath(
      context.config.models_dir,
      "tts",
      model,
      process.env["VLLM_STUDIO_TTS_MODEL"] ?? null,
    );

    if (!existsSync(modelPath)) {
      throw badRequest(`TTS model not found: ${modelPath}`);
    }

    const temporaryDirectory = resolve(context.config.data_dir, "tmp", "tts");
    ensureDirectory(temporaryDirectory);
    const outPath = join(temporaryDirectory, `${randomUUID()}.wav`);
    await adapter.speak({ text: input, modelPath, outputPath: outPath });

    const audio = readFileSync(outPath);
    return new Response(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
      },
    });
  });
};
