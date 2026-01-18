"use client";

import { useCallback, useRef } from "react";
import { api } from "@/lib/api";

interface SessionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd?: number | null;
}

interface UseChatUsageOptions {
  setSessionUsage: (usage: SessionUsage | null) => void;
}

export function useChatUsage({ setSessionUsage }: UseChatUsageOptions) {
  const usageRefreshTimerRef = useRef<number | null>(null);

  const refreshUsage = useCallback(
    async (sessionId: string) => {
      if (!sessionId) return;
      if (usageRefreshTimerRef.current) {
        window.clearTimeout(usageRefreshTimerRef.current);
      }
      usageRefreshTimerRef.current = window.setTimeout(async () => {
        try {
          const usage = await api.getChatUsage(sessionId);
          setSessionUsage({
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens,
            estimated_cost_usd: usage.estimated_cost_usd ?? null,
          });
        } catch {}
      }, 500);
    },
    [setSessionUsage],
  );

  return {
    refreshUsage,
  };
}
