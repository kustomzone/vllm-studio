// CRITICAL
"use client";

import { memo } from "react";

export const TabButton = memo(
  function TabButton({
    active,
    onClick,
    label,
    accent,
  }: {
    active: boolean;
    onClick: () => void;
    label: string;
    accent?: boolean;
  }) {
    return (
      <button
        onClick={onClick}
        className={`relative px-2.5 py-2 text-[11px] font-medium transition-colors whitespace-nowrap ${
          active
            ? accent
              ? "text-(--hl2)"
              : "text-(--fg)"
            : accent
              ? "text-(--hl2)/50 hover:text-(--hl2)"
              : "text-(--dim) hover:text-(--fg)"
        }`}
      >
        {label}
      </button>
    );
  },
  function areTabButtonPropsEqual(prev, next) {
    return (
      prev.active === next.active &&
      prev.accent === next.accent &&
      prev.label === next.label &&
      prev.onClick === next.onClick
    );
  },
);
