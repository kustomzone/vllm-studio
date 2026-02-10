// CRITICAL
"use client";

import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import api from "@/lib/api";
import { createUuid } from "@/lib/uuid";
import type { ChatMessage, ChatMessagePart } from "@/lib/types";
import type { Attachment } from "@/app/chat/types";
import { isVlmAttachmentsEnabled } from "@/lib/features";
import {
  buildAttachmentsBlock,
  readAttachmentContent,
  sanitizeAttachmentName,
  type UploadedAttachment,
} from "@/app/chat/utils/chat-attachments";
import { buildOpenAIChatMessages } from "@/app/chat/utils/openai-multimodal";
import { buildRunSystemPrompt } from "./run-system-prompt";

export interface UseChatSendUserMessageArgs {
  selectedModel: string;
  systemPrompt: string;
  mcpEnabled: boolean;
  deepResearchEnabled: boolean;
  agentMode: boolean;
  currentSessionId: string | null;
  isLoading: boolean;
  messagesRef: MutableRefObject<ChatMessage[]>;
  runAbortControllerRef: MutableRefObject<AbortController | null>;
  setIsLoading: (value: boolean) => void;
  agentFiles: Array<{ name: string; type: "file" | "dir"; children?: unknown[] }>;
  agentFileVersions: Record<string, unknown>;
  setInput: (value: string) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setStreamError: (value: string | null) => void;
  setStreamingStartTime: (value: number | null) => void;
  lastUserInputRef: MutableRefObject<string>;
  createSession: (title: string, model: string) => Promise<{ id: string } | null>;
  setLastSessionId: (id: string) => void;
  replaceUrlToSession: (sessionId: string) => void;
  startRunStream: (
    sessionId: string,
    payload: {
      content?: string;
      message_id: string;
      parts?: ChatMessagePart[];
      model?: string;
      system?: string;
      mcp_enabled?: boolean;
      agent_mode?: boolean;
      agent_files?: boolean;
      deep_research?: boolean;
    },
  ) => Promise<void>;
  loadAgentFiles: (args: { sessionId: string }) => void;
}

export function useChatSendUserMessage({
  selectedModel,
  systemPrompt,
  mcpEnabled,
  deepResearchEnabled,
  agentMode,
  currentSessionId,
  isLoading,
  messagesRef,
  runAbortControllerRef,
  setIsLoading,
  agentFiles,
  agentFileVersions,
  setInput,
  setMessages,
  setStreamError,
  setStreamingStartTime,
  lastUserInputRef,
  createSession,
  setLastSessionId,
  replaceUrlToSession,
  startRunStream,
  loadAgentFiles,
}: UseChatSendUserMessageArgs) {
  const uploadAttachments = useCallback(
    async (
      sessionId: string,
      attachments: Attachment[],
    ): Promise<{
      uploaded: UploadedAttachment[];
      failures: Array<{ name: string; error: string }>;
    }> => {
      if (attachments.length === 0) {
        return { uploaded: [], failures: [] };
      }

      const datePrefix = new Date().toISOString().slice(0, 10);
      const baseDir = `uploads/${datePrefix}`;

      const results = await Promise.all(
        attachments.map(async (attachment, index) => {
          try {
            const safeName = sanitizeAttachmentName(attachment.name || `attachment-${index + 1}`);
            const { content, encoding } = await readAttachmentContent(attachment);
            const fileName = `${createUuid()}-${safeName}${encoding === "base64" ? ".base64" : ""}`;
            const path = `${baseDir}/${fileName}`;
            await api.writeAgentFile(sessionId, path, { content });
            return {
              ok: true as const,
              entry: {
                name: attachment.name || safeName,
                path,
                size: attachment.size,
                type: attachment.type,
                encoding,
              },
            };
          } catch (error) {
            return {
              ok: false as const,
              name: attachment.name || `attachment-${index + 1}`,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }),
      );

      const uploaded = results.flatMap((result) => (result.ok ? [result.entry] : []));
      const failures = results.flatMap((result) =>
        result.ok ? [] : [{ name: result.name, error: result.error }],
      );

      if (uploaded.length > 0) {
        void loadAgentFiles({ sessionId });
      }

      return { uploaded, failures };
    },
    [loadAgentFiles],
  );

  const sendUserMessage = useCallback(
    async (text: string, attachments?: Attachment[], options?: { clearInput?: boolean }) => {
      if (!selectedModel) return;
      if (!text.trim() && (!attachments || attachments.length === 0)) return;
      if (isLoading) return;
      setStreamingStartTime(Date.now());
      setStreamError(null);

      if (options?.clearInput) {
        setInput("");
      }

      lastUserInputRef.current = text;

      const parts: ChatMessagePart[] = [];
      if (text.trim()) {
        parts.push({ type: "text", text });
      }

      if (attachments) {
        for (const att of attachments) {
          if (att.type === "image" && att.base64) {
            parts.push({
              type: "image",
              data: att.base64,
              mimeType: att.file?.type || "image/png",
              name: att.name,
            });
          } else if (att.type === "video" && att.file) {
            parts.push({ type: "text", text: `[Video: ${att.name}]` });
          } else if (att.type === "file" && att.file) {
            parts.push({ type: "text", text: `[File: ${att.name}]` });
          }
        }
      }

      const messageId = createUuid();
      const userMessage: ChatMessage = {
        id: messageId,
        role: "user",
        parts,
      };

      setMessages((prev) => [...prev, userMessage]);
      const removeLocalMessage = () => {
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      };

      let sessionId = currentSessionId;
      if (!sessionId) {
        const session = await createSession("New Chat", selectedModel);
        if (!session) return;
        sessionId = session.id;
        setLastSessionId(sessionId);
        replaceUrlToSession(sessionId);
      }

      let attachmentsBlock: string | undefined;
      const hasAgentFiles = agentFiles.length > 0 || Object.keys(agentFileVersions).length > 0;
      let agentFilesEnabled = hasAgentFiles;
      if (attachments && attachments.length > 0) {
        const { uploaded, failures } = await uploadAttachments(sessionId, attachments);
        if (uploaded.length > 0) {
          attachmentsBlock = buildAttachmentsBlock(uploaded);
          agentFilesEnabled = true;
        }
        if (failures.length > 0) {
          const names = failures.map((failure) => failure.name).join(", ");
          setStreamError(`Failed to upload ${failures.length} attachment(s): ${names}`);
          if (uploaded.length === 0) {
            removeLocalMessage();
            return;
          }
        }
      }

      const runSystemPrompt = attachmentsBlock
        ? buildRunSystemPrompt(systemPrompt, attachmentsBlock)
        : systemPrompt.trim() || undefined;

      const imageAttachments = (attachments ?? []).filter((att) => att.type === "image" && Boolean(att.base64));
      const vlmEnabled = isVlmAttachmentsEnabled() && imageAttachments.length > 0;
      const useDirectVlm = vlmEnabled && !agentMode;

      const buildAttachmentPlaceholders = (items: Attachment[]): string => {
        const lines: string[] = [];
        for (const att of items) {
          const name = att.name?.trim() || "attachment";
          if (att.type === "image") lines.push(`[Image: ${name}]`);
          else if (att.type === "video") lines.push(`[Video: ${name}]`);
          else if (att.type === "file") lines.push(`[File: ${name}]`);
          else if (att.type === "audio") lines.push(`[Audio: ${name}]`);
        }
        return lines.join("\n");
      };

      if (!useDirectVlm) {
        // Only use placeholder blocks when VLM attachments are disabled; otherwise send true multimodal parts.
        const placeholderBlock = !vlmEnabled && attachments?.length ? buildAttachmentPlaceholders(attachments) : "";
        const content = text.trim()
          ? placeholderBlock
            ? `${text}\n\n${placeholderBlock}`
            : text
          : placeholderBlock;

        await startRunStream(sessionId, {
          ...(content.trim() ? { content } : {}),
          ...(vlmEnabled ? { parts } : {}),
          message_id: messageId,
          model: selectedModel,
          system: runSystemPrompt,
          mcp_enabled: mcpEnabled,
          agent_mode: agentMode,
          agent_files: agentFilesEnabled,
          deep_research: deepResearchEnabled,
        });
        return;
      }

      // Direct OpenAI path (feature-flagged): send OpenAI-style multimodal message parts.
      const assistantId = createUuid();
      let assistantText = "";

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", parts: [{ type: "text", text: "" }] },
      ]);

      const abortController = new AbortController();
      runAbortControllerRef.current?.abort();
      runAbortControllerRef.current = abortController;
      setIsLoading(true);

      try {
        const history = messagesRef.current;
        const messages = buildOpenAIChatMessages({
          system: runSystemPrompt,
          history,
          userText: text,
          attachments: imageAttachments,
        });

        const payload: Record<string, unknown> = {
          model: selectedModel,
          stream: true,
          messages,
        };

        const { stream } = await api.streamOpenAIChatCompletions(payload, { signal: abortController.signal });
        for await (const chunk of stream) {
          const choices = chunk["choices"];
          if (!Array.isArray(choices)) continue;
          const delta = (choices[0] as Record<string, unknown> | undefined)?.["delta"] as Record<string, unknown> | undefined;
          // Some backends (notably llama.cpp for "thinking" models) may stream `reasoning_content`
          // with empty `content`. For UX, treat reasoning_content as the visible content when needed.
          const content =
            typeof delta?.["content"] === "string" && (delta["content"] as string).length > 0
              ? (delta["content"] as string)
              : typeof delta?.["reasoning_content"] === "string"
                ? (delta["reasoning_content"] as string)
                : "";
          if (!content) continue;
          assistantText += content;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, parts: [{ type: "text", text: assistantText }] }
                : msg,
            ),
          );
        }

        // Persist messages to the session for consistency with normal chat flows.
        void api.addChatMessage(sessionId, {
          id: messageId,
          role: "user",
          content: text,
          model: selectedModel,
          parts,
        });
        void api.addChatMessage(sessionId, {
          id: assistantId,
          role: "assistant",
          content: assistantText,
          model: selectedModel,
          parts: [{ type: "text", text: assistantText }],
        });
      } catch (err) {
        if (!abortController.signal.aborted) {
          const message = err instanceof Error ? err.message : String(err);
          setStreamError(message);
        }
        setMessages((prev) => prev.filter((msg) => msg.id !== assistantId));
      } finally {
        runAbortControllerRef.current = null;
        setIsLoading(false);
      }
    },
    [
      agentFileVersions,
      agentFiles,
      agentMode,
      createSession,
      currentSessionId,
      deepResearchEnabled,
      messagesRef,
      isLoading,
      lastUserInputRef,
      mcpEnabled,
      replaceUrlToSession,
      runAbortControllerRef,
      selectedModel,
      setInput,
      setIsLoading,
      setLastSessionId,
      setMessages,
      setStreamError,
      setStreamingStartTime,
      startRunStream,
      systemPrompt,
      uploadAttachments,
    ],
  );

  return { sendUserMessage };
}
