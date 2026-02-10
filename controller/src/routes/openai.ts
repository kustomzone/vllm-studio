// CRITICAL
import type { Hono } from "hono";
import { AsyncLock, delay } from "../core/async";
import { HttpStatus, serviceUnavailable } from "../core/errors";
import { primaryLogPathFor, readFileTailBytes, sanitizeLogSessionId } from "../core/log-files";
import { buildSseHeaders } from "../http/sse";
import type { AppContext } from "../types/context";
import type { ProcessInfo, Recipe } from "../types/models";
import {
  createToolCallStream,
  normalizeToolCallsInMessage,
  normalizeToolRequest,
} from "../services/tool-call-core";
import { isVlmAttachmentsEnabled } from "../config/features";

const switchLock = new AsyncLock();

export const registerOpenAIRoutes = (app: Hono, context: AppContext): void => {
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value);

  const hasImageUrlParts = (payload: Record<string, unknown>): boolean => {
    const messages = payload["messages"];
    if (!Array.isArray(messages)) return false;
    for (const message of messages) {
      if (!isRecord(message)) continue;
      const content = message["content"];
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (!isRecord(part)) continue;
        if (part["type"] === "image_url") return true;
      }
    }
    return false;
  };

  const findRecipeByModel = (modelName: string): Recipe | null => {
    const lower = modelName.toLowerCase();
    for (const recipe of context.stores.recipeStore.list()) {
      const served = (recipe.served_model_name ?? "").toLowerCase();
      if (served === lower || recipe.id.toLowerCase() === lower) {
        return recipe;
      }
      const name = (recipe.name ?? "").toLowerCase();
      if (name && name === lower) {
        return recipe;
      }
    }
    return null;
  };

  const isRecipeRunning = (recipe: Recipe, current: ProcessInfo): boolean => {
    const canonical = (recipe.served_model_name ?? "").toLowerCase();
    if (canonical && current.served_model_name && current.served_model_name.toLowerCase() === canonical) {
      return true;
    }
    if (current.model_path) {
      const normalize = (p: string): string => p.replace(/\/+$/, "");
      if (normalize(recipe.model_path) === normalize(current.model_path)) {
        return true;
      }
      if (current.model_path.split("/").pop() === recipe.model_path.split("/").pop()) {
        return true;
      }
    }
    return false;
  };

  const pidExists = (pid: number): boolean => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };

  const readLogTail = (path: string, limit: number): string => {
    return readFileTailBytes(path, limit);
  };

  const ensureModelRunning = async (recipe: Recipe): Promise<string | null> => {
    const current = await context.processManager.findInferenceProcess(context.config.inference_port);
    if (current && isRecipeRunning(recipe, current)) {
      return null;
    }

    const release = await switchLock.acquire();
    try {
      const latest = await context.processManager.findInferenceProcess(context.config.inference_port);
      if (latest && isRecipeRunning(recipe, latest)) {
        return null;
      }
      await context.processManager.evictModel(false);
      await delay(2000);
      const launch = await context.processManager.launchModel(recipe);
      if (!launch.success) {
        return `Failed to launch model ${recipe.id}: ${launch.message}`;
      }

      const start = Date.now();
      const timeout = 300_000;
      while (Date.now() - start < timeout) {
        if (launch.pid && !pidExists(launch.pid)) {
          const safeRecipeId = sanitizeLogSessionId(recipe.id);
          const logFile = safeRecipeId
            ? primaryLogPathFor(context.config.data_dir, safeRecipeId)
            : primaryLogPathFor(context.config.data_dir, recipe.id);
          const errorTail = readLogTail(logFile, 500);
          return `Model ${recipe.id} crashed during startup: ${errorTail.slice(-200)}`;
        }
        try {
          const controller = new AbortController();
          const timeoutHandle = setTimeout(() => controller.abort(), 5000);
          const response = await fetch(`http://127.0.0.1:${context.config.inference_port}/health`, {
            signal: controller.signal,
          });
          clearTimeout(timeoutHandle);
          if (response.status === 200) {
            return null;
          }
        } catch {
          await delay(3000);
        }
        await delay(3000);
      }
      return `Model ${recipe.id} failed to become ready (timeout)`;
    } finally {
      release();
    }
  };

  app.post("/v1/chat/completions", async (ctx) => {
    let bodyBuffer: ArrayBuffer;
    try {
      bodyBuffer = await ctx.req.arrayBuffer();
    } catch {
      throw new HttpStatus(400, "Invalid request body");
    }

    let parsed: Record<string, unknown> = {};
    let requestedModel: string | null = null;
    let matchedRecipe: Recipe | null = null;
    let isStreaming = false;
    let bodyChanged = false;
    let containsImageParts = false;

    try {
      const bodyText = new TextDecoder().decode(bodyBuffer);
      parsed = JSON.parse(bodyText) as Record<string, unknown>;
      normalizeToolRequest(parsed);
      if (typeof parsed["model"] === "string") {
        requestedModel = parsed["model"];
        matchedRecipe = findRecipeByModel(requestedModel);
        if (matchedRecipe) {
          const canonical = matchedRecipe.served_model_name ?? matchedRecipe.id;
          if (canonical && canonical !== requestedModel) {
            parsed["model"] = canonical;
            requestedModel = canonical;
            bodyChanged = true;
          }
        }
      }
      if (parsed["functions"] || parsed["tools"] !== undefined) {
        bodyChanged = true;
      }
      isStreaming = Boolean(parsed["stream"]);
      containsImageParts = hasImageUrlParts(parsed);
    } catch {
      throw new HttpStatus(400, "Invalid JSON body");
    }

    if (containsImageParts && !isVlmAttachmentsEnabled()) {
      throw new HttpStatus(
        400,
        "VLM image attachments are disabled. Set VLLM_STUDIO_FEATURE_VLM_ATTACHMENTS=1 to enable multimodal image_url requests.",
      );
    }

    if (matchedRecipe) {
      const switchError = await ensureModelRunning(matchedRecipe);
      if (switchError) {
        throw serviceUnavailable(switchError);
      }
    }

    const toolsPayload = Array.isArray(parsed["tools"]) ? parsed["tools"] : [];
    const hasTools = toolsPayload.length > 0;
    const useDirectInference = isStreaming && hasTools;
    const masterKey = process.env["LITELLM_MASTER_KEY"] ?? "sk-master";
    const inferenceKey = process.env["INFERENCE_API_KEY"] ?? "";
    const inferenceHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...(inferenceKey ? { Authorization: `Bearer ${inferenceKey}` } : {}),
    };
    const litellmHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${masterKey}`,
    };
    const litellmUrl = "http://127.0.0.1:4100/v1/chat/completions";
    const inferenceUrl = `http://127.0.0.1:${context.config.inference_port}/v1/chat/completions`;
    const upstreamUrl = useDirectInference ? inferenceUrl : litellmUrl;
    const headers = useDirectInference ? inferenceHeaders : litellmHeaders;
    const finalBody = bodyChanged ? new TextEncoder().encode(JSON.stringify(parsed)).buffer : bodyBuffer;

    if (!isStreaming) {
      let response: Response;
      try {
        response = await fetch(litellmUrl, { method: "POST", headers: litellmHeaders, body: finalBody });
      } catch {
        // Local-only / bring-up mode: if LiteLLM is not running, fall back directly to the inference backend.
        response = await fetch(inferenceUrl, { method: "POST", headers: inferenceHeaders, body: finalBody });
      }

      const result = (await response.json()) as Record<string, unknown>;

      const usage = result["usage"] as Record<string, number> | undefined;
      if (usage) {
        const promptTokens = usage["prompt_tokens"] ?? 0;
        const completionTokens = usage["completion_tokens"] ?? 0;
        if (promptTokens > 0) {
          context.stores.lifetimeMetricsStore.addPromptTokens(promptTokens);
          context.stores.lifetimeMetricsStore.addTokens(promptTokens);
        }
        if (completionTokens > 0) {
          context.stores.lifetimeMetricsStore.addCompletionTokens(completionTokens);
          context.stores.lifetimeMetricsStore.addTokens(completionTokens);
        }
        if (promptTokens > 0 || completionTokens > 0) {
          context.stores.lifetimeMetricsStore.addRequests(1);
        }
      }

      const choices = result["choices"];
      if (Array.isArray(choices)) {
        for (const choice of choices) {
          const choiceRecord = choice as Record<string, unknown>;
          const message = choiceRecord["message"] as Record<string, unknown> | undefined;
          // Some backends return "thinking" output under `reasoning_content` with an empty `content`.
          // For compatibility with OpenAI clients (and our UI), mirror that into `content`.
          if (
            message &&
            typeof message["content"] === "string" &&
            (message["content"] as string).length === 0 &&
            typeof message["reasoning_content"] === "string" &&
            (message["reasoning_content"] as string).trim().length > 0
          ) {
            message["content"] = message["reasoning_content"];
          }
          if (message && normalizeToolCallsInMessage(message)) {
            choiceRecord["finish_reason"] = "tool_calls";
          }
        }
      }

      return ctx.json(result, { status: response.status });
    }

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, { method: "POST", headers, body: finalBody });
    } catch (error) {
      // If we're trying to use LiteLLM for streaming but it isn't reachable, fall back to direct inference.
      if (!useDirectInference) {
        upstreamResponse = await fetch(inferenceUrl, { method: "POST", headers: inferenceHeaders, body: finalBody });
      } else {
        throw error;
      }
    }
    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text();
      if (containsImageParts) {
        return ctx.json(
          {
            error: {
              message:
                "Upstream rejected a multimodal request. Ensure you selected a VLM-capable model/recipe and that the backend supports OpenAI-style image_url parts.",
              upstream_status: upstreamResponse.status,
              upstream_body: errorText.slice(0, 2000),
            },
          },
          { status: upstreamResponse.status },
        );
      }
      return new Response(errorText, {
        status: upstreamResponse.status,
        headers: {
          "Content-Type": upstreamResponse.headers.get("Content-Type") ?? "application/json",
        },
      });
    }

    const reader = upstreamResponse.body?.getReader();
    if (!reader) {
      throw serviceUnavailable(useDirectInference ? "Inference backend unavailable" : "LiteLLM backend unavailable");
    }

    const stream = createToolCallStream(reader, (usage) => {
      if (usage.prompt_tokens > 0) {
        context.stores.lifetimeMetricsStore.addPromptTokens(usage.prompt_tokens);
        context.stores.lifetimeMetricsStore.addTokens(usage.prompt_tokens);
      }
      if (usage.completion_tokens > 0) {
        context.stores.lifetimeMetricsStore.addCompletionTokens(usage.completion_tokens);
        context.stores.lifetimeMetricsStore.addTokens(usage.completion_tokens);
      }
      if (usage.prompt_tokens > 0 || usage.completion_tokens > 0) {
        context.stores.lifetimeMetricsStore.addRequests(1);
      }
    });

    return new Response(stream, { headers: buildSseHeaders() });
  });
};
