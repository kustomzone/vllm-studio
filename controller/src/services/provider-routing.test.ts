import { describe, expect, it } from "bun:test";
import { DEFAULT_CHAT_PROVIDER, parseProviderModel, resolveProviderConfig } from "./provider-routing";

describe("provider-routing", () => {
  describe("parseProviderModel", () => {
    it("parses provider/model model strings", () => {
      expect(parseProviderModel("anthropic/claude-3-5-sonnet-20241022")).toEqual({
        provider: "anthropic",
        modelId: "claude-3-5-sonnet-20241022",
      });
    });

    it("falls back to default provider when no prefix is present", () => {
      expect(parseProviderModel("gpt-4o-mini")).toEqual({
        provider: DEFAULT_CHAT_PROVIDER,
        modelId: "gpt-4o-mini",
      });
    });

    it("normalizes whitespace in provider and model", () => {
      expect(parseProviderModel(" anthropic / claude-3-opus-20240229 ")).toEqual({
        provider: "anthropic",
        modelId: "claude-3-opus-20240229",
      });
    });
  });

  describe("resolveProviderConfig", () => {
    it("routes configured providers from persisted settings", () => {
      expect(
        resolveProviderConfig("anthropic", {
          providers: [
            {
              id: "anthropic",
              name: "Anthropic",
              base_url: "https://api.anthropic.com",
              api_key: "model-key",
              enabled: true,
            },
          ],
        })?.baseUrl
      ).toBe("https://api.anthropic.com");
    });

    it("returns null for unsupported providers", () => {
      expect(resolveProviderConfig("openai")).toBeNull();
      expect(resolveProviderConfig("unknown")).toBeNull();
    });
  });
});
