"use client";

import type { UIMessage } from "@ai-sdk/react";
import type { DeepResearchConfig, SessionUsage, MCPServer } from "@/lib/types";
import type { ModelOption } from "../../types";
import { ChatSettingsModal } from "../modals/chat-settings-modal";
import { MCPSettingsModal } from "../modals/mcp-settings-modal";
import { UsageModal } from "../modals/usage-modal";
import { ExportModal } from "../modals/export-modal";

interface ChatModalsProps {
  settingsOpen: boolean;
  onCloseSettings: () => void;
  mcpSettingsOpen: boolean;
  onCloseMcpSettings: () => void;
  usageOpen: boolean;
  onCloseUsage: () => void;
  exportOpen: boolean;
  onCloseExport: () => void;
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
  selectedModel: string;
  onSelectedModelChange: (model: string) => void;
  availableModels: ModelOption[];
  deepResearch: DeepResearchConfig;
  onDeepResearchChange: (config: DeepResearchConfig) => void;
  mcpServers: MCPServer[];
  onServersChange: (servers: MCPServer[]) => void;
  onRefreshServers: () => void;
  sessionUsage: SessionUsage | null;
  messages: UIMessage[];
  onExportJson: () => void;
  onExportMarkdown: () => void;
}

export function ChatModals({
  settingsOpen,
  onCloseSettings,
  mcpSettingsOpen,
  onCloseMcpSettings,
  usageOpen,
  onCloseUsage,
  exportOpen,
  onCloseExport,
  systemPrompt,
  onSystemPromptChange,
  selectedModel,
  onSelectedModelChange,
  availableModels,
  deepResearch,
  onDeepResearchChange,
  mcpServers,
  onServersChange,
  onRefreshServers,
  sessionUsage,
  messages,
  onExportJson,
  onExportMarkdown,
}: ChatModalsProps) {
  return (
    <>
      <ChatSettingsModal
        isOpen={settingsOpen}
        onClose={onCloseSettings}
        systemPrompt={systemPrompt}
        onSystemPromptChange={onSystemPromptChange}
        selectedModel={selectedModel}
        onSelectedModelChange={onSelectedModelChange}
        availableModels={availableModels}
        deepResearch={deepResearch}
        onDeepResearchChange={onDeepResearchChange}
      />

      <MCPSettingsModal
        isOpen={mcpSettingsOpen}
        onClose={onCloseMcpSettings}
        servers={mcpServers}
        onServersChange={onServersChange}
        onRefresh={onRefreshServers}
      />

      <UsageModal
        isOpen={usageOpen}
        onClose={onCloseUsage}
        sessionUsage={sessionUsage}
        messages={messages}
        selectedModel={selectedModel}
      />

      <ExportModal
        isOpen={exportOpen}
        onClose={onCloseExport}
        onExportJson={onExportJson}
        onExportMarkdown={onExportMarkdown}
      />
    </>
  );
}
