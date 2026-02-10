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
import { decodeAudioBlobToMonoSamples } from "@/lib/audio/decode";

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

  const isE2eVoice = useCallback((): boolean => {
    // Allow deterministic E2E without relying on real mic devices or STT quality.
    if ((process.env.NEXT_PUBLIC_VLLM_STUDIO_E2E_FAKE_MIC ?? "").trim() === "1") return true;
    try {
      if (typeof localStorage !== "undefined") {
        if ((localStorage.getItem("vllm-studio-e2e-fake-mic") ?? "").trim() === "1") return true;
      }
    } catch {
      // ignore
    }
    // Playwright/WebDriver environment: avoid mic permission/device flakiness.
    if (typeof navigator !== "undefined" && (navigator as unknown as { webdriver?: boolean }).webdriver === true) {
      return true;
    }
    return false;
  }, []);

  const audioRecorderRef = useRef<{
    mode: "idle" | "fake" | "media";
    stream: MediaStream | null;
    mediaRecorder: MediaRecorder | null;
    mediaChunks: BlobPart[];
    mimeType: string | null;
    // Call-mode "hands free" recording: monitor mic volume to auto-stop on silence.
    audioCtx: AudioContext | null;
    analyser: AnalyserNode | null;
    monitorRaf: number | null;
    monitorBuffer: Uint8Array<ArrayBuffer> | null;
    monitorStartedAt: number | null;
    monitorLastLoudAt: number | null;
    monitorSawSpeech: boolean;
    fakeAutoStopTimer: number | null;
    // Fake recording state
    fakeChunks: Float32Array[];
    fakeSampleRate: number;
  }>({
    mode: "idle",
    stream: null,
    mediaRecorder: null,
    mediaChunks: [],
    mimeType: null,
    audioCtx: null,
    analyser: null,
    monitorRaf: null,
    monitorBuffer: null,
    monitorStartedAt: null,
    monitorLastLoudAt: null,
    monitorSawSpeech: false,
    fakeAutoStopTimer: null,
    fakeChunks: [],
    fakeSampleRate: 48000,
  });

  const lastVoiceSubmitRef = useRef<{ text: string; at: number } | null>(null);
  const recordingIdCounterRef = useRef<number>(0);
  const activeRecordingIdRef = useRef<number | null>(null);
  const stoppingRecordingIdRef = useRef<number | null>(null);

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
    let timeout: ReturnType<typeof setTimeout> | null = null;
    try {
      setIsTranscribing(true);
      setTranscriptionError(null);

      // E2E escape hatch: avoid depending on STT model quality for synthetic audio.
      if (isE2eVoice()) {
        await new Promise((r) => setTimeout(r, 120));
        return "Hello from voice call mode.";
      }

      transcribeAbortRef.current?.abort();
      const abortController = new AbortController();
      transcribeAbortRef.current = abortController;
      const timeoutMs = 45_000;
      timeout = setTimeout(() => {
        try {
          abortController.abort();
        } catch {
          // ignore
        }
      }, timeoutMs);

      const formData = new FormData();
      formData.append("file", audioBlob, fileName);
      // Call mode should feel like a phone call: prefer getting STT done on GPU
      // even if another service is currently holding the lease.
      if (useAppStore.getState().callModeEnabled) {
        formData.append("mode", "best_effort");
        formData.append("replace", "1");
      }

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
      if (timeout) clearTimeout(timeout);
      setIsTranscribing(false);
    }
  }, [isE2eVoice, setIsTranscribing, setTranscriptionError]);

  const teardownAudioRecorder = useCallback(async () => {
    const rec = audioRecorderRef.current;
    try {
      rec.mediaRecorder?.stop();
    } catch {
      // ignore
    }
    if (rec.monitorRaf != null) {
      try {
        cancelAnimationFrame(rec.monitorRaf);
      } catch {
        // ignore
      }
      rec.monitorRaf = null;
    }
    if (rec.fakeAutoStopTimer != null) {
      try {
        window.clearTimeout(rec.fakeAutoStopTimer);
      } catch {
        // ignore
      }
      rec.fakeAutoStopTimer = null;
    }
    if (rec.analyser) {
      try {
        rec.analyser.disconnect();
      } catch {
        // ignore
      }
    }
    if (rec.audioCtx) {
      try {
        await rec.audioCtx.close();
      } catch {
        // ignore
      }
    }
    if (rec.stream) {
      try {
        rec.stream.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
    }
    rec.mediaRecorder = null;
    rec.stream = null;
    rec.mediaChunks = [];
    rec.mimeType = null;
    rec.audioCtx = null;
    rec.analyser = null;
    rec.monitorBuffer = null;
    rec.monitorStartedAt = null;
    rec.monitorLastLoudAt = null;
    rec.monitorSawSpeech = false;
    rec.fakeChunks = [];
    rec.mode = "idle";
  }, []);

  const stopRecording = useCallback(() => {
    if (!useAppStore.getState().isRecording) return;
    const recordingId = activeRecordingIdRef.current;
    if (recordingId == null) return;
    if (stoppingRecordingIdRef.current === recordingId) return;
    stoppingRecordingIdRef.current = recordingId;
    activeRecordingIdRef.current = null;

    setIsRecording(false);
    recordingStartAtRef.current = null;
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    const rec = audioRecorderRef.current;
    if (rec.monitorRaf != null) {
      try {
        cancelAnimationFrame(rec.monitorRaf);
      } catch {
        // ignore
      }
      rec.monitorRaf = null;
    }
    if (rec.fakeAutoStopTimer != null) {
      try {
        window.clearTimeout(rec.fakeAutoStopTimer);
      } catch {
        // ignore
      }
      rec.fakeAutoStopTimer = null;
    }
    const consumeTranscript = (transcriptRaw: string) => {
      const transcript = transcriptRaw.trim();
      if (!transcript) return;
      const now = Date.now();
      const last = lastVoiceSubmitRef.current;
      if (last && last.text === transcript && now - last.at < 2500) {
        // Guard against accidental double-submits.
        return;
      }
      lastVoiceSubmitRef.current = { text: transcript, at: now };
      if (useAppStore.getState().callModeEnabled) {
        const currentAttachments = useAppStore.getState().attachments;
        onSubmit(transcript, currentAttachments.length > 0 ? [...currentAttachments] : undefined);
        for (const attachment of currentAttachments) maybeRevokeObjectUrl(attachment.url);
        setAttachments([]);
        setInput("");
        return;
      }
      // Non-call-mode voice input:
      // - If the user already typed something, append the transcript.
      // - If the composer is empty, treat voice as push-to-talk and send immediately (no extra click).
      const currentInput = useAppStore.getState().input;
      const trimmed = currentInput.trim();
      const currentAttachments = useAppStore.getState().attachments;
      if (!trimmed && currentAttachments.length === 0) {
        onSubmit(transcript);
        setInput("");
        return;
      }
      setInput(trimmed ? `${currentInput} ${transcript}` : transcript);
      textareaRef.current?.focus();
    };

    if (rec.mode === "fake") {
      const chunks = rec.fakeChunks;
      const sampleRate = rec.fakeSampleRate;
      rec.fakeChunks = [];
      void (async () => {
        await teardownAudioRecorder();
        if (!chunks.length) return;
        const { wavBytes } = encodeChunksToWav({
          chunks,
          inputSampleRate: sampleRate,
          targetSampleRate: 16000,
        });
        // Ensure this is backed by an ArrayBuffer (not a SharedArrayBuffer-like) for TS + Blob typing.
        const wavCopy = new Uint8Array(wavBytes);
        const audioBlob = new Blob([wavCopy], { type: "audio/wav" });
        const transcript = await transcribeAudio(audioBlob, "recording.wav");
        if (!transcript) return;
        consumeTranscript(transcript);
      })();
      return;
    }

    if (rec.mode === "media" && rec.mediaRecorder) {
      const mr = rec.mediaRecorder;
      const fileName = (rec.mimeType || "").includes("ogg") ? "recording.ogg" : "recording.webm";
      mr.onstop = () => {
        const parts = [...rec.mediaChunks];
        const mime = rec.mimeType || "audio/webm";
        // Reset before we begin async transcription so another recording can start cleanly.
        rec.mediaChunks = [];
        void (async () => {
          await teardownAudioRecorder();
          if (!parts.length) return;
          // Try to decode MediaRecorder output and re-encode to WAV client-side.
          // This avoids server-side ffmpeg transcoding and improves latency.
          const recordedBlob = new Blob(parts, { type: mime });
          let audioBlob: Blob = recordedBlob;
          let sendName = fileName;
          try {
            const decoded = await decodeAudioBlobToMonoSamples(recordedBlob);
            if (decoded) {
              const { wavBytes } = encodeChunksToWav({
                chunks: [decoded.samples],
                inputSampleRate: decoded.sampleRate,
                targetSampleRate: 16000,
              });
              const wavCopy = new Uint8Array(wavBytes);
              audioBlob = new Blob([wavCopy], { type: "audio/wav" });
              sendName = "recording.wav";
            }
          } catch {
            // ignore; fall back to original blob
          }

          const transcript = await transcribeAudio(audioBlob, sendName);
          if (!transcript) return;
          consumeTranscript(transcript);
        })();
      };
      try {
        mr.stop();
      } catch (err) {
        console.error("Failed to stop MediaRecorder:", err);
        void teardownAudioRecorder();
      }
      return;
    }

    void teardownAudioRecorder();
  }, [onSubmit, setAttachments, setInput, setIsRecording, teardownAudioRecorder, transcribeAudio]);

  const startRecording = useCallback(async (): Promise<void> => {
    try {
      if (useAppStore.getState().isRecording) return;
      const recordingId = (recordingIdCounterRef.current += 1);
      activeRecordingIdRef.current = recordingId;
      stoppingRecordingIdRef.current = null;

      // E2E escape hatch: allow Playwright to exercise the voice flow without a real mic device.
      const useFakeMic = isE2eVoice();
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
        rec.mode = "fake";
        rec.fakeChunks = [samples];
        rec.fakeSampleRate = sampleRate;
        rec.mediaChunks = [];
        rec.mimeType = "audio/wav";

        setIsRecording(true);
        setRecordingDuration(0);
        recordingStartAtRef.current = Date.now();
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = setInterval(() => {
          const startAt = recordingStartAtRef.current;
          if (!startAt) return;
          setRecordingDuration(Math.max(0, Math.floor((Date.now() - startAt) / 1000)));
        }, 250);

        // In call mode, behave hands-free even in E2E: auto-stop after a short delay.
        if (useAppStore.getState().callModeEnabled) {
          const rec = audioRecorderRef.current;
          rec.fakeAutoStopTimer = window.setTimeout(() => {
            if (!useAppStore.getState().callModeEnabled) return;
            stopRecording();
          }, 950);
        }
        return;
      }

      const rec = audioRecorderRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Prefer MediaRecorder for cross-browser compatibility and low memory usage.
      const pickMime = (): string | null => {
        if (typeof MediaRecorder === "undefined") return null;
        const candidates = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/ogg;codecs=opus",
          "audio/ogg",
        ];
        for (const c of candidates) {
          try {
            if (MediaRecorder.isTypeSupported(c)) return c;
          } catch {
            // ignore
          }
        }
        return null;
      };

      const mimeType = pickMime();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      rec.mode = "media";
      rec.stream = stream;
      rec.mediaRecorder = mr;
      rec.mediaChunks = [];
      rec.mimeType = mr.mimeType || mimeType;

      mr.ondataavailable = (evt) => {
        if (!evt.data) return;
        if (evt.data.size <= 0) return;
        rec.mediaChunks.push(evt.data);
      };

      // Start recording; request chunks periodically so stop() flushes reliably.
      mr.start(250);

      // Call mode: auto-stop on silence so the user doesn't have to click "Stop".
      // This keeps recordings short, which makes STT dramatically faster and avoids "transcribing forever".
      if (useAppStore.getState().callModeEnabled) {
        try {
          const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 2048;
          source.connect(analyser);
          // Some DOM lib typings require a non-SharedArrayBuffer-backed Uint8Array for analyser reads.
          const buf = new Uint8Array(new ArrayBuffer(analyser.fftSize));

          rec.audioCtx = audioCtx;
          rec.analyser = analyser;
          rec.monitorBuffer = buf;
          rec.monitorStartedAt = performance.now();
          rec.monitorLastLoudAt = null;
          rec.monitorSawSpeech = false;

          const LOUD_RMS = 0.018; // tune for typical laptop mics
          const SILENCE_MS = 900;
          const MIN_RECORD_MS = 650;
          const MAX_RECORD_MS = 22_000;

          const tick = () => {
            // Stop monitoring once the recording ends.
            if (!useAppStore.getState().isRecording) return;
            if (!useAppStore.getState().callModeEnabled) return;
            if (activeRecordingIdRef.current !== recordingId) return;
            const a = rec.analyser;
            const b = rec.monitorBuffer;
            const startedAt = rec.monitorStartedAt;
            if (!a || !b || startedAt == null) return;

            a.getByteTimeDomainData(b);
            let sumSq = 0;
            for (let i = 0; i < b.length; i++) {
              const v = (b[i]! - 128) / 128;
              sumSq += v * v;
            }
            const rms = Math.sqrt(sumSq / b.length);
            const now = performance.now();
            const elapsed = now - startedAt;

            if (rms > LOUD_RMS) {
              rec.monitorSawSpeech = true;
              rec.monitorLastLoudAt = now;
            }

            if (elapsed >= MAX_RECORD_MS) {
              stopRecording();
              return;
            }

            if (elapsed >= MIN_RECORD_MS && rec.monitorSawSpeech) {
              const lastLoud = rec.monitorLastLoudAt ?? startedAt;
              if (now - lastLoud >= SILENCE_MS) {
                stopRecording();
                return;
              }
            }

            rec.monitorRaf = requestAnimationFrame(tick);
          };

          rec.monitorRaf = requestAnimationFrame(tick);
        } catch {
          // If the browser blocks AudioContext until user gesture, call mode still works with manual stop.
        }
      }

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
      activeRecordingIdRef.current = null;
      stoppingRecordingIdRef.current = null;
    }
  }, [isE2eVoice, setIsRecording, setRecordingDuration, setTranscriptionError, stopRecording]);

  const handleToggleCallMode = useCallback(() => {
    const current = useAppStore.getState().callModeEnabled;
    const next = !current;
    if (next && !selectedModel) {
      setTranscriptionError("Select a model first.");
      setTimeout(() => setTranscriptionError(null), 4000);
      return;
    }
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
