// CRITICAL
import type { AgentFileEntry } from "@/lib/types";

export function flattenAgentFilePaths(entries: AgentFileEntry[], prefix = ""): string[] {
  const out: string[] = [];
  for (const e of entries) {
    const p = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.type === "file") out.push(p);
    if (e.type === "dir" && Array.isArray(e.children) && e.children.length > 0) {
      out.push(...flattenAgentFilePaths(e.children as AgentFileEntry[], p));
    }
  }
  return out;
}

function looksLikeFilePath(raw: string): boolean {
  const s = raw.trim();
  if (s.length < 2 || s.length > 260) return false;
  if (/\s/.test(s)) return false;
  if (/^https?:\/\//i.test(s)) return false;
  if (s.startsWith("data:")) return false;
  return s.includes("/") || /\.[a-z0-9]{1,10}$/i.test(s);
}

export function extractReferencedAgentPaths(text: string): string[] {
  const found = new Set<string>();
  const tick = /`([^`\n]{1,280})`/g;
  let m: RegExpExecArray | null;
  while ((m = tick.exec(text)) !== null) {
    const raw = m[1].trim();
    if (looksLikeFilePath(raw)) found.add(raw.replace(/^\/+/, ""));
  }
  const fileBracket = /\[File:\s*([^\]\n]{1,240})\]/gi;
  while ((m = fileBracket.exec(text)) !== null) {
    const raw = m[1].trim();
    if (raw.length > 0 && raw.length < 260) found.add(raw.replace(/^\/+/, ""));
  }
  return [...found];
}

export function resolveReferenceToKnownPath(ref: string, knownPaths: string[]): string | null {
  const r = ref.replace(/^\/+/, "").trim();
  if (!r) return null;
  if (knownPaths.includes(r)) return r;
  const base = r.includes("/") ? (r.split("/").pop() ?? r) : r;
  const hits = knownPaths.filter((k) => k === r || k.endsWith("/" + r) || (base && k.endsWith("/" + base)));
  const unique = [...new Set(hits)];
  if (unique.length === 1) return unique[0];
  if (unique.length > 1) {
    return unique.sort((a, b) => a.length - b.length)[0];
  }
  return null;
}
