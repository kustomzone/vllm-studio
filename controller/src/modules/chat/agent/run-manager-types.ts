import type { ThinkingLevel } from "@mariozechner/pi-agent-core";

export interface ChatRunOptions {
  sessionId: string;
  messageId?: string;
  content: string;
  model?: string;
  provider?: string;
  systemPrompt?: string;
  agentMode?: boolean;
  agentFiles?: boolean;
  deepResearch?: boolean;
  thinkingLevel?: ThinkingLevel;
  images?: Array<{ data: string; mimeType: string; name?: string }>;
}

export interface ChatRunStream {
  runId: string;
  stream: AsyncIterable<string>;
}
