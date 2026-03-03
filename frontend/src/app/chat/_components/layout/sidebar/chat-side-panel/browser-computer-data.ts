// CRITICAL
"use client";

import type { ActivityGroup, ActivityItem } from "@/app/chat/types";
import { safeJsonStringify } from "@/lib/safe-json";

export interface BrowserActivityEntry {
  id: string;
  url: string;
  toolName: string;
  state: ActivityItem["state"];
  timestamp: number;
  turnTitle: string;
}

export interface ComputerActivityEntry {
  id: string;
  command: string;
  output: string;
  toolName: string;
  state: ActivityItem["state"];
  timestamp: number;
  turnTitle: string;
}

const URL_REGEX = /https?:\/\/[^\s"'<>]+/i;

const BROWSER_TOOL_HINTS = [
  "browser_open_url",
  "web_search",
  "fetch_url",
  "browse",
  "open_url",
  "http_request",
  "website",
  "browser",
];

const COMPUTER_TOOL_HINTS = [
  "computer_use",
  "execute_command",
  "run_command",
  "shell",
  "bash",
  "terminal",
  "command",
];

const normalizeToolName = (toolName?: string): string => {
  if (!toolName) return "";
  const clean = toolName.includes("__") ? toolName.split("__").slice(1).join("__") : toolName;
  return clean.trim().toLowerCase();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
};

const normalizeBrowserUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(trimmed)) return `http://${trimmed}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  const inlineUrl = trimmed.match(URL_REGEX)?.[0];
  return inlineUrl ?? null;
};

const readStringFromRecord = (record: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const direct = asString(record[key]);
    if (direct) return direct;
    const nested = record[key];
    if (isRecord(nested)) {
      const nestedValue = readStringFromRecord(nested, keys);
      if (nestedValue) return nestedValue;
    }
  }
  return null;
};

const extractUrlFromUnknown = (value: unknown): string | null => {
  const direct = asString(value);
  if (direct) {
    return normalizeBrowserUrl(direct);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = extractUrlFromUnknown(item);
      if (candidate) return candidate;
    }
    return null;
  }
  if (isRecord(value)) {
    const fromKnownKeys = readStringFromRecord(value, [
      "url",
      "href",
      "link",
      "uri",
      "website",
      "target",
      "location",
      "input",
    ]);
    if (fromKnownKeys) {
      return normalizeBrowserUrl(fromKnownKeys);
    }
  }
  return null;
};

const extractCommandFromUnknown = (value: unknown): string | null => {
  const direct = asString(value);
  if (direct) return direct;
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = extractCommandFromUnknown(item);
      if (candidate) return candidate;
    }
    return null;
  }
  if (isRecord(value)) {
    return readStringFromRecord(value, [
      "command",
      "cmd",
      "shell_command",
      "shellCommand",
      "input",
      "script",
    ]);
  }
  return null;
};

const formatOutput = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return safeJsonStringify(value, "");
};

const trimOutput = (value: string, maxChars = 8000): string => {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n...[truncated]`;
};

const collectToolItems = (
  activityGroups: ActivityGroup[],
): Array<{ item: ActivityItem; turnTitle: string }> => {
  const rows: Array<{ item: ActivityItem; turnTitle: string }> = [];
  for (const group of activityGroups) {
    for (const item of group.items) {
      if (item.type !== "tool-call") continue;
      rows.push({ item, turnTitle: group.title });
    }
  }
  return rows;
};

export const extractBrowserActivityEntries = (
  activityGroups: ActivityGroup[],
): BrowserActivityEntry[] => {
  const entries = collectToolItems(activityGroups)
    .flatMap(({ item, turnTitle }) => {
      const toolName = normalizeToolName(item.toolName);
      if (!BROWSER_TOOL_HINTS.some((hint) => toolName.includes(hint))) return [];
      const url = extractUrlFromUnknown(item.input) ?? extractUrlFromUnknown(item.output);
      if (!url) return [];
      return [
        {
          id: item.id,
          url,
          toolName: toolName || "browser",
          state: item.state,
          timestamp: item.timestamp,
          turnTitle,
        } satisfies BrowserActivityEntry,
      ];
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  return entries;
};

export const extractComputerActivityEntries = (
  activityGroups: ActivityGroup[],
): ComputerActivityEntry[] =>
  collectToolItems(activityGroups)
    .flatMap(({ item, turnTitle }) => {
      const toolName = normalizeToolName(item.toolName);
      if (!COMPUTER_TOOL_HINTS.some((hint) => toolName.includes(hint))) return [];
      const command = extractCommandFromUnknown(item.input) ?? "(no command captured)";
      return [
        {
          id: item.id,
          command,
          output: trimOutput(formatOutput(item.output)),
          toolName: toolName || "computer",
          state: item.state,
          timestamp: item.timestamp,
          turnTitle,
        } satisfies ComputerActivityEntry,
      ];
    })
    .sort((a, b) => b.timestamp - a.timestamp);
