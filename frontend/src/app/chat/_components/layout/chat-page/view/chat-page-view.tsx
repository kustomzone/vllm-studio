// CRITICAL
"use client";

import { memo, useCallback, useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store";
import { UnifiedSidebar } from "../../sidebar/unified-sidebar";
import { ChatConversation } from "../../page/chat-conversation";
import { ChatTopControls } from "../../page/chat-top-controls";
import { ChatActionButtons } from "../../page/chat-action-buttons";
import { ChatToolbeltDock } from "../../sidebar/chat-toolbelt-dock";
import { ChatModals } from "../../page/chat-modals";
import { MobileResultsDrawer } from "../../sidebar/mobile-results-drawer";
import { MobileChatHistoryDrawer } from "../../sidebar/mobile-chat-history-drawer";
import { ChatHistoryDock } from "../../sidebar/chat-side-panel";
import { ArtifactModal } from "../../../artifacts/artifact-modal";
import { buildSidebarContentsFromPageProps } from "./chat-page-view/sidebar-contents-from-page-props";
import type { ChatPageViewProps } from "./chat-page-view/types";

export const ChatPageView = memo(function ChatPageView(props: ChatPageViewProps) {
  const {
    sidebarOpen,
    setSidebarOpen,
    setSettingsOpen,
    setUsageOpen,
    setExportOpen,
    onNewChatSession,
    openActivityPanel,
    openContextPanel,
    onOpenComputerPanel,
  } = props;

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen(!sidebarOpen);
  }, [setSidebarOpen, sidebarOpen]);

  const handleOpenSidebarMobile = useCallback(() => {
    window.dispatchEvent(new CustomEvent("vllm:toggle-sidebar", { detail: { open: true } }));
  }, []);

  const openSettings = useCallback(() => setSettingsOpen(true), [setSettingsOpen]);
  const closeSettings = useCallback(() => setSettingsOpen(false), [setSettingsOpen]);

  const openUsage = useCallback(() => setUsageOpen(true), [setUsageOpen]);
  const closeUsage = useCallback(() => setUsageOpen(false), [setUsageOpen]);

  const openExport = useCallback(() => setExportOpen(true), [setExportOpen]);
  const closeExport = useCallback(() => setExportOpen(false), [setExportOpen]);

  const [chatHistoryMobileOpen, setChatHistoryMobileOpen] = useState(false);

  const closeChatHistoryMobile = useCallback(() => {
    setChatHistoryMobileOpen(false);
  }, []);

  const handleOpenChatHistoryMobile = useCallback(() => {
    setChatHistoryMobileOpen(true);
    setSidebarOpen(false);
  }, [setSidebarOpen]);

  const openActivityPanelMobile = useCallback(() => {
    setChatHistoryMobileOpen(false);
    openActivityPanel();
  }, [openActivityPanel]);

  const openContextPanelMobile = useCallback(() => {
    setChatHistoryMobileOpen(false);
    openContextPanel();
  }, [openContextPanel]);

  const openComputerPanelMobile = useCallback(() => {
    setChatHistoryMobileOpen(false);
    onOpenComputerPanel();
  }, [onOpenComputerPanel]);

  const handleNewChatMobile = useCallback(() => {
    onNewChatSession();
    setChatHistoryMobileOpen(false);
  }, [onNewChatSession]);

  const mobileSidebarContents = buildSidebarContentsFromPageProps("mobile", props);
  const desktopSidebarContents = buildSidebarContentsFromPageProps("desktop", props);

  const { chatLeftRailCollapsed, setChatLeftRailCollapsed } = useAppStore(
    useShallow((s) => ({
      chatLeftRailCollapsed: s.chatLeftRailCollapsed,
      setChatLeftRailCollapsed: s.setChatLeftRailCollapsed,
    })),
  );

  return (
    <div className="relative flex h-full w-full max-w-full overflow-hidden bg-background">
      {chatLeftRailCollapsed ? (
        <div className="hidden md:flex h-full w-11 shrink-0 flex-col items-center border-r border-(--border)/40 bg-(--bg) py-2">
          <button
            type="button"
            onClick={() => setChatLeftRailCollapsed(false)}
            className="rounded-lg p-2 text-(--dim) transition-colors hover:bg-(--fg)/[0.06] hover:text-(--fg)"
            title="Show chats"
          >
            <span className="sr-only">Show chats</span>
            <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden />
          </button>
        </div>
      ) : (
        <aside className="hidden h-full w-[min(288px,32vw)] max-w-[320px] shrink-0 flex-col border-r border-(--border)/40 bg-(--bg) md:flex">
          <ChatHistoryDock
            onRefreshChatSessions={props.onRefreshChatSessions}
            onActivateChatSession={props.onActivateChatSession}
            onNewChatSession={props.onNewChatSession}
            onDeleteChatSession={props.onDeleteChatSession}
            onRenameChatSession={props.onRenameChatSession}
            onCollapseRail={() => setChatLeftRailCollapsed(true)}
          />
        </aside>
      )}

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <MobileChatHistoryDrawer
          isOpen={chatHistoryMobileOpen}
          onClose={closeChatHistoryMobile}
          onSelectSession={props.onActivateChatSession}
          onRefreshChatSessions={props.onRefreshChatSessions}
          onNewChatSession={handleNewChatMobile}
          onDeleteChatSession={props.onDeleteChatSession}
          onRenameChatSession={props.onRenameChatSession}
        />

        <MobileResultsDrawer
          isOpen={props.sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeTab={props.sidebarTab}
          onSetActiveTab={props.setSidebarTab}
          hasArtifacts={props.sessionArtifacts.length > 0}
          panelContentMap={mobileSidebarContents}
        />

        <UnifiedSidebar
          isOpen={props.sidebarOpen}
          onToggle={handleToggleSidebar}
          activeTab={props.sidebarTab}
          onSetActiveTab={props.setSidebarTab}
          hasArtifacts={props.sessionArtifacts.length > 0}
          panelContentMap={desktopSidebarContents}
          width={props.sidebarWidth}
          onWidthChange={props.setSidebarWidth}
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
              <ChatConversation
                messages={props.messages}
                isLoading={props.isLoading}
                streamError={props.streamError}
                onDismissStreamError={props.onDismissStreamError}
                agentMode={props.agentMode}
                executingToolsSize={props.executingToolsSize}
                onOpenComputerPanel={openComputerPanelMobile}
                artifactsEnabled={props.artifactsEnabled}
                artifactsByMessage={props.artifactsByMessage}
                selectedModel={props.selectedModel}
                contextUsageLabel={props.contextUsageLabel}
                agentFiles={props.agentFiles}
                onOpenAgentFile={props.onOpenAgentFile}
                currentSessionId={props.currentSessionId}
                agentFilesBrowsePath={props.agentFilesBrowsePath}
                onFork={props.onForkMessage}
                onReprompt={props.onReprompt}
                onListen={props.onListenMessage}
                listeningMessageId={props.listeningMessageId}
                listeningPending={props.listeningPending}
                onOpenContext={openContextPanelMobile}
                runStatusLine={props.runStatusLine}
                showEmptyState={props.showEmptyState}
                toolBelt={props.toolBelt}
                onScroll={props.handleScroll}
                messagesContainerRef={props.messagesContainerRef}
                messagesEndRef={props.messagesEndRef}
              />

              <ChatTopControls
                onOpenSidebar={handleOpenSidebarMobile}
                onOpenSettings={openSettings}
                onOpenChats={handleOpenChatHistoryMobile}
              />

              <ChatActionButtons
                activityCount={props.activityCount}
                hasActiveThinking={props.thinkingActive}
                onOpenActivity={openActivityPanelMobile}
                onOpenContext={openContextPanelMobile}
                onOpenSettings={openSettings}
                onOpenUsage={openUsage}
                onOpenExport={openExport}
              />

              <ChatToolbeltDock toolBelt={props.toolBelt} showEmptyState={props.showEmptyState} />
            </div>
          </div>
        </UnifiedSidebar>

        <ChatModals
          settingsOpen={props.settingsOpen}
          onCloseSettings={closeSettings}
          usageOpen={props.usageOpen}
          onCloseUsage={closeUsage}
          exportOpen={props.exportOpen}
          onCloseExport={closeExport}
          systemPrompt={props.systemPrompt}
          onSystemPromptChange={props.setSystemPrompt}
          selectedModel={props.selectedModel}
          onSelectedModelChange={props.setSelectedModel}
          availableModels={props.availableModels}
          customChatModels={props.customChatModels}
          onAddCustomChatModel={props.onAddCustomChatModel}
          onRemoveCustomChatModel={props.onRemoveCustomChatModel}
          deepResearch={props.deepResearch}
          onDeepResearchChange={props.setDeepResearch}
          sessionUsage={props.sessionUsage}
          messages={props.messages}
          onExportJson={props.onExportJson}
          onExportMarkdown={props.onExportMarkdown}
        />

        <ArtifactModal artifact={props.activeArtifact} onClose={props.onCloseArtifactModal} />
      </div>
    </div>
  );
});
