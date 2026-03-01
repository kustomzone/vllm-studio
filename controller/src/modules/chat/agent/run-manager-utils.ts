import type { AssistantMessage } from "@mariozechner/pi-ai";

export function isMockInferenceEnabled(): boolean {
  const raw = process.env["VLLM_STUDIO_MOCK_INFERENCE"];
  if (!raw) return false;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

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

export function parseToolServer(toolName: string): string | null {
  const parts = toolName.split("__");
  if (parts.length > 1) return parts[0] ?? null;
  return null;
}
