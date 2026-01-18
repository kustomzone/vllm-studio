"use client";

import { useCallback, useMemo } from "react";
import {
  debouncedSave,
  loadState,
  saveState,
  type PersistedChatState,
} from "@/lib/chat-state-persistence";

interface ChatPersistenceState {
  input: string;
  mcpEnabled: boolean;
  artifactsEnabled: boolean;
  systemPrompt: string;
  selectedModel: string;
  sidebarCollapsed: boolean;
}

interface UseChatPersistenceOptions {
  delay?: number;
}

const DEFAULT_DELAY = 1000;
const SYSTEM_PROMPT_KEY = "vllm-studio-system-prompt";

export function useChatPersistence(options: UseChatPersistenceOptions = {}) {
  const delay = options.delay ?? DEFAULT_DELAY;
  const hydrated = useMemo(() => {
    if (typeof window === "undefined") return null;
    return loadState();
  }, []);

  const storedSystemPrompt = useMemo(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(SYSTEM_PROMPT_KEY) || "";
    } catch {
      return "";
    }
  }, []);

  const persist = useCallback(
    (state: ChatPersistenceState) => {
      debouncedSave(
        {
          input: state.input,
          mcpEnabled: state.mcpEnabled,
          artifactsEnabled: state.artifactsEnabled,
          systemPrompt: state.systemPrompt,
          selectedModel: state.selectedModel,
          sidebarCollapsed: state.sidebarCollapsed,
        },
        delay,
      );
    },
    [delay],
  );

  const saveImmediate = useCallback((state: Partial<PersistedChatState>) => {
    saveState(state);
  }, []);

  const saveSystemPrompt = useCallback((prompt: string) => {
    try {
      localStorage.setItem(SYSTEM_PROMPT_KEY, prompt);
    } catch {}
  }, []);

  return {
    hydrated,
    storedSystemPrompt,
    persist,
    saveImmediate,
    saveSystemPrompt,
  };
}
