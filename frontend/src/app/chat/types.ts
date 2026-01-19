import type { UIMessage } from "@ai-sdk/react";

// Re-export for convenience
export type { UIMessage };

// Part type - AI SDK parts from UIMessage
export type Part = UIMessage["parts"][number];

// Tool definitions for OpenAI-compatible format
export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

// Session types
export interface ChatSession {
  id: string;
  title: string;
  model?: string;
  created_at: string;
  updated_at: string;
}

// Usage types
export interface SessionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost?: number;
}

// Artifact types
export interface Artifact {
  id: string;
  type: "code" | "html" | "react" | "markdown";
  title: string;
  content: string;
  language?: string;
  messageId: string;
}

// Research types
export interface ResearchProgress {
  phase: "searching" | "analyzing" | "synthesizing" | "complete";
  currentStep?: string;
  stepsCompleted: number;
  totalSteps: number;
  sources: ResearchSource[];
}

export interface ResearchSource {
  url: string;
  title: string;
  snippet?: string;
}

// Deep research config
export interface DeepResearchConfig {
  enabled: boolean;
  maxSources: number;
  searchDepth: "shallow" | "medium" | "deep";
}

// MCP types
export interface MCPServer {
  name: string;
  enabled: boolean;
  icon?: string;
}

export interface MCPTool {
  server: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

// Activity item for side panel
export interface ActivityItem {
  id: string;
  type: "tool-call" | "reasoning" | "research";
  timestamp: number;
  toolName?: string;
  toolCallId?: string;
  state?: "pending" | "running" | "complete" | "error";
  input?: unknown;
  output?: unknown;
  content?: string;
}

// Thinking state
export interface ThinkingState {
  content: string;
  isComplete: boolean;
}

// Panel types
export type ActivePanel = "tools" | "artifacts";
