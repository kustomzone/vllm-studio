export type UpstreamConfig = {
  baseUrl: string;
  apiKey?: string;
};

export type ControllerNewConfig = {
  port: number;
  controlPlane: UpstreamConfig;
  v1: {
    default: UpstreamConfig;
    chat: UpstreamConfig;
    responses: UpstreamConfig;
    embeddings: UpstreamConfig;
    images: UpstreamConfig;
    audio: UpstreamConfig;
  };
};

function requireUrl(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  // Validate URL format early
  // eslint-disable-next-line no-new
  new URL(value);
  return value;
}

function optionalUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  // eslint-disable-next-line no-new
  new URL(value);
  return value;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function upstream(baseUrl: string, apiKey?: string): UpstreamConfig {
  return {
    baseUrl,
    apiKey: apiKey?.trim() || undefined,
  };
}

export function loadConfig(): ControllerNewConfig {
  const port = envInt("PORT", envInt("VLLM_STUDIO_PORT", 8081));

  const controlPlaneBaseUrl = requireUrl(
    "VLLM_STUDIO_CONTROL_PLANE_BASE_URL",
    process.env.VLLM_STUDIO_CONTROL_PLANE_BASE_URL ?? "http://localhost:8080",
  );

  const v1DefaultBaseUrl = optionalUrl(process.env.VLLM_STUDIO_V1_DEFAULT_BASE_URL) ??
    controlPlaneBaseUrl;

  const cfg: ControllerNewConfig = {
    port,
    controlPlane: upstream(controlPlaneBaseUrl),
    v1: {
      default: upstream(v1DefaultBaseUrl, process.env.VLLM_STUDIO_V1_DEFAULT_API_KEY),
      chat: upstream(
        optionalUrl(process.env.VLLM_STUDIO_V1_CHAT_BASE_URL) ?? v1DefaultBaseUrl,
        process.env.VLLM_STUDIO_V1_CHAT_API_KEY,
      ),
      responses: upstream(
        optionalUrl(process.env.VLLM_STUDIO_V1_RESPONSES_BASE_URL) ?? v1DefaultBaseUrl,
        process.env.VLLM_STUDIO_V1_RESPONSES_API_KEY,
      ),
      embeddings: upstream(
        optionalUrl(process.env.VLLM_STUDIO_V1_EMBEDDINGS_BASE_URL) ?? v1DefaultBaseUrl,
        process.env.VLLM_STUDIO_V1_EMBEDDINGS_API_KEY,
      ),
      images: upstream(
        optionalUrl(process.env.VLLM_STUDIO_V1_IMAGES_BASE_URL) ?? v1DefaultBaseUrl,
        process.env.VLLM_STUDIO_V1_IMAGES_API_KEY,
      ),
      audio: upstream(
        optionalUrl(process.env.VLLM_STUDIO_V1_AUDIO_BASE_URL) ?? v1DefaultBaseUrl,
        process.env.VLLM_STUDIO_V1_AUDIO_API_KEY,
      ),
    },
  };

  return cfg;
}

export function getPublicConfig(cfg: ControllerNewConfig) {
  return {
    port: cfg.port,
    controlPlaneBaseUrl: cfg.controlPlane.baseUrl,
    v1: {
      defaultBaseUrl: cfg.v1.default.baseUrl,
      chatBaseUrl: cfg.v1.chat.baseUrl,
      responsesBaseUrl: cfg.v1.responses.baseUrl,
      embeddingsBaseUrl: cfg.v1.embeddings.baseUrl,
      imagesBaseUrl: cfg.v1.images.baseUrl,
      audioBaseUrl: cfg.v1.audio.baseUrl,
    },
  };
}
