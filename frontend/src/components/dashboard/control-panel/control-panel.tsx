// CRITICAL
"use client";

import type { DashboardLayoutProps } from "../layout/dashboard-types";
import { StatusLine } from "./status-line";
import { GpuList } from "./gpu-list";
import { RecipeList } from "./recipe-list";
import { LogStream } from "./log-stream";
import { MetricBar } from "./metric-bar";
import { RuntimesPanel } from "./runtimes-panel";

export function ControlPanel(props: DashboardLayoutProps) {
  const { currentProcess, currentRecipe, metrics, gpus, recipes, logs } = props;

  return (
    <div className="space-y-10">
      {/* Status header */}
      <StatusLine
        currentProcess={currentProcess}
        currentRecipe={currentRecipe}
        isConnected={props.isConnected}
        metrics={metrics}
        gpus={gpus}
        platformKind={props.platformKind}
        inferencePort={props.inferencePort}
        onNavigateChat={props.onNavigateChat}
        onNavigateLogs={props.onNavigateLogs}
        onBenchmark={props.onBenchmark}
        benchmarking={props.benchmarking}
        onStop={props.onStop}
      />

      {/* Geometric metric strip — only when a model is running */}
      {currentProcess && (
        <MetricBar metrics={metrics} gpus={gpus} currentProcess={currentProcess} logs={logs} />
      )}

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-2 gap-12 min-w-0 items-start">
        <GpuList gpus={gpus} />

        <div className="flex flex-col gap-10 min-w-0">
          <RecipeList
            recipes={recipes}
            launching={props.launching}
            onLaunch={props.onLaunch}
            onNewRecipe={props.onNewRecipe}
            onViewAll={props.onViewAll}
            currentRecipeId={currentRecipe?.id}
          />
          <RuntimesPanel
            runtimeSummary={props.runtimeSummary}
            services={props.services}
            lease={props.lease}
          />
        </div>
      </div>

      {/* Logs */}
      <LogStream logs={logs} />
    </div>
  );
}
