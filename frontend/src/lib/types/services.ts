// CRITICAL
export type ServiceId = "llm" | "stt" | "tts" | "image" | "video";

export type ServiceStatus = "stopped" | "starting" | "ready" | "running" | "error";

export type ServiceKind = "openai-compatible" | "http-service" | "worker" | "cli-integration";

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

export interface GpuLease {
  holder_service_id: ServiceId;
  acquired_at: string;
  reason?: string | null;
}
