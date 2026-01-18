"use client";

import { useCallback } from "react";
import { api } from "@/lib/api";

interface UseChatModelOptions {
  selectedModel: string;
  setRunningModel: (model: string | null) => void;
  setModelName: (name: string) => void;
  setSelectedModel: (model: string) => void;
  setAvailableModels: (
    models: Array<{ id: string; root?: string; max_model_len?: number }>,
  ) => void;
  setPageLoading: (loading: boolean) => void;
}

export function useChatModel({
  selectedModel,
  setRunningModel,
  setModelName,
  setSelectedModel,
  setAvailableModels,
  setPageLoading,
}: UseChatModelOptions) {
  const loadAvailableModels = useCallback(async () => {
    try {
      const res = await api.getOpenAIModels();
      setAvailableModels(
        (res.data || []).map((model) => ({
          id: model.id,
          root: model.root,
          max_model_len: model.max_model_len,
        })),
      );
    } catch {
      setAvailableModels([]);
    }
  }, [setAvailableModels]);

  const loadStatus = useCallback(async () => {
    try {
      const status = await api.getStatus();
      if (status.process) {
        const modelId = status.process.served_model_name || status.process.model_path || "default";
        setRunningModel(modelId);
        setModelName(status.process.model_path?.split("/").pop() || "Model");
        setSelectedModel(selectedModel || modelId);
      }
    } catch {
    } finally {
      setPageLoading(false);
    }
  }, [selectedModel, setModelName, setPageLoading, setRunningModel, setSelectedModel]);

  return {
    loadAvailableModels,
    loadStatus,
  };
}
