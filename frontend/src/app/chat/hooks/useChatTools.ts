"use client";

import { useCallback } from "react";
import { api } from "@/lib/api";
import type { ToolCall, ToolResult } from "@/lib/types";

interface UseChatToolsOptions {
  mcpEnabled: boolean;
  mcpTools: Array<{
    server: string;
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }>;
  setMcpServers: (
    servers: Array<{
      name: string;
      command: string;
      args: string[];
      env: Record<string, string>;
      enabled: boolean;
      icon?: string;
    }>,
  ) => void;
  setMcpTools: (
    tools: Array<{
      server: string;
      name: string;
      description?: string;
      inputSchema?: Record<string, unknown>;
    }>,
  ) => void;
}

export function useChatTools({
  mcpEnabled,
  mcpTools,
  setMcpServers,
  setMcpTools,
}: UseChatToolsOptions) {
  const loadMCPServers = useCallback(async () => {
    try {
      const servers = await api.getMCPServers();
      setMcpServers(
        servers.map((server) => ({
          ...server,
          args: server.args || [],
          env: server.env || {},
          enabled: server.enabled ?? true,
        })),
      );
    } catch {}
  }, [setMcpServers]);

  const loadMCPTools = useCallback(async () => {
    try {
      const response = await api.getMCPTools();
      setMcpTools(response.tools || []);
    } catch {
      setMcpTools([]);
    }
  }, [setMcpTools]);

  const getOpenAITools = useCallback(() => {
    if (!mcpEnabled || !mcpTools.length) return [];
    return mcpTools.map((tool) => ({
      type: "function" as const,
      function: {
        name: `${tool.server}__${tool.name}`,
        description: tool.description || `Tool ${tool.name} from ${tool.server}`,
        parameters: tool.inputSchema || { type: "object", properties: {} },
      },
    }));
  }, [mcpEnabled, mcpTools]);

  const executeMCPTool = useCallback(
    async (toolCall: ToolCall): Promise<ToolResult> => {
      const funcName = toolCall.function?.name || "";
      const parts = funcName.split("__");
      let server = parts.length > 1 ? parts[0] : "";
      let toolName = parts.length > 1 ? parts.slice(1).join("__") : funcName;
      if (!server && mcpTools.length > 0) {
        const matchingTool = mcpTools.find(
          (tool) => tool.name === funcName || tool.name === toolName,
        );
        if (matchingTool) {
          server = matchingTool.server;
          toolName = matchingTool.name;
        }
      }
      if (!server) {
        return {
          tool_call_id: toolCall.id,
          content: `Error: Could not determine MCP server for tool "${funcName}"`,
          isError: true,
        };
      }
      try {
        let args: Record<string, unknown> = {};
        const rawArgs = (toolCall.function?.arguments || "").trim();
        if (rawArgs) {
          try {
            args = JSON.parse(rawArgs);
          } catch {
            args = { raw: rawArgs };
          }
        }
        const result = await api.callMCPTool(server, toolName, args);
        return {
          tool_call_id: toolCall.id,
          content:
            typeof result.result === "string" ? result.result : JSON.stringify(result.result),
        };
      } catch (error) {
        return {
          tool_call_id: toolCall.id,
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        };
      }
    },
    [mcpTools],
  );

  return {
    loadMCPServers,
    loadMCPTools,
    getOpenAITools,
    executeMCPTool,
  };
}
