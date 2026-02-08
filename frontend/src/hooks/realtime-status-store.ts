// CRITICAL
"use client";

import { useSyncExternalStore } from "react";
import type {
  GPU,
  JobRecord,
  Metrics,
  ProcessInfo,
  RuntimeBackendInfo,
  RuntimePlatformKind,
  RuntimeRocmSmiTool,
  ServiceState,
} from "@/lib/types";
import api from "@/lib/api";

export interface StatusData {
  running: boolean;
  process: ProcessInfo | null;
  inference_port: number;
}

export interface LaunchProgressData {
  recipe_id: string;
  stage: "preempting" | "evicting" | "launching" | "waiting" | "ready" | "cancelled" | "error";
  message: string;
  progress?: number;
}

export interface RuntimeSummaryData {
  platform: { kind: RuntimePlatformKind };
  gpu_monitoring: { available: boolean; tool: "nvidia-smi" | RuntimeRocmSmiTool | null };
  backends: { vllm: RuntimeBackendInfo; sglang: RuntimeBackendInfo; llamacpp: RuntimeBackendInfo };
}

export interface RealtimeStatusSnapshot {
  status: StatusData | null;
  gpus: GPU[];
  metrics: Metrics | null;
  launchProgress: LaunchProgressData | null;
  runtimeSummary: RuntimeSummaryData | null;
  services: ServiceState[];
  gpuLease: { holder_service_id: string; acquired_at: string; reason?: string | null } | null;
  jobs: JobRecord[];
  lastEventAt: number;
}

const initialSnapshot: RealtimeStatusSnapshot = {
  status: null,
  gpus: [],
  metrics: null,
  launchProgress: null,
  runtimeSummary: null,
  services: [],
  gpuLease: null,
  jobs: [],
  lastEventAt: 0,
};

let snapshot: RealtimeStatusSnapshot = initialSnapshot;
const listeners = new Set<() => void>();
let started = false;
let pollInterval: ReturnType<typeof setInterval> | null = null;
let clearLaunchTimer: ReturnType<typeof setTimeout> | null = null;
let controllerEventListener: ((event: Event) => void) | null = null;
let visibilityListener: (() => void) | null = null;
let pageShowListener: ((e: PageTransitionEvent) => void) | null = null;

function areProcessInfosEqual(a: ProcessInfo | null, b: ProcessInfo | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.pid === b.pid &&
    a.backend === b.backend &&
    a.model_path === b.model_path &&
    a.port === b.port &&
    (a.served_model_name ?? null) === (b.served_model_name ?? null)
  );
}

function areStatusEqual(a: StatusData | null, b: StatusData | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.running === b.running &&
    a.inference_port === b.inference_port &&
    areProcessInfosEqual(a.process, b.process)
  );
}

function areGpusEqual(a: GPU[], b: GPU[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (!left || !right) return false;
    if (
      left.index !== right.index ||
      left.name !== right.name ||
      left.memory_total !== right.memory_total ||
      left.memory_used !== right.memory_used ||
      left.memory_free !== right.memory_free ||
      left.utilization !== right.utilization ||
      (left.temperature ?? null) !== (right.temperature ?? null) ||
      (left.power_draw ?? null) !== (right.power_draw ?? null) ||
      (left.power_limit ?? null) !== (right.power_limit ?? null)
    ) {
      return false;
    }
  }
  return true;
}

function areMetricsEqual(a: Metrics | null, b: Metrics | null) {
  if (a === b) return true;
  if (!a || !b) return false;

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!(key in b)) return false;
    if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) return false;
  }

  return true;
}

function areLaunchProgressEqual(a: LaunchProgressData | null, b: LaunchProgressData | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.recipe_id === b.recipe_id &&
    a.stage === b.stage &&
    a.message === b.message &&
    (a.progress ?? null) === (b.progress ?? null)
  );
}

function areRuntimeSummaryEqual(a: RuntimeSummaryData | null, b: RuntimeSummaryData | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.platform.kind === b.platform.kind &&
    a.gpu_monitoring.available === b.gpu_monitoring.available &&
    (a.gpu_monitoring.tool ?? null) === (b.gpu_monitoring.tool ?? null) &&
    a.backends.vllm.installed === b.backends.vllm.installed &&
    (a.backends.vllm.version ?? null) === (b.backends.vllm.version ?? null) &&
    a.backends.sglang.installed === b.backends.sglang.installed &&
    (a.backends.sglang.version ?? null) === (b.backends.sglang.version ?? null) &&
    a.backends.llamacpp.installed === b.backends.llamacpp.installed &&
    (a.backends.llamacpp.version ?? null) === (b.backends.llamacpp.version ?? null)
  );
}

function areServicesEqual(a: ServiceState[], b: ServiceState[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (!left || !right) return false;
    if (
      left.id !== right.id ||
      left.status !== right.status ||
      left.runtime !== right.runtime ||
      (left.version ?? null) !== (right.version ?? null) ||
      (left.last_error ?? null) !== (right.last_error ?? null) ||
      (left.pid ?? null) !== (right.pid ?? null) ||
      (left.port ?? null) !== (right.port ?? null)
    ) {
      return false;
    }
  }
  return true;
}

function areGpuLeaseEqual(
  a: RealtimeStatusSnapshot["gpuLease"],
  b: RealtimeStatusSnapshot["gpuLease"],
) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.holder_service_id === b.holder_service_id &&
    a.acquired_at === b.acquired_at &&
    (a.reason ?? null) === (b.reason ?? null)
  );
}

function areJobsEqual(a: JobRecord[], b: JobRecord[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (!left || !right) return false;
    if (
      left.id !== right.id ||
      left.type !== right.type ||
      left.status !== right.status ||
      left.progress !== right.progress ||
      (left.error ?? null) !== (right.error ?? null) ||
      left.updated_at !== right.updated_at
    ) {
      return false;
    }
  }
  return true;
}

function emitIfChanged(next: RealtimeStatusSnapshot) {
  const changed =
    !areStatusEqual(snapshot.status, next.status) ||
    !areGpusEqual(snapshot.gpus, next.gpus) ||
    !areMetricsEqual(snapshot.metrics, next.metrics) ||
    !areLaunchProgressEqual(snapshot.launchProgress, next.launchProgress) ||
    !areRuntimeSummaryEqual(snapshot.runtimeSummary, next.runtimeSummary) ||
    !areServicesEqual(snapshot.services, next.services) ||
    !areGpuLeaseEqual(snapshot.gpuLease, next.gpuLease) ||
    !areJobsEqual(snapshot.jobs, next.jobs);

  snapshot = changed ? next : { ...snapshot, lastEventAt: next.lastEventAt };
  if (!changed) return;

  for (const l of listeners) l();
}

function scheduleLaunchClear(stage: LaunchProgressData["stage"]) {
  if (clearLaunchTimer) {
    clearTimeout(clearLaunchTimer);
    clearLaunchTimer = null;
  }
  if (stage === "ready" || stage === "error" || stage === "cancelled") {
    clearLaunchTimer = setTimeout(() => {
      emitIfChanged({
        ...snapshot,
        launchProgress: null,
        lastEventAt: Date.now(),
      });
    }, 5000);
  }
}

async function fetchStatusNow() {
  try {
    const [{ running, process, inference_port }] = await Promise.all([
      api.getStatus(),
      api.getHealth().catch(() => null),
    ]);

    let gpus: GPU[] = snapshot.gpus;
    try {
      const { gpus: gpuList } = await api.getGPUs();
      gpus = gpuList ?? [];
    } catch {
      // ignore
    }

    // Poll fallback for runtime/platform visibility when SSE is blocked.
    // This intentionally uses /compat instead of /config to avoid slow port-scanning work.
    let runtimeSummary: RuntimeSummaryData | null = snapshot.runtimeSummary;
    if (!runtimeSummary) {
      try {
        const report = await api.getCompatibilityReport();
        runtimeSummary = {
          platform: report.platform as unknown as RuntimeSummaryData["platform"],
          gpu_monitoring: report.gpu_monitoring as RuntimeSummaryData["gpu_monitoring"],
          backends: report.backends as RuntimeSummaryData["backends"],
        };
      } catch {
        // ignore
      }
    }

    let services: ServiceState[] = snapshot.services;
    let gpuLease = snapshot.gpuLease;
    try {
      const { services: list, gpu_lease } = await api.getServices();
      services = Array.isArray(list) ? list : [];
      gpuLease = gpu_lease ?? null;
    } catch {
      // ignore
    }

    let jobs: JobRecord[] = snapshot.jobs;
    try {
      const data = await api.listJobs();
      jobs = Array.isArray(data.jobs) ? data.jobs : [];
    } catch {
      // ignore
    }

    emitIfChanged({
      status: { running, process, inference_port },
      gpus,
      metrics: snapshot.metrics,
      launchProgress: snapshot.launchProgress,
      runtimeSummary,
      services,
      gpuLease,
      jobs,
      lastEventAt: Date.now(),
    });
  } catch {
    // ignore; keep last known values
  }
}

function start() {
  if (started) return;
  started = true;
  if (typeof window === "undefined") return;

  const onControllerEvent = (event: Event) => {
    const custom = event as CustomEvent<{ type?: string; data?: Record<string, unknown> }>;
    const type = custom.detail?.type;
    const data = custom.detail?.data ?? {};

    const now = Date.now();

    if (type === "status") {
      const running = Boolean(data["running"] ?? data["process"]);
      const process = (data["process"] ?? null) as ProcessInfo | null;
      const inference_port = Number(data["inference_port"] ?? 8000);
      emitIfChanged({
        status: { running, process, inference_port },
        gpus: snapshot.gpus,
        metrics: snapshot.metrics,
        launchProgress: snapshot.launchProgress,
        runtimeSummary: snapshot.runtimeSummary,
        services: snapshot.services,
        gpuLease: snapshot.gpuLease,
        jobs: snapshot.jobs,
        lastEventAt: now,
      });
      return;
    }

    if (type === "gpu") {
      const list = (data["gpus"] ?? []) as GPU[];
      emitIfChanged({
        status: snapshot.status,
        gpus: Array.isArray(list) ? list : [],
        metrics: snapshot.metrics,
        launchProgress: snapshot.launchProgress,
        runtimeSummary: snapshot.runtimeSummary,
        services: snapshot.services,
        gpuLease: snapshot.gpuLease,
        jobs: snapshot.jobs,
        lastEventAt: now,
      });
      return;
    }

    if (type === "metrics") {
      emitIfChanged({
        status: snapshot.status,
        gpus: snapshot.gpus,
        metrics: data as Metrics,
        launchProgress: snapshot.launchProgress,
        runtimeSummary: snapshot.runtimeSummary,
        services: snapshot.services,
        gpuLease: snapshot.gpuLease,
        jobs: snapshot.jobs,
        lastEventAt: now,
      });
      return;
    }

    if (type === "runtime_summary") {
      const summary = data as unknown as RuntimeSummaryData;
      const kind = summary?.platform?.kind;
      if (kind !== "cuda" && kind !== "rocm" && kind !== "unknown") {
        return;
      }
      emitIfChanged({
        status: snapshot.status,
        gpus: snapshot.gpus,
        metrics: snapshot.metrics,
        launchProgress: snapshot.launchProgress,
        runtimeSummary: summary,
        services: snapshot.services,
        gpuLease: snapshot.gpuLease,
        jobs: snapshot.jobs,
        lastEventAt: now,
      });
      return;
    }

    if (type === "jobs") {
      const next = (data["jobs"] ?? []) as unknown;
      const list = Array.isArray(next) ? (next as JobRecord[]) : [];
      emitIfChanged({
        status: snapshot.status,
        gpus: snapshot.gpus,
        metrics: snapshot.metrics,
        launchProgress: snapshot.launchProgress,
        runtimeSummary: snapshot.runtimeSummary,
        services: snapshot.services,
        gpuLease: snapshot.gpuLease,
        jobs: list,
        lastEventAt: now,
      });
      return;
    }

    if (type === "job_state_changed") {
      const job = data["job"] as JobRecord | undefined;
      if (!job || typeof job !== "object") return;
      const previous = snapshot.jobs;
      const index = previous.findIndex((entry) => entry.id === job.id);
      const next =
        index === -1
          ? [job, ...previous]
          : [job, ...previous.filter((entry) => entry.id !== job.id)];
      emitIfChanged({
        status: snapshot.status,
        gpus: snapshot.gpus,
        metrics: snapshot.metrics,
        launchProgress: snapshot.launchProgress,
        runtimeSummary: snapshot.runtimeSummary,
        services: snapshot.services,
        gpuLease: snapshot.gpuLease,
        jobs: next,
        lastEventAt: now,
      });
      return;
    }

    if (type === "services") {
      const next = (data["services"] ?? []) as unknown;
      const list = Array.isArray(next) ? (next as ServiceState[]) : [];
      const lease = (data["gpu_lease"] ?? null) as RealtimeStatusSnapshot["gpuLease"];
      emitIfChanged({
        status: snapshot.status,
        gpus: snapshot.gpus,
        metrics: snapshot.metrics,
        launchProgress: snapshot.launchProgress,
        runtimeSummary: snapshot.runtimeSummary,
        services: list,
        gpuLease: lease,
        jobs: snapshot.jobs,
        lastEventAt: now,
      });
      return;
    }

    if (type === "service_state_changed") {
      const service = data["service"] as ServiceState | undefined;
      if (!service || typeof service !== "object") return;
      const previous = snapshot.services;
      const index = previous.findIndex((entry) => entry.id === service.id);
      const next =
        index === -1
          ? [...previous, service].sort((a, b) => a.id.localeCompare(b.id))
          : [...previous.slice(0, index), service, ...previous.slice(index + 1)];
      emitIfChanged({
        status: snapshot.status,
        gpus: snapshot.gpus,
        metrics: snapshot.metrics,
        launchProgress: snapshot.launchProgress,
        runtimeSummary: snapshot.runtimeSummary,
        services: next,
        gpuLease: snapshot.gpuLease,
        jobs: snapshot.jobs,
        lastEventAt: now,
      });
      return;
    }

    if (type === "launch_progress") {
      const progress = data as unknown as LaunchProgressData;
      scheduleLaunchClear(progress.stage);
      emitIfChanged({
        status: snapshot.status,
        gpus: snapshot.gpus,
        metrics: snapshot.metrics,
        launchProgress: progress,
        runtimeSummary: snapshot.runtimeSummary,
        services: snapshot.services,
        gpuLease: snapshot.gpuLease,
        jobs: snapshot.jobs,
        lastEventAt: now,
      });
      return;
    }
  };

  controllerEventListener = onControllerEvent;
  window.addEventListener("vllm:controller-event", onControllerEvent as EventListener);

  // Initial fetch + polling fallback in case SSE is blocked.
  void fetchStatusNow();
  pollInterval = setInterval(() => {
    if (Date.now() - snapshot.lastEventAt < 10_000) return;
    void fetchStatusNow();
  }, 5000);

  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      void fetchStatusNow();
    }
  };
  visibilityListener = onVisibility;
  document.addEventListener("visibilitychange", onVisibility);

  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted) void fetchStatusNow();
  };
  pageShowListener = onPageShow;
  window.addEventListener("pageshow", onPageShow);
}

export function stopRealtimeStatusStore(): void {
  if (!started) return;
  started = false;

  if (typeof window !== "undefined") {
    if (controllerEventListener) {
      window.removeEventListener("vllm:controller-event", controllerEventListener as unknown as EventListener);
      controllerEventListener = null;
    }
    if (pageShowListener) {
      window.removeEventListener("pageshow", pageShowListener as unknown as EventListener);
      pageShowListener = null;
    }
    if (visibilityListener) {
      document.removeEventListener("visibilitychange", visibilityListener);
      visibilityListener = null;
    }
  }

  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  if (clearLaunchTimer) {
    clearTimeout(clearLaunchTimer);
    clearLaunchTimer = null;
  }
}

export function useRealtimeStatusStore(): RealtimeStatusSnapshot {
  start();
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => snapshot,
    () => initialSnapshot,
  );
}
