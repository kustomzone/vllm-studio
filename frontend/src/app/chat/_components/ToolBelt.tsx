"use client";

import { useRef, useEffect } from "react";
import type { KeyboardEvent } from "react";
import {
  Send,
  StopCircle,
  Globe,
  Code,
  Brain,
  Clock,
  SlidersHorizontal,
} from "lucide-react";

interface ToolBeltProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  mcpEnabled?: boolean;
  onMcpToggle?: () => void;
  artifactsEnabled?: boolean;
  onArtifactsToggle?: () => void;
  deepResearchEnabled?: boolean;
  onDeepResearchToggle?: () => void;
  elapsedSeconds?: number;
  queuedContext?: string;
  onQueuedContextChange?: (value: string) => void;
  onOpenSettings?: () => void;
  hasSystemPrompt?: boolean;
}

export function ToolBelt({
  value,
  onChange,
  onSubmit,
  onStop,
  disabled,
  isLoading,
  placeholder = "Message...",
  mcpEnabled = false,
  onMcpToggle,
  artifactsEnabled = false,
  onArtifactsToggle,
  deepResearchEnabled = false,
  onDeepResearchToggle,
  elapsedSeconds = 0,
  queuedContext = "",
  onQueuedContextChange,
  onOpenSettings,
  hasSystemPrompt = false,
}: ToolBeltProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [value]);

  const handleSubmit = () => {
    if (isLoading) return;
    if (!value.trim() || disabled) return;
    onSubmit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="px-0 md:px-3 pb-0 md:pb-0 bg-[var(--background)]">
      <div className="max-w-4xl mx-auto w-full px-2 md:px-0">
        <div
          className={`relative flex flex-col border rounded-2xl md:rounded-xl bg-[var(--card)] shadow-sm ${
            isLoading ? "border-blue-500/30" : "border-[var(--border)]"
          }`}
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={isLoading && onQueuedContextChange ? queuedContext : value}
            onChange={(e) =>
              isLoading && onQueuedContextChange
                ? onQueuedContextChange(e.target.value)
                : onChange(e.target.value)
            }
            onKeyDown={handleKeyDown}
            placeholder={
              disabled
                ? "No model running"
                : isLoading
                  ? "Type here to queue for next message..."
                  : placeholder
            }
            disabled={disabled}
            rows={1}
            className="w-full px-3 py-2 md:px-4 md:py-3 bg-transparent text-[15px] md:text-sm resize-none focus:outline-none disabled:opacity-50 placeholder:text-[#9a9590]"
            style={{ minHeight: "44px", maxHeight: "200px", fontSize: "16px", lineHeight: "1.4" }}
          />

          {/* Tool Bar */}
          <div className="flex items-center justify-between px-2 py-1 border-t border-[var(--border)]">
            <div className="flex items-center gap-0.5">
              {/* Streaming Timer */}
              {isLoading && elapsedSeconds !== undefined && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 mr-1">
                  <Clock className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
                  <span className="text-xs font-mono text-blue-400">
                    {Math.floor(elapsedSeconds / 60)}:
                    {(elapsedSeconds % 60).toString().padStart(2, "0")}
                  </span>
                </div>
              )}

              {/* Tools Toggle */}
              <button
                onClick={onMcpToggle}
                disabled={disabled}
                className={`flex items-center gap-2 px-2 py-1.5 md:px-2 md:py-1 rounded-lg transition-all disabled:opacity-50 ${
                  mcpEnabled
                    ? "bg-[var(--card-hover)] text-[#e8e4dd] border border-[var(--border)]/50"
                    : "hover:bg-[var(--accent)] text-[#9a9590]"
                }`}
                title={mcpEnabled ? "Disable tools" : "Enable tools"}
              >
                <Globe className="h-4 w-4" />
                <span className="text-xs hidden sm:inline">Tools</span>
              </button>

              {/* Preview Toggle */}
              <button
                onClick={onArtifactsToggle}
                disabled={disabled}
                className={`flex items-center gap-2 px-2 py-1.5 md:px-2 md:py-1 rounded-lg transition-all disabled:opacity-50 ${
                  artifactsEnabled
                    ? "bg-[var(--card-hover)] text-[#e8e4dd] border border-[var(--border)]/50"
                    : "hover:bg-[var(--accent)] text-[#9a9590]"
                }`}
                title={artifactsEnabled ? "Disable preview" : "Enable preview"}
              >
                <Code className="h-4 w-4" />
                <span className="text-xs hidden sm:inline">Preview</span>
              </button>

              {/* Research Toggle */}
              {onDeepResearchToggle && (
                <button
                  onClick={onDeepResearchToggle}
                  disabled={disabled}
                  className={`flex items-center gap-2 px-2 py-1.5 md:px-2 md:py-1 rounded-lg transition-all disabled:opacity-50 ${
                    deepResearchEnabled
                      ? "bg-[var(--card-hover)] text-[#e8e4dd] border border-[var(--border)]/50"
                      : "hover:bg-[var(--accent)] text-[#9a9590]"
                  }`}
                  title={deepResearchEnabled ? "Deep Research enabled" : "Enable Deep Research"}
                >
                  <Brain className="h-4 w-4" />
                  <span className="text-xs hidden sm:inline">Research</span>
                </button>
              )}

              {/* System Prompt */}
              <button
                onClick={onOpenSettings}
                disabled={disabled}
                className={`flex items-center gap-2 px-2 py-1.5 md:px-2 md:py-1 rounded-lg transition-all disabled:opacity-50 ${
                  hasSystemPrompt
                    ? "bg-[var(--card-hover)] text-[#e8e4dd] border border-[var(--border)]/50"
                    : "hover:bg-[var(--accent)] text-[#9a9590]"
                }`}
                title="Configure system prompt"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="text-xs hidden sm:inline">System</span>
              </button>
            </div>

            <div className="flex items-center">
              {isLoading ? (
                <button
                  onClick={onStop}
                  className="p-2 md:p-2 rounded-lg bg-[var(--error)] text-white hover:opacity-90 transition-all active:scale-95"
                  title="Stop"
                >
                  <StopCircle className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!value.trim() || disabled}
                  className="p-2 md:p-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-all active:scale-95 disabled:opacity-30 disabled:active:scale-100"
                  title="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
