// CRITICAL
"use client";

import { useState, useMemo } from "react";
import type { RecipeWithStatus } from "@/lib/types";
import { SectionCard } from "./status-section";

interface ModelsSectionProps {
  recipes: RecipeWithStatus[];
  launching: boolean;
  onLaunch: (recipeId: string) => Promise<void>;
  onNewRecipe: () => void;
  onViewAll: () => void;
  currentRecipeId?: string;
}

export function ModelsSection({
  recipes,
  launching,
  onLaunch,
  onNewRecipe,
  onViewAll,
  currentRecipeId,
}: ModelsSectionProps) {
  const [filter, setFilter] = useState("");

  const visible = useMemo(() => {
    const q = filter.toLowerCase();
    const base = q
      ? recipes.filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
      : recipes;
    return base.slice(0, 12);
  }, [recipes, filter]);

  return (
    <SectionCard label="Models" icon="box">
      {/* Filter + new */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter models..."
          className="flex-1 py-1.5 px-3 bg-(--bg) rounded-lg text-xs font-mono placeholder:text-(--dim)/60 text-(--fg) focus:outline-none focus:ring-1 focus:ring-(--fg)/20 transition-colors"
        />
        <button
          onClick={onNewRecipe}
          className="text-[11px] font-mono text-(--dim) hover:text-(--fg) transition-colors px-2"
        >
          + new
        </button>
      </div>

      {/* Model cards — no nested borders */}
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
          <p className="text-xs text-(--dim) py-4 text-center">No models found</p>
        )}
      </div>

      {recipes.length > 12 && !filter && (
        <button
          onClick={onViewAll}
          className="mt-3 text-[11px] font-mono text-(--dim) hover:text-(--fg) transition-colors"
        >
          {recipes.length - 12} more →
        </button>
      )}
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
      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${
        isCurrent
          ? "bg-(--fg)/8"
          : "hover:bg-(--fg)/5"
      } ${disabled && !isRunning ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {/* Left accent */}
      <div
        className={`w-0.5 h-4 shrink-0 rounded-full ${
          isCurrent ? "bg-(--fg)" : isRunning ? "bg-(--fg)/60" : "bg-(--dim)/40 group-hover:bg-(--fg)/40"
        }`}
      />

      <span
        className={`text-xs font-mono truncate flex-1 ${
          isCurrent ? "text-(--fg)" : "text-(--fg) group-hover:text-(--fg)"
        } transition-colors`}
      >
        {recipe.name}
      </span>

      {/* Right side metadata */}
      <div className="flex items-center gap-2 shrink-0">
        {isRunning && <span className="h-1.5 w-1.5 rounded-full bg-(--fg) animate-pulse" />}
        <span className="text-[10px] font-mono text-(--dim)">
          tp{recipe.tp || recipe.tensor_parallel_size}
        </span>
      </div>
    </button>
  );
}
