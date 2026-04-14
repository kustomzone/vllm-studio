// CRITICAL
"use client";

import { useCallback, useMemo, useRef } from "react";
import api, { type ChatRunStreamEvent } from "@/lib/api";
import { pushStreamErrorToast } from "@/app/chat/_components/layout/chat-page/controller/internal/use-stream-error-toast";
import { applyRunMachineEffects, type RunMachineEffectRuntime } from "./run-effects";
import { createInitialRunMachineState, transitionRunMachine } from "./run-machine";
import type { RunMachineContext } from "./types";
import type { UseRunEventHandlerArgs } from "@/app/chat/hooks/run/use-run-event-handler/types";
import { useAppStore } from "@/store";

export function useRunMachine(args: UseRunEventHandlerArgs) {
  const {
    currentSessionId,
    currentSessionTitle,
    activeRunIdRef,
    runAbortControllerRef,
    lastEventTimeRef,
    runCompletedRef,
    setStreamStalled,
    setIsLoading,
    setStreamError,
    setAgentPlan,
    generateTitle,
    recordToolExecutionMetadata,
    recordToolResult,
    updateExecutingTools,
    mapAgentMessageToChatMessage,
    upsertMessage,
    loadAgentFiles,
    readAgentFile,
    moveAgentFileVersions,
  } = args;

  const stateRef = useRef(createInitialRunMachineState());
  const lastAssistantContentRef = useRef<string>("");

  const runtime = useMemo<RunMachineEffectRuntime>(
    () => ({
      setStreamStalled,
      setIsLoading,
      setStreamError,
      setAgentPlan,
      setActiveRunId: (runId: string | null) => {
        activeRunIdRef.current = runId;
      },
      setRunCompleted: (value: boolean) => {
        runCompletedRef.current = value;
      },
      updateExecutingTools,
      recordToolExecutionMetadata,
      recordToolResult,
      upsertMessage,
      setLastAssistantContent: (content: string) => {
        lastAssistantContentRef.current = content;
      },
      loadAgentFiles,
      readAgentFile,
      moveAgentFileVersions,
      generateTitle,
      pushStreamErrorToast,
      abortAgentRunAfterToolError: ({ toolName, resultText }) => {
        if (!useAppStore.getState().agentMode) return;
        const snippet = resultText.trim().slice(0, 240);
        const msg = snippet
          ? `Tool "${toolName}" failed — stopping the run. ${snippet}`
          : `Tool "${toolName}" failed — stopping the run.`;
        setStreamError(msg);
        pushStreamErrorToast(msg, {
          activeRunId: activeRunIdRef.current,
          lastEventTime: lastEventTimeRef.current,
        });
        runAbortControllerRef.current?.abort();
        const sid = currentSessionId;
        const rid = activeRunIdRef.current;
        if (sid && rid) {
          void api.abortChatRun(sid, rid).catch(() => {});
        }
      },
      setComputerBrowserUrl: (url: string) => {
        useAppStore.getState().setComputerBrowserUrl(url);
      },
    }),
    [
      activeRunIdRef,
      currentSessionId,
      generateTitle,
      lastAssistantContentRef,
      lastEventTimeRef,
      setStreamStalled,
      loadAgentFiles,
      moveAgentFileVersions,
      readAgentFile,
      recordToolExecutionMetadata,
      recordToolResult,
      runAbortControllerRef,
      runCompletedRef,
      setAgentPlan,
      setIsLoading,
      setStreamError,
      updateExecutingTools,
      upsertMessage,
    ],
  );

  const handleRunEvent = useCallback(
    (event: ChatRunStreamEvent) => {
      const now = Date.now();
      lastEventTimeRef.current = now;
      setStreamStalled(false);

      if (
        activeRunIdRef.current &&
        stateRef.current.activeRunId !== activeRunIdRef.current
      ) {
        stateRef.current = {
          ...stateRef.current,
          phase: "active",
          activeRunId: activeRunIdRef.current,
          runCompleted: false,
        };
      }

      const store = useAppStore.getState();
      const userMessage = store.messages.findLast((m) => m.role === "user");
      const userTextPart = userMessage?.parts.find((p) => p.type === "text") as { text: string } | undefined;

      const context: RunMachineContext = {
        currentSessionId,
        currentSessionTitle,
        lastUserInput: userTextPart?.text ?? "",
        lastAssistantContent: lastAssistantContentRef.current,
      };

      const transition = transitionRunMachine(stateRef.current, context, {
        event,
        now,
        mapAgentMessageToChatMessage: (rawMessage, messageId, runMeta) =>
          mapAgentMessageToChatMessage(rawMessage, messageId, runMeta),
      });

      stateRef.current = transition.state;
      applyRunMachineEffects(transition.effects, runtime);
    },
    [
      activeRunIdRef,
      currentSessionId,
      currentSessionTitle,
      lastAssistantContentRef,
      lastEventTimeRef,
      mapAgentMessageToChatMessage,
      runtime,
      setStreamStalled,
    ],
  );

  return { handleRunEvent };
}
