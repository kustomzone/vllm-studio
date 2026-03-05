"use client";

import { isLocalImportSpecifier, resolvePath, stripQueryAndHash } from "./path-resolver";

export type HtmlAssetRef = {
  raw: string;
  resolvedPath: string;
  isModule: boolean;
};

function parseHtmlDocument(html: string): Document | null {
  if (typeof DOMParser === "undefined") return null;
  try {
    return new DOMParser().parseFromString(html, "text/html");
  } catch {
    return null;
  }
}

export function extractLocalHtmlAssetRefs(html: string, basePath: string): HtmlAssetRef[] {
  const doc = parseHtmlDocument(html);
  if (!doc) return [];

  const assets: HtmlAssetRef[] = [];

  doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]').forEach((link) => {
    const href = link.getAttribute("href")?.trim() ?? "";
    if (!isLocalImportSpecifier(href)) return;
    assets.push({
      raw: href,
      resolvedPath: resolvePath(basePath, stripQueryAndHash(href)),
      isModule: false,
    });
  });

  doc.querySelectorAll<HTMLScriptElement>("script[src]").forEach((script) => {
    const src = script.getAttribute("src")?.trim() ?? "";
    if (!isLocalImportSpecifier(src)) return;
    assets.push({
      raw: src,
      resolvedPath: resolvePath(basePath, stripQueryAndHash(src)),
      isModule: (script.getAttribute("type") ?? "").trim().toLowerCase() === "module",
    });
  });

  return assets;
}

export function inlineHtmlLocalAssets(
  html: string,
  basePath: string,
  readAsset: (resolvedPath: string) => string | null,
  rewriteModule: (code: string, path: string) => string,
): string {
  const doc = parseHtmlDocument(html);
  if (!doc) return html;

  doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]').forEach((link) => {
    const href = link.getAttribute("href")?.trim() ?? "";
    if (!isLocalImportSpecifier(href)) return;
    const resolvedPath = resolvePath(basePath, stripQueryAndHash(href));
    const cssContent = readAsset(resolvedPath);
    if (!cssContent) return;
    const style = doc.createElement("style");
    style.textContent = `/* Inlined from ${href} */\n${cssContent}`;
    link.replaceWith(style);
  });

  doc.querySelectorAll<HTMLScriptElement>("script[src]").forEach((script) => {
    const src = script.getAttribute("src")?.trim() ?? "";
    if (!isLocalImportSpecifier(src)) return;
    const resolvedPath = resolvePath(basePath, stripQueryAndHash(src));
    const jsContent = readAsset(resolvedPath);
    if (!jsContent) return;

    const nextScript = doc.createElement("script");
    const isModule = (script.getAttribute("type") ?? "").trim().toLowerCase() === "module";
    if (isModule) {
      nextScript.setAttribute("type", "module");
    }
    nextScript.textContent = isModule
      ? `/* Inlined from ${src} */\n${rewriteModule(jsContent, resolvedPath)}`
      : `/* Inlined from ${src} */\n${jsContent}`;
    script.replaceWith(nextScript);
  });

  return doc.documentElement.outerHTML;
}
