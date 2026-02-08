// CRITICAL
import { execSync } from "node:child_process";
import { createAppContext } from "./app-context";
import type { Logger } from "./core/logger";
import { createApp } from "./http/app";
import { startMetricsCollector } from "./metrics-collector";

/**
 * Check if GPU monitoring tooling is accessible (important for GPU telemetry).
 * Snap-installed bun has sandbox restrictions that can block GPU tools.
 * @param logger - Logger for emitting warnings.
 */
const checkGpuMonitoringTooling = (logger: Logger): void => {
  const forcedTool = (process.env["VLLM_STUDIO_GPU_SMI_TOOL"] || "").trim().toLowerCase();

  const canRun = (command: string): boolean => {
    try {
      execSync(command, {
        encoding: "utf-8",
        timeout: 5000,
        stdio: "pipe",
      });
      return true;
    } catch {
      return false;
    }
  };

  const platform =
    forcedTool === "nvidia-smi"
      ? "cuda"
      : forcedTool === "amd-smi" || forcedTool === "rocm-smi"
        ? "rocm"
        : canRun("nvidia-smi --query-gpu=name --format=csv,noheader,nounits")
          ? "cuda"
          : canRun("amd-smi version")
            ? "rocm"
            : canRun("rocm-smi --showproductname")
              ? "rocm"
              : "unknown";

  if (platform === "cuda") {
    if (canRun("nvidia-smi --query-gpu=name --format=csv,noheader,nounits")) {
      return;
    }

    const isSnapBun = process.execPath.includes("/snap/");
    logger.warn("╔════════════════════════════════════════════════════════════════╗");
    logger.warn("║  WARNING: nvidia-smi is not accessible                         ║");
    logger.warn("║  GPU monitoring will not work.                                 ║");
    if (isSnapBun) {
      logger.warn("║                                                                ║");
      logger.warn("║  You are using snap-installed bun which has sandbox            ║");
      logger.warn("║  restrictions. Use native bun instead:                         ║");
      logger.warn("║                                                                ║");
      logger.warn("║    curl -fsSL https://bun.sh/install | bash                    ║");
      logger.warn("║    ~/.bun/bin/bun run controller/src/main.ts                   ║");
      logger.warn("║                                                                ║");
      logger.warn("║  Or use the start script: ./start.sh                           ║");
    }
    logger.warn("╚════════════════════════════════════════════════════════════════╝");
    return;
  }

  if (platform === "rocm") {
    const ok =
      (forcedTool === "rocm-smi"
        ? canRun("rocm-smi --showproductname")
        : canRun("amd-smi metric -g 0")) ||
      canRun("amd-smi version") ||
      canRun("rocm-smi --showproductname");

    if (ok) return;

    logger.warn("╔════════════════════════════════════════════════════════════════╗");
    logger.warn("║  WARNING: ROCm SMI tooling is not accessible                    ║");
    logger.warn("║  GPU monitoring may not work.                                  ║");
    logger.warn("╚════════════════════════════════════════════════════════════════╝");
    return;
  }

  logger.info("GPU monitoring tools not detected; GPU telemetry may be unavailable.");
};

const context = createAppContext();
checkGpuMonitoringTooling(context.logger);
const app = createApp(context);
const stopMetrics = startMetricsCollector(context);

/**
 * Start the Bun server.
 * @returns Promise that resolves when started.
 */
const run = async (): Promise<void> => {
  const server = Bun.serve({
    port: context.config.port,
    hostname: context.config.host,
    fetch: app.fetch,
    idleTimeout: 120,
  });

  context.logger.info(`Controller listening on ${context.config.host}:${server.port}`);

  const shutdown = (): void => {
    stopMetrics();
    if (typeof server.stop === "function") {
      server.stop();
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

void run();
