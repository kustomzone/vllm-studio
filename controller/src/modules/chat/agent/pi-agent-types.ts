// CRITICAL
import type { AgentEvent, AgentMessage, AgentState, StreamFn } from "@mariozechner/pi-agent-core";

export type AgentModel<TApi extends string = string> = AgentState["model"] & { api: TApi };
export type LlmMessage = Extract<AgentMessage, { role: "user" | "assistant" | "toolResult" }>;
export type UserMessage = Extract<LlmMessage, { role: "user" }>;
export type AssistantMessage = Extract<LlmMessage, { role: "assistant" }>;
export type ToolResultMessage = Extract<LlmMessage, { role: "toolResult" }>;
type UserContentBlock = Extract<UserMessage["content"], unknown[]>[number];
type AssistantContentBlock = AssistantMessage["content"][number];
type ToolResultContentBlock = ToolResultMessage["content"][number];

export type TextContent = Extract<
  UserContentBlock | AssistantContentBlock | ToolResultContentBlock,
  { type: "text" }
>;
export type ImageContent = Extract<UserContentBlock | ToolResultContentBlock, { type: "image" }>;
export type ThinkingContent = Extract<AssistantContentBlock, { type: "thinking" }>;
export type ToolCall = Extract<AssistantContentBlock, { type: "toolCall" }>;
export type Usage = AssistantMessage["usage"];
export type AssistantMessageEvent = Extract<
  AgentEvent,
  { type: "message_update" }
>["assistantMessageEvent"];
export type StreamModel = Parameters<StreamFn>[0];
export type StreamContext = Parameters<StreamFn>[1];
export type StreamOptions = Parameters<StreamFn>[2];
export type AssistantStream = Awaited<ReturnType<StreamFn>>;
