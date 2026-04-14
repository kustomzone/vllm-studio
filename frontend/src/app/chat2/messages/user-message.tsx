"use client";

import { useState, useCallback } from "react";
import type { ChatMessage } from "@/lib/types";

interface UserMessageProps {
  message: ChatMessage;
}

export function UserMessage({ message }: UserMessageProps) {
  const [copied, setCopied] = useState(false);
  const textParts = message.parts.filter((p) => p.type === "text");
  const text = textParts.map((p) => (p as { text: string }).text).join("\n");
  const imageParts = message.parts.filter((p) => p.type === "image");

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  if (!text && imageParts.length === 0) return null;

  return (
    <div className="group flex justify-end">
      <div className="max-w-[80%]">
        <div className="px-3.5 py-2.5 rounded-2xl bg-(--surface) border border-(--border)/50">
          {text && (
            <p className="text-[14px] leading-[1.6] text-(--fg) whitespace-pre-wrap break-words">
              {text}
            </p>
          )}
        </div>
        <div className="flex justify-end items-center gap-0.5 mt-1 h-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={handleCopy} className="p-1 rounded-md hover:bg-(--surface) transition-colors" title="Copy">
            <span className="text-[10px] text-(--dim)/40">{copied ? "copied" : "copy"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
