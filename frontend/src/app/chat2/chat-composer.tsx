"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import { ArrowUp, Loader2 } from "lucide-react";

interface ChatComposerProps {
  isLoading: boolean;
  selectedModel: string;
  onSend: (text: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}

export function ChatComposer({ isLoading, selectedModel, onSend, inputRef }: ChatComposerProps) {
  const [input, setInput] = useState("");

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (input.trim() && !isLoading) {
          onSend(input);
          setInput("");
        }
      }
    },
    [input, isLoading, onSend],
  );

  const handleSubmit = useCallback(() => {
    if (input.trim() && !isLoading) {
      onSend(input);
      setInput("");
    }
  }, [input, isLoading, onSend]);

  const modelName = selectedModel?.split("/").pop() || "no model";

  return (
    <div className="shrink-0 border-t border-(--border)/20 px-4 py-3 bg-(--bg)">
      <div className="max-w-3xl mx-auto">
        {/* Model indicator */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-mono text-(--dim)/40 uppercase tracking-wider">{modelName}</span>
        </div>

        {/* Input row */}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-(--border)/40 bg-(--surface)/50 px-3 py-2 text-[14px] text-(--fg) placeholder:text-(--dim)/30 focus:outline-none focus:border-(--border) transition-colors min-h-[40px] max-h-[200px]"
            style={{ fieldSizing: "content" } as React.CSSProperties}
            disabled={isLoading}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className="shrink-0 w-9 h-9 rounded-lg bg-(--fg) text-(--bg) flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
