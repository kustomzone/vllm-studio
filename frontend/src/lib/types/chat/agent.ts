// CRITICAL
/**
 * Agent state types.
 */

export type AgentTaskStatus = "pending" | "running" | "done" | "blocked";

export interface AgentTask {
  id: string;
  title: string;
  status: AgentTaskStatus;
  notes?: string;
}

export interface AgentPlanStep {
  id: string;
  title: string;
  status: AgentTaskStatus;
  notes?: string;
}

export interface AgentPlan {
  steps: AgentPlanStep[];
  createdAt: number;
  updatedAt: number;
}

export interface AgentFileEntry {
  name: string;
  type: "file" | "dir";
  size?: number;
  children?: AgentFileEntry[];
}

export interface AgentFileVersion {
  version: number;
  content: string;
  timestamp: number;
}

export interface AgentState {
  plan?: AgentPlan | null;
  tasks?: AgentTask[];
}

export interface AgentMachineInfo {
  daytona_enabled: boolean;
  sandbox?: {
    id: string;
  };
  machine?: {
    port: number;
    previewUrl?: string;
    previewError?: string;
  };
  computerUse?: {
    started?: Record<string, unknown>;
    status?: Record<string, unknown>;
  };
  screenshot?: {
    imageDataUrl: string;
    sizeBytes: number | null;
  };
  screenshotError?: string;
  error?: string;
}

