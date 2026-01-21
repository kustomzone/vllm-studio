"use client";

import { memo } from "react";
import type { UIMessage } from "@ai-sdk/react";
import type { LanguageModelUsage } from "ai";
import { Loader2, Copy, Check, GitBranch, RotateCcw, Download } from "lucide-react";
import { MessageRenderer, thinkingParser } from "@/components/chat/message-renderer";

interface ChatMessageItemProps {
  message: UIMessage;
  isStreaming: boolean;
  artifactsEnabled?: boolean;
  selectedModel?: string;
  contextUsageLabel?: string | null;
  copied: boolean;
  onCopy: (text: string, messageId: string) => void;
  onFork?: (messageId: string) => void;
  onReprompt?: (messageId: string) => void;
  onExport: (payload: {
    messageId: string;
    role: "user" | "assistant";
    content: string;
    model?: string;
    totalTokens?: number;
  }) => void;
}

type MessageMetadata = {
  model?: string;
  usage?: LanguageModelUsage;
};

function ChatMessageItemBase({
  message,
  isStreaming,
  artifactsEnabled = false,
  selectedModel,
  contextUsageLabel,
  copied,
  onCopy,
  onFork,
  onReprompt,
  onExport,
}: ChatMessageItemProps) {
  const isUser = message.role === "user";

  // Extract text content from parts
  const rawTextContent = message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");

  // For assistant messages, parse thinking content and get mainContent without <think> tags
  const parsedThinking = !isUser ? thinkingParser.parse(rawTextContent) : null;
  const textContent = isUser ? rawTextContent : parsedThinking?.mainContent || "";

  // Extract tool parts (they have type starting with "tool-")
  const toolParts = message.parts.filter(
    (part): part is typeof part & { toolCallId: string; state?: string } =>
      part.type.startsWith("tool-") && "toolCallId" in part,
  );

  // Reasoning content handled in activity panel

  const metadata = message.metadata as MessageMetadata | undefined;
  const usage = metadata?.usage;
  const totalTokens =
    usage?.totalTokens ??
    (usage?.inputTokens != null || usage?.outputTokens != null
      ? (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0)
      : undefined);

  const modelLabel = metadata?.model ?? selectedModel ?? "Assistant";
  const displayModel = modelLabel.split("/").pop() || modelLabel;

  const canActOnContent = textContent.trim().length > 0;

  const handleExport = () => {
    if (!canActOnContent) return;
    onExport({
      messageId: message.id,
      role: isUser ? "user" : "assistant",
      content: textContent,
      model: isUser ? undefined : displayModel,
      totalTokens: isUser ? undefined : totalTokens,
    });
  };

  const actionClassName =
    "flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity";
  const actionButtonClassName =
    "p-1 rounded hover:bg-(--accent) transition-colors disabled:opacity-40";

  // User message rendering - matches original chat styling
  if (isUser) {
    return (
      <div id={`message-${message.id}`} className="flex justify-end group">
        <div className="ml-auto max-w-[75%] md:max-w-[62%] rounded-xl border border-(--border) bg-(--card)/70 px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#9a9590]">You</div>
            <div className={`ml-auto ${actionClassName}`}>
              <button
                onClick={() => onCopy(textContent, message.id)}
                disabled={!canActOnContent}
                className={actionButtonClassName}
                title="Copy"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-(--success)" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-[#9a9590]" />
                )}
              </button>
              <button
                onClick={handleExport}
                disabled={!canActOnContent}
                className={actionButtonClassName}
                title="Export"
              >
                <Download className="h-3.5 w-3.5 text-[#9a9590]" />
              </button>
            </div>
          </div>
          <div className="text-[16px] leading-relaxed text-[#e8e4dd] whitespace-pre-wrap break-words">
            {textContent}
          </div>
        </div>
      </div>
    );
  }

  // Assistant message rendering
  return (
    <div id={`message-${message.id}`} className="flex flex-col group">
      <div className="max-w-full">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#9a9590] truncate max-w-[180px]">
            {displayModel || "Assistant"}
          </span>
          {totalTokens != null && totalTokens > 0 && (
            <span className="text-[10px] text-[#6a6560] font-mono">
              {totalTokens.toLocaleString()} tok
            </span>
          )}
          {contextUsageLabel && (
            <span className="text-[10px] text-[#6a6560] font-mono">ctx {contextUsageLabel}</span>
          )}
          <div className={`ml-auto ${actionClassName}`}>
            {onReprompt && (
              <button
                onClick={() => onReprompt(message.id)}
                disabled={isStreaming}
                className={actionButtonClassName}
                title="Reprompt"
              >
                <RotateCcw className="h-3.5 w-3.5 text-[#9a9590]" />
              </button>
            )}
            {onFork && (
              <button
                onClick={() => onFork(message.id)}
                className={actionButtonClassName}
                title="Fork"
              >
                <GitBranch className="h-3.5 w-3.5 text-[#9a9590]" />
              </button>
            )}
            <button
              onClick={() => onCopy(textContent, message.id)}
              disabled={!canActOnContent}
              className={actionButtonClassName}
              title="Copy"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-(--success)" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-[#9a9590]" />
              )}
            </button>
            <button
              onClick={handleExport}
              disabled={!canActOnContent}
              className={actionButtonClassName}
              title="Export"
            >
              <Download className="h-3.5 w-3.5 text-[#9a9590]" />
            </button>
          </div>
        </div>

        {/* Text content with MessageRenderer */}
        {textContent ? (
          <MessageRenderer
            content={textContent}
            isStreaming={isStreaming}
            artifactsEnabled={artifactsEnabled}
          />
        ) : isStreaming ? (
          <div className="flex items-center gap-2 text-[#9a9590]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Thinking...</span>
          </div>
        ) : null}

        {/* Tool invocations preview */}
        {toolParts.length > 0 && (
          <div className="mt-3 pt-3 border-t border-(--border)">
            {toolParts.map((tool) => {
              const toolName = tool.type.replace(/^tool-/, "");
              const state = tool.state;
              return (
                <div
                  key={tool.toolCallId}
                  className="flex items-center gap-2 text-xs text-[#9a9590]"
                >
                  <span className="font-mono">{toolName}</span>
                  <span className="text-[#6a6560]">
                    {state === "call" || state === "input-streaming" ? "calling..." : ""}
                    {state === "result" || state === "output-available" ? "complete" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reasoning preview removed (activity panel handles it) */}
    </div>
  );
}

export const ChatMessageItem = memo(ChatMessageItemBase);
