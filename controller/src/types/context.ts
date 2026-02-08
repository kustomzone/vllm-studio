import type { Config } from "../config/env";
import type { Logger } from "../core/logger";
import type { EventManager } from "../services/event-manager";
import type { LaunchState } from "../services/launch-state";
import type { ControllerMetrics, MetricsRegistry } from "../services/metrics";
import type { ProcessManager } from "../services/process-manager";
import type { DownloadManager } from "../services/download-manager";
import type { ChatRunManager } from "../services/agent-runtime/run-manager";
import type { ServiceManager } from "../services/service-manager";
import type { JobManager } from "../services/jobs/job-manager";
import type { ChatStore } from "../stores/chat-store";
import type { DownloadStore } from "../stores/download-store";
import type { JobStore } from "../stores/job-store";
import type { LifetimeMetricsStore, PeakMetricsStore } from "../stores/metrics-store";
import type { McpStore } from "../stores/mcp-store";
import type { RecipeStore } from "../stores/recipe-store";

/**
 * Application-wide dependency container.
 */
export interface AppContext {
  config: Config;
  logger: Logger;
  eventManager: EventManager;
  launchState: LaunchState;
  metrics: ControllerMetrics;
  metricsRegistry: MetricsRegistry;
  processManager: ProcessManager;
  downloadManager: DownloadManager;
  runManager: ChatRunManager;
  serviceManager: ServiceManager;
  jobManager: JobManager;
  stores: {
    recipeStore: RecipeStore;
    chatStore: ChatStore;
    downloadStore: DownloadStore;
    jobStore: JobStore;
    peakMetricsStore: PeakMetricsStore;
    lifetimeMetricsStore: LifetimeMetricsStore;
    mcpStore: McpStore;
  };
}
