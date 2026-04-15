// CRITICAL
"use client";

import { useCallback, useRef } from "react";
import { useRafThrottle } from "../ui/use-raf-throttle";

/**
 * Exposes refs for the Virtuoso scroller and list end marker. Scrolling is intentionally
 * not driven from here — Virtuoso `followOutput` and its size-based bottom correction
 * own “latest at the bottom” behavior without snapping the thread to the top.
 */
export function useChatScroll(): {
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  handleScroll: () => void;
} {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const noop = useCallback(() => {}, []);
  const handleScroll = useRafThrottle(noop);

  return {
    messagesEndRef,
    messagesContainerRef,
    handleScroll,
  };
}
