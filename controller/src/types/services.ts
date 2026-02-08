// CRITICAL
export type ServiceId = "llm" | "stt" | "tts" | "image" | "video";

export type ServiceKind = "openai-compatible" | "http-service" | "worker" | "cli-integration";

export type ServiceStatus = "stopped" | "starting" | "ready" | "running" | "error";

export interface ServiceState {
  id: ServiceId;
  kind: ServiceKind;
  runtime: string;
  port: number | null;
  pid: number | null;
  status: ServiceStatus;
  version: string | null;
  last_error: string | null;
  started_at: string | null;
  updated_at: string;
}

