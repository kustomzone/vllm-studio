/**
 * ControllerKernel — the orchestration core.
 *
 * This is a direct port of the idealized kernel to real TypeScript,
 * operating through the port interfaces defined in ./interfaces.ts.
 * It contains zero framework imports and zero I/O — all side effects
 * are delegated to the injected adapters.
 */

import type { Recipe } from "../modules/lifecycle/types";
import type {
  ActiveRuntime,
  ActivationPolicy,
  ChatRun,
  ChatStore,
  CompletionResult,
  ControllerEvent,
  ControllerKernel as IControllerKernel,
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
  ChatSession,
} from "./interfaces";
import {
  DOWNLOAD_STATUS,
  EVENT_TYPE,
  JOB_STATUS,
  RUN_STATUS,
} from "./contracts";

export interface KernelDeps {
  events: EventBus;
  recipes: RecipeRegistry;
  runtime: RuntimeLeaseManager;
  providers: ProviderRouter;
  chats: ChatStore;
  metrics: MetricsStore;
  downloads: DownloadStore;
  jobs: JobStore;
  cluster: NodeRegistry;
}

export class ControllerKernel implements IControllerKernel {
  private readonly events: EventBus;
  private readonly recipes: RecipeRegistry;
  private readonly runtime: RuntimeLeaseManager;
  private readonly providers: ProviderRouter;
  private readonly chats: ChatStore;
  private readonly metrics: MetricsStore;
  private readonly downloads: DownloadStore;
  private readonly jobs: JobStore;
  private readonly cluster: NodeRegistry;

  constructor(deps: KernelDeps) {
    this.events = deps.events;
    this.recipes = deps.recipes;
    this.runtime = deps.runtime;
    this.providers = deps.providers;
    this.chats = deps.chats;
    this.metrics = deps.metrics;
    this.downloads = deps.downloads;
    this.jobs = deps.jobs;
    this.cluster = deps.cluster;
  }

  // -- Recipes ---------------------------------------------------------------

  registerRecipe(recipe: Recipe): Recipe {
    const stored = this.recipes.upsert(recipe);
    this.events.publish(EVENT_TYPE.RECIPE_UPSERTED, stored);
    return stored;
  }

  listRecipes(): Recipe[] {
    return this.recipes.list();
  }

  // -- Runtime lease ---------------------------------------------------------

  getActiveRuntime(): ActiveRuntime | undefined {
    return this.runtime.getActive();
  }

  async activateModel(
    recipeRef: string,
    { reason = "manual" }: { reason?: string } = {},
  ): Promise<ActiveRuntime> {
    const recipe =
      this.recipes.getById(recipeRef) ??
      this.recipes.getByServedModelName(recipeRef);
    if (!recipe) {
      throw new Error(`Unknown recipe reference: ${recipeRef}`);
    }

    const previous = this.runtime.getActive();
    if (previous && previous.recipeId !== recipe.id) {
      const aborted = this.chats.abortRunsForModel(
        previous.servedModelName,
        "local",
      );
      if (aborted > 0) {
        this.events.publish(EVENT_TYPE.CHAT_RUN_ABORTED, {
          reason: "model_switch",
          model: previous.servedModelName,
          provider: "local",
          abortedRuns: aborted,
        });
      }
    }

    const active = await this.runtime.ensure(recipe);
    if (!previous || previous.recipeId !== recipe.id) {
      this.metrics.addModelSwitch();
      this.events.publish(EVENT_TYPE.MODEL_SWITCHED, {
        reason,
        previousRecipeId: previous?.recipeId ?? null,
        nextRecipeId: recipe.id,
        servedModelName: recipe.served_model_name ?? recipe.id,
      });
    }
    return active;
  }

  async evictActiveModel(force = false): Promise<ActiveRuntime | undefined> {
    const previous = this.runtime.getActive();
    if (previous) {
      const aborted = this.chats.abortRunsForModel(
        previous.servedModelName,
        "local",
      );
      if (aborted > 0) {
        this.events.publish(EVENT_TYPE.CHAT_RUN_ABORTED, {
          reason: "eviction",
          model: previous.servedModelName,
          provider: "local",
          abortedRuns: aborted,
        });
      }
    }
    return this.runtime.evict(force);
  }

  // -- Chat ------------------------------------------------------------------

  createSession(title?: string): ChatSession {
    return this.chats.createSession(title);
  }

  // -- Proxy -----------------------------------------------------------------

  async proxyCompletion(input: {
    sessionId?: string;
    model: string;
    provider?: string;
    activationPolicy?: ActivationPolicy;
    messages: Array<{ role: string; content: string }>;
  }): Promise<{
    resolution: ProviderResolution;
    completion: CompletionResult;
    run?: ChatRun;
  }> {
    const {
      sessionId,
      model,
      provider = "openai",
      activationPolicy = "switch_on_request",
      messages,
    } = input;

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("messages must be non-empty");
    }

    let resolution = this.providers.resolve(model, provider);
    const active = this.runtime.getActive();

    if (resolution.kind === "managed") {
      if (activationPolicy === "switch_on_request") {
        await this.activateModel(resolution.recipe.id, {
          reason: "proxy_request",
        });
      } else if (!active) {
        await this.activateModel(resolution.recipe.id, {
          reason: "load_if_idle",
        });
      } else if (active.recipeId !== resolution.recipe.id) {
        const activeRecipe = this.recipes.getById(active.recipeId);
        if (!activeRecipe) {
          throw new Error(
            `Active recipe missing from registry: ${active.recipeId}`,
          );
        }
        resolution = {
          kind: "managed",
          provider: "local",
          requestedModel: model,
          resolvedModel: activeRecipe.served_model_name ?? activeRecipe.id,
          recipe: activeRecipe,
        };
      }
    }

    let run: ChatRun | undefined;
    if (sessionId) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "user") {
        const storedUserMessage = this.chats.appendMessage(sessionId, {
          sessionId,
          role: "user",
          content: lastMessage.content,
          model,
          provider: resolution.provider,
        });
        this.events.publish(EVENT_TYPE.CHAT_MESSAGE_ADDED, storedUserMessage);
      }
      run = this.chats.startRun({
        sessionId,
        requestedModel: model,
        resolvedModel:
          resolution.kind === "managed"
            ? (resolution.recipe.served_model_name ?? resolution.recipe.id)
            : resolution.resolvedModel,
        provider: resolution.provider,
        status: RUN_STATUS.RUNNING,
      });
      this.events.publish(EVENT_TYPE.CHAT_RUN_STARTED, run);
    }

    // The actual completion is delegated to the provider router or upstream proxy
    // For now, we produce a stub; the real path goes through the existing
    // /v1/chat/completions proxy route which remains intact.
    const completion: CompletionResult = {
      id: `cmpl-${crypto.randomUUID().slice(0, 12)}`,
      provider: resolution.provider,
      model:
        resolution.kind === "managed"
          ? (resolution.recipe.served_model_name ?? resolution.recipe.id)
          : resolution.resolvedModel,
      content: "",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };

    if (sessionId && run) {
      run = this.chats.finishRun(run.id, {
        status: RUN_STATUS.COMPLETED,
        completionId: completion.id,
      });
      this.events.publish(EVENT_TYPE.CHAT_RUN_COMPLETED, run);
    }

    this.metrics.addRequest();
    this.metrics.addUsage(completion.usage);
    this.events.publish(EVENT_TYPE.PROXY_COMPLETED, {
      model,
      provider: resolution.provider,
      completionId: completion.id,
      usage: completion.usage,
    });

    const result: {
      resolution: ProviderResolution;
      completion: CompletionResult;
      run?: ChatRun;
    } = { resolution, completion };
    if (run) result.run = run;
    return result;
  }

  // -- Downloads -------------------------------------------------------------

  async startDownload(
    modelId: string,
    targetDir: string,
  ): Promise<DownloadRecord> {
    let record = this.downloads.create(modelId, targetDir);
    this.events.publish(EVENT_TYPE.DOWNLOAD_UPDATED, record);
    record = this.downloads.update(record.id, {
      status: DOWNLOAD_STATUS.DOWNLOADING,
    });
    this.events.publish(EVENT_TYPE.DOWNLOAD_UPDATED, record);
    return record;
  }

  // -- Jobs ------------------------------------------------------------------

  async createJob(type: string, input: unknown): Promise<JobRecord> {
    let job = this.jobs.create(type, input);
    this.events.publish(EVENT_TYPE.JOB_UPDATED, job);
    job = this.jobs.update(job.id, {
      status: JOB_STATUS.RUNNING,
      progress: 50,
      logs: [...job.logs, "job started"],
    });
    this.events.publish(EVENT_TYPE.JOB_UPDATED, job);
    return job;
  }

  // -- Distributed -----------------------------------------------------------

  registerNode(
    nodeId: string,
    host: string,
    labels?: Record<string, string>,
  ): NodeRecord {
    const node = this.cluster.register(nodeId, host, labels);
    this.events.publish(EVENT_TYPE.NODE_UPDATED, node);
    return node;
  }

  heartbeatNode(nodeId: string): NodeRecord {
    const node = this.cluster.heartbeat(nodeId);
    this.events.publish(EVENT_TYPE.NODE_UPDATED, node);
    return node;
  }

  setAllocation(
    nodeId: string,
    modelKey: string,
    startLayer: number,
    endLayer: number,
  ): LayerAllocation {
    const allocation = this.cluster.setAllocation(
      nodeId,
      modelKey,
      startLayer,
      endLayer,
    );
    this.events.publish(EVENT_TYPE.TOPOLOGY_UPDATED, allocation);
    return allocation;
  }

  // -- Snapshot --------------------------------------------------------------

  snapshot(): {
    recipes: Recipe[];
    activeRuntime: ActiveRuntime | undefined;
    metrics: LifetimeMetrics;
    events: ControllerEvent[];
    downloads: DownloadRecord[];
    jobs: JobRecord[];
    nodes: NodeRecord[];
    allocations: LayerAllocation[];
  } {
    return {
      recipes: this.recipes.list(),
      activeRuntime: this.runtime.getActive(),
      metrics: this.metrics.snapshot(),
      events: this.events.list(),
      downloads: this.downloads.list(),
      jobs: this.jobs.list(),
      nodes: this.cluster.listNodes(),
      allocations: this.cluster.listAllocations(),
    };
  }
}
