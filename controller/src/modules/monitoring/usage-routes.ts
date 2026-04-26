// CRITICAL
import type { Hono } from "hono";
import type { AppContext } from "../../types/context";
import { getUsageFromChatDatabase } from "./usage/chat-database";
import { emptyResponse } from "./usage/usage-utilities";

/**
 * Register usage analytics routes.
 * Uses the unified controller SQLite database as the single usage source.
 * @param app - Hono app.
 * @param context - App context.
 */
export const registerUsageRoutes = (app: Hono, context: AppContext): void => {
  app.get("/usage", async (ctx) => {
    try {
      const chatUsage = getUsageFromChatDatabase(context.config.db_path);
      if (chatUsage) return ctx.json(chatUsage);

      return ctx.json(emptyResponse());
    } catch (error) {
      console.error("[Usage] Error fetching usage stats:", error);
      return ctx.json(emptyResponse());
    }
  });
};
