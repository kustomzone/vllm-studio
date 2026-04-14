// CRITICAL
"use client";

import { RefreshCw } from "lucide-react";
import type { RecipesContentTab } from "./recipes-content-model";

type Props = {
  tab: RecipesContentTab;
  setTab: (tab: RecipesContentTab) => void;
  refreshing: boolean;
  onRefresh: () => void;
};

export function RecipesContentHeader({ tab, setTab, refreshing, onRefresh }: Props) {
  return (
    <>
      <div
        className="flex items-center justify-between border-b border-(--surface)"
        style={{
          paddingLeft: "1.5rem",
          paddingRight: "1.5rem",
          paddingTop: "1rem",
          paddingBottom: "1rem",
        }}
      >
        <h1 className="text-xl font-semibold">Models</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="p-2 hover:bg-(--surface) rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div
        className="flex gap-1 border-b border-(--surface)"
        style={{ paddingLeft: "1.5rem", paddingRight: "1.5rem", paddingTop: "1rem" }}
      >
        <button
          onClick={() => setTab("recipes")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            tab === "recipes"
              ? "text-(--fg) border-(--fg)"
              : "text-(--dim) border-transparent hover:text-(--fg)"
          }`}
        >
          Your Models
        </button>
        <button
          onClick={() => setTab("explore")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            tab === "explore"
              ? "text-(--fg) border-(--fg)"
              : "text-(--dim) border-transparent hover:text-(--fg)"
          }`}
        >
          Explore
        </button>
      </div>
    </>
  );
}

