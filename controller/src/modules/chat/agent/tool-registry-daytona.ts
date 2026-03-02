// CRITICAL
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TSchema } from "@sinclair/typebox";
import type { AppContext } from "../../../types/context";
import {
  getDaytonaToolboxClient,
  isDaytonaAgentModeEnabled,
} from "../../../services/daytona/toolbox-client";
import { AGENT_TOOL_NAMES } from "./contracts";
import { createTextResult } from "./tool-registry-common";
import type { AgentToolRegistryOptions } from "./tool-registry";

const asRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return {};
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // Fall through to command string fallback.
      }
    }
    return { command: trimmed };
  }
  return {};
};

const readStringArgument = (params: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = params[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return undefined;
};

const readPositiveNumberArgument = (
  params: Record<string, unknown>,
  keys: string[]
): number | undefined => {
  for (const key of keys) {
    const value = params[key];
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number.parseFloat(value.trim())
          : Number.NaN;
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }
  return undefined;
};

export const buildDaytonaTools = (
  context: AppContext,
  options: AgentToolRegistryOptions
): AgentTool[] => {
  if (!isDaytonaAgentModeEnabled(context.config)) {
    return [];
  }

  const client = getDaytonaToolboxClient(context.config);

  const executeCommand: AgentTool = {
    name: AGENT_TOOL_NAMES.EXECUTE_COMMAND,
    label: AGENT_TOOL_NAMES.EXECUTE_COMMAND,
    description: "Execute a shell command in the Daytona workspace for this chat session.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string" },
        cmd: { type: "string" },
        cwd: { type: "string" },
        workdir: { type: "string" },
        timeout: { type: "number" },
        timeout_ms: { type: "number" },
      },
      anyOf: [{ required: ["command"] }, { required: ["cmd"] }],
    } as unknown as TSchema,
    execute: async (_toolCallId, params): Promise<AgentToolResult<Record<string, unknown>>> => {
      const raw = asRecord(params);
      const command = readStringArgument(raw, ["command", "cmd", "shell_command", "shellCommand"]) ?? "";
      if (!command) {
        throw new Error("command (or cmd) is required");
      }

      const cwd = readStringArgument(raw, [
        "cwd",
        "workdir",
        "working_directory",
        "workingDirectory",
        "directory",
      ]);
      const timeoutSeconds = readPositiveNumberArgument(raw, ["timeout", "timeout_seconds", "timeoutSeconds"]);
      const timeoutMs = readPositiveNumberArgument(raw, ["timeout_ms", "timeoutMs"]);
      const timeout =
        timeoutSeconds ?? (timeoutMs !== undefined ? Math.max(1, Math.ceil(timeoutMs / 1000)) : undefined);

      const result = await client.executeCommand(options.sessionId, command, {
        ...(cwd ? { cwd } : {}),
        ...(typeof timeout === "number" && Number.isFinite(timeout) ? { timeout } : {}),
      });

      return createTextResult(result.result, {
        exitCode: result.exitCode,
        raw: result.raw,
      });
    },
  };

  return [executeCommand];
};
