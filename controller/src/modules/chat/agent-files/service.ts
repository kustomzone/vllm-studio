// CRITICAL
import type { AppContext } from "../../../types/context";
import { normalizeAgentPath } from "./helpers";
import type { AgentFileEntry } from "./types";

const codedError = (code: string, message: string): Error & { code: string } => {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
};

type TreeNode = AgentFileEntry & {
  childrenByName?: Map<string, TreeNode>;
};

const insertDirectory = (root: TreeNode, path: string): TreeNode => {
  let node = root;
  for (const segment of path.split("/").filter(Boolean)) {
    node.childrenByName ??= new Map<string, TreeNode>();
    let child = node.childrenByName.get(segment);
    if (!child) {
      child = { name: segment, type: "dir", children: [], childrenByName: new Map() };
      node.childrenByName.set(segment, child);
      node.children?.push(child);
    }
    node = child;
  }
  return node;
};

const insertFile = (root: TreeNode, path: string, size: number): void => {
  const parentPath = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const fileName = path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path;
  const parent = insertDirectory(root, parentPath);
  parent.childrenByName ??= new Map<string, TreeNode>();
  const existing = parent.childrenByName.get(fileName);
  if (existing?.type === "dir") return;
  const file: TreeNode = { name: fileName, type: "file", size };
  parent.childrenByName.set(fileName, file);
  parent.children = [...(parent.children ?? []).filter((entry) => entry.name !== fileName), file];
};

const stripInternalTreeState = (node: TreeNode, recursive: boolean): AgentFileEntry[] => {
  const children = [...(node.children ?? [])].sort((left, right) => {
    if (left.type === right.type) return left.name.localeCompare(right.name);
    return left.type === "dir" ? -1 : 1;
  });

  return children.map((child) => {
    if (child.type === "dir") {
      return {
        name: child.name,
        type: "dir",
        children: recursive ? stripInternalTreeState(child, recursive) : [],
      };
    }
    return { name: child.name, type: "file", size: child.size ?? 0 };
  });
};

const pathIsUnder = (path: string, directory: string): boolean => {
  if (!directory) return true;
  return path === directory || path.startsWith(`${directory}/`);
};

const relativeTo = (path: string, directory: string): string => {
  if (!directory) return path;
  if (path === directory) return "";
  return path.slice(directory.length + 1);
};

const ensureParentDirectories = (context: AppContext, sessionId: string, path: string): void => {
  const parentDirectory = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  let current = "";
  for (const segment of parentDirectory.split("/").filter(Boolean)) {
    current = current ? `${current}/${segment}` : segment;
    context.stores.chatStore.addAgentDirectory(sessionId, current);
  }
};

export const listAgentFiles = async (
  context: AppContext,
  sessionId: string,
  rawPath: string,
  recursive: boolean
): Promise<AgentFileEntry[]> => {
  const normalized = normalizeAgentPath(rawPath);
  const kind = context.stores.chatStore.getAgentPathKind(sessionId, normalized);
  if (kind === "file") throw codedError("ENOTDIR", "Path is a file");
  if (normalized && !kind) throw codedError("ENOENT", "Path not found");

  const root: TreeNode = { name: "", type: "dir", children: [], childrenByName: new Map() };
  for (const directory of context.stores.chatStore.listAgentDirectories(sessionId)) {
    if (pathIsUnder(directory, normalized)) {
      const relativePath = relativeTo(directory, normalized);
      if (relativePath) insertDirectory(root, relativePath);
    }
  }
  for (const file of context.stores.chatStore.listLatestAgentFiles(sessionId)) {
    if (pathIsUnder(file.path, normalized)) {
      const relativePath = relativeTo(file.path, normalized);
      if (relativePath)
        insertFile(root, relativePath, file.bytes ?? Buffer.byteLength(file.content, "utf8"));
    }
  }
  return stripInternalTreeState(root, recursive);
};

export const readAgentFile = async (
  context: AppContext,
  sessionId: string,
  rawPath: string
): Promise<{ normalizedPath: string; content: string }> => {
  const normalized = normalizeAgentPath(rawPath);
  const file = context.stores.chatStore.getLatestAgentFile(sessionId, normalized);
  if (!file) {
    const kind = context.stores.chatStore.getAgentPathKind(sessionId, normalized);
    if (kind === "dir") throw codedError("EISDIR", "Path is a directory");
    throw codedError("ENOENT", "File not found");
  }
  return { normalizedPath: normalized, content: file.content };
};

export const writeAgentFile = async (
  context: AppContext,
  sessionId: string,
  rawPath: string,
  content: string | Buffer
): Promise<{ normalizedPath: string; bytes: number }> => {
  const normalized = normalizeAgentPath(rawPath);
  if (!normalized) throw codedError("EISDIR", "Path is a directory");
  ensureParentDirectories(context, sessionId, normalized);
  const text = typeof content === "string" ? content : content.toString("utf8");
  const bytes = Buffer.byteLength(text, "utf8");
  context.stores.chatStore.addAgentFileVersion(sessionId, normalized, text, bytes);
  return {
    normalizedPath: normalized,
    bytes,
  };
};

export const deleteAgentPath = async (
  context: AppContext,
  sessionId: string,
  rawPath: string
): Promise<string> => {
  const normalized = normalizeAgentPath(rawPath);
  context.stores.chatStore.deleteAgentFileVersionsForPath(sessionId, normalized);
  return normalized;
};

export const createAgentDirectory = async (
  context: AppContext,
  sessionId: string,
  rawPath: string
): Promise<string> => {
  const normalized = normalizeAgentPath(rawPath);
  let current = "";
  for (const segment of normalized.split("/").filter(Boolean)) {
    current = current ? `${current}/${segment}` : segment;
    context.stores.chatStore.addAgentDirectory(sessionId, current);
  }
  return normalized;
};

export const moveAgentPath = async (
  context: AppContext,
  sessionId: string,
  rawFrom: string,
  rawTo: string
): Promise<{ from: string; to: string }> => {
  const from = normalizeAgentPath(rawFrom);
  const to = normalizeAgentPath(rawTo);
  if (!from || !to) throw codedError("EINVAL", "from and to are required");
  const sourceKind = context.stores.chatStore.getAgentPathKind(sessionId, from);
  if (!sourceKind) throw codedError("ENOENT", "Path not found");
  ensureParentDirectories(context, sessionId, to);
  if (sourceKind === "dir") {
    context.stores.chatStore.addAgentDirectory(sessionId, to);
  }
  context.stores.chatStore.moveAgentFileVersions(sessionId, from, to);
  return { from, to };
};
