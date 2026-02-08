// CRITICAL
import type { Hono } from "hono";
import type { AppContext } from "../types/context";
import { badRequest, notFound } from "../core/errors";
import type { ServiceId } from "../types/services";
import { GpuLeaseConflictError } from "../services/gpu-lease";

const SERVICE_IDS = new Set<ServiceId>(["llm", "stt", "tts", "image", "video"]);

const toServiceId = (value: string): ServiceId => {
  if (SERVICE_IDS.has(value as ServiceId)) return value as ServiceId;
  throw notFound("Service not found");
};

export const registerServicesRoutes = (app: Hono, context: AppContext): void => {
  app.get("/services", async (ctx) => {
    const services = await context.serviceManager.listServices();
    return ctx.json({ services, gpu_lease: context.serviceManager.getGpuLease() });
  });

  app.post("/services/:id/start", async (ctx) => {
    const id = toServiceId(ctx.req.param("id"));
    let body: Record<string, unknown> = {};
    try {
      body = (await ctx.req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const recipeId = typeof body["recipe_id"] === "string" ? body["recipe_id"] : undefined;
    const mode = body["mode"] === "best_effort" ? "best_effort" : "strict";
    const replace =
      ctx.req.query("replace") === "1" ||
      ctx.req.query("replace") === "true" ||
      body["replace"] === true;

    try {
      const state = await context.serviceManager.startService(id, {
        ...(recipeId ? { recipe_id: recipeId } : {}),
        mode,
        replace,
      });
      if (state.status === "error") {
        throw badRequest(state.last_error ?? "Failed to start service");
      }
      return ctx.json({ service: state });
    } catch (error) {
      if (error instanceof GpuLeaseConflictError) {
        return ctx.json(error.payload, { status: 409 });
      }
      throw error;
    }
  });

  app.post("/services/:id/stop", async (ctx) => {
    const id = toServiceId(ctx.req.param("id"));
    const state = await context.serviceManager.stopService(id);
    return ctx.json({ service: state });
  });

  app.get("/services/:id/health", async (ctx) => {
    const id = toServiceId(ctx.req.param("id"));
    const health = await context.serviceManager.health(id);
    return ctx.json(health);
  });

  app.get("/services/:id/version", async (ctx) => {
    const id = toServiceId(ctx.req.param("id"));
    const version = await context.serviceManager.version(id);
    return ctx.json(version);
  });
};
