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

const ALIAS: Record<string, string> = {
  js: "javascript", ts: "typescript", sh: "bash", shell: "bash", zsh: "bash",
  yml: "yaml", md: "markdown", html: "markup", xml: "markup",
  txt: "", text: "", plain: "", plaintext: "",
};

function normalizeLang(raw: string | undefined): string {
  const t = raw?.trim().toLowerCase() ?? "";
  return t ? (ALIAS[t] ?? t) : "";
}

function inferLang(code: string): string {
  const t = code.trim();
  if (!t) return "markdown";
  if (/^#!.*\b(bash|zsh|sh)\b/i.test(t)) return "bash";
  if (/^#!.*\bpython\b/i.test(t)) return "python";
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try { JSON.parse(t); return "json"; } catch {}
  }
  if (/<\/?[a-z][\s\S]*>/i.test(t)) return "markup";
  if (/^(\s*[A-Za-z0-9_.-]+\s*:\s.+\n){2,}/m.test(t)) return "yaml";
  if (/(^|\n)\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|WITH)\b/i.test(t)) return "sql";
  if (/(^|\n)\s*(import|export|const|let|function|class|interface|type)\b/.test(t) || /=>/.test(t)) return "typescript";
  if (/(^|\n)\s*(def|class)\s+\w+/.test(t) || /\bprint\(/.test(t)) return "python";
  return "markdown";
}

export function EnhancedCodeBlock({ children, className, language, isStreaming }: EnhancedCodeBlockProps) {
  const blockId = useId();
  const blockState = useAppStore((s) => s.codeBlockState[blockId] ?? DEFAULT_CODE_BLOCK_ENTRY);
  const updateCodeBlockState = useAppStore((s) => s.updateCodeBlockState);
  const deleteCodeBlockState = useAppStore((s) => s.deleteCodeBlockState);
  const { copied, isExpanded } = blockState;

  useEffect(() => (() => deleteCodeBlockState(blockId)), [blockId, deleteCodeBlockState]);

  const code = String(children).replace(/\n$/, "");
  const explicit = normalizeLang(language || className?.replace("language-", ""));
  const lang = explicit || inferLang(code);
  const lineCount = code.split("\n").length;
  const isLong = lineCount > 20;
  const shouldCollapse = isLong && !isExpanded;
  const label = (lang || "code").toUpperCase();

  const setCopied = (v: boolean) => updateCodeBlockState(blockId, (p) => ({ ...p, copied: v }));
  const setExpanded = (v: boolean) => updateCodeBlockState(blockId, (p) => ({ ...p, isExpanded: v }));

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-(--border) bg-(--surface)">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-(--border) px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-medium tracking-wide text-(--dim)/70">
            {label}
          </span>
          {isLong && <span className="text-[10px] text-(--dim)/50">{lineCount} lines</span>}
        </div>
        <div className="flex items-center gap-0.5">
          {isLong && !isStreaming && (
            <button
              onClick={() => setExpanded(!isExpanded)}
              className="rounded-lg p-1 text-(--dim)/60 transition-colors hover:text-(--fg) hover:bg-(--bg)/50"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <Icons.Minimize2 className="h-3 w-3" /> : <Icons.Maximize2 className="h-3 w-3" />}
            </button>
          )}
          <button
            onClick={copy}
            className="rounded-lg p-1 text-(--dim)/60 transition-colors hover:text-(--fg) hover:bg-(--bg)/50"
            title="Copy"
          >
            {copied ? <Icons.Check className="h-3 w-3 text-(--hl2)" /> : <Icons.Copy className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Code */}
      <div className={shouldCollapse ? "max-h-[300px] overflow-hidden relative" : ""}>
        <CodePreview code={code} language={lang} />
        {shouldCollapse && (
          <div className="absolute bottom-0 inset-x-0 flex h-20 items-end justify-center bg-gradient-to-t from-(--surface) to-transparent pb-2">
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1 text-xs text-(--dim)/60 transition-colors hover:text-(--fg)"
            >
              Expand <Icons.Maximize2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
