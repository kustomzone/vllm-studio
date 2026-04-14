// CRITICAL
"use client";

import type { DashboardLayoutProps } from "../layout/dashboard-types";
import { StatusSection } from "./status-section";
import { GpuSection } from "./gpu-section";
import { ModelsSection } from "./models-section";
import { LogSection } from "./log-section";

export function ControlPanel(props: DashboardLayoutProps) {
  const { currentProcess, currentRecipe, metrics, gpus, recipes, logs } = props;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Status — always visible */}
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
      />

      {/* GPU — when GPUs exist */}
      {gpus.length > 0 && (
        <GpuSection metrics={metrics} gpus={gpus} currentProcess={currentProcess} logs={logs} />
      )}

      {/* Models */}
      <ModelsSection
        recipes={recipes}
        launching={props.launching}
        onLaunch={props.onLaunch}
        onNewRecipe={props.onNewRecipe}
        onViewAll={props.onViewAll}
        currentRecipeId={currentRecipe?.id}
        runtimeSummary={props.runtimeSummary}
        services={props.services}
        lease={props.lease}
      />

      {/* Logs */}
      <LogSection logs={logs} />
    </div>
  );
}
