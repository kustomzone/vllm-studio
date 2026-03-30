/**
 * Kernel-level status and event type constants.
 *
 * These are the canonical values used inside the kernel layer.
 * They deliberately mirror the idealized reference model so the kernel
 * remains a thin, testable orchestration layer.
 */

export const RUN_STATUS = Object.freeze({
  STARTING: "starting",
  RUNNING: "running",
  COMPLETED: "completed",
  ABORTED: "aborted",
  FAILED: "failed",
} as const);

export type RunStatus = (typeof RUN_STATUS)[keyof typeof RUN_STATUS];

export const DOWNLOAD_STATUS = Object.freeze({
  QUEUED: "queued",
  DOWNLOADING: "downloading",
  PAUSED: "paused",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELED: "canceled",
} as const);

export type DownloadStatus = (typeof DOWNLOAD_STATUS)[keyof typeof DOWNLOAD_STATUS];

export const JOB_STATUS = Object.freeze({
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
} as const);

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export const EVENT_TYPE = Object.freeze({
  RECIPE_UPSERTED: "recipe.upserted",
  RUNTIME_ACTIVATING: "runtime.activating",
  RUNTIME_ACTIVATED: "runtime.activated",
  RUNTIME_EVICTED: "runtime.evicted",
  MODEL_SWITCHED: "runtime.model_switched",
  CHAT_RUN_STARTED: "chat.run.started",
  CHAT_RUN_COMPLETED: "chat.run.completed",
  CHAT_RUN_ABORTED: "chat.run.aborted",
  CHAT_MESSAGE_ADDED: "chat.message.added",
  PROXY_COMPLETED: "proxy.completed",
  DOWNLOAD_UPDATED: "download.updated",
  JOB_UPDATED: "job.updated",
  NODE_UPDATED: "distributed.node.updated",
  TOPOLOGY_UPDATED: "distributed.topology.updated",
} as const);

export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];
