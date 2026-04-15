// CRITICAL
import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { parseJsonOrNull } from "./store-hydration";
import type { ChatRun, ChatRunEvent, ChatToolExecution } from "../../types/chat";

export function createRun(
  db: Database,
  runId: string,
  sessionId: string,
  options: {
    userMessageId?: string;
    model?: string;
    system?: string;
    toolsetId?: string;
    status?: string;
  } = {},
): ChatRun {
  db.query(
    `INSERT INTO chat_runs
    (id, session_id, user_message_id, model, system, toolset_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    runId,
    sessionId,
    options.userMessageId ?? null,
    options.model ?? null,
    options.system ?? null,
    options.toolsetId ?? null,
    options.status ?? "running",
  );
  return db
    .query(
      `SELECT id, session_id, user_message_id, model, system, toolset_id, created_at, updated_at, finished_at, status
       FROM chat_runs WHERE id = ?`,
    )
    .get(runId) as ChatRun;
}

export function addRunEvent(
  db: Database,
  runId: string,
  seq: number,
  type: string,
  data: Record<string, unknown>,
  eventId: string = randomUUID(),
): ChatRunEvent {
  const dataJson = JSON.stringify(data);
  db.query(
    `INSERT INTO chat_run_events (id, run_id, seq, type, data)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(eventId, runId, seq, type, dataJson);
  const row = db
    .query("SELECT id, run_id, seq, type, data, created_at FROM chat_run_events WHERE id = ?")
    .get(eventId) as Record<string, unknown>;
  if (typeof row["data"] === "string") {
    row["data"] = parseJsonOrNull(row["data"]);
  }
  return row as ChatRunEvent;
}

export function addToolExecution(
  db: Database,
  runId: string,
  toolCallId: string,
  toolName: string,
  options: {
    toolServer?: string;
    arguments?: Record<string, unknown> | string;
    resultText?: string | null;
    isError?: boolean;
    startedAt?: string;
    finishedAt?: string;
    id?: string;
  } = {},
): ChatToolExecution {
  const argumentsJson =
    typeof options.arguments === "string" ? options.arguments : JSON.stringify(options.arguments ?? {});
  const id = options.id ?? randomUUID();
  db.query(
    `INSERT INTO chat_tool_executions
    (id, run_id, tool_call_id, tool_name, tool_server, arguments_json, result_text, is_error, started_at, finished_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    runId,
    toolCallId,
    toolName,
    options.toolServer ?? null,
    argumentsJson,
    options.resultText ?? null,
    options.isError ? 1 : 0,
    options.startedAt ?? null,
    options.finishedAt ?? null,
  );
  return db
    .query(
      `SELECT id, run_id, tool_call_id, tool_name, tool_server, arguments_json, result_text, is_error,
       started_at, finished_at FROM chat_tool_executions WHERE id = ?`,
    )
    .get(id) as ChatToolExecution;
}

export function updateRun(
  db: Database,
  runId: string,
  updates: {
    status?: string;
    finishedAt?: string | null;
  },
): boolean {
  const assignments: string[] = [];
  const params: Array<string | null> = [];

  if (updates.status !== undefined) {
    assignments.push("status = ?");
    params.push(updates.status ?? null);
  }

  if (updates.finishedAt !== undefined) {
    assignments.push("finished_at = ?");
    params.push(updates.finishedAt ?? null);
  }

  if (assignments.length === 0) return false;

  assignments.push("updated_at = CURRENT_TIMESTAMP");
  const statement = `UPDATE chat_runs SET ${assignments.join(", ")} WHERE id = ?`;
  params.push(runId);
  const result = db.query(statement).run(...params);
  return result.changes > 0;
}
