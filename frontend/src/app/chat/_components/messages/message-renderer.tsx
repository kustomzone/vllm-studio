// CRITICAL
"use client";

import { memo, useEffect, useRef, useId, useMemo } from "react";
import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { EnhancedCodeBlock } from "../code/enhanced-code-block";
import {
  useMessageParsing,
  thinkingParser,
} from "@/lib/services/message-parsing";
import type { MarkdownSegment, ThinkingResult } from "@/lib/services/message-parsing";
import {
  getMermaid,
  looksLikeMermaidDiagram,
  sanitizeMermaidCode,
  summarizeMermaidError,
} from "@/lib/mermaid";
import { useAppStore } from "@/store";

export { thinkingParser };
export type { ThinkingResult };
export function splitThinking(content: string): ThinkingResult {
  return thinkingParser.parse(content);
}

const EMPTY_MERMAID_STATE = { svg: "", error: null } as const;

interface MessageRendererProps {
  content: string;
  isStreaming?: boolean;
}

function StreamingCursor() {
  return (
    <motion.span
      className="inline-block w-[2px] h-[1.1em] ml-0.5 rounded-full bg-(--fg)/60 align-text-bottom"
      animate={{ opacity: [1, 0] }}
      transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

const MermaidDiagram = memo(function MermaidDiagram({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "_");
  const mermaidState = useAppStore((s) => s.mermaidState[id] ?? EMPTY_MERMAID_STATE);
  const setMermaidState = useAppStore((s) => s.setMermaidState);
  const deleteMermaidState = useAppStore((s) => s.deleteMermaidState);
  const { svg, error } = mermaidState;
  const seqRef = useRef(0);

  useEffect(() => {
    const render = async () => {
      if (!code.trim()) return;
      const seq = ++seqRef.current;

      if (!looksLikeMermaidDiagram(code)) {
        setMermaidState(id, "", "Not a valid Mermaid diagram.");
        return;
      }

      try {
        const mermaid = await getMermaid();
        if (!mermaid) { setMermaidState(id, "", "Failed to load mermaid"); return; }
        const { svg } = await mermaid.render(`mermaid_${id}_${seq}`, sanitizeMermaidCode(code));
        if (seq !== seqRef.current) return;
        setMermaidState(id, svg, null);
      } catch (e) {
        if (seq !== seqRef.current) return;
        setMermaidState(id, "", summarizeMermaidError(e));
      }
    };
    const t = setTimeout(render, 250);
    return () => { clearTimeout(t); deleteMermaidState(id); };
  }, [code, deleteMermaidState, id, setMermaidState]);

  if (error) {
    return (
      <div className="my-3 rounded-xl border border-(--err)/20 bg-(--err)/5 px-3 py-2">
        <div className="flex items-center gap-2 text-(--err) text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-3 p-4 rounded-xl border border-(--border) bg-(--surface) overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
});

const CodeBlock = memo(function CodeBlock({
  segment,
  isStreaming,
}: {
  segment: MarkdownSegment;
  isStreaming?: boolean;
}) {
  const lang = segment.language || "";

  if (lang === "mermaid") {
    if (isStreaming) {
      return (
        <div className="my-3 p-4 rounded-xl border border-(--border) bg-(--surface)">
          <div className="text-xs text-(--dim) mb-2">Mermaid preview renders after streaming.</div>
          <pre className="text-xs text-(--dim) overflow-x-auto">{segment.content}</pre>
        </div>
      );
    }
    return <MermaidDiagram code={segment.content} />;
  }

  return (
    <EnhancedCodeBlock language={lang} isStreaming={isStreaming}>
      {segment.content}
    </EnhancedCodeBlock>
  );
});

const MarkdownBlock = memo(function MarkdownBlock({ html }: { html: string }) {
  return <div className="chat-markdown" dangerouslySetInnerHTML={{ __html: html }} />;
});

function MessageRendererBase({ content, isStreaming }: MessageRendererProps) {
  const { parse, renderMarkdown } = useMessageParsing();

  const parsed = useMemo(() => {
    if (isStreaming) return null;
    return parse(content, { isStreaming: false, extractArtifacts: false });
  }, [parse, content, isStreaming]);

  const mainContent = parsed?.thinking.mainContent ?? content;
  const segments = parsed?.segments ?? [];

  const renderedMarkdown = useMemo(() => {
    if (isStreaming) return [];
    return segments.map((s) => (s.type === "code" ? null : renderMarkdown(s.content)));
  }, [isStreaming, segments, renderMarkdown]);

  return (
    <div className="message-content min-w-0 break-words overflow-hidden max-w-full text-inherit">
      {mainContent && (
        <div style={{ color: "var(--fg)" }}>
          {isStreaming ? (
            <div className="whitespace-pre-wrap break-words text-[15px] leading-[1.7]">
              {mainContent}
            </div>
          ) : (
            segments.map((segment, i) =>
              segment.type === "code" ? (
                <CodeBlock key={`code-${i}`} segment={segment} isStreaming={isStreaming} />
              ) : (
                <MarkdownBlock key={`md-${i}`} html={renderedMarkdown[i] ?? ""} />
              ),
            )
          )}
        </div>
      )}
      {mainContent && isStreaming && <StreamingCursor />}
    </div>
  );
}

export const MessageRenderer = memo(
  MessageRendererBase,
  (prev, next) => prev.content === next.content && prev.isStreaming === next.isStreaming,
);
