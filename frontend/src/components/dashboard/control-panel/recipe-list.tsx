// CRITICAL
"use client";

import { useState, useMemo } from "react";
import type { RecipeWithStatus } from "@/lib/types";

interface RecipeListProps {
  recipes: RecipeWithStatus[];
  launching: boolean;
  onLaunch: (recipeId: string) => Promise<void>;
  onNewRecipe: () => void;
  onViewAll: () => void;
  currentRecipeId?: string;
}

export function RecipeList({
  recipes,
  launching,
  onLaunch,
  onNewRecipe,
  onViewAll,
  currentRecipeId,
}: RecipeListProps) {
  const [filter, setFilter] = useState("");

  const visibleRecipes = useMemo(() => {
    const q = filter.toLowerCase();
    if (!q) return recipes.slice(0, 10);
    return recipes
      .filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
      .slice(0, 10);
  }, [recipes, filter]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[10px] uppercase tracking-[0.16em] text-(--dim)/50 font-mono">Recipes</span>
        <div className="flex-1 h-px bg-(--border)/20" />
        <button
          onClick={onNewRecipe}
          className="text-[10px] font-mono text-(--dim)/40 hover:text-(--fg)/60 transition-colors"
        >
          + new
        </button>
      </div>

      {/* Filter */}
      <div className="relative mb-3">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filter recipes..."
          className="w-full py-1.5 pr-3 pl-3 bg-(--fg)/[0.03] border-0 border-b border-(--border)/20 text-[11px] font-mono placeholder:text-(--dim)/25 text-(--fg)/70 focus:outline-none focus:border-(--border)/40 transition-colors"
        />
      </div>

      {/* List */}
      <div>
        {visibleRecipes.map((recipe) => (
          <RecipeItem
            key={recipe.id}
            recipe={recipe}
            isRunning={recipe.status === "running"}
            isCurrent={recipe.id === currentRecipeId}
            disabled={launching || recipe.status === "running"}
            onClick={() => onLaunch(recipe.id)}
          />
        ))}

        {visibleRecipes.length === 0 && (
          <p className="text-[11px] text-(--dim)/30 font-mono py-3">no matches</p>
        )}
      </div>

      {recipes.length > 10 && !filter && (
        <button
          onClick={onViewAll}
          className="mt-2 text-[10px] font-mono text-(--dim)/30 hover:text-(--dim)/50 transition-colors"
        >
          {recipes.length - 10} more →
        </button>
      )}
    </div>
  );
}

function RecipeItem({
  recipe,
  isRunning,
  isCurrent,
  disabled,
  onClick,
}: {
  recipe: RecipeWithStatus;
  isRunning: boolean;
  isCurrent?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left py-2 pr-2 flex items-center gap-3 border-t border-(--border)/[0.07] first:border-t-0 transition-colors group ${
        disabled && !isRunning ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      {/* Left accent line */}
      <div
        className={`w-0.5 h-4 shrink-0 transition-colors ${
          isCurrent
            ? "bg-(--hl2)"
            : isRunning
              ? "bg-(--hl2)/40"
              : "bg-(--border)/20 group-hover:bg-(--border)/50"
        }`}
      />

      <span
        className={`text-[11px] font-mono truncate flex-1 ${
          isCurrent ? "text-(--hl2)" : "text-(--fg)/60 group-hover:text-(--fg)/80"
        } transition-colors`}
      >
        {recipe.name}
      </span>

      <div className="flex items-center gap-2 shrink-0">
        {isRunning && (
          <span className="h-1.5 w-1.5 rounded-full bg-(--hl2) animate-pulse" />
        )}
        <span className="text-[9px] font-mono text-(--dim)/30">
          tp{recipe.tp || recipe.tensor_parallel_size}
        </span>
      </div>
    </button>
  );
}
