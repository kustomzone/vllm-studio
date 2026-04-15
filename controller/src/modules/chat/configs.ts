import type { ThinkingLevel } from "@mariozechner/pi-agent-core";

export const CHAT_MODULE_DEFAULTS = {
  persistenceEnabled: true,
};

export const THINKING_LEVELS: readonly ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

export type ThinkingLevelValue = (typeof THINKING_LEVELS)[number];

export const COMPACTION_SYSTEM_PROMPT = [
  "You are a context-compaction assistant.",
  "Summarize the conversation so it can replace the full history.",
  "The original first user message and the latest exchange will be preserved separately.",
  "Do not repeat those messages verbatim; focus on key facts, decisions, preferences, and open tasks.",
  "Include important tool outputs, artifacts, and code references when relevant.",
  "Clearly mark all completed tasks and decisions as DONE so the assistant does not redo them.",
  "If there are pending or incomplete tasks, explicitly list them as PENDING.",
  "Keep the summary under 10k tokens and use concise bullets and short sections.",
].join("\n\n");

export const COMPACTION_USER_PROMPT = "Summarize the conversation above for context compaction.";
