/**
 * In-memory implementations of kernel ports for testing.
 * These mirror the idealized reference model's in-memory adapters.
 */
import type { Recipe } from "../modules/lifecycle/types";
import type { RecipeId } from "../types/brand";
import type {
  ActiveRuntime,
  ChatMessage,
  ChatRun,
  ChatSession,
  ChatStore,
  CompletionResult,
  ControllerEvent,
  DownloadRecord,
  DownloadStore,
  EventBus,
  JobRecord,
  JobStore,
  LayerAllocation,
  LifetimeMetrics,
  MetricsStore,
  NodeRecord,
  NodeRegistry,
  ProviderResolution,
  ProviderRouter,
  RecipeRegistry,
  RuntimeLeaseManager,
  Usage,
} from "./interfaces";
import {
  DOWNLOAD_STATUS,
  EVENT_TYPE,
  JOB_STATUS,
  RUN_STATUS,
} from "./contracts";

let _counter = 0;
const nextId = (prefix: string): string => `${prefix}-${String(++_counter).padStart(4, "0")}`;
const now = (): string => new Date().toISOString();

// ---------------------------------------------------------------------------
// EventBus
// ---------------------------------------------------------------------------
export class InMemoryEventBus implements EventBus {
  private readonly events: ControllerEvent[] = [];

  publish<T>(type: string, data: T): ControllerEvent<T> {
    const event: ControllerEvent<T> = { id: nextId("evt"), type, ts: now(), data };
    this.events.push(event as ControllerEvent);
    return event;
  }

  list(): ControllerEvent[] {
    return [...this.events];
  }
}

// ---------------------------------------------------------------------------
// RecipeRegistry
// ---------------------------------------------------------------------------
export class InMemoryRecipeRegistry implements RecipeRegistry {
  private readonly byId = new Map<string, Recipe>();
  private readonly byModel = new Map<string, Recipe>();

  upsert(recipe: Recipe): Recipe {
    this.byId.set(recipe.id, recipe);
    if (recipe.served_model_name) {
      this.byModel.set(recipe.served_model_name, recipe);
    }
    return recipe;
  }

  getById(recipeId: string): Recipe | undefined {
    return this.byId.get(recipeId);
  }

  getByServedModelName(name: string): Recipe | undefined {
    return this.byModel.get(name);
  }

  list(): Recipe[] {
    return [...this.byId.values()];
  }

  delete(recipeId: string): boolean {
    return this.byId.delete(recipeId);
  }
}

// ---------------------------------------------------------------------------
// RuntimeLeaseManager
// ---------------------------------------------------------------------------
export class InMemoryRuntimeLeaseManager implements RuntimeLeaseManager {
  private active: ActiveRuntime | undefined;
  private readonly events: EventBus;

  constructor(events: EventBus) {
    this.events = events;
  }

  getActive(): ActiveRuntime | undefined {
    return this.active ? { ...this.active } : undefined;
  }

  async ensure(recipe: Recipe): Promise<ActiveRuntime> {
    if (this.active && this.active.recipeId === recipe.id) {
      return { ...this.active };
    }
    this.events.publish(EVENT_TYPE.RUNTIME_ACTIVATING, {
      recipeId: recipe.id,
      servedModelName: recipe.served_model_name ?? recipe.id,
      backend: recipe.backend,
    });
    const runtime: ActiveRuntime = {
      recipeId: recipe.id,
      servedModelName: recipe.served_model_name ?? recipe.id,
      backend: recipe.backend,
      port: recipe.port ?? 8000,
      pid: null,
      activatedAt: now(),
    };
    this.active = runtime;
    this.events.publish(EVENT_TYPE.RUNTIME_ACTIVATED, runtime);
    return { ...runtime };
  }

  async evict(): Promise<ActiveRuntime | undefined> {
    const previous = this.active;
    this.active = undefined;
    if (previous) {
      this.events.publish(EVENT_TYPE.RUNTIME_EVICTED, previous);
    }
    return previous;
  }
}

// ---------------------------------------------------------------------------
// ProviderRouter
// ---------------------------------------------------------------------------
export class InMemoryProviderRouter implements ProviderRouter {
  private readonly recipes: RecipeRegistry;
  private readonly externalProviders: Map<string, string>;

  constructor(recipes: RecipeRegistry, externalProviders?: Record<string, string>) {
    this.recipes = recipes;
    this.externalProviders = new Map(
      Object.entries(externalProviders ?? {
        openai: "https://api.openai.com/v1",
        anthropic: "https://api.anthropic.com/v1",
        local: "http://127.0.0.1:8000/v1",
      }),
    );
  }

  resolve(requestedModel: string, fallbackProvider = "openai"): ProviderResolution {
    const byId = this.recipes.getById(requestedModel);
    if (byId) {
      return { kind: "managed", provider: "local", requestedModel, resolvedModel: byId.served_model_name ?? byId.id, recipe: byId };
    }
    const byName = this.recipes.getByServedModelName(requestedModel);
    if (byName) {
      return { kind: "managed", provider: "local", requestedModel, resolvedModel: byName.served_model_name ?? byName.id, recipe: byName };
    }
    const slash = requestedModel.indexOf("/");
    if (slash > 0) {
      const provider = requestedModel.slice(0, slash);
      const model = requestedModel.slice(slash + 1);
      if (this.externalProviders.has(provider) && model) {
        return { kind: "external", provider, requestedModel, resolvedModel: model, baseUrl: this.externalProviders.get(provider) };
      }
    }
    return { kind: "external", provider: fallbackProvider, requestedModel, resolvedModel: requestedModel, baseUrl: this.externalProviders.get(fallbackProvider) };
  }
}

// ---------------------------------------------------------------------------
// ChatStore
// ---------------------------------------------------------------------------
export class InMemoryChatStore implements ChatStore {
  private readonly sessions = new Map<string, ChatSession>();
  private readonly messagesBySession = new Map<string, ChatMessage[]>();
  private readonly runs = new Map<string, ChatRun>();

  createSession(title = "Untitled chat"): ChatSession {
    const session: ChatSession = { id: nextId("sess"), title, model: null, createdAt: now(), updatedAt: now() };
    this.sessions.set(session.id, session);
    this.messagesBySession.set(session.id, []);
    return { ...session };
  }

  getSession(sessionId: string): ChatSession | undefined {
    const s = this.sessions.get(sessionId);
    return s ? { ...s } : undefined;
  }

  listSessions(): ChatSession[] {
    return [...this.sessions.values()].map((s) => ({ ...s }));
  }

  deleteSession(sessionId: string): boolean {
    this.messagesBySession.delete(sessionId);
    return this.sessions.delete(sessionId);
  }

  appendMessage(sessionId: string, message: Omit<ChatMessage, "id" | "createdAt">): ChatMessage {
    if (!this.sessions.has(sessionId)) throw new Error(`Unknown session: ${sessionId}`);
    const stored: ChatMessage = { id: nextId("msg"), createdAt: now(), ...message };
    this.messagesBySession.get(sessionId)!.push(stored);
    const session = this.sessions.get(sessionId)!;
    session.updatedAt = stored.createdAt;
    return { ...stored };
  }

  listMessages(sessionId: string): ChatMessage[] {
    return [...(this.messagesBySession.get(sessionId) ?? [])].map((m) => ({ ...m }));
  }

  startRun(run: Omit<ChatRun, "id" | "createdAt" | "updatedAt">): ChatRun {
    const ts = now();
    const stored: ChatRun = { id: nextId("run"), createdAt: ts, updatedAt: ts, ...run };
    this.runs.set(stored.id, stored);
    return { ...stored };
  }

  finishRun(runId: string, patch: Partial<ChatRun>): ChatRun {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Unknown run: ${runId}`);
    Object.assign(run, patch, { updatedAt: now() });
    return { ...run };
  }

  abortRunsForModel(model: string, provider: string): number {
    let count = 0;
    for (const run of this.runs.values()) {
      if (run.provider === provider && run.resolvedModel === model &&
        (run.status === RUN_STATUS.STARTING || run.status === RUN_STATUS.RUNNING)) {
        run.status = RUN_STATUS.ABORTED;
        run.updatedAt = now();
        count++;
      }
    }
    return count;
  }

  listRuns(sessionId?: string): ChatRun[] {
    const runs = [...this.runs.values()];
    return (sessionId ? runs.filter((r) => r.sessionId === sessionId) : runs).map((r) => ({ ...r }));
  }

  getRun(runId: string): ChatRun | undefined {
    const run = this.runs.get(runId);
    return run ? { ...run } : undefined;
  }
}

// ---------------------------------------------------------------------------
// MetricsStore
// ---------------------------------------------------------------------------
export class InMemoryMetricsStore implements MetricsStore {
  private state: LifetimeMetrics = {
    requestsTotal: 0,
    promptTokensTotal: 0,
    completionTokensTotal: 0,
    totalTokensTotal: 0,
    modelSwitchesTotal: 0,
  };

  snapshot(): LifetimeMetrics { return { ...this.state }; }
  addUsage(usage: Usage): void {
    this.state.promptTokensTotal += usage.promptTokens;
    this.state.completionTokensTotal += usage.completionTokens;
    this.state.totalTokensTotal += usage.totalTokens;
  }
  addRequest(): void { this.state.requestsTotal++; }
  addModelSwitch(): void { this.state.modelSwitchesTotal++; }
}

// ---------------------------------------------------------------------------
// DownloadStore
// ---------------------------------------------------------------------------
export class InMemoryDownloadStore implements DownloadStore {
  private readonly downloads = new Map<string, DownloadRecord>();

  create(modelId: string, targetDir: string): DownloadRecord {
    const ts = now();
    const record: DownloadRecord = { id: nextId("dl"), modelId, targetDir, status: DOWNLOAD_STATUS.QUEUED, createdAt: ts, updatedAt: ts };
    this.downloads.set(record.id, record);
    return { ...record };
  }

  update(downloadId: string, patch: Partial<DownloadRecord>): DownloadRecord {
    const record = this.downloads.get(downloadId);
    if (!record) throw new Error(`Unknown download: ${downloadId}`);
    Object.assign(record, patch, { updatedAt: now() });
    return { ...record };
  }

  list(): DownloadRecord[] { return [...this.downloads.values()].map((d) => ({ ...d })); }
}

// ---------------------------------------------------------------------------
// JobStore
// ---------------------------------------------------------------------------
export class InMemoryJobStore implements JobStore {
  private readonly jobs = new Map<string, JobRecord>();

  create(type: string, input: unknown): JobRecord {
    const ts = now();
    const job: JobRecord = { id: nextId("job"), type, status: JOB_STATUS.QUEUED, progress: 0, createdAt: ts, updatedAt: ts, input, logs: [] };
    this.jobs.set(job.id, job);
    return { ...job };
  }

  update(jobId: string, patch: Partial<JobRecord>): JobRecord {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Unknown job: ${jobId}`);
    Object.assign(job, patch, { updatedAt: now() });
    return { ...job };
  }

  list(): JobRecord[] { return [...this.jobs.values()].map((j) => ({ ...j })); }
}

// ---------------------------------------------------------------------------
// NodeRegistry
// ---------------------------------------------------------------------------
export class InMemoryNodeRegistry implements NodeRegistry {
  private readonly nodes = new Map<string, NodeRecord>();
  private readonly allocations = new Map<string, LayerAllocation>();

  register(nodeId: string, host: string, labels: Record<string, string> = {}): NodeRecord {
    const ts = now();
    const node: NodeRecord = {
      nodeId, host, labels,
      registeredAt: this.nodes.get(nodeId)?.registeredAt ?? ts,
      lastHeartbeatAt: ts,
    };
    this.nodes.set(nodeId, node);
    return { ...node };
  }

  heartbeat(nodeId: string): NodeRecord {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Unknown node: ${nodeId}`);
    node.lastHeartbeatAt = now();
    return { ...node };
  }

  setAllocation(nodeId: string, modelKey: string, startLayer: number, endLayer: number): LayerAllocation {
    if (!this.nodes.has(nodeId)) throw new Error(`Unknown node: ${nodeId}`);
    if (startLayer > endLayer) throw new Error("startLayer must be <= endLayer");
    for (const alloc of this.allocations.values()) {
      if (alloc.modelKey !== modelKey) continue;
      if (!(endLayer < alloc.startLayer || startLayer > alloc.endLayer)) {
        throw new Error(
          `Layer range ${startLayer}-${endLayer} overlaps existing ${alloc.startLayer}-${alloc.endLayer} for model ${modelKey}`,
        );
      }
    }
    const record: LayerAllocation = { allocationId: nextId("alloc"), nodeId, modelKey, startLayer, endLayer };
    this.allocations.set(record.allocationId, record);
    return { ...record };
  }

  clearAllocation(modelKey: string, nodeId: string): boolean {
    for (const [key, alloc] of this.allocations) {
      if (alloc.modelKey === modelKey && alloc.nodeId === nodeId) {
        this.allocations.delete(key);
        return true;
      }
    }
    return false;
  }

  listNodes(): NodeRecord[] { return [...this.nodes.values()].map((n) => ({ ...n })); }
  listAllocations(modelKey?: string): LayerAllocation[] {
    return [...this.allocations.values()]
      .filter((a) => (modelKey ? a.modelKey === modelKey : true))
      .map((a) => ({ ...a }));
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export interface TestKernelParts {
  events: InMemoryEventBus;
  recipes: InMemoryRecipeRegistry;
  runtime: InMemoryRuntimeLeaseManager;
  providers: InMemoryProviderRouter;
  chats: InMemoryChatStore;
  metrics: InMemoryMetricsStore;
  downloads: InMemoryDownloadStore;
  jobs: InMemoryJobStore;
  cluster: InMemoryNodeRegistry;
}

export function createTestKernelParts(): TestKernelParts {
  const events = new InMemoryEventBus();
  const recipes = new InMemoryRecipeRegistry();
  const runtime = new InMemoryRuntimeLeaseManager(events);
  const providers = new InMemoryProviderRouter(recipes);
  const chats = new InMemoryChatStore();
  const metrics = new InMemoryMetricsStore();
  const downloads = new InMemoryDownloadStore();
  const jobs = new InMemoryJobStore();
  const cluster = new InMemoryNodeRegistry();
  return { events, recipes, runtime, providers, chats, metrics, downloads, jobs, cluster };
}
