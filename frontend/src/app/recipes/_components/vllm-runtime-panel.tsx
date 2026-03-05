// CRITICAL
"use client";

import { ArrowUpCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import api from "@/lib/api";
import type { RuntimeCommandPayload, RuntimeUpgradeResult, VllmUpgradeResult } from "@/lib/types";
import { useMachine } from "@/hooks/use-machine";
import {
  createRuntimePanelMachine,
  getRuntimePanelCards,
  type RuntimeBackendKind,
} from "./vllm-runtime-panel-machine";

export function VllmRuntimePanel() {
  const machineRef = useRef(createRuntimePanelMachine());
  const { state: runtimeState, dispatch } = useMachine(machineRef.current, undefined);

  const loadRuntime = useCallback(async () => {
    dispatch({ type: "runtime/load/request" });

    try {
      const [vllmRuntime, sglangRuntime, llamacppRuntime, cudaRuntime, rocmRuntime] = await Promise.all([
        api.getVllmRuntime(),
        api.getSglangRuntime(),
        api.getLlamacppRuntime(),
        api.getCudaRuntime(),
        api.getRocmRuntime(),
      ]);
      dispatch({
        type: "runtime/load/success",
        payload: {
          vllmRuntime,
          sglangRuntime,
          llamacppRuntime,
          cudaRuntime,
          rocmRuntime,
        },
      });
    } catch (error) {
      dispatch({
        type: "runtime/load/failure",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [dispatch]);

  const loadRuntimeConfig = useCallback(async () => {
    dispatch({ type: "runtime/config/load/request" });

    try {
      const runtimeConfig = await api.getVllmRuntimeConfig();
      dispatch({ type: "runtime/config/load/success", runtimeConfig });
    } catch (error) {
      dispatch({
        type: "runtime/config/load/failure",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [dispatch]);

  const handleRefresh = useCallback(() => {
    void loadRuntime();
    void loadRuntimeConfig();
  }, [loadRuntime, loadRuntimeConfig]);

  const triggerUpgrade = useCallback(
    async (backend: RuntimeBackendKind, payload: RuntimeCommandPayload = {}) => {
      dispatch({ type: "upgrade/request", backend });

      try {
        let result: VllmUpgradeResult | RuntimeUpgradeResult;
        switch (backend) {
          case "vllm":
            result = await api.upgradeVllmRuntime({ preferBundled: true });
            break;
          case "sglang":
            result = await api.upgradeSglangRuntime();
            break;
          case "llamacpp":
            result = await api.upgradeLlamacppRuntime(payload);
            break;
          case "cuda":
            result = await api.upgradeCudaRuntime(payload);
            break;
          case "rocm":
            result = await api.upgradeRocmRuntime(payload);
            break;
          default:
            throw new Error(`Unsupported backend: ${backend}`);
        }

        dispatch({ type: "upgrade/success", backend, result });
        await loadRuntime();
        if (backend === "vllm") {
          await loadRuntimeConfig();
        }
      } catch (error) {
        dispatch({
          type: "upgrade/failure",
          backend,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [dispatch, loadRuntime, loadRuntimeConfig],
  );

  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  const { vllmCards, backendCards } = useMemo(() => getRuntimePanelCards(runtimeState), [runtimeState]);

  return (
    <div style={{ padding: "1.5rem" }} className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Runtime Management</h2>
          <p className="text-sm text-(--dim)">
            Manage vLLM, SGLang, llama.cpp, and platform runtimes from one screen.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={runtimeState.runtimeLoading || runtimeState.runtimeConfigLoading}
          className="flex items-center gap-2 px-3 py-2 bg-(--surface) hover:bg-(--surface) border border-(--border) rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${runtimeState.runtimeLoading || runtimeState.runtimeConfigLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {runtimeState.runtimeError && (
        <div className="p-4 bg-(--err)/10 border border-(--err)/30 rounded-lg text-sm text-(--err)">
          {runtimeState.runtimeError}
        </div>
      )}

      <section className="space-y-3">
        <div className="text-sm font-medium">Inference Backends</div>
        <div className="grid grid-cols-1 gap-4">
          {vllmCards.map((card) => {
            return (
              <div key={card.title} className="bg-(--surface) border border-(--border) rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-(--dim) font-medium">{card.title}</div>
                    <div className="mt-2 text-lg font-semibold">
                      {card.installed ? card.version ?? "Version unknown" : "Not installed"}
                    </div>
                    <div className="text-xs text-(--dim) mt-2">
                      {card.pathLabel}: {card.pathValue}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={() => void triggerUpgrade(card.backend)}
                      disabled={card.upgrading || !card.canUpgrade}
                      className="flex items-center gap-2 px-3 py-2 bg-(--accent) hover:bg-(--accent) text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      <ArrowUpCircle className="w-4 h-4" />
                      {card.upgrading ? "Upgrading..." : "Upgrade"}
                    </button>
                    {card.disabledReason && (
                      <span className="text-xs text-(--dim) text-right max-w-[12rem]">{card.disabledReason}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="text-sm font-medium">Platform Runtimes</div>
        <div className="grid grid-cols-1 gap-4">
          {backendCards.map((card) => {
            return (
              <div key={card.title} className="bg-(--surface) border border-(--border) rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-(--dim) font-medium">{card.title}</div>
                    <div className="mt-2 text-lg font-semibold">
                      {card.version ?? "Not detected"}
                    </div>
                    <div className="text-xs text-(--dim) mt-2">
                      {card.pathLabel}: {card.pathValue}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={() => void triggerUpgrade(card.backend)}
                      disabled={card.upgrading || !card.canUpgrade}
                      className="flex items-center gap-2 px-3 py-2 bg-(--accent) hover:bg-(--accent) text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      <ArrowUpCircle className="w-4 h-4" />
                      {card.upgrading ? "Upgrading..." : "Upgrade"}
                    </button>
                    {card.disabledReason && (
                      <span className="text-xs text-(--dim) text-right max-w-[12rem]">{card.disabledReason}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="bg-(--surface) border border-(--border) rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">vLLM CLI Config (vllm serve --help)</h3>
          <button
            onClick={() => {
              void loadRuntimeConfig();
            }}
            disabled={runtimeState.runtimeConfigLoading}
            className="px-3 py-1.5 bg-(--border) hover:bg-(--surface) rounded-lg text-xs transition-colors disabled:opacity-50"
          >
            {runtimeState.runtimeConfigLoading ? "Loading..." : "Refresh"}
          </button>
        </div>
        {runtimeState.runtimeConfig?.error && <div className="text-xs text-(--err)">{runtimeState.runtimeConfig.error}</div>}
        <pre className="max-h-72 overflow-auto text-xs text-(--fg) whitespace-pre-wrap">
          {runtimeState.runtimeConfig?.config || "No config available."}
        </pre>
      </div>

      {runtimeState.upgradeResult && (
        <div
          className={`p-4 border rounded-lg text-sm ${
            runtimeState.upgradeResult.result.success
              ? "bg-(--hl2)/10 border-(--hl2)/30 text-(--hl2)"
              : "bg-(--err)/10 border-(--err)/30 text-(--err)"
          }`}
        >
          <div className="font-medium">
            {runtimeState.upgradeResult.result.success ? "Upgrade complete" : "Upgrade failed"} (
            {runtimeState.upgradeResult.backend})
            {runtimeState.upgradeResult.result.version ? ` (v ${runtimeState.upgradeResult.result.version})` : ""}
          </div>
          {"used_command" in runtimeState.upgradeResult.result && runtimeState.upgradeResult.result.used_command && (
            <div className="text-xs mt-1 break-all">Command: {runtimeState.upgradeResult.result.used_command}</div>
          )}
          {"used_wheel" in runtimeState.upgradeResult.result && runtimeState.upgradeResult.result.used_wheel && (
            <div className="text-xs mt-1">Wheel: {runtimeState.upgradeResult.result.used_wheel}</div>
          )}
          {runtimeState.upgradeResult.result.error && (
            <div className="text-xs mt-2 whitespace-pre-wrap text-(--err)">{runtimeState.upgradeResult.result.error}</div>
          )}
          {runtimeState.upgradeResult.result.output && (
            <pre className="text-xs mt-2 whitespace-pre-wrap text-(--fg)">{runtimeState.upgradeResult.result.output}</pre>
          )}
        </div>
      )}
    </div>
  );
}
