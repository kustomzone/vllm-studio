// CRITICAL
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { AppContext } from "./types/context";
import { createConfig } from "./config/env";
import { createEventManager } from "./services/event-manager";
import { createLaunchState } from "./services/launch-state";
import { createMetrics } from "./services/metrics";
import { createProcessManager } from "./services/process-manager";
import { DownloadManager } from "./services/download-manager";
import { createLogger, resolveLogLevel } from "./core/logger";
import { primaryLogPathFor } from "./core/log-files";
import { ChatStore } from "./stores/chat-store";
import { DownloadStore } from "./stores/download-store";
import { PeakMetricsStore, LifetimeMetricsStore } from "./stores/metrics-store";
import { McpStore } from "./stores/mcp-store";
import { RecipeStore } from "./stores/recipe-store";
import { ChatRunManager } from "./services/agent-runtime/run-manager";
import { ServiceManager } from "./services/service-manager";
import { JobStore } from "./stores/job-store";
import { JobManager } from "./services/jobs/job-manager";

/**
 * Create the application dependency container.
 * @returns AppContext instance.
 */
export const createAppContext = (): AppContext => {
  const config = createConfig();

  mkdirSync(config.data_dir, { recursive: true });
  const dbPath = resolve(config.db_path);

  const recipeStore = new RecipeStore(dbPath);
  const chatStore = new ChatStore(resolve(config.data_dir, "chats.db"));
  const downloadStore = new DownloadStore(dbPath);
  const jobStore = new JobStore(dbPath);
  const peakMetricsStore = new PeakMetricsStore(dbPath);
  const lifetimeMetricsStore = new LifetimeMetricsStore(dbPath);
  const mcpStore = new McpStore(dbPath);
  const eventManager = createEventManager();
  const logger = createLogger(resolveLogLevel("info"), {
    filePath: primaryLogPathFor(config.data_dir, "controller"),
    onLine: (line) => eventManager.publishLogLine("controller", line),
  });
  const launchState = createLaunchState();
  const { registry: metricsRegistry, metrics } = createMetrics();
  const processManager = createProcessManager(config, logger, eventManager);
  const downloadManager = new DownloadManager(config, downloadStore, eventManager, logger);

  lifetimeMetricsStore.ensureFirstStarted();

  const baseContext = {
    config,
    logger,
    eventManager,
    launchState,
    metrics,
    metricsRegistry,
    processManager,
    downloadManager,
    serviceManager: null as unknown as ServiceManager,
    jobManager: null as unknown as JobManager,
    stores: {
      recipeStore,
      chatStore,
      downloadStore,
      jobStore,
      peakMetricsStore,
      lifetimeMetricsStore,
      mcpStore,
    },
  } as Omit<AppContext, "runManager" | "serviceManager" | "jobManager"> & { serviceManager: ServiceManager; jobManager: JobManager };

  const serviceManager = new ServiceManager(baseContext as AppContext);
  baseContext.serviceManager = serviceManager;

  const jobManager = new JobManager(baseContext as AppContext);
  baseContext.jobManager = jobManager;

  const runManager = new ChatRunManager(baseContext as AppContext);

  return {
    ...baseContext,
    runManager,
    serviceManager,
    jobManager,
  };
};
