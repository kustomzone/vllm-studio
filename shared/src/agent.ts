/**
 * Agent file system types shared across controller and frontend.
 */

export interface AgentFileEntry {
  name: string;
  type: "file" | "dir";
  size?: number;
  children?: AgentFileEntry[];
}
