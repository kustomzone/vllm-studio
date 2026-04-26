import type { AssistantMessage } from "./pi-agent-types";

/**
 * Check whether the controller should use deterministic mock inference.
 * @returns True when mock inference is enabled.
 */
export function isMockInferenceEnabled(): boolean {
  const raw = process.env["VLLM_STUDIO_MOCK_INFERENCE"];
  if (!raw) return false;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

/**
 * Associate streamed tool calls with the assistant message that introduced them.
 * @param assistant - Assistant message containing tool calls.
 * @param messageId - Persisted assistant message id.
 * @param toolCallToMessageId - Mutable tool-call lookup map.
 */
export function mapToolCallsToMessage(
  assistant: AssistantMessage,
  messageId: string | null,
  toolCallToMessageId: Map<string, string>
): void {
  if (!messageId) return;
  for (const block of assistant.content) {
    if (block.type === "toolCall") {
      toolCallToMessageId.set(block.id, messageId);
    }
  }
}

/**
 * Extract a tool server prefix from names using the server__tool convention.
 * @param toolName - Tool name emitted by the agent runtime.
 * @returns Tool server name, or null for local tools.
 */
export function parseToolServer(toolName: string): string | null {
  const parts = toolName.split("__");
  if (parts.length > 1) return parts[0] ?? null;
  return null;
}
