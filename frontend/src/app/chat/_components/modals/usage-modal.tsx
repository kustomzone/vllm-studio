// CRITICAL
"use client";

import { X, BarChart3 } from "lucide-react";
import type { SessionUsage, ChatMessage } from "@/lib/types";
import { UiInsetSurface, UiModal, UiModalHeader } from "@/components/ui-kit";

interface UsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionUsage: SessionUsage | null;
  messages: ChatMessage[];
  selectedModel: string;
}

export function UsageModal({
  isOpen,
  onClose,
  sessionUsage,
  messages,
  selectedModel,
}: UsageModalProps) {
  if (!isOpen) return null;

  const formatNumber = (n: number) => n.toLocaleString();
  const formatCost = (cost?: number | null) => (cost != null ? `$${cost.toFixed(4)}` : "-");

  return (
    <UiModal isOpen={isOpen} onClose={onClose} className="max-w-md mx-4">
      <UiModalHeader
        title="Session Usage"
        icon={<BarChart3 className="h-5 w-5 text-(--dim)" />}
        onClose={onClose}
        closeIcon={<X className="h-5 w-5 text-(--dim)" />}
      />
      <div className="p-6 space-y-4">
        {sessionUsage ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <UiInsetSurface>
                <div className="text-xs text-(--dim) uppercase tracking-wide mb-1">
                  Prompt Tokens
                </div>
                <div className="text-xl font-semibold">
                  {formatNumber(sessionUsage.prompt_tokens)}
                </div>
              </UiInsetSurface>
              <UiInsetSurface>
                <div className="text-xs text-(--dim) uppercase tracking-wide mb-1">
                  Completion Tokens
                </div>
                <div className="text-xl font-semibold">
                  {formatNumber(sessionUsage.completion_tokens)}
                </div>
              </UiInsetSurface>
            </div>

            <UiInsetSurface>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-(--dim) uppercase tracking-wide mb-1">
                    Total Tokens
                  </div>
                  <div className="text-2xl font-semibold">
                    {formatNumber(sessionUsage.total_tokens)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-(--dim) uppercase tracking-wide mb-1">
                    Estimated Cost
                  </div>
                  <div className="text-xl font-semibold text-(--hl1)">
                    {formatCost(sessionUsage.estimated_cost)}
                  </div>
                </div>
              </div>
            </UiInsetSurface>

            <div className="text-xs text-(--dim)">
              Model: {selectedModel || "Unknown"}
              <br />
              Messages: {messages.length}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-(--dim)">
            <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No usage data available</p>
          </div>
        )}
      </div>
    </UiModal>
  );
}
