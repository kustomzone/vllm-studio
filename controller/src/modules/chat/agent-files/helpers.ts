import { posix } from "node:path";

export const normalizeAgentPath = (rawPath: string): string => {
  const cleaned = rawPath.replace(/^\/+/, "").trim();
  if (!cleaned) return "";
  const normalized = posix.normalize(cleaned);
  if (normalized === "." || normalized === "") return "";
  if (normalized.startsWith("..") || normalized.includes("/..")) {
    throw new Error("Invalid path");
  }
  return normalized.replace(/^\/+/, "");
};
