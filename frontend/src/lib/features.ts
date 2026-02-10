// CRITICAL
const truthy = new Set(["1", "true", "yes", "y", "on"]);

const readLocalFlag = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeLocalFlag = (key: string, enabled: boolean): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, enabled ? "1" : "0");
  } catch {
    // ignore
  }
};

export const isVlmAttachmentsEnabled = (): boolean => {
  const raw =
    (process.env.NEXT_PUBLIC_VLLM_STUDIO_FEATURE_VLM_ATTACHMENTS ??
      process.env.VLLM_STUDIO_FEATURE_VLM_ATTACHMENTS ??
      "").trim().toLowerCase();
  if (truthy.has(raw)) return true;
  const local = (readLocalFlag("vllm-studio.feature.vlm_attachments") ?? "").trim().toLowerCase();
  return truthy.has(local);
};

export const setVlmAttachmentsEnabled = (enabled: boolean): void => {
  writeLocalFlag("vllm-studio.feature.vlm_attachments", enabled);
};

export const isParallaxEnabled = (): boolean => {
  const raw =
    (process.env.NEXT_PUBLIC_VLLM_STUDIO_FEATURE_PARALLAX ??
      process.env.VLLM_STUDIO_FEATURE_PARALLAX ??
      "").trim().toLowerCase();
  if (truthy.has(raw)) return true;
  const local = (readLocalFlag("vllm-studio.feature.parallax") ?? "").trim().toLowerCase();
  return truthy.has(local);
};

export const setParallaxEnabled = (enabled: boolean): void => {
  writeLocalFlag("vllm-studio.feature.parallax", enabled);
};
