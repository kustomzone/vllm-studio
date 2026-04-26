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

  const { visible, matchCount } = useMemo(() => {
    const q = filter.toLowerCase();
    const base = q
      ? recipes.filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
      : recipes;
    return { visible: base.slice(0, q ? 8 : 5), matchCount: base.length };
  }, [recipes, filter]);

  return (
    <SectionCard label="Models">
      {/* Filter + new */}
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] border border-(--border) bg-(--bg)">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search models..."
          className="min-w-0 border-0 bg-transparent px-3 py-2 font-mono text-xs text-(--fg) placeholder:text-(--dim)/60 focus:outline-none"
        />
        <button
          onClick={onNewRecipe}
          className="border-l border-(--border) px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-(--dim) transition-colors hover:bg-(--fg)/5 hover:text-(--fg)"
        >
          + new
        </button>
      </div>

      {/* Model cards — no nested borders */}
      <div className="border border-(--border)">
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
          <p className="py-8 text-center font-mono text-sm text-(--dim)">No models found</p>
        )}
      </div>

      {matchCount > visible.length && (
        <button
          onClick={onViewAll}
          className="mt-3 text-[11px] font-mono text-(--dim) hover:text-(--fg) transition-colors"
        >
          {filter
            ? `${matchCount - visible.length} more →`
            : `Search ${recipes.length} models or view all →`}
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
      className={`group flex w-full items-center gap-3 border-b border-(--border) px-3 py-2.5 text-left last:border-b-0 transition-colors ${
        isCurrent ? "bg-(--fg)/8" : "hover:bg-(--fg)/5"
      } ${disabled && !isRunning ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {/* Left accent */}
      <div
        className={`h-4 w-0.5 shrink-0 ${
          isCurrent
            ? "bg-(--fg)"
            : isRunning
              ? "bg-(--fg)/60"
              : "bg-(--dim)/40 group-hover:bg-(--fg)/40"
        }`}
      />

      <span
        className={`flex-1 truncate font-mono text-sm ${
          isCurrent ? "text-(--fg)" : "text-(--fg) group-hover:text-(--fg)"
        } transition-colors`}
      >
        {recipe.name}
      </span>

      {/* Right side metadata */}
      <div className="flex items-center gap-2 shrink-0">
        {isRunning && <span className="h-1.5 w-1.5 bg-(--fg)" />}
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-(--dim)">
          tp{recipe.tp || recipe.tensor_parallel_size}
        </span>
      </div>
    </button>
  );
}
