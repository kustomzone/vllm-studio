"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import type { HuggingFaceModel, ModelRecommendation } from "@/lib/types";
import { extractQuantizations } from "@/app/discover/_components/utils";

function normalizeModelId(modelId: string): string {
  return modelId
    .toLowerCase()
    .replace(/[-_](awq|gptq|gguf|exl2|fp8|fp16|bf16|int8|int4|w4a16|w8a16)[-_]?/gi, "");
}

interface ModelGroup {
  key: string;
  lead: HuggingFaceModel;
  variants: HuggingFaceModel[];
  totalDownloads: number;
}

export function useExplore() {
  const [models, setModels] = useState<HuggingFaceModel[]>([]);
  const [maxVramGb, setMaxVramGb] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [recommendations, setRecommendations] = useState<ModelRecommendation[]>([]);
  const PAGE_SIZE = 50;

  const loadRecommendations = useCallback(async () => {
    try {
      const data = await api.getModelRecommendations();
      setRecommendations(data.recommendations ?? []);
      const vram = typeof data.max_vram_gb === "number" ? data.max_vram_gb : 0;
      setMaxVramGb(vram);
    } catch {
      setRecommendations([]);
      setMaxVramGb(0);
    }
  }, []);

  const fetchModels = useCallback(
    async (append = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        params.set("filter", "text-generation");
        params.set("sort", "modified");
        params.set("limit", String(PAGE_SIZE));
        params.set("full", "false");
        params.set("offset", String(append ? page * PAGE_SIZE : 0));

        const response = await fetch(`/api/proxy/v1/huggingface/models?${params.toString()}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: "Failed to fetch" }));
          throw new Error(errorData.detail || "Failed to fetch");
        }
        const data = await response.json();

        if (append) {
          setModels((prev) => [...prev, ...data]);
        } else {
          setModels(data);
        }
        setHasMore(data.length === PAGE_SIZE);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [search, page],
  );

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  useEffect(() => {
    setPage(0);
    const debounce = setTimeout(() => fetchModels(false), 300);
    return () => clearTimeout(debounce);
  }, [fetchModels]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage((p) => p + 1);
      fetchModels(true);
    }
  }, [loading, hasMore, fetchModels]);

  const groupedModels = useMemo((): ModelGroup[] => {
    const groups = new Map<string, HuggingFaceModel[]>();
    const seen = new Set<string>();

    // Add recommendation models first (they have VRAM data)
    for (const rec of recommendations) {
      if (maxVramGb > 0 && rec.min_vram_gb && rec.min_vram_gb > maxVramGb) continue;
      const key = normalizeModelId(rec.id) || rec.id.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        // Create a synthetic HuggingFaceModel from the recommendation
        groups.set(key, [{
          _id: rec.id,
          modelId: rec.id,
          downloads: 0,
          likes: 0,
          tags: rec.tags ?? [],
          private: false,
        }]);
      }
    }

    // Add HuggingFace search results (only last 3 months)
    const threeMonthsAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    for (const model of models) {
      if (model.lastModified && new Date(model.lastModified).getTime() < threeMonthsAgo) continue;
      const key = normalizeModelId(model.modelId) || model.modelId.toLowerCase();
      const existing = groups.get(key);
      if (existing) {
        // Merge: if the first entry was a synthetic recommendation with 0 downloads,
        // replace with the real HF model that has actual data
        if (existing.length === 1 && existing[0].downloads === 0 && !existing[0].lastModified) {
          groups.set(key, [model]);
        } else {
          existing.push(model);
        }
      } else if (!seen.has(key)) {
        seen.add(key);
        groups.set(key, [model]);
      } else {
        // Already seen via recommendation, add as variant
        const g = groups.get(key);
        if (g) g.push(model);
      }
    }

    return Array.from(groups.entries()).map(([key, variants]) => {
      const sorted = [...variants].sort((a, b) => b.downloads - a.downloads);
      const totalDownloads = sorted.reduce((sum, v) => sum + v.downloads, 0);
      return { key, lead: sorted[0], variants: sorted, totalDownloads };
    });
  }, [models, recommendations, maxVramGb]);

  // Sort groups: recommendations first (by min_vram_gb ascending), then by recency × popularity
  const sortedGroups = useMemo(() => {
    const recIds = new Set(recommendations.map((r) => normalizeModelId(r.id) || r.id.toLowerCase()));
    return [...groupedModels].sort((a, b) => {
      const aIsRec = recIds.has(a.key);
      const bIsRec = recIds.has(b.key);
      if (aIsRec && !bIsRec) return -1;
      if (!aIsRec && bIsRec) return 1;
      // For non-recommendations: sort by downloads (most popular first)
      return b.totalDownloads - a.totalDownloads;
    });
  }, [groupedModels, recommendations]);

  const refresh = useCallback(() => fetchModels(false), [fetchModels]);

  return {
    groups: sortedGroups,
    maxVramGb,
    loading,
    error,
    search,
    hasMore,
    recommendations,
    setSearch,
    loadMore,
    refresh,
  };
}
