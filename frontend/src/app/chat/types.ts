import type { UIMessage } from "@ai-sdk/react";

// Re-export from lib/types for convenience
export type { ChatSession, MCPTool, Artifact } from "@/lib/types";

// Simplified MCPServer for chat UI (doesn't need command/args/env)
export interface MCPServer {
  name: string;
  enabled: boolean;
  icon?: string;
}

// Re-export UIMessage
export type { UIMessage };

// Part type - AI SDK parts from UIMessage
export type Part = UIMessage["parts"][number];

// Tool definitions for OpenAI-compatible format
export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

// Usage types
export interface SessionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost?: number;
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

export interface ActivityGroup {
  id: string;
  messageId: string;
  title: string;
  isLatest: boolean;
  thinkingContent?: string;
  thinkingActive?: boolean;
  toolItems: ActivityItem[];
}

// Thinking state
export interface ThinkingState {
  content: string;
  isComplete: boolean;
}

// Panel types
export type ActivePanel = "activity" | "artifacts";
