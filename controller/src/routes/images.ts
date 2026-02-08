// CRITICAL
import type { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AppContext } from "../types/context";
import { badRequest, serviceUnavailable } from "../core/errors";
import { getImageAdapter } from "../services/integrations/image";
import { GpuLeaseConflictError } from "../services/gpu-lease";

const ensureDirectory = (directory: string): void => {
  try {
    mkdirSync(directory, { recursive: true });
  } catch {
    // ignore
  }
};

const resolveModelPath = (modelsDirectory: string, requested: string | null, envFallback: string | null): string => {
  const raw = (requested || envFallback || "").trim();
  if (!raw) {
    throw badRequest("Missing model. Provide 'model' or set VLLM_STUDIO_IMAGE_MODEL.");
  }
  if (raw.includes("/")) return resolve(raw);
  return resolve(modelsDirectory, "image", raw);
};

export const registerImagesRoutes = (app: Hono, context: AppContext): void => {
  app.post("/v1/images/generations", async (ctx) => {
    const adapter = getImageAdapter();
    if (!adapter.isInstalled()) {
      throw serviceUnavailable("Image integration not installed (missing sd CLI). Set VLLM_STUDIO_IMAGE_CLI.");
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await ctx.req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const prompt = typeof body["prompt"] === "string" ? body["prompt"] : "";
    if (!prompt.trim()) throw badRequest("Missing 'prompt'");

    const negativePrompt = typeof body["negative_prompt"] === "string" ? body["negative_prompt"] : null;
    const steps = typeof body["steps"] === "number" && body["steps"] > 0 ? Math.floor(body["steps"]) : 30;
    const width = typeof body["width"] === "number" && body["width"] > 0 ? Math.floor(body["width"]) : 1024;
    const height = typeof body["height"] === "number" && body["height"] > 0 ? Math.floor(body["height"]) : 1024;
    const seed = typeof body["seed"] === "number" ? Math.floor(body["seed"]) : null;

    const model = typeof body["model"] === "string" ? body["model"] : null;
    const modelPath = resolveModelPath(context.config.models_dir, model, process.env["VLLM_STUDIO_IMAGE_MODEL"] ?? null);
    if (!existsSync(modelPath)) {
      throw badRequest(`Image model not found: ${modelPath}`);
    }

    const mode = body["mode"] === "best_effort" ? "best_effort" : "strict";
    const replace = body["replace"] === true;

    try {
      await context.serviceManager.startService("image", { mode, replace });
    } catch (error) {
      if (error instanceof GpuLeaseConflictError) {
        return ctx.json(error.payload, { status: 409 });
      }
      throw error;
    }

    const outPath = resolve(context.config.data_dir, "artifacts", "image", `${randomUUID()}.png`);
    ensureDirectory(dirname(outPath));

    await adapter.generate({
      prompt,
      negativePrompt,
      width,
      height,
      steps,
      ...(seed !== null ? { seed } : {}),
      modelPath,
      outputPath: outPath,
    });

    const bytes = readFileSync(outPath);
    const b64 = Buffer.from(bytes).toString("base64");
    return ctx.json({
      created: Math.floor(Date.now() / 1000),
      data: [{ b64_json: b64 }],
    });
  });
};
