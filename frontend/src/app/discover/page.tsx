"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  RefreshCw,
  Download,
  Heart,
  ExternalLink,
  Filter,
  TrendingUp,
  X,
  Copy,
  Check,
  CheckCircle2,
} from "lucide-react";
import api from "@/lib/api";
import type { ModelInfo, HuggingFaceModel } from "@/lib/types";
import { formatNumber } from "@/lib/formatters";
import { RefreshButton } from "@/components/shared";

const TASKS = [
  { value: "", label: "All Tasks" },
  { value: "text-generation", label: "Text Generation" },
  { value: "text2text-generation", label: "Text-to-Text" },
  { value: "conversational", label: "Conversational" },
  { value: "fill-mask", label: "Fill Mask" },
  { value: "question-answering", label: "Question Answering" },
  { value: "summarization", label: "Summarization" },
  { value: "translation", label: "Translation" },
  { value: "feature-extraction", label: "Feature Extraction" },
  { value: "image-to-text", label: "Image to Text" },
];

const SORT_OPTIONS = [
  { value: "trending", label: "Trending", icon: TrendingUp },
  { value: "downloads", label: "Most Downloads", icon: Download },
  { value: "likes", label: "Most Likes", icon: Heart },
  { value: "modified", label: "Recently Updated", icon: RefreshCw },
];

const QUANTIZATION_TAGS = [
  "awq",
  "gptq",
  "gguf",
  "exl2",
  "fp8",
  "fp16",
  "bf16",
  "int8",
  "int4",
  "w4a16",
  "w8a16",
];

function extractProvider(modelId: string): string {
  const parts = modelId.split("/");
  if (parts.length >= 2) {
    return parts[0];
  }
  return "HuggingFace";
}

function extractQuantizations(tags: string[]): string[] {
  const quantizations: string[] = [];
  const tagLower = tags.map((t) => t.toLowerCase());

  for (const quant of QUANTIZATION_TAGS) {
    if (tagLower.includes(quant.toLowerCase())) {
      quantizations.push(quant.toUpperCase());
    }
  }

  return quantizations;
}

function normalizeModelId(modelId: string): string {
  return modelId
    .toLowerCase()
    .replace(/[-_](awq|gptq|gguf|exl2|fp8|fp16|bf16|int8|int4|w4a16|w8a16)[-_]?/gi, "");
}

export default function DiscoverPage() {
  const [models, setModels] = useState<HuggingFaceModel[]>([]);
  const [localModels, setLocalModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [task, setTask] = useState("text-generation");
  const [sort, setSort] = useState("trending");
  const [library, setLibrary] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [providerFilter, setProviderFilter] = useState<string>("");

  const PAGE_SIZE = 50;

  // Load local models
  useEffect(() => {
    let mounted = true;
    api
      .getModels()
      .then((data) => {
        if (mounted) {
          setLocalModels(data.models || []);
        }
      })
      .catch(() => {
        if (mounted) setLocalModels([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Create a map of local model names for quick lookup
  const localModelMap = useMemo(() => {
    const map = new Map<string, boolean>();
    localModels.forEach((model) => {
      const normalized = normalizeModelId(model.name);
      map.set(normalized, true);
      const pathParts = model.path.split("/");
      pathParts.forEach((part) => {
        const normalizedPart = normalizeModelId(part);
        if (normalizedPart) map.set(normalizedPart, true);
      });
    });
    return map;
  }, [localModels]);

  const isModelLocal = useCallback(
    (modelId: string): boolean => {
      const normalized = normalizeModelId(modelId);
      if (localModelMap.has(normalized)) return true;
      const parts = normalized.split(/[-_/]/);
      for (const part of parts) {
        if (part && localModelMap.has(part)) return true;
      }
      return false;
    },
    [localModelMap],
  );

  const fetchModels = useCallback(
    async (append = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (task) params.set("filter", task);
        if (library) params.set("filter", library);
        params.set("sort", sort);
        params.set("limit", String(PAGE_SIZE));
        params.set("full", "false");
        params.set("offset", String(append ? page * PAGE_SIZE : 0));

        const response = await fetch(`/api/proxy/v1/huggingface/models?${params.toString()}`);
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ detail: "Failed to fetch models" }));
          throw new Error(errorData.detail || "Failed to fetch models");
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
    [library, page, search, sort, task],
  );

  useEffect(() => {
    setPage(0);
    const debounce = setTimeout(() => {
      fetchModels(false);
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchModels, library, search, sort, task]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchModels(true);
    }
  }, [page, loading, hasMore, fetchModels]);

  const copyModelId = (modelId: string) => {
    navigator.clipboard.writeText(modelId);
    setCopiedId(modelId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Extract unique providers from models
  const providers = useMemo(() => {
    const providerSet = new Set<string>();
    models.forEach((model) => {
      providerSet.add(extractProvider(model.modelId));
    });
    return Array.from(providerSet).sort();
  }, [models]);

  // Filter models by provider
  const filteredModels = useMemo(() => {
    if (!providerFilter) return models;
    return models.filter((model) => extractProvider(model.modelId) === providerFilter);
  }, [models, providerFilter]);

  return (
    <div className="flex flex-col h-full bg-(--background) text-(--foreground)">
      {/* Header */}
      <div
        className="flex items-center justify-between border-b border-(--border)"
        style={{
          paddingLeft: "1.5rem",
          paddingRight: "1.5rem",
          paddingTop: "1rem",
          paddingBottom: "1rem",
        }}
      >
        <h1 className="text-xl font-semibold">Discover Models</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              showFilters
                ? "bg-(--accent-purple) text-white"
                : "bg-(--card) border border-(--border) text-(--muted-foreground) hover:text-(--foreground)"
            }`}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>
          {RefreshButton({ onRefresh: () => fetchModels(false), loading, className: "hover:bg-(--card-hover) disabled:opacity-50" })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div style={{ padding: "1.5rem" }}>
          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--muted-foreground)" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                className="w-full pl-10 pr-4 py-2 bg-(--card) border border-(--border) rounded-lg text-sm text-(--foreground) placeholder:text-(--muted-foreground)/50 focus:outline-none focus:border-(--accent-purple)"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-(--card-hover) rounded transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-(--muted-foreground)" />
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mb-4 p-4 bg-(--card) border border-(--border) rounded-lg">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {/* Task filter */}
                <div>
                  <label className="block text-xs text-(--muted-foreground) mb-1.5">
                    Task
                  </label>
                  <select
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                    className="w-full px-3 py-2 bg-(--background) border border-(--border) rounded-lg text-sm text-(--foreground) focus:outline-none focus:border-(--accent-purple)"
                  >
                    {TASKS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Provider filter */}
                <div>
                  <label className="block text-xs text-(--muted-foreground) mb-1.5">
                    Provider
                  </label>
                  <select
                    value={providerFilter}
                    onChange={(e) => setProviderFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-(--background) border border-(--border) rounded-lg text-sm text-(--foreground) focus:outline-none focus:border-(--accent-purple)"
                  >
                    <option value="">All Providers</option>
                    {providers.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Library filter */}
                <div>
                  <label className="block text-xs text-(--muted-foreground) mb-1.5">
                    Library
                  </label>
                  <select
                    value={library}
                    onChange={(e) => setLibrary(e.target.value)}
                    className="w-full px-3 py-2 bg-(--background) border border-(--border) rounded-lg text-sm text-(--foreground) focus:outline-none focus:border-(--accent-purple)"
                  >
                    <option value="">All Libraries</option>
                    <option value="transformers">Transformers</option>
                    <option value="pytorch">PyTorch</option>
                    <option value="safetensors">Safetensors</option>
                    <option value="gguf">GGUF</option>
                    <option value="exl2">EXL2</option>
                    <option value="awq">AWQ</option>
                    <option value="gptq">GPTQ</option>
                  </select>
                </div>

                {/* Sort */}
                <div>
                  <label className="block text-xs text-(--muted-foreground) mb-1.5">
                    Sort By
                  </label>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="w-full px-3 py-2 bg-(--background) border border-(--border) rounded-lg text-sm text-(--foreground) focus:outline-none focus:border-(--accent-purple)"
                  >
                    {SORT_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Quick sort chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {SORT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => setSort(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors ${
                    sort === opt.value
                      ? "bg-(--accent-purple) text-white"
                      : "bg-(--card) border border-(--border) text-(--muted-foreground) hover:text-(--foreground) hover:bg-(--card-hover)"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Results */}
          {error ? (
            <div className="text-center py-12">
              <p className="text-(--error) mb-4">{error}</p>
              <button
                onClick={() => fetchModels(false)}
                className="px-4 py-2 bg-(--card) border border-(--border) rounded-lg text-(--foreground) hover:bg-(--card-hover) transition-colors"
              >
                Retry
              </button>
            </div>
          ) : loading && models.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-(--muted-foreground)">
              <RefreshCw className="h-5 w-5 animate-spin" />
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="text-center py-12 text-(--muted-foreground)">
              <p>No models found</p>
              <p className="text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              <div className="text-xs text-(--muted-foreground) mb-3">
                {filteredModels.length} {filteredModels.length === 1 ? "model" : "models"}
                {providerFilter && ` from ${providerFilter}`}
              </div>
              <div className="border border-(--border) rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-(--card) border-b border-(--border)">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-(--muted-foreground) uppercase tracking-wider">
                        Model
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-(--muted-foreground) uppercase tracking-wider">
                        Provider
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-(--muted-foreground) uppercase tracking-wider">
                        Task
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-(--muted-foreground) uppercase tracking-wider">
                        Quantization
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-(--muted-foreground) uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-(--muted-foreground) uppercase tracking-wider">
                        Stats
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-(--muted-foreground) uppercase tracking-wider w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-(--border)">
                    {filteredModels.map((model) => {
                      const provider = extractProvider(model.modelId);
                      const quantizations = extractQuantizations(model.tags);
                      const isLocal = isModelLocal(model.modelId);

                      return (
                        <tr key={model._id} className="hover:bg-(--card)/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="text-sm font-medium text-(--foreground) truncate max-w-xs"
                                title={model.modelId}
                              >
                                {model.modelId}
                              </div>
                              <button
                                onClick={() => copyModelId(model.modelId)}
                                className="p-1 hover:bg-(--card-hover) rounded transition-colors shrink-0"
                                title="Copy model ID"
                              >
                                {copiedId === model.modelId ? (
                                  <Check className="h-3 w-3 text-(--success)" />
                                ) : (
                                  <Copy className="h-3 w-3 text-(--muted-foreground)" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-(--card) border border-(--border) rounded text-xs text-(--foreground)">
                              {provider}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {model.pipeline_tag ? (
                              <span className="px-2 py-1 bg-(--card) border border-(--border) rounded text-xs text-(--muted-foreground)">
                                {model.pipeline_tag}
                              </span>
                            ) : (
                              <span className="text-xs text-(--muted-foreground)">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {quantizations.length > 0 ? (
                                quantizations.map((quant) => (
                                  <span
                                    key={quant}
                                    className="px-2 py-1 bg-(--warning)/20 text-(--warning) border border-(--warning)/30 rounded text-xs font-medium"
                                  >
                                    {quant}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-(--muted-foreground)">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {isLocal ? (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-(--success)/20 text-(--success) border border-(--success)/30">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Local
                              </span>
                            ) : (
                              <span className="text-xs text-(--muted-foreground)">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-4 text-xs text-(--muted-foreground)">
                              <div className="flex items-center gap-1" title="Downloads">
                                <Download className="h-3.5 w-3.5" />
                                <span>{formatNumber(model.downloads)}</span>
                              </div>
                              <div className="flex items-center gap-1" title="Likes">
                                <Heart className="h-3.5 w-3.5" />
                                <span>{formatNumber(model.likes)}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <a
                              href={`https://huggingface.co/${model.modelId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 hover:bg-(--card-hover) rounded transition-colors inline-block text-(--link) hover:text-(--link-hover)"
                              title="View on Hugging Face"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="mt-6 text-center">
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="px-4 py-2 bg-(--card) border border-(--border) rounded-lg text-sm text-(--foreground) hover:bg-(--card-hover) transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading...
                      </span>
                    ) : (
                      "Load More"
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
