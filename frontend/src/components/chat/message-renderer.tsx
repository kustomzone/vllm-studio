'use client';

import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronRight, Brain, Copy, Check } from 'lucide-react';

interface MessageRendererProps {
  content: string;
  isStreaming?: boolean;
}

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
}

function ThinkingBlock({ content, isStreaming }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="my-3 rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--accent)]/30">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--accent)]/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <Brain className="h-3.5 w-3.5" />
        <span>Thinking{isStreaming ? '...' : ''}</span>
        {!isExpanded && (
          <span className="ml-auto text-[var(--muted)] truncate max-w-[200px]">
            {content.slice(0, 50)}...
          </span>
        )}
      </button>
      {isExpanded && (
        <div className="px-4 py-3 text-sm text-[var(--muted-foreground)] border-t border-[var(--border)] bg-[var(--background)]/50 whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
}

function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const language = className?.replace('language-', '') || '';

  const copyCode = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-[var(--border)] group">
      <div className="flex items-center justify-between bg-[var(--accent)] px-4 py-2">
        <span className="text-xs font-mono text-[var(--muted-foreground)]">
          {language || 'code'}
        </span>
        <button
          onClick={copyCode}
          className="p-1 rounded hover:bg-[var(--accent-hover)] transition-colors"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-[var(--success)]" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-[var(--muted)]" />
          )}
        </button>
      </div>
      <pre className="bg-[var(--card)] p-4 overflow-x-auto">
        <code className="text-sm font-mono">{children}</code>
      </pre>
    </div>
  );
}

export function MessageRenderer({ content, isStreaming }: MessageRendererProps) {
  const { thinkingContent, mainContent, isThinkingComplete } = useMemo(() => {
    // Parse thinking blocks: <think>...</think> or <thinking>...</thinking>
    // The API route converts reasoning_content to <think> tags
    const thinkStartMatch = content.match(/<think(?:ing)?>/i);
    const thinkEndMatch = content.match(/<\/think(?:ing)?>/i);

    if (!thinkStartMatch) {
      return { thinkingContent: null, mainContent: content, isThinkingComplete: true };
    }

    const startIdx = thinkStartMatch.index! + thinkStartMatch[0].length;

    if (!thinkEndMatch) {
      // Thinking in progress (no closing tag yet)
      const thinking = content.slice(startIdx);
      return { thinkingContent: thinking, mainContent: '', isThinkingComplete: false };
    }

    const endIdx = thinkEndMatch.index!;
    const thinking = content.slice(startIdx, endIdx);
    const after = content.slice(endIdx + thinkEndMatch[0].length);

    return { thinkingContent: thinking.trim(), mainContent: after.trim(), isThinkingComplete: true };
  }, [content]);

  return (
    <div className="message-content">
      {thinkingContent && (
        <ThinkingBlock
          content={thinkingContent}
          isStreaming={isStreaming && !isThinkingComplete}
        />
      )}

      {mainContent && (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children, ...props }) {
              const isInline = !className;
              const content = String(children).replace(/\n$/, '');

              if (isInline) {
                return (
                  <code
                    className="px-1.5 py-0.5 rounded bg-[var(--accent)] font-mono text-sm"
                    {...props}
                  >
                    {content}
                  </code>
                );
              }

              return <CodeBlock className={className}>{content}</CodeBlock>;
            },
            p({ children }) {
              return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>;
            },
            ul({ children }) {
              return <ul className="mb-3 pl-4 space-y-1 list-disc">{children}</ul>;
            },
            ol({ children }) {
              return <ol className="mb-3 pl-4 space-y-1 list-decimal">{children}</ol>;
            },
            li({ children }) {
              return <li className="leading-relaxed">{children}</li>;
            },
            h1({ children }) {
              return <h1 className="text-xl font-semibold mb-3 mt-4 first:mt-0">{children}</h1>;
            },
            h2({ children }) {
              return <h2 className="text-lg font-semibold mb-2 mt-4 first:mt-0">{children}</h2>;
            },
            h3({ children }) {
              return <h3 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h3>;
            },
            blockquote({ children }) {
              return (
                <blockquote className="border-l-2 border-[var(--border)] pl-4 my-3 text-[var(--muted-foreground)] italic">
                  {children}
                </blockquote>
              );
            },
            hr() {
              return <hr className="my-4 border-[var(--border)]" />;
            },
            a({ href, children }) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--success)] hover:underline"
                >
                  {children}
                </a>
              );
            },
            table({ children }) {
              return (
                <div className="my-3 overflow-x-auto">
                  <table className="min-w-full border border-[var(--border)] rounded-lg overflow-hidden">
                    {children}
                  </table>
                </div>
              );
            },
            thead({ children }) {
              return <thead className="bg-[var(--accent)]">{children}</thead>;
            },
            th({ children }) {
              return (
                <th className="px-4 py-2 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider border-b border-[var(--border)]">
                  {children}
                </th>
              );
            },
            td({ children }) {
              return (
                <td className="px-4 py-2 text-sm border-b border-[var(--border)]">
                  {children}
                </td>
              );
            },
            img({ src, alt }) {
              return (
                <img
                  src={src}
                  alt={alt || ''}
                  className="max-w-full rounded-lg my-3"
                />
              );
            },
          }}
        >
          {mainContent}
        </ReactMarkdown>
      )}

      {!mainContent && !thinkingContent && isStreaming && (
        <span className="inline-block w-2 h-4 bg-[var(--foreground)] animate-pulse" />
      )}
    </div>
  );
}
