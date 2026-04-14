// CRITICAL
"use client";

import { memo, useMemo } from "react";
import MarkdownIt from "markdown-it";
import { Loader2 } from "lucide-react";
import { CodePreview } from "../code/code-preview";

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

function extOf(path: string): string {
  const i = path.lastIndexOf(".");
  return i >= 0 ? path.slice(i + 1).toLowerCase() : "";
}

function languageForExt(ext: string): string {
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    mjs: "javascript",
    cjs: "javascript",
    json: "json",
    md: "markdown",
    css: "css",
    scss: "scss",
    html: "html",
    htm: "html",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    rb: "ruby",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    sql: "sql",
    toml: "toml",
    graphql: "graphql",
    vue: "html",
    svelte: "html",
  };
  return map[ext] ?? "text";
}

export const AgentFilePreview = memo(function AgentFilePreview({
  path,
  content,
  loading,
}: {
  path: string;
  content: string | null;
  loading: boolean;
}) {
  const ext = useMemo(() => extOf(path), [path]);

  const mdHtml = useMemo(() => {
    if (ext !== "md" || !content) return null;
    return md.render(content);
  }, [content, ext]);

  const jsonPretty = useMemo(() => {
    if (ext !== "json" || !content) return null;
    try {
      return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return null;
    }
  }, [content, ext]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-(--dim)" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-[11px] font-mono text-(--dim)/40">No content</span>
      </div>
    );
  }

  if (ext === "md" && mdHtml) {
    return (
      <div
        className="agent-md-preview max-w-none space-y-2 px-4 py-3 text-[13px] leading-relaxed text-(--fg) [&_a]:text-(--hl1) [&_a]:underline [&_code]:rounded [&_code]:bg-(--surface) [&_code]:px-1 [&_pre]:max-h-[min(70vh,560px)] [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-(--surface) [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
        dangerouslySetInnerHTML={{ __html: mdHtml }}
      />
    );
  }

  if ((ext === "html" || ext === "htm") && content.trim()) {
    return (
      <iframe
        title="HTML preview"
        srcDoc={content}
        sandbox="allow-scripts"
        className="h-full min-h-[240px] w-full border-0 bg-white"
      />
    );
  }

  if (ext === "json") {
    const code = jsonPretty ?? content;
    return <CodePreview code={code} language="json" showLineNumbers className="h-full min-h-0" />;
  }

  if (
    ext === "png" ||
    ext === "jpg" ||
    ext === "jpeg" ||
    ext === "gif" ||
    ext === "webp" ||
    ext === "svg"
  ) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-[11px] text-(--dim)">
        <p>Binary image preview is not available in the workspace reader.</p>
        <p className="text-(--dim)/60">Use the system file viewer or export the session to view images.</p>
      </div>
    );
  }

  const codeExts = new Set([
    "ts",
    "tsx",
    "js",
    "jsx",
    "css",
    "py",
    "rs",
    "go",
    "java",
    "sql",
    "yaml",
    "yml",
    "toml",
    "graphql",
    "vue",
    "svelte",
  ]);
  if (codeExts.has(ext)) {
    return (
      <CodePreview code={content} language={languageForExt(ext)} showLineNumbers className="h-full min-h-0" />
    );
  }

  return (
    <div className="font-mono text-[12px] leading-[1.8] scrollbar-thin">
      {content.split("\n").map((line, i) => (
        <div key={i} className="flex min-h-[21px] hover:bg-(--fg)/[0.015]">
          <span className="w-12 shrink-0 select-none pr-4 text-right text-(--dim)/25">{i + 1}</span>
          <span className="flex-1 whitespace-pre pr-4 text-(--fg)/85">{line}</span>
        </div>
      ))}
    </div>
  );
});
