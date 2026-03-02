// CRITICAL
"use client";

import { useEffect, useId } from "react";
import * as Icons from "../icons";
import { CodePreview } from "./code-preview";
import { useAppStore } from "@/store";
import { DEFAULT_CODE_BLOCK_ENTRY } from "@/store/chat-slice-defaults";

interface EnhancedCodeBlockProps {
  children: string;
  className?: string;
  isStreaming?: boolean;
  language?: string;
}

const LANGUAGE_ALIAS: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  html: "markup",
  xml: "markup",
  txt: "",
  text: "",
  plain: "",
  plaintext: "",
};

function normalizeLanguage(raw: string | undefined): string {
  const trimmed = raw?.trim().toLowerCase() ?? "";
  if (!trimmed) return "";
  return LANGUAGE_ALIAS[trimmed] ?? trimmed;
}

function inferLanguageFromCode(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return "markdown";

  if (/^#!.*\b(bash|zsh|sh)\b/i.test(trimmed)) return "bash";
  if (/^#!.*\bpython\b/i.test(trimmed)) return "python";

  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // Ignore and continue with lightweight heuristics.
    }
  }

  if (/<\/?[a-z][\s\S]*>/i.test(trimmed)) return "markup";
  if (/^(\s*[A-Za-z0-9_.-]+\s*:\s.+\n){2,}/m.test(trimmed)) return "yaml";
  if (/(^|\n)\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|WITH)\b/i.test(trimmed)) return "sql";
  if (
    /(^|\n)\s*(import|export|const|let|function|class|interface|type)\b/.test(trimmed) ||
    /=>/.test(trimmed)
  ) {
    return "typescript";
  }
  if (/(^|\n)\s*(def|class)\s+\w+/.test(trimmed) || /\bprint\(/.test(trimmed)) return "python";

  return "markdown";
}

export function EnhancedCodeBlock({
  children,
  className,
  language,
  isStreaming,
}: EnhancedCodeBlockProps) {
  const blockId = useId();
  const blockState = useAppStore(
    (state) => state.codeBlockState[blockId] ?? DEFAULT_CODE_BLOCK_ENTRY,
  );
  const updateCodeBlockState = useAppStore((state) => state.updateCodeBlockState);
  const deleteCodeBlockState = useAppStore((state) => state.deleteCodeBlockState);
  const { copied, isExpanded } = blockState;

  // Prevent `codeBlockState` from growing unbounded as Virtuoso mounts/unmounts blocks.
  useEffect(() => {
    return () => deleteCodeBlockState(blockId);
  }, [blockId, deleteCodeBlockState]);

  const code = String(children).replace(/\n$/, "");
  const explicitLanguage = normalizeLanguage(language || className?.replace("language-", ""));
  const lang = explicitLanguage || inferLanguageFromCode(code);

  const setCopied = (value: boolean) => {
    updateCodeBlockState(blockId, (prev) => ({ ...prev, copied: value }));
  };

  const setExpanded = (value: boolean) => {
    updateCodeBlockState(blockId, (prev) => ({ ...prev, isExpanded: value }));
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lineCount = code.split("\n").length;
  const isLongCode = lineCount > 20;
  const shouldCollapse = isLongCode && !isExpanded;
  const languageLabel = (lang || "code").toUpperCase();

  if (isStreaming) {
    return (
      <div className="my-3 overflow-hidden rounded-md border border-(--border) bg-(--surface)">
        <div className="flex items-center justify-between gap-2 border-b border-(--border) bg-(--surface) px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="rounded-sm border border-(--border) bg-background/40 px-2 py-0.5 text-[10px] font-mono font-semibold tracking-[0.08em] text-(--dim)">
              {languageLabel}
            </span>
            {isLongCode && <span className="text-[11px] text-(--dim)">{lineCount} lines</span>}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={copyCode}
              className="rounded-md p-1.5 text-(--dim) transition-colors hover:bg-background/45 hover:text-(--fg)"
              title="Copy code"
            >
              {copied ? (
                <Icons.Check className="h-3.5 w-3.5 text-(--hl2)" />
              ) : (
                <Icons.Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        <CodePreview code={code} language={lang} />
      </div>
    );
  }

  return (
    <div className="my-3 overflow-hidden rounded-md border border-(--border) bg-(--surface)">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-(--border) bg-(--surface) px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="rounded-sm border border-(--border) bg-background/40 px-2 py-0.5 text-[10px] font-mono font-semibold tracking-[0.08em] text-(--dim)">
            {languageLabel}
          </span>
          {isLongCode && <span className="text-[11px] text-(--dim)">{lineCount} lines</span>}
        </div>

        <div className="flex items-center gap-1">
          {isLongCode && (
            <button
              onClick={() => setExpanded(!isExpanded)}
              className="rounded-md p-1.5 text-(--dim) transition-colors hover:bg-background/45 hover:text-(--fg)"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <Icons.Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Icons.Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          <button
            onClick={copyCode}
            className="rounded-md p-1.5 text-(--dim) transition-colors hover:bg-background/45 hover:text-(--fg)"
            title="Copy code"
          >
            {copied ? (
              <Icons.Check className="h-3.5 w-3.5 text-(--hl2)" />
            ) : (
              <Icons.Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Code */}
      <div className={shouldCollapse ? "max-h-[300px] overflow-hidden relative" : ""}>
        <CodePreview code={code} language={lang} />

        {shouldCollapse && (
          <div className="absolute bottom-0 left-0 right-0 flex h-24 items-end justify-center bg-gradient-to-t from-(--surface) to-transparent pb-3">
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1 text-xs text-(--dim) transition-colors hover:text-(--fg)"
            >
              Expand full code
              <Icons.Maximize2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
