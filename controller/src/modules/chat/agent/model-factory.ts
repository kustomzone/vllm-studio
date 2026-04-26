// CRITICAL
import { AGENT_DEFAULT_OPENAI_PROVIDER } from "./configs";
import type { AgentModel } from "./pi-agent-types";

export const createOpenAiCompatibleModel = (
  modelId: string,
  baseUrl: string,
  provider = AGENT_DEFAULT_OPENAI_PROVIDER
): AgentModel<"openai-completions"> => {
  const normalizedProvider =
    typeof provider === "string" && provider.trim().length > 0
      ? provider.trim()
      : AGENT_DEFAULT_OPENAI_PROVIDER;
  return {
    id: modelId,
    name: modelId,
    api: "openai-completions",
    provider: normalizedProvider,
    baseUrl,
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 16_384,
    compat: {
      maxTokensField: "max_tokens",
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
      supportsStore: false,
      supportsUsageInStreaming: true,
    },
  };
};
