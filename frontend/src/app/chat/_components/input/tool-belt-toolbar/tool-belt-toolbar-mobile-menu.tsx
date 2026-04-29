// CRITICAL
"use client";

import { useEffect, useState, type ComponentType } from "react";
import {
  Paperclip,
  Image as ImageIcon,
  Globe,
  Code,
  Brain,
  SlidersHorizontal,
  Clock,
  Loader2,
  Volume2,
  VolumeX,
  Plus,
  PanelRightOpen,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
} from "lucide-react";
import { ToolDropdown, DropdownItem } from "@/ui/dropdown-menu";
import type { ToolBeltToolbarDesktopRecording } from "./tool-belt-toolbar-desktop";

function SpinningLoaderIcon({ className }: { className?: string }) {
  return <Loader2 className={`${className ?? ""} animate-spin`} />;
}

type Props = {
  isLoading?: boolean;
  streamingStartTime?: number | null;
  lastRunDurationSeconds?: number | null;
  recording: ToolBeltToolbarDesktopRecording;
  attachmentsCount: number;
  disabled?: boolean;
  hasSystemPrompt?: boolean;
  toolsEnabled?: boolean;
  artifactsEnabled?: boolean;
  deepResearchEnabled?: boolean;
  isTTSEnabled?: boolean;
  onOpenResults?: () => void;
  onOpenChatSettings?: () => void;
  onToolsToggle?: () => void;
  onArtifactsToggle?: () => void;
  onDeepResearchToggle?: () => void;
  onTTSToggle?: () => void;
  onAttachFile?: () => void;
  onAttachImage?: () => void;
  callModeEnabled?: boolean;
  onCallModeToggle?: () => void;
};

export function ToolBeltToolbarMobileMenu({
  isLoading,
  streamingStartTime,
  lastRunDurationSeconds,
  recording,
  attachmentsCount,
  disabled,
  hasSystemPrompt,
  toolsEnabled,
  artifactsEnabled,
  deepResearchEnabled,
  isTTSEnabled,
  onOpenResults,
  onOpenChatSettings,
  onToolsToggle,
  onArtifactsToggle,
  onDeepResearchToggle,
  onTTSToggle,
  onAttachFile,
  onAttachImage,
  callModeEnabled,
  onCallModeToggle,
}: Props) {
  const { isRecording, isTranscribing, onStart: onStartRecording, onStop: onStopRecording } = recording;
  const hasActiveTools = Boolean(toolsEnabled || artifactsEnabled || deepResearchEnabled);
  const hasMobileMenuActive = Boolean(
    attachmentsCount > 0 ||
      hasActiveTools ||
      hasSystemPrompt ||
      isRecording ||
      isTranscribing ||
      isTTSEnabled ||
      callModeEnabled,
  );

  const showAttachmentSection = Boolean(onAttachFile || onAttachImage);
  const showVoiceSection = Boolean(onStartRecording || onStopRecording || onTTSToggle);
  const showToolsSection = Boolean(
    onToolsToggle || onArtifactsToggle || onDeepResearchToggle,
  );
  const showSettingsSection = Boolean(onOpenChatSettings);

  const voiceLabel = isTranscribing ? "Transcribing..." : isRecording ? "Stop recording" : "Voice input";
  const VoiceIcon = isTranscribing ? Loader2 : isRecording ? MicOff : Mic;
  const onVoiceClick = isRecording ? onStopRecording : onStartRecording;
  const VoiceIconComponent: ComponentType<{ className?: string }> = isTranscribing
    ? SpinningLoaderIcon
    : VoiceIcon;

  // Self-ticking elapsed for the runtime chip
  const [selfElapsed, setSelfElapsed] = useState(0);
  useEffect(() => {
    if (isLoading && streamingStartTime != null) {
      setSelfElapsed(Math.floor((Date.now() - streamingStartTime) / 1000));
      const id = setInterval(() => {
        setSelfElapsed(Math.floor((Date.now() - streamingStartTime) / 1000));
      }, 1000);
      return () => clearInterval(id);
    }
    if (!isLoading) setSelfElapsed(0);
  }, [isLoading, streamingStartTime]);

  const hasRunTime = isLoading && streamingStartTime != null;
  const hasLastRun = typeof lastRunDurationSeconds === "number" && lastRunDurationSeconds > 0;
  const showRunChip = hasRunTime || hasLastRun;
  const runChipLabelSeconds = isLoading ? selfElapsed : (lastRunDurationSeconds ?? 0);
  const runChipLabel = `${Math.floor(runChipLabelSeconds / 60)}:${(runChipLabelSeconds % 60).toString().padStart(2, "0")}`;

  return (
    <ToolDropdown
      icon={Plus}
      label="More actions"
      isActive={hasMobileMenuActive}
      disabled={disabled}
      showChevron={false}
      buttonVariant="circle"
    >
      {showRunChip && (
        <>
          <DropdownItem icon={Clock} label={`Runtime: ${runChipLabel}`} disabled />
          <div className="h-px bg-(--border) my-1" />
        </>
      )}

      {onOpenResults && (
        <>
          <DropdownItem icon={PanelRightOpen} label="Results" onClick={onOpenResults} disabled={disabled} closeOnClick />
          <div className="h-px bg-(--border) my-1" />
        </>
      )}

      {showAttachmentSection && (
        <>
          {onAttachFile && (
            <DropdownItem icon={Paperclip} label="Attach file" onClick={onAttachFile} disabled={disabled} closeOnClick />
          )}
          {onAttachImage && (
            <DropdownItem icon={ImageIcon} label="Attach image" onClick={onAttachImage} disabled={disabled} closeOnClick />
          )}
          {(showVoiceSection || showToolsSection || showSettingsSection) && (
            <div className="h-px bg-(--border) my-1" />
          )}
        </>
      )}

      {showVoiceSection && (
        <>
          {(onStartRecording || onStopRecording) && (
            <DropdownItem
              icon={VoiceIconComponent}
              label={voiceLabel}
              isActive={isRecording || isTranscribing}
              onClick={onVoiceClick}
              disabled={disabled || isTranscribing}
              closeOnClick
            />
          )}
          {onTTSToggle && (
            <DropdownItem
              icon={isTTSEnabled ? Volume2 : VolumeX}
              label={isTTSEnabled ? "Disable TTS" : "Enable TTS"}
              isActive={isTTSEnabled}
              onClick={onTTSToggle}
              disabled={disabled}
              closeOnClick
            />
          )}
          {onCallModeToggle && (
            <DropdownItem
              icon={callModeEnabled ? PhoneOff : Phone}
              label={callModeEnabled ? "End call mode" : "Call mode (hands-free)"}
              isActive={callModeEnabled}
              onClick={onCallModeToggle}
              disabled={disabled || isTranscribing}
              closeOnClick
            />
          )}
          {(showToolsSection || showSettingsSection) && <div className="h-px bg-(--border) my-1" />}
        </>
      )}

      {showToolsSection && (
        <>
          {onToolsToggle && (
            <DropdownItem icon={Globe} label="Web search & tools" isActive={toolsEnabled} onClick={onToolsToggle} disabled={disabled} closeOnClick />
          )}
          {onArtifactsToggle && (
            <DropdownItem icon={Code} label="Code preview" isActive={artifactsEnabled} onClick={onArtifactsToggle} disabled={disabled} closeOnClick />
          )}
          {onDeepResearchToggle && (
            <DropdownItem icon={Brain} label="Deep Research" isActive={deepResearchEnabled} onClick={onDeepResearchToggle} disabled={disabled} closeOnClick />
          )}
          {showSettingsSection && <div className="h-px bg-(--border) my-1" />}
        </>
      )}

      {showSettingsSection && onOpenChatSettings && (
        <DropdownItem
          icon={SlidersHorizontal}
          label={hasSystemPrompt ? "System prompt (active)" : "System prompt"}
          isActive={hasSystemPrompt}
          onClick={onOpenChatSettings}
          disabled={disabled}
          closeOnClick
        />
      )}
    </ToolDropdown>
  );
}
