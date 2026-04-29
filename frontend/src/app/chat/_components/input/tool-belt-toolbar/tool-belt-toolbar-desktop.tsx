// CRITICAL
"use client";

import {
  Paperclip,
  Image as ImageIcon,
  Mic,
  MicOff,
  Square,
  Globe,
  Code,
  Brain,
  SlidersHorizontal,
  Loader2,
  Plus,
  ArrowUp,
  Volume2,
  VolumeX,
  Phone,
  PhoneOff,
} from "lucide-react";
import { ToolDropdown, DropdownItem } from "@/ui/dropdown-menu";
import { ElapsedTimer } from "./elapsed-timer";
import { ContextWindowMeter } from "./context-window-meter";
import { ModelSelect } from "./model-select";
import type { ModelOption } from "../../../types";
import type { ContextStats } from "@/lib/services/context-management";

export interface ToolBeltToolbarDesktopRecording {
  isRecording: boolean;
  isTranscribing: boolean;
  onStart?: () => void;
  onStop?: () => void;
}

type Props = {
  isLoading?: boolean;
  streamingStartTime?: number | null;
  recording: ToolBeltToolbarDesktopRecording;
  attachmentsCount: number;
  disabled?: boolean;
  canSend: boolean;
  hasSystemPrompt?: boolean;
  toolsEnabled?: boolean;
  artifactsEnabled?: boolean;
  deepResearchEnabled?: boolean;
  isTTSEnabled?: boolean;
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
  contextStats?: Omit<ContextStats, "compactionHistory" | "lastCompaction" | "totalCompactions" | "totalTokensCompacted"> | null;
  onOpenContext?: () => void;
};

export function ToolBeltToolbarDesktop({
  isLoading,
  streamingStartTime,
  recording,
  attachmentsCount,
  disabled,
  canSend,
  hasSystemPrompt,
  toolsEnabled,
  artifactsEnabled,
  deepResearchEnabled,
  isTTSEnabled,
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
  contextStats,
  onOpenContext,
}: Props) {
  const { isRecording, isTranscribing, onStart, onStop: onStopRecording } = recording;

  const hasDropDownActive = Boolean(
    toolsEnabled ||
      deepResearchEnabled ||
      artifactsEnabled ||
      isTTSEnabled ||
      callModeEnabled ||
      hasSystemPrompt ||
      attachmentsCount > 0,
  );

  return (
    <div className="hidden md:flex items-center justify-between gap-2 px-1.5 pb-1.5">
      <div className="flex items-center gap-0.5 min-w-0">
        {isLoading && <ElapsedTimer startedAt={streamingStartTime ?? null} />}

        <ToolDropdown
          icon={Plus}
          label=""
          isActive={hasDropDownActive}
          disabled={disabled}
        >
          <DropdownItem icon={Paperclip} label="Attach file" onClick={onAttachFile} disabled={disabled} closeOnClick />
          <DropdownItem icon={ImageIcon} label="Attach image" onClick={onAttachImage} disabled={disabled} closeOnClick />

          <div className="my-1 mx-2 h-px bg-(--border)" />

          {onToolsToggle && (
            <DropdownItem
              icon={Globe}
              label="Web search & tools"
              isActive={toolsEnabled}
              onClick={onToolsToggle}
              disabled={disabled}
            />
          )}
          {onDeepResearchToggle && (
            <DropdownItem
              icon={Brain}
              label="Deep research"
              isActive={deepResearchEnabled}
              onClick={onDeepResearchToggle}
              disabled={disabled}
            />
          )}
          {onArtifactsToggle && (
            <DropdownItem
              icon={Code}
              label="Code preview"
              isActive={artifactsEnabled}
              onClick={onArtifactsToggle}
              disabled={disabled}
            />
          )}

          {(onOpenChatSettings || onTTSToggle || onCallModeToggle) && (
            <div className="my-1 mx-2 h-px bg-(--border)" />
          )}

          {onOpenChatSettings && (
            <DropdownItem
              icon={SlidersHorizontal}
              label={hasSystemPrompt ? "System prompt (active)" : "System prompt"}
              isActive={hasSystemPrompt}
              onClick={onOpenChatSettings}
              disabled={disabled}
            />
          )}
          {onTTSToggle && (
            <DropdownItem
              icon={isTTSEnabled ? Volume2 : VolumeX}
              label={isTTSEnabled ? "TTS enabled" : "Text-to-speech"}
              isActive={isTTSEnabled}
              onClick={onTTSToggle}
              disabled={disabled}
            />
          )}
          {onCallModeToggle && (
            <DropdownItem
              icon={callModeEnabled ? PhoneOff : Phone}
              label={callModeEnabled ? "End call mode" : "Call mode"}
              isActive={callModeEnabled}
              onClick={onCallModeToggle}
              disabled={disabled || isTranscribing}
            />
          )}
        </ToolDropdown>

        <button
          onClick={isRecording ? onStopRecording : onStart}
          disabled={disabled || isTranscribing}
          className={`flex items-center justify-center h-7 w-7 rounded-md transition-colors disabled:opacity-50 ${
            isRecording
              ? "bg-(--err)/15 text-(--err)"
              : isTranscribing
                ? "bg-(--hl1)/15 text-(--hl1)"
                : "hover:bg-(--fg)/5 text-(--dim)"
          }`}
          title={isTranscribing ? "Transcribing..." : isRecording ? "Stop recording" : "Voice input"}
        >
          {isTranscribing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isRecording ? (
            <MicOff className="h-3.5 w-3.5" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <ModelSelect
          availableModels={availableModels}
          selectedModel={selectedModel}
          onChange={onModelChange}
          disabled={disabled || isLoading}
        />

        <ContextWindowMeter stats={contextStats} onClick={onOpenContext} />

        {isLoading ? (
          <button
            onClick={onStop}
            className="h-7 w-7 flex items-center justify-center rounded-full bg-(--err)/15 text-(--err) hover:bg-(--err)/25 transition-colors shrink-0"
            title="Stop"
          >
            <Square className="h-3 w-3 fill-current" />
          </button>
        ) : (
          <button
            onClick={onSubmit}
            disabled={!canSend}
            className={`h-7 w-7 flex items-center justify-center rounded-full transition-colors shrink-0 ${
              canSend
                ? "bg-(--fg) text-(--bg) hover:bg-(--fg)/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg)"
                : "bg-(--fg)/10 text-(--dim)/40 cursor-not-allowed"
            }`}
            title="Send"
          >
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
