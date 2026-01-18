import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { RecipeWithStatus } from "@/lib/types";

interface QuickLaunchSectionProps {
  recipes: RecipeWithStatus[];
  launching: boolean;
  onLaunch: (recipeId: string) => Promise<void>;
  onNewRecipe: () => void;
  onViewAll: () => void;
}

export function QuickLaunchSection({
  recipes,
  launching,
  onLaunch,
  onNewRecipe,
  onViewAll,
}: QuickLaunchSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return recipes
      .filter(
        (recipe) =>
          recipe.name.toLowerCase().includes(query) ||
          recipe.id.toLowerCase().includes(query) ||
          recipe.model_path.toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [recipes, searchQuery]);

  const handleLaunch = async (recipeId: string) => {
    await onLaunch(recipeId);
    setSearchQuery("");
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-xs uppercase tracking-wider text-(--muted-foreground) font-medium hover:text-(--foreground) transition-colors"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          Quick Launch
        </button>
        <button
          onClick={onNewRecipe}
          className="text-xs text-(--muted-foreground) hover:text-(--foreground) transition-colors duration-200"
        >
          new
        </button>
      </div>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search recipes..."
        className="w-full px-3 py-2 bg-(--card)/50 border border-(--border)/40 rounded-lg text-sm text-(--foreground) placeholder:text-(--muted-foreground)/50 focus:outline-none focus:border-(--border) focus:bg-(--card) transition-all duration-200 mb-3"
      />
      {expanded && (
        <>
          {searchQuery.trim() ? (
            searchResults.length > 0 ? (
              <div className="space-y-0.5">
                {searchResults.map((recipe) => (
                  <RecipeRow
                    key={recipe.id}
                    recipe={recipe}
                    launching={launching}
                    onClick={handleLaunch}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-(--muted-foreground)/60 px-3">No recipes found</p>
            )
          ) : (
            <div className="space-y-0.5">
              {recipes.slice(0, 8).map((recipe) => (
                <RecipeRow
                  key={recipe.id}
                  recipe={recipe}
                  launching={launching}
                  onClick={handleLaunch}
                />
              ))}
              {recipes.length > 8 && (
                <button
                  onClick={onViewAll}
                  className="w-full px-3 py-1.5 text-xs text-(--muted-foreground) hover:text-(--foreground) transition-colors duration-200"
                >
                  View all {recipes.length} recipes →
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function RecipeRow({
  recipe,
  launching,
  onClick,
}: {
  recipe: RecipeWithStatus;
  launching: boolean;
  onClick: (id: string) => void;
}) {
  const disabled = launching || recipe.status === "running";
  return (
    <div
      onClick={() => !disabled && onClick(recipe.id)}
      className={`group px-3 py-2 -mx-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-(--card)/50 ${
        recipe.status === "running" ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            recipe.status === "running" ? "bg-(--success)" : "bg-(--muted)/60"
          }`}
        ></div>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-(--foreground) truncate font-medium">{recipe.name}</div>
          <div className="text-xs text-(--muted-foreground)">
            TP{recipe.tp || recipe.tensor_parallel_size} · {recipe.backend || "vllm"}
          </div>
        </div>
      </div>
    </div>
  );
}
