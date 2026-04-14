// CRITICAL
"use client";

import { useCallback, useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import api, { type ChatRunStreamEvent } from "@/lib/api";
import type { ToolResult } from "@/lib/types";
import { pushStreamErrorToast } from "./controller/internal/use-stream-error-toast";

export type AgentFinalReplyIssueKind =
  | "turn_gap_no_run_end"
  | "stream_closed_without_run_end"
  | "run_end_without_visible_reply";

export type AgentFinalReplyGuard = {
  isAgentMode: () => boolean;
  currentRunHasFinalAssistantText: () => boolean;
  onMissingFinalAssistant: (kind: AgentFinalReplyIssueKind) => void;
  abortServerRun: () => Promise<void>;
};

export interface ChatRunStreamPayload {
  content: string;
  message_id: string;
  model?: string;
  provider?: string;
  system?: string;
  agent_mode?: boolean;
  agent_files?: boolean;
  deep_research?: boolean;
  thinking_level?: string;
  images?: Array<{ data: string; mimeType: string; name?: string }>;
}

export interface UseChatRunStreamArgs {
  activeRunIdRef: MutableRefObject<string | null>;
  runAbortControllerRef: MutableRefObject<AbortController | null>;
  runCompletedRef: MutableRefObject<boolean>;
  lastEventTimeRef: MutableRefObject<number>;
  sessionIdRef: MutableRefObject<string | null>;
  setIsLoading: (value: boolean) => void;
  setStreamError: (value: string | null) => void;
  setStreamStalled: (value: boolean) => void;
  setExecutingTools: (value: Set<string>) => void;
  setToolResultsMap: (value: Map<string, ToolResult>) => void;
  handleRunEvent: (event: ChatRunStreamEvent) => void;
  /** When set, agent-mode runs must end with visible assistant text or we surface an error and abort. */
  agentFinalReplyGuardRef?: MutableRefObject<AgentFinalReplyGuard | null>;
  /** Set true in handleStop before aborting so we do not treat user stop as a missing final reply. */
  userStoppedStreamRef?: MutableRefObject<boolean>;
}

export function useChatRunStream({
  activeRunIdRef,
  runAbortControllerRef,
  runCompletedRef,
  lastEventTimeRef,
  sessionIdRef,
  setIsLoading,
  setStreamError,
  setStreamStalled,
  setExecutingTools,
  setToolResultsMap,
  handleRunEvent,
  agentFinalReplyGuardRef,
  userStoppedStreamRef,
}: UseChatRunStreamArgs) {
  const sawRunEndRef = useRef(false);
  const incompleteHandledRef = useRef(false);

  useEffect(() => {
    return () => {
      runAbortControllerRef.current?.abort();
      const runId = activeRunIdRef.current;
      const sessionId = sessionIdRef.current;
      if (runId && sessionId) {
        void api.abortChatRun(sessionId, runId).catch(() => {});
      }
      activeRunIdRef.current = null;
    };
  }, []);

  const startRunStream = useCallback(
    async (sessionId: string, payload: ChatRunStreamPayload) => {
      if (runAbortControllerRef.current) {
        runAbortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      runAbortControllerRef.current = abortController;
      runCompletedRef.current = false;
      sawRunEndRef.current = false;
      incompleteHandledRef.current = false;
      if (userStoppedStreamRef) userStoppedStreamRef.current = false;
      lastEventTimeRef.current = Date.now();
      setIsLoading(true);
      setStreamError(null);
      setStreamStalled(false);
      setExecutingTools(new Set());
      setToolResultsMap(new Map<string, ToolResult>());

      let runIdForLifecycle: string | null = null;

      // Safety timeout: if no SSE event arrives for 120s, abort the stream
      // to prevent the UI from getting stuck forever on a hung connection.
      const STREAM_IDLE_TIMEOUT_MS = 120_000;
      // If a turn finishes but backend never emits `run_end`, auto-close the stream.
      const RUN_END_GRACE_MS = 8_000;
      let idleTimer: ReturnType<typeof setTimeout> | null = null;
      let runEndGraceTimer: ReturnType<typeof setTimeout> | null = null;
      const resetIdleTimer = () => {
        if (idleTimer) clearTimeout(idleTimer);
        if (abortController.signal.aborted) return;
        idleTimer = setTimeout(() => {
          if (!abortController.signal.aborted && !runCompletedRef.current) {
            console.warn("[stream] Idle timeout reached — aborting hung stream");
            abortController.abort();
            const timeoutMsg = "Stream timed out (no events for 2 minutes)";
            setStreamError(timeoutMsg);
            pushStreamErrorToast(timeoutMsg, {
              activeRunId: activeRunIdRef.current,
              lastEventTime: lastEventTimeRef.current,
            });
          }
        }, STREAM_IDLE_TIMEOUT_MS);
      };
      const clearRunEndGraceTimer = () => {
        if (runEndGraceTimer) {
          clearTimeout(runEndGraceTimer);
          runEndGraceTimer = null;
        }
      };
      const armRunEndGraceTimer = () => {
        clearRunEndGraceTimer();
        if (abortController.signal.aborted || runCompletedRef.current) return;
        runEndGraceTimer = setTimeout(() => {
          if (!abortController.signal.aborted && !runCompletedRef.current) {
            console.warn("[stream] turn_end seen without run_end — closing stream");
            runCompletedRef.current = true;
            const guard = agentFinalReplyGuardRef?.current;
            const userStopped = userStoppedStreamRef?.current === true;
            if (
              guard?.isAgentMode() &&
              !userStopped &&
              !guard.currentRunHasFinalAssistantText() &&
              !incompleteHandledRef.current
            ) {
              incompleteHandledRef.current = true;
              void guard.abortServerRun();
              guard.onMissingFinalAssistant("turn_gap_no_run_end");
            }
            abortController.abort();
          }
        }, RUN_END_GRACE_MS);
      };

      try {
        resetIdleTimer();
        const { runId, stream } = await api.streamChatRun(sessionId, payload, {
          signal: abortController.signal,
        });
        runIdForLifecycle = runId ?? null;
        if (runIdForLifecycle) {
          activeRunIdRef.current = runIdForLifecycle;
        }

        for await (const event of stream) {
          lastEventTimeRef.current = Date.now();
          // Any data from the server (including keepalives) proves the
          // connection and backend are alive, so reset the idle timer.
          resetIdleTimer();

          if (event.event === "keepalive") {
            continue;
          }
          if (event.event !== "turn_end") {
            clearRunEndGraceTimer();
          }

          if (
            event.event === "turn_end" ||
            event.event === "message_end" ||
            event.event === "agent_end"
          ) {
            armRunEndGraceTimer();
          }

          handleRunEvent(event);

          if (event.event === "run_end") {
            sawRunEndRef.current = true;
            runCompletedRef.current = true;
            clearRunEndGraceTimer();
            abortController.abort();
            break;
          }
        }

        const guard = agentFinalReplyGuardRef?.current;
        const userStopped = userStoppedStreamRef?.current === true;
        if (guard?.isAgentMode() && !userStopped) {
          if (sawRunEndRef.current) {
            if (
              !guard.currentRunHasFinalAssistantText() &&
              !incompleteHandledRef.current
            ) {
              incompleteHandledRef.current = true;
              guard.onMissingFinalAssistant("run_end_without_visible_reply");
            }
          } else if (!guard.currentRunHasFinalAssistantText() && !incompleteHandledRef.current) {
            incompleteHandledRef.current = true;
            void guard.abortServerRun();
            guard.onMissingFinalAssistant("stream_closed_without_run_end");
          }
        }

        // Stream closed normally. If we never saw an explicit run_end
        // (e.g. proxy dropped the final SSE frame), treat the stream
        // closure itself as implicit completion so the grace timer
        // doesn't fire a spurious error.
        if (!runCompletedRef.current) {
          runCompletedRef.current = true;
        }
      } catch (err) {
        if (!abortController.signal.aborted && !runCompletedRef.current) {
          const message = err instanceof Error ? err.message : String(err);
          setStreamError(message);
          pushStreamErrorToast(message, {
            activeRunId: activeRunIdRef.current,
            lastEventTime: lastEventTimeRef.current,
          });
          const streamError = err instanceof Error ? err : new Error(message);
          if (!runIdForLifecycle) {
            (
              streamError as Error & {
                rollbackOptimisticUserMessage?: boolean;
              }
            ).rollbackOptimisticUserMessage = true;
          }
          throw streamError;
        }
      } finally {
        if (idleTimer) clearTimeout(idleTimer);
        clearRunEndGraceTimer();
        if (runIdForLifecycle && activeRunIdRef.current === runIdForLifecycle) {
          activeRunIdRef.current = null;
        }
        runAbortControllerRef.current = null;
        setIsLoading(false);
        setExecutingTools(new Set());
      }
    },
    [
      activeRunIdRef,
      agentFinalReplyGuardRef,
      handleRunEvent,
      incompleteHandledRef,
      lastEventTimeRef,
      runAbortControllerRef,
      runCompletedRef,
      sawRunEndRef,
      setExecutingTools,
      setIsLoading,
      setStreamError,
      setStreamStalled,
      setToolResultsMap,
      userStoppedStreamRef,
    ],
  );

  return { startRunStream };
}
