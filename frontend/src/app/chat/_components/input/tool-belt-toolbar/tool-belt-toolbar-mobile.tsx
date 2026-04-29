// CRITICAL
"use client";

import { ArrowUp, PanelRightOpen, Square } from "lucide-react";
import { ToolBeltToolbarMobileMenu } from "./tool-belt-toolbar-mobile-menu";
import { ModelSelect } from "./model-select";
import { type ToolBeltToolbarDesktopRecording } from "./tool-belt-toolbar-desktop";
import type { ModelOption } from "../../../types";

type Props = {
  isLoading?: boolean;
  streamingStartTime?: number | null;
  lastRunDurationSeconds?: number | null;
  recording: ToolBeltToolbarDesktopRecording;
  attachmentsCount: number;
  disabled?: boolean;
  canSend: boolean;
  hasSystemPrompt?: boolean;
  toolsEnabled?: boolean;
  artifactsEnabled?: boolean;
  deepResearchEnabled?: boolean;
  isTTSEnabled?: boolean;
  onOpenResults?: () => void;
  availableModels?: ModelOption[];
  selectedModel?: string;
  onModelChange?: (modelId: string) => void;
  onOpenChatSettings?: () => void;
  onToolsToggle?: () => void;
  onArtifactsToggle?: () => void;
  onDeepResearchToggle?: () => void;
  onTTSToggle?: () => void;
  onAttachFile?: () => void;
  onAttachImage?: () => void;
  onStop?: () => void;
  onSubmit?: () => void;
  callModeEnabled?: boolean;
  onCallModeToggle?: () => void;
};

export function ToolBeltToolbarMobile({
  isLoading,
  streamingStartTime,
  lastRunDurationSeconds,
  recording,
  attachmentsCount,
  disabled,
  canSend,
  hasSystemPrompt,
  toolsEnabled,
  artifactsEnabled,
  deepResearchEnabled,
  isTTSEnabled,
  onOpenResults,
  availableModels = [],
  selectedModel,
  onModelChange,
  onOpenChatSettings,
  onToolsToggle,
  onArtifactsToggle,
  onDeepResearchToggle,
  onTTSToggle,
  onAttachFile,
  onAttachImage,
  onStop,
  onSubmit,
  callModeEnabled,
  onCallModeToggle,
}: Props) {
  const activeSendButtonClass =
    "bg-white text-black border border-white hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg)";

  return (
    <div className="md:hidden flex items-center gap-2">
      <ToolBeltToolbarMobileMenu
        isLoading={isLoading}
        streamingStartTime={streamingStartTime}
        lastRunDurationSeconds={lastRunDurationSeconds}
        recording={recording}
        attachmentsCount={attachmentsCount}
        disabled={disabled}
        hasSystemPrompt={hasSystemPrompt}
        toolsEnabled={toolsEnabled}
        artifactsEnabled={artifactsEnabled}
        deepResearchEnabled={deepResearchEnabled}
        isTTSEnabled={isTTSEnabled}
        onOpenResults={onOpenResults}
        onOpenChatSettings={onOpenChatSettings}
        onToolsToggle={onToolsToggle}
        onArtifactsToggle={onArtifactsToggle}
        onDeepResearchToggle={onDeepResearchToggle}
        onTTSToggle={onTTSToggle}
        onAttachFile={onAttachFile}
        onAttachImage={onAttachImage}
        callModeEnabled={callModeEnabled}
        onCallModeToggle={onCallModeToggle}
      />

      {onOpenResults && (
        <button
          onClick={onOpenResults}
          disabled={disabled}
          className="h-10 w-10 flex items-center justify-center rounded-full border border-(--border) bg-(--border) text-(--dim) hover:bg-(--border) transition-colors disabled:opacity-50"
          title="Open results"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
      )}

      {availableModels.length > 0 && onModelChange && (
        <div className="flex-1 min-w-0">
          <ModelSelect
            availableModels={availableModels}
            selectedModel={selectedModel}
            onChange={onModelChange}
            disabled={disabled || isLoading}
            mobile
          />
        </div>
      )}

      {isLoading ? (
        <button
          onClick={onStop}
          className="h-10 w-10 flex items-center justify-center rounded-full bg-(--err) text-white transition-colors:ease-in:200ms shrink-0"
          title="Stop"
        >
          <Square className="h-4 w-4 fill-current" />
        </button>
      ) : (
        <button
          onClick={onSubmit}
          disabled={!canSend}
          className={`h-10 w-10 flex items-center justify-center rounded-full transition-colors:ease-in:200ms shrink-0 ${
            canSend
              ? activeSendButtonClass
              : "bg-(--border) border border-(--border) text-(--dim)/40 cursor-not-allowed"
          }`}
          title="Send"
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
