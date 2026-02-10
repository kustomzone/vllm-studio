// CRITICAL
"use client";

import { memo, useCallback, useEffect, useRef, type ChangeEvent, type KeyboardEvent } from "react";
import type { ComponentProps, ReactNode } from "react";
import { AttachmentsPreview } from "./attachments-preview";
import { RecordingIndicator } from "./recording-indicator";
import { TranscriptionStatus } from "./transcription-status";
import { ToolBeltToolbar } from "./tool-belt-toolbar";
import type { Attachment, ModelOption } from "../../types";
import { useAppStore } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { encodeChunksToWav } from "@/lib/audio/wav";

function maybeRevokeObjectUrl(url: string | undefined) {
  if (!url) return;
  if (!url.startsWith("blob:")) return;
  URL.revokeObjectURL(url);
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<string> {
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
}

interface ToolBeltProps {
  onSubmit: (value: string, attachments?: Attachment[]) => void;
  disabled?: boolean;
  isLoading?: boolean;
  thinkingSnippet?: string;
  placeholder?: string;
  onStop?: () => void;
  onOpenResults?: () => void;
  selectedModel?: string;
  availableModels?: ModelOption[];
  onModelChange?: (modelId: string) => void;
  mcpEnabled?: boolean;
  onMcpToggle?: () => void;
  artifactsEnabled?: boolean;
  onArtifactsToggle?: () => void;
  onOpenMcpSettings?: () => void;
  onOpenChatSettings?: () => void;
  hasSystemPrompt?: boolean;
  deepResearchEnabled?: boolean;
  onDeepResearchToggle?: () => void;
  planDrawer?: ReactNode;
  voiceCallControlsRef?: React.MutableRefObject<{
    startRecording: () => Promise<void>;
    stopRecording: () => void;
  } | null>;
}

const ToolBeltToolbarContainer = memo(function ToolBeltToolbarContainer(
  props: Omit<ComponentProps<typeof ToolBeltToolbar>, "elapsedSeconds" | "lastRunDurationSeconds">,
) {
  const elapsedSeconds = useAppStore((state) => state.elapsedSeconds);
  const lastRunDurationSeconds = useAppStore((state) => state.lastRunDurationSeconds);
  return (
    <ToolBeltToolbar
      {...props}
      elapsedSeconds={elapsedSeconds}
      lastRunDurationSeconds={lastRunDurationSeconds}
    />
  );
});

export function ToolBelt({
  onSubmit,
  isLoading,
  thinkingSnippet,
  placeholder = "Message...",
  onStop,
  onOpenResults,
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
  planDrawer,
  voiceCallControlsRef,
}: ToolBeltProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const isDisabled = false;
  const {
    value,
    setInput,
    queuedContext,
    setQueuedContext,
    attachments,
    setAttachments,
    updateAttachments,
    isRecording,
    setIsRecording,
    isTranscribing,
    setIsTranscribing,
    transcriptionError,
    setTranscriptionError,
    recordingDuration,
    setRecordingDuration,
    callModeEnabled,
    setCallModeEnabled,
  } = useAppStore(
    useShallow((state) => ({
      value: state.input,
      setInput: state.setInput,
      queuedContext: state.queuedContext,
      setQueuedContext: state.setQueuedContext,
      attachments: state.attachments,
      setAttachments: state.setAttachments,
      updateAttachments: state.updateAttachments,
      isRecording: state.isRecording,
      setIsRecording: state.setIsRecording,
      isTranscribing: state.isTranscribing,
      setIsTranscribing: state.setIsTranscribing,
      transcriptionError: state.transcriptionError,
      setTranscriptionError: state.setTranscriptionError,
      recordingDuration: state.recordingDuration,
      setRecordingDuration: state.setRecordingDuration,
      callModeEnabled: state.callModeEnabled,
      setCallModeEnabled: state.setCallModeEnabled,
    })),
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartAtRef = useRef<number | null>(null);
  const transcribeAbortRef = useRef<AbortController | null>(null);
  const baseHeightRef = useRef<number>(44);
  const lastShouldCapRef = useRef<boolean | null>(null);

  const audioRecorderRef = useRef<{
    stream: MediaStream | null;
    audioContext: AudioContext | null;
    source: MediaStreamAudioSourceNode | null;
    processor: ScriptProcessorNode | null;
    zeroGain: GainNode | null;
    chunks: Float32Array[];
    sampleRate: number;
  }>({
    stream: null,
    audioContext: null,
    source: null,
    processor: null,
    zeroGain: null,
    chunks: [],
    sampleRate: 48000,
  });

  // Keep the transcript from disappearing under the fixed mobile composer by exposing its height as a CSS var.
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const update = () => {
      const height = Math.ceil(node.getBoundingClientRect().height);
      if (height > 0) {
        document.documentElement.style.setProperty("--chat-composer-height", `${height}px`);
      }
    };
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(node);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const shouldCap = window.innerWidth >= 768;

      // `getComputedStyle` can be surprisingly expensive; only re-read when the breakpoint flips.
      if (lastShouldCapRef.current !== shouldCap) {
        lastShouldCapRef.current = shouldCap;
        const minHeight = Number.parseFloat(window.getComputedStyle(textareaRef.current).minHeight);
        baseHeightRef.current =
          Number.isFinite(minHeight) && minHeight > 0 ? minHeight : shouldCap ? 44 : 52;
      }

      const baseHeight = baseHeightRef.current;
      const newHeight = shouldCap
        ? Math.min(Math.max(scrollHeight, baseHeight), 200)
        : Math.max(scrollHeight, baseHeight);
      textareaRef.current.style.height = newHeight + "px";
      textareaRef.current.style.overflowY =
        shouldCap && scrollHeight > 200 ? "auto" : "hidden";
    }
  }, [value, isLoading, queuedContext]);

  const addAttachmentsFromInput = useCallback(
    async (e: ChangeEvent<HTMLInputElement>, type: "file" | "image" | "video") => {
      const files = Array.from(e.target.files || []);
      const newAttachments: Attachment[] = [];

      for (const file of files) {
        const isImage = type === "image";
        const isVideo = type === "video";
        const attachment: Attachment = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: isImage ? "image" : isVideo ? "video" : "file",
          name: file.name,
          size: file.size,
          url: isImage || isVideo ? URL.createObjectURL(file) : undefined,
          file,
        };

        if (isImage) {
          try {
            attachment.base64 = await fileToBase64(file);
          } catch (err) {
            console.error("Failed to convert image to base64:", err);
          }
        }

        newAttachments.push(attachment);
      }

      updateAttachments((prev) => [...prev, ...newAttachments]);
      e.target.value = "";
    },
    [updateAttachments],
  );

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      void addAttachmentsFromInput(e, "file");
    },
    [addAttachmentsFromInput],
  );

  const handleImageInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      void addAttachmentsFromInput(e, "image");
    },
    [addAttachmentsFromInput],
  );

  const handleVideoInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      void addAttachmentsFromInput(e, "video");
    },
    [addAttachmentsFromInput],
  );

  const removeAttachment = useCallback(
    (id: string) => {
      updateAttachments((prev) => {
        const attachment = prev.find((a) => a.id === id);
        maybeRevokeObjectUrl(attachment?.url);
        return prev.filter((a) => a.id !== id);
      });
    },
    [updateAttachments],
  );

  const transcribeAudio = useCallback(async (audioBlob: Blob, fileName: string): Promise<string | null> => {
    try {
      setIsTranscribing(true);
      setTranscriptionError(null);

      transcribeAbortRef.current?.abort();
      const abortController = new AbortController();
      transcribeAbortRef.current = abortController;

      const formData = new FormData();
      formData.append("file", audioBlob, fileName);

      const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
        signal: abortController.signal,
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
      if (err instanceof DOMException && err.name === "AbortError") return null;
      const errorMessage = err instanceof Error ? err.message : "Transcription failed";
      console.error("Transcription error:", err);
      setTranscriptionError(errorMessage);
      setTimeout(() => setTranscriptionError(null), 5000);
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, [setIsTranscribing, setTranscriptionError]);

  const teardownAudioRecorder = useCallback(async () => {
    const rec = audioRecorderRef.current;
    try {
      rec.processor?.disconnect();
    } catch {
      // ignore
    }
    try {
      rec.source?.disconnect();
    } catch {
      // ignore
    }
    try {
      rec.zeroGain?.disconnect();
    } catch {
      // ignore
    }
    if (rec.stream) {
      try {
        rec.stream.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
    }
    if (rec.audioContext) {
      try {
        await rec.audioContext.close();
      } catch {
        // ignore
      }
    }
    rec.stream = null;
    rec.audioContext = null;
    rec.source = null;
    rec.processor = null;
    rec.zeroGain = null;
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    try {
      if (useAppStore.getState().isRecording) return;

      // E2E escape hatch: allow Playwright to exercise the voice flow without a real mic device.
      const useFakeMic =
        (process.env.NEXT_PUBLIC_VLLM_STUDIO_E2E_FAKE_MIC ?? "").trim() === "1" ||
        // Playwright/WebDriver environment: avoid mic permission/device flakiness.
        (typeof navigator !== "undefined" && (navigator as unknown as { webdriver?: boolean }).webdriver === true);
      if (useFakeMic) {
        const sampleRate = 16000;
        const seconds = 1.2;
        const total = Math.floor(sampleRate * seconds);
        const samples = new Float32Array(total);
        for (let i = 0; i < total; i++) {
          // Quiet sine tone; STT is mocked in E2E anyway, but this keeps the pipeline realistic.
          samples[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.08;
        }
        const rec = audioRecorderRef.current;
        rec.chunks = [samples];
        rec.sampleRate = sampleRate;

        setIsRecording(true);
        setRecordingDuration(0);
        recordingStartAtRef.current = Date.now();
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = setInterval(() => {
          const startAt = recordingStartAtRef.current;
          if (!startAt) return;
          setRecordingDuration(Math.max(0, Math.floor((Date.now() - startAt) / 1000)));
        }, 250);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const zeroGain = audioContext.createGain();
      zeroGain.gain.value = 0;

      const rec = audioRecorderRef.current;
      rec.stream = stream;
      rec.audioContext = audioContext;
      rec.source = source;
      rec.processor = processor;
      rec.zeroGain = zeroGain;
      rec.chunks = [];
      rec.sampleRate = audioContext.sampleRate;

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        rec.chunks.push(new Float32Array(input));
      };

      source.connect(processor);
      processor.connect(zeroGain);
      zeroGain.connect(audioContext.destination);

      setIsRecording(true);
      setRecordingDuration(0);
      recordingStartAtRef.current = Date.now();

      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = setInterval(() => {
        const startAt = recordingStartAtRef.current;
        if (!startAt) return;
        setRecordingDuration(Math.max(0, Math.floor((Date.now() - startAt) / 1000)));
      }, 250);
    } catch (err) {
      console.error("Failed to start recording:", err);
      setTranscriptionError("Microphone permission denied or unavailable.");
      setTimeout(() => setTranscriptionError(null), 5000);
      setIsRecording(false);
    }
  }, [setIsRecording, setRecordingDuration, setTranscriptionError]);

  const stopRecording = useCallback(() => {
    if (!useAppStore.getState().isRecording) return;
    setIsRecording(false);
    recordingStartAtRef.current = null;
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    const rec = audioRecorderRef.current;
    const chunks = rec.chunks;
    const sampleRate = rec.sampleRate;
    rec.chunks = [];

    void (async () => {
      await teardownAudioRecorder();
      if (!chunks.length) return;

      const { wavBytes } = encodeChunksToWav({
        chunks,
        inputSampleRate: sampleRate,
        targetSampleRate: 16000,
      });
      const audioBlob = new Blob([wavBytes], { type: "audio/wav" });
      const transcript = await transcribeAudio(audioBlob, "recording.wav");
      if (!transcript) return;

      if (useAppStore.getState().callModeEnabled) {
        const text = transcript.trim();
        if (!text) return;
        const currentAttachments = useAppStore.getState().attachments;
        onSubmit(text, currentAttachments.length > 0 ? [...currentAttachments] : undefined);
        for (const attachment of currentAttachments) maybeRevokeObjectUrl(attachment.url);
        setAttachments([]);
        setInput("");
        return;
      }

      const currentInput = useAppStore.getState().input;
      setInput(currentInput ? `${currentInput} ${transcript}` : transcript);
      textareaRef.current?.focus();
    })();
  }, [onSubmit, setAttachments, setInput, setIsRecording, teardownAudioRecorder, transcribeAudio]);

  const handleToggleCallMode = useCallback(() => {
    const current = useAppStore.getState().callModeEnabled;
    const next = !current;
    setCallModeEnabled(next);
    if (next) {
      void startRecording();
      return;
    }
    transcribeAbortRef.current?.abort();
    stopRecording();
  }, [setCallModeEnabled, startRecording, stopRecording]);

  const handleAttachFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleAttachImage = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleAttachVideo = useCallback(() => {
    videoInputRef.current?.click();
  }, []);

  const handleDismissTranscriptionError = useCallback(() => {
    setTranscriptionError(null);
  }, [setTranscriptionError]);

  const handleTextChange = useCallback(
    (nextValue: string) => {
      if (isLoading) setQueuedContext(nextValue);
      else setInput(nextValue);
    },
    [isLoading, setInput, setQueuedContext],
  );

  const handleSubmit = useCallback(() => {
    if (isLoading) return;
    const state = useAppStore.getState();
    const inputValue = state.input;
    const currentAttachments = state.attachments;
    if (!inputValue.trim() && currentAttachments.length === 0) return;

    onSubmit(inputValue, currentAttachments.length > 0 ? [...currentAttachments] : undefined);

    for (const attachment of currentAttachments) {
      maybeRevokeObjectUrl(attachment.url);
    }
    setAttachments([]);
  }, [isLoading, onSubmit, setAttachments]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const canSend = value.trim() || attachments.length > 0;

  useEffect(() => {
    if (!voiceCallControlsRef) return;
    voiceCallControlsRef.current = { startRecording, stopRecording };
    return () => {
      if (voiceCallControlsRef.current?.startRecording === startRecording) {
        voiceCallControlsRef.current = null;
      }
    };
  }, [startRecording, stopRecording, voiceCallControlsRef]);

  return (
    <div ref={rootRef} className="px-2 md:px-3 pb-0">
      <div className="w-full max-w-none md:max-w-4xl md:mx-auto px-0 md:px-0">
        <AttachmentsPreview
          attachments={attachments}
          onRemove={removeAttachment}
          formatFileSize={formatFileSize}
        />

        {isRecording && (
          <RecordingIndicator
            duration={recordingDuration}
            onStop={stopRecording}
            formatDuration={formatDuration}
          />
        )}

        <TranscriptionStatus
          isTranscribing={isTranscribing}
          error={transcriptionError}
          onDismissError={handleDismissTranscriptionError}
        />

        <div
          className={`relative flex flex-col bg-[#1a1a1a] rounded-3xl border border-white/[0.08] ${
            isLoading ? "ring-1 ring-blue-500/30" : ""
          }`}
          style={{
            boxShadow: "0 0 0 1px rgba(255,255,255,0.03), 0 8px 40px rgba(0,0,0,0.35)",
          }}
        >
          <div className="hidden md:block">{planDrawer}</div>
          <textarea
            ref={textareaRef}
            value={isLoading ? queuedContext : value}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isDisabled
                ? "No model running"
                : isLoading
                  ? "Type here to queue for next message..."
                  : placeholder
            }
            disabled={isDisabled}
            rows={1}
            className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-transparent text-[15px] md:text-sm resize-none focus:outline-none disabled:opacity-50 placeholder:text-[#9a9590] overflow-y-hidden min-h-[44px] md:min-h-[44px]"
            style={{ fontSize: "16px", lineHeight: "1.5" }}
          />

          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileInputChange}
            className="hidden"
            multiple
            accept=".txt,.pdf,.doc,.docx,.md,.json,.csv"
          />
          <input
            ref={imageInputRef}
            type="file"
            onChange={handleImageInputChange}
            className="hidden"
            multiple
            accept="image/*"
          />
          <input
            ref={videoInputRef}
            type="file"
            onChange={handleVideoInputChange}
            className="hidden"
            multiple
            accept="video/*"
          />

          <ToolBeltToolbarContainer
            isLoading={isLoading}
            thinkingSnippet={thinkingSnippet}
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            attachmentsCount={attachments.length}
            disabled={isDisabled}
            canSend={canSend as boolean}
            hasSystemPrompt={hasSystemPrompt}
            mcpEnabled={mcpEnabled}
            artifactsEnabled={artifactsEnabled}
            deepResearchEnabled={deepResearchEnabled}
            callModeEnabled={callModeEnabled}
            onOpenResults={onOpenResults}
            availableModels={availableModels}
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            onOpenChatSettings={onOpenChatSettings}
            onOpenMcpSettings={onOpenMcpSettings}
            onMcpToggle={onMcpToggle}
            onArtifactsToggle={onArtifactsToggle}
            onDeepResearchToggle={onDeepResearchToggle}
            onAttachFile={handleAttachFile}
            onAttachImage={handleAttachImage}
            onAttachVideo={handleAttachVideo}
            onToggleCallMode={handleToggleCallMode}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onStop={onStop}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
}
