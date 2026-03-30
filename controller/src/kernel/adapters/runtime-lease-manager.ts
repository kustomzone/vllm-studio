/**
 * RuntimeLeaseManager adapter — wraps LifecycleCoordinator + ProcessManager.
 */
import type { Recipe } from "../../modules/lifecycle/types";
import type { ActiveRuntime, EventBus, RuntimeLeaseManager } from "../interfaces";
import { EVENT_TYPE } from "../contracts";

export interface UpstreamLifecycle {
  ensureActive(
    recipe: Recipe,
    options?: { force_evict?: boolean; publish_events?: boolean },
  ): Promise<{ switched: boolean; error: string | null }>;
  evict(force: boolean): Promise<{ success: boolean; evicted_pid: number | null }>;
}

export interface UpstreamProcessManager {
  findInferenceProcess(port: number): Promise<{
    pid: number;
    backend: string;
    model_path: string | null;
    port: number;
    served_model_name: string | null;
  } | null>;
}

export class RuntimeLeaseManagerAdapter implements RuntimeLeaseManager {
  private active: ActiveRuntime | undefined;
  private readonly lifecycle: UpstreamLifecycle;
  private readonly process: UpstreamProcessManager;
  private readonly events: EventBus;
  private readonly inferencePort: number;

  constructor(
    lifecycle: UpstreamLifecycle,
    process: UpstreamProcessManager,
    events: EventBus,
    inferencePort: number,
  ) {
    this.lifecycle = lifecycle;
    this.process = process;
    this.events = events;
    this.inferencePort = inferencePort;
  }

  getActive(): ActiveRuntime | undefined {
    return this.active ? { ...this.active } : undefined;
  }

  async ensure(recipe: Recipe): Promise<ActiveRuntime> {
    if (this.active && this.active.recipeId === recipe.id) {
      return { ...this.active };
    }

    const result = await this.lifecycle.ensureActive(recipe);
    if (result.error) {
      throw new Error(result.error);
    }

    const proc = await this.process.findInferenceProcess(this.inferencePort);
    const runtime: ActiveRuntime = {
      recipeId: recipe.id,
      servedModelName: recipe.served_model_name ?? recipe.id,
      backend: recipe.backend,
      port: recipe.port ?? this.inferencePort,
      pid: proc?.pid ?? null,
      activatedAt: new Date().toISOString(),
    };
    this.active = runtime;
    this.events.publish(EVENT_TYPE.RUNTIME_ACTIVATED, runtime);
    return { ...runtime };
  }

  async evict(force = false): Promise<ActiveRuntime | undefined> {
    const previous = this.active;
    if (!previous) return undefined;

    const result = await this.lifecycle.evict(force);
    if (result.success) {
      this.active = undefined;
      this.events.publish(EVENT_TYPE.RUNTIME_EVICTED, previous);
    }
    return previous;
  }

  /** Sync the adapter's view with actual process state. */
  async syncFromProcess(recipe: Recipe): Promise<void> {
    const proc = await this.process.findInferenceProcess(this.inferencePort);
    if (proc) {
      this.active = {
        recipeId: recipe.id,
        servedModelName: recipe.served_model_name ?? recipe.id,
        backend: recipe.backend,
        port: proc.port,
        pid: proc.pid,
        activatedAt: new Date().toISOString(),
      };
    } else {
      this.active = undefined;
    }
  }
}
