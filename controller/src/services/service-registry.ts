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
    // whisper-cli doesn't consistently support --version across builds; prefer a non-error probe.
    versionArgs: ["--help"],
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
    // stable-diffusion.cpp's CLI is often `sd-cli` and doesn't always support --version; help output includes a version line.
    versionArgs: ["--help"],
  },
  { id: "video", kind: "cli-integration", runtime: "unknown", requiresGpuLease: true },
];

export const getServiceDefinition = (id: string): ServiceDefinition | null => {
  const found = SERVICE_DEFINITIONS.find((entry) => entry.id === id);
  return found ?? null;
};
