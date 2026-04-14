"use client";

import { memo, useMemo } from "react";
import type { ChatMessage, ChatMessagePart, ToolResult } from "@/lib/types";
import { MessageRenderer } from "@/app/chat/_components/messages/message-renderer";
import { ThinkingBlock } from "@/app/chat/_components/messages/chat-message-item/thinking-block";
import { ToolCallRow } from "@/app/chat/_components/messages/chat-message-item/tool-call-row";

interface AssistantMessageProps {
  message: ChatMessage;
  executingTools: Set<string>;
  toolResultsMap: Map<string, ToolResult>;
  onToolClick: (toolCallId: string) => void;
  isLoading: boolean;
}

type ToolPart = ChatMessagePart & {
  toolCallId: string;
  toolName?: string;
  input?: unknown;
  state?: string;
  output?: unknown;
};

function isToolPart(part: ChatMessagePart): part is ToolPart {
  if (typeof part.type !== "string") return false;
  if (part.type === "dynamic-tool") return "toolCallId" in part;
  return part.type.startsWith("tool-") && "toolCallId" in part;
}

export const AssistantMessage = memo(function AssistantMessage({
  message,
  executingTools,
  toolResultsMap,
  onToolClick,
  isLoading,
}: AssistantMessageProps) {
  const { textParts, thinkingParts, toolParts } = useMemo(() => {
    const text: string[] = [];
    const thinking: string[] = [];
    const tools: ToolPart[] = [];
    for (const part of message.parts) {
      if (part.type === "text" && typeof (part as { text: string }).text === "string") {
        text.push((part as { text: string }).text);
      } else if (part.type === "reasoning" && typeof (part as { text: string }).text === "string") {
        thinking.push((part as { text: string }).text);
      } else if (isToolPart(part)) {
        tools.push(part);
      }
    }
    return { textParts: text, thinkingParts: thinking, toolParts: tools };
  }, [message.parts]);

  const isLastMessage = isLoading;
  const hasContent = textParts.length > 0 || thinkingParts.length > 0 || toolParts.length > 0;
  if (!hasContent) return null;

  const combinedText = textParts.join("\n");
  const isStreamingThis = isLastMessage && !combinedText && toolParts.length === 0;

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%]">
        {/* Thinking blocks */}
        {thinkingParts.map((content, i) => (
          <ThinkingBlock key={i} content={content} isActive={i === thinkingParts.length - 1 && isLastMessage && !combinedText} />
        ))}

        {/* Tool call rows */}
        {toolParts.map((part) => {
          const id = String(part.toolCallId);
          return (
            <div key={id} onClick={() => onToolClick(id)} className="cursor-pointer">
              <ToolCallRow
                part={part}
                isExecuting={executingTools.has(id)}
                hasResult={toolResultsMap.has(id) || part.output != null}
                isError={toolResultsMap.get(id)?.isError ?? false}
              />
            </div>
          );
        })}

        {/* Text content */}
        {combinedText && (
          <div className="text-[14px] leading-[1.7] text-(--fg)">
            <MessageRenderer content={combinedText} isStreaming={isStreamingThis} />
          </div>
        )}
      </div>
    </div>
  );
});
