"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  Paperclip,
  Image as ImageIcon,
  Mic,
  MicOff,
  X,
  FileText,
  ArrowUp,
  Square,
  Globe,
  Code,
  Brain,
  Settings,
  SlidersHorizontal,
  Clock,
  Loader2,
  ChevronDown,
  Wrench,
} from "lucide-react";

export interface Attachment {
  id: string;
  type: "file" | "image" | "audio";
  name: string;
  size: number;
  url?: string;
  file?: File;
  base64?: string;
}

export interface MCPServer {
  name: string;
  enabled: boolean;
  icon?: string;
}

export interface ModelOption {
  id: string;
  name?: string;
}

interface ToolBeltProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (attachments?: Attachment[]) => void;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  onStop?: () => void;
  // Model selection
  selectedModel?: string;
  availableModels?: ModelOption[];
  onModelChange?: (modelId: string) => void;
  // MCP & Artifacts toggles
  mcpEnabled?: boolean;
  onMcpToggle?: () => void;
  artifactsEnabled?: boolean;
  onArtifactsToggle?: () => void;
  onOpenMcpSettings?: () => void;
  // Chat settings
  onOpenChatSettings?: () => void;
  hasSystemPrompt?: boolean;
  // Deep Research
  deepResearchEnabled?: boolean;
  onDeepResearchToggle?: () => void;
  // Timer for streaming duration
  elapsedSeconds?: number;
  // Queued context - additional input while streaming
  queuedContext?: string;
  onQueuedContextChange?: (value: string) => void;
}

// Dropdown component for grouping icons
function ToolDropdown({
  icon: Icon,
  label,
  isActive,
  disabled,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all disabled:opacity-50 ${
          isActive
            ? "bg-(--card-hover) text-[#e8e4dd] border border-(--border)/50"
            : "hover:bg-(--accent) text-[#9a9590]"
        }`}
        title={label}
      >
        <Icon className="h-4 w-4" />
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 min-w-[160px] bg-(--card) border border-(--border) rounded-lg shadow-lg py-1 z-50">
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  icon: Icon,
  label,
  isActive,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors disabled:opacity-50 ${
        isActive ? "bg-(--accent) text-[#e8e4dd]" : "hover:bg-(--accent) text-[#9a9590]"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-(--success)" />}
    </button>
  );
}

export function ToolBelt({
  value,
  onChange,
  onSubmit,
  disabled,
  isLoading,
  placeholder = "Message...",
  onStop,
  selectedModel,
  availableModels = [],
  onModelChange,
  mcpEnabled = false,
  onMcpToggle,
  artifactsEnabled = false,
  onArtifactsToggle,
  onOpenMcpSettings,
  onOpenChatSettings,
  hasSystemPrompt = false,
  deepResearchEnabled = false,
  onDeepResearchToggle,
  elapsedSeconds = 0,
  queuedContext = "",
  onQueuedContextChange,
}: ToolBeltProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(scrollHeight, 200);
      textareaRef.current.style.height = newHeight + "px";
      // Only show scrollbar when content exceeds max height
      textareaRef.current.style.overflowY = scrollHeight > 200 ? "auto" : "hidden";
    }
  }, [value]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "file" | "image",
  ) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: Attachment[] = [];

    for (const file of files) {
      const attachment: Attachment = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: type === "image" ? "image" : "file",
        name: file.name,
        size: file.size,
        url: type === "image" ? URL.createObjectURL(file) : undefined,
        file,
      };

      if (type === "image") {
        try {
          attachment.base64 = await fileToBase64(file);
        } catch (err) {
          console.error("Failed to convert image to base64:", err);
        }
      }

      newAttachments.push(attachment);
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const attachment = prev.find((a) => a.id === id);
      if (attachment?.url) {
        URL.revokeObjectURL(attachment.url);
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  const transcribeAudio = async (audioBlob: Blob): Promise<string | null> => {
    try {
      setIsTranscribing(true);
      setTranscriptionError(null);

      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");
      formData.append("model", "whisper-1");

      const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.details || errorData.error || `Transcription failed (${response.status})`,
        );
      }

      const data = await response.json();
      if (!data.text) {
        throw new Error("No transcription returned");
      }
      return data.text;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Transcription failed";
      console.error("Transcription error:", err);
      setTranscriptionError(errorMessage);
      setTimeout(() => setTranscriptionError(null), 5000);
      return null;
    } finally {
      setIsTranscribing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());

        const transcript = await transcribeAudio(audioBlob);
        if (transcript) {
          onChange(value ? `${value} ${transcript}` : transcript);
          textareaRef.current?.focus();
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = () => {
    if (isLoading) return;
    if ((!value.trim() && attachments.length === 0) || disabled) return;
    onSubmit(attachments.length > 0 ? [...attachments] : undefined);
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Check if any tools are active
  const hasActiveTools = mcpEnabled || artifactsEnabled || deepResearchEnabled;
  const canSend = (value.trim() || attachments.length > 0) && !disabled;

  return (
    <div className="px-3 md:px-3 pb-0 md:pb-0 bg-(--background)">
      <div className="w-full max-w-none md:max-w-4xl md:mx-auto px-0 md:px-0">
        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 px-3 md:px-0">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="relative group flex items-center gap-2 px-2.5 py-1.5 bg-(--accent) rounded-lg border border-(--border)"
              >
                {attachment.type === "image" ? (
                  <div className="flex items-center gap-2">
                    {attachment.url && (
                      <Image
                        src={attachment.url}
                        alt={attachment.name}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded object-cover"
                        unoptimized
                      />
                    )}
                    <div className="text-xs">
                      <p className="font-medium truncate max-w-[100px]">{attachment.name}</p>
                      <p className="text-[#9a9590]">{formatFileSize(attachment.size)}</p>
                    </div>
                  </div>
                ) : attachment.type === "audio" ? (
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-(--success)" />
                    <div className="text-xs">
                      <p className="font-medium">{attachment.name}</p>
                      <p className="text-[#9a9590]">{formatFileSize(attachment.size)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#9a9590]" />
                    <div className="text-xs">
                      <p className="font-medium truncate max-w-[100px]">{attachment.name}</p>
                      <p className="text-[#9a9590]">{formatFileSize(attachment.size)}</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="absolute -top-1 -right-1 p-0.5 rounded-full bg-(--error) text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Recording Indicator */}
        {isRecording && (
          <div className="flex items-center gap-2.5 mb-3 mx-3 md:mx-0 px-3 py-2 bg-(--error)/10 border border-(--error)/20 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-(--error) animate-pulse" />
            <span className="text-sm text-(--error)">Recording</span>
            <span className="text-sm font-mono text-[#9a9590]">
              {formatDuration(recordingDuration)}
            </span>
            <button
              onClick={stopRecording}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-(--error) text-white hover:opacity-90"
            >
              <Square className="h-3 w-3 fill-current" />
              Stop
            </button>
          </div>
        )}

        {/* Transcribing Indicator */}
        {isTranscribing && (
          <div className="flex items-center gap-2.5 mb-3 mx-3 md:mx-0 px-3 py-2 bg-(--link)/10 border border-(--link)/20 rounded-lg">
            <Loader2 className="h-4 w-4 text-(--link) animate-spin" />
            <span className="text-sm text-(--link)">Transcribing audio...</span>
          </div>
        )}

        {/* Transcription Error */}
        {transcriptionError && (
          <div className="flex items-center gap-2.5 mb-3 mx-3 md:mx-0 px-3 py-2 bg-(--error)/10 border border-(--error)/20 rounded-lg">
            <span className="text-sm text-(--error)">{transcriptionError}</span>
            <button
              onClick={() => setTranscriptionError(null)}
              className="ml-auto p-1 hover:bg-(--error)/20 rounded"
            >
              <X className="h-3.5 w-3.5 text-(--error)" />
            </button>
          </div>
        )}

        {/* Main Input Area */}
        <div
          className={`relative flex flex-col border rounded-2xl md:rounded-xl bg-(--card) shadow-sm ${isLoading ? "border-blue-500/30" : "border-(--border)"}`}
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
            className="w-full px-3 py-2 md:px-4 md:py-3 bg-transparent text-[15px] md:text-sm resize-none focus:outline-none disabled:opacity-50 placeholder:text-[#9a9590] overflow-y-hidden"
            style={{ height: "44px", maxHeight: "200px", fontSize: "16px", lineHeight: "1.5" }}
          />

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => handleFileSelect(e, "file")}
            className="hidden"
            multiple
            accept=".txt,.pdf,.doc,.docx,.md,.json,.csv"
          />
          <input
            ref={imageInputRef}
            type="file"
            onChange={(e) => handleFileSelect(e, "image")}
            className="hidden"
            multiple
            accept="image/*"
          />

          {/* Tool Bar - Compact with dropdowns */}
          <div className="flex items-center justify-between px-2 py-1.5 border-t border-(--border)">
            <div className="flex items-center gap-1">
              {/* Streaming Timer */}
              {isLoading && elapsedSeconds !== undefined && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Clock className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
                  <span className="text-xs font-mono text-blue-400">
                    {Math.floor(elapsedSeconds / 60)}:
                    {(elapsedSeconds % 60).toString().padStart(2, "0")}
                  </span>
                </div>
              )}

              {/* Media Dropdown (File, Image) */}
              <ToolDropdown
                icon={Paperclip}
                label="Attach media"
                isActive={attachments.length > 0}
                disabled={disabled}
              >
                <DropdownItem
                  icon={Paperclip}
                  label="Attach file"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                />
                <DropdownItem
                  icon={ImageIcon}
                  label="Attach image"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={disabled}
                />
              </ToolDropdown>

              {/* Mic - Direct button (no dropdown needed for single action) */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={disabled || isTranscribing}
                className={`flex items-center justify-center p-2 rounded-lg transition-all disabled:opacity-50 ${
                  isRecording
                    ? "bg-(--error)/20 text-(--error)"
                    : isTranscribing
                      ? "bg-(--link)/20 text-(--link)"
                      : "hover:bg-(--accent) text-[#9a9590]"
                }`}
                title={
                  isTranscribing
                    ? "Transcribing..."
                    : isRecording
                      ? "Stop recording"
                      : "Voice input"
                }
              >
                {isTranscribing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isRecording ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>

              {/* Tools Dropdown (MCP, Artifacts, Deep Research, MCP Settings) */}
              <ToolDropdown
                icon={Wrench}
                label="Tools"
                isActive={hasActiveTools}
                disabled={disabled}
              >
                <DropdownItem
                  icon={Globe}
                  label="Web search & tools"
                  isActive={mcpEnabled}
                  onClick={onMcpToggle}
                  disabled={disabled}
                />
                {onArtifactsToggle && (
                  <DropdownItem
                    icon={Code}
                    label="Code preview"
                    isActive={artifactsEnabled}
                    onClick={onArtifactsToggle}
                    disabled={disabled}
                  />
                )}
                {onDeepResearchToggle && (
                  <DropdownItem
                    icon={Brain}
                    label="Deep Research"
                    isActive={deepResearchEnabled}
                    onClick={onDeepResearchToggle}
                    disabled={disabled}
                  />
                )}
                {onOpenMcpSettings && (
                  <>
                    <div className="h-px bg-(--border) my-1" />
                    <DropdownItem
                      icon={Settings}
                      label="MCP servers"
                      onClick={onOpenMcpSettings}
                      disabled={disabled}
                    />
                  </>
                )}
              </ToolDropdown>

              {/* Config Dropdown (Model, System Prompt) */}
              <ToolDropdown
                icon={SlidersHorizontal}
                label="Configuration"
                isActive={hasSystemPrompt}
                disabled={disabled}
              >
                <DropdownItem
                  icon={SlidersHorizontal}
                  label={hasSystemPrompt ? "System prompt (active)" : "System prompt"}
                  isActive={hasSystemPrompt}
                  onClick={onOpenChatSettings}
                  disabled={disabled}
                />
                {availableModels.length > 0 && onModelChange && (
                  <>
                    <div className="h-px bg-(--border) my-1" />
                    <div className="px-3 py-2">
                      <label className="block text-xs text-[#9a9590] mb-1">Model</label>
                      <select
                        value={selectedModel || ""}
                        onChange={(e) => onModelChange(e.target.value)}
                        disabled={disabled || isLoading}
                        className="w-full px-2 py-1 text-xs bg-(--background) border border-(--border) rounded text-[#9a9590] focus:outline-none disabled:opacity-50"
                      >
                        {availableModels.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </ToolDropdown>
            </div>

            {/* Send/Stop button */}
            <div className="flex items-center">
              {isLoading ? (
                <button
                  onClick={onStop}
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-(--error) text-white hover:bg-(--error)/90 transition-colors"
                  title="Stop"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!canSend}
                  className={`h-8 w-8 flex items-center justify-center rounded-full transition-colors ${
                    canSend
                      ? "bg-[#e8e4dd] text-[#1a1918] hover:bg-[#d4d0c9]"
                      : "bg-(--accent) text-[#9a9590]/50 cursor-not-allowed"
                  }`}
                  title="Send"
                >
                  <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
