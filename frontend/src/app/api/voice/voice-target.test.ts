import { describe, expect, it } from "vitest";
import { resolveVoiceTarget, shouldInjectSttModelForTarget } from "./voice-target";
import type { ApiSettings } from "@/lib/api-settings";

const baseSettings: ApiSettings = {
  backendUrl: "http://127.0.0.1:8080",
  apiKey: "",
  voiceUrl: "",
  voiceModel: "whisper-large-v3-turbo",
};

describe("voice-target", () => {
  it("prefers voiceUrl when configured", () => {
    const { targetUrl, isExternalVoiceUrl } = resolveVoiceTarget({
      ...baseSettings,
      voiceUrl: "http://voice.local:9999/",
    });
    expect(targetUrl).toBe("http://voice.local:9999");
    expect(isExternalVoiceUrl).toBe(true);
  });

  it("falls back to backendUrl when voiceUrl is empty", () => {
    const { targetUrl, isExternalVoiceUrl } = resolveVoiceTarget({
      ...baseSettings,
      backendUrl: "http://controller.local:8080/",
      voiceUrl: "",
    });
    expect(targetUrl).toBe("http://controller.local:8080");
    expect(isExternalVoiceUrl).toBe(false);
  });

  it("returns null when both urls are invalid", () => {
    const { targetUrl } = resolveVoiceTarget({
      ...baseSettings,
      backendUrl: "not-a-url",
      voiceUrl: "",
    });
    expect(targetUrl).toBe(null);
  });

  it("only injects STT model for external voice urls", () => {
    expect(
      shouldInjectSttModelForTarget({
        isExternalVoiceUrl: true,
        voiceModel: "whisper-1",
      }),
    ).toBe(true);

    expect(
      shouldInjectSttModelForTarget({
        isExternalVoiceUrl: false,
        voiceModel: "whisper-1",
      }),
    ).toBe(false);
  });
});

