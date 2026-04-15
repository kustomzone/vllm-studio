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

export type { AgentFileEntry } from "../../../../../shared/src";

export interface AgentFileVersion {
  version: number;
  content: string;
  timestamp: number;
}

export interface AgentState {
  plan?: AgentPlan | null;
  tasks?: AgentTask[];
}
