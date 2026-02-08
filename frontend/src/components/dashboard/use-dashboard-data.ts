import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeStatus } from "@/hooks/use-realtime-status";
import type { RuntimePlatformKind } from "@/lib/types";
import api from "@/lib/api";
import { useDashboardActions } from "./use-dashboard-actions";
import { useDashboardRecipes } from "./use-dashboard-recipes";

const DONE_STAGES = new Set(["ready", "error", "cancelled"]);

export function useDashboardData() {
  const router = useRouter();
  const realtime = useRealtimeStatus();
  const currentProcess = realtime.status?.process || null;
  const gpus = realtime.gpus.length > 0 ? realtime.gpus : [];
  const [platformKind, setPlatformKind] = useState<RuntimePlatformKind | null>(null);
  const recipesState = useDashboardRecipes(currentProcess);
  const actions = useDashboardActions(recipesState.reload);

  useEffect(() => {
    if (!realtime.isConnected) return;
    let cancelled = false;

    api.getSystemConfig()
      .then((config) => {
        if (!cancelled) {
          setPlatformKind(config.runtime.platform.kind);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlatformKind("unknown");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [realtime.isConnected]);

  useEffect(() => {
    if (DONE_STAGES.has(realtime.launchProgress?.stage || "")) {
      recipesState.reload();
    }
  }, [realtime.launchProgress?.stage, recipesState.reload]);

  const navigate = (path: string) => () => router.push(path);

  return {
    currentProcess,
    currentRecipe: recipesState.currentRecipe,
    metrics: realtime.metrics,
    gpus,
    platformKind,
    recipes: recipesState.recipes,
    logs: recipesState.logs,
    loading: recipesState.loading,
    launchProgress: realtime.launchProgress,
    isConnected: realtime.isConnected,
    reconnectAttempts: realtime.reconnectAttempts,
    inferencePort: realtime.status?.inference_port,
    benchmarking: actions.benchmarking,
    launching: actions.launching,
    onLaunch: actions.onLaunch,
    onStop: actions.onStop,
    onBenchmark: actions.onBenchmark,
    onNavigateChat: navigate("/chat"),
    onNavigateLogs: navigate("/logs"),
    onNewRecipe: navigate("/recipes?new=1"),
    onViewAll: navigate("/recipes"),
  };
}
