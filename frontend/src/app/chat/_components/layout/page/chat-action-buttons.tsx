// CRITICAL
"use client";

import { memo } from "react";

interface ChatActionButtonsProps {
  activityCount: number;
  hasActiveThinking?: boolean;
  onOpenActivity: () => void;
  onOpenContext: () => void;
  onOpenSettings: () => void;
  onOpenUsage: () => void;
  onOpenExport: () => void;
}

function ChatActionButtonsBase(_props: ChatActionButtonsProps) {
  return null;
}

function areChatActionButtonsPropsEqual(
  prev: ChatActionButtonsProps,
  next: ChatActionButtonsProps,
): boolean {
  return (
    prev.activityCount === next.activityCount &&
    prev.hasActiveThinking === next.hasActiveThinking &&
    prev.onOpenActivity === next.onOpenActivity &&
    prev.onOpenContext === next.onOpenContext &&
    prev.onOpenSettings === next.onOpenSettings &&
    prev.onOpenUsage === next.onOpenUsage &&
    prev.onOpenExport === next.onOpenExport
  );
}

export const ChatActionButtons = memo(ChatActionButtonsBase, areChatActionButtonsPropsEqual);
