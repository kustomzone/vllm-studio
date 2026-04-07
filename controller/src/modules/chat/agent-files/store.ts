// CRITICAL
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { AgentFS } from "agentfs-sdk";
import type { AppContext } from "../../../types/context";
import type { AgentFsApi } from "./types";

const agentFsCache = new Map<string, Promise<AgentFS>>();

const sanitizeSessionId = (sessionId: string): string => {
  const cleaned = sessionId.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return cleaned.length > 0 ? cleaned : "session";
};

const ensureAgentFsRoot = (context: AppContext): string => {
  const root = resolve(context.config.data_dir, "agentfs");
  mkdirSync(root, { recursive: true });
  return root;
};

export const getAgentFs = (context: AppContext, sessionId: string): Promise<AgentFS> => {
  const root = ensureAgentFsRoot(context);
  const dbPath = resolve(root, `${sanitizeSessionId(sessionId)}.db`);
  const cached = agentFsCache.get(dbPath);
  if (cached) return cached;

  const opened = AgentFS.open({ id: sessionId, path: dbPath }).catch((error) => {
    agentFsCache.delete(dbPath);
    throw error;
  });
  agentFsCache.set(dbPath, opened);
  return opened;
};

const getLocalFsApi = async (context: AppContext, sessionId: string): Promise<AgentFsApi> => {
  const local = await getAgentFs(context, sessionId);
  return local.fs as AgentFsApi;
};

export const getSessionFsApi = async (
  context: AppContext,
  sessionId: string
): Promise<{ fs: AgentFsApi }> => {
  return { fs: await getLocalFsApi(context, sessionId) };
};
