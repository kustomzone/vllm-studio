"use client";

import { memo, useMemo, useState, useCallback } from "react";
import type { ChatMessage, ChatMessagePart, ToolResult } from "@/lib/types";
import { MessageRenderer } from "@/app/chat/_components/messages/message-renderer";
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
  const isActivelyThinking = isLastMessage && thinkingParts.length > 0 && !combinedText && toolParts.length === 0;

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%]">
        {/* Thinking — single collapsed row */}
        {thinkingParts.length > 0 && (
          <ThinkingRow
            content={thinkingParts.join("\n")}
            isActive={isActivelyThinking}
          />
        )}

        {/* Tool calls — compact grouped block */}
        {toolParts.length > 0 && (
          <div className="space-y-0.5 mb-1">
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
          </div>
        )}

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

function ThinkingRow({ content, isActive }: { content: string; isActive: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded((p) => !p), []);
  const preview = content.length > 60 ? content.slice(0, 60) + "…" : content;

  return (
    <div className="mb-1">
      <button
        onClick={toggle}
        className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-(--fg)/[0.03] transition-colors w-full text-left"
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-(--fg) animate-pulse" : "bg-(--dim)/50"}`} />
        <span className={`text-[11px] flex-1 ${isActive ? "text-(--fg)" : "text-(--dim)"}`}>
          {isActive ? "Thinking..." : expanded ? "Thought" : preview}
        </span>
      </button>
      {expanded && !isActive && (
        <div className="ml-[22px] mt-0.5 pl-3 border-l-2 border-(--border) text-[11px] leading-[1.6] text-(--dim) overflow-y-auto max-h-[200px]">
          <p className="whitespace-pre-wrap break-words">{content}</p>
        </div>
      )}
    </div>
  );
}
