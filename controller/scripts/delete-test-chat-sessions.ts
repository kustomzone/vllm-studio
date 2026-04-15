// CRITICAL
/**
 * Lists chat sessions that look like E2E / Playwright / automation tests and optionally deletes them.
 *
 * Uses the same chat DB path as the controller (`VLLM_STUDIO_CHATS_DB` or `<data_dir>/chats.db`).
 *
 * Dry run (default):
 *   bun run scripts/delete-test-chat-sessions.ts
 * Delete matched sessions:
 *   bun run scripts/delete-test-chat-sessions.ts --execute
 */
import { existsSync, mkdirSync, rmSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createConfig } from "../src/config/env";
import { migrateChatStore } from "../src/modules/chat/store-schema";
import { openSqliteDatabase } from "../src/stores/sqlite";

const sanitizeSessionId = (sessionId: string): string => {
  const cleaned = sessionId.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return cleaned.length > 0 ? cleaned : "session";
};

const matchesTestTitle = (title: string): boolean => {
  const t = title.trim().toLowerCase();
  if (t.startsWith("e2e:")) return true;
  if (t.includes("playwright")) return true;
  if (t === "playwright chat") return true;
  if (t.includes("(e2e)") || t.includes("[e2e]")) return true;
  return false;
};

const deleteSessionCascade = (db: ReturnType<typeof openSqliteDatabase>, sessionId: string): void => {
  const runs = db.query("SELECT id FROM chat_runs WHERE session_id = ?").all(sessionId) as Array<{ id: string }>;
  for (const r of runs) {
    db.query("DELETE FROM chat_tool_executions WHERE run_id = ?").run(r.id);
    db.query("DELETE FROM chat_run_events WHERE run_id = ?").run(r.id);
  }
  db.query("DELETE FROM chat_runs WHERE session_id = ?").run(sessionId);
  db.query("DELETE FROM chat_agent_file_versions WHERE session_id = ?").run(sessionId);
  db.query("DELETE FROM chat_messages WHERE session_id = ?").run(sessionId);
  db.query("DELETE FROM chat_sessions WHERE id = ?").run(sessionId);
};

const cleanupSessionArtifacts = (dataDir: string, sessionId: string): void => {
  const agentFsDb = resolve(dataDir, "agentfs", `${sanitizeSessionId(sessionId)}.db`);
  if (existsSync(agentFsDb)) {
    try {
      unlinkSync(agentFsDb);
    } catch {
      /* ignore */
    }
  }
  const localTools = resolve(dataDir, "agent-tools-shell", sanitizeSessionId(sessionId));
  if (existsSync(localTools)) {
    try {
      rmSync(localTools, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
};

const execute = process.argv.includes("--execute");

const config = createConfig();
const dbPath = config.chats_db_path;
mkdirSync(dirname(dbPath), { recursive: true });

const db = openSqliteDatabase(dbPath);
migrateChatStore(db);

const rows = db.query("SELECT id, title FROM chat_sessions").all() as Array<{ id: string; title: string }>;
const victims = rows.filter((r) => matchesTestTitle(r.title));

console.log(`Chat database: ${dbPath}`);
console.log(`Matched ${victims.length} session(s)${execute ? "" : " (dry run — add --execute to delete)"}:`);
for (const v of victims) {
  console.log(`  - ${v.id}  "${v.title}"`);
}

if (execute && victims.length > 0) {
  for (const v of victims) {
    deleteSessionCascade(db, v.id);
    cleanupSessionArtifacts(config.data_dir, v.id);
  }
  console.log("Deleted.");
}

db.close();
