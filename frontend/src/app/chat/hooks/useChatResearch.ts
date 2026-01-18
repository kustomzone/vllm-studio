"use client";

import { useCallback, useEffect } from "react";
import type { DeepResearchSettings } from "@/components/chat";

const STORAGE_KEY = "vllm-studio-deep-research";

interface UseChatResearchOptions {
  deepResearch: DeepResearchSettings;
  setDeepResearch: (settings: DeepResearchSettings) => void;
  setMcpEnabled?: (enabled: boolean) => void;
}

export function useChatResearch({
  deepResearch,
  setDeepResearch,
  setMcpEnabled,
}: UseChatResearchOptions) {
  const hydrate = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<DeepResearchSettings>;
        setDeepResearch({ ...deepResearch, ...parsed });
      }
    } catch {}
  }, [deepResearch, setDeepResearch]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const updateDeepResearch = useCallback(
    (next: DeepResearchSettings) => {
      setDeepResearch(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      if (next.enabled && setMcpEnabled) {
        setMcpEnabled(true);
      }
    },
    [setDeepResearch, setMcpEnabled],
  );

  return {
    updateDeepResearch,
  };
}
