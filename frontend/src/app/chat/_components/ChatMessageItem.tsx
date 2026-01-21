"use client";

import { memo } from "react";
import type { UIMessage } from "@ai-sdk/react";
import { Loader2 } from "lucide-react";
import { MessageRenderer, thinkingParser } from "@/components/chat/message-renderer";

interface ChatMessageItemProps {
  message: UIMessage;
  isStreaming: boolean;
  artifactsEnabled?: boolean;
}

function ChatMessageItemBase({
  message,
  isStreaming,
  artifactsEnabled = false,
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
  const hasThinkingContent = !isUser && parsedThinking?.thinkingContent;

  // Extract tool parts (they have type starting with "tool-")
  const toolParts = message.parts.filter(
    (part): part is typeof part & { toolCallId: string; state?: string } =>
      part.type.startsWith("tool-") && "toolCallId" in part,
  );

  // Extract reasoning parts (AI SDK reasoning)
  const reasoningParts = message.parts.filter((part) => part.type === "reasoning");
  const hasReasoningContent = reasoningParts.length > 0 || hasThinkingContent;

  // User message rendering - matches original chat styling
  if (isUser) {
    return (
      <div id={`message-${message.id}`} className="flex justify-end">
        <div className="ml-auto max-w-[75%] md:max-w-[62%] rounded-xl border border-(--border) bg-(--card)/70 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#9a9590] mb-1">You</div>
          <div className="text-[16px] leading-relaxed text-[#e8e4dd] whitespace-pre-wrap break-words">
            {textContent}
          </div>
        </div>
      </div>
    );
  }

  // Assistant message rendering
  return (
    <div id={`message-${message.id}`} className="flex flex-col">
      <div className="max-w-full">
        {/* Text content with MessageRenderer */}
        {textContent ? (
          <MessageRenderer
            content={textContent}
            isStreaming={isStreaming}
            artifactsEnabled={artifactsEnabled}
            messageId={message.id}
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

      {/* Reasoning preview (collapsed) */}
      {hasReasoningContent && (
        <div className="mt-2 text-xs text-[#6a6560]">
          <span className="italic">Reasoning available in activity panel</span>
        </div>
      )}
    </div>
  );
}

export const ChatMessageItem = memo(ChatMessageItemBase);
