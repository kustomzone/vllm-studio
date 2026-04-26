// CRITICAL
"use client";

import { useCallback } from "react";
import api from "@/lib/api";

/**
 * Stop the currently running inference model. Shared between the dashboard
 * control panel and the global left sidebar so both surfaces call the same
 * evict path and share the same confirm prompt.
 */
export function useStopModel(onStopped?: () => void | Promise<void>) {
  return useCallback(async () => {
    if (!confirm("Stop the current model?")) return;
    try {
      await api.evict(true);
      if (onStopped) await onStopped();
    } catch (e) {
      alert("Failed to stop: " + (e as Error).message);
    }
  }, [onStopped]);
}
