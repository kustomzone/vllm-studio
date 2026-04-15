import type { AgentEventType } from "./contracts";

export interface AgentToolRegistryOptions {
  sessionId: string;
  agentMode: boolean;
  agentFiles?: boolean;
  emitEvent?: (type: AgentEventType, data: Record<string, unknown>) => void;
}
