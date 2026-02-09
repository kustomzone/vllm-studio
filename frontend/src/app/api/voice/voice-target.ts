// CRITICAL
import type { ApiSettings } from "@/lib/api-settings";

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function resolveVoiceTarget(settings: ApiSettings): {
  targetUrl: string | null;
  isExternalVoiceUrl: boolean;
} {
  const voiceUrl = normalizeUrl(settings.voiceUrl);
  if (voiceUrl) return { targetUrl: voiceUrl, isExternalVoiceUrl: true };

  const backendUrl = normalizeUrl(settings.backendUrl);
  if (backendUrl) return { targetUrl: backendUrl, isExternalVoiceUrl: false };

  return { targetUrl: null, isExternalVoiceUrl: false };
}

export function shouldInjectSttModelForTarget(args: {
  isExternalVoiceUrl: boolean;
  voiceModel: string;
}): boolean {
  // If a dedicated voice service is configured, honor the user's configured model id.
  // For controller-brokered STT we want the controller's env default (VLLM_STUDIO_STT_MODEL),
  // because the frontend default model name ("whisper-large-v3-turbo") isn't a local file.
  if (!args.isExternalVoiceUrl) return false;
  return args.voiceModel.trim().length > 0;
}

