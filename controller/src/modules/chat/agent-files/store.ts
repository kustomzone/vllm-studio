// CRITICAL
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { AgentFS } from "agentfs-sdk";
import type { AppContext } from "../../../types/context";
import type { Config } from "../../../config/env";
import {
  getDaytonaToolboxClient,
  isDaytonaAgentModeEnabled,
} from "../../../services/daytona/toolbox-client";
import { DaytonaAgentFsApi } from "./daytona-agentfs";
import { FallbackAgentFsApi } from "./fallback-agentfs";
import type { AgentFsApi } from "./types";

const agentFsCache = new Map<string, Promise<AgentFS>>();
const daytonaFsCache = new Map<string, DaytonaAgentFsApi>();
const fallbackFsCache = new Map<string, FallbackAgentFsApi>();

const sanitizeSessionId = (sessionId: string): string => {
  const cleaned = sessionId.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return cleaned.length > 0 ? cleaned : "session";
};

const ensureAgentFsRoot = (context: AppContext): string => {
  const root = resolve(context.config.data_dir, "agentfs");
  mkdirSync(root, { recursive: true });
  return root;
};

const isLocalAgentFsFallbackEnabled = (config: Config): boolean => {
  return config.agent_fs_local_fallback === true;
};

export const isAgentFsEnabled = (config: Config): boolean => {
  return isDaytonaAgentModeEnabled(config) || isLocalAgentFsFallbackEnabled(config);
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
  const daytonaEnabled = isDaytonaAgentModeEnabled(context.config);
  const localFallbackEnabled = isLocalAgentFsFallbackEnabled(context.config);

  if (daytonaEnabled) {
    const daytonaCached = daytonaFsCache.get(sessionId);
    const daytonaFs =
      daytonaCached ??
      ((): DaytonaAgentFsApi => {
        const client = getDaytonaToolboxClient(context.config);
        const fs = new DaytonaAgentFsApi(client, sessionId);
        daytonaFsCache.set(sessionId, fs);
        return fs;
      })();

    if (!localFallbackEnabled) {
      return { fs: daytonaFs };
    }

    const fallbackCached = fallbackFsCache.get(sessionId);
    if (fallbackCached) {
      return { fs: fallbackCached };
    }

    const fallbackFs = new FallbackAgentFsApi(daytonaFs, () => getLocalFsApi(context, sessionId), (error) => {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(
        `[AgentFS] Daytona filesystem unavailable for session ${sessionId}; falling back to local AgentFS. Reason: ${reason}`
      );
    });
    fallbackFsCache.set(sessionId, fallbackFs);
    return { fs: fallbackFs };
  }

  if (localFallbackEnabled) {
    return { fs: await getLocalFsApi(context, sessionId) };
  }

  throw new Error(
    "Daytona agent mode is required for agent filesystem access (set VLLM_STUDIO_AGENT_FS_LOCAL_FALLBACK=true to enable local fallback)"
  );
};
