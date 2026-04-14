// CRITICAL
"use client";

import { useState, useMemo } from "react";
import type { RecipeWithStatus } from "@/lib/types";
import type { RuntimeSummaryData, ServiceEntry, LeaseInfo } from "@/hooks/realtime-status-store/types";
import { SectionCard } from "./status-section";

interface ModelsSectionProps {
  recipes: RecipeWithStatus[];
  launching: boolean;
  onLaunch: (recipeId: string) => Promise<void>;
  onNewRecipe: () => void;
  onViewAll: () => void;
  currentRecipeId?: string;
  runtimeSummary?: RuntimeSummaryData | null;
  services?: ServiceEntry[];
  lease?: LeaseInfo | null;
}

export function ModelsSection({
  recipes,
  launching,
  onLaunch,
  onNewRecipe,
  onViewAll,
  currentRecipeId,
  runtimeSummary,
  services = [],
  lease,
}: ModelsSectionProps) {
  const [filter, setFilter] = useState("");

  const visible = useMemo(() => {
    const q = filter.toLowerCase();
    const base = q
      ? recipes.filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
      : recipes;
    return base.slice(0, 12);
  }, [recipes, filter]);

  const backends = runtimeSummary?.backends;
  const gpuMon = runtimeSummary?.gpu_monitoring;

  return (
    <SectionCard label="Models" icon="box">
      {/* Filter + new */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter models..."
          className="flex-1 py-1.5 px-3 bg-(--bg) border border-(--border)/30 rounded-lg text-xs font-mono placeholder:text-(--dim)/25 text-(--fg)/80 focus:outline-none focus:border-(--border)/60 transition-colors"
        />
        <button
          onClick={onNewRecipe}
          className="text-[10px] font-mono text-(--dim)/40 hover:text-(--hl2) transition-colors px-2"
        >
          + new
        </button>
      </div>

      {/* Model cards */}
      <div className="space-y-1">
        {visible.map((recipe) => (
          <ModelCard
            key={recipe.id}
            recipe={recipe}
            isCurrent={recipe.id === currentRecipeId}
            disabled={launching || recipe.status === "running"}
            onLaunch={() => onLaunch(recipe.id)}
          />
        ))}
        {visible.length === 0 && (
          <p className="text-xs text-(--dim)/30 py-4 text-center">No models found</p>
        )}
      </div>

      {recipes.length > 12 && !filter && (
        <button
          onClick={onViewAll}
          className="mt-3 text-[10px] font-mono text-(--dim)/30 hover:text-(--dim)/50 transition-colors"
        >
          {recipes.length - 12} more →
        </button>
      )}

      {/* Runtimes sub-section */}
      <div className="mt-6 pt-5 border-t border-(--border)/20">
        <h3 className="text-[11px] uppercase tracking-[0.12em] font-medium text-(--dim)/40 mb-3">Runtimes</h3>

        {gpuMon && (
          <div className="text-xs font-mono text-(--dim)/50 mb-3">
            GPU monitoring:{" "}
            <span className={gpuMon.available ? "text-(--hl2)" : "text-(--err)"}>
              {gpuMon.available ? (gpuMon.tool ?? "available") : "unavailable"}
            </span>
          </div>
        )}

        {backends && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {(["vllm", "sglang", "llamacpp"] as const).map((key) => {
              const b = backends[key];
              return (
                <div key={key} className="px-3 py-2 rounded-lg bg-(--bg) border border-(--border)/20">
                  <div className="text-[10px] text-(--dim)/40 mb-0.5">{key}</div>
                  <div className={`text-xs font-mono ${b.installed ? "text-(--hl2)" : "text-(--dim)/25"}`}>
                    {b.installed ? (b.version ?? "installed") : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {services.length > 0 && (
          <div className="space-y-1 mb-3">
            <div className="text-[10px] uppercase tracking-wider text-(--dim)/30 mb-1">Services</div>
            {services.map((svc) => (
              <div
                key={svc.id}
                className="flex items-center justify-between text-xs font-mono px-3 py-1.5 rounded-lg bg-(--bg) border border-(--border)/15"
              >
                <span className="text-(--dim)/50">{svc.id}</span>
                <span
                  className={
                    svc.status === "running"
                      ? "text-(--hl2)"
                      : svc.status === "error"
                        ? "text-(--err)"
                        : "text-(--dim)/30"
                  }
                >
                  {svc.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {lease?.holder && (
          <div className="text-xs font-mono text-(--dim)/40">
            GPU lease: <span className="text-(--hl1)">{lease.holder}</span>
          </div>
        )}

        {!runtimeSummary && services.length === 0 && (
          <div className="text-xs text-(--dim)/25 font-mono">Waiting for runtime summary…</div>
        )}
      </div>
    </SectionCard>
  );
}

function ModelCard({
  recipe,
  isCurrent,
  disabled,
  onLaunch,
}: {
  recipe: RecipeWithStatus;
  isCurrent: boolean;
  disabled: boolean;
  onLaunch: () => void;
}) {
  const isRunning = recipe.status === "running";
  return (
    <button
      onClick={onLaunch}
      disabled={disabled}
      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors group ${
        isCurrent
          ? "border-(--hl2)/30 bg-(--hl2)/5"
          : "border-(--border)/15 bg-transparent hover:bg-(--surface)/50 hover:border-(--border)/30"
      } ${disabled && !isRunning ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {/* Left accent */}
      <div
        className={`w-0.5 h-4 shrink-0 rounded-full ${
          isCurrent ? "bg-(--hl2)" : isRunning ? "bg-(--hl2)/40" : "bg-(--border)/20 group-hover:bg-(--border)/50"
        }`}
      />

      <span
        className={`text-xs font-mono truncate flex-1 ${
          isCurrent ? "text-(--hl2)" : "text-(--fg)/70 group-hover:text-(--fg)"
        } transition-colors`}
      >
        {recipe.name}
      </span>

      {/* Right side metadata */}
      <div className="flex items-center gap-2 shrink-0">
        {isRunning && <span className="h-1.5 w-1.5 rounded-full bg-(--hl2) animate-pulse" />}
        <span className="text-[10px] font-mono text-(--dim)/30">
          tp{recipe.tp || recipe.tensor_parallel_size}
        </span>
      </div>
    </button>
  );
}
