"use client";

import { ConfigsView } from "./_components/ConfigsView";
import { useConfigs } from "./hooks/useConfigs";

export default function ConfigsPage() {
  const {
    data,
    loading,
    error,
    apiSettings,
    apiSettingsLoading,
    showApiKey,
    saving,
    testing,
    connectionStatus,
    statusMessage,
    setApiSettings,
    setShowApiKey,
    loadConfig,
    saveApiSettings,
    testConnection,
    hasConfigData,
    isInitialLoading,
  } = useConfigs();

  return (
    <ConfigsView
      data={data}
      loading={loading}
      error={error}
      apiSettings={apiSettings}
      apiSettingsLoading={apiSettingsLoading}
      showApiKey={showApiKey}
      saving={saving}
      testing={testing}
      connectionStatus={connectionStatus}
      statusMessage={statusMessage}
      hasConfigData={hasConfigData}
      isInitialLoading={isInitialLoading}
      onReload={loadConfig}
      onApiSettingsChange={setApiSettings}
      onToggleApiKey={() => setShowApiKey(!showApiKey)}
      onTestConnection={testConnection}
      onSaveSettings={saveApiSettings}
    />
  );
}
