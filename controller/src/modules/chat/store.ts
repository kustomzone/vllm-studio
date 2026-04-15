// CRITICAL
import { randomUUID } from "node:crypto";
import { hydrateMessageRow, hydrateSessionRow } from "./store-hydration";
import { migrateChatStore } from "./store-schema";
import * as RunOps from "./store-runs";
import { openSqliteDatabase } from "../../stores/sqlite";
import type {
  ChatAgentFileVersion,
  ChatAgentFileVersionWrite,
  ChatMessage,
  ChatRun,
  ChatRunEvent,
  ChatSession,
  ChatSessionListItem,
  ChatSessionSummary,
  ChatToolExecution,
  ChatUsage,
} from "../../types/chat";

export class ChatStore {
  private readonly db: ReturnType<typeof openSqliteDatabase>;

  public constructor(dbPath: string) {
    this.db = openSqliteDatabase(dbPath);
    this.migrate();
  }

  private migrate(): void {
    migrateChatStore(this.db);
  }

  public listSessions(): Array<ChatSessionListItem> {
    const rows = this.db
      .query(
        `SELECT cs.id, cs.title, cs.model, cs.parent_id, cs.created_at, cs.updated_at,
          (SELECT substr(cm.content, 1, 120) FROM chat_messages cm
           WHERE cm.session_id = cs.id AND cm.role = 'user'
           ORDER BY cm.created_at ASC LIMIT 1) AS first_user_message
         FROM chat_sessions cs ORDER BY cs.updated_at DESC`
      )
      .all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({ ...row }) as ChatSessionListItem);
  }

  public getSessionSummary(sessionId: string): ChatSessionSummary | null {
    const session = hydrateSessionRow(
      this.db
        .query(
          "SELECT id, title, model, parent_id, agent_state, created_at, updated_at FROM chat_sessions WHERE id = ?"
        )
        .get(sessionId) as Record<string, unknown> | null
    );
    return session ? ({ ...session } as ChatSessionSummary) : null;
  }

  public getSession(sessionId: string): ChatSession | null {
    const rawSession = this.db
      .query(
        "SELECT id, title, model, parent_id, agent_state, created_at, updated_at FROM chat_sessions WHERE id = ?"
      )
      .get(sessionId) as Record<string, unknown> | null;
    const session = hydrateSessionRow(rawSession);
    if (!session) {
      return null;
    }

    const messages = this.db
      .query(
        `SELECT id, role, content, model, tool_calls, tool_call_id, name, parts, metadata,
              request_prompt_tokens, request_tools_tokens, request_total_input_tokens, request_completion_tokens,
              created_at
              FROM chat_messages WHERE session_id = ? ORDER BY created_at, rowid`
      )
      .all(sessionId) as Array<Record<string, unknown>>;

    const hydrated = messages.map((message) => hydrateMessageRow(message));

    return { ...session, messages: hydrated } as ChatSession;
  }

  public createSession(
    sessionId: string,
    title = "New Chat",
    model?: string,
    parentId?: string,
    agentState?: unknown
  ): ChatSessionSummary {
    const agentStateJson =
      agentState !== undefined && agentState !== null ? JSON.stringify(agentState) : null;
    this.db
      .query(
        "INSERT INTO chat_sessions (id, title, model, parent_id, agent_state) VALUES (?, ?, ?, ?, ?)"
      )
      .run(sessionId, title, model ?? null, parentId ?? null, agentStateJson);
    const row = this.db
      .query(
        "SELECT id, title, model, parent_id, agent_state, created_at, updated_at FROM chat_sessions WHERE id = ?"
      )
      .get(sessionId) as Record<string, unknown>;
    const hydrated = hydrateSessionRow(row);
    return { ...(hydrated ?? row) } as ChatSessionSummary;
  }

  public updateSession(
    sessionId: string,
    title?: string,
    model?: string,
    agentState?: unknown
  ): boolean {
    const updates: string[] = [];
    const params: Array<string | null> = [];
    if (title !== undefined) {
      updates.push("title = ?");
      params.push(title);
    }
    if (model !== undefined) {
      updates.push("model = ?");
      params.push(model);
    }
    if (agentState !== undefined) {
      updates.push("agent_state = ?");
      params.push(agentState === null ? null : JSON.stringify(agentState));
    }
    if (updates.length === 0) {
      return true;
    }
    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(sessionId);
    const result = this.db
      .query(`UPDATE chat_sessions SET ${updates.join(", ")} WHERE id = ?`)
      .run(...params);
    return result.changes > 0;
  }

  public deleteSession(sessionId: string): boolean {
    this.db.query("DELETE FROM chat_messages WHERE session_id = ?").run(sessionId);
    const result = this.db.query("DELETE FROM chat_sessions WHERE id = ?").run(sessionId);
    return result.changes > 0;
  }

  public addMessage(
    sessionId: string,
    messageId: string,
    role: string,
    content?: string,
    model?: string,
    toolCalls?: unknown[],
    promptTokens?: number,
    toolsTokens?: number,
    totalInputTokens?: number,
    completionTokens?: number,
    parts?: unknown[],
    metadata?: unknown,
    toolCallId?: string,
    name?: string
  ): ChatMessage {
    const toolCallsJson = toolCalls ? JSON.stringify(toolCalls) : null;
    const partsJson = parts ? JSON.stringify(parts) : null;
    const metadataJson =
      metadata !== undefined && metadata !== null ? JSON.stringify(metadata) : null;
    this.db
      .query(
        `INSERT INTO chat_messages
      (id, session_id, role, content, model, tool_calls, tool_call_id, name, parts, metadata,
       request_prompt_tokens, request_tools_tokens, request_total_input_tokens, request_completion_tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        role = excluded.role,
        model = excluded.model,
        content = excluded.content,
        tool_calls = excluded.tool_calls,
        tool_call_id = excluded.tool_call_id,
        name = excluded.name,
        parts = excluded.parts,
        metadata = excluded.metadata,
        request_prompt_tokens = excluded.request_prompt_tokens,
        request_tools_tokens = excluded.request_tools_tokens,
        request_total_input_tokens = excluded.request_total_input_tokens,
        request_completion_tokens = excluded.request_completion_tokens`
      )
      .run(
        messageId,
        sessionId,
        role,
        content ?? null,
        model ?? null,
        toolCallsJson,
        toolCallId ?? null,
        name ?? null,
        partsJson,
        metadataJson,
        promptTokens ?? null,
        toolsTokens ?? null,
        totalInputTokens ?? null,
        completionTokens ?? null
      );
    this.db
      .query("UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(sessionId);
    const row = this.db
      .query(
        `SELECT id, role, content, model, tool_calls, tool_call_id, name, parts, metadata,
         request_prompt_tokens, request_tools_tokens, request_total_input_tokens, request_completion_tokens, created_at
         FROM chat_messages WHERE id = ?`
      )
      .get(messageId) as Record<string, unknown>;
    return hydrateMessageRow(row);
  }

  public getUsage(sessionId: string): ChatUsage {
    const row = this.db
      .query(
        `SELECT
          SUM(
            CASE
              WHEN COALESCE(request_total_input_tokens, 0) > 0 THEN COALESCE(request_total_input_tokens, 0)
              ELSE COALESCE(request_prompt_tokens, 0)
            END
          ) AS prompt_tokens,
          SUM(COALESCE(request_completion_tokens, 0)) AS completion_tokens
         FROM chat_messages
         WHERE session_id = ?`
      )
      .get(sessionId) as {
      prompt_tokens?: number | null;
      completion_tokens?: number | null;
    } | null;

    const prompt = Number(row?.prompt_tokens ?? 0);
    const completion = Number(row?.completion_tokens ?? 0);
    return {
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: prompt + completion,
    };
  }

  public forkSession(
    sessionId: string,
    newId: string,
    messageId?: string,
    model?: string,
    title?: string
  ): ChatSessionSummary | null {
    const toNullableString = (value: unknown): string | null => {
      if (value === null || value === undefined) {
        return null;
      }
      return String(value);
    };

    const toNullableNumber = (value: unknown): number | null => {
      if (value === null || value === undefined) {
        return null;
      }
      const parsed = Number(value);
      return Number.isNaN(parsed) ? null : parsed;
    };

    const original = this.getSession(sessionId);
    if (!original) {
      return null;
    }
    const newTitle = title ?? `${String(original["title"])} (fork)`;
    const newModel = model ?? (original["model"] ? String(original["model"]) : undefined);
    const agentState = original["agent_state"] ?? null;
    const agentStateJson = agentState !== null ? JSON.stringify(agentState) : null;

    this.db
      .query(
        "INSERT INTO chat_sessions (id, title, model, parent_id, agent_state) VALUES (?, ?, ?, ?, ?)"
      )
      .run(newId, newTitle, newModel ?? null, sessionId, agentStateJson);

    const messages = (original["messages"] ?? []) as Array<Record<string, unknown>>;
    const insertMessage = this.db.query(
      `INSERT INTO chat_messages
       (id, session_id, role, content, model, tool_calls, tool_call_id, name, parts, metadata,
        request_prompt_tokens, request_tools_tokens, request_total_input_tokens, request_completion_tokens)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const tx = this.db.transaction(() => {
      for (const message of messages) {
        const toolCallsJson = message["tool_calls"] ? JSON.stringify(message["tool_calls"]) : null;
        const partsJson = message["parts"] ? JSON.stringify(message["parts"]) : null;
        const metadataJson = message["metadata"] ? JSON.stringify(message["metadata"]) : null;
        const newMessageId = `${newId}_${String(message["id"])}`;
        const role = String(message["role"] ?? "");
        const content = toNullableString(message["content"]);
        const messageModel = toNullableString(message["model"]);
        const toolCallId = toNullableString(message["tool_call_id"]);
        const toolName = toNullableString(message["name"]);
        const promptTokens = toNullableNumber(message["request_prompt_tokens"]);
        const toolTokens = toNullableNumber(message["request_tools_tokens"]);
        const totalTokens = toNullableNumber(message["request_total_input_tokens"]);
        const completionTokens = toNullableNumber(message["request_completion_tokens"]);

        insertMessage.run(
          newMessageId,
          newId,
          role,
          content,
          messageModel,
          toolCallsJson,
          toolCallId,
          toolName,
          partsJson,
          metadataJson,
          promptTokens,
          toolTokens,
          totalTokens,
          completionTokens
        );

        if (messageId && message["id"] === messageId) {
          break;
        }
      }
    });

    tx();

    const row = this.db
      .query(
        "SELECT id, title, model, parent_id, agent_state, created_at, updated_at FROM chat_sessions WHERE id = ?"
      )
      .get(newId) as Record<string, unknown>;
    const hydrated = hydrateSessionRow(row);
    return { ...(hydrated ?? row) } as ChatSessionSummary;
  }

  public createRun(
    runId: string,
    sessionId: string,
    options: {
      userMessageId?: string;
      model?: string;
      system?: string;
      toolsetId?: string;
      status?: string;
    } = {}
  ): ChatRun {
    return RunOps.createRun(this.db, runId, sessionId, options);
  }

  public addRunEvent(
    runId: string,
    seq: number,
    type: string,
    data: Record<string, unknown>,
    eventId: string = randomUUID()
  ): ChatRunEvent {
    return RunOps.addRunEvent(this.db, runId, seq, type, data, eventId);
  }

  public addToolExecution(
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
    } = {}
  ): ChatToolExecution {
    return RunOps.addToolExecution(this.db, runId, toolCallId, toolName, options);
  }

  public updateRun(
    runId: string,
    updates: {
      status?: string;
      finishedAt?: string | null;
    }
  ): boolean {
    return RunOps.updateRun(this.db, runId, updates);
  }

  /** Append a version snapshot, deduplicating if content hasn't changed. */
  public addAgentFileVersion(
    sessionId: string,
    path: string,
    content: string,
    bytes?: number | null
  ): ChatAgentFileVersionWrite {
    const last = this.db
      .query(
        "SELECT version, content FROM chat_agent_file_versions WHERE session_id = ? AND path = ? ORDER BY version DESC LIMIT 1"
      )
      .get(sessionId, path) as { version?: number; content?: string } | null;

    if (last && typeof last.content === "string" && last.content === content) {
      return {
        version: typeof last.version === "number" ? last.version : 1,
        created_at_ms: Date.now(),
      };
    }

    const nextVersion = (typeof last?.version === "number" ? last.version : 0) + 1;
    const createdAtMs = Date.now();
    this.db
      .query(
        `INSERT INTO chat_agent_file_versions
         (id, session_id, path, version, content, bytes, created_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(randomUUID(), sessionId, path, nextVersion, content, bytes ?? null, createdAtMs);

    return { version: nextVersion, created_at_ms: createdAtMs };
  }

  public listAgentFileVersions(sessionId: string, path: string): Array<ChatAgentFileVersion> {
    const rows = this.db
      .query(
        "SELECT version, content, created_at_ms FROM chat_agent_file_versions WHERE session_id = ? AND path = ? ORDER BY version ASC"
      )
      .all(sessionId, path) as Array<Record<string, unknown>>;
    return rows.map((row) => ({ ...row }) as ChatAgentFileVersion);
  }

  /** Deletes exact path or all descendants if path is a directory. */
  public deleteAgentFileVersionsForPath(sessionId: string, path: string): void {
    const trimmed = (path ?? "").trim();
    if (!trimmed) {
      this.db.query("DELETE FROM chat_agent_file_versions WHERE session_id = ?").run(sessionId);
      return;
    }
    this.db
      .query(
        "DELETE FROM chat_agent_file_versions WHERE session_id = ? AND (path = ? OR path LIKE ?)"
      )
      .run(sessionId, trimmed, `${trimmed}/%`);
  }

  /** Re-parents file versions from `from` to `to`, continuing the version sequence. */
  public moveAgentFileVersions(sessionId: string, from: string, to: string): void {
    if (!from || !to || from === to) return;

    const sourceRows = this.db
      .query(
        "SELECT version, content, bytes, created_at_ms FROM chat_agent_file_versions WHERE session_id = ? AND path = ? ORDER BY version ASC"
      )
      .all(sessionId, from) as Array<{
      version: number;
      content: string;
      bytes?: number | null;
      created_at_ms: number;
    }>;

    if (sourceRows.length === 0) return;

    const destinationMax = this.db
      .query(
        "SELECT MAX(version) AS max_version FROM chat_agent_file_versions WHERE session_id = ? AND path = ?"
      )
      .get(sessionId, to) as { max_version?: number | null } | null;
    const offset =
      (typeof destinationMax?.max_version === "number" ? destinationMax.max_version : 0) ?? 0;

    const tx = this.db.transaction(() => {
      for (let index = 0; index < sourceRows.length; index += 1) {
        const row = sourceRows[index]!;
        const nextVersion = offset + index + 1;
        this.db
          .query(
            `INSERT INTO chat_agent_file_versions
             (id, session_id, path, version, content, bytes, created_at_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            randomUUID(),
            sessionId,
            to,
            nextVersion,
            row.content,
            row.bytes ?? null,
            row.created_at_ms
          );
      }
      this.db
        .query("DELETE FROM chat_agent_file_versions WHERE session_id = ? AND path = ?")
        .run(sessionId, from);
    });

    tx();
  }
}
