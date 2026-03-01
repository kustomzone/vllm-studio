// CRITICAL
import type { Agent } from "@mariozechner/pi-agent-core";
import type { AppContext } from "../../../types/context";
import { createChatRun } from "./chat-run-factory";
import { createMockChatRun } from "./chat-run-factory-mock";
import { isMockInferenceEnabled } from "./run-manager-utils";
import type { ChatRunOptions, ChatRunStream } from "./run-manager-types";

export type { ChatRunOptions, ChatRunStream } from "./run-manager-types";

/**
 * Controller-owned run manager for Pi agent sessions.
 */
export class ChatRunManager {
  private readonly context: AppContext;
  private readonly activeRuns = new Map<string, { agent: Agent; abort: AbortController }>();

  /**
   * Create a run manager.
   * @param context - Application context.
   */
  public constructor(context: AppContext) {
    this.context = context;
  }

  /**
   * Abort an in-flight run.
   * @param runId - Run identifier.
   * @returns True if a run was aborted.
   */
  public abortRun(runId: string): boolean {
    const active = this.activeRuns.get(runId);
    if (!active) {
      return false;
    }
    active.agent.abort();
    active.abort.abort();
    return true;
  }

  /**
   * Start a new chat run and return the SSE stream.
   * @param options - Run options.
   * @returns Run id and stream iterable.
   */
  public async startRun(options: ChatRunOptions): Promise<ChatRunStream> {
    const sessionId = options.sessionId;
    const session = this.context.stores.chatStore.getSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const content = options.content.trim();
    const hasImageInput = Array.isArray(options.images) && options.images.length > 0;
    if (!content && !hasImageInput) {
      throw new Error("Message content is required");
    }

    if (isMockInferenceEnabled()) {
      return createMockChatRun(this.context, session, options, content);
    }

    return createChatRun(this.context, this.activeRuns, options);
  }
}
