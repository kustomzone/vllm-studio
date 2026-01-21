"use client";

import { useState, type FormEvent } from "react";
import { X, Server, RefreshCw, Trash2, Plus } from "lucide-react";
import type { MCPServer } from "@/lib/types";

interface MCPSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  servers: MCPServer[];
  onAddServer: (server: MCPServer) => Promise<void>;
  onUpdateServer: (server: MCPServer) => Promise<void>;
  onRemoveServer: (name: string) => Promise<void>;
  onRefresh?: () => void;
}

export function MCPSettingsModal({
  isOpen,
  onClose,
  servers,
  onAddServer,
  onUpdateServer,
  onRemoveServer,
  onRefresh,
}: MCPSettingsModalProps) {
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [env, setEnv] = useState("");
  const [icon, setIcon] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingServer, setPendingServer] = useState<string | null>(null);
  if (!isOpen) return null;

  const parseArgs = (input: string) =>
    input
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean);

  const parseEnv = (input: string) => {
    const entries = input
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return entries.reduce<Record<string, string>>((acc, line) => {
      const [key, ...rest] = line.split("=");
      if (!key) return acc;
      const value = rest.join("=").trim();
      if (!value) return acc;
      acc[key.trim()] = value;
      return acc;
    }, {});
  };

  const resetForm = () => {
    setName("");
    setCommand("");
    setArgs("");
    setEnv("");
    setIcon("");
    setEnabled(true);
    setFormError(null);
  };

  const handleAddServer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!name.trim() || !command.trim()) {
      setFormError("Name and command are required.");
      return;
    }

    const commandParts = command.trim().split(/\s+/).filter(Boolean);
    const resolvedCommand = commandParts[0] || "";
    const resolvedArgs = parseArgs(args);
    const finalArgs = resolvedArgs.length === 0 ? commandParts.slice(1) : resolvedArgs;

    setIsSubmitting(true);
    try {
      await onAddServer({
        name: name.trim(),
        command: resolvedCommand,
        args: finalArgs,
        env: parseEnv(env),
        icon: icon.trim() || undefined,
        enabled,
      });
      resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to add server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleServer = async (server: MCPServer) => {
    setPendingServer(server.name);
    try {
      await onUpdateServer({ ...server, enabled: !server.enabled });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to update server.");
    } finally {
      setPendingServer(null);
    }
  };

  const handleRemoveServer = async (server: MCPServer) => {
    if (!window.confirm(`Remove MCP server "${server.name}"?`)) return;
    setPendingServer(server.name);
    try {
      await onRemoveServer(server.name);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to remove server.");
    } finally {
      setPendingServer(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-lg mx-4 bg-(--card) border border-(--border) rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-(--border)">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-[#9a9590]" />
            <h2 className="text-lg font-semibold">MCP Servers</h2>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1.5 rounded hover:bg-(--accent)"
                title="Refresh servers"
              >
                <RefreshCw className="h-4 w-4 text-[#9a9590]" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-(--accent)"
            >
              <X className="h-5 w-5 text-[#9a9590]" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <form
            onSubmit={handleAddServer}
            className="space-y-4 p-4 border border-(--border) rounded-lg bg-(--background)"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-[#c8c4bd]">
              <Plus className="h-4 w-4 text-[#9a9590]" />
              Add MCP server
            </div>

            <div className="grid gap-3">
              <label className="text-xs text-[#9a9590]">
                Name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="exa"
                  className="mt-1 w-full rounded-lg border border-(--border) bg-(--card) px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-(--accent)"
                />
              </label>

              <label className="text-xs text-[#9a9590]">
                Command
                <input
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="npx -y exa-mcp-server"
                  className="mt-1 w-full rounded-lg border border-(--border) bg-(--card) px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-(--accent)"
                />
              </label>

              <label className="text-xs text-[#9a9590]">
                Args (space-separated)
                <input
                  value={args}
                  onChange={(event) => setArgs(event.target.value)}
                  placeholder="--foo bar"
                  className="mt-1 w-full rounded-lg border border-(--border) bg-(--card) px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-(--accent)"
                />
              </label>

              <label className="text-xs text-[#9a9590]">
                Env (one per line: KEY=VALUE)
                <textarea
                  value={env}
                  onChange={(event) => setEnv(event.target.value)}
                  placeholder="EXA_API_KEY=..."
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-(--border) bg-(--card) px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-(--accent)"
                />
              </label>

              <label className="text-xs text-[#9a9590]">
                Icon (optional)
                <input
                  value={icon}
                  onChange={(event) => setIcon(event.target.value)}
                  placeholder="🔎"
                  className="mt-1 w-full rounded-lg border border-(--border) bg-(--card) px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-(--accent)"
                />
              </label>

              <label className="flex items-center gap-2 text-xs text-[#9a9590]">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                  className="h-4 w-4 rounded border-(--border) bg-(--card)"
                />
                Enable on add
              </label>
            </div>

            {formError && <p className="text-xs text-red-400">{formError}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-(--accent) px-3 py-2 text-xs font-semibold text-[#eceae7] transition-colors hover:bg-(--card) disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              {isSubmitting ? "Adding..." : "Add server"}
            </button>
          </form>

          <div className="space-y-4">
            {servers.length === 0 ? (
              <div className="text-center py-8 text-[#6a6560]">
                <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No MCP servers configured</p>
              </div>
            ) : (
              servers.map((server) => (
                <div
                  key={server.name}
                  className="flex flex-col gap-3 p-3 bg-(--background) border border-(--border) rounded-lg"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-(--accent) flex items-center justify-center">
                        {server.icon ? (
                          <span className="text-sm">{server.icon}</span>
                        ) : (
                          <Server className="h-4 w-4 text-[#9a9590]" />
                        )}
                      </div>
                      <div>
                        <span className="text-sm font-medium">{server.name}</span>
                        <p className="text-xs text-[#6a6560]">{server.command}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleServer(server)}
                        disabled={pendingServer === server.name}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-60 ${
                          server.enabled
                            ? "bg-(--success)/20 text-(--success)"
                            : "bg-(--accent) text-[#6a6560]"
                        }`}
                      >
                        {server.enabled ? "Enabled" : "Disabled"}
                      </button>
                      <button
                        onClick={() => handleRemoveServer(server)}
                        className="p-1.5 rounded hover:bg-(--accent)"
                        title="Remove server"
                      >
                        <Trash2 className="h-4 w-4 text-[#9a9590]" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
