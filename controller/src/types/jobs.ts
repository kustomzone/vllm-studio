// CRITICAL

export type JobType = "voice_assistant_turn";

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface JobRecord {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number; // 0..1
  started_at: string;
  updated_at: string;
  error: string | null;
  input: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  logs: string[];
}

