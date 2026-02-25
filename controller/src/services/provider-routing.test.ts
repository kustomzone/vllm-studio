import { afterEach, describe, expect, it } from "bun:test";
import {
  DAYTONA_PROVIDER,
  DEFAULT_CHAT_PROVIDER,
  parseProviderModel,
  resolveDaytonaProviderConfig,
  resolveProviderConfig,
} from "./provider-routing";

describe("provider-routing", () => {
  describe("parseProviderModel", () => {
    it("parses provider/model model strings", () => {
      expect(parseProviderModel("daytona/claude-3-5-sonnet-20241022")).toEqual({
        provider: "daytona",
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
      expect(parseProviderModel(" daytona / claude-3-opus-20240229 ")).toEqual({
        provider: "daytona",
        modelId: "claude-3-opus-20240229",
      });
    });
  });

  describe("resolveDaytonaProviderConfig", () => {
    const originalApiUrl = process.env["VLLM_STUDIO_DAYTONA_API_URL"];
    const originalApiKey = process.env["VLLM_STUDIO_DAYTONA_API_KEY"];

    it("returns null when Daytona API key is unavailable", () => {
      delete process.env["VLLM_STUDIO_DAYTONA_API_URL"];
      delete process.env["VLLM_STUDIO_DAYTONA_API_KEY"];
      expect(resolveDaytonaProviderConfig({})).toBeNull();
    });

    it("uses config values when provided", () => {
      expect(
        resolveDaytonaProviderConfig({
          daytonaApiUrl: "https://example.com/daytona",
          daytonaApiKey: " provided-key ",
        })
      ).toEqual({
        baseUrl: "https://example.com/daytona",
        apiKey: "provided-key",
      });
    });

    it("falls back to environment variables when config is missing", () => {
      process.env["VLLM_STUDIO_DAYTONA_API_URL"] = "https://env.daytona.example.com";
      process.env["VLLM_STUDIO_DAYTONA_API_KEY"] = " env-key ";
      expect(resolveDaytonaProviderConfig()).toEqual({
        baseUrl: "https://env.daytona.example.com",
        apiKey: "env-key",
      });
    });

    it("uses default Daytona URL when URL is not configured", () => {
      delete process.env["VLLM_STUDIO_DAYTONA_API_URL"];
      process.env["VLLM_STUDIO_DAYTONA_API_KEY"] = "default-url-key";
      expect(resolveDaytonaProviderConfig()).toEqual({
        baseUrl: "https://app.daytona.io/api",
        apiKey: "default-url-key",
      });
    });

    afterEach(() => {
      if (typeof originalApiUrl === "undefined") {
        delete process.env["VLLM_STUDIO_DAYTONA_API_URL"];
      } else {
        process.env["VLLM_STUDIO_DAYTONA_API_URL"] = originalApiUrl;
      }
      if (typeof originalApiKey === "undefined") {
        delete process.env["VLLM_STUDIO_DAYTONA_API_KEY"];
      } else {
        process.env["VLLM_STUDIO_DAYTONA_API_KEY"] = originalApiKey;
      }
    });
  });

  describe("resolveProviderConfig", () => {
    it("routes daytona provider using resolved config", () => {
      expect(
        resolveProviderConfig(DAYTONA_PROVIDER, {
          daytonaApiKey: "model-key",
          daytonaApiUrl: "https://provider.daytona/api",
        })?.baseUrl
      ).toBe("https://provider.daytona/api");
    });

    it("returns null for unsupported providers", () => {
      expect(resolveProviderConfig("openai")).toBeNull();
      expect(resolveProviderConfig("unknown")).toBeNull();
    });
  });
});
