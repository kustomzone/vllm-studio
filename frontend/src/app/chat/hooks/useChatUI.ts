"use client";

import { useCallback, useEffect, useState } from "react";

interface UseChatUIOptions {
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
  onIsMobileChange?: (isMobile: boolean) => void;
}

export function useChatUI(options: UseChatUIOptions = {}) {
  const { onSidebarCollapsedChange, onIsMobileChange } = options;
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      onIsMobileChange?.(mobile);
      if (mobile) {
        onSidebarCollapsedChange?.(true);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [onIsMobileChange, onSidebarCollapsedChange]);

  const shouldShowSidebarCollapsed = useCallback(
    (value: boolean) => {
      if (!isMobile) return value;
      return true;
    },
    [isMobile],
  );

  return {
    isMobile,
    shouldShowSidebarCollapsed,
  };
}
