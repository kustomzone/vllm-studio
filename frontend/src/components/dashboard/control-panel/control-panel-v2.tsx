// CRITICAL
"use client";

import type { DashboardLayoutProps } from "../layout/dashboard-types";
import { StatusSection } from "./status-section";
import { GpuSection } from "./gpu-section";
import { LogSection } from "./log-section";

export function ControlPanel(props: DashboardLayoutProps) {
  const { currentProcess, currentRecipe, metrics, gpus, recipes, logs } = props;

  return (
    <div className="mx-auto w-full space-y-4">
      {/* Status — header bar with inline Models dropdown */}
      <StatusSection
        currentProcess={currentProcess}
        currentRecipe={currentRecipe}
        metrics={metrics}
        gpus={gpus}
        isConnected={props.isConnected}
        platformKind={props.platformKind}
        inferencePort={props.inferencePort}
        onNavigateChat={props.onNavigateChat}
        onNavigateLogs={props.onNavigateLogs}
        onBenchmark={props.onBenchmark}
        benchmarking={props.benchmarking}
        onStop={props.onStop}
        recipes={recipes}
        launching={props.launching}
        onLaunch={props.onLaunch}
        onNewRecipe={props.onNewRecipe}
        onViewAll={props.onViewAll}
      />

      {/* GPU — when GPUs exist */}
      {gpus.length > 0 && (
        <GpuSection metrics={metrics} gpus={gpus} currentProcess={currentProcess} logs={logs} />
      )}

      {/* Logs */}
      <LogSection logs={logs} />
    </div>
  );
}
