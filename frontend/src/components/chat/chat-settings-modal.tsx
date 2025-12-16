'use client';

import { useState, useEffect } from 'react';
import { X, Settings, Trash2, Info } from 'lucide-react';

interface ChatSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
}

const STORAGE_KEY = 'vllm-studio-system-prompt';

export function ChatSettingsModal({
  isOpen,
  onClose,
  systemPrompt,
  onSystemPromptChange,
}: ChatSettingsModalProps) {
  const [localPrompt, setLocalPrompt] = useState(systemPrompt);

  useEffect(() => {
    setLocalPrompt(systemPrompt);
  }, [systemPrompt]);

  useEffect(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && !systemPrompt) {
      onSystemPromptChange(saved);
    }
  }, []);

  if (!isOpen) return null;

  const handleSave = () => {
    onSystemPromptChange(localPrompt);
    localStorage.setItem(STORAGE_KEY, localPrompt);
    onClose();
  };

  const handleClear = () => {
    setLocalPrompt('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-[var(--muted)]" />
            <h2 className="font-medium">Chat Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--accent)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* System Prompt Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">System Prompt</label>
              <button
                onClick={handleClear}
                className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--error)] transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              The system prompt is sent at the start of every conversation to guide the model&apos;s behavior.
            </p>
            <textarea
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              placeholder="Enter a system prompt... (e.g., You are a helpful coding assistant.)"
              className="w-full h-64 px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg resize-none focus:outline-none focus:border-[var(--foreground)] font-mono"
            />
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <Info className="h-3 w-3" />
              <span>{localPrompt.length} characters</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm border border-[var(--border)] rounded hover:bg-[var(--accent)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-sm bg-[var(--foreground)] text-[var(--background)] rounded hover:opacity-90 transition-opacity"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
