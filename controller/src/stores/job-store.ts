// CRITICAL
import { Database } from "bun:sqlite";
import type { JobRecord, JobStatus, JobType } from "../types/jobs";

const nowIso = (): string => new Date().toISOString();

const normalizeLogs = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.map((v) => String(v));
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map((v) => String(v));
    } catch {
      // ignore
    }
  }
  return [];
};

/**
 * Simple durable job persistence for the controller.
 */
export class JobStore {
  private readonly db: Database;

  /**
   * Create a JobStore backed by SQLite.
   * @param dbPath - SQLite database path.
   */
  public constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        progress REAL NOT NULL DEFAULT 0,
        started_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        error TEXT,
        input_json TEXT,
        result_json TEXT,
        logs_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON jobs(updated_at);
    `);
  }

  /**
   * Create a new job record.
   * @param params - Create parameters.
   * @param params.id - Job identifier.
   * @param params.type - Job type.
   * @param params.input - Optional job input payload.
   * @returns Newly created job record.
   */
  public create(params: { id: string; type: JobType; input?: Record<string, unknown> | null }): JobRecord {
    const started_at = nowIso();
    const updated_at = started_at;
    const input_json = params.input ? JSON.stringify(params.input) : null;
    const logs_json = JSON.stringify([]);

    this.db
      .query(
        `INSERT INTO jobs (id, type, status, progress, started_at, updated_at, error, input_json, result_json, logs_json)
         VALUES ($id, $type, $status, $progress, $started_at, $updated_at, $error, $input_json, $result_json, $logs_json)`,
      )
      .run({
        $id: params.id,
        $type: params.type,
        $status: "queued",
        $progress: 0,
        $started_at: started_at,
        $updated_at: updated_at,
        $error: null,
        $input_json: input_json,
        $result_json: null,
        $logs_json: logs_json,
      });

    return this.get(params.id)!;
  }

  /**
   * Get a job by id.
   * @param id - Job identifier.
   * @returns Job record or null.
   */
  public get(id: string): JobRecord | null {
    const row = this.db.query("SELECT * FROM jobs WHERE id = $id").get({ $id: id }) as Record<string, unknown> | null;
    if (!row) return null;
    return this.rowToRecord(row);
  }

  /**
   * List jobs (most recently updated first).
   * @param limit - Max rows.
   * @returns Job list.
   */
  public list(limit = 200): JobRecord[] {
    const rows = this.db
      .query("SELECT * FROM jobs ORDER BY updated_at DESC LIMIT $limit")
      .all({ $limit: limit }) as Array<Record<string, unknown>>;
    return rows.map((row) => this.rowToRecord(row));
  }

  /**
   * Update a job record.
   * @param id - Job identifier.
   * @param patch - Patch fields.
   * @returns Updated job record or null.
   */
  public update(
    id: string,
    patch: Partial<Pick<JobRecord, "status" | "progress" | "error" | "result" | "input">>,
  ): JobRecord | null {
    const current = this.get(id);
    if (!current) return null;

    const next: JobRecord = {
      ...current,
      ...(patch.status ? { status: patch.status } : {}),
      ...(typeof patch.progress === "number" ? { progress: patch.progress } : {}),
      ...(patch.error !== undefined ? { error: patch.error } : {}),
      ...(patch.result !== undefined ? { result: patch.result } : {}),
      ...(patch.input !== undefined ? { input: patch.input } : {}),
      updated_at: nowIso(),
    };

    this.db
      .query(
        `UPDATE jobs
         SET status = $status,
             progress = $progress,
             updated_at = $updated_at,
             error = $error,
             input_json = $input_json,
             result_json = $result_json
         WHERE id = $id`,
      )
      .run({
        $id: id,
        $status: next.status,
        $progress: next.progress,
        $updated_at: next.updated_at,
        $error: next.error,
        $input_json: next.input ? JSON.stringify(next.input) : null,
        $result_json: next.result ? JSON.stringify(next.result) : null,
      });

    return this.get(id);
  }

  /**
   * Append a log line to a job.
   * @param id - Job identifier.
   * @param line - Log line.
   * @returns Updated job record or null.
   */
  public appendLog(id: string, line: string): JobRecord | null {
    const current = this.get(id);
    if (!current) return null;
    const logs = [...(current.logs ?? []), line];

    this.db
      .query("UPDATE jobs SET logs_json = $logs_json, updated_at = $updated_at WHERE id = $id")
      .run({
        $id: id,
        $logs_json: JSON.stringify(logs),
        $updated_at: nowIso(),
      });

    return this.get(id);
  }

  /**
   * Map a SQLite row into a JobRecord.
   * @param row - Raw row fields.
   * @returns Job record.
   */
  private rowToRecord(row: Record<string, unknown>): JobRecord {
    const parseJson = (value: unknown): Record<string, unknown> | null => {
      if (!value) return null;
      if (typeof value !== "string") return null;
      try {
        const parsed = JSON.parse(value) as unknown;
        if (!parsed || typeof parsed !== "object") return null;
        return parsed as Record<string, unknown>;
      } catch {
        return null;
      }
    };

    const statusRaw = String(row["status"] ?? "queued") as JobStatus;
    const status: JobStatus =
      statusRaw === "queued" || statusRaw === "running" || statusRaw === "completed" || statusRaw === "failed" || statusRaw === "cancelled"
        ? statusRaw
        : "queued";
    const typeRaw = String(row["type"] ?? "voice_assistant_turn") as JobType;
    const type: JobType = typeRaw === "voice_assistant_turn" ? typeRaw : "voice_assistant_turn";

    return {
      id: String(row["id"] ?? ""),
      type,
      status,
      progress: typeof row["progress"] === "number" ? row["progress"] : Number(row["progress"] ?? 0),
      started_at: String(row["started_at"] ?? nowIso()),
      updated_at: String(row["updated_at"] ?? nowIso()),
      error: row["error"] ? String(row["error"]) : null,
      input: parseJson(row["input_json"]),
      result: parseJson(row["result_json"]),
      logs: normalizeLogs(row["logs_json"]),
    };
  }
}
