"use client";

import { X, Server, RefreshCw } from "lucide-react";
import type { MCPServer } from "../types";

interface MCPSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  servers: MCPServer[];
  onServersChange: (servers: MCPServer[]) => void;
  onRefresh?: () => void;
}

export function MCPSettingsModal({
  isOpen,
  onClose,
  servers,
  onServersChange,
  onRefresh,
}: MCPSettingsModalProps) {
  if (!isOpen) return null;

  const toggleServer = (name: string) => {
    onServersChange(
      servers.map((s) =>
        s.name === name ? { ...s, enabled: !s.enabled } : s,
      ),
    );
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
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {servers.length === 0 ? (
            <div className="text-center py-8 text-[#6a6560]">
              <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No MCP servers configured</p>
            </div>
          ) : (
            servers.map((server) => (
              <div
                key={server.name}
                className="flex items-center justify-between p-3 bg-(--background) border border-(--border) rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-(--accent) flex items-center justify-center">
                    {server.icon ? (
                      <span className="text-sm">{server.icon}</span>
                    ) : (
                      <Server className="h-4 w-4 text-[#9a9590]" />
                    )}
                  </div>
                  <span className="text-sm font-medium">{server.name}</span>
                </div>
                <button
                  onClick={() => toggleServer(server.name)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    server.enabled
                      ? "bg-(--success)/20 text-(--success)"
                      : "bg-(--accent) text-[#6a6560]"
                  }`}
                >
                  {server.enabled ? "Enabled" : "Disabled"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
