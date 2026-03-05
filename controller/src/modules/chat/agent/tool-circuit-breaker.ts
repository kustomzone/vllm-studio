import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";

/**
 * Maximum consecutive errors allowed per tool before the circuit breaker trips.
 * After this many failures, the error message instructs the model to stop retrying.
 */
const MAX_CONSECUTIVE_ERRORS = 3;

/**
 * Wraps all tools with a per-tool consecutive error tracker.
 * When a tool fails MAX_CONSECUTIVE_ERRORS times in a row, the error message
 * is replaced with a clear instruction to stop retrying, breaking infinite
 * retry loops caused by persistent backend failures (e.g. Daytona disk full).
 */
export function wrapToolsWithCircuitBreaker(tools: AgentTool[]): AgentTool[] {
  const consecutiveErrors = new Map<string, number>();

  return tools.map((tool) => ({
    ...tool,
    execute: async (
      toolCallId: string,
      params: unknown,
      signal?: AbortSignal,
      onPartial?: (partialResult: AgentToolResult<unknown>) => void,
    ): Promise<AgentToolResult<unknown>> => {
      const count = consecutiveErrors.get(tool.name) ?? 0;

      if (count >= MAX_CONSECUTIVE_ERRORS) {
        return {
          content: [
            {
              type: "text",
              text: `TOOL UNAVAILABLE: ${tool.name} has failed ${count} consecutive times due to a persistent error. `
                + "Do NOT retry this tool. Inform the user about the failure and continue without it.",
            },
          ],
          details: { circuitBroken: true, consecutiveErrors: count },
        };
      }

      try {
        const result = await tool.execute(toolCallId, params, signal, onPartial);
        consecutiveErrors.set(tool.name, 0);
        return result;
      } catch (error) {
        const newCount = count + 1;
        consecutiveErrors.set(tool.name, newCount);

        const message = error instanceof Error ? error.message : String(error);

        if (newCount >= MAX_CONSECUTIVE_ERRORS) {
          throw new Error(
            `PERSISTENT FAILURE (${newCount}/${MAX_CONSECUTIVE_ERRORS}): ${message}. `
              + "This tool is now unavailable. Do NOT call it again. "
              + "Tell the user about the error and proceed without this tool."
          );
        }

        throw error;
      }
    },
  }));
}
