// CRITICAL
const truthy = new Set(["1", "true", "yes", "y", "on"]);

export const isVlmAttachmentsEnabled = (): boolean => {
  const raw = (process.env["VLLM_STUDIO_FEATURE_VLM_ATTACHMENTS"] || "").trim().toLowerCase();
  return truthy.has(raw);
};

