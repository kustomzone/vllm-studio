// CRITICAL
"use client";

import { X, Download, FileJson, FileText } from "lucide-react";
import { UiInsetSurface, UiModal, UiModalHeader } from "@/components/ui-kit";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportJson: () => void;
  onExportMarkdown: () => void;
}

export function ExportModal({ isOpen, onClose, onExportJson, onExportMarkdown }: ExportModalProps) {
  if (!isOpen) return null;

  return (
    <UiModal isOpen={isOpen} onClose={onClose} className="max-w-sm mx-4">
      <UiModalHeader
        title="Export Chat"
        icon={<Download className="h-5 w-5 text-(--dim)" />}
        onClose={onClose}
        closeIcon={<X className="h-5 w-5 text-(--dim)" />}
      />
      <div className="p-6 space-y-3">
        <button
          onClick={() => {
            onExportJson();
            onClose();
          }}
          className="w-full"
        >
          <UiInsetSurface className="flex items-center gap-3 p-4 border border-(--border) rounded-lg bg-(--bg) hover:bg-(--accent) transition-colors">
            <FileJson className="h-5 w-5 text-(--hl1)" />
            <div className="text-left">
              <div className="font-medium">Export as JSON</div>
              <div className="text-xs text-(--dim)">Full conversation data with metadata</div>
            </div>
          </UiInsetSurface>
        </button>

        <button
          onClick={() => {
            onExportMarkdown();
            onClose();
          }}
          className="w-full"
        >
          <UiInsetSurface className="flex items-center gap-3 p-4 border border-(--border) rounded-lg bg-(--bg) hover:bg-(--accent) transition-colors">
            <FileText className="h-5 w-5 text-(--hl2)" />
            <div className="text-left">
              <div className="font-medium">Export as Markdown</div>
              <div className="text-xs text-(--dim)">Human-readable format</div>
            </div>
          </UiInsetSurface>
        </button>
      </div>
    </UiModal>
  );
}
