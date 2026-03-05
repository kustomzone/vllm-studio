// CRITICAL
"use client";

import { useCallback, useState } from "react";
import api from "@/lib/api";
import type { AgentMachineInfo } from "@/lib/types";

export function useAgentMachine() {
  const [machine, setMachine] = useState<AgentMachineInfo | null>(null);
  const [machineLoading, setMachineLoading] = useState(false);
  const [machineError, setMachineError] = useState<string | null>(null);

  const loadMachine = useCallback(
    async (
      sessionId: string,
      options?: { port?: number; includeScreenshot?: boolean; expiresInSeconds?: number },
    ): Promise<AgentMachineInfo | null> => {
      if (!sessionId || sessionId.trim().length === 0) {
        setMachine(null);
        setMachineError("Missing session id");
        return null;
      }

      setMachineLoading(true);
      setMachineError(null);

      try {
        const data = await api.getAgentMachine(sessionId, options);
        setMachine(data);
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setMachine(null);
        setMachineError(message);
        return null;
      } finally {
        setMachineLoading(false);
      }
    },
    [],
  );

  const clearMachine = useCallback(() => {
    setMachine(null);
    setMachineError(null);
    setMachineLoading(false);
  }, []);

  return {
    machine,
    machineLoading,
    machineError,
    loadMachine,
    clearMachine,
  };
}
