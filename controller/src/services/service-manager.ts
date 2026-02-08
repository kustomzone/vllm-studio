// CRITICAL
import type { AppContext } from "../types/context";
import type { ServiceId, ServiceState, ServiceStatus } from "../types/services";
import { Event } from "./event-manager";
import { getServiceDefinition, SERVICE_DEFINITIONS } from "./service-registry";
import { resolveBinary, runCommand } from "./command/command-utilities";
import { getSystemRuntimeInfo } from "./runtime-info";
import { GpuLeaseManager, type GpuLease } from "./gpu-lease";

type ServiceStartMode = "strict" | "best_effort";

/**
 * Local Rock-Em service lifecycle manager.
 * Owns "service" state visibility and (when required) strict GPU lease behavior.
 */
export class ServiceManager {
  private readonly context: AppContext;
  private readonly states = new Map<ServiceId, ServiceState>();
  private readonly gpuLease = new GpuLeaseManager();

  /**
   * Create a new ServiceManager.
   * @param context - Controller app context.
   */
  public constructor(context: AppContext) {
    this.context = context;
    const now = new Date().toISOString();
    for (const serviceDefinition of SERVICE_DEFINITIONS) {
      this.states.set(serviceDefinition.id, {
        id: serviceDefinition.id,
        kind: serviceDefinition.kind,
        runtime: serviceDefinition.runtime,
        port: null,
        pid: null,
        status: "stopped",
        version: null,
        last_error: null,
        started_at: null,
        updated_at: now,
      });
    }
  }

  /**
   * Get a snapshot of current service states.
   * @returns Copy of service states.
   */
  private snapshot(): ServiceState[] {
    return SERVICE_DEFINITIONS.map((serviceDefinition) => this.states.get(serviceDefinition.id)!).map((s) => ({ ...s }));
  }

  /**
   * Publish a full snapshot to SSE consumers.
   * @returns void
   */
  private async publishSnapshot(): Promise<void> {
    await this.context.eventManager.publish(new Event("services", {
      services: this.snapshot(),
      gpu_lease: this.gpuLease.getLease(),
    }));
  }

  /**
   * Publish a single service state change to SSE consumers.
   * @param service - Updated service state.
   * @returns void
   */
  private async publishChanged(service: ServiceState): Promise<void> {
    await this.context.eventManager.publish(new Event("service_state_changed", { service }));
  }

  /**
   * Update a service state record.
   * @param id - Service id.
   * @param patch - Partial update.
   * @returns Updated service state.
   */
  private setState(id: ServiceId, patch: Partial<ServiceState>): ServiceState {
    const current = this.states.get(id);
    const now = new Date().toISOString();
    const next: ServiceState = {
      ...(current ?? {
        id,
        kind: "cli-integration",
        runtime: "unknown",
        port: null,
        pid: null,
        status: "stopped",
        version: null,
        last_error: null,
        started_at: null,
        updated_at: now,
      }),
      ...patch,
      updated_at: now,
    };
    this.states.set(id, next);
    return next;
  }

  /**
   * Resolve the CLI binary for a service.
   * @param id - Service id.
   * @returns Resolved binary and its source.
   */
  private getCliBinary(id: ServiceId): { binary: string | null; source: "env" | "default" | "none" } {
    const serviceDefinition = getServiceDefinition(id);
    if (!serviceDefinition?.defaultBinary && !serviceDefinition?.binaryEnvVar) return { binary: null, source: "none" };
    const envVariable = serviceDefinition?.binaryEnvVar;
    const envValue = envVariable ? (process.env[envVariable] ?? "").trim() : "";
    if (envValue) return { binary: envValue, source: "env" };
    return { binary: serviceDefinition?.defaultBinary ?? null, source: "default" };
  }

  /**
   * Probe a CLI binary for a version string.
   * @param binaryPath - Binary path.
   * @param args - Optional version arguments.
   * @returns Version string, or null if unavailable.
   */
  private probeCliVersion(binaryPath: string, args: string[] | undefined): string | null {
    const versionArguments = Array.isArray(args) && args.length > 0 ? args : ["--version"];
    const result = runCommand(binaryPath, versionArguments, 2000);
    const combined = [result.stdout, result.stderr].filter(Boolean).join("\n");
    const lines = combined
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => Boolean(line));

    // Prefer a "real" version line when present, even if the command exits non-zero.
    const stableDiffusion = lines.find((line) => /stable-diffusion\.cpp\s+version/i.test(line));
    if (stableDiffusion) return stableDiffusion;

    const genericVersion = lines.find((line) => /\bversion\b/i.test(line) && /\d/.test(line) && !/^(\[?error\]?|error:)/i.test(line));
    if (genericVersion) return genericVersion;

    // Avoid returning usage/error noise as the "version".
    const firstUseful = lines.find((line) => !/^(\[?error\]?|error:|usage:)/i.test(line));
    return firstUseful || null;
  }

  /**
   * Refresh the "llm" service state from the currently running inference process.
   * @returns void
   */
  private async refreshLlmState(): Promise<void> {
    const current = await this.context.processManager.findInferenceProcess(this.context.config.inference_port);
    let version: string | null = null;
    try {
      const runtime = await getSystemRuntimeInfo(this.context.config);
      version =
        current?.backend === "sglang"
          ? runtime.backends.sglang.version
          : current?.backend === "llamacpp"
            ? runtime.backends.llamacpp.version
            : runtime.backends.vllm.version;
    } catch {
      version = null;
    }

    const status: ServiceStatus = current ? "running" : "stopped";
    this.setState("llm", {
      status,
      pid: current?.pid ?? null,
      port: current?.port ?? this.context.config.inference_port,
      runtime: current?.backend ?? "vllm-studio",
      version,
      ...(current ? { started_at: this.states.get("llm")?.started_at ?? new Date().toISOString() } : { started_at: null }),
    });

    if (current) {
      await this.gpuLease.forceSetLease("llm", "llm running");
    } else {
      await this.gpuLease.release("llm");
    }
  }

  /**
   * List all service states.
   * @returns Service state list.
   */
  public async listServices(): Promise<ServiceState[]> {
    await this.refreshLlmState();
    return this.snapshot();
  }

  /**
   * Get the current GPU lease snapshot (if any).
   * @returns Lease snapshot or null.
   */
  public getGpuLease(): GpuLease | null {
    return this.gpuLease.getLease();
  }

  /**
   * Start a service, optionally acquiring a GPU lease first.
   * @param id - Service id.
   * @param options - Start options.
   * @param options.recipe_id - LLM recipe id.
   * @param options.mode - Lease acquisition mode.
   * @param options.replace - Replace the current lease holder if needed.
   * @returns Service state after start.
   */
  public async startService(
    id: ServiceId,
    options?: { recipe_id?: string; mode?: ServiceStartMode; replace?: boolean },
  ): Promise<ServiceState> {
    const serviceDefinition = getServiceDefinition(id);
    const requiresLease = await this.serviceRequiresGpuLease(id, serviceDefinition);
    const mode: ServiceStartMode = options?.mode ?? "strict";
    const replace = options?.replace === true;

    const acquireLeaseIfNeeded = async (): Promise<void> => {
      if (!requiresLease) return;
      const currentLease = this.gpuLease.getLease();
      const conflicting = currentLease && currentLease.holder_service_id !== id;
      if (conflicting && replace) {
        await this.stopService(currentLease.holder_service_id);
      }
      if (conflicting && mode === "best_effort") {
        return;
      }
      await this.gpuLease.acquireStrict(id, `${id} start`);
    };

    if (id === "llm") {
      await acquireLeaseIfNeeded();
      const recipeId = (options?.recipe_id ?? "").trim();
      if (!recipeId) {
        const state = this.setState("llm", { status: "error", last_error: "recipe_id is required" });
        await this.publishChanged(state);
        await this.publishSnapshot();
        return state;
      }

      const recipe = this.context.stores.recipeStore.get(recipeId);
      if (!recipe) {
        const state = this.setState("llm", { status: "error", last_error: `Recipe not found: ${recipeId}` });
        await this.publishChanged(state);
        await this.publishSnapshot();
        return state;
      }

      this.setState("llm", { status: "starting", last_error: null, started_at: new Date().toISOString() });
      await this.publishSnapshot();
      await this.context.processManager.evictModel(true);
      const launch = await this.context.processManager.launchModel(recipe);
      if (!launch.success) {
        await this.gpuLease.release("llm");
        const state = this.setState("llm", { status: "error", last_error: launch.message });
        await this.publishChanged(state);
        await this.publishSnapshot();
        return state;
      }
      await this.refreshLlmState();
      const state = this.states.get("llm")!;
      await this.publishChanged(state);
      await this.publishSnapshot();
      return { ...state };
    }

    const existing = this.states.get(id);
    if (existing && (existing.status === "ready" || existing.status === "running") && !existing.last_error) {
      return { ...existing };
    }

    const { binary } = this.getCliBinary(id);
    const resolved = binary ? resolveBinary(binary) : null;
    if (!resolved) {
      const state = this.setState(id, {
        status: "error",
        last_error: binary ? `Binary not found: ${binary}` : "No binary configured",
      });
      await this.publishChanged(state);
      await this.publishSnapshot();
      return state;
    }

    await acquireLeaseIfNeeded();
    this.setState(id, { status: "starting", last_error: null, started_at: new Date().toISOString() });
    const version = this.probeCliVersion(resolved, serviceDefinition?.versionArgs);
    const next = this.setState(id, {
      status: "ready",
      version,
      pid: null,
      port: null,
    });
    await this.publishChanged(next);
    await this.publishSnapshot();
    return { ...next };
  }

  /**
   * Stop a service and release any GPU lease it holds.
   * @param id - Service id.
   * @returns Updated service state.
   */
  public async stopService(id: ServiceId): Promise<ServiceState> {
    if (id === "llm") {
      await this.context.processManager.evictModel(true);
      await this.gpuLease.release("llm");
      await this.refreshLlmState();
      const state = this.setState("llm", { status: "stopped", pid: null, started_at: null });
      await this.publishChanged(state);
      await this.publishSnapshot();
      return { ...state };
    }

    const existing = this.states.get(id);
    if (existing && existing.status === "stopped") {
      return { ...existing };
    }

    const serviceDefinition = getServiceDefinition(id);
    if (await this.serviceRequiresGpuLease(id, serviceDefinition)) {
      await this.gpuLease.release(id);
    }
    const state = this.setState(id, { status: "stopped", pid: null, port: null, started_at: null });
    await this.publishChanged(state);
    await this.publishSnapshot();
    return { ...state };
  }

  /**
   * Check health for a service.
   * @param id - Service id.
   * @returns Health status and current service state.
   */
  public async health(id: ServiceId): Promise<{ ok: boolean; service: ServiceState }> {
    if (id === "llm") {
      await this.refreshLlmState();
      const state = this.states.get("llm")!;
      if (!state.port || state.status !== "running") return { ok: false, service: { ...state } };
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`http://localhost:${state.port}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        return { ok: res.status === 200, service: { ...state } };
      } catch {
        return { ok: false, service: { ...state } };
      }
    }

    const state = this.states.get(id) ?? this.setState(id, { status: "stopped" });
    const ok = state.status === "ready" || state.status === "running";
    return { ok, service: { ...state } };
  }

  /**
   * Return the current version string (if available) for a service.
   * @param id - Service id.
   * @returns Version and current service state.
   */
  public async version(id: ServiceId): Promise<{ version: string | null; service: ServiceState }> {
    const state = this.states.get(id);
    if (!state) {
      const next = this.setState(id, { status: "error", last_error: "Unknown service" });
      await this.publishChanged(next);
      await this.publishSnapshot();
      return { version: null, service: { ...next } };
    }
    return { version: state.version, service: { ...state } };
  }

  /**
   * Determine whether a service should acquire a GPU lease.
   * For some integrations (e.g. STT/TTS), this is dynamic based on the selected backend.
   */
  private async serviceRequiresGpuLease(
    id: ServiceId,
    serviceDefinition: ReturnType<typeof getServiceDefinition>,
  ): Promise<boolean> {
    if (serviceDefinition?.requiresGpuLease) return true;
    if (id === "stt") {
      const backend = (process.env["VLLM_STUDIO_STT_BACKEND"] ?? "").trim().toLowerCase();
      return backend.length > 0 && backend !== "cpu";
    }
    if (id === "tts") {
      const backend = (process.env["VLLM_STUDIO_TTS_BACKEND"] ?? "").trim().toLowerCase();
      return backend.length > 0 && backend !== "cpu";
    }
    return false;
  }
}
