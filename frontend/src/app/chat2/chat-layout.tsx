// CRITICAL
"use client";

import { useState, useCallback } from "react";
import { useChatController } from "./hooks/use-chat-controller";
import { ChatSidebar } from "./chat-sidebar";
import { ChatConversation } from "./chat-conversation";
import { ChatWelcome } from "./chat-welcome";
import { ComputerView } from "./computer/computer-view";
import { FilesPanel } from "./files-panel";
import { ChatSettingsModal } from "./modals/chat-settings-modal";

type RightPanel = "computer" | "files";

export function ChatLayout() {
  const ctrl = useChatController();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanel>("computer");

  const toggleSidebar = useCallback(() => setSidebarOpen((p) => !p), []);

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Left sidebar — session list */}
      {sidebarOpen && (
        <ChatSidebar
          sessions={ctrl.sessions}
          currentSessionId={ctrl.currentSessionId}
          onSelect={ctrl.loadSession}
          onNew={ctrl.startNewSession}
          onDelete={ctrl.deleteSession}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      {/* Main chat pane — ACTIVITY */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top bar */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-(--border)/20 shrink-0 bg-(--bg)">
          <div className="flex items-center gap-3">
            <button onClick={toggleSidebar} className="p-1.5 rounded-md hover:bg-(--surface) transition-colors">
              <svg className="w-4 h-4 text-(--dim)" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <span className="text-sm font-medium text-(--fg) truncate max-w-[300px]">
              {ctrl.currentSessionTitle || "New Chat"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {ctrl.isLoading && (
              <span className="text-[10px] font-mono text-(--dim) uppercase tracking-wider">streaming</span>
            )}
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-1.5 rounded-md hover:bg-(--surface) transition-colors"
            >
              <svg className="w-4 h-4 text-(--dim)" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          </div>
        </div>

        {/* Conversation or welcome */}
        {ctrl.currentSessionId ? (
          <ChatConversation ctrl={ctrl} />
        ) : (
          <ChatWelcome onNewChat={ctrl.startNewSession} />
        )}
      </div>

      {/* Right pane — toggleable Computer / Files */}
      <div className="hidden md:flex w-[380px] shrink-0 flex-col min-h-0 bg-(--bg) border-l border-(--border)/20">
        {/* Panel tabs */}
        <div className="h-10 px-2 flex items-center gap-1 border-b border-(--border)/20 shrink-0">
          <PanelTab active={rightPanel === "computer"} onClick={() => setRightPanel("computer")}>
            Computer
          </PanelTab>
          <PanelTab active={rightPanel === "files"} onClick={() => setRightPanel("files")}>
            Files
          </PanelTab>
        </div>

        {/* Panel content — stable container, no layout shift */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {rightPanel === "computer" ? (
            <ComputerView
              currentToolCall={ctrl.currentToolCall}
              runToolCalls={ctrl.runToolCalls}
              isLoading={ctrl.isLoading}
            />
          ) : (
            <FilesPanel sessionId={ctrl.currentSessionId} />
          )}
        </div>
      </div>

      {/* Settings modal */}
      <ChatSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        systemPrompt={ctrl.systemPrompt}
        onSystemPromptChange={ctrl.setSystemPrompt}
        selectedModel={ctrl.selectedModel}
        onSelectedModelChange={ctrl.setSelectedModel}
        availableModels={ctrl.availableModels}
        customChatModels={ctrl.customChatModels}
        onAddCustomChatModel={ctrl.addCustomChatModel}
        onRemoveCustomChatModel={ctrl.removeCustomChatModel}
        deepResearch={ctrl.deepResearch}
        onDeepResearchChange={ctrl.setDeepResearch}
      />
    </div>
  );
}

function PanelTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
        active ? "bg-(--surface) text-(--fg)" : "text-(--dim) hover:text-(--fg)"
      }`}
    >
      {children}
    </button>
  );
}
