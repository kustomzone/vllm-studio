"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { MCPTool, MCPServer, ToolDefinition } from "../types";
import type { ToolResult } from "@/lib/types";

interface UseChatToolsOptions {
  mcpEnabled: boolean;
}

export function useChatTools({ mcpEnabled }: UseChatToolsOptions) {
  const [mcpTools, setMcpTools] = useState<MCPTool[]>([]);
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [executingTools, setExecutingTools] = useState<Set<string>>(new Set());
  const [toolResultsMap, setToolResultsMap] = useState<Map<string, ToolResult>>(new Map());

  const loadMCPServers = useCallback(async () => {
    try {
      const { servers } = await api.getMCPServers();
      const normalizedServers: MCPServer[] = servers.map((server) => ({
        name: server.name,
        enabled: server.enabled ?? true,
        icon: server.icon,
      }));
      setMcpServers(normalizedServers);
    } catch (err) {
      console.error("Failed to load MCP servers:", err);
    }
  }, []);

  const loadMCPTools = useCallback(async (): Promise<MCPTool[]> => {
    if (!mcpEnabled) {
      setMcpTools([]);
      return [];
    }
    try {
      const data = await api.getMCPTools();
      const tools = data.tools || [];
      setMcpTools(tools);
      return tools;
    } catch (err) {
      console.error("Failed to load MCP tools:", err);
      return [];
    }
  }, [mcpEnabled]);

  const getToolDefinitions = useCallback(
    (toolsOverride?: MCPTool[]): ToolDefinition[] => {
      if (!mcpEnabled) return [];
      const toolsList = toolsOverride ?? mcpTools;
      const enabledServers =
        mcpServers.length > 0
          ? new Set(mcpServers.filter((server) => server.enabled).map((server) => server.name))
          : new Set(toolsList.map((tool) => tool.server));
      return toolsList
        .filter((tool) => enabledServers.has(tool.server))
        .map((tool) => ({
          name: `${tool.server}__${tool.name}`,
          description: tool.description,
          inputSchema: tool.inputSchema,
        }));
    },
    [mcpEnabled, mcpTools, mcpServers],
  );

  const executeTool = useCallback(
    async (toolCall: { toolCallId: string; toolName: string; args?: Record<string, unknown> }) => {
      const { toolCallId, toolName: rawToolName, args } = toolCall;

      setExecutingTools((prev) => new Set(prev).add(toolCallId));

      try {
        const nameParts = rawToolName.split("__");
        const resolvedToolName = nameParts.length > 1 ? nameParts.slice(1).join("__") : rawToolName;
        const serverFromName = nameParts.length > 1 ? nameParts[0] : "";
        const tool = mcpTools.find(
          (t) => t.name === resolvedToolName && (!serverFromName || t.server === serverFromName),
        );
        const server = serverFromName || tool?.server || "default";

        const result = await api.callMCPTool(server, resolvedToolName, args || {});

        const toolResult: ToolResult = {
          tool_call_id: toolCallId,
          content:
            typeof result.result === "string" ? result.result : JSON.stringify(result.result),
          isError: false,
        };

        setToolResultsMap((prev) => new Map(prev).set(toolCallId, toolResult));
        return toolResult;
      } catch (err) {
        const errorResult: ToolResult = {
          tool_call_id: toolCallId,
          content: err instanceof Error ? err.message : "Tool execution failed",
          isError: true,
        };
        setToolResultsMap((prev) => new Map(prev).set(toolCallId, errorResult));
        return errorResult;
      } finally {
        setExecutingTools((prev) => {
          const next = new Set(prev);
          next.delete(toolCallId);
          return next;
        });
      }
    },
    [mcpTools],
  );

  const clearToolResults = useCallback(() => {
    setToolResultsMap(new Map());
    setExecutingTools(new Set());
  }, []);

  return {
    mcpTools,
    mcpServers,
    executingTools,
    toolResultsMap,
    loadMCPServers,
    loadMCPTools,
    getToolDefinitions,
    executeTool,
    clearToolResults,
    setMcpServers,
  };
}
