// CRITICAL
"use client";

import type { AgentFileVersion } from "@/lib/types";
import {
  buildSvgDocument,
  buildReactDocument,
  buildJsDocument,
  buildHtmlDocument,
  buildTextDocument,
} from "../artifacts/artifact-templates";
import { inlineHtmlLocalAssets } from "../../utils/html-dependency-parser";
import { isLocalImportSpecifier, resolvePath, stripQueryAndHash } from "../../utils/path-resolver";
import { getFileExtension } from "./agent-file-metadata";

function encodeBase64(value: string): string {
  try {
    if (typeof TextEncoder !== "undefined") {
      const bytes = new TextEncoder().encode(value);
      let binary = "";
      for (const byte of bytes) {
        binary += String.fromCharCode(byte);
      }
      if (typeof btoa === "function") return btoa(binary);
      const maybeBuffer = (
        globalThis as {
          Buffer?: { from: (data: Uint8Array) => { toString: (enc: string) => string } };
        }
      ).Buffer;
      if (maybeBuffer) return maybeBuffer.from(bytes).toString("base64");
    }
  } catch {
    // fallthrough
  }
  try {
    const maybeBuffer = (
      globalThis as {
        Buffer?: { from: (data: string, enc: string) => { toString: (enc: string) => string } };
      }
    ).Buffer;
    if (maybeBuffer) return maybeBuffer.from(value, "utf-8").toString("base64");
  } catch {
    // fallthrough
  }
  return "";
}

function makeDataUrl(code: string, mime: string): string {
  const base64 = encodeBase64(code);
  if (base64) return `data:${mime};base64,${base64}`;
  return `data:${mime};charset=utf-8,${encodeURIComponent(code)}`;
}

function getFileContent(path: string, allFileVersions: Record<string, AgentFileVersion[]>): string | null {
  const versions = allFileVersions[path];
  if (!versions || versions.length === 0) return null;
  return versions[versions.length - 1].content;
}

function createModuleResolver(allFileVersions: Record<string, AgentFileVersion[]>) {
  const cache = new Map<string, string>();
  const inProgress = new Set<string>();
  const moduleExts = new Set(["js", "mjs", "jsx"]);

  function resolveModulePath(fromPath: string, spec: string): string | null {
    if (!isLocalImportSpecifier(spec)) return null;
    const cleaned = stripQueryAndHash(spec);
    const resolved = resolvePath(fromPath, cleaned);

    if (getFileContent(resolved, allFileVersions)) return resolved;

    const withJs = `${resolved}.js`;
    if (getFileContent(withJs, allFileVersions)) return withJs;

    const withMjs = `${resolved}.mjs`;
    if (getFileContent(withMjs, allFileVersions)) return withMjs;

    const withJsx = `${resolved}.jsx`;
    if (getFileContent(withJsx, allFileVersions)) return withJsx;

    const withIndex = `${resolved}/index.js`;
    if (getFileContent(withIndex, allFileVersions)) return withIndex;

    return getFileContent(resolved, allFileVersions) ? resolved : null;
  }

  function rewriteImports(code: string, fromPath: string): string {
    let result = code;

    const replacer = (
      match: string,
      prefix: string,
      quote: string,
      spec: string,
      suffix: string,
    ) => {
      if (!isLocalImportSpecifier(spec)) return match;
      const resolved = resolveModulePath(fromPath, spec);
      if (!resolved) return match;
      const url = buildDataUrlForPath(resolved);
      if (!url) return match;
      return `${prefix}${quote}${url}${quote}${suffix}`;
    };

    result = result.replace(
      /(import\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g,
      replacer,
    );

    result = result.replace(
      /(import\s+[^'"]*?\s+from\s+)(['"])([^'"]+)\2/g,
      (match, prefix, quote, spec) => replacer(match, prefix, quote, spec, ""),
    );

    result = result.replace(
      /(export\s+[^'"]*?\s+from\s+)(['"])([^'"]+)\2/g,
      (match, prefix, quote, spec) => replacer(match, prefix, quote, spec, ""),
    );

    result = result.replace(
      /(import\s+)(['"])([^'"]+)\2/g,
      (match, prefix, quote, spec) => replacer(match, prefix, quote, spec, ""),
    );

    return result;
  }

  function buildDataUrlForPath(path: string): string | null {
    const ext = getFileExtension(path);
    if (!moduleExts.has(ext)) return null;
    if (cache.has(path)) return cache.get(path) ?? null;
    if (inProgress.has(path)) return null;
    const content = getFileContent(path, allFileVersions);
    if (content == null) return null;
    inProgress.add(path);
    const rewritten = rewriteImports(content, path);
    const dataUrl = makeDataUrl(rewritten, "text/javascript");
    cache.set(path, dataUrl);
    inProgress.delete(path);
    return dataUrl;
  }

  return { rewriteImports };
}

function inlineLocalImports(
  htmlContent: string,
  currentPath: string,
  allFileVersions: Record<string, AgentFileVersion[]>,
): string {
  const moduleResolver = createModuleResolver(allFileVersions);
  return inlineHtmlLocalAssets(
    htmlContent,
    currentPath,
    (resolvedPath) => getFileContent(resolvedPath, allFileVersions),
    (code, resolvedPath) => moduleResolver.rewriteImports(code, resolvedPath),
  );
}

export function buildPreviewDocumentWithImports(
  ext: string,
  content: string,
  currentPath: string,
  allFileVersions: Record<string, AgentFileVersion[]>,
): string {
  if (ext === "svg") {
    const svgCode = content.includes("<svg")
      ? content
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${content}</svg>`;
    return buildSvgDocument(svgCode, 1);
  }
  if (ext === "html") {
    const inlined = inlineLocalImports(content, currentPath, allFileVersions);
    return buildHtmlDocument(inlined);
  }
  if (["js", "mjs", "cjs"].includes(ext)) return buildJsDocument(content);
  if (["jsx", "tsx", "ts"].includes(ext)) return buildReactDocument(content);
  return buildTextDocument(content);
}
