// CRITICAL
"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { getApiKey, setApiKey, clearApiKey } from "@/lib/api-key";
import { resolveSettingsDefaultBackendUrl } from "@/lib/backend-config";
import { getStoredBackendUrl, setStoredBackendUrl, clearStoredBackendUrl } from "@/lib/backend-url";
import type { CompatibilityReport, ConfigData } from "@/lib/types";

export interface ApiConnectionSettings {
  backendUrl: string;
  apiKey: string;
  hasApiKey: boolean;
  voiceUrl: string;
  voiceModel: string;
  daytonaApiUrl: string;
  daytonaApiKey: string;
  hasDaytonaApiKey: boolean;
  daytonaProxyUrl: string;
  daytonaSandboxId: string;
  daytonaAgentMode: boolean;
  agentFsLocalFallback: boolean;
}

export type ConnectionStatus = "unknown" | "connected" | "error";

const DEFAULT_BACKEND_URL = resolveSettingsDefaultBackendUrl();

const DEFAULT_API_SETTINGS: ApiConnectionSettings = {
  backendUrl: DEFAULT_BACKEND_URL,
  apiKey: "",
  hasApiKey: false,
  voiceUrl: "",
  voiceModel: "whisper-large-v3-turbo",
  daytonaApiUrl: "",
  daytonaApiKey: "",
  hasDaytonaApiKey: false,
  daytonaProxyUrl: "",
  daytonaSandboxId: "",
  daytonaAgentMode: true,
  agentFsLocalFallback: false,
};

const mergeApiSettings = (
  server?: Partial<ApiConnectionSettings>,
  current?: ApiConnectionSettings,
): ApiConnectionSettings => {
  const localBackendUrl = getStoredBackendUrl();
  const localApiKey = getApiKey();

  return {
    backendUrl: localBackendUrl || server?.backendUrl || DEFAULT_API_SETTINGS.backendUrl,
    apiKey: localApiKey || server?.apiKey || "",
    hasApiKey: Boolean(localApiKey) || Boolean(server?.hasApiKey),
    voiceUrl: server?.voiceUrl || DEFAULT_API_SETTINGS.voiceUrl,
    voiceModel: server?.voiceModel || DEFAULT_API_SETTINGS.voiceModel,
    daytonaApiUrl:
      server?.daytonaApiUrl ?? current?.daytonaApiUrl ?? DEFAULT_API_SETTINGS.daytonaApiUrl,
    daytonaApiKey:
      server?.daytonaApiKey ?? current?.daytonaApiKey ?? DEFAULT_API_SETTINGS.daytonaApiKey,
    hasDaytonaApiKey:
      server?.hasDaytonaApiKey ??
      current?.hasDaytonaApiKey ??
      DEFAULT_API_SETTINGS.hasDaytonaApiKey,
    daytonaProxyUrl:
      server?.daytonaProxyUrl ?? current?.daytonaProxyUrl ?? DEFAULT_API_SETTINGS.daytonaProxyUrl,
    daytonaSandboxId:
      server?.daytonaSandboxId ??
      current?.daytonaSandboxId ??
      DEFAULT_API_SETTINGS.daytonaSandboxId,
    daytonaAgentMode:
      server?.daytonaAgentMode ??
      current?.daytonaAgentMode ??
      DEFAULT_API_SETTINGS.daytonaAgentMode,
    agentFsLocalFallback:
      server?.agentFsLocalFallback ??
      current?.agentFsLocalFallback ??
      DEFAULT_API_SETTINGS.agentFsLocalFallback,
  };
};

export function useConfigs() {
  const [data, setData] = useState<ConfigData | null>(null);
  const [compatibilityReport, setCompatibilityReport] = useState<CompatibilityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const [apiSettings, setApiSettings] = useState<ApiConnectionSettings>(DEFAULT_API_SETTINGS);
  const [apiSettingsLoading, setApiSettingsLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showDaytonaApiKey, setShowDaytonaApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("unknown");
  const [statusMessage, setStatusMessage] = useState<string>("");

  const loadApiSettings = async () => {
    try {
      setApiSettingsLoading(true);
      const res = await fetch("/api/settings");
      if (res.ok) {
        const settings = (await res.json()) as Partial<ApiConnectionSettings>;
        setApiSettings((previous) => mergeApiSettings(settings, previous));
        return;
      }
    } catch (e) {
      console.error("Failed to load API settings:", e);
    } finally {
      setApiSettingsLoading(false);
    }
    setApiSettings((previous) => mergeApiSettings(undefined, previous));
  };

  const loadStudioSettings = async () => {
    try {
      const settings = await api.getStudioSettings();
      setApiSettings((previous) =>
        mergeApiSettings(
          {
            daytonaApiUrl: settings.effective.daytona_api_url ?? "",
            hasDaytonaApiKey: settings.effective.daytona_api_key_configured,
            daytonaProxyUrl: settings.effective.daytona_proxy_url ?? "",
            daytonaSandboxId: settings.effective.daytona_sandbox_id ?? "",
            daytonaAgentMode: settings.effective.daytona_agent_mode,
            agentFsLocalFallback:
              settings.effective.agent_fs_local_fallback ??
              previous.agentFsLocalFallback ??
              DEFAULT_API_SETTINGS.agentFsLocalFallback,
          },
          previous,
        ),
      );
    } catch (e) {
      console.error("Failed to load studio settings:", e);
    }
  };

  const persistLocalApiSettings = () => {
    const backendUrl = apiSettings.backendUrl?.trim() || "";
    if (backendUrl) {
      setStoredBackendUrl(backendUrl);
    } else {
      clearStoredBackendUrl();
    }
    const apiKey = apiSettings.apiKey?.trim() || "";
    if (apiKey && !apiKey.includes("••••")) {
      setApiKey(apiKey);
    } else if (!apiKey) {
      clearApiKey();
    }
  };

  const testConnection = async () => {
    try {
      setTesting(true);
      setConnectionStatus("unknown");
      setStatusMessage("Testing...");

      const baseUrl = apiSettings.backendUrl?.trim() || "";
      if (!baseUrl) {
        setConnectionStatus("error");
        setStatusMessage("Missing API URL");
        return;
      }
      const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/health`);
      if (res.ok) {
        setConnectionStatus("connected");
        setStatusMessage("Connected");
      } else {
        setConnectionStatus("error");
        setStatusMessage(`Error: ${res.status}`);
      }
    } catch {
      setConnectionStatus("error");
      setStatusMessage("Connection failed");
    } finally {
      setTesting(false);
    }
  };

  const checkBackendHealth = async () => {
    try {
      const health = await api.getHealth();
      setBackendOnline(health.status === "ok");
      return health.status === "ok";
    } catch {
      setBackendOnline(false);
      return false;
    }
  };

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const [configData, compatibility] = await Promise.all([
        api.getSystemConfig(),
        api.getCompatibility().catch(() => null),
      ]);
      setData(configData);
      setCompatibilityReport(compatibility);
      setBackendOnline(true);
      if (typeof window !== "undefined" && !localStorage.getItem("vllm-studio-setup-complete")) {
        localStorage.setItem("vllm-studio-setup-complete", "true");
      }
    } catch (e) {
      setError((e as Error).message);
      await checkBackendHealth();
    } finally {
      setLoading(false);
    }
  };

  const saveApiSettings = async () => {
    const backendUrl = apiSettings.backendUrl?.trim() || "";
    persistLocalApiSettings();

    let savedRemotely = false;
    let savedDaytonaRemotely = false;
    try {
      setSaving(true);
      setStatusMessage("");
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backendUrl: apiSettings.backendUrl,
          apiKey: apiSettings.apiKey,
          voiceUrl: apiSettings.voiceUrl,
          voiceModel: apiSettings.voiceModel,
        }),
      });
      if (res.ok) {
        const updated = (await res.json()) as Partial<ApiConnectionSettings>;
        setApiSettings((previous) => mergeApiSettings(updated, previous));
        savedRemotely = true;
      } else {
        const err = await res.json().catch(() => ({}));
        setStatusMessage(err.error || "Saved locally");
      }
    } catch {
      setStatusMessage("Saved locally");
    } finally {
      setSaving(false);
    }

    if (backendUrl) {
      const daytonaApiKeyInput = apiSettings.daytonaApiKey.trim();
      const daytonaApiKeyPayload =
        daytonaApiKeyInput.length > 0
          ? daytonaApiKeyInput
          : apiSettings.hasDaytonaApiKey
            ? undefined
            : null;

      try {
        const updated = await api.updateStudioSettings({
          daytona_api_url: apiSettings.daytonaApiUrl.trim() || null,
          ...(daytonaApiKeyPayload !== undefined ? { daytona_api_key: daytonaApiKeyPayload } : {}),
          daytona_proxy_url: apiSettings.daytonaProxyUrl.trim() || null,
          daytona_sandbox_id: apiSettings.daytonaSandboxId.trim() || null,
          daytona_agent_mode: apiSettings.daytonaAgentMode,
          agent_fs_local_fallback: apiSettings.agentFsLocalFallback,
        });

        setApiSettings((previous) =>
          mergeApiSettings(
            {
              daytonaApiUrl: updated.effective.daytona_api_url ?? "",
              daytonaApiKey: "",
              hasDaytonaApiKey: updated.effective.daytona_api_key_configured,
              daytonaProxyUrl: updated.effective.daytona_proxy_url ?? "",
              daytonaSandboxId: updated.effective.daytona_sandbox_id ?? "",
              daytonaAgentMode: updated.effective.daytona_agent_mode,
              agentFsLocalFallback:
                updated.effective.agent_fs_local_fallback ??
                previous.agentFsLocalFallback ??
                DEFAULT_API_SETTINGS.agentFsLocalFallback,
            },
            previous,
          ),
        );
        savedDaytonaRemotely = true;
      } catch (error) {
        const daytonaMessage =
          error instanceof Error ? error.message : "Failed to save Daytona settings";
        setStatusMessage(daytonaMessage);
      }
    }

    if (savedRemotely && (savedDaytonaRemotely || !backendUrl)) {
      setStatusMessage("Settings saved");
    } else if (savedRemotely && backendUrl) {
      setStatusMessage("Saved API settings, Daytona settings failed");
    }

    // Always attempt to refresh config when a backend URL is present.
    if (backendUrl) {
      loadConfig();
    }

    // Avoid showing a hard error when only the server-side save failed.
    if (!savedRemotely) {
      setConnectionStatus("unknown");
    }
  };

  useEffect(() => {
    loadConfig();
    loadApiSettings();
    loadStudioSettings();
  }, []);

  return {
    data,
    compatibilityReport,
    loading,
    error,
    apiSettings,
    apiSettingsLoading,
    showApiKey,
    showDaytonaApiKey,
    saving,
    testing,
    connectionStatus,
    statusMessage,
    setApiSettings,
    setShowApiKey,
    setShowDaytonaApiKey,
    loadConfig,
    saveApiSettings,
    testConnection,
    hasConfigData: Boolean(data),
    isInitialLoading: loading && !data,
    backendOnline,
  };
}
