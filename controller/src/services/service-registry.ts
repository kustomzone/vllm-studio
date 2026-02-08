// CRITICAL
import type { ServiceId, ServiceKind } from "../types/services";

export type ServiceDefinition = {
  id: ServiceId;
  kind: ServiceKind;
  runtime: string;
  requiresGpuLease?: boolean;
  /**
   * Optional env var that overrides the CLI binary used by this service.
   * e.g. VLLM_STUDIO_STT_CLI=/usr/local/bin/whisper-cli
   */
  binaryEnvVar?: string;
  /**
   * Default binary name (resolved via PATH / runtime bin dir).
   */
  defaultBinary?: string;
  /**
   * Args used to probe the CLI version.
   */
  versionArgs?: string[];
};

export const SERVICE_DEFINITIONS: ServiceDefinition[] = [
  { id: "llm", kind: "openai-compatible", runtime: "vllm-studio", requiresGpuLease: true },
  {
    id: "stt",
    kind: "cli-integration",
    runtime: "whisper.cpp",
    requiresGpuLease: false,
    binaryEnvVar: "VLLM_STUDIO_STT_CLI",
    defaultBinary: "whisper-cli",
    versionArgs: ["--version"],
  },
  {
    id: "tts",
    kind: "cli-integration",
    runtime: "piper",
    requiresGpuLease: false,
    binaryEnvVar: "VLLM_STUDIO_TTS_CLI",
    defaultBinary: "piper",
    versionArgs: ["--version"],
  },
  {
    id: "image",
    kind: "cli-integration",
    runtime: "stable-diffusion.cpp",
    requiresGpuLease: true,
    binaryEnvVar: "VLLM_STUDIO_IMAGE_CLI",
    defaultBinary: "sd",
    versionArgs: ["--version"],
  },
  { id: "video", kind: "cli-integration", runtime: "unknown", requiresGpuLease: true },
];

export const getServiceDefinition = (id: string): ServiceDefinition | null => {
  const found = SERVICE_DEFINITIONS.find((entry) => entry.id === id);
  return found ?? null;
};
