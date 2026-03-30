/**
 * JobStore adapter — wraps upstream JobManager/Store.
 */
import type { JobRecord, JobStore } from "../interfaces";
import { JOB_STATUS } from "../contracts";

export interface UpstreamJobManager {
  createJob(
    type: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  getJob(id: string): Record<string, unknown> | null;
  listJobs(limit?: number): Record<string, unknown>[];
}

function toRecord(raw: Record<string, unknown>): JobRecord {
  const logs = typeof raw["logs"] === "string"
    ? (JSON.parse(raw["logs"] as string) as string[])
    : Array.isArray(raw["logs"])
      ? (raw["logs"] as string[])
      : [];
  return {
    id: String(raw["id"] ?? ""),
    type: String(raw["type"] ?? ""),
    status: (raw["status"] as JobRecord["status"]) ?? JOB_STATUS.QUEUED,
    progress: Number(raw["progress"] ?? 0),
    createdAt: String(raw["created_at"] ?? ""),
    updatedAt: String(raw["updated_at"] ?? ""),
    input: raw["input"],
    result: raw["result"] ?? undefined,
    error: raw["error"] != null ? String(raw["error"]) : "",
    logs,
  };
}

export class JobStoreAdapter implements JobStore {
  private readonly manager: UpstreamJobManager;

  constructor(manager: UpstreamJobManager) {
    this.manager = manager;
  }

  create(type: string, input: unknown): JobRecord {
    const ts = new Date().toISOString();
    return {
      id: `job-${crypto.randomUUID().slice(0, 8)}`,
      type,
      status: JOB_STATUS.QUEUED,
      progress: 0,
      createdAt: ts,
      updatedAt: ts,
      input,
      logs: [],
    };
  }

  update(jobId: string, patch: Partial<JobRecord>): JobRecord {
    const raw = this.manager.getJob(jobId);
    if (!raw) throw new Error(`Unknown job: ${jobId}`);
    const record = toRecord(raw);
    return { ...record, ...patch, updatedAt: new Date().toISOString() };
  }

  list(): JobRecord[] {
    return this.manager.listJobs().map(toRecord);
  }
}
