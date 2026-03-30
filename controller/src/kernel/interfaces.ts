/**
 * Kernel port interfaces.
 *
 * These define the contract between the ControllerKernel orchestration layer
 * and the concrete adapters that implement persistence, process management,
 * event publication, and provider routing.
 *
 * Design rules:
 *  - Ports use domain-level vocabulary, not framework vocabulary.
 *  - Adapters wrap the existing upstream stores/managers behind these ports.
 *  - The kernel only depends on these interfaces, never on concrete implementations.
 */

import type { Recipe } from "../modules/lifecycle/types";
import type {
  DownloadStatus,
  EventType,
  JobStatus,
  RunStatus,
} from "./contracts";

// ---------------------------------------------------------------------------
// Value types
// ---------------------------------------------------------------------------

export type Backend = Recipe["backend"];
export type ActivationPolicy = "switch_on_request" | "load_if_idle";

export interface ActiveRuntime {
  recipeId: string;
  servedModelName: string;
  backend: Backend;
  port: number;
  pid: number | null;
  activatedAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  model: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  model: string | null;
  provider: string | null;
  createdAt: string;
}

export interface ChatRun {
  id: string;
  sessionId: string;
  requestedModel: string;
  resolvedModel: string;
  provider: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  completionId?: string;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CompletionResult {
  id: string;
  provider: string;
  model: string;
  content: string;
  usage: Usage;
}

export interface DownloadRecord {
  id: string;
  modelId: string;
  targetDir: string;
  status: DownloadStatus;
  createdAt: string;
  updatedAt: string;
}

export interface JobRecord {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  input: unknown;
  result?: unknown;
  error?: string;
  logs: string[];
}

export interface NodeRecord {
  nodeId: string;
  host: string | null;
  labels: Record<string, string>;
  registeredAt: string;
  lastHeartbeatAt: string;
}

export interface LayerAllocation {
  allocationId: string;
  nodeId: string;
  modelKey: string;
  startLayer: number;
  endLayer: number;
}

export interface LifetimeMetrics {
  requestsTotal: number;
  promptTokensTotal: number;
  completionTokensTotal: number;
  totalTokensTotal: number;
  modelSwitchesTotal: number;
}

export interface ControllerEvent<T = unknown> {
  id: string;
  type: string;
  ts: string;
  data: T;
}

// ---------------------------------------------------------------------------
// Provider resolution
// ---------------------------------------------------------------------------

export interface ProviderResolutionManaged {
  kind: "managed";
  provider: "local";
  requestedModel: string;
  resolvedModel: string;
  recipe: Recipe;
}

export interface ProviderResolutionExternal {
  kind: "external";
  provider: string;
  requestedModel: string;
  resolvedModel: string;
  baseUrl?: string | undefined;
}

export type ProviderResolution =
  | ProviderResolutionManaged
  | ProviderResolutionExternal;

// ---------------------------------------------------------------------------
// Port interfaces
// ---------------------------------------------------------------------------

export interface EventBus {
  publish<T>(type: EventType | string, data: T): ControllerEvent<T>;
  list(): ControllerEvent[];
}

export interface RecipeRegistry {
  upsert(recipe: Recipe): Recipe;
  getById(recipeId: string): Recipe | undefined;
  getByServedModelName(name: string): Recipe | undefined;
  list(): Recipe[];
  delete(recipeId: string): boolean;
}

export interface RuntimeLeaseManager {
  getActive(): ActiveRuntime | undefined;
  ensure(recipe: Recipe): Promise<ActiveRuntime>;
  evict(force?: boolean): Promise<ActiveRuntime | undefined>;
}

export interface ProviderRouter {
  resolve(requestedModel: string, fallbackProvider?: string): ProviderResolution;
}

export interface ChatStore {
  createSession(title?: string): ChatSession;
  getSession(sessionId: string): ChatSession | undefined;
  listSessions(): ChatSession[];
  deleteSession(sessionId: string): boolean;
  appendMessage(
    sessionId: string,
    message: Omit<ChatMessage, "id" | "createdAt">,
  ): ChatMessage;
  listMessages(sessionId: string): ChatMessage[];
  startRun(
    run: Omit<ChatRun, "id" | "createdAt" | "updatedAt">,
  ): ChatRun;
  finishRun(runId: string, patch: Partial<ChatRun>): ChatRun;
  abortRunsForModel(model: string, provider: string): number;
  listRuns(sessionId?: string): ChatRun[];
  getRun(runId: string): ChatRun | undefined;
}

export interface MetricsStore {
  snapshot(): LifetimeMetrics;
  addUsage(usage: Usage): void;
  addRequest(): void;
  addModelSwitch(): void;
}

export interface DownloadStore {
  create(modelId: string, targetDir: string): DownloadRecord;
  update(downloadId: string, patch: Partial<DownloadRecord>): DownloadRecord;
  list(): DownloadRecord[];
}

export interface JobStore {
  create(type: string, input: unknown): JobRecord;
  update(jobId: string, patch: Partial<JobRecord>): JobRecord;
  list(): JobRecord[];
}

export interface NodeRegistry {
  register(
    nodeId: string,
    host: string,
    labels?: Record<string, string>,
  ): NodeRecord;
  heartbeat(nodeId: string): NodeRecord;
  setAllocation(
    nodeId: string,
    modelKey: string,
    startLayer: number,
    endLayer: number,
  ): LayerAllocation;
  clearAllocation(modelKey: string, nodeId: string): boolean;
  listNodes(): NodeRecord[];
  listAllocations(modelKey?: string): LayerAllocation[];
}

// ---------------------------------------------------------------------------
// Kernel interface
// ---------------------------------------------------------------------------

export interface ControllerKernel {
  // Recipe management
  registerRecipe(recipe: Recipe): Recipe;
  listRecipes(): Recipe[];

  // Runtime lease
  activateModel(recipeRef: string): Promise<ActiveRuntime>;
  evictActiveModel(force?: boolean): Promise<ActiveRuntime | undefined>;
  getActiveRuntime(): ActiveRuntime | undefined;

  // Chat
  createSession(title?: string): ChatSession;

  // Proxy
  proxyCompletion(input: {
    sessionId?: string;
    model: string;
    provider?: string;
    activationPolicy?: ActivationPolicy;
    messages: Array<{ role: string; content: string }>;
  }): Promise<{
    resolution: ProviderResolution;
    completion: CompletionResult;
    run?: ChatRun;
  }>;

  // Downloads
  startDownload(modelId: string, targetDir: string): Promise<DownloadRecord>;

  // Jobs
  createJob(type: string, input: unknown): Promise<JobRecord>;

  // Distributed
  registerNode(
    nodeId: string,
    host: string,
    labels?: Record<string, string>,
  ): NodeRecord;
  heartbeatNode(nodeId: string): NodeRecord;
  setAllocation(
    nodeId: string,
    modelKey: string,
    startLayer: number,
    endLayer: number,
  ): LayerAllocation;

  // Snapshot
  snapshot(): {
    recipes: Recipe[];
    activeRuntime: ActiveRuntime | undefined;
    metrics: LifetimeMetrics;
    events: ControllerEvent[];
    downloads: DownloadRecord[];
    jobs: JobRecord[];
    nodes: NodeRecord[];
    allocations: LayerAllocation[];
  };
}
