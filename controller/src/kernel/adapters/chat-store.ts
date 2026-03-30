/**
 * ChatStore adapter — wraps upstream SQLite ChatStore.
 *
 * The upstream store uses a different shape (snake_case, raw IDs passed in,
 * rich message fields). This adapter normalizes to the kernel ChatStore port.
 */
import type {
  ChatMessage,
  ChatRun,
  ChatSession,
  ChatStore,
} from "../interfaces";
import type { RunStatus } from "../contracts";
import { RUN_STATUS } from "../contracts";

export interface UpstreamChatStore {
  createSession(
    sessionId: string,
    title?: string,
    model?: string,
  ): { id: string; title: string; model: string | null; created_at: string; updated_at: string };
  getSession(sessionId: string): {
    id: string;
    title: string;
    model: string | null;
    created_at: string;
    updated_at: string;
    messages: Array<{
      id: string;
      role: string;
      content: string | null;
      model: string | null;
      created_at: string;
    }>;
  } | null;
  listSessions(): Array<{
    id: string;
    title: string;
    model: string | null;
    created_at: string;
    updated_at: string;
  }>;
  deleteSession(sessionId: string): boolean;
  addMessage(
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
    name?: string,
  ): { id: string; role: string; content: string | null; model: string | null; created_at: string };
  createRun(
    runId: string,
    sessionId: string,
    options?: { userMessageId?: string; model?: string; system?: string; toolsetId?: string; status?: string },
  ): { id: string; session_id: string; model: string | null; status: string; created_at: string; updated_at: string };
  updateRun(
    runId: string,
    updates: { status?: string; finishedAt?: string | null },
  ): boolean;
}

let _counter = 0;
const nextId = (prefix: string): string =>
  `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

export class ChatStoreAdapter implements ChatStore {
  private readonly upstream: UpstreamChatStore;
  /** In-memory run index for kernel-level run tracking. */
  private readonly runs = new Map<
    string,
    ChatRun
  >();

  constructor(upstream: UpstreamChatStore) {
    this.upstream = upstream;
  }

  createSession(title?: string): ChatSession {
    const id = nextId("sess");
    const s = this.upstream.createSession(id, title);
    return {
      id: s.id,
      title: s.title,
      model: s.model,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    };
  }

  getSession(sessionId: string): ChatSession | undefined {
    const s = this.upstream.getSession(sessionId);
    if (!s) return undefined;
    return {
      id: s.id,
      title: s.title,
      model: s.model,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    };
  }

  listSessions(): ChatSession[] {
    return this.upstream.listSessions().map((s) => ({
      id: s.id,
      title: s.title,
      model: s.model,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));
  }

  deleteSession(sessionId: string): boolean {
    return this.upstream.deleteSession(sessionId);
  }

  appendMessage(
    sessionId: string,
    message: Omit<ChatMessage, "id" | "createdAt">,
  ): ChatMessage {
    const id = nextId("msg");
    const m = this.upstream.addMessage(
      sessionId,
      id,
      message.role,
      message.content ?? undefined,
      message.model ?? undefined,
    );
    return {
      id: m.id,
      sessionId,
      role: m.role as ChatMessage["role"],
      content: m.content,
      model: m.model,
      provider: message.provider ?? null,
      createdAt: m.created_at,
    };
  }

  listMessages(sessionId: string): ChatMessage[] {
    const session = this.upstream.getSession(sessionId);
    if (!session) return [];
    return session.messages.map((m) => ({
      id: m.id,
      sessionId,
      role: m.role as ChatMessage["role"],
      content: m.content,
      model: m.model,
      provider: null,
      createdAt: m.created_at,
    }));
  }

  startRun(
    run: Omit<ChatRun, "id" | "createdAt" | "updatedAt">,
  ): ChatRun {
    const id = nextId("run");
    const ts = new Date().toISOString();
    const r = this.upstream.createRun(id, run.sessionId, {
      model: run.resolvedModel,
      status: run.status,
    });
    const kernelRun: ChatRun = {
      id: r.id,
      sessionId: run.sessionId,
      requestedModel: run.requestedModel,
      resolvedModel: run.resolvedModel,
      provider: run.provider,
      status: (r.status as RunStatus) ?? RUN_STATUS.RUNNING,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
    this.runs.set(kernelRun.id, kernelRun);
    return { ...kernelRun };
  }

  finishRun(runId: string, patch: Partial<ChatRun>): ChatRun {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Unknown run: ${runId}`);
    Object.assign(run, patch, { updatedAt: new Date().toISOString() });
    this.upstream.updateRun(runId, {
      status: run.status,
      finishedAt: new Date().toISOString(),
    });
    return { ...run };
  }

  abortRunsForModel(model: string, provider: string): number {
    let count = 0;
    for (const run of this.runs.values()) {
      if (
        run.provider === provider &&
        run.resolvedModel === model &&
        (run.status === RUN_STATUS.STARTING || run.status === RUN_STATUS.RUNNING)
      ) {
        run.status = RUN_STATUS.ABORTED;
        run.updatedAt = new Date().toISOString();
        this.upstream.updateRun(run.id, {
          status: RUN_STATUS.ABORTED,
          finishedAt: run.updatedAt,
        });
        count += 1;
      }
    }
    return count;
  }

  listRuns(sessionId?: string): ChatRun[] {
    const runs = [...this.runs.values()];
    return sessionId
      ? runs.filter((r) => r.sessionId === sessionId).map((r) => ({ ...r }))
      : runs.map((r) => ({ ...r }));
  }

  getRun(runId: string): ChatRun | undefined {
    const run = this.runs.get(runId);
    return run ? { ...run } : undefined;
  }
}
